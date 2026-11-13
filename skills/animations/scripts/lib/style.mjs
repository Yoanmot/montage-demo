// style.mjs : la boîte à outils commune des calques d'animation de Romain.
// - Toutes les valeurs de style viennent de ../../bibliotheque/commun.mjs (importé ici, réexporté en S).
// - Calage sur la voix : ancres (« w12 » ou citation « douze semaines », « douze semaines#2 ») résolues dans words.cut.json.
// - Couche : écrit un calque HyperFrames (index.html) avec le socle du style, l'apparition v2, les bascules à l'image.
// - ecrireCalque : stage polices, GSAP et images dans le dossier du calque (chemins relatifs, rien en absolu) et écrit
//   calque.json (l'entrée de calques.json + ce que la vérification attend + les sons suggérés).
// Méthode reprise du build du Style Lab (renders/r21/_build/build21.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as S from '../../bibliotheque/commun.mjs';

export { S };
export const ICI = path.dirname(fileURLToPath(import.meta.url));
export const SKILL = path.resolve(ICI, '..', '..');
export const BIB = path.join(SKILL, 'bibliotheque');
export const GESTES = JSON.parse(fs.readFileSync(path.join(ICI, 'gestes.json'), 'utf8'));
export const { COULEURS: K, POLICES: P, OMBRES, VIDEO } = S;
export const FPS = VIDEO.fps, W = VIDEO.w, H = VIDEO.h;
export const AV = S.APPARITION.avance;

export const f4 = (x) => Math.max(0, x).toFixed(4);
export const img = (t) => Math.max(0, Math.round(t * FPS));
export const tImg = (n) => Math.max(0, n / FPS - 0.0005);   // un set posé 0,5 ms avant tombe pile sur l'image n
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

// ------------------------------------------------------------------ mesures de texte (fontTools, scripts/lib/mesure.py)
export function mesure(...args) {
  const out = execFileSync('python3', [path.join(ICI, 'mesure.py'), ...args.map(String)], { encoding: 'utf8' });
  return JSON.parse(out);
}
// hauteur des capitales en px pour une taille de police (h de l'apparition)
const _cap = {};
export function cap(cle, taille) { _cap[cle] ??= mesure('metriques', cle).cap; return _cap[cle] * taille; }

// ------------------------------------------------------------------ mots et ancres
export function chargerMots(dossierMontage) {
  const f = path.join(dossierMontage, 'words.cut.json');
  if (!fs.existsSync(f)) throw new Error(`words.cut.json absent de ${dossierMontage} : couper-silences doit passer avant`);
  return JSON.parse(fs.readFileSync(f, 'utf8')).words;
}
export const normaliser = (w) => String(w).toLowerCase().normalize('NFC').replace(/[’`]/g, "'")
  .replace(/[«»"“”.,;:!?…()]/g, '').trim();

// Ancre : « w12 » (numéro de mot de words.cut.json) ou citation de la voix, « #n » pour la n-ième occurrence.
// Renvoie { premier, dernier, texte, debut_s, fin_s, image, fin_image } ou lève une erreur nommée.
export function resoudre(ancre, mots) {
  if (ancre === undefined || ancre === null || ancre === '') throw new Error('ANCRE_VIDE');
  const s = String(ancre).trim();
  let i0, i1;
  const m = s.match(/^w(\d+)(?:-w?(\d+))?$/i);
  if (m) {
    i0 = +m[1]; i1 = m[2] !== undefined ? +m[2] : i0;
    if (!mots[i0] || !mots[i1] || i1 < i0) throw new Error(`ANCRE_HORS_TEXTE ${s} (${mots.length} mots)`);
  } else {
    const [cit, occ] = s.split('#');
    const cherche = cit.split(/\s+/).map(normaliser).filter(Boolean);
    if (!cherche.length) throw new Error(`ANCRE_VIDE ${s}`);
    const idx = mots.map((w, i) => [normaliser(w.text), i]).filter(([t]) => t);
    const trouves = [];
    for (let k = 0; k + cherche.length <= idx.length; k++) {
      if (cherche.every((c, j) => idx[k + j][0] === c)) trouves.push([idx[k][1], idx[k + cherche.length - 1][1]]);
    }
    if (!trouves.length) throw new Error(`ANCRE_INTROUVABLE « ${cit} » : Romain ne dit pas ces mots dans la vidéo coupée`);
    if (occ === undefined && trouves.length > 1) throw new Error(`ANCRE_AMBIGUE « ${cit} » : ${trouves.length} occurrences (w${trouves.map((t) => t[0]).join(', w')}) ; écrire « ${cit}#n » ou un numéro de mot`);
    const n = occ === undefined ? 1 : +occ;
    if (!trouves[n - 1]) throw new Error(`ANCRE_INTROUVABLE « ${cit}#${n} » : seulement ${trouves.length} occurrence(s)`);
    [i0, i1] = trouves[n - 1];
  }
  const a = mots[i0], b = mots[i1];
  return { premier: i0, dernier: i1, texte: mots.slice(i0, i1 + 1).map((w) => w.text).join(' '),
    debut_s: a.start, fin_s: b.end, image: img(a.start), fin_image: img(b.end) };
}

// Texte d'une ancre tel que les sous-titres l'écrivent : corrections et mots masqués de sous-titres.json s'il existe
// (brique sous-titres), sinon words.cut.json ; ponctuation autour des mots retirée comme dans les sous-titres.
// casse : 'basse' (comme les sous-titres, par défaut), 'haute' ou 'telle'.
export function texteSousTitres(dossierMontage, ancre, mots, casse = 'basse') {
  const r = resoudre(ancre, mots);
  const f = path.join(dossierMontage, 'sous-titres.json');
  const R = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
  const corr = R.corrections || {}, masque = new Set();
  for (const x of R.masquer || []) { const [a, b] = [[].concat(x)[0], [].concat(x).at(-1)]; for (let k = +a; k <= +b; k++) masque.add(k); }
  const out = [];
  for (let i = r.premier; i <= r.dernier; i++) {
    if (masque.has(i)) continue;
    const t = String(corr[i] ?? mots[i].text).trim().replace(/^[«"“(\s]+/, '').replace(/[.,;:!?…»"”)\s]+$/, '');
    if (t) out.push(t);
  }
  const t = out.join(' ');
  return casse === 'haute' ? t.toUpperCase() : casse === 'telle' ? t : t.toLowerCase();
}

// Coupes de la vidéo coupée (edl.json de couper-silences) : image où commence chaque morceau gardé, sauf le premier.
export function coupes(dossierMontage) {
  const f = path.join(dossierMontage, 'edl.json');
  if (!fs.existsSync(f)) return [];
  return JSON.parse(fs.readFileSync(f, 'utf8')).segments.map((s) => s.outInF).filter((n) => n > 0);
}
// La coupe juste avant un mot : dans le blanc entre le mot d'avant et lui (au plus 0,6 s avant son attaque), là où se
// pose une transition. null s'il n'y en a pas (une transition ne se pose jamais au milieu d'une phrase dite d'un trait).
export function coupeAvant(dossierMontage, a, mots) {
  const avant = mots && a.premier > 0 ? img(mots[a.premier - 1].end) - 1 : -Infinity;
  const c = coupes(dossierMontage).filter((n) => n <= a.image + 1 && n >= a.image - 18 && n >= avant);
  return c.length ? c[c.length - 1] : null;
}

// ------------------------------------------------------------------ socle CSS (chemins relatifs au dossier du calque)
export const CSS_SOCLE = `
@font-face{font-family:'${P.titre.family}';src:url('fonts/${P.titre.file}');font-weight:100 900;font-style:normal;}
@font-face{font-family:'${P.texte.family}';src:url('fonts/${P.texte.file}');font-weight:200 800;font-style:normal;}
@font-face{font-family:'${P.natif.family}';src:url('fonts/${P.natif.file}');font-weight:100 900;font-style:normal;}
html,body{margin:0;background:transparent;}
#root{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:transparent;}
.a{position:absolute;white-space:nowrap;}
.ti{font-family:'${P.titre.family}';font-weight:${P.titre.poids};text-transform:uppercase;line-height:${P.titre.interligne};
  letter-spacing:0;margin:0;font-variant-numeric:${P.titre.chiffres};}
.tx{font-family:'${P.texte.family}';font-weight:${P.texte.poids};line-height:${P.texte.interligne};letter-spacing:${P.texte.approche};
  font-variation-settings:${P.texte.variation};}
.c-or{color:${K.orange};}.c-cr{color:${K.craie};}.c-ch{color:${K.charbon};}
.douce{text-shadow:${OMBRES.texteDouce};}.dure{text-shadow:${OMBRES.texteDure};}
.pav{display:inline-block;background:${K.orange};color:${K.charbon};border-radius:${S.RAYONS.pave}px;
  padding:${S.HOOKS.paves.padY[0]}px ${S.HOOKS.paves.padX}px ${S.HOOKS.paves.padY[1]}px;box-shadow:0 ${S.MARCHE.pave.hauteur}px 0 ${S.MARCHE.pave.couleur};}
`;
// Carte charbon + onglet orange (CARTE, ONGLET), mêmes classes que les gabarits de cartes : .card(.tabbed), .tab(.n)
export const CSS_CARTE = `
.card{position:absolute;background:${S.CARTE.fond};color:${S.CARTE.texte};border-radius:${S.CARTE.rayon}px;box-shadow:${S.CARTE.ombre};font-family:'${P.texte.family}';box-sizing:border-box;}
.card.tabbed{border-top-left-radius:0;}
.tab{position:absolute;left:0;bottom:100%;height:${S.ONGLET.hauteur}px;padding:0 ${S.ONGLET.padX}px;background:${S.ONGLET.fond};color:${S.ONGLET.texte};
  font:${P.titre.poidsOnglet} ${S.ONGLET.taille}px/${S.ONGLET.interligne}px '${P.titre.family}';text-transform:uppercase;letter-spacing:${S.ONGLET.approche};
  border-radius:${S.ONGLET.rayon}px ${S.ONGLET.rayon}px 0 0;white-space:nowrap;}
.tab .n{opacity:${S.ONGLET.secondaireOpacite};margin-left:14px;}
`;
// voile sombre du haut du cadre (VOILE.standard, cuisine, demo)
export function voileCss(nom = 'standard') {
  const [r, g, b] = S.VOILE.teinte;
  return `background:linear-gradient(to bottom,${S.VOILE[nom].map(([y, a]) => `rgba(${r},${g},${b},${a}) ${y}px`).join(',')});`;
}

// ------------------------------------------------------------------ calque
export class Couche {
  constructor(images) { this.images = images; this.duree = images / FPS; this.css = ''; this.html = ''; this.js = ''; this.attendus = []; }
  // apparition v2 (commun.mjs) ; t en s depuis le début du calque ; h = hauteur des capitales ou de l'élément (px)
  app(sel, t, h, nom) {
    this.js += S.apparitionJs(sel, t, h);
    this.attendus.push({ nom: nom || sel, image: img(t + AV), mi: S.apparitionMiOpacite(t, h) });
    return S.apparitionMiOpacite(t, h);
  }
  // Visible à partir de l'image n, caché avant. À l'image 0, rien à cacher : deux « set » au même instant 0 laissaient
  // l'élément caché sur la première image du calque (test v3, 2026-11-11).
  montre(sel, n, nom) {
    this.js += tImg(n) > 0 ? `tl.set('${sel}', { visibility: 'hidden' }, 0);\ntl.set('${sel}', { visibility: 'visible' }, ${f4(tImg(n))});\n`
      : `tl.set('${sel}', { visibility: 'visible' }, 0);\n`;
    if (nom !== false) this.attendus.push({ nom: nom || sel, image: n });
  }
  cache(sel, n) { this.js += `tl.set('${sel}', { visibility: 'hidden' }, ${f4(tImg(n))});\n`; }
  page() {
    return `<!doctype html>
<html><head><meta charset="utf-8">
<style>${CSS_SOCLE}${this.css}</style></head>
<body>
<div id="root" data-composition-id="root" data-width="${W}" data-height="${H}" data-start="0" data-duration="${this.duree}">
${this.html}</div>
<script src="vendor/gsap.min.js"></script>
<script>
const tl = gsap.timeline({ paused: true });
${this.js}tl.set({}, {}, ${this.duree});
window.__timelines = window.__timelines || {};
window.__timelines['root'] = tl;
</script>
</body></html>
`;
  }
}

// ------------------------------------------------------------------ sons suggérés (format de sons.json du CONTRAT)
// Niveaux : STYLE.md « Sons et niveaux » (SONS de commun.mjs).
const SON = {
  faisceau: () => ({ fichier: S.SONS.faisceau.fichier, niveau: { lu_sous_voix: S.SONS.faisceau.ecartLU } }),
  arrivee: () => ({ fichier: S.SONS.arrivee.fichier, niveau: { lu_sous_voix: S.SONS.arrivee.ecartLU } }),
  clic: () => ({ fichier: S.SONS.clic.fichier, niveau: { rms_db_sous_voix: S.SONS.clic.ecartRmsDb } }),
  frappe: (k) => ({ fichier: `${S.SONS.frappe.dossier}/t${(k % 4) + 1}.wav`, niveau: { rms_db_sous_voix: S.SONS.frappe.ecartRmsDb, variation_db: S.SONS.frappe.variationDb } }),
  entree: () => ({ fichier: S.SONS.entree.fichier, niveau: { rms_db_sous_voix: S.SONS.entree.ecartRmsDb } }),
  transition: () => ({ fichier: S.SONS.transition.fichier, niveau: { rms_db_sous_voix: S.SONS.transition.ecartRmsDb } }),
  meme: () => ({ fichier: S.SONS.meme.fichier, niveau: { lu_sous_voix: S.SONS.meme.ecartLU } }),
};
export function son(cle, imageAbs, pourquoi, k = 0) {
  if (!SON[cle]) throw new Error(`son inconnu : ${cle} (connus : ${Object.keys(SON).join(', ')})`);
  const geste = { clic: 'photo' }[cle] || cle;   // champ « geste » de sons.json (extension sound-design du CONTRAT)
  return { ...SON[cle](k), image: imageAbs, geste, pourquoi };
}

// ------------------------------------------------------------------ effets sur le plan caméra (champ « plan » du CONTRAT)
export const planFlou = (nom = 'flou') => ({ flou: { rayon: S.FONDS[nom].sigma, assombrir: S.FONDS[nom].niveau } });

// Demi-écran : décalage vertical du plan image par image (port de cameraDemi du Style Lab, courbe « banque »).
const BANQUE = JSON.parse(fs.readFileSync(path.join(BIB, 'demi-ecran', 'courbe_banque.json'), 'utf8'));
const banque = (p) => { const T = BANQUE.table; p = Math.min(1, Math.max(0, p)); const x = p * (T.length - 1), i = Math.min(T.length - 2, Math.floor(x)); return T[i] + (T[i + 1] - T[i]) * (x - i); };
const eio = (p) => { p = Math.min(1, Math.max(0, p)); return p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2; };
export function decalageDemi(n, t0, t1, sortie, bascule) {
  const DM = S.DEMI, DB = BANQUE.duree, out = [];
  for (let k = 0; k < n; k++) {
    const t = k / FPS; let v;
    if (t < t0) v = -DM.hauteur; else if (t < t1) v = -DM.hauteur + DM.hauteur * banque((t - t0) / DB);
    else v = sortie === 'seche' ? -DM.hauteur * Math.min(1, (t - t1) / DM.sortie) ** 2 : -DM.hauteur;
    let off = Math.min(DM.ty, Math.max(0, v + DM.ty));
    if (sortie !== 'seche' && k >= Math.round(t1 * FPS)) off = 0;
    if (bascule && t >= bascule[0] && k < Math.round(t1 * FPS)) off = DM.ty + DM.bascule.pousse * eio((t - bascule[0]) / (bascule[1] - bascule[0]));
    out.push(+off.toFixed(3));
  }
  return out;
}

// ------------------------------------------------------------------ écriture d'un calque
const POLICES_FICHIERS = ['BigShouldersDisplay.ttf', 'BricolageGrotesque.ttf', 'Roboto.ttf', 'LiberationSans-Regular.ttf'];
export function stager(dc) {
  fs.mkdirSync(path.join(dc, 'fonts'), { recursive: true });
  fs.mkdirSync(path.join(dc, 'vendor'), { recursive: true });
  fs.mkdirSync(path.join(dc, 'images'), { recursive: true });
  for (const f of POLICES_FICHIERS) fs.copyFileSync(path.join(BIB, 'fonts', f), path.join(dc, 'fonts', f));
  fs.copyFileSync(path.join(BIB, 'vendor', 'gsap.min.js'), path.join(dc, 'vendor', 'gsap.min.js'));
  fs.copyFileSync(path.join(BIB, 'images', 'image-a-fournir.svg'), path.join(dc, 'images', 'image-a-fournir.svg'));
}
// Les photos manquantes : chaque <img> qui garde l'emplacement dit dans data-a-fournir ce qu'il faut demander à Romain.
export function photosAFournir(html) {
  return [...html.matchAll(/<img[^>]*src="images\/image-a-fournir\.svg"[^>]*data-a-fournir="([^"]*)"/g)].map((m) => m[1]);
}
// entree : { id, demande, debut (image de la vidéo coupée), images, couche, ordre, plan?, sons_suggeres?, attendus?,
//            origine : { gabarit } | { sur_mesure : intention }, params? }
export function ecrireCalque(dossierMontage, entree, html, extra = {}) {
  const dc = path.join(dossierMontage, 'calques', entree.id);
  fs.mkdirSync(dc, { recursive: true });
  stager(dc);
  fs.writeFileSync(path.join(dc, 'index.html'), html);
  for (const [nom, contenu] of Object.entries(extra)) fs.writeFileSync(path.join(dc, nom), typeof contenu === 'string' ? contenu : JSON.stringify(contenu));
  const c = { id: entree.id, source: 'animations', dossier: `calques/${entree.id}`, debut: entree.debut, images: entree.images,
    couche: entree.couche, ordre: entree.ordre ?? 20 };
  if (entree.plan) c.plan = entree.plan;
  // le calque porte sa propre ligne de sous-titre : la brique sous-titres retire ses groupes pendant ce calque
  if (entree.masque_sous_titres) c.masque_sous_titres = true;
  c.sons_suggeres = (entree.sons_suggeres || []).map((x) => ({ ...x, calque: entree.id }));
  const fiche = { ...c, demande: entree.demande, origine: entree.origine, attendus: entree.attendus || [],
    a_fournir: photosAFournir(html), params: entree.params || null, ecrit_le: new Date().toISOString().slice(0, 10) };
  fs.writeFileSync(path.join(dc, 'calque.json'), JSON.stringify(fiche, null, 2) + '\n');
  return { dossier: dc, fiche };
}

// ------------------------------------------------------------------ ce que le style permet pour un gabarit
// Le plan de montage peut demander un réglage que le gabarit ne prévoit pas, ou une durée que le style fixe autrement :
// le STYLE GAGNE (CONTRAT, « Plan contre style »). Ces deux fonctions disent ce que le style permet ; caler.mjs les
// signale avant l'instanciation, instancier.mjs les applique.

// Réglages P d'un gabarit (toutes couches) : { cle: { defaut, valeurs: [...] | null } }. Les valeurs permises sont lues
// dans le commentaire de la ligne « const P » : chaînes entre apostrophes, ou nombres écrits après le nom du réglage.
export function reglagesGabarit(geste) {
  const out = {};
  const G = GESTES[geste];
  if (!G) return out;
  for (const couche of G.couches || []) {
    const f = path.join(BIB, geste, couche, 'index.html');
    if (!fs.existsSync(f)) continue;
    const m = fs.readFileSync(f, 'utf8').match(/const P = \{([^\n]*?)\};\s*(?:\/\/\s*(.*))?$/m);
    if (!m) continue;
    const com = m[2] || '';
    for (const x of m[1].matchAll(/(\w+):\s*('([^']*)'|-?[\d.]+|true|false)/g)) {
      const cle = x[1], texte = x[3] !== undefined;
      const defaut = texte ? x[3] : JSON.parse(x[2]);
      let valeurs = null;
      if (texte) {
        const q = [...com.matchAll(/'([^']*)'/g)].map((y) => y[1]);
        if (q.length) valeurs = q;
      } else if (typeof defaut === 'number') {
        const i = com.indexOf(cle);
        if (i >= 0) { const n = [...com.slice(i).split(';')[0].matchAll(/-?\d+(?:\.\d+)?/g)].map((y) => +y[0]); if (n.length) valeurs = n; }
      }
      if (valeurs && !valeurs.includes(defaut)) valeurs.push(defaut);
      out[cle] = { defaut, valeurs };
    }
  }
  return out;
}

// Durée que le style fixe pour un geste (gestes.json « duree_style ») : { images, instant, regle } ou null.
// images : nombre, ou chemin d'une constante de commun.mjs (« HOOK_TEMPS.finPaves »).
export function dureeStyle(geste) {
  const d = (GESTES[geste] || {}).duree_style;
  if (!d) return null;
  const images = typeof d.images === 'number' ? d.images : d.images.split('.').reduce((o, k) => o[k], S);
  return { images, instant: d.instant || null, regle: d.regle || '' };
}
