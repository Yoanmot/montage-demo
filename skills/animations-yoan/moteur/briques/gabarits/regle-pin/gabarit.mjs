// Gabarit 2 (reel 4, animations 2, 7, 11) : règle horizontale à graduations fines, un pin doré qui descend, glisse
// jusqu'à une valeur, puis une ellipse dorée tracée autour de sa base.
import { S, f3, ent, sortie, etiqCss, haloTrait, RGB_D } from '../commun.mjs';

// o = {
//   y                                 hauteur de la règle
//   x0 = 0, x1 = 1080                 étendue du trait (pleine largeur par défaut)
//   pas = 30, majeur = 5              écart des graduations (px) et une graduation longue toutes les N
//   reperes: [{ x, texte }]           étiquettes sous la règle (dans la zone sûre : x 91 à 899)
//   etiquettes = 'jetbrains' (S.etiquette, verrouillé au tour 10)            famille des étiquettes (S.etiquettes)
//   entree, sortie                    apparition (le trait se tire depuis le centre en 0,3 s) et disparition
//   pin: { t, arrets: [{ t, x, texte, d }] }   le pin descend à t sur arrets[0].x, puis glisse vers chaque arrêt
//                                     (d secondes, power2.inOut) ; texte = valeur affichée au-dessus du pin
//   ellipse: { t }                    l'ellipse dorée se trace autour de la base du pin en 0,2 s
// }
export function reglePin(p, o) {
  const x0 = o.x0 ?? 0, x1 = o.x1 ?? 1080, pas = o.pas ?? 30, maj = o.majeur ?? 5, fam = o.etiquettes ?? S.etiquette;
  const W = x1 - x0, y = o.y;
  let ticks = '';
  const c0 = Math.round((x0 + x1) / 2);
  for (let k = -Math.floor((c0 - x0) / pas); c0 + k * pas <= x1; k++) {
    const x = c0 + k * pas - x0, long = k % maj === 0;
    ticks += `<line x1="${x}" y1="${long ? 0 : 6}" x2="${x}" y2="${long ? 22 : 14}" />`;
  }
  const a0 = o.pin.arrets[0];
  const css = `
#${p}reg{position:absolute;left:${x0}px;top:${y}px;width:${W}px;height:2px;background:${S.filetFort};transform:scaleX(0);transform-origin:50% 50%;z-index:20;}
#${p}gra{position:absolute;left:${x0}px;top:${y + 2}px;opacity:0;z-index:20;}
#${p}gra line{stroke:rgba(244,239,228,0.5);stroke-width:1.5;}
${etiqCss(`${p}e`, fam)}
.${p}e{position:absolute;top:${y + 40}px;transform:translateX(-50%);opacity:0;z-index:20;}
#${p}pin{position:absolute;left:${a0.x}px;top:${y - 96}px;width:0;height:96px;opacity:0;z-index:21;}
#${p}tige{position:absolute;left:-1.5px;top:28px;width:3px;height:68px;background:${S.dore};filter:${haloTrait};}
#${p}tete{position:absolute;left:-10px;top:8px;width:20px;height:20px;box-sizing:border-box;border-radius:50%;border:3px solid ${S.dore};filter:${haloTrait};}
#${p}val{position:absolute;left:0;top:-34px;font-family:'Satoshi';font-weight:900;font-size:30px;letter-spacing:0.04em;
  color:${S.dore};text-shadow:0 0 6px rgba(${RGB_D},0.6);white-space:nowrap;}
.${p}v{position:absolute;left:0;top:0;transform:translateX(-50%);}
#${p}ell{position:absolute;left:${a0.x - 46}px;top:${y - 18}px;overflow:visible;z-index:21;filter:${haloTrait};}
#${p}ell ellipse{fill:none;stroke:${S.dore};stroke-width:3;}`;
  const L = Math.ceil(2 * Math.PI * Math.sqrt((46 * 46 + 18 * 18) / 2));
  const html = `  <div id="${p}reg"></div><svg id="${p}gra" width="${W}" height="24">${ticks}</svg>`
    + (o.reperes || []).map((r, i) => `<div class="${p}e" id="${p}e${i}" style="left:${r.x}px">${r.texte}</div>`).join('')
    + `<div id="${p}pin"><div id="${p}tige"></div><div id="${p}tete"></div><div id="${p}val">` + o.pin.arrets.map((a, i) => `<span class="${p}v" id="${p}v${i}"${i ? ' style="opacity:0"' : ''}>${a.texte ?? ''}</span>`).join('') + `</div></div>`
    + `<svg id="${p}ell" width="92" height="36"><ellipse id="${p}ellp" cx="46" cy="18" rx="44" ry="16" stroke-dasharray="${L}" stroke-dashoffset="${L}"/></svg>\n`;
  let js = `tl.to('#${p}reg', { scaleX: 1, duration: 0.3, ease: 'power2.out' }, ${f3(o.entree)});\n`;
  js += ent(`#${p}gra`, o.entree + 0.08, { d: 0.22 });
  (o.reperes || []).forEach((r, i) => { js += ent(`#${p}e${i}`, o.entree + 0.12 + i * S.cascade, { flou: S.entree.flou, d: S.entree.duree }); });
  js += `tl.fromTo('#${p}pin', { opacity: 0, y: -40, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.2, ease: 'power2.out', immediateRender: true }, ${f3(o.pin.t)});\n`;
  let xc = a0.x;
  o.pin.arrets.slice(1).forEach((a, j) => {
    const d = a.d ?? 0.35;
    js += `tl.to('#${p}pin', { left: ${a.x}, duration: ${d}, ease: 'power2.inOut' }, ${f3(a.t)});\n`;
    js += `tl.set('#${p}v${j}', { opacity: 0 }, ${f3(a.t + d * 0.6)});\ntl.set('#${p}v${j + 1}', { opacity: 1 }, ${f3(a.t + d * 0.6)});\n`;
    xc = a.x;
  });
  if (o.ellipse) {
    js += `tl.set('#${p}ell', { left: ${xc - 46} }, 0);\n`;
    js += `tl.to('#${p}ellp', { strokeDashoffset: 0, duration: 0.2, ease: 'power1.inOut' }, ${f3(o.ellipse.t)});\n`;
  }
  if (o.sortie) js += sortie(`#${p}reg, #${p}gra, .${p}e, #${p}pin, #${p}ell`, o.sortie, { d: 0.15 });
  return { css, html, js };
}
