#!/usr/bin/env node
// registre-accroches.mjs : le registre des accroches de Romain, tenu par ce script (jamais par la mémoire du modèle).
// Chaque montage y note la composition de son accroche (type, mot mis en avant, place, entrée, relance, effet) ; le
// monteur lit les deux dernières avant d'écrire la sienne et ne reprend pas la même combinaison.
//
// Usage :
//   node registre-accroches.mjs lire [<dossier -montage>]     les deux dernières accroches (sans celle de cette vidéo)
//                                                              et ce qu'il ne faut pas reprendre
//   node registre-accroches.mjs verifier <dossier -montage>   compare l'accroche du plan aux deux dernières
//   node registre-accroches.mjs noter <dossier -montage>      vérifie puis écrit la ligne de cette vidéo
//                                                              (accroche.mjs le fait tout seul quand il compose)
// Fichier : MONTEUR_REGISTRE, sinon $CLAUDE_CONFIG_DIR/agent-memory/monteur/registre-accroches.json (~/.claude sans la
// variable). Codes : 0 ok · 2 accroche absente ou illisible · 4 RÉPÉTITION (combinaison déjà vue) · 3 usage.
import fs from 'node:fs';
import path from 'node:path';
import { cheminRegistre, lireRegistre, dernieres, verifier, noter, decrire } from './lib/accroche.mjs';

const [cmd, dossierArg] = process.argv.slice(2);
if (!['lire', 'verifier', 'noter'].includes(cmd) || (cmd !== 'lire' && !dossierArg)) {
  console.log('Usage : node registre-accroches.mjs lire [<dossier -montage>] | verifier <dossier -montage> | noter <dossier -montage>');
  process.exit(3);
}
const f = cheminRegistre();
const video = dossierArg ? path.resolve(dossierArg) : null;

function accrocheDuPlan(M) {
  const p = path.join(M, 'plan-montage.json');
  if (!fs.existsSync(p)) { console.log(`ACCROCHE_ABSENTE : pas de plan-montage.json dans ${M}`); process.exit(2); }
  const plan = JSON.parse(fs.readFileSync(p, 'utf8'));
  const d = (plan.animations || []).find((a) => a.geste === 'accroche');
  if (!d) { console.log('ACCROCHE_ABSENTE : le plan n\'a pas de demande « accroche »'); process.exit(2); }
  return { d, titre: plan.video || null };
}

if (cmd === 'lire') {
  const prec = dernieres(lireRegistre(f), video);
  console.log(`REGISTRE ${f} (${lireRegistre(f).accroches.length} accroche(s))`);
  if (!prec.length) { console.log('AUCUNE accroche notée avant celle-ci : la composition est libre.'); process.exit(0); }
  prec.forEach((a, i) => console.log(`${i === prec.length - 1 ? 'DERNIÈRE' : 'AVANT-DERNIÈRE'} ${decrire(a)}`));
  console.log('À NE PAS REPRENDRE :');
  for (const a of prec) console.log(`  - la combinaison ${a.type} / ${a.place} / ${a.entree}, et le mot « ${a.mot} »`);
  console.log(`  - la place « ${prec.at(-1).place} » pour le mot fort (celle de la dernière)`);
  process.exit(0);
}

const { d, titre } = accrocheDuPlan(video);
const v = verifier(d, video, f);
for (const a of v.avis) console.log(`AVIS ${a}`);
if (v.repetitions.length) {
  for (const x of v.repetitions) console.log(`RÉPÉTITION ${x}`);
  console.log('Change la place, l\'entrée ou le mot fort de l\'accroche (ou le type), puis relance. Une demande de Romain s\'écrit dans composition.demande_de_romain.');
  process.exit(4);
}
if (cmd === 'verifier') { console.log(`OK accroche nouvelle : ${v.sig.type} / ${v.sig.place} / ${v.sig.entree}, mot « ${v.sig.mot} »`); process.exit(0); }
const l = noter(d, video, { titre }, f);
console.log(`NOTÉE ${decrire(l)} -> ${f}`);
