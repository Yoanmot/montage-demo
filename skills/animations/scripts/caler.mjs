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

// Ce qui couvre son image (plein écran, multitude, écran « B-ROLL », liste…) : le reste est une animation sur la caméra.
const PLEINS = new Set(['plein-ecran-visage', 'plein-ecran-fond', 'plein-ecran-orange', 'partout', 'plan-a-filmer', 'liste', 'schema',
  'minuteur-chiffres', 'minuteur-barre', 'recherche-google', 'demi-ecran', 'comparaison', 'tier-list']);
// Densité (Yoan, 2026-11-20 : « classique ne veut pas dire vide », « sur la fin de la vidéo il manque au moins une ou deux
// animations sur la cam ») : hors accroche, un temps fort toutes les 15 s au plus, fin comprise ; au moins une animation
// sur la caméra (pas un plein écran) dans le dernier tiers. Une vidéo de moins de 30 s, ou une dérogation écrite dans le
// plan (« densite_derogation » : une histoire, une émotion où son visage porte tout), passe en avis.
{
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

// Lui à l'image (Yoan, 2026-11-20, tour 4) : trois règles qui ne dépendent pas de la durée de la vidéo.
// 1. FIN_SUR_LUI : une vidéo finit sur son visage ; rien qui couvre son image ne va jusqu'à son dernier mot.
// 2. PLEINS_DE_SUITE : jamais deux écrans qui le cachent l'un après l'autre sans lui au milieu.
// 3. QUESTION_SUR_LUI : une question posée au spectateur est animée sur lui (il reste à l'image, ses mots apparaissent).
// Et pour une vidéo de 30 s et plus, MOMENT_CLE : le moment qui porte l'intention de la vidéo (la bascule vers le
// spectateur, l'appel à agir) est le temps fort le plus accentué de la fin : le zoom le plus serré de la vidéo, qui suit
// sa tête (« moment »: true), et une animation sur lui.
{
  const FIN_LUI = 1.0, ENTRE_LUI = 1.0, LUI_AU_DEBUT = { 'plein-ecran-visage': 0.8 };
  const duree = mots.length ? mots.at(-1).end : 0;
  const couvrants = [];
  for (const r of sortie) if (r.de && PLEINS.has(r.geste)) couvrants.push({ id: r.id, geste: r.geste, de: r.de.debut_s + (LUI_AU_DEBUT[r.geste] || 0), a: (r.a || r.de).fin_s, anim: true });
  for (const b of (Array.isArray(plan) ? [] : plan.b_roll || [])) {
    try { const de = resoudre(b.de, mots), a = b.a ? resoudre(b.a, mots) : de; couvrants.push({ id: b.id || 'b-roll', geste: 'plan filmé', de: de.debut_s, a: a.fin_s, anim: false }); } catch { /* le calage du b-roll le dira */ }
  }
  couvrants.sort((x, y) => x.de - y.de);
  const camera = sortie.filter((r) => r.de && r.geste && !PLEINS.has(r.geste) && !r.geste.startsWith('transition-'));
  const chevauche = (de, a, x, y) => x < a && y > de;
  if (mots.length) {
    const tard = couvrants.filter((c) => duree - c.a < FIN_LUI);
    for (const c of tard) R('plan', 'FIN_SUR_LUI', `${c.id} (${c.geste}) va jusqu'à ${c.a.toFixed(1)} s, la vidéo finit à ${duree.toFixed(1)} s : elle finit sur son visage (sa dernière phrase à l'image, ${FIN_LUI} s au moins). Termine cet effet plus tôt, ou reste sur lui : une phrase qui conclut ou prend le spectateur à témoin se dit les yeux dans les yeux`);
  }
  const anims = couvrants.filter((c) => c.anim);
  for (let k = 1; k < anims.length; k++) {
    const p = anims[k - 1], q = anims[k];
    if (q.de - p.a < ENTRE_LUI) R('plan', 'PLEINS_DE_SUITE', `${p.id} (${p.geste}) puis ${q.id} (${q.geste}) : ${Math.max(0, q.de - p.a).toFixed(1)} s de lui entre les deux, ${ENTRE_LUI} s au moins. Deux écrans qui le cachent ne se suivent jamais : garde celui qui montre vraiment ce que dit sa phrase, et reste sur lui pour l'autre`);
  }
  // les questions qu'il pose au spectateur : une phrase qui finit par « ? » et lui parle (tu, te, toi, ton, vous…), hors
  // d'une pensée citée entre guillemets
  const ADRESSE = new Set(['tu', 'te', 'toi', 'ton', 'ta', 'tes', 'vous', 'votre', 'vos']);
  let d0 = 0, cite = false;
  for (let i = 0; i < mots.length; i++) {
    const t = String(mots[i].text);
    if (t.includes('«')) cite = true;
    const finPh = /[.!?…]["»]?$/.test(t.trim());
    if (!finPh) continue;
    const ph = mots.slice(d0, i + 1), q = /\?["»]?$/.test(t.trim()) && !cite;
    if (t.includes('»')) cite = false;
    const debutPh = d0; d0 = i + 1;
    if (!q) continue;
    const toks = ph.map((w) => normaliser(w.text)).filter(Boolean);
    if (!toks.some((w) => ADRESSE.has(w) || /^t'/.test(w))) continue;
    const vrais = ph.filter((w) => normaliser(w.text));
    const de = vrais[0].start, a = vrais.at(-1).end, texte = vrais.map((w) => w.text).join(' ');
    const surLui = camera.some((r) => chevauche(de, a, r.de.debut_s, (r.a || r.de).fin_s));
    const cache = couvrants.find((c) => chevauche(de, a, c.de, c.a));
    if (cache) R('plan', 'QUESTION_SUR_LUI', `« ${texte} » (w${debutPh}) : une question qu'il pose au spectateur se pose les yeux dans les yeux ; ${cache.id} (${cache.geste}) le cache à ce moment-là`);
    else if (!surLui) R('plan', 'QUESTION_SUR_LUI', `« ${texte} » (w${debutPh}) : une question qu'il pose au spectateur est toujours animée sur lui (geste « texte-sur-lui », forme « question » : ses mots au-dessus de sa tête, sur sa voix)`);
  }
  // le moment clé
  const mc = Array.isArray(plan) ? null : plan.moment_cle;
  if (duree >= 30 && !mc) R('plan', 'MOMENT_CLE', 'écris « moment_cle » : { "de", "a", "pourquoi" } : la phrase qui porte l\'intention de la vidéo (ce qu\'elle veut que le spectateur fasse ou ressente en partant : souvent la bascule vers lui, l\'appel à agir), et pourquoi celle-là');
  if (mc) {
    let de = null, a = null;
    try { de = resoudre(mc.de, mots); a = resoudre(mc.a || mc.de, mots); } catch (e) { R('plan', 'MOMENT_CLE', `ancre du moment clé : ${e.message}`); }
    if (!mc.pourquoi || String(mc.pourquoi).trim().length < 20) R('plan', 'MOMENT_CLE', '« pourquoi » : une phrase, l\'intention de la vidéo et pourquoi ce moment la porte');
    if (de && a) {
      // zooms : mêmes valeurs que la brique zooms (zooms.py : défauts, plafonds, MOMENT_ECHELLE)
      const DEF = { eclair: 1.15, rapprochement: 1.10, suivi: 1.10, ouverture: 1.20 };
      let W = 1080, H = 1920;
      try { const inf = JSON.parse(fs.readFileSync(path.join(dossier, 'info.json'), 'utf8')); W = +inf.largeur || W; H = +inf.hauteur || H; } catch { /* défaut */ }
      const k4 = Math.min(W, H) >= 2000, plafond = k4 ? 1.8 : 1.15, plafondMoment = k4 ? 1.8 : 1.25;
      const zs = (plan.zooms || []).filter(Boolean);
      const eff = (z) => (z.moment ? Math.min(+(z.echelle ?? 1.25), plafondMoment)
        : z.type === 'ouverture' ? Math.min(+(z.echelle ?? DEF.ouverture), 1.2) : Math.min(+(z.echelle ?? DEF[z.type] ?? 1.15), plafond));
      const zm = zs.filter((z) => z.moment);
      if (zm.length !== 1) R('plan', 'MOMENT_CLE', `${zm.length} zoom(s) « moment »: true : il en faut un, sur le moment clé (« sur » son premier mot, « a » son dernier) ; il suit sa tête et tient toute la phrase`);
      else {
        let s0 = null;
        try { s0 = resoudre(zm[0].sur, mots); } catch (e) { R('plan', 'MOMENT_CLE', `zoom du moment clé : ${e.message}`); }
        if (s0 && (s0.premier < de.premier || s0.premier > a.dernier)) R('plan', 'MOMENT_CLE', `le zoom « moment » part sur « ${s0.texte} », hors du moment clé (« ${de.texte} » à « ${a.texte} »)`);
        const autres = zs.filter((z) => !z.moment), max = Math.max(0, ...autres.map(eff));
        if (eff(zm[0]) <= max + 1e-6) R('plan', 'MOMENT_CLE', `le zoom du moment clé (${Math.round(eff(zm[0]) * 100)} %) doit être le plus serré de la vidéo ; un autre va à ${Math.round(max * 100)} %`);
      }
      const dS = de.debut_s, aS = a.fin_s;
      if (!camera.some((r) => r.geste !== 'accroche' && chevauche(dS, aS, r.de.debut_s, (r.a || r.de).fin_s))) R('plan', 'MOMENT_CLE', `« ${de.texte} » à « ${a.texte} » : le moment clé a une animation sur lui (geste « texte-sur-lui » : les mots qui portent l'intention, sur sa voix), en plus du zoom`);
      const cache = couvrants.find((c) => chevauche(dS, aS, c.de, c.a));
      if (cache) R('plan', 'MOMENT_CLE', `le moment clé se vit sur son visage : ${cache.id} (${cache.geste}) le cache`);
    }
  }
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
