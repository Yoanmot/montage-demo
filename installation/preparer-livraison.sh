#!/bin/bash
# Chez Yoan, dans son Terminal, avant d'envoyer le prompt d'installation : prépare le code de livraison d'un client
# (un seul texte qui porte toutes ses clés, à lui envoyer par WhatsApp en message éphémère).
#   /bin/bash installation/preparer-livraison.sh [client]          (défaut : romain)
# Ce que fait le script, dans l'ordre :
#   1. demande chaque clé dans un champ masqué (rien ne s'affiche) : publication Zernio du profil du client (clé
#      « Mac »), clé des sons ElevenLabs, code du montage. Entrée vide = clé laissée de côté (l'installation le dira).
#      Une clé peut aussi être lue d'un fichier sans être affichée : LIVRAISON_FICHIER_ZERNIO=<fichier .env>
#      (ligne ZERNIO_API_KEY=), LIVRAISON_FICHIER_ELEVENLABS (ELEVENLABS_API_KEY=), LIVRAISON_FICHIER_CODE (CODE=) ;
#   2. crée une paire de clés SSH neuve, propre au Mac du client ;
#   3. l'ajoute au dépôt de son head of content comme clé de déploiement AVEC écriture (gh), et vérifie sur
#      GitHub qu'elle est bien en écriture ;
#   4. fabrique le code (installation/livraison.py : format versionné, somme de contrôle), le relit pour vérifier
#      qu'il se décode, et le copie dans le presse-papiers (jamais affiché). Il ne reste rien sur ce Mac : la clé
#      privée n'existe plus que dans le code.
# À coller dans WhatsApp (message éphémère), puis vider le presse-papiers (le script le propose).
# Variables pour les essais seulement :
#   LIVRAISON_SANS_GITHUB=1      n'appelle pas gh (écrit la commande qui aurait été lancée) ;
#   LIVRAISON_SORTIE=<fichier>   écrit le code dans ce fichier (600) au lieu du presse-papiers ;
#   LIVRAISON_CLES=<dossier>     lit les clés dans <dossier>/zernio, elevenlabs, code (valeurs factices), sans rien demander.

main() {
  set -u
  local ICI; ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local CLIENT="${1:-romain}"
  local FICHIER="$ICI/../studio/clients/$CLIENT.json" PY=/usr/bin/python3
  [ -f "$FICHIER" ] || { echo "Client inconnu : $CLIENT ($FICHIER absent)"; return 1; }
  local DEPOT_HOC PRENOM
  DEPOT_HOC="$("$PY" -c 'import json,sys; d=json.load(open(sys.argv[1])); print((d.get("head_of_content") or {}).get("depot") or "")' "$FICHIER")"
  PRENOM="$("$PY" -c 'import json,sys; print(json.load(open(sys.argv[1])).get("prenom") or "")' "$FICHIER")"
  local REPO; REPO="$(printf '%s' "$DEPOT_HOC" | sed -E 's#^git@github.com:##; s#^https://github.com/##; s#\.git$##')"
  umask 077
  local D; D="$(mktemp -d "${TMPDIR:-/tmp}/preparer-livraison.XXXXXX")"; chmod 700 "$D"
  trap 'rm -rf "'"$D"'"' EXIT
  mkdir -p "$D/cles"

  echo "Code de livraison pour $PRENOM ($CLIENT)."
  # ------------------------------------------------------------------ 1. les clés
  lire() { # $1 nom, $2 libellé, $3 variable du fichier .env, $4 chemin éventuel
    local v=""
    if [ -n "${LIVRAISON_CLES:-}" ]; then
      [ -f "$LIVRAISON_CLES/$1" ] && v="$(tr -d '[:space:]' < "$LIVRAISON_CLES/$1")"
    elif [ -n "${4:-}" ]; then
      v="$(sed -n "s/^$3=//p" "$4" 2>/dev/null | tail -1 | tr -d "\"'[:space:]")"
      [ -n "$v" ] || echo "  $2 : rien trouvé dans $4"
    else
      IFS= read -r -s -p "  $2 (colle, puis Entrée ; rien = laisser de côté) : " v </dev/tty; echo
      v="$(printf '%s' "$v" | tr -d '[:space:]')"
    fi
    if [ -n "$v" ]; then printf '%s\n' "$v" > "$D/cles/$1"; echo "  $2 : reçue (${#v} caractères)"
    else echo "  $2 : LAISSÉE DE CÔTÉ ($PRENOM verra qu'elle manque)"; fi
    v=""
  }
  lire zernio "Clé Zernio de publication (profil de $PRENOM)" ZERNIO_API_KEY "${LIVRAISON_FICHIER_ZERNIO:-}"
  lire elevenlabs "Clé des sons (ElevenLabs)" ELEVENLABS_API_KEY "${LIVRAISON_FICHIER_ELEVENLABS:-}"
  lire code "Code du montage (serveur de coupe)" CODE "${LIVRAISON_FICHIER_CODE:-}"

  # ------------------------------------------------------------------ 2 et 3. la clé SSH du Mac du client
  if [ -n "$REPO" ]; then
    local jour titre; jour="$(date +%Y-%m-%d-%H%M)"; titre="Mac de $PRENOM (livraison $jour)"
    ssh-keygen -q -t ed25519 -N "" -C "mac-$CLIENT-head-of-content-$jour" -f "$D/cle" >/dev/null 2>&1 \
      || { echo "ÉCHEC : ssh-keygen n'a pas pu créer la clé"; return 1; }
    if [ -n "${LIVRAISON_SANS_GITHUB:-}" ]; then
      echo "  (essai) gh repo deploy-key add <clé publique> --repo $REPO --title \"$titre\" --allow-write"
    else
      command -v gh >/dev/null || { echo "ÉCHEC : gh absent (brew install gh, puis gh auth login)"; return 1; }
      if ! gh repo deploy-key add "$D/cle.pub" --repo "$REPO" --title "$titre" --allow-write >/dev/null 2>"$D/gh.err"; then
        echo "ÉCHEC : GitHub a refusé la clé ($(head -1 "$D/gh.err"))"; return 1
      fi
      local ro
      ro="$(gh api "repos/$REPO/keys" --jq ".[] | select(.title == \"$titre\") | .read_only" 2>/dev/null)"
      if [ "$ro" != "false" ]; then echo "ÉCHEC : la clé « $titre » n'est pas en écriture sur GitHub (read_only=$ro)"; return 1; fi
      echo "  Clé d'accès du Mac de $PRENOM ajoutée à $REPO, en écriture (« $titre »)."
      local anciennes
      anciennes="$(gh api "repos/$REPO/keys" --jq ".[] | select(.title != \"$titre\") | .title" 2>/dev/null | tr '\n' ';' | sed 's/;$//; s/;/ ; /g')"
      [ -n "$anciennes" ] && echo "  Autres clés de ce dépôt (à retirer quand l'installation est finie, sur GitHub > Settings > Deploy keys) : $anciennes"
    fi
    cp "$D/cle" "$D/cles/ssh"
  fi

  # ------------------------------------------------------------------ 4. le code, relu avant d'être donné
  "$PY" -I "$ICI/livraison.py" encoder "$CLIENT" "$D/cles" > "$D/code" || { echo "ÉCHEC : aucun contenu à livrer"; return 1; }
  local relu; relu="$("$PY" -I "$ICI/livraison.py" decoder "$CLIENT" "$D/relu" < "$D/code")"
  case "$relu" in *LIVRAISON_OK*) ;; *) echo "ÉCHEC : le code ne se relit pas ($relu)"; return 1;; esac
  if [ -n "$REPO" ] && ! cmp -s "$D/cle" "$D/relu/ssh"; then echo "ÉCHEC : la clé SSH relue diffère"; return 1; fi
  local nb; nb="$(wc -c < "$D/code" | tr -d ' ')"
  if [ -n "${LIVRAISON_SORTIE:-}" ]; then
    cp "$D/code" "$LIVRAISON_SORTIE"; chmod 600 "$LIVRAISON_SORTIE"
    echo "Code écrit dans $LIVRAISON_SORTIE ($nb caractères, contient : ${relu#LIVRAISON_OK })."
  else
    tr -d '\n' < "$D/code" | pbcopy
    echo ""
    echo "Code copié dans le presse-papiers ($nb caractères ; contient : ${relu#LIVRAISON_OK })."
    echo "Colle-le dans WhatsApp, en message éphémère, pour $PRENOM. Il ne doit le coller nulle part ailleurs que dans"
    echo "la fenêtre que l'installation lui ouvrira."
    IFS= read -r -p "Appuie sur Entrée une fois le message envoyé (le presse-papiers sera vidé) : " _ </dev/tty
    printf '' | pbcopy
    echo "Presse-papiers vidé."
  fi
  return 0
}

main "$@"; exit $?
