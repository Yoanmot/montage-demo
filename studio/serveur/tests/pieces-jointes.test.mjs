// Fichiers joints dans le chat (22/11/2026, demande de Yoan : « joindre le logo de mon app pour que le monteur le pose
// dans la vidéo et que le head of content le mette dans une ressource gratuite »). Un fichier part en flux dès qu'il est
// choisi, puis le message l'emporte : rangé dans le dépôt (dossier du contenu, ou dossier commun), enregistré dans git,
// montré sous la bulle, et son chemin donné à l'agent. Refus : vidéo, trop lourd, fichier de clés, autre chat.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { demarrer } from "../studio.mjs";
import { monde, attendreQue, depotGit, git } from "./aide.mjs";
import { nomJoint, genreJoint, refusJoint, placerJoint, dossierJoints, ligneJoints, JOINT_MAX } from "../joints.mjs";
import { consigneStudio, reglagesChat } from "../reglages.mjs";

const SLUG = "le-logo-de-mon-app";
const nettoyages = [];
after(async () => { for (const f of nettoyages.reverse()) await f(); });

// Une image PNG de 1 x 1 pixel.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

function requete(port, cookie, methode, chemin, { json, brut } = {}) {
  return new Promise((resolve, reject) => {
    const data = json === undefined ? null : Buffer.from(JSON.stringify(json));
    const corps = data || brut || null;
    const req = http.request({ host: "127.0.0.1", port, method: methode, path: chemin, headers: {
      Host: `127.0.0.1:${port}`, Origin: `http://127.0.0.1:${port}`, Cookie: cookie,
      ...(data ? { "Content-Type": "application/json" } : {}), ...(corps ? { "Content-Length": corps.length } : {}),
    } }, (res) => {
      const m = [];
      res.on("data", (x) => m.push(x));
      res.on("end", () => { const b = Buffer.concat(m); let j = null; try { j = JSON.parse(b.toString("utf8")); } catch { /* binaire */ } resolve({ statut: res.statusCode, json: j, corps: b, type: res.headers["content-type"] }); });
    });
    req.on("error", reject);
    if (corps) req.write(corps);
    req.end();
  });
}

async function studio() {
  const m = monde();
  m.contenu(SLUG, { titre: "Le logo de mon app" });
  m.ecrire(`depot/contenus/${SLUG}/script.md`, "# Logo\n\n## Texte complet\nSalut\n");
  const distant = depotGit(m);
  // Les sessions du serveur partent avec l'environnement du processus (comme dans serveur.test.mjs).
  process.env.FAUX_CLAUDE_JOURNAL = m.journalClaude;
  const s = await demarrer({ env: { ...m.env }, silencieux: true });
  const port = s.config.port;
  const r = await new Promise((ok, ko) => http.get({ host: "127.0.0.1", port, path: `/?t=${s.jeton}`, headers: { Host: `127.0.0.1:${port}` } }, ok).on("error", ko));
  r.resume();
  const cookie = String(r.headers["set-cookie"]).split(";")[0];
  nettoyages.push(async () => { await s.arreter("tests"); m.nettoyer(); });
  const api = (methode, chemin, o) => requete(port, cookie, methode, chemin, o);
  const joindre = (chat, nom, brut = PNG) => api("POST", `/api/chats/${encodeURIComponent(chat)}/joints?${new URLSearchParams({ nom })}`, { brut });
  return { m, s, distant, api, joindre };
}

const messages = (m) => m.lancements().filter((x) => x.evenement === "message").map((x) => x.texte);

test("nom d'un fichier joint : sans dossier, sans caractère piège, extension propre", () => {
  assert.equal(nomJoint("logo.png"), "logo.png");
  assert.equal(nomJoint("../../etc/.ssh/id.PNG"), "id.png");
  assert.equal(nomJoint("..\\x\\.profile"), "profile");
  assert.equal(nomJoint("a<b>|c?.png"), "a_b__c_.png");
  assert.equal(nomJoint("x.p$ng"), "x.png");
  assert.equal(nomJoint("..."), "fichier");
  assert.equal(nomJoint("logo:\u0000\u001f.svg"), "logo.svg");
  assert.equal(nomJoint("Logo App.PNG"), "Logo App.png");
  assert.ok(nomJoint("x".repeat(400) + ".png").length <= 104);
});

test("refus d'un fichier joint : vidéo (vers la Galerie), trop lourd, vide, fichier de clés", () => {
  assert.equal(genreJoint("logo.png"), "image");
  assert.equal(genreJoint("rush.mov"), "video");
  assert.equal(genreJoint("notes.pdf"), "autre");
  assert.equal(refusJoint("logo.png", 1000), null);
  assert.equal(refusJoint("police.otf", 1000), null);
  const v = refusJoint("rush.mp4", 1000, { contenu: true });
  assert.equal(v.code, "VIDEO");
  assert.match(v.message, /Galerie/);
  assert.match(v.message, /Montage pour ce contenu/);
  assert.doesNotMatch(refusJoint("rush.webm", 1000).message, /Montage/);
  assert.equal(refusJoint("logo.png", JOINT_MAX + 1).code, "TROP_GROS");
  assert.equal(refusJoint("logo.png", JOINT_MAX), null);
  assert.equal(refusJoint("logo.png", 0).code, "TAILLE");
  assert.equal(refusJoint("cle.env", 10).code, "FORMAT");
  for (const r of [v, refusJoint("logo.png", JOINT_MAX + 1)]) assert.ok(!r.message.includes("\u2014"));
});

test("rangement : dossier du contenu ou dossier commun, doublon de nom renommé (casse comprise)", () => {
  const m = monde();
  nettoyages.push(() => m.nettoyer());
  assert.equal(dossierJoints({ genre: "hoc", slug: "x" }), "contenus/x/fichiers-joints");
  assert.equal(dossierJoints({ genre: "monteur", slug: "x" }), "contenus/x/fichiers-joints");
  assert.equal(dossierJoints({ genre: "general" }), "fichiers-joints");
  assert.equal(dossierJoints({ genre: "tournage", id: "t1" }), "fichiers-joints");
  const src = m.ecrire("envoi/logo.png", "a");
  assert.deepEqual(placerJoint(m.depot, "joints", src, "logo.png"), { fichier: "logo.png", relatif: "joints/logo.png" });
  assert.equal(placerJoint(m.depot, "joints", src, "logo.png").fichier, "logo 2.png");
  assert.equal(placerJoint(m.depot, "joints", src, "logo.png").fichier, "logo 3.png");
  if (process.platform === "darwin") assert.equal(placerJoint(m.depot, "joints", src, "LOGO.png").fichier, "LOGO 4.png");
  assert.equal(fs.readFileSync(path.join(m.depot, "joints", "logo.png"), "utf8"), "a");
  const l = ligneJoints("Yoan", m.depot, [{ relatif: "joints/logo.png", genre: "image" }, { relatif: "joints/notes.pdf", genre: "autre" }]);
  assert.match(l, /^Fichiers joints par Yoan/);
  assert.ok(l.includes(path.join(m.depot, "joints/logo.png")));
  assert.ok(l.includes(path.join(m.depot, "joints/notes.pdf")));
});

test("chat d'un contenu : le fichier est rangé dans le contenu, enregistré, montré, et son chemin donné à l'agent", async () => {
  const { m, api, joindre, distant } = await studio();
  const chat = `${SLUG}:hoc`;
  const e = await joindre(chat, "../../Logo de mon app.PNG");
  assert.equal(e.statut, 200, JSON.stringify(e.json));
  assert.equal(e.json.nom, "Logo de mon app.png");
  assert.equal(e.json.genre, "image");
  // Pas encore dans le dépôt : il attend l'envoi du message.
  assert.ok(!fs.existsSync(path.join(m.depot, "contenus", SLUG, "fichiers-joints")));

  const r = await api("POST", `/api/chats/${encodeURIComponent(chat)}/messages`, { json: { texte: "Mets ce logo dans la ressource", joints: [e.json.id] } });
  assert.equal(r.statut, 200, JSON.stringify(r.json));
  const range = path.join(m.depot, "contenus", SLUG, "fichiers-joints", "Logo de mon app.png");
  assert.deepEqual(fs.readFileSync(range), PNG);
  // Le fichier d'attente est parti.
  assert.equal(fs.readdirSync(path.join(m.home, "envois")).length, 0);

  const texte = await attendreQue(() => messages(m).find((t) => /Fichiers joints par/.test(t)));
  assert.match(texte, /Mets ce logo dans la ressource/);
  assert.ok(texte.includes(range), texte);
  assert.match(texte, /lis ce chemin pour la regarder/);

  // Enregistré dans git et poussé, seul dans son enregistrement.
  const log = git(distant, "log", "-1", "--name-only", "--format=%s", "main");
  assert.match(log, /fichiers joints/);
  assert.ok(log.includes(`contenus/${SLUG}/fichiers-joints/Logo de mon app.png`));
  assert.equal(log.trim().split("\n").filter(Boolean).length, 2);

  // L'historique montre la pièce jointe, sans chemin.
  const h = await api("GET", `/api/chats/${encodeURIComponent(chat)}`);
  const msg = h.json.messages.find((x) => x.role === "romain");
  assert.equal(msg.texte, "Mets ce logo dans la ressource");
  assert.deepEqual(msg.joints, [{ fichier: "Logo de mon app.png", genre: "image", taille: PNG.length }]);
  assert.ok(!JSON.stringify(msg).includes(m.depot));

  // La vignette : servie pour ce chat, jamais hors du dossier des fichiers joints.
  const v = await api("GET", `/api/chats/${encodeURIComponent(chat)}/joints/${encodeURIComponent("Logo de mon app.png")}`);
  assert.equal(v.statut, 200);
  assert.equal(v.type, "image/png");
  for (const piege of ["..%2Fetat.json", "%2E%2E", "script.md", "..%2F..%2FREADME.md"]) {
    assert.equal((await api("GET", `/api/chats/${encodeURIComponent(chat)}/joints/${piege}`)).statut, 404, piege);
  }

  // « Autres fichiers » du contenu le montre (groupe « joints »).
  const c = await api("GET", `/api/cartes/${SLUG}`);
  assert.ok(c.json.autres?.some((f) => f.url.includes("/fichiers/fichiers-joints/Logo%20de%20mon%20app.png") && f.dossier === "fichiers-joints" && f.genre === "image"), JSON.stringify(c.json.autres));
});

test("doublon de nom, fichier seul sans texte, dossier commun du chat général", async () => {
  const { m, api, joindre } = await studio();
  const envoyer = async (chat, joints, texte = "") => api("POST", `/api/chats/${encodeURIComponent(chat)}/messages`, { json: { texte, joints } });
  const a = await joindre("general", "logo.png");
  const b = await joindre("general", "logo.png");
  const r = await envoyer("general", [a.json.id, b.json.id]);
  assert.equal(r.statut, 200, JSON.stringify(r.json));
  assert.deepEqual(fs.readdirSync(path.join(m.depot, "fichiers-joints")).sort(), ["logo 2.png", "logo.png"]);
  const h = await api("GET", "/api/chats/general");
  const msg = h.json.messages.find((x) => x.role === "romain");
  assert.equal(msg.texte, "");
  assert.deepEqual(msg.joints.map((j) => j.fichier), ["logo.png", "logo 2.png"]);
  const texte = await attendreQue(() => messages(m).find((t) => /Fichiers joints par/.test(t)));
  assert.ok(texte.includes(path.join(m.depot, "fichiers-joints", "logo 2.png")));
  // Un deuxième message avec le même nom : un troisième nom, rien d'écrasé.
  const c = await joindre("general", "logo.png");
  assert.equal((await envoyer("general", [c.json.id], "et celui-là")).statut, 200);
  assert.ok(fs.existsSync(path.join(m.depot, "fichiers-joints", "logo 3.png")));
});

test("refus : vidéo, trop lourd, fichier d'un autre chat, déjà envoyé, retiré, message vide", async () => {
  const { m, api, joindre } = await studio();
  const route = (chat, q) => `/api/chats/${encodeURIComponent(chat)}/joints?${new URLSearchParams(q)}`;
  const v = await api("POST", route("general", { nom: "rush.MOV", verifier: "1", taille: "1000" }));
  assert.equal(v.statut, 415);
  assert.match(v.json.message, /Galerie/);
  assert.equal((await joindre("general", "rush.mp4")).statut, 415);
  const g = await api("POST", route("general", { nom: "logo.png", verifier: "1", taille: String(JOINT_MAX + 1) }));
  assert.equal(g.statut, 413);
  assert.match(g.json.message, /20 Mo/);
  assert.equal((await api("POST", route("inconnu:hoc", { nom: "logo.png", verifier: "1", taille: "10" }))).statut, 404);
  assert.equal((await api("POST", route("general", { nom: "logo.png", verifier: "1", taille: "10" }))).statut, 200);

  const a = await joindre(`${SLUG}:hoc`, "logo.png");
  const envoyer = (chat, json) => api("POST", `/api/chats/${encodeURIComponent(chat)}/messages`, { json });
  // Joint dans le chat du contenu, envoyé dans le chat général : refusé, rien rangé.
  const autre = await envoyer("general", { texte: "tiens", joints: [a.json.id] });
  assert.equal(autre.statut, 409);
  assert.equal(autre.json.erreur, "JOINT_PERDU");
  assert.equal((await envoyer("general", { texte: "tiens", joints: ["e-inconnu"] })).statut, 409);
  assert.equal((await envoyer("general", { texte: "", joints: [] })).statut, 400);
  assert.equal((await envoyer("general", { texte: "x", joints: Array.from({ length: 11 }, (_, i) => `e-${i}`) })).statut, 400);
  assert.ok(!fs.existsSync(path.join(m.depot, "fichiers-joints")));
  // Retiré (la croix) : le fichier d'attente part, l'identifiant ne sert plus.
  assert.equal((await api("POST", `/api/chats/${encodeURIComponent(`${SLUG}:hoc`)}/joints/${a.json.id}/retirer`, { json: {} })).statut, 200);
  assert.equal(fs.readdirSync(path.join(m.home, "envois")).length, 0);
  assert.equal((await envoyer(`${SLUG}:hoc`, { texte: "tiens", joints: [a.json.id] })).statut, 409);
  // Envoyé une fois : l'identifiant ne sert plus.
  const b = await joindre("general", "notes.txt", Buffer.from("des notes"));
  assert.equal((await envoyer("general", { texte: "1", joints: [b.json.id] })).statut, 200);
  assert.equal((await envoyer("general", { texte: "2", joints: [b.json.id] })).statut, 409);
  assert.equal(fs.readFileSync(path.join(m.depot, "fichiers-joints", "notes.txt"), "utf8"), "des notes");
});

test("chat du monteur : rangé dans le contenu du dépôt, que la session du monteur peut lire", async () => {
  const { m, api, joindre } = await studio();
  fs.mkdirSync(path.join(m.media, SLUG), { recursive: true });
  const chat = `${SLUG}:monteur`;
  const a = await joindre(chat, "logo.png");
  assert.equal((await api("POST", `/api/chats/${encodeURIComponent(chat)}/messages`, { json: { texte: "Pose le logo en bas à droite", joints: [a.json.id] } })).statut, 200);
  const range = path.join(m.depot, "contenus", SLUG, "fichiers-joints", "logo.png");
  const texte = await attendreQue(() => messages(m).find((t) => /Fichiers joints par/.test(t)));
  assert.ok(texte.includes(range));
  // Le monteur travaille dans le dossier des médias : le dossier des contenus du dépôt lui est ouvert.
  const r = reglagesChat(chat, m.config);
  const i = r.args.indexOf("--add-dir");
  assert.ok(i >= 0);
  const dossiers = r.args.filter((_, k) => r.args[k - 1] === "--add-dir");
  assert.ok(dossiers.some((d) => range.startsWith(path.resolve(d) + path.sep)), JSON.stringify(dossiers));
  assert.ok(r.args[r.args.indexOf("--allowedTools") + 1].split(/[ ,]/).includes("Read"));
});

test("photo HEIC jointe : rangée en JPEG, que l'agent et le navigateur savent lire", { skip: process.platform !== "darwin" && "macOS seulement" }, async () => {
  const { m, api, joindre } = await studio();
  const png = m.ecrire("x/photo.png", PNG);
  const heic = path.join(m.racine, "x", "photo.heic");
  const s = spawnSync("/usr/bin/sips", ["-s", "format", "heic", png, "--out", heic], { encoding: "utf8" });
  if (s.status !== 0 || !fs.existsSync(heic)) return;
  const a = await joindre("general", "IMG_0001.HEIC", fs.readFileSync(heic));
  assert.equal(a.statut, 200);
  assert.equal((await api("POST", "/api/chats/general/messages", { json: { texte: "", joints: [a.json.id] } })).statut, 200);
  const jpg = path.join(m.depot, "fichiers-joints", "IMG_0001.jpg");
  assert.ok(fs.existsSync(jpg));
  assert.deepEqual([...fs.readFileSync(jpg).subarray(0, 2)], [0xff, 0xd8]);
  const h = await api("GET", "/api/chats/general");
  assert.equal(h.json.messages.find((x) => x.role === "romain").joints[0].fichier, "IMG_0001.jpg");
});

test("consigne des sessions : un fichier joint est une matière fournie, on s'en sert là où il le demande", () => {
  for (const c of [consigneStudio("Yoan", "Yoan"), consigneStudio("Romain", "Yoan")]) {
    assert.match(c, /joint à son message/);
    assert.match(c, /logo posé dans la vidéo/);
    assert.match(c, /ne le déplace pas/);
    assert.ok(!c.includes("\u2014"));
  }
});
