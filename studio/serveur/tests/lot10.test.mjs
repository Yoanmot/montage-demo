// Lot 10 (les deux studios) : étapes par format (vue d'ensemble et arborescence), vignette du hook d'un reel monté,
// première slide d'un carrousel, aperçu d'une page de ressource gratuite, route de la vignette.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { monde } from "./aide.mjs";
import { demarrer } from "../studio.mjs";
import { vignetteReel, apercuRessource, pageRessource, versionVideo, videoMonteeDe } from "../vignettes.mjs";
import { ETAPES, comptesParFormat, position } from "../../interface/app/etapes.js";
import { outil } from "../../rangement/lib/commun.mjs";

const mondes = [];
after(() => { for (const m of mondes) m.nettoyer(); });
const nouveau = (o) => { const m = monde(o); mondes.push(m); return m; };

function video(f, secondes = 2) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const r = spawnSync(outil("ffmpeg"), ["-nostdin", "-v", "error", "-y", "-f", "lavfi", "-i", `testsrc=size=180x320:rate=10:duration=${secondes}`,
    "-c:v", "libx264", "-pix_fmt", "yuv420p", f]);
  assert.equal(r.status, 0, String(r.stderr));
}

test("étapes : un découpage par format, les mêmes pour la barre de l'arborescence et la vue d'ensemble", () => {
  assert.deepEqual(ETAPES.reel, ["gardee", "script_ecrit", "valide", "tournage_prevu", "rushs_recus", "planche", "monte", "programme", "publie"]);
  assert.deepEqual(ETAPES.carrousel, ["gardee", "script_ecrit", "valide", "mis_en_page", "programme", "publie"]);
  assert.deepEqual(position({ format: "reel", stade: "planche" }), { i: 5, n: 9 });
  assert.deepEqual(position({ format: "carrousel", stade: "mis_en_page" }), { i: 3, n: 6 });
  assert.equal(position({ format: "reel", stade: "proposee" }).i, -1, "une idée proposée n'a pas encore de barre");
  const cartes = [
    { format: "reel", stade: "proposee" }, { format: "reel", stade: "monte" }, { format: "reel", stade: "monte" },
    { format: "reel", stade: "planche" }, { format: "carrousel", stade: "proposee" }, { format: "carrousel", stade: "mis_en_page" },
    { format: "carrousel", stade: "valide" }, { format: "reel", stade: "abandonne" }, { format: "carrousel", stade: "de_cote" },
  ];
  const [reels, carrousels] = comptesParFormat(cartes);
  assert.equal(reels.format, "reel", "les reels d'abord");
  assert.equal(carrousels.format, "carrousel");
  // Seulement les étapes qui concernent le format, dans l'ordre, idées proposées en tête.
  assert.deepEqual(reels.etapes.map((e) => e.stade), ["proposee", ...ETAPES.reel]);
  assert.deepEqual(carrousels.etapes.map((e) => e.stade), ["proposee", ...ETAPES.carrousel]);
  assert.ok(!carrousels.etapes.some((e) => ["tournage_prevu", "rushs_recus", "planche", "monte"].includes(e.stade)));
  const n = (f, s) => f.etapes.find((e) => e.stade === s).n;
  assert.equal(n(reels, "monte"), 2);
  assert.equal(n(reels, "planche"), 1);
  assert.equal(n(reels, "proposee"), 1);
  assert.equal(n(carrousels, "valide"), 1);
  assert.equal(reels.total, 4, "mis de côté : compté nulle part");
  assert.equal(carrousels.total, 3);
  assert.equal(reels.etapes.find((e) => e.stade === "monte").nom, "prêts à poster");
  assert.equal(carrousels.etapes.find((e) => e.stade === "valide").nom, "à mettre en page");
  // Aucun tiret cadratin dans ce que l'écran affiche.
  assert.ok(![...reels.etapes, ...carrousels.etapes].some((e) => e.nom.includes("\u2014")));
});

test("vignette du hook : une image de la vidéo montée, gardée par version, refaite quand la vidéo change", async () => {
  const m = nouveau();
  const f = path.join(m.media, "mon-reel", "face", "rush-monte.mp4");
  video(f);
  const v1 = await vignetteReel(m.config, "mon-reel");
  assert.ok(v1 && v1.startsWith(path.join(m.home, "vignettes")), v1);
  const octets = fs.readFileSync(v1);
  assert.equal(octets[0], 0xff); assert.equal(octets[1], 0xd8, "JPEG");
  const d1 = fs.statSync(v1).mtimeMs;
  assert.equal(await vignetteReel(m.config, "mon-reel"), v1, "même vidéo : même image, pas refaite");
  assert.equal(fs.statSync(v1).mtimeMs, d1);
  // Deux demandes en même temps ne fabriquent qu'une image.
  fs.rmSync(v1);
  const [a, b] = await Promise.all([vignetteReel(m.config, "mon-reel"), vignetteReel(m.config, "mon-reel")]);
  assert.equal(a, b);
  // Une nouvelle retouche (-monte-2) : une autre image, l'ancienne retirée.
  video(path.join(m.media, "mon-reel", "face", "rush-monte-2.mp4"), 3);
  const t = new Date(Date.now() + 5000); fs.utimesSync(path.join(m.media, "mon-reel", "face", "rush-monte-2.mp4"), t, t);
  const v2 = await vignetteReel(m.config, "mon-reel");
  assert.notEqual(v2, v1);
  assert.deepEqual(fs.readdirSync(path.join(m.home, "vignettes")).filter((x) => !x.startsWith(".")), [path.basename(v2)]);
  // Vidéo de moins d'une seconde : la première image.
  video(path.join(m.media, "court", "face", "x-monte.mp4"), 0.5);
  assert.ok(await vignetteReel(m.config, "court"));
  // Pas de vidéo montée, ou ffmpeg introuvable : pas d'image (l'interface montre une case sans image).
  assert.equal(await vignetteReel(m.config, "rien"), null);
  fs.mkdirSync(path.join(m.media, "brut", "face"), { recursive: true });
  fs.writeFileSync(path.join(m.media, "brut", "face", "IMG_1.mov"), "x");
  assert.equal(await vignetteReel(m.config, "brut"), null);
  video(path.join(m.media, "sans-outil", "face", "a-monte.mp4"));
  assert.equal(await vignetteReel(m.config, "sans-outil", { ffmpeg: "/nulle/part/ffmpeg" }), null);
});

test("cartes : vignette du reel monté (adresse versionnée) et première slide du carrousel ; route servie, 404 sinon", async () => {
  const m = nouveau();
  m.contenu("reel-monte", { format: "reel", titre: "Un reel monté" });
  m.ecrire("depot/contenus/reel-monte/script.md", "# Un reel monté\n\n## Script\n\nBla.\n");
  video(path.join(m.media, "reel-monte", "face", "rush-monte.mp4"));
  m.contenu("carrousel-pret", { format: "carrousel", titre: "Un carrousel" });
  for (const n of ["slide-02.png", "slide-01.png", "planche.jpg"]) m.ecrire(`Contenu/carrousel-pret/slides/${n}`, "png");
  m.contenu("idee-seule", { format: "reel" });
  const s = await demarrer({ env: m.env, silencieux: true });
  try {
    const port = s.config.port;
    const appel = (chemin, cookie) => new Promise((ok, ko) => {
      const r = http.request({ host: "127.0.0.1", port, path: chemin, headers: { Host: `127.0.0.1:${port}`, ...(cookie ? { Cookie: cookie } : {}) } }, (res) => {
        const b = []; res.on("data", (x) => b.push(x)); res.on("end", () => ok({ statut: res.statusCode, entetes: res.headers, corps: Buffer.concat(b) }));
      });
      r.on("error", ko); r.end();
    });
    const cookie = (await appel(`/?t=${s.jeton}`)).entetes["set-cookie"][0].split(";")[0];
    const cartes = JSON.parse((await appel("/api/etat", cookie)).corps.toString("utf8")).cartes;
    const c = (slug) => cartes.find((x) => x.slug === slug);
    const v = videoMonteeDe(m.config, "reel-monte");
    assert.equal(c("reel-monte").vignette, `/api/cartes/reel-monte/vignette?v=${versionVideo(v)}`);
    assert.match(c("carrousel-pret").vignette, /^\/api\/media\/carrousel-pret\/slides\/slide-01\.png\?v=\d+$/);
    assert.equal(c("idee-seule").vignette, undefined);
    const img = await appel(c("reel-monte").vignette, cookie);
    assert.equal(img.statut, 200);
    assert.equal(img.entetes["content-type"], "image/jpeg");
    assert.equal((await appel("/api/cartes/idee-seule/vignette", cookie)).statut, 404);
    assert.equal((await appel("/api/cartes/reel-monte/vignette")).statut, 401, "sans le jeton du studio : rien");
  } finally { await s.arreter("fin"); }
});

test("aperçu d'une page de ressource : capture par Chrome sans fenêtre de la page servie à part, gardée par version", async () => {
  const m = nouveau();
  m.ecrire("depot/site/assets/ressource.css", "body { color: #111 }");
  m.ecrire("depot/site/ma-ressource/index.html", "<!doctype html><title>Ma ressource</title><link rel=stylesheet href=/assets/ressource.css><h1>La page</h1>");
  m.ecrire("depot/site/_brouillons/en-cours/index.html", "<!doctype html><title>En cours</title><h1>Brouillon</h1>");
  // Un faux Chrome : il lit la page à l'adresse donnée (le petit serveur doit la servir, feuille comprise) et écrit l'image.
  const faux = m.ecrire("faux-chrome.mjs", `#!/usr/bin/env node
import fs from "node:fs";
const a = process.argv.slice(2);
const sortie = a.find((x) => x.startsWith("--screenshot=")).slice(13);
const url = a[a.length - 1];
const page = await (await fetch(url)).text();
const css = await (await fetch(new URL("/assets/ressource.css", url))).text();
fs.appendFileSync(process.env.FAUX_CHROME_JOURNAL, JSON.stringify({ url, page: page.slice(0, 300), css, args: a }) + "\\n");
if (process.env.FAUX_CHROME_ECHEC) process.exit(3);
fs.writeFileSync(sortie, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
`);
  fs.chmodSync(faux, 0o755);
  const journal = path.join(m.racine, "chrome.jsonl");
  process.env.FAUX_CHROME_JOURNAL = journal;
  const lus = () => fs.readFileSync(journal, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const p1 = await apercuRessource(m.config, "ma-ressource", { chrome: faux });
  assert.ok(p1 && fs.existsSync(p1), "image écrite");
  const [l1] = lus();
  assert.match(l1.url, /^http:\/\/127\.0\.0\.1:\d+\/ma-ressource\/$/);
  assert.match(l1.page, /<h1>La page/);
  assert.equal(l1.css, "body { color: #111 }", "les /assets/ du site sont servis");
  assert.ok(!l1.args.some((x) => x.startsWith("--virtual-time-budget")), "il peut ne jamais rendre la main");
  for (const x of ["--headless=new", "--force-prefers-reduced-motion", "--window-size=500,880", "--use-mock-keychain", "--password-store=basic"]) assert.ok(l1.args.includes(x), x);
  assert.ok(l1.args.some((x) => x.startsWith("--user-data-dir=")), "jamais le profil Chrome de l'utilisateur");
  // Le petit serveur est fermé après la capture.
  await assert.rejects(fetch(l1.url));
  // Même page : même image, Chrome pas relancé ; page changée : nouvelle image, l'ancienne retirée.
  assert.equal(await apercuRessource(m.config, "ma-ressource", { chrome: faux }), p1);
  assert.equal(lus().length, 1);
  const v1 = pageRessource(m.config, "ma-ressource").version;
  m.ecrire("depot/site/ma-ressource/index.html", "<!doctype html><title>Ma ressource</title><h1>La page, retouchée</h1>");
  assert.notEqual(pageRessource(m.config, "ma-ressource").version, v1);
  const p2 = await apercuRessource(m.config, "ma-ressource", { chrome: faux });
  assert.notEqual(p2, p1);
  assert.ok(!fs.existsSync(p1));
  // Brouillon : sa page de brouillon. Sans page, sans Chrome, ou capture en échec : pas d'image (vignette au titre).
  assert.equal(pageRessource(m.config, "en-cours").adresse, "/_brouillons/en-cours/");
  assert.equal(await apercuRessource(m.config, "sans-page", { chrome: faux }), null);
  assert.equal(await apercuRessource(m.config, "en-cours", { chrome: null }), null);
  process.env.FAUX_CHROME_ECHEC = "1";
  assert.equal(await apercuRessource(m.config, "en-cours", { chrome: faux }), null);
  delete process.env.FAUX_CHROME_ECHEC;
  // Rien ne traîne : ni profil temporaire, ni image à moitié écrite.
  assert.deepEqual(fs.readdirSync(path.join(m.home, "apercus-ressources")).filter((x) => x.startsWith(".")), []);
});
