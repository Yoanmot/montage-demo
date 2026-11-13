# Présentation

Carte verrouillée : r21-02f (Style Lab v2). Calque tiré du build du tour 21.

## Ce qu'il montre
En bas à gauche, en cascade : photo de profil ronde avec anneau orange 6 px, « Romain », « coach sportif, Suisse », @fitavecromain. Voile sombre en bas.

## Quand l'utiliser
Début de vidéo pour un nouveau public.

## Paramètres
Photo (« image à fournir » : sa photo de profil), nom, ligne, pseudo dans le HTML, instants `T`. « Suisse » est à valider par Romain (voir STYLE.md).
- `devant/index.html` : durée 3.3 s ; 4 instants dans l'objet `T` en tête du script.
- Images : remplacées par l'emplacement `../../images/image-a-fournir.svg`. À fournir (attribut `data-a-fournir` de chaque `<img>`) :
  - photo de profil Instagram de Romain (carrée)

## Constantes de `commun.mjs`
PRESENTATION (x 97, y 1150, pfp 150, anneau 6, gap 26, nom 110, ligne 38, pseudo 34, voileBas), APPARITION.

## Son associé
Aucun.

## Composition
- `devant/` : calque transparent DEVANT Romain.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/carte-presentation-devant.mov
```

## Aperçu
- `apercu.mp4` : aperçu muet 540 x 960 de la carte r21-02f, rendu dans le labo.
