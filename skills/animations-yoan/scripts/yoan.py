#!/usr/bin/env python3
"""yoan.py : le moteur du monteur de Yoan, dans la structure du monteur de Romain (skill animations-yoan).

Le plan (`<dossier>-montage/plan-montage.json`, skill plan-montage-yoan) est la timeline du pipeline de Yoan. Ce script
la traduit en couches du moteur de Romain, que les briques partagées posent ensuite (zooms, aperçu, rendu) :

  yoan.py regarder <dossier> t1 t2 ...   planche des images de la vidéo coupée à ces instants (s) : un geste, la place libre
  yoan.py texte   <dossier>   texte-plan.md : la vidéo coupée, une ligne par phrase, ancres prêtes (mot#n, [w12],
                              ‖@coupeN‖), comme le transcript coupé du planificateur de Yoan
  yoan.py valider <dossier>   résout et contrôle le plan (règles du pipeline de Yoan + ce que le moteur sait faire)
  yoan.py zooms   <dossier>   zooms.json pour la brique zooms (dézoom d'ouverture du hook, éclairs, rapprochements)
  yoan.py calques <dossier>   calques/<id>/ et calques.json (source « animations ») : hook, ouverture et hook secondaire,
                              faisceaux, pleins écrans, demi-écrans, gabarits de motion, mot derrière la tête, CTA, sur
                              mesure ; mesures de la tête par Apple Vision quand le geste en dépend
  yoan.py sons    <dossier>   sons.json : flash de chaque faisceau, CTA et ses lignes, effets du motion du plan, sons
                              propres au reel ; musique de l'ambiance du plan (piste préparée une fois, sous la voix)

Toutes les valeurs de style viennent de moteur/style/style.json (copie du style @ia.yoan) ; tous les dessins viennent
des gestes et gabarits de moteur/ (copie du pipeline de Yoan). Le zoom, le détourage, l'aperçu et le rendu sont ceux du
monteur de Romain (briques zooms et rendu), sans changement.

Codes de sortie : 0 ok (dernière ligne PRÊT ...), 2 fichier manquant, 3 plan refusé (les fautes sont listées), 5 échec
d'un outil (Node, ffmpeg, Vision).
"""
import hashlib, json, math, shutil, subprocess, sys, tempfile
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))
import plan as P  # noqa: E402
from plan import VT, STYLE, IPS  # noqa: E402

SK = P.SKILL.parent                                 # le dossier des skills (installés côte à côte)
STYLE_SONS = SK / "animations" / "bibliotheque" / "styles" / "yoan" / "sons"   # sons du style avec leur fiche d'attaque
PILOTE = P.EXE / "pilote" / "calques.mjs"
POLICES = ["satoshi", "inter", "jetbrains"]
FPS = IPS
W, H = STYLE["format"]["largeur"], STYLE["format"]["hauteur"]
SON = STYLE["son"]


def dire(m=""):
    print(m, flush=True)


def echec(code, m):
    dire(m); sys.exit(code)


def img(t):
    return int(round(t * FPS))


def grille(t):
    return img(t) / FPS


def lit(p, defaut=None):
    p = Path(p)
    if not p.exists():
        if defaut is not None: return defaut
        echec(2, f"FICHIER_INTROUVABLE : {p}")
    return json.loads(p.read_text(encoding="utf-8-sig"))


def ecrit(p, o):
    Path(p).write_text(json.dumps(o, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def resolu(w, commande=False):
    try:
        res, fautes, avert, tl = P.resoudre(w, commande)
    except P.PlanFaux as e:
        echec(2, str(e))
    for a in avert: dire(f"AVERTISSEMENT {a}")
    if fautes:
        for f in fautes: dire(f"FAUTE {f}")
        echec(3, f"PLAN_REFUSÉ {len(fautes)} faute(s) : corrige plan-montage.json, puis relance « valider ».")
    d = w / "animations-yoan"; d.mkdir(exist_ok=True)
    ecrit(d / "plan-developpe.json", {k: v for k, v in tl.items() if not k.startswith("_")})
    ecrit(d / "plan-resolu.json", res)
    return res, tl


# ------------------------------------------------------------------------------------------------ texte
OUTILS = set("""le la les l un une des de du d au aux a à et ou en y ce c ça cet cette ces se s sa son ses ma mon mes
ta ton tes je j tu t il elle on nous vous ils elles me m te lui leur qui que qu quoi dont où ne n pas plus pour par sur
dans avec sans est es suis ai as va vont fait être avoir comme mais donc si""".split())


def cmd_texte(w):
    """Le transcript coupé du planificateur de Yoan (transcript_compact.py coupe), sur la vidéo coupée par couper-silences,
    avec en plus le numéro words.cut.json du premier mot de chaque ligne ([w12]) pour les ancres numérotées."""
    doc = lit(w / "words.cut.json"); edl = lit(w / "edl.json")
    A = VT.Ancres(doc["words"], edl)
    total = {}
    for m in A.mots: total[m["n"]] = total.get(m["n"], 0) + 1
    vu, L, ligne, debut, j, prev = {}, [], [], None, 0, None
    dur = A.duree
    sec = lambda t: f"{t:.1f}".replace(".", ",")
    L += [f"# Texte de la vidéo coupée ({w.name})",
          f"{sec(dur)} s, {len(A.mots)} mots, {len(A.joints)} coupes de prise. Temps de la vidéo coupée, en secondes.",
          "Lecture : `mot#n` = n-ième occurrence (ancre prête) ; un mot sans #n est unique, ou c'est un mot-outil (ancre-le par "
          "son numéro : `[w12]` en tête de ligne = numéro du premier mot, les suivants se comptent) ; `‖@coupeN‖` = coupe de "
          "prise N (elle doit être cachée).", ""]

    def flush(fin):
        if ligne: L.append(f"{sec(debut)}-{sec(fin)} [w{premier}] : {' '.join(ligne)}")

    premier = 0
    for m in A.mots:
        n = m["n"]; vu[n] = vu.get(n, 0) + 1
        coupe_ici = j < len(A.joints) and m["start"] >= A.joints[j] - 1e-6
        pause = prev is not None and m["start"] - prev["end"] > 0.6
        if coupe_ici or pause or (prev is not None and prev["text"].rstrip().endswith((".", "?", "!"))):
            flush(prev["end"] if prev else 0); ligne, debut = [], None
        if coupe_ici:
            while j < len(A.joints) and m["start"] >= A.joints[j] - 1e-6:
                j += 1; ligne.append(f"‖@coupe{j}‖")
        if debut is None: debut, premier = m["start"], m["r"]
        t = m["text"]
        if total[n] > 1 and n.strip("'") not in OUTILS:
            import re
            x = re.match(r"^(.*?)([.,;:!?…»]*)$", t); t = f"{x[1]}#{vu[n]}{x[2]}"
        ligne.append(t); prev = m
    flush(prev["end"] if prev else 0)
    (w / "texte-plan.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    dire(f"PRÊT {w / 'texte-plan.md'} ({len(A.mots)} mots, {len(A.joints)} coupes, {dur:.1f} s)")


def cmd_valider(w):
    res, tl = resolu(w, commande=True)
    d = res.get("densite_mesuree", {})
    E = res["elements"]
    compte = {}
    for r in E: compte[r["type"]] = compte.get(r["type"], 0) + 1
    dire(f"PRÊT plan valide : {len(E)} éléments ({', '.join(f'{k} {v}' for k, v in sorted(compte.items()))}), "
         f"{res['duree']:.1f} s, densité {d.get('par_10_s')} gestes / 10 s ({res['densite']})")
    manque = [r for r in E if r["type"] == "sur_mesure" and not (Path(r["calque"]) / "index.html").exists()]
    for r in manque: dire(f"A_ECRIRE sur mesure {r['calque']} (de {r['de']:.2f} à {r['a']:.2f} s) : à écrire avant « calques »")


# ------------------------------------------------------------------------------------------------ zooms
def mot_de(A, ancre):
    m = A.mot(ancre)
    if m is None: raise P.PlanFaux(f"ZOOM : « {ancre} » n'est pas une ancre de mot")
    return m


def cmd_zooms(w):
    res, tl = resolu(w)
    edl = lit(w / "edl.json"); A = VT.Ancres(lit(w / "words.cut.json")["words"], edl)
    zooms, notes = [], []
    hook = next((r for r in res["elements"] if r["type"] == "hook"), None)
    if hook:   # le cadre serré du hook devient le dézoom d'ouverture du moteur (120 % vers 100 % jusqu'à la sortie du hook)
        m = next((x for x in A.mots if x["start"] >= hook["a"] - 1e-3), A.mots[-1])
        zooms.append({"type": "ouverture", "mot": m["r"], "pourquoi": "cadre serré du hook, revient à 100 % à sa sortie"})
    for e in tl["elements"]:
        if e.get("type") != "zoom": continue
        m = mot_de(A, e["a"])
        typ = "eclair" if e["geste"] == "eclair" else "rapprochement"
        z = {"type": typ, "mot": m["r"], "pourquoi": f"zoom {e['geste']} du plan sur « {m['text']} »"}
        s = e.get("sortie") or ({"a": e["fin"]} if e.get("fin") else None)
        if s and s.get("a"):
            t = A.t(s["a"], avance=0)
            if not any(abs(t - j) <= VT.TOL for j in A.joints):
                fin = max((x for x in A.mots if x["end"] <= t + 1e-3), key=lambda x: x["end"], default=m)
                if fin["r"] >= m["r"]: z["fin"] = fin["r"]
            apres = [j for j in A.joints if j > m["start"] + 1e-3]
            if apres and apres[0] - m["start"] <= 4.0 and abs(apres[0] - t) > 0.2:
                notes.append(f"zoom sur « {m['text']} » : il tiendra jusqu'à la coupe de {apres[0]:.2f} s, pas jusqu'à {t:.2f} s (le moteur ferme un zoom sur la coupe qui suit)")
        zooms.append(z)
    ecrit(w / "zooms.json", {"zooms": zooms, "_source": "plan-montage.json (monteur de Yoan), écrit par animations-yoan/scripts/yoan.py zooms"})
    for n in notes: dire(f"AVERTISSEMENT {n}")
    dire(f"PRÊT zooms.json : {len(zooms)} zoom(s) ({', '.join(z['type'] for z in zooms) or 'aucun'}) ; lance maintenant la brique zooms (preparer)")


# ------------------------------------------------------------------------------------------------ mesures de la tête
def echelle_zoom(w, n):
    """(échelle, ancre_x, ancre_y en px 1080 x 1920) de la caméra à l'image n de la vidéo coupée, d'après
    zooms-donnees.json (brique zooms) ; (1, 540, 960) sans zoom."""
    d = lit(w / "zooms-donnees.json", {})
    for z in d.get("zooms", []):
        ax, ay = z["ancre"][0] * W, z["ancre"][1] * H
        if z["type"] == "ouverture":
            if n < z["f1"]: return z["echelle"] - (z["echelle"] - 1) * n / z["f1"], ax, ay
        elif z["f0"] <= n < z["f1"]:
            if n >= z["fixe"]: return z["echelle"], ax, ay
            p = (n - z["f0"]) / max(1, z["fixe"] - z["f0"])
            c = 1 - (1 - p) ** 2 if z["courbe"] == "power2.out" else (2 * p * p if p < 0.5 else 1 - (-2 * p + 2) ** 2 / 2)
            return 1 + (z["echelle"] - 1) * c, ax, ay
    return 1.0, W / 2, H / 2


class Tete:
    """Haut des cheveux et centre du visage sur des images de la vidéo coupée (Apple Vision sur l'original, puis la
    transformation du zoom de la brique zooms), en px de l'image finale 1080 x 1920."""

    def __init__(self, w):
        self.w = w
        info = lit(w / "info.json")
        voisine = w.parent / Path(str(info["video"])).name
        self.video = voisine if voisine.is_file() else Path(info["video"])
        self.segs = lit(w / "edl.json")["segments"]
        self.ff = shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"
        self.tmp = Path(tempfile.mkdtemp(prefix="tete-"))
        self.cache = {}

    def _image(self, n):
        import numpy as np
        from PIL import Image
        seg = next((s for s in self.segs if s["outInF"] <= n < s["outOutF"]), self.segs[-1])
        t = (seg["srcInF"] + min(n, seg["outOutF"] - 1) - seg["outInF"]) / FPS
        png = self.tmp / f"i{n}.png"
        r = subprocess.run([self.ff, "-nostdin", "-v", "error", "-y", "-ss", f"{t:.4f}", "-i", str(self.video), "-frames:v", "1",
                            "-vf", f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}", str(png)], capture_output=True)
        if r.returncode != 0 or not png.exists(): echec(5, f"MESURE_IMPOSSIBLE : image {n} illisible ({r.stderr.decode(errors='replace')[-200:]})")
        return np.asarray(Image.open(png).convert("RGB"))

    def mesure(self, n):
        """{cheveux, x} à l'image n (après zoom), ou None si personne n'est trouvé."""
        if n in self.cache: return self.cache[n]
        import numpy as np
        rgb = self._image(n)
        m = masque_vision(rgb)
        fx = visage_x(rgb)
        cx = int(fx) if fx is not None else W // 2
        bande = (m[:, max(0, cx - 220):min(W, cx + 220)] > 0.5).any(1)
        rows = np.where(bande)[0]
        if not len(rows): self.cache[n] = None; return None
        y, x = float(rows[0]), float(cx)
        s, ax, ay = echelle_zoom(self.w, n)
        out = dict(cheveux=ay + (y - ay) * s, x=ax + (x - ax) * s, echelle=s)
        self.cache[n] = out
        return out

    def fin(self):
        shutil.rmtree(self.tmp, ignore_errors=True)


def _cgimage(rgb):
    import Quartz
    import numpy as np
    rgb = np.ascontiguousarray(rgb); h, w = rgb.shape[:2]; data = rgb.tobytes()
    prov = Quartz.CGDataProviderCreateWithData(None, data, len(data), None)
    return Quartz.CGImageCreate(w, h, 8, 24, w * 3, Quartz.CGColorSpaceCreateDeviceRGB(), Quartz.kCGImageAlphaNone, prov, None, False,
                                Quartz.kCGRenderingIntentDefault)


def masque_vision(rgb):
    """Masque de personne Apple Vision (qualité « accurate »), float 0..1 à la taille de l'image (detourage/vision.py de Yoan)."""
    import Quartz, Vision
    import numpy as np
    from PIL import Image
    req = Vision.VNGeneratePersonSegmentationRequest.alloc().initWithCompletionHandler_(None)
    req.setQualityLevel_(0)
    req.setOutputPixelFormat_(Quartz.kCVPixelFormatType_OneComponent8)
    h = Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(_cgimage(rgb), {})
    ok, err = h.performRequests_error_([req], None)
    if not ok or not req.results(): echec(5, f"VISION_REFUSE : {err}")
    pb = req.results()[0].pixelBuffer()
    w = Quartz.CVPixelBufferGetWidth(pb); ht = Quartz.CVPixelBufferGetHeight(pb)
    Quartz.CVPixelBufferLockBaseAddress(pb, 1)
    bpr = Quartz.CVPixelBufferGetBytesPerRow(pb)
    arr = np.frombuffer(Quartz.CVPixelBufferGetBaseAddress(pb).as_buffer(bpr * ht), dtype=np.uint8).reshape(ht, bpr)[:, :w].copy()
    Quartz.CVPixelBufferUnlockBaseAddress(pb, 1)
    return np.asarray(Image.fromarray(arr).resize((rgb.shape[1], rgb.shape[0]), Image.BILINEAR)).astype(np.float32) / 255.


def visage_x(rgb):
    import Vision
    req = Vision.VNDetectFaceRectanglesRequest.alloc().init()
    Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(_cgimage(rgb), {}).performRequests_error_([req], None)
    if not req.results(): return None
    b = max(req.results(), key=lambda r: r.boundingBox().size.width).boundingBox()
    return (b.origin.x + b.size.width / 2) * rgb.shape[1]


# ------------------------------------------------------------------------------------------------ demi-écran
DE = STYLE["demiEcran"]
COURBES = {
    "none": lambda p: p, "power1.in": lambda p: p * p, "power2.out": lambda p: 1 - (1 - p) ** 2,
    "power2.inOut": lambda p: 2 * p * p if p < 0.5 else 1 - (-2 * p + 2) ** 2 / 2,
    "sine.inOut": lambda p: 0.5 - 0.5 * math.cos(math.pi * p),
}


def courbe(nom, p):
    p = min(1.0, max(0.0, p))
    tab = DE["courbes"].get(nom)
    if tab:
        T = tab["table"]; x = p * (len(T) - 1); i = min(len(T) - 2, int(x)); return T[i] + (T[i + 1] - T[i]) * (x - i)
    return COURBES[nom](p)


def demi_decalage(d, t):
    """Décalage vertical du visage (px) pendant un demi-écran : la loi de camera.py du pipeline de Yoan (le fond descend
    en courbe « banque » et pousse le visage dès qu'il l'atteint ; la bascule pousse le panneau vers le plein écran)."""
    Hh, ty = DE["hauteur"], DE["decalage"]
    nom = d.get("courbe", DE["courbe"]); tab = DE["courbes"].get(nom); dur = tab["duree"] if tab else 0.7
    sortie = d.get("sortie", "coupe" if d.get("bascule") else "remonte")
    if t < d["t0"]: return 0.0
    if sortie == "coupe" and t >= d["t1"]: return 0.0
    if t < d["t1"]: V = -Hh + Hh * courbe(nom, (t - d["t0"]) / dur)
    else: V = -Hh * min(1.0, (t - d["t1"]) / DE["sortie"])
    dec = min(ty, max(0.0, V + ty))
    b = d.get("bascule")
    if b and b["type"] == "pousse" and t >= b["t"]:
        dec += (H - Hh + 240) * courbe(DE["bascule"]["courbe"], (t - b["t"]) / DE["bascule"]["duree"])
    return dec


# ------------------------------------------------------------------------------------------------ calques
def rel_params(p, t0):
    if isinstance(p, dict):
        if set(p) == {"@t"}: return round(p["@t"] - t0, 3)
        return {k: rel_params(v, t0) for k, v in p.items()}
    if isinstance(p, list): return [rel_params(v, t0) for v in p]
    return p


def son_style(nom, image, pourquoi, calque):
    """Un son du style de Yoan (famille « motion premium », flash, CTA), au niveau du style, en image de la vidéo coupée."""
    if nom == "flash":
        f, niv = "flash.wav", {"lu_sous_voix": 9}
    elif nom == "cta":
        f, niv = "cta-apparition.wav", {"rms_db_sous_voix": SON["cta"]["rmsSousVoix"]}
    elif nom == "cta_lignes":
        f, niv = "cta-apparition.wav", {"rms_db_sous_voix": SON["cta"]["rmsSousVoix"] - SON["cta"]["lignes"]["gain"]}
    elif nom == "tic":
        f, niv = "cta-apparition.wav", {"rms_db_sous_voix": SON["tic"]["rmsSousVoix"]}
    else:
        e = SON["effets"][nom]; f, niv = Path(e["fichier"]).name, {"rms_db_sous_voix": e["rmsSousVoix"]}
    return {"fichier": str(STYLE_SONS / f), "image": int(image), "niveau": niv, "geste": nom, "calque": calque, "pourquoi": pourquoi}


class Calques:
    def __init__(self, w, res, tl):
        self.w, self.res, self.tl = w, res, tl
        self.D = res["duree"]; self.N = img(self.D)
        self.L = []          # pour pilote/calques.mjs
        self.fiches = []     # entrées de calques.json (contrat du monteur de Romain) + extras
        self.tete = None
        self.E = res["elements"]

    def de_type(self, *t):
        return [e for e in self.E if e["type"] in t]

    def mesure(self, n):
        if self.tete is None: self.tete = Tete(self.w)
        return self.tete.mesure(n)

    def calque(self, ident, t0, t1, parts, couche, ordre, polices=("satoshi",), grain=False, **extra):
        t0 = grille(max(0.0, t0)); t1 = min(self.D, t1)
        debut, images = img(t0), max(1, img(t1) - img(t0))
        self.L.append(dict(dossier=str(self.w / "calques" / ident), duree=round(images / FPS, 4), polices=list(polices), grain=grain, parts=parts))
        f = dict(id=ident, source="animations", dossier=f"calques/{ident}", debut=debut, images=images, couche=couche, ordre=ordre,
                 sons_suggeres=[], demande=ident, origine={"pipeline_yoan": extra.pop("geste", ident)}, ecrit_le=None)
        f.update(extra)
        self.fiches.append(f)
        return f, t0

    def construire(self):
        E, D = self.E, self.D
        F = VT.faisceaux(self.res)
        # faisceaux : un calque court par faisceau, devant tout sauf les sous-titres (le flash est son son)
        for i, T in enumerate(F):
            f, t0 = self.calque(f"fx{i:02d}", T - 8 / FPS, min(D, T + 5 / FPS), [dict(k="faisceaux", T=[round(8 / FPS, 4)])],
                                "devant", 90, geste="faisceau")
            f["sons_suggeres"].append(son_style("flash", img(T), f"faisceau à {T:.2f} s", f["id"]))
        # pleins écrans à mots
        PE = STYLE["pleinEcran"]
        for i, e in enumerate(self.de_type("plein_ecran")):
            w0 = grille(e["de"] - PE["fondAvant"] - 0.05); w1 = min(D, e["a"] + 0.15); r = lambda t: round(t - w0, 3)
            lignes = [[[x, r(t), k] for x, t, k in l] for l in e["lignes"]]
            self.calque(f"pe{i}", w0, w1, [dict(k="pleinMots", lignes=lignes, T1=r(e["de"]), T2=r(e["a"]), variante=e["variante"])],
                        "devant", 40, grain=True, geste="plein écran à mots")
        # demi-écrans (le visage est poussé vers le bas par le même décalage que le pipeline de Yoan)
        for i, e in enumerate(self.de_type("demi_ecran")):
            w0 = grille(max(0.0, e["de"] - 0.05)); w1 = min(D, e["a"] + (DE["sortie"] if e["sortie"] == "remonte" else 0) + 0.1)
            r = lambda t: round(t - w0, 3)
            ct = dict(gabarit=e["contenu"]["gabarit"], params=rel_params(e["contenu"]["params"], w0))
            if ct["gabarit"] == "champ-chat": ct["params"].setdefault("fin", round(w1 - w0, 3))
            b = dict(type=e["bascule"]["type"], t=r(e["bascule"]["t"])) if e.get("bascule") else None
            p = dict(k="demi", t0=r(e["de"]), t1=r(e["a"]), contenu=ct, sortie=e["sortie"], bascule=b)
            f, _ = self.calque(f"de{i}", w0, w1, [p], "devant", 20, POLICES, True, geste=f"demi-écran ({ct['gabarit']})")
            dd = dict(t0=r(e["de"]), t1=r(e["a"]), sortie=e["sortie"], bascule=b)
            dec = [round(demi_decalage(dd, k / FPS), 3) for k in range(f["images"])]
            ecrit_dec = f"calques/{f['id']}/decalage.json"
            f["plan"] = {"decalage_y": ecrit_dec}
            f["_decalage"] = dec
        # gabarits de motion (sur la caméra, ou plein écran sur le fond granuleux entre deux faisceaux)
        for i, e in enumerate(self.de_type("motion")):
            plein = e["support"] == "plein"
            w0 = grille(max(0.0, e["de"] - (0.25 if plein else 0.05))); w1 = min(D, e["a"] + (0.15 if plein else 0))
            p = dict(k="gabarit", gab=dict(gabarit=e["gabarit"], params=rel_params(e["params"], w0)))
            if plein: p["plein"] = dict(T1=round(e["de"] - w0, 3), T2=round(e["a"] - w0, 3))
            self.calque(f"mo{i}", w0, w1, [p], "devant", 40 if plein else 22, POLICES, True, geste=f"motion {e['gabarit']}")
        # hook : ouverture et titre derrière la tête (couche derrière, trouée par la personne), hook secondaire devant
        for e in self.de_type("hook"):
            Ry = STYLE["hook"]["titre"]["rythme"]; t = e["titre_t"]; lignes = []
            for li, l in enumerate(e["lignes"]):
                if li: t += Ry["pasLigne"] - Ry["pas"]
                lg = []
                for x in l.split(): lg.append([x, round(t, 3), x == e["dore"]]); t += Ry["pas"]
                lignes.append(lg)
            parts = [dict(k="hookTitre", lignes=lignes)]
            if e.get("ouverture"):
                gs = e["ouverture"]; og = []
                dec = STYLE["sousTitres"]["debutAvantMot"] - STYLE["entrees"]["texte"]["avance"]
                for gi, g in enumerate(gs):
                    debut = g["lignes"][0][0][1] - dec
                    fin = gs[gi + 1]["lignes"][0][0][1] - dec if gi + 1 < len(gs) else e["titre_t"]
                    og.append(dict(lignes=g["lignes"], debut=round(max(0.0, debut), 3), fin=round(fin, 3)))
                parts.insert(0, dict(k="hookOuverture", groupes=og))
            m0 = self.mesure(0)
            cible = STYLE["hook"]["camera"]["cheveuxY"]
            dy = 0.0 if not m0 else max(-150.0, min(260.0, m0["cheveux"] - cible))
            self.calque("hook-titre", 0.0, e["a"], parts, "derriere", 10, ["anton"], geste="hook (ouverture et titre derrière la tête)",
                        suit_ouverture=True, _suivi=dict(dy=round(dy, 1)))
            if e.get("secondaire"):
                SC = STYLE["hook"]["secondaire"]; v = SC["variante"]
                dore = next(x for l in lignes for x in l if x[2])
                t_sec = round(lignes[-1][-1][1] + SC["apresTitre"], 3) if v == "apres" else 0.0 if v == "presente" else SC["entree"]["t"]
                self.calque("hook-secondaire", 0.0, e["a"], [dict(k="hookSecondaire", lignes=e["secondaire"], t=t_sec, fin=None, variante=v,
                                                                  tAllume=dore[1])], "devant", 31, geste="hook secondaire")
        # mot derrière la tête (mesures de la tête à son entrée)
        for i, e in enumerate(self.de_type("mot_derriere")):
            w0 = grille(max(0.0, e["de"] - 0.1)); k0 = img(e["de"])
            ms = [m for m in (self.mesure(k) for k in range(k0, min(self.N, k0 + 5), 2)) if m]
            if not ms: echec(5, f"MESURE_IMPOSSIBLE : mot derrière la tête à {e['de']:.2f} s, personne trouvé sur l'image")
            hc = sorted(m["cheveux"] for m in ms)[len(ms) // 2]; xc = sorted(m["x"] for m in ms)[len(ms) // 2]
            self.calque(f"md{i}", w0, e["a"], [dict(k="motDerriere", mot=e["mot"], t=round(e["de"] - w0, 3), hautCheveux=int(hc), xCentre=round(xc, 1))],
                        "derriere", 12, ["anton"], geste="mot derrière la tête")
        # CTA (au-dessus de la tête sur la caméra, ou sur le fond granuleux)
        for i, e in enumerate(self.de_type("cta")):
            fond = e["support"] == "fond"; q = e["quand"]
            w0 = grille(q["faisceau"] - 0.3) if fond else grille(max(0.0, e["de"] - 0.1)); r = lambda t: round(t - w0, 3)
            o = dict(k="cta", support=e["support"], mot=e["mot"], consigne=e["consigne"], bas=e["bas"], tConsigne=r(q["consigne"]),
                     tMot=r(q["mot"]), tBas=r(q["bas"]), fin=round(e["a"] - w0, 3))
            if fond: o["T"] = r(q["faisceau"])
            else:
                ms = [m for m in (self.mesure(k) for k in range(img(w0), min(self.N, img(e["a"])), 6)) if m]
                if not ms: echec(5, "MESURE_IMPOSSIBLE : CTA sur la caméra, personne trouvé")
                hcs = sorted(int(m["cheveux"]) for m in ms)
                o["hautCheveux"] = hcs[len(hcs) // 2]; o["hautCheveuxMin"] = hcs[0]
            f, _ = self.calque(f"cta{i}", w0, e["a"], [o], "devant", 60, grain=fond, geste=f"CTA ({e['support']})")
            lignes_t = q["mot"] + STYLE["cta"]["lignes"]["decalage"]
            f["sons_suggeres"] += [son_style("cta", img(q["mot"]), f"CTA : le mot {e['mot']}", f["id"]),
                                   son_style("cta_lignes", img(lignes_t), "CTA : ses lignes", f["id"])]
        # sur mesure : calque déjà écrit (index.html) dans le dossier donné par le plan
        for i, e in enumerate(self.de_type("sur_mesure")):
            src = Path(e["calque"])
            if not (src / "index.html").exists(): echec(2, f"SUR_MESURE_A_ECRIRE : {src}/index.html (écris l'animation d'abord, voir le skill)")
            ident = src.name if src.parent.resolve() == (self.w / "calques").resolve() else f"sm{i}-{src.name}"
            f, _ = self.calque(ident, e["de"], e["a"], None, "derriere" if e["perforer"] else "devant", 45, geste="sur mesure")
            f["_sur_mesure"] = str(src)
        # sons demandés par le plan (événements visuels des animations, son propre au reel)
        for e in self.de_type("son"):
            cq = next((f for f in self.fiches if f["debut"] - 1 <= img(e["de"]) <= f["debut"] + f["images"] and f["id"][:2] != "fx"), None)
            cible = cq or next((f for f in self.fiches if f["debut"] - 1 <= img(e["de"]) <= f["debut"] + f["images"]), None)
            if e["son"] == "fichier":
                s = {"fichier": e["fichier"], "image": img(e["de"]), "niveau": {"rms_db_sous_voix": e["sousVoix"]}, "geste": "fichier",
                     "calque": cible["id"] if cible else None, "pourquoi": "son propre au reel"}
            else:
                s = son_style(e["son"], img(e["de"]), f"{e['son']} du plan à {e['de']:.2f} s", cible["id"] if cible else None)
            if not cible: echec(3, f"PLAN_REFUSÉ son « {e['son']} » à {e['de']:.2f} s : hors de toute animation")
            cible["sons_suggeres"].append(s)

    def ecrire(self):
        d = self.w / "calques"; d.mkdir(exist_ok=True)
        L = [c for c in self.L if c["parts"] is not None]
        lf = self.w / "animations-yoan" / "calques-pilote.json"; lf.parent.mkdir(exist_ok=True)
        ecrit(lf, L)
        r = subprocess.run(["node", str(PILOTE), str(lf)], capture_output=True, text=True)
        if r.returncode != 0: echec(5, f"CALQUES_RATÉS : {r.stderr[-2500:]}")
        for f in self.fiches:
            dc = self.w / f["dossier"]
            if f.get("_sur_mesure"):
                src = Path(f.pop("_sur_mesure"))
                if src.resolve() != dc.resolve():
                    shutil.rmtree(dc, ignore_errors=True); shutil.copytree(src, dc)
            if "_decalage" in f:
                (dc / "decalage.json").write_text(json.dumps(f.pop("_decalage")))
            suivi = f.pop("_suivi", None)
            if suivi is not None: suivre_ouverture(self.w, dc, suivi["dy"])
            f["ecrit_le"] = __import__("datetime").date.today().isoformat()
            fiche = dict(f, attendus=[], a_fournir=[], params=None)
            (dc / "calque.json").write_text(json.dumps(fiche, ensure_ascii=False, indent=1) + "\n")
        # calques.json : nos entrées (source « animations ») remplacent les anciennes, celles des autres briques restent
        cj = self.w / "calques.json"
        ex = lit(cj, {"calques": []})
        autres = [c for c in ex.get("calques", []) if c.get("source") != "animations"]
        miens = []
        for f in self.fiches:
            e = {k: f[k] for k in ("id", "source", "dossier", "debut", "images", "couche", "ordre")}
            if f.get("plan"): e["plan"] = f["plan"]
            e["sons_suggeres"] = f["sons_suggeres"]
            miens.append(e)
        ids = {f["id"] for f in self.fiches}
        for vieux in d.iterdir():   # calques d'un plan précédent : retirés (le plan fait foi)
            if vieux.is_dir() and vieux.name not in ids and (vieux / "calque.json").exists():
                try: src_v = json.loads((vieux / "calque.json").read_text()).get("source")
                except Exception: src_v = None
                if src_v == "animations": shutil.rmtree(vieux)
        ecrit(cj, {**ex, "calques": autres + miens})
        if self.tete: self.tete.fin()
        return miens


def suivre_ouverture(w, dc, dy):
    """Le titre derrière la tête suit le dézoom d'ouverture (ouverture.json de la brique zooms) image par image, autour
    du même point fixe, et se pose d'abord sur la tête mesurée à la première image (haut des cheveux au tiers de la
    2e ligne, comme le cadre du hook de Yoan)."""
    o = lit(w / "ouverture.json", {})
    html = (dc / "index.html").read_text()
    debut = '<div id="root"'
    i = html.index(debut); j = html.index(">", i) + 1; k = html.index("</div>\n<svg", j)
    ax, ay = (o.get("ancre_1080x1920") or [W / 2, H / 2])
    html = (html[:j] + f'\n<div id="suit" style="position:absolute;left:0;top:0;width:{W}px;height:{H}px;transform-origin:{ax}px {ay}px;">'
            f'<div style="position:absolute;left:0;top:0;width:{W}px;height:{H}px;transform:translateY({dy}px);">' + html[j:k] + "</div></div>\n" + html[k:])
    js = ""
    if o.get("images"):
        n1, s0 = int(o["images"]), float(o["echelle_depart"])
        for n in range(0, n1 + 1):
            s = (s0 - (s0 - 1) * min(n, n1) / n1) / s0
            js += f"tl.set('#suit', {{ scale: {s:.5f} }}, {max(0.0, n / FPS - 0.0005):.4f});\n"
    if js:
        html = html.replace("tl.set({}, {}, ", js + "tl.set({}, {}, ", 1)
    (dc / "index.html").write_text(html)


def cmd_calques(w):
    res, tl = resolu(w)
    if any(r["type"] == "hook" for r in res["elements"]) and not (w / "ouverture.json").exists():
        dire("AVERTISSEMENT ouverture.json absent : lance d'abord « yoan.py zooms » puis la brique zooms, le titre du hook suit le dézoom")
    C = Calques(w, res, tl)
    C.construire()
    miens = C.ecrire()
    for c in miens:
        dire(f"   {c['id']:<16} {c['couche']:<8} ordre {c['ordre']:>3}  images {c['debut']}-{c['debut'] + c['images'] - 1}"
             f"{' (visage poussé)' if c.get('plan') else ''}{', %d son(s)' % len(c['sons_suggeres']) if c['sons_suggeres'] else ''}")
    dire(f"PRÊT calques.json : {len(miens)} calque(s) d'animation ; lance maintenant les sous-titres (sous-titres-yoan)")


# ------------------------------------------------------------------------------------------------ sons et musique
def cmd_sons(w):
    res, tl = resolu(w)
    cj = lit(w / "calques.json")
    sons = []
    for c in cj.get("calques", []):
        for s in c.get("sons_suggeres") or []:
            sons.append({k: s[k] for k in ("fichier", "image", "niveau", "geste", "calque", "pourquoi") if k in s})
    N = lit(w / "edl.json")["stats"]["out_frames"]
    hors = [s for s in sons if not 0 <= s["image"] < N]
    for s in hors: dire(f"AVERTISSEMENT son hors de la vidéo, retiré : {s['pourquoi']}")
    sons = sorted((s for s in sons if 0 <= s["image"] < N), key=lambda s: s["image"])
    for s in sons:
        if not Path(s["fichier"]).exists(): echec(2, f"SON_INTROUVABLE : {s['fichier']}")
    musique = None
    amb = res.get("ambiance")
    if amb:
        musique = preparer_musique(w, amb, N)
    ecrit(w / "sons.json", {"sons": sons, "musique": musique,
                            "_source": "monteur de Yoan : sons du plan et des gestes (animations-yoan/scripts/yoan.py sons)"})
    dire(f"PRÊT sons.json : {len(sons)} son(s){f', musique {amb}' if musique else ', sans musique'}")


def preparer_musique(w, ambiance, N):
    """Piste musique de la vidéo coupée, préparée une fois (son/son.py du pipeline de Yoan : tempo ramené, boucle reprise
    à la 2e mesure, entrée et sortie en fondu, voix - 15 dB K hors parole, ducking de 2 dB pendant la parole), réglée sur
    la voix exacte du rendu (voix_coupee de la brique rendu). Le rendu et l'aperçu l'ajoutent telle quelle."""
    sys.path.insert(0, str(SK / "rendu" / "scripts"))
    import rendu as R
    import numpy as np
    sys.path.insert(0, str(P.EXE / "son"))
    Mu = SON["musique"]; Amb = Mu["ambiances"][ambiance]
    src = P.MOTEUR / "style" / Amb["fichier"]
    sortie = w / "sons" / f"musique-{ambiance}.wav"
    cle = hashlib.sha1(json.dumps([ambiance, N, Mu, (w / "filtre.txt").read_text(encoding="utf-8-sig"), src.stat().st_size]).encode()).hexdigest()[:12]
    meta = sortie.with_suffix(".json")
    if sortie.exists() and meta.exists() and lit(meta).get("cle") == cle:
        return {"fichier": str(sortie), "ambiance": ambiance, "cle": cle}
    ff = R.trouve_ffmpeg(); node = R.trouve_node(); biblio = R.bibliotheque(); C = R.constantes(node, biblio)
    info = lit(w / "info.json")
    cache = w / "rendu-cache"; cache.mkdir(exist_ok=True)
    v = R.voix_coupee(ff, w, info, N, C, cache)
    if isinstance(v, (str, Path)):
        x = subprocess.run([ff, "-v", "error", "-i", str(v), "-af", "pan=mono|c0=c0", "-ar", "48000", "-f", "f64le", "-"], capture_output=True, check=True)
        v = np.frombuffer(x.stdout, np.float64).copy()
    import son as S   # son.py du pipeline de Yoan (copie dans moteur/executeur/son) : musique() et boucle()
    m, mes = S.musique(len(v), v, ambiance)
    sortie.parent.mkdir(exist_ok=True)
    S.ecrire(m, sortie)
    ecrit(meta, {"cle": cle, "mesures": mes, "source": str(src.name)})
    return {"fichier": str(sortie), "ambiance": ambiance, "cle": cle}


def cmd_regarder(w, temps):
    """Une planche des images de la vidéo coupée aux instants donnés (s, temps de texte-plan.md), pour voir un geste de
    la main, un objet, la place libre autour de lui (regarder.py du planificateur de Yoan). Écrit animations-yoan/regard.png."""
    from PIL import Image, ImageDraw
    if not temps: echec(2, "REGARDER : donne 1 à 8 instants en secondes")
    T = Tete(w); ims = []
    for t in temps[:8]:
        im = Image.fromarray(T._image(img(float(t)))).resize((270, 480)); ImageDraw.Draw(im).text((8, 8), f"{float(t):.1f} s", fill=(255, 220, 0)); ims.append(im)
    T.fin()
    pl = Image.new("RGB", (270 * min(4, len(ims)), 480 * ((len(ims) + 3) // 4)))
    for k, im in enumerate(ims): pl.paste(im, (270 * (k % 4), 480 * (k // 4)))
    d = w / "animations-yoan"; d.mkdir(exist_ok=True); pl.save(d / "regard.png")
    dire(f"PRÊT {d / 'regard.png'} ({len(ims)} images) : regarde-la avec Read")


def main():
    if len(sys.argv) >= 3 and sys.argv[1] == "regarder":
        return cmd_regarder(P.dossier_de(sys.argv[2]), sys.argv[3:])
    if len(sys.argv) < 3 or sys.argv[1] not in ("texte", "valider", "zooms", "calques", "sons"):
        echec(2, __doc__)
    w = P.dossier_de(sys.argv[2])
    if not (w / "words.cut.json").exists(): echec(2, f"DOSSIER_INCONNU : {w} (couper-silences d'abord)")
    try:
        P.style_video(w)   # réglages de CETTE vidéo (style-video.json, clé « style ») ; sans fichier, rien ne change
        {"texte": cmd_texte, "valider": cmd_valider, "zooms": cmd_zooms, "calques": cmd_calques, "sons": cmd_sons}[sys.argv[1]](w)
    except P.PlanFaux as e:
        echec(3, str(e))
    except VT.Faute as e:
        echec(3, f"PLAN_REFUSÉ {e}")


if __name__ == "__main__":
    main()
