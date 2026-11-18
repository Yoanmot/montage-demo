// Geste « appariement » (reel 4, animations 14 et 17) : deux tuiles d'icône éloignées ; l'une peut changer d'icône
// toutes les 0,2 à 0,3 s (« n'importe quel outil ») ; puis elles glissent l'une vers l'autre avec un flou de mouvement
// horizontal jusqu'au contact, et quatre petits « + » dorés se posent autour de la paire.
import { S, f3, ent, sortie, icone, etiqCss, RGB_D, esc, logo, tuileTeinte, captureCss, MARQUES } from '../commun.mjs';

// o = {
//   cy, taille = 200, ecart = 520      hauteur du centre des tuiles, côté des tuiles, distance entre centres au départ
//   gauche: { icone, etiquette, t }    tuile de gauche (apparition à t)
//   droite: { icones: [{ icone, t }], etiquettes: [{ texte, t }], t }   tuile de droite ; ses icônes se succèdent
//   contact: { t, d = 0.32, jeu = 14 } les tuiles glissent (power2.in puis arrêt net, flou de mouvement jusqu'à 26 px)
//   plus: { t }                        quatre « + » dorés autour de la paire
//   legende: { texte, t }              étiquette sous la paire réunie
//   etiquettes = 'jetbrains' (S.etiquette, verrouillé au tour 10), sortie
// }
export function appariement(p, o) {
  const T = o.taille ?? 200, E = o.ecart ?? 520, cy = o.cy, fam = o.etiquettes ?? S.etiquette;
  const xg = 540 - E / 2, xd = 540 + E / 2, jeu = o.contact?.jeu ?? 14;
  const xgF = 540 - T / 2 - jeu / 2, xdF = 540 + T / 2 + jeu / 2;   // centres au contact
  const tuile = `position:absolute;width:${T}px;height:${T}px;box-sizing:border-box;border-radius:${S.rayon.tuile}px;background:${S.tuile};
  border:${S.trait}px solid rgba(142,119,104,0.75);opacity:0;`;
  const css = `
.${p}t{${tuile}}
.${p}ic{position:absolute;left:0;top:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;opacity:0;}
${etiqCss(`${p}e`, fam)}
.${p}e{position:absolute;top:${cy + T / 2 + 34}px;transform:translateX(-50%);opacity:0;}
.${p}tt{position:absolute;left:-1.5px;top:-1.5px;right:-1.5px;bottom:-1.5px;box-sizing:border-box;border-radius:${S.rayon.tuile}px;border:${S.trait}px solid;}
.${p}ic svg{position:relative;}
#${p}cap{position:absolute;box-sizing:border-box;border-radius:${S.rayon.panneau}px;overflow:hidden;border:${S.trait}px solid ${S.filet};opacity:0;}
${captureCss(`#${p}capf`)}
#${p}capf{position:absolute;left:0;top:0;right:0;bottom:0;filter:blur(2px);}
.${p}cl{position:absolute;left:28px;height:9px;border-radius:5px;background:rgba(252,248,245,0.78);transform:scaleX(0);transform-origin:0 50%;}
#${p}capt{position:absolute;left:28px;top:22px;font-family:'JetBrains Mono';font-weight:500;font-size:20px;letter-spacing:0.12em;color:rgba(252,248,245,0.9);}
.${p}pl{position:absolute;width:26px;height:26px;opacity:0;filter:drop-shadow(0 0 4px rgba(${RGB_D},0.7));}
.${p}pl:before,.${p}pl:after{content:'';position:absolute;background:${S.dore};}
.${p}pl:before{left:12px;top:0;width:2px;height:26px;} .${p}pl:after{left:0;top:12px;width:26px;height:2px;}`;
  const filtre = (id) => `<svg width="0" height="0" style="position:absolute"><filter id="${id}" x="-50%" y="-10%" width="200%" height="120%"><feGaussianBlur id="${id}b" stdDeviation="0 0"/></filter></svg>`;
  const G = o.gauche, Dr = o.droite, mode = o.couleur ?? 'creme', TI = Math.round(T * 0.42);
  // en mode 'teinte', une marque trop sombre pour ressortir sur sa propre teinte passe en crème (comme son icône d'app)
  const sombre = (n) => { const h = MARQUES[n].couleur, v = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] < 0.2; };
  const coeur = (ic) => ic.logo ? logo(ic.logo, Math.round(T * 0.40), mode === 'creme' || (mode === 'teinte' && sombre(ic.logo)) ? 'creme' : 'marque') : icone(ic.icone, TI);
  const fondIc = (ic) => (ic.logo && mode === 'teinte') ? `<div class="${p}tt" style="${tuileTeinte(ic.logo)}"></div>` : '';
  let html = filtre(`${p}mbg`) + filtre(`${p}mbd`);
  html += `<div class="${p}t" id="${p}tg" style="left:${xg - T / 2}px;top:${cy - T / 2}px;filter:url(#${p}mbg)"><div class="${p}ic" style="opacity:1">${icone(G.icone, Math.round(T * 0.42))}</div></div>`;
  html += `<div class="${p}t" id="${p}td" style="left:${xd - T / 2}px;top:${cy - T / 2}px;filter:url(#${p}mbd)">`
    + Dr.icones.map((ic, i) => `<div class="${p}ic" id="${p}di${i}">${fondIc(ic)}${coeur(ic)}</div>`).join('') + `</div>`;
  html += `<div class="${p}e" id="${p}eg" style="left:${xg}px">${G.etiquette ?? ''}</div>`;
  (Dr.etiquettes || []).forEach((e, i) => { html += `<div class="${p}e" id="${p}ed${i}" style="left:${xd}px">${e.texte}</div>`; });
  const pb = { x0: xgF - T / 2 - 40, x1: xdF + T / 2 + 40, y0: cy - T / 2 - 40, y1: cy + T / 2 + 40 };
  [[pb.x0, pb.y0], [pb.x1, pb.y0], [pb.x0, pb.y1], [pb.x1, pb.y1]].forEach(([x, y], i) => { html += `<div class="${p}pl" id="${p}pl${i}" style="left:${x - 13}px;top:${y - 13}px"></div>`; });
  const K = o.capture;
  if (K) html += `<div id="${p}cap" style="left:${K.x}px;top:${K.y}px;width:${K.w}px;height:${K.h}px"><div id="${p}capf"></div><div id="${p}capt">${esc(K.titre ?? '')}</div>`
    + [0.78, 0.62, 0.7, 0.45].map((l, i) => `<div class="${p}cl" id="${p}cl${i}" style="top:${74 + i * 30}px;width:${Math.round((K.w - 56) * l)}px"></div>`).join('') + `</div>`;
  if (o.legende) html += `<div class="${p}e" id="${p}lg" style="left:540px;top:${cy + T / 2 + 64}px">${esc(o.legende.texte)}</div>`;
  html += '\n';
  // apparitions : pop d'échelle depuis presque rien, 4 à 5 images, sans dépassement
  const pop = (sel, t) => `tl.fromTo('${sel}', { opacity: 0, scale: 0.15, filter: 'blur(6px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.15, ease: 'power2.out', immediateRender: true }, ${f3(t)});\n`;
  let js = `tl.fromTo('#${p}tg', { opacity: 0, scale: 0.15 }, { opacity: 1, scale: 1, duration: 0.15, ease: 'power2.out', immediateRender: true }, ${f3(G.t)});\n`;
  js += `tl.fromTo('#${p}td', { opacity: 0, scale: 0.15 }, { opacity: 1, scale: 1, duration: 0.15, ease: 'power2.out', immediateRender: true }, ${f3(Dr.t)});\n`;
  if (G.etiquette) js += ent(`#${p}eg`, G.t + S.cascade, { flou: S.entree.flou, d: S.entree.duree });
  Dr.icones.forEach((ic, i) => {
    js += `tl.set('#${p}di${i}', { opacity: 1 }, ${f3(ic.t)});\n`;
    if (i < Dr.icones.length - 1) js += `tl.set('#${p}di${i}', { opacity: 0 }, ${f3(Dr.icones[i + 1].t)});\n`;
  });
  (Dr.etiquettes || []).forEach((e, i, a) => {
    js += ent(`#${p}ed${i}`, e.t, { flou: S.entree.flou, d: S.entree.duree });
    if (i < a.length - 1) js += `tl.set('#${p}ed${i}', { opacity: 0 }, ${f3(a[i + 1].t)});\n`;
  });
  if (o.contact) {
    const t = o.contact.t, d = o.contact.d ?? 0.32;
    js += sortie(`#${p}eg, .${p}e[id^="${p}ed"]`, t - 0.02, { d: 0.1 });
    js += `tl.to('#${p}tg', { x: ${xgF - xg}, duration: ${d}, ease: 'power3.in' }, ${f3(t)});\n`;
    js += `tl.to('#${p}td', { x: ${xdF - xd}, duration: ${d}, ease: 'power3.in' }, ${f3(t)});\n`;
    // flou de mouvement : monte avec la vitesse, retombe à zéro au contact en 2 images
    for (const s of ['g', 'd']) {
      js += `tl.to('#${p}mb${s}b', { attr: { stdDeviation: '26 0' }, duration: ${f3(d * 0.85)}, ease: 'power3.in' }, ${f3(t)});\n`;
      js += `tl.to('#${p}mb${s}b', { attr: { stdDeviation: '0 0' }, duration: 0.067, ease: 'none' }, ${f3(t + d * 0.85)});\n`;
    }
  }
  if (o.plus) js += `tl.fromTo('.${p}pl', { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.18, ease: 'power2.out', stagger: 0.03, immediateRender: true }, ${f3(o.plus.t)});\n`;
  if (K) {
    js += ent(`#${p}cap`, K.t);
    [0, 1, 2, 3].forEach((i) => { js += `tl.to('#${p}cl${i}', { scaleX: 1, duration: 0.25, ease: 'power2.out' }, ${f3(K.t + 0.12 + i * 0.07)});\n`; });
    if (o.sortie !== undefined) js += sortie(`#${p}cap`, o.sortie);
  }
  if (o.legende) js += ent(`#${p}lg`, o.legende.t, { flou: S.entree.flou, d: S.entree.duree });
  if (o.sortie !== undefined) js += sortie(`.${p}t, .${p}pl, #${p}lg`, o.sortie);
  void pop;
  return { css, html, js };
}
