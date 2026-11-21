# Lit la sortie de « claude setup-token » enregistrée par connexion-claude.sh (pseudo-terminal, codes de couleur et
# de curseur compris). Le jeton n'est écrit que par la commande « jeton », sur la sortie standard, pour être passé
# tel quel (tube) à cles.sh --stdin claude ; « etat » et « fin » ne l'écrivent jamais.
#   python3 -I connexion_lire.py etat <sortie>    PRET | ATTENTE | ERREUR <raison> | (rien : claude n'a encore rien dit)
#   python3 -I connexion_lire.py jeton <sortie>   le jeton (une ligne), code 1 s'il n'y en a pas
#   python3 -I connexion_lire.py fin <sortie>     la dernière ligne lisible, jetons masqués (pour un message d'erreur)
import re, sys

JETON = re.compile(r"sk-ant-oat\d\d-[A-Za-z0-9_-]{20,}")
CSI = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")
OSC = re.compile(r"\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)")
ESC = re.compile(r"\x1b[@-Z\\-_78=>]")
# Ce que claude affiche juste après le jeton : sa présence prouve que la ligne du jeton est complète.
APRES = ("Store this token", "You can revoke", "CLAUDE_CODE_OAUTH_TOKEN=<token>")
ERREURS = (("Token exchange failed", "échange du code refusé par Claude"),
           ("does not permit", "ce compte n'a pas le droit de créer un jeton longue durée"),
           ("OAuth error", "erreur de connexion renvoyée par Claude"))


def texte(chemin):
    brut = open(chemin, "rb").read().decode("utf-8", "replace")
    t = OSC.sub("", brut)
    t = CSI.sub(" ", t)
    t = ESC.sub("", t)
    t = t.replace("\r", "\n")
    return "".join(ch for ch in t if ch == "\n" or ch >= " ")


def jetons(t):
    return JETON.findall(t)


def etat(t):
    js = list(JETON.finditer(t))
    if js:
        apres = t[js[-1].end():]
        if any(a in apres for a in APRES):
            return "PRET"
    for cle, raison in ERREURS:
        if raison and cle in t:
            return "ERREUR " + raison
    if "Opening browser" in t or "Paste code" in t or "Browser didn" in t:
        return "ATTENTE"
    return ""


def fin(t):
    lignes = [l.strip() for l in t.split("\n") if re.search(r"[A-Za-z]{3}", l)]
    l = lignes[-1] if lignes else "aucune sortie"
    l = JETON.sub("sk-ant-...", l)
    return re.sub(r"\s+", " ", l)[:120]


def main(argv):
    if len(argv) != 3 or argv[1] not in ("etat", "jeton", "fin"):
        print("usage : connexion_lire.py etat|jeton|fin <sortie>", file=sys.stderr); return 2
    try:
        t = texte(argv[2])
    except OSError:
        t = ""
    if argv[1] == "etat":
        print(etat(t)); return 0
    if argv[1] == "fin":
        print(fin(t)); return 0
    js = jetons(t)
    if not js or etat(t) != "PRET":
        return 1
    # Le dernier jeton complet affiché (claude peut redessiner l'écran) : le plus long des derniers identiques.
    sys.stdout.write(js[-1] + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
