#!/bin/bash
# Fabrique icone.icns à partir de icone.svg (pour Yoan, quand le dessin change ; le .icns est gardé
# dans le dépôt, rien n'est fabriqué chez Romain).
# Chrome sans fenêtre rend le SVG en PNG 1024 transparent, sips fait les tailles, iconutil le .icns.
#   /bin/bash studio/lancement/fabriquer-icone.sh
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || { echo "ECHEC Chrome absent"; exit 1; }

T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
cat > "$T/page.html" <<EOF
<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:transparent;overflow:hidden}
img{display:block;width:1024px;height:1024px}
</style></head><body><img src="file://$ICI/icone.svg"></body></html>
EOF
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --default-background-color=00000000 \
  --allow-file-access-from-files --user-data-dir="$T/profil" --window-size=1024,1024 \
  --screenshot="$T/icone-1024.png" "file://$T/page.html" >/dev/null 2>&1
[ -s "$T/icone-1024.png" ] || { echo "ECHEC rendu du SVG"; exit 1; }

S="$T/icone.iconset"
mkdir -p "$S"
for t in 16 32 128 256 512; do
  sips -z "$t" "$t" "$T/icone-1024.png" --out "$S/icon_${t}x${t}.png" >/dev/null
  d=$((t * 2))
  sips -z "$d" "$d" "$T/icone-1024.png" --out "$S/icon_${t}x${t}@2x.png" >/dev/null
done
iconutil -c icns "$S" -o "$ICI/icone.icns"
echo "OK icone.icns ($(stat -f %z "$ICI/icone.icns") octets)"
if [ -n "${APERCU:-}" ]; then cp "$T/icone-1024.png" "$APERCU"; echo "APERCU $APERCU"; fi
