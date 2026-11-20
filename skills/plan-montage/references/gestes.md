# Les gestes du style de Romain

La bibliothèque du style (`../animations/bibliotheque/`, un dossier par geste avec son README et
son aperçu) contient un gabarit par geste. Le plan nomme le geste dans `geste`, donne ses textes dans
`elements` (chacun sur le mot qui le déclenche) et ses variantes dans `reglages`. Seuls les réglages
listés ici existent ; un autre est écarté au calage (le style gagne) : n'en demande pas d'autre. La
bibliothèque est une vitrine : quand la demande ne tient pas dans un gabarit (5 éléments au lieu de
4, autre disposition), la brique animations recompose à partir du gabarit le plus proche. Tu peux
donc demander une liste de 5 avec `liste`.

Où ça se voit : **caméra** = posé sur l'image, il reste visible ; **plein** = couvre l'écran ;
**demi** = panneau en haut, son visage poussé vers le bas ; **derrière** = passe derrière lui.
Les sous-titres de la vidéo s'effacent d'eux-mêmes pendant les gestes marqués (sa ligne).

## L'accroche composée (le défaut, depuis le 2026-11-20)

- `accroche` (derrière et caméra) : l'accroche de la vidéo, composée pour elle (`regles.md`, « L'accroche »,
  format dans `format.md`). La signature est tenue par le script ; tu décides la disposition : rôles
  `phrase`, `mot` (le mot fort), `relance` (une ou deux, sur pavé), tout en capitales, des tailles proches, et pour
  chacun sa place (`derriere`, `haut`, `bas`), son alignement, sa taille, son entrée. Une seule accroche
  par vidéo, toujours `a01`. Deux exemples parallèles : `type: substitution`, le second remplace le premier au même
  endroit (`remplace`).

## Le corps de la vidéo (par défaut, chacun quand une phrase le demande, `regles.md`, « Comment penser chaque moment »)

- `plein-ecran-visage` (caméra puis plein) : la phrase à retenir. Le mot clé au-dessus de sa tête sur son image, puis le
  fond uni (orange ou charbon) qui monte en gardant le mot, puis 1 à 3 points sur leurs mots, chacun avec sa figure
  (`courbe`, `cases`, `barre`, `aucune`). Composé par son script ; format dans `format.md`.
- `partout` (plein) : la multitude, quand il **affirme** qu'une chose se voit ou se dit partout : les pages en sont la
  preuve (`preuve` obligatoire). Jamais sur une connivence ou un constat partagé avec le spectateur. Le mot fixe sur son
  surligneur, des captures d'articles sur téléphone qui défilent autour. Composé par son script.
- `texte-sur-lui` (caméra) : une animation légère sur lui, sur une phrase d'enjeu ou de contraste (condition,
  opposition, projection, adresse), sur chaque question qu'il pose au spectateur (`question`) et sur le moment clé : ses
  mots en capitales au-dessus de sa tête (ou sous son visage), sur sa voix ; dans une opposition, la ligne qui tombe se
  barre. Au moins une dans le dernier tiers. Composé par son script ; il tient compte du zoom en cours.
- `plan-a-filmer` (plein, ses sous-titres restent) : l'écran « B-ROLL » à la place d'un plan filmé qui manque, sur
  toute la phrase qui cite une chose concrète ; dit ce qu'il faut filmer. Composé par son script.

## Briques d'accroche (anciens gabarits, animés : sur sa demande ou pour une vidéo sans parole)

- `hook-paves` (caméra) : 1 à 3 lignes sur pavés en haut, posées d'un coup, affichées 2 s.
  Niveau simple. `reglages.couleur` : `craie` | `orange`. Éléments : une ligne chacun.
- `hook-titre-derriere` (derrière) : une phrase courte en haut et un mot géant derrière sa tête.
  Pour un mot-sujet fort. Éléments : la phrase, puis le mot géant (`role`: `phrase`, `mot`).
- `hook-mot-geant` (derrière et caméra) : petits mots devant, mot géant derrière sa tête, en trois
  temps sur sa voix. Éléments : petit mot 1, mot géant, petit mot 2.
- `hook-chiffre` (caméra) : un chiffre énorme, la suite de la phrase, puis un pavé. Pour une
  accroche qui contient un chiffre qu'il dit. Éléments : le chiffre, la suite, le pavé.
- `hook-question` (caméra) : le sujet en mot géant, la question sur pavé dessous, sur sa démo.
  Éléments : le sujet, la question.

Le reste de la bibliothèque (cartes, demi-écran, schéma, comparaison, minuteurs, tier list, fond vert,
formats connus) : sur sa demande. Par défaut, le corps de la vidéo a ses plans filmés (ou `plan-a-filmer`),
`plein-ecran-visage` (ou `plein-ecran-fond`), `partout` s'il le dit, `transition-flash`, `liste` s'il énumère plus de
trois choses, et des animations légères au rythme de la densité (`regles.md`, « Densité »).

## Fin (mot en commentaire)

- `cta-champ-instagram` (caméra, sa ligne) : le vrai champ de commentaire Instagram, le mot se tape
  lettre par lettre, « Publier » s'allume. Éléments : la phrase (`role`: `sous-titre`), le mot
  (`role`: `mot`). `sa_ligne` : `garder` | `retirer`.
- `cta-mot-derriere` (derrière et caméra, sa ligne) : le mot monte en géant derrière sa tête,
  « commente MOT » devant. Mêmes éléments.

## Transitions (sur une coupe)

- `transition-flash` : deux images claires sur la coupe. Entrée et sortie des pleins écrans. `de` =
  le premier mot après la coupe. Pas d'éléments.
- `transition-faisceau` : une bande inclinée balaie l'écran sur la coupe. Changement de partie, de
  lieu, de plan. `reglages` : `couleur` (`craie` | `orange`), `largeur` (`2200` plein | `1000`
  étroit). Pas d'éléments.
- Par défaut : la coupe sèche, sans transition. Une transition par changement de partie, pas plus.

## Pleins écrans

- `plein-ecran-fond` (plein, sa ligne) : sa phrase forte sur 2 lignes en grand, chaque ligne sur son
  mot. `reglages.fond` : `charbon` | `orange` (le message principal) | `craie` | `flou` (sa vidéo
  floutée : évite-le pour le message principal, retour de Yoan). Éléments : ligne 1, ligne 2.
- `plein-ecran-orange` (plein, sa ligne) : phrase sur orange, 2 lignes centrées. Éléments : 2 lignes.
- `liste` (plein, sa ligne) : liste numérotée, chaque élément sur son mot, la ligne en cours en
  avant. Éléments : un par élément de la liste, dans l'ordre.
- `schema` (plein, sa ligne) : un effet au centre, ses causes autour, reliées par des traits qui se
  tracent. Éléments : l'effet (`role`: `effet`), les causes (`role`: `cause`).
- `minuteur-chiffres` (plein, sa ligne) : un temps qui se compte à rebours. Éléments : le chiffre,
  son libellé.
- `minuteur-barre` (plein, sa ligne) : le temps et une barre qui se vide, sur sa vidéo floutée.
- `recherche-google` (plein, sa ligne) : la vraie page de recherche, sa phrase tapée lettre par
  lettre, suggestions, Entrée. Éléments : la phrase tapée (ce qu'il dit).
- `comparaison` (plein) : la mauvaise option qui s'effondre, puis 3 photos de la bonne, puis le mot
  clé. Éléments : le mot de la mauvaise option, les 3 bonnes, le mot clé. `photos` : 3 photos de lui.

## Demi-écran (rare)

- `demi-ecran` (demi) : panneau en haut avec une phrase et un mot en orange, son visage poussé vers
  le bas. `reglages.sortie` : `faisceau` | `bascule` (le panneau grandit en plein écran). Éléments :
  la phrase, le mot. Jamais pour une liste, un minuteur ou un schéma.

## Cartes (sur la caméra ou sa vidéo floutée)

- `carte-chapitre` (caméra) : numéro, titre, petite ligne, en haut à gauche. Pour annoncer une
  partie. Éléments : `numero`, `titre`, `petite ligne`.
- `carte-seance` (sa vidéo floutée) : les exercices d'une séance, ligne par ligne. Séries,
  répétitions, repos **seulement s'il les dit**. Éléments : un par exercice. `photos` : vignette de
  chaque exercice (à fournir).
- `carte-superset` (sa démo floutée) : deux exercices reliés. Éléments : les deux exercices.
- `carte-fiche-exercice` (sa vidéo floutée) : photo et nom de l'exercice, puis trois cases chiffrées
  (ses chiffres seulement). Éléments : nom, puis chaque case.
- `carte-presentation` (caméra, en bas) : photo de profil, nom, une ligne, pseudo. Quand il se
  présente.
- `carte-nutrition` (caméra) : ses plats en vignettes puis ses totaux. Chiffres dits par lui.
  `photos` : ses plats.
- `carte-chrono` (caméra, coin libre) : un temps de chrono (« 0:45 », « 1:30 ») et sa légende. Pour
  un temps d'effort ou de repos qu'il donne, pas pour une durée comme « 3 mois » (mot fort ou mot qui
  bouge à la place).

## Sur ses démos et sur la caméra

- `broll-annote` (sa démo dans une carte) : un point sur le muscle, un trait, une étiquette. Le nom
  est le sien. Exige une démo filmée par lui (un de ses clips, `b_roll`).
- `angle-coude` : l'angle d'une articulation mesuré sur sa démo. Seulement si l'angle compte dans
  ce qu'il dit.
- `tampon-verdict` (caméra, en haut à droite) : « OUI » / « NON » / un verdict court, penché, sur
  son mot. Le tampon « mauvais » seulement sur un mauvais exemple qu'il montre.
- `anatomie` (plein, silhouettes) : le muscle dont il parle s'allume sur son mot.
- `tier-list` (plein, sa ligne) : un classement façon TierMaker, chaque vignette posée sur son mot.
  L'ordre vient de lui, jamais de nous. `photos` : une par élément.
- `fond-vert` (derrière, lui détouré) : lui devant un visuel fait de ses mots (phrase, chiffre
  géant). Pour une promesse forte, rarement.

## Sous-titres et zooms (pas des gestes : clés à part du plan)

- Sous-titres : un seul style, le sien (Inter Black, pavé orange qui glisse), aux deux niveaux ; rien à choisir.
- Zooms `suivi` (le zoom qui suit sa tête, le défaut), `eclair`, `rapprochement` et `ouverture` (le dézoom
  de l'accroche) ; `"suivre": true` donne le suivi de sa tête à un éclair ou un rapprochement (voir `regles.md`).

## Ajouts de Yoan (2026-11-11), en sur mesure : sur la demande de Romain seulement depuis le 2026-11-20
(sauf le plein écran de la phrase à retenir, qui reste le défaut, et le titre derrière lui, remplacé par
l'accroche composée)

- **Titre derrière lui + dézoom d'ouverture** : base `hook-titre-derriere`, titre sur 2 ou 3 lignes
  lisible sans le son, surlignage orange sur l'objet du désir, caméra de 120 % à 100 % jusqu'au mot clé (zoom `ouverture`), le titre dézoome avec elle.
- **Sous-titres enrichis** : le mot clé en grand **à la place** de ses sous-titres (même hauteur,
  même police, même comportement), plus gros sur sa propre ligne (jamais deux tailles dans une même ligne), sur un ou deux étages, souligné à
  main levée en orange. Jamais redit en petit.
- **Chose réelle à l'identique, sur la caméra** (derrière sa tête ou à côté de lui) : une appli ou
  un objet qui existe, reproduit comme le vrai (l'appli Calendrier d'Apple, vue mois), posé comme un
  écran, jamais suspendu dans le vide. Les marques (cercle, coches) se tracent seules, sans stylo.
- **Animation qui illustre, plein écran** (fond charbon ou orange en alternance) : seulement pour
  une idée abstraite. Minimaliste : sa phrase en texte qui se comporte comme les sous-titres, en
  haut et en bas, et une ou deux formes nettes qui portent ses mots (une brique qui s'emboîte dans
  une autre) ; ou l'effet journaux, ou le calendrier de « ce lundi ». Jamais de personnages, de
  fausse 3D, de décor.
- **Image de réaction** : un mème connu en haut à droite, assez gros, qui pop pile sur son mot avec le son Vine boom (`photos` : `fichier` null,
  `quoi` = le mème exact et les mots pour le chercher ; tu le télécharges toi-même).
- **Plein écran du message principal** : `plein-ecran-fond` sur fond `charbon` ou `orange` (jamais
  `flou` pour ça) s'il n'y a que du texte ; `sur-mesure` basé dessus dès qu'il y a des animations.
  Le mot clé en très gros puis de petites animations sur ses mots (courbe qui monte,
  cases qui se cochent, flèche), entrée et sortie par `transition-flash` avec un clic.

## Sur mesure

`"geste": "sur-mesure"` quand rien ne couvre le besoin : mots qui bougent, élément posé à côté de sa
main, format connu absent de la liste (commentaire Instagram, DM, note de téléphone). L'`intention`
est obligatoire et précise (20 caractères au moins, mieux : 2 ou 3 phrases) :
1. ce que la personne doit comprendre ;
2. le geste du style à reprendre (« comme le mot fort », « comme le mot géant derrière sa tête »,
   « comme la recherche Google, à l'identique de l'original ») ;
3. où dans l'image, sur quels mots, combien de temps.
