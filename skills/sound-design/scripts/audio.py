"""audio.py : lecture et mesures communes à ecoute.py et generer.py (skill sound-design).
Méthode du Style Lab de Romain (renders/r21/_build/mix21.py et kpond.py), pour mesurer comme le labo a mesuré :
  sonie K pondérée (UIT-R BS.1770) : lufs(x) sans porte (sons courts), lufs_porte(x) intégrée -70 / -10 (voix) ;
  RMS de la voix parlée : blocs de 50 ms au-dessus de -45 dBFS ;
  partie active d'un son : enveloppe 1 ms au-dessus de 10 % du maximum de l'enveloppe 2 ms ;
  attaque d'un son (debut_echantillon) : premier échantillon où l'enveloppe 2 ms dépasse 10 % de son maximum.
Python 3.9 (celui de macOS), numpy, scipy ; ffmpeg 7 ou plus."""
import os
import shutil
import subprocess
from pathlib import Path

import numpy as np
from scipy.signal import lfilter

SR = 48000
FPS = 30


def ffmpeg():
    for p in (os.environ.get("FFMPEG"), "/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", shutil.which("ffmpeg")):
        if p and os.path.exists(p):
            return p
    raise SystemExit("ERREUR FFMPEG_INTROUVABLE : installer ffmpeg (brew install ffmpeg)")


FF = ffmpeg()


def db(v):
    return 20 * np.log10(np.maximum(np.asarray(v, dtype=float), 1e-12))


def lit(p, af=None):
    """Fichier audio ou vidéo -> mono float64 48 kHz : moyenne des deux canaux. Les sons et la voix sont L = R : on lit
    donc le niveau exact d'un canal, sans le +3 dB de la réduction en mono de ffmpeg (-ac 1). Les écarts sous la voix
    sont les mêmes que dans le labo (voix et sons y étaient lus pareil) ; seul le niveau absolu change."""
    n = canaux(p)
    cmd = [FF, "-v", "error", "-i", str(p)] + (["-af", af] if af else []) + ["-ac", str(min(n, 2)), "-ar", str(SR), "-f", "f64le", "-"]
    x = np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float64)
    return x.copy() if n == 1 else x[:len(x) // 2 * 2].reshape(-1, 2).mean(1)


def canaux(p):
    """Nombre de canaux de la première piste son (ffprobe, à côté de ffmpeg)."""
    fp = str(Path(FF).with_name("ffprobe"))
    out = subprocess.run([fp if os.path.exists(fp) else "ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries",
                          "stream=channels", "-of", "csv=p=0", str(p)], capture_output=True, text=True, check=True).stdout.strip()
    return int(out.splitlines()[0]) if out else 1


def ecrit(x, p, canaux=2):
    """mono -> wav 48 kHz 24 bits (stéréo L = R par défaut)."""
    st = np.stack([x] * canaux, 1) if canaux > 1 else x[:, None]
    subprocess.run([FF, "-v", "error", "-y", "-f", "f64le", "-ar", str(SR), "-ac", str(canaux), "-i", "-", "-c:a", "pcm_s24le", str(p)],
                   input=np.ascontiguousarray(st).tobytes(), check=True)


def env(x, d=0.002):
    w = max(1, int(d * SR))
    return np.sqrt(np.convolve(x * x, np.ones(w) / w, "same"))


def actif(c):
    return env(c, 0.001) > env(c).max() * 0.1


def attaque(c):
    e = env(c)
    return int(np.argmax(e > e.max() * 0.1))


B1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]; A1 = [1.0, -1.69065929318241, 0.73248077421585]
B2 = [1.0, -2.0, 1.0]; A2 = [1.0, -1.99004745483398, 0.99007225036621]


def kw(x):
    return lfilter(B2, A2, lfilter(B1, A1, x))


def lufs(x):
    y = kw(x)
    return float(-0.691 + 10 * np.log10(max((y ** 2).mean(), 1e-20)))


def lufs_porte(x):
    y = kw(x) ** 2; w, s = int(0.4 * SR), int(0.1 * SR)
    z = np.array([y[i:i + w].mean() for i in range(0, max(1, len(y) - w + 1), s)])
    l = -0.691 + 10 * np.log10(np.maximum(z, 1e-20)); z = z[l > -70]
    if not len(z):
        return -99.0
    rel = -0.691 + 10 * np.log10(z.mean()) - 10; l = -0.691 + 10 * np.log10(z); z = z[l > rel]
    return float(-0.691 + 10 * np.log10(z.mean()))


def rms_parle(v):
    b = v[:len(v) // 2400 * 2400].reshape(-1, 2400); r = np.sqrt((b ** 2).mean(1)); r = r[db(r) > -45]
    return float(db(np.sqrt((r ** 2).mean()))) if len(r) else -99.0


def rms_actif(c):
    a = actif(c)
    return float(db(np.sqrt((c[a] ** 2).mean())))


def spectre(c):
    """Centre du spectre (Hz) et parts d'énergie (%) sous 300 Hz, entre 1 et 5 kHz, au-dessus de 6 kHz."""
    X = np.abs(np.fft.rfft(c * np.hanning(len(c)))) ** 2; f = np.fft.rfftfreq(len(c), 1 / SR); tot = X.sum() or 1e-20
    pct = lambda m: round(float(100 * X[m].sum() / tot), 1)
    return dict(centre_spectre_hz=int(round(float((f * X).sum() / tot))), sous_300hz_pct=pct(f < 300),
                b1_5khz_pct=pct((f >= 1000) & (f <= 5000)), sur_6khz_pct=pct(f > 6000))
