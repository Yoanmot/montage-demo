// Lecture du style : la SEULE source des valeurs (couleurs, polices, tailles, durées, courbes) est style/style.json.
// Copie du moteur de Yoan dans le skill animations-yoan : le style est toujours ../../style/style.json (pas de
// MONTEUR_STYLE ici : dans le studio, cette variable nomme le style de la bibliothèque de Romain). Les chemins de
// fichiers du style (polices, grain, sons) sont relatifs au dossier qui contient style.json. Satoshi (licence Fontshare)
// n'est pas dans le dépôt : elle est prise dans le style yoan de la bibliothèque (posée à l'installation).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const STYLE_JSON = path.resolve(path.join(HERE, '..', '..', 'style', 'style.json'));
export const STYLE_DIR = path.dirname(STYLE_JSON);
export const STYLE = JSON.parse(fs.readFileSync(STYLE_JSON, 'utf8'));
// Satoshi : la copie du style si elle y est, sinon celle posée à l'installation dans la bibliothèque (styles/yoan/fonts).
const SATOSHI_BIB = path.resolve(HERE, '..', '..', '..', '..', 'animations', 'bibliotheque', 'styles', 'yoan', 'fonts', 'Satoshi-Black.ttf');
export const fichierStyle = (rel) => {
  const p = path.join(STYLE_DIR, rel);
  if (!fs.existsSync(p) && /Satoshi-Black\.(woff2|ttf)$/.test(rel) && fs.existsSync(SATOSHI_BIB)) return SATOSHI_BIB;
  return p;
};
// GSAP : copie locale (calque autonome, lisible hors ligne par l'aperçu du studio), même version que la bibliothèque.
export const GSAP = path.resolve(HERE, '..', '..', '..', '..', 'animations', 'bibliotheque', 'vendor', 'gsap.min.js');

export const F = STYLE.format;
export const C = STYLE.couleurs;
export const f3 = (x) => (+x).toFixed(3);
export const rgbs = (h) => { const n = parseInt(h.slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; };
export const RGB_D = rgbs(C.dore);
// halo du doré (text-shadow à trois couches, en em)
export const halo = (rgb = RGB_D) => STYLE.halo.couches.map(([r, a]) => `0 0 ${r}em rgba(${rgb},${a})`).join(',');
// halo des traits dorés (filtre CSS)
export const haloTrait = STYLE.halo.trait.map(([r, a]) => `drop-shadow(0 0 ${r}px rgba(${RGB_D},${a}))`).join(' ');

// Polices : clé de STYLE.polices -> { file (nom dans le dossier hf), family, poids, src (chemin réel) }
export const POLICES = Object.fromEntries(Object.entries(STYLE.polices).map(([k, p]) =>
  [k, { file: path.basename(fichierStyle(p.fichier)), family: p.famille, ...(p.poids ? { poids: p.poids } : {}), src: fichierStyle(p.fichier) }]));
export const GRAIN = fichierStyle(STYLE.fond.grain.fichier);

const fontFace = (p) => `@font-face{font-family:'${p.family}';src:url('${p.file}');font-weight:${p.poids || '100 900'};font-style:normal;}`;
// Page HyperFrames : parts = [{ css, html, js }], polices = clés de STYLE.polices. fondPage : fond du body (transparent
// pour un calque posé sur la caméra).
export function page(dur, parts, polices = ['satoshi', 'inter', 'jetbrains'], fondPage = 'transparent') {
  const css = parts.map((x) => x.css).join('\n'), html = parts.map((x) => x.html).join(''), js = parts.map((x) => x.js).join('');
  return `<!doctype html>
<html><head><meta charset="utf-8">
<style>
${polices.map((k) => fontFace(POLICES[k])).join('\n')}
html,body{margin:0;background:${fondPage};}
#root{position:relative;width:${F.largeur}px;height:${F.hauteur}px;overflow:hidden;background:transparent;}
${css}
</style></head>
<body>
<div id="root" data-composition-id="root" data-width="${F.largeur}" data-height="${F.hauteur}" data-start="0" data-duration="${dur}">
${html}</div>
<svg width="0" height="0" style="position:absolute"><defs id="defs"></defs></svg>
<script src="gsap.min.js"></script>
<script>
const tl = gsap.timeline({ paused: true });
${js}
tl.set({}, {}, ${dur});
window.__timelines = window.__timelines || {};
window.__timelines['root'] = tl;
</script>
</body></html>
`;
}

// Écrit un calque prêt à rendre : dir/index.html + les polices demandées + le grain.
export function ecrireCalque(dir, html, polices = ['satoshi'], grain = true) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  for (const k of polices) fs.copyFileSync(POLICES[k].src, path.join(dir, POLICES[k].file));
  if (grain) fs.copyFileSync(GRAIN, path.join(dir, 'grain.png'));
  fs.copyFileSync(GSAP, path.join(dir, 'gsap.min.js'));
  return dir;
}
