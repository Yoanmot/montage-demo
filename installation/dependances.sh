#!/bin/bash
# Les dépendances du monteur et du studio (installation/dependances.txt) : vérifiées, et installées si elles manquent,
# sans rien demander. Relançable : ce qui est en place n'est pas touché (quelques secondes).
#   /bin/bash <racine>/montage-demo/installation/dependances.sh
#   /bin/bash .../dependances.sh --ancien <fichier>   (mise à jour) <fichier> = dependances.txt de la version d'avant :
#                                                      une dépendance qui manque et n'y était pas est « nouvelle »
# Appelé par installer.sh et par mettre-a-jour.sh (quand dependances.txt a changé, et après un retour arrière).
# Sortie, une ligne par dépendance :
#   DEP_OK <ligne> | DEP_INSTALLE <ligne> | DEP_MANQUE <ligne> : <raison> | DEP_MANQUE_NOUVELLE <ligne> : <raison>
# Dernière ligne : DEP_FIN ok=<n> installe=<n> manque=<n> nouvelles=<n>.
# Code : 0 tout est là ; 3 une dépendance NOUVELLE manque (la mise à jour qui l'apporte doit être retirée) ;
# 4 seulement des dépendances déjà demandées avant manquent (problème du Mac, pas de la mise à jour).
#
# Claude (ligne « claude <version> ») : le studio a sa copie à lui, <racine>/outils/claude/<version>/claude, reliée en
# <racine>/bin/claude (premier dossier du chemin du service et des sessions). Prise dans les versions déjà sur le Mac
# (~/.local/share/claude/versions) sinon téléchargée chez Anthropic (somme de contrôle vérifiée), puis essayée (drapeaux
# du studio dans --help, et une session minimale en stream-json) avant d'être reliée. L'ancienne reste en place si
# l'essai échoue. Les mises à jour automatiques de claude ne touchent pas cette copie ; on la monte en changeant la ligne.
# La première fois (aucune copie encore reliée), un échec n'est pas bloquant : le studio garde le claude du Mac.
#
# Variables pour les tests de Yoan seulement : STUDIO_PY (python3), STUDIO_BREW (brew, ou « aucun »),
# STUDIO_SANS_TELECHARGEMENT=1 (jamais de téléchargement de claude), STUDIO_SANS_CLAUDE=1 (pas de session d'essai).

DRAPEAUX_CLAUDE="--print --input-format --output-format --verbose --include-partial-messages --permission-mode dontAsk
--allowedTools --settings --append-system-prompt --agent --add-dir --model --resume --tools --no-session-persistence
--strict-mcp-config --disable-slash-commands --setting-sources"
TELECHARGEMENT_CLAUDE="https://downloads.claude.ai/claude-code-releases"

main() {
  set -u
  local ICI; ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  # shellcheck source=../studio/lancement/client.sh
  . "$ICI/../studio/lancement/client.sh"
  studio_client_charger || { echo "DEP_MANQUE client : $CLIENT_ERREUR"; echo "DEP_FIN ok=0 installe=0 manque=1 nouvelles=0"; return 4; }
  local BASE="$CLIENT_RACINE"
  local LISTE="$ICI/dependances.txt"
  local ANCIEN=""
  if [ "${1:-}" = "--ancien" ]; then ANCIEN="${2:-}"; fi
  local PY="${STUDIO_PY:-/usr/bin/python3}"
  local BREW="${STUDIO_BREW:-}"
  if [ -z "$BREW" ]; then for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do [ -x "$b" ] && { BREW="$b"; break; }; done; fi
  [ "$BREW" = "aucun" ] && BREW=""
  export HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_ENV_HINTS=1 DISABLE_AUTOUPDATER=1
  local b
  for b in /opt/homebrew/bin /usr/local/bin "$BASE/bin"; do case ":$PATH:" in *":$b:"*) ;; *) PATH="$b:$PATH";; esac; done
  export PATH
  mkdir -p "$BASE/maj" "$BASE/bin"
  local nb_ok=0 nb_inst=0 nb_manque=0 nb_nouv=0

  # Une dépendance qui manque : « nouvelle » si la version d'avant ne la demandait pas (comparaison de la ligne exacte).
  manque() { # $1 ligne, $2 raison, $3 1 = jamais bloquante
    if [ -n "$ANCIEN" ] && [ -f "$ANCIEN" ] && [ -z "${3:-}" ] && ! grep -qxF -- "$1" "$ANCIEN"; then
      echo "DEP_MANQUE_NOUVELLE $1 : $2"; nb_nouv=$((nb_nouv + 1))
    else
      echo "DEP_MANQUE $1 : $2"; nb_manque=$((nb_manque + 1))
    fi
  }

  # Lance une commande avec une limite de temps (macOS n'a pas « timeout ») ; attend par PID.
  avec_limite() { # $1 secondes, puis la commande
    local s="$1"; shift
    "$@" &
    local pid=$! i=0
    while kill -0 "$pid" 2>/dev/null; do
      if [ "$i" -ge $((s * 2)) ]; then kill "$pid" 2>/dev/null; sleep 1; kill -9 "$pid" 2>/dev/null; wait "$pid" 2>/dev/null; return 124; fi
      sleep 0.5; i=$((i + 1))
    done
    wait "$pid"
  }

  # ---------------------------------------------------------------- claude
  version_de() { "$1" --version 2>/dev/null | head -1 | awk '{print $1}'; }
  drapeaux_ok() { # $1 binaire ; écrit le premier drapeau absent
    local aide d
    aide="$("$1" --help 2>/dev/null)"
    for d in $DRAPEAUX_CLAUDE; do
      printf '%s' "$aide" | grep -qF -- "$d" || { echo "$d"; return 1; }
    done
    return 0
  }
  # Une session minimale comme celles du studio : stream-json en entrée et en sortie, il faut « init » puis « result »
  # (un refus de connexion rend aussi un « result » : on vérifie le format, pas le compte).
  session_ok() { # $1 binaire
    local d jeton r
    d="$(mktemp -d)"
    jeton="$(sed -n 's/^CLAUDE_CODE_OAUTH_TOKEN=//p' "$BASE/claude.env" 2>/dev/null | tail -1 | tr -d "\"' \r")"
    printf '%s\n' '{"type":"user","message":{"role":"user","content":[{"type":"text","text":"Réponds seulement le mot PRET."}]}}' > "$d/entree"
    ( cd "$d" && unset ANTHROPIC_API_KEY && { [ -z "$jeton" ] || export CLAUDE_CODE_OAUTH_TOKEN="$jeton"; } \
      && exec "$1" -p --input-format stream-json --output-format stream-json --verbose --max-turns 1 \
        --permission-mode dontAsk --tools "" --no-session-persistence --strict-mcp-config --setting-sources "" \
        < "$d/entree" > "$d/sortie" 2>&1 ) &
    local pid=$! i=0
    while kill -0 "$pid" 2>/dev/null && [ "$i" -lt 240 ]; do sleep 0.5; i=$((i + 1)); done
    kill -0 "$pid" 2>/dev/null && { kill "$pid" 2>/dev/null; sleep 1; kill -9 "$pid" 2>/dev/null; }
    wait "$pid" 2>/dev/null
    jeton=""
    r=1
    grep -q '"subtype":"init"' "$d/sortie" && grep -q '"type":"result"' "$d/sortie" && r=0
    rm -rf "$d"
    return "$r"
  }
  telecharger_claude() { # $1 version, $2 fichier de sortie
    local v="$1" sortie="$2" arch plat manifeste somme
    case "$(uname -m)" in arm64) arch=arm64;; *) arch=x64;; esac
    [ "$arch" = "x64" ] && [ "$(sysctl -n sysctl.proc_translated 2>/dev/null)" = "1" ] && arch=arm64
    plat="darwin-$arch"
    manifeste="$(curl -fsSL --max-time 30 "$TELECHARGEMENT_CLAUDE/$v/manifest.json" 2>/dev/null)" || return 1
    somme="$(printf '%s' "$manifeste" | "$PY" -c 'import json,sys; print(((json.load(sys.stdin).get("platforms") or {}).get(sys.argv[1]) or {}).get("checksum") or "")' "$plat" 2>/dev/null)"
    case "$somme" in [0-9a-f]*) ;; *) return 1;; esac
    curl -fsSL --retry 2 --max-time 1200 "$TELECHARGEMENT_CLAUDE/$v/$plat/claude" -o "$sortie" 2>/dev/null || return 1
    [ "$(shasum -a 256 "$sortie" | cut -d' ' -f1)" = "$somme" ] || { rm -f "$sortie"; return 1; }
  }
  dep_claude() { # $1 ligne, $2 version
    local ligne="$1" v="$2" dossier="$BASE/outils/claude" lien="$BASE/bin/claude"
    local dest="$dossier/$v/claude" avant="" premiere="" manquant
    avant="$(readlink "$lien" 2>/dev/null || true)"
    [ -n "$avant" ] || premiere=1
    case "$v" in *[!0-9.]*|"") manque "$ligne" "version illisible" "$premiere"; return;; esac
    if [ "$avant" = "$dest" ] && [ -x "$dest" ] && [ "$(version_de "$dest")" = "$v" ]; then
      echo "DEP_OK $ligne"; nb_ok=$((nb_ok + 1)); return
    fi
    if [ ! -x "$dest" ] || [ "$(version_de "$dest")" != "$v" ]; then
      mkdir -p "$dossier/$v"
      local tmp="$dossier/$v/.claude.tmp.$$" local_v="$HOME/.local/share/claude/versions/$v"
      rm -f "$tmp"
      if [ -f "$local_v" ] && [ "$(version_de "$local_v")" = "$v" ]; then
        cp "$local_v" "$tmp"
      elif [ -n "${STUDIO_SANS_TELECHARGEMENT:-}" ] || ! telecharger_claude "$v" "$tmp"; then
        rm -f "$tmp"; manque "$ligne" "téléchargement impossible" "$premiere"; return
      fi
      chmod 755 "$tmp"; xattr -d com.apple.quarantine "$tmp" 2>/dev/null || true
      if [ "$(version_de "$tmp")" != "$v" ]; then rm -f "$tmp"; manque "$ligne" "le programme téléchargé ne répond pas $v" "$premiere"; return; fi
      mv -f "$tmp" "$dest"
    fi
    if ! manquant="$(drapeaux_ok "$dest")"; then manque "$ligne" "le drapeau $manquant dont le studio a besoin a disparu" "$premiere"; return; fi
    if [ -z "${STUDIO_SANS_CLAUDE:-}" ] && ! session_ok "$dest"; then manque "$ligne" "une session d'essai n'a pas rendu le format attendu (init puis result)" "$premiere"; return; fi
    ln -sfn "$dest" "$lien.tmp.$$" && mv -f "$lien.tmp.$$" "$lien"
    local d_avant="claude du Mac avant"
    [ -n "$avant" ] && d_avant="avant : $(basename "$(dirname "$avant")")"
    echo "DEP_INSTALLE $ligne ($d_avant)"; nb_inst=$((nb_inst + 1))
    # On garde la version reliée et la précédente (retour arrière) ; les plus anciennes partent.
    local garder="$v $(basename "$(dirname "$avant")" 2>/dev/null)" x
    for x in "$dossier"/*/; do
      x="$(basename "$x")"
      case " $garder " in *" $x "*) ;; *) rm -rf "${dossier:?}/$x";; esac
    done
  }

  # ---------------------------------------------------------------- la liste
  if [ ! -f "$LISTE" ]; then echo "DEP_FIN ok=0 installe=0 manque=0 nouvelles=0 (pas de liste)"; return 0; fi
  local type a1 a2 reste ligne
  while IFS= read -r ligne <&3 || [ -n "$ligne" ]; do
    case "$ligne" in ""|"#"*) continue;; esac
    # shellcheck disable=SC2086
    set -- $ligne
    type="${1:-}"; a1="${2:-}"; a2="${3:-}"
    case "$type" in
      pip)
        if "$PY" -c "import $a1" >/dev/null 2>&1; then echo "DEP_OK $ligne"; nb_ok=$((nb_ok + 1))
        elif avec_limite 900 "$PY" -m pip install --user --quiet --disable-pip-version-check "$a2" >>"$BASE/maj/dependances.log" 2>&1 \
             && "$PY" -c "import $a1" >/dev/null 2>&1; then echo "DEP_INSTALLE $ligne"; nb_inst=$((nb_inst + 1))
        else manque "$ligne" "pip n'a pas pu l'installer (journal maj/dependances.log)"; fi;;
      brew)
        if command -v "$a1" >/dev/null 2>&1; then echo "DEP_OK $ligne"; nb_ok=$((nb_ok + 1))
        elif [ -z "$BREW" ]; then manque "$ligne" "Homebrew absent de ce Mac"
        elif avec_limite 1800 "$BREW" install "$a2" >>"$BASE/maj/dependances.log" 2>&1 && { hash -r; command -v "$a1" >/dev/null 2>&1; }; then
          echo "DEP_INSTALLE $ligne"; nb_inst=$((nb_inst + 1))
        else manque "$ligne" "brew install $a2 a échoué (journal maj/dependances.log)"; fi;;
      npx)
        shift
        if grep -qxF -- "$ligne" "$BASE/maj/npx-faits" 2>/dev/null; then echo "DEP_OK $ligne"; nb_ok=$((nb_ok + 1))
        elif ! command -v npx >/dev/null 2>&1; then manque "$ligne" "npx absent (Node manque)"
        elif avec_limite 1200 npx --yes "$@" >>"$BASE/maj/dependances.log" 2>&1; then
          echo "$ligne" >> "$BASE/maj/npx-faits"; echo "DEP_INSTALLE $ligne"; nb_inst=$((nb_inst + 1))
        else manque "$ligne" "npx --yes $* a échoué (journal maj/dependances.log)"; fi;;
      claude) dep_claude "$ligne" "$a1";;
      *) reste="$type"; manque "$ligne" "type inconnu ($reste)";;
    esac
  done 3< "$LISTE"
  echo "DEP_FIN ok=$nb_ok installe=$nb_inst manque=$nb_manque nouvelles=$nb_nouv"
  [ "$nb_nouv" -gt 0 ] && return 3
  [ "$nb_manque" -gt 0 ] && return 4
  return 0
}

main "$@"; exit $?
