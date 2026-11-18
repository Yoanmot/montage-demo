// Les gestes du style qui se dessinent en HyperFrames, en UNE version, toutes valeurs lues dans style/style.json.
// Chaque fonction rend une part { css, html, js } à assembler avec page() (style.mjs) ; p préfixe les ids, les instants
// sont en secondes depuis le début du calque. Rien ici ne connaît une rush ou un reel : textes, instants, positions
// (haut des cheveux, centre du visage) arrivent en paramètres.
// Sources (code verrouillé du Style Lab) : briques/gabarits/commun.mjs (sous-titres, fond, faisceau), build.r9/r10 (plein
// écran à crochets), temoin/pipeline-r8/build.mjs (plein écran une ligne, étiquette, CTA caméra), build.r6.mjs (bascules,
// B-roll, CTA fond, mot derrière la tête), cartes/hook-titre.r2-04a (titre du hook).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encre, boiteCrochets } from '../../briques/encre/encre.mjs';
import { STYLE, C, F, f3, rgbs, RGB_D, halo, POLICES } from './style.mjs';
import { fondC, faisceauJs, faisceaux, FAISCEAU, resserreJs, groupes, sousTitres } from './commun.mjs';

export { groupes, sousTitres, faisceaux, faisceauJs, FAISCEAU, fondC };
const W = F.largeur, H = F.hauteur, ips = F.ips;
const ET = STYLE.entrees.texte;
const fam = (k) => POLICES[k].family;
const flouEntree = (sel, t, o = {}) => `tl.fromTo('${sel}', { opacity: 0, filter: 'blur(${o.flou ?? ET.flou}px)'${o.y ? `, y: ${o.y}` : ''} }, { opacity: 1, filter: 'blur(0px)'${o.y ? ', y: 0' : ''}, duration: ${o.d ?? ET.duree}, ease: '${o.ease ?? ET.courbe}', immediateRender: true }, ${f3(t)});\n`;
const coinsHtml = (id, cls = 'coin') => ['tl', 'tr', 'bl', 'bd'].map((c) => `<span class="${cls}" id="${id}-${c}"><i class="${c} h"></i><i class="${c} v"></i></span>`).join('');
const coinsCss = (sel, cr) => `
${sel}{position:absolute;pointer-events:none;}
${sel} i{position:absolute;display:block;background:${C.dore};}
${sel} .h{width:${cr.bras}px;height:${cr.trait}px;} ${sel} .v{width:${cr.trait}px;height:${cr.bras}px;}
${sel} .tl{left:0;top:0;} ${sel} .tr{right:0;top:0;} ${sel} .bl{left:0;bottom:0;} ${sel} .bd{right:0;bottom:0;}
${sel} .coin{position:absolute;left:0;top:0;right:0;bottom:0;}`;

// ---------------------------------------------------------------------------------------------------------------
// Fond granuleux r4-01c seul, plein cadre, visible de t0 à t1
// ---------------------------------------------------------------------------------------------------------------
export function fond(p, t0, t1) {
  const f = fondC(`${p}f`, t0, t1);
  return { css: f.css + `\n#${p}fd{position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:hidden;opacity:0;background:${C.fondFS};}`,
    html: `  <div id="${p}fd">${f.html}</div>\n`,
    js: f.js + `tl.set('#${p}fd', { opacity: 1 }, ${f3(t0)});\ntl.set('#${p}fd', { opacity: 0 }, ${f3(t1)});\n` };
}

// ---------------------------------------------------------------------------------------------------------------
// Plein écran à mots (r7-02b / r8-01a et r8-01c / r10-01a). Fond r4-01c entre deux faisceaux (T1 aller, T2 retour :
// les faisceaux eux-mêmes se posent avec faisceaux([T1, T2])). lignes : [[[MOT, instant, doré?], ...], ...].
// variante 'seule'  : une ligne à la fois au centre, chaque ligne remplace la précédente (sortie nette en 2 images) ;
// variante 'milieu' : une ligne à la fois jusqu'au mot doré ; la ligne d'avant remonte d'un cran, le doré reste au milieu,
//                     la suite s'empile dessous ; crochets sur le mot doré (centrés sur les capitales, 11 px).
// ---------------------------------------------------------------------------------------------------------------
const PE = STYLE.pleinEcran;
export function geometriePlein(L, o = {}) {
  const cr = PE.crochets, marge = o.marge ?? cr.marge, mode = o.mode ?? cr.mode;
  const kd = L.findIndex((l) => l.some(([, , k]) => k));
  const centre = Math.round(PE.centreY - PE.ligne / 2);
  if (kd < 0) return { kd, centre, ecartHaut: 0, ecartBas: 0 };
  const motK = L[kd].find(([, , k]) => k)[0];
  const bc = boiteCrochets(motK, PE.taille, 1, PE.interlettrage, marge, cr.trait, mode);
  const spanTop = centre + (PE.ligne - PE.taille) / 2;
  const crHautExt = spanTop + bc.top, crBasExt = spanTop + PE.taille - bc.bottom;
  const G = Math.max(cr.ecartMin, marge);
  const ink = (li) => {
    const e = L[li].map(([w]) => encre(w, PE.taille, 1, PE.interlettrage));
    return { haut: (PE.ligne - PE.taille) / 2 + Math.min(...e.map((x) => x.haut)), bas: (PE.ligne + PE.taille) / 2 - Math.min(...e.map((x) => x.bas)) };
  };
  const yAvant = centre - PE.ligne, yApres = centre + PE.ligne;
  const ecartHaut = kd > 0 ? Math.max(0, Math.ceil(yAvant + ink(kd - 1).bas + G - crHautExt)) : 0;
  const ecartBas = kd < L.length - 1 ? Math.max(0, Math.ceil(crBasExt + G - (yApres + ink(kd + 1).haut))) : 0;
  return { kd, motK, centre, bc, crHautExt, crBasExt, ecartHaut, ecartBas };
}
export function pleinEcranMots(p, o) {
  const L = o.lignes, T1 = o.T1, T2 = o.T2, variante = o.variante ?? 'seule';
  const mil = variante === 'milieu', cro = o.crochets ?? mil;
  const geo = geometriePlein(L, o);
  const { kd, centre } = geo;
  if (mil && kd < 0) throw new Error('plein écran « milieu » : il faut un mot doré');
  const ecartHaut = mil ? geo.ecartHaut : 0, ecartBas = mil ? geo.ecartBas : 0;
  const f = fondC(`${p}f`, T1 - PE.fondAvant, T2 + PE.fondApres);
  const cr = PE.crochets;
  let css = f.css + `
#${p}fs{position:absolute;left:0;top:0;width:${W}px;height:${H}px;opacity:0;overflow:hidden;background:${C.fondFS};z-index:${PE.z};}
.${p}li{position:absolute;left:${PE.gauche}px;width:${PE.largeur}px;height:${PE.ligne}px;display:flex;align-items:center;justify-content:center;
  font-family:'${fam(PE.police)}';font-weight:900;font-size:${PE.taille}px;line-height:1;text-transform:uppercase;color:${C.blanc};
  letter-spacing:${PE.interlettrage}em;text-shadow:${PE.ombre};white-space:nowrap;}
.${p}w{display:inline-block;opacity:0;margin:0 ${STYLE.sousTitres.espace}em;}
.${p}k{color:${C.dore};text-shadow:${halo()};}`;
  if (cro && kd >= 0) {
    const bc = geo.bc;
    css += `\n.${p}kw{position:relative;margin:0 calc(${STYLE.sousTitres.espace}em + ${Math.max(0, -bc.right).toFixed(1)}px) 0 calc(${STYLE.sousTitres.espace}em + ${Math.max(0, -bc.left).toFixed(1)}px);}`
      + coinsCss(`.${p}cr`, cr) + `\n.${p}cr{left:${bc.left}px;right:${bc.right}px;top:${bc.top}px;bottom:${bc.bottom}px;}`;
  }
  let html = '', js = f.js + `tl.set('#${p}fs', { opacity: 1 }, ${f3(T1)});\ntl.set('#${p}fs', { opacity: 0 }, ${f3(T2 + 0.001)});\n`;
  const debut = (li) => L[li][0][1] - ET.avance;
  L.forEach((ligne, li) => {
    const y = !mil || li <= kd ? centre : centre + (li - kd) * PE.ligne + ecartBas;
    html += `<div class="${p}li" id="${p}l${li}" style="top:${y}px">` + ligne.map(([w, , k], wi) => {
      const id = `${p}w${li}${wi}`;
      if (k && cro) return `<span class="${p}w ${p}kw" id="${id}"><span class="${p}k" id="${id}t">${w}</span><span class="${p}cr" id="${id}cr">${coinsHtml(`${id}cr`)}</span></span>`;
      return `<span class="${p}w${k ? ` ${p}k` : ''}" id="${id}">${w}</span>`;
    }).join('') + `</div>`;
    ligne.forEach(([, t, k], wi) => {
      const id = `${p}w${li}${wi}`, t0 = t - ET.avance;
      if (k && cro) js += `tl.set('#${id}', { opacity: 1 }, ${f3(t0)});\n` + resserreJs(`${id}cr`, t0, cr.D) + flouEntree(`#${id}t`, t0);
      else js += flouEntree(`#${id}`, t0);
    });
    const reste = mil && (li >= kd || li === kd - 1);
    if (li < L.length - 1 && !reste) js += `tl.to('#${p}l${li}', { opacity: 0, duration: ${PE.sortieLigne}, ease: 'none' }, ${f3(debut(li + 1) - PE.sortieLigne)});\n`;
    if (mil && li === kd - 1) js += `tl.to('#${p}l${li}', { y: ${-(PE.ligne + ecartHaut)}, duration: ${PE.remontee.duree}, ease: '${PE.remontee.courbe}' }, ${f3(debut(kd) - PE.sortieLigne)});\n`;
  });
  html = `  <div id="${p}fs">${f.html}${html}</div>\n`;
  return { css, html, js, geometrie: geo };
}

// ---------------------------------------------------------------------------------------------------------------
// Demi-écran (r3-03a, r3-03c, r11-01b) : le fond r4-01c descend (courbe banque) et pousse le visage (la caméra suit la
// même loi : camera.demi_decalage) ; le contenu vit en haut et descend avec le fond ; frontière en fondu de 260 px.
// o = { t0, t1, contenu: {css, html, js}, courbe?, bascule?: { type: 'pousse'|'faisceau', t }, sortie?: 'remonte'|'coupe' }
//   t0 < 0 : le demi-écran est déjà en place au début du calque.
//   bascule 'pousse'   : le fond s'agrandit vers le bas et chasse le visage (0,5 s, power2.inOut), le contenu descend ;
//   bascule 'faisceau' : tout passe en plein écran à l'image pleine du faisceau (poser aussi faisceaux([t])).
//   sortie 'remonte' (défaut) : le fond remonte en 0,07 s ; 'coupe' : coupe franche à t1 (retour caméra après une bascule).
// ---------------------------------------------------------------------------------------------------------------
const DE = STYLE.demiEcran;
const easeBanque = (T) => `((T) => (p) => { const x = Math.min(1, Math.max(0, p)) * (T.length - 1), i = Math.min(T.length - 2, Math.floor(x)); return T[i] + (T[i + 1] - T[i]) * (x - i); })(${JSON.stringify(T)})`;
export function demiEcran(p, o) {
  const Hh = DE.hauteur, courbe = o.courbe ?? DE.courbe, sortie = o.sortie ?? (o.bascule ? 'coupe' : 'remonte');
  const tab = DE.courbes[courbe], ease = tab ? easeBanque(tab.table) : `'${courbe}'`, d = tab ? tab.duree : 0.7;
  const fin = o.t1 + (sortie === 'remonte' ? DE.sortie : 0);
  const f = fondC(`${p}f`, Math.max(0, o.t0), fin + 0.05);
  const mk = `linear-gradient(to bottom,#000 0,#000 calc(100% - ${DE.fondu}px),rgba(0,0,0,0) 100%)`;
  const css = f.css + `
#${p}scene{position:absolute;left:0;top:0;width:${W}px;height:${H}px;z-index:10;opacity:0;}
#${p}voile{position:absolute;left:0;top:0;width:${W}px;height:${Hh}px;overflow:hidden;-webkit-mask-image:${mk};mask-image:${mk};}
#${p}haut{position:absolute;left:0;top:0;width:${W}px;height:${H}px;}` + o.contenu.css;
  const html = `  <div id="${p}scene"><div id="${p}voile">${f.html}</div><div id="${p}haut">${o.contenu.html}</div></div>\n`;
  let js = f.js;
  if (o.t0 >= 0) {
    js += `tl.set('#${p}scene', { opacity: 1 }, ${f3(o.t0)});\n`;
    js += `tl.fromTo('#${p}voile, #${p}haut', { y: ${-Hh} }, { y: 0, duration: ${d}, ease: ${ease}, immediateRender: true }, ${f3(o.t0)});\n`;
  } else js += `tl.set('#${p}scene', { opacity: 1 }, 0);\n`;
  const dy = DE.champPleinY - DE.champSplitY;
  if (o.bascule?.type === 'pousse') {
    js += `tl.to('#${p}voile', { height: ${H + 280}, duration: ${DE.bascule.duree}, ease: '${DE.bascule.courbe}' }, ${f3(o.bascule.t)});\n`;
    js += `tl.to('#${p}haut', { y: ${dy}, duration: ${DE.bascule.duree}, ease: '${DE.bascule.courbe}' }, ${f3(o.bascule.t)});\n`;
  } else if (o.bascule?.type === 'faisceau') {
    js += `tl.set('#${p}voile', { height: ${H + 280} }, ${f3(o.bascule.t + 0.001)});\ntl.set('#${p}haut', { y: ${dy} }, ${f3(o.bascule.t + 0.001)});\n`;
  }
  if (sortie === 'remonte') {
    js += `tl.to('#${p}voile, #${p}haut', { y: ${-Hh}, duration: ${DE.sortie}, ease: 'none' }, ${f3(o.t1)});\n`;
    js += `tl.set('#${p}scene', { opacity: 0 }, ${f3(o.t1 + DE.sortie + 0.001)});\n`;
  } else js += `tl.set('#${p}scene', { opacity: 0 }, ${f3(o.t1 - 0.001)});\n`;
  return { css, html, js: js + o.contenu.js, flashs: o.bascule?.type === 'faisceau' ? [o.bascule.t] : [] };
}
// Contenu du demi-écran des cartes r3-03 : un champ de chat en verre sombre qui se tape (frappe muette).
// o = { texte, entree (instant d'entrée du champ), debutFrappe, fin, placeholder, modele, graine, pas }
export function champChat(p, o) {
  const ch = DE.champ, Wc = ch.largeur, Hc = ch.hauteur;
  const pas = o.pas ?? { espace: 0.13, lettre: 0.07, alea: 0.05 };
  let sd = o.graine ?? 4242; const rnd = () => { sd = (sd * 1103515245 + 12345) % 2147483648; return sd / 2147483648; };
  let t = o.debutFrappe; const touches = [];
  for (const c of o.texte) { touches.push([c, +t.toFixed(3)]); t += (c === ' ' ? pas.espace : pas.lettre) + rnd() * pas.alea; }
  const css = `
#${p}champ{position:absolute;left:${(W - Wc) / 2}px;top:${DE.champSplitY - Hc / 2}px;width:${Wc}px;height:${Hc}px;box-sizing:border-box;
  border-radius:${ch.rayon}px;background:${ch.fond};border:${ch.bord};
  box-shadow:${ch.ombre};backdrop-filter:blur(${ch.flou}px);-webkit-backdrop-filter:blur(${ch.flou}px);
  font-family:'${fam('inter')}';color:${C.blanc};}
#${p}txt{position:absolute;left:34px;right:34px;top:30px;font-size:${ch.texte}px;line-height:1.25;font-weight:450;white-space:pre-wrap;letter-spacing:-0.005em;}
#${p}ph{position:absolute;left:0;top:0;color:rgba(${rgbs(C.blanc)},0.38);}
.${p}c{display:none;}
#${p}caret{display:inline-block;width:3px;height:44px;margin-left:2px;vertical-align:-7px;background:${C.blanc};}
#${p}plus{position:absolute;left:28px;bottom:24px;width:50px;height:50px;border-radius:25px;border:1.5px solid rgba(${rgbs(C.blanc)},0.22);
  color:rgba(${rgbs(C.blanc)},0.7);font-size:36px;line-height:46px;text-align:center;font-weight:300;}
#${p}modele{position:absolute;right:104px;bottom:36px;font-size:26px;color:rgba(${rgbs(C.blanc)},0.5);font-weight:500;}
#${p}envoi{position:absolute;right:28px;bottom:24px;width:54px;height:54px;border-radius:27px;background:${C.dore};opacity:0.45;}
#${p}envoi svg{position:absolute;left:13px;top:13px;}`;
  const html = `<div id="${p}champ"><div id="${p}txt"><span id="${p}ph">${o.placeholder ?? 'Écris à ton assistant…'}</span>`
    + touches.map(([c], i) => `<span class="${p}c" id="${p}c${i}">${c}</span>`).join('') + `<span id="${p}caret"></span></div>`
    + `<div id="${p}plus">+</div><div id="${p}modele">${o.modele ?? 'Assistant'}</div>`
    + `<div id="${p}envoi"><svg width="28" height="28" viewBox="0 0 28 28"><path d="M14 22V6M7 13l7-7 7 7" stroke="#1A120C" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>`;
  let js = `tl.fromTo('#${p}champ', { opacity: 0, filter: 'blur(${ET.flou}px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.3, ease: '${ET.courbe}' }, ${f3(o.entree)});\n`;
  js += `tl.set('#${p}ph', { opacity: 0 }, ${touches[0][1]});\n`;
  touches.forEach(([, tt], i) => { js += `tl.set('#${p}c${i}', { display: 'inline' }, ${tt});\n`; });
  js += `tl.set('#${p}envoi', { opacity: 1 }, ${touches[0][1]});\n`;
  const finT = touches[touches.length - 1][1];
  for (let tt = 0.0; tt < o.fin; tt += 0.5) {
    if (tt > touches[0][1] - 0.5 && tt < finT + 0.3) continue;
    js += `tl.set('#${p}caret', { opacity: 0 }, ${(tt + 0.25).toFixed(3)});\ntl.set('#${p}caret', { opacity: 1 }, ${(tt + 0.5).toFixed(3)});\n`;
  }
  return { css, html, js, touches };
}

// ---------------------------------------------------------------------------------------------------------------
// Hook (r2-04a, r7-03b) : titre Anton sur deux lignes (calque à perforer ensuite par le masque de la tête,
// detourage/perforer) et étiquette à hauteur de poitrine (calque devant, non troué).
// titre : lignes = [[[MOT, instant d'entrée, doré?], ...], [...]] (deux lignes, centrées).
// ---------------------------------------------------------------------------------------------------------------
const HK = STYLE.hook;
export function hookTitre(p, o) {
  const T = HK.titre, E = STYLE.entrees.hook;
  const css = `
.${p}l{position:absolute;left:0;width:${W}px;text-align:center;white-space:pre;
  font-family:'${fam(T.police)}';font-weight:400;font-size:${T.taille}px;line-height:1;color:${C.blanc};
  text-shadow:${T.ombre};}
.${p}w{display:inline-block;opacity:0;}
.${p}k{color:${C.dore};text-shadow:${halo()};}`;
  let html = '', js = '';
  o.lignes.forEach((ligne, li) => {
    html += `  <div class="${p}l" style="top:${T.tops[li]}px">` + ligne.map(([w, , k], wi) => `<span class="${p}w${k ? ` ${p}k` : ''}" id="${p}h${li}${wi}">${w}</span>`).join(' ') + `</div>\n`;
    ligne.forEach(([, t], wi) => { js += flouEntree(`#${p}h${li}${wi}`, t, { flou: E.flou, d: E.duree }); });
  });
  return { css, html, js };
}
export function etiquetteHook(p, o) {
  const e = HK.etiquette, t = o.t ?? e.entree.t;
  const css = `
#${p}eq{position:absolute;left:0;top:${e.centreY - e.hauteur / 2}px;width:${W}px;height:${e.hauteur}px;display:flex;justify-content:center;z-index:${e.z};}
#${p}eb{position:relative;height:${e.hauteur}px;opacity:0;}
#${p}ef{position:absolute;left:0;top:0;right:0;bottom:0;background:${e.fond};}
#${p}et{position:relative;height:${e.hauteur}px;line-height:${e.hauteur}px;padding:0 ${e.padX}px 0 ${e.padX + e.taille * e.interlettrage}px;font-family:'${fam('satoshi')}';font-weight:900;font-size:${e.taille}px;
  letter-spacing:${e.interlettrage}em;color:${C.creme};text-transform:uppercase;white-space:nowrap;text-shadow:${e.ombre};}
#${p}ecad{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;}
#${p}ecad rect{fill:none;stroke:${C.dore};stroke-width:${e.cadre};}`;
  const html = `  <div id="${p}eq"><div id="${p}eb"><div id="${p}ef"></div><svg id="${p}ecad"><rect id="${p}er" x="1" y="1" width="0" height="${e.hauteur - 2}"/></svg><div id="${p}et">${o.texte}</div></div></div>\n`;
  let js = `{ const eb = document.getElementById('${p}eb'); const r = document.getElementById('${p}er'); const w = eb.getBoundingClientRect().width;
  r.setAttribute('width', w - 2); }\n`;
  js += `tl.fromTo('#${p}eb', { opacity: 0, y: ${e.entree.montee} }, { opacity: 1, y: 0, duration: ${e.entree.duree}, ease: '${e.entree.courbe}', immediateRender: true }, ${t});\n`;
  if (o.fin != null) js += `tl.set('#${p}eq', { opacity: 0 }, ${f3(o.fin - 0.001)});\n`;
  return { css, html, js };
}

// ---------------------------------------------------------------------------------------------------------------
// Ouverture du hook (retours de Yoan, 2026-10-23) : les mots dits avant le titre défilent derrière la tête comme des
// sous-titres, dans le style du titre (Anton, mêmes lignes, même entrée), puis le titre s'installe.
// o = { groupes: [{ lignes: [[[mot, t, doré]...]...], debut, fin }] } ; instants dans le calque (t = apparition du mot,
// avance déjà retirée). Le groupe disparaît net à « fin ». À poser dans le même calque que le titre (perforé).
// ---------------------------------------------------------------------------------------------------------------
export function hookOuverture(p, o) {
  const T = HK.titre, O = HK.ouverture, E = STYLE.entrees.hook;
  const css = `
.${p}og{position:absolute;left:0;top:0;width:${W}px;opacity:0;}
.${p}ol{position:absolute;left:0;width:${W}px;text-align:center;white-space:pre;
  font-family:'${fam(O.police)}';font-weight:400;font-size:${T.taille}px;line-height:1;color:${C.blanc};
  text-shadow:${T.ombre};}
.${p}ow{display:inline-block;opacity:0;}
.${p}ok{color:${C.dore};text-shadow:${halo()};}`;
  let html = '', js = '';
  o.groupes.forEach((g, gi) => {
    const tops = g.lignes.length === 1 ? [T.tops[O.ligneSeule]] : T.tops;
    html += `  <div class="${p}og" id="${p}og${gi}">` + g.lignes.map((ligne, li) => `<div class="${p}ol" style="top:${tops[li]}px">`
      + ligne.map(([w, , k], wi) => `<span class="${p}ow${k ? ` ${p}ok` : ''}" id="${p}o${gi}_${li}_${wi}">${w}</span>`).join(' ') + `</div>`).join('') + `</div>\n`;
    js += `tl.set('#${p}og${gi}', { opacity: 1 }, ${f3(Math.max(0, g.debut))});\n`;
    g.lignes.forEach((ligne, li) => ligne.forEach(([, t], wi) => { js += flouEntree(`#${p}o${gi}_${li}_${wi}`, t, { flou: E.flou, d: E.duree }); }));
    js += `tl.set('#${p}og${gi}', { opacity: 0 }, ${f3(g.fin - 0.001)});\n`;
  });
  return { css, html, js };
}

// ---------------------------------------------------------------------------------------------------------------
// Hook secondaire (remplace l'étiquette, retours de Yoan 2026-10-23) : un second hook visuel, 1 ou 2 lignes de Satoshi
// Black en capitales, dans un rectangle noir à coins arrondis au contour doré lumineux (halo à trois couches, comme le
// doré des mots et le filet du fichier en héros), à hauteur de poitrine. Muet. Le cadre ne se trace jamais.
// o = { lignes: ['LIGNE 1', 'LIGNE 2'?], t (entrée), fin?, variante: 'presente'|'flou'|'allume'|'apres' (défaut style.json),
//       tAllume (variante allume : instant où le doré s'allume) }
// ---------------------------------------------------------------------------------------------------------------
export function hookSecondaire(p, o) {
  const s = HK.secondaire, v = o.variante ?? s.variante, t = o.t ?? s.entree.t;
  const glow = s.glow.map(([r, a]) => `0 0 ${r}px rgba(${RGB_D},${a})`).join(',') + `,inset 0 0 ${s.glowInterieur[0]}px rgba(${RGB_D},${s.glowInterieur[1]})`;
  const css = `
#${p}sq{position:absolute;left:0;top:${s.centreY}px;width:${W}px;height:0;display:flex;justify-content:center;align-items:center;z-index:${s.z};}
#${p}sb{position:relative;flex:none;max-width:${s.largeurMax}px;box-sizing:border-box;padding:${s.padY}px ${s.padX}px;border-radius:${s.rayon}px;
  background:${s.fond};border:${s.bord}px solid ${v === 'allume' ? s.allume.bordRepos : 'transparent'};opacity:0;}
#${p}sg{position:absolute;left:${-s.bord}px;top:${-s.bord}px;right:${-s.bord}px;bottom:${-s.bord}px;border-radius:${s.rayon}px;
  border:${s.bord}px solid ${C.dore};box-shadow:${glow};pointer-events:none;${v === 'allume' ? 'opacity:0;' : ''}}
.${p}sl{position:relative;text-align:center;white-space:nowrap;font-family:'${fam(s.police)}';font-weight:900;font-size:${s.taille}px;
  line-height:${s.interligne};letter-spacing:${s.interlettrage}em;color:${s.couleur};text-transform:uppercase;text-shadow:${s.ombreTexte};}`;
  const html = `  <div id="${p}sq"><div id="${p}sb"><div id="${p}sg"></div>${o.lignes.map((l) => `<div class="${p}sl">${l}</div>`).join('')}</div></div>\n`;
  const E = s.entree;
  // presente (2026-10-23) : déjà là à la première image, sans entrée
  let js = v === 'presente' ? `tl.set('#${p}sb', { opacity: 1 }, 0);\n`
    : `tl.fromTo('#${p}sb', { opacity: 0, filter: 'blur(${E.flou}px)' }, { opacity: 1, filter: 'blur(0px)', duration: ${E.duree}, ease: '${E.courbe}', immediateRender: true }, ${f3(t)});\n`;
  if (v === 'allume') {
    const ta = o.tAllume ?? t + 0.5;
    js += `tl.to('#${p}sg', { opacity: 1, duration: ${s.allume.duree}, ease: '${s.allume.courbe}' }, ${f3(ta)});\n`;
    js += `tl.to('#${p}sb', { borderColor: 'rgba(${RGB_D},0)', duration: ${s.allume.duree}, ease: '${s.allume.courbe}' }, ${f3(ta)});\n`;
  }
  if (o.fin != null) js += `tl.set('#${p}sq', { opacity: 0 }, ${f3(o.fin - 0.001)});\n`;
  return { css, html, js };
}

// ---------------------------------------------------------------------------------------------------------------
// Mot derrière la tête (r6-04a) : Anton 300 px doré, fixe, bas des lettres 90 px derrière le haut des cheveux.
// o = { mot, t, hautCheveux (y du haut des cheveux dans l'image finale), xCentre (centre de la tête, défaut 540) }
// Calque à perforer ensuite par le masque de la tête (detourage/perforer).
// ---------------------------------------------------------------------------------------------------------------
const MD = STYLE.motDerriere;
export function motDerriere(p, o) {
  const capBas = o.hautCheveux + MD.profondeur;
  const top = Math.round(capBas - MD.capitale * MD.taille - MD.hautCapitale * MD.taille);
  const css = `
#${p}gw{position:absolute;left:0;top:${top}px;width:${W}px;text-align:center;}
#${p}gros{display:inline-block;font-family:'${fam(MD.police)}';font-size:${MD.taille}px;line-height:1;color:${C.dore};letter-spacing:${MD.interlettrage}em;
  text-shadow:${MD.halo.map(([r, a]) => `0 0 ${r}px rgba(${RGB_D},${a})`).join(',')};opacity:0;}`;
  const html = `  <div id="${p}gw"><span id="${p}gros">${o.mot}</span></div>\n`;
  let js = `tl.set('#${p}gw', { x: ${((o.xCentre ?? W / 2) - W / 2).toFixed(1)} }, 0);\n`;
  js += flouEntree(`#${p}gros`, o.t, { flou: MD.entree.flou, d: MD.entree.duree });
  return { css, html, js, top };
}

// ---------------------------------------------------------------------------------------------------------------
// B-roll noir et blanc annoté (r5-02c, refait r6) : visuel { css, html } passé en noir et blanc, zoom lent continu,
// grain qui vibre, vignette ; annotations en schéma technique (point, trait droit, étiquette) blanches, dorées au mot
// prononcé puis blanches. o = { duree, visuel, annotations: [{ id, mot, fin, lab: [lignes], box: [x0,y0,x1,y1], cote: 'd'|'g', lx, ly }],
// cadre?: transform CSS commun au visuel et aux annotations }. Les sous-titres se posent à part (sousTitres(..., {crochets:false})).
// ---------------------------------------------------------------------------------------------------------------
const BR = STYLE.broll;
export function broll(p, o) {
  const A = BR.annotation, Z = BR.zoom, D = o.duree;
  const labW = (l) => Math.max(...l.map((s) => s.length)) * A.taille * (0.70 + A.interlettrage);
  let svg = '', lab = '', js = '';
  o.annotations.forEach((e) => {
    const [x0, , x1] = e.box, lw = labW(e.lab), lh = e.lab.length * A.taille * A.interligne;
    const px = e.cote === 'd' ? x1 - 30 : x0 + 30, py = e.ly + lh + 10, lx1 = e.lx + lw;
    const d = e.cote === 'd' ? `M${px},${py} L${lx1},${py}` : `M${px},${py} L${e.lx},${py}`;
    const extra = `M${px},${py} m-${A.point},0 a${A.point},${A.point} 0 1,0 ${2 * A.point},0 a${A.point},${A.point} 0 1,0 -${2 * A.point},0`;
    svg += `<path class="${p}tr" id="${p}${e.id}p" d="${d}" pathLength="1"/><path class="${p}tr" id="${p}${e.id}x" d="${extra}" pathLength="1"/>`;
    lab += `<div class="${p}lab" id="${p}${e.id}l" style="left:${e.lx.toFixed(0)}px;top:${e.ly.toFixed(0)}px;">${e.lab.join('<br>')}</div>`;
    const t0 = e.mot - ET.avance, sel = `'#${p}${e.id}p, #${p}${e.id}x'`;
    js += `tl.fromTo('#${p}${e.id}p', { strokeDashoffset: 1, opacity: 1 }, { strokeDashoffset: 0, duration: ${A.dessin}, ease: 'power2.out', immediateRender: true }, ${f3(t0)});\n`;
    js += `tl.fromTo('#${p}${e.id}x', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.18, ease: 'power2.out', immediateRender: true }, ${f3(t0)});\n`;
    js += `tl.fromTo('#${p}${e.id}l', { opacity: 0, filter: 'blur(${ET.flou}px)' }, { opacity: 1, filter: 'blur(0px)', duration: ${A.etiquette.duree}, ease: 'power2.out', immediateRender: true }, ${f3(t0 + A.etiquette.decalage)});\n`;
    js += `tl.set(${sel}, { stroke: '${C.dore}', filter: '${A.haloTrait}' }, ${f3(t0)});\n`;
    js += `tl.set('#${p}${e.id}l', { color: '${C.dore}', textShadow: '${halo()}' }, ${f3(t0)});\n`;
    js += `tl.to(${sel}, { stroke: '${C.blanc}', filter: 'drop-shadow(0 0 0px rgba(${RGB_D},0))', duration: ${A.retour.duree}, ease: '${A.retour.courbe}' }, ${f3(e.fin)});\n`;
    js += `tl.to('#${p}${e.id}l', { color: '${C.blanc}', textShadow: '0 0 0em rgba(${RGB_D},0),0 0 0em rgba(${RGB_D},0),0 0 0em rgba(${RGB_D},0)', duration: ${A.retour.duree}, ease: '${A.retour.courbe}' }, ${f3(e.fin)});\n`;
  });
  const cadre = o.cadre ? `transform:${o.cadre.transform};transform-origin:${o.cadre.origine};` : '';
  const m = STYLE.fond.grain.marge;
  const css = o.visuel.css + `
#${p}ann{position:absolute;left:0;top:0;width:${W}px;height:${H}px;z-index:8;${cadre}}
#${p}ann svg{position:absolute;left:0;top:0;overflow:visible;}
.${p}tr{fill:none;stroke:${C.blanc};stroke-width:${A.trait};stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1 1;stroke-dashoffset:1;}
.${p}lab{position:absolute;font-family:'${fam('satoshi')}';font-weight:900;font-size:${A.taille}px;line-height:${A.interligne};letter-spacing:${A.interlettrage}em;color:${C.blanc};
  text-transform:uppercase;opacity:0;white-space:nowrap;text-shadow:${A.ombre};}
#${p}cam{position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-origin:${Z.origine[0]}px ${Z.origine[1]}px;}
#${p}nb{position:absolute;left:0;top:0;width:${W}px;height:${H}px;filter:${BR.filtre};}
#${p}bgrain{position:absolute;left:-${m}px;top:-${m}px;width:${W + 2 * m}px;height:${H + 2 * m}px;background:url('grain.png') repeat;mix-blend-mode:overlay;opacity:${BR.grain.opacite};z-index:5;}
#${p}bvig{position:absolute;left:0;top:0;width:${W}px;height:${H}px;background:${BR.vignette};z-index:6;}`;
  const html = `  <div id="${p}cam"><div id="${p}nb">${o.visuel.html}</div><div id="${p}ann"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${svg}</svg>${lab}</div></div><div id="${p}bgrain"></div><div id="${p}bvig"></div>\n`;
  js = `tl.fromTo('#${p}cam', { scale: ${Z.de} }, { scale: ${Z.a}, duration: ${D}, ease: 'none' }, 0);\n` + grainJsLocal(`#${p}bgrain`, D) + js;
  return { css, html, js, fondPage: BR.fondPage };
}
function grainJsLocal(sel, D) {
  let sd = BR.grain.graine, js = ''; const amp = STYLE.fond.grain.amplitude;
  const rnd = () => { sd = (sd * 1103515245 + 12345) % 2147483648; return sd / 2147483648; };
  for (let f = 0; f < Math.round(D * ips); f++) js += `tl.set('${sel}', { x: ${Math.round(rnd() * 2 * amp - amp)}, y: ${Math.round(rnd() * 2 * amp - amp)} }, ${(f / ips + 0.001).toFixed(3)});\n`;
  return js;
}
// Visuel de démonstration du B-roll (celui de r5-02c : aucune rush n'avait de vrai plan de coupe) : un « dossier de
// matière » neutre, vignettes d'anciens contenus, deux vocaux, une transcription. Renvoie { css, html, cadre, annotations }.
export function visuelDossier(p = 'b', instants = { anciens: 1.943, finAnciens: 2.75, vocaux: 3.003, finVocaux: 3.70, transcription: 5.044, finTranscription: 5.95 }) {
  const vign = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
    const x = 150 + c * 136, y = 470 + r * 186, g = 70 + ((r * 3 + c) * 37) % 60;
    vign.push(`<div class="${p}vi" style="left:${x}px;top:${y}px;background:linear-gradient(170deg,rgb(${g + 40},${g + 40},${g + 40}),rgb(${g - 30},${g - 30},${g - 30}));">`
      + `<div class="${p}tete" style="left:${32 + (c * 7) % 14}px;top:${46 + (r * 11) % 18}px;"></div><div class="${p}corps"></div><div class="${p}play"></div></div>`);
  }
  const onde = (n, graine) => { let sd = graine, s = ''; const rnd = () => { sd = (sd * 1103515245 + 12345) % 2147483648; return sd / 2147483648; };
    for (let i = 0; i < n; i++) { const h = 8 + Math.round(Math.abs(Math.sin(i * 0.45 + graine)) * 34 * (0.5 + rnd())); s += `<i style="height:${h}px"></i>`; } return s; };
  const vocal = (y, dur, g) => `<div class="${p}vo" style="top:${y}px;"><div class="${p}bp"><div class="${p}tri"></div></div><div class="${p}onde">${onde(30, g)}</div><div class="${p}du">${dur}</div></div>`;
  const lignes = ['… et ce que je dis toujours à mes', 'clients, c\'est que le plus dur ce', 'n\'est pas de savoir quoi faire,', 'c\'est de le faire chaque semaine,', 'même quand la motivation n\'est', 'plus là. Alors on commence petit…'];
  const pg = `<div id="${p}page"><div class="${p}pt">transcription_vocal_03.txt</div>${lignes.map((l) => `<div class="${p}pl">${l}</div>`).join('')}</div>`;
  const css = `
#${p}bfond{position:absolute;left:-200px;top:-200px;width:1480px;height:2320px;background:radial-gradient(ellipse at 45% 45%,#5a5a5a 0%,#2e2e2e 45%,#121212 100%);}
#${p}planche{position:absolute;left:0;top:0;width:1080px;height:1920px;transform:scale(0.9) rotate(-1.5deg);transform-origin:540px 1000px;}
.${p}vi{position:absolute;width:120px;height:170px;border-radius:12px;overflow:hidden;box-shadow:0 10px 26px rgba(0,0,0,0.5);}
.${p}vi .${p}tete{position:absolute;width:52px;height:56px;border-radius:50%;background:rgba(220,220,220,0.55);filter:blur(5px);}
.${p}vi .${p}corps{position:absolute;left:14px;top:104px;width:96px;height:90px;border-radius:44px 44px 0 0;background:rgba(15,15,15,0.55);filter:blur(4px);}
.${p}vi .${p}play{position:absolute;left:48px;top:72px;width:0;height:0;border-left:22px solid rgba(255,255,255,0.85);border-top:14px solid transparent;border-bottom:14px solid transparent;}
.${p}vo{position:absolute;left:500px;width:430px;height:96px;border-radius:48px;background:#3a3a3a;box-shadow:0 10px 26px rgba(0,0,0,0.45);}
.${p}vo .${p}bp{position:absolute;left:16px;top:16px;width:64px;height:64px;border-radius:32px;background:#d8d8d8;}
.${p}vo .${p}tri{position:absolute;left:25px;top:19px;border-left:20px solid #2a2a2a;border-top:13px solid transparent;border-bottom:13px solid transparent;}
.${p}vo .${p}onde{position:absolute;left:96px;top:0;height:96px;width:240px;display:flex;align-items:center;gap:3px;}
.${p}vo .${p}onde i{display:block;width:5px;border-radius:3px;background:#bdbdbd;}
.${p}vo .${p}du{position:absolute;right:26px;top:32px;font-family:'${fam('inter')}';font-size:26px;font-weight:500;color:#a8a8a8;}
#${p}page{position:absolute;left:150px;top:1250px;width:410px;height:280px;box-sizing:border-box;padding:22px 24px;border-radius:10px;background:#e6e6e6;
  box-shadow:0 14px 30px rgba(0,0,0,0.5);font-family:'${fam('inter')}';color:#2b2b2b;transform:rotate(1deg);}
#${p}page .${p}pt{font-size:19px;font-weight:600;color:#6a6a6a;margin-bottom:12px;}
#${p}page .${p}pl{font-size:20.5px;line-height:1.55;font-weight:450;white-space:nowrap;}`;
  const html = `<div id="${p}bfond"></div><div id="${p}planche">${vign.join('')}${vocal(935, '2:14', 1)}${vocal(1054, '0:48', 2.3)}${pg}</div>`;
  const I = instants;
  return { css, html, cadre: { transform: 'scale(0.9) rotate(-1.5deg)', origine: '540px 1000px' },
    annotations: [
      { id: 'e1', mot: I.anciens, fin: I.finAnciens, lab: ['ANCIENS', 'CONTENUS'], box: [150, 470, 542, 826], cote: 'd', lx: 640, ly: 600 },
      { id: 'e2', mot: I.vocaux, fin: I.finVocaux, lab: ['VOCAUX'], box: [500, 935, 930, 1150], cote: 'g', lx: 150, ly: 1015 },
      { id: 'e3', mot: I.transcription, fin: I.finTranscription, lab: ['TRANSCRIPTION'], box: [150, 1250, 560, 1530], cote: 'd', lx: 620, ly: 1360 },
    ] };
}

// ---------------------------------------------------------------------------------------------------------------
// CTA (r6-01a sur fond uni avec quadrillage et faisceau, r6-01b sur la caméra au-dessus de la tête sans quadrillage) :
// consigne au-dessus, le mot doré centré pile entre quatre « + » posés sur son encre réelle, ligne du bas ; grosses
// lignes de repère 0,25 s après le mot, tenues 0,7 s, effacées en 0,45 s.
// o = { support: 'fond'|'camera', hautCheveuxMin (caméra : bloc entier au-dessus de la tête, 2026-10-23), mot, consigne, bas, tConsigne, tMot, tBas (instants d'ENTRÉE, déjà avancés),
//       T (image pleine du faisceau, support fond), fin (durée du calque), hautCheveux (support camera) }
// Rend aussi les instants à donner au son : { mot, lignes }.
// ---------------------------------------------------------------------------------------------------------------
const CT = STYLE.cta;
function boiteEncre(mot, taille, ls) {
  const e = encre(mot, taille, 1, ls);
  // largeur du span inline-block : avance de chaque glyphe + interlettrage après chaque lettre (Chrome)
  const larg = largeurMot(mot, taille, ls);
  const x0 = 90 + (900 - larg) / 2;
  // bords calés sur les pixels comme la boîte mesurée sur l'image de la carte r6-01a (briques/sources/mesure_cta.r6.py) :
  // gauche arrondie vers l'intérieur, droite et haut vers le bas, bas exclusif. Sans ce calage, « + » et quadrillage
  // tombent entre deux pixels (traits flous, 1 px plus bas que la carte).
  return { gauche: Math.ceil(x0 + e.gauche), droite: Math.floor(x0 + larg - e.droite), haut: Math.floor(e.haut), bas: Math.round(taille - e.bas) - 1 };
}
const GLY = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'briques', 'encre', 'satoshi-glyphes.json'), 'utf8'));
export const largeurMot = (mot, taille, ls) => [...mot].reduce((a, c) => a + GLY.chars[c].adv * taille / GLY.upm + ls * taille, 0);
export function cta(p, o) {
  const fondU = o.support === 'fond', taille = CT.mot.taille;
  const B = boiteEncre(o.mot, taille, CT.mot.interlettrage);
  // sur la caméra (3e passage de Yoan, 2026-10-23) : tout le bloc au-dessus de la tête, la ligne du bas finit
  // cta.camera.dessus.marge px au-dessus du point le plus haut des cheveux (hautCheveuxMin) ; plus de morsure (r6-01b)
  const hc = o.hautCheveuxMin ?? o.hautCheveux;
  const motTop = fondU ? CT.fond.motTop : Math.round(hc - CT.camera.dessus.marge - CT.bas.taille - CT.basSous - CT.marge.y - B.bas);
  const ex0 = B.gauche, ex1 = B.droite, ey0 = motTop + B.haut, ey1 = motTop + B.bas;
  const cx0 = ex0 - CT.marge.x, cx1 = ex1 + CT.marge.x, cy0 = ey0 - CT.marge.y, cy1 = ey1 + CT.marge.y;
  const yc = motTop - CT.consigneAuDessus, yb = ey1 + CT.marge.y + CT.basSous;
  const L = CT.lignes, cr = rgbs(C.creme), lc = L.couleur, pl = CT.plus;
  const lignes = o.tMot + L.decalage, Ec = STYLE.entrees.cta;
  const sup = fondU ? 'fond' : 'camera';
  const f = fondU ? fondC(`${p}c`, o.T - 0.2, o.fin) : null;
  const css = (f ? f.css : '') + `
#${p}fs{position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:hidden;z-index:${CT.z};${fondU ? `opacity:0;background:${C.fondFS};` : ''}}
.${p}ct{position:absolute;left:90px;width:900px;text-align:center;font-family:'${fam('satoshi')}';font-weight:900;text-transform:uppercase;opacity:0;}
#${p}consigne,#${p}bas{font-size:${CT.consigne.taille}px;line-height:1;letter-spacing:${CT.consigne.interlettrage}em;color:${C.creme};text-shadow:0 2px 14px rgba(0,0,0,${CT.ombre[sup]});}
#${p}consigne{top:${yc}px;padding-left:${CT.consigne.interlettrage}em;} #${p}bas{top:${yb}px;font-size:${CT.bas.taille}px;letter-spacing:${CT.bas.interlettrage}em;padding-left:${CT.bas.interlettrage}em;color:rgba(${cr},${CT.bas.opacite[sup]});}
#${p}motw{top:${motTop}px;height:${taille}px;}
#${p}mot{position:relative;display:inline-block;font-size:${taille}px;line-height:1;letter-spacing:${CT.mot.interlettrage}em;color:${C.dore};text-shadow:${halo()};}
#${p}grille{position:absolute;left:0;top:0;width:${W}px;height:${H}px;opacity:0;
  background-image:linear-gradient(${CT.grille.couleur} 1px,transparent 1px),linear-gradient(90deg,${CT.grille.couleur} 1px,transparent 1px);
  background-size:${CT.grille.pas}px ${CT.grille.pas}px;background-position:${cx0 % CT.grille.pas}px ${cy0 % CT.grille.pas}px;
  -webkit-mask-image:radial-gradient(ellipse 70% 42% at 50% ${((ey0 + ey1) / 2 / (H / 100)).toFixed(1)}%,#000 30%,transparent 100%);mask-image:radial-gradient(ellipse 70% 42% at 50% ${((ey0 + ey1) / 2 / (H / 100)).toFixed(1)}%,#000 30%,transparent 100%);}
.${p}rep{position:absolute;opacity:0;}
.${p}rh{left:0;width:${W}px;height:${L.trait}px;margin-top:-${L.trait / 2}px;transform:scaleX(0);
  background:linear-gradient(90deg,rgba(${cr},0) 0%,${lc} 12%,${lc} 88%,rgba(${cr},0) 100%);}
.${p}rv{width:${L.trait}px;margin-left:-${L.trait / 2}px;transform:scaleY(0);top:0px;height:${fondU ? H : Math.min(H, Math.max(cy1 + 40, hc))}px;
  background:linear-gradient(180deg,rgba(${cr},0) 0%,${lc} 10%,${lc} ${fondU ? 90 : 75}%,rgba(${cr},0) 100%);}
.${p}plus{position:absolute;width:${pl.taille}px;height:${pl.taille}px;opacity:0;} .${p}plus:before,.${p}plus:after{content:'';position:absolute;background:${C.creme};}
.${p}plus:before{left:${(pl.taille - pl.trait) / 2}px;top:0;width:${pl.trait}px;height:${pl.taille}px;} .${p}plus:after{left:0;top:${(pl.taille - pl.trait) / 2}px;width:${pl.taille}px;height:${pl.trait}px;}`;
  const ent = (sel, t) => `tl.fromTo('${sel}', { opacity: 0, filter: 'blur(${Ec.flou}px)' }, { opacity: 1, filter: 'blur(0px)', duration: ${Ec.duree}, ease: 'power2.out', immediateRender: true }, ${f3(t)});\n`;
  let deco = '', js = '';
  if (fondU) {
    js += f.js + `tl.set('#${p}fs', { opacity: 1 }, ${f3(o.T)});\n`;
    deco += `<div id="${p}grille"></div>`;
    js += `tl.fromTo('#${p}grille', { opacity: 0 }, { opacity: 1, duration: ${CT.grille.apparition}, ease: 'sine.out', immediateRender: true }, ${f3(o.T + 0.02)});\n`;
  }
  const h2 = pl.taille / 2;
  deco += `<div class="${p}rep ${p}rh" id="${p}q1" style="top:${cy0}px"></div><div class="${p}rep ${p}rh" id="${p}q2" style="top:${cy1}px"></div>`
    + `<div class="${p}rep ${p}rv" id="${p}q3" style="left:${cx0}px"></div><div class="${p}rep ${p}rv" id="${p}q4" style="left:${cx1}px"></div>`
    + [[cx0, cy0], [cx1, cy0], [cx0, cy1], [cx1, cy1]].map(([x, y], i) => `<div class="${p}plus" id="${p}pp${i}" style="left:${x - h2}px;top:${y - h2}px"></div>`).join('');
  js += `tl.set('.${p}rep', { opacity: 1 }, ${f3(lignes)});\n`;
  js += `tl.to('#${p}q1, #${p}q2', { scaleX: 1, duration: ${L.duree}, ease: 'power2.out' }, ${f3(lignes)});\n`;
  js += `tl.to('#${p}q3, #${p}q4', { scaleY: 1, duration: ${L.duree}, ease: 'power2.out' }, ${f3(lignes)});\n`;
  js += `tl.fromTo('.${p}plus', { opacity: 0, scale: 0.4, rotation: -45 }, { opacity: 1, scale: 1, rotation: 0, duration: ${L.duree}, ease: 'power2.out', immediateRender: true }, ${f3(lignes + L.plusDecalage)});\n`;
  js += `tl.to('.${p}rep', { opacity: 0, duration: ${L.effacement}, ease: 'sine.inOut' }, ${f3(lignes + L.duree + L.tenue)});\n`;
  js += ent(`#${p}motw`, o.tMot) + ent(`#${p}consigne`, o.tConsigne) + ent(`#${p}bas`, o.tBas);
  const html = `  <div id="${p}fs">${f ? f.html : ''}${deco}<div class="${p}ct" id="${p}consigne">${o.consigne}</div><div class="${p}ct" id="${p}motw"><span id="${p}mot">${o.mot}</span></div>`
    + `<div class="${p}ct" id="${p}bas">${o.bas}</div></div>\n`;
  return { css, html, js, motTop, encre: B, instants: { mot: o.tMot, lignes }, flashs: fondU ? [o.T] : [] };
}
