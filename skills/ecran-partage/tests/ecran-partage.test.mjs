// Écran partagé (monteur de Yoan, 2026-11-23) : sa caméra en haut, son écran en bas, filmés séparément et calés par
// le son. Synchro (décalage connu, refus quand elle n'est pas sûre), composition et coupes appliquées aux deux moitiés
// dans le graphe du rendu, règles du plan, et rien ne change sans ecran-partage.json (Romain).
// Lancer : node --test skills/ecran-partage/tests/*.test.mjs   (python3 du système, node et ffmpeg ; ~1 min)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SK = path.resolve(ICI, '..', '..');
const EP = path.join(SK, 'ecran-partage', 'scripts', 'ecran_partage.py');
const YOAN = path.join(SK, 'animations-yoan', 'scripts', 'yoan.py');
const FIXTURE = path.join(SK, 'rendu', 'tests', 'fixture-essai');
const PY = '/usr/bin/python3';
const FF = ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'].find((f) => fs.existsSync(f)) || 'ffmpeg';
const env = (o = {}) => { const e = { ...process.env }; delete e.STYLE_VIDEO; delete e.ENCRE_GLYPHES; return { ...e, STUDIO_CLIENT: 'yoan', ...o }; };
const py = (args, o = {}) => spawnSync(PY, args, { env: env(o), encoding: 'utf8' });
const ff = (args) => execFileSync(FF, ['-v', 'error', '-y', ...args]);

const D = fs.mkdtempSync(path.join(os.tmpdir(), 'ecran partage '));   // un espace dans le chemin, comme le Workspace
const f = (n) => path.join(D, n);
const DECALAGE = 2.345;   // l'écran a démarré 2,345 s avant la caméra

// Un son de parole simulé (bruit rose à l'enveloppe irrégulière), et un autre qui n'a rien à voir.
ff(['-f', 'lavfi', '-i', 'anoisesrc=d=40:c=pink:r=48000:a=0.5:s=7', '-af', "volume='0.2+0.8*abs(sin(2.1*t)*sin(0.77*t+1)*sin(5.3*t))':eval=frame", '-ac', '1', f('voix.wav')]);
ff(['-f', 'lavfi', '-i', 'anoisesrc=d=40:c=pink:r=48000:a=0.5:s=99', '-af', "volume='0.2+0.8*abs(sin(1.3*t)*sin(0.51*t+2)*sin(4.1*t))':eval=frame", '-ac', '1', f('autre.wav')]);
// Caméra (portrait) : rouge avant 10 s, verte après ; la voix à partir de 5 s. Écran : bleu avant 12,345 s (= 10 s de la
// caméra), jaune après ; la même voix décalée, passée par un autre micro (filtrée) avec un léger bruit.
ff(['-f', 'lavfi', '-i', "color=c=red:s=360x640:r=30:d=30,geq=r='if(lt(T,10),255,0)':g='if(lt(T,10),0,200)':b=0",
  '-ss', '5', '-t', '30', '-i', f('voix.wav'), '-shortest', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', f('camera.mp4')]);
ff(['-f', 'lavfi', '-i', `color=c=blue:s=1100x940:r=30:d=34,geq=r='if(lt(T,${10 + DECALAGE}),0,240)':g='if(lt(T,${10 + DECALAGE}),0,220)':b='if(lt(T,${10 + DECALAGE}),230,0)'`,
  '-ss', String(5 - DECALAGE), '-t', '34', '-i', f('voix.wav'), '-f', 'lavfi', '-i', 'anoisesrc=d=34:c=white:r=48000:a=0.03:s=3',
  '-filter_complex', '[1:a]highpass=f=200,lowpass=f=5000,volume=0.7[v];[v][2:a]amix=inputs=2:duration=first:normalize=0[a]',
  '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', f('ecran 2026-11-23.mp4')]);
ff(['-f', 'lavfi', '-i', 'color=c=blue:s=1100x940:r=30:d=34', '-t', '34', '-i', f('autre.wav'), '-map', '0:v', '-map', '1:a',
  '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', f('ecran-autre.mp4')]);
ff(['-f', 'lavfi', '-i', 'color=c=blue:s=1920x1080:r=30:d=34', '-c:v', 'libx264', '-preset', 'ultrafast', f('ecran-muet.mp4')]);

// Un dossier de montage de la caméra : deux passages gardés, [2 s, 5 s) et [12 s, 15 s) (une coupe à 3 s).
function montage(nom) {
  const w = path.join(D, nom, 'face', 'camera-montage');
  fs.mkdirSync(w, { recursive: true });
  fs.copyFileSync(f('camera.mp4'), path.join(D, nom, 'face', 'camera.mp4'));
  fs.writeFileSync(path.join(w, 'info.json'), JSON.stringify({ video: path.join(D, nom, 'face', 'camera.mp4'), fps: 30, largeur: 360, hauteur: 640, hdr: false }));
  const seg = (i, a, b, o) => ({ i, srcInF: a, srcOutF: b, outInF: o, outOutF: o + b - a, srcIn: a / 30, srcOut: b / 30, outIn: o / 30, outOut: (o + b - a) / 30, words: [0, 0], contiguous_prev: false });
  fs.writeFileSync(path.join(w, 'edl.json'), JSON.stringify({ fps: 30, segments: [seg(0, 60, 150, 0), seg(1, 360, 450, 90)], stats: { out_frames: 180 } }));
  fs.writeFileSync(path.join(w, 'filtre.txt'), [
    '[0:v]fps=30:round=near,split=2[vi0][vi1]', '[0:a]aresample=48000,asplit=2[ai0][ai1]',
    '[vi0]trim=start_frame=60:end_frame=150,setpts=PTS-STARTPTS[v0]', '[ai0]atrim=start_sample=96000:end_sample=240000,asetpts=PTS-STARTPTS[a0]',
    '[vi1]trim=start_frame=360:end_frame=450,setpts=PTS-STARTPTS[v1]', '[ai1]atrim=start_sample=576000:end_sample=720000,asetpts=PTS-STARTPTS[a1]',
    '[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]'].join(';\n'));
  return w;
}

test('synchro : le décalage connu est retrouvé à la milliseconde, contrôlé sur plusieurs passages', () => {
  const r = py([EP, 'synchro', f('camera.mp4'), f('ecran 2026-11-23.mp4')]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const m = JSON.parse(r.stdout.split('\n')[0]);
  assert.ok(Math.abs(m.decalage_s - DECALAGE) < 0.002, `décalage ${m.decalage_s} au lieu de ${DECALAGE}`);
  assert.ok(m.passages.length >= 2 && m.passages_d_accord === m.passages.length, JSON.stringify(m.passages));
  assert.match(r.stdout, /PRÊT synchro : décalage \+2\.34\d+ s/);
});

test('synchro : un enregistrement d\'un autre tournage, ou sans son, est refusé avec un message clair (code 3)', () => {
  const r = py([EP, 'synchro', f('camera.mp4'), f('ecran-autre.mp4')]);
  assert.equal(r.status, 3, r.stdout);
  assert.match(r.stdout, /^SYNCHRO_INCERTAINE : je n'arrive pas à caler l'enregistrement d'écran sur ta vidéo par le son/);
  const m = py([EP, 'synchro', f('camera.mp4'), f('ecran-muet.mp4')]);
  assert.equal(m.status, 3, m.stdout);
  assert.match(m.stdout, /^SYNCHRO_IMPOSSIBLE : l'enregistrement d'écran n'a pas de son/);
  // preparer refuse de même et n'écrit rien
  const w = montage('refus');
  const p = py([EP, 'preparer', w, f('ecran-autre.mp4')]);
  assert.equal(p.status, 3, p.stdout);
  assert.ok(!fs.existsSync(path.join(w, 'ecran-partage.json')));
});

test('composition : caméra en haut, écran calé en bas, 1080 x 1920, et la coupe tombe au même instant sur les deux moitiés', () => {
  const w = montage('compo');
  const p = py([EP, 'preparer', w, f('ecran 2026-11-23.mp4')]);
  assert.equal(p.status, 0, p.stdout + p.stderr);
  const d = JSON.parse(fs.readFileSync(path.join(w, 'ecran-partage.json'), 'utf8'));
  assert.ok(Math.abs(d.debut_ecran_s - DECALAGE) < 0.002);
  assert.equal(d.cadre_ecran.mode, 'remplir');             // 1100 x 940 : presque le rapport de la moitié (1080 x 960)
  assert.equal(d.camera.largeur * 8, d.camera.hauteur * 9); // la caméra garde le rapport de sa moitié (9:8), pas déformée
  // Le graphe du rendu (filtre_coupes), joué sur la vidéo coupée : images 45 (premier passage) et 135 (après la coupe)
  const code = `import sys, json; sys.path.insert(0, ${JSON.stringify(path.join(SK, 'rendu', 'scripts'))}); import rendu as R
from pathlib import Path
w = Path(sys.argv[1]); info = json.loads((w / "info.json").read_text()); v = R.video_de(w, info)
g = R.filtre_coupes(w, v, R.trouve_ffmpeg(), w / "rendu-cache", None) + ";\\n[a]anullsink;\\n[v]select='eq(n\\\\,45)+eq(n\\\\,89)+eq(n\\\\,90)+eq(n\\\\,135)',format=rgb24[o]"
(w / "g.txt").write_text(g); print(R.trouve_ffmpeg())`;
  const r = py(['-c', code, w]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const sortie = execFileSync(r.stdout.trim(), ['-v', 'error', '-i', path.join(w, '..', 'camera.mp4'), '-/filter_complex', path.join(w, 'g.txt'),
    '-map', '[o]', '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 64 * 1024 * 1024 });
  const T = 1080 * 1920 * 3;
  assert.equal(sortie.length, 4 * T, 'quatre images 1080 x 1920');
  const px = (k, y) => { const o = k * T + (y * 1080 + 540) * 3; return [...sortie.subarray(o, o + 3)]; };
  const proche = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 40);
  // avant la coupe : caméra rouge (t < 10 s), écran bleu ; après : verte et jaune, sur la même image
  for (const k of [0, 1]) { assert.ok(proche(px(k, 480), [255, 0, 0]), `haut ${px(k, 480)}`); assert.ok(proche(px(k, 1440), [0, 0, 230]), `bas ${px(k, 1440)}`); }
  for (const k of [2, 3]) { assert.ok(proche(px(k, 480), [0, 200, 0]), `haut ${px(k, 480)}`); assert.ok(proche(px(k, 1440), [240, 220, 0]), `bas ${px(k, 1440)}`); }
  // la jointure : exactement à y 960
  assert.ok(proche(px(0, 958), [255, 0, 0]) && proche(px(0, 962), [0, 0, 230]));
  // une image composée pour mesurer la tête
  const im = py([EP, 'image', w, '3', path.join(w, 'i.png')]);
  assert.equal(im.status, 0, im.stdout + im.stderr);
});

test('écran 16:9 : ajusté entier sur un fond de la couleur de ses bords, jamais déformé', () => {
  const w = montage('large');
  const p = py([EP, 'preparer', w, f('ecran-muet.mp4'), '--decalage', '0']);
  assert.equal(p.status, 0, p.stdout + p.stderr);
  const d = JSON.parse(fs.readFileSync(path.join(w, 'ecran-partage.json'), 'utf8'));
  assert.equal(d.cadre_ecran.mode, 'ajuster');
  assert.equal(d.synchro.methode, 'à la main');
  assert.match(fs.readFileSync(path.join(w, 'filtre.txt'), 'utf8'), /^\[0:v\]fps=30/);   // filtre.txt n'est jamais réécrit
});

test('sans ecran-partage.json (Romain, et les autres formats de Yoan) : graphe et étalonnage inchangés', () => {
  for (const client of ['romain', 'yoan']) {
    const w = montage(`sans-${client}`);
    const code = `import sys, json; sys.path.insert(0, ${JSON.stringify(path.join(SK, 'rendu', 'scripts'))}); import rendu as R
from pathlib import Path
w = Path(sys.argv[1]); info = json.loads((w / "info.json").read_text())
C0 = R.constantes(R.trouve_node(), R.bibliotheque()); C = R.constantes(R.trouve_node(), R.bibliotheque(), w)
g = R.filtre_coupes(w, R.video_de(w, info), R.trouve_ffmpeg(), w / "rendu-cache", C.get("ETALONNAGE_CAMERA"))
print(json.dumps([g == (w / "filtre.txt").read_text().strip(), C["ETALONNAGE"] == C0["ETALONNAGE"], "ETALONNAGE_CAMERA" in C]))`;
    const r = py(['-c', code, w], { STUDIO_CLIENT: client });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.deepEqual(JSON.parse(r.stdout), [true, true, false], client);
  }
  // avec : l'étalonnage passe sur la caméra seule, dans le graphe
  const w = montage('avec');
  assert.equal(py([EP, 'preparer', w, f('ecran 2026-11-23.mp4')]).status, 0);
  const code = `import sys, json; sys.path.insert(0, ${JSON.stringify(path.join(SK, 'rendu', 'scripts'))}); import rendu as R
from pathlib import Path
w = Path(sys.argv[1]); info = json.loads((w / "info.json").read_text())
C0 = R.constantes(R.trouve_node(), R.bibliotheque()); C = R.constantes(R.trouve_node(), R.bibliotheque(), w)
g = R.filtre_coupes(w, R.video_de(w, info), R.trouve_ffmpeg(), w / "rendu-cache", C.get("ETALONNAGE_CAMERA"))
cam = g.split("[epc]")[0]
print(json.dumps([C["ETALONNAGE"], C["ETALONNAGE_CAMERA"] == C0["ETALONNAGE"], C0["ETALONNAGE"] in cam, "movie=" in g]))`;
  const r = py(['-c', code, w]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), ['null', true, true, true]);
});

test('plan : en écran partagé les coupes restent visibles, zoom et demi-écran refusés ; ailleurs, rien ne change', () => {
  const nu = fs.mkdtempSync(path.join(os.tmpdir(), 'ep-plan-'));
  const w = path.join(nu, 'essai-montage');
  fs.cpSync(FIXTURE, w, { recursive: true });
  const plan = (elements) => fs.writeFileSync(path.join(w, 'plan-montage.json'), JSON.stringify({ contrat: 'timeline/1', densite: 'sobre', ambiance: null, elements }));
  const st = { type: 'sous_titres', auto: true, dores: [], forts: [] };
  plan([st]);
  const sans = py([YOAN, 'valider', w]);
  assert.equal(sans.status, 3, sans.stdout);
  assert.match(sans.stdout, /jointure 1 \(@coupe1.*visible/);
  fs.writeFileSync(path.join(w, 'ecran-partage.json'), JSON.stringify({ version: 1, ecran: '/nulle/part.mp4', debut_ecran_s: 0, camera: {}, cadre_ecran: {}, style: {} }));
  const avec = py([YOAN, 'valider', w]);
  assert.equal(avec.status, 0, avec.stdout);
  plan([st, { type: 'zoom', geste: 'eclair', a: 'exercices', sortie: { geste: 'coupe', a: '@coupe3' } }]);
  const z = py([YOAN, 'valider', w]);
  assert.equal(z.status, 3, z.stdout);
  assert.match(z.stdout, /pas de zoom en écran partagé/);
  const zo = py([YOAN, 'zooms', w]);
  assert.equal(zo.status, 3);
  assert.match(zo.stdout, /^ÉCRAN_PARTAGÉ : pas de zoom/m);
});

test('style du format : sous-titres sur la jointure, sous la demande de la vidéo (style-video.json passe devant)', () => {
  const nu = fs.mkdtempSync(path.join(os.tmpdir(), 'ep-style-'));
  const w = path.join(nu, 'essai-montage');
  fs.cpSync(FIXTURE, w, { recursive: true });
  const code = `import sys, json, os; sys.path.insert(0, ${JSON.stringify(path.join(SK, 'animations-yoan', 'scripts'))}); import plan as P
P.style_video(sys.argv[1]); print(json.dumps([P.STYLE["sousTitres"]["top"], P.STYLE["hook"]["secondaire"]["centreY"], os.environ.get("STYLE_VIDEO", "")]))`;
  const lire = () => { const r = py(['-c', code, w]); assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout); };
  const [top0, sec0, sv0] = lire();
  assert.equal(sv0, '');
  fs.writeFileSync(path.join(w, 'ecran-partage.json'), JSON.stringify({ style: { sousTitres: { top: 882 }, hook: { secondaire: { centreY: 960 } } } }));
  const [top1, sec1, sv1] = lire();
  assert.deepEqual([top1, sec1], [882, 960]);
  assert.notEqual(top0, 882);
  assert.equal(JSON.parse(fs.readFileSync(sv1, 'utf8')).style.sousTitres.top, 882);
  fs.writeFileSync(path.join(w, 'style-video.json'), JSON.stringify({ style: { sousTitres: { top: 800 } } }));
  const [top2, sec2] = lire();
  assert.deepEqual([top2, sec2], [800, 960]);
  assert.ok(sec0 !== 960);
});
