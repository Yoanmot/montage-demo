// Briques communes des calques HyperFrames : la SEULE version des gestes partagés (fond r4-01c, faisceau r1-04a,
// sous-titres, croix, crochets, icônes, logos). Reprise de briques/gabarits/commun.mjs (version du tour 12, la
// référence), recâblée : toutes les valeurs viennent de style/style.json (style.mjs), plus rien en dur ici.
// briques/gabarits/commun.mjs ne fait plus que réexporter ce fichier : les 13 gabarits lisent donc le même style.
// Un gabarit = une fonction (p, o) -> { css, html, js } ; p préfixe tous les ids (plusieurs gabarits dans un même calque),
// o = paramètres (textes, instants en secondes depuis le début du calque). Le js s'ajoute à la timeline GSAP « tl ».
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { boiteCrochets, encre } from '../../briques/encre/encre.mjs';
const GLYPHES = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'briques', 'encre', 'satoshi-glyphes.json'), 'utf8'));
// largeur d'un mot en Satoshi Black (avance des glyphes + interlettrage après chaque lettre, comme Chrome)
export const largeurSatoshi = (mot, taille, ls = 0) => [...mot].reduce((a, c) => a + GLYPHES.chars[c].adv * taille / GLYPHES.upm + ls * taille, 0);
import { STYLE, C, F, f3, rgbs, RGB_D, halo, haloTrait, page, POLICES, GRAIN } from './style.mjs';

export { f3, rgbs, RGB_D, halo, haloTrait, page, POLICES, GRAIN, STYLE };
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FOND = STYLE.fond;
const M = STYLE.motion;
const W = F.largeur, H = F.hauteur;

// ---------------------------------------------------------------------------------------------------------------
// Constantes de style, sous la forme qu'attendent les gabarits (objet S de l'ancien commun.mjs)
// ---------------------------------------------------------------------------------------------------------------
const E0 = STYLE.entrees;
export const S = {
  dore: C.dore, blanc: C.blanc, creme: C.creme, texteUI: C.texteUI, fondFS: C.fondFS,
  verre: M.verre, verreCam: M.verreCam, verreObjet: M.verreObjet, tuile: M.tuile,
  filet: M.filet, filetFort: M.filetFort, filetDoux: M.filetDoux, trait: M.trait,
  attenue: M.attenue, secondaire: M.secondaire,
  rayon: M.rayon,
  entree: { duree: E0.texte.duree, flou: E0.texte.flou, avance: E0.texte.avance },
  objet: { duree: E0.objet.duree, flou: E0.objet.flou },
  cascade: M.cascade, morph: M.morph, croix: M.croix, crochet: M.crochet, icone: M.icone,
  etiquettes: M.etiquettes, etiquette: M.etiquette, ui: M.ui, capture: M.capture,
};

// ---------------------------------------------------------------------------------------------------------------
// Gestes de base
// ---------------------------------------------------------------------------------------------------------------
// fondu depuis un flou, sans rebond
export const ent = (sel, t, o = {}) => `tl.fromTo('${sel}', { opacity: 0, filter: 'blur(${o.flou ?? S.objet.flou}px)'${o.y ? `, y: ${o.y}` : ''}${o.scale ? `, scale: ${o.scale}` : ''} }, { opacity: 1, filter: 'blur(0px)'${o.y ? ', y: 0' : ''}${o.scale ? ', scale: 1' : ''}, duration: ${o.d ?? S.objet.duree}, ease: 'power2.out', immediateRender: true }, ${f3(t)});\n`;
// sortie : vers un flou (reel 4 : une image de flou), courte
export const sortie = (sel, t, o = {}) => `tl.to('${sel}', { opacity: 0, filter: 'blur(${o.flou ?? E0.sortie.flou}px)', duration: ${o.d ?? E0.sortie.duree}, ease: '${E0.sortie.courbe}' }, ${f3(t)});\n`;
export const masque = (sel, t) => `tl.set('${sel}', { opacity: 0 }, ${f3(t)});\n`;

// grain qui vibre à chaque image (texture du style, déplacée au hasard d'au plus amp px)
export function grainJs(sel, t0, t1, graine = FOND.grain.graine, amp = FOND.grain.amplitude) {
  let sd = graine, js = '';
  const rnd = () => { sd = (sd * 1103515245 + 12345) % 2147483648; return sd / 2147483648; };
  const ips = F.ips;
  for (let f = Math.max(0, Math.round(t0 * ips)); f < Math.round(t1 * ips); f++) {
    js += `tl.set('${sel}', { x: ${Math.round(rnd() * 2 * amp - amp)}, y: ${Math.round(rnd() * 2 * amp - amp)} }, ${(f / ips + 0.001).toFixed(3)});\n`;
  }
  return js;
}
// grain posé DANS un panneau (le reel 4 a du grain sur tout) : le panneau doit être overflow:hidden
export const grainCss = (cls, op = 0.42) => { const m = FOND.grain.marge; return `.${cls}{position:absolute;left:-${m}px;top:-${m}px;right:-${m}px;bottom:-${m}px;background:url('grain.png') repeat;mix-blend-mode:overlay;opacity:${op};pointer-events:none;}`; };

// Fond granuleux verrouillé r4-01c (lumière fixe, grain fin qui vibre à chaque image)
export function fondC(p, t0, t1) {
  const g = FOND.grain, m = g.marge;
  const css = `
#${p}base{position:absolute;left:0;top:0;width:${W}px;height:${H}px;background:linear-gradient(${FOND.angle}deg,${FOND.base.join(',')});}
#${p}lum{position:absolute;left:0;top:0;width:${W}px;height:${H}px;
  background:radial-gradient(circle ${FOND.L.r.toFixed(1)}px at ${FOND.L.cx.toFixed(1)}px ${FOND.L.cy.toFixed(1)}px,${FOND.lum.join(',')});}
#${p}grain{position:absolute;left:-${m}px;top:-${m}px;width:${W + 2 * m}px;height:${H + 2 * m}px;background:url('grain.png') repeat;mix-blend-mode:overlay;opacity:${g.opacite};}
#${p}vig{position:absolute;left:0;top:0;width:${W}px;height:${H}px;background:${FOND.vig};}`;
  const html = `<div id="${p}base"></div><div id="${p}lum"></div><div id="${p}grain"></div><div id="${p}vig"></div>`;
  return { css, html, js: grainJs(`#${p}grain`, t0, t1, g.graine) };
}

// Faisceau diagonal verrouillé (r1-04a) : image pleine à T, le plan change à T, repart vers la gauche
const FX = STYLE.faisceau, FXR = rgbs(FX.couleur);
export const FAISCEAU = { css: `
#flash{position:absolute;pointer-events:none;z-index:${FX.z};left:${FX.gauche}px;top:${FX.haut}px;width:${FX.largeur}px;height:${FX.hauteur}px;transform-origin:50% 50%;
  background:linear-gradient(90deg,rgba(${FXR},0) 0%,${FX.couleur} ${FX.bord}%,${FX.couleur} ${100 - FX.bord}%,rgba(${FXR},0) 100%);}`, html: `  <div id="flash"></div>\n` };
// premier : le premier faisceau du calque (pose la rotation) ; les suivants se réarment juste avant leur passage
export function faisceauJs(T, premier) {
  let js = premier ? `tl.set('#flash', { rotation: ${FX.rotation}, x: ${FX.depart} }, 0);\n` : `tl.set('#flash', { x: ${FX.depart} }, ${f3(T - FX.armement)});\n`;
  js += `tl.to('#flash', { x: 0, duration: ${FX.aller.duree}, ease: '${FX.aller.courbe}' }, ${f3(T - FX.aller.duree)});\n`;
  js += `tl.to('#flash', { x: ${FX.arrivee}, duration: ${FX.retour.duree}, ease: '${FX.retour.courbe}' }, ${f3(T + 0.001)});\n`;
  return js;
}
// Tous les faisceaux d'un calque : { css, html, js }
export const faisceaux = (Ts) => ({ css: FAISCEAU.css, html: FAISCEAU.html, js: Ts.map((T, i) => faisceauJs(T, i === 0)).join('') });

// Plein écran sur fond r4-01c entre deux faisceaux (T1 aller, T2 retour) : contenu = { css, html, js }
export function pleinEcran(p, T1, T2, contenu) {
  const f = fondC(`${p}f`, T1 - 0.1, T2 + 0.1);
  const css = f.css + `\n#${p}fs{position:absolute;left:0;top:0;width:${W}px;height:${H}px;opacity:0;overflow:hidden;background:${S.fondFS};z-index:10;}` + contenu.css;
  const html = `  <div id="${p}fs">${f.html}${contenu.html}</div>\n`;
  const js = f.js + `tl.set('#${p}fs', { opacity: 1 }, ${f3(T1)});\ntl.set('#${p}fs', { opacity: 0 }, ${f3(T2 + 0.001)});\n` + contenu.js;
  return { css, html, js };
}

// ---------------------------------------------------------------------------------------------------------------
// Viseurs et crochets
// ---------------------------------------------------------------------------------------------------------------
// Croix « + » crème aux 4 coins d'une boîte (bras qui dépassent du cadre), apparaissent avec le panneau
export function croix(p, box) {
  const { taille: T, trait: e, couleur } = S.croix, h = T / 2;
  const pts = [[box.x, box.y], [box.x + box.w, box.y], [box.x, box.y + box.h], [box.x + box.w, box.y + box.h]];
  const css = `.${p}x{position:absolute;width:${T}px;height:${T}px;opacity:0;pointer-events:none;z-index:21;}
.${p}x:before,.${p}x:after{content:'';position:absolute;background:${couleur};}
.${p}x:before{left:${h - e / 2}px;top:0;width:${e}px;height:${T}px;} .${p}x:after{left:0;top:${h - e / 2}px;width:${T}px;height:${e}px;}`;
  const html = pts.map(([x, y], i) => `<div class="${p}x" id="${p}x${i}" style="left:${x - h}px;top:${y - h}px"></div>`).join('');
  return { css, html, sel: `.${p}x` };
}
// Crochets dorés (4 coins) autour d'une boîte ; id = conteneur positionné en absolu (left/top/width/height)
export function crochetsCss(cls) {
  const { bras, trait } = S.crochet;
  return `.${cls}{position:absolute;pointer-events:none;opacity:0;filter:${haloTrait};}
.${cls} i{position:absolute;display:block;background:${S.dore};}
.${cls} .c{position:absolute;left:0;top:0;right:0;bottom:0;}
.${cls} .h{width:${bras}px;height:${trait}px;} .${cls} .v{width:${trait}px;height:${bras}px;}
.${cls} .tl .h,.${cls} .tl .v{left:0;top:0;} .${cls} .tr .h,.${cls} .tr .v{right:0;top:0;}
.${cls} .bl .h,.${cls} .bl .v{left:0;bottom:0;} .${cls} .bd .h,.${cls} .bd .v{right:0;bottom:0;}`;
}
export const crochetsHtml = (id, cls, b) => `<div class="${cls}" id="${id}" style="left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px">`
  + ['tl', 'tr', 'bl', 'bd'].map((c) => `<span class="c ${c}" id="${id}-${c}"><i class="h"></i><i class="v"></i></span>`).join('') + `</div>`;
// arrivée : les 4 coins se resserrent depuis D px plus loin (r4-04a)
const CRD = STYLE.sousTitres.crochets;   // durée et courbe du resserrement (identiques partout)
export const DIR_COINS = { tl: [-1, -1], tr: [1, -1], bl: [-1, 1], bd: [1, 1] };
export const resserreJs = (id, T, D) => Object.entries(DIR_COINS).map(([c, [sx, sy]]) =>
  `tl.fromTo('#${id}-${c}', { x: ${sx * D}, y: ${sy * D}, opacity: 0 }, { x: 0, y: 0, opacity: 1, duration: ${CRD.duree}, ease: '${CRD.courbe}', immediateRender: true }, ${f3(T)});\n`).join('');
export function crochetsEntree(id, t) {
  return `tl.set('#${id}', { opacity: 1 }, ${f3(t)});\n` + resserreJs(id, t, S.crochet.D);
}
// déplacement des crochets vers une autre boîte (on transforme, on ne remplace pas)
export const crochetsVers = (id, t, b, d = 0.22) => `tl.to('#${id}', { left: ${b.x}, top: ${b.y}, width: ${b.w}, height: ${b.h}, duration: ${d}, ease: 'power2.inOut' }, ${f3(t)});\n`;

// ---------------------------------------------------------------------------------------------------------------
// Icônes en trait (dessinées pour la bibliothèque, style trait rond ; viewBox 24)
// ---------------------------------------------------------------------------------------------------------------
export const ICONES = {
  fichier: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
  video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10.5 9.5v5l4-2.5z"/>',
  micro: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  onde: '<path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/>',
  etincelle: '<path d="M12 3c.6 4.6 3.4 7.4 8 8-4.6.6-7.4 3.4-8 8-.6-4.6-3.4-7.4-8-8 4.6-.6 7.4-3.4 8-8z"/>',
  bulle: '<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5 12 13l8.5-6.5"/>',
  agenda: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  pile: '<path d="M12 3 3 8l9 5 9-5z"/><path d="m3 13 9 5 9-5"/>',
  texte: '<path d="M5 6h14M5 10h14M5 14h10M5 18h7"/>',
  ecran: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
};
export function icone(nom, taille, couleur = S.creme, o = {}) {
  const sw = (S.icone * 24 / taille).toFixed(2);
  return `<svg${o.id ? ` id="${o.id}"` : ''}${o.cls ? ` class="${o.cls}"` : ''} width="${taille}" height="${taille}" viewBox="0 0 24 24" fill="none" stroke="${couleur}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${o.style ? ` style="${o.style}"` : ''}>${ICONES[nom]}</svg>`;
}
// Étiquette (la petite voix technique) : famille prise dans S.etiquettes
export const etiqCss = (cls, fam = S.etiquette, o = {}) => {
  const e = S.etiquettes[fam];
  return `.${cls}{font-family:'${e.family}';font-weight:${e.poids};font-size:${o.taille ?? e.taille}px;letter-spacing:${e.ls}em;text-transform:uppercase;color:${o.couleur ?? S.secondaire};white-space:nowrap;line-height:1;}`;
};

// ---------------------------------------------------------------------------------------------------------------
// Sous-titres verrouillés (r5-01a : Satoshi Black 70 px, haut des capitales à y 256, mot par mot, mot doré avec halo)
// ---------------------------------------------------------------------------------------------------------------
const STS = STYLE.sousTitres;
// mots : [{w, t, fin}] (instants dans le calque) ; specs : [['LIGNE 1|LIGNE 2', 'MOT DORÉ'?, { crochets: false }?]] ; chaque mot affiché
// consomme le mot suivant de la voix. fin : durée du calque (le dernier groupe s'arrête au plus tard là).
// Le doré peut être une EXPRESSION de plusieurs mots (« UNE SEULE FOIS », retours de Yoan du 2026-10-23) : tous ses mots
// sont dorés et les crochets l'entourent en entier. opt.accent = 'fort' : le groupe entier est l'expression, en grand
// (présentation du CTA sans ses lignes, voir sousTitresFort).
export function groupes(mots, specs, fin) {
  let i = 0; const out = [];
  specs.forEach(([spec, k, opt = {}]) => {
    const ms = [];
    const plats = spec.split('|').flatMap((l) => l.trim().split(/\s+/));
    const kw = k ? k.trim().split(/\s+/) : [];
    let e0 = -1;
    if (kw.length > 1) { e0 = plats.findIndex((_, j) => kw.every((x, q) => plats[j + q] === x)); if (e0 < 0) throw new Error(`expression dorée « ${k} » absente de « ${spec} »`); }
    let j = 0;
    spec.split('|').forEach((ligne, li) => ligne.trim().split(/\s+/).forEach((w, wi) => {
      const m = mots[i++]; if (!m) throw new Error(`trop de mots : ${spec}`);
      if (li > 0 && wi === 0) ms.push(['|', m.t]);
      const dansExpr = e0 >= 0 && j >= e0 && j < e0 + kw.length;
      ms.push([w, m.t, kw.length > 1 ? dansExpr : w === k, opt.crochets ?? true, dansExpr ? j - e0 : undefined, dansExpr ? kw.length : undefined]);
      j++;
    }));
    out.push({ start: +(ms[0][1] - STS.debutAvantMot).toFixed(3), mots: ms, finMot: mots[i - 1].fin, accent: opt.accent, expression: kw.length > 1 });
  });
  if (i !== mots.length) throw new Error(`${i} mots affichés sur ${mots.length} : ${mots.map((m) => m.w).join(' ')}`);
  out.forEach((g, gi) => { g.end = gi < out.length - 1 ? out[gi + 1].start : Math.min(fin, +(g.finMot + STS.finApresMot).toFixed(3)); });
  return out;
}
// Crochets des sous-titres (tour 10, r10-01d gardé) : sur le mot doré seulement, centrés sur les CAPITALES (mode
// « capitales » de encre.mjs), marge 11 px entre le bord intérieur du trait et le mot, trait 3 px, bras 24 px ;
// bords extérieurs calés sur la grille des pixels. Ponctuation finale du mot doré retirée (les crochets visent le mot).
// Option crochets:false (B-roll : les crochets doubleraient l'annotation), pour tout le calque (o.crochets) ou pour un
// groupe (3e élément de la spec, ou 4e élément d'un mot : [mot, t, doré, false]) : le mot doré reste doré, sans crochets.
export const ST = { taille: STS.taille, lh: STS.interligne, top: STS.top, marge: STS.crochets.marge, mode: STS.crochets.mode,
  crochet: { bras: STS.crochets.bras, trait: STS.crochets.trait, D: STS.crochets.D } };
export const boiteST = (w) => boiteCrochets(w, ST.taille, ST.lh, 0, ST.marge, ST.crochet.trait, ST.mode);
const resserre = (id, T) => resserreJs(id, T, ST.crochet.D);
export function sousTitres(gs, p = 's', o = {}) {
  const E = S.entree, Cr = ST.crochet, avecCrochets = o.crochets ?? true;
  let css = `
.grp{position:absolute;left:${STS.gauche}px;top:${ST.top}px;width:${STS.largeur}px;text-align:center;opacity:0;z-index:${STS.z};
  font-family:'${POLICES[STS.police].family}';font-weight:900;font-size:${ST.taille}px;line-height:${ST.lh};color:${S.blanc};text-transform:uppercase;
  text-shadow:${STS.ombre};}
.m{display:none;opacity:0;margin:0 ${STS.espace}em;}
.saut{display:none;width:100%;height:0;}
.k{color:${S.dore};text-shadow:${halo()};}
.kw{position:relative;}
.stcr{position:absolute;pointer-events:none;}
.stcr i{position:absolute;display:block;background:${S.dore};}
.stcr .h{width:${Cr.bras}px;height:${Cr.trait}px;} .stcr .v{width:${Cr.trait}px;height:${Cr.bras}px;}
.stcr .tl{left:0;top:0;} .stcr .tr{right:0;top:0;} .stcr .bl{left:0;bottom:0;} .stcr .bd{right:0;bottom:0;}
.stcoin{position:absolute;left:0;top:0;right:0;bottom:0;}`;
  let html = '', js = '';
  const esp = STS.espace * ST.taille;
  gs.forEach((g, gi) => {
    const id = `${p}g${gi}`;
    if (g.accent === 'fort') { const f = sousTitresFort(g, id); css += f.css; html += f.html; js += f.js; return; }
    // expression dorée : les mots de l'expression dans une enveloppe, les crochets autour de l'enveloppe entière
    const ex = g.expression && avecCrochets ? g.mots.filter((m) => m[4] !== undefined && m[3] !== false) : [];
    let exHtml = null;
    if (ex.length) {
      const b0 = boiteST(ex[0][0].replace(/[.,;:!?]+$/, '')), b1 = boiteST(ex[ex.length - 1][0].replace(/[.,;:!?]+$/, ''));
      const li = g.mots.slice(0, g.mots.indexOf(ex[0])).filter(([x]) => x === '|').length;
      if (g.mots.slice(g.mots.indexOf(ex[0]), g.mots.indexOf(ex[ex.length - 1])).some(([x]) => x === '|')) throw new Error(`expression dorée sur deux lignes : ${ex.map((m) => m[0]).join(' ')}`);
      const y0 = ST.top + li * ST.taille * ST.lh, y1 = y0 + ST.taille * ST.lh;
      const top = +(Math.round(y0 + b0.top) - y0).toFixed(2), bottom = +(y1 - Math.round(y1 - b0.bottom)).toFixed(2);
      const L = +(esp + b0.left).toFixed(1), R = +(esp + b1.right).toFixed(1);
      css += `\n#${id}ex{position:relative;display:inline-block;margin:0 ${Math.max(0, -R).toFixed(1)}px 0 ${Math.max(0, -L).toFixed(1)}px;}`
        + `\n#${id}cr{left:${L}px;right:${R}px;top:${top}px;bottom:${bottom}px;}`;
      exHtml = `<span class="stcr" id="${id}cr">` + ['tl', 'tr', 'bl', 'bd'].map((c) => `<span class="stcoin" id="${id}cr-${c}"><i class="${c} h"></i><i class="${c} v"></i></span>`).join('') + '</span>';
    }
    html += `  <div class="grp" id="${id}">` + g.mots.map(([w0, , k, cr, xi, xn], wi) => {
      if (w0 === '|') return `<span class="saut" id="${id}m${wi}"></span>`;
      if (exHtml && xi !== undefined && cr !== false) {
        const sp = `<span class="m k" id="${id}m${wi}">${xi === xn - 1 ? w0.replace(/[.,;:!?]+$/, '') : w0}</span>`;
        return (xi === 0 ? `<span id="${id}ex">` : '') + sp + (xi === xn - 1 ? exHtml + '</span>' : '');
      }
      if (!k) return `<span class="m" id="${id}m${wi}">${w0}</span>`;
      if (!avecCrochets || cr === false) return `<span class="m k" id="${id}m${wi}">${w0}</span>`;
      const w = w0.replace(/[.,;:!?]+$/, '');
      const li = g.mots.slice(0, wi).filter(([x]) => x === '|').length;
      const b = boiteST(w), y0 = ST.top + li * ST.taille * ST.lh, y1 = y0 + ST.taille * ST.lh;
      b.top = +(Math.round(y0 + b.top) - y0).toFixed(2); b.bottom = +(y1 - Math.round(y1 - b.bottom)).toFixed(2);
      css += `\n#${id}m${wi}{margin:0 calc(${STS.espace}em + ${Math.max(0, -b.right).toFixed(1)}px) 0 calc(${STS.espace}em + ${Math.max(0, -b.left).toFixed(1)}px);}`
        + `\n#${id}cr{left:${b.left}px;right:${b.right}px;top:${b.top}px;bottom:${b.bottom}px;}`;
      return `<span class="m kw" id="${id}m${wi}"><span class="k" id="${id}m${wi}t">${w}</span><span class="stcr" id="${id}cr">`
        + ['tl', 'tr', 'bl', 'bd'].map((c) => `<span class="stcoin" id="${id}cr-${c}"><i class="${c} h"></i><i class="${c} v"></i></span>`).join('') + '</span></span>';
    }).join('') + '</div>\n';
    js += `tl.set('#${id}', { opacity: 1 }, ${f3(g.start)});\n`;
    g.mots.forEach(([w, t, k0, cr, xi, xn], wi) => {
      if (exHtml && xi !== undefined && cr !== false) {   // mot d'une expression : doré, crochets au dernier mot (expression complète)
        const t0 = f3(Math.max(0, t - E.avance));
        js += `tl.set('#${id}m${wi}', { display: 'inline-block' }, ${t0});\n`;
        js += `tl.fromTo('#${id}m${wi}', { opacity: 0, filter: 'blur(${E.flou}px)' }, { opacity: 1, filter: 'blur(0px)', duration: ${E.duree}, ease: '${E0.texte.courbe}', immediateRender: false }, ${t0});\n`;
        if (xi === xn - 1) js += resserre(`${id}cr`, +t0);
        return;
      }
      const k = k0 && avecCrochets && cr !== false;
      const t0 = f3(Math.max(0, t - E.avance));
      if (w === '|') { js += `tl.set('#${id}m${wi}', { display: 'block' }, ${t0});\n`; return; }
      js += `tl.set('#${id}m${wi}', { display: 'inline-block' }, ${t0});\n`;
      const cible = k ? `#${id}m${wi}t` : `#${id}m${wi}`;
      if (k) js += `tl.set('#${id}m${wi}', { opacity: 1 }, ${t0});\n` + resserre(`${id}cr`, +t0);
      js += `tl.fromTo('${cible}', { opacity: 0, filter: 'blur(${E.flou}px)' }, { opacity: 1, filter: 'blur(0px)', duration: ${E.duree}, ease: '${E0.texte.courbe}', immediateRender: false }, ${t0});\n`;
    });
    js += `tl.set('#${id}', { opacity: 0 }, ${f3(g.end)});\n`;
  });
  return { css, html, js };
}

// Accent fort (retours de Yoan du 2026-10-23, « HYPER GÉNÉRALISTES » : « le texte plus gros, un peu comme sur le CTA mais
// sans le prolongement du quadrillage ») : le groupe entier est l'expression, en doré avec halo, Satoshi Black plus gros
// (style.json sousTitres.accentFort), une ligne par « | », chaque mot entre comme le CTA (flou 16 px, 0,26 s) calé sur sa
// voix ; quatre « + » crème autour de l'encre de toute l'expression, posés comme ceux du CTA, qui arrivent avec le dernier
// mot (même décalage que les « + » du CTA). Aucune ligne tirée à travers le cadre, aucun quadrillage, muet.
const AF = STS.accentFort;
function sousTitresFort(g, id) {
  const T = AF.taille, lh = AF.interligne, ls = AF.interlettrage, Ec = E0[AF.entree] ?? E0.cta, CL = STYLE.cta.lignes, pl = STYLE.cta.plus;
  const lignes = []; let cur = [];
  g.mots.forEach((m) => { if (m[0] === '|') { lignes.push(cur); cur = []; } else cur.push(m); }); lignes.push(cur);
  const esp = STS.espace * T;
  let ix0 = 1e9, ix1 = -1e9, iy0 = 1e9, iy1 = -1e9;
  lignes.forEach((l, li) => {
    const ws = l.map((m) => m[0].replace(/[.,;:!?]+$/, ''));
    const larg = ws.reduce((a, w) => a + largeurSatoshi(w, T, ls) + 2 * esp, 0);
    const x0 = 540 - larg / 2, top = AF.top + li * T * lh;
    const e0 = encre(ws[0], T, lh, ls), e1 = encre(ws[ws.length - 1], T, lh, ls);
    ix0 = Math.min(ix0, x0 + esp + e0.gauche); ix1 = Math.max(ix1, x0 + larg - esp - e1.droite);
    const hauts = ws.map((w) => encre(w, T, lh, ls)), bas = Math.min(...hauts.map((e) => e.bas));
    iy0 = Math.min(iy0, top + Math.min(...hauts.map((e) => e.cap_haut))); iy1 = Math.max(iy1, top + T * lh - bas);
  });
  const M = AF.plus.marge, cx0 = Math.round(ix0 - M.x), cx1 = Math.round(ix1 + M.x), cy0 = Math.round(iy0 - M.y), cy1 = Math.round(iy1 + M.y), h2 = pl.taille / 2;
  const css = `
#${id}{position:absolute;left:0;top:0;width:${W}px;height:${H}px;opacity:0;z-index:${STS.z};}
.${id}l{position:absolute;left:0;width:${W}px;text-align:center;white-space:nowrap;font-family:'${POLICES[STS.police].family}';font-weight:900;
  font-size:${T}px;line-height:${lh};letter-spacing:${ls}em;text-transform:uppercase;color:${S.dore};text-shadow:${halo()};}
.${id}w{display:inline-block;opacity:0;margin:0 ${STS.espace}em;}
.${id}p{position:absolute;width:${pl.taille}px;height:${pl.taille}px;opacity:0;} .${id}p:before,.${id}p:after{content:'';position:absolute;background:${S.creme};}
.${id}p:before{left:${(pl.taille - pl.trait) / 2}px;top:0;width:${pl.trait}px;height:${pl.taille}px;} .${id}p:after{left:0;top:${(pl.taille - pl.trait) / 2}px;width:${pl.taille}px;height:${pl.trait}px;}`;
  let html = `  <div id="${id}">`, js = `tl.set('#${id}', { opacity: 1 }, ${f3(g.start)});\n`;
  let dernier = 0;
  lignes.forEach((l, li) => {
    html += `<div class="${id}l" style="top:${AF.top + li * T * lh}px">` + l.map((m, wi) => `<span class="${id}w" id="${id}w${li}_${wi}">${m[0].replace(/[.,;:!?]+$/, '')}</span>`).join('') + '</div>';
    l.forEach((m, wi) => {
      const t0 = Math.max(0, m[1] - S.entree.avance); dernier = Math.max(dernier, t0);
      js += `tl.fromTo('#${id}w${li}_${wi}', { opacity: 0, filter: 'blur(${Ec.flou}px)' }, { opacity: 1, filter: 'blur(0px)', duration: ${Ec.duree}, ease: 'power2.out', immediateRender: true }, ${f3(t0)});\n`;
    });
  });
  html += [[cx0, cy0], [cx1, cy0], [cx0, cy1], [cx1, cy1]].map(([x, y], i) => `<div class="${id}p" id="${id}p${i}" style="left:${x - h2}px;top:${y - h2}px"></div>`).join('') + '</div>\n';
  js += `tl.fromTo('.${id}p', { opacity: 0, scale: 0.4, rotation: -45 }, { opacity: 1, scale: 1, rotation: 0, duration: ${CL.duree}, ease: 'power2.out', immediateRender: true }, ${f3(dernier + CL.decalage + CL.plusDecalage)});\n`;
  js += `tl.set('#${id}', { opacity: 0 }, ${f3(g.end)});\n`;
  return { css, html, js, boite: { cx0, cx1, cy0, cy1 } };
}

// Frappe caractère par caractère : renvoie les instants de chaque caractère (débit cps, espaces un peu plus longs,
// léger aléa déterministe pour un rythme humain)
export function frappe(texte, debut, cps, graine = 4242) {
  let sd = graine; const rnd = () => { sd = (sd * 1103515245 + 12345) % 2147483648; return sd / 2147483648; };
  let t = debut; const out = [];
  for (const c of texte) { out.push([c, +t.toFixed(3)]); t += (1 / cps) * (c === ' ' ? 1.6 : 0.7 + rnd() * 0.6); }
  return out;
}
export const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------------------------------------------------------------------------------------------------------------
// Logos de marque (tour 11) : SVG Simple Icons (CC0) dans briques/logos/, couleurs de marque dans logos/SOURCES.md.
// Ce sont des données de marques (pas des valeurs du style) : elles restent ici.
// Logos et couleurs seulement : jamais d'imitation d'une interface de marque.
// ---------------------------------------------------------------------------------------------------------------
const LOGOS_DIR = path.resolve(HERE, '..', '..', 'briques', 'logos');
export const MARQUES = {
  openai: { nom: 'ChatGPT', fichier: 'openai.svg', couleur: '#F2EEE6', tuile: '#0D0D0D' },     // marque monochrome (noir et blanc)
  claude: { nom: 'Claude', fichier: 'claude.svg', couleur: '#D97757', tuile: '#D97757' },
  gemini: { nom: 'Gemini', fichier: 'googlegemini.svg', couleur: '#8E75B2', tuile: '#8E75B2' },
  mistral: { nom: 'Mistral', fichier: 'mistralai.svg', couleur: '#FA520F', tuile: '#FA520F' },
  perplexity: { nom: 'Perplexity', fichier: 'perplexity.svg', couleur: '#1FB8CD', tuile: '#1FB8CD' },
  notion: { nom: 'Notion', fichier: 'notion.svg', couleur: '#F2EEE6', tuile: '#0D0D0D' },      // marque monochrome
  instagram: { nom: 'Instagram', fichier: 'instagram.svg', couleur: '#FF0069', tuile: '#FF0069' },
  make: { nom: 'Make', fichier: 'make.svg', couleur: '#6D00CC', tuile: '#6D00CC' },
  n8n: { nom: 'n8n', fichier: 'n8n.svg', couleur: '#EA4B71', tuile: '#EA4B71' },
};
const chemins = (f) => [...fs.readFileSync(path.join(LOGOS_DIR, f), 'utf8').matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
// logo(nom, taille, mode) : mode 'creme' (monochrome), 'marque' (vraie couleur), ou une couleur CSS
export function logo(nom, taille, mode = 'marque', o = {}) {
  const Mq = MARQUES[nom]; if (!Mq) throw new Error(`logo inconnu : ${nom}`);
  const c = mode === 'creme' ? S.creme : mode === 'marque' ? Mq.couleur : mode;
  return `<svg${o.id ? ` id="${o.id}"` : ''}${o.cls ? ` class="${o.cls}"` : ''} width="${taille}" height="${taille}" viewBox="0 0 24 24"${o.style ? ` style="${o.style}"` : ''}>`
    + chemins(Mq.fichier).map((d) => `<path d="${d}" fill="${c}"/>`).join('') + `</svg>`;
}
// fond d'une tuile teintée de la couleur de marque (sur verre sombre) ; a = force de la teinte
export function tuileTeinte(nom, a = 0.30) {
  const Mq = MARQUES[nom], rgb = rgbs(Mq.tuile);
  return `background:linear-gradient(160deg,rgba(${rgb},${a + 0.12}),rgba(${rgb},${a * 0.6})),${S.tuile};border-color:rgba(${rgb},0.75);`;
}
// capture stylisée générique (vignette bleue floutée du reel 4, pas une interface de marque)
export const captureCss = (sel) => `${sel}{background:radial-gradient(ellipse 55% 70% at 88% 20%,${S.capture.reflet}cc,${S.capture.reflet}00 70%),linear-gradient(160deg,${S.capture.haut},${S.capture.bas});}`;

// Compatibilité avec les exemples d'assemblage du labo (briques/exemples/) : dossier des polices et grain du style.
export const FONTS = path.dirname(POLICES.satoshi.src);
