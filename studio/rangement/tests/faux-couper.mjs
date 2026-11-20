// Fausse brique de transcription pour les tests (RANGEMENT_COUPER=<ce fichier>) : « node faux-couper.mjs transcrire
// <vidéo> » écrit <nom>-montage/words.json à côté, avec le texte que FAUX_COUPER_TEXTES (nom sans extension -> texte)
// donne pour ce fichier. Elle refuse un fichier sans image (la vraie brique part d'une vidéo). Aucun réseau.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { outil } from '../lib/commun.mjs';

const [commande, fichier] = process.argv.slice(2);
if (commande !== 'transcrire' || !fichier) process.exit(2);
const r = spawnSync(outil('ffprobe'), ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'json', fichier], { encoding: 'utf8' });
const types = (JSON.parse(r.stdout || '{}').streams || []).map((s) => s.codec_type);
if (!types.includes('video') || !types.includes('audio')) { console.log('ERREUR pas une vidéo avec du son'); process.exit(3); }
const nom = path.parse(fichier).name;
if (process.env.FAUX_COUPER_TRACE) fs.appendFileSync(process.env.FAUX_COUPER_TRACE, nom + '\n');
const texte = JSON.parse(process.env.FAUX_COUPER_TEXTES || '{}')[nom] || '';
const dossier = path.join(path.dirname(fichier), `${nom}-montage`);
fs.mkdirSync(dossier, { recursive: true });
fs.writeFileSync(path.join(dossier, 'words.json'), JSON.stringify({ words: texte.split(/\s+/).filter(Boolean).map((text) => ({ text })) }));
