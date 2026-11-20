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

import { spawnSync } from 'node:child_process';
import { confirmer as confirmerAuClic, lancerZernio, motAbsent, oublierRecaps, poserMot, recap, PHRASE_MOT_SANS_RESSOURCE } from '../publication.mjs';

// Lot 13 : rien ne part sans plateforme cochée. Ces essais d'avant TikTok cochent Instagram pour chaque contenu,
// comme le ferait le clic ; les essais de TikTok (tiktok.test.mjs) passent leurs propres choix.
const INSTAGRAM_COCHE = new Proxy({}, { get: (_, k) => (typeof k === 'string' ? ['instagram'] : undefined) });
const confirmer = (id, config, opts = {}) => confirmerAuClic(id, config, { plateformes: INSTAGRAM_COCHE, ...opts });
import { motAbsent as motAbsentInterface } from '../../interface/app/mot-absent.js';

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
  // Une ressource en ligne dont le message n'est pas encore validé (le cas de la ressource MONTEUR).
  ecrire(path.join(depot, 'contenus', 'le-monteur', 'ressource.md'), RESSOURCE.replace(/TABLEUR/g, 'MONTEUR')
    .replace(/le-tableur-de-suivi/g, 'le-monteur').replace('- Validé par Yoan : 20/11/2026', '- Validé par Yoan : '));
  ecrire(path.join(depot, 'site', 'le-monteur', 'index.html'), '<!doctype html>\n');
  reel('messages-a-23h', 'Tu réponds à 23 h ? Commente TABLEUR et je t\'envoie mon modèle.');
  reel('video-montee', 'Commente MONTEUR et je t\'envoie la méthode.');
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
    assert.match(c.resultats[0].message, /Ceux qui commenteraient TABLEUR sur Instagram recevraient « Le modèle de tableur de suivi »/);
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

// La ligne de la liste telle que le serveur la donne (ressources.mjs pourUnPost), empreinte lue par le vrai zernio.py.
function ligneMonteur() {
  const r = spawnSync('python3', [path.join(depot, 'outils', 'zernio.py'), 'ressources', '--format', 'json'],
    { cwd: depot, env: { ...process.env, HOC_DEPOT: depot }, encoding: 'utf8' });
  const f = JSON.parse(r.stdout.trim().split('\n').pop()).ressources.find((x) => x.slug === 'le-monteur');
  assert.equal(f.valide, false);
  return { slug: 'le-monteur', titre: 'Le monteur', mot: 'MONTEUR', disponible: true, a_valider: true,
    message: f.message, bouton: f.bouton, empreinte: f.empreinte };
}

describe('message pas validé et retouches au récapitulatif', { skip: SAUTER }, () => {
  test('liste : le message pas validé ne bloque pas, il est montré tel que la personne le recevra', async () => {
    const liste = [...PRETES, ligneMonteur(), { slug: 'la-grille', titre: 'La grille', mot: 'GRILLE', disponible: false, probleme: 'La page ne répond pas à son adresse.' }];
    const r = await recap([{ slug: 'video-montee', quand: `${DANS_3_JOURS} 18:30`, ressource: 'le-monteur' }], config, { ressources: liste });
    const e = r.elements[0];
    assert.equal(e.verdict, 'OK', e.messages.join(' / '));
    assert.equal(e.message_dm.a_valider, true);
    assert.equal(e.message_dm.message, 'Salut [son prénom], voici le tableur.');
    assert.equal(e.message_dm.bouton, 'Ouvrir le tableur');
    assert.equal(e.legende_modifiable, true);
    const grille = r.ressources.find((x) => x.slug === 'la-grille');
    assert.deepEqual(grille, { slug: 'la-grille', titre: 'La grille', mot: 'GRILLE', disponible: false, probleme: 'La page ne répond pas à son adresse.' });
    // Une ressource grisée choisie quand même : bloqué, avec sa raison.
    const g = await recap([{ slug: 'video-montee', quand: `${DANS_3_JOURS} 18:30`, ressource: 'la-grille' }], config, { ressources: liste });
    assert.equal(g.elements[0].verdict, 'BLOQUE');
    assert.ok(g.elements[0].messages.some((m) => /ne répond pas à son adresse/.test(m)), g.elements[0].messages.join(' / '));
  });

  test('simulation : retouches contrôlées par les vrais outils, rien d\'écrit ; la légende retouchée est celle que publier lit', async () => {
    const fiche = path.join(depot, 'contenus', 'le-monteur', 'ressource.md');
    const avant = fs.readFileSync(fiche, 'utf8');
    const script = fs.readFileSync(path.join(depot, 'contenus', 'video-montee', 'script.md'), 'utf8');
    const r = await recap([{ slug: 'video-montee', quand: `${DANS_3_JOURS} 18:30`, ressource: 'le-monteur' }], config, { ressources: [ligneMonteur()] });
    const c = await confirmer(r.recap_id, config, { textes: { 'video-montee': {
      legende: 'Commente MONTEUR, je t\'envoie tout.\n\n#montage #ia', message: 'Salut [son prénom], la méthode est là.', bouton: 'Voir la méthode' } } });
    assert.equal(c.resultats[0].statut, 'simulation', c.resultats[0].message);
    assert.match(c.resultats[0].message, /légende retouchée serait enregistrée, ton message retouché serait enregistré et validé/);
    const v = appels().find((x) => x.argv[0] === 'valider-message');
    assert.ok(v.argv.includes('--essai') && !v.argv.includes('--pousser'), v.argv.join(' '));
    assert.equal(fs.readFileSync(fiche, 'utf8'), avant, 'la fiche ne bouge pas en simulation');
    assert.equal(fs.readFileSync(path.join(depot, 'contenus', 'video-montee', 'script.md'), 'utf8'), script);
    const pub = appels().find((x) => x.argv[0] === 'publier');
    assert.ok(pub.argv.includes('--legende-fichier'), pub.argv.join(' '));
  });

  test('simulation : ce qui est montré est ce qui partirait, légende, message et bouton retouchés (pas ceux de la fiche)', async () => {
    const fiche = path.join(depot, 'contenus', 'le-monteur', 'ressource.md');
    const avant = fs.readFileSync(fiche, 'utf8');
    const sorties = [];
    const executer = async (args, o) => { const r = await lancerZernio(config, args, o); sorties.push({ args, sortie: r.sortie }); return r; };
    const r = await recap([{ slug: 'video-montee', quand: `${DANS_3_JOURS} 18:30`, ressource: 'le-monteur' }], config, { ressources: [ligneMonteur()], executer });
    const c = await confirmer(r.recap_id, config, { executer, textes: { 'video-montee': {
      legende: 'Commente MONTEUR, je t\'envoie tout.', message: 'Salut [son prénom], la méthode retouchée est là.', bouton: 'Voir  la méthode' } } });
    const x = c.resultats[0];
    assert.equal(x.statut, 'simulation', x.message);
    assert.deepEqual(x.envoi, { legende: 'Commente MONTEUR, je t\'envoie tout.', mot: 'MONTEUR',
      message: 'Salut [son prénom], la méthode retouchée est là.', bouton: 'Voir la méthode', plateformes: ['instagram'] });
    // Les requêtes exactes que publier aurait envoyées : rien de la fiche ne reste.
    const pub = sorties.find((y) => y.args[0] === 'publier');
    assert.ok(pub.args.includes('--message-fichier') && pub.args.includes('--legende-fichier'), pub.args.join(' '));
    assert.match(pub.sortie, /^SIMULATION_OK$/m);
    assert.match(pub.sortie, /"content": "Commente MONTEUR, je t'envoie tout\."/);
    assert.match(pub.sortie, /"dmMessage": "Salut \{\{first_name\}\}, la méthode retouchée est là\."/);
    assert.match(pub.sortie, /"title": "Voir la méthode"/);
    assert.ok(!pub.sortie.includes('voici le tableur') && !pub.sortie.includes('Ouvrir le tableur'), 'ni message ni bouton de la fiche');
    assert.equal(fs.readFileSync(fiche, 'utf8'), avant, 'la fiche ne bouge pas en simulation');
    // Message pas retouché, mais à valider : celui de la fiche, tenu pour validé (le clic le valide), et montré.
    const r2 = await recap([{ slug: 'video-montee', quand: `${DANS_3_JOURS} 18:30`, ressource: 'le-monteur' }], config, { ressources: [ligneMonteur()] });
    const c2 = await confirmer(r2.recap_id, config, {});
    assert.equal(c2.resultats[0].statut, 'simulation', c2.resultats[0].message);
    assert.equal(c2.resultats[0].envoi.message, 'Salut [son prénom], voici le tableur.');
    assert.equal(c2.resultats[0].envoi.bouton, 'Ouvrir le tableur');
    assert.equal(c2.resultats[0].envoi.legende, 'Commente MONTEUR et je t\'envoie la méthode.');
  });

  test('« la légende ne cite pas le mot » : à part, avec le verdict sans lui ; même règle que zernio.py côté interface', async () => {
    reel('sans-le-mot', 'Je t\'envoie la méthode en message.');
    const r = await recap([{ slug: 'sans-le-mot', quand: `${DANS_3_JOURS} 18:30`, ressource: 'le-tableur-de-suivi' }], config, { ressources: PRETES });
    const e = r.elements[0];
    assert.equal(e.verdict, 'ATTENTION', e.messages.join(' / '));
    assert.deepEqual(e.mot_absent, { mot: 'TABLEUR', message: e.messages.at(-1), verdict_sinon: 'OK' });
    assert.match(e.mot_absent.message, /^La légende ne cite pas le mot TABLEUR/);
    // L'interface le retire dès que la légende retouchée cite le mot (sans accents ni casse), le remet sinon.
    for (const f of [motAbsent, motAbsentInterface]) {
      assert.equal(f(e.legende, 'TABLEUR'), true);
      assert.equal(f('Commente « tableur » et je t\'envoie la méthode.', 'TABLEUR'), false);
      assert.equal(f('Commente TABLÉUR.', 'TABLEUR'), false);
      assert.equal(f('Commente TABLE.', 'TABLEUR'), true);
      assert.equal(f('peu importe', null), false);
    }
    // Revérifié avec la légende qui cite le mot : plus d'avertissement, verdict OK (le serveur dit pareil).
    const script = path.join(depot, 'contenus', 'sans-le-mot', 'script.md');
    fs.writeFileSync(script, fs.readFileSync(script, 'utf8').replace('Je t\'envoie la méthode en message.', 'Commente tableur, je t\'envoie la méthode.'));
    const r2 = await recap([{ slug: 'sans-le-mot', quand: `${DANS_3_JOURS} 18:30`, ressource: 'le-tableur-de-suivi' }], config, { ressources: PRETES });
    assert.equal(r2.elements[0].verdict, 'OK', r2.elements[0].messages.join(' / '));
    assert.ok(!('mot_absent' in r2.elements[0]));
    assert.ok(!r2.elements[0].messages.some((m) => /ne cite pas le mot/.test(m)));
  });

  test('retouche fausse : bloqué avec la raison, aucun outil d\'écriture lancé', async () => {
    const r = await recap([{ slug: 'video-montee', quand: `${DANS_3_JOURS} 18:30`, ressource: 'le-monteur' }], config, { ressources: [ligneMonteur()] });
    const vus = [];
    const executer = async (args, o) => { vus.push(args); return { code: 0, sortie: 'OK\n' }; };
    const reel = { ...config, publication: { ...config.publication, simulation: false } };
    const c = await confirmer(r.recap_id, reel, { executer: async (args, o) => {
      if (args[0] === 'verifier') return { code: 1, sortie: `LEGENDE (x, ${Array.from('Commente MONTEUR et je t\'envoie la méthode.').length} caractères) :\nCommente MONTEUR et je t'envoie la méthode.\nMOT MONTEUR\nBLOQUE ressource le-monteur : message pas validé par Yoan (ligne « Validé par Yoan » vide)\n` };
      return executer(args, o);
    }, textes: { 'video-montee': { bouton: 'Un texte de bouton beaucoup trop long' } } });
    assert.equal(c.resultats[0].statut, 'bloque');
    assert.match(c.resultats[0].message, /bouton est trop long/);
    assert.deepEqual(vus, [], 'ni écriture ni envoi');
  });

  test('pour de vrai : légende et message retouchés enregistrés (et poussés) avant l\'envoi, puis revérifiés', async () => {
    const r = await recap([{ slug: 'video-montee', quand: `${DANS_3_JOURS} 18:30`, ressource: 'le-monteur' }], config, { ressources: [ligneMonteur()] });
    const nouvelle = 'Commente MONTEUR, je t\'envoie tout.';
    let ecrite = false; let validee = false;
    const vus = [];
    const executer = async (args, o) => {
      const entree = args.includes('--depuis') ? JSON.parse(fs.readFileSync(args[args.indexOf('--depuis') + 1], 'utf8')) : null;
      vus.push({ args, o, entree });
      if (args[0] === 'verifier') {
        const leg = ecrite ? nouvelle : 'Commente MONTEUR et je t\'envoie la méthode.';
        return { code: validee ? 0 : 1, sortie: `LEGENDE (x, ${Array.from(leg).length} caractères) :\n${leg}\nMOT MONTEUR\n${validee ? 'OK prêt' : 'BLOQUE ressource le-monteur : message pas validé par Yoan (ligne « Validé par Yoan » vide)'}\n` };
      }
      if (args[0] === 'ecrire') { ecrite = true; return { code: 0, sortie: 'OK brief slug=video-montee\n' }; }
      if (args[0] === 'valider-message') { validee = true; return { code: 0, sortie: 'OK message ressource=le-monteur\n' }; }
      return { code: 0, sortie: 'POST 6aa000000000000000000001 statut=programmé lien=à venir\nFAIT\n' };
    };
    const reel = { ...config, publication: { ...config.publication, simulation: false } };
    const c = await confirmer(r.recap_id, reel, { executer, textes: { 'video-montee': { legende: nouvelle + '\n', message: 'Salut [son prénom], la méthode est là.' } } });
    assert.equal(c.resultats[0].statut, 'programmé', c.resultats[0].message);
    const ordre = vus.map((v) => v.args[0]);
    assert.deepEqual(ordre, ['verifier', 'ecrire', 'valider-message', 'verifier', 'publier']);
    const b = vus[1];
    assert.equal(b.o.script, 'brief.py'); assert.equal(b.o.dans, 'depot'); assert.equal(b.o.ecriture, false);
    assert.deepEqual(b.entree, { legende: nouvelle });
    assert.ok(b.args.includes('--pousser') && b.args[b.args.indexOf('--empreinte') + 1].startsWith('sha256:'), b.args.join(' '));
    const m = vus[2];
    assert.equal(m.o.dans, 'depot'); assert.equal(m.o.ecriture, false);
    assert.deepEqual(m.entree, { message: 'Salut [son prénom], la méthode est là.' }, 'zernio.py remet {{first_name}}');
    assert.ok(m.args.includes('--pousser') && m.args.includes('--empreinte'), m.args.join(' '));
    assert.ok(vus[4].args.includes('--envoyer') && vus[4].o.ecriture);
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
