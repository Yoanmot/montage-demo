// Les autres fichiers d'un contenu (19/11/2026) : ce que le head of content range dans contenus/<slug>/ hors des
// fichiers connus (icônes pour le montage...). Liste, contrôle du chemin, service en lecture seule.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { demarrer } from "../studio.mjs";
import { monde } from "./aide.mjs";
import { autresFichiers, fichierAutre, nomLisible, genreDe } from "../autres.mjs";

let m;
let s;
let port;
let cookie;

function requete(chemin) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method: "GET", path: chemin,
      headers: { Host: `127.0.0.1:${port}`, ...(cookie ? { Cookie: cookie } : {}) } }, (res) => {
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
    req.end();
  });
}

before(async () => {
  m = monde();
  // Un contenu avec des icônes en sous-dossier, une note, un fichier quelconque, et tout ce qui doit être ignoré.
  m.contenu("tier-list", { titre: "Je classe dix usages" });
  m.ecrire("depot/contenus/tier-list/idee.md", "# Je classe dix usages\n");
  m.ecrire("depot/contenus/tier-list/script.md", "# Je classe\n\n## Texte complet\nBonjour\n");
  m.ecrire("depot/contenus/tier-list/ressource.md", "# Ressource\n");
  m.ecrire("depot/contenus/tier-list/.gitkeep", "");
  m.ecrire("depot/contenus/tier-list/.DS_Store", "x");
  m.ecrire("depot/contenus/tier-list/.cache/vieux.png", "x");
  m.ecrire("depot/contenus/tier-list/icones/10-clone-voix-tete.png", "png10");
  m.ecrire("depot/contenus/tier-list/icones/2-seances.png", "png2");
  m.ecrire("depot/contenus/tier-list/icones/01-site.png", "png01");
  m.ecrire("depot/contenus/tier-list/icones/logo.svg", '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  m.ecrire("depot/contenus/tier-list/notes_tournage.md", "# Notes\n\n- un point\n");
  m.ecrire("depot/contenus/tier-list/sons/claque.mp3", "mp3");
  m.ecrire("depot/contenus/tier-list/page.html", "<script>alert(1)</script>");
  // Liens symboliques : vers l'extérieur (fichier et dossier) et même vers l'intérieur, jamais suivis.
  m.ecrire("secret.png", "secret");
  fs.mkdirSync(path.join(m.racine, "dehors"));
  m.ecrire("dehors/cache.png", "secret");
  fs.symlinkSync(path.join(m.racine, "secret.png"), path.join(m.depot, "contenus", "tier-list", "fuite.png"));
  fs.symlinkSync(path.join(m.racine, "dehors"), path.join(m.depot, "contenus", "tier-list", "lien-dossier"));
  // Un contenu sans rien d'autre que les fichiers connus.
  m.contenu("simple");
  m.ecrire("depot/contenus/simple/idee.md", "# Simple\n");
  m.ecrire("depot/contenus/simple/script.md", "# Simple\n\n## Texte complet\nSalut\n");
  m.ecrire("depot/contenus/simple/.gitkeep", "");
  s = await demarrer({ env: { ...process.env, STUDIO_HOME: m.home, HOME: m.maison }, silencieux: true });
  port = s.config.port;
  const bon = await requete(`/?t=${s.jeton}`);
  cookie = bon.entetes["set-cookie"][0].split(";")[0];
});

after(async () => {
  await s?.arreter("tests");
  m?.nettoyer();
});

test("nom lisible et genre", () => {
  assert.equal(nomLisible("01-site.png"), "01 site");
  assert.equal(nomLisible("notes_tournage.md"), "notes tournage");
  assert.equal(nomLisible("icones/10-clone-voix-tete.png"), "10 clone voix tete");
  assert.equal(genreDe("a.PNG"), "image");
  assert.equal(genreDe("a.svg"), "image");
  assert.equal(genreDe("a.txt"), "texte");
  assert.equal(genreDe("a.mp3"), "autre");
});

test("liste : sous-dossiers compris, triée, sans fichiers connus, cachés ni liens symboliques", () => {
  const l = autresFichiers(path.join(m.depot, "contenus", "tier-list"));
  assert.deepEqual(l.map((f) => f.chemin), [
    "icones/01-site.png", "icones/2-seances.png", "icones/10-clone-voix-tete.png", "icones/logo.svg",
    "notes_tournage.md", "page.html", "sons/claque.mp3",
  ]);
  const f = l.find((x) => x.chemin === "icones/01-site.png");
  assert.equal(f.nom, "01 site");
  assert.equal(f.dossier, "icones");
  assert.equal(f.genre, "image");
  assert.equal(f.taille, 5);
  assert.equal(l.find((x) => x.chemin === "page.html").genre, "autre");
  assert.equal(autresFichiers(path.join(m.depot, "contenus", "tier-list"), { max: 1 }).length, 1);
});

test("rien quand il n'y a que les fichiers connus, ou pas de dossier", () => {
  assert.deepEqual(autresFichiers(path.join(m.depot, "contenus", "simple")), []);
  assert.deepEqual(autresFichiers(path.join(m.depot, "contenus", "absent")), []);
});

test("contrôle du chemin : rien hors du dossier, rien de caché, de connu, de lié ou d'un type non affiché", () => {
  const d = path.join(m.depot, "contenus", "tier-list");
  assert.equal(fichierAutre(d, ["icones", "01-site.png"]), path.join(fs.realpathSync(d), "icones", "01-site.png"));
  assert.ok(fichierAutre(d, ["notes_tournage.md"]));
  for (const seg of [["..", "..", "secret.png"], ["..", "simple", "idee.md"], ["fuite.png"], ["lien-dossier", "cache.png"],
    [".cache", "vieux.png"], ["idee.md"], ["script.md"], ["page.html"], ["sons", "claque.mp3"], ["icones"], [],
    ["icones/01-site.png"], ["icones", "absent.png"]]) {
    assert.equal(fichierAutre(d, seg), null, seg.join("/"));
  }
});

test("carte et détail : « autres » seulement s'il y en a, sans aucun chemin du disque", async () => {
  const etat = await requete("/api/etat");
  const carte = (slug) => etat.json.cartes.find((c) => c.slug === slug);
  assert.ok(carte("tier-list").fichiers.includes("autres"));
  assert.equal(carte("tier-list").fichiers.at(-1), "autres");
  assert.ok(!carte("simple").fichiers.includes("autres"));
  const d = (await requete("/api/cartes/tier-list")).json;
  assert.equal(d.autres.length, 7);
  const icone = d.autres.find((f) => f.nom === "01 site");
  assert.match(icone.url, /^\/api\/cartes\/tier-list\/fichiers\/icones\/01-site\.png\?v=\d+$/);
  assert.equal(d.autres.find((f) => f.nom === "claque").url, undefined, "le reste : nom et taille seulement");
  assert.ok(!JSON.stringify(d.autres).includes(m.racine));
  assert.equal((await requete("/api/cartes/simple")).json.autres, undefined);
});

test("service : image et texte en lecture, svg sans script possible, le reste introuvable", async () => {
  const png = await requete("/api/cartes/tier-list/fichiers/icones/01-site.png?v=1");
  assert.equal(png.statut, 200);
  assert.equal(png.texte, "png01");
  assert.equal(png.entetes["content-type"], "image/png");
  assert.match(png.entetes["content-security-policy"], /sandbox/);
  assert.equal(png.entetes["x-content-type-options"], "nosniff");
  const svg = await requete("/api/cartes/tier-list/fichiers/icones/logo.svg");
  assert.equal(svg.entetes["content-type"], "image/svg+xml");
  assert.match(svg.entetes["content-security-policy"], /default-src 'none'.*sandbox/);
  const md = await requete("/api/cartes/tier-list/fichiers/notes_tournage.md");
  assert.equal(md.entetes["content-type"], "text/plain; charset=utf-8");
  for (const p of ["fuite.png", "lien-dossier/cache.png", "..%2F..%2F..%2Fsecret.png", "..%2Fsimple%2Fidee.md", "idee.md",
    "page.html", "sons/claque.mp3", ".cache/vieux.png", "icones%2F01-site.png"]) {
    assert.equal((await requete(`/api/cartes/tier-list/fichiers/${p}`)).statut, 404, p);
  }
  assert.equal((await requete("/api/cartes/absent/fichiers/a.png")).statut, 404);
  cookie = null;
  assert.equal((await requete("/api/cartes/tier-list/fichiers/icones/01-site.png")).statut, 401);
});
