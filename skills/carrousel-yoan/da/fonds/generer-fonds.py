#!/usr/bin/env python3
"""Génère les fonds de la DA @ia.yoan (charte v1, §04 « Grain & fonds »).

POURQUOI un générateur plutôt que les PNG exportés de Claude Design : l'API du projet
Design plafonne la lecture d'un fichier à 256 Kio et les trois fonds pèsent plus que ça,
donc ils arrivent tronqués. Le haut de chaque image (17 % pour les fonds portrait, 8 %
pour le hero) a pu être décodé, et les paramètres ci-dessous en ont été DÉDUITS par
moindres carrés sur ces pixels : ce ne sont pas des valeurs inventées.

Contrôle qui valide le modèle : extrapolé jusqu'en bas du cadre, le fond 01 tombe sur
#1D1D1C / #191918 / #151514, alors que la charte annonce #1A1A18 pour le bas du fond gris.
Le modèle retrouve donc une valeur qu'il n'a jamais vue.

Recette de la charte, respectée ici :
  - source lumineuse TOUJOURS hors cadre, en haut à gauche (fonds 01 et 02) ou en haut
    à droite (hero) ;
  - chute vers le noir sur au moins 70 % de la hauteur, aucun bord net, aucune zone plate ;
  - grain monochrome noir, 1 px, non flouté, densité ~12 %, opacité 70 à 90 %, posé
    PAR-DESSUS le dégradé, sur les zones claires comme sur le noir.

Le repère est normalisé par le plus grand côté de l'image D'ORIGINE (et non de la sortie),
pour que le rendu soit identique quel que soit le format demandé.

Usage : python3 generer-fonds.py
"""

from PIL import Image
import math
import os
import random

ICI = os.path.dirname(os.path.abspath(__file__))

NOIR = (0x0A, 0x0A, 0x09)  # #0A0A09, le noir chaud de la charte

FONDS = {
    # 01 · NOIR GRIS : le fond par défaut.
    "fond1": {
        "boite": (0.568, 1.000),
        "source": (-0.55, -0.75),
        "sigma": 1.9,
        "k": 2.0,
        "pic": (125, 125, 127),
        "grain_opacite": 0.85,
    },
    # 02 · ORANGE DIFFUS : couvertures et slides de promesse.
    "fond2": {
        "boite": (0.563, 1.000),
        "source": (-0.40, -0.90),
        "sigma": 1.4,
        "k": 1.4,
        "pic": (240, 143, 36),
        "grain_opacite": 0.80,
    },
    # HERO : bandeau de couverture. Seuls 8 % de l'original étaient décodables, donc trop
    # peu pour ajuster une chute verticale : on reprend la géométrie du fond 02 en MIROIR
    # (source en haut à droite, comme sur l'original) et on cale le pic sur la seule valeur
    # sûre, le coin haut droit mesuré à #513412.
    "hero": {
        "boite": (1.000, 0.559),
        "source": (1.40, -0.90),
        "sigma": 1.4,
        "k": 1.4,
        "pic": (151, 90, 23),
        "grain_opacite": 0.80,
    },
}

GRAIN_DENSITE = 0.12  # « environ 12 % de la surface », charte §04

FORMATS = {
    "fond1": [(1080, 1350), (1080, 1920)],
    "fond2": [(1080, 1350), (1080, 1920)],
    "hero": [(1574, 880)],
}


def degrade(largeur, hauteur, spec):
    """Une seule tache gaussienne hors cadre : aucun bord, aucune zone plate."""
    img = Image.new("RGB", (largeur, hauteur))
    px = img.load()
    bw, bh = spec["boite"]
    sx, sy = spec["source"]
    sigma, k, pic = spec["sigma"], spec["k"], spec["pic"]
    for y in range(hauteur):
        ny = (y / (hauteur - 1)) * bh
        for x in range(largeur):
            nx = (x / (largeur - 1)) * bw
            f = math.exp(-((math.hypot(nx - sx, ny - sy) / sigma) ** 2) * k)
            px[x, y] = tuple(
                min(255, int(round(NOIR[c] + pic[c] * f))) for c in range(3)
            )
    return img


def grain(img, opacite, graine):
    """Bruit 1 px noir, non flouté. Jamais de gris : du noir dosé en opacité."""
    rnd = random.Random(graine)
    largeur, hauteur = img.size
    px = img.load()
    for y in range(hauteur):
        for x in range(largeur):
            if rnd.random() < GRAIN_DENSITE:
                r, g, b = px[x, y]
                f = 1.0 - opacite * rnd.uniform(0.55, 1.0)
                px[x, y] = (int(r * f), int(g * f), int(b * f))
    return img


def main():
    for nom, spec in FONDS.items():
        for largeur, hauteur in FORMATS[nom]:
            img = degrade(largeur, hauteur, spec)
            # Graine fixe : deux exécutions donnent le même fichier. Un grain aléatoire
            # rendrait tout diff d'image inutilisable au montage.
            img = grain(img, spec["grain_opacite"], f"{nom}{largeur}x{hauteur}")
            sortie = os.path.join(ICI, f"{nom}-{largeur}x{hauteur}.png")
            img.save(sortie, optimize=True)
            print(f"{os.path.basename(sortie)} écrit")


if __name__ == "__main__":
    main()
