// Contenu de panneau : schéma simple qui se construit en direct. Des nœuds (tuile d'icône + étiquette) éclosent un à un,
// des traits fins se tracent de l'un à l'autre, les crochets dorés se posent sur le nœud dont on parle ; en option, une
// consigne se tape dans un champ en bas du panneau. À poser dans panneau-viseurs (coordonnées relatives au panneau).
import { S, f3, ent, icone, etiqCss, crochetsCss, crochetsHtml, crochetsEntree, crochetsVers, frappe, esc, haloTrait } from '../commun.mjs';

// o = {
//   noeuds: [{ x, y, icone, etiquette, t }]   centre de la tuile (relatif au panneau), instant d'éclosion
//   tuile = 150                        côté des tuiles (rayon 21)
//   liens: [{ de, a, t, d = 0.35 }]    trait crème qui se trace du nœud « de » au nœud « a »
//   actif: [{ t, i }]                  crochets dorés sur le nœud i (1re fois : ils se resserrent), puis glissent
//   consigne: { y, texte, debut, cps, t }   champ en bas qui apparaît à t et se tape (facultatif)
//   etiquettes = 'jetbrains' (S.etiquette, verrouillé au tour 10)
// }
export function schemaNoeuds(p, o) {
  const T = o.tuile ?? 150, fam = o.etiquettes ?? S.etiquette, ui = S.ui;
  const N = o.noeuds;
  const boite = (n) => ({ x: n.x - T / 2 - 16, y: n.y - T / 2 - 16, w: T + 32, h: T + 32 });
  let css = `
.${p}n{position:absolute;width:${T}px;height:${T}px;box-sizing:border-box;border-radius:${S.rayon.tuile}px;background:${S.tuile};
  border:${S.trait}px solid rgba(142,119,104,0.75);display:flex;align-items:center;justify-content:center;opacity:0;}
${etiqCss(`${p}ne`, fam)}
.${p}ne{position:absolute;transform:translateX(-50%);opacity:0;}
#${p}svg{position:absolute;left:0;top:0;overflow:visible;}
#${p}svg line{stroke:${S.filetFort};stroke-width:2;stroke-linecap:round;}
#${p}svg circle{fill:${S.creme};opacity:0;}
${crochetsCss(`${p}cr`)}`;
  let svg = '', html = '', js = '';
  (o.liens || []).forEach((l, i) => {
    const a = N[l.de], b = N[l.a];
    const ang = Math.atan2(b.y - a.y, b.x - a.x), r = T / 2 + 14;
    const x1 = a.x + r * Math.cos(ang), y1 = a.y + r * Math.sin(ang), x2 = b.x - r * Math.cos(ang), y2 = b.y - r * Math.sin(ang);
    const L = Math.hypot(x2 - x1, y2 - y1);
    svg += `<line id="${p}l${i}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-dasharray="${L}" stroke-dashoffset="${L}"/>`
      + `<circle id="${p}la${i}" cx="${x1}" cy="${y1}" r="4"/><circle id="${p}lb${i}" cx="${x2}" cy="${y2}" r="4"/>`;
    js += `tl.set('#${p}la${i}', { opacity: 1 }, ${f3(l.t)});\n`;
    js += `tl.to('#${p}l${i}', { strokeDashoffset: 0, duration: ${l.d ?? 0.35}, ease: 'power2.inOut' }, ${f3(l.t)});\n`;
    js += `tl.set('#${p}lb${i}', { opacity: 1 }, ${f3(l.t + (l.d ?? 0.35))});\n`;
  });
  html += `<svg id="${p}svg" width="10" height="10">${svg}</svg>`;
  N.forEach((n, i) => {
    html += `<div class="${p}n" id="${p}n${i}" style="left:${n.x - T / 2}px;top:${n.y - T / 2}px">${icone(n.icone, Math.round(T * 0.42))}</div>`
      + `<div class="${p}ne" id="${p}ne${i}" style="left:${n.x}px;top:${n.y + T / 2 + 34}px">${n.etiquette}</div>`;
    js += `tl.fromTo('#${p}n${i}', { opacity: 0, scale: 0.15, filter: 'blur(6px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.15, ease: 'power2.out', immediateRender: true }, ${f3(n.t)});\n`;
    js += ent(`#${p}ne${i}`, n.t + S.cascade, { flou: S.entree.flou, d: S.entree.duree });
  });
  if (o.actif?.length) {
    html += crochetsHtml(`${p}c`, `${p}cr`, boite(N[o.actif[0].i]));
    o.actif.forEach((a, k) => { js += k === 0 ? crochetsEntree(`${p}c`, a.t) : crochetsVers(`${p}c`, a.t, boite(N[a.i])); });
  }
  if (o.consigne) {
    const c = o.consigne, cs = frappe(c.texte, c.debut, c.cps, 99);
    css += `
#${p}cs{position:absolute;left:36px;right:36px;top:${c.y}px;height:96px;box-sizing:border-box;border-radius:${S.rayon.champ}px;background:rgba(28,24,19,0.7);
  border:${S.trait}px solid ${S.filet};opacity:0;font-family:'${ui.family}';font-weight:${ui.poids};font-size:${ui.taille - 2}px;color:${S.texteUI};}
#${p}cst{position:absolute;left:28px;right:80px;top:50%;transform:translateY(-50%);white-space:nowrap;overflow:hidden;}
.${p}cc{display:none;}
#${p}car{display:inline-block;width:3px;height:${ui.taille}px;margin-left:2px;vertical-align:-6px;background:${S.texteUI};}
#${p}cenv{position:absolute;right:20px;top:50%;margin-top:-23px;width:46px;height:46px;border-radius:${S.rayon.bouton}px;background:${S.dore};opacity:0.4;}
#${p}cenv svg{position:absolute;left:11px;top:11px;}`;
    html += `<div id="${p}cs"><div id="${p}cst">` + cs.map(([ch], i) => `<span class="${p}cc" id="${p}cc${i}">${esc(ch)}</span>`).join('') + `<span id="${p}car"></span></div>`
      + `<div id="${p}cenv"><svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6" stroke="#1A120C" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>`;
    js += ent(`#${p}cs`, c.t);
    cs.forEach(([, tt], i) => { js += `tl.set('#${p}cc${i}', { display: 'inline' }, ${f3(tt)});\n`; });
    js += `tl.set('#${p}cenv', { opacity: 1 }, ${f3(c.debut)});\n`;
    const fin = cs[cs.length - 1][1];
    for (let tt = fin + 0.25; tt < fin + 6; tt += 0.5) js += `tl.set('#${p}car', { opacity: 0 }, ${f3(tt)});\ntl.set('#${p}car', { opacity: 1 }, ${f3(tt + 0.25)});\n`;
  }
  return { css, html, js };
}
