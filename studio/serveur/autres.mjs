// Les « autres fichiers » d'un contenu (19/11/2026) : ce que le head of content a posé dans
// DEPOT/contenus/<slug>/ à la demande du client (icônes pour le montage, notes...), en dehors des
// fichiers que le studio montre déjà. Lecture seule. Les liens symboliques et les fichiers cachés ne
// sont jamais lus ni servis.
import fs from "node:fs";
import path from "node:path";
import { dedans } from "./outils.mjs";

// Les fichiers du haut du dossier que le studio montre déjà (Idée, Brief, Ressource gratuite) ou qui
// servent aux agents et au studio, jamais au client : etat.json ; reference.md, la vidéo d'origine lue par
// le head of content pour lui et le monteur (21/11) ; stock.json, les plans du brief comparés à la Galerie,
// et stock-choix.json, les choix du client sur ces plans (lot 15).
export const FICHIERS_CONNUS = new Set(["idee.md", "etat.json", "script.md", "carrousel.md", "ressource.md", "reference.md",
  "stock.json", "stock-choix.json"]);
// Un JSON, où qu'il soit dans le dossier, est une donnée d'outil (état, comparaison, choix) : jamais montré.
const interne = (nom) => path.extname(nom).toLowerCase() === ".json";
const IMAGES = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);
const TEXTES = new Set([".md", ".txt"]);
const PROFONDEUR = 6;
const MAX_FICHIERS = 300;

export function genreDe(nom) {
  const ext = path.extname(nom).toLowerCase();
  if (IMAGES.has(ext)) return "image";
  if (TEXTES.has(ext)) return "texte";
  return "autre";
}

// « 01-site.png » -> « 01 site » ; « mes_notes.md » -> « mes notes ».
export function nomLisible(nom) {
  const base = path.basename(String(nom));
  const sans = base.replace(/\.[^.]+$/, "") || base;
  return sans.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim() || base;
}

// La liste, triée (« 2 » avant « 10 »). `max` arrête la lecture tôt (1 suffit pour savoir s'il y en a).
export function autresFichiers(dossier, { max = MAX_FICHIERS } = {}) {
  const r = [];
  const parcourir = (abs, rel, niveau) => {
    if (niveau > PROFONDEUR || r.length >= max) return;
    let entrees;
    try { entrees = fs.readdirSync(abs, { withFileTypes: true }); } catch { return; }
    for (const e of entrees) {
      if (r.length >= max) return;
      if (e.name.startsWith(".") || e.isSymbolicLink()) continue;
      const relE = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { parcourir(path.join(abs, e.name), relE, niveau + 1); continue; }
      if (!e.isFile() || (!rel && FICHIERS_CONNUS.has(e.name)) || interne(e.name)) continue;
      let s;
      try { s = fs.statSync(path.join(abs, e.name)); } catch { continue; }
      r.push({ chemin: relE, dossier: rel || null, nom: nomLisible(e.name), genre: genreDe(e.name), taille: s.size, maj: Math.round(s.mtimeMs) });
    }
  };
  parcourir(dossier, "", 0);
  return r.sort((a, b) => a.chemin.localeCompare(b.chemin, "fr", { numeric: true }));
}

// Le fichier à servir pour ces morceaux d'adresse (déjà décodés), ou null : seulement une image ou un
// texte que la liste montrerait, dans le dossier du contenu, sans lien symbolique sur le chemin.
export function fichierAutre(dossier, segments) {
  if (!Array.isArray(segments) || !segments.length || segments.length > PROFONDEUR + 1) return null;
  for (const s of segments) {
    if (typeof s !== "string" || !s || s.startsWith(".") || /[/\\\0]/.test(s)) return null;
  }
  if (segments.length === 1 && FICHIERS_CONNUS.has(segments[0])) return null;
  if (genreDe(segments[segments.length - 1]) === "autre") return null;
  let racine;
  try { racine = fs.realpathSync(dossier); } catch { return null; }
  let courant = racine;
  for (const s of segments) {
    courant = path.join(courant, s);
    let st;
    try { st = fs.lstatSync(courant); } catch { return null; }
    if (st.isSymbolicLink()) return null;
  }
  let reel;
  try { reel = fs.realpathSync(courant); } catch { return null; }
  if (!dedans(racine, reel) || reel === racine) return null;
  try { if (!fs.statSync(reel).isFile()) return null; } catch { return null; }
  return reel;
}
