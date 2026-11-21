#!/bin/bash
# Connexion du studio d'un client à son compte Claude, sans Terminal ni copier-coller :
#   /bin/bash <racine>/montage-demo/installation/connexion-claude.sh
# Lance lui-même « claude setup-token » dans un pseudo-terminal (script), dans la config Claude du client :
# le navigateur du client s'ouvre sur claude.ai, il clique sur Accepter, claude reçoit la réponse tout seul
# (adresse de retour sur ce Mac) et affiche le jeton d'un an. Le script le lit dans la sortie du pseudo-terminal
# (fichier 600 dans un dossier 700, effacé aussitôt), arrête claude, et passe le jeton à cles.sh --stdin claude
# (écrit en 600, date de pose notée, vérifié par une session d'essai, studio redémarré au repos). Le jeton
# n'apparaît jamais sur la sortie, dans la liste des processus ni dans la conversation.
# Sortie, une ligne lue par Claude (jamais montrée telle quelle) :
#   CONNEXION_DEJA                 un jeton est déjà posé et une session d'essai répond : rien à faire
#   CONNEXION_OK                   jeton reçu, posé et vérifié (suivi de la ligne CLE_OK claude de cles.sh)
#   CONNEXION_DELAI                personne n'a cliqué sur Accepter à temps (relancer)
#   CONNEXION_ECHEC <raison>       claude introuvable, ou sortie inattendue (la raison ne contient jamais de jeton)
#   (et la ligne de cles.sh : CLE_OK claude | CLE_REFUSEE claude | CLE_NON_VERIFIEE claude ...)
# Options : --forcer (refait la connexion même si un jeton marche), --delai <secondes> (défaut 540 : sous la limite
# de 10 minutes d'une commande de Claude).
# Variables pour les tests de Yoan seulement : CONNEXION_CLAUDE (programme lancé à la place de « claude setup-token »),
# CONNEXION_NAVIGATEUR (programme qui reçoit l'adresse à ouvrir, au lieu du navigateur par défaut).

# Arrête claude et efface le dossier privé, quoi qu'il arrive (D et pid globaux : le nettoyage tourne à la sortie).
D="" pid=""
descendants() { local p; for p in $(pgrep -P "$1" 2>/dev/null); do echo "$p"; descendants "$p"; done; }
arreter_claude() {
  if [ -n "$pid" ]; then
    # claude tourne dans la session du pseudo-terminal (hors du groupe de script) : arrêté par son PID.
    local tous p i=0
    tous="$pid $(descendants "$pid" | tr '\n' ' ')"
    for p in $tous; do kill -TERM "$p" 2>/dev/null; done
    while [ "$i" -lt 25 ]; do
      local reste=""; for p in $tous; do kill -0 "$p" 2>/dev/null && reste=1; done
      [ -z "$reste" ] && break
      sleep 0.2; i=$((i + 1))
    done
    for p in $tous; do kill -KILL "$p" 2>/dev/null; done
  fi
  pid=""
  return 0
}
nettoyer() { arreter_claude; [ -n "$D" ] && rm -rf "$D"; return 0; }

main() {
  set -u
  local ICI; ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  # shellcheck source=../studio/lancement/client.sh
  . "$ICI/../studio/lancement/client.sh"
  studio_client_charger || { echo "CONNEXION_ECHEC client : $CLIENT_ERREUR"; return 1; }
  local BASE="$CLIENT_RACINE" FORCER="" DELAI=540
  while [ $# -gt 0 ]; do
    case "$1" in --forcer) FORCER=1;; --delai) shift; DELAI="${1:-540}";; esac
    shift
  done
  # Un jeton venu de l'environnement (la conversation qui lance l'installation) ne compte pas : seul celui du studio.
  unset CLAUDE_CODE_OAUTH_TOKEN ANTHROPIC_API_KEY

  if [ -z "$FORCER" ] && grep -qs '^CLAUDE_CODE_OAUTH_TOKEN=sk-ant-..*' "$BASE/claude.env"; then
    local r; r="$(/bin/bash "$ICI/cles.sh" claude-verifier 2>&1 | tail -1)"
    case "$r" in "CLE_OK claude"*) echo "CONNEXION_DEJA"; return 0;; esac
  fi

  # Le vrai programme claude (installé s'il manque) : c'est lui qui vérifie le jeton ensuite (cles.sh).
  local cl="" c
  if [ -z "$cl" ]; then
    for c in "$BASE/bin/claude" "$HOME/.local/bin/claude" /opt/homebrew/bin/claude /usr/local/bin/claude "$HOME/.claude/local/claude"; do
      [ -x "$c" ] && { cl="$c"; break; }
    done
  fi
  if [ -z "$cl" ]; then
    # Le programme officiel (installeur d'Anthropic, une minute, aucun mot de passe).
    mkdir -p "$BASE"
    if curl -fsSL https://claude.ai/install.sh -o "$BASE/install-claude.sh" && /bin/bash "$BASE/install-claude.sh" > "$BASE/install-claude.log" 2>&1 \
       && [ -x "$HOME/.local/bin/claude" ]; then cl="$HOME/.local/bin/claude"; fi
    rm -f "$BASE/install-claude.sh"
    [ -n "$cl" ] || { echo "CONNEXION_ECHEC claude introuvable et installation impossible (journal $BASE/install-claude.log)"; return 1; }
  fi

  # Dossier privé : la sortie du pseudo-terminal contient le jeton le temps de le lire. D et pid restent globaux :
  # le nettoyage tourne à la sortie du script, après la fin de main.
  D="$(mktemp -d "${TMPDIR:-/tmp}/connexion-claude.XXXXXX")"; chmod 700 "$D"
  local LOG="$D/sortie" NAV="$D/navigateur"
  pid=""
  trap nettoyer EXIT
  ( umask 077; : > "$LOG" )
  # Le navigateur : celui du Mac par défaut (open) ; noté pour savoir que claude a bien demandé la connexion.
  printf '#!/bin/bash\nprintf "%%s\\n" "$1" >> %q\n%s "$1" >/dev/null 2>&1\n' "$NAV" "${CONNEXION_NAVIGATEUR:-/usr/bin/open}" > "$D/ouvrir"
  chmod 700 "$D/ouvrir"

  # Environnement propre : rien de la conversation qui lance l'installation (variables de Claude Code, jetons).
  local envs=(HOME="$HOME" USER="${USER:-$(id -un)}" LOGNAME="${USER:-$(id -un)}" PATH="$BASE/bin:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
    LANG="${LANG:-fr_FR.UTF-8}" TERM=xterm-256color TMPDIR="$D/" BROWSER="$D/ouvrir" DISABLE_AUTOUPDATER=1)
  [ -n "${CLIENT_CONFIG_CLAUDE:-}" ] && envs+=(CLAUDE_CONFIG_DIR="$CLIENT_CONFIG_CLAUDE")
  # Son propre groupe de processus (arrêté d'un coup) ; une largeur de 500 colonnes : le jeton tient sur une ligne.
  set -m
  ( cd "$D" && exec env -i "${envs[@]}" /usr/bin/script -q -F "$LOG" /bin/bash -c 'stty cols 500 rows 60 2>/dev/null; exec "$0" setup-token' "${CONNEXION_CLAUDE:-$cl}" ) </dev/null >/dev/null 2>&1 &
  pid=$!
  disown "$pid" 2>/dev/null
  set +m

  # Attente : le jeton suivi de la ligne qui le suit (« Store this token... ») = affiché en entier.
  local i=0 max=$((DELAI * 2)) etat=""
  while [ "$i" -lt "$max" ]; do
    etat="$(/usr/bin/python3 -I "$ICI/connexion_lire.py" etat "$LOG" 2>/dev/null)"
    case "$etat" in PRET|ERREUR*) break;; esac
    kill -0 "$pid" 2>/dev/null || { etat="${etat:-FINI}"; [ "$etat" = PRET ] || etat="FINI"; break; }
    sleep 0.5; i=$((i + 1))
  done
  [ "$etat" = PRET ] || etat="$(/usr/bin/python3 -I "$ICI/connexion_lire.py" etat "$LOG" 2>/dev/null)"
  case "$etat" in
    PRET)
      local r
      local J="$D/jeton"
      ( umask 077; /usr/bin/python3 -I "$ICI/connexion_lire.py" jeton "$LOG" > "$J" )
      arreter_claude
      rm -f "$LOG"
      r="$(/bin/bash "$ICI/cles.sh" --stdin claude < "$J" 2>&1)"
      rm -f "$J"
      case "$r" in
        *"CLE_OK claude"*) echo "CONNEXION_OK"; echo "$r" | grep -E '^CLE_' | tail -1;;
        *) echo "$r" | grep -E '^CLE_' | tail -1; echo "CONNEXION_ECHEC le jeton reçu n'a pas été accepté";;
      esac;;
    ERREUR*) echo "CONNEXION_ECHEC ${etat#ERREUR }";;
    ATTENTE*|"")
      if [ ! -s "$NAV" ]; then echo "CONNEXION_ECHEC claude n'a pas demandé l'ouverture du navigateur ($(/usr/bin/python3 -I "$ICI/connexion_lire.py" fin "$LOG" 2>/dev/null))"
      else echo "CONNEXION_DELAI"; fi;;
    *) echo "CONNEXION_ECHEC claude s'est arrêté sans jeton ($(/usr/bin/python3 -I "$ICI/connexion_lire.py" fin "$LOG" 2>/dev/null))";;
  esac
  return 0
}

main "$@"; exit $?
