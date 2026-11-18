#!/bin/bash
# Retire le studio du client de ce Mac : le service, l'appli, son icône du Dock.
#   /bin/bash <racine>/montage-demo/installation/desinstaller-studio.sh   (<racine> = ~/.montage-yoan chez Romain)
# L'état du studio (<racine>/studio : réglages, conversations, copie de travail du head of
# content avec son travail éventuellement pas envoyé) est rangé dans <racine>/anciennes-versions/,
# jamais effacé. Le dossier des vidéos n'est jamais touché.
# Le monteur, les skills et la mise à jour automatique restent installés.
# Sortie : RETIRE <point> | ABSENT <point> | RANGE <point> | GARDE <point> | ECHEC <point>, puis FIN.
# Variables pour les tests de Yoan : STUDIO_LABEL, STUDIO_SANS_DOCK=1 (voir studio.sh).

ICI="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=../studio/lancement/commun.sh
. "$ICI/../studio/lancement/commun.sh"
set -u
BASE="$STUDIO_RACINE"
stamp="$(date +%Y%m%d-%H%M%S)"

# Le service (le serveur arrête ses sessions Claude sur SIGTERM)
if studio_charge; then
  launchctl bootout "$STUDIO_DOMAINE/$STUDIO_LABEL" 2>/dev/null || true
  i=0; while studio_charge && [ "$i" -lt 30 ]; do sleep 0.5; i=$((i + 1)); done
  if studio_charge; then echo "ECHEC service : toujours chargé ($STUDIO_LABEL)"; else echo "RETIRE service $STUDIO_LABEL"; fi
else
  echo "ABSENT service $STUDIO_LABEL"
fi
if [ -f "$STUDIO_PLIST" ]; then rm -f "$STUDIO_PLIST"; echo "RETIRE réglage du service"; fi

# L'icône du Dock (seulement l'entrée qui mène à cette appli)
if [ -n "${STUDIO_SANS_DOCK:-}" ]; then
  echo "GARDE dock (test)"
else
  t="$(mktemp)"
  if defaults export com.apple.dock "$t" 2>/dev/null; then
    r="$(/usr/bin/python3 - "$t" "file://$STUDIO_APP/" <<'PYEOF'
import plistlib, sys
p, url = sys.argv[1], sys.argv[2]
d = plistlib.load(open(p, "rb"))
apps = d.get("persistent-apps") or []
garde = [a for a in apps if ((a.get("tile-data") or {}).get("file-data") or {}).get("_CFURLString", "").rstrip("/") != url.rstrip("/")]
if len(garde) == len(apps):
    print("ABSENT")
else:
    d["persistent-apps"] = garde
    plistlib.dump(d, open(p, "wb"), fmt=plistlib.FMT_BINARY)
    print("RETIRE")
PYEOF
)"
    if [ "$r" = "RETIRE" ]; then
      defaults import com.apple.dock "$t" && killall Dock >/dev/null 2>&1
      echo "RETIRE icône du Dock"
    else
      echo "ABSENT icône du Dock"
    fi
  else
    echo "ECHEC dock : réglages du Dock illisibles"
  fi
  rm -f "$t"
fi

# L'appli
if [ -d "$STUDIO_APP" ]; then
  # L'appli Mac ouverte se ferme d'abord (sinon sa fenêtre resterait sur un studio arrêté).
  if [ -z "${STUDIO_SANS_DOCK:-}" ] && [ -n "$(lsappinfo find "bundleid=$STUDIO_LABEL.app" 2>/dev/null)" ]; then
    osascript -e "tell application id \"$STUDIO_LABEL.app\" to quit" >/dev/null 2>&1 || true
  fi
  rm -rf "$STUDIO_APP"
  if [ -z "${STUDIO_SANS_DOCK:-}" ]; then
    /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -u "$STUDIO_APP" >/dev/null 2>&1 || true
  fi
  echo "RETIRE appli $STUDIO_APP_NOM"
else
  echo "ABSENT appli $STUDIO_APP_NOM"
fi

# L'état du studio : rangé, jamais effacé (le dossier des vidéos n'est pas dedans)
if [ -d "$STUDIO_HOME" ]; then
  mkdir -p "$BASE/anciennes-versions/$stamp"
  mv "$STUDIO_HOME" "$BASE/anciennes-versions/$stamp/studio"
  echo "RANGE état du studio dans $BASE/anciennes-versions/$stamp/studio"
else
  echo "ABSENT état du studio"
fi
echo "GARDE dossier des vidéos (jamais touché)"
echo "FIN"
