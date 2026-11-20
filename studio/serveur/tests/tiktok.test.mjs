// Lot 13 (TikTok) côté serveur : les sessions ne peuvent toujours rien poster (refus Bash de la nouvelle forme),
// le fichier du client prévoit son compte TikTok, la carte dit l'échec d'une seule plateforme.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { refusCommuns } from "../reglages.mjs";
import { chargerClient } from "../client.mjs";
import { libelle, stade } from "../stades.mjs";
import { listePlateformes, plateformesDe } from "../../publication/plateformes.mjs";

const ICI = path.dirname(fileURLToPath(import.meta.url));

// Même lecture qu'une règle Bash(...) de Claude Code : « * » vaut n'importe quelle suite de caractères.
function refusee(commande, refus) {
  return refus.some((r) => {
    const m = /^Bash\((.*)\)$/.exec(r);
    if (!m) return false;
    const re = new RegExp("^" + m[1].split("*").map((x) => x.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
    return re.test(commande);
  });
}

test("sessions : publier, réessayer, brancher le mot pour de vrai et l'accord TikTok sont refusés ; lire et simuler restent permis", () => {
  for (const id of ["romain", "yoan"]) {
    const refus = refusCommuns(chargerClient({ id }));
    const z = "python3 /Users/Shared/x/head-of-content/outils/zernio.py";
    for (const c of [
      `${z} publier faim --video v-monte.mp4 --plateformes instagram,tiktok --tiktok-consentement --quand "2099-01-01 18:30" --envoyer`,
      `${z} publier faim --video v-monte.mp4 --plateformes tiktok --maintenant --envoyer --pousser`,
      `${z} publier faim --video v-monte.mp4 --plateformes tiktok --maintenant --tiktok-consentement`,
      `${z} reessayer faim --plateforme tiktok --envoyer --pousser`,
      `cd outils && python3 zernio.py reessayer faim --plateforme instagram --envoyer`,
      `${z} poser-mot faim --ressource guide --envoyer`,
      `ZERNIO_ECRITURE=ia.yoan ${z} reessayer faim --plateforme tiktok`,
    ]) assert.ok(refusee(c, refus), `${id} : ${c}`);
    for (const c of [
      `${z} verifier faim --video v-monte.mp4 --plateformes instagram,tiktok`,
      `${z} publier faim --video v-monte.mp4 --plateformes instagram --quand "2099-01-01 18:30"`,
      `${z} reessayer faim --plateforme tiktok`,
      `${z} tiktok --format json`,
    ]) assert.ok(!refusee(c, refus), `${id} : ${c} devrait rester permis`);
  }
});

test("fichiers clients : le compte TikTok est prévu à côté du compte Instagram (null tant qu'il n'est pas relié)", () => {
  for (const f of ["romain.json", "yoan.json", "romain-test.json"]) {
    const c = JSON.parse(fs.readFileSync(path.join(ICI, "..", "..", "clients", f), "utf8"));
    assert.ok(Object.prototype.hasOwnProperty.call(c.zernio, "tiktok"), f);
    assert.equal(c.zernio.tiktok, null, f);
  }
});

test("registre : une entrée d'avant le lot 13 se lit comme Instagram ; l'échec d'une seule plateforme se voit dans l'étiquette", () => {
  const ancienne = { statut: "publié", zernio_post: "p", lien: "https://www.instagram.com/reel/A/", media_id: "1" };
  assert.deepEqual(Object.keys(plateformesDe(ancienne)), ["instagram"]);
  assert.equal(listePlateformes(ancienne)[0].lien, "https://www.instagram.com/reel/A/");
  const partielle = { statut: "publié", zernio_post: "p", plateformes: {
    tiktok: { statut: "failed", zernio_post: "p", erreur: "capacity" },
    instagram: { statut: "publié", zernio_post: "p", lien: "https://www.instagram.com/reel/B/" } } };
  assert.deepEqual(listePlateformes(partielle).map((x) => x.plateforme), ["instagram", "tiktok"], "ordre fixe");
  const s = stade({ slug: "x", format: "reel", etat: {} }, { dossier: true, publication: partielle }).stade;
  assert.equal(s, "publie");
  assert.equal(libelle(s, "reel", partielle), "publié, refusé sur TikTok");
  const deux = { statut: "publié", plateformes: { instagram: { statut: "publié" }, tiktok: { statut: "publié" } } };
  assert.equal(libelle("publie", "reel", deux), "publié");
  const tout = { statut: "failed", plateformes: { instagram: { statut: "failed" }, tiktok: { statut: "failed" } } };
  assert.equal(stade({ slug: "x", format: "reel", etat: {} }, { dossier: true, face: ["a-monte.mp4"], publication: tout }).stade, "monte",
    "tout refusé : le contenu revient prêt à poster");
});
