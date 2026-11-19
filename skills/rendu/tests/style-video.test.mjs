// Style de CETTE vidéo (style-video.json du dossier de montage, 2026-11-19) : le style du client reste le défaut, un
// réglage pour une vidéo change l'étalonnage (rendu, aperçu, planche) et les sous-titres (police, couleur, taille,
// arrivée des mots) de cette vidéo seulement. Sans fichier : rien ne change.
// Lancer : node --test skills/rendu/tests/*.test.mjs   (python3, node et ffmpeg ; aucune vidéo, aucun rendu)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SK = path.resolve(ICI, '..', '..');
const FIXTURE = path.join(ICI, 'fixture-essai');
const PY = '/usr/bin/python3';
const SATOSHI = path.join(SK, 'animations', 'bibliotheque', 'styles', 'yoan', 'fonts', 'Satoshi-Black.ttf');

function dossier(styleVideo) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'style-video-'));
  const w = path.join(d, 'essai-montage');
  fs.cpSync(FIXTURE, w, { recursive: true });
  if (styleVideo) fs.writeFileSync(path.join(w, 'style-video.json'), JSON.stringify(styleVideo));
  return w;
}
const env = (o = {}) => { const e = { ...process.env }; delete e.STYLE_VIDEO; delete e.ENCRE_GLYPHES; return { ...e, ...o }; };

function etalonnage(w, client = 'yoan') {
  const code = `import sys, json; sys.path.insert(0, ${JSON.stringify(path.join(SK, 'rendu', 'scripts'))}); import rendu as R
C = R.constantes(R.trouve_node(), R.bibliotheque(), ${w ? 'sys.argv[1]' : 'None'}); print(json.dumps(C["ETALONNAGE"]))`;
  const r = spawnSync(PY, ['-c', code, ...(w ? [w] : [])], { env: env({ STUDIO_CLIENT: client }), encoding: 'utf8' });
  return { code: r.status, sortie: r.stdout.trim(), erreur: r.stdout + r.stderr };
}

test('étalonnage : sans style-video.json, celui du style ; avec, celui de la vidéo (remplacé ou complété)', () => {
  for (const client of ['yoan', 'romain']) {
    const style = JSON.parse(etalonnage(null, client).sortie);
    assert.equal(JSON.parse(etalonnage(dossier(), client).sortie), style, `${client} : sans fichier, rien ne change`);
    assert.equal(JSON.parse(etalonnage(dossier({ style: {} }), client).sortie), style, `${client} : fichier sans étalonnage`);
    const autre = 'colortemperature=temperature=5800:mix=0.30,eq=contrast=1.02';
    assert.equal(JSON.parse(etalonnage(dossier({ etalonnage: autre }), client).sortie), autre);
    assert.equal(JSON.parse(etalonnage(dossier({ etalonnage_en_plus: 'eq=brightness=0.04' }), client).sortie), `${style},eq=brightness=0.04`);
  }
});

test('étalonnage : une chaîne fausse ou une clé inconnue est refusée tout de suite', () => {
  const faux = etalonnage(dossier({ etalonnage: 'pasunfiltre=3' }));
  assert.equal(faux.code, 3); assert.match(faux.erreur, /STYLE_VIDEO_ETALONNAGE_FAUX/);
  const cle = etalonnage(dossier({ etalonage: 'eq=contrast=1' }));
  assert.equal(cle.code, 3); assert.match(cle.erreur, /STYLE_VIDEO_CLE_INCONNUE etalonage/);
});

function sousTitresYoan(w) {
  const r = spawnSync('python3', [path.join(SK, 'sous-titres-yoan', 'scripts', 'sous-titres.py'), 'preparer', w],
    { env: env({ STUDIO_CLIENT: 'yoan' }), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return fs.readFileSync(path.join(w, 'calques', 'st00', 'index.html'), 'utf8');
}
const arrivees = (html) => [...html.matchAll(/tl\.fromTo\('#sg(\d+)m(\d+)t?', \{ opacity: 0, filter: 'blur\((\d+)px\)'([^}]*)\}, \{[^}]*duration: ([\d.]+)[^}]*\}, ([\d.]+)\)/g)]
  .map(([, g, m, flou, de, duree, t]) => ({ g: +g, m: +m, flou: +flou, de: de.trim(), duree: +duree, t: +t }));

test('sous-titres de Yoan : sans réglage, la page est la même ; avec, l\'arrivée des mots change pour cette vidéo', { skip: !fs.existsSync(SATOSHI) && 'Satoshi non posée' }, () => {
  const ref = sousTitresYoan(dossier());
  assert.equal(sousTitresYoan(dossier()), ref, 'deux préparations sans réglage : même page');
  assert.equal(sousTitresYoan(dossier({ pourquoi: 'rien pour les sous-titres', etalonnage: 'eq=contrast=1.02' })), ref,
    'un réglage d\'étalonnage seul ne touche pas aux sous-titres');
  const a0 = arrivees(ref);
  assert.ok(a0.length >= 20 && a0.every((a) => a.flou === 14 && a.duree === 0.22 && a.de === ''), 'style de Yoan : flou 14 px en 0,22 s');

  const simple = sousTitresYoan(dossier({ style: { sousTitres: { entree: { flou: 0, duree: 0.06 } } } }));
  const a1 = arrivees(simple);
  assert.equal(a1.length, a0.length);
  assert.ok(a1.every((a) => a.flou === 0 && a.duree === 0.06), 'arrivée simple : sans flou, 0,06 s');
  assert.deepEqual(a1.map((a) => a.t), a0.map((a) => a.t), 'mêmes instants : chaque mot arrive toujours sur sa voix');

  const groupe = arrivees(sousTitresYoan(dossier({ style: { sousTitres: { entree: { mode: 'groupe', montee: 12, echelle: 0.9 } } } })));
  for (const g of new Set(groupe.map((a) => a.g))) {
    const ts = new Set(groupe.filter((a) => a.g === g).map((a) => a.t));
    assert.equal(ts.size, 1, `groupe ${g} : tous ses mots arrivent ensemble`);
  }
  assert.ok(groupe.every((a) => a.de.includes('y: 12') && a.de.includes('scale: 0.9')));
});

test('sous-titres de Yoan : couleur, taille et autre police pour une vidéo', { skip: !fs.existsSync(SATOSHI) && 'Satoshi non posée' }, () => {
  const anton = path.join(SK, 'animations-yoan', 'moteur', 'style', 'polices', 'Anton-Regular.ttf');
  const w = dossier({ style: {
    polices: { videoPolice: { fichier: anton, famille: 'Anton', poids: 400 } },
    sousTitres: { police: 'videoPolice', taille: 60, couleur: '#FFFFFF', couleurDore: '#7FD1FF' } } });
  const html = sousTitresYoan(w);
  assert.match(html, /font-family:'Anton';font-weight:400;font-size:60px;line-height:1\.12;color:#FFFFFF;/);
  assert.match(html, /\.k\{color:#7FD1FF;text-shadow:0 0 [^;]*rgba\(127,209,255,/);
  assert.ok(fs.existsSync(path.join(w, 'calques', 'st00', 'Anton-Regular.ttf')), 'la police est copiée à côté de la page');
  assert.ok(fs.readdirSync(path.join(w, 'animations-yoan')).some((f) => /^glyphes-.*\.json$/.test(f)), 'mesures de la police faites');
});

test('sous-titres de Romain : SOUS_TITRES de la vidéo lus par commun.mjs seulement avec STYLE_VIDEO', () => {
  const commun = pathToFileURL(path.join(SK, 'animations', 'bibliotheque', 'commun.mjs')).href;
  const lit = (e) => JSON.parse(execFileSync('node', ['--input-type=module', '-e',
    `const m = await import(${JSON.stringify(commun)}); console.log(JSON.stringify({ st: m.SOUS_TITRES, et: m.ETALONNAGE }))`], { env: env(e), encoding: 'utf8' }));
  const ref = lit({ STUDIO_CLIENT: 'romain' });
  const w = dossier({ style: { SOUS_TITRES: { taille: 0.05, entree: { duree: 0.05 } } } });
  const sv = lit({ STUDIO_CLIENT: 'romain', STYLE_VIDEO: path.join(w, 'style-video.json') });
  assert.equal(sv.st.taille, 0.05); assert.equal(sv.st.entree.duree, 0.05);
  assert.equal(sv.st.entree.montee, ref.st.entree.montee, 'le reste du style ne bouge pas');
  assert.equal(sv.et, ref.et, 'l\'étalonnage passe par le rendu, pas par commun.mjs');
  assert.deepEqual(lit({ STUDIO_CLIENT: 'romain', STYLE_VIDEO: path.join(dossier(), 'style-video.json') }), ref, 'fichier absent : rien ne change');
});
