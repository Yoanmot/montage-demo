#!/usr/bin/env node
// plan-a-filmer.mjs : l'écran « B-ROLL » (geste « plan-a-filmer »), à la place d'un plan filmé qui manque.
// Yoan, 2026-11-20 : « Il manque les b-roll : en attendant, mets un fond noir avec écrit b-roll. » Quand il cite une chose
// concrète qu'on peut voir (un exercice, un geste, un aliment, un écran) et qu'aucun de ses clips ne la montre, le plan
// ne l'escamote pas : un écran charbon plein cadre couvre la phrase, avec « B-ROLL » en capitales craie et, dessous, ce
// qu'il faut filmer. Pas d'orange : ses sous-titres gardent leur pavé orange par-dessus. Le manque se voit, et Romain sait quoi filmer ; le jour où le clip arrive, il prend cette place
// (brique b-roll, mêmes mots). Ses sous-titres restent par-dessus, comme sur un vrai plan filmé.
//
// La demande du plan (format.md, « Plan à filmer ») :
//   { "id": "a04", "geste": "plan-a-filmer", "intention": "...", "de": "<premier mot de la phrase>", "a": "<dernier mot>",
//     "elements": [ { "texte": "<ce qu'il faut filmer, une phrase>", "sur": "<premier mot de la phrase>" } ] }
// Usage : node plan-a-filmer.mjs <dossier -montage> <id>
import fs from 'node:fs';
import path from 'node:path';
import { S, K, FPS, Couche, chargerMots, coupes, img, tImg, f4, mesure, ecrireCalque } from './lib/style.mjs';

const [Marg, ID] = process.argv.slice(2);
const M = Marg && path.resolve(Marg);
if (!M || !ID) { console.log('Usage : node plan-a-filmer.mjs <dossier -montage> <id>'); process.exit(3); }
const resoluF = path.join(M, 'animations', 'plan-resolu.json');
if (!fs.existsSync(resoluF)) { console.log(`PLAN_NON_CALÉ : lance d'abord caler.mjs (il manque ${resoluF})`); process.exit(3); }
const d = JSON.parse(fs.readFileSync(resoluF, 'utf8')).demandes.find((x) => x.id === ID);
if (!d || d.geste !== 'plan-a-filmer') { console.log(`DEMANDE_INTROUVABLE : pas de demande ${ID} « plan-a-filmer » dans le plan calé`); process.exit(3); }
const PF = S.PLAN_A_FILMER, Z = S.ZONE_SURE;
const refus = [];
if (d.elements.length !== 1) refus.push('ELEMENTS : un seul élément, ce qu\'il faut filmer');
const quoi = String(d.elements[0]?.texte || '').trim();
if (quoi.length < PF.quoiMin) refus.push(`QUOI_FLOU : « ${quoi} » : dis ce qu'il faut filmer (ce qu'on voit, ce qu'il fait), ${PF.quoiMin} caractères au moins`);
if (refus.length) { refus.forEach((r) => console.log(`REFUS ${r}`)); console.log(`REFUSÉ : ${refus.length} problème(s)`); process.exit(2); }

chargerMots(M);
const cs = coupes(M);
// la phrase entière : de la coupe juste avant son premier mot (ou son attaque) à la coupe juste après son dernier mot
const avant = cs.filter((c) => c <= d.de.image && d.de.image - c <= img(PF.aimant)).at(-1);
const debut = avant ?? d.de.image;
const finA = (d.a || d.de).fin_image;
const fin = cs.find((c) => c >= finA && c - finA <= img(PF.aimant)) ?? finA + img(0.15);
const images = fin - debut;

// « B-ROLL » en capitales, puis ce qu'il faut filmer en craie plus discrète, coupé en lignes qui tiennent dans la zone sûre
const largeur = Z.x1 - Z.x0 - 2 * PF.marge;
const motsQ = quoi.split(/\s+/), lignes = [];
let cur = '';
for (const w of motsQ) {
  const essai = (cur + ' ' + w).trim();
  if (cur && mesure('encre', 'texte', PF.texte, essai).largeur > largeur) { lignes.push(cur); cur = w; } else cur = essai;
}
if (cur) lignes.push(cur);
if (lignes.length > PF.lignesMax) { console.log(`REFUS QUOI_LONG : ${lignes.length} lignes (${PF.lignesMax} au plus) : dis-le plus court`); process.exit(2); }
const hPave = PF.titre * S.POLICES.titre.interligne;
const hTexte = lignes.length * PF.texte * S.POLICES.texte.interligne;
const haut = PF.centreY - (hPave + PF.ecart + hTexte) / 2;
const c = new Couche(images);
c.css = `#fd{inset:0;background:${K.charbon};}
#br{left:0;width:${S.VIDEO.w}px;top:${haut.toFixed(1)}px;text-align:center;white-space:normal;}
#br .pv{font-size:${PF.titre}px;}
#q{opacity:${PF.opaciteTexte};left:0;width:${S.VIDEO.w}px;top:${(haut + hPave + PF.ecart).toFixed(1)}px;text-align:center;white-space:normal;font-size:${PF.texte}px;}
`;
c.html = `  <div class="a fd" id="fd"></div>
  <div class="a" id="br"><span class="ti c-cr pv">B-ROLL</span></div>
  <div class="a tx c-cr" id="q">${lignes.map((l) => l.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join('<br>')}</div>
`;
for (const sel of ['#fd', '#br', '#q']) c.montre(sel, 0, sel === '#q' ? `à filmer : ${quoi}` : false);
ecrireCalque(M, {
  id: ID, demande: ID, debut, images, couche: 'devant', ordre: 15, sons_suggeres: [],
  attendus: c.attendus.map(({ mi, ...a }) => a),
  origine: { sur_mesure: `plan filmé qui manque : ${quoi}`, a_filmer: quoi, gestes_repris: ['plein-ecran-fond (charbon)'] },
  params: { quoi, phrase: d.passage },
}, c.page());
console.log(`À FILMER ${ID} : images ${debut} à ${fin - 1} (${(images / FPS).toFixed(1)} s) sur « ${d.passage} » : ${quoi}`);
console.log(`Ensuite : verifier.mjs ${M} ${ID}, puis calques.mjs ; dis-le dans le compte rendu (« à filmer »).`);
