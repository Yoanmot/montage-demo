#!/bin/bash
# Faux « claude » pour les essais de connexion-claude.sh (jamais installé chez un client).
# setup-token : rejoue la vraie sortie de claude 2.1.328 jusqu'à l'attente de l'acceptation (setup-token-debut.log,
# enregistrée sur le Mac de Yoan dans un pseudo-terminal, valeurs à usage unique retirées), demande l'ouverture du
# navigateur ($BROWSER), puis, si « Accepter » est simulé, affiche le bloc de succès de claude (mêmes textes, mêmes
# codes de couleur) avec le jeton, et attend comme le vrai jusqu'à être arrêté.
# Réglages lus à côté de ce fichier (l'environnement est vidé par connexion-claude.sh) :
#   <ce fichier>.jeton     le jeton à afficher (sinon un faux), ou <ce fichier>.source : un fichier .env qui le porte
#   <ce fichier>.accepter  secondes avant « Accepter » (absent : personne n'accepte)
#   <ce fichier>.sortie    « erreur » : claude répond « Token exchange failed » au lieu du jeton
# -p : répond PRET si le jeton de l'environnement est celui attendu, sinon le message de claude non connecté.
ICI="$(cd "$(dirname "$0")" && pwd)"; MOI="$0"
jeton() {
  if [ -f "$MOI.jeton" ]; then cat "$MOI.jeton"
  elif [ -f "$MOI.source" ]; then sed -n 's/^CLAUDE_CODE_OAUTH_TOKEN=//p' "$(cat "$MOI.source")" | tail -1
  else echo "sk-ant-oat01-FAUXjetonDEssai0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJ_-0123456789abcdefghijklmnopqrstuv-AAAA"; fi
}
case "${1:-}" in
  --version) echo "2.1.328 (Claude Code)";;
  setup-token)
    cat "$ICI/setup-token-debut.log"
    [ -n "${BROWSER:-}" ] && "$BROWSER" "https://claude.com/cai/oauth/authorize?code=true&client_id=essai&response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A65010%2Fcallback&scope=user%3Ainference"
    if [ -f "$MOI.accepter" ]; then
      sleep "$(cat "$MOI.accepter")"
      if [ "$(cat "$MOI.sortie" 2>/dev/null)" = "erreur" ]; then
        printf '\r\n\033[31m✘\033[39m Token exchange failed\r\n'
      else
        printf '\033[2K\033[1A\033[2K\033[G\r\n\033[32m✔\033[39m\033[3GLong-lived\033[14Gauthentication\033[29Gtoken\033[35Gcreated\r\n\r\n'
        printf 'Your\033[6GOAuth\033[12Gtoken\033[18G(valid\033[25Gfor\033[29G1\033[31Gyear):\r\n\r\n'
        printf '\033[33m%s\033[39m\r\n\r\n' "$(jeton)"
        printf '\033[2mStore\033[7Gthis\033[12Gtoken\033[18Gsecurely.\033[28GYou\033[32Gwon'"'"'t\033[38Gbe\033[41Gable\033[46Gto\033[49Gsee\033[53Git\033[56Gagain.\033[22m\r\n\r\n'
        printf '\033[2mUse this token by setting: export CLAUDE_CODE_OAUTH_TOKEN=<token>\033[22m\r\n\r\n'
        printf '\033[2mYou can revoke it later at https://claude.ai/settings/claude-code\033[22m\r\n'
      fi
    fi
    sleep 3600;;
  -p|--print)
    if [ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && [ "$CLAUDE_CODE_OAUTH_TOKEN" = "$(jeton)" ]; then echo "PRET"
    else echo "Invalid API key · Please run /login"; fi;;
  *) echo "faux claude : $*";;
esac
