#!/bin/bash
# Reçoit le code de livraison que Yoan a envoyé au client (préparé par installation/preparer-livraison.sh) et
# répartit ses clés, sans qu'aucune passe par la conversation avec Claude :
#   /bin/bash <racine>/montage-demo/installation/livraison.sh            une fenêtre du Mac (champ masqué) :
#                                                                        le client y colle le message de Yoan, OK
#   ... | livraison.sh --stdin                                            le code lu sur l'entrée (essais)
# Le code (installation/livraison.py) porte une somme de contrôle : un collage coupé ou abîmé est reconnu, et la
# fenêtre se rouvre (trois essais) avec un mot pour recopier le message en entier.
# Chaque clé part dans son fichier (droits 600) par cles.sh --stdin, qui la vérifie en lecture :
#   zernio, elevenlabs, code   -> comme cles.sh (publication, sons, serveur de coupe)
#   ssh                        -> la clé d'accès de ce Mac au head of content (<cle_ssh> du client, 600, .pub refaite) ;
#                                 l'ancienne est rangée dans <racine>/anciennes-versions/ ; vérifiée par une lecture du
#                                 dépôt (git ls-remote)
# Rien n'est jamais affiché d'une valeur. Le dossier de passage (700) est effacé à la sortie.
# Sortie (lue par Claude, jamais montrée telle quelle) : les lignes CLE_* de cles.sh et, pour la clé SSH,
#   CLE_OK ssh | DEJA ssh | CLE_REFUSEE ssh <raison> | CLE_NON_VERIFIEE ssh <raison>
# puis LIVRAISON_MANQUE <nom> pour une clé absente du code, et la dernière ligne :
#   LIVRAISON_FIN ok=<n> manque=<noms ou rien> refusees=<noms ou rien>
#   | LIVRAISON_ABANDON <raison>   (code illisible après trois essais, ou fenêtre annulée : rien n'a été posé)
# Variables pour les tests de Yoan seulement : HOC_DEPOT_URL (dépôt du head of content).

D=""
nettoyer() { [ -n "$D" ] && rm -rf "$D"; return 0; }
trap nettoyer EXIT

main() {
  set -u
  local ICI; ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  # shellcheck source=../studio/lancement/client.sh
  . "$ICI/../studio/lancement/client.sh"
  studio_client_charger || { echo "LIVRAISON_ABANDON client : $CLIENT_ERREUR"; return 1; }
  local BASE="$CLIENT_RACINE" PY=/usr/bin/python3 DEPUIS_STDIN=""
  [ "${1:-}" = "--stdin" ] && DEPUIS_STDIN=1
  local HOC_URL="${HOC_DEPOT_URL:-$CLIENT_HOC_DEPOT}" CLE="$CLIENT_CLE_SSH"
  umask 077
  mkdir -p "$BASE"
  D="$(mktemp -d "${TMPDIR:-/tmp}/livraison.XXXXXX")"; chmod 700 "$D"

  # ------------------------------------------------------------------ le code collé, décodé dans le dossier privé
  local essai=0 res="" texte="" msg="Colle ici le message que $CLIENT_CONTACT t'a envoyé sur WhatsApp (le long code qui commence par STUDIO), puis clique sur OK."
  while :; do
    essai=$((essai + 1))
    if [ -n "$DEPUIS_STDIN" ]; then
      cat > "$D/colle"
    else
      osascript - "Installation : le code de $CLIENT_CONTACT" "$msg" > "$D/colle" 2>/dev/null <<'OSA'
on run argv
  try
    set r to display dialog (item 2 of argv) with title (item 1 of argv) default answer "" with hidden answer buttons {"Annuler", "OK"} default button "OK" cancel button "Annuler" giving up after 900
    if gave up of r then return ""
    return text returned of r
  on error
    return ""
  end try
end run
OSA
      if [ ! -s "$D/colle" ] || [ -z "$(tr -d '[:space:]' < "$D/colle")" ]; then
        echo "LIVRAISON_ABANDON fenêtre annulée ou fermée, rien n'a été posé"; return 0
      fi
    fi
    res="$("$PY" -I "$ICI/livraison.py" decoder "$CLIENT_ID" "$D/cles" < "$D/colle")"
    rm -f "$D/colle"
    case "$res" in *LIVRAISON_OK*) break;; esac
    case "$res" in
      *LIVRAISON_AUTRE_CLIENT*) echo "LIVRAISON_ABANDON ce code est celui d'une autre installation (${res##* }), rien n'a été posé"; return 0;;
      *LIVRAISON_VERSION*) echo "LIVRAISON_ABANDON code d'une version que cette installation ne lit pas (${res##* }), rien n'a été posé"; return 0;;
    esac
    if [ -n "$DEPUIS_STDIN" ] || [ "$essai" -ge 3 ]; then
      echo "LIVRAISON_ABANDON code illisible ($(echo "$res" | head -1 | cut -d' ' -f2-)), rien n'a été posé"; return 0
    fi
    msg="Le code n'est pas arrivé en entier. Dans WhatsApp, copie le message de $CLIENT_CONTACT en entier (clic droit sur le message, Copier), puis colle-le ici et clique sur OK."
  done
  echo "$res" | grep '^LIVRAISON_MANQUE'
  local manque; manque="$(echo "$res" | sed -n 's/^LIVRAISON_MANQUE //p' | tr '\n' ',' | sed 's/,$//')"

  # ------------------------------------------------------------------ zernio, sons, code du montage : par cles.sh
  local nb_ok=0 refusees="" n l
  for n in zernio elevenlabs code; do
    [ -f "$D/cles/$n" ] || continue
    l="$(/bin/bash "$ICI/cles.sh" --stdin "$n" < "$D/cles/$n" 2>&1 | grep -E '^(CLE_|NOM_)' | tail -1)"
    rm -f "$D/cles/$n"
    echo "$l"
    case "$l" in CLE_OK*|CLE_NON_VERIFIEE*|CLE_INTERDITE*) nb_ok=$((nb_ok + 1));; *) refusees="${refusees:+$refusees,}$n";; esac
  done

  # ------------------------------------------------------------------ la clé d'accès au head of content
  if [ -f "$D/cles/ssh" ]; then
    if ! ssh-keygen -y -f "$D/cles/ssh" > "$D/ssh.pub" 2>/dev/null; then
      echo "CLE_REFUSEE ssh clé illisible"; refusees="${refusees:+$refusees,}ssh"
    elif [ -z "$CLE" ]; then
      echo "CLE_NON_VERIFIEE ssh ce client n'a pas de head of content"; nb_ok=$((nb_ok + 1))
    else
      local pose=""
      if [ -f "$CLE" ] && cmp -s "$D/cles/ssh" "$CLE"; then
        echo "DEJA ssh"; pose=1
      else
        mkdir -p "$(dirname "$CLE")"; chmod 700 "$(dirname "$CLE")"
        if [ -f "$CLE" ] || [ -f "$CLE.pub" ]; then
          local garde; garde="$BASE/anciennes-versions/$(date +%Y%m%d-%H%M%S)/ssh"
          mkdir -p "$garde"; chmod 700 "$garde"
          [ -f "$CLE" ] && mv "$CLE" "$garde/"
          [ -f "$CLE.pub" ] && mv "$CLE.pub" "$garde/"
        fi
        cp "$D/cles/ssh" "$CLE.tmp" && chmod 600 "$CLE.tmp" && mv -f "$CLE.tmp" "$CLE" \
          && { awk '{print $1, $2}' "$D/ssh.pub" | sed "s/\$/ mac-$CLIENT_ID-head-of-content/" > "$CLE.pub"; chmod 644 "$CLE.pub"; pose=1; }
        [ -n "$pose" ] || echo "CLE_REFUSEE ssh écriture impossible"
      fi
      if [ -n "$pose" ]; then
        local r ssh_cmd="ssh -i \"$CLE\" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o BatchMode=yes -o ConnectTimeout=10"
        r="$(GIT_SSH_COMMAND="$ssh_cmd" GIT_TERMINAL_PROMPT=0 git ls-remote "$HOC_URL" main 2>&1)"
        if echo "$r" | grep -q 'refs/heads/main'; then echo "CLE_OK ssh"; nb_ok=$((nb_ok + 1))
        elif echo "$r" | grep -qiE "denied|permission|not found|does not exist|access rights"; then
          echo "CLE_REFUSEE ssh le dépôt refuse cette clé (à ajouter par $CLIENT_CONTACT comme clé de déploiement)"; refusees="${refusees:+$refusees,}ssh"
        else
          echo "CLE_NON_VERIFIEE ssh $(echo "$r" | tail -1 | cut -c1-100)"; nb_ok=$((nb_ok + 1))
        fi
      fi
    fi
    rm -f "$D/cles/ssh" "$D/ssh.pub"
  fi

  # La date de réception, jamais une valeur (pour savoir quel code a servi).
  date '+{"recu_le": "%Y-%m-%dT%H:%M:%S"}' > "$BASE/livraison.json"; chmod 644 "$BASE/livraison.json"
  echo "LIVRAISON_FIN ok=$nb_ok manque=${manque:-rien} refusees=${refusees:-rien}"
  return 0
}

main "$@"; exit $?
