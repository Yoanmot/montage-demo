// Contenu de panneau : liste qui se construit en cascade, calée sur la voix (une ligne par idée dite), avec les
// crochets dorés qui se posent sur la ligne dont on parle et glissent vers la suivante (on transforme, on ne remplace pas).
// À poser dans panneau-viseurs (coordonnées relatives au panneau).
import { S, f3, ent, icone, etiqCss, crochetsCss, crochetsHtml, crochetsEntree, crochetsVers, esc } from '../commun.mjs';

// o = {
//   w                                  largeur du panneau
//   y0 = 120, pas = 104                haut de la première ligne et pas entre lignes (relatifs au panneau)
//   items: [{ icone, texte, tag, t }]  icône (commun.ICONES), texte en voix d'interface, étiquette à droite, instant
//   actif: [{ t, i }]                  les crochets dorés arrivent sur la ligne i (1re fois : ils se resserrent),
//                                      puis glissent de ligne en ligne
//   etiquettes = 'jetbrains' (S.etiquette, verrouillé au tour 10)
// }
export function listeCascade(p, o) {
  const W = o.w, y0 = o.y0 ?? 120, pas = o.pas ?? 104, fam = o.etiquettes ?? S.etiquette, ui = S.ui;
  const ligne = (i) => ({ x: 18, y: y0 + i * pas - 10, w: W - 36, h: pas - 12 });
  const css = `
.${p}r{position:absolute;left:36px;right:36px;height:${pas - 32}px;opacity:0;}
.${p}ti{position:absolute;left:0;top:0;width:${pas - 32}px;height:${pas - 32}px;box-sizing:border-box;border-radius:16px;background:${S.tuile};
  border:${S.trait}px solid rgba(142,119,104,0.7);display:flex;align-items:center;justify-content:center;}
.${p}tx{position:absolute;left:${pas - 32 + 30}px;top:50%;transform:translateY(-50%);font-family:'${ui.family}';font-weight:500;font-size:${ui.taille + 2}px;color:${S.texteUI};white-space:nowrap;letter-spacing:-0.005em;}
${etiqCss(`${p}tg`, fam, { taille: 21, couleur: 'rgba(242,238,230,0.48)' })}
.${p}tg{position:absolute;right:6px;top:50%;transform:translateY(-50%);}
${crochetsCss(`${p}cr`)}`;
  const html = o.items.map((it, i) => `<div class="${p}r" id="${p}r${i}" style="top:${y0 + i * pas}px">`
    + `<div class="${p}ti">${icone(it.icone, 40)}</div><div class="${p}tx">${esc(it.texte)}</div>${it.tag ? `<div class="${p}tg">${it.tag}</div>` : ''}</div>`).join('')
    + crochetsHtml(`${p}c`, `${p}cr`, ligne((o.actif?.[0]?.i) ?? 0));
  let js = '';
  o.items.forEach((it, i) => { js += ent(`#${p}r${i}`, it.t, { flou: S.entree.flou, d: S.entree.duree, y: 14 }); });
  (o.actif || []).forEach((a, k) => {
    js += k === 0 ? crochetsEntree(`${p}c`, a.t) : crochetsVers(`${p}c`, a.t, ligne(a.i));
  });
  return { css, html, js };
}
