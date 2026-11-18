// Réception AirDrop lente (test de Yoan du 17/11/2026) : ce que macOS 15 fait vraiment pendant un AirDrop vers
// Téléchargements, relu dans le journal de sharingd. Le fichier est créé tout de suite sous son nom final et
// grossit pendant le transfert, sans extension temporaire ni quarantaine ; à la fin seulement, sharingd pose la
// quarantaine « 0081;<instant>;sharingd;… » et remet les dates de l'iPhone (création et modification = date de
// prise, parfois des mois avant). Un fichier en cours n'est jamais compté ni rangé ; un fichier fini compte à
// l'instant de sa quarantaine, même si sa date de prise est ancienne.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { arriveesPertinentes, quarantaine } from '../lib/commun.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RANGER = path.join(ICI, '..', 'ranger.mjs');
const MAC = process.platform === 'darwin';
const xattr = (...a) => spawnSync('/usr/bin/xattr', a, { encoding: 'utf8' });
const AOUT = new Date('2026-08-16T14:27:06Z');

function dossier() { return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'airdrop-'))); }
// La fin d'un AirDrop, comme sharingd : quarantaine à l'instant de réception, puis dates de l'iPhone.
export function finirAirDrop(f, { recu = new Date(), prise = AOUT } = {}) {
  xattr('-w', 'com.apple.quarantine', `0081;${Math.floor(recu.getTime() / 1000).toString(16)};sharingd;6C3D956C-F6FF-4AB4-BBB7-4C72C69EF8FC`, f);
  fs.utimesSync(f, prise, prise);
}

test('AirDrop en cours : fichier sous son nom final qui grossit, ni compté ni rangé', { skip: !MAC && 'macOS seulement' }, () => {
  const d = dossier();
  try {
    const f = path.join(d, 'IMG_7254.mov');
    fs.writeFileSync(f, Buffer.alloc(4_000_000));
    const r = arriveesPertinentes(d, Date.now() - 60e3);
    assert.deepEqual(r.fichiers, []);
    assert.deepEqual(r.en_cours.map((x) => [x.nom, x.type, x.taille]), [['IMG_7254.mov', 'video', 4_000_000]]);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('AirDrop fini : quarantaine sharingd, dates de l\'iPhone d\'août, compté à l\'instant de réception', { skip: !MAC && 'macOS seulement' }, () => {
  const d = dossier();
  try {
    const f = path.join(d, 'IMG_7254.mov');
    fs.writeFileSync(f, 'video');
    const recu = new Date(Math.floor(Date.now() / 1000) * 1000);
    finirAirDrop(f, { recu });
    assert.ok(fs.statSync(f).mtimeMs < Date.now() - 30 * 86400e3, 'les dates sont celles de la prise');
    assert.equal(quarantaine(f).agent, 'sharingd');
    const r = arriveesPertinentes(d, Date.now() - 60e3);
    assert.deepEqual(r.en_cours, []);
    assert.deepEqual(r.fichiers.map((x) => [x.nom, x.quand]), [['IMG_7254.mov', recu.getTime()]]);
    // Reçu avant la création du plan : pas pour ce plan.
    assert.deepEqual(arriveesPertinentes(d, Date.now() + 60e3).fichiers, []);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('vieux fichier des Téléchargements, même reçu par AirDrop en août : jamais compté', { skip: !MAC && 'macOS seulement' }, () => {
  const d = dossier();
  try {
    const vieux = path.join(d, 'IMG_0001.MOV');
    fs.writeFileSync(vieux, 'v');
    fs.utimesSync(vieux, AOUT, AOUT);   // vieux fichier des Téléchargements : jamais compté
    xattr('-w', 'com.apple.quarantine', `0081;${Math.floor(AOUT.getTime() / 1000).toString(16)};sharingd;X`, vieux);
    assert.deepEqual(arriveesPertinentes(d, Date.now() - 60e3).fichiers, [], 'reçu en août : pas une arrivée du plan');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('progression affichée par le Finder, copie du Finder en cours : en cours même au calme', { skip: !MAC && 'macOS seulement' }, () => {
  const d = dossier();
  const avant = process.env.ARRIVEES_CALME_S;
  process.env.ARRIVEES_CALME_S = '0';
  try {
    const a = path.join(d, 'IMG_1.MOV'); const b = path.join(d, 'IMG_2.MOV'); const c = path.join(d, 'IMG_3.MOV');
    for (const f of [a, b, c]) fs.writeFileSync(f, 'v');
    xattr('-w', 'com.apple.progress.fractionCompleted', '0.42', a);
    xattr('-wx', 'com.apple.FinderInfo', '62726F6B4D414353000000000000000000000000000000000000000000000000', b);
    const r = arriveesPertinentes(d, Date.now() - 60e3);
    assert.deepEqual(r.en_cours.map((x) => x.nom), ['IMG_1.MOV', 'IMG_2.MOV']);
    assert.deepEqual(r.fichiers.map((x) => x.nom), ['IMG_3.MOV']);
  } finally {
    if (avant === undefined) delete process.env.ARRIVEES_CALME_S; else process.env.ARRIVEES_CALME_S = avant;
    fs.rmSync(d, { recursive: true, force: true });
  }
});

test('ranger.mjs : un fichier en cours de réception reste où il est', { skip: !MAC && 'macOS seulement' }, () => {
  const racine = dossier();
  try {
    const depot = path.join(racine, 'depot'), arr = path.join(racine, 'arrivees');
    fs.mkdirSync(path.join(depot, 'tournages'), { recursive: true });
    fs.mkdirSync(arr);
    fs.writeFileSync(path.join(depot, 'tournages', 't.json'), JSON.stringify({ version: 1, id: 't', cree_le: new Date(Date.now() - 60e3).toISOString(), contenus: [], prises: [] }));
    const config = path.join(racine, 'studio.config.json');
    fs.writeFileSync(config, JSON.stringify({ version: 1, depot_hoc: depot, media: path.join(racine, 'Contenu'), arrivees: arr }));
    const f = path.join(arr, 'IMG_7254.mov');
    fs.writeFileSync(f, Buffer.alloc(1000));
    const env = { ...process.env, RANGEMENT_ATTENTE_S: '0' };
    delete env.ARRIVEES_CALME_S;
    const r = spawnSync(process.execPath, [RANGER, '--config', config, '--tournage', 't'], { encoding: 'utf8', env });
    assert.deepEqual(r.stdout.trim().split('\n'), ['IGNORE IMG_7254.mov ce fichier est encore en train d\'arriver', 'FIN places=0 a_ranger=0']);
    assert.ok(fs.existsSync(f));
  } finally { fs.rmSync(racine, { recursive: true, force: true }); }
});
