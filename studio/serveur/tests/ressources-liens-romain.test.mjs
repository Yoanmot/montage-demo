// Chez Romain (le serveur pose le mot, « ressources.mot » : « serveur ») : une même ressource reliée à plusieurs
// contenus (22/11/2026), chacun avec son mot, son message et son bouton, retouchables dans son dossier et au moment de
// poster. « Enregistrer » écrit la liaison ET l'entrée que lit son serveur (publications/a-brancher.json), au même
// commit, par les VRAIS outils de son head of content (zernio.py relier --attendre) ; jamais rien chez Zernio.
// Une ressource déjà offerte (mot en attente ou branché) ne bouge pas. Sauté si le dépôt de son head of content
// n'est pas à côté (HOC_ROMAIN_OUTILS pour un autre chemin). Le site est un petit serveur local : aucun réseau.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

delete process.env.STUDIO_CLIENT;
const { demarrer } = await import("../studio.mjs");
const { monde, depotGit, git } = await import("./aide.mjs");

const ICI = path.dirname(fileURLToPath(import.meta.url));
const OUTILS = process.env.HOC_ROMAIN_OUTILS || path.resolve(ICI, "../../../../../agents/head-of-content/depot/outils");
const PRESENTS = ["zernio.py", "ressource.py", "liaison.py", "commun.py"].every((n) => fs.existsSync(path.join(OUTILS, n)));
const SITE = "https://ressources.fitavecromain.com";
const R = "routine-du-soir";
const LIEN = `${SITE}/${R}/`;
const VERIF = String.raw`#!/usr/bin/env python3
import json, os, sys
with open(os.environ["FAUX_OUTILS_LOG"], "a") as f:
    f.write(json.dumps({"outil": "zernio.py (Mac)", "argv": sys.argv[1:]}) + "\n")
slug = sys.argv[2]
print("CONTENU %s (reel) sur @fitavecromain" % slug)
print("LEGENDE (contenus/%s/script.md, 10 caractères) :" % slug)
print("Commente !")
print("MOT aucun")
print("OK prêt")
`;
const SCRIPT_A = `# Ta routine du soir\n\n## Légende\nCommente SOIREE et je t'envoie ma routine.\n\n## Message automatique\n- Mot : SOIREE\n- Lien : ${LIEN}\n- Bouton : Ouvrir ma routine\n- Message :\n  > Salut {{first_name}}, voilà ta routine du soir.\n- Validé par Romain : 20/11/2026\n`;
const SCRIPT_C = `# Le téléphone au lit\n\n## Message automatique\n- Mot : ECRAN\n- Lien : ${LIEN}\n- Bouton : Ma routine\n- Message :\n  > Salut {{first_name}}, pose le téléphone.\n- Validé par Romain : 21/11/2026\n`;

let m, s, port, cookie, journal, site, distant;

function requete(chemin, { methode = "GET", corps } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: chemin, method: methode, headers: { Host: `127.0.0.1:${port}`, ...(cookie ? { Cookie: cookie } : {}),
      ...(methode !== "GET" ? { Origin: `http://127.0.0.1:${port}`, "Content-Type": "application/json" } : {}) } }, (res) => {
      const morceaux = [];
      res.on("data", (x) => morceaux.push(x));
      res.on("end", () => {
        const texte = Buffer.concat(morceaux).toString("utf8");
        let json = null;
        try { json = JSON.parse(texte); } catch { /* pas du JSON */ }
        resolve({ statut: res.statusCode, entetes: res.headers, texte, json });
      });
    });
    req.on("error", reject);
    if (corps !== undefined) req.write(JSON.stringify(corps));
    req.end();
  });
}

// Le fichier tel qu'il est en ligne (le dépôt distant), ou null.
const enLigne = (rel) => { try { return git(m.depot, "show", `origin/main:${rel}`); } catch { return null; } };
const motsEnLigne = () => JSON.parse(enLigne("publications/a-brancher.json")).mots;
const carte = async (slug) => (await requete(`/api/cartes/${slug}`)).json;
const ressource = async () => (await requete("/api/ressources")).json.ressources.find((x) => x.slug === R);
const DANS_3_JOURS = new Date(Date.now() + 3 * 86400e3).toISOString().slice(0, 10);

before(async () => {
  if (!PRESENTS) return;
  m = monde();
  journal = path.join(m.racine, "outils.jsonl");
  distant = depotGit(m);
  for (const n of ["zernio.py", "ressource.py", "liaison.py", "commun.py"]) m.ecrire(`depot/outils/${n}`, fs.readFileSync(path.join(OUTILS, n), "utf8"));
  m.ecrire("copie-mac/outils/zernio.py", VERIF);
  m.ecrire("depot/CLAUDE.md", "- **État : en ligne, https://ressources.fitavecromain.com**\n- **Message automatique (mot en commentaire) : en service**\n");
  m.ecrire(`depot/contenus/${R}/ressource.md`, `# Ressource gratuite : Ta routine du soir\n\n- Mot en commentaire : SOIREE\n- Statut : validée par Romain le 20/11/2026\n`);
  m.ecrire(`depot/site/${R}/index.html`, "<!doctype html><title>Ta routine du soir</title>\n");
  m.contenu(R, { titre: "Ta routine du soir (reel)" });
  m.ecrire(`depot/contenus/${R}/script.md`, SCRIPT_A);
  m.contenu("dormir-apres-la-salle", { titre: "Dormir après la salle" });
  m.ecrire("depot/contenus/dormir-apres-la-salle/script.md", "# Dormir après la salle\n\n## Légende\nCommente DORMIR.\n");
  m.contenu("le-telephone-au-lit", { titre: "Le téléphone au lit" });
  m.ecrire("depot/contenus/le-telephone-au-lit/script.md", SCRIPT_C);
  m.contenu("deja-poste", { titre: "Déjà posté" });
  m.ecrire("depot/contenus/deja-poste/script.md", "# Déjà posté\n");
  m.contenu("sans-ressource", { titre: "Sans ressource" });
  for (const slug of ["dormir-apres-la-salle", "deja-poste"]) m.ecrire(`Contenu/${slug}/face/rush-monte.mp4`, "video");
  // Déjà offerte avant ce lot : le mot du 1er reel attend sa vidéo, celui de « Déjà posté » est branché.
  m.json("depot/publications/a-brancher.json", { version: 1, mots: {
    [R]: { mot: "SOIREE", lien: LIEN, bouton: "Ouvrir ma routine", message: "Salut {{first_name}}, voilà ta routine du soir.", reponses: [],
      valide: "20/11/2026", source: `contenus/${R}/script.md`, prevu_le: "2026-11-24", cree_le: "2026-11-21T10:00:00Z", statut: "en attente" },
    "deja-poste": { mot: "NUITEE", lien: LIEN, bouton: "Ouvrir", message: "Salut {{first_name}}, la voilà.", reponses: [], valide: "19/11/2026",
      source: "contenus/deja-poste/script.md", cree_le: "2026-11-19T10:00:00Z", statut: "branché", video: "https://www.instagram.com/reel/AAA/", automatisation: "a1" },
  } });
  git(m.depot, "add", "-A");
  git(m.depot, "commit", "-q", "-m", "contenus");
  git(m.depot, "push", "-q", "origin", "main");
  // Le site, servi en local tel quel.
  site = http.createServer((req, res) => {
    const f = path.join(m.depot, "site", decodeURIComponent(req.url.split("?")[0]), "index.html");
    if (fs.existsSync(f)) { res.writeHead(200, { "Content-Type": "text/html" }); res.end(fs.readFileSync(f)); } else { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => site.listen(0, "127.0.0.1", r));
  Object.assign(process.env, { FAUX_OUTILS_LOG: journal, HOC_SITE_TEST: `http://127.0.0.1:${site.address().port}`, HOC_GH: "" });
  s = await demarrer({ env: { ...m.env, FAUX_OUTILS_LOG: journal }, silencieux: true });
  port = s.config.port;
  const r = await requete(`/?t=${s.jeton}`);
  cookie = r.entetes["set-cookie"][0].split(";")[0];
});

after(async () => {
  await s?.arreter("fin");
  site?.close();
  m?.nettoyer();
});

const t = (nom, f) => test(nom, { skip: !PRESENTS && "outils du head of content de Romain absents" }, f);

t("dossier : la ressource apparaît dans chaque contenu qui l'offre, y compris celui dont le script donne le lien ; sinon « aucune »", async () => {
  assert.equal(s.config.ressourcesMot, "serveur");
  for (const slug of [R, "le-telephone-au-lit"]) {
    const c = await carte(slug);
    assert.equal(c.ressource_slug, R, slug);
    assert.equal(c.ressource_url, LIEN);
  }
  const c = await carte("dormir-apres-la-salle");
  assert.ok(c.fichiers.includes("ressource"));
  assert.equal(c.ressource, "aucune");
});

t("liste : chaque contenu avec son mot, son message et où en est son mot chez le serveur ; les mots déjà offerts tels quels", async () => {
  const avant = motsEnLigne();
  const r = await ressource();
  assert.equal(r.liaisons, true);
  const par = Object.fromEntries(r.contenus.map((x) => [x.slug, x]));
  assert.deepEqual(Object.keys(par).sort(), [R, "le-telephone-au-lit"].sort());
  assert.equal(par[R].mot, "SOIREE");
  assert.equal(par[R].mot_serveur.etat, "en_attente");
  assert.equal(par["le-telephone-au-lit"].mot, "ECRAN");
  assert.equal(par["le-telephone-au-lit"].message, "Salut [son prénom], pose le téléphone.");
  assert.equal(par["le-telephone-au-lit"].mot_serveur.etat, "a_mettre");
  assert.deepEqual(motsEnLigne(), avant, "lire ne change rien");
});

t("Enregistrer dans le dossier : liaison et mot en attente au même push, par l'outil, l'autre contenu inchangé, jamais Zernio", async () => {
  const avant = motsEnLigne();
  const r = await requete("/api/ressources/relier", { methode: "POST", corps: { contenu: "dormir-apres-la-salle", ressource: R,
    mot: "dormir", message: "Salut [son prénom], la routine pour bien dormir après la salle.", bouton: "Dormir mieux" } });
  assert.equal(r.statut, 200, r.texte);
  const mots = motsEnLigne();
  assert.deepEqual(mots[R], avant[R], "le mot déjà en attente n'a pas bougé");
  assert.deepEqual(mots["deja-poste"], avant["deja-poste"], "le mot branché n'a pas bougé");
  const b = mots["dormir-apres-la-salle"];
  assert.deepEqual([b.mot, b.lien, b.bouton, b.statut], ["DORMIR", LIEN, "Dormir mieux", "en attente"]);
  assert.equal(b.message, "Salut {{first_name}}, la routine pour bien dormir après la salle.");
  const l = JSON.parse(enLigne("contenus/dormir-apres-la-salle/ressource-liee.json"));
  assert.equal(l.ressource, R);
  assert.equal(git(m.depot, "log", "-1", "--format=%s").trim(), `Studio : ressource ${R} reliée à dormir-apres-la-salle, mot en attente`);
  assert.deepEqual(git(m.depot, "show", "--name-only", "--format=", "HEAD").trim().split("\n").sort(),
    ["contenus/dormir-apres-la-salle/ressource-liee.json", "publications/a-brancher.json"]);
  const c = await carte("dormir-apres-la-salle");
  assert.equal(c.ressource_slug, R);
  const x = (await ressource()).contenus.find((y) => y.slug === "dormir-apres-la-salle");
  assert.deepEqual([x.mot, x.mot_serveur.etat, x.propre, x.valide], ["DORMIR", "en_attente", true, true]);
});

t("un mot qui attend déjà une autre vidéo, un mot branché : refusés avec une phrase claire, rien d'écrit", async () => {
  const tete = git(m.depot, "rev-parse", "HEAD").trim();
  const r = await requete("/api/ressources/relier", { methode: "POST", corps: { contenu: "le-telephone-au-lit", ressource: R, mot: "SOIREE",
    message: "Salut [son prénom], pose le téléphone.", bouton: "Ma routine" } });
  assert.equal(r.statut, 409, r.texte);
  assert.match(r.json.message, /attend déjà une autre de tes vidéos/);
  assert.doesNotMatch(r.json.message, /BLOQUE|zernio|a-brancher/i);
  m.json("depot/contenus/deja-poste/ressource-liee.json", { version: 1, ressource: R, mot: "NUITEE" });
  git(m.depot, "add", "-A"); git(m.depot, "commit", "-q", "-m", "liaison d'avant"); git(m.depot, "push", "-q", "origin", "main");
  const tete2 = git(m.depot, "rev-parse", "HEAD").trim();
  const o = await requete("/api/ressources/relier", { methode: "POST", corps: { contenu: "deja-poste", ressource: R, mot: "NUITEE", message: "Autre texte", bouton: "Ouvrir" } });
  assert.equal(o.statut, 409, o.texte);
  assert.match(o.json.message, /déjà branché sur ta vidéo/);
  const d = await requete("/api/ressources/delier", { methode: "POST", corps: { contenu: "deja-poste" } });
  assert.equal(d.statut, 409, d.texte);
  assert.equal(git(m.depot, "rev-parse", "HEAD").trim(), tete2);
  assert.notEqual(tete, tete2);
  assert.equal(motsEnLigne()["deja-poste"].statut, "branché");
});

t("au moment de poster : le mot et le message du contenu, retouchables ; rien à choisir, ni --ressource", async () => {
  const r = await requete("/api/publication/recap", { methode: "POST", corps: { elements: [{ slug: "dormir-apres-la-salle", quand: `${DANS_3_JOURS} 18:30` }] } });
  assert.equal(r.statut, 200, r.texte);
  assert.equal(r.json.ressources, undefined, "pas de liste à choisir");
  const e = r.json.elements[0];
  assert.equal(e.ressource, undefined);
  assert.deepEqual([e.mot_serveur.ressource, e.mot_serveur.mot, e.mot_serveur.bouton, e.mot_serveur.etat],
    [R, "DORMIR", "Dormir mieux", "en_attente"]);
  assert.equal(e.mot_serveur.message, "Salut [son prénom], la routine pour bien dormir après la salle.");
  assert.equal(e.mot_serveur.ressource_titre, "Ta routine du soir");
  const v = JSON.parse(fs.readFileSync(journal, "utf8").trim().split("\n").pop());
  assert.ok(!v.argv.includes("--ressource"));
  const sans = (await requete("/api/publication/recap", { methode: "POST", corps: { elements: [{ slug: "deja-poste", quand: `${DANS_3_JOURS} 18:30` }] } })).json.elements[0];
  assert.equal(sans.mot_serveur.offert, true, "branché : montré, plus retouchable");
});

t("Ne plus l'offrir : la liaison part, son mot en attente est retiré pour le serveur", async () => {
  const d = await requete("/api/ressources/delier", { methode: "POST", corps: { contenu: "dormir-apres-la-salle" } });
  assert.equal(d.statut, 200, d.texte);
  assert.equal(enLigne("contenus/dormir-apres-la-salle/ressource-liee.json"), null);
  assert.equal(motsEnLigne()["dormir-apres-la-salle"].statut, "retiré");
  assert.equal(motsEnLigne()[R].statut, "en attente");
  assert.equal((await carte("dormir-apres-la-salle")).ressource, "aucune");
});
