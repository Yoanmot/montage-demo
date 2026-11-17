#!/bin/bash
# Mise à jour automatique du monteur et du studio d'un client, à chaque ouverture de Claude Code sur son Mac.
# Le client (racine, branche, dossier de config Claude, clé SSH) vient de studio/lancement/client.sh :
# <racine> = ~/.montage-yoan et <config> = ~/.claude chez Romain.
#
# Appelé par le hook SessionStart de <config>/settings.json (posé par installer.sh) :
#   /bin/bash "<racine>/montage-demo/installation/mettre-a-jour.sh" --hook
# Ce que ça fait, sans rien demander à personne :
#   1. aligne <racine>/montage-demo sur le dépôt public (fetch + reset sur origin/<branche du client> ; les
#      fichiers personnels ignorés par git, preferences.md et demandes-pour-yoan.md des skills, restent) ;
#   2. relie chaque skill du dépôt dans <config>/skills et l'agent dans <config>/agents (liens symboliques),
#      retire les liens vers ce qui a disparu du dépôt ;
#   3. aligne la copie du head of content (<racine>/head-of-content) comme le font ses scripts, si aucun
#      d'eux ne tourne, et garde le lien du skill publier.
#   4. si le code du studio a changé : redémarre son service quand aucune session ne tourne (sinon plus tard).
#      La copie de travail du studio (<racine>/studio/head-of-content) n'est jamais touchée ici.
# En mode --hook : jamais bloquant (8 s au plus, la suite continue en fond), jamais de sortie, toujours 0.
# Journal : <racine>/mise-a-jour.log.
#
# Autres modes : --liens-installation (appelé par installer.sh : migre les anciennes copies des skills),
# sans argument : la mise à jour au premier plan, avec le journal à l'écran.

main() {
  set -u
  # shellcheck source=../studio/lancement/client.sh
  . "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../studio/lancement/client.sh"
  studio_client_charger || exit 0
  local BASE="$CLIENT_RACINE"
  local CLONE="$BASE/montage-demo"
  local HOC="$BASE/head-of-content"
  local CC="$CLIENT_CLAUDE"
  local SKILLS="$CC/skills"
  local AGENTS="$CC/agents"
  local CLE_HOC="$CLIENT_CLE_SSH"
  local BRANCHE="$CLIENT_BRANCHE"
  local STAMP
  STAMP="$(date +%Y%m%d-%H%M%S)"
  export GIT_TERMINAL_PROMPT=0 LC_ALL=C

  if [ "${1:-}" = "--hook" ]; then
    [ -d "$CLONE/.git" ] || exit 0
    /bin/bash "$CLONE/installation/mettre-a-jour.sh" --travail </dev/null >/dev/null 2>&1 &
    local pid=$! i=0
    while kill -0 "$pid" 2>/dev/null && [ "$i" -lt 16 ]; do sleep 0.5; i=$((i + 1)); done
    exit 0
  fi

  local MODE="${1:-premier-plan}"
  local LOG="$BASE/mise-a-jour.log"
  mkdir -p "$BASE"

  journal() {
    if [ "$MODE" = "--travail" ]; then
      printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG"
    else
      printf '%s\n' "$*"
    fi
  }

  # Un seul passage à la fois (deux sessions ouvertes en même temps).
  local VERROU="$BASE/.mise-a-jour.verrou"
  if ! mkdir "$VERROU" 2>/dev/null; then
    if [ -n "$(find "$VERROU" -maxdepth 0 -mmin +5 2>/dev/null)" ]; then
      rm -rf "$VERROU"; mkdir "$VERROU" 2>/dev/null || return 0
    else
      journal "DEJA_EN_COURS"; return 0
    fi
  fi
  # shellcheck disable=SC2064
  trap "rm -rf '$VERROU'" EXIT

  # 1. Le dépôt du monteur
  if [ -d "$CLONE/.git" ]; then
    if git -C "$CLONE" -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=10 fetch -q origin "$BRANCHE" 2>/dev/null; then
      local avant apres
      avant="$(git -C "$CLONE" rev-parse HEAD 2>/dev/null)"
      if [ "$(git -C "$CLONE" rev-parse --abbrev-ref HEAD 2>/dev/null)" = "$BRANCHE" ]; then
        git -C "$CLONE" reset -q --hard "origin/$BRANCHE"
      else
        git -C "$CLONE" checkout -q -f -B "$BRANCHE" "origin/$BRANCHE"; journal "BRANCHE $BRANCHE"
      fi
      apres="$(git -C "$CLONE" rev-parse HEAD 2>/dev/null)"
      if [ "$avant" != "$apres" ]; then journal "MONTEUR_MIS_A_JOUR ${avant:0:7} -> ${apres:0:7}"; else journal "MONTEUR_A_JOUR ${apres:0:7}"; fi
      # Code du studio changé : redémarrage demandé (fait en 4, seulement quand le studio est au repos).
      if [ "$avant" != "$apres" ] && [ -d "$BASE/studio" ] && ! git -C "$CLONE" diff --quiet "$avant" "$apres" -- studio 2>/dev/null; then
        printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "${apres:0:7}" > "$BASE/studio/redemarrage-demande"
        journal "STUDIO_CHANGE ${avant:0:7} -> ${apres:0:7} : redémarrage demandé"
      fi
    else
      journal "HORS_LIGNE monteur : copie gardée telle quelle"
    fi
  else
    journal "PAS_DE_COPIE $CLONE"
    return 0
  fi

  # 2. Les liens
  mkdir -p "$SKILLS" "$AGENTS"
  local d n src cible l t f
  # La mise en page des carrousels : un skill par client (skill_carrousel du fichier du client), relié
  # sous le nom « carrousel » (celui qu'appellent le studio et les carrousels en attente) ; les autres
  # skills de mise en page du dépôt (carrousel, carrousel-<client>) ne sont pas reliés.
  local SKC="${CLIENT_SKILL_CARROUSEL:-carrousel}"
  [ -f "$CLONE/skills/$SKC/SKILL.md" ] || SKC=carrousel
  for d in "$CLONE"/skills/*/; do
    src="${d%/}"; n="$(basename "$src")"
    [ -f "$src/SKILL.md" ] || continue
    case "$n" in
      carrousel|carrousel-*) [ "$n" = "$SKC" ] || continue; n=carrousel;;
    esac
    cible="$SKILLS/$n"
    if [ -L "$cible" ]; then
      [ "$(readlink "$cible")" = "$src" ] || { ln -sfn "$src" "$cible"; journal "LIEN_REFAIT skills/$n"; }
    elif [ -e "$cible" ]; then
      if [ "$MODE" = "--liens-installation" ]; then
        # Ancienne copie (installation par fichiers) : on garde ses goûts appris, on range le reste.
        for f in preferences.md demandes-pour-yoan.md; do
          if [ -f "$cible/$f" ] && [ ! -f "$src/$f" ]; then cp -p "$cible/$f" "$src/$f"; journal "GARDE skills/$n/$f"; fi
        done
        mkdir -p "$BASE/anciennes-versions/$STAMP/skills"
        mv "$cible" "$BASE/anciennes-versions/$STAMP/skills/$n"
        ln -s "$src" "$cible"
        journal "REMPLACE skills/$n (ancienne copie rangée dans anciennes-versions/$STAMP)"
      else
        journal "IGNORE skills/$n : dossier qui n'est pas un lien (relancer l'installation)"
      fi
    else
      ln -s "$src" "$cible"; journal "AJOUTE skills/$n"
    fi
  done
  for f in "$CLONE"/agents/*.md; do
    [ -f "$f" ] || continue
    n="$(basename "$f")"; cible="$AGENTS/$n"
    if [ -L "$cible" ]; then
      [ "$(readlink "$cible")" = "$f" ] || { ln -sfn "$f" "$cible"; journal "LIEN_REFAIT agents/$n"; }
    elif [ -e "$cible" ]; then
      if [ "$MODE" = "--liens-installation" ]; then
        mkdir -p "$BASE/anciennes-versions/$STAMP/agents"
        mv "$cible" "$BASE/anciennes-versions/$STAMP/agents/$n"
        ln -s "$f" "$cible"; journal "REMPLACE agents/$n"
      else
        journal "IGNORE agents/$n : fichier qui n'est pas un lien (relancer l'installation)"
      fi
    else
      ln -s "$f" "$cible"; journal "AJOUTE agents/$n"
    fi
  done
  # Ce qui a disparu du dépôt : le lien ne mène plus nulle part, on le retire.
  for l in "$SKILLS"/* "$AGENTS"/*; do
    [ -L "$l" ] || continue
    t="$(readlink "$l")"
    case "$t" in
      "$CLONE"/*|"$HOC"/*) [ -e "$l" ] || { rm -f "$l"; journal "RETIRE ${l#$CC/} (plus dans le dépôt)"; } ;;
    esac
  done

  # 3. La copie du head of content (comme ses scripts : exactement le dépôt en ligne)
  if [ -d "$HOC/.git" ]; then
    if pgrep -f "head-of-content/outils/zernio.py|carrousels-en-attente/scripts/a-rendre.py" >/dev/null 2>&1; then
      journal "HOC_OCCUPE : un script du head of content tourne, copie laissée telle quelle"
    else
      local ssh_cmd=""
      [ -f "$CLE_HOC" ] && ssh_cmd="ssh -i \"$CLE_HOC\" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o BatchMode=yes -o ConnectTimeout=8"
      if GIT_SSH_COMMAND="${ssh_cmd:-ssh -o BatchMode=yes -o ConnectTimeout=8}" git -C "$HOC" fetch -q origin main 2>/dev/null; then
        git -C "$HOC" checkout -q -f -B main origin/main && journal "HOC_A_JOUR $(git -C "$HOC" rev-parse --short HEAD)"
      else
        journal "HORS_LIGNE head of content : copie gardée telle quelle"
      fi
    fi
    if [ -f "$HOC/.claude/skills/publier/SKILL.md" ] && [ ! -e "$SKILLS/publier" ] && [ ! -L "$SKILLS/publier" ]; then
      ln -s "$HOC/.claude/skills/publier" "$SKILLS/publier"; journal "AJOUTE skills/publier"
    fi
  fi

  # 4. Le studio : redémarrage du service si son code a changé et qu'aucune session ne tourne (les sessions
  #    du studio ouvrent Claude, donc lancent ce script : un redémarrage les tuerait). Sinon le repère reste
  #    et l'icône Studio ou la prochaine ouverture de Claude au repos s'en chargent.
  if [ -f "$BASE/studio/redemarrage-demande" ] && [ -f "$CLONE/studio/lancement/commun.sh" ]; then
    local r
    r="$( . "$CLONE/studio/lancement/commun.sh" && studio_redemarrer_si_demande )"
    journal "STUDIO_${r:-RIEN}"
  fi

  rm -rf "$VERROU"
  # Journal court
  if [ -f "$LOG" ] && [ "$(wc -l < "$LOG")" -gt 400 ]; then
    tail -n 200 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
  fi
  return 0
}

main "$@"; exit $?
