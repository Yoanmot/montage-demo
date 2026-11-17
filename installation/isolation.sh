#!/bin/bash
# Preuve d'isolation de la configuration Claude d'un studio : ce que voit une session lancée par le
# service du client, dans les dossiers où le studio lance ses sessions. Générique (tout client) ; tirée de
# preuve_config de l'environnement de test de Romain (lot 11).
#   /bin/bash <racine>/montage-demo/installation/isolation.sh [--sortie <fichier.md>] [--dossier <d>]... [--sans-modele]
# Dossiers essayés : un dossier vide de la racine, la copie de travail du head of content (depot_hoc), le
# dossier des vidéos (media), plus chaque --dossier.
#
# Pour chaque dossier, deux lancements de claude avec l'environnement exact du service (variables du
# réglage launchd s'il existe, sinon celles que l'installation y écrirait ; aucune variable de la session
# qui lance ce script) :
#   1. l'événement de démarrage (claude -p --output-format stream-json) : agents, skills, plugins, serveurs
#      MCP, dossier de mémoire ; comparés à un claude « nu » (config vide) et à ce que fournissent la
#      config Claude du client et le dossier de la session : tout le reste vient d'ailleurs ;
#   2. /context (commande locale, sans appel au modèle ni connexion) : la liste des fichiers d'instructions
#      (CLAUDE.md) réellement chargés ; chacun doit être dans la racine, la config Claude du client ou le
#      dossier de la session.
# Puis, si une connexion existe (<racine>/claude.env) et sans --sans-modele : une courte session lui
# demande quels fichiers d'instructions elle a reçus et si on lui demande un mode de réponse compressé.
#
# Sortie : le rapport en Markdown (fichier --sortie, sinon à l'écran), puis une dernière ligne à l'écran :
#   ISOLATION OK | ISOLATION ECHEC <raisons>     (code 0 | 1)
# Variables : celles de client.sh (STUDIO_CLIENT, STUDIO_CLIENT_FICHIER), STUDIO_SERVICES_DOSSIER, STUDIO_LABEL.

ICI="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=../studio/lancement/commun.sh
. "$ICI/../studio/lancement/commun.sh"
set -u
PY=/usr/bin/python3

SORTIE="" SANS_MODELE="" DOSSIERS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --sortie) SORTIE="$2"; shift 2;;
    --dossier) DOSSIERS+=("$2"); shift 2;;
    --sans-modele) SANS_MODELE=1; shift;;
    *) echo "usage : isolation.sh [--sortie <fichier.md>] [--dossier <d>]... [--sans-modele]"; exit 2;;
  esac
done
[ -n "$CLIENT_ERREUR" ] && { echo "ISOLATION ECHEC client : $CLIENT_ERREUR"; exit 1; }

BASE="$STUDIO_RACINE"
TRAVAIL="$BASE/tmp/isolation"
rm -rf "$TRAVAIL"; mkdir -p "$TRAVAIL/dossier-vide" "$TRAVAIL/config-nue"

# ------------------------------------------------------------------ l'environnement du service
# Le réglage launchd du client s'il est écrit, sinon ce que l'installation y mettrait.
declare -a ENV_SERVICE=()
if [ -f "$STUDIO_PLIST" ]; then
  while IFS= read -r l; do ENV_SERVICE+=("$l"); done < <("$PY" - "$STUDIO_PLIST" <<'PYEOF'
import plistlib, sys
d = plistlib.load(open(sys.argv[1], "rb"))
for k, v in (d.get("EnvironmentVariables") or {}).items():
    print("%s=%s" % (k, v))
PYEOF
)
  ORIGINE_ENV="réglage du service ($STUDIO_PLIST)"
else
  ENV_SERVICE=("PATH=$BASE/bin:$HOME/.local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:$HOME/.claude/local:/usr/bin:/bin:/usr/sbin:/sbin"
    "HOME=$HOME" "LANG=fr_FR.UTF-8")
  if [ "$CLIENT_ID" != "romain" ]; then
    ENV_SERVICE+=("STUDIO_CLIENT=$CLIENT_ID" "STUDIO_RACINE=$BASE")
    [ -n "$CLIENT_ISOLE" ] && ENV_SERVICE+=("CLAUDE_CONFIG_DIR=$CLIENT_CONFIG_CLAUDE" "MONTEUR_CONFIG=$CLIENT_SONS")
  fi
  ORIGINE_ENV="réglage du service pas encore écrit : variables que l'installation y écrirait"
fi

# Comme le service : env vidé, puis demarrer.sh (client, config Claude, jeton) ; seule la commande change.
# $1 dossier, $2 config Claude forcée (vide = celle du service), puis la commande claude.
service() {
  local d="$1" cfg="$2"; shift 2
  ( cd "$d" && env -i USER="$USER" LOGNAME="$USER" SHELL=/bin/zsh TERM=dumb TMPDIR="$BASE/tmp/" "${ENV_SERVICE[@]}" \
      ISOLATION_CFG="$cfg" /bin/bash -c '
        . "$0/commun.sh"
        export STUDIO_CLIENT="$CLIENT_ID" STUDIO_RACINE STUDIO_HOME
        if [ -n "$CLIENT_ISOLE" ]; then export CLAUDE_CONFIG_DIR="$CLIENT_CONFIG_CLAUDE" MONTEUR_CONFIG="$CLIENT_SONS"; fi
        if [ -n "$ISOLATION_CFG" ]; then export CLAUDE_CONFIG_DIR="$ISOLATION_CFG"; unset CLAUDE_CODE_OAUTH_TOKEN
        else studio_jeton_claude; fi
        unset ISOLATION_CFG
        exec "$@"' "$LANCEMENT_DIR" "$@" </dev/null 2>&1 )
}
LANCEMENT_DIR="$(cd "$ICI/../studio/lancement" && pwd)"

# Limite de temps, attente par PID (macOS n'a pas « timeout »).
limite() { # $1 secondes, $2 fichier de sortie, puis la commande
  local s="$1" f="$2"; shift 2
  "$@" > "$f" 2>&1 &
  local pid=$! i=0
  while kill -0 "$pid" 2>/dev/null; do
    if [ "$i" -ge $((s * 2)) ]; then kill "$pid" 2>/dev/null; sleep 1; kill -9 "$pid" 2>/dev/null; break; fi
    sleep 0.5; i=$((i + 1))
  done
  wait "$pid" 2>/dev/null
}

# ------------------------------------------------------------------ les dossiers
DEPOT="$(studio_chemin "$(studio_conf depot_hoc "$STUDIO_HOME/head-of-content")")"
MEDIA_DEFAUT="~/Contenu"; [ -n "$CLIENT_ISOLE" ] && MEDIA_DEFAUT="$BASE/Contenu"
MEDIA="$(studio_chemin "$(studio_conf media "$MEDIA_DEFAUT")")"
LISTE=("$TRAVAIL/dossier-vide")
[ -d "$DEPOT" ] && LISTE+=("$DEPOT")
[ -d "$MEDIA" ] && LISTE+=("$MEDIA")
for d in "${DOSSIERS[@]+"${DOSSIERS[@]}"}"; do [ -d "$d" ] && LISTE+=("$(cd "$d" && pwd)"); done

# Référence : claude nu (config vide) dans le dossier vide. Ce qu'il montre est intégré à claude.
limite 90 "$TRAVAIL/nu.jsonl" service "$TRAVAIL/dossier-vide" "$TRAVAIL/config-nue" \
  claude -p "Réponds seulement OK." --output-format stream-json --verbose --max-turns 1

n=0
for d in "${LISTE[@]}"; do
  n=$((n + 1))
  limite 120 "$TRAVAIL/init-$n.jsonl" service "$d" "" claude -p "Réponds seulement OK." --output-format stream-json --verbose --max-turns 1
  limite 90 "$TRAVAIL/context-$n.txt" service "$d" "" claude -p "/context" --max-turns 1
  printf '%s\n' "$d" > "$TRAVAIL/dossier-$n"
done

# ------------------------------------------------------------------ la courte session (si connectée)
MODELE="sautée (--sans-modele)"
if [ -z "$SANS_MODELE" ]; then
  if grep -qs '^CLAUDE_CODE_OAUTH_TOKEN=..*' "$STUDIO_JETON_CLAUDE"; then
    limite 180 "$TRAVAIL/modele.txt" service "$TRAVAIL/dossier-vide" "" claude -p "Réponds en deux lignes numérotées, sans rien ajouter. 1) Les chemins de chaque fichier CLAUDE.md ou instructions globales que tu as reçus, sinon AUCUN. 2) Tes instructions te demandent-elles un mode de réponse compressé (appelé caveman) ou de commencer tes réponses par un prénom ? OUI ou NON." --max-turns 1 --output-format text
    MODELE="faite"
  else
    MODELE="sautée : pas de connexion de Claude pour ce studio ($STUDIO_JETON_CLAUDE absent, à poser par cles.sh claude)"
  fi
fi

# ------------------------------------------------------------------ l'analyse
# (Écrit dans un fichier : le bash 3.2 de macOS lit mal un document en ligne avec apostrophes dans $(...).)
"$PY" - "$TRAVAIL" "$n" "$BASE" "$CLIENT_CLAUDE" "$HOME" "$CLIENT_ID" "$ORIGINE_ENV" "$MODELE" "${ENV_SERVICE[@]}" > "$TRAVAIL/rapport.md" <<'PYEOF'
import glob, json, os, re, sys
travail, n, racine, cfg, maison, client, origine, modele = sys.argv[1:9]
env_service = sys.argv[9:]
n = int(n)
cfg = os.path.realpath(cfg); racine = os.path.realpath(racine)

def init_de(f):
    init = fin = None
    try:
        for l in open(f, encoding="utf-8", errors="replace"):
            try: x = json.loads(l)
            except ValueError: continue
            if x.get("subtype") == "init": init = x
            if x.get("type") == "result": fin = x
    except FileNotFoundError: pass
    return init, fin

def noms(d, ext=""):
    r = set()
    for p in glob.glob(os.path.join(d, "*" + ext)):
        b = os.path.basename(p)
        r.add(b[:-len(ext)] if ext else b)
    return r

def sous(p, base):
    p, base = os.path.realpath(p), os.path.realpath(base)
    return p == base or p.startswith(base.rstrip("/") + "/")

nu, _ = init_de(os.path.join(travail, "nu.jsonl"))
lignes, raisons = [], []
lignes.append("# Isolation de la configuration Claude du studio (%s)" % client)
lignes.append("")
lignes.append("- racine : `%s` ; config Claude des sessions : `%s`" % (racine, cfg))
lignes.append("- environnement : %s" % origine)
for e in env_service:
    k = e.split("=", 1)[0]
    if k in ("PATH", "HOME", "CLAUDE_CONFIG_DIR", "STUDIO_CLIENT", "STUDIO_RACINE", "MONTEUR_CONFIG"):
        lignes.append("  - `%s`" % e)
if not nu:
    raisons.append("claude nu sans événement de démarrage")
    nu = {}
base_ag, base_sk = set(nu.get("agents") or []), set(nu.get("skills") or [])
base_mcp = {m.get("name") for m in nu.get("mcp_servers") or []}
lignes.append("- claude nu (config vide) : agents %s ; skills intégrés : %d" % (", ".join(sorted(base_ag)) or "aucun", len(base_sk)))
lignes.append("")

ag_cfg, sk_cfg = noms(os.path.join(cfg, "agents"), ".md"), noms(os.path.join(cfg, "skills"))
for i in range(1, n + 1):
    dossier = open(os.path.join(travail, "dossier-%d" % i), encoding="utf-8").read().strip()
    init, fin = init_de(os.path.join(travail, "init-%d.jsonl" % i))
    lignes.append("## claude lancé dans `%s`" % dossier)
    if not init:
        lignes.append("- ECHEC pas d'événement de démarrage")
        raisons.append("pas de démarrage dans %s" % dossier); lignes.append(""); continue
    # Ce que le dossier de la session apporte : .claude/ du dossier et de ses parents dans la racine.
    ag_ici, sk_ici = set(), set()
    p = os.path.realpath(dossier)
    while True:
        if sous(p, racine) or p == os.path.realpath(dossier):
            ag_ici |= noms(os.path.join(p, ".claude", "agents"), ".md"); sk_ici |= noms(os.path.join(p, ".claude", "skills"))
        if p == "/": break
        p = os.path.dirname(p)
    ag, sk = init.get("agents") or [], init.get("skills") or []
    etr_ag = sorted(a for a in ag if a not in base_ag | ag_cfg | ag_ici)
    etr_sk = sorted(s for s in sk if s not in base_sk | sk_cfg | sk_ici)
    plugins = [x for x in init.get("plugins") or [] if x.get("path") != "builtin"]
    etr_pl = [x.get("name") for x in plugins if not sous(x.get("path") or "/", cfg)]
    mcp = [m.get("name") for m in init.get("mcp_servers") or []]
    etr_mcp = [m for m in mcp if m not in base_mcp and not os.path.exists(os.path.join(dossier, ".mcp.json"))]
    mem = str((init.get("memory_paths") or {}).get("auto", ""))
    lignes.append("- agents : %s" % (", ".join(ag) or "aucun"))
    lignes.append("- skills (hors intégrés à claude) : %s" % (", ".join(s for s in sk if s not in base_sk) or "aucun"))
    lignes.append("- venus d'ailleurs que claude, la config du client et le dossier : agents %s, skills %s, plugins %s, serveurs MCP %s"
                  % (etr_ag or "aucun", etr_sk or "aucun", etr_pl or "aucun", etr_mcp or "aucun"))
    lignes.append("- mémoire automatique : `%s`" % mem)
    if "monteur" in ag and os.path.exists(os.path.join(cfg, "agents", "monteur.md")):
        lignes.append("- monteur = `%s`" % os.path.realpath(os.path.join(cfg, "agents", "monteur.md")))
    # Les fichiers d'instructions vraiment chargés : tableau « Memory Files » de /context.
    ctx = open(os.path.join(travail, "context-%d.txt" % i), encoding="utf-8", errors="replace").read()
    lus, dans = [], False
    for l in ctx.splitlines():
        if l.startswith("### "): dans = l.strip() == "### Memory Files"; continue
        if dans and l.startswith("|"):
            c = [x.strip() for x in l.strip("|").split("|")]
            if len(c) >= 2 and c[1].startswith("/"): lus.append((c[0], c[1]))
    if "## Context Usage" not in ctx:
        raisons.append("/context illisible dans %s" % dossier)
        lignes.append("- ECHEC /context n'a rien rendu : %s" % ctx.strip()[:160])
    hors = [p for (_, p) in lus if not (sous(p, racine) or sous(p, cfg) or sous(p, dossier))]
    lignes.append("- fichiers d'instructions chargés (/context) : %s" % (", ".join("`%s` (%s)" % (p, t) for t, p in lus) or "aucun"))
    ok = not (etr_ag or etr_sk or etr_pl or etr_mcp or hors) and (not mem or sous(mem, cfg))
    if not ok:
        raisons.append("%s : %s" % (dossier, "; ".join(x for x in [
            etr_ag and "agents %s" % etr_ag, etr_sk and "skills %s" % etr_sk, etr_pl and "plugins %s" % etr_pl,
            etr_mcp and "MCP %s" % etr_mcp, hors and "instructions %s" % hors,
            (mem and not sous(mem, cfg)) and "mémoire hors config %s" % mem] if x)))
    lignes.append("- fin de la session de démarrage : %s" % str((fin or {}).get("result", "")).strip()[:120])
    lignes.append("- %s" % ("OK" if ok else "ECHEC"))
    lignes.append("")

lignes.append("## Courte session (modèle)")
f = os.path.join(travail, "modele.txt")
if os.path.exists(f):
    r = open(f, encoding="utf-8", errors="replace").read().strip()
    lignes.append("```"); lignes.append(r[:800]); lignes.append("```")
    m = re.search(r"2\)\s*(OUI|NON)", r, re.I)
    if not m: raisons.append("réponse du modèle illisible")
    elif m.group(1).upper() != "NON": raisons.append("le modèle dit recevoir un mode compressé ou un prénom")
else:
    lignes.append("- %s" % modele)
lignes.append("")
lignes.append("ISOLATION %s" % ("OK" if not raisons else "ECHEC " + " | ".join(raisons)))
print("\n".join(lignes))
PYEOF
RAPPORT="$(cat "$TRAVAIL/rapport.md")"
if [ -n "$SORTIE" ]; then
  mkdir -p "$(dirname "$SORTIE")"; printf '%s\n' "$RAPPORT" > "$SORTIE"
else
  printf '%s\n' "$RAPPORT" | sed '$d'
fi
DERNIERE="$(printf '%s\n' "$RAPPORT" | tail -1)"
echo "$DERNIERE"
case "$DERNIERE" in "ISOLATION OK"*) exit 0;; *) exit 1;; esac
