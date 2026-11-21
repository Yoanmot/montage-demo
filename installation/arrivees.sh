#!/bin/bash
# Pendant les gestes du début : le service du studio aura-t-il le droit de lire le dossier d'arrivée des vidéos
# (Téléchargements, protégé par macOS) ? On pose la question à macOS tout de suite, quand le client est devant son Mac,
# au lieu de la laisser arriver pendant la suite de l'installation (fenêtre « ... souhaite accéder à tes
# Téléchargements » restée sans réponse : le studio ne verrait pas les vidéos AirDrop).
#   /bin/bash <racine>/montage-demo/installation/arrivees.sh
# Un service launchd d'un instant (<label>.arrivees), lancé comme ceux du studio et du garde (/bin/bash puis node),
# lit le dossier ; macOS demande l'accord au client s'il ne l'a pas encore donné ; le service est retiré aussitôt.
# Sortie : ARRIVEES_OK | ARRIVEES_REFUSEES <code> | ARRIVEES_SANS_REPONSE | ARRIVEES_PLUS_TARD <raison> (node absent :
# Mac neuf, la question viendra au premier lancement du studio).
# Variables pour les essais : STUDIO_LABEL (label d'essai), STUDIO_SANS_SERVICE=1 (rien n'est chargé : ARRIVEES_PLUS_TARD).

main() {
  set -u
  local ICI; ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  # shellcheck source=../studio/lancement/client.sh
  . "$ICI/../studio/lancement/client.sh"
  studio_client_charger || { echo "ARRIVEES_PLUS_TARD client : $CLIENT_ERREUR"; return 0; }
  [ -n "${STUDIO_SANS_SERVICE:-}" ] && { echo "ARRIVEES_PLUS_TARD essai sans service"; return 0; }
  local node="" b
  for b in /opt/homebrew/bin/node /usr/local/bin/node "$(command -v node 2>/dev/null)"; do [ -n "$b" ] && [ -x "$b" ] && { node="$b"; break; }; done
  [ -n "$node" ] || { echo "ARRIVEES_PLUS_TARD node pas encore installé"; return 0; }
  local dossier="$HOME/Downloads" conf="$CLIENT_RACINE/studio/studio.config.json" v
  v="$(/usr/bin/plutil -extract arrivees raw -o - "$conf" 2>/dev/null)"
  case "$v" in ""|null) ;; "~/"*) dossier="$HOME/${v#\~/}";; /*) dossier="$v";; esac
  local label="${STUDIO_LABEL:-$CLIENT_LABEL}.arrivees" D dom="gui/$(id -u)"
  D="$(mktemp -d "${TMPDIR:-/tmp}/arrivees.XXXXXX")"
  cat > "$D/a.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$label</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string><string>-c</string>
    <string>"\$0" -e 'try { require("fs").readdirSync(process.argv[1]); console.log("OK"); } catch (e) { console.log(e.code || "ERREUR"); }' "\$1" &gt; "\$2.tmp" 2&gt;&amp;1; mv "\$2.tmp" "\$2"</string>
    <string>$node</string><string>$dossier</string><string>$D/resultat</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>EnvironmentVariables</key><dict><key>HOME</key><string>$HOME</string></dict>
</dict>
</plist>
EOF
  # Deux essais : un service du même nom qui finit de se retirer peut fausser le premier.
  local essai r=""
  for essai in 1 2; do
    rm -f "$D/resultat"
    launchctl bootout "$dom/$label" 2>/dev/null
    local j=0; while launchctl print "$dom/$label" >/dev/null 2>&1 && [ "$j" -lt 20 ]; do sleep 0.25; j=$((j + 1)); done
    if ! launchctl bootstrap "$dom" "$D/a.plist" 2>/dev/null; then r="LAUNCHCTL"; sleep 1; continue; fi
    # Jusqu'à 3 minutes : le temps que le client lise la fenêtre de macOS et clique.
    local i=0; while [ ! -f "$D/resultat" ] && [ "$i" -lt 360 ]; do sleep 0.5; i=$((i + 1)); done
    launchctl bootout "$dom/$label" 2>/dev/null
    r="$(tail -1 "$D/resultat" 2>/dev/null)"
    [ "$r" = OK ] && break
  done
  rm -rf "$D"
  [ "$r" = LAUNCHCTL ] && { echo "ARRIVEES_PLUS_TARD launchctl a refusé le service d'essai"; return 0; }
  case "$r" in
    OK) echo "ARRIVEES_OK";;
    "") echo "ARRIVEES_SANS_REPONSE";;
    *) echo "ARRIVEES_REFUSEES $r ($dossier)";;
  esac
  return 0
}

main "$@"; exit $?
