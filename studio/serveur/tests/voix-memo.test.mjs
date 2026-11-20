// La voix d'un reel en plans filmés avec sa voix, en mémo vocal (2026-11-20) : la vérification du plan de tournage
// compte le mémo comme la vidéo de sa voix, seulement quand un reel du plan l'attend. Sans ça, un fichier audio de ses
// Téléchargements ne compte jamais.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { verifierArrivees, receptionDuPlan } from "../tournage.mjs";

process.env.ARRIVEES_CALME_S = "0";
const R = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "voix-memo-serveur-")));
after(() => fs.rmSync(R, { recursive: true, force: true }));
const ecrire = (p, t) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, t); };

function monde(nom, genre) {
  const racine = path.join(R, nom);
  const config = { depot: path.join(racine, "depot"), media: path.join(racine, "Contenu"), arrivees: path.join(racine, "arrivees"), home: racine };
  ecrire(path.join(config.depot, "contenus", "genoux", "etat.json"), JSON.stringify({ version: 1, titre: "Genoux", format: "reel", genre }));
  ecrire(path.join(config.depot, "contenus", "genoux", "script.md"), "# Genoux\n\n## Texte complet\nTes genoux rentrent au squat.\n");
  ecrire(path.join(config.arrivees, "Nouvel enregistrement.m4a"), "voix");
  const plan = { id: "p", cree_le: "2000-01-01T00:00:00+01:00", prises: [{ n: 1, type: "face", contenus: [{ slug: "genoux" }] }] };
  return { config, plan };
}

test("plans-voix : le mémo vocal compte comme la voix attendue", () => {
  const { config, plan } = monde("voix", "plans-voix");
  const r = verifierArrivees(config, plan, { sautees: [] });
  assert.deepEqual([r.attendu.videos, r.recu.videos, r.complet], [1, 1, true], r.message);
  assert.deepEqual(receptionDuPlan(config, plan).recus.map((f) => [f.nom, f.type]), [["Nouvel enregistrement.m4a", "audio"]]);
});

test("face caméra : un mémo vocal ne compte pas", () => {
  const { config, plan } = monde("face", "face-camera");
  const r = verifierArrivees(config, plan, { sautees: [] });
  assert.deepEqual([r.recu.videos, r.complet], [0, false]);
  assert.deepEqual(receptionDuPlan(config, plan).recus, []);
});
