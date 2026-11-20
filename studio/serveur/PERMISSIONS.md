# Permissions des sessions `claude` du studio

Décision du lot 1 (2026-11-15), appliquée dans `reglages.mjs` (garder les deux d'accord).
Contrat : `CONTRAT-STUDIO.md`, section 9.

## Le problème

Le studio lance `claude -p` sans personne devant le terminal : une question de permission resterait
sans réponse et bloquerait la session. Il faut donc des sessions qui ne demandent rien, mais qui ne
peuvent pas tout faire.

## Le choix : `--permission-mode dontAsk` + une liste blanche + des refus

Chaque session est lancée avec :

```
claude -p --input-format stream-json --output-format stream-json --verbose --include-partial-messages
       --permission-mode dontAsk
       --allowedTools "<liste blanche>"
       --settings '{"permissions":{"deny":[...]}}'
       [--agent monteur] [--add-dir ...] [--resume <session>] [--model ...]
```

- **`dontAsk`** : tout ce qui n'est pas dans la liste blanche est refusé d'office, sans question
  (le modèle reçoit le refus et le dit). Ni `bypassPermissions` ni `--dangerously-skip-permissions`.
- **Liste blanche** (`--allowedTools`) : lecture et recherche (`Read`, `Glob`, `Grep`), `Bash`,
  `Skill`, `Task`/`Agent` (sous-agents du monteur), `WebFetch`/`WebSearch` (le head of content
  vérifie une source), `TodoWrite`, `ToolSearch`, `Monitor`, `TaskOutput`, `TaskStop`, `SendMessage`.
- **Écritures de fichiers bornées** : `Edit(./**)`, `Write(./**)`, `NotebookEdit(./**)`, c'est-à-dire
  le dossier de la session (le dépôt du head of content, ou `MEDIA/<slug>/` pour le monteur),
  plus `~/.claude/agent-memory/**` (la mémoire des préférences du monteur). Une écriture ailleurs est
  refusée. Vérifié avec le vrai `claude` 2.1.325 : écriture dans le dossier acceptée, écriture dans
  un dossier voisin refusée « mode don't ask ».
  **Lot 12 (2026-11-20)** : la même règle est aussi posée par le chemin absolu du dossier de la session
  (`Edit(//<dossier>/**)`, `Write(...)`, `NotebookEdit(...)`). Claude résout `./` depuis le dossier
  courant du shell, que chaque `cd` de l'outil Bash déplace : après `cd outils`, `Write contenus/...`
  était refusé (vu en essai réel). La règle absolue ne bouge pas avec le shell.
- **Conversations gardées** : `cleanupPeriodDays: 3650` dans les réglages passés par `--settings`
  (Claude efface sinon les conversations inactives depuis 30 jours). Si une conversation a quand même
  disparu, le pont repart sur une conversation neuve pour ce chat, sans erreur visible.
- **Liberté (2026-11-19, demande de Yoan pour Yoan et Romain)** : l'agent fait ce qu'on lui demande,
  comme Claude Code dans un terminal, même hors du flux prévu (un plan en plus du brief, des images
  dans le dossier du contenu, un brief changé, une étape refaite). Donc, en plus :
  - toutes les sessions écrivent dans tout `MEDIA/**` (`Edit`/`Write`, et `--add-dir MEDIA`) : une
    vidéo, une image ou un fichier demandé pour un contenu, la bibliothèque des clips ;
  - le monteur écrit aussi dans `DEPOT/contenus/**` (`--add-dir` aussi) : un brief changé à sa
    demande, enregistré ensuite comme le fait le head of content (pull, commit, push) ;
  - variables `STUDIO_MEDIA` et `STUDIO_DEPOT` pour que l'agent sache où ranger.
  La consigne du studio et la tête de chaque agent posent le principe (« le déroulé dit ce que tu
  fais quand on ne demande rien, jamais une limite ») et la liste de ce qui reste fermé.
- **Modèle** (2026-11-19) : `--model` vient de `claude.modele` de `studio.config.json`, sinon de
  `claude.modele` du fichier du client (`clients/<id>.json`), sinon rien (l'abonnement choisit).
  `claude.modele_sous_agents` du client pose `CLAUDE_CODE_SUBAGENT_MODEL` (sous-agents intégrés
  compris) ; `claude.modele_rangement` suit la même règle pour le regard du rangement (sonnet si rien).
  Yoan : opus partout. Romain : rien de fixé, comme avant (son abonnement n'est pas confirmé).
- **Mise en page d'un carrousel** (gabarit du lot 5) : en plus, `--add-dir` sur les skills,
  `MEDIA/<slug>/photos` et le dossier des slides (config `carrousels`, `~/Pictures/Carrousels` par défaut), et l'écriture permise dans ce dernier seulement.
- **Monteur** : `--agent monteur`, dossier `MEDIA/<slug>/`, `--add-dir` sur les skills, variables
  `STUDIO=1` et `MONTEUR_SK=<skills>`.
- **Chat général, chats de contenu, tournage** : dossier du dépôt, pas de `--agent` (l'agent
  `head-of-content` démarre par `DEPOT/.claude/settings.json`), aucun `--add-dir`.
- **Toutes les sessions** (lot 13) : variable `STUDIO=1` et `--append-system-prompt` avec la consigne
  « chat du studio » (`CONSIGNE_STUDIO` de `reglages.mjs`) : ne pas recopier dans le chat ce que le
  studio affiche déjà, une ou deux phrases et où le voir. Hors studio (téléphone, cloud), rien ne
  l'ajoute : le chat montre le contenu.

## Les refus (`--settings`, `permissions.deny`)

Un refus gagne sur toute permission, y compris celles des réglages de l'utilisateur ou du projet.

| Refus | Pourquoi |
|---|---|
| `Read`/`Edit` de `~/.ssh/**`, `<racine>/*.env` (`~/.montage-yoan/*.env` chez Romain), `~/.config/monteur-romain/**`, `~/.aws/**`, `~/.gnupg/**`, et `<config_claude>/.credentials.json` pour un client à configuration Claude isolée | secrets (clés Zernio, serveur, SSH, connexion Claude) |
| `Edit` de `settings*.json`, `CLAUDE.md`, `agents/**`, `skills/**`, `hooks/**` dans `~/.claude` et dans le dossier `config_claude` du client, fichiers de démarrage du shell, `~/Library/LaunchAgents/**` | une session ne change pas ses propres règles ni ce qui se lance au démarrage |
| `Edit`/`Write` de `<racine>/montage-demo/**` (code du studio, agents et skills d'origine), `<racine>/studio/studio.config.json`, `<racine>/client.json` | une session ne modifie pas le studio lui-même ; s'il le demande, l'agent dit en une phrase que ça se fait avec Yoan (ou, chez Yoan, en dehors du studio). Aucun refus `Bash` sur ce dossier : les scripts des skills (reliés depuis `montage-demo/skills`) se lancent toujours |
| `Bash(rm -rf /*)`, `Bash(rm -rf ~*)`, `Bash(rm -rf ..*)`, `Bash(rm -rf $HOME*)` et les variantes `-fr`, `-r -f`, `-Rf`, `-r` | pas de suppression hors du dossier de la session (chemin absolu, maison, remontée) |
| `Bash(git push --force*)`, `-f`, `--force-with-lease`, `git reset --hard*`, `git clean *` | jamais de force sur le dépôt du client |
| `Bash(*/.ssh*)`, `Bash(*~/.ssh*)`, `Bash(*zernio.env*)`, `Bash(*monteur-romain/.env*)` (et, hors Romain, `Bash(*elevenlabs.env*)`, `Bash(*claude.env*)`) | les secrets ne passent pas non plus par une commande |
| `Bash(*ZERNIO_ECRITURE*)` (garde-fou générique `ZERNIO_ECRITURE=<compte>`), `Bash(*ZERNIO_ECRITURE_ROMAIN*)`, `Bash(*zernio.py publier*--envoyer*)` | rien ne part sur Instagram depuis un chat : seulement par le clic de confirmation du studio |
| Client d'essai à `stats_reelles` (romain-test) : `Bash(*zernio-lecture*)`, `Bash(*ZERNIO_ENV_FILE*)`, `Bash(*ZERNIO_API_KEY*)` | la clé de lecture des chiffres (`<racine>/zernio-lecture.env`, déjà couverte par `<racine>/*.env`) ne passe par aucune commande ; seul le serveur la donne à `zernio.py stats` |
| `Bash(sudo *)`, `Bash(security *)`, `Bash(launchctl *)`, `Bash(defaults write*)` | trousseau, services, réglages du Mac |

Vérifié avec le vrai `claude` : les refus `Bash` s'appliquent aussi dans une commande composée
(`echo x && rm -rf ../dossier` est refusé).

## L'environnement

Le serveur retire de l'environnement de chaque session `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`
(la session tourne sur l'abonnement du client, jamais sur une clé d'API), `ZERNIO_ECRITURE`,
`ZERNIO_ECRITURE_ROMAIN` et `ZERNIO_API_KEY`, et les variables d'une session Claude parente. Pour un
client à configuration Claude isolée (`config_claude` non nul), il pose `CLAUDE_CONFIG_DIR` sur ce
dossier dans chaque session ; la mémoire des agents permise en écriture est `<config_claude>/agent-memory/**`
(au lieu de `~/.claude/agent-memory/**`).

## Limites connues (à savoir, pas à cacher)

- `Bash` reste ouvert (le monteur en a besoin : ffmpeg, pwsh, node, python). Une commande peut donc
  écrire hors du dossier par un chemin que les motifs ne voient pas (`cp`, `>`, un script). Les refus
  couvrent les cas graves connus ; le reste repose sur les agents, qui n'ont aucune raison d'écrire
  ailleurs. Pour fermer ce point, la piste est le bac à sable de `claude` (`sandbox` dans
  `--settings`, écriture limitée au dossier pour `Bash`), à essayer au lot 7 avec un vrai montage
  (ffmpeg, Chrome sans tête, pwsh) avant de l'activer.
- `rm -rf /chemin/absolu/dans/le/dossier` est aussi refusé (le motif ne distingue pas) : l'agent
  doit passer par un chemin relatif. Gêne mineure, voulue.
- Les motifs `Bash(...)` sont des correspondances de texte : une variante écrite autrement
  (variable, alias) peut passer. Le studio ne compte pas sur eux seuls pour la publication : la
  vraie garde est que `ZERNIO_ECRITURE` (ni `ZERNIO_ECRITURE_ROMAIN`) n'est jamais dans l'environnement
  d'une session.
