// Tests de la publication du studio : node --test studio/publication/tests/
//
// Le dépôt du head of content est fabriqué dans un dossier temporaire ; son outils/zernio.py est le
// faux (faux_zernio.py), qui charge le vrai zernio.py (variable ZERNIO_REEL, ou le dépôt voisin
// head-of-content) en coupant le réseau, git et --envoyer. Aucun test ne passe --envoyer à un
// processus : le chemin « pour de vrai » est testé avec un exécuteur injecté qui note les appels.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { dossierSlides, lierSlides, slidesDe } from '../carrousels.mjs';
import {
  confirmer, dateZurich, lancerZernio, lireVerifier, oublierRecaps, phrase, recap, semaine,
} from '../publication.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const REEL = process.env.ZERNIO_REEL
  || path.resolve(ICI, '../../../../../agents/head-of-content/depot/outils/zernio.py');
const EM = String.fromCharCode(0x2014);
const DEMAIN = (() => { // une date sûre dans le futur, au format du studio
  const d = new Date(Date.now() + 3 * 86400000);
  return d.toISOString().slice(0, 10);
})();

let racine, depot, media, log, config;

function ecrire(f, t) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); }
function png(f, w, h) {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8); b.write('IHDR', 12); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20);
  ecrire(f, b);
}
function appels() {
  if (!fs.existsSync(log)) return [];
  return fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
const LEGENDE_OK = 'Tu as faim à 16 h ? 🍎\n\nC\'est souvent le déjeuner, pas ta volonté.\nBLOQUE ce créneau dans ta tête : une collation.\n\n#nutrition';

function contenu(slug, { format = 'reel', titre, legende, script = true } = {}) {
  ecrire(path.join(depot, 'contenus', slug, 'etat.json'), JSON.stringify({ version: 1, titre: titre || slug, format }) + '\n');
  if (format === 'reel' && script) {
    ecrire(path.join(depot, 'contenus', slug, 'script.md'),
      `# ${titre || slug}\n\n## Script\n\nBla.\n\n${legende === null ? '' : `## Légende\n\n${legende}\n\n`}## Conseils\n\nRien.\n`);
  }
}
function face(slug, noms) {
  noms.forEach((n, i) => {
    const f = path.join(media, slug, 'face', n);
    ecrire(f, 'video ' + n);
    const t = new Date(Date.now() - (noms.length - i) * 60000);
    fs.utimesSync(f, t, t);
  });
}

before(() => {
  assert.ok(fs.existsSync(REEL), 'vrai zernio.py introuvable : ' + REEL + ' (variable ZERNIO_REEL)');
  racine = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-pub-'));
  depot = path.join(racine, 'hoc');
  media = path.join(racine, 'Contenu');
  log = path.join(racine, 'appels.jsonl');
  fs.mkdirSync(path.join(depot, 'outils'), { recursive: true });
  fs.copyFileSync(path.join(ICI, 'faux_zernio.py'), path.join(depot, 'outils', 'zernio.py'));
  ecrire(path.join(depot, 'CLAUDE.md'), '# Dépôt de test\n');
  process.env.FAUX_ZERNIO_LOG = log;
  process.env.FAUX_ZERNIO_REEL = REEL;
  delete process.env.STUDIO_SIMULATION;
  delete process.env.ZERNIO_ECRITURE_ROMAIN;
  config = {
    depot_hoc: depot, depot_mac: depot, media,
    publication: { heures_par_defaut: { reel: '18:30', carrousel: '12:15' }, jours_par_defaut: ['mardi', 'jeudi', 'dimanche'], simulation: true },
  };

  contenu('faim-a-16h', { titre: 'Pourquoi tu as faim à 16 h', legende: LEGENDE_OK });
  face('faim-a-16h', ['rush.mov', 'rush-monte.mp4', 'rush-monte-2.mp4']);
  contenu('sans-legende', { titre: 'Sans légende', legende: null });
  face('sans-legende', ['a.mov', 'a-monte.mp4']);
  contenu('tiret', { titre: 'Tiret', legende: `Une phrase ${EM} avec un tiret long.` });
  face('tiret', ['t.mov', 't-monte.mp4']);
  contenu('commente', { titre: 'Commente', legende: 'Commente « DOSFORT » pour recevoir le guide.' });
  face('commente', ['c.mov', 'c-monte.mp4']);
  contenu('provisoire', { titre: 'Provisoire', legende: 'À venir, une fois les slides validées.' });
  face('provisoire', ['v.mov', 'v-monte.mp4']);
  contenu('pas-monte', { titre: 'Pas monté', legende: 'Une légende.' });
  face('pas-monte', ['p.mov']);

  // un carrousel mis en page : texte rendu, registre des rendus, slides dans un dossier à part
  contenu('trois-erreurs', { format: 'carrousel', titre: '3 erreurs au petit-déj' });
  const slides = path.join(racine, 'Pictures', 'Carrousels', 'carrousel-trois-erreurs');
  png(path.join(slides, 'slide-01.png'), 1080, 1350);
  png(path.join(slides, 'slide-02.png'), 1080, 1350);
  png(path.join(slides, 'slide-10.png'), 1080, 1350);
  ecrire(path.join(depot, 'rendus', 'carrousels', 'trois-erreurs.md'), '# 3 erreurs\n\n## Légende\n\nTrois erreurs que je vois tout le temps.\n');
  ecrire(path.join(depot, 'rendus', 'registre.json'), JSON.stringify({ version: 1, carrousels: { 'trois-erreurs': { dossier: slides } } }));
});

after(() => { if (racine) fs.rmSync(racine, { recursive: true, force: true }); });
beforeEach(() => { oublierRecaps(); try { fs.unlinkSync(log); } catch { /* vide */ } delete process.env.STUDIO_SIMULATION; });

describe('recap', () => {
  test('reel prêt : dernière vidéo montée, légende exacte (emoji, ligne qui commence par BLOQUE), verdict OK', async () => {
    const r = await recap([{ slug: 'faim-a-16h', quand: `${DEMAIN} 18:30` }], config);
    assert.match(r.recap_id, /^r-[0-9a-f]{24}$/);
    const [e] = r.elements;
    assert.equal(e.verdict, 'OK', JSON.stringify(e.messages));
    assert.equal(e.titre, 'Pourquoi tu as faim à 16 h');
    assert.equal(e.type, 'reel');
    assert.equal(e.legende, LEGENDE_OK);
    assert.equal(e.mot, null);
    assert.equal(e.video_url, '/api/media/faim-a-16h/face/rush-monte-2.mp4');
    assert.deepEqual(e.messages, []);
    const a = appels();
    assert.equal(a.length, 1);
    assert.equal(a[0].argv[0], 'verifier');
    assert.ok(!a[0].argv.includes('--envoyer'));
    assert.equal(a[0].argv.at(-1), '--pousser', 'verifier aligne d\'abord la copie des scripts du Mac');
    assert.equal(a[0].ecriture, null);
    assert.equal(a[0].hoc_depot, depot);
  });

  test('BLOQUE et ATTENTION remontent en phrases claires, sans chemin', async () => {
    const r = await recap([
      { slug: 'sans-legende', quand: `${DEMAIN} 18:30` },
      { slug: 'tiret', quand: `${DEMAIN} 18:30` },
      { slug: 'commente', quand: `${DEMAIN} 18:30` },
      { slug: 'pas-monte', quand: `${DEMAIN} 18:30` },
      { slug: 'faim-a-16h', quand: '2020-01-01 10:00' },
      { slug: 'Mauvais Slug', quand: `${DEMAIN} 18:30` },
    ], config);
    const [sl, ti, co, pm, passe, mauvais] = r.elements;
    assert.equal(sl.verdict, 'BLOQUE');
    assert.match(sl.messages[0], /pas encore de légende validée/);
    assert.equal(ti.verdict, 'BLOQUE');
    assert.match(ti.messages.join(' '), /tiret long/);
    assert.equal(co.verdict, 'ATTENTION');
    assert.match(co.messages[0], /aucun message automatique n'est prévu/);
    assert.equal(pm.verdict, 'BLOQUE');
    assert.match(pm.messages[0], /pas encore de vidéo montée/);
    assert.equal(passe.verdict, 'BLOQUE');
    assert.match(passe.messages[0], /déjà passée/);
    assert.equal(mauvais.verdict, 'BLOQUE');
    for (const e of r.elements) for (const m of e.messages) {
      assert.ok(!/[/\\]|\.md|\.mp4|slug|--/.test(m), 'message technique : ' + m);
      assert.ok(!m.includes(EM));
    }
    assert.ok(appels().every((a) => a.argv[0] === 'verifier' && !a.argv.includes('--envoyer')));
  });

  test('carrousel : lien des slides posé, slides dans l\'ordre, verdict OK', async () => {
    const r = await recap([{ slug: 'trois-erreurs', quand: `${DEMAIN} 12:15` }], config);
    const [e] = r.elements;
    assert.equal(e.verdict, 'OK', JSON.stringify(e.messages));
    assert.equal(e.type, 'carrousel');
    assert.equal(e.legende, 'Trois erreurs que je vois tout le temps.');
    assert.deepEqual(e.slides_urls, ['/api/media/trois-erreurs/slides/slide-01.png', '/api/media/trois-erreurs/slides/slide-02.png', '/api/media/trois-erreurs/slides/slide-10.png']);
    assert.ok(fs.lstatSync(path.join(media, 'trois-erreurs', 'slides')).isSymbolicLink());
    assert.deepEqual(appels()[0].argv, ['verifier', 'trois-erreurs', '--carrousel', '--pousser']);
  });
});

describe('confirmer', () => {
  test('simulation par la config : publier sans --envoyer ni --pousser, sans ZERNIO_ECRITURE_ROMAIN', async () => {
    const r = await recap([{ slug: 'faim-a-16h', quand: `${DEMAIN} 18:30` }, { slug: 'trois-erreurs', quand: `${DEMAIN} 12:15` }], config);
    fs.unlinkSync(log);
    const c = await confirmer(r.recap_id, config);
    assert.equal(c.simulation, true);
    assert.deepEqual(c.resultats.map((x) => x.statut), ['simulation', 'simulation']);
    assert.match(c.resultats[0].message, /^Simulation, rien n'est parti : en vrai, ta vidéo serait programmée pour \S+ \d+ \S+ à 18 h 30\.$/);
    const pub = appels().filter((a) => a.argv[0] === 'publier');
    assert.equal(pub.length, 2);
    for (const a of appels()) {
      assert.ok(!a.argv.includes('--envoyer'), JSON.stringify(a));
      if (a.argv[0] === 'publier') assert.ok(!a.argv.includes('--pousser'), JSON.stringify(a));
      assert.equal(a.ecriture, null);
    }
    assert.deepEqual(pub[0].argv, ['publier', 'faim-a-16h', '--video', path.join(media, 'faim-a-16h', 'face', 'rush-monte-2.mp4'), '--quand', `${DEMAIN} 18:30`]);
  });

  test('simulation par STUDIO_SIMULATION=1, prioritaire sur la config', async () => {
    process.env.STUDIO_SIMULATION = '1';
    const cfg = { ...config, publication: { ...config.publication, simulation: false } };
    const vus = [];
    const r = await recap([{ slug: 'faim-a-16h', quand: `${DEMAIN} 18:30` }], cfg);
    const c = await confirmer(r.recap_id, cfg, { executer: (args, o) => { vus.push({ args, o }); return lancerZernio(cfg, args, o); } });
    assert.equal(c.simulation, true);
    assert.equal(c.resultats[0].statut, 'simulation');
    assert.ok(vus.every((v) => !v.args.includes('--envoyer') && !v.o.ecriture));
  });

  test('recap inconnu, expiré, ou déjà confirmé : refusé, rien n\'est lancé', async () => {
    await assert.rejects(confirmer('r-000000000000000000000000', config), { code: 'RECAP_INCONNU' });
    await assert.rejects(confirmer(undefined, config), { code: 'RECAP_INCONNU' });
    const r = await recap([{ slug: 'faim-a-16h', quand: `${DEMAIN} 18:30` }], config);
    fs.unlinkSync(log);
    await assert.rejects(confirmer(r.recap_id, config, { maintenant: () => new Date(Date.now() + 31 * 60000) }), { code: 'RECAP_EXPIRE' });
    await assert.rejects(confirmer(r.recap_id, config), { code: 'RECAP_INCONNU' });
    const r2 = await recap([{ slug: 'faim-a-16h', quand: `${DEMAIN} 18:30` }], config);
    await confirmer({ recap_id: r2.recap_id }, config);
    await assert.rejects(confirmer(r2.recap_id, config), { code: 'RECAP_INCONNU' });
    assert.equal(appels().filter((a) => a.argv[0] === 'publier').length, 1);
  });

  test('pour de vrai (simulation coupée) : --envoyer et l\'autorisation seulement sur publier, après confirmer', async () => {
    const cfg = { ...config, publication: { ...config.publication, simulation: false } };
    const vus = [];
    const executer = (args, o) => {
      vus.push({ args, ecriture: !!o.ecriture });
      if (args[0] === 'verifier') return lancerZernio(cfg, args, o); // le faux, jamais --envoyer
      return { code: 0, sortie: 'CONTENU faim-a-16h (reel) sur @fitavecromain\nOK prêt\nENVOYE rush-monte-2.mp4\nPOST 65aa statut=programmé lien=à venir\nENREGISTRE registre des publications envoyé au head of content\nFAIT\n' };
    };
    const r = await recap([{ slug: 'faim-a-16h', quand: `${DEMAIN} 18:30` }, { slug: 'sans-legende', quand: `${DEMAIN} 18:30` }], cfg, { executer });
    assert.ok(vus.every((v) => v.args[0] === 'verifier' && !v.ecriture), 'recap ne publie rien');
    vus.length = 0;
    const c = await confirmer(r.recap_id, cfg, { executer });
    assert.equal(c.simulation, false);
    assert.equal(c.resultats[0].statut, 'programmé');
    assert.match(c.resultats[0].message, /^Ta vidéo est programmée pour .* à 18 h 30\. Tu peux fermer ton Mac/);
    assert.equal(c.resultats[1].statut, 'bloque');
    const pub = vus.filter((v) => v.args[0] === 'publier');
    assert.equal(pub.length, 1, 'le contenu bloqué ne part pas');
    assert.deepEqual(pub[0].args.slice(-2), ['--envoyer', '--pousser']);
    assert.equal(pub[0].ecriture, true);
    assert.ok(vus.filter((v) => v.args[0] === 'verifier').every((v) => !v.ecriture && !v.args.includes('--envoyer')));
    assert.ok(appels().every((a) => !a.argv.includes('--envoyer')), 'aucun processus n\'a reçu --envoyer');
  });

  test('pour de vrai : une erreur d\'envoi arrête la suite, sans relance', async () => {
    const cfg = { ...config, publication: { ...config.publication, simulation: false } };
    let publies = 0;
    const executer = (args, o) => {
      if (args[0] === 'verifier') return lancerZernio(cfg, args, o);
      publies += 1;
      return { code: 34, sortie: 'OK prêt\nERREUR_ZERNIO : 500 /v1/posts :  boom\n-> ne réessaie pas en boucle ; préviens Yoan avec ce message.\n' };
    };
    const r = await recap([{ slug: 'faim-a-16h', quand: `${DEMAIN} 18:30` }, { slug: 'trois-erreurs', quand: `${DEMAIN} 12:15` }], cfg, { executer });
    const c = await confirmer(r.recap_id, cfg, { executer });
    assert.deepEqual(c.resultats.map((x) => x.statut), ['erreur', 'pas_envoye']);
    assert.match(c.resultats[0].message, /je ne sais pas si c'est parti\. Ne relance pas/);
    assert.match(c.resultats[0].detail, /^ERREUR_ZERNIO/);
    assert.equal(publies, 1);
  });

  test('zernio.py tourne dans la copie des scripts du Mac (depot_mac), jamais dans DEPOT', async () => {
    const mac = path.join(racine, 'copie-mac');
    fs.cpSync(depot, mac, { recursive: true });
    try {
      const cfg = { ...config, depot_mac: mac };
      const r = await recap([{ slug: 'faim-a-16h', quand: `${DEMAIN} 18:30` }], cfg);
      assert.equal(r.elements[0].verdict, 'OK', JSON.stringify(r.elements[0].messages));
      const c = await confirmer(r.recap_id, cfg);
      assert.equal(c.resultats[0].statut, 'simulation');
      const a = appels();
      assert.ok(a.length >= 3);
      assert.ok(a.every((x) => x.hoc_depot === mac), JSON.stringify(a.map((x) => x.hoc_depot)));
    } finally {
      fs.rmSync(mac, { recursive: true, force: true });
    }
  });

  test('ce qui a changé depuis le récapitulatif ne part pas (nouvelle vidéo, légende changée)', async () => {
    const r = await recap([{ slug: 'commente', quand: `${DEMAIN} 18:30` }, { slug: 'tiret', quand: `${DEMAIN} 18:30` }], config);
    face('commente', ['c-monte-3.mp4']);
    const c = await confirmer(r.recap_id, config);
    assert.equal(c.resultats[0].statut, 'bloque');
    assert.match(c.resultats[0].message, /plus récente a été montée/);
    assert.equal(c.resultats[1].statut, 'bloque'); // bloqué dès le recap (tiret long)

    const r2 = await recap([{ slug: 'faim-a-16h', quand: `${DEMAIN} 18:30` }], config);
    const f = path.join(depot, 'contenus', 'faim-a-16h', 'script.md');
    const avant = fs.readFileSync(f, 'utf8');
    fs.writeFileSync(f, avant.replace('#nutrition', '#nutrition #faim'));
    try {
      const c2 = await confirmer(r2.recap_id, config);
      assert.equal(c2.resultats[0].statut, 'bloque');
      assert.match(c2.resultats[0].message, /légende a changé/);
    } finally { fs.writeFileSync(f, avant); }
    const r3 = await recap([{ slug: 'trois-erreurs', quand: `${DEMAIN} 12:15` }], config);
    const slide = path.join(racine, 'Pictures', 'Carrousels', 'carrousel-trois-erreurs', 'slide-02.png');
    const plusTard = new Date(Date.now() + 5000);
    fs.utimesSync(slide, plusTard, plusTard);
    const c3 = await confirmer(r3.recap_id, config);
    assert.equal(c3.resultats[0].statut, 'bloque');
    assert.match(c3.resultats[0].message, /images du carrousel ont changé/);
    assert.ok(appels().every((a) => !a.argv.includes('--envoyer')));
  });
});

describe('semaine', () => {
  test('une date par contenu monté non programmé : jour prévu, puis jours par défaut, heures du format', async () => {
    const lundi = '2030-03-04'; // un lundi
    const cartes = [
      { slug: 'faim-a-16h', format: 'reel', stade: 'monte', jour_prevu: '2030-03-08', maj: '1' },
      { slug: 'commente', format: 'reel', stade: 'monte', jour_prevu: null, maj: '2' },
      { slug: 'trois-erreurs', format: 'carrousel', stade: 'mis_en_page', jour_prevu: null, maj: '3' },
      { slug: 'pas-monte', format: 'reel', stade: 'rushs_recus' },
      { slug: 'tiret', format: 'reel', stade: 'programme' },
      { slug: null, proposition_id: 'x', format: 'reel', stade: 'proposee' },
    ];
    const r = await semaine(lundi, config, cartes);
    assert.deepEqual(r.elements.map((e) => [e.slug, e.quand]), [
      ['faim-a-16h', '2030-03-08 18:30'],
      ['commente', '2030-03-05 18:30'],
      ['trois-erreurs', '2030-03-07 12:15'],
    ]);
    assert.ok(r.recap_id);
  });

  test('jours déjà passés sautés ; un mercredi donne la semaine de son lundi', async () => {
    const cartes = [{ slug: 'faim-a-16h', format: 'reel', stade: 'monte' }, { slug: 'commente', format: 'reel', stade: 'monte' }];
    const maintenant = () => dateZurich('2030-03-07 19:00'); // jeudi soir
    const r = await semaine('2030-03-06', config, cartes, { maintenant });
    assert.deepEqual(r.elements.map((e) => e.quand), ['2030-03-10 18:30', '2030-03-08 18:30']);
    await assert.rejects(semaine('2030-03-04', config, [], {}), { code: 'RIEN_A_PUBLIER' });
  });
});

describe('outils', () => {
  test('légende provisoire : BLOQUE avec une phrase pour Romain, rien ne part à la confirmation', async () => {
    const r = await recap([{ slug: 'provisoire', quand: `${DEMAIN} 18:30` }], config);
    const [e] = r.elements;
    assert.equal(e.verdict, 'BLOQUE');
    assert.match(e.messages.join(' '), /pas encore écrite/);
    assert.ok(!e.messages.join(' ').includes('provisoire'), 'jamais le message brut');
    const c = await confirmer(r.recap_id, config);
    assert.notEqual(c.resultats[0].statut, 'simulation');
    assert.ok(!appels().some((a) => a.argv[0] === 'publier'));
  });

  test('lireVerifier : la légende est lue à sa longueur exacte, pas ligne par ligne', () => {
    const leg = 'Ligne 1 😀\nBLOQUE pas un blocage\nMOT FAUX';
    const s = `CONTENU x (reel) sur @fitavecromain\nLEGENDE (contenus/x/script.md, ${Array.from(leg).length} caractères) :\n${leg}\nMEDIA ~/v.mp4 (1,0 Mo)\nMOT aucun (pas de message automatique pour ce contenu)\nATTENTION a\nOK prêt\n`;
    const v = lireVerifier(s);
    assert.equal(v.legende, leg);
    assert.deepEqual(v.bloque, []);
    assert.deepEqual(v.attention, ['a']);
    assert.equal(v.mot, null);
    assert.equal(v.ok, true);
  });

  test('phrase : chaque arrêt connu a sa phrase, un inconnu une phrase générique', () => {
    assert.match(phrase('ARRET', 'CLE_ABSENTE : pas de clé'), /l'accès à ton compte Instagram/);
    assert.match(phrase('ARRET', 'QUAND_PASSE : ...'), /déjà passée/);
    assert.match(phrase('BLOQUE', 'déjà programmé le 2026-11-18 18:30 (zernio_post 1) : --encore pour republier'), /déjà programmé \(le 18 novembre à 18 h 30\)/);
    assert.match(phrase('BLOQUE', 'quelque chose de nouveau'), /préviens Yoan/);
  });

  test('lierSlides : idempotent, corrige un lien faux, ne touche pas un vrai dossier', () => {
    const lien = path.join(media, 'trois-erreurs', 'slides');
    try { fs.unlinkSync(lien); } catch { /* absent */ }
    assert.equal(lierSlides('trois-erreurs', config).lie, true);
    assert.equal(lierSlides('trois-erreurs', config).lie, true);
    fs.unlinkSync(lien);
    fs.symlinkSync(racine, lien);
    assert.equal(lierSlides('trois-erreurs', config).lie, true);
    assert.deepEqual(slidesDe('trois-erreurs', config), ['slide-01.png', 'slide-02.png', 'slide-10.png']);
    fs.mkdirSync(path.join(media, 'occupe', 'slides'), { recursive: true });
    ecrire(path.join(depot, 'rendus', 'registre2.json'), '{}');
    const cfg = { ...config };
    const reg = JSON.parse(fs.readFileSync(path.join(depot, 'rendus', 'registre.json'), 'utf8'));
    reg.carrousels.occupe = { dossier: path.dirname(fs.realpathSync(path.join(lien, 'slide-01.png'))) };
    fs.writeFileSync(path.join(depot, 'rendus', 'registre.json'), JSON.stringify(reg));
    assert.deepEqual(lierSlides('occupe', cfg).raison, 'OCCUPE');
    assert.equal(lierSlides('rien-du-tout', cfg).raison, 'PAS_DE_SLIDES');
    assert.equal(lierSlides('../x', cfg).raison, 'SLUG_INVALIDE');
    // sans entrée au registre : le dossier « carrousels » de la config (bac à sable), sinon ~/Pictures/Carrousels
    assert.equal(dossierSlides('pas-rendu', { ...config, carrousels: path.join(racine, 'slides') }), path.join(racine, 'slides', 'carrousel-pas-rendu'));
    assert.equal(dossierSlides('pas-rendu', config), path.join(os.homedir(), 'Pictures', 'Carrousels', 'carrousel-pas-rendu'));
  });
});
