// Le fichier attendu de chaque action (contrat, section 9) : une action est « fini » quand ce
// fichier existe (écrit pendant l'action), jamais parce que le modèle le dit.
import path from "node:path";
import { lireJson, lister, stat, lireDate } from "./outils.mjs";
import { estMonte } from "./stades.mjs";
import { lireDepot, instantane } from "./lecture.mjs";

const MARGE_MS = 2000;

function ecritDepuis(chemin, debutMs) {
  const s = stat(chemin);
  return Boolean(s && s.mtimeMs >= debutMs - MARGE_MS);
}

export function formatDuContenu(config, slug) {
  return instantane(config, slug, lireDepot(config.depot)).contenu.format;
}

export function attenduPresent(action, config) {
  const debut = lireDate(action.debut)?.getTime() ?? 0;
  const d = config.depot;
  switch (action.type) {
    case "script": {
      const format = formatDuContenu(config, action.slug);
      const f = format === "carrousel"
        ? path.join(d, "contenus", action.slug, "carrousel.md")
        : path.join(d, "contenus", action.slug, "script.md");
      return ecritDepuis(f, debut);
    }
    case "tournage": {
      const slugs = action.slugs || [];
      return lister(path.join(d, "tournages")).some((e) => {
        if (!e.isFile() || !e.name.endsWith(".json")) return false;
        const f = path.join(d, "tournages", e.name);
        if (!ecritDepuis(f, debut)) return false;
        const t = lireJson(f, null);
        return Array.isArray(t?.contenus) && slugs.every((s) => t.contenus.includes(s));
      });
    }
    case "montage": {
      const face = path.join(config.media, action.slug, "face");
      return lister(face).some((e) => !e.isDirectory() && estMonte(e.name) && ecritDepuis(path.join(face, e.name), debut));
    }
    case "mise_en_page": {
      const e = lireJson(path.join(d, "rendus", "registre.json"), {})?.carrousels?.[action.slug];
      if (!e) return false;
      const rendu = lireDate(e.rendu_le);
      return !rendu || rendu.getTime() >= debut - MARGE_MS;
    }
    default:
      return false;
  }
}
