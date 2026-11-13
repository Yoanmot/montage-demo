# Transition faisceau

Cartes verrouillées : r19-04a, r19-04c, r20-01i (Style Lab v2). Calque tiré du build du tour 19.

## Ce qu'il montre
Une bande inclinée de 12 degrés traverse l'écran de droite à gauche : entrée en 0,067 s (power1.in), écran couvert pile sur la coupe, sortie en 0,09 s.

## Quand l'utiliser
Sur une coupe entre deux idées. Craie plein (2200 px), craie étroit ou orange étroit (1000 px, laissent deviner la coupe). Jamais l'orange en bande pleine.

## Paramètres
`P.couleur` (`craie` | `orange`), `P.largeur` (2200 | 1000), `T.t01` = image de la coupe moins 0,067 s.
- `devant/index.html` : durée 4.5 s ; 2 instants dans l'objet `T` en tête du script.

## Constantes de `commun.mjs`
FAISCEAU (largeur 2200, etroit 1000, hauteur 3200, angle 12, bord 0,16, depart 2300, arrivee -2500, entree 0,067, sortie 0,09), COURBES.faisceauEntree / faisceauSortie.

## Son associé
`faisceau-obtu.wav` (déclencheur d'obturateur, 18 ms) sur l'image de la coupe, 9 LU sous la voix. Fichiers dans `../sons/` (licence : `../sons/LICENCE.md`).

## Composition
- `devant/` : calque transparent DEVANT Romain.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/transition-faisceau-devant.mov
```

## Aperçu
- `apercu-craie.mp4` : aperçu muet 540 x 960 de la carte r19-04a, rendu dans le labo.
- `apercu-craie-etroit.mp4` : aperçu muet 540 x 960 de la carte r19-04c, rendu dans le labo.
- `apercu-orange-etroit.mp4` : aperçu muet 540 x 960 de la carte r20-01i, rendu dans le labo.
