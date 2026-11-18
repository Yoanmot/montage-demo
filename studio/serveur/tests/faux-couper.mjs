#!/usr/bin/env node
// Fausse brique couper-silences pour les tests du rangement : « transcrire <lien> » écrit
// <nom>-montage/words.json à côté du lien avec le texte de FAUX_COUPER_TEXTE (ce que « dit » la vidéo).
import fs from "node:fs";
import path from "node:path";
const [quoi, lien] = process.argv.slice(2);
if (quoi !== "transcrire" || !lien) process.exit(2);
const dossier = path.join(path.dirname(lien), `${path.parse(lien).name}-montage`);
fs.mkdirSync(dossier, { recursive: true });
const mots = String(process.env.FAUX_COUPER_TEXTE || "").split(/\s+/).filter(Boolean).map((text) => ({ text }));
fs.writeFileSync(path.join(dossier, "words.json"), JSON.stringify({ words: mots }));
