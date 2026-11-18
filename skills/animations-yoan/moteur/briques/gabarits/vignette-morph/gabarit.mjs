// Gabarit 6 (reel 4, animations 4, 8, 12) : vignette qui se transforme. Un grand chiffre posé au centre d'une
// vignette rétrécit et devient une pastille dorée en haut à gauche (morph en 0,35 s), un titre se pose à côté, puis
// une liste éclot ligne par ligne sous la pastille. On transforme, on ne remplace pas.
import { S, f3, ent, icone, etiqCss, croix, grainCss, grainJs, esc } from '../commun.mjs';

// o = {
//   box: { x, y, w, h }                vignette (panneau de verre à viseurs, fond chaud flouté)
//   entree                             apparition de la vignette (fondu depuis un flou)
//   chiffre: { texte, unite, t, taille = 300 }   grand chiffre crème (Satoshi Black) et son unité en étiquette
//   pastille: { t, d = 0.35, diametre = 88 }     le chiffre rejoint la pastille (haut gauche de la vignette)
//   titre: { texte, t }                texte d'interface à droite de la pastille
//   lignes: [{ icone, texte, t }]      liste qui éclot dessous (icône en tuile + texte)
//   etiquettes = 'jetbrains' (S.etiquette, verrouillé au tour 10)
// }
export function vignetteMorph(p, o) {
  const B = o.box, fam = o.etiquettes ?? S.etiquette, ui = S.ui, C = o.chiffre, P = o.pastille, D = P.diametre ?? 88;
  const taille = C.taille ?? 300, cx = B.w / 2, cy = B.h / 2 - 40;
  const pcx = 48 + D / 2, pcy = 48 + D / 2;                      // centre de la pastille (relatif à la vignette)
  const k = (D * 0.42) / taille;                                    // échelle du chiffre dans la pastille
  const cr = croix(`${p}k`, B);
  const css = `
#${p}vg{position:absolute;left:${B.x}px;top:${B.y}px;width:${B.w}px;height:${B.h}px;box-sizing:border-box;border-radius:${S.rayon.panneau}px;overflow:hidden;
  background:${S.verre};border:${S.trait}px solid ${S.filet};opacity:0;z-index:20;}
#${p}vf{position:absolute;left:0;top:0;right:0;bottom:0;filter:blur(40px);
  background:radial-gradient(ellipse 55% 60% at 78% 18%,rgba(172,96,50,0.5),rgba(172,96,50,0) 70%),radial-gradient(ellipse 60% 70% at 15% 90%,rgba(76,39,19,0.85),rgba(76,39,19,0) 70%);}
${grainCss(`${p}gr`, 0.4)}
#${p}ch{position:absolute;left:${cx - 400}px;top:${cy - taille / 2}px;width:800px;height:${taille}px;display:flex;align-items:center;justify-content:center;
  font-family:'Satoshi';font-weight:900;font-size:${taille}px;line-height:1;letter-spacing:-0.02em;color:${S.blanc};opacity:0;z-index:3;}
${etiqCss(`${p}un`, fam, { couleur: S.secondaire })}
#${p}un{position:absolute;left:0;width:${B.w}px;top:${cy + taille / 2 + 10}px;text-align:center;opacity:0;padding-left:0.24em;box-sizing:border-box;}
#${p}pa{position:absolute;left:${pcx - D / 2}px;top:${pcy - D / 2}px;width:${D}px;height:${D}px;border-radius:50%;background:${S.dore};opacity:0;transform:scale(0);
  box-shadow:0 0 14px rgba(242,181,68,0.55),0 0 34px rgba(242,181,68,0.25);z-index:2;}
#${p}ti{position:absolute;left:${pcx + D / 2 + 28}px;top:${pcy}px;transform:translateY(-50%);font-family:'${ui.family}';font-weight:600;font-size:${ui.taille + 6}px;color:${S.texteUI};opacity:0;white-space:nowrap;}
#${p}sep{position:absolute;left:48px;right:48px;top:${pcy + D / 2 + 34}px;height:1.5px;background:${S.filetDoux};transform:scaleX(0);transform-origin:0 50%;}
.${p}r{position:absolute;left:48px;right:48px;height:76px;opacity:0;}
.${p}rt{position:absolute;left:0;top:0;width:76px;height:76px;box-sizing:border-box;border-radius:16px;background:${S.tuile};border:${S.trait}px solid rgba(142,119,104,0.7);display:flex;align-items:center;justify-content:center;}
.${p}rx{position:absolute;left:106px;top:50%;transform:translateY(-50%);font-family:'${ui.family}';font-weight:500;font-size:${ui.taille + 2}px;color:${S.texteUI};white-space:nowrap;}
${cr.css}`;
  const y0 = pcy + D / 2 + 68;
  const html = `  <div id="${p}vg"><div id="${p}vf"></div><div class="${p}gr" id="${p}gr"></div><div id="${p}pa"></div><div id="${p}ch">${esc(C.texte)}</div>`
    + `<div id="${p}un" class="${p}un">${C.unite ?? ''}</div><div id="${p}ti">${esc(o.titre?.texte ?? '')}</div><div id="${p}sep"></div>`
    + (o.lignes || []).map((l, i) => `<div class="${p}r" id="${p}r${i}" style="top:${y0 + i * 100}px"><div class="${p}rt">${icone(l.icone, 40)}</div><div class="${p}rx">${esc(l.texte)}</div></div>`).join('')
    + `</div>${cr.html}\n`;
  let js = ent(`#${p}vg`, o.entree) + grainJs(`#${p}gr`, o.entree, (o.fin ?? o.entree + 10), 2468, 80);
  js += `tl.fromTo('${cr.sel}', { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.2, ease: 'power2.out', immediateRender: true }, ${f3(o.entree + 0.05)});\n`;
  js += ent(`#${p}ch`, C.t, { flou: 20, d: 0.22 }) + ent(`#${p}un`, C.t + 0.08, { flou: S.entree.flou, d: S.entree.duree });
  // le morph : le chiffre file vers la pastille en rétrécissant et passe au brun sombre ; la pastille éclot dessous
  const d = P.d ?? 0.35;
  js += `tl.to('#${p}un', { opacity: 0, filter: 'blur(10px)', duration: 0.12, ease: 'power1.in' }, ${f3(P.t)});\n`;
  js += `tl.to('#${p}ch', { x: ${pcx - cx}, y: ${pcy - cy}, scale: ${k.toFixed(4)}, color: '#2A1A0E', duration: ${d}, ease: 'power2.inOut' }, ${f3(P.t)});\n`;
  js += `tl.to('#${p}pa', { opacity: 1, scale: 1, duration: ${f3(d * 0.55)}, ease: 'power2.out' }, ${f3(P.t + d * 0.45)});\n`;
  if (o.titre) js += ent(`#${p}ti`, o.titre.t, { flou: S.entree.flou, d: S.entree.duree });
  if (o.lignes?.length) js += `tl.to('#${p}sep', { scaleX: 1, duration: 0.3, ease: 'power2.out' }, ${f3(o.lignes[0].t - 0.1)});\n`;
  (o.lignes || []).forEach((l, i) => { js += ent(`#${p}r${i}`, l.t, { flou: S.entree.flou, d: S.entree.duree, y: 14 }); });
  return { css, html, js };
}
