// Lot 8 du studio de Yoan (2026-11-18) : l'aperçu sans rendu dans le fichier Montage. Stade et libellé, médias de
// l'aperçu, notes de correction (fichier du dossier de montage + chat du monteur), « Fabrique la vidéo », cadres des
// calques autorisés sur le studio seulement, Range sur la vidéo légère, calcul des zooms identique au rendu.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { demarrer } from "../studio.mjs";
import { traitsPropres, zoneDe, instantLisible } from "../serveur.mjs";
import { monde, attendreQue } from "./aide.mjs";
import { zoomA, planA } from "../../interface/app/apercu-calcul.js";

let m, s, port, cookie;
const SLUG = "avec-apercu";
const MONTAGE = `Contenu/${SLUG}/face/IMG_1-montage`;

function requete(methode, chemin, { corps, entetes = {} } = {}) {
  return new Promise((resolve, reject) => {
    const data = corps === undefined ? null : JSON.stringify(corps);
    const req = http.request({ host: "127.0.0.1", port, method: methode, path: chemin, headers: {
      Host: `127.0.0.1:${port}`, Origin: `http://127.0.0.1:${port}`, Cookie: cookie,
      ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}), ...entetes } }, (res) => {
      const morceaux = [];
      res.on("data", (x) => morceaux.push(x));
      res.on("end", () => { const texte = Buffer.concat(morceaux).toString("utf8"); let json = null; try { json = JSON.parse(texte); } catch { /* rien */ }
        resolve({ statut: res.statusCode, entetes: res.headers, texte, json }); });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

before(async () => {
  m = monde();
  process.env.FAUX_CLAUDE_JOURNAL = m.journalClaude;
  m.contenu(SLUG, { titre: "Avec aperçu" });
  m.ecrire(`depot/contenus/${SLUG}/script.md`, "# Avec aperçu\n\n## Texte complet\nSalut\n");
  m.ecrire(`Contenu/${SLUG}/face/IMG_1.mov`, "video");
  m.json(`${MONTAGE}/apercu/apercu.json`, { version: 1, fps: 30, images: 300, couches: ["coupes", "zooms"],
    camera: { fichier: "apercu/camera-abc.mp4", largeur: 720, hauteur: 1280 }, zooms: [], decalages: [], flous: [], brolls: [], calques: [] });
  m.ecrire(`${MONTAGE}/apercu/camera-abc.mp4`, "0123456789abcdef");
  m.ecrire(`${MONTAGE}/calques/a01/index.html`, "<!doctype html><p>calque</p>");
  m.ecrire(`${MONTAGE}/planche/planche.png`, "png");   // une ancienne planche à côté : l'aperçu passe devant
  m.contenu("sans-apercu", { titre: "Sans aperçu" });
  m.ecrire("Contenu/sans-apercu/face/IMG_2.mov", "video");
  s = await demarrer({ env: { ...process.env, STUDIO_HOME: m.home, HOME: m.maison }, silencieux: true });
  port = s.config.port;
  cookie = `studio=${s.jeton}`;
});

after(async () => {
  await s?.arreter("tests");
  m?.nettoyer();
});

test("aperçu : stade « aperçu à valider », médias de l'aperçu à la place de la planche", async () => {
  const d = (await requete("GET", `/api/cartes/${SLUG}`)).json;
  assert.equal(d.stade, "planche");
  assert.equal(d.libelle, "aperçu à valider");
  assert.match(d.medias.apercu.url, new RegExp(`^/api/media/${SLUG}/face/IMG_1-montage/apercu/apercu\\.json\\?v=\\d+$`));
  assert.equal(d.medias.apercu.base, `/api/media/${SLUG}/face/IMG_1-montage/`);
  assert.deepEqual(d.medias.apercu.notes, []);
  assert.equal(d.medias.planche, undefined, "l'aperçu remplace la planche");
  assert.ok(d.fichiers.includes("montage"));
});

test("aperçu : la vidéo légère se lit par morceaux, les calques se jouent dans un cadre du studio seulement", async () => {
  const base = `/api/media/${SLUG}/face/IMG_1-montage`;
  const r = await requete("GET", `${base}/apercu/camera-abc.mp4`, { entetes: { Range: "bytes=4-7" } });
  assert.equal(r.statut, 206);
  assert.equal(r.texte, "4567");
  assert.equal(r.entetes["content-range"], "bytes 4-7/16");
  const h = await requete("GET", `${base}/calques/a01/index.html`);
  assert.equal(h.statut, 200);
  assert.equal(h.entetes["x-frame-options"], "SAMEORIGIN");
  assert.equal((await requete("GET", "/api/etat")).entetes["x-frame-options"], "DENY");
});

test("aperçu : une note s'écrit dans le dossier de montage et part au chat du monteur, avec image et zone", async () => {
  const traits = [[[0.2, 0.3], [0.5, 0.31], [0.45, 0.6]], [[0.3, 0.4]]];
  const r = await requete("POST", `/api/cartes/${SLUG}/apercu/notes`, { corps: { image: 75, texte: "Le titre passe sur mon visage", traits } });
  assert.equal(r.statut, 200, r.texte);
  const f = JSON.parse(fs.readFileSync(path.join(m.racine, MONTAGE, "notes-apercu.json"), "utf8"));
  assert.equal(f.notes.length, 1);
  const n = f.notes[0];
  assert.equal(n.n, 1); assert.equal(n.image, 75); assert.equal(n.instant, 2.5);
  assert.equal(n.texte, "Le titre passe sur mon visage");
  assert.deepEqual(n.zone, { x: 0.2, y: 0.3, l: 0.3, h: 0.3 });
  assert.deepEqual(n.traits, traits);
  const msg = await attendreQue(() => m.lancements().find((x) => x.evenement === "message" && /Note de correction/.test(x.texte)));
  assert.match(msg.texte, /image 75 de la vidéo coupée \(2\.5 s\)/);
  assert.match(msg.texte, /« Le titre passe sur mon visage »/);
  assert.match(msg.texte, /x de 0\.2 à 0\.5, y de 0\.3 à 0\.6/);
  assert.ok(msg.texte.includes(path.join(m.racine, MONTAGE, "notes-apercu.json")));
  const chat = (await requete("GET", `/api/chats/${encodeURIComponent(`${SLUG}:monteur`)}`)).json;
  assert.ok(chat.messages.some((x) => x.role === "romain" && x.texte === "À 0:02.5 (image 75) : Le titre passe sur mon visage (zone entourée)"));
  await attendreQue(() => !s.pont.actif(`${SLUG}:monteur`));
  const d = (await requete("GET", `/api/cartes/${SLUG}`)).json;
  assert.deepEqual(d.medias.apercu.notes.map((x) => [x.n, x.image, x.texte, x.prise]), [[1, 75, "Le titre passe sur mon visage", false]]);
  // Deuxième note, sans zone : numérotée à la suite.
  assert.equal((await requete("POST", `/api/cartes/${SLUG}/apercu/notes`, { corps: { image: 0, texte: "Coupe le début" } })).statut, 200);
  const f2 = JSON.parse(fs.readFileSync(path.join(m.racine, MONTAGE, "notes-apercu.json"), "utf8"));
  assert.deepEqual(f2.notes.map((x) => [x.n, x.zone]), [[1, n.zone], [2, null]]);
  await attendreQue(() => m.lancements().some((x) => x.evenement === "message" && /Pas de zone entourée/.test(x.texte)));
  await attendreQue(() => !s.pont.actif(`${SLUG}:monteur`));
});

test("aperçu : une note refaite après l'aperçu compte comme retouchée", async () => {
  const f = path.join(m.racine, MONTAGE, "apercu", "apercu.json");
  const plusTard = new Date(Date.now() + 60000);
  fs.utimesSync(f, plusTard, plusTard);
  const d = (await requete("GET", `/api/cartes/${SLUG}`)).json;
  assert.ok(d.medias.apercu.notes.every((x) => x.prise));
});

test("aperçu : notes refusées (vide, image hors vidéo, pas d'aperçu)", async () => {
  assert.equal((await requete("POST", `/api/cartes/${SLUG}/apercu/notes`, { corps: { image: 3, texte: "  " } })).statut, 400);
  assert.equal((await requete("POST", `/api/cartes/${SLUG}/apercu/notes`, { corps: { image: 300, texte: "x" } })).statut, 400);
  assert.equal((await requete("POST", `/api/cartes/${SLUG}/apercu/notes`, { corps: { image: 1.5, texte: "x" } })).statut, 400);
  const r = await requete("POST", "/api/cartes/sans-apercu/apercu/notes", { corps: { image: 1, texte: "x" } });
  assert.equal(r.statut, 409);
  assert.equal(r.json.erreur, "PAS_D_APERCU");
});

test("aperçu : « Fabrique la vidéo » part au monteur avec les couches de l'aperçu", async () => {
  const r = await requete("POST", `/api/cartes/${SLUG}/apercu/fabriquer`, { corps: {} });
  assert.equal(r.statut, 200, r.texte);
  const msg = await attendreQue(() => m.lancements().find((x) => x.evenement === "message" && /a validé l'aperçu/.test(x.texte)));
  assert.match(msg.texte, /Fabrique la vidéo avec les couches de l'aperçu/);
  const chat = (await requete("GET", `/api/chats/${encodeURIComponent(`${SLUG}:monteur`)}`)).json;
  assert.ok(chat.messages.some((x) => x.role === "romain" && x.texte === "C'est bon, fabrique la vidéo."));
  await attendreQue(() => !s.pont.actif(`${SLUG}:monteur`));
});

test("aperçu : traits bornés et rectangle de la zone", () => {
  assert.deepEqual(traitsPropres([[[-1, 2], [0.123456, 0.5]], "x", [[1, "a"]], []]), [[[0, 1], [0.1235, 0.5]]]);
  assert.deepEqual(traitsPropres(null), []);
  assert.equal(zoneDe([]), null);
  assert.deepEqual(zoneDe([[[0.1, 0.9], [0.4, 0.2]]]), { x: 0.1, y: 0.2, l: 0.3, h: 0.7 });
  assert.equal(instantLisible(1890), "1:03.0");
});

test("aperçu : l'échelle des zooms est celle du graphe du rendu (zooms.py), image par image", () => {
  const zooms = [
    { type: "ouverture", echelle: 1.2, ancre: [0.5, 0.47], t0: 0, duree: 4.966667, f0: 0, f1: 149, fixe: 149, courbe: "lineaire" },
    { type: "eclair", echelle: 1.15, ancre: [0.49, 0.47], t0: 8.824, duree: 0.13, f0: 264, f1: 279, fixe: 269, courbe: "power2.out" },
    { type: "rapprochement", echelle: 1.1, ancre: [0.53, 0.48], t0: 31.303, duree: 1, f0: 939, f1: 992, fixe: 969, courbe: "power2.inOut" },
  ];
  // Référence : les fonctions de zooms.py (echelle_a, moyenne des 10 sous-images comme le graphe).
  const py = `
import json, sys
sys.path.insert(0, ${JSON.stringify(path.resolve(import.meta.dirname, "../../../skills/zooms/scripts"))})
import zooms as Z
zs = json.loads(sys.argv[1]); out = {}
for n in [0, 1, 74, 148, 149, 263, 264, 265, 268, 269, 278, 279, 939, 950, 968, 969, 991, 992]:
    v = 1.0
    for z in zs:
        q = dict(type=z["type"], s=z["echelle"], t0=z["t0"], duree=z["duree"], f1=z["f1"], fps=30)
        if z["type"] == "ouverture":
            if n < z["f1"]: v = z["echelle"] - (z["echelle"] - 1) * n / z["f1"]
        elif z["f0"] <= n < z["f1"]:
            v = z["echelle"] if n >= z["fixe"] else sum(Z.echelle_a(q, (n + j / 10) / 30) for j in range(10)) / 10
    out[n] = v
print(json.dumps(out))`;
  const ref = JSON.parse(execFileSync("/usr/bin/python3", ["-c", py, JSON.stringify(zooms)], { encoding: "utf8" }));
  for (const [n, v] of Object.entries(ref)) assert.ok(Math.abs(zoomA(zooms, Number(n)).s - v) < 1e-9, `image ${n} : ${zoomA(zooms, Number(n)).s} contre ${v}`);
  const p = planA({ zooms, decalages: [{ debut: 10, valeurs: [0, 5, 9] }], flous: [{ debut: 11, fin: 13, rayon: 20, assombrir: 0.6 }] }, 12);
  assert.equal(p.dy, 9);
  assert.deepEqual(p.flou, { debut: 11, fin: 13, rayon: 20, assombrir: 0.6 });
});
