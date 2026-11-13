# Minuteur, barre par crans

Carte verrouillée : r20-06d (Style Lab v2). Calque tiré du build du tour 20.

## Ce qu'il montre
Le chiffre au-dessus d'une barre orange qui se vide cran par cran, calée sur les chiffres, sur sa vidéo floutée fort (40 px, 28 %).

## Quand l'utiliser
Comme le minuteur chiffres, quand on veut garder sa présence en fond.

## Paramètres
Instants `T` (calculés par MINUTEUR.ecarts). Le flou n'est pas dans le calque : voir composition.
- `devant/index.html` : durée 5 s ; 35 instants dans l'objet `T` en tête du script.

## Constantes de `commun.mjs`
MINUTEUR.barre (taille 330, chiffreY 780, x 91, w 899, h 44, y 1080, separation 4), MINUTEUR.cran (0,26 s max expo.out), FONDS.flouFort (sigma 40, niveau 0,28).

## Son associé
Aucun.

## Composition
- `devant/` : calque transparent DEVANT Romain.
Fond = sa vidéo QUI CONTINUE DE TOURNER, floutée (CSS blur 40, soit gblur sigma 40) et assombrie à 28 % entre l'image d'entrée et l'image de sortie du plein écran, jamais une image figée.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/minuteur-barre-devant.mov
```

## Aperçu
- `apercu.mp4` : aperçu muet 540 x 960 de la carte r20-06d, rendu dans le labo.
