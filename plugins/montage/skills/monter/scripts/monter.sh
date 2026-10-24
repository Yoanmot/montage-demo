#!/usr/bin/env bash
# Montage automatique d'une vidéo face caméra : coupe les blancs et les reprises, pose les sous-titres.
# Le montage se fait sur le serveur de Yoan Mottier ; ce script prépare la vidéo, l'envoie et la récupère.
#
#   monter.sh code <code>        enregistre le code de démo
#   monter.sh envoyer <vidéo>    prépare et envoie la vidéo, affiche l'identifiant du montage
#   monter.sh attendre <id>      suit le montage (9 min au plus par appel), puis télécharge la vidéo montée
#
# Codes de sortie : 0 ok · 2 vidéo introuvable · 3 code manquant · 4 code refusé · 5 erreur de montage
#                   6 réseau · 7 outil vidéo impossible à installer · 10 montage pas encore fini (relancer « attendre »)
set -uo pipefail

API="https://195-15-255-230.sslip.io/v1"
HOME_DIR="$HOME/.montage-yoan"
BIN="$HOME_DIR/bin"
CONF="$HOME_DIR/config"
mkdir -p "$BIN"

OS="$(uname -s)"
case "$OS" in MINGW*|MSYS*|CYGWIN*) WIN=1 ;; *) WIN=0 ;; esac

say() { printf '%s\n' "$*"; }

json() { # json <clé> : lit une valeur simple (texte ou nombre) dans le JSON reçu sur l'entrée standard
  local s; s="$(cat)"
  local v; v="$(printf '%s' "$s" | sed -n "s/.*\"$1\": *\"\([^\"]*\)\".*/\1/p" | head -1)"
  [ -n "$v" ] || v="$(printf '%s' "$s" | sed -n "s/.*\"$1\": *\([^,}\"]*\).*/\1/p" | head -1)"
  printf '%s' "$v"
}

code() {
  [ -f "$CONF" ] && sed -n 's/^CODE=//p' "$CONF"
}

need_code() {
  CODE="$(code)"
  if [ -z "$CODE" ]; then
    say "CODE_MANQUANT : demande à l'utilisateur le code de démo envoyé par Yoan, puis lance : monter.sh code <le code>"
    exit 3
  fi
}

# Requête au serveur. Remplit $BODY et $STATUS.
call() {
  local out
  out="$(curl -sS --max-time "${TIMEOUT:-60}" -w '\n%{http_code}' -H "Authorization: Bearer $CODE" "$@" 2>&1)" || {
    say "Connexion au serveur impossible : $out"
    exit 6
  }
  STATUS="${out##*$'\n'}"
  BODY="${out%$'\n'*}"
}

# ffmpeg : celui de la machine s'il existe, sinon une version autonome posée dans ~/.montage-yoan/bin
ffmpeg_path() {
  if command -v ffmpeg >/dev/null 2>&1; then command -v ffmpeg; return; fi
  local exe="$BIN/ffmpeg"; [ "$WIN" = 1 ] && exe="$BIN/ffmpeg.exe"
  if [ ! -x "$exe" ]; then
    say "Première utilisation : installation de l'outil vidéo (une seule fois, environ 1 minute)…" >&2
    local url tmp="$HOME_DIR/ffmpeg-dl.zip"
    if [ "$OS" = Darwin ]; then
      if [ "$(uname -m)" = arm64 ]; then url="https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/snapshot/ffmpeg.zip"
      else url="https://ffmpeg.martin-riedl.de/redirect/latest/macos/amd64/release/ffmpeg.zip"; fi
      curl -sSL --fail "$url" -o "$tmp" && unzip -oq "$tmp" -d "$BIN" && chmod +x "$BIN/ffmpeg"
    elif [ "$WIN" = 1 ]; then
      url="https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
      curl -sSL --fail "$url" -o "$tmp" &&
        powershell.exe -NoProfile -Command "Expand-Archive -Force -Path '$(cygpath -w "$tmp")' -DestinationPath '$(cygpath -w "$HOME_DIR/ffx")'" &&
        cp "$(find "$HOME_DIR/ffx" -name ffmpeg.exe | head -1)" "$exe" && rm -rf "$HOME_DIR/ffx"
    else
      say "Installe ffmpeg avec le gestionnaire de paquets (ex. sudo apt install ffmpeg), puis relance." >&2
      exit 7
    fi
    rm -f "$tmp"
    if [ ! -x "$exe" ]; then say "Installation de l'outil vidéo impossible (téléchargement bloqué ?)." >&2; exit 7; fi
  fi
  printf '%s' "$exe"
}

cmd_code() {
  [ -n "${1:-}" ] || { say "Usage : monter.sh code <code>"; exit 3; }
  CODE="$1"
  call "$API/compte"
  if [ "$STATUS" != 200 ]; then say "CODE_REFUSÉ : $(printf '%s' "$BODY" | json erreur)"; exit 4; fi
  printf 'CODE=%s\n' "$CODE" > "$CONF"
  say "Code enregistré pour $(printf '%s' "$BODY" | json nom). Vidéos restantes : $(printf '%s' "$BODY" | json videos_restantes)."
}

cmd_envoyer() {
  local src="${1:-}"
  [ "$WIN" = 1 ] && [[ "$src" =~ ^[A-Za-z]:\\ ]] && src="$(cygpath -u "$src")"
  [ -f "$src" ] || { say "VIDÉO_INTROUVABLE : $src"; exit 2; }
  need_code
  call "$API/compte"
  if [ "$STATUS" != 200 ]; then say "CODE_REFUSÉ : $(printf '%s' "$BODY" | json erreur)"; exit 4; fi
  local FF; FF="$(ffmpeg_path)" || exit 7

  local tmp="$HOME_DIR/envoi.mp4"
  say "Préparation de la vidéo (format 1080p, plus léger à envoyer)…"
  local scale="scale=w='if(gte(iw,ih),min(1920,iw),-2)':h='if(gte(iw,ih),-2,min(1920,ih))'"
  local ok=1
  if [ "$OS" = Darwin ]; then # encodeur matériel du Mac : 5 fois plus rapide, environ 17 Mo par minute
    "$FF" -nostdin -v error -y -i "$src" -map 0:v:0 -map 0:a:0 -vf "$scale" -c:v h264_videotoolbox -q:v 60 \
      -pix_fmt yuv420p -c:a aac -b:a 192k -ar 48000 -movflags +faststart "$tmp" && ok=0
  fi
  if [ "$ok" != 0 ]; then
    "$FF" -nostdin -v error -y -i "$src" -map 0:v:0 -map 0:a:0 -vf "$scale" -c:v libx264 -preset veryfast -crf 20 \
      -pix_fmt yuv420p -c:a aac -b:a 192k -ar 48000 -movflags +faststart "$tmp" || { say "Préparation de la vidéo impossible (fichier illisible ?)."; exit 2; }
  fi

  local mo=$(( $(wc -c < "$tmp") / 1048576 ))
  say "Envoi au serveur de montage (${mo} Mo)…"
  TIMEOUT=1800 call -X POST -H "Content-Type: video/mp4" -H "X-Filename: $(basename "$src")" -T "$tmp" "$API/jobs"
  rm -f "$tmp"
  if [ "$STATUS" != 202 ]; then say "ENVOI_REFUSÉ : $(printf '%s' "$BODY" | json erreur)"; exit 5; fi
  local id; id="$(printf '%s' "$BODY" | json id)"
  printf '%s\t%s\n' "$id" "$src" >> "$HOME_DIR/montages"
  say "ENVOYÉ id=$id (rush de $(printf '%s' "$BODY" | json duree_rush) s). Lance maintenant : monter.sh attendre $id"
}

cmd_attendre() {
  local id="${1:-}"; need_code
  local src; src="$(awk -F'\t' -v id="$id" '$1==id {print $2}' "$HOME_DIR/montages" 2>/dev/null | tail -1)"
  local start=$SECONDS last=""
  while :; do
    call "$API/jobs/$id"
    [ "$STATUS" = 200 ] || { say "ERREUR : $(printf '%s' "$BODY" | json erreur)"; exit 5; }
    local etat etape; etat="$(printf '%s' "$BODY" | json etat)"; etape="$(printf '%s' "$BODY" | json etape)"
    if [ "$etat" = attente ]; then etape="En file d'attente (position $(printf '%s' "$BODY" | json position))"; fi
    [ "$etape" != "$last" ] && say "… $etape" && last="$etape"
    case "$etat" in
      fini) break ;;
      erreur) say "ERREUR_MONTAGE : $(printf '%s' "$BODY" | json message)"; exit 5 ;;
    esac
    if [ $(( SECONDS - start )) -gt 540 ]; then say "PAS_FINI : relance « monter.sh attendre $id » pour continuer à suivre."; exit 10; fi
    sleep 5
  done

  local dir="." name="video"
  if [ -n "$src" ]; then dir="$(dirname "$src")"; name="$(basename "${src%.*}")"; fi
  local out="$dir/$name-monte.mp4" n=2
  while [ -e "$out" ]; do out="$dir/$name-monte-$n.mp4"; n=$((n + 1)); done
  say "Téléchargement de la vidéo montée…"
  curl -sS --fail --max-time 1800 -H "Authorization: Bearer $CODE" "$API/jobs/$id/video" -o "$out" || { say "Téléchargement impossible, relance « monter.sh attendre $id »."; exit 6; }
  say "PRÊT $out"
  if [ "$OS" = Darwin ]; then open "$out" 2>/dev/null
  elif [ "$WIN" = 1 ]; then cmd.exe /c start "" "$(cygpath -w "$out")" 2>/dev/null; fi
  call "$API/compte"
  [ "$STATUS" = 200 ] && say "Vidéos de démo restantes : $(printf '%s' "$BODY" | json videos_restantes)."
  return 0
}

case "${1:-}" in
  code) cmd_code "${2:-}" ;;
  envoyer) cmd_envoyer "${2:-}" ;;
  attendre) cmd_attendre "${2:-}" ;;
  *) say "Usage : monter.sh code <code> | envoyer <vidéo> | attendre <id>"; exit 1 ;;
esac
