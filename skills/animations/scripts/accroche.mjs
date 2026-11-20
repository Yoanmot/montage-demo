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
// Usage : node accroche.mjs <dossier -montage> --video <vidéo coupée> [--tete <y>] [--sans-registre] [--sans-visage]
//   --video : la vidéo coupée de contrôle, pour mesurer le haut de sa tête et ses yeux (obligatoire) ; --sans-registre,
//             --sans-visage : ne lit ni n'écrit le registre, ne contrôle pas le visage (tests seulement).
// Avant : caler.mjs (plan-resolu.json), et la brique zooms si le plan a son dézoom d'ouverture (ouverture.json).
// Après : verifier.mjs sur chaque calque écrit (a01-derriere, a01-devant), puis calques.mjs.
// Codes : 0 écrit · 2 refusé (liste complète) · 3 fichier manquant · 4 RÉPÉTITION (registre).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { S, K, P, FPS, ICI, Couche, chargerMots, resoudre, texteSousTitres, normaliser, coupes, img, tImg, f4, mesure, son,
  ecrireCalque, voileCss } from './lib/style.mjs';
import { controler, verifier, noter, decrire, remplacements, motFort } from './lib/accroche.mjs';

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
// Substitution : l'élément qui en remplace un autre prend son emplacement (place, alignement, taille, pavé)
const RM = remplacements(els);
for (const [j, i] of RM) { els[j].remplace_de = els[i]; els[i].remplace_par = els[j]; }
const motE = motFort(els);
let orangePris = els.some((e) => (e.role === 'mot' && (e.pave === 'orange' || e.souligne)));
for (const e of [...els.filter((x) => !x.remplace_de), ...els.filter((x) => x.remplace_de)]) {
  const r = e.remplace_de;
  if (r) { e.place = r.place; e.aligne ??= r.aligne; e.taille ??= r.taille; e.pave ??= r.pave; }
  if (e.role === 'phrase') {
    e.place ??= motE.place; e.taille ??= 'normale'; e.entree ??= 'apparition'; e.aligne ??= 'gauche'; e.pave = 'aucun';
    e.texteAffiche = String(e.texte).toLocaleUpperCase('fr');   // un bloc garde la même casse : tout en capitales (Yoan, 2026-11-20)
  } else if (e.role === 'mot') {
    e.taille ??= e.place === 'derriere' ? 'geant' : 'grand'; e.entree ??= 'apparition'; e.aligne ??= 'gauche'; e.pave ??= 'aucun';
    e.texteAffiche = String(e.texte).toLocaleUpperCase('fr');
  } else {
    e.taille ??= 'normale'; e.entree ??= 'saccade'; e.aligne ??= e.place === 'bas' ? 'droite' : 'gauche';
    if (!e.pave) { e.pave = orangePris ? 'craie' : 'orange'; }
    if (e.pave === 'orange' && !r) orangePris = true;
    e.texteAffiche = String(e.texte).toLocaleUpperCase('fr');
  }
  e.kind = e.pave && e.pave !== 'aucun' ? 'pave' : 'ti';
  if (!e.sur) R('MOT_MANQUANT', `« ${e.texte} » : sur quel mot doit-il arriver ?`);
}
if (refus.length) fin();

// Taille et largeur d'encre de chaque élément
for (const e of els) {
  if (e.kind === 'pave') {
    e.F = e.role === 'mot' ? A.pave[e.taille === 'moyen' ? 'moyen' : 'grand'] : A.pave[e.taille];
    { // un pavé trop large pour la zone sûre est ramené à sa largeur (rembourrage compris)
      const k0 = e.F / S.HOOKS.paves.taille, w0 = mesure('encre', 'titre', e.F, e.texteAffiche).avance + 2 * S.HOOKS.paves.padX * k0;
      if (w0 > Z.x1 - Z.x0) { e.F *= (Z.x1 - Z.x0 - 2) / w0; avis.push(`« ${e.texteAffiche} » ramené à la largeur de la zone sûre`); }
    }
    const k = e.F / S.HOOKS.paves.taille;
    e.pad = [S.HOOKS.paves.padY[0] * k, S.HOOKS.paves.padX * k, S.HOOKS.paves.padY[1] * k];
    e.marche = Math.max(S.MARCHE.pave.hauteur, Math.round(S.MARCHE.pave.hauteur * k));
    const m = mesure('encre', 'titre', e.F, e.texteAffiche);
    e.w = m.avance + 2 * e.pad[1];
    e.encre = [0, e.w];
  } else if (e.kind === 'ti' && e.role === 'phrase') {
    // la phrase en capitales, à la hauteur de capitales de sa taille, ramenée à la largeur de la zone sûre s'il le faut
    const F = mesure('taille', 'titre', A.phrase[e.taille]).taille, g = mesure('geant', e.texteAffiche);
    e.F = Math.min(F, g.taille);
    if (e.F < F - 0.5) avis.push(`« ${e.texteAffiche} » trop long pour la taille ${e.taille} : ramené à la largeur de la zone sûre (coupe-la en deux éléments si l'écart de taille avec ses voisins devient trop grand)`);
    e.m = mesure('encre', 'titre', e.F, e.texteAffiche);
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

// Substitution : les deux exemples ont la même taille à la même place (la plus petite des deux, pour que les deux tiennent)
for (const e of els.filter((x) => x.remplace_de && x.kind === 'ti' && x.remplace_de.kind === 'ti')) {
  const r = e.remplace_de, F = Math.min(e.F, r.F);
  for (const x of [e, r]) if (x.F !== F) { x.F = F; x.geant = false; x.m = mesure('encre', 'titre', F, x.texteAffiche); }
}
// Écart de taille (Yoan, 2026-11-20 : « quand il y a de trop grandes différences de taille entre un texte et un autre à
// côté, ça ne rend pas très bien ») : deux éléments voisins dans le même bloc (même bande, ou le haut et le mot derrière
// lui, qui se touchent) n'ont jamais des capitales plus de A.ecartTailleMax fois plus hautes l'une que l'autre.
{
  const capE = (e) => capDe(e.F), ordreBande = { haut: 0, derriere: 1, bas: 2 };
  const blocs = ['haut', 'derriere', 'bas'].map((p) => els.filter((e) => !e.remplace_de && e.place === p));
  const paires = [];
  for (const b of blocs) for (let k = 1; k < b.length; k++) paires.push([b[k - 1], b[k]]);
  if (blocs[0].length && blocs[1].length) paires.push([blocs[0].at(-1), blocs[1][0]]);
  for (const [a, b] of paires) {
    const r = Math.max(capE(a), capE(b)) / Math.min(capE(a), capE(b));
    if (r > A.ecartTailleMax + 1e-6) R('TAILLE', `« ${a.texteAffiche} » et « ${b.texteAffiche} » : capitales de ${Math.round(capE(a))} et ${Math.round(capE(b))} px (${r.toFixed(1)} fois), ${A.ecartTailleMax} au plus entre deux voisins : rapproche les tailles (phrase « grande », mot « moyen » ou « grand » au lieu de « geant », relance « grande »), ou coupe l'élément trop long`);
  }
  void ordreBande;
}
if (refus.length) fin();
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
// Continuité (Yoan, 2026-11-20 : « une phrase tout en haut, ensuite il manque une phrase ») : l'accroche part au plus tard
// quand il dit le premier mot qu'elle n'affiche pas ; les sous-titres reprennent à ce mot, sans trou.
{
  const dernierAffiche = Math.max(...els.map((e) => e.sur.dernier));
  if (mots[dernierAffiche + 1]) images = Math.min(images, img(resoudre(`w${dernierAffiche + 1}`, mots).debut_s));
}
images = Math.min(images, Math.max(1, total || images));
// Un plan filmé (ou son écran « B-ROLL ») qui commence avant la fin prévue : l'accroche s'arrête à sa coupe, pour lui
// laisser la place (Yoan, 2026-11-20 : la chose concrète citée juste après les exemples se montre). Pas de vide après
// 3 s : le plan prend le relais. Jamais avant A.fin.plan s.
let parPlan = null;
{
  const debuts = [...(plan.b_roll || []).map((b) => b.de), ...(plan.animations || []).filter((a) => a.geste === 'plan-a-filmer').map((a) => a.de)]
    .filter(Boolean).map((x) => { try { return resoudre(x, mots); } catch { return null; } }).filter(Boolean);
  for (const b of debuts) {
    const coupe = coupesV.filter((c) => c <= b.image && b.image - c <= A.fin.aimant * FPS).at(-1) ?? b.image;
    if (coupe < images && coupe >= img(A.fin.plan)) { images = coupe; parPlan = b.texte; }
  }
}

const UNITES = { un: '1', une: '1', deux: '2', trois: '3', quatre: '4', cinq: '5', six: '6', sept: '7', huit: '8', neuf: '9', dix: '10',
  onze: '11', douze: '12', treize: '13', quatorze: '14', quinze: '15', seize: '16', vingt: '20', trente: '30', cent: '100' };
const jetons = (s) => normaliser(s).split(/\s+/).filter(Boolean).map((w) => UNITES[w] || w);

// Une accroche se lit comme une phrase, pas comme des mots-clés (Yoan, 2026-11-20, essai « douze semaines » : « les
// clients / MEILLEURS RÉSULTATS / LONG TERME » se lisait comme une liste). Lue de haut en bas dans l'ordre de sa voix :
// - la phrase de tête est une vraie phrase courte (A.lecture.phraseMin mots au moins) qui pose la tension ;
// - chaque élément reprend ses mots tels qu'il les dit, et d'un élément au suivant on ne saute pas plus de
//   A.lecture.sautMax mots de ce qu'il dit : phrase, mot fort et relance se lisent comme une suite logique.
// Un titre reformulé (qui n'est pas ce qu'il dit) passe avec « titre_reformule » (sa raison) : la règle devient un avis.
{
  const dits = (e) => jetons(texteSousTitres(M, `w${e.sur.premier}-w${e.sur.dernier}`, mots)).join(' ');
  const ordre = [...els].sort((x, y) => x.sur.premier - y.sur.premier);
  const pb = [];
  const phrases = els.filter((e) => e.role === 'phrase');
  // Substitution : le premier exemple (tout ce qui arrive avant le premier remplacement) se lit comme une phrase
  const premierRemplacement = RM.size ? Math.min(...els.filter((e) => e.remplace_de).map((e) => e.sur.premier)) : null;
  if (RM.size) {
    const tete = ordre.filter((e) => e.sur.premier < premierRemplacement);
    const n = tete.reduce((k, e) => k + jetons(e.texte).length, 0);
    if (n < A.lecture.phraseMin) pb.push(`le premier exemple (« ${tete.map((e) => e.texte).join(' / ')} ») a ${n} mot(s) : il en faut ${A.lecture.phraseMin} au moins pour qu'il se lise comme une phrase`);
  } else if (!phrases.length) pb.push('il n\'y a pas de phrase de tête : une phrase courte qui pose la tension, avant le mot fort');
  // une phrase peut tenir sur plusieurs lignes (éléments « phrase » qui se suivent) : c'est leur ensemble qui compte
  const blocs = [];
  for (const e of ordre) { if (e.role !== 'phrase') { blocs.push(null); continue; } if (blocs.length && blocs.at(-1)) blocs.at(-1).push(e); else blocs.push([e]); }
  for (const b of RM.size ? [] : blocs.filter(Boolean)) {
    const n = b.reduce((k, e) => k + jetons(e.texte).length, 0), txt = b.map((e) => e.texte).join(' ');
    if (n < A.lecture.phraseMin) pb.push(`« ${txt} » n'est pas une phrase (${n} mot(s), ${A.lecture.phraseMin} au moins) : prends la phrase qui pose la tension, une suite de ses mots qui mène au mot fort`);
  }
  if (ordre[0].sur.premier !== 0) pb.push(`elle commence sur « ${ordre[0].sur.texte} » : ses premiers mots (« ${texteSousTitres(M, `w0-w${ordre[0].sur.premier - 1}`, mots)} ») ne sont nulle part à l'écran ; l'accroche commence sur son premier mot`);
  for (const e of els) if (jetons(e.texte).join(' ') !== dits(e)) pb.push(`« ${e.texte} » n'est pas ce qu'il dit sur « ${e.sur.texte} » : reprends ses mots exacts`);
  for (let k = 1; k < ordre.length; k++) {
    const saut = ordre[k].sur.premier - ordre[k - 1].sur.dernier - 1;
    if (saut > A.lecture.sautMax) pb.push(`entre « ${ordre[k - 1].texte} » et « ${ordre[k].texte} », ${saut} mots qu'il dit sont sautés (« ${texteSousTitres(M, `w${ordre[k - 1].sur.dernier + 1}-w${ordre[k].sur.premier - 1}`, mots)} ») : ça se lit comme des mots-clés ; prends-les dans l'élément, ou choisis des mots qui se suivent`);
  }
  const reform = comp.titre_reformule && String(comp.titre_reformule).trim().length >= 20;
  if (pb.length) { if (reform) avis.push(...pb.map((x) => `LECTURE ${x} (titre reformulé : ${comp.titre_reformule})`)); else pb.forEach((x) => R('LECTURE', x)); }
}

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
const fixes = els.filter((e) => !e.remplace_de);
const bandes = { haut: fixes.filter((e) => e.place === 'haut'), derriere, bas: fixes.filter((e) => e.place === 'bas') };
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
// Substitution : même emplacement que l'élément remplacé (même haut visuel ; l'alignement fait le reste)
for (const e of els.filter((x) => x.remplace_de)) e.g = geo(e, topPour(e, e.remplace_de.g.vTop));
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
  // un élément qui en remplace un autre ne touche aucun élément affiché en même temps que lui
  const vis = (e) => [t(e), e.remplace_par ? t(e.remplace_par) : Infinity];
  const boite = (e) => ({ x: e.kind === 'pave' ? [e.x, e.x + e.w] : [e.x + e.m.gauche, e.x + e.m.droite], y: [e.g.vTop, e.g.bas] });
  for (const e of els.filter((x) => x.remplace_de)) {
    for (const o of els) {
      if (o === e || o === e.remplace_de) continue;
      const [a0, a1] = vis(e), [b0, b1] = vis(o);
      if (!(a0 < b1 && b0 < a1)) continue;
      const p = boite(e), q = boite(o);
      if (p.x[0] < q.x[1] && q.x[0] < p.x[1] && p.y[0] < q.y[1] + A.ecartBlocs / 2 && q.y[0] < p.y[1] + A.ecartBlocs / 2) R('CHEVAUCHEMENT', `« ${e.texteAffiche} » (à la place de « ${e.remplace_de.texteAffiche} ») touche « ${o.texteAffiche} » : une taille plus petite, ou un autre emplacement pour le premier exemple`);
    }
  }
}
if (refus.length) fin();

// Rien ne couvre ses yeux ni sa bouche (2026-11-20, essai « douze semaines » : une relance en bas tombait sur sa bouche).
// Le haut de la tête ne suffit pas : ses yeux sont mesurés (Apple Vision, comme les zooms) toutes les 10 images de
// l'accroche, et la zone va des sourcils au menton (lib/visage.py). Un texte posé devant lui (en haut ou en bas) ne la
// touche jamais, dézoom d'ouverture compris ; derrière lui, il passe sous lui et ne compte pas.
{
  const video = opt('--video');
  if (!args.includes('--sans-visage')) {
    if (!video || !fs.existsSync(video)) { R('VIDEO_MANQUANTE', 'donne --video <vidéo coupée> : le script vérifie que rien ne couvre ses yeux ni sa bouche'); fin(); }
    const V = JSON.parse(execFileSync('/usr/bin/python3', [path.join(ICI, 'visage.py'), video, '0', String(images), '10'], { encoding: 'utf8' }).trim().split('\n').at(-1));
    if (!V.mesurees) avis.push('visage introuvable sur l\'accroche : rien n\'a pu être contrôlé sur ses yeux et sa bouche, regarde la planche');
    const echelleOuv = (n) => (ouverture && n < ouverture.images ? ouverture.echelle_depart - (ouverture.echelle_depart - 1) * n / ouverture.images : 1);
    for (const e of els) {
      if (e.place === 'derriere') continue;
      const bx = e.kind === 'pave' ? [e.x, e.x + e.w] : [e.x + e.m.gauche, e.x + e.m.droite], by = [e.g.vTop, e.g.bas];
      const n0 = img(t(e));
      for (const z of V.zones) {
        if (z.image + 10 <= n0) continue;
        const s = echelleOuv(z.image), [ax, ay] = ouverture ? ouverture.ancre_1080x1920 : [540, 960];
        const X = [ax + (z.x0 - ax) * s, ax + (z.x1 - ax) * s], Y = [ay + (z.y0 - ay) * s, ay + (z.y1 - ay) * s];
        if (bx[0] < X[1] && X[0] < bx[1] && by[0] < Y[1] && Y[0] < by[1]) {
          R('VISAGE', `« ${e.texteAffiche} » couvre ses yeux ou sa bouche (vers ${(z.image / FPS).toFixed(1)} s) : place-le ${e.place === 'bas' ? 'plus haut, au-dessus de sa tête, ou de l\'autre côté' : 'au-dessus de sa tête, ou derrière lui'}`);
          break;
        }
      }
    }
  }
}
if (refus.length) fin();

// ------------------------------------------------------------------ 5. les calques
const NS = { derriere: new Couche(images), devant: new Couche(images) };
const reprisPar = { derriere: [], devant: [] };
const sons = { derriere: [], devant: [] };
const couche = (e) => (e.place === 'derriere' ? 'derriere' : 'devant');
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
  if (e.remplace_de) {
    // remplacement net (Yoan, 2026-11-20 : « texte qui se fait remplacer de manière assez clean ») : l'ancien part vers le
    // haut en s'effaçant, le nouveau monte à sa place, sur l'attaque de son mot ; jamais les deux lisibles ensemble
    const R2 = A.remplace, dy = R2.y * h, dyR = R2.y * (e.remplace_de.kind === 'pave' ? e.remplace_de.g.bas - e.remplace_de.g.vTop : capDe(e.remplace_de.F));
    NS[couche(e.remplace_de)].js += `tl.to('#${e.remplace_de.id}', { opacity: 0, y: ${(-dyR).toFixed(1)}, duration: ${R2.sortie}, ease: '${R2.courbeSortie}' }, ${f4(te - R2.sortie)});\n`;
    c.js += `tl.fromTo('${sel}', { opacity: 0, y: ${dy.toFixed(1)} }, { opacity: 1, y: 0, duration: ${R2.entree}, ease: '${R2.courbeEntree}', immediateRender: true }, ${f4(te)});\n`;
    lisible = img(te + R2.entree / 2);
    c.attendus.push({ nom: e.texteAffiche, image: lisible });
  } else if (e.entree === 'pose') { c.montre(sel, img(te), e.texteAffiche); lisible = img(te); }
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
  if (e === motE) sons[couche(e)].push(son('arrivee', lisible, `le mot fort « ${e.texteAffiche} » devient lisible`));
  if (e.role === 'relance') sons[couche(e)].push(son('pose', img(te) + (e.entree === 'saccade' ? 1 : 0), `la relance « ${e.texteAffiche} » se pose`));
  // soulignage orange sous le mot fort, qui se trace quand le mot est lisible
  if (e.role === 'mot' && e.souligne) {
    const ep = Math.max(A.souligne.min, A.souligne.part * capDe(e.F)), x = e.x + e.m.gauche, w = e.m.largeur;
    c.html += `  <div class="a" id="${e.id}s" style="left:${x.toFixed(1)}px;top:${(e.g.base + A.souligne.ecart).toFixed(1)}px;width:${w.toFixed(1)}px;height:${ep.toFixed(1)}px;background:${K.orange};border-radius:${S.RAYONS.pilule}px;clip-path:inset(0 100% 0 0)"></div>\n`;
    c.js += `tl.to('#${e.id}s', { clipPath: 'inset(0 0% 0 0)', duration: ${A.souligne.d}, ease: '${A.souligne.courbe}' }, ${f4(tImg(lisible))});\n`;
  }
}
// question coupée : sur le mot de la réponse, la question se barre d'un trait craie et s'estompe
if (comp.barre_sur) {
  const b = resoudre(comp.barre_sur, mots), tb = b.debut_s;
  els.filter((e) => e.role === 'phrase' && e.barre).forEach((e, k) => {
    const c = NS[couche(e)], x = e.x + e.m.gauche - A.barre.ep, w = e.m.largeur + 2 * A.barre.ep;
    const y = e.g.base - 0.5 * MET.x * e.F - A.barre.ep / 2;
    c.html += `  <div class="a" id="${e.id}b" style="left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${w.toFixed(1)}px;height:${A.barre.ep}px;background:${K.craie};border-radius:${S.RAYONS.pilule}px;clip-path:inset(0 100% 0 0)"></div>\n`;
    c.js += `tl.to('#${e.id}b', { clipPath: 'inset(0 0% 0 0)', duration: ${A.barre.d}, ease: '${A.barre.courbe}' }, ${f4(tb + k * A.barre.decalage)});\n`;
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
    // pendant l'accroche, son texte remplace les sous-titres (Yoan, 2026-11-20 : « le côté caption avec le surlignage
    // blanc sur le hook, il faut vraiment l'enlever ») : aucun sous-titre tant qu'elle est à l'écran
    masque_sous_titres: true,
    oranges: els.some((e) => couche(e) === nom && (e.pave === 'orange' || (e.role === 'mot' && e.souligne))) ? [[0, images]] : [],
    origine: { sur_mesure: `accroche composée (${comp.type}, effet ${comp.effet}) : ${comp.pourquoi}`,
      gestes_repris: ['apparition v2', 'montée du bas en saccade 12 i/s', 'pavés des hooks', 'mot géant derrière la tête', 'dézoom d\'ouverture'] },
    params: { composition: comp, elements: els.map((e) => ({ role: e.role, texte: e.texteAffiche, place: e.place, aligne: e.aligne, taille: e.taille, entree: e.remplace_de ? 'remplacement' : e.entree, pave: e.pave, ...(e.remplace_de ? { remplace: e.remplace_de.texteAffiche } : {}) })) },
  }, c.page());
  ecrits.push(id);
}

// ------------------------------------------------------------------ 6. la fiche de l'accroche et le registre
const fiche = { id: d.id, video: plan.video || null, type: comp.type, effet: comp.effet, pourquoi: comp.pourquoi, images,
  temps: { ouverture: +temps.ouverture.toFixed(2), mot: +temps.mot.toFixed(2), relance: temps.relance.map((x) => +x.toFixed(2)) },
  elements: els.map((e) => ({ role: e.role, texte: e.texteAffiche, sur: e.sur.texte, place: e.place, aligne: e.aligne, taille: e.taille, entree: e.remplace_de ? 'remplacement' : e.entree, pave: e.pave, ...(e.remplace_de ? { remplace: e.remplace_de.texteAffiche } : {}) })),
  calques: ecrits, haut_tete: tete, ecrit_le: new Date().toISOString().slice(0, 10) };
fs.writeFileSync(path.join(M, 'accroche.json'), JSON.stringify(fiche, null, 2) + '\n');
for (const a of avis) console.log(`AVIS ${a}`);
console.log(`ACCROCHE ${comp.type} (effet ${comp.effet}) : images 0 à ${images - 1} (${(images / FPS).toFixed(1)} s), calques ${ecrits.join(', ')}${suit ? ', le mot derrière lui suit le dézoom' : ''}${parPlan ? `, s'arrête où commence le plan filmé « ${parPlan} »` : ''}`);
for (const e of els) console.log(`   ${e.role} « ${e.texteAffiche} » sur « ${e.sur.texte} » à ${t(e).toFixed(2)} s : ${e.place}${e.place !== 'derriere' ? ' ' + e.aligne : ''}, ${e.taille}, entrée ${e.remplace_de ? `remplacement de « ${e.remplace_de.texteAffiche} »` : e.entree}${e.kind === 'pave' ? `, pavé ${e.pave}` : ''}`);
if (avecRegistre) { const l = noter(d, M, { titre: plan.video || null }); console.log(`REGISTRE noté : ${decrire(l)}`); }
console.log(`Ensuite : verifier.mjs sur ${ecrits.join(' et ')} (avec --video), puis calques.mjs.`);

function fin() {
  for (const a of avis) console.log(`AVIS ${a}`);
  for (const r of refus) console.log(`REFUS ${r}`);
  console.log(`REFUSÉ : ${refus.length} problème(s) à corriger dans la demande « accroche » du plan`);
  process.exit(2);
}
