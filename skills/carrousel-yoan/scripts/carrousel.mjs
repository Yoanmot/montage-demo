#!/usr/bin/env node
// carrousel.mjs : met en page un carrousel de Yoan dans le dossier que lui donne le studio.
//
//   node carrousel.mjs rendre <dossier> [n]   carrousel.json (+ mise-en-page.json) -> slide-01.png... + planche.jpg
//   node carrousel.mjs essai  <dossier>       une slide d'essai (vérification de l'installation)
//
// Le texte vient de <dossier>/carrousel.json, au format du head of content de Yoan (le bloc JSON du
// texte validé, recopié par a-rendre.py prepare) : { "format": "4:5", "slides": [ { "gabarit", "titre",
// "texte", "punch", "etapes": [ { "texte", "icone" } ], "closer", "action" } ] }. Ce fichier est LE texte :
// on ne le réécrit jamais ici (a-rendre.py le compare au texte validé pour reporter une correction).
// La mise en page seule (où couper les lignes d'un titre, une illustration de la bibliothèque) vit dans
// <dossier>/mise-en-page.json : { "slides": { "3": { "titre": "LIGNE UNE\nLIGNE DEUX", "illustration": "slug",
// "illuHeight": 300, "align": "gauche" } } }. Un titre de mise-en-page.json n'est pris que s'il a
// exactement les mêmes mots que le texte (seuls les retours à la ligne diffèrent).
//
// Sans retours à la ligne imposés, les titres sont coupés ici : on mesure chaque mot dans la vraie police
// (navigateur), puis on prend le moins de lignes possible, équilibrées, sans finir une ligne sur un petit
// mot et sans couper un mot mis en valeur. Le rendu lui-même est celui de slide.mjs (moteur de Yoan).
//
// Sortie, une ligne par fait : SLIDE <n> OK | ATTENTION slide <n> : ... | DEBORDE slide <n> : ... |
// IGNORE ... | FINI slides=<ok>/<total> dossier="..." planche="..." ; erreurs : CARROUSEL_ILLISIBLE,
// NAVIGATEUR_INTROUVABLE. Code de sortie : 0 tout rendu, 3 au moins une slide refusée, 2 usage ou texte illisible.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { GABARITS, dossierDA, chargerTheme, limitesDe, fichierPolice, urlFichier } from './theme.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const CHROMES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const dire = (l) => console.log(l);
function stop(code, l) { console.log(l); process.exit(code); }
const lireJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
const kk = (k) => String(k).padStart(2, '0');

// Petits mots qui ne finissent jamais une ligne de titre (« À », « DE », « TON »...).
const PETITS = new Set(('à a au aux de du des d le la les l un une et ou en ton ta tes son sa ses ce cet cette ces ' +
  'ça que qu qui pour sur dans avec par sans mon ma mes notre nos votre vos leur leurs ne n se s y est c j t m').split(' '));

// ---------- carrousel.json (format du head of content) -> spec de slide.mjs ----------

export function versSpec(carrousel, dossier, mep = {}, T = null) {
  if (!carrousel || !Array.isArray(carrousel.slides) || !carrousel.slides.length) {
    throw new Error('pas de slides dans carrousel.json');
  }
  const blocs = (t) => String(t || '').split(/\n\s*\n/).map((x) => x.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  const plat = (t) => String(t || '').replace(/\s+/g, ' ').trim();
  const ignores = [];
  const slides = carrousel.slides.map((s, i) => {
    const k = i + 1;
    const g = s.gabarit || (k === 1 ? 'hook' : 'corps');
    if (!GABARITS.includes(g)) throw new Error(`slide ${k} : gabarit inconnu « ${g} » (attendus : ${GABARITS.join(', ')})`);
    if (!plat(s.titre)) throw new Error(`slide ${k} : pas de titre`);
    const o = { k, type: g, titre: plat(s.titre) };
    const texte = blocs(s.texte);
    if (g === 'corps') {
      const corps = [...texte];
      if (plat(s.punch)) corps.push('!!' + plat(s.punch));
      if (corps.length) o.corps = corps;
    } else if (g === 'steps') {
      const etapes = (s.etapes || []).map((e) => (typeof e === 'string' ? plat(e) : plat(e.texte || e.txt)));
      o.etapes = etapes.filter(Boolean);
      const apres = [...texte];
      if (plat(s.closer)) apres.push(plat(s.closer));
      if (apres.length) o.apres = apres;
    } else {
      // hook, statement, cta : le texte est la sous-ligne (l'accent en serif italique de la DA).
      if (texte.length) o.sous = texte.join(' ');
      if (plat(s.punch)) o.apres = ['!!' + plat(s.punch)];
      if (g === 'cta' && plat(s.action)) {
        const L = T ? limitesDe(T, 'cta') : { punchMots: 8 };
        const mots = plat(s.action).replace(/\*\*|__|==/g, '').split(' ').length;
        o.apres = [...(o.apres || []), (mots <= L.punchMots ? '!!' : '') + plat(s.action)];
      }
    }
    // La mise en page du dossier (jamais du texte).
    const m = (mep.slides || {})[String(k)] || {};
    if (m.titre) {
      if (plat(m.titre).toLocaleLowerCase('fr') === o.titre.toLocaleLowerCase('fr')) o.titre = String(m.titre).split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
      else ignores.push(`IGNORE mise-en-page slide ${k} : son titre n'a plus les mêmes mots que le texte, coupe automatique`);
    }
    if (m.illustration) o.illustration = m.illustration;
    if (m.illuHeight) o.illuHeight = m.illuHeight;
    if (m.align) o.align = m.align;
    if (Array.isArray(m.icones) && o.etapes) {
      o.etapes = o.etapes.map((txt, j) => (m.icones[j] ? { txt, icon: m.icones[j] } : txt));
    }
    return o;
  });
  return { spec: { outdir: dossier, slides }, ignores };
}

// ---------- coupe des titres ----------

export function mots(titre) {
  // Un « mot » ne se coupe jamais à l'intérieur d'un marqueur (**x y**, __x y__, ==x y==).
  const bruts = titre.split(' ');
  const res = [];
  let ouvert = null, cur = [];
  for (const m of bruts) {
    cur.push(m);
    for (const mk of ['**', '__', '==']) {
      const n = m.split(mk).length - 1;
      if (n % 2) ouvert = ouvert === mk ? null : (ouvert || mk);
    }
    if (!ouvert) { res.push(cur.join(' ')); cur = []; }
  }
  if (cur.length) res.push(cur.join(' '));
  return res;
}

export function meilleureCoupe(largeurs, espace, mots_, maxLargeur, maxLignes) {
  const n = largeurs.length;
  const largeur = (a, b) => largeurs.slice(a, b).reduce((x, y) => x + y, 0) + espace * (b - a - 1);
  const nu = (m) => m.replace(/\*\*|__|==/g, '').replace(/[«»"]/g, '').trim().toLowerCase().replace(/[’']$/, '');
  let meilleur = null;
  const essayer = (coupes) => {
    const bornes = [0, ...coupes, n];
    let max = 0, penal = 0;
    for (let i = 0; i < bornes.length - 1; i++) {
      const w = largeur(bornes[i], bornes[i + 1]);
      max = Math.max(max, w);
      const fin = mots_[bornes[i + 1] - 1];
      if (i < bornes.length - 2) {
        const base = nu(fin).replace(/[^\p{L}]+$/u, '');
        if (PETITS.has(base) || /[’']$/.test(fin)) penal += 0.25 * maxLargeur;
        if (/[,.:;?!]$/.test(fin.replace(/\*\*|__|==/g, ''))) penal -= 0.06 * maxLargeur;
      }
    }
    const lignes = bornes.length - 1;
    const tient = max <= maxLargeur;
    // D'abord ce qui tient ; puis le moins de lignes ; puis l'équilibre et les belles fins de ligne.
    const cle = [tient ? 0 : 1, tient ? lignes : 0, max + penal];
    if (!meilleur || cle[0] < meilleur.cle[0] || (cle[0] === meilleur.cle[0] && (cle[1] < meilleur.cle[1]
      || (cle[1] === meilleur.cle[1] && cle[2] < meilleur.cle[2])))) meilleur = { cle, coupes };
  };
  const rec = (debut, reste, coupes) => {
    essayer(coupes);
    if (reste === 0) return;
    for (let c = debut; c < n; c++) rec(c + 1, reste - 1, [...coupes, c]);
  };
  rec(1, Math.min(maxLignes, n) - 1, []);
  return meilleur.coupes;
}

function navigateur() {
  const c = CHROMES.find((p) => existsSync(p));
  if (!c) stop(2, 'NAVIGATEUR_INTROUVABLE : il faut Google Chrome (ou Microsoft Edge) sur ce Mac.');
  return c;
}

function chromeDom(html, largeur, hauteur, profil) {
  const f = join(profil, `mesure-${process.pid}.html`);
  writeFileSync(f, html);
  return execFileSync(navigateur(), ['--headless=new', `--user-data-dir=${join(profil, 'p')}`, '--no-first-run',
    '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars', '--virtual-time-budget=4000',
    `--window-size=${largeur},${hauteur}`, '--dump-dom', urlFichier(f)], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 }).toString();
}

function couperTitres(spec, T, da) {
  const a_couper = spec.slides.filter((s) => !s.titre.includes('\n'));
  if (!a_couper.length) return;
  const polices = (T.typo.polices || []).map((p) => `@font-face{font-family:${p.famille};src:url("${urlFichier(fichierPolice(p.fichier, da))}");` +
    `font-weight:${p.graisse ?? 400};font-style:${p.style ?? 'normal'};font-display:block}`).join('');
  const t = T.typo.titre;
  const esc = (x) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const lignes = a_couper.map((s) => `<div data-k="${s.k}" style="font-size:${t.tailles[s.type]}px">` +
    mots(s.titre).map((m) => `<span class="m">${esc(m.replace(/\*\*|__|==/g, ''))}</span>`).join('') +
    `<span class="m">X X</span><span class="m">XX</span></div>`).join('');
  const html = `<meta charset="utf-8"><style>${polices}
    body{margin:0} div{white-space:nowrap;font-family:${T.typo.familles.titre};font-weight:${t.graisse};
    letter-spacing:${t.interlettre};text-transform:${t.casse ?? 'none'}} .m{display:inline-block;white-space:pre}</style>
    ${lignes}<pre id="r"></pre><script>
    Promise.all([].map.call(document.fonts, function(f){ return f.load().catch(function(){}); })).then(function(){ return document.fonts.ready; }).then(function(){ var r = {};
      [].forEach.call(document.querySelectorAll('div[data-k]'), function(d){
        var w = [].map.call(d.querySelectorAll('.m'), function(e){ return e.getBoundingClientRect().width; });
        var deux = w.pop(), avecEsp = w.pop();
        r[d.dataset.k] = { mots: w, espace: Math.max(0, avecEsp - deux) };
      });
      document.getElementById('r').textContent = JSON.stringify(r); });
    </script>`;
  const profil = mkdtempSync(join(tmpdir(), 'carrousel-yoan-mesure-'));
  let r;
  try {
    const dom = chromeDom(html, T.canvas.largeur, T.canvas.hauteur, profil);
    const m = /<pre id="r">([^<]*)<\/pre>/.exec(dom);
    r = m && m[1] ? JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')) : null;
  } finally { rmSync(profil, { recursive: true, force: true }); }
  if (!r) { dire('ATTENTION mesure des titres impossible : titres sur une ligne, la taille s\'ajustera'); return; }
  const maxLargeur = Math.round(T.canvas.largeur * t.largeurMax);
  for (const s of a_couper) {
    const mesure = r[s.k];
    const ms = mots(s.titre);
    if (!mesure || mesure.mots.length !== ms.length) continue;
    const L = limitesDe(T, s.type);
    const coupes = meilleureCoupe(mesure.mots, mesure.espace, ms, maxLargeur, L.titreLignes);
    const bornes = [0, ...coupes, ms.length];
    s.titre = bornes.slice(0, -1).map((b, i) => ms.slice(b, bornes[i + 1]).join(' ')).join('\n');
  }
}

// ---------- planche de contrôle (outil de relecture, pas la DA) ----------

function planche(dossier, fichiers, T) {
  if (!fichiers.length) return null;
  const W = 360, H = Math.round(W * T.canvas.hauteur / T.canvas.largeur), G = 12;
  const cols = Math.min(4, fichiers.length), rows = Math.ceil(fichiers.length / cols);
  const lw = cols * W + (cols + 1) * G, lh = rows * H + (rows + 1) * G;
  const html = `<meta charset="utf-8"><style>body{margin:0;background:#333;width:${lw}px;height:${lh}px;overflow:hidden}
    .g{display:grid;grid-template-columns:repeat(${cols},${W}px);gap:${G}px;padding:${G}px}
    img{width:${W}px;height:${H}px;display:block}</style><div class="g">${fichiers.map((f) => `<img src="${urlFichier(join(dossier, f))}">`).join('')}</div>`;
  const profil = mkdtempSync(join(tmpdir(), 'carrousel-yoan-planche-'));
  const png = join(profil, 'planche.png');
  try {
    const f = join(profil, 'planche.html');
    writeFileSync(f, html);
    execFileSync(navigateur(), ['--headless=new', `--user-data-dir=${join(profil, 'p')}`, '--no-first-run', '--no-default-browser-check',
      '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${lw},${lh}`,
      `--screenshot=${png}`, urlFichier(f)], { stdio: 'ignore', timeout: 60000 });
    const jpg = join(dossier, 'planche.jpg');
    const tmpJpg = join(dossier, '.planche-en-cours.jpg');
    const r = spawnSync('/usr/bin/sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '85', png, '--out', tmpJpg], { stdio: 'ignore' });
    if (r.status === 0 && existsSync(tmpJpg)) {
      // Écrite à côté puis renommée : jamais lue à moitié écrite.
      execFileSync('/bin/mv', ['-f', tmpJpg, jpg]);
      return jpg;
    }
    return null;
  } catch { return null; } finally { rmSync(profil, { recursive: true, force: true }); }
}

// ---------- commandes ----------

async function rendre(dossier, seule) {
  dossier = resolve(dossier);
  const cj = join(dossier, 'carrousel.json');
  if (!existsSync(cj)) stop(2, `CARROUSEL_ILLISIBLE : pas de carrousel.json dans ${dossier}`);
  let carrousel, mep = {};
  try { carrousel = lireJson(cj); } catch (e) { stop(2, `CARROUSEL_ILLISIBLE : carrousel.json n'est pas du JSON valide (${e.message})`); }
  const fm = join(dossier, 'mise-en-page.json');
  if (existsSync(fm)) { try { mep = lireJson(fm); } catch (e) { dire(`IGNORE mise-en-page.json illisible (${e.message})`); } }
  const da = dossierDA();
  const T = await chargerTheme(da);
  let r;
  try { r = versSpec(carrousel, dossier, mep, T); } catch (e) { stop(2, `CARROUSEL_ILLISIBLE : ${e.message}`); }
  r.ignores.forEach(dire);
  const spec = r.spec;
  const total = spec.slides.length;
  if (seule) {
    spec.slides = spec.slides.filter((s) => s.k === Number(seule));
    if (!spec.slides.length) stop(2, `CARROUSEL_ILLISIBLE : pas de slide ${seule} (il y en a ${total})`);
  }
  navigateur();
  couperTitres(spec, T, da);
  mkdirSync(join(dossier, '_src'), { recursive: true });
  const fs = join(dossier, '_src', 'spec.json');
  writeFileSync(fs, JSON.stringify(spec, null, 2));
  const p = spawnSync(process.execPath, [join(ICI, 'slide.mjs'), fs], { encoding: 'utf8', timeout: 600000 });
  const sortie = `${p.stdout || ''}\n${p.stderr || ''}`;
  let ok = 0;
  for (const l of sortie.split('\n')) {
    let m;
    if ((m = /✓ slide-(\d+)\.png/.exec(l))) { dire(`SLIDE ${Number(m[1])} OK`); ok++; }
    else if ((m = /⚠ slide (\d+) \(([^)]+)\) : (.*)$/.exec(l))) dire(`ATTENTION slide ${m[1]} : ${m[3]}`);
    else if ((m = /✗ slide (\d+) : (.*)$/.exec(l))) dire(`DEBORDE slide ${m[1]} : ${m[2]}`);
    else if (/✗/.test(l)) dire(`ERREUR ${l.replace(/^.*✗\s*/, '')}`);
  }
  // Un carrousel raccourci : les anciennes slides en trop ne doivent pas partir avec lui.
  if (!seule) {
    for (const f of readdirSync(dossier)) {
      const m = /^slide-(\d+)\.png$/.exec(f);
      if (m && Number(m[1]) > total) { unlinkSync(join(dossier, f)); dire(`RETIRE ${f} (le carrousel a ${total} slides)`); }
    }
  }
  const slides = readdirSync(dossier).filter((f) => /^slide-\d+\.png$/.test(f)).sort();
  const pl = planche(dossier, slides, T);
  dire(`FINI slides=${ok}/${spec.slides.length} dossier="${dossier}" planche="${pl || 'non faite'}"`);
  process.exit(ok === spec.slides.length ? 0 : 3);
}

async function essai(dossier) {
  dossier = resolve(dossier);
  mkdirSync(dossier, { recursive: true });
  writeFileSync(join(dossier, 'carrousel.json'), JSON.stringify({ format: '4:5', slides: [
    { gabarit: 'hook', titre: 'Essai de mise en page', texte: 'Si tu lis ça, ton Mac sait faire tes carrousels.' },
  ] }, null, 2) + '\n');
  await rendre(dossier, null);
}

const [cmd, dossier, n] = process.argv.slice(2);
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('carrousel.mjs')) {
  if (cmd === 'rendre' && dossier) await rendre(dossier, n || null);
  else if (cmd === 'essai' && dossier) await essai(dossier);
  else stop(2, 'Usage : node carrousel.mjs rendre <dossier> [n] | essai <dossier>');
}
