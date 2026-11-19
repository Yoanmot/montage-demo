import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { telechargerVideo } from "../telecharger.mjs";
import { arriveesPertinentes } from "../../rangement/lib/commun.mjs";
import { monde } from "./aide.mjs";

const mondes = [];
after(() => mondes.forEach((m) => m.nettoyer()));

test("télécharger la vidéo : la plus récente, dans Téléchargements, jamais reprise par le rangement", async () => {
  const m = monde();
  mondes.push(m);
  m.contenu("tier-list");
  m.ecrire("Contenu/tier-list/face/IMG_1-monte.mp4", "ancienne");
  const vieux = new Date(Date.now() - 60000);
  fs.utimesSync(path.join(m.media, "tier-list/face/IMG_1-monte.mp4"), vieux, vieux);
  m.ecrire("Contenu/tier-list/face/IMG_1-monte-2.mp4", "nouvelle");
  const config = { ...m.config, maison: m.maison };
  const avant = Date.now() - 1000;

  const r = await telechargerVideo(config, "tier-list", { montrer: false });
  assert.equal(r.nom, "tier-list.mp4");
  const dl = path.join(m.maison, "Downloads");
  assert.equal(fs.readFileSync(path.join(dl, "tier-list.mp4"), "utf8"), "nouvelle");
  assert.deepEqual(fs.readdirSync(dl).filter((n) => n.startsWith(".")), [], "aucun fichier partiel laissé");

  const r2 = await telechargerVideo(config, "tier-list", { montrer: false });
  assert.equal(r2.nom, "tier-list-2.mp4", "jamais d'écrasement");

  process.env.ARRIVEES_CALME_S = "0";
  try {
    const a = arriveesPertinentes(dl, avant);
    assert.deepEqual([...a.fichiers, ...a.en_cours].map((x) => x.nom), [], "le rangement ne la voit pas comme une arrivée");
  } finally { delete process.env.ARRIVEES_CALME_S; }

  assert.equal(await telechargerVideo(config, "sans-video", { montrer: false }), null);
});
