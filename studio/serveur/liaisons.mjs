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

// La fiche d'une ressource (25/11/2026, même règle que outils/commun.py de Romain, fiche_ressource) : celle du
// contenu du même slug (contenus/<slug>/ressource.md) si elle existe, sinon la fiche d'une ressource générale,
// offerte sans contenu à elle (ressources/<slug>.md). Aucune des deux : null.
export function ficheRessource(depot, slug) {
  if (!depot || !SLUG.test(String(slug || ""))) return null;
  const c = path.join(depot, "contenus", slug, "ressource.md");
  if (existe(c)) return c;
  const g = path.join(depot, "ressources", `${slug}.md`);
  return existe(g) ? g : null;
}

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

// La ressource dont la section « Message automatique » du script donne le lien (<site>/<slug>/), si elle a sa fiche
// (même lecture que outils/liaison.py de Romain, lien_du_script).
function lienDuScript(depot, contenu, site) {
  let t;
  try { t = fs.readFileSync(path.join(depot, "contenus", contenu, "script.md"), "utf8"); } catch { return null; }
  const s = /^##\s+Message automatique[^\n]*\n([\s\S]*?)(?=^##\s|(?![\s\S]))/m.exec(t);
  const l = s && /^-[ \t]*Lien[ \t]*:[ \t]*(.+)$/im.exec(s[1]);
  if (!l) return null;
  const base = String(site || "").replace(/\/+$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = base && new RegExp(`^${base}/([a-z0-9]+(?:-[a-z0-9]+)*)/$`).exec(l[1].trim().replace(/^`|`$/g, ""));
  return m && ficheRessource(depot, m[1]) ? m[1] : null;
}

// Le slug de la ressource qu'offre ce contenu, ou null. `site` (client dont le serveur pose le mot, Romain) : sans
// liaison, un contenu dont le script donne le lien d'une ressource l'offre aussi (c'est ce que lit son serveur).
export function ressourceDuContenu(depot, contenu, { site = null } = {}) {
  if (!depot || !SLUG.test(String(contenu || ""))) return null;
  const l = lireLiaison(depot, contenu);
  if (l) return l.ressource;
  const d = path.join(depot, "contenus", contenu);
  if (!FICHIERS_CONTENU.some((n) => existe(path.join(d, n)))) return null;
  if (existe(path.join(d, "ressource.md"))) return contenu;
  return site ? lienDuScript(depot, contenu, site) : null;
}
