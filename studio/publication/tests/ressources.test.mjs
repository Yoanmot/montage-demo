// Ressources gratuites au récapitulatif (studio de Yoan, lot 4C) : node --test studio/publication/tests/
//
// Le dépôt du head of content est fabriqué dans un dossier temporaire avec le client.json de Yoan ; son
// outils/zernio.py est le faux (faux_zernio.py), qui charge le VRAI zernio.py de Yoan (variable
// ZERNIO_REEL_YOAN, ou le clone voisin projets/perso/studio-yoan/hoc-depot) en coupant réseau, git et
// --envoyer. Le chemin « pour de vrai » est testé avec un exécuteur injecté qui note les appels.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { confirmer, oublierRecaps, poserMot, recap, PHRASE_MOT_SANS_RESSOURCE } from '../publication.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const HOC = process.env.ZERNIO_REEL_YOAN
  ? path.resolve(process.env.ZERNIO_REEL_YOAN, '..', '..')
  : path.resolve(ICI, '../../../../../../../perso/studio-yoan/hoc-depot');
const REEL = path.join(HOC, 'outils', 'zernio.py');
// Sans le dépôt de Yoan sur ce Mac (chez Romain), ces tests sont sautés.
const SAUTER = fs.existsSync(REEL) ? false : `zernio.py de Yoan introuvable (${REEL}) : variable ZERNIO_REEL_YOAN`;
const DANS_3_JOURS = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

const RESSOURCE = `# Le modèle de tableur de suivi

- Statut : en ligne le 20/11/2026

## Message automatique
- Mot : TABLEUR
- Lien : https://ressources.yoanmottier.com/le-tableur-de-suivi/
- Bouton : Ouvrir le tableur
- Message :
  > Salut {{first_name}}, voici le tableur.
- Réponses publiques :
  - Je t'ai envoyé ça en message
- Validé par Yoan : 20/11/2026
`;

let racine, depot, media, log, config;
const PRETES = [{ slug: 'le-tableur-de-suivi', titre: 'Le modèle de tableur de suivi', mot: 'TABLEUR' }];

function ecrire(f, t) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); }
function appels() {
  if (!fs.existsSync(log)) return [];
  return fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
function reel(slug, legende) {
  ecrire(path.join(depot, 'contenus', slug, 'etat.json'), JSON.stringify({ version: 1, titre: slug, format: 'reel' }) + '\n');
  ecrire(path.join(depot, 'contenus', slug, 'script.md'), `# ${slug}\n\n## Texte complet\n\nBla.\n\n## Légende\n\n${legende}\n`);
  ecrire(path.join(media, slug, 'face', 'rush-monte.mp4'), 'video');
}

before(() => {
  if (SAUTER) return;
  racine = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-pub-res-'));
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
  config = {
    depot_hoc: depot, depot_mac: depot, media, ressources: true,
    publication: { heures_par_defaut: { reel: '18:30' }, jours_par_defaut: ['mardi'], simulation: true },
  };
  ecrire(path.join(depot, 'contenus', 'le-tableur-de-suivi', 'ressource.md'), RESSOURCE);
  ecrire(path.join(depot, 'site', 'le-tableur-de-suivi', 'index.html'), '<!doctype html>\n');
  ecrire(path.join(depot, 'contenus', 'pas-en-ligne', 'ressource.md'), RESSOURCE.replace('en ligne le 20/11/2026', 'à vérifier par Yoan').replace(/TABLEUR/g, 'CARNET').replace('le-tableur-de-suivi', 'pas-en-ligne'));
  reel('messages-a-23h', 'Tu réponds à 23 h ? Commente TABLEUR et je t\'envoie mon modèle.');
  reel('sans-mot', 'Une légende sans appel à commenter.');
});

after(() => { if (racine) fs.rmSync(racine, { recursive: true, force: true }); delete process.env.STUDIO_RACINE; });
beforeEach(() => { if (SAUTER) return; try { fs.unlinkSync(log); } catch { /* rien */ } oublierRecaps(); });

describe('récapitulatif avec ressources', { skip: SAUTER }, () => {
  test('liste des ressources en ligne rendue ; légende qui annonce un mot sans ressource : bloqué', async () => {
    const r = await recap([{ slug: 'messages-a-23h', quand: `${DANS_3_JOURS} 18:30` }], config, { ressources: PRETES });
    assert.deepEqual(r.ressources, PRETES);
    const e = r.elements[0];
    assert.equal(e.verdict, 'BLOQUE');
    assert.ok(e.messages.includes(PHRASE_MOT_SANS_RESSOURCE), e.messages.join(' / '));
    assert.equal(e.ressource, null);
    assert.ok(!appels()[0].argv.includes('--ressource'));
  });

  test('ressource choisie : --ressource passé à verifier, mot lu, verdict OK', async () => {
    const r = await recap([{ slug: 'messages-a-23h', quand: `${DANS_3_JOURS} 18:30`, ressource: 'le-tableur-de-suivi' }], config, { ressources: PRETES });
    const e = r.elements[0];
    assert.equal(e.verdict, 'OK', e.messages.join(' / '));
    assert.equal(e.mot, 'TABLEUR');
    assert.equal(e.ressource, 'le-tableur-de-suivi');
    assert.equal(e.ressource_titre, 'Le modèle de tableur de suivi');
    const a = appels()[0].argv;
    assert.deepEqual(a.slice(a.indexOf('--ressource'), a.indexOf('--ressource') + 2), ['--ressource', 'le-tableur-de-suivi']);
  });

  test('ressource pas en ligne : bloqué avec une phrase claire, sans chemin', async () => {
    const r = await recap([{ slug: 'messages-a-23h', quand: `${DANS_3_JOURS} 18:30`, ressource: 'pas-en-ligne' }], config, { ressources: PRETES });
    const e = r.elements[0];
    assert.equal(e.verdict, 'BLOQUE');
    assert.ok(e.messages.some((m) => /pas encore en ligne/.test(m)), e.messages.join(' / '));
    assert.ok(!e.messages.join(' ').includes('/'), 'pas de chemin');
  });

  test('légende sans mot et sans ressource : rien de bloqué', async () => {
    const r = await recap([{ slug: 'sans-mot', quand: `${DANS_3_JOURS} 18:30` }], config, { ressources: PRETES });
    assert.equal(r.elements[0].verdict, 'OK', r.elements[0].messages.join(' / '));
  });

  test('simulation : publier reçoit --ressource ; la phrase dit qui reçoit quoi', async () => {
    const r = await recap([{ slug: 'messages-a-23h', quand: `${DANS_3_JOURS} 18:30`, ressource: 'le-tableur-de-suivi' }], config, { ressources: PRETES });
    const c = await confirmer(r.recap_id, config);
    assert.equal(c.resultats[0].statut, 'simulation', c.resultats[0].message);
    assert.match(c.resultats[0].message, /Ceux qui commenteraient TABLEUR recevraient « Le modèle de tableur de suivi »/);
    const pub = appels().find((x) => x.argv[0] === 'publier');
    assert.ok(pub.argv.includes('--ressource') && pub.argv.includes('le-tableur-de-suivi'), pub.argv.join(' '));
    assert.ok(!pub.argv.includes('--envoyer'));
  });

  test('poster tout de suite : même récapitulatif, publier --maintenant --ressource en simulation', async () => {
    const r = await recap([{ slug: 'messages-a-23h', quand: 'maintenant', ressource: 'le-tableur-de-suivi' }], config, { ressources: PRETES });
    assert.equal(r.elements[0].verdict, 'OK', r.elements[0].messages.join(' / '));
    const c = await confirmer(r.recap_id, config);
    assert.equal(c.resultats[0].statut, 'simulation', c.resultats[0].message);
    assert.match(c.resultats[0].message, /tout de suite/);
    const pub = appels().find((x) => x.argv[0] === 'publier');
    assert.ok(pub.argv.includes('--maintenant') && pub.argv.includes('--ressource'), pub.argv.join(' '));
  });

  test('pour de vrai : post parti sans le mot (code 6) : « Brancher le mot » proposé, la suite continue', async () => {
    const r = await recap([
      { slug: 'messages-a-23h', quand: `${DANS_3_JOURS} 18:30`, ressource: 'le-tableur-de-suivi' },
      { slug: 'sans-mot', quand: `${DANS_3_JOURS} 19:30` },
    ], config, { ressources: PRETES });
    const vus = [];
    const executer = async (args, o) => {
      vus.push({ args, ecriture: o.ecriture });
      if (args[0] === 'verifier') {
        const vrai = args[1] === 'messages-a-23h';
        const leg = vrai ? 'Tu réponds à 23 h ? Commente TABLEUR et je t\'envoie mon modèle.' : 'Une légende sans appel à commenter.';
        return { code: 0, sortie: `CONTENU ${args[1]} (reel) sur @ia.yoan\nLEGENDE (x, ${Array.from(leg).length} caractères) :\n${leg}\nMOT ${vrai ? 'TABLEUR' : 'aucun'}\nOK prêt\n` };
      }
      if (args[1] === 'messages-a-23h') return { code: 6, sortie: 'POST 6aa000000000000000000001 statut=programmé lien=à venir\nMOT_NON_POSE : le post est programmé, mais le mot TABLEUR n\'est pas branché : refus.\n' };
      return { code: 0, sortie: 'POST 6aa000000000000000000002 statut=programmé lien=à venir\nFAIT\n' };
    };
    const sim = { ...config, publication: { ...config.publication, simulation: false } };
    const c = await confirmer(r.recap_id, sim, { executer });
    assert.equal(c.resultats[0].statut, 'mot_non_pose');
    assert.deepEqual(c.resultats[0].poser_mot, { slug: 'messages-a-23h', ressource: 'le-tableur-de-suivi' });
    assert.match(c.resultats[0].message, /Brancher le mot/);
    assert.equal(c.resultats[1].statut, 'programmé');
    const pubs = vus.filter((v) => v.args[0] === 'publier');
    assert.equal(pubs.length, 2);
    assert.ok(pubs[0].args.includes('--envoyer') && pubs[0].args.includes('--ressource') && pubs[0].ecriture);
    assert.ok(!pubs[1].args.includes('--ressource'));
  });

  test('brancher le mot : simulation sans --envoyer ; pour de vrai --envoyer et l\'autorisation, une fois', async () => {
    const vus = [];
    const executer = async (args, o) => {
      vus.push({ args, ecriture: o.ecriture });
      return o.ecriture ? { code: 0, sortie: 'MOT_POSE TABLEUR sur postId=x (règle r1)\nFAIT\n' } : { code: 0, sortie: 'SIMULATION_OK\n' };
    };
    const s = await poserMot('messages-a-23h', 'le-tableur-de-suivi', config, { executer });
    assert.equal(s.statut, 'simulation');
    assert.ok(!vus[0].args.includes('--envoyer') && !vus[0].ecriture);
    const v = await poserMot('messages-a-23h', 'le-tableur-de-suivi', { ...config, publication: { simulation: false } }, { executer });
    assert.equal(v.statut, 'pose');
    assert.match(v.message, /TABLEUR/);
    assert.ok(vus[1].args.includes('--envoyer') && vus[1].ecriture);
    await assert.rejects(poserMot('x', 'y', { ...config, ressources: false }, { executer }), /pas de ressources/);
  });
});

describe('client sans site de ressources (Romain)', { skip: SAUTER }, () => {
  test('`ressource` ignoré : ni --ressource, ni liste, ni blocage du mot ; réponse inchangée', async () => {
    const romain = { ...config, ressources: false };
    const r = await recap([{ slug: 'messages-a-23h', quand: `${DANS_3_JOURS} 18:30`, ressource: 'le-tableur-de-suivi' }], romain, { ressources: PRETES });
    assert.ok(!('ressources' in r));
    assert.ok(!('ressource' in r.elements[0]));
    assert.ok(!appels()[0].argv.includes('--ressource'));
    assert.ok(!r.elements[0].messages.includes(PHRASE_MOT_SANS_RESSOURCE));
  });
});
