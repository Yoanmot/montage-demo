#!/usr/bin/env python3
"""ecran_partage.py : la brique « écran partagé » du monteur de Yoan (skill ecran-partage).

Le format : sa caméra en haut (l'iPhone, son micro), son écran en bas (un enregistrement de la fenêtre du navigateur,
fait en même temps sur le Mac). Les deux fichiers sont filmés séparément ; cette brique les cale l'un sur l'autre par le
son, choisit le cadre de chaque moitié et écrit `<nom>-montage/ecran-partage.json`. Elle ne fabrique aucune vidéo :
l'image composée est faite par la brique rendu (aperçu, planche, rendu final) dans son propre passage, depuis les deux
originaux, AVANT les coupes de couper-silences. Une coupe s'applique donc aux deux moitiés en même temps.

  ecran_partage.py preparer <dossier>-montage <enregistrement d'écran> [--decalage S]
      synchro par le son (corrélation des deux pistes ; refus si elle n'est pas sûre), cadre de la caméra sur son
      visage (Apple Vision), cadre de l'écran (rempli ou ajusté sans déformation), écrit ecran-partage.json.
      --decalage S : décalage donné à la main (secondes de l'écran pour la première image de la caméra), sans mesure.
  ecran_partage.py synchro <video camera> <enregistrement d'écran>
      la mesure seule (rien n'est écrit) : décalage, précision, accord des passages.
  ecran_partage.py image <dossier>-montage <instant source en s> <sortie.png>
      une image composée (1080 x 1920) à cet instant de la vidéo de la caméra, pour regarder un cadre.

Sorties : PRÊT ... ; codes : 2 fichier manquant ou illisible, 3 synchro impossible ou pas sûre (le message dit
pourquoi et quoi faire), 5 échec d'un outil, 7 outil manquant.

Conventions de temps (toutes en secondes) : `debut_ecran_s` = l'instant de l'enregistrement d'écran (depuis sa
première image) qui correspond à la première image de la caméra. Négatif : l'écran a commencé après la caméra (son
début est complété par sa première image figée).
"""
import json, math, os, re, shutil, subprocess, sys, tempfile
from datetime import datetime
from pathlib import Path

FPS = 30
W, H = 1080, 1920
HAUT = 960                      # hauteur de chaque moitié ; la jointure est à y 960
FICHIER = "ecran-partage.json"
SR = 8000                       # fréquence d'analyse du son pour la synchro
DECALAGE_MAX = 120.0            # s : on cherche le décalage dans ±2 minutes (les deux enregistrements partent ensemble)
RAPPORT_MIN = 3.0               # pic de corrélation au moins 3 fois plus haut que le meilleur autre pic
ACCORD_MAX = 0.040              # s : écart toléré entre le décalage global et celui de chaque passage
PASSAGE = 12.0                  # s : longueur d'un passage de contrôle
RECOUVREMENT_MIN = 6.0          # s de son commun au minimum
REMPLIR_PERTE = 0.12            # un écran dont le cadre perdrait au plus 12 % de largeur ou de hauteur est rempli
TETE_CIBLE = 470.0              # px : hauteur cheveux-menton visée dans la moitié haute (1080 x 960)
CHEVEUX_CIBLE = 350.0           # px : haut des cheveux dans la moitié haute : le CTA (consigne, mot, ligne du bas : ~300 px)
                                #      tient au-dessus de sa tête, et la tête passe devant la 2e ligne du titre du hook
ZOOM_MAX = 1.6                  # au plus 1,6 fois plus serré que la largeur de la caméra (au-delà, l'image s'abîme)
# Le style du format pour les animations de Yoan (fusionné sous son style-video.json, qui passe devant) : ce qui se pose
# d'habitude sur son visage ou sa poitrine va sur la jointure, entre son menton et le haut de l'écran.
STYLE_FORMAT = {
    "sousTitres": {"top": 882,                   # bloc de 2 lignes de 70 px (interligne 1,12) centré sur y 960
                   "accentFort": {"top": 856}},  # 2 lignes de 104 px centrées sur la jointure
    "hook": {"secondaire": {"centreY": 960}},    # le hook secondaire (d'habitude sur sa poitrine, y 1390)
}


def dire(m=""):
    print(m, flush=True)


class Refus(Exception):
    def __init__(self, code, message, sortie=3):
        super().__init__(message)
        self.code, self.message, self.sortie = code, message, sortie


def echec(code, m):
    dire(m); sys.exit(code)


# ------------------------------------------------------------------------------------------------ outils
def ffmpeg():
    for c in [os.environ.get("FFMPEG"), shutil.which("ffmpeg"), "/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"]:
        if c and Path(c).exists():
            return c
    raise Refus("OUTIL_MANQUANT", "OUTIL_MANQUANT ffmpeg : installe ffmpeg (brew install ffmpeg).", 7)


def ffprobe():
    f = Path(ffmpeg()).with_name("ffprobe")
    return str(f) if f.exists() else (shutil.which("ffprobe") or "ffprobe")


def sonde(fichier):
    """Flux d'un fichier : largeur et hauteur affichées (rotation comprise), débuts de la vidéo et du son, durée."""
    r = subprocess.run([ffprobe(), "-v", "error", "-show_entries",
                        "stream=index,codec_type,width,height,start_time,duration:stream_side_data=rotation:format=duration,start_time",
                        "-of", "json", str(fichier)], capture_output=True, text=True)
    if r.returncode != 0:
        raise Refus("FICHIER_ILLISIBLE", f"FICHIER_ILLISIBLE : {fichier} n'est pas une vidéo lisible.", 2)
    d = json.loads(r.stdout or "{}")
    v = next((s for s in d.get("streams", []) if s.get("codec_type") == "video"), None)
    a = next((s for s in d.get("streams", []) if s.get("codec_type") == "audio"), None)
    if not v:
        raise Refus("FICHIER_ILLISIBLE", f"FICHIER_ILLISIBLE : {fichier} n'a pas d'image.", 2)
    rot = 0
    for sd in v.get("side_data_list") or []:
        if "rotation" in sd:
            rot = int(float(sd["rotation"]))
    w_, h_ = int(v["width"]), int(v["height"])
    if abs(rot) % 180 == 90:
        w_, h_ = h_, w_
    f = lambda x, d=0.0: float(x) if x not in (None, "N/A") else d
    fmt = d.get("format", {})
    return dict(largeur=w_, hauteur=h_, video0=f(v.get("start_time")), son0=f(a.get("start_time")) if a else None,
                debut=f(fmt.get("start_time")), duree=f(fmt.get("duration")), son=a is not None)


# ------------------------------------------------------------------------------------------------ synchro par le son
def lit_son(fichier):
    """Le son en mono, 8 kHz, flottant, depuis son premier échantillon (instant `son0` du fichier)."""
    import numpy as np
    r = subprocess.run([ffmpeg(), "-nostdin", "-v", "error", "-i", str(fichier), "-vn", "-map", "0:a:0", "-ac", "1",
                        "-ar", str(SR), "-f", "f32le", "-"], capture_output=True)
    if r.returncode != 0:
        raise Refus("SON_ILLISIBLE", f"SON_ILLISIBLE : je n'arrive pas à lire le son de {Path(fichier).name}.", 2)
    x = np.frombuffer(r.stdout, np.float32).astype(np.float64)
    if len(x) < SR:
        raise Refus("SON_TROP_COURT", f"SYNCHRO_IMPOSSIBLE : le son de {Path(fichier).name} dure moins d'une seconde.")
    return x - x.mean()


def _blanchi(x):
    """Passe-haut doux (le grave des deux micros diffère le plus) ; le reste est fait par la pondération PHAT."""
    import numpy as np
    y = np.empty_like(x); y[0] = x[0]; y[1:] = x[1:] - 0.97 * x[:-1]
    return y


def correlation(a, b, max_lag):
    """GCC-PHAT : rend (lags en échantillons, corrélation) pour b(t + lag) ~ a(t), lag dans ±max_lag."""
    import numpy as np
    n = 1 << int(math.ceil(math.log2(len(a) + len(b))))
    A = np.fft.rfft(_blanchi(a), n); B = np.fft.rfft(_blanchi(b), n)
    X = B * np.conj(A)
    X /= np.abs(X) + 1e-12
    c = np.fft.irfft(X, n)
    m = min(int(max_lag), n // 2 - 1)
    lags = np.concatenate([np.arange(-m, 0), np.arange(0, m + 1)])
    vals = np.concatenate([c[-m:], c[:m + 1]])
    return lags, vals


def pic(lags, vals, exclure):
    """Le plus haut pic (affiné par une parabole), et le rapport au meilleur autre pic hors de ±exclure échantillons."""
    import numpy as np
    i = int(np.argmax(vals))
    p1 = float(vals[i])
    masque = np.abs(lags - lags[i]) > exclure
    p2 = float(vals[masque].max()) if masque.any() else 0.0
    d = 0.0
    if 0 < i < len(vals) - 1:
        y0, y1, y2 = vals[i - 1], vals[i], vals[i + 1]
        den = y0 - 2 * y1 + y2
        if den < 0:
            d = 0.5 * (y0 - y2) / den
    return float(lags[i]) + d, p1, (p1 / p2 if p2 > 1e-12 else float("inf"))


def mesurer(camera, ecran):
    """Décalage du son de l'écran par rapport à celui de la caméra : L (s) tel que écran(t + L) = caméra(t), temps
    comptés depuis le premier échantillon de chaque piste. Contrôlé sur des passages indépendants. Refus si pas sûr."""
    import numpy as np
    sc, se = sonde(camera), sonde(ecran)
    if not sc["son"]:
        raise Refus("SANS_SON", "SYNCHRO_IMPOSSIBLE : la vidéo de ta caméra n'a pas de son. Je cale les deux vidéos sur le son : "
                                "filme avec le micro de l'iPhone allumé.")
    if not se["son"]:
        raise Refus("SANS_SON", "SYNCHRO_IMPOSSIBLE : l'enregistrement d'écran n'a pas de son. Dans l'enregistreur d'écran, "
                                "garde le micro du Mac dans les sources audio, puis refilme.")
    a, b = lit_son(camera), lit_son(ecran)
    if float(np.sqrt((a ** 2).mean())) < 1e-4 or float(np.sqrt((b ** 2).mean())) < 1e-4:
        raise Refus("SON_MUET", "SYNCHRO_IMPOSSIBLE : une des deux pistes est muette (micro coupé ?) : rien pour les caler.")
    lags, vals = correlation(a, b, DECALAGE_MAX * SR)
    L, p1, rapport = pic(lags, vals, int(0.1 * SR))
    Ls = L / SR
    # Ce que les deux pistes ont en commun (temps de la caméra)
    t0, t1 = max(0.0, -Ls), min(len(a) / SR, len(b) / SR - Ls)
    if t1 - t0 < RECOUVREMENT_MIN:
        raise Refus("PAS_ASSEZ", f"SYNCHRO_IMPOSSIBLE : les deux enregistrements n'ont que {max(0.0, t1 - t0):.1f} s en commun "
                                 f"(il en faut {RECOUVREMENT_MIN:g}) : ce n'est sans doute pas le même tournage.")
    # Passages de contrôle : jusqu'à 5, répartis sur le son commun, chacun mesuré seul autour du décalage global
    n = max(1, min(5, int((t1 - t0) // PASSAGE)))
    passages = []
    for k in range(n):
        c0 = t0 + (t1 - t0) * (k + 0.5) / n - PASSAGE / 2
        c0 = max(t0, min(c0, t1 - PASSAGE)) if t1 - t0 > PASSAGE else t0
        c1 = min(t1, c0 + PASSAGE)
        ia, ja = int(c0 * SR), int(c1 * SR)
        marge = int(0.5 * SR)
        ib, jb = int((c0 + Ls) * SR) - marge, int((c1 + Ls) * SR) + marge
        ib0 = max(0, ib)
        seg_a, seg_b = a[ia:ja], b[ib0:max(ib0, jb)]
        if len(seg_a) < SR or len(seg_b) < SR or np.sqrt((seg_a ** 2).mean()) < 1e-4:
            continue
        lg, vl = correlation(seg_a, seg_b, len(seg_b))
        # lg : décalage dans le morceau ; décalage absolu = lg + ib0 - ia
        absolu = lg + ib0 - ia
        garde = np.abs(absolu - L) <= 0.5 * SR
        if not garde.any():
            continue
        l_k, _, r_k = pic(absolu[garde], vl[garde], int(0.05 * SR))
        passages.append(dict(debut_s=round(c0, 2), fin_s=round(c1, 2), decalage_s=round(l_k / SR, 4), rapport=round(min(r_k, 99.0), 2)))
    surs = [p for p in passages if abs(p["decalage_s"] - Ls) <= ACCORD_MAX]
    ecart = max((abs(p["decalage_s"] - Ls) for p in passages), default=0.0)
    derive = (max(p["decalage_s"] for p in surs) - min(p["decalage_s"] for p in surs)) if surs else 0.0
    mesure = dict(decalage_s=round(Ls, 4), rapport_pic=round(min(rapport, 99.0), 2), passages=passages,
                  passages_d_accord=len(surs), ecart_max_ms=round(ecart * 1000, 1), derive_ms=round(derive * 1000, 1),
                  commun_s=round(t1 - t0, 1), camera=sc, ecran=se)
    besoin = 1 if n == 1 else max(2, math.ceil(0.6 * len(passages)))
    if rapport < RAPPORT_MIN or len(surs) < besoin:
        raison = (f"le meilleur calage n'est que {rapport:.1f} fois au-dessus des autres (il faut {RAPPORT_MIN:g})" if rapport < RAPPORT_MIN
                  else f"seulement {len(surs)} passage(s) sur {len(passages)} donnent le même calage à {ACCORD_MAX * 1000:.0f} ms près")
        raise Refus("SYNCHRO_INCERTAINE", "SYNCHRO_INCERTAINE : je n'arrive pas à caler l'enregistrement d'écran sur ta vidéo par le son "
                                         f"({raison}). Vérifie que c'est le bon enregistrement d'écran, avec le micro du Mac allumé ; "
                                         "au prochain tournage, un clap des mains au début aide.", 3)
    mesure["precision_ms"] = round(max(1000.0 / SR, ecart * 1000, derive * 1000), 1)
    return mesure


# ------------------------------------------------------------------------------------------------ cadres
def _extrait(fichier, t, largeur, sdr=""):
    """Une image (RGB numpy) du fichier à l'instant t (s depuis le début du fichier), mise à `largeur` de large."""
    import numpy as np
    from PIL import Image
    with tempfile.TemporaryDirectory(prefix="ecran-partage-") as d:
        png = Path(d) / "i.png"
        vf = (sdr + "," if sdr else "") + f"scale={largeur}:-2:flags=bicubic"
        r = subprocess.run([ffmpeg(), "-nostdin", "-v", "error", "-y", "-ss", f"{max(0.0, t):.4f}", "-i", str(fichier),
                            "-frames:v", "1", "-vf", vf, str(png)], capture_output=True)
        if r.returncode != 0 or not png.exists():
            return None
        return np.asarray(Image.open(png).convert("RGB"))


def _cgimage(rgb):
    import Quartz
    import numpy as np
    rgb = np.ascontiguousarray(rgb); h, w = rgb.shape[:2]; data = rgb.tobytes()
    prov = Quartz.CGDataProviderCreateWithData(None, data, len(data), None)
    return Quartz.CGImageCreate(w, h, 8, 24, w * 3, Quartz.CGColorSpaceCreateDeviceRGB(), Quartz.kCGImageAlphaNone, prov, None,
                                False, Quartz.kCGRenderingIntentDefault)


def _visage(rgb):
    """(haut des cheveux, bas du visage, centre x) en px de l'image, par Apple Vision ; None si personne."""
    import numpy as np
    import Quartz, Vision
    from PIL import Image
    cg = _cgimage(rgb); h, w = rgb.shape[:2]
    req = Vision.VNDetectFaceRectanglesRequest.alloc().init()
    Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(cg, {}).performRequests_error_([req], None)
    if not req.results():
        return None
    b = max(req.results(), key=lambda r: r.boundingBox().size.width).boundingBox()
    cx = (b.origin.x + b.size.width / 2) * w
    bas = (1 - b.origin.y) * h
    haut_visage = (1 - b.origin.y - b.size.height) * h
    # le haut des cheveux : masque de personne Apple Vision dans une bande autour du visage
    seg = Vision.VNGeneratePersonSegmentationRequest.alloc().initWithCompletionHandler_(None)
    seg.setQualityLevel_(0)
    seg.setOutputPixelFormat_(Quartz.kCVPixelFormatType_OneComponent8)
    hd = Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(cg, {})
    ok, _ = hd.performRequests_error_([seg], None)
    cheveux = max(0.0, haut_visage - 0.45 * b.size.height * h)
    if ok and seg.results():
        pb = seg.results()[0].pixelBuffer()
        mw = Quartz.CVPixelBufferGetWidth(pb); mh = Quartz.CVPixelBufferGetHeight(pb)
        Quartz.CVPixelBufferLockBaseAddress(pb, 1)
        bpr = Quartz.CVPixelBufferGetBytesPerRow(pb)
        arr = np.frombuffer(Quartz.CVPixelBufferGetBaseAddress(pb).as_buffer(bpr * mh), dtype=np.uint8).reshape(mh, bpr)[:, :mw].copy()
        Quartz.CVPixelBufferUnlockBaseAddress(pb, 1)
        m = np.asarray(Image.fromarray(arr).resize((w, h), Image.BILINEAR)) > 127
        x0, x1 = int(max(0, cx - b.size.width * w * 0.4)), int(min(w, cx + b.size.width * w * 0.4))
        rows = np.where(m[:, x0:x1].any(1))[0]
        rows = rows[rows < haut_visage] if len(rows) else rows
        if len(rows):
            cheveux = float(rows[0])
    return cheveux, bas, cx


def conversion_sdr(camera, w):
    """La conversion HDR -> SDR du rendu pour une caméra d'iPhone en HDR (table dans rendu-cache), « » sinon."""
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "rendu" / "scripts"))
    import rendu as R
    cache = Path(w) / "rendu-cache"; cache.mkdir(parents=True, exist_ok=True)
    return R.vers_sdr(ffmpeg(), camera, cache)


def instants_garde(w, duree):
    """Instants (s, vidéo de la caméra) où regarder le visage : au milieu des passages gardés par les coupes s'il y en
    a, sinon répartis sur la vidéo."""
    e = Path(w) / "edl.json"
    try:
        segs = json.loads(e.read_text())["segments"]
        ts = [(s["srcInF"] + s["srcOutF"]) / 2 / FPS for s in segs if s["srcOutF"] - s["srcInF"] >= FPS // 2]
        if ts:
            pas = max(1, len(ts) // 7)
            return ts[::pas][:9]
    except Exception:
        pass
    return [duree * (k + 0.5) / 7 for k in range(7)]


def cadre_camera(camera, w, sc):
    """Le cadre de la caméra pour la moitié haute (rapport 9:8) : centré sur son visage, cheveux vers y 350 de la moitié,
    tête et épaules à la taille de son cadre habituel ; fixe pendant toute la vidéo. En px de la caméra (rotation comprise)."""
    W0, H0 = sc["largeur"], sc["hauteur"]
    sdr = conversion_sdr(camera, w)
    ech = 1080.0 / W0
    Hs = H0 * ech
    mesures = []
    for t in instants_garde(w, sc["duree"]):
        img = _extrait(camera, t, 1080, sdr)
        if img is None:
            continue
        try:
            v = _visage(img)
        except Exception:
            v = None
        if v:
            mesures.append(v)
    note = None
    if mesures:
        med = lambda i: sorted(m[i] for m in mesures)[len(mesures) // 2]
        cheveux, menton, cx = med(0), med(1), med(2)
        tete = max(60.0, menton - cheveux)
        z = max(1.0, min(ZOOM_MAX, TETE_CIBLE / tete))
    else:
        cheveux, menton, cx, z = Hs * 0.2, Hs * 0.45, 540.0, 1.0
        note = "visage introuvable sur la caméra : cadre centré en haut de l'image"
    cw, ch = 1080.0 / z, HAUT / z
    if ch > Hs:   # caméra paysage très basse : on prend toute la hauteur
        ch = Hs; cw = ch * 1080.0 / HAUT
    x0 = max(0.0, min(cx - cw / 2, 1080.0 - cw))
    y0 = max(0.0, min(cheveux - CHEVEUX_CIBLE / z, Hs - ch))
    pair = lambda v: int(round(v / ech / 2)) * 2
    c = dict(x=pair(x0), y=pair(y0), largeur=pair(cw), hauteur=pair(ch))
    c["largeur"] = min(c["largeur"], W0 - c["x"]); c["hauteur"] = min(c["hauteur"], H0 - c["y"])
    vu = dict(cheveux_y=round((cheveux - y0) * z), menton_y=round((menton - y0) * z), zoom=round(z, 3), mesures=len(mesures))
    return c, vu, note


def cadre_ecran(ecran, se):
    """Remplir la moitié basse (léger recadrage au centre) si l'écran a presque son rapport, sinon l'ajuster entier sur
    un fond de la couleur de ses bords. Jamais déformé."""
    import numpy as np
    r_e, r_t = se["largeur"] / se["hauteur"], W / HAUT
    perte = 1 - min(r_e, r_t) / max(r_e, r_t)
    mode = "remplir" if perte <= REMPLIR_PERTE else "ajuster"
    fond = "#000000"
    img = _extrait(ecran, se["duree"] / 2, min(1080, se["largeur"]))
    if img is not None:
        bord = np.concatenate([img[0], img[-1], img[:, 0], img[:, -1]]).astype(int)
        r, g, b = (int(np.median(bord[:, k])) for k in range(3))
        fond = f"#{r:02x}{g:02x}{b:02x}"
    return dict(mode=mode, fond=fond, largeur=se["largeur"], hauteur=se["hauteur"], perte=round(perte, 3))


# ------------------------------------------------------------------------------------------------ le fichier du dossier
def actif(w):
    return (Path(w) / FICHIER).exists()


def lire(w):
    p = Path(w) / FICHIER
    try:
        d = json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:
        raise Refus("ECRAN_PARTAGE_ILLISIBLE", f"ECRAN_PARTAGE_ILLISIBLE : {p} ({e}) : relance « ecran_partage.py preparer ».", 3)
    for k in ("ecran", "debut_ecran_s", "camera", "cadre_ecran"):
        if k not in d:
            raise Refus("ECRAN_PARTAGE_ILLISIBLE", f"ECRAN_PARTAGE_ILLISIBLE : {p} sans « {k} » : relance « ecran_partage.py preparer ».", 3)
    d["ecran"] = str(fichier_ecran(w, d))
    return d


def fichier_ecran(w, d):
    """L'enregistrement d'écran : le chemin noté, sinon le même nom dans le dossier ecran/ du contenu (dossier déplacé)."""
    note = Path(str(d["ecran"]))
    if note.is_file():
        return note
    voisin = Path(w).resolve().parent.parent / "ecran" / note.name
    if voisin.is_file():
        return voisin
    raise Refus("ECRAN_INTROUVABLE", f"ECRAN_INTROUVABLE : {note} (l'enregistrement d'écran a été déplacé ?)", 2)


def _chemin_graphe(p):
    s = str(p)
    if any(c in s for c in "'\\\n"):
        raise Refus("CHEMIN_ILLISIBLE", f"CHEMIN_ILLISIBLE : le nom de l'enregistrement d'écran contient une apostrophe ou un "
                                        f"caractère que le rendu ne sait pas lire : renomme-le ({Path(s).name}).", 2)
    return s


def _couleur(h):
    return "0x" + h.lstrip("#")


def chaine_camera(d, sdr="", etalonnage=None):
    c = d["camera"]
    p = ([sdr] if sdr else []) + [f"crop={c['largeur']}:{c['hauteur']}:{c['x']}:{c['y']}",
                                  f"scale={W}:{HAUT}:flags=lanczos", "setsar=1"]
    if etalonnage and etalonnage != "null":
        p.append(etalonnage)
    p.append("format=yuv420p")
    return ",".join(p)


def chaine_cadre_ecran(d):
    e = d["cadre_ecran"]
    sc = f"scale={W}:{HAUT}:force_original_aspect_ratio={'increase' if e['mode'] == 'remplir' else 'decrease'}:flags=lanczos:out_color_matrix=bt709:out_range=tv"
    fin = f"crop={W}:{HAUT}" if e["mode"] == "remplir" else f"pad={W}:{HAUT}:(ow-iw)/2:(oh-ih)/2:color={_couleur(e['fond'])}"
    return f"{sc},{fin},setsar=1,format=yuv420p"


def decalage_graphe(d):
    """K (s) : de combien avancer l'enregistrement d'écran (ses images comptées depuis sa première) pour qu'il tombe sur
    les instants de la caméra tels que ffmpeg les donne à [0:v] (depuis le début du fichier de la caméra)."""
    c0 = d.get("camera_video0_s", 0.0) - d.get("camera_debut_s", 0.0)
    return d["debut_ecran_s"] - c0


def substituer(filtre, w, sdr="", etalonnage=None):
    """filtre.txt (couper-silences) où [0:v] devient l'image composée : la caméra recadrée en haut (conversion HDR et
    étalonnage sur elle seule), l'écran calé par le son en bas, à 30 i/s sur la même grille. Les coupes qui suivent
    s'appliquent donc aux deux moitiés. Le son reste celui de la caméra ([0:a])."""
    d = lire(w)
    K = decalage_graphe(d)
    src = f"movie=filename='{_chemin_graphe(d['ecran'])}',setpts=PTS-STARTPTS"
    # garde l'image d'écran la plus proche de chaque instant de la caméra : celles jusqu'à une demi-image avant 0 restent
    cale = (f"{src},setpts=PTS-{K:.6f}/TB,select='gte(t,-{0.5 / FPS:.6f})'" if K >= 0
            else f"{src},tpad=start_duration={-K:.6f}:start_mode=clone")
    tete = (f"[0:v]{chaine_camera(d, sdr, etalonnage)},fps={FPS}:round=near[epc];\n"
            f"{cale},fps={FPS}:round=near,{chaine_cadre_ecran(d)},tpad=stop=-1:stop_mode=clone[epe];\n"
            f"[epc][epe]vstack=inputs=2:shortest=1,setsar=1[ep];\n")
    return tete + filtre.replace("[0:v]", "[ep]", 1)


def image(w, t, sortie, etalonnage=None):
    """Une image composée à l'instant t (s depuis le début du fichier de la caméra) : ce que montrera la vidéo, sans
    les coupes. Sert à mesurer la tête (titre derrière elle, CTA au-dessus) et à regarder un cadre."""
    d = lire(w)
    info = json.loads((Path(w) / "info.json").read_text())
    cam = Path(info["video"]); voisine = Path(w).parent / cam.name
    cam = voisine if voisine.is_file() else cam
    te = t + decalage_graphe(d)
    sdr = conversion_sdr(cam, w)
    g = (f"[0:v]{chaine_camera(d, sdr, etalonnage)}[c];[1:v]{chaine_cadre_ecran(d)}[e];[c][e]vstack=inputs=2[o]")
    r = subprocess.run([ffmpeg(), "-nostdin", "-v", "error", "-y", "-ss", f"{max(0.0, t):.4f}", "-i", str(cam),
                        "-ss", f"{max(0.0, te):.4f}", "-i", d["ecran"], "-filter_complex", g, "-map", "[o]", "-frames:v", "1",
                        str(sortie)], capture_output=True, text=True)
    if r.returncode != 0 or not Path(sortie).exists():
        raise Refus("IMAGE_RATEE", f"IMAGE_RATÉE : {r.stderr.strip()[-300:]}", 5)
    return Path(sortie)


# ------------------------------------------------------------------------------------------------ commandes
def preparer(w, ecran, decalage=None):
    w = Path(w).expanduser().resolve()
    if not (w / "info.json").exists():
        raise Refus("DOSSIER_INCONNU", f"DOSSIER_INCONNU : {w} n'est pas un dossier de montage (couper-silences d'abord : "
                                       "transcrire la vidéo de la caméra).", 2)
    ecran = Path(ecran).expanduser().resolve()
    if not ecran.is_file():
        raise Refus("ECRAN_INTROUVABLE", f"ECRAN_INTROUVABLE : {ecran}", 2)
    _chemin_graphe(ecran)
    info = json.loads((w / "info.json").read_text())
    cam = Path(info["video"]); voisine = w.parent / cam.name
    cam = voisine if voisine.is_file() else cam
    if not cam.is_file():
        raise Refus("VIDEO_INTROUVABLE", f"VIDÉO_INTROUVABLE : {info.get('video')}", 2)
    sc, se = sonde(cam), sonde(ecran)
    if decalage is None:
        m = mesurer(cam, ecran)
        L = m["decalage_s"]
        # instant de l'écran (depuis sa première image) pour la première image de la caméra
        debut = L + (se["son0"] or 0.0) - (sc["son0"] or 0.0) + sc["video0"] - se["video0"]
        synchro = {k: m[k] for k in ("decalage_s", "precision_ms", "rapport_pic", "passages", "passages_d_accord", "ecart_max_ms",
                                     "derive_ms", "commun_s")}
        synchro["methode"] = "son"
    else:
        debut = float(decalage)
        synchro = {"methode": "à la main", "decalage_s": debut}
    camera, vu, note = cadre_camera(cam, w, sc)
    cadre = cadre_ecran(ecran, se)
    fin_ecran = se["duree"] - debut   # temps de la caméra où l'écran s'arrête
    d = dict(version=1, ecran=str(ecran), debut_ecran_s=round(debut, 4), camera_video0_s=sc["video0"], camera_debut_s=sc["debut"],
             son="camera", camera=camera, cadre_camera=vu, cadre_ecran=cadre, jointure_y=HAUT, synchro=synchro,
             style=STYLE_FORMAT,
             _style="réglages du format pour les animations de Yoan (sous-titres sur la jointure) ; style-video.json passe devant",
             fait_le=datetime.now().astimezone().isoformat(timespec="seconds"))
    avert = []
    if note:
        avert.append(note)
    if -debut > 1.0:
        avert.append(f"l'écran a commencé {-debut:.1f} s après la caméra : sa première image reste figée au début")
    if fin_ecran < sc["duree"] - 1.0:
        avert.append(f"l'écran s'arrête à {fin_ecran:.1f} s de la caméra (elle dure {sc['duree']:.1f} s) : sa dernière image reste figée après")
    d["avertissements"] = avert
    tmp = w / (FICHIER + ".tmp")
    tmp.write_text(json.dumps(d, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    tmp.rename(w / FICHIER)
    for a in avert:
        dire(f"AVERTISSEMENT {a}")
    s = d["synchro"]
    prec = f", sûr à {s['precision_ms']:g} ms près ({s['passages_d_accord']}/{len(s['passages'])} passages d'accord)" if s["methode"] == "son" else " (donné à la main)"
    dire(f"   caméra : cadre {camera['largeur']}x{camera['hauteur']} en ({camera['x']}, {camera['y']}), zoom {vu['zoom']}, "
         f"cheveux à y {vu['cheveux_y']}, menton à y {vu['menton_y']} de la moitié haute")
    dire(f"   écran : {cadre['largeur']}x{cadre['hauteur']}, {cadre['mode']}" + (f" sur fond {cadre['fond']}" if cadre["mode"] == "ajuster" else ""))
    dire(f"PRÊT écran partagé : l'écran commence {debut:+.3f} s par rapport à la caméra{prec} ; {w / FICHIER}")
    return d


def main():
    a = sys.argv[1:]
    try:
        if len(a) >= 3 and a[0] == "preparer":
            dec = None
            if "--decalage" in a:
                i = a.index("--decalage"); dec = float(a[i + 1]); a = a[:i] + a[i + 2:]
            preparer(a[1], a[2], dec)
        elif len(a) == 3 and a[0] == "synchro":
            m = mesurer(Path(a[1]), Path(a[2]))
            m.pop("camera"); m.pop("ecran")
            dire(json.dumps(m, ensure_ascii=False))
            dire(f"PRÊT synchro : décalage {m['decalage_s']:+.4f} s, sûr à {m['precision_ms']:g} ms près")
        elif len(a) == 4 and a[0] == "image":
            p = image(Path(a[1]).expanduser().resolve(), float(a[2]), a[3])
            dire(f"PRÊT {p}")
        else:
            echec(2, __doc__)
    except Refus as e:
        echec(e.sortie, e.message)
    except ImportError as e:
        echec(7, f"OUTIL_MANQUANT : {e} (pip3 install --user numpy pillow pyobjc-framework-Vision pyobjc-framework-Quartz)")


if __name__ == "__main__":
    main()
