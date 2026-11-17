#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ce qui attend d'être rendu sur le Mac de Romain, et ce qui est déjà fait.

Le head of content (dans le cloud) écrit les textes validés dans son dépôt, sous a-rendre/<type>/.
Ce script, sur le Mac, tient l'état « fait » à la place du modèle : il ne dépend ni de sa mémoire
ni de sa discipline.

    a-rendre.py attente  [--type carrousels]   récupère le dépôt, range ce qui est déjà fait, liste le reste
    a-rendre.py prepare  <slug> [--type ...]   prépare le dossier de sortie (texte validé, empreinte)
    a-rendre.py termine  <slug> [--type ...]   enregistre le rendu, sort le texte de la liste, envoie
    a-rendre.py cle                            crée (une fois) la clé d'accès du Mac et l'affiche
    a-rendre.py verifier                       teste l'accès au dépôt

L'état vit à deux endroits qui se recoupent :
  1. le registre du dépôt, rendus/registre.json (lu aussi par le head of content dans le cloud) ;
  2. les preuves sur le disque : le dossier de sortie (marqueur .a-rendre.json + fichiers rendus
     plus récents que lui) et le journal local ~/.montage-yoan/rendus-journal.json.
Si termine est oublié, ou si l'envoi échoue, attente retrouve le rendu par les preuves et le range.

Une correction de texte faite sur le Mac pendant la mise en page (dans carrousel.json) est reportée
dans le texte du head of content au moment où il est rangé : rendus/<type>/<slug>.md porte le texte
tel qu'il a été rendu, avec une ligne « Corrigé sur le Mac », et le registre son empreinte.

Python 3.9 et bibliothèque standard seulement (le Python fourni avec les outils de développement
d'Apple, qui fournissent aussi git).

Codes de sortie : 0 ok · 2 usage · 20 accès au dépôt à configurer · 21 hors ligne sans copie locale
                  22 outil manquant · 30 aucun rendu trouvé · 31 texte introuvable · 32 texte illisible
"""
import datetime
import fnmatch
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time

HOME = os.path.expanduser("~")


def _racine():
    """La racine du studio du client : STUDIO_RACINE (service, sessions), sinon celle de l'installation qui
    contient ce script (<racine>/montage-demo/skills/carrousels-en-attente/scripts, avec <racine>/client.json
    posé par l'installeur pour un autre client que Romain). None chez Romain : ~/.montage-yoan."""
    r = os.environ.get("STUDIO_RACINE")
    if r:
        return r
    r = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.realpath(__file__))))))
    return r if os.path.isfile(os.path.join(r, "client.json")) else None


RACINE = _racine()
BASE = RACINE or os.path.join(HOME, ".montage-yoan")
DEPOT = os.environ.get("RENDUS_DEPOT") or os.path.join(BASE, "head-of-content")

def _client():
    """Le client du studio : <racine>/client.json, posé par l'installeur pour un autre client que
    Romain (studio/clients/<id>.json). Romain n'en a pas : ses valeurs historiques."""
    try:
        with open(os.path.join(RACINE, "client.json"), "r", encoding="utf-8") as f:
            c = json.load(f)
        return c if isinstance(c, dict) else {}
    except (TypeError, OSError, ValueError):
        return {}


_CLIENT = _client()
_HOC = _CLIENT.get("head_of_content") if isinstance(_CLIENT.get("head_of_content"), dict) else {}
PRENOM = _CLIENT.get("prenom") or "Romain"
ID_CLIENT = _CLIENT.get("id") or "romain"
REMOTE = (os.environ.get("RENDUS_REMOTE") or _HOC.get("depot")
          or "git@github.com:Yoanmot/head-of-content-romain.git")
CLE = os.path.expanduser(_HOC.get("cle_ssh") or os.path.join(HOME, ".ssh", "fitavecromain_head_of_content"))
# Le journal des envois restés hors ligne vit à côté de la copie qu'il rejoue (même chemin qu'avant
# pour la copie par défaut ; une copie de test garde le sien).
JOURNAL = os.path.join(os.path.dirname(os.path.abspath(DEPOT)), "rendus-journal.json")
REGISTRE = "rendus/registre.json"
MARQUEUR = ".a-rendre.json"

# Un type de rendu = un dossier a-rendre/<type>/ dans le dépôt + une convention de sortie sur le Mac.
#   sorties : là où prepare crée les dossiers de sortie (et où attente cherche les preuves)
#   prefixe : nom du dossier de sortie = prefixe + slug
#   preuves : fichiers dont la présence (plus récents que le marqueur) prouve que le rendu est fait
#   json    : prepare extrait le bloc ```json du texte vers ce fichier du dossier (None : rien)
TYPES = {
    "carrousels": {
        # RENDUS_CARROUSELS : le studio peut le déplacer (config « carrousels », bac à sable de test).
        "sorties": os.environ.get("RENDUS_CARROUSELS") or os.path.join(HOME, "Pictures", "Carrousels"),
        "prefixe": "carrousel-",
        "preuves": ["slide-*.png"],
        "json": "carrousel.json",
        "deplacer_avant_refaire": ["slide-*.png", "planche.jpg", "carrousel.json"],
    },
    # Le monteur se branchera ici sans rien réécrire, par exemple :
    # "montages": {
    #     "sorties": os.path.join(HOME, "Movies", "Montages"),
    #     "prefixe": "montage-",
    #     "preuves": ["*-final.mp4"],
    #     "json": None,
    #     "deplacer_avant_refaire": ["*-final.mp4"],
    # },
}

SLUG_OK = re.compile(r"^[a-z0-9][a-z0-9-]*$")

# Les clés de texte d'une slide (celles qui seront publiées). Les autres (photo, cadrage, position,
# fond, style…) sont de la mise en page : elles restent sur le Mac et ne remontent jamais.
CLES_TEXTE = ("surtitre", "titre", "texte", "liste", "chute", "bandeau",
              "punch", "etapes", "closer", "action")  # les quatre dernières : format de Yoan


# ---------------------------------------------------------------- outils

def dire(*lignes):
    for l in lignes:
        print(l, flush=True)


def stop(code, *lignes):
    dire(*lignes)
    sys.exit(code)


def maintenant():
    return datetime.datetime.now().astimezone().replace(microsecond=0)


def iso(dt):
    return dt.isoformat()


def lisible(iso_str):
    try:
        dt = datetime.datetime.fromisoformat(iso_str)
        return dt.strftime("%d/%m/%Y à %H:%M")
    except Exception:
        return iso_str


def empreinte_fichier(chemin):
    with open(chemin, "rb") as f:
        return "sha256:" + hashlib.sha256(f.read()).hexdigest()


def lire_json(chemin, defaut):
    try:
        with open(chemin, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return defaut
    except ValueError:
        return defaut


def ecrire_json(chemin, data):
    os.makedirs(os.path.dirname(chemin) or ".", exist_ok=True)
    tmp = chemin + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")
    os.replace(tmp, chemin)


def court(chemin):
    return "~" + chemin[len(HOME):] if chemin.startswith(HOME + os.sep) else chemin


def long(chemin):
    return os.path.join(HOME, chemin[2:]) if chemin.startswith("~/") else chemin


def git_env():
    env = dict(os.environ)
    env["GIT_TERMINAL_PROMPT"] = "0"
    env["LC_ALL"] = "C"
    if REMOTE.startswith("git@"):
        env["GIT_SSH_COMMAND"] = ssh_commande()
    return env


def ssh_commande():
    cle = '-i "%s" -o IdentitiesOnly=yes ' % CLE if os.path.exists(CLE) else ""
    return 'ssh %s-o StrictHostKeyChecking=accept-new -o BatchMode=yes' % cle


def git(*args, cwd=DEPOT, verifier=True):
    p = subprocess.run(["git"] + list(args), cwd=cwd, env=git_env(),
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if verifier and p.returncode != 0:
        raise ErreurGit(" ".join(args), p.stderr.strip() or p.stdout.strip())
    return p


class ErreurGit(Exception):
    def __init__(self, cmd, sortie):
        Exception.__init__(self, cmd + " : " + sortie)
        self.sortie = sortie


def classer(sortie):
    """Pourquoi git a échoué : "acces" (clé refusée, dépôt invisible), "reseau" (pas de connexion),
    "refuse" (le dépôt en ligne a bougé entre-temps) ou "autre"."""
    s = sortie.lower()
    if any(m in s for m in ("[rejected]", "fetch first", "non-fast-forward", "failed to push some refs")):
        if not any(m in s for m in ("permission denied", "repository not found")):
            return "refuse"
    if any(m in s for m in ("returned error: 401", "returned error: 403", "returned error: 404")):
        return "acces"
    if any(m in s for m in ("could not resolve", "unable to access", "timed out", "network is unreachable",
                            "connection refused", "no route to host", "connection reset",
                            "connection closed", "nodename nor servname")):
        return "reseau"
    if any(m in s for m in ("permission denied", "repository not found", "authentication failed",
                            "access denied", "could not read username", "access rights")):
        return "acces"
    return "autre"


def outils():
    if not shutil.which("git"):
        stop(22, "OUTIL_MANQUANT git : les outils de développement d'Apple ne sont pas installés.",
             "-> lance « xcode-select --install », %s clique sur Installer, puis relance." % PRENOM)


def type_conf(nom):
    if nom not in TYPES:
        stop(2, "TYPE_INCONNU %s (types : %s)" % (nom, ", ".join(sorted(TYPES))))
    return TYPES[nom]


# ---------------------------------------------------------------- dépôt

def synchroniser():
    """Copie locale = exactement le dépôt en ligne. Rend False si hors ligne (copie locale gardée).

    La copie locale n'est jamais modifiée à la main : tout ce que ce script y a écrit sans réussir à
    l'envoyer se retrouve par les preuves (journal et dossiers de sortie), donc on peut l'aligner
    sans rien perdre."""
    outils()
    if not os.path.isdir(os.path.join(DEPOT, ".git")):
        os.makedirs(os.path.dirname(DEPOT), exist_ok=True)
        p = git("clone", "--quiet", REMOTE, DEPOT, cwd=os.path.dirname(DEPOT), verifier=False)
        if p.returncode != 0:
            if classer(p.stderr) == "reseau":
                stop(21, "HORS_LIGNE : pas de connexion, et aucune copie du travail sur ce Mac pour l'instant.")
            stop(20, "ACCES_A_CONFIGURER : ce Mac n'a pas encore accès aux textes de %s." % PRENOM,
                 "-> suis la section « Première fois » du SKILL.md (commande cle).",
                 "détail : " + (p.stderr.strip().splitlines() or [""])[0])
        git("config", "user.name", "Mac de %s" % PRENOM)
        git("config", "user.email", "mac-%s@users.noreply.github.com" % ID_CLIENT)
        return True
    p = git("fetch", "--quiet", "origin", "main", verifier=False)
    if p.returncode != 0:
        if classer(p.stderr) == "acces":
            stop(20, "ACCES_A_CONFIGURER : l'accès aux textes de %s a été refusé." % PRENOM,
                 "-> suis la section « Première fois » du SKILL.md (commandes verifier puis cle).")
        dire("HORS_LIGNE : pas de connexion, je travaille avec la dernière copie (peut-être pas à jour).")
        return False
    git("checkout", "--quiet", "-f", "-B", "main", "origin/main")
    return True


def registre():
    r = lire_json(os.path.join(DEPOT, REGISTRE), {})
    if not isinstance(r, dict):
        r = {}
    r.setdefault("version", 1)
    for t in TYPES:
        r.setdefault(t, {})
    return r


def transaction(operations, message):
    """Applique les opérations (idempotentes) sur le dépôt, commit et envoie.

    Envoi refusé parce que le cloud a écrit entre-temps : on réaligne sur le dépôt en ligne et on
    rejoue les mêmes opérations par-dessus (rien de l'autre côté n'est écrasé, jamais de forçage).
    Rend "envoye", "rien" (déjà à jour) ou "pas_envoye" (hors ligne : rattrapé au prochain attente)."""
    for tentative in range(1, 6):
        if tentative > 1:
            p = git("fetch", "--quiet", "origin", "main", verifier=False)
            if p.returncode != 0:
                return "pas_envoye"
            git("checkout", "--quiet", "-f", "-B", "main", "origin/main")
        change = appliquer(operations)
        if not change:
            return "rien"
        git("add", "-A", "--", "rendus", "a-rendre")
        git("commit", "--quiet", "-m", message)
        p = git("push", "--quiet", "origin", "HEAD:main", verifier=False)
        if p.returncode == 0:
            return "envoye"
        if classer(p.stderr) != "refuse":
            return "pas_envoye"
        time.sleep(min(2 * tentative, 6))
    return "pas_envoye"


def appliquer(operations):
    """operations : liste de dict {type, slug, empreinte, rendu_le, dossier, fichiers, par}.
    Enregistre chaque rendu dans le registre ; déplace le texte vers rendus/ seulement si le texte
    en attente est exactement celui qui a été rendu. Rend True si quelque chose a changé."""
    reg = registre()
    change = False
    for op in operations:
        t, slug = op["type"], op["slug"]
        entree = reg[t].get(slug)
        # empreinte du texte tel qu'il a été rendu : celle du texte validé, ou du texte corrigé sur le Mac
        emp_rendu = op.get("empreinte_rendu") or op["empreinte"]
        if not entree or entree.get("empreinte") != emp_rendu:
            nouvelle = {
                "empreinte": emp_rendu,
                "rendu_le": op["rendu_le"],
                "dossier": op["dossier"],
                "fichiers": op["fichiers"],
                "texte": "rendus/%s/%s.md" % (t, slug),
                "enregistre_par": op["par"],
                "precedents": [],
            }
            if op.get("texte_rendu"):
                nouvelle["corrige_sur_le_mac"] = {"empreinte_validee": op["empreinte"],
                                                  "corrections": op.get("corrections", [])}
            if entree:
                nouvelle["precedents"] = entree.get("precedents", []) + [
                    {"empreinte": entree.get("empreinte"), "rendu_le": entree.get("rendu_le")}]
            reg[t][slug] = nouvelle
            change = True
        src = os.path.join(DEPOT, "a-rendre", t, slug + ".md")
        if os.path.exists(src) and empreinte_fichier(src) == op["empreinte"]:
            dst_dir = os.path.join(DEPOT, "rendus", t)
            os.makedirs(dst_dir, exist_ok=True)
            dst = os.path.join(dst_dir, slug + ".md")
            if op.get("texte_rendu"):
                with open(dst, "w", encoding="utf-8") as f:
                    f.write(op["texte_rendu"])
                os.remove(src)
            else:
                os.replace(src, dst)
            change = True
    if change:
        ecrire_json(os.path.join(DEPOT, REGISTRE), reg)
    return change


# ---------------------------------------------------------------- preuves sur le disque

def journal():
    j = lire_json(JOURNAL, [])
    return j if isinstance(j, list) else []


def noter_journal(op):
    j = journal()
    j.append(op)
    ecrire_json(JOURNAL, j)


def fichiers_rendus(dossier, motifs, apres=None):
    """Fichiers de rendu du dossier (motifs), plus récents que `apres` (horodatage) si donné."""
    try:
        noms = sorted(os.listdir(dossier))
    except OSError:
        return []
    res = []
    for n in noms:
        if any(fnmatch.fnmatch(n, m) for m in motifs):
            c = os.path.join(dossier, n)
            if os.path.isfile(c) and (apres is None or os.path.getmtime(c) > apres):
                res.append(c)
    return res


def dossiers_candidats(t, slug, reg):
    """Dossiers de sortie possibles : le dossier convenu, celui du registre, et tout dossier des
    sorties (deux niveaux) qui porte le nom convenu ou un marqueur de ce slug (dossier renommé)."""
    conf = TYPES[t]
    vus, res = set(), []

    def ajouter(d):
        d = os.path.realpath(d)
        if d not in vus and os.path.isdir(d):
            vus.add(d)
            res.append(d)

    ajouter(os.path.join(conf["sorties"], conf["prefixe"] + slug))
    if reg[t].get(slug, {}).get("dossier"):
        ajouter(long(reg[t][slug]["dossier"]))
    racine = conf["sorties"]
    for niveau1 in _sous_dossiers(racine):
        for d in [niveau1] + _sous_dossiers(niveau1):
            if os.path.basename(d) == conf["prefixe"] + slug:
                ajouter(d)
            else:
                m = lire_json(os.path.join(d, MARQUEUR), None)
                if isinstance(m, dict) and m.get("type") == t and m.get("slug") == slug:
                    ajouter(d)
    return res


def _sous_dossiers(d):
    try:
        return [os.path.join(d, n) for n in sorted(os.listdir(d))
                if not n.startswith(".") and os.path.isdir(os.path.join(d, n))]
    except OSError:
        return []


def preuves(t, slug, reg):
    """Rendus trouvés pour ce slug : liste de dict {empreinte (ou None), rendu_le, dossier, fichiers}."""
    conf = TYPES[t]
    res = []
    for d in dossiers_candidats(t, slug, reg):
        m = lire_json(os.path.join(d, MARQUEUR), None)
        if isinstance(m, dict) and m.get("slug") == slug:
            f = fichiers_rendus(d, conf["preuves"], os.path.getmtime(os.path.join(d, MARQUEUR)))
            emp = m.get("empreinte")
        else:
            f = fichiers_rendus(d, conf["preuves"])
            emp = None
        if f:
            date = datetime.datetime.fromtimestamp(max(os.path.getmtime(x) for x in f)).astimezone()
            res.append({"empreinte": emp, "rendu_le": iso(date.replace(microsecond=0)),
                        "dossier": court(d), "fichiers": len(f)})
    for e in journal():
        if e.get("type") == t and e.get("slug") == slug:
            p = {"empreinte": e["empreinte"], "rendu_le": e["rendu_le"],
                 "dossier": e["dossier"], "fichiers": e.get("fichiers", 0)}
            for k in ("texte_rendu", "empreinte_rendu", "corrections"):
                if k in e:
                    p[k] = e[k]
            res.append(p)
    return res


# ---------------------------------------------------------------- lecture des textes

def infos_texte(chemin):
    with open(chemin, "r", encoding="utf-8") as f:
        txt = f.read()
    titre = ""
    m = re.search(r"^# (.+)$", txt, re.M)
    if m:
        titre = m.group(1).strip()
    pub = ""
    m = re.search(r"^- Publication prévue : (.+)$", txt, re.M)
    if m:
        pub = m.group(1).strip()
    bloc, err = bloc_json(txt)
    n = len(bloc.get("slides", [])) if isinstance(bloc, dict) else 0
    return {"titre": titre, "publication": pub, "slides": n, "json": bloc, "erreur": err}


def bloc_json(txt):
    m = re.search(r"```json\s*\n(.*?)\n```", txt, re.S)
    if not m:
        return None, "aucun bloc json"
    try:
        return json.loads(m.group(1)), None
    except ValueError as e:
        return None, str(e)


def en_attente(t):
    d = os.path.join(DEPOT, "a-rendre", t)
    try:
        noms = sorted(n for n in os.listdir(d) if n.endswith(".md") and not n.startswith("."))
    except OSError:
        return []
    return [(n[:-3], os.path.join(d, n)) for n in noms]


# ---------------------------------------------------------------- correction faite sur le Mac

def _plat(v):
    return (v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)).replace("\n", " ")


def _ecart(a, b, n=50):
    """Les deux versions autour de l'endroit où elles diffèrent (lisible dans une ligne)."""
    a, b = _plat(a), _plat(b)
    i = 0
    while i < min(len(a), len(b)) and a[i] == b[i]:
        i += 1
    d = max(0, i - 20)
    coupe = lambda x: ("…" if d else "") + x[d:d + n] + ("…" if len(x) > d + n else "")
    return coupe(a), coupe(b)


def texte_rendu(t, chemin_texte, dossier, rendu_le):
    """Le texte validé (a-rendre) comparé à ce qui a été rendu (carrousel.json du dossier).
    Rend None si les textes des slides sont identiques, sinon (contenu du fichier à ranger dans
    rendus/, liste des corrections lisibles). Seules les clés de texte remontent."""
    conf = TYPES[t]
    if not conf["json"] or not os.path.exists(chemin_texte):
        return None
    rendu = lire_json(os.path.join(long(dossier), conf["json"]), None)
    with open(chemin_texte, "r", encoding="utf-8") as f:
        txt = f.read()
    valide, err = bloc_json(txt)
    if err or not isinstance(rendu, dict) or not isinstance(valide, dict):
        return None
    sv, sr = valide.get("slides") or [], rendu.get("slides") or []
    texte = lambda s: {k: s[k] for k in CLES_TEXTE if isinstance(s, dict) and k in s}
    corrections = []
    for i in range(max(len(sv), len(sr))):
        a = texte(sv[i]) if i < len(sv) else None
        b = texte(sr[i]) if i < len(sr) else None
        if a == b:
            continue
        if a is None:
            corrections.append("slide %d ajoutée" % (i + 1))
        elif b is None:
            corrections.append("slide %d retirée" % (i + 1))
        else:
            for k in CLES_TEXTE:
                if a.get(k) != b.get(k):
                    corrections.append("slide %d (%s) : « %s » -> « %s »"
                                       % ((i + 1, k) + _ecart(a.get(k, ""), b.get(k, ""))))
    if not corrections:
        return None
    slides = []
    for i, s in enumerate(sr):
        base = sv[i] if i < len(sv) and isinstance(sv[i], dict) else {}
        n = {k: v for k, v in base.items() if k not in CLES_TEXTE}
        n.update(texte(s))
        slides.append(n)
    nouveau = dict(valide)
    nouveau["slides"] = slides
    bloc = json.dumps(nouveau, ensure_ascii=False, indent=2)
    m = re.search(r"```json\s*\n(.*?)\n```", txt, re.S)
    avant, apres = txt[:m.start()], txt[m.end():]
    note = "- Corrigé sur le Mac à la mise en page, le %s : %s" % (
        lisible(rendu_le)[:10], " ; ".join(corrections))
    contenu = avant.rstrip("\n") + "\n" + note + "\n\n```json\n" + bloc + "\n```" + apres
    return contenu, corrections


def avec_texte_rendu(op, t, chemin_texte):
    """Ajoute à l'opération le texte rendu s'il diffère du texte validé (et rien sinon)."""
    if op.get("texte_rendu") or not os.path.exists(chemin_texte):
        return op
    if empreinte_fichier(chemin_texte) != op["empreinte"]:
        return op
    tr = texte_rendu(t, chemin_texte, op["dossier"], op["rendu_le"])
    if tr:
        op = dict(op, texte_rendu=tr[0], corrections=tr[1],
                  empreinte_rendu="sha256:" + hashlib.sha256(tr[0].encode("utf-8")).hexdigest())
    return op


# ---------------------------------------------------------------- commandes

def cmd_attente(t):
    type_conf(t)
    en_ligne = synchroniser()
    reg = registre()
    a_ranger, nouveaux, maj = [], [], []

    for slug, chemin in en_attente(t):
        emp = empreinte_fichier(chemin)
        info = infos_texte(chemin)
        entree = reg[t].get(slug)
        trouves = preuves(t, slug, reg)
        meme = [p for p in trouves if p["empreinte"] == emp]
        sans_marqueur = [p for p in trouves if p["empreinte"] is None]

        validee = (entree or {}).get("corrige_sur_le_mac", {}).get("empreinte_validee")
        if entree and validee == emp:
            # le texte validé d'un carrousel corrigé sur le Mac : déjà rendu, on le range (texte rendu)
            a_ranger.append((slug, info, {"empreinte": emp, "rendu_le": entree["rendu_le"],
                                          "dossier": entree.get("dossier", ""),
                                          "fichiers": entree.get("fichiers", 0)}, "registre"))
        elif entree and entree.get("empreinte") == emp:
            a_ranger.append((slug, info, {"empreinte": emp, "rendu_le": entree["rendu_le"],
                                          "dossier": entree.get("dossier", ""),
                                          "fichiers": entree.get("fichiers", 0)}, "registre"))
        elif meme:
            a_ranger.append((slug, info, sorted(meme, key=lambda p: p["rendu_le"])[-1], "rattrapage"))
        elif sans_marqueur and not entree:
            p = sorted(sans_marqueur, key=lambda p: p["rendu_le"])[-1]
            p = dict(p, empreinte=emp)
            a_ranger.append((slug, info, p, "rattrapage-sans-marqueur"))
        elif entree or trouves:
            avec_marqueur = sorted((p for p in trouves if p["empreinte"]), key=lambda p: p["rendu_le"])
            if avec_marqueur and (not entree or entree.get("empreinte") != avec_marqueur[-1]["empreinte"]):
                # une version plus ancienne a été rendue sans être enregistrée : on l'enregistre,
                # sans sortir le texte (il a changé depuis, il reste à refaire)
                a_ranger.append((slug, info, avec_marqueur[-1], "rattrapage-ancienne-version"))
            dernier = entree["rendu_le"] if entree else sorted(trouves, key=lambda p: p["rendu_le"])[-1]["rendu_le"]
            maj.append((slug, chemin, info, dernier))
        else:
            nouveaux.append((slug, chemin, info))

    if a_ranger:
        ops = []
        for s, _, p, par in a_ranger:
            op = {"type": t, "slug": s, "empreinte": p["empreinte"], "rendu_le": p["rendu_le"],
                  "dossier": p["dossier"], "fichiers": p["fichiers"], "par": "attente (%s)" % par}
            for k in ("texte_rendu", "empreinte_rendu", "corrections"):
                if k in p:
                    op[k] = p[k]
            ops.append(avec_texte_rendu(op, t, os.path.join(DEPOT, "a-rendre", t, s + ".md")))
        if en_ligne:
            etat = transaction(ops, "Mac de %s : %s déjà rendu(s), rangé(s) : %s"
                               % (PRENOM, t, ", ".join(o["slug"] for o in ops)))
        else:
            appliquer(ops)  # sur la copie locale seulement : réaligné et rejoué au prochain lancement
            etat = "pas_envoye"
        for s, info, p, par in a_ranger:
            if par == "rattrapage-ancienne-version":
                continue
            dire('DEJA_FAIT slug=%s rendu_le="%s" dossier="%s" titre="%s"'
                 % (s, lisible(p["rendu_le"]), p["dossier"], info["titre"]))
        for op in ops:
            if op.get("corrections"):
                dire('TEXTE_REPORTE slug=%s : %s' % (op["slug"], " ; ".join(op["corrections"])))
        if etat == "pas_envoye":
            dire("PAS_ENVOYE : rangement noté, il sera envoyé au prochain lancement avec connexion.")

    for s, chemin, info, dernier in maj:
        dire('MIS_A_JOUR slug=%s rendu_le="%s" slides=%d publication="%s" titre="%s" texte="%s"'
             % (s, lisible(dernier), info["slides"], info["publication"], info["titre"], chemin))
    for s, chemin, info in nouveaux:
        ligne = 'NOUVEAU slug=%s slides=%d publication="%s" titre="%s" texte="%s"' % (
            s, info["slides"], info["publication"], info["titre"], chemin)
        if info["erreur"]:
            ligne += ' TEXTE_ILLISIBLE="%s"' % info["erreur"]
        dire(ligne)
    reste = len(maj) + len(nouveaux)
    dire("RESTE %d" % reste if reste else "RIEN_EN_ATTENTE")


def cmd_prepare(t, slug):
    conf = type_conf(t)
    chemin = os.path.join(DEPOT, "a-rendre", t, slug + ".md")
    if not os.path.exists(chemin):
        stop(31, "INTROUVABLE %s : ce texte n'est pas en attente (relance attente)." % slug)
    emp = empreinte_fichier(chemin)
    info = infos_texte(chemin)
    if conf["json"] and info["erreur"]:
        stop(32, "TEXTE_ILLISIBLE %s : %s. Ne le répare pas : préviens Yoan." % (slug, info["erreur"]))
    reg = registre()
    cands = dossiers_candidats(t, slug, reg)
    dossier = cands[0] if cands else os.path.join(conf["sorties"], conf["prefixe"] + slug)
    os.makedirs(dossier, exist_ok=True)
    mpath = os.path.join(dossier, MARQUEUR)
    ancien = lire_json(mpath, None)

    if isinstance(ancien, dict) and ancien.get("empreinte") == emp:
        dire("REPRISE dossier=\"%s\" (déjà préparé pour ce texte : on continue, rien n'est effacé)" % dossier)
    else:
        a_garder = fichiers_rendus(dossier, conf["deplacer_avant_refaire"])
        if a_garder:
            arch = os.path.join(dossier, "ancienne-version-" + maintenant().strftime("%Y%m%d-%H%M"))
            os.makedirs(arch, exist_ok=True)
            for f in a_garder:
                os.replace(f, os.path.join(arch, os.path.basename(f)))
            dire("ANCIENNE_VERSION rangée dans \"%s\" (on peut y reprendre les photos choisies)" % arch)
        ecrire_json(mpath, {"type": t, "slug": slug, "empreinte": emp, "prepare_le": iso(maintenant()),
                            "texte": "a-rendre/%s/%s.md" % (t, slug)})
        time.sleep(0.05)  # les rendus qui suivent sont forcément plus récents que le marqueur
    if conf["json"]:
        jpath = os.path.join(dossier, conf["json"])
        if not os.path.exists(jpath):
            with open(jpath, "w", encoding="utf-8") as f:
                json.dump(info["json"], f, ensure_ascii=False, indent=2)
                f.write("\n")
    dire('PRET slug=%s dossier="%s" texte="%s" slides=%d titre="%s"'
         % (slug, dossier, chemin, info["slides"], info["titre"]))
    if conf["json"] and isinstance(info["json"], dict):
        for i, s in enumerate(info["json"].get("slides", []), 1):
            if isinstance(s, dict) and s.get("photo-a-prevoir"):
                dire("PHOTO slide=%d : %s" % (i, s["photo-a-prevoir"]))


def cmd_termine(t, slug):
    conf = type_conf(t)
    en_ligne = synchroniser()
    reg = registre()
    chemin = os.path.join(DEPOT, "a-rendre", t, slug + ".md")
    cands = dossiers_candidats(t, slug, reg)
    rendu = None
    for d in cands:
        m = lire_json(os.path.join(d, MARQUEUR), None)
        if isinstance(m, dict) and m.get("slug") == slug:
            f = fichiers_rendus(d, conf["preuves"], os.path.getmtime(os.path.join(d, MARQUEUR)))
            if f:
                rendu = (d, m["empreinte"], f)
                break
    if not rendu:
        stop(30, "AUCUN_RENDU %s : aucun fichier rendu dans le dossier préparé. Rien n'est enregistré."
             % slug)
    d, emp, f = rendu
    entree = reg[t].get(slug, {})
    if not os.path.exists(chemin) and emp in (entree.get("empreinte"),
                                              entree.get("corrige_sur_le_mac", {}).get("empreinte_validee")):
        dire("DEJA_ENREGISTRE slug=%s" % slug)
        return
    op = {"type": t, "slug": slug, "empreinte": emp, "rendu_le": iso(maintenant()),
          "dossier": court(d), "fichiers": len(f), "par": "termine"}
    op = avec_texte_rendu(op, t, chemin)
    noter_journal(op)
    if en_ligne:
        etat = transaction([op], "Mac de %s : %s rendu (%s), sorti de la liste" % (PRENOM, slug, t))
    else:
        appliquer([op])  # sur la copie locale seulement : réaligné et rejoué au prochain lancement
        etat = "pas_envoye"
    if os.path.exists(chemin) and empreinte_fichier(chemin) != emp:
        dire("TERMINE slug=%s, mais le texte a changé dans le cloud pendant la mise en page : "
             "il reste dans la liste comme « mis à jour »." % slug)
    else:
        dire('TERMINE slug=%s dossier="%s" fichiers=%d' % (slug, d, len(f)))
        if op.get("corrections"):
            dire("TEXTE_REPORTE slug=%s : %s" % (slug, " ; ".join(op["corrections"])))
    if etat == "pas_envoye":
        dire("PAS_ENVOYE : pas de connexion. C'est noté sur ce Mac, l'envoi se fera au prochain lancement.")
    dire("RESTE %d" % len(en_attente(t)))


def cmd_cle():
    if not os.path.exists(CLE):
        os.makedirs(os.path.dirname(CLE), exist_ok=True)
        os.chmod(os.path.dirname(CLE), 0o700)
        p = subprocess.run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C", "mac-romain-head-of-content",
                            "-f", CLE], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if p.returncode != 0:
            stop(22, "OUTIL_MANQUANT ssh-keygen : " + p.stderr.strip())
    with open(CLE + ".pub", "r", encoding="utf-8") as f:
        dire("CLE_PUBLIQUE " + f.read().strip())


def cmd_verifier():
    outils()
    p = git("ls-remote", REMOTE, "main", cwd=HOME, verifier=False)
    if p.returncode == 0:
        dire("ACCES_OK")
    elif classer(p.stderr) == "reseau":
        stop(21, "HORS_LIGNE")
    else:
        stop(20, "ACCES_A_CONFIGURER " + (p.stderr.strip().splitlines() or [""])[0])


def main(argv):
    args = list(argv)
    t = "carrousels"
    if "--type" in args:
        i = args.index("--type")
        if i + 1 >= len(args):
            stop(2, "Usage : --type <%s>" % "|".join(TYPES))
        t = args[i + 1]
        del args[i:i + 2]
    if not args:
        stop(2, __doc__)
    cmd = args[0]
    if cmd in ("prepare", "termine"):
        if len(args) < 2 or not SLUG_OK.match(args[1]):
            stop(2, "Usage : %s <slug> (minuscules, chiffres, tirets)" % cmd)
    try:
        if cmd == "attente":
            cmd_attente(t)
        elif cmd == "prepare":
            cmd_prepare(t, args[1])
        elif cmd == "termine":
            cmd_termine(t, args[1])
        elif cmd == "cle":
            cmd_cle()
        elif cmd == "verifier":
            cmd_verifier()
        else:
            stop(2, __doc__)
    except ErreurGit as e:
        stop(23, "ERREUR_DEPOT : " + str(e), "-> ne touche à rien, préviens Yoan avec ce message.")


if __name__ == "__main__":
    main(sys.argv[1:])
