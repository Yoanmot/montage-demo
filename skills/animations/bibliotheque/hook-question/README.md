# Hook question

Carte verrouillée : r19-02i (Style Lab v2). Calque tiré du build du tour 19.

## Ce qu'il montre
Un sujet en mot géant Big Shoulders sur toute la largeur de la zone sûre (« SUPERSETS ») et la question sur pavé orange dessous (« gain de temps ? »), posés d'un coup sur sa démo.

## Quand l'utiliser
Hook d'une démo d'exercice ou d'une vidéo qui répond à une question.

## Paramètres
Le sujet (`.ti`) et la question (`.pav`) dans le HTML. La taille du sujet se règle pour que son encre couvre la zone sûre x 94 à 987.
- `devant/index.html` : durée 3 s ; aucun instant animé.

## Constantes de `commun.mjs`
HOOKS.question (pave 62, sujetXY [88, 262], paveX 91, ecartPave 20), VOILE.demo, COULEURS, MARCHE.pave.

## Son associé
Aucun.

## Composition
- `devant/` : calque transparent DEVANT Romain.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/hook-question-devant.mov
```

## Aperçu
- `apercu.mp4` : aperçu muet 540 x 960 de la carte r19-02i, rendu dans le labo.
