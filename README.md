# Montage automatique (skills Claude)

Agent et skills de montage pour Claude Code sur Mac (app Claude, onglet Code, session locale).

## L'agent
- `agents/monteur.md` : le monteur. Coupe et transcrit la vidéo, regarde les clips filmés en plus, écrit lui-même le
  plan de montage sur ce que Romain a vraiment dit, le fait valider, puis fabrique (zooms, animations, sous-titres,
  B-rolls, sons, rendu), vérifie la vidéo, fait les retouches et retient les goûts durables de Romain. S'installe dans
  `~/.claude/agents/monteur.md`.
- `agents/monteur-memoire/` : modèles de sa mémoire (`preferences.md`, `demandes-pour-yoan.md`, `MEMORY.md`), copiés
  dans `~/.claude/agent-memory/monteur/` **seulement s'ils n'y sont pas** : une réinstallation ne les écrase jamais.

## Les briques du monteur (appelées par l'agent, pas directement)
- `skills/couper-silences` : coupe les silences, les reprises (garde la dernière prise) et les faux départs (une vidéo
  sans parole est gardée entière, sans coupe).
- `skills/plan-montage` : écrit le plan de montage après le tournage, sur la transcription et les clips fournis (règles,
  gestes du style, format du plan, retours de Yoan).
- `skills/sous-titres` : sous-titres au style de Romain (classique ou formelle avec mots forts), orthographe corrigée.
- `skills/zooms` : zooms éclair, rapprochements et dézoom d'ouverture de l'accroche, repérés par la phrase dite.
- `skills/b-roll` : ses clips filmés (démos, scènes tournées pour le brief) posés sur les phrases du plan, calés sur les
  coupes, accélérés au besoin pour tenir le passage. Jamais de B-roll généré par IA.
- `skills/animations` : hooks, cartes, pleins écrans, listes, tier list, transitions, CTA, effets sur mesure, au style
  de Romain ; contient `bibliotheque/` (règles, polices, sons), lue par les autres briques.
- `skills/sound-design` : règles des sons du style (clic sur les transitions, Vine boom sur les images de réaction,
  accroche et quelques moments forts), calage à l'image, contrôle des niveaux, sons générés avec ElevenLabs (en cache).
- `skills/rendu` : planche de validation, puis la vidéo en un seul encodage depuis l'originale (HDR et 60 i/s
  convertis, 1080 x 1920, 20 Mo au plus).

Tout tourne en Node et en Python (aucun PowerShell). Ce qu'il faut sur le Mac : Node 24, ffmpeg 7 ou plus, Python 3
du système avec numpy, scipy, Pillow, fontTools, uharfbuzz, pyobjc (Quartz, Vision), et les codes d'accès : celui du
serveur de transcription (`~/.montage-yoan/config`) et la clé ElevenLabs (`ELEVENLABS_API_KEY=...` dans
`~/.config/monteur-romain/.env`), jamais dans ce dépôt.

Contrat entre les briques : `skills/animations/CONTRAT.md` (source unique, installé avec le skill animations dans
`~/.claude/skills/animations/CONTRAT.md` ; l'agent et toutes les briques le lisent là). Format du plan de montage :
`skills/plan-montage/references/format.md` (source unique, le contrat y renvoie).

## Les carrousels (hors monteur)
- `skills/carrousel` : met en page un carrousel Instagram (1080 × 1350) au style Fit avec Romain, à partir de ses photos
  et de son texte exact. Fond noir ou photo.
- `skills/carrousels-en-attente` : met en page, un par un, les carrousels validés avec le head of content, puis les
  range pour qu'ils ne reviennent jamais (état tenu par un script, pas par Claude).

## Installer

Dans l'app Claude, onglet Code, en session locale, colle le prompt d'installation fourni par Yoan.
