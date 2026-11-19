---
name: sous-titres
description: Brique du monteur. Prépare les sous-titres d'une vidéo déjà coupée, au style choisi par Romain (blanc très gras, groupes de 1 à 4 mots qui suivent ses phrases, le mot prononcé sur un pavé orange qui glisse de mot en mot), à partir du texte calé par couper-silences, avec l'orthographe corrigée sans toucher à ce qu'il dit. Écrit un calque transparent posé devant l'image ; ne fabrique pas la vidéo, c'est la brique rendu qui la fait. Appelée par l'agent monteur une fois les coupes prêtes.
---

# Préparer les sous-titres

Tu arrives ici depuis l'agent monteur, une fois les coupes prêtes (`words.cut.json` dans le dossier `<nom>-montage`).
Fais les étapes ci-dessous, puis rends la main au monteur : c'est la brique rendu qui pose le calque sur la vidéo.
Si tu parles à Romain : simplement, en français, en le tutoyant. Ne lui montre ni les commandes ni les fichiers.

Les titres à l'écran ne sont plus faits ici : ils passent par la brique animations.

## La commande
Le script est `scripts/sous-titres.mjs` dans le dossier de ce skill. Lance-le toujours ainsi :
```
node "<dossier du skill>/scripts/sous-titres.mjs" <commande> "<dossier>-montage"
```
Rien ne part sur internet : tout se fait sur l'ordinateur, en une seconde.

## Le déroulé

### 1. Le texte : `texte`
Écrit `<dossier>/texte-sous-titres.md` : le texte de la vidéo coupée, une phrase par ligne, chaque mot précédé de son
numéro (`[12]abdos`), et un `/` devant un mot qui suit une **coupe de la vidéo** (la même règle que celle qui pose un
flash : un `/` = une coupe, rien d'autre). Lis-le en entier.
- `TEXTE_INTROUVABLE` : la vidéo n'est pas encore coupée. Le monteur doit d'abord passer par couper-silences.

### 2. Corriger l'orthographe (c'est ton travail)
Le texte vient d'une transcription automatique : quelques mots peuvent être mal écrits (noms propres, marques,
vocabulaire de coach, mots mal entendus).
**Tu corriges l'orthographe, tu ne réécris jamais ce qu'il dit** : pas de reformulation, pas de mot ajouté ou retiré,
pas de « euh » enlevé s'il a été gardé à la coupe. Dans le doute, ne touche pas.
**Chiffres toujours en chiffres** (règle de Yoan, comme dans le plan : `plan-montage/references/regles.md`) : un nombre
que la transcription a écrit en lettres passe en chiffres dans `corrections` (« douze » -> « 12 », « trois » ->
« 3 », « vingt-cinq » -> « 25 », en gardant la ponctuation de fin du mot). Ce n'est pas réécrire ce qu'il dit : c'est
la même chose, écrite comme le style l'affiche. Un nombre en deux mots (« deux » « mille ») : le chiffre entier sur
le premier, `""` sur le second. Restent en lettres seulement « un » et « une » quand ils ne comptent rien
(« un client », « une fois »).

**Les noms d'exercices, de matériel et le jargon de coach** sont les mots que la transcription rate le plus (« DJH sit
up » pour « GHD sit-up »). Écris-les comme dans le `vocabulaire` du plan de montage, sinon sous leur forme connue dans le
monde du sport. Si tu n'es pas sûr de ce qu'il a voulu dire, demande-lui plutôt que de deviner.

**La ponctuation reste** : un mot corrigé garde la ponctuation de fin du mot d'origine (elle marque les fins de phrase,
qui coupent les groupes). À l'écran, la ponctuation de fin et les guillemets sont retirés et la casse est celle de la
transcription (« Les clients », « Maintenant tu ») : n'ajoute pas de majuscules pour mettre un mot en avant.

### 3. Le style : rien à choisir
Un seul style, celui que Romain a choisi le 29/10 (repris tel quel de son ancien skill) : Inter Black blanc 71 px,
lettres resserrées, ombre douce, la ligne centrée à 70 % de la hauteur ; groupes de 1 à 4 mots, 20 caractères au plus,
jamais à cheval sur deux phrases, découpés tout seuls de façon équilibrée ; le premier groupe après un blanc monte en
fondu ; le mot dit est sur un pavé orange qui glisse de mot en mot. Les groupes ne se choisissent pas : le script les
découpe avec la règle de l'ancien skill.
- Le plan de montage ne règle que l'orthographe (`vocabulaire`) et, s'il le demande, `masquer`. S'il donne encore un
  `style` ou des `mots_forts` (anciens plans), ignore-les : ils n'existent plus.
- La police est un réglage du style, fixé avec Yoan (`POLICES.sousTitres` de `commun.mjs`, Inter Black tant que Romain
  n'en a pas choisi une autre) : tu n'y touches pas.

### 4. Écrire `sous-titres.json`
```json
{
  "corrections": { "57": "Ekklo", "102": "squats," },
  "masquer": [[140, 145]],
  "citations": [[201, 204]],
  "taille": 1,
  "position": 0.70,
  "pave": true
}
```
- `corrections` (facultatif) : numéro du mot -> le mot corrigé. Pour réunir deux mots en un (« sit » « up » ->
  « sit-up »), mets le mot entier sur le premier et `""` sur le second.
- `masquer` (facultatif) : plages de numéros de mots à ne pas afficher, bornes incluses. Seulement s'il le demande.
- `citations` (facultatif) : plages de numéros de mots qu'il cite (une pensée, une phrase qu'on se dit : « tu vas te
  dire : Mince, c'est passé vite »), bornes incluses, recopiées de `sous_titres.citations` du plan. À l'écran : rien
  en plus, pas de guillemets (Yoan, 2026-11-14) ; la citation fait seulement ses propres groupes.
- `pave` (facultatif) : `true` = le pavé orange sous le mot dit (par défaut), `false` = sans pavé (essai de Yoan,
  2026-11-14), tout le reste identique. Réglage fixé avec Yoan : ne le change pas de toi-même.
- `volume` (facultatif, réglage fixé avec Yoan et Romain : ne le change pas de toi-même) : combien de mots par
  sous-titre. **Absent = défaut provisoire** (Yoan, 2026-11-15, en attendant le choix de Romain) : le niveau 2, 3 à 4
  mots sur une ligne (`SOUS_TITRES.volume` de `commun.mjs`). `"ancien"` = l'ancien réglage (1 à 4 mots, 20 caractères,
  une ligne, coupe à 0,15 s, `SOUS_TITRES.volumeAncien`). Clés : `mots_max` (1 à 10),
  `caracteres_max` (par ligne, `null` = seule la largeur compte), `lignes` (1 ou 2 : un groupe trop long pour une ligne
  se pose sur deux, centré sur la place des sous-titres), `coupe_pause` (blanc en s qui coupe une phrase, 0,15 par
  défaut ; plus long = groupes plus longs), `virgules` (`true` = les coupures cherchent les virgules et évitent un mot
  seul). Les 4 niveaux montrés à Romain le 2026-11-14 (`execution/romain/monteur-tests/volume-captions/niveaux.json`) :
  1 = `"ancien"` ; 2 = absent (défaut provisoire), soit `{ "mots_max": 4, "caracteres_max": null, "lignes": 1, "coupe_pause": 0.25, "virgules": true }` ;
  3 = `{ "mots_max": 5, "caracteres_max": 24, "lignes": 2, "coupe_pause": 0.32, "virgules": true }` ;
  4 = `{ "mots_max": 8, "caracteres_max": 28, "lignes": 2, "coupe_pause": 0.45, "virgules": true }`.
- `taille` (facultatif) : `1` par défaut ; `1.15` = 15 % plus gros, `0.9` = plus petit (de 0.5 à 2). Plus gros, les
  groupes ont moins de caractères.
- `position` (facultatif) : hauteur du milieu de la ligne, de `0.2` (haut) à `0.9` (bas) ; `0.70` par défaut, `0.62`
  = plus haut. Au-delà d'environ `0.75`, la ligne sort de la zone sûre d'Instagram : le script le signale.
- Rien à corriger : `{}` suffit. Les lignes « commente MOT » des CTA et les lignes de la tier list prennent la même
  taille et la même position (la brique animations les lit ici).

### 5. Fabriquer le calque : `preparer`
Le script découpe les groupes, cale chaque groupe et chaque glissé du pavé sur la voix, puis écrit le calque des
sous-titres dans `<dossier>/calques/st/` (prêt à rendre, à la durée de la vidéo coupée)
et sa ligne dans `<dossier>/calques.json`, sans toucher aux calques des autres briques.
- `SOUS-TITRES_ILLISIBLE` : le message dit quoi corriger (numéro inexistant, taille ou position hors limites).
  Corrige `sous-titres.json`, relance.
- `à relire` : un avertissement (champ ancien ignoré, mot plus large qu'une ligne, caractère absent de la police, ligne
  hors de la zone sûre). Corrige si c'est une erreur.
- `BIBLIOTHEQUE_INTROUVABLE` : le skill animations n'est pas installé à côté de celui-ci ; préviens Yoan.
- `GABARIT_INATTENDU` : la bibliothèque du style a changé de forme ; préviens Yoan, ne bricole pas.
- `retiré (calque qui efface les sous-titres)` : normal, voir ci-dessous.
- `mots affichés par <calque>, sortis des sous-titres` : normal, voir « Un mot n'est vu qu'une fois ».
- `PRÊT` : rends la main au monteur (brique rendu).

### Les calques pendant lesquels les sous-titres s'effacent
Deux sortes de calques sont marqués `"masque_sous_titres": true` dans `calques.json` par la brique animations :
- ceux qui ont leur propre ligne de sous-titre, placée pour leur mise en page (tier-list, cta-mot-derriere,
  cta-champ-instagram, effet sur mesure qui en porte une) : **c'est la ligne du calque qui reste** ;
- ceux qui couvrent tout l'écran avec le texte qu'il dit (pleins écrans, liste, minuteurs, schéma, recherche Google) :
  les sous-titres répéteraient ce texte en petit dessous, ils s'effacent.
Pendant un tel calque :
`preparer` applique la règle et liste chaque groupe touché (`calque qui efface les sous-titres : ...`).
Règle (Yoan, 2026-11-11) : un groupe **déjà affiché** à l'entrée du calque est **coupé net** à l'image d'entrée et ne
revient pas à la sortie ; s'il n'aurait été visible que moins de 6 images (0,2 s) avant, il est retiré en entier (pas
de flash). Un groupe qui apparaîtrait **pendant** le calque est retiré en entier. Les autres groupes gardent leurs
instants exacts. Rien à écrire dans `sous-titres.json` pour ça.
**Ordre** : animations avant sous-titres. Si les animations changent après (calque ajouté, retiré ou déplacé),
relance `preparer` : la brique rendu refuse sinon (`SOUS-TITRES_PÉRIMÉS`), pour ne jamais poser deux lignes l'une sur
l'autre. Le texte de la ligne du calque est écrit par la brique animations à partir de `sous-titres.json` (mêmes
corrections, même taille, même position, même style) : corrige d'abord ici, puis fais refaire le calque d'animation.

### Un mot n'est vu qu'une fois (Yoan, 2026-11-14)
Quand une animation affiche des mots qu'il dit (sous-titre enrichi, plein écran texte, ligne d'un gabarit), elle les
déclare (`mots_repris` dans `calques.json`, écrit par la brique animations). `preparer` les retire des sous-titres : le
groupe d'avant s'arrête à l'attaque du premier mot repris, les mots d'après repartent en nouveaux groupes. Plus jamais
« pendant les 12 » en sous-titres puis « 12 premières semaines » dans l'animation. Contrôle de toute la vidéo, après
`preparer` : `node ../animations/scripts/verifier.mjs <dossier> --mots` (`MOT_DOUBLE` = un mot vu deux fois, avec
l'instant : l'animation n'a pas déclaré ses mots, fais-les déclarer puis relance `preparer`).

## Les retouches (à proposer quand il a vu la vidéo)
- « tel mot est mal écrit » : une ligne dans `corrections` ;
- « enlève cette phrase des sous-titres » : `masquer` ;
- « plus gros », « plus petit » : `taille` ;
- « plus haut », « plus bas » : `position`.
Puis `preparer`, et le monteur refait la vidéo depuis l'originale.
La police, les couleurs, le pavé et la découpe des groupes sont ceux de son style : c'est le défaut. Pour **cette
vidéo**, une autre police, couleur ou arrivée des mots s'écrit dans `<nom>-montage/style-video.json`, clé `style`, avec
les noms de `../animations/bibliotheque/commun.mjs` (ex. `{"style": {"SOUS_TITRES": {"couleur": "#FFFFFF",
"entree": {"duree": 0.05, "montee": 0}}}}` ; autre police : `{"POLICES": {"sousTitres": {"family": "<nom>",
"file": "<chemin complet .ttf>", "poids": 900}}}`), puis `preparer`. Seule cette brique lit cette clé (les lignes de
sous-titre des gabarits gardent le style). Sans fichier, rien ne change.
Les sous-titres sont incrustés dans l'image : on ne peut pas les retoucher dans Edits. Pour changer un mot, il le
demande ici et la vidéo est refaite en quelques minutes.

## Dépendances
- **Node 24** (`node`) : lance le script, et sert à HyperFrames.
- **Le skill animations** installé à côté de celui-ci : le gabarit des sous-titres, la police (`POLICES.sousTitres` de
  `commun.mjs` : `fonts/Inter-Black.ttf` et sa licence `OFL-inter.txt`) et GSAP sont lus dans
  `../animations/bibliotheque/` et recopiés dans le calque ; le style (tailles, ombre, pavé, glissé) vient de
  `../animations/scripts/lib/style.mjs` (`blocSousTitres`), les mesures de la police de `lib/police.mjs`.
- **couper-silences** avant lui : `words.cut.json` (mots calés sur la vidéo coupée) et `filtre.txt` (pour la durée en
  images de la vidéo coupée).
- Pour le rendu du calque (fait par la brique rendu) : HyperFrames `npx --yes hyperframes@0.7.55` (Node, Chrome
  téléchargé par HyperFrames la première fois).
- Aucun accès internet, aucun code d'accès, pas de ffmpeg ni de PowerShell pour cette brique.
