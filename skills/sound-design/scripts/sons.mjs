#!/usr/bin/env node
// sons.mjs : pose les sons d'une vidéo coupée et les vérifie (skill sound-design du monteur de Romain).
//
//   node sons.mjs proposer <dossier-montage> [--remplacer]   calques.json (sons_suggeres des animations) -> gestes.json (brouillon)
//   node sons.mjs poser    <dossier-montage>                 gestes.json -> sons.json (images exactes, niveaux), puis contrôle
//   node sons.mjs verifier <dossier-montage>                 contrôle de sons.json seul
// Options : --biblio <dossier de la bibliothèque du style> (défaut : ../animations/bibliotheque à côté de ce skill).
//
// Base de temps : la vidéo coupée, 30 images/s, image 0 = début (../animations/CONTRAT.md). Toutes les valeurs du style (sons, niveaux,
// apparition, frappe) viennent de commun.mjs de la bibliothèque ; ce script n'en met aucune en dur.
// Sorties : codes en tête de ligne pour l'agent (OK, ERREUR, AVERTISSEMENT, SONS_POSES, CONTROLE_OK, CONTROLE_KO).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.dirname(ICI);

// ------------------------------------------------------------------ arguments
const args = process.argv.slice(2);
const opt = (nom) => { const i = args.indexOf(nom); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const drapeau = (nom) => { const i = args.indexOf(nom); if (i < 0) return false; args.splice(i, 1); return true; };
const BIBLIO = path.resolve(opt('--biblio') || path.join(SKILL, '..', 'animations', 'bibliotheque'));
const REMPLACER = drapeau('--remplacer');
const [CMD, DOSSIER_ARG] = args;
if (!CMD || !DOSSIER_ARG || !['proposer', 'poser', 'verifier'].includes(CMD)) {
  console.log('Usage : node sons.mjs proposer|poser|verifier <dossier-montage> [--biblio <dossier>] [--remplacer]');
  process.exit(1);
}
const DOSSIER = path.resolve(DOSSIER_ARG);
const SONS_DIR = path.join(BIBLIO, 'sons');
if (!fs.existsSync(path.join(BIBLIO, 'commun.mjs'))) {
  console.log(`ERREUR BIBLIOTHEQUE_INTROUVABLE ${BIBLIO} : le skill animations (et sa bibliothèque) doit être installé à côté de ce skill.`);
  process.exit(1);
}
const C = await import(pathToFileURL(path.join(BIBLIO, 'commun.mjs')).href);
// attaque d'un mot : la fonction commune des animations (attaqueMot de animations/scripts/lib/style.mjs)
const { attaqueMot } = await import(pathToFileURL(path.join(path.dirname(BIBLIO), 'scripts', 'lib', 'style.mjs')).href);
const FPS = C.VIDEO.fps;

// ------------------------------------------------------------------ table des gestes sonorisés (depuis commun.mjs)
// Chaque geste : fichier(s) de la bibliothèque, mesure du niveau, cible. Les gestes interdits ne passent jamais.
const ENTREE = C.SONS.entree;
const FICHES_FRAPPES = lireJson(path.join(SONS_DIR, `${C.SONS.frappe.dossier}.json`), {});
const TOUCHES = Object.keys(FICHES_FRAPPES).sort();   // t1..t4
const GESTES = {
  faisceau: { fichier: C.SONS.faisceau.fichier, niveau: { lu_sous_voix: C.SONS.faisceau.ecartLU },
    regle: "image où la bande couvre l'écran (la coupe)" },
  arrivee: { fichier: C.SONS.arrivee.fichier, niveau: { lu_sous_voix: C.SONS.arrivee.ecartLU },
    regle: "image où l'élément passe 50 % d'opacité (apparitionMiOpacite)" },
  photo: { fichier: C.SONS.clic.fichier, niveau: { rms_db_sous_voix: C.SONS.clic.ecartRmsDb },
    regle: 'image où la photo se pose' },
  frappe: { fichiers: TOUCHES.map((t) => `${C.SONS.frappe.dossier}/${t}.wav`), niveau: { rms_db_sous_voix: C.SONS.frappe.ecartRmsDb },
    variation: C.SONS.frappe.variationDb, regle: 'une par lettre, touches tournantes sans répétition' },
  entree: { fichier: ENTREE.fichier, niveau: { rms_db_sous_voix: ENTREE.ecartRmsDb }, regle: "image de la touche Entrée" },
  transition: { fichier: C.SONS.transition.fichier, niveau: { rms_db_sous_voix: C.SONS.transition.ecartRmsDb },
    regle: "image de la coupe que le flash couvre (100 %), ou entrée / sortie d'un plein écran" },
  meme: { fichier: C.SONS.meme.fichier, niveau: { lu_sous_voix: C.SONS.meme.ecartLU },
    regle: "image où l'image de réaction apparaît (le pop)" },
  // retenus par Yoan sur le test v17 (2026-11-14)
  ecran: { fichier: C.SONS.ecran.fichier, niveau: { rms_db_sous_voix: C.SONS.ecran.ecartRmsDb }, serie: true,
    regle: "captures d'écran qui défilent : une image par changement d'écran (pas celle du flash d'entrée, qui a son clic)" },
  pose: { fichier: C.SONS.pose.fichier, niveau: { rms_db_sous_voix: C.SONS.pose.ecartRmsDb },
    regle: "image où l'objet est posé (fin de son mouvement), une par objet" },
  coche: { fichiers: C.SONS.coche.fichiers, niveau: { rms_db_sous_voix: C.SONS.coche.ecartRmsDb }, serie: true,
    regle: 'image où chaque case se remplit, dans l\'ordre : de plus en plus aigu' },
  montee: { fichier: C.SONS.montee.fichier, niveau: { rms_db_sous_voix: C.SONS.montee.ecartRmsDb },
    regle: "« fin » = l'image du son d'entrée du moment fort principal (un seul par vidéo) : la montée s'arrête net dessus" },
  sur_mesure: { regle: 'son généré pour la vidéo (generer.py), niveau choisi par le monteur' },
};
// Jamais de son sur un zoom ni sur les sous-titres. Le flash a son clic depuis le 2026-11-13 (geste « transition »).
const INTERDITS = ['zoom', 'zooms', 'sous-titres', 'sous_titres', 'soustitres'];
const LU_MAX = 12;               // STYLE.md : jamais plus de 12 LU sous la voix (inaudible au téléphone)
const ECART_MIN_IMAGES = 3;      // deux gestes distincts : attaques à 3 images (0,1 s) au moins
const GROUPE_FRAPPE_S = 0.25;    // deux frappes à moins de 0,25 s appartiennent à la même saisie

// ------------------------------------------------------------------ utilitaires
function lireJson(p, defaut) {
  if (!fs.existsSync(p)) { if (defaut !== undefined) return defaut; throw new Error(`fichier introuvable : ${p}`); }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
const ecrireJson = (p, o) => fs.writeFileSync(p, JSON.stringify(o, null, 1) + '\n');
const img = (t) => Math.round(t * FPS);

function durees(p) {   // durée (s) d'un wav PCM, lue dans l'en-tête RIFF
  const b = fs.readFileSync(p); let i = 12, debit = 0;
  while (i + 8 <= b.length) {
    const id = b.toString('ascii', i, i + 4), n = b.readUInt32LE(i + 4);
    if (id === 'fmt ') debit = b.readUInt32LE(i + 16);
    if (id === 'data') return debit ? Math.min(n, b.length - i - 8) / debit : null;
    i += 8 + n + (n % 2);
  }
  return null;
}

function resoudre(fichier) {   // relatif à la bibliothèque des sons, ou absolu (son généré pour la vidéo)
  return path.isAbsolute(fichier) ? fichier : path.join(SONS_DIR, fichier);
}

function fiche(fichier) {   // fiche du son : debut_echantillon (attaque) et durée
  const p = resoudre(fichier);
  const m = /^(.*\/)?(t\d+)\.wav$/.exec(fichier);
  if (!path.isAbsolute(fichier) && fichier.startsWith(`${C.SONS.frappe.dossier}/`) && m) return FICHES_FRAPPES[m[2]] || null;
  const j = p.replace(/\.wav$/i, '.json');
  return fs.existsSync(j) ? lireJson(j) : null;
}

function mots() {
  const p = path.join(DOSSIER, 'words.cut.json');
  if (!fs.existsSync(p)) return null;
  const w = lireJson(p); return Array.isArray(w) ? w : w.words;
}

function dureeImages() {   // longueur de la vidéo coupée, en images
  const edl = lireJson(path.join(DOSSIER, 'edl.json'), null);
  if (edl && edl.stats && edl.stats.out_frames) return edl.stats.out_frames;
  const w = mots(); return w && w.length ? Math.ceil(w[w.length - 1].end * FPS) + FPS : null;
}

function joints() {   // images des coupes de la vidéo coupée (edl.json)
  const edl = lireJson(path.join(DOSSIER, 'edl.json'), null);
  return edl ? new Set(edl.segments.map((s) => s.outInF)) : new Set();
}

function calques() { return lireJson(path.join(DOSSIER, 'calques.json'), { calques: [] }).calques || []; }

// Hasard reproductible (même vidéo, mêmes touches) : mulberry32.
function hasard(graine) {
  let a = graine >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ------------------------------------------------------------------ proposer : calques.json -> gestes.json
// Les calques d'animation portent des sons_suggeres au format des entrées de sons.json (brique animations :
// { fichier, image (image ABSOLUE de la vidéo coupée), niveau, pourquoi }). On en tire des gestes : le geste se déduit du
// fichier ; les lettres d'une frappe d'un même calque deviennent un seul geste frappe (touches et variation tirées ici).
// Une suggestion qui porte déjà « geste » est reprise telle quelle.
function gesteDuFichier(f) {
  if (!f) return null;
  if (path.isAbsolute(f)) return 'sur_mesure';
  if (f.startsWith(`${C.SONS.frappe.dossier}/`)) return 'frappe';
  for (const [g, T] of Object.entries(GESTES)) if (T.fichier === f) return g;
  return null;
}

function proposer() {
  const sortie = path.join(DOSSIER, 'gestes.json');
  const gestes = [];
  for (const c of calques()) {
    let frappe = null;
    for (const s of c.sons_suggeres || []) {
      const geste = s.geste || gesteDuFichier(s.fichier);
      if (!geste) { console.log(`AVERTISSEMENT ${c.id} : son suggéré inconnu (${s.fichier}), ignoré`); continue; }
      if (geste === 'frappe' && Number.isInteger(s.image)) {
        if (!frappe) { frappe = { geste, images: [], calque: c.id, pourquoi: s.pourquoi }; gestes.push(frappe); }
        frappe.images.push(s.image); continue;
      }
      const g = { ...s, geste, calque: c.id };
      if (geste !== 'sur_mesure') { delete g.fichier; delete g.niveau; }   // fichier et niveau : la table du style décide
      gestes.push(g);
    }
  }
  console.log(`${gestes.length} geste(s) suggéré(s) par les calques :`);
  for (const g of gestes) console.log(`  ${g.geste.padEnd(10)} ${g.calque.padEnd(18)} ${g.image ?? (g.images ? `${g.images.length} images dès ${g.images[0]}` : `départ ${g.depart}s`)}  ${g.pourquoi || ''}`);
  if (fs.existsSync(sortie) && !REMPLACER) {
    console.log(`AVERTISSEMENT gestes.json existe déjà : rien écrit (relance avec --remplacer pour l'écraser).`);
    return;
  }
  ecrireJson(sortie, { gestes });
  console.log(`OK ${sortie} : relis, retire ce qui ne se sonorise pas, ajoute les gestes sur mesure, puis lance « poser ».`);
}

// ------------------------------------------------------------------ poser : gestes.json -> sons.json
function imageArrivee(g, W) {
  if (Number.isInteger(g.image)) return g.image;
  let depart = g.depart;
  if (depart === undefined && Number.isInteger(g.mot)) {
    if (!W || !W[g.mot]) throw new Error(`arrivee : mot ${g.mot} introuvable dans words.cut.json`);
    depart = attaqueMot(W, g.mot) - C.APPARITION.avance;   // l'élément démarre à l'attaque de son mot (0,1 s avant la transcription)
  }
  if (typeof depart !== 'number' || typeof g.h !== 'number') throw new Error('arrivee : il faut image, ou (depart ou mot) et h');
  return img(C.apparitionMiOpacite(Math.max(0, depart), g.h));
}

function imagesFrappe(g, W) {
  if (Array.isArray(g.images)) return g.images;
  if (typeof g.mot_seul === 'string') {   // mot seul : 1/18 s par lettre (FRAPPE), première lettre au départ
    let depart = g.depart;
    if (depart === undefined && Number.isInteger(g.mot)) depart = W[g.mot].start;
    if (typeof depart !== 'number') throw new Error('frappe : mot_seul demande depart (s) ou mot (numéro)');
    const lettres = [...g.mot_seul.replace(/\s/g, '')];
    return lettres.map((_, k) => img(depart + k / C.FRAPPE.lettresParSeconde));
  }
  throw new Error("frappe : il faut images (une par lettre, venues du calque) ou mot_seul. Pour une phrase, les instants viennent du calque.");
}

function poser() {
  const G = lireJson(path.join(DOSSIER, 'gestes.json')).gestes || [];
  const W = mots();
  const sons = [];
  for (const g of G) {
    const nom = String(g.geste || '').toLowerCase();
    if (INTERDITS.includes(nom)) { console.log(`ERREUR GESTE_INTERDIT ${nom} (${g.calque || ''}) : jamais de son sur un zoom ni sur les sous-titres.`); process.exit(1); }
    const T = GESTES[nom];
    if (!T) { console.log(`ERREUR GESTE_INCONNU « ${g.geste} » : ${Object.keys(GESTES).join(', ')}`); process.exit(1); }
    const base = { geste: nom, ...(g.calque ? { calque: g.calque } : {}) };
    const pourquoi = g.pourquoi || `${nom}${g.calque ? ' ' + g.calque : ''}`;
    if (nom === 'frappe') {
      const ims = imagesFrappe(g, W);
      const rnd = hasard(ims[0] * 7919 + ims.length);
      let prec = null;
      ims.forEach((k, i) => {
        const choix = T.fichiers.filter((f) => f !== prec); const f = choix[Math.floor(rnd() * choix.length)]; prec = f;
        const v = (rnd() * 2 - 1) * T.variation;
        sons.push({ fichier: f, image: k, niveau: { rms_db_sous_voix: +(T.niveau.rms_db_sous_voix - v).toFixed(1) },
          pourquoi: `${pourquoi} (lettre ${i + 1}/${ims.length})`, ...base });
      });
    } else if (nom === 'photo') {
      const ims = Array.isArray(g.images) ? g.images : [g.image];
      ims.forEach((k, i) => sons.push({ fichier: T.fichier, image: k, niveau: { ...T.niveau },
        pourquoi: ims.length > 1 ? `${pourquoi} (photo ${i + 1}/${ims.length})` : pourquoi, ...base }));
    } else if (nom === 'ecran' || nom === 'pose' || nom === 'coche') {
      const ims = Array.isArray(g.images) ? g.images : [g.image];
      if (!ims.length || ims.some((k) => !Number.isInteger(k))) { console.log(`ERREUR IMAGE_MANQUANTE ${nom} : images entières attendues (${T.regle}).`); process.exit(1); }
      const serie = `${nom}:${g.calque || ''}:${ims[0]}`;
      ims.forEach((k, i) => sons.push({ fichier: T.fichiers ? T.fichiers[Math.min(i, T.fichiers.length - 1)] : T.fichier, image: k,
        niveau: { ...T.niveau }, pourquoi: ims.length > 1 ? `${pourquoi} (${i + 1}/${ims.length})` : pourquoi,
        ...(T.serie && ims.length > 1 ? { serie } : {}), ...base }));
    } else if (nom === 'montee') {
      if (!Number.isInteger(g.fin)) { console.log(`ERREUR IMAGE_MANQUANTE montee : « fin » = image du son d'entrée du moment fort (${T.regle}).`); process.exit(1); }
      const F = fiche(T.fichier), d = durees(resoudre(T.fichier)) || 0, a = F.debut_echantillon / 48000;
      // attaque à l'image k : le son finit à k - a*30 + d*30, au plus tard sur « fin » (finAvantImages d'avance au plus)
      const k = Math.floor(g.fin + (a - d) * FPS - 0.03);
      sons.push({ fichier: T.fichier, image: k, fin: g.fin, niveau: { ...T.niveau }, pourquoi, ...base });
    } else if (nom === 'arrivee') {
      sons.push({ fichier: T.fichier, image: imageArrivee(g, W), niveau: { ...T.niveau }, pourquoi, ...base });
    } else if (nom === 'sur_mesure') {
      if (!g.fichier || !path.isAbsolute(g.fichier)) { console.log('ERREUR SUR_MESURE_SANS_FICHIER : chemin absolu du son généré requis.'); process.exit(1); }
      if (!g.niveau) { console.log('ERREUR SUR_MESURE_SANS_NIVEAU : niveau { lu_sous_voix } ou { rms_db_sous_voix } requis.'); process.exit(1); }
      const k = Number.isInteger(g.image) ? g.image : (typeof g.depart === 'number' && typeof g.h === 'number') ? imageArrivee(g, W) : null;
      if (k === null) { console.log('ERREUR SUR_MESURE_SANS_IMAGE'); process.exit(1); }
      sons.push({ fichier: g.fichier, image: k, niveau: g.niveau, pourquoi, ...base });
    } else {
      if (!Number.isInteger(g.image)) { console.log(`ERREUR IMAGE_MANQUANTE ${nom} : image entière attendue (${T.regle}).`); process.exit(1); }
      sons.push({ fichier: T.fichier, image: g.image, niveau: { ...T.niveau }, pourquoi, ...base });
    }
  }
  sons.sort((a, b) => a.image - b.image);
  const sortie = path.join(DOSSIER, 'sons.json');
  ecrireJson(sortie, { sons, musique: null });
  console.log(`SONS_POSES ${sons.length} son(s) -> ${sortie}`);
  return verifier();
}

// ------------------------------------------------------------------ verifier : contrôle de sons.json
function verifier() {
  const S = lireJson(path.join(DOSSIER, 'sons.json'));
  const err = [], av = [];
  const N = dureeImages(), J = joints(), CQ = calques();
  const parId = Object.fromEntries(CQ.map((c) => [c.id, c]));
  if (!('musique' in S)) err.push('le champ musique manque (null tant qu’elle n’est pas choisie)');
  else if (S.musique !== null) av.push('musique non nulle : la musique de fond n’est pas encore choisie (STYLE.md)');
  const poses = [];
  for (const [i, s] of (S.sons || []).entries()) {
    const id = `#${i} ${s.fichier} @${s.image}`;
    const geste = String(s.geste || '').toLowerCase();
    // gestes interdits
    if (INTERDITS.includes(geste)) err.push(`${id} : son sur un geste interdit (${geste})`);
    const cq = s.calque ? parId[s.calque] : null;
    if (s.calque && !cq) av.push(`${id} : calque ${s.calque} absent de calques.json`);
    if (cq && cq.source === 'sous-titres') err.push(`${id} : son sur les sous-titres (calque ${cq.id})`);
    if (cq && /zoom/i.test(`${cq.id} ${cq.dossier || ''}`)) err.push(`${id} : son sur un zoom (calque ${cq.id})`);
    // sous-titres enrichis : jamais d'impact ni d'autre son (Yoan, 2026-11-14 : « pas top », « nul »)
    if (cq && cq.dossier) {
      const fc = lireJson(path.join(DOSSIER, cq.dossier, 'calque.json'), null);
      if (fc && fc.origine && /^sous-titre enrichi/.test(String(fc.origine.sur_mesure || ''))) err.push(`${id} : son sur un sous-titre enrichi (calque ${cq.id}) : refusé`);
    }
    // image
    if (!Number.isInteger(s.image) || s.image < 0) err.push(`${id} : image entière positive attendue`);
    else if (N && s.image >= N) err.push(`${id} : image après la fin de la vidéo coupée (${N} images)`);
    // fichier et fiche
    const p = resoudre(s.fichier || '');
    if (!s.fichier || !fs.existsSync(p)) { err.push(`${id} : fichier introuvable (${p})`); continue; }
    const F = fiche(s.fichier);
    if (!F || !Number.isInteger(F.debut_echantillon)) err.push(`${id} : fiche .json du son sans debut_echantillon (le rendu en a besoin pour caler l'attaque)`);
    // niveau
    const n = s.niveau || {}, cles = Object.keys(n);
    if (cles.length !== 1 || !['lu_sous_voix', 'rms_db_sous_voix'].includes(cles[0]) || typeof n[cles[0]] !== 'number') {
      err.push(`${id} : niveau = { lu_sous_voix } ou { rms_db_sous_voix }, un seul`);
    } else {
      const v = n[cles[0]];
      if (v <= 0) err.push(`${id} : un son reste sous la voix (valeur positive attendue)`);
      if (cles[0] === 'lu_sous_voix' && v > LU_MAX) err.push(`${id} : ${v} LU sous la voix, inaudible au téléphone (max ${LU_MAX})`);
      const T = GESTES[geste];
      if (T && T.niveau && geste !== 'sur_mesure') {
        const cible = T.niveau[cles[0]], tol = (T.variation || 0) + 0.05;
        if (cible === undefined || Math.abs(v - cible) > tol) err.push(`${id} : niveau ${cles[0]} ${v} au lieu de ${Object.entries(T.niveau)[0].join(' ')} (STYLE.md)`);
      }
      if (geste === 'faisceau' && Number.isInteger(s.image) && !J.has(s.image)
          && !CQ.some((c) => s.image === c.debut || s.image === c.debut + c.images)) {
        av.push(`${id} : faisceau hors d'une coupe et hors du bord d'un calque, vérifier que la bande couvre l'écran à cette image`);
      }
    }
    const d = durees(p) || 0.1, a = F && Number.isInteger(F.debut_echantillon) ? F.debut_echantillon / 48000 : 0;
    poses.push({ id, geste, image: s.image, t0: s.image / FPS - a, t1: s.image / FPS - a + d, serie: s.serie, fin: s.fin });
  }
  // sons qui se marchent dessus
  poses.sort((x, y) => x.t0 - y.t0);
  for (let i = 1; i < poses.length; i++) {
    const A = poses[i - 1], B = poses[i];
    const memeSaisie = (A.geste === 'frappe' && B.geste === 'frappe' && B.t0 - A.t0 < GROUPE_FRAPPE_S)
      || (A.serie && A.serie === B.serie && B.t0 - A.t0 < C.SONS.serieMaxS + 1e-6);   // série d'écrans ou de cases : un seul geste
    if (memeSaisie) { if (A.image === B.image) av.push(`${B.id} : deux lettres sur la même image`); continue; }
    if (B.image - A.image < ECART_MIN_IMAGES) err.push(`${A.id} et ${B.id} : moins de ${ECART_MIN_IMAGES} images entre deux gestes, on n'en entend qu'un`);
    else if (B.t0 < A.t1 - 0.0005) err.push(`${A.id} et ${B.id} : les deux sons se chevauchent`);
  }
  // montée (moment fort principal) : une seule par vidéo, elle finit net sur un son d'entrée (transition, arrivée, pose)
  const montees = poses.filter((P) => P.geste === 'montee');
  if (montees.length > 1) err.push(`${montees.length} montées : une seule, sur le moment fort principal de la vidéo`);
  for (const M of montees) {
    const cible = poses.find((P) => P !== M && Number.isInteger(M.fin) && P.image === M.fin);
    if (!cible) err.push(`${M.id} : la montée doit finir sur le son d'entrée du moment fort (aucun son à l'image ${M.fin})`);
    else if (!['transition', 'arrivee', 'pose', 'meme', 'faisceau'].includes(cible.geste)) err.push(`${M.id} : finit sur un ${cible.geste}, attendu le son d'entrée du moment fort (transition, arrivée)`);
    else if (M.t1 > cible.image / FPS + 0.002 || cible.image / FPS - M.t1 > C.SONS.montee.finAvantImages / FPS) err.push(`${M.id} : finit à ${(M.t1 * FPS).toFixed(2)}, pas net sur l'image ${cible.image}`);
  }
  // son de conclusion (refusé par Yoan, 2026-11-14) : rien dans la dernière seconde qui ne soit une transition
  for (const P of poses) if (N && P.image > N - FPS && !['transition', 'faisceau'].includes(P.geste)) err.push(`${P.id} : son dans la dernière seconde de la vidéo (pas de son de conclusion)`);
  // sons tombés sur le début d'un zoom (avertissement : le son peut appartenir à un autre geste au même instant)
  const Z = lireJson(path.join(DOSSIER, 'zooms.json'), null);
  const imagesZoom = new Set();
  const W = mots();   // zooms.json de la brique zooms : { zooms: [ { type, mot } ] }, le zoom part sur l'attaque de son mot
  for (const z of (Z && Z.zooms) || []) {
    if (Number.isInteger(z.mot) && W && W[z.mot]) imagesZoom.add(img(W[z.mot].start));
    else if (Number.isInteger(z.debut)) imagesZoom.add(z.debut);
  }
  for (const P of poses) {
    if ([...imagesZoom].some((k) => Math.abs(k - P.image) <= 1) && !['faisceau', 'transition'].includes(P.geste)) av.push(`${P.id} : tombe sur le début d'un zoom ; le son doit venir d'un autre geste, jamais du zoom`);
  }
  for (const a of av) console.log(`AVERTISSEMENT ${a}`);
  for (const e of err) console.log(`ERREUR ${e}`);
  if (err.length) { console.log(`CONTROLE_KO ${err.length} erreur(s)`); process.exit(1); }
  console.log(`CONTROLE_OK ${poses.length} son(s), ${av.length} avertissement(s)`);
}

try {
  if (CMD === 'proposer') proposer(); else if (CMD === 'poser') poser(); else verifier();
} catch (e) { console.log(`ERREUR ${e.message}`); process.exit(1); }
