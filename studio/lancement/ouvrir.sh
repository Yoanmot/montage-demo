#!/bin/bash
# Vérifie que le studio tourne (le démarre sinon, le redémarre s'il attend une mise à jour et qu'il est
# au repos), lit le jeton du démarrage en cours, puis :
#   ouvrir.sh --adresse      écrit « URL <adresse> » (ou « ALERTE <phrase> ») : ce que demande l'appli Mac
#                            du studio (appli/Studio.swift) à son ouverture et à chaque clic sur son icône ;
#   ouvrir.sh --navigateur   ouvre le studio dans une fenêtre d'appli de Chrome (sinon le navigateur par
#                            défaut) : le repli de l'appli Mac quand la page ne s'y affiche pas ;
#   ouvrir.sh                appelé par l'ancienne icône (un script) : pose l'appli Mac à sa place et
#                            l'ouvre ; si elle ne se lance pas sur ce Mac, ouvre le navigateur comme avant.
# Test (Yoan) : STUDIO_SANS_FENETRE=1 écrit l'adresse au lieu d'ouvrir une fenêtre ou une alerte.

# shellcheck source=commun.sh
. "$(dirname "$0")/commun.sh"
# shellcheck source=appli.sh
. "$(dirname "$0")/appli.sh"
MODE="${1:-}"
[ "$MODE" = "--adresse" ] && STUDIO_SANS_FENETRE=1

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

# L'ancienne icône (un petit script qui appelle ce fichier) : l'appli Mac prend sa place, au même
# endroit (le Dock n'est pas touché), puis s'ouvre quand ce script a fini (même identifiant : tant qu'il
# tourne, macOS le prendrait pour elle et ne lancerait rien).
if [ -z "$MODE" ] && [ -z "${STUDIO_SANS_FENETRE:-}" ] && head -c 2 "$STUDIO_APP/Contents/MacOS/Studio" 2>/dev/null | grep -q '#!'; then
  r_app="$(studio_poser_appli)"
  journal "APPLI $r_app"
  case "$r_app" in
    "POSEE native"|"PRESENTE native")
      nohup /bin/bash -c 'i=0; while kill -0 "$1" 2>/dev/null && [ "$i" -lt 100 ]; do sleep 0.1; i=$((i + 1)); done; open "$2"' \
        _ "$$" "$STUDIO_APP" >/dev/null 2>&1 &
      exit 0;;
  esac
fi

r="$(studio_redemarrer_si_demande)"
[ "$r" = "REDEMARRE" ] && journal "REDEMARRE (mise à jour en attente)"
# L'appli ouverte tourne sur une ancienne copie (icône pas à jour) : relancée maintenant si le studio est
# au repos (en fond : c'est peut-être elle qui demande l'adresse).
r="$(studio_relancer_appli_si_demande)"
[ "$r" = "RELANCEE" ] && journal "APPLI RELANCEE (nouvelle version)"

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

if [ -n "${STUDIO_SANS_FENETRE:-}" ]; then
  [ "$MODE" = "--adresse" ] && journal "ADRESSE donnée à l'appli"
  echo "URL $url"; exit 0
fi

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
