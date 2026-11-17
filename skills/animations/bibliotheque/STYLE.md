<!-- Copie du STYLE.md du Style Lab de Romain, clôture du 2026-11-11, mise à jour le 2026-11-13 (sous-titres de son ancien skill, comportement de sous-titres) et le 2026-11-14 (police unique, règle des captions : même ligne, même taille ; retours v11 : pavé réglable, un mot vu une fois, effet journaux ; retours v12 : montée du bas réservée à l'accent en saccade 12 i/s, citations sans guillemets, captures d'articles). Les chemins bibliotheque/<effet>/ désignent les dossiers de cette bibliothèque. -->

# STYLE : reels @fitavecromain

Règles du style des reels de Romain, écrites à la clôture du Style Lab (v1 tours 1 à 18, v2 tours 19 à 22,
2026-11-08 au 2026-11-11) pour que l'agent monteur de Romain, ou n'importe qui, refasse ce style sans avoir vu les tours.
Toutes les valeurs viennent de `bibliotheque/commun.mjs` et des builds des cartes verrouillées ; chaque effet renvoie
vers son dossier de `bibliotheque/` (README, gabarit HyperFrames, aperçu). Journal des tours : `archives/STYLE-tours-v2.md`
(v2) et `archives/v1-2026-11-10/STYLE.md` (v1).

La bibliothèque est une **vitrine du vocabulaire**, pas un catalogue : le monteur fait des animations sur mesure pour
chaque vidéo et recompose à partir de ces règles (la vitesse d'un effet, la couleur d'un autre, les rayons d'un troisième).
Aucune valeur en dur dans un effet : elle vient de `commun.mjs`.

## Le brief

1. **Pour :** les reels Instagram de Romain (@fitavecromain, coach sportif en Suisse : mobilité, musculation, nutrition),
   montés par son agent monteur.
2. **Format :** 9:16, 1080 x 1920, 30 i/s. Tourné à l'iPhone (4K HEVC SDR), face caméra en français, d'une traite (la
   dernière prise est la bonne), alterné avec des démos d'exercice et des plans de cuisine.
3. **Public :** des gens normaux qui veulent se remettre en forme. Première seconde : c'est pour moi, c'est simple.
4. **Sa demande :** « des montages qualis, mais aussi de l'organique, des trucs qui ont l'air simples et normaux ». Deux
   niveaux coexistent donc : un montage simple qui imite ce qu'il fait déjà (ses sous-titres, hooks pavés) et un
   montage plus pro (titres derrière lui, pleins écrans, cartes), avec les mêmes sous-titres.
5. **Ce qu'il a :** orange de marque #F15A24 (site, carrousels), logo orange et noir. Polices libres d'usage commercial
   seulement.
6. **Mouvement :** net, sobre, au service de la parole. Chaque élément arrive sur le mot qui le dit.
7. **Son :** discret, calé à l'image, audible au téléphone. Sons et musiques sous licence commerciale obligatoire.

## Socle

### Police (`bibliotheque/fonts/`, licences OFL jointes) : une seule dans toute la vidéo (Yoan, 2026-11-14)
- **Inter Black** pour tous les textes : sous-titres, hooks, titres, mots géants, pleins écrans, cartes, listes,
  schéma, CTA, minuteurs, fond vert, effets sur mesure. C'est la police que Romain a choisie le 29/10 pour ses
  sous-titres, et c'est **un réglage** : `POLICES.sousTitres` de `commun.mjs`. Si Romain en choisit une autre, tout
  suit en changeant cette seule constante, puis `node scripts/maj-sous-titres.mjs` (réécrit les blocs `POLICE` et
  `SOUS-TITRES` des gabarits) ; candidates OFL : Atkinson Hyperlegible Next, Archivo, Barlow Semi Condensed, Schibsted
  Grotesk, Rubik, Lexend (comparatif de Yoan).
- Deux déclinaisons dans la même police : `.ti` capitales (`POLICES.titre` : interligne 0,92, approche -0,02 em,
  chiffres en chasse fixe) pour titres, mots géants, chiffres, onglets ; `.tx` minuscules (`POLICES.texte` : interligne
  1,06, approche -0,02 em) pour les phrases. Une seule graisse (Black).
- Les tailles qui couvrent une largeur (mots géants, pleins écrans en deux lignes, fond vert) se calculent avec la
  police (`mesure.py geant`, `lignes`, approche comprise) ; les chiffres des cartes gardent la largeur d'encre de la
  planche (Inter Black est plus large que l'ancienne Big Shoulders condensée).
- Formats natifs recopiés seulement : **Roboto** (champ Instagram, recherche Google), **Liberation Sans** (tier list de
  TierMaker), police système d'Apple (Calendrier, calque `origine.natif`).
- Big Shoulders Display et Bricolage Grotesque (planche du Style Lab) ne servent plus depuis le 2026-11-14 ; Montserrat
  et Raleway non plus.

### Couleurs (`COULEURS`)
- Orange **#F15A24** : pavés, onglets, numéros, mot en cours. **Un seul accent orange par image.**
- Charbon **#1A1612** : cartes, pleins écrans, texte posé sur l'orange.
- Craie **#F6F0E7** : titres, ligne en cours des cartes.
- Blanc pur **#FFFFFF** : les sous-titres seulement (leur style d'origine).
- Braise **#B8400F** : uniquement la marche sous les pavés orange.
- Formats natifs recopiés : leurs propres couleurs (`NATIF` : bleu Instagram #0095F6 ; Google #202124, #1A73E8 et
  gris ; pastels TierMaker), rien de la marque de Romain.

### Contraste
- Sur l'orange : texte **charbon** (5,33:1), **jamais** de texte clair (craie sur orange 2,98:1). Seule exception : le
  mot dit des sous-titres, blanc sur son pavé orange, comme Romain l'a choisi (son ombre douce dessous).
- Craie sur charbon : 15,88:1.
- Texte posé sur la vidéo : toujours avec son ombre (voir Matières) ; sous un titre en haut du cadre, voile sombre
  (`VOILE.standard` : 46 % en haut, 28 % à y 520, nul à y 1020 ; `VOILE.cuisine` et `VOILE.demo` plus forts pour les
  plans éclairés par le haut).

### Rayons (`RAYONS`, px vidéo)
- 0 : panneaux et pleins écrans. 10 : pavés, vignettes, onglets. 12 : lignes de liste et de carte. 16 : tampon.
  18 : cartes. Pilule : formats natifs seulement.

### Matières et ombres (`OMBRES`, `MARCHE`, `CARTE`, `ONGLET`)
- Texte des animations posé sur la vidéo : ombre dure 4 px vers le bas, charbon à 60 %, plus un halo de 20 px à 35 %.
- Sous-titres : ombre douce sans décalage (voir « Sous-titres »).
- Titres des hooks : ombre douce `0 6px 30px` noir à 45 %.
- Carte posée sur la vidéo : `0 18px 50px` noir à 50 %, liseré intérieur 2 px craie à 8 %.
- Pavé orange : posé sur une marche braise de 5 px. Pavé craie : marche charbon à 35 %. Le pavé des sous-titres n'a pas
  de marche.
- Carte : fond charbon, rayon 18. Onglet orange de 64 px de haut sur le coin haut gauche (capitales 46 px,
  texte charbon, rembourrage 26 px, coin haut gauche de la carte alors droit) qui dit ce qu'est la carte ; une
  précision possible dans l'onglet à 62 % d'opacité. Ligne en cours : pleine craie, texte charbon ; lignes passées à 38 %.

## Mouvement

### Apparition (toute entrée animée de texte ou d'élément) : `APPARITION`, `apparitionReglages(h)`, `apparitionJs`
Mesurée image par image sur la référence de Yoan (`references/apparition-texte.md`). `h` = hauteur des capitales (ou de
l'élément) en px vidéo. Trois mouvements en même temps, partis au même instant :
- **Montée** depuis `max(10, 0,13 h)` px sous sa place jusqu'à 0, `power3.out`.
- **Opacité** de 0 à 1, `power2.out`.
- **Flou** de `max(8, 0,05 h)` px à 0, `power2.out`, qui finit APRÈS la montée (la traîne de netteté fait l'effet).
- Durées interpolées entre un petit texte (h ≤ 50 : montée 0,35 s, opacité 0,30 s, flou 0,30 s) et un gros mot
  (h ≥ 280 : 0,55 s, 0,45 s, 0,85 s). Un bloc non textuel plus haut qu'un gros mot prend les réglages du gros mot.
- Départ **à l'attaque** de son mot, c'est-à-dire **3 images (0,1 s) avant son début transcrit** (`ATTAQUE`, ci-dessous).
- Chaque élément sur sa propre attaque de voix, jamais tout le bloc d'un coup. Sans attaque nette (plan sans voix),
  0,17 s entre deux éléments (`APPARITION.ecartRef`).
- Pas de rebond, pas de dépassement, pas d'échelle.
- Exceptions qui gardent leur logique : les sous-titres (montée et fondus de leur style d'origine, pavé qui glisse),
  hooks pavés (posés d'un coup), formats natifs recopiés, les sous-titres enrichis (coup de poing par ligne, ci-dessous),
  les pleins écrans texte (posés d'un coup à l'attaque de leur mot), et la montée du bas en saccade, réservée à l'accent (ci-dessous).

### Montée du bas : un accent rare, toujours en saccade 12 i/s : `MONTEE_ACCENT`, `monteeAccentJs`, `Couche.accent` (Yoan, 2026-11-14, retours sur v12)
L'arrivée du bas (le mot **monte de 40 px depuis plus bas en passant de transparent à plein, en 0,4 s, sortie
cubique**, départ à l'attaque de son mot (0,1 s avant son début transcrit), sans flou) va **uniquement avec la saccade à 12 i/s** (le mouvement
avance par paliers de 1/12 s comptés depuis son départ, le premier palier dès l'image du départ). Jamais l'une sans
l'autre : pas de montée du bas à cadence normale, pas de saccade 12 i/s sur une autre arrivée.
- **À quoi elle sert** : accentuer une phrase, casser le motif pour l'œil et mettre en avant ce qu'il dit. Avec
  parcimonie : un ou deux moments dans une vidéo, sur la phrase qui compte (exemple validé : le titre du haut du plein
  écran puzzle, « TU COMPRENDS AUSSI / CE QUI MARCHE / POUR TOI », a14 du test).
- **Ce qu'elle n'est pas** : l'apparition des sous-titres enrichis (« sur le long terme », « 12 premières / semaines »,
  « reprendre les / bonnes habitudes »), ni celle des pleins écrans texte, ni d'une phrase qui suit sa voix en groupes.
  La v12 qui les faisait monter du bas à 30 i/s est retirée : les sous-titres enrichis arrivent en « coup de poing »
  par ligne (ci-dessous), les pleins écrans texte gardent leur apparition.
- Les pièces, objets et formes qui se posent (pièces du puzzle) bougent à cadence normale, fluides : la saccade ne va
  qu'avec la montée du bas d'un texte.

### Sous-titres enrichis : le « jeu de style sur les captions » : `ENRICHI`, `APPARITION_LIGNE`, `apparitionLigneJs`, `SOULIGNE` (Yoan, 2026-11-14, règle finale, comparatif des apparitions, cartes C2 et 1b)
1. **Tout en MAJUSCULES** (le texte en gros). Les sous-titres normaux restent en casse normale (une ligne d'un effet
   enrichi à la taille des sous-titres, comme « et ça devient », reste un sous-titre normal : casse normale, posée d'un
   coup sur son mot).
2. **Apparition « coup de poing » par ligne** : la ligne se comporte comme **un seul mot** (ses mots et son soulignage
   dans un conteneur, seul animé : une seule échelle, un seul centre, jamais une échelle par mot), à l'attaque du
   premier mot de la ligne ; échelle 1,3 -> 1 en **0,2 s, sortie cubique**, opacité 0 -> 1 sur le premier tiers
   (0,067 s), origine au centre de la ligne, 50 % / 70 % de sa hauteur, 30 i/s. Sortie inchangée : tout repart d'un
   coup. Seule entrée de texte avec une échelle.
3. **Soulignage éventuel** : main levée, épaisseur **0,13 x la taille**, tracé en **0,17 s**, power2.out, départ sur
   l'attaque du dernier mot souligné.
4. **Longueur** : plus de 2 mots en gros = **deux lignes de même taille**, chacune arrive sur son premier mot (« SUR LE »
   / « LONG TERME », « REPRENDRE LES » / « BONNES HABITUDES ») ; 2 mots ou moins = une ligne (« 12 SEMAINES ») ;
   « 12 PREMIÈRES » / « SEMAINES » garde ses deux étages (étage du haut plus petit). Interligne serré et
   régulier en majuscules (pas de jambages à réserver) : la ligne de base du haut est à **hauteur des capitales du bas
   + 0,3 x la taille du bas** au-dessus de la ligne de base du bas (`ENRICHI.ecart`).
   Une ligne en gros plus large que les sous-titres (0,84 x la largeur) réduit toutes les lignes en gros de l'effet
   ensemble, juste assez.
5. **Taille : les sous-titres x 1,0 à 1,2 au plus** (Yoan, retour sur v13 : 1,45 était trop gros, les majuscules
   grossissent déjà ; ça doit juste ressortir un peu, pas sauter aux yeux), selon l'importance de ce qui est mis en
   avant, une seule taille par ligne (`ENRICHI` de `commun.mjs`) :
   - **fort, 1,2** : le mot qui porte le sens (« 12 SEMAINES », « SEMAINES » sous « 12 PREMIÈRES », « CORVÉE ») ;
   - **moyen, 1,15** : une phrase en gros sur deux lignes, même taille pour les deux (« SUR LE / LONG TERME »,
     « REPRENDRE LES / BONNES HABITUDES ») ;
   - **secondaire, 1,05** : l'étage du haut d'un groupe à deux étages (« 12 PREMIÈRES », « MOINS UNE »).
   Jamais plus de 1,2 : `verifier.mjs` refuse une ligne d'enrichi (conteneur `data-enrichi`) au-delà (`ENRICHI`).
   Interligne, épaisseur du soulignage et largeur suivent la taille.

### Règles générales
- **Jamais de mouvement linéaire à cadence régulière**, quelle que soit l'animation : toujours une courbe (freinage,
  à-coups). Exceptions : la sortie du faisceau (0,09 s, trop court pour se voir) et les sous-titres, repris tels quels de
  leur style d'origine (montée de 14 px en 0,15 s, fondus, glissé du pavé en 0,12 s, à vitesse constante comme l'ASS).
- Courbes (`COURBES`) : entrée `power2.out`, descente `power3.out`, passage d'une ligne en cours à la suivante
  0,25 s `sine.inOut`, déplacements d'éléments `power2.inOut`.
- Un élément qui part disparaît sec à l'image (coupe), sauf mention contraire.

## Calage sur la voix
- Les mots viennent d'une transcription calée (début et fin de chaque mot). Un élément ne s'affiche **jamais avant
  que Romain dise son mot**.
- Instant d'image : `img(t) = round(t x 30)` ; un changement posé à une image se cale 0,5 ms avant elle
  (`n / 30 - 0,0005`) pour tomber pile dessus.
- **Attaque d'un mot = 3 images (0,1 s) avant son début transcrit** (Yoan, 2026-11-14, retours sur v14, règle
  définitive) : tout texte animé calé sur un mot (sous-titres enrichis, mots et lignes des pleins écrans et des
  animations) démarre là, pour être pleinement visible quand il commence à le dire (la transcription place souvent le
  début sur la voyelle : « semaines » transcrit 5,522 s, le « s » part vers 5,46 s). Jamais avant le milieu du mot
  précédent, jamais avant le début du calque. Une seule fonction calcule cet instant : `attaqueMot` de
  `scripts/lib/style.mjs` (`resoudre` la rend dans `debut_s` et `image`, `ATTAQUE` de `commun.mjs`) ; l'entrée animée
  part à l'attaque (`APPARITION.avance` 0). Les sous-titres de la brique ne l'utilisent pas : leurs groupes
  apparaissent au début transcrit de leur premier mot (règle de l'ancien skill de Romain, inchangée). Pavé des sous-titres : il part du mot d'avant à l'attaque du mot et glisse
  0,12 s (`SOUS_TITRES.glisse`, `SOUS_TITRES_TEMPS.avancePave` 0).
- Le tick d'arrivée se pose à l'image où l'élément passe 50 % d'opacité (`apparitionMiOpacite`).
- Frappe lettre par lettre : environ 18 lettres/s (intervalle de base 0,036 s, aléa 0,7 à 1,3, pauses 0,03 à 0,07 s
  entre les mots, `FRAPPE`) ; pour un mot seul, 1/18 s par lettre ; la phrase tapée finit avec sa voix.

## Comportement de sous-titres : tout texte qui reprend ses mots (Yoan, 2026-11-13)
« À chaque fois qu'on veut faire des effets avec du texte, c'est bien, on peut, mais il faut un comportement de
captions. » Pour tout texte d'un effet qui dit ses mots (hooks, pleins écrans texte, listes, schéma, cartes, sur mesure) :
- chaque mot (ou groupe de mots) apparaît à l'image de son **attaque dans la voix**, jamais avant (l'apparition part
  à l'attaque, 0,1 s avant le début transcrit, comme partout) ;
- il peut **rester plus longtemps** que dans les sous-titres si l'effet le demande (la phrase se construit à l'écran) ;
- les mots d'un même effet **repartent ensemble**, à un instant calé sur la voix : la fin de la phrase, ou le début de
  l'idée suivante (la coupe qui suit) ; jamais un mot qui s'en va seul au milieu, jamais un départ au hasard.
- **chaque mot dit ne s'affiche qu'une fois** (Yoan, 2026-11-14) : quand un effet reprend des mots de sa phrase, ces
  mots sortent des sous-titres. Les sous-titres s'arrêtent à l'attaque du premier mot repris et reprennent après le
  dernier, en groupes redécoupés (jamais un groupe à cheval sur le passage repris) ; « pendant les » en sous-titres puis
  « 12 premières / semaines » dans l'effet, jamais « pendant les 12 » puis « 12 premières semaines ». L'effet déclare ses
  mots (`mots_repris` du calque ; les textes `{ mots }` d'un gabarit sont comptés seuls), la brique sous-titres les
  retire.
`verifier.mjs` contrôle « jamais avant son mot » et « une seule fois » (`MOT_DOUBLE`, avec le mot et l'instant ;
`verifier.mjs <dossier> --mots` sur toute la vidéo) ; le départ commun se regarde sur la planche.

## Citations (Yoan, 2026-11-14, corrigé après la v12)
Quand Romain cite une pensée ou une phrase (« tu vas te dire : Mince, c'est passé vite »), **rien ne s'affiche en plus**
dans les sous-titres : pas de guillemets, pas d'autre marque (Yoan, retours sur v12 : « c'est pas beau »). Le plan peut
marquer la citation (`sous_titres.citations`), le monteur la recopie dans `sous-titres.json` (`citations`, numéros de
mots) : elle fait seulement ses propres groupes, jamais un groupe à cheval entre elle et la phrase autour.

## Captions : même ligne, même taille, même police (Yoan, 2026-11-14)
Captions = les textes qui disent sa phrase au fil de sa voix : les sous-titres, les sous-titres enrichis (un passage de
sa phrase mis en valeur à la place des sous-titres), les pleins écrans texte qui suivent sa voix.
- **Sur une même ligne, tous les mots ont la même taille et la même police.** Deux lignes différentes peuvent avoir des
  tailles différentes : « 12 premières » sur une ligne et « SEMAINES » plus gros sur la suivante, c'est bon.
- Pour faire ressortir des mots, on les met **sur leur propre ligne**, jamais en plus gros au milieu d'une ligne :
  « sur le long terme » se met en gros tout entier (pas « long terme » seul en gros derrière « sur le » en petit) ;
  « reprendre les bonnes habitudes » de même ; « tu comprends aussi / CE QUI MARCHE pour toi » avec « pour toi » en
  petit sur la ligne de « CE QUI MARCHE » est le défaut à ne pas refaire.
- Déclaration : l'élément qui contient des captions porte `data-captions` (plein écran texte des gabarits `#pl`, effets
  sur mesure qui disent sa phrase). `scripts/meme-ligne.mjs` regroupe les mots par ligne de base, image par image, dans
  le Chrome du rendu ; `verifier.mjs` refuse une ligne aux tailles ou polices mêlées (`LIGNE`, avec les mots et leur
  hauteur de capitales).
- Les autres textes (hooks, mots géants, chiffres, minuteurs, cartes, listes, schéma, CTA) gardent leur hiérarchie de
  tailles : rien ne limite l'écart entre un mot géant et la phrase qui l'accompagne.

## Sous-titres → `bibliotheque/sous-titres/`
Ceux que Romain a choisis le 29/10 et utilisés jusqu'ici (son ancien skill, `captions_romain.py`), refaits en calque le
2026-11-13 ; les styles classique, formelle et mot fort du Style Lab sont retirés (Romain : « trop de différences de
taille », police pas aimée). Valeurs : `SOUS_TITRES` de `commun.mjs`.
- **Inter Black** (`POLICES.sousTitres`, un seul réglage) blanc pur, **71 px** en 1080 (0,066 x la largeur x le réglage
  `taille`, 1 par défaut), lettres resserrées de 5 % de la taille, pas les espaces ; casse de la transcription,
  ponctuation de fin retirée.
- **Ombre douce** : copie noire du texte dessous, bordure 4 px, flou du `\blur9` de libass (écart-type 2,7 px),
  opacités 0,655 (texte) et 0,404 (bordure), sans décalage.
- Une ligne centrée, milieu des capitales à **0,70** de la hauteur (réglage `position`).
- **Groupes** de 1 à 4 mots, 20 caractères au plus, 0,84 x la largeur au plus, jamais à cheval sur deux phrases, découpe
  équilibrée : l'algorithme de l'ancien skill, tel quel. Le monteur ne choisit pas les groupes.
- **Temps** : le groupe apparaît à l'attaque de son premier mot ; suivi d'un blanc de moins de 0,5 s il part au début du
  suivant, sinon 0,25 s après son dernier mot, en fondu de 0,11 s ; le premier groupe après un blanc de 0,5 s monte de
  14 px en fondu de 0,15 s.
- **Volume** (réglage `volume` de `sous-titres.json`, 2026-11-14) : combien de mots par sous-titre. **Défaut provisoire**
  (Yoan, 2026-11-15, en attendant le choix de Romain) : 3 à 4 mots sur une ligne, coupe sur les blancs de 0,25 s et les
  virgules (`SOUS_TITRES.volume`) ; la règle de l'ancien skill ci-dessus (1 à 4 mots, 20 caractères) reste accessible
  avec `"volume": "ancien"` ; jusqu'à 8 mots sur deux lignes, coupures sur les respirations et les virgules, jamais
  un mot seul (détail dans le skill sous-titres). Romain choisit son niveau.
- **Pavé orange** (réglage `pave` de `sous-titres.json`, `SOUS_TITRES.pave.actif` par défaut : avec pavé ; essai de Yoan
  du 2026-11-14 : sans pavé, pour voir si ça fait plus professionnel, tout le reste identique ; la ligne « commente MOT »
  des CTA garde alors son pavé sur le MOT seulement) #F15A24 arrondi (rayon 0,18 x la taille) sous le mot dit, texte blanc par-dessus, sans marche : du
  haut des capitales - 0,14 x la taille sur 0,38 x la taille de plus que les capitales, marges 0,17 x la taille ; il
  glisse d'un mot au suivant en 0,12 s à l'attaque du mot, bords gauche et droit à vitesse constante.
- Le CSS et le JS sont écrits une fois (`blocSousTitres` de `scripts/lib/style.mjs`) et posés dans le calque des
  sous-titres et dans les gabarits qui portent leur propre ligne : changer la police ou une valeur se fait dans
  `commun.mjs`, puis `node scripts/maj-sous-titres.mjs`.
- Jamais de son sur les sous-titres.

## Hooks
- **Pavés** (simple, imite Edits) → `hook-paves/` : une ligne par pavé, capitales 58 px, texte charbon, pavé
  craie (marche charbon 35 %) ou orange (marche braise), en haut à y 300, écart 10 px ; posés d'un coup, affichés
  images 0 à 59.
- **Titre derrière lui** → `hook-titre-derriere/` : phrase minuscules 54 px en haut (y 250), mot géant capitales
  dont l'encre couvre la zone sûre (x 94 à 987), **16 px** entre la ligne de base de la phrase et le haut des capitales,
  pavé orange 22 px sous le mot géant ; **toute la composition passe derrière lui** (trouée par son masque), le mot géant
  au-dessus de sa tête, bas des capitales environ 30 % sous le haut du crâne. Voile standard, ombre douce.
  Avec le dézoom d'ouverture (caméra de 120 % à 100 %), le titre suit la caméra : il se compose à 100 % (encre du mot
  géant sur la zone sûre) et dépasse pendant le dézoom, c'est voulu ; la zone sûre se juge à l'image où le dézoom est
  fini (`suit_ouverture`, contrôlé par `verifier.mjs`).
- **Mot géant derrière la tête** → `hook-mot-geant/` : petits mots minuscules 52 px devant (en haut à gauche, puis en bas
  à droite vers y 532), le mot géant derrière sa tête, en trois temps, chacun sur sa voix avec l'apparition ; tick sur
  le mot géant.
- **Chiffre** → `hook-chiffre/` : chiffre capitales 330 px, suite minuscules 60 px, puis pavé, l'un après l'autre ;
  tick sur le chiffre.
- **Question** → `hook-question/` : le sujet en mot géant sur toute la zone sûre, la question sur pavé orange 62 px,
  20 px dessous, posés d'un coup, sur sa démo.

## CTA (mot en commentaire)
- Apparition à l'image 43 de l'extrait de CTA, le mot 3 images après « commente » (`CTA_TEMPS`).
- **Champ Instagram** → `cta-champ-instagram/` : champ de commentaire recopié (Roboto, bleu #0095F6, photo de profil
  84 px) à x 91, y 1120, largeur 899 ; le mot se tape lettre par lettre avec une frappe par lettre, « Publier » s'allume.
- **Mot derrière lui** → `cta-mot-derriere/` : le mot géant (encre sur la zone sûre) monte à sa place derrière sa tête
  (haut des capitales à y 272) avec l'apparition, tick quand il devient lisible ; devant, « commente MOT » en ligne de sous-titre (même style que les sous-titres : le pavé est sur
  « commente », puis glisse sur le mot à son attaque).

## Transitions
- La base reste la **coupe sèche**.
- **Faisceau** → `transition-faisceau/` : bande inclinée de 12 degrés, bords fondus sur 16 %, entrée depuis la droite en
  **0,067 s power1.in**, écran couvert pile sur l'image de la coupe, sortie vers la gauche en **0,09 s**. Trois réglages :
  craie pleine (2200 px), craie étroite ou orange étroite (1000 px, laissent deviner la coupe). Son : déclencheur sur la
  coupe.
- **Flash** → `transition-flash/` : deux images craie, 50 % sur la dernière image du plan A, 100 % sur la première du
  plan B. Sans son.

## Pleins écrans et fonds → `plein-ecran-fond/`, `plein-ecran-orange/`
- Texte en capitales sur **2 lignes de même largeur d'encre** (x 94 à 987) : la ligne courte agrandie, la longue
  réduite ; bloc centré à y 960 ; chaque ligne sur son mot avec l'apparition.
- Le **fond s'affiche 0,25 s avant** la première ligne (`PLEIN_TEMPS.avanceFond`). Coupe sèche avant et après.
- Fonds (`FONDS`) : charbon (texte craie), orange (texte charbon), craie (texte charbon), ou **sa vidéo qui continue de
  tourner** floutée sigma 20 et assombrie à 40 % (texte craie, ombre douce). Jamais une image figée sous le flou. Flou
  fort (sigma 40, 28 %) pour la barre de minuteur.
- Plein écran orange de phrase : 2 lignes de même taille, centrées, texte charbon.
- **Un seul gabarit, le fond en paramètre** : ne jamais proposer ni fabriquer plusieurs versions qui ne diffèrent que par
  le fond ; le monteur choisit le fond selon la vidéo.

## Demi-écran → `demi-ecran/`
- Panneau charbon qui descend du haut avec la courbe « banque » (0,70 s, long freinage, `courbe_banque.json`), pousse son
  visage de **560 px** vers le bas (son plan est décalé image par image avec la même courbe), fondu de 260 px entre le
  panneau et l'image. Texte : phrase minuscules 66 px à x 91, y 250, mot capitales orange (la plus grande qui tient la zone sûre, 180 px au plus) dessous, chacun avec
  l'apparition.
- Deux sorties : **bascule** en plein écran (le panneau grandit en 0,5 s power2.inOut et chasse son visage, puis coupe
  franche sur lui) ou **faisceau** craie avec son déclencheur.
- Jamais de demi-écran sur fond flou : le flou est réservé au plein écran.

## Listes → `liste/`
- Plein écran charbon, bloc centré à y 960, lignes alignées à gauche derrière leurs chiffres : chiffres capitales
  orange 96 px, texte minuscules 72 px, capitale en début d'élément.
- Chaque élément arrive sur son mot (apparition) et devient la **ligne en cours** (pleine craie rayon 12, texte charbon) ;
  la ligne d'avant passe à **38 %** en 0,25 s sine.inOut.

## Minuteurs → `minuteur-chiffres/`, `minuteur-barre/`
- Le chiffre puis son libellé sur leurs mots, puis le compte à rebours **par à-coups qui partent lentement et se
  précipitent** vers 00 : écarts en images 6 5 4 4 3 3 3 2 2 2 2 2 2 2 (`MINUTEUR.ecarts`). Sortie d'un chiffre 0,05 s
  power3.in (monte de 16 %, flou 8), entrée du suivant 0,22 s au plus expo.out.
- Chiffres seuls : capitales 470 px centrés à y 960, libellé 52 px à y 1230 à 62 %, sur charbon.
- Barre : chiffre 330 px à y 780, barre orange 899 x 44 px à y 1080 qui se vide **cran par cran** calée sur les chiffres
  (0,26 s au plus expo.out), séparations de 4 px, sur sa vidéo floutée fort.
- Jamais d'anneau.

## Schéma → `schema/`
- Se construit sur sa voix : l'effet arrive au centre sur son mot (pavé orange, capitales 140, texte charbon), descend
  à sa place (0,55 s power3.inOut) ; les causes en cadres à trait craie 3 px à 22 % (rayon 18, minuscules 60) sur leurs
  mots ; le « + » en craie (un seul orange par image) ; le trait de 5 px se trace des causes vers l'effet (0,35 s
  power2.inOut), un point à chaque bout. Sur charbon.

## Comparaison → `comparaison/`
- D'abord la mauvaise option : grille de petits pictos craie qui sature, se grise (#56524D) et s'effondre. Montrer que la
  mauvaise est mauvaise AVANT la bonne.
- Puis les bons exemples en **vraies photos** de Romain : trois vignettes carrées 286 px rayon 10 sur une ligne droite
  à y 700, chacune avec un clic et un éclair à 65 % ; puis le mot clé qu'il dit en capitales (170 px au plus, dans la zone sûre) sous les
  vignettes, sur son mot. Sur charbon.

## Cartes → `carte-seance/`, `carte-superset/`, `carte-fiche-exercice/`, `carte-chapitre/`, `carte-presentation/`, `carte-nutrition/`, `carte-chrono/`
- Toutes : carte charbon rayon 18 avec son ombre, **onglet** orange qui dit ce qu'est la carte, une seule zone orange en
  plus. La carte entre d'abord (apparition), puis chaque ligne sur son mot ; la **ligne en cours** est craie texte
  charbon, les passées à 38 %.
- Lignes (`LIGNE_CARTE`) : numéro capitales orange 72 px, vignette 132 px rayon 10, nom minuscules 46 px, ligne
  secondaire 30 px à 62 %.
- Séance : x 91, y 600, largeur 899, sur sa vidéo floutée. Séries, répétitions, repos **seulement quand il les donne**.
- Superset : deux exercices puis la barre orange de 14 px qui les relie, sur sa démo floutée.
- Fiche exercice : photo et nom (70 px) sur son mot, puis trois cases en cascade (chiffres 96 px, légendes 28 px).
- Chapitre : bloc numéro orange (200 px) en haut à gauche (x 91, y 280), titre 120 px sur son mot, petite ligne 38 px.
- Présentation : en bas à gauche (y 1150), photo de profil 150 px avec anneau orange 6 px, nom 110 px, ligne 38 px,
  pseudo 34 px, en cascade ; voile sombre en bas.
- Nutrition : vignettes des plats puis ses totaux (73 px : même largeur que les 96 px de la planche), un élément à la fois (x 91, y 1008, largeur 820).
- Chrono : dans un coin libre (x 500, y 300, largeur 490), temps en capitales 145 px, légende 34 px à 70 % ; tick.
- Les chiffres d'une carte sont **les siens**, jamais estimés ni inventés.

## Démos
- **B-roll annoté** → `broll-annote/` : sa démo dans une carte rayon 18 (x 91 à 990, y 380 à 1504) sur charbon ; sur le mot,
  point orange 26 px (halo 7 px à 30 %) sur le muscle, trait orange 5 px coudé qui se trace (0,35 s power2.inOut),
  étiquette sur pavé orange minuscules 46 px texte charbon. Le nom est le sien, jamais inventé.
- **Angle d'articulation** → `angle-coude/` : points du corps mesurés image par image, rayons et arc craie 5 px, centre
  orange, valeur capitales 96 px ; **valeur mesurée sur l'image, jamais estimée**.
- **Tampon verdict** → `tampon-verdict/` : cadre craie 10 px rayon 16, coche et texte capitales 108 px, penché de
  4 degrés, en haut à droite (bord droit x 975, y 300), sur ses mots, avec le tick. Tampon « mauvais » seulement quand il
  montre un mauvais exemple.
- **Anatomie** → `anatomie/` : silhouettes face et dos (gris #3A3734) sur charbon ; le muscle dont il parle s'allume en
  orange sur son mot (0,20 s power2.out) et s'éteint quand il passe au suivant (0,25 s sine.inOut).

## Formats connus
- **Un format qui existe déjà se reproduit à l'identique** (couleurs, formes, mise en page d'origine), recréé en code,
  jamais en capture d'écran. Les couleurs et polices de Romain ne servent qu'aux éléments qu'on invente. Trop de branding
  tue le branding.
- **Recherche Google** → `recherche-google/` : plein écran blanc, barre en pilule blanche à ombre grise, loupe, croix,
  micro, Roboto #202124, curseur bleu fin, sans logo Google ; sa phrase tapée lettre par lettre, suggestions (débuts de
  sa propre phrase, la suite en gras) qui s'ouvrent pendant la frappe, Entrée qui ferme la liste. La barre entre avec
  l'apparition.
- **Captures d'articles sur téléphone** (effet journaux, Yoan 2026-11-14, retours sur v12 : « on voit que les articles
  sont refaits ») : une page web mobile vraie de bout en bout, construite à 390 px de large (un iPhone) puis agrandie
  jusqu'aux 1080 px de la vidéo, comme une capture : barre d'état, barre du navigateur avec l'adresse du site (Safari en
  bas ou en haut, ou navigateur à barre d'adresse en haut), en-tête du site, rubrique, titre, chapô, auteur et date,
  photo d'article, corps en police de lecture à la taille réelle d'un site (17 à 19 px, soit 47 à 53 px vidéo), marges
  de site, liens soulignés, intertitres, « À lire aussi », publicité. Sites inventés aux noms neutres, aucune marque ni
  logo d'un média existant ; aucune photo de personne (dégradés photo, objets) ; une mise en page différente par site.
  Calque natif (`origine.natif`, partie `data-natif`) : les polices des sites restent (Georgia, Charter, Helvetica Neue,
  Avenir Next, Verdana, système d'Apple), jamais d'italique. La mécanique du text match cut reste (mot fixe sur son
  surligneur orange, coupes de 2 à 4 images, traînées vers le bas) ; le mot fait partie du texte de chaque page, dans
  sa police : le navigateur règle la marge du site et le défilement pour qu'il tombe toujours au même endroit.
- **Tier list** → `tier-list/` : copie de TierMaker, rangs S A B C D aux pastels d'origine, étiquettes à gauche, rangées
  sombres de 170 px, vignettes carrées pleines de 162 px posées dans leur rangée, Liberation Sans. Les vignettes attendent
  dans la réserve ; sur son mot, la vignette se soulève, traverse en freinant et se pose dans son rang, la réserve se
  resserre, clic à la pose. L'ordre des rangs vient de Romain, jamais de nous.
- **Fond vert** → `fond-vert/` : Romain détouré image par image (masque lissé, contour resserré, bord décontaminé), en
  taille réelle, devant un visuel fait de ses mots : sa phrase en capitales charbon sur orange, chiffre
  géant craie à 92 % derrière lui. Chaque ligne sur son mot ; la coupe entre deux prises se cache sous un changement de
  visuel. Tout mot reste lisible : rien sous son corps. Sans ombre portée.

## Zooms → `bibliotheque/zooms/`
- Centrés entre ses yeux, calculés image par image sur le plan, jamais linéaires, **jamais de son**.
- **Éclair** : 115 % en 0,13 s power2.out avec un léger flou de mouvement, sur le mot fort, tenu jusqu'à la coupe qui
  revient au plan large.
- **Rapprochement court** : 110 % en 1 s power2.inOut, puis coupe au plan large.
- Jamais au-delà de 115 % sur une rush 1080p. Avec la 4K d'origine, recadrer depuis la 4K (sans perte jusqu'à 1,8x).

## Étalonnage
- **Contrasté net** (v1 r1-01c) sur toute image caméra : plus de contraste et de netteté, décor un peu moins saturé,
  façon salle. Chaîne ffmpeg exacte (`ETALONNAGE`) :
  `curves=all='0/0 0.22/0.185 0.5/0.5 0.78/0.81 1/1',huesaturation=saturation=-0.18:colors=g+c+b,eq=saturation=1.02,unsharp=7:7:0.55:5:5:0`.
- Un seul réencodage de l'original : étalonnage, zooms et calques dans le même rendu.

## Sons et niveaux (`SONS`, fichiers dans `bibliotheque/sons/`)
- Voix : loudnorm I -16 LUFS, crête -1,5 dBTP, LRA 11. Crête totale du mix sous -1 dBFS.
- Chaque son est court, coupé, avec de courtes rampes, énergie entre 1 et 5 kHz (audible au téléphone), calé à l'image :
  - faisceau : déclencheur d'obturateur `faisceau-obtu.wav` (18 ms) sur l'image où la bande couvre l'écran, **9 LU** sous
    la voix ;
  - arrivée d'un texte ou d'une carte (mot géant, mot du CTA, chiffre, chrono, tampon) : `arrivee-tick.wav` à l'image où
    l'élément passe 50 % d'opacité, **8 LU** sous la voix ;
  - photo qui se pose (comparaison, tier list) : clic d'appareil photo `clic.wav` (54 ms), RMS actif **14 dB** sous la voix ;
  - frappe : une par lettre, `frappes/t1` à `t4` tournantes sans répétition, ±1,5 dB, RMS actif **23 dB** sous la voix ;
    touche Entrée `entree.wav`, **17 dB** sous la voix ;
  - transition (Yoan, 2026-11-13) : un clic `clic.wav` sur chaque flash et sur l'entrée et la sortie de chaque plein
    écran, à l'image où le flash couvre l'écran, RMS actif **14 dB** sous la voix (`SONS.transition`) ;
  - image de réaction (mème) : toujours le « Vine boom » `meme-vine-boom.wav` (fourni par Yoan, 0,9 s), à l'image où elle
    apparaît, **12 LU** sous la voix (`SONS.meme`).
  - **retenus par Yoan sur le test v17 (2026-11-14)**, niveaux en dB RMS sous la voix sur l'échelle des clics (clics 14,
    Vine boom 8,2 sur cette échelle, réglé en 12 LU) :
    - captures d'écran qui défilent (effet journaux, pages) : un petit clic `clic-court.wav` (le clic de transition
      raccourci à 28 ms) à **chaque changement d'écran**, **21 dB** (7 dB sous les transitions) ; le flash d'entrée garde
      son clic de transition (la première page arrive avec lui) ; la série est un seul geste (`SONS.ecran`) ;
    - objet qui se pose (pièce de puzzle, etc.) : un « clac » sec `pose-clac.wav` à l'image où il est posé, **8 dB**,
      niveau du Vine boom (`SONS.pose`) ;
    - cases cochées : un tick par case, de plus en plus aigu (`coche-1` à `coche-3`), à l'image où chaque case se
      remplit, **8 dB** ; la série est un seul geste (`SONS.coche`) ;
    - moment fort principal de la vidéo (**un seul**) : une petite montée `montee.wav` (0,55 s) qui **s'arrête net sur le
      son d'entrée du moment fort** (le clic du flash qui l'ouvre), **10 dB** (`SONS.montee`).
- **Un son suit un mouvement visible, jamais la voix seule** (Yoan, 2026-11-14).
- Où : c'est le monteur qui choisit, discret, jamais partout : les transitions, les images de réaction, l'accroche, les
  gestes ci-dessus quand ils sont à l'écran, et la montée du moment fort principal. Dans le doute, pas de son.
- **Refusés par Yoan** (2026-11-14, tests v15 à v17), jamais : impact sourd ou « punch » sur les sous-titres enrichis
  (« pas top », « nul ») ; souffle de défilement continu sur des pages (swipe) ; son de conclusion en fin de vidéo.
- Jamais de son sur un zoom, sur les sous-titres ni sur les sous-titres enrichis. Jamais de son dans le grave (sous
  300 Hz, sauf le Vine boom) ni à plus de 12 LU sous la voix : inaudible au téléphone.
- Un son qui manque à la bibliothèque se génère avec ElevenLabs (sound-design, `generer.py`, avec cache : la même
  description ne se paie qu'une fois).
- Musique de fond : pas choisie (« on skip, je rajouterai plus tard », Yoan).
- **Licence** : sons ElevenLabs, usage commercial réglé par Yoan avec ElevenLabs le 2026-11-11 ; Vine boom fourni par Yoan.

## Zone sûre (`ZONE_SURE`)
- Tout texte dans **x 91 à 990, y 237 à 1479**. À droite, sous y 997, la colonne des boutons Instagram : rien au-delà
  de x 990.
- Les mots géants calculent leur taille pour que l'encre couvre x 94 à 987.
- Seule exception : le titre derrière lui qui suit le dézoom d'ouverture dépasse pendant le dézoom ; il tient dans la
  zone (et la couvre) à l'image où la caméra est revenue à 100 %.

## Animations sur mesure : qualité et placement (Yoan, 2026-11-12, tests v3 et v4)
Retours de Yoan : « ça fait un peu cheap dans les formes utilisées, les mouvements » (v3), puis sur la v4 : le puzzle en
fausse 3D, le calendrier mural accroché dans le vide et le stylo qui entoure et coche « font cheap ». Deux familles
seulement :
- **Ce qui existe se reproduit à l'identique** (comme la recherche Google) : une appli, un écran, un objet du quotidien.
  Le calendrier, c'est l'appli **Calendrier d'Apple** (vue mois iOS : police SF, rouge Apple du jour, gris des jours,
  mise en page exacte), posée proprement comme un écran (carte arrondie ou téléphone), jamais un objet suspendu dans le
  vide. Étudie l'original (captures) avant de le refaire. Ses couleurs sont les siennes : déclare `origine.natif: true`
  dans `calque.json`, le contrôle de palette ne s'applique pas.
- **Ce qu'on invente est minimaliste** (v5 : le dessin animé fait « encore plus cheap ») : sa phrase en texte qui
  arrive comme les sous-titres (apparition sur sa voix, les morceaux restent) mais **mis en forme comme un titre**
  (v6 : « on ne met pas des captions classiques sur une animation full screen ») : dans la police unique, capitales
  sur les mots qui portent le sens, des tailles qui varient **d'une ligne à l'autre, jamais dans une même ligne**
  (« Captions » : déclarer `data-captions`, 2026-11-14 : « tu comprends aussi / CE QUI MARCHE pour toi » avec « pour
  toi » en petit sur la ligne de « CE QUI MARCHE », rejeté), et le **comportement de sous-titres** (« Comportement de
  sous-titres » : chaque mot sur son attaque, les mots repartent ensemble sur la voix), soulignage à main levée orange qui se trace seul sous le mot clé (un seul accent orange par image), en haut et en bas ; au centre, une ou deux formes nettes aux couleurs `COULEURS` (aplats, coins `RAYONS`, ombre `OMBRES.carte`),
  qui portent ses mots et jouent l'idée par un seul mouvement clair (une brique qui glisse et s'emboîte pile dans
  une autre, avec `COURBES.ressortObjet`). Jamais de personnages (dessin animé, bonshommes bâtons), de fausse 3D, de
  décor, de pictos de base. Les teintes `DESSIN` de `commun.mjs` ne servent plus.
- **Case cochée** (`CASE_COCHEE`, `caseCocheeSvg` / `caseCocheeJs` de `scripts/lib/style.mjs`, Yoan 2026-11-14) : la
  case se remplit de la couleur de son trait, puis la coche se trace dedans dans la couleur du fond et occupe la case ;
  case et coche dans le même repère. Jamais une petite coche qui flotte dans une case vide.
- **Les marques à main levée se tracent seules** : cercle autour d'une date, coches, soulignage apparaissent comme
  dessinés à la main (trait irrégulier, vitesse qui varie, bout qui dépasse un peu le départ), **sans stylo, feutre ni
  main à l'écran**. Rouge vif (`MATIERES.feutreRouge`) pour un cercle sur un format réel, orange pour le soulignage de
  la marque. Le rouge ne compte pas comme accent orange.
- **Mouvement avec inertie** : un objet ou un personnage part avec un petit temps de lancement, freine, se pose avec un
  léger ressort (`COURBES.ressortObjet`, jamais sur un texte) ; jamais de linéaire ni de glissement mécanique.
- **Sur la caméra** : une chose réelle peut se poser dans l'image, à côté de lui ou derrière sa tête (couche `derriere`,
  trouée par son masque de détourage). Jamais sur son visage ; les sous-titres restent ; tout reste dans la zone sûre.
- Une scène de la vie (quelqu'un dans sa cuisine, quelqu'un qui marche) n'est pas une animation : c'est un B-roll
  filmé par Romain (brique b-roll). Jamais de B-roll généré par IA (2026-11-13) : sans clip, le passage reste sur lui.

## Ce qu'on ne fait jamais (rejets v1 et v2 devenus règles)
- Jamais plusieurs versions d'un effet qui ne diffèrent que par le fond : une seule, le fond est un paramètre.
- Jamais de texte clair sur l'orange. Jamais deux accents orange dans la même image.
- Jamais de mouvement linéaire à cadence régulière ; jamais de pop, de rebond ni d'échelle à l'entrée d'un texte (seule
  exception : le « coup de poing » par ligne des sous-titres enrichis).
- Sous-titres : jamais un autre style que le sien (ceux de son ancien skill) ; plus de classique, de formelle ni de mot
  fort (style du Style Lab retiré le 2026-11-13 : trop d'écart de taille, police pas aimée) ; jamais un mot fort en
  grand au-dessus de la ligne ; jamais la police changée ailleurs que dans `POLICES.sousTitres`.
- Captions (sa phrase au fil de sa voix) : jamais deux tailles ni deux polices sur une même ligne (« Captions »).
- Police : jamais une autre police que `POLICES.sousTitres` dans la vidéo (Big Shoulders et Bricolage retirées le
  2026-11-14), sauf un format natif recopié (Roboto, Liberation Sans, police système d'Apple) ; jamais une serif
  italique.
- Texte d'un effet : jamais un mot qui arrive avant que Romain le dise, jamais un mot qui repart seul au milieu de la
  phrase ou à un instant qui n'est pas calé sur la voix.
- Hooks : pas de pavés craie avec un mot orange, pas de titre derrière lui avec le mot en orange ni en contour, pas d'écart
  moyen (34 px) entre la phrase et le mot géant, pas de texte seul ni mot par mot, pas de titre qui déborde de la zone
  sûre, pas de mot géant en dégradé ni en couleurs inversées.
- CTA : pas de champ Instagram posé sans frappe, pas de mot derrière lui en simple fondu, pas de carte à onglet
  « en commentaire ».
- Transitions : jamais de zoom qui pousse, de glissement latéral, de flash ou balayage lents et visibles ; pas de faisceau
  orange en bande de 1500 px ni pleine.
- Pleins écrans : pas de plein écran craie de phrase ; jamais une image figée sous le flou.
- Demi-écran : pas de sortie sèche, jamais sur fond flou.
- Listes, minuteurs, schéma, comparaison : sur charbon (le minuteur barre sur flou fort) ; pas en demi-écran, pas sur flou
  moyen ; jamais de minuteur en anneau ; jamais de pictos ou bonshommes qui se répètent pour les bonnes options (des
  photos) ; jamais un texte qui dit ce qu'une image devrait montrer (« aucun monteur n'écrirait 28 000 petits
  exercices »).
- Cartes : pas de carte « résultat » sur un chiffre de transformation (rejetée) ; pas de cartes d'aliments en plein
  écran ni d'arguments en mini-cartes au-dessus de ses doigts (« on n'a pas besoin de ça ») ; le duel d'aliments sort du
  périmètre et se fait sur mesure.
- Fond vert : pas réduit à 70 % en bas à droite, pas sur la page de recherche, pas d'ombre portée.
- Formats connus : jamais brandés aux couleurs de Romain, jamais en capture d'écran.
- Zooms : jamais de punch-in serré sur la coupe, jamais à 125 %, jamais de son.
- Étalonnages naturel, chaud doux, clair, frais : rejetés.
- Sons : rejetés en contexte les souffles (graves, feutrés, aérés), impacts sourds, swish aigus, scintillements, montées
  brèves sur les textes, faisceau sans son, et les quatre musiques proposées.
- Jamais de reel complet ni de reel témoin dans le labo : le labo montre des effets isolés.
- Jamais rien d'inventé sur Romain : textes, chiffres, ordres de classement viennent de lui.
- Jamais une photo trouvée sur le web dans un reel : en production, photos de Romain. **Seule exception : l'image de
  réaction (mème)** (décision de Yoan, 2026-11-11, confirmée le 2026-11-13) : le monteur la trouve et la télécharge
  lui-même, le mème exact et connu nommé dans le plan (Mr Bean qui attend, Pikachu surpris), jamais une autre image du
  web à sa place, jamais une photo de Romain ni d'une vraie personne présentée comme un client.

## À valider par Romain
- Carte présentation : « coach sportif, **Suisse** » écrit à la place de « Lausanne » (non vérifié) ; confirmer la ville
  ou garder « Suisse ».
- Tier list : l'**ordre des rangs** de l'aperçu est un exemple ; le vrai classement vient de lui.
- Fiche exercice : les **séries, répétitions et repos** de l'aperçu (3, 10, 1:00) sont inventés ; en vrai, seulement
  ses chiffres.

## Ouvert
- **Logo Google** : marque déposée ; la recherche Google n'en a pas, à valider par Yoan avant de l'ajouter.
- Rushes 4K d'origine : pas nécessaires pour l'instant (Yoan, 2026-11-11) ; on travaille sur la face caméra WhatsApp du 2026-11-08 (576x1024).
- Musique de fond : à choisir plus tard, sous licence commerciale.
