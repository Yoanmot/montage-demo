# Carte chrono

Carte verrouillée : r21-02h (Style Lab v2). Calque tiré du build du tour 21.

## Ce qu'il montre
Carte à onglet « chrono » dans un coin libre : « 14:12 » en capitales 145 (même largeur que l'ancien 190), légende dessous.

## Quand l'utiliser
Il montre un temps réel (préparation, séance).

## Paramètres
Temps, légende, position (coin libre du plan) dans le HTML, instants `T`.
- `devant/index.html` : durée 3 s ; 3 instants dans l'objet `T` en tête du script.

## Constantes de `commun.mjs`
CHRONO (x 500, y 300, w 490, pad [26, 32, 30], chiffre 145, legende 34, legendeOpacite 0,7), CARTE, ONGLET, APPARITION.

## Son associé
`arrivee-tick.wav` quand le chiffre passe 50 % d'opacité, 8 LU sous la voix. Fichiers dans `../sons/` (licence : `../sons/LICENCE.md`).

## Composition
- `devant/` : calque transparent DEVANT Romain.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/carte-chrono-devant.mov
```

## Aperçu
- `apercu.mp4` : aperçu muet 540 x 960 de la carte r21-02h, refait le 2026-11-14 sur la rush de test (police unique Inter Black), instants par défaut du gabarit.
