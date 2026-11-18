// Minuteur (tour 11, r11-03, demande de Yoan sur r10-04b) : au mot qui donne la durée, un minuteur doré MM:SS:CC
// (minutes, secondes, centièmes) qui défile en grand, présenté comme le CTA verrouillé (r6-01a / r6-01b) : Satoshi Black
// 126 px doré avec halo, quatre « + » crème posés à 30 px des côtés de l'encre et 24 px du haut et du bas, grosses lignes
// de 3 px qui se tirent à travers le cadre 0,25 s après l'entrée, tiennent 0,7 s, s'effacent en 0,45 s ; quadrillage de
// 60 px seulement sur fond uni. Puis il se réduit vers un coin haut gauche en continuant de défiler.
// Chiffres en colonnes de largeur fixe (rien ne bouge quand un chiffre change) : chaque position porte les 10 chiffres
// superposés au même endroit, seul le chiffre courant est visible (aucun texte réécrit, aucun halo rogné).
import { S, f3, halo, etiqCss, esc } from '../commun.mjs';
import { encre } from '../../encre/encre.mjs';

// o = {
//   cx, cy                      centre du minuteur en grand
//   taille = 126                corps (celui du mot du CTA)
//   depart = 1800               valeur de départ en secondes (30 min) ; il descend en temps réel dès « debut »
//   entree                      apparition (fondu depuis un flou de 16 px en 0,26 s, comme le CTA)
//   debut = entree, fin         le défilement (on s'arrête à « fin »)
//   etiquette: { texte, t }     petite étiquette mono au-dessus (elle part au début de la réduction)
//   quadrillage = false         fond uni : quadrillage de 60 px fondu en ellipse (jamais sur la caméra)
//   reduction: { t, d = 0.45, x, y, echelle = 0.34 }   le bloc file vers (x, y) = coin haut gauche du minuteur réduit
//   sortie                      disparition (vers un flou)
// }
export function minuteur(p, o) {
  const taille = o.taille ?? 126, depart = o.depart ?? 1800, debut = o.debut ?? o.entree;
  const dw = Math.round(taille * 0.72), cw = Math.round(taille * 0.36);    // colonnes : chiffre (avance max 0,718 em), deux-points
  const cols = ['d', 'd', ':', 'd', 'd', ':', 'd', 'd'];
  const W = cols.reduce((a, c) => a + (c === 'd' ? dw : cw), 0), H = taille;
  const x0 = Math.round(o.cx - W / 2), y0 = Math.round(o.cy - H / 2);
  const e = encre('0', taille, 1, 0);                                      // haut et bas de l'encre des chiffres
  const ink = { x0: Math.round((dw - 0.605 * taille) / 2), x1: W - Math.round((dw - 0.605 * taille) / 2), y0: Math.round(e.haut), y1: Math.round(H - e.bas) };
  const MX = 30, MY = 24, cx0 = ink.x0 - MX, cx1 = ink.x1 + MX, cy0 = ink.y0 - MY, cy1 = ink.y1 + MY;   // repères (relatifs au bloc)
  const R = o.reduction, k = R?.echelle ?? 0.34;
  // sur le torse (sous le milieu de l'image, 2026-10-23) : les lignes verticales partent 300 px au-dessus des « + » au lieu du
  // haut de l'image, pour ne jamais traverser le visage ni les sous-titres (même règle que le CTA sur le torse)
  const bas = o.cy > 960, vh = bas ? Math.max(0, y0 + cy0 - 300) : 0;
  let x = 0, html = '';
  const pos = [];
  cols.forEach((c, i) => {
    if (c === ':') { html += `<div class="${p}c2" style="left:${x}px;width:${cw}px">:</div>`; x += cw; return; }
    const id = `${p}d${i}`; pos.push(id);
    html += `<div class="${p}fen" style="left:${x}px;width:${dw}px">` + [...'0123456789'].map((d) => `<span id="${id}n${d}" style="opacity:0">${d}</span>`).join('') + `</div>`;
    x += dw;
  });
  const plus = [[cx0, cy0], [cx1, cy0], [cx0, cy1], [cx1, cy1]].map(([px, py], i) => `<div class="${p}pl" id="${p}pl${i}" style="left:${px - 16}px;top:${py - 16}px"></div>`).join('');
  const css = `
#${p}w{position:absolute;left:${x0}px;top:${y0}px;width:${W}px;height:${H}px;transform-origin:0 0;z-index:40;}
#${p}chi{position:absolute;left:0;top:0;width:${W}px;height:${H}px;opacity:0;}
.${p}fen{position:absolute;top:0;height:${H}px;}
.${p}fen span{position:absolute;left:0;top:0;width:100%;}
.${p}fen span,.${p}c2{display:block;height:${H}px;text-align:center;font-family:'Satoshi';font-weight:900;font-size:${taille}px;line-height:1;color:${S.dore};text-shadow:${halo()};}
.${p}c2{position:absolute;top:-0.04em;}
.${p}pl{position:absolute;width:32px;height:32px;opacity:0;} .${p}pl:before,.${p}pl:after{content:'';position:absolute;background:${S.creme};}
.${p}pl:before{left:15px;top:0;width:2px;height:32px;} .${p}pl:after{left:0;top:15px;width:32px;height:2px;}
${etiqCss(`${p}et`, S.etiquette, { taille: 30, couleur: S.creme })}
#${p}et{position:absolute;left:0;width:${W}px;top:${cy0 - 74}px;text-align:center;opacity:0;padding-left:0.3em;box-sizing:border-box;text-shadow:0 2px 14px rgba(0,0,0,0.55);}
#${p}lg{position:absolute;left:0;top:0;width:1080px;height:1920px;overflow:hidden;z-index:39;pointer-events:none;}
.${p}rep{position:absolute;opacity:0;}
.${p}rh{left:0;width:1080px;height:3px;margin-top:-1.5px;transform:scaleX(0);
  background:linear-gradient(90deg,rgba(244,239,228,0) 0%,rgba(244,239,228,0.62) 12%,rgba(244,239,228,0.62) 88%,rgba(244,239,228,0) 100%);}
.${p}rv{width:3px;margin-left:-1.5px;transform:scaleY(0);top:${vh}px;height:${bas ? 1920 - vh : Math.min(1920, y0 + cy1 + 260)}px;
  background:linear-gradient(180deg,rgba(244,239,228,0) 0%,rgba(244,239,228,0.62) ${bas ? 30 : 10}%,rgba(244,239,228,0.62) 75%,rgba(244,239,228,0) 100%);}
#${p}gr{position:absolute;left:0;top:0;width:1080px;height:1920px;opacity:0;z-index:5;
  background-image:linear-gradient(rgba(244,239,228,0.10) 1px,transparent 1px),linear-gradient(90deg,rgba(244,239,228,0.10) 1px,transparent 1px);
  background-size:60px 60px;background-position:${(x0 + cx0) % 60}px ${(y0 + cy0) % 60}px;
  -webkit-mask-image:radial-gradient(ellipse 70% 42% at 50% ${((y0 + H / 2) / 19.2).toFixed(1)}%,#000 30%,transparent 100%);mask-image:radial-gradient(ellipse 70% 42% at 50% ${((y0 + H / 2) / 19.2).toFixed(1)}%,#000 30%,transparent 100%);}`;
  const lignes = `<div class="${p}rep ${p}rh" id="${p}q1" style="top:${y0 + cy0}px"></div><div class="${p}rep ${p}rh" id="${p}q2" style="top:${y0 + cy1}px"></div>`
    + `<div class="${p}rep ${p}rv" id="${p}q3" style="left:${x0 + cx0}px"></div><div class="${p}rep ${p}rv" id="${p}q4" style="left:${x0 + cx1}px"></div>`;
  const out = `${o.quadrillage ? `<div id="${p}gr"></div>` : ''}<div id="${p}lg">${lignes}</div>`
    + `<div id="${p}w"><div id="${p}chi">${html}</div>${plus}${o.etiquette ? `<div id="${p}et" class="${p}et">${esc(o.etiquette.texte)}</div>` : ''}</div>\n`;
  // entrée comme le CTA : fondu depuis un flou de 16 px en 0,26 s ; repères 0,25 s après
  let js = `tl.fromTo('#${p}chi', { opacity: 0, filter: 'blur(16px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.26, ease: 'power2.out', immediateRender: true }, ${f3(o.entree)});\n`;
  if (o.quadrillage) js += `tl.fromTo('#${p}gr', { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'sine.out', immediateRender: true }, ${f3(o.entree + 0.02)});\n`;
  const L = o.entree + 0.25;
  js += `tl.set('.${p}rep', { opacity: 1 }, ${f3(L)});\ntl.to('#${p}q1, #${p}q2', { scaleX: 1, duration: 0.25, ease: 'power2.out' }, ${f3(L)});\n`;
  js += `tl.to('#${p}q3, #${p}q4', { scaleY: 1, duration: 0.25, ease: 'power2.out' }, ${f3(L)});\n`;
  js += `tl.fromTo('.${p}pl', { opacity: 0, scale: 0.4, rotation: -45 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.25, ease: 'power2.out', immediateRender: true }, ${f3(L + 0.05)});\n`;
  js += `tl.to('.${p}rep', { opacity: 0, duration: 0.45, ease: 'sine.inOut' }, ${f3(L + 0.95)});\n`;
  if (o.etiquette) js += `tl.fromTo('#${p}et', { opacity: 0, filter: 'blur(16px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.26, ease: 'power2.out', immediateRender: true }, ${f3(o.etiquette.t)});\n`;
  // défilement : valeur = depart - (t - debut), en centièmes ; une position ne bouge que quand son chiffre change
  const prev = {};
  const fixe = (cs) => { const m = Math.floor(cs / 6000), s = Math.floor(cs / 100) % 60, c = cs % 100; return `${String(m).padStart(2, '0')}${String(s).padStart(2, '0')}${String(c).padStart(2, '0')}`; };
  for (let f = Math.floor(o.entree * 30); f <= Math.ceil(o.fin * 30); f++) {
    const t = f / 30, v = Math.max(0, Math.round((depart - Math.max(0, t - debut)) * 100));
    const ch = fixe(v);
    pos.forEach((id, i) => {
      if (prev[id] === ch[i]) return;
      const tt = f3(f === Math.floor(o.entree * 30) ? 0 : t + 0.001);
      if (prev[id] !== undefined) js += `tl.set('#${id}n${prev[id]}', { opacity: 0 }, ${tt});\n`;
      js += `tl.set('#${id}n${ch[i]}', { opacity: 1 }, ${tt});\n`;
      prev[id] = ch[i];
    });
  }
  if (R) {
    if (o.etiquette) js += `tl.to('#${p}et', { opacity: 0, filter: 'blur(10px)', duration: 0.12, ease: 'power1.in' }, ${f3(R.t)});\n`;
    js += `tl.to('#${p}w', { x: ${R.x - x0 - k * ink.x0 + 0}, y: ${R.y - y0 - k * ink.y0}, scale: ${k}, duration: ${R.d ?? 0.45}, ease: 'power2.inOut' }, ${f3(R.t)});\n`;
  }
  if (o.sortie !== undefined) js += `tl.to('#${p}w', { opacity: 0, filter: 'blur(10px)', duration: 0.12, ease: 'power1.in' }, ${f3(o.sortie)});\n`;
  const reduit = R ? { x: R.x, y: R.y, w: Math.round(k * (ink.x1 - ink.x0)), h: Math.round(k * (ink.y1 - ink.y0)) } : null;
  return { css, html: out, js, boite: { x: x0, y: y0, w: W, h: H, ink, croix: { cx0, cx1, cy0, cy1 } }, reduit, lignes: L };
}
