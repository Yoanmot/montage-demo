#!/bin/bash
# Ce que fait l'icône Studio du Dock : vérifier que le studio tourne (le démarrer sinon, le
# redémarrer s'il attend une mise à jour et qu'il est au repos), lire le jeton du démarrage en cours,
# ouvrir le studio dans une fenêtre d'appli de Chrome (sinon le navigateur par défaut).
# Appelé par ~/Applications/<nom de l'appli du client>.app/Contents/MacOS/Studio.
# Test (Yoan) : STUDIO_SANS_FENETRE=1 écrit l'adresse au lieu d'ouvrir une fenêtre ou une alerte.

# shellcheck source=commun.sh
. "$(dirname "$0")/commun.sh"

alerte() {
  if [ -n "${STUDIO_SANS_FENETRE:-}" ]; then echo "ALERTE $1"; return; fi
  osascript - "$1" "$STUDIO_APP_NOM" <<'OSA' >/dev/null 2>&1
on run argv
  display dialog (item 1 of argv) with title (item 2 of argv) buttons {"OK"} default button "OK" with icon caution
end run
OSA
}

journal() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$STUDIO_HOME/ouvrir.log" 2>/dev/null; }

mkdir -p "$STUDIO_HOME"
r="$(studio_redemarrer_si_demande)"
[ "$r" = "REDEMARRE" ] && journal "REDEMARRE (mise à jour en attente)"

if [ "$(studio_repond)" != "200" ]; then
  journal "DEMARRAGE demandé (le studio ne répondait pas)"
  if ! studio_demarrer; then
    journal "ECHEC service absent ($STUDIO_PLIST)"
    alerte "Le studio n'est pas installé sur ce Mac.${CLIENT_PREVENIR:+ $CLIENT_PREVENIR}"
    exit 1
  fi
  if ! studio_attendre 25; then
    journal "ECHEC pas de réponse après 25 s (voir lancement.log)"
    alerte "Le studio n'arrive pas à démarrer. Redémarre ton Mac$([ -n "$CLIENT_CONTACT" ] && echo ", et si ça ne marche toujours pas, envoie un message à $CLIENT_CONTACT" || echo " puis rouvre le studio")."
    exit 1
  fi
fi

jeton="$(cat "$STUDIO_HOME/jeton" 2>/dev/null | tr -d '[:space:]')"
if [ -z "$jeton" ]; then
  journal "ECHEC jeton absent"
  alerte "Le studio n'arrive pas à démarrer.${CLIENT_PREVENIR:+ $CLIENT_PREVENIR}"
  exit 1
fi
url="http://127.0.0.1:$(studio_port)/?t=$jeton"

if [ -n "${STUDIO_SANS_FENETRE:-}" ]; then echo "URL $url"; exit 0; fi

chrome=""
for a in "/Applications/Google Chrome.app" "$HOME/Applications/Google Chrome.app"; do
  [ -d "$a" ] && { chrome="$a"; break; }
done
if [ -n "$chrome" ]; then
  # Profil à part : la fenêtre du studio ne se mélange pas aux onglets du client, et garde ses réglages
  # (micro pour la dictée, taille de la fenêtre).
  open -na "$chrome" --args --app="$url" --user-data-dir="$STUDIO_HOME/fenetre" \
    --no-first-run --no-default-browser-check --window-size=1440,920
else
  open "$url"
fi
journal "OUVERT ($( [ -n "$chrome" ] && echo "fenêtre d'appli" || echo "navigateur par défaut"))"
exit 0
