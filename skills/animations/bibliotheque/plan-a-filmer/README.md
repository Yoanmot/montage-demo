# Plan à filmer (écran « B-ROLL »)

Geste composé : `../../scripts/plan-a-filmer.mjs`. Décision de Yoan (2026-11-20) : « Il manque les b-roll : en attendant,
mets un fond noir avec écrit b-roll. » Quand Romain cite une chose concrète qu'on peut voir (un exercice, un geste, un
aliment, un objet, un écran, une scène de sa vie), même pour s'en moquer, et qu'aucun de ses clips ne la montre, le
manque ne s'escamote pas : il se voit, et Romain sait quoi filmer.

## Ce qu'il montre
Un écran charbon plein cadre sur toute la phrase (de la coupe juste avant son premier mot à la coupe juste après son
dernier), « B-ROLL » en capitales craie et, dessous, ce qu'il faut filmer, en craie plus discrète. Pas d'orange : ses
sous-titres restent par-dessus avec leur pavé, comme sur un vrai plan filmé. Pas de son.

## La demande du plan
Format et exemple : `../../../plan-montage/references/format.md`, « L'écran B-ROLL ». Un seul élément : ce qu'il faut
filmer, une phrase concrète (ce qu'on voit, ce qu'il fait, comment), sur le premier mot de la phrase.

## Ensuite
Le monteur le liste dans son compte rendu (« à filmer »). Quand le clip arrive, la brique `b-roll` le pose sur les
mêmes mots et cette demande sort du plan. En amont, le brief du head of content prévoit ces plans (« Plans à tourner »).

## Constantes de `commun.mjs`
`PLAN_A_FILMER` (tailles, opacité du texte, centre vertical, lignes au plus, aimant des coupes).

## Composition
Calque `devant`, ordre 15 (sous les sous-titres). Test : `../../tests/composes.test.mjs`.
