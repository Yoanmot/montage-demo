#!/bin/bash
# Mise à jour automatique du monteur et du studio d'un client : par le garde (installation/garde.sh, service launchd
# à part, toutes les 15 minutes, sans Claude ni serveur), et à chaque ouverture de Claude Code sur son Mac (hook).
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
#   3 bis. installe les dépendances (installation/dependances.txt) quand la liste a changé ; une dépendance NOUVELLE
#      impossible à installer demande au garde le retour à la version d'avant (<racine>/maj/retour-demande) ;
#   3 ter. rattrape les réglages des installations existantes (studio.sh rattraper : conservation des conversations,
#      carrousels sous la racine d'un client isolé, date du jeton de connexion, garde posé) ;
#   4. si le code du studio a changé : le redémarrage est demandé (repère) ; c'est le garde qui le fait, au repos,
#      et qui vérifie que le serveur répond (sinon retour arrière). Sans garde : comme avant, ici, au repos.
#      La copie de travail du studio (<racine>/studio/head-of-content) n'est jamais touchée ici.
#   5. remplace l'appli du studio (~/Applications) si elle a changé, au même endroit (Dock inchangé),
#      prévient macOS (paquet touché, lsregister -f) et relance l'appli ouverte quand le studio est au repos.
# Une version écartée par le garde (<racine>/maj/cassees : elle a cassé le studio) n'est jamais reprise ; la suivante
# l'est. Avant de changer de version, celle en place est notée (<racine>/maj/precedente).
# En mode --hook : jamais bloquant (8 s au plus, la suite continue en fond), jamais de sortie, toujours 0.
# Journal : <racine>/mise-a-jour.log.
#
# Autres modes : --liens-installation (appelé par installer.sh : migre les anciennes copies des skills),
# --apres-retour (appelé par le garde après un retour arrière : tout sauf le dépôt du monteur, dépendances comprises),
# sans argument : la mise à jour au premier plan, avec le journal à l'écran.
# Codes (--travail, premier plan) : 0 ; 3 dépendance nouvelle manquante (retour demandé) ; 5 un autre passage tournait.
# Variables pour les tests de Yoan seulement : STUDIO_SANS_DEPENDANCES=1, STUDIO_SANS_SERVICE=1 (voir studio.sh).

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
    if [ "$MODE" = "--travail" ] || [ "$MODE" = "--apres-retour" ]; then
      printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG"
    else
      printf '%s\n' "$*"
    fi
  }

  # Un seul passage à la fois (deux sessions ouvertes en même temps, le garde). Le verrou porte le PID de son passage :
  # jugé par ce processus vivant (repris s'il est mort, ou au bout d'une heure) ; sans PID (ancienne version), 5 min.
  local VERROU="$BASE/.mise-a-jour.verrou" vp
  if ! mkdir "$VERROU" 2>/dev/null; then
    vp="$(cat "$VERROU/pid" 2>/dev/null)"
    if { [ -n "$vp" ] && kill -0 "$vp" 2>/dev/null && [ -z "$(find "$VERROU" -maxdepth 0 -mmin +60 2>/dev/null)" ]; } \
       || { [ -z "$vp" ] && [ -z "$(find "$VERROU" -maxdepth 0 -mmin +5 2>/dev/null)" ]; }; then
      journal "DEJA_EN_COURS"; return 5
    fi
    rm -rf "$VERROU"; mkdir "$VERROU" 2>/dev/null || return 5
  fi
  echo "$$" > "$VERROU/pid"
  # shellcheck disable=SC2064
  trap "rm -rf '$VERROU'" EXIT
  local MAJ="$BASE/maj" code_sortie=0
  mkdir -p "$MAJ"

  # 1. Le dépôt du monteur (pas après un retour arrière : le garde vient de le poser sur la bonne version)
  if [ "$MODE" = "--apres-retour" ]; then
    journal "APRES_RETOUR $(git -C "$CLONE" rev-parse --short HEAD 2>/dev/null)"
  elif [ -d "$CLONE/.git" ]; then
    if git -C "$CLONE" -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=10 fetch -q origin "$BRANCHE" 2>/dev/null; then
      local avant apres cible
      avant="$(git -C "$CLONE" rev-parse HEAD 2>/dev/null)"
      cible="$(git -C "$CLONE" rev-parse "origin/$BRANCHE" 2>/dev/null)"
      if [ -n "$cible" ] && grep -q "^$cible " "$MAJ/cassees" 2>/dev/null; then
        # Version qui a cassé le studio : on reste où on est jusqu'à la suivante.
        [ "$(cat "$MAJ/.ecartee-vue" 2>/dev/null)" = "$cible" ] || { journal "VERSION_ECARTEE ${cible:0:7} (elle a cassé le studio) : on reste sur ${avant:0:7} jusqu'à la suivante"; echo "$cible" > "$MAJ/.ecartee-vue"; }
      elif [ "$(git -C "$CLONE" rev-parse --abbrev-ref HEAD 2>/dev/null)" = "$BRANCHE" ]; then
        [ "$avant" != "$cible" ] && echo "$avant" > "$MAJ/precedente"
        git -C "$CLONE" reset -q --hard "origin/$BRANCHE"
      else
        [ "$avant" != "$cible" ] && echo "$avant" > "$MAJ/precedente"
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
    # Un skill réservé à un client (fichier CLIENT, son id dedans : les briques du monteur de Yoan) n'est relié que chez lui.
    if [ -f "$src/CLIENT" ] && [ "$(tr -d '[:space:]' < "$src/CLIENT")" != "$CLIENT_ID" ]; then continue; fi
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
  # L'agent monteur : celui du client (monteur du fichier du client, agents/<nom>.md), relié sous le nom « monteur.md »
  # (celui qu'ouvre le studio) ; les monteurs des autres clients ne sont pas reliés.
  local MTR="${CLIENT_MONTEUR:-monteur}"
  [ -f "$CLONE/agents/$MTR.md" ] || MTR=monteur
  for f in "$CLONE"/agents/*.md; do
    [ -f "$f" ] || continue
    n="$(basename "$f")"
    case "$n" in
      monteur.md|monteur-*.md) [ "$n" = "$MTR.md" ] || continue; n=monteur.md;;
    esac
    cible="$AGENTS/$n"
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
  # Ce qu'une version d'avant ce script a pu relier pour un autre client (premier passage après la mise à jour) :
  # un monteur d'un autre client sous son nom, un skill réservé (fichier CLIENT) à un autre client.
  for l in "$AGENTS"/monteur-*.md; do
    [ -L "$l" ] || continue
    case "$(readlink "$l")" in "$CLONE"/agents/*) rm -f "$l"; journal "RETIRE ${l#$CC/} (monteur relié sous le nom monteur.md)";; esac
  done
  for l in "$SKILLS"/*; do
    [ -L "$l" ] || continue
    t="$(readlink "$l")"
    case "$t" in
      "$CLONE"/skills/*)
        if [ -f "$t/CLIENT" ] && [ "$(tr -d '[:space:]' < "$t/CLIENT")" != "$CLIENT_ID" ]; then rm -f "$l"; journal "RETIRE ${l#$CC/} (réservé à un autre client)"; fi;;
    esac
  done
  # Le skill de mise en page d'un autre client (carrousel-<client>), relié sous son nom par une version
  # d'avant ce script (premier passage après la mise à jour) : seul « carrousel » doit rester.
  for l in "$SKILLS"/carrousel-*; do
    [ -L "$l" ] || continue
    case "$(readlink "$l")" in "$CLONE"/skills/*) rm -f "$l"; journal "RETIRE ${l#$CC/} (mise en page d'un autre client)";; esac
  done

  # 3. La copie du head of content (comme ses scripts : exactement le dépôt en ligne)
  # Un de ses scripts tourne dans CETTE copie (dossier courant ou chemin du script dans $HOC) : on n'y touche pas.
  hoc_occupe() {
    local pid cmd cwd
    while read -r pid cmd; do
      case "$cmd" in *zernio.py*|*a-rendre.py*) ;; *) continue;; esac
      case "$cmd" in *"$HOC/"*) return 0;; esac
      cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)"
      case "$cwd" in "$HOC"|"$HOC/"*) return 0;; esac
    done <<EOF_PS
$(ps -axo pid=,command= 2>/dev/null)
EOF_PS
    return 1
  }
  if [ -d "$HOC/.git" ]; then
    if hoc_occupe; then
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

  # 3 bis. Les polices locales du client (polices_locales, lot 10), copiées si elles ont changé.
  if [ -d "$BASE/studio" ] && type studio_poser_polices >/dev/null 2>&1; then
    local lp
    while IFS= read -r lp; do case "$lp" in POLICE_POSEE*|POLICE_ABSENTE*) journal "$lp";; esac; done <<EOF_POL
$(studio_poser_polices "$BASE/studio")
EOF_POL
  fi

  # 3 bis. Les dépendances : quand leur liste a changé (ou après un retour arrière). Une dépendance nouvelle qui ne
  #    s'installe pas : retour à la version d'avant demandé au garde. Une ancienne qui manque : journal seulement.
  local LDEP="$CLONE/installation/dependances.txt"
  if [ -f "$LDEP" ] && [ -f "$CLONE/installation/dependances.sh" ] && [ -z "${STUDIO_SANS_DEPENDANCES:-}" ] && [ "$MODE" != "--liens-installation" ]; then
    local empreinte lien_claude="" tete_dep
    empreinte="$(shasum -a 256 "$LDEP" | cut -d' ' -f1)"
    tete_dep="$(git -C "$CLONE" rev-parse HEAD 2>/dev/null)"
    grep -q '^claude ' "$LDEP" && [ ! -x "$BASE/bin/claude" ] && lien_claude=1
    if [ "$MODE" = "--apres-retour" ] || [ -n "$lien_claude" ] || [ "$(cat "$MAJ/dependances-ok" 2>/dev/null)" != "$empreinte" ]; then
      # Une liste déjà essayée en vain : au plus une fois par heure (pas de pip ou brew à chaque passage).
      if [ "$MODE" = "--apres-retour" ] || [ "$(cat "$MAJ/dependances-essai" 2>/dev/null)" != "$empreinte" ] \
         || [ -n "$(find "$MAJ/dependances-essai" -mmin +60 2>/dev/null)" ]; then
        local ancien="" ref rd ld
        ref="$( { tr -d '[:space:]' < "$MAJ/bonne"; } 2>/dev/null)"; [ -n "$ref" ] || ref="$( { tr -d '[:space:]' < "$MAJ/precedente"; } 2>/dev/null)"
        if [ "$MODE" != "--apres-retour" ] && [ -n "$ref" ] && [ "$ref" != "$tete_dep" ]; then
          ancien="$MAJ/.dependances-avant.txt"
          git -C "$CLONE" show "$ref:installation/dependances.txt" > "$ancien" 2>/dev/null || : > "$ancien"
          # Une version d'avant sans liste (avant le lot 12) : rien n'est « nouveau » (l'installation posait tout).
          [ -s "$ancien" ] || cp "$LDEP" "$ancien"
        fi
        local sortie_dep
        if [ -n "$ancien" ]; then sortie_dep="$(/bin/bash "$CLONE/installation/dependances.sh" --ancien "$ancien" </dev/null 2>&1)"; rd=$?
        else sortie_dep="$(/bin/bash "$CLONE/installation/dependances.sh" </dev/null 2>&1)"; rd=$?; fi
        while IFS= read -r ld; do
          case "$ld" in DEP_OK*|"") ;; *) journal "$ld";; esac
        done <<EOF_DEP
$sortie_dep
EOF_DEP
        echo "$empreinte" > "$MAJ/dependances-essai"
        [ -n "$ancien" ] && rm -f "$ancien"
        case "$rd" in
          0) echo "$empreinte" > "$MAJ/dependances-ok"; rm -f "$MAJ/retour-demande";;
          3)
            printf '%s %s\n' "$tete_dep" "dépendance nouvelle impossible à installer : $(printf '%s\n' "$sortie_dep" | sed -n 's/^DEP_MANQUE_NOUVELLE //p' | head -1)" > "$MAJ/retour-demande"
            journal "RETOUR_DEMANDE ${tete_dep:0:7} : une dépendance nouvelle ne s'installe pas"
            code_sortie=3;;
          *) journal "DEPENDANCES_INCOMPLETES (déjà demandées par la version d'avant : à régler sur le Mac, la mise à jour reste)";;
        esac
      fi
    fi
  fi

  # 3 ter. Les réglages des installations existantes (idempotent ; rien si tout est en place).
  if [ "$MODE" != "--liens-installation" ] && [ -f "$CLONE/installation/studio.sh" ]; then
    local lr
    while IFS= read -r lr; do [ -n "$lr" ] && journal "$lr"; done <<EOF_RAT
$(/bin/bash "$CLONE/installation/studio.sh" rattraper </dev/null 2>&1)
EOF_RAT
  fi

  # 4. Le studio : redémarrage si son code a changé. Avec le garde (service à part) : c'est lui qui redémarre, au
  #    repos, et vérifie que le serveur répond ; on le réveille. Sans garde (ancienne installation) : ici, au repos.
  local GARDE_PRESENT=""
  [ -f "$BASE/garde/garde.sh" ] && [ -f "$BASE/garde/garde.env" ] && GARDE_PRESENT=1
  if [ -n "$GARDE_PRESENT" ]; then
    if [ -f "$BASE/studio/redemarrage-demande" ] && [ -z "${STUDIO_PAR_GARDE:-}" ] && [ -z "${STUDIO_SANS_SERVICE:-}" ]; then
      launchctl kickstart "gui/$(id -u)/${STUDIO_LABEL:-$CLIENT_LABEL}.garde" >/dev/null 2>&1 && journal "GARDE_REVEILLE (redémarrage demandé)"
    fi
  elif [ -f "$BASE/studio/redemarrage-demande" ] && [ -f "$CLONE/studio/lancement/commun.sh" ]; then
    local r
    r="$( . "$CLONE/studio/lancement/commun.sh" && studio_redemarrer_si_demande )"
    journal "STUDIO_${r:-RIEN}"
  fi

  # 5. L'appli du studio (~/Applications) : remplacée si elle a changé (appli Mac à la place de l'ancien
  #    script, nouvelle version, autre nom ou icône), au même endroit : l'icône du Dock ne bouge pas.
  #    Seulement si elle est installée (un client qui l'a désinstallée ne la retrouve pas).
  if [ -d "$BASE/studio" ] && [ -f "$CLONE/studio/lancement/appli.sh" ]; then
    local ra
    ra="$( . "$CLONE/studio/lancement/commun.sh" && . "$CLONE/studio/lancement/appli.sh" \
      && if [ -d "$STUDIO_APP" ]; then studio_poser_appli; else echo ABSENTE; fi )"
    case "$ra" in PRESENTE*|ABSENTE) ;; *) journal "APPLI ${ra:-RIEN}";; esac
    # Ouverte sur l'ancienne copie (ancienne icône) : relancée si le studio est au repos, sinon plus tard
    # (prochain passage ici, ou clic sur son icône : ouvrir.sh). Le Dock n'est pas touché.
    ra="$( . "$CLONE/studio/lancement/commun.sh" && . "$CLONE/studio/lancement/appli.sh" \
      && studio_relancer_appli_si_demande )"
    case "$ra" in RELANCEE|ATTEND) journal "APPLI_$ra";; esac
  fi

  rm -rf "$VERROU"
  # Journal court
  if [ -f "$LOG" ] && [ "$(wc -l < "$LOG")" -gt 400 ]; then
    tail -n 200 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
  fi
  return "$code_sortie"
}

main "$@"; exit $?
