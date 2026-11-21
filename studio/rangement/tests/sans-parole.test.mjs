// Un reel en plans filmés sans parler (genre plans-texte, 2026-11-20) : son plan principal arrive sans voix, il est rangé
// comme la vidéo du reel (dossier face/ du contenu) pour que le montage puisse partir ; ses autres plans vont en
// bibliothèque. Vidéos sans piste son : ni transcription ni serveur, faux modèle qui lit la couleur.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isoZurich, outil } from '../lib/commun.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const R = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sans-parole-')));
after(() => fs.rmSync(R, { recursive: true, force: true }));
const ecrire = (p, t) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, t); };
const meta = (d) => ['-movflags', 'use_metadata_tags', '-metadata', `com.apple.quicktime.creationdate=${isoZurich(d).replace(/:(\d\d)$/, '$1')}`];
const clip = (f, couleur, duree, date) => {
  const r = spawnSync(outil('ffmpeg'), ['-nostdin', '-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=${couleur}:s=360x640:r=30:d=${duree}`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', ...meta(date), f], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
};

test('plan principal sans parole : rangé comme la vidéo du reel, le plan en plus dans la Galerie', () => {
  const depot = path.join(R, 'depot'), media = path.join(R, 'Contenu'), arrivees = path.join(R, 'arrivees');
  fs.mkdirSync(arrivees, { recursive: true });
  ecrire(path.join(depot, 'contenus', 'le-plan-muet', 'etat.json'), JSON.stringify({ version: 1, titre: 'Muet', format: 'reel', genre: 'plans-texte' }));
  ecrire(path.join(depot, 'contenus', 'le-plan-muet', 'script.md'), "# Muet\n\n## Texte à l'écran\nEN HAUT\nEN BAS\n\n## Légende\nTout.\n");
  const creeLe = new Date(Math.floor(Date.now() / 1000) * 1000 - 120e3);
  const p = (n, ce, mouv, duree) => ({ n, type: 'b-roll', contenus: [{ slug: 'le-plan-muet', usages: [{ mouvement: 1, phrase: 'EN HAUT' }] }],
    lieu: 'bureau', materiel: [], ce_qu_on_voit: ce, mouvements: [mouv], duree_s: duree, deja_en_bibliotheque: null });
  ecrire(path.join(depot, 'tournages', 'muet.json'), JSON.stringify({ version: 1, id: 'muet', cree_le: isoZurich(creeLe),
    contenus: ['le-plan-muet'], duree_estimee_min: 5, prises: [p(1, 'le plan principal', 'le plan rouge reste fixe', 6), p(2, 'un plan en plus', 'le plan vert reste fixe', 4)] }));
  clip(path.join(arrivees, 'IMG_3001.MOV'), 'red', 6, new Date(creeLe.getTime() + 60e3));
  clip(path.join(arrivees, 'IMG_3002.MOV'), 'green', 4, new Date(creeLe.getTime() + 90e3));
  const config = path.join(R, 'studio.config.json');
  ecrire(config, JSON.stringify({ version: 1, depot_hoc: depot, media, arrivees }));
  const table = { rouge: { prise: 1, ce_qu_on_voit: 'un plan rouge', mouvements: ['le plan rouge reste fixe'] },
    vert: { prise: 2, ce_qu_on_voit: 'un plan vert', mouvements: ['le plan vert reste fixe'] } };
  const r = spawnSync(process.execPath, [path.join(ICI, '..', 'ranger.mjs'), '--config', config, '--tournage', 'muet'], { encoding: 'utf8',
    env: { ...process.env, RANGEMENT_ATTENTE_S: '0', ARRIVEES_CALME_S: '0', RANGEMENT_MODELE: path.join(ICI, 'faux-modele.mjs'), FAUX_MODELE_TABLE: JSON.stringify(table) } });
  assert.equal(r.status, 0, r.stderr);
  const lignes = r.stdout.trim().split('\n');
  assert.ok(lignes.includes('PLACE IMG_3001.MOV -> le-plan-muet/face'), r.stdout);
  assert.ok(lignes.includes('PLACE IMG_3002.MOV -> le-plan-muet/b-roll'), r.stdout);
  assert.equal(lignes.at(-1), 'FIN places=2 a_ranger=0');
  assert.ok(fs.lstatSync(path.join(media, 'le-plan-muet', 'face', 'IMG_3001.MOV')).isFile());
  // Le plan en plus entre dans la Galerie (lot 15), avec un lien physique dans le reel.
  const ix = JSON.parse(fs.readFileSync(path.join(R, 'Galerie', 'index.json'), 'utf8'));
  assert.deepEqual(ix.fichiers.map((f) => f.nom_origine), ['IMG_3002.MOV']);
  assert.ok(fs.lstatSync(path.join(media, 'le-plan-muet', 'b-roll', `${ix.fichiers[0].id}.mov`)).isFile());
});
