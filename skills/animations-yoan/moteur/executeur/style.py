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
