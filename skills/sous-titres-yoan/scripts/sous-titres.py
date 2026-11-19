#!/usr/bin/env python3
"""sous-titres.py : les sous-titres de Yoan (skill sous-titres-yoan du monteur de Yoan).

  python3 sous-titres.py preparer <dossier>-montage

Lit le plan (`plan-montage.json`, éléments `sous_titres`, explicites ou « auto »), le résout avec le validateur du pipeline
de Yoan (skill animations-yoan) et écrit un calque HyperFrames par passage sous-titré (`calques/st00`, `st01`...) avec la
fonction sousTitres() du pipeline de Yoan : Satoshi Black 70 px en MAJUSCULES, en haut (capitales à y 256), mot par mot,
chaque mot qui entre depuis un flou 0,04 s avant sa voix, groupe qui disparaît net ; mot ou expression dorée avec son
halo et ses crochets qui se resserrent ; accent fort (l'expression en grand entre quatre « + »). Jamais pendant le titre
du hook, un plein écran à mots ou le CTA (le groupe s'arrête net avant). Sans crochets sur un plan filmé en plus (b-roll).

Les entrées vont dans calques.json avec la source « sous-titres », ordre 100 (au-dessus de tout, contrat du monteur de
Romain), `masques` vide (aucun calque de ce monteur ne porte sa propre ligne de sous-titre). À relancer après tout
changement des animations ou du plan.
Sortie : PRÊT ... ; codes : 2 fichier manquant, 3 plan refusé, 5 échec de l'écriture.
"""
import json, shutil, subprocess, sys
from datetime import date
from pathlib import Path

ICI = Path(__file__).resolve().parent
AY = ICI.parent.parent / "animations-yoan" / "scripts"
sys.path.insert(0, str(AY))
import plan as P  # noqa: E402
from plan import VT, STYLE, IPS  # noqa: E402

PILOTE = P.EXE / "pilote" / "calques.mjs"
STS = STYLE["sousTitres"]


def dire(m=""):
    print(m, flush=True)


def echec(code, m):
    dire(m); sys.exit(code)


def img(t):
    return int(round(t * IPS))


def grille(t):
    return img(t) / IPS


def brolls(w):
    """Plages (s) des plans filmés en plus posés par la brique b-roll : pas de crochets dessus (ils doubleraient le plan)."""
    f = w / "b-roll.json"
    if not f.exists(): return []
    out = []
    try:
        for b in json.loads(f.read_text(encoding="utf-8")).get("b_roll", json.loads(f.read_text(encoding="utf-8")).get("brolls", [])):
            d0, d1 = b.get("debut_image"), b.get("fin_image")
            if isinstance(d0, int) and isinstance(d1, int): out.append((d0 / IPS, d1 / IPS))
    except Exception:
        pass
    return out


def preparer(w):
    try:
        sv = P.style_video(w)          # réglages de CETTE vidéo (style-video.json), sinon le style de Yoan tel quel
        if sv: P.glyphes_sous_titres(w)  # police d'une autre famille : ses mesures (lignes, crochets)
        res, fautes, avert, tl = P.resoudre(w)
    except P.PlanFaux as e:
        echec(2, str(e))
    for a in avert: dire(f"AVERTISSEMENT {a}")
    if fautes:
        for f in fautes: dire(f"FAUTE {f}")
        echec(3, f"PLAN_REFUSÉ {len(fautes)} faute(s) : corrige plan-montage.json (skill plan-montage-yoan).")
    D = res["duree"]
    excl = VT.exclusions_sous_titres(res)
    br = brolls(w)
    runs = sorted((r for r in res["elements"] if r["type"] == "sous_titres"), key=lambda e: e["mots"][0]["t"])
    L, fiches = [], []
    for i, e in enumerate(runs):
        m0, m1 = e["mots"][0], e["mots"][-1]
        w0 = grille(max(0.0, m0["t"] - 0.1))
        w1 = min([m1["fin"] + STS["finApresMot"], D] + [d0 for d0, _, _ in excl if d0 > m1["t"]]
                 + [r["mots"][0]["t"] - STS["debutAvantMot"] for r in runs[i + 1:i + 2]])
        r = lambda t: round(t - w0, 3)
        specs, k = [], 0
        for g in e["groupes"]:
            nm = sum(len(l.split()) for l in g["texte"].split("|"))
            tg = e["mots"][k]["t"]; k += nm
            cr = g["crochets"] and not any(b0 - 0.05 <= tg <= b1 for b0, b1 in br)
            specs.append([g["texte"], g["dore"], {"crochets": cr, **({"accent": g["accent"]} if g.get("accent") else {})}])
        mots = [dict(w=m["w"], t=r(m["t"]), fin=r(m["fin"])) for m in e["mots"]]
        coup = [r(d0) for d0, _, _ in excl if w0 < d0 < w1 + 1]
        ident = f"st{i:02d}"
        debut, images = img(w0), max(1, img(w1) - img(w0))
        L.append(dict(dossier=str(w / "calques" / ident), duree=round(images / IPS, 4), polices=[STS["police"]], grain=False,
                      parts=[dict(k="sousTitres", mots=mots, specs=specs, coupures=coup)]))
        fiches.append(dict(id=ident, source="sous-titres", dossier=f"calques/{ident}", debut=debut, images=images, couche="devant",
                           ordre=100, masques=[], groupes=len(specs), dores=[s[1] for s in specs if s[1]],
                           accents_forts=[s[0] for s in specs if len(s) > 2 and s[2].get("accent")]))
    # anciens calques de sous-titres : retirés (le plan fait foi)
    cj = w / "calques.json"
    ex = json.loads(cj.read_text(encoding="utf-8")) if cj.exists() else {"calques": []}
    for c in ex.get("calques", []):
        if c.get("source") == "sous-titres":
            shutil.rmtree(w / c["dossier"], ignore_errors=True)
    lf = w / "animations-yoan" / "sous-titres-pilote.json"; lf.parent.mkdir(exist_ok=True)
    lf.write_text(json.dumps(L, ensure_ascii=False))
    if L:
        rr = subprocess.run(["node", str(PILOTE), str(lf)], capture_output=True, text=True)
        if rr.returncode != 0: echec(5, f"SOUS-TITRES_RATÉS : {rr.stderr[-2500:]}")
    for f in fiches:
        (w / f["dossier"] / "calque.json").write_text(json.dumps(dict(f, ecrit_le=date.today().isoformat()), ensure_ascii=False, indent=1) + "\n")
    autres = [c for c in ex.get("calques", []) if c.get("source") != "sous-titres"]
    miens = [{k: f[k] for k in ("id", "source", "dossier", "debut", "images", "couche", "ordre", "masques")} for f in fiches]
    cj.write_text(json.dumps({**ex, "calques": autres + miens}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    ng = sum(f["groupes"] for f in fiches); nd = sum(len(f["dores"]) for f in fiches); na = sum(len(f["accents_forts"]) for f in fiches)
    for f in fiches:
        dire(f"   {f['id']} images {f['debut']}-{f['debut'] + f['images'] - 1} : {f['groupes']} groupes"
             + (f", dorés {', '.join(f['dores'])}" if f["dores"] else "") + (f", accent fort {', '.join(f['accents_forts'])}" if f["accents_forts"] else ""))
    if sv: dire(f"   style de cette vidéo : {', '.join(sorted(sv.get('sousTitres', {}).keys()) or sorted(sv.keys()))}")
    dire(f"PRÊT sous-titres : {len(fiches)} passage(s), {ng} groupes, {nd} doré(s), {na} accent(s) fort(s)")


def main():
    if len(sys.argv) < 3 or sys.argv[1] != "preparer":
        echec(2, __doc__)
    w = P.dossier_de(sys.argv[2])
    if not (w / "words.cut.json").exists(): echec(2, f"DOSSIER_INCONNU : {w} (couper-silences d'abord)")
    preparer(w)


if __name__ == "__main__":
    main()
