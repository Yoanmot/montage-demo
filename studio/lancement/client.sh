#!/bin/bash
# Le client du studio pour les scripts shell (à sourcer, ne se lance pas seul) : studio/clients/<id>.json
# (CONTRAT-STUDIO.md, section 7) lu une fois par python3 du système, rendu en variables CLIENT_*.
# Sourcé par commun.sh (donc demarrer.sh, ouvrir.sh, studio.sh, desinstaller-studio.sh) et par les scripts
# de installation/ (installer.sh, cles.sh, verifier.sh, mettre-a-jour.sh, isolation.sh).
#
# Quel client :
#   1. STUDIO_CLIENT=<id> s'il est posé ;
#   2. sinon l'id de <racine>/client.json, la racine étant le dossier qui contient la copie du dépôt
#      où vit ce fichier (<racine>/montage-demo/studio/lancement/client.sh) : un script lancé depuis une
#      installation sait à quel client elle appartient, sans variable (hook, service, Claude) ;
#   3. sinon « romain » (installations d'avant le multi-clients : rien ne change chez Romain).
# Le fichier lu : STUDIO_CLIENT_FICHIER (tests seulement), sinon studio/clients/<id>.json de cette copie,
# sinon la copie <racine>/client.json. Pour « romain » sans fichier, ses valeurs historiques.
#
# Variables rendues (chemins développés, ~ = $HOME) :
#   CLIENT_ID CLIENT_PRENOM CLIENT_CONTACT CLIENT_RACINE CLIENT_LABEL CLIENT_APPLI_NOM CLIENT_ICONE CLIENT_GIT_EMAIL
#   CLIENT_PORT CLIENT_THEME CLIENT_HOC_DEPOT CLIENT_CLE_SSH CLIENT_ZERNIO_COMPTE CLIENT_ZERNIO_PROFIL
#   CLIENT_SITE CLIENT_BRANCHE CLIENT_CONFIG_CLAUDE (vide si null) CLIENT_FICHIER
#   CLIENT_SKILL_CARROUSEL  le skill de mise en page des carrousels (skills/<nom>), relié sous le nom
#                    « carrousel » : skill_carrousel du fichier, sinon carrousel (celui de Romain)
#   CLIENT_MONTEUR   l'agent monteur du client (agents/<nom>.md), relié sous le nom « monteur » : monteur du fichier,
#                    sinon monteur (celui de Romain). Les skills qui portent un fichier CLIENT (son id dedans) ne sont
#                    reliés que chez ce client.
#   CLIENT_CLAUDE    dossier de config Claude effectif : config_claude, sinon ~/.claude (Romain)
#   CLIENT_ISOLE     1 si config_claude est posé : tout ce que l'installation écrit reste dans la racine
#   CLIENT_SONS      dossier de la clé et du cache ElevenLabs : ~/.config/monteur-romain (Romain),
#                    <racine>/monteur sinon (même forme : .env et sons-generes/)
#   CLIENT_HOOK      commande du hook SessionStart de mise à jour (texte exact, comparé par l'installeur)
#   CLIENT_PREVENIR  « Envoie un message à <contact>. » ou vide
#   CLIENT_POLICES   polices que le dépôt public ne peut pas contenir (licence), une par ligne « nom<TAB>fichier source » :
#                    polices_locales du fichier ({ "<nom>.woff2": "<fichier chez le client>" }), posées par
#                    studio_poser_polices dans <racine>/studio/polices/ (servies par le studio, repli du thème sinon)
#   CLIENT_SIMULATION_FORCEE  1 si simulation_forcee est vrai (installation d'essai : rien ne peut partir sur
#                    Instagram, aucune clé de publication ; voir demarrer.sh, cles.sh, verifier.sh)
#   CLIENT_STATS_REELLES  le compte de zernio.py (COMPTES) dont une installation d'essai lit les vrais chiffres, ou vide :
#                    stats_reelles.compte du fichier. Clé de LECTURE seulement, dans <racine>/zernio-lecture.env
#                    (cles.sh zernio-lecture), passée au seul appel `zernio.py stats` du studio ; la publication reste
#                    simulée (voir serveur/stats.mjs, verifier.sh)
#
# Branche suivie : branche_mise_a_jour du fichier, sauf si <racine>/branche existe (une ligne, le nom d'une
# branche du dépôt) : une installation d'essai suit une branche pas encore livrée. Retirer le fichier pour
# revenir à celle du client (puis installation/mettre-a-jour.sh).

studio_client_charger() {
  local ici clone racine_supposee id fichier
  ici="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  clone="$(cd "$ici/../.." && pwd)"
  racine_supposee="$(dirname "$clone")"
  id="${STUDIO_CLIENT:-}"
  if [ -z "$id" ] && [ -f "$racine_supposee/client.json" ]; then
    id="$(/usr/bin/python3 -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8")).get("id") or "")' "$racine_supposee/client.json" 2>/dev/null)"
  fi
  id="${id:-romain}"
  fichier="${STUDIO_CLIENT_FICHIER:-}"
  if [ -z "$fichier" ]; then
    if [ -f "$clone/studio/clients/$id.json" ]; then fichier="$clone/studio/clients/$id.json"
    elif [ -f "$racine_supposee/client.json" ]; then fichier="$racine_supposee/client.json"; fi
  fi
  local sortie
  sortie="$(/usr/bin/python3 - "$id" "${fichier:-}" "$HOME" "$clone" <<'PYEOF'
import json, os, shlex, sys
ident, fichier, maison, clone = sys.argv[1:5]
ROMAIN = {
    "id": "romain", "prenom": "Romain", "contact": "Yoan", "racine": "~/.montage-yoan",
    "label_launchd": "com.montage-yoan.studio", "appli": {"nom": "Studio", "icone": "romain"},
    "port": 4747, "theme": "romain",
    "head_of_content": {"depot": "git@github.com:Yoanmot/head-of-content-romain.git",
                        "cle_ssh": "~/.ssh/fitavecromain_head_of_content"},
    "zernio": {"compte": "fitavecromain", "profil": None}, "ressources": {"site": None},
    "branche_mise_a_jour": "main", "config_claude": None, "skill_carrousel": "carrousel",
}
if fichier:
    try:
        c = json.load(open(fichier, encoding="utf-8"))
    except Exception as e:
        print("CLIENT_ERREUR=%s" % shlex.quote("fichier du client illisible : %s (%s)" % (fichier, e))); sys.exit(0)
elif ident == "romain":
    c = ROMAIN
else:
    print("CLIENT_ERREUR=%s" % shlex.quote("client inconnu : %s (pas de studio/clients/%s.json)" % (ident, ident))); sys.exit(0)
if c.get("id") != ident:
    print("CLIENT_ERREUR=%s" % shlex.quote("le fichier %s annonce le client %s, pas %s" % (fichier, c.get("id"), ident))); sys.exit(0)
def g(*cles, defaut=None):
    v = c
    for k in cles:
        v = v.get(k) if isinstance(v, dict) else None
    return defaut if v in (None, "") else v
def deplier(p):
    if not p: return ""
    p = str(p)
    if p == "~": return maison
    if p.startswith("~/"): return os.path.join(maison, p[2:])
    return os.path.abspath(p)
racine = deplier(g("racine", defaut="~/.studio-%s" % ident))
config = deplier(g("config_claude")) if g("config_claude") else ""
# L'icône : chemin, ou nom posé dans studio/lancement/icones/<nom>.icns ; l'icône historique sinon.
lanc = os.path.join(clone, "studio", "lancement")
ic = g("appli", "icone", defaut="")
icone = ""
for essai in ([ic] if os.path.isabs(str(ic)) else [os.path.join(clone, str(ic)), os.path.join(lanc, str(ic)),
              os.path.join(lanc, "icones", "%s.icns" % ic)]) if ic else []:
    if os.path.isfile(essai): icone = essai; break
if not icone and (ic in ("", "romain")): icone = os.path.join(lanc, "icone.icns")
hook = ('/bin/bash "$HOME/.montage-yoan/montage-demo/installation/mettre-a-jour.sh" --hook' if racine == os.path.join(maison, ".montage-yoan")
        else '/bin/bash "%s/montage-demo/installation/mettre-a-jour.sh" --hook' % racine)
contact = g("contact", defaut="")
branche = g("branche_mise_a_jour", defaut="main")
try:
    with open(os.path.join(racine, "branche"), encoding="utf-8") as f:
        b = f.read().strip()
    if b and all(ch.isalnum() or ch in "-_./" for ch in b) and not b.startswith("-"):
        branche = b
except OSError:
    pass
v = {
    "CLIENT_ID": ident, "CLIENT_FICHIER": fichier or "(valeurs historiques de Romain)",
    "CLIENT_PRENOM": g("prenom", defaut=""), "CLIENT_CONTACT": contact,
    "CLIENT_RACINE": racine, "CLIENT_LABEL": g("label_launchd", defaut="com.studio-%s.studio" % ident),
    "CLIENT_APPLI_NOM": g("appli", "nom", defaut="Studio"), "CLIENT_ICONE": icone,
    "CLIENT_PORT": str(g("port", defaut=4747)), "CLIENT_THEME": g("theme", defaut=ident),
    "CLIENT_HOC_DEPOT": g("head_of_content", "depot", defaut=""),
    "CLIENT_GIT_EMAIL": g("head_of_content", "email_commits", defaut="mac-%s@users.noreply.github.com" % ident),
    "CLIENT_CLE_SSH": deplier(g("head_of_content", "cle_ssh", defaut="")),
    "CLIENT_ZERNIO_COMPTE": g("zernio", "compte", defaut=""), "CLIENT_ZERNIO_PROFIL": g("zernio", "profil", defaut=""),
    "CLIENT_SITE": g("ressources", "site", defaut=""), "CLIENT_BRANCHE": branche,
    "CLIENT_CONFIG_CLAUDE": config, "CLIENT_CLAUDE": config or os.path.join(maison, ".claude"),
    "CLIENT_ISOLE": "1" if config else "",
    "CLIENT_SONS": os.path.join(racine, "monteur") if config else os.path.join(maison, ".config", "monteur-romain"),
    "CLIENT_HOOK": hook,
    "CLIENT_SKILL_CARROUSEL": g("skill_carrousel", defaut="carrousel"),
    "CLIENT_MONTEUR": g("monteur", defaut="monteur"),
    "CLIENT_PREVENIR": ("Envoie un message à %s." % contact) if contact else "",
    "CLIENT_SIMULATION_FORCEE": "1" if c.get("simulation_forcee") is True else "",
    "CLIENT_STATS_REELLES": (lambda x: x if isinstance(x, str) and x.isalnum() else "")(g("stats_reelles", "compte", defaut="")),
    "CLIENT_POLICES": "\n".join("%s\t%s" % (n, deplier(src)) for n, src in sorted((c.get("polices_locales") or {}).items())
        if isinstance(src, str) and src and all(ch.isalnum() or ch in "._-" for ch in n) and n[0].isalnum()
        and n.lower().endswith((".woff2", ".woff", ".ttf", ".otf"))),
}
for k, x in v.items():
    print("%s=%s" % (k, shlex.quote(str(x))))
PYEOF
)" || sortie="CLIENT_ERREUR='python3 du système introuvable'"
  CLIENT_ERREUR=""
  eval "$sortie"
  [ -z "$CLIENT_ERREUR" ]
}

# Pose les polices locales du client (CLIENT_POLICES) dans <dossier>/polices (le STUDIO_HOME). Copie seulement si le
# fichier a changé ; source absente : rien (le thème retombe sur sa police de repli), une ligne POLICE_ABSENTE.
# Rend 0 toujours ; écrit une ligne par police sur la sortie (POLICE_POSEE, POLICE_A_JOUR, POLICE_ABSENTE).
studio_poser_polices() {
  local dossier="$1" nom src
  [ -n "${CLIENT_POLICES:-}" ] && [ -n "$dossier" ] || return 0
  while IFS="$(printf '\t')" read -r nom src; do
    [ -n "$nom" ] || continue
    if [ ! -f "$src" ]; then echo "POLICE_ABSENTE $nom ($src)"; continue; fi
    mkdir -p "$dossier/polices" || return 0
    if [ -f "$dossier/polices/$nom" ] && cmp -s "$src" "$dossier/polices/$nom"; then echo "POLICE_A_JOUR $nom"; continue; fi
    cp "$src" "$dossier/polices/.$nom.tmp" && mv -f "$dossier/polices/.$nom.tmp" "$dossier/polices/$nom" && echo "POLICE_POSEE $nom"
  done <<EOF_POLICES
$CLIENT_POLICES
EOF_POLICES
  return 0
}

# Pose CLAUDE_CONFIG_DIR pour les commandes claude lancées ensuite (rien chez Romain : ~/.claude).
studio_client_env_claude() {
  if [ -n "${CLIENT_CONFIG_CLAUDE:-}" ]; then export CLAUDE_CONFIG_DIR="$CLIENT_CONFIG_CLAUDE"; fi
}
