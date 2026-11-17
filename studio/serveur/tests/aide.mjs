// Aides des tests : un monde fabriqué dans un dossier temporaire (STUDIO_HOME, DEPOT, MEDIA),
// jamais les vrais dossiers de Romain ou de Yoan.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { chargerConfig } from "../config.mjs";
import { empreinteTexte } from "../outils.mjs";

export const ICI = path.dirname(fileURLToPath(import.meta.url));
export const FAUX_CLAUDE = path.join(ICI, "faux-claude.mjs");

export function monde({ config: ajout = {}, port = 0 } = {}) {
  const racine = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "studio-test-")));
  const home = path.join(racine, "studio");
  const depot = path.join(racine, "depot");
  const media = path.join(racine, "Contenu");
  const maison = path.join(racine, "maison");
  for (const d of [home, depot, media, maison, path.join(depot, "contenus"), path.join(depot, "propositions")]) {
    fs.mkdirSync(d, { recursive: true });
  }
  const journalClaude = path.join(racine, "faux-claude.jsonl");
  const brut = {
    version: 1, prenom: "Test", port: port || 40000 + Math.floor(Math.random() * 20000),
    depot_hoc: depot, depot_mac: path.join(racine, "copie-mac"), media, arrivees: null, disque_externe: null, appareil: null, skills: path.join(maison, "skills"),
    agents: { idees: "head-of-content", montage: "monteur" }, sessions_en_parallele: 1, synchro_minutes: 0,
    publication: { heures_par_defaut: { reel: "18:30", carrousel: "12:15" }, jours_par_defaut: ["mardi", "jeudi", "dimanche"], simulation: true },
    claude: { binaire: FAUX_CLAUDE, modele: null },
    ...ajout,
  };
  fs.writeFileSync(path.join(home, "studio.config.json"), JSON.stringify(brut, null, 2) + "\n");
  const env = { ...process.env, HOME: maison, STUDIO_HOME: home, FAUX_CLAUDE_JOURNAL: journalClaude };
  const config = chargerConfig({ home, env });
  return {
    racine, home, depot, media, maison, config, env, journalClaude,
    ecrire(rel, texte) {
      const f = path.join(racine, rel);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, texte);
      return f;
    },
    json(rel, v) {
      return this.ecrire(rel, JSON.stringify(v, null, 2) + "\n");
    },
    contenu(slug, { format = "reel", titre = `Titre ${slug}`, valide = null, refuse = null, jour = null } = {}) {
      return this.json(`depot/contenus/${slug}/etat.json`, {
        version: 1, titre, format, cree_le: "2026-11-15T17:41:00+01:00", proposition: null,
        declinaison_de: null, jour_prevu: jour, valide, refuse,
      });
    },
    valider(slug, texte) {
      return { le: "2026-11-15T18:02:00+01:00", empreinte: empreinteTexte(texte) };
    },
    lancements() {
      try {
        return fs.readFileSync(journalClaude, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
      } catch {
        return [];
      }
    },
    nettoyer() {
      fs.rmSync(racine, { recursive: true, force: true });
    },
  };
}

export function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
}

export function depotGit(m) {
  const distant = path.join(m.racine, "distant.git");
  git(m.racine, "init", "-q", "--bare", "-b", "main", distant);
  git(m.depot, "init", "-q", "-b", "main");
  git(m.depot, "config", "user.email", "test@exemple.invalid");
  git(m.depot, "config", "user.name", "Test");
  fs.writeFileSync(path.join(m.depot, "README.md"), "dépôt de test\n");
  git(m.depot, "add", "-A");
  git(m.depot, "commit", "-q", "-m", "départ");
  git(m.depot, "remote", "add", "origin", distant);
  git(m.depot, "push", "-q", "-u", "origin", "main");
  return distant;
}

export async function attendreQue(condition, { delaiMs = 8000, pasMs = 20 } = {}) {
  const fin = Date.now() + delaiMs;
  for (;;) {
    const v = await condition();
    if (v) return v;
    if (Date.now() > fin) throw new Error("condition jamais remplie");
    await new Promise((r) => setTimeout(r, pasMs));
  }
}

export function vivant(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
