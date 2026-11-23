"""Lecture du style pour les modules Python de l'exécuteur (camera, detourage, son, rendu).
La SEULE source des valeurs est style/style.json (copie du style @ia.yoan dans le skill animations-yoan du monteur de
Yoan). Pas de variable MONTEUR_STYLE ici : dans le studio elle désigne le style de la bibliothèque de Romain (un nom de
dossier), pas ce fichier. Les chemins de fichiers du style sont relatifs à son dossier."""
import json, os
from pathlib import Path

ICI = Path(__file__).resolve().parent
STYLE_JSON = (ICI.parent / "style" / "style.json").resolve()
STYLE = json.loads(STYLE_JSON.read_text())
import shutil
FF = os.environ.get("FFMPEG") or shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"
FFPROBE = os.environ.get("FFPROBE") or shutil.which("ffprobe") or "/opt/homebrew/bin/ffprobe"


def fichier(rel):
    """Chemin réel d'un fichier du style (polices, sons, grain)."""
    return STYLE_JSON.parent / rel


IPS = STYLE["format"]["ips"]
LARGEUR, HAUTEUR = STYLE["format"]["largeur"], STYLE["format"]["hauteur"]


# Style de CETTE vidéo (2026-11-19) : le style ci-dessus est le défaut. Une demande de Yoan pour une vidéo seulement
# (police, couleur, taille ou arrivée des sous-titres, couleurs d'une animation...) s'écrit dans
# <dossier>-montage/style-video.json, clé « style » (mêmes clés que style.json, fusionnées en profondeur ; un chemin de
# police peut être complet). Les scripts qui la lisent l'appliquent ici (STYLE modifié sur place, pour tous les modules
# qui l'ont importé) et posent STYLE_VIDEO pour les pages des calques (calques/style.mjs). Sans fichier : rien ne change.
STYLE_VIDEO = "style-video.json"


def _fusion(cible, ajout):
    for k, v in ajout.items():
        if k.startswith("_"):
            continue
        if isinstance(v, dict) and isinstance(cible.get(k), dict):
            _fusion(cible[k], v)
        else:
            cible[k] = v


def appliquer_style_video(w):
    """Applique la clé « style » de <w>/style-video.json au style. Rend le dict appliqué (ou None).
    Écran partagé (<w>/ecran-partage.json, brique ecran-partage) : sa clé « style » (le format : sous-titres sur la
    jointure...) passe d'abord, la demande de Yoan pour cette vidéo par-dessus ; les pages lisent alors la fusion des
    deux, écrite dans <w>/animations-yoan/style-applique.json."""
    p = Path(w) / STYLE_VIDEO
    fmt = Path(w) / "ecran-partage.json"
    couches = []
    for f in (fmt, p):
        if not f.exists():
            continue
        d = json.loads(f.read_text(encoding="utf-8"))
        sv = d.get("style") if isinstance(d, dict) else None
        if not sv:
            continue
        inconnues = [k for k in sv if k not in STYLE and not k.startswith("_")]
        if inconnues:
            raise ValueError(f"STYLE_VIDEO_CLE_INCONNUE {', '.join(inconnues)} dans {f} (clés de style.json : {', '.join(k for k in STYLE if not k.startswith('_'))})")
        for k in ("format",):
            if k in sv:
                raise ValueError(f"STYLE_VIDEO_CLE_INTERDITE {k} dans {f} : le format de la vidéo ne change pas")
        couches.append((f, sv))
    if not couches:
        os.environ.pop("STYLE_VIDEO", None)
        return None
    total = {}
    for _, sv in couches:
        _fusion(STYLE, sv)
        _fusion(total, json.loads(json.dumps(sv)))
    if len(couches) == 1 and couches[0][0] == p:
        os.environ["STYLE_VIDEO"] = str(p.resolve())
    else:
        a = Path(w) / "animations-yoan"; a.mkdir(exist_ok=True)
        out = a / "style-applique.json"
        out.write_text(json.dumps({"style": total}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        os.environ["STYLE_VIDEO"] = str(out.resolve())
    return total
