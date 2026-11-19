---
name: rendu
description: Brique de l'agent monteur (pas un point d'entrée pour l'utilisateur). Fait l'aperçu de validation du studio (la vidéo montée jouée image par image, sans la fabriquer), la planche (vignettes de la vidéo montée) puis fabrique la vidéo montée en un seul encodage depuis la vidéo d'origine, en composant les couches préparées par les autres briques dans le dossier <nom>-montage (coupes, zooms, calques HyperFrames des animations et des sous-titres, B-rolls, sons), dans l'ordre du contrat du monteur. À appeler quand toutes les briques demandées ont fini leur préparation, et après chaque retouche d'une brique.
---

# Rendu

Brique appelée par l'agent monteur, jamais directement par Romain. Elle ne décide rien : elle pose ce que les autres
briques ont préparé, à l'image près, dans l'ordre du contrat (`../animations/CONTRAT.md`, « Ordre de composition »).
Ne lance jamais ffmpeg toi-même sur la vidéo : tout passe par la commande ci-dessous, toujours depuis l'originale.

## La commande
```
/usr/bin/python3 "<dossier de ce skill>/scripts/rendu.py" "<dossier>-montage" <couches>
```
avec un **timeout de 600000 ms**. `<couches>` : celles qui ont été demandées, séparées par des virgules, parmi
`coupes`, `zooms`, `b-roll`, `animations`, `sous-titres`, `sons` (par exemple `coupes,zooms,animations,sous-titres,sons`).
L'ordre n'a pas d'importance. `coupes` est obligatoire : toutes les positions sont en images de la vidéo coupée.
N'applique que les couches demandées : un fichier d'une autre brique qui traîne dans le dossier ne compte pas.

## Ce qu'elle lit
| Couche | Fichiers | Brique |
|---|---|---|
| coupes | `info.json`, `filtre.txt`, `edl.json` | couper-silences |
| zooms | `zooms.txt` (morceau de graphe posé tel quel : `[plan coupé]<zooms.txt>[plan zoomé]`) | zooms |
| b-roll | `b-roll.txt` | b-roll |
| animations, sous-titres | `calques.json` (entrées de cette `source`) et `calques/<id>/` | animations, sous-titres |
| sons | `sons.json` | sound-design |

Les constantes du style (étalonnage `ETALONNAGE`, niveaux de la voix, plafond de crête) et les sons viennent de la
bibliothèque `../animations/bibliotheque/` (`commun.mjs`, `sons/`). Pour un test hors du dépôt installé, la variable
`RENDU_BIBLIOTHEQUE` peut pointer vers une autre copie de la bibliothèque.

## Le style de cette vidéo (`style-video.json`)
Le style du client est le défaut. Quand la personne demande une autre image pour **cette vidéo** (moins chaude, plus
claire, plus contrastée...), le monteur l'écrit dans `<nom>-montage/style-video.json`, jamais dans le style :
```json
{ "pourquoi": "19/11, ses mots : « trop sombre et orangé, juste une petite touche chaude »",
  "etalonnage": "colortemperature=temperature=5800:mix=0.30,eq=contrast=1.02:saturation=0.98" }
```
- `etalonnage` remplace celui du style ; `etalonnage_en_plus` s'ajoute après (ex. `"eq=brightness=0.04"` : un peu plus
  clair). Chaînes de filtres ffmpeg ; une chaîne fausse est refusée tout de suite (`STYLE_VIDEO_ETALONNAGE_FAUX`, code 3).
- L'étalonnage du style se lit avec `STUDIO_CLIENT=<client> node -e "import('<SK>/animations/bibliotheque/commun.mjs').then(m=>console.log(m.ETALONNAGE))"`.
  Pour l'adoucir, pars de lui et baisse ses réglages (chez Yoan : `mix` de `colortemperature` vers 0,3, `saturation`
  de `huesaturation` vers -0,15, retire `vignette` pour moins sombre) ; pour revenir à la couleur d'origine :
  `"etalonnage": "null"`.
- Le rendu, l'aperçu et la planche le lisent tous les trois : l'aperçu montre exactement l'image du rendu. Après un
  changement, relance seulement l'aperçu (l'image de la caméra est refaite seule). `rendu.json` note
  `etalonnage_video` quand il a servi.
- Sans fichier (ou sans ces clés) : l'étalonnage du style, rien ne change. La clé `style` du même fichier est pour les
  sous-titres et les animations (voir leurs SKILL.md).

## Ce qu'elle fait, dans l'ordre
0. **Vidéo d'origine** : celle qui est à côté du dossier de montage (`<nom>.<ext>` à côté de `<nom>-montage`), sinon le
   chemin de `info.json`. Une vidéo **HDR** (iPhone : HLG ; ou PQ) est convertie en SDR bt709 à l'entrée du graphe, dans
   le même passage : table 3D écrite une fois dans `rendu-cache/` (lumière de scène, blanc de référence 203 nits posé au
   blanc SDR, hautes lumières compressées au-dessus d'un genou à 75 %, primaires bt2020 vers bt709). Une vidéo à 60 i/s
   ou à cadence variable est remise à 30 i/s par les coupes (`filtre.txt`). Un clip B-roll HDR est converti de même.
1. **Plan caméra** depuis l'original : coupes, zooms (à la définition de l'original, comme la brique zooms les écrit),
   instants remis en images exactes (base 1/30) juste après les zooms, mise à 1080 x 1920, décalage du demi-écran (`plan.decalage_y`), étalonnage « contrasté net », puis flou
   et assombrissement du plein écran sur sa vidéo (`plan.flou`).
2. **Calques `derriere`** : chaque image du calque est trouée par le masque de Romain (Apple Vision, qualité
   « accurate », calculé sur le plan coupé et zoomé non étalonné, resserré 0,40 à 0,80 comme le labo). Au-dessus du
   menton, le masque est borné à sa tête (cadre du visage Apple Vision, lissé d'une image à l'autre) : un objet qui
   touche sa silhouette (le manteau accroché au mur, un support) ne troue plus le titre derrière lui. Avec
   `plan.detoure`, le calque est le fond complet et Romain détouré est posé dessus : masque lissé sur 3 images,
   resserré 0,35 à 0,85, bord adouci, contour rogné d'un px, et bord décontaminé (repris de `vert21.py` du labo,
   renforcé) : sur toute la bande du contour, la couleur est remplacée par la moyenne floue des couleurs de l'intérieur
   sûr de Romain (masque à 0,97 et plus, rogné de 2 px de plus, car le masque Apple Vision déborde d'un ou deux px sur
   le mur). Plus de liseré clair quand le mur derrière lui est clair.
   Tous les effets sur le plan (décalage, flou, détouré) avancent au pas du plan caméra, de l'image 0 à la fin, actifs
   seulement sur les images de leur calque : jamais de branche découpée (`split` + `trim`) qui ferait garder en mémoire
   au plan principal toutes les images d'avant le calque (ffmpeg figé ou vidéo tronquée). Les entrées des calques et
   des masques sont recalées en images exactes (base 1/30) : un masque décalé d'une image redonne un liseré.
3. **B-rolls**, par-dessus l'image, chacun sur ses images exactes (première et dernière comprises).
4. **Calques `devant`** par `ordre` croissant, les sous-titres toujours en dernier.
5. **Son** : voix de la vidéo coupée normalisée en deux passes (-16 LUFS, crête -1,5 dBTP, LRA 11, mesurée canal par
   canal), plus chaque son de `sons.json` posé pour que son début d'attaque tombe pile sur son image, au niveau demandé
   (`lu_sous_voix` ou `rms_db_sous_voix`, mesures du labo). Crête du mix sous -1 dBFS : la voix est déjà à -1,5 dBTP,
   donc un son posé sur un pic de voix dépasse d'un rien ; un limiteur de crête ne baisse le gain que là (anticipation
   2 ms, retour 60 ms, `limiteur_db` et `limiteur_ms` dans `rendu.json`). Au-delà de 3 dB à retirer : arrêt
   (`MIX_SATURÉ`). L'écoute du sound design utilise la même voix et le même limiteur : elle dit ce que le rendu fera.
6. **Un seul encodage** : H.264 yuv420p bt709, toujours en 1080 x 1920 (définition d'Instagram ; une 4K garde sa
   finesse dans les zooms, faits avant), AAC 192 kb/s 48 kHz, faststart, 30 i/s. **Poids sous le plafond du style**
   (`RENDU.fullMaxMo`, 250 Mo, sous les 300 Mo d'Instagram) : qualité constante (crf `RENDU.crf`, 17) plafonnée par un débit vidéo maximal tiré de la
   durée (250 Mo x 0,94 / durée, moins le son, et `RENDU.fullMaxMbps` au plus), preset slow. Test v9 (52 s) : 14,4 Mo au
   lieu de 31 Mo, SSIM 0,988 et PSNR 41,5 dB contre la v8 en crf 17 sans plafond, aucun écart visible. Mais l'ancien plafond de 20 Mo
   écrasait les vidéos longues (2026-11-19 : 175 s rendues à 0,38 Mb/s, visage et barbe baveux) ; à 250 Mo, une vidéo de 3 min
   garde la qualité constante (environ 7 Mb/s pour un face caméra).
7. **Contrôle final obligatoire** avant `PRÊT` : nombre d'images du mp4 (ffprobe `-count_frames`) = images de la vidéo
   coupée, et durée du son à 0,1 s près ; sinon `RENDU_INCOMPLET` et rien n'est livré.

Chaque calque HyperFrames est rendu une fois (`npx hyperframes@0.7.55 render . --format png-sequence -w 1 -q high`,
suite de PNG RGBA, sans perte) et gardé dans `<dossier>-montage/rendu-cache/calques/<id>-<empreinte>/` avec les masques
du détourage : une retouche qui ne touche pas un calque ne le refait pas. Ces fichiers ne servent qu'au calcul ; l'image
caméra n'est encodée qu'une fois. Après un rendu réussi, le cache est nettoyé : il ne garde que la version à jour des
calques et des masques de `calques.json` (anciennes versions, calques retirés, bande son et journaux supprimés ;
`rendu.json` donne `cache_mo` et `cache_libere_mo`). Le cache se supprime sans risque (il se refait).

Format du cache (mesures du 2026-11-11, rush de test 52 s, mêmes calques ; `écart` = écart moyen de l'image finale
non compressée, en niveaux sur 255) :

| Cache des calques | Poids | Temps HyperFrames | Image |
|---|---|---|---|
| mov ProRes 4444 (avant) | 264 Mo pour 5 animations (128 Mo pour 3 s plein cadre), 171 Mo pour les sous-titres | 70 s (sous-titres) | référence |
| suite de PNG (maintenant) | 39 Mo pour les 5 animations, 67 Mo pour les sous-titres | 65 s (sous-titres) | sans perte : 0 écart avec ce que le navigateur dessine |

Essayés et écartés : qtrle (sans perte, 28 Mo pour les sous-titres mais plus lourd que le PNG sur les calques plein
cadre), FFV1 (sans perte, 43 Mo), ProRes 4444 qscale 11 (130 Mo, écart jusqu'à 14 niveaux), webm VP9 alpha (1,4 Mo
mais avec perte : 18 niveaux au pire, alpha faux de 14, et ffmpeg ne lit son alpha qu'avec `-c:v libvpx-vp9`).
Effet de bord voulu : les calques PNG passent par la matrice bt709 du reste de la chaîne. Avec le ProRes, HyperFrames
encodait en bt601 non marqué : l'orange du style sortait à (252, 100, 30) au lieu de #F15A24 (241, 90, 36) ; il sort
maintenant à (240, 88, 34). Le plan caméra bouge aussi d'un niveau en moyenne (même raison), invisible.
Piège : HyperFrames écrit en RGB les images sans transparence et en RGBA les autres ; le rendu lit donc les PNG avec
`-reinit_filter 0` (sans lui ffmpeg reconstruit son graphe en route et la vidéo s'arrête sans erreur).

## L'aperçu, la validation dans le studio
Dans le studio, la personne valide son montage sur l'aperçu : sa vidéo montée jouée dans le fichier Montage, image par
image, son compris, sans être fabriquée. Elle y écrit ses corrections (note, zone entourée) qui arrivent au monteur ;
« Fabrique la vidéo » lance le rendu, toujours un seul encodage depuis l'originale.
```
/usr/bin/python3 "<dossier de ce skill>/scripts/apercu.py" "<dossier>-montage" [couches]
```
Timeout 600000 ms. Couches par défaut : tout ce qui est préparé (coupes, zooms, b-roll, animations, sous-titres, sons) ;
le rendu final se fait ensuite avec la liste « couches » de `apercu/apercu.json`. Mêmes erreurs que le rendu
(`SOUS-TITRES_PÉRIMÉS`, `MIX_SATURÉ`...), plus `ZOOMS_A_REFAIRE` (code 8 : `zooms.txt` sans `zooms-donnees.json` à jour,
relance `zooms preparer`) et `APERÇU_RATÉ` (journal `apercu/erreur.log`).

**Ce qu'il fabrique**, dans `<dossier>-montage/apercu/` (rien n'est livré, tout se refait sans risque) :
- `camera-<clé>.mp4` : la vidéo coupée légère (720 x 1280, 30 i/s, une image clé toutes les 10 images) : coupes, HDR
  converti, mise en 1080 x 1920 et étalonnage du style, comme le rendu, faite une fois (60 s environ pour une minute) ;
  son = la bande son du rendu (voix normalisée et sons, même fonction), refait seul quand `sons.json` change (secondes) ;
- `b-roll-<k>-<clé>.mp4` : chaque B-roll sur ses images, à sa vitesse et à son cadrage ;
- `masques/<id>-<clé>/NNNN.png` : pour un calque derrière la personne, son masque par image en 216 x 384 (même calcul
  que le rendu, gardé dans `rendu-cache/masques/` : le rendu le reprend sans le refaire) ;
- `apercu.json` : ce que le lecteur joue (format dans le contrat du studio, section 16).
Zooms (`zooms-donnees.json`), décalages et flous restent des données, joués par le lecteur ; les calques HyperFrames
sont joués tels quels (aucun rendu HyperFrames). Une retouche : refais la brique, relance `apercu.py` (quelques
secondes), le studio recharge l'aperçu à la même image.

**Écarts connus avec la vidéo fabriquée** (l'aperçu affiche toujours « aperçu », le rendu reste la référence) : image
720p (moins nette), pas de flou de mouvement pendant un zoom qui bouge (l'échelle est exacte), contour de la personne
devant un titre plus doux (masque basse définition, sans la décontamination du bord du détouré), vignettage de
l'étalonnage qui suit le zoom au lieu de rester fixe, et en lecture continue une image peut sauter (exact en pause).

## La planche, avant de fabriquer (hors studio ; outil interne du monteur dans le studio)
Dans le studio, la personne ne voit que l'aperçu : la planche ne se montre pas et ne se nomme pas dans le chat.
Avant le rendu complet, le monteur montre à Romain une planche de 8 à 12 vignettes : de vraies images de SA vidéo
montée, une par moment du plan, composées comme le rendu le fera, sans fabriquer la vidéo. Romain répond « ok » ou par
numéro (« enlève le 4 », « le 6 plutôt en orange »).
```
/usr/bin/python3 "<dossier de ce skill>/scripts/planche.py" "<dossier>-montage"
```
Timeout 600000 ms. Les couches doivent être **préparées** (coupes, zooms, b-roll, animations, sous-titres : les mêmes
fichiers que pour le rendu ; `SOUS-TITRES_PÉRIMÉS` et les autres erreurs du rendu valent ici). Les sons ne comptent pas
(une image ne s'entend pas) : ils se posent après la validation.

**La demande** : `<dossier>-montage/planche.json`, écrit par le monteur.
```json
{ "vignettes": [
  { "image": 75, "ligne": "Le titre est écrit derrière toi, ta tête passe devant." },
  { "calque": "a09", "ligne": "Tout l'écran en orange : « 3 mois », une courbe qui monte, trois cases qui se cochent." },
  { "mot": 152, "ligne": "L'image se rapproche doucement de toi.", "mots": "tu peux profiter d'un week-end" }
] }
```
- Une vignette = un moment : `image` (image de la vidéo coupée), ou `calque` (id de `calques.json` : l'image prise est
  0,5 s après son dernier élément calé, `attendus` de son `calque.json`, sans dépasser sa sortie ; le milieu du calque
  s'il n'a pas d'élément calé), ou `mot` (numéro de `words.cut.json` : 0,5 s après son attaque). Pendant un B-roll,
  donne une `image` au milieu du clip. Choisis l'image où l'élément est entièrement affiché ; si la vignette montre
  une étape d'avant, donne l'`image` à la main.
- `ligne` : ce qui se passe, en une phrase pour Romain, sans jargon. `mots` (facultatif) : ses mots à citer ; sinon la
  phrase qu'il dit à cette image (orthographe des sous-titres, 12 mots au plus).
- `couches` (facultatif) : comme pour le rendu ; par défaut tout ce qui est préparé dans le dossier.
- Les vignettes sont numérotées dans l'ordre de la vidéo. Plus de 12 : un avertissement, regroupe.

**Comment elle est faite** (fidèle au rendu, sans encoder de vidéo) :
1. le plan caméra vient du graphe du rendu lui-même (`plan_camera` de `rendu.py` : coupes, zooms avec leur flou de
   mouvement, décalage, étalonnage, flou des pleins écrans, puis B-rolls), en un passage qui ne sort que les images
   voulues ;
2. en même temps, chaque calque actif est pris à ces seules images par `hyperframes snapshot` (fond blanc puis fond
   noir : la transparence se retrouve par la différence) ;
3. calques derrière troués par le masque Apple Vision de Romain sur cette image (même fonction que le rendu), B-roll
   par-dessus, calques devant, sous-titres en dernier ; couleurs relues comme un lecteur lit la vidéo finale.

**Ce qui sort** dans `<dossier>-montage/planche/` : `planche.html` (à ouvrir pour Romain avec `open` : images
intégrées, une colonne sur téléphone, quatre sur un Mac, il peut se l'envoyer), `planche.png` (la même en une image, à
regarder avec Read avant de la montrer), `vignettes/NN.jpg` (chaque vignette en 1080 x 1920, pour regarder un détail),
`trace.json` (image, calques, temps de chaque étape). La sortie se termine par `PRÊT <planche.html> et <planche.png>`.

**Corrections** : on corrige le plan, on refait les briques touchées (calque d'animation, sous-titres, zooms, b-roll),
puis on relance la même commande. Tout est gardé par empreinte dans `planche/cache/` : seules les vignettes dont un
calque ou le plan caméra a changé sont refaites (une ligne de texte changée ne refait aucune image). Ce que la planche
a demandé (calques, sous-titres, zooms, b-roll préparés) est exactement ce que le rendu pose ensuite : rien n'est fait
deux fois. Le cache de la planche ne sert qu'à elle et se supprime sans risque.

**Temps** (rush de test de 52 s, 12 vignettes, 13 calques touchés, Mac M1 Pro, 2026-11-13) : 50 s à froid, 10 s pour la
correction d'un calque, 2 s si rien n'a changé. Écart avec la vidéo finale aux mêmes images : 1 à 2,5 niveaux sur 255 en
moyenne, aucun écart visible.

**Ce qu'elle ne montre pas** : le mouvement (une vignette est une image : rythme, entrées des animations, vitesse d'un
zoom, pages qui défilent), le son, les moments entre deux vignettes, et le contour exact du fond vert (masque d'une seule
image, sans le lissage sur 3 images ni la décontamination du bord du rendu).

**Erreurs** : celles du rendu, plus `PLANCHE_ILLISIBLE` (planche.json), `CALQUE_INCONNU`, `IMAGE_HORS_VIDEO`,
`APERÇU_RATÉ <id>` (HyperFrames n'a pas pris le calque : journal `planche/cache/calques/<id>-erreur.log`, à corriger
par la brique qui l'a écrit), `PLANCHE_RATÉE` (plan caméra : `planche/cache/plan/erreur.log`).

## La sortie
- `PRÊT <chemin> (P Mo, rendu en N s, dont encodage M s)` : la vidéo est à côté de l'originale, `<nom>-monte.mp4`, ou
  `<nom>-monte-2.mp4`, `-3`… si elle existe déjà (les anciennes versions restent).
- `<dossier>-montage/rendu.json` : ce qui a été posé (couches, calques, sons avec leur gain et l'écart mesuré à la voix,
  sonie de la voix, crête du mix, temps). C'est la trace de ce rendu : lis-la plutôt que de te fier à ta mémoire.
- `<dossier>-montage/rendu-filtre.txt` : le graphe ffmpeg exact du rendu.
- Compte environ 1 min 30 pour une rush d'une minute avec quelques animations sur un Mac M1 ; un calque de
  sous-titres sur toute la vidéo ajoute son propre rendu (une fois, environ 1 min). Un fond vert (`plan.detoure`)
  ajoute environ 35 s d'encodage (la décontamination du bord passe sur tout le plan).

## Les erreurs
| Code | Message | Que faire |
|---|---|---|
| 2 | `COUCHE_MANQUANTE <couche>` | la brique n'a pas été préparée : fais-la, puis relance |
| 2 | `DOSSIER_INCONNU`, `VIDÉO_INTROUVABLE`, `CALQUE_INTROUVABLE`, `SON_INTROUVABLE`, `B-ROLL_INTROUVABLE`, `BIBLIOTHEQUE_INTROUVABLE` | un fichier manque ou a été déplacé : retrouve-le |
| 2 | `COUCHE_INCONNUE` | faute dans la liste des couches |
| 3 | `CALQUES_ILLISIBLE`, `SONS_ILLISIBLE`, `COUPES_ILLISIBLE` | la brique qui a écrit ce fichier doit le corriger (le message dit quoi) |
| 4 | `CALQUE_RATÉ <id>` | HyperFrames n'a pas rendu le calque : journal dans `rendu-cache/calques/<id>-erreur.log`, à corriger par la brique qui l'a écrit |
| 5 | `RENDU_RATÉ`, `DÉTOURAGE_RATÉ` | erreur de fabrication : `rendu-cache/rendu-erreur.log` |
| 5 | `RENDU_INCOMPLET` | contrôle final : la vidéo sortie n'a pas toutes ses images ou tout son son (graphe interrompu). Rien n'est livré. Préviens Yoan avec `rendu-cache/rendu-erreur.log` et `rendu-filtre.txt` |
| 5 | `RENDU_BLOQUÉ` | ffmpeg n'a pas fini dans le temps (30 s par seconde de vidéo, 10 min au moins), arrêté. Même chose |
| 2 | `SOUS-TITRES_PÉRIMÉS` | des calques portent leur propre ligne de sous-titre mais les sous-titres ont été préparés avant eux : relance `sous-titres preparer`, puis le rendu |
| 6 | `MIX_SATURÉ` | des sons trop forts ou empilés (plus de 3 dB à retirer) : à revoir dans `sons.json` |
| 7 | `OUTIL_MANQUANT` | installer ce qui est indiqué (voir Dépendances) |

Une vidéo HDR, à 60 i/s ou à cadence variable n'est plus refusée : elle est convertie (voir plus haut).

Un avertissement (`attention : ...`) n'arrête pas le rendu : calque qui dépasse la fin de la vidéo (coupé), calque
rendu plus court que demandé, musique de `sons.json` (pas encore prise en charge, ignorée), poids au-dessus du plafond
(préviens Yoan).

## Vérifier avant de dire que c'est fini
Extrais quelques images aux moments clés (début de chaque calque, image du son, milieu d'un zoom, trou d'un calque
derrière lui) avec ffmpeg depuis `<nom>-monte.mp4` et regarde-les : calque à la bonne image, contour propre autour de
la tête, sous-titres au-dessus de tout. Les mesures du son sont dans `rendu.json`.

## Dépendances (Mac neuf)
- macOS 12 ou plus sur Apple Silicon (Apple Vision pour le détourage).
- ffmpeg 7 ou plus (`brew install ffmpeg`), avec ffprobe à côté.
- Node.js (24 testé, `brew install node`), pour HyperFrames (`npx --yes hyperframes@0.7.55`, téléchargé au premier
  rendu, avec son navigateur) et pour lire `commun.mjs`.
- Python 3 du système (`/usr/bin/python3`, fourni avec les outils de développement Xcode : `xcode-select --install`)
  avec `pip3 install --user numpy scipy pillow pyobjc-framework-Vision pyobjc-framework-Quartz`.
- Le skill `animations` installé à côté (sa `bibliotheque/` : `commun.mjs`, `sons/`).
