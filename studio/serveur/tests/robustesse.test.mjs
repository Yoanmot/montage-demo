// Lot 12, volet A : Romain, seul devant son Mac, n'est jamais coincé et n'a pas à appeler Yoan pour ce qui se
// règle tout seul (limite d'abonnement, Claude surchargé, conversation effacée, action en souci, disque bas).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { Pont } from "../pont.mjs";
import { File } from "../file.mjs";
import { reglagesChat } from "../reglages.mjs";
import { classerErreur, heureDeReprise, Normaliseur, PHRASE_SURCHARGE, PHRASE_CONNEXION } from "../normalisation.mjs";
import { alerteDisque, alerteConnexion, alerteArrivees } from "../alertes.mjs";
import { installerFilet, demarrer } from "../studio.mjs";
import { enRoute } from "../../publication/publication.mjs";
import { lireJson } from "../outils.mjs";
import { monde, attendreQue, vivant } from "./aide.mjs";

const mondes = [];
after(() => mondes.forEach((m) => m.nettoyer()));
const nouveau = (o) => { const m = monde(o); mondes.push(m); return m; };
const GO = 1024 ** 3;

// Ce qui s'affiche dans le chat (textes et lignes d'état), pour vérifier qu'aucun texte brut de Claude n'y arrive.
const visible = (pont, chat) => pont.historique(chat).map((x) => x.texte || "").join("\n");

// ------------------------------------------------------------------ 1. écritures après un cd

test("réglages : écritures permises par le chemin absolu du dossier de la session, conversations gardées 10 ans", () => {
  const m = nouveau();
  m.contenu("un-contenu");
  const arg = (r, k) => r.args[r.args.indexOf(k) + 1];
  const g = reglagesChat("general", m.config);
  const permis = arg(g, "--allowedTools").split(" ");
  const abs = `//${m.depot.replace(/^\/+/, "")}/**`;
  for (const o of ["Edit", "Write", "NotebookEdit"]) {
    assert.ok(permis.includes(`${o}(${abs})`), `${o} absolu`);
    assert.ok(permis.includes(`${o}(./**)`), `${o} relatif gardé`);
  }
  const mo = reglagesChat("un-contenu:monteur", m.config);
  assert.ok(arg(mo, "--allowedTools").split(" ").includes(`Write(//${path.join(m.media, "un-contenu").replace(/^\/+/, "")}/**)`));
  assert.equal(JSON.parse(arg(g, "--settings")).cleanupPeriodDays, 3650);
});

// ------------------------------------------------------------------ 2 et 8. classement des erreurs

test("erreurs de Claude : limite, connexion, surcharge, réseau ; heure de reprise lue", () => {
  const maintenant = new Date(2026, 10, 20, 10, 0).getTime();
  assert.equal(classerErreur("You've hit your session limit · resets 3pm").motif, "limite");
  assert.equal(classerErreur("Claude usage limit reached").motif, "limite");
  assert.equal(classerErreur("x", 429).motif, "limite");
  assert.equal(classerErreur("Not logged in · Please run /login").motif, "connexion");
  assert.equal(classerErreur('API Error: 529 {"type":"error","error":{"type":"overloaded_error"}}').motif, "surcharge");
  assert.equal(classerErreur("API Error: 500 Internal server error").motif, "surcharge");
  assert.equal(classerErreur("API Error: Connection error. fetch failed").motif, "reseau");
  assert.equal(classerErreur("autre chose").motif, "autre");
  assert.equal(new Date(heureDeReprise("resets 3pm", maintenant)).getHours(), 15);
  assert.equal(new Date(heureDeReprise("resets 3:30 pm (Europe/Zurich)", maintenant)).getMinutes(), 30);
  assert.equal(heureDeReprise("resets in 2h 15m", maintenant), maintenant + 2.25 * 3600e3);
  assert.equal(new Date(heureDeReprise("resets 9am", maintenant)).getDate(), 21, "9 h déjà passé : demain");
  assert.equal(heureDeReprise("rien", maintenant), null);
});

test("normaliseur : un texte <synthetic> (limite, API Error) n'est jamais relayé ; l'heure de reprise vient de Claude", () => {
  let n = 0;
  const no = new Normaliseur(() => ++n);
  const reprise = Math.floor(Date.now() / 1000) + 3600;
  const s = [
    ...no.traiter({ type: "rate_limit_event", rate_limit_info: { status: "rejected", resetsAt: reprise } }),
    ...no.traiter({ type: "assistant", message: { id: "a", model: "<synthetic>", content: [{ type: "text", text: "You've hit your session limit · resets 3pm" }] } }),
    ...no.traiter({ type: "result", subtype: "success", is_error: true, api_error_status: 429, result: "You've hit your session limit · resets 3pm" }),
  ];
  assert.deepEqual(s.filter((e) => e.genre === "texte"), []);
  const fin = s.find((e) => e.genre === "fin");
  assert.equal(fin.motif, "limite");
  assert.equal(fin.reprise, reprise * 1000);
  assert.match(fin.erreur, /limite d'utilisation de ton abonnement Claude\. Rien n'est cassé : ça repart tout seul (vers|demain vers) \d+ h/);
  assert.doesNotMatch(fin.erreur, /réviens/);
  const no2 = new Normaliseur(() => ++n);
  const s2 = [
    ...no2.traiter({ type: "assistant", message: { id: "b", model: "<synthetic>", content: [{ type: "text", text: "API Error: 529 {\"type\":\"error\"}" }] } }),
    ...no2.traiter({ type: "result", subtype: "success", is_error: true, api_error_status: 529, result: "API Error: 529 {}" }),
  ];
  assert.deepEqual(s2.filter((e) => e.genre === "texte"), []);
  assert.equal(s2.find((e) => e.genre === "fin").erreur, PHRASE_SURCHARGE);
});

test("chat : limite atteinte, une phrase claire en français dans le chat, rien d'anglais, pas de « préviens »", async () => {
  const m = nouveau();
  const pont = new Pont({ config: m.config, envBase: { ...m.env, FAUX_CLAUDE_SCENARIO: "limite" } });
  pont.envoyer("general", { texte: "fais-moi 3 idées" });
  await attendreQue(() => pont.etat("general") === "erreur");
  const fin = pont.historique("general").at(-1);
  assert.equal(fin.motif, "limite");
  assert.match(fin.texte, /limite d'utilisation de ton abonnement Claude/);
  assert.match(fin.texte, /Redemande-moi à ce moment-là/);
  assert.doesNotMatch(visible(pont, "general"), /hit your|API Error|réviens/);
});

// ------------------------------------------------------------------ 8. réessai des erreurs passagères

test("Claude surchargé : réessayé tout seul, rien n'est dit si le réessai passe", async () => {
  const m = nouveau();
  const echecs = m.ecrire("echecs.txt", "1");
  const pont = new Pont({ config: m.config, delaisReessai: [50, 50], envBase: { ...m.env, FAUX_CLAUDE_SCENARIO: "surcharge", FAUX_CLAUDE_ECHECS: echecs } });
  pont.envoyer("general", { texte: "bonjour" });
  await attendreQue(() => pont.etat("general") === "a_toi" && !pont.actif("general"));
  const etats = pont.historique("general").filter((x) => x.type === "etat").map((x) => x.etat);
  assert.deepEqual(etats, ["en_cours", "a_toi"], "aucune erreur montrée");
  const l = m.lancements().filter((x) => x.evenement === "lancement");
  assert.equal(l.length, 2);
  assert.ok(l[1].argv.includes("--resume"), "le réessai reprend la même conversation");
  assert.match(m.lancements().filter((x) => x.evenement === "message").at(-1).texte, /erreur passagère/);
  assert.doesNotMatch(visible(pont, "general"), /API Error|529/);
});

test("Claude surchargé plusieurs fois : après les réessais, une phrase honnête (réessaie dans quelques minutes)", async () => {
  const m = nouveau();
  const pont = new Pont({ config: m.config, delaisReessai: [30, 30], envBase: { ...m.env, FAUX_CLAUDE_SCENARIO: "surcharge" } });
  pont.envoyer("general", { texte: "bonjour" });
  await attendreQue(() => pont.etat("general") === "erreur" && !pont.actif("general"));
  assert.equal(m.lancements().filter((x) => x.evenement === "lancement").length, 3, "un essai puis deux réessais");
  assert.equal(pont.historique("general").at(-1).texte, PHRASE_SURCHARGE);
  assert.equal(pont.historique("general").filter((x) => x.etat === "erreur").length, 1, "dit une seule fois");
});

// ------------------------------------------------------------------ 3. conversation effacée par Claude

test("conversation effacée (fichier absent) : le chat repart sur une conversation neuve, sans erreur", async () => {
  const m = nouveau();
  m.contenu("vieux-contenu");
  fs.mkdirSync(path.join(m.maison, ".claude", "projects", "-autre"), { recursive: true });
  m.json("studio/sessions.json", { "vieux-contenu:hoc": { session_id: "11111111-2222-3333-4444-555555555555", cwd: m.depot } });
  const pont = new Pont({ config: m.config, envBase: m.env, envConfig: m.env });
  assert.equal(pont.aUneSession("vieux-contenu:hoc"), false);
  assert.equal(lireJson(path.join(m.home, "sessions.json"))["vieux-contenu:hoc"], undefined, "session perdue oubliée");
  m.json("studio/sessions.json", { "vieux-contenu:hoc": { session_id: "11111111-2222-3333-4444-555555555555", cwd: m.depot } });
  pont.envoyer("vieux-contenu:hoc", { texte: "on reprend ?" });
  await attendreQue(() => pont.etat("vieux-contenu:hoc") === "a_toi");
  const l = m.lancements().filter((x) => x.evenement === "lancement");
  assert.ok(!l[0].argv.includes("--resume"));
  assert.match(m.lancements().find((x) => x.evenement === "message").texte, /conversation précédente de ce chat n'existe plus[\s\S]*on reprend \?/);
});

test("conversation effacée (Claude répond « No conversation found ») : relancée une fois sans --resume, sans erreur", async () => {
  const m = nouveau();
  m.contenu("tres-vieux");
  m.json("studio/sessions.json", { "tres-vieux:hoc": { session_id: "aaaaaaaa-2222-3333-4444-555555555555", cwd: m.depot } });
  const pont = new Pont({ config: m.config, envBase: { ...m.env, FAUX_CLAUDE_SCENARIO: "perdue" } });
  pont.envoyer("tres-vieux:hoc", { texte: "et maintenant ?" });
  await attendreQue(() => pont.etat("tres-vieux:hoc") === "a_toi");
  const l = m.lancements().filter((x) => x.evenement === "lancement");
  assert.equal(l.length, 2);
  assert.ok(l[0].argv.includes("--resume"));
  assert.ok(!l[1].argv.includes("--resume"));
  const etats = pont.historique("tres-vieux:hoc").filter((x) => x.type === "etat").map((x) => x.etat);
  assert.deepEqual(etats, ["en_cours", "a_toi"]);
  assert.notEqual(pont.sessions()["tres-vieux:hoc"].session_id, "aaaaaaaa-2222-3333-4444-555555555555");
});

// ------------------------------------------------------------------ 2. la file en pause sur la limite

test("file : limite atteinte, l'action attend et la file se met en pause, puis tout repart à l'heure de reprise", async () => {
  const m = nouveau();
  for (const s of ["un-a", "deux-b"]) m.contenu(s);
  const env = { ...m.env, FAUX_CLAUDE_SCENARIO: "limite", FAUX_CLAUDE_REPRISE: String(Math.floor(Date.now() / 1000) + 3600) };
  const pont = new Pont({ config: m.config, envBase: env });
  const file = new File({ config: m.config, pont }).charger();
  const { actions } = file.ajouter("script", ["un-a", "deux-b"]);
  await attendreQue(() => file.pause && !pont.actif("un-a:hoc"));
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(m.lancements().filter((x) => x.evenement === "lancement").length, 1, "pas d'échecs en chaîne");
  assert.deepEqual(actions.map((a) => file.trouver(a.id).statut), ["en_file", "en_file"]);
  assert.equal(file.trouver(actions[0].id).attente, "limite");
  const v = file.vuePause();
  assert.equal(v.motif, "limite");
  assert.match(v.phrase, /tes travaux reprennent tout seul/);
  assert.ok(lireJson(path.join(m.home, "file.json")).pause, "la pause survit à un redémarrage");
  assert.match(pont.historique("un-a:hoc").at(-1).texte, /Ce travail reprendra tout seul/);
  // L'heure de reprise arrive : la limite est levée, les deux actions repartent (la première sur sa conversation).
  pont.envBase = { ...m.env };
  file.poserPause("limite", Date.now() - 59e3);
  await attendreQue(() => actions.every((a) => file.trouver(a.id).statut === "a_toi"), { delaiMs: 10000 });
  assert.equal(file.pause, null);
  const messages = m.lancements().filter((x) => x.evenement === "message").map((x) => x.texte);
  assert.ok(messages.some((t) => /limite d'utilisation de l'abonnement Claude est repassée/.test(t)));
});

test("file : compte déconnecté, une seule phrase « préviens », la file attend le prochain tour réussi", () => {
  const m = nouveau();
  const pont = new Pont({ config: m.config, envBase: m.env });
  const file = new File({ config: m.config, pont }).charger();
  // Un travail hors Claude suffit ici : la file ne le relance pas d'elle-même.
  file.actions.push({ id: "a-x", type: "rangement", slug: "souci-x", statut: "en_cours", session: "souci-x:hoc", debut: "2026-11-20T10:00:00+01:00" });
  pont.emit("fin", { chat_id: "souci-x:hoc", etat: "erreur", erreur: PHRASE_CONNEXION, motif: "connexion" });
  assert.equal(file.trouver("a-x").statut, "en_file");
  assert.equal(file.vuePause().motif, "connexion");
  assert.equal(file.pause.jusqua, null);
  pont.emit("fin", { chat_id: "general", etat: "a_toi" });
  assert.equal(file.pause, null, "un tour réussi lève la pause");
});

// ------------------------------------------------------------------ 5. actions en souci

test("file : une action en souci se relance ou s'efface en un clic ; un essai réussi clôt les anciens", async () => {
  const m = nouveau();
  m.contenu("souci-a");
  m.json("studio/file.json", { version: 1, actions: [
    { id: "a-1", type: "script", slug: "souci-a", lot: "l", statut: "erreur", erreur: "Ça a coincé.", cree_le: "x", debut: "x", fin: "x", session: "souci-a:hoc" },
    { id: "a-2", type: "rangement", lot: "l", statut: "erreur", erreur: "Ça n'a pas marché.", cree_le: "x", debut: "x", fin: "x", session: null },
    { id: "a-3", type: "script", slug: "souci-a", lot: "l", statut: "erreur", erreur: "Ça a coincé.", cree_le: "x", debut: "x", fin: "x", session: "souci-a:hoc" },
  ] });
  const pont = new Pont({ config: m.config, envBase: { ...m.env, FAUX_CLAUDE_ECRIT: "contenus/{slug}/script.md" } });
  const file = new File({ config: m.config, pont }).charger();
  assert.equal(file.relancer("a-2").code, "PAS_RELANCABLE");
  assert.ok(file.effacer("a-2").ok);
  assert.ok(!file.liste().some((a) => a.id === "a-2"), "effacée : plus montrée");
  assert.equal(file.relancer("a-2").code, "INTROUVABLE");
  assert.ok(file.relancer("a-1").ok);
  await attendreQue(() => file.trouver("a-1").statut === "fini");
  assert.equal(file.trouver("a-3").statut, "fini", "l'ancien essai du même travail est clos");
  assert.ok(!file.liste().some((a) => a.statut === "erreur"));
});

// ------------------------------------------------------------------ 6. arrêter un rendu en fond, un seul processus

test("rendu en arrière-plan : un message attend la fin du processus (jamais deux), et « Arrêter » l'arrête vraiment", async () => {
  const m = nouveau();
  m.contenu("rendu");
  const pont = new Pont({ config: m.config, envBase: { ...m.env, FAUX_CLAUDE_SCENARIO: "suite", FAUX_CLAUDE_ATTENTE: "4000" } });
  const chat = "rendu:monteur";
  fs.mkdirSync(path.join(m.media, "rendu"), { recursive: true });
  pont.envoyer(chat, { texte: "fabrique la vidéo" });
  await attendreQue(() => pont.historique(chat).some((x) => x.etat === "a_toi"));
  assert.ok(pont.actif(chat), "le processus tourne encore (rendu en fond) : le chat est occupé");
  const pid = m.lancements().find((x) => x.evenement === "lancement").pid;
  pont.envoyer(chat, { texte: "et ajoute une musique" });
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(m.lancements().filter((x) => x.evenement === "lancement").length, 1, "jamais deux processus sur un chat");
  assert.equal(pont.etat(chat), "en_cours");
  assert.equal(pont.arreter(chat), true);
  await attendreQue(() => !pont.actif(chat) && !vivant(pid));
  assert.equal(pont.historique(chat).at(-1).etat, "arrete");
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(m.lancements().filter((x) => x.evenement === "lancement").length, 1, "le message en attente est abandonné");
  assert.equal(pont.arreter(chat), false, "rien à arrêter");
});

test("rendu en arrière-plan : le message en attente part quand le processus a fini", async () => {
  const m = nouveau();
  m.contenu("rendu-b");
  const pont = new Pont({ config: m.config, envBase: { ...m.env, FAUX_CLAUDE_SCENARIO: "suite", FAUX_CLAUDE_ATTENTE: "600" } });
  const chat = "rendu-b:hoc";
  pont.envoyer(chat, { texte: "fabrique" });
  await attendreQue(() => pont.historique(chat).some((x) => x.etat === "a_toi"));
  pont.envoyer(chat, { texte: "et après ?" });
  await attendreQue(() => m.lancements().filter((x) => x.evenement === "lancement").length === 2, { delaiMs: 10000 });
  const [l1, l2] = m.lancements().filter((x) => x.evenement === "lancement");
  assert.ok(m.lancements().some((x) => x.evenement === "fin" && x.pid === l1.pid), "le premier a fini avant");
  assert.ok(l2.argv.includes("--resume"));
  await attendreQue(() => !pont.actif(chat) && pont.etat(chat) === "a_toi", { delaiMs: 10000 });
});

// ------------------------------------------------------------------ 4. chat général réinitialisable

test("chat général : nouvelle conversation, l'ancienne archivée, refusée pendant un travail", async () => {
  const m = nouveau();
  const pont = new Pont({ config: m.config, envBase: m.env });
  pont.envoyer("general", { texte: "bonjour" });
  await attendreQue(() => pont.etat("general") === "a_toi" && !pont.actif("general"));
  assert.ok(pont.sessions().general);
  assert.equal(pont.reinitialiser("general"), true);
  assert.deepEqual(pont.historique("general"), []);
  assert.equal(pont.sessions().general, undefined);
  const archives = fs.readdirSync(path.join(m.home, "chats", "archives"));
  assert.equal(archives.length, 1);
  assert.match(fs.readFileSync(path.join(m.home, "chats", "archives", archives[0]), "utf8"), /bonjour/);
  pont.envBase = { ...m.env, FAUX_CLAUDE_SCENARIO: "lent", FAUX_CLAUDE_ATTENTE: "800" };
  pont.envoyer("general", { texte: "encore" });
  assert.equal(pont.reinitialiser("general"), false);
  assert.ok(!m.lancements().filter((x) => x.evenement === "lancement").at(-1).argv.includes("--resume"), "conversation neuve");
  pont.arreter("general");
  await attendreQue(() => !pont.actif("general"));
});

// ------------------------------------------------------------------ M1, M2

test("redémarrage : un tour coupé est dit « coupé » (pas « tu as arrêté »), et les sessions orphelines sont arrêtées", async () => {
  const m = nouveau();
  m.ecrire("studio/chats/general.jsonl", JSON.stringify({ n: 1, le: "x", role: "studio", type: "etat", etat: "en_cours" }) + "\n");
  const orphelin = spawn("/bin/sleep", ["30"], { detached: true, stdio: "ignore" });
  const etranger = spawn("/bin/sleep", ["30"], { detached: true, stdio: "ignore" });
  m.json("studio/processus.json", { general: { pid: orphelin.pid, binaire: "/bin/sleep" }, "x:hoc": { pid: etranger.pid, binaire: "/chemin/claude" } });
  const pont = new Pont({ config: m.config, envBase: m.env });
  assert.equal(pont.historique("general").at(-1).etat, "coupe");
  assert.equal(pont.etat("general"), "coupe");
  await attendreQue(() => !vivant(orphelin.pid));
  assert.ok(vivant(etranger.pid), "un PID qui ne fait pas tourner claude n'est pas touché");
  process.kill(-etranger.pid, "SIGKILL");
  assert.deepEqual(lireJson(path.join(m.home, "processus.json")), {});
});

test("disque plein : une écriture d'historique impossible ne fait pas tomber le pont", () => {
  const m = nouveau();
  const journal = [];
  const pont = new Pont({ config: m.config, envBase: m.env, journal: (e, d) => journal.push([e, d]) });
  const f = m.ecrire("studio/chats/general.jsonl", "");
  fs.chmodSync(f, 0o400);
  assert.doesNotThrow(() => pont.noter("general", { n: 1, le: "x", role: "studio", type: "texte", texte: "a" }));
  assert.ok(journal.some(([e]) => e === "ecriture_impossible"));
  fs.chmodSync(f, 0o600);
});

test("filet : une erreur d'écriture (ENOSPC) est journalisée sans arrêter le serveur ; une autre l'arrête proprement", async () => {
  const proc = new EventEmitter();
  const journal = [];
  let arrete = 0, sortie = null;
  installerFilet({ journal: (e, d) => journal.push([e, d]), arreter: async () => { arrete += 1; }, sortir: (c) => { sortie = c; }, proc });
  proc.emit("uncaughtException", Object.assign(new Error("no space left on device"), { code: "ENOSPC" }));
  assert.equal(arrete, 0);
  assert.equal(sortie, null);
  proc.emit("unhandledRejection", new Error("rejet"));
  assert.equal(journal.length, 2);
  proc.emit("uncaughtException", new TypeError("x is undefined"));
  await attendreQue(() => sortie === 1);
  assert.equal(arrete, 1);
});

// ------------------------------------------------------------------ 7, 11. alertes

test("alertes : place libre basse (avec quoi faire), connexion qui arrive à son terme (date, jamais la clé)", () => {
  const sans = { media: "/x", disque: null };
  assert.equal(alerteDisque(sans, { libre: 30 * GO }), null);
  const bas = alerteDisque(sans, { libre: 12 * GO });
  assert.equal(bas.genre, "attention");
  assert.match(bas.texte, /plus que 12 Go/);
  assert.match(bas.texte, /Vide la corbeille/);
  assert.equal(bas.action, null);
  const plein = alerteDisque({ media: "/x", disque: "/Volumes/Disque" }, { libre: 3 * GO });
  assert.equal(plein.genre, "critique");
  assert.equal(plein.action, "archiver");
  assert.match(plein.texte, /Faire de la place/);

  const m = nouveau();
  const client = { racineAbs: m.racine };
  m.ecrire("claude.env", "CLAUDE_CODE_OAUTH_TOKEN=secret\n");
  assert.equal(alerteConnexion(client, { racine: m.racine }), null, "date non notée : rien (la clé n'est jamais lue)");
  // La date notée par l'installation (volet C) : <racine>/connexion-claude.json.
  const noter = (jours) => m.json("connexion-claude.json", { pose_le: new Date(Date.now() - jours * 86400e3).toISOString(),
    expire_le: new Date(Date.now() + (365 - jours) * 86400e3).toISOString(), duree_jours: 365, source: "cles.sh" });
  noter(100);
  assert.equal(alerteConnexion(client, { racine: m.racine }), null);
  noter(345);
  const a = alerteConnexion(client, { racine: m.racine });
  assert.equal(a.genre, "attention");
  assert.match(a.texte, /arrive à son terme le \d+ \S+ \d{4}\. Préviens Yoan avant cette date/);
  assert.doesNotMatch(JSON.stringify(a), /secret/);
  noter(400);
  assert.equal(alerteConnexion(client, { racine: m.racine }).genre, "critique");
  // Téléchargements illisible (noté par le garde) : dit, avec ce qui marche encore.
  assert.equal(alerteArrivees(m.home), null);
  m.json("studio/acces-arrivees.json", { ok: false, dossier: "/x", erreur: "EPERM", verifie_le: "2026-11-20T09:00:00+01:00" });
  assert.match(alerteArrivees(m.home).texte, /Téléchargements[\s\S]*Ajouter une vidéo[\s\S]*Préviens Yoan/);
  m.json("studio/acces-arrivees.json", { ok: true });
  assert.equal(alerteArrivees(m.home), null);
});

// ------------------------------------------------------------------ 9. programmé relu chez Zernio

test("publication : un programmé dont l'heure est passée est relu chez Zernio (lecture), pas un programmé à venir", () => {
  const m = nouveau();
  const il_y_a = (min) => new Date(Date.now() - min * 60e3).toISOString();
  m.json("depot/publications/registre.json", { version: 1, publications: {
    passe: { statut: "programmé", prevu_le: il_y_a(30), zernio_post: "p1" },
    juste: { statut: "programmé", prevu_le: il_y_a(1), zernio_post: "p2" },
    futur: { statut: "programmé", prevu_le: "2099-01-01 18:30", zernio_post: "p3" },
    publie: { statut: "publié", prevu_le: il_y_a(60), zernio_post: "p4" },
    envoye: { statut: "envoyé", zernio_post: "p5" },
  } });
  const config = { depot_hoc: m.depot, depot_mac: m.depot, media: m.media };
  assert.deepEqual(enRoute(config).sort(), ["envoye", "passe"]);
});

// ------------------------------------------------------------------ routes : chat général, arrêter, actions, alertes

test("serveur : retour après une pause, le chat général repart à zéro ; routes nouvelle, arrêter, relancer, effacer", async () => {
  const m = nouveau();
  const vieux = new Date(Date.now() - 7 * 3600e3).toISOString();
  m.ecrire("studio/chats/general.jsonl", [
    { n: 1, le: vieux, role: "romain", type: "texte", texte: "hier" },
    { n: 2, le: vieux, role: "studio", type: "etat", etat: "a_toi" },
  ].map((x) => JSON.stringify(x)).join("\n") + "\n");
  m.json("studio/sessions.json", { general: { session_id: "bbbbbbbb-2222-3333-4444-555555555555", cwd: m.depot } });
  m.json("studio/file.json", { version: 1, actions: [
    { id: "a-9", type: "rangement", lot: "l", statut: "erreur", erreur: "Ça n'a pas marché.", cree_le: "x", debut: "x", fin: "x", session: null },
  ] });
  process.env.FAUX_CLAUDE_JOURNAL = m.journalClaude;
  const s = await demarrer({ env: { ...process.env, STUDIO_HOME: m.home, HOME: m.maison }, silencieux: true });
  try {
    const port = s.config.port;
    const requete = (methode, chemin, corps, cookie) => new Promise((ok, ko) => {
      const data = corps === undefined ? null : JSON.stringify(corps);
      const req = http.request({ host: "127.0.0.1", port, method: methode, path: chemin, headers: {
        Host: `127.0.0.1:${port}`, Origin: `http://127.0.0.1:${port}`, ...(cookie ? { Cookie: cookie } : {}),
        ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}) } }, (res) => {
        const b = []; res.on("data", (x) => b.push(x));
        res.on("end", () => { const t = Buffer.concat(b).toString(); let json = null; try { json = JSON.parse(t); } catch { /* page */ } ok({ statut: res.statusCode, json, entetes: res.headers }); });
      });
      req.on("error", ko); if (data) req.write(data); req.end();
    });
    const cookie = String((await requete("GET", `/?t=${s.jeton}`)).entetes["set-cookie"]).split(";")[0];
    const api = (me, ch, co) => requete(me, ch, co, cookie);
    const e = (await api("GET", "/api/etat")).json;
    assert.ok(Array.isArray(e.alertes));
    assert.equal(e.file_pause, null);
    assert.match(e.version, /^([0-9a-f]{12}|d\d+)$/, "version du code servi, pour recharger une page restée ouverte");
    assert.equal((await api("POST", "/api/chats/general/arreter", {})).statut, 409, "rien à arrêter");
    assert.equal((await api("POST", "/api/chats/general/messages", { texte: "nouvelle séance" })).statut, 200);
    await attendreQue(() => s.pont.etat("general") === "a_toi" && !s.pont.actif("general"));
    const h = s.pont.historique("general");
    assert.ok(!h.some((x) => x.texte === "hier"), "l'ancien fil est archivé");
    assert.equal(h[0].texte, "nouvelle séance");
    assert.ok(!m.lancements().find((x) => x.evenement === "lancement").argv.includes("--resume"));
    assert.equal(fs.readdirSync(path.join(m.home, "chats", "archives")).length, 1);
    // Bouton « Nouvelle conversation ».
    assert.equal((await api("POST", "/api/chats/general/nouvelle", {})).statut, 200);
    assert.deepEqual(s.pont.historique("general"), []);
    assert.equal((await api("POST", "/api/chats/x:hoc/nouvelle", {})).statut, 404);
    // Actions en souci.
    assert.equal((await api("POST", "/api/actions/a-9/relancer", {})).statut, 409);
    assert.equal((await api("POST", "/api/actions/a-9/effacer", {})).statut, 200);
    assert.ok(!(await api("GET", "/api/etat")).json.file.some((a) => a.id === "a-9"));
  } finally {
    await s.arreter("tests");
  }
});
