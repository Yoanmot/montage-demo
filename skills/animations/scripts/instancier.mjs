#!/usr/bin/env node
// instancier.mjs : adapte un gabarit de la bibliothèque à une demande du plan et l'écrit en calque prêt à rendre dans
// <dossier -montage>/calques/<id>/ (index.html + polices + GSAP + images + calque.json).
//
// Usage : node instancier.mjs <dossier -montage> <params.json>
// params.json (une couche d'un gabarit ; un gabarit à deux couches = deux appels, ids <demande>-derriere / -devant) :
// {
//   "id": "a01-devant", "demande": "a01", "gabarit": "hook-mot-geant", "couche": "devant", "ordre": 20,
//   "debut": 0 | { "mot": "<ancre>", "avance_s": 0.3 },          image de la vidéo coupée où le calque commence
//   "images": 90 | { "jusqua": "<ancre>", "apres_s": 0.4 },        durée du calque en images
//   "P": { "fond": "flou" },                                        réglages prévus par le gabarit (objet P)
//   "recaler": [[1.04, "<ancre>"], ...],                            décale chaque groupe d'instants du gabarit : tout
//                                                                    instant >= 1.04 s (jusqu'au repère suivant) suit l'écart
//                                                                    entre 1.04 et l'entrée du mot (attaque - 0,04 s)
//   "T": { "t01": 0.5 | { "entree": "<ancre>" } | { "set": "<ancre>" } | { "pave": "<ancre>" } | { "fin": "<ancre>" } | { "image": 12 | "fin" }
//          | { "video": 507 } | { "coupe": "<ancre>", "plus_s": -0.067 } },   coupe = la coupe juste avant ce mot
//          (« plus_s » s'ajoute aussi à entree, set, fin, image : { "entree": "<ancre>", "plus_s": -0.633 })
//   "textes": { "#gros": "résultats", ".pav@2": "sur le long terme", "#st0": { "mots": "<ancre>", "casse": "basse" } },
//                                                                    { mots } = texte dit, orthographe de sous-titres.json
//   "masque_sous_titres": true | false,                             facultatif : force le marquage (sinon gestes.json)
//   "styles": { "#gros": { "font-size": "300px", "left": "90.2px" } },
//   "apparition": { "#gros": 240 },                                 h (px) quand la taille change : recalcule montée, flou, durées
//   "photos": { "a0": { "fichier": "/chemin/photo.jpg" } | { "a_fournir": "photo de ... (photo de Romain)" } },
//   "plan": null | { ... }                                          remplace l'effet sur le plan déduit du gabarit
// }
// Ancres : « w12 », « w12-w14 » ou citation de la voix (« douze semaines#2 »). Les instants sont en secondes depuis le
// début du calque ; « entree » = attaque du mot - 0,04 s (APPARITION.avance), « set » = image de l'attaque, « pave » = une
// image avant l'attaque (pavé orange d'une ligne de sous-titre, SOUS_TITRES_TEMPS.avancePave), « fin » = image de la fin
// du mot. Un instant de gabarit commenté « pavé sur le mot » doit être calé (pave ou recaler) : sinon le pavé garde
// l'instant de l'extrait du labo.
// Ligne de sous-titre du gabarit (#st, #st0…) entièrement vidée (sa_ligne « retirer ») : le calque n'est pas marqué
// masque_sous_titres, les sous-titres de la vidéo restent pendant le calque.
import fs from 'node:fs';
import path from 'node:path';
import { S, BIB, GESTES, FPS, AV, chargerMots, resoudre, coupeAvant, img, tImg, son, planFlou, decalageDemi, ecrireCalque, texteSousTitres, reglagesGabarit, dureeStyle } from './lib/style.mjs';

const [dossier, paramsF] = process.argv.slice(2);
if (!dossier || !paramsF) { console.log('Usage : node instancier.mjs <dossier -montage> <params.json>'); process.exit(3); }
const Q = JSON.parse(fs.readFileSync(paramsF, 'utf8'));
const erreurs = [], avert = [];
const E = (m) => erreurs.push(m), A = (m) => avert.push(m);
const G = GESTES[Q.gabarit];
if (!G) { console.log(`ERREUR gabarit inconnu : ${Q.gabarit}`); process.exit(2); }
if (G.instancier !== 'oui') { console.log(`ERREUR ${Q.gabarit} a ses instants écrits en dur : à recomposer avec lib/style.mjs (voir SKILL.md)`); process.exit(2); }
if (!G.couches.includes(Q.couche)) { console.log(`ERREUR couche ${Q.couche} absente de ${Q.gabarit} (couches : ${G.couches.join(', ')})`); process.exit(2); }
const mots = chargerMots(dossier);
const anc = (a) => resoudre(a, mots);

let html = fs.readFileSync(path.join(BIB, Q.gabarit, Q.couche, 'index.html'), 'utf8')
  .replaceAll('../../fonts/', 'fonts/').replaceAll('../../vendor/', 'vendor/').replaceAll('../../images/', 'images/');

// ------------------------------------------------------------------ fenêtre du calque
const debut = typeof Q.debut === 'number' ? Q.debut : img(anc(Q.debut.mot).debut_s - (Q.debut.avance_s || 0));
const t0 = debut / FPS;
let images;
if (typeof Q.images === 'number') images = Q.images;
else if (Q.images && Q.images.jusqua) images = img(anc(Q.images.jusqua).fin_s + (Q.images.apres_s || 0)) - debut;
else images = Math.round(+html.match(/data-duration="([\d.]+)"/)[1] * FPS);
if (images <= 0) E(`durée nulle ou négative (début ${debut}, ${images} images)`);
// Plan contre style (CONTRAT) : une durée que le style fixe ne se change pas, le style gagne.
const DS = dureeStyle(Q.gabarit);
if (DS && images > DS.images) { if (Q.images !== undefined) A(`STYLE_GAGNE durée demandée ${images} images, le style fixe ${DS.images} images (${DS.regle}) : ${DS.images} appliquées`); images = DS.images; }
const duree = images / FPS;

// ------------------------------------------------------------------ P
if (Q.P) {
  const m = html.match(/const P = \{([^\n]*)\};/);
  if (!m) E('ce gabarit n\'a pas d\'objet P');
  else {
    let corps = m[1];
    for (const [k, v] of Object.entries(Q.P)) {
      const re = new RegExp(`(\\b${k}:\\s*)('[^']*'|-?[\\d.]+|true|false)`);
      if (!re.test(corps)) { E(`réglage P.${k} inconnu dans ${Q.gabarit} (P : {${corps.split('//')[0].trim()}}) : le style gagne, retire-le et note-le (remarques-plan.md)`); continue; }
      const RG = reglagesGabarit(Q.gabarit)[k];
      if (RG && RG.valeurs && !RG.valeurs.includes(v)) { E(`réglage P.${k} = ${JSON.stringify(v)} hors style (valeurs : ${RG.valeurs.join(', ')}) : le style gagne, mets « ${RG.defaut} » et note-le`); continue; }
      corps = corps.replace(re, `$1${typeof v === 'string' ? `'${v}'` : v}`);
    }
    html = html.replace(m[0], `const P = {${corps}};`);
  }
}
const Pval = {};
{ const m = html.match(/const P = \{([^}]*)\}/); if (m) for (const x of m[1].matchAll(/(\w+):\s*('([^']*)'|-?[\d.]+|true|false)/g)) Pval[x[1]] = x[3] ?? JSON.parse(x[2]); }

// ------------------------------------------------------------------ T
const tBloc = html.match(/const T = \{\n([\s\S]*?)\n\};/);
const T = {}, commentaires = {};
if (tBloc) for (const l of tBloc[1].split('\n')) { const m = l.match(/^\s*(\w+):\s*([\d.]+),\s*(?:\/\/\s*(.*))?$/); if (m) { T[m[1]] = +m[2]; commentaires[m[1]] = m[3] || ''; } }
const motImage = {};   // image (vidéo coupée) du mot sur lequel chaque instant est calé : la vérification s'en sert
const valeur = (v, k) => {
  if (typeof v === 'number') return v;
  if (v.plus_s !== undefined && !v.coupe) { const { plus_s, ...r } = v; return valeur(r, k) + plus_s; }
  if (v.entree) { const a = anc(v.entree); motImage[k] = a.image; return a.debut_s - AV - t0; }
  if (v.set) { const a = anc(v.set); motImage[k] = a.image; return tImg(a.image - debut); }
  if (v.pave) { const a = anc(v.pave); motImage[k] = a.image; return tImg(a.image - Math.round(S.SOUS_TITRES_TEMPS.avancePave * FPS) - debut); }
  if (v.fin) return tImg(anc(v.fin).fin_image - debut);
  if (v.image !== undefined) return tImg(v.image === 'fin' ? images : v.image);
  if (v.video !== undefined) return tImg(v.video - debut);
  if (v.coupe) { const c = coupeAvant(dossier, anc(v.coupe), mots); if (c === null) throw new Error(`pas de coupe juste avant « ${v.coupe} »`); return c / FPS + (v.plus_s || 0) - t0; }
  throw new Error(`instant illisible : ${JSON.stringify(v)}`);
};
if (Q.recaler) {
  const rep = Q.recaler.map(([ancien, a]) => { const r = anc(a); return [ancien, r.debut_s - AV - t0, r.image]; }).sort((x, y) => x[0] - y[0]);
  const orig = { ...T };
  for (const k of Object.keys(T)) {
    let r = null; for (const x of rep) if (orig[k] >= x[0] - 0.1) r = x;   // 0,1 s : les bascules posées juste avant l'entrée suivent leur groupe
    if (r) { T[k] = orig[k] + (r[1] - r[0]); if (Math.abs(orig[k] - r[0]) <= 0.1) motImage[k] = r[2]; }
    // une bascule (visible / caché) du gabarit était posée 0,5 ms avant une image : on la repose sur l'image la plus proche
    if (r && /visible|caché/.test(commentaires[k])) T[k] = tImg(img(T[k] + 0.0005));
  }
  for (let i = 1; i < rep.length; i++) if (rep[i][1] - rep[i - 1][1] < 0.2) A(`recaler : repères ${i - 1} et ${i} à moins de 0,2 s d'écart, les gestes du gabarit risquent de se chevaucher`);
}
for (const [k, v] of Object.entries(Q.T || {})) {
  if (!(k in T)) { E(`T.${k} n'existe pas dans ${Q.gabarit}/${Q.couche} (clés : ${Object.keys(T).join(', ')})`); continue; }
  try { T[k] = valeur(v, k); } catch (e) { E(`T.${k} : ${e.message}`); }
}
if (DS && DS.instant && DS.instant in T && Math.abs(T[DS.instant] - tImg(DS.images)) > 0.001) {
  A(`STYLE_GAGNE T.${DS.instant} (${commentaires[DS.instant] || ''}) demandé à ${T[DS.instant].toFixed(3)} s, le style fixe l'image ${DS.images} : appliqué`);
  T[DS.instant] = tImg(DS.images);
}
for (const k of Object.keys(T)) {
  if (/^pavé sur le mot/.test(commentaires[k]) && !(Q.T && k in Q.T) && !Q.recaler) E(`T.${k} (${commentaires[k]}) : à caler sur le mot, { "pave": "<ancre>" }`);
}
for (const [k, v] of Object.entries(T)) {
  if (v < 0) E(`T.${k} = ${v.toFixed(3)} s : avant le début du calque (avancer « debut »)`);
  if (v >= duree) A(`T.${k} = ${v.toFixed(3)} s : après la fin du calque (${duree.toFixed(3)} s), le geste ne se verra pas`);
}
if (tBloc) html = html.replace(tBloc[0], `const T = {\n${Object.entries(T).map(([k, v]) => `  ${k}: ${Math.max(0, v).toFixed(4)},${commentaires[k] ? `   // ${commentaires[k]}` : ''}`).join('\n')}\n};`);

// ------------------------------------------------------------------ textes, styles, apparition, photos
const echappe = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
for (const [sel, valeurTexte] of Object.entries(Q.textes || {})) {
  // { "mots": "<ancre>", "casse": "basse" | "haute" | "telle" } : le texte dit, tel que les sous-titres l'écrivent
  // (corrections de sous-titres.json s'il existe, sinon words.cut.json). Obligatoire pour la ligne de sous-titre d'un
  // gabarit (tier-list, cta-mot-derriere, cta-champ-instagram) : la même orthographe que les sous-titres autour.
  let texte = valeurTexte;
  if (valeurTexte && typeof valeurTexte === 'object') {
    try { texte = texteSousTitres(dossier, valeurTexte.mots, mots, valeurTexte.casse); } catch (e) { E(`texte « ${sel} » : ${e.message}`); continue; }
  }
  let re, n = 1;
  // Un élément qui contient d'autres éléments (chiffre + unité : #h1 = #h1n + #h1u) ne se remplit pas d'un bloc : seul
  // son premier texte aurait changé (« 12 » sortait « 12g », test v1). On remplit ses morceaux un par un. La ligne de
  // sous-titre d'un gabarit (#st : « commente » + le mot) garde son mot à part, comme prévu.
  if (sel.startsWith('#') && !/^#st\d*$/.test(sel)) {
    const m = html.match(new RegExp(`<[a-z]+[^>]*\\bid="${sel.slice(1)}"[^>]*>[^<]*<(?!/)`));
    if (m) {
      const ligne = html.slice(m.index, (html.indexOf('\n', m.index) + 1 || html.length + 1) - 1);
      const fils = [...ligne.matchAll(/\bid="([^"]+)"/g)].slice(1, 5).map((x) => `#${x[1]}`);
      E(`texte : « ${sel} » contient d'autres éléments${fils.length ? ` (${fils.join(', ')}…)` : ''} : remplis-les un par un`);
      continue;
    }
  }
  if (sel.startsWith('#')) re = new RegExp(`(<[a-z]+[^>]*\\bid="${sel.slice(1)}"[^>]*>)([^<]*)(<)`, 'g');
  else { const [cl, k] = sel.slice(1).split('@'); n = +(k || 1); re = new RegExp(`(<[a-z]+[^>]*\\bclass="(?:[^"]*\\s)?${cl}(?:\\s[^"]*)?"[^>]*>)([^<]*)(<)`, 'g'); }
  let i = 0, ok = false;
  html = html.replace(re, (all, a, _b, c) => (++i === n ? (ok = true, a + echappe(texte) + c) : all));
  if (!ok) E(`texte : « ${sel} » introuvable (ou contient d'autres balises) dans ${Q.gabarit}/${Q.couche}`);
}
for (const [sel, props] of Object.entries(Q.styles || {})) {
  const re = new RegExp(`(<[a-z]+[^>]*\\bid="${sel.slice(1)}"[^>]*\\bstyle=")([^"]*)(")`);
  const m = html.match(re);
  if (!m) { E(`style : « ${sel} » introuvable ou sans attribut style`); continue; }
  const st = Object.fromEntries(m[2].split(';').filter((x) => x.trim()).map((x) => [x.split(':')[0].trim(), x.slice(x.indexOf(':') + 1).trim()]));
  Object.assign(st, props);
  html = html.replace(re, `$1${Object.entries(st).map(([k, v]) => `${k}:${v}`).join(';')}$3`);
}
for (const [sel, h] of Object.entries(Q.apparition || {})) {
  const R = S.apparitionReglages(h), q = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  html = html.replace(new RegExp(`(tl\\.fromTo\\('${q}', \\{ y: )[\\d.]+( \\}, \\{ y: 0, duration: )[\\d.]+`), `$1${R.dy.toFixed(1)}$2${R.dMontee.toFixed(3)}`)
    .replace(new RegExp(`(tl\\.fromTo\\('${q}', \\{ opacity: 0 \\}, \\{ opacity: 1, duration: )[\\d.]+`), `$1${R.dOpacite.toFixed(3)}`)
    .replace(new RegExp(`(tl\\.fromTo\\('${q}', \\{ filter: 'blur\\()[\\d.]+(px\\)' \\}, \\{ filter: 'blur\\(0px\\)', duration: )[\\d.]+`), `$1${R.flou.toFixed(1)}$2${R.dFlou.toFixed(3)}`);
  if (!html.includes(`tl.fromTo('${sel}', { y: ${R.dy.toFixed(1)} }`)) E(`apparition : pas d'apparition pour « ${sel} » dans ${Q.gabarit}/${Q.couche}`);
}
const photosStage = {};
for (const [idp, ph] of Object.entries(Q.photos || {})) {
  const re = new RegExp(`(\\bid="${idp}"[^>]*>\\s*<img )([^>]*)(>)`);
  const m = html.match(re);
  if (!m) { E(`photo : pas d'<img> dans « #${idp} »`); continue; }
  let attrs = m[2];
  if (ph.fichier) {
    if (!fs.existsSync(ph.fichier)) { E(`photo ${idp} : fichier introuvable ${ph.fichier}`); continue; }
    const nom = `${idp}${path.extname(ph.fichier).toLowerCase()}`; photosStage[nom] = ph.fichier;
    attrs = attrs.replace(/src="[^"]*"/, `src="images/${nom}"`).replace(/\s*data-a-fournir="[^"]*"/, '');
  } else if (ph.a_fournir) attrs = attrs.replace(/data-a-fournir="[^"]*"/, `data-a-fournir="${echappe(ph.a_fournir)}"`);
  html = html.replace(re, `$1${attrs}$3`);
}

// ------------------------------------------------------------------ durée
html = html.replace(/data-duration="[\d.]+"/, `data-duration="${duree}"`).replace(/tl\.set\(\{\}, \{\}, [\d.]+\);/, `tl.set({}, {}, ${duree});`);

// ------------------------------------------------------------------ effet sur le plan caméra
let plan = null, extra = {};
if ('plan' in Q) plan = Q.plan;
else if (G.plan === 'decalage_demi') {
  const sortie = Pval.sortie || 'bascule';
  const dec = decalageDemi(images, T.t01, T.t05, sortie, sortie === 'bascule' ? [T.bascule, T.bascule + S.DEMI.bascule.d] : null);
  extra['decalage.json'] = dec;
  plan = { decalage_y: `calques/${Q.id}/decalage.json` };
} else if (G.plan) {
  const ok = !G.plan.si || Object.entries(G.plan.si).every(([k, v]) => Pval[k] === v);
  if (ok) plan = G.plan.flou ? planFlou(G.plan.flou) : G.plan.detoure ? { detoure: true } : null;
}
if (plan && plan.detoure && Q.couche !== 'derriere') E('plan « detoure » : couche derriere obligatoire');

// ------------------------------------------------------------------ attendus (vérification) et sons suggérés
const attendus = [];
for (const [k, c] of Object.entries(commentaires)) {
  for (const part of c.split(',').map((x) => x.trim())) {
    const m = part.match(/^(\S+(?: \S+)?) (apparaît|visible)$/);
    if (m) attendus.push({ nom: m[1], cle: k, image: m[2] === 'apparaît' ? img(T[k] + AV) : img(T[k]), ...(k in motImage ? { mot_image: motImage[k] } : {}) });
  }
}
const sons = [];
for (const r of G.sons || []) {
  if (r.couche && r.couche !== Q.couche) continue;
  if (r.si && !Object.entries(r.si).every(([k, v]) => Pval[k] === v)) continue;
  if (r.element) {
    const q = r.element.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = html.match(new RegExp(`tl\\.fromTo\\('${q}', \\{ opacity: 0 \\}, \\{ opacity: 1, duration: ([\\d.]+)[^)]*\\}, T\\.(\\w+)\\)`));
    if (!m) { A(`son ${r.son} : apparition de ${r.element} introuvable, à poser à la main`); continue; }
    const mi = T[m[2]] + (1 - Math.SQRT1_2) * +m[1];
    sons.push(son(r.son, debut + img(mi), r.pourquoi));
  } else if (r.instant) sons.push(son(r.son, debut + img(T[r.instant]), r.pourquoi));
  else if (r.instants) r.instants.forEach((k, i) => { if (k in T) sons.push(son(r.son, debut + img(T[k]), r.pourquoi, i)); });
  else A(`son ${r.son} (${r.pourquoi}) : instants à reprendre à la main`);
}

if (erreurs.length) { for (const x of erreurs) console.log(`ERREUR ${x}`); for (const x of avert) console.log(`AVERTISSEMENT ${x}`); process.exit(2); }
// La couche du gabarit qui porte sa propre ligne de sous-titre (gestes.json), ou Q.masque_sous_titres pour forcer.
// Ligne de sous-titre du gabarit vidée en entier (sa_ligne « retirer ») : ce sont les sous-titres de la vidéo qui restent.
const lignesST = Object.entries(Q.textes || {}).filter(([sel]) => /^#st\d*$/.test(sel));
const ligneVidee = lignesST.length > 0 && lignesST.every(([, v]) => v === '') && (G.masque_sous_titres || []).includes(Q.couche);
const masqueST = Q.masque_sous_titres ?? (ligneVidee ? false : (G.masque_sous_titres || []).includes(Q.couche));
if (ligneVidee && Q.masque_sous_titres === undefined) console.log('NOTE ligne de sous-titre du gabarit vidée : les sous-titres de la vidéo restent pendant ce calque');
const { dossier: dc, fiche } = ecrireCalque(dossier, {
  id: Q.id, demande: Q.demande, debut, images, couche: Q.couche, ordre: Q.ordre, plan, sons_suggeres: sons, attendus,
  masque_sous_titres: masqueST,
  origine: { gabarit: Q.gabarit, couche_gabarit: Q.couche }, params: Q,
}, html, extra);
for (const [nom, src] of Object.entries(photosStage)) fs.copyFileSync(src, path.join(dc, 'images', nom));
for (const x of avert) console.log(`AVERTISSEMENT ${x}`);
console.log(`CALQUE ${Q.id} : ${Q.gabarit}/${Q.couche}, images ${debut} à ${debut + images - 1} (${images}), couche ${Q.couche}${plan ? `, plan ${JSON.stringify(plan)}` : ''}${masqueST ? ', efface les sous-titres pendant le calque (relancer sous-titres preparer)' : ''}`);
for (const a of fiche.attendus) console.log(`   ${a.nom} attendu à l'image ${a.image} du calque (${debut + a.image} de la vidéo)`);
for (const s of sons) console.log(`   son suggéré ${s.fichier} image ${s.image} (${s.pourquoi})`);
for (const p of fiche.a_fournir) console.log(`   PHOTO À FOURNIR : ${p}`);
