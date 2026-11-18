// Fichier de contexte en héros (tour 11, r11-02 ; remplace l'objet signature r10-02c refusé : « pas un petit fichier
// gris à côté de ma tête alors que c'est le truc le plus important de la vidéo »).
// Un grand document en verre qui se construit en direct, calé sur la voix :
//   1. les sources arrivent, en couleur (logo Instagram, vocaux sur tuile bleue, vignette vidéo bleue, logo Notion) ;
//   2. le document apparaît (vide), les logos des IA se posent dans son en-tête ;
//   3. les sources se versent dedans une à une (chacune allume le bord du document de sa couleur) ;
//   4. le nom du fichier se tape, puis les sections se construisent : TA VOIX (l'onde), TES MOTS (des mots que Yoan dit
//      vraiment dans la rush : « en gros », « t'as juste à », « bref »), TES EXEMPLES (une ligne par source, avec sa
//      vignette en couleur) ;
//   5. sur le dernier mot, le document s'illumine en doré (filet et étiquettes dorés, halo, crochets dorés r4-04a,
//      reflet qui balaie le verre).
// Trois mises en scène (o.mode) : 'plein' (plein écran sur fond r4-01c, croix + aux coins), 'demi' (dans le haut d'un
// demi-écran, sources à gauche et à droite), 'camera' (sur la caméra, le document monte devant le buste en relief :
// perspective, parallaxe des couches, reflet sur le verre).
// Le document est dessiné dans un repère de 800 x 960 px puis mis à l'échelle (o.doc = { x, y, k }).
import { S, f3, ent, sortie, icone, logo, tuileTeinte, captureCss, etiqCss, croix, crochetsCss, crochetsHtml, crochetsEntree,
  frappe, esc, RGB_D, grainCss, grainJs } from '../commun.mjs';

const DW = 800, DH = 960;
const BLEU = '#3078A8';   // tuile « vocaux » : bleu des icônes du reel 4 (mesuré #3078A8)
// sources : type 'logo' (marque), 'icone' sur tuile teintée, 'capture' (vignette bleue stylisée)
export const SOURCES = [
  { id: 'posts', etiquette: 'Posts', logo: 'instagram', couleur: '#FF0069' },
  { id: 'vocaux', etiquette: 'Vocaux', icone: 'micro', teinte: BLEU, couleur: BLEU },
  { id: 'videos', etiquette: 'Vidéos', capture: true, couleur: '#416F96' },
  { id: 'notes', etiquette: 'Notes', logo: 'notion', couleur: '#F2EEE6' },
];
const rgb = (h) => { const n = parseInt(h.slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; };

// o = {
//   mode: 'plein' | 'demi' | 'camera'
//   doc: { x, y, k }                      coin haut gauche et échelle du document (800 x 960 à k = 1)
//   sources: [{ x, y, t }]                centre de chaque source (4, dans l'ordre de SOURCES) et instant d'apparition ;
//                                         absent (2026-10-23) : version courte, ni sources ni versement (verse ignoré)
//   taille = 112                          côté des tuiles de source
//   tDoc, tIA, verse: [t x4], titre: { t, texte }, sections: [t, t, t], tOr, sortie
// }
export function fichierHeros(p, o) {
  const D = o.doc, k = D.k, T = o.taille ?? 112, mode = o.mode, ui = S.ui;
  const box = { x: D.x, y: D.y, w: Math.round(DW * k), h: Math.round(DH * k) };
  const cible = { x: D.x + DW * k / 2, y: D.y + 60 * k };          // point d'entrée des sources (en-tête du document)
  let css = `
#${p}scene{position:absolute;left:0;top:0;width:1080px;height:1920px;z-index:20;}
#${p}doc{position:absolute;left:${mode === 'camera' ? D.x - DW * (1 - k) / 2 : D.x}px;top:${mode === 'camera' ? D.y - DH * (1 - k) / 2 : D.y}px;width:${DW}px;height:${DH}px;transform-origin:${mode === 'camera' ? '50% 50%' : '0 0'};opacity:0;}
#${p}verre{position:absolute;left:0;top:0;width:${DW}px;height:${DH}px;box-sizing:border-box;border-radius:6px;overflow:hidden;
  background:${mode === 'camera' ? 'rgba(30,26,21,0.86)' : S.verre};border:2px solid ${S.filet};}
${grainCss(`${p}gr`, 0.4)}
#${p}pouls{position:absolute;left:-2px;top:-2px;right:-2px;bottom:-2px;border-radius:7px;border:3px solid transparent;opacity:0;pointer-events:none;}
#${p}or{position:absolute;left:-2px;top:-2px;right:-2px;bottom:-2px;border-radius:7px;border:3px solid ${S.dore};opacity:0;pointer-events:none;
  box-shadow:0 0 18px rgba(${RGB_D},0.55),0 0 60px rgba(${RGB_D},0.28),inset 0 0 40px rgba(${RGB_D},0.12);}
#${p}reflet{position:absolute;left:-400px;top:-200px;width:260px;height:1400px;opacity:0;pointer-events:none;
  background:linear-gradient(90deg,rgba(255,250,240,0) 0%,rgba(255,250,240,0.16) 45%,rgba(255,250,240,0.28) 50%,rgba(255,250,240,0.16) 55%,rgba(255,250,240,0) 100%);}
${etiqCss(`${p}lb`, S.etiquette, { taille: 26, couleur: 'rgba(242,238,230,0.62)' })}
.${p}lb{position:absolute;left:40px;opacity:0;}
.${p}lb.or{color:${S.dore};text-shadow:0 0 8px rgba(${RGB_D},0.55);}
#${p}fic{position:absolute;left:36px;top:30px;opacity:0;}
#${p}nom{position:absolute;left:92px;top:34px;font-family:'JetBrains Mono';font-weight:500;font-size:28px;letter-spacing:0.02em;color:${S.texteUI};white-space:nowrap;}
.${p}nc{display:none;}
.${p}pt{position:absolute;top:47px;width:12px;height:12px;border-radius:50%;opacity:0;}
.${p}ia{position:absolute;top:30px;width:40px;height:40px;opacity:0;}
.${p}sep{position:absolute;left:36px;right:36px;height:1.5px;background:${S.filetDoux};transform:scaleX(0);transform-origin:0 50%;}
.${p}ch{position:absolute;right:40px;width:48px;height:48px;box-sizing:border-box;border-radius:12px;border:1.5px solid;display:flex;align-items:center;justify-content:center;opacity:0;overflow:hidden;}
.${p}wb{position:absolute;bottom:0;width:9px;border-radius:5px;background:rgba(244,239,228,0.85);transform:scaleY(0);transform-origin:50% 50%;}
.${p}bar{position:absolute;left:40px;height:12px;border-radius:6px;background:rgba(244,239,228,0.34);transform:scaleX(0);transform-origin:0 50%;}
.${p}mot{position:absolute;height:66px;padding:0 26px;box-sizing:border-box;border-radius:33px;border:1.5px solid rgba(244,239,228,0.4);background:rgba(244,239,228,0.06);
  font-family:'${ui.family}';font-weight:500;font-size:30px;line-height:63px;color:${S.texteUI};white-space:nowrap;opacity:0;}
.${p}ex{position:absolute;left:40px;right:40px;height:64px;opacity:0;}
.${p}exv{position:absolute;left:0;top:0;width:86px;height:64px;box-sizing:border-box;border-radius:10px;border:1.5px solid rgba(244,239,228,0.3);overflow:hidden;display:flex;align-items:center;justify-content:center;}
.${p}exb{position:absolute;left:110px;height:12px;border-radius:6px;background:rgba(244,239,228,0.4);}
${captureCss(`.${p}cap`)}
#${p}sq{position:absolute;left:0;top:0;width:${DW}px;height:${DH}px;opacity:0;}
.${p}sqb{position:absolute;left:40px;height:14px;border-radius:7px;background:rgba(244,239,228,0.07);}
.${p}src{position:absolute;width:${T}px;height:${T}px;opacity:0;z-index:25;}
.${p}st{position:absolute;left:0;top:0;width:${T}px;height:${T}px;box-sizing:border-box;border-radius:${S.rayon.tuile}px;border:1.5px solid rgba(142,119,104,0.75);
  background:${S.tuile};display:flex;align-items:center;justify-content:center;overflow:hidden;}
${etiqCss(`${p}se`, S.etiquette, { taille: 22, couleur: S.secondaire })}
.${p}se{position:absolute;left:50%;top:${T + 16}px;transform:translateX(-50%);opacity:0;}
${crochetsCss(`${p}cr`)}
#${p}c{z-index:30;}`;
  // --- en-tête
  const nom = o.titre?.texte ?? 'contexte-voix.md', fr = frappe(nom, o.titre.t, 26, 77);
  let doc = `<div id="${p}verre"><div class="${p}gr" id="${p}gr"></div>`
    + `<div id="${p}fic">${icone('fichier', 40)}</div><div id="${p}nom">` + fr.map(([c], i) => `<span class="${p}nc" id="${p}nc${i}">${esc(c)}</span>`).join('') + `</div>`;
  const xPts = 92 + nom.length * 0.62 * 28 * 1.02 + 22;
  SOURCES.forEach((s, i) => { doc += `<div class="${p}pt" id="${p}pt${i}" style="left:${Math.round(xPts + i * 20)}px;background:${s.couleur};box-shadow:0 0 8px ${s.couleur}"></div>`; });
  ['openai', 'claude', 'gemini'].forEach((m, i) => { doc += `<div class="${p}ia" id="${p}ia${i}" style="left:${DW - 36 - 40 * (3 - i) - 16 * (2 - i)}px">${logo(m, 40)}</div>`; });
  doc += `<div class="${p}sep" id="${p}sep0" style="top:100px"></div>`;
  // squelette discret du document vide (pour qu'il ne soit jamais un aplat muet en attendant les sections)
  doc += `<div id="${p}sq">` + [[146, 160], [216, 700], [258, 620], [300, 520], [428, 160], [492, 640], [624, 200], [690, 680], [778, 600], [866, 660]]
    .map(([y, w]) => `<div class="${p}sqb" style="top:${y}px;width:${w}px"></div>`).join('') + `</div>`;
  // --- section 1 : TA VOIX (l'onde) ; provenance : vocaux
  doc += `<div class="${p}lb" id="${p}lb0" style="top:142px">Ta voix</div>`
    + `<div class="${p}ch" id="${p}ch0" style="top:128px;${'background:linear-gradient(160deg,rgba(' + rgb(BLEU) + ',0.75),rgba(' + rgb(BLEU) + ',0.4));border-color:rgba(' + rgb(BLEU) + ',0.9)'}">${icone('micro', 26)}</div>`;
  let sd = 31; const rnd = () => { sd = (sd * 1103515245 + 12345) % 2147483648; return sd / 2147483648; };
  const NB = 40;
  for (let i = 0; i < NB; i++) {
    const h = Math.round(14 + 66 * Math.abs(Math.sin(i * 0.55) * 0.6 + rnd() * 0.4));
    doc += `<div class="${p}wb" id="${p}wb${i}" style="left:${40 + i * 18}px;top:${245 - h / 2}px;height:${h}px"></div>`;
  }
  doc += `<div class="${p}bar" id="${p}b0" style="top:320px;width:600px"></div><div class="${p}bar" id="${p}b1" style="top:350px;width:410px"></div>`;
  doc += `<div class="${p}sep" id="${p}sep1" style="top:394px"></div>`;
  // --- section 2 : TES MOTS (mots réels de la rush) ; provenance : posts
  doc += `<div class="${p}lb" id="${p}lb1" style="top:424px">Tes mots</div><div class="${p}ch" id="${p}ch1" style="top:410px;${tuileTeinte('instagram', 0.34)}">${logo('instagram', 26)}</div>`;
  const mots = ['« en gros »', '« t\'as juste à »', '« bref »']; let mx = 40;
  mots.forEach((m, i) => { doc += `<div class="${p}mot" id="${p}m${i}" style="left:${mx}px;top:478px">${esc(m)}</div>`; mx += Math.round(m.length * 15.5 + 52 + 18); });
  doc += `<div class="${p}sep" id="${p}sep2" style="top:588px"></div>`;
  // --- section 3 : TES EXEMPLES ; une ligne par source, vignette en couleur
  doc += `<div class="${p}lb" id="${p}lb2" style="top:618px">Tes exemples</div>`;
  const ex = [`<div class="${p}cap" style="position:absolute;left:0;top:0;right:0;bottom:0"></div>${icone('video', 30, S.texteUI, { style: 'position:relative' })}`,
    `<div style="position:absolute;inset:0;${tuileTeinte('instagram', 0.34)}"></div>${logo('instagram', 30, 'marque', { style: 'position:relative' })}`,
    `<div style="position:absolute;inset:0;${tuileTeinte('notion', 0.5)}"></div>${logo('notion', 30, 'marque', { style: 'position:relative' })}`];
  ex.forEach((v, i) => {
    doc += `<div class="${p}ex" id="${p}e${i}" style="top:${672 + i * 88}px"><div class="${p}exv">${v}</div>`
      + `<div class="${p}exb" style="top:14px;width:${[520, 470, 540][i]}px"></div><div class="${p}exb" style="top:38px;width:${[330, 390, 280][i]}px;opacity:0.6"></div></div>`;
  });
  doc += `<div id="${p}reflet"></div></div><div id="${p}pouls"></div><div id="${p}or"></div>`;
  // --- sources (repère de l'image)
  let srcs = '';
  const avecSources = Array.isArray(o.sources) && o.sources.length > 0;
  if (avecSources) SOURCES.forEach((s, i) => {
    const P = o.sources[i];
    let coeur;
    if (s.logo) coeur = `<div style="position:absolute;inset:-1.5px;border-radius:${S.rayon.tuile}px;${tuileTeinte(s.logo, s.logo === 'notion' ? 0.5 : 0.34)}"></div>${logo(s.logo, Math.round(T * 0.46), 'marque', { style: 'position:relative' })}`;
    else if (s.capture) coeur = `<div class="${p}cap" style="position:absolute;inset:0"></div>${icone('video', Math.round(T * 0.42), S.texteUI, { style: 'position:relative' })}`;
    else coeur = `<div style="position:absolute;inset:-1.5px;border-radius:${S.rayon.tuile}px;background:linear-gradient(160deg,rgba(${rgb(s.teinte)},0.72),rgba(${rgb(s.teinte)},0.38)),${S.tuile};border:1.5px solid rgba(${rgb(s.teinte)},0.9)"></div>${icone(s.icone, Math.round(T * 0.42), S.texteUI, { style: 'position:relative' })}`;
    srcs += `<div class="${p}src" id="${p}s${i}" style="left:${P.x - T / 2}px;top:${P.y - T / 2}px"><div class="${p}st">${coeur}</div><div class="${p}se" id="${p}se${i}">${s.etiquette}</div></div>`;
  });
  const cx = mode === 'camera' ? null : croix(`${p}k`, box);
  if (cx) css += '\n' + cx.css;
  const cb = { x: box.x - 16, y: box.y - 16, w: box.w + 32, h: box.h + 32 };
  const html = `  <div id="${p}scene"><div id="${p}doc">${doc}</div>${srcs}${cx ? cx.html : ''}${crochetsHtml(`${p}c`, `${p}cr`, cb)}</div>\n`;

  // ============ animation
  const fin = (o.sortie ?? 99) + 0.2;
  let js = grainJs(`#${p}gr`, o.tDoc, fin, 6060, 80) + `tl.set('#${p}reflet', { rotation: 18, x: -600 }, 0);\n`;
  // 1. sources
  if (avecSources) SOURCES.forEach((s, i) => {
    js += `tl.fromTo('#${p}s${i}', { opacity: 0, scale: 0.15, filter: 'blur(6px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.17, ease: 'power2.out', immediateRender: true }, ${f3(o.sources[i].t)});\n`;
    js += ent(`#${p}se${i}`, o.sources[i].t + S.cascade, { flou: S.entree.flou, d: S.entree.duree });
  });
  // 2. le document
  if (mode === 'camera') {
    // il monte devant le buste en relief : bascule en perspective qui se redresse, puis dérive lente (parallaxe)
    js += `tl.set('#${p}doc', { scale: ${k}, transformPerspective: 1500 }, 0);\n`;
    js += `tl.fromTo('#${p}doc', { opacity: 0, y: 520, rotationX: 34, rotationY: -20, filter: 'blur(10px)' }, { opacity: 1, y: 0, rotationX: 7, rotationY: -11, filter: 'blur(0px)', duration: 0.75, ease: 'expo.out', immediateRender: true }, ${f3(o.tDoc)});\n`;
    js += `tl.to('#${p}doc', { rotationX: 0, rotationY: 0, duration: ${f3(o.tOr - o.tDoc - 0.75)}, ease: 'sine.inOut' }, ${f3(o.tDoc + 0.75)});\n`;
    js += `tl.fromTo('#${p}reflet', { opacity: 1, x: -600 }, { x: 1500, duration: 0.9, ease: 'power2.inOut', immediateRender: false }, ${f3(o.tDoc + 0.25)});\n`;
  } else {
    js += `tl.set('#${p}doc', { scale: ${k} }, 0);\n` + ent(`#${p}doc`, o.tDoc);
    js += `tl.fromTo('${cx.sel}', { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.2, ease: 'power2.out', immediateRender: true }, ${f3(o.tDoc + 0.05)});\n`;
  }
  js += `tl.fromTo('#${p}sq', { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out', immediateRender: true }, ${f3(o.tDoc + 0.1)});\n`;
  js += `tl.to('#${p}sq', { opacity: 0, duration: 0.25, ease: 'power1.in' }, ${f3(o.sections[0] - 0.1)});\n`;
  js += ent(`#${p}fic`, o.tDoc + 0.08) + `tl.to('#${p}sep0', { scaleX: 1, duration: 0.3, ease: 'power2.out' }, ${f3(o.tDoc + 0.1)});\n`;
  [0, 1, 2].forEach((i) => { js += `tl.fromTo('#${p}ia${i}', { opacity: 0, scale: 0.15 }, { opacity: 1, scale: 1, duration: 0.15, ease: 'power2.out', immediateRender: true }, ${f3(o.tIA + i * 0.07)});\n`; });
  // 3. les sources se versent dans le document (accélèrent vers l'en-tête, flou de vitesse), le bord prend leur couleur
  if (avecSources) SOURCES.forEach((s, i) => {
    const t = o.verse[i], P = o.sources[i], d = 0.36;
    js += sortie(`#${p}se${i}`, t - 0.02, { d: 0.1 });
    js += `tl.to('#${p}s${i}', { x: ${f3(cible.x - P.x)}, y: ${f3(cible.y - P.y)}, scale: 0.22, duration: ${d}, ease: 'power3.in' }, ${f3(t)});\n`;
    js += `tl.to('#${p}s${i}', { filter: 'blur(5px)', duration: ${f3(d * 0.8)}, ease: 'power2.in' }, ${f3(t)});\n`;
    js += `tl.set('#${p}s${i}', { opacity: 0 }, ${f3(t + d)});\n`;
    js += `tl.set('#${p}pouls', { borderColor: '${s.couleur}', boxShadow: '0 0 26px ${s.couleur}, inset 0 0 30px ${s.couleur}55' }, ${f3(t + d)});\n`;
    js += `tl.fromTo('#${p}pouls', { opacity: 0.95 }, { opacity: 0, duration: 0.4, ease: 'power2.out', immediateRender: false }, ${f3(t + d)});\n`;
    js += `tl.fromTo('#${p}pt${i}', { opacity: 0, scale: 0.2 }, { opacity: 1, scale: 1, duration: 0.15, ease: 'power2.out', immediateRender: true }, ${f3(t + d)});\n`;
  });
  // 4. le nom se tape, puis les sections
  fr.forEach(([, tt], i) => { js += `tl.set('#${p}nc${i}', { display: 'inline' }, ${f3(tt)});\n`; });
  const [s1, s2, s3] = o.sections;
  js += ent(`#${p}lb0`, s1, { flou: S.entree.flou, d: S.entree.duree }) + ent(`#${p}ch0`, s1 + 0.05, { scale: 0.4 });
  for (let i = 0; i < NB; i++) js += `tl.to('#${p}wb${i}', { scaleY: 1, duration: 0.16, ease: 'power2.out' }, ${f3(s1 + 0.06 + i * 0.011)});\n`;
  js += `tl.to('#${p}b0', { scaleX: 1, duration: 0.3, ease: 'power2.out' }, ${f3(s1 + 0.3)});\ntl.to('#${p}b1', { scaleX: 1, duration: 0.3, ease: 'power2.out' }, ${f3(s1 + 0.38)});\n`;
  js += `tl.to('#${p}sep1', { scaleX: 1, duration: 0.3, ease: 'power2.out' }, ${f3(s2 - 0.06)});\n`;
  js += ent(`#${p}lb1`, s2, { flou: S.entree.flou, d: S.entree.duree }) + ent(`#${p}ch1`, s2 + 0.05, { scale: 0.4 });
  [0, 1, 2].forEach((i) => { js += ent(`#${p}m${i}`, s2 + 0.1 + i * 0.12, { flou: S.entree.flou, d: S.entree.duree, y: 10 }); });
  js += `tl.to('#${p}sep2', { scaleX: 1, duration: 0.3, ease: 'power2.out' }, ${f3(s3 - 0.06)});\n`;
  js += ent(`#${p}lb2`, s3, { flou: S.entree.flou, d: S.entree.duree });
  [0, 1, 2].forEach((i) => { js += ent(`#${p}e${i}`, s3 + 0.08 + i * 0.1, { flou: S.entree.flou, d: S.entree.duree, y: 12 }); });
  // 5. l'or : filet, étiquettes, halo, crochets, reflet
  js += `tl.fromTo('#${p}or', { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power2.out', immediateRender: true }, ${f3(o.tOr)});\n`;
  js += `tl.to('#${p}lb0, #${p}lb1, #${p}lb2', { color: '${S.dore}', textShadow: '0 0 8px rgba(${RGB_D},0.55)', duration: 0.25, ease: 'power2.out' }, ${f3(o.tOr)});\n`;
  js += `tl.to('.${p}wb', { backgroundColor: '${S.dore}', boxShadow: '0 0 8px rgba(${RGB_D},0.6)', duration: 0.25, ease: 'power2.out', stagger: 0.006 }, ${f3(o.tOr)});\n`;
  js += crochetsEntree(`${p}c`, o.tOr);
  js += `tl.fromTo('#${p}reflet', { opacity: 1, x: -600 }, { x: 1500, duration: 0.7, ease: 'power2.inOut', immediateRender: false }, ${f3(o.tOr + 0.05)});\n`;
  if (o.sortie !== undefined) js += sortie(`#${p}doc, #${p}c${cx ? `, ${cx.sel}` : ''}`, o.sortie, { d: 0.15 });
  return { css, html, js, box, cible };
}
