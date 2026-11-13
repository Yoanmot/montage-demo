#!/bin/bash
# Pose les clés du Mac de Romain, sans qu'elles passent jamais par la conversation avec Claude.
#   /bin/bash ~/.montage-yoan/montage-demo/installation/cles.sh            les clés qui manquent
#   /bin/bash ~/.montage-yoan/montage-demo/installation/cles.sh elevenlabs  une seule (la remplace si elle existe)
#   (noms : elevenlabs, zernio, code)
#   ... | cles.sh --stdin <nom>   la valeur lue sur l'entrée standard au lieu de la fenêtre (tests de Yoan)
# Pour chaque clé, une fenêtre du Mac s'ouvre avec un champ masqué : on y colle la clé, OK. Le script l'écrit dans
# son fichier (droits 600), la vérifie par un appel en lecture, et n'affiche jamais sa valeur.
#   elevenlabs -> ~/.config/monteur-romain/.env   ELEVENLABS_API_KEY=...  (sons du monteur)
#   zernio     -> ~/.montage-yoan/zernio.env       ZERNIO_API_KEY=...      (clé « Mac » : publication seulement)
#   code       -> ~/.montage-yoan/config           CODE=...                (serveur de coupe, via couper.mjs code)
# Sortie : CLE_OK <nom> | CLE_REFUSEE <nom> | CLE_ANNULEE <nom> | CLE_NON_VERIFIEE <nom> <raison> | DEJA <nom>

main() {
  set -u
  local BASE="$HOME/.montage-yoan"
  local CLONE="$BASE/montage-demo"
  local HOC="$BASE/head-of-content"
  local PY=/usr/bin/python3
  local ENV_EL="$HOME/.config/monteur-romain/.env"
  local ENV_ZE="$BASE/zernio.env"
  local CONF="$BASE/config"
  umask 077
  mkdir -p "$BASE" "$HOME/.config/monteur-romain"

  local DEPUIS_STDIN=""
  if [ "${1:-}" = "--stdin" ]; then DEPUIS_STDIN=1; shift; fi

  demander() { # $1 titre, $2 texte ; rend la valeur sur stdout (vide si annulé)
    if [ -n "$DEPUIS_STDIN" ]; then local l; IFS= read -r l; printf '%s' "$l" | tr -d '[:space:]'; return; fi
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
      compte="$("$PY" -c 'import sys; sys.path.insert(0, sys.argv[1]); import zernio; print(zernio.COMPTES["romain"]["compte"])' "$HOC/outils" 2>/dev/null)"
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

  verifier_code() {
    local r; r="$(node "$CLONE/skills/couper-silences/scripts/couper.mjs" code "$(sed -n 's/^CODE=//p' "$CONF" | tail -1)" 2>&1)"
    case "$r" in
      *"Code enregistré"*) echo "CLE_OK code";;
      *"CODE_REFUSÉ"*) echo "CLE_REFUSEE code";;
      *) echo "CLE_NON_VERIFIEE code $(echo "$r" | head -1 | cut -c1-80)";;
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
        v="$(demander "Publication Instagram : clé du Mac" "Colle ici la clé de publication que Yoan t'a donnée, puis clique sur OK.")"
        [ -n "$v" ] || { echo "CLE_ANNULEE zernio"; return; }
        v="$(nettoie "$v")"; ecrire_cle "$ENV_ZE" ZERNIO_API_KEY "$v"; verifier_zernio;;
      code)
        v="$(demander "Monteur : code d'accès" "Colle ici le code d'accès du montage que Yoan t'a donné, puis clique sur OK.")"
        [ -n "$v" ] || { echo "CLE_ANNULEE code"; return; }
        v="$(nettoie "$v")"; ecrire_cle "$CONF" CODE "$v"; verifier_code;;
      *) echo "NOM_INCONNU $1 (elevenlabs, zernio, code)";;
    esac
    v=""
  }

  if [ $# -gt 0 ]; then
    for n in "$@"; do poser "$n"; done
    return 0
  fi
  if grep -qs '^ELEVENLABS_API_KEY=..*' "$ENV_EL"; then echo "DEJA elevenlabs"; verifier_elevenlabs; else poser elevenlabs; fi
  if grep -qs '^ZERNIO_API_KEY=..*' "$ENV_ZE"; then echo "DEJA zernio"; verifier_zernio; else poser zernio; fi
  if grep -qs '^CODE=..*' "$CONF"; then echo "DEJA code"; verifier_code; else poser code; fi
  for f in "$ENV_EL" "$ENV_ZE" "$CONF"; do [ -f "$f" ] && chmod 600 "$f"; done
  return 0
}

main "$@"; exit $?
