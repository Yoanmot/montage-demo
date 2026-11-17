---
name: sound-design
description: Brique du monteur. Pose les sons d'une vidéo déjà coupée, une fois la planche validée et avant le rendu (quel son sur quel geste, à quelle image exacte, à quel niveau sous la voix : un clic sur chaque transition, le Vine boom sur chaque image de réaction, l'accroche et quelques moments importants) et écrit sons.json, contrôlé. Génère avec ElevenLabs (avec cache) un son qui manque à la bibliothèque. Ne mixe pas la vidéo finale (brique rendu) ; fournit une écoute de contrôle mesurée. Utiliser quand le monteur en est aux sons, ou sur « mets les sons », « le son est trop fort / pas calé ».
---

# Sound design

C'est **toi, l'agent monteur**, qui décides où vont les sons : le plan de montage (que tu as écrit) dit les
animations, pas les sons. Ce skill te donne les règles du style de Romain et des scripts qui calculent les images
exactes, écrivent `sons.json` et le vérifient. Le mixage final est fait par la brique `rendu`.

Avec Romain : français, tutoiement, jamais de commande, de nom de fichier ni de nom d'outil. Tu dis ce qui se passe
(« je pose les sons », « je vérifie qu'ils tombent pile »).

**Règle d'or : discret, calé à l'image, audible au téléphone.** Un son accompagne un geste qu'on voit ; il ne
décore pas. Jamais partout. Dans le doute, pas de son.

## Où poser des sons (décision de Yoan, 2026-11-13)
- **Chaque transition** : un clic sur chaque flash, et sur l'entrée et la sortie de chaque plein écran (sur l'image où
  le flash couvre l'écran, la coupe). Un faisceau garde son déclencheur.
- **Chaque image de réaction** (mème) : toujours le « Vine boom », sur l'image où elle apparaît.
- **L'accroche** : un son, sur l'image où le titre ou le hook apparaît (celui que le style associe au geste, sinon un
  son généré, voir plus bas).
- **Quelques moments importants** à faire ressortir, pas plus de deux ou trois par vidéo : le message principal qui
  arrive, un chiffre clé. Le reste du plan n'a pas de son.
- **Gestes retenus par Yoan sur le test v17** (2026-11-14, table ci-dessous) : captures d'écran qui défilent (un clic
  court par changement d'écran), objet qui se pose (un clac), cases cochées (un tick par case, de plus en plus aigu),
  et la **montée du moment fort principal** (une seule par vidéo, elle s'arrête net sur son son d'entrée).
- **Un son suit un mouvement visible, jamais la voix seule.**
- **Jamais** sur un zoom, sur les sous-titres ni sur les sous-titres enrichis. Les scripts refusent ces gestes.
- **Refusés par Yoan** (2026-11-14), jamais : impact sourd ou « punch » sur les sous-titres enrichis (« pas top »,
  « nul ») ; souffle de défilement continu sur des pages (swipe) ; son de conclusion en fin de vidéo (le contrôle refuse
  tout son autre qu'une transition dans la dernière seconde).

## Les sons du style (STYLE.md « Sons et niveaux », bibliothèque `../animations/bibliotheque/sons/`)

| Geste qu'on voit | Son | Image exacte | Niveau sous la voix |
|---|---|---|---|
| Transition : flash, entrée ou sortie d'un plein écran (`transition`) | `clic.wav` (54 ms) | celle où le flash couvre l'écran (la coupe) | 14 dB RMS |
| Image de réaction qui pop (`meme`) | `meme-vine-boom.wav` (Vine boom, 0,9 s) | celle où l'image apparaît | 12 LU |
| Faisceau (transition, sortie faisceau du demi-écran) | `faisceau-obtu.wav` (obturateur, 18 ms) | celle où la bande couvre l'écran = la coupe | 9 LU |
| Arrivée d'un texte ou d'une carte qui compte : mot géant (hook mot géant, CTA mot derrière lui), chiffre (hook chiffre, carte chrono), tampon verdict, message principal | `arrivee-tick.wav` | celle où l'élément passe 50 % d'opacité (`apparitionMiOpacite`) | 8 LU |
| Photo qui se pose (tier list, vignettes de la comparaison) | `clic.wav` (appareil photo, 54 ms) | celle où la photo se pose, une par photo | 14 dB RMS |
| Captures d'écran qui défilent (`ecran`, effet journaux) | `clic-court.wav` (clic de transition raccourci à 28 ms) | une par changement d'écran, pas celle du flash d'entrée (qui a son clic de transition) ; série = un seul geste | 21 dB RMS |
| Objet qui se pose (`pose`, pièce de puzzle) | `pose-clac.wav` (clac sec de carton) | celle où l'objet est posé, une par objet | 8 dB RMS (niveau du Vine boom) |
| Cases cochées (`coche`) | `coche-1.wav`, `coche-2.wav`, `coche-3.wav` (de plus en plus aigu ; au-delà de 3 cases, le plus aigu) | celle où chaque case se remplit ; série = un seul geste | 8 dB RMS |
| Moment fort principal, un seul par vidéo (`montee`) | `montee.wav` (0,55 s) | `fin` = l'image de son son d'entrée (le clic du flash qui l'ouvre) : le script la pose pour qu'elle s'arrête net dessus | 10 dB RMS |
| Frappe (champ Instagram du CTA, recherche Google) | `frappes/t1` à `t4`, tournantes, jamais deux fois la même de suite, ±1,5 dB | une par lettre, à l'image de la lettre | 23 dB RMS |
| Touche Entrée (recherche Google) | `entree.wav` | celle de l'Entrée | 17 dB RMS |

- Les sons de la bibliothèque sont générés avec ElevenLabs, sauf le Vine boom, fourni par Yoan (`LICENCE.md`).
- **Sans son** par défaut : le reste des gestes (hooks pavés, question ; listes, minuteurs, schéma, anatomie, cartes ;
  fond vert ; demi-écran sauf sa sortie faisceau). Ne les sonorise pas « pour faire vivre ».
- **Animation sur mesure** : cherche d'abord le geste de la table qui lui ressemble (un élément qui arrive comme un mot
  géant = arrivée ; une photo qui se pose = photo ; une coupe cachée par une bande = faisceau ; un flash intégré =
  transition ; une image de réaction = meme). Si rien ne ressemble et que le moment fait partie de ceux à faire
  ressortir (accroche, moment important), génère le son (plus bas). Sinon, pas de son.
- **Rejetés par Yoan en contexte**, à ne jamais générer : souffles (graves, feutrés, aérés), impacts sourds, swish
  aigus, scintillements, montées brèves sur les textes. Seule montée admise : celle de la table (`montee.wav`, moment
  fort principal, finit sur son son d'entrée).
- **Échelle commune des niveaux** : dB RMS sous la voix parlée, celle des clics (clics 14 ; le Vine boom, réglé en
  12 LU, vaut 8,2 sur cette échelle). Les gestes retenus en v17 y sont réglés : écrans 21, montée 10, coches et clac 8.
- **Calage** : les positions sont des **images de la vidéo coupée** (30 i/s, image 0 = début). Chaque son est posé de
  sorte que son attaque (`debut_echantillon` de sa fiche `.json`) tombe pile sur l'instant `image / 30`.
- **Niveaux** : `lu_sous_voix` = sonie K de la partie active du son sous la sonie intégrée de la voix ;
  `rms_db_sous_voix` = RMS actif du son sous le RMS de la voix parlée. Jamais plus de 12 LU sous la voix (inaudible au
  téléphone). Voix : -16 LUFS, crête -1,5 dBTP ; crête du mix sous -1 dBFS (un limiteur de crête rattrape un son posé
  sur un pic de voix ; plus de 3 dB à retirer = sons trop forts ou empilés, refusé).
- **Deux gestes** à moins de 3 images (0,1 s) : on n'en entend qu'un, garde le plus important. Exceptions : les lettres
  d'une même frappe, les changements d'écran d'une même série et les cases d'une même série (un seul geste, à moins de
  0,2 s l'un de l'autre, `SONS.serieMaxS`).
- **Musique de fond** : pas encore choisie. `sons.json` garde `"musique": null`, n'y mets rien.

## Le déroulé

Scripts dans `scripts/` de ce skill. `<dossier>` = le dossier `<nom>-montage` de la vidéo (celui de `words.cut.json`
et `calques.json`). Timeout 600000 ms pour `ecoute.py` et `generer.py`.

### 1. Les suggestions des calques
```
node scripts/sons.mjs proposer "<dossier>"
```
La brique animations pose dans chaque calque des `sons_suggeres` (images déjà calculées sur sa timeline). Le script en
fait `<dossier>/gestes.json`, un brouillon : un geste par son, les lettres d'une frappe regroupées. S'il existe déjà, il
n'est pas écrasé (`--remplacer` pour repartir des suggestions).

### 2. Décider (c'est ton travail)
Relis `gestes.json` à côté du plan de montage et des calques :
- retire ce qui ne se sonorise pas ou ce qui fait trop (deux ticks trop proches, une vidéo qui sonne partout) ;
- ajoute ce que les calques n'ont pas suggéré : animation sur mesure, faisceau posé à la main.

Formes d'un geste (images de la vidéo coupée) :
```json
{ "gestes": [
  { "geste": "transition", "image": 359, "calque": "a08", "pourquoi": "flash d'entrée du plein écran" },
  { "geste": "meme", "image": 206, "calque": "a04", "pourquoi": "Mr Bean pop sur « pourquoi »" },
  { "geste": "faisceau", "image": 727, "calque": "a05-faisceau", "pourquoi": "faisceau sur la coupe" },
  { "geste": "arrivee", "image": 152, "calque": "a01-mot-geant" },
  { "geste": "arrivee", "mot": 23, "h": 300, "pourquoi": "mot géant DOUZE" },
  { "geste": "arrivee", "depart": 4.922, "h": 300 },
  { "geste": "photo", "images": [790, 822, 834, 870], "calque": "a10-tier-list" },
  { "geste": "frappe", "images": [1530, 1532, 1533, 1535, 1537], "calque": "a20-cta" },
  { "geste": "frappe", "mot_seul": "ABDOS", "mot": 214 },
  { "geste": "entree", "image": 1545 },
  { "geste": "ecran", "images": [247, 250, 253, 256, 260, 263, 265, 268, 271, 275], "calque": "a06" },
  { "geste": "pose", "images": [826, 838, 869, 898], "calque": "a14" },
  { "geste": "coche", "images": [482, 487, 491], "calque": "a09" },
  { "geste": "montee", "fin": 359, "calque": "a08", "pourquoi": "moment fort principal : finit net sur le clic du flash" },
  { "geste": "sur_mesure", "fichier": "/chemin/absolu/<dossier>/sons/coche.wav", "image": 1238,
    "niveau": { "lu_sous_voix": 8 }, "calque": "a15-coche", "pourquoi": "coche qui se trace" }
] }
```
- `arrivee` : donne l'`image`, ou le numéro du `mot` (`words.cut.json`) ou le `depart` de l'apparition (s), avec `h`, la
  hauteur des capitales ou de l'élément en px vidéo ; le script calcule l'image où il passe 50 % d'opacité (l'élément
  démarre à l'attaque de son mot, 0,1 s avant le début transcrit : `attaqueMot`).
- `frappe` : les images des lettres viennent du calque (la frappe d'une phrase a des pauses tirées au hasard dans
  l'animation). Pour un mot seul, `mot_seul` + `mot` ou `depart` : 18 lettres/s, première lettre au départ.
- `sur_mesure` : son généré pour cette vidéo, chemin absolu ; niveau 8 LU pour une arrivée, 9 LU pour un coup plus
  franc, jamais plus de 12.
- Fichiers et niveaux de la table ne se choisissent pas : le script les prend dans la bibliothèque.

### 3. Poser et contrôler
```
node scripts/sons.mjs poser "<dossier>"
```
Écrit `<dossier>/sons.json` (format du contrat `../animations/CONTRAT.md`, plus `geste` et `calque`) puis le contrôle. `verifier "<dossier>"`
refait le contrôle seul.
- `CONTROLE_OK` : passe à l'écoute.
- `ERREUR ...` (puis `CONTROLE_KO`) : son sur un geste interdit, sur les sous-titres ou un zoom ; fichier ou fiche
  introuvable ; image hors de la vidéo ; niveau qui n'est pas celui du style ; deux sons qui se marchent dessus.
  Corrige `gestes.json` et relance.
- `AVERTISSEMENT ...` : à regarder (faisceau hors d'une coupe, son au début d'un zoom), pas bloquant.

### 4. Écouter et mesurer
```
/usr/bin/python3 scripts/ecoute.py "<dossier>" [--autour <image>]
```
Fabrique la voix de la vidéo coupée exactement comme la brique rendu (même fonction), pose les sons comme le rendu le
fera (même limiteur de crête), écrit
`<dossier>/ecoute/ecoute.wav` (voix + sons), `sons-seuls.wav`, `ecoute.json`, puis mesure dans les fichiers écrits
chaque son sous la voix et le calage de son attaque.
- `ECOUTE_OK` : chaque son à son niveau (±1 dB) et à son image (±2 ms), crête du mix sous -1 dBFS (`LIMITEUR` dit
  ce que le limiteur a retiré, en dB et en ms).
- `ECOUTE_KO` : lis les lignes `MESURE KO` ; ne passe pas au rendu.
- `--autour <image>` : 4 s autour d'une image (`autour-<image>.wav`) pour juger un son en contexte. Pour un son
  généré, fais-le écouter à Romain (`open` sur le fichier) avant de le garder.

### 5. Générer un son (seulement si la table n'a rien)
Tous les sons du monteur viennent d'ElevenLabs. Un son qui manque à la table se génère :
```
/usr/bin/python3 scripts/generer.py "<prompt en anglais>" "<dossier>/sons/<nom>.wav"
```
- **Cache** : chaque génération est gardée sous l'empreinte de sa description (prompt, durée, influence) dans
  `~/.config/monteur-romain/sons-generes/`. La même description ne rappelle jamais l'API (`CACHE` dans la sortie) :
  réutilise mot pour mot le prompt d'un son qui a déjà plu (par exemple pour l'accroche :
  `one single crisp wooden clapperboard snap, short dry clack, mid-high tone, no reverb, no bass, isolated, very short`).
  `APPEL_ELEVENLABS` dit quand des crédits ont été consommés.
- Prompt : un seul coup, sec, médium, sans souffle, sans grave, sans réverbération, très court. Exemple qui a marché :
  `one single dry pencil tap on a wooden desk, short clean knock, warm mid tone, no hiss, no bass, no reverb, isolated, very short`.
  À éviter : « marker », « swoosh », « shimmer », « whoosh » (trop aigu ou rejeté).
- Le script coupe autour du coup principal, rampes 2 ms et 15 ms, filtre l'énergie vers 1 à 5 kHz, crête -6 dBFS, et
  écrit la fiche `<nom>.json` (attaque, spectre). `CONFORME` : pose-le en `sur_mesure`, puis écoute `--autour`.
  `NON_CONFORME` (trop aigu, trop grave, trop long) : change le prompt et régénère sous un autre nom. Chaque appel
  consomme des crédits ElevenLabs : trois essais au plus, puis pas de son.
- `--depuis <mp3>` retraite un brut déjà généré sans rappeler l'API.

## Ce qui reste dans le dossier
`gestes.json` (tes décisions), `sons.json` (lu par le rendu), `sons/` (sons générés pour cette vidéo, avec leur brut et
leur fiche), `ecoute/` (contrôle). Ne supprime pas `sons/` : `sons.json` y pointe en chemin absolu.

## Dépendances
- **Node 24** (`node`) : `sons.mjs` importe `commun.mjs` de la bibliothèque.
- **Python 3 de macOS** (`/usr/bin/python3`, 3.9) avec **numpy** et **scipy** (sonie K pondérée) :
  `/usr/bin/python3 -m pip install --user numpy scipy` s'ils manquent.
- **ffmpeg 7 ou plus** et **ffprobe** (`/opt/homebrew/bin/`, `brew install ffmpeg`).
- **Skill `animations` installé à côté** : sons et constantes lus dans `../animations/bibliotheque/` (`sons/`,
  `commun.mjs`). Option `--biblio <dossier>` pour une autre bibliothèque.
- **Brique couper-silences** passée avant : `words.cut.json`, `filtre.txt`, `edl.json`, `info.json` (chemin de la vidéo
  d'origine) dans le dossier de montage.
- **Clé ElevenLabs** pour `generer.py` seulement : ligne `ELEVENLABS_API_KEY=...` de `~/.config/monteur-romain/.env` sur
  le Mac de Romain (posée par le prompt d'installation ; la variable d'environnement du même nom passe avant), jamais
  dans un fichier de ce dépôt, jamais affichée. Sans elle, tout le reste marche ; seule la génération s'arrête sur
  `ERREUR CLE_MANQUANTE` (préviens Yoan).
- **Brique rendu installée à côté** : `ecoute.py` prend la voix et le limiteur dans `../rendu/scripts/rendu.py`.
- Licence des sons : générés avec ElevenLabs, usage commercial réglé par Yoan le 2026-11-11 ; le Vine boom est fourni
  par Yoan (`../animations/bibliotheque/sons/LICENCE.md`). Un son généré pour une vidéo est sous la licence ElevenLabs.
