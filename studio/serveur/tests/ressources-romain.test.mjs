// Chez Romain (client par défaut, pas de site de ressources réglé) : les ajouts des ressources gratuites
// (studio de Yoan, lot 4B/4C) restent invisibles. Ni entrée, ni fichier, ni route, ni outil lancé.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

delete process.env.STUDIO_CLIENT;
const { demarrer } = await import("../studio.mjs");
const { monde } = await import("./aide.mjs");

let m, s, port, cookie, journal;

function requete(chemin, { methode = "GET", corps } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: chemin, method: methode, headers: { Host: `127.0.0.1:${port}`, ...(cookie ? { Cookie: cookie } : {}),
      ...(methode !== "GET" ? { Origin: `http://127.0.0.1:${port}`, "Content-Type": "application/json" } : {}) } }, (res) => {
      const morceaux = [];
      res.on("data", (x) => morceaux.push(x));
      res.on("end", () => resolve({ statut: res.statusCode, entetes: res.headers, texte: Buffer.concat(morceaux).toString("utf8") }));
    });
    req.on("error", reject);
    if (corps !== undefined) req.write(JSON.stringify(corps));
    req.end();
  });
}

before(async () => {
  m = monde();
  journal = path.join(m.racine, "outils.jsonl");
  const faux = `#!/usr/bin/env python3\nimport sys\nopen(${JSON.stringify(journal)}, "a").write(" ".join(sys.argv) + "\\n")\n`;
  for (const n of ["ressource.py", "zernio.py"]) m.ecrire(`depot/outils/${n}`, faux);
  m.contenu("un-reel", { titre: "Un reel" });
  m.ecrire("depot/contenus/un-reel/ressource.md", "# Une ressource\n");
  m.ecrire("depot/contenus/fiche-seule/ressource.md", "# Fiche seule\n");
  s = await demarrer({ env: m.env, silencieux: true });
  port = s.config.port;
  const r = await requete(`/?t=${s.jeton}`);
  cookie = r.entetes["set-cookie"][0].split(";")[0];
});

after(async () => {
  await s?.arreter("fin");
  m?.nettoyer();
});

test("Romain : pas de ressources dans l'état, pas de fichier « Ressource gratuite », dossiers comme avant", async () => {
  assert.equal(s.config.client.id, "romain");
  const e = JSON.parse((await requete("/api/etat")).texte);
  assert.equal(e.config.ressources, false);
  const c = e.cartes.find((x) => x.slug === "un-reel");
  assert.ok(!c.fichiers.includes("ressource"));
  assert.ok(!("ressource" in c));
  assert.ok(e.cartes.some((x) => x.slug === "fiche-seule"), "comportement d'avant : le dossier reste une carte");
});

test("Romain : routes des ressources fermées, aucun outil lancé", async () => {
  assert.equal((await requete("/api/ressources")).statut, 404);
  assert.equal((await requete("/api/ressources/un-reel/apercu")).statut, 404);
  assert.equal((await requete("/api/ressources/fiche-seule/supprimer", { methode: "POST", corps: {} })).statut, 404);
  assert.ok(fs.existsSync(path.join(m.depot, "contenus", "fiche-seule", "ressource.md")), "rien n'est effacé chez Romain");
  assert.ok(!fs.existsSync(journal), "aucun outil des ressources n'a tourné");
});

test("Romain : « préviens Yoan » reste tel quel", async () => {
  const r = await requete("/api/cartes/inconnu-du-tout");
  assert.equal(r.statut, 404);
  const { adresser } = await import("../client.mjs");
  assert.equal(adresser("Réessaie, et si ça recommence, préviens Yoan."), "Réessaie, et si ça recommence, préviens Yoan.");
});
