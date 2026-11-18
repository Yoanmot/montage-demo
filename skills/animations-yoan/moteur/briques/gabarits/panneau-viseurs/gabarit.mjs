// Gabarit 3 (reel 4, animations 3, 9, 10, 11, 13, 16) : panneau de verre sombre à filet crème, sans ombre, avec une
// croix « + » de viseur à chaque coin (les bras dépassent du cadre), une ligne d'en-tête à deux étiquettes, du grain.
// Il est fixe : seul son contenu bouge. Sert de cadre aux gabarits liste-cascade et schema-noeuds.
import { S, f3, ent, sortie, croix, etiqCss, grainCss, grainJs } from '../commun.mjs';

// o = {
//   x = 90, y, w = 900, h              boîte du panneau (83 % de la largeur par défaut, comme le reel 4)
//   entree, sortie                     fondu depuis un flou (0,17 s) ; les croix arrivent 0,05 s après
//   entete: { gauche, droite, t }      deux étiquettes en haut du panneau (facultatif) ; etiquettes = 'jetbrains' (S.etiquette, verrouillé au tour 10)
//   contenu: { css, html, js }         posé DANS le panneau (coordonnées relatives au panneau)
// }
export function panneau(p, o) {
  const x = o.x ?? 90, w = o.w ?? 900, y = o.y, h = o.h, fam = o.etiquettes ?? S.etiquette;
  const cx = croix(`${p}k`, { x, y, w, h });
  const fin = (o.sortie ?? 99) + 0.2;
  const css = `
#${p}pan{position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;box-sizing:border-box;border-radius:${S.rayon.panneau}px;overflow:hidden;
  background:${S.verre};border:${S.trait}px solid ${S.filet};opacity:0;z-index:20;}
${grainCss(`${p}gr`, 0.4)}
${etiqCss(`${p}eh`, fam)}
.${p}eh{position:absolute;top:34px;opacity:0;}
#${p}ent{position:absolute;left:36px;right:36px;top:84px;height:1.5px;background:${S.filetDoux};opacity:0;}
${cx.css}` + o.contenu.css;
  const e = o.entete;
  const html = `  <div id="${p}pan"><div class="${p}gr" id="${p}gr"></div>`
    + (e ? `<div class="${p}eh" id="${p}ehg" style="left:36px">${e.gauche ?? ''}</div><div class="${p}eh" id="${p}ehd" style="right:36px">${e.droite ?? ''}</div><div id="${p}ent"></div>` : '')
    + o.contenu.html + `</div>${cx.html}\n`;
  let js = ent(`#${p}pan`, o.entree) + grainJs(`#${p}gr`, o.entree, fin, 4321, 80);
  js += `tl.fromTo('${cx.sel}', { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.2, ease: 'power2.out', immediateRender: true }, ${f3(o.entree + 0.05)});\n`;
  if (e) {
    const te = e.t ?? o.entree + 0.1;
    js += ent(`#${p}ehg`, te, { flou: S.entree.flou, d: S.entree.duree }) + ent(`#${p}ehd`, te + S.cascade, { flou: S.entree.flou, d: S.entree.duree });
    js += `tl.fromTo('#${p}ent', { opacity: 0, scaleX: 0 }, { opacity: 1, scaleX: 1, duration: 0.3, ease: 'power2.out', immediateRender: true }, ${f3(te)});\n`;
  }
  js += o.contenu.js;
  if (o.sortie !== undefined) js += sortie(`#${p}pan, ${cx.sel}`, o.sortie);
  return { css, html, js, box: { x, y, w, h } };
}
