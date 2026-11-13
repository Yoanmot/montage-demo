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
  const anc = (a, quoi) => { try { return resoudre(a, mots); } catch (e) { R(id, e.message.split(' ')[0], `${quoi} : ${e.message}`); return null; } };
  if (!d.de) R(id, 'PASSAGE_MANQUANT', 'le plan doit dire sur quels mots (champ « de », et « a » pour la fin)');
  r.de = d.de ? anc(d.de, 'de') : null;
  r.a = d.a ? anc(d.a, 'a') : r.de;
  if (r.de && r.a && r.a.premier < r.de.premier) R(id, 'PASSAGE_INVERSE', '« a » est dit avant « de »');
  // Plan contre style : le style gagne, on applique sa valeur et on le dit.
  r.style_gagne = [];
  if (geste && geste !== 'sur-mesure' && GESTES[geste]) {
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
  for (const [j, p] of r.photos.entries()) if (!p.fichier) A(`${id}.photos[${j}]`, 'PHOTO_A_FOURNIR', `${p.pour || 'photo'} : emplacement posé, à demander à Romain`);
  sortie.push(r);
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
