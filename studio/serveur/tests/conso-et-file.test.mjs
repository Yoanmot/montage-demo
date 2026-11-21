// Consommation de l'abonnement Claude (haut du studio) et montages en lot (Romain lance 7 montages après un tournage,
// part, revient corriger ceux qui sont faits) : un montage à la fois dans la file, une correction passe en priorité
// sans jamais couper le montage en cours, au plus deux rendus à la fois, limite d'abonnement sans perte ni doublon.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawnSync } from "node:child_process";
import { Pont } from "../pont.mjs";
import { File, MONTAGES_MAX } from "../file.mjs";
import { Conso, lireInfo } from "../conso.mjs";
import { demarrer } from "../studio.mjs";
import { monde, attendreQue } from "./aide.mjs";
import { Galerie } from "../../rangement/lib/galerie.mjs";
import { outil } from "../../rangement/lib/commun.mjs";
import { regarder } from "../../rangement/lib/sens.mjs";

const mondes = [];
after(() => mondes.forEach((m) => m.nettoyer()));
const nouveau = (o) => { const m = monde(o); mondes.push(m); return m; };
const H = 3600e3;
const s = (msEpoch) => Math.floor(msEpoch / 1000);

// L'événement tel que claude 2.1.328 l'a écrit le 2026-11-21 (session d'essai, identifiants retirés), heures décalées.
function evenementReel(maintenant) {
  return {
    status: "allowed", resetsAt: s(maintenant + 2 * H), rateLimitType: "five_hour", overageStatus: "rejected",
    overageDisabledReason: "out_of_credits", isUsingOverage: false,
    unifiedWindows: {
      five_hour: { utilization: 0.33, resetsAt: s(maintenant + 2 * H), status: "allowed" },
      seven_day: { utilization: 0.63, resetsAt: s(maintenant + 30 * H), status: "allowed" },
    },
  };
}

// ------------------------------------------------------------------ 1. consommation

test("conso : l'événement réel donne un pourcentage (la fenêtre la plus remplie), puis s'efface à la remise à zéro", () => {
  const m = nouveau();
  const t0 = Date.now();
  const c = new Conso({ home: m.home });
  assert.equal(c.vue(), null, "rien de sûr : rien d'affiché");
  assert.ok(c.noter(evenementReel(t0)));
  let v = c.vue(t0);
  assert.equal(v.niveau, "large");
  assert.match(v.phrase, /^Claude : 63 % de ta limite de la semaine, remise à zéro (demain vers|le .+ vers) \d+ h/);
  assert.ok(!/\u2014/.test(v.phrase), "aucun tiret cadratin");
  // Relu après un redémarrage : c'est un fichier, pas une mémoire.
  assert.deepEqual(new Conso({ home: m.home }).vue(t0), v);
  // La semaine repasse à zéro : reste la fenêtre de 5 h (ici, on simule l'heure).
  const e = evenementReel(t0);
  e.unifiedWindows.seven_day.resetsAt = s(t0 + 60e3);
  c.noter(e);
  v = c.vue(t0 + 2 * 60e3);
  assert.match(v.phrase, /^Claude : 33 % de ta limite, remise à zéro vers \d+ h/);
  // Les deux fenêtres passées : plus rien.
  assert.equal(c.vue(t0 + 3 * H), null);
});

test("conso : limite atteinte, approche, marge ; seules les valeurs connues sont gardées", () => {
  const m = nouveau();
  const t0 = Date.now();
  const c = new Conso({ home: m.home });
  c.noter({ status: "rejected", resetsAt: s(t0 + H), rateLimitType: "five_hour" });
  let v = c.vue(t0);
  assert.equal(v.niveau, "atteinte");
  assert.match(v.phrase, /^Claude : limite atteinte, ça repart (vers|demain vers) \d+ h/);
  assert.equal(c.vue(t0 + 2 * H), null, "effacé après l'heure de remise à zéro");
  // Pourcentage public (utilization) avec avertissement.
  c.noter({ status: "allowed_warning", resetsAt: s(t0 + H), rateLimitType: "five_hour", utilization: 0.86 });
  v = c.vue(t0);
  assert.equal(v.niveau, "proche");
  assert.match(v.phrase, /^Claude : 86 % de ta limite, remise à zéro/);
  // Avertissement sans pourcentage.
  c.noter({ status: "allowed_warning", resetsAt: s(t0 + H), rateLimitType: "five_hour" });
  assert.match(c.vue(t0).phrase, /^Claude : tu approches de ta limite, remise à zéro/);
  c.noter({ status: "allowed", resetsAt: s(t0 + H), rateLimitType: "five_hour" });
  assert.deepEqual([c.vue(t0).niveau, c.vue(t0).phrase], ["large", "Claude : tu as de la marge"]);
  // Un statut inconnu ou des valeurs bizarres ne changent rien.
  assert.equal(c.noter({ status: "inconnu" }), false);
  assert.equal(lireInfo({ status: "allowed", unifiedWindows: { five_hour: { utilization: "beaucoup" } } }).fenetres.five_hour, undefined);
  // Limite vue seulement dans le texte de Claude (sans événement).
  c.noterLimite(t0 + 90 * 60e3);
  assert.equal(c.vue(t0).niveau, "atteinte");
  // Plus de 100 % (Claude le permet) : affiché 100 %.
  c.noter({ status: "allowed_warning", unifiedWindows: { five_hour: { utilization: 1.07, resetsAt: s(t0 + H), status: "rejected" } } });
  assert.match(c.vue(t0).phrase, /^Claude : 100 % de ta limite/);
});

test("conso : le serveur retient l'événement d'une vraie session (faux claude) et le donne à l'interface", async () => {
  const m = nouveau();
  const avant = { ...process.env };
  Object.assign(process.env, { FAUX_CLAUDE_JOURNAL: m.journalClaude, FAUX_CLAUDE_SCENARIO: "limite", FAUX_CLAUDE_REPRISE: String(s(Date.now() + H)) });
  const srv = await demarrer({ env: { ...process.env, STUDIO_HOME: m.home, HOME: m.maison }, silencieux: true });
  try {
    const port = srv.config.port;
    const requete = (methode, chemin, corps, cookie) => new Promise((ok, ko) => {
      const data = corps === undefined ? null : JSON.stringify(corps);
      const req = http.request({ host: "127.0.0.1", port, method: methode, path: chemin, headers: {
        Host: `127.0.0.1:${port}`, Origin: `http://127.0.0.1:${port}`, ...(cookie ? { Cookie: cookie } : {}),
        ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}) } }, (res) => {
        const b = []; res.on("data", (x) => b.push(x));
        res.on("end", () => { let json = null; try { json = JSON.parse(Buffer.concat(b).toString()); } catch { /* page */ } ok({ statut: res.statusCode, json, entetes: res.headers }); });
      });
      req.on("error", ko); if (data) req.write(data); req.end();
    });
    const cookie = String((await requete("GET", `/?t=${srv.jeton}`)).entetes["set-cookie"]).split(";")[0];
    assert.equal((await requete("GET", "/api/etat", undefined, cookie)).json.conso, null);
    assert.equal((await requete("POST", "/api/chats/general/messages", { texte: "salut" }, cookie)).statut, 200);
    await attendreQue(() => !srv.pont.actif("general"));
    const v = (await requete("GET", "/api/etat", undefined, cookie)).json.conso;
    assert.equal(v.niveau, "atteinte");
    assert.match(v.phrase, /^Claude : limite atteinte, ça repart/);
    assert.ok(fs.existsSync(path.join(m.home, "conso-claude.json")));
  } finally {
    await srv.arreter();
    for (const k of Object.keys(process.env)) if (!(k in avant)) delete process.env[k];
    Object.assign(process.env, avant);
  }
});

test("conso : la session du rangement (regard sur les vignettes, hors du pont) met à jour la même ligne", async () => {
  const m = nouveau();
  const t0 = Date.now();
  // Le serveur tourne déjà, avec ce qu'il savait avant.
  const serveur = new Conso({ home: m.home });
  serveur.noter({ status: "allowed", resetsAt: s(t0 + H), rateLimitType: "five_hour" });
  assert.equal(serveur.vue(t0).phrase, "Claude : tu as de la marge");
  // Un faux claude qui écrit l'événement réel puis sa réponse, comme le vrai en stream-json.
  const binaire = path.join(m.racine, "claude-rangement.mjs");
  fs.writeFileSync(binaire, `#!${process.execPath}\nprocess.stdin.resume();process.stdin.on("end",()=>{`
    + `console.log(JSON.stringify({type:"rate_limit_event",rate_limit_info:${JSON.stringify(evenementReel(t0))}}));`
    + `console.log(JSON.stringify({type:"result",is_error:false,result:"{}"}));});\n`, { mode: 0o755 });
  const image = path.join(m.racine, "vue.jpg");
  fs.writeFileSync(image, "jpg");
  const avant = process.env.RANGEMENT_MODELE;
  delete process.env.RANGEMENT_MODELE;
  try {
    const r = await regarder("Que vois-tu ?", [image], { home: m.home, claude: { binaire } });
    assert.deepEqual(r, { ok: true, texte: "{}" });
  } finally { if (avant !== undefined) process.env.RANGEMENT_MODELE = avant; }
  // Le serveur relit le fichier changé par le rangement.
  const v = serveur.vue(t0);
  assert.match(v.phrase, /^Claude : 63 % de ta limite de la semaine/);
});

// ------------------------------------------------------------------ 2. montages en lot

const SLUGS = ["un-a", "deux-b", "trois-c", "quatre-d", "cinq-e", "six-f", "sept-g"];

function lot(m, env = {}, slugs = SLUGS) {
  for (const x of slugs) {
    m.contenu(x);
    fs.mkdirSync(path.join(m.media, x, "face"), { recursive: true });
  }
  const rendus = path.join(m.racine, "rendus.jsonl");
  const pont = new Pont({ config: m.config, envBase: { ...m.env, FAUX_CLAUDE_SCENARIO: "rendu", FAUX_CLAUDE_RENDUS: rendus, ...env } });
  const file = new File({ config: m.config, pont }).charger();
  const lus = () => { try { return fs.readFileSync(rendus, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
  // Le plus de rendus vivants en même temps, d'après leurs heures de début et de fin.
  const maxEnMeme = () => {
    let n = 0, max = 0;
    for (const r of lus().sort((a, b) => a.t - b.t || (a.e === "fin" ? -1 : 1))) { n += r.e === "debut" ? 1 : -1; max = Math.max(max, n); }
    return max;
  };
  let maxSessions = 0;
  pont.on("actives", () => { maxSessions = Math.max(maxSessions, pont.chatsActifs().filter((c) => c.endsWith(":monteur")).length); });
  return { pont, file, lus, maxEnMeme, maxSessions: () => maxSessions };
}

test("lot : 7 montages lancés d'un coup, un seul tourne, chacun dit sa place, tous finis dans l'ordre", async () => {
  const m = nouveau();
  const { file, lus, maxEnMeme } = lot(m, { FAUX_CLAUDE_RENDU_MS: "150" });
  const { actions } = file.ajouter("montage", SLUGS);
  await attendreQue(() => file.trouver(actions[0].id).statut === "en_cours");
  const vue = file.liste();
  assert.deepEqual(actions.slice(1).map((a) => vue.find((x) => x.id === a.id).avant), [1, 2, 3, 4, 5, 6], "« 3 avant lui »");
  await attendreQue(() => actions.every((a) => file.trouver(a.id).statut === "fini"), { delaiMs: 20000 });
  assert.equal(maxEnMeme(), 1, "un seul rendu à la fois");
  assert.deepEqual(lus().filter((r) => r.e === "debut").map((r) => r.s), SLUGS, "dans l'ordre, chacun une fois");
});

test("lot : une correction passe en priorité sans couper le montage en cours, jamais trois rendus", async () => {
  const m = nouveau();
  // Deux contenus déjà montés, que Romain corrige pendant que la file monte les autres.
  for (const x of ["deja-1", "deja-2"]) {
    m.contenu(x);
    m.ecrire(`Contenu/${x}/face/${x}-monte.mp4`, "mp4");
  }
  const { pont, file, lus, maxEnMeme, maxSessions } = lot(m, { FAUX_CLAUDE_RENDU_MS: "700" }, ["un-a", "deux-b", "trois-c"]);
  const { actions } = file.ajouter("montage", ["un-a", "deux-b", "trois-c"]);
  await attendreQue(() => lus().some((r) => r.e === "debut" && r.s === "un-a"));
  // Correction 1 : part tout de suite, à côté du montage en cours.
  pont.envoyer("deja-1:monteur", { texte: "corrige le sous-titre de la 4" });
  await attendreQue(() => lus().some((r) => r.e === "debut" && r.s === "deja-1"));
  // Correction 2 : deux rendus tournent déjà, elle attend sa place (et le dit).
  pont.envoyer("deja-2:monteur", { texte: "corrige le son" });
  assert.equal(pont.etat("deja-2:monteur"), "en_cours");
  assert.ok(pont.historique("deja-2:monteur").some((x) => /J'attends qu'un autre montage se termine/.test(x.texte || "")));
  assert.ok(!lus().some((r) => r.s === "deja-2"), "pas de troisième rendu");
  // Le montage de la file va jusqu'au bout : il n'est pas coupé.
  await attendreQue(() => file.trouver(actions[0].id).statut === "fini", { delaiMs: 10000 });
  assert.ok(lus().some((r) => r.e === "fin" && r.s === "un-a"));
  // Tant qu'une correction tourne ou attend, la file ne lance pas le montage suivant.
  await attendreQue(() => lus().some((r) => r.e === "debut" && r.s === "deja-2"), { delaiMs: 10000 });
  assert.equal(file.trouver(actions[1].id).statut, "en_file");
  assert.equal(file.liste().find((x) => x.id === actions[1].id).attend_montage, true, "« un autre montage se termine d'abord »");
  await attendreQue(() => actions.every((a) => file.trouver(a.id).statut === "fini"), { delaiMs: 20000 });
  const debuts = lus().filter((r) => r.e === "debut").map((r) => r.s);
  assert.ok(debuts.indexOf("deux-b") > debuts.indexOf("deja-2"), "la file reprend après les corrections");
  assert.ok(maxEnMeme() <= MONTAGES_MAX, `au plus ${MONTAGES_MAX} rendus en même temps (vu ${maxEnMeme()})`);
  assert.ok(maxSessions() <= 3, "deux sessions qui travaillent et une qui attend sa place, au plus");
  assert.equal(m.lancements().filter((x) => x.evenement === "lancement" && x.cwd.endsWith("/un-a")).length, 1, "le montage en cours n'a pas été relancé");
});

test("lot : la limite tombe sur le 3e en plein rendu ; il revient en attente, la file se met en pause, tout reprend dans l'ordre sans doublon", async () => {
  const m = nouveau();
  const { pont, file, lus } = lot(m, { FAUX_CLAUDE_RENDU_MS: "1500", FAUX_CLAUDE_LIMITE_SLUG: "trois-c", FAUX_CLAUDE_REPRISE: String(s(Date.now() + H)) });
  const { actions } = file.ajouter("montage", SLUGS);
  const statuts = () => actions.map((a) => file.trouver(a.id).statut);
  await attendreQue(() => file.pause, { delaiMs: 15000 });
  assert.deepEqual(statuts(), ["fini", "fini", "en_file", "en_file", "en_file", "en_file", "en_file"]);
  assert.equal(file.trouver(actions[2].id).attente, "limite");
  assert.match(file.vuePause().phrase, /^Limite de ton abonnement Claude atteinte : tes travaux reprennent tout seul/);
  // Le rendu du 3e continue en fond : son chat reste occupé, rien ne repart sur lui ni après lui.
  assert.ok(pont.actif("trois-c:monteur"));
  assert.ok(lus().some((r) => r.e === "debut" && r.s === "trois-c") && !lus().some((r) => r.e === "fin" && r.s === "trois-c"));
  // L'heure de reprise arrive pendant que le rendu tourne encore : la file attend qu'il finisse, puis repart sur le 3e.
  pont.envBase = { ...pont.envBase };
  file.poserPause("limite", Date.now() - 59e3);
  file.tick();
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(file.pause, null, "la pause est levée à l'heure");
  assert.ok(!lus().some((r) => r.e === "fin" && r.s === "trois-c"), "le rendu du 3e tourne encore");
  assert.ok(!lus().some((r) => r.e === "debut" && r.s === "quatre-d"), "le 4e ne passe pas devant le 3e");
  await attendreQue(() => actions.every((a) => file.trouver(a.id).statut === "fini"), { delaiMs: 20000 });
  assert.equal(file.pause, null);
  const debuts = lus().filter((r) => r.e === "debut").map((r) => r.s);
  assert.deepEqual(debuts, SLUGS, "un rendu par vidéo, dans l'ordre : rien de refait, pas de doublon");
  const lancements = m.lancements().filter((x) => x.evenement === "lancement").map((x) => path.basename(x.cwd));
  assert.deepEqual(lancements, ["un-a", "deux-b", "trois-c", "trois-c", "quatre-d", "cinq-e", "six-f", "sept-g"], "le 3e repart sur sa conversation, les 1 et 2 ne sont pas refaits");
  const reprise = m.lancements().filter((x) => x.evenement === "lancement")[3];
  assert.ok(reprise.argv.includes("--resume"), "même conversation");
  const messages = m.lancements().filter((x) => x.evenement === "message").map((x) => x.texte);
  assert.ok(messages.some((t) => /limite d'utilisation de l'abonnement Claude est repassée.*ne se refait pas/s.test(t)));
  // Le 3e n'a pas été relancé tant que son rendu vivait.
  const finRendu3 = lus().find((r) => r.e === "fin" && r.s === "trois-c").t;
  const journal = fs.readFileSync(m.journalClaude, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const relance3 = journal.filter((x) => x.evenement === "lancement" && x.cwd.endsWith("/trois-c"))[1];
  assert.ok(relance3.t >= finRendu3, "le 3e n'est relancé qu'après la fin de son rendu");
});

// ------------------------------------------------------------------ 3. descriptions de la Galerie dans la même file

// Des photos dans la Galerie, à décrire par la file (comme après un rangement ou un « Ajouter »).
function photos(m, n) {
  const g = new Galerie(m.config.galerie);
  return Array.from({ length: n }, (_, i) => {
    const src = path.join(m.racine, `IMG_90${i}.jpg`);
    const r = spawnSync(outil("ffmpeg"), ["-nostdin", "-v", "error", "-y", "-f", "lavfi", "-i", `color=c=0x${(0x305070 + i * 0x101010).toString(16)}:s=400x500`, "-frames:v", "1", src], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    return g.ajouter(src, { type: "photo", nom_origine: path.basename(src), origine: { genre: "ajout" } }).id;
  });
}
const SKIP = process.platform !== "darwin" && "macOS seulement";

test("croisement : une correction retient les montages, pas les descriptions ; une description ne retient pas un montage", { skip: SKIP }, async () => {
  const m = nouveau();
  m.contenu("deja-1");
  m.ecrire("Contenu/deja-1/face/deja-1-monte.mp4", "mp4");
  const { pont, file, lus } = lot(m, { FAUX_CLAUDE_RENDU_MS: "2500" }, ["un-a", "deux-b"]);
  const g = new Galerie(m.config.galerie);
  const ids = photos(m, 2);
  // Romain corrige une vidéo déjà montée, puis lance deux montages et deux fichiers arrivent dans la Galerie.
  pont.envoyer("deja-1:monteur", { texte: "corrige le sous-titre de la 2" });
  await attendreQue(() => lus().some((r) => r.e === "debut" && r.s === "deja-1"));
  const { actions } = file.ajouter("montage", ["un-a", "deux-b"]);
  const desc = ids.map((id) => file.ajouterDescription(id));
  // Les descriptions passent pendant la correction ; les montages attendent qu'elle finisse.
  await attendreQue(() => ids.every((id) => g.fiche(id).description), { delaiMs: 15000 });
  assert.ok(!lus().some((r) => r.e === "fin" && r.s === "deja-1"), "la correction tourne encore");
  assert.deepEqual(actions.map((a) => file.trouver(a.id).statut), ["en_file", "en_file"], "pas de montage pendant la correction");
  assert.deepEqual(desc.map((a) => file.trouver(a.id).statut), ["fini", "fini"]);
  const vue = file.liste();
  assert.equal(vue.find((x) => x.id === actions[0].id).attend_montage, true);
  // Puis les montages, dans l'ordre, chacun une fois.
  await attendreQue(() => actions.every((a) => file.trouver(a.id).statut === "fini"), { delaiMs: 20000 });
  assert.deepEqual(lus().filter((r) => r.e === "debut").map((r) => r.s), ["deja-1", "un-a", "deux-b"]);

  // À l'inverse : une description en file devant un montage ne le retient pas plus que son propre tour.
  m.contenu("trois-c");
  fs.mkdirSync(path.join(m.media, "trois-c", "face"), { recursive: true });
  const [id3] = photos(m, 1).slice(-1);
  const d3 = file.ajouterDescription(id3);
  const { actions: [a3] } = file.ajouter("montage", ["trois-c"]);
  await attendreQue(() => file.trouver(a3.id).statut === "fini", { delaiMs: 15000 });
  assert.equal(file.trouver(d3.id).statut, "fini");
  assert.ok(g.fiche(id3).description);
});

test("croisement : la limite tombe sur une description ; toute la file (descriptions et montages) attend, puis reprend dans l'ordre", { skip: SKIP }, async () => {
  const m = nouveau();
  const marque = path.join(m.racine, "limite-description");
  const { pont, file, lus } = lot(m, { FAUX_CLAUDE_RENDU_MS: "200", FAUX_CLAUDE_LIMITE_DESCRIPTION: marque, FAUX_CLAUDE_REPRISE: String(s(Date.now() + H)) }, ["un-a"]);
  const g = new Galerie(m.config.galerie);
  const [i1, i2] = photos(m, 2);
  const d1 = file.ajouterDescription(i1);
  const { actions: [a1] } = file.ajouter("montage", ["un-a"]);
  const d2 = file.ajouterDescription(i2);
  await attendreQue(() => file.pause, { delaiMs: 15000 });
  await attendreQue(() => !pont.actif(`galerie:${i1}`));
  assert.deepEqual([d1, a1, d2].map((a) => file.trouver(a.id).statut), ["en_file", "en_file", "en_file"], "tout attend la reprise");
  assert.equal(file.trouver(d1.id).attente, "limite");
  assert.equal(g.fiche(i1).description, null);
  assert.equal(g.fiche(i1).description_erreur, null, "la limite n'est pas un échec de la description");
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(lus().length, 0, "aucun montage pendant la pause");
  assert.equal(m.lancements().filter((x) => x.evenement === "lancement").length, 1, "rien d'autre ne part pendant la pause");
  // L'heure de reprise passe : la description est refaite en entier, puis le montage, puis l'autre description.
  file.poserPause("limite", Date.now() - 59e3);
  file.tick();
  await attendreQue(() => [d1, a1, d2].every((a) => file.trouver(a.id).statut === "fini"), { delaiMs: 20000 });
  assert.equal(file.pause, null);
  assert.ok(g.fiche(i1).description && g.fiche(i2).description);
  const messages = m.lancements().filter((x) => x.evenement === "message");
  assert.equal(messages.filter((x) => x.images).length, 3, "description 1 deux fois (en entier), description 2 une fois");
  assert.ok(!messages.some((x) => x.images && /limite d'utilisation/.test(x.texte)), "une description ne reçoit jamais le message de reprise");
  const ordre = m.lancements().filter((x) => x.evenement === "lancement").map((x) => (/\/un-a$/.test(x.cwd) ? "un-a" : "description"));
  assert.deepEqual(ordre, ["description", "description", "un-a", "description"]);
});
