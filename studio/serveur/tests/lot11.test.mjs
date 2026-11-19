// Lot 11 du studio de Yoan : le tableau de bord semaine par semaine. Découpage en semaines (lundi, heure de Zurich,
// changement d'heure), cache des semaines figées, lecture du compteur des visites des ressources (faux serveur local),
// périodes de l'interface. Aucun appel réseau réel.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { monde } from "./aide.mjs";
import { chargerConfig, defautsDuClient } from "../config.mjs";
import { chargerClient } from "../client.mjs";
import { jourZurich, lundiDe, ajouterJours } from "../outils.mjs";
import { Stats, fenetreSemaines, semaineFigee, relireDepuis, fusionnerSemaines, lireVisites, semainesVue, SEMAINES } from "../stats.mjs";
import { PERIODES, periode, resumer, plageSemaine, dateSemaine } from "../../interface/app/tableau.js";

const sem = (debut, vals = {}, lu_le = null) => ({ debut, vues: 10, portee: 5, visites_profil: 1, likes: 2, publications: 1, ...vals, ...(lu_le ? { lu_le } : {}) });

test("semaines : lundi de Zurich, changement d'heure fin octobre, 52 semaines", () => {
  // Dimanche 25 octobre 2026, fin de l'heure d'été : 23 h 30 à Zurich est encore dimanche (UTC+1).
  assert.equal(lundiDe(jourZurich(new Date("2026-10-25T22:30:00Z"))), "2026-10-19");
  assert.equal(lundiDe(jourZurich(new Date("2026-10-25T23:30:00Z"))), "2026-10-26");
  assert.equal(lundiDe(jourZurich(new Date("2026-10-24T22:30:00Z"))), "2026-10-19"); // 0 h 30 dimanche, heure d'été
  const f = fenetreSemaines("2026-10-27");
  assert.equal(f.length, SEMAINES);
  assert.equal(f.at(-1), "2026-10-26");
  assert.equal(f.at(-2), "2026-10-19");
  for (let k = 1; k < f.length; k++) assert.equal(ajouterJours(f[k - 1], 7), f[k]);
  assert.ok(f.every((l) => lundiDe(l) === l));
  assert.equal(fenetreSemaines("2026-11-19")[0], "2025-11-24");
});

test("semaines figées 3 jours après leur dimanche, relues sinon ; une semaine en erreur n'est jamais figée", () => {
  assert.equal(semaineFigee(sem("2026-11-09", {}, "2026-11-17")), false); // mardi : dimanche + 2
  assert.equal(semaineFigee(sem("2026-11-09", {}, "2026-11-18")), true); // mercredi : dimanche + 3
  assert.equal(semaineFigee({ ...sem("2026-11-09", {}, "2026-11-20"), erreur: true }), false);
  assert.equal(semaineFigee(sem("2026-11-09")), false);
  const auj = "2026-11-19";
  assert.equal(relireDepuis([], auj), fenetreSemaines(auj)[0]); // première fois : 52 semaines
  const toutes = fenetreSemaines(auj).map((l) => sem(l, {}, auj));
  // Lu aujourd'hui (jeudi 19) : jusqu'à la semaine du 9 (dimanche 15 + 3 = 18) figée ; la semaine en cours reste à relire.
  assert.equal(relireDepuis(toutes, auj), "2026-11-16");
  const trou = toutes.map((s) => (s.debut === "2026-03-02" ? { ...s, erreur: true } : s));
  assert.equal(relireDepuis(trou, auj), "2026-03-02");
});

test("fusion des semaines : une semaine figée ne bouge plus, la lecture récente remplace, fenêtre de 52", () => {
  const auj = "2026-11-19";
  const anciennes = [sem("2026-11-02", { vues: 100 }, "2026-11-12"), sem("2026-11-09", { vues: 50 }, "2026-11-16"), sem("2024-01-01", {}, "2024-02-01")];
  const lues = [sem("2026-11-02", { vues: 999 }), sem("2026-11-09", { vues: 70, likes: null }), sem("2026-11-16", { vues: 3 }), { debut: "2026-11-17", vues: 1 }];
  const r = fusionnerSemaines(anciennes, lues, auj, auj);
  assert.deepEqual(r.map((s) => s.debut), ["2026-11-02", "2026-11-09", "2026-11-16"]);
  assert.equal(r[0].vues, 100); // figée
  assert.equal(r[1].vues, 70);
  assert.equal(r[1].likes, null); // absent, pas zéro
  assert.equal(r[1].lu_le, auj);
  assert.equal(r[2].vues, 3);
});

test("vue des semaines : absent = null, visites des ressources absentes avant le début du comptage", () => {
  const auj = "2026-11-19";
  const v = semainesVue([sem("2026-11-09", { vues: 0 })], { debut: "2026-11-09", semaines: { "2026-11-16": 4 } }, auj);
  assert.equal(v.length, 52);
  const [a, b, c] = v.slice(-3);
  assert.equal(a.vues, null);
  assert.equal(b.vues, 0);
  assert.equal(c.en_cours, true);
  assert.equal(a.visites_ressources, null); // avant la pose du compteur
  assert.equal(b.visites_ressources, 0); // compté, aucune visite
  assert.equal(c.visites_ressources, 4);
  assert.equal(c.fin, "2026-11-22");
  assert.ok(semainesVue([], null, auj).every((s) => s.visites_ressources === null && s.vues === null));
});

// Un faux compteur local : il note chaque requête et rend la réponse du scénario.
function fauxCompteur(reponse) {
  const requetes = [];
  const s = http.createServer((req, res) => {
    requetes.push({ url: req.url, auth: req.headers.authorization });
    const [statut, corps] = typeof reponse === "function" ? reponse(req) : reponse;
    res.writeHead(statut, { "Content-Type": "application/json" });
    res.end(typeof corps === "string" ? corps : JSON.stringify(corps));
  });
  return new Promise((ok) => s.listen(0, "127.0.0.1", () => ok({ url: `http://127.0.0.1:${s.address().port}/api/visites/`, requetes, fermer: () => s.close() })));
}

test("compteur des visites : réponse lue, clé en Bearer depuis le fichier, 401, sans clé, format inconnu, adresse refusée", async () => {
  const m = monde();
  try {
    const cleFichier = path.join(m.racine, "ressources.env");
    fs.writeFileSync(cleFichier, "# clé de lecture\nVISITES_RESSOURCES_CLE=\"cle-de-test\"\n");
    const f = await fauxCompteur((req) => (req.headers.authorization === "Bearer cle-de-test"
      ? [200, { version: 1, le: "2026-11-19T10:00:00Z", semaines: [{ debut: "2026-11-09", visites: 0, pages: {} }, { debut: "2026-11-16", visites: 7, pages: { monteur: 7 } }] }]
      : [401, { erreur: "non autorisé" }]));
    try {
      const v = { url: f.url, cleFichier, cleVariable: "VISITES_RESSOURCES_CLE" };
      const r = await lireVisites(v, "2026-11-09", { env: {} });
      assert.deepEqual(r.semaines, { "2026-11-09": 0, "2026-11-16": 7 });
      assert.equal(f.requetes[0].url, "/api/visites/?depuis=2026-11-09");
      assert.equal(f.requetes[0].auth, "Bearer cle-de-test");
      // La variable d'environnement passe avant le fichier.
      await assert.rejects(lireVisites(v, "2026-11-09", { env: { VISITES_RESSOURCES_CLE: "mauvaise" } }), (e) => e.code === "CLE");
      assert.deepEqual(await lireVisites({ ...v, cleFichier: path.join(m.racine, "absent.env") }, "2026-11-09", { env: {} }), { etat: "pas_mesure" });
      await assert.rejects(lireVisites({ ...v, url: "http://exemple.com/api/visites/" }, "2026-11-09", { env: {} }), (e) => e.code === "ADRESSE");
    } finally { f.fermer(); }
    const h = await fauxCompteur([503, { erreur: "stockage pas branché" }]);
    try {
      assert.deepEqual(await lireVisites({ url: h.url, cleFichier }, "2026-11-09", { env: {} }), { etat: "pas_mesure" });
    } finally { h.fermer(); }
    const g = await fauxCompteur([200, { autre: true }]);
    try {
      await assert.rejects(lireVisites({ url: g.url, cleFichier }, "2026-11-09", { env: {} }), (e) => e.code === "FORMAT");
    } finally { g.fermer(); }
  } finally { m.nettoyer(); }
});

test("Stats : 52 semaines la première fois, puis seulement les récentes ; visites lues et jamais la clé au journal", async () => {
  const m = monde();
  try {
    const cleFichier = path.join(m.racine, "ressources.env");
    fs.writeFileSync(cleFichier, "VISITES_RESSOURCES_CLE=cle-secrete-123\n");
    const auj = jourZurich();
    const f = await fauxCompteur((req) => [200, { version: 1, le: new Date().toISOString(), semaines: [{ debut: lundiDe(auj), visites: 3, pages: {} }] }]);
    try {
      const brut = JSON.parse(fs.readFileSync(path.join(m.home, "studio.config.json")));
      brut.stats = { visites_ressources: { url: f.url, debut: auj, cle_fichier: cleFichier, cle_variable: "VISITES_RESSOURCES_CLE" } };
      fs.writeFileSync(path.join(m.home, "studio.config.json"), JSON.stringify(brut));
      const config = chargerConfig({ home: m.home, env: { ...m.env, STUDIO_STATS_INSTAGRAM: "1" } });
      const demandes = [];
      const journal = [];
      const s = new Stats({ config, journal: (t, d) => journal.push(JSON.stringify([t, d])),
        lire: async (_c, depuis) => {
          demandes.push(depuis);
          const lundis = fenetreSemaines(auj).filter((l) => l >= depuis);
          return { version: 1, le: new Date().toISOString(), abonnes: 40, semaines: lundis.map((l) => ({ debut: l, fin: ajouterJours(l, 6), vues: 10, portee: 4, visites_profil: 1, likes: 0, publications: 1 })) };
        } });
      await s.actualiser();
      await s.actualiser();
      assert.equal(demandes[0], fenetreSemaines(auj)[0]);
      // La deuxième fois : à partir de la plus ancienne semaine pas encore figée (au plus les deux dernières).
      assert.ok(demandes[1] >= ajouterJours(lundiDe(auj), -7), demandes[1]);
      const v = s.vue();
      assert.equal(v.semaines.length, 52);
      assert.ok(v.semaines.every((x) => x.vues === 10 && x.likes === 0));
      assert.equal(v.semaines.at(-1).visites_ressources, 3);
      assert.equal(v.semaines.at(-2).visites_ressources, null); // avant le jour de pose
      assert.deepEqual(v.visites_ressources, { etat: "ok", depuis: auj, phrase: null });
      assert.equal(f.requetes[0].url, `/api/visites/?depuis=${lundiDe(auj)}`);
      const tout = journal.join("\n") + fs.readFileSync(path.join(m.home, "stats", "cache.json"), "utf8");
      assert.ok(!tout.includes("cle-secrete-123"));
      // Le cache garde les données sans les semaines en double (elles vivent dans « semaines »).
      const c = JSON.parse(fs.readFileSync(path.join(m.home, "stats", "cache.json"), "utf8"));
      assert.equal(c.donnees.semaines, undefined);
      assert.equal(c.semaines.length, 52);
    } finally { f.fermer(); }
  } finally { m.nettoyer(); }
});

test("visites : Romain sans ressource ; Yoan sans clé = pas encore mesuré ; erreur dite", async () => {
  const romain = chargerClient({ id: "romain" });
  assert.equal(defautsDuClient(romain).stats, undefined);
  const yoan = chargerClient({ id: "yoan" });
  assert.deepEqual(defautsDuClient(yoan).stats.visites_ressources, {
    url: "https://ressources.yoanmottier.com/api/visites/", debut: yoan.ressources.compteur_depuis,
    cle_fichier: "/Users/Shared/studio-yoan/ressources.env", cle_variable: "VISITES_RESSOURCES_CLE",
  });
  const m = monde();
  try {
    const lire = async () => ({ version: 1, le: new Date().toISOString(), abonnes: 10 });
    const sans = new Stats({ config: chargerConfig({ home: m.home, env: { ...m.env, STUDIO_STATS_INSTAGRAM: "1" } }), lire });
    await sans.actualiser();
    assert.deepEqual(sans.vue().visites_ressources, { etat: "sans" });
    const brut = JSON.parse(fs.readFileSync(path.join(m.home, "studio.config.json")));
    brut.stats = { visites_ressources: { url: "https://ressources.exemple.ch/api/visites/", cle_fichier: path.join(m.racine, "rien.env") } };
    fs.writeFileSync(path.join(m.home, "studio.config.json"), JSON.stringify(brut));
    const config = chargerConfig({ home: m.home, env: { ...m.env, STUDIO_STATS_INSTAGRAM: "1" } });
    const pasMesure = new Stats({ config, lire });
    await pasMesure.actualiser();
    assert.deepEqual(pasMesure.vue().visites_ressources, { etat: "pas_mesure" });
    const enPanne = new Stats({ config, lire, lireVisites: async () => { throw Object.assign(new Error("x"), { code: "RESEAU" }); } });
    await enPanne.actualiser();
    assert.equal(enPanne.vue().visites_ressources.etat, "erreur");
    assert.ok(enPanne.vue().semaines.every((x) => x.visites_ressources === null));
  } finally { m.nettoyer(); }
});

test("copie du head of content d'avant le lot 11 : l'argument inconnu ne casse pas les chiffres", async () => {
  const m = monde({ config: { publication: { simulation: false, heures_par_defaut: {}, jours_par_defaut: [] } } });
  try {
    const log = path.join(m.racine, "appels.txt");
    m.ecrire("copie-mac/outils/zernio.py", `import json, sys
open(${JSON.stringify(log)}, "a").write(" ".join(sys.argv[1:]) + "\\n")
if "--semaines-depuis" in sys.argv:
    sys.stderr.write("zernio.py: error: unrecognized arguments: --semaines-depuis 2025-11-24\\n")
    sys.exit(2)
print(json.dumps({"version": 1, "le": "2026-11-19T08:00:00+00:00", "abonnes": 55}))
`);
    const env = { ...m.env };
    delete env.STUDIO_SIMULATION;
    const s = new Stats({ config: chargerConfig({ home: m.home, env }) });
    const v = await s.actualiser();
    assert.equal(v.abonnes, 55);
    assert.equal(v.erreur, null);
    assert.ok(v.semaines.every((x) => x.vues === null));
    assert.equal(fs.readFileSync(log, "utf8").trim().split("\n").length, 2);
  } finally { m.nettoyer(); }
});

test("périodes : barres, total, moyenne des semaines finies, écart avec la même durée d'avant", () => {
  assert.deepEqual(PERIODES.map((p) => p.semaines), [5, 13, 26, 52]);
  assert.equal(periode("inconnue").id, "3m");
  const semaines = fenetreSemaines("2026-11-19").map((l, k, t) => ({ debut: l, fin: ajouterJours(l, 6), en_cours: k === t.length - 1, vues: k < 47 ? 10 : 20, likes: k === 50 ? null : 1 }));
  const m = resumer(semaines, "1m", "vues");
  assert.equal(m.barres.length, 5);
  assert.equal(m.total, 100);
  assert.equal(m.moyenne, 20);
  assert.deepEqual(m.ecart, { pourcent: 100, avant: 40, apres: 80, libelle: "les 4 semaines d'avant" });
  // Une semaine sans chiffre : pas comptée comme zéro, et pas d'écart (rien d'extrapolé).
  const l = resumer(semaines, "1m", "likes");
  assert.equal(l.total, 4);
  assert.equal(l.mesurees, 4);
  assert.equal(l.ecart, null);
  assert.equal(l.barres[3].valeur, null);
  assert.equal(resumer(semaines, "12m", "vues").ecart, null); // pas de période d'avant gardée
  assert.ok(resumer(semaines, "6m", "vues").ecart);
  assert.equal(resumer([], "3m", "vues").total, null);
  // Avant de mesurer : écart impossible (période d'avant à zéro).
  const zeros = semaines.map((s, k) => ({ ...s, vues: k < 47 ? 0 : 5 }));
  assert.equal(resumer(zeros, "1m", "vues").ecart, null);
});

test("étiquette d'une semaine : du 10 au 16 nov., à cheval sur deux mois ou deux années", () => {
  assert.equal(plageSemaine("2026-11-09", "2026-11-15"), "du 9 au 15 nov.");
  assert.equal(plageSemaine("2026-10-26", "2026-11-01"), "du 26 oct. au 1 nov.");
  assert.equal(plageSemaine("2025-12-29", "2026-01-04"), "du 29 déc. 2025 au 4 janv. 2026");
  assert.equal(plageSemaine("2025-11-24", "2025-11-30", 2026), "du 24 au 30 nov. 2025");
  assert.equal(plageSemaine("2026-11-09", "2026-11-15", 2026), "du 9 au 15 nov.");
  assert.equal(dateSemaine("2025-11-24", 2026), "nov. 2025");
  assert.equal(dateSemaine("2026-08-24", 2026), "24 août");
});
