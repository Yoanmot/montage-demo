#!/bin/bash
# Installation (ou réinstallation) du monteur, des carrousels et du studio d'un client sur un Mac
# (Romain par défaut ; un autre client avec STUDIO_CLIENT=<id>, voir studio/lancement/client.sh).
# Lancé par le Claude de Romain (prompt d'installation de Yoan) :
#   curl -fsSL https://raw.githubusercontent.com/Yoanmot/montage-demo/main/installation/installer.sh -o /tmp/installer-montage.sh
#   /bin/bash /tmp/installer-montage.sh
# Relançable autant de fois qu'on veut : ce qui est déjà en place n'est pas touché.
#
# Une ligne par point, lue par Claude (jamais montrée telle quelle à Romain) :
#   OK <point> ...            déjà en place
#   INSTALLE <point> ...      installé ou mis à jour à l'instant
#   A_FAIRE <CODE> ...        une action humaine est nécessaire (voir le prompt), puis relancer
#   ECHEC <point> ...         erreur inattendue : le message va à Yoan
# Dernière ligne : FIN ok=<n> a_faire=<n> echecs=<n>
# Codes de sortie : 0 tout est en place ; 10 outils Apple à installer (fenêtre ouverte) ; 11 Homebrew à installer ;
# 1 au moins une autre action ou un échec (la suite a quand même été faite).
#
# Client : STUDIO_CLIENT=<id> (défaut romain). Lancé depuis une copie du dépôt, le fichier du client est
# lu à côté ; lancé seul (curl), il est téléchargé de la branche STUDIO_BRANCHE (défaut main).
# Variables pour les tests de Yoan seulement : MONTAGE_DEPOT_URL, MONTAGE_BRANCHE, HOC_DEPOT_URL,
# STUDIO_CLIENT_FICHIER, et pour le studio STUDIO_LABEL, STUDIO_SANS_DOCK, STUDIO_SANS_SERVICE,
# STUDIO_SERVICES_DOSSIER, STUDIO_APPLIS_DOSSIER (voir installation/studio.sh et studio/lancement/commun.sh).
# Aucune clé dans ce fichier : les clés se posent avec installation/cles.sh.

# Le client : client.sh de cette copie du dépôt, sinon téléchargé ; Romain sans rien : ses valeurs.
charger_client() {
  local ici lc tmp br
  ici="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
  lc="$ici/../studio/lancement/client.sh"
  if [ ! -f "$lc" ] && [ -n "${STUDIO_CLIENT:-}" ] && [ "$STUDIO_CLIENT" != "romain" ]; then
    tmp="$(mktemp -d)"; br="${STUDIO_BRANCHE:-main}"
    mkdir -p "$tmp/studio/lancement" "$tmp/studio/clients"
    curl -fsSL "https://raw.githubusercontent.com/Yoanmot/montage-demo/$br/studio/lancement/client.sh" -o "$tmp/studio/lancement/client.sh" 2>/dev/null || true
    if [ -z "${STUDIO_CLIENT_FICHIER:-}" ]; then
      curl -fsSL "https://raw.githubusercontent.com/Yoanmot/montage-demo/$br/studio/clients/$STUDIO_CLIENT.json" -o "$tmp/studio/clients/$STUDIO_CLIENT.json" 2>/dev/null || true
    fi
    lc="$tmp/studio/lancement/client.sh"
  fi
  if [ -f "$lc" ]; then
    # shellcheck source=../studio/lancement/client.sh
    . "$lc"; studio_client_charger; return $?
  fi
  [ "${STUDIO_CLIENT:-romain}" = "romain" ] || { CLIENT_ERREUR="client ${STUDIO_CLIENT} introuvable (pas de connexion ?)"; return 1; }
  CLIENT_ID=romain CLIENT_PRENOM=Romain CLIENT_RACINE="$HOME/.montage-yoan" CLIENT_CLAUDE="$HOME/.claude"
  CLIENT_HOC_DEPOT="git@github.com:Yoanmot/head-of-content-romain.git" CLIENT_CLE_SSH="$HOME/.ssh/fitavecromain_head_of_content"
  CLIENT_BRANCHE=main CLIENT_CONFIG_CLAUDE="" CLIENT_ISOLE="" CLIENT_SONS="$HOME/.config/monteur-romain"
  CLIENT_HOOK='/bin/bash "$HOME/.montage-yoan/montage-demo/installation/mettre-a-jour.sh" --hook' CLIENT_FICHIER=""
  CLIENT_ERREUR=""
}

main() {
  set -u
  export GIT_TERMINAL_PROMPT=0 HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_ENV_HINTS=1
  if ! charger_client; then echo "ECHEC client : $CLIENT_ERREUR"; echo "FIN ok=0 a_faire=0 echecs=1"; return 1; fi
  local BASE="$CLIENT_RACINE"
  local CLONE="$BASE/montage-demo"
  local HOC="$BASE/head-of-content"
  local DEPOT_URL="${MONTAGE_DEPOT_URL:-https://github.com/Yoanmot/montage-demo.git}"
  local BRANCHE="${MONTAGE_BRANCHE:-$CLIENT_BRANCHE}"
  local HOC_URL="${HOC_DEPOT_URL:-$CLIENT_HOC_DEPOT}"
  local CLE_HOC="$CLIENT_CLE_SSH"
  local CC="$CLIENT_CLAUDE"
  local SKILLS="$CC/skills"
  local QUI="$CLIENT_PRENOM"
  local COMMENT_CLE="mac-$CLIENT_ID-head-of-content"
  # Client isolé : tout ce qui touche à Claude (liens, mémoire, hook, plugin) va dans sa config à lui.
  [ -n "$CLIENT_ISOLE" ] && export CLAUDE_CONFIG_DIR="$CLIENT_CONFIG_CLAUDE"
  export STUDIO_CLIENT="$CLIENT_ID"
  local PWSH_VERSION="7.4.6"
  local HYPERFRAMES="hyperframes@0.7.55"
  local PY=/usr/bin/python3
  local nb_ok=0 nb_faire=0 nb_echec=0 code_sortie=0
  mkdir -p "$BASE/bin"
  [ -n "$CLIENT_ISOLE" ] && chmod 700 "$BASE"

  ok()      { echo "OK $*"; nb_ok=$((nb_ok + 1)); }
  installe(){ echo "INSTALLE $*"; nb_ok=$((nb_ok + 1)); }
  a_faire() { echo "A_FAIRE $*"; nb_faire=$((nb_faire + 1)); }
  echec()   { echo "ECHEC $*"; nb_echec=$((nb_echec + 1)); }
  fin()     { echo "FIN ok=$nb_ok a_faire=$nb_faire echecs=$nb_echec"; }

  # ------------------------------------------------------------ le Mac
  if [ "$(uname -s)" != "Darwin" ]; then echec "mac : ce script est fait pour un Mac"; fin; return 1; fi
  local macos arch
  macos="$(sw_vers -productVersion)"; arch="$(uname -m)"
  if [ "${macos%%.*}" -lt 12 ]; then echec "macos $macos : il faut macOS 12 ou plus (détourage Apple Vision)"; fi
  ok "mac macOS $macos $arch"

  # ------------------------------------------------------------ outils d'Apple (git, Python 3 du système)
  if ! xcode-select -p >/dev/null 2>&1 || ! "$PY" -c "import sys" >/dev/null 2>&1; then
    xcode-select --install >/dev/null 2>&1 || true
    a_faire "OUTILS_APPLE une fenêtre d'Apple propose d'installer des outils : cliquer sur Installer, attendre la fin (quelques minutes), puis relancer ce script"
    fin; return 10
  fi
  ok "outils-apple $("$PY" --version 2>&1) $(git --version 2>/dev/null)"

  # ------------------------------------------------------------ Homebrew (seulement si un outil manque)
  local BREW=""
  for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do [ -x "$b" ] && { BREW="$b"; break; }; done
  if [ -n "$BREW" ]; then
    eval "$("$BREW" shellenv)"
    # Que Claude retrouve les outils de Homebrew dans chaque session (ce que l'installeur de Homebrew demande de faire).
    if ! grep -qs "brew shellenv" "$HOME/.zprofile"; then
      printf '\neval "$(%s shellenv)"\n' "$BREW" >> "$HOME/.zprofile"
      installe "homebrew ajouté au chemin des outils (~/.zprofile)"
    fi
  fi
  export PATH="$BASE/bin:$PATH"
  besoin_brew() {
    if [ -z "$BREW" ]; then
      a_faire "HOMEBREW il manque $1 et Homebrew n'est pas sur ce Mac : $QUI colle dans l'app Terminal la commande d'installation de https://brew.sh (elle demande le mot de passe du Mac), suit les 2 lignes « Next steps » qu'elle affiche, puis on relance ce script"
      return 1
    fi
    return 0
  }

  # ------------------------------------------------------------ Node 24 ou plus
  local nv
  nv="$(node -v 2>/dev/null | sed 's/^v//')"
  if [ -n "$nv" ] && [ "${nv%%.*}" -ge 24 ]; then
    ok "node $nv"
  elif besoin_brew "Node 24"; then
    if "$BREW" install node@24 >/dev/null 2>&1 && "$BREW" link --overwrite --force node@24 >/dev/null 2>&1; then
      hash -r; nv="$(node -v 2>/dev/null | sed 's/^v//')"
      if [ -n "$nv" ] && [ "${nv%%.*}" -ge 24 ]; then installe "node $nv"; else echec "node : installé mais $(command -v node) répond « ${nv:-rien} »"; fi
    else
      echec "node : brew install node@24 a échoué"
    fi
  fi

  # ------------------------------------------------------------ ffmpeg 7 ou plus (là où les briques le cherchent)
  version_ffmpeg() { # majeure ; une version de développement (« N-... ») compte comme récente, rien = 0
    local l; l="$("$1" -version 2>/dev/null | head -1)"
    case "$l" in
      "ffmpeg version "[nN]-*) echo 99;;
      "ffmpeg version "*) echo "$l" | sed -E -e 's/^ffmpeg version n?([0-9]+).*/\1/' -e 't' -e 's/.*/0/';;
      *) echo 0;;
    esac
  }
  local ff="" fv=0
  for b in /opt/homebrew/bin/ffmpeg /usr/local/bin/ffmpeg; do
    if [ -x "$b" ] && [ -x "$(dirname "$b")/ffprobe" ]; then ff="$b"; fv="$(version_ffmpeg "$b")"; break; fi
  done
  if [ -n "$ff" ] && [ "$fv" -ge 7 ]; then
    ok "ffmpeg $fv ($ff)"
  elif besoin_brew "ffmpeg 7"; then
    if "$BREW" list ffmpeg >/dev/null 2>&1; then "$BREW" upgrade ffmpeg >/dev/null 2>&1; else "$BREW" install ffmpeg >/dev/null 2>&1; fi
    ff="$("$BREW" --prefix)/bin/ffmpeg"; fv="$(version_ffmpeg "$ff")"
    if [ "$fv" -ge 7 ]; then installe "ffmpeg $fv ($ff)"; else echec "ffmpeg : toujours absent ou plus ancien que la 7 après brew"; fi
  fi

  # ------------------------------------------------------------ Chrome ou Edge (mise en page des carrousels)
  local nav=""
  for a in "/Applications/Google Chrome.app" "/Applications/Microsoft Edge.app"; do [ -d "$a" ] && { nav="$a"; break; }; done
  if [ -n "$nav" ]; then
    ok "navigateur $(basename "$nav" .app)"
  elif besoin_brew "Google Chrome"; then
    if "$BREW" install --cask google-chrome >/dev/null 2>&1 && [ -d "/Applications/Google Chrome.app" ]; then installe "navigateur Google Chrome"
    else echec "navigateur : l'installation de Google Chrome a échoué (à installer depuis google.com/chrome)"; fi
  fi

  # ------------------------------------------------------------ modules Python du système
  local manquants="" paire mod pip
  for paire in numpy:numpy scipy:scipy PIL:pillow fontTools:fonttools uharfbuzz:uharfbuzz \
               Quartz:pyobjc-framework-Quartz Vision:pyobjc-framework-Vision; do
    mod="${paire%%:*}"; pip="${paire#*:}"
    "$PY" -c "import $mod" >/dev/null 2>&1 || manquants="$manquants $pip"
  done
  if [ -z "$manquants" ]; then
    ok "python-modules numpy scipy pillow fonttools uharfbuzz pyobjc"
  else
    # shellcheck disable=SC2086
    if "$PY" -m pip install --user --quiet --disable-pip-version-check $manquants >"$BASE/pip.log" 2>&1; then
      local encore=""
      for paire in numpy:numpy scipy:scipy PIL:pillow fontTools:fonttools uharfbuzz:uharfbuzz Quartz:pyobjc-framework-Quartz Vision:pyobjc-framework-Vision; do
        "$PY" -c "import ${paire%%:*}" >/dev/null 2>&1 || encore="$encore ${paire#*:}"
      done
      if [ -z "$encore" ]; then installe "python-modules$manquants"; else echec "python-modules : toujours absents :$encore (journal $BASE/pip.log)"; fi
    else
      echec "python-modules : pip a échoué pour$manquants (journal $BASE/pip.log)"
    fi
  fi

  # ------------------------------------------------------------ PowerShell (skill carrousel seulement), version portable
  # Un client qui a son propre skill de mise en page (skill_carrousel) n'en a pas besoin.
  local ps=""
  ps="$(command -v pwsh 2>/dev/null || true)"
  if [ "${CLIENT_SKILL_CARROUSEL:-carrousel}" != "carrousel" ]; then
    ok "pwsh inutile (mise en page des carrousels par ${CLIENT_SKILL_CARROUSEL})"
  elif [ -n "$ps" ] && "$ps" -NoProfile -Command '$PSVersionTable.PSVersion.Major' >/dev/null 2>&1; then
    [ -x "$BASE/bin/pwsh" ] || [ "$ps" = "$BASE/bin/pwsh" ] || ln -sfn "$ps" "$BASE/bin/pwsh"
    ok "pwsh $("$ps" -v 2>/dev/null)"
  else
    local parch="arm64"; [ "$arch" = "x86_64" ] && parch="x64"
    local dest="$BASE/outils/powershell-$PWSH_VERSION"
    local url="https://github.com/PowerShell/PowerShell/releases/download/v$PWSH_VERSION/powershell-$PWSH_VERSION-osx-$parch.tar.gz"
    rm -rf "$dest.tmp"; mkdir -p "$dest.tmp"
    if curl -fsSL --retry 2 "$url" -o "$BASE/outils/pwsh.tar.gz" && tar -xzf "$BASE/outils/pwsh.tar.gz" -C "$dest.tmp"; then
      rm -rf "$dest"; mv "$dest.tmp" "$dest"; rm -f "$BASE/outils/pwsh.tar.gz"
      chmod +x "$dest/pwsh"; xattr -dr com.apple.quarantine "$dest" 2>/dev/null || true
      ln -sfn "$dest/pwsh" "$BASE/bin/pwsh"
      if "$BASE/bin/pwsh" -NoProfile -Command 'exit 0' >/dev/null 2>&1; then installe "pwsh $PWSH_VERSION ($BASE/bin/pwsh)"
      else echec "pwsh : téléchargé mais ne démarre pas"; fi
    else
      rm -rf "$dest.tmp"; echec "pwsh : téléchargement impossible ($url)"
    fi
  fi

  # ------------------------------------------------------------ le dépôt du monteur, ses skills et son agent
  if [ -e "$CLONE" ] && [ ! -d "$CLONE/.git" ]; then mv "$CLONE" "$CLONE.ancien-$(date +%Y%m%d-%H%M%S)"; fi
  if [ -d "$CLONE/.git" ]; then
    git -C "$CLONE" remote set-url origin "$DEPOT_URL"
    if git -C "$CLONE" fetch -q origin "$BRANCHE" && git -C "$CLONE" checkout -q -f -B "$BRANCHE" "origin/$BRANCHE" 2>/dev/null; then ok "depot-monteur $(git -C "$CLONE" rev-parse --short HEAD) ($BRANCHE)"
    else echec "depot-monteur : mise à jour impossible (connexion ?)"; fi
  else
    if git clone -q --branch "$BRANCHE" "$DEPOT_URL" "$CLONE"; then installe "depot-monteur $(git -C "$CLONE" rev-parse --short HEAD) ($BRANCHE)"
    else echec "depot-monteur : téléchargement impossible ($DEPOT_URL, branche $BRANCHE)"; fin; return 1; fi
  fi
  # Le client de cette installation, recopié dans la racine : les scripts lancés sans STUDIO_CLIENT
  # (service, hook, sessions) le retrouvent par là (studio/lancement/client.sh). Romain : rien à poser.
  if [ "$CLIENT_ID" != "romain" ] && [ -f "$CLIENT_FICHIER" ]; then
    if [ -n "${STUDIO_CLIENT_FICHIER:-}" ] && [ ! -f "$CLONE/studio/clients/$CLIENT_ID.json" ]; then
      cp "$CLIENT_FICHIER" "$CLONE/studio/clients/$CLIENT_ID.json"   # test : client hors du dépôt
    fi
    if ! cmp -s "$CLIENT_FICHIER" "$BASE/client.json"; then cp "$CLIENT_FICHIER" "$BASE/client.json"; installe "client $CLIENT_ID posé ($BASE/client.json)"
    else ok "client $CLIENT_ID"; fi
  fi

  # Les polices du client que le dépôt public ne peut pas contenir (polices_locales, lot 10) : copiées depuis son
  # fichier à lui dans <racine>/studio/polices ; absente : le thème retombe sur sa police de repli.
  local ligne_pol
  while IFS= read -r ligne_pol; do
    case "$ligne_pol" in POLICE_POSEE*) installe "${ligne_pol#POLICE_POSEE }";; POLICE_A_JOUR*) ok "police ${ligne_pol#POLICE_A_JOUR }";;
      POLICE_ABSENTE*) echo "  A_VOIR police absente : ${ligne_pol#POLICE_ABSENTE } (le studio prend la police de repli)";; esac
  done <<EOF_POL
$(type studio_poser_polices >/dev/null 2>&1 && studio_poser_polices "$BASE/studio")
EOF_POL

  # Ce qui a été retiré du dépôt : l'ancien skill montage, le skill du plugin, rangés (jamais effacés).
  local stamp vieux
  stamp="$(date +%Y%m%d-%H%M%S)"
  for vieux in montage monter; do
    if [ -e "$SKILLS/$vieux" ] || [ -L "$SKILLS/$vieux" ]; then
      mkdir -p "$BASE/anciennes-versions/$stamp/skills"
      mv "$SKILLS/$vieux" "$BASE/anciennes-versions/$stamp/skills/$vieux"
      installe "retrait skills/$vieux (rangé dans $BASE/anciennes-versions/$stamp)"
    fi
  done
  # Le plugin « montage » (marketplace yoan-montage), s'il avait été ajouté.
  if grep -qs "yoan-montage" "$CC/plugins/installed_plugins.json" "$CC/plugins/known_marketplaces.json" "$CC/settings.json"; then
    local cli="${CLAUDE_CODE_EXECPATH:-$(command -v claude 2>/dev/null || true)}"
    if [ -n "$cli" ] && [ -x "$cli" ]; then
      "$cli" plugin uninstall montage@yoan-montage >/dev/null 2>&1 || true
      "$cli" plugin marketplace remove yoan-montage >/dev/null 2>&1 || true
    fi
    "$PY" - "$CC/settings.json" <<'PYEOF' || true
import json, sys, os
p = sys.argv[1]
if os.path.exists(p):
    try:
        d = json.load(open(p, encoding="utf-8"))
    except Exception:
        sys.exit(0)
    ch = False
    if isinstance(d.get("enabledPlugins"), dict) and "montage@yoan-montage" in d["enabledPlugins"]:
        del d["enabledPlugins"]["montage@yoan-montage"]; ch = True
    if isinstance(d.get("extraKnownMarketplaces"), dict) and "yoan-montage" in d["extraKnownMarketplaces"]:
        del d["extraKnownMarketplaces"]["yoan-montage"]; ch = True
    if ch:
        json.dump(d, open(p, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
PYEOF
    if grep -qs "yoan-montage" "$CC/plugins/installed_plugins.json" "$CC/settings.json"; then
      a_faire "PLUGIN_MONTAGE l'ancien plugin montage est encore listé : dans Claude, taper /plugin, onglet Installed, retirer « montage »"
    else
      installe "retrait plugin montage@yoan-montage"
    fi
  fi

  # Liens des skills et de l'agent (les anciennes copies sont rangées, leurs goûts appris gardés).
  if /bin/bash "$CLONE/installation/mettre-a-jour.sh" --liens-installation > "$BASE/liens.log" 2>&1; then
    local nl
    nl="$(ls -1 "$CLONE/skills" | wc -l | tr -d ' ')"
    ok "skills $nl skills reliés à $SKILLS, agent monteur relié ($(grep -c -E '^(AJOUTE|REMPLACE|LIEN_REFAIT|RETIRE)' "$BASE/liens.log") changements)"
    grep -E '^(GARDE|REMPLACE|RETIRE|IGNORE)' "$BASE/liens.log" | sed 's/^/  /'
  else
    echec "skills : les liens n'ont pas pu être posés (journal $BASE/liens.log)"
  fi

  # Mémoire du monteur : les modèles seulement s'ils manquent (jamais écrasée).
  local MEM="$CC/agent-memory/monteur" m nm=0
  mkdir -p "$MEM"
  # Modèles du client s'il en a (agents/monteur-memoire/<id>/), sinon ceux de Romain.
  local MODELES="$CLONE/agents/monteur-memoire"
  [ -d "$MODELES/$CLIENT_ID" ] && MODELES="$MODELES/$CLIENT_ID"
  for m in "$MODELES"/*.md; do
    [ -f "$MEM/$(basename "$m")" ] || { cp "$m" "$MEM/"; nm=$((nm + 1)); }
  done
  ok "memoire-monteur ($nm modèles posés, rien d'écrasé)"

  # Mise à jour automatique : hook SessionStart dans les réglages de Claude du client (~/.claude/settings.json
  # chez Romain).
  local hook_res
  hook_res="$("$PY" - "$CC/settings.json" "$CLIENT_HOOK" <<'PYEOF'
import json, os, sys
p = sys.argv[1]
cmd = sys.argv[2]
d = {}
if os.path.exists(p):
    try:
        d = json.load(open(p, encoding="utf-8"))
    except Exception as e:
        print("ILLISIBLE %s" % e); sys.exit(0)
    if not isinstance(d, dict):
        print("ILLISIBLE pas un objet"); sys.exit(0)
hooks = d.setdefault("hooks", {})
ss = hooks.setdefault("SessionStart", [])
for g in ss:
    for h in (g.get("hooks") or []):
        if "montage-demo/installation/mettre-a-jour.sh" in (h.get("command") or ""):
            if h.get("command") != cmd:
                h["command"] = cmd
                json.dump(d, open(p, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
                print("CORRIGE"); sys.exit(0)
            print("DEJA"); sys.exit(0)
ss.append({"matcher": "startup", "hooks": [{"type": "command", "command": cmd, "timeout": 30}]})
os.makedirs(os.path.dirname(p), exist_ok=True)
if os.path.exists(p):
    import shutil; shutil.copy2(p, p + ".avant-montage")
json.dump(d, open(p, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
print("AJOUTE")
PYEOF
)"
  case "$hook_res" in
    DEJA) ok "mise-a-jour-auto déjà branchée (à chaque ouverture de Claude)";;
    AJOUTE|CORRIGE) installe "mise-a-jour-auto branchée (à chaque ouverture de Claude)";;
    *) echec "mise-a-jour-auto : réglages de Claude illisibles ($hook_res), rien modifié";;
  esac

  # ------------------------------------------------------------ HyperFrames et son navigateur de rendu
  if command -v npx >/dev/null 2>&1; then
    if npx --yes "$HYPERFRAMES" browser ensure > "$BASE/hyperframes.log" 2>&1; then ok "hyperframes 0.7.55 et son navigateur de rendu"
    else echec "hyperframes : téléchargement impossible (journal $BASE/hyperframes.log)"; fi
  else
    echec "hyperframes : npx absent (Node manque)"
  fi

  # ------------------------------------------------------------ dépendances de la liste (dont la version de claude du studio)
  # installation/dependances.txt : ce que les mises à jour vérifient aussi ; ici, tout est revu.
  if [ -f "$CLONE/installation/dependances.sh" ]; then
    local ld
    while IFS= read -r ld; do
      case "$ld" in
        DEP_OK*) ;;
        DEP_INSTALLE*) installe "dependance ${ld#DEP_INSTALLE }";;
        DEP_MANQUE*) echec "dependance ${ld#DEP_MANQUE }";;
        DEP_FIN*) ok "dependances ${ld#DEP_FIN }";;
      esac
    done < <(/bin/bash "$CLONE/installation/dependances.sh" </dev/null 2>&1)
  fi

  # ------------------------------------------------------------ copie du head of content (carrousels, publication)
  if [ ! -f "$CLE_HOC" ]; then
    mkdir -p "$(dirname "$CLE_HOC")"; chmod 700 "$(dirname "$CLE_HOC")"
    ssh-keygen -q -t ed25519 -N "" -C "$COMMENT_CLE" -f "$CLE_HOC" >/dev/null 2>&1 \
      && installe "cle-mac clé d'accès de ce Mac créée" || echec "cle-mac : ssh-keygen a échoué"
  fi
  local SSH_HOC="ssh -i \"$CLE_HOC\" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o BatchMode=yes -o ConnectTimeout=10"
  if [ -d "$HOC/.git" ]; then
    if GIT_SSH_COMMAND="$SSH_HOC" git -C "$HOC" fetch -q origin main 2>/dev/null; then
      git -C "$HOC" checkout -q -f -B main origin/main
      ok "copie-hoc à jour $(git -C "$HOC" rev-parse --short HEAD)"
    else
      a_faire "CLE_HOC la copie existe mais l'accès est refusé ou hors ligne. Clé publique : $(cat "$CLE_HOC.pub" 2>/dev/null)"
    fi
  elif GIT_SSH_COMMAND="$SSH_HOC" git ls-remote "$HOC_URL" main >/dev/null 2>&1; then
    if GIT_SSH_COMMAND="$SSH_HOC" git clone -q --branch main "$HOC_URL" "$HOC"; then
      git -C "$HOC" config user.name "Mac de $QUI"
      git -C "$HOC" config user.email "$CLIENT_GIT_EMAIL"
      git -C "$HOC" config core.sshCommand "$SSH_HOC"
      installe "copie-hoc $(git -C "$HOC" rev-parse --short HEAD)"
    else
      echec "copie-hoc : accès accepté mais téléchargement impossible"
    fi
  else
    a_faire "CLE_HOC Yoan doit ajouter la clé de ce Mac au dépôt du head of content (clé de déploiement, écriture). Clé publique : $(cat "$CLE_HOC.pub" 2>/dev/null)"
  fi
  if [ -d "$HOC/.git" ]; then
    git -C "$HOC" config core.sshCommand "$SSH_HOC"
    local pub="$HOC/.claude/skills/publier"
    if [ -f "$pub/SKILL.md" ]; then
      if [ -L "$SKILLS/publier" ] && [ "$(readlink "$SKILLS/publier")" = "$pub" ]; then ok "skill-publier relié"
      else
        if [ -e "$SKILLS/publier" ] || [ -L "$SKILLS/publier" ]; then
          mkdir -p "$BASE/anciennes-versions/$stamp/skills"; mv "$SKILLS/publier" "$BASE/anciennes-versions/$stamp/skills/publier"
        fi
        ln -s "$pub" "$SKILLS/publier"; installe "skill-publier relié"
      fi
    else
      echec "skill-publier : absent de la copie du head of content"
    fi
  fi

  # ------------------------------------------------------------ le studio (service, appli Studio, copie de travail)
  if [ -f "$CLONE/installation/studio.sh" ]; then
    local ligne
    while IFS= read -r ligne; do
      case "$ligne" in
        "OK "*) ok "${ligne#OK }";;
        "INSTALLE "*) installe "${ligne#INSTALLE }";;
        "A_FAIRE CLE_HOC "*) [ -d "$HOC/.git" ] && a_faire "${ligne#A_FAIRE }" || echo "  (le studio attend la même clé : CLE_HOC ci-dessus)";;
        "A_FAIRE "*) a_faire "${ligne#A_FAIRE }";;
        "ECHEC "*) echec "${ligne#ECHEC }";;
        STUDIO_FIN*) ;;
        *) echo "  $ligne";;
      esac
    done < <(HOC_DEPOT_URL="$HOC_URL" /bin/bash "$CLONE/installation/studio.sh" installer 2>&1)
  else
    echec "studio : installation/studio.sh absent du dépôt"
  fi

  # ------------------------------------------------------------ installation d'essai : copies du head of content protégées
  # (simulation forcée) : envois vers GitHub impossibles, seul le dépôt nu local (installation/hoc-essai.sh).
  if [ -n "${CLIENT_SIMULATION_FORCEE:-}" ] && [ -f "$CLONE/installation/hoc-essai.sh" ]; then
    local lh
    while IFS= read -r lh; do
      case "$lh" in
        "OK "*) ok "${lh#OK }";; "INSTALLE "*) installe "${lh#INSTALLE }";; "ECHEC "*) echec "${lh#ECHEC }";;
      esac
    done < <(/bin/bash "$CLONE/installation/hoc-essai.sh" proteger 2>&1)
  fi

  # ------------------------------------------------------------ clés et code (posés par cles.sh, jamais ici)
  local manque=""
  grep -qs '^ELEVENLABS_API_KEY=..*' "$CLIENT_SONS/.env" || manque="$manque elevenlabs"
  # Installation d'essai (simulation forcée) : la clé de publication ne doit justement pas être là.
  if [ -n "${CLIENT_SIMULATION_FORCEE:-}" ]; then
    if [ -f "$BASE/zernio.env" ]; then echec "zernio : une clé de publication est posée dans une installation d'essai ($BASE/zernio.env), à retirer"
    else ok "zernio aucune clé de publication (installation d'essai, simulation forcée)"; fi
    # La clé de LECTURE des vrais chiffres (stats_reelles, cles.sh zernio-lecture) n'est pas une clé de publication.
    if [ -f "$BASE/zernio-lecture.env" ]; then
      chmod 600 "$BASE/zernio-lecture.env"
      if [ -n "${CLIENT_STATS_REELLES:-}" ]; then ok "zernio-lecture clé de lecture des chiffres posée (publication simulée)"
      else echec "zernio-lecture : clé de lecture posée pour un client qui ne lit pas de vrais chiffres ($BASE/zernio-lecture.env), à retirer"; fi
    fi
  else
    grep -qs '^ZERNIO_API_KEY=..*' "$BASE/zernio.env" || manque="$manque zernio"
  fi
  grep -qs '^CODE=..*' "$BASE/config" || manque="$manque code-montage"
  grep -qs '^CLAUDE_CODE_OAUTH_TOKEN=..*' "$BASE/claude.env" || manque="$manque connexion-claude"
  for f in "$CLIENT_SONS/.env" "$BASE/zernio.env" "$BASE/config" "$BASE/claude.env"; do [ -f "$f" ] && chmod 600 "$f"; done
  if [ -z "$manque" ]; then ok "cles elevenlabs,${CLIENT_SIMULATION_FORCEE:- zernio,} code du montage et connexion de Claude présents"
  else a_faire "CLES manquantes :$manque (lancer installation/cles.sh)"; fi

  # ------------------------------------------------------------ isolation de Claude (client isolé seulement)
  # Ce que voit une session du studio : ni la config Claude de l'utilisateur du Mac, ni un CLAUDE.md
  # hors de la racine. Preuve sans le modèle (installation/isolation.sh).
  if [ -n "$CLIENT_ISOLE" ] && [ -f "$CLONE/installation/isolation.sh" ]; then
    local iso
    iso="$(/bin/bash "$CLONE/installation/isolation.sh" --sortie "$BASE/isolation.md" 2>&1 | tail -1)"
    case "$iso" in
      "ISOLATION OK"*) ok "isolation sessions du studio isolées (preuve : $BASE/isolation.md)";;
      *) echec "isolation : ${iso:-pas de résultat} (preuve : $BASE/isolation.md)";;
    esac
  fi

  fin
  if [ "$nb_echec" -gt 0 ] || [ "$nb_faire" -gt 0 ]; then return 1; fi
  return 0
}

main "$@"; exit $?
