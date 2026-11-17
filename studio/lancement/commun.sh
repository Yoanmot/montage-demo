#!/bin/bash
# Fonctions partagées du lancement du studio (à sourcer, ne se lance pas seul).
# Utilisé par ouvrir.sh, installation/studio.sh, installation/mettre-a-jour.sh et
# installation/desinstaller-studio.sh.
# Les valeurs propres au client (racine, label, appli, port...) viennent de client.sh.
# Variables de test (Yoan seulement) : STUDIO_LABEL (nom du service), HOME pointé vers un dossier de test,
# STUDIO_CLIENT / STUDIO_CLIENT_FICHIER (voir client.sh), STUDIO_SERVICES_DOSSIER (dossier du réglage
# du service au lieu de ~/Library/LaunchAgents) et STUDIO_APPLIS_DOSSIER (au lieu de ~/Applications) :
# un bac à sable avec le vrai HOME n'écrit rien chez l'utilisateur réel.

# shellcheck source=client.sh
. "$(dirname "${BASH_SOURCE[0]}")/client.sh"
if ! studio_client_charger; then
  echo "ECHEC client : $CLIENT_ERREUR" >&2
fi
STUDIO_RACINE="$CLIENT_RACINE"
STUDIO_LABEL="${STUDIO_LABEL:-$CLIENT_LABEL}"
STUDIO_HOME="$STUDIO_RACINE/studio"
STUDIO_CONF="$STUDIO_HOME/studio.config.json"
STUDIO_PLIST="${STUDIO_SERVICES_DOSSIER:-$HOME/Library/LaunchAgents}/$STUDIO_LABEL.plist"
STUDIO_APP_NOM="$CLIENT_APPLI_NOM"
STUDIO_APP="${STUDIO_APPLIS_DOSSIER:-$HOME/Applications}/$STUDIO_APP_NOM.app"
STUDIO_REPERE_REDEMARRAGE="$STUDIO_HOME/redemarrage-demande"
STUDIO_DOMAINE="gui/$(id -u)"

# Une valeur simple de la config (plutil lit le JSON), ou la valeur par défaut.
studio_conf() { # $1 clé, $2 défaut
  local v
  v="$(/usr/bin/plutil -extract "$1" raw -o - "$STUDIO_CONF" 2>/dev/null)"
  if [ -z "$v" ] || [ "$v" = "null" ]; then v="$2"; fi
  printf '%s' "$v"
}

# Chemin de la config avec ~ développé.
studio_chemin() { # $1 valeur
  case "$1" in
    "~") printf '%s' "$HOME";;
    "~/"*) printf '%s/%s' "$HOME" "${1#\~/}";;
    *) printf '%s' "$1";;
  esac
}

studio_port() { studio_conf port "$CLIENT_PORT"; }

# Code HTTP de GET / (000 si personne ne répond).
studio_repond() {
  local p; p="$(studio_port)"
  curl -s -o /dev/null --max-time 3 -w '%{http_code}' -H "Host: 127.0.0.1:$p" "http://127.0.0.1:$p/" 2>/dev/null || true
}

studio_charge() { launchctl print "$STUDIO_DOMAINE/$STUDIO_LABEL" >/dev/null 2>&1; }

# PID du serveur suivi par launchd (vide s'il ne tourne pas).
studio_pid() {
  launchctl print "$STUDIO_DOMAINE/$STUDIO_LABEL" 2>/dev/null | awk '$1 == "pid" && $2 == "=" { print $3; exit }'
}

# Au repos : le serveur ne tourne pas, ou il n'a aucun processus enfant (session Claude, rangement,
# publication...). Les sessions sont dans leur propre groupe de processus mais restent ses enfants.
studio_au_repos() {
  local pid; pid="$(studio_pid)"
  [ -z "$pid" ] && return 0
  [ -z "$(pgrep -P "$pid" 2>/dev/null)" ]
}

# Charge le service s'il ne l'est pas, puis le démarre s'il ne tourne pas.
studio_demarrer() {
  if ! studio_charge; then
    [ -f "$STUDIO_PLIST" ] || return 1
    launchctl bootstrap "$STUDIO_DOMAINE" "$STUDIO_PLIST" 2>/dev/null || true
  fi
  [ -n "$(studio_pid)" ] || launchctl kickstart "$STUDIO_DOMAINE/$STUDIO_LABEL" >/dev/null 2>&1 || true
  studio_charge
}

# Attend que GET / réponde 200 (jusqu'à $1 secondes).
studio_attendre() {
  local i=0 max=$(( ${1:-20} * 2 ))
  while [ "$i" -lt "$max" ]; do
    [ "$(studio_repond)" = "200" ] && return 0
    sleep 0.5; i=$((i + 1))
  done
  return 1
}

# Redémarre le service si un redémarrage est demandé (code du studio changé) et qu'il est au repos.
# Rend : REDEMARRE, ATTEND (occupé, repère gardé), RIEN (pas demandé ou service absent).
studio_redemarrer_si_demande() {
  [ -f "$STUDIO_REPERE_REDEMARRAGE" ] || { echo RIEN; return 0; }
  if ! studio_charge; then rm -f "$STUDIO_REPERE_REDEMARRAGE"; echo RIEN; return 0; fi
  if studio_au_repos; then
    launchctl kickstart -k "$STUDIO_DOMAINE/$STUDIO_LABEL" >/dev/null 2>&1 || true
    rm -f "$STUDIO_REPERE_REDEMARRAGE"
    echo REDEMARRE
  else
    echo ATTEND
  fi
}

# Connexion de claude sans personne devant (lot 11) : le jeton longue durée de « claude setup-token »,
# posé par installation/cles.sh claude dans <racine>/claude.env (600). Exporté s'il existe et
# qu'aucun jeton n'est déjà dans l'environnement ; sinon claude garde la connexion du Mac (qui expire).
# Rend 0 si un jeton est exporté. N'affiche jamais la valeur.
STUDIO_JETON_CLAUDE="$STUDIO_RACINE/claude.env"
studio_jeton_claude() {
  [ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && return 0
  [ -f "$STUDIO_JETON_CLAUDE" ] || return 1
  local v
  v="$(sed -n 's/^CLAUDE_CODE_OAUTH_TOKEN=//p' "$STUDIO_JETON_CLAUDE" 2>/dev/null | tail -1 | tr -d "\"' \r")"
  [ -n "$v" ] || return 1
  export CLAUDE_CODE_OAUTH_TOKEN="$v"
}
