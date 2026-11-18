#!/bin/bash
# Construit l'appli du studio (Studio.swift) en binaire universel (arm64 + x86_64), signé ad hoc.
# Se lance ici, sur le Mac de Yoan (il faut les outils de développement d'Apple) ; le binaire est gardé
# dans le dépôt : l'installation chez un client ne compile rien.
#   /bin/bash studio/lancement/appli/construire.sh
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
for a in arm64 x86_64; do
  xcrun swiftc -O -swift-version 5 -target "$a-apple-macos11.0" -framework Cocoa -framework WebKit \
    "$ICI/Studio.swift" -o "$T/Studio-$a"
done
lipo -create "$T/Studio-arm64" "$T/Studio-x86_64" -output "$T/Studio"
strip -x "$T/Studio" 2>/dev/null || true
codesign --force --sign - --identifier studio.appli "$T/Studio"
"$T/Studio" --verifier
mv "$T/Studio" "$ICI/Studio"
lipo -archs "$ICI/Studio"
ls -l "$ICI/Studio" | awk '{ print $5 " octets" }'
