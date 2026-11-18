#!/usr/bin/env python3
"""apercu.py : l'aperçu sans rendu (brique `rendu`). Prépare de quoi jouer le montage dans le studio, image par image,
sans fabriquer la vidéo : c'est sur l'aperçu que la personne valide son montage, et le rendu reste la référence.

Lit le dossier <nom>-montage/ (mêmes fichiers que rendu.py) et écrit <nom>-montage/apercu/ :
  apercu.json            ce que le lecteur du studio joue (format : CONTRAT-STUDIO.md, section 16) ;
  camera-<clé>.mp4       la vidéo coupée légère (720 x 1280, 30 i/s) : coupes, conversion HDR, mise en 9:16 et
                         étalonnage du style, faite une fois (l'image ne change qu'avec les coupes) ; son = la bande
                         son exacte du rendu (voix normalisée et sons de sons.json, même fonction que rendu.py),
                         remise à chaque changement des sons sans réencoder l'image ;
  b-roll-<k>-<clé>.mp4   chaque B-roll déjà coupé, recadré et à sa vitesse, sur ses seules images ;
  masques/<id>-<clé>/    pour chaque calque derrière la personne : son masque par image (PNG 216 x 384, gris + alpha),
                         tiré du masque du rendu (même calcul, gardé dans rendu-cache/ : le rendu le reprend tel quel).
Les zooms, décalages et flous restent des données (joués en CSS) ; les calques HyperFrames sont joués tels quels par le
lecteur (leurs timelines calées sur l'horloge de la vidéo). Rien n'est rendu par HyperFrames, rien n'est livré.

Usage : python3 apercu.py <dossier>-montage [couches]
  couches : par défaut tout ce qui est préparé (comme la planche) ; sinon la liste du rendu (coupes,zooms,...).
Sortie : PRÊT <apercu.json> (...) ; codes : ceux du rendu, plus 8 ZOOMS_A_REFAIRE (zooms.txt sans ses données).
"""
import json, re, shutil, subprocess, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import rendu as R   # noqa: E402  (même dossier : coupes, plan, masques et son viennent du rendu, pas d'une copie)

FPS, BW, BH = R.FPS, R.BASE_W, R.BASE_H
AW, AH = 720, 1280           # vidéo légère
MW, MH = 216, 384            # masques basse définition
CRF, GOP = 23, 10            # une image clé toutes les 10 images : l'image par image reste instantané
VERSION = 1


def dire(m=""):
    print(m, flush=True)


def couches_preparees(w, demande=None):
    if demande:
        d = [c for c in re.split(r"[,; ]+", str(demande).lower()) if c]
        for c in d:
            if c not in R.COUCHES:
                R.echec(2, f"COUCHE_INCONNUE : {c} (couches possibles : {', '.join(R.COUCHES)})")
        return d if "coupes" in d else ["coupes"] + d
    d = ["coupes"] + (["zooms"] if (w / "zooms.txt").exists() else []) + (["b-roll"] if (w / "b-roll.txt").exists() else [])
    if (w / "calques.json").exists():
        srcs = {c.get("source") for c in R.lit_json(w / "calques.json", 3, "CALQUES").get("calques", [])}
        d += [s for s in ("animations", "sous-titres") if s in srcs]
    if (w / "sons.json").exists():
        d.append("sons")
    return d


def remplace(dest, nouveau, motif):
    """Pose `nouveau` (déjà écrit à côté) et retire les anciennes versions du même motif."""
    for vieux in dest.glob(motif):
        if vieux != nouveau:
            shutil.rmtree(vieux) if vieux.is_dir() else vieux.unlink()


def ffmpeg(cmd, quoi, A):
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=A)
    if r.returncode != 0:
        (A / "erreur.log").write_text(" ".join(map(str, cmd)) + "\n\n" + r.stderr)
        R.echec(5, f"APERÇU_RATÉ {quoi} : {r.stderr.strip()[-400:]} (journal : {A / 'erreur.log'})")


# ------------------------------------------------------------------------------------------------ vidéo légère
def image_camera(w, info, video, ff, C, total, A):
    """L'image de la vidéo coupée, légère, faite une fois : coupes (filtre.txt, HDR converti), mise en 1080 x 1920 comme
    le rendu, étalonnage du style, puis 720 x 1280. Sans zoom ni décalage (joués par le lecteur)."""
    cache = A / "cache"; cache.mkdir(parents=True, exist_ok=True)
    filtre = R.filtre_coupes(w, video, ff, cache)
    s = video.stat()
    cle = R.empreinte(filtre, C["ETALONNAGE"], AW, AH, CRF, GOP, str(video), s.st_size, int(s.st_mtime), total, "image-1")
    out = cache / f"image-{cle}.mp4"
    if out.exists():
        return out, cle, False
    W0, H0 = int(info["largeur"]), int(info["hauteur"])
    geo = "" if (W0, H0) == (BW, BH) else f"scale={BW}:{BH}:force_original_aspect_ratio=increase:flags=lanczos,crop={BW}:{BH},setsar=1,"
    lignes = [filtre, "[a]anullsink",
              f"[v]{geo}{C['ETALONNAGE']},scale={AW}:{AH}:flags=lanczos,format=yuv420p,"
              f"setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv[vout]"]
    gp = cache / "image-graphe.txt"; gp.write_text(";\n".join(lignes), encoding="utf-8")
    tmp = cache / f"image-{cle}.partiel.mp4"
    ffmpeg([ff, "-nostdin", "-v", "error", "-y", "-i", str(video), "-/filter_complex", str(gp), "-map", "[vout]",
            "-frames:v", str(total), "-r", str(FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", str(CRF),
            "-g", str(GOP), "-keyint_min", str(GOP), "-sc_threshold", "0", "-profile:v", "high", "-pix_fmt", "yuv420p",
            "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv",
            "-an", "-movflags", "+faststart", str(tmp)], "vidéo coupée", A)
    tmp.rename(out); gp.unlink(missing_ok=True)
    remplace(cache, out, "image-*.mp4")
    return out, cle, True


def camera(w, info, video, ff, C, biblio, total, sons, A):
    """camera-<clé>.mp4 : l'image légère + la bande son exacte du rendu (voix et sons). Le son se refait quand les sons
    changent, l'image jamais (copiée telle quelle)."""
    image, cle_i, neuve = image_camera(w, info, video, ff, C, total, A)
    sj = json.dumps(sons, sort_keys=True, ensure_ascii=False)
    cle = R.empreinte(cle_i, (w / "filtre.txt").read_text(encoding="utf-8-sig"), sj, json.dumps(C["SONS"], sort_keys=True), "son-1")[:12]
    out = A / f"camera-{cle}.mp4"
    if out.exists():
        return out, {}, neuve, False
    cache = A / "cache"
    audio, mesures = R.bande_son(ff, w, info, total, sons, C, biblio, cache)
    tmp = A / f"camera-{cle}.partiel.mp4"
    ffmpeg([ff, "-nostdin", "-v", "error", "-y", "-i", str(image), "-i", str(audio), "-map", "0:v", "-map", "1:a",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ar", str(R.SR), "-movflags", "+faststart", str(tmp)], "son", A)
    audio.unlink(missing_ok=True)
    tmp.rename(out)
    remplace(A, out, "camera-*.mp4")
    return out, mesures, neuve, True


# ------------------------------------------------------------------------------------------------ B-rolls
def brolls_legers(w, W0, H0, ff, A):
    """Chaque B-roll du rendu (b-roll.txt) sur ses seules images, à la vitesse et au cadrage du rendu, en 720 x 1280.
    La chaîne de chaque clip est celle du rendu (lit_brolls : HDR converti, recadré en 1080 x 1920), prise telle quelle
    jusqu'à sa dernière étape, qui la pose sur la vidéo (setpts=N+<début>) : remise à 0 ici."""
    cache = A / "cache"; cache.mkdir(parents=True, exist_ok=True)
    b = R.lit_brolls(w, W0, H0, BW, BH, ff, cache)
    morceaux = [m.strip() for m in b["filtre"].split(";") if m.strip()]
    e = b["entrees"]
    clips, gardes = [], set()
    for k in range(1, len(e) // 6 + 1):
        chaine = next((m for m in morceaux if m.startswith(f"[{k}:v]")), None)
        pose = next((m for m in morceaux if re.search(rf"\]\[bc{k}\]overlay", m)), None)
        if not chaine or not pose:
            R.echec(3, f"B-ROLL_ILLISIBLE : clip n°{k} introuvable dans b-roll.txt.")
        m = re.search(r"between\(n,(\d+),(\d+)\)", pose)
        if not m:
            R.echec(3, f"B-ROLL_ILLISIBLE : clip n°{k}, images du passage introuvables dans b-roll.txt.")
        a, z = int(m.group(1)), int(m.group(2))
        corps = re.sub(r"\[[^\]]+\]$", "", chaine[len(f"[{k}:v]"):])
        corps = re.sub(r"setpts=N\+\d+$", "setpts=N", corps)
        ent = e[(k - 1) * 6:(k - 1) * 6 + 6]
        cle = R.empreinte(corps, *ent, Path(ent[5]).stat().st_size if Path(ent[5]).exists() else 0, AW, AH, "broll-1")[:12]
        out = A / f"b-roll-{k}-{cle}.mp4"
        gardes.add(out)
        if not out.exists():
            gp = cache / f"b-roll-{k}-graphe.txt"
            gp.write_text(f"[0:v]{corps},scale={AW}:{AH}:flags=lanczos,format=yuv420p[bv]", encoding="utf-8")
            tmp = A / f"b-roll-{k}-{cle}.partiel.mp4"
            ffmpeg([ff, "-nostdin", "-v", "error", "-y", *ent, "-/filter_complex", str(gp), "-map", "[bv]",
                    "-frames:v", str(z - a + 1), "-r", str(FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", str(CRF),
                    "-g", str(GOP), "-keyint_min", str(GOP), "-sc_threshold", "0", "-pix_fmt", "yuv420p",
                    "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv",
                    "-an", "-movflags", "+faststart", str(tmp)], f"B-roll {k}", A)
            tmp.rename(out); gp.unlink(missing_ok=True)
        clips.append(dict(fichier=f"apercu/{out.name}", debut=a, images=z - a + 1))
    for vieux in A.glob("b-roll-*.mp4"):
        if vieux not in gardes:
            vieux.unlink()
    return clips


# ------------------------------------------------------------------------------------------------ masques
def masques_legers(c, mkv, ff, A):
    """Le masque du rendu (mkv gris 1080 x 1920, une image par image du calque) en PNG 216 x 384 gris + alpha, avec le
    resserrement du rendu : trou du calque (SERRE_TROU), ou détouré (lissage sur 3 images, SERRE_DETOURE, bord adouci
    et rogné d'un px). Sans la décontamination du bord du détouré (contour un peu plus doux dans l'aperçu)."""
    cle = R.empreinte(mkv.name, c["detoure"], MW, MH, "masque-1")[:12]
    out = A / "masques" / f"{c['id']}-{cle}"
    if (out / f"{c['images'] - 1:04d}.png").exists():
        return out
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_name(out.name + ".tmp"); shutil.rmtree(tmp, ignore_errors=True); tmp.mkdir()
    if c["detoure"]:
        serre = f"tmix=frames=3:weights='1 2 1',{R.lut_serre(R.SERRE_DETOURE)},gblur=sigma=0.8,erosion"
    else:
        serre = R.lut_serre(R.SERRE_TROU)
    graphe = (f"[0:v]settb=1/{FPS},setpts=N,format=gray,{serre},scale={MW}:{MH}:flags=bilinear,format=gray,split[m1][m2];"
              f"[m1]lut=c0=255[blanc];[blanc][m2]alphamerge,format=ya8[o]")
    ffmpeg([ff, "-nostdin", "-v", "error", "-y", "-i", str(mkv), "-filter_complex", graphe, "-map", "[o]",
            "-frames:v", str(c["images"]), "-start_number", "0", str(tmp / "%04d.png")], f"masque {c['id']}", A)
    n = len(list(tmp.glob("*.png")))
    if n != c["images"]:
        shutil.rmtree(tmp, ignore_errors=True)
        R.echec(5, f"APERÇU_RATÉ masque {c['id']} : {n} images pour {c['images']}.")
    shutil.rmtree(out, ignore_errors=True)
    tmp.rename(out)
    for vieux in out.parent.iterdir():
        if vieux != out and vieux.name.rsplit("-", 1)[0] == c["id"]:
            shutil.rmtree(vieux, ignore_errors=True)
    return out


# ------------------------------------------------------------------------------------------------ zooms
def zooms_lus(w, W0, H0):
    """Les zooms en données (zooms-donnees.json de la brique zooms), ancre ramenée dans l'image 9:16 de sortie (mise à
    1080 x 1920 du rendu : agrandie pour couvrir, puis recadrée au centre ; zoomer puis recadrer revient à recadrer puis
    zoomer autour de l'ancre recadrée)."""
    txt = R.chaine_zooms(w)
    if txt == "null":
        return []
    import hashlib
    p = w / "zooms-donnees.json"
    d = R.lit_json(p, 3, "ZOOMS") if p.exists() else None
    if not d or d.get("zooms_txt") != hashlib.sha1((w / "zooms.txt").read_text(encoding="utf-8").encode()).hexdigest()[:16]:
        R.echec(8, "ZOOMS_A_REFAIRE : zooms.txt n'a pas ses données pour l'aperçu (préparé avant le 2026-11-18 ou modifié "
                   "à la main) : relance la brique zooms (preparer), sans rien changer à zooms.json.")
    k = max(BW / W0, BH / H0)
    ox, oy = (W0 * k - BW) / 2, (H0 * k - BH) / 2
    r = []
    for z in d["zooms"]:
        ax, ay = z["ancre"]
        r.append(dict(type=z["type"], echelle=z["echelle"], ancre=[round((ax * W0 * k - ox) / BW, 6), round((ay * H0 * k - oy) / BH, 6)],
                      t0=z["t0"], duree=z["duree"], f0=z["f0"], f1=z["f1"], fixe=z["fixe"], courbe=z["courbe"]))
    return r


# ------------------------------------------------------------------------------------------------ main
def main():
    if len(sys.argv) < 2:
        R.echec(2, "Usage : apercu.py <dossier>-montage [couches]")
    t_debut = time.time()
    w = Path(sys.argv[1]).expanduser().resolve()
    if not (w / "info.json").exists() or not (w / "filtre.txt").exists() or not (w / "edl.json").exists():
        R.echec(2, f"DOSSIER_INCONNU : {w} n'est pas un dossier de montage coupé (lance d'abord couper-silences).")
    info = R.lit_json(w / "info.json", 3, "INFO")
    video = R.video_de(w, info)
    if not video.exists():
        R.echec(2, f"VIDÉO_INTROUVABLE : {info.get('video')}")
    if not re.search(rf"fps={FPS}\b", (w / "filtre.txt").read_text(encoding="utf-8-sig").split(";")[0]):
        R.echec(2, "COUCHE_MANQUANTE coupes : filtre.txt n'est pas à 30 images/s ; relance la compilation des coupes.")
    ff, node, biblio = R.trouve_ffmpeg(), R.trouve_node(), R.bibliotheque()
    C = R.constantes(node, biblio)
    total = int(R.lit_json(w / "edl.json", 3, "COUPES")["segments"][-1]["outOutF"])
    W0, H0 = int(info["largeur"]), int(info["hauteur"])
    couches = couches_preparees(w, sys.argv[2] if len(sys.argv) > 2 else None)
    A = w / "apercu"; A.mkdir(exist_ok=True)
    (A / "erreur.log").unlink(missing_ok=True)
    dire(f"Aperçu ({total} images, {total / FPS:.1f} s), couches : {', '.join(c for c in R.COUCHES if c in couches)}")

    zooms = zooms_lus(w, W0, H0) if "zooms" in couches else []
    if "zooms" in couches and not (w / "zooms.txt").exists():
        R.echec(2, "COUCHE_MANQUANTE zooms : lance d'abord la brique zooms (preparer).")
    sources = [s for s in ("animations", "sous-titres") if s in couches]
    calques = R.calques_demandes(w, sources, total) if sources else []
    sons = []
    if "sons" in couches:
        if not (w / "sons.json").exists():
            R.echec(2, "COUCHE_MANQUANTE sons : lance d'abord la brique sound-design (sons.json).")
        sons = R.lit_json(w / "sons.json", 3, "SONS").get("sons") or []

    t0 = time.time()
    cam, mesures, image_neuve, son_neuf = camera(w, info, video, ff, C, biblio, total, sons, A)
    dire(f"  vidéo coupée légère : {'faite' if image_neuve else 'déjà prête'}, son {'refait' if son_neuf else 'déjà prêt'} "
         f"en {time.time() - t0:.0f} s")

    clips = []
    if "b-roll" in couches:
        if not (w / "b-roll.txt").exists():
            R.echec(2, "COUCHE_MANQUANTE b-roll : lance d'abord la brique b-roll (preparer).")
        t0 = time.time(); clips = brolls_legers(w, W0, H0, ff, A)
        dire(f"  B-rolls : {len(clips)} en {time.time() - t0:.0f} s")
    else:
        for vieux in A.glob("b-roll-*.mp4"):
            vieux.unlink()

    t0 = time.time()
    rcache = w / "rendu-cache"; rcache.mkdir(exist_ok=True)
    zooms_txt = R.chaine_zooms(w) if "zooms" in couches else None
    geo = [c for c in calques if c["decalage"]]
    sortie_calques, gardes = [], set()
    for c in calques:
        entree = dict(id=c["id"], source=c["source"], couche=c["couche"], ordre=c["ordre"], debut=c["debut"],
                      images=c["images"], dossier=str(c["dossier"].relative_to(w)) if c["dossier"].is_relative_to(w) else str(c["dossier"]),
                      version=R.empreinte_dossier(c["dossier"]), detoure=c["detoure"], masque=None)
        if c["couche"] == "derriere":
            mkv = R.calcule_masques(c, ff, w, info, BW, BH, zooms_txt, geo, rcache)
            m = masques_legers(c, mkv, ff, A)
            gardes.add(m)
            entree["masque"] = dict(dossier=f"apercu/masques/{m.name}", largeur=MW, hauteur=MH)
        sortie_calques.append(entree)
    if (A / "masques").exists():
        for vieux in (A / "masques").iterdir():
            if vieux not in gardes:
                shutil.rmtree(vieux, ignore_errors=True)
    if any(c["couche"] == "derriere" for c in calques):
        dire(f"  masques : {sum(c['couche'] == 'derriere' for c in calques)} calque(s) derrière en {time.time() - t0:.0f} s")

    decalages = [dict(debut=c["debut"], valeurs=[round(v, 2) for v in c["decalage"]]) for c in calques if c["decalage"]]
    flous = [dict(debut=c["debut"] + c["flou"]["debut"], fin=c["debut"] + c["flou"]["fin"], rayon=c["flou"]["rayon"],
                  assombrir=c["flou"]["assombrir"]) for c in calques if c["flou"]]
    d = dict(version=VERSION, fps=FPS, images=total, largeur=BW, hauteur=BH,
             couches=[c for c in R.COUCHES if c in couches],
             camera=dict(fichier=f"apercu/{cam.name}", largeur=AW, hauteur=AH),
             zooms=zooms, decalages=decalages, flous=flous, brolls=clips, calques=sortie_calques,
             sons=len(sons), voix_lufs=mesures.get("voix_lufs_mono"),
             detoure=any(c["detoure"] for c in calques), derriere=any(c["couche"] == "derriere" for c in calques),
             fait_le=time.strftime("%Y-%m-%dT%H:%M:%S%z"))
    tmp = A / "apercu.json.tmp"
    tmp.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.rename(A / "apercu.json")
    dire(f"PRÊT {A / 'apercu.json'} ({len(sortie_calques)} calques, {len(clips)} B-rolls, {len(sons)} sons, "
         f"en {time.time() - t_debut:.0f} s)")


if __name__ == "__main__":
    R._garder_les_enfants()
    main()
