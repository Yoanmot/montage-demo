// Une ressource générale (25/11/2026) : offerte sans contenu à elle, sa fiche vit dans ressources/<slug>.md du
// dépôt du head of content (règle de outils/commun.py de Romain, fiche_ressource). Un contenu qui l'offre
// (liaison, ou lien dans la section « Message automatique » de son script) la montre dans son dossier, avec
// son état lu sur le disque, comme une ressource née dans un contenu.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ficheRessource, ressourceDuContenu } from "../liaisons.mjs";
import { etatRessourceRapide } from "../ressources.mjs";

const SITE = "https://ressources.fitavecromain.com";
const G = "systeme-fit-avec-romain";

function depot() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "ressource-generale-"));
  const ecrire = (r, t) => { fs.mkdirSync(path.dirname(path.join(d, r)), { recursive: true }); fs.writeFileSync(path.join(d, r), t); };
  ecrire(`ressources/${G}.md`, "# Ressource gratuite : Le système Fit avec Romain\n");
  ecrire(`site/${G}/index.html`, "<!doctype html><title>Guide</title>\n");
  ecrire("contenus/reel-relie/idee.md", "# Un reel\n");
  ecrire("contenus/reel-relie/ressource-liee.json", JSON.stringify({ version: 1, ressource: G }));
  ecrire("contenus/reel-script/idee.md", "# Un autre reel\n");
  ecrire("contenus/reel-script/script.md", `# Script\n\n## Message automatique\n- Lien : ${SITE}/${G}/\n`);
  ecrire("contenus/reel-seul/idee.md", "# Sans ressource\n");
  return d;
}

test("la fiche d'une ressource générale est trouvée, celle d'un contenu passe avant", () => {
  const d = depot();
  try {
    assert.equal(ficheRessource(d, G), path.join(d, "ressources", `${G}.md`));
    assert.equal(ficheRessource(d, "inconnue"), null);
    assert.equal(ficheRessource(d, "../x"), null);
    fs.mkdirSync(path.join(d, "contenus", G), { recursive: true });
    fs.writeFileSync(path.join(d, "contenus", G, "ressource.md"), "# Fiche du contenu\n");
    assert.equal(ficheRessource(d, G), path.join(d, "contenus", G, "ressource.md"));
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test("un contenu relié à une ressource générale la montre, en ligne", () => {
  const d = depot();
  try {
    assert.equal(ressourceDuContenu(d, "reel-relie"), G);
    assert.equal(ressourceDuContenu(d, "reel-script", { site: SITE }), G, "lien du script, mot posé par le serveur");
    assert.equal(ressourceDuContenu(d, "reel-seul", { site: SITE }), null);
    assert.equal(etatRessourceRapide({ depot: d }, G), "en_ligne");
    fs.rmSync(path.join(d, "site", G), { recursive: true });
    assert.equal(etatRessourceRapide({ depot: d }, G), "fiche");
    fs.rmSync(path.join(d, "ressources", `${G}.md`));
    assert.equal(etatRessourceRapide({ depot: d }, G), null);
    assert.equal(ressourceDuContenu(d, "reel-script", { site: SITE }), null, "plus de fiche : plus offerte");
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});
