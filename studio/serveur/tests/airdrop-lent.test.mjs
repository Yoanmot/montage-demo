// AirDrop lent (test de Yoan du 17/11/2026, deux essais) : une grosse vidéo met plusieurs minutes à arriver.
// Avant ce correctif, le fichier en cours de réception (créé tout de suite sous son nom final dans
// Téléchargements) comptait comme reçu : « Tout est arrivé », fin validée, rangement qui le laissait de côté
// (encore en train d'arriver), puis plus rien une fois l'AirDrop fini (macOS remet la date de prise de
// l'iPhone : le fichier paraissait plus vieux que le plan). Ici, de bout en bout par HTTP, avec un fichier
// qui grossit puis reçoit ce que sharingd pose à la fin (quarantaine, dates de la prise).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { demarrer } from "../studio.mjs";
import { monde, attendreQue, ICI } from "./aide.mjs";
import { lireSuivi, ecrireSuivi } from "../tournage.mjs";
import { aFinir } from "../lecture.mjs";
import { isoZurich } from "../outils.mjs";
import { outil } from "../../rangement/lib/commun.mjs";

const MAC = process.platform === "darwin";
const AOUT = new Date("2026-08-16T14:27:06Z");
const TEXTE = "Cette vidéo a été montée par Claude Code de la première coupe jusqu'aux sous-titres et je vais te montrer comment";
const SCRIPT = `# Montée par Claude Code\n\n- Format : face caméra\n\n## Accroches proposées\n1. (ta situation) ${TEXTE}\n\n## Texte complet\n${TEXTE}\n\n## Légende\nLégende\n`;
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
      res.on("end", () => { const t = Buffer.concat(m).toString("utf8"); let json = null; try { json = JSON.parse(t); } catch { /* texte */ } resolve({ statut: res.statusCode, json, texte: t, entetes: res.headers }); });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

// Un studio de test : un contenu, un plan d'une face caméra créé il y a une minute, des Téléchargements de test.
async function studio(slug, id) {
  const m = monde();
  const arrivees = path.join(m.racine, "Telechargements");
  fs.mkdirSync(arrivees, { recursive: true });
  const brut = JSON.parse(fs.readFileSync(m.config.fichier, "utf8"));
  brut.arrivees = arrivees;
  fs.writeFileSync(m.config.fichier, JSON.stringify(brut, null, 2));
  m.contenu(slug, { titre: "Montée par Claude Code" });
  m.ecrire(`depot/contenus/${slug}/script.md`, SCRIPT);
  m.json(`depot/tournages/${id}.json`, { version: 1, id, cree_le: isoZurich(new Date(Date.now() - 60e3)), contenus: [slug], duree_estimee_min: 10,
    prises: [{ n: 1, type: "face", contenus: [{ slug, usages: [] }], lieu: "", materiel: [], ce_qu_on_voit: "toi", mouvements: [], duree_s: 30, deja_en_bibliotheque: null }] });
  m.ecrire(`depot/tournages/${id}.md`, "# Ton tournage\n");
  const env = { ...process.env, STUDIO_HOME: m.home, HOME: m.maison, RANGEMENT_ATTENTE_S: "0",
    RANGEMENT_COUPER: path.join(ICI, "faux-couper.mjs"), FAUX_COUPER_TEXTE: TEXTE };
  delete env.ARRIVEES_CALME_S;
  for (const k of ["RANGEMENT_ATTENTE_S", "RANGEMENT_COUPER", "FAUX_COUPER_TEXTE"]) process.env[k] = env[k];
  const s = await demarrer({ env, silencieux: true });
  const port = s.config.port;
  const r = await requete(port, null, "GET", `/?t=${s.jeton}`);
  const cookie = String(r.entetes["set-cookie"]).split(";")[0];
  nettoyages.push(async () => { await s.arreter("tests"); m.nettoyer(); });
  return { m, s, arrivees, api: (methode, chemin, corps) => requete(port, cookie, methode, chemin, corps) };
}

// Une vraie petite vidéo avec du son (ffprobe doit pouvoir la lire une fois arrivée).
function video(dest) {
  const r = spawnSync(outil("ffmpeg"), ["-nostdin", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=320x568:rate=30:duration=2",
    "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", dest], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return fs.readFileSync(dest);
}

// Un AirDrop comme macOS 15 : fichier créé sous son nom final, qui grossit morceau par morceau ; fin =
// dernier morceau, puis quarantaine sharingd et dates de la prise (août).
function airdrop(dest, octets) {
  const morceau = Math.ceil(octets.length / 40);
  let ecrit = 0;
  fs.writeFileSync(dest, octets.subarray(0, morceau));
  ecrit = morceau;
  return {
    pousser() { const n = Math.min(octets.length - 1, ecrit + morceau); fs.appendFileSync(dest, octets.subarray(ecrit, n)); ecrit = n; },
    finir() {
      fs.appendFileSync(dest, octets.subarray(ecrit)); ecrit = octets.length;
      spawnSync("/usr/bin/xattr", ["-w", "com.apple.quarantine", `0081;${Math.floor(Date.now() / 1000).toString(16)};sharingd;6C3D956C-F6FF-4AB4-BBB7-4C72C69EF8FC`, dest]);
      fs.utimesSync(dest, AOUT, AOUT);
    },
  };
}

test("AirDrop lent : en cours de réception, rien ne se valide ; fini, il est compté puis rangé", { skip: !MAC && "macOS seulement" }, async () => {
  const slug = "montee-par-claude-code", id = "2026-11-17-2005";
  const { m, arrivees, api } = await studio(slug, id);
  const octets = video(path.join(m.racine, "source.mov"));
  const f = path.join(arrivees, "IMG_7254.mov");
  const envoi = airdrop(f, octets);

  // Yoan coche « tout est envoyé » pendant le transfert : pas « Tout est arrivé ».
  const c = await api("POST", `/api/tournages/${id}/cocher`, { cle: "envoi", coche: true });
  const ver = c.json.suivi.verification;
  assert.equal(ver.complet, false);
  assert.deepEqual(ver.recu, { videos: 0, photos: 0 });
  assert.equal(ver.en_reception.length, 1);
  assert.match(ver.message, /^Une vidéo est en cours de réception \(.+ reçus pour l'instant\)\./);
  assert.equal(c.json.suivi.peut_valider, false);
  // Il clique quand même : refusé.
  const v = await api("POST", `/api/tournages/${id}/valider`, {});
  assert.equal(v.statut, 409);
  assert.equal(v.json.erreur, "PAS_COMPLET");
  // L'écran suit l'envoi : la taille avance.
  const r1 = (await api("GET", `/api/tournages/${id}/reception`)).json;
  envoi.pousser(); envoi.pousser();
  const r2 = (await api("GET", `/api/tournages/${id}/reception`)).json;
  assert.equal(r1.reception.en_cours[0].nom, "IMG_7254.mov");
  assert.ok(r2.reception.en_cours[0].taille > r1.reception.en_cours[0].taille, "la taille avance");
  assert.equal(r2.suivi.verification.en_reception[0].taille, r2.reception.en_cours[0].taille, "la vérification suit");
  assert.equal(r2.suivi.peut_valider, false);
  assert.equal(lireSuivi(m.config, id).valide_le, null);

  // L'AirDrop finit : dates d'août, quarantaine de sharingd. Le studio le voit tout seul.
  envoi.finir();
  const r3 = (await api("GET", `/api/tournages/${id}/reception`)).json;
  assert.deepEqual(r3.reception.en_cours, []);
  assert.deepEqual(r3.reception.recus.map((x) => x.nom), ["IMG_7254.mov"]);
  assert.equal(r3.suivi.verification.complet, true, r3.suivi.verification.message);
  assert.equal(r3.suivi.peut_valider, true);

  // Fin du tournage : rangé dans le dossier du contenu, plus rien à finir.
  assert.equal((await api("POST", `/api/tournages/${id}/valider`, {})).statut, 200);
  await attendreQue(() => lireSuivi(m.config, id).rangement?.fini_le, { delaiMs: 60000 });
  const sv = lireSuivi(m.config, id);
  assert.deepEqual([sv.rangement.places, sv.rangement.a_ranger, sv.rangement.en_attente, sv.rangement.reste], [1, 0, 0, { videos: 0, photos: 0 }]);
  assert.ok(fs.existsSync(path.join(m.media, slug, "face", "IMG_7254.mov")));
  assert.ok(!fs.existsSync(f));
  const e = (await api("GET", "/api/etat")).json;
  assert.deepEqual(e.tournages.map((x) => [x.id, x.valide, Boolean(x.a_finir)]), [[id, true, false]]);
});

test("jamais de perte : plan validé sans rien de rangé, il reste « à finir » ; le fichier arrivé après est proposé puis rangé", { skip: !MAC && "macOS seulement" }, async () => {
  const slug = "montee-par-claude-code", id = "2026-11-17-2005";
  const { m, arrivees, api } = await studio(slug, id);
  // L'état laissé chez Yoan par l'ancien code : fin validée, rangement fini sans rien.
  ecrireSuivi(m.config, id, { coches: [1], sautees: [], envoi: true, valide_le: isoZurich(), verification: { complet: true, message: "Tout est arrivé." },
    rangement: { fini_le: isoZurich(), places: 0, a_ranger: 0 } });
  assert.equal(aFinir(lireSuivi(m.config, id)), true);
  assert.equal(aFinir({ valide_le: "x", rangement: { places: 0, a_ranger: 0, en_attente: 0, reste: { videos: 1, photos: 0 } } }), true);
  assert.equal(aFinir({ valide_le: "x", rangement: { places: 1, a_ranger: 0, en_attente: 0, reste: { videos: 0, photos: 0 } } }), false);
  assert.equal(aFinir({ valide_le: "x", rangement: { erreur: "souci" } }), true);
  let e = (await api("GET", "/api/etat")).json;
  assert.deepEqual(e.tournages.map((x) => [x.id, x.a_finir]), [[id, true]], "le plan reste en vue");
  assert.deepEqual(e.a_ranger, []);
  const p = (await api("GET", `/api/tournages/${id}`)).json;
  assert.equal(p.suivi.a_finir, true);
  assert.deepEqual(p.reception.en_cours, []);

  // Le fichier arrive après la fin : en cours, il est montré dans « À ranger » et ne se range pas encore.
  const f = path.join(arrivees, "IMG_7254.mov");
  const envoi = airdrop(f, video(path.join(m.racine, "source.mov")));
  e = (await api("GET", "/api/etat")).json;
  assert.deepEqual(e.a_ranger.map((x) => [x.nom, x.attente, x.en_cours, x.tournage]), [["IMG_7254.mov", true, true, id]]);
  const tot = await api("POST", `/api/tournages/${id}/valider`, {});
  assert.equal(tot.statut, 409);
  assert.equal(tot.json.erreur, "EN_RECEPTION");
  assert.ok(fs.existsSync(f));

  // Fini : proposé au rangement, « Ranger maintenant » le range.
  envoi.finir();
  e = (await api("GET", "/api/etat")).json;
  assert.deepEqual(e.a_ranger.map((x) => [x.nom, x.attente, x.en_cours]), [["IMG_7254.mov", true, false]]);
  assert.match(e.a_ranger[0].raison, /pas encore rangée/);
  assert.equal((await api("POST", `/api/tournages/${id}/valider`, {})).statut, 200);
  await attendreQue(() => lireSuivi(m.config, id).rangement?.reste, { delaiMs: 60000 });
  assert.equal(lireSuivi(m.config, id).rangement.places, 1);
  assert.ok(fs.existsSync(path.join(m.media, slug, "face", "IMG_7254.mov")));
  e = (await api("GET", "/api/etat")).json;
  assert.deepEqual([e.tournages[0].a_finir, e.a_ranger], [undefined, []]);
});
