<!-- Copie du STYLE.md du Style Lab de Romain, clôture du 2026-11-11. Les chemins bibliotheque/<effet>/ désignent les dossiers de cette bibliothèque. -->

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
   niveaux coexistent donc : un montage simple qui imite ce qu'il fait déjà (sous-titres classiques, hooks pavés) et un
   montage plus pro (sous-titres formels, mot fort, titres derrière lui, pleins écrans, cartes).
5. **Ce qu'il a :** orange de marque #F15A24 (site, carrousels), logo orange et noir. Polices libres d'usage commercial
   seulement.
6. **Mouvement :** net, sobre, au service de la parole. Chaque élément arrive sur le mot qui le dit.
7. **Son :** discret, calé à l'image, audible au téléphone. Sons et musiques sous licence commerciale obligatoire.

## Socle

### Polices (`bibliotheque/fonts/`, licences OFL jointes)
- **Big Shoulders Display 900**, capitales, interligne 0,84, chiffres en chasse fixe : titres, mots géants, chiffres,
  mot fort. **800** pour les onglets des cartes.
- **Bricolage Grotesque 800**, minuscules, taille optique 96 (`"opsz" 96`), interligne 1,06, approche -0,012 em :
  sous-titres, phrases des hooks, textes des cartes.
- **Roboto** : seulement pour recopier un format natif (champ Instagram, recherche Google).
- **Liberation Sans** (métrique d'Arial) : seulement pour la tier list recopiée de TierMaker.
- Aucune autre police. Montserrat, Raleway, Inter (styles d'avant) ne servent plus.

### Couleurs (`COULEURS`)
- Orange **#F15A24** : pavés, onglets, numéros, mot en cours. **Un seul accent orange par image.**
- Charbon **#1A1612** : cartes, pleins écrans, texte posé sur l'orange.
- Craie **#F6F0E7** : sous-titres, titres, ligne en cours des cartes.
- Braise **#B8400F** : uniquement la marche sous les pavés orange.
- Formats natifs recopiés : leurs propres couleurs (`NATIF` : bleu Instagram #0095F6 ; Google #202124, #1A73E8 et
  gris ; pastels TierMaker), rien de la marque de Romain.

### Contraste
- Sur l'orange : texte **charbon** (5,33:1), **jamais** de texte clair (craie sur orange 2,98:1).
- Craie sur charbon : 15,88:1.
- Texte posé sur la vidéo : toujours avec son ombre (voir Matières) ; sous un titre en haut du cadre, voile sombre
  (`VOILE.standard` : 46 % en haut, 28 % à y 520, nul à y 1020 ; `VOILE.cuisine` et `VOILE.demo` plus forts pour les
  plans éclairés par le haut).

### Rayons (`RAYONS`, px vidéo)
- 0 : panneaux et pleins écrans. 10 : pavés, vignettes, onglets. 12 : lignes de liste et de carte. 16 : tampon.
  18 : cartes. Pilule : formats natifs seulement.

### Matières et ombres (`OMBRES`, `MARCHE`, `CARTE`, `ONGLET`)
- Texte sur la vidéo (sous-titres, mot fort) : ombre dure 4 px vers le bas, charbon à 60 %, plus un halo de 20 px à 35 %.
- Titres des hooks : ombre douce `0 6px 30px` noir à 45 %.
- Carte posée sur la vidéo : `0 18px 50px` noir à 50 %, liseré intérieur 2 px craie à 8 %.
- Pavé orange : posé sur une marche braise de 5 px (4 px sous le mot en cours des sous-titres). Pavé craie : marche
  charbon à 35 %.
- Carte : fond charbon, rayon 18. Onglet orange de 64 px de haut sur le coin haut gauche (Big Shoulders 800, 46 px,
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
- Départ **0,04 s avant l'attaque** de son mot (`APPARITION.avance`).
- Chaque élément sur sa propre attaque de voix, jamais tout le bloc d'un coup. Sans attaque nette (plan sans voix),
  0,17 s entre deux éléments (`APPARITION.ecartRef`).
- Pas de rebond, pas de dépassement, pas d'échelle.
- Exceptions qui gardent leur logique : pavé des sous-titres classiques (il glisse), hooks pavés et sous-titres formels
  (posés d'un coup), formats natifs recopiés.

### Règles générales
- **Jamais de mouvement linéaire à cadence régulière**, quelle que soit l'animation : toujours une courbe (freinage,
  à-coups). Seule exception : la sortie du faisceau (0,09 s, trop court pour se voir).
- Courbes (`COURBES`) : entrée `power2.out`, descente `power3.out`, passage d'une ligne en cours à la suivante
  0,25 s `sine.inOut`, déplacements d'éléments `power2.inOut`.
- Un élément qui part disparaît sec à l'image (coupe), sauf mention contraire.

## Calage sur la voix
- Les mots viennent d'une transcription calée (début et fin de chaque mot). Un élément ne s'affiche **jamais avant
  que Romain dise son mot**.
- Instant d'image : `img(t) = round(t x 30)` ; un changement posé à une image se cale 0,5 ms avant elle
  (`n / 30 - 0,0005`) pour tomber pile dessus.
- Entrée animée : 0,04 s avant l'attaque. Pavé des sous-titres : une image avant l'attaque (`avancePave` 1/30).
- Le tick d'arrivée se pose à l'image où l'élément passe 50 % d'opacité (`apparitionMiOpacite`).
- Frappe lettre par lettre : environ 18 lettres/s (intervalle de base 0,036 s, aléa 0,7 à 1,3, pauses 0,03 à 0,07 s
  entre les mots, `FRAPPE`) ; pour un mot seul, 1/18 s par lettre ; la phrase tapée finit avec sa voix.

## Sous-titres → `bibliotheque/sous-titres/`
- Bricolage 800 minuscules **66 px**, craie, ombre dure, une ligne centrée à **y 1430** (pavé et marche finissent
  au-dessus de y 1479), x 91 à 990, interligne 1,12.
- **Classique** (montage simple, r21-01a) : mots resserrés à **18 px** (word-spacing -0,14 em) ; mot en cours sur pavé
  orange rayon 10 (rembourrage 14 px, 4 px en bas, marche braise 4 px), texte charbon. Le pavé **glisse** d'un mot à
  l'autre en **0,12 s power2.inOut** (moins quand deux mots se suivent de près : durée = écart - 0,02 s), il arrive sur
  le mot une image avant son attaque, les deux mots changent de couleur à mi-glissé. Une ligne par groupe dit d'un trait.
- **Formelle** (montage quali, r19-01b) : sans pavé, **3 mots au plus**, le groupe apparaît d'un coup à l'image de
  l'attaque de son premier mot. Ni glissement, ni pop, ni fondu.
- **Mot fort** (avec la formelle, r22-01a) : le groupe qui porte l'idée passe en **Big Shoulders 128 px** capitales
  craie au-dessus de la ligne restée affichée, 22 px entre le bas de ses capitales et le haut des minuscules, avec
  l'apparition ; **il part avec la phrase** : mot fort et ligne de fin de phrase disparaissent à la même image, à la fin
  du dernier mot de la phrase.
- Jamais de son sur les sous-titres.

## Hooks
- **Pavés** (simple, imite Edits) → `hook-paves/` : une ligne par pavé, Bricolage capitales 58 px, texte charbon, pavé
  craie (marche charbon 35 %) ou orange (marche braise), en haut à y 300, écart 10 px ; posés d'un coup, affichés
  images 0 à 59.
- **Titre derrière lui** → `hook-titre-derriere/` : phrase Bricolage 54 px en haut (y 250), mot géant Big Shoulders
  dont l'encre couvre la zone sûre (x 94 à 987), **16 px** entre la ligne de base de la phrase et le haut des capitales,
  pavé orange 22 px sous le mot géant ; **toute la composition passe derrière lui** (trouée par son masque), le mot géant
  au-dessus de sa tête, bas des capitales environ 30 % sous le haut du crâne. Voile standard, ombre douce.
  Avec le dézoom d'ouverture (caméra de 120 % à 100 %), le titre suit la caméra : il se compose à 100 % (encre du mot
  géant sur la zone sûre) et dépasse pendant le dézoom, c'est voulu ; la zone sûre se juge à l'image où le dézoom est
  fini (`suit_ouverture`, contrôlé par `verifier.mjs`).
- **Mot géant derrière la tête** → `hook-mot-geant/` : petits mots Bricolage 52 px devant (en haut à gauche, puis en bas
  à droite vers y 640), le mot géant derrière sa tête, en trois temps, chacun sur sa voix avec l'apparition ; tick sur
  le mot géant.
- **Chiffre** → `hook-chiffre/` : chiffre Big Shoulders 330 px, suite Bricolage 60 px, puis pavé, l'un après l'autre ;
  tick sur le chiffre.
- **Question** → `hook-question/` : le sujet en mot géant sur toute la zone sûre, la question sur pavé orange 62 px,
  20 px dessous, posés d'un coup, sur sa démo.

## CTA (mot en commentaire)
- Apparition à l'image 43 de l'extrait de CTA, le mot 3 images après « commente » (`CTA_TEMPS`).
- **Champ Instagram** → `cta-champ-instagram/` : champ de commentaire recopié (Roboto, bleu #0095F6, photo de profil
  84 px) à x 91, y 1120, largeur 899 ; le mot se tape lettre par lettre avec une frappe par lettre, « Publier » s'allume.
- **Mot derrière lui** → `cta-mot-derriere/` : le mot géant monte à sa place derrière sa tête (haut à y 270) avec
  l'apparition, tick quand il devient lisible ; devant, « commente MOT » en sous-titre classique.

## Transitions
- La base reste la **coupe sèche**.
- **Faisceau** → `transition-faisceau/` : bande inclinée de 12 degrés, bords fondus sur 16 %, entrée depuis la droite en
  **0,067 s power1.in**, écran couvert pile sur l'image de la coupe, sortie vers la gauche en **0,09 s**. Trois réglages :
  craie pleine (2200 px), craie étroite ou orange étroite (1000 px, laissent deviner la coupe). Son : déclencheur sur la
  coupe.
- **Flash** → `transition-flash/` : deux images craie, 50 % sur la dernière image du plan A, 100 % sur la première du
  plan B. Sans son.

## Pleins écrans et fonds → `plein-ecran-fond/`, `plein-ecran-orange/`
- Texte Big Shoulders sur **2 lignes de même largeur d'encre** (x 94 à 987) : la ligne courte agrandie, la longue
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
  panneau et l'image. Texte : phrase Bricolage 66 px à x 91, y 250, mot Big Shoulders orange 180 px dessous, chacun avec
  l'apparition.
- Deux sorties : **bascule** en plein écran (le panneau grandit en 0,5 s power2.inOut et chasse son visage, puis coupe
  franche sur lui) ou **faisceau** craie avec son déclencheur.
- Jamais de demi-écran sur fond flou : le flou est réservé au plein écran.

## Listes → `liste/`
- Plein écran charbon, bloc centré à y 960, lignes alignées à gauche derrière leurs chiffres : chiffres Big Shoulders
  orange 96 px, texte Bricolage 72 px, capitale en début d'élément.
- Chaque élément arrive sur son mot (apparition) et devient la **ligne en cours** (pleine craie rayon 12, texte charbon) ;
  la ligne d'avant passe à **38 %** en 0,25 s sine.inOut.

## Minuteurs → `minuteur-chiffres/`, `minuteur-barre/`
- Le chiffre puis son libellé sur leurs mots, puis le compte à rebours **par à-coups qui partent lentement et se
  précipitent** vers 00 : écarts en images 6 5 4 4 3 3 3 2 2 2 2 2 2 2 (`MINUTEUR.ecarts`). Sortie d'un chiffre 0,05 s
  power3.in (monte de 16 %, flou 8), entrée du suivant 0,22 s au plus expo.out.
- Chiffres seuls : Big Shoulders 470 px centrés à y 960, libellé 52 px à y 1230 à 62 %, sur charbon.
- Barre : chiffre 330 px à y 780, barre orange 899 x 44 px à y 1080 qui se vide **cran par cran** calée sur les chiffres
  (0,26 s au plus expo.out), séparations de 4 px, sur sa vidéo floutée fort.
- Jamais d'anneau.

## Schéma → `schema/`
- Se construit sur sa voix : l'effet arrive au centre sur son mot (pavé orange, Big Shoulders 140, texte charbon), descend
  à sa place (0,55 s power3.inOut) ; les causes en cadres à trait craie 3 px à 22 % (rayon 18, Bricolage 60) sur leurs
  mots ; le « + » en craie (un seul orange par image) ; le trait de 5 px se trace des causes vers l'effet (0,35 s
  power2.inOut), un point à chaque bout. Sur charbon.

## Comparaison → `comparaison/`
- D'abord la mauvaise option : grille de petits pictos craie qui sature, se grise (#56524D) et s'effondre. Montrer que la
  mauvaise est mauvaise AVANT la bonne.
- Puis les bons exemples en **vraies photos** de Romain : trois vignettes carrées 286 px rayon 10 sur une ligne droite
  à y 700, chacune avec un clic et un éclair à 65 % ; puis le mot clé qu'il dit en Big Shoulders 170 px sous les
  vignettes, sur son mot. Sur charbon.

## Cartes → `carte-seance/`, `carte-superset/`, `carte-fiche-exercice/`, `carte-chapitre/`, `carte-presentation/`, `carte-nutrition/`, `carte-chrono/`
- Toutes : carte charbon rayon 18 avec son ombre, **onglet** orange qui dit ce qu'est la carte, une seule zone orange en
  plus. La carte entre d'abord (apparition), puis chaque ligne sur son mot ; la **ligne en cours** est craie texte
  charbon, les passées à 38 %.
- Lignes (`LIGNE_CARTE`) : numéro Big Shoulders orange 72 px, vignette 132 px rayon 10, nom Bricolage 46 px, ligne
  secondaire 30 px à 62 %.
- Séance : x 91, y 600, largeur 899, sur sa vidéo floutée. Séries, répétitions, repos **seulement quand il les donne**.
- Superset : deux exercices puis la barre orange de 14 px qui les relie, sur sa démo floutée.
- Fiche exercice : photo et nom (70 px) sur son mot, puis trois cases en cascade (chiffres 96 px, légendes 28 px).
- Chapitre : bloc numéro orange (200 px) en haut à gauche (x 91, y 280), titre 120 px sur son mot, petite ligne 38 px.
- Présentation : en bas à gauche (y 1150), photo de profil 150 px avec anneau orange 6 px, nom 110 px, ligne 38 px,
  pseudo 34 px, en cascade ; voile sombre en bas.
- Nutrition : vignettes des plats puis ses totaux (96 px), un élément à la fois (x 91, y 1008, largeur 820).
- Chrono : dans un coin libre (x 520, y 300, largeur 470), temps Big Shoulders 190 px, légende 34 px à 70 % ; tick.
- Les chiffres d'une carte sont **les siens**, jamais estimés ni inventés.

## Démos
- **B-roll annoté** → `broll-annote/` : sa démo dans une carte rayon 18 (x 91 à 990, y 380 à 1504) sur charbon ; sur le mot,
  point orange 26 px (halo 7 px à 30 %) sur le muscle, trait orange 5 px coudé qui se trace (0,35 s power2.inOut),
  étiquette sur pavé orange Bricolage 46 px texte charbon. Le nom est le sien, jamais inventé.
- **Angle d'articulation** → `angle-coude/` : points du corps mesurés image par image, rayons et arc craie 5 px, centre
  orange, valeur Big Shoulders 96 px ; **valeur mesurée sur l'image, jamais estimée**.
- **Tampon verdict** → `tampon-verdict/` : cadre craie 10 px rayon 16, coche et texte Big Shoulders 108 px, penché de
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
- **Tier list** → `tier-list/` : copie de TierMaker, rangs S A B C D aux pastels d'origine, étiquettes à gauche, rangées
  sombres de 170 px, vignettes carrées pleines de 162 px posées dans leur rangée, Liberation Sans. Les vignettes attendent
  dans la réserve ; sur son mot, la vignette se soulève, traverse en freinant et se pose dans son rang, la réserve se
  resserre, clic à la pose. L'ordre des rangs vient de Romain, jamais de nous.
- **Fond vert** → `fond-vert/` : Romain détouré image par image (masque lissé, contour resserré, bord décontaminé), en
  taille réelle, devant un visuel fait de ses mots : sa phrase en Big Shoulders capitales charbon sur orange, chiffre
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
- Où : c'est le monteur qui choisit, discret, jamais partout : les transitions, les images de réaction, l'accroche et
  deux ou trois moments importants. Dans le doute, pas de son.
- Jamais de son sur un zoom ni sur les sous-titres. Jamais de son dans le grave (sous 300 Hz, sauf le Vine boom) ni à
  plus de 12 LU sous la voix : inaudible au téléphone.
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
  (v6 : « on ne met pas des captions classiques sur une animation full screen ») : capitales Big Shoulders sur les mots
  qui portent le sens, Bricolage en petit pour les mots de liaison, tailles différentes d'une ligne à l'autre,
  soulignage à main levée orange qui se trace seul sous le mot clé (un seul accent orange par image), en haut et en bas ; au centre, une ou deux formes nettes aux couleurs `COULEURS` (aplats, coins `RAYONS`, ombre `OMBRES.carte`),
  qui portent ses mots et jouent l'idée par un seul mouvement clair (une brique qui glisse et s'emboîte pile dans
  une autre, avec `COURBES.ressortObjet`). Jamais de personnages (dessin animé, bonshommes bâtons), de fausse 3D, de
  décor, de pictos de base. Les teintes `DESSIN` de `commun.mjs` ne servent plus.
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
- Jamais de mouvement linéaire à cadence régulière ; jamais de pop, de rebond ni d'échelle à l'entrée d'un texte.
- Sous-titres : jamais le mot en cours en orange sans pavé, jamais en capitales, jamais à 80 px, jamais remontés à 66 %
  de la hauteur ; mots jamais resserrés à 22 px seulement (18 px retenus) ; jamais d'autre police que Bricolage.
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
