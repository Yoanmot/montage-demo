// Gestes composés par script (2026-11-20) : plein écran qui commence sur son visage, la multitude (« partout »),
// l'écran « B-ROLL » d'un plan filmé qui manque.
// Lancer : node --test skills/animations/tests/*.test.mjs   (node et python3 avec fontTools, numpy, Pillow ; aucun rendu)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS = path.resolve(ICI, '..', 'scripts');
const FIXTURE = path.resolve(ICI, '..', '..', 'rendu', 'tests', 'fixture-essai');
// texte de la fixture : « Salut, c'est un essai de ton monteur. Trois exercices simples pour ton dos tous les matins.
// Tiens douze semaines et tu verras la différence »
function dossier(animations) {
  const w = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'composes-')), 'essai-montage');
  fs.mkdirSync(w, { recursive: true });
  for (const f of ['words.cut.json', 'edl.json', 'info.json', 'filtre.txt']) fs.copyFileSync(path.join(FIXTURE, f), path.join(w, f));
  fs.writeFileSync(path.join(w, 'plan-montage.json'), JSON.stringify({ plan: 1, video: 'Essai', animations }));
  return w;
}
const lancer = (script, args) => spawnSync('node', [path.join(SCRIPTS, script), ...args], { encoding: 'utf8' });
const lire = (w, id, f = 'calque.json') => {
  const p = path.join(w, 'calques', id, f);
  return f.endsWith('.json') ? JSON.parse(fs.readFileSync(p, 'utf8')) : fs.readFileSync(p, 'utf8');
};

const pleinVisage = (o = {}) => ({
  id: 'a05', geste: 'plein-ecran-visage', intention: 'Les trois exercices : le titre sur lui, puis le fond, puis les points.', de: 'trois exercices', a: 'matins',
  composition: { fond: o.fond || 'orange' },
  elements: [
    { role: 'titre', texte: '3 exercices', sur: 'trois exercices' },
    { role: 'point', texte: o.point1 || 'ton dos', sur: o.point1 || 'ton dos', figure: 'courbe' },
    { role: 'point', texte: 'tous les matins', sur: 'tous les matins', figure: 'cases' },
  ],
});

test('plein écran qui commence sur son visage : titre au-dessus de sa tête, puis le fond, puis les points sur leurs mots', () => {
  const w = dossier([pleinVisage()]);
  assert.equal(lancer('caler.mjs', [w]).status, 0);
  const r = lancer('plein-ecran-visage.mjs', [w, 'a05', '--tete', '640']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const cal = lire(w, 'a05'), html = lire(w, 'a05', 'index.html');
  assert.equal(cal.masque_sous_titres, true, 'ses mots sont à l\'écran : pas de sous-titres dessous');
  assert.deepEqual(cal.sons_suggeres.map((x) => x.geste), ['transition', 'transition'], 'un clic au flash d\'entrée, un au flash de sortie');
  // le titre arrive d'abord sur l'image filmée (voile), le fond monte ensuite sans bouger le titre
  const tTitre = cal.attendus.find((a) => a.nom === '3 EXERCICES').image, tFond = cal.attendus.find((a) => a.nom === 'fond uni').image;
  assert.ok(tFond - tTitre >= 24, `le titre se lit seul sur lui avant le fond (${tFond - tTitre} images)`);
  assert.match(html, /#fd\{inset:0;background:#F15A24;visibility:hidden;\}/);
  assert.match(html, /id="fl" style="clip-path:polygon\(evenodd,/, 'le flash d\'entrée a un trou autour du titre');
  assert.doesNotMatch(html, /tl\.to\('#t', \{ color/, 'le titre garde sa couleur à travers la transition');
  assert.match(html, /\.lb\{font-size:[\d.]+px;color:#F6F0E7;\}/, 'les points prennent la couleur du titre (craie)');
  assert.match(html, /tl\.set\('#fs', \{ opacity: 1 \}/, 'flash de sortie');
  const top = +html.match(/#t\{left:[\d.]+px;top:([\d.-]+)px/)[1];
  assert.ok(top + 100 < 640, 'le titre est au-dessus de sa tête');
  // chaque point arrive après le fond, dans l'ordre de sa voix
  const pts = cal.attendus.filter((a) => /^(TON DOS|TOUS LES MATINS)$/.test(a.nom));
  assert.equal(pts.length, 2);
  assert.ok(pts[0].image > tFond && pts[1].image > pts[0].image);
  assert.deepEqual(cal.mots_repris.length > 0, true);
  // charbon : texte craie, pas d'orange
  const w2 = dossier([pleinVisage({ fond: 'charbon' })]);
  lancer('caler.mjs', [w2]);
  assert.equal(lancer('plein-ecran-visage.mjs', [w2, 'a05', '--tete', '640']).status, 0);
  assert.equal(lire(w2, 'a05').oranges, undefined);
});

test('plein écran qui commence sur son visage : titre jamais plus large que la zone sûre, fin avant la phrase suivante, barre', () => {
  // tête très haute : le titre est réduit mais tient en largeur ; la barre se remplit sans transform en CSS
  const d = pleinVisage(); d.elements[1].figure = 'barre';
  const w = dossier([d]);
  lancer('caler.mjs', [w]);
  const r = lancer('plein-ecran-visage.mjs', [w, 'a05', '--tete', '300']);
  assert.equal(r.status, 0, r.stdout);
  const html = lire(w, 'a05', 'index.html');
  const F = +html.match(/#t\{left:([\d.-]+)px;top:[\d.-]+px;font-size:([\d.]+)px/)[2];
  const g = JSON.parse(spawnSync('python3', [path.join(SCRIPTS, 'lib', 'mesure.py'), 'geant', '3 EXERCICES'], { encoding: 'utf8' }).stdout);
  assert.ok(F <= g.taille + 0.01, `titre ${F} px, la largeur permet ${g.taille} px au plus`);
  assert.doesNotMatch(html, /scaleX\(0\)/);
  assert.match(html, /tl\.to\('#f0b', \{ width: '100%'/);
  // fin : jamais après l'attaque du mot qui suit le dernier point (« Tiens »)
  const cal = lire(w, 'a05');
  const mots = JSON.parse(fs.readFileSync(path.join(w, 'words.cut.json'), 'utf8')).words;
  assert.ok(cal.debut + cal.images <= Math.round(mots[16].start * 30), `fin à l'image ${cal.debut + cal.images}, « Tiens » à ${Math.round(mots[16].start * 30)}`);
});

test('plein écran qui commence sur son visage : refus quand le titre n\'a pas le temps de se lire sur lui', () => {
  const w = dossier([pleinVisage({ point1: 'simples' })]);
  lancer('caler.mjs', [w]);
  const r = lancer('plein-ecran-visage.mjs', [w, 'a05', '--tete', '640']);
  assert.equal(r.status, 2, r.stdout);
  assert.match(r.stdout, /TROP_TOT/);
});

const pages = (n, chiffre = '') => Array.from({ length: n }, (_, k) => ({ titre: `Article ${'ABCDEFGHIJKL'[k]} : ce que tout le monde répète${chiffre}`, avant: 'Il faut tenir', apres: 'pour voir la différence' }));
test('partout : captures d\'articles, le mot qu\'il a dit dans chaque page, une page toutes les 2 à 4 images, flash d\'entrée', () => {
  const d = { id: 'a06', geste: 'partout', intention: 'Il dit que tout le monde le répète : la multitude.', de: 'et tu verras', a: 'différence',
    elements: [{ texte: '12 semaines', sur: 'et tu verras', chiffre_source: 'il dit « douze semaines » juste avant' }], composition: { pages: pages(6) } };
  const w = dossier([d]);
  assert.equal(lancer('caler.mjs', [w]).status, 0);
  const r = lancer('partout.mjs', [w, 'a06']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const cal = lire(w, 'a06'), html = lire(w, 'a06', 'index.html');
  assert.equal(cal.masque_sous_titres, true);
  assert.equal(cal.origine.natif, true);
  assert.ok(!fs.existsSync(path.join(w, 'calques', 'a06', 'images', 'papier.png')), 'plus de papier froissé : des captures de téléphone');
  // 6 pages, chacune une capture (barre d'état, adresse d'un site, titre) qui porte le mot fixe dans son texte
  assert.equal((html.match(/<div class="pg" id="pg\d+">/g) || []).length, 6);
  assert.match(html, /<div class="pages" data-natif>/);
  assert.equal((html.match(/<span class="k">12 semaines<\/span>/g) || []).length, 6 * 5, 'le mot dans chaque copie de chaque page');
  assert.equal((html.match(/<div class="kx"/g) || []).length, 6, 'une ligne du mot hors fond par page (contrôlée)');
  assert.ok((html.match(/class="bd fd"/g) || []).length === 6 * 4 && /class="chrome fd"/.test(html), 'les fonds de page sont marqués fd');
  assert.match(html, /9:41/);
  assert.match(html, /hebdoforme\.fr/);
  assert.match(html, /Article A : ce que tout le monde répète/);
  assert.match(html, /"debut":"tenir"/, 'les débuts de ligne viennent de « avant »');
  // coupes sèches de 2 à 4 images, de l'image 1 à la fin du calque, sans trou
  const vis = [...html.matchAll(/tl\.set\('#pg\d+', \{ visibility: 'visible' \}, ([\d.]+)\)/g)].map((m) => Math.round(+m[1] * 30));
  const cach = [...html.matchAll(/tl\.set\('#pg\d+', \{ visibility: 'hidden' \}, ([\d.]+)\)/g)].map((m) => Math.round(+m[1] * 30));
  assert.ok(vis.length >= 6, `${vis.length} écrans`);
  assert.equal(vis[0], 1);
  assert.equal(cach.at(-1), cal.images);
  for (let k = 0; k < vis.length; k++) {
    assert.ok(cach[k] - vis[k] >= 2 && cach[k] - vis[k] <= 4, `écran ${k} : ${cach[k] - vis[k]} images`);
    if (k) assert.equal(vis[k], cach[k - 1]);
  }
  // sons : le clic du flash d'entrée, puis un petit clic par changement d'écran
  assert.equal(cal.sons_suggeres[0].geste, 'transition');
  const ecrans = cal.sons_suggeres.filter((s) => s.geste === 'ecran');
  assert.equal(ecrans.length, vis.length - 1);
  assert.equal(ecrans[0].fichier, 'clic-court.wav');
  assert.deepEqual(ecrans.map((s) => s.image), vis.slice(1).map((v) => cal.debut + v));
  // trop peu de pages, un chiffre inventé sur une page, un mot qu'il ne dit pas, une page incomplète : refusés
  for (const [pg, mot, code] of [[pages(3), '12 semaines', 'PAGES'], [pages(6, ' en 30 jours'), '12 semaines', 'CHIFFRE_NON_DIT'],
    [pages(6), 'six mois', 'MOT_NON_DIT'], [pages(6).map((p, k) => (k ? p : { titre: p.titre, avant: p.avant })), '12 semaines', 'PAGES']]) {
    const w2 = dossier([{ ...d, elements: [{ ...d.elements[0], texte: mot }], composition: { pages: pg } }]);
    lancer('caler.mjs', [w2]);
    const r2 = lancer('partout.mjs', [w2, 'a06']);
    assert.equal(r2.status, 2, `${code} : ${r2.stdout}`);
    assert.match(r2.stdout, new RegExp(code));
  }
});

test('plan à filmer : écran « B-ROLL » sur toute la phrase, ses sous-titres restent', () => {
  const d = { id: 'a07', geste: 'plan-a-filmer', intention: 'Il cite ses exercices : le plan où il les fait manque.', de: 'trois exercices', a: 'matins',
    elements: [{ texte: 'toi qui fais les exercices pour le dos, dans ton salon', sur: 'trois exercices' }] };
  const w = dossier([d]);
  assert.equal(lancer('caler.mjs', [w]).status, 0);
  const r = lancer('plan-a-filmer.mjs', [w, 'a07']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const cal = lire(w, 'a07'), html = lire(w, 'a07', 'index.html');
  assert.equal(cal.masque_sous_titres, undefined, 'les sous-titres restent, comme sur un vrai plan filmé');
  assert.equal(cal.oranges, undefined, 'pas d\'orange : le pavé des sous-titres garde le sien');
  assert.match(html, />B-ROLL</);
  assert.match(html, /toi qui fais les exercices/);
  assert.equal(cal.origine.a_filmer, 'toi qui fais les exercices pour le dos, dans ton salon');
  const w2 = dossier([{ ...d, elements: [{ texte: 'un plan', sur: 'trois exercices' }] }]);
  lancer('caler.mjs', [w2]);
  assert.match(lancer('plan-a-filmer.mjs', [w2, 'a07']).stdout, /QUOI_FLOU/);
});

test('texte sur lui : ses mots en capitales au-dessus de sa tête, une opposition se barre, ses sous-titres restent', () => {
  const d = { id: 'a08', geste: 'texte-sur-lui', intention: 'Opposition : simples, puis pour ton dos.', de: 'simples', a: 'ton dos',
    composition: { forme: 'opposition', pourquoi: 'Le premier mot tombe quand le second arrive : le contraste se voit.' },
    elements: [{ texte: 'simples', sur: 'simples', barre: true }, { texte: 'pour ton dos', sur: 'pour ton dos', pave: true }] };
  const w = dossier([d]);
  assert.equal(lancer('caler.mjs', [w]).status, 0);
  const r = lancer('texte-sur-lui.mjs', [w, 'a08', '--tete', '700', '--sans-visage']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const cal = lire(w, 'a08'), html = lire(w, 'a08', 'index.html');
  assert.equal(cal.masque_sous_titres, undefined, 'animation sur la caméra : ses sous-titres restent');
  assert.deepEqual(cal.mots_repris, [9, 10, 11, 12]);
  assert.match(html, />SIMPLES</); assert.match(html, />POUR TON DOS</);
  assert.match(html, /tl\.to\('#b0', \{ clipPath: 'inset\(0 0% 0 0\)'/, 'la ligne barrée se barre quand la suivante arrive');
  assert.doesNotMatch(html.slice(html.indexOf('<body>')), /#F15A24/, 'pas d\'orange : les sous-titres gardent le leur');
  // tête trop haute pour deux lignes au-dessus : refus, avec la place du bas proposée
  const r2 = lancer('texte-sur-lui.mjs', [w, 'a08', '--tete', '380', '--sans-visage']);
  assert.equal(r2.status, 2); assert.match(r2.stdout, /PLACE/);
  // opposition sans ligne barrée : refus
  const w3 = dossier([{ ...d, elements: d.elements.map(({ barre, ...e }) => e) }]);
  lancer('caler.mjs', [w3]);
  assert.match(lancer('texte-sur-lui.mjs', [w3, 'a08', '--tete', '700', '--sans-visage']).stdout, /OPPOSITION/);
});

test('densité : au caler, plus de 15 s sans temps fort ou rien sur la caméra à la fin, refusé (vidéo de 30 s et plus)', () => {
  const w = dossier([{ id: 'a08', geste: 'plan-a-filmer', intention: 'Il cite ses exercices : le plan où il les fait.', de: 'trois exercices', a: 'matins',
    elements: [{ texte: 'toi qui fais les exercices dans ton salon', sur: 'trois exercices' }] }]);
  // la fixture dure 7 s : on l'allonge en décalant ses derniers mots
  const f = path.join(w, 'words.cut.json'), j = JSON.parse(fs.readFileSync(f, 'utf8'));
  j.words.slice(16).forEach((x) => { x.start += 40; x.end += 40; });
  fs.writeFileSync(f, JSON.stringify(j));
  const r = lancer('caler.mjs', [w]);
  assert.equal(r.status, 2, r.stdout);
  assert.match(r.stdout, /DENSITE : de \d+ s à la fin/);
  assert.match(r.stdout, /DENSITE : aucune animation sur la caméra dans le dernier tiers/);
  const p = JSON.parse(fs.readFileSync(path.join(w, 'plan-montage.json'), 'utf8'));
  p.densite_derogation = 'une histoire perso, son visage porte tout';
  fs.writeFileSync(path.join(w, 'plan-montage.json'), JSON.stringify(p));
  assert.equal(lancer('caler.mjs', [w]).status, 0);
});
