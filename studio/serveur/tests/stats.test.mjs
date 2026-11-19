// Chiffres Instagram de la vue d'ensemble (contrat, section 15) : jamais d'appel réseau en test,
// jamais en simulation ; un fichier local ou un faux zernio.py dans la copie du Mac.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { Stats, ajouterReleve, variationAbonnes, sourceStats, parFormat, fenetreSemaines } from "../stats.mjs";
import { chargerConfig } from "../config.mjs";
import { demarrer } from "../studio.mjs";
import { monde, attendreQue } from "./aide.mjs";
import { jourZurich, ajouterJours } from "../outils.mjs";

const EXEMPLE = (abonnes = 1834) => ({
  version: 1, compte: "test", le: new Date().toISOString(), exemple: true, abonnes,
  compte_28j: { vues: 52000, portee: 21000, visites_profil: 640, interactions: null, comptes_engages: null },
  compte_28j_avant: { vues: 40000, portee: 18000, visites_profil: 500, interactions: null, comptes_engages: null },
  normale_vues: { reel: 1100, carrousel: null }, publications_30j: 5, vues_publications_30j: 7900,
  publications: [
    { le: "2026-11-14T17:30:00Z", type: "reel", sujet: "Sujet A", lien: "https://www.instagram.com/reel/a/", slug: "faim-a-16h", vues: 900, x_vues: null, comparable: false },
    { le: "2026-11-08T17:30:00Z", type: "reel", sujet: "Sujet B", lien: "javascript:alert(1)", slug: null, vues: 4000, x_vues: 3.64, comparable: true },
  ],
});

test("relevés des abonnés : un par jour, variation sur 30 jours ou partielle", () => {
  let h = ajouterReleve([], "2026-10-01", 1500);
  h = ajouterReleve(h, "2026-10-01", 1510);
  h = ajouterReleve(h, "2026-10-20", 1600);
  h = ajouterReleve(h, "2026-11-16", 1834);
  h = ajouterReleve(h, "pas-un-jour", 9);
  h = ajouterReleve(h, "2026-11-17", null);
  assert.deepEqual(h.map((x) => x.abonnes), [1510, 1600, 1834]);
  assert.deepEqual(variationAbonnes(h, "2026-11-16"), { valeur: 324, depuis: "2026-10-01", partielle: false });
  assert.deepEqual(variationAbonnes(h.slice(1), "2026-11-16"), { valeur: 234, depuis: "2026-10-20", partielle: true });
  assert.equal(variationAbonnes(h.slice(2), "2026-11-16"), null);
});

test("simulation sans fichier : aucune lecture, chiffres absents avec une phrase", async () => {
  const m = monde();
  try {
    let lu = 0;
    const s = new Stats({ config: m.config, lire: async () => { lu++; return EXEMPLE(); } });
    assert.equal(sourceStats(m.config), null);
    assert.equal(s.perime(), false);
    const v = await s.actualiser();
    assert.equal(lu, 0);
    assert.equal(v.disponible, false);
    assert.match(v.erreur, /studio d'essai/);
  } finally { m.nettoyer(); }
});

test("fichier local : cache, relevé du jour, titres des contenus, liens sûrs seulement", async () => {
  const m = monde();
  try {
    const hier = ajouterJours(jourZurich(), -40);
    m.json("stats-exemple.json", { ...EXEMPLE(), historique_abonnes: [{ jour: hier, abonnes: 1700 }] });
    fs.writeFileSync(path.join(m.home, "studio.config.json"), JSON.stringify({ ...JSON.parse(fs.readFileSync(path.join(m.home, "studio.config.json"))), stats: { fichier: path.join(m.racine, "stats-exemple.json") } }));
    const config = chargerConfig({ home: m.home, env: m.env });
    const s = new Stats({ config });
    assert.equal(s.perime(), true);
    await s.actualiser();
    assert.equal(s.perime(), false);
    const v = s.vue(new Map([["faim-a-16h", "Pourquoi tu as faim à 16 h"]]));
    assert.equal(v.disponible, true);
    assert.equal(v.exemple, true);
    assert.equal(v.abonnes, 1834);
    assert.deepEqual(v.variation_abonnes, { valeur: 134, depuis: hier, partielle: false });
    assert.equal(v.historique.length, 2);
    assert.equal(v.publications[0].titre, "Pourquoi tu as faim à 16 h");
    assert.equal(v.publications[1].titre, "Sujet B");
    assert.equal(v.publications[1].lien, null);
    assert.ok(fs.existsSync(path.join(m.home, "stats", "cache.json")));
    // Fichier devenu illisible : on garde les chiffres d'avant, avec une phrase.
    fs.writeFileSync(path.join(m.racine, "stats-exemple.json"), "pas du json");
    const v2 = await s.actualiser();
    assert.equal(v2.abonnes, 1834);
    assert.match(v2.erreur, /chiffres d'avant/);
  } finally { m.nettoyer(); }
});

test("hors simulation : zernio.py de la copie du Mac, en lecture seule (--format json --sortie -)", async () => {
  const m = monde({ config: { publication: { simulation: false, heures_par_defaut: {}, jours_par_defaut: [] } } });
  try {
    const log = path.join(m.racine, "zernio-args.json");
    m.ecrire("copie-mac/outils/zernio.py", `import json, os, sys
open(${JSON.stringify(log)}, "w").write(json.dumps({"argv": sys.argv[1:], "ecriture": os.environ.get("ZERNIO_ECRITURE_ROMAIN")}))
print("une ligne avant")
print(${JSON.stringify(JSON.stringify(EXEMPLE(2000)))})
`);
    const env = { ...m.env };
    delete env.STUDIO_SIMULATION;
    const config = chargerConfig({ home: m.home, env });
    assert.equal(sourceStats(config), "instagram");
    const s = new Stats({ config });
    const v = await s.actualiser();
    assert.equal(v.abonnes, 2000);
    const appel = JSON.parse(fs.readFileSync(log, "utf8"));
    // Lot 11 : cache vide, les 52 semaines (la plus ancienne d'abord).
    assert.deepEqual(appel.argv, ["stats", "--jours", "30", "--format", "json", "--sortie", "-", "--semaines-depuis", fenetreSemaines()[0]]);
    assert.equal(appel.ecriture, null);
  } finally { m.nettoyer(); }
});

test("simulation avec STUDIO_STATS_INSTAGRAM=1 (test de Yoan) : vrais chiffres en lecture seule", async () => {
  const m = monde();
  try {
    const log = path.join(m.racine, "zernio-args.json");
    m.ecrire("copie-mac/outils/zernio.py", `import json, os, sys
open(${JSON.stringify(log)}, "w").write(json.dumps({"argv": sys.argv[1:], "ecriture": os.environ.get("ZERNIO_ECRITURE_ROMAIN")}))
print(${JSON.stringify(JSON.stringify(EXEMPLE(2100)))})
`);
    assert.equal(sourceStats(chargerConfig({ home: m.home, env: m.env })), null);
    const config = chargerConfig({ home: m.home, env: { ...m.env, STUDIO_STATS_INSTAGRAM: "1" } });
    assert.equal(config.simulation, true);
    assert.equal(sourceStats(config), "instagram");
    const v = await new Stats({ config }).actualiser();
    assert.equal(v.abonnes, 2100);
    const appel = JSON.parse(fs.readFileSync(log, "utf8"));
    assert.equal(appel.argv[0], "stats");
    assert.equal(appel.ecriture, null);
  } finally { m.nettoyer(); }
});

test("route GET /api/stats et événement stats", async () => {
  const m = monde();
  const hote = () => `127.0.0.1:${m.config.port}`;
  m.json("stats-exemple.json", EXEMPLE());
  const brut = JSON.parse(fs.readFileSync(path.join(m.home, "studio.config.json")));
  fs.writeFileSync(path.join(m.home, "studio.config.json"), JSON.stringify({ ...brut, stats: { fichier: path.join(m.racine, "stats-exemple.json") } }));
  const s = await demarrer({ env: m.env, silencieux: true });
  const req = (methode, chemin, cookie) => new Promise((resolve, reject) => {
    const r = http.request({ host: "127.0.0.1", port: m.config.port, method: methode, path: chemin,
      headers: { Host: hote(), Origin: `http://${hote()}`, ...(cookie ? { Cookie: cookie } : {}) } }, (res) => {
      let t = ""; res.on("data", (d) => { t += d; }); res.on("end", () => resolve({ statut: res.statusCode, entetes: res.headers, json: t ? JSON.parse(t) : null }));
    });
    r.on("error", reject); r.end();
  });
  try {
    assert.equal((await req("GET", "/api/stats")).statut, 401);
    const r = await req("GET", `/?t=${s.jeton}`);
    const cookie = String(r.entetes["set-cookie"]).split(";")[0];
    const premier = await req("GET", "/api/stats", cookie);
    assert.equal(premier.statut, 200);
    await attendreQue(async () => (await req("GET", "/api/stats", cookie)).json.disponible);
    const v = await req("POST", "/api/stats/actualiser", cookie);
    assert.equal(v.json.compte_28j.vues, 52000);
    assert.equal(v.json.source, "fichier");
    // Un nouveau plan de tournage arrive dans la liste sans recharger la page (événement « tournages »).
    const evenements = [];
    const sse = http.request({ host: "127.0.0.1", port: m.config.port, path: "/api/evenements", headers: { Host: hote(), Cookie: cookie } });
    sse.on("response", (res) => { res.setEncoding("utf8"); res.on("data", (x) => evenements.push(x)); });
    sse.on("error", () => {}); sse.end();
    await attendreQue(() => evenements.length > 0);
    m.contenu("faim-a-16h");
    m.json("depot/tournages/2026-11-16-1400.json", { version: 1, id: "2026-11-16-1400", cree_le: "2026-11-16T14:00:00+01:00", contenus: ["faim-a-16h"], duree_estimee_min: 20, prises: [] });
    s.app.rafraichir();
    await attendreQue(() => evenements.join("").includes("event: tournages"));
    assert.match(evenements.join(""), /"id":"2026-11-16-1400"/);
    sse.destroy();
  } finally {
    await s.arreter("test");
    m.nettoyer();
  }
});

test("simulation avec stats.instagram_en_simulation dans la config : vrais chiffres en lecture seule", () => {
  const m = monde();
  try {
    assert.equal(sourceStats(chargerConfig({ home: m.home, env: m.env })), null);
    const f = path.join(m.home, "studio.config.json");
    const brut = JSON.parse(fs.readFileSync(f, "utf8"));
    fs.writeFileSync(f, JSON.stringify({ ...brut, stats: { ...(brut.stats || {}), instagram_en_simulation: true } }));
    const config = chargerConfig({ home: m.home, env: m.env });
    assert.equal(config.simulation, true);
    assert.equal(sourceStats(config), "instagram");
  } finally { m.nettoyer(); }
});

test("stats par format (lot 10) : toutes les publications des 30 jours, reels et carrousels séparés, rien d'inventé", async () => {
  const m = monde();
  try {
    // 14 publications (avant le lot 10, seules les 6 premières arrivaient à l'interface) : 10 reels, 4 carrousels, une sans chiffre.
    const pubs = Array.from({ length: 14 }, (_, i) => ({ le: `2026-11-${String(16 - i).padStart(2, "0")}T17:30:00Z`, type: i % 3 === 2 ? "carrousel" : "reel",
      sujet: `Sujet ${i}`, lien: null, slug: null, vues: i === 4 ? null : 1000 + i, x_vues: null, comparable: false }));
    m.json("stats-exemple.json", { ...EXEMPLE(), normale_vues: { reel: 1100, carrousel: null }, publications: pubs });
    fs.writeFileSync(path.join(m.home, "studio.config.json"), JSON.stringify({ ...JSON.parse(fs.readFileSync(path.join(m.home, "studio.config.json"))), stats: { fichier: path.join(m.racine, "stats-exemple.json") } }));
    const s = new Stats({ config: chargerConfig({ home: m.home, env: m.env }) });
    await s.actualiser();
    const v = s.vue();
    assert.equal(v.publications.length, 14);
    assert.equal(v.formats.reel.publications, 10);
    assert.equal(v.formats.carrousel.publications, 4);
    const reels = pubs.filter((p) => p.type === "reel" && typeof p.vues === "number");
    assert.equal(v.formats.reel.vues, reels.reduce((a, p) => a + p.vues, 0), "la publication sans chiffre n'est pas comptée comme 0");
    assert.equal(v.formats.reel.normale, 1100);
    assert.equal(v.formats.carrousel.normale, null, "normale absente : absente, pas 0");
    // Aucun chiffre lu : formats vides, vues absentes.
    assert.deepEqual(parFormat([], null), { reel: { publications: 0, vues: null, normale: null }, carrousel: { publications: 0, vues: null, normale: null } });
    assert.equal(parFormat(Array.from({ length: 80 }, () => ({ type: "reel", vues: 1 })), {}).reel.publications, 80);
  } finally { m.nettoyer(); }
});
