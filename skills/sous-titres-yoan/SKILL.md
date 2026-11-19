---
name: sous-titres-yoan
description: >-
  Brique du monteur de Yoan (@ia.yoan). Pose ses sous-titres, ceux de son pipeline de montage : Satoshi Black en
  majuscules en haut de l'image, phrase construite mot par mot (chaque mot entre depuis un flou sur sa voix), groupe
  qui part net, mot ou expression dorée avec halo et crochets qui se resserrent, accent fort en grand entre quatre
  « + ». Jamais pendant le titre du hook, un plein écran à mots ou le CTA. Utiliser après les animations du monteur
  de Yoan, et à chaque changement du plan ou des animations.
---

# Les sous-titres de Yoan

Si tu parles à Yoan : français, tutoiement, jamais de commande ni de fichier.

## La commande
```
STUDIO_CLIENT=yoan python3 "<dossier de ce skill>/scripts/sous-titres.py" preparer "<nom>-montage"
```
Quelques secondes. Lit le plan (`plan-montage.json`, éléments `sous_titres`) et écrit un calque par passage sous-titré
(`calques/st00`, `st01`... : entre deux moments sans sous-titres) dans `calques.json`, source « sous-titres », ordre 100
(au-dessus de tout). Sortie : `PRÊT sous-titres : N passage(s), G groupes, D doré(s), F accent(s) fort(s)`.

## Le style (pipeline de Yoan, `REGLES.md` « Sous-titres », verrouillé au Style Lab)
- Satoshi Black 70 px, MAJUSCULES, blanc cassé, ombre douce ; en haut, bloc de 880 px centré, haut des capitales à y 256 ;
  une à trois lignes, jamais sur le visage.
- Mot par mot : chaque mot entre 0,04 s avant sa voix, en fondu depuis un flou de 14 px en 0,22 s ; le groupe disparaît
  net d'un coup avant le suivant.
- Mot doré : un par groupe au plus, en doré avec son halo à trois couches, même taille ; crochets dorés sur les
  capitales (marge 11 px) qui se resserrent à son entrée. Expression dorée : tous ses mots, sur une ligne, crochets
  autour de toute l'expression, resserrés quand elle est complète.
- Accent fort : l'expression seule en grand (104 px, doré), quatre « + » crème qui arrivent avec le dernier mot.
- Pas de sous-titres pendant le titre du hook, un plein écran à mots ou le CTA ; ils restent pendant les demi-écrans,
  les gabarits sur la caméra et les gabarits en plein écran (en haut). Pas de crochets sur un plan filmé en plus.

## Le style de cette vidéo (`style-video.json`)
Ce style est le défaut. Une demande pour **cette vidéo** s'écrit dans `<nom>-montage/style-video.json`, clé `style`
(mêmes noms que `animations-yoan/moteur/style/style.json`, seules les valeurs qui changent), puis `preparer` et l'aperçu.
Sans ce fichier, rien ne change. Exemple (« des captions classiques, plus de mots par ligne, une autre couleur ») :
```json
{ "pourquoi": "19/11, ses mots : « fais arriver les mots de manière classique, plus de mots par ligne »",
  "style": { "sousTitres": { "entree": { "flou": 0, "duree": 0.06 }, "motsMax": 8, "ligneMax": 820 } } }
```
Ce qui se règle sous `sousTitres` :
- **Arrivée des mots** `entree` : `flou` (px, 14 ; 0 = net), `duree` (s, 0,22 ; 0 = d'un coup), `avance` (s avant la
  voix, 0,04), `courbe` (`power2.out`), `montee` (px de montée, 0), `echelle` (taille de départ, 1 ; 0,9 = grossit en
  entrant), `mode` (`mot` : chaque mot sur sa voix ; `groupe` : tout le groupe arrive d'un coup sur son premier mot).
  L'accent fort garde son entrée.
- **Police** : `police` = une clé de `polices` ; une autre police s'ajoute dans la même clé `style` :
  `"polices": {"videoPolice": {"fichier": "<chemin complet .ttf ou .otf>", "famille": "<nom>", "poids": 400}}`.
  Ses mesures (largeur des lignes, crochets sur l'encre) sont faites seules. Polices déjà là : `anton`, `inter`,
  `jetbrains`, `plex`. Jamais une police téléchargée sans son accord.
- **Couleurs** : `couleur` (le texte, `#F2EEE6`), `couleurDore` (le mot doré, ses crochets et son halo, `#F2B544`).
- **Taille et place** : `taille` (px, 70), `top` (px du haut du bloc, 242), `largeur` (880), `interligne` (1,12).
- **Découpe** : `motsMax` (mots par groupe, 6), `ligneMax` (px d'une ligne, 700 ; 820 au plus), `deuxLignes`
  (caractères au-delà desquels le groupe passe sur deux lignes, 14).
Garde-fous qui ne bougent pas : sous-titres jamais sur son visage (regarde les moments touchés), rien hors cadre.

## Les groupes
Par défaut le plan les demande en `auto` (format dans `$SK/plan-montage-yoan/references/format.md`) : découpés où la voix
respire, 1 ou 2 lignes équilibrées, avec les dorés et les accents forts du plan. Pour une coupure précise, le plan peut
écrire les groupes à la main (`groupes`). Les textes viennent de la transcription : une faute d'orthographe se corrige
dans `words.cut.json` (le mot, pas le propos), puis on relance.

## Retouches
« Corrige ce mot » : le texte de la transcription, puis `preparer`. « Ce mot doré plutôt que celui-là », « pas d'accent
fort ici » : le plan (`dores`, `forts`), puis `preparer`. Une animation qui change : relance `preparer` (sinon le rendu
garde des sous-titres sous un plein écran).
