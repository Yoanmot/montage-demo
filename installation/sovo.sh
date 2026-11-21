#!/bin/bash
# Sovo (dictée vocale de Yoan, touche Fn) sur le Mac d'un client : installation, réglage de la touche Fn,
# autorisations. Lancé par le prompt d'installation, en tout premier (les seuls gestes du client sont au début).
#   /bin/bash <racine>/montage-demo/installation/sovo.sh installer   télécharge la version publiée (somme sha256
#                    vérifiée, signature « Sovo Code Signing » vérifiée), la pose dans /Applications, retire la
#                    quarantaine, règle la touche Fn sur « Ne rien faire », lance Sovo et ouvre le réglage des
#                    autorisations qui manquent
#   /bin/bash .../sovo.sh attendre [secondes]   attend que les trois autorisations soient actives (défaut 480 s),
#                    ouvre le bon volet des Réglages au fur et à mesure, relance Sovo quand il le faut (la
#                    surveillance de l'entrée n'est lue par Sovo qu'à son lancement)
#   /bin/bash .../sovo.sh etat                  l'état, sans rien changer
# Sortie : OK | INSTALLE | ECHEC | SOVO_IMPOSSIBLE <raison> (Mac trop ancien : on passe, rien de bloquant)
#   et SOVO_ETAT lance=.. micro=.. accessibilite=.. surveillance=.. ; attendre finit par SOVO_PRET ou SOVO_MANQUE <liste>.
# Variables pour les essais de Yoan seulement : SOVO_URL (adresse du zip), SOVO_SHA256, SOVO_APPLIS (dossier des
# applis, défaut /Applications), SOVO_JOURNAL (défaut ~/Library/Logs/Sovo.log), SOVO_FN_DOMAINE (fichier de
# réglages à la place de com.apple.HIToolbox), SOVO_SANS_LANCEMENT=1 (ne lance ni ne quitte Sovo, n'ouvre aucun
# réglage), SOVO_LANCER (programme appelé à la place de open -a pour lancer Sovo).

SOVO_VERSION="1.1"
SOVO_URL_DEFAUT="https://github.com/Yoanmot/montage-demo/releases/download/sovo-1.1/Sovo-1.1.zip"
SOVO_SHA256_DEFAUT="7f19a3c7c04561dbec6ab726428e8a9c14db2c46fdb2b4fb8e156b2fec235dde"
# Le certificat stable de Sovo (projets/perso/whisperflow-clone/scripts/build.sh) : les autorisations macOS restent
# valables d'une version à l'autre tant que l'appli est signée par lui.
SOVO_CERT="eb678a944aaffe65795ac86dad56a58a45ee17c6"
SOVO_ID="com.yoanmottier.WhisperflowClone"
REGLAGE="x-apple.systempreferences:com.apple.preference.security"

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APPLIS="${SOVO_APPLIS:-/Applications}"
APP="$APPLIS/Sovo.app"
JOURNAL="${SOVO_JOURNAL:-$HOME/Library/Logs/Sovo.log}"
FN_DOMAINE="${SOVO_FN_DOMAINE:-com.apple.HIToolbox}"
PY=/usr/bin/python3

signee_par_sovo() { codesign -d -r- "$1" 2>&1 | grep -qi "certificate leaf = H.$SOVO_CERT"; }
version_de() { /usr/bin/defaults read "$1/Contents/Info.plist" CFBundleShortVersionString 2>/dev/null; }
sovo_pid() { pgrep -x Sovo 2>/dev/null | head -1; }
etat() { if [ -n "${1:-}" ]; then "$PY" -I "$ICI/sovo_etat.py" "$JOURNAL" "$1"; else "$PY" -I "$ICI/sovo_etat.py" "$JOURNAL"; fi; }

lancer() {
  [ -n "${SOVO_SANS_LANCEMENT:-}" ] && return 0
  if [ -n "${SOVO_LANCER:-}" ]; then "$SOVO_LANCER" "$APP"; else /usr/bin/open -a "$APP"; fi
}
quitter() {
  [ -n "${SOVO_SANS_LANCEMENT:-}" ] && return 0
  local p; p="$(sovo_pid)"; [ -n "$p" ] || return 0
  osascript -e 'tell application id "'"$SOVO_ID"'" to quit' >/dev/null 2>&1
  local i=0; while kill -0 "$p" 2>/dev/null && [ "$i" -lt 20 ]; do sleep 0.5; i=$((i + 1)); done
  kill -0 "$p" 2>/dev/null && kill "$p" 2>/dev/null
  return 0
}
ouvrir_reglage() { # $1 Privacy_Accessibility | Privacy_ListenEvent | Privacy_Microphone
  [ -n "${SOVO_SANS_LANCEMENT:-}" ] && { echo "  (essai) réglage ouvert : $1"; return 0; }
  /usr/bin/open "$REGLAGE?$1" >/dev/null 2>&1
}

# La touche Fn : « Ne rien faire » (Réglages Système > Clavier > « Appuyer sur la touche 🌐 pour »), valeur 0 de
# AppleFnUsageType, celle que Réglages Système écrit pour ce choix.
regler_fn() {
  local v; v="$(/usr/bin/defaults read "$FN_DOMAINE" AppleFnUsageType 2>/dev/null)"
  if [ "$v" = "0" ]; then echo "OK sovo-fn touche Fn déjà sur « Ne rien faire »"; return 0; fi
  if /usr/bin/defaults write "$FN_DOMAINE" AppleFnUsageType -int 0 && [ "$(/usr/bin/defaults read "$FN_DOMAINE" AppleFnUsageType 2>/dev/null)" = "0" ]; then
    # Prise en compte sans fermer la session (ce que fait Réglages Système après un changement).
    local a=/System/Library/PrivateFrameworks/SystemAdministration.framework/Resources/activateSettings
    [ -z "${SOVO_FN_DOMAINE:-}" ] && [ -x "$a" ] && "$a" -u >/dev/null 2>&1
    echo "INSTALLE sovo-fn touche Fn réglée sur « Ne rien faire » (avant : ${v:-réglage par défaut})"
  else
    echo "ECHEC sovo-fn : réglage de la touche Fn impossible"
  fi
}

cmd_installer() {
  set -u
  local arch macos
  arch="$(uname -m)"; macos="$(sw_vers -productVersion 2>/dev/null)"
  if [ "$arch" != "arm64" ]; then echo "SOVO_IMPOSSIBLE Sovo demande une puce Apple (M1 ou plus récente), ce Mac est $arch"; return 0; fi
  if [ "${macos%%.*}" -lt 14 ]; then echo "SOVO_IMPOSSIBLE Sovo demande macOS 14 ou plus, ce Mac a $macos"; return 0; fi
  if [ -d "$APP" ] && [ "$(version_de "$APP")" = "$SOVO_VERSION" ] && signee_par_sovo "$APP"; then
    echo "OK sovo version $SOVO_VERSION déjà installée"
  else
    local D; D="$(mktemp -d "${TMPDIR:-/tmp}/sovo.XXXXXX")"
    local url="${SOVO_URL:-$SOVO_URL_DEFAUT}" attendu="${SOVO_SHA256:-$SOVO_SHA256_DEFAUT}" s
    if ! curl -fsSL --retry 2 --max-time 300 "$url" -o "$D/Sovo.zip"; then
      rm -rf "$D"; echo "ECHEC sovo : téléchargement impossible ($url)"; return 0
    fi
    s="$(shasum -a 256 "$D/Sovo.zip" | awk '{print $1}')"
    if [ "$s" != "$attendu" ]; then rm -rf "$D"; echo "ECHEC sovo : fichier téléchargé différent de la version publiée (sha256 $s)"; return 0; fi
    mkdir -p "$D/x"
    if ! ditto -x -k "$D/Sovo.zip" "$D/x" || [ ! -d "$D/x/Sovo.app" ]; then rm -rf "$D"; echo "ECHEC sovo : archive illisible"; return 0; fi
    if ! codesign --verify --deep --strict "$D/x/Sovo.app" >/dev/null 2>&1 || ! signee_par_sovo "$D/x/Sovo.app"; then
      rm -rf "$D"; echo "ECHEC sovo : signature inattendue (pas le certificat de Sovo)"; return 0
    fi
    # Une ancienne version signée autrement : ses autorisations ne valent plus pour la nouvelle (macOS les garderait
    # affichées, sans effet). On les efface pour que le Mac les redemande proprement.
    local reset=""
    if [ -d "$APP" ] && ! signee_par_sovo "$APP"; then reset=1; fi
    quitter
    mkdir -p "$APPLIS"
    if [ -d "$APP" ]; then mv "$APP" "$D/ancienne-Sovo.app"; fi
    if ditto "$D/x/Sovo.app" "$APP"; then
      xattr -dr com.apple.quarantine "$APP" 2>/dev/null || true
      if [ -n "$reset" ] && [ -z "${SOVO_APPLIS:-}" ]; then
        tccutil reset Accessibility "$SOVO_ID" >/dev/null 2>&1; tccutil reset ListenEvent "$SOVO_ID" >/dev/null 2>&1
        tccutil reset Microphone "$SOVO_ID" >/dev/null 2>&1
      fi
      local note=""; [ -n "$reset" ] && note=" (autorisations de l'ancienne version effacées)"
      echo "INSTALLE sovo $SOVO_VERSION dans $APPLIS$note"
    else
      [ -d "$D/ancienne-Sovo.app" ] && [ ! -d "$APP" ] && mv "$D/ancienne-Sovo.app" "$APP"
      echo "ECHEC sovo : copie dans $APPLIS impossible"
    fi
    rm -rf "$D"
  fi
  regler_fn
  [ -d "$APP" ] || return 0
  # Lancé (ou relancé si une version vient d'être posée) : son journal dit ce qui manque.
  local avant; avant="$(date +%s)"
  if [ -z "$(sovo_pid)" ] || [ -n "${SOVO_SANS_LANCEMENT:-}" ]; then lancer; else quitter; lancer; fi
  local i=0 e=""
  while [ "$i" -lt 30 ]; do
    e="$(etat "$((avant - 2))")"
    case "$e" in *"lance=1"*) break;; esac
    sleep 0.5; i=$((i + 1))
  done
  echo "$e"
  case "$e" in
    *"lance=0"*) echo "ECHEC sovo : lancé mais son journal ne dit rien";;
    *accessibilite=non*) ouvrir_reglage Privacy_Accessibility;;
    *surveillance=non*) ouvrir_reglage Privacy_ListenEvent;;
  esac
  return 0
}

cmd_attendre() {
  set -u
  local max="${1:-480}" debut=$SECONDS ouvert="" relance=$SECONDS e manque
  while :; do
    e="$(etat)"
    manque=""
    case "$e" in *micro=oui*) ;; *) manque="micro";; esac
    case "$e" in *accessibilite=oui*) ;; *) manque="${manque:+$manque,}accessibilite";; esac
    case "$e" in *surveillance=oui*) ;; *) manque="${manque:+$manque,}surveillance";; esac
    case "$e" in *"lance=0"*) manque="lancement";; esac
    if [ -z "$manque" ]; then echo "$e"; echo "SOVO_PRET"; return 0; fi
    if [ $((SECONDS - debut)) -ge "$max" ]; then echo "$e"; echo "SOVO_MANQUE $manque"; return 0; fi
    # Le volet du réglage qui manque, une fois chacun (le client a la fenêtre sous les yeux).
    case "$manque" in
      lancement) [ -z "$(sovo_pid)" ] && lancer;;
      *micro*) case "$e" in *micro=refuse*) [ "$ouvert" != micro ] && { ouvrir_reglage Privacy_Microphone; ouvert=micro; };; esac;;
      accessibilite*) [ "$ouvert" != acces ] && { ouvrir_reglage Privacy_Accessibility; ouvert=acces; };;
      surveillance)
        [ "$ouvert" != surv ] && { ouvrir_reglage Privacy_ListenEvent; ouvert=surv; relance=$SECONDS; }
        # Sovo ne relit cette autorisation qu'à son lancement : relancé toutes les 45 s tant qu'elle manque
        # (sans fenêtre de plus : macOS ne repose pas la question), ou tout de suite si le client a cliqué
        # « Quitter et rouvrir ».
        if [ $((SECONDS - relance)) -ge 45 ]; then quitter; lancer; relance=$SECONDS; fi;;
    esac
    sleep 2
  done
}

case "${1:-installer}" in
  installer) cmd_installer;;
  attendre) cmd_attendre "${2:-480}";;
  etat) etat;;
  *) echo "usage : sovo.sh installer | attendre [secondes] | etat"; exit 2;;
esac
