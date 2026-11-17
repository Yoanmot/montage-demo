# Angle du coude

Carte verrouillée : r21-03b (Style Lab v2). Calque tiré du build du tour 21.

## Ce qu'il montre
L'angle de l'articulation tracé sur le membre, mesuré image par image (de 145 à 102 degrés sur ses dips) : rayons et arc craie, centre orange, valeur capitales 96.

## Quand l'utiliser
Il parle d'une amplitude ou d'une position d'articulation. Valeur mesurée sur l'image, jamais un chiffre estimé.

## Paramètres
Les points du corps (épaule, coude, poignet) image par image, à mesurer sur la vidéo (pose) ; le HTML de l'aperçu les porte en dur, une valeur par image.
- `devant/index.html` : durée 4.433333333333334 s ; 133 instants écrits en dur (un par image ou par lettre).

## Constantes de `commun.mjs`
ANGLE (trait 5, arc 84, rayon 250, centre 9, chiffre 96, ecartChiffre 175).

## Son associé
Aucun.

## Composition
- `devant/` : calque transparent DEVANT Romain.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/angle-coude-devant.mov
```

## Aperçu
- `apercu.mp4` : aperçu muet 540 x 960 de la carte r21-03b, rendu dans le labo.
