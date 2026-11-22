// La ressource gratuite reliée à un contenu (22/11/2026), lue dans le dépôt du head of content, jamais
// supposée. Le format est celui de outils/liaison.py (écrit seulement par `zernio.py relier`, `delier`,
// `valider-message --contenu`) :
//   contenus/<contenu>/ressource-liee.json  { "version": 1, "ressource": "<slug>" | null, "mot"?, "message"?,
//                                             "bouton"?, "valide"?: { "le", "empreinte" }, "relie_le"? }
// Sans ce fichier, un contenu dont le dossier a sa propre fiche (ressource.md) offre celle-là (forme d'avant).
import fs from "node:fs";
import path from "node:path";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FICHIERS_CONTENU = ["idee.md", "etat.json", "script.md", "carrousel.md"];
const existe = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };

// Le dépôt sait-il relier une ressource à un contenu (outil présent) ?
export const liaisonsPossibles = (depot) => Boolean(depot) && existe(path.join(depot, "outils", "liaison.py"));

export function lireLiaison(depot, contenu) {
  if (!depot || !SLUG.test(String(contenu || ""))) return null;
  let d;
  try { d = JSON.parse(fs.readFileSync(path.join(depot, "contenus", contenu, "ressource-liee.json"), "utf8")); } catch { return null; }
  if (!d || typeof d !== "object" || !("ressource" in d)) return null;
  if (d.ressource !== null && !(typeof d.ressource === "string" && SLUG.test(d.ressource))) return null;
  return d;
}

// Le slug de la ressource qu'offre ce contenu, ou null.
export function ressourceDuContenu(depot, contenu) {
  if (!depot || !SLUG.test(String(contenu || ""))) return null;
  const l = lireLiaison(depot, contenu);
  if (l) return l.ressource;
  const d = path.join(depot, "contenus", contenu);
  return existe(path.join(d, "ressource.md")) && FICHIERS_CONTENU.some((n) => existe(path.join(d, n))) ? contenu : null;
}
