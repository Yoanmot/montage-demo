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
  id: 'a01', geste: 'accroche', intention: 'Accroche de l\'essai : le monteur, puis les trois exercices.', de: "c'est", a: 'trois exercices',
  composition: { type: o.type || 'libre', effet: 'curiosite', pourquoi: 'Le mot « monteur » en grand en haut, la promesse des exercices relance en bas.' },
  elements: [
    { role: 'phrase', texte: "salut c'est un essai", sur: "salut c'est un essai", place: 'haut' },
    { role: 'mot', texte: o.mot || 'de ton monteur', sur: o.mot || 'de ton monteur', place: o.place || 'haut', taille: 'moyen', entree: o.entree || 'apparition' },
    { role: 'relance', texte: '3 exercices', sur: 'trois exercices', place: 'bas' },
  ],
});

test('accroche.mjs : compose, écrit les calques, ses sons, ses mots repris et la ligne du registre', () => {
  const w = dossierEssai([accrocheEssai()]);
  const reg = path.join(path.dirname(w), 'registre.json'), env = { MONTEUR_REGISTRE: reg };
  assert.equal(lancer('caler.mjs', [w]).status, 0);
  const r = lancer('accroche.mjs', [w, '--sans-visage'], env);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const devant = JSON.parse(fs.readFileSync(path.join(w, 'calques', 'a01-devant', 'calque.json'), 'utf8'));
  assert.equal(devant.debut, 0);
  assert.ok(devant.images >= 80 && devant.images <= 86, `l'accroche part quand il dit « simples », le premier mot qu'elle n'affiche pas (${devant.images} images)`);
  assert.deepEqual(devant.sons_suggeres.map((s) => s.geste).sort(), ['arrivee', 'pose']);
  assert.deepEqual(devant.mots_repris, [0, 1, 2, 3, 4, 5, 6, 7, 8]);   // tout ce qu'il dit jusqu'à « trois exercices » (3 = trois), sans trou
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
  const r2 = lancer('accroche.mjs', [w2, '--sans-visage'], env);
  assert.equal(r2.status, 4, r2.stdout);
  assert.match(r2.stdout, /RÉPÉTITION/);
  // le script du registre dit la même chose, et lit les deux dernières
  assert.equal(lancer('registre-accroches.mjs', ['verifier', w2], env).status, 4);
  assert.match(lancer('registre-accroches.mjs', ['lire', w2], env).stdout, /DERNIÈRE Essai : libre, mot « DE TON MONTEUR » haut/);
  // une autre disposition passe
  fs.writeFileSync(path.join(w2, 'plan-montage.json'), JSON.stringify({ plan: 1, video: 'Essai 2', animations: [accrocheEssai({ place: 'bas', entree: 'saccade', type: 'mot-derriere' })] }));
  const p2 = JSON.parse(fs.readFileSync(path.join(w2, 'plan-montage.json'), 'utf8'));
  p2.animations[0].elements[0] = { role: 'phrase', texte: "salut c'est un", sur: "salut c'est un", place: 'haut' };
  p2.animations[0].elements[1].texte = 'essai de ton monteur'; p2.animations[0].elements[1].sur = 'essai de ton monteur';
  p2.animations[0].elements[1].taille = 'moyen';
  p2.animations[0].elements[2].place = 'haut';
  fs.writeFileSync(path.join(w2, 'plan-montage.json'), JSON.stringify(p2));
  assert.equal(lancer('caler.mjs', [w2]).status, 0);
  const r3 = lancer('accroche.mjs', [w2, '--sans-visage'], env);
  assert.equal(r3.status, 0, r3.stdout);
  assert.equal(lireRegistre(reg).accroches.length, 2);
});

test('accroche.mjs : la signature tient (trois temps, ouverture en dézoom)', () => {
  // mot fort trop tard (« douze » vers 5,1 s) : pas de mot fort vers 1,5 s
  const w = dossierEssai([accrocheEssai({ mot: 'douze semaines' })]);
  assert.equal(lancer('caler.mjs', [w]).status, 0);
  const r = lancer('accroche.mjs', [w, '--sans-registre', '--sans-visage']);
  assert.equal(r.status, 2, r.stdout);
  assert.match(r.stdout, /TROIS_TEMPS/);
  // sans dézoom d'ouverture préparé : refusé
  const w2 = dossierEssai([accrocheEssai()], { ouverture: false });
  assert.equal(lancer('caler.mjs', [w2]).status, 0);
  const r2 = lancer('accroche.mjs', [w2, '--sans-registre', '--sans-visage']);
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

test('accroche.mjs : elle se lit comme une phrase, pas comme des mots-clés', () => {
  // « salut / DE TON MONTEUR / 3 EXERCICES » : phrase d'un mot, mots dits sautés entre les éléments
  const d = accrocheEssai(); d.elements[0] = { role: 'phrase', texte: 'salut', sur: 'salut', place: 'haut' };
  const w = dossierEssai([d]);
  assert.equal(lancer('caler.mjs', [w]).status, 0);
  const r = lancer('accroche.mjs', [w, '--sans-registre', '--sans-visage']);
  assert.equal(r.status, 2, r.stdout);
  assert.match(r.stdout, /LECTURE : « salut » n'est pas une phrase/);
  assert.match(r.stdout, /LECTURE : entre « salut » et « de ton monteur », 3 mots/);
  // une accroche qui ne commence pas sur son premier mot laisse un trou : refusée
  const d4 = accrocheEssai(); d4.elements[0] = { role: 'phrase', texte: "c'est un essai", sur: "c'est un essai", place: 'haut' };
  const w4 = dossierEssai([d4]);
  lancer('caler.mjs', [w4]);
  assert.match(lancer('accroche.mjs', [w4, '--sans-registre', '--sans-visage']).stdout, /LECTURE : elle commence sur « c'est un essai »/);
  // un mot affiché qui n'est pas ce qu'il dit
  const d2 = accrocheEssai(); d2.elements[1].texte = 'coach';
  const w2 = dossierEssai([d2]);
  lancer('caler.mjs', [w2]);
  assert.match(lancer('accroche.mjs', [w2, '--sans-registre', '--sans-visage']).stdout, /LECTURE : « coach » n'est pas ce qu'il dit/);
  // un titre reformulé assumé passe, en avis
  d.composition.titre_reformule = 'Romain veut un titre lisible sans le son, écrit avec lui';
  const w3 = dossierEssai([d]);
  lancer('caler.mjs', [w3]);
  const r3 = lancer('accroche.mjs', [w3, '--sans-registre', '--sans-visage']);
  assert.equal(r3.status, 0, r3.stdout);
  assert.match(r3.stdout, /AVIS LECTURE/);
});

test('pendant l\'accroche, son texte remplace les sous-titres ; un seul orange par image sur toute la vidéo', () => {
  const w = dossierEssai([accrocheEssai()]);
  assert.equal(lancer('caler.mjs', [w]).status, 0);
  assert.equal(lancer('accroche.mjs', [w, '--sans-registre', '--sans-visage']).status, 0);
  assert.equal(lancer('calques.mjs', [w]).status, 0);
  const st = spawnSync('node', [path.resolve(SCRIPTS, '..', '..', 'sous-titres', 'scripts', 'sous-titres.mjs'), 'preparer', w], { encoding: 'utf8' });
  assert.equal(st.status, 0, st.stdout + st.stderr);
  const lire = () => JSON.parse(fs.readFileSync(path.join(w, 'calques.json'), 'utf8')).calques;
  const acc = lire().find((c) => c.id === 'a01-devant'), sous = lire().find((c) => c.id === 'st');
  assert.equal(acc.masque_sous_titres, true, 'l\'accroche efface les sous-titres');
  assert.deepEqual(acc.oranges, [[0, acc.images]]);
  for (const [a] of sous.oranges || []) assert.ok(a >= acc.images, `pavé orange des sous-titres à l'image ${a}, pendant l'accroche`);
  // aucun groupe de sous-titres visible pendant l'accroche (ni craie, ni orange)
  const html = fs.readFileSync(path.join(w, 'calques', 'st', 'index.html'), 'utf8');
  const P = JSON.parse(html.match(/const P = (\{.*\});\n/)[1]);
  assert.deepEqual(P.craie.groupes, [], 'plus de pavé craie : plus de sous-titres sous l\'accroche');
  const visibles = P.groupes.filter((g, gi) => !P.caches.includes(gi)).filter((g) => Math.round(g.t0 * 30) < acc.images);
  for (const g of visibles) {
    const coupe = P.coupes.find((c) => P.groupes.indexOf(g) === c.groupe);
    assert.ok(coupe && coupe.image <= 0, `groupe visible pendant l'accroche : ${JSON.stringify(g).slice(0, 120)}`);
  }
  assert.equal(lancer('verifier.mjs', [w, '--mots']).status, 0);
  // des sous-titres préparés avant la règle (pavé orange pendant l'accroche) : refusés
  const j = JSON.parse(fs.readFileSync(path.join(w, 'calques.json'), 'utf8'));
  j.calques.find((c) => c.id === 'st').oranges = [[10, 40]];
  fs.writeFileSync(path.join(w, 'calques.json'), JSON.stringify(j));
  const r = lancer('verifier.mjs', [w, '--mots']);
  assert.equal(r.status, 2);
  assert.match(r.stdout, /ORANGE_DOUBLE (st et a01-devant|a01-devant et st)/);
});

// ------------------------------------------------------------------ substitution : deux exemples au même endroit
const substitutionEssai = (o = {}) => ({
  id: 'a01', geste: 'accroche', intention: 'Accroche de l\'essai : deux exemples parallèles, le second remplace le premier.', de: 'salut', a: 'trois exercices',
  composition: { type: o.type ?? 'substitution', effet: 'surprise', pourquoi: 'Deux exemples qui disent la même chose : le second prend la place du premier, mot pour mot.' },
  elements: [
    { role: 'mot', texte: 'salut', sur: 'salut', place: 'haut', aligne: 'centre', taille: 'moyen' },
    { role: 'relance', texte: "c'est un essai de ton", sur: "c'est un essai de ton", place: 'bas', aligne: 'centre', pave: 'orange' },
    { role: 'mot', texte: 'monteur', sur: 'monteur', remplace: o.remplaceMot ?? 'salut' },
    { role: 'relance', texte: '3 exercices', sur: 'trois exercices', remplace: "c'est un essai de ton" },
  ],
});

test('substitution : contrôle (un seul mot fort, un seul orange par emplacement, remplacement nommé)', () => {
  assert.deepEqual(controler(substitutionEssai()).refus, []);
  assert.equal(signature(substitutionEssai()).mot, 'MONTEUR', 'le mot fort est celui qui reste à l\'écran');
  assert.ok(controler(substitutionEssai({ remplaceMot: 'bonjour' })).refus.some(([k]) => k === 'REMPLACE'));
  assert.ok(controler(substitutionEssai({ type: 'libre' })).refus.some(([k]) => k === 'TYPE_INCONNU'));
  const derriere = substitutionEssai(); derriere.elements[0].place = 'derriere';
  assert.ok(controler(derriere).refus.some(([k]) => k === 'REMPLACE'));
  const croise = substitutionEssai(); croise.elements[3].remplace = 'salut';
  assert.ok(controler(croise).refus.some(([k]) => k === 'REMPLACE'), 'une relance ne remplace pas un mot');
});

test('substitution : le second exemple prend l\'emplacement du premier, remplacement net, sans sous-titres', () => {
  const w = dossierEssai([substitutionEssai()]);
  assert.equal(lancer('caler.mjs', [w]).status, 0);
  const r = lancer('accroche.mjs', [w, '--sans-registre', '--sans-visage']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /remplacement de « SALUT »/);
  const html = fs.readFileSync(path.join(w, 'calques', 'a01-devant', 'index.html'), 'utf8');
  const top = (id) => +html.match(new RegExp(`id="${id}" style="left:[\\d.-]+px;top:([\\d.-]+)px`))[1];
  const left = (id) => +html.match(new RegExp(`id="${id}" style="left:([\\d.-]+)px`))[1];
  assert.equal(top('e2'), top('e0'), 'MONTEUR au même endroit que SALUT');
  assert.equal(top('e3'), top('e1'), '3 EXERCICES dans le même pavé que C\'EST UN ESSAI DE TON');
  assert.notEqual(left('e2'), left('e0'), 'centré : la largeur change, le centre reste');
  // l'ancien part juste avant l'attaque du nouveau, le nouveau monte à sa place
  assert.match(html, /tl\.to\('#e0', \{ opacity: 0, y: -[\d.]+, duration: 0\.1/);
  assert.match(html, /tl\.fromTo\('#e2', \{ opacity: 0, y: [\d.]+ \}, \{ opacity: 1, y: 0, duration: 0\.18/);
  const corps = html.slice(html.indexOf('<body>'));
  assert.equal((corps.match(/background:#F15A24/g) || []).length, 2, 'deux pavés orange, jamais ensemble à l\'écran');
  const fiche = JSON.parse(fs.readFileSync(path.join(w, 'accroche.json'), 'utf8'));
  assert.equal(fiche.elements[2].remplace, 'SALUT');
  assert.equal(fiche.elements[3].place, 'bas');
  const cal = JSON.parse(fs.readFileSync(path.join(w, 'calques', 'a01-devant', 'calque.json'), 'utf8'));
  assert.equal(cal.masque_sous_titres, true);
  assert.deepEqual(cal.sons_suggeres.map((x) => x.geste).sort(), ['arrivee', 'pose', 'pose'], 'tick sur le mot fort, clac sous chaque relance');
  // premier exemple trop court pour se lire : refusé (LECTURE)
  const court = substitutionEssai(); court.elements[1] = { ...court.elements[1], texte: "c'est", sur: "c'est" };
  court.elements[3].remplace = "c'est";
  const w2 = dossierEssai([court]);
  lancer('caler.mjs', [w2]);
  const r2 = lancer('accroche.mjs', [w2, '--sans-registre', '--sans-visage']);
  assert.equal(r2.status, 2, r2.stdout);
  assert.match(r2.stdout, /LECTURE/);
});

test('substitution : un plan filmé qui suit les exemples : l\'accroche lui laisse la place (elle part au premier mot qu\'elle n\'affiche pas)', () => {
  const filmer = { id: 'a02', geste: 'plan-a-filmer', intention: 'Il cite ses exercices : le plan où il les fait.', de: 'simples', a: 'matins',
    elements: [{ texte: 'toi qui fais les exercices dans ton salon', sur: 'simples' }] };
  const w = dossierEssai([substitutionEssai(), filmer]);
  assert.equal(lancer('caler.mjs', [w]).status, 0);
  const r = lancer('accroche.mjs', [w, '--sans-registre', '--sans-visage']);
  assert.equal(r.status, 0, r.stdout);
  const cal = JSON.parse(fs.readFileSync(path.join(w, 'calques', 'a01-devant', 'calque.json'), 'utf8'));
  assert.ok(cal.images >= 84 && cal.images <= 88, `fin vers 2,9 s (${cal.images} images), pas à 4 s`);
});


test('écart de taille : deux voisins d\'un même bloc, 1,6 fois au plus ; tout en capitales', () => {
  const d = accrocheEssai(); d.elements[1].taille = 'grand'; d.elements[0].taille = 'normale'; d.elements[0].texte = d.elements[0].sur = 'salut'; d.elements[1].texte = d.elements[1].sur = "c'est un essai de ton monteur"; d.elements[1].taille = 'grand'; d.composition.titre_reformule = 'essai du contrôle de taille, la phrase de tête courte';
  const w = dossierEssai([d]);
  lancer('caler.mjs', [w]);
  const r = lancer('accroche.mjs', [w, '--sans-registre', '--sans-visage']);
  assert.equal(r.status, 2, r.stdout);
  assert.match(r.stdout, /TAILLE : « SALUT » et « C'EST UN ESSAI DE TON MONTEUR »/);
  const w2 = dossierEssai([accrocheEssai()]);
  lancer('caler.mjs', [w2]);
  assert.equal(lancer('accroche.mjs', [w2, '--sans-registre', '--sans-visage']).status, 0);
  const html = fs.readFileSync(path.join(w2, 'calques', 'a01-devant', 'index.html'), 'utf8');
  assert.match(html, />SALUT C'EST UN ESSAI</, 'la phrase est en capitales, comme le mot fort');
  assert.doesNotMatch(html, /class="a tx /);
});
