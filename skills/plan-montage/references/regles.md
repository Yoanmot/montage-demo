# Règles de montage des reels de Romain

Les exemples entre guillemets viennent des tests de Yoan : ils montrent la forme, jamais un contenu à reprendre.

Ce fichier dit **quand** un effet sert, **ce qu'il fait** et **quand l'éviter**. Le **comment** (couleurs, tailles,
durées, sons) est dans le style de Romain, appliqué par les briques. Les retours de Yoan sont dans `preferences.md`, les
goûts retenus de Romain dans ta mémoire (`## Pour le plan`) : les deux passent avant ce fichier.

## Le principe : un montage classique, une accroche qui claque

Décision de Romain et Yoan (2026-11-20) : « Pour le reste du montage, Romain veut du très classique : les sous-titres,
les b-roll au bon moment avec les transitions, quelques animations mais très légères, on reste dans la simplicité, des
bons zooms. Des fois, rien qu'un zoom et un mouvement de caméra qui fait qu'on suit la tête, c'est un effet en soi. Faire
apparaître un fond uni en plein écran pour afficher des captions importantes en le stylisant un peu, c'est simple mais
c'est un effet aussi. »

Donc :
- **Les 5 premières secondes travaillent** : l'accroche composée (ci-dessous), dans sa signature, différente à chaque
  vidéo.
- **Le reste est simple et propre** : ses sous-titres, ses plans filmés en plus au bon moment, de bons zooms (le zoom qui
  suit sa tête d'abord), un plein écran sur fond uni pour la phrase qui compte. C'est son visage et sa voix qu'on vient
  chercher.
- **Peu d'animations, légères** : une ou deux dans le corps de la vidéo au plus, seulement quand elles font comprendre
  quelque chose qu'on ne verrait pas sinon (une liste qu'il énumère, un chiffre qu'il donne). Dans le doute, pas
  d'animation : un zoom qui suit sa tête ou un plein écran sur fond uni font l'effet.
- Chaque élément à l'écran **retient**, **fait comprendre** ou **fait agir**. Le reste est du bruit.
- **S'il demande autre chose, on le fait** : tout ce que la bibliothèque sait faire (mèmes, sous-titres enrichis,
  cartes, demi-écran, formats connus, animations sur mesure) reste possible sur sa demande, pour une vidéo, ou par
  défaut s'il te demande de t'en souvenir. Ce n'est simplement plus ce que tu proposes de toi-même.

## L'accroche (les 5 premières secondes) : composée, jamais recopiée

C'est elle qui décide si la personne reste. Elle a une **signature fixe** (on reconnaît Romain en une seconde) et une
**disposition libre** (on ne reconnaît jamais le moule). Geste `accroche`, format dans `format.md`, exemples commentés
dans `../../animations/bibliotheque/accroche/README.md` (des illustrations, pas des gabarits).

**La signature, la même à chaque vidéo** (le script la tient, tu n'as rien à régler) : Inter Black, le mot fort en
capitales, la phrase en minuscules ; un seul accent orange par image, le reste charbon et craie ; l'**ouverture en
dézoom** ; **trois temps** sur les 5 premières secondes (quelque chose dès le début, le mot fort sur sa voix vers 1,5 s,
une relance vers 2,5 s) ; rien ne s'arrête avant 4 s (pas de vide après 3 s) ; un son sur le mot fort.

**Ce que tu décides pour chaque vidéo**, dans cet ordre :
1. **L'effet voulu chez le spectateur** (`effet`) : `surprise` (une idée reçue qui tombe), `tension` (un problème qu'il
   vit), `curiosite` (une question dont la réponse se fait attendre), `identification` (« c'est moi »). Il se lit dans sa
   première phrase.
2. **Le mot qui porte** : le mot qui fait réagir (un nom, un chiffre, un verbe fort, le contraste), jamais « vraiment »
   ou « en fait ». Il est dit vers 1 à 2 s, sinon prends un autre mot.
3. **Sa taille et sa place** : derrière sa tête en géant (il faut que sa tête laisse la place au-dessus), en haut, ou en
   bas ; à gauche, à droite ou au centre, **du côté de la place libre dans l'image** (regarde l'image de ses premières
   secondes : s'il est décalé d'un côté, le texte va de l'autre).
4. **L'entrée** du mot fort : `apparition` (calme, pour l'identification), `saccade` (nerveuse, pour la tension),
   `pose` (sèche, pour la surprise). Ce sont des pistes, pas une table.
5. **La relance** vers 2,5 s : la suite de sa phrase qui relance (« du tout », « c'est ce que tu fais après »), sur pavé,
   à l'opposé du mot fort le plus souvent.
6. **Un chiffre qui compte** (`compte_de`) seulement s'il dit un chiffre qui étonne ; **une question coupée**
   (`barre_sur`) seulement s'il pose une question et y répond tout de suite.
7. **En une phrase** (`pourquoi`) : l'effet visé et pourquoi cette disposition. Exemple de forme : « Surprise : RIEN en
   géant derrière lui casse l'idée reçue, la relance en bas à droite enfonce le clou ».

**Jamais la même deux fois de suite** : avant d'écrire l'accroche, lis le registre (`registre-accroches.mjs lire`) ; ne
reprends ni la combinaison (type, place, entrée du mot fort) des deux dernières vidéos, ni leur mot, ni la place de la
dernière. Le script refuse une répétition (`RÉPÉTITION`). À égalité, choisis la disposition qui n'a pas servi depuis le
plus longtemps.

**Le titre peut ne pas être une phrase dite** (il se lit sans le son), mais il ne promet rien qu'il ne dit pas dans la
vidéo et reprend ses mots quand c'est possible. Écris dans l'`intention` la phrase de lui d'où il vient.

- Le dézoom d'ouverture va dans `zooms` : `{ "type": "ouverture", "sur": "<le mot fort>", "echelle": 1.12 }` ; il
  s'arrête net sur le mot fort, et le mot derrière lui dézoome avec la caméra. Aucun autre zoom pendant l'accroche.
- Ce qui reste dessous : ses sous-titres, sans les mots que l'accroche affiche (chaque mot n'est vu qu'une fois).
- **Jamais** : ouvrir sur un plan filmé en plus sans lui, ouvrir sur un plein écran, une accroche qui annonce autre
  chose que la vidéo, une accroche recopiée d'une autre vidéo.

## Le corps de la vidéo : simple et propre

- **Ses sous-titres** tout le long, propres (orthographe, chiffres en chiffres, ses mots exacts). Rien à styliser de
  plus : c'est la base.
- **Ses plans filmés en plus au bon moment** : chacun sur la phrase qu'il montre (de son premier à son dernier mot),
  jamais un plan qui montre autre chose que ce qu'il dit. Transition simple : la coupe sèche, ou un flash avec son clic
  quand on change de lieu ou de partie (au plus un par changement de partie). Pas de faisceau, de demi-écran ni d'effet
  autour d'un plan filmé.
- **De bons zooms**, voir « Les zooms » : le **zoom qui suit sa tête** est l'effet par défaut d'une phrase qui compte.
- **Un plein écran sur fond uni** (charbon ou orange, sa phrase en grand sur deux lignes, entrée et sortie par un flash
  avec son clic) pour **la phrase qu'on doit retenir**. Une fois par vidéo, deux au plus. C'est simple et c'est un effet
  en soi : pas d'animation en plus dessus.
- **Une ou deux animations légères au plus**, seulement si elles font comprendre : une liste qu'il énumère (chaque
  élément sur son mot), un chiffre ou un temps qu'il donne posé à côté de lui. Pas d'animation pour faire joli.
- **Laisser respirer** : son visage avec ses seuls sous-titres porte la vidéo. Lui à l'écran au moins 70 % du temps.
- **Un changement toutes les 5 à 8 secondes** suffit, et un zoom est un changement. Pas besoin d'un effet par phrase.
- **Un seul accent à la fois** : jamais un zoom pendant un plein écran, jamais deux animations en même temps.

## Dosage (pour un reel de 45 à 60 s)

| Élément | Par défaut |
|---|---|
| Accroche composée + dézoom d'ouverture | 1 |
| Zooms (le zoom qui suit sa tête d'abord, quelques éclairs) | 3 à 6, sur les passages caméra |
| Ses plans filmés en plus | tous ceux qu'il a donnés, chacun sur sa phrase |
| Plein écran sur fond uni (la phrase à retenir) | 1, 2 au plus |
| Flash avec clic | à l'entrée et à la sortie d'un plein écran, à un changement de lieu |
| Animations légères (liste, chiffre posé à côté de lui) | 0 à 2 |
| Sous-titres enrichis, images de réaction, cartes, demi-écran, formats connus | 0 (sur sa demande) |
| Fin (mot en commentaire) | 1 s'il en dit un |

Plus court (20 à 30 s) : divise par deux, garde l'accroche et la fin.

## Plein écran ou caméra

Par défaut, **on reste sur lui**. Le plein écran sert :
1. **La phrase la plus importante de la vidéo** (celle qu'on doit retenir, le renversement, « ce n'est pas le sport,
   c'est ce que tu manges »), **sur fond uni** : `plein-ecran-fond` en `charbon` ou `orange`, jamais sur sa vidéo
   floutée. Ses mots en grand sur deux lignes, chaque ligne sur sa voix ; le stylé est celui de la DA (capitales, même
   largeur pour les deux lignes) : pas d'animation en plus.
2. **Ce qui ne se comprend pas sans tout l'écran**, s'il l'énumère : une liste de 3 éléments ou plus (`liste`).
- **Entrée et sortie par un flash** avec son clic, posé sur une coupe (un mot précédé d'un `/` dans le texte). Là où il
  n'y a pas de coupe, le plein écran entre et sort sec, sans flash.
- **Durée** : le temps de sa phrase, 6 s au plus. Deux pleins écrans qui s'enchaînent changent de fond ; jamais trois.
- **Jamais** : un plein écran sur un moment d'émotion ou d'histoire perso (c'est son visage qui porte), pour une action
  ou une scène de la vie (son plan filmé, sinon on reste sur lui), ou pour une idée qui tient en un mot.
- **Demi-écran** : seulement s'il le demande.

## Sur sa demande seulement

Ces effets existent toujours, avec leurs règles (`gestes.md`, le style). Tu ne les proposes plus de toi-même ; s'il les
demande, pour cette vidéo ou pour toutes, tu les fais.

### Sous-titres enrichis (sur sa demande)

Les sous-titres formels sont la base. Sur les mots clés, **ce sont les sous-titres eux-mêmes qui
changent**, à leur place et avec leur comportement (Yoan, 2026-11-11) : le mot arrive sur sa voix,
reste le temps de sa phrase, part avec elle. Ce n'est **pas** un mot posé ailleurs dans l'image (un
mot en grand au-dessus de sa tête pendant que les sous-titres le redisent : rejeté, « c'est nul »).
- **Jamais en double** : un mot affiché en grand n'apparaît pas aussi dans les sous-titres. La phrase
  devient : « pourquoi » en sous-titre normal, puis, quand il est parti, « 12 semaines » en plus gros à
  la même hauteur, souligné à main levée en orange, puis la suite de la phrase reprend en normal.
- **Même ligne, même taille** (Yoan, 2026-11-14) : sur une même ligne, tous les mots ont la même
  taille et la même police. Ce qu'on veut faire ressortir prend **sa propre ligne** ; deux lignes
  peuvent avoir des tailles différentes. Jamais un mot en gros au milieu de mots en petit sur la même
  ligne (« sur le » petit et « long terme » gros : rejeté ; c'est « sur le long terme » tout entier en
  gros).
- **Sur deux étages** quand le groupe est long : « 12 premières » sur une ligne un peu au-dessus des
  sous-titres, « semaines » à la hauteur des sous-titres, plus gros, **souligné à main levée en
  orange**.
- **Une ligne plus grosse** (« sur le long terme » tout entier en gros) : le plus léger, pour les phrases
  moins fortes. Une ligne trop longue pour la largeur en gros se coupe en deux lignes, toutes deux en
  gros (« reprendre les » / « bonnes habitudes »).
- **Jeu de style des sous-titres enrichis** (Yoan, 2026-11-14, règle finale) : le texte en gros est **tout en
  majuscules** (les sous-titres normaux restent en casse normale) ; **plus de 2 mots en gros = deux lignes** de même
  taille (« SUR LE » / « LONG TERME », « REPRENDRE LES » / « BONNES HABITUDES ») ; 2 mots ou moins = une ligne
  (« 12 SEMAINES ») ; « 12 PREMIÈRES » / « SEMAINES » garde ses deux étages (haut un peu plus petit). Chaque ligne
  arrive d'un bloc sur son premier mot (« coup de poing ») : l'intention dit les lignes, le mot souligné et
  l'**importance** de chaque ligne (fort, moyen ou secondaire) ; le monteur en tire la taille, entre 1 et 1,2 fois les
  sous-titres, jamais plus (« ça doit juste ressortir un peu »). Pas de taille en pixels dans le plan.
- **Le soulignage à main levée orange** sous le mot qui porte le sens : la marque de ces moments.
- **Chiffres toujours en chiffres** (« 12 », « 3 mois », « 10 pas »), dans les sous-titres comme
  partout : jamais « douze » écrit en lettres. Le plan le rappelle dans `notes` et met les chiffres
  dans `sous_titres.vocabulaire`.
- 1 à 3 mots courts en grand ; un mot trop long pour la largeur se met sur deux étages.
- Le mot affiché en grand reste au moins 0,5 s (il part avec sa phrase, ou à la coupe suivante).
- Demandé par un geste `sur-mesure` (format dans `format.md`) dont l'`intention` dit : les mots en
  normal et en grand, l'étage de chacun, le mot souligné, et « remplace les sous-titres de ces mots,
  même place, même comportement ».
- L'ancien « mot fort » (`mots_forts`, au-dessus de la ligne) n'existe plus : il doublait les
  sous-titres, et l'écart de taille était trop grand (Romain, 2026-11-13).
- Le grand est dans la police des sous-titres (la police unique de la vidéo), à leur place.

### Animations qui illustrent une idée (sur sa demande)

Par défaut, une idée racontée se montre par **son plan filmé** s'il en a un ; sans plan, **on reste sur lui** (ses
sous-titres, un zoom qui suit sa tête) et tu la notes « à filmer la prochaine fois ». Ce qui suit vaut quand il
demande une animation.

Quand une phrase raconte une idée qu'on peut **voir** (Yoan, 2026-11-11, 2026-11-12 et 2026-11-13),
on la montre plutôt que d'écrire ses mots en grand. **Pas de B-roll généré par IA de toi-même** (Romain ne
les aime pas du tout, 2026-11-13 ; s'il en demande un expressément, oui, jamais son visage). Dans cet ordre de préférence :

1. **Un B-roll filmé par Romain** : un de ses clips, tourné pour le brief de cette vidéo ou tiré de
   ceux qu'il a déjà. C'est le plus fort, parce que c'est lui. Exemple : « au début tu dois y
   penser… à force de répéter… à chaque fois » → son plan où il hésite devant son frigo, puis son
   plan où il prépare son repas sans réfléchir. Avec le brief de tournage, chaque clip a déjà sa
   phrase ; sans brief, tu choisis d'après ce que montrent ses vignettes. Le clip couvre **le
   passage qu'il joue** (de son premier à son dernier mot), pas une seconde de plus ; un clip qui ne
   montre pas ce qu'il dit ne se pose pas.
2. **Une idée abstraite : une animation plein écran minimaliste** (fond charbon ou orange).
   Sa phrase **en texte qui arrive comme les sous-titres** (chaque morceau sur sa voix, il reste) mais
   **mis en forme comme un titre**, jamais de simples sous-titres posés sur un plein écran (Yoan,
   2026-11-12) : capitales sur les mots qui portent le sens, des tailles qui varient **d'une ligne à
   l'autre, jamais dans une même ligne** (Yoan, 2026-11-14), une seule police (celle des sous-titres),
   soulignage à main levée orange sur le mot clé, et le **comportement de
   sous-titres** (chaque mot arrive sur sa voix, peut rester, tous repartent ensemble sur la voix). En haut ;
   au milieu, **une ou deux formes simples et nettes** qui jouent l'idée, avec ses mots dessus ; la
   suite de la phrase en texte en dessous. Pas de personnages, pas de décor (Yoan, 2026-11-12 : le
   dessin animé fait « encore plus cheap »). Exemple : « Tu comprends aussi ce qui marche pour toi.
   Tu trouves une nouvelle façon de manger, de t'entraîner qui colle à ta vie et ton entourage… » →
   en haut « TU COMPRENDS AUSSI » sur sa ligne, puis « CE QUI MARCHE » plus grand sur la sienne, puis
   « POUR TOI » sur la sienne (jamais « pour toi » en petit au bout de la ligne de « CE QUI MARCHE »), qui restent ; en dessous, une brique « une façon de manger et de t'entraîner » qui
   s'emboîte parfaitement dans une brique « ta vie » sur « colle à ta vie » ; puis, en dessous, la
   suite de la phrase en texte.
3. **Une chose qui existe, reproduite à l'identique** (voir « Les formats connus ») : sur la caméra,
   derrière sa tête ou à côté de lui. Exemple : « 12 semaines, ça paraît long » → **l'appli
   Calendrier d'Apple**, vue mois, à l'identique de la vraie (police, couleurs, mise en page), posée
   proprement comme un écran, jamais un objet accroché dans le vide ; la date dans 12 semaines
   s'entoure toute seule à main levée, et l'image de réaction pop à ce moment-là, à côté.
4. **Une animation d'objets sur la caméra** : en dernier, quand rien au-dessus ne marche.

**Une scène de vie qu'il n'a pas filmée** (quelqu'un qui hésite dans sa cuisine, qui marche, qui se
lève) : ni animation, ni plein écran, ni B-roll généré. Le passage **reste sur lui**, avec un
sous-titre enrichi sur le mot clé, et tu le notes dans ton compte rendu comme « à filmer la
prochaine fois » (ce que le plan aurait montré, sur quelle phrase).

Les effets qui ont marché :
- « on voit ce chiffre partout » → l'effet « journaux » (text match cut) : le mot ou le chiffre
  reste fixe au centre, surligné, pendant que les pages autour (unes de journaux, articles, pages
  web) changent en coupes sèches toutes les 2 à 3 images, environ 2 s, puis flash de sortie.
  Référence : https://www.youtube.com/shorts/STHOVgEWqf8 (les 2 premières secondes).
- « ce lundi, tu as un objectif ? » → un calendrier, la date qui ressort, « un objectif ? »
  dessous, puis le mot qui pousse à agir (« vas-y ») surligné en orange.

Règles pour les animations (sur la caméra ou plein écran) :
- **Qualité** (retours de Yoan, 2026-11-12 : « ça fait cheap ») : ce qui existe est reproduit à
  l'identique (une appli, un écran, un objet du quotidien) ; ce qu'on invente est **minimaliste** :
  du texte qui se comporte comme les sous-titres et une ou deux formes nettes aux couleurs de
  Romain, qui portent ses mots. Jamais de personnages dessinés (dessin animé, bonshommes bâtons),
  de fausse 3D (pièces de puzzle en relief), de pictos de base, de décor, d'objet suspendu dans le
  vide. Écris dans l'`intention` l'original exact, ou les textes, leurs places et ce que font les
  formes.
- **Les marques à main levée** (cercle autour d'une date, cases cochées, soulignage) se tracent
  **toutes seules**, comme dessinées à la main : jamais un stylo, un feutre ou une main qui les
  dessine à l'écran.
- L'animation **suit sa voix** : chaque étape arrive sur le mot qui la dit, et elle dure le passage
  (jusqu'au mot dit dans le plan), 8 s au plus.
- Les sous-titres **restent** en bas, sauf pour les mots que l'animation affiche elle-même : ceux-là
  ne sont pas redits.
- Un chiffre dans le texte d'un élément est lu comme un chiffre affiché : pour une étape sans texte,
  écris « étape sans texte : … » sans numéro.
- Les chiffres qui font partie d'un objet réel (les numéros des jours d'un calendrier) sont permis
  s'ils restent petits et ne disent rien qu'il ne dit pas : pas de mois, pas d'année, pas de date
  lisible comme une information.
- Décrite dans l'`intention` : où (sur la caméra : à côté de lui, quel côté, ou derrière sa tête ;
  ou plein écran et son fond), ce qu'on voit, étape par étape, chaque étape sur son mot.

### Images de réaction (mèmes) (sur sa demande)

Une image connue, posée sur la caméra une à deux secondes, sur une question ou une réaction : elle
dit tout de suite ce que la personne pense et relance l'attention (règle de Yoan, 2026-11-11).
- Exemple : sur « tu te demandes pourquoi douze semaines », le mème de Mr Bean qui attend à côté de
  sa montre dans un champ, l'air de se demander pourquoi.
- **Quand** : une question qu'il pose au spectateur, un étonnement, une idée reçue qu'il démonte, une
  exagération. Jamais sur un moment sérieux ou personnel, jamais pour se moquer de quelqu'un.
- **Lequel** : un mème très connu (reconnu en une demi-seconde par presque tout le monde), qui colle à
  l'émotion exacte. Nomme-le précisément dans le plan, avec les mots à chercher pour le trouver
  (« mr bean waiting meme »). C'est **toi** qui le télécharges, au moment de l'animation
  (on ne le demande pas à Romain). Format : `format.md`.
- **Quand exactement** : il **pop pile sur le mot** qui déclenche la réaction (« pourquoi »), jamais
  avant, avec le **son « Vine boom »** (impact grave qui résonne ; référence de Yoan :
  https://www.youtube.com/shorts/9rR97fbJpeA). « Pop » veut dire : apparaît d'un coup à sa taille,
  pile sur l'image du mot ; pas de rebond ni de grossissement. Il part à la fin de la phrase.
- **Où** : en haut à droite (ou du côté libre si une animation occupe la droite), au-dessus de sa tête, aussi gros que la place le permet (viser 40 % de
  la largeur) sans toucher son visage ; réduis-le s'il le faut. Avec une animation sur la
  caméra (le calendrier des 12 semaines), il pop à côté d'elle, au moment où elle montre ce qui
  fait réagir (la date entourée), même son.
- 1 ou 2 par vidéo au plus : au-delà, ça devient une vidéo de mèmes.

### Formats connus : à l'identique (sur sa demande)

Quand la vidéo parle d'une chose qui existe (une recherche Google, un commentaire Instagram, un DM,
un classement type tier list, une note de téléphone, une appli comme le Calendrier d'Apple, un
site, une étiquette de produit, un objet du quotidien),
on la **reproduit à l'identique** : vraie mise en page, vraie police, vraies couleurs, mêmes icônes.
Pas une copie « aux couleurs de Romain » : une fausse barre Google à sa manière fait amateur. Ses
couleurs ne servent qu'à ce qu'on invente. Dans l'`intention`, écris ce qu'on doit reconnaître au
premier coup d'œil (« la vraie page de recherche Google sur téléphone »). S'imprégner de l'original
avant de le refaire, c'est le travail de l'étape animations ; le plan, lui, nomme l'original exact.

## Montrer plutôt que dire

- Quand il raconte une scène de sa vie ou de celle du spectateur (hésiter, cuisiner, s'entraîner,
  se lever) : **son clip qui la joue** ; sans clip, on reste sur lui (ses sous-titres, un zoom qui suit sa tête) et tu le notes « à filmer la prochaine fois ».
- Quand il parle d'un exercice : **sa démo** (un de ses clips), annotée si un muscle ou un angle
  compte (annotation sur sa demande). Pas d'animation qui dessine un exercice.
- Quand il parle d'un repas : ses plats en photo s'il en a donné (carte nutrition sur sa demande), jamais des plats génériques.
- Quand il énumère (3 éléments ou plus) : la liste, chaque élément sur son mot.
- Schéma, comparaison, cartes : sur sa demande.
- Jamais un texte qui dit ce qu'une image devrait montrer.

## Le rythme des coupes

- **Serré** (par défaut) : sans blancs, sans hésitations, sans reprises.
- **Très serré** : liste de conseils, réponse rapide, beaucoup d'énergie.
- **Normal** : histoire perso, moment d'émotion, coup de gueule où les silences comptent. Une coupe
  trop brute au milieu d'une émotion casse la confiance.
- Quel que soit le rythme, les coupes gardent les mots entiers, les négations, les nuances, les
  chiffres et les étapes du raisonnement, et garde la meilleure prise de chaque phrase.

## Les zooms

Un bon zoom est souvent tout l'effet qu'il faut (Romain, 2026-11-20).
- **Le zoom qui suit sa tête** (`suivi`) : l'image se resserre doucement (110 %) puis le cadre suit sa tête jusqu'à la
  coupe, comme un caméraman qui le suit. C'est le zoom par défaut : une phrase qui compte, une confidence, le moment où
  il parle directement à la personne, une explication un peu longue qu'il faut relancer.
- **Éclair** : sur le mot qui claque (chiffre, verdict), jamais sur le premier mot après une pause (il se lirait comme
  un saut sur la coupe ; prends un mot plus loin dans la phrase). `"suivre": true` lui ajoute le suivi de sa tête.
- **Rapprochement** : le même resserrement que le suivi, sans suivre sa tête (quand il ne bouge pas).
- **Dézoom d'ouverture** : voir l'accroche. Aucun autre zoom pendant l'accroche.
- Un zoom tient jusqu'à la coupe suivante : compte-le comme un accent jusqu'à cette coupe. Jamais pendant un plein
  écran, une carte ou un plan filmé en plus ; jamais deux phrases de suite ; alterne le suivi et l'éclair.

## La fin

La fin suit ce qu'il dit dans la vidéo : tu la lis dans la transcription.
- **Il ne demande pas de commenter un mot** (fin en message privé, fin d'encouragement) : aucun
  geste de fin. Un zoom ou un sous-titre enrichi sur sa dernière phrase utile suffit. Ne jamais
  inventer un mot en commentaire.
- **Il dit « commente MOT »** : l'élément arrive sur le mot, avec le geste « champ Instagram » (le
  mot se tape) ou « mot derrière lui ». Le mot affiché est exactement celui qu'il dit.
- Pas de fin qui traîne : la vidéo s'arrête après son dernier mot.

## Ce qu'on ne fait jamais

- Afficher un mot avant qu'il le dise. Afficher un chiffre qu'il ne dit pas, un classement qu'il n'a
  pas donné, un nom d'exercice qui n'est pas le sien.
- Inventer quelque chose sur lui ou ses clients (résultats, avant-après).
- Des effets « pour faire joli » : pop, rebond, texte qui tourne, emojis animés, fond qui bouge.
- Un plein écran de mots sur sa vidéo floutée pour le message principal (fond uni à la place).
- Un mot affiché en grand et redit dans les sous-titres (doublon).
- Un mot posé en grand au-dessus de sa tête pour illustrer une phrase (son clip ou une animation à la place).
- Un plein écran pour une action ou une scène de la vie (son clip, sinon on reste sur lui).
- Des pictos de base, de la fausse 3D, des personnages dessinés (dessin animé, bonshommes bâtons), un
  objet suspendu dans le vide (le vrai à l'identique, ou une animation minimaliste à la place).
- Un stylo, un feutre ou une main qui dessine une marque à l'écran (la marque se trace seule).
- Un B-roll généré par IA qu'il n'a pas demandé (Romain n'en veut pas) ; un clip qui ne montre pas ce
  qu'il dit.
- Un chiffre écrit en lettres.
- Un demi-écran par réflexe, un plein écran par réflexe, une animation là où un zoom ou ses sous-titres suffisent.
- Une accroche reprise telle quelle d'une autre vidéo (même disposition, même mot).
- Une copie de format connu aux couleurs de Romain.
- Couvrir son visage avec du texte.
