# Hook question

Carte verrouillée : r19-02i (Style Lab v2). Calque tiré du build du tour 19.

## Ce qu'il montre
Un sujet en mot géant sur toute la largeur de la zone sûre (« SUPERSETS ») et la question sur pavé orange dessous (« gain de temps ? »), sur sa démo : le sujet apparaît (`t01`), la question monte du bas en saccade (`t02`). Animé depuis le 2026-11-20 (avant : posé d'un coup).

## Quand l'utiliser
Hook d'une démo d'exercice ou d'une vidéo qui répond à une question.

## Paramètres
Le sujet (`.ti`) et la question (`.pav`) dans le HTML. La taille du sujet se règle pour que son encre couvre la zone sûre x 94 à 987.
- `devant/index.html` : durée 3 s ; instants dans l'objet `T` en tête du script.

## Constantes de `commun.mjs`
HOOKS.question (pave 62, sujetXY [88, 262], paveX 91, ecartPave 20), VOILE.demo, COULEURS, MARCHE.pave.

## Son associé
`arrivee-tick.wav` quand le sujet devient lisible (`#sujet`).

## Composition
- `devant/` : calque transparent DEVANT Romain.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/hook-question-devant.mov
```

## Aperçu
- `apercu.mp4` : aperçu muet 540 x 960 de la carte r19-02i, refait le 2026-11-14 sur la rush de test (police unique Inter Black), instants par défaut du gabarit, refait le 2026-11-20 avec l'animation (rush de test, instants par défaut du gabarit).
