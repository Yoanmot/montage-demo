// Poster aussi sur TikTok (lot 13) : node --test studio/publication/tests/
//
// Même montage que publication.test.mjs : le faux zernio.py charge le vrai (head of content de Romain) en
// coupant le réseau, git et --envoyer ; les deux LECTURES TikTok (compte du profil, infos créateur) viennent
// d'un fichier (FAUX_ZERNIO_TIKTOK). Le chemin « pour de vrai » passe par un exécuteur injecté qui note les appels.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { before, beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { confirmer, enRoute, oublierRecaps, PHRASE_TIKTOK_ABSENT, reessayer, recap } from '../publication.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const REEL = process.env.ZERNIO_REEL
  || path.resolve(ICI, '../../../../../agents/head-of-content/depot/outils/zernio.py');
const DEMAIN = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
const TT = '6af200000000000000000077';
const PROFIL = '6ac75dec9a27558cf4810eff';
const ETAT_TIKTOK = {
  relie: true, compte: TT, nom: 'fitavecromain',
  video: { public: true, peut_poster: true, commentaires: true, duo: true, collage: true },
  photo: { public: true, peut_poster: true, commentaires: true, duo: null, collage: null },
};

let racine, depot, media, log, config;
function ecrire(f, t) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); }
function png(f, w, h) {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8); b.write('IHDR', 12); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20);
  ecrire(f, b);
}
const appels = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const publier = () => appels().filter((a) => a.argv[0] === 'publier');

before(() => {
  racine = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-tiktok-'));
  depot = path.join(racine, 'hoc');
  media = path.join(racine, 'Contenu');
  log = path.join(racine, 'appels.jsonl');
  fs.mkdirSync(path.join(depot, 'outils'), { recursive: true });
  fs.copyFileSync(path.join(ICI, 'faux_zernio.py'), path.join(depot, 'outils', 'zernio.py'));
  const lectures = path.join(racine, 'tiktok.json');
  fs.writeFileSync(lectures, JSON.stringify({
    accounts: [{ _id: TT, platform: 'tiktok', username: 'fitavecromain', profileId: { _id: PROFIL }, isActive: true, enabled: true }],
    creator: { creator: { canPostMore: true }, privacyLevels: [{ value: 'PUBLIC_TO_EVERYONE' }],
      postingLimits: { maxVideoDurationSec: 600, interactionSettings: { allow_comment: { enabled: true }, allow_duet: { enabled: true }, allow_stitch: { enabled: true } } } },
  }));
  process.env.FAUX_ZERNIO_LOG = log;
  process.env.FAUX_ZERNIO_REEL = REEL;
  process.env.FAUX_ZERNIO_TIKTOK = lectures;
  delete process.env.STUDIO_SIMULATION;
  config = { depot_hoc: depot, depot_mac: depot, media, publication: { simulation: true } };

  ecrire(path.join(depot, 'contenus', 'faim', 'etat.json'), JSON.stringify({ version: 1, titre: 'Pourquoi tu as faim', format: 'reel' }));
  ecrire(path.join(depot, 'contenus', 'faim', 'script.md'),
    '# Faim\n\n## Légende\n\nTu as faim à 16 h ? C\'est le déjeuner.\n\n#nutrition\n\n## Légende TikTok\n\nFaim à 16 h ? Regarde ça. #fyp\n');
  ecrire(path.join(media, 'faim', 'face', 'rush-monte.mp4'), 'video');
  ecrire(path.join(depot, 'contenus', 'sans-variante', 'etat.json'), JSON.stringify({ version: 1, titre: 'Sans variante', format: 'reel' }));
  ecrire(path.join(depot, 'contenus', 'sans-variante', 'script.md'), '# S\n\n## Légende\n\nUne légende seule.\n');
  ecrire(path.join(media, 'sans-variante', 'face', 's-monte.mp4'), 'video');
  ecrire(path.join(depot, 'contenus', 'trois-erreurs', 'etat.json'), JSON.stringify({ version: 1, titre: '3 erreurs', format: 'carrousel' }));
  const slides = path.join(racine, 'Carrousels', 'carrousel-trois-erreurs');
  png(path.join(slides, 'slide-01.png'), 1080, 1350);
  png(path.join(slides, 'slide-02.png'), 1080, 1350);
  ecrire(path.join(depot, 'rendus', 'carrousels', 'trois-erreurs.md'), '# 3 erreurs\n\n## Légende\n\nTrois erreurs.\n');
  ecrire(path.join(depot, 'rendus', 'registre.json'), JSON.stringify({ version: 1, carrousels: { 'trois-erreurs': { dossier: slides } } }));
});

beforeEach(() => { oublierRecaps(); if (fs.existsSync(log)) fs.unlinkSync(log); });

const quand = () => `${DEMAIN} 18:30`;

describe('récapitulatif : les deux cases', () => {
  test('TikTok relié : proposé, avec sa légende (la variante), rien de coché par le serveur', async () => {
    const r = await recap([{ slug: 'faim', quand: quand() }], config, { tiktok: ETAT_TIKTOK });
    const e = r.elements[0];
    assert.equal(e.plateformes.instagram.possible, true);
    assert.equal(e.plateformes.tiktok.possible, true);
    // La vidéo de test ne se lit pas : la durée n'est pas vérifiée, c'est dit (à regarder), pas bloquant.
    assert.equal(e.plateformes.tiktok.verdict, 'ATTENTION', JSON.stringify(e.plateformes.tiktok.messages));
    assert.deepEqual(e.plateformes.tiktok.messages, ["Je n'ai pas pu lire la durée de la vidéo : TikTok accepte de 3 secondes à 10 minutes."]);
    assert.equal(e.plateformes.tiktok.legende, 'Faim à 16 h ? Regarde ça. #fyp');
    assert.equal(e.plateformes.tiktok.legende_source, 'variante');
    assert.equal(e.plateformes.tiktok.limite, 2200);
    assert.equal(e.legende, 'Tu as faim à 16 h ? C\'est le déjeuner.\n\n#nutrition', 'la légende Instagram reste la sienne');
    assert.ok(!('coche' in e.plateformes.instagram) && !('coche' in e.plateformes.tiktok), 'aucune case cochée d\'office');
    const v = appels()[0].argv;
    assert.deepEqual(v.slice(v.indexOf('--plateformes'), v.indexOf('--plateformes') + 4), ['--plateformes', 'instagram,tiktok', '--tiktok-compte', TT]);
  });

  test('sans variante : la légende Instagram sert pour TikTok', async () => {
    const r = await recap([{ slug: 'sans-variante', quand: quand() }], config, { tiktok: ETAT_TIKTOK });
    assert.equal(r.elements[0].plateformes.tiktok.legende, 'Une légende seule.');
    assert.equal(r.elements[0].plateformes.tiktok.legende_source, 'instagram');
  });

  test('client sans TikTok : grisé avec la phrase, vérification d\'avant (sans --plateformes)', async () => {
    const r = await recap([{ slug: 'faim', quand: quand() }], config);
    assert.deepEqual(r.elements[0].plateformes.tiktok, { possible: false, raison: PHRASE_TIKTOK_ABSENT });
    assert.equal(PHRASE_TIKTOK_ABSENT, 'Ton TikTok n\'est pas encore relié.');
    assert.ok(!appels()[0].argv.includes('--plateformes'));
    const r2 = await recap([{ slug: 'faim', quand: quand() }], config, { tiktok: { relie: false } });
    assert.equal(r2.elements[0].plateformes.tiktok.possible, false);
  });

  test('carrousel : TikTok proposé (en photos), limite de 4 000, ni duo ni collage', async () => {
    const r = await recap([{ slug: 'trois-erreurs', quand: quand() }], { ...config, carrousels: path.join(racine, 'Carrousels') }, { tiktok: ETAT_TIKTOK });
    const t = r.elements[0].plateformes.tiktok;
    assert.equal(t.possible, true);
    assert.equal(t.limite, 4000);
    assert.deepEqual(t.interactions, { commentaires: true, duo: null, collage: null });
    // Bug du 21/11 : la légende d'un carrousel ne se retouchait pas au récapitulatif (ni Instagram ni TikTok).
    assert.equal(t.legende_modifiable, true);
    assert.equal(r.elements[0].legende_modifiable, true);
  });
});

describe('confirmer : rien ne part sur une plateforme pas cochée', () => {
  test('aucune case : refusé, publier n\'est jamais lancé', async () => {
    const r = await recap([{ slug: 'faim', quand: quand() }], config, { tiktok: ETAT_TIKTOK });
    for (const plateformes of [undefined, {}, { faim: [] }, { faim: ['youtube'] }]) {
      oublierRecaps();
      const r2 = await recap([{ slug: 'faim', quand: quand() }], config, { tiktok: ETAT_TIKTOK });
      const c = await confirmer(r2.recap_id, config, { plateformes });
      assert.equal(c.resultats[0].statut, 'bloque');
      assert.match(c.resultats[0].message, /coche où il part/);
    }
    void r;
    assert.equal(publier().length, 0);
  });

  test('Instagram seul : --plateformes instagram, rien de TikTok', async () => {
    const r = await recap([{ slug: 'faim', quand: quand() }], config, { tiktok: ETAT_TIKTOK });
    const c = await confirmer(r.recap_id, config, { plateformes: { faim: ['instagram'] }, tiktok: { faim: { consentement: true } } });
    assert.equal(c.resultats[0].statut, 'simulation', c.resultats[0].message);
    const a = publier()[0].argv;
    assert.deepEqual(a.slice(a.indexOf('--plateformes'), a.indexOf('--plateformes') + 2), ['--plateformes', 'instagram']);
    assert.ok(!a.some((x) => x.startsWith('--tiktok')), a.join(' '));
    assert.deepEqual(c.resultats[0].envoi.plateformes, ['instagram']);
    assert.match(c.resultats[0].message, /sur Instagram pour/);
  });

  test('TikTok seul, avec l\'accord du clic : la variante part, le corps porte les deux confirmations', async () => {
    const r = await recap([{ slug: 'faim', quand: quand() }], config, { tiktok: ETAT_TIKTOK });
    const c = await confirmer(r.recap_id, config, { plateformes: { faim: ['tiktok'] }, tiktok: { faim: { consentement: true } } });
    assert.equal(c.resultats[0].statut, 'simulation', c.resultats[0].message);
    const a = publier()[0].argv;
    assert.ok(a.includes('--tiktok-consentement'));
    assert.deepEqual(a.slice(a.indexOf('--plateformes'), a.indexOf('--plateformes') + 4), ['--plateformes', 'tiktok', '--tiktok-compte', TT]);
    const envoi = c.resultats[0].envoi;
    assert.deepEqual(envoi.plateformes, ['tiktok']);
    assert.equal(envoi.legende_tiktok, 'Faim à 16 h ? Regarde ça. #fyp');
    assert.equal(envoi.legende, undefined);
    assert.deepEqual(envoi.tiktok, { commentaires: true, duo: true, collage: true, public: true, consentement: true });
    assert.match(c.resultats[0].message, /sur TikTok pour/);
  });

  test('TikTok coché sans l\'accord : refusé, rien ne part', async () => {
    const r = await recap([{ slug: 'faim', quand: quand() }], config, { tiktok: ETAT_TIKTOK });
    const c = await confirmer(r.recap_id, config, { plateformes: { faim: ['tiktok'] } });
    assert.equal(c.resultats[0].statut, 'bloque');
    assert.match(c.resultats[0].message, /TikTok demande ta confirmation/);
    assert.equal(publier().length, 0);
  });

  test('TikTok coché alors qu\'il n\'est pas relié : refusé', async () => {
    const r = await recap([{ slug: 'faim', quand: quand() }], config);
    const c = await confirmer(r.recap_id, config, { plateformes: { faim: ['instagram', 'tiktok'] }, tiktok: { faim: { consentement: true } } });
    assert.equal(c.resultats[0].statut, 'bloque');
    assert.match(c.resultats[0].message, /pas encore relié/);
    assert.equal(publier().length, 0);
  });

  test('les deux, duo fermé, légende TikTok retouchée : ce qui est affiché est ce qui partirait', async () => {
    const r = await recap([{ slug: 'faim', quand: quand() }], config, { tiktok: ETAT_TIKTOK });
    const c = await confirmer(r.recap_id, config, {
      plateformes: { faim: ['tiktok', 'instagram'] }, tiktok: { faim: { consentement: true, duo: false } },
      textes: { faim: { legende_tiktok: 'Ma version TikTok #faim' } },
    });
    assert.equal(c.resultats[0].statut, 'simulation', c.resultats[0].message);
    const a = publier()[0].argv;
    assert.ok(a.includes('--tiktok-sans-duo'));
    assert.ok(a.includes('--legende-tiktok-fichier'));
    const envoi = c.resultats[0].envoi;
    assert.deepEqual(envoi.plateformes, ['instagram', 'tiktok']);
    assert.equal(envoi.legende_tiktok, 'Ma version TikTok #faim');
    assert.equal(envoi.legende, 'Tu as faim à 16 h ? C\'est le déjeuner.\n\n#nutrition');
    assert.equal(envoi.tiktok.duo, false);
    assert.match(c.resultats[0].message, /sur Instagram et TikTok/);
    assert.match(c.resultats[0].message, /légende TikTok retouchée/);
  });

  test('légende TikTok trop longue : refusée avec la raison', async () => {
    const r = await recap([{ slug: 'faim', quand: quand() }], config, { tiktok: ETAT_TIKTOK });
    const c = await confirmer(r.recap_id, config, {
      plateformes: { faim: ['tiktok'] }, tiktok: { faim: { consentement: true } }, textes: { faim: { legende_tiktok: 'x'.repeat(2201) } },
    });
    assert.equal(c.resultats[0].statut, 'bloque');
    assert.match(c.resultats[0].message, /trop longue pour TikTok \(2201 caractères, 2200 au plus\)/);
  });

  test('carrousel en simulation : --carrousel et TikTok en photos', async () => {
    const cfg = { ...config, carrousels: path.join(racine, 'Carrousels') };
    const r = await recap([{ slug: 'trois-erreurs', quand: quand() }], cfg, { tiktok: ETAT_TIKTOK });
    const c = await confirmer(r.recap_id, cfg, { plateformes: { 'trois-erreurs': ['instagram', 'tiktok'] }, tiktok: { 'trois-erreurs': { consentement: true, duo: false } } });
    assert.equal(c.resultats[0].statut, 'simulation', c.resultats[0].message);
    const a = publier()[0].argv;
    assert.ok(a.includes('--carrousel'));
    assert.ok(!a.includes('--tiktok-sans-duo'), 'pas de duo sur un carrousel');
    assert.equal(c.resultats[0].envoi.legende_tiktok, 'Trois erreurs.');
  });
});

describe('carrousel : légendes retouchées au récapitulatif (bug du 21/11)', () => {
  const cfg = () => ({ ...config, carrousels: path.join(racine, 'Carrousels') });
  const textes = { 'trois-erreurs': { legende: 'Trois erreurs, retouchée.\n\n#coach', legende_tiktok: 'Trois erreurs pour TikTok #fyp' } };
  for (const [nom, plats] of [['Instagram seul', ['instagram']], ['TikTok seul', ['tiktok']], ['les deux', ['instagram', 'tiktok']]]) {
    test(`simulation, ${nom} : ce qui partirait est la légende retouchée de chaque plateforme cochée`, async () => {
      const r = await recap([{ slug: 'trois-erreurs', quand: quand() }], cfg(), { tiktok: ETAT_TIKTOK });
      const c = await confirmer(r.recap_id, cfg(), { plateformes: { 'trois-erreurs': plats }, tiktok: { 'trois-erreurs': { consentement: true } }, textes });
      assert.equal(c.resultats[0].statut, 'simulation', c.resultats[0].message);
      const envoi = c.resultats[0].envoi;
      assert.deepEqual(envoi.plateformes, plats);
      assert.equal(envoi.legende, plats.includes('instagram') ? 'Trois erreurs, retouchée.\n\n#coach' : undefined);
      assert.equal(envoi.legende_tiktok, plats.includes('tiktok') ? 'Trois erreurs pour TikTok #fyp' : undefined);
      assert.match(c.resultats[0].message, /retouchée/);
      // Le texte du carrousel dans le dépôt n'est pas touché (ses slides sont déjà mises en page).
      assert.equal(fs.readFileSync(path.join(depot, 'rendus', 'carrousels', 'trois-erreurs.md'), 'utf8'), '# 3 erreurs\n\n## Légende\n\nTrois erreurs.\n');
    });
  }

  test('pour de vrai : la légende retouchée part par fichier avec --envoyer, sans écrire le brief', async () => {
    const vrai = { ...cfg(), publication: { simulation: false } };
    const vus = [];
    let lue = null;
    const executer = async (args, o) => {
      vus.push({ args, o });
      const i = args.indexOf('--legende-fichier');
      const leg = i >= 0 ? fs.readFileSync(args[i + 1], 'utf8').trim() : 'Trois erreurs.';
      if (args[0] === 'verifier') {
        return { code: 0, sortie: `CONTENU trois-erreurs (carrousel) sur @fitavecromain\nPLATEFORMES instagram\nLEGENDE (rendus/carrousels/trois-erreurs.md, ${Array.from(leg).length} caractères) :\n${leg}\nMOT aucun\nOK instagram\nOK prêt\n` };
      }
      if (args[0] === 'publier') lue = leg;
      return { code: 0, sortie: 'PLATEFORME instagram statut=programmé lien=à venir\nPOST 6ab statut=programmé lien=à\nFAIT\n' };
    };
    const r = await recap([{ slug: 'trois-erreurs', quand: quand() }], vrai, { executer });
    assert.equal(r.elements[0].legende_modifiable, true);
    const c = await confirmer(r.recap_id, vrai, { executer, plateformes: { 'trois-erreurs': ['instagram'] }, textes });
    assert.ok(['programmé', 'publié'].includes(c.resultats[0].statut), JSON.stringify(c.resultats[0]));
    assert.ok(!vus.some((v) => v.o?.script === 'brief.py'), 'aucune écriture du brief pour un carrousel');
    const pub = vus.find((v) => v.args[0] === 'publier');
    assert.ok(pub.args.includes('--envoyer'));
    assert.equal(lue, 'Trois erreurs, retouchée.\n\n#coach');
  });
});

describe('pour de vrai (exécuteur injecté) : échec d\'une seule plateforme, puis réessai', () => {
  test('TikTok refusé, Instagram en ligne : statut partiel et « Réessayer sur TikTok »', async () => {
    const vrai = { ...config, publication: { simulation: false } };
    const vus = [];
    const executer = async (args, o) => {
      vus.push({ args, o });
      if (args[0] === 'verifier') {
        return { code: 0, sortie: 'CONTENU faim (reel) sur @fitavecromain\nPLATEFORMES instagram,tiktok\nLEGENDE (contenus/faim/script.md, 47 caractères) :\nTu as faim à 16 h ? C\'est le déjeuner.\n\n#nutrition\nLEGENDE_TIKTOK (variante TikTok de contenus/faim/script.md, 30 caractères) :\nFaim à 16 h ? Regarde ça. #fyp\nMOT aucun\nTIKTOK compte=' + TT + ' nom=fitavecromain public=oui\nOK instagram\nOK tiktok\nOK prêt\n' };
      }
      return { code: 8, sortie: 'PLATEFORME instagram statut=publié lien=https://www.instagram.com/reel/X/\nPLATEFORME tiktok statut=failed lien=à venir erreur=capacity\nPOST 6aa statut=publié lien=https://www.instagram.com/reel/X/\nECHEC_PARTIEL tiktok : capacity\nECHEC_PARTIEL : TikTok a refusé, le reste est parti\n' };
    };
    const r = await recap([{ slug: 'faim', quand: 'maintenant' }], vrai, { tiktok: ETAT_TIKTOK, executer });
    const c = await confirmer(r.recap_id, vrai, { executer, plateformes: { faim: ['instagram', 'tiktok'] }, tiktok: { faim: { consentement: true } } });
    const x = c.resultats[0];
    assert.equal(x.statut, 'partiel', x.message);
    assert.match(x.message, /sur Instagram, mais TikTok l'a refusé/);
    assert.deepEqual(x.reessayer, { slug: 'faim', plateforme: 'tiktok' });
    const pub = vus.find((v) => v.args[0] === 'publier');
    assert.ok(pub.args.includes('--envoyer') && pub.args.includes('--tiktok-consentement'));
    assert.equal(pub.o.ecriture, true);

    const vus2 = [];
    const ok = await reessayer('faim', 'tiktok', vrai, { executer: async (args, o) => { vus2.push({ args, o }); return { code: 0, sortie: 'PLATEFORME tiktok statut=publié lien=https://www.tiktok.com/@f/video/1\nFAIT\n' }; } });
    assert.deepEqual(vus2[0].args, ['reessayer', 'faim', '--plateforme', 'tiktok', '--envoyer', '--pousser']);
    assert.equal(vus2[0].o.ecriture, true);
    assert.equal(ok.statut, 'publié');
    assert.match(ok.message, /en ligne sur TikTok/);
  });

  test('réessayer en simulation : rien ne part, la phrase le dit', async () => {
    const vus = [];
    const r = await reessayer('faim', 'tiktok', config, { executer: async (args, o) => { vus.push({ args, o }); return { code: 0, sortie: 'SIMULATION_OK\n' }; } });
    assert.deepEqual(vus[0].args, ['reessayer', 'faim', '--plateforme', 'tiktok']);
    assert.equal(vus[0].o.ecriture, false);
    assert.equal(r.statut, 'simulation');
    await assert.rejects(() => reessayer('faim', 'youtube', config), /retrouve pas/);
  });
});

test('en route : un TikTok sorti sans son lien est relu, pas un Instagram publié', () => {
  const maintenant = new Date().toISOString();
  ecrire(path.join(depot, 'publications', 'registre.json'), JSON.stringify({ version: 1, publications: {
    a: { statut: 'publié', zernio_post: 'p1', plateformes: { instagram: { statut: 'publié', zernio_post: 'p1', lien: 'x' }, tiktok: { statut: 'publié', zernio_post: 'p1', lien: null, publie_le: maintenant } } },
    b: { statut: 'publié', zernio_post: 'p2', plateformes: { instagram: { statut: 'publié', zernio_post: 'p2', lien: 'x' }, tiktok: { statut: 'failed', zernio_post: 'p2' } } },
    c: { statut: 'envoyé', zernio_post: 'p3', lien: null },
  } }));
  assert.deepEqual(enRoute(config).sort(), ['a', 'c']);
  fs.rmSync(path.join(depot, 'publications'), { recursive: true });
});
