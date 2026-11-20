#!/usr/bin/env node
// plein-ecran-visage.mjs : le plein écran qui commence sur son visage (geste « plein-ecran-visage »).
//
// Yoan, 2026-11-20 : « On pourrait mettre le "3 MOIS" en gros en blanc au-dessus de sa tête, ensuite transition et on fait
// passer le fond en orange, parce que ce qu'il reprochait à un moment, c'était que c'était trop long sans voir sa tête.
// Là, au début de l'animation on voit encore sa tête : on garde l'élément mais on change le fond, puis on fait apparaître
// les premiers progrès avec une animation et le mot. » « Commencer l'effet à l'écran en mettant le texte et le finir
// après, c'est vraiment bien. »
// Trois temps, chacun sur sa voix :
//   1. le titre (le mot clé, en capitales, en grand) apparaît au-dessus de sa tête, sur l'image filmée (voile du haut) ;
//   2. le fond uni (orange ou charbon) monte du bas et couvre l'image ; le titre reste exactement à sa place et prend la
//      couleur de texte du fond ; un clic sur la transition ;
//   3. les points (1 à 3 : une étape, un bénéfice, un élément de liste) apparaissent un par un sous le titre, chacun sur
//      son mot, avec sa petite figure qui se trace (courbe qui monte, cases qui se cochent, barre qui se remplit) et son
//      libellé.
// Le temps passé sans le voir (du fond à la sortie) est borné (PLEIN_VISAGE.sansLuiMax) : au-delà, refus TROP_LONG.
// Sous-titres effacés pendant tout le calque : le titre et les points portent ses mots.
//
// La demande du plan (format.md, « Plein écran qui commence sur lui ») :
//   { "id": "a05", "geste": "plein-ecran-visage", "intention": "...", "de": "<mot du titre>", "a": "<dernier mot>",
//     "composition": { "fond": "orange" | "charbon", "fond_sur": "<ancre, facultatif>" },
//     "elements": [ { "role": "titre", "texte": "...", "sur": "..." },
//                   { "role": "point", "texte": "...", "sur": "...", "figure": "courbe" | "cases" | "barre" | "aucune" }, ... ] }
// Usage : node plein-ecran-visage.mjs <dossier -montage> <id> --video <vidéo coupée> [--tete <y>]
// Avant : caler.mjs. Après : verifier.mjs <dossier> <id> --video ..., puis calques.mjs.
// Codes : 0 écrit · 2 refusé (liste complète) · 3 fichier manquant.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { S, K, P, FPS, AV, ICI, Couche, chargerMots, resoudre, coupes, img, tImg, f4, mesure, son, ecrireCalque, voileCss, texteSousTitres, normaliser } from './lib/style.mjs';

const args = process.argv.slice(2);
const M = args[0] && path.resolve(args[0]), ID = args[1];
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
if (!M || !ID) { console.log('Usage : node plein-ecran-visage.mjs <dossier -montage> <id> --video <vidéo coupée>'); process.exit(3); }
const resoluF = path.join(M, 'animations', 'plan-resolu.json');
if (!fs.existsSync(resoluF)) { console.log(`PLAN_NON_CALÉ : lance d'abord caler.mjs (il manque ${resoluF})`); process.exit(3); }
const d = JSON.parse(fs.readFileSync(resoluF, 'utf8')).demandes.find((x) => x.id === ID);
if (!d || d.geste !== 'plein-ecran-visage') { console.log(`DEMANDE_INTROUVABLE : pas de demande ${ID} « plein-ecran-visage » dans le plan calé`); process.exit(3); }

const PV = S.PLEIN_VISAGE, Z = S.ZONE_SURE;
const refus = [], avis = [];
const R = (code, msg) => refus.push(`${code} : ${msg}`);
const fin = () => { for (const a of avis) console.log(`AVIS ${a}`); for (const r of refus) console.log(`REFUS ${r}`); console.log(`REFUSÉ : ${refus.length} problème(s) à corriger dans la demande ${ID} du plan`); process.exit(2); };
const comp = d.composition || {};
const fond = comp.fond || 'orange';
if (!['orange', 'charbon'].includes(fond)) R('FOND_INCONNU', `fond « ${fond} » : orange ou charbon`);
const titre = d.elements.filter((e) => e.role === 'titre');
const points = d.elements.filter((e) => e.role === 'point');
if (titre.length !== 1) R('TITRE', `il faut exactement un élément « titre » (le mot clé au-dessus de sa tête), il y en a ${titre.length}`);
if (points.length < 1 || points.length > PV.pointsMax) R('POINTS', `${points.length} point(s) : 1 à ${PV.pointsMax} (au-delà, c'est une liste)`);
for (const e of d.elements) {
  if (!['titre', 'point'].includes(e.role)) R('ROLE_INCONNU', `« ${e.texte} » : rôle « ${e.role} » (titre ou point)`);
  if (e.role === 'point' && e.figure != null && !PV.figures.includes(e.figure)) R('FIGURE_INCONNUE', `« ${e.texte} » : figure « ${e.figure} » (${PV.figures.join(', ')})`);
  if (!e.sur) R('MOT_MANQUANT', `« ${e.texte} » : sur quel mot doit-il arriver ?`);
}
if (refus.length) fin();
const T = titre[0];
const pts = [...points].sort((a, b) => a.sur.premier - b.sur.premier);
if (pts[0].sur.premier <= T.sur.premier) R('ORDRE', 'le titre arrive avant le premier point (c\'est lui qui ouvre, sur son visage)');

// ------------------------------------------------------------------ le temps
const mots = chargerMots(M);
const cs = coupes(M);
const tT = T.sur.debut_s;                                   // attaque du titre
const debut = Math.max(0, Math.floor((tT - AV) * FPS));     // le calque commence quand le titre part
const tFond = comp.fond_sur ? resoudre(comp.fond_sur, mots).debut_s - PV.fond.avance : pts[0].sur.debut_s - PV.fond.avant;
const tFondMin = tT + PV.titreSeul;                         // le titre se lit seul sur son visage avant le fond
if (tFond < tFondMin - 0.01) R('TROP_TOT', `le fond arrive ${(tFondMin - tFond).toFixed(2)} s trop tôt : le titre doit se lire ${PV.titreSeul} s sur son visage (mets « fond_sur » plus loin, ou un titre dit plus tôt)`);
const dernier = pts.at(-1).sur;
// fin : la coupe qui suit son dernier mot (sinon le temps de la tenue), jamais après l'attaque du mot suivant : les
// sous-titres de la phrase d'après reprennent dès qu'il la commence (essai du 2026-11-20 : « Au début » non écrit)
const suivant = mots[dernier.dernier + 1];
const plafond = suivant ? img(resoudre(`w${dernier.dernier + 1}`, mots).debut_s) : Infinity;
let finImg = img(dernier.fin_s + PV.tenue);
const aimant = cs.filter((c) => c >= img(dernier.fin_s) && c <= img(dernier.fin_s + PV.tenue + PV.aimant)).sort((a, b) => a - b)[0];
if (aimant) finImg = aimant;
finImg = Math.min(finImg, plafond);
const sansLui = finImg / FPS - tFond;
if (sansLui > PV.sansLuiMax) R('TROP_LONG', `${sansLui.toFixed(1)} s sans le voir (le fond couvre son visage), ${PV.sansLuiMax} s au plus : moins de points, ou un fond qui arrive plus tard`);
if (refus.length) fin();
const images = finImg - debut;
const tc = (s) => s - debut / FPS;                         // secondes du calque

// ------------------------------------------------------------------ mesures
const MET = mesure('metriques', 'titre');
const baseDe = (F) => ((P.titre.interligne - (MET.asc + MET.desc)) / 2 + MET.asc) * F;   // ligne de base dans la boîte
const capDe = (F) => MET.cap * F;
// haut de sa tête sur la fenêtre où le titre est sur l'image filmée
let tete = opt('--tete') !== null ? +opt('--tete') : null;
if (tete === null) {
  const video = opt('--video');
  if (!video || !fs.existsSync(video)) { R('VIDEO_MANQUANTE', 'donne --video <vidéo coupée> : le titre se pose au-dessus de sa tête, mesurée sur la vidéo'); fin(); }
  const n0 = img(tT), nb = Math.max(1, img(tFond) - n0 + 1);
  const out = execFileSync('/usr/bin/python3', [path.join(ICI, 'verifier.py'), 'tete', video, String(n0), String(nb)], { encoding: 'utf8' });
  tete = JSON.parse(out.trim().split('\n').at(-1)).haut_tete;
}
const texteT = String(T.texte).toLocaleUpperCase('fr');
const g = mesure('geant', texteT);
// le titre tient entre le haut de la zone sûre et le haut de sa tête (PV.ecartTete au-dessus du crâne)
const place = tete - PV.ecartTete - Z.y0;
// la largeur de la zone sûre est une limite dure (g.taille) ; la hauteur au-dessus de sa tête en est une autre : si sa tête
// est trop haute pour le titre, il prend la taille minimale (jamais plus large que la zone sûre) et monte en haut de la zone
const Fh = place / MET.cap, Fmin = mesure('taille', 'titre', PV.titreCapMin).taille;
let F = Math.min(g.taille, Fh);
if (Fh < Fmin) { avis.push(`sa tête est haute (${Math.round(tete)} px) : titre réduit, posé en haut de la zone sûre ; regarde la planche`); F = Math.min(g.taille, Fmin); }
const mT = mesure('encre', 'titre', F, texteT);
const baseT = Math.min(tete - PV.ecartTete, Z.y0 + capDe(F) + Math.max(0, mT.haut - capDe(F)));
const topT = baseT - baseDe(F);
const xT = (Z.x0 + Z.x1) / 2 - (mT.gauche + mT.droite) / 2;

// points : la figure centrée, son libellé centré dessous ; les points l'un sous l'autre sous le titre
// Un élément qui traverse une transition garde son apparence (Yoan, 2026-11-20 : le mot clé en blanc doit rester intact,
// il ne doit pas passer en noir) : le titre reste craie sur le fond uni, et ce qui suit prend sa couleur.
const couleurTexte = K.craie;
const TL = PV.libelle;
const lignes = pts.map((e, k) => {
  const texte = String(e.texte).toLocaleUpperCase('fr'), figure = e.figure || 'aucune';
  let F2 = TL, m = mesure('encre', 'titre', F2, texte);
  const fw = figure === 'aucune' ? 0 : (figure === 'cases' ? 3 * PV.figure.case + 2 * PV.figure.ecartCases : PV.figure.l);
  if (m.largeur > Z.x1 - Z.x0 - 10) { F2 = TL * (Z.x1 - Z.x0 - 10) / m.largeur; m = mesure('encre', 'titre', F2, texte); avis.push(`« ${texte} » ramené à ${Math.round(F2)} px pour tenir en largeur`); }
  return { e, k, texte, figure, F: F2, m, fw };
});
// une seule taille pour tous les libellés (la plus petite qui tient) : les points se lisent comme une liste
const FL = Math.min(...lignes.map((l) => l.F));
for (const l of lignes) if (l.F !== FL) { l.F = FL; l.m = mesure('encre', 'titre', FL, l.texte); }
let y = baseT + PV.ecartTitre;
const CX = (Z.x0 + Z.x1) / 2;
for (const l of lignes) {
  const hf = l.figure === 'aucune' ? 0 : PV.figure.h + PV.ecartFigure;
  l.haut = y; l.x = CX - l.fw / 2;
  l.base = y + hf + capDe(l.F);
  l.xl = CX - (l.m.gauche + l.m.droite) / 2;
  y = l.base + PV.ecartPoints;
}
if (y - PV.ecartPoints > Z.y1) R('HORS_ZONE', 'les points descendent sous la zone sûre : moins de points');
if (refus.length) fin();

// ------------------------------------------------------------------ le calque
const c = new Couche(images);
const EP = PV.figure.trait;
c.css = `#voile{inset:0;${voileCss('standard')}}
#fd{inset:0;background:${K[fond]};visibility:hidden;}
#fl,#fs{inset:0;background:${K.craie};opacity:0;}
#t{left:${xT.toFixed(2)}px;top:${topT.toFixed(2)}px;font-size:${F.toFixed(2)}px;color:${K.craie};}
.lb{font-size:${TL}px;color:${couleurTexte};}
.cs{position:absolute;box-sizing:border-box;border:${EP}px solid ${couleurTexte};border-radius:${S.RAYONS.vignette}px;}
.cs svg{position:absolute;overflow:visible;}
`;
const coche = `M ${PV.figure.case * 0.22} ${PV.figure.case * 0.52} L ${PV.figure.case * 0.42} ${PV.figure.case * 0.72} L ${PV.figure.case * 0.80} ${PV.figure.case * 0.28}`;
// flash d'entrée masqué : il couvre tout l'écran sauf le titre (un trou autour de son encre), qui reste intact
const tr = { x0: xT + mT.gauche - PV.flash.marge, x1: xT + mT.droite + PV.flash.marge, y0: baseT - Math.max(capDe(F), mT.haut) - PV.flash.marge, y1: baseT + PV.flash.marge };
const trou = `polygon(evenodd, 0px 0px, 1080px 0px, 1080px 1920px, 0px 1920px, 0px 0px, ${tr.x0.toFixed(1)}px ${tr.y0.toFixed(1)}px, ${tr.x0.toFixed(1)}px ${tr.y1.toFixed(1)}px, ${tr.x1.toFixed(1)}px ${tr.y1.toFixed(1)}px, ${tr.x1.toFixed(1)}px ${tr.y0.toFixed(1)}px, ${tr.x0.toFixed(1)}px ${tr.y0.toFixed(1)}px)`;
let html = `  <div class="a fd" id="voile"></div>\n  <div class="a fd" id="fd"></div>\n  <div class="a fd" id="fl" style="clip-path:${trou}"></div>\n  <div class="a ti douce" id="t">${texteT}</div>\n`;
for (const l of lignes) {
  const fx = l.x, fy = l.haut, FW = PV.figure.l, FH = PV.figure.h;
  if (l.figure === 'courbe') {
    const dpath = `M 4 ${FH - 6} C ${FW * 0.22} ${FH - 8}, ${FW * 0.29} ${FH * 0.55}, ${FW * 0.43} ${FH * 0.52} S ${FW * 0.67} ${FH * 0.2}, ${FW - 6} 8`;
    html += `  <div class="a" id="f${l.k}" style="left:${fx.toFixed(1)}px;top:${fy.toFixed(1)}px;width:${FW}px;height:${FH}px"><svg width="${FW}" height="${FH}" style="overflow:visible"><path id="f${l.k}c" d="${dpath}" fill="none" stroke="${couleurTexte}" stroke-width="${EP}" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle id="f${l.k}p" cx="${FW - 6}" cy="8" r="${S.SCHEMA.trait.point}" fill="${couleurTexte}" opacity="0"/></svg></div>\n`;
  } else if (l.figure === 'cases') {
    const C = PV.figure.case;
    html += `  <div class="a" id="f${l.k}" style="left:${fx.toFixed(1)}px;top:${fy.toFixed(1)}px;width:${l.fw}px;height:${FH}px">${[0, 1, 2].map((j) => `<div class="cs" style="left:${j * (C + PV.figure.ecartCases)}px;top:${(FH - C) / 2}px;width:${C}px;height:${C}px"><svg width="${C}" height="${C}" style="left:-${EP}px;top:-${EP}px"><path id="f${l.k}k${j}" d="${coche}" transform="translate(${EP} ${EP})" fill="none" stroke="${couleurTexte}" stroke-width="${EP + 1}" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg></div>`).join('')}</div>\n`;
  } else if (l.figure === 'barre') {
    const BW = PV.figure.l, BH = PV.figure.barre;
    html += `  <div class="a" id="f${l.k}" style="left:${fx.toFixed(1)}px;top:${(fy + (FH - BH) / 2).toFixed(1)}px;width:${BW}px;height:${BH}px;box-sizing:border-box;border:${EP}px solid ${couleurTexte};border-radius:${S.RAYONS.pave}px;overflow:hidden"><div id="f${l.k}b" style="position:absolute;left:0;top:0;bottom:0;width:0%;background:${couleurTexte}"></div></div>\n`;
  }
  const xl = l.xl, top = l.base - baseDe(l.F);
  html += `  <div class="a ti lb" id="l${l.k}" style="left:${xl.toFixed(1)}px;top:${top.toFixed(1)}px;font-size:${l.F.toFixed(2)}px">${l.texte}</div>\n`;
}
html += `  <div class="a fd" id="fs"></div>\n`;
c.html = html;
// 1. le titre sur son visage, avec le voile du haut
c.js += `tl.set('#voile', { opacity: 0 }, 0);\ntl.to('#voile', { opacity: 1, duration: ${PV.fond.voile}, ease: '${S.COURBES.entree}' }, ${f4(tc(tT) - AV)});\n`;
c.app('#t', tc(tT) - AV, capDe(F), texteT); c.attendus.at(-1).mot_image = T.sur.image;
// 2. flash masqué (paliers du transition-flash : 50 % puis 100 %, tout l'écran sauf le titre), puis le fond uni ; le
//    titre ne bouge pas, ne change ni de taille ni de couleur
const nF = img(tc(tFond));
c.js += `tl.set('#fl', { opacity: 0.5 }, ${f4(tImg(Math.max(0, nF - 1)))});\ntl.set('#fl', { opacity: 1 }, ${f4(tImg(nF))});\ntl.set('#fl', { opacity: 0 }, ${f4(tImg(nF + 1))});\n`;
c.js += `tl.set('#fd', { visibility: 'visible' }, ${f4(tImg(nF + 1))});\n`;
c.attendus.push({ nom: 'fond uni', image: nF + 1 });
// sortie symétrique : flash plein écran (50 % puis 100 %) sur les deux dernières images, puis retour sur lui
c.html += '';
c.js += `tl.set('#fs', { opacity: 0.5 }, ${f4(tImg(images - 2))});\ntl.set('#fs', { opacity: 1 }, ${f4(tImg(images - 1))});\n`;
// 3. chaque point sur son mot : figure et libellé ensemble, puis la figure se trace
for (const l of lignes) {
  const t0 = tc(l.e.sur.debut_s) - AV;
  if (t0 < tc(tFond) + PV.fond.d) avis.push(`« ${l.texte} » arrive pendant le flash : il se lira juste après`);
  if (l.figure !== 'aucune') { c.app(`#f${l.k}`, Math.max(t0, tc(tFond) + PV.fond.d), PV.figure.h, `figure ${l.texte}`); c.attendus.at(-1).mot_image = l.e.sur.image; }
  c.app(`#l${l.k}`, Math.max(t0, tc(tFond) + PV.fond.d), capDe(l.F), l.texte); c.attendus.at(-1).mot_image = l.e.sur.image;
  const tt = Math.max(t0, tc(tFond) + PV.fond.d) + PV.figure.retard;
  if (l.figure === 'courbe') {
    c.js += `tl.to('#f${l.k}c', { attr: { 'stroke-dashoffset': 0 }, duration: ${PV.figure.trace}, ease: '${S.SCHEMA.trait.courbe}' }, ${f4(tt)});\n`;
    c.js += `tl.to('#f${l.k}p', { opacity: 1, duration: 0.12, ease: '${S.COURBES.entree}' }, ${f4(tt + PV.figure.trace)});\n`;
  } else if (l.figure === 'cases') {
    for (let j = 0; j < 3; j++) c.js += `tl.to('#f${l.k}k${j}', { attr: { 'stroke-dashoffset': 0 }, duration: ${S.CASE_COCHEE.tracer}, ease: '${S.COURBES.entree}' }, ${f4(tt + S.CASE_COCHEE.ecart * j)});\n`;
  } else if (l.figure === 'barre') {
    c.js += `tl.to('#f${l.k}b', { width: '100%', duration: ${PV.figure.trace}, ease: '${S.SCHEMA.trait.courbe}' }, ${f4(tt)});\n`;
  }
}

// mots repris : le titre et les libellés qui sont ses mots exacts
const UNITES = { un: '1', une: '1', deux: '2', trois: '3', quatre: '4', cinq: '5', six: '6', sept: '7', huit: '8', neuf: '9', dix: '10', douze: '12', trente: '30' };
const jetons = (s) => normaliser(s).split(/\s+/).filter(Boolean).map((w) => UNITES[w] || w).join(' ');
const repris = [T, ...pts].filter((e) => jetons(e.texte) === jetons(texteSousTitres(M, `w${e.sur.premier}-w${e.sur.dernier}`, mots))).map((e) => [e.sur.premier, e.sur.dernier]);
ecrireCalque(M, {
  id: ID, demande: ID, debut, images, couche: 'devant', ordre: 20, masque_sous_titres: true,
  oranges: fond === 'orange' ? [[debut + nF + 1, debut + images]] : [],
  sons_suggeres: [son('transition', debut + nF, 'flash d\'entrée (tout sauf le titre) : un clic'), son('transition', debut + images - 1, 'flash de sortie : un clic')],
  attendus: c.attendus.map(({ mi, ...a }) => a), mots_repris: repris,
  origine: { sur_mesure: `plein écran qui commence sur son visage (fond ${fond}) : ${d.intention || ''}`,
    gestes_repris: ['apparition v2', 'plein-ecran-fond (fond uni, couleurs du texte)', 'schema (trait qui se trace)', 'case cochée'] },
  params: { fond, tete, titre: texteT, points: lignes.map((l) => ({ texte: l.texte, figure: l.figure })) },
}, c.page());
for (const a of avis) console.log(`AVIS ${a}`);
console.log(`PLEIN ÉCRAN DEPUIS LUI ${ID} : images ${debut} à ${debut + images - 1} (${(images / FPS).toFixed(1)} s) ; titre « ${texteT} » au-dessus de sa tête (haut du crâne ${Math.round(tete)} px, base ${Math.round(baseT)} px) à ${tT.toFixed(2)} s ; fond ${fond} à ${tFond.toFixed(2)} s ; ${sansLui.toFixed(1)} s sans le voir`);
for (const l of lignes) console.log(`   point « ${l.texte} » (${l.figure}) sur « ${l.e.sur.texte} » à ${l.e.sur.debut_s.toFixed(2)} s`);
console.log(`Ensuite : verifier.mjs ${M} ${ID} --video <vidéo coupée>, puis calques.mjs.`);
