// Tests du skill carrousel-yoan : node --test skills/carrousel-yoan/tests/*.test.mjs
// La conversion du texte (format du head of content) et la coupe des titres ; un rendu réel si Chrome est là.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { versSpec, meilleureCoupe, mots } from "../scripts/carrousel.mjs";

const ICI = path.dirname(fileURLToPath(import.meta.url));

test("versSpec : chaque gabarit du head of content devient la slide du moteur, sans changer un mot", () => {
  const { spec, ignores } = versSpec({ slides: [
    { gabarit: "hook", titre: "Un titre", texte: "La sous-ligne." },
    { gabarit: "corps", titre: "Corps", texte: "Le **lead**.\n\nUn support.", punch: "Court." },
    { gabarit: "steps", titre: "Étapes", texte: "", etapes: [{ texte: "Une", icone: "loupe" }, { texte: "Deux" }], closer: "Fin." },
    { gabarit: "cta", titre: "Appel", texte: "Une ligne.", action: "Enregistre ce post." },
  ] }, "/tmp/x", { slides: { 1: { titre: "UN\nTITRE" }, 2: { titre: "Autre titre" }, 3: { icones: ["loupe"] } } });
  assert.deepEqual(spec.slides[0], { k: 1, type: "hook", titre: "UN\nTITRE", sous: "La sous-ligne." });
  assert.deepEqual(spec.slides[1], { k: 2, type: "corps", titre: "Corps", corps: ["Le **lead**.", "Un support.", "!!Court."] });
  assert.deepEqual(spec.slides[2].etapes, [{ txt: "Une", icon: "loupe" }, "Deux"]);
  assert.deepEqual(spec.slides[2].apres, ["Fin."]);
  assert.deepEqual(spec.slides[3], { k: 4, type: "cta", titre: "Appel", sous: "Une ligne.", apres: ["!!Enregistre ce post."] });
  assert.match(ignores[0], /IGNORE mise-en-page slide 2/);
});

test("coupe des titres : moins de lignes possible, équilibrées, jamais un petit mot en fin de ligne", () => {
  const m = mots("Tu crées tes **meilleures idées** de contenu");
  assert.deepEqual(m, ["Tu", "crées", "tes", "**meilleures idées**", "de", "contenu"]);
  // Tout tient sur une ligne : une seule ligne.
  assert.deepEqual(meilleureCoupe([100, 100, 100], 10, ["a", "b", "c"], 500, 3), []);
  // Deux lignes équilibrées, sans finir sur « de ».
  const ms = ["Le", "contenu", "de", "ton", "coaching", "vaut", "de", "l'or"];
  const c = meilleureCoupe([80, 200, 80, 90, 260, 120, 80, 100], 20, ms, 800, 3);
  assert.equal(c.length, 1);
  assert.ok(!["de", "ton"].includes(ms[c[0] - 1]), `coupe après « ${ms[c[0] - 1]} »`);
});

const CHROME = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]
  .find((p) => fs.existsSync(p));

test("essai : une slide 1080 × 1350 rendue dans la DA", { skip: !CHROME && "pas de navigateur" }, () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "carrousel-yoan-test-"));
  try {
    const r = spawnSync(process.execPath, [path.join(ICI, "../scripts/carrousel.mjs"), "essai", d],
      { encoding: "utf8", env: { ...process.env, STUDIO_RACINE: d } });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /SLIDE 1 OK/);
    const png = fs.readFileSync(path.join(d, "slide-01.png"));
    assert.equal(png.readUInt32BE(16), 1080);
    assert.equal(png.readUInt32BE(20), 1350);
    assert.ok(fs.existsSync(path.join(d, "planche.jpg")));
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});
