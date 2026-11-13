#!/usr/bin/env python3
"""zoom.py : les deux zooms verrouillés (v1 r15-01a et r15-01c), repris de la chaîne du Style Lab.

Le plan est zoomé IMAGE PAR IMAGE autour d'un point fixe (entre ses yeux), avec un obturateur à 360 degrés
(10 sous-images moyennées) qui donne le léger flou de mouvement du zoom éclair. Jamais de zoom linéaire, jamais de son.

  eclair        : 115 % en 0,13 s, power2.out, sur le mot fort, tenu jusqu'à la coupe qui revient au plan large.
  rapprochement : 110 % en 1 s, power2.inOut (départ et arrivée freinés), tenu jusqu'à la coupe.

Usage :
  python3 zoom.py eclair|rapprochement <entree.mp4> <sortie.mov> <t_depart_s> <ancre_x> <ancre_y>
    entree     : le plan déjà étalonné, 1080 x 1920, 30 i/s (une rush 1080p : jamais au-delà de 115 %)
    t_depart_s : début du geste en secondes depuis le début du plan (attaque du mot)
    ancre      : point fixe du zoom en px (entre les yeux)
Dépendances : ffmpeg dans le PATH, numpy, Pillow.
"""
import subprocess, sys
import numpy as np
from PIL import Image

W, H, FPS = 1080, 1920, 30
def eo(p): p = min(1.0, max(0.0, p)); return 1 - (1 - p) ** 2                                   # power2.out
def eio(p): p = min(1.0, max(0.0, p)); return 2 * p * p if p < 0.5 else 1 - (-2 * p + 2) ** 2 / 2   # power2.inOut
GESTES = {
    "eclair": lambda t, t0: 1 + 0.15 * eo((t - t0) / 0.13) if t >= t0 else 1.0,
    "rapprochement": lambda t, t0: 1 + 0.10 * eio((t - t0) / 1.0) if t >= t0 else 1.0,
}

def zoom_img(img, s, ancre):
    if abs(s - 1) < 1e-6: return np.asarray(img, np.float32)
    ax, ay = ancre
    box = (ax - ax / s, ay - ay / s, ax + (W - ax) / s, ay + (H - ay) / s)
    return np.asarray(img.resize((W, H), Image.LANCZOS, box=box), np.float32)

def main():
    geste, entree, sortie, t0, ax, ay = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]), float(sys.argv[5]), float(sys.argv[6])
    f = GESTES[geste]
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", entree, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-vf", "format=yuv422p10le", "-c:v", "prores_ks", "-profile:v", "3", sortie], stdin=subprocess.PIPE)
    k, n = 0, W * H * 3
    while True:
        buf = dec.stdout.read(n)
        if len(buf) < n: break
        img = Image.fromarray(np.frombuffer(buf, np.uint8).reshape(H, W, 3))
        ss = [f((k + j / 10) / FPS, t0) for j in range(10)]          # obturateur 360 degrés, 10 sous-images
        fr = zoom_img(img, ss[0], (ax, ay)) if max(ss) - min(ss) < 1e-4 else sum(zoom_img(img, s, (ax, ay)) for s in ss) / len(ss)
        enc.stdin.write(np.clip(fr + 0.5, 0, 255).astype(np.uint8).tobytes()); k += 1
    dec.stdout.close(); dec.wait(); enc.stdin.close(); enc.wait()

if __name__ == "__main__":
    main()
