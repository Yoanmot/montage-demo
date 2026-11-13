#!/usr/bin/env python3
"""verifier.py : contrôles image par image d'un calque rendu (appelé par verifier.mjs).

  verifier.py analyse <calque_encre.mov> <calque.json> <sortie.json> [--sans-zone] [--zone-des <image>]
      Encre = pixels d'alpha >= 0,7 (les ombres douces, voiles et fonds marqués .fd ne comptent pas : le rendu « encre »
      les a cachés). Zone sûre de commun.mjs : boîte de l'encre de chaque image, les 4 coins de la boîte de toute la durée.
      Arrivées : images où de l'encre neuve apparaît, comparées aux éléments attendus (calque.json « attendus ») et à
      l'image de leur mot (« mot_image ») : un élément ne s'affiche jamais avant que Romain dise son mot.
      --zone-des <image> : la zone sûre se contrôle à partir de cette image du calque (titre qui suit le dézoom
      d'ouverture : il dépasse légitimement pendant le dézoom, il doit tenir une fois la caméra à 100 %).
  verifier.py tete <video_coupee> <image_debut> <nb_images>
      Haut du crâne de Romain sur ces images (pour poser un mot géant derrière sa tête).
  verifier.py apercu <video_coupee> <calque.mov> <calque.json> <sortie.mp4> <planche.png> [ffmpeg]
      Pose le calque sur la vidéo coupée (même fenêtre d'images), en appliquant son « plan » (flou, décalage, détouré)
      et, pour la couche derriere, en trouant le calque par le masque de Romain (Apple Vision). Aperçu de contrôle 540 x 960
      avec le son ; planche PNG des images clés (arrivées attendues, début, milieu, fin) pour la regarder image par image.
      Ce n'est PAS le rendu final (pas d'étalonnage, un réencodage de plus) : c'est la brique rendu qui fait la vidéo.
"""
import json, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ICI = Path(__file__).resolve().parent
BIB = ICI.parent.parent / "bibliotheque"
C = json.loads(subprocess.run(["node", "-e", "import(process.argv[1]).then(m=>console.log(JSON.stringify(m)))",
                               (BIB / "commun.mjs").as_uri()], capture_output=True, text=True, check=True).stdout)
W, H, FPS = 1080, 1920, 30
ZS = C["ZONE_SURE"]
FF = "ffmpeg"


def frames(video, w=W, h=H, debut=None, n=None, fmt="rgba"):
    cmd = [FF, "-v", "error"]
    cmd += ["-i", str(video)]
    vf = f"scale={w}:{h}:flags=lanczos"
    if debut is not None:
        vf = f"select='gte(n\\,{debut})',setpts=N/FRAME_RATE/TB," + vf
    cmd += ["-vf", vf, "-f", "rawvideo", "-pix_fmt", fmt, "-"]
    if n is not None:
        cmd[-1:-1] = ["-frames:v", str(n)]
    ch = 4 if fmt == "rgba" else 3
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    k = 0
    while n is None or k < n:
        raw = p.stdout.read(w * h * ch)
        if len(raw) < w * h * ch:
            break
        yield np.frombuffer(raw, np.uint8).reshape(h, w, ch)
        k += 1
    p.stdout.close(); p.wait()


# ---------------------------------------------------------------------------------------------- analyse
def analyse(mov, fiche_f, sortie, sans_zone=False, zone_des=0):
    fiche = json.loads(Path(fiche_f).read_text())
    tol = 3
    boites, compte, neuf = [], [], []
    prec = None
    for k, fr in enumerate(frames(mov)):
        a = fr[..., 3] >= 178
        compte.append(int(a.sum()))
        if a.any():
            ys, xs = np.where(a.any(1))[0], np.where(a.any(0))[0]
            boites.append([int(xs[0]), int(ys[0]), int(xs[-1]), int(ys[-1])])
        else:
            boites.append(None)
        # changement : pixel qui apparaît (alpha) ou qui change de couleur sur une zone déjà opaque (texte posé sur
        # une carte) ; une arrivée = début d'une vague de changement
        if prec is None:
            neuf.append(0)
        else:
            da = np.abs(fr[..., 3].astype(np.int16) - prec[..., 3])
            dc = np.abs(fr[..., :3].astype(np.int16) - prec[..., :3]).max(-1)
            neuf.append(int(((da > 25) | ((fr[..., 3] > 178) & (dc > 40))).sum()))
        prec = fr.astype(np.int16)
    n = len(compte)
    # images hors zone
    hors = []
    if not sans_zone:
        for k, b in enumerate(boites):
            if k < zone_des:
                continue
            if b and (b[0] < ZS["x0"] - tol or b[2] > ZS["x1"] + tol or b[1] < ZS["y0"] - tol or b[3] > ZS["y1"] + tol):
                hors.append({"image": k, "boite": b})
    tout = [b for b in boites if b]
    union = [min(b[0] for b in tout), min(b[1] for b in tout), max(b[2] for b in tout), max(b[3] for b in tout)] if tout else None
    coins = None
    if union:
        coins = {"haut_gauche": [union[0], union[1]], "haut_droite": [union[2], union[1]],
                 "bas_gauche": [union[0], union[3]], "bas_droite": [union[2], union[3]]}
    # arrivées : début d'une vague de changement d'au moins 400 px
    SEUIL = 400
    arrivees = [k for k in range(1, n) if neuf[k] >= SEUIL and neuf[k - 1] < SEUIL]
    if n and compte[0] > 0:
        arrivees = [0] + arrivees
    attendus = []
    for at in fiche.get("attendus", []):
        proches = sorted((a for a in arrivees if -2 <= a - at["image"] <= 2), key=lambda a: abs(a - at["image"]))
        r = dict(at, detectee=proches[0] if proches else None)
        if "mot_image" in at:
            # l'instant prévu (calé par T) fait foi ; l'arrivée détectée n'est qu'un indice (une vignette qui se soulève
            # juste avant le mot, prévue par le gabarit, crée aussi une vague de changement)
            r["avant_son_mot"] = (fiche["debut"] + at["image"]) < at["mot_image"] - 1
        attendus.append(r)
    imprevues = [a for a in arrivees if not any(-2 <= a - at["image"] <= 2 for at in fiche.get("attendus", []))]
    res = {"images": n, "hors_zone": hors[:20], "nb_hors_zone": len(hors), "zone_controlee": not sans_zone,
           "zone_des": zone_des,
           "boite_totale": union, "coins": coins, "arrivees_detectees": arrivees, "attendus": attendus,
           "arrivees_imprevues": imprevues, "image0_vide": compte[0] == 0 if n else True}
    Path(sortie).write_text(json.dumps(res, indent=1, ensure_ascii=False))
    print(json.dumps({k: res[k] for k in ("images", "nb_hors_zone", "boite_totale", "arrivees_detectees", "arrivees_imprevues")}, ensure_ascii=False))
    for at in attendus:
        etat = "OK" if at["detectee"] is not None else "NON VUE"
        if at.get("avant_son_mot"):
            etat = "AVANT SON MOT"
        print(f"  attendu {at['nom']} image {at['image']} -> {etat}" + (f" (vue à {at['detectee']})" if at["detectee"] is not None else ""))


# ---------------------------------------------------------------------------------------------- aperçu
def masque_vision(rgb, brut=False):
    import Quartz, Vision
    from Foundation import NSData
    im = Image.fromarray(rgb)
    import io
    buf = io.BytesIO(); im.save(buf, format="PNG")
    data = NSData.dataWithBytes_length_(buf.getvalue(), len(buf.getvalue()))
    src = Quartz.CGImageSourceCreateWithData(data, None)
    cg = Quartz.CGImageSourceCreateImageAtIndex(src, 0, None)
    req = Vision.VNGeneratePersonSegmentationRequest.alloc().initWithCompletionHandler_(None)
    req.setQualityLevel_(0)
    req.setOutputPixelFormat_(Quartz.kCVPixelFormatType_OneComponent8)
    h = Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(cg, {})
    ok, err = h.performRequests_error_([req], None)
    if not ok:
        raise RuntimeError(f"Vision : {err}")
    pb = req.results()[0].pixelBuffer()
    w = Quartz.CVPixelBufferGetWidth(pb); ht = Quartz.CVPixelBufferGetHeight(pb)
    Quartz.CVPixelBufferLockBaseAddress(pb, 1)
    bpr = Quartz.CVPixelBufferGetBytesPerRow(pb)
    arr = np.frombuffer(Quartz.CVPixelBufferGetBaseAddress(pb).as_buffer(bpr * ht), dtype=np.uint8).reshape(ht, bpr)[:, :w].copy()
    Quartz.CVPixelBufferUnlockBaseAddress(pb, 1)
    m = np.asarray(Image.fromarray(arr).resize((W, H), Image.BILINEAR)).astype(np.float32) / 255.
    if brut:
        return m
    t = np.clip((m - 0.40) / 0.40, 0, 1)   # resserrement du labo (detourage.py : SEUIL_BAS 0,40, SEUIL_HAUT 0,80)
    return t * t * (3 - 2 * t)


def apercu(video, mov, fiche_f, sortie, planche, ff=None):
    global FF
    if ff:
        FF = ff
    fiche = json.loads(Path(fiche_f).read_text())
    d, n = fiche["debut"], fiche["images"]
    plan = fiche.get("plan") or {}
    dec = None
    if "decalage_y" in plan:
        dec = json.loads((Path(fiche_f).parent.parent.parent / plan["decalage_y"]).read_text())
    derriere = fiche["couche"] == "derriere"
    clefs = {0, n // 2, n - 1} | {min(n - 1, a["image"] + j) for a in fiche.get("attendus", []) for j in (0, 4, 12)}
    clefs |= {s["image"] - d + j for s in fiche.get("sons_suggeres", []) for j in (-2, -1, 0, 1, 2) if 0 <= s["image"] - d + j < n}
    clefs = sorted(clefs)
    gardees = {}
    enc = subprocess.Popen([FF, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W // 2}x{H // 2}", "-r", "30",
                            "-i", "-", "-ss", f"{d / FPS:.4f}", "-t", f"{n / FPS:.4f}", "-i", str(video),
                            "-map", "0:v", "-map", "1:a?", "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p",
                            "-c:a", "aac", "-shortest", str(sortie)], stdin=subprocess.PIPE)
    for k, (cam, cal) in enumerate(zip(frames(video, debut=d, n=n, fmt="rgb24"), frames(mov, n=n))):
        cam_f = cam.astype(np.float32)
        if derriere or plan.get("detoure"):
            m = masque_vision(cam)
        if "flou" in plan:
            fl = Image.fromarray(cam).filter(ImageFilter.GaussianBlur(plan["flou"]["rayon"]))
            cam_f = np.asarray(fl).astype(np.float32) * plan["flou"]["assombrir"]   # niveau gardé (CONTRAT, brique rendu)
        if dec is not None and k < len(dec) and dec[k] > 0:
            o = int(round(dec[k])); sh = np.zeros_like(cam_f); sh[o:] = cam_f[:H - o]; cam_f = sh
        a = cal[..., 3:4].astype(np.float32) / 255.
        rgb = cal[..., :3].astype(np.float32)
        if plan.get("detoure"):
            out = rgb * a + cam_f * (1 - a)
            mm = m[..., None]
            out = cam_f * mm + out * (1 - mm)
        elif derriere:
            a = a * (1 - m[..., None])
            out = rgb * a + cam_f * (1 - a)
        else:
            out = rgb * a + cam_f * (1 - a)
        o8 = np.clip(out + 0.5, 0, 255).astype(np.uint8)
        if k in clefs:
            gardees[k] = o8
        enc.stdin.write(np.asarray(Image.fromarray(o8).resize((W // 2, H // 2), Image.LANCZOS)).tobytes())
    enc.stdin.close(); enc.wait()
    # planche : images clés à 270 x 480, 6 par ligne, numéro d'image du calque et de la vidéo
    tw, th = 270, 480
    ks = sorted(gardees)
    cols = min(6, len(ks)); rows = (len(ks) + cols - 1) // cols
    pl = Image.new("RGB", (cols * tw, rows * (th + 28)), (40, 40, 40))
    dr = ImageDraw.Draw(pl)
    for i, k in enumerate(ks):
        x, y = (i % cols) * tw, (i // cols) * (th + 28)
        im = Image.fromarray(gardees[k]).resize((tw, th), Image.LANCZOS)
        # zone sûre en filet fin
        zd = ImageDraw.Draw(im)
        zd.rectangle([ZS["x0"] / 4, ZS["y0"] / 4, ZS["x1"] / 4, ZS["y1"] / 4], outline=(0, 255, 255))
        pl.paste(im, (x, y + 28))
        dr.text((x + 6, y + 6), f"calque {k} / video {d + k}", fill=(255, 255, 255))
    pl.save(planche)
    print(f"apercu {sortie} ; planche {planche} ({len(ks)} images : {ks})")


# ---------------------------------------------------------------------------------------------- haut de la tête
def tete(video, debut, n, ff=None):
    """Haut du crâne de Romain (y en px du 1080 x 1920) sur les images [debut, debut + n) de la vidéo coupée : le plus
    haut point du masque Apple Vision (seuil 0,25) entre x 94 et 987, sur toute la fenêtre (règle du labo, geometrie.py)."""
    global FF
    if ff:
        FF = ff
    haut = H
    for fr in frames(video, debut=int(debut), n=int(n), fmt="rgb24"):
        m = masque_vision_brut(fr)[:1400, 94:988] > 0.25
        lignes = np.where(m.any(1))[0]
        if len(lignes):
            haut = min(haut, int(lignes[0]))
    print(json.dumps({"haut_tete": haut, "images": [int(debut), int(debut) + int(n) - 1]}))


def masque_vision_brut(rgb):
    """Masque Vision sans resserrement (pour mesurer)."""
    return masque_vision(rgb, brut=True)


if __name__ == "__main__":
    a = sys.argv[1:]
    if a and a[0] == "analyse":
        zd = int(a[a.index("--zone-des") + 1]) if "--zone-des" in a else 0
        analyse(a[1], a[2], a[3], "--sans-zone" in a, zd)
    elif a and a[0] == "apercu":
        apercu(*a[1:])
    elif a and a[0] == "tete":
        tete(*a[1:])
    else:
        raise SystemExit(__doc__)
