#!/bin/bash
# L'appli du studio dans ~/Applications (à sourcer après commun.sh, ne se lance pas seul).
# Utilisé par installation/studio.sh (installation), installation/mettre-a-jour.sh (mise à jour
# automatique) et ouvrir.sh (première ouverture depuis l'ancienne icône).
#
# Deux formes, même nom, même icône, même emplacement (l'entrée du Dock ne change pas) :
#   - l'appli Mac (appli/Studio, binaire universel construit par appli/construire.sh et gardé dans le
#     dépôt : rien à compiler chez le client) : une fenêtre, le point sous l'icône, Cmd+Tab ;
#   - le repli, si ce binaire ne se lance pas sur ce Mac : un petit script qui appelle ouvrir.sh, qui
#     ouvre le studio dans le navigateur (la forme d'avant).
# L'ancienne icône (un script) a pu laisser à macOS la consigne de la lancer en mode Intel (Rosetta) sur
# un Mac Apple : LSRequiresNativeExecution fait partir l'appli Mac en natif malgré cette consigne.
# Rien ne dépend d'un outil de développement : cp, plutil, diff, et le binaire lui-même.
# STUDIO_APPLI_NAVIGATEUR=1 (tests, ou dépannage) : pose le repli même si l'appli Mac se lance.
#
# Icône qui ne change pas dans le Dock après une mise à jour (18/11/2026) : macOS garde l'image de
# l'appli en cache (registre des applis, cache des icônes) tant que le paquet ne paraît pas avoir changé,
# et une appli ouverte garde l'image de son lancement. Après chaque remplacement (et une fois pour une
# appli posée avant ce correctif), studio_signaler_appli touche le paquet et le réenregistre
# (lsregister -f) ; si l'appli tourne, elle est relancée par studio_relancer_appli_si_demande quand le
# studio est au repos (même logique que le redémarrage du service), sinon au prochain clic sur son icône
# (ouvrir.sh) ou quand on la quitte. Les réglages du Dock ne sont jamais lus ni écrits ici, et le Dock
# n'est jamais relancé.
# Tests : les fonctions qui parlent à macOS (studio_lsregister, studio_appli_pid, studio_ouvrir_appli)
# se remplacent dans le script de test ; STUDIO_SANS_DOCK=1 coupe le registre et la relance.

# Pose l'appli si elle manque ou si elle a changé. Écrit une ligne :
#   PRESENTE <forme> | POSEE <forme> | ECHEC <raison>     (forme : native, ou navigateur (<raison>))
studio_poser_appli() {
  local lanc; lanc="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local bin="$lanc/appli/Studio" neuve="$STUDIO_HOME/.Studio.app.$$" forme raison="" v
  mkdir -p "$STUDIO_HOME" || { echo "ECHEC dossier $STUDIO_HOME impossible à créer"; return 1; }
  rm -rf "$neuve"
  mkdir -p "$neuve/Contents/MacOS" "$neuve/Contents/Resources"

  # L'appli Mac se lance-t-elle ici ? (macOS trop ancien, binaire abîmé : on garde le navigateur)
  if [ -n "${STUDIO_APPLI_NAVIGATEUR:-}" ]; then raison="demandé"
  elif [ ! -f "$bin" ]; then raison="appli absente du dépôt"
  else
    [ -x "$bin" ] || chmod 755 "$bin" 2>/dev/null
    v="$(studio_appli_essai "$bin")"
    case "$v" in "OK appli "*) ;; *) raison="ne se lance pas sur ce Mac${v:+ : $v}";; esac
  fi
  if [ -z "$raison" ]; then forme=native; else forme="navigateur ($raison)"; fi

  local nom_app; nom_app="$(printf '%s' "$STUDIO_APP_NOM" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g')"
  if [ "$forme" = native ]; then
    cp "$bin" "$neuve/Contents/MacOS/Studio" && chmod 755 "$neuve/Contents/MacOS/Studio"
    {
      cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>Studio</string>
  <key>CFBundleIdentifier</key>
  <string>$STUDIO_LABEL.app</string>
  <key>CFBundleName</key>
  <string>$nom_app</string>
  <key>CFBundleDisplayName</key>
  <string>$nom_app</string>
  <key>CFBundleIconFile</key>
  <string>Studio</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>2.0</string>
  <key>CFBundleVersion</key>
  <string>2</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleDevelopmentRegion</key>
  <string>fr</string>
  <key>LSMinimumSystemVersion</key>
  <string>11.0</string>
  <key>LSRequiresNativeExecution</key>
  <true/>
  <key>LSArchitecturePriority</key>
  <array>
    <string>arm64</string>
    <string>x86_64</string>
  </array>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSSupportsAutomaticGraphicsSwitching</key>
  <true/>
  <key>NSAppTransportSecurity</key>
  <dict>
    <key>NSAllowsLocalNetworking</key>
    <true/>
  </dict>
  <key>StudioOuvrir</key>
  <string>$(studio_xml "$lanc/ouvrir.sh")</string>
  <key>StudioJournal</key>
  <string>$(studio_xml "$STUDIO_HOME/ouvrir.log")</string>
EOF
      # Variables des tests de Yoan (bac à sable) : passées à ouvrir.sh par l'appli.
      local env_lignes=""
      [ "$STUDIO_LABEL" != "$CLIENT_LABEL" ] && env_lignes="$env_lignes    <key>STUDIO_LABEL</key>\n    <string>$(studio_xml "$STUDIO_LABEL")</string>\n"
      [ -n "${STUDIO_SERVICES_DOSSIER:-}" ] && env_lignes="$env_lignes    <key>STUDIO_SERVICES_DOSSIER</key>\n    <string>$(studio_xml "$STUDIO_SERVICES_DOSSIER")</string>\n"
      [ -n "${STUDIO_APPLIS_DOSSIER:-}" ] && env_lignes="$env_lignes    <key>STUDIO_APPLIS_DOSSIER</key>\n    <string>$(studio_xml "$STUDIO_APPLIS_DOSSIER")</string>\n"
      if [ -n "$env_lignes" ]; then printf '  <key>StudioEnvironnement</key>\n  <dict>\n%b  </dict>\n' "$env_lignes"; fi
      printf '</dict>\n</plist>\n'
    } > "$neuve/Contents/Info.plist"
  else
    cat > "$neuve/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>Studio</string>
  <key>CFBundleIdentifier</key>
  <string>$STUDIO_LABEL.app</string>
  <key>CFBundleName</key>
  <string>$nom_app</string>
  <key>CFBundleDisplayName</key>
  <string>$nom_app</string>
  <key>CFBundleIconFile</key>
  <string>Studio</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>LSUIElement</key>
  <true/>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
EOF
    {
      echo '#!/bin/bash'
      echo '# Icône Studio : tout se passe dans ouvrir.sh du dépôt (mis à jour tout seul).'
      [ "$STUDIO_LABEL" != "$CLIENT_LABEL" ] && printf 'export STUDIO_LABEL=%q\n' "$STUDIO_LABEL"
      [ -n "${STUDIO_SERVICES_DOSSIER:-}" ] && printf 'export STUDIO_SERVICES_DOSSIER=%q\n' "$STUDIO_SERVICES_DOSSIER"
      [ -n "${STUDIO_APPLIS_DOSSIER:-}" ] && printf 'export STUDIO_APPLIS_DOSSIER=%q\n' "$STUDIO_APPLIS_DOSSIER"
      printf 'O=%q\n' "$lanc/ouvrir.sh"
      echo 'if [ -f "$O" ]; then exec /bin/bash "$O"; fi'
      if [ "$CLIENT_ID" = "romain" ]; then
        echo "osascript -e 'display dialog \"Le studio n’est plus installé sur ce Mac. Envoie un message à Yoan.\" with title \"Studio\" buttons {\"OK\"} default button \"OK\"' >/dev/null 2>&1"
      else
        printf 'osascript - %q %q <<'"'"'OSA'"'"' >/dev/null 2>&1\non run argv\n  display dialog (item 1 of argv) with title (item 2 of argv) buttons {"OK"} default button "OK"\nend run\nOSA\n' \
          "Le studio n’est plus installé sur ce Mac.${CLIENT_PREVENIR:+ $CLIENT_PREVENIR}" "$STUDIO_APP_NOM"
      fi
      echo 'exit 1'
    } > "$neuve/Contents/MacOS/Studio"
    chmod 755 "$neuve/Contents/MacOS/Studio"
  fi

  if [ -n "$CLIENT_ICONE" ] && [ -f "$CLIENT_ICONE" ]; then cp "$CLIENT_ICONE" "$neuve/Contents/Resources/Studio.icns"
  elif [ -f "$lanc/icone.icns" ]; then cp "$lanc/icone.icns" "$neuve/Contents/Resources/Studio.icns"
  fi
  printf 'APPL????' > "$neuve/Contents/PkgInfo"
  if ! plutil -lint -s "$neuve/Contents/Info.plist" >/dev/null 2>&1; then
    rm -rf "$neuve"; echo "ECHEC réglages de l'appli illisibles"; return 1
  fi

  mkdir -p "$(dirname "$STUDIO_APP")"
  if [ -d "$STUDIO_APP" ] && diff -rq "$neuve" "$STUDIO_APP" >/dev/null 2>&1; then
    rm -rf "$neuve"; studio_signaler_appli >/dev/null; echo "PRESENTE $forme"; return 0
  fi
  # Remplacée d'un coup : l'appli ouverte garde sa copie jusqu'à ce qu'on la quitte, la suivante part
  # de la nouvelle. Même chemin : l'icône du Dock reste à sa place, rien n'est écrit dans ses réglages.
  rm -rf "$STUDIO_APP" && mv "$neuve" "$STUDIO_APP" || { rm -rf "$neuve"; echo "ECHEC remplacement de $STUDIO_APP_NOM.app impossible"; return 1; }
  studio_signaler_appli >/dev/null
  echo "POSEE $forme"
}

# ------------------------------------------------------------------ icône à jour dans le Dock

STUDIO_REPERE_APPLI="$STUDIO_HOME/appli-signalee"          # empreinte de l'appli dont macOS a été prévenu
STUDIO_REPERE_RELANCE="$STUDIO_HOME/appli-relance-demandee" # l'appli ouverte tourne sur l'ancienne copie

# Ce qui fait l'appli pour macOS : ses réglages, son icône, son programme.
studio_appli_empreinte() {
  cat "$STUDIO_APP/Contents/Info.plist" "$STUDIO_APP/Contents/Resources/Studio.icns" \
    "$STUDIO_APP/Contents/MacOS/Studio" 2>/dev/null | shasum | cut -c1-40
}

studio_lsregister() {
  /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$1" >/dev/null 2>&1
}

# PID de l'appli ouverte (vide si elle ne tourne pas). Lecture seule.
studio_appli_pid() {
  local asn; asn="$(lsappinfo find "bundleid=$STUDIO_LABEL.app" 2>/dev/null | head -1)"
  [ -n "$asn" ] || return 0
  lsappinfo info -only pid "$asn" 2>/dev/null | sed -n 's/^"pid"=\([0-9][0-9]*\)$/\1/p' | head -1
}
studio_appli_ouverte() { [ -n "$(studio_appli_pid)" ]; }

studio_ouvrir_appli() { open "$STUDIO_APP" >/dev/null 2>&1; }

# Prévient macOS que l'appli a changé (une fois par version posée) : date du paquet, registre des applis,
# et relance demandée si elle tourne. Rend : SIGNALEE, ou RIEN (déjà fait, ou pas d'appli).
studio_signaler_appli() {
  [ -d "$STUDIO_APP" ] || { echo RIEN; return 0; }
  local e; e="$(studio_appli_empreinte)"
  if [ "$(cat "$STUDIO_REPERE_APPLI" 2>/dev/null)" = "$e" ]; then echo RIEN; return 0; fi
  touch "$STUDIO_APP"
  if [ -z "${STUDIO_SANS_DOCK:-}" ]; then
    studio_lsregister "$STUDIO_APP" || true
    if studio_appli_ouverte; then date '+%Y-%m-%d %H:%M:%S' > "$STUDIO_REPERE_RELANCE"; fi
  fi
  mkdir -p "$STUDIO_HOME" && printf '%s\n' "$e" > "$STUDIO_REPERE_APPLI"
  echo SIGNALEE
}

# Relance l'appli ouverte sur sa nouvelle copie, seulement si le studio est au repos (aucune session,
# aucun rangement ni publication en cours). Rend : RELANCEE, ATTEND (occupé, repère gardé), RIEN.
# La relance se fait en fond, détachée : l'appelant peut être l'appli elle-même (ouvrir.sh --adresse).
studio_relancer_appli_si_demande() {
  [ -f "$STUDIO_REPERE_RELANCE" ] || { echo RIEN; return 0; }
  if [ -n "${STUDIO_SANS_DOCK:-}" ]; then echo RIEN; return 0; fi
  local pid; pid="$(studio_appli_pid)"
  # Fermée entre-temps : sa prochaine ouverture part de la nouvelle copie.
  if [ -z "$pid" ]; then rm -f "$STUDIO_REPERE_RELANCE"; echo RIEN; return 0; fi
  if ! studio_au_repos; then echo ATTEND; return 0; fi
  rm -f "$STUDIO_REPERE_RELANCE"
  (
    trap '' HUP
    kill -TERM "$pid" 2>/dev/null
    i=0; while kill -0 "$pid" 2>/dev/null && [ "$i" -lt 100 ]; do sleep 0.1; i=$((i + 1)); done
    if kill -0 "$pid" 2>/dev/null; then date '+%Y-%m-%d %H:%M:%S' > "$STUDIO_REPERE_RELANCE"; exit 0; fi
    studio_ouvrir_appli
  ) </dev/null >/dev/null 2>&1 &
  echo RELANCEE
}

studio_xml() { printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }

# Lance « <binaire> --verifier » (10 s au plus, attendu par PID) et écrit sa première ligne.
studio_appli_essai() {
  local f; f="$(mktemp "${TMPDIR:-/tmp}/studio-appli.XXXXXX")"
  "$1" --verifier > "$f" 2>/dev/null &
  local pid=$! i=0
  while kill -0 "$pid" 2>/dev/null; do
    if [ "$i" -ge 100 ]; then kill -9 "$pid" 2>/dev/null; break; fi
    sleep 0.1; i=$((i + 1))
  done
  wait "$pid" 2>/dev/null
  head -1 "$f" | cut -c1-80
  rm -f "$f"
}

