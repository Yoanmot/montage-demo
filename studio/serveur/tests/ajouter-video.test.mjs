// « Ajouter une vidéo » et « changer le type » dans la vue Montage (studio de Yoan, 19/11/2026). Yoan avait un
// enregistrement d'écran hors plan de tournage, rangé par erreur en face caméra, et pas de moyen simple de le corriger.
// Ici : une vidéo du Mac s'envoie en flux au studio (plus de 1 Mo, la limite des routes JSON ne s'applique pas), se
// range comme un placement à la main, et une vidéo rangée change de type en un clic. Refus : jeton, contenu, format,
// taille, envoi coupé, rangement en cours, vidéo du montage, plan partagé.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { demarrer } from "../studio.mjs";
import { monde, attendreQue } from "./aide.mjs";
import { outil } from "../../rangement/lib/commun.mjs";
import { nomEnvoi } from "../serveur.mjs";

const SKIP = process.platform !== "darwin" && "macOS seulement";
const SLUG = "je-classe-ce-que-les-coachs-confient";
const nettoyages = [];
after(async () => { for (const f of nettoyages.reverse()) await f(); });

function requete(port, cookie, methode, chemin, { json, brut, entetes = {}, origine = true, couperApres = null } = {}) {
  return new Promise((resolve, reject) => {
    const data = json === undefined ? null : Buffer.from(JSON.stringify(json));
    const corps = data || brut || null;
    const req = http.request({ host: "127.0.0.1", port, method: methode, path: chemin, headers: {
      Host: `127.0.0.1:${port}`, ...(origine ? { Origin: `http://127.0.0.1:${port}` } : {}), ...(cookie ? { Cookie: cookie } : {}),
      ...(data ? { "Content-Type": "application/json" } : {}), ...(corps ? { "Content-Length": corps.length } : {}), ...entetes,
    } }, (res) => {
      const m = [];
      res.on("data", (x) => m.push(x));
      res.on("end", () => { const t = Buffer.concat(m).toString("utf8"); let j = null; try { j = JSON.parse(t); } catch { /* texte */ } resolve({ statut: res.statusCode, json: j }); });
    });
    req.on("error", (e) => (couperApres != null ? resolve({ statut: 0, coupe: true }) : reject(e)));
    if (couperApres != null) {
      // Un envoi arrêté en route (bouton « Arrêter l'envoi ») : une partie du fichier, puis la connexion coupe.
      req.write(corps.subarray(0, couperApres), () => setTimeout(() => req.destroy(), 150));
      return;
    }
    if (corps) {
      // En morceaux, comme un navigateur qui lit le fichier au fil de l'eau.
      for (let i = 0; i < corps.length; i += 256 * 1024) req.write(corps.subarray(i, i + 256 * 1024));
    }
    req.end();
  });
}

// Un contenu avec sa face caméra rangée (stade « rushs reçus »), et un autre contenu pour les plans partagés.
async function studio() {
  const m = monde();
  m.contenu(SLUG, { titre: "Ta tier list des usages de l'IA" });
  m.ecrire(`depot/contenus/${SLUG}/script.md`, "# Tier list\n\n## Texte complet\nSalut\n");
  m.contenu("autre-contenu", { titre: "Autre" });
  m.ecrire("depot/contenus/autre-contenu/script.md", "# Autre\n\n## Texte complet\nSalut\n");
  const s = await demarrer({ env: { ...m.env }, silencieux: true });
  const port = s.config.port;
  const r = await new Promise((ok, ko) => http.get({ host: "127.0.0.1", port, path: `/?t=${s.jeton}`, headers: { Host: `127.0.0.1:${port}` } }, ok).on("error", ko));
  r.resume();
  const cookie = String(r.headers["set-cookie"]).split(";")[0];
  nettoyages.push(async () => { await s.arreter("tests"); m.nettoyer(); });
  return { m, s, port, cookie, api: (methode, chemin, o) => requete(port, cookie, methode, chemin, o) };
}

// Une vraie vidéo de plus de 1 Mo (débit forcé), lisible par le rangement.
function video(dest) {
  const r = spawnSync(outil("ffmpeg"), ["-nostdin", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=720x1280:rate=30:duration=2",
    "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-b:v", "8M", "-minrate", "8M",
    "-maxrate", "8M", "-bufsize", "8M", "-c:a", "aac", "-shortest", dest], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return dest;
}
const route = (q) => `/api/cartes/${SLUG}/rushs/envoyer?${new URLSearchParams(q)}`;
const json = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const envoisVides = (m) => !fs.existsSync(path.join(m.home, "envois")) || fs.readdirSync(path.join(m.home, "envois")).length === 0;

test("nom d'un fichier envoyé : sans dossier, sans caractère piège, extension gardée", () => {
  assert.equal(nomEnvoi("2026-11-19 16-35-03.mov"), "2026-11-19 16-35-03.mov");
  assert.equal(nomEnvoi("../../etc/passwd.MOV"), "passwd.mov");
  assert.equal(nomEnvoi("..\\x\\.cache.mp4"), "cache.mp4");
  assert.equal(nomEnvoi("a:b\u0000c.mov"), "abc.mov");
  assert.equal(nomEnvoi(".mov"), "mov", "sans extension : refusé ensuite comme format inconnu");
  assert.equal(nomEnvoi("Écran $(rm -rf).mov"), "Écran _(rm -rf).mov");
});

test("une vidéo du Mac, envoyée en flux, se range en plan filmé en plus comme un placement à la main", { skip: SKIP }, async () => {
  const { m, api } = await studio();
  m.ecrire(`Contenu/${SLUG}/face/IMG_1.MOV`, "face");
  const source = video(path.join(m.racine, "Enregistrement 16-35.mov"));
  const corps = fs.readFileSync(source);
  assert.ok(corps.length > 1024 * 1024, `la vidéo de test doit dépasser 1 Mo (${corps.length})`);
  const q = { nom: "Enregistrement 16-35.mov", type: "b-roll" };
  assert.equal((await api("POST", route({ ...q, verifier: "1", taille: String(corps.length) }))).statut, 200);
  const r = await api("POST", route(q), { brut: corps, entetes: { "Content-Type": "application/octet-stream" } });
  assert.equal(r.statut, 200, JSON.stringify(r.json));
  assert.ok(fs.existsSync(source), "le fichier du Mac n'est pas touché");
  const liens = fs.readdirSync(path.join(m.media, SLUG, "b-roll"));
  assert.equal(liens.length, 1);
  const cible = fs.realpathSync(path.join(m.media, SLUG, "b-roll", liens[0]));
  assert.ok(cible.startsWith(fs.realpathSync(path.join(m.media, "_bibliotheque", "b-roll"))), cible);
  assert.equal(fs.statSync(cible).size, corps.length, "copie entière");
  const clip = Object.values(json(path.join(m.media, "_bibliotheque", "index.json")).clips)[0];
  assert.deepEqual([clip.origine, clip.contenus], ["Enregistrement 16-35.mov", [SLUG]]);
  const j = json(path.join(m.media, "_journal-rangement.json")).rangements.at(-1);
  assert.equal(j.commande, "placer", "même trace qu'un placement à la main (annulable)");
  assert.ok(envoisVides(m), "le dossier d'envoi est vidé");
  const d = (await api("GET", `/api/cartes/${SLUG}`)).json;
  const rush = d.montage.rushs.find((x) => x.type === "b-roll");
  assert.deepEqual(rush.changer, { vers: "face" });
  assert.deepEqual(d.montage.rushs.find((x) => x.type === "face").changer, { vers: "b-roll" });
});

test("refus : jeton, origine, contenu, format, type, taille, envoi coupé ; rien n'est rangé", { skip: SKIP }, async () => {
  const { m, port, api } = await studio();
  m.ecrire(`Contenu/${SLUG}/face/IMG_1.MOV`, "face");
  const corps = Buffer.alloc(2048, 1);
  const brut = { brut: corps };
  assert.equal((await requete(port, null, "POST", route({ nom: "a.mov", type: "b-roll" }), brut)).statut, 401);
  assert.equal((await api("POST", route({ nom: "a.mov", type: "b-roll" }), { ...brut, origine: false })).statut, 403);
  let r = await api("POST", "/api/cartes/Pas_Un_Slug/rushs/envoyer?nom=a.mov&type=b-roll", brut);
  assert.equal(r.statut, 404);
  r = await api("POST", "/api/cartes/inconnu-ici/rushs/envoyer?nom=a.mov&type=b-roll", brut);
  assert.equal(r.statut, 404);
  r = await api("POST", route({ nom: "facture.pdf", type: "b-roll" }), brut);
  assert.deepEqual([r.statut, r.json.erreur], [415, "FORMAT"]);
  assert.match(r.json.message, /vidéos \(MOV, MP4\)/);
  r = await api("POST", route({ nom: "a.mov", type: "photo" }), brut);
  assert.deepEqual([r.statut, r.json.erreur], [400, "TYPE"]);
  r = await api("POST", route({ nom: "a.mov", type: "autre" }), brut);
  assert.equal(r.statut, 400);
  r = await api("POST", route({ nom: "a.mov", type: "b-roll", verifier: "1", taille: String(21 * 1024 ** 3) }));
  assert.deepEqual([r.statut, r.json.erreur], [413, "TROP_GROS"]);
  assert.match(r.json.message, /20 Go/);
  // Un en-tête de taille de plus de 20 Go : refusé avant de lire quoi que ce soit.
  r = await api("POST", route({ nom: "a.mov", type: "b-roll" }), { brut: corps, entetes: { "Content-Length": String(21 * 1024 ** 3) }, couperApres: 10 });
  assert.ok(r.statut === 413 || r.coupe, JSON.stringify(r));
  // Envoi arrêté en route : rien n'est rangé et le dossier d'envoi est vidé.
  const gros = Buffer.alloc(4 * 1024 * 1024, 2);
  r = await api("POST", route({ nom: "coupe.mov", type: "b-roll" }), { brut: gros, couperApres: 512 * 1024 });
  assert.ok(r.coupe || r.statut === 400, JSON.stringify(r));
  await attendreQue(() => envoisVides(m), { delaiMs: 5000 });
  // Un fichier qui n'est pas une vidéo lisible : refusé proprement, rien ne reste.
  r = await api("POST", route({ nom: "faux.mov", type: "b-roll" }), brut);
  assert.deepEqual([r.statut, r.json.erreur], [400, "ILLISIBLE"]);
  assert.ok(envoisVides(m));
  assert.ok(!fs.existsSync(path.join(m.media, "_bibliotheque")), "rien en bibliothèque");
  assert.deepEqual(fs.readdirSync(path.join(m.media, SLUG)), ["face"]);
});

test("verrou du rangement : « un rangement est en cours, réessaie »", { skip: SKIP }, async () => {
  const { m, api } = await studio();
  m.ecrire(`Contenu/${SLUG}/face/IMG_1.MOV`, "face");
  // Le verrou d'un rangement vivant (ce processus-ci) ; un verrou laissé par un processus mort ne bloque rien.
  fs.writeFileSync(path.join(m.media, ".rangement.lock"), String(process.pid));
  for (const q of [{ verifier: "1", taille: "2048" }, {}]) {
    const r = await api("POST", route({ nom: "a.mov", type: "b-roll", ...q }), q.verifier ? {} : { brut: Buffer.alloc(2048) });
    assert.deepEqual([r.statut, r.json?.erreur], [409, "OCCUPE"]);
    assert.equal(r.json.message, "Un rangement est en cours : réessaie dans un instant.");
  }
  // Changer le type pendant un rangement : même réponse, rien ne bouge.
  const r = await api("POST", `/api/cartes/${SLUG}/rushs/type`, { json: { id: "face/IMG_1.MOV", type: "b-roll" } });
  assert.deepEqual([r.statut, r.json.erreur], [409, "OCCUPE"]);
  assert.equal(r.json.message, "Un rangement est en cours : réessaie dans un instant.");
  assert.ok(fs.existsSync(path.join(m.media, SLUG, "face", "IMG_1.MOV")));
});

test("changer le type : face caméra en plan filmé en plus, puis retour ; montage et plan partagé refusés", { skip: SKIP }, async () => {
  const { m, api } = await studio();
  fs.mkdirSync(path.join(m.media, SLUG, "face"), { recursive: true });
  video(path.join(m.media, SLUG, "face", "2026-11-19 16-35-03.mov"));
  m.ecrire(`Contenu/${SLUG}/face/IMG_9.MOV`, "face");
  // Ce que Yoan avait fait : un enregistrement d'écran rangé en face caméra. Un clic le remet en plan filmé en plus.
  let r = await api("POST", `/api/cartes/${SLUG}/rushs/type`, { json: { id: "face/2026-11-19 16-35-03.mov", type: "b-roll" } });
  assert.equal(r.statut, 200, JSON.stringify(r.json));
  assert.ok(!fs.existsSync(path.join(m.media, SLUG, "face", "2026-11-19 16-35-03.mov")));
  const [lien] = fs.readdirSync(path.join(m.media, SLUG, "b-roll"));
  const ix = json(path.join(m.media, "_bibliotheque", "index.json"));
  const id = lien.replace(/\.[^.]+$/, "");
  assert.deepEqual([ix.clips[id].origine, ix.clips[id].contenus], ["2026-11-19 16-35-03.mov", [SLUG]]);
  assert.ok(ix.clips[id].vignettes.length > 0, "vignettes faites");
  let d = (await api("GET", `/api/cartes/${SLUG}`)).json;
  assert.ok(d.montage.rushs.some((x) => x.id === `b-roll/${lien}` && x.changer?.vers === "face"));
  // Partagé avec un autre contenu : il ne peut pas devenir la face caméra de celui-ci (bouton grisé avec sa raison).
  ix.clips[id].contenus.push("autre-contenu");
  fs.writeFileSync(path.join(m.media, "_bibliotheque", "index.json"), JSON.stringify(ix));
  d = (await api("GET", `/api/cartes/${SLUG}`)).json;
  assert.equal(d.montage.rushs.find((x) => x.id === `b-roll/${lien}`).changer.impossible, "Ce plan sert aussi à un autre contenu.");
  r = await api("POST", `/api/cartes/${SLUG}/rushs/type`, { json: { id: `b-roll/${lien}`, type: "face" } });
  assert.deepEqual([r.statut, r.json.erreur], [409, "PARTAGE"]);
  ix.clips[id].contenus = [SLUG];
  fs.writeFileSync(path.join(m.media, "_bibliotheque", "index.json"), JSON.stringify(ix));
  // Retour en face caméra, sous son nom d'origine ; il quitte la bibliothèque.
  r = await api("POST", `/api/cartes/${SLUG}/rushs/type`, { json: { id: `b-roll/${lien}`, type: "face" } });
  assert.equal(r.statut, 200, JSON.stringify(r.json));
  assert.ok(fs.existsSync(path.join(m.media, SLUG, "face", "2026-11-19 16-35-03.mov")));
  assert.deepEqual(fs.readdirSync(path.join(m.media, SLUG, "b-roll")), []);
  assert.equal(json(path.join(m.media, "_bibliotheque", "index.json")).clips[id], undefined);
  d = (await api("GET", `/api/cartes/${SLUG}`)).json;
  const face = d.montage.rushs.find((x) => x.id === "face/2026-11-19 16-35-03.mov");
  assert.equal(face.detail, "Rangée ici par toi.");
  // Ce qui vient du montage ne se touche jamais ; un id douteux non plus.
  m.ecrire(`Contenu/${SLUG}/face/IMG_9-monte.mp4`, "montee");
  r = await api("POST", `/api/cartes/${SLUG}/rushs/type`, { json: { id: "face/IMG_9-monte.mp4", type: "b-roll" } });
  assert.equal(r.statut, 409);
  assert.ok(fs.existsSync(path.join(m.media, SLUG, "face", "IMG_9-monte.mp4")));
  for (const id2 of ["../x", "face/.cache", "photos/IMG_1.JPG"]) {
    assert.equal((await api("POST", `/api/cartes/${SLUG}/rushs/type`, { json: { id: id2, type: "b-roll" } })).statut, 404, id2);
  }
  assert.equal((await api("POST", `/api/cartes/${SLUG}/rushs/type`, { json: { id: "face/IMG_9.MOV", type: "face" } })).statut, 400);
});

test("après le début du montage : ni envoi ni changement de type", { skip: SKIP }, async () => {
  const { m, api } = await studio();
  m.ecrire(`Contenu/${SLUG}/face/IMG_1.MOV`, "face");
  m.ecrire(`Contenu/${SLUG}/face/IMG_1-monte.mp4`, "montee");
  let r = await api("POST", route({ nom: "a.mov", type: "b-roll", verifier: "1", taille: "2048" }));
  assert.deepEqual([r.statut, r.json.erreur], [409, "TROP_TARD"]);
  r = await api("POST", `/api/cartes/${SLUG}/rushs/type`, { json: { id: "face/IMG_1.MOV", type: "b-roll" } });
  assert.deepEqual([r.statut, r.json.erreur], [409, "TROP_TARD"]);
  assert.ok(fs.existsSync(path.join(m.media, SLUG, "face", "IMG_1.MOV")));
});
