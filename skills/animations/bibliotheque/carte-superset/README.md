# Superset

Carte verrouillée : r21-02b (Style Lab v2). Calque tiré du build du tour 21.

## Ce qu'il montre
Carte à onglet sur sa démo floutée : deux exercices sur leurs mots, puis la barre orange qui les relie.

## Quand l'utiliser
Deux exercices enchaînés sans repos.

## Paramètres
Onglet, deux lignes, vignettes (« image à fournir », images tirées de sa vidéo) dans le HTML, instants `T`.
- `devant/index.html` : durée 3.7 s ; 4 instants dans l'objet `T` en tête du script.
- Images : remplacées par l'emplacement `../../images/image-a-fournir.svg`. À fournir (attribut `data-a-fournir` de chaque `<img>`) :
  - image carrée de l'exercice 1 (extension triceps à la poulie), tirée de sa vidéo
  - image carrée de l'exercice 2 (curl haltères), tirée de sa vidéo

## Constantes de `commun.mjs`
CARTE (fond charbon, rayon 18, ombre, ligne en cours craie texte charbon, lignes passées 38 %), ONGLET (hauteur 64, Big Shoulders 800 46 px, fond orange, texte charbon, rayon 10), LIGNE_CARTE, APPARITION, SUPERSET (x 91, y 560, w 899, pad 30, barre 14, barreRayon 7, barreMarge 70, gapBarre 26), FONDS.flou.

## Son associé
Aucun.

## Composition
- `devant/` : calque transparent DEVANT Romain.
Fond = sa démo floutée sigma 20 à 40 %.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/carte-superset-devant.mov
```

## Aperçu
- `apercu.mp4` : aperçu muet 540 x 960 de la carte r21-02b, rendu dans le labo.
