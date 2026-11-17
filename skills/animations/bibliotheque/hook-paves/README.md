# Hook pavés

Cartes verrouillées : r19-02a, r19-02b (Style Lab v2). Calque tiré du build du tour 19.

## Ce qu'il montre
Le hook « basique » qui imite son montage actuel dans Edits : une ligne par pavé, capitales, posé d'un coup en haut du cadre, retiré à 2 s (image 60).

## Quand l'utiliser
Vidéos simples, organiques. Une idée en deux lignes courtes.

## Paramètres
`P.couleur` : `craie` (pavé craie, marche charbon à 35 %) ou `orange` (pavé orange, marche braise). Texte toujours charbon. Les lignes : les `<span class="pav">` de `#hook`.
- `devant/index.html` : durée 3.3 s ; 1 instants dans l'objet `T` en tête du script.

## Constantes de `commun.mjs`
COULEURS, HOOKS.paves (taille 58, interligne 1,15, haut 300, écart 10, padY [6, 10], padX 20), MARCHE.pave, MARCHE.paveCraie, RAYONS.pave, HOOK_TEMPS.finPaves (60).

## Son associé
Aucun.

## Composition
- `devant/` : calque transparent DEVANT Romain.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/hook-paves-devant.mov
```

## Aperçu
- `apercu-craie.mp4` : aperçu muet 540 x 960 de la carte r19-02a, refait le 2026-11-14 sur la rush de test (police unique Inter Black), instants par défaut du gabarit.
- `apercu-orange.mp4` : aperçu muet 540 x 960 de la carte r19-02b, refait le 2026-11-14 sur la rush de test (police unique Inter Black), instants par défaut du gabarit.
