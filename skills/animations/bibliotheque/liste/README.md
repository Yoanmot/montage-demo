# Liste sur charbon

Carte verrouillée : r20-05a (Style Lab v2). Calque tiré du build du tour 20.

## Ce qu'il montre
Plein écran charbon, bloc centré à y 960 ; chaque élément arrive sur son mot (apparition v2) et devient la ligne en cours (pleine craie, texte charbon) ; la ligne d'avant passe à 38 % en 0,25 s sine.inOut.

## Quand l'utiliser
Il énumère (exercices, aliments, étapes).

## Paramètres
Lignes `.row` dans le HTML (chiffre + texte), instants `T`.
- `devant/index.html` : durée 6 s ; 6 instants dans l'objet `T` en tête du script.

## Constantes de `commun.mjs`
LISTE (centreY 960, chiffre 96, texte 72, colChiffre 70, gap 24, pad 14, rayon 12, ecartLignes 8, passe 0,38, bascule 0,25 sine.inOut), FONDS.charbon, PLEIN_TEMPS.avanceFond.

## Son associé
Aucun.

## Composition
- `devant/` : calque transparent DEVANT Romain.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/liste-devant.mov
```

## Aperçu
- `apercu.mp4` : aperçu muet 540 x 960 de la carte r20-05a, rendu dans le labo.
