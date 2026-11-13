# Carte de séance

Carte verrouillée : r21-02a (Style Lab v2). Calque tiré du build du tour 21.

## Ce qu'il montre
Carte charbon à onglet « séance abdos · 3 exercices » sur sa vidéo floutée ; chaque exercice (numéro orange, vignette, nom) arrive sur son mot et devient la ligne en cours ; une ligne secondaire avec ses mots.

## Quand l'utiliser
Il donne les exercices d'une séance. Séries, répétitions, repos seulement quand il les dit.

## Paramètres
Onglet, lignes et vignettes (« image à fournir ») dans le HTML, instants `T`.
- `devant/index.html` : durée 6 s ; 7 instants dans l'objet `T` en tête du script.
- Images : remplacées par l'emplacement `../../images/image-a-fournir.svg`. À fournir (attribut `data-a-fournir` de chaque `<img>`) :
  - photo carrée de l'exercice 1 (roulette), photo de Romain
  - photo carrée de l'exercice 2 (relevé de jambes), photo de Romain
  - photo carrée de l'exercice 3 (GHD sit-up), photo de Romain

## Constantes de `commun.mjs`
CARTE (fond charbon, rayon 18, ombre, ligne en cours craie texte charbon, lignes passées 38 %), ONGLET (hauteur 64, Big Shoulders 800 46 px, fond orange, texte charbon, rayon 10), LIGNE_CARTE, APPARITION, SEANCE (x 91, y 600, w 899, pad 38), FONDS.flou.

## Son associé
Aucun.

## Composition
- `devant/` : calque transparent DEVANT Romain.
Fond = sa vidéo qui tourne, floutée sigma 20 et assombrie à 40 % pendant la carte.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/carte-seance-devant.mov
```

## Aperçu
- `apercu.mp4` : aperçu muet 540 x 960 de la carte r21-02a, rendu dans le labo.
