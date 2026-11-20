# Accroche composée (les 5 premières secondes)

Décision de Yoan, 2026-11-20 (direction A, « Romain, en plus nerveux ») : « La DA, j'aime bien, mais on laisse la
liberté de la disposition en fonction de la vidéo, du hook, et de l'effet que ça doit faire chez le viewer. »
Il n'y a donc **pas de gabarit d'accroche à recopier** : le monteur compose l'accroche de chaque vidéo dans le plan
(geste `accroche`, format dans `../../../plan-montage/references/format.md`), et `scripts/accroche.mjs` la fabrique en
gardant la signature. Les anciens gabarits `hook-*` restent des briques (tous animés depuis le 2026-11-20), pas des moules.

## La signature (ne change jamais, tenue par le script)
- **Police** : Inter Black seule. Le mot fort et les relances en capitales, la phrase en minuscules.
- **Couleurs** : charbon et craie ; **un seul accent orange par image** (un pavé orange sur sa marche braise, ou un
  soulignage orange). Une deuxième relance prend le pavé craie.
- **Ouverture en dézoom** : la vidéo commence zoomée (112 % conseillé) et revient à 100 % jusqu'au mot fort, où elle
  s'arrête net (zoom `ouverture` de la brique zooms) ; un mot derrière lui dézoome avec la caméra.
- **Trois temps** sur les 5 premières secondes : quelque chose dès le début (avant 0,6 s), le mot fort sur sa voix vers
  1,5 s (0,8 à 2,4 s), une relance vers 2,5 s (1,9 à 4 s). Tout reste jusqu'à 4 s au moins (pas de vide après 3 s), puis
  repart ensemble, 1 s après le dernier mot affiché (7 s au plus), calé sur une coupe proche.
- **Son** : un tick quand le mot fort devient lisible, un clac sous chaque relance. Rien sur les sous-titres.
- Chaque élément arrive sur **son** mot (son attaque, jamais avant) ; ses mots affichés sortent des sous-titres.
- Mouvements de la DA seulement : l'apparition (montée, fondu, flou qui se resserre), la montée du bas en saccade
  12 i/s, ou posé d'un coup ; jamais de rebond, d'échelle ni de linéaire.

- **Elle se lit comme une phrase** : de haut en bas, c'est le début de ce qu'il dit (phrase de tête de 3 mots au moins
  qui pose la tension, mot fort, relance), ses mots exacts, sans trou de plus de 2 mots ; jamais une liste de mots-clés.
- **Rien sur ses yeux ni sa bouche**, et **un seul orange sur toute l'image** : pendant l'accroche, le pavé des
  sous-titres passe en craie si l'accroche porte le pavé orange.

## Ce qui se décide pour chaque vidéo
D'abord **l'effet voulu chez le spectateur** (`effet`) : `surprise` (une idée reçue qui tombe), `tension` (un problème
qu'il vit), `curiosite` (une question, une réponse qui ne vient pas tout de suite), `identification` (« c'est moi »).
Puis, pour aller avec cet effet et avec ce qu'il dit :
- **quel mot porte** (le mot fort : le mot qui fait réagir, jamais « vraiment » ou « en fait ») ;
- **sa taille** : `geant` (l'encre couvre toute la zone sûre), `grand`, `moyen` ;
- **sa place** : `derriere` (derrière sa tête, il faut que sa tête laisse la place), `haut`, `bas` ; et son
  **alignement** `gauche`, `droite` ou `centre` : du côté de la place libre dans l'image (regarde l'image : s'il penche
  ou se tient d'un côté, le texte va de l'autre) ;
- **l'entrée** : `apparition` (la plus calme), `saccade` (montée du bas, nerveuse), `pose` (d'un coup, sec) ;
- **la relance** (une ou deux) : ce qui relance vers 2,5 s, sa place, son entrée (`saccade` par défaut) ;
- **un chiffre qui compte** ou non (`compte_de` : le mot fort est un nombre qu'il dit, qui compte jusqu'à lui) ;
- **une question coupée** ou non (`barre_sur` : sur le mot de la réponse, la question se barre et s'estompe).
Le monteur écrit en une phrase (`pourquoi`) l'effet visé et pourquoi cette disposition.

## La forme de la phrase d'abord (Yoan, 2026-11-20)
Le texte de l'accroche montre la **structure** de ce qu'il dit, pas seulement ses mots. Deux exemples parallèles qui
servent le même propos (« X en A. Y en B. ») se montrent comme une **substitution** (`type: substitution`) : le premier
exemple s'affiche (son mot fort, son pavé), puis le second prend sa place, élément par élément, au même endroit
(`remplace` : le texte de l'élément remplacé), sur sa voix, dézoom gardé. L'ancien part vers le haut, le nouveau monte à
sa place : un remplacement net, jamais un empilement. On sent que ce sont deux cas de la même chose.
Pendant l'accroche, **aucun sous-titre** : son texte les remplace.

## Le registre : jamais la même accroche deux vidéos de suite
`scripts/registre-accroches.mjs` tient un fichier par client dans la mémoire du monteur
(`agent-memory/monteur/registre-accroches.json`). Avant d'écrire l'accroche : `lire` (les deux dernières). La règle,
vérifiée par le script (code 4 `RÉPÉTITION`) : jamais la même combinaison (type, place du mot fort, entrée du mot fort)
qu'une des deux dernières, jamais le même mot mis en avant, jamais la même place que la dernière. `accroche.mjs` vérifie
avant de composer et note la composition quand il l'écrit. Une demande de Romain passe (`demande_de_romain`).

## Six exemples commentés (des illustrations, pas des gabarits)
Les mêmes cinq accroches que la page validée par Yoan. Elles montrent comment l'effet décide de la disposition ; une
autre vidéo, même avec une accroche proche, se compose à neuf.

1. **« Tes courbatures ne prouvent rien. Rien du tout. »** Effet : surprise (une idée reçue qui tombe). Type
   `mot-derriere`. « tes courbatures ne prouvent » en minuscules en haut dès le premier mot (ouverture), RIEN en géant
   derrière sa tête sur sa voix (mot fort, apparition, tick), « RIEN DU TOUT » sur pavé orange en saccade (relance,
   clac), là où son visage laisse la place. Pourquoi : le mot qui casse l'idée reçue doit être le plus gros, derrière lui, comme s'il était dans la pièce.
2. **« Tu t'entraînes cinq fois par semaine et tu stagnes ? Regarde tes jours sans salle. »** Effet : tension. Type
   `chiffre`. Le 5 en grand en haut à gauche qui compte de 1 à 5 sur « cinq » (`compte_de: 1`), « fois par semaine » en
   minuscules dessous, puis « JOURS SANS SALLE » sur pavé craie en bas (deux relances en saccade si les deux mots sont
   espacés). Pourquoi : le chiffre qui défile montre l'effort ; la réponse arrive en bas, à l'opposé.
3. **« Tu veux progresser plus vite ? Entraîne-toi moins. »** Effet : curiosité. Type `question-coupee`. « progresser »
   puis « plus vite ? » en minuscules grandes en haut, barrées et estompées sur « entraîne-toi » (`barre_sur`), puis
   MOINS. en géant derrière lui. Ici le mot fort tombe tard (vers 2,3 s) : la barre fait le deuxième temps, le mot fort
   le troisième. Pourquoi : la question est effacée par la réponse, on veut savoir pourquoi.
4. **« Ta séance ne te fait pas progresser. C'est ce que tu fais après. »** Effet : surprise. Type `deux-paves`.
   « TA SÉANCE » sur pavé craie posé d'un coup en haut, puis APRÈS en grand pavé orange qui monte en saccade dessous.
   Pourquoi : deux pavés qui s'opposent, le deuxième plus gros, pour un « pas A, mais B ».
5. **« Tu reprends le sport avec la tête d'il y a dix ans. C'est là que ça casse. »** Effet : identification. Type
   `titre-depuis-le-dezoom`. Dézoom plus long (jusqu'au mot fort), « avec la tête » puis « d'il y a » en minuscules au-dessus
   de sa tête, DIX ANS en géant derrière lui, « ÇA CASSE » en relance en bas. Pourquoi : la phrase longue se lit pendant
   que la caméra recule, le chiffre arrive quand elle s'arrête.

6. **« Des pompes en un jour. Un dos musclé en dix jours. »** (deux promesses de pub, même absurdité) Effet :
   surprise. Type `substitution`. POMPES en grand en haut au centre, « EN 1 JOUR » sur pavé orange en bas au centre ;
   puis DOS MUSCLÉ remplace POMPES et « EN 10 JOURS » remplace « EN 1 JOUR », mêmes places, sur sa voix. Le mot fort
   est DOS MUSCLÉ (le dernier mot à l'écran), la relance EN 10 JOURS.

## Fabrication
`node scripts/accroche.mjs <dossier -montage> --video <vidéo coupée>` après le calage et la brique zooms ; il écrit
`calques/a01-derriere` et `calques/a01-devant`, `accroche.json` (la composition retenue) et la ligne du registre.
Ensuite `verifier.mjs` sur chaque calque (avec `--video`), puis `calques.mjs`. Constantes : `ACCROCHE` de `commun.mjs`.
