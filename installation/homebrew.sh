#!/bin/bash
# Homebrew sur le Mac d'un client qui ne l'a pas encore, sans Terminal : le seul moment de l'installation où le mot
# de passe du Mac est demandé, dans une fenêtre du Mac (champ masqué), au tout début (prompt d'installation).
#   /bin/bash <racine>/montage-demo/installation/homebrew.sh
# L'installeur officiel de Homebrew tourne sans question (NONINTERACTIVE=1) ; quand il a besoin des droits
# d'administrateur, sudo appelle la fenêtre (SUDO_ASKPASS) : le mot de passe ne passe que de la fenêtre à sudo,
# jamais par un fichier, la conversation ou la liste des processus. L'installation continue en fond si elle dure plus
# de 8 minutes ; installer.sh l'attend (<racine>/homebrew/pid).
# Sortie : HOMEBREW_DEJA | HOMEBREW_OK | HOMEBREW_EN_COURS (continue en fond) | HOMEBREW_ECHEC <raison>
# Variables pour les essais de Yoan seulement : HOMEBREW_INSTALLEUR (script lancé à la place de l'installeur officiel).

main() {
  set -u
  local ICI; ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  # shellcheck source=../studio/lancement/client.sh
  . "$ICI/../studio/lancement/client.sh"
  studio_client_charger || { echo "HOMEBREW_ECHEC client : $CLIENT_ERREUR"; return 1; }
  local BASE="$CLIENT_RACINE" H b
  H="$BASE/homebrew"
  for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do [ -x "$b" ] && { echo "HOMEBREW_DEJA"; return 0; }; done
  mkdir -p "$H"; chmod 700 "$H"
  if [ -f "$H/pid" ] && kill -0 "$(cat "$H/pid")" 2>/dev/null; then echo "HOMEBREW_EN_COURS (déjà lancé)"; return 0; fi

  # La fenêtre du mot de passe (appelée par sudo -A, peut-être plusieurs fois : sudo garde l'accord quelques minutes).
  cat > "$H/mot-de-passe.sh" <<'ASK'
#!/bin/bash
osascript <<'OSA' 2>/dev/null
try
  set r to display dialog "Ton Mac a besoin de ton mot de passe (celui qui ouvre ta session) pour installer un outil de base, une seule fois. Il ne sort pas de ton Mac." with title "Installation : mot de passe du Mac" default answer "" with hidden answer buttons {"Annuler", "OK"} default button "OK" cancel button "Annuler" giving up after 600
  if gave up of r then error number -128
  return text returned of r
on error
  error number -128
end try
OSA
ASK
  chmod 700 "$H/mot-de-passe.sh"

  local inst="${HOMEBREW_INSTALLEUR:-}"
  if [ -z "$inst" ]; then
    inst="$H/install.sh"
    curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh -o "$inst" \
      || { echo "HOMEBREW_ECHEC téléchargement de l'installeur impossible (connexion ?)"; return 0; }
  fi
  : > "$H/journal.log"
  ( NONINTERACTIVE=1 SUDO_ASKPASS="$H/mot-de-passe.sh" nohup /bin/bash "$inst" </dev/null >> "$H/journal.log" 2>&1
    echo "$?" > "$H/code" ) &
  echo $! > "$H/pid"
  disown 2>/dev/null
  local p i=0; p="$(cat "$H/pid")"
  while kill -0 "$p" 2>/dev/null && [ "$i" -lt 240 ]; do sleep 2; i=$((i + 1)); done
  if kill -0 "$p" 2>/dev/null; then echo "HOMEBREW_EN_COURS (la suite de l'installation l'attendra)"; return 0; fi
  rm -f "$H/pid"
  for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do
    if [ -x "$b" ]; then
      grep -qs "brew shellenv" "$HOME/.zprofile" || printf '\neval "$(%s shellenv)"\n' "$b" >> "$HOME/.zprofile"
      echo "HOMEBREW_OK"; return 0
    fi
  done
  if grep -qiE "incorrect password|Need sudo access|sudo: no password|a password is required|cancel" "$H/journal.log"; then
    echo "HOMEBREW_ECHEC mot de passe refusé ou fenêtre fermée"
  else
    echo "HOMEBREW_ECHEC $(grep -v '^\s*$' "$H/journal.log" | tail -1 | cut -c1-120)"
  fi
  return 0
}

main "$@"; exit $?
