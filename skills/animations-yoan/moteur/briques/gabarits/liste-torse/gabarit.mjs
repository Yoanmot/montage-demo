// Liste à puces sur le torse (2026-10-23, retours de Yoan sur la démo : « une petite animation en mode bullet points sur
// mon torse avec "script de vidéo", "messages", "etc." »). Construite depuis liste-cascade : une ligne par idée dite,
// qui entre depuis un flou en glissant de 14 px, calée sur son mot ; les crochets dorés se resserrent sur la première
// ligne puis glissent de ligne en ligne (0,22 s, power2.inOut) ; la puce de la ligne active passe au doré avec halo, les
// lignes déjà dites restent, plus discrètes. Pas de panneau autour : chaque ligne est une bande de verre sombre (verre sur
// caméra, filet crème 1,5 px, rayon du champ), posée sur le buste, sous le menton, loin des sous-titres. Muet par défaut.
import { S, f3, ent, sortie, crochetsCss, crochetsHtml, crochetsEntree, crochetsVers, esc, RGB_D } from '../commun.mjs';

// o = {
//   x = 296, y = 1190            coin haut gauche de la première ligne (image 1080 x 1920)
//   w = 600, h = 84, pas = 100   largeur et hauteur d'une ligne, pas entre lignes
//   taille = 40                  corps du texte (Inter, capitales espacées)
//   police = 'inter'             'inter' (voix d'interface) ou 'jetbrains' (JetBrains Mono, voix des étiquettes)
//   items: [{ texte, t }]        une ligne par idée dite, instant d'entrée (0,04 à 0,12 s avant le mot)
//   actif: [{ t, i }]            défaut : chaque ligne devient active à son entrée
//   sortie                       disparition vers un flou (sinon coupée par le calque, ou par un faisceau)
// }
export function listeTorse(p, o) {
  const x = o.x ?? 296, y = o.y ?? 1190, w = o.w ?? 600, h = o.h ?? 84, pas = o.pas ?? 100, taille = o.taille ?? 40, mono = o.police === 'jetbrains';
  const actif = o.actif ?? o.items.map((it, i) => ({ t: it.t + 0.04, i }));
  const boite = (i) => ({ x: x - 12, y: y + i * pas - 12, w: w + 24, h: h + 24 });
  const css = `
.${p}r{position:absolute;left:${x}px;width:${w}px;height:${h}px;box-sizing:border-box;border-radius:${S.rayon.champ}px;background:${S.verreCam};
  border:${S.trait}px solid ${S.filet};opacity:0;}
.${p}pu{position:absolute;left:30px;top:50%;width:16px;height:16px;margin-top:-8px;border-radius:50%;background:rgba(244,239,228,0.55);}
.${p}tx{position:absolute;left:68px;top:50%;transform:translateY(-50%);font-family:'${mono ? S.etiquettes.jetbrains.family : S.ui.family}';font-weight:${mono ? 500 : 600};font-size:${mono ? taille - 4 : taille}px;letter-spacing:${mono ? 0.12 : 0.05}em;
  text-transform:uppercase;color:${S.texteUI};white-space:nowrap;}
${crochetsCss(`${p}cr`)}`;
  const html = o.items.map((it, i) => `<div class="${p}r" id="${p}r${i}" style="top:${y + i * pas}px"><div class="${p}pu" id="${p}pu${i}"></div>`
    + `<div class="${p}tx" id="${p}tx${i}">${esc(it.texte)}</div></div>`).join('') + crochetsHtml(`${p}c`, `${p}cr`, boite(actif[0]?.i ?? 0));
  let js = '';
  o.items.forEach((it, i) => { js += ent(`#${p}r${i}`, it.t, { flou: S.entree.flou, d: S.entree.duree, y: 14 }); });
  actif.forEach((a, k) => {
    js += k === 0 ? crochetsEntree(`${p}c`, a.t) : crochetsVers(`${p}c`, a.t, boite(a.i));
    js += `tl.to('#${p}pu${a.i}', { backgroundColor: '${S.dore}', boxShadow: '0 0 6px rgba(${RGB_D},0.75), 0 0 16px rgba(${RGB_D},0.45)', duration: 0.2, ease: 'power2.out' }, ${f3(a.t)});\n`;
    if (k > 0) {
      const prev = actif[k - 1].i;
      js += `tl.to('#${p}pu${prev}', { backgroundColor: 'rgba(244,239,228,0.55)', boxShadow: '0 0 0px rgba(${RGB_D},0), 0 0 0px rgba(${RGB_D},0)', duration: 0.2, ease: 'power2.out' }, ${f3(a.t)});\n`;
      js += `tl.to('#${p}tx${prev}', { color: '${S.secondaire}', duration: 0.2, ease: 'power2.out' }, ${f3(a.t)});\n`;
    }
  });
  if (o.sortie !== undefined) js += sortie(o.items.map((_, i) => `#${p}r${i}`).join(', ') + `, #${p}c`, o.sortie);
  return { css, html, js, boites: o.items.map((_, i) => boite(i)) };
}
