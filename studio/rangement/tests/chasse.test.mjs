// Chasse aux bugs de la Galerie (2026-11-21) : une vidéo rattachée à rien où l'on entend quelques mots (face caméra
// courte ou ratée, trop peu de mots pour être reconnue) n'entre pas dans la Galerie : jamais de face caméra dedans.
// Elle attend dans « Arrivés, à placer ». Un plan sans parole (ou un mot entendu dans le bruit) y entre, comme avant.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isoZurich, outil } from '../lib/commun.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const R = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'chasse-rangement-')));
after(() => fs.rmSync(R, { recursive: true, force: true }));
const ecrire = (p, t) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, t); };
const meta = (d) => ['-movflags', 'use_metadata_tags', '-metadata', `com.apple.quicktime.creationdate=${isoZurich(d).replace(/:(\d\d)$/, '$1')}`];
const clipSon = (f, couleur, date) => {
  const r = spawnSync(outil('ffmpeg'), ['-nostdin', '-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=${couleur}:s=360x640:r=30:d=3`,
    '-f', 'lavfi', '-i', 'sine=frequency=300:duration=3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', ...meta(date), f], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
};

test('arrivée rattachée à rien : quelques mots entendus = « à placer », pas la Galerie ; un mot dans le bruit = la Galerie', () => {
  const depot = path.join(R, 'depot'), media = path.join(R, 'Contenu'), arrivees = path.join(R, 'arrivees');
  fs.mkdirSync(arrivees, { recursive: true });
  ecrire(path.join(depot, 'contenus', 'un-reel', 'etat.json'), JSON.stringify({ version: 1, titre: 'Un reel', format: 'reel' }));
  ecrire(path.join(depot, 'contenus', 'un-reel', 'script.md'), "# Un reel\n\n## Texte complet\nAujourd'hui je te montre comment tenir ta séance de jambes sans te blesser le genou ni le dos.\n\n## Légende\nTout.\n");
  const creeLe = new Date(Math.floor(Date.now() / 1000) * 1000 - 120e3);
  ecrire(path.join(depot, 'tournages', 't1.json'), JSON.stringify({ version: 1, id: 't1', cree_le: isoZurich(creeLe), contenus: ['un-reel'], duree_estimee_min: 5,
    prises: [{ n: 1, type: 'face', contenus: [{ slug: 'un-reel', usages: [] }], lieu: '', materiel: [], ce_qu_on_voit: 'toi', mouvements: [], duree_s: 30, deja_en_bibliotheque: null },
      { n: 2, type: 'b-roll', contenus: [{ slug: 'un-reel', usages: [{ mouvement: 1, phrase: 'ta séance' }] }], lieu: 'salle', materiel: [], ce_qu_on_voit: 'la salle', mouvements: ['la salle'], duree_s: 3, deja_en_bibliotheque: null }] }));
  clipSon(path.join(arrivees, 'IMG_5001.MOV'), 'red', new Date(creeLe.getTime() + 60e3));
  clipSon(path.join(arrivees, 'IMG_5002.MOV'), 'blue', new Date(creeLe.getTime() + 90e3));
  const config = path.join(R, 'studio.config.json');
  ecrire(config, JSON.stringify({ version: 1, depot_hoc: depot, media, arrivees }));
  const r = spawnSync(process.execPath, [path.join(ICI, '..', 'ranger.mjs'), '--config', config, '--tournage', 't1'], { encoding: 'utf8',
    env: { ...process.env, RANGEMENT_ATTENTE_S: '0', ARRIVEES_CALME_S: '0', RANGEMENT_MODELE: path.join(ICI, 'faux-modele.mjs'), FAUX_MODELE_TABLE: '{}',
      RANGEMENT_COUPER: path.join(ICI, 'faux-couper.mjs'),
      FAUX_COUPER_TEXTES: JSON.stringify({ IMG_5001: "attends je recommence la phrase depuis le début, voilà, c'est reparti pour la séance", IMG_5002: 'ouais' }) } });
  assert.equal(r.status, 0, r.stderr);
  const lignes = r.stdout.trim().split('\n');
  assert.ok(lignes.some((l) => /^A_RANGER IMG_5001\.MOV j'entends quelques mots/.test(l)), r.stdout);
  assert.ok(lignes.some((l) => /^GALERIE IMG_5002\.MOV /.test(l)), r.stdout);
  const ar = JSON.parse(fs.readFileSync(path.join(media, '_a-ranger', 'a-ranger.json'), 'utf8')).fichiers;
  assert.equal(ar.find((f) => f.nom === 'IMG_5001.MOV').type_probable, null, "ni face sûre, ni plan : c'est lui qui dit");
  const ix = JSON.parse(fs.readFileSync(path.join(R, 'Galerie', 'index.json'), 'utf8'));
  assert.deepEqual(ix.fichiers.map((f) => f.nom_origine), ['IMG_5002.MOV']);
});

test('bilan : le même fichier envoyé deux fois (AirDrop refait) ne compte qu\'une fois, rangé à sa prise ou dans la Galerie', () => {
  const B = path.join(R, 'doublon');
  const depot = path.join(B, 'depot'), media = path.join(B, 'Contenu'), arrivees = path.join(B, 'arrivees');
  fs.mkdirSync(arrivees, { recursive: true });
  ecrire(path.join(depot, 'contenus', 'un-reel', 'etat.json'), JSON.stringify({ version: 1, titre: 'Un reel', format: 'reel' }));
  ecrire(path.join(depot, 'contenus', 'un-reel', 'script.md'), "# Un reel\n\n## Texte complet\nAujourd'hui je te montre ta séance.\n\n## Légende\nTout.\n");
  const creeLe = new Date(Math.floor(Date.now() / 1000) * 1000 - 120e3);
  ecrire(path.join(depot, 'tournages', 't2.json'), JSON.stringify({ version: 1, id: 't2', cree_le: isoZurich(creeLe), contenus: ['un-reel'], duree_estimee_min: 5,
    prises: [{ n: 2, type: 'b-roll', contenus: [{ slug: 'un-reel', usages: [{ mouvement: 1, phrase: 'ta séance' }] }], lieu: 'salle', materiel: [], ce_qu_on_voit: 'la salle', mouvements: ['la salle'], duree_s: 3, deja_en_bibliotheque: null }] }));
  // Un b-roll de la prise 2 (rouge) et un plan rattaché à rien (bleu), chacun arrivé deux fois, octet pour octet.
  clipSon(path.join(arrivees, 'IMG_7001.MOV'), 'red', new Date(creeLe.getTime() + 60e3));
  fs.copyFileSync(path.join(arrivees, 'IMG_7001.MOV'), path.join(arrivees, 'IMG_7001 2.MOV'));
  clipSon(path.join(arrivees, 'IMG_7002.MOV'), 'blue', new Date(creeLe.getTime() + 90e3));
  fs.copyFileSync(path.join(arrivees, 'IMG_7002.MOV'), path.join(arrivees, 'IMG_7002 2.MOV'));
  const config = path.join(B, 'studio.config.json');
  ecrire(config, JSON.stringify({ version: 1, depot_hoc: depot, media, arrivees }));
  const r = spawnSync(process.execPath, [path.join(ICI, '..', 'ranger.mjs'), '--config', config, '--tournage', 't2'], { encoding: 'utf8',
    env: { ...process.env, RANGEMENT_ATTENTE_S: '0', ARRIVEES_CALME_S: '0', RANGEMENT_MODELE: path.join(ICI, 'faux-modele.mjs'),
      FAUX_MODELE_TABLE: JSON.stringify({ rouge: { prise: 2, ce_qu_on_voit: 'la salle', mouvements: ['la salle'] } }),
      RANGEMENT_COUPER: path.join(ICI, 'faux-couper.mjs'), FAUX_COUPER_TEXTES: JSON.stringify({ IMG_7001: 'ouais', 'IMG_7001 2': 'ouais', IMG_7002: 'ouais', 'IMG_7002 2': 'ouais' }) } });
  assert.equal(r.status, 0, r.stderr);
  const lignes = r.stdout.trim().split('\n');
  assert.equal(lignes.filter((l) => /^DOUBLON /.test(l)).length, 2, r.stdout);
  assert.match(lignes.at(-1), /^FIN places=1 a_ranger=0 galerie=1$/, r.stdout);
  const ix = JSON.parse(fs.readFileSync(path.join(B, 'Galerie', 'index.json'), 'utf8'));
  assert.equal(ix.fichiers.length, 2, 'deux fichiers distincts dans la Galerie');
  assert.deepEqual(fs.readdirSync(arrivees).filter((f) => !f.startsWith('.')), [], 'les doublons ne restent pas dans les arrivées');
});
