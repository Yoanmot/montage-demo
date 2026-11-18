#!/bin/bash
# Le head of content d'une installation d'essai (client à simulation forcée, ex. romain-test sur le Mac de
# Yoan) : une copie jetable du dépôt du client, qui ne peut rien envoyer sur GitHub, et qui reçoit les
# retouches que Yoan fait dans sa propre copie du dépôt.
#
#   STUDIO_CLIENT=romain-test /bin/bash installation/hoc-essai.sh preparer <dépôt source> [<branche>]
#       avant installer.sh : crée <racine>/hoc-essai.git (dépôt nu local, sans aucun lien vers GitHub),
#       copie de la branche <branche> (défaut main) du dépôt source, et retient la source dans
#       <racine>/hoc-source. Le fichier du client pointe head_of_content.depot sur ce dépôt nu : les
#       copies du studio le prennent pour « le dépôt en ligne » (envois, alignements, carrousels).
#   /bin/bash <racine>/montage-demo/installation/hoc-essai.sh proteger
#       (lancé aussi par installer.sh et par tirer) : dans les deux copies (<racine>/head-of-content et
#       <racine>/studio/head-of-content), tout envoi vers GitHub échoue (pushInsteadOf vers un chemin
#       impossible) et un crochet pre-push refuse tout autre destinataire que le dépôt nu local.
#   /bin/bash <racine>/montage-demo/installation/hoc-essai.sh tirer [<dépôt source>] [<branche>]
#       les retouches de Yoan : fusionne la branche de la source dans la copie de travail du studio
#       (ce que le test a écrit, idées, briefs, plans, reste), l'envoie au dépôt nu, aligne la copie
#       des scripts. Refuse si le studio travaille (une session tourne) ou en cas de conflit (rien changé).
#   /bin/bash <racine>/montage-demo/installation/hoc-essai.sh etat
#
# Sortie : lignes OK / INSTALLE / ECHEC, dernière ligne HOC_ESSAI_FIN ok=<n> echecs=<n>.
# Refuse un client sans simulation_forcee : jamais sur une vraie installation.

main() {
  set -u
  export GIT_TERMINAL_PROMPT=0 LC_ALL=C
  local ICI; ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  # shellcheck source=../studio/lancement/client.sh
  . "$ICI/../studio/lancement/client.sh"
  local nb_ok=0 nb_echec=0
  ok()       { echo "OK $*"; nb_ok=$((nb_ok + 1)); }
  installe() { echo "INSTALLE $*"; nb_ok=$((nb_ok + 1)); }
  echec()    { echo "ECHEC $*"; nb_echec=$((nb_echec + 1)); }
  fin()      { echo "HOC_ESSAI_FIN ok=$nb_ok echecs=$nb_echec"; [ "$nb_echec" -eq 0 ]; }

  studio_client_charger || { echec "client : $CLIENT_ERREUR"; fin; return 1; }
  if [ -z "${CLIENT_SIMULATION_FORCEE:-}" ]; then
    echec "client $CLIENT_ID : pas une installation d'essai (simulation_forcee absent), rien fait"; fin; return 1
  fi
  local BASE="$CLIENT_RACINE"
  local NU="$CLIENT_HOC_DEPOT"
  local SOURCE_F="$BASE/hoc-source"
  local MAC="$BASE/head-of-content"
  local TRAVAIL="$BASE/studio/head-of-content"
  case "$NU" in
    /*) ;;
    *) echec "head_of_content.depot du client $CLIENT_ID n'est pas un dépôt local ($NU) : rien fait"; fin; return 1;;
  esac

  crochets() { local h; h="$(git -C "$1" rev-parse --git-path hooks)"; case "$h" in /*) echo "$h";; *) echo "$1/$h";; esac; }

  # Les copies : origin = le dépôt nu ; GitHub injoignable en envoi ; crochet pre-push.
  proteger_copie() { # $1 copie
    local d="$1" h
    [ -d "$d/.git" ] || return 0
    if [ "$(git -C "$d" remote get-url origin 2>/dev/null)" != "$NU" ]; then
      git -C "$d" remote set-url origin "$NU" 2>/dev/null || git -C "$d" remote add origin "$NU"
    fi
    git -C "$d" config --unset-all remote.origin.pushurl 2>/dev/null || true
    local p
    for p in "git@github.com:" "ssh://git@github.com/" "https://github.com/" "http://github.com/"; do
      git -C "$d" config --get-all "url./dev/null/envoi-interdit-installation-essai/.pushInsteadOf" 2>/dev/null | grep -qxF "$p" \
        || git -C "$d" config --add "url./dev/null/envoi-interdit-installation-essai/.pushInsteadOf" "$p"
    done
    h="$(crochets "$d")"
    mkdir -p "$h"
    cat > "$h/pre-push.tmp" <<EOF
#!/bin/bash
# Installation d'essai ($CLIENT_ID) : seul le dépôt nu local reçoit des envois, jamais GitHub.
[ "\$2" = "$NU" ] && exit 0
echo "ENVOI_INTERDIT installation d'essai : seul $NU reçoit des envois (demandé : \$2)" >&2
exit 1
EOF
    chmod 755 "$h/pre-push.tmp"
    if cmp -s "$h/pre-push.tmp" "$h/pre-push" 2>/dev/null; then rm -f "$h/pre-push.tmp"; ok "protection $(basename "$(dirname "$d")")/$(basename "$d") en place"
    else mv "$h/pre-push.tmp" "$h/pre-push"; installe "protection $(basename "$(dirname "$d")")/$(basename "$d") : envois vers GitHub impossibles, seul le dépôt nu local"; fi
  }

  cmd_preparer() { # $1 source, $2 branche
    local src="${1:-}" br="${2:-main}"
    [ -n "$src" ] || { echec "preparer : dépôt source manquant"; return; }
    src="$(cd "$src" 2>/dev/null && pwd)" || { echec "preparer : dossier source introuvable ($1)"; return; }
    git -C "$src" rev-parse --verify -q "refs/heads/$br" >/dev/null || { echec "preparer : la branche $br n'existe pas dans $src"; return; }
    mkdir -p "$BASE"; chmod 700 "$BASE" 2>/dev/null || true
    printf 'SOURCE=%s\nBRANCHE=%s\n' "$src" "$br" > "$SOURCE_F"
    if [ -d "$NU" ] && git -C "$NU" rev-parse --is-bare-repository >/dev/null 2>&1; then
      ok "depot-nu présent ($NU, main $(git -C "$NU" rev-parse --short main 2>/dev/null))"
    else
      if git clone -q --bare --single-branch --branch "$br" "$src" "$NU"; then
        git -C "$NU" remote remove origin 2>/dev/null || true
        [ "$br" = main ] || git -C "$NU" branch -m "$br" main
        git -C "$NU" symbolic-ref HEAD refs/heads/main
        installe "depot-nu $NU ($(git -C "$NU" rev-parse --short main), copie de $br de $src, aucun lien vers GitHub)"
      else
        echec "depot-nu : copie impossible depuis $src"
      fi
    fi
  }

  source_lue() { # remplit SRC et BR depuis $1/$2 ou <racine>/hoc-source
    SRC="${1:-$(sed -n 's/^SOURCE=//p' "$SOURCE_F" 2>/dev/null)}"
    BR="${2:-$(sed -n 's/^BRANCHE=//p' "$SOURCE_F" 2>/dev/null)}"; BR="${BR:-main}"
  }

  cmd_tirer() {
    local SRC BR
    source_lue "$@"
    [ -n "$SRC" ] && [ -d "$SRC" ] || { echec "tirer : dépôt source inconnu (hoc-essai.sh tirer <dépôt source>)"; return; }
    [ -d "$TRAVAIL/.git" ] || { echec "tirer : copie de travail absente ($TRAVAIL), lancer installer.sh"; return; }
    # Studio occupé : une session écrit peut-être dans la copie de travail.
    if [ -f "$BASE/montage-demo/studio/lancement/commun.sh" ]; then
      if ! ( . "$BASE/montage-demo/studio/lancement/commun.sh" >/dev/null 2>&1 && studio_au_repos ); then
        echec "tirer : le studio travaille (une session tourne), réessayer quand il est au repos"; return
      fi
    fi
    proteger_copie "$TRAVAIL"
    local avant; avant="$(git -C "$TRAVAIL" rev-parse HEAD)"
    if ! git -C "$TRAVAIL" pull -q --rebase origin main 2>"$BASE/hoc-essai.log"; then
      git -C "$TRAVAIL" rebase --abort 2>/dev/null || true
      echec "tirer : la copie de travail ne se met pas à jour depuis le dépôt nu ($(tail -1 "$BASE/hoc-essai.log"))"; return
    fi
    if ! git -C "$TRAVAIL" fetch -q "$SRC" "$BR" 2>>"$BASE/hoc-essai.log"; then
      echec "tirer : lecture impossible de $SRC ($BR)"; return
    fi
    local nouveaux; nouveaux="$(git -C "$TRAVAIL" log --oneline HEAD..FETCH_HEAD | wc -l | tr -d ' ')"
    if [ "$nouveaux" = 0 ]; then
      ok "retouches rien de nouveau dans $BR de $(basename "$SRC") ($(git -C "$TRAVAIL" rev-parse --short FETCH_HEAD) déjà là)"
    elif git -C "$TRAVAIL" -c user.name="Mac de $CLIENT_PRENOM (essai)" -c user.email="$CLIENT_GIT_EMAIL" \
           merge -q --no-edit -m "Retouches de Yoan tirées de $BR ($(git -C "$TRAVAIL" rev-parse --short FETCH_HEAD))" FETCH_HEAD 2>>"$BASE/hoc-essai.log"; then
      installe "retouches $nouveaux commit(s) de $BR fusionnés :"
      git -C "$TRAVAIL" log --oneline --no-merges "$avant..HEAD" -- . | head -20 | sed 's/^/  /'
    else
      local conflits; conflits="$(git -C "$TRAVAIL" diff --name-only --diff-filter=U | tr '\n' ' ')"
      git -C "$TRAVAIL" merge --abort 2>/dev/null || git -C "$TRAVAIL" reset -q --hard "$avant"
      echec "tirer : conflit entre les retouches et ce que le test a écrit (${conflits:-voir $BASE/hoc-essai.log}) : rien changé"; return
    fi
    if git -C "$TRAVAIL" push -q origin HEAD:main 2>>"$BASE/hoc-essai.log"; then ok "depot-nu à jour ($(git -C "$NU" rev-parse --short main))"
    else echec "tirer : envoi au dépôt nu impossible ($(tail -1 "$BASE/hoc-essai.log"))"; return; fi
    if [ -d "$MAC/.git" ]; then
      proteger_copie "$MAC"
      if git -C "$MAC" fetch -q origin main && git -C "$MAC" checkout -q -f -B main origin/main; then ok "copie-scripts alignée ($(git -C "$MAC" rev-parse --short HEAD))"
      else echec "copie-scripts : alignement impossible"; fi
    fi
  }

  cmd_etat() {
    local SRC BR
    source_lue
    echo "SOURCE ${SRC:-inconnue} (branche $BR)"
    [ -d "$NU" ] && echo "DEPOT_NU $NU main=$(git -C "$NU" rev-parse --short main 2>/dev/null)"
    local d
    for d in "$TRAVAIL" "$MAC"; do
      [ -d "$d/.git" ] || { echo "COPIE_ABSENTE $d"; continue; }
      echo "COPIE $d $(git -C "$d" rev-parse --short HEAD) origin=$(git -C "$d" remote get-url origin) pre-push=$([ -x "$(crochets "$d")/pre-push" ] && echo oui || echo NON) envoi-github=$(git -C "$d" config --get-all url./dev/null/envoi-interdit-installation-essai/.pushInsteadOf | wc -l | tr -d ' ')-adresses-bloquees"
    done
    if [ -n "$SRC" ] && [ -d "$SRC/.git" ] && [ -d "$TRAVAIL/.git" ] && git -C "$TRAVAIL" fetch -q "$SRC" "$BR" 2>/dev/null; then
      echo "A_TIRER $(git -C "$TRAVAIL" log --oneline HEAD..FETCH_HEAD | wc -l | tr -d ' ') commit(s) de $BR pas encore dans l'installation"
    fi
    ok "etat"
  }

  case "${1:-}" in
    preparer) shift; cmd_preparer "$@";;
    proteger) proteger_copie "$TRAVAIL"; proteger_copie "$MAC";;
    tirer) shift; cmd_tirer "$@";;
    etat) cmd_etat;;
    *) echo "usage : hoc-essai.sh preparer <dépôt source> [<branche>] | proteger | tirer [<dépôt source>] [<branche>] | etat"; return 2;;
  esac
  fin
}

main "$@"; exit $?
