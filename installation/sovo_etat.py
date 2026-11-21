# Les autorisations de Sovo, lues dans son journal (~/Library/Logs/Sovo.log) : macOS ne laisse pas un autre
# programme lire ces réglages, Sovo les écrit à chaque lancement. On lit seulement les lignes d'état (jamais le
# texte dicté), dans le dernier lancement.
#   python3 -I sovo_etat.py <journal> [<depuis : secondes epoch>]
# Une ligne : SOVO_ETAT lance=<0|1> micro=<oui|non|refuse|inconnu> accessibilite=<oui|non> surveillance=<oui|non>
#             lancement=<horodatage du dernier lancement>
# « depuis » : un lancement plus ancien ne compte pas (lance=0).
import datetime, re, sys

LANCE = re.compile(r"^===== Sovo launched (\d{4}-\d\d-\d\d \d\d:\d\d:\d\d) \+0000 =====$")


def lire(chemin, depuis=None):
    try:
        lignes = open(chemin, encoding="utf-8", errors="replace").read().split("\n")
    except OSError:
        return {"lance": 0}
    debut = None
    for i, l in enumerate(lignes):
        if LANCE.match(l.strip()):
            debut = i
    if debut is None:
        return {"lance": 0}
    quand = LANCE.match(lignes[debut].strip()).group(1)
    t = datetime.datetime.strptime(quand, "%Y-%m-%d %H:%M:%S").replace(tzinfo=datetime.timezone.utc).timestamp()
    if depuis is not None and t < depuis:
        return {"lance": 0, "lancement": quand}
    bloc = [l for l in lignes[debut + 1:] if l.startswith(("[Hotkey]", "[Audio] Mic", "[Audio] Requesting mic", "[Audio] Cannot start"))]
    micro = "inconnu"
    for l in bloc:
        if "Mic access already authorized" in l or "Mic access granted" in l:
            micro = "oui"
        elif "Mic access denied" in l or "Mic access DENIED" in l:
            micro = "refuse"
        elif "Requesting mic access" in l and micro == "inconnu":
            micro = "non"
    acces = "non"
    for l in bloc:
        if "accessibility granted at startup: true" in l or "Accessibility granted after" in l:
            acces = "oui"
    surv = "non" if any("Input Monitoring not granted" in l for l in bloc) else "oui"
    return {"lance": 1, "micro": micro, "accessibilite": acces, "surveillance": surv, "lancement": quand}


def main(argv):
    if len(argv) not in (2, 3):
        print("usage : sovo_etat.py <journal> [<depuis>]", file=sys.stderr); return 2
    e = lire(argv[1], float(argv[2]) if len(argv) == 3 else None)
    print("SOVO_ETAT lance=%d micro=%s accessibilite=%s surveillance=%s lancement=%s" % (
        e.get("lance", 0), e.get("micro", "inconnu"), e.get("accessibilite", "non"), e.get("surveillance", "non"),
        (e.get("lancement") or "aucun").replace(" ", "T")))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
