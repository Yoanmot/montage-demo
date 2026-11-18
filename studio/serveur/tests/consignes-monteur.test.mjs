// Consignes du monteur : le vocabulaire du chat dans le studio (test de bout en bout du 18/11 : le monteur
// parlait encore de « la planche » et de « 35 pixels » alors que l'aperçu l'a remplacée au lot 8).
// Lit les vrais fichiers du dépôt : agents/monteur.md et les briques qui parlent de la planche.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const DEPOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const lire = (rel) => fs.readFileSync(path.join(DEPOT, rel), "utf8");
const INTERDITS = /planche|vignette|pixel|\bpx\b|coordonn/i;

// Le texte d'une section, de son titre au titre suivant de même niveau ou plus haut.
function section(texte, titre) {
  const i = texte.indexOf(titre);
  assert.ok(i >= 0, `section introuvable : ${titre}`);
  const niveau = /^#+/.exec(titre)?.[0].length || 99;
  const suite = texte.slice(i + titre.length);
  const m = new RegExp(`\\n#{1,${niveau}} `).exec(suite);
  return titre + (m ? suite.slice(0, m.index) : suite);
}

// Les phrases à dire, données en exemple : « Une phrase qui commence par une majuscule et finit par un point. »
function phrasesExemples(texte) {
  return [...texte.matchAll(/«\s*([A-ZÀ-Ý][^»]*?[.?!])\s*»/g)].map((m) => m[1]);
}

test("monteur : la règle de vocabulaire du chat est écrite (aperçu, jamais planche, pixels ni coordonnées)", () => {
  const m = lire("agents/monteur.md").replace(/\s+/g, " ");
  assert.match(m, /Dans son studio, ce qu'il valide s'appelle \*\*l'aperçu\*\*/);
  assert.match(m, /jamais « planche » ni « vignette » dans ce que tu lui écris/);
  assert.match(m, /jamais en pixels, en coordonnées, en pourcentages d'écran ni en numéros d'image/);
  assert.match(m, /tu n'en parles jamais : dans le chat, il n'y a que « l'aperçu »/);
  assert.match(m, /pas « 35 pixels plus haut »/);
});

test("monteur : aucune phrase d'exemple du studio ne parle de planche, de vignette ni de pixels", () => {
  const m = lire("agents/monteur.md");
  const studio = section(m, "## Mode studio") + section(m, "**En mode studio : l'aperçu**");
  const phrases = phrasesExemples(studio);
  assert.ok(phrases.length >= 4, `phrases d'exemple trouvées : ${phrases.length}`);
  for (const p of phrases) assert.doesNotMatch(p, INTERDITS, p);
  assert.ok(phrases.includes("Ton aperçu est prêt dans Montage."));
  assert.ok(phrases.includes("Le titre est monté, au-dessus de ta tête."));
});

test("briques : la planche est dite outil interne dans le studio, jamais nommée dans le chat", () => {
  const rendu = lire("skills/rendu/SKILL.md").replace(/\s+/g, " ");
  assert.match(rendu, /Dans le studio, la personne ne voit que l'aperçu : la planche ne se montre pas et ne se nomme pas dans le chat\./);
  const plan = lire("skills/plan-montage/SKILL.md").replace(/\s+/g, " ");
  assert.match(plan, /dans le chat on dit toujours « l'aperçu », jamais « planche », « vignette » ni pixels/);
  for (const f of ["agents/monteur.md", "skills/rendu/SKILL.md", "skills/plan-montage/SKILL.md"]) {
    assert.ok(!lire(f).includes("—"), `${f} : pas de tiret long`);
  }
});
