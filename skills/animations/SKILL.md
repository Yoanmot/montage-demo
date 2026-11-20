---
name: animations
description: Brique du monteur. Exécute les animations demandées par le plan de montage (hooks, cartes, pleins écrans, demi-écran, listes, tier list, comparaison, transitions faisceau et flash, CTA, fond vert, effets sur mesure) dans le style des reels de Romain, calées sur ses mots, et les écrit en calques prêts pour la brique rendu (calques.json). Ne choisit jamais où mettre une animation : le plan le dit. Utiliser quand l'agent monteur arrive à l'étape « animations » d'un montage.
---

# Animations du style de Romain

Tu es appelé par l'agent monteur. Le **plan de montage** (écrit par le monteur avec le skill `plan-montage`, validé par
Romain) dit quelle animation, sur quels mots, avec quel contenu. Toi, tu **exécutes** : tu ne choisis jamais où mettre une animation, tu n'ajoutes rien, tu ne
complètes pas un contenu manquant. Si une demande est floue ou impossible, tu le dis (refus nommé), tu ne l'inventes pas.

Le contrat entre les briques (dossier de travail, base de temps, `calques.json`) est `CONTRAT.md` de ce skill (à côté de ce
fichier, source unique pour l'agent monteur et toutes les briques) : il fait foi.
Base de temps : **images de la vidéo coupée**, 30 i/s, image 0 = début de la vidéo coupée.

## Ce qu'il y a dans ce dossier
- `bibliotheque/` : la bibliothèque du style (copie fidèle du Style Lab). `STYLE.md` = les règles, `commun.mjs` = toutes
  les constantes, un dossier par geste (README, gabarit HyperFrames, aperçu). Lis `STYLE.md` une fois par session.
- `scripts/caler.mjs` : lit et vérifie les demandes du plan, cale chaque ancre sur la voix.
- `scripts/instancier.mjs` : adapte un gabarit à une demande et l'écrit en calque.
- `scripts/accroche.mjs` : compose l'accroche de la vidéo (geste `accroche`) dans sa signature, à partir de la
  disposition écrite dans le plan ; `scripts/registre-accroches.mjs` : le registre qui empêche de refaire la même
  accroche deux vidéos de suite (`lib/accroche.mjs` : vocabulaire, contrôle, registre ; tests dans `tests/`).
- `scripts/exemple-sur-mesure.mjs` : modèle d'effet sur mesure (compteur de pas, testé).
- `scripts/verifier.mjs` : contrôle de style (police unique comprise), captions (même ligne, même taille), lint, rendu
  de contrôle, zone sûre, calage, aperçu posé sur la vidéo.
- `scripts/meme-ligne.mjs` : le contrôle des captions seul, sur une ou plusieurs couches.
- `scripts/maj-sous-titres.mjs` : réécrit la police (bloc `POLICE`) et le style des sous-titres (bloc `SOUS-TITRES`)
  dans les gabarits après un changement de `commun.mjs`.
- `scripts/calques.mjs` : écrit les entrées `source: "animations"` de `calques.json`.
- `scripts/lib/` : `style.mjs` (boîte à outils : ancres, apparition, carte, voile, sons, écriture d'un calque, style des
  sous-titres), `police.mjs` (métriques des polices), `navigateur.mjs` (Chrome de HyperFrames pour mesurer),
  `mesure.py` (mesure du texte), `verifier.py` (contrôles image par image, aperçu, haut de la tête), `gestes.json`
  (couches, effet sur le plan et sons de chaque gabarit).

Dans les commandes ci-dessous, `SK` = le dossier de ce skill, `M` = le dossier `<nom>-montage` de la vidéo.

## Le format des demandes

Les demandes sont dans `M/plan-montage.json`, clé `animations`. Leur format (`id`, `geste`, `intention`, `de`, `a`,
`elements`, `reglages`, `photos`, `sa_ligne`, ancres) est dans `../plan-montage/references/format.md`, source unique :
lis sa section « Une demande d'animation ». Ce qui compte ici : les calques prennent le préfixe de l'`id` (`a03`, ou
`a01-derriere` / `a01-devant`) ; `photos.fichier` à `null` pose un emplacement « image à fournir » ; une transition n'a
que `de` (le premier mot après la coupe) et pas d'`elements`.

## Le déroulé

### 1. Caler le plan
```
node "$SK/scripts/caler.mjs" "$M"
```
- `EXÉCUTABLE` : `M/animations/plan-resolu.json` contient chaque ancre en secondes et en images. Passe à 2.
- `REFUSÉ` : la liste **complète** des refus, chacun avec son code (`ANCRE_INTROUVABLE`, `ANCRE_AMBIGUE`,
  `CHIFFRE_NON_DIT`, `INTENTION_FLOUE`, `GESTE_INCONNU`, `CONTENU_MANQUANT`, `PAS_DE_COUPE`…). Ici, tu ne complètes rien :
  ces lignes retournent à l'étape plan (skill `plan-montage`), qui corrige le plan ; si la correction change ce que
  Romain a validé, on le lui redit. Les demandes non refusées peuvent avancer.
- `AVERTISSEMENT PHOTO_A_FOURNIR` : l'emplacement sera posé et la photo demandée à Romain.
- `AVERTISSEMENT MEME_A_TELECHARGER` : image de réaction (`quoi` commence par « à télécharger par le monteur ») : c'est
  le monteur qui la trouve et la télécharge (le mème exact nommé), dans `M/animations/images/`, puis la pose (exemple
  dans `CONTRAT.md`, « Poser une image dans un sur-mesure »). Jamais demandée à Romain.
- `AVERTISSEMENT STYLE_GAGNE` : le plan demande ce que le style ne permet pas (réglage que le gabarit ne prévoit pas,
  valeur hors style, durée que le style fixe : hook pavés 2 s). **Le style gagne** (contrat, « Plan contre style ») :
  la demande reste exécutable, tu appliques ce que `plan-resolu.json` donne (`reglages` = réglages à passer dans `P`,
  `duree_style` = durée en images), jamais la valeur du plan. Le script l'a écrit dans `M/remarques-plan.md` (trace) ;
  à l'étape plan, le monteur corrige son plan avec la valeur du style.

### 2 bis. L'accroche (geste `accroche`) : composée, jamais instanciée
Le plan donne sa disposition (`composition` et `elements` avec rôle, place, alignement, taille, entrée : format dans
`../plan-montage/references/format.md`). Après le calage et la brique zooms (le dézoom d'ouverture écrit `M/ouverture.json`) :
```
node "$SK/scripts/accroche.mjs" "$M" --video "<vidéo coupée>"
```
- La signature est tenue par le script : police, casse, un seul orange, ouverture en dézoom, trois temps, rien avant le
  mot, tout en capitales, des tailles proches (`TAILLE`, 1,6 fois au plus entre deux voisins), aucun mot sauté depuis son
  premier mot (`LECTURE`), départ dès qu'il dit un mot qu'elle n'affiche pas, tick sur le mot fort et clac sous chaque
  relance (`sons_suggeres`).
- Il mesure le haut de sa tête sur la vidéo coupée (mot derrière lui), place chaque élément, vérifie la zone sûre et que
  les éléments ne se chevauchent pas, puis écrit `calques/a01-derriere` (voile, mot derrière lui qui dézoome avec la
  caméra) et `calques/a01-devant`, `M/accroche.json` (la composition retenue) et la ligne du registre.
- Il contrôle aussi qu'elle se lit comme une phrase (`LECTURE` : phrase de tête de 3 mots au moins, ses mots exacts,
  aucun mot dit sauté depuis son premier mot, sauf `titre_reformule`) et que rien ne couvre ses yeux ni sa
  bouche (`VISAGE`, ses yeux mesurés toutes les 10 images, `lib/visage.py`). `--video` est obligatoire.
- **Pendant l'accroche, pas de sous-titres** (Yoan, 2026-11-20) : ses calques sont marqués `masque_sous_titres`, son
  texte les remplace. Le calque devant qui porte un pavé orange le déclare aussi (`oranges`) ; `verifier.mjs <dossier>
  --mots` refuse deux oranges à la même image sur toute la vidéo (`ORANGE_DOUBLE`).
- **Substitution** (`type: substitution`) : un élément qui porte `remplace` prend l'emplacement de l'élément remplacé
  (même haut de lettres, même alignement, même taille, même pavé) ; sur l'attaque de son mot, l'ancien part vers le haut
  en 0,1 s et le nouveau monte à sa place en 0,18 s (`ACCROCHE.remplace`). Contrôles : `REMPLACE` (élément nommé,
  même rôle, une seule substitution par emplacement, pas derrière lui), `CHEVAUCHEMENT` (le nouveau ne touche aucun
  élément affiché en même temps que lui), `LECTURE` (le premier exemple se lit comme une phrase).
- Un plan filmé (`b_roll`) ou un écran « B-ROLL » (`plan-a-filmer`) qui commence pendant l'accroche l'arrête à sa
  coupe, dès 2,8 s (`ACCROCHE.fin.plan`) : le plan prend le relais.
- Refus (code 2) : `TROIS_TEMPS`, `SANS_OUVERTURE`, `LECTURE`, `VISAGE`, `HORS_ZONE`, `CHEVAUCHEMENT`, `TROP_LARGE`, `ACCENT_DOUBLE`… : c'est
  la disposition du plan qui change (un autre mot, une autre place, une taille plus petite), puis caler et relancer.
  `RÉPÉTITION` (code 4) : la même accroche qu'une des deux dernières vidéos ; change la place, l'entrée ou le mot.
- Puis `verifier.mjs` sur `a01-derriere` et `a01-devant` (avec `--video`), et regarde leurs planches.

### 2 ter. Les gestes composés du corps (`plein-ecran-visage`, `partout`, `plan-a-filmer`)
Comme l'accroche, ils ne s'instancient pas : leur script les compose à partir de la demande calée (format dans
`../plan-montage/references/format.md`, README de chaque geste dans `bibliotheque/`), puis `verifier.mjs` et la planche.
```
node "$SK/scripts/plein-ecran-visage.mjs" "$M" <id> --video "<vidéo coupée>"   # la phrase à retenir, qui commence sur lui
node "$SK/scripts/partout.mjs" "$M" <id>                                       # la multitude
node "$SK/scripts/plan-a-filmer.mjs" "$M" <id>                                 # l'écran « B-ROLL » d'un plan qui manque
node "$SK/scripts/texte-sur-lui.mjs" "$M" <id> --video "<vidéo coupée>"        # animation légère sur la caméra
```
- `plein-ecran-visage` : mesure le haut de sa tête (`--video`), pose le titre au-dessus, puis un flash sur tout l'écran
  sauf le titre (un trou autour de son encre) et le fond uni ; le titre garde place, taille et couleur (craie), les
  points prennent sa couleur ; sortie par un flash ; un clic à chaque flash. Refus : `TROP_TOT` (le
  titre doit se lire 0,8 s sur lui), `TROP_LONG` (5,5 s au plus sans lui), `POINTS`, `FIGURE_INCONNUE`, `HORS_ZONE`.
- `partout` : le mot fixe (le sien) sur son surligneur, des captures d'articles sur téléphone en coupes sèches, flash
  d'entrée et clic. Refus : `MOT_NON_DIT`, `PAGES`, `CHIFFRE_NON_DIT`, `TROP_COURT`.
- `plan-a-filmer` : écran charbon, « B-ROLL » et ce qu'il faut filmer, sur toute la phrase ; ses sous-titres restent.
  Refus : `QUOI_FLOU`, `QUOI_LONG`. Le monteur le liste dans son compte rendu (« à filmer »).
- `texte-sur-lui` : ses mots en capitales au-dessus de sa tête (ou sous son visage), sur sa voix, une ligne barrée pour
  une opposition ; ses sous-titres restent. Refus : `PLACE`, `VISAGE`, `TAILLE`, `LECTURE`, `OPPOSITION`, `FORME`.
- Ils effacent ce qu'il faut des sous-titres d'eux-mêmes (`masque_sous_titres`, sauf `plan-a-filmer` et `texte-sur-lui`).
- Le calage contrôle la densité (`DENSITE`) : 15 s au plus sans temps fort, au moins une animation sur la caméra dans le
  dernier tiers.

### 2. Pour chaque demande : gabarit ou sur mesure
La bibliothèque est une **vitrine du vocabulaire**, pas un catalogue.
- **Le gabarit colle** quand le geste demandé existe et que la demande tient dans sa forme : même nombre d'éléments,
  même disposition, textes qui tiennent dans la zone sûre. On adapte alors textes, instants, réglages, tailles mesurées,
  photos (étape 3a).
- **Sur mesure** quand le plan dit `sur-mesure`, ou quand le gabarit ne tient plus : nombre d'éléments différent (liste
  de 5, tier list de 3, comparaison de 2 photos), disposition qui doit changer, gabarit marqué `recomposer` dans
  `gestes.json` (comparaison, angle-coude, recherche-google : instants écrits en dur). On compose alors l'effet avec
  la boîte à outils en reprenant les gestes des gabarits (étape 3b).
- Dans les deux cas : **aucune valeur hors du style**. Couleurs, polices, tailles, rayons, ombres, courbes, durées,
  zone sûre viennent de `commun.mjs`. `verifier.mjs` refuse une couleur, une police, une courbe ou un rayon qui n'y est pas.

### 3a. Instancier un gabarit
Écris `M/animations/params/<id>.json` puis :
```
node "$SK/scripts/instancier.mjs" "$M" "$M/animations/params/<id>.json"
```
Les paramètres (détail en tête de `instancier.mjs`) :
- `gabarit`, `couche` (`devant` ou `derriere` ; un gabarit à deux couches = deux calques), `ordre` (10 à 40 ; 100 et plus
  réservés aux sous-titres ; les transitions au-dessus des cartes).
- `debut` : image de la vidéo coupée, ou `{ "mot": "<ancre>", "avance_s": 0.2 }`. `images` : nombre, ou
  `{ "jusqua": "<ancre>", "apres_s": 0.6 }`. **La fenêtre du calque = la fenêtre de l'effet** : un plein écran flou
  commence à l'image où son fond s'affiche et finit à sa sortie, car l'effet sur le plan dure tout le calque.
- `T` : les instants du gabarit (lis le bloc `T` du gabarit et ses commentaires). Valeurs : secondes du calque,
  `{ "entree": "<ancre>" }` (l'attaque, 0,1 s avant le début transcrit, pour une apparition), `{ "set": "<ancre>" }` (image de l'attaque, pour un
  élément qui s'affiche d'un coup), `{ "fin": "<ancre>" }`, `{ "image": n | "fin" }`, `{ "video": n }`,
  `{ "coupe": "<ancre>", "plus_s": -0.067 }` (la coupe juste avant ce mot), `{ "pave": "<ancre>" }` (l'image de
  l'attaque : le pavé orange de la ligne « commente MOT » des CTA glisse du mot d'avant sur le mot, comme dans les
  sous-titres ; obligatoire pour l'instant commenté « pavé sur le mot », sinon `instancier.mjs` refuse).
- `recaler` : `[[instant du gabarit, "<ancre>"], ...]` décale chaque groupe d'instants du gabarit sur son mot (tous les
  instants d'un élément suivent ensemble). C'est le plus simple pour les gabarits à beaucoup d'instants (tier list,
  liste, carte de séance). Les bascules visible / caché retombent pile sur une image.
- `textes` : `{ "#id": "texte" }` ou `{ ".classe@n": "texte" }`, ou `{ "#id": { "mots": "<ancre>" } }`
  pour écrire ce qu'il dit tel que les sous-titres l'écrivent (corrections et mots masqués de `sous-titres.json` s'il
  existe, sinon `words.cut.json` ; ponctuation autour retirée ; `casse` : `telle` par défaut comme les sous-titres,
  `basse` ou `haute`). Sur une ligne de sous-titre du gabarit (`#st`, `#st0`…), l'attaque de chaque mot est écrite avec
  (`data-attaques`) : le pavé y glisse de mot en mot, et la ligne prend le style, la taille et la position des
  sous-titres de la vidéo.
  `styles` : `{ "#id": { "font-size": "…px" } }`.
- `apparition` : `{ "#id": h }` quand la taille d'un élément change (h = hauteur des capitales en px, donnée par
  `mesure.py`) : montée, flou et durées de l'apparition sont recalculés selon la recette.
- `P` : les réglages du gabarit, ceux de `plan-resolu.json` (`reglages`) : un réglage inconnu ou hors des valeurs du
  gabarit est refusé ; une durée plus longue que celle du style est ramenée au style (`STYLE_GAGNE`). `photos` : `{ "a0": { "fichier": "…" } }` ou `{ "a0": { "a_fournir": "…" } }`.
- `plan` : déduit du gabarit (`gestes.json` : plein écran `flou`, cartes de séance sur flou, minuteur barre sur flou
  fort, demi-écran décalé, fond vert détouré). `"plan": null` pour l'enlever si le plan de montage le dit.

Mesures de texte (police réelle, crénage compris) :
```
python3 "$SK/scripts/lib/mesure.py" geant "<mot>"            # taille, left : encre sur toute la zone sûre ; cap ; haut_encre
python3 "$SK/scripts/lib/mesure.py" taille texte <cap>        # taille de police pour des capitales de <cap> px
python3 "$SK/scripts/lib/mesure.py" lignes "<l1>" "<l2>"      # plein écran : même largeur d'encre, bloc centré à y 960
python3 "$SK/scripts/lib/mesure.py" encre texte 52 "<texte>"  # largeur d'un texte à une taille
python3 "$SK/scripts/lib/verifier.py" tete "<vidéo coupée>" <image> <nb>   # haut du crâne de Romain sur ces images
```
**Police unique** (STYLE.md, 2026-11-14) : tous les textes sont en `POLICES.sousTitres` (Inter Black), `.ti` pour les
capitales, `.tx` pour les minuscules ; `mesure.py` mesure avec elle (approche comprise). Seul un format natif recopié
garde sa police (calque `origine.natif`, ou partie `data-natif`).
**Captions** (STYLE.md, « Captions ») : un texte qui dit sa phrase au fil de sa voix (sous-titre enrichi, plein écran
texte) porte `data-captions` sur son conteneur ; sur une même ligne, tous ses mots ont la même taille et la même
police, ce qui ressort prend sa propre ligne. `verifier.mjs` refuse une ligne mêlée (`LIGNE`). Les autres textes (mot
géant, chiffre, carte) gardent leurs tailles.
Mot géant derrière lui : bas des capitales 30 % de `cap` sous le haut du crâne (`top = tete + 0,3 cap - base_dans_boite`) ;
les petits mots au-dessus gardent 16 px entre leur ligne de base et le haut de l'**encre** du mot géant (accent compris).

### 3b. Composer un effet sur mesure
Copie `scripts/exemple-sur-mesure.mjs` en `M/animations/sur-mesure/<id>.mjs`, réécris-le pour la demande, puis
`node "M/animations/sur-mesure/<id>.mjs" "$M" "$SK"`. La boîte à outils (`scripts/lib/style.mjs`) donne : `S` (toutes les
constantes), `resoudre` (ancres), `Couche` (calque, `app` = apparition v2 sur un mot, `accent` = montée du bas en saccade
12 i/s, accent rare, `montre` / `cache` à l'image), `texteSousTitres` (ses mots tels que les sous-titres les écrivent,
corrections comprises), `groupesSousTitres` + `blocSousTitres` (une phrase affichée en sous-titres dans l'effet :
mêmes groupes, instants et apparition que la brique), `caseCocheeSvg` / `caseCocheeJs` (case qui se remplit et se coche),
`CSS_CARTE` (carte + onglet des gabarits), `voileCss`, `cap` et `mesure`, `son` (son suggéré), `planFlou`,
`decalageDemi`, `ecrireCalque`. Méthode :
1. Relis le gabarit le plus proche et reprends ses gestes tels quels (apparition, pas du minuteur, ligne en cours des
   cartes, trait qui se trace du schéma, vignette qui se pose de la tier list…) : on recompose, on n'invente pas de geste.
2. Chaque élément sur **son** mot (entrée = attaque - `AV`), jamais tout le bloc d'un coup ; sans attaque nette,
   `APPARITION.ecartRef` entre deux éléments.
3. Un seul accent orange par image ; texte charbon sur l'orange ; jamais de linéaire, de rebond, de pop ni d'échelle sur
   un texte ; zone sûre x 91-990, y 237-1479.
4. **Qualité (Yoan, 2026-11-12, tests v3 et v4 : « ça fait cheap »)**, détail dans `STYLE.md` (« Animations sur
   mesure : qualité et placement ») :
   - ce qui existe se reproduit à l'identique (le calendrier = l'appli Calendrier d'Apple, vue mois), posé comme un
     écran, jamais suspendu dans le vide ; `origine.natif: true` dans `calque.json` pour garder ses vraies couleurs ;
   - ce qu'on invente est minimaliste : texte qui arrive comme les sous-titres mais mis en forme comme un titre
     (capitales sur les mots qui portent le sens, soulignage orange) en haut et en bas, une seule police, des tailles
     qui varient **d'une ligne à l'autre, jamais dans une même ligne** (`data-captions`), et le **comportement de
     sous-titres** : chaque mot arrive sur son attaque, jamais avant, peut rester plus longtemps, et tous les mots de
     l'effet repartent ensemble sur la voix (fin de phrase ou début de l'idée suivante) ; une ou deux
     formes nettes aux `COULEURS` qui portent ses mots (brique qui s'emboîte dans une autre) ; jamais de personnages,
     de fausse 3D, de décor, de pictos ;
   - les marques à main levée (cercle, coches, soulignage) se tracent seules, sans stylo ni main à l'écran ;
   - mouvements avec inertie ; `COURBES.ressortObjet` pour les objets et personnages, jamais sur un texte ;
   - une chose réelle peut se poser sur la caméra, à côté de lui ou derrière sa tête (couche `derriere`) ; jamais sur
     son visage ; les sous-titres restent ;
   - une scène de la vie est un B-roll filmé par Romain (brique b-roll), pas une animation ; jamais de B-roll généré.
5. Note dans `attendus` chaque élément calé (avec `mot_image`) et dans `sons_suggeres` les sons du geste.
   - **Ses mots affichés** : passe à `ecrireCalque` `mots_repris` (les numéros des mots qu'il dit et que l'effet écrit,
     `["w23-w25"]`) : ils sortent des sous-titres, chaque mot n'est vu qu'une fois (Yoan, 2026-11-14). Les sous-titres
     enrichis arrivent en « coup de poing » par ligne (`apparitionLigneJs` sur le conteneur de la ligne : toute la ligne à
     l'attaque de son premier mot, une seule échelle 1,3 -> 1 en 0,2 s, origine 50 % 70 % ; soulignage `SOULIGNE`) ; les pleins écrans texte
     posent chaque mot d'un coup à son attaque (`c.montre`). La montée du bas
     (`c.accent(sel, attaque)` : 40 px, 0,4 s, toujours en saccade 12 i/s) est un accent rare pour faire ressortir
     une phrase, un ou deux moments par vidéo (STYLE.md, « Montée du bas »). Une citation s'affiche sans guillemets.
   - **Titre derrière lui avec le dézoom d'ouverture** : le dézoom de la caméra est fait par la brique zooms (type
     `ouverture`, préparée avant les animations) ; elle écrit `M/ouverture.json`. Le titre le suit : `transform-origin`
     sur `ancre_1080x1920`, et à chaque image n de 0 à `images`, `scale` = `echelle_depart - (echelle_depart - 1) * n /
     images` (un `tl.set` par image), puis 1. Le titre se compose **à 100 %** comme le gabarit (mot géant dont l'encre
     couvre la zone sûre) : pendant le dézoom il grossit et dépasse, c'est voulu ; ne le réduis pas pour qu'il tienne à
     120 %. Passe `suit_ouverture: true` à `ecrireCalque` : `verifier.mjs` contrôle alors la zone sûre à partir de
     l'image où le dézoom est fini (`images` de `ouverture.json`), et refuse un titre qui part avant.
   - **Un objet qui sort du cadre exprès** (pièce qui tombe, post-it qui glisse, objet qui entre par le bord) porte la
     classe `objet` : le contrôle de zone sûre ne le compte pas. Jamais sur un texte.
   - **Un format réel reproduit** (`origine.natif: true`) garde ses couleurs, ses coins arrondis et la police système
     d'Apple (rendu sur le Mac de Romain) ; tout autre calque reste dans les polices, couleurs et rayons du style.
6. Écris dans `origine` l'intention et les gabarits dont tu reprends les gestes : le rapport au monteur les cite.
L'effet sur mesure vit avec la vidéo ; il n'entre pas dans la bibliothèque (seul Yoan en décide).

### 4. Vérifier, et regarder
```
node "$SK/scripts/verifier.mjs" "$M" <id> --video "<vidéo coupée>"
```
Contrôle le style (une seule police), les captions (`data-captions` : même ligne, même taille et même police, toutes
les couches de la même demande ensemble, image par image), lance le lint,
rend le calque (`M/animations/verif/<id>/calque.mov`, plus un rendu « encre » sans les
fonds), mesure image par image : encre dans la zone sûre, les 4 coins de l'encre, arrivées des éléments et calage
(**jamais avant son mot**). Avec `--video`, pose le calque sur la vidéo coupée (plan flou, décalé ou détouré appliqué,
couche derrière trouée par le masque de Romain) : `apercu.mp4` et `planche.png`.
- `PROBLÈME …` : corrige et relance. `NOTE …` : à regarder sur la planche.
- **Regarde toujours la planche avec l'outil Read** avant de déclarer un calque prêt : style, calage, texte lisible,
  rien sous son visage qui gêne, accents entiers. Un contrôle chiffré qui passe ne suffit pas.
- Pas de vidéo coupée à disposition (le rendu n'est pas encore passé) : fabrique-la pour le contrôle avec le filtre de
  couper-silences (`ffmpeg -i <rush> -filter_complex_script M/filtre.txt -map "[v]" -map "[a]" …`, mise à 1080 x 1920),
  sans la livrer : la vidéo finale vient de la brique rendu, en un seul passage.

### 5. Écrire calques.json
```
node "$SK/scripts/calques.mjs" "$M"
```
Réécrit seulement les entrées `source: "animations"` (une par dossier `M/calques/<id>/` qui a un `calque.json`), garde
celles des autres briques, refuse deux effets sur le plan qui se chevauchent. `--retirer <id>` pour en sortir un.

### 6. Rendre la main au monteur
Rapport court : calques écrits (id, images, couche, plan), demandes refusées et pourquoi, effets sur mesure (intention,
gestes repris), photos à demander à Romain, et les **sons suggérés** (champ `sons_suggeres` de chaque calque, au format de
`sons.json`). Tu ne poses aucun son : c'est le sound design.

## Gestes, couches et sons

| Geste | Couche | Plan | Sons que le style associe |
|---|---|---|---|
| accroche (composée, `accroche.mjs`) | derriere + devant | | tick sur le mot fort, clac sous chaque relance |
| plein-ecran-visage (composé) | devant | | clic quand le fond monte |
| partout (composé) | devant | | clic au flash d'entrée, petit clic à chaque écran |
| plan-a-filmer (composé) | devant | | aucun |
| hook-paves, plein-ecran-orange, liste, schema, carte-chapitre, carte-presentation, carte-nutrition, broll-annote, anatomie | devant | | aucun |
| transition-flash | devant | | clic sur l'image de la coupe |
| hook-titre-derriere | derriere | | tick quand le mot géant passe 50 % |
| hook-question | devant | | tick quand le sujet passe 50 % |
| hook-mot-geant, cta-mot-derriere | derriere + devant | | tick quand le mot géant passe 50 % |
| hook-chiffre, carte-chrono, tampon-verdict | devant | | tick quand le chiffre / le tampon passe 50 % |
| cta-champ-instagram | devant | | une frappe par lettre (t1 à t4 tournantes) |
| recherche-google (recomposer) | devant | | une frappe par lettre, Entrée |
| transition-faisceau | devant | | déclencheur sur l'image de la coupe |
| demi-ecran | devant | décalage du visage | sortie faisceau : déclencheur ; bascule : aucun |
| plein-ecran-fond | devant | flou si `fond: flou` | aucun |
| minuteur-chiffres / minuteur-barre | devant | rien / flou fort | aucun |
| carte-seance, carte-superset, carte-fiche-exercice | devant | flou | aucun |
| comparaison (recomposer), tier-list | devant | | clic à chaque photo qui se pose |
| angle-coude (recomposer) | devant | | aucun |
| fond-vert | derriere | détouré | aucun |

Niveaux (STYLE.md « Sons et niveaux ») : faisceau 9 LU sous la voix, tick 8 LU, clic RMS 14 dB (photo et transition),
Vine boom 12 LU (image de réaction : `son('meme', image)`), frappe RMS 23 dB, Entrée 17 dB. Jamais de son sur un zoom ni
sur les sous-titres. Un effet sur mesure suggère `son('transition', …)` pour un flash qu'il porte, `son('meme', …)` pour une
image de réaction. Les sous-titres et les zooms ne passent pas par ce skill.

## Pièges vus en test (2026-11-11 au 2026-11-13)
- Un texte de gabarit qui contient d'autres éléments (chiffre + unité du hook chiffre : `#h1` = `#h1n` + `#h1u` ; totaux
  de la carte nutrition) se remplit morceau par morceau ; `instancier.mjs` refuse de le remplir d'un bloc (seul le
  chiffre changeait : « 12 » sortait « 12g »).
- `Couche.montre(sel, 0)` laissait l'élément caché sur la première image du calque : corrigé dans `lib/style.mjs`.
- Un dossier `calques/<id>` dont la demande n'est plus dans le plan (animation retirée ou renumérotée) n'entre plus dans
  `calques.json` : `calques.mjs` le signale, supprime-le. Un `params.json` repris d'un autre montage garde son `id` :
  vérifie-le avant `instancier.mjs` (il écrase le calque de cet id).
- Sans crénage, la mesure d'un mot géant était fausse de 39 px : `mesure.py` met le texte en forme comme le navigateur.
- Un accent sur la ligne du bas d'un plein écran (Î, É, Ç) touchait la ligne du dessus à l'interligne 0,84 :
  `mesure.py lignes` descend la ligne juste ce qu'il faut. Un accent du mot géant passait sous les petits mots du dessus.
- Le mot géant posé à la hauteur du gabarit restait au-dessus de sa tête : la hauteur se mesure sur **sa** tête.
- Compteur : une image sans chiffre à chaque pas si l'entrée part sur l'image du pas ; elle part 0,025 s avant (comme
  minuteur-chiffres).
- Pleins écrans (`plein-ecran-fond`, `plein-ecran-orange`), liste, minuteurs, schéma, recherche Google : tout l'écran est
  couvert par le texte qu'il dit ; les sous-titres le répétaient en petit dessous. Ils sont marqués
  `masque_sous_titres` dans `gestes.json` comme les gabarits à ligne propre : les sous-titres s'effacent pendant le calque.
  Un effet sur mesure plein écran passe `masque_sous_titres: true` à `ecrireCalque`, une recomposition aussi.
- CTA : le pavé orange de « commente MOT » s'allumait sur le mot dès que la ligne apparaissait, environ 5 images avant
  qu'il le dise. Depuis le 2026-11-13 il est sur « commente » quand la ligne apparaît et glisse sur le mot à son
  attaque, comme dans les sous-titres (`{ "pave": "<mot>" }`).
- Captions (2026-11-14) : « sur le » petit et « long terme » gros sur la même ligne, « pour toi » petit au bout de
  « CE QUI MARCHE » : rejetés par Yoan. Sur une même ligne, une taille et une police ; `verifier.mjs` le contrôle sur
  les textes `data-captions` (`LIGNE`). Le plafond de 1,5 fois appliqué le 2026-11-13 à tous les textes était une
  erreur de périmètre, retirée : les mots géants, minuteurs, cartes ont repris leur taille.
- Tier list, CTA mot derrière, champ Instagram : ces gabarits portent leur propre ligne de sous-titre, placée pour leur
  mise en page. Décision de Yoan (2026-11-11) : **c'est la ligne du calque qui reste**. `instancier.mjs` marque la couche
  qui la porte `"masque_sous_titres": true` (lu dans `gestes.json`, recopié dans `calques.json` par `calques.mjs`) et la
  brique sous-titres retire ses groupes pendant ce calque. Remplis chaque ligne avec `{ "mots": "<ancre>" }` (même
  orthographe que les sous-titres autour). `sa_ligne: "retirer"` du plan : vide toutes les lignes (`"#st0": ""`…) ;
  `instancier.mjs` ne marque alors pas le calque et les sous-titres de la vidéo restent pendant le calque.
  Un effet sur mesure qui porte sa propre ligne passe `masque_sous_titres: true` à `ecrireCalque` (et
  `texteSousTitres(dossier, ancre, mots)` de `lib/style.mjs` pour son texte). Ensuite : `sous-titres preparer`
  (relancé si les animations bougent), puis le rendu, qui refuse des sous-titres préparés avant ces calques.
- Les instants du gabarit tier list laissent 1,2 s par vignette ; des mots à 0,4 s d'écart font se chevaucher les
  gestes (ça reste lisible, mais regarde la planche).

## Ce que tu dis à Romain (s'il demande où en est le montage)
Français, tutoiement, zéro jargon, zéro nom d'outil, zéro nom de fichier. Exemples : « je pose les animations sur tes
mots », « il me manque une photo : une photo carrée de toi à l'entraînement », « le plan demande un chiffre que tu ne dis
pas dans la vidéo, je vérifie avec toi avant de l'afficher ». Une photo manquante se demande en disant ce qu'elle doit
montrer, jamais en inventant une image ou en en prenant une sur le web. Seule exception : l'image de réaction (mème) du
plan, que le monteur télécharge lui-même (`STYLE.md`) ; on ne la demande jamais à Romain.

## Dépendances
À installer sur le Mac de Romain par le prompt de réinstallation (rien n'est vérifié chez lui) :
- **Node.js 24** (`node`, `npx`) : scripts `.mjs` et HyperFrames.
- **HyperFrames 0.7.55**, toujours à cette version : `npx --yes hyperframes@0.7.55` (téléchargé au premier usage, il
  apporte son navigateur de rendu ; demande un accès Internet la première fois).
- **ffmpeg 7 ou plus** dans le PATH (Homebrew : `/opt/homebrew/bin/ffmpeg`) : lecture des rendus, aperçus.
- **Python 3** du système (`/usr/bin/python3`) avec `numpy`, `Pillow`, `fontTools`, `uharfbuzz` (mesure du texte avec
  crénage ; sans lui la mesure retombe sur fontTools, un peu trop large) et `pyobjc-framework-Quartz`,
  `pyobjc-framework-Vision` (masque de Romain pour les aperçus derrière lui et le haut de la tête) :
  `python3 -m pip install --user numpy pillow fonttools uharfbuzz pyobjc-framework-Quartz pyobjc-framework-Vision`.
- **macOS 12 ou plus** (Apple Vision, segmentation de personne).
- Briques en amont : `couper-silences` (`words.cut.json`, `edl.json`, `filtre.txt` dans `M`). En aval : `rendu` (pose les
  calques et applique `plan`), `sound-design` (lit `sons_suggeres`).
- Police (Inter Black, la seule de la vidéo, plus Roboto et Liberation Sans pour les formats natifs), GSAP, images d'emplacement et sons sont dans `bibliotheque/` (licences
  jointes) ; chaque calque embarque ses polices et GSAP, sans chemin absolu.
- Le contrôle des captions ouvre le Chrome de HyperFrames (`npx hyperframes@0.7.55 browser path`) : rien de
  plus à installer.
