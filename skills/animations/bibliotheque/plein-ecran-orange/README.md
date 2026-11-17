# Plein écran orange, phrase centrée

Carte verrouillée : r21-01g (Style Lab v2). Calque tiré du build du tour 21.

## Ce qu'il montre
« faire des abdos » / « ne suffit pas » sur 2 lignes de même taille, centrées, texte charbon sur orange, le fond 0,25 s avant le texte.

## Quand l'utiliser
Une phrase coup de poing sur deux lignes de longueur proche.

## Paramètres
Textes dans le HTML, instants `T`.
- `devant/index.html` : durée 3.3 s ; 4 instants dans l'objet `T` en tête du script.

## Constantes de `commun.mjs`
FONDS.orange, PLEIN.centreY, PLEIN_TEMPS.avanceFond, APPARITION.

## Son associé
Aucun.

## Composition
- `devant/` : calque transparent DEVANT Romain.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/plein-ecran-orange-devant.mov
```

## Aperçu
- `apercu.mp4` : aperçu muet 540 x 960 de la carte r21-01g, refait le 2026-11-14 sur la rush de test (police unique Inter Black), instants par défaut du gabarit.
