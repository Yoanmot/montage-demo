# Comparaison sur charbon

Carte verrouillée : r20-08a (Style Lab v2). Calque tiré du build du tour 20.

## Ce qu'il montre
D'abord la mauvaise option : une grille de petits pictos craie sature, se grise et s'effondre. Puis les bons exercices en trois vignettes carrées 286 px rayon 10 sur une ligne (clic et éclair à 65 % sur chacune), puis le mot clé (« maîtrisés ») en Big Shoulders 170 sur son mot.

## Quand l'utiliser
Il oppose une mauvaise façon de faire et la bonne. Montrer que la mauvaise est mauvaise AVANT la bonne.

## Paramètres
Les trois vignettes sont des emplacements « image à fournir » (photos de Romain). Mot et instants `T` dans le HTML.
- `devant/index.html` : durée 7 s ; 148 instants écrits en dur (un par image ou par lettre).
- Images : remplacées par l'emplacement `../../images/image-a-fournir.svg`. À fournir (attribut `data-a-fournir` de chaque `<img>`) :
  - photo carrée de l'exercice 1 (roulette), photo de Romain
  - photo carrée de l'exercice 2 (relevé de jambes), photo de Romain
  - photo carrée de l'exercice 3 (GHD sit-up), photo de Romain

## Constantes de `commun.mjs`
COMPARAISON (gris #56524D, vignette 286, ecart 20, vignetteY 700, eclair 0,65, mot 170, motY 1060), RAYONS.vignette, SONS.clic.

## Son associé
`clic.wav` (appareil photo, 54 ms) à l'image de chaque vignette, RMS 14 dB sous la voix parlée. Fichiers dans `../sons/` (licence : `../sons/LICENCE.md`).

## Composition
- `devant/` : calque transparent DEVANT Romain.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/comparaison-devant.mov
```

## Aperçu
- `apercu.mp4` : aperçu muet 540 x 960 de la carte r20-08a, rendu dans le labo.
