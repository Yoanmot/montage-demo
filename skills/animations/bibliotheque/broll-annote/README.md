# B-roll annoté

Carte verrouillée : r21-03a (Style Lab v2). Calque tiré du build du tour 21.

## Ce qu'il montre
Sa démo posée dans une carte rayon 18 (x 91 à 990, y 380 à 1504) sur charbon ; sur le mot, un point orange éclot sur le muscle, un trait coudé se trace, l'étiquette (pavé orange, Bricolage 46, texte charbon) arrive.

## Quand l'utiliser
Une démo d'exercice dont il nomme l'exercice ou le muscle. Le nom est le sien, jamais inventé.

## Paramètres
Position du point (sur le muscle, à mesurer sur l'image), étiquettes, instants `T`.
- `devant/index.html` : durée 3.7 s ; 7 instants dans l'objet `T` en tête du script.

## Constantes de `commun.mjs`
BROLL (carte [91, 380, 899, 1124], point 26, halo 7, trait 5, trace 0,35 s power2.inOut, etiquette 46, pente 0,4), RAYONS.carte.

## Son associé
Aucun.

## Composition
- `devant/` : calque transparent DEVANT Romain.
Sa démo (vidéo de Romain) est réduite et posée dans la carte par le montage, sous ce calque.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/broll-annote-devant.mov
```

## Aperçu
- `apercu.mp4` : aperçu muet 540 x 960 de la carte r21-03a, rendu dans le labo.
