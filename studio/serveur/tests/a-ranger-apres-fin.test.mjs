// « À ranger » après la fin d'un plan (studio de Yoan, 19/11/2026). Plan validé à 16 h 45, rangement fini
// (1 vidéo attendue, 1 rangée). Pendant le rangement, Yoan avait posé dans Téléchargements un enregistrement
// d'écran de QuickTime (quarantaine « QuickTime Player », pas de page d'origine). Le rangement avait lu le
// dossier au début seulement, et « À ranger » ne relisait que les plans « à finir » : le fichier n'apparaissait
// nulle part. Ici : il apparaît toujours (plan fini ou non), se range à la main jusqu'au dossier du contenu ou
// par « Ranger maintenant », sans bruit (internet, plus vieux que le plan, déjà rangé).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { demarrer } from "../studio.mjs";
import { monde, attendreQue, ICI } from "./aide.mjs";
import { lireSuivi, ecrireSuivi } from "../tournage.mjs";
import { isoZurich } from "../outils.mjs";
import { outil } from "../../rangement/lib/commun.mjs";

const MAC = process.platform === "darwin";
const SKIP = !MAC && "macOS seulement";
const TEXTE = "Je classe tout ce que les coachs confient aujourd'hui à l'intelligence artificielle, des tâches les plus sûres jusqu'aux plus risquées, et je te montre précisément où je place ma limite personnelle";
const AUTRE = "Demain il va pleuvoir sur tout le canton, alors pense à prendre ton parapluie et une veste chaude pour le marché";
const SCRIPT = `# Tier list\n\n- Format : face caméra\n\n## Accroches proposées\n1. (ta situation) ${TEXTE}\n\n## Texte complet\n${TEXTE}\n\n## Légende\nLégende\n`;
const SLUG = "je-classe-ce-que-les-coachs-confient";
const ID = "2026-11-19-1540";
const RANGER = path.join(ICI, "..", "..", "rangement", "ranger.mjs");
const nettoyages = [];
after(async () => { for (const f of nettoyages.reverse()) await f(); });

function requete(port, cookie, methode, chemin, corps) {
  return new Promise((resolve, reject) => {
    const data = corps === undefined ? null : JSON.stringify(corps);
    const req = http.request({ host: "127.0.0.1", port, method: methode, path: chemin, headers: {
      Host: `127.0.0.1:${port}`, Origin: `http://127.0.0.1:${port}`, ...(cookie ? { Cookie: cookie } : {}),
      ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}),
    } }, (res) => {
      const m = [];
      res.on("data", (x) => m.push(x));
      res.on("end", () => { const t = Buffer.concat(m).toString("utf8"); let json = null; try { json = JSON.parse(t); } catch { /* texte */ } resolve({ statut: res.statusCode, json }); });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

// Un plan d'une face caméra créé il y a 10 minutes, déjà validé et rangé (la face caméra est dans son dossier).
function preparer({ valideIlYA = 0 } = {}) {
  const m = monde();
  const arrivees = path.join(m.racine, "Telechargements");
  fs.mkdirSync(arrivees, { recursive: true });
  const brut = JSON.parse(fs.readFileSync(m.config.fichier, "utf8"));
  brut.arrivees = arrivees;
  fs.writeFileSync(m.config.fichier, JSON.stringify(brut, null, 2));
  m.contenu(SLUG, { titre: "Ta tier list des usages de l'IA" });
  m.ecrire(`depot/contenus/${SLUG}/script.md`, SCRIPT);
  const cree = new Date(Date.now() - 600e3);
  m.json(`depot/tournages/${ID}.json`, { version: 1, id: ID, cree_le: isoZurich(cree), contenus: [SLUG], duree_estimee_min: 10,
    prises: [{ n: 1, type: "face", contenus: [{ slug: SLUG, usages: [] }], lieu: "", materiel: [], ce_qu_on_voit: "toi", mouvements: [], duree_s: 30, deja_en_bibliotheque: null }] });
  m.ecrire(`depot/tournages/${ID}.md`, "# Ton tournage\n");
  const face = path.join(m.media, SLUG, "face", "IMG_7878.MOV");
  fs.mkdirSync(path.dirname(face), { recursive: true });
  fs.writeFileSync(face, "face");
  const valide = isoZurich(new Date(Date.now() - valideIlYA * 1000));
  ecrireSuivi(m.config, ID, { coches: [1], sautees: [], envoi: true, valide_le: valide,
    verification: { le: isoZurich(new Date(Date.now() - valideIlYA * 1000 - 100e3)), complet: true, message: "Tout est arrivé." },
    rangement: { fini_le: valide, places: 1, a_ranger: 0, en_attente: 0, reste: { videos: 0, photos: 0 } } });
  return { m, arrivees, cree };
}

async function studio(prep, { texte = AUTRE } = {}) {
  const { m } = prep;
  const env = { ...process.env, STUDIO_HOME: m.home, HOME: m.maison, RANGEMENT_ATTENTE_S: "0", ARRIVEES_CALME_S: "0",
    RANGEMENT_COUPER: path.join(ICI, "faux-couper.mjs"), FAUX_COUPER_TEXTE: texte };
  for (const k of ["RANGEMENT_ATTENTE_S", "RANGEMENT_COUPER", "FAUX_COUPER_TEXTE", "ARRIVEES_CALME_S"]) process.env[k] = env[k];
  const s = await demarrer({ env, silencieux: true });
  const port = s.config.port;
  const r = await new Promise((ok, ko) => http.get({ host: "127.0.0.1", port, path: `/?t=${s.jeton}`, headers: { Host: `127.0.0.1:${port}` } }, ok).on("error", ko));
  r.resume();
  const cookie = String(r.headers["set-cookie"]).split(";")[0];
  nettoyages.push(async () => { await s.arreter("tests"); m.nettoyer(); });
  return { ...prep, api: (methode, chemin, corps) => requete(port, cookie, methode, chemin, corps) };
}

// Une vraie petite vidéo avec du son (ffprobe et le rangement doivent pouvoir la lire).
function video(dest, { quand = new Date(), quarantaine = "QuickTime Player" } = {}) {
  const r = spawnSync(outil("ffmpeg"), ["-nostdin", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=568x320:rate=30:duration=2",
    "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", dest], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  if (quarantaine) spawnSync("/usr/bin/xattr", ["-w", "com.apple.quarantine", `0082;${Math.floor(Date.now() / 1000).toString(16)};${quarantaine};`, dest]);
  fs.utimesSync(dest, quand, quand);
  return dest;
}

const enAttente = (e) => e.a_ranger.filter((x) => x.attente).map((x) => x.nom);

test("plan fini, enregistrement d'écran arrivé entre la vérification et la fin : montré dans « À ranger »", { skip: SKIP }, async () => {
  const { arrivees, api } = await studio(preparer({ valideIlYA: 0 }));
  // Comme chez Yoan : créé et modifié avant la validation (export QuickTime), posé là pendant le rangement.
  video(path.join(arrivees, "2026-11-19 16-35-03.mov"), { quand: new Date(Date.now() - 300e3) });
  const e = (await api("GET", "/api/etat")).json;
  assert.deepEqual(e.tournages.map((x) => [x.id, x.valide, Boolean(x.a_finir)]), [[ID, true, false]], "le plan est bien fini");
  const f = e.a_ranger.find((x) => x.nom === "2026-11-19 16-35-03.mov");
  assert.ok(f, JSON.stringify(e.a_ranger));
  assert.deepEqual([f.attente, f.en_cours, f.tournage, f.libelle], [true, false, ID, "ta vidéo"]);
  assert.equal(f.raison, "arrivée sur ton Mac après ton tournage, pas encore rangée");
  assert.deepEqual(f.candidats, [{ slug: SLUG, type: "b-roll" }], "proposé en plan de coupe pour le contenu du plan");
});

test("plan fini, vidéo arrivée après la fin ; d'internet, plus vieille que le plan ou déjà rangée : rien", { skip: SKIP }, async () => {
  const { m, arrivees, cree, api } = await studio(preparer({ valideIlYA: 120 }));
  video(path.join(arrivees, "apres.mov"));
  // Téléchargée d'internet : macOS note sa page d'origine.
  const net = video(path.join(arrivees, "internet.mp4"), { quarantaine: "Google Chrome" });
  spawnSync("/usr/bin/xattr", ["-w", "com.apple.metadata:kMDItemWhereFroms", "x", net]);
  // Plus vieille que le plan (même posée ici à l'instant, sa date de création est antérieure).
  video(path.join(arrivees, "vieille.mov"), { quand: new Date(cree.getTime() - 3600e3) });
  // Déjà rangée : le journal dit qu'elle est partie dans le contenu, la copie y est avec la même taille.
  const doublon = video(path.join(arrivees, "IMG_7878.MOV"));
  const rangee = path.join(m.media, SLUG, "face", "IMG_7878.MOV");
  fs.copyFileSync(doublon, rangee);
  m.json("Contenu/_journal-rangement.json", { version: 1, rangements: [{ id: "x", le: "x", commande: "ranger", tournage: ID,
    ops: [{ op: "deplacement", de: doublon, vers: rangee, raison: "face", le: "x" }], annule: null }] });
  // Un autre fichier de la vie de Yoan : jamais montré.
  fs.writeFileSync(path.join(arrivees, "facture.pdf"), "pdf");
  const e = (await api("GET", "/api/etat")).json;
  assert.deepEqual(enAttente(e), ["apres.mov"]);
});

test("rangement à la main d'une arrivée, jusqu'au dossier du contenu ; un fichier hors liste est refusé", { skip: SKIP }, async () => {
  const { m, arrivees, api } = await studio(preparer({ valideIlYA: 60 }));
  const f = video(path.join(arrivees, "2026-11-19 16-35-03.mov"));
  fs.writeFileSync(path.join(arrivees, "facture.pdf"), "pdf");
  // Seulement ce que « À ranger » montre : pas un autre fichier des Téléchargements.
  const refus = await api("POST", "/api/rangement/placer", { fichier: "facture.pdf", slug: SLUG, type: "b-roll", arrivee: true });
  assert.equal(refus.statut, 404);
  assert.ok(fs.existsSync(path.join(arrivees, "facture.pdf")));
  const r = await api("POST", "/api/rangement/placer", { fichier: "2026-11-19 16-35-03.mov", slug: SLUG, type: "b-roll", arrivee: true });
  assert.equal(r.statut, 200, JSON.stringify(r.json));
  assert.ok(!fs.existsSync(f), "parti des Téléchargements");
  const liens = fs.readdirSync(path.join(m.media, SLUG, "b-roll"));
  assert.equal(liens.length, 1);
  const cible = fs.realpathSync(path.join(m.media, SLUG, "b-roll", liens[0]));
  assert.ok(cible.startsWith(fs.realpathSync(path.join(m.media, "_bibliotheque", "b-roll"))), cible);
  const ix = JSON.parse(fs.readFileSync(path.join(m.media, "_bibliotheque", "index.json"), "utf8"));
  const clip = Object.values(ix.clips)[0];
  assert.deepEqual([clip.origine, clip.tournage, clip.contenus], ["2026-11-19 16-35-03.mov", ID, [SLUG]]);
  const e = (await api("GET", "/api/etat")).json;
  assert.deepEqual(e.a_ranger, []);
});

test("« Ranger maintenant » sur un plan fini : le fichier pas attendu va dans « À ranger », puis se place à la main", { skip: SKIP }, async () => {
  const { m, arrivees, api } = await studio(preparer({ valideIlYA: 60 }));
  video(path.join(arrivees, "ecran.mov"));
  assert.equal((await api("POST", `/api/tournages/${ID}/valider`, {})).statut, 200);
  await attendreQue(() => lireSuivi(m.config, ID).rangement?.fini_le && !fs.existsSync(path.join(arrivees, "ecran.mov")), { delaiMs: 60000 });
  await attendreQue(() => lireSuivi(m.config, ID).rangement?.reste, { delaiMs: 60000 });
  assert.deepEqual([lireSuivi(m.config, ID).rangement.places, lireSuivi(m.config, ID).rangement.a_ranger], [0, 1]);
  let e = (await api("GET", "/api/etat")).json;
  const f = e.a_ranger.find((x) => !x.attente);
  assert.ok(f, JSON.stringify(e.a_ranger));
  assert.deepEqual(enAttente(e), []);
  assert.equal((await api("POST", "/api/rangement/placer", { fichier: f.nom, slug: SLUG, type: "b-roll" })).statut, 200);
  assert.equal(fs.readdirSync(path.join(m.media, SLUG, "b-roll")).length, 1);
  e = (await api("GET", "/api/etat")).json;
  assert.deepEqual(e.a_ranger, []);
});

test("le rangement relit le dossier d'arrivée à la fin : une vidéo posée pendant qu'il range est signalée, pas perdue", { skip: SKIP }, async () => {
  const { m, arrivees } = preparer({ valideIlYA: 0 });
  nettoyages.push(async () => m.nettoyer());
  video(path.join(arrivees, "IMG_7879.MOV"));
  const env = { ...process.env, STUDIO_HOME: m.home, HOME: m.maison, RANGEMENT_ATTENTE_S: "2", ARRIVEES_CALME_S: "0",
    RANGEMENT_COUPER: path.join(ICI, "faux-couper.mjs"), FAUX_COUPER_TEXTE: TEXTE };
  const p = spawn(process.execPath, [RANGER, "--config", m.config.fichier, "--tournage", ID], { env, stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  p.stdout.on("data", (d) => { out += d; });
  p.stderr.on("data", () => {});
  // Pendant l'attente du rangement (après sa lecture du dossier), l'enregistrement d'écran arrive.
  await new Promise((ok) => setTimeout(ok, 800));
  video(path.join(arrivees, "pendant.mov"));
  const code = await new Promise((ok) => p.on("close", ok));
  assert.equal(code, 0, out);
  assert.match(out, /^PLACE IMG_7879\.MOV -> je-classe-ce-que-les-coachs-confient\/face$/m);
  assert.match(out, /^IGNORE pendant\.mov arrivé pendant que je rangeais, il t'attend dans « À ranger »$/m);
  assert.ok(fs.existsSync(path.join(arrivees, "pendant.mov")), "laissé où il est");
});
