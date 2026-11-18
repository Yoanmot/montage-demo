// Gabarit 5 (reel 4, animation 5 : l'horloge) : petit objet en verre posé sur la caméra, à côté de la tête, qui
// apparaît net depuis un flou en 5 images, vit pendant la phrase (animation interne), puis repart dans un flou.
// Objets disponibles : 'fichier' (lignes qui s'écrivent, onde dorée = la voix) et 'horloge' (aiguille dorée qui tourne).
import { S, f3, ent, sortie, etiqCss, haloTrait, grainCss, grainJs } from '../commun.mjs';

// o = {
//   objet: 'fichier' | 'horloge'
//   cx, cy, taille = 210               centre et taille de l'objet (px)
//   entree, sortie                     instants
//   lignes: [t, t, ...]                (fichier) instants où chaque ligne de texte s'écrit (0,25 s, de gauche à droite)
//   accent: t                          (fichier) instant où l'onde dorée éclot, barre par barre (0,05 s d'écart)
//   tour: { t0, t1, tours = 1 }        (horloge) l'aiguille dorée tourne de t0 à t1
//   etiquette: { texte, t }            petite étiquette sous l'objet ; etiquettes = 'jetbrains' (S.etiquette, verrouillé au tour 10) (famille)
// }
export function objetSignature(p, o) {
  const T = o.taille ?? 210, x = o.cx - T / 2, y = o.cy - T / 2, fam = o.etiquettes ?? S.etiquette;
  const fin = (o.sortie ?? 99) + 0.2;
  let svg = '', js = '', css = `
#${p}obj{position:absolute;left:${x}px;top:${y}px;width:${T}px;height:${T}px;opacity:0;z-index:22;}
#${p}obj svg{position:absolute;left:0;top:0;overflow:visible;}
${etiqCss(`${p}et`, fam, { taille: 22, couleur: S.secondaire })}
#${p}et{position:absolute;left:${o.cx}px;top:${y + T + 18}px;transform:translateX(-50%);opacity:0;z-index:22;}`;
  if ((o.objet ?? 'fichier') === 'fichier') {
    // page : 150 x 190 dans une boîte de 210, coin plié en haut à droite
    const k = T / 210, pw = 150 * k, ph = 190 * k, px = (T - pw) / 2, py = (T - ph) / 2, pli = 40 * k, r = 14 * k;
    const forme = `M${px + r} ${py} H${px + pw - pli} L${px + pw} ${py + pli} V${py + ph - r} Q${px + pw} ${py + ph} ${px + pw - r} ${py + ph} H${px + r} Q${px} ${py + ph} ${px} ${py + ph - r} V${py + r} Q${px} ${py} ${px + r} ${py} Z`;
    css += `
#${p}page{fill:${S.verreObjet};stroke:${S.filetFort};stroke-width:${S.trait};}
#${p}pli{fill:none;stroke:${S.filetFort};stroke-width:${S.trait};stroke-linejoin:round;}
.${p}li{position:absolute;height:${Math.max(4, 6 * k)}px;border-radius:3px;background:rgba(244,239,228,0.55);transform:scaleX(0);transform-origin:0 50%;}
.${p}ob{position:absolute;width:${7 * k}px;border-radius:${3.5 * k}px;background:${S.dore};filter:${haloTrait};transform:scaleY(0);transform-origin:50% 50%;}
#${p}clip{position:absolute;left:${px}px;top:${py}px;width:${pw}px;height:${ph}px;overflow:hidden;border-radius:${r}px;clip-path:path('M${r} 0 H${pw - pli} L${pw} ${pli} V${ph - r} Q${pw} ${ph} ${pw - r} ${ph} H${r} Q0 ${ph} 0 ${ph - r} V${r} Q0 0 ${r} 0 Z');}
${grainCss(`${p}gr`, 0.35)}`;
    svg = `<svg width="${T}" height="${T}"><path id="${p}page" d="${forme}"/><path id="${p}pli" d="M${px + pw - pli} ${py} V${py + pli} H${px + pw}"/></svg><div id="${p}clip"><div class="${p}gr" id="${p}gr"></div></div>`;
    const larg = [0.62, 0.74, 0.5, 0.68];
    (o.lignes || []).forEach((t, i) => {
      svg += `<div class="${p}li" id="${p}li${i}" style="left:${px + 22 * k}px;top:${py + (58 + i * 22) * k}px;width:${(pw - 44 * k) * larg[i % 4] / 0.74}px"></div>`;
      js += `tl.to('#${p}li${i}', { scaleX: 1, duration: 0.25, ease: 'power2.out' }, ${f3(t)});\n`;
    });
    if (o.accent !== undefined) {
      const hs = [16, 30, 44, 26, 38, 20, 12].map((h) => h * k), bx = px + 26 * k, by = py + ph - 40 * k;
      hs.forEach((h, i) => {
        svg += `<div class="${p}ob" id="${p}ob${i}" style="left:${bx + i * 14 * k}px;top:${by - h / 2}px;height:${h}px"></div>`;
        js += `tl.to('#${p}ob${i}', { scaleY: 1, duration: 0.18, ease: 'power2.out' }, ${f3(o.accent + i * S.cascade)});\n`;
      });
    }
    js += grainJs(`#${p}gr`, o.entree, fin, 991, 60);
  } else {
    const k = T / 210, R = 92 * k, c = T / 2;
    let graduations = '';
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6, r0 = R - (i % 3 === 0 ? 18 : 10) * k, r1 = R - 5 * k;
      graduations += `<line x1="${c + r0 * Math.sin(a)}" y1="${c - r0 * Math.cos(a)}" x2="${c + r1 * Math.sin(a)}" y2="${c - r1 * Math.cos(a)}"/>`;
    }
    css += `
#${p}cad{fill:${S.verreObjet};stroke:${S.filetFort};stroke-width:${S.trait};}
#${p}obj line{stroke:rgba(244,239,228,0.6);stroke-width:${2 * k};stroke-linecap:round;}
#${p}pet{position:absolute;left:${c - 2}px;top:${c - 50 * k}px;width:4px;height:${50 * k}px;border-radius:2px;background:${S.creme};transform-origin:50% 100%;}
#${p}aig{position:absolute;left:${c - 2}px;top:${c - 72 * k}px;width:4px;height:${72 * k}px;border-radius:2px;background:${S.dore};filter:${haloTrait};transform-origin:50% 100%;}
#${p}axe{position:absolute;left:${c - 6}px;top:${c - 6}px;width:12px;height:12px;border-radius:50%;background:${S.dore};}`;
    svg = `<svg width="${T}" height="${T}"><circle id="${p}cad" cx="${c}" cy="${c}" r="${R}"/>${graduations}</svg><div id="${p}pet" style="transform:rotate(300deg)"></div><div id="${p}aig"></div><div id="${p}axe"></div>`;
    if (o.tour) js += `tl.fromTo('#${p}aig', { rotation: 0 }, { rotation: ${360 * (o.tour.tours ?? 1)}, duration: ${f3(o.tour.t1 - o.tour.t0)}, ease: 'none', immediateRender: true }, ${f3(o.tour.t0)});\n`;
  }
  const html = `  <div id="${p}obj">${svg}</div>` + (o.etiquette ? `<div class="${p}et" id="${p}et">${o.etiquette.texte}</div>` : '') + '\n';
  js = ent(`#${p}obj`, o.entree) + js;
  if (o.etiquette) js += ent(`#${p}et`, o.etiquette.t, { flou: S.entree.flou, d: S.entree.duree });
  if (o.sortie !== undefined) js += sortie(`#${p}obj, #${p}et`, o.sortie, { d: 0.17, flou: 12 });
  return { css, html, js };
}
