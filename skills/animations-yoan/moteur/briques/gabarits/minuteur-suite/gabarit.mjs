// Minuteur et sa suite (carte r11-03b du labo, retrouvée le 2026-10-23 : « l'animation qui est la continuité du minuteur
// de 30 min qui explique mieux ») : le minuteur doré présenté comme le CTA, qui se réduit en continuant de défiler pendant
// que le panneau arrive dessous et se remplit, une ligne par chose dite (liste en cascade, crochets qui glissent).
// Assemble minuteur + panneau-viseurs + liste-cascade (une seule version de chaque geste) ; sur la caméra, le verre du
// panneau passe au verre caméra (r11-03b).
import { S } from '../commun.mjs';
import { minuteur } from '../minuteur/gabarit.mjs';
import { panneau } from '../panneau-viseurs/gabarit.mjs';
import { listeCascade } from '../liste-cascade/gabarit.mjs';

// o = {
//   minuteur: { cx, cy, depart, entree, debut, fin, etiquette, reduction: { t, d, x, y, echelle } }   (voir minuteur/README.md)
//   panneau:  { x, y, w, entree, sortie?, entete: { gauche, droite } }
//   liste:    { y0 = 124, pas = 96, items: [{ icone, texte, t }] }    les crochets suivent chaque ligne à son arrivée (+0,06 s)
//   camera = true                                                    verre caméra (rgba 34,30,24 à 80 %)
// }
export function minuteurSuite(p, o) {
  const mi = minuteur(`${p}m`, o.minuteur);
  const L = o.liste, pas = L.pas ?? 96, y0 = L.y0 ?? 124;
  const items = L.items;
  const li = listeCascade(`${p}l`, { w: o.panneau.w, y0, pas, items, actif: items.map((it, i) => ({ t: +(it.t + 0.06).toFixed(3), i })) });
  const pa = panneau(`${p}p`, { ...o.panneau, h: o.panneau.h ?? y0 + items.length * pas - 4, contenu: li });
  let css = mi.css + pa.css;
  if (o.camera ?? true) css = css.split(`background:${S.verre}`).join(`background:${S.verreCam}`);
  return { css, html: pa.html + mi.html, js: mi.js + pa.js, minuteur: { boite: mi.boite, reduit: mi.reduit, lignes: mi.lignes } };
}
