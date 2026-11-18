#!/bin/bash
# Le studio du client sur son Mac : installation, vérification, réglages. Le client (racine, label,
# appli, port, dépôt du head of content, clé SSH, config Claude) vient de studio/lancement/client.sh.
# Appelé par installer.sh et verifier.sh ; aussi lançable seul (<racine> = ~/.montage-yoan chez Romain) :
#   /bin/bash <racine>/montage-demo/installation/studio.sh installer
#   /bin/bash <racine>/montage-demo/installation/studio.sh verifier
#   /bin/bash <racine>/montage-demo/installation/studio.sh disques                  disques branchés
#   /bin/bash <racine>/montage-demo/installation/studio.sh reglage disque_externe "<nom du disque>"
#   /bin/bash <racine>/montage-demo/installation/studio.sh reglage appareil "<appareil>"
#   /bin/bash <racine>/montage-demo/installation/studio.sh redemarrer-si-libre      (mise à jour)
# Relançable : ce qui est en place n'est pas touché ; la copie de travail du head of content n'est
# jamais alignée de force (elle peut contenir du travail pas encore envoyé).
#
# Sortie de installer : lignes OK / INSTALLE / A_FAIRE <CODE> / ECHEC, comme installer.sh.
# Sortie de verifier : lignes VERIF_OK / VERIF_ECHEC / VERIF_A_FAIRE, comme verifier.sh.
#
# Variables pour les tests de Yoan seulement :
#   STUDIO_LABEL      nom du service launchd (défaut : celui du client)
#   STUDIO_SERVICES_DOSSIER, STUDIO_APPLIS_DOSSIER  dossiers du réglage du service et de l'appli
#                     (défaut ~/Library/LaunchAgents et ~/Applications ; voir commun.sh)
#   STUDIO_SANS_DOCK  1 = ne touche ni au Dock ni au registre des applis (ils sont ceux de
#                     l'utilisateur réel, même avec HOME redirigé)
#   STUDIO_SANS_CLAUDE 1 = verifier ne lance pas de session Claude d'essai
#   STUDIO_SANS_SERVICE 1 = le réglage du service est écrit et vérifié mais rien n'est chargé dans
#                     launchd (il est celui de l'utilisateur réel, même avec HOME redirigé) : le
#                     serveur est lancé par le script de test (environnement « test réel », lot 11)
#   HOC_DEPOT_URL     dépôt du head of content (défaut : celui du client, GitHub en SSH)
# Aucune clé dans ce fichier.

ICI="$(cd "$(dirname "$0")" && pwd)"
CLONE="$(cd "$ICI/.." && pwd)"
CODE="$CLONE/studio"
LANCEMENT="$CODE/lancement"
# shellcheck source=../studio/lancement/commun.sh
. "$LANCEMENT/commun.sh"
# shellcheck source=../studio/lancement/appli.sh
. "$LANCEMENT/appli.sh"

BASE="$STUDIO_RACINE"
HOC_URL="${HOC_DEPOT_URL:-$CLIENT_HOC_DEPOT}"
CLE_HOC="$CLIENT_CLE_SSH"
SSH_HOC="ssh -i \"$CLE_HOC\" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o BatchMode=yes -o ConnectTimeout=10"
PY=/usr/bin/python3
CHEMIN_OUTILS="$BASE/bin:$HOME/.local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:$HOME/.claude/local:/usr/bin:/bin:/usr/sbin:/sbin"
export GIT_TERMINAL_PROMPT=0
# Client isolé : les sessions d'essai de claude lisent sa config à lui, jamais ~/.claude.
studio_client_env_claude
# Ce qui part tel quel dans les textes pour Claude et dans les commits (Romain : inchangé).
QUI="$CLIENT_PRENOM"
COMMENT_CLE="mac-$CLIENT_ID-head-of-content"
[ "$CLIENT_ID" = "romain" ] && COMMENT_CLE="mac-romain-head-of-content"

# ------------------------------------------------------------------ outils

trouver_claude() {
  local c
  for c in "$HOME/.local/bin/claude" /opt/homebrew/bin/claude /usr/local/bin/claude "$HOME/.claude/local/claude"; do
    [ -x "$c" ] && { echo "$c"; return 0; }
  done
  c="$(command -v claude 2>/dev/null || true)"
  [ -n "$c" ] && { echo "$c"; return 0; }
  return 1
}

# Lance une commande avec une limite de temps (macOS n'a pas « timeout ») ; attend par PID.
avec_limite() { # $1 secondes, puis la commande
  local s="$1"; shift
  "$@" &
  local pid=$! i=0
  while kill -0 "$pid" 2>/dev/null; do
    if [ "$i" -ge $((s * 2)) ]; then kill "$pid" 2>/dev/null; sleep 1; kill -9 "$pid" 2>/dev/null; wait "$pid" 2>/dev/null; return 124; fi
    sleep 0.5; i=$((i + 1))
  done
  wait "$pid"
}

# Adresse file:// d'un dossier, espaces et parenthèses encodés (nom d'appli « Studio Romain (test) ») ;
# identique au chemin pour un nom sans caractère spécial (Studio : rien ne change).
studio_url_fichier() { "$PY" -c 'import sys, urllib.parse; print("file://" + urllib.parse.quote(sys.argv[1], safe="/()"))' "$1"; }

ecrire_si_change() { # $1 fichier, contenu sur stdin ; rend 0 si changé
  local tmp="$1.tmp.$$"
  cat > "$tmp"
  if [ -f "$1" ] && cmp -s "$tmp" "$1"; then rm -f "$tmp"; return 1; fi
  mv "$tmp" "$1"; return 0
}

# Variables propres au service d'un client autre que Romain (le réglage de Romain ne change pas d'un
# octet) : le client, sa racine, sa config Claude et le dossier de ses sons.
plist_env_client() {
  [ "$CLIENT_ID" = "romain" ] && return 0
  local k v
  for k in STUDIO_CLIENT STUDIO_RACINE CLAUDE_CONFIG_DIR MONTEUR_CONFIG; do
    case "$k" in
      STUDIO_CLIENT) v="$CLIENT_ID";; STUDIO_RACINE) v="$BASE";;
      CLAUDE_CONFIG_DIR) v="$CLIENT_CONFIG_CLAUDE";; MONTEUR_CONFIG) [ -n "$CLIENT_ISOLE" ] && v="$CLIENT_SONS" || v="";;
    esac
    [ -n "$v" ] || continue
    printf '\n    <key>%s</key>\n    <string>%s</string>' "$k" "$(printf '%s' "$v" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g')"
  done
  # Installation d'essai : simulation de publication imposée au service (demarrer.sh la pose aussi).
  [ -n "${CLIENT_SIMULATION_FORCEE:-}" ] && printf '\n    <key>STUDIO_SIMULATION</key>\n    <string>1</string>'
  return 0
}

# ------------------------------------------------------------------ installer

cmd_installer() {
  set -u
  local nb_ok=0 nb_faire=0 nb_echec=0
  ok()      { echo "OK $*"; nb_ok=$((nb_ok + 1)); }
  installe(){ echo "INSTALLE $*"; nb_ok=$((nb_ok + 1)); }
  a_faire() { echo "A_FAIRE $*"; nb_faire=$((nb_faire + 1)); }
  echec()   { echo "ECHEC $*"; nb_echec=$((nb_echec + 1)); }
  local stamp; stamp="$(date +%Y%m%d-%H%M%S)"

  if [ -n "$CLIENT_ERREUR" ]; then echec "client : $CLIENT_ERREUR"; return 1; fi
  if [ ! -f "$LANCEMENT/demarrer.sh" ] || [ ! -f "$LANCEMENT/ouvrir.sh" ]; then
    echec "studio : le code du lancement manque dans la copie du dépôt ($LANCEMENT)"; return 1
  fi

  # Dossier d'état et configuration
  mkdir -p "$STUDIO_HOME"; chmod 700 "$STUDIO_HOME"
  if [ -n "$CLIENT_ISOLE" ]; then chmod 700 "$BASE" 2>/dev/null || true; fi
  if [ -f "$STUDIO_CONF" ]; then
    if "$PY" -c 'import json,sys; json.load(open(sys.argv[1], encoding="utf-8"))' "$STUDIO_CONF" 2>/dev/null; then ok "studio-config présente"
    else echec "studio-config : fichier illisible ($STUDIO_CONF), laissé tel quel"; fi
  elif [ "$CLIENT_ID" != "romain" ]; then
    # Autre client : la config neuve est celle du serveur (exemple + valeurs du client : prénom, port,
    # dépôts et dossier média sous la racine, skills dans sa config Claude), jamais celle de Romain.
    if STUDIO_CLIENT="$CLIENT_ID" STUDIO_HOME="$STUDIO_HOME" node --input-type=module -e '
      const { chargerConfig } = await import(process.argv[1]);
      const c = chargerConfig({ home: process.env.STUDIO_HOME });
      if (!c.client || c.client.id !== process.env.STUDIO_CLIENT) process.exit(3);' "$CODE/serveur/config.mjs" >/dev/null 2>&1 \
       && [ -f "$STUDIO_CONF" ]; then
      chmod 600 "$STUDIO_CONF"; installe "studio-config créée pour $QUI"
    else
      rm -f "$STUDIO_CONF"; echec "studio-config : le serveur n'a pas pu créer la config du client $CLIENT_ID"
    fi
  elif [ -f "$CODE/studio.config.exemple.json" ]; then
    cp "$CODE/studio.config.exemple.json" "$STUDIO_CONF"; chmod 600 "$STUDIO_CONF"
    installe "studio-config créée depuis le modèle"
  else
    ok "studio-config : pas de modèle dans le dépôt, le serveur la crée au premier démarrage"
  fi

  # Installation d'essai : publication.simulation à vrai dans la config (en plus du service, qui l'impose).
  if [ -n "${CLIENT_SIMULATION_FORCEE:-}" ] && [ -f "$STUDIO_CONF" ]; then
    case "$("$PY" - "$STUDIO_CONF" <<'PYEOF' 2>&1
import json, os, sys
p = sys.argv[1]
d = json.load(open(p, encoding="utf-8"))
pub = d.get("publication") if isinstance(d.get("publication"), dict) else {}
if pub.get("simulation") is True:
    print("DEJA"); sys.exit(0)
pub["simulation"] = True
d["publication"] = pub
tmp = p + ".tmp"
with open(tmp, "w", encoding="utf-8") as f:
    json.dump(d, f, indent=2, ensure_ascii=False); f.write("\n")
os.chmod(tmp, 0o600); os.replace(tmp, p)
print("POSEE")
PYEOF
)" in
      DEJA) ok "studio-simulation publication en simulation (forcée pour cette installation)";;
      POSEE) installe "studio-simulation publication passée en simulation (forcée pour cette installation)";;
      *) echec "studio-simulation : impossible de forcer la simulation dans $STUDIO_CONF";;
    esac
  fi

  # Le programme claude (le serveur le lance pour chaque conversation)
  local cl
  if cl="$(trouver_claude)"; then
    ok "claude $("$cl" --version 2>/dev/null | head -1) ($cl)"
  else
    if curl -fsSL https://claude.ai/install.sh -o "$BASE/install-claude.sh" && /bin/bash "$BASE/install-claude.sh" > "$BASE/install-claude.log" 2>&1 \
       && cl="$(trouver_claude)"; then
      installe "claude $("$cl" --version 2>/dev/null | head -1) ($cl)"
    else
      echec "claude : installation impossible (journal $BASE/install-claude.log)"
    fi
    rm -f "$BASE/install-claude.sh"
  fi

  # Copie de travail du head of content pour le studio (décision : studio/lancement/README.md)
  local DEPOT
  DEPOT="$(studio_chemin "$(studio_conf depot_hoc "$STUDIO_HOME/head-of-content")")"
  if [ ! -f "$CLE_HOC" ]; then
    mkdir -p "$(dirname "$CLE_HOC")"; chmod 700 "$(dirname "$CLE_HOC")"
    if ssh-keygen -q -t ed25519 -N "" -C "$COMMENT_CLE" -f "$CLE_HOC" >/dev/null 2>&1; then installe "cle-mac clé d'accès de ce Mac créée"
    else echec "cle-mac : ssh-keygen a échoué"; fi
  fi
  local ssh_cmd="ssh -o BatchMode=yes -o ConnectTimeout=10"
  case "$HOC_URL" in git@*|ssh://*) ssh_cmd="$SSH_HOC";; esac
  local acces=""
  if [ -e "$DEPOT" ] && [ ! -d "$DEPOT/.git" ]; then
    mkdir -p "$BASE/anciennes-versions/$stamp"
    mv "$DEPOT" "$BASE/anciennes-versions/$stamp/studio-head-of-content"
    installe "studio-hoc : ancien dossier sans historique rangé dans anciennes-versions/$stamp"
  fi
  if [ -d "$DEPOT/.git" ]; then
    git -C "$DEPOT" remote set-url origin "$HOC_URL"
    if GIT_SSH_COMMAND="$ssh_cmd" git -C "$DEPOT" fetch -q origin main 2>/dev/null; then
      acces=1; ok "studio-hoc copie de travail présente ($(git -C "$DEPOT" rev-parse --short HEAD), laissée telle quelle)"
    else
      a_faire "CLE_HOC la copie du studio existe mais l'accès est refusé ou hors ligne. Clé publique : $(cat "$CLE_HOC.pub" 2>/dev/null)"
    fi
  elif GIT_SSH_COMMAND="$ssh_cmd" git ls-remote "$HOC_URL" main >/dev/null 2>&1; then
    mkdir -p "$(dirname "$DEPOT")"
    if GIT_SSH_COMMAND="$ssh_cmd" git clone -q --branch main "$HOC_URL" "$DEPOT"; then
      acces=1; installe "studio-hoc copie de travail $(git -C "$DEPOT" rev-parse --short HEAD)"
    else
      echec "studio-hoc : accès accepté mais téléchargement impossible"
    fi
  else
    a_faire "CLE_HOC Yoan doit ajouter la clé de ce Mac au dépôt du head of content (clé de déploiement, écriture). Clé publique : $(cat "$CLE_HOC.pub" 2>/dev/null)"
  fi
  if [ -d "$DEPOT/.git" ]; then
    git -C "$DEPOT" config user.name "Mac de $QUI"
    git -C "$DEPOT" config user.email "$CLIENT_GIT_EMAIL"
    git -C "$DEPOT" config pull.rebase true
    git -C "$DEPOT" config rebase.autoStash true
    case "$HOC_URL" in git@*|ssh://*) git -C "$DEPOT" config core.sshCommand "$SSH_HOC";; esac
  fi
  if [ -n "$acces" ]; then
    # Droit d'écriture, sans rien envoyer : GitHub refuse la connexion d'envoi à une clé en lecture seule.
    local essai
    essai="$(GIT_SSH_COMMAND="$ssh_cmd" git -C "$DEPOT" push --dry-run origin HEAD:refs/heads/main 2>&1)"
    if echo "$essai" | grep -qiE "read only|read-only|permission|denied|403|not allowed"; then
      a_faire "CLE_HOC_ECRITURE la clé de ce Mac est acceptée en lecture seulement : Yoan doit lui donner l'écriture (dépôt du head of content, Deploy keys, Allow write access)"
    else
      ok "studio-hoc droit d'écriture"
    fi
  fi

  # Dossier des vidéos
  local MEDIA
  local media_defaut="~/Contenu"; [ -n "$CLIENT_ISOLE" ] && media_defaut="$BASE/Contenu"
  MEDIA="$(studio_chemin "$(studio_conf media "$media_defaut")")"
  if [ -d "$MEDIA" ]; then ok "studio-media dossier des vidéos présent"
  elif mkdir -p "$MEDIA"; then installe "studio-media dossier des vidéos créé ($MEDIA)"
  else echec "studio-media : impossible de créer $MEDIA"; fi

  # Service launchd : au démarrage de session, relancé s'il tombe en erreur.
  # Chemin des outils : celui de demarrer.sh, plus le dossier de claude et de node s'ils sont ailleurs.
  local chemin_service="$CHEMIN_OUTILS" b d
  for b in "${cl:-}" "$(command -v node 2>/dev/null || true)"; do
    [ -n "$b" ] || continue
    d="$(dirname "$b")"
    case ":$chemin_service:" in *":$d:"*) ;; *) chemin_service="$d:$chemin_service";; esac
  done
  mkdir -p "$(dirname "$STUDIO_PLIST")"
  local plist_change=""
  if ecrire_si_change "$STUDIO_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$STUDIO_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$LANCEMENT/demarrer.sh</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$CODE</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$chemin_service</string>
    <key>HOME</key>
    <string>$HOME</string>
    <key>LANG</key>
    <string>fr_FR.UTF-8</string>$(plist_env_client)
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>ProcessType</key>
  <string>Interactive</string>
  <key>StandardOutPath</key>
  <string>$STUDIO_HOME/lancement.log</string>
  <key>StandardErrorPath</key>
  <string>$STUDIO_HOME/lancement.log</string>
</dict>
</plist>
EOF
  then plist_change=1; fi
  if ! plutil -lint -s "$STUDIO_PLIST" >/dev/null 2>&1; then
    echec "studio-service : réglage du service invalide ($STUDIO_PLIST)"
  elif [ -n "${STUDIO_SANS_SERVICE:-}" ]; then
    ok "studio-service sauté (test) : réglage écrit et valide, rien chargé"
  else
    if [ -n "$plist_change" ] && studio_charge; then
      launchctl bootout "$STUDIO_DOMAINE/$STUDIO_LABEL" 2>/dev/null || true
      local i=0; while studio_charge && [ "$i" -lt 20 ]; do sleep 0.5; i=$((i + 1)); done
    fi
    if studio_charge; then
      ok "studio-service déjà chargé"
    elif launchctl bootstrap "$STUDIO_DOMAINE" "$STUDIO_PLIST" 2>/dev/null || studio_charge; then
      installe "studio-service chargé, il démarre avec la session ($STUDIO_LABEL)"
    else
      echec "studio-service : launchctl bootstrap a échoué"
    fi
  fi

  # L'appli Studio (~/Applications) et son icône : l'appli Mac, ou le navigateur si elle ne se lance pas ici
  local r_app; r_app="$(studio_poser_appli)"
  case "$r_app" in
    PRESENTE*) ok "studio-app $STUDIO_APP_NOM présente (${r_app#PRESENTE })";;
    POSEE*) installe "studio-app $STUDIO_APP_NOM dans le dossier Applications de $QUI (${r_app#POSEE })";;
    *) echec "studio-app : ${r_app#ECHEC }";;
  esac
  { [ -z "$CLIENT_ICONE" ] || [ ! -f "$CLIENT_ICONE" ]; } && ok "studio-icone : pas d'icône propre au client ($CLIENT_ID) dans studio/lancement/icones/, icône par défaut"
  [ -f "$STUDIO_APP/Contents/Resources/Studio.icns" ] || echec "studio-app : icône absente du dépôt ($LANCEMENT/icone.icns)"

  # Le Dock : une seule fois (si le client retire l'icône, on ne la remet pas)
  if [ -n "${STUDIO_SANS_DOCK:-}" ]; then
    ok "studio-dock sauté (test)"
  elif [ -f "$STUDIO_HOME/.dock-ajoute" ]; then
    ok "studio-dock déjà fait une fois"
  elif defaults read com.apple.dock persistent-apps 2>/dev/null | grep -qF -e "$STUDIO_APP" -e "$(studio_url_fichier "$STUDIO_APP")"; then
    date '+%Y-%m-%d %H:%M:%S' > "$STUDIO_HOME/.dock-ajoute"; ok "studio-dock icône déjà dans le Dock"
  else
    if defaults write com.apple.dock persistent-apps -array-add "<dict><key>tile-data</key><dict><key>file-data</key><dict><key>_CFURLString</key><string>$(studio_url_fichier "$STUDIO_APP")/</string><key>_CFURLStringType</key><integer>15</integer></dict></dict></dict>"; then
      killall Dock >/dev/null 2>&1 || true
      date '+%Y-%m-%d %H:%M:%S' > "$STUDIO_HOME/.dock-ajoute"
      installe "studio-dock icône $STUDIO_APP_NOM ajoutée au Dock"
    else
      echec "studio-dock : ajout au Dock impossible"
    fi
  fi

  # Le studio répond ? Au repos, on le redémarre pour qu'il tourne sur le code qui vient d'être aligné ;
  # occupé (une session tourne), on le laisse finir et le redémarrage se fera plus tard (repère).
  if [ ! -f "$CODE/serveur/studio.mjs" ]; then
    echec "studio-serveur : le code du serveur n'est pas encore dans le dépôt"
  elif [ -n "${STUDIO_SANS_SERVICE:-}" ]; then
    ok "studio-serveur sauté (test) : lancé par le script de test"
  elif [ -n "$plist_change" ] || [ "$(studio_repond)" != "200" ] || studio_au_repos; then
    studio_charge && launchctl kickstart -k "$STUDIO_DOMAINE/$STUDIO_LABEL" >/dev/null 2>&1
    rm -f "$STUDIO_REPERE_REDEMARRAGE"
    if studio_attendre 25; then installe "studio-serveur (re)démarré, il répond (port $(studio_port))"
    else echec "studio-serveur : ne répond pas après 25 s (journal $STUDIO_HOME/lancement.log : $(tail -1 "$STUDIO_HOME/lancement.log" 2>/dev/null | cut -c1-120))"; fi
  else
    date '+%Y-%m-%d %H:%M:%S installation' > "$STUDIO_REPERE_REDEMARRAGE"
    ok "studio-serveur répond (port $(studio_port)) ; occupé, il redémarrera à la fin de ses tâches"
  fi

  # L'appli ouverte tourne sur l'ancienne copie (ancienne icône dans le Dock) : relancée si le studio est
  # au repos, sinon au prochain clic sur son icône (appli.sh). Le Dock n'est pas touché.
  case "$(studio_relancer_appli_si_demande)" in
    RELANCEE) installe "studio-app $STUDIO_APP_NOM relancée sur sa nouvelle version (icône à jour)";;
    ATTEND) ok "studio-app ouverte, studio occupé : elle se relancera au repos ou au prochain clic sur son icône";;
  esac

  echo "STUDIO_FIN ok=$nb_ok a_faire=$nb_faire echecs=$nb_echec"
  [ "$nb_echec" -eq 0 ] && [ "$nb_faire" -eq 0 ]
}

# ------------------------------------------------------------------ verifier

cmd_verifier() {
  set -u
  local nb_ko=0
  okv() { echo "VERIF_OK $*"; }
  kov() { echo "VERIF_ECHEC $*"; nb_ko=$((nb_ko + 1)); }
  afv() { echo "VERIF_A_FAIRE $*"; nb_ko=$((nb_ko + 1)); }
  local p; p="$(studio_port)"

  if [ -n "${STUDIO_SANS_SERVICE:-}" ]; then
    okv "studio-service sauté (test, serveur lancé par le script de test)"
  elif studio_charge; then
    local pid; pid="$(studio_pid)"
    if [ -n "$pid" ]; then okv "studio-service chargé et lancé ($STUDIO_LABEL)"; else kov "studio-service chargé mais arrêté (journal $STUDIO_HOME/lancement.log)"; fi
  else
    kov "studio-service : pas chargé (relancer installer.sh)"
  fi

  local c
  c="$(studio_repond)"
  if [ "$c" = "200" ]; then okv "studio-serveur répond sur 127.0.0.1:$p"; else kov "studio-serveur : GET / rend $c sur 127.0.0.1:$p"; fi
  c="$(curl -s -o /dev/null --max-time 3 -w '%{http_code}' -H "Host: 127.0.0.1:$p" "http://127.0.0.1:$p/api/etat" 2>/dev/null)"
  if [ "$c" = "401" ]; then okv "studio-securite /api/etat refusé sans jeton (401)"; else kov "studio-securite : /api/etat sans jeton rend $c (attendu 401)"; fi
  c="$(curl -s -o /dev/null --max-time 3 -w '%{http_code}' -H "Host: exemple.com" "http://127.0.0.1:$p/" 2>/dev/null)"
  if [ "$c" = "421" ]; then okv "studio-securite mauvais Host refusé (421)"; else kov "studio-securite : mauvais Host rend $c (attendu 421)"; fi
  if [ -s "$STUDIO_HOME/jeton" ] && [ "$(stat -f %Lp "$STUDIO_HOME/jeton")" = "600" ]; then okv "studio-jeton présent (0600)"
  else kov "studio-jeton : absent ou droits trop larges"; fi

  if [ -x "$STUDIO_APP/Contents/MacOS/Studio" ] && plutil -lint -s "$STUDIO_APP/Contents/Info.plist" >/dev/null 2>&1 \
     && [ -s "$STUDIO_APP/Contents/Resources/Studio.icns" ]; then
    if head -c 2 "$STUDIO_APP/Contents/MacOS/Studio" | grep -q '#!'; then okv "studio-app $STUDIO_APP_NOM présente avec son icône (ouverture dans le navigateur)"
    else okv "studio-app $STUDIO_APP_NOM présente avec son icône (appli Mac)"; fi
  else
    kov "studio-app : $STUDIO_APP_NOM.app absente ou incomplète"
  fi

  local DEPOT
  DEPOT="$(studio_chemin "$(studio_conf depot_hoc "$STUDIO_HOME/head-of-content")")"
  if [ -d "$DEPOT/.git" ]; then okv "studio-hoc copie de travail présente"
  else afv "studio-hoc : copie de travail absente (clé du Mac à ajouter par Yoan, puis relancer installer.sh)"; fi

  if [ -n "${STUDIO_SANS_CLAUDE:-}" ]; then
    okv "studio-claude session d'essai sautée (test)"
  else
    local cl r d
    if ! cl="$(trouver_claude)"; then
      kov "studio-claude : programme claude introuvable"
    else
      # Comme le serveur : le jeton de connexion posé par cles.sh claude, s'il existe.
      local avec="connexion du Mac"
      studio_jeton_claude && avec="jeton de connexion"
      d="$(mktemp -d)"
      r="$(cd "$d" && PATH="$CHEMIN_OUTILS" avec_limite 90 "$cl" -p "Réponds seulement le mot PRET, rien d'autre." --max-turns 1 --output-format text </dev/null 2>&1)"
      rm -rf "$d"
      case "$r" in
        *PRET*) okv "studio-claude une session d'essai a répondu (compte Claude de ce Mac, $avec)";;
        *[Ll]ogin*|*"log in"*|*"Invalid API key"*|*"not logged"*|*authenticat*|*OAuth*)
          afv "CLAUDE_CONNEXION le programme claude n'est pas connecté au compte Claude de ce Mac : $(echo "$r" | head -1 | cut -c1-120)";;
        *) kov "studio-claude : $(echo "$r" | tail -1 | cut -c1-160)";;
      esac
    fi
  fi
  return "$nb_ko"
}

# ------------------------------------------------------------------ réglages posés à l'installation

cmd_disques() {
  local v racine
  racine="$(stat -f %d /)"
  for v in /Volumes/*; do
    [ -d "$v" ] || continue
    [ "$(stat -f %d "$v" 2>/dev/null)" = "$racine" ] && continue
    case "$(basename "$v")" in com.apple.*|"Recovery"|"Preboot"|"VM"|"Update") continue;; esac
    echo "DISQUE $(basename "$v") libre=$(df -h "$v" 2>/dev/null | awk 'NR==2 {print $4}')"
  done
  echo "FIN_DISQUES"
}

cmd_reglage() { # $1 clé, $2 valeur
  local cle="${1:-}" val="${2:-}"
  case "$cle" in
    disque_externe)
      [ -n "$val" ] || { echo "REGLAGE_REFUSE disque_externe vide"; return 2; }
      case "$val" in /Volumes/*) ;; *) val="/Volumes/$val";; esac
      [ -d "$val" ] || echo "ATTENTION disque $val pas branché en ce moment (réglage gardé quand même)";;
    appareil)
      [ -n "$val" ] || { echo "REGLAGE_REFUSE appareil vide"; return 2; };;
    *) echo "REGLAGE_REFUSE $cle (réglages permis : disque_externe, appareil)"; return 2;;
  esac
  mkdir -p "$STUDIO_HOME"
  if [ ! -f "$STUDIO_CONF" ] && [ -f "$CODE/studio.config.exemple.json" ]; then cp "$CODE/studio.config.exemple.json" "$STUDIO_CONF"; fi
  "$PY" - "$STUDIO_CONF" "$cle" "$val" <<'PYEOF'
import json, os, sys
p, cle, val = sys.argv[1], sys.argv[2], sys.argv[3]
d = {}
if os.path.exists(p):
    d = json.load(open(p, encoding="utf-8"))
d[cle] = val
tmp = p + ".tmp"
with open(tmp, "w", encoding="utf-8") as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
    f.write("\n")
os.chmod(tmp, 0o600)
os.replace(tmp, p)
print("REGLAGE_OK %s=%s" % (cle, val))
PYEOF
}

case "${1:-installer}" in
  installer) cmd_installer; exit $?;;
  verifier) cmd_verifier; exit $?;;
  disques) cmd_disques;;
  reglage) shift; cmd_reglage "$@"; exit $?;;
  redemarrer-si-libre) studio_redemarrer_si_demande;;
  *) echo "usage : studio.sh installer | verifier | disques | reglage <clé> <valeur> | redemarrer-si-libre"; exit 2;;
esac
