#!/usr/bin/env python3
"""Faux zernio.py pour les tests du studio : posé dans <dépôt de test>/outils/zernio.py.

Il charge le VRAI outils/zernio.py du head of content (FAUX_ZERNIO_REEL) pour que les sorties de
`verifier` et de `publier` en simulation soient exactement celles du vrai script, mais :
  - il note chaque appel (arguments, ZERNIO_ECRITURE_ROMAIN) dans FAUX_ZERNIO_LOG ;
  - il refuse --envoyer d'office (code 99), avant même de charger le vrai script ;
  - il coupe tout accès réseau (appel, envoi de fichier, urlopen) : code 98 ;
  - il refuse --pousser sur publier (aucun git pendant les tests) : code 97 ; sur verifier, il
    l'enlève (la copie de test n'a rien à aligner) après l'avoir noté.
"""
import importlib.util
import json
import os
import sys

with open(os.environ["FAUX_ZERNIO_LOG"], "a", encoding="utf-8") as f:
    f.write(json.dumps({"argv": sys.argv[1:], "ecriture": os.environ.get("ZERNIO_ECRITURE_ROMAIN"),
                        "hoc_depot": os.environ.get("HOC_DEPOT")}, ensure_ascii=False) + "\n")

if "--envoyer" in sys.argv:
    print("FAUX_ZERNIO_ENVOYER_INTERDIT")
    sys.exit(99)
if "--pousser" in sys.argv:
    if sys.argv[1:2] != ["verifier"]:
        print("FAUX_ZERNIO_POUSSER_INTERDIT")
        sys.exit(97)
    # verifier --pousser aligne la copie des scripts sur le dépôt en ligne : pas de git ici, la copie
    # de test est déjà la bonne.
    sys.argv.remove("--pousser")

spec = importlib.util.spec_from_file_location("zernio_reel", os.environ["FAUX_ZERNIO_REEL"])
z = importlib.util.module_from_spec(spec)
spec.loader.exec_module(z)


def interdit(*a, **k):
    print("FAUX_ZERNIO_RESEAU_INTERDIT")
    sys.exit(98)


z.appel = interdit

# Lot 13 : FAUX_ZERNIO_TIKTOK (fichier JSON {"accounts": [...], "creator": {...}}) donne les deux LECTURES
# TikTok (compte du profil, infos créateur) ; toute autre requête reste interdite.
if os.environ.get("FAUX_ZERNIO_TIKTOK"):
    with open(os.environ["FAUX_ZERNIO_TIKTOK"], encoding="utf-8") as f:
        _tt = json.load(f)

    def lecture_tiktok(methode, chemin, params=None, corps=None, entetes=None):
        if methode == "GET" and chemin == "/v1/accounts":
            return {"accounts": _tt.get("accounts") or []}
        if methode == "GET" and chemin.endswith("/tiktok/creator-info"):
            return _tt.get("creator") or {}
        interdit()

    z.appel = lecture_tiktok
z.envoyer_fichier = interdit
z.urllib.request.urlopen = interdit
z.git = interdit
z.main()
