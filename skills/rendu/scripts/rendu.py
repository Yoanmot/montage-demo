#!/usr/bin/env python3
"""rendu.py : fabrique la vidéo montée en un seul encodage depuis la vidéo d'origine (brique `rendu` du monteur).

Lit le dossier de travail <nom>-montage/ écrit par les autres briques (contrat : ../animations/CONTRAT.md, skill voisin) :
  coupes       filtre.txt, edl.json            (couper-silences)   obligatoire : la base de temps est la vidéo coupée
  zooms        zooms.txt                       (zooms)
  b-roll       b-roll.txt                      (b-roll)
  animations   calques.json (source animations) + calques/<id>/ (projets HyperFrames)
  sous-titres  calques.json (source sous-titres) + calques/<id>/
  sons         sons.json                       (sound-design)

Ordre de composition (CONTRAT, « Ordre de composition ») :
  1. plan caméra depuis l'original : coupes, zooms (à la définition de l'original), mise à la définition de
     sortie, décalage (demi-écran),
     étalonnage ETALONNAGE, flou (plein écran sur sa vidéo floutée) ;
  2. calques `derriere` troués par le masque de Romain (Apple Vision, calculé sur le plan coupé et zoomé, non
     étalonné), ou fond complet avec Romain détouré posé dessus (`plan.detoure`) ;
  3. B-rolls ; 4. calques `devant` par `ordre` croissant, sous-titres en dernier ;
  5. audio : voix loudnorm (-16 LUFS, -1,5 dBTP, LRA 11) plus les sons de sons.json à leurs niveaux, crête < -1 dBFS ;
  6. H.264 yuv420p bt709 en 1080 x 1920, sous le plafond de poids du style (RENDU.fullMaxMo), AAC 192 kb/s 48 kHz,
     faststart.
Vidéo HDR (iPhone HLG ou PQ) : convertie en SDR bt709 à l'entrée du graphe (même passage, aucun encodage de plus) ;
vidéo à 60 i/s ou à cadence variable : remise à 30 i/s par les coupes (filtre.txt).
Les calques (suites de PNG RGBA sans perte), les masques et la bande son sont des intermédiaires de calcul gardés dans
<dossier>/rendu-cache/ (réutilisés tant que leur source ne change pas, le reste est retiré après un rendu réussi) ;
l'image caméra n'est encodée qu'une fois.

Usage : python3 rendu.py <dossier>-montage <couches>     ex. : coupes,zooms,b-roll,animations,sous-titres,sons
Codes de sortie : 0 ok · 2 couche ou fichier manquant · 3 fichier d'une brique illisible · 4 calque impossible à rendre
                  5 rendu raté · 6 mix saturé · 7 outil manquant ou trop ancien
"""
import hashlib, json, math, os, re, shutil, subprocess, sys, time
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
COUCHES = ["coupes", "zooms", "b-roll", "animations", "sous-titres", "sons"]
FPS, SR = 30, 48000
BASE_W, BASE_H = 1080, 1920          # définition des calques (CONTRAT) et de sortie minimale
HYPERFRAMES = "hyperframes@0.7.55"


# Arrêt propre (2026-11-14 : un rendu interrompu laissait HyperFrames et son Chrome headless tourner seuls) : le rendu
# mène son propre groupe de processus ; sur Ctrl+C, SIGTERM ou SIGHUP, tout le groupe reçoit SIGTERM (HyperFrames ferme
# alors son navigateur), puis le script s'arrête.
import signal as _signal


def _arret(sig, _frame):
    for s_ in (_signal.SIGINT, _signal.SIGTERM, _signal.SIGHUP):
        _signal.signal(s_, _signal.SIG_IGN)
    try:
        os.killpg(os.getpgrp(), _signal.SIGTERM)
    except OSError:
        pass
    time.sleep(2)
    sys.exit(130 if sig == _signal.SIGINT else 143)


def _garder_les_enfants():
    try:
        if os.getpgrp() != os.getpid():
            os.setpgid(0, 0)
    except OSError:
        pass
    # Hors du groupe au premier plan, un enfant qui lit le Terminal resterait figé (arrêt SIGTTIN) : on lui
    # donne une entrée vide. Lancé depuis le Terminal par verifier.sh, le rendu attendait sans fin.
    try:
        if os.isatty(0):
            vide = os.open(os.devnull, os.O_RDONLY)
            os.dup2(vide, 0)
            os.close(vide)
    except OSError:
        pass
    for s_ in (_signal.SIGINT, _signal.SIGTERM, _signal.SIGHUP):
        _signal.signal(s_, _arret)
# Resserrement du masque (repris du labo, detourage.py et vert21.py) : sous le seuil bas le calque reste plein,
# au-dessus du seuil haut Romain passe devant, rampe douce entre les deux.
SERRE_TROU = (0.40, 0.80)
SERRE_DETOURE = (0.35, 0.85)
# Bord décontaminé du fond vert (vert21.py) : rayon du flou des couleurs, et px rognés sur l'intérieur sûr (en 1080).
DECONT_SIGMA, DECONT_ROGNE = 5, 2


def dire(m=""):
    print(m, flush=True)


def echec(code, m):
    print(m, flush=True)
    sys.exit(code)


def lit_json(p, code_err, nom):
    try:
        return json.loads(Path(p).read_text(encoding="utf-8-sig"))
    except Exception as e:
        echec(code_err, f"{nom}_ILLISIBLE : {Path(p).name} : {e}")


def video_de(w, info):
    """La vidéo d'origine : celle qui est à côté du dossier de montage (<nom>-montage à côté de <nom>.<ext>), sinon le
    chemin noté par couper-silences. Un dossier de montage copié avec sa vidéo (nouvelle version d'un test, vidéo
    déplacée avec son dossier) retrouve ainsi la sienne, pas l'ancienne."""
    noté = Path(str(info.get("video", "")))
    voisine = Path(w).parent / noté.name
    return voisine if noté.name and voisine.is_file() else noté


def empreinte(*morceaux):
    h = hashlib.sha1()
    for m in morceaux:
        h.update(m if isinstance(m, bytes) else str(m).encode())
        h.update(b"\0")
    return h.hexdigest()[:16]


def empreinte_dossier(d):
    h = hashlib.sha1()
    for f in sorted(p for p in Path(d).rglob("*") if p.is_file()):
        h.update(str(f.relative_to(d)).encode()); h.update(f.read_bytes())
    return h.hexdigest()[:16]


# ------------------------------------------------------------------------------------------------ outils
def trouve_ffmpeg():
    cands = [os.environ.get("RENDU_FFMPEG"), shutil.which("ffmpeg"), "/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"]
    for c in cands:
        if not c or not Path(c).exists():
            continue
        v = subprocess.run([c, "-hide_banner", "-version"], capture_output=True, text=True).stdout.split("\n")[0]
        m = re.search(r"version n?(\d+)\.", v)
        if m and int(m.group(1)) < 7:
            continue   # le rendu lit son graphe dans un fichier (« -/filter_complex ») : ffmpeg 7 au moins
        return c
    echec(7, "OUTIL_MANQUANT ffmpeg : il faut ffmpeg 7 ou plus (brew install ffmpeg).")


def trouve_node():
    n = shutil.which("node") or next((p for p in ["/opt/homebrew/bin/node", "/usr/local/bin/node"] if Path(p).exists()), None)
    if not n:
        echec(7, "OUTIL_MANQUANT node : Node.js est nécessaire pour les calques et les constantes du style (brew install node).")
    return n


def bibliotheque():
    for c in [os.environ.get("RENDU_BIBLIOTHEQUE"), SKILL.parent / "animations" / "bibliotheque"]:
        if c and (Path(c) / "commun.mjs").exists():
            return Path(c)
    echec(2, "BIBLIOTHEQUE_INTROUVABLE : le skill animations (et sa bibliothèque du style) doit être installé à côté de rendu.")


def constantes(node, biblio):
    code = ("import(require('url').pathToFileURL(process.argv[1]).href)"
            ".then(m=>console.log(JSON.stringify({ETALONNAGE:m.ETALONNAGE,SONS:m.SONS,RENDU:m.RENDU,POLICES:m.POLICES,STYLE:m.STYLE||{}})))")
    r = subprocess.run([node, "-e", code, str(biblio / "commun.mjs")], capture_output=True, text=True)
    if r.returncode != 0:
        echec(7, f"OUTIL_MANQUANT : lecture de commun.mjs impossible : {r.stderr.strip()[:300]}")
    return json.loads(r.stdout)


def fichier_style(C, biblio, sous, nom):
    """Un son ou une police : celui du style du client (commun.mjs, STYLE) s'il l'a, sinon celui de la bibliothèque."""
    f = Path(str(nom))
    if f.is_absolute():
        return f
    d = (C.get("STYLE") or {}).get("dossier")
    if d and (Path(d) / sous / f).exists():
        return Path(d) / sous / f
    return biblio / sous / f


# ------------------------------------------------------------------------------------------------ lecture du dossier
def calques_demandes(w, sources, total):
    p = w / "calques.json"
    if not p.exists():
        echec(2, f"COUCHE_MANQUANTE {', '.join(sources)} : calques.json absent (lance d'abord la brique {sources[0]}).")
    liste = lit_json(p, 3, "CALQUES").get("calques")
    if not isinstance(liste, list):
        echec(3, "CALQUES_ILLISIBLE : calques.json doit contenir une liste « calques ».")
    vus, retenus = set(), []
    for i, c in enumerate(liste):
        cid = c.get("id")
        if not cid or cid in vus:
            echec(3, f"CALQUES_ILLISIBLE : calque n°{i + 1} sans id ou id en double ({cid}).")
        vus.add(cid)
        if c.get("source") not in sources:
            continue
        d = (w / str(c.get("dossier", ""))).resolve()
        if not (d / "index.html").exists():
            echec(2, f"CALQUE_INTROUVABLE {cid} : {d}/index.html absent.")
        try:
            debut, images = int(c["debut"]), int(c["images"])
        except Exception:
            echec(3, f"CALQUES_ILLISIBLE : calque {cid}, « debut » et « images » doivent être des nombres d'images.")
        if debut < 0 or images < 1 or debut >= total:
            echec(3, f"CALQUES_ILLISIBLE : calque {cid}, images {debut} à {debut + images - 1} hors de la vidéo coupée (0 à {total - 1}).")
        if debut + images > total:
            dire(f"  attention : calque {cid} dépasse la fin de la vidéo de {debut + images - total} images, coupé à la fin.")
            images = total - debut
        couche = c.get("couche")
        if couche not in ("devant", "derriere"):
            echec(3, f"CALQUES_ILLISIBLE : calque {cid}, couche « {couche} » inconnue (devant ou derriere).")
        plan = c.get("plan") or {}
        for k in plan:
            if k not in ("flou", "decalage_y", "detoure"):
                echec(3, f"CALQUES_ILLISIBLE : calque {cid}, effet de plan « {k} » inconnu (flou, decalage_y, detoure).")
        if plan.get("detoure") and couche != "derriere":
            echec(3, f"CALQUES_ILLISIBLE : calque {cid}, « detoure » demande la couche derriere.")
        decal = None
        if "decalage_y" in plan:
            fp = Path(plan["decalage_y"]); fp = fp if fp.is_absolute() else w / fp
            if not fp.exists():
                fp2 = d / plan["decalage_y"]
                fp = fp2 if fp2.exists() else fp
            if not fp.exists():
                echec(2, f"CALQUE_INTROUVABLE {cid} : fichier de décalage {plan['decalage_y']} absent.")
            decal = lit_json(fp, 3, "CALQUES")
            decal = decal.get("decalage", decal) if isinstance(decal, dict) else decal
            if not isinstance(decal, list) or not decal:
                echec(3, f"CALQUES_ILLISIBLE : calque {cid}, le décalage doit être une liste (un px par image du calque).")
            decal = [float(x) for x in decal[:images]] + [0.0] * max(0, images - len(decal))
        flou = plan.get("flou")
        if flou is not None:
            try:
                f0 = int(flou.get("debut", 0)); f1 = int(flou.get("fin", images))
                flou = dict(rayon=float(flou["rayon"]), assombrir=float(flou["assombrir"]), debut=max(0, f0), fin=min(images, f1))
            except Exception:
                echec(3, f"CALQUES_ILLISIBLE : calque {cid}, flou = {{ \"rayon\": px, \"assombrir\": 0..1 }}.")
        retenus.append(dict(id=cid, source=c["source"], dossier=d, debut=debut, images=images, couche=couche,
                            ordre=float(c.get("ordre", 50)), flou=flou, decalage=decal, detoure=bool(plan.get("detoure"))))
    if "sous-titres" in sources:
        # les sous-titres retirent leurs groupes pendant les calques qui portent leur propre ligne (masque_sous_titres) :
        # s'ils ont été préparés avant ces calques (ou avant qu'ils bougent), on aurait deux lignes l'une sur l'autre.
        st = [c for c in liste if c.get("source") == "sous-titres"]
        voulu = sorted((c["id"], int(c["debut"]), int(c["images"])) for c in liste
                       if c.get("masque_sous_titres") is True and c.get("source") != "sous-titres")
        for c in st:
            fait = sorted((m["id"], int(m["debut"]), int(m["images"])) for m in c.get("masques") or [])
            if fait != voulu:
                echec(2, "SOUS-TITRES_PÉRIMÉS : des calques portent leur propre ligne de sous-titre "
                         f"({', '.join(v[0] for v in voulu) or 'aucun'}) mais les sous-titres ont été préparés pour "
                         f"({', '.join(v[0] for v in fait) or 'aucun'}) : relance sous-titres preparer, puis le rendu.")
    for s in sources:
        if not any(c["source"] == s for c in retenus):
            echec(2, f"COUCHE_MANQUANTE {s} : aucun calque de la brique {s} dans calques.json (lance-la d'abord).")
    return retenus


# ------------------------------------------------------------------------------------------------ calques HyperFrames
def id_cache(p):
    """Id d'un fichier ou dossier du cache nommé <id>-<empreinte de 16 caractères>[.ext] (None sinon). Un id peut
    contenir des tirets (a01-derriere) : on coupe sur le dernier."""
    nom = p.name.split(".")[0]
    i, _, h = nom.rpartition("-")
    return i if i and re.fullmatch(r"[0-9a-f]{16}", h) else None


def rend_calque(c, cache, ff):
    """Rend le projet HyperFrames du calque en suite de PNG RGBA (-w 1), une fois par contenu du dossier.
    PNG plutôt que mov ProRes 4444 : sans perte (ce que le navigateur a dessiné, à l'octet), 3 à 11 fois plus léger
    sur les calques du monteur, aussi rapide à rendre et à relire (mesures du 2026-11-11 dans SKILL.md)."""
    out = cache / "calques" / f"{c['id']}-{empreinte_dossier(c['dossier'])}"
    if (out / "frame_000001.png").exists():
        return out, False
    out.parent.mkdir(parents=True, exist_ok=True)
    for vieux in out.parent.iterdir():
        if vieux != out and id_cache(vieux) == c["id"]:
            shutil.rmtree(vieux) if vieux.is_dir() else vieux.unlink()
    tmp = out.with_name(out.name + ".tmp")
    shutil.rmtree(tmp, ignore_errors=True)
    r = subprocess.run(["npx", "--yes", HYPERFRAMES, "render", ".", "--format", "png-sequence", "-w", "1", "-q", "high",
                        "-o", str(tmp)], cwd=c["dossier"], capture_output=True, text=True)
    if r.returncode != 0 or not (tmp / "frame_000001.png").exists():
        journal = cache / "calques" / f"{c['id']}-erreur.log"
        journal.write_text(r.stdout + "\n" + r.stderr)
        shutil.rmtree(tmp, ignore_errors=True)
        echec(4, f"CALQUE_RATÉ {c['id']} : HyperFrames n'a pas pu le rendre (journal : {journal}).")
    tmp.rename(out)
    return out, True


def images_de(ff, calque):
    return len(list(Path(calque).glob("frame_*.png")))


def nettoie_cache(cache, ids_connus, gardes):
    """Après un rendu réussi : ne garde que ce qui sert aux retouches (calques et masques à jour des calques de
    calques.json). Retire les versions d'un id qui ne sont plus celles posées, les calques disparus de calques.json,
    les anciens mov ProRes, la bande son (refaite à chaque rendu) et les journaux. Renvoie les Mo libérés."""
    libere = 0
    def retire(p):
        nonlocal libere
        if p.is_dir():
            libere += sum(f.stat().st_size for f in p.rglob("*") if f.is_file()); shutil.rmtree(p)
        else:
            libere += p.stat().st_size; p.unlink()
    for sous in ("calques", "masques"):
        d = cache / sous
        if not d.exists():
            continue
        for p in d.iterdir():
            i = id_cache(p)
            if p in gardes:
                continue
            if p.suffix == ".mov" or p.name.endswith((".tmp", ".log", "-graphe.txt")) or i not in ids_connus \
                    or any(id_cache(g) == i and g.parent == d for g in gardes):
                retire(p)
    for p in (cache / "audio.wav", cache / "rendu-erreur.log"):
        if p.exists():
            retire(p)
    return round(libere / 1e6)


# ------------------------------------------------------------------------------------------------ HDR -> SDR
HDR_TRANSFERTS = {"arib-std-b67": "hlg", "smpte2084": "pq"}
HDR_BLANC = 203.0          # nits du blanc de référence HDR (UIT-R BT.2408), posé au blanc SDR
HDR_GENOU = 0.75           # sous ce niveau SDR (linéaire), l'image n'est pas compressée ; au-dessus, les hautes lumières
HDR_POINTS = 33            # taille de la table 3D (33 x 33 x 33, interpolation tétraédrique)


def transfert(ff, fichier):
    """Fonction de transfert de la première piste vidéo (ffprobe) : « hlg », « pq » ou None (SDR)."""
    fp = str(Path(ff).with_name("ffprobe"))
    r = subprocess.run([fp if Path(fp).exists() else "ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                        "stream=color_transfer", "-of", "csv=p=0", str(fichier)], capture_output=True, text=True)
    return HDR_TRANSFERTS.get(r.stdout.strip().split(",")[0])


def table_sdr(sorte, cache):
    """Table 3D (.cube) HDR bt2020 (HLG ou PQ) -> SDR bt709, écrite une fois dans le cache. Lumière de scène (HLG :
    OETF inverse puis OOTF à 1000 nits, gamma 1,2 ; PQ : EOTF), blanc de référence 203 nits posé au blanc SDR,
    hautes lumières compressées au-dessus du genou (Reinhard étendu sur la luminance, teinte gardée), passage des
    primaires bt2020 aux bt709 en linéaire, puis gamma 2,4 (BT.1886)."""
    import numpy as np
    out = Path(cache) / f"sdr-{sorte}-{HDR_POINTS}.cube"
    if out.exists():
        return out
    n = HDR_POINTS
    v = np.linspace(0, 1, n)
    b, g, r = np.meshgrid(v, v, v, indexing="ij")          # .cube : le rouge varie le plus vite
    e = np.stack([r, g, b], -1).reshape(-1, 3)
    K = np.array([0.2627, 0.6780, 0.0593])
    if sorte == "hlg":
        a_, b_, c_ = 0.17883277, 0.28466892, 0.55991073
        sc = np.where(e <= 0.5, e * e / 3, (np.exp((e - c_) / a_) + b_) / 12)
        ys = np.maximum(sc @ K, 1e-9)
        nits = 1000.0 * (ys ** 0.2)[:, None] * sc
    else:
        m1, m2, c1, c2, c3 = 0.1593017578125, 78.84375, 0.8359375, 18.8515625, 18.6875
        p = np.power(e, 1 / m2)
        nits = 10000.0 * np.power(np.maximum(p - c1, 0) / (c2 - c3 * p), 1 / m1)
    x = nits / HDR_BLANC
    y = np.maximum(x @ K, 1e-9)
    pic = (1000.0 if sorte == "hlg" else 4000.0) / HDR_BLANC
    u = np.maximum(y - HDR_GENOU, 0) / (1 - HDR_GENOU); wl = (pic - HDR_GENOU) / (1 - HDR_GENOU)
    ym = np.where(y > HDR_GENOU, HDR_GENOU + (1 - HDR_GENOU) * u * (1 + u / (wl * wl)) / (1 + u), y)
    x = x * (ym / y)[:, None]
    M = np.array([[1.6605, -0.5876, -0.0728], [-0.1246, 1.1329, -0.0083], [-0.0182, -0.1006, 1.1187]])
    lin = np.clip(x @ M.T, 0, 1)
    sdr = np.power(lin, 1 / 2.4)
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".tmp")
    with open(tmp, "w") as f:
        f.write(f"TITLE \"HDR {sorte} vers SDR bt709\"\nLUT_3D_SIZE {n}\n")
        np.savetxt(f, sdr, fmt="%.6f")
    tmp.rename(out)
    return out


def vers_sdr(ff, fichier, cache):
    """Chaîne ffmpeg à poser à l'entrée d'une vidéo HDR (iPhone : HLG ; ou PQ) pour la ramener en SDR bt709, ou « »
    pour une vidéo SDR. Dans le graphe du rendu : aucun encodage de plus."""
    sorte = transfert(ff, fichier)
    if not sorte:
        return ""
    t = str(table_sdr(sorte, cache)).replace("\\", "\\\\").replace("'", "\\'")
    return (f"scale=in_color_matrix=bt2020:in_range=tv:out_range=pc,format=gbrp16le,lut3d=file='{t}':interp=tetrahedral,"
            f"scale=out_color_matrix=bt709:in_range=pc:out_range=tv,format=yuv420p,"
            f"setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv")


def filtre_coupes(w, video, ff, cache):
    """filtre.txt de couper-silences ([0:v] et [0:a] -> [v] et [a], 30 i/s), avec la conversion HDR -> SDR posée à
    l'entrée de l'image si la vidéo est en HDR. Partagé avec la planche et l'écoute des sons."""
    f = (Path(w) / "filtre.txt").read_text(encoding="utf-8-sig").strip()
    sdr = vers_sdr(ff, video, cache)
    return f.replace("[0:v]", f"[0:v]{sdr},", 1) if sdr else f


# ------------------------------------------------------------------------------------------------ plan caméra
def chaine_zooms(w):
    """zooms.txt : morceau de graphe ffmpeg posé tel quel, [plan coupé]<zooms.txt>[plan zoomé], à la définition de
    l'original (ancien zoompan comme nouvelle chaîne à plusieurs branches ; « null » s'il n'y a aucun zoom)."""
    return (w / "zooms.txt").read_text(encoding="utf-8-sig").strip() or "null"


def lit_brolls(w, W0, H0, OW, OH, ff=None, cache=None):
    """b-roll.txt (brique b-roll) : entrées ffmpeg des clips et morceau de graphe [ENTREE]...[SORTIE], remis à la
    définition de sortie ; un clip HDR est ramené en SDR à son entrée (même conversion que la vidéo). « plages » : les
    images (début, fin incluse) couvertes par chaque clip. Partagé avec la planche (planche.py)."""
    brolls = dict(entrees=[], filtre=None, plages=[])
    sdr = {}
    for l in (w / "b-roll.txt").read_text(encoding="utf-8-sig").splitlines():
        c = l.rstrip("\r").split("\t")
        if c[0] == "ENTREE":
            if not Path(c[3]).exists():
                echec(2, f"B-ROLL_INTROUVABLE : {c[3]}")
            brolls["entrees"] += ["-ss", c[1], "-t", f"{float(c[2]) + 0.5:.3f}", "-i", c[3]]
            sdr[len(sdr) + 1] = vers_sdr(ff, c[3], cache) if ff and cache else ""
        elif c[0] == "FILTRE":
            brolls["filtre"] = c[1]
    for k, chaine in sdr.items():
        if chaine:
            brolls["filtre"] = brolls["filtre"].replace(f"[{k}:v]", f"[{k}:v]{chaine},", 1)
    if (W0, H0) != (OW, OH):   # la brique b-roll recadre à la définition de l'original
        brolls["filtre"] = brolls["filtre"].replace(f"scale={W0}:{H0}", f"scale={OW}:{OH}").replace(f"crop={W0}:{H0}", f"crop={OW}:{OH}")
    brolls["plages"] = [(int(a), int(b)) for a, b in re.findall(r"between\(n,(\d+),(\d+)\)", brolls["filtre"])]
    if not brolls["plages"]:   # b-roll.txt d'avant le 2026-11-13 (bornes en secondes)
        brolls["plages"] = [(math.ceil(float(a) * FPS - 1e-6), int(float(b) * FPS)) for a, b in re.findall(r"between\(t,([\d.]+),([\d.]+)\)", brolls["filtre"])]
    return brolls


def arbre_si(valeurs, var, lo=0, hi=None):
    """Expression ffmpeg qui vaut valeurs[var] (var entier), en arbre équilibré (profondeur log2)."""
    hi = len(valeurs) if hi is None else hi
    if hi - lo == 1:
        return str(valeurs[lo])
    m = (lo + hi) // 2
    return f"if(lt({var},{m}),{arbre_si(valeurs, var, lo, m)},{arbre_si(valeurs, var, m, hi)})"


def geometrie(lignes, src, info, OW, OH, zooms, calques, w):
    """Coupes déjà faites dans src ; ajoute zooms, mise à la définition de sortie, décalages. Renvoie l'étiquette de sortie."""
    cur = src
    if zooms:   # à la définition de l'original, comme la brique zooms l'écrit
        # puis instants remis en images exactes (base 1/30) : la chaîne des zooms (mix, concat) sort en base
        # 1/1000000 avec des instants arrondis sous l'image (33,399999 s), et les calques posés ensuite prenaient
        # l'image d'avant une fois sur trois (saccade, une image de retard)
        lignes.append(f"[{cur}]{zooms},settb=1/{FPS},setpts=N[ge1]")
        cur = "ge1"
    if (info["largeur"], info["hauteur"]) != (OW, OH):
        lignes.append(f"[{cur}]scale={OW}:{OH}:force_original_aspect_ratio=increase:flags=lanczos,crop={OW}:{OH},setsar=1[ge0]")
        cur = "ge0"
    for i, c in enumerate(x for x in calques if x["decalage"]):
        k = OH / BASE_H
        vals = [int(round(v * k)) for v in c["decalage"]]
        a, b = c["debut"], c["debut"] + c["images"]
        # Sur le plan entier, image par image (pas de split + trim : la branche découpée ferait attendre le plan
        # principal, qui garderait en mémoire toutes les images d'avant le calque) : plan posé sur du noir, décalé de
        # 0 px hors du calque.
        expr = f"if(between(round(t*{FPS}),{a},{b - 1}),{arbre_si(vals, f'(round(t*{FPS})-{a})')},0)"
        lignes.append(f"color=black:s={OW}x{OH}:r={FPS},setsar=1[gd{i}n];"
                      f"[gd{i}n][{cur}]overlay=x=0:y='{expr}':eval=frame:shortest=1[gd{i}]")
        cur = f"gd{i}"
    return cur


def plan_camera(lignes, info, OW, OH, zooms, geo, calques, C, w, brut=None):
    """Étape 1 de l'ordre de composition, partagée avec la planche (planche.py) : plan coupé ([v] de filtre.txt, déjà
    dans `lignes`), zooms, mise à la définition de sortie, décalages, étalonnage, flou des pleins écrans. Renvoie
    l'étiquette du plan étalonné (yuv444p). brut : étiquette où recopier aussi le plan non étalonné (masques)."""
    cur = geometrie(lignes, "v", info, OW, OH, zooms, geo, w)
    if brut:
        lignes.append(f"[{cur}]split[{brut}][pc0]"); cur = "pc0"
    # étalonnage, puis passage en yuv 4:4:4 (les calques se posent en yuv, comme dans le labo : PNG RGBA converti par
    # la matrice par défaut de ffmpeg, la même que HyperFrames pour ses mov ProRes 4444, couleurs identiques au labo)
    lignes.append(f"[{cur}]{C['ETALONNAGE']},format=yuv444p[et]"); cur = "et"
    for i, c in enumerate(x for x in calques if x["flou"]):
        F = c["flou"]; a, b = c["debut"] + F["debut"], c["debut"] + F["fin"]
        L = F["assombrir"]; R = F["rayon"] * OW / BASE_W
        # Sur le plan entier, actif seulement sur ses images (enable) : pas de branche découpée, pas d'attente.
        # Assombrir en YUV limité = niveau RGB ramené à L (même calcul que colorlevels romax), sans repasser en RGB.
        on = f"enable='between(n,{a},{b - 1})'"
        lignes.append(f"[{cur}]gblur=sigma={R:g}:{on},lutyuv=y='16+(val-16)*{L}':u='128+(val-128)*{L}':v='128+(val-128)*{L}':{on}[fl{i}]")
        cur = f"fl{i}"
    return cur


# Apple Vision range parfois dans « la personne » des objets qui touchent sa silhouette : le manteau accroché au mur à
# sa gauche (images 1 à 50 de la rush de test, zoomées à 120 %), le pied du support derrière sa tête. Un titre derrière
# lui y était troué comme s'il passait derrière le manteau (le « TR » de « TRANSFORMATION »). Au-dessus du menton (là où
# se posent les titres derrière lui), on ne garde du masque que sa tête : sur chaque ligne, le morceau continu qui
# contient le milieu du visage, borné à la largeur du visage plus une marge pour les oreilles. Correctif trouvé au test
# v3 (2026-11-11) et resté dans la copie de rendu.py des dossiers de test jusqu'au v7 : la brique ne l'avait pas, d'où
# le retour du défaut au test v8 (2026-11-13).
MARGE_TETE = 0.05      # part de la largeur du visage gardée de chaque côté (le cadre Vision couvre déjà les oreilles)
LISSAGE_VISAGE = 0.5   # moyenne glissante du cadre du visage d'une image à l'autre (évite que le bord saute)


def borne_visage(faces, avant):
    """Cadre du plus grand visage (x0, x1, haut, menton en px 1080 x 1920), lissé avec l'image d'avant ; garde celui
    d'avant si aucun visage n'est trouvé (main devant le visage)."""
    if not faces:
        return avant
    b = max(faces, key=lambda r: r.boundingBox().size.width * r.boundingBox().size.height).boundingBox()
    v = (b.origin.x * BASE_W, (b.origin.x + b.size.width) * BASE_W,
         (1 - b.origin.y - b.size.height) * BASE_H, (1 - b.origin.y) * BASE_H)
    if avant is None:
        return v
    return tuple(a * LISSAGE_VISAGE + c * (1 - LISSAGE_VISAGE) for a, c in zip(avant, v))


def garde_tete(m, visage, np, seuil=40):
    x0, x1, haut, menton = visage
    fw = x1 - x0
    g, d = max(0, int(x0 - MARGE_TETE * fw)), min(BASE_W, int(x1 + MARGE_TETE * fw))
    xc = min(BASE_W - 1, max(0, int((x0 + x1) / 2)))
    y1 = min(BASE_H, max(0, int(menton)))
    out = m.copy()
    out[:y1, :g] = 0
    out[:y1, d:] = 0
    for y in range(y1):
        ligne = out[y]
        if ligne[g:d].max() == 0:
            continue
        on = ligne > seuil
        if not on[xc]:
            ligne[:] = 0          # au-dessus de sa tête : rien ne passe devant le titre
            continue
        trous = np.flatnonzero(~on)
        a = trous[trous < xc]; b = trous[trous > xc]
        a = a[-1] + 1 if len(a) else 0
        b = b[0] if len(b) else BASE_W
        a, b = max(0, a - 3), min(BASE_W, b + 3)   # bord doux du masque gardé
        ligne[:a] = 0
        ligne[b:] = 0
    return out


def masque_personne(img, Quartz, Vision, NSURL, np, Image, visage=None):
    """Masque de personne Apple Vision (qualité « accurate ») d'une image fixe (chemin), à 1080 x 1920, en gris 8 bits,
    borné à sa tête au-dessus du menton (voir MARGE_TETE). visage : cadre du visage de l'image d'avant (lissage d'une
    image à l'autre dans une suite). Renvoie (masque PIL, visage, erreur)."""
    src = Quartz.CGImageSourceCreateWithURL(NSURL.fileURLWithPath_(str(img)), None)
    cg = Quartz.CGImageSourceCreateImageAtIndex(src, 0, None)
    req = Vision.VNGeneratePersonSegmentationRequest.alloc().initWithCompletionHandler_(None)
    req.setQualityLevel_(0)   # « accurate »
    req.setOutputPixelFormat_(Quartz.kCVPixelFormatType_OneComponent8)
    freq = Vision.VNDetectFaceRectanglesRequest.alloc().init()
    h = Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(cg, {})
    ok, err = h.performRequests_error_([req, freq], None)
    if not ok:
        return None, visage, err
    pb = req.results()[0].pixelBuffer()
    mw, mh = Quartz.CVPixelBufferGetWidth(pb), Quartz.CVPixelBufferGetHeight(pb)
    Quartz.CVPixelBufferLockBaseAddress(pb, 1)
    bpr = Quartz.CVPixelBufferGetBytesPerRow(pb)
    arr = np.frombuffer(Quartz.CVPixelBufferGetBaseAddress(pb).as_buffer(bpr * mh), dtype=np.uint8).reshape(mh, bpr)[:, :mw].copy()
    Quartz.CVPixelBufferUnlockBaseAddress(pb, 1)
    m = np.asarray(Image.fromarray(arr).resize((BASE_W, BASE_H), Image.BILINEAR)).copy()
    visage = borne_visage(freq.results() or [], visage)
    if visage is not None:
        m = garde_tete(m, visage, np)
    return Image.fromarray(m), visage, None


def calcule_masques(c, ff, w, info, OW, OH, zooms, calques_geo, cache):
    """Masque de personne Apple Vision, image par image, sur le plan coupé, zoomé (et décalé) non étalonné, pour les
    images du calque. Écrit un mkv gris sans perte (FFV1) à 1080 x 1920. Recalculé seulement si le plan change."""
    video = video_de(w, info)
    filtre = filtre_coupes(w, video, ff, cache)
    cle = empreinte(filtre, zooms or "", json.dumps([[x["debut"], x["images"], x["decalage"]] for x in calques_geo]),
                    c["debut"], c["images"], OW, OH, "tete-1")
    out = cache / "masques" / f"{c['id']}-{cle}.mkv"
    if out.exists():
        return out
    out.parent.mkdir(parents=True, exist_ok=True)
    for vieux in out.parent.glob("*.mkv"):
        if id_cache(vieux) == c["id"]:
            vieux.unlink()
    try:
        import numpy as np
        from PIL import Image
        import Quartz, Vision
        from Foundation import NSURL
    except ImportError as e:
        echec(7, f"OUTIL_MANQUANT détourage : {e} (pip3 install numpy pillow pyobjc-framework-Vision pyobjc-framework-Quartz).")
    lignes = [filtre, "[a]anullsink"]
    g = geometrie(lignes, "v", info, OW, OH, zooms, calques_geo, w)
    a, b = c["debut"], c["debut"] + c["images"]
    lignes.append(f"[{g}]trim=start_frame={a}:end_frame={b},setpts=PTS-STARTPTS,scale={BASE_W}:{BASE_H}:flags=bicubic,format=rgb24[m]")
    gp = cache / "masques" / f"{c['id']}-graphe.txt"
    gp.write_text(";\n".join(lignes))
    dec = subprocess.Popen([ff, "-nostdin", "-v", "error", "-i", str(video), "-/filter_complex", str(gp), "-map", "[m]",
                            "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE, cwd=w)
    tmp = out.with_suffix(".tmp.mkv")
    enc = subprocess.Popen([ff, "-nostdin", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "gray", "-s", f"{BASE_W}x{BASE_H}",
                            "-r", str(FPS), "-i", "-", "-c:v", "ffv1", "-pix_fmt", "gray", str(tmp)], stdin=subprocess.PIPE)
    img = cache / "masques" / "_image.tiff"
    n, taille, visage = 0, BASE_W * BASE_H * 3, None
    while True:
        raw = dec.stdout.read(taille)
        if len(raw) < taille:
            break
        Image.frombytes("RGB", (BASE_W, BASE_H), raw).save(img)
        m, visage, err = masque_personne(img, Quartz, Vision, NSURL, np, Image, visage)
        if m is None:
            echec(5, f"DÉTOURAGE_RATÉ {c['id']} image {a + n} : {err}")
        enc.stdin.write(m.tobytes())
        n += 1
    dec.stdout.close(); dec.wait(); enc.stdin.close(); enc.wait()
    img.unlink(missing_ok=True); gp.unlink(missing_ok=True)
    if n != c["images"] or dec.returncode != 0 or enc.returncode != 0:
        tmp.unlink(missing_ok=True)
        echec(5, f"DÉTOURAGE_RATÉ {c['id']} : {n} masques calculés pour {c['images']} images.")
    tmp.rename(out)
    return out


def lut_serre(seuils):
    lo, hi = round(seuils[0] * 255), round(seuils[1] * 255)
    t = f"clip((val-{lo})/{hi - lo},0,1)"
    return f"lut=c0='255*{t}*{t}*(3-2*{t})'"


def decontamine(lignes, cam, masque, p, OW, on="1"):
    """Romain détouré sans liseré (repris de decontamine() de vert21.py du labo, renforcé pour les murs clairs).
    cam : plan étalonné entier ; masque : masque déjà lissé, resserré et adouci (gray), au pas du plan (image 0 à la fin) ;
    on : expression enable des images du calque (les flous lourds ne tournent que là).
    1. contour resserré d'un px de plus (érosion) : alpha final ;
    2. intérieur sûr = alpha >= 0,97 rogné de DECONT_ROGNE px : le bord du masque Apple Vision déborde d'un ou deux px
       sur le mur, ces px clairs passaient dans « l'intérieur » du labo et redonnaient un fin liseré ;
    3. couleur de bord = moyenne floue (sigma DECONT_SIGMA) des couleurs de l'intérieur sûr seulement (somme pondérée
       / poids, en 16 bits), posée sur toute la bande alpha > 0 hors intérieur sûr, là où le poids dépasse 0,02.
    Moyenne pondérée normalisée : valable en YUV comme en RGB. Renvoie l'étiquette de Romain détouré (yuva444p)."""
    k = OW / BASE_W
    er = ",".join(["erosion"] * max(1, round(DECONT_ROGNE * k)))
    s = DECONT_SIGMA * k
    lignes.append(
        f"[{masque}]erosion,split=3[{p}a][{p}b][{p}c];"
        f"[{p}b]lut=c0='maxval*gte(val,0.97*maxval)',{er},split[{p}i0][{p}i1];"
        f"[{p}i0]format=gbrp16le,split[{p}n1][{p}n2];"
        f"[{cam}]split[{p}ca][{p}cb];[{p}cb]format=gbrp16le[{p}c16];"
        f"[{p}c16][{p}n1]blend=all_mode=multiply,gblur=sigma={s:g}:enable='{on}'[{p}num];"
        f"[{p}n2]gblur=sigma={s:g}:enable='{on}',split[{p}d1][{p}d2];"
        f"[{p}num][{p}d1]blend=all_mode=divide,format=yuv444p[{p}f];"
        f"[{p}d2]extractplanes=g,lut=c0='maxval*gt(val,0.02*maxval)',format=gray[{p}th];"
        f"[{p}c]lut=c0='maxval*gt(val,0)'[{p}pos];[{p}i1]negate[{p}hors];"
        f"[{p}pos][{p}hors]blend=all_mode=multiply[{p}s0];[{p}s0][{p}th]blend=all_mode=multiply[{p}sel];"
        f"[{p}f][{p}sel]alphamerge[{p}fa];[{p}ca][{p}fa]overlay=format=yuv444,format=yuva444p[{p}dec];"
        f"[{p}dec][{p}a]alphamerge[{p}r]")
    return f"{p}r"


# ------------------------------------------------------------------------------------------------ audio
def voix_coupee(ff, w, info, total, C, cache):
    """La voix de la vidéo coupée telle que le rendu la pose : piste coupée de l'original, mono, loudnorm en deux passes
    (-16 LUFS mesurés sur un canal, crête -1,5 dBTP, LRA 11), 48 kHz, exactement la durée de la vidéo coupée.
    Partagée avec l'écoute des sons (sound-design/scripts/ecoute.py) : l'écoute mesure le même mix que le rendu."""
    import numpy as np
    V = C["SONS"]["voix"]
    filtre = (w / "filtre.txt").read_text(encoding="utf-8-sig").strip()
    ln = f"loudnorm=I={V['lufs']}:TP={V['crete']}:LRA=11"
    Path(cache).mkdir(parents=True, exist_ok=True)
    gp = Path(cache) / "voix-graphe.txt"
    video = video_de(w, info)

    def voix(chaine, sortie):
        gp.write_text(filtre + ";\n[v]nullsink;\n[a]aresample=48000,aformat=channel_layouts=mono," + chaine + "[ao]")
        return subprocess.run([ff, "-nostdin", "-hide_banner", "-nostats", "-i", str(video), "-/filter_complex", str(gp),
                               "-map", "[ao]", *sortie], capture_output=True, cwd=w)

    r = voix(ln + ":print_format=json", ["-f", "null", "-"])
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", r.stderr.decode(errors="replace"))
    if r.returncode != 0 or not m:
        echec(5, f"RENDU_RATÉ audio (mesure de la voix) : {r.stderr.decode(errors='replace')[-400:]}")
    me = json.loads(m.group(0))
    try:
        sonie = float(me["input_i"])
    except ValueError:
        sonie = float("-inf")
    if not sonie > -70:   # vidéo sans voix et sans son (silence) : rien à normaliser
        deux = "aresample=48000"
    else:
        deux = (f"{ln}:measured_I={me['input_i']}:measured_TP={me['input_tp']}:measured_LRA={me['input_lra']}"
                f":measured_thresh={me['input_thresh']}:offset={me['target_offset']}:linear=true,aresample=48000")
    r = voix(deux, ["-ac", "1", "-ar", str(SR), "-f", "f64le", "-"])
    gp.unlink(missing_ok=True)
    if r.returncode != 0:
        echec(5, f"RENDU_RATÉ audio (voix) : {r.stderr.decode(errors='replace')[-400:]}")
    N = total * SR // FPS
    v = np.frombuffer(r.stdout, np.float64).copy()
    v = np.pad(v, (0, max(0, N - len(v))))[:N]
    f15 = int(0.015 * SR); v[-f15:] *= np.linspace(1, 0, f15)
    return v


LIMITE_MAX_DB = 3.0   # au-delà, ce n'est plus une crête : des sons trop forts ou empilés (MIX_SATURÉ)


def limite_crete(x, plafond_db, np):
    """Limiteur de crête du mix (sans couleur) : la voix est normalisée à -1,5 dBTP et le plafond du mix est -1 dBFS,
    donc un son posé sur un pic de voix dépassait d'un rien et bloquait le rendu (test v9 : Vine boom sur une syllabe
    forte, -0,21 dBFS). Le gain ne baisse que là où le mix dépasse le plafond (anticipation 2 ms, retour 60 ms), jamais
    ailleurs. Renvoie (mix limité, réduction maximale en dB, durée touchée en ms)."""
    cap = 10 ** ((plafond_db - 0.05) / 20)
    pk = np.abs(x)
    g = np.minimum(1.0, cap / np.maximum(pk, 1e-12))
    if g.min() >= 1.0:
        return x, 0.0, 0.0
    av, ret = int(0.002 * SR), int(0.060 * SR)
    # anticipation : chaque échantillon prend le gain le plus bas des 2 ms qui suivent (le gain descend avant le pic)
    from numpy.lib.stride_tricks import sliding_window_view
    g = sliding_window_view(np.concatenate([g, np.ones(av)]), av + 1).min(axis=1)[:len(x)]
    # descente adoucie (moyenne sur 2 ms, sans remonter au-dessus du gain voulu), puis retour linéaire sur 60 ms
    g = np.minimum(g, np.convolve(np.pad(g, av, constant_values=1.0), np.ones(av) / av, "same")[av:-av])
    for k in np.flatnonzero(g < 1.0):
        if k + 1 < len(g) and g[k + 1] >= 1.0:   # fin d'une zone touchée : le gain remonte en 60 ms
            fin = min(len(g), k + 1 + ret)
            rampe = g[k] + (1 - g[k]) * np.arange(1, fin - k) / ret
            g[k + 1:fin] = np.minimum(g[k + 1:fin], rampe)
    y = x * g
    y = np.clip(y, -cap, cap)
    touche = float((g < 0.999).sum() / SR * 1000)
    return y, float(-20 * np.log10(g.min())), touche


def bande_son(ff, w, info, total, sons, C, biblio, cache, musique=None):
    """Voix (voix_coupee) + sons de sons.json aux niveaux mesurés (repris de mix21.py du labo). Écrit
    rendu-cache/audio.wav (48 kHz stéréo 24 bits) ; renvoie les mesures.
    musique (clé « musique » de sons.json, null chez Romain) : { "fichier": piste déjà réglée sous la voix, de la durée
    de la vidéo coupée (chemin absolu ou relatif au dossier de montage), "gain_db"?: 0 } ; ajoutée telle quelle."""
    try:
        import numpy as np
        from scipy.signal import lfilter
    except ImportError as e:
        echec(7, f"OUTIL_MANQUANT audio : {e} (pip3 install numpy scipy).")
    N = total * SR // FPS
    v = voix_coupee(ff, w, info, total, C, cache)

    # Sonie K pondérée (UIT-R BS.1770), copie de kpond.py du labo
    B1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]; A1 = [1.0, -1.69065929318241, 0.73248077421585]
    B2 = [1.0, -2.0, 1.0]; A2 = [1.0, -1.99004745483398, 0.99007225036621]
    kw = lambda x: lfilter(B2, A2, lfilter(B1, A1, x))
    lufs = lambda x: float(-0.691 + 10 * np.log10(max((kw(x) ** 2).mean(), 1e-20)))

    def lufs_porte(x):
        y = kw(x) ** 2; wd, s = int(0.4 * SR), int(0.1 * SR)
        z = np.array([y[i:i + wd].mean() for i in range(0, max(1, len(y) - wd + 1), s)])
        l = -0.691 + 10 * np.log10(np.maximum(z, 1e-20)); z = z[l > -70]
        if not len(z):
            return -99.0
        rel = -0.691 + 10 * np.log10(z.mean()) - 10; l = -0.691 + 10 * np.log10(z); z = z[l > rel]
        return float(-0.691 + 10 * np.log10(z.mean()))

    db = lambda x: 20 * np.log10(np.maximum(x, 1e-12))
    env = lambda x, d=0.002: np.sqrt(np.convolve(x * x, np.ones(int(d * SR)) / int(d * SR), "same"))
    actif = lambda c: env(c, 0.001) > env(c).max() * 0.1

    def rms_parle(x):
        bl = x[:len(x) // 2400 * 2400].reshape(-1, 2400); rr = np.sqrt((bl ** 2).mean(1)); rr = rr[db(rr) > -45]
        return float(db(np.sqrt((rr ** 2).mean()))) if len(rr) else -99.0

    def lit(p):
        rr = subprocess.run([ff, "-v", "error", "-i", str(p), "-af", "pan=mono|c0=c0", "-ar", str(SR), "-f", "f64le", "-"], capture_output=True)
        if rr.returncode != 0:
            echec(3, f"SONS_ILLISIBLE : {p} illisible.")
        return np.frombuffer(rr.stdout, np.float64).copy()

    vl, vr = lufs_porte(v), rms_parle(v)
    if not vl > -70:   # vidéo sans voix : les sons se règlent sous une voix au niveau du style (-16 LUFS)
        vl = vr = float(C["SONS"]["voix"]["lufs"])
    bus = np.zeros(N); poses = []
    for i, s in enumerate(sons):
        f = fichier_style(C, biblio, "sons", s.get("fichier", ""))
        if not f.exists():
            echec(2, f"SON_INTROUVABLE : son n°{i + 1}, {f}")
        try:
            image = int(s["image"]); niv = s["niveau"]
        except Exception:
            echec(3, f"SONS_ILLISIBLE : son n°{i + 1}, il faut « image » et « niveau ».")
        if not 0 <= image < total:
            echec(3, f"SONS_ILLISIBLE : son n°{i + 1}, image {image} hors de la vidéo coupée (0 à {total - 1}).")
        c = lit(f); a = actif(c)
        # début d'attaque : fiche du son (<son>.json), ou fiche du dossier (frappes.json, clé = nom du son)
        meta, fiche = {}, f.with_suffix(".json")
        if fiche.exists():
            meta = json.loads(fiche.read_text())
        elif (f.parent.parent / f"{f.parent.name}.json").exists():
            meta = json.loads((f.parent.parent / f"{f.parent.name}.json").read_text()).get(f.stem, {})
        d0 = int(meta.get("debut_echantillon", 0))
        if "lu_sous_voix" in niv:
            g = vl - float(niv["lu_sous_voix"]) - lufs(c[a]); mesure = ("lu_sous_voix", float(niv["lu_sous_voix"]))
        elif "rms_db_sous_voix" in niv:
            g = vr - float(niv["rms_db_sous_voix"]) - float(db(np.sqrt((c[a] ** 2).mean())))
            mesure = ("rms_db_sous_voix", float(niv["rms_db_sous_voix"]))
        else:
            echec(3, f"SONS_ILLISIBLE : son n°{i + 1}, niveau = {{\"lu_sous_voix\": x}} ou {{\"rms_db_sous_voix\": x}}.")
        cg = c * 10 ** (g / 20)
        i0 = int(round(image / FPS * SR)) - d0
        x0, x1 = max(0, i0), min(N, i0 + len(cg))
        if x1 > x0:
            bus[x0:x1] += cg[x0 - i0:x1 - i0]
        ecart = (lufs(cg[a]) - vl) if mesure[0] == "lu_sous_voix" else (float(db(np.sqrt((cg[a] ** 2).mean()))) - vr)
        poses.append(dict(fichier=str(s["fichier"]), image=image, niveau=dict([mesure]), gain_db=round(g, 1),
                          ecart_mesure=round(ecart, 1), pourquoi=s.get("pourquoi", "")))
    mus = None
    if musique:
        fm = Path(str(musique.get("fichier", "")))
        fm = fm if fm.is_absolute() else w / fm
        if not fm.exists():
            echec(2, f"MUSIQUE_INTROUVABLE : {fm} (relance la préparation des sons).")
        m = lit(fm)[:N] * 10 ** (float(musique.get("gain_db", 0)) / 20)
        bus[:len(m)] += m
        mus = dict(fichier=str(fm), gain_db=float(musique.get("gain_db", 0)), crete_dbfs=round(float(db(np.abs(m).max())), 1))
    mix = v + bus
    pk0 = float(db(np.abs(mix).max()))
    mix, red, touche = limite_crete(mix, C["SONS"]["cretMax"], np)
    if red > LIMITE_MAX_DB:
        echec(6, f"MIX_SATURÉ : crête du mix {pk0:.2f} dBFS, il faudrait la baisser de {red:.1f} dB (plafond {C['SONS']['cretMax']} dBFS) : "
                 "baisse le niveau des sons proches ou écarte-les.")
    pk = float(db(np.abs(mix).max()))
    out = cache / "audio.wav"
    rr = subprocess.run([ff, "-v", "error", "-y", "-f", "f64le", "-ar", str(SR), "-ac", "2", "-i", "-", "-c:a", "pcm_s24le", str(out)],
                        input=np.stack([mix, mix], 1).tobytes())
    if rr.returncode != 0:
        echec(5, "RENDU_RATÉ audio : écriture de la bande son impossible.")
    return out, dict(voix_lufs_mono=round(vl, 1), voix_rms_parle_dbfs=round(vr, 1), crete_mix_dbfs=round(pk, 2),
                     crete_avant_limiteur_dbfs=round(pk0, 2), limiteur_db=round(red, 2), limiteur_ms=round(touche, 1), sons=poses,
                     **({"musique": mus} if mus else {}))


# ------------------------------------------------------------------------------------------------ rendu
def main():
    if len(sys.argv) < 3:
        echec(2, "Usage : rendu.py <dossier>-montage <couches>  (couches : " + ", ".join(COUCHES) + ")")
    w = Path(sys.argv[1]).expanduser().resolve()
    if not (w / "info.json").exists():
        echec(2, f"DOSSIER_INCONNU : {w} n'est pas un dossier de montage (lance d'abord couper-silences).")
    info = lit_json(w / "info.json", 3, "INFO")
    video = video_de(w, info)
    if not video.exists():
        echec(2, f"VIDÉO_INTROUVABLE : {info.get('video')} (la vidéo d'origine a été déplacée ?)")
    demande = [c for c in re.split(r"[,; ]+", " ".join(sys.argv[2:]).lower()) if c]
    for c in demande:
        if c not in COUCHES:
            echec(2, f"COUCHE_INCONNUE : {c} (couches possibles : {', '.join(COUCHES)})")
    if "coupes" not in demande or not (w / "filtre.txt").exists() or not (w / "edl.json").exists():
        echec(2, "COUCHE_MANQUANTE coupes : passe d'abord par couper-silences (toutes les couches se calent sur la vidéo coupée).")
    if not re.search(rf"fps={FPS}\b", (w / "filtre.txt").read_text(encoding="utf-8-sig").split(";")[0]):
        echec(2, "COUCHE_MANQUANTE coupes : filtre.txt n'est pas à 30 images/s ; relance la compilation des coupes (couper-silences compiler).")
    t_debut = time.time()
    ff = trouve_ffmpeg()
    node = trouve_node()
    biblio = bibliotheque()
    C = constantes(node, biblio)
    total = int(lit_json(w / "edl.json", 3, "COUPES")["segments"][-1]["outOutF"])
    W0, H0 = int(info["largeur"]), int(info["hauteur"])
    OW, OH = BASE_W, BASE_H   # toujours 1080 x 1920 (définition d'Instagram ; une 4K garde sa finesse dans les zooms,
    #                           faits avant la mise à la définition de sortie) : le plafond de poids du style tient
    cache = w / "rendu-cache"; cache.mkdir(exist_ok=True)
    sdr = transfert(ff, video)
    if sdr:
        dire(f"  vidéo HDR ({sdr.upper()}) : convertie en SDR dans le même passage")

    zooms = None
    if "zooms" in demande:
        if not (w / "zooms.txt").exists():
            echec(2, "COUCHE_MANQUANTE zooms : lance d'abord la brique zooms (preparer).")
        zooms = chaine_zooms(w)
    brolls = None
    if "b-roll" in demande:
        if not (w / "b-roll.txt").exists():
            echec(2, "COUCHE_MANQUANTE b-roll : lance d'abord la brique b-roll (preparer).")
        brolls = lit_brolls(w, W0, H0, OW, OH, ff, cache)
    sources = [s for s in ("animations", "sous-titres") if s in demande]
    calques = calques_demandes(w, sources, total) if sources else []
    sons = None; musique = None
    if "sons" in demande:
        if not (w / "sons.json").exists():
            echec(2, "COUCHE_MANQUANTE sons : lance d'abord la brique sound-design (sons.json).")
        sj = lit_json(w / "sons.json", 3, "SONS")
        sons = sj.get("sons") or []
        musique = sj.get("musique") or None

    dire(f"Fabrication de la vidéo ({OW}x{OH}, {total} images, {total / FPS:.1f} s), couches : {', '.join(c for c in COUCHES if c in demande)}")
    # 1. calques HyperFrames
    t0 = time.time(); nouveaux = 0
    for c in calques:
        c["png"], neuf = rend_calque(c, cache, ff); nouveaux += neuf
        n = images_de(ff, c["png"])
        if n < c["images"]:
            dire(f"  attention : calque {c['id']} rendu sur {n} images pour {c['images']} demandées (data-duration du calque ?).")
    if calques:
        dire(f"  calques : {len(calques)} ({nouveaux} rendus, {len(calques) - nouveaux} déjà prêts) en {time.time() - t0:.0f} s")
    # 2. masques de Romain pour les calques derrière lui
    t0 = time.time(); geo = [c for c in calques if c["decalage"]]
    for c in calques:
        if c["couche"] == "derriere":
            c["masque"] = calcule_masques(c, ff, w, info, OW, OH, zooms, geo, cache)
    if any(c["couche"] == "derriere" for c in calques):
        dire(f"  détourage : {sum(c['couche'] == 'derriere' for c in calques)} calque(s) derrière lui en {time.time() - t0:.0f} s")
    # 3. bande son
    t0 = time.time()
    audio, mesures = bande_son(ff, w, info, total, sons or [], C, biblio, cache, musique)
    dire(f"  son : voix {mesures['voix_lufs_mono']} LUFS, {len(mesures['sons'])} son(s), crête {mesures['crete_mix_dbfs']} dBFS en {time.time() - t0:.0f} s")

    # 4. le graphe : un seul passage depuis l'original
    entrees = ["-i", str(video)]
    k = 1
    if brolls:
        entrees += brolls["entrees"]; k += len(brolls["entrees"]) // 6
    lignes = [filtre_coupes(w, video, ff, cache), "[a]anullsink"]
    cur = plan_camera(lignes, info, OW, OH, zooms, geo, calques, C, w)

    def entree_calque(c, etq):
        nonlocal k
        # HyperFrames écrit en RGB les images sans transparence et en RGBA les autres : sans -reinit_filter 0, ffmpeg
        # reconstruit le graphe à chaque changement et la vidéo s'arrête en route (sans erreur).
        entrees.extend(["-reinit_filter", "0", "-framerate", str(FPS), "-i", str(c["png"] / "frame_%06d.png")]); idx = k; k += 1
        ech = f",scale={OW}:{OH}:flags=lanczos" if (OW, OH) != (BASE_W, BASE_H) else ""
        lignes.append(f"[{idx}:v]trim=end_frame={c['images']},settb=1/{FPS},setpts=N+{c['debut']}{ech},format=yuva444p[{etq}]")

    def entree_masque(c, etq, chaine, plein=False):
        """plein : masque prolongé de noir sur toute la vidéo (image 0 à la fin), pour avancer au pas du plan caméra."""
        nonlocal k
        entrees.extend(["-i", str(c["masque"])]); idx = k; k += 1
        ech = f",scale={OW}:{OH}:flags=bilinear" if (OW, OH) != (BASE_W, BASE_H) else ""
        # Temps recalés en images exactes (base 1/30) : le masque mkv est en millisecondes, et un arrondi d'un tiers de
        # ms suffit à apparier un masque avec l'image caméra d'avant (contour décalé d'une image : liseré).
        cale = (f"settb=1/{FPS},setpts=N,format=gray,tpad=start={c['debut']}:stop={total - c['debut'] - c['images']}:color=black"
                if plein else f"settb=1/{FPS},setpts=N+{c['debut']},format=gray")
        lignes.append(f"[{idx}:v]{cale}{ech},{chaine}[{etq}]")

    for i, c in enumerate(sorted((x for x in calques if x["couche"] == "derriere"), key=lambda x: x["ordre"])):
        entree_calque(c, f"dc{i}")
        if c["detoure"]:
            # Tout avance au pas du plan caméra, de l'image 0 à la fin (masque et calque prolongés de noir) : une branche
            # découpée (split + trim) ferait garder en mémoire au plan principal toutes les images d'avant le calque.
            a, b = c["debut"], c["debut"] + c["images"]
            on = f"between(n,{a},{b - 1})"
            entree_masque(c, f"dm{i}", f"tmix=frames=3:weights='1 2 1',{lut_serre(SERRE_DETOURE)},gblur=sigma=0.8", plein=True)
            lignes.append(f"[dc{i}]setpts=N,tpad=start={a}:color=black[dp{i}];[{cur}]split[dr{i}a][dr{i}b]")
            rom = decontamine(lignes, f"dr{i}b", f"dm{i}", f"dx{i}", OW, on)
            lignes.append(f"[dp{i}][{rom}]overlay=format=yuv444[dr{i}v];"
                          f"[dr{i}a][dr{i}v]overlay=format=yuv444:eof_action=pass:enable='{on}'[dr{i}]")
        else:
            entree_masque(c, f"dm{i}", f"{lut_serre(SERRE_TROU)},negate")
            lignes.append(f"[dc{i}]split[dt{i}a][dt{i}b];[dt{i}b]alphaextract[dt{i}c];[dt{i}c][dm{i}]blend=all_mode=multiply[dt{i}d];"
                          f"[dt{i}a][dt{i}d]alphamerge[dt{i}e];[{cur}][dt{i}e]overlay=format=yuv444:eof_action=pass[dr{i}]")
        cur = f"dr{i}"
    if brolls:
        lignes.append(brolls["filtre"].replace("[ENTREE]", f"[{cur}]").replace("[SORTIE]", "[br]")); cur = "br"
    devant = sorted((x for x in calques if x["couche"] == "devant"), key=lambda x: (x["source"] == "sous-titres", x["ordre"]))
    for i, c in enumerate(devant):
        entree_calque(c, f"av{i}")
        lignes.append(f"[{cur}][av{i}]overlay=format=yuv444:eof_action=pass[ov{i}]"); cur = f"ov{i}"
    lignes.append(f"[{cur}]setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv,format=yuv420p[vout]")
    entrees += ["-i", str(audio)]; ia = k
    graphe = w / "rendu-filtre.txt"
    graphe.write_text(";\n".join(lignes), encoding="utf-8")

    base = video.stem
    out = video.with_name(f"{base}-monte.mp4"); n = 2
    while out.exists():
        out = video.with_name(f"{base}-monte-{n}.mp4"); n += 1
    tmp = out.with_name(out.stem + ".partiel.mp4")
    t0 = time.time()
    # Poids : le style plafonne la vidéo finale (RENDU.fullMaxMo, 20 Mo ; débit vidéo RENDU.fullMaxMbps au plus). Le
    # débit vidéo maximal est tiré de la durée (marge de 6 % pour le conteneur et le tampon) : qualité constante (crf)
    # là où l'image est simple, plafonnée là où elle est chargée. Un seul encodage, toujours depuis l'originale.
    plafond_mo = float(C["RENDU"]["fullMaxMo"])
    kbps = int(min(float(C["RENDU"]["fullMaxMbps"]) * 1000,
                   (plafond_mo * 8e3 * 0.94) / (total / FPS) - 192))
    cmd = [ff, "-nostdin", "-v", "error", "-y", *entrees, "-/filter_complex", graphe.name, "-map", "[vout]", "-map", f"{ia}:a",
           "-frames:v", str(total), "-r", str(FPS),
           "-c:v", "libx264", "-preset", "slow", "-crf", str(C["RENDU"]["crf"]), "-maxrate", f"{kbps}k", "-bufsize", f"{kbps}k",
           "-profile:v", "high",
           "-pix_fmt", "yuv420p", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv",
           "-c:a", "aac", "-b:a", "192k", "-ar", str(SR), "-movflags", "+faststart", str(tmp)]
    limite = max(600, int(total / FPS * 30))   # garde-fou : un graphe bloqué ne doit pas tourner sans fin
    try:
        r = subprocess.run(cmd, cwd=w, capture_output=True, text=True, timeout=limite)
    except subprocess.TimeoutExpired as e:
        tmp.unlink(missing_ok=True)
        (cache / "rendu-erreur.log").write_text((e.stderr or b"").decode(errors="replace") if isinstance(e.stderr, bytes) else (e.stderr or ""))
        echec(5, f"RENDU_BLOQUÉ : ffmpeg n'a pas fini en {limite} s (graphe bloqué), arrêté. Rien n'est livré.")
    if r.returncode != 0 or not tmp.exists():
        tmp.unlink(missing_ok=True)
        (cache / "rendu-erreur.log").write_text(r.stderr)
        echec(5, f"RENDU_RATÉ (ffmpeg code {r.returncode}) : {r.stderr.strip()[-500:]}")
    # Contrôle obligatoire avant PRÊT : un graphe interrompu peut finir sans erreur sur une vidéo tronquée.
    ffprobe = str(Path(ff).with_name("ffprobe"))
    def sonde(*args):
        return subprocess.run([ffprobe, "-v", "error", *args, "-of", "csv=p=0", str(tmp)], capture_output=True, text=True).stdout.strip()
    n_sortie = sonde("-select_streams", "v:0", "-count_frames", "-show_entries", "stream=nb_read_frames")
    try:
        d_audio = float(sonde("-select_streams", "a:0", "-show_entries", "stream=duration"))
    except ValueError:
        d_audio = -1.0
    if n_sortie != str(total) or abs(d_audio - total / FPS) > 0.1:
        (cache / "rendu-erreur.log").write_text(r.stderr)
        tmp.unlink(missing_ok=True)
        echec(5, f"RENDU_INCOMPLET : la vidéo sortie a {n_sortie} images et {d_audio:.2f} s de son, il en faut {total} "
                 f"et {total / FPS:.2f} s (graphe interrompu, voir rendu-erreur.log). Rien n'est livré.")
    tmp.rename(out)
    t_enc = time.time() - t0
    poids_mo = out.stat().st_size / 1e6
    if poids_mo > plafond_mo:
        dire(f"  attention : {poids_mo:.1f} Mo, au-dessus du plafond du style ({plafond_mo:g} Mo) : préviens Yoan.")
    ids = {x.get("id") for x in lit_json(w / "calques.json", 3, "CALQUES").get("calques", [])} if (w / "calques.json").exists() else set()
    libere = nettoie_cache(cache, ids, {x[cle] for x in calques for cle in ("png", "masque") if x.get(cle)})
    poids = round(sum(f.stat().st_size for f in cache.rglob("*") if f.is_file()) / 1e6)
    rapport = dict(sortie=str(out), definition=f"{OW}x{OH}", images=total, duree_s=round(total / FPS, 3),
                   couches=[c for c in COUCHES if c in demande],
                   calques=[dict(id=c["id"], source=c["source"], couche=c["couche"], debut=c["debut"], images=c["images"],
                                 plan=[p for p in ("flou", "decalage", "detoure") if c[p]]) for c in calques],
                   audio=mesures, poids_mo=round(poids_mo, 1), debit_video_max_kbps=kbps, hdr=sdr,
                   encodage_s=round(t_enc, 1), total_s=round(time.time() - t_debut, 1),
                   cache_mo=poids, cache_libere_mo=libere)
    (w / "rendu.json").write_text(json.dumps(rapport, ensure_ascii=False, indent=1), encoding="utf-8")
    dire(f"PRÊT {out} ({poids_mo:.1f} Mo, rendu en {time.time() - t_debut:.0f} s, dont encodage {t_enc:.0f} s)")


if __name__ == "__main__":
    _garder_les_enfants()
    main()
