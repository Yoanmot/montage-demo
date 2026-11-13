#!/usr/bin/env python3
"""generer.py : génère un son sur mesure avec ElevenLabs et le met aux règles du style (skill sound-design).

  python3 generer.py "<prompt en anglais>" <sortie.wav> [--duree 0.5] [--influence 0.6] [--garder-ms 120] [--depuis <mp3 déjà généré>]

Tous les sons du monteur sont générés avec ElevenLabs (ceux de la bibliothèque aussi). Ce script génère un son qui
manque à la bibliothèque. Clé : variable d'environnement ELEVENLABS_API_KEY, sinon la ligne ELEVENLABS_API_KEY=... de
~/.config/monteur-romain/.env (jamais écrite dans un fichier du dépôt, jamais affichée).
Cache : le brut de chaque génération est gardé sous l'empreinte de sa description (prompt, durée, influence) dans
~/.config/monteur-romain/sons-generes/ (ou $MONTEUR_SONS_CACHE) : la même description ne rappelle jamais l'API
(« CACHE » dans la sortie), d'une vidéo à l'autre. Le brut est aussi copié à côté du son (<sortie>.brut.mp3).
Traitement (règles STYLE.md « Sons et niveaux », chaîne du son du faisceau de la bibliothèque) :
  - filtre passe-haut 400 Hz, passe-bas 7 kHz, +4 dB à 3 kHz : énergie entre 1 et 5 kHz, rien dans le grave ;
  - coupé autour de son coup principal (le plus fort) : départ 3 ms avant l'attaque, fin quand il retombe à -40 dB
    du maximum, au plus --garder-ms ; rampes 2 ms à l'entrée et 15 ms à la sortie ;
  - crête à -6 dBFS (comme la bibliothèque ; le niveau final se règle au mix, crête toujours sous -1 dB).
Écrit <sortie>.wav (48 kHz mono 24 bits) et sa fiche <sortie>.json (debut_echantillon, durée, spectre), contrôle :
  crête <= -1 dBFS, part entre 1 et 5 kHz >= 40 %, part sous 300 Hz <= 5 %, durée <= 250 ms.
Lignes de sortie : GENERE <fichier> puis CONFORME, ou NON_CONFORME <raisons> (code 2), ou ERREUR (code 1).
Ensuite : poser le son (gestes.json, geste sur_mesure), puis l'écouter en contexte (ecoute.py --autour <image>)."""
import argparse
import hashlib
import json
import os
import shutil
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import numpy as np  # noqa: E402
import audio as A  # noqa: E402

API = "https://api.elevenlabs.io/v1/sound-generation"
FILTRE = "highpass=f=400:p=2,lowpass=f=7000:p=2,equalizer=f=3000:t=q:w=1:g=4"
CRETE = -6.0
ENTREE_MS, SORTIE_MS, AVANT_MS = 2, 15, 3


CONFIG = Path.home() / ".config" / "monteur-romain"


def cle_api():
    """La clé ElevenLabs : variable d'environnement, sinon ~/.config/monteur-romain/.env. Jamais affichée."""
    cle = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    env = CONFIG / ".env"
    if not cle and env.exists():
        for l in env.read_text(encoding="utf-8").splitlines():
            k, _, v = l.strip().partition("=")
            if k.strip() == "ELEVENLABS_API_KEY":
                cle = v.strip().strip('"').strip("'")
    if not cle:
        sys.exit("ERREUR CLE_MANQUANTE : pas de clé ElevenLabs (ELEVENLABS_API_KEY dans ~/.config/monteur-romain/.env) : préviens Yoan.")
    return cle


def cache_de(prompt, duree, influence):
    d = Path(os.environ.get("MONTEUR_SONS_CACHE") or (CONFIG / "sons-generes")).expanduser()
    h = hashlib.sha1(json.dumps([prompt.strip(), round(duree, 3), round(influence, 3)]).encode()).hexdigest()[:16]
    return d / f"{h}.mp3"


def appeler(prompt, duree, influence, brut):
    """Génère le son (ou le reprend du cache si la même description a déjà été générée). Renvoie True si l'API a été
    appelée (crédits consommés)."""
    cache = cache_de(prompt, duree, influence)
    if cache.exists():
        shutil.copy(cache, brut)
        return False
    corps = {"text": prompt, "prompt_influence": influence, "duration_seconds": duree}
    req = urllib.request.Request(API, data=json.dumps(corps).encode(), method="POST",
                                 headers={"xi-api-key": cle_api(), "Content-Type": "application/json", "Accept": "audio/mpeg"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            donnees = r.read()
            cout = r.headers.get("character-cost") or r.headers.get("x-character-count")
    except urllib.error.HTTPError as e:
        sys.exit(f"ERREUR API_ELEVENLABS {e.code} : {e.read()[:300].decode(errors='replace')}")
    except urllib.error.URLError as e:
        sys.exit(f"ERREUR RESEAU : {e.reason}")
    brut.write_bytes(donnees)
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_bytes(donnees)
    cache.with_suffix(".json").write_text(json.dumps(dict(prompt=prompt, duree=duree, influence=influence, credits=cout),
                                                     ensure_ascii=False, indent=1))
    print(f"APPEL_ELEVENLABS {duree:g} s demandées" + (f", {cout} crédits" if cout else ""))
    return True


def couper(x, garder_ms):
    e = A.env(x); m = e.max(); pk = int(np.argmax(e))
    a = pk
    while a > 0 and e[a] > m * 0.1:
        a -= 1
    debut = max(0, a - int(AVANT_MS / 1000 * A.SR))
    f = pk
    while f < len(e) - 1 and e[f] > m * 0.01:
        f += 1
    fin = min(len(x), f, debut + int(garder_ms / 1000 * A.SR))
    c = x[debut:fin].copy()
    ne, ns = int(ENTREE_MS / 1000 * A.SR), min(int(SORTIE_MS / 1000 * A.SR), len(c) // 2)
    c[:ne] *= np.linspace(0, 1, ne); c[-ns:] *= np.linspace(1, 0, ns)
    manque = int(AVANT_MS / 1000 * A.SR) - (a - debut)   # ElevenLabs commence souvent sur le coup : silence devant
    if manque > 0:
        c = np.concatenate([np.zeros(manque), c])
    return c * 10 ** (CRETE / 20) / np.abs(c).max(), debut, fin


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("prompt"); ap.add_argument("sortie")
    ap.add_argument("--duree", type=float, default=0.5, help="durée demandée à ElevenLabs, 0,5 s minimum")
    ap.add_argument("--influence", type=float, default=0.6)
    ap.add_argument("--garder-ms", type=float, default=120)
    ap.add_argument("--depuis", help="mp3 déjà généré (pas d'appel à l'API)")
    o = ap.parse_args()
    sortie = Path(o.sortie).resolve().with_suffix(".wav"); sortie.parent.mkdir(parents=True, exist_ok=True)
    brut = Path(o.depuis).resolve() if o.depuis else sortie.with_suffix(".brut.mp3")
    if not o.depuis:
        if not appeler(o.prompt, max(0.5, o.duree), o.influence, brut):
            print("CACHE même description déjà générée : aucun appel à ElevenLabs")
    x = A.lit(brut, FILTRE)
    c, d0, d1 = couper(x, o.garder_ms)
    A.ecrit(c, sortie, canaux=1)
    deb = A.attaque(c); pk = float(A.db(np.abs(c).max())); sp = A.spectre(c)
    F = dict(source=f"ElevenLabs / {brut.name}", prompt=o.prompt, filtre=FILTRE, coupe_s=[round(d0 / A.SR, 4), round(d1 / A.SR, 4)],
             duree_ms=round(len(c) / A.SR * 1000, 1), debut_ms=round(deb / A.SR * 1000, 2), debut_echantillon=deb,
             pic_ms=round(float(np.argmax(A.env(c))) / A.SR * 1000, 1), crete_dbfs=round(pk, 1),
             rms_actif_dbfs=round(A.rms_actif(c), 1), entree_ms=ENTREE_MS, sortie_ms=SORTIE_MS, **sp)
    raisons = []
    if pk > -1: raisons.append(f"crête {pk:.1f} dBFS au-dessus de -1")
    if sp["b1_5khz_pct"] < 40: raisons.append(f"seulement {sp['b1_5khz_pct']} % de l'énergie entre 1 et 5 kHz (40 % au moins)")
    if sp["sous_300hz_pct"] > 5: raisons.append(f"{sp['sous_300hz_pct']} % sous 300 Hz (5 % au plus)")
    if F["duree_ms"] > 250: raisons.append(f"{F['duree_ms']} ms, trop long pour un geste (250 ms au plus)")
    F["conforme"] = not raisons
    sortie.with_suffix(".json").write_text(json.dumps(F, ensure_ascii=False, indent=1))
    print(f"GENERE {sortie} ({F['duree_ms']} ms, attaque à {F['debut_ms']} ms, centre {sp['centre_spectre_hz']} Hz, "
          f"1-5 kHz {sp['b1_5khz_pct']} %, sous 300 Hz {sp['sous_300hz_pct']} %, crête {pk:.1f} dBFS)")
    if raisons:
        print("NON_CONFORME " + " ; ".join(raisons)); sys.exit(2)
    print("CONFORME")


if __name__ == "__main__":
    main()
