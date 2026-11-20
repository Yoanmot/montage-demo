#!/bin/bash
# Le garde du studio d'un client : ce qui garantit qu'une mise à jour ne peut pas casser le studio sans retour.
# Tourne à part du serveur et de Claude : service launchd <label>.garde (posé par installation/studio.sh), au démarrage
# de la session puis toutes les 5 minutes. Sa copie de travail vit hors du dépôt, <racine>/garde/garde.sh, avec ses
# réglages <racine>/garde/garde.env : une version cassée du dépôt ne peut donc pas casser le garde. Il ne remplace sa
# copie que par celle d'une version qu'il a lui-même validée (serveur redémarré dessus et qui répond).
#
# À chaque passage :
#   1. toutes les 15 minutes : la mise à jour (installation/mettre-a-jour.sh --travail), qui ne prend jamais une
#      version écartée ; mise à jour en échec (code non nul) sur une version pas encore validée => retour arrière ;
#   2. retour demandé par la mise à jour (dépendance nouvelle impossible à installer, <racine>/maj/retour-demande) ;
#   3. redémarrage demandé (code du studio changé) : fait dès que le studio est au repos (aucune session, aucun script),
#      au plus tard au bout de 12 h d'attente ; puis il doit répondre dans la minute, sinon retour arrière ;
#   4. santé : le serveur répond => la version est validée (<racine>/maj/bonne) ; il ne répond plus sur une version pas
#      encore validée => retour arrière ; sur une version validée => relance simple, journalisée (pas de boucle).
#   5. une fois par jour : le service a-t-il le droit de lire le dossier d'arrivée des vidéos (Téléchargements) ?
# Retour arrière : la version cassée est notée dans <racine>/maj/cassees (jamais reprise ; une version plus récente
# l'est), le dépôt revient à la dernière version validée (sinon à celle d'avant la mise à jour), liens et dépendances
# refaits (mettre-a-jour.sh --apres-retour), serveur relancé. Journal : <racine>/mise-a-jour.log (lignes « GARDE »).
#
#   garde.sh                 un passage (launchd)
#   garde.sh --maintenant    un passage, mise à jour cherchée tout de suite, journal aussi à l'écran
#   garde.sh --etat          version validée, versions écartées, dernier retour
#   garde.sh --oublier <début du commit> | --oublier-tout   (Yoan) une version écartée peut être reprise
# Variables pour les tests de Yoan seulement : GARDE_ENV (fichier de réglages), GARDE_FAUX_SERVICE (programme appelé
# avec charge|pid|redemarrer|demarrer au lieu de launchctl), GARDE_ATTENTE (secondes pour répondre, défaut 60),
# GARDE_RECHERCHE_MIN (défaut 15), GARDE_FORCE_HEURES (défaut 12).

main() {
  set -u
  local ICI; ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local ENVF="${GARDE_ENV:-$ICI/garde.env}"
  [ -f "$ENVF" ] || { echo "GARDE réglages absents ($ENVF)"; return 0; }
  local GARDE_CLIENT="" GARDE_RACINE="" GARDE_CLONE="" GARDE_LABEL="" GARDE_DOMAINE="" GARDE_PORT="" GARDE_STUDIO_HOME="" GARDE_PLIST=""
  # shellcheck disable=SC1090
  . "$ENVF"
  [ -n "$GARDE_RACINE" ] && [ -n "$GARDE_CLONE" ] || { echo "GARDE réglages incomplets ($ENVF)"; return 0; }
  local M="$GARDE_RACINE/maj" LOG="$GARDE_RACINE/mise-a-jour.log"
  local REPERE="$GARDE_STUDIO_HOME/redemarrage-demande"
  local ATTENTE="${GARDE_ATTENTE:-60}" RECHERCHE_MIN="${GARDE_RECHERCHE_MIN:-15}" FORCE_H="${GARDE_FORCE_HEURES:-12}"
  local BAVARD=""
  export GIT_TERMINAL_PROMPT=0 LC_ALL=C DISABLE_AUTOUPDATER=1
  mkdir -p "$M"

  horodate() { date '+%Y-%m-%d %H:%M:%S'; }
  journal() {
    printf '%s GARDE %s\n' "$(horodate)" "$*" >> "$LOG"
    [ -n "$BAVARD" ] && echo "GARDE $*"
    return 0
  }
  # Une ligne qui se répète (attente, serveur muet) : écrite quand elle change, puis au plus une fois par heure.
  journal_rare() { # $1 clé, puis le texte
    local f="$M/.vu-$1"; shift
    if [ "$(cat "$f" 2>/dev/null)" != "$*" ] || [ -n "$(find "$f" -mmin +60 2>/dev/null)" ]; then
      printf '%s' "$*" > "$f"; journal "$*"
    fi
  }
  oublier_rare() { rm -f "$M/.vu-$1"; }

  tete() { git -C "$GARDE_CLONE" rev-parse HEAD 2>/dev/null; }
  court() { printf '%s' "${1:0:7}"; }
  bonne() { tr -d '[:space:]' < "$M/bonne" 2>/dev/null; }
  port() {
    local v; v="$(/usr/bin/plutil -extract port raw -o - "$GARDE_STUDIO_HOME/studio.config.json" 2>/dev/null)"
    { [ -z "$v" ] || [ "$v" = "null" ]; } && v="$GARDE_PORT"
    printf '%s' "$v"
  }
  repond() {
    local p; p="$(port)"
    curl -s -o /dev/null --max-time 3 -w '%{http_code}' -H "Host: 127.0.0.1:$p" "http://127.0.0.1:$p/" 2>/dev/null || true
  }
  attendre() { # $1 secondes : 0 si le serveur répond 200 avant
    local i=0 max=$(( ${1:-20} * 2 ))
    while [ "$i" -lt "$max" ]; do
      [ "$(repond)" = "200" ] && return 0
      sleep 0.5; i=$((i + 1))
    done
    return 1
  }
  svc() { # charge | pid | redemarrer | demarrer
    if [ -n "${GARDE_FAUX_SERVICE:-}" ]; then "$GARDE_FAUX_SERVICE" "$1"; return $?; fi
    case "$1" in
      charge) launchctl print "$GARDE_DOMAINE/$GARDE_LABEL" >/dev/null 2>&1;;
      pid) launchctl print "$GARDE_DOMAINE/$GARDE_LABEL" 2>/dev/null | awk '$1 == "pid" && $2 == "=" { print $3; exit }';;
      redemarrer) launchctl kickstart -k "$GARDE_DOMAINE/$GARDE_LABEL" >/dev/null 2>&1;;
      demarrer)
        if ! launchctl print "$GARDE_DOMAINE/$GARDE_LABEL" >/dev/null 2>&1 && [ -f "$GARDE_PLIST" ]; then
          launchctl bootstrap "$GARDE_DOMAINE" "$GARDE_PLIST" 2>/dev/null || true
        fi
        launchctl kickstart "$GARDE_DOMAINE/$GARDE_LABEL" >/dev/null 2>&1;;
    esac
  }
  # Au repos : le serveur ne tourne pas, ou il n'a aucun processus enfant (session Claude, rangement, publication...).
  au_repos() {
    local pid; pid="$(svc pid)"
    [ -z "$pid" ] && return 0
    [ -z "$(pgrep -P "$pid" 2>/dev/null)" ]
  }
  avec_limite() { # $1 secondes, puis la commande ; attend par PID
    local s="$1"; shift
    "$@" &
    local pid=$! i=0
    while kill -0 "$pid" 2>/dev/null; do
      if [ "$i" -ge $((s * 2)) ]; then kill "$pid" 2>/dev/null; sleep 1; kill -9 "$pid" 2>/dev/null; wait "$pid" 2>/dev/null; return 124; fi
      sleep 0.5; i=$((i + 1))
    done
    wait "$pid"
  }
  # Verrou par dossier, jugé par son processus vivant (sans PID : ancien verrou, repris après 5 min).
  prendre_verrou() { # $1 dossier
    local d="$1" p
    if mkdir "$d" 2>/dev/null; then echo "$$" > "$d/pid"; return 0; fi
    p="$(cat "$d/pid" 2>/dev/null)"
    if [ -n "$p" ]; then
      kill -0 "$p" 2>/dev/null && [ -z "$(find "$d" -maxdepth 0 -mmin +60 2>/dev/null)" ] && return 1
    else
      [ -z "$(find "$d" -maxdepth 0 -mmin +5 2>/dev/null)" ] && return 1
    fi
    rm -rf "$d"; mkdir "$d" 2>/dev/null || return 1; echo "$$" > "$d/pid"
  }
  ecrire() { # $1 fichier, $2 contenu (écriture atomique)
    printf '%s\n' "$2" > "$1.tmp.$$" && mv -f "$1.tmp.$$" "$1"
  }
  maj() { # lance mettre-a-jour.sh (mode $1) avec une limite ; rend son code
    STUDIO_PAR_GARDE=1 avec_limite 2700 /bin/bash "$GARDE_CLONE/installation/mettre-a-jour.sh" "$1" </dev/null >/dev/null 2>&1
  }

  # Une version est validée quand le serveur répond dessus ET que sa propre mise à jour a tourné sans erreur
  # (<racine>/maj/maj-ok) : une version qui casse la mise à jour elle-même ne devient jamais « bonne ».
  valider() {
    local h; h="$(tete)"
    [ -n "$h" ] || return 0
    [ "$(tr -d '[:space:]' < "$M/maj-ok" 2>/dev/null)" = "$h" ] || return 0
    if [ "$h" != "$(bonne)" ]; then ecrire "$M/bonne" "$h"; journal "VERSION_BONNE $(court "$h") (le serveur répond sur cette version)"; fi
    rm -f "$M/echec-depuis"; oublier_rare muet
    # Le garde se met à jour seulement depuis une version validée, et seulement si le nouveau se lit.
    local src="$GARDE_CLONE/installation/garde.sh"
    if [ -z "${GARDE_ENV:-}" ] && [ -f "$src" ] && ! cmp -s "$src" "$ICI/garde.sh" && /bin/bash -n "$src" 2>/dev/null; then
      cp "$src" "$ICI/.garde.sh.tmp.$$" && mv -f "$ICI/.garde.sh.tmp.$$" "$ICI/garde.sh" && journal "GARDE_MIS_A_JOUR $(court "$h")"
    fi
  }

  # Le retour arrière. Rend 0 si le dépôt est revenu en arrière.
  revenir() { # $1 raison
    local raison="$1" h cible
    h="$(tete)"; cible="$(bonne)"
    [ -n "$cible" ] || cible="$(tr -d '[:space:]' < "$M/precedente" 2>/dev/null)"
    if [ -z "$cible" ] || [ "$cible" = "$h" ]; then
      journal_rare impossible "RETOUR_IMPOSSIBLE $(court "$h") : $raison (aucune version d'avant connue)"; return 1
    fi
    if ! git -C "$GARDE_CLONE" cat-file -e "$cible^{commit}" 2>/dev/null; then
      journal_rare impossible "RETOUR_IMPOSSIBLE $(court "$h") : $raison (version $(court "$cible") absente du dépôt)"; return 1
    fi
    grep -q "^$h " "$M/cassees" 2>/dev/null || printf '%s %s %s\n' "$h" "$(date '+%Y-%m-%dT%H:%M:%S')" "$raison" >> "$M/cassees"
    local V="$GARDE_RACINE/.mise-a-jour.verrou" i=0
    while ! prendre_verrou "$V"; do
      [ "$i" -ge 240 ] && { journal "RETOUR_REPORTE $(court "$h") : une mise à jour tourne encore"; return 1; }
      sleep 0.5; i=$((i + 1))
    done
    git -C "$GARDE_CLONE" reset -q --hard "$cible"
    rm -rf "$V"
    local avait_repere=""
    [ -f "$REPERE" ] && avait_repere=1
    rm -f "$M/retour-demande" "$M/attente-depuis"
    if maj --apres-retour; then ecrire "$M/maj-ok" "$cible"; fi
    journal "RETOUR $(court "$h") -> $(court "$cible") : $raison ; $(court "$h") ne sera plus reprise"
    "/usr/bin/python3" - "$M/dernier-retour.json" "$h" "$cible" "$raison" <<'PYEOF' 2>/dev/null || true
import json, os, sys, datetime
p, de, vers, raison = sys.argv[1:5]
d = {"le": datetime.datetime.now().astimezone().replace(microsecond=0).isoformat(), "de": de, "vers": vers, "raison": raison}
with open(p + ".tmp", "w", encoding="utf-8") as f:
    json.dump(d, f, ensure_ascii=False, indent=2); f.write("\n")
os.replace(p + ".tmp", p)
PYEOF
    # Le serveur : s'il n'avait pas encore redémarré sur la version écartée, il tourne déjà sur la bonne.
    if [ -n "$avait_repere" ] && [ "$cible" = "$(bonne)" ] && [ "$(repond)" = "200" ]; then
      rm -f "$REPERE"; journal "RETOUR_SANS_REDEMARRAGE le serveur tournait encore sur $(court "$cible")"; return 0
    fi
    rm -f "$REPERE"
    if [ "$(repond)" = "200" ] && ! au_repos; then
      printf '%s %s\n' "$(horodate)" "retour" > "$REPERE"; journal "RETOUR_REDEMARRAGE_AU_REPOS"; return 0
    fi
    svc redemarrer
    if attendre "$ATTENTE"; then
      valider; journal "RETOUR_OK le serveur répond sur $(court "$cible")"
    else
      journal "RETOUR_SANS_EFFET le serveur ne répond toujours pas sur $(court "$cible") : le problème ne vient pas de la mise à jour"
    fi
    return 0
  }

  redemarrer() { # $1 raison
    rm -f "$REPERE" "$M/attente-depuis"; oublier_rare attente
    svc redemarrer
    if attendre "$ATTENTE"; then
      journal "REDEMARRE ($1) sur $(court "$(tete)")"; valider
    else
      revenir "le serveur ne répond plus après le redémarrage sur $(court "$(tete)")" || true
    fi
  }

  sante() {
    if [ -f "$REPERE" ]; then return 0; fi   # le serveur tourne sur un code d'avant : rien à valider ici
    if [ "$(repond)" = "200" ] || attendre "$ATTENTE"; then
      [ "$(tete)" = "$(bonne)" ] || valider
      oublier_rare muet; return 0
    fi
    local h b; h="$(tete)"; b="$(bonne)"
    if [ -n "$b" ] && [ "$h" != "$b" ]; then
      revenir "le serveur ne répond pas sur $(court "$h")" || true
    else
      journal_rare muet "SERVEUR_MUET sur $(court "$h") (version validée) : relance du service"
      svc demarrer || true
      if attendre "$ATTENTE"; then journal "SERVEUR_RELANCE il répond de nouveau"; oublier_rare muet; fi
    fi
  }

  # Le service a-t-il le droit de lire le dossier d'arrivée des vidéos (macOS protège Téléchargements) ? Lu avec le
  # même node que le serveur. Écrit <studio>/acces-arrivees.json (lu par le studio et verifier.sh), une fois par jour.
  arrivees() {
    local f="$GARDE_STUDIO_HOME/acces-arrivees.json" dossier node r
    [ -d "$GARDE_STUDIO_HOME" ] || return 0
    [ -f "$f" ] && [ -z "$(find "$f" -mmin +1440 2>/dev/null)" ] && return 0
    node="$(command -v node 2>/dev/null)"; [ -n "$node" ] || return 0
    dossier="$(/usr/bin/plutil -extract arrivees raw -o - "$GARDE_STUDIO_HOME/studio.config.json" 2>/dev/null)"
    { [ -z "$dossier" ] || [ "$dossier" = "null" ]; } && dossier="~/Downloads"
    case "$dossier" in "~") dossier="$HOME";; "~/"*) dossier="$HOME/${dossier#\~/}";; esac
    r="$(avec_limite 20 "$node" -e 'try { require("fs").readdirSync(process.argv[1]); console.log("OK"); } catch (e) { console.log(e.code || "ERREUR"); }' "$dossier" 2>/dev/null | tail -1)"
    [ -n "$r" ] || r="SANS_REPONSE"
    local avant; avant="$(/usr/bin/plutil -extract ok raw -o - "$f" 2>/dev/null)"
    /usr/bin/python3 - "$f" "$dossier" "$r" <<'PYEOF' 2>/dev/null || true
import json, os, sys, datetime
p, dossier, r = sys.argv[1:4]
d = {"ok": r == "OK", "dossier": dossier, "erreur": None if r == "OK" else r,
     "verifie_le": datetime.datetime.now().astimezone().replace(microsecond=0).isoformat()}
with open(p + ".tmp", "w", encoding="utf-8") as f:
    json.dump(d, f, ensure_ascii=False, indent=2); f.write("\n")
os.replace(p + ".tmp", p)
PYEOF
    if [ "$r" = "OK" ]; then [ "$avant" = "true" ] || journal "ARRIVEES_LISIBLES $dossier"
    else [ "$avant" = "false" ] || journal "ARRIVEES_ILLISIBLES $dossier ($r) : Réglages > Confidentialité > Fichiers et dossiers, autoriser node"; fi
  }

  # ---------------------------------------------------------------- commandes de Yoan
  case "${1:-}" in
    --etat)
      echo "version validée : $(bonne)"; echo "version d'avant la dernière mise à jour : $(cat "$M/precedente" 2>/dev/null)"
      echo "dépôt : $(tete)"; echo "versions écartées :"; cat "$M/cassees" 2>/dev/null; cat "$M/dernier-retour.json" 2>/dev/null
      return 0;;
    --oublier)
      [ -n "${2:-}" ] || { echo "usage : garde.sh --oublier <début du commit>"; return 2; }
      if [ -f "$M/cassees" ]; then grep -v "^${2}" "$M/cassees" > "$M/cassees.tmp"; mv -f "$M/cassees.tmp" "$M/cassees"; fi
      journal "OUBLIE $2 (peut être reprise)"; return 0;;
    --oublier-tout) rm -f "$M/cassees"; journal "OUBLIE toutes les versions écartées"; return 0;;
    --maintenant) BAVARD=1; rm -f "$M/derniere-recherche";;
  esac

  # ---------------------------------------------------------------- un passage
  local VG="$M/.garde.verrou"
  prendre_verrou "$VG" || return 0
  # shellcheck disable=SC2064
  trap "rm -rf '$VG'" EXIT
  [ -d "$GARDE_CLONE/.git" ] || { journal_rare clone "PAS_DE_COPIE $GARDE_CLONE"; return 0; }
  if ! svc charge; then
    # Service retiré (désinstallation) : rien à garder. Réglage présent mais pas chargé : on le recharge.
    if [ -n "$GARDE_PLIST" ] && [ -f "$GARDE_PLIST" ]; then journal_rare service "SERVICE_RECHARGE"; svc demarrer || true
    else journal_rare service "SERVICE_ABSENT : rien à garder"; return 0; fi
  else
    oublier_rare service
  fi

  # 1. La mise à jour (toutes les RECHERCHE_MIN minutes)
  if [ ! -f "$M/derniere-recherche" ] || [ -n "$(find "$M/derniere-recherche" -mmin +"$((RECHERCHE_MIN - 1))" 2>/dev/null)" ]; then
    : > "$M/derniere-recherche"
    local avant rc=0
    avant="$(tete)"
    maj --travail || rc=$?
    # Version changée : sa propre mise à jour tourne tout de suite (le passage d'avant était celui de l'ancienne).
    if [ "$(tete)" != "$avant" ]; then rc=0; maj --travail || rc=$?; fi
    case "$rc" in
      0|3) ecrire "$M/maj-ok" "$(tete)";;
      5) ;;   # une autre mise à jour tournait : rien de jugé
      *)
        if [ "$(tete)" != "$(bonne)" ]; then revenir "la mise à jour ne marche pas sur $(court "$(tete)") (code $rc)" || true
        else journal "MISE_A_JOUR_EN_ECHEC code $rc sur $(court "$(tete)") (version validée)"; fi;;
    esac
  fi

  # 2. Retour demandé par la mise à jour (sur la version en place seulement)
  if [ -f "$M/retour-demande" ]; then
    local sha raison
    sha="$(awk 'NR==1 {print $1}' "$M/retour-demande")"; raison="$(cut -d' ' -f2- "$M/retour-demande" | head -1)"
    if [ "$sha" = "$(tete)" ]; then revenir "$raison" || true; else rm -f "$M/retour-demande"; fi
  fi

  # 3. Redémarrage demandé : au repos, ou forcé après FORCE_H heures d'attente
  if [ -f "$REPERE" ]; then
    [ -f "$M/attente-depuis" ] || : > "$M/attente-depuis"
    if au_repos; then
      redemarrer "code du studio changé"
    elif [ -n "$(find "$M/attente-depuis" -mmin +"$((FORCE_H * 60))" 2>/dev/null)" ]; then
      journal "REDEMARRAGE_FORCE après $FORCE_H h d'attente (une session ou un script ne finit pas)"
      redemarrer "forcé après $FORCE_H h"
    elif [ "$(repond)" != "200" ] && ! attendre 20; then
      redemarrer "le serveur ne répondait pas"
    else
      journal_rare attente "ATTEND le studio travaille : redémarrage sur $(court "$(tete)") dès qu'il a fini"
    fi
  fi

  # 4. Santé
  sante

  # 5. Dossier d'arrivée des vidéos
  arrivees
  return 0
}

main "$@"; exit $?
