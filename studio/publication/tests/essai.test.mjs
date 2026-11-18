// Reel d'essai au récapitulatif (studio de Yoan, lot 9D) : node --test studio/publication/tests/
//
// Même montage que ressources.test.mjs : dépôt temporaire avec le client.json de Yoan, faux zernio.py qui
// charge le VRAI zernio.py de Yoan (réseau, git et --envoyer coupés). Les vidéos sont de vraies petites
// vidéos (ffmpeg) : la durée est lue par ffprobe. Le chemin « pour de vrai » passe par un exécuteur injecté.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { after, before, beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { confirmer, oublierRecaps, recap, textesSimules, DUREE_ESSAI } from '../publication.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const HOC = process.env.ZERNIO_REEL_YOAN
  ? path.resolve(process.env.ZERNIO_REEL_YOAN, '..', '..')
  : path.resolve(ICI, '../../../../../../../perso/studio-yoan/hoc-depot');
const REEL = path.join(HOC, 'outils', 'zernio.py');
const FFMPEG = ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'].find((f) => fs.existsSync(f));
const SAUTER = !fs.existsSync(REEL) ? `zernio.py de Yoan introuvable (${REEL})` : !FFMPEG ? 'ffmpeg absent' : false;
const DANS_3_JOURS = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
const QUAND = `${DANS_3_JOURS} 18:30`;
const EM = String.fromCharCode(0x2014);

let racine, depot, media, log, config, configRomain;

function ecrire(f, t) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); }
function appels() {
  if (!fs.existsSync(log)) return [];
  return fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
function reel(slug, secondes) {
  ecrire(path.join(depot, 'contenus', slug, 'etat.json'), JSON.stringify({ version: 1, titre: slug, format: 'reel' }) + '\n');
  ecrire(path.join(depot, 'contenus', slug, 'script.md'), `# ${slug}\n\n## Texte complet\n\nBla.\n\n## Légende\n\nUne légende sans appel à commenter.\n`);
  const f = path.join(media, slug, 'face', 'rush-monte.mp4');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const r = spawnSync(FFMPEG, ['-v', 'error', '-f', 'lavfi', '-i', `color=c=black:s=64x112:d=${secondes}:r=5`, '-y', f], { stdio: 'ignore' });
  assert.equal(r.status, 0, 'ffmpeg');
}

before(() => {
  if (SAUTER) return;
  racine = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-pub-essai-'));
  depot = path.join(racine, 'hoc');
  media = path.join(racine, 'Contenu');
  log = path.join(racine, 'appels.jsonl');
  fs.mkdirSync(path.join(depot, 'outils'), { recursive: true });
  fs.copyFileSync(path.join(ICI, 'faux_zernio.py'), path.join(depot, 'outils', 'zernio.py'));
  fs.copyFileSync(path.join(HOC, 'outils', 'commun.py'), path.join(depot, 'outils', 'commun.py'));
  fs.copyFileSync(path.join(HOC, 'client.json'), path.join(depot, 'client.json'));
  process.env.FAUX_ZERNIO_LOG = log;
  process.env.FAUX_ZERNIO_REEL = REEL;
  process.env.STUDIO_RACINE = path.join(racine, 'racine');
  delete process.env.STUDIO_SIMULATION;
  const base = { depot_hoc: depot, depot_mac: depot, media, publication: { simulation: true } };
  config = { ...base, client: { id: 'yoan', racine: path.join(racine, 'racine'), reels_essai: true, zernio: { compte: 'ia.yoan' } } };
  configRomain = { ...base, client: { id: 'romain', racine: path.join(racine, 'racine'), reels_essai: false, zernio: { compte: 'fitavecromain' } } };
  reel('court-et-bon', 12);
  reel('trop-long', DUREE_ESSAI.max + 5);
});

after(() => { if (racine) fs.rmSync(racine, { recursive: true, force: true }); delete process.env.STUDIO_RACINE; });
beforeEach(() => { if (SAUTER) return; try { fs.unlinkSync(log); } catch { /* rien */ } oublierRecaps(); });

describe('reel d\'essai', { skip: SAUTER }, () => {
  test('client sans le réglage : aucune case, essai ignoré, --reel-essai jamais passé', async () => {
    const r = await recap([{ slug: 'court-et-bon', quand: QUAND, essai: 'MANUAL' }], configRomain);
    assert.equal(r.elements[0].reel_essai, undefined);
    assert.equal(r.elements[0].verdict, 'OK', r.elements[0].messages.join(' / '));
    assert.ok(appels().every((a) => !a.argv.includes('--reel-essai')));
  });

  test('vidéo de 12 s : case possible, rien de choisi par défaut', async () => {
    const r = await recap([{ slug: 'court-et-bon', quand: QUAND }], config);
    assert.deepEqual(r.elements[0].reel_essai, { possible: true, raison: null, choix: null });
    assert.ok(!appels()[0].argv.includes('--reel-essai'));
  });

  test('vidéo trop longue : case grisée avec la raison, sans jargon', async () => {
    const r = await recap([{ slug: 'trop-long', quand: QUAND }], config);
    const x = r.elements[0].reel_essai;
    assert.equal(x.possible, false);
    assert.match(x.raison, new RegExp(`dure ${DUREE_ESSAI.max + 5} secondes : un reel d'essai doit durer entre ${DUREE_ESSAI.min} et ${DUREE_ESSAI.max} secondes`));
    assert.doesNotMatch(x.raison, /ffprobe|trial|MANUAL|\//);
    assert.ok(!x.raison.includes(EM));
    assert.equal(r.elements[0].verdict, 'OK');
  });

  test('vidéo trop longue mais essai demandé : bloqué, la phrase dit de décocher', async () => {
    const r = await recap([{ slug: 'trop-long', quand: QUAND, essai: 'MANUAL' }], config);
    assert.equal(r.elements[0].verdict, 'BLOQUE');
    assert.ok(r.elements[0].messages.some((m) => /Décoche « Reel d'essai »/.test(m)), r.elements[0].messages.join(' / '));
    assert.equal(r.elements[0].reel_essai.choix, 'MANUAL');
    assert.ok(appels().every((a) => !a.argv.includes('--reel-essai')));
  });

  test('stratégie inconnue : ignorée', async () => {
    const r = await recap([{ slug: 'court-et-bon', quand: QUAND, essai: 'AUTO' }], config);
    assert.equal(r.elements[0].reel_essai.choix, null);
    assert.ok(!appels()[0].argv.includes('--reel-essai'));
  });

  test('simulation : --reel-essai passé à verifier et publier, trialParams dans ce qui partirait', async () => {
    const r = await recap([{ slug: 'court-et-bon', quand: QUAND, essai: 'SS_PERFORMANCE' }], config);
    assert.equal(r.elements[0].verdict, 'OK', r.elements[0].messages.join(' / '));
    assert.equal(r.elements[0].reel_essai.choix, 'SS_PERFORMANCE');
    const c = await confirmer(r.recap_id, config);
    const res = c.resultats[0];
    assert.equal(res.statut, 'simulation', res.message);
    assert.equal(res.envoi.reel_essai, 'SS_PERFORMANCE');
    assert.match(res.message, /En reel d'essai : elle serait montrée seulement aux gens qui ne te suivent pas, et Instagram la passerait en reel normal toute seule si elle marche\./);
    const pub = appels().find((x) => x.argv[0] === 'publier');
    const i = pub.argv.indexOf('--reel-essai');
    assert.deepEqual(pub.argv.slice(i, i + 2), ['--reel-essai', 'SS_PERFORMANCE']);
    assert.ok(appels().filter((x) => x.argv[0] === 'verifier').every((x) => x.argv.includes('--reel-essai')));
  });

  test('simulation sans essai : rien sur l\'essai dans ce qui partirait', async () => {
    const r = await recap([{ slug: 'court-et-bon', quand: QUAND }], config);
    const c = await confirmer(r.recap_id, config);
    assert.equal(c.resultats[0].statut, 'simulation', c.resultats[0].message);
    assert.equal(c.resultats[0].envoi.reel_essai, undefined);
    assert.doesNotMatch(c.resultats[0].message, /essai/);
  });

  test('en vrai, Instagram refuse le reel d\'essai : phrase claire, rien ne s\'arrête après', async () => {
    const r = await recap([{ slug: 'court-et-bon', quand: QUAND, essai: 'MANUAL' }, { slug: 'trop-long', quand: QUAND }], config);
    const vus = [];
    const executer = async (args) => {
      vus.push(args);
      if (args[0] === 'verifier') {
        const sortie = (await import('node:child_process')).spawnSync('python3', [path.join(depot, 'outils', 'zernio.py'), ...args],
          { cwd: depot, env: { ...process.env, HOC_DEPOT: depot }, encoding: 'utf8' });
        return { code: sortie.status, sortie: sortie.stdout + sortie.stderr };
      }
      if (args.includes('--reel-essai')) return { code: 7, sortie: 'POST x\nESSAI_REFUSE : Instagram refuse le reel d\'essai (400 /v1/posts : trial not available). Aucun post créé.\n' };
      return { code: 0, sortie: 'POST 6aa000000000000000000001 statut=programmé lien=à\nFAIT\n' };
    };
    const c = await confirmer(r.recap_id, { ...config, publication: { simulation: false } }, { executer });
    const [essai, normal] = c.resultats;
    assert.equal(essai.statut, 'bloque');
    assert.match(essai.message, /Instagram a refusé le reel d'essai, rien n'est parti\. .*fonction n'est pas encore ouverte sur ton compte.*Décoche « Reel d'essai »/);
    assert.doesNotMatch(essai.message, /Yoan|préviens/i);
    assert.equal(normal.statut, 'programmé', normal.message);
    assert.ok(vus.some((a) => a[0] === 'publier' && a.includes('--envoyer') && a.includes('--reel-essai')));
  });

  test('textesSimules lit trialParams dans la requête du post', () => {
    const sortie = 'REQUETE 3-post POST https://zernio.com/api/v1/posts\n{\n  "content": "x",\n  "platforms": [{"platform": "instagram", "platformSpecificData": {"trialParams": {"graduationStrategy": "MANUAL"}}}]\n}\n';
    assert.equal(textesSimules(sortie).reel_essai, 'MANUAL');
  });
});
