#!/bin/bash
# Pose les clés du Mac d'un client, sans qu'elles passent jamais par la conversation avec Claude.
# Chemins tirés du client (studio/lancement/client.sh) : <racine> = ~/.montage-yoan chez Romain.
#   /bin/bash <racine>/montage-demo/installation/cles.sh            les clés qui manquent
#   /bin/bash <racine>/montage-demo/installation/cles.sh elevenlabs  une seule (la remplace si elle existe)
#   (noms : elevenlabs, zernio, code, claude ; zernio-lecture pour une installation d'essai à stats_reelles)
#   ... | cles.sh --stdin <nom>   la valeur lue sur l'entrée standard (une ligne, jamais affichée) au lieu
#                                 de la fenêtre : jeton de « claude setup-token » collé dans le Terminal,
#                                 clé lue d'un .env (cles.sh --stdin zernio < <(sed -n 's/^ZERNIO_API_KEY=//p' .env))
# Pour chaque clé, une fenêtre du Mac s'ouvre avec un champ masqué : on y colle la clé, OK. Le script l'écrit dans
# son fichier (droits 600), la vérifie par un appel en lecture, et n'affiche jamais sa valeur.
#   elevenlabs -> <sons>/.env (Romain : ~/.config/monteur-romain/.env ; client isolé : <racine>/monteur/.env)
#                                                  ELEVENLABS_API_KEY=...  (sons du monteur)
#   zernio     -> <racine>/zernio.env              ZERNIO_API_KEY=...      (clé « Mac » : publication seulement)
#   zernio-lecture -> <racine>/zernio-lecture.env  ZERNIO_API_KEY=...      (installation d'essai dont le client porte
#                 stats_reelles, ex. romain-test : la clé qui lit les vrais chiffres du compte. Le studio ne la passe
#                 qu'à `zernio.py stats` ; la publication reste simulée ; jamais demandée sans le nom)
#   code       -> <racine>/config                  CODE=...                (serveur de coupe, via couper.mjs code)
#   claude     -> <racine>/claude.env              CLAUDE_CODE_OAUTH_TOKEN=...  (connexion du studio sans personne
#                 devant : le jeton d'un an affiché par « claude setup-token », lancé avant dans le Terminal ;
#                 vérifié par une session d'essai, puis le studio redémarre dès qu'il est au repos)
# Sortie : CLE_OK <nom> | CLE_REFUSEE <nom> | CLE_ANNULEE <nom> | CLE_NON_VERIFIEE <nom> <raison> | DEJA <nom>
#          | CLE_INTERDITE zernio (client à simulation forcée : installation d'essai, aucune clé de publication)
#          | CLE_INTERDITE zernio-lecture (client sans stats_reelles ou sans simulation forcée)

main() {
  set -u
  # shellcheck source=../studio/lancement/client.sh
  . "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../studio/lancement/client.sh"
  studio_client_charger || { echo "ECHEC client : $CLIENT_ERREUR"; return 1; }
  local BASE="$CLIENT_RACINE"
  local CLONE="$BASE/montage-demo"
  local HOC="$BASE/head-of-content"
  local PY=/usr/bin/python3
  local ENV_EL="$CLIENT_SONS/.env"
  local ENV_ZE="$BASE/zernio.env"
  local ENV_ZL="$BASE/zernio-lecture.env"
  local CONF="$BASE/config"
  local ENV_CL="$BASE/claude.env"
  umask 077
  mkdir -p "$BASE" "$CLIENT_SONS"
  # Client isolé : la session d'essai de la connexion lit sa config Claude à lui.
  studio_client_env_claude

  local DEPUIS_STDIN=""
  if [ "${1:-}" = "--stdin" ]; then DEPUIS_STDIN=1; shift; fi

  demander() { # $1 titre, $2 texte ; rend la valeur sur stdout (vide si annulé)
    if [ -n "$DEPUIS_STDIN" ]; then local l=""; IFS= read -r l || true; printf '%s' "$l" | tr -d '[:space:]'; return; fi
    osascript - "$1" "$2" <<'OSA' 2>/dev/null
on run argv
  try
    set r to display dialog (item 2 of argv) with title (item 1 of argv) default answer "" with hidden answer buttons {"Annuler", "OK"} default button "OK" cancel button "Annuler" giving up after 600
    if gave up of r then return ""
    return text returned of r
  on error
    return ""
  end try
end run
OSA
  }

  ecrire_cle() { # $1 fichier, $2 nom de variable, $3 valeur : remplace la ligne, garde les autres
    local tmp="$1.tmp.$$"
    { [ -f "$1" ] && grep -v "^$2=" "$1"; printf '%s=%s\n' "$2" "$3"; } > "$tmp"
    mv "$tmp" "$1"; chmod 600 "$1"
  }

  statut_http() { # $1 url, $2 en-tête (lu sur stdin pour ne jamais apparaître dans la liste des processus)
    curl -s -o /dev/null -w '%{http_code}' --max-time 20 -H @- "$1"
  }

  verifier_elevenlabs() {
    local v; v="$(sed -n 's/^ELEVENLABS_API_KEY=//p' "$ENV_EL" | tail -1 | tr -d "\"'")"
    # Une clé limitée aux sons n'a pas le droit de lire le compte : « missing_permissions » = clé reconnue.
    local corps; corps="$(printf 'xi-api-key: %s\n' "$v" | curl -s --max-time 20 -w '\n%{http_code}' -H @- "https://api.elevenlabs.io/v1/user")"
    local s="${corps##*$'\n'}"
    case "$s" in
      200) echo "CLE_OK elevenlabs";;
      401|403) if echo "$corps" | grep -q "missing_permissions"; then echo "CLE_OK elevenlabs (clé limitée)"; else echo "CLE_REFUSEE elevenlabs"; fi;;
      *) echo "CLE_NON_VERIFIEE elevenlabs http=$s";;
    esac
  }

  verifier_zernio() {
    local v; v="$(sed -n 's/^ZERNIO_API_KEY=//p' "$ENV_ZE" | tail -1 | tr -d "\"'")"
    local compte=""
    if [ -f "$HOC/outils/zernio.py" ]; then
      compte="$("$PY" -c 'import sys; sys.path.insert(0, sys.argv[1]); import zernio; print((getattr(zernio, "COMPTES", {}).get(sys.argv[2]) or {}).get("compte") or "")' "$HOC/outils" "$CLIENT_ID" 2>/dev/null)"
    fi
    local url="https://zernio.com/api/v1/posts?limit=1"
    [ -n "$compte" ] && url="https://zernio.com/api/v1/accounts/$compte/posts?limit=1"
    local s; s="$(printf 'Authorization: Bearer %s\n' "$v" | statut_http "$url")"
    case "$s" in
      200) echo "CLE_OK zernio";;
      401) echo "CLE_REFUSEE zernio";;
      *) echo "CLE_NON_VERIFIEE zernio http=$s";;
    esac
  }

  # La clé de lecture : un GET des publications du compte lu par le studio (COMPTES[stats_reelles.compte]).
  verifier_zernio_lecture() {
    local v; v="$(sed -n 's/^ZERNIO_API_KEY=//p' "$ENV_ZL" | tail -1 | tr -d "\"'")"
    local compte=""
    if [ -f "$HOC/outils/zernio.py" ]; then
      compte="$("$PY" -c 'import sys; sys.path.insert(0, sys.argv[1]); import zernio; print((getattr(zernio, "COMPTES", {}).get(sys.argv[2]) or {}).get("compte") or "")' "$HOC/outils" "$CLIENT_STATS_REELLES" 2>/dev/null)"
    fi
    [ -n "$compte" ] || { v=""; echo "CLE_NON_VERIFIEE zernio-lecture compte $CLIENT_STATS_REELLES introuvable dans zernio.py"; return; }
    local s; s="$(printf 'Authorization: Bearer %s\n' "$v" | statut_http "https://zernio.com/api/v1/accounts/$compte/posts?limit=1")"
    v=""
    case "$s" in
      200) echo "CLE_OK zernio-lecture (lecture du compte $CLIENT_STATS_REELLES ; publication toujours simulée)";;
      401) echo "CLE_REFUSEE zernio-lecture";;
      *) echo "CLE_NON_VERIFIEE zernio-lecture http=$s";;
    esac
  }

  verifier_code() {
    local r; r="$(node "$CLONE/skills/couper-silences/scripts/couper.mjs" code "$(sed -n 's/^CODE=//p' "$CONF" | tail -1)" 2>&1)"
    case "$r" in
      *"Code enregistré"*) echo "CLE_OK code";;
      *"CODE_REFUSÉ"*) echo "CLE_REFUSEE code";;
      *) echo "CLE_NON_VERIFIEE code $(echo "$r" | head -1 | cut -c1-80)";;
    esac
  }

  verifier_claude() {
    local v cl="" c d r pid i=0
    v="$(sed -n 's/^CLAUDE_CODE_OAUTH_TOKEN=//p' "$ENV_CL" | tail -1 | tr -d "\"' ")"
    case "$v" in sk-ant-*) ;; *) echo "CLE_REFUSEE claude (ce n'est pas un code de connexion de Claude)"; return;; esac
    for c in "$HOME/.local/bin/claude" /opt/homebrew/bin/claude /usr/local/bin/claude "$HOME/.claude/local/claude" "$(command -v claude 2>/dev/null)"; do
      [ -n "$c" ] && [ -x "$c" ] && { cl="$c"; break; }
    done
    [ -n "$cl" ] || { echo "CLE_NON_VERIFIEE claude programme claude introuvable"; return; }
    d="$(mktemp -d)"
    # Le jeton passe par l'environnement du sous-shell, jamais par la ligne de commande (visible dans ps).
    ( unset ANTHROPIC_API_KEY; export CLAUDE_CODE_OAUTH_TOKEN="$v"; cd "$d" && "$cl" -p "Réponds seulement le mot PRET, rien d'autre." --max-turns 1 --output-format text </dev/null > "$d/r" 2>&1 ) &
    pid=$!
    while kill -0 "$pid" 2>/dev/null && [ "$i" -lt 180 ]; do sleep 0.5; i=$((i + 1)); done
    kill -0 "$pid" 2>/dev/null && { kill "$pid" 2>/dev/null; sleep 1; kill -9 "$pid" 2>/dev/null; }
    wait "$pid" 2>/dev/null
    r="$(cat "$d/r" 2>/dev/null)"; rm -rf "$d"; v=""
    case "$r" in
      *PRET*)
        echo "CLE_OK claude"
        # Le studio relit la connexion à son prochain démarrage : demandé, fait dès qu'il est au repos.
        if [ -d "$BASE/studio" ] && [ -f "$CLONE/installation/studio.sh" ]; then
          date '+%Y-%m-%d %H:%M:%S connexion' > "$BASE/studio/redemarrage-demande"
          /bin/bash "$CLONE/installation/studio.sh" redemarrer-si-libre >/dev/null 2>&1 || true
        fi;;
      *[Ll]ogin*|*"Invalid"*|*authenticat*|*OAuth*|*401*|*expired*) echo "CLE_REFUSEE claude";;
      *) echo "CLE_NON_VERIFIEE claude $(echo "$r" | tail -1 | cut -c1-80)";;
    esac
  }

  poser() { # $1 nom
    local v
    nettoie() { printf '%s' "$1" | tr -d '[:space:]'; }
    case "$1" in
      elevenlabs)
        v="$(demander "Monteur : clé des sons" "Colle ici la clé des sons que Yoan t'a donnée, puis clique sur OK.")"
        [ -n "$v" ] || { echo "CLE_ANNULEE elevenlabs"; return; }
        v="$(nettoie "$v")"; ecrire_cle "$ENV_EL" ELEVENLABS_API_KEY "$v"; verifier_elevenlabs;;
      zernio)
        # Installation d'essai : aucune clé de publication, jamais (la publication y reste une simulation).
        if [ -n "${CLIENT_SIMULATION_FORCEE:-}" ]; then echo "CLE_INTERDITE zernio (installation d'essai : publication toujours simulée)"; return; fi
        v="$(demander "Publication Instagram : clé du Mac" "Colle ici la clé de publication que Yoan t'a donnée, puis clique sur OK.")"
        [ -n "$v" ] || { echo "CLE_ANNULEE zernio"; return; }
        v="$(nettoie "$v")"; ecrire_cle "$ENV_ZE" ZERNIO_API_KEY "$v"; verifier_zernio;;
      zernio-lecture)
        # Installation d'essai qui lit les vrais chiffres : jamais ailleurs (une vraie installation a zernio.env).
        if [ -z "${CLIENT_SIMULATION_FORCEE:-}" ] || [ -z "${CLIENT_STATS_REELLES:-}" ]; then
          echo "CLE_INTERDITE zernio-lecture (réservée à une installation d'essai qui lit les vrais chiffres : stats_reelles)"; return
        fi
        v="$(demander "Studio de test : lecture des chiffres Instagram" "Colle ici la clé Zernio de $CLIENT_PRENOM, puis clique sur OK. Le studio de test ne s'en sert que pour lire ses chiffres : la publication reste simulée.")"
        [ -n "$v" ] || { echo "CLE_ANNULEE zernio-lecture"; return; }
        v="$(nettoie "$v")"; ecrire_cle "$ENV_ZL" ZERNIO_API_KEY "$v"; v=""; chmod 600 "$ENV_ZL"; verifier_zernio_lecture;;
      code)
        v="$(demander "Monteur : code d'accès" "Colle ici le code d'accès du montage que Yoan t'a donné, puis clique sur OK.")"
        [ -n "$v" ] || { echo "CLE_ANNULEE code"; return; }
        v="$(nettoie "$v")"; ecrire_cle "$CONF" CODE "$v"; verifier_code;;
      claude)
        v="$(demander "Studio : connexion à Claude" "Colle ici le long code de connexion que le Terminal t'a affiché (il commence par sk-ant), puis clique sur OK.")"
        [ -n "$v" ] || { echo "CLE_ANNULEE claude"; return; }
        v="$(nettoie "$v")"; ecrire_cle "$ENV_CL" CLAUDE_CODE_OAUTH_TOKEN "$v"; verifier_claude;;
      *) echo "NOM_INCONNU $1 (elevenlabs, zernio, code, claude, zernio-lecture)";;
    esac
    v=""
  }

  if [ $# -gt 0 ]; then
    for n in "$@"; do poser "$n"; done
    return 0
  fi
  if grep -qs '^ELEVENLABS_API_KEY=..*' "$ENV_EL"; then echo "DEJA elevenlabs"; verifier_elevenlabs; else poser elevenlabs; fi
  if [ -n "${CLIENT_SIMULATION_FORCEE:-}" ]; then echo "SANS zernio (installation d'essai : publication toujours simulée)"
  elif grep -qs '^ZERNIO_API_KEY=..*' "$ENV_ZE"; then echo "DEJA zernio"; verifier_zernio; else poser zernio; fi
  if grep -qs '^CODE=..*' "$CONF"; then echo "DEJA code"; verifier_code; else poser code; fi
  if grep -qs '^CLAUDE_CODE_OAUTH_TOKEN=..*' "$ENV_CL"; then echo "DEJA claude"; verifier_claude; else poser claude; fi
  for f in "$ENV_EL" "$ENV_ZE" "$ENV_ZL" "$CONF" "$ENV_CL"; do [ -f "$f" ] && chmod 600 "$f"; done
  return 0
}

main "$@"; exit $?
