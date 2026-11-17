#!/usr/bin/env node
// calques.mjs : écrit les entrées « source: animations » de <dossier -montage>/calques.json à partir des calque.json
// des dossiers calques/*/ écrits par instancier.mjs ou par une composition sur mesure. Les entrées des autres briques
// (sous-titres…) sont gardées telles quelles, dans leur ordre.
//
// Usage : node calques.mjs <dossier -montage> [--retirer <id>...]
//   Un calque d'animation dont le dossier a disparu (ou cité dans --retirer) sort de calques.json. Un dossier de calque
//   dont la demande n'est plus dans le plan calé (animations/plan-resolu.json : animation retirée ou renumérotée) n'y
//   entre pas non plus : il est signalé, à supprimer.
import fs from 'node:fs';
import path from 'node:path';

const [dossier, ...reste] = process.argv.slice(2);
if (!dossier) { console.log('Usage : node calques.mjs <dossier -montage> [--retirer <id>...]'); process.exit(3); }
const retirer = new Set(reste[0] === '--retirer' ? reste.slice(1) : []);
const f = path.join(dossier, 'calques.json');
const existant = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : { calques: [] };
const autres = (existant.calques || []).filter((c) => c.source !== 'animations');
const dc = path.join(dossier, 'calques');
const miens = [], erreurs = [], orphelins = [];
const resolu = path.join(dossier, 'animations', 'plan-resolu.json');
const demandes = fs.existsSync(resolu) ? new Set(JSON.parse(fs.readFileSync(resolu, 'utf8')).demandes.map((d) => d.id)) : null;
for (const id of fs.existsSync(dc) ? fs.readdirSync(dc).sort() : []) {
  const fiche = path.join(dc, id, 'calque.json');
  if (!fs.existsSync(fiche) || retirer.has(id)) continue;
  const c = JSON.parse(fs.readFileSync(fiche, 'utf8'));
  if (c.source !== 'animations') continue;
  if (demandes && !demandes.has(c.demande || String(c.id).replace(/-(derriere|devant|.+)$/, ''))) { orphelins.push(id); continue; }
  if (!fs.existsSync(path.join(dc, id, 'index.html'))) { erreurs.push(`${id} : index.html absent`); continue; }
  for (const k of ['debut', 'images', 'couche', 'ordre']) if (c[k] === undefined) erreurs.push(`${id} : champ ${k} manquant`);
  if (!['devant', 'derriere'].includes(c.couche)) erreurs.push(`${id} : couche « ${c.couche} » (devant ou derriere)`);
  if (c.ordre >= 100) erreurs.push(`${id} : ordre ${c.ordre} (100 et plus réservés aux sous-titres)`);
  if (c.plan && c.plan.detoure && c.couche !== 'derriere') erreurs.push(`${id} : plan detoure exige la couche derriere`);
  const e = { id: c.id, source: 'animations', dossier: c.dossier, debut: c.debut, images: c.images, couche: c.couche, ordre: c.ordre };
  if (c.plan) e.plan = c.plan;
  if (c.masque_sous_titres) e.masque_sous_titres = true;
  if (Array.isArray(c.mots_repris) && c.mots_repris.length) e.mots_repris = c.mots_repris;   // mots dits affichés par le calque (sortis des sous-titres)
  e.sons_suggeres = c.sons_suggeres || [];
  miens.push(e);
}
// deux effets sur le plan qui se chevauchent : le rendu ne saurait pas lequel appliquer
const plans = miens.filter((c) => c.plan).sort((a, b) => a.debut - b.debut);
for (let i = 1; i < plans.length; i++) if (plans[i].debut < plans[i - 1].debut + plans[i - 1].images) erreurs.push(`${plans[i - 1].id} et ${plans[i].id} : deux effets sur le plan en même temps`);
if (erreurs.length) { for (const x of erreurs) console.log(`ERREUR ${x}`); process.exit(2); }
fs.writeFileSync(f, JSON.stringify({ ...existant, calques: [...autres, ...miens] }, null, 2) + '\n');
for (const o of orphelins) console.log(`AVERTISSEMENT calques/${o} : aucune demande du plan ne lui correspond (animation retirée ou renumérotée) : pas dans calques.json, supprime ce dossier`);
console.log(`calques.json : ${miens.length} calque(s) d'animation, ${autres.length} d'autres briques gardé(s)`);
for (const c of miens) console.log(`   ${c.id} ${c.couche} ordre ${c.ordre} images ${c.debut}-${c.debut + c.images - 1}${c.plan ? ' plan ' + Object.keys(c.plan)[0] : ''}${c.sons_suggeres.length ? `, ${c.sons_suggeres.length} son(s) suggéré(s)` : ''}`);
