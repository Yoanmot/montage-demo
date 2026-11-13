---
name: sous-titres
description: Brique du monteur. Prépare les sous-titres d'une vidéo déjà coupée, au style des reels de Romain (classique avec le pavé orange qui glisse de mot en mot, ou formelle avec ses mots forts en grand), à partir du texte calé par couper-silences, avec l'orthographe corrigée sans toucher à ce qu'il dit. Écrit un calque transparent posé devant l'image ; ne fabrique pas la vidéo, c'est la brique rendu qui la fait. Appelée par l'agent monteur une fois les coupes prêtes.
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
numéro (`[12]abdos`), et un `/` devant un mot qui suit une pause de plus de 0,25 s. Lis-le en entier.
- `TEXTE_INTROUVABLE` : la vidéo n'est pas encore coupée. Le monteur doit d'abord passer par couper-silences.

### 2. Corriger l'orthographe (c'est ton travail)
Le texte vient d'une transcription automatique : quelques mots peuvent être mal écrits (noms propres, marques,
vocabulaire de coach, mots mal entendus).
**Tu corriges l'orthographe, tu ne réécris jamais ce qu'il dit** : pas de reformulation, pas de mot ajouté ou retiré,
pas de « euh » enlevé s'il a été gardé à la coupe. Dans le doute, ne touche pas. Les nombres restent comme ils sont écrits.

**Les noms d'exercices, de matériel et le jargon de coach** sont les mots que la transcription rate le plus (« DJH sit
up » pour « GHD sit-up »). Écris-les comme dans le `vocabulaire` du plan de montage, sinon sous leur forme connue dans le
monde du sport. Si tu n'es pas sûr de ce qu'il a voulu dire, demande-lui plutôt que de deviner.

**La ponctuation reste** : un mot corrigé garde la ponctuation de fin du mot d'origine (elle marque les fins de phrase,
dont dépendent les mots forts). À l'écran, le style retire la ponctuation de fin et les guillemets, et tout est en
minuscules : n'écris pas de majuscules pour les mettre en avant, ça ne se verra pas.

### 3. Le style et les mots forts : ce que dit le plan de montage
Le plan de montage (écrit par le monteur avec le skill plan-montage) dit le style des sous-titres et, en formelle, les mots forts. Tu n'en choisis pas.
- **classique** (montage simple, organique) : une ligne par groupe, le mot en cours sur un pavé orange qui glisse.
- **formelle** (montage plus pro) : 3 mots au plus par groupe, le groupe apparaît d'un coup, sans pavé.
- **mots forts** (formelle seulement) : le groupe qui porte l'idée s'affiche en grand, en capitales, au-dessus de la
  ligne restée affichée, et part avec la fin de sa phrase. Prends **exactement les mots que le plan désigne**.
- Plan sans indication : **classique, aucun mot fort**. Plan qui demande des mots forts en classique : ils n'existent
  qu'en formelle ; signale-le au monteur au lieu de changer le style.

### 4. Choisir les groupes (c'est ton travail)
Un groupe = les mots affichés ensemble sur une ligne.
- **Classique** : une ligne par morceau dit d'un trait, 2 à 4 mots en général. Coupe aux pauses (`/`), aux virgules,
  aux fins de phrase, et entre deux idées. Ne laisse pas un petit mot seul (« de », « et ») en bout de ligne s'il va
  avec la suite.
- **Formelle** : **3 mots au plus**, coupés au même endroit qu'on respirerait en lisant.
- **Mot fort** : il forme un groupe à lui seul (« douze semaines », « dix pas »). Il se pose au-dessus d'une ligne
  déjà affichée : choisis-le au milieu ou en fin de phrase, jamais tout au début de la vidéo, un seul par phrase.
- Jamais une fin de phrase au milieu d'un groupe.

Écris `<dossier>/sous-titres.json` :
```json
{
  "style": "formelle",
  "corrections": { "57": "Ekklo", "102": "squats," },
  "masquer": [[140, 145]],
  "groupes": [0, 3, 5, 8, 31, 33],
  "motsForts": [31]
}
```
- `style` : `classique` ou `formelle` (classique si absent).
- `corrections` (facultatif) : numéro du mot -> le mot corrigé. Pour réunir deux mots en un (« sit » « up » ->
  « sit-up »), mets le mot entier sur le premier et `""` sur le second.
- `masquer` (facultatif) : plages de numéros de mots à ne pas afficher, bornes incluses. Seulement s'il le demande.
- `groupes` : le numéro du **premier mot de chaque groupe**, dans l'ordre ; chaque groupe court jusqu'au suivant.
  Le premier est le premier mot affiché. Les signes seuls (`[174]?`, `[198]«`) ne s'affichent pas : ne commence
  jamais un groupe par eux, ils restent collés au mot d'avant.
- `motsForts` (formelle) : le numéro du premier mot de chaque groupe à mettre en mot fort.

### 5. Fabriquer le calque : `preparer`
Le script écrit le calque des sous-titres dans `<dossier>/calques/st/` (prêt à rendre, à la durée de la vidéo coupée)
et sa ligne dans `<dossier>/calques.json`, sans toucher aux calques des autres briques.
- `SOUS-TITRES_ILLISIBLE` : le message dit quoi corriger (groupe trop long pour tenir sur une ligne, plus de 3 mots en
  formelle, mot fort mal placé, numéro inexistant). Corrige `sous-titres.json`, relance.
- `à relire` : un avertissement (fin de phrase au milieu d'un groupe, mot fort en début de phrase). Corrige si c'est
  une erreur.
- `BIBLIOTHEQUE_INTROUVABLE` : le skill animations n'est pas installé à côté de celui-ci ; préviens Yoan.
- `GABARIT_INATTENDU` : la bibliothèque du style a changé de forme ; préviens Yoan, ne bricole pas.
- `retiré (calque qui efface les sous-titres)` : normal, voir ci-dessous.
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
corrections) : corrige d'abord ici, puis fais refaire le calque d'animation.

## Les retouches (à proposer quand il a vu la vidéo)
- « tel mot est mal écrit » : une ligne dans `corrections` ;
- « enlève cette phrase des sous-titres » : `masquer` (et retire des `groupes` les numéros masqués) ;
- « coupe la ligne ici », « trop de mots d'un coup » : `groupes` ;
- « mets tel mot en grand », « enlève ce mot en grand » : `motsForts` (formelle) ;
- « plus simple », « plus pro » : `style`.
Puis `preparer`, et le monteur refait la vidéo depuis l'originale.
La taille, la police, les couleurs et la hauteur des sous-titres sont celles de son style, fixées avec Yoan : s'il
veut les changer, note-le pour Yoan au lieu de les modifier.
Les sous-titres sont incrustés dans l'image : on ne peut pas les retoucher dans Edits. Pour changer un mot, il le
demande ici et la vidéo est refaite en quelques minutes.

## Dépendances
- **Node 24** (`node`) : lance le script, et sert à HyperFrames.
- **Le skill animations** installé à côté de celui-ci : le gabarit des sous-titres, les polices et l'animation sont lus
  dans `../animations/bibliotheque/` (`sous-titres/devant/index.html`, `fonts/BricolageGrotesque.ttf`,
  `fonts/BigShouldersDisplay.ttf` et leurs licences, `vendor/gsap.min.js`), et recopiés dans le calque.
- **couper-silences** avant lui : `words.cut.json` (mots calés sur la vidéo coupée) et `filtre.txt` (pour la durée en
  images de la vidéo coupée).
- Pour le rendu du calque (fait par la brique rendu) : HyperFrames `npx --yes hyperframes@0.7.55` (Node, Chrome
  téléchargé par HyperFrames la première fois).
- Aucun accès internet, aucun code d'accès, pas de ffmpeg ni de PowerShell pour cette brique.
