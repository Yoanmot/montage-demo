# Bibliothèque du style des reels @fitavecromain

Ce que l'agent monteur de Romain lit pour monter dans son style. Clôture du Style Lab v2 le 2026-11-11.
C'est une **vitrine du vocabulaire**, pas un catalogue : chaque vidéo a ses animations sur mesure, recomposées à partir
de ces gabarits et des règles de `STYLE.md`.

## Où est quoi
- `STYLE.md` : les règles du style (brief, socle, mouvement, chaque effet, sons, zone sûre, interdits, points ouverts).
  Copie de celui du labo ; les chemins `bibliotheque/<effet>/` qu'il cite sont les dossiers d'ici.
- `commun.mjs` : **toutes les constantes** (couleurs, polices, tailles, rayons, ombres, durées, courbes, recette
  d'apparition `APPARITION` / `apparitionReglages(h)` / `apparitionJs`, sons et niveaux, étalonnage, zone sûre). Aucun
  effet ne met une valeur en dur : il la prend ici. Les gabarits HTML recopient les valeurs qu'ils utilisent (un HTML de
  rendu n'importe pas le module) ; chaque README dit lesquelles.
- `apparition-texte.md` : la mesure image par image du mouvement d'apparition.
- `fonts/` : Inter Black (la seule police de la vidéo, `POLICES.sousTitres`), Roboto et Liberation Sans (formats
  natifs recopiés seulement), avec leur licence OFL.
- `vendor/gsap.min.js` : GSAP, chargé par chaque gabarit.
- `images/image-a-fournir.svg` : emplacement des photos (aucune photo n'est livrée ; chaque `<img>` dit dans
  `data-a-fournir` quelle photo de Romain y mettre).
- `sons/` : les sons des gestes (ElevenLabs) et leurs fiches. Licence : `sons/LICENCE.md`.

## Les effets (un dossier chacun : README, gabarit, aperçu)

| Dossier | Effet | Cartes | Couches |
|---|---|---|---|
| `sous-titres/` | ses sous-titres (Inter Black, pavé orange qui glisse), repris de son ancien skill le 2026-11-13 | captions_romain.py | devant |
| `accroche/` | l'accroche composée pour chaque vidéo (signature fixe, disposition libre), 5 exemples commentés ; fabriquée par `scripts/accroche.mjs` | page des hooks, direction A (2026-11-20) | derrière + devant |
| `hook-paves/` | hook pavés craie ou orange (brique, animée) | r19-02a, r19-02b | devant |
| `hook-titre-derriere/` | titre derrière lui | r20-01d | derrière |
| `hook-mot-geant/` | mot géant derrière la tête | r20-01f | derrière + devant |
| `hook-chiffre/` | hook chiffre | r20-01g | devant |
| `hook-question/` | hook question | r19-02i | devant |
| `cta-champ-instagram/` | champ Instagram, le mot se tape | r19-03a | devant |
| `cta-mot-derriere/` | le mot monte derrière lui | r20-01h | derrière + devant |
| `transition-faisceau/` | faisceau craie, craie étroit, orange étroit | r19-04a, r19-04c, r20-01i | devant |
| `transition-flash/` | flash craie | r19-04d | devant |
| `demi-ecran/` | demi-écran, sortie bascule ou faisceau | r20-04b, r20-04c | devant (+ décalage du plan) |
| `plein-ecran-fond/` | plein écran, fond charbon, orange, craie ou sa vidéo floutée | r21-01c, d, e, f | devant |
| `plein-ecran-orange/` | phrase sur orange, 2 lignes centrées | r21-01g | devant |
| `liste/` | liste sur charbon | r20-05a | devant |
| `minuteur-chiffres/` | chiffres seuls | r20-06a | devant |
| `minuteur-barre/` | barre par crans sur flou fort | r20-06d | devant |
| `schema/` | schéma sur charbon | r20-07a | devant |
| `comparaison/` | mauvaise option puis photos | r20-08a | devant |
| `carte-seance/` | carte de séance | r21-02a | devant |
| `carte-superset/` | superset | r21-02b | devant |
| `carte-fiche-exercice/` | fiche exercice | r21-02c | devant |
| `carte-chapitre/` | chapitre | r21-02e | devant |
| `carte-presentation/` | présentation | r21-02f | devant |
| `carte-nutrition/` | nutrition, le bilan | r21-02g | devant |
| `carte-chrono/` | carte chrono | r21-02h | devant |
| `broll-annote/` | B-roll annoté | r21-03a | devant |
| `angle-coude/` | angle d'articulation mesuré | r21-03b | devant |
| `tampon-verdict/` | tampon verdict | r21-03c | devant |
| `anatomie/` | muscle qui s'allume | r21-03d | devant |
| `recherche-google/` | recherche Google recopiée | r21-04a | devant |
| `tier-list/` | tier list TierMaker recopiée | r21-04b | devant |
| `fond-vert/` | fond vert, promesse de pub | r21-04c | derrière |
| `zooms/` | zoom éclair 115 %, rapprochement 110 % (script, pas de calque) | v1 r15-01a, r15-01c | plan |

Les 43 cartes verrouillées du tour 22 (r22-01a et r22-L01 à L42) sont toutes couvertes : 32 gabarits HyperFrames et le
script des zooms.

## Rendre un gabarit
Chaque gabarit est une composition HyperFrames (HTML, CSS, GSAP) : un **calque transparent** de 1080 x 1920 à 30 i/s.
1. Ouvrir `<effet>/<couche>/index.html` et changer le bloc PARAMÈTRES en tête du script : `P` (variantes), `T` (instants
   calés sur les mots de la voix), puis les textes dans le HTML. Garder `data-duration` de `#root` égal à la durée.
2. Rendre (Node et ffmpeg installés) :
   ```
   cd <effet>/devant
   npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/<effet>-devant.mov
   ```
   Les polices et GSAP sont lus dans `../../fonts/` et `../../vendor/` : HyperFrames signale ces chemins remontants
   (avertissement `invalid_parent_traversal_in_asset_path`) mais les résout au rendu. Ne pas déplacer un gabarit hors de
   `bibliotheque/` sans recopier `fonts/` et `vendor/` à côté et corriger les chemins.
3. Poser le calque sur le plan étalonné (même rendu, un seul réencodage de l'original). Couche `devant/` : par-dessus
   Romain. Couche `derriere/` : trouée image par image par le masque de Romain (détourage), posée sous lui. Exemple pour
   un calque devant :
   ```
   ffmpeg -i plan-etalonne.mov -i _rendus/<effet>-devant.mov -filter_complex "[0][1]overlay=0:0:format=auto" -c:v prores_ks sortie.mov
   ```
   Les fonds flous (sa vidéo qui tourne sous le flou) et le décalage du plan du demi-écran se font sur le plan, pas dans
   le calque : voir le README de l'effet.
4. Le son se mixe à part, aux niveaux de `STYLE.md` (« Sons et niveaux »).

## Aperçus
`apercu*.mp4` dans chaque dossier : aperçus muets 540 x 960 rendus dans le labo, sur des rushes de Romain. Tous
ceux des gabarits à texte ont été refaits le 2026-11-14 (police unique) sur la rush de test (face caméra WhatsApp),
avec les instants par défaut du gabarit : `instancier.mjs` puis `verifier.mjs --video`. Les photos
d'exercices et de plats y sont l'emplacement « image à fournir », comme dans les gabarits ; les seules vignettes réelles
sont des images de Romain (ses vidéos, sa photo de profil).

## Vérification à la clôture (2026-11-11)
Rendus depuis ce dossier avec les données d'exemple et comparés image par image à leur aperçu : `sous-titres/` en
classique et en mot fort, `carte-seance/`, `plein-ecran-fond/` (charbon). Mêmes positions, tailles, couleurs et
instants ; seules les photos sont remplacées par l'emplacement.

## Reprise du 2026-11-13 et du 2026-11-14 (retour de Romain : « trop de différences de taille », police pas aimée)
- Sous-titres : ceux de son ancien skill (voir `sous-titres/README.md`), bloc commun posé aussi dans `cta-mot-derriere`,
  `cta-champ-instagram` et `tier-list`.
- Police unique (2026-11-14) : tous les gabarits passent à Inter Black (`POLICES.sousTitres`), écrite dans leur bloc
  `POLICE` ; `node ../scripts/maj-sous-titres.mjs` réécrit les blocs `POLICE` et `SOUS-TITRES` après un changement
  dans `commun.mjs`. Les tailles calculées pour couvrir une largeur ont été recalculées avec Inter (mots géants, pleins
  écrans, fond vert, demi-écran) ; les chiffres des cartes chrono et nutrition gardent la largeur d'encre de la planche.
- Captions : les pleins écrans texte portent `data-captions` (une taille et une police par ligne, STYLE.md).
- Les tailles des gabarits sont celles de la planche (le plafond de 1,5 fois du 2026-11-13 est retiré).
