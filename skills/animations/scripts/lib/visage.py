#!/usr/bin/env python3
"""visage.py : où sont ses yeux et sa bouche sur une fenêtre de la vidéo coupée (Apple Vision, la même détection que la
brique zooms), pour qu'aucun texte de l'accroche ne couvre ses yeux ni sa bouche.

Usage : visage.py <vidéo coupée> <image_debut> <nb_images> [pas]
Sortie JSON (px du 1080 x 1920) : { "zones": [{ "image": n, "x0", "x1", "y0", "y1", "yeux": [x, y] }], "vues": k, "mesurees": m }
Zone d'une image : de 0,45 x la largeur du visage au-dessus de ses yeux (sourcils) à 0,75 x la largeur sous ses yeux (la
bouche, sans le menton), sur la largeur du visage. Une image sans visage trouvé n'a pas de zone.
Dépendances : /usr/bin/python3 avec pyobjc (Quartz, Vision), ffmpeg."""
import json, shutil, subprocess, sys, tempfile
from pathlib import Path

W, H = 1080, 1920
AU_DESSUS, AU_DESSOUS = 0.45, 0.75


def visage(png):
    import Quartz, Vision
    from Foundation import NSURL
    src = Quartz.CGImageSourceCreateWithURL(NSURL.fileURLWithPath_(str(png)), None)
    cg = Quartz.CGImageSourceCreateImageAtIndex(src, 0, None)
    req = Vision.VNDetectFaceLandmarksRequest.alloc().init()
    h = Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(cg, {})
    ok, _ = h.performRequests_error_([req], None)
    if not ok or not req.results(): return None
    o = max(req.results(), key=lambda r: r.boundingBox().size.width * r.boundingBox().size.height)
    bb, lm = o.boundingBox(), o.landmarks()
    pts = []
    for reg in (lm.leftPupil(), lm.rightPupil()) if lm else ():
        if reg is not None and reg.pointCount() > 0:
            p = reg.normalizedPoints()[0]
            pts.append((bb.origin.x + p.x * bb.size.width, bb.origin.y + p.y * bb.size.height))
    if len(pts) == 2: ex, ey = (pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2
    else: ex, ey = bb.origin.x + bb.size.width / 2, bb.origin.y + bb.size.height * 0.62
    lv = bb.size.width * W
    x, y = ex * W, (1 - ey) * H
    return dict(x0=round(bb.origin.x * W, 1), x1=round((bb.origin.x + bb.size.width) * W, 1),
                y0=round(y - AU_DESSUS * lv, 1), y1=round(y + AU_DESSOUS * lv, 1), yeux=[round(x, 1), round(y, 1)])


def main():
    if len(sys.argv) < 4: print("Usage : visage.py <vidéo coupée> <image_debut> <nb_images> [pas]"); sys.exit(1)
    video, debut, n = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    pas = int(sys.argv[4]) if len(sys.argv) > 4 else 10
    ff = shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"
    d = Path(tempfile.mkdtemp(prefix="visage-"))
    try:
        subprocess.run([ff, "-nostdin", "-v", "error", "-i", video, "-vf",
                        f"select='between(n\\,{debut}\\,{debut + n - 1})*not(mod(n-{debut}\\,{pas}))',scale={W}:{H}",
                        "-vsync", "0", str(d / "f%04d.png")], check=True)
        zones, vues = [], 0
        for k, png in enumerate(sorted(d.glob("f*.png"))):
            vues += 1
            z = visage(png)
            if z: zones.append(dict(image=debut + k * pas, **z))
        print(json.dumps(dict(zones=zones, vues=vues, mesurees=len(zones))))
    finally:
        shutil.rmtree(d, ignore_errors=True)


if __name__ == "__main__":
    main()
