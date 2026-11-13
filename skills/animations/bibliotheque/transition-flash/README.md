# Transition flash

Carte verrouillée : r19-04d (Style Lab v2). Calque tiré du build du tour 19.

## Ce qu'il montre
Deux images craie sur la coupe : 50 % sur la dernière image du plan A, 100 % sur la première du plan B.

## Quand l'utiliser
Coupe plus sèche que le faisceau.

## Paramètres
Instants `T` : image de la coupe.
- `devant/index.html` : durée 4.5 s ; 3 instants dans l'objet `T` en tête du script.

## Constantes de `commun.mjs`
FLASH.paliers ([-1, 0,5], [0, 1], [1, 0]).

## Son associé
Un clic `clic.wav` sur l'image où le flash couvre l'écran (`t02`, la coupe), RMS 14 dB sous la voix (`SONS.transition`, décision de Yoan du 2026-11-13). Fichiers dans `../sons/`.

## Composition
- `devant/` : calque transparent DEVANT Romain.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/transition-flash-devant.mov
```

## Aperçu
- `apercu.mp4` : aperçu muet 540 x 960 de la carte r19-04d, rendu dans le labo.
