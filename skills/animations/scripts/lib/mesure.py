#!/usr/bin/env python3
"""mesure.py : mesures de texte faites hors du navigateur, avec les polices de la bibliothèque (fontTools).

Mise en forme HarfBuzz (crénage compris, comme le navigateur) sur la police variable à la graisse du style ; repli
fontTools sans crénage (méthode du Style Lab, geometrie.py) si uharfbuzz manque. Vérifié le 2026-11-11 : sans crénage,
RÉSULTATS mesurait 39 px de trop par rapport au rendu.

Usage (sortie JSON sur stdout) :
  mesure.py encre  <titre|texte|natif> <taille_px> <texte>
  mesure.py geant  <texte> [x0 x1]                 taille pour que l'encre couvre x0..x1 (défaut zone sûre +-3 px)
  mesure.py taille <titre|texte|natif|sousTitres> <cap_px>   taille de police pour des capitales de cap_px
  mesure.py lignes <texte1> <texte2> [...]          tailles pour que chaque ligne ait la même largeur d'encre
  mesure.py metriques <titre|texte|natif>           hauteur des capitales, ascendante, descendante (en em)
"""
import json, subprocess, sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.boundsPen import BoundsPen

ICI = Path(__file__).resolve().parent
BIB = ICI.parent.parent / "bibliotheque"
C = json.loads(subprocess.run(["node", "-e", "import(process.argv[1]).then(m=>console.log(JSON.stringify(m)))",
                               (BIB / "commun.mjs").as_uri()], capture_output=True, text=True, check=True).stdout)
ZS = C["ZONE_SURE"]
GX0, GX1 = ZS["x0"] + 3, ZS["x1"] - 3
_F = {}


def fichier_police(f):
    """Police du style du client (commun.mjs, STYLE) s'il l'a, sinon celle de la bibliothèque."""
    d = (C.get("STYLE") or {}).get("dossier")
    return Path(d) / "fonts" / f if d and (Path(d) / "fonts" / f).exists() else BIB / "fonts" / f


def police(cle):
    p = C["POLICES"][cle]
    if cle not in _F:
        t = TTFont(fichier_police(p["file"]))
        if "fvar" in t:
            t = instancer.instantiateVariableFont(t, {"wght": p["poids"]})
        gs, cm, u = t.getGlyphSet(), t.getBestCmap(), t["head"].unitsPerEm
        o = t["OS/2"]
        _F[cle] = dict(t=t, gs=gs, cm=cm, u=u, b={}, asc=o.sTypoAscender / u, desc=-o.sTypoDescender / u,
                       cap=o.sCapHeight / u, x=getattr(o, "sxHeight", 0) / u)
    return _F[cle]


def _bornes(f, c):
    if c not in f["b"]:
        g = f["cm"].get(ord(c))
        if g is None:
            raise SystemExit(json.dumps({"erreur": f"caractère absent de la police : {c!r}"}, ensure_ascii=False))
        bp = BoundsPen(f["gs"]); f["gs"][g].draw(bp)
        f["b"][c] = (bp.bounds, f["t"]["hmtx"][g][0])
    return f["b"][c]


_HB = {}


def encre_hb(cle, texte, taille):
    """Encre avec la mise en forme réelle (HarfBuzz : crénage et ligatures, comme le navigateur)."""
    import uharfbuzz as hb
    p = C["POLICES"][cle]
    if cle not in _HB:
        blob = hb.Blob.from_file_path(str(fichier_police(p["file"])))
        face = hb.Face(blob); font = hb.Font(face)
        font.set_variations({"wght": p["poids"]})
        _HB[cle] = (font, face.upem)
    font, u = _HB[cle]
    buf = hb.Buffer(); buf.add_str(texte); buf.guess_segment_properties()
    hb.shape(font, buf, {"kern": True, "liga": True})
    x, g, d, hi = 0, None, None, 0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        e = font.get_glyph_extents(info.codepoint)
        if e and e.width:
            gx = x + pos.x_offset + e.x_bearing
            g = gx if g is None else min(g, gx)
            d = max(d if d is not None else gx + e.width, gx + e.width)
            hi = max(hi, e.y_bearing)
        x += pos.x_advance
    k = taille / u
    f = police(cle)
    return dict(gauche=round((g or 0) * k, 2), droite=round((d or 0) * k, 2), largeur=round(((d or 0) - (g or 0)) * k, 2),
                avance=round(x * k, 2), haut=round(hi * k, 2), cap=round(f["cap"] * taille, 2))


def approche(cle):
    """letter-spacing de la police du style (POLICES[cle]["approche"], en em), 0 sans réglage."""
    a = str(C["POLICES"][cle].get("approche", "0")).strip()
    return float(a[:-2]) if a.endswith("em") else 0.0


def encre(cle, texte, taille):
    if cle == "titre":
        texte = texte.upper()
    try:
        e = encre_hb(cle, texte, taille)
    except ImportError:
        e = encre_ft(cle, texte, taille)
    # approche (letter-spacing CSS) : le navigateur l'ajoute après chaque lettre ; l'encre s'arrête à la dernière lettre
    k = approche(cle) * taille
    if k:
        n = len(texte)
        e["droite"] = round(e["droite"] + k * (n - 1), 2)
        e["largeur"] = round(e["largeur"] + k * (n - 1), 2)
        e["avance"] = round(e["avance"] + k * n, 2)
    return e


def encre_ft(cle, texte, taille):
    """Repli sans HarfBuzz : sans crénage (le mot rendu peut être un peu plus étroit que mesuré)."""
    f = police(cle)
    if cle == "titre":
        texte = texte.upper()
    x, g, d, hi = 0.0, None, None, 0.0
    for c in texte:
        bb, av = _bornes(f, c)
        if bb:
            g = x + bb[0] / f["u"] if g is None else g
            d = x + bb[2] / f["u"]
            hi = max(hi, bb[3] / f["u"])
        x += av / f["u"]
    return dict(gauche=round((g or 0) * taille, 2), droite=round((d or 0) * taille, 2), largeur=round(((d or 0) - (g or 0)) * taille, 2),
                avance=round(x * taille, 2), haut=round(hi * taille, 2), cap=round(f["cap"] * taille, 2))


def base_dans_boite(cle, lh):
    """Position de la ligne de base sous le haut d'une boîte de line-height lh (em) : Chrome centre asc + desc."""
    f = police(cle)
    return (lh - (f["asc"] + f["desc"])) / 2 + f["asc"]


def geant(texte, x0=GX0, x1=GX1):
    e = encre("titre", texte, 100)
    taille = 100 * (x1 - x0) / e["largeur"]
    e = encre("titre", texte, taille)
    lh = C["POLICES"]["titre"]["interligne"]
    return dict(texte=texte, taille=round(taille, 2), left=round(x0 - e["gauche"], 2), cap=e["cap"], haut_encre=e["haut"],
                base_dans_boite=round(base_dans_boite("titre", lh) * taille, 2), hauteur_ligne=round(lh * taille, 2))


def lignes(textes, x0=GX0, x1=GX1, centre_y=None):
    """Même largeur d'encre pour chaque ligne (la courte agrandie, la longue réduite), bloc centré à centre_y."""
    centre_y = centre_y if centre_y is not None else C["PLEIN"]["centreY"]
    lh = C["POLICES"]["titre"]["interligne"]
    out, total = [], 0.0
    for t in textes:
        g = geant(t, x0, x1)
        out.append(g); total += lh * g["taille"]
    # Accent sur une ligne du bas (Î, É, Ç…) : à interligne serré il toucherait la ligne du dessus. On descend la ligne
    # juste ce qu'il faut pour garder ECART_ACCENT px (l'écart naturel) entre la ligne de base du dessus et le haut de l'accent (vu le
    # 2026-11-11 sur « ÇA PARAÎT LONG » : le circonflexe se collait à SEMAINES).
    ECART_ACCENT = 6   # l'écart naturel minimal entre deux lignes de capitales
    tops, top = [], 0.0
    for k, g in enumerate(out):
        if k:
            p = out[k - 1]
            base_dessus = tops[-1] + p["base_dans_boite"]
            encre_haut = top + g["base_dans_boite"] - g["haut_encre"]
            if g["haut_encre"] > g["cap"] + 4 and encre_haut < base_dessus + ECART_ACCENT:
                top += base_dessus + ECART_ACCENT - encre_haut
        tops.append(top); top += lh * g["taille"]
    decal = centre_y - top / 2
    for g, t in zip(out, tops):
        g["top"] = round(t + decal, 2)
    return out


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        raise SystemExit(__doc__)
    if a[0] == "encre":
        r = encre(a[1], a[3], float(a[2]))
    elif a[0] == "geant":
        r = geant(a[1], *(float(v) for v in a[2:4])) if len(a) >= 4 else geant(a[1])
    elif a[0] == "taille":
        r = dict(taille=round(float(a[2]) / police(a[1])["cap"], 2), cap=float(a[2]))
    elif a[0] == "lignes":
        r = lignes(a[1:])
    elif a[0] == "metriques":
        f = police(a[1]); r = dict(cap=f["cap"], asc=f["asc"], desc=f["desc"], x=f["x"])
    else:
        raise SystemExit(__doc__)
    print(json.dumps(r, ensure_ascii=False))
