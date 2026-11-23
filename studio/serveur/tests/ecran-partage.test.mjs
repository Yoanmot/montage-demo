// Écran partagé (studio de Yoan, 23/11/2026) : sa caméra en haut, son écran en bas. L'enregistrement d'écran est fait
// sur le Mac (pas d'AirDrop) : il entre par « Ajouter une vidéo », type « Enregistrement d'écran », rangé dans le dossier
// du contenu (ecran/), à côté de la face caméra, et donné au monteur dans son premier message. Chez Romain, ce type
// n'existe pas (ajouter-video.test.mjs).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

process.env.STUDIO_CLIENT = "yoan";
const { demarrer } = await import("../studio.mjs");
const { monde } = await import("./aide.mjs");
const { outil } = await import("../../rangement/lib/commun.mjs");
const { messageAction } = await import("../file.mjs");

const SKIP = process.platform !== "darwin" && "macOS seulement";
const SLUG = "ma-mindmap-des-outils";
const nettoyages = [];
after(async () => { for (const f of nettoyages.reverse()) await f(); });

function requete(port, cookie, methode, chemin, { json, brut, entetes = {} } = {}) {
  return new Promise((resolve, reject) => {
    const data = json === undefined ? null : Buffer.from(JSON.stringify(json));
    const corps = data || brut || null;
    const req = http.request({ host: "127.0.0.1", port, method: methode, path: chemin, headers: {
      Host: `127.0.0.1:${port}`, Origin: `http://127.0.0.1:${port}`, Cookie: cookie,
      ...(data ? { "Content-Type": "application/json" } : {}), ...(corps ? { "Content-Length": corps.length } : {}), ...entetes,
    } }, (res) => {
      const m = [];
      res.on("data", (x) => m.push(x));
      res.on("end", () => { const t = Buffer.concat(m).toString("utf8"); let j = null; try { j = JSON.parse(t); } catch { /* texte */ } resolve({ statut: res.statusCode, json: j }); });
    });
    req.on("error", reject);
    if (corps) req.write(corps);
    req.end();
  });
}

async function studio() {
  const m = monde();
  m.contenu(SLUG, { titre: "Ma mindmap des outils" });
  m.ecrire(`depot/contenus/${SLUG}/script.md`, "# Mindmap\n\n## Texte complet\nSalut\n");
  const s = await demarrer({ env: { ...m.env }, silencieux: true });
  const port = s.config.port;
  const r = await new Promise((ok, ko) => http.get({ host: "127.0.0.1", port, path: `/?t=${s.jeton}`, headers: { Host: `127.0.0.1:${port}` } }, ok).on("error", ko));
  r.resume();
  const cookie = String(r.headers["set-cookie"]).split(";")[0];
  nettoyages.push(async () => { await s.arreter("tests"); m.nettoyer(); });
  return { m, s, api: (methode, chemin, o) => requete(port, cookie, methode, chemin, o) };
}

function video(dest) {
  const r = spawnSync(outil("ffmpeg"), ["-nostdin", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=1080x960:rate=30:duration=2",
    "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", dest], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return dest;
}
const route = (q) => `/api/cartes/${SLUG}/rushs/envoyer?${new URLSearchParams(q)}`;
const NOM = "2026-11-23 15-02-41.mp4";

test("enregistrement d'écran : envoyé depuis le Mac, rangé dans le dossier du contenu à côté de la face caméra", { skip: SKIP }, async () => {
  const { m, api } = await studio();
  m.ecrire(`Contenu/${SLUG}/face/IMG_1.MOV`, "face");
  const corps = fs.readFileSync(video(path.join(m.racine, NOM)));
  const etat = (await api("GET", "/api/etat")).json;
  assert.equal(etat.config.ecran_partage, true, "le type est proposé chez Yoan");
  // une photo n'est pas un enregistrement d'écran
  let r = await api("POST", route({ nom: "a.jpg", type: "ecran" }), { brut: Buffer.alloc(10, 1) });
  assert.deepEqual([r.statut, r.json.erreur], [400, "TYPE"]);
  r = await api("POST", route({ nom: NOM, type: "ecran" }), { brut: corps, entetes: { "Content-Type": "application/octet-stream" } });
  assert.equal(r.statut, 200, JSON.stringify(r.json));
  const range = path.join(m.media, SLUG, "ecran", NOM);
  assert.equal(fs.statSync(range).size, corps.length, "copie entière, fichier réel (pas dans la Galerie)");
  assert.ok(!fs.existsSync(path.join(m.racine, "Galerie")) || fs.readdirSync(path.join(m.racine, "Galerie")).every((x) => x.startsWith(".") || x === "index.json" || x === "fiches"));
  const j = JSON.parse(fs.readFileSync(path.join(m.media, "_journal-rangement.json"), "utf8")).rangements.at(-1);
  assert.equal(j.commande, "placer", "annulable comme un placement à la main");
  const d = (await api("GET", `/api/cartes/${SLUG}`)).json;
  const rush = d.montage.rushs.find((x) => x.type === "ecran");
  assert.deepEqual([rush.id, rush.titre, rush.changer], [`ecran/${NOM}`, "Enregistrement d'écran", undefined]);
  assert.doesNotMatch(JSON.stringify(rush), /\/Users|Contenu\//, "aucun chemin affiché");
  // le premier message du monteur le donne
  const msg = messageAction({ type: "montage", slug: SLUG }, m.config);
  assert.match(msg, new RegExp(`Ce reel est en écran partagé .*Son enregistrement d'écran : ${range.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\. Suis « Écran partagé »`));
  // « Pas la bonne » : il repart à placer, comme une face caméra
  r = await api("POST", `/api/cartes/${SLUG}/rushs/retirer`, { json: { id: `ecran/${NOM}` } });
  assert.equal(r.statut, 200, JSON.stringify(r.json));
  assert.ok(!fs.existsSync(range) && fs.existsSync(path.join(m.media, "_a-ranger", NOM)));
});

test("plan de tournage en écran partagé sans enregistrement d'écran : dit dans Montage et au monteur ; sinon rien", () => {
  const m = monde();
  try {
    m.contenu(SLUG, { titre: "Ma mindmap des outils" });
    m.ecrire(`depot/contenus/${SLUG}/script.md`, "# Mindmap\n\n## Texte complet\nSalut\n");
    m.ecrire(`Contenu/${SLUG}/face/IMG_1.MOV`, "face");
    assert.doesNotMatch(messageAction({ type: "montage", slug: SLUG }, m.config), /écran partagé/, "face caméra normale : rien de plus");
    m.json("depot/tournages/2026-11-23-1500.json", { version: 1, id: "2026-11-23-1500", cree_le: "2026-11-23T15:00:00+01:00",
      contenus: [SLUG], duree_estimee_min: 10, prises: [{ n: 1, type: "face", genre: "ecran_partage", mindmap: "https://exemple.org/mindmap",
        contenus: [{ slug: SLUG, usages: [] }], lieu: "", materiel: [], ce_qu_on_voit: "toi et ta mindmap", mouvements: [], duree_s: 60, deja_en_bibliotheque: null }] });
    assert.match(messageAction({ type: "montage", slug: SLUG }, m.config), /prévoit ce reel en écran partagé, mais son enregistrement d'écran n'est pas encore rangé/);
    // le brief seul suffit aussi (ligne de l'en-tête, contrat section 5.1)
    m.ecrire(`depot/tournages/2026-11-23-1500.json`, "{}");
    m.ecrire(`depot/contenus/${SLUG}/script.md`, "# Mindmap\n\n- Écran partagé : mindmap https://exemple.org/m/x/\n\n## Texte complet\nSalut\n");
    assert.match(messageAction({ type: "montage", slug: SLUG }, m.config), /prévoit ce reel en écran partagé/);
  } finally { m.nettoyer(); }
});
