# Mot géant derrière la tête

Carte verrouillée : r20-01f (Style Lab v2). Calques tirés du build du tour 20.

## Ce qu'il montre
« mais faire des » (devant), ABDOS géant (derrière sa tête), « ne suffit pas » (devant), en trois temps, chacun sur sa voix avec l'apparition v2.

## Quand l'utiliser
Hook qui tient sur un mot clé.

## Paramètres
Textes dans le HTML des deux couches, instants `T` de chaque couche.
- `derriere/index.html` : durée 3 s ; 1 instants dans l'objet `T` en tête du script.
- `devant/index.html` : durée 3 s ; 2 instants dans l'objet `T` en tête du script.

## Constantes de `commun.mjs`
HOOKS.motGeant (petits 52, hautXY [96, 250], geantXY [94, 278.88], basY 532 ; mot géant en encre sur la zone sûre, mêmes écarts que la planche), APPARITION, VOILE.standard, OMBRES.texteDouce.

## Son associé
`arrivee-tick.wav` à l'image où ABDOS passe 50 % d'opacité (`apparitionMiOpacite`), 8 LU sous la voix. Fichiers dans `../sons/` (licence : `../sons/LICENCE.md`).

## Composition
- `derriere/` : calque transparent DERRIÈRE Romain.
- `devant/` : calque transparent DEVANT Romain.
Couche `derriere/` trouée par son masque et posée sous lui, couche `devant/` par-dessus.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd derriere && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/hook-mot-geant-derriere.mov
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/hook-mot-geant-devant.mov
```

## Aperçu
- `apercu.mp4` : aperçu muet 540 x 960 de la carte r20-01f, refait le 2026-11-14 sur la rush de test (police unique Inter Black), instants par défaut du gabarit.
