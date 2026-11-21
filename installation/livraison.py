# Le code de livraison : un seul texte qui porte toutes les clés d'un client (publication, sons, code du
# montage, clé SSH de son head of content), envoyé par Yoan sur WhatsApp et collé une fois par le client
# dans une fenêtre masquée de l'installation. Appelé par preparer-livraison.sh (encoder, chez Yoan) et par
# livraison.sh (decoder, chez le client). Jamais une valeur de clé sur la sortie standard ni dans un message.
#
# Format, version 1 (une seule ligne, rien que A-Z, 0-9 et « - », pour survivre à WhatsApp : pas de « _ », « * »
# ou « ~ » que WhatsApp prendrait pour de la mise en forme) :
#   STUDIO1-<CLIENT>-<données>-<somme>-FIN
#   <données> : base32 (sans « = ») du JSON compressé (zlib)
#               {"v": 1, "client": "romain", "cree": "<date>", "cles": {"zernio": ..., "elevenlabs": ..., "code": ...,
#                "ssh": "<clé privée OpenSSH>"}}
#   <somme>   : 10 premiers caractères (majuscules) du SHA-256 de « STUDIO1-<CLIENT>-<données> »
#   -FIN      : la fin du code ; absente = collage coupé.
# Au décodage, tout ce qui n'est pas A-Z, 0-9 ou « - » est retiré (retours à la ligne, espaces insécables,
# caractères invisibles, en-tête d'un message WhatsApp copié avec sa date), puis la somme est vérifiée.
#
#   python3 -I livraison.py encoder <client> <dossier>   lit <dossier>/<nom> (un fichier par clé), écrit le code
#                                                          sur la sortie
#   python3 -I livraison.py decoder <client> <dossier>   lit le code collé sur l'entrée, écrit chaque clé dans
#                                                          <dossier>/<nom> (600) ; une ligne par résultat :
#     LIVRAISON_OK <noms> | LIVRAISON_MANQUE <nom> | LIVRAISON_INCOMPLET | LIVRAISON_ABIME <raison>
#     | LIVRAISON_VERSION <v> | LIVRAISON_AUTRE_CLIENT <client> | LIVRAISON_VIDE
# Codes : 0 décodé (même avec des clés manquantes) ; 2 rien de lisible.
import base64, datetime, hashlib, json, os, re, sys, zlib

NOMS = ("zernio", "elevenlabs", "code", "ssh")
VERSION = 1


def somme(tete_et_donnees):
    return hashlib.sha256(tete_et_donnees.encode("ascii")).hexdigest()[:10].upper()


def client_code(client):
    c = re.sub(r"[^A-Z0-9]", "", client.upper())
    if not c:
        raise ValueError("client vide")
    return c


def encoder(client, dossier):
    cles = {}
    for n in NOMS:
        p = os.path.join(dossier, n)
        if os.path.isfile(p):
            v = open(p, encoding="utf-8").read()
            v = v if n == "ssh" else v.strip()
            if v.strip():
                cles[n] = v
    if not cles:
        print("LIVRAISON_VIDE aucune clé à livrer", file=sys.stderr)
        return 2
    corps = {"v": VERSION, "client": client, "cree": datetime.datetime.now().astimezone().replace(microsecond=0).isoformat(),
             "cles": cles}
    brut = zlib.compress(json.dumps(corps, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), 9)
    donnees = base64.b32encode(brut).decode("ascii").rstrip("=")
    tete = "STUDIO%d-%s-%s" % (VERSION, client_code(client), donnees)
    sys.stdout.write("%s-%s-FIN\n" % (tete, somme(tete)))
    return 0


def lire_code(texte):
    """Rend (version, client, donnees, somme) ou lève ValueError(code, texte)."""
    t = re.sub(r"[^A-Z0-9-]", "", texte.upper())
    if not t:
        raise ValueError("LIVRAISON_VIDE", "rien de collé")
    m = re.search(r"STUDIO(\d+)-", t)
    if not m:
        raise ValueError("LIVRAISON_ABIME", "ce n'est pas un code de livraison")
    t = t[m.start():]
    if int(m.group(1)) != VERSION:
        raise ValueError("LIVRAISON_VERSION", m.group(1))
    f = t.find("-FIN")
    if f < 0:
        raise ValueError("LIVRAISON_INCOMPLET", "la fin du code manque (collage coupé)")
    t = t[:f]
    m = re.fullmatch(r"STUDIO\d+-([A-Z0-9]+)-([A-Z2-7]+)-([0-9A-F]{10})", t)
    if not m:
        raise ValueError("LIVRAISON_ABIME", "forme inattendue")
    return int(m.group(0)[6:m.group(0).index("-")]), m.group(1), m.group(2), m.group(3)


def decoder(client, dossier, texte):
    try:
        version, cli, donnees, s = lire_code(texte)
    except ValueError as e:
        code, raison = e.args
        print("%s %s" % (code, raison)); return 2
    tete = "STUDIO%d-%s-%s" % (version, cli, donnees)
    if somme(tete) != s:
        print("LIVRAISON_ABIME la somme de contrôle ne correspond pas (code abîmé ou incomplet)"); return 2
    if cli != client_code(client):
        print("LIVRAISON_AUTRE_CLIENT %s" % cli.lower()); return 2
    try:
        corps = json.loads(zlib.decompress(base64.b32decode(donnees + "=" * (-len(donnees) % 8))).decode("utf-8"))
    except Exception:
        print("LIVRAISON_ABIME contenu illisible"); return 2
    if corps.get("v") != VERSION or corps.get("client") != client:
        print("LIVRAISON_AUTRE_CLIENT %s" % corps.get("client")); return 2
    cles = corps.get("cles") or {}
    os.makedirs(dossier, mode=0o700, exist_ok=True)
    os.chmod(dossier, 0o700)
    lus = []
    for n in NOMS:
        v = cles.get(n)
        if not isinstance(v, str) or not v.strip():
            print("LIVRAISON_MANQUE %s" % n); continue
        p = os.path.join(dossier, n)
        fd = os.open(p, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(v if n == "ssh" else v.strip() + "\n")
        os.chmod(p, 0o600)
        lus.append(n)
    print("LIVRAISON_OK %s (code du %s)" % (",".join(lus) or "aucune", str(corps.get("cree", ""))[:10]))
    return 0


def main(argv):
    if len(argv) != 4 or argv[1] not in ("encoder", "decoder"):
        print("usage : livraison.py encoder|decoder <client> <dossier>", file=sys.stderr); return 2
    if argv[1] == "encoder":
        return encoder(argv[2], argv[3])
    return decoder(argv[2], argv[3], sys.stdin.read())


if __name__ == "__main__":
    sys.exit(main(sys.argv))
