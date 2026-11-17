// Lot 13 (2026-11-17) : le plan de tournage s'affiche par type (face caméra, b-roll, photo), chaque prise
// garde son numéro (les coches et le rangement s'en servent).
import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { bulles } from "../tournage.mjs";

test("plan dans le désordre : bulles triées par type, numéros gardés, titre de l'idée", () => {
  const config = { depot: path.join(os.tmpdir(), "studio-lot13-absent") };
  const plan = { prises: [
    { n: 1, type: "b-roll", contenus: [{ slug: "a", usages: [{ mouvement: 1, phrase: "p" }] }], mouvements: ["tu marches"] },
    { n: 2, type: "photo", contenus: [{ slug: "b", usages: [] }], ce_qu_on_voit: "toi enfant" },
    { n: 3, type: "face", contenus: [{ slug: "a", usages: [] }] },
    { n: 4, type: "b-roll", contenus: [{ slug: "b", usages: [] }], mouvements: ["tu cours"] },
    { n: 5, type: "face", contenus: [{ slug: "b", usages: [] }] },
    { n: 6, type: "note" },
  ] };
  const b = bulles(config, plan, new Map([["a", "Idée A"], ["b", "Idée B"]]));
  assert.deepEqual(b.map((x) => [x.n, x.type]), [[3, "face"], [5, "face"], [1, "b-roll"], [4, "b-roll"], [2, "photo"]]);
  assert.equal(b[0].contenus[0].titre, "Idée A");
  assert.equal(b[0].script, null, "pas de script écrit : rien d'inventé");
});
