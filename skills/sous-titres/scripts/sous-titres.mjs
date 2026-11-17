#!/usr/bin/env node
// Sous-titres d'une vidéo coupée par couper-silences, au style choisi par Romain le 29/10 (blanc très gras, groupes de
// 1 à 4 mots, pavé orange qui glisse sous le mot dit ; repris de captions_romain.py, refait en calque HyperFrames le
// 2026-11-13). Rien ne part sur un serveur.
//
//   node sous-titres.mjs texte <dossier>      écrit texte-sous-titres.md : le texte, chaque mot précédé de son numéro
//   node sous-titres.mjs preparer <dossier>   lit sous-titres.json (corrections, masquer, citations, taille, position,
//                                             pave), retire les mots qu'une animation affiche déjà (mots_repris), découpe
//                                             les groupes, écrit le calque calques/st/ (projet HyperFrames prêt à
//                                             rendre) et son entrée dans calques.json (source « sous-titres », ordre 100)
//
// <dossier> = le dossier <nom>-montage de la vidéo. Base de temps : la vidéo coupée, 30 images par seconde.
// Le gabarit vient de ../animations/bibliotheque/sous-titres/devant/index.html (skill voisin). Pour les tests
// seulement, la variable d'environnement SOUS_TITRES_BIBLIOTHEQUE peut désigner un autre dossier bibliotheque/.
//
// Codes de sortie : 0 ok · 1 usage · 2 fichier introuvable · 9 gabarit inattendu · 13 sous-titres.json à corriger
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { decouper, instants, finDePhrase, coupeLignes } from './groupes.mjs';

const FPS = 30;

const ici = path.dirname(fileURLToPath(import.meta.url));
const say = (m) => process.stdout.write(m + '\n');
function fail(code, m) { say(m); process.exit(code); }
const lire = (p) => fs.readFileSync(p, 'utf8');
const ecrire = (p, t) => fs.writeFileSync(p, t, 'utf8');

// ---------------------------------------------------------------- les mots de la vidéo coupée
function mots(w) {
  const p = path.join(w, 'words.cut.json');
  if (!fs.existsSync(p)) fail(2, `TEXTE_INTROUVABLE : lance d'abord le skill couper-silences sur cette vidéo (il manque words.cut.json dans ${w}).`);
  return JSON.parse(lire(p)).words;
}
// Ce qui s'affiche d'un mot : sans guillemets ni ponctuation autour (le style retire la ponctuation de fin).
const affiche = (t) => String(t).trim().replace(/^[«"“(\s]+/, '').replace(/[.,;:!?…»"”)\s]+$/, '');

// Images de la vidéo coupée : somme des morceaux gardés de filtre.txt
function imagesCoupees(w) {
  const f = path.join(w, 'filtre.txt');
  if (fs.existsSync(f)) {
    let n = 0;
    for (const m of lire(f).matchAll(/trim=start_frame=(\d+):end_frame=(\d+)/g)) n += Number(m[2]) - Number(m[1]);
    if (n > 0) return n;
  }
  const e = path.join(w, 'edl.json');
  if (fs.existsSync(e)) { const s = JSON.parse(lire(e)).stats; if (s && s.out_frames) return s.out_frames; }
  fail(2, `COUPES_INTROUVABLES : il manque filtre.txt dans ${w} (relance la compilation des coupes).`);
}

// ---------------------------------------------------------------- texte
// « / » = une vraie coupe de la vidéo juste avant le mot : la même règle que celle qui pose une transition
// (coupeAvant de ../animations/scripts/lib/style.mjs, sur edl.json). Une seule vérité : un mot marqué « / » accepte un
// flash, un mot sans « / » le refuse (PAS_DE_COUPE).
async function cmdTexte(w) {
  const W = mots(w);
  const { coupeAvant, img } = await import(path.join(ici, '..', '..', 'animations', 'scripts', 'lib', 'style.mjs'));
  if (!fs.existsSync(path.join(w, 'edl.json'))) fail(2, `COUPES_INTROUVABLES : il manque edl.json dans ${w} (relance la compilation des coupes).`);
  const lignes = ['# Texte des sous-titres, chaque mot précédé de son numéro',
    '# « / » = une coupe de la vidéo juste avant ce mot (un flash peut s\'y poser). Les signes seuls (« ? », « : », guillemets) ne s\'affichent pas.', ''];
  let ligne = [];
  W.forEach((m, i) => {
    const t = String(m.text).trim();
    if (!t) return;
    const coupe = i > 0 && coupeAvant(w, { premier: i, image: img(m.start) }, W) !== null ? '/ ' : '';
    ligne.push(`${coupe}[${i}]${t}`);
    if (finDePhrase(t)) { lignes.push(ligne.join(' ')); ligne = []; }
  });
  if (ligne.length) lignes.push(ligne.join(' '));
  const out = path.join(w, 'texte-sous-titres.md');
  ecrire(out, lignes.join('\n') + '\n');
  say(`PRÊT texte=${out} mots=${W.length}`);
}

// ---------------------------------------------------------------- bibliothèque et boîte à outils du style
function bibliotheque() {
  const essais = [process.env.SOUS_TITRES_BIBLIOTHEQUE, path.resolve(ici, '..', '..', 'animations', 'bibliotheque')].filter(Boolean);
  for (const b of essais) if (fs.existsSync(path.join(b, 'sous-titres', 'devant', 'index.html'))) return b;
  fail(2, `BIBLIOTHEQUE_INTROUVABLE : le skill animations (et sa bibliotheque/) doit être installé à côté de ce skill (cherché : ${essais.join(' ; ')}).`);
}
const outils = async () => import(pathToFileURL(path.join(ici, '..', '..', 'animations', 'scripts', 'lib', 'style.mjs')).href);

// ---------------------------------------------------------------- groupes : groupes.mjs (découpe et instants, partagés avec
// les effets qui affichent une phrase en sous-titres, comme la phrase du bas du plein écran puzzle)

// ---------------------------------------------------------------- calque
function calque(bib, html, sortie, ST) {
  fs.rmSync(sortie, { recursive: true, force: true });
  fs.mkdirSync(path.join(sortie, 'fonts'), { recursive: true });
  fs.mkdirSync(path.join(sortie, 'vendor'), { recursive: true });
  for (const f of [ST.police.file, ST.police.ofl]) fs.copyFileSync(path.join(bib, 'fonts', f), path.join(sortie, 'fonts', f));
  fs.copyFileSync(path.join(bib, 'vendor', 'gsap.min.js'), path.join(sortie, 'vendor', 'gsap.min.js'));
  ecrire(path.join(sortie, 'index.html'), html);
}

// Calques des autres briques marqués masque_sous_titres (ils portent leur propre ligne de sous-titre, ou couvrent l'écran du texte qu'il dit).
function lireMasques(w) {
  const p = path.join(w, 'calques.json');
  if (!fs.existsSync(p)) return [];
  let j;
  try { j = JSON.parse(lire(p)); } catch { fail(13, `CALQUES_ILLISIBLE : ${p} n'est pas un JSON valide.`); }
  return (j.calques || []).filter((c) => c.source !== 'sous-titres' && c.masque_sous_titres === true)
    .map((c) => ({ id: c.id, debut: Number(c.debut), images: Number(c.images) }));
}

// Mots qu'une animation affiche déjà en texte (mots_repris de calques.json, écrit par animations) : chaque mot dit n'est vu
// qu'une fois (Yoan, 2026-11-14). Renvoie Map numéro de mot -> id du calque.
function lireRepris(w) {
  const p = path.join(w, 'calques.json');
  const out = new Map();
  if (!fs.existsSync(p)) return out;
  let j;
  try { j = JSON.parse(lire(p)); } catch { fail(13, `CALQUES_ILLISIBLE : ${p} n'est pas un JSON valide.`); }
  for (const c of j.calques || []) if (c.source !== 'sous-titres') for (const i of c.mots_repris || []) if (!out.has(+i)) out.set(+i, c.id);
  return out;
}

function majCalques(w, entree) {
  const p = path.join(w, 'calques.json');
  let j = { calques: [] };
  if (fs.existsSync(p)) {
    try { j = JSON.parse(lire(p)); } catch { fail(13, `CALQUES_ILLISIBLE : ${p} n'est pas un JSON valide, rien n'a été écrit.`); }
    if (!Array.isArray(j.calques)) j.calques = [];
  }
  j.calques = j.calques.filter((c) => c.source !== 'sous-titres');
  j.calques.push(entree);
  const tmp = p + '.tmp';
  ecrire(tmp, JSON.stringify(j, null, 2) + '\n');
  fs.renameSync(tmp, p);
}

// ---------------------------------------------------------------- preparer
async function cmdPreparer(w) {
  const W = mots(w);
  const n = W.length;
  const rp = path.join(w, 'sous-titres.json');
  let R = {};
  if (fs.existsSync(rp)) { try { R = JSON.parse(lire(rp)); } catch (e) { fail(13, `SOUS-TITRES_ILLISIBLE : ${e.message}`); } }
  const bad = (m) => fail(13, `SOUS-TITRES_ILLISIBLE : ${m}`);
  const num = (k, quoi) => { const i = Number(k); if (!Number.isInteger(i) || i < 0 || i >= n) bad(`${quoi} : mot n°${k} inexistant (0 à ${n - 1}).`); return i; };
  const avis = [];
  for (const k of Object.keys(R)) {
    if (['style', 'groupes', 'motsForts'].includes(k)) avis.push(`« ${k} » ignoré : les sous-titres n'ont plus qu'un style, et les groupes se découpent tout seuls (règle de l'ancien skill)`);
    else if (!['corrections', 'masquer', 'citations', 'taille', 'position', 'pave', 'volume'].includes(k)) avis.push(`« ${k} » inconnu, ignoré`);
  }
  const pave = R.pave ?? undefined;
  if (pave !== undefined && typeof pave !== 'boolean') bad(`pave ${JSON.stringify(R.pave)} : true (pavé orange sous le mot dit) ou false (sans pavé).`);
  const taille = R.taille ?? 1, position = R.position ?? undefined;
  if (typeof taille !== 'number' || taille < 0.5 || taille > 2) bad(`taille ${JSON.stringify(R.taille)} : un nombre entre 0.5 et 2 (1 = la taille normale).`);
  if (position !== undefined && (typeof position !== 'number' || position < 0.2 || position > 0.9)) bad(`position ${JSON.stringify(R.position)} : un nombre entre 0.2 (haut) et 0.9 (bas) ; 0.70 par défaut.`);

  // corrections (la ponctuation de fin du mot d'origine est gardée : elle marque les fins de phrase)
  const texte = W.map((m) => String(m.text));
  const corrige = new Set();
  for (const [k, v] of Object.entries(R.corrections ?? {})) {
    const i = num(k, 'corrections');
    let c = String(v);
    const fin = (texte[i].trim().match(/[.!?…,;:]+$/) || [''])[0];
    if (fin && c.trim() && !/[.!?…,;:]$/.test(c.trim())) c = c.trim() + fin;
    texte[i] = c; corrige.add(i);
  }
  const masque = new Set();
  for (const r of R.masquer ?? []) {
    const a = num([].concat(r)[0], 'masquer'), b = num([].concat(r).at(-1), 'masquer');
    for (let k = a; k <= b; k++) masque.add(k);
  }

  // citations (marquées par le plan) : rien ne s'affiche en plus, pas de guillemets (Yoan, 2026-11-14, retours sur v12) ;
  // la citation fait seulement ses propres groupes (jamais un groupe à cheval entre elle et la phrase autour)
  const citations = [];
  for (const c of R.citations ?? []) {
    const a = num([].concat(c)[0], 'citations'), b = num([].concat(c).at(-1), 'citations');
    if (b < a) bad(`citations : [${a}, ${b}] à l'envers.`);
    citations.push([a, b]);
  }
  const repris = lireRepris(w);
  const L0 = await outils();
  const B0 = L0.bornesCitations({ citations }, (i) => !masque.has(i) && !repris.has(i) && !!affiche(texte[i]));
  const debutsCit = new Set(citations.map((c) => c[0])), finsCit = new Set(citations.map((c) => c[1]));

  // mots affichés : un signe seul (« ? », « : », guillemet) se colle au mot d'avant (et ferme sa phrase) ; un mot
  // corrigé en "" est réuni au précédent. Texte affiché tel que dit (casse gardée), sans ponctuation autour.
  const liste = [];   // { i, w, s, e, brut, coupeAvant?, coupeApres?, barriere? }
  const retires = [];  // mots repris par une animation : [numéro, calque]
  let apresRepris = false;
  for (let i = 0; i < n; i++) {
    if (masque.has(i)) continue;
    const t = texte[i];
    // mot affiché par une animation : il sort des sous-titres ; le groupe d'avant s'arrête à son attaque, le suivant
    // commence une nouvelle phrase (jamais un groupe à cheval sur le passage repris)
    if (repris.has(i)) {
      if (affiche(t)) retires.push([i, repris.get(i)]);
      const der = liste.at(-1);
      if (der && der.barriere === undefined && !apresRepris) der.barriere = W[i].start;
      apresRepris = true;
      continue;
    }
    if (!affiche(t)) {
      const der = liste.at(-1);
      if (der) { der.brut += t.trim(); if (corrige.has(i)) der.e = W[i].end; }
      continue;
    }
    const w = affiche(t);
    liste.push({ i, w, s: W[i].start, e: W[i].end, brut: t.trim(), coupeAvant: apresRepris || debutsCit.has(i), coupeApres: finsCit.has(i) });
    apresRepris = false;
  }
  // fin de citation sur un mot non affiché (signe seul) : la coupure va sur le dernier mot affiché de la citation
  for (const m of liste) if (B0.dernier.has(m.i)) m.coupeApres = true;
  for (const m of liste) if (B0.premier.has(m.i)) m.coupeAvant = true;
  if (!liste.length) bad('tous les mots sont masqués.');

  const L = L0;
  const ST = L.S.SOUS_TITRES;
  const G0 = L.geoSousTitres({ taille, position, pave });
  // volume (réglage « volume » de sous-titres.json, 2026-11-14, choix de Romain) : { mots_max, caracteres_max, lignes } ;
  // absent = le réglage de l'ancien skill (4 mots, 20 caractères, une ligne), rendu inchangé. caracteres_max null = pas
  // de limite en caractères (seule la largeur compte) ; lignes 2 = un groupe trop long pour une ligne se pose sur deux ;
  // coupe_pause = blanc (s) qui coupe une phrase (0,15 par défaut, plus long = groupes plus longs) ; virgules true = les
  // coupures cherchent les virgules et évitent un mot seul.
  // défaut provisoire (SOUS_TITRES.volume de commun.mjs, niveau 2) ; « ancien » = le réglage de l'ancien skill
  if (R.volume !== undefined && R.volume !== 'ancien' && (typeof R.volume !== 'object' || R.volume === null || Array.isArray(R.volume))) bad('volume : "ancien" ou { "mots_max": 4, "caracteres_max": null, "lignes": 1, "coupe_pause": 0.25, "virgules": true }');
  const V = R.volume === 'ancien' ? { ...ST.volumeAncien } : { ...ST.volume, ...(R.volume || {}) };
  if (typeof V !== 'object' || Array.isArray(V)) bad('volume : { "mots_max": 4, "caracteres_max": 20, "lignes": 1 }');
  for (const k of Object.keys(V)) if (!['mots_max', 'caracteres_max', 'lignes', 'coupe_pause', 'virgules'].includes(k)) avis.push(`volume.${k} inconnu, ignoré`);
  const motsMax = V.mots_max ?? ST.motsMax, lignes = V.lignes ?? 1;
  if (!Number.isInteger(motsMax) || motsMax < 1 || motsMax > 10) bad(`volume.mots_max ${JSON.stringify(V.mots_max)} : un entier de 1 à 10.`);
  if (![1, 2].includes(lignes)) bad(`volume.lignes ${JSON.stringify(V.lignes)} : 1 ou 2.`);
  if (V.caracteres_max !== undefined && V.caracteres_max !== null && !(Number.isInteger(V.caracteres_max) && V.caracteres_max >= 8)) bad('volume.caracteres_max : un entier (8 au moins) ou null.');
  if (V.coupe_pause !== undefined && !(typeof V.coupe_pause === 'number' && V.coupe_pause >= 0.1 && V.coupe_pause <= 1)) bad('volume.coupe_pause : un nombre de secondes entre 0.1 et 1.');
  const G = { ...G0, lignes, coupePause: V.coupe_pause, virgules: V.virgules === true, penalite: 0.6 * G0.largeurMax, caracteresMax: V.caracteres_max === null ? Infinity : V.caracteres_max !== undefined ? Math.round(V.caracteres_max / taille) : G0.caracteresMax };
  const STv = { ...ST, motsMax };
  const pol = G.police, px = G.px, fsp = G.fsp;
  // largeur visible d'une ligne : avances arrondies au px (comme Pillow dans l'ancien script), chaque lettre resserrée
  // sauf les espaces, rien après la dernière
  const largeur = (s) => { const nb = [...s].length - (s.split(' ').length - 1); return s ? pol.avance(s, px, true) + fsp * Math.max(0, nb - 1) : 0; };
  for (const m of liste) for (const ch of m.w) if (!pol.a(ch)) avis.push(`le caractère « ${ch} » (mot « ${m.w} ») n'existe pas dans la police des sous-titres : il s'affichera dans une autre police`);
  const gs = decouper(liste, largeur, STv, G);

  // instants (captions_romain.py, sous_titres()) : un groupe apparaît à l'attaque de son premier mot ; suivi d'un blanc
  // de moins de 0,5 s il part au début du suivant, sinon 0,25 s après son dernier mot, en fondu ; le premier groupe
  // après un blanc de 0,5 s (et le tout premier) monte en fondu.
  // Un groupe suivi de mots repris par une animation s'arrête au plus tard à l'attaque du premier mot repris (barriere) :
  // l'animation montre ces mots, les sous-titres ne les montrent pas avant elle.
  const groupes = instants(gs, ST);
  // deux lignes : indice du premier mot de la deuxième ligne (absent = une ligne)
  if (lignes > 1) gs.forEach((g, i) => { const k = coupeLignes(g, largeur, G); if (k > 0) groupes[i].coupe = k; });
  for (const g of gs) {
    const line = g.map((x) => x.w).join(' ');
    if (g.length === 1 && largeur(line) > G.largeurMax) avis.push(`mot trop large pour une ligne : « ${line} » (${Math.round(largeur(line))} px sur ${Math.round(G.largeurMax)})`);
  }
  if (G.top + G.pvTop + G.pvH > L.S.ZONE_SURE.y1 + 2 || G.top + G.pvTop < L.S.ZONE_SURE.y0) avis.push(`à cette taille et cette position, la ligne sort de la zone sûre Instagram (y ${L.S.ZONE_SURE.y0} à ${L.S.ZONE_SURE.y1})`);

  const images = imagesCoupees(w);

  // Calques marqués masque_sous_titres dans calques.json (écrit par animations) : pendant un tel calque, aucun
  // sous-titre de la vidéo. Règle (Yoan, 2026-11-11) : un groupe déjà affiché à l'entrée du calque est COUPÉ NET à
  // l'image d'entrée (il ne revient pas à la sortie) ; s'il n'aurait été visible que moins de COUPE_MIN images avant,
  // il est retiré en entier (pas de flash). Un groupe qui apparaîtrait pendant le calque est retiré en entier.
  // Les autres groupes gardent leurs instants exacts.
  const masques = lireMasques(w);
  const imageDe = (t) => Math.max(0, Math.ceil(t * FPS - 1e-6));   // première image où l'instant t est passé
  const COUPE_MIN = 6;   // 0,2 s
  const court = (t) => { const m = t.split(' '); return m.length > 8 ? m.slice(0, 8).join(' ') + ' …' : t; };
  const caches = [], coupesNet = [], raisons = [];
  groupes.forEach((g, gi) => {
    const txt = g.mots.map((m) => m.w).join(' ');
    const on = imageDe(g.t0), off = Math.min(images, imageDe(g.t1));
    const m = masques.filter((c) => on < c.debut + c.images && c.debut < off).sort((x, y) => x.debut - y.debut)[0];
    if (!m) return;
    if (on < m.debut && m.debut - on >= COUPE_MIN) {
      coupesNet.push({ groupe: gi, image: m.debut });
      raisons.push(`groupe ${gi + 1} « ${court(txt)} » coupé net à l'image ${m.debut} (entrée de ${m.id})`);
    } else {
      caches.push(gi);
      raisons.push(`groupe ${gi + 1} « ${court(txt)} » (images ${on} à ${off - 1}) retiré, sous ${m.id}`);
    }
  });
  const P = { groupes, caches, coupes: coupesNet, images };
  const bib = bibliotheque();
  let html = lire(path.join(bib, 'sous-titres', 'devant', 'index.html'));
  const attendu = (ok, quoi) => { if (!ok) fail(9, `GABARIT_INATTENDU : le gabarit des sous-titres a changé (${quoi}). Préviens Yoan.`); };
  const reP = /const P = \{[\s\S]*?\n\};\n/;
  attendu(reP.test(html), 'paramètres P');
  html = html.replace(reP, () => `const P = ${JSON.stringify(P)};\n`);
  attendu(/data-duration="[\d.]+"/.test(html), 'data-duration');
  html = html.replace(/data-duration="[\d.]+"/, `data-duration="${(images / FPS).toFixed(4)}"`);
  attendu(html.includes('../../vendor/gsap.min.js'), 'chemin de GSAP');
  html = html.split('../../vendor/').join('vendor/');
  try { html = L.poserBlocSousTitres(html, { taille, position, pave }, ''); } catch (e) { fail(9, `GABARIT_INATTENDU : ${e.message}. Préviens Yoan.`); }
  const dossier = path.join(w, 'calques', 'st');
  calque(bib, html, dossier, ST);
  majCalques(w, { id: 'st', source: 'sous-titres', dossier: 'calques/st', debut: 0, images, couche: 'devant', ordre: 100,
    masques: masques.map((c) => ({ id: c.id, debut: c.debut, images: c.images })) });

  say(`PRÊT calque=${dossier} groupes=${groupes.length} mots=${liste.length} masqués=${masque.size} corrigés=${corrige.size} citations=${citations.length} repris=${retires.length} pave=${G.pave ? 'oui' : 'non'} taille=${taille} position=${G.position} police=${ST.police.family} ${px}px retirés=${caches.length} coupés=${coupesNet.length} images=${images}`);
  const parCalque = new Map();
  for (const [i, id] of retires) { if (!parCalque.has(id)) parCalque.set(id, []); parCalque.get(id).push(`${i} « ${affiche(texte[i])} »`); }
  for (const [id, l] of parCalque) say(`  mots affichés par ${id}, sortis des sous-titres : ${l.join(', ')}`);
  for (const r of raisons) say('  calque qui efface les sous-titres : ' + r);
  for (const a of avis) say('  à relire : ' + a);
}

const [cmd, arg] = process.argv.slice(2);
if (!arg && (cmd === 'texte' || cmd === 'preparer')) fail(1, `Usage : node sous-titres.mjs ${cmd} <dossier>`);
const dossier = arg ? path.resolve(arg) : '';
if (cmd === 'texte') cmdTexte(dossier);
else if (cmd === 'preparer') await cmdPreparer(dossier);
else fail(1, 'Usage : node sous-titres.mjs texte <dossier> | preparer <dossier>');
