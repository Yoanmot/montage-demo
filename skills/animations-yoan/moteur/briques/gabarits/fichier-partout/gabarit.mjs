// Le même fichier, partout (tour 12, r12-01 ; remplace r11-04c : « l'imitation de fichier statique rectangle au fond
// bleu n'est pas top ; une meilleure animation pour bien comprendre de garder précieusement le fichier, et que c'est ce
// même fichier que tu pourras mettre partout »).
// Le fichier est LE document en verre doré du héros r11-02a (même dessin, état final : filet doré, étiquettes dorées,
// onde dorée, pastilles des sources, logos des IA dans l'en-tête), en petit. Autour, les tuiles des outils avec leurs
// vrais logos (Simple Icons, ../../logos/) : grises au départ, elles s'allument dans leur couleur de marque quand le
// fichier les atteint. Couleur toujours contenue dans les tuiles.
// Trois mises en scène (o.mode) :
//   'copies' : le fichier reste au centre (halo doré, crochets) ; une copie se détache et glisse dans chaque tuile,
//              l'une après l'autre ; chaque tuile s'allume à l'arrivée de sa copie ;
//   'cle'    : un seul fichier, comme une clé : il quitte le centre, se pose devant chaque tuile, qui s'ouvre (couleur +
//              petite coche dorée), les crochets glissent avec lui d'un outil à l'autre, puis il revient au centre ;
//   'coffre' : le fichier se range dans un dossier en verre (« GARDE-LE »), puis ressort ; des fils dorés le relient à
//              toutes les tuiles d'un coup, qui s'allument ensemble.
import { S, f3, ent, icone, logo, tuileTeinte, etiqCss, croix, crochetsCss, crochetsHtml, crochetsEntree, crochetsVers,
  esc, RGB_D, MARQUES, rgbs } from '../commun.mjs';

export const DW = 800, DH = 960;          // repère du document (celui de fichier-heros)
const BLEU = '#3078A8';
const PTS = ['#FF0069', BLEU, '#416F96', '#F2EEE6'];   // pastilles des 4 sources versées (posts, vocaux, vidéos, notes)

// --- le document doré, dessin statique (état final du héros r11-02a) ; m = épaississement du filet et du halo pour les
// petites échelles (le document reste lisible comme « le fichier doré » même à 100 px de large)
export function docCss(p) {
  const ui = S.ui;
  return `
.${p}doc{position:absolute;width:${DW}px;height:${DH}px;transform-origin:50% 50%;}
.${p}verre{position:absolute;left:0;top:0;width:${DW}px;height:${DH}px;box-sizing:border-box;border-radius:6px;overflow:hidden;background:${S.verre};border:2px solid ${S.filet};}
.${p}gr{position:absolute;left:-120px;top:-120px;right:-120px;bottom:-120px;background:url('grain.png') repeat;mix-blend-mode:overlay;opacity:0.4;pointer-events:none;}
${etiqCss(`${p}lb`, S.etiquette, { taille: 26, couleur: S.dore })}
.${p}lb{position:absolute;left:40px;text-shadow:0 0 8px rgba(${RGB_D},0.55);}
.${p}fic{position:absolute;left:36px;top:30px;}
.${p}nom{position:absolute;left:92px;top:34px;font-family:'JetBrains Mono';font-weight:500;font-size:28px;letter-spacing:0.02em;color:${S.texteUI};white-space:nowrap;}
.${p}pt{position:absolute;top:47px;width:12px;height:12px;border-radius:50%;}
.${p}ia{position:absolute;top:30px;width:40px;height:40px;}
.${p}sep{position:absolute;left:36px;right:36px;height:1.5px;background:${S.filetDoux};}
.${p}ch{position:absolute;right:40px;width:48px;height:48px;box-sizing:border-box;border-radius:12px;border:1.5px solid;display:flex;align-items:center;justify-content:center;overflow:hidden;}
.${p}wb{position:absolute;width:9px;border-radius:5px;background:${S.dore};box-shadow:0 0 8px rgba(${RGB_D},0.6);}
.${p}bar{position:absolute;left:40px;height:12px;border-radius:6px;background:rgba(244,239,228,0.34);}
.${p}mot{position:absolute;top:478px;height:66px;padding:0 26px;box-sizing:border-box;border-radius:33px;border:1.5px solid rgba(244,239,228,0.4);background:rgba(244,239,228,0.06);
  font-family:'${ui.family}';font-weight:500;font-size:30px;line-height:63px;color:${S.texteUI};white-space:nowrap;}
.${p}ex{position:absolute;left:40px;right:40px;height:64px;}
.${p}exv{position:absolute;left:0;top:0;width:86px;height:64px;box-sizing:border-box;border-radius:10px;border:1.5px solid rgba(244,239,228,0.3);overflow:hidden;display:flex;align-items:center;justify-content:center;}
.${p}exb{position:absolute;left:110px;height:12px;border-radius:6px;background:rgba(244,239,228,0.4);}
.${p}cap{position:absolute;inset:0;background:radial-gradient(ellipse 55% 70% at 88% 20%,${S.capture.reflet}cc,${S.capture.reflet}00 70%),linear-gradient(160deg,${S.capture.haut},${S.capture.bas});}
.${p}reflet{position:absolute;left:-400px;top:-200px;width:260px;height:1400px;opacity:0;pointer-events:none;transform:rotate(18deg);
  background:linear-gradient(90deg,rgba(255,250,240,0) 0%,rgba(255,250,240,0.16) 45%,rgba(255,250,240,0.28) 50%,rgba(255,250,240,0.16) 55%,rgba(255,250,240,0) 100%);}`;
}
export function docHtml(p, id, m = 1) {
  const nom = 'contexte-voix.md', xPts = 92 + nom.length * 0.62 * 28 * 1.02 + 22;
  let h = `<div class="${p}doc" id="${id}"><div class="${p}verre"><div class="${p}gr"></div>`
    + `<div class="${p}fic">${icone('fichier', 40)}</div><div class="${p}nom">${nom}</div>`;
  PTS.forEach((c, i) => { h += `<div class="${p}pt" style="left:${Math.round(xPts + i * 20)}px;background:${c};box-shadow:0 0 8px ${c}"></div>`; });
  ['openai', 'claude', 'gemini'].forEach((n, i) => { h += `<div class="${p}ia" style="left:${DW - 36 - 40 * (3 - i) - 16 * (2 - i)}px">${logo(n, 40)}</div>`; });
  h += `<div class="${p}sep" style="top:100px"></div>`;
  h += `<div class="${p}lb" style="top:142px">Ta voix</div><div class="${p}ch" style="top:128px;background:linear-gradient(160deg,rgba(${rgbs(BLEU)},0.75),rgba(${rgbs(BLEU)},0.4));border-color:rgba(${rgbs(BLEU)},0.9)">${icone('micro', 26)}</div>`;
  let sd = 31; const rnd = () => { sd = (sd * 1103515245 + 12345) % 2147483648; return sd / 2147483648; };
  for (let i = 0; i < 40; i++) {
    const hh = Math.round(14 + 66 * Math.abs(Math.sin(i * 0.55) * 0.6 + rnd() * 0.4));
    h += `<div class="${p}wb" style="left:${40 + i * 18}px;top:${245 - hh / 2}px;height:${hh}px"></div>`;
  }
  h += `<div class="${p}bar" style="top:320px;width:600px"></div><div class="${p}bar" style="top:350px;width:410px"></div><div class="${p}sep" style="top:394px"></div>`;
  h += `<div class="${p}lb" style="top:424px">Tes mots</div><div class="${p}ch" style="top:410px;${tuileTeinte('instagram', 0.34)}">${logo('instagram', 26)}</div>`;
  let mx = 40;
  ['« en gros »', '« t\'as juste à »', '« bref »'].forEach((w) => { h += `<div class="${p}mot" style="left:${mx}px">${esc(w)}</div>`; mx += Math.round(w.length * 15.5 + 70); });
  h += `<div class="${p}sep" style="top:588px"></div><div class="${p}lb" style="top:618px">Tes exemples</div>`;
  const ex = [`<div class="${p}cap"></div>${icone('video', 30, S.texteUI, { style: 'position:relative' })}`,
    `<div style="position:absolute;inset:0;${tuileTeinte('instagram', 0.34)}"></div>${logo('instagram', 30, 'marque', { style: 'position:relative' })}`,
    `<div style="position:absolute;inset:0;${tuileTeinte('notion', 0.5)}"></div>${logo('notion', 30, 'marque', { style: 'position:relative' })}`];
  ex.forEach((v, i) => {
    h += `<div class="${p}ex" style="top:${672 + i * 88}px"><div class="${p}exv">${v}</div><div class="${p}exb" style="top:14px;width:${[520, 470, 540][i]}px"></div>`
      + `<div class="${p}exb" style="top:38px;width:${[330, 390, 280][i]}px;opacity:0.6"></div></div>`;
  });
  h += `<div class="${p}reflet" id="${id}rf"></div></div>`;
  // filet doré + halo (épaissis par m aux petites échelles)
  const b = (3 * m).toFixed(1);
  h += `<div style="position:absolute;left:-2px;top:-2px;right:-2px;bottom:-2px;border-radius:7px;border:${b}px solid ${S.dore};pointer-events:none;`
    + `box-shadow:0 0 ${18 * m}px rgba(${RGB_D},0.55),0 0 ${60 * m}px rgba(${RGB_D},0.28),inset 0 0 ${40 * m}px rgba(${RGB_D},0.12)"></div></div>`;
  return h;
}

// sombre : une marque trop sombre pour ressortir sur sa propre teinte passe en crème (règle de r11-04)
const sombre = (n) => { const v = [1, 3, 5].map((i) => parseInt(MARQUES[n].couleur.slice(i, i + 2), 16) / 255); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] < 0.2; };

// o = {
//   mode: 'copies' | 'cle' | 'coffre'
//   centre: { x, y }, k                    centre et échelle du fichier (document 800 x 960 à k = 1)
//   tuiles: [{ logo, x, y, t }], taille    tuiles des outils (centre, apparition grise)
//   tFichier, tPrecieux                    arrivée du fichier ; « précieusement » (halo, crochets, reflet)
//   copies: [t]                            mode copies : départ de chaque copie (une par tuile, dans l'ordre)
//   visites: [t], retour                   mode cle : départ vers chaque tuile, puis retour au centre
//   dossier: { t, range, y }, sortie, fils mode coffre : apparition du dossier, rangement, ressortie, fils dorés
//   legende: { texte, t }, cadre: { x, y, w, h }  (croix « + » aux 4 coins)
// }
export function fichierPartout(p, o) {
  const C = o.centre, k = o.k, T = o.taille ?? 150, mode = o.mode, D = 0.34;
  const docBox = (cx, cy, kk, pad = 16) => ({ x: Math.round(cx - DW * kk / 2 - pad), y: Math.round(cy - DH * kk / 2 - pad), w: Math.round(DW * kk + 2 * pad), h: Math.round(DH * kk + 2 * pad) });
  const tuileBox = (t, pad = 26) => ({ x: t.x - T / 2 - pad, y: t.y - T / 2 - pad, w: T + 2 * pad, h: T + 2 * pad });
  const allume = [];   // instants où chaque tuile s'allume
  let css = docCss(p) + `
#${p}scene{position:absolute;left:0;top:0;width:1080px;height:1920px;z-index:20;}
.${p}mv{position:absolute;left:${C.x - DW / 2}px;top:${C.y - DH / 2}px;width:${DW}px;height:${DH}px;transform-origin:50% 50%;opacity:0;}
.${p}mv .${p}doc{left:0;top:0;}
#${p}aura{position:absolute;left:${C.x - 330}px;top:${C.y - 360}px;width:660px;height:720px;opacity:0;pointer-events:none;
  background:radial-gradient(ellipse 50% 50% at 50% 50%,rgba(${RGB_D},0.30) 0%,rgba(${RGB_D},0.12) 45%,rgba(${RGB_D},0) 72%);}
.${p}t{position:absolute;width:${T}px;height:${T}px;opacity:0;}
.${p}tb{position:absolute;inset:0;box-sizing:border-box;border-radius:${S.rayon.tuile}px;background:${S.tuile};border:${S.trait}px solid rgba(142,119,104,0.75);}
.${p}tt{position:absolute;inset:0;box-sizing:border-box;border-radius:${S.rayon.tuile}px;border:${S.trait}px solid;opacity:0;}
.${p}tp{position:absolute;inset:-2px;border-radius:${S.rayon.tuile + 2}px;border:3px solid;opacity:0;}
.${p}tl{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;}
.${p}tl.gris{opacity:0.36;} .${p}tl.coul{opacity:0;}
${etiqCss(`${p}te`, S.etiquette, { taille: 20, couleur: S.attenue })}
.${p}te{position:absolute;left:50%;top:${T + 14}px;transform:translateX(-50%);}
.${p}ok{position:absolute;width:38px;height:38px;border-radius:50%;background:${S.dore};opacity:0;box-shadow:0 0 10px rgba(${RGB_D},0.7);display:flex;align-items:center;justify-content:center;}
${etiqCss(`${p}lg`, S.etiquette)}
.${p}lg{position:absolute;left:540px;transform:translateX(-50%);opacity:0;}
${crochetsCss(`${p}cr`)}
#${p}c{z-index:40;}`;
  let html = `  <div id="${p}scene"><div id="${p}aura"></div>`;
  // --- tuiles (grises au départ)
  const coeur = (n) => logo(n, Math.round(T * 0.42), sombre(n) ? 'creme' : 'marque');
  o.tuiles.forEach((t, i) => {
    const M = MARQUES[t.logo], u = [t.x - C.x, t.y - C.y], n = Math.hypot(...u);
    const sx = Math.abs(u[0] / n) < 0.3 ? 1 : Math.sign(u[0]), sy = Math.abs(u[1] / n) < 0.3 ? 1 : Math.sign(u[1]);
    t.coin = { x: T / 2 + sx * (T / 2 - 4) - 19, y: T / 2 + sy * (T / 2 - 4) - 19 };
    html += `<div class="${p}t" id="${p}t${i}" style="left:${t.x - T / 2}px;top:${t.y - T / 2}px"><div class="${p}tb"></div>`
      + `<div class="${p}tt" id="${p}tt${i}" style="${tuileTeinte(t.logo, 0.30)}"></div><div class="${p}tp" id="${p}tp${i}" style="border-color:${M.couleur === '#F2EEE6' ? S.creme : M.couleur};box-shadow:0 0 26px ${M.couleur === '#F2EEE6' ? S.creme : M.couleur}"></div>`
      + `<div class="${p}tl gris">${logo(t.logo, Math.round(T * 0.42), 'creme')}</div><div class="${p}tl coul" id="${p}tc${i}">${coeur(t.logo)}</div>`
      + `<div class="${p}te" id="${p}te${i}">${M.nom}</div>`
      + (mode === 'cle' ? `<div class="${p}ok" id="${p}ok${i}" style="left:${t.coin.x}px;top:${t.coin.y}px"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2A1A0C" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>` : '')
      + `</div>`;
  });
  // --- fils dorés (mode coffre) : du fichier ressorti au bord de chaque tuile
  const fils = [];
  if (mode === 'coffre') {
    const yS = o.dossier.sortie;
    html += `<svg id="${p}fl" width="1080" height="1920" style="position:absolute;left:0;top:0;overflow:visible;filter:drop-shadow(0 0 4px rgba(${RGB_D},0.7))">`;
    o.tuiles.forEach((t, i) => {
      const dx = t.x - C.x, dy = t.y - yS, n = Math.hypot(dx, dy), ux = dx / n, uy = dy / n;
      const r0 = Math.min(DW * k / 2 / Math.abs(ux || 1e-6), DH * k / 2 / Math.abs(uy || 1e-6)) + 10;
      const r1 = n - Math.min(T / 2 / Math.abs(ux || 1e-6), T / 2 / Math.abs(uy || 1e-6)) - 10;
      const L = r1 - r0; fils.push(L);
      html += `<line id="${p}f${i}" x1="${(C.x + ux * r0).toFixed(1)}" y1="${(yS + uy * r0).toFixed(1)}" x2="${(C.x + ux * r1).toFixed(1)}" y2="${(yS + uy * r1).toFixed(1)}" stroke="${S.dore}" stroke-width="3" stroke-linecap="round" stroke-dasharray="${L.toFixed(1)} ${(L + 20).toFixed(1)}" stroke-dashoffset="${L.toFixed(1)}"/>`;
    });
    html += `</svg>`;
  }
  // --- dossier en verre (mode coffre) : dos + onglet, le fichier entre les deux, face avant « GARDE-LE »
  const DS = o.dossier, FW = 380, FH = 260;
  if (mode === 'coffre') {
    const fx = C.x - FW / 2, fy = DS.y - FH / 2;
    css += `
#${p}dos{position:absolute;left:${fx}px;top:${fy}px;width:${FW}px;height:${FH}px;box-sizing:border-box;border-radius:4px 16px 16px 16px;background:rgba(40,35,27,0.70);border:${S.trait}px solid ${S.filet};opacity:0;}
#${p}ong{position:absolute;left:-1.5px;top:-34px;width:150px;height:34px;box-sizing:border-box;border-radius:14px 14px 0 0;background:rgba(40,35,27,0.70);border:${S.trait}px solid ${S.filet};border-bottom:none;}
#${p}face{position:absolute;left:${fx - 8}px;top:${fy + 92}px;width:${FW + 16}px;height:${FH - 84}px;box-sizing:border-box;border-radius:14px;opacity:0;overflow:hidden;
  background:linear-gradient(180deg,rgba(66,54,40,0.90),rgba(36,31,24,0.96));border:${S.trait}px solid ${S.filetFort};}
#${p}faceor{position:absolute;left:${fx - 10}px;top:${fy + 90}px;width:${FW + 20}px;height:${FH - 80}px;box-sizing:border-box;border-radius:15px;border:3px solid ${S.dore};opacity:0;pointer-events:none;
  box-shadow:0 0 18px rgba(${RGB_D},0.5),0 0 50px rgba(${RGB_D},0.22);}
#${p}fg{position:absolute;left:-120px;top:-120px;right:-120px;bottom:-120px;background:url('grain.png') repeat;mix-blend-mode:overlay;opacity:0.4;}
${etiqCss(`${p}gl`, S.etiquette, { taille: 30, couleur: S.secondaire })}
#${p}gl{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);}
`;
    html += `<div id="${p}dos"><div id="${p}ong"></div></div>`;
  }
  // --- copies (mode copies) : sous le fichier d'origine
  if (mode === 'copies') o.tuiles.forEach((t, i) => { html += `<div class="${p}mv" id="${p}cp${i}">${docHtml(p, `${p}cd${i}`, 2.4)}</div>`; });
  // --- le fichier
  html += `<div class="${p}mv" id="${p}f">${docHtml(p, `${p}fd`, 1.6)}</div>`;
  if (mode === 'coffre') html += `<div id="${p}face"><div id="${p}fg"></div><div class="${p}gl" id="${p}gl">Garde-le</div></div><div id="${p}faceor"></div>`;
  const cx = croix(`${p}k`, o.cadre); css += '\n' + cx.css;
  html += cx.html;
  const b0 = mode === 'coffre' ? { x: C.x - FW / 2 - 26, y: DS.y - FH / 2 - 50, w: FW + 52, h: FH + 76 } : docBox(C.x, C.y, k);
  html += crochetsHtml(`${p}c`, `${p}cr`, b0);
  if (o.legende) html += `<div class="${p}lg" id="${p}lg" style="top:${o.legende.y}px">${esc(o.legende.texte)}</div>`;
  html += `</div>\n`;

  // ============ animation
  let js = `tl.set('.${p}mv', { scale: ${k} }, 0);\n`;
  // 1. le fichier arrive (déjà doré : c'est celui du héros), les croix du cadre se posent
  js += `tl.fromTo('#${p}f', { opacity: 0, scale: ${k * 0.8}, filter: 'blur(${S.objet.flou}px)' }, { opacity: 1, scale: ${k}, filter: 'blur(0px)', duration: 0.22, ease: 'power2.out', immediateRender: true }, ${f3(o.tFichier)});\n`;
  js += `tl.fromTo('${cx.sel}', { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.2, ease: 'power2.out', immediateRender: true }, ${f3(o.tFichier + 0.05)});\n`;
  const P = o.tPrecieux;
  if (mode !== 'coffre') {
    // 2. « précieusement » : halo doré léger qui respire, crochets, reflet qui balaie le verre
    js += `tl.fromTo('#${p}aura', { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'power2.out', immediateRender: true }, ${f3(P)});\n`;
    // respiration lente ; en mode clé elle s'arrête avant le premier départ (le halo reste au centre, le fichier part)
    js += `tl.to('#${p}aura', { opacity: 0.62, duration: 1.4, ease: 'sine.inOut', yoyo: true, repeat: ${mode === 'cle' ? 0 : 3} }, ${f3(P + 0.35)});\n`;
    js += crochetsEntree(`${p}c`, P);
    js += `tl.fromTo('#${p}fdrf', { opacity: 1, x: -600 }, { x: 1500, duration: 0.7, ease: 'power2.inOut', immediateRender: false }, ${f3(P + 0.05)});\n`;
  } else {
    // 2. le dossier arrive ; le fichier s'y range ; « précieusement » : le dossier se dore, GARDE-LE, crochets
    js += ent(`#${p}dos`, DS.t) + ent(`#${p}face`, DS.t + S.cascade);
    js += `tl.to('#${p}f', { y: ${DS.y + 6 - C.y}, scale: ${k * 0.86}, duration: 0.36, ease: 'power2.inOut' }, ${f3(DS.range)});\n`;
    js += `tl.fromTo('#${p}faceor', { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power2.out', immediateRender: true }, ${f3(P)});\n`;
    js += `tl.to('#${p}gl', { color: '${S.dore}', textShadow: '0 0 8px rgba(${RGB_D},0.55)', duration: 0.25, ease: 'power2.out' }, ${f3(P)});\n`;
    js += `tl.fromTo('#${p}aura', { opacity: 0, scale: 0.7, y: ${DS.y - C.y} }, { opacity: 0.8, scale: 1, y: ${DS.y - C.y}, duration: 0.35, ease: 'power2.out', immediateRender: true }, ${f3(P)});\n`;
    js += crochetsEntree(`${p}c`, P);
  }
  // 3. les tuiles des outils arrivent, grises (logo crème atténué)
  o.tuiles.forEach((t, i) => {
    js += `tl.fromTo('#${p}t${i}', { opacity: 0, scale: 0.15, filter: 'blur(6px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.17, ease: 'power2.out', immediateRender: true }, ${f3(t.t)});\n`;
  });
  const allumer = (i, t) => {
    allume.push(+t.toFixed(3));
    return `tl.to('#${p}tt${i}, #${p}tc${i}', { opacity: 1, duration: 0.18, ease: 'power2.out' }, ${f3(t)});\n`
      + `tl.fromTo('#${p}tp${i}', { opacity: 0.95 }, { opacity: 0, duration: 0.45, ease: 'power2.out', immediateRender: false }, ${f3(t)});\n`
      + `tl.to('#${p}te${i}', { color: '${S.texteUI}', duration: 0.18, ease: 'power2.out' }, ${f3(t)});\n`;
  };
  // 4. le fichier atteint les outils
  if (mode === 'copies') {
    o.tuiles.forEach((t, i) => {
      const t0 = o.copies[i];
      js += `tl.set('#${p}cp${i}', { opacity: 1 }, ${f3(t0)});\n`;
      js += `tl.to('#${p}cp${i}', { x: ${t.x - C.x}, y: ${t.y - C.y}, scale: ${(k * 0.4).toFixed(3)}, duration: ${D}, ease: 'power3.in' }, ${f3(t0)});\n`;
      js += `tl.to('#${p}cp${i}', { filter: 'blur(4px)', duration: ${f3(D * 0.8)}, ease: 'power2.in' }, ${f3(t0)});\n`;
      js += `tl.set('#${p}cp${i}', { opacity: 0 }, ${f3(t0 + D)});\n` + allumer(i, t0 + D);
    });
  } else if (mode === 'cle') {
    const kc = +(k * 0.56).toFixed(3), d = 0.26;
    o.tuiles.forEach((t, i) => {
      const dx = C.x - t.x, dy = C.y - t.y, n = Math.hypot(dx, dy), ax = t.x + dx / n * 150, ay = t.y + dy / n * 150, t0 = o.visites[i];
      js += `tl.to('#${p}f', { x: ${(ax - C.x).toFixed(1)}, y: ${(ay - C.y).toFixed(1)}, scale: ${kc}, duration: ${d}, ease: 'power2.inOut' }, ${f3(t0)});\n`;
      // les crochets embrassent la paire (la tuile et le fichier posé devant), jamais posés sur le fichier
      const bt = tuileBox(t, 20), bd = docBox(ax, ay, kc, 16), x0 = Math.min(bt.x, bd.x), y0 = Math.min(bt.y, bd.y);
      js += crochetsVers(`${p}c`, t0 + 0.04, { x: x0, y: y0, w: Math.max(bt.x + bt.w, bd.x + bd.w) - x0, h: Math.max(bt.y + bt.h, bd.y + bd.h) - y0 });
      js += allumer(i, t0 + d - 0.02);
      js += `tl.fromTo('#${p}ok${i}', { opacity: 0, scale: 0.15 }, { opacity: 1, scale: 1, duration: 0.15, ease: 'power2.out', immediateRender: true }, ${f3(t0 + d + 0.02)});\n`;
    });
    if (mode === 'cle') js += `tl.to('#${p}aura', { opacity: 0, duration: 0.2, ease: 'power1.in' }, ${f3(o.visites[0])});\n`;
    js += `tl.to('#${p}f', { x: 0, y: 0, scale: ${k}, duration: 0.3, ease: 'power2.inOut' }, ${f3(o.retour)});\n`;
    js += crochetsVers(`${p}c`, o.retour + 0.04, docBox(C.x, C.y, k), 0.3);
    js += `tl.fromTo('#${p}aura', { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'power2.out', immediateRender: false }, ${f3(o.retour + 0.2)});\n`;
  } else {
    // ressortie : le fichier remonte du dossier, les crochets le suivent ; fils dorés tracés d'un coup ; tout s'allume
    const yS = DS.sortie, tS = o.sortie;
    js += `tl.to('#${p}f', { y: ${yS - C.y}, scale: ${k}, duration: 0.32, ease: 'power3.out' }, ${f3(tS)});\n`;
    js += `tl.to('#${p}dos, #${p}face, #${p}faceor', { opacity: 0, y: 70, filter: 'blur(10px)', duration: 0.24, ease: 'power2.in' }, ${f3(tS)});\n`;
    js += `tl.to('#${p}aura', { y: ${yS - C.y}, duration: 0.32, ease: 'power3.out' }, ${f3(tS)});\n`;
    js += crochetsVers(`${p}c`, tS + 0.04, docBox(C.x, yS, k), 0.3);
    js += `tl.fromTo('#${p}fdrf', { opacity: 1, x: -600 }, { x: 1500, duration: 0.6, ease: 'power2.inOut', immediateRender: false }, ${f3(tS + 0.1)});\n`;
    o.tuiles.forEach((t, i) => { js += `tl.to('#${p}f${i}', { attr: { 'stroke-dashoffset': 0 }, duration: 0.35, ease: 'power2.inOut' }, ${f3(o.fils)});\n` + allumer(i, o.fils + 0.33); });
    js += `tl.to('#${p}fl', { opacity: 0.4, duration: 0.4, ease: 'power1.inOut' }, ${f3(o.fils + 0.6)});\n`;
  }
  if (o.legende) js += ent(`#${p}lg`, o.legende.t, { flou: S.entree.flou, d: S.entree.duree });
  return { css, html, js, allume, cadre: o.cadre };
}
