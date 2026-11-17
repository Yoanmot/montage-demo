#!/usr/bin/env python3
"""ecoute.py : écoute de contrôle des sons posés (skill sound-design). Ne fait PAS le mixage final (brique rendu).

  python3 ecoute.py <dossier-montage> [--video <original>] [--biblio <bibliothèque>] [--autour <image> ...]

Fabrique la voix de la vidéo coupée exactement comme la brique rendu (même fonction, voix_coupee de
../../rendu/scripts/rendu.py : piste coupée, mono, loudnorm en deux passes I -16, TP -1,5, LRA 11), pose chaque son de
sons.json comme le rendu et le labo (mix21.py) : l'attaque du son (debut_echantillon
de sa fiche .json) tombe pile sur l'instant image / 30 s, gain tel que
  lu_sous_voix     : sonie K de la partie active du son = sonie intégrée de la voix - valeur ;
  rms_db_sous_voix : RMS actif du son = RMS de la voix parlée - valeur.
Puis MESURE ce qui a été posé, dans la piste des sons : niveau de chaque son sous la voix (tolérance ±1 dB) et
calage de son attaque sur son image (±2 ms). Crête du mix voix + sons sous SONS.cretMax (-1 dBFS) : la même mesure que
le rendu (avant le 2026-11-13, l'écoute normalisait la voix autrement et disait OK là où le rendu refusait).

Sorties dans <dossier-montage>/ecoute/ : ecoute.wav (voix + sons), sons-seuls.wav, ecoute.json (mesures),
autour-<image>.wav (2 s de part et d'autre d'une image, pour juger un son en contexte).
Lignes de sortie : MESURE ..., puis ECOUTE_OK ou ECOUTE_KO (code 1)."""
import argparse
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import numpy as np  # noqa: E402
import audio as A  # noqa: E402

SKILL = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SKILL.parent / "rendu" / "scripts"))
import rendu as R  # noqa: E402  (brique rendu installée à côté : la voix et le mix viennent d'elle)
TOL_DB = 1.0
TOL_MS = 2.0


def commun(biblio):
    out = subprocess.run(["node", "-e", f"import('{(biblio / 'commun.mjs').as_uri()}').then(m=>console.log(JSON.stringify({{SONS:m.SONS,VIDEO:m.VIDEO,STYLE:m.STYLE||{{}}}})))"],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def fiche(chemin, sons_dir, nom):
    if nom.startswith("frappes/"):
        return json.loads((sons_dir / "frappes.json").read_text())[Path(nom).stem]
    j = chemin.with_suffix(".json")
    return json.loads(j.read_text()) if j.exists() else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dossier"); ap.add_argument("--video"); ap.add_argument("--biblio")
    ap.add_argument("--autour", type=int, action="append", default=[])
    o = ap.parse_args()
    D = Path(o.dossier).resolve()
    biblio = Path(o.biblio).resolve() if o.biblio else (SKILL.parent / "animations" / "bibliotheque").resolve()
    sons_dir = biblio / "sons"
    K = commun(biblio); SN = K["SONS"]; fps = K["VIDEO"]["fps"]
    chaine = f"loudnorm=I={SN['voix']['lufs']}:TP={SN['voix']['crete']}:LRA=11,aresample={A.SR}"
    info = json.loads((D / "info.json").read_text()) if (D / "info.json").exists() else {}
    if o.video:
        info["video"] = o.video
    video = R.video_de(D, info) if info.get("video") else Path("")
    if not video.exists():
        sys.exit(f"ERREUR VIDEO_INTROUVABLE {video} (passe --video <original>)")
    if not (D / "filtre.txt").exists() or not (D / "edl.json").exists():
        sys.exit("ERREUR COUPES_INTROUVABLES : filtre.txt et edl.json (couper-silences) manquent dans le dossier.")
    n_img = int(json.loads((D / "edl.json").read_text())["segments"][-1]["outOutF"])
    S = json.loads((D / "sons.json").read_text())

    v = R.voix_coupee(R.trouve_ffmpeg(), D, info, n_img, K, D / "ecoute"); N = len(v)
    vl, vr = A.lufs_porte(v), A.rms_parle(v)
    if not vl > -70:   # vidéo sans voix : même référence que le rendu (une voix au niveau du style)
        vl = vr = float(SN["voix"]["lufs"])
    print(f"VOIX sonie intégrée {vl + 3.01:.1f} LUFS en stéréo L = R ({vl:.1f} par canal), RMS parlé {vr:.1f} dBFS, {N / A.SR:.2f} s")

    bus = np.zeros(N); poses = []
    for s in S["sons"]:
        nom = s["fichier"]; p = R.fichier_style(K, biblio, "sons", nom)
        c = A.lit(p); F = fiche(p, sons_dir, nom)
        deb = F["debut_echantillon"] if F and "debut_echantillon" in F else A.attaque(c)
        a = A.actif(c); (cle, val), = s["niveau"].items()
        g = (vl - val - A.lufs(c[a])) if cle == "lu_sous_voix" else (vr - val - A.rms_actif(c))
        cg = c * 10 ** (g / 20); t_img = int(round(s["image"] / fps * A.SR)); i0 = t_img - deb
        x0, x1 = max(0, i0), min(N, i0 + len(cg))
        if x1 > x0:
            bus[x0:x1] += cg[x0 - i0:x1 - i0]
        poses.append(dict(s=s, c=cg, a=a, i0=i0, t_img=t_img, gain=g, cle=cle, val=val))

    out = v + bus; pk0 = float(A.db(np.abs(out).max()))
    # même limiteur de crête que le rendu : une crête de voix + son au-dessus du plafond est ramenée dessous (quelques
    # ms) ; au-delà de R.LIMITE_MAX_DB de réduction, le rendu refuse (MIX_SATURÉ) : l'écoute aussi
    lim, red, touche = R.limite_crete(out, SN["cretMax"], np)
    pk = float(A.db(np.abs(lim).max())); ok_pk = red <= R.LIMITE_MAX_DB
    if red > 0:
        print(f"LIMITEUR crête du mix {pk0:.2f} dBFS ramenée sous {SN['cretMax']} dBFS : -{red:.2f} dB sur {touche:.0f} ms")
    out = lim
    E = D / "ecoute"; E.mkdir(exist_ok=True)
    A.ecrit(out, E / "ecoute.wav"); A.ecrit(bus, E / "sons-seuls.wav")
    for im in o.autour:
        a0, a1 = max(0, int((im / fps - 2) * A.SR)), min(N, int((im / fps + 2) * A.SR))
        A.ecrit(out[a0:a1], E / f"autour-{im}.wav"); print(f"AUTOUR {E / f'autour-{im}.wav'}")

    # mesures sur les fichiers écrits : sons = sons-seuls.wav, voix = ecoute.wav - sons
    sd = A.lit(E / "sons-seuls.wav"); md = A.lit(E / "ecoute.wav"); n = min(len(sd), len(md)); sd, vd = sd[:n], md[:n] - sd[:n]
    vl_d, vr_d = A.lufs_porte(vd), A.rms_parle(vd)
    if not vl_d > -70:
        vl_d = vr_d = float(SN["voix"]["lufs"])
    res = []; ko = int(not ok_pk)
    for k, P in enumerate(poses):
        i0, L = P["i0"], len(P["c"]); x0, x1 = max(0, i0), min(n, i0 + L)
        seg = np.zeros(L); seg[x0 - i0:x1 - i0] = sd[x0:x1]
        autres = seg - np.pad(P["c"][x0 - i0:x1 - i0], (x0 - i0, L - (x1 - i0)))   # ce que les sons voisins ajoutent
        act = P["a"]; propre = float(np.sum(P["c"][act] ** 2)); bruit = float(np.sum(autres[act] ** 2))
        if bruit > propre * 1e-6:   # un voisin déborde dans sa fenêtre (lettres d'une frappe) : on retire ce qu'il y ajoute
            seg, mode = seg - autres, "piste écrite, voisins retirés"
        else:
            mode = "piste écrite"
        mes = (vl_d - A.lufs(seg[act])) if P["cle"] == "lu_sous_voix" else (vr_d - float(A.db(np.sqrt((seg[act] ** 2).mean()))))
        onset = i0 + A.attaque(seg); ecart_ms = (onset - P["t_img"]) / A.SR * 1000
        img_mes = int(np.floor(onset * fps / A.SR + 1e-9))
        ok_niv = abs(mes - P["val"]) <= TOL_DB; ok_cal = abs(ecart_ms) <= TOL_MS and img_mes == P["s"]["image"]
        ko += (not ok_niv) + (not ok_cal)
        unite = "LU" if P["cle"] == "lu_sous_voix" else "dB RMS"
        r = dict(fichier=P["s"]["fichier"], geste=P["s"].get("geste"), image=P["s"]["image"], pourquoi=P["s"].get("pourquoi"),
                 mesure=P["cle"], cible=P["val"], mesure_sous_voix=round(mes, 2), ecart_db=round(mes - P["val"], 2),
                 gain_db=round(P["gain"], 2), attaque_image_mesuree=img_mes, calage_ms=round(ecart_ms, 2),
                 crete_son_dbfs=round(float(A.db(np.abs(P["c"]).max())), 1), mode=mode, niveau_ok=ok_niv, calage_ok=ok_cal)
        res.append(r)
        print(f"MESURE {'OK' if ok_niv and ok_cal else 'KO'} {str(r['geste']):10} image {r['image']:5} {Path(r['fichier']).name:18} "
              f"cible {P['val']:5.1f} {unite:6} mesuré {mes:5.2f} (écart {mes - P['val']:+.2f})  attaque image {img_mes} ({ecart_ms:+.2f} ms)"
              + ("  [voisins retirés]" if "retirés" in mode else ""))
    (E / "ecoute.json").write_text(json.dumps(dict(
        video=str(video), voix=chaine, voix_sonie_stereo_lufs=round(vl_d + 3.01, 2), voix_sonie_canal_lufs=round(vl_d, 2),
        voix_rms_parle_dbfs=round(vr_d, 2), tolerance_db=TOL_DB, tolerance_calage_ms=TOL_MS, crete_mix_dbfs=round(pk, 2), crete_avant_limiteur_dbfs=round(pk0, 2), limiteur_db=round(red, 2),
        crete_max_dbfs=SN["cretMax"], sons=res), ensure_ascii=False, indent=1))
    print(f"CRETE mix voix + sons {pk0:.2f} dBFS avant limiteur, {pk:.2f} après ({'OK' if ok_pk else f'KO : il faudrait baisser de {red:.1f} dB, trop pour le limiteur'}, max {SN['cretMax']})")
    print(f"{'ECOUTE_OK' if not ko else 'ECOUTE_KO'} {len(res)} son(s) mesurés -> {E}")
    sys.exit(1 if ko else 0)


if __name__ == "__main__":
    main()
