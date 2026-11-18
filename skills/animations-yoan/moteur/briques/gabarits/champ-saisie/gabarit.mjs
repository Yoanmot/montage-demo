// Gabarit 1 (reel 4, animation 1) : champ de saisie en verre sombre posé sur la caméra, qui se tape en direct,
// dont une ou plusieurs lignes sont raturées en doré, puis qui s'écrase en une ligne (4 images) et disparaît.
import { S, f3, ent, grainCss, grainJs, frappe, esc } from '../commun.mjs';

// o = {
//   x, y, w = 705, h = 200          boîte du champ (px de l'image 1080x1920)
//   entree                           instant d'apparition (fondu depuis un flou, 5 images)
//   lignes: ['...', '...']           texte tapé, une entrée par ligne affichée
//   frappe: { debut, cps }           début de la frappe et débit (caractères par seconde)
//   ratures: [{ ligne, t }]          lignes raturées en doré (trait 3 px tracé de gauche à droite en 0,1 s)
//   ecrasement: { t, vers }          l'écrasement vertical en 0,13 s ; vers 'ligne' (reste un filet qui se rétracte)
//                                    ou 'rien' (s'efface aussitôt)
//   placeholder, libelle             texte gris avant la frappe, nom discret à côté du bouton d'envoi
// }
export function champSaisie(p, o) {
  const w = o.w ?? 705, h = o.h ?? 200, R = S.rayon.champ, ui = S.ui;
  const lh = Math.round(ui.taille * 1.3);
  let idx = 0; const lignes = [];
  let t = o.frappe.debut;
  o.lignes.forEach((txt, li) => {
    const cs = frappe(txt + (li < o.lignes.length - 1 ? '' : ''), t, o.frappe.cps, 4242 + li);
    lignes.push(cs.map(([c, tt]) => ({ c, t: tt, i: idx++ })));
    t = cs[cs.length - 1][1] + 0.12;
  });
  const finFrappe = t;
  const css = `
#${p}champ{position:absolute;left:${o.x}px;top:${o.y}px;width:${w}px;height:${h}px;box-sizing:border-box;border-radius:${R}px;overflow:hidden;
  background:${S.verreCam};border:${S.trait}px solid ${S.filet};opacity:0;transform-origin:50% 50%;z-index:20;}
${grainCss(`${p}gr`, 0.35)}
#${p}txt{position:absolute;left:30px;right:30px;top:24px;font-family:'${ui.family}';font-weight:${ui.poids};font-size:${ui.taille}px;line-height:${lh}px;color:${S.texteUI};letter-spacing:-0.005em;}
#${p}ph{position:absolute;left:0;top:0;color:${S.attenue};white-space:nowrap;}
.${p}l{display:block;height:${lh}px;white-space:nowrap;}
.${p}lt{position:relative;display:inline-block;}
.${p}c{display:none;}
.${p}car{display:inline-block;width:3px;height:${Math.round(ui.taille * 1.1)}px;margin-left:2px;vertical-align:-6px;background:${S.texteUI};opacity:0;}
.${p}rat{position:absolute;left:-4px;right:-4px;top:52%;height:3px;margin-top:-1.5px;background:${S.dore};transform:scaleX(0);transform-origin:0 50%;
  box-shadow:0 0 6px rgba(242,181,68,0.7),0 0 14px rgba(242,181,68,0.3);}
#${p}plus{position:absolute;left:24px;bottom:20px;width:42px;height:42px;box-sizing:border-box;border-radius:${S.rayon.bouton}px;border:${S.trait}px solid ${S.filet};
  color:${S.secondaire};font-family:'Inter';font-size:30px;line-height:38px;text-align:center;font-weight:300;}
#${p}lib{position:absolute;right:92px;bottom:30px;font-family:'Inter';font-size:22px;color:${S.attenue};font-weight:500;}
#${p}env{position:absolute;right:24px;bottom:20px;width:46px;height:46px;border-radius:${S.rayon.bouton}px;background:${S.dore};opacity:0.4;}
#${p}env svg{position:absolute;left:11px;top:11px;}
#${p}fil{position:absolute;left:${o.x}px;top:${o.y + h / 2 - 1}px;width:${w}px;height:2px;background:${S.filetFort};opacity:0;transform-origin:50% 50%;z-index:20;}`;
  const html = `  <div id="${p}champ"><div class="${p}gr" id="${p}gr"></div><div id="${p}txt"><span id="${p}ph">${esc(o.placeholder ?? 'Écris à ton assistant…')}</span>`
    + lignes.map((cs, li) => `<span class="${p}l"><span class="${p}lt" id="${p}lt${li}">` + cs.map(({ c, i }) => `<span class="${p}c" id="${p}c${i}">${esc(c)}</span>`).join('')
      + `<span class="${p}rat" id="${p}rat${li}"></span></span><span class="${p}car" id="${p}car${li}"></span></span>`).join('')
    + `</div><div id="${p}plus">+</div><div id="${p}lib">${esc(o.libelle ?? 'Assistant')}</div>`
    + `<div id="${p}env"><svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6" stroke="#1A120C" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>`
    + `<div id="${p}fil"></div>\n`;
  const fin = o.ecrasement ? o.ecrasement.t + 0.5 : finFrappe + 2;
  let js = ent(`#${p}champ`, o.entree) + grainJs(`#${p}gr`, o.entree, fin, 777, 60);
  js += `tl.set('#${p}ph', { opacity: 0 }, ${f3(o.frappe.debut)});\ntl.set('#${p}env', { opacity: 1 }, ${f3(o.frappe.debut)});\n`;
  lignes.forEach((cs, li) => {
    js += `tl.set('#${p}car${li}', { opacity: 1 }, ${f3(cs[0].t)});\n`;
    cs.forEach(({ t: tt, i }) => { js += `tl.set('#${p}c${i}', { display: 'inline' }, ${f3(tt)});\n`; });
    if (li < lignes.length - 1) js += `tl.set('#${p}car${li}', { opacity: 0 }, ${f3(lignes[li + 1][0].t)});\n`;
  });
  // curseur qui clignote après la frappe (0,5 s), jusqu'à l'écrasement
  const last = lignes.length - 1;
  for (let tt = finFrappe + 0.25; tt < (o.ecrasement ? o.ecrasement.t : fin) - 0.05; tt += 0.5) {
    js += `tl.set('#${p}car${last}', { opacity: 0 }, ${f3(tt)});\ntl.set('#${p}car${last}', { opacity: 1 }, ${f3(tt + 0.25)});\n`;
  }
  (o.ratures || []).forEach(({ ligne, t: tt }) => { js += `tl.to('#${p}rat${ligne}', { scaleX: 1, duration: 0.1, ease: 'none' }, ${f3(tt)});\n`; });
  if (o.ecrasement) {
    const te = o.ecrasement.t;
    js += `tl.to('#${p}champ', { scaleY: ${(2 / h).toFixed(4)}, duration: ${S.morph}, ease: 'power2.in' }, ${f3(te)});\n`;
    js += `tl.to('#${p}txt, #${p}plus, #${p}lib, #${p}env', { opacity: 0, duration: 0.07, ease: 'none' }, ${f3(te)});\n`;
    js += `tl.set('#${p}champ', { opacity: 0 }, ${f3(te + S.morph)});\ntl.set('#${p}fil', { opacity: 1 }, ${f3(te + S.morph)});\n`;
    if (o.ecrasement.vers === 'rien') js += `tl.set('#${p}fil', { opacity: 0 }, ${f3(te + S.morph + 0.034)});\n`;
    else js += `tl.to('#${p}fil', { scaleX: 0, opacity: 0, duration: 0.22, ease: 'power2.in' }, ${f3(te + S.morph + 0.1)});\n`;
  }
  return { css, html, js, finFrappe, instants: { ecrasement: o.ecrasement?.t } };
}
