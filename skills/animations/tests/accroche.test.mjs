// Accroche composée et registre anti-répétition (2026-11-20).
// Lancer : node --test skills/animations/tests/*.test.mjs   (node et python3 avec fontTools ; aucune vidéo, aucun rendu)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { controler, signature, comparer, verifier, noter, lireRegistre, cheminRegistre, dernieres } from '../scripts/lib/accroche.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS = path.resolve(ICI, '..', 'scripts');
const FIXTURE = path.resolve(ICI, '..', '..', 'rendu', 'tests', 'fixture-essai');
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

// Une demande « accroche » minimale, modifiable
function demande({ type = 'mot-derriere', mot = 'RIEN', place = 'derriere', entree = 'apparition', relance = { place: 'bas' }, ...c } = {}) {
  return {
    id: 'a01', geste: 'accroche',
    composition: { type, effet: 'surprise', pourquoi: 'Le mot qui casse l\'idée reçue, derrière lui, comme dans la pièce.', ...c },
    elements: [
      { role: 'phrase', texte: 'tes courbatures', sur: 'tes courbatures' },
      { role: 'mot', texte: mot, sur: 'rien', place, entree },
      ...(relance ? [{ role: 'relance', texte: 'du tout', sur: 'du tout', ...relance }] : []),
    ],
  };
}

test('composition : un seul mot fort, un seul accent orange, vocabulaire connu', () => {
  assert.deepEqual(controler(demande()).refus, []);
  const deuxMots = demande(); deuxMots.elements.push({ role: 'mot', texte: 'X', sur: 'x', place: 'haut' });
  assert.ok(controler(deuxMots).refus.some(([k]) => k === 'MOT_FORT'));
  const deuxOranges = demande({ relance: { place: 'bas', pave: 'orange' } }); deuxOranges.elements[1].souligne = true;
  assert.ok(controler(deuxOranges).refus.some(([k]) => k === 'ACCENT_DOUBLE'));
  assert.ok(controler(demande({ place: 'milieu' })).refus.some(([k]) => k === 'PLACE_INCONNUE'));
  assert.ok(controler(demande({ relance: { place: 'derriere' } })).refus.some(([k]) => k === 'PLACE_INCONNUE'));
  assert.ok(controler(demande({ type: 'gabarit' })).refus.some(([k]) => k === 'TYPE_INCONNU'));
  const sansPourquoi = demande(); sansPourquoi.composition.pourquoi = 'joli';
  assert.ok(controler(sansPourquoi).refus.some(([k]) => k === 'POURQUOI_MANQUANT'));
});

test('registre : chemin par client, dans la mémoire du monteur', () => {
  assert.equal(cheminRegistre({ CLAUDE_CONFIG_DIR: '/x/claude' }), '/x/claude/agent-memory/monteur/registre-accroches.json');
  assert.equal(cheminRegistre({ HOME: '/h' }), '/h/.claude/agent-memory/monteur/registre-accroches.json');
  assert.equal(cheminRegistre({ MONTEUR_REGISTRE: '/y/r.json', CLAUDE_CONFIG_DIR: '/x' }), '/y/r.json');
});

test('registre : jamais la combinaison ni le mot des deux dernières, jamais la place de la dernière', () => {
  const f = path.join(tmp('registre-'), 'registre-accroches.json');
  assert.deepEqual(verifier(demande(), '/v1', f).repetitions, []);   // registre vide : libre
  noter(demande(), '/v1', { titre: 'v1' }, f);
  noter(demande({ type: 'chiffre', mot: '5', place: 'haut', entree: 'saccade' }), '/v2', { titre: 'v2' }, f);
  // même combinaison que l'avant-dernière (v1), place différente de la dernière : refusée
  const r1 = verifier(demande({ mot: 'MOINS' }), '/v3', f);
  assert.ok(r1.repetitions.some((x) => /même combinaison/.test(x)), r1.repetitions.join(' | '));
  // même mot que la dernière
  assert.ok(verifier(demande({ type: 'libre', mot: '5', place: 'bas' }), '/v3', f).repetitions.some((x) => /même mot/.test(x)));
  // même place que la dernière (haut)
  assert.ok(verifier(demande({ type: 'libre', mot: 'APRÈS', place: 'haut', entree: 'pose' }), '/v3', f).repetitions.some((x) => /même place/.test(x)));
  // nouvelle : acceptée
  assert.deepEqual(verifier(demande({ type: 'deux-paves', mot: 'APRÈS', place: 'bas', entree: 'saccade' }), '/v3', f).repetitions, []);
  // la combinaison d'il y a trois vidéos redevient possible
  noter(demande({ type: 'deux-paves', mot: 'APRÈS', place: 'bas', entree: 'saccade' }), '/v3', {}, f);
  assert.deepEqual(dernieres(lireRegistre(f), '/v4').map((a) => a.video), ['/v2', '/v3']);
  assert.deepEqual(verifier(demande({ mot: 'DIX ANS' }), '/v4', f).repetitions, []);
});

test('registre : une vidéo refaite remplace sa ligne et ne se compare pas à elle-même', () => {
  const f = path.join(tmp('registre-'), 'r.json');
  noter(demande(), '/v1', {}, f);
  assert.deepEqual(verifier(demande(), '/v1', f).repetitions, []);
  noter(demande({ mot: 'MOINS' }), '/v1', {}, f);
  const r = lireRegistre(f);
  assert.equal(r.accroches.length, 1);
  assert.equal(r.accroches[0].mot, 'MOINS');
});

test('registre : une demande de Romain passe, notée en avis', () => {
  const f = path.join(tmp('registre-'), 'r.json');
  noter(demande(), '/v1', {}, f);
  const v = verifier(demande({ demande_de_romain: 'remets le mot derrière moi comme la dernière fois' }), '/v2', f);
  assert.deepEqual(v.repetitions, []);
  assert.ok(v.avis.length >= 1 && /demandé par Romain/.test(v.avis[0]));
});

test('signature : type, mot en capitales, place, entrée, relance', () => {
  assert.deepEqual(signature(demande({ mot: 'rien' })), { type: 'mot-derriere', mot: 'RIEN', place: 'derriere', entree: 'apparition', relance: { place: 'bas', entree: 'saccade' }, effet: 'surprise' });
  assert.deepEqual(comparer(signature(demande()), []), []);
});

// ------------------------------------------------------------------ les scripts (registre-accroches.mjs, caler.mjs, accroche.mjs)
function dossierEssai(animations, { ouverture = true } = {}) {
  const w = path.join(tmp('accroche-'), 'essai-montage');
  fs.mkdirSync(w, { recursive: true });
  for (const f of ['words.cut.json', 'edl.json', 'info.json', 'filtre.txt']) fs.copyFileSync(path.join(FIXTURE, f), path.join(w, f));
  fs.writeFileSync(path.join(w, 'plan-montage.json'), JSON.stringify({ plan: 1, video: 'Essai', animations }));
  if (ouverture) fs.writeFileSync(path.join(w, 'ouverture.json'), JSON.stringify({ images: 40, echelle_depart: 1.12, mot: 6, ancre_1080x1920: [540, 700] }));
  return w;
}
const lancer = (script, args, env = {}) => spawnSync('node', [path.join(SCRIPTS, script), ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
const accrocheEssai = (o = {}) => ({
  id: 'a01', geste: 'accroche', intention: 'Accroche de l\'essai : le monteur, puis les trois exercices.', de: 'salut', a: 'trois exercices',
  composition: { type: o.type || 'libre', effet: 'curiosite', pourquoi: 'Le mot « monteur » en grand en haut, la promesse des exercices relance en bas.' },
  elements: [
    { role: 'phrase', texte: 'salut', sur: 'salut', place: 'haut' },
    { role: 'mot', texte: 'monteur', sur: o.mot || 'monteur', place: o.place || 'haut', entree: o.entree || 'apparition' },
    { role: 'relance', texte: '3 exercices', sur: 'trois exercices', place: 'bas' },
  ],
});

test('accroche.mjs : compose, écrit les calques, ses sons, ses mots repris et la ligne du registre', () => {
  const w = dossierEssai([accrocheEssai()]);
  const reg = path.join(path.dirname(w), 'registre.json'), env = { MONTEUR_REGISTRE: reg };
  assert.equal(lancer('caler.mjs', [w]).status, 0);
  const r = lancer('accroche.mjs', [w], env);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const devant = JSON.parse(fs.readFileSync(path.join(w, 'calques', 'a01-devant', 'calque.json'), 'utf8'));
  assert.equal(devant.debut, 0);
  assert.ok(devant.images >= 120, `l'accroche reste jusqu'à 4 s au moins (${devant.images} images)`);
  assert.deepEqual(devant.sons_suggeres.map((s) => s.geste).sort(), ['arrivee', 'pose']);
  assert.deepEqual(devant.mots_repris, [0, 6, 7, 8]);   // « salut », « monteur », « trois exercices » (3 = trois)
  const html = fs.readFileSync(path.join(w, 'calques', 'a01-devant', 'index.html'), 'utf8');
  assert.match(html, /Inter Black/);
  const corps = html.slice(html.indexOf('<body>'));
  assert.equal((corps.match(/background:#F15A24/g) || []).length, 1, 'un seul accent orange (le pavé de la relance)');
  assert.ok(fs.existsSync(path.join(w, 'calques', 'a01-derriere', 'calque.json')), 'le voile passe sous lui');
  assert.equal(JSON.parse(fs.readFileSync(path.join(w, 'accroche.json'), 'utf8')).elements.length, 3);
  assert.equal(lireRegistre(reg).accroches.length, 1);
  // la même accroche sur une autre vidéo : refusée par le registre (code 4)
  const w2 = dossierEssai([accrocheEssai()]);
  assert.equal(lancer('caler.mjs', [w2]).status, 0);
  const r2 = lancer('accroche.mjs', [w2], env);
  assert.equal(r2.status, 4, r2.stdout);
  assert.match(r2.stdout, /RÉPÉTITION/);
  // le script du registre dit la même chose, et lit les deux dernières
  assert.equal(lancer('registre-accroches.mjs', ['verifier', w2], env).status, 4);
  assert.match(lancer('registre-accroches.mjs', ['lire', w2], env).stdout, /DERNIÈRE Essai : libre, mot « MONTEUR » haut/);
  // une autre disposition passe
  fs.writeFileSync(path.join(w2, 'plan-montage.json'), JSON.stringify({ plan: 1, video: 'Essai 2', animations: [accrocheEssai({ place: 'bas', entree: 'saccade', type: 'mot-derriere', mot: 'monteur' })] }));
  const p2 = JSON.parse(fs.readFileSync(path.join(w2, 'plan-montage.json'), 'utf8'));
  p2.animations[0].elements[1].texte = 'essai'; p2.animations[0].elements[1].sur = 'essai';
  p2.animations[0].elements[2].place = 'haut';
  fs.writeFileSync(path.join(w2, 'plan-montage.json'), JSON.stringify(p2));
  assert.equal(lancer('caler.mjs', [w2]).status, 0);
  const r3 = lancer('accroche.mjs', [w2], env);
  assert.equal(r3.status, 0, r3.stdout);
  assert.equal(lireRegistre(reg).accroches.length, 2);
});

test('accroche.mjs : la signature tient (trois temps, ouverture en dézoom)', () => {
  // mot fort trop tard (« douze » vers 5,1 s) : pas de mot fort vers 1,5 s
  const w = dossierEssai([accrocheEssai({ mot: 'douze semaines' })]);
  assert.equal(lancer('caler.mjs', [w]).status, 0);
  const r = lancer('accroche.mjs', [w, '--sans-registre']);
  assert.equal(r.status, 2, r.stdout);
  assert.match(r.stdout, /TROIS_TEMPS/);
  // sans dézoom d'ouverture préparé : refusé
  const w2 = dossierEssai([accrocheEssai()], { ouverture: false });
  assert.equal(lancer('caler.mjs', [w2]).status, 0);
  const r2 = lancer('accroche.mjs', [w2, '--sans-registre']);
  assert.equal(r2.status, 2);
  assert.match(r2.stdout, /SANS_OUVERTURE/);
});

test('caler.mjs : une accroche mal composée revient au plan', () => {
  const d = accrocheEssai(); d.elements[2].pave = 'orange'; d.elements[1].souligne = true;
  const w = dossierEssai([d]);
  const r = lancer('caler.mjs', [w]);
  assert.equal(r.status, 2);
  assert.match(r.stdout, /ACCENT_DOUBLE/);
});
