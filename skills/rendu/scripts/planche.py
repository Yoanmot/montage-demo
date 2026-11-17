#!/usr/bin/env python3
"""planche.py : la planche de validation (brique `rendu`). Avant de fabriquer la vidéo, montre à Romain 8 à 12 vraies
images de SA vidéo montée, chacune au moment d'un élément du plan, composées comme le fera le rendu, sans fabriquer la
vidéo entière.

Lit le dossier <nom>-montage/ (mêmes fichiers que rendu.py) et la demande du monteur, <nom>-montage/planche.json :
  { "vignettes": [ { "calque": "a09", "ligne": "..." }, { "image": 600, "ligne": "...", "mots": "..."? }, ... ],
    "couches": "coupes,zooms,b-roll,animations,sous-titres"? }
Pour chaque vignette (image n de la vidéo coupée) :
  - le plan caméra exact de rendu.py (coupes, zooms, définition, décalage, étalonnage, flou), et le B-roll s'il couvre
    l'image : un seul passage ffmpeg sur la vidéo coupée, qui ne sort que les images voulues (aucun encodage vidéo) ;
  - chaque calque actif à cette image (animations, sous-titres), pris à cette seule image par `hyperframes snapshot`
    deux fois (fond blanc, fond noir) pour en retrouver la transparence ;
  - les calques `derriere` troués par le masque Apple Vision de Romain sur cette image (même masque que rendu.py) ;
  - posés dans l'ordre du contrat (derrière, B-roll, devant, sous-titres en dernier).
Sorties dans <nom>-montage/planche/ : vignettes/NN.jpg, planche.png (la planche en une image), planche.html (la même,
lisible sur Mac et téléphone, images intégrées), trace.json. Les images déjà faites et toujours à jour sont reprises
(cache par empreinte) : après une correction, seules les vignettes touchées sont refaites.

Usage : python3 planche.py <dossier>-montage
Codes : 0 ok · 2 fichier ou couche manquante · 3 planche.json illisible · 4 calque impossible à prendre · 5 raté · 7 outil
"""
import base64, io, json, math, re, shutil, subprocess, sys, tempfile, time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import rendu as R   # noqa: E402  (même dossier : le plan caméra et les masques viennent du rendu, pas d'une copie)

FPS, BW, BH = R.FPS, R.BASE_W, R.BASE_H
DECALAGE_DEFAUT = 15      # images après le dernier élément calé d'un calque : son apparition est finie (0,5 s)
MAX_CONSEILLE = 12
TRAVAUX = 4               # prises d'images HyperFrames en parallèle (un Chrome chacune)


def dire(m=""):
    print(m, flush=True)


# ------------------------------------------------------------------------------------------------ demande
def lit_demande(w, calques, total):
    p = w / "planche.json"
    if not p.exists():
        R.echec(2, "PLANCHE_ILLISIBLE : planche.json absent (le monteur l'écrit : une vignette par moment du plan).")
    d = R.lit_json(p, 3, "PLANCHE")
    v = d.get("vignettes") if isinstance(d, dict) else None
    if not isinstance(v, list) or not v:
        R.echec(3, "PLANCHE_ILLISIBLE : planche.json doit contenir une liste « vignettes » non vide.")
    par_id = {c["id"]: c for c in calques}
    mots = R.lit_json(w / "words.cut.json", 3, "COUPES")["words"]
    sortie = []
    for i, x in enumerate(v):
        if not isinstance(x, dict):
            R.echec(3, f"PLANCHE_ILLISIBLE : vignette n°{i + 1} : un objet {{ \"image\" | \"calque\" | \"mot\", \"ligne\" }}.")
        if "image" in x:
            n = x["image"]
        elif "calque" in x:
            c = par_id.get(x["calque"])
            if not c:
                R.echec(3, f"CALQUE_INCONNU : vignette n°{i + 1}, « {x['calque']} » n'est pas un calque posé (calques.json).")
            n = image_du_calque(w, c)
        elif "mot" in x:
            k = int(x["mot"])
            if not 0 <= k < len(mots):
                R.echec(3, f"PLANCHE_ILLISIBLE : vignette n°{i + 1}, mot {k} inexistant (0 à {len(mots) - 1}).")
            n = round(mots[k]["start"] * FPS) + DECALAGE_DEFAUT
        else:
            R.echec(3, f"PLANCHE_ILLISIBLE : vignette n°{i + 1} : il faut « image », « calque » ou « mot ».")
        if not isinstance(n, int) or not 0 <= n < total:
            R.echec(3, f"IMAGE_HORS_VIDEO : vignette n°{i + 1}, image {n} (la vidéo coupée va de 0 à {total - 1}).")
        sortie.append(dict(image=n, ligne=str(x.get("ligne", "")).strip(), mots=x.get("mots"), demande=x))
    sortie.sort(key=lambda s: s["image"])
    if len(sortie) > MAX_CONSEILLE:
        dire(f"  attention : {len(sortie)} vignettes, {MAX_CONSEILLE} au plus conseillées (regroupe des moments).")
    couches = d.get("couches")
    return sortie, couches


def image_du_calque(w, c):
    """Image où l'élément est entièrement affiché : DECALAGE_DEFAUT images après le dernier élément calé (attendus de
    calque.json), sans dépasser la fin du calque (3 images avant sa sortie) ; sans élément calé, le milieu du calque."""
    a, b = c["debut"], c["debut"] + c["images"]
    cj = c["dossier"] / "calque.json"
    att = []
    if cj.exists():
        try:
            att = json.loads(cj.read_text(encoding="utf-8")).get("attendus") or []
        except Exception:
            att = []
    imgs = [int(x.get("mot_image", a + int(x.get("image", 0)))) for x in att if isinstance(x, dict)]
    n = max(imgs) + DECALAGE_DEFAUT if imgs else (a + b) // 2
    return max(a, min(n, b - 3))


def texte_dit(w, n):
    """Ce qu'il dit à l'image n : la phrase en cours (orthographe des sous-titres), 12 mots au plus autour du mot."""
    mots = R.lit_json(w / "words.cut.json", 3, "COUPES")["words"]
    corr = {}
    if (w / "sous-titres.json").exists():
        corr = {int(k): v for k, v in (R.lit_json(w / "sous-titres.json", 3, "SOUS-TITRES").get("corrections") or {}).items()}
    t = n / FPS
    k = max([i for i, m in enumerate(mots) if m["start"] <= t + 0.02] or [0])
    fin = lambda i: re.search(r"[.?!…]$", mots[i]["text"].strip()) is not None
    d = k
    while d > 0 and not fin(d - 1):
        d -= 1
    f = k
    while f < len(mots) - 1 and not fin(f):
        f += 1
    if f - d + 1 > 12:
        d2 = max(d, min(k - 6, f - 11)); f2 = min(f, d2 + 11)
    else:
        d2, f2 = d, f
    txt = " ".join(t for t in (corr.get(i, mots[i]["text"]) for i in range(d2, f2 + 1)) if t and not re.fullmatch(r"[?:!«»\"]", t))
    return ("… " if d2 > d else "") + txt + (" …" if f2 < f else "")


# ------------------------------------------------------------------------------------------------ calques à une image
def prend_calque(c, locales, dest, journal):
    """Prend les images `locales` du calque c (images du calque) en RGBA : deux `hyperframes snapshot`, fond blanc et
    fond noir, puis transparence retrouvée par la différence (alpha = 1 - (blanc - noir) / 255)."""
    import numpy as np
    from PIL import Image
    # snapshot arrondit --at à la ms : arrondi vers le haut, sinon un instant posé pile sur l'image k (k/30 s) tombe
    # 0,3 ms trop tôt et l'image montre l'état d'avant (vu sur les pages des journaux, qui changent toutes les 3 images)
    temps = ",".join(f"{math.ceil(k * 1000 / FPS) / 1000:.3f}" for k in locales)
    res = {}
    with tempfile.TemporaryDirectory(prefix="planche-") as tmp:
        for fond in ("blanc", "noir"):
            d = Path(tmp) / fond
            shutil.copytree(c["dossier"], d)
            h = (d / "index.html").read_text(encoding="utf-8")
            css = f"<style>html{{background:{'#fff' if fond == 'blanc' else '#000'} !important}}</style>"
            h = h.replace("<head>", "<head>" + css, 1) if "<head>" in h else css + h
            (d / "index.html").write_text(h, encoding="utf-8")
            r = subprocess.run(["npx", "--yes", R.HYPERFRAMES, "snapshot", ".", "--at", temps, "--no-end",
                                "--describe", "false", "-o", str(Path(tmp) / f"s-{fond}")], cwd=d, capture_output=True, text=True)
            pngs = sorted((Path(tmp) / f"s-{fond}").glob("frame-*-at-*.png"))
            if r.returncode != 0 or len(pngs) != len(locales):
                journal.write_text(r.stdout + "\n" + r.stderr)
                return f"APERÇU_RATÉ {c['id']} : HyperFrames n'a pas pu prendre ses images (journal : {journal})."
            res[fond] = pngs
        for k, pb, pn in zip(locales, res["blanc"], res["noir"]):
            W = np.asarray(Image.open(pb).convert("RGB")).astype(np.float32)
            B = np.asarray(Image.open(pn).convert("RGB")).astype(np.float32)
            a = np.clip(1 - (W - B).mean(axis=2) / 255, 0, 1)
            col = np.where(a[..., None] > 1 / 255, B / np.maximum(a[..., None], 1e-6), 0)
            rgba = np.dstack([np.clip(col, 0, 255), a * 255]).round().astype(np.uint8)
            Image.fromarray(rgba).save(dest / f"{k:06d}.png")
    return None


# ------------------------------------------------------------------------------------------------ plan caméra
def images_camera(ff, w, info, OW, OH, zooms, brolls, calques, C, voulues, dest):
    """Un passage ffmpeg sur la vidéo coupée avec le graphe du rendu (plan_camera, puis B-rolls) : ne sort que les
    images voulues, en PNG 1080 x 1920 : <n>-plan.png (étalonné, B-roll compris) et <n>-brut.png (non étalonné, pour
    le masque de Romain)."""
    geo = [c for c in calques if c["decalage"]]
    video = R.video_de(w, info)
    lignes = [R.filtre_coupes(w, video, R.trouve_ffmpeg() if ff is None else ff, dest), "[a]anullsink"]
    cur = R.plan_camera(lignes, info, OW, OH, zooms, geo, calques, C, w, brut="brut")
    entrees = ["-i", str(video)]
    if brolls:
        entrees += brolls["entrees"]
        lignes.append(brolls["filtre"].replace("[ENTREE]", f"[{cur}]").replace("[SORTIE]", "[br]")); cur = "br"
    sel = "+".join(f"eq(n\\,{n})" for n in voulues)
    ech = f",scale={BW}:{BH}:flags=lanczos" if (OW, OH) != (BW, BH) else ""
    lignes.append(f"[{cur}]select='{sel}'{ech},format=rgb24[po]")
    lignes.append(f"[brut]select='{sel}',scale={BW}:{BH}:flags=bicubic,format=rgb24[bo]")
    gp = dest / "graphe.txt"
    gp.write_text(";\n".join(lignes), encoding="utf-8")
    tmp = dest / "tmp"; shutil.rmtree(tmp, ignore_errors=True); tmp.mkdir()
    r = subprocess.run([R.trouve_ffmpeg() if ff is None else ff, "-nostdin", "-v", "error", "-y", *entrees,
                        "-/filter_complex", str(gp), "-map", "[po]", "-fps_mode", "passthrough", str(tmp / "p%04d.png"),
                        "-map", "[bo]", "-fps_mode", "passthrough", str(tmp / "b%04d.png")], cwd=w, capture_output=True, text=True)
    p = sorted(tmp.glob("p*.png")); b = sorted(tmp.glob("b*.png"))
    if r.returncode != 0 or len(p) != len(voulues) or len(b) != len(voulues):
        (dest / "erreur.log").write_text(r.stderr)
        R.echec(5, f"PLANCHE_RATÉE : plan caméra, {len(p)} images sorties pour {len(voulues)} (journal : {dest / 'erreur.log'}).")
    sorties = {}
    for n, fp, fb in zip(voulues, p, b):
        sorties[n] = (fp, fb)
    return sorties


# ------------------------------------------------------------------------------------------------ composition
def compose(plan, brut, actifs, couvre_broll, vision):
    """Ordre du contrat : calques derrière (troués par le masque, ou fond complet sous Romain détouré), B-roll qui
    couvre tout, calques devant par ordre, sous-titres en dernier. En RGB flottant (le rendu pose en yuv 4:4:4 :
    écart de quelques niveaux, invisible sur une vignette)."""
    import numpy as np
    from PIL import Image
    over = lambda dst, rgba: dst * (1 - rgba[..., 3:] / 255) + rgba[..., :3] * (rgba[..., 3:] / 255)
    def serre(m, s):
        lo, hi = round(s[0] * 255), round(s[1] * 255)
        t = np.clip((m - lo) / (hi - lo), 0, 1)
        return t * t * (3 - 2 * t)
    cam = np.asarray(Image.open(plan).convert("RGB")).astype(np.float32)
    out = cam.copy()
    masque = None
    if not couvre_broll:
        for c, img in sorted(((c, i) for c, i in actifs if c["couche"] == "derriere"), key=lambda x: x[0]["ordre"]):
            if masque is None:
                masque = vision(brut)
            q = np.asarray(Image.open(img).convert("RGBA")).astype(np.float32)
            if c["detoure"]:
                ar = serre(masque, R.SERRE_DETOURE)[..., None]
                fond = over(out, q)
                out = fond * (1 - ar) + cam * ar
            else:
                q[..., 3] *= 1 - serre(masque, R.SERRE_TROU)
                out = over(out, q)
    devant = sorted(((c, i) for c, i in actifs if c["couche"] == "devant"),
                    key=lambda x: (x[0]["source"] == "sous-titres", x[0]["ordre"]))
    for c, img in devant:
        out = over(out, np.asarray(Image.open(img).convert("RGBA")).astype(np.float32))
    return Image.fromarray(np.clip(comme_le_lecteur(out), 0, 255).round().astype(np.uint8))


def comme_le_lecteur(rgb):
    """Couleurs telles qu'un lecteur affiche la vidéo finale. Le rendu passe image et calques en yuv avec la matrice
    par défaut de ffmpeg (bt601) puis marque la vidéo bt709 : le lecteur la relit en bt709 (l'orange du style
    #F15A24 s'y voit (252, 100, 30)). On refait ce trajet sur la vignette composée."""
    import numpy as np
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    y = 0.299 * r + 0.587 * g + 0.114 * b
    pb, pr = (b - y) / 1.772, (r - y) / 1.402
    r2, b2 = y + 1.5748 * pr, y + 1.8556 * pb
    g2 = (y - 0.2126 * r2 - 0.0722 * b2) / 0.7152
    return np.stack([r2, g2, b2], axis=-1)


# ------------------------------------------------------------------------------------------------ planche
def minutage(n):
    s = n // FPS
    return f"{s // 60}:{s % 60:02d}"


def polices(biblio, C=None):
    from PIL import ImageFont
    # police unique de la vidéo (POLICES.sousTitres, celle du style du client s'il en a un)
    f = R.fichier_style(C, biblio, "fonts", C["POLICES"]["sousTitres"]["file"]) if C and C.get("STYLE", {}).get("dossier") \
        else biblio / "fonts" / "Inter-Black.ttf"
    def p(taille, poids):
        x = ImageFont.truetype(str(f), taille)
        try:
            x.set_variation_by_axes([min(96, max(12, taille)), poids, 100])
        except Exception:
            pass
        return x
    return p


def coupe_lignes(draw, texte, police, largeur, max_lignes):
    mots, lignes, cur = texte.split(), [], ""
    for m in mots:
        essai = (cur + " " + m).strip()
        if draw.textlength(essai, font=police) <= largeur or not cur:
            cur = essai
        else:
            lignes.append(cur); cur = m
    if cur:
        lignes.append(cur)
    if len(lignes) > max_lignes:
        lignes = lignes[:max_lignes]; lignes[-1] = lignes[-1].rstrip(" .,") + " …"
    return lignes


def planche_png(vignettes, titre, biblio, out, C=None):
    from PIL import Image, ImageDraw
    COL, TW, G = 4, 420, 36
    TH = TW * 16 // 9
    P = polices(biblio, C)
    f_titre, f_aide, f_num, f_temps, f_mots, f_ligne = P(56, 800), P(30, 500), P(44, 800), P(30, 700), P(27, 600), P(27, 450)
    mesure = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    blocs = []
    for v in vignettes:
        lm = coupe_lignes(mesure, f"« {v['texte']} »", f_mots, TW, 3)
        ll = coupe_lignes(mesure, v["ligne"], f_ligne, TW, 4) if v["ligne"] else []
        blocs.append((lm, ll))
    hb = max(48 + 38 * len(lm) + 14 + 36 * len(ll) for lm, ll in blocs) + 16
    rangs = (len(vignettes) + COL - 1) // COL
    W = COL * TW + (COL + 1) * G
    lt = coupe_lignes(mesure, titre, f_titre, W - 2 * G, 3)   # un titre long passe à la ligne, jamais coupé au bord
    H0 = 190 + 68 * (len(lt) - 1)
    H = H0 + rangs * (TH + hb + G) + G // 2
    CH, CR, OR = (26, 22, 18), (246, 240, 231), (241, 90, 36)
    im = Image.new("RGB", (W, H), CH); d = ImageDraw.Draw(im)
    for k, l in enumerate(lt):
        d.text((G, 44 + 68 * k), l, font=f_titre, fill=CR)
    d.text((G, 118 + 68 * (len(lt) - 1)), "Réponds « ok », ou par numéro : « enlève le 4 », « le 6 plutôt en orange ».", font=f_aide, fill=(200, 192, 180))
    for i, (v, (lm, ll)) in enumerate(zip(vignettes, blocs)):
        x = G + (i % COL) * (TW + G); y = H0 + (i // COL) * (TH + hb + G)
        im.paste(Image.open(v["fichier"]).convert("RGB").resize((TW, TH), Image.LANCZOS), (x, y))
        r = 34
        d.ellipse((x + 14, y + 14, x + 14 + 2 * r, y + 14 + 2 * r), fill=OR)
        d.text((x + 14 + r, y + 14 + r), str(v["numero"]), font=f_num, fill=CH, anchor="mm")
        yy = y + TH + 14
        d.text((x, yy), v["minutage"], font=f_temps, fill=OR); yy += 48
        for l in lm:
            d.text((x, yy), l, font=f_mots, fill=CR); yy += 38
        yy += 14
        for l in ll:
            d.text((x, yy), l, font=f_ligne, fill=(200, 192, 180)); yy += 36
    # Écrit à côté puis renommé : le studio n'affiche jamais une planche à moitié écrite.
    tmp = out.with_name(out.stem + ".ecriture.png")
    im.save(tmp, optimize=True)
    tmp.replace(out)


def planche_html(vignettes, titre, out):
    from PIL import Image
    esc = lambda s: (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    cartes = []
    for v in vignettes:
        b = io.BytesIO()
        Image.open(v["fichier"]).convert("RGB").resize((540, 960), Image.LANCZOS).save(b, "JPEG", quality=82)
        src = "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()
        cartes.append(f"""<figure><div class="img"><img src="{src}" alt="moment {v['numero']}"><span class="num">{v['numero']}</span></div>
<figcaption><p class="t">{v['minutage']}</p><p class="m">« {esc(v['texte'])} »</p><p class="l">{esc(v['ligne'])}</p></figcaption></figure>""")
    out.write_text(f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(titre)}</title><style>
:root{{--fond:#1A1612;--texte:#F6F0E7;--doux:#C8C0B4;--orange:#F15A24}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--fond);color:var(--texte);font:17px/1.4 -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;padding:24px 16px 48px}}
header{{max-width:1500px;margin:0 auto 24px}}h1{{font-size:clamp(24px,4vw,36px);margin:0 0 8px;line-height:1.15}}header p{{margin:0;color:var(--doux)}}
main{{max-width:1500px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:28px 20px}}
figure{{margin:0}}.img{{position:relative;aspect-ratio:9/16;border-radius:10px;overflow:hidden;background:#000}}
.img img{{width:100%;height:100%;object-fit:cover;display:block}}
.num{{position:absolute;top:10px;left:10px;width:52px;height:52px;border-radius:50%;background:var(--orange);color:var(--fond);font-weight:800;font-size:28px;display:flex;align-items:center;justify-content:center}}
figcaption p{{margin:8px 0 0}}.t{{color:var(--orange);font-weight:700}}.m{{font-weight:600}}.l{{color:var(--doux)}}
</style></head><body><header><h1>{esc(titre)}</h1><p>Réponds « ok », ou par numéro : « enlève le 4 », « le 6 plutôt en orange ».</p></header>
<main>{''.join(cartes)}</main></body></html>""", encoding="utf-8")


# ------------------------------------------------------------------------------------------------ main
def main():
    if len(sys.argv) < 2:
        R.echec(2, "Usage : planche.py <dossier>-montage")
    t_debut = time.time()
    w = Path(sys.argv[1]).expanduser().resolve()
    if not (w / "info.json").exists() or not (w / "filtre.txt").exists() or not (w / "edl.json").exists():
        R.echec(2, f"DOSSIER_INCONNU : {w} n'est pas un dossier de montage coupé (lance d'abord couper-silences).")
    info = R.lit_json(w / "info.json", 3, "INFO")
    if not R.video_de(w, info).exists():
        R.echec(2, f"VIDÉO_INTROUVABLE : {info.get('video')}")
    ff, node, biblio = R.trouve_ffmpeg(), R.trouve_node(), R.bibliotheque()
    C = R.constantes(node, biblio)
    total = int(R.lit_json(w / "edl.json", 3, "COUPES")["segments"][-1]["outOutF"])
    W0, H0 = int(info["largeur"]), int(info["hauteur"])
    OW, OH = BW, BH   # comme le rendu : toujours 1080 x 1920

    # couches : celles de planche.json, sinon tout ce qui est préparé dans le dossier (ce que le rendu posera)
    brute = R.lit_json(w / "planche.json", 3, "PLANCHE") if (w / "planche.json").exists() else {}
    demande = brute.get("couches") if isinstance(brute, dict) else None
    if demande:
        demande = [c for c in re.split(r"[,; ]+", str(demande).lower()) if c]
    else:
        demande = ["coupes"] + (["zooms"] if (w / "zooms.txt").exists() else []) + (["b-roll"] if (w / "b-roll.txt").exists() else [])
        if (w / "calques.json").exists():
            srcs = {c.get("source") for c in R.lit_json(w / "calques.json", 3, "CALQUES").get("calques", [])}
            demande += [s for s in ("animations", "sous-titres") if s in srcs]
    zooms = R.chaine_zooms(w) if "zooms" in demande else None
    P = w / "planche"; cache = P / "cache"
    (cache / "plan").mkdir(parents=True, exist_ok=True)
    brolls = R.lit_brolls(w, W0, H0, OW, OH, ff, cache / "plan") if "b-roll" in demande else None
    sources = [s for s in ("animations", "sous-titres") if s in demande]
    calques = R.calques_demandes(w, sources, total) if sources else []
    vignettes, _ = lit_demande(w, calques, total)
    plages_broll = brolls["plages"] if brolls else []
    dire(f"Planche de {len(vignettes)} vignettes, couches : {', '.join(demande)}")

    P = w / "planche"; cache = P / "cache"
    (cache / "calques").mkdir(parents=True, exist_ok=True); (cache / "plan").mkdir(parents=True, exist_ok=True)
    (P / "vignettes").mkdir(parents=True, exist_ok=True)

    # 1. empreintes : plan caméra (graphe commun + flou actif) et calques actifs, par vignette
    socle = R.empreinte(R.filtre_coupes(w, R.video_de(w, info), ff, cache / "plan"), zooms or "", json.dumps(brolls or {}), "tete-1",
                        C["ETALONNAGE"], OW, OH, json.dumps([[c["debut"], c["images"], c["decalage"]] for c in calques if c["decalage"]]))
    emp = {c["id"]: R.empreinte_dossier(c["dossier"]) for c in calques}
    for v in vignettes:
        n = v["image"]
        v["actifs"] = [c for c in calques if c["debut"] <= n < c["debut"] + c["images"]]
        v["broll"] = any(a <= n <= b for a, b in plages_broll)
        v["cle_plan"] = R.empreinte(socle, n, json.dumps([[c["id"], c["flou"]] for c in v["actifs"] if c["flou"]]))

    # 2 et 3, en même temps : le plan caméra (un seul passage ffmpeg pour les images qui manquent) et les calques à
    # leurs seules images (deux prises HyperFrames par calque touché, TRAVAUX à la fois)
    t0 = time.time()
    manquent = sorted({v["image"] for v in vignettes if not (cache / "plan" / f"{v['cle_plan']}-plan.png").exists()})
    a_prendre = {}
    for v in vignettes:
        for c in v["actifs"]:
            d = cache / "calques" / f"{c['id']}-{emp[c['id']]}"
            k = v["image"] - c["debut"]
            if not (d / f"{k:06d}.png").exists():
                a_prendre.setdefault(c["id"], (c, d, set()))[2].add(k)

    def camera():
        t = time.time()
        if manquent:
            sorties = images_camera(ff, w, info, OW, OH, zooms, brolls, calques, C, manquent, cache / "plan")
            for v in vignettes:
                if v["image"] in sorties:
                    fp, fb = sorties[v["image"]]
                    shutil.copy(fp, cache / "plan" / f"{v['cle_plan']}-plan.png")
                    shutil.copy(fb, cache / "plan" / f"{v['cle_plan']}-brut.png")
            shutil.rmtree(cache / "plan" / "tmp", ignore_errors=True)
        return time.time() - t

    def job(item):
        c, d, ks = item
        d.mkdir(parents=True, exist_ok=True)
        return prend_calque(c, sorted(ks), d, cache / "calques" / f"{c['id']}-erreur.log")
    with ThreadPoolExecutor(TRAVAUX + 1) as ex:
        f_cam = ex.submit(camera)
        erreurs = [e for e in ex.map(job, a_prendre.values()) if e]
        t_calques = time.time() - t0
        t_plan = f_cam.result()   # un échec du plan caméra (R.echec) remonte ici
    if erreurs:
        R.echec(4, "\n".join(erreurs))

    # 4. composition (masque Apple Vision de Romain seulement si un calque derrière lui est actif)
    t0 = time.time()
    try:
        import numpy as np
        from PIL import Image
    except ImportError as e:
        R.echec(7, f"OUTIL_MANQUANT : {e} (pip3 install numpy pillow).")
    def vision(brut):
        try:
            import Quartz, Vision
            from Foundation import NSURL
        except ImportError as e:
            R.echec(7, f"OUTIL_MANQUANT détourage : {e} (pip3 install pyobjc-framework-Vision pyobjc-framework-Quartz).")
        m, _, err = R.masque_personne(brut, Quartz, Vision, NSURL, np, Image)
        if m is None:
            R.echec(5, f"DÉTOURAGE_RATÉ : {err}")
        return np.asarray(m).astype(np.float32)
    titre_video = ""
    if (w / "plan-montage.json").exists():
        try:
            titre_video = json.loads((w / "plan-montage.json").read_text(encoding="utf-8")).get("video", "")
        except Exception:
            pass
    refaites = 0; trace = []
    for i, v in enumerate(vignettes, 1):
        v["numero"] = i
        cle = R.empreinte(v["cle_plan"], *[f"{c['id']}:{emp[c['id']]}:{c['debut']}:{c['couche']}:{c['ordre']}:{c['detoure']}"
                                           for c in v["actifs"]], v["broll"])
        fv = cache / "plan" / f"{cle}-vignette.jpg"
        if not fv.exists():
            actifs = [(c, cache / "calques" / f"{c['id']}-{emp[c['id']]}" / f"{v['image'] - c['debut']:06d}.png") for c in v["actifs"]]
            im = compose(cache / "plan" / f"{v['cle_plan']}-plan.png", cache / "plan" / f"{v['cle_plan']}-brut.png",
                         actifs, v["broll"], vision)
            im.save(fv, quality=92); refaites += 1
        v["fichier"] = P / "vignettes" / f"{i:02d}.jpg"
        shutil.copy(fv, v["fichier"])
        v["cle"] = cle
        v["minutage"] = minutage(v["image"])
        v["texte"] = (v["mots"] or texte_dit(w, v["image"])).strip().strip("«»\" ")
        trace.append(dict(numero=i, image=v["image"], minutage=v["minutage"], texte=v["texte"], ligne=v["ligne"],
                          calques=[c["id"] for c in v["actifs"]], broll=v["broll"], fichier=str(v["fichier"]), demande=v["demande"]))
    for f in (P / "vignettes").glob("*.jpg"):
        if f not in {v["fichier"] for v in vignettes}:
            f.unlink()
    t_compo = time.time() - t0

    titre = f"Ta vidéo{(' « ' + titre_video + ' »') if titre_video else ''}, moment par moment"
    planche_png(vignettes, titre, biblio, P / "planche.png", C)
    planche_html(vignettes, titre, P / "planche.html")

    # cache : ne garde que ce qui sert à cette planche (calques à jour, images de plan et vignettes utilisées)
    gardes = {f"{v['cle_plan']}-{s}.png" for v in vignettes for s in ("plan", "brut")} | {f"{v['cle']}-vignette.jpg" for v in vignettes}
    for f in (cache / "plan").iterdir():
        if f.name not in gardes:
            shutil.rmtree(f) if f.is_dir() else f.unlink()
    a_jour = {f"{c['id']}-{emp[c['id']]}" for c in calques}
    for f in (cache / "calques").iterdir():
        if f.name not in a_jour:
            shutil.rmtree(f) if f.is_dir() else f.unlink()
    total_s = time.time() - t_debut
    (P / "trace.json").write_text(json.dumps(dict(vignettes=trace, couches=demande, refaites=refaites,
                                                  reprises=len(vignettes) - refaites, plan_s=round(t_plan, 1),
                                                  calques_pris=sorted(a_prendre), calques_s=round(t_calques, 1),
                                                  composition_s=round(t_compo, 1), total_s=round(total_s, 1)),
                                             ensure_ascii=False, indent=1), encoding="utf-8")
    dire(f"  plan caméra : {len(manquent)} image(s) en {t_plan:.0f} s ; calques : {len(a_prendre)} pris en {t_calques:.0f} s ; "
         f"composition : {refaites} vignette(s) refaite(s), {len(vignettes) - refaites} reprise(s)")
    dire(f"PRÊT {P / 'planche.html'} et {P / 'planche.png'} ({len(vignettes)} vignettes, en {total_s:.0f} s)")


if __name__ == "__main__":
    main()
