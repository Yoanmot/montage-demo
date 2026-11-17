#!/usr/bin/env node
// meme-ligne.mjs : contrôle des captions (Yoan, 2026-11-14). Captions = les textes qui disent sa phrase au fil de sa voix :
// sous-titres, sous-titres enrichis, pleins écrans texte qui suivent sa voix. Règle : sur une même ligne, tous les mots
// ont la même taille et la même police. Deux lignes différentes peuvent avoir des tailles différentes (« 12 premières »
// sur une ligne, « SEMAINES » plus gros sur la suivante : bon ; « sur le » petit et « LONG TERME » gros sur la même
// ligne : refusé).
// Déclaration : l'élément qui contient les captions porte l'attribut data-captions (tout ce qui est dedans est contrôlé,
// sauf l'ombre marquée data-ombre). Les autres textes (hooks, cartes, minuteurs, mots géants...) ne sont pas concernés.
// Mesure dans le Chrome du rendu, image par image : chaque mot visible (opacité >= 50 %) donne sa ligne de base et sa
// hauteur de capitales (taille calculée x capitales de sa police x échelle à l'écran) ; les mots dont les lignes de base
// sont à moins d'un quart de capitale l'un de l'autre sont sur la même ligne visuelle ; une ligne dont les capitales
// diffèrent de plus de 3 % ou qui mêle deux polices est fautive. Un défaut doit se voir sur au moins 3 images (0,1 s)
// pour compter (un mot en train d'apparaître ne fait pas échouer).
//
// Usage :
//   node meme-ligne.mjs <index.html> [<index.html>…]   une ou plusieurs couches (même instant 0)
// Codes : 0 conforme · 2 ligne fautive · 3 usage.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as S from '../bibliotheque/commun.mjs';
import { lirePolice } from './lib/police.mjs';
import { dansLaPage } from './lib/navigateur.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const BIB = path.resolve(ICI, '..', 'bibliotheque');
export const TOLERANCE = 0.03;      // écart de capitales toléré sur une ligne (arrondis)
export const IMAGES_MIN = 3;        // un défaut compte s'il se voit sur au moins 3 images

// métriques (capitales, ascendante) de chaque famille connue
export function metriquesFamilles() {
  const f = {};
  for (const p of Object.values(S.POLICES)) { const m = lirePolice(path.join(BIB, 'fonts', p.file)); f[p.family] = { cap: m.capEm, asc: m.ascEm }; }
  const l = lirePolice(path.join(BIB, 'fonts', 'LiberationSans-Regular.ttf'));
  f['Liberation Sans'] = { cap: l.capEm, asc: l.ascEm };
  return f;
}

// Exécutée dans la page : pour chaque image, les lignes visuelles fautives des captions.
const DANS_LA_PAGE = async function (A) {
  await document.fonts.ready;
  for (let i = 0; i < 100 && !(window.__timelines && window.__timelines.root); i++) await new Promise((r) => setTimeout(r, 50));
  const tl = window.__timelines && window.__timelines.root;
  const root = document.getElementById('root');
  const duree = +(root && root.dataset.duration) || (tl ? tl.duration() : 0);
  const n = Math.max(1, Math.round(duree * A.fps));
  if (tl && tl.invalidate) tl.invalidate();
  const conteneurs = [...document.querySelectorAll('[data-captions]')];
  // les mots : un Range par suite de caractères sans espace, dans les nœuds texte des conteneurs (hors ombre)
  const mots = [];
  for (const c of conteneurs) {
    const w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
      const t = w.currentNode, p = t.parentElement;
      if (!p || p.closest('[data-ombre]') || /^(SCRIPT|STYLE)$/.test(p.tagName)) continue;
      for (const m of t.nodeValue.matchAll(/\S+/g)) { const r = document.createRange(); r.setStart(t, m.index); r.setEnd(t, m.index + m[0].length); mots.push({ r, p, texte: m[0] }); }
    }
  }
  const opacite = (e) => { let o = 1; for (let x = e; x && x !== document.documentElement; x = x.parentElement) o *= +getComputedStyle(x).opacity; return o; };
  const visible = (e) => { for (let x = e; x && x !== document.documentElement; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none') return false; } return getComputedStyle(e).visibility === 'visible'; };
  const inconnues = new Set();
  const images = [];
  for (let k = 0; k < n; k++) {
    if (tl) tl.seek(k / A.fps, false);
    const vus = [];
    for (const m of mots) {
      if (!visible(m.p) || opacite(m.p) < 0.5) continue;
      const rr = m.r.getBoundingClientRect();
      if (!rr.width || !rr.height) continue;
      const cs = getComputedStyle(m.p);
      const fam = cs.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
      const met = A.met[fam];
      if (!met) { inconnues.add(fam); continue; }
      const re = m.p.getBoundingClientRect();
      const echelle = m.p.offsetHeight ? re.height / m.p.offsetHeight : 1;
      const fs = parseFloat(cs.fontSize) * echelle;
      // la boîte d'un Range de texte commence à l'ascendante de la police : ligne de base = haut + asc x taille
      vus.push({ texte: m.texte, fam, cap: +(fs * met.cap).toFixed(2), base: +(rr.top + met.asc * fs).toFixed(1), x: rr.left });
    }
    // lignes visuelles : mots triés par ligne de base, regroupés à moins d'un quart de capitale
    vus.sort((a, b) => a.base - b.base);
    const lignes = [];
    for (const v of vus) {
      const l = lignes[lignes.length - 1];
      if (l && Math.abs(v.base - l.base) <= 0.25 * Math.min(v.cap, l.capMin)) { l.mots.push(v); l.capMin = Math.min(l.capMin, v.cap); }
      else lignes.push({ base: v.base, capMin: v.cap, mots: [v] });
    }
    const fautes = [];
    for (const l of lignes) {
      if (l.mots.length < 2) continue;
      const caps = l.mots.map((v) => v.cap), fams = new Set(l.mots.map((v) => v.fam));
      const ratio = Math.max(...caps) / Math.min(...caps);
      if (ratio > 1 + A.tol || fams.size > 1) {
        const ordre = [...l.mots].sort((a, b) => a.x - b.x);
        fautes.push({ ligne: ordre.map((v) => v.texte).join(' '), ratio: +ratio.toFixed(3), polices: [...fams],
          mots: ordre.map((v) => `${v.texte} ${v.cap} px${fams.size > 1 ? ` ${v.fam}` : ''}`) });
      }
    }
    images.push(fautes);
  }
  return { images, nbMots: mots.length, conteneurs: conteneurs.length, inconnues: [...inconnues] };
};

// Contrôle un effet (une ou plusieurs couches, décalées de `decalages` images).
export async function controler(fichiers, { decalages = null } = {}) {
  const met = metriquesFamilles();
  const res = [];
  for (const f of fichiers) res.push(await dansLaPage(f, DANS_LA_PAGE.toString(), { met, fps: S.VIDEO.fps, tol: TOLERANCE }));
  const decal = decalages || fichiers.map(() => 0);
  const parLigne = new Map();
  res.forEach((r, i) => r.images.forEach((fautes, k) => {
    for (const f of fautes) {
      const cle = f.ligne;
      if (!parLigne.has(cle)) parLigne.set(cle, { ...f, images: [] });
      parLigne.get(cle).images.push(k + decal[i]);
    }
  }));
  const fautives = [...parLigne.values()].filter((f) => f.images.length >= IMAGES_MIN);
  return { declare: res.some((r) => r.conteneurs > 0), mots: res.reduce((a, r) => a + r.nbMots, 0), conforme: fautives.length === 0,
    fautives: fautives.map((f) => ({ ligne: f.ligne, mots: f.mots, ratio: f.ratio, polices: f.polices, premiere_image: f.images[0], nb_images: f.images.length })),
    polices_inconnues: [...new Set(res.flatMap((r) => r.inconnues))] };
}

export function phrase(r) {
  if (!r.declare) return 'aucun texte déclaré captions (data-captions)';
  if (r.conforme) return `${r.mots} mot(s) de captions, chaque ligne d'une seule taille et d'une seule police`;
  return r.fautives.map((f) => `ligne « ${f.ligne} » (image ${f.premiere_image}, ${f.nb_images} images) : ${f.mots.join(', ')}`).join(' ; ');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2);
  if (!a.length || !a.every((f) => fs.existsSync(f))) { console.log('Usage : node meme-ligne.mjs <index.html> [<index.html>…]'); process.exit(3); }
  const r = await controler(a);
  console.log(`${r.conforme ? 'OK' : 'LIGNE'} ${phrase(r)}${r.polices_inconnues.length ? ` (polices non comptées : ${r.polices_inconnues.join(', ')})` : ''}`);
  process.exit(r.conforme ? 0 : 2);
}
