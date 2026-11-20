# Plein écran qui commence sur son visage

Geste composé (pas de gabarit HTML) : `../../scripts/plein-ecran-visage.mjs`. Décision de Yoan (2026-11-20) : un plein
écran ne commence plus d'un coup sur un fond uni, il commence sur lui. Romain trouve pénible de rester longtemps sans
voir sa tête ; Yoan aime qu'un effet commence à l'écran par le texte sur lui et se finisse en plein écran.

## Ce qu'il montre
1. Le **titre** (le mot clé, ses mots, en capitales, aussi grand que la place au-dessus de sa tête le permet) apparaît
   sur son image filmée, au-dessus de sa tête (haut du crâne mesuré sur la vidéo), avec le voile du haut.
2. Un **flash** craie couvre tout l'écran **sauf les lettres du titre**, à leur forme exacte : il est rendu sous le
   titre, qui reste au-dessus avec son ombre (plus de cadre rectangulaire où l'on voyait la vidéo autour du mot),
   puis le **fond uni** (orange ou charbon) est là. Le titre ne bouge pas et garde sa taille et sa couleur (craie), même
   sur l'orange (Yoan, 2026-11-20 : le mot clé en blanc doit rester intact). Un clic sur le flash.
3. Les **points** (1 à 3 : ce qu'on y gagne, les étapes) apparaissent l'un sous l'autre, chacun sur son mot : sa petite
   figure centrée qui se trace (`courbe` qui monte, trois `cases` qui se cochent, `barre` qui se remplit, ou `aucune`),
   son libellé en capitales dessous, en craie comme le titre. Une seule taille pour tous les libellés.
4. **Sortie** : un flash craie et un clic sur les deux dernières images, puis retour sur lui. Il s'arrête avant que
   commence la phrase suivante.

## Quand l'utiliser
La phrase qu'on doit retenir de la vidéo, quand elle a un mot clé (un chiffre, une durée, le mot qui renverse) suivi
de ce qu'il apporte. Une fois par vidéo, deux au plus. Sans mot clé à poser sur lui : `plein-ecran-fond`.

## La demande du plan
Format et exemple : `../../../plan-montage/references/format.md`, « Plein écran qui commence sur lui ».
`composition.fond` (`orange` | `charbon`), `composition.fond_sur` (facultatif : l'ancre où le fond monte ; par défaut
0,45 s avant le premier point), un `titre`, 1 à 3 `point` avec `figure`.

## Contrôles
`TITRE`, `POINTS`, `FIGURE_INCONNUE`, `ORDRE` (le titre ouvre), `TROP_TOT` (le titre se lit 0,8 s au moins sur lui
avant le fond), `TROP_LONG` (5,5 s au plus sans le voir), `HORS_ZONE`. Avis quand un libellé est réduit pour tenir.

## Constantes de `commun.mjs`
`PLEIN_VISAGE` (écart au-dessus du crâne, taille minimale du titre, temps du titre seul, temps sans lui, fond : durée,
courbe, avance ; tailles et écarts des points ; figures), `FONDS` (couleur du texte selon le fond), `VOILE.standard`,
`APPARITION`, `SCHEMA.trait` (courbe qui se trace), `CASE_COCHEE` (coches).

## Son
Un clic (`transition`) au flash d'entrée, un au flash de sortie (`sons_suggeres`). Rien sur les points.

## Composition
- Calque `devant`, `masque_sous_titres` : le titre et les points portent ses mots, les sous-titres s'effacent pendant
  tout l'effet. `mots_repris` : le titre et les libellés qui sont ses mots exacts.
- Pas de `transition-flash` autour : l'entrée et la sortie sont dans l'effet.
- Test : `../../tests/composes.test.mjs`.
