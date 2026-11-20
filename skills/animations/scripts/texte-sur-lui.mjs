#!/usr/bin/env node
// texte-sur-lui.mjs : une animation légère sur la caméra (geste « texte-sur-lui »), jamais un plein écran.
// Yoan, 2026-11-20 : « sur la fin de la vidéo il manque au moins une ou deux animations sur la cam, donc pas de plein
// écran ; sur une phrase d'enjeu, il pourrait y avoir une animation pour accentuer un peu le truc. » Elle se pose sur une
// phrase d'enjeu ou de contraste (une condition « si tu… », une opposition aujourd'hui / demain, une projection dans le
// temps, une adresse directe) : ses mots, en capitales, au-dessus de sa tête, chacun sur sa voix ; il reste à l'image.
// - 1 à 3 lignes, empilées et centrées au-dessus de sa tête (haut du crâne mesuré), tout en capitales, des tailles proches
//   (ACCROCHE.ecartTailleMax entre deux voisines) ;
// - une ligne peut être « pave » (pavé craie, texte charbon : pas d'orange, les sous-titres gardent le leur) ;
// - une opposition : la ligne marquée « barre » se barre d'un trait craie et s'estompe quand la ligne suivante arrive ;
// - ses sous-titres restent ; les mots que l'animation écrit en sortent (chaque mot n'est vu qu'une fois).
// La demande du plan (format.md, « Animation sur lui ») :
//   { "id": "a08", "geste": "texte-sur-lui", "intention": "...", "de": "<ancre>", "a": "<ancre>",
//     "composition": { "forme": "condition" | "opposition" | "projection" | "adresse", "pourquoi": "..." },
//     "elements": [ { "texte": "...", "sur": "...", "taille"?: "normale" | "grande", "pave"?: true, "barre"?: true } ] }
// Usage : node texte-sur-lui.mjs <dossier -montage> <id> --video <vidéo coupée> [--tete <y>] [--sans-visage]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { S, K, P, FPS, AV, ICI, Couche, chargerMots, coupes, img, tImg, f4, mesure, son, ecrireCalque, voileCss, texteSousTitres, normaliser } from './lib/style.mjs';

const args = process.argv.slice(2);
const M = args[0] && path.resolve(args[0]), ID = args[1];
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
if (!M || !ID) { console.log('Usage : node texte-sur-lui.mjs <dossier -montage> <id> --video <vidéo coupée>'); process.exit(3); }
const resoluF = path.join(M, 'animations', 'plan-resolu.json');
if (!fs.existsSync(resoluF)) { console.log(`PLAN_NON_CALÉ : lance d'abord caler.mjs (il manque ${resoluF})`); process.exit(3); }
const d = JSON.parse(fs.readFileSync(resoluF, 'utf8')).demandes.find((x) => x.id === ID);
if (!d || d.geste !== 'texte-sur-lui') { console.log(`DEMANDE_INTROUVABLE : pas de demande ${ID} « texte-sur-lui » dans le plan calé`); process.exit(3); }
const TS = S.TEXTE_SUR_LUI, A = S.ACCROCHE, Z = S.ZONE_SURE;
const refus = [], avis = [];
const R = (code, msg) => refus.push(`${code} : ${msg}`);
const fin = () => { for (const a of avis) console.log(`AVIS ${a}`); for (const r of refus) console.log(`REFUS ${r}`); console.log(`REFUSÉ : ${refus.length} problème(s) à corriger dans la demande ${ID} du plan`); process.exit(2); };
const comp = d.composition || {};
if (!TS.formes.includes(comp.forme)) R('FORME', `forme « ${comp.forme} » : ${TS.formes.join(', ')} (la forme de sa phrase)`);
if (!comp.pourquoi || String(comp.pourquoi).trim().length < 20) R('POURQUOI_MANQUANT', 'une phrase : ce que le spectateur doit sentir ici, et pourquoi cette animation');
const els = d.elements.map((e, k) => ({ ...e, k }));
if (els.length < 1 || els.length > TS.lignesMax) R('LIGNES', `${els.length} ligne(s) : 1 à ${TS.lignesMax}`);
if (comp.forme === 'opposition' && !els.some((e) => e.barre)) R('OPPOSITION', 'une opposition : la ligne qui tombe porte « barre »: true (elle se barre quand la suivante arrive)');
if (els.filter((e) => e.barre).some((e) => e.k === els.length - 1)) R('OPPOSITION', 'la dernière ligne ne se barre pas : rien ne la remplace');
const mots = chargerMots(M);
const UNITES = { un: '1', une: '1', deux: '2', trois: '3', quatre: '4', cinq: '5', six: '6', sept: '7', huit: '8', neuf: '9', dix: '10', douze: '12', trente: '30' };
const jetons = (s) => normaliser(s).split(/\s+/).filter(Boolean).map((w) => UNITES[w] || w).join(' ');
for (const e of els) {
  if (!e.sur) { R('MOT_MANQUANT', `« ${e.texte} » : sur quel mot ?`); continue; }
  if (jetons(e.texte) !== jetons(texteSousTitres(M, `w${e.sur.premier}-w${e.sur.dernier}`, mots))) R('LECTURE', `« ${e.texte} » n'est pas ce qu'il dit sur « ${e.sur.texte} » : ses mots exacts`);
}
if (refus.length) fin();

// ------------------------------------------------------------------ tailles (tout en capitales, des tailles proches)
const MET = mesure('metriques', 'titre');
const capDe = (F) => MET.cap * F;
const baseDe = (F) => ((P.titre.interligne - (MET.asc + MET.desc)) / 2 + MET.asc) * F;
const LARG = Z.x1 - Z.x0 - 2 * A.marge;
for (const e of els) {
  e.aff = String(e.texte).toLocaleUpperCase('fr');
  const F0 = mesure('taille', 'titre', TS.cap[e.taille || 'normale']).taille;
  let F = F0;
  if (e.pave) {
    const k0 = F / S.HOOKS.paves.taille, w0 = mesure('encre', 'titre', F, e.aff).avance + 2 * S.HOOKS.paves.padX * k0;
    if (w0 > LARG) F *= LARG / w0;
  } else {
    const g = mesure('geant', e.aff); F = Math.min(F, g.taille);
  }
  if (F < F0 - 0.5) avis.push(`« ${e.aff} » ramené à la largeur de la zone sûre`);
  e.F = F; e.m = mesure('encre', 'titre', F, e.aff);
  if (e.pave) { const k = F / S.HOOKS.paves.taille; e.pad = [S.HOOKS.paves.padY[0] * k, S.HOOKS.paves.padX * k, S.HOOKS.paves.padY[1] * k]; e.w = e.m.avance + 2 * e.pad[1]; }
}
for (let k = 1; k < els.length; k++) {
  const a = capDe(els[k - 1].F), b = capDe(els[k].F), r = Math.max(a, b) / Math.min(a, b);
  if (r > A.ecartTailleMax + 1e-6) R('TAILLE', `« ${els[k - 1].aff} » et « ${els[k].aff} » : ${r.toFixed(1)} fois d'écart de taille, ${A.ecartTailleMax} au plus : coupe la ligne trop longue`);
}
if (refus.length) fin();

// ------------------------------------------------------------------ le temps
const cs = coupes(M);
const t0 = Math.min(...els.map((e) => e.sur.debut_s));
const debut = Math.max(0, Math.floor((t0 - AV) * FPS));
const dernier = Math.max(...els.map((e) => e.sur.fin_s));
const finA = d.a ? Math.max(d.a.fin_s, dernier) : dernier;
let finImg = img(finA + TS.tenue);
const aimant = cs.filter((c) => c >= img(finA) && c <= img(finA + TS.tenue + TS.aimant)).sort((x, y) => x - y)[0];
if (aimant) finImg = aimant;
if ((finImg - debut) / FPS > TS.dureeMax) { avis.push(`ramenée à ${TS.dureeMax} s`); finImg = debut + img(TS.dureeMax); }
const images = finImg - debut;
const tc = (s) => s - debut / FPS;

// ------------------------------------------------------------------ la place : au-dessus de sa tête
let tete = opt('--tete') !== null ? +opt('--tete') : null;
const video = opt('--video');
if (tete === null) {
  if (!video || !fs.existsSync(video)) { R('VIDEO_MANQUANTE', 'donne --video <vidéo coupée> : le texte se pose au-dessus de sa tête, mesurée sur la vidéo'); fin(); }
  const out = execFileSync('/usr/bin/python3', [path.join(ICI, 'verifier.py'), 'tete', video, String(debut), String(images)], { encoding: 'utf8' });
  tete = JSON.parse(out.trim().split('\n').at(-1)).haut_tete;
}
let y = A.hautY;
for (const e of els) {
  const capH = Math.max(capDe(e.F), e.m.haut);
  if (e.pave) { e.top = y; e.base = y + e.pad[0] + baseDe(e.F); e.bas = y + e.pad[0] + P.titre.interligne * e.F + e.pad[2]; }
  else { e.base = y + capH; e.top = e.base - baseDe(e.F); e.bas = e.base; }
  e.x = e.pave ? (Z.x0 + Z.x1) / 2 - e.w / 2 : (Z.x0 + Z.x1) / 2 - (e.m.gauche + e.m.droite) / 2;
  y = e.bas + TS.ecart;
}
// place : « haut » (au-dessus de sa tête, par défaut) ou « bas » (sous son visage, au-dessus de ses sous-titres)
const place = comp.place || 'haut';
if (!['haut', 'bas'].includes(place)) R('PLACE', `place « ${place} » : haut ou bas`);
if (place === 'bas') { const dy = A.basY - els.at(-1).bas; for (const e of els) { e.top += dy; e.base += dy; e.bas += dy; } }
const hautBloc = els[0].pave ? els[0].top : els[0].base - Math.max(capDe(els[0].F), els[0].m.haut), basBloc = els.at(-1).bas;
if (place === 'haut' && basBloc > tete - TS.margeTete) R('PLACE', `le bloc descend à ${Math.round(basBloc)} px, sa tête commence à ${Math.round(tete)} px : moins de lignes, plus courtes, ou « place »: « bas »`);
if (!args.includes('--sans-visage') && video && fs.existsSync(video)) {
  const V = JSON.parse(execFileSync('/usr/bin/python3', [path.join(ICI, 'visage.py'), video, String(debut), String(images), '10'], { encoding: 'utf8' }).trim().split('\n').at(-1));
  for (const z of V.zones) if (hautBloc < z.y1 && z.y0 < basBloc) { R('VISAGE', `le bloc touche ses yeux ou sa bouche (vers ${(z.image / FPS).toFixed(1)} s) : l'autre place`); break; }
}
if (refus.length) fin();

// ------------------------------------------------------------------ le calque
const c = new Couche(images);
c.css = `#voile{inset:0;${voileCss('standard')}}\n`;
let html = `  <div class="a fd" id="voile"></div>\n`;
for (const e of els) {
  const st = `left:${e.x.toFixed(1)}px;top:${e.top.toFixed(1)}px;font-size:${e.F.toFixed(2)}px`;
  if (e.pave) html += `  <div class="a ti c-ch" id="l${e.k}" style="${st};background:${K.craie};border-radius:${S.RAYONS.pave}px;padding:${e.pad[0].toFixed(1)}px ${e.pad[1].toFixed(1)}px ${e.pad[2].toFixed(1)}px;box-shadow:0 ${S.MARCHE.pave.hauteur}px 0 ${S.MARCHE.paveCraie.couleur}">${e.aff}</div>\n`;
  else html += `  <div class="a ti c-cr douce" id="l${e.k}" style="${st}">${e.aff}</div>\n`;
}
const sons = [];
c.js += `tl.set('#voile', { opacity: 0 }, 0);\ntl.to('#voile', { opacity: 1, duration: ${TS.voile}, ease: '${S.COURBES.entree}' }, 0);\n`;
for (const e of els) {
  const h = e.pave ? e.bas - e.top : capDe(e.F);
  const mi = c.app(`#l${e.k}`, tc(e.sur.debut_s) - AV, h, e.aff); c.attendus.at(-1).mot_image = e.sur.image;
  if (e.pave) sons.push(son('pose', debut + img(mi), `« ${e.aff} » se pose`));
}
// opposition : la ligne barrée se barre et s'estompe quand la suivante arrive
for (const e of els.filter((x) => x.barre)) {
  const n = els[e.k + 1], tb = tc(n.sur.debut_s);
  const x = (e.pave ? e.x : e.x + e.m.gauche) - A.barre.ep, w = (e.pave ? e.w : e.m.largeur) + 2 * A.barre.ep;
  const yb = e.pave ? (e.top + e.bas) / 2 - A.barre.ep / 2 : e.base - 0.5 * capDe(e.F) - A.barre.ep / 2;
  html += `  <div class="a" id="b${e.k}" style="left:${x.toFixed(1)}px;top:${yb.toFixed(1)}px;width:${w.toFixed(1)}px;height:${A.barre.ep}px;background:${K.craie};border-radius:${S.RAYONS.pilule}px;clip-path:inset(0 100% 0 0)"></div>\n`;
  c.js += `tl.to('#b${e.k}', { clipPath: 'inset(0 0% 0 0)', duration: ${A.barre.d}, ease: '${A.barre.courbe}' }, ${f4(tb)});\n`;
  c.js += `tl.to('#l${e.k}', { opacity: ${A.barre.estompe}, duration: ${A.barre.dEstompe}, ease: '${S.COURBES.entree}' }, ${f4(tb + 0.1)});\n`;
}
c.html = html;
const repris = els.map((e) => [e.sur.premier, e.sur.dernier]);
ecrireCalque(M, {
  id: ID, demande: ID, debut, images, couche: 'devant', ordre: 25, sons_suggeres: sons,
  attendus: c.attendus.map(({ mi, ...a }) => a), mots_repris: repris,
  origine: { sur_mesure: `animation sur lui (${comp.forme}) : ${comp.pourquoi}`, gestes_repris: ['apparition v2', 'pavé des hooks (craie)', 'question coupée (trait qui barre)'] },
  params: { forme: comp.forme, tete, lignes: els.map((e) => ({ texte: e.aff, pave: !!e.pave, barre: !!e.barre })) },
}, c.page());
for (const a of avis) console.log(`AVIS ${a}`);
console.log(`SUR LUI ${ID} (${comp.forme}) : images ${debut} à ${debut + images - 1} (${(images / FPS).toFixed(1)} s), ${els.length} ligne(s) au-dessus de sa tête (haut du crâne ${Math.round(tete)} px, bas du bloc ${Math.round(basBloc)} px)`);
console.log(`Ensuite : verifier.mjs ${M} ${ID} --video <vidéo coupée>, puis calques.mjs.`);
