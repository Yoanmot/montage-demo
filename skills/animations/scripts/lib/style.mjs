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
import { lirePolice } from './police.mjs';
import { decouper as decouperGroupes, instants as instantsGroupes } from '../../../sous-titres/scripts/groupes.mjs';

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
// Renvoie { premier, dernier, texte, debut_s, fin_s, image, fin_image, transcrit_s, image_transcrite } ou lève une erreur
// nommée. debut_s / image = l'ATTAQUE (0,1 s avant le début transcrit, attaqueMot) ; transcrit_s = le début transcrit.
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
  const a = mots[i0], b = mots[i1], at = attaqueMot(mots, i0);
  return { premier: i0, dernier: i1, texte: mots.slice(i0, i1 + 1).map((w) => w.text).join(' '),
    debut_s: at, fin_s: b.end, image: img(at), fin_image: img(b.end), transcrit_s: a.start, image_transcrite: img(a.start) };
}
// Attaque du mot n° i (ATTAQUE de commun.mjs) : 0,1 s avant son début transcrit, jamais avant le milieu du mot précédent,
// jamais avant 0. Seule fonction qui calcule l'instant où un texte animé part sur un mot (via resoudre : debut_s, image).
export function attaqueMot(mots, i) {
  const w = mots[i], p = mots[i - 1], A = S.ATTAQUE;
  let t = w.start - A.avance;
  if (p) t = Math.max(t, p.start + A.plancher * (p.end - p.start));
  return +Math.max(0, Math.min(w.start, t)).toFixed(4);
}

// Texte d'une ancre tel que les sous-titres l'écrivent : corrections et mots masqués de sous-titres.json s'il existe
// (brique sous-titres), sinon words.cut.json ; ponctuation autour des mots retirée comme dans les sous-titres.
// casse : 'telle' (comme les sous-titres, par défaut : la casse de la transcription), 'basse' ou 'haute'.
export function texteSousTitres(dossierMontage, ancre, mots, casse = 'telle') {
  const r = resoudre(ancre, mots);
  const f = path.join(dossierMontage, 'sous-titres.json');
  const R = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
  const corr = R.corrections || {}, masque = new Set();
  for (const x of R.masquer || []) { const [a, b] = [[].concat(x)[0], [].concat(x).at(-1)]; for (let k = +a; k <= +b; k++) masque.add(k); }
  const out = [];
  for (let i = r.premier; i <= r.dernier; i++) {
    if (masque.has(i)) continue;
    const t = String(corr[i] ?? mots[i].text).trim().replace(/^[«"“(\s]+/, '').replace(/[.,;:!?…»"”)\s]+$/, '');
    if (t) out.push([i, t]);
  }
  const t = out.map(([, x]) => x).join(' ');
  return casse === 'haute' ? t.toUpperCase() : casse === 'basse' ? t.toLowerCase() : t;
}
// Citations : quand Romain cite une pensée (« tu vas te dire : Mince, c'est passé vite »), le plan la marque
// (sous_titres.citations), le monteur la recopie dans sous-titres.json « citations » : [[premier, dernier], ...]
// (numéros de mots de words.cut.json). Rien ne s'affiche en plus, pas de guillemets (Yoan, 2026-11-14, retours sur v12) :
// la citation fait seulement ses propres groupes de sous-titres.
// estAffiche(i) : le mot n° i s'affiche (ni masqué, ni signe seul). Renvoie le premier et le dernier mot affichés de
// chaque citation (là où ses groupes commencent et finissent).
export function bornesCitations(R, estAffiche) {
  const premier = new Set(), dernier = new Set();
  for (const c of (R && R.citations) || []) {
    const a = +[].concat(c)[0], b = +[].concat(c).at(-1);
    const dedans = []; for (let i = a; i <= b; i++) if (estAffiche(i)) dedans.push(i);
    if (!dedans.length) continue;
    premier.add(dedans[0]); dernier.add(dedans.at(-1));
  }
  return { premier, dernier };
}
// Attaques (secondes depuis t0) de chaque mot affiché d'une ancre, dans l'ordre de texteSousTitres (un mot corrigé en
// plusieurs mots donne la même attaque à chacun) : le pavé d'une ligne de sous-titre de gabarit glisse dessus.
export function attaquesSousTitres(dossierMontage, ancre, mots, t0 = 0) {
  const r = resoudre(ancre, mots);
  const f = path.join(dossierMontage, 'sous-titres.json');
  const R = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
  const corr = R.corrections || {}, masque = new Set();
  for (const x of R.masquer || []) { const [a, b] = [[].concat(x)[0], [].concat(x).at(-1)]; for (let k = +a; k <= +b; k++) masque.add(k); }
  const out = [];
  for (let i = r.premier; i <= r.dernier; i++) {
    if (masque.has(i)) continue;
    const t = String(corr[i] ?? mots[i].text).trim().replace(/^[«"“(\s]+/, '').replace(/[.,;:!?…»"”)\s]+$/, '');
    for (const _ of t.split(/\s+/).filter(Boolean)) out.push(+Math.max(0, mots[i].start - t0).toFixed(4));
  }
  return out;
}

// ------------------------------------------------------------------ sous-titres (bloc commun : brique sous-titres et lignes « commente MOT » des CTA, tier list)
// Le style des sous-titres (SOUS_TITRES et POLICES.sousTitres de commun.mjs) est écrit UNE fois ici, en CSS et en JS,
// et posé entre deux marqueurs dans chaque page qui affiche une ligne de sous-titre : le calque st de la brique
// sous-titres et les gabarits qui portent leur propre ligne. Changer la police ou une valeur dans commun.mjs, puis
// `node scripts/maj-sous-titres.mjs` (bibliothèque) ; les calques se refont avec `sous-titres preparer` et instancier.
export function geoSousTitres({ taille = 1, position = S.SOUS_TITRES.position, pave = S.SOUS_TITRES.pave.actif } = {}) {
  const ST = S.SOUS_TITRES, pol = lirePolice(S.fichierPolice(ST.police.file));
  if (pol.capEm === null) throw new Error(`POLICE_SANS_CAPITALES ${ST.police.file} : table OS/2 trop ancienne`);
  const px = Math.round(ST.taille * W * taille), k = W / 1080;
  const cy = Math.min(0.95, Math.max(0.05, position)) * H;
  const cap = pol.capEm * px, base = cy + cap / 2, top = base - pol.ascEm * px;
  const py = ST.pave.padY * px;
  return { px, k, cap, base, top, lh: pol.ascEm + pol.descEm, fsp: ST.approche * px, padX: ST.pave.padX * px,
    pvTop: (base - cap - py - ST.pave.haut * px) - top, pvH: cap + 2 * py + ST.pave.bas * px, rayon: ST.pave.rayon * px,
    largeurMax: ST.largeurMax * W, caracteresMax: Math.round(ST.caracteresMax / taille), police: pol, taille, position,
    pave: pave !== false };
}
const f2 = (x) => (+x.toFixed(2)).toString();
export function blocSousTitres(opts = {}, prefixe = '') {
  const ST = S.SOUS_TITRES, g = geoSousTitres(opts), O = ST.ombre;
  const css = `/* SOUS-TITRES:debut (bloc écrit par scripts/lib/style.mjs depuis commun.mjs : ne pas le modifier à la main) */
@font-face{font-family:'${ST.police.family}';src:url('${prefixe}fonts/${ST.police.file.split('/').pop()}');font-weight:${ST.police.poids};font-style:normal;}
.st-l{position:absolute;left:0;top:${f2(g.top)}px;width:${W}px;text-align:center;white-space:nowrap;visibility:hidden;}
.st-in{position:relative;display:inline-block;text-align:center;font:${ST.police.poids} ${g.px}px/${f2(g.lh)} '${ST.police.family}';color:${ST.couleur};
  letter-spacing:0;padding-right:${f2(-g.fsp)}px;text-transform:none;}
.st-in span{letter-spacing:${f2(g.fsp)}px;}
.st-o{position:absolute;left:0;top:0;color:rgba(0,0,0,${O.texte});-webkit-text-stroke:${f2(2 * O.bord * g.k)}px rgba(0,0,0,${O.bordure});
  paint-order:stroke fill;filter:blur(${f2(O.flouCss * g.k)}px);}
.st-t{position:relative;}
.st-pv{position:absolute;left:0;width:0;top:${f2(g.pvTop)}px;height:${f2(g.pvH)}px;background:${ST.pave.couleur};border-radius:${ST.pave.rayon}em;}
/* SOUS-TITRES:fin */`;
  const js = `// SOUS-TITRES:debut (bloc écrit par scripts/lib/style.mjs depuis commun.mjs : ne pas le modifier à la main)
const STG = ${JSON.stringify({ padX: +g.padX.toFixed(2), fsp: +g.fsp.toFixed(2), pvTop: +g.pvTop.toFixed(2), lhPx: +(g.lh * g.px).toFixed(2), glisse: ST.glisse, entree: ST.entree.duree, montee: +(ST.entree.montee * g.k).toFixed(2), sortie: ST.sortie, pave: g.pave })};
const SousTitres = {
  // Construit la ligne dans el (ombre, pavé, texte) avec les mots donnés, ou ceux de son texte (un élément enfant = un mot).
  // coupe (réglage « volume », lignes 2) : indice du premier mot de la deuxième ligne ; le bloc reste centré sur la place
  // des sous-titres (remonté d'une demi-ligne).
  ligne(el, mots, coupe) {
    if (!mots) { mots = []; for (const n of el.childNodes) { if (n.nodeType === 3) mots.push(...n.nodeValue.split(/[ \\t\\n\\r]+/).filter(Boolean)); else if (n.textContent.trim()) mots.push(n.textContent.trim()); } }
    el.classList.add('st-l'); el.textContent = '';
    const mk = (c) => { const d = document.createElement('div'); d.className = c; return d; };
    const inn = mk('st-in'), o = mk('st-o'), pv = mk('st-pv'), t = mk('st-t');
    o.dataset.ombre = '1';
    mots.forEach((w, i) => { for (const c of [o, t]) { if (i) c.append(i === coupe ? document.createElement('br') : ' '); const s = document.createElement('span'); s.textContent = w; c.append(s); } });
    if (coupe) el.style.marginTop = (-STG.lhPx / 2) + 'px';
    inn.append(o, pv, t); el.append(inn);
    return { el, pv, spans: [...t.children] };
  },
  // pavé sous le mot i : de son bord gauche - padX à son bord droit + padX (la dernière lettre sans son approche)
  _g(L, i) { return { left: () => L.spans[i].offsetLeft - STG.padX, top: () => L.spans[i].offsetTop + STG.pvTop, width: () => L.spans[i].offsetWidth - STG.fsp + 2 * STG.padX }; },
  // sans pavé (STG.pave false, réglage « pave » de sous-titres.json) : le pavé n'est jamais montré, sauf posé de force
  // (le MOT d'un CTA : il marque le mot à écrire en commentaire)
  poser(tl, L, i, t, force) {
    if (!STG.pave && !force) { L.pv.style.display = 'none'; return; }
    if (!STG.pave) tl.set(L.pv, { display: 'block' }, t);
    tl.set(L.pv, this._g(L, i), t);
  },
  glisser(tl, L, i, t) { if (STG.pave) tl.to(L.pv, { ...this._g(L, i), duration: STG.glisse, ease: 'none', immediateRender: false }, t); },
  // entrée du premier groupe après un blanc : monte de 14 px en fondu ; sortie en fondu avant un blanc
  monter(tl, el, t) { tl.fromTo(el, { y: STG.montee, opacity: 0 }, { y: 0, opacity: 1, duration: STG.entree, ease: 'none', immediateRender: false }, t); },
  sortir(tl, el, t) { tl.to(el, { opacity: 0, duration: STG.sortie, ease: 'none', immediateRender: false }, t - STG.sortie); },
  // ligne d'un gabarit (#st, #st0…) : pavé sur son premier mot dès qu'elle s'affiche, puis sur chaque mot à son attaque
  // (data-attaques, secondes du calque, écrit par instancier.mjs) ; glisse : [indice du mot, instant] en plus (CTA).
  gabarit(tl, el, glisses = []) {
    const L = this.ligne(el);
    this.poser(tl, L, 0, 0);
    const at = (el.dataset.attaques || '').split(',').filter(Boolean).map(Number);
    at.forEach((t, i) => { if (i > 0 && i < L.spans.length) this.glisser(tl, L, i, t); });
    for (const [i, t] of glisses) { const k = i < 0 ? L.spans.length + i : i; if (STG.pave) this.glisser(tl, L, k, t); else this.poser(tl, L, k, t, true); }
    return L;
  },
};
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { for (const k in (window.__timelines || {})) window.__timelines[k].invalidate(); });
// SOUS-TITRES:fin`;
  return { css, js, geo: g };
}
// Remplace les deux blocs SOUS-TITRES d'une page (calque ou gabarit) par ceux du style actuel.
export function poserBlocSousTitres(html, opts = {}, prefixe = '') {
  const b = blocSousTitres(opts, prefixe);
  const rc = /\/\* SOUS-TITRES:debut[\s\S]*?SOUS-TITRES:fin \*\//, rj = /\/\/ SOUS-TITRES:debut[\s\S]*?\/\/ SOUS-TITRES:fin/;
  if (!rc.test(html) || !rj.test(html)) throw new Error('BLOC_SOUS_TITRES_ABSENT : la page n\'a pas ses deux marqueurs SOUS-TITRES:debut / SOUS-TITRES:fin');
  return html.replace(rc, () => b.css).replace(rj, () => b.js);
}
// Une phrase affichée EN SOUS-TITRES par un effet (phrase du bas du plein écran puzzle, Yoan 2026-11-14 : « le
// comportement normal des sous-titres ») : mêmes groupes de 1 à 4 mots et mêmes instants que la brique sous-titres
// (groupes.mjs), découpés sur la largeur réelle du texte affiché. ancre = « de-a » (« w109-w133 ») ou citation ;
// casse : 'telle' ou 'haute' (tout en capitales : la découpe se mesure en capitales) ; opts = taille, position (comme
// sous-titres.json). Renvoie { groupes: [{ mots: [{ w, s, i }], t0, t1, monte, sortie }], geo } en secondes de la vidéo
// coupée ; le calque les pose avec le bloc SOUS-TITRES (SousTitres.ligne / monter / sortir).
export function groupesSousTitres(dossierMontage, ancre, mots, { casse = 'telle', ...opts } = {}) {
  const r = resoudre(ancre, mots);
  const f = path.join(dossierMontage, 'sous-titres.json');
  const R = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
  const corr = R.corrections || {}, masque = new Set();
  for (const x of R.masquer || []) { const [a, b] = [[].concat(x)[0], [].concat(x).at(-1)]; for (let k = +a; k <= +b; k++) masque.add(k); }
  const nu = (t) => String(t).trim().replace(/^[«"“(\s]+/, '').replace(/[.,;:!?…»"”)\s]+$/, '');
  const liste = [];
  for (let i = r.premier; i <= r.dernier; i++) {
    if (masque.has(i)) continue;
    const brut = String(corr[i] ?? mots[i].text), w = nu(brut);
    if (!w) { const d = liste.at(-1); if (d) d.brut += brut.trim(); continue; }
    liste.push({ i, w: casse === 'haute' ? w.toUpperCase() : w, s: mots[i].start, e: mots[i].end, brut: brut.trim() });
  }
  const ST = S.SOUS_TITRES, G = geoSousTitres({ ...opts, pave: false });
  const largeur = (s) => { const nb = [...s].length - (s.split(' ').length - 1); return s ? G.police.avance(s, G.px, true) + G.fsp * Math.max(0, nb - 1) : 0; };
  const groupes = instantsGroupes(decouperGroupes(liste, largeur, ST, G), ST);
  // le premier groupe ne monte en fondu que s'il suit un blanc dans la vidéo (comme dans la brique), pas parce qu'il est
  // le premier de l'extrait
  if (groupes.length && r.premier > 0) groupes[0].monte = mots[r.premier].start - mots[r.premier - 1].end >= ST.pause;
  return { groupes, geo: G, largeur };
}
// Réglages taille et position des sous-titres de la vidéo (sous-titres.json), pour que les lignes des gabarits suivent.
export function reglagesSousTitres(dossierMontage) {
  const f = dossierMontage && path.join(dossierMontage, 'sous-titres.json');
  const R = f && fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
  return { taille: R.taille ?? 1, position: R.position ?? S.SOUS_TITRES.position, pave: R.pave ?? S.SOUS_TITRES.pave.actif };
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

// ------------------------------------------------------------------ police unique (bloc commun : gabarits et calques)
// Une seule police dans toute la vidéo (Yoan, 2026-11-14) : POLICES.sousTitres, déclinée en .ti (capitales) et .tx
// (minuscules) depuis POLICES.titre et POLICES.texte. Écrite UNE fois ici et posée entre les marqueurs POLICE:debut /
// POLICE:fin de chaque gabarit (node scripts/maj-sous-titres.mjs après un changement de commun.mjs) et dans le socle des
// effets sur mesure (CSS_SOCLE). Pas de chiffres en chasse fixe sur .ti : dans Inter, tabular-nums élargit aussi des
// lettres (mesuré : +2 % sur « PERDRE DU GRAS ») ; les chiffres qui défilent portent la classe .num.
export function blocPolice(prefixe = '') {
  const T = P.titre, X = P.texte;
  return `/* POLICE:debut (bloc écrit par scripts/lib/style.mjs depuis POLICES de commun.mjs : ne pas le modifier à la main) */
@font-face{font-family:'${T.family}';src:url('${prefixe}fonts/${T.file}');font-weight:${T.poids};font-style:normal;}
.ti{font-family:'${T.family}';font-weight:${T.poids};text-transform:uppercase;line-height:${T.interligne};
  letter-spacing:${T.approche};margin:0;}
.tx{font-family:'${X.family}';font-weight:${X.poids};line-height:${X.interligne};letter-spacing:${X.approche};}
/* POLICE:fin */`;
}
// Remplace le bloc POLICE d'une page par celui du style actuel ; si la police a changé, son nom est remplacé partout
// dans la page (styles en ligne des gabarits : font:900 46px/68px 'Inter Black').
export function poserBlocPolice(html, prefixe = '') {
  const r = /\/\* POLICE:debut[\s\S]*?POLICE:fin \*\//;
  const m = html.match(r);
  if (!m) throw new Error('BLOC_POLICE_ABSENT : la page n\'a pas ses marqueurs POLICE:debut / POLICE:fin');
  const ancienne = (m[0].match(/font-family:'([^']+)'/) || [])[1];
  let out = html.replace(r, () => blocPolice(prefixe));
  if (ancienne && ancienne !== P.titre.family) out = out.split(`'${ancienne}'`).join(`'${P.titre.family}'`);
  return out;
}

// ------------------------------------------------------------------ socle CSS (chemins relatifs au dossier du calque)
export const CSS_SOCLE = `
${blocPolice('')}
@font-face{font-family:'${P.natif.family}';src:url('fonts/${P.natif.file}');font-weight:100 900;font-style:normal;}
html,body{margin:0;background:transparent;}
#root{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:transparent;}
.a{position:absolute;white-space:nowrap;}
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
  font:${P.titre.poids} ${S.ONGLET.taille}px/${S.ONGLET.interligne}px '${P.titre.family}';text-transform:uppercase;letter-spacing:${S.ONGLET.approche};
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
  // Montée du bas en saccade 12 i/s (MONTEE_ACCENT de commun.mjs) : accent rare sur une phrase, jamais l'apparition des
  // sous-titres enrichis ni des pleins écrans texte (STYLE.md). t = attaque du mot en s depuis le début du calque ; le
  // mouvement part MONTEE_ACCENT.avance avant.
  accent(sel, t, nom) {
    this.js += S.monteeAccentJs(sel, t - S.MONTEE_ACCENT.avance);
    this.attendus.push({ nom: nom || sel, image: Math.max(0, Math.floor((t - S.MONTEE_ACCENT.avance) * FPS + 1e-6) + 1) });
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

// ------------------------------------------------------------------ case cochée (CASE_COCHEE de commun.mjs)
// SVG d'une case de côté « cote » (trait compris), bord « ep » couleur « trait », coche couleur « fond » (celle du fond
// de l'écran) ; id = préfixe des éléments (#<id>c case, #<id>k coche). caseCocheeJs(id, t) : remplit puis trace à t (s).
export function caseCocheeSvg(id, cote, ep, trait, fond) {
  const C = S.CASE_COCHEE, r = Math.min(S.RAYONS.vignette, cote / 4), h = ep / 2, inner = cote - ep;
  const pt = ([x, y]) => `${(h + x * inner).toFixed(1)} ${(h + y * inner).toFixed(1)}`;
  return `<svg width="${cote}" height="${cote}" viewBox="0 0 ${cote} ${cote}" style="overflow:visible">`
    + `<rect id="${id}c" x="${h}" y="${h}" width="${inner}" height="${inner}" rx="${r}" fill="${trait}" fill-opacity="0" stroke="${trait}" stroke-width="${ep}"/>`
    + `<path id="${id}k" d="M ${C.coche.map(pt).join(' L ')}" fill="none" stroke="${fond}" stroke-width="${(C.epCoche * cote).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>`;
}
export function caseCocheeJs(id, t) {
  const C = S.CASE_COCHEE;
  return `tl.to('#${id}c', { attr: { 'fill-opacity': 1 }, duration: ${C.remplir}, ease: '${S.COURBES.entree}' }, ${f4(t)});\n`
    + `tl.to('#${id}k', { attr: { 'stroke-dashoffset': 0 }, duration: ${C.tracer}, ease: '${S.COURBES.entree}' }, ${f4(t + C.remplir * 0.5)});\n`;
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
  pose: () => ({ fichier: S.SONS.pose.fichier, niveau: { rms_db_sous_voix: S.SONS.pose.ecartRmsDb } }),
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
const POLICES_FICHIERS = [...new Set([...Object.values(P).flatMap((p) => [p.file, p.ofl]), 'LiberationSans-Regular.ttf', 'OFL-liberation.txt'])];
export function stager(dc) {
  fs.mkdirSync(path.join(dc, 'fonts'), { recursive: true });
  fs.mkdirSync(path.join(dc, 'vendor'), { recursive: true });
  fs.mkdirSync(path.join(dc, 'images'), { recursive: true });
  for (const f of POLICES_FICHIERS) fs.copyFileSync(S.fichierPolice(f), path.join(dc, 'fonts', f));
  fs.copyFileSync(path.join(BIB, 'vendor', 'gsap.min.js'), path.join(dc, 'vendor', 'gsap.min.js'));
  fs.copyFileSync(path.join(BIB, 'images', 'image-a-fournir.svg'), path.join(dc, 'images', 'image-a-fournir.svg'));
}
// Les photos manquantes : chaque <img> qui garde l'emplacement dit dans data-a-fournir ce qu'il faut demander à Romain.
export function photosAFournir(html) {
  return [...html.matchAll(/<img[^>]*src="images\/image-a-fournir\.svg"[^>]*data-a-fournir="([^"]*)"/g)].map((m) => m[1]);
}
// Mots repris : numéros (12), ancres numérotées (« w12 », « w12-w15 ») ou plages [12, 15] -> numéros triés, sans doublon.
export function motsRepris(liste) {
  const out = new Set();
  for (const x of liste || []) {
    if (Array.isArray(x)) { for (let k = +x[0]; k <= +x.at(-1); k++) out.add(k); continue; }
    const m = String(x).match(/^w?(\d+)(?:-w?(\d+))?$/i);
    if (!m) throw new Error(`MOTS_REPRIS « ${x} » : un numéro de mot (12, « w12 », « w12-w15 »)`);
    for (let k = +m[1]; k <= +(m[2] ?? m[1]); k++) out.add(k);
  }
  return [...out].sort((a, b) => a - b);
}
// entree : { id, demande, debut (image de la vidéo coupée), images, couche, ordre, plan?, sons_suggeres?, attendus?,
//            origine : { gabarit } | { sur_mesure : intention }, params?, suit_ouverture? (titre qui suit le dézoom),
//            mots_repris? (mots dits que le calque affiche en texte : voir motsRepris) }
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
  // mots dits que le calque affiche (numéros de words.cut.json) : la brique sous-titres ne les affiche pas (chaque mot dit
  // n'est vu qu'une fois, Yoan 2026-11-14), verifier.mjs contrôle qu'aucun mot ne s'affiche deux fois
  const repris = motsRepris(entree.mots_repris);
  if (repris.length) c.mots_repris = repris;
  c.sons_suggeres = (entree.sons_suggeres || []).map((x) => ({ ...x, calque: entree.id }));
  const fiche = { ...c, demande: entree.demande, origine: entree.origine, attendus: entree.attendus || [],
    a_fournir: photosAFournir(html), params: entree.params || null, ecrit_le: new Date().toISOString().slice(0, 10) };
  // titre qui suit le dézoom d'ouverture : verifier.mjs contrôle sa zone sûre une fois le dézoom fini
  if (entree.suit_ouverture) fiche.suit_ouverture = true;
  // entrées « coup de poing » (échelle 1,3 -> 1, sous-titres enrichis) : images du calque où la zone sûre peut être
  // dépassée, voulu (verifier.mjs les excepte)
  if (entree.entrees_echelle && entree.entrees_echelle.length) fiche.entrees_echelle = entree.entrees_echelle;
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
