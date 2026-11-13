#!/usr/bin/env python3
"""b-roll.py : prépare les B-rolls d'une vidéo coupée par couper-silences (brique b-roll du monteur de Romain).

Chaque B-roll est un clip filmé par Romain, posé par ses mots (numéros de words.cut.json), jamais par un minutage : le
clip couvre l'image pendant que sa voix continue. Rien ne part sur un serveur. La vidéo n'est fabriquée que par la
brique rendu, en un seul passage depuis l'originale (le clip y est mis au cadre, à la cadence et en SDR).

  b-roll.py vignettes <dossier des clips>   une image par clip dans b-roll-vignettes/ (début, milieu, fin du clip)
  b-roll.py texte <dossier>-montage         écrit texte-b-roll.md : le texte, chaque mot précédé de son numéro
  b-roll.py preparer <dossier>-montage      lit b-roll.json, écrit b-roll.txt (la couche pour le rendu)

Calage, en images de la vidéo coupée (30 i/s) :
  - début : la coupe juste avant le premier mot si ce mot ouvre un morceau gardé (le clip cache la coupe), sinon une
    image avant l'attaque du mot ; fin : la coupe juste après le dernier mot s'il ferme un morceau, sinon la fin du mot.
    « coupes »: false dans l'entrée cale sur les mots seulement.
  - vitesse : 1 par défaut ; un nombre (2 = deux fois plus vite) ; « ajuster » = la partie du clip choisie (depart à
    jusqua, sinon jusqu'au bout du clip) passe exactement sur la durée du passage, accélérée ou ralentie (0,5 à 4).
  - le clip couvre toutes les images du passage, la dernière comprise (pts recalés en images exactes, dernière image
    du clip répétée si l'arrondi en manque une).
Codes de sortie : 0 ok · 2 fichier introuvable · 7 outil vidéo manquant · 13 b-roll.json illisible
"""
import json
import math
import re
import shutil
import subprocess
import sys
from pathlib import Path

FPS = 30
VIDEOS = {".mov", ".mp4", ".m4v", ".avi", ".mkv", ".hevc"}
FIN_PHRASE = re.compile(r"[.!?…]$")
VITESSE_MIN, VITESSE_MAX = 0.5, 4.0
PAUSE_MAX = 0.6   # sans coupe après le dernier mot : le clip reste jusqu'au mot suivant si la pause est courte


def say(m=""):
    print(m, flush=True)


def fail(code, m):
    print(m, flush=True)
    sys.exit(code)


def num(x):
    return f"{x:.4f}".rstrip("0").rstrip(".")


def outil(nom):
    for p in (f"/opt/homebrew/bin/{nom}", f"/usr/local/bin/{nom}", shutil.which(nom)):
        if p and Path(p).exists():
            return p
    fail(7, f"OUTIL_MANQUANT {nom} : installe ffmpeg (brew install ffmpeg).")


def duree(ffprobe, f):
    """Durée d'un clip en secondes : images comptées / cadence (la durée du conteneur omet la dernière image)."""
    r = subprocess.run([ffprobe, "-v", "error", "-select_streams", "v:0", "-count_packets", "-show_entries",
                        "stream=nb_read_packets,r_frame_rate,duration", "-of", "json", str(f)], capture_output=True, text=True)
    try:
        s = json.loads(r.stdout)["streams"][0]
    except Exception:
        fail(13, f"B-ROLL_ILLISIBLE : {f} n'est pas une vidéo lisible.")
    a, b = (s.get("r_frame_rate") or "0/1").split("/")
    cad = float(a) / max(1.0, float(b))
    if s.get("nb_read_packets") and cad > 0:
        return int(s["nb_read_packets"]) / cad
    return float(s.get("duration") or 0)


def mots(w):
    p = w / "words.cut.json"
    if not p.exists():
        fail(2, f"TEXTE_INTROUVABLE : lance d'abord couper-silences sur cette vidéo (il manque words.cut.json dans {w}).")
    return json.loads(p.read_text(encoding="utf-8-sig"))["words"]


def cmd_vignettes(d):
    d = Path(d).expanduser().resolve()
    if not d.is_dir():
        fail(2, f"DOSSIER_INTROUVABLE : {d}")
    ff, fp = outil("ffmpeg"), outil("ffprobe")
    out = d / "b-roll-vignettes"
    out.mkdir(exist_ok=True)
    n = 0
    for f in sorted(d.iterdir()):
        if f.suffix.lower() not in VIDEOS or not f.is_file():
            continue
        n += 1
        L = duree(fp, f)
        img = out / f"{f.stem}.jpg"
        t = [num(x) for x in (min(0.2, L / 4), L / 2, max(0, L - 0.3))]
        subprocess.run([ff, "-nostdin", "-v", "error", "-y", "-ss", t[0], "-i", str(f), "-ss", t[1], "-i", str(f), "-ss", t[2], "-i", str(f),
                        "-filter_complex", "[0:v]scale=-2:360[a];[1:v]scale=-2:360[b];[2:v]scale=-2:360[c];[a][b][c]hstack=3,format=yuvj420p",
                        "-frames:v", "1", "-q:v", "4", str(img)])
        say(f"  {f.name} : {num(round(L, 1))} s -> {img}")
    if n == 0:
        fail(2, f"AUCUN_CLIP : pas de vidéo dans {d}.")
    say(f"PRÊT clips={n} vignettes={out}")


def cmd_texte(w):
    w = Path(w).expanduser().resolve()
    W = mots(w)
    lignes, ligne = ["# Texte de la vidéo coupée, chaque mot précédé de son numéro", ""], []
    for i, m in enumerate(W):
        t = str(m["text"])
        if not t.strip():
            continue
        ligne.append(f"[{i}]{t}")
        if FIN_PHRASE.search(t.strip()):
            lignes.append(" ".join(ligne)); ligne = []
    if ligne:
        lignes.append(" ".join(ligne))
    out = w / "texte-b-roll.md"
    out.write_text("\n".join(lignes) + "\n", encoding="utf-8")
    say(f"PRÊT texte={out} mots={len(W)}")


def cmd_preparer(w):
    w = Path(w).expanduser().resolve()
    info = json.loads((w / "info.json").read_text(encoding="utf-8-sig"))
    W = mots(w)
    if not (w / "edl.json").exists():
        fail(2, "COUPES_INTROUVABLES : lance d'abord couper-silences (compiler) sur cette vidéo.")
    segs = json.loads((w / "edl.json").read_text(encoding="utf-8-sig"))["segments"]
    total = int(segs[-1]["outOutF"])
    bp = w / "b-roll.json"
    if not bp.exists():
        fail(2, f"B-ROLL_INTROUVABLE : écris d'abord b-roll.json dans {w}.")
    try:
        plan = json.loads(bp.read_text(encoding="utf-8-sig"))
    except Exception as e:
        fail(13, f"B-ROLL_ILLISIBLE : {e}")
    liste = [b for b in plan.get("brolls") or [] if b]
    if not liste:
        fail(13, "B-ROLL_ILLISIBLE : aucun B-roll dans b-roll.json (retire plutôt la couche b-roll du rendu).")
    fp = outil("ffprobe")
    # morceau gardé de chaque mot : premier et dernier mot de chaque morceau (edl.json « words »)
    ouvre = {int(s["words"][0]): int(s["outInF"]) for s in segs if s.get("words")}
    ferme = {int(s["words"][-1]): int(s["outOutF"]) for s in segs if s.get("words")}

    poses = []
    for n, b in enumerate(liste, 1):
        f = Path(str(b.get("fichier") or ""))
        if not f.is_file():
            fail(13, f"B-ROLL_ILLISIBLE : B-roll n°{n}, fichier introuvable : {f}")
        try:
            a = int(b["debut"])
        except Exception:
            fail(13, f"B-ROLL_ILLISIBLE : B-roll n°{n}, « debut » = numéro du premier mot couvert.")
        if not 0 <= a < len(W):
            fail(13, f"B-ROLL_ILLISIBLE : B-roll n°{n}, mot n°{a} inexistant (0 à {len(W) - 1}).")
        z = a
        if b.get("fin") is not None:
            z = int(b["fin"])
        else:   # sans fin : jusqu'au bout de la phrase où il commence
            while z < len(W) - 1 and not FIN_PHRASE.search(str(W[z]["text"]).strip()):
                z += 1
        if z < a or z >= len(W):
            fail(13, f"B-ROLL_ILLISIBLE : B-roll n°{n}, mots {a} à {z} invalides (début avant fin).")
        coupes = b.get("coupes", True) is not False
        if coupes and a in ouvre:
            i0, cale0 = ouvre[a], "la coupe"
        else:
            i0, cale0 = max(0, round(W[a]["start"] * FPS) - 1), "son mot"
        suivant = next((W[i] for i in range(z + 1, len(W)) if str(W[i]["text"]).strip()), None)
        if coupes and z in ferme:
            i1, cale1 = ferme[z], "la coupe"
        elif suivant is not None and suivant["start"] - W[z]["end"] <= PAUSE_MAX:
            i1, cale1 = round(suivant["start"] * FPS), "l'attaque du mot suivant"   # retour sur lui quand il reprend la parole
        else:
            i1, cale1 = math.ceil(W[z]["end"] * FPS - 1e-6), "la fin du mot"
        i1 = min(i1, total)
        N = i1 - i0
        depart = float(b.get("depart") or 0)
        L = duree(fp, f)
        jusqua = float(b["jusqua"]) if b.get("jusqua") is not None else L
        if depart < 0 or depart >= min(L, jusqua) - 0.3:
            fail(13, f"B-ROLL_ILLISIBLE : B-roll n°{n}, départ {num(depart)} s hors du clip ({num(round(L, 1))} s) ou après « jusqua ».")
        if jusqua > L + 0.05:
            fail(13, f"B-ROLL_ILLISIBLE : B-roll n°{n}, « jusqua » {num(jusqua)} s après la fin du clip ({num(round(L, 1))} s).")
        dispo = jusqua - depart
        v = b.get("vitesse", 1)
        if v == "ajuster":
            k = dispo / (N / FPS)
        else:
            try:
                k = float(v)
            except Exception:
                fail(13, f"B-ROLL_ILLISIBLE : B-roll n°{n}, vitesse « {v} » : un nombre (1 = normale) ou « ajuster ».")
        if not VITESSE_MIN - 1e-6 <= k <= VITESSE_MAX + 1e-6:
            fail(13, f"B-ROLL_ILLISIBLE : B-roll n°{n}, il faudrait passer le clip à la vitesse {k:.2f} pour couvrir le passage "
                     f"({num(round(N / FPS, 2))} s pour {num(round(dispo, 2))} s de clip) : hors de {VITESSE_MIN} à {VITESSE_MAX}. "
                     "Prends une autre partie du clip (depart, jusqua) ou un passage plus court.")
        court = False
        if dispo / k < N / FPS - 1e-6:   # le clip finit avant le passage : on revient sur lui plus tôt
            N = int(math.floor(dispo / k * FPS + 1e-6)); court = True
        if N < FPS // 2:
            fail(13, f"B-ROLL_ILLISIBLE : B-roll n°{n} trop court à l'écran (moins d'une demi-seconde).")
        phrase = " ".join(str(W[i]["text"]) for i in range(a, z + 1)).strip()
        poses.append(dict(n=n, f=f, i0=i0, N=N, depart=depart, k=k, court=court, phrase=phrase,
                          cale=(cale0, "la fin du clip" if court else cale1)))
    poses.sort(key=lambda p: p["i0"])
    for x, y in zip(poses, poses[1:]):
        if y["i0"] < x["i0"] + x["N"]:
            fail(13, f"B-ROLL_ILLISIBLE : les B-rolls n°{x['n']} et n°{y['n']} se chevauchent.")

    # La couche : un clip par entrée du rendu (entrées 1, 2… après la vidéo d'origine). Chaque clip : remis à sa vitesse,
    # à 30 i/s, recadré plein cadre, puis exactement N images (la dernière répétée si l'arrondi en manque une), posées
    # aux images i0 à i0 + N - 1 de la vidéo coupée (pts en images exactes, base 1/30). Son son à lui n'est pas gardé.
    L0, H0 = int(info["largeur"]), int(info["hauteur"])
    ent, parts, cur = [], [], "[ENTREE]"
    for k, p in enumerate(poses, 1):
        ent.append(f"ENTREE\t{num(p['depart'])}\t{num(p['N'] / FPS * p['k'])}\t{p['f']}")
        out = "[SORTIE]" if k == len(poses) else f"[bo{k}]"
        vit = f"setpts=(PTS-STARTPTS)/{num(p['k'])}," if abs(p["k"] - 1) > 1e-6 else "setpts=PTS-STARTPTS,"
        parts.append(f"[{k}:v]{vit}fps={FPS}:round=near,scale={L0}:{H0}:force_original_aspect_ratio=increase:flags=lanczos,"
                     f"crop={L0}:{H0},setsar=1,tpad=stop_mode=clone:stop=2,trim=end_frame={p['N']},"
                     f"settb=1/{FPS},setpts=N+{p['i0']}[bc{k}]")
        parts.append(f"{cur}[bc{k}]overlay=eof_action=pass:repeatlast=0:enable='between(n,{p['i0']},{p['i0'] + p['N'] - 1})'{out}")
        cur = f"[bo{k}]"
    (w / "b-roll.txt").write_text("# entrées (une par ligne : départ, durée dans le clip, fichier), puis le filtre\n"
                                  + "\n".join(ent) + "\nFILTRE\t" + ";".join(parts) + "\n", encoding="utf-8")
    say(f"PRÊT brolls={len(poses)}")
    for p in poses:
        vitesse = "" if abs(p["k"] - 1) < 1e-6 else " à la vitesse " + f"{p['k']:.2f}".replace(".", ",")
        msg = (f"  n°{p['n']} images {p['i0']} à {p['i0'] + p['N'] - 1} ({num(round(p['i0'] / FPS, 2))} s à "
               f"{num(round((p['i0'] + p['N']) / FPS, 2))} s, de {p['cale'][0]} à {p['cale'][1]}) : {p['f'].name}"
               f"{vitesse} sur « {p['phrase']} »")
        if p["court"]:
            msg += " (clip plus court que le passage : retour sur lui plus tôt ; « vitesse »: « ajuster » le remet sur tout le passage)"
        say(msg)


def main():
    if len(sys.argv) < 3 or sys.argv[1] not in ("vignettes", "texte", "preparer"):
        fail(1, "Usage : b-roll.py vignettes <dossier des clips> | texte <dossier>-montage | preparer <dossier>-montage")
    {"vignettes": cmd_vignettes, "texte": cmd_texte, "preparer": cmd_preparer}[sys.argv[1]](sys.argv[2])


if __name__ == "__main__":
    main()
