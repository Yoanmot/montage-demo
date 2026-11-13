# Recherche Google

Carte verrouillée : r21-04a (Style Lab v2). Calque tiré du build du tour 21.

## Ce qu'il montre
Format connu recopié à l'identique, sans logo : plein écran blanc, barre en pilule, sa phrase tapée lettre par lettre, suggestions qui s'ouvrent, Entrée qui ferme la liste. La barre entre avec l'apparition v2.

## Quand l'utiliser
Il cite une question que les gens se posent.

## Paramètres
Phrase (une lettre par élément) et suggestions dans le HTML ; instants par lettre en dur (règle FRAPPE : 18 lettres/s, pauses entre les mots, jamais avant qu'il dise le mot, la phrase finit avec sa voix).
- `devant/index.html` : durée 5.7 s ; 50 instants écrits en dur (un par image ou par lettre).

## Constantes de `commun.mjs`
FRAPPE, APPARITION (barre h 132), POLICES.natif (Roboto). Couleurs Google d'origine (#202124, #1A73E8, gris), rien de la marque de Romain.

## Son associé
Une frappe par lettre (`frappes/t1` à `t4`), RMS 23 dB sous la voix ; `entree.wav` sur l'image de l'Entrée, RMS 17 dB sous la voix. Fichiers dans `../sons/` (licence : `../sons/LICENCE.md`).

## Composition
- `devant/` : calque transparent DEVANT Romain.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/recherche-google-devant.mov
```

## Aperçu
- `apercu.mp4` : aperçu muet 540 x 960 de la carte r21-04a, rendu dans le labo.
