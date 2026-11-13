# Schéma sur charbon

Carte verrouillée : r20-07a (Style Lab v2). Calque tiré du build du tour 20.

## Ce qu'il montre
L'effet arrive au centre sur son mot (pavé orange Big Shoulders 140, texte charbon), descend à sa place, puis les causes en cadres craie et le « + » sur leurs mots ; le trait se trace des causes vers l'effet, un point à chaque bout.

## Quand l'utiliser
Une cause et un effet (deux causes au plus).

## Paramètres
Textes dans le HTML, instants `T`.
- `devant/index.html` : durée 7.1 s ; 9 instants dans l'objet `T` en tête du script.

## Constantes de `commun.mjs`
SCHEMA (cadre trait 3 à 22 %, rayon 18, pad 34, texte 60 ; plus 110 ; trait 5 px, point 9, long 130, 0,35 s power2.inOut ; effet 140 ; descente 0,55 s power3.inOut), FONDS.charbon.

## Son associé
Aucun.

## Composition
- `devant/` : calque transparent DEVANT Romain.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/schema-devant.mov
```

## Aperçu
- `apercu.mp4` : aperçu muet 540 x 960 de la carte r20-07a, rendu dans le labo.
