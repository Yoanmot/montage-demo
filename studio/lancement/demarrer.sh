#!/bin/bash
# Lance le serveur du studio. Appelé par le service launchd (com.montage-yoan.studio), jamais à la main.
# Le service ne passe pas par le profil du shell : on pose ici le chemin des outils (node, claude,
# ffmpeg, python3, git), puis on remplace ce script par node (le service suit le PID du serveur).
# Sortie 0 sans relance si le code du serveur manque ; 1 (relance par launchd) si node manque.

CODE="$(cd "$(dirname "$0")/.." && pwd)"
SERVEUR="$CODE/serveur/studio.mjs"
# shellcheck source=commun.sh
. "$(dirname "$0")/commun.sh"

chemin="$HOME/.montage-yoan/bin:$HOME/.local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:$HOME/.claude/local:/usr/bin:/bin:/usr/sbin:/sbin"
# Ce que le service a reçu (dossier de claude ou de node trouvés ailleurs à l'installation) passe devant.
case ":${PATH:-}:" in *":$HOME/.local/bin:"*) chemin="$PATH";; *) chemin="${PATH:+$PATH:}$chemin";; esac
export PATH="$chemin"
export LANG="${LANG:-fr_FR.UTF-8}" LC_CTYPE="${LC_CTYPE:-fr_FR.UTF-8}"

horodate() { date '+%Y-%m-%d %H:%M:%S'; }

if [ ! -f "$SERVEUR" ]; then
  echo "$(horodate) SERVEUR_ABSENT $SERVEUR : rien à lancer (relancer l'installation)"
  exit 0
fi
NODE="$(command -v node 2>/dev/null || true)"
if [ -z "$NODE" ]; then
  echo "$(horodate) NODE_ABSENT dans $PATH"
  exit 1
fi
CLAUDE="$(command -v claude 2>/dev/null || true)"
# Le jeton de connexion de claude (cles.sh claude) passe au serveur, donc à chaque session.
if studio_jeton_claude; then connexion="jeton"; else connexion="celle du Mac"; fi
echo "$(horodate) DEMARRAGE node=$NODE ($("$NODE" -v 2>/dev/null)) claude=${CLAUDE:-introuvable} connexion=$connexion code=$CODE"

cd "$CODE" || exit 1
exec "$NODE" "$SERVEUR"
