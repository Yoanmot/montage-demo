# Lancement du studio sur le Mac de Romain

Ce dossier contient ce qui fait tourner le studio comme une appli : le service qui démarre à
l'ouverture de session, l'appli « Studio » du Dock et son icône. L'installation elle-même est dans
`installation/studio.sh` (appelé par `installation/installer.sh`).

| Fichier | Rôle |
|---|---|
| `demarrer.sh` | ce que lance le service : trouve `node` et `claude`, puis `node serveur/studio.mjs` |
| `ouvrir.sh` | ce que lance l'appli Studio : vérifie que le studio répond (le démarre sinon), lit le jeton, ouvre la fenêtre |
| `icone.svg` | dessin de l'icône (source) |
| `icone.icns` | icône de l'appli, fabriquée par `fabriquer-icone.sh` (Chrome sans fenêtre, `sips`, `iconutil`) et gardée dans le dépôt : rien à fabriquer chez Romain |

Sur le Mac :
- service : `~/Library/LaunchAgents/com.montage-yoan.studio.plist` (au démarrage de session, relancé
  s'il tombe en erreur), journal de lancement `~/.montage-yoan/studio/lancement.log` ;
- appli : `~/Applications/Studio.app` (un petit paquet dont l'exécutable appelle `ouvrir.sh` du
  dépôt : une amélioration de `ouvrir.sh` arrive avec la mise à jour automatique, sans refaire l'appli) ;
- Dock : l'icône est ajoutée une seule fois (repère `~/.montage-yoan/studio/.dock-ajoute`) ; si Romain
  la retire, on ne la remet pas.

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
(le Dock se règle pour l'utilisateur réel, quel que soit `HOME`), `HOC_DEPOT_URL` (dépôt local).
