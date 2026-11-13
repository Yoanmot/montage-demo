#!/bin/bash
# Installation (ou réinstallation) du monteur et des carrousels de Romain sur un Mac.
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
# Variables pour les tests de Yoan seulement : MONTAGE_DEPOT_URL, HOC_DEPOT_URL.
# Aucune clé dans ce fichier : les clés se posent avec installation/cles.sh.

main() {
  set -u
  export GIT_TERMINAL_PROMPT=0 HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_ENV_HINTS=1
  local BASE="$HOME/.montage-yoan"
  local CLONE="$BASE/montage-demo"
  local HOC="$BASE/head-of-content"
  local DEPOT_URL="${MONTAGE_DEPOT_URL:-https://github.com/Yoanmot/montage-demo.git}"
  local HOC_URL="${HOC_DEPOT_URL:-git@github.com:Yoanmot/head-of-content-romain.git}"
  local CLE_HOC="$HOME/.ssh/fitavecromain_head_of_content"
  local SKILLS="$HOME/.claude/skills"
  local PWSH_VERSION="7.4.6"
  local HYPERFRAMES="hyperframes@0.7.55"
  local PY=/usr/bin/python3
  local nb_ok=0 nb_faire=0 nb_echec=0 code_sortie=0
  mkdir -p "$BASE/bin"

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
      a_faire "HOMEBREW il manque $1 et Homebrew n'est pas sur ce Mac : Romain colle dans l'app Terminal la commande d'installation de https://brew.sh (elle demande le mot de passe du Mac), suit les 2 lignes « Next steps » qu'elle affiche, puis on relance ce script"
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
      if [ -z "$encore" ]; then installe "python-modules$manquants"; else echec "python-modules : toujours absents :$encore (journal ~/.montage-yoan/pip.log)"; fi
    else
      echec "python-modules : pip a échoué pour$manquants (journal ~/.montage-yoan/pip.log)"
    fi
  fi

  # ------------------------------------------------------------ PowerShell (skill carrousel seulement), version portable
  local ps=""
  ps="$(command -v pwsh 2>/dev/null || true)"
  if [ -n "$ps" ] && "$ps" -NoProfile -Command '$PSVersionTable.PSVersion.Major' >/dev/null 2>&1; then
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
    if git -C "$CLONE" fetch -q origin main && git -C "$CLONE" reset -q --hard origin/main; then ok "depot-monteur $(git -C "$CLONE" rev-parse --short HEAD)"
    else echec "depot-monteur : mise à jour impossible (connexion ?)"; fi
  else
    if git clone -q --branch main "$DEPOT_URL" "$CLONE"; then installe "depot-monteur $(git -C "$CLONE" rev-parse --short HEAD)"
    else echec "depot-monteur : téléchargement impossible ($DEPOT_URL)"; fin; return 1; fi
  fi

  # Ce qui a été retiré du dépôt : l'ancien skill montage, le skill du plugin, rangés (jamais effacés).
  local stamp vieux
  stamp="$(date +%Y%m%d-%H%M%S)"
  for vieux in montage monter; do
    if [ -e "$SKILLS/$vieux" ] || [ -L "$SKILLS/$vieux" ]; then
      mkdir -p "$BASE/anciennes-versions/$stamp/skills"
      mv "$SKILLS/$vieux" "$BASE/anciennes-versions/$stamp/skills/$vieux"
      installe "retrait skills/$vieux (rangé dans ~/.montage-yoan/anciennes-versions/$stamp)"
    fi
  done
  # Le plugin « montage » (marketplace yoan-montage), s'il avait été ajouté.
  if grep -qs "yoan-montage" "$HOME/.claude/plugins/installed_plugins.json" "$HOME/.claude/plugins/known_marketplaces.json" "$HOME/.claude/settings.json"; then
    local cli="${CLAUDE_CODE_EXECPATH:-$(command -v claude 2>/dev/null || true)}"
    if [ -n "$cli" ] && [ -x "$cli" ]; then
      "$cli" plugin uninstall montage@yoan-montage >/dev/null 2>&1 || true
      "$cli" plugin marketplace remove yoan-montage >/dev/null 2>&1 || true
    fi
    "$PY" - "$HOME/.claude/settings.json" <<'PYEOF' || true
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
    if grep -qs "yoan-montage" "$HOME/.claude/plugins/installed_plugins.json" "$HOME/.claude/settings.json"; then
      a_faire "PLUGIN_MONTAGE l'ancien plugin montage est encore listé : dans Claude, taper /plugin, onglet Installed, retirer « montage »"
    else
      installe "retrait plugin montage@yoan-montage"
    fi
  fi

  # Liens des skills et de l'agent (les anciennes copies sont rangées, leurs goûts appris gardés).
  if /bin/bash "$CLONE/installation/mettre-a-jour.sh" --liens-installation > "$BASE/liens.log" 2>&1; then
    local nl
    nl="$(ls -1 "$CLONE/skills" | wc -l | tr -d ' ')"
    ok "skills $nl skills reliés à ~/.claude/skills, agent monteur relié ($(grep -c -E '^(AJOUTE|REMPLACE|LIEN_REFAIT|RETIRE)' "$BASE/liens.log") changements)"
    grep -E '^(GARDE|REMPLACE|RETIRE|IGNORE)' "$BASE/liens.log" | sed 's/^/  /'
  else
    echec "skills : les liens n'ont pas pu être posés (journal ~/.montage-yoan/liens.log)"
  fi

  # Mémoire du monteur : les modèles seulement s'ils manquent (jamais écrasée).
  local MEM="$HOME/.claude/agent-memory/monteur" m nm=0
  mkdir -p "$MEM"
  for m in "$CLONE"/agents/monteur-memoire/*.md; do
    [ -f "$MEM/$(basename "$m")" ] || { cp "$m" "$MEM/"; nm=$((nm + 1)); }
  done
  ok "memoire-monteur ($nm modèles posés, rien d'écrasé)"

  # Mise à jour automatique : hook SessionStart dans ~/.claude/settings.json.
  local hook_res
  hook_res="$("$PY" - "$HOME/.claude/settings.json" <<'PYEOF'
import json, os, sys
p = sys.argv[1]
cmd = '/bin/bash "$HOME/.montage-yoan/montage-demo/installation/mettre-a-jour.sh" --hook'
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
    else echec "hyperframes : téléchargement impossible (journal ~/.montage-yoan/hyperframes.log)"; fi
  else
    echec "hyperframes : npx absent (Node manque)"
  fi

  # ------------------------------------------------------------ copie du head of content (carrousels, publication)
  if [ ! -f "$CLE_HOC" ]; then
    mkdir -p "$HOME/.ssh"; chmod 700 "$HOME/.ssh"
    ssh-keygen -q -t ed25519 -N "" -C "mac-romain-head-of-content" -f "$CLE_HOC" >/dev/null 2>&1 \
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
      git -C "$HOC" config user.name "Mac de Romain"
      git -C "$HOC" config user.email "mac-romain@users.noreply.github.com"
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

  # ------------------------------------------------------------ clés et code (posés par cles.sh, jamais ici)
  local manque=""
  grep -qs '^ELEVENLABS_API_KEY=..*' "$HOME/.config/monteur-romain/.env" || manque="$manque elevenlabs"
  grep -qs '^ZERNIO_API_KEY=..*' "$BASE/zernio.env" || manque="$manque zernio"
  grep -qs '^CODE=..*' "$BASE/config" || manque="$manque code-montage"
  for f in "$HOME/.config/monteur-romain/.env" "$BASE/zernio.env" "$BASE/config"; do [ -f "$f" ] && chmod 600 "$f"; done
  if [ -z "$manque" ]; then ok "cles elevenlabs, zernio et code du montage présents"
  else a_faire "CLES manquantes :$manque (lancer installation/cles.sh)"; fi

  fin
  if [ "$nb_echec" -gt 0 ] || [ "$nb_faire" -gt 0 ]; then return 1; fi
  return 0
}

main "$@"; exit $?
