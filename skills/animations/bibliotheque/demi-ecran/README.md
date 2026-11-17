# Demi-écran

Cartes verrouillées : r20-04b, r20-04c (Style Lab v2). Calque tiré du build du tour 20.

## Ce qu'il montre
Un panneau charbon descend du haut (courbe « banque », 0,70 s, long freinage), pousse son visage de 560 px vers le bas, fondu de 260 px entre panneau et image ; texte avec l'apparition v2. Sortie : bascule en plein écran (le panneau grandit en 0,5 s power2.inOut et chasse son visage) ou faisceau craie.

## Quand l'utiliser
Une idée à poser pendant qu'il continue de parler, sans le quitter. Jamais sur fond flou.

## Paramètres
`P.sortie` (`bascule` | `faisceau`), textes dans le HTML, instants `T` (`T.t01` entrée du panneau, `T.bascule`).
- `devant/index.html` : durée 4 s ; 6 instants dans l'objet `T` en tête du script.

## Constantes de `commun.mjs`
DEMI (ty 560, hauteur 1080, fondu 260, bascule { d 0,5, hauteur 2200, pousse 1080 }, phrase 66, mot 180, xy [91, 250]), courbe `courbe_banque.json` (même table que dans le HTML), FAISCEAU.

## Son associé
Sortie faisceau : `faisceau-obtu.wav` sur l'image où la bande couvre l'écran, 9 LU sous la voix. Bascule : aucun. Fichiers dans `../sons/` (licence : `../sons/LICENCE.md`).

## Composition
- `devant/` : calque transparent DEVANT Romain.
Le plan de Romain est DÉCALÉ vers le bas image par image avec la même courbe que le panneau (560 px, puis 1080 px pour la bascule) avant de poser le calque : voir `camera()` dans la chaîne du labo et `courbe_banque.json` ici.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/demi-ecran-devant.mov
```

## Aperçu
- `apercu-bascule.mp4` : aperçu muet 540 x 960 de la carte r20-04b, refait le 2026-11-14 sur la rush de test (police unique Inter Black), instants par défaut du gabarit.
- `apercu-faisceau.mp4` : aperçu muet 540 x 960 de la carte r20-04c, refait le 2026-11-14 sur la rush de test (police unique Inter Black), instants par défaut du gabarit.
