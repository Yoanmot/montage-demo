# Lancement du studio sur le Mac de Romain

Ce dossier contient ce qui fait tourner le studio comme une appli : le service qui démarre à
l'ouverture de session, l'appli « Studio » du Dock et son icône. L'installation elle-même est dans
`installation/studio.sh` (appelé par `installation/installer.sh`).

| Fichier | Rôle |
|---|---|
| `demarrer.sh` | ce que lance le service : trouve `node` et `claude`, puis `node serveur/studio.mjs` |
| `ouvrir.sh` | vérifie que le studio répond (le démarre sinon), lit le jeton ; `--adresse` rend l'adresse à l'appli Mac, `--navigateur` ouvre le navigateur (repli) |
| `appli/Studio.swift`, `appli/Studio` | l'appli Mac du Dock (fenêtre WebKit, une seule fenêtre, point sous l'icône, Cmd+Tab) ; `appli/Studio` est le binaire universel (Apple et Intel) signé ad hoc, construit sur le Mac de Yoan par `appli/construire.sh` et gardé dans le dépôt : rien à compiler chez le client |
| `appli.sh` | pose ou remplace l'appli dans `~/Applications` (installation, mise à jour automatique, première ouverture depuis l'ancienne icône) ; si le binaire ne se lance pas sur ce Mac, pose le repli (script qui ouvre le navigateur) |
| `icone.svg` | dessin de l'icône (source) |
| `icone.icns` | icône de l'appli, fabriquée par `fabriquer-icone.sh` (Chrome sans fenêtre, `sips`, `iconutil`) et gardée dans le dépôt : rien à fabriquer chez Romain |

Sur le Mac :
- service : `~/Library/LaunchAgents/com.montage-yoan.studio.plist` (au démarrage de session, relancé
  s'il tombe en erreur), journal de lancement `~/.montage-yoan/studio/lancement.log` ;
- appli : `~/Applications/Studio.app`, l'appli Mac (2026-11-18). Elle demande l'adresse du jour à
  `ouvrir.sh --adresse` (qui démarre le service s'il le faut) et l'affiche dans sa fenêtre. Un clic sur
  l'icône ramène la fenêtre ouverte (jamais une deuxième) et revérifie le jeton ; fermer la fenêtre ou
  quitter l'appli n'arrête pas le service. Les liens vers ailleurs s'ouvrent dans le navigateur, les
  vidéos se lisent dans la fenêtre, la dictée (deux fois fn) marche dans les champs. Si la page ne
  s'affiche pas (trois essais), l'appli ouvre le studio dans le navigateur et se ferme. La mise à jour
  automatique remplace l'appli quand elle change, au même chemin : l'icône du Dock reste à sa place et
  aucun réglage du Dock n'est écrit. Journal : `ouvrir.log` (lignes « appli ... ») ;
- Dock : l'icône est ajoutée une seule fois (repère `~/.montage-yoan/studio/.dock-ajoute`) ; si Romain
  la retire, on ne la remet pas.

## Un studio par client (2026-11-17)
Le même code sert plusieurs clients. `client.sh` lit `studio/clients/<id>.json` (contrat, section 7) et
donne aux scripts la racine, le label du service, le nom et l'icône de l'appli, le port, le dépôt du head
of content et sa clé SSH, la branche suivie par la mise à jour et le dossier de config Claude. Le client
vient de `STUDIO_CLIENT`, sinon de `<racine>/client.json` (posé par l'installation), sinon « romain ».
Chez Romain rien ne change : `~/.montage-yoan`, `~/.claude`, `com.montage-yoan.studio`, `Studio.app`.
Un client avec `config_claude` (ex. Yoan, racine `/Users/Shared/studio-yoan`) est **isolé** : skills, agent,
mémoire et hook sont reliés dans sa config Claude, le service et `demarrer.sh` posent `CLAUDE_CONFIG_DIR`,
la clé et le cache des sons vont dans `<racine>/monteur/` (`MONTEUR_CONFIG`), et l'installation finit par
`installation/isolation.sh` (preuve que les sessions ne voient ni `~/.claude` ni un `CLAUDE.md` hors de la
racine). La racine d'un client isolé doit être hors de la maison : sous `~`, claude lit `~/.claude/CLAUDE.md`
comme instructions du projet, même avec `CLAUDE_CONFIG_DIR` (constaté le 2026-11-17). Icône d'un client :
`icones/<appli.icone>.icns`, sinon l'icône par défaut.

### Installation d'essai (`simulation_forcee`, 2026-11-18)
Un client marqué `"simulation_forcee": true` (ex. `romain-test` : le studio de Romain installé à part sur le
Mac de Yoan, `/Users/Shared/studio-romain-test`, port 4749, appli « Studio Romain (test) ») ne peut rien
publier : `demarrer.sh` et le service posent `STUDIO_SIMULATION=1`, retirent toute variable Zernio et
pointent `ZERNIO_ENV_FILE` sur `/dev/null` ; l'installation met `publication.simulation` à vrai ;
`cles.sh` refuse la clé Zernio (`CLE_INTERDITE`) ; `verifier.sh` échoue si une clé est posée. Son head of
content est un dépôt nu local (`installation/hoc-essai.sh` : `preparer`, `proteger`, `tirer`, `etat`) :
aucun envoi possible vers GitHub, retouches de Yoan tirées de sa copie du dépôt.
Pour toute installation : `<racine>/branche` (une ligne) fait suivre une autre branche que
`branche_mise_a_jour` (tester une branche pas encore livrée) ; le retirer pour revenir à celle du client.

## Décision : la copie de travail du head of content pour le studio (2026-11-15)

### Ce qui existe aujourd'hui
- `~/.montage-yoan/head-of-content` est un clone SSH du dépôt privé `Yoanmot/head-of-content-romain`,
  avec la clé du Mac `~/.ssh/fitavecromain_head_of_content` (créée par `installer.sh`, réglée dans
  `core.sshCommand`). Ce n'est **pas** une copie en lecture seule : l'installeur demande à Yoan
  d'ajouter cette clé comme **clé de déploiement avec écriture** (`A_FAIRE CLE_HOC`), et les scripts du
  Mac poussent déjà avec elle (`a-rendre.py` « Mac de Romain : … rendu » dans `rendus/registre.json`,
  `zernio.py` dans `publications/registre.json`, tous les deux `push origin HEAD:main`, rejeu sur
  refus, jamais de forçage).
- Mais cette copie est **alignée de force** sur le dépôt en ligne (`checkout -f -B main origin/main`) par
  ces scripts et par la mise à jour automatique à chaque ouverture de Claude. Un fichier que le head of
  content écrirait dedans pendant une session du studio (un script pas encore enregistré) serait
  effacé au passage suivant. Elle ne peut donc pas servir de copie de travail.
- État vérifié sur GitHub le 2026-11-15 : une seule clé de déploiement sur le dépôt, celle du serveur
  de veille (« veille montage-romain (écriture) »). La clé du Mac de Romain n'y est pas encore, et
  Romain n'est pas encore collaborateur.

### Options
1. **Même clé de déploiement, en écriture, pour une deuxième copie** (`~/.montage-yoan/studio/head-of-content`).
   Une clé de déploiement donne accès au dépôt, pas à un dossier : la même clé sert aux deux copies du
   même Mac. Romain n'a rien à faire de plus que ce que l'installation lui demande déjà (envoyer la clé
   de son Mac à Yoan par WhatsApp, une fois).
2. **Compte GitHub de Romain par `gh auth login`**. Il faut que Romain se connecte à GitHub dans son
   navigateur (code à 8 caractères, autorisation), que l'invitation de collaborateur soit acceptée, et
   le jeton de `gh` expire ou se révoque sans prévenir. Plus de manipulations, plus de pannes possibles,
   et les commits seraient signés de son nom pour des écritures faites par des scripts.

### Choix : option 1
- La copie du studio est un **deuxième clone**, avec la même clé et les mêmes réglages que la copie
  des scripts (`core.sshCommand`, auteur « Mac de Romain », les messages du studio commencent par
  « Studio : »). Seul le studio la synchronise (`git pull --rebase` puis push, rejoué une fois sur
  conflit, section 4 du contrat). Ni la mise à jour automatique, ni les scripts de rendu ou de
  publication ne l'alignent de force. La copie des scripts reste telle qu'elle est.
- Si l'accès manque, `installation/studio.sh` le dit avec le même code que l'installeur
  (`A_FAIRE CLE_HOC`, avec la clé publique) : une seule manipulation couvre les deux copies.
- L'installation vérifie aussi le **droit d'écriture** sans rien envoyer (`git push --dry-run` : GitHub
  refuse la connexion d'envoi à une clé en lecture seule). Clé ajoutée sans écriture :
  `A_FAIRE CLE_HOC_ECRITURE`.
- Le compte GitHub de Romain reste utile pour ouvrir une session cloud depuis son téléphone (décision
  du 2026-11-08) ; il n'intervient pas sur le Mac.

### Ce que Yoan fait sur GitHub (une fois, au moment de l'installation)
Quand Romain lui envoie la clé de son Mac (une ligne `ssh-ed25519 AAAA… mac-romain-head-of-content`) :
dépôt `Yoanmot/head-of-content-romain` > Settings > Deploy keys > Add deploy key, titre « Mac de
Romain », coller la clé, **cocher « Allow write access »**, Add key. Ou en une commande :

```
pbpaste > /tmp/cle-mac-romain.pub
gh repo deploy-key add /tmp/cle-mac-romain.pub --repo Yoanmot/head-of-content-romain --title "Mac de Romain" --allow-write
```

Rien d'autre : pas de deuxième clé pour le studio.

## Mise à jour du studio
La mise à jour automatique (`installation/mettre-a-jour.sh`, à chaque ouverture de Claude) aligne le
code. Si le dossier `studio/` a changé, elle pose le repère `~/.montage-yoan/studio/redemarrage-demande`
puis redémarre le service (`launchctl kickstart -k`) **seulement si le studio est au repos** (aucun
processus enfant du serveur : ni session Claude, ni rangement, ni publication). Sinon le repère
reste, et le redémarrage se fait à la prochaine ouverture de Claude au repos ou au prochain clic sur
l'icône Studio (`ouvrir.sh` fait la même vérification avant d'ouvrir la fenêtre). Un redémarrage
pendant une session tuerait la session : les sessions du studio lancent elles-mêmes la mise à jour
automatique (elles ouvrent Claude), d'où cette règle.

## Désinstallation
`installation/desinstaller-studio.sh` : arrête et retire le service, retire l'appli et son icône du
Dock, garde l'état du studio dans `~/.montage-yoan/anciennes-versions/`. Ne touche jamais au dossier
des vidéos (`~/Contenu`), ni à la copie de travail du head of content si elle a du travail pas envoyé.

## Tests de Yoan (sans toucher son installation)
Variables : `HOME` vers un dossier de test, `STUDIO_LABEL` (autre nom de service), `STUDIO_SANS_DOCK=1`
(le Dock se règle pour l'utilisateur réel, quel que soit `HOME`), `STUDIO_SANS_SERVICE=1`, `HOC_DEPOT_URL`
(dépôt local), `STUDIO_CLIENT_FICHIER` (client hors du dépôt), `STUDIO_SERVICES_DOSSIER` et
`STUDIO_APPLIS_DOSSIER` (bac à sable avec le vrai `HOME` : rien dans `~/Library/LaunchAgents` ni
`~/Applications`). Tests de l'installation : `cd installation && node --test tests/*.test.mjs`.
