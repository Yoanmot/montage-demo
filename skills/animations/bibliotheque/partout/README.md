# partout (la multitude)

Composé par `scripts/partout.mjs`. Effet validé par Yoan sur le test v19 (« l'effet plein de screens, c'était bien »).

## Ce qu'il montre

Plein écran blanc : des captures d'articles sur téléphone défilent en coupes sèches de 2 à 4 images, et son mot reste
fixe au même endroit, sur un surligneur orange aux bords irréguliers (text match cut). Chaque page est une vraie capture
d'écran d'iPhone : barre d'état, barre du navigateur avec l'adresse du site (Safari en bas, Safari en haut ou navigateur
à barre d'adresse en haut), en-tête du site, rubrique, titre, chapô, auteur, photo sans personne, corps à la taille
réelle d'un site, liens, intertitres, « À lire aussi », publicité. Traînées de mouvement vers le bas, plus longues loin
du mot ; quelques pages entièrement en flou de mouvement. Le mot fait partie du texte de chaque page, dans la police du
site.

## Quand l'utiliser

Quand il dit qu'une chose se voit ou se dit partout : tout le monde le répète, on le lit partout, c'est le conseil que
tout le monde donne (« on voit ce chiffre partout », « tout le monde te dit ça », « tu l'as lu cent fois »). Le mot fixe
est ce qu'il a dit (le chiffre, la règle, le conseil), dans le passage ou dans les 20 s avant. Une fois par vidéo au
plus : c'est un plein écran fort.

**Les pages sont une preuve** (Yoan, 2026-11-20) : elles montrent qu'une chose se voit partout parce qu'il **affirme**
cette fréquence. Sur une phrase de connivence (il prend le spectateur à témoin d'une expérience commune, un constat
partagé), elles ne prouvent rien : c'est un regard échangé, on reste sur lui. Jamais non plus pour finir la vidéo
(elle finit sur lui) ni juste après un autre écran qui le cache.

## La demande du plan

```json
{ "id": "a03", "geste": "partout",
  "intention": "Il dit que ce conseil revient partout : la multitude.",
  "de": "tout le monde", "a": "répète",
  "elements": [ { "texte": "le matin à jeun", "sur": "tout le monde" } ],
  "composition": { "preuve": "il affirme que tout le monde répète ce conseil", "pages": [
    { "titre": "Courir le matin : ce que conseillent les spécialistes", "avant": "Beaucoup recommandent de courir", "apres": "pour profiter de la journée" },
    { "titre": "Les habitudes des sportifs réguliers", "avant": "Leur secret : s'entraîner", "apres": ", avant même le petit-déjeuner" },
    "... 6 à 12 pages"
  ] } }
```

- `elements` : un seul élément, le mot fixe (`texte`, 24 caractères au plus), avec `sur` (premier mot du passage).
  Chiffre avec unité, mot ou courte expression, tel qu'il le dit. `chiffre_source` dit où il le dit si c'est avant le
  passage ; `titre_reformule` (avec sa raison) seulement s'il n'est pas dit tel quel.
- `composition.preuve` : l'affirmation de fréquence qu'il fait et que les pages prouvent (une phrase).
- `composition.pages` : 6 à 12 pages `{ titre, avant, apres }`. `titre` : le titre de l'article (70 caractères au
  plus). `avant` : le début de la phrase qui mène au mot ; `apres` : la suite de la phrase (commence par une virgule
  ou un point si la phrase le veut). Aucun chiffre sur une page, sauf celui du mot fixe ; aucune marque.
- Le reste ne s'écrit pas : sites, photos, auteurs, paragraphes autour, « À lire aussi », publicités sont le décor fixe
  de la brique (`decor.json`), répartis en rotation sur les pages. Le début de la ligne du mot est tiré par le script des
  derniers mots de `avant` (et, si `avant` est court, de la fin de la phrase du décor qui la précède).

Refus (code 2, à corriger dans le plan) : `PREUVE` (pas d'affirmation de fréquence écrite), `ELEMENTS` (pas un seul mot fixe, mot trop long), `MOT_NON_DIT`, `PAGES`
(nombre, champ manquant, titre trop long), `CHIFFRE_NON_DIT`, `TROP_COURT` (moins de 0,8 s pour voir défiler les pages).

## Le temps

- Début : l'image de l'attaque de `de` moins 1 (flash craie à 50 % sur la dernière image de lui, 100 % sur la première
  page). Fin : la coupe qui suit `a` (à 0,6 s près), sinon la fin de `a` + 0,2 s ; 3 s au plus (avis), 0,8 s au moins.
- Une page par coupe sèche, durées tirées de `PARTOUT.durees` (2 à 4 images, comme la v19), la dernière ajustée pour
  finir pile ; les pages du plan reviennent dans l'ordre si le passage est long.
- Sous-titres masqués pendant l'effet (`masque_sous_titres`), un seul orange à l'écran (`oranges`).

## Le son

Le clic de transition sur le flash d'entrée (la première page arrive avec lui), puis un petit clic `clic-court.wav` à
chaque changement d'écran (`SONS.ecran`, 21 dB sous la voix ; la série est un seul geste). Écrits dans `sons_suggeres`.

## La composition

- Page construite à `PARTOUT.capture` px CSS de large (un iPhone) puis agrandie jusqu'aux 1080 px de la vidéo, comme une
  capture d'écran. Huit sites inventés aux noms neutres, chacun sa mise en page, ses couleurs et ses polices (Georgia,
  Charter, Helvetica Neue, Avenir Next, Iowan Old Style, Verdana, système d'Apple), jamais d'italique. Calque natif
  (`origine.natif`, pages `data-natif`).
- À l'ouverture, le navigateur mesure les débuts de ligne possibles, choisit un bord gauche commun à toutes les pages
  (`PARTOUT.mot.x` : entre `min` et `max`, au plus près de `pref`, la place de la v19) puis, page par page, le début de
  ligne, la marge du site (`margeSite`) et le corps du texte (`corps`) qui amènent le mot à ce bord ; un mot coupé en fin
  de ligne (« lende- / main. Comptez ») seulement s'il le faut (`coupure`). La page défile pour que la ligne de base du
  mot tombe à `PARTOUT.mot.base`.
- Traînées par bandes sous la ligne du mot (`bandes`, `trainees`), pages en flou (`flous`, `flouLigne`).
- Contrôle (`verifier.mjs`) : les fonds de page sont marqués `fd` (ignorés par la zone sûre) ; une copie de la ligne du
  mot, réduite à la boîte du surligneur et hors `fd`, porte le mot et son surligneur pour le contrôle.

## Constantes

`PARTOUT` dans `bibliotheque/commun.mjs` : `durees`, `dureeMin`, `dureeMax`, `aimant`, `ditAvantMax`, `pagesMin`,
`pagesMax`, `titreMax`, `motMax`, `debutsMax`, `capture`, `mot` (`x.pref`, `x.min`, `x.max`, `base`), `margeSite`,
`corps`, `coupure`, `surligne`, `bandes`, `trainees`, `flous`, `flouLigne`. Le décor : `bibliotheque/partout/decor.json`
(sites, ordre des sites, photos, modèles de page, paragraphes de fin), sans chiffre ni marque.
