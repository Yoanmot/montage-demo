# Tier list

Carte verrouillée : r21-04b (Style Lab v2). Calque tiré du build du tour 21.

## Ce qu'il montre
Copie de TierMaker refaite en code : rangs S A B C D aux pastels d'origine, rangées de 170 px, vignettes carrées de 162 px qui attendent dans la réserve ; sur son mot, la vignette se soulève, traverse en freinant et se pose dans son rang.

## Quand l'utiliser
Il classe des aliments ou des exercices. L'ordre des rangs vient de Romain, jamais de nous.

## Paramètres
Vignettes (« image à fournir »), rangs et instants `T` dans le HTML.
- `devant/index.html` : durée 5.666666666666667 s ; 26 instants dans l'objet `T` en tête du script.
- Images : remplacées par l'emplacement `../../images/image-a-fournir.svg`. À fournir (attribut `data-a-fournir` de chaque `<img>`) :
  - photo du plat 1 (poulet), photo de Romain
  - photo du plat 2 (patate douce), photo de Romain
  - photo du plat 3 (ratatouille), photo de Romain
  - photo carrée d'un aliment (mélange de légumes), photo de Romain

## Constantes de `commun.mjs`
TIER (x 91, y 238, w 898, filet 3, etiquette 170, rangee 170, vignette 162, taille 56, rangs et pastels, fond #1A1A17), police Liberation Sans.

## Son associé
`clic.wav` à la pose de chaque vignette, RMS 14 dB sous la voix. Fichiers dans `../sons/` (licence : `../sons/LICENCE.md`).

## Composition
- `devant/` : calque transparent DEVANT Romain.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/tier-list-devant.mov
```

## Aperçu
- `apercu.mp4` : aperçu muet 540 x 960 de la carte r21-04b, rendu dans le labo.
