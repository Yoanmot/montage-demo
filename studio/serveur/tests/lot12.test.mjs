// Lot 12 (retours de Yoan après son test réel) : liens dans le navigateur habituel, idée sans trace
// technique, accroche choisie, idées supprimées ou mises de côté, plan de tournage cochable avec
// vérification des fichiers arrivés à la dernière étape et rangement au clic de fin.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { demarrer } from "../studio.mjs";
import { monde, attendreQue } from "./aide.mjs";
import { ideePourRomain, briefDe, construireCartes } from "../lecture.mjs";
import { verifierArrivees, lireSuivi } from "../tournage.mjs";

let m, s, port, cookie;
const LOG = () => fs.readFileSync(process.env.FAUX_OUTILS_LOG, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));

const FAUX_OUTIL = `#!/usr/bin/env python3
import json, os, sys
with open(os.environ["FAUX_OUTILS_LOG"], "a") as f:
    f.write(json.dumps({"outil": os.path.basename(sys.argv[0]), "argv": sys.argv[1:]}) + "\\n")
a = sys.argv[1:]
if a[0] == "accroche":
    print("OK accroche slug=%s n=%s empreinte=sha256:%s" % (a[1], a[2], "c" * 64))
else:
    print("OK fait")
`;

const FAUX_OPEN = `#!/bin/sh
printf '%s\\n' "$@" >> "$FAUX_OPEN_LOG"
`;

function requete(methode, chemin, { corps, origine, avecCookie = true } = {}) {
  return new Promise((resolve, reject) => {
    const data = corps === undefined ? null : JSON.stringify(corps);
    const req = http.request({ host: "127.0.0.1", port, method: methode, path: chemin, headers: {
      Host: `127.0.0.1:${port}`, Origin: origine ?? `http://127.0.0.1:${port}`,
      ...(avecCookie && cookie ? { Cookie: cookie } : {}),
      ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}),
    } }, (res) => {
      const morceaux = [];
      res.on("data", (x) => morceaux.push(x));
      res.on("end", () => {
        const texte = Buffer.concat(morceaux).toString("utf8");
        let json = null;
        try { json = JSON.parse(texte); } catch { /* pas du JSON */ }
        resolve({ statut: res.statusCode, json, texte, entetes: res.headers });
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}
const api = (methode, chemin, corps) => requete(methode, chemin, { corps });

const SCRIPT = `# Le pire

- Format : face caméra
- Accroche retenue : à choisir par Romain (le texte ci-dessous est écrit avec la 1)
- Durée estimée : ≈30 s

## Accroches proposées
1. (ta situation) Dans un an, tu seras quelque part.
2. (pour qui) Si tu repousses, écoute ça.

## Texte complet
Dans un an, tu seras quelque part.
La suite du texte.

## Légende
Ta légende
`;

const PLAN = {
  version: 1, id: "2026-11-16-1911", cree_le: "2026-11-16T19:11:00+01:00", contenus: ["le-pire"], duree_estimee_min: 15,
  prises: [
    { n: 1, type: "face", contenus: [{ slug: "le-pire", usages: [] }], lieu: "salon", materiel: [], ce_qu_on_voit: "toi", mouvements: [], duree_s: 30, deja_en_bibliotheque: null },
    { n: 2, type: "b-roll", contenus: [{ slug: "le-pire", usages: [{ mouvement: 1, phrase: "La suite du texte." }] }], lieu: "salle", materiel: ["barre"],
      ce_qu_on_voit: "une seule prise, sans couper", mouvements: ["tu prépares ta barre"], duree_s: 5, deja_en_bibliotheque: null },
    { n: 3, type: "b-roll", contenus: [{ slug: "le-pire", usages: [] }], lieu: "bureau", materiel: [], ce_qu_on_voit: "déjà filmé", mouvements: ["tu t'étires"], duree_s: 0, deja_en_bibliotheque: "20261102-101500-ab12" },
    { n: 4, type: "photo", contenus: [{ slug: "le-pire", usages: [{ phrase: "Moi, à 23 ans" }] }], lieu: "", materiel: [], ce_qu_on_voit: "toi à l'époque", mouvements: [], duree_s: 0, deja_en_bibliotheque: null },
  ],
};

before(async () => {
  m = monde();
  process.env.FAUX_CLAUDE_JOURNAL = m.journalClaude;
  process.env.FAUX_OUTILS_LOG = path.join(m.racine, "outils.jsonl");
  process.env.FAUX_OPEN_LOG = path.join(m.racine, "open.log");
  process.env.RANGEMENT_ATTENTE_S = "0";
  for (const o of ["idees.py", "etat.py", "brief.py"]) m.ecrire(`depot/outils/${o}`, FAUX_OUTIL);
  const open = m.ecrire("faux-open.sh", FAUX_OPEN);
  fs.chmodSync(open, 0o755);
  process.env.STUDIO_OUVRIR = open;
  // Le dossier d'arrivée joue des Téléchargements : de vieux fichiers et des fichiers sans rapport.
  const arrivees = path.join(m.racine, "Telechargements");
  fs.mkdirSync(arrivees, { recursive: true });
  const brut = JSON.parse(fs.readFileSync(m.config.fichier, "utf8"));
  brut.arrivees = arrivees;
  fs.writeFileSync(m.config.fichier, JSON.stringify(brut, null, 2));
  m.contenu("le-pire", { titre: "Le pire" });
  m.ecrire("depot/contenus/le-pire/script.md", SCRIPT);
  m.json("depot/tournages/2026-11-16-1911.json", PLAN);
  m.ecrire("depot/tournages/2026-11-16-1911.md", "# Ton tournage\n");
  m.json("depot/propositions/2026-11-16-1900.json", { version: 1, cree_le: "2026-11-16T19:00:00+01:00", demande: "idées", idees: [
    { id: "2026-11-16-1900-01", titre: "Une", format: "reel", angle: "a", source: { type: "chat", ref: null }, pourquoi_maintenant: "p", statut: "proposee", slug: null },
    { id: "2026-11-16-1900-02", titre: "Supprimée avant", format: "reel", angle: "b", source: { type: "chat", ref: null }, pourquoi_maintenant: "p", statut: "refusee", raison_refus: "non", slug: null },
  ] });
  s = await demarrer({ env: { ...process.env, STUDIO_HOME: m.home, HOME: m.maison }, silencieux: true });
  port = s.config.port;
  const r = await requete("GET", `/?t=${s.jeton}`, { avecCookie: false });
  cookie = String(r.entetes["set-cookie"]).split(";")[0];
});

after(async () => {
  await s?.arreter("tests");
  m?.nettoyer();
  for (const k of ["STUDIO_OUVRIR", "RANGEMENT_ATTENTE_S", "FAUX_OPEN_LOG"]) delete process.env[k];
});

test("lien externe : ouvert dans le navigateur habituel, https seulement, protégé comme les autres routes", async () => {
  const ok = await api("POST", "/api/lien", { url: "https://www.instagram.com/reel/DfkoSRxsMNB/" });
  assert.equal(ok.statut, 200, ok.texte);
  assert.equal(fs.readFileSync(process.env.FAUX_OPEN_LOG, "utf8").trim(), "https://www.instagram.com/reel/DfkoSRxsMNB/");
  for (const url of ["http://exemple.com/", "javascript:alert(1)", "file:///etc/passwd", "https://a:b@exemple.com/", "https://localhost/", "-a Calculator", ""]) {
    assert.equal((await api("POST", "/api/lien", { url })).statut, 400, url);
  }
  assert.equal((await requete("POST", "/api/lien", { corps: { url: "https://exemple.com/" }, origine: "https://mechant.example" })).statut, 403);
  assert.equal((await requete("POST", "/api/lien", { corps: { url: "https://exemple.com/" }, avecCookie: false })).statut, 401);
  assert.equal(fs.readFileSync(process.env.FAUX_OPEN_LOG, "utf8").trim().split("\n").length, 1, "rien d'autre n'a été ouvert");
});

test("idée : plus de trace technique (ligne « Écrit par », identifiants), le fichier n'est pas touché", () => {
  const md = `# Le pire\n\nÉcrit par outils/idees.py au moment où Romain a gardé l'idée. Ne pas modifier à la main.\n\n- Format : reel\n- Angle : un angle\n- Accroche possible : aucune\n- Source : outlier DfkoSRxsMNB, @nedwagner, https://www.instagram.com/reel/DfkoSRxsMNB/\n- Pourquoi maintenant : lundi\n- Ce que Romain en a dit :\n- Proposée le : 2026-11-16 (2026-11-16-1900-02)\n- Gardée le : 2026-11-16\n- Jour prévu : à fixer\n`;
  const r = ideePourRomain(md);
  assert.doesNotMatch(r, /outils|idees\.py|DfkoSRxsMNB\b(?!\/)|1900-02|Ce que Romain|aucune|Ne pas modifier/);
  assert.match(r, /D'où elle vient : une vidéo qui a bien marché chez @nedwagner \(\[voir la vidéo\]\(https:\/\/www\.instagram\.com\/reel\/DfkoSRxsMNB\/\)\)/);
  assert.match(r, /Proposée le : 16\/11\/2026$/m);
  assert.match(ideePourRomain("- Source : déclinaison de faim (republication)", () => "Faim à 16 h"), /tirée de « Faim à 16 h » \(à republier\)/);
  assert.match(ideePourRomain("- Source : idée de Romain du 2026-11-14\n- Ce que Romain en a dit : les escaliers"), /ton idée du 14\/11[\s\S]*Ce que tu en as dit : les escaliers/);
});

test("accroches : liste sans les familles, celle du texte reconnue ; choix par l'outil du dépôt, plus après le tournage", async () => {
  const b = briefDe(m.config, "le-pire", "reel");
  assert.deepEqual(b.accroches, [{ n: 1, texte: "Dans un an, tu seras quelque part." }, { n: 2, texte: "Si tu repousses, écoute ça." }]);
  assert.equal(b.accroche, 1);
  const r = await api("POST", "/api/cartes/le-pire/accroche", { n: 2, empreinte: b.empreinte });
  assert.equal(r.statut, 200, r.texte);
  assert.deepEqual(r.json, { empreinte: "sha256:" + "c".repeat(64) });
  const appel = LOG().filter((l) => l.outil === "brief.py").at(-1);
  assert.deepEqual(appel.argv, ["accroche", "le-pire", "2", "--empreinte", b.empreinte, "--pousser"]);
  assert.equal((await api("POST", "/api/cartes/le-pire/accroche", { n: "x" })).statut, 400);
  // Une fois les rushs arrivés, l'accroche ne se change plus ici.
  m.ecrire("Contenu/le-pire/face/IMG_1.MOV", "v");
  const tard = await api("POST", "/api/cartes/le-pire/accroche", { n: 1 });
  assert.equal(tard.statut, 409);
  assert.equal(tard.json.erreur, "TROP_TARD");
  fs.rmSync(path.join(m.media, "le-pire"), { recursive: true });
});

test("idées : supprimer (raison facultative, plus de carte), mettre de côté, reprendre", async () => {
  const cartes = construireCartes(m.config, {});
  assert.ok(!cartes.some((c) => c.proposition_id === "2026-11-16-1900-02"), "une idée refusée avant ce lot n'a plus de carte");
  assert.equal((await api("POST", "/api/propositions/2026-11-16-1900-01/supprimer", { raison: "trop proche d'un autre" })).statut, 200);
  assert.equal((await api("POST", "/api/propositions/2026-11-16-1900-01/supprimer", {})).statut, 200);
  assert.equal((await api("POST", "/api/propositions/2026-11-16-1900-01/mettre-de-cote", {})).statut, 200);
  assert.equal((await api("POST", "/api/propositions/2026-11-16-1900-01/reprendre", {})).statut, 200);
  const appels = LOG().filter((l) => l.outil === "idees.py").map((l) => l.argv);
  assert.deepEqual(appels.slice(-4), [
    ["refuser", "2026-11-16-1900-01", "--raison", "trop proche d'un autre", "--pousser"],
    ["refuser", "2026-11-16-1900-01", "--pousser"],
    ["mettre-de-cote", "2026-11-16-1900-01", "--pousser"],
    ["reprendre", "2026-11-16-1900-01", "--pousser"],
  ]);
});

test("plan de tournage : bulles (script avec l'accroche, b-roll avec sa phrase, photo), coches gardées", async () => {
  const t = await api("GET", "/api/tournages/2026-11-16-1911");
  assert.equal(t.statut, 200, t.texte);
  assert.deepEqual(t.json.bulles.map((b) => [b.n, b.titre]), [[1, "Face caméra"], [2, "B-roll"], [3, "B-roll"], [4, "Photo"]]);
  assert.match(t.json.bulles[0].script, /^Dans un an, tu seras quelque part\./);
  assert.equal(t.json.bulles[0].accroche, "Dans un an, tu seras quelque part.");
  assert.deepEqual(t.json.bulles[1].mouvements, [{ texte: "tu prépares ta barre", phrases: [{ phrase: "La suite du texte.", titre: "Le pire" }] }]);
  assert.equal(t.json.bulles[2].deja, true);
  assert.equal(t.json.bulles[3].photo, "toi à l'époque");
  assert.equal(t.json.suivi.peut_valider, false);
  assert.ok(!("brut" in t.json) && !JSON.stringify(t.json).includes(m.racine));
  const c = await api("POST", "/api/tournages/2026-11-16-1911/cocher", { cle: 1, coche: true });
  assert.deepEqual(c.json.suivi.coches, [1]);
  assert.equal(c.json.suivi.verification, null, "cocher une prise ne vérifie rien");
  assert.equal((await api("POST", "/api/tournages/2026-11-16-1911/cocher", { cle: 99, coche: true })).statut, 404);
  // Survit au rechargement : écrit par le serveur dans STUDIO_HOME/tournages/.
  assert.deepEqual(lireSuivi(m.config, "2026-11-16-1911").coches, [1]);
  assert.deepEqual((await api("GET", "/api/tournages/2026-11-16-1911")).json.suivi.coches, [1]);
});

test("fin du tournage : vérification à la dernière étape seulement, ce qui manque en clair, fichiers sans rapport ignorés", async () => {
  const arr = m.config.arrivees ?? JSON.parse(fs.readFileSync(m.config.fichier, "utf8")).arrivees;
  const vieux = path.join(arr, "IMG_0001.MOV");
  fs.writeFileSync(vieux, "ancien");
  fs.utimesSync(vieux, new Date("2026-11-01T10:00:00Z"), new Date("2026-11-01T10:00:00Z"));
  fs.writeFileSync(path.join(arr, "Capture.png"), "png");
  fs.writeFileSync(path.join(arr, "facture.pdf"), "pdf");
  fs.writeFileSync(path.join(arr, "tuto.mov"), "web");
  spawnSync("/usr/bin/xattr", ["-w", "com.apple.metadata:kMDItemWhereFroms", "https://exemple.invalid/", path.join(arr, "tuto.mov")]);
  fs.writeFileSync(path.join(arr, "IMG_1001.MOV"), "face");
  const avant = await api("POST", "/api/tournages/2026-11-16-1911/valider", {});
  assert.equal(avant.statut, 409);
  assert.equal(avant.json.erreur, "PAS_ENVOYE");
  const v = await api("POST", "/api/tournages/2026-11-16-1911/cocher", { cle: "envoi", coche: true });
  const ver = v.json.suivi.verification;
  assert.deepEqual([ver.attendu, ver.recu, ver.complet], [{ videos: 2, photos: 1 }, { videos: 1, photos: 0 }, false]);
  assert.match(ver.message, /^Je ne vois pas encore tous tes fichiers : il manque 1 vidéo et 1 photo .*Attends que l'envoi soit fini, puis recoche\.$/);
  assert.equal(v.json.suivi.peut_valider, false);
  const refus = await api("POST", "/api/tournages/2026-11-16-1911/valider", {});
  assert.equal(refus.statut, 409);
  assert.equal(refus.json.erreur, "PAS_COMPLET");
  // La photo qu'il n'a pas : il saute la prise, elle n'est plus attendue.
  const saut = await api("POST", "/api/tournages/2026-11-16-1911/sauter", { n: 4, sautee: true });
  assert.deepEqual(saut.json.suivi.verification.attendu, { videos: 2, photos: 0 });
  fs.writeFileSync(path.join(arr, "IMG_1002.MOV"), "broll");
  // Rien ne revérifie tout seul : il faut décocher et recocher la dernière étape.
  assert.equal((await api("GET", "/api/tournages/2026-11-16-1911")).json.suivi.verification.complet, false);
  await api("POST", "/api/tournages/2026-11-16-1911/cocher", { cle: "envoi", coche: false });
  assert.equal(lireSuivi(m.config, "2026-11-16-1911").verification, null);
  const re = await api("POST", "/api/tournages/2026-11-16-1911/cocher", { cle: "envoi", coche: true });
  assert.equal(re.json.suivi.verification.complet, true, re.json.suivi.verification.message);
  assert.match(re.json.suivi.verification.message, /Tu peux valider la fin du tournage/);
  assert.equal(re.json.suivi.peut_valider, true);
  // Le clic revérifie puis range ce plan-là ; la fin est posée quand le rangement a fini.
  const fin = await api("POST", "/api/tournages/2026-11-16-1911/valider", {});
  assert.equal(fin.statut, 200, fin.texte);
  await attendreQue(() => lireSuivi(m.config, "2026-11-16-1911").valide_le, { delaiMs: 30000 });
  const sv = lireSuivi(m.config, "2026-11-16-1911");
  assert.ok(sv.rangement && !sv.rangement.erreur, JSON.stringify(sv.rangement));
  const e = (await api("GET", "/api/etat")).json;
  assert.deepEqual(e.tournages.map((x) => [x.id, x.valide, x.en_cours]), [["2026-11-16-1911", true, false]]);
  for (const nom of ["IMG_0001.MOV", "Capture.png", "facture.pdf", "tuto.mov"]) {
    assert.ok(fs.existsSync(path.join(arr, nom)), `${nom} n'a pas bougé`);
  }
});

test("vérification : un plan d'avant ce lot déjà rangé n'attend plus rien", () => {
  m.ecrire("Contenu/vieux/face/IMG_5.MOV", "v");
  const plan = { id: "x", cree_le: "2099-01-01T00:00:00+01:00", prises: [{ n: 1, type: "face", contenus: [{ slug: "vieux" }] }] };
  const r = verifierArrivees(s.config, plan, { sautees: [] });
  assert.deepEqual([r.attendu, r.complet], [{ videos: 0, photos: 0 }, true]);
});
