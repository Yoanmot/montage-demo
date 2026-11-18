// Gabarit 4 (reel 4, animations 6, 7, 17), adapté au style verrouillé (r3-03a, r8-02b) : le fond r4-01c descend du
// haut et pousse le visage vers le bas ; le panneau vit en haut ; frontière en FONDU DOUX de 260 px (jamais un filet dur).
// Sortie sèche : le fond remonte en 2 images et le visage revient.
// Tour 11 : la COURBE de la descente devient un paramètre (r11-01) et le contenu descend AVEC le fond (il arrive par
// le haut au lieu d'apparaître sur place ; identique au tour 10 avec la courbe « actuelle », plus courte que l'entrée
// du panneau).
// La caméra se fabrique à part (r11/_build/r11-anim/camera11.py, type « split ») avec EXACTEMENT la même loi :
//   P(t) = progression : 0 avant t0 ; courbe((t - t0) / d) pendant l'entrée ; 1 ensuite ; 1 -> 0 linéaire sur dS dès t1.
//   V(t) = -H x (1 - P(t)) : position du fond.
//   décalage du visage = clamp(V(t) + ty, 0, ty) : le fond pousse le visage dès qu'il l'atteint (le haut de l'image
//   caméra reste toujours sous la partie opaque du fond).
import { f3, fondC, STYLE } from '../commun.mjs';

// Géométrie et courbe lues dans style/style.json (demiEcran) ; la table de la courbe « banque » y est aussi.
const DE = STYLE.demiEcran;
const TABLES = DE.courbes;
export const DEMI = { ty: DE.decalage, H: DE.hauteur, fondu: DE.fondu, dE: 0.15, dS: DE.sortie };
// Courbes comparées au tour 11 (r11-01). « banque » : courbe mesurée de l'ancienne banque d'effets (half-anim-apparition).
export const COURBES = {
  actuelle: { ease: 'power2.out', d: 0.15 },
  banque: { ease: 'banque', d: TABLES.banque.duree },
  power3: { ease: 'power3.out', d: 0.70 },
  expo: { ease: 'expo.out', d: 0.90 },
};
export const COURBE_DEFAUT = DE.courbe;   // retenue pour les cartes verrouillées du tour 11 (demande de Yoan)
export const TABLE_BANQUE = TABLES.banque.table;
const easeJs = (nom) => nom === 'banque'
  ? `((T) => (p) => { const x = Math.min(1, Math.max(0, p)) * (T.length - 1), i = Math.min(T.length - 2, Math.floor(x)); return T[i] + (T[i + 1] - T[i]) * (x - i); })(${JSON.stringify(TABLE_BANQUE)})`
  : `'${nom}'`;

// o = { t0, t1, courbe = COURBE_DEFAUT, contenu: { css, html, js } }
export function demiEcran(p, o) {
  const { H, fondu, dS } = DEMI, C = COURBES[o.courbe ?? COURBE_DEFAUT];
  const f = fondC(`${p}f`, o.t0, o.t1 + dS + 0.05);
  const mk = `linear-gradient(to bottom,#000 0,#000 ${H - fondu}px,rgba(0,0,0,0) ${H}px)`;
  const css = f.css + `
#${p}voile{position:absolute;left:0;top:0;width:1080px;height:${H}px;overflow:hidden;z-index:10;opacity:0;-webkit-mask-image:${mk};mask-image:${mk};}
#${p}haut{position:absolute;left:0;top:0;width:1080px;height:1920px;z-index:15;}` + o.contenu.css;
  const html = `  <div id="${p}voile">${f.html}</div><div id="${p}haut">${o.contenu.html}</div>\n`;
  let js = f.js + `tl.set('#${p}voile, #${p}haut', { opacity: 1, y: ${-H} }, ${f3(o.t0)});\n`;
  js += `tl.to('#${p}voile, #${p}haut', { y: 0, duration: ${C.d}, ease: ${easeJs(C.ease)} }, ${f3(o.t0)});\n`;
  js += `tl.to('#${p}voile, #${p}haut', { y: ${-H}, duration: ${dS}, ease: 'none' }, ${f3(o.t1)});\n`;
  js += `tl.set('#${p}voile, #${p}haut', { opacity: 0 }, ${f3(o.t1 + dS + 0.001)});\n`;
  return { css, html, js: js + o.contenu.js, courbe: { nom: o.courbe ?? COURBE_DEFAUT, ...C } };
}
