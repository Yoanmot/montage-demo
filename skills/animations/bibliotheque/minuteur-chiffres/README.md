# Minuteur, chiffres seuls

Carte verrouillée : r20-06a (Style Lab v2). Calque tiré du build du tour 20.

## Ce qu'il montre
« 15 » puis « jours » sur ses mots, puis le compte à rebours par à-coups qui part lentement et se précipite vers 00, sur charbon.

## Quand l'utiliser
Une durée qu'il annonce (jours, minutes, repos).

## Paramètres
Chiffres dans le HTML (un élément par valeur), instants `T`. Écarts entre deux chiffres en images : MINUTEUR.ecarts.
- `devant/index.html` : durée 5 s ; 34 instants dans l'objet `T` en tête du script.

## Constantes de `commun.mjs`
MINUTEUR (ecarts [6, 5, 4, 4, 3, 3, 3, 2, ...], sortie 0,05 s power3.in, entree 0,22 s max expo.out, seuls { taille 470, centreY 960, libelle 52, libelleY 1230 }).

## Son associé
Aucun.

## Composition
- `devant/` : calque transparent DEVANT Romain.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/minuteur-chiffres-devant.mov
```

## Aperçu
- `apercu.mp4` : aperçu muet 540 x 960 de la carte r20-06a, refait le 2026-11-14 sur la rush de test (police unique Inter Black), instants par défaut du gabarit.
