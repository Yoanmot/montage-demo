#!/usr/bin/env node
// illustration.mjs : la bibliothèque d'illustrations de la DA + génération gpt-image-2.
// Les slides sont composées en HTML (slide.mjs) ; le modèle d'image ne produit QUE les illustrations,
// détourées ensuite en vrai alpha pour se poser sur le fond du template.
//
// AUCUNE valeur de style ici : le brief artistique et la couleur de fond de génération viennent de
// ../da/illustrations.json (cf. theme.mjs et references/contrat-theme.md § illustrations).
// Sans DA extraite, le script refuse proprement.
//
// Usage : node illustration.mjs <job.json>
// job.json : {
//   library: "/chemin/illustrations",     // optionnel : défaut : la bibliothèque (theme.mjs)
//   styleRef: "_style-3d.png",            // optionnel : défaut : illustrations.json > styleRef.
//                                         // Nom simple = fichier de la bibliothèque ; sinon chemin
//                                         // relatif au dossier du job (ou absolu).
//   model: "gpt-image-2",                 // optionnel
//   items: [{ slug: "micro-podcast", prompt: "un micro de podcast sur pied…", size: "1024x1536",
//             reprocess: true }]          // reprocess : repart du PNG déjà en bibliothèque (0 appel API)
// }
// La clé OPENAI_API_KEY est lue dans l'environnement, sinon dans le .env du studio (theme.mjs, lireEnv).
//
// Pipeline par item :
//   1. déjà en bibliothèque et pas de reprocess → skip (0 appel API).
//   2. reprocess → relit le PNG existant (le RGB est intact même si un feather est baké) ;
//      sinon appel du modèle (edits + styleRef), fond uni de la DA demandé.
//   3. l'alpha API est-il exploitable ? (≥ 8 % de pixels transparents) → voie alpha directe.
//   4. sinon : INTÉGRATION « UNMIX » (couture mesurée = 0) :
//      a. recoloration affine pondérée par la luminance → le fond généré devient EXACTEMENT la
//         couleur de fond de la DA (les sources lumineuses ne sont jamais touchées : poids 0
//         au-delà de la luminance du fond + spread) ;
//      b. masque objet sémantique (@imgly/background-removal-node, local, ~1,5 s) dilaté + flouté ;
//      c. matte de différence vs la couleur de fond (capture halo, lueur de contact, ombres douces) ;
//      d. alpha = max(masque, matte) × feather de cadre 60 px, puis un-premultiply contre cette même
//         couleur : composité sur le fond du template, le rendu original est reproduit au pixel près
//         et le fond du template transparaît sous le halo.
//   5. trim au bounding-box de l'objet (+ marge 40 px) → illuHeight (slide.mjs) = hauteur de l'OBJET,
//      plus jamais celle d'un canvas aux 2/3 vide.
//   6. si le détourage sémantique échoue (package absent, erreur modèle) : repli recoloration +
//      feather 180 px, mode 'patch' (couture invisible à distance de lecture, mais fond opaque).

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import sharp from 'sharp';
import {
  bibliotheque, dossierDA, chemin, chargerIllustrations, chargerThemeBrut, lireEnv,
} from './theme.mjs';

const jobPath = process.argv[2];
if (!jobPath) { console.error('Usage: node illustration.mjs <job.json>'); process.exit(1); }
const job = JSON.parse(await readFile(jobPath, 'utf8'));

// ---------- DA, clé API ----------
let racine, DA, TARGET, KEY;
try {
  racine = dossierDA();
  DA = await chargerIllustrations(racine);
  for (const cle of ['style', 'consigneFond']) {
    if (!DA[cle]) throw new Error(`DA incomplète : da/illustrations.json ne fournit pas « ${cle} »\n  → contrat : references/contrat-theme.md § illustrations`);
  }
  // la couleur de fond de génération EST celle du template (l'un-premultiply s'appuie dessus) :
  // par défaut on la lit dans theme.json, illustrations.json peut la surcharger.
  const hex = DA.fond || (await chargerThemeBrut(racine)).fond?.couleur;
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) throw new Error(`couleur de fond de la DA illisible (« ${hex} ») : attendu un hex #RRGGBB dans illustrations.json > fond ou theme.json > fond.couleur`);
  TARGET = { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16) };
  KEY = await lireEnv('OPENAI_API_KEY');
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}

const baseJob = dirname(resolve(jobPath));
const library = job.library ? chemin(job.library, baseJob) : bibliotheque(racine);
await mkdir(library, { recursive: true });

const refBrute = job.styleRef || DA.styleRef;
const styleRef = refBrute
  ? (isAbsolute(refBrute) || refBrute.includes('/') ? chemin(refBrute, baseJob) : join(library, refBrute))
  : null;
if (!(styleRef && existsSync(styleRef)))
  console.warn(`⚠ styleRef absent ou introuvable : génération SANS référence de style (risque de dérive). Recommandé : le meilleur exemplaire de la famille, déclaré dans da/illustrations.json > styleRef.`);

const STYLE = DA.style;              // le brief artistique de la DA, jamais écrit dans le code
const CONSIGNE_FOND = DA.consigneFond;

async function generate(item) {
  if (!KEY) throw new Error('OPENAI_API_KEY introuvable (env ou .env) : requis pour générer.');
  // le modèle ne supporte PAS background:transparent (API 400). On génère sur le fond UNI de la DA,
  // opaque ; l'intégration unmix (ci-dessous) reconstruit ensuite un vrai alpha.
  const prompt = `${item.prompt}\n\n${STYLE}\n\n${CONSIGNE_FOND}`;
  const params = { model: job.model || 'gpt-image-2', prompt, size: item.size || '1024x1536', quality: 'high', n: 1 };
  let res;
  if (styleRef && existsSync(styleRef)) {
    // edits (multipart) avec la référence de style : voie normale
    const form = new FormData();
    for (const [k, v] of Object.entries(params)) form.append(k, String(v));
    form.append('image', new Blob([await readFile(styleRef)], { type: 'image/png' }), 'style.png');
    res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${KEY}` }, body: form });
  } else {
    // generations (JSON) : repli sans référence
    res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  }
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return Buffer.from(data.data[0].b64_json, 'base64');
}

// part de pixels réellement transparents (alpha < 16)
async function transparentRatio(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 16) n++;
  return n / (info.width * info.height);
}

// ---------- intégration unmix (paramètres du POC : ring 20, spread 48, lo 5, hi 40, dilate 6, blur 4, edge 60) ----------

// médiane par canal d'un anneau de bordure
function borderMedian(data, w, h, ring = 20) {
  const ch = [[], [], []];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (x < ring || x >= w - ring || y < ring || y >= h - ring) {
        const i = (y * w + x) * 4;
        ch[0].push(data[i]); ch[1].push(data[i + 1]); ch[2].push(data[i + 2]);
      }
  return ch.map(a => { a.sort((p, q) => p - q); return a[a.length >> 1]; });
}

// recoloration affine pondérée par la luminance, EN PLACE : le fond généré → la couleur de fond
// de la DA au pixel exact, les sources lumineuses de l'objet intactes
function recolorToFond(data, w, h, spread = 48) {
  const m = borderMedian(data, w, h);
  const delta = [TARGET.r - m[0], TARGET.g - m[1], TARGET.b - m[2]];
  const Lm = 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    const L = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    const wgt = Math.max(0, Math.min(1, 1 - (L - Lm) / spread));
    data[i]     = Math.max(0, Math.min(255, Math.round(data[i]     + delta[0] * wgt)));
    data[i + 1] = Math.max(0, Math.min(255, Math.round(data[i + 1] + delta[1] * wgt)));
    data[i + 2] = Math.max(0, Math.min(255, Math.round(data[i + 2] + delta[2] * wgt)));
  }
  return { median: m, delta };
}

// masque objet sémantique : détourage local, dilaté (rayon 6) puis flouté (sigma 4)
async function objectMask(flatPng, w, h, { dilate = 6, blurSigma = 4 } = {}) {
  const { removeBackground } = await import('@imgly/background-removal-node');
  const blob = await removeBackground(new Blob([flatPng], { type: 'image/png' }), { output: { format: 'image/png' } });
  const cut = Buffer.from(await blob.arrayBuffer());
  const dil = await sharp(cut).ensureAlpha().extractChannel(3).raw().toBuffer();
  for (const [dx, dy] of [[1, 0], [0, 1]]) {          // dilatation morphologique séparable
    const src = Buffer.from(dil);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let mx = 0;
      for (let k = -dilate; k <= dilate; k++) {
        const xx = x + dx * k, yy = y + dy * k;
        if (xx >= 0 && xx < w && yy >= 0 && yy < h) mx = Math.max(mx, src[yy * w + xx]);
      }
      dil[y * w + x] = mx;
    }
  }
  // PIÈGE sharp : blur() sur un raw 1 canal ressort en 3 canaux → forcer b-w avant .raw()
  const soft = await sharp(dil, { raw: { width: w, height: h, channels: 1 } }).blur(blurSigma).toColourspace('b-w').raw().toBuffer();
  if (soft.length !== w * h) throw new Error(`masque adouci : ${soft.length} octets, attendu ${w * h}`);
  return soft;
}

// pipeline complet : rendu opaque → RGBA un-premultiplié contre la couleur de fond de la DA
async function integrerSurFond(buf, { lo = 5, hi = 40, edge = 60 } = {}) {
  const flat = await sharp(buf).removeAlpha().png().toBuffer();   // écrase un éventuel feather baké
  const { data, info } = await sharp(flat).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  recolorToFond(data, w, h);
  const soft = await objectMask(flat, w, h);
  const T = [TARGET.r, TARGET.g, TARGET.b];
  const out = Buffer.alloc(w * h * 4);
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    const d = Math.max(Math.abs(data[i] - T[0]), Math.abs(data[i + 1] - T[1]), Math.abs(data[i + 2] - T[2]));
    const aDiff = Math.max(0, Math.min(1, (d - lo) / (hi - lo)));
    // feather de sécurité aux bords du cadre : un halo coupé par le cadre s'éteint en douceur
    const x = p % w, y = (p / w) | 0;
    const ef = Math.max(0, Math.min(x / edge, (w - 1 - x) / edge, y / edge, (h - 1 - y) / edge, 1));
    const a = Math.max(soft[p] / 255, aDiff) * ef;
    if (a <= 0) { out[i] = T[0]; out[i + 1] = T[1]; out[i + 2] = T[2]; out[i + 3] = 0; continue; }
    for (let c = 0; c < 3; c++)
      out[i + c] = Math.max(0, Math.min(255, Math.round((data[i + c] - (1 - a) * T[c]) / a)));
    out[i + 3] = Math.round(a * 255);
  }
  return sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

// repli sans détourage : recoloration + feather large (couture invisible, mais patch opaque :
// le fond du template ne passe donc pas derrière l'objet)
async function recolorFeatherFallback(buf, feather = 180) {
  const { data, info } = await sharp(buf).removeAlpha().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  recolorToFond(data, w, h);
  for (let p = 0, i = 3; p < w * h; p++, i += 4) {
    const x = p % w, y = (p / w) | 0;
    const a = Math.max(0, Math.min(x / feather, (w - 1 - x) / feather, y / feather, (h - 1 - y) / feather, 1));
    data[i] = Math.round(255 * a);
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

// trim au bounding-box de l'objet (alpha > 16) + marge : l'objet remplit son PNG
async function trimToObject(buf, margin = 40, thr = 16) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let p = 0, i = 3; p < w * h; p++, i += 4)
    if (data[i] > thr) {
      const x = p % w, y = (p / w) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  if (x1 < 0) return buf;   // rien à trimmer (image vide ?)
  x0 = Math.max(0, x0 - margin); y0 = Math.max(0, y0 - margin);
  x1 = Math.min(w - 1, x1 + margin); y1 = Math.min(h - 1, y1 + margin);
  return sharp(buf).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }).png().toBuffer();
}

let generated = 0, reused = 0, reprocessed = 0;
for (const item of job.items || []) {
  const out = join(library, `${item.slug}.png`);
  const exists = existsSync(out);
  if (exists && !item.reprocess) { console.log(`● ${item.slug} : déjà en bibliothèque`); reused++; continue; }
  if (!exists && !item.prompt) { console.error(`✗ ${item.slug} : absent de la bibliothèque et sans prompt`); process.exitCode = 1; continue; }
  try {
    let buf, origin;
    if (exists && item.reprocess) { buf = await readFile(out); origin = 'reprocess'; }
    else { buf = await generate(item); origin = 'api'; }
    const ratio = await transparentRatio(buf);
    let mode;
    if (ratio >= 0.08 && origin === 'api') {
      mode = 'alpha';                                   // l'API a rendu un vrai fond transparent
      buf = await trimToObject(buf);
    } else {
      try {
        buf = await integrerSurFond(buf);
        buf = await trimToObject(buf);
        mode = 'unmix';
      } catch (e) {
        console.warn(`  ⚠ ${item.slug} : détourage sémantique indisponible (${e.message.slice(0, 120)}) → repli patch recoloré`);
        buf = await recolorFeatherFallback(buf);
        mode = 'patch';
      }
    }
    await writeFile(out, buf);
    const side = { mode, transparent: +ratio.toFixed(3), prompt: item.prompt };
    if (existsSync(join(library, `${item.slug}.json`)) && !item.prompt) {
      try { side.prompt = JSON.parse(await readFile(join(library, `${item.slug}.json`), 'utf8')).prompt; } catch {}
    }
    await writeFile(join(library, `${item.slug}.json`), JSON.stringify(side, null, 2));
    console.log(`✓ ${item.slug} : ${origin === 'reprocess' ? 'retraité' : 'généré'} (${mode})`);
    origin === 'reprocess' ? reprocessed++ : generated++;
  } catch (e) {
    console.error(`✗ ${item.slug} : ${e.message}`);
    process.exitCode = 1;
  }
}
console.log(`\n${generated} générée(s), ${reprocessed} retraitée(s), ${reused} réutilisée(s) · bibliothèque : ${library}`);
