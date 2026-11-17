// Test de bout en bout du rangement sur un faux tournage fabriqué (dossier temporaire) : vraie transcription par la
// brique couper-silences (voix de « say »), faux modèle qui mesure la couleur des vignettes.
// Sans code d'accès au serveur de transcription (~/.montage-yoan/config), ce test est sauté.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fabriquer, TABLE_COULEURS } from './fabrique.mjs';
import { sha256 } from '../lib/commun.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RANGER = path.join(ICI, '..', 'ranger.mjs');
const ARCHIVER = path.join(ICI, '..', 'archiver.mjs');
const CODE = fs.existsSync(path.join(os.homedir(), '.montage-yoan', 'config'));
const ENV = { ...process.env, RANGEMENT_ATTENTE_S: '1', RANGEMENT_MODELE: path.join(ICI, 'faux-modele.mjs'),
  FAUX_MODELE_TABLE: JSON.stringify(TABLE_COULEURS) };

let T;
const lancer = (script, args, env = {}) => {
  const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { ...ENV, ...env }, timeout: 900000 });
  return { code: r.status, lignes: r.stdout.trim().split('\n'), out: r.stdout, err: r.stderr };
};
const ranger = (...a) => lancer(RANGER, ['--config', T.config, ...a]);
const json = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const M = (...p) => path.join(T.media, ...p);

before(() => { if (CODE) T = fabriquer(); });
after(() => { if (T && !process.env.GARDER) fs.rmSync(T.racine, { recursive: true, force: true }); });

const ATTENDU = [
  'PLACE 20261102-101500-ab12.mov -> dos-qui-tire-au-bureau/b-roll',
  'IGNORE IMG_1011.MOV.download ce fichier n\'est pas encore arrivé en entier',
  'IGNORE IMG_1010.MOV je n\'arrive pas à lire cette vidéo, elle n\'est peut-être pas arrivée en entier',
  'PLACE IMG_1001.MOV -> faim-a-16h/face',
  'PLACE IMG_1002.MOV -> proteines-au-petit-dej/face',
  'PLACE IMG_1003.MOV -> dos-qui-tire-au-bureau/face',
  'A_RANGER IMG_1004.MOV ce que tu dis ressemble à plusieurs de tes scripts, je ne sais pas lequel',
  'A_RANGER IMG_1005.MOV je n\'ai pas reconnu ce que tu dis dans cette vidéo',
  'PLACE IMG_1006.MOV -> faim-a-16h/b-roll',
  'PLACE IMG_1006.MOV -> proteines-au-petit-dej/b-roll',
  'A_RANGER IMG_1007.MOV je n\'ai pas reconnu ce qu\'on voit dans ce clip',
  'PLACE IMG_1008.MOV -> dos-qui-tire-au-bureau/b-roll',
  'PLACE IMG_1009.JPG -> proteines-au-petit-dej/photo',
  'FIN places=6 a_ranger=3',
];

test('simulation : dit ce qu\'il ferait, ne déplace rien', { skip: !CODE && 'pas de code de transcription' }, () => {
  const avant = fs.readdirSync(T.arrivees).sort();
  const r = ranger('--simulation');
  assert.equal(r.code, 0, r.err);
  assert.deepEqual([...r.lignes].sort(), [...ATTENDU].sort());
  assert.equal(r.lignes.at(-1), 'FIN places=6 a_ranger=3');
  assert.deepEqual(fs.readdirSync(T.arrivees).sort(), avant);
  assert.ok(!fs.existsSync(M('faim-a-16h')) && !fs.existsSync(M('_a-ranger')) && !fs.existsSync(M('_journal-rangement.json')));
});

test('rangement : face, b-rolls en bibliothèque, liens, photo, à ranger, journal', { skip: !CODE && 'pas de code de transcription' }, () => {
  const r = ranger();
  assert.equal(r.code, 0, r.err);
  assert.deepEqual([...r.lignes].sort(), [...ATTENDU].sort());

  // Les autres fichiers du dossier d'arrivée (ses Téléchargements) sont restés tels quels (lot 12).
  for (const nom of ['facture.pdf', 'Capture d’écran.png', 'tuto-internet.mov', 'vieux-fichier.mov']) {
    assert.ok(fs.existsSync(path.join(T.arrivees, nom)), `${nom} n'a pas bougé`);
  }
  assert.ok(fs.existsSync(path.join(T.arrivees, 'Dossier perso', 'IMG_2000.MOV')));
  assert.ok(!r.out.includes('tuto-internet') && !r.out.includes('Capture') && !r.out.includes('facture'));
  for (const [slug, nom] of [['faim-a-16h', 'IMG_1001.MOV'], ['proteines-au-petit-dej', 'IMG_1002.MOV'], ['dos-qui-tire-au-bureau', 'IMG_1003.MOV']]) {
    assert.ok(fs.lstatSync(M(slug, 'face', nom)).isFile(), `${slug}/face/${nom}`);
  }
  assert.ok(fs.lstatSync(M('proteines-au-petit-dej', 'photos', 'IMG_1009.JPG')).isFile());

  const ix = json(M('_bibliotheque', 'index.json'));
  const clips = Object.entries(ix.clips);
  assert.equal(clips.length, 3);
  const [rougeId, rouge] = clips.find(([, c]) => c.origine === 'IMG_1006.MOV');
  assert.match(rougeId, /^\d{8}-\d{6}-[a-z0-9]{4}$/);
  assert.equal(rouge.fichier, `_bibliotheque/b-roll/${rougeId}.mov`);
  assert.deepEqual(rouge.contenus.sort(), ['faim-a-16h', 'proteines-au-petit-dej']);
  assert.equal(rouge.lieu, 'cuisine');
  assert.equal(rouge.ce_qu_on_voit, 'un plan entièrement rouge');
  assert.equal(rouge.orientation, 'portrait');
  assert.equal(rouge.duree_s, 6);
  assert.equal(rouge.tournage, T.tournage);
  assert.match(rouge.pris_le, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);
  assert.equal(rouge.vignettes.length, 3);
  rouge.vignettes.forEach((v) => assert.ok(fs.existsSync(M(v)), v));
  // une prise fusionnée = un fichier, deux liens
  const vrai = fs.realpathSync(M(rouge.fichier));
  for (const s of rouge.contenus) {
    const lien = M(s, 'b-roll', `${rougeId}.mov`);
    assert.ok(fs.lstatSync(lien).isSymbolicLink());
    assert.equal(fs.realpathSync(lien), vrai);
  }
  // déjà en bibliothèque : lien posé, contenu ajouté à l'index
  assert.equal(fs.realpathSync(M('dos-qui-tire-au-bureau', 'b-roll', `${T.ancien}.mov`)), fs.realpathSync(M('_bibliotheque', 'b-roll', `${T.ancien}.mov`)));
  assert.deepEqual(ix.clips[T.ancien].contenus, ['un-ancien-contenu', 'dos-qui-tire-au-bureau']);

  // à ranger : raison simple (sans chemin ni nom d'outil), candidats, vignette
  const ar = json(M('_a-ranger', 'a-ranger.json'));
  assert.deepEqual(ar.fichiers.map((f) => f.nom).sort(), ['IMG_1004.MOV', 'IMG_1005.MOV', 'IMG_1007.MOV']);
  for (const f of ar.fichiers) {
    assert.ok(fs.existsSync(M('_a-ranger', f.nom)));
    assert.doesNotMatch(f.raison, /\/|claude|ffmpeg|ffprobe|json|serveur|\u2014/i);
    assert.ok(f.vignette && fs.existsSync(M(f.vignette)), `vignette de ${f.nom}`);
  }
  const ambigu = ar.fichiers.find((f) => f.nom === 'IMG_1004.MOV');
  assert.deepEqual(ambigu.candidats.slice(0, 2).map((c) => c.slug).sort(), ['faim-a-16h', 'proteines-au-petit-dej']);
  assert.equal(ar.fichiers.find((f) => f.nom === 'IMG_1007.MOV').type_probable, 'b-roll');

  // les pièges restent dans les arrivées
  assert.deepEqual(fs.readdirSync(T.arrivees).sort(), ['Capture d’écran.png', 'Dossier perso', 'IMG_1010.MOV', 'IMG_1011.MOV.download', 'facture.pdf', 'tuto-internet.mov', 'vieux-fichier.mov']);
  const j = json(M('_journal-rangement.json'));
  assert.equal(j.rangements.length, 1);
  assert.ok(j.rangements[0].ops.some((o) => o.op === 'deplacement'));
});

test('deuxième passage : rien de neuf, rien de refait', { skip: !CODE && 'pas de code de transcription' }, () => {
  const r = ranger();
  assert.deepEqual(r.lignes.filter((l) => !l.startsWith('IGNORE')), ['FIN places=0 a_ranger=0']);
  assert.equal(json(M('_journal-rangement.json')).rangements.length, 1);
});

test('placer à la main, puis annuler', { skip: !CODE && 'pas de code de transcription' }, () => {
  let r = lancer(RANGER, ['placer', 'IMG_1004.MOV', 'faim-a-16h', 'face', '--config', T.config]);
  assert.deepEqual(r.lignes, ['PLACE IMG_1004.MOV -> faim-a-16h/face', 'FIN places=1 a_ranger=2']);
  assert.ok(fs.existsSync(M('faim-a-16h', 'face', 'IMG_1004.MOV')));
  r = lancer(RANGER, ['placer', 'IMG_1007.MOV', 'dos-qui-tire-au-bureau', 'b-roll', '--config', T.config]);
  assert.deepEqual(r.lignes, ['PLACE IMG_1007.MOV -> dos-qui-tire-au-bureau/b-roll', 'FIN places=1 a_ranger=1']);
  const [id] = Object.entries(json(M('_bibliotheque', 'index.json')).clips).find(([, c]) => c.origine === 'IMG_1007.MOV');
  // le même clip glissé sur une deuxième carte : un lien de plus, pas de fichier en plus
  r = lancer(RANGER, ['placer', id, 'faim-a-16h', 'b-roll', '--config', T.config]);
  assert.equal(r.lignes[0], `PLACE ${id}.mov -> faim-a-16h/b-roll`);
  assert.ok(fs.lstatSync(M('faim-a-16h', 'b-roll', `${id}.mov`)).isSymbolicLink());
  // refus propres
  assert.match(lancer(RANGER, ['placer', '../x', 'faim-a-16h', 'face', '--config', T.config]).out, /^BLOQUE FICHIER/);
  assert.match(lancer(RANGER, ['placer', 'IMG_1005.MOV', 'inconnu', 'face', '--config', T.config]).out, /^BLOQUE CONTENU/);

  // annuler les trois placements, puis le rangement : tout revient comme avant
  for (let k = 0; k < 3; k++) assert.equal(lancer(RANGER, ['annuler', 'dernier', '--config', T.config]).code, 0);
  assert.ok(fs.existsSync(M('_a-ranger', 'IMG_1004.MOV')) && fs.existsSync(M('_a-ranger', 'IMG_1007.MOV')));
  assert.equal(json(M('_a-ranger', 'a-ranger.json')).fichiers.length, 3);
  r = lancer(RANGER, ['annuler', 'dernier', '--config', T.config]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.lignes.at(-1), /^FIN annule=/);
  for (let n = 1001; n <= 1008; n++) assert.ok(fs.existsSync(path.join(T.arrivees, `IMG_${n}.MOV`)), `IMG_${n}.MOV revenu`);
  assert.ok(fs.existsSync(path.join(T.arrivees, 'IMG_1009.JPG')));
  const ix = json(M('_bibliotheque', 'index.json'));
  assert.deepEqual(Object.keys(ix.clips), [T.ancien]);
  assert.deepEqual(ix.clips[T.ancien].contenus, ['un-ancien-contenu']);
  assert.ok(!fs.existsSync(M('dos-qui-tire-au-bureau', 'b-roll', `${T.ancien}.mov`)));
  assert.deepEqual(json(M('_a-ranger', 'a-ranger.json')).fichiers, []);
  assert.equal(fs.readdirSync(M('_bibliotheque', 'vignettes')).length, 0);
});

test('réponse vide du modèle : refaite une fois, puis à ranger', { skip: !CODE && 'pas de code de transcription' }, () => {
  const r = lancer(RANGER, ['--config', T.config, '--simulation'], { FAUX_MODELE_MODE: 'vide' });
  assert.ok(r.lignes.includes('A_RANGER IMG_1006.MOV je n\'ai pas pu regarder ce clip pour le reconnaître'), r.out);
  assert.ok(r.lignes.includes('A_RANGER IMG_1009.JPG je n\'ai pas pu regarder ce clip pour le reconnaître'), r.out);
  assert.equal((r.err.match(/champ_vide/g) || []).length, 8);   // 4 visuels x 2 essais
});

test('archivage : disque absent, puis copie vérifiée et original supprimé', { skip: !CODE && 'pas de code de transcription' }, async () => {
  assert.equal(ranger().lignes.at(-1), 'FIN places=6 a_ranger=3');   // de nouveau rangé (transcriptions en cache)
  fs.rmSync(T.disque, { recursive: true, force: true });
  let r = lancer(ARCHIVER, ['--config', T.config], { ARCHIVE_DISQUE_LOCAL: '1' });
  assert.deepEqual(r.lignes, ['DISQUE_ABSENT ton disque n\'est pas branché, j\'archiverai la prochaine fois qu\'il le sera', 'FIN archives=0 gardes=0']);

  fs.mkdirSync(T.disque);
  const il_y_a = (j) => new Date(Date.now() - j * 86400e3).toISOString();
  fs.writeFileSync(path.join(T.depot, 'publications', 'registre.json'), JSON.stringify({ version: 1, publications: {
    'faim-a-16h': { statut: 'publié', prevu_le: il_y_a(40) },
    'proteines-au-petit-dej': { statut: 'programmé', prevu_le: il_y_a(35) },
    'dos-qui-tire-au-bureau': { statut: 'programmé', prevu_le: new Date(Date.now() + 86400e3).toISOString() },
  } }, null, 2));
  fs.writeFileSync(M('faim-a-16h', 'face', 'IMG_1001-monte.mp4'), 'video finale');
  const h1001 = await sha256(M('faim-a-16h', 'face', 'IMG_1001.MOV'));
  r = lancer(ARCHIVER, ['--config', T.config, '--simulation'], { ARCHIVE_DISQUE_LOCAL: '1' });
  assert.equal(r.lignes.at(-1), 'FIN archives=4 gardes=0');
  assert.ok(fs.existsSync(M('faim-a-16h', 'face', 'IMG_1001.MOV')));
  r = lancer(ARCHIVER, ['--config', T.config], { ARCHIVE_DISQUE_LOCAL: '1' });
  assert.equal(r.code, 0, r.err);
  const ix = json(M('_bibliotheque', 'index.json'));
  const [rougeId, rouge] = Object.entries(ix.clips).find(([, c]) => c.origine === 'IMG_1006.MOV');
  assert.deepEqual([...r.lignes].sort(), [
    'ARCHIVE IMG_1001.MOV -> faim-a-16h/face/IMG_1001.MOV',
    'ARCHIVE IMG_1002.MOV -> proteines-au-petit-dej/face/IMG_1002.MOV',
    'ARCHIVE IMG_1009.JPG -> proteines-au-petit-dej/photos/IMG_1009.JPG',
    `ARCHIVE ${rougeId}.mov -> _bibliotheque/b-roll/${rougeId}.mov`,
    'FIN archives=4 gardes=0',
  ].sort());
  const copie = path.join(T.disque, 'Contenu', 'faim-a-16h', 'face', 'IMG_1001.MOV');
  assert.equal(await sha256(copie), h1001);
  assert.ok(!fs.existsSync(M('faim-a-16h', 'face', 'IMG_1001.MOV')));
  assert.ok(fs.existsSync(M('faim-a-16h', 'face', 'IMG_1001-monte.mp4')), 'la vidéo finale reste sur le Mac');
  assert.ok(fs.existsSync(M('dos-qui-tire-au-bureau', 'face', 'IMG_1003.MOV')), 'pas encore publié : reste');
  assert.equal(rouge.archive, path.join(T.disque, 'Contenu', rouge.fichier));
  assert.equal(fs.readlinkSync(M('faim-a-16h', 'b-roll', `${rougeId}.mov`)), rouge.archive);
  assert.equal(lancer(ARCHIVER, ['--config', T.config], { ARCHIVE_DISQUE_LOCAL: '1' }).lignes.at(-1), 'FIN archives=0 gardes=0');
});

test('fichier qui grossit encore pendant l\'attente : ignoré', async () => {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'rangement-stable-'));
  try {
    const depot = path.join(racine, 'depot'), arr = path.join(racine, 'arrivees');
    fs.mkdirSync(path.join(depot, 'tournages'), { recursive: true });
    fs.mkdirSync(arr);
    fs.writeFileSync(path.join(depot, 'tournages', 't.json'), JSON.stringify({ version: 1, id: 't', cree_le: new Date(Date.now() - 60e3).toISOString(), contenus: [], prises: [] }));
    const config = path.join(racine, 'studio.config.json');
    fs.writeFileSync(config, JSON.stringify({ version: 1, depot_hoc: depot, media: path.join(racine, 'Contenu'), arrivees: arr }));
    const f = path.join(arr, 'IMG_2001.MOV');
    fs.writeFileSync(f, 'debut');
    const p = spawn(process.execPath, [RANGER, '--config', config, '--tournage', 't'], { env: { ...ENV, RANGEMENT_ATTENTE_S: '1.5' } });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    const t = setInterval(() => fs.appendFileSync(f, 'xxxx'), 200);
    await new Promise((ok) => p.on('close', ok));
    clearInterval(t);
    assert.deepEqual(out.trim().split('\n'), ['IGNORE IMG_2001.MOV ce fichier est encore en train d\'arriver', 'FIN places=0 a_ranger=0']);
    assert.ok(fs.existsSync(f));
  } finally { fs.rmSync(racine, { recursive: true, force: true }); }
});
