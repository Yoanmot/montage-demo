#!/usr/bin/env python3
"""Son du style : voix mise au niveau, sons des gestes calés à l'image près, musique en boucle avec ducking, mix.
Repris de briques/sources/sons.r6.py (musique, ducking, mesures), temoin/pipeline-r8/sons8.py (boucle reprise à la
2e mesure, recalée par corrélation, fondu croisé sur le temps fort) et du sons11.py du labo (tic des gestes).
Toutes les valeurs (niveaux, décalages, fichiers) viennent de style/style.json (clé son).

Règle son : un son seulement sur les animations et les transitions : chaque faisceau (bascule comprise), l'apparition
du CTA (et ses lignes), le tic des gestes marquants. Jamais sur un zoom, le suivi, les sous-titres, les crochets.

Fonctions :
  lire(fichier, debut=0, duree=None)        -> mono float64 48 kHz
  voix(rush, segments)                      -> voix des extraits mis bout à bout (fondus de 10 ms aux bords)
  niveau_voix(v)                            -> gain (dB) qui met la voix à -15,5 dBFS RMS sur les passages parlés
  sons(evenements, N, voix)                 -> piste des sons ; evenements = [{"type": "flash"|"cta"|"cta_lignes"|"tic"|<effet>, "t": s, "gain": dB?, "duree": s?}]
                                               (effets : style.json son.effets, glisse, pop, curseur, comique ; 2026-10-23)
  musique(N, voix, ambiance=None)           -> piste musique (boucle, entrée 0,3 s, sortie 0,6 s, voix - 15 dB K, ducking 2 dB)
  mixer(sortie, rush, segments, evenements, ambiance=None, musique_on=True) -> wav stéréo 24 bits (avant limiteur) + mesures
Le limiteur (crête sous -1 dBFS) se pose à l'export (rendu/rendu.py), comme dans le reel témoin."""
import json, subprocess, sys
from pathlib import Path
import numpy as np
from scipy.signal import lfilter

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from style import STYLE, FF, IPS, fichier

SR = 48000
SON = STYLE["son"]


def db(v): return 20 * np.log10(np.asarray(v) + 1e-12)


def lire(src, debut=0.0, duree=None, af=""):
    """Canal gauche seul (L = R dans tous les fichiers du style) : niveau exact, sans le +3 dB d'un mixage en mono."""
    cmd = [FF, "-v", "error", "-ss", f"{debut}"] + (["-t", f"{duree}"] if duree else []) + ["-i", str(src), "-af", "pan=mono|c0=c0" + ("," + af if af else ""), "-ar", str(SR)]
    return np.frombuffer(subprocess.run(cmd + ["-f", "f64le", "-"], capture_output=True, check=True).stdout, np.float64).copy()


def ecrire(x, p):
    st = np.stack([x, x], 1) if x.ndim == 1 else x
    subprocess.run([FF, "-v", "error", "-y", "-f", "f64le", "-ar", str(SR), "-ac", "2", "-i", "-", "-c:a", "pcm_s24le", str(p)],
                   input=np.ascontiguousarray(st).tobytes(), check=True)


def fen(x, w=None):
    w = w or int(SON["voix"]["fenetre"] * SR); n = len(x) // w
    return np.sqrt((x[: n * w].reshape(n, w) ** 2).mean(1))


def rms_parle(v):
    r = fen(v); r = r[db(r) > SON["voix"]["seuilParole"]]; return float(db(np.sqrt((r ** 2).mean())))


def actif_rms(x):
    e = np.sqrt(np.convolve(x * x, np.ones(96) / 96, "same")); act = e > e.max() * 0.1
    return float(db(np.sqrt((x[act] ** 2).mean())))


def pic2ms_haut(x, lo=1000):
    """Crête de l'enveloppe 2 ms au-dessus de lo Hz (mesure du son du flash, sons.r4.py)."""
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X[f < lo] = 0; h = np.fft.irfft(X, len(x))
    return float(db(np.sqrt(np.convolve(h * h, np.ones(96) / 96, "same")).max()))


def kpond(x):
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]; a1 = [1, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]; a2 = [1, -1.99004745483398, 0.99007225036621]
    return lfilter(b2, a2, lfilter(b1, a1, x))


def voix(rush, segments):
    """Voix des extraits de la rush (mêmes segments que le plan caméra), mis bout à bout, fondus de 10 ms aux bords."""
    parts = []
    for s in segments:
        n = int(round(s["images"] / IPS * SR))
        x = lire(rush, s["debut"], s["images"] / IPS + 0.05)[:n]; x = np.pad(x, (0, max(0, n - len(x))))
        f = int(0.010 * SR); x[:f] *= np.linspace(0, 1, f); x[-f:] *= np.linspace(1, 0, f)
        parts.append(x)
    return np.concatenate(parts)


def niveau_voix(v):
    return SON["voix"]["rmsParle"] - rms_parle(v)


def poser(dst, src, t):
    i = int(round(t * SR)); a, b = max(0, i), min(len(dst), i + len(src))
    if b > a: dst[a:b] += src[a - i:b - i]


def sons(evenements, N, v):
    """Piste des sons des gestes, niveaux réglés par rapport à la voix (déjà mise au niveau) :
    flash : crête 2 ms (> 1 kHz) à voix - 4,1 dB, le son démarre 7 ms après l'image pleine du faisceau (repère 0,100 s
    dans le fichier) ; cta : énergie active à voix - 17 dB, au début de l'entrée du mot ; cta_lignes : le même 11 dB
    plus bas à l'arrivée des lignes ; tic : énergie active à voix - 18 dB."""
    vr = rms_parle(v); piste = np.zeros(N); pose = []
    F, Cc, Tc = SON["flash"], SON["cta"], SON["tic"]
    flash = lire(fichier(F["fichier"])); flash *= 10 ** ((vr - F["picSousVoix"] - pic2ms_haut(flash)) / 20)
    cta = lire(fichier(Cc["fichier"])); cta *= 10 ** ((vr - Cc["rmsSousVoix"] - actif_rms(cta)) / 20)
    tic = lire(fichier(Tc["fichier"])); tic *= 10 ** ((vr - Tc["rmsSousVoix"] - actif_rms(tic)) / 20)
    EF = {k: v for k, v in SON.get("effets", {}).items() if not k.startswith("_")}
    effets = {}
    for k, v in EF.items():   # effets du motion (2026-10-23) : énergie active réglée par rapport à la voix, lus sur un canal
        x = lire(fichier(v["fichier"])); effets[k] = x * 10 ** ((vr - v["rmsSousVoix"] - actif_rms(x)) / 20)
    for e in evenements:
        g = 10 ** (e.get("gain", 0) / 20)
        if e["type"] == "flash": t = e["t"] + F["decalage"] - F["repere"]; poser(piste, flash * g, t)
        elif e["type"] == "cta": t = e["t"]; poser(piste, cta * g, t)
        elif e["type"] == "cta_lignes": t = e["t"]; poser(piste, cta * g * 10 ** (Cc["lignes"]["gain"] / 20), t)
        elif e["type"] == "tic": t = e["t"]; poser(piste, tic * g, t)
        elif e["type"] == "fichier":   # son propre au reel (média tiers) : énergie active à voix - sousVoix dB
            t = e["t"]; x = lire(e["fichier"]); x *= 10 ** ((vr - e["sousVoix"] - actif_rms(x)) / 20); poser(piste, x * g, t)
        elif e["type"] in effets:
            t = e["t"]; x = effets[e["type"]] * g
            if e.get("duree"):   # coupé à la durée du geste (curseur qui se déplace), fondu de 60 ms
                n = int(e["duree"] * SR); x = x[:n].copy(); f = min(len(x), int(0.06 * SR)); x[-f:] *= np.linspace(1, 0, f)
            poser(piste, x, t)
        else: raise ValueError(f"son inconnu : {e['type']}")
        pose.append(dict(e, pose_s=round(t, 4)))
    return piste, dict(voix_rms_parle_dbfs=round(vr, 2), flash_pic2ms_vs_voix_db=round(pic2ms_haut(flash) - vr, 1),
                       cta_rms_actif_vs_voix_db=round(actif_rms(cta) - vr, 1), tic_rms_actif_vs_voix_db=round(actif_rms(tic) - vr, 1),
                       effets_rms_actif_vs_voix_db={k: round(actif_rms(x) - vr, 1) for k, x in effets.items()}, poses=pose)


def boucle(m, N, bpm, cf, rec):
    """Allonge la musique : on joue le fichier jusqu'à la dernière boucle entière, puis on reprend à la 2e boucle,
    recalée à l'échantillon par corrélation (± rec s), fondu croisé de cf s sur le temps fort ; autant de fois que nécessaire."""
    L = int(round(SON["musique"]["boucle"]["mesures"] * 4 * 60 / bpm * SR))
    # partie utilisable : jusqu'au premier silence d'au moins 0,5 s (m-a-v5 se tait de 14,5 à 18,5 s : le témoin r8-02
    # bouclait après ce trou et la musique s'arrêtait 3 s en plein reel)
    e = db(fen(m, 2400)); sil = e < -50; utile = len(m)
    for i in range(20, len(sil) - 10):
        if sil[i:i + 10].all(): utile = i * 2400; break
    if utile >= N: return m[:N], None
    a = (utile // L) * L
    if a < 2 * L: raise ValueError("musique trop courte pour boucler")
    w = m[a - 4800:a + 4800] if a + 4800 <= len(m) else m[a - 9600:a]
    off = 4800 if a + 4800 <= len(m) else 9600
    best, bk = -1e18, 0
    for k in range(-int(rec * SR), int(rec * SR) + 1, 4):
        seg = m[L + k - off: L + k - off + len(w)]
        c = float(np.dot(w, seg))
        if c > best: best, bk = c, k
    b = L + bk; x = int(cf * SR)
    out = m[:a].copy()
    while len(out) < N:
        seg = m[b - x: a].copy()
        out[-x:] = out[-x:] * np.linspace(1, 0, x) + seg[:x] * np.linspace(0, 1, x)
        out = np.concatenate([out, seg[x:]])
    return out[:N], dict(boucle_s=round(L / SR, 4), joint_s=round(a / SR, 3), reprise_s=round(b / SR, 4), recalage_ms=round(bk / 48, 1))


def musique(N, v, ambiance=None):
    """Musique de fond : tempo ramené au tempo voulu, boucle, entrée et sortie en fondu, niveau pondéré K = voix - 15 dB
    hors parole, ducking de 2 dB pendant la parole (attaque 80 ms, retour 300 ms), réglée sur les fenêtres parlées."""
    Mu = SON["musique"]; A = Mu["ambiances"][ambiance or Mu["defaut"]]
    ecart = A.get("sousVoixK", Mu["sousVoixK"]); duck = A.get("ducking", Mu["ducking"])
    r = A["tempo"] / A["tempoMesure"]
    m = lire(fichier(A["fichier"]), A["debut"], None, f"atempo={r:.5f}" if abs(r - 1) > 1e-4 else "")
    bpm = A.get("boucleBpm", Mu["boucle"]["bpm"] if A["tempo"] in (135.0, 67.5) else A["tempo"])
    m, joint = boucle(m, N, bpm, Mu["boucle"]["fonduCroise"], Mu["boucle"]["recalage"])
    fi, fo = int(Mu["entree"] * SR), int(Mu["sortie"] * SR)
    m[:fi] *= np.linspace(0, 1, fi); m[-fo:] *= np.linspace(1, 0, fo) ** 1.5
    w = int(SON["voix"]["fenetre"] * SR)
    p = db(fen(v)) > SON["voix"]["seuilParole"]; cible = np.where(p, -duck, 0.0)
    g = np.zeros_like(cible); a_, r_ = np.exp(-SON["voix"]["fenetre"] / Mu["attaque"]), np.exp(-SON["voix"]["fenetre"] / Mu["relache"])
    for i in range(len(cible)):
        prev = g[i - 1] if i else cible[0]; k = a_ if cible[i] < prev else r_; g[i] = k * prev + (1 - k) * cible[i]
    m = m * 10 ** (np.interp(np.arange(N), np.arange(len(g)) * w + w // 2, g) / 20)
    mp = np.repeat(p, w)[:N]; mp = np.pad(mp, (0, N - len(mp)))
    vK = float(db(np.sqrt((kpond(v)[mp] ** 2).mean())))
    mKp = float(db(np.sqrt((kpond(m)[mp] ** 2).mean())))
    m *= 10 ** ((vK - ecart - duck - mKp) / 20)
    mK = float(db(np.sqrt((kpond(m)[mp] ** 2).mean())))
    return m, dict(ambiance=ambiance or Mu["defaut"], atempo=round(r, 4), voix_K_parle_dbfs=round(vK, 1),
                   musique_vs_voix_K_pendant_parole_db=round(mK - vK, 1), musique_pic_dbfs=round(float(db(np.abs(m).max())), 1), boucle=joint)


def mixer(sortie, rush, segments, evenements, ambiance=None, musique_on=True, voix_seule=None):
    """Mix complet d'un plan : voix (mise au niveau du style) + sons des gestes + musique. Écrit un wav stéréo 24 bits
    (avant limiteur) et rend les mesures."""
    v = voix_seule if voix_seule is not None else voix(rush, segments)
    gv = niveau_voix(v); v = v * 10 ** (gv / 20); N = len(v)
    s, ms = sons(evenements, N, v)
    mes = dict(gain_voix_db=round(gv, 2), **ms)
    x = v + s
    if musique_on:
        m, mm = musique(N, v, ambiance); x = x + m; mes["musique"] = mm
    ecrire(x, sortie)
    mes["mix_pic_avant_limiteur_dbfs"] = round(float(db(np.abs(x).max())), 1)
    return mes


if __name__ == "__main__":
    d = json.loads(Path(sys.argv[1]).read_text())
    print(json.dumps(mixer(sys.argv[2], d["rush"], d["segments"], d.get("sons", []), d.get("ambiance"), d.get("musique", True)), ensure_ascii=False, indent=1))
