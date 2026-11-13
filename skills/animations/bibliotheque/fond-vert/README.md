# Fond vert, promesse de pub

Carte verrouillée : r21-04c (Style Lab v2). Calque tiré du build du tour 21.

## Ce qu'il montre
Romain détouré en taille réelle devant un visuel fait de ses mots : sa phrase en Big Shoulders capitales charbon sur orange, chiffre géant craie à 92 % derrière lui ; « SEMAINES », « JOURS » au-dessus de sa tête. Un visuel par prise ; la coupe se cache sous le changement de visuel.

## Quand l'utiliser
Il cite une promesse (pub, tendance) pour la démonter.

## Paramètres
Textes et chiffres des visuels `#v0`, `#v1` dans le HTML, instants `T`. Tout mot reste lisible : rien sous son corps.
- `derriere/index.html` : durée 4.4 s ; 9 instants dans l'objet `T` en tête du script.

## Constantes de `commun.mjs`
VERT (phraseMax 150, chiffreA 980, chiffreOpacite 0,92, ecart 16), FONDS.orange, APPARITION.

## Son associé
Aucun.

## Composition
- `derriere/` : calque transparent DERRIÈRE Romain.
Ce calque est le FOND : Romain détouré image par image (masque lissé, contour resserré, bord décontaminé) est posé par-dessus, sans ombre portée.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd derriere && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/fond-vert-derriere.mov
```

## Aperçu
- `apercu.mp4` : aperçu muet 540 x 960 de la carte r21-04c, rendu dans le labo.
