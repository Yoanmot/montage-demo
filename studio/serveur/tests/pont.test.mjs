import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pont } from "../pont.mjs";
import { Normaliseur, phraseActivite, PHRASE_CONNEXION } from "../normalisation.mjs";
import { reglagesChat, typeDeChat, environnement, CONSIGNE_STUDIO } from "../reglages.mjs";
import { monde, attendreQue, vivant, ICI } from "./aide.mjs";

const mondes = [];
after(() => mondes.forEach((m) => m.nettoyer()));

function pontDe(m, env = {}) {
  const p = new Pont({ config: m.config, envBase: { ...m.env, ANTHROPIC_API_KEY: "ne-doit-pas-passer", ZERNIO_ECRITURE_ROMAIN: "oui", ...env } });
  return p;
}

async function finDeTour(pont, chatId) {
  return new Promise((r) => {
    const f = (e) => { if (e.chat_id === chatId) { pont.off("fin", f); r(e); } };
    pont.on("fin", f);
  });
}

test("normalisation de l'échange enregistré : texte partiel puis final, activité sans chemin, fin", () => {
  const lignes = fs.readFileSync(path.join(ICI, "enregistrements", "bonjour.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  let n = 0;
  const norm = new Normaliseur(() => ++n);
  const sortie = lignes.flatMap((l) => norm.traiter(l));
  assert.equal(sortie[0].genre, "session");
  const activites = sortie.filter((e) => e.genre === "activite");
  assert.deepEqual(activites.map((a) => a.texte), ["je relis ce qu'on a déjà"]);
  const partiels = sortie.filter((e) => e.genre === "texte" && e.partiel);
  const finals = sortie.filter((e) => e.genre === "texte" && !e.partiel);
  assert.ok(partiels.length >= 2, "le texte arrive au fil de l'eau");
  assert.equal(finals.length, 1, "un seul texte final (pas de doublon avec le message complet)");
  assert.equal(partiels[0].n, finals[0].n, "le partiel et le final ont le même numéro");
  assert.match(finals[0].texte, /Bonjour/);
  assert.deepEqual(sortie.at(-1), { genre: "fin", erreur: null, limite: false });
});

test("phrases d'activité : jamais de chemin ni de nom d'outil", () => {
  const cas = [
    ["Read", { file_path: "/Users/x/depot/contenus/a/script.md" }],
    ["Write", { file_path: "/Users/x/depot/propositions/2026.json" }],
    ["Bash", { command: "git add -A && git commit -m x && git push origin HEAD:main" }],
    ["Bash", { command: "ffmpeg -i /Users/x/Contenu/a/face/IMG.mov out.mp4" }],
    ["Skill", { skill: "reel-script" }],
    ["Task", { prompt: "..." }],
    ["Glob", { pattern: "**/*.md" }],
    ["Inconnu", {}],
  ];
  for (const [o, e] of cas) {
    const p = phraseActivite(o, e);
    assert.ok(p && !p.includes("/") && !/bash|read|write|skill|task|glob|git|ffmpeg/i.test(p), `${o} -> ${p}`);
  }
  assert.equal(phraseActivite("TodoWrite", {}), null);
});

test("réglages : dontAsk, écritures bornées au dossier, refus des secrets, agent monteur", () => {
  const m = monde();
  mondes.push(m);
  const g = reglagesChat("general", m.config);
  assert.equal(g.cwd, m.depot);
  assert.ok(g.args.includes("dontAsk"));
  assert.ok(!g.args.includes("--agent"), "le chat général garde l'agent du dépôt");
  assert.ok(!g.args.includes("--add-dir"), "pas de dossier en plus pour le chat général");
  const autorises = g.args[g.args.indexOf("--allowedTools") + 1];
  assert.match(autorises, /Edit\(\.\/\*\*\)/);
  assert.ok(!/(^| )Edit( |$)/.test(autorises), "jamais Edit sans borne");
  const refus = JSON.parse(g.args[g.args.indexOf("--settings") + 1]).permissions.deny;
  for (const r of ["Edit(~/.ssh/**)", "Edit(~/.montage-yoan/*.env)", "Edit(~/.config/monteur-romain/**)", "Bash(git push --force*)", "Bash(rm -rf /*)", "Bash(*ZERNIO_ECRITURE_ROMAIN*)"]) {
    assert.ok(refus.includes(r), r);
  }
  const mo = reglagesChat("faim-a-16h:monteur", m.config);
  assert.equal(mo.cwd, path.join(m.media, "faim-a-16h"));
  assert.equal(mo.args[mo.args.indexOf("--agent") + 1], "monteur");
  assert.equal(mo.env.STUDIO, "1");
  assert.equal(mo.env.MONTEUR_SK, m.config.skills);
  assert.ok(mo.args.includes("--add-dir"));
  // a-rendre.py (mise en page) tourne dans la copie des scripts du Mac, jamais dans DEPOT.
  assert.equal(g.env.RENDUS_DEPOT, m.config.depotMac);
  assert.notEqual(m.config.depotMac, m.depot);
  assert.equal(mo.env.RENDUS_DEPOT, undefined);
  // le dossier des slides suit la config (bac à sable : jamais ~/Pictures)
  assert.equal(g.env.RENDUS_CARROUSELS, m.config.carrousels);
  assert.ok(m.config.carrousels.startsWith(m.racine), m.config.carrousels);
  const mp = reglagesChat("faim-a-16h:hoc", m.config, { besoin: { miseEnPage: true, slug: "faim-a-16h" } });
  assert.ok(mp.args.includes(m.config.carrousels), "dossier des slides ouvert à la mise en page");
  assert.equal(typeDeChat("../x:hoc"), null);
  assert.equal(typeDeChat("tournage:l-20261115-174500-1").genre, "tournage");
});

test("lot 13 : chaque session du studio reçoit la consigne du chat court et STUDIO=1", () => {
  const m = monde();
  mondes.push(m);
  for (const id of ["general", "faim-a-16h:hoc", "faim-a-16h:monteur", "tournage:2026-11-16-1911"]) {
    const r = reglagesChat(id, m.config);
    const i = r.args.indexOf("--append-system-prompt");
    assert.ok(i >= 0, `${id} : consigne absente`);
    assert.equal(r.args[i + 1], CONSIGNE_STUDIO);
    assert.equal(r.env.STUDIO, "1", id);
  }
  assert.match(CONSIGNE_STUDIO, /ne recopie jamais/);
  assert.match(CONSIGNE_STUDIO, /Idées proposées/);
  assert.ok(!CONSIGNE_STUDIO.includes("\u2014"), "pas de tiret long");
  // Test de bout en bout du 18/11 : « Le sed a échoué, je corrige le statut. » dans le chat d'un contenu.
  assert.match(CONSIGNE_STUDIO, /ne nomme jamais un outil/);
});

test("pont : un échange de bout en bout, puis reprise par --resume", async () => {
  const m = monde();
  mondes.push(m);
  const pont = pontDe(m);
  const vus = [];
  pont.on("chat", (e) => vus.push(e));
  let fin = finDeTour(pont, "general");
  pont.envoyer("general", { texte: "dis bonjour" });
  assert.equal(pont.etat("general"), "en_cours");
  assert.equal((await fin).etat, "a_toi", "un chat libre finit toujours sur « à toi »");
  const h = pont.historique("general");
  assert.deepEqual(h.map((x) => [x.role, x.type]), [
    ["romain", "texte"], ["studio", "etat"], ["studio", "activite"], ["studio", "texte"], ["studio", "etat"],
  ]);
  assert.deepEqual(h.map((x) => x.n), [1, 2, 3, 4, 5]);
  assert.equal(h[1].etat, "en_cours");
  assert.equal(h[4].etat, "a_toi");
  assert.ok(vus.some((e) => e.partiel && e.message.type === "texte"), "du texte partiel a été diffusé");
  const session = pont.sessions().general.session_id;
  assert.ok(session);

  fin = finDeTour(pont, "general");
  pont.envoyer("general", { texte: "encore" });
  await fin;
  const l = m.lancements().filter((x) => x.evenement === "lancement");
  assert.equal(l.length, 2);
  assert.ok(!l[0].argv.includes("--resume"));
  assert.equal(l[1].argv[l[1].argv.indexOf("--resume") + 1], session);
  assert.equal(l[0].env.ANTHROPIC_API_KEY, null, "aucune clé d'API transmise");
  assert.equal(l[0].env.ZERNIO_ECRITURE_ROMAIN, null, "jamais le verrou de publication");
  assert.equal(l[0].cwd, m.depot);
  for (const x of l) {
    for (const opt of ["-p", "--input-format", "stream-json", "--output-format", "--verbose", "--include-partial-messages"]) {
      assert.ok(x.argv.includes(opt), opt);
    }
  }
});

test("pont : un message envoyé pendant un tour part dans le même processus", async () => {
  const m = monde();
  mondes.push(m);
  const pont = pontDe(m, { FAUX_CLAUDE_DELAI: "15" });
  const tours = [];
  pont.on("fin", (e) => tours.push(e));
  pont.envoyer("general", { texte: "un" });
  pont.envoyer("general", { texte: "deux" });
  await attendreQue(() => tours.length === 1 && !pont.actif("general"));
  const l = m.lancements();
  assert.equal(l.filter((x) => x.evenement === "lancement").length, 1);
  assert.deepEqual(l.filter((x) => x.evenement === "message").map((x) => x.texte), ["un", "deux"]);
});

test("pont : arrêter tue le groupe de processus (sous-processus compris)", async () => {
  const m = monde();
  mondes.push(m);
  const pont = pontDe(m, { FAUX_CLAUDE_SCENARIO: "lent" });
  const fin = finDeTour(pont, "general");
  pont.envoyer("general", { texte: "long travail" });
  const sous = await attendreQue(() => m.lancements().find((x) => x.evenement === "sous_processus"));
  const pid = m.lancements().find((x) => x.evenement === "lancement").pid;
  assert.ok(vivant(sous.pid_enfant));
  pont.arreter("general");
  assert.equal((await fin).etat, "arrete");
  await attendreQue(() => !vivant(pid) && !vivant(sous.pid_enfant));
  assert.equal(pont.historique("general").at(-1).etat, "arrete");
});

test("pont : toutArreter (SIGTERM du serveur) attend la fin de chaque processus", async () => {
  const m = monde();
  mondes.push(m);
  const pont = pontDe(m, { FAUX_CLAUDE_SCENARIO: "lent" });
  pont.envoyer("general", { texte: "a" });
  await attendreQue(() => m.lancements().some((x) => x.evenement === "sous_processus"));
  const sous = m.lancements().find((x) => x.evenement === "sous_processus").pid_enfant;
  await pont.toutArreter();
  assert.deepEqual(pont.actives(), []);
  await attendreQue(() => !vivant(sous));
});

test("pont : résultat en erreur et processus coupé donnent « erreur » avec une phrase claire", async () => {
  for (const scenario of ["erreur", "coupe"]) {
    const m = monde();
    mondes.push(m);
    const pont = pontDe(m, { FAUX_CLAUDE_SCENARIO: scenario });
    const fin = finDeTour(pont, "general");
    pont.envoyer("general", { texte: "x" });
    const e = await fin;
    assert.equal(e.etat, "erreur", scenario);
    const dernier = pont.historique("general").at(-1);
    assert.equal(dernier.etat, "erreur");
    assert.ok(dernier.texte && !dernier.texte.includes("/"), dernier.texte);
  }
});

test("pont : binaire introuvable, erreur claire sans planter", async () => {
  const m = monde({ config: { claude: { binaire: "/chemin/qui/n/existe/pas/claude", modele: null } } });
  mondes.push(m);
  const pont = pontDe(m);
  const fin = finDeTour(pont, "general");
  pont.envoyer("general", { texte: "x" });
  assert.equal((await fin).etat, "erreur");
  assert.match(pont.historique("general").at(-1).texte, /démarrer/);
});

test("environnement des sessions : le jeton de connexion de claude passe, les clés d'API et Zernio non (lot 11)", () => {
  const e = environnement({ HOME: "/h", CLAUDE_CODE_OAUTH_TOKEN: "sk-ant-oat01-essai", ANTHROPIC_API_KEY: "x", ANTHROPIC_AUTH_TOKEN: "y",
    ZERNIO_API_KEY: "z", ZERNIO_ECRITURE_ROMAIN: "oui", CLAUDECODE: "1" }, { STUDIO: "1" });
  assert.equal(e.CLAUDE_CODE_OAUTH_TOKEN, "sk-ant-oat01-essai");
  assert.equal(e.STUDIO, "1");
  for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ZERNIO_API_KEY", "ZERNIO_ECRITURE_ROMAIN", "CLAUDECODE"]) assert.equal(e[k], undefined, k);
});

test("claude pas connecté : rien en anglais dans le chat, une phrase claire pour Romain (lot 11)", () => {
  let n = 0;
  const no = new Normaliseur(() => ++n);
  const a = no.traiter({ type: "assistant", message: { id: "x", model: "<synthetic>", content: [{ type: "text", text: "Not logged in · Please run /login" }] } });
  assert.deepEqual(a.filter((e) => e.genre === "texte"), []);
  const f = no.traiter({ type: "result", subtype: "success", is_error: true, result: "Not logged in · Please run /login" });
  assert.equal(f.find((e) => e.genre === "fin").erreur, PHRASE_CONNEXION);
  const no2 = new Normaliseur(() => ++n);
  const f2 = no2.traiter({ type: "result", subtype: "success", is_error: true, result: "Something else" });
  assert.match(f2.find((e) => e.genre === "fin").erreur, /Quelque chose a coincé/);
});
