---
name: zooms
description: Brique du monteur. Prépare les zooms d'une vidéo déjà coupée, au style de Romain : zoom qui suit sa tête (110 % en 0,8 s, puis le cadre suit sa tête jusqu'à la coupe, comme un caméraman), zoom éclair (115 % en 0,13 s avec un léger flou de mouvement, sur un mot qui claque), rapprochement court (110 % en 1 s, sur une phrase qui monte vers une idée), centrés entre ses yeux, tenus jusqu'à la coupe qui revient au plan large, et dézoom d'ouverture de l'accroche (120 % vers 100 % jusqu'au mot clé). Exécute les zooms du plan de montage ; sans plan, en choisit peu, avec retenue. Ne fabrique pas la vidéo : c'est la brique rendu qui le fait.
---

# Préparer les zooms

Tu arrives ici depuis l'agent monteur, une fois les coupes prêtes (couper-silences). Fais les étapes ci-dessous, puis
rends la main au monteur, qui fabrique la vidéo avec la brique rendu.
Si tu parles à Romain : simplement, en français, en le tutoyant. Ne lui montre ni les commandes ni les fichiers.

**Règle d'or : un zoom qui se remarque est raté.** Peu de zooms, bien placés, plutôt qu'un zoom par phrase.

## La commande
```
/usr/bin/python3 "<dossier du skill>/scripts/zooms.py" <commande> "<dossier>-montage"
```
Timeout 600000 ms. Rien ne part sur un serveur. Quelques secondes.

## Le déroulé

### 1. Le texte : `texte`
Écrit `texte-zooms.md` dans le dossier : le texte de la vidéo coupée, une phrase par ligne, chaque mot précédé de
son numéro (`[12]abdos`). Lis-le en entier.
- `TEXTE_INTROUVABLE` : la vidéo n'est pas encore coupée. Passe d'abord par couper-silences.

### 2. Les zooms à faire
**Avec le plan de montage** (le cas normal, écrit par le monteur avec le skill plan-montage) : il dit où zoomer. Tu exécutes, tu ne rajoutes rien.
Pour chaque zoom du plan, retrouve dans le texte numéroté **le mot** où il part.
- Ne te fie jamais à un minutage : seule la phrase dite compte. Si une ancre ne se retrouve pas telle quelle, prends
  la phrase qui dit la même chose au même endroit. Si tu ne la retrouves pas, ne l'invente pas : signale-la au monteur.
- Éclair : le mot qui claque (celui que le plan désigne, sinon le mot fort de la phrase). Rapprochement et zoom qui suit
  sa tête : le début de la phrase.
- Une échelle demandée au-delà du plafond est ramenée au plafond (le script le dit). Un « recul » au milieu de la
  vidéo, un « zoom progressif lent » ou un « punch-in sur la coupe » ne sont pas dans le style : prends le geste le plus
  proche (éclair ou rapprochement) et dis-le au monteur.
- **Dézoom d'ouverture** (accroche du niveau travaillé, avec le titre derrière lui) : `ouverture`, sur le mot clé de
  sa première phrase, là où il s'arrête.

**Sans plan** : choisis toi-même, avec retenue. Pour Romain, le zoom qui suit sa tête d'abord (une phrase qui compte,
une confidence, une explication un peu longue). Éclair sur un mot qui claque (un chiffre, une affirmation qui tranche,
l'appel à l'action) ; au plus un ou deux rapprochements par vidéo, sur une phrase qui monte vers une idée. Environ un
zoom toutes les 15 à 20 secondes, jamais deux phrases de suite.

Écris `zooms.json` dans le dossier :
```json
{ "zooms": [
  { "type": "eclair", "mot": 30 },
  { "type": "rapprochement", "mot": 49 }
] }
```
- `type` : `suivi`, `eclair`, `rapprochement` ou `ouverture`.
  - `suivi` : 110 % en 0,8 s (power2.inOut), part à l'attaque du mot, puis **le cadre suit sa tête** jusqu'à la coupe
    (Romain, 2026-11-20 : « rien qu'un zoom et un mouvement de caméra qui fait qu'on suit la tête, c'est un effet en
    soi ») : ses yeux sont mesurés toutes les 3 images pendant le zoom tenu, les trous comblés, lissés sur 0,4 s
    environ ; le cadre se décale de ce que sa tête a bougé, sans jamais sortir de l'image (borné par la marge du zoom).
    Sa tête reste à la même place à l'écran, le décor bouge un peu : c'est le mouvement de caméra. Il faut au moins
    1,2 s jusqu'à la coupe. Moins de la moitié des mesures réussies : le zoom reste fixe et le script le dit
    (`SUIVI IMPOSSIBLE`).
  - `eclair` : 115 % en 0,13 s (courbe power2.out), léger flou de mouvement, part à l'attaque du mot.
  - `rapprochement` : 110 % en 1 s (power2.inOut, départ et arrivée freinés), part à l'attaque du mot.
  - `ouverture` : la vidéo commence à 120 % (`echelle`, 1,2 au plus) et revient à 100 % d'un pas égal à chaque image,
    de l'image 0 jusqu'à l'attaque du mot, où elle s'arrête net. Un seul, toujours le premier ; aucun autre zoom
    pendant. La brique écrit aussi `ouverture.json` (images, échelle de départ, point fixe en px du calque 1080 x 1920) :
    le titre derrière lui (animation sur mesure) le suit image par image pour dézoomer avec la caméra.
- `mot` : numéro du mot où le geste part (pour `ouverture` : où il s'arrête).
- La fin n'est pas à écrire : le zoom tient **jusqu'à la coupe suivante**, qui revient au plan large. S'il n'y a pas de
  coupe dans les 4 s, il finit au bout de la phrase (ou du mot `fin`, facultatif), calé sur une coupe proche si possible.
- `suivre` (facultatif, `true`) : le même suivi de sa tête pour un éclair ou un rapprochement, pendant qu'il est tenu.
  Un `cadrage` donné à la main l'annule (le cadre reste où on l'a mis).
- `echelle` (facultatif) : par défaut `1.15` (éclair), `1.1` (rapprochement, suivi). Ne la change pas sans demande. Plafond :
  `1.15` pour une vidéo jusqu'au 1080p, `1.8` pour une 4K.
- `cadrage` (facultatif) : `[x, y]` de `0` à `1`, le point fixe du zoom. Par défaut, le script le trouve tout seul
  **entre ses yeux**. Ne le mets que si l'aperçu montre un point faux.

Ancien format accepté : `{ "debut": 27, "fin": 40, "entree": "sec" }` vaut un éclair sur le mot 27,
`"progressif"` un rapprochement ; `"recul"` est refusé (le seul recul du style est le dézoom d'ouverture).

### 3. Préparer : `preparer`
Lit `zooms.json`, trouve ses yeux, écrit `zooms.txt` (pour la brique rendu) et une image de contrôle par zoom dans
`zooms-apercu/` : à gauche le plan large avec le point fixe (rond) et le cadre du zoom, à droite le zoom au plus serré.
Le script liste chaque zoom (type, échelle, de quand à quand, point fixe, phrase couverte).
- `ZOOMS_ILLISIBLE` : corrige `zooms.json` comme indiqué, puis relance. Les refus du style :
  - un éclair à moins de 0,2 s après une coupe (il se lirait comme un punch-in serré sur la coupe) : prends le mot
    fort suivant ;
  - une coupe trop tôt après le mot (moins de 0,4 s pour un éclair, 1,1 s pour un rapprochement) : prends un mot plus tôt ;
  - deux zooms qui se chevauchent.
- `VISAGE INTROUVABLE` dans la liste : le point par défaut a servi. Regarde l'aperçu et mets un `cadrage`.
- `[retour au plan large sans coupe]` : le zoom sort au milieu d'un plan. Acceptable, mais préfère un mot plus près
  d'une coupe si le plan le permet.

### 4. Vérifier (c'est ton travail)
Regarde chaque image de contrôle : le rond est entre ses yeux, son visage est entier dans le cadre. Pour un zoom qui
suit sa tête, regarde aussi `zoom-NN-suivi.jpg` (4 images du zoom tenu, chacune avec son cadre) : sa tête reste à peu
près à la même place, jamais coupée. Sinon, mets un
`cadrage` et relance `preparer` (instantané). Puis rends la main au monteur.

## Les retouches (quand Romain a vu la vidéo)
- « moins de zooms », « pas sur cette phrase » : retire-les de `zooms.json` ;
- « ajoute un zoom sur telle phrase » : ajoute-le ;
- « plus doux » : rapprochement ou zoom qui suit sa tête au lieu d'éclair ; « plus sec » : l'inverse ;
- « que la caméra me suive », « moins de mouvement » : `suivi` (ou `"suivre": true`), ou l'inverse.
Puis `preparer`, et le monteur refait la vidéo depuis l'originale.

## Ce qui sort aussi : `zooms-donnees.json`
Les mêmes zooms en données (type, échelle, point fixe en part de l'original, images de début, de pose et de fin,
courbe, et pour un zoom qui suit sa tête `suivi` : images clés et décalage du cadre), avec l'empreinte de `zooms.txt` : l'aperçu du studio (`rendu`, `apercu.py`) les joue sans rendu. Le rendu ne
le lit pas. Écrit à chaque `preparer`, à ne jamais modifier à la main.

## Ce qui sort : `zooms.txt`
Un morceau de graphe ffmpeg, à poser tel quel entre le plan coupé et la suite : `[v]<zooms.txt>[vz]`.
- Entrée `[v]` : le plan coupé (sortie de `filtre.txt`), 30 i/s, à la définition de l'original. Sortie : même
  définition, même nombre d'images, instants remis en images exactes (`settb=1/30,setpts=N` après la dernière chaîne :
  sans ça la sortie était en base 1/1000000 et les calques posés ensuite prenaient l'image d'avant une fois sur trois).
  La mise à 1080 x 1920 et l'étalonnage viennent après (brique rendu).
- Hors des zooms, les images passent sans retouche. Pendant un zoom : recadrage autour du point fixe (`perspective`,
  interpolation cubique, précision sous le pixel). Un zoom qui suit sa tête décale ce cadre image par image (images
  clés toutes les 6 images, interpolées linéairement entre elles, dans l'expression de `perspective`). Sur chaque image où l'échelle bouge, le **flou de mouvement** est
  inclus : 10 sous-images moyennées (obturateur 360 degrés, comme `zoom.py` de la bibliothèque).
- Sans zoom, le fichier contient `null` (le plan passe tel quel).
- Le graphe a été comparé image par image à `zoom.py` de la bibliothèque du style : écart moyen sous 1 niveau de
  gris sur 255, flou compris.

## Dépendances
- `/usr/bin/python3` (Python 3.9 ou plus, celui du Mac) avec `Pillow` et `pyobjc` (modules `Quartz` et
  `Vision` : détection des yeux par Apple Vision, macOS 11 ou plus).
- `ffmpeg` 7 ou plus dans le PATH (sinon `/opt/homebrew/bin/ffmpeg`), avec les filtres `perspective`, `mix`, `trim`,
  `concat` (tous dans la version Homebrew).
- Les fichiers de couper-silences dans le dossier : `info.json`, `edl.json`, `words.cut.json`.
