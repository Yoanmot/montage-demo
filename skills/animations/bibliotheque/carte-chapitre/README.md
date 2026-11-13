# Chapitre

Carte verrouillée : r21-02e (Style Lab v2). Calque tiré du build du tour 21.

## Ce qu'il montre
En haut à gauche : le bloc numéro orange (Big Shoulders 200), « le poulet » sur son mot, puis « étape 1 sur 3 ».

## Quand l'utiliser
Une vidéo en étapes (recette, routine).

## Paramètres
Numéro, titre, petite ligne dans le HTML, instants `T`.
- `devant/index.html` : durée 2.5 s ; 3 instants dans l'objet `T` en tête du script.

## Constantes de `commun.mjs`
CHAPITRE (x 91, y 280, num 200, titre 120, petit 38, rayon 14, petitOpacite 0,7), CARTE, APPARITION.

## Son associé
Aucun.

## Composition
- `devant/` : calque transparent DEVANT Romain.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/carte-chapitre-devant.mov
```

## Aperçu
- `apercu.mp4` : aperçu muet 540 x 960 de la carte r21-02e, rendu dans le labo.
