// Tests des fonctions pures du rangement : node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { racines, texteDuScript, reconnaitreFace, apparier, validerVue } from '../lib/reconnaitre.mjs';
import { isoZurich, clipId, lireDate, lireConfig } from '../lib/commun.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SCRIPTS, AMBIGU, HORS_SUJET } from './fabrique.mjs';

const scripts = Object.entries(SCRIPTS).map(([slug, texte]) => ({ slug, texte }));

test('racines : accents, mots vides, pluriels et nombres en lettres', () => {
  assert.deepEqual(racines("Les protéines, c'est la base"), ['protei', 'base']);
  assert.deepEqual(racines('seize heures'), racines('16 heures'));
  assert.deepEqual(racines('protéine'), racines('Protéines'));
});

test('texteDuScript : Texte complet et En points, rien d\'autre', () => {
  const md = '# Titre\n\n## Accroches proposées\n1. accroche\n\n## Texte complet\nLe texte dit.\n\n## En points\n- un point\n\n## Légende\nla légende\n';
  const t = texteDuScript(md);
  assert.match(t, /Le texte dit/);
  assert.match(t, /un point/);
  assert.doesNotMatch(t, /accroche|légende/);
});

test('reconnaitreFace : le bon script, ambigu, aucun, sans parole', () => {
  assert.equal(reconnaitreFace(SCRIPTS['faim-a-16h'], scripts).slug, 'faim-a-16h');
  // il improvise à partir du texte : une partie seulement des mots, plus les siens
  const impro = "Alors écoute, si t'as faim à seize heures, franchement c'est pas la volonté. Ton déjeuner manquait de protéines, de fibres, du coup ta glycémie redescend et ton corps te réclame du sucre. Mets de la viande ou des lentilles à midi, garde une pomme et des amandes.";
  assert.equal(reconnaitreFace(impro, scripts).slug, 'faim-a-16h');
  assert.equal(reconnaitreFace(AMBIGU, scripts).decision, 'ambigu');
  assert.equal(reconnaitreFace(HORS_SUJET, scripts).decision, 'aucun');
  assert.equal(reconnaitreFace('', scripts).decision, 'sans_parole');
  assert.equal(reconnaitreFace('ok on y va', scripts).decision, 'sans_parole');
});

test('apparier : ordre, prise refaite, prise sautée', () => {
  const prises = [{ n: 4, duree_s: 20 }, { n: 5, duree_s: 8 }, { n: 6, duree_s: 15 }];
  assert.deepEqual(apparier([{ duree: 19 }, { duree: 9 }, { duree: 14 }], prises), [0, 1, 2]);
  // la prise 5 refaite deux fois
  assert.deepEqual(apparier([{ duree: 21 }, { duree: 8 }, { duree: 8.5 }, { duree: 15 }], prises), [0, 1, 1, 2]);
  // la prise 5 pas filmée
  assert.deepEqual(apparier([{ duree: 20 }, { duree: 15 }], prises), [0, 2]);
  assert.deepEqual(apparier([], prises), []);
  assert.deepEqual(apparier([{ duree: 3 }], []), [null]);
});

test('validerVue : contenu vérifié, pas seulement la forme', () => {
  const ok = validerVue('blabla {"prise": 4, "ce_qu_on_voit": "un bol", "mouvements": ["verse"]} fin', [4, 5]);
  assert.deepEqual(ok, { ok: true, prise: 4, ce_qu_on_voit: 'un bol', mouvements: ['verse'] });
  assert.equal(validerVue('{"prise": 4, "ce_qu_on_voit": "", "mouvements": ["x"]}', [4]).ok, false);
  assert.equal(validerVue('{"prise": 4, "ce_qu_on_voit": "x", "mouvements": [""]}', [4]).ok, false);
  assert.equal(validerVue('{"prise": 9, "ce_qu_on_voit": "x", "mouvements": ["y"]}', [4]).pourquoi, 'prise_inexistante');
  assert.equal(validerVue('pas de json', [4]).ok, false);
  assert.equal(validerVue('{"prise": null, "ce_qu_on_voit": "un mur", "mouvements": []}', [4]).prise, null);
  assert.equal(validerVue('{"prise": 7, "ce_qu_on_voit": "une photo", "mouvements": []}', [7], { exigerMouvements: false }).ok, true);
});

test('dates de Zurich et clip_id', () => {
  assert.equal(isoZurich(new Date('2026-11-16T13:30:12Z')), '2026-11-16T14:30:12+01:00');
  assert.equal(isoZurich(new Date('2026-07-01T10:00:00Z')), '2026-07-01T12:00:00+02:00');
  assert.equal(lireDate('2026-11-16T14:30:12+0100').toISOString(), '2026-11-16T13:30:12.000Z');
  assert.match(clipId(new Date('2026-11-16T13:30:12Z')), /^20261116-143012-[a-z0-9]{4}$/);
});

test('lireConfig : le regard sur les vignettes prend claude.modele_rangement, sonnet par défaut', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'conf-rangement-'));
  try {
    const f = path.join(d, 'studio.config.json');
    fs.writeFileSync(f, JSON.stringify({ depot_hoc: d, claude: { binaire: 'claude', modele: 'opus' } }));
    assert.equal(lireConfig(f).claude.modeleRangement, 'sonnet');
    fs.writeFileSync(f, JSON.stringify({ depot_hoc: d, claude: { modele_rangement: 'haiku' } }));
    assert.equal(lireConfig(f).claude.modeleRangement, 'haiku');
  } finally {
    fs.rmSync(d, { recursive: true, force: true });
  }
});
