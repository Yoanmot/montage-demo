// Le studio réglé par client (lot 1 du studio de Yoan) : STUDIO_CLIENT=yoan dans tout ce fichier.
// Aucun « Romain » dans ce qui est servi, racine et port du client, garde-fou Zernio générique.
// Tout tourne dans des dossiers temporaires : rien n'est écrit dans /Users/Shared ni dans ~/.claude.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Avant tout import du studio : les textes fixes des modules prennent le client du processus.
process.env.STUDIO_CLIENT = "yoan";
const ICI = path.dirname(fileURLToPath(import.meta.url));
const CODE = path.resolve(ICI, "..", "..");

const { chargerClient, variablesEcriture } = await import("../client.mjs");
const { chargerConfig, studioHome, defautsDuClient } = await import("../config.mjs");
const { reglagesChat, environnement, CONSIGNE_STUDIO, refusCommuns } = await import("../reglages.mjs");
const { ideePourClient } = await import("../lecture.mjs");
const { messageAction } = await import("../file.mjs");
const { MESSAGE_GENERIQUE } = await import("../depot-outils.mjs");
const { lancerZernio } = await import("../../publication/publication.mjs");
const { demarrer } = await import("../studio.mjs");
const { monde } = await import("./aide.mjs");

const RACINE = "/Users/Shared/studio-yoan";
const CFG = "/Users/Shared/studio-yoan/claude";

// Le texte d'un fichier servi, sans ses commentaires (ils parlent au mainteneur, pas au client).
function sansCommentaires(t) {
  return t.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/(^|[^:"'`\\])\/\/.*$/, "$1")).join("\n");
}

test("fichiers de client : même format pour les deux, Romain = les valeurs d'avant", () => {
  const r = chargerClient({ id: "romain" });
  const y = chargerClient({ id: "yoan" });
  // « appareil » (21/11, installation livrée) : Romain filme à l'iPhone, l'installation ne lui pose plus la question ;
  // clé facultative, absente chez Yoan.
  const cles = (c) => Object.keys(JSON.parse(fs.readFileSync(c.fichier, "utf8"))).filter((k) => k !== "appareil").sort();
  assert.equal(JSON.parse(fs.readFileSync(r.fichier, "utf8")).appareil, "iPhone");
  assert.deepEqual(cles(y), cles(r));
  assert.deepEqual(cles(r), ["appli", "branche_mise_a_jour", "claude", "config_claude", "contact", "ecran_partage", "head_of_content", "id", "label_launchd",
    "monteur", "polices_locales", "port", "prenom", "racine", "reels_essai", "ressources", "skill_carrousel", "theme", "zernio"]);
  // Polices hors dépôt (lot 10) : Satoshi chez Yoan, depuis son fichier à lui ; rien chez Romain.
  assert.deepEqual(r.polices_locales || {}, {});
  assert.deepEqual(Object.keys(y.polices_locales), ["Satoshi-Black.woff2"]);
  // Reel d'essai : proposé chez Yoan seulement.
  assert.equal(y.reels_essai, true);
  // Écran partagé (23/11) : chez Yoan seulement.
  assert.deepEqual([r.ecran_partage, y.ecran_partage], [false, true]);
  assert.equal(r.reels_essai, false);
  // Les valeurs que Romain avait dans l'exemple de configuration ne bougent pas.
  const exemple = JSON.parse(fs.readFileSync(path.join(CODE, "studio.config.exemple.json"), "utf8"));
  const d = defautsDuClient(r);
  for (const k of Object.keys(d)) {
    if (k === "claude") continue; // Romain passe sur opus par son fichier de client (lot 12)
    if (k === "apercu_ressources") continue; // son site des ressources est branché (21/11/2026)
    assert.deepEqual(d[k], exemple[k], k);
  }
  assert.deepEqual(d.claude, { modele: "opus", modele_sous_agents: "opus" });
  // Ressources gratuites de Romain : son site, le mot posé par son serveur, pas de compteur de visites.
  assert.equal(d.apercu_ressources, "https://ressources.fitavecromain.com");
  assert.deepEqual(r.ressources, { site: "https://ressources.fitavecromain.com", mot: "serveur" });
  assert.equal(d.stats, undefined);
  assert.equal(r.racine, "~/.montage-yoan");
  assert.equal(r.config_claude, null);
  assert.equal(y.contact, "Yoan");
  assert.equal(y.racineAbs, RACINE);
  assert.equal(y.dossierClaude, CFG);
  assert.notEqual(y.port, r.port);
  assert.notEqual(y.label_launchd, r.label_launchd);
});

test("config : racine et port du client dans un studio neuf, STUDIO_PORT prioritaire", () => {
  assert.equal(studioHome({ STUDIO_CLIENT: "yoan" }), path.join(RACINE, "studio"));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "studio-yoan-cfg-"));
  try {
    const c = chargerConfig({ home, env: { ...process.env, STUDIO_PORT: "" } });
    assert.equal(c.client.id, "yoan");
    assert.equal(c.prenom, "Yoan");
    assert.equal(c.port, 4748);
    assert.equal(c.depot, path.join(RACINE, "studio", "head-of-content"));
    assert.equal(c.depotMac, path.join(RACINE, "head-of-content"));
    assert.equal(c.media, path.join(RACINE, "Contenu"));
    assert.equal(c.skills, path.join(CFG, "skills"));
    assert.equal(c.apercuRessources, "https://ressources.yoanmottier.com");
    assert.equal(c.theme, "yoan");
    assert.equal(c.appli.nom, "Studio");
    const ecrit = JSON.parse(fs.readFileSync(path.join(home, "studio.config.json"), "utf8"));
    assert.equal(ecrit.prenom, "Yoan");
    assert.equal(ecrit.port, 4748);
    assert.equal(chargerConfig({ home, env: { ...process.env, STUDIO_PORT: "4999" } }).port, 4999);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("sessions : consigne au prénom du client, config Claude du client, secrets sous sa racine", () => {
  const config = { client: chargerClient({ id: "yoan" }), depot: "/tmp/depot", media: "/tmp/media", skills: path.join(CFG, "skills"), agents: {} };
  const r = reglagesChat("general", config);
  const consigne = r.args[r.args.indexOf("--append-system-prompt") + 1];
  assert.match(consigne, /^Tu parles à Yoan dans son studio/);
  assert.equal(consigne, CONSIGNE_STUDIO);
  assert.ok(!consigne.includes("Romain"));
  assert.equal(r.env.CLAUDE_CONFIG_DIR, CFG);
  const autorises = r.args[r.args.indexOf("--allowedTools") + 1];
  assert.match(autorises, /Edit\(\/\/Users\/Shared\/studio-yoan\/claude\/agent-memory\/\*\*\)/);
  assert.ok(!autorises.includes("~/.claude/agent-memory"), "jamais la mémoire des agents de Yoan");
  const refus = JSON.parse(r.args[r.args.indexOf("--settings") + 1]).permissions.deny;
  assert.deepEqual(refus, refusCommuns(config.client, config));
  for (const x of [
    "Read(//Users/Shared/studio-yoan/*.env)", "Edit(//Users/Shared/studio-yoan/*.env)",
    "Read(//Users/Shared/studio-yoan/claude/.credentials.json)",
    "Edit(//Users/Shared/studio-yoan/claude/settings.json)", "Edit(//Users/Shared/studio-yoan/claude/agents/**)",
    "Edit(~/.claude/settings.json)", "Edit(~/.claude/CLAUDE.md)",
    "Read(~/.ssh/**)", "Bash(*ZERNIO_ECRITURE*)", "Bash(*zernio.py publier*--envoyer*)", "Bash(*elevenlabs.env*)",
  ]) assert.ok(refus.includes(x), x);
  // Romain : la liste d'avant (secrets sous ~/.montage-yoan, ~/.claude), plus le garde-fou générique.
  const rr = refusCommuns(chargerClient({ id: "romain" }));
  for (const x of ["Read(~/.montage-yoan/*.env)", "Edit(~/.claude/skills/**)", "Bash(*ZERNIO_ECRITURE_ROMAIN*)", "Bash(*ZERNIO_ECRITURE*)"]) {
    assert.ok(rr.includes(x), x);
  }
  assert.ok(!rr.some((x) => x.includes("/Users/Shared")));
  const env = environnement({ HOME: "/h", ZERNIO_ECRITURE: "ia.yoan", ZERNIO_ECRITURE_ROMAIN: "oui" }, r.env);
  assert.equal(env.ZERNIO_ECRITURE, undefined);
  assert.equal(env.ZERNIO_ECRITURE_ROMAIN, undefined);
  assert.equal(env.CLAUDE_CONFIG_DIR, CFG);
});

test("textes : contact du client, idée au prénom du client, gabarits sans Romain", () => {
  assert.match(MESSAGE_GENERIQUE, /préviens Yoan\.$/);
  const idee = ideePourClient("# Une idée\n\n- Source : idée de Yoan du 2026-11-14\n- Ce que Yoan en a dit : en séance");
  assert.match(idee, /ton idée du 14\/11/);
  assert.match(idee, /Ce que tu en as dit : en séance/);
  assert.ok(!/Yoan/.test(idee));
  const m = monde({ config: { prenom: undefined } });
  try {
    m.contenu("a1");
    m.contenu("a2", { format: "carrousel" });
    const textes = [
      messageAction({ type: "script", slug: "a1" }, m.config),
      messageAction({ type: "tournage", slugs: ["a1"] }, m.config),
      messageAction({ type: "montage", slug: "a1" }, m.config),
      messageAction({ type: "mise_en_page", slug: "a2" }, m.config),
    ].join("\n");
    assert.ok(!textes.includes("Romain"), textes);
    assert.ok(!textes.includes("-->"), "le commentaire du gabarit ne part jamais au modèle");
    assert.match(textes, /de Yoan pour l'écrire/);
  } finally {
    m.nettoyer();
  }
});

test("publication : ZERNIO_ECRITURE=<compte> seulement à l'écriture ; l'ancien nom pour Romain seulement", async () => {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), "studio-yoan-zernio-"));
  try {
    const mac = path.join(racine, "mac");
    const log = path.join(racine, "env.jsonl");
    fs.mkdirSync(path.join(mac, "outils"), { recursive: true });
    fs.writeFileSync(path.join(mac, "outils", "zernio.py"), `import json, os, sys
open(${JSON.stringify(log)}, "a").write(json.dumps({"a": os.environ.get("ZERNIO_ECRITURE"), "r": os.environ.get("ZERNIO_ECRITURE_ROMAIN")}) + "\\n")
print("OK")
`);
    const avant = { a: process.env.ZERNIO_ECRITURE, r: process.env.ZERNIO_ECRITURE_ROMAIN };
    process.env.ZERNIO_ECRITURE = "fuite";
    process.env.ZERNIO_ECRITURE_ROMAIN = "oui";
    try {
      const base = { depot_hoc: path.join(racine, "depot"), depot_mac: mac, media: path.join(racine, "media") };
      const yoan = chargerClient({ id: "yoan" });
      const romain = chargerClient({ id: "romain" });
      await lancerZernio({ ...base, client: yoan }, ["verifier"]);
      await lancerZernio({ ...base, client: yoan }, ["publier"], { ecriture: true });
      await lancerZernio({ ...base, client: romain }, ["publier"], { ecriture: true });
      await lancerZernio({ ...base }, ["publier"], { ecriture: true }); // sans client : celui du processus
    } finally {
      for (const [k, v] of [["ZERNIO_ECRITURE", avant.a], ["ZERNIO_ECRITURE_ROMAIN", avant.r]]) {
        if (v === undefined) delete process.env[k]; else process.env[k] = v;
      }
    }
    const l = fs.readFileSync(log, "utf8").trim().split("\n").map((x) => JSON.parse(x));
    assert.deepEqual(l, [
      { a: null, r: null },
      { a: "ia.yoan", r: null },
      { a: "fitavecromain", r: "oui" },
      { a: "ia.yoan", r: null },
    ]);
    assert.deepEqual(variablesEcriture(chargerClient({ id: "yoan" })), { ZERNIO_ECRITURE: "ia.yoan" });
  } finally {
    fs.rmSync(racine, { recursive: true, force: true });
  }
});

test("rangement : racine et skills du client", () => {
  const sortie = execFileSync(process.execPath, ["--input-type=module", "-e", `
    import fs from "node:fs"; import os from "node:os"; import path from "node:path";
    const { STUDIO_HOME, lireConfig } = await import(${JSON.stringify(path.join(CODE, "rangement", "lib", "commun.mjs"))});
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "rg-")); const f = path.join(d, "c.json");
    fs.writeFileSync(f, JSON.stringify({ depot_hoc: d }));
    console.log(JSON.stringify({ STUDIO_HOME, skills: lireConfig(f).skills }));
    fs.rmSync(d, { recursive: true });
  `], { env: { ...process.env, STUDIO_CLIENT: "yoan", STUDIO_HOME: "" }, encoding: "utf8" });
  assert.deepEqual(JSON.parse(sortie), { STUDIO_HOME: path.join(RACINE, "studio"), skills: path.join(CFG, "skills") });
});

// ------------------------------------------------------------ le serveur du monde « yoan »
let m;
let s;
let port;
let cookie;

function requete(chemin) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: chemin, headers: { Host: `127.0.0.1:${port}`, ...(cookie ? { Cookie: cookie } : {}) } }, (res) => {
      const morceaux = [];
      res.on("data", (x) => morceaux.push(x));
      res.on("end", () => resolve({ statut: res.statusCode, entetes: res.headers, texte: Buffer.concat(morceaux).toString("utf8") }));
    });
    req.on("error", reject);
    req.end();
  });
}

before(async () => {
  // Le prénom n'est pas dans le fichier : il vient du client.
  m = monde({ config: { prenom: undefined } });
  s = await demarrer({ env: m.env, silencieux: true });
  port = s.config.port;
  const r = await requete(`/?t=${s.jeton}`);
  cookie = r.entetes["set-cookie"][0].split(";")[0];
});

after(async () => {
  await s?.arreter("fin");
  m?.nettoyer();
});

test("serveur yoan : port de la config, accueil au nom de l'appli et au thème du client", async () => {
  assert.equal(s.config.client.id, "yoan");
  const r = await requete("/");
  assert.equal(r.statut, 200);
  assert.match(r.texte, /<title>Studio<\/title>/);
  assert.match(r.texte, /<link rel="stylesheet" href="\/app\/themes\/yoan\.css">/);
  assert.ok(!r.texte.includes("themes/romain.css"));
  assert.ok(!r.texte.includes("manrope.woff2"), "pas la police de Romain en préchargement");
  assert.match(r.texte, /data-prenom="Yoan" data-contact="Yoan"/);
  assert.ok(!r.texte.includes("Romain"));
  assert.equal((await requete("/app/themes/yoan.css")).statut, 200);
  assert.equal((await requete("/app/style.css")).statut, 200);
});

test("serveur yoan : aucun « Romain » dans les textes servis (accueil, état, interface, styles)", async () => {
  const etat = await requete("/api/etat");
  assert.equal(etat.statut, 200);
  const j = JSON.parse(etat.texte);
  assert.equal(j.config.prenom, "Yoan");
  assert.equal(j.config.contact, "Yoan");
  assert.ok(!etat.texte.includes("Romain"));
  // Tous les fichiers de l'interface (la maquette à part : données d'exemple, jamais chargée hors ?maquette=1).
  const app = path.join(CODE, "interface", "app");
  const fichiers = fs.readdirSync(app).filter((f) => /\.(js|css)$/.test(f) && f !== "maquette.js").map((f) => `/app/${f}`);
  fichiers.push("/app/themes/yoan.css");
  for (const f of fichiers) {
    const r = await requete(f);
    assert.equal(r.statut, 200, f);
    const t = sansCommentaires(r.texte);
    assert.ok(!t.includes("Romain"), `${f} : ${t.split("\n").find((l) => l.includes("Romain"))}`);
  }
});

test("serveur yoan : le thème charge ses propres polices, servies à côté de la feuille", async () => {
  const css = (await requete("/app/themes/yoan.css")).texte;
  assert.ok(!/manrope|FAR Titres/i.test(css), "aucune police de Romain dans le thème de Yoan");
  const sans = sansCommentaires(css);
  // Lot 10 : les titres en Satoshi (la voix de ses reels), plus en Anton (le titre de ses carrousels), avec un repli.
  assert.ok(!/Anton/.test(sans), "plus d'Anton dans le thème");
  assert.match(sans, /--titres: "Satoshi", "Instrument Sans"/);
  const urls = [...css.matchAll(/url\("([^"]+)"\)/g)].map((x) => x[1]);
  assert.ok(urls.filter((u) => u.endsWith(".woff2")).length >= 4, "Satoshi, Instrument Sans (droit, italique), JetBrains Mono");
  assert.ok(urls.includes("yoan-logo.svg"), "le logo « studio. » dessiné");
  for (const u of urls.filter((x) => !x.startsWith("/app/polices-client/"))) {
    const r = await requete(new URL(u, "http://x/app/themes/yoan.css").pathname);
    assert.equal(r.statut, 200, u);
    assert.equal(r.entetes["content-type"], u.endsWith(".svg") ? "image/svg+xml" : "font/woff2", u);
  }
});

test("serveur yoan : Satoshi n'est servie que posée dans le studio (polices_locales), sinon 404 et repli", async () => {
  const u = "/app/polices-client/Satoshi-Black.woff2";
  fs.rmSync(path.join(m.home, "polices"), { recursive: true, force: true });
  assert.equal((await requete(u)).statut, 404, "pas posée : 404, le thème retombe sur Instrument Sans");
  fs.mkdirSync(path.join(m.home, "polices"), { recursive: true });
  fs.writeFileSync(path.join(m.home, "polices", "Satoshi-Black.woff2"), "wOF2-essai");
  const r = await requete(u);
  assert.equal(r.statut, 200);
  assert.equal(r.entetes["content-type"], "font/woff2");
  // Rien d'autre ne sort de ce dossier, ni d'ailleurs.
  fs.writeFileSync(path.join(m.home, "polices", "notes.txt"), "x");
  assert.equal((await requete("/app/polices-client/notes.txt")).statut, 404);
  assert.equal((await requete("/app/polices-client/..%2Fstudio.config.json")).statut, 404);
  assert.equal((await requete("/app/polices-client/../studio.config.json")).statut, 404);
});

test("lancement yoan : l'icône propre au client est dans le dépôt", () => {
  assert.equal(JSON.parse(fs.readFileSync(path.join(CODE, "clients", "yoan.json"), "utf8")).appli.icone, "yoan");
  assert.ok(fs.statSync(path.join(CODE, "lancement", "icones", "yoan.icns")).size > 1000);
});
