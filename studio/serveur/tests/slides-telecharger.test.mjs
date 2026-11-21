// Télécharger les slides d'un carrousel (21/11/2026) : une slide seule ou toutes dans un zip, dans Téléchargements,
// dans l'ordre d'envoi (numérique), au nom du contenu ; jeton et Origin exigés comme pour toute action.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { demarrer } from "../studio.mjs";
import { monde } from "./aide.mjs";
import { nomDepuisTitre } from "../telecharger.mjs";
import { arriveesPertinentes } from "../../rangement/lib/commun.mjs";

let m;
let s;
let port;
let cookie;

function requete(methode, chemin, { corps = null, avecCookie = true, origine = "bonne" } = {}) {
  return new Promise((resolve, reject) => {
    const data = corps === null ? null : Buffer.from(JSON.stringify(corps));
    const entetes = { Host: `127.0.0.1:${port}` };
    if (avecCookie && cookie) entetes.Cookie = cookie;
    if (origine === "bonne") entetes.Origin = `http://127.0.0.1:${port}`;
    else if (origine) entetes.Origin = origine;
    if (data) { entetes["Content-Type"] = "application/json"; entetes["Content-Length"] = data.length; }
    const req = http.request({ host: "127.0.0.1", port, method: methode, path: chemin, headers: entetes }, (res) => {
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
    if (data) req.write(data);
    req.end();
  });
}

const dl = () => path.join(m.maison, "Downloads");

before(async () => {
  m = monde();
  m.contenu("onze-slides", { format: "carrousel", titre: "Onze erreurs : à éviter / vraiment" });
  m.ecrire("depot/rendus/carrousels/onze-slides.md", "# Onze erreurs\n\n## Légende\n\nOnze.\n");
  // Numéros sans zéro, écrits dans le désordre : l'ordre alphabétique mettrait slide-10 avant slide-2.
  for (const i of [7, 10, 1, 2, 11, 3, 9, 4, 8, 5, 6]) m.ecrire(`Contenu/onze-slides/slides/slide-${i}.png`, `image ${i}`);
  m.ecrire("Contenu/onze-slides/slides/planche.jpg", "planche de contrôle");
  m.contenu("sans-slides", { format: "carrousel", titre: "Pas encore mis en page" });
  s = await demarrer({ env: { ...process.env, STUDIO_HOME: m.home, HOME: m.maison, STUDIO_SANS_FINDER: "1" }, silencieux: true });
  port = s.config.port;
  const bon = await requete("GET", `/?t=${s.jeton}`, { origine: null });
  cookie = bon.entetes["set-cookie"][0].split(";")[0];
});

after(async () => {
  await s?.arreter("tests");
  m?.nettoyer();
});

test("nom tiré du titre : lisible, sans ce que le Finder refuse", () => {
  assert.equal(nomDepuisTitre("Onze erreurs : à éviter / vraiment", "x"), "Onze erreurs à éviter vraiment");
  assert.equal(nomDepuisTitre("  ..caché", "x"), "caché");
  assert.equal(nomDepuisTitre("", "le-slug"), "le-slug");
});

test("Tout télécharger : un zip au nom du contenu, slides 01 à 11 dans l'ordre d'envoi, sans la planche", async () => {
  const r = await requete("POST", "/api/cartes/onze-slides/slides/telecharger", { corps: {} });
  assert.equal(r.statut, 200, r.texte);
  assert.equal(r.json.nom, "Onze erreurs à éviter vraiment.zip");
  assert.ok(!/[/\\]/.test(r.texte.replace(/\\u00../g, "")), "aucun chemin rendu");
  const zip = path.join(dl(), r.json.nom);
  const noms = execFileSync("unzip", ["-Z1", zip], { encoding: "utf8" }).trim().split("\n");
  assert.deepEqual(noms, Array.from({ length: 11 }, (_, i) => `${String(i + 1).padStart(2, "0")}.png`));
  for (let i = 1; i <= 11; i += 1) {
    assert.equal(execFileSync("unzip", ["-p", zip, `${String(i).padStart(2, "0")}.png`], { encoding: "utf8" }), `image ${i}`);
  }
  execFileSync("unzip", ["-tq", zip]); // contrôle des sommes : lève si le zip est abîmé
  assert.deepEqual(fs.readdirSync(dl()).filter((n) => n.startsWith(".")), [], "aucun fichier partiel laissé");

  const r2 = await requete("POST", "/api/cartes/onze-slides/slides/telecharger", { corps: {} });
  assert.equal(r2.json.nom, "Onze erreurs à éviter vraiment-2.zip", "jamais d'écrasement");
});

test("Télécharger cette slide : la bonne image, numérotée, et le rangement ne la reprend pas", async () => {
  const avant = Date.now() - 1000;
  const r = await requete("POST", "/api/cartes/onze-slides/slides/telecharger", { corps: { slide: 10 } });
  assert.equal(r.statut, 200, r.texte);
  assert.equal(r.json.nom, "Onze erreurs à éviter vraiment 10.png");
  assert.equal(fs.readFileSync(path.join(dl(), r.json.nom), "utf8"), "image 10");
  const r2 = await requete("POST", "/api/cartes/onze-slides/slides/telecharger", { corps: { slide: 2 } });
  assert.equal(fs.readFileSync(path.join(dl(), r2.json.nom), "utf8"), "image 2");
  process.env.ARRIVEES_CALME_S = "0";
  try {
    const a = arriveesPertinentes(dl(), avant);
    assert.deepEqual([...a.fichiers, ...a.en_cours].map((x) => x.nom), [], "jamais une arrivée à ranger");
  } finally { delete process.env.ARRIVEES_CALME_S; }
});

test("refus : sans jeton, mauvaise origine, slide qui n'existe pas, carrousel sans images", async () => {
  const sans = await requete("POST", "/api/cartes/onze-slides/slides/telecharger", { corps: {}, avecCookie: false });
  assert.equal(sans.statut, 401);
  const ailleurs = await requete("POST", "/api/cartes/onze-slides/slides/telecharger", { corps: {}, origine: "http://exemple.test" });
  assert.equal(ailleurs.statut, 403);
  const sansOrigine = await requete("POST", "/api/cartes/onze-slides/slides/telecharger", { corps: {}, origine: null });
  assert.equal(sansOrigine.statut, 403);
  for (const slide of [12, 0, -1, 1.5, "3", "../x"]) {
    const r = await requete("POST", "/api/cartes/onze-slides/slides/telecharger", { corps: { slide } });
    assert.ok([400, 404].includes(r.statut), `slide ${slide} : ${r.statut}`);
  }
  const vide = await requete("POST", "/api/cartes/sans-slides/slides/telecharger", { corps: {} });
  assert.equal(vide.statut, 404);
  assert.match(vide.json.message || vide.texte, /pas encore d'images/);
  const inconnu = await requete("POST", "/api/cartes/..%2F..%2Fetc/slides/telecharger", { corps: {} });
  assert.ok([400, 404].includes(inconnu.statut));
  // Rien de plus n'est arrivé dans Téléchargements.
  assert.equal(fs.readdirSync(dl()).filter((n) => !n.startsWith(".")).length, 4);
});
