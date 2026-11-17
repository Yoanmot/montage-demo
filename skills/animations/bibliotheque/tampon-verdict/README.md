# Tampon verdict

Carte verrouillée : r21-03c (Style Lab v2). Calque tiré du build du tour 21.

## Ce qu'il montre
Un tampon « sans douleur » coché, cadre craie 10 px rayon 16, penché de 4 degrés, capitales 108, en haut à droite, sur ses mots.

## Quand l'utiliser
Verdict sur une démo. Tampon « mauvais » seulement quand il montre un mauvais exemple.

## Paramètres
Texte dans le HTML, instants `T`.
- `devant/index.html` : durée 4.433333333333334 s ; 1 instants dans l'objet `T` en tête du script.

## Constantes de `commun.mjs`
TAMPON (droite 975, y 300, cadre 10, rayon 16, coche 84, texte 108, angle -4, fond charbon à 35 %), APPARITION.

## Son associé
`arrivee-tick.wav` quand le tampon passe 50 % d'opacité, 8 LU sous la voix. Fichiers dans `../sons/` (licence : `../sons/LICENCE.md`).

## Composition
- `devant/` : calque transparent DEVANT Romain.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/tampon-verdict-devant.mov
```

## Aperçu
- `apercu.mp4` : aperçu muet 540 x 960 de la carte r21-03c, refait le 2026-11-14 sur la rush de test (police unique Inter Black), instants par défaut du gabarit.
