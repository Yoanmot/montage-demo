// « Pas le bon » dans la vue Montage du studio (lot 9) : ranger.mjs retirer, sur un dossier média fabriqué à la
// main (pas de transcription ni de modèle). Rien hors du dossier temporaire.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RANGER = path.join(ICI, '..', 'ranger.mjs');
let R, config, media;
const ecrire = (p, t) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, t); };
const json = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const M = (...p) => path.join(media, ...p);
const lancer = (...args) => {
  const r = spawnSync(process.execPath, [RANGER, ...args, '--config', config], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout.trim(), err: r.stderr };
};
const lien = (p) => { try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; } };

before(() => {
  R = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'retirer-')));
  media = path.join(R, 'Contenu');
  config = path.join(R, 'studio.config.json');
  ecrire(config, JSON.stringify({ version: 1, depot_hoc: path.join(R, 'depot'), media, arrivees: path.join(R, 'arrivees') }));
  for (const s of ['faim-a-16h', 'proteines']) ecrire(path.join(R, 'depot', 'contenus', s, 'etat.json'), '{}');
  ecrire(M('faim-a-16h', 'face', 'IMG_1.MOV'), 'video face');
  ecrire(M('faim-a-16h', 'face', 'IMG_1-monte.mp4'), 'montee');
  ecrire(M('faim-a-16h', 'photos', 'IMG_2.JPG'), 'photo');
  const clips = {};
  for (const [id, contenus] of [['20261116-140000-aaaa', ['faim-a-16h', 'proteines']], ['20261116-140100-bbbb', ['faim-a-16h']]]) {
    ecrire(M('_bibliotheque', 'b-roll', `${id}.mov`), id);
    ecrire(M('_bibliotheque', 'vignettes', `${id}-1.jpg`), 'jpg');
    clips[id] = { fichier: `_bibliotheque/b-roll/${id}.mov`, origine: `IMG_${id.slice(-4)}.MOV`, pris_le: '2026-11-16T14:00:00+01:00',
      duree_s: 12, lieu: 'cuisine', mouvements: ['tu ouvres le placard'], ce_qu_on_voit: 'le placard', contenus,
      tournage: '2026-11-16-1300', vignettes: [`_bibliotheque/vignettes/${id}-1.jpg`] };
    for (const s of contenus) {
      fs.mkdirSync(M(s, 'b-roll'), { recursive: true });
      fs.symlinkSync(path.join('..', '..', '_bibliotheque', 'b-roll', `${id}.mov`), M(s, 'b-roll', `${id}.mov`));
    }
  }
  ecrire(M('_bibliotheque', 'index.json'), JSON.stringify({ version: 1, clips }, null, 2));
});
after(() => { if (R) fs.rmSync(R, { recursive: true, force: true }); });

test('retirer : face et photo repartent dans « à ranger »', () => {
  let r = lancer('retirer', 'faim-a-16h', 'face', 'IMG_1.MOV');
  assert.equal(r.code, 0, r.out + r.err);
  assert.deepEqual(r.out.split('\n'), ['RETIRE IMG_1.MOV faim-a-16h/face', 'FIN retires=1']);
  assert.ok(!fs.existsSync(M('faim-a-16h', 'face', 'IMG_1.MOV')));
  assert.ok(fs.existsSync(M('_a-ranger', 'IMG_1.MOV')));
  const e = json(M('_a-ranger', 'a-ranger.json')).fichiers.find((f) => f.nom === 'IMG_1.MOV');
  assert.equal(e.type_probable, 'face');
  assert.match(e.raison, /retiré de ce contenu/);
  r = lancer('retirer', 'faim-a-16h', 'photo', 'IMG_2.JPG');
  assert.equal(r.code, 0, r.out);
  assert.ok(fs.existsSync(M('_a-ranger', 'IMG_2.JPG')));
  // La vidéo montée et les chemins douteux ne se retirent jamais.
  assert.match(lancer('retirer', 'faim-a-16h', 'face', 'IMG_1-monte.mp4').out, /^BLOQUE FICHIER/);
  assert.match(lancer('retirer', 'faim-a-16h', 'face', '../x').out, /^BLOQUE FICHIER/);
  assert.match(lancer('retirer', 'faim-a-16h', 'face', 'absent.MOV').out, /^BLOQUE FICHIER/);
});

test('retirer un b-roll : partagé, seul le lien part ; seul, le clip quitte la bibliothèque', () => {
  let r = lancer('retirer', 'faim-a-16h', 'b-roll', '20261116-140000-aaaa.mov');
  assert.equal(r.code, 0, r.out + r.err);
  assert.ok(!lien(M('faim-a-16h', 'b-roll', '20261116-140000-aaaa.mov')));
  assert.ok(lien(M('proteines', 'b-roll', '20261116-140000-aaaa.mov')), 'l\'autre contenu le garde');
  assert.deepEqual(json(M('_bibliotheque', 'index.json')).clips['20261116-140000-aaaa'].contenus, ['proteines']);
  r = lancer('retirer', 'faim-a-16h', 'b-roll', '20261116-140100-bbbb.mov');
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(json(M('_bibliotheque', 'index.json')).clips['20261116-140100-bbbb'], undefined);
  assert.ok(fs.existsSync(M('_a-ranger', '20261116-140100-bbbb.mov')));
  assert.ok(fs.existsSync(M('_a-ranger', '.vignettes', '20261116-140100-bbbb.mov.jpg')));
  const e = json(M('_a-ranger', 'a-ranger.json')).fichiers.find((f) => f.nom === '20261116-140100-bbbb.mov');
  assert.equal(e.type_probable, 'b-roll');
  assert.equal(e.vu.ce_qu_on_voit, 'le placard');
});

test('annuler remet le dernier retrait en place', () => {
  const r = lancer('annuler', 'dernier');
  assert.equal(r.code, 0, r.out + r.err);
  assert.ok(lien(M('faim-a-16h', 'b-roll', '20261116-140100-bbbb.mov')));
  assert.ok(fs.existsSync(M('_bibliotheque', 'b-roll', '20261116-140100-bbbb.mov')));
  assert.deepEqual(json(M('_bibliotheque', 'index.json')).clips['20261116-140100-bbbb'].contenus, ['faim-a-16h']);
  assert.ok(!json(M('_a-ranger', 'a-ranger.json')).fichiers.some((f) => f.nom === '20261116-140100-bbbb.mov'));
});

test('placer --envoi : seulement un fichier du dossier des envois du studio, du bon genre', () => {
  // Hors du dossier des envois (un fichier quelconque du Mac) : refusé, pas déplacé.
  const dehors = path.join(R, 'ailleurs', 'IMG_9.MOV');
  ecrire(dehors, 'video');
  assert.match(lancer('placer', 'IMG_9.MOV', 'faim-a-16h', 'b-roll', '--envoi', dehors).out, /^BLOQUE FICHIER/);
  assert.ok(fs.existsSync(dehors));
  // Dans le dossier des envois, mais une vidéo annoncée comme photo, ou un nom qui ne correspond pas : refusé.
  const envoi = path.join(R, 'envois', 'e-1', 'IMG_9.MOV');
  ecrire(envoi, 'video');
  assert.match(lancer('placer', 'IMG_9.MOV', 'faim-a-16h', 'photo', '--envoi', envoi).out, /^BLOQUE TYPE/);
  assert.match(lancer('placer', 'AUTRE.MOV', 'faim-a-16h', 'b-roll', '--envoi', envoi).out, /^BLOQUE FICHIER/);
  // Pas une vidéo lisible : refusé, rien de rangé.
  assert.match(lancer('placer', 'IMG_9.MOV', 'faim-a-16h', 'b-roll', '--envoi', envoi).out, /^BLOQUE FICHIER/);
  assert.ok(fs.existsSync(envoi));
});

test('changer : refus clairs (vidéo du montage, type inconnu, plan partagé)', () => {
  assert.match(lancer('changer', 'faim-a-16h', 'face', 'IMG_1-monte.mp4', 'b-roll').out, /^BLOQUE FICHIER/);
  assert.match(lancer('changer', 'faim-a-16h', 'photo', 'IMG_2.JPG', 'face').out, /^BLOQUE TYPE/);
  assert.match(lancer('changer', 'faim-a-16h', 'face', 'x.MOV', 'face').out, /^BLOQUE TYPE/);
  assert.match(lancer('changer', 'inconnu', 'face', 'x.MOV', 'b-roll').out, /^BLOQUE CONTENU/);
  // Un clip lié à deux contenus ne devient pas la face caméra d'un seul.
  fs.mkdirSync(M('proteines', 'b-roll'), { recursive: true });
  const id = '20261116-140000-aaaa';
  const ix = json(M('_bibliotheque', 'index.json'));
  ix.clips[id] = { fichier: `_bibliotheque/b-roll/${id}.mov`, origine: 'IMG_A.MOV', contenus: ['faim-a-16h', 'proteines'], vignettes: [] };
  fs.writeFileSync(M('_bibliotheque', 'index.json'), JSON.stringify(ix));
  ecrire(M('_bibliotheque', 'b-roll', `${id}.mov`), id);
  for (const s of ['faim-a-16h', 'proteines']) if (!lien(M(s, 'b-roll', `${id}.mov`))) fs.symlinkSync(path.join('..', '..', '_bibliotheque', 'b-roll', `${id}.mov`), M(s, 'b-roll', `${id}.mov`));
  assert.match(lancer('changer', 'faim-a-16h', 'b-roll', `${id}.mov`, 'face').out, /^BLOQUE PARTAGE/);
  assert.ok(lien(M('faim-a-16h', 'b-roll', `${id}.mov`)));
});
