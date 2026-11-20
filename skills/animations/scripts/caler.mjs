#!/usr/bin/env node
// caler.mjs : lit les demandes d'animation du plan de montage, vérifie qu'elles sont exécutables telles quelles et cale
// chaque ancre sur la voix (words.cut.json). N'invente rien et ne choisit rien : une demande floue ou impossible est
// REFUSÉE avec sa raison, pour que le monteur, qui a écrit le plan, le corrige.
//
// Usage : node caler.mjs <dossier -montage> [plan.json]
//   plan.json : par défaut <dossier>/plan-montage.json ; on lit sa clé « animations » (ou un tableau à la racine).
// Sortie : <dossier>/animations/plan-resolu.json (chaque demande avec ses ancres en secondes et en images).
// Plan contre style (CONTRAT) : un réglage que le gabarit ne prévoit pas, une valeur hors style ou une durée que le style
// fixe autrement ne bloquent pas : le STYLE GAGNE. Chaque cas sort en AVERTISSEMENT STYLE_GAGNE, est noté dans la demande
// résolue (« style_gagne », « reglages » = ce qui sera appliqué, « duree_style ») et dans <dossier>/remarques-plan.md
// (section « Animations », réécrite à chaque passage), trace pour le monteur et pour Yoan.
// Codes : 0 exécutable (avertissements possibles) · 2 refusé (liste COMPLÈTE des refus) · 3 fichier illisible.
import fs from 'node:fs';
import path from 'node:path';
import { chargerMots, resoudre, GESTES, BIB, normaliser, coupeAvant, reglagesGabarit, dureeStyle, FPS } from './lib/style.mjs';
import { controler as controlerAccroche } from './lib/accroche.mjs';

const [dossier, planArg] = process.argv.slice(2);
if (!dossier) { console.log('Usage : node caler.mjs <dossier -montage> [plan.json]'); process.exit(3); }
const planF = planArg || path.join(dossier, 'plan-montage.json');
let plan, mots;
try { plan = JSON.parse(fs.readFileSync(planF, 'utf8')); mots = chargerMots(dossier); }
catch (e) { console.log(`ILLISIBLE : ${e.message}`); process.exit(3); }
const demandes = Array.isArray(plan) ? plan : plan.animations;
if (!Array.isArray(demandes)) { console.log('ILLISIBLE : pas de liste « animations » dans le plan'); process.exit(3); }

const refus = [], avert = [], ids = new Set(), sortie = [];
const R = (id, code, msg) => refus.push(`${id} ${code} : ${msg}`);
const A = (id, code, msg) => avert.push(`${id} ${code} : ${msg}`);
const remarques = [];   // plan contre style : ce que le monteur applique à la place (trace dans remarques-plan.md)
const secondes = (n) => (n / FPS).toFixed(1).replace('.', ',');

// nombres dits en toutes lettres -> chiffres (pour vérifier qu'un chiffre affiché est bien dit par Romain)
const UNITES = { zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11,
  douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16, 'dix-sept': 17, 'dix-huit': 18, 'dix-neuf': 19, vingt: 20,
  trente: 30, quarante: 40, cinquante: 50, soixante: 60, cent: 100, mille: 1000 };
function nombresDits(texte) {
  const out = new Set(), t = normaliser(texte).split(/\s+/);
  for (const w of t) { if (/^\d+([.,]\d+)?$/.test(w.replace(/\s/g, ''))) out.add(w.replace(',', '.')); if (w in UNITES) out.add(String(UNITES[w])); }
  // composés simples : « vingt-cinq », « deux mille »
  for (let i = 0; i < t.length; i++) {
    const p = t[i].split('-'); if (p.length > 1 && p.every((x) => x in UNITES || x === 'et')) out.add(String(p.reduce((s, x) => s + (UNITES[x] || 0), 0)));
    if (t[i] in UNITES && (t[i + 1] === 'mille' || t[i + 1] === 'cent')) out.add(String(UNITES[t[i]] * UNITES[t[i + 1]]));
  }
  return out;
}

for (const [k, d] of demandes.entries()) {
  const id = d.id || `#${k + 1}`;
  if (!d.id) R(id, 'ID_MANQUANT', 'chaque demande a un id court et unique (a01, a02…)');
  else if (!/^a\d{2,3}$/.test(d.id)) R(id, 'ID_FORME', 'id attendu de la forme a01, a02… (les calques prennent ce préfixe)');
  if (ids.has(d.id)) R(id, 'ID_DOUBLE', 'deux demandes ont le même id'); ids.add(d.id);
  const geste = d.geste;
  if (!geste) R(id, 'GESTE_MANQUANT', 'le plan doit dire quel geste (dossier de la bibliothèque, ou « sur-mesure »)');
  else if (geste === 'sur-mesure') {
    if (!d.intention || d.intention.trim().length < 20) R(id, 'INTENTION_FLOUE', 'un effet sur mesure exige une intention précise : ce qu\'on doit comprendre, le geste, sur quoi');
  } else if (!GESTES[geste] || !fs.existsSync(path.join(BIB, geste))) {
    R(id, 'GESTE_INCONNU', `« ${geste} » n'est pas dans la bibliothèque ; gestes connus : ${Object.keys(GESTES).filter((g) => !g.startsWith('_')).join(', ')}, ou « sur-mesure »`);
  } else if (GESTES[geste].instancier === 'recomposer') A(id, 'A_RECOMPOSER', `« ${geste} » a ses instants écrits en dur : il se recompose avec la boîte à outils (voir SKILL.md)`);
  if (['sous-titres', 'zooms'].includes(geste)) R(id, 'PAS_ICI', `« ${geste} » est fait par sa propre brique, pas par les animations`);

  const r = { id: d.id, geste, intention: d.intention || null, reglages: d.reglages || {}, photos: d.photos || [], notes: d.notes || null };
  // Accroche composée (2026-11-20) : la composition du plan (type, effet, pourquoi, disposition de chaque élément) est
  // contrôlée ici, recopiée dans plan-resolu.json, puis composée par accroche.mjs.
  if (geste === 'accroche') {
    const c = controlerAccroche(d);
    for (const [code, msg] of c.refus) R(id, code, msg);
    for (const msg of c.avis) A(id, 'ACCROCHE', msg);
    r.composition = d.composition || null;
  } else if (GESTES[geste] && GESTES[geste].instancier === 'composer') {
    // gestes composés par leur script (plein-ecran-visage, partout, plan-a-filmer) : la composition passe telle quelle,
    // le script la contrôle
    r.composition = d.composition || {};
  }
  const anc = (a, quoi) => { try { return resoudre(a, mots); } catch (e) { R(id, e.message.split(' ')[0], `${quoi} : ${e.message}`); return null; } };
  if (!d.de) R(id, 'PASSAGE_MANQUANT', 'le plan doit dire sur quels mots (champ « de », et « a » pour la fin)');
  r.de = d.de ? anc(d.de, 'de') : null;
  r.a = d.a ? anc(d.a, 'a') : r.de;
  if (r.de && r.a && r.a.premier < r.de.premier) R(id, 'PASSAGE_INVERSE', '« a » est dit avant « de »');
  // Plan contre style : le style gagne, on applique sa valeur et on le dit.
  r.style_gagne = [];
  if (geste && geste !== 'sur-mesure' && GESTES[geste] && GESTES[geste].instancier !== 'composer') {
    const SG = (msg) => { r.style_gagne.push(msg); A(id, 'STYLE_GAGNE', msg); remarques.push(`- ${id} (${geste}) : ${msg}`); };
    const RG = reglagesGabarit(geste), appliques = {};
    for (const [k, v] of Object.entries(d.reglages || {})) {
      if (!(k in RG)) { SG(`réglage « ${k}: ${JSON.stringify(v)} » demandé, mais ce geste ne le prévoit pas dans le style (réglages possibles : ${Object.keys(RG).join(', ') || 'aucun'}) : ignoré`); continue; }
      if (RG[k].valeurs && !RG[k].valeurs.includes(v)) { SG(`réglage « ${k}: ${JSON.stringify(v)} » hors style (valeurs possibles : ${RG[k].valeurs.join(', ')}) : « ${RG[k].defaut} » appliqué`); appliques[k] = RG[k].defaut; continue; }
      appliques[k] = v;
    }
    r.reglages_plan = d.reglages || {};
    r.reglages = appliques;
    const DS = dureeStyle(geste);
    if (DS) {
      r.duree_style = DS.images;
      if (r.de && r.a) {
        const n = r.a.fin_image - r.de.image;
        if (n > DS.images + 2) SG(`le plan le fait durer ${secondes(n)} s (de « ${r.de.texte} » à « ${r.a.texte} »), le style fixe ${secondes(DS.images)} s (${DS.regle}) : ${secondes(DS.images)} s appliquées à partir de « ${r.de.texte} »`);
      }
    }
  }
  const passage = r.de && r.a ? mots.slice(r.de.premier, r.a.dernier + 1).map((w) => w.text).join(' ') : '';
  r.passage = passage;
  const estTransition = geste && geste.startsWith('transition-');
  if (estTransition && r.de) {
    r.coupe = coupeAvant(dossier, r.de, mots);
    if (r.coupe === null) R(id, 'PAS_DE_COUPE', `une transition se pose sur une coupe : il n'y en a pas juste avant « ${r.de.texte} »`);
  }
  if (!estTransition && (!Array.isArray(d.elements) || !d.elements.length)) R(id, 'CONTENU_MANQUANT', 'le plan doit donner le contenu à afficher (« elements » : texte et mot)');
  r.elements = [];
  let dernier = -1;
  for (const [j, e] of (d.elements || []).entries()) {
    const nom = `${id}.elements[${j}]`;
    if (e.texte === undefined || e.texte === null || String(e.texte).trim() === '') { R(nom, 'TEXTE_VIDE', 'élément sans texte'); continue; }
    const s = e.sur ? anc(e.sur, `${nom}.sur`) : null;
    if (!e.sur) R(nom, 'MOT_MANQUANT', `« ${e.texte} » : sur quel mot doit-il arriver ?`);
    if (s && r.de && r.a && (s.premier < r.de.premier || s.dernier > r.a.dernier)) A(nom, 'HORS_PASSAGE', `« ${e.texte} » arrive sur « ${s.texte} », hors du passage de la demande`);
    if (s && s.premier < dernier) A(nom, 'ORDRE', `« ${e.texte} » arrive avant l'élément précédent`);
    if (s) dernier = s.premier;
    // un chiffre affiché doit être dit par Romain dans le passage (rien d'inventé)
    const dits = nombresDits(passage + ' ' + (s ? s.texte : ''));
    for (const n of String(e.texte).match(/\d+([.,]\d+)?/g) || []) {
      if (!dits.has(n.replace(',', '.')) && !e.chiffre_source) R(nom, 'CHIFFRE_NON_DIT', `« ${n} » n'est pas dit dans le passage ; si le chiffre vient de Romain ailleurs, le plan l'écrit dans « chiffre_source »`);
    }
    r.elements.push({ ...e, sur: s });
  }
  // Une image de réaction (mème) n'est pas une photo de Romain : le monteur la télécharge lui-même (STYLE.md, décision de
  // Yoan du 2026-11-11). Le plan la signale par « quoi » qui commence par « à télécharger par le monteur ».
  const estMeme = (p) => /^\s*a telecharger par le monteur/.test(String(p.quoi || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  for (const [j, p] of r.photos.entries()) {
    if (p.fichier) continue;
    if (estMeme(p)) A(`${id}.photos[${j}]`, 'MEME_A_TELECHARGER', `${p.pour || 'image de réaction'} : à trouver et télécharger par le monteur (${p.quoi}), pas à demander à Romain`);
    else A(`${id}.photos[${j}]`, 'PHOTO_A_FOURNIR', `${p.pour || 'photo'} : emplacement posé, à demander à Romain`);
  }
  sortie.push(r);
}

// Densité (Yoan, 2026-11-20 : « classique ne veut pas dire vide », « sur la fin de la vidéo il manque au moins une ou deux
// animations sur la cam ») : hors accroche, un temps fort toutes les 15 s au plus, fin comprise ; au moins une animation
// sur la caméra (pas un plein écran) dans le dernier tiers. Une vidéo de moins de 30 s, ou une dérogation écrite dans le
// plan (« densite_derogation » : une histoire, une émotion où son visage porte tout), passe en avis.
{
  const PLEINS = new Set(['plein-ecran-visage', 'plein-ecran-fond', 'plein-ecran-orange', 'partout', 'plan-a-filmer', 'liste', 'schema',
    'minuteur-chiffres', 'minuteur-barre', 'recherche-google', 'demi-ecran', 'comparaison', 'tier-list']);
  const duree = mots.length ? mots.at(-1).end : 0;
  const forts = [];
  for (const r of sortie) {
    if (!r.de || ['accroche'].includes(r.geste) || (r.geste || '').startsWith('transition-')) continue;
    forts.push({ id: r.id, geste: r.geste, de: r.de.debut_s, a: (r.a || r.de).fin_s, camera: !PLEINS.has(r.geste) });
  }
  for (const b of (Array.isArray(plan) ? [] : plan.b_roll || [])) {
    try { const de = resoudre(b.de, mots), a = b.a ? resoudre(b.a, mots) : de; forts.push({ id: b.id, geste: 'b-roll', de: de.debut_s, a: a.fin_s, camera: false }); } catch { /* le calage du b-roll le dira */ }
  }
  forts.sort((x, y) => x.de - y.de);
  const acc = sortie.find((r) => r.geste === 'accroche');
  const departAcc = acc && acc.a ? acc.a.fin_s : 0;
  const pb = [];
  if (duree >= 30) {
    let t = departAcc;
    for (const f of forts) { if (f.de - t > 15) pb.push(`de ${t.toFixed(0)} à ${f.de.toFixed(0)} s, rien que ses sous-titres et des zooms (${(f.de - t).toFixed(0)} s, 15 au plus)`); t = Math.max(t, f.a); }
    if (duree - t > 15) pb.push(`de ${t.toFixed(0)} s à la fin (${duree.toFixed(0)} s), rien que ses sous-titres et des zooms`);
    if (!forts.some((f) => f.camera && f.de >= (2 * duree) / 3)) pb.push(`aucune animation sur la caméra dans le dernier tiers (après ${((2 * duree) / 3).toFixed(0)} s) : pose-en une sur une phrase d'enjeu ou de contraste (une condition, une opposition, une projection), geste « texte-sur-lui »`);
  }
  const derog = !Array.isArray(plan) && plan.densite_derogation && String(plan.densite_derogation).trim().length >= 20;
  for (const x of pb) { if (derog) A('plan', 'DENSITE', `${x} (dérogation : ${plan.densite_derogation})`); else R('plan', 'DENSITE', x); }
}

fs.mkdirSync(path.join(dossier, 'animations'), { recursive: true });
// remarques-plan.md : seule la section « Animations » appartient à ce script ; les autres (notes du monteur) restent.
{
  const f = path.join(dossier, 'remarques-plan.md'), titre = '## Animations (écrit par le calage, refait à chaque passage)';
  let txt = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const i = txt.indexOf(titre);
  if (i >= 0) { const j = txt.indexOf('\n## ', i + titre.length); txt = txt.slice(0, i).replace(/\n+$/, '\n\n') + (j >= 0 ? txt.slice(j + 1) : ''); }
  if (remarques.length) {
    if (!txt.trim()) txt = '# Remarques : le plan contre le style\n\nCe que le plan de montage demandait et que le monteur a fait autrement. Le style gagne toujours sur le plan (contrat, « Plan contre style ») : pour obtenir autre chose, il faut changer le style avec Yoan, pas le plan.\n';
    txt = txt.replace(/\n*$/, '\n\n') + `${titre}\n${remarques.join('\n')}\n`;
  }
  if (txt.trim()) fs.writeFileSync(f, txt);
}
fs.writeFileSync(path.join(dossier, 'animations', 'plan-resolu.json'), JSON.stringify({ plan: path.resolve(planF), demandes: sortie }, null, 2) + '\n');
for (const r of sortie) {
  console.log(`${r.id} ${r.geste} : ${r.de ? `images ${r.de.image} à ${r.a.fin_image}` : '?'} « ${r.passage.slice(0, 80)} »${r.coupe != null ? ` (coupe à l'image ${r.coupe})` : ''}`);
  for (const e of r.elements) if (e.sur) console.log(`   « ${e.texte} » sur « ${e.sur.texte} » w${e.sur.premier} : attaque ${e.sur.debut_s.toFixed(3)} s, image ${e.sur.image}`);
}
for (const a of avert) console.log(`AVERTISSEMENT ${a}`);
if (refus.length) { for (const x of refus) console.log(`REFUS ${x}`); console.log(`REFUSÉ : ${refus.length} problème(s) à renvoyer au plan de montage`); process.exit(2); }
if (remarques.length) console.log(`REMARQUES : ${remarques.length} demande(s) où le style gagne -> ${path.join(dossier, 'remarques-plan.md')}`);
console.log(`EXÉCUTABLE : ${sortie.length} demande(s) -> ${path.join(dossier, 'animations', 'plan-resolu.json')}`);
