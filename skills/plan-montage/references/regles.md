# Règles de montage des reels de Romain

Les exemples entre guillemets viennent des tests de Yoan sur une vidéo (« douze semaines ») : ils
montrent la forme, jamais un contenu à reprendre.

Ce fichier dit **quand** un effet sert, **ce qu'il fait** et **quand l'éviter**. Le **comment**
(couleurs, tailles, durées, sons) est dans le style de Romain, appliqué par les briques.
Sources : les règles de Yoan (2026-11-11), le style validé au labo (2026-11-08 au 2026-11-11), et
les règles de montage d'un pack de montage public dont Yoan aime le rendu (choix des prises, dosage
des accents). Les retours de Yoan sont dans `preferences.md`, les goûts retenus de Romain dans ta
mémoire (`## Pour le plan`) : les deux passent avant ce fichier.

## Le principe

Chaque élément à l'écran **retient**, **fait comprendre** ou **fait agir**. Le reste est du bruit :
il fatigue l'œil et fait « montage d'IA ». Mais l'inverse tue aussi : des sous-titres identiques en
bas de l'écran pendant 50 secondes, c'est monotone et on décroche (retour de Yoan du 2026-11-11 sur
le premier test). Le bon plan est **vivant** : le texte change de taille, de place et de forme selon
ce qu'il dit, des images surprennent, le message principal a son propre écran. Tout ça reste au
service de ses mots, rien n'est posé pour faire joli.

## Deux niveaux

Choisis le niveau qui domine la vidéo : une vidéo de motivation ou un conseil court reste simple,
même avec un chiffre. Les sous-titres sont les mêmes aux deux niveaux (les siens).
- **Simple** (comme ce qu'il fait déjà) : ses sous-titres, accroche en pavés, quelques zooms,
  au plus une animation. Pour une histoire perso, un coup de gueule, une réponse rapide, un vlog.
  Son visage porte la vidéo.
- **Travaillé** (le défaut dès que la vidéo explique quelque chose) : titre d'accroche derrière lui
  avec le dézoom d'ouverture, ses sous-titres, sous-titres enrichis sur les mots clés, idées illustrées (ses clips, sinon animation), une image de
  réaction ou deux, le message principal sur fond uni, ce qu'il faut montrer (liste, carte, schéma,
  démo annotée). Pour une explication, une méthode, une liste, un chiffre qui surprend, une vidéo de
  conseil.

## L'accroche (les 3 premières secondes)

C'est elle qui décide si la personne reste. Deux couches, dès la première image :

**1. Le titre visuel, derrière lui** (règle de Yoan, 2026-11-11). Le sujet de la vidéo en une
phrase, posé en grand derrière sa tête **dès l'image 1**, dans la police des titres, avec un
surlignage orange derrière le mot clé (ou derrière toute une ligne courte). C'est le titre de la
vidéo, pas un sous-titre. **Il doit accrocher quelqu'un qui n'a pas le son** : lu seul, sans
entendre Romain, il dit ce que la personne veut obtenir. Il part donc de son envie, pas de la
phrase de Romain : « Comment avoir / la meilleure / transformation physique » (Yoan, 2026-11-11),
pas « Qui a les meilleurs résultats ? ». Le **surlignage orange va sur l'objet du désir** (la ligne
« transformation physique »), pas sur un adjectif. Il nomme l'envie que la vidéo sert, sans promettre
un résultat chiffré qu'elle ne donne pas.
**Ce qu'il a le droit de faire** : c'est le seul texte de la vidéo qui peut ne pas être une phrase
dite (il se lit sans le son). Mais il ne promet **rien que Romain ne dit pas** dans la vidéo : l'envie
du titre est celle que sa vidéo traite, avec ce qu'il y dit (« des résultats qui durent » seulement
s'il parle de tenir sur le long terme ; jamais « perdre 5 kilos », « en 2 semaines » ou un bénéfice
qu'il n'aborde pas). Et il **reprend ses mots quand c'est possible** : cherche d'abord dans le texte
de la vidéo le mot qui porte l'envie (« long terme », « douze semaines », « sans douleur ») et
construis le titre autour ; une reformulation seulement quand aucun de ses mots ne se lit sans le
son. Écris dans l'`intention` la phrase de lui d'où vient le titre. 3 à 7 mots, sur 2 ou 3 lignes (forme habituelle :
« Comment avoir » / « la meilleure » / « <ce qu'on veut> »), la plus grande ligne sur toute la
largeur. Il reste jusqu'à la fin de sa première phrase et
part sur la première coupe (au plus tard vers 6 s).

**2. Le dézoom d'ouverture** (règle de Yoan). La vidéo commence zoomée (environ 120 %) et dézoome
doucement jusqu'à 100 % pendant l'accroche ; **le titre derrière lui dézoome en même temps**, comme
s'il était vraiment dans le décor derrière lui. Le dézoom **s'arrête net sur le mot clé** de sa
première phrase (« douze premières semaines ») : l'arrêt fait l'effet de profondeur, à la place d'un
zoom éclair. Pas de zoom éclair dans l'accroche quand il y a le dézoom.

**Ce qui se passe devant** : ses sous-titres, enrichis sur le mot clé (voir « Les sous-titres
enrichis » : « long terme » en plus gros, puis « 12 premières » / « semaines » souligné).

- Le geste : `sur-mesure` (base `hook-titre-derriere`, qui n'a qu'une phrase et un mot géant), avec
  dans l'`intention` : le titre ligne par ligne, le mot surligné, « posé d'un coup à l'image 0 »
  (les éléments portent le premier mot de la vidéo comme `sur`), le dézoom (« de 120 % à 100 %, le
  titre dézoome avec la caméra ») et le mot où il s'arrête. Le dézoom de la caméra va dans la clé
  `zooms` : `{ "type": "ouverture", "sur": "<le mot clé où il s'arrête>" }` (brique zooms, depuis le
  2026-11-13) ; le titre le suit image par image. Aucun autre zoom pendant l'accroche.
- Niveau simple : les pavés en haut à la place du titre, sans dézoom.
- **Jamais** : ouvrir sur un B-roll sans lui, ouvrir sur un plein écran, une accroche qui annonce
  autre chose que la vidéo.

## Garder l'attention jusqu'au bout

- **Un changement toutes les 3 à 6 secondes** en niveau travaillé (sous-titre enrichi, image
  de réaction, B-roll, animation sur la caméra, élément, zoom, démo), 5 à 10 secondes en niveau simple. Un changement = quelque chose que l'œil
  remarque, pas forcément une animation : un zoom suffit souvent.
- **Les endroits où l'attention tombe** reçoivent une relance : le passage d'une idée à la suivante
  (chapitre, transition), une explication de plus de 8 secondes sans rien (démo, carte, mot fort),
  le milieu de la vidéo (vers 40 à 60 % : le moment fort y est souvent bien placé).
- **Illustrer plutôt qu'écrire en gros** (Yoan, 2026-11-11) : une idée qui se raconte (on répète
  et ça devient facile, on teste jusqu'à trouver, on prend de l'avance) se **montre** (un de ses
  clips, sinon une animation), pas un mot posé en grand au-dessus de sa tête. Voir « Illustrer une
  idée ».
- **La deuxième moitié aussi vivante que la première.** L'erreur du premier test : un début
  travaillé, puis 30 secondes de sous-titres identiques avec un mot fort de temps en temps. Chaque
  phrase forte de la suite reçoit son traitement (sous-titre enrichi, image de réaction, B-roll,
  animation sur la caméra, élément sur la caméra). Jamais plus de 6 à 8 secondes de sous-titres simples seuls.
- **Les promesses ouvertes** (« et le troisième, c'est celui que tout le monde rate ») : l'élément
  arrive quand il tient la promesse, pas quand il l'annonce.
- **Laisser respirer** : son visage avec ses seuls sous-titres, 1,5 à 4 secondes, entre deux
  éléments (jamais plus de 6 à 8 s en niveau travaillé). Il reste à l'écran (lui, pas un plein
  écran ni un B-roll) au moins 55 % de la vidéo (56 % validé par Yoan en v5). C'est ce qui rend
  les éléments forts. Un plan où quelque chose bouge en permanence fatigue.
- **Un seul accent à la fois** : jamais un mot fort pendant une carte, jamais un zoom pendant un
  plein écran, jamais deux animations qui se chevauchent. Exceptions : l'accroche (titre,
  dézoom et sous-titre enrichi ensemble), une image de réaction avec le sous-titre enrichi de la
  même phrase (ils disent la même chose ensemble), et une image de réaction qui pop dans une
  animation sur la caméra au moment qu'elle montre (le mème à côté du calendrier).

## Dosage (pour un reel de 45 à 60 s)

| Élément | Niveau simple | Niveau travaillé |
|---|---|---|
| Accroche à l'écran | 1 | 1 |
| Titre derrière lui + dézoom d'ouverture | 0 (pavés) | 1 |
| Sous-titres enrichis (mot clé en grand, souligné) | 0 à 2 | 1 toutes les 5 à 8 s |
| Images de réaction (mèmes) | 0 ou 1 | 1 ou 2 |
| Zooms | 3 à 6 | 2 à 5, sur les passages caméra |
| Pleins écrans (dont le message principal) | 0 ou 1 | 2 à 4, jamais plus |
| Idées illustrées (ses clips, animation) | 0 ou 1 | 2 à 4 |
| Montrer (liste, carte, schéma, démo, format connu) | 0 ou 1 | 1 à 3 |
| Demi-écran | 0 | 0 en général, 1 au plus |
| Fin (mot en commentaire) | 1 s'il y en a un | 1 s'il y en a un |

Plus court (20 à 30 s) : divise par deux, garde l'accroche et la fin.

## Plein écran, caméra, demi-écran

C'est le choix le plus important après l'accroche. Par défaut, **on reste sur lui** : c'est son
visage, sa voix et son énergie qu'on vient chercher.

**Sur la caméra (par défaut)** : l'élément se pose dans l'image, à côté de lui, sans le cacher.
- Pour : un chiffre, un mot, un temps (chrono), un verdict (tampon), un nom de muscle sur une démo,
  la fin.
- Surtout quand **il fait un geste** : il compte sur ses doigts, il montre une taille avec ses
  mains, il pointe un côté, il tient un objet. L'élément s'accroche à ce geste (le chiffre à côté de
  la main qui compte, le mot du côté qu'il pointe). Repère les mots qui appellent un geste (« trois
  choses », « gros comme ton poing », « ici »), regarde l'image à ce moment-là et écris dans
  l'`intention` ce que tu as vu : « il compte sur ses doigts, le chiffre à côté de sa main gauche »,
  ou « à côté de son visage, côté libre ».
- Un mot ou un chiffre, jamais une mini-carte au-dessus de ses doigts (rejeté au labo : « on n'a pas
  besoin de ça »).

**Plein écran** : quand l'un des trois est vrai.
1. **Le moment le plus important de la vidéo** : la phrase qu'on doit retenir, le chiffre qui
   change tout, le renversement (« ce n'est pas le sport, c'est ce que tu manges »). Une fois, deux
   au plus. **Sur fond uni** (charbon ou orange), pas sur sa vidéo floutée : le flou avec des mots
   dessus fait pâle (retour de Yoan). Le mot ou le chiffre clé en très gros (« 3 MOIS »), puis la
   suite **expliquée en petites animations sur ses mots**, pas en phrase plate : une courbe qui
   monte sur « premiers progrès », des cases qui se cochent sur « nouvelles habitudes ». Chaque
   élément arrive sur son mot.
2. **Ce qui ne se comprend pas sans tout l'écran** : une liste de 3 éléments ou plus, un schéma de
   causes, un minuteur, une recherche Google, un classement.
3. **Une idée abstraite qu'il faut tout l'écran pour montrer** (voir « Illustrer une idée ») :
   « on voit ce chiffre partout » (l'effet journaux), « tu testes jusqu'à trouver ce qui colle à ta
   vie » (des essais qui ne collent pas, puis celui qui colle), « ce lundi ». Une action ou une
   scène de la vie (répéter un geste, avancer, une durée sur un calendrier) **ne va pas en plein
   écran** : son clip, sinon on reste sur lui (retour de Yoan, 2026-11-12 : « trop d'animations
   plein écran »).
- **Fonds** : charbon ou orange. Deux pleins écrans qui s'enchaînent sans lui entre les deux
  changent de fond ; avec lui entre les deux, le fond est libre. Le message principal garde
  l'orange.
- **Entrée et sortie par un flash** (règle de Yoan) : un flash sur la coupe juste avant le plein
  écran, un autre sur la coupe qui revient sur lui. Une coupe n'existe que là où la vidéo a
  été coupée (un blanc ou une reprise retirés) : dans `texte-sous-titres.md`, c'est un mot précédé
  d'un `/`, et seulement là. Ancre le plein écran sur un
  **début de phrase** précédé d'un `/`, et le flash de sortie sur le début de la phrase suivante,
  lui aussi après un `/`. Là où il n'y a pas de `/`, il n'y a pas de coupe : pour un plein écran,
  le flash fait alors **partie de l'animation** (écris-le dans son `intention` au lieu d'un geste
  `transition-flash`, qui exige une coupe). **Chaque flash a son clic** (règle de Yoan, 2026-11-11,
  dans le style depuis le 2026-11-13) : tu le poses à l'étape sons, rien à écrire dans le plan.
- **Durée** : un plein écran de phrase dure le temps de sa phrase, 6 s au plus ; le message
  principal avec ses animations ou une comparaison, 8 s au plus. Une liste, 4 à 5
  éléments dits en 15 s au plus ; une énumération plus longue ou diffuse se traite par chapitres
  (carte chapitre sur la caméra), pas en plein écran.
- **Deux pleins écrans qui se suivent** sans lui entre les deux : permis s'ils changent de fond,
  avec un flash entre les deux ; jamais trois.
- **Jamais** : un plein écran sur un
  moment d'émotion ou d'histoire perso (c'est son visage qui porte) ; un plein écran pour une idée
  qui tient en un mot sur la caméra.

**Demi-écran** : rare. Utilisé souvent, il fait « montage d'IA ». Seulement quand il faut **garder
un visuel à l'écran plus de 4 secondes pendant que son visage compte** (il réagit à ce qu'on voit,
il commente une image). Une fois au plus par vidéo, et pas dans la plupart des vidéos. Jamais pour
une liste, un minuteur ou un schéma (ils vont en plein écran).

## Les sous-titres enrichis (phrases clés)

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

## Illustrer une idée

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
2. **Une idée abstraite : une animation plein écran minimaliste** (voir « Plein écran », point 3).
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

## Les images de réaction (mèmes)

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

## Montrer plutôt que dire

- Quand il raconte une scène de sa vie ou de celle du spectateur (hésiter, cuisiner, s'entraîner,
  se lever) : **son clip qui la joue** ; sans clip, on reste sur lui (voir « Illustrer une idée »).
- Quand il parle d'un exercice : **sa démo** (un de ses clips), annotée si un muscle ou un angle
  compte. Pas d'animation qui dessine un exercice.
- Quand il parle d'un repas : ses plats en photo (carte nutrition), jamais des plats génériques.
- Quand il énumère : la liste, chaque élément sur son mot.
- Quand il explique une cause : le schéma, qui se construit pendant qu'il parle.
- Quand il compare une mauvaise et une bonne option : d'abord la mauvaise, puis la bonne.
- Jamais un texte qui dit ce qu'une image devrait montrer.

## Les formats connus : à l'identique

Quand la vidéo parle d'une chose qui existe (une recherche Google, un commentaire Instagram, un DM,
un classement type tier list, une note de téléphone, une appli comme le Calendrier d'Apple, un
site, une étiquette de produit, un objet du quotidien),
on la **reproduit à l'identique** : vraie mise en page, vraie police, vraies couleurs, mêmes icônes.
Pas une copie « aux couleurs de Romain » : une fausse barre Google à sa manière fait amateur. Ses
couleurs ne servent qu'à ce qu'on invente. Dans l'`intention`, écris ce qu'on doit reconnaître au
premier coup d'œil (« la vraie page de recherche Google sur téléphone »). S'imprégner de l'original
avant de le refaire, c'est le travail de l'étape animations ; le plan, lui, nomme l'original exact.

## Le rythme des coupes

- **Serré** (par défaut) : sans blancs, sans hésitations, sans reprises.
- **Très serré** : liste de conseils, réponse rapide, beaucoup d'énergie.
- **Normal** : histoire perso, moment d'émotion, coup de gueule où les silences comptent. Une coupe
  trop brute au milieu d'une émotion casse la confiance.
- Quel que soit le rythme, les coupes gardent les mots entiers, les négations, les nuances, les
  chiffres et les étapes du raisonnement, et garde la meilleure prise de chaque phrase.

## Les zooms

- Un zoom tient jusqu'à la coupe suivante : compte-le comme un accent jusqu'à cette coupe (pas de
  mot fort ni d'élément qui commence pendant un zoom éclair dans la même phrase).
- **Dézoom d'ouverture** : voir l'accroche. Il remplace le zoom de l'accroche.
- **Éclair** : sur le mot qui claque (chiffre, verdict), jamais sur le premier mot après une pause
  (refusé : il se lirait comme un saut sur la coupe ; prends un mot plus loin dans la
  phrase). Pas sur un mot déjà en sous-titre enrichi : l'un
  ou l'autre.
- **Rapprochement** : sur le début d'une phrase qui monte vers une conclusion, une confidence, le
  moment où il parle directement à la personne.
- Sur les coupes et les débuts de phrase, en alternance avec les mots forts. Jamais pendant un plein
  écran, une carte ou un demi-écran.

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
- Plus de 6 à 8 secondes de sous-titres simples seuls en niveau travaillé.
- Un demi-écran par réflexe, un plein écran par réflexe.
- Une copie de format connu aux couleurs de Romain.
- Couvrir son visage avec du texte.

## Ce que la bibliothèque du style n'a pas encore (au 2026-11-13)

Demande-les quand même, en `sur-mesure` avec une intention précise : ce sont des règles de Yoan, la
brique animations les compose. Ne les retire pas d'un plan parce que la bibliothèque ne les a pas.
- Les sous-titres enrichis (mot en grand à la place des sous-titres, sur deux étages, souligné à
  main levée).
- Les animations qui illustrent : minimalistes en plein écran (texte façon sous-titres et briques qui s'emboîtent),
  les choses réelles à l'identique (appli Calendrier d'Apple), journaux, calendrier de « ce lundi ».
- Le cercle et les coches à main levée qui se tracent seuls.
- Le pop des mèmes (son Vine boom : dans la bibliothèque depuis le 2026-11-13, posé à l'étape sons).
- Les images de réaction trouvées sur internet (décision de Yoan du 2026-11-11 : on les prend).
- Le plein écran du message principal avec ses petites animations.
- Flash sans coupe : là où il n'y a pas de coupe (pas de `/` dans le texte), le flash fait
  partie de l'animation.
