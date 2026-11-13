#!/usr/bin/env python3
"""zooms.py : les zooms d'une vidéo coupée par couper-silences, au style verrouillé de Romain.

Deux gestes (bibliotheque/zooms/, STYLE.md « Zooms »), plus le dézoom d'ouverture de l'accroche :
  eclair        : 115 % en 0,13 s, power2.out, léger flou de mouvement, sur le mot fort, tenu jusqu'à la coupe
  rapprochement : 110 % en 1 s, power2.inOut, tenu jusqu'à la coupe
  ouverture     : la vidéo commence à 120 % et revient à 100 % de l'image 0 jusqu'au mot clé, où elle s'arrête net
                  (règle de Yoan pour l'accroche du niveau travaillé, avec le titre derrière lui qui dézoome pareil :
                  la brique écrit ouverture.json, que l'animation du titre suit image par image)
Point fixe du zoom entre ses yeux (Apple Vision), jamais de son.

  zooms.py texte <dossier>      écrit texte-zooms.md : le texte, chaque mot précédé de son numéro
  zooms.py preparer <dossier>   lit zooms.json, écrit zooms.txt (la couche pour le rendu)
                                et une image de contrôle par zoom dans zooms-apercu/

zooms.txt : un morceau de graphe ffmpeg à poser entre [v] (le plan coupé, 30 i/s, à la définition de l'original)
et [vz] : « [v]<zooms.txt>[vz] ». Sortie à la même définition. Le flou de mouvement y est inclus (obturateur
360 degrés : 10 sous-images moyennées sur chaque image où l'échelle bouge, comme zoom.py de la bibliothèque).

Codes de sortie : 0 ok, 2 fichier introuvable, 13 zooms.json illisible ou refusé.
Dépendances : /usr/bin/python3 (3.9+), Pillow, pyobjc (Quartz, Vision), ffmpeg 7+ dans le PATH ou
/opt/homebrew/bin/ffmpeg.
"""
import json, os, shutil, subprocess, sys, tempfile
from pathlib import Path

FPS_ATTENDU = 30
GESTES = {  # échelle par défaut, durée du geste (s), courbe
    "eclair": (1.15, 0.13, "power2.out"),
    "rapprochement": (1.10, 1.0, "power2.inOut"),
    "ouverture": (1.20, None, "linéaire, arrêt net"),
}
PLAFOND_OUVERTURE = 1.2               # le dézoom d'ouverture part de 120 % au plus (règle de Yoan, 2026-11-11)
ANCIENS = {"sec": "eclair", "progressif": "rapprochement"}  # zooms.json de l'ancienne brique
ECHELLE_MIN = 1.05
PLAFOND_HD, PLAFOND_4K = 1.15, 1.8   # jamais au-delà de 115 % hors 4K ; depuis la 4K, sans perte jusqu'à 1,8x
SOUS_IMAGES = 10                      # obturateur 360 degrés
AIMANT_COUPE = 0.35                   # une fin demandée se cale sur une coupe à moins de ça (s)
TENU_MAX = 4.0                        # sans coupe dans ces 4 s, le zoom finit avec sa phrase
ECART_COUPE_ECLAIR = 0.2              # un éclair à moins de 0,2 s après une coupe = punch-in serré sur la coupe (rejeté)
TENU_MIN = {"eclair": 0.4, "rapprochement": 1.1}  # du début du geste à la coupe, au minimum (s)
ANCRE_DEFAUT = (0.5, 0.35)


def say(m): print(m, flush=True)
def fail(code, m): print(m, flush=True); sys.exit(code)


def ffmpeg():
    p = shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"
    if not Path(p).exists(): fail(2, "OUTIL_VIDEO_INTROUVABLE : ffmpeg n'est pas installé.")
    return p


def lire_json(p):
    return json.loads(Path(p).read_text(encoding="utf-8-sig"))


def mots(w):
    p = w / "words.cut.json"
    if not p.exists():
        fail(2, f"TEXTE_INTROUVABLE : lance d'abord couper-silences sur cette vidéo (il manque words.cut.json dans {w}).")
    return lire_json(p)["words"]


def fin_de_phrase(t): return t.strip()[-1:] in ".!?…"


# ---------------------------------------------------------------- texte
def cmd_texte(w):
    ws = mots(w)
    lignes, cur = [], []
    for i, m in enumerate(ws):
        t = str(m.get("text", "")).strip()
        if not t: continue
        cur.append(f"[{i}]{t}")
        if fin_de_phrase(t): lignes.append(" ".join(cur)); cur = []
    if cur: lignes.append(" ".join(cur))
    out = w / "texte-zooms.md"
    out.write_text("# Texte de la vidéo coupée, chaque mot précédé de son numéro\n\n" + "\n".join(lignes) + "\n", encoding="utf-8")
    say(f"PRÊT texte={out} mots={len(ws)}")


# ---------------------------------------------------------------- courbes (les mêmes que zoom.py)
def eo(p): p = min(1.0, max(0.0, p)); return 1 - (1 - p) ** 2
def eio(p): p = min(1.0, max(0.0, p)); return 2 * p * p if p < 0.5 else 1 - (-2 * p + 2) ** 2 / 2


def echelle_a(z, t):
    """Échelle du zoom z au temps t (s, vidéo coupée)."""
    if z["type"] == "ouverture": return z["s"] - (z["s"] - 1) * min(1.0, max(0.0, t * z["fps"] / z["f1"]))
    if t < z["t0"]: return 1.0
    p = (t - z["t0"]) / z["duree"]
    return 1 + (z["s"] - 1) * (eo(p) if z["type"] == "eclair" else eio(p))


def expr_echelle(z, t_expr):
    """La même échelle en expression ffmpeg (t_expr : temps en s)."""
    p = f"clip(({t_expr}-{z['t0']:.6f})/{z['duree']},0,1)"
    if z["type"] == "eclair": c = f"(1-pow(1-{p},2))"
    else: c = f"if(lt({p},0.5),2*pow({p},2),1-pow(-2*{p}+2,2)/2)"
    return f"(1+{z['s'] - 1:.6f}*{c})"


def premier_in(ff):
    """Valeur de « in » (images reçues par perspective) sur la première image : 1 avec ffmpeg 8, mesurée pour ne
    pas dépendre de la version. Une barre blanche de 20 px, décalée de 4 px par image."""
    r = subprocess.run([ff, "-v", "error", "-f", "lavfi", "-i",
                        "color=c=black:s=200x100:r=30:d=0.1,drawbox=x=0:y=0:w=20:h=100:c=white:t=fill",
                        "-vf", "perspective=x0='in*4':x2='in*4':eval=frame", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "-"],
                       capture_output=True, check=True)
    ligne = r.stdout[50 * 200:51 * 200]
    return round((20 - sum(1 for v in ligne if v > 128)) / 4)


def coins(ax, ay, W, H, s):
    """Les 4 coins (source) du cadre zoomé autour du point fixe (ax, ay) : x0 y0 x1 y1 x2 y2 x3 y3."""
    g, d, h, b = f"({ax:.4f}-{ax:.4f}/{s})", f"({ax:.4f}+{W - ax:.4f}/{s})", f"({ay:.4f}-{ay:.4f}/{s})", f"({ay:.4f}+{H - ay:.4f}/{s})"
    return [g, h, d, h, g, b, d, b]


def perspective(cs, par_image):
    noms = ["x0", "y0", "x1", "y1", "x2", "y2", "x3", "y3"]
    o = ":".join(f"{n}='{v}'" for n, v in zip(noms, cs))
    return f"perspective={o}:interpolation=cubic:sense=source" + (":eval=frame" if par_image else "")


# ---------------------------------------------------------------- visage
def entre_les_yeux(png):
    """Point entre les pupilles, en fraction de l'image (x vers la droite, y vers le bas), ou None."""
    import Quartz, Vision
    from Foundation import NSURL
    src = Quartz.CGImageSourceCreateWithURL(NSURL.fileURLWithPath_(str(png)), None)
    cg = Quartz.CGImageSourceCreateImageAtIndex(src, 0, None)
    req = Vision.VNDetectFaceLandmarksRequest.alloc().init()
    h = Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(cg, {})
    ok, _ = h.performRequests_error_([req], None)
    if not ok or not req.results(): return None
    o = max(req.results(), key=lambda r: r.boundingBox().size.width * r.boundingBox().size.height)
    bb, lm = o.boundingBox(), o.landmarks()
    pts = []
    for reg in (lm.leftPupil(), lm.rightPupil()) if lm else ():
        if reg is not None and reg.pointCount() > 0:
            p = reg.normalizedPoints()[0]
            pts.append((bb.origin.x + p.x * bb.size.width, bb.origin.y + p.y * bb.size.height))
    if len(pts) != 2: return None
    x = (pts[0][0] + pts[1][0]) / 2; y = (pts[0][1] + pts[1][1]) / 2
    return x, 1 - y   # Vision : origine en bas à gauche


def image_source(ff, info, segs, f, sortie):
    """Image f de la vidéo coupée, prise dans l'original."""
    seg = next((s for s in segs if s["outInF"] <= f < s["outOutF"]), segs[-1])
    t = (seg["srcInF"] + min(f, seg["outOutF"] - 1) - seg["outInF"]) / FPS_ATTENDU
    subprocess.run([ff, "-nostdin", "-v", "error", "-y", "-ss", f"{t:.4f}", "-i", str(info["video"]), "-frames:v", "1", str(sortie)], check=True)


# ---------------------------------------------------------------- preparer
def cmd_preparer(w):
    ip = w / "info.json"
    if not ip.exists(): fail(2, f"INFO_INTROUVABLE : lance d'abord couper-silences sur cette vidéo (il manque info.json dans {w}).")
    info = lire_json(ip)
    voisine = w.parent / Path(str(info["video"])).name   # la vidéo à côté du dossier de montage d'abord (dossier copié)
    if voisine.is_file(): info["video"] = str(voisine)
    if not Path(info["video"]).exists(): fail(2, f"VIDÉO_INTROUVABLE : {info['video']} (la vidéo d'origine a été déplacée ?)")
    if not (w / "edl.json").exists(): fail(2, "COUPES_INTROUVABLES : lance d'abord couper-silences (compiler) sur cette vidéo.")
    ws = mots(w)
    fps = FPS_ATTENDU; W, H = int(info["largeur"]), int(info["hauteur"])   # coupes toujours à 30 i/s
    segs = lire_json(w / "edl.json")["segments"]
    total = int(segs[-1]["outOutF"])
    # Les vraies coupes (un saut dans l'original), en images de la vidéo coupée
    coupes = [int(s["outInF"]) for s in segs[1:] if not s.get("contiguous_prev")]
    plafond = PLAFOND_4K if min(W, H) >= 2000 else PLAFOND_HD

    zp = w / "zooms.json"
    if not zp.exists(): fail(2, f"ZOOMS_INTROUVABLES : écris d'abord zooms.json dans {w}.")
    try: liste = [z for z in lire_json(zp).get("zooms", []) if z]
    except Exception as e: fail(13, f"ZOOMS_ILLISIBLE : {e}")

    zooms = []
    for n, z in enumerate(liste, 1):
        typ = z.get("type") or ANCIENS.get(z.get("entree", "sec"))
        if z.get("entree") == "recul" and not z.get("type"):
            fail(13, f"ZOOMS_ILLISIBLE : zoom n°{n}, le recul n'est plus dans le style. Prends un éclair ou un rapprochement.")
        if typ not in GESTES: fail(13, f"ZOOMS_ILLISIBLE : zoom n°{n}, type « {typ} » inconnu (eclair, rapprochement ou ouverture).")
        defaut, duree, _ = GESTES[typ]
        a = z.get("mot", z.get("debut"))
        if a is None: fail(13, f"ZOOMS_ILLISIBLE : zoom n°{n}, il manque « mot » (le numéro du mot où le zoom part, ou où le dézoom d'ouverture s'arrête).")
        if typ == "ouverture":
            a = int(a)
            if not 0 <= a < len(ws): fail(13, f"ZOOMS_ILLISIBLE : zoom n°{n}, mot {a} inexistant (0 à {len(ws) - 1}).")
            s = min(float(z.get("echelle", defaut)), PLAFOND_OUVERTURE)
            if s < ECHELLE_MIN: fail(13, f"ZOOMS_ILLISIBLE : zoom n°{n}, échelle {s} sous {ECHELLE_MIN} (il ne se verrait pas).")
            f1 = round(float(ws[a]["start"]) * fps)
            if f1 < fps: fail(13, f"ZOOMS_ILLISIBLE : zoom n°{n}, le dézoom d'ouverture s'arrêterait avant 1 s (« {ws[a]['text']} ») : prends le mot clé de sa première phrase.")
            phrase = " ".join(str(m["text"]) for m in ws[:a + 1]).strip()
            zooms.append(dict(n=n, type=typ, s=s, duree=f1 / fps, t0=0.0, f0=0, f1=f1, mot=a, cadrage=z.get("cadrage"), phrase=phrase,
                              sans_coupe=False, fps=fps))
            continue
        a = int(a); b = z.get("fin"); b = int(b) if b is not None else None
        if not 0 <= a < len(ws) or (b is not None and not a <= b < len(ws)):
            fail(13, f"ZOOMS_ILLISIBLE : zoom n°{n}, mots {a} à {b} invalides (0 à {len(ws) - 1}, début avant fin).")
        s = float(z.get("echelle", defaut))
        if s < ECHELLE_MIN: fail(13, f"ZOOMS_ILLISIBLE : zoom n°{n}, échelle {s} sous {ECHELLE_MIN} (il ne se verrait pas).")
        if s > plafond + 1e-9:
            say(f"  zoom n°{n} : {round(s * 100)} % demandé, ramené à {round(plafond * 100)} % (plafond pour une vidéo {W}x{H}).")
            s = plafond
        t0 = float(ws[a]["start"]); f0 = int(t0 * fps)
        # Pas d'éclair collé à une coupe : il se lirait comme un punch-in serré sur la coupe (rejeté par Yoan)
        avant = max([0] + [c for c in coupes if c <= f0])
        if typ == "eclair" and t0 - avant / fps < ECART_COUPE_ECLAIR:
            fail(13, f"ZOOMS_ILLISIBLE : zoom n°{n}, « {ws[a]['text']} » tombe juste sur une coupe : l'éclair se lirait comme un punch-in sur la coupe. Prends le mot fort suivant, ou un mot plus loin dans la phrase.")
        apres = [c for c in coupes if c > f0]
        c1 = apres[0] if apres else total
        if c1 / fps - t0 < TENU_MIN[typ]:
            fail(13, f"ZOOMS_ILLISIBLE : zoom n°{n}, une coupe arrive {c1 / fps - t0:.2f} s après « {ws[a]['text']} » : trop tôt pour un {typ} (il faut {TENU_MIN[typ]} s). Prends un mot plus tôt.")
        # Où il finit : toujours à la coupe qui suit (le retour au plan large se lit comme la coupe), jamais au-delà.
        # Seulement si cette coupe est à plus de 4 s : au bout du mot « fin » ou de sa phrase, calé sur une coupe proche.
        sans_coupe = False
        if c1 / fps - t0 <= TENU_MAX:
            f1 = c1
        else:
            if b is None:
                b = a
                while b < len(ws) - 1 and not fin_de_phrase(str(ws[b]["text"])): b += 1
            f1 = round(float(ws[b]["end"]) * fps)
            proche = min(coupes + [total], key=lambda c: abs(c - f1))
            if abs(proche - f1) <= AIMANT_COUPE * fps: f1 = proche
            else: sans_coupe = True
            f1 = min(f1, c1)
        if (f1 - f0) / fps < TENU_MIN[typ]:
            fail(13, f"ZOOMS_ILLISIBLE : zoom n°{n} trop court ({(f1 - f0) / fps:.2f} s) : prends un mot plus tôt ou une fin plus loin.")
        dernier = max([a] + [i for i in range(a, len(ws)) if float(ws[i]["end"]) * fps <= f1 + 1])
        phrase = " ".join(str(m["text"]) for m in ws[a:dernier + 1]).strip()
        zooms.append(dict(n=n, type=typ, s=s, duree=duree, t0=t0, f0=f0, f1=f1, mot=a, cadrage=z.get("cadrage"), phrase=phrase, sans_coupe=sans_coupe, fps=fps))

    zooms.sort(key=lambda z: z["f0"])
    for p, q in zip(zooms, zooms[1:]):
        if q["f0"] < p["f1"]: fail(13, f"ZOOMS_ILLISIBLE : les zooms n°{p['n']} et n°{q['n']} se chevauchent.")

    ff = ffmpeg()
    apercu = w / "zooms-apercu"
    shutil.rmtree(apercu, ignore_errors=True); apercu.mkdir()
    tmp = Path(tempfile.mkdtemp(prefix="zooms-"))
    try:
        # Point fixe : entre ses yeux, médiane sur 3 images du zoom (début, milieu, fin)
        for z in zooms:
            if z["cadrage"]:
                fx, fy = float(z["cadrage"][0]), float(z["cadrage"][1])
                if not (0 <= fx <= 1 and 0 <= fy <= 1): fail(13, f"ZOOMS_ILLISIBLE : zoom n°{z['n']}, cadrage hors de 0 à 1.")
                z["source_ancre"] = "cadrage"
            else:
                vus = []
                for k, f in enumerate((z["f0"], (z["f0"] + z["f1"]) // 2, z["f1"] - 1)):
                    png = tmp / f"v{z['n']}-{k}.png"; image_source(ff, info, segs, f, png)
                    p = entre_les_yeux(png)
                    if p: vus.append(p)
                if vus:
                    fx = sorted(v[0] for v in vus)[len(vus) // 2]; fy = sorted(v[1] for v in vus)[len(vus) // 2]
                    z["source_ancre"] = "yeux"
                else:
                    fx, fy = ANCRE_DEFAUT; z["source_ancre"] = "defaut"
            z["ax"], z["ay"] = fx * W, fy * H

        (w / "zooms.txt").write_text(graphe(zooms, total, fps, W, H, premier_in(ff)), encoding="utf-8")
        # Le dézoom d'ouverture, pour l'animation du titre derrière lui (il dézoome avec la caméra, image par image)
        ov = next((z for z in zooms if z["type"] == "ouverture"), None)
        (w / "ouverture.json").unlink(missing_ok=True)
        if ov:
            (w / "ouverture.json").write_text(json.dumps(dict(
                images=ov["f1"], echelle_depart=ov["s"], mot=ov["mot"],
                ancre_1080x1920=[round(ov["ax"] * 1080 / W, 2), round(ov["ay"] * 1920 / H, 2)],
                regle="échelle à l'image n de la vidéo coupée : echelle_depart - (echelle_depart - 1) * n / images, puis 1 ; "
                      "même point fixe (ancre, en px du calque 1080 x 1920) : le titre derrière lui pose transform-origin sur "
                      "l'ancre et la même échelle à chaque image"), ensure_ascii=False, indent=1), encoding="utf-8")

        # Image de contrôle : à gauche le plan large avec le point fixe, à droite le zoom au plus serré
        from PIL import Image, ImageDraw
        for z in zooms:
            f = 0 if z["type"] == "ouverture" else z["f1"] - 1   # au plus serré
            png = tmp / f"a{z['n']}.png"; image_source(ff, info, segs, f, png)
            img = Image.open(png).convert("RGB")
            s = echelle_a(z, (f + 0.5) / fps); ax, ay = z["ax"], z["ay"]
            box = (ax - ax / s, ay - ay / s, ax + (W - ax) / s, ay + (H - ay) / s)
            zm = img.resize((W, H), Image.LANCZOS, box=box)
            large = img.copy(); d = ImageDraw.Draw(large); r = max(4, W // 90)
            d.ellipse((ax - r, ay - r, ax + r, ay + r), outline=(255, 60, 30), width=max(2, r // 2))
            d.rectangle(box, outline=(255, 60, 30), width=max(2, r // 3))
            planche = Image.new("RGB", (2 * W, H)); planche.paste(large, (0, 0)); planche.paste(zm, (W, 0))
            planche.thumbnail((1080, 1080 * H // (2 * W) + 1)); planche.save(apercu / f"zoom-{z['n']:02d}.jpg", quality=88)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    say(f"PRÊT zooms={len(zooms)} plafond={round(plafond * 100)}% apercu={apercu}")
    for z in zooms:
        ancre = {"yeux": "entre ses yeux", "cadrage": "cadrage demandé", "defaut": "VISAGE INTROUVABLE, point par défaut : vérifie l'aperçu"}[z["source_ancre"]]
        say(f"  n°{z['n']} {z['type']} {round(z['s'] * 100)} % : de {z['t0']:.2f} s à {z['f1'] / fps:.2f} s (images {z['f0']} à {z['f1']}), "
            f"{ancre} ({z['ax']:.0f}, {z['ay']:.0f}) : « {z['phrase']} »"
            + (" [retour au plan large sans coupe : pas de coupe dans les 4 s]" if z["sans_coupe"] else ""))


def graphe(zooms, total, fps, W, H, in0):
    """Le morceau de graphe ffmpeg : [v] + ce texte + [vz]."""
    if not zooms: return "null"
    morceaux = []   # (début, fin, sorte, zoom) en images de la vidéo coupée, fin exclue
    k = 0
    for z in zooms:
        if z["type"] == "ouverture":   # de l'image 0 au mot clé, échelle qui baisse d'un pas égal à chaque image
            morceaux.append((0, z["f1"], "ouverture", z)); k = z["f1"]; continue
        fixe = next(f for f in range(z["f0"], z["f1"] + 1)
                    if f == z["f1"] or abs(echelle_a(z, f / fps) - z["s"]) < 1e-5)   # première image où l'échelle est posée
        if z["f0"] > k: morceaux.append((k, z["f0"], "plat", None))
        if fixe > z["f0"]: morceaux.append((z["f0"], fixe, "mouvement", z))
        if z["f1"] > fixe: morceaux.append((fixe, z["f1"], "tenu", z))
        k = z["f1"]
    if total > k: morceaux.append((k, total, "plat", None))

    chaines = ["split=%d%s" % (len(morceaux), "".join(f"[zs{i}]" for i in range(len(morceaux))))]
    for i, (a, b, sorte, z) in enumerate(morceaux):
        coupe = f"[zs{i}]trim=start_frame={a}:end_frame={b},setpts=PTS-STARTPTS"
        if sorte == "plat":
            chaines.append(f"{coupe}[zp{i}]")
        elif sorte == "tenu":
            chaines.append(f"{coupe},{perspective(coins(z['ax'], z['ay'], W, H, z['s']), False)}[zp{i}]")
        elif sorte == "ouverture":
            ech = f"({z['s']:.6f}-{z['s'] - 1:.6f}*({a - in0}+in)/{b})"
            chaines.append(f"{coupe},{perspective(coins(z['ax'], z['ay'], W, H, ech), True)}[zp{i}]")
        else:
            # Obturateur 360 degrés : l'image n regarde les instants (n + j/10)/30, j = 0..9, moyennés.
            # « in » de perspective compte les images reçues par ce filtre : in0 sur la première du morceau.
            chaines.append(f"{coupe},split={SOUS_IMAGES}" + "".join(f"[zb{i}_{j}]" for j in range(SOUS_IMAGES)))
            for j in range(SOUS_IMAGES):
                t = f"(({a - in0}+in+{j / SOUS_IMAGES})/{fps})"
                cs = coins(z["ax"], z["ay"], W, H, expr_echelle(z, t))
                chaines.append(f"[zb{i}_{j}]{perspective(cs, True)}[zc{i}_{j}]")
            chaines.append("".join(f"[zc{i}_{j}]" for j in range(SOUS_IMAGES)) + f"mix=inputs={SOUS_IMAGES}[zp{i}]")
    # concat, puis instants remis en images exactes (base 1/30) : sans ça, la sortie est en base 1/1000000 avec des
    # instants arrondis sous l'image, et les calques posés ensuite prenaient l'image d'avant (saccade d'une image)
    chaines.append("".join(f"[zp{i}]" for i in range(len(morceaux))) + f"concat=n={len(morceaux)}:v=1:a=0,settb=1/{fps},setpts=N")
    return ";\n".join(chaines)


def main():
    if len(sys.argv) < 3 or sys.argv[1] not in ("texte", "preparer"):
        fail(1, "Usage : zooms.py texte <dossier> | preparer <dossier>")
    w = Path(sys.argv[2]).expanduser().resolve()
    if not w.is_dir(): fail(2, f"DOSSIER_INTROUVABLE : {w}")
    (cmd_texte if sys.argv[1] == "texte" else cmd_preparer)(w)


if __name__ == "__main__":
    main()
