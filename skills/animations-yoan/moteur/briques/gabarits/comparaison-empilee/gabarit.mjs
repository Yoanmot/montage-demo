// Gabarit 7 (reel 4, animation 15 : ROUND ONE / ROUND TWO) : deux vignettes l'une sous l'autre, chacune avec son
// étiquette espacée dessous ; la première arrive, puis la seconde ; les crochets dorés passent de l'une à l'autre et
// l'étiquette de la vignette active passe au doré. Vignettes chaudes (pas de bloc froid : palette brune).
import { S, f3, ent, etiqCss, crochetsCss, crochetsHtml, crochetsEntree, crochetsVers, grainCss, grainJs, RGB_D, esc } from '../commun.mjs';

// o = {
//   x = 90, w = 900
//   cartes: [{ y, h, etiquette, titre, texte, t }]   vignette : petit titre (étiquette), texte en voix d'interface
//   actif: [{ t, i }]                  crochets dorés sur la vignette i (1re fois : ils se resserrent), puis glissent
//   etiquettes = 'jetbrains' (S.etiquette, verrouillé au tour 10), sortie
// }
export function comparaisonEmpilee(p, o) {
  const x = o.x ?? 90, w = o.w ?? 900, fam = o.etiquettes ?? S.etiquette, ui = S.ui;
  const boite = (c) => ({ x: x - 12, y: c.y - 12, w: w + 24, h: c.h + 24 });
  const css = `
.${p}v{position:absolute;left:${x}px;width:${w}px;box-sizing:border-box;border-radius:${S.rayon.panneau}px;overflow:hidden;opacity:0;z-index:20;
  border:${S.trait}px solid ${S.filet};background:${S.verre};}
.${p}vf{position:absolute;left:0;top:0;right:0;bottom:0;filter:blur(30px);opacity:0.9;
  background:radial-gradient(ellipse 60% 90% at 85% 10%,rgba(172,96,50,0.55),rgba(172,96,50,0) 70%),radial-gradient(ellipse 50% 80% at 10% 100%,rgba(76,39,19,0.8),rgba(76,39,19,0) 70%);}
${grainCss(`${p}gr`, 0.4)}
${etiqCss(`${p}vt`, fam, { taille: 21, couleur: 'rgba(242,238,230,0.5)' })}
.${p}vt{position:absolute;left:34px;top:28px;}
.${p}vx{position:absolute;left:34px;right:34px;top:70px;font-family:'${ui.family}';font-weight:${ui.poids};font-size:${ui.taille - 2}px;line-height:1.32;color:${S.texteUI};}
${etiqCss(`${p}e`, fam, { couleur: S.secondaire })}
.${p}e{position:absolute;left:${x}px;width:${w}px;text-align:center;opacity:0;z-index:20;}
.${p}e.on{color:${S.dore};text-shadow:0 0 8px rgba(${RGB_D},0.55);}
${crochetsCss(`${p}cr`)}
#${p}c{z-index:21;}`;
  let html = '', js = '';
  o.cartes.forEach((c, i) => {
    html += `  <div class="${p}v" id="${p}v${i}" style="top:${c.y}px;height:${c.h}px"><div class="${p}vf"></div><div class="${p}gr" id="${p}gr${i}"></div>`
      + `<div class="${p}vt">${c.titre ?? ''}</div><div class="${p}vx">${esc(c.texte)}</div></div>`
      + `<div class="${p}e" id="${p}e${i}" style="top:${c.y + c.h + 22}px">${c.etiquette}</div><div class="${p}e on" id="${p}eo${i}" style="top:${c.y + c.h + 22}px">${c.etiquette}</div>\n`;
    js += ent(`#${p}v${i}`, c.t) + ent(`#${p}e${i}`, c.t + S.cascade, { flou: S.entree.flou, d: S.entree.duree });
    js += grainJs(`#${p}gr${i}`, c.t, (o.sortie ?? c.t + 10) + 0.2, 555 + i, 80);
  });
  html += crochetsHtml(`${p}c`, `${p}cr`, boite(o.cartes[o.actif[0].i])) + '\n';
  let prev = null;
  o.actif.forEach((a, k) => {
    js += k === 0 ? crochetsEntree(`${p}c`, a.t) : crochetsVers(`${p}c`, a.t, boite(o.cartes[a.i]));
    if (prev !== null) js += `tl.set('#${p}eo${prev}', { opacity: 0 }, ${f3(a.t)});\ntl.set('#${p}e${prev}', { opacity: 1 }, ${f3(a.t)});\n`;
    js += `tl.set('#${p}eo${a.i}', { opacity: 1 }, ${f3(a.t + 0.1)});\ntl.set('#${p}e${a.i}', { opacity: 0 }, ${f3(a.t + 0.1)});\n`;
    prev = a.i;
  });
  return { css, html, js };
}
