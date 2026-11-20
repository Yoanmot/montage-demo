// La voix d'un reel en plans filmés avec sa voix, enregistrée en mémo vocal (2026-11-20) : un vrai petit fichier audio
// fabriqué par ffmpeg, une fausse brique de transcription (faux-couper.mjs, aucun réseau), faux modèle qui lit la couleur.
// Le mémo devient une vidéo noire avec sa voix dans le dossier face/ du contenu (là où le monteur prend la voix), le
// mémo d'origine à côté. Sans reel qui attend sa voix, un fichier audio n'est jamais lu, nommé ni déplacé.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isoZurich, outil, arriveesPertinentes, voixAttendues } from '../lib/commun.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const R = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'voix-memo-')));
after(() => fs.rmSync(R, { recursive: true, force: true }));
const ecrire = (p, t) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, t); };
const ff = (args) => {
  const r = spawnSync(outil('ffmpeg'), ['-nostdin', '-v', 'error', '-y', ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
};
const meta = (d) => ['-movflags', 'use_metadata_tags', '-metadata', `com.apple.quicktime.creationdate=${isoZurich(d).replace(/:(\d\d)$/, '$1')}`];
const memo = (f, secondes) => ff(['-f', 'lavfi', '-i', `sine=frequency=220:duration=${secondes}`, '-c:a', 'aac', f]);
const flux = (f) => JSON.parse(spawnSync(outil('ffprobe'), ['-v', 'error', '-show_entries', 'stream=codec_type,width,height', '-of', 'json', f],
  { encoding: 'utf8' }).stdout).streams;

const TEXTE = "Tes genoux rentrent quand tu descends au squat ? Ce n'est pas qu'un problème de genou. Regarde tes pieds et tes hanches : quand la cheville bloque, le genou part vers l'intérieur pour compenser. Travaille ta cheville contre un mur deux minutes avant chaque séance.";
const HORS_SUJET = "Demain il va pleuvoir sur tout le canton, alors pense à prendre ton parapluie et une veste chaude pour aller faire tes courses au marché du samedi matin avec les enfants.";
const TABLE = { vert: { prise: 2, ce_qu_on_voit: 'un plan vert', mouvements: ['le plan vert reste fixe'] } };

function monter(nom, genre) {
  const racine = path.join(R, nom);
  const depot = path.join(racine, 'depot'), media = path.join(racine, 'Contenu'), arrivees = path.join(racine, 'arrivees');
  fs.mkdirSync(arrivees, { recursive: true });
  ecrire(path.join(depot, 'contenus', 'genoux-au-squat', 'etat.json'), JSON.stringify({ version: 1, titre: 'Genoux', format: 'reel', genre }));
  ecrire(path.join(depot, 'contenus', 'genoux-au-squat', 'script.md'), `# Genoux\n\n- Format : plans filmés avec ta voix\n\n## Texte complet\n${TEXTE}\n\n## Légende\nTout.\n`);
  const creeLe = new Date(Math.floor(Date.now() / 1000) * 1000 - 120e3);
  ecrire(path.join(depot, 'tournages', 'voix.json'), JSON.stringify({ version: 1, id: 'voix', cree_le: isoZurich(creeLe),
    contenus: ['genoux-au-squat'], duree_estimee_min: 5, prises: [
      { n: 1, type: 'face', contenus: [{ slug: 'genoux-au-squat', usages: [] }], lieu: 'un endroit calme', materiel: [],
        ce_qu_on_voit: 'ta voix seule', mouvements: [], duree_s: 20, deja_en_bibliotheque: null },
      { n: 2, type: 'b-roll', contenus: [{ slug: 'genoux-au-squat', usages: [{ mouvement: 1, phrase: 'au squat' }] }], lieu: 'salle',
        materiel: [], ce_qu_on_voit: 'un plan vert', mouvements: ['le plan vert reste fixe'], duree_s: 4, deja_en_bibliotheque: null }] }));
  memo(path.join(arrivees, 'Nouvel enregistrement 3.m4a'), 3);
  memo(path.join(arrivees, 'Courses.m4a'), 2);
  ff(['-f', 'lavfi', '-i', 'color=c=green:s=360x640:r=30:d=4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', ...meta(new Date(creeLe.getTime() + 60e3)),
    path.join(arrivees, 'IMG_4001.MOV')]);
  const config = path.join(racine, 'studio.config.json');
  ecrire(config, JSON.stringify({ version: 1, depot_hoc: depot, media, arrivees }));
  return { racine, depot, media, arrivees, config, creeLe };
}

const trace = path.join(R, 'transcriptions.txt');
function lancer(s, ...args) {
  const r = spawnSync(process.execPath, [path.join(ICI, '..', 'ranger.mjs'), ...args, '--config', s.config], { encoding: 'utf8',
    env: { ...process.env, RANGEMENT_ATTENTE_S: '0', ARRIVEES_CALME_S: '0', RANGEMENT_MODELE: path.join(ICI, 'faux-modele.mjs'),
      FAUX_MODELE_TABLE: JSON.stringify(TABLE), RANGEMENT_COUPER: path.join(ICI, 'faux-couper.mjs'), FAUX_COUPER_TRACE: trace,
      FAUX_COUPER_TEXTES: JSON.stringify({ 'Nouvel enregistrement 3': TEXTE, Courses: HORS_SUJET }) } });
  assert.ok(r.status === 0 || (r.status === 2 && /^BLOQUE /.test(r.stdout)), r.stderr + r.stdout);
  return r.stdout.trim().split('\n');
}

const V = monter('voix', 'plans-voix');

test('plans-voix : le mémo vocal attendu est compté, pas sans reel qui attend sa voix', () => {
  const t = JSON.parse(fs.readFileSync(path.join(V.depot, 'tournages', 'voix.json'), 'utf8'));
  assert.deepEqual(voixAttendues({ depot: V.depot, media: V.media }, t), ['genoux-au-squat']);
  const sans = arriveesPertinentes(V.arrivees, V.creeLe, { maintenant: Date.now() + 60e3 }).fichiers.map((f) => f.nom);
  assert.deepEqual(sans, ['IMG_4001.MOV']);
  const avec = arriveesPertinentes(V.arrivees, V.creeLe, { maintenant: Date.now() + 60e3, audio: true }).fichiers;
  assert.deepEqual(avec.filter((f) => f.type === 'audio').map((f) => f.nom).sort(), ['Courses.m4a', 'Nouvel enregistrement 3.m4a']);
});

test('plans-voix : le mémo reconnu devient la voix du reel, le mémo inconnu reste où il est', () => {
  const lignes = lancer(V, '--tournage', 'voix');
  assert.ok(lignes.includes('PLACE Nouvel enregistrement 3.m4a -> genoux-au-squat/face'), lignes.join('\n'));
  assert.ok(lignes.includes('PLACE IMG_4001.MOV -> genoux-au-squat/b-roll'), lignes.join('\n'));
  assert.ok(lignes.some((l) => l.startsWith("IGNORE Courses.m4a je n'ai pas reconnu le texte")), lignes.join('\n'));
  assert.equal(lignes.at(-1), 'FIN places=2 a_ranger=0');
  const face = path.join(V.media, 'genoux-au-squat', 'face');
  assert.deepEqual(fs.readdirSync(face).sort(), ['Nouvel enregistrement 3.m4a', 'Nouvel enregistrement 3.mp4']);
  const s = flux(path.join(face, 'Nouvel enregistrement 3.mp4'));
  assert.deepEqual(s.map((x) => x.codec_type).sort(), ['audio', 'video']);
  assert.deepEqual([s.find((x) => x.codec_type === 'video').width, s.find((x) => x.codec_type === 'video').height], [1080, 1920]);
  assert.ok(!fs.existsSync(path.join(V.arrivees, 'Nouvel enregistrement 3.m4a')));
  assert.ok(fs.existsSync(path.join(V.arrivees, 'Courses.m4a')));
  // La voix est là : plus aucun mémo n'est attendu, un nouveau passage ne lit plus l'audio.
  const t = JSON.parse(fs.readFileSync(path.join(V.depot, 'tournages', 'voix.json'), 'utf8'));
  assert.deepEqual(voixAttendues({ depot: V.depot, media: V.media }, t), []);
  const encore = lancer(V, '--tournage', 'voix');
  assert.ok(!encore.some((l) => l.includes('Courses.m4a')), encore.join('\n'));
});

test('plans-voix : annuler remet le mémo dans les arrivées et retire sa vidéo', () => {
  const lignes = lancer(V, 'annuler', 'dernier');
  assert.ok(lignes.some((l) => l.startsWith('ANNULE Nouvel enregistrement 3.m4a')), lignes.join('\n'));
  assert.ok(fs.existsSync(path.join(V.arrivees, 'Nouvel enregistrement 3.m4a')));
  assert.ok(!fs.existsSync(path.join(V.media, 'genoux-au-squat', 'face', 'Nouvel enregistrement 3.mp4')));
});

test('plans-voix : un mémo se range à la main comme voix seulement', () => {
  const refus = lancer(V, 'placer', 'Courses.m4a', 'genoux-au-squat', 'b-roll', '--arrivee', 'voix');
  assert.ok(refus[0].startsWith('BLOQUE TYPE'), refus.join('\n'));
  const lignes = lancer(V, 'placer', 'Courses.m4a', 'genoux-au-squat', 'face', '--arrivee', 'voix');
  assert.ok(lignes.includes('PLACE Courses.m4a -> genoux-au-squat/face'), lignes.join('\n'));
  const face = path.join(V.media, 'genoux-au-squat', 'face');
  assert.ok(fs.readdirSync(face).includes('Courses.mp4'));
  assert.deepEqual(flux(path.join(face, 'Courses.mp4')).map((x) => x.codec_type).sort(), ['audio', 'video']);
  assert.ok(!fs.existsSync(path.join(V.arrivees, 'Courses.m4a')));
});

test('face caméra : un mémo vocal n\'est ni lu, ni nommé, ni déplacé', () => {
  const F = monter('face', 'face-camera');
  fs.rmSync(trace, { force: true });
  const lignes = lancer(F, '--tournage', 'voix');
  assert.ok(!lignes.some((l) => /\.m4a/.test(l)), lignes.join('\n'));
  assert.ok(fs.existsSync(path.join(F.arrivees, 'Nouvel enregistrement 3.m4a')));
  assert.ok(fs.existsSync(path.join(F.arrivees, 'Courses.m4a')));
  assert.ok(!fs.existsSync(trace) || !/Nouvel enregistrement|Courses/.test(fs.readFileSync(trace, 'utf8')));
  const refus = lancer(F, 'placer', 'Courses.m4a', 'genoux-au-squat', 'face', '--arrivee', 'voix');
  assert.ok(refus[0].startsWith('BLOQUE FICHIER'), refus.join('\n'));
});
