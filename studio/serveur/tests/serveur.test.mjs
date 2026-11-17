import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { demarrer } from "../studio.mjs";
import { monde, attendreQue, ICI } from "./aide.mjs";

let m;
let s;
let port;
let cookie;
const fauxOutils = [];

const FAUX_OUTIL = `#!/usr/bin/env python3
import json, os, sys
with open(os.environ["FAUX_OUTILS_LOG"], "a") as f:
    f.write(json.dumps({"outil": os.path.basename(sys.argv[0]), "argv": sys.argv[1:]}) + "\\n")
a = sys.argv[1:]
if a[0] == "garder":
    print("OK slug=faim-a-16h")
elif a[0] == "valider" and a[1] == "bloque-a":
    print("BLOQUE TIRET_LONG contenus/bloque-a/script.md contient un tiret long")
    sys.exit(2)
elif a[0] == "ecrire" and a[1] == "bloque-a":
    print("BLOQUE CHANGE le texte a changé depuis que tu l'as ouvert : rien n'est enregistré")
    sys.exit(2)
elif a[0] == "ecrire":
    with open(a[a.index("--depuis") + 1], encoding="utf-8") as f:
        with open(os.environ["FAUX_OUTILS_LOG"], "a") as g:
            g.write(json.dumps({"outil": "entree", "argv": json.load(f)}) + "\\n")
    print("OK brief slug=%s empreinte=sha256:%s" % (a[1], "b" * 64))
elif a[0] == "valider" and a[1] == "bloque-leg":
    print("BLOQUE LEGENDE_PROVISOIRE la légende de contenus/bloque-leg/carrousel.md n'est pas encore écrite")
    sys.exit(2)
else:
    print("OK fait")
`;

function requete(methode, chemin, { hote, origine, corps, cookie: c, entetes = {} } = {}) {
  return new Promise((resolve, reject) => {
    const data = corps === undefined ? null : JSON.stringify(corps);
    const req = http.request({
      host: "127.0.0.1", port, method: methode, path: chemin,
      headers: {
        Host: hote ?? `127.0.0.1:${port}`,
        ...(origine !== null ? { Origin: origine ?? `http://127.0.0.1:${port}` } : {}),
        ...(c ? { Cookie: c } : {}),
        ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}),
        ...entetes,
      },
    }, (res) => {
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

const api = (methode, chemin, corps) => requete(methode, chemin, { corps, cookie });

function ecouterSSE() {
  const evenements = [];
  const req = http.request({ host: "127.0.0.1", port, path: "/api/evenements", headers: { Host: `127.0.0.1:${port}`, Cookie: cookie } });
  req.on("response", (res) => {
    let tampon = "";
    res.setEncoding("utf8");
    res.on("data", (d) => {
      tampon += d;
      let i;
      while ((i = tampon.indexOf("\n\n")) >= 0) {
        const bloc = tampon.slice(0, i);
        tampon = tampon.slice(i + 2);
        const ev = /^event: (.+)$/m.exec(bloc)?.[1];
        const data = /^data: (.+)$/m.exec(bloc)?.[1];
        if (ev) evenements.push({ ev, data: JSON.parse(data) });
      }
    });
  });
  req.on("error", () => {});
  req.end();
  return { evenements, fermer: () => req.destroy() };
}

before(async () => {
  m = monde();
  process.env.FAUX_CLAUDE_JOURNAL = m.journalClaude;
  process.env.FAUX_OUTILS_LOG = path.join(m.racine, "outils.jsonl");
  for (const o of ["idees.py", "etat.py", "brief.py"]) {
    fauxOutils.push(m.ecrire(`depot/outils/${o}`, FAUX_OUTIL));
  }
  // Publication : le faux zernio du lot 5, qui charge le vrai script en lecture et refuse --envoyer.
  const faux = fs.readFileSync(path.join(ICI, "..", "..", "publication", "tests", "faux_zernio.py"), "utf8");
  // zernio.py tourne dans la copie des scripts du Mac (depot_mac), jamais dans DEPOT.
  m.ecrire("copie-mac/outils/zernio.py", faux);
  process.env.FAUX_ZERNIO_LOG = path.join(m.racine, "zernio.jsonl");
  process.env.FAUX_ZERNIO_REEL = path.join(ICI, "..", "..", "..", "..", "..", "agents", "head-of-content", "depot", "outils", "zernio.py");
  m.contenu("faim-a-16h", { titre: "Pourquoi tu as faim à 16 h" });
  m.contenu("bloque-a");
  m.contenu("bloque-leg");
  m.ecrire("depot/contenus/faim-a-16h/script.md", "# Faim\n\n## Texte complet\nBonjour\n\n## Légende\nTa légende\n");
  m.ecrire("Contenu/faim-a-16h/face/IMG_1.mov", "0123456789");
  m.ecrire("Contenu/faim-a-16h/face/IMG_1-monte.mp4", "abcdefghijklmnopqrstuvwxyz");
  m.ecrire("Contenu/_a-ranger/IMG_9.MOV", "x");
  m.contenu("a-monter", { titre: "À monter" });
  m.ecrire("depot/contenus/a-monter/script.md", "# À monter\n\n## Texte complet\nSalut\n");
  m.ecrire("Contenu/a-monter/face/IMG_5.MOV", "video");
  m.ecrire("Contenu/a-monter/photos/IMG_6.JPG", "photo");
  m.json("depot/tournages/2026-11-16-1400.json", { version: 1, id: "2026-11-16-1400", cree_le: "2026-11-16T14:00:00+01:00",
    contenus: ["a-monter"], duree_estimee_min: 15, prises: [] });
  m.ecrire("depot/tournages/2026-11-16-1400.md", "# Ton tournage\n\nEnviron 15 minutes.\n");
  m.ecrire("secret.txt", "secret");
  fs.symlinkSync(path.join(m.racine, "secret.txt"), path.join(m.media, "faim-a-16h", "fuite.txt"));
  s = await demarrer({ env: { ...process.env, STUDIO_HOME: m.home, HOME: m.maison }, silencieux: true });
  port = s.config.port;
});

after(async () => {
  await s?.arreter("tests");
  m?.nettoyer();
});

test("jeton : fichier 0600, gardé d'un démarrage à l'autre", () => {
  const f = path.join(m.home, "jeton");
  assert.equal(fs.statSync(f).mode & 0o777, 0o600);
  assert.equal(fs.readFileSync(f, "utf8").trim(), s.jeton);
  assert.match(s.jeton, /^[0-9a-f]{64}$/);
});

test("sécurité : Host 421, Origin 403, sans jeton 401, avec jeton 200", async () => {
  assert.equal((await requete("GET", "/", { hote: "exemple.com" })).statut, 421);
  assert.equal((await requete("GET", "/api/etat", { hote: `evil.localhost:${port}` })).statut, 421);
  assert.equal((await requete("GET", "/", { hote: `127.0.0.1:${port + 1}` })).statut, 421);
  assert.equal((await requete("GET", "/api/etat")).statut, 401);
  const mauvais = await requete("GET", "/?t=faux");
  assert.equal(mauvais.statut, 401);
  const bon = await requete("GET", `/?t=${s.jeton}`, { hote: `localhost:${port}` });
  assert.equal(bon.statut, 302);
  assert.equal(bon.entetes.location, "/");
  const pose = bon.entetes["set-cookie"][0];
  assert.match(pose, /^studio=[0-9a-f]{64}; HttpOnly; SameSite=Strict; Path=\/$/);
  cookie = pose.split(";")[0];
  assert.equal((await requete("GET", "/api/etat", { cookie: "studio=faux" })).statut, 401);
  assert.equal((await api("GET", "/api/etat")).statut, 200);
  // POST sans Origin, ou d'une autre origine : 403, même avec le bon cookie.
  assert.equal((await requete("POST", "/api/chats/general/messages", { cookie, origine: null, corps: { texte: "x" } })).statut, 403);
  assert.equal((await requete("POST", "/api/chats/general/messages", { cookie, origine: "http://exemple.com", corps: { texte: "x" } })).statut, 403);
  assert.equal((await requete("POST", "/api/chats/general/messages", { cookie, origine: `http://localhost:${port + 1}`, corps: { texte: "x" } })).statut, 403);
});

test("GET / sert l'interface (ou la page d'attente) et /app/ sans sortir du dossier", async () => {
  const r = await requete("GET", "/");
  assert.equal(r.statut, 200);
  assert.match(r.entetes["content-type"], /text\/html/);
  assert.equal((await requete("GET", "/app/..%2F..%2Fserveur%2Fstudio.mjs")).statut, 404);
});

test("GET /api/etat : cartes, file, sync, config", async () => {
  const r = await api("GET", "/api/etat");
  const c = r.json.cartes.find((x) => x.slug === "faim-a-16h");
  assert.equal(c.stade, "monte");
  assert.equal(c.titre, "Pourquoi tu as faim à 16 h");
  assert.equal(r.json.config.prenom, "Test");
  assert.deepEqual(r.json.config.jours_par_defaut, ["mardi", "jeudi", "dimanche"]);
  assert.ok(Array.isArray(r.json.file));
  assert.ok(r.json.sync.etat);
  assert.equal(r.json.a_ranger[0].nom, "IMG_9.MOV");
  assert.equal(r.json.a_ranger[0].libelle, "ta vidéo");
  assert.ok(!r.texte.includes(m.racine), "aucun chemin du disque");
});

test("médias : Range, chemin confiné, lien vers l'extérieur refusé", async () => {
  const r = await requete("GET", "/api/media/faim-a-16h/face/IMG_1-monte.mp4", { cookie, entetes: { Range: "bytes=2-5" } });
  assert.equal(r.statut, 206);
  assert.equal(r.texte, "cdef");
  assert.equal(r.entetes["content-range"], "bytes 2-5/26");
  assert.equal((await requete("GET", "/api/media/faim-a-16h/face/IMG_1-monte.mp4", { cookie })).statut, 200);
  assert.equal((await requete("GET", "/api/media/faim-a-16h/..%2F..%2Fsecret.txt", { cookie })).statut, 404);
  assert.equal((await requete("GET", "/api/media/faim-a-16h/fuite.txt", { cookie })).statut, 404);
  assert.equal((await requete("GET", "/api/media/_a-ranger/IMG_9.MOV", { cookie })).statut, 200);
  assert.equal((await requete("GET", "/api/media/faim-a-16h/face/IMG_1.mov")).statut, 401);
});

test("outils du dépôt : garder, valider (puis message au head of content), BLOQUE en clair", async () => {
  const g = await api("POST", "/api/propositions/2026-11-15-1730-01/garder", { jour: "2026-11-18" });
  assert.equal(g.statut, 200);
  assert.deepEqual(g.json, { slug: "faim-a-16h" });
  assert.equal((await api("POST", "/api/cartes/faim-a-16h/jour", { jour: null })).statut, 200);
  assert.equal((await api("POST", "/api/cartes/faim-a-16h/jour", { jour: "18/11" })).statut, 400);
  const b = await api("POST", "/api/cartes/bloque-a/valider", {});
  assert.equal(b.statut, 409);
  assert.equal(b.json.erreur, "TIRET_LONG");
  assert.ok(!b.json.message.includes("/"), b.json.message);
  const bl = await api("POST", "/api/cartes/bloque-leg/valider", {});
  assert.equal(bl.statut, 409);
  assert.equal(bl.json.erreur, "LEGENDE_PROVISOIRE");
  assert.match(bl.json.message, /légende n'est pas encore écrite/);
  assert.equal((await api("POST", "/api/cartes/faim-a-16h/valider", {})).statut, 200);
  const log = fs.readFileSync(process.env.FAUX_OUTILS_LOG, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.deepEqual(log[0], { outil: "idees.py", argv: ["garder", "2026-11-15-1730-01", "--jour", "2026-11-18", "--pousser"] });
  assert.deepEqual(log[1].argv, ["jour", "faim-a-16h", "aucun", "--pousser"]);
  assert.ok(log.every((l) => l.argv.includes("--pousser")));
  await attendreQue(() => m.lancements().some((x) => x.evenement === "message" && /J'ai validé le contenu faim-a-16h\./.test(x.texte)));
  await attendreQue(() => !s.pont.actif("faim-a-16h:hoc"));
  assert.equal((await api("POST", "/api/cartes/inconnu-x/valider", {})).statut, 404);
});

test("chat de bout en bout par HTTP, avec le flux SSE", async () => {
  const sse = ecouterSSE();
  await attendreQue(() => sse.evenements.some((e) => e.ev === "sync"));
  const r = await api("POST", "/api/chats/general/messages", { texte: "dis bonjour" });
  assert.equal(r.statut, 200);
  await attendreQue(() => sse.evenements.some((e) => e.ev === "chat" && e.data.message.type === "etat" && e.data.message.etat === "a_toi"));
  const chats = sse.evenements.filter((e) => e.ev === "chat").map((e) => e.data);
  assert.ok(chats.some((c) => c.partiel && c.message.type === "texte"), "texte partiel relayé");
  assert.ok(chats.some((c) => !c.partiel && c.message.type === "texte" && /Bonjour/.test(c.message.texte)));
  const h = await api("GET", "/api/chats/general");
  assert.equal(h.json.etat, "a_toi");
  assert.deepEqual(h.json.messages.map((x) => x.type), ["texte", "etat", "activite", "texte", "etat"]);
  assert.equal(h.json.messages[0].role, "romain");
  assert.equal((await api("POST", "/api/chats/general/messages", { texte: "  " })).statut, 400);
  assert.equal((await api("GET", "/api/chats/..%2Fx:hoc")).statut, 404);
  sse.fermer();
});

test("actions : script en file, puis fini quand le fichier est écrit ; montage sans vidéo refusé", async () => {
  process.env.FAUX_CLAUDE_ECRIT = "contenus/{slug}/script.md";
  try {
    m.contenu("nouveau-b");
    const r = await api("POST", "/api/actions", { type: "script", slugs: ["nouveau-b"] });
    assert.equal(r.statut, 200);
    assert.equal(r.json.actions.length, 1);
    const id = r.json.actions[0].id;
    await attendreQue(async () => (await api("GET", "/api/etat")).json.file.find((a) => a.id === id)?.statut === "fini");
    const c = (await api("GET", "/api/etat")).json.cartes.find((x) => x.slug === "nouveau-b");
    assert.equal(c.stade, "script_ecrit");
  } finally {
    delete process.env.FAUX_CLAUDE_ECRIT;
  }
  const mo = await api("POST", "/api/actions", { type: "montage", slugs: ["bloque-a"] });
  assert.equal(mo.statut, 409);
  assert.equal(mo.json.erreur, "PAS_DE_VIDEO");
  assert.equal((await api("POST", "/api/actions", { type: "rien", slugs: ["bloque-a"] })).statut, 400);
});

test("publication en simulation : récapitulatif puis confirmation, jamais --envoyer", async () => {
  const quand = "2099-06-02 18:30";
  // La copie des scripts est alignée sur le dépôt en ligne par zernio.py lui-même ; ici, on la recopie.
  fs.cpSync(path.join(m.depot, "contenus"), path.join(m.racine, "copie-mac", "contenus"), { recursive: true });
  const r = await api("POST", "/api/publication/recap", { elements: [{ slug: "faim-a-16h", quand }] });
  assert.equal(r.statut, 200, r.texte);
  assert.ok(r.json.recap_id);
  const el = r.json.elements[0];
  assert.equal(el.slug, "faim-a-16h");
  assert.ok(["OK", "ATTENTION", "BLOQUE"].includes(el.verdict));
  const c = await api("POST", "/api/publication/confirmer", { recap_id: r.json.recap_id });
  assert.equal(c.statut, 200, c.texte);
  assert.ok(Array.isArray(c.json.resultats));
  const appels = fs.readFileSync(process.env.FAUX_ZERNIO_LOG, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.ok(appels.length >= 1);
  assert.ok(appels.every((a) => !a.argv.includes("--envoyer") && a.ecriture !== "oui"), "rien ne part en simulation");
  assert.ok(appels.every((a) => a.hoc_depot === path.join(m.racine, "copie-mac")), "zernio.py ne tourne jamais dans DEPOT");
  assert.equal((await api("POST", "/api/publication/confirmer", { recap_id: r.json.recap_id })).statut, 409, "un récapitulatif ne sert qu'une fois");
});

test("lot 9 : arborescence (fichiers, tournages) et plan de tournage", async () => {
  const e = (await api("GET", "/api/etat")).json;
  assert.deepEqual(e.cartes.find((x) => x.slug === "faim-a-16h").fichiers, ["idee", "brief", "montage", "video"]);
  assert.deepEqual(e.cartes.find((x) => x.slug === "a-monter").fichiers, ["idee", "brief", "montage"]);
  assert.deepEqual(e.tournages.map((x) => x.id), ["2026-11-16-1400"]);
  const t = await api("GET", "/api/tournages/2026-11-16-1400");
  assert.equal(t.statut, 200);
  assert.match(t.json.texte, /Environ 15 minutes/);
  assert.deepEqual(t.json.contenus, [{ slug: "a-monter", titre: "À monter" }]);
  assert.equal((await api("GET", "/api/tournages/..%2Fx")).statut, 404);
  assert.equal((await api("GET", "/api/tournages/2020-01-01-0000")).statut, 404);
  const d = (await api("GET", "/api/cartes/a-monter")).json;
  assert.deepEqual(d.montage.rushs.map((r) => [r.id, r.titre]), [["face/IMG_5.MOV", "Plan face caméra"], ["photos/IMG_6.JPG", "Ta photo"]]);
  assert.equal(d.brief.texte, "Salut");
});

test("lot 9 : retouche du brief par l'outil du dépôt, CHANGE en clair, refusée pendant une session", async () => {
  const avant = fs.readFileSync(process.env.FAUX_OUTILS_LOG, "utf8").length;
  const e = "sha256:" + "a".repeat(64);
  const r = await api("POST", "/api/cartes/a-monter/brief", { empreinte: e, texte: "Nouveau texte", legende: "Leg", inconnu: "x" });
  assert.equal(r.statut, 200, r.texte);
  assert.deepEqual(r.json, { empreinte: "sha256:" + "b".repeat(64) });
  const log = fs.readFileSync(process.env.FAUX_OUTILS_LOG, "utf8").slice(avant).trim().split("\n").map((l) => JSON.parse(l));
  const appel = log.find((l) => l.outil === "brief.py");
  assert.deepEqual(appel.argv.filter((x) => !x.startsWith("/")), ["ecrire", "a-monter", "--depuis", "--empreinte", e, "--pousser"]);
  assert.deepEqual(log.find((l) => l.outil === "entree").argv, { texte: "Nouveau texte", legende: "Leg" });
  assert.deepEqual(fs.readdirSync(path.join(m.home, "tmp")), [], "le fichier d'entrée est effacé");
  const c = await api("POST", "/api/cartes/bloque-a/brief", { texte: "x" });
  assert.equal(c.statut, 409);
  assert.equal(c.json.erreur, "CHANGE");
  assert.match(c.json.message, /a changé entre-temps/);
  assert.equal((await api("POST", "/api/cartes/a-monter/brief", {})).statut, 400);
  assert.equal((await api("POST", "/api/cartes/a-monter/brief", { slides: [{ n: 0 }] })).statut, 400);
  // Pendant une session du head of content sur ce contenu : refusé.
  process.env.FAUX_CLAUDE_DELAI = "100";
  try {
    assert.equal((await api("POST", "/api/chats/a-monter:hoc/messages", { texte: "raccourcis" })).statut, 200);
    await attendreQue(() => s.pont.actif("a-monter:hoc"));
    const o = await api("POST", "/api/cartes/a-monter/brief", { texte: "y" });
    assert.equal(o.statut, 409);
    assert.equal(o.json.erreur, "OCCUPE");
    await attendreQue(() => !s.pont.actif("a-monter:hoc"), { delaiMs: 10000 });
  } finally {
    delete process.env.FAUX_CLAUDE_DELAI;
  }
});

test("lot 9 : chat du contenu prévenu quand Romain a retouché son brief depuis son dernier message", async () => {
  await attendreQue(() => !s.pont.actif("a-monter:hoc"));
  const f = path.join(m.depot, "contenus", "a-monter", "script.md");
  const futur = new Date(Date.now() + 60000);
  fs.utimesSync(f, futur, futur);
  assert.equal((await api("POST", "/api/chats/a-monter:hoc/messages", { texte: "et la fin ?" })).statut, 200);
  await attendreQue(() => m.lancements().some((x) => x.evenement === "message" && /retouché son texte dans le studio[\s\S]*et la fin \?/.test(x.texte)));
  await attendreQue(() => !s.pont.actif("a-monter:hoc"), { delaiMs: 10000 });
  const passe = new Date(Date.now() - 3600000);
  fs.utimesSync(f, passe, passe);
  assert.equal((await api("POST", "/api/chats/a-monter:hoc/messages", { texte: "merci" })).statut, 200);
  await attendreQue(() => m.lancements().some((x) => x.evenement === "message" && x.texte === "merci"));
  await attendreQue(() => !s.pont.actif("a-monter:hoc"), { delaiMs: 10000 });
});

test("lot 9 : « pas le bon » retire un rush avant le montage, jamais après", async () => {
  const r = await api("POST", "/api/cartes/a-monter/rushs/retirer", { id: "photos/IMG_6.JPG" });
  assert.equal(r.statut, 200, r.texte);
  assert.ok(!fs.existsSync(path.join(m.media, "a-monter", "photos", "IMG_6.JPG")));
  assert.ok(fs.existsSync(path.join(m.media, "_a-ranger", "IMG_6.JPG")));
  const e = (await api("GET", "/api/etat")).json;
  assert.ok(e.a_ranger.some((x) => x.nom === "IMG_6.JPG"));
  assert.equal((await api("POST", "/api/cartes/a-monter/rushs/retirer", { id: "../x" })).statut, 404);
  assert.equal((await api("POST", "/api/cartes/a-monter/rushs/retirer", { id: "face/.cache" })).statut, 404);
  const tard = await api("POST", "/api/cartes/faim-a-16h/rushs/retirer", { id: "face/IMG_1.mov" });
  assert.equal(tard.statut, 409);
  assert.equal(tard.json.erreur, "TROP_TARD");
  assert.ok(fs.existsSync(path.join(m.media, "faim-a-16h", "face", "IMG_1.mov")));
});

