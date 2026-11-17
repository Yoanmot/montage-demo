// Faux modèle pour les tests (RANGEMENT_MODELE=<ce fichier>) : il « regarde » vraiment l'image du milieu (sa
// couleur moyenne, mesurée par ffmpeg) et répond comme le modèle, d'après la table FAUX_MODELE_TABLE
// (couleur -> réponse). Couleur inconnue : aucune prise. FAUX_MODELE_MODE=vide : réponse aux champs vides.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const entree = JSON.parse(fs.readFileSync(0, 'utf8'));
if (process.env.FAUX_MODELE_TRACE) fs.appendFileSync(process.env.FAUX_MODELE_TRACE, JSON.stringify({ images: entree.images.length, prompt: entree.prompt.slice(0, 80) }) + '\n');
if (process.env.FAUX_MODELE_MODE === 'vide') { console.log('{"prise": 4, "ce_qu_on_voit": "", "mouvements": []}'); process.exit(0); }
const image = entree.images[1] || entree.images[0];
const r = spawnSync('/opt/homebrew/bin/ffmpeg', ['-v', 'error', '-i', image, '-vf', 'scale=1:1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
const [R, G, B] = r.stdout;
const COULEURS = { rouge: [255, 0, 0], vert: [0, 128, 0], bleu: [0, 0, 255], jaune: [255, 255, 0], magenta: [255, 0, 255], gris: [128, 128, 128] };
let nom = null, best = Infinity;
for (const [n, [a, b, c]] of Object.entries(COULEURS)) {
  const d = (R - a) ** 2 + (G - b) ** 2 + (B - c) ** 2;
  if (d < best) { best = d; nom = n; }
}
const table = JSON.parse(process.env.FAUX_MODELE_TABLE || '{}');
const rep = table[nom] || { prise: null, ce_qu_on_voit: `un plan uni de couleur ${nom}`, mouvements: [] };
console.log(`Voici ma réponse :\n${JSON.stringify(rep)}`);
