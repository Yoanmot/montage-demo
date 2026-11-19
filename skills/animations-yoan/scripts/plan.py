"""plan.py : lecture et résolution du plan de montage de Yoan (skill animations-yoan, monteur de Yoan).

Le plan (`<dossier>-montage/plan-montage.json`) est la timeline du pipeline de Yoan (`moteur/executeur/CONTRAT-TIMELINE.md`,
contrat `timeline/1`), écrite sur la vidéo coupée par couper-silences (words.cut.json, edl.json du même dossier). Ce
module :
  - complète les sous-titres en mode automatique (`"auto": true` : groupes découpés ici, mots dorés et accents forts
    donnés par le plan) ;
  - résout tout avec le validateur du pipeline de Yoan (`moteur/executeur/valider_timeline.py`, copie réglée pour lire
    le dossier de montage et les ancres numérotées « w12 ») ;
  - ajoute les contraintes du moteur de Romain (zooms et caméra), que le validateur d'origine ne connaît pas.
Aucune décision créative ici : un plan impossible est refusé avec la raison.
"""
import json, re, sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
SKILL = ICI.parent
MOTEUR = SKILL / "moteur"
EXE = MOTEUR / "executeur"
sys.path.insert(0, str(EXE))
import valider_timeline as VT  # noqa: E402
from style import STYLE, IPS  # noqa: E402

PLAN = "plan-montage.json"
ST = STYLE["sousTitres"]
PONCT_FIN = (".", "?", "!", "…")
LIGNE_MAX = 700          # px : une ligne de sous-titre (Satoshi Black 70, capitales) ; 880 est la limite du bloc
MOTS_MAX = 6             # mots par groupe (la démo validée : 2 à 5)
DUREE_MAX = 2.2          # s : un groupe ne reste pas plus longtemps à l'écran en se construisant
PAUSE_COUPE = 0.45       # s : une respiration ferme le groupe
PAUSE_DOUCE = 0.25       # s : respiration qui ferme un groupe déjà fourni (3 mots et plus)
DEUX_LIGNES = 14         # caractères : au-delà, le groupe passe sur deux lignes équilibrées


class PlanFaux(Exception):
    pass


def dossier_de(chemin):
    p = Path(chemin).expanduser().resolve()
    return p.parent if p.is_file() else p


def lire_plan(w):
    f = w / PLAN
    if not f.exists():
        raise PlanFaux(f"PLAN_INTROUVABLE : écris d'abord {f} (skill plan-montage-yoan).")
    try:
        tl = json.loads(f.read_text(encoding="utf-8"))
    except Exception as e:
        raise PlanFaux(f"PLAN_ILLISIBLE : {e}")
    return f, tl


def largeur(texte, taille=None):
    taille = taille or ST["taille"]
    return VT.largeur_sous_titres(texte.replace(" ", ""), taille) + 2 * ST["espace"] * taille * len(texte.split())


def _majuscules(t):
    return t.upper()


AF = ST["accentFort"]
LARGEUR_FORT = AF["largeurMax"] - 2 * AF["plus"]["marge"]["x"]   # 840 px à 104 px (les « + » de chaque côté)


# ------------------------------------------------------------------------------------------------ style de la vidéo
def style_video(w):
    """Le style de CETTE vidéo (<w>/style-video.json, clé « style ») appliqué au style de Yoan (moteur/executeur/style.py),
    pour ce processus et les pages qu'il écrit (STYLE_VIDEO). Les réglages de découpe des sous-titres suivent :
    sousTitres.ligneMax (px d'une ligne, 700), sousTitres.motsMax (mots par groupe, 6), sousTitres.deuxLignes
    (caractères au-delà desquels le groupe passe sur deux lignes, 14). Rend le dict appliqué, ou None (rien ne change)."""
    global LIGNE_MAX, MOTS_MAX, DEUX_LIGNES, LARGEUR_FORT
    import style as _style
    try:
        sv = _style.appliquer_style_video(w)
    except ValueError as e:
        raise PlanFaux(str(e))
    if not sv:
        return None
    LIGNE_MAX = ST.get("ligneMax", LIGNE_MAX)
    MOTS_MAX = ST.get("motsMax", MOTS_MAX)
    DEUX_LIGNES = ST.get("deuxLignes", DEUX_LIGNES)
    LARGEUR_FORT = AF["largeurMax"] - 2 * AF["plus"]["marge"]["x"]
    return sv


GLYPHES_PY = """
import json, sys
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
f = TTFont(sys.argv[1]); os2, upm = f["OS/2"], f["head"].unitsPerEm
gs, cmap, hmtx = f.getGlyphSet(), f.getBestCmap(), f["hmtx"]
chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸŒÆabcdefghijklmnopqrstuvwxyzàâäçéèêëîïôöùûüÿœæ0123456789'’.,;:!?%€$&-+«»()/@#*"
out = dict(upm=upm, ascent=os2.sTypoAscender, descent=-os2.sTypoDescender, cap=getattr(os2, "sCapHeight", 0) or int(upm * 0.7), chars={})
for ch in chars:
    g = cmap.get(ord(ch))
    if not g: continue
    p = BoundsPen(gs); gs[g].draw(p); b = p.bounds or (0, 0, 0, 0)
    out["chars"][ch] = dict(adv=hmtx[g][0], x0=b[0], y0=b[1], x1=b[2], y1=b[3])
open(sys.argv[2], "w").write(json.dumps(out, ensure_ascii=False))
"""


def glyphes_sous_titres(w):
    """Police des sous-titres autre que Satoshi (style de la vidéo) : sa table de glyphes (largeurs, encre des crochets),
    faite une fois dans <w>/animations-yoan/, posée pour le découpage (VT) et les pages (ENCRE_GLYPHES). Rend son chemin,
    ou None (Satoshi : la table du moteur)."""
    import hashlib, os, subprocess
    import style as _style
    pol = STYLE["polices"].get(ST["police"])
    if not pol:
        raise PlanFaux(f"STYLE_VIDEO_POLICE_INCONNUE sousTitres.police = {ST['police']} (pas dans polices)")
    f = Path(pol["fichier"]) if Path(pol["fichier"]).is_absolute() else _style.fichier(pol["fichier"])
    if f.name.startswith("Satoshi-Black"):
        VT.GLYPHES_SOUS_TITRES = None; os.environ.pop("ENCRE_GLYPHES", None)
        return None
    if not f.exists():
        raise PlanFaux(f"STYLE_VIDEO_POLICE_INTROUVABLE {f}")
    if f.suffix.lower() not in (".ttf", ".otf"):
        raise PlanFaux(f"STYLE_VIDEO_POLICE_FORMAT {f.name} : une police .ttf ou .otf")
    cle = hashlib.sha1(f"{f}{f.stat().st_size}{int(f.stat().st_mtime)}".encode()).hexdigest()[:10]
    out = w / "animations-yoan" / f"glyphes-{cle}.json"; out.parent.mkdir(exist_ok=True)
    if not out.exists():
        r = subprocess.run(["/usr/bin/python3", "-c", GLYPHES_PY, str(f), str(out)], capture_output=True, text=True)
        if r.returncode != 0:
            raise PlanFaux(f"STYLE_VIDEO_POLICE_ILLISIBLE {f.name} : {r.stderr.strip()[-300:]}")
    VT.GLYPHES_SOUS_TITRES = json.loads(out.read_text(encoding="utf-8"))
    os.environ["ENCRE_GLYPHES"] = str(out)
    return out


def _equilibre(mots, bloque, fort=False):
    """Coupe une liste de mots affichés en deux lignes équilibrées (une expression dorée ne se coupe jamais)."""
    best, bk = None, None
    taille, lim = (AF["taille"], LARGEUR_FORT) if fort else (ST["taille"], 860)
    if fort and largeur(" ".join(mots), taille) <= lim: return [" ".join(mots)]
    for k in range(1, len(mots)):
        if k in bloque: continue
        a, b = " ".join(mots[:k]), " ".join(mots[k:])
        la, lb = largeur(a, taille), largeur(b, taille)
        if max(la, lb) > lim: continue
        cout = max(la, lb) + 0.15 * abs(la - lb)
        if best is None or cout < best: best, bk = cout, k
    if bk is None: return [" ".join(mots)]
    return [" ".join(mots[:bk]), " ".join(mots[bk:])]


def _tient(mots):
    """Le groupe tient sur une ligne, ou sur deux lignes de LIGNE_MAX px au plus."""
    if largeur(" ".join(mots)) <= LIGNE_MAX: return True
    return any(largeur(" ".join(mots[:k])) <= LIGNE_MAX and largeur(" ".join(mots[k:])) <= LIGNE_MAX for k in range(1, len(mots)))


def groupes_auto(voix, joints, dores, forts):
    """Découpe une suite de mots de la voix (dicts de l'Ancres du validateur) en groupes de sous-titres au style de Yoan :
    1 ou 2 lignes, coupés où la voix respire (ponctuation, blanc, coupe de montage), lignes équilibrées, un mot ou une
    expression dorée par groupe au plus (donnés par le plan), l'expression d'un accent fort seule dans son groupe."""
    # unités insécables : un mot, ou une expression dorée / un accent fort (indices dans voix)
    ex = {}
    for (k0, n, sorte) in dores + forts:
        for k in range(k0, k0 + n): ex[k] = (k0, n, sorte)
    G, cur = [], []

    def ferme():
        nonlocal cur
        if cur: G.append(cur); cur = []

    k = 0
    while k < len(voix):
        if k in ex and ex[k][0] == k:
            k0, n, sorte = ex[k]; unite = list(range(k0, k0 + n))
        else:
            unite = [k]; sorte = None
        if sorte == "fort":
            ferme(); G.append(unite); k += len(unite); continue
        if cur:
            prev = voix[cur[-1]]; nxt = voix[unite[0]]
            pause = nxt["start"] - prev["end"]
            mots_g = [_majuscules(voix[j]["text"]) for j in cur + unite]
            coupe_entre = any(prev["end"] - 1e-3 <= j <= nxt["start"] + 1e-3 for j in joints)
            trop = (len(cur) + len(unite) > MOTS_MAX or voix[unite[-1]]["end"] - voix[cur[0]]["start"] > DUREE_MAX
                    or not _tient(mots_g))
            fin_phrase = prev["text"].rstrip().endswith(PONCT_FIN)
            virgule = prev["text"].rstrip().endswith((",", ";", ":"))
            deux_dores = sorte == "dore" and any(ex.get(j, (None, 0, None))[2] == "dore" for j in cur)
            if (trop or deux_dores or fin_phrase or coupe_entre or pause >= PAUSE_COUPE or (virgule and len(cur) >= 2)
                    or (pause >= PAUSE_DOUCE and len(cur) >= 3)):
                ferme()
        cur += unite; k += len(unite)
    ferme()
    out = []
    for g in G:
        mots = [_majuscules(voix[j]["text"]) for j in g]
        dore = None; opt = {}; bloque = set()
        for (k0, n, sorte) in dores + forts:
            if k0 in g:
                i0 = g.index(k0); dore = " ".join(mots[i0:i0 + n])
                if sorte == "fort": opt["accent"] = "fort"
                else: bloque = set(range(i0 + 1, i0 + n))
        texte = " ".join(mots)
        if opt.get("accent") == "fort" or (len(texte) > DEUX_LIGNES and len(mots) >= 2):
            lignes = _equilibre(mots, bloque, fort=opt.get("accent") == "fort")
        else:
            lignes = [texte]
        spec = ["|".join(lignes)]
        if dore: spec.append(dore)
        if opt: spec.append(opt)
        out.append(spec)
    return out


def _ancre_unite(A, x, sorte):
    """« mot#n » / « w12 » (un mot), ou {"a": ancre, "mots": n} (une expression de n mots) -> (indice dans A.mots, n)."""
    if isinstance(x, str): a, n = x, 1
    elif isinstance(x, dict) and "a" in x: a, n = x["a"], int(x.get("mots", 1))
    else: raise VT.Faute(f"sous_titres : {sorte} illisible ({x!r}) : « mot#n », « w12 » ou {{\"a\": ancre, \"mots\": n}}")
    m = A.mot(a)
    if m is None: raise VT.Faute(f"sous_titres : {sorte} « {a} » n'est pas un mot")
    return m["i"], n


def developper_sous_titres(tl, A, res0):
    """Remplace chaque élément sous_titres « auto » par des éléments sous_titres explicites (un par passage entre deux
    moments sans sous-titres : titre du hook, plein écran à mots, CTA)."""
    excl = VT.exclusions_sous_titres(res0) if res0 else []
    elements = []
    for e in tl.get("elements", []):
        if e.get("type") != "sous_titres" or not e.get("auto"):
            elements.append(e); continue
        i0 = A.mot(e["depuis"])["i"] if e.get("depuis") else 0
        i1 = A.mot(e["jusqua"])["i"] if e.get("jusqua") else len(A.mots) - 1
        dores = [(*_ancre_unite(A, x, "doré"), "dore") for x in e.get("dores", [])]
        forts = [(*_ancre_unite(A, x, "accent fort"), "fort") for x in e.get("forts", [])]
        hors = lambda m: any(d0 - VT.TOL < m["start"] - VT.AV_TEXTE < d1 for d0, d1, _ in excl)
        passage = []

        def pose():
            if not passage: return
            loc = {g["i"]: j for j, g in enumerate(passage)}
            dl = [(loc[k], n, s) for k, n, s in dores if k in loc]
            fl = [(loc[k], n, s) for k, n, s in forts if k in loc]
            for k, n, s in dl + fl:
                if any(k + q not in range(len(passage)) for q in range(n)):
                    raise VT.Faute(f"sous_titres auto : l'expression qui commence à « {passage[k]['text']} » est coupée par un moment sans sous-titres")
            specs = groupes_auto(passage, A.joints, dl, fl)
            elements.append({"type": "sous_titres", "depuis": f"w{passage[0]['r']}", "groupes": specs, "_auto": True})
            passage.clear()

        for m in A.mots[i0:i1 + 1]:
            if hors(m): pose()
            else: passage.append(m)
        pose()
    return dict(tl, elements=elements)


def resoudre(w, commande=False):
    """Rend (plan résolu, fautes, avertissements, plan développé). Le plan développé est celui qui a été validé (sous-titres
    automatiques écrits en groupes) : il est gardé à côté (`animations-yoan/plan-developpe.json`) pour relecture."""
    f, tl = lire_plan(w)
    tl["_fichier"] = str(f)
    tl["_rush"] = ""
    tl["_prep"] = str(w)
    VT.COMMANDE = commande
    for x in ("edl.json", "words.cut.json"):
        if not (w / x).exists(): raise PlanFaux(f"COUPES_INTROUVABLES : {x} manque (couper-silences d'abord).")
    edl = json.loads((w / "edl.json").read_text()); wc = json.loads((w / "words.cut.json").read_text())
    A = VT.Ancres(wc["words"], edl)
    try:
        if any(e.get("type") == "sous_titres" and e.get("auto") for e in tl.get("elements", [])):
            sans = dict(tl, elements=[e for e in tl.get("elements", []) if e.get("type") != "sous_titres"])
            res0, f0, _ = VT.resoudre(sans)
            if f0: return None, f0, [], tl
            tl = developper_sous_titres(tl, A, res0)
    except VT.Faute as x:
        return None, [str(x)], [], tl
    res, fautes, avert = VT.resoudre(tl)
    if res is not None and not fautes:
        fautes += contraintes_moteur(res)
    return res, fautes, avert, tl


# ------------------------------------------------------------------------------------------------ moteur de Romain
ZOOM_APRES_COUPE = 0.2                              # zooms.py : ECART_COUPE_ECLAIR
ZOOM_TENU = {"eclair": 0.4, "rapprochement": 1.1}   # zooms.py : TENU_MIN
def contraintes_moteur(res):
    """Ce que le pipeline de Yoan sait faire et que le moteur de Romain (zooms, rendu) ne sait pas : refusé avec la
    raison, pour que le plan reste exécutable et que l'aperçu montre ce qui sera fabriqué."""
    out = []
    J = res["joints"]; D = res["duree"]
    hook = next((r for r in res["elements"] if r["type"] == "hook"), None)
    zs = []
    for r in res["elements"]:
        if r["type"] != "zoom": continue
        t0 = r["a"] + VT.AV_ZOOM   # la brique zooms part du début transcrit du mot
        typ = "eclair" if r["geste"] == "eclair" else "rapprochement"
        avant = max([0.0] + [j for j in J if j <= t0 + 1e-6]); apres = min([j for j in J if j > t0 + 1e-6] + [D])
        if hook and t0 < hook["a"] - VT.TOL:
            out.append(f"{r['_nom']} : zoom pendant le hook (le cadre du hook est fixe jusqu'à sa sortie)")
        if typ == "eclair" and t0 - avant < ZOOM_APRES_COUPE:
            out.append(f"{r['_nom']} : zoom éclair {t0 - avant:.2f} s après une coupe : il se lirait comme un punch-in sur la coupe "
                       f"(au moins {ZOOM_APRES_COUPE} s) ; prends un mot plus loin")
        if apres - t0 < ZOOM_TENU[typ]:
            out.append(f"{r['_nom']} : une coupe arrive {apres - t0:.2f} s après le départ du zoom (il faut {ZOOM_TENU[typ]} s : le zoom "
                       f"tient jusqu'à la coupe suivante) ; prends un mot plus tôt")
        zs.append((t0, min(apres, t0 + 4.0) if apres - t0 <= 4.0 else apres, r["_nom"]))
    zs.sort()
    for (a0, a1, na), (b0, b1, nb) in zip(zs, zs[1:]):
        if b0 < a1 - 1e-3: out.append(f"{na} et {nb} : deux zooms dans le même plan (le premier tient jusqu'à la coupe qui suit)")
    if hook:
        if hook["a"] < 1.0: out.append("hook : il sort avant 1 s (le dézoom d'ouverture du moteur dure au moins 1 s)")
    PE = STYLE["pleinEcran"]
    for r in res["elements"]:
        if r["type"] != "plein_ecran": continue
        for l in r["lignes"]:
            t = " ".join(x[0] for x in l)
            lg = VT.largeur_satoshi(t.replace(" ", ""), PE["taille"], PE["interlettrage"]) + 0.25 * PE["taille"] * (len(l) - 1)
            if lg > PE["largeur"]:
                out.append(f"{r['_nom']} : ligne « {t} » trop large pour le plein écran ({lg:.0f} px pour {PE['largeur']}) : "
                           f"coupe-la (11 caractères par ligne environ, comme « LE PROBLÈME »)")
    for r in res["elements"]:
        n = r["_nom"]
        if r["type"] == "suivi":
            out.append(f"{n} : le suivi de tête n'existe pas dans ce moteur (cadre fixe) : retire-le")
        if r["type"] == "broll":
            out.append(f"{n} : le B-roll « dossier » de démonstration n'existe pas ici ; ses plans filmés passent par la brique b-roll")
        if r["type"] == "zoom":
            s = r.get("sortie")
            if r["geste"] == "eclair" and s and s["geste"] != "coupe":
                out.append(f"{n} : sortie « {s['geste']} » : dans ce moteur, un zoom tient jusqu'à la coupe qui le ferme ; "
                           f"écris sortie coupe (sur une coupe de prise @coupeN, ou dans un blanc)")
            if r["geste"] in ("adouci", "lent") and s and s["geste"] in ("dezoom_eclair", "dezoom_lent"):
                out.append(f"{n} : sortie « {s['geste']} » impossible ici : le rapprochement tient jusqu'à la coupe suivante")
    return out
