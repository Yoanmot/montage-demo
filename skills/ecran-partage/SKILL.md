---
name: ecran-partage
description: >-
  Brique du monteur de Yoan (@ia.yoan). Le format écran partagé : sa caméra en haut, son écran en bas (une mindmap
  qu'il parcourt en parlant), filmés séparément en même temps (l'iPhone avec son micro, l'enregistrement d'écran du Mac
  avec le micro du Mac). Cale les deux par le son, choisit le cadre de chaque moitié et écrit ecran-partage.json ; la
  brique rendu compose ensuite l'image dans l'aperçu, la planche et le rendu final, depuis les deux originaux, avant
  les coupes. Utiliser quand un contenu a un enregistrement d'écran (dossier ecran/) ou que le studio dit « écran
  partagé », juste après les coupes et avant le plan.
---

# L'écran partagé

Si tu parles à Yoan : français, tutoiement, jamais de commande, de fichier ni de jargon (« ton écran », « ta caméra »,
« je cale les deux vidéos »).

## La commande
```
STUDIO_CLIENT=yoan /usr/bin/python3 "<dossier de ce skill>/scripts/ecran_partage.py" preparer "<nom>-montage" "<enregistrement d'écran>"
```
Après `couper-silences` (transcription et coupes faites sur la vidéo de la caméra : c'est elle la vidéo du montage, son
son est celui de la vidéo), avant le plan. Une dizaine de secondes. Elle écrit `<nom>-montage/ecran-partage.json` et
ne fabrique rien. Dès que ce fichier existe, toutes les briques travaillent sur l'image composée :
- **rendu** (aperçu, planche, rendu final) compose en 1080 x 1920 : la caméra recadrée sur son visage dans la moitié
  haute (cadre fixe, cheveux vers y 350, menton vers y 820), l'écran dans la moitié basse (rempli s'il a presque le
  rapport de la moitié, sinon ajusté entier sur un fond de la couleur de ses bords ; jamais déformé). L'étalonnage du
  style ne touche que la caméra. Le son est celui de la caméra. Les coupes sont posées après la composition : chaque
  coupe coupe les deux moitiés au même instant ;
- **animations-yoan** mesure sa tête sur l'image composée (titre du hook derrière elle, CTA au-dessus), place les
  sous-titres et l'accent fort sur la jointure (y 882) et le hook secondaire au milieu (y 960) ; ces réglages du format
  passent sous ceux de `style-video.json`, qui gardent le dernier mot ;
- **le plan** (`yoan.py valider`) n'exige plus de cacher les coupes, refuse les zooms (ils recadreraient aussi l'écran)
  et les demi-écrans (la moitié basse est déjà son écran) ; `yoan.py zooms` répond `ÉCRAN_PARTAGÉ` (pas de zoom, pas
  de dézoom d'ouverture : le hook garde son cadre fixe).

## La synchro
Les deux pistes son (micro de l'iPhone, micro du Mac) sont comparées sur toute leur longueur (corrélation pondérée,
décalage cherché dans ±2 min), puis sur 2 à 5 passages de 12 s pris séparément : le calage n'est accepté que si le pic
est au moins 3 fois au-dessus des autres et que les passages donnent le même décalage à 40 ms près. Un clap des mains
au début aide, il n'est pas obligatoire. Sortie : `PRÊT écran partagé : l'écran commence +2.583 s par rapport à la
caméra, sûr à ... ms près (n/n passages d'accord)`.

## Les refus (code 3) et quoi dire
| Message | Ce que tu lui dis |
|---|---|
| `SYNCHRO_IMPOSSIBLE` (une vidéo sans son, piste muette, pas assez de temps en commun) | la phrase du message, sans le code |
| `SYNCHRO_INCERTAINE` | « Je n'arrive pas à caler ton écran sur ta vidéo par le son : c'est bien l'enregistrement de ce tournage, avec le micro du Mac allumé ? » |
Jamais de montage sur un calage refusé. Si Yoan donne lui-même le décalage (« l'écran a démarré 3 secondes avant »),
`--decalage 3` le pose sans mesure (secondes de l'écran pour la première image de la caméra).

Avertissements (le montage continue) : visage introuvable (cadre centré : regarde la planche), écran plus court que
la caméra (sa dernière image reste figée : dis-le-lui si un passage gardé tombe après), écran commencé après la caméra.

## Regarder
`ecran_partage.py image "<nom>-montage" <instant en s de la vidéo de la caméra> <sortie.png>` : une image composée,
sans coupes ni animations. La planche du rendu montre la vidéo composée avec tout le reste.

## Retouches
« Recadre-moi plus haut / plus serré » : le cadre de la caméra est dans `ecran-partage.json` (`camera` : x, y,
largeur, hauteur en px de la vidéo de la caméra, rapport 9:8). Change-le à la main, puis refais les animations (la
tête a bougé), les sous-titres et l'aperçu. Un autre enregistrement d'écran : relance `preparer` avec lui.
