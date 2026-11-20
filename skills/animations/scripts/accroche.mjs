#!/usr/bin/env node
// accroche.mjs : compose l'accroche d'une vidéo de Romain (les 5 premières secondes) à partir de la demande « accroche »
// du plan, et l'écrit en calques prêts pour le rendu (derrière lui et devant lui).
//
// La signature (Yoan, 2026-11-20, direction A « Romain, en plus nerveux ») est fixée ici, jamais par le plan :
//   - Inter Black seule : capitales pour le mot fort et les relances, minuscules pour la phrase ;
//   - un seul accent orange par image (pavé orange sur sa marche braise, ou soulignage orange), le reste charbon et craie ;
//   - ouverture en dézoom (zoom « ouverture » de la brique zooms : le mot derrière lui dézoome avec la caméra) ;
//   - trois temps sur les 5 premières secondes : une ouverture dès le début, le mot fort sur sa voix vers 1,5 s, une
//     relance vers 2,5 s ; tout reste jusqu'à 4 s au moins (pas de vide après 3 s), puis repart ensemble ;
//   - un tick sur le mot fort, un clac sous chaque relance.
// Ce que le plan décide (la disposition, selon l'accroche et l'effet voulu) : quel mot porte, sa taille, sa place
// (derrière lui, en haut, en bas), son alignement (côté de la place libre), son entrée, la relance, un chiffre qui compte.
//
// Usage : node accroche.mjs <dossier -montage> [--video <vidéo coupée>] [--tete <y>] [--sans-registre]
//   --video : la vidéo coupée de contrôle, pour mesurer le haut de sa tête (obligatoire si un élément est « derriere »,
//             sauf --tete) ; --sans-registre : ne lit ni n'écrit le registre (essais seulement).
// Avant : caler.mjs (plan-resolu.json), et la brique zooms si le plan a son dézoom d'ouverture (ouverture.json).
// Après : verifier.mjs sur chaque calque écrit (a01-derriere, a01-devant), puis calques.mjs.
// Codes : 0 écrit · 2 refusé (liste complète) · 3 fichier manquant · 4 RÉPÉTITION (registre).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { S, K, P, FPS, ICI, Couche, chargerMots, resoudre, texteSousTitres, normaliser, coupes, img, tImg, f4, mesure, son,
  ecrireCalque, voileCss } from './lib/style.mjs';
import { controler, verifier, noter, decrire } from './lib/accroche.mjs';

const args = process.argv.slice(2);
const M = args[0] && path.resolve(args[0]);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
if (!M) { console.log('Usage : node accroche.mjs <dossier -montage> [--video <vidéo coupée>] [--tete <y>] [--sans-registre]'); process.exit(3); }
const resoluF = path.join(M, 'animations', 'plan-resolu.json');
if (!fs.existsSync(resoluF)) { console.log(`PLAN_NON_CALÉ : lance d'abord caler.mjs (il manque ${resoluF})`); process.exit(3); }
const resolu = JSON.parse(fs.readFileSync(resoluF, 'utf8'));
const demandes = resolu.demandes.filter((d) => d.geste === 'accroche');
if (demandes.length !== 1) { console.log(`ACCROCHE : ${demandes.length} demande(s) « accroche » dans le plan, il en faut une`); process.exit(2); }
const d = demandes[0];
const plan = JSON.parse(fs.readFileSync(path.join(M, 'plan-montage.json'), 'utf8'));
const A = S.ACCROCHE, Z = S.ZONE_SURE;
const refus = [], avis = [];
const R = (code, msg) => refus.push(`${code} : ${msg}`);

// ------------------------------------------------------------------ 1. la composition et le registre
{ const c = controler(d); c.refus.forEach(([k, m]) => R(k, m)); avis.push(...c.avis); }
const comp = d.composition || {};
const derog = comp.derogation && String(comp.derogation).trim().length >= 20 ? String(comp.derogation).trim() : null;
const avecRegistre = !args.includes('--sans-registre');
if (avecRegistre && !refus.length) {
  const v = verifier(d, M);
  avis.push(...v.avis);
  if (v.repetitions.length) {
    for (const x of v.repetitions) console.log(`RÉPÉTITION ${x}`);
    console.log('Change la place, l\'entrée ou le mot fort de l\'accroche (ou le type) dans le plan, recale, relance.');
    process.exit(4);
  }
}
if (refus.length) fin();

// ------------------------------------------------------------------ 2. mesures
const mots = chargerMots(M);
const MET = mesure('metriques', 'titre');
const ti = { L: P.titre.interligne, base: (F) => ((P.titre.interligne - (MET.asc + MET.desc)) / 2 + MET.asc) * F };
const tx = { L: P.texte.interligne, base: (F) => ((P.texte.interligne - (MET.asc + MET.desc)) / 2 + MET.asc) * F };
const capDe = (F) => MET.cap * F;
const X0 = Z.x0 + A.marge, X1 = Z.x1 - A.marge, LARG = X1 - X0;
const ouvF = path.join(M, 'ouverture.json');
const ouverture = fs.existsSync(ouvF) ? JSON.parse(fs.readFileSync(ouvF, 'utf8')) : null;
if (!ouverture && !derog) R('SANS_OUVERTURE', 'la signature ouvre en dézoom : mets le zoom « ouverture » dans le plan (sur le mot fort, échelle ' + A.ouverture + '), prépare la brique zooms, puis relance');

// Éléments : place, alignement, taille, entrée, pavé (valeurs par défaut de la signature quand le plan ne dit rien)
const els = d.elements.map((e, i) => ({ ...e, i, id: `e${i}` }));
const motE = els.find((e) => e.role === 'mot');
let orangePris = els.some((e) => (e.role === 'mot' && (e.pave === 'orange' || e.souligne)));
for (const e of els) {
  if (e.role === 'phrase') {
    e.place ??= motE.place; e.taille ??= 'normale'; e.entree ??= 'apparition'; e.aligne ??= 'gauche'; e.pave = 'aucun';
    e.texteAffiche = String(e.texte).toLocaleLowerCase('fr');
  } else if (e.role === 'mot') {
    e.taille ??= e.place === 'derriere' ? 'geant' : 'grand'; e.entree ??= 'apparition'; e.aligne ??= 'gauche'; e.pave ??= 'aucun';
    e.texteAffiche = String(e.texte).toLocaleUpperCase('fr');
  } else {
    e.taille ??= 'normale'; e.entree ??= 'saccade'; e.aligne ??= e.place === 'bas' ? 'droite' : 'gauche';
    if (!e.pave) { e.pave = orangePris ? 'craie' : 'orange'; }
    if (e.pave === 'orange') orangePris = true;
    e.texteAffiche = String(e.texte).toLocaleUpperCase('fr');
  }
  e.kind = e.pave && e.pave !== 'aucun' ? 'pave' : (e.role === 'phrase' ? 'tx' : 'ti');
  if (!e.sur) R('MOT_MANQUANT', `« ${e.texte} » : sur quel mot doit-il arriver ?`);
}
if (refus.length) fin();

// Taille et largeur d'encre de chaque élément
for (const e of els) {
  if (e.kind === 'pave') {
    e.F = e.role === 'mot' ? A.pave[e.taille === 'moyen' ? 'moyen' : 'grand'] : A.pave[e.taille];
    const k = e.F / S.HOOKS.paves.taille;
    e.pad = [S.HOOKS.paves.padY[0] * k, S.HOOKS.paves.padX * k, S.HOOKS.paves.padY[1] * k];
    e.marche = Math.max(S.MARCHE.pave.hauteur, Math.round(S.MARCHE.pave.hauteur * k));
    const m = mesure('encre', 'titre', e.F, e.texteAffiche);
    e.w = m.avance + 2 * e.pad[1];
    e.encre = [0, e.w];
  } else if (e.kind === 'ti') {
    if (e.taille === 'geant') {
      const g = mesure('geant', e.texteAffiche);
      e.F = g.taille; e.left = g.left; e.geant = true;
    } else {
      const F = mesure('taille', 'titre', A.mot[e.taille === 'moyen' ? 'moyenCap' : 'grandCap']).taille;
      const g = mesure('geant', e.texteAffiche);
      e.F = Math.min(F, g.taille);
      if (e.F < F - 0.5) avis.push(`« ${e.texteAffiche} » trop long pour la taille ${e.taille} : ramené à la largeur de la zone sûre`);
    }
    e.m = mesure('encre', 'titre', e.F, e.texteAffiche);
  } else {
    e.F = A.phrase[e.taille];
    e.m = mesure('encre', 'texte', e.F, e.texteAffiche);
    if (e.m.largeur > LARG) R('TROP_LARGE', `« ${e.texteAffiche} » (${Math.round(e.m.largeur)} px) dépasse la zone sûre : coupe la phrase en deux éléments`);
  }
}

// Haut du crâne (pour le mot derrière lui) : mesuré sur la vidéo coupée, sur toute la fenêtre de l'accroche
const derriere = els.filter((e) => e.place === 'derriere');
let tete = opt('--tete') !== null ? +opt('--tete') : null;

// ------------------------------------------------------------------ 3. le temps
const coupesV = coupes(M);
const t = (e) => e.sur.debut_s;                       // attaque du mot (0,1 s avant le début transcrit), en s
const motsAffiches = els.map((e) => e.sur.fin_s);
const dernierMot = Math.max(...motsAffiches);
const total = mots.length ? Math.round(mots.at(-1).end * FPS) : 0;
let finS = comp.jusqua ? resoudre(comp.jusqua, mots).fin_s + 0.3 : dernierMot + A.fin.tenue;
finS = Math.min(A.fin.max, Math.max(A.fin.min, finS));
let images = img(finS);
const aimant = coupesV.filter((c) => Math.abs(c - images) <= A.fin.aimant * FPS && c >= img(A.fin.min)).sort((a, b) => Math.abs(a - images) - Math.abs(b - images))[0];
if (aimant) images = aimant;
images = Math.min(images, Math.max(1, total || images));

// Trois temps (signature) : une ouverture, le mot fort, une relance, distincts
const evts = els.map((e) => ({ e, t: t(e) })).sort((a, b) => a.t - b.t);
const temps = { ouverture: evts[0].t, mot: t(motE), relance: els.filter((e) => e.role === 'relance').map(t) };
const pbTemps = [];
if (temps.ouverture > A.temps.ouverture) pbTemps.push(`rien n'arrive avant ${A.temps.ouverture} s (premier élément à ${temps.ouverture.toFixed(2)} s) : prends un élément sur son premier mot`);
if (temps.mot < A.temps.mot[0] - 0.6 || temps.mot > A.temps.mot[1]) pbTemps.push(`le mot fort arrive à ${temps.mot.toFixed(2)} s, attendu vers 1,5 s (${A.temps.mot[0]} à ${A.temps.mot[1]} s)`);
const relanceOk = temps.relance.some((x) => x >= A.temps.relance[0] && x <= A.temps.relance[1]) || (comp.barre_sur && (() => { const b = resoudre(comp.barre_sur, mots).debut_s; return b >= A.temps.relance[0] - 0.4 && b <= A.temps.relance[1]; })());
if (!relanceOk) pbTemps.push(`pas de relance entre ${A.temps.relance[0]} et ${A.temps.relance[1]} s`);
const distincts = [...new Set(evts.map((x) => x.t))].reduce((acc, x) => (acc.length && x - acc.at(-1) < A.temps.ecartMin ? acc : [...acc, x]), []);
if (distincts.length < 3 && !comp.barre_sur) pbTemps.push(`${distincts.length} temps seulement (il en faut trois, à ${A.temps.ecartMin} s l'un de l'autre au moins)`);
if (pbTemps.length) {
  if (derog) avis.push(...pbTemps.map((x) => `TROIS_TEMPS ${x} (dérogation : ${derog})`));
  else pbTemps.forEach((x) => R('TROIS_TEMPS', x));
}
if (refus.length) fin();
if (derriere.length && tete === null) {
  const video = opt('--video');
  if (!video || !fs.existsSync(video)) { R('VIDEO_MANQUANTE', 'un élément passe derrière lui : donne --video <vidéo coupée> pour mesurer le haut de sa tête'); fin(); }
  const out = execFileSync('/usr/bin/python3', [path.join(ICI, 'verifier.py'), 'tete', video, '0', String(images)], { encoding: 'utf8' });
  tete = JSON.parse(out.trim().split('\n').at(-1)).haut_tete;
}

// ------------------------------------------------------------------ 4. la disposition
// Chaque élément a un « haut visuel » (haut des capitales, ou haut du pavé), une ligne de base et un bas visuel.
const geo = (e, top) => {
  if (e.kind === 'pave') {
    const base = top + e.pad[0] + ti.base(e.F);
    return { top, vTop: top, base, cap: base - capDe(e.F), bas: top + e.pad[0] + ti.L * e.F + e.pad[2] + e.marche };
  }
  const T = e.kind === 'ti' ? ti : tx, base = top + T.base(e.F);
  return { top, vTop: base - capDe(e.F), base, cap: base - capDe(e.F), bas: base + (e.kind === 'tx' ? MET.desc * e.F * 0.85 : 0) };
};
const topPour = (e, vTop) => (e.kind === 'pave' ? vTop : vTop - (e.kind === 'ti' ? ti : tx).base(e.F) + capDe(e.F));
function empiler(liste) {
  let prev = null;
  for (const e of liste) {
    let vTop = 0;
    if (prev) {
      if (e.kind === 'tx' && prev.kind === 'tx') vTop = prev.g.base + P.texte.interligne * e.F - capDe(e.F);
      else if (prev.kind === 'tx') vTop = prev.g.base + (e.kind === 'pave' ? A.ecartPave : A.ecartPhraseMot) + (e.kind === 'pave' ? MET.desc * prev.F * 0.85 : 0);
      else if (prev.kind === 'ti') vTop = prev.g.base + (e.kind === 'pave' ? A.ecartPave : A.ecartBlocs);
      else vTop = prev.g.bas + (e.kind === 'pave' ? A.ecartPaves : A.ecartBlocs);
      // un accent qui dépasse des capitales (É, À) ne touche jamais la ligne du dessus : l'écart se compte depuis son encre
      if (e.m) vTop += Math.max(0, e.m.haut - capDe(e.F));
    }
    e.g = geo(e, topPour(e, vTop));
    prev = e;
  }
}
const decaler = (liste, dy) => liste.forEach((e) => { e.g = geo(e, e.g.top + dy); });
const bandes = { haut: els.filter((e) => e.place === 'haut'), derriere, bas: els.filter((e) => e.place === 'bas') };
for (const [nom, liste] of Object.entries(bandes)) {
  if (!liste.length) continue;
  empiler(liste);
  if (nom === 'haut') decaler(liste, A.hautY - liste[0].g.vTop);
  else if (nom === 'bas') decaler(liste, A.basY - Math.max(...liste.map((e) => e.g.bas)));
  else {
    const iMot = liste.indexOf(motE);
    if (iMot < 0) R('PLACE_INCONNUE', 'derrière lui, il faut le mot fort (une phrase seule derrière lui ne se lit pas)');
    else if (iMot !== liste.length - 1) R('PLACE_INCONNUE', `« ${liste[iMot + 1].texte} » est sous le mot derrière lui, sur son visage : place-le en bas`);
    else decaler(liste, tete + A.derriere * capDe(motE.F) - motE.g.base);
  }
}
// Horizontal : gauche, droite ou centre de la zone sûre, à l'encre près
for (const e of els) {
  if (e.kind === 'pave') e.x = e.aligne === 'droite' ? Z.x1 - e.w : e.aligne === 'centre' ? (Z.x0 + Z.x1) / 2 - e.w / 2 : Z.x0;
  else if (e.geant) e.x = e.left;
  else e.x = e.aligne === 'droite' ? X1 - e.m.droite : e.aligne === 'centre' ? (X0 + X1) / 2 - (e.m.gauche + e.m.droite) / 2 : X0 - e.m.gauche;
  const gx = e.kind === 'pave' ? [e.x, e.x + e.w] : [e.x + e.m.gauche, e.x + e.m.droite];
  if (gx[0] < Z.x0 - 0.5 || gx[1] > Z.x1 + 0.5) R('HORS_ZONE', `« ${e.texteAffiche} » sort de la zone sûre sur les côtés`);
}
if (!refus.length) {
  for (const e of els) {
    if (e.g.vTop < Z.y0 - 0.5) R('HORS_ZONE', `« ${e.texteAffiche} » commence au-dessus de la zone sûre (${Math.round(e.g.vTop)} px) : ${e.place === 'derriere' ? 'sa tête est trop haute pour cette taille, prends une taille plus petite ou place le mot en haut' : 'trop d\'éléments en haut'}`);
    if (e.g.bas > Z.y1 + 0.5) R('HORS_ZONE', `« ${e.texteAffiche} » descend sous la zone sûre`);
  }
  // les bandes ne se chevauchent pas (de haut en bas : haut, derrière, bas)
  const etendue = (l) => (l.length ? [Math.min(...l.map((e) => e.g.vTop)), Math.max(...l.map((e) => e.g.bas))] : null);
  const eh = etendue(bandes.haut), ed = etendue(bandes.derriere), eb = etendue(bandes.bas);
  if (eh && ed && eh[1] + A.ecartBlocs > ed[0]) R('CHEVAUCHEMENT', 'les éléments du haut et le mot derrière lui se chevauchent : mets-les ensemble derrière lui, ou le mot en bas');
  if (eb && ((ed && ed[1] > eb[0]) || (eh && eh[1] + A.ecartBlocs > eb[0]))) R('CHEVAUCHEMENT', 'les éléments du bas remontent sur ceux du haut');
}
if (refus.length) fin();

// ------------------------------------------------------------------ 5. les calques
const NS = { derriere: new Couche(images), devant: new Couche(images) };
const reprisPar = { derriere: [], devant: [] };
const sons = { derriere: [], devant: [] };
const couche = (e) => (e.place === 'derriere' ? 'derriere' : 'devant');
const UNITES = { un: '1', une: '1', deux: '2', trois: '3', quatre: '4', cinq: '5', six: '6', sept: '7', huit: '8', neuf: '9', dix: '10',
  onze: '11', douze: '12', treize: '13', quatorze: '14', quinze: '15', seize: '16', vingt: '20', trente: '30', cent: '100' };
const jetons = (s) => normaliser(s).split(/\s+/).filter(Boolean).map((w) => UNITES[w] || w);
for (const e of els) {
  const c = NS[couche(e)], sel = `#${e.id}`, te = t(e);
  const style = `left:${e.x.toFixed(2)}px;top:${e.g.top.toFixed(2)}px;font-size:${e.F.toFixed(2)}px`;
  if (e.kind === 'pave') {
    const fond = e.pave === 'orange' ? [K.orange, S.MARCHE.pave.couleur] : [K.craie, S.MARCHE.paveCraie.couleur];
    c.html += `  <div class="a ti c-ch" id="${e.id}" style="${style};background:${fond[0]};border-radius:${S.RAYONS.pave}px;padding:${e.pad[0].toFixed(1)}px ${e.pad[1].toFixed(1)}px ${e.pad[2].toFixed(1)}px;box-shadow:0 ${e.marche}px 0 ${fond[1]}">${e.texteAffiche}</div>\n`;
  } else if (e.compte_de != null) {
    const de = +e.compte_de, N = +e.texte;
    c.html += `  <div class="a ti c-cr douce" id="${e.id}" style="${style};font-variant-numeric:tabular-nums">${Array.from({ length: N - de + 1 }, (_, k) => `<span id="${e.id}n${de + k}" style="position:${k === N - de ? 'relative' : 'absolute'};left:0;top:0;visibility:hidden">${de + k}</span>`).join('')}</div>\n`;
  } else {
    c.html += `  <div class="a ${e.kind} c-cr douce" id="${e.id}" style="${style}">${e.texteAffiche}</div>\n`;
  }
  const h = e.kind === 'pave' ? e.g.bas - e.g.vTop : capDe(e.F);
  let lisible;
  if (e.entree === 'pose') { c.montre(sel, img(te), e.texteAffiche); lisible = img(te); }
  else if (e.entree === 'saccade') { c.accent(sel, te, e.texteAffiche); lisible = img(te) + 1; }
  else { lisible = img(c.app(sel, te, h, e.texteAffiche)); }
  if (e.compte_de != null) {   // le chiffre compte jusqu'au sien : rapide puis freiné (power2.out), jamais d'image sans chiffre
    const de = +e.compte_de, N = +e.texte, n0 = img(te), nb = A.compte.images;
    for (let v = de; v <= N; v++) {
      const p = (v - de) / (N - de), n = n0 + Math.round(nb * (1 - Math.sqrt(1 - p)));
      const nSuiv = v < N ? n0 + Math.round(nb * (1 - Math.sqrt(1 - (v + 1 - de) / (N - de)))) : null;
      c.js += `tl.set('#${e.id}n${v}', { visibility: 'visible' }, ${f4(tImg(n))});\n`;
      if (nSuiv !== null && nSuiv > n) c.js += `tl.set('#${e.id}n${v}', { visibility: 'hidden' }, ${f4(tImg(nSuiv))});\n`;
    }
    lisible = n0 + nb;
  }
  const at = c.attendus.at(-1); if (at) { at.mot_image = e.sur.image; at.image = Math.max(at.image, 0); }
  // ses mots affichés (le même texte que ce qu'il dit) sortent des sous-titres : chaque mot dit ne s'affiche qu'une fois
  const repris = e.repris ?? (jetons(e.texte).join(' ') === jetons(texteSousTitres(M, `w${e.sur.premier}-w${e.sur.dernier}`, mots)).join(' '));
  if (repris) reprisPar[couche(e)].push([e.sur.premier, e.sur.dernier]);
  if (e.role === 'mot') sons[couche(e)].push(son('arrivee', lisible, `le mot fort « ${e.texteAffiche} » devient lisible`));
  if (e.role === 'relance') sons[couche(e)].push(son('pose', img(te) + (e.entree === 'saccade' ? 1 : 0), `la relance « ${e.texteAffiche} » se pose`));
  // soulignage orange sous le mot fort, qui se trace quand le mot est lisible
  if (e.role === 'mot' && e.souligne) {
    const ep = Math.max(A.souligne.min, A.souligne.part * capDe(e.F)), x = e.x + e.m.gauche, w = e.m.largeur;
    c.html += `  <div class="a" id="${e.id}s" style="left:${x.toFixed(1)}px;top:${(e.g.base + A.souligne.ecart).toFixed(1)}px;width:${w.toFixed(1)}px;height:${ep.toFixed(1)}px;background:${K.orange};border-radius:${(ep / 2).toFixed(1)}px;transform-origin:0 50%;transform:scaleX(0)"></div>\n`;
    c.js += `tl.to('#${e.id}s', { scaleX: 1, duration: ${A.souligne.d}, ease: '${A.souligne.courbe}' }, ${f4(tImg(lisible))});\n`;
  }
}
// question coupée : sur le mot de la réponse, la question se barre d'un trait craie et s'estompe
if (comp.barre_sur) {
  const b = resoudre(comp.barre_sur, mots), tb = b.debut_s;
  els.filter((e) => e.role === 'phrase' && e.barre).forEach((e, k) => {
    const c = NS[couche(e)], x = e.x + e.m.gauche - A.barre.ep, w = e.m.largeur + 2 * A.barre.ep;
    const y = e.g.base - 0.5 * MET.x * e.F - A.barre.ep / 2;
    c.html += `  <div class="a" id="${e.id}b" style="left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${w.toFixed(1)}px;height:${A.barre.ep}px;background:${K.craie};border-radius:${A.barre.ep / 2}px;transform-origin:0 50%;transform:scaleX(0)"></div>\n`;
    c.js += `tl.to('#${e.id}b', { scaleX: 1, duration: ${A.barre.d}, ease: '${A.barre.courbe}' }, ${f4(tb + k * A.barre.decalage)});\n`;
    c.js += `tl.to('#${e.id}', { opacity: ${A.barre.estompe}, duration: ${A.barre.dEstompe}, ease: '${S.COURBES.entree}' }, ${f4(tb + 0.1)});\n`;
  });
}

// Voiles (sous lui, dans la couche derrière) : en haut si un texte est en haut ou derrière lui, en bas si un texte est en bas
const voileHaut = bandes.haut.length || derriere.length, voileBas = bandes.bas.length;
let fondDerriere = '';
if (voileHaut) fondDerriere += `  <div class="a" style="inset:0;${voileCss('standard')}"></div>\n`;
if (voileBas) fondDerriere += `  <div class="a" style="inset:0;${voileCss('standard').replace('to bottom', 'to top')}"></div>\n`;
// Le mot derrière lui dézoome avec la caméra (ouverture.json : même échelle, même point fixe, image par image)
let suit = false;
if (derriere.length && ouverture) {
  const [ax, ay] = ouverture.ancre_1080x1920;
  NS.derriere.html = `  <div class="a" id="cam" style="inset:0;transform-origin:${ax}px ${ay}px">\n${NS.derriere.html}  </div>\n`;
  let js = '';
  for (let n = 0; n <= Math.min(ouverture.images, images); n++) {
    const s = n < ouverture.images ? ouverture.echelle_depart - (ouverture.echelle_depart - 1) * n / ouverture.images : 1;
    js += `tl.set('#cam', { scale: ${s.toFixed(5)} }, ${f4(tImg(n))});\n`;
  }
  NS.derriere.js = js + NS.derriere.js;
  suit = true;
}
NS.derriere.html = fondDerriere + NS.derriere.html;
NS.devant.css += '';

const ecrits = [];
for (const nom of ['derriere', 'devant']) {
  const c = NS[nom], aDesTextes = els.some((e) => couche(e) === nom);
  if (!aDesTextes && !(nom === 'derriere' && fondDerriere)) continue;
  const id = `${d.id}-${nom}`;
  ecrireCalque(M, {
    id, demande: d.id, debut: 0, images, couche: nom, ordre: nom === 'derriere' ? 10 : 30,
    sons_suggeres: sons[nom], attendus: c.attendus.map(({ mi, ...a }) => a), mots_repris: reprisPar[nom],
    suit_ouverture: nom === 'derriere' && suit,
    origine: { sur_mesure: `accroche composée (${comp.type}, effet ${comp.effet}) : ${comp.pourquoi}`,
      gestes_repris: ['apparition v2', 'montée du bas en saccade 12 i/s', 'pavés des hooks', 'mot géant derrière la tête', 'dézoom d\'ouverture'] },
    params: { composition: comp, elements: els.map((e) => ({ role: e.role, texte: e.texteAffiche, place: e.place, aligne: e.aligne, taille: e.taille, entree: e.entree, pave: e.pave })) },
  }, c.page());
  ecrits.push(id);
}

// ------------------------------------------------------------------ 6. la fiche de l'accroche et le registre
const fiche = { id: d.id, video: plan.video || null, type: comp.type, effet: comp.effet, pourquoi: comp.pourquoi, images,
  temps: { ouverture: +temps.ouverture.toFixed(2), mot: +temps.mot.toFixed(2), relance: temps.relance.map((x) => +x.toFixed(2)) },
  elements: els.map((e) => ({ role: e.role, texte: e.texteAffiche, sur: e.sur.texte, place: e.place, aligne: e.aligne, taille: e.taille, entree: e.entree, pave: e.pave })),
  calques: ecrits, haut_tete: tete, ecrit_le: new Date().toISOString().slice(0, 10) };
fs.writeFileSync(path.join(M, 'accroche.json'), JSON.stringify(fiche, null, 2) + '\n');
for (const a of avis) console.log(`AVIS ${a}`);
console.log(`ACCROCHE ${comp.type} (effet ${comp.effet}) : images 0 à ${images - 1} (${(images / FPS).toFixed(1)} s), calques ${ecrits.join(', ')}${suit ? ', le mot derrière lui suit le dézoom' : ''}`);
for (const e of els) console.log(`   ${e.role} « ${e.texteAffiche} » sur « ${e.sur.texte} » à ${t(e).toFixed(2)} s : ${e.place}${e.place !== 'derriere' ? ' ' + e.aligne : ''}, ${e.taille}, entrée ${e.entree}${e.kind === 'pave' ? `, pavé ${e.pave}` : ''}`);
if (avecRegistre) { const l = noter(d, M, { titre: plan.video || null }); console.log(`REGISTRE noté : ${decrire(l)}`); }
console.log(`Ensuite : verifier.mjs sur ${ecrits.join(' et ')} (avec --video), puis calques.mjs.`);

function fin() {
  for (const a of avis) console.log(`AVIS ${a}`);
  for (const r of refus) console.log(`REFUS ${r}`);
  console.log(`REFUSÉ : ${refus.length} problème(s) à corriger dans la demande « accroche » du plan`);
  process.exit(2);
}
