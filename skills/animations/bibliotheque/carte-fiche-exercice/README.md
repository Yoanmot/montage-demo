# Fiche exercice

Carte verrouillée : r21-02c (Style Lab v2). Calque tiré du build du tour 21.

## Ce qu'il montre
Photo de l'exercice et son nom sur son mot, puis trois cases en cascade (séries, répétitions, repos), chiffres capitales 96.

## Quand l'utiliser
Seulement quand il donne lui-même séries, répétitions et repos. Les chiffres de l'aperçu (3, 10, 1:00) sont un EXEMPLE inventé.

## Paramètres
Nom, photo (« image à fournir »), les trois cases dans le HTML, instants `T`.
- `devant/index.html` : durée 2 s ; 7 instants dans l'objet `T` en tête du script.
- Images : remplacées par l'emplacement `../../images/image-a-fournir.svg`. À fournir (attribut `data-a-fournir` de chaque `<img>`) :
  - photo carrée de l'exercice 1 (roulette), photo de Romain

## Constantes de `commun.mjs`
CARTE (fond charbon, rayon 18, ombre, ligne en cours craie texte charbon, lignes passées 38 %), ONGLET (hauteur 64, capitales 46 px, fond orange, texte charbon, rayon 10), LIGNE_CARTE, APPARITION, FICHE (x 140, y 398, w 800, pad 24, nom 70, cases { chiffre 96, legende 28, pad 18, gap 12 }), FONDS.flou.

## Son associé
Aucun.

## Composition
- `devant/` : calque transparent DEVANT Romain.
Fond = sa vidéo floutée sigma 20 à 40 %.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/carte-fiche-exercice-devant.mov
```

## Aperçu
- `apercu.mp4` : aperçu muet 540 x 960 de la carte r21-02c, refait le 2026-11-14 sur la rush de test (police unique Inter Black), instants par défaut du gabarit.
