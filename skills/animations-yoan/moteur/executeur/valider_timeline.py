#!/usr/bin/env python3
"""Validateur du contrat de timeline (CONTRAT-TIMELINE.md). Résout toutes les ancres sur words.cut.json et l'EDL de la
préparation, contrôle les règles du style qui se vérifient sur le papier, et rend la timeline résolue (temps de sortie
en secondes) que monter.py exécute.
Usage : python3 valider_timeline.py <timeline.json> [--resolue sortie.json] [--commande]   (exit 1 + liste des fautes si invalide)
--commande : un élément sur_mesure dont le calque n'existe pas encore passe en avertissement (planificateur, passe 2 :
le constructeur l'écrira) ; monter.py, lui, le refuse toujours."""
import json, re, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from style import STYLE, IPS

ICI = Path(__file__).resolve().parent
GABARITS = ICI.parent / "briques" / "gabarits"
AV_TEXTE = STYLE["entrees"]["texte"]["avance"]
AV_ZOOM = STYLE["camera"]["attaqueAvance"]
TOL = 1.5 / IPS                       # tolérance d'image (1,5 image)
DESCENTE_DEMI = STYLE["demiEcran"]["courbes"][STYLE["demiEcran"]["courbe"]]["duree"]
TYPES = {"hook", "sous_titres", "zoom", "suivi", "mot_derriere", "plein_ecran", "demi_ecran", "broll", "cta", "faisceau",
         "motion", "sur_mesure", "son"}
PONCT = "«»\"“”.,;:!?…()[]"


COMMANDE = False   # --commande : un sur_mesure sans calque est commandé au constructeur (passe 2 du planificateur)


class Faute(Exception):
    pass


def norm(w):
    return w.replace("’", "'").strip(PONCT + " ").lower()


class Ancres:
    """Résolution des ancres (« mot#n:fin+0.1 », « @coupe4 », « @debut », « @fin ») en secondes de sortie."""
    RX = re.compile(r"^(?P<base>.+?)(?:#(?P<n>\d+))?(?::(?P<bord>debut|fin))?(?P<dec>[+-]\d+(?:\.\d+)?)?$")

    def __init__(self, words, edl, scores=None):
        # r = numéro du mot dans words.cut.json (celui des textes numérotés du monteur de Romain : ancre « w12 »)
        self.mots = [dict(w, i=k, r=j, n=norm(w["text"])) for k, (j, w) in enumerate((j, w) for j, w in enumerate(words) if norm(w["text"]))]
        # une coupe de prise = un saut dans l'original ; deux morceaux contigus (contiguous_prev, couper-silences) n'en font pas
        self.joints = [s["outIn"] for s in edl["segments"][1:] if not s.get("contiguous_prev")]
        self.duree = edl["segments"][-1]["outOut"]
        self.scores = scores or {}
        self.avert = []

    def occurrences(self, mot):
        return [m for m in self.mots if m["n"] == norm(mot)]

    def mot(self, a):
        """Le mot de l'ancre (dict de words.cut), ou None pour une ancre spéciale."""
        m = self.RX.match(a.strip())
        if not m or m["base"].startswith("@"): return None
        wn = re.fullmatch(r"w(\d+)", m["base"])
        if wn:   # ancre numérotée (monteur de Yoan dans la structure de Romain) : numéro de words.cut.json
            w = next((x for x in self.mots if x["r"] == int(wn[1])), None)
            if w is None: raise Faute(f"ancre « {a} » : pas de mot n°{wn[1]} dans words.cut.json (ou c'est une ponctuation seule)")
            return w
        occ = self.occurrences(m["base"])
        if not occ: raise Faute(f"ancre « {a} » : le mot « {m['base']} » n'est pas dans words.cut.json")
        if m["n"] is None:
            if len(occ) > 1:
                raise Faute(f"ancre « {a} » : « {m['base']} » apparaît {len(occ)} fois (" +
                            ", ".join(f"#{k + 1} à {o['start']:.2f} s" for k, o in enumerate(occ)) + ") : préciser #n")
            return occ[0]
        n = int(m["n"])
        if not 1 <= n <= len(occ): raise Faute(f"ancre « {a} » : « {m['base']} » n'a que {len(occ)} occurrence(s)")
        return occ[n - 1]

    def t(self, a, avance=AV_TEXTE, brut=False):
        """Instant de l'ancre. Attaque d'un mot : moins l'avance (sauf brut=True). Lève Faute si irrésoluble."""
        if not isinstance(a, str): raise Faute(f"ancre attendue (chaîne), reçu {a!r}")
        m = self.RX.match(a.strip())
        if not m: raise Faute(f"ancre illisible : « {a} »")
        dec = float(m["dec"]) if m["dec"] else 0.0
        base = m["base"]
        if base.startswith("@"):
            if base == "@debut": t = 0.0
            elif base == "@fin": t = self.duree
            elif re.fullmatch(r"@coupe\d+", base):
                k = int(base[6:])
                if not 1 <= k <= len(self.joints): raise Faute(f"ancre « {a} » : l'EDL n'a que {len(self.joints)} jointures")
                t = self.joints[k - 1]
            else: raise Faute(f"ancre spéciale inconnue : « {a} » (@debut, @fin, @coupeN)")
            return round(t + dec, 4)
        w = self.mot(a)
        sc = self.scores.get(w.get("src"))
        if sc is not None and sc < 0.2: self.avert.append(f"ancre « {a} » : alignement peu sûr (score {sc:.2f})")
        if m["bord"] == "fin": t = w["end"]
        else: t = w["start"] - (0 if brut else avance)
        return round(t + dec, 4)

    def mots_suivants(self, a, n):
        """Les n mots de la voix à partir du mot de l'ancre."""
        w = self.mot(a)
        if w is None: raise Faute(f"« {a} » : il faut une ancre de mot")
        return self.mots[w["i"]:w["i"] + n]

    def dans_mot(self, t):
        return next((m for m in self.mots if m["start"] + 0.01 < t < m["end"] - 0.01), None)


def charger(chemin):
    chemin = Path(chemin).resolve()
    tl = json.loads(chemin.read_text())
    rel = lambda p: (chemin.parent / p).resolve() if not Path(p).is_absolute() else Path(p)
    tl["_fichier"] = str(chemin)
    # Monteur de Yoan : le plan vit dans le dossier de montage (words.cut.json, edl.json à côté) et la rush est celle
    # d'info.json ; « rush » et « preparation » restent possibles (timeline du pipeline d'origine).
    tl["_rush"] = str(rel(tl["rush"])) if tl.get("rush") else ""
    tl["_prep"] = str(rel(tl.get("preparation", ".")))
    return tl


def spec_groupes(g):
    if not isinstance(g, list) or not g or not isinstance(g[0], str): raise Faute(f"groupe de sous-titres illisible : {g!r}")
    texte = g[0]; dore = g[1] if len(g) > 1 and isinstance(g[1], str) else None
    opt = next((x for x in g[1:] if isinstance(x, dict)), {})
    mots = [w for ligne in texte.split("|") for w in ligne.split()]
    return texte, dore, opt, mots


def verifier_dore(texte, dore, opt, mots):
    """Le doré d'un groupe : un mot, ou une EXPRESSION de plusieurs mots qui se suivent sur une même ligne (retours de Yoan du
    2026-10-23 : « UNE SEULE FOIS », « HYPER GÉNÉRALISTES » s'accentuent en entier). accent « fort » : le groupe entier est
    l'expression (présentation du CTA sans ses lignes), deux lignes au plus, chaque ligne dans la largeur sûre."""
    acc = opt.get("accent")
    if acc not in (None, "fort"): raise Faute(f"sous_titres « {texte} » : accent « fort » seulement")
    if dore is None:
        if acc: raise Faute(f"sous_titres « {texte} » : accent fort sans expression dorée")
        return
    kw = dore.split()
    occ = [j for j in range(len(mots)) if mots[j:j + len(kw)] == kw]
    if len(occ) != 1:
        quoi = "le mot doré" if len(kw) == 1 else "l'expression dorée"
        raise Faute(f"sous_titres « {texte} » : {quoi} « {dore} » doit apparaître une fois dans le groupe (mots qui se suivent)")
    if len(kw) > 1 and not acc:
        lignes = [l.split() for l in texte.split("|")]; j0 = occ[0]; n = 0
        for l in lignes:
            if n <= j0 < n + len(l) and j0 + len(kw) > n + len(l):
                raise Faute(f"sous_titres « {texte} » : l'expression dorée « {dore} » tient sur une seule ligne (crochets autour)")
            n += len(l)
    if acc:
        if kw != mots: raise Faute(f"sous_titres « {texte} » : accent fort = le groupe entier est l'expression dorée (« {dore} »)")
        AF = STYLE["sousTitres"]["accentFort"]
        if len(texte.split("|")) > 2: raise Faute(f"sous_titres « {texte} » : accent fort sur deux lignes au plus")
        for l in texte.split("|"):
            larg = largeur_satoshi(l.strip().replace(" ", ""), AF["taille"], AF["interlettrage"]) + 2 * STYLE["sousTitres"]["espace"] * AF["taille"] * len(l.split())
            if larg > AF["largeurMax"] - 2 * AF["plus"]["marge"]["x"]:
                raise Faute(f"sous_titres « {texte} » : ligne « {l} » trop large en accent fort ({larg:.0f} px), couper la ligne")


_GLY = None
def largeur_satoshi(m, taille, ls=0.0):
    global _GLY
    if _GLY is None: _GLY = json.loads((ICI.parent / "briques" / "encre" / "satoshi-glyphes.json").read_text())
    return sum(_GLY["chars"][c]["adv"] * taille / _GLY["upm"] + ls * taille for c in m if c in _GLY["chars"])


def resoudre(tl):
    """Rend (timeline résolue, fautes, avertissements)."""
    fautes, avert = [], []
    prep = Path(tl["_prep"])
    for f in ("edl.json", "words.cut.json"):
        if not (prep / f).exists(): return None, [f"préparation : {prep / f} introuvable"], []
    if tl["_rush"] and not Path(tl["_rush"]).exists(): fautes.append(f"rush introuvable : {tl['_rush']}")
    edl = json.loads((prep / "edl.json").read_text()); wc = json.loads((prep / "words.cut.json").read_text())
    scores = {}
    src = wc.get("remap_source")
    if src and Path(src).exists():
        scores = {k: w.get("align_score") for k, w in enumerate(json.loads(Path(src).read_text())["words"])}
    A = Ancres(wc["words"], edl, scores)
    if tl.get("contrat") != "timeline/1": fautes.append("contrat : « timeline/1 » attendu")
    if tl.get("densite") not in ("sobre", "dense"): fautes.append("densite : « sobre » ou « dense »")
    amb = tl.get("ambiance")
    if amb is not None and amb not in STYLE["son"]["musique"]["ambiances"]:
        fautes.append(f"ambiance inconnue : {amb} ({', '.join(STYLE['son']['musique']['ambiances'])} ou null)")
    R = []
    for i, e in enumerate(tl.get("elements", [])):
        nom = f"élément {i} ({e.get('type', '?')})"
        try:
            if e.get("type") not in TYPES: raise Faute(f"type inconnu : {e.get('type')!r}")
            r = resoudre_element(e, A, tl)
            r["_i"] = i; r["_nom"] = nom; R.append(r)
        except Faute as x:
            fautes.append(f"{nom} : {x}")
    res = dict(rush=tl["_rush"], preparation=tl["_prep"], densite=tl.get("densite"), ambiance=amb, duree=A.duree,
               joints=A.joints, segments=edl["segments"], fps=edl.get("fps", IPS), elements=R)
    if not fautes: regles(res, A, fautes, avert)
    avert += A.avert
    return res, fautes, sorted(set(avert), key=avert.index)


def fenetre(e, A, cle_de="de", cle_a="a", **kw):
    if cle_de not in e or cle_a not in e: raise Faute(f"champs « {cle_de} » et « {cle_a} » obligatoires")
    de, a = grille(A.t(e[cle_de], **kw)), grille(A.t(e[cle_a], **kw))   # fenêtres et faisceaux sur la grille des images
    if not (0 <= de < a <= A.duree + 1e-6): raise Faute(f"fenêtre {de:.3f} -> {a:.3f} s hors du reel (0 -> {A.duree:.3f}) ou vide")
    return de, a


def grille(t):
    return round(t * IPS) / IPS


def params(p, A):
    """Remplace chaque {"@": ancre} par un instant absolu {"@t": s} (le pilote le rend relatif au calque)."""
    if isinstance(p, dict):
        if set(p) == {"@"}: return {"@t": A.t(p["@"])}
        return {k: params(v, A) for k, v in p.items()}
    if isinstance(p, list): return [params(v, A) for v in p]
    return p


def gabarit_connu(g):
    if g == "champ-chat" or (GABARITS / g / "gabarit.mjs").exists(): return
    raise Faute(f"gabarit inconnu : {g} (dossiers de briques/gabarits/ ou champ-chat)")


def contenu(c, A):
    if not isinstance(c, dict) or "gabarit" not in c: raise Faute("contenu : {\"gabarit\": ..., \"params\": {...}} attendu")
    gabarit_connu(c["gabarit"])
    def imbriques(p):
        if isinstance(p, dict):
            if "gabarit" in p: gabarit_connu(p["gabarit"])
            for v in p.values(): imbriques(v)
        elif isinstance(p, list):
            for v in p: imbriques(v)
    imbriques(c.get("params", {}))
    return dict(gabarit=c["gabarit"], params=params(c.get("params", {}), A))


def resoudre_element(e, A, tl):
    T = e["type"]; r = dict(type=T)
    if T == "hook":
        if not isinstance(e.get("lignes"), list) or len(e["lignes"]) != 2: raise Faute("hook : deux lignes")
        mots = [w for l in e["lignes"] for w in l.split()]
        if e.get("dore") not in mots: raise Faute(f"hook : le mot doré « {e.get('dore')} » n'est pas dans le titre")
        if e.get("sortie", "dezoom_eclair") not in ("dezoom_eclair", "coupe"): raise Faute("hook : sortie dezoom_eclair ou coupe")
        if "etiquette" in e:
            raise Faute("hook : « etiquette » n'existe plus (2026-10-23) : écrire « secondaire », un second hook visuel qui donne envie "
                        "de rester (ex. « COMMENT DONNER|TA VOIX À UNE IA »), jamais une catégorie comme « IA POUR COACHS »")
        r.update(lignes=e["lignes"], dore=e["dore"], de=0.0, a=A.t(e["jusqua"]), sortie=e.get("sortie", "dezoom_eclair"))
        # cadre (2026-10-23) : « serre » (défaut) ou « large » quand une animation se pose là où pointe la main ; « vers » :
        # côté du geste (la tête se décale de l'autre côté)
        cad = e.get("cadre", "serre"); vers = None
        if isinstance(cad, dict): vers = cad.get("vers"); cad = cad.get("variante", "serre")
        VC = STYLE["hook"]["camera"].get("variantes", {})
        if cad not in VC or cad.startswith("_"): raise Faute(f"hook : cadre « {cad} » inconnu ({', '.join(k for k in VC if not k.startswith('_'))})")
        if vers not in (None, "droite", "gauche"): raise Faute("hook : cadre.vers = droite ou gauche")
        v = VC[cad]; dx = v.get("decalage", 0) * (-1 if vers == "droite" else 1 if vers == "gauche" else 0)
        r["cadre"] = dict(zoom=v["zoom"], cheveuxY=v["cheveuxY"], teteX=STYLE["format"]["largeur"] / 2 + dx, variante=cad, vers=vers)
        # ouverture : les mots dits avant le titre, en groupes ancrés sur la voix (comme sous_titres)
        ouv = e.get("ouverture")
        fin_ouv = None
        if ouv is not None:
            if not isinstance(ouv, dict) or not ouv.get("groupes"): raise Faute("hook : ouverture = {\"depuis\"?: ancre, \"groupes\": [...]}")
            gs = [spec_groupes(g) for g in ouv["groupes"]]
            n = sum(len(g[3]) for g in gs)
            voix = A.mots_suivants(ouv["depuis"], n) if ouv.get("depuis") else A.mots[:n]
            titre_n = {norm(w) for w in mots}
            k = 0; groupes = []
            for texte, dore, opt, ms in gs:
                if len(texte.split("|")) > 2: raise Faute(f"hook, ouverture « {texte} » : deux lignes au plus (celles du titre)")
                if dore is not None and sum(1 for w in ms if w == dore) != 1:
                    raise Faute(f"hook, ouverture « {texte} » : le mot doré « {dore} » doit apparaître une fois dans le groupe")
                lignes = []
                for li, ligne in enumerate(texte.split("|")):
                    lg = []
                    for w in ligne.split():
                        if k >= len(voix): raise Faute("hook, ouverture : plus de mots affichés que de mots dans la voix")
                        v = voix[k]
                        if norm(w) != v["n"]: raise Faute(f"hook, ouverture « {texte} » : « {w} » affiché, la voix dit « {v['text']} » à {v['start']:.2f} s")
                        if norm(w) in titre_n: raise Faute(f"hook, ouverture : « {w} » est un mot du titre (le titre ne se double pas en sous-titres)")
                        lg.append([w, round(v["start"] - AV_TEXTE, 4), w == dore]); k += 1
                    lignes.append(lg)
                groupes.append(dict(texte=texte, lignes=lignes))
            fin_ouv = voix[n - 1]
            r["ouverture"] = groupes
        if e.get("titre"): t_titre = A.t(e["titre"])
        elif fin_ouv is not None: t_titre = round(A.mots[fin_ouv["i"] + 1]["start"] - AV_TEXTE, 4)
        else: t_titre = STYLE["hook"]["titre"]["rythme"]["debut"]
        if fin_ouv is not None and t_titre < fin_ouv["start"]: raise Faute("hook : le titre commence avant le dernier mot de l'ouverture")
        if not 0 <= t_titre < r["a"]: raise Faute(f"hook : le titre commence à {t_titre:.2f} s, hors du hook")
        r["titre_t"] = t_titre
        sec = e.get("secondaire")
        if sec is not None:
            SC = STYLE["hook"]["secondaire"]
            lg = [l.strip() for l in sec.split("|")] if isinstance(sec, str) else []
            if not lg or not all(lg): raise Faute("hook : secondaire = une chaîne, « | » pour aller à la ligne")
            if len(lg) > SC["lignesMax"]: raise Faute(f"hook : secondaire en {SC['lignesMax']} lignes au plus")
            if sec != sec.upper(): raise Faute("hook : secondaire en MAJUSCULES")
            for l in lg:
                if len(l) > SC["caracteresMax"]: raise Faute(f"hook : ligne « {l} » du secondaire trop longue ({len(l)} car., {SC['caracteresMax']} au plus)")
            r["secondaire"] = lg
    elif T == "sous_titres":
        gs = [spec_groupes(g) for g in e.get("groupes", [])]
        if not gs: raise Faute("sous_titres : groupes vides")
        n = sum(len(g[3]) for g in gs)
        voix = A.mots_suivants(e["depuis"], n)
        if len(voix) < n: raise Faute(f"sous_titres : {n} mots affichés, il ne reste que {len(voix)} mots dans la voix")
        k = 0; groupes = []
        for texte, dore, opt, mots in gs:
            verifier_dore(texte, dore, opt, mots)
            for w in mots:
                v = voix[k]
                if norm(w) != v["n"]:
                    raise Faute(f"sous_titres « {texte} » : « {w} » affiché, la voix dit « {v['text']} » à {v['start']:.2f} s")
                k += 1
            groupes.append(dict(texte=texte, dore=dore, crochets=opt.get("crochets", True), **({"accent": opt["accent"]} if opt.get("accent") else {})))
        r.update(groupes=groupes, mots=[dict(w=v["text"], t=v["start"], fin=v["end"]) for v in voix],
                 de=round(voix[0]["start"] - STYLE["sousTitres"]["debutAvantMot"], 4),
                 a=round(min(A.duree, voix[-1]["end"] + STYLE["sousTitres"]["finApresMot"]), 4))
    elif T == "zoom":
        g = e.get("geste")
        if g not in ("eclair", "adouci", "lent"): raise Faute("zoom : geste eclair, adouci ou lent")
        r.update(geste=g, a=A.t(e["a"], avance=AV_ZOOM))
        if g == "lent":
            if "fin" not in e: raise Faute("zoom lent : « fin » obligatoire")
            r["fin"] = A.t(e["fin"], avance=AV_ZOOM)
            if r["fin"] <= r["a"]: raise Faute("zoom lent : fin avant le début")
        s = e.get("sortie")
        if g == "eclair" and not s: raise Faute("zoom éclair : une sortie est obligatoire (coupe, dezoom_eclair, dezoom_lent)")
        if s:
            if s.get("geste") not in ("coupe", "dezoom_eclair", "dezoom_lent", "retour_adouci"):
                raise Faute("sortie : coupe, dezoom_eclair, dezoom_lent ou retour_adouci")
            if g == "eclair" and s["geste"] == "retour_adouci": raise Faute("zoom éclair : sortie coupe, dezoom_eclair ou dezoom_lent")
            so = dict(geste=s["geste"], a=A.t(s["a"], avance=AV_ZOOM))
            if s["geste"] == "dezoom_lent":
                if "fin" not in s: raise Faute("dézoom lent : « fin » obligatoire")
                so["fin"] = A.t(s["fin"], avance=AV_ZOOM)
            if so["a"] <= r.get("fin", r["a"]): raise Faute("sortie du zoom avant le zoom")
            r["sortie"] = so
        r["de"] = r["a"]; r["a_fin"] = (r.get("sortie") or {}).get("fin", (r.get("sortie") or {}).get("a", r.get("fin", r["a"])))
    elif T == "suivi":
        r["de"], r["a"] = fenetre(e, A)
    elif T == "mot_derriere":
        if not e.get("mot"): raise Faute("mot_derriere : « mot » obligatoire")
        r.update(mot=e["mot"], de=A.t(e["a"]), a=A.t(e["jusqua"]))
        if r["a"] <= r["de"]: raise Faute("mot_derriere : jusqua avant a")
    elif T == "plein_ecran":
        r["de"], r["a"] = fenetre(e, A)
        if e.get("variante") not in ("seule", "milieu"): raise Faute("plein_ecran : variante seule ou milieu")
        lignes = e.get("lignes") or []
        if not lignes: raise Faute("plein_ecran : lignes vides")
        dore = e.get("dore")
        if e["variante"] == "milieu" and not dore: raise Faute("plein_ecran milieu : un mot doré est obligatoire")
        cur = next((m["i"] for m in A.mots if m["start"] >= r["de"] - 0.3), len(A.mots)); out = []; vu_dore = 0
        for l in lignes:
            ligne = []
            for w in l.split():
                j = next((m["i"] for m in A.mots[cur:] if m["n"] == norm(w)), None)
                if j is None or A.mots[j]["start"] > r["a"]:
                    raise Faute(f"plein_ecran : « {w} » introuvable dans la voix entre {r['de']:.2f} et {r['a']:.2f} s (dans l'ordre)")
                k = w == dore; vu_dore += k
                ligne.append([w, A.mots[j]["start"], k]); cur = j + 1
            out.append(ligne)
        if dore and vu_dore != 1: raise Faute(f"plein_ecran : le mot doré « {dore} » doit apparaître une fois")
        r.update(variante=e["variante"], lignes=out, dore=dore)
    elif T == "demi_ecran":
        r["de"], r["a"] = fenetre(e, A)
        r["contenu"] = contenu(e.get("contenu"), A)
        b = e.get("bascule")
        if b:
            if b.get("type") not in ("pousse", "faisceau"): raise Faute("bascule : pousse ou faisceau")
            r["bascule"] = dict(type=b["type"], t=grille(A.t(b["a"])))
            if not r["de"] < r["bascule"]["t"] < r["a"]: raise Faute("bascule hors de la fenêtre du demi-écran")
        r["sortie"] = e.get("sortie", "coupe" if b else "remonte")
        if r["sortie"] not in ("remonte", "coupe"): raise Faute("demi_ecran : sortie remonte ou coupe")
    elif T == "broll":
        r["de"], r["a"] = fenetre(e, A)
        if e.get("visuel") != "dossier": raise Faute("broll : seul le visuel « dossier » existe (visuel de démonstration)")
        an = e.get("annotations") or []
        if len(an) != 3: raise Faute("broll « dossier » : trois annotations (anciens contenus, vocaux, transcription)")
        r["annotations"] = [A.t(x, brut=True) for x in an]
        if not all(r["de"] < x < r["a"] for x in r["annotations"]): raise Faute("broll : annotation hors de la fenêtre")
    elif T == "cta":
        if e.get("support") not in ("camera", "fond"): raise Faute("cta : support camera ou fond")
        if e.get("position") not in (None, "tete"):   # torse abandonné (3e passage de Yoan, 2026-10-23)
            raise Faute("cta : sur la caméra, le CTA va au-dessus de la tête, sans la chevaucher (le torse est abandonné : « il faut juste que ce soit au-dessus de ma tête pour que les 2 ne se superposent pas »)")
        r["position"] = "tete"
        q = e.get("quand") or {}
        for k in ("consigne", "mot", "bas") + (("faisceau",) if e["support"] == "fond" else ()):
            if k not in q: raise Faute(f"cta : quand.{k} obligatoire")
        r.update(support=e["support"], mot=e["mot"], consigne=e["consigne"], bas=e["bas"],
                 quand={k: (grille(A.t(v)) if k == "faisceau" else A.t(v)) for k, v in q.items()}, a=A.t(e.get("jusqua", "@fin")))
        r["de"] = min(r["quand"].values())
        if r["a"] <= r["de"]: raise Faute("cta : jusqua avant le CTA")
    elif T == "faisceau":
        r.update(de=grille(A.t(e["a"])), recadrage=bool(e.get("recadrage")))
        r["a"] = r["de"]
    elif T == "motion":
        r["de"], r["a"] = fenetre(e, A)
        if e.get("support") not in ("plein", "camera"): raise Faute("motion : support plein ou camera")
        c = contenu(dict(gabarit=e.get("gabarit"), params=e.get("params", {})), A)
        im = c["params"].get("image")   # une image passée à un gabarit (texture, photo) : relative au fichier timeline
        if im is not None:
            f = (Path(tl["_fichier"]).parent / im).resolve()
            if not f.exists(): raise Faute(f"motion : image {f} introuvable")
            c["params"]["image"] = str(f)
        r.update(support=e["support"], **c, tics=[A.t(x) for x in e.get("tics", [])])
    elif T == "sur_mesure":
        r["de"], r["a"] = fenetre(e, A)
        cal = (Path(tl["_fichier"]).parent / e.get("calque", "")).resolve()
        if not (cal / "index.html").exists():
            if not COMMANDE: raise Faute(f"sur_mesure : {cal}/index.html introuvable")
            A.avert.append(f"sur_mesure {e.get('calque')} : calque pas encore écrit (commandé au constructeur)")
        r.update(calque=str(cal), plein=bool(e.get("plein")), perforer=bool(e.get("perforer")), tics=[A.t(x) for x in e.get("tics", [])])
    elif T == "son":
        eff = [k for k in STYLE["son"].get("effets", {}) if not k.startswith("_")]
        if "fichier" in e:   # son propre au reel (média tiers, 3e passage de Yoan) : fichier relatif à la timeline + niveau sous la voix
            f = (Path(tl["_fichier"]).parent / e["fichier"]).resolve()
            if not f.exists(): raise Faute(f"son : fichier {f} introuvable")
            if not isinstance(e.get("sousVoix"), (int, float)): raise Faute("son avec fichier : « sousVoix » (dB, RMS actif sous la voix) obligatoire")
            r.update(fichier=str(f), sousVoix=float(e["sousVoix"])); e = dict(e, son="fichier")
        elif e.get("son") not in ("tic", "flash", "cta", "cta_lignes", *eff): raise Faute(f"son : tic, flash, cta, cta_lignes, un effet ({', '.join(eff)}) ou un fichier")
        if e.get("duree") is not None: r["duree"] = float(e["duree"])
        r.update(son=e["son"], de=A.t(e["a"])); r["a"] = r["de"]
    return r


def faisceaux(res):
    """Tous les instants de faisceau (image pleine) déduits des éléments, sans doublon (à une image près)."""
    T = []
    for r in res["elements"]:
        if r["type"] in ("plein_ecran",) or (r["type"] == "motion" and r["support"] == "plein") or (r["type"] == "sur_mesure" and r["plein"]):
            T += [r["de"], r["a"]]
        elif r["type"] == "demi_ecran" and r.get("bascule", {}).get("type") == "faisceau": T.append(r["bascule"]["t"])
        elif r["type"] == "faisceau": T.append(r["de"])
        elif r["type"] == "cta" and r["support"] == "fond": T.append(r["quand"]["faisceau"])
    # enchaînement (2026-10-23) : un plein écran qui commence là où un autre finit continue le même fond, sans faisceau
    pleins = [r for r in res["elements"] if est_plein(r)]
    jonctions = [p["a"] for p in pleins if any(abs(q["de"] - p["a"]) <= TOL and q is not p for q in pleins)]
    T = [t for t in T if not any(abs(t - j) <= TOL for j in jonctions)]
    out = []
    for t in sorted(T):
        if not out or t - out[-1] > TOL: out.append(t)
    return out


def est_plein(r):
    return r["type"] == "plein_ecran" or (r["type"] == "motion" and r.get("support") == "plein") or (r["type"] == "sur_mesure" and r.get("plein"))


def chaines_pleins(E):
    """Pleins écrans enchaînés (le suivant commence où le précédent finit) : un seul état plein pour le rythme."""
    ps = sorted((r for r in E if est_plein(r)), key=lambda r: r["de"]); out = []
    for r in ps:
        if out and abs(out[-1][-1]["a"] - r["de"]) <= TOL: out[-1].append(r)
        else: out.append([r])
    return out


def exclusions_sous_titres(res):
    ex = []
    for r in res["elements"]:
        if r["type"] == "hook": ex.append((0.0, r["a"], "titre du hook"))
        elif r["type"] == "plein_ecran": ex.append((r["de"], r["a"], "plein écran à mots"))
        elif r["type"] == "cta": ex.append((r["de"], r["a"], "CTA"))
    return ex


def densite(res):
    """Événements de montage visibles (REGLES.md, Densité), fusionnés à moins de 0,35 s."""
    ev = [(t, "faisceau") for t in faisceaux(res)]
    for r in res["elements"]:
        T = r["type"]
        if T == "hook": ev += [(0.0, "hook"), (r["a"], "sortie du hook")]
        elif T == "zoom":
            if r["geste"] in ("eclair", "adouci"): ev.append((r["a"], f"zoom {r['geste']}"))
            s = r.get("sortie")
            if s and s["geste"] in ("coupe", "dezoom_eclair", "retour_adouci"): ev.append((s["a"], s["geste"]))
        elif T == "plein_ecran": ev += [(l[0][1], "ligne") for l in r["lignes"][1:]]
        elif T == "demi_ecran":
            ev.append((r["de"], "demi-écran")); ev.append((r["a"], "sortie du demi-écran"))
            if r.get("bascule", {}).get("type") == "pousse": ev.append((r["bascule"]["t"], "bascule"))
        elif T == "broll": ev += [(r["de"], "B-roll"), (r["a"], "fin du B-roll")]
        elif T in ("cta", "mot_derriere"): ev.append((r["de"], T))
        elif T == "motion": ev.append((r["de"], f"motion {r['gabarit']}"))
        elif T == "sur_mesure": ev.append((r["de"], "sur mesure"))
    ev.sort()
    out = []
    for t, l in ev:
        if not out or t - out[-1][0] >= 0.35: out.append((t, l))
    return out


def regles(res, A, fautes, avert):
    E = res["elements"]; D = res["duree"]
    F = faisceaux(res)
    caches = lambda j: (
        any(abs(t - j) <= TOL for t in F)
        or any(r["type"] == "zoom" and r.get("sortie") and r["sortie"]["geste"] in ("coupe", "dezoom_eclair") and abs(r["sortie"]["a"] - j) <= TOL for r in E)
        or any(r["type"] == "hook" and abs(r["a"] - j) <= TOL for r in E)
        or any(r["type"] == "faisceau" and abs(r["de"] - j) <= TOL for r in E)
        or any(r["type"] in ("plein_ecran", "broll") and r["de"] - TOL <= j <= r["a"] + TOL for r in E)
        or any(r["type"] in ("motion", "sur_mesure") and r.get("support", "plein" if r.get("plein") else "") == "plein" and r["de"] - TOL <= j <= r["a"] + TOL for r in E)
        or any(r["type"] == "demi_ecran" and (
            (r["de"] - TOL <= j <= r["de"] + DESCENTE_DEMI and j < r["a"])
            or (r["sortie"] == "coupe" and abs(r["a"] - j) <= TOL)
            or (r.get("bascule") and r["bascule"]["t"] + (STYLE["demiEcran"]["bascule"]["duree"] if r["bascule"]["type"] == "pousse" else 0) <= j <= r["a"] + TOL)) for r in E)
        or any(r["type"] == "cta" and r["support"] == "fond" and r["quand"]["faisceau"] - TOL <= j <= r["a"] for r in E))
    for k, j in enumerate(res["joints"]):
        if not caches(j): fautes.append(f"jointure {k + 1} (@coupe{k + 1}, {j:.3f} s) visible : aucun geste ne la cache")
    caches_cam = [(r["de"], r["a"], r["_nom"]) for r in E if r["type"] in ("plein_ecran", "broll") or (r["type"] == "motion" and r["support"] == "plein")]
    for r in E:
        if r["type"] != "zoom": continue
        ts = [r["a"]] + ([r["sortie"]["a"]] if r.get("sortie") else [])
        for t in ts:
            for d0, d1, n in caches_cam:
                if d0 + TOL < t < d1 - TOL: fautes.append(f"{r['_nom']} : zoom à {t:.3f} s pendant {n} (caméra cachée)")
        s = r.get("sortie")
        if s and r["geste"] == "eclair" and s["geste"] == "dezoom_eclair" and s["a"] - r["a"] < 0.3:
            fautes.append(f"{r['_nom']} : dézoom éclair {s['a'] - r['a']:.2f} s après le zoom éclair (au moins 0,3 s)")
        if s and s["geste"] == "coupe":
            m = A.dans_mot(s["a"])
            if m: fautes.append(f"{r['_nom']} : coupe sèche à {s['a']:.3f} s pendant le mot « {m['text']} »")
    for r in E:
        if r["type"] != "sous_titres": continue
        for m in r["mots"]:
            for d0, d1, n in exclusions_sous_titres(res):
                if d0 - TOL < m["t"] - AV_TEXTE < d1:
                    fautes.append(f"{r['_nom']} : sous-titre « {m['w']} » à {m['t']:.2f} s pendant le {n} ({d0:.2f} -> {d1:.2f} s)")
    anim = [(r["de"], r["a"]) for r in E if r["type"] in ("motion", "sur_mesure", "demi_ecran", "cta", "plein_ecran")]
    for r in E:   # l'accent fort (présentation du CTA) a son petit son à l'arrivée des « + » (3e passage, 2026-10-23)
        if r["type"] == "sous_titres":
            k = 0
            for g in r["groupes"]:
                n = sum(len(l.split()) for l in g["texte"].split("|")); ms = r["mots"][k:k + n]; k += n
                if g.get("accent"): anim.append((ms[0]["t"] - 0.1, ms[-1]["fin"] + 0.8))
    for r in E:
        if r["type"] == "son" and r["son"] not in ("flash", "cta", "cta_lignes") and not any(a0 - TOL <= r["de"] <= a1 + TOL for a0, a1 in anim):
            fautes.append(f"{r['_nom']} : son « {r['son']} » à {r['de']:.2f} s hors de toute animation (règle son : le son va sur le motion "
                          f"et les transitions, jamais sur un zoom, les sous-titres ou le mot doré)")
        if r["type"] == "son" and r["son"] == "flash" and not any(abs(t - r["de"]) <= TOL for t in F):
            avert.append(f"{r['_nom']} : flash à {r['de']:.2f} s sans faisceau")
    hooks = [r for r in E if r["type"] == "hook"]
    if len(hooks) > 1: fautes.append("un seul hook")
    if any(r["type"] == "suivi" for r in E):
        sv = sorted((r["de"], r["a"]) for r in E if r["type"] == "suivi")
        for (a0, a1), (b0, b1) in zip(sv, sv[1:]):
            if b0 < a1: fautes.append(f"suivis qui se chevauchent ({a0:.2f}-{a1:.2f} et {b0:.2f}-{b1:.2f} s)")
        for h in hooks:
            if sv[0][0] < h["a"] - TOL: fautes.append("suivi pendant le hook (le cadre du hook est fixe)")
    for r in E:   # le contenu qui entre pendant la descente du fond traverse les sous-titres (vu au test du 2026-10-23)
        if r["type"] == "demi_ecran":
            en = r["contenu"]["params"].get("entree")
            if isinstance(en, dict) and en.get("@t", 1e9) < r["de"] + DESCENTE_DEMI - TOL:
                avert.append(f"{r['_nom']} : le contenu entre {en['@t'] - r['de']:.2f} s après le début du demi-écran, pendant la descente "
                             f"({DESCENTE_DEMI} s) : il passera sur les sous-titres")
    dm = sorted((r["de"], r["a"]) for r in E if r["type"] == "demi_ecran")
    for (a0, a1), (b0, b1) in zip(dm, dm[1:]):
        if b0 < a1: fautes.append(f"demi-écrans qui se chevauchent ({a0:.2f}-{a1:.2f} et {b0:.2f}-{b1:.2f} s)")
    transitions(res, A, fautes, avert)
    ev = densite(res); par10 = len(ev) / D * 10
    res["densite_mesuree"] = dict(evenements=len(ev), par_10_s=round(par10, 2), liste=[[round(t, 3), l] for t, l in ev])
    lo, hi = (1.5, 3.5) if res["densite"] == "sobre" else (5.0, 8.0)
    if not lo <= par10 <= hi:
        avert.append(f"densité {par10:.1f} gestes / 10 s ({len(ev)} en {D:.1f} s), régime {res['densite']} attendu {lo} à {hi}")


TR = STYLE["transitions"]
DUREES_CAM = {"eclair": STYLE["camera"]["eclair"]["duree"], "dezoom_eclair": STYLE["camera"]["eclair"]["duree"],
              "adouci": STYLE["camera"]["adouci"]["duree"], "retour_adouci": STYLE["camera"]["adouci"]["retour"]["duree"], "coupe": 0.0}
NOMS_CAM = {"eclair": "zoom éclair", "dezoom_eclair": "dézoom éclair", "adouci": "zoom adouci", "retour_adouci": "retour adouci",
            "coupe": "coupe avec recadrage", "sortie_hook": "dézoom de sortie du hook"}


def mouvements_rapides(E):
    """Mouvements de caméra rapides (début, fin, nom) : zooms et dézooms éclair, adoucis, coupes de sortie, sortie du hook.
    Le zoom lent et le dézoom lent n'en sont pas (mouvement continu sur une phrase)."""
    out = []
    for r in E:
        if r["type"] == "hook" and r["sortie"] == "dezoom_eclair": out.append((r["a"], r["a"] + DUREES_CAM["dezoom_eclair"], NOMS_CAM["sortie_hook"]))
        if r["type"] != "zoom": continue
        if r["geste"] in DUREES_CAM: out.append((r["a"], r["a"] + DUREES_CAM[r["geste"]], NOMS_CAM[r["geste"]]))
        s = r.get("sortie")
        if s and s["geste"] in DUREES_CAM: out.append((s["a"], s["a"] + DUREES_CAM[s["geste"]], NOMS_CAM[s["geste"]]))
    return out


def transitions(res, A, fautes, avert):
    """Rythme des changements de monde (retours de Yoan sur la démo du 2026-10-23, seuils : style.json « transitions ») :
    pas de demi-écran collé à un mouvement de caméra rapide, pas d'état demi ou plein trop court, pas de chaîne
    demi -> plein -> caméra trop rapide, pas de retour à la caméra par une coupe nue."""
    E = res["elements"]; F = faisceaux(res); X, Y, Yc = TR["demiApresCamera"], TR["etatMin"], TR["etatConseille"]
    mv = mouvements_rapides(E)
    joint = lambda t: any(abs(t - j) <= TOL for j in res["joints"])
    for r in E:
        if r["type"] != "demi_ecran": continue
        n, de = r["_nom"], r["de"]
        for m0, m1, nom in mv:
            if m1 <= de + TOL and de - m1 < X - TOL:
                fautes.append(f"{n} : le demi-écran entre {de - m1:.2f} s après la fin du {nom} ({m0:.2f} s) ; il faut au moins {X} s "
                              f"(reel 4 : 0,9 s ; à 0,77 s, la démo v1 donnait un effet trop rapide et saccadé)")
            elif m0 < de + DESCENTE_DEMI and m1 > de + TOL:
                fautes.append(f"{n} : {nom} à {m0:.2f} s pendant l'entrée du demi-écran ({de:.2f} -> {de + DESCENTE_DEMI:.2f} s) : "
                              f"jamais collé à un mouvement de caméra rapide")
        b = r.get("bascule")
        demi = (b["t"] if b else r["a"]) - de
        plein = (r["a"] - b["t"] - (STYLE["demiEcran"]["bascule"]["duree"] if b["type"] == "pousse" else 0)) if b else None
        if b and r["sortie"] == "coupe" and (demi < Y - TOL or plein < Y - TOL):
            fautes.append(f"{n} : chaîne demi -> plein -> caméra trop rapide (demi-écran {demi:.2f} s, plein écran {plein:.2f} s) : "
                          f"chaque état tient au moins {Y} s, sinon garder un seul état")
        else:
            if demi < Y - TOL: fautes.append(f"{n} : demi-écran de {demi:.2f} s, au moins {Y} s")
            if plein is not None and plein < Y - TOL: fautes.append(f"{n} : plein écran de {plein:.2f} s après la bascule, au moins {Y} s")
        for d, quoi in ((demi, "demi-écran"), (plein, "plein écran après la bascule")):
            if d is not None and Y - TOL <= d < Yc: avert.append(f"{n} : {quoi} de {d:.2f} s, sous le plus court état du reel 4 ({Yc} s)")
        if r["sortie"] == "coupe":
            dz = any(abs(m0 - r["a"]) <= TOL and nom == NOMS_CAM["dezoom_eclair"] for m0, _, nom in mv)
            if not (joint(r["a"]) or any(abs(t - r["a"]) <= TOL for t in F) or dz):
                quoi = "plein écran" if b else "demi-écran"
                fautes.append(f"{n} : retour {quoi} -> caméra à {r['a']:.2f} s par une coupe nue : poser un faisceau, un dézoom éclair, "
                              f"ou finir sur une coupe de prise (@coupeN)")
    for ch in chaines_pleins(E):   # des pleins enchaînés comptent pour un seul état
        d = ch[-1]["a"] - ch[0]["de"]; nom = " + ".join(r["_nom"] for r in ch)
        if d < Y - TOL: fautes.append(f"{nom} : plein écran de {d:.2f} s, au moins {Y} s")
        elif d < Yc: avert.append(f"{nom} : plein écran de {d:.2f} s, sous le plus court état du reel 4 ({Yc} s)")


def valider(chemin):
    tl = charger(chemin)
    return resoudre(tl)


def main():
    global COMMANDE
    if len(sys.argv) < 2: raise SystemExit(__doc__)
    COMMANDE = "--commande" in sys.argv
    res, fautes, avert = valider(sys.argv[1])
    for a in avert: print("avertissement :", a)
    if fautes:
        print(f"timeline INVALIDE ({len(fautes)} faute(s)) :")
        for f in fautes: print("  -", f)
        sys.exit(1)
    print(f"timeline valide : {len(res['elements'])} éléments, {res['duree']:.3f} s, "
          f"densité {res['densite_mesuree']['par_10_s']} gestes / 10 s ({res['densite']})")
    if "--resolue" in sys.argv:
        Path(sys.argv[sys.argv.index("--resolue") + 1]).write_text(json.dumps(res, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
