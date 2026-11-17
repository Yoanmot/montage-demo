#!/bin/bash
# Lance le serveur du studio. Appelé par le service launchd (label du client), jamais à la main.
# Le service ne passe pas par le profil du shell : on pose ici le chemin des outils (node, claude,
# ffmpeg, python3, git), puis on remplace ce script par node (le service suit le PID du serveur).
# Sortie 0 sans relance si le code du serveur manque ; 1 (relance par launchd) si node manque.

CODE="$(cd "$(dirname "$0")/.." && pwd)"
SERVEUR="$CODE/serveur/studio.mjs"
# shellcheck source=commun.sh
. "$(dirname "$0")/commun.sh"

chemin="$STUDIO_RACINE/bin:$HOME/.local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:$HOME/.claude/local:/usr/bin:/bin:/usr/sbin:/sbin"
# Ce que le service a reçu (dossier de claude ou de node trouvés ailleurs à l'installation) passe devant.
case ":${PATH:-}:" in *":$HOME/.local/bin:"*) chemin="$PATH";; *) chemin="${PATH:+$PATH:}$chemin";; esac
export PATH="$chemin"
export LANG="${LANG:-fr_FR.UTF-8}" LC_CTYPE="${LC_CTYPE:-fr_FR.UTF-8}"
# Le client et sa racine passent au serveur, donc à chaque session et à chaque script qu'elle lance.
export STUDIO_CLIENT="$CLIENT_ID" STUDIO_RACINE STUDIO_HOME
# Client isolé : sa configuration Claude à lui (skills, agent, mémoire, hook, connexion), jamais ~/.claude ;
# la clé et le cache des sons dans sa racine.
if [ -n "$CLIENT_ISOLE" ]; then
  export CLAUDE_CONFIG_DIR="$CLIENT_CONFIG_CLAUDE" MONTEUR_CONFIG="$CLIENT_SONS" MONTEUR_SONS_CACHE="$CLIENT_SONS/sons-generes"
fi

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
if [ -n "$CLIENT_ERREUR" ]; then echo "$(horodate) CLIENT_ILLISIBLE $CLIENT_ERREUR"; exit 1; fi
echo "$(horodate) DEMARRAGE client=$CLIENT_ID node=$NODE ($("$NODE" -v 2>/dev/null)) claude=${CLAUDE:-introuvable} connexion=$connexion config_claude=${CLAUDE_CONFIG_DIR:-~/.claude} code=$CODE"

cd "$CODE" || exit 1
exec "$NODE" "$SERVEUR"
