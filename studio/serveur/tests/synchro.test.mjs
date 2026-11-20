import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Synchro, causeGit, fusionValeur } from "../synchro.mjs";
import { jetonDuStudio } from "../studio.mjs";
import { lireVerdict } from "../commandes.mjs";
import { monde, git, depotGit } from "./aide.mjs";

const mondes = [];
after(() => mondes.forEach((m) => m.nettoyer()));

function avecDistant() {
  const m = monde();
  mondes.push(m);
  const distant = depotGit(m);
  // Une deuxième copie joue « le téléphone » (le cloud) qui pousse de son côté.
  const autre = path.join(m.racine, "autre");
  git(m.racine, "clone", "-q", distant, autre);
  git(autre, "config", "user.email", "t@exemple.invalid");
  git(autre, "config", "user.name", "T");
  return { m, distant, autre };
}

test("synchro : récupère ce qui a été poussé ailleurs, garde les modifications locales", async () => {
  const { m, autre } = avecDistant();
  fs.writeFileSync(path.join(autre, "idees.md"), "idée du téléphone\n");
  git(autre, "add", "-A");
  git(autre, "commit", "-q", "-m", "téléphone");
  git(autre, "push", "-q");
  fs.writeFileSync(path.join(m.depot, "brouillon.txt"), "pas encore enregistré\n");
  const etats = [];
  const s = new Synchro({ depot: m.depot, pauseRejeuMs: 10 });
  s.on("sync", (e) => etats.push(e.etat));
  const r = await s.tirer();
  assert.equal(r.etat, "ok");
  assert.ok(r.derniere);
  assert.deepEqual(etats, ["en_cours", "ok"]);
  assert.equal(fs.readFileSync(path.join(m.depot, "idees.md"), "utf8"), "idée du téléphone\n");
  assert.ok(fs.existsSync(path.join(m.depot, "brouillon.txt")));
});

test("synchro : vrai conflit Mac / téléphone = raccordé tout seul, les deux versions gardées, rien de forcé", async () => {
  const { m, autre, distant } = avecDistant();
  fs.writeFileSync(path.join(autre, "README.md"), "version du téléphone\n");
  git(autre, "commit", "-q", "-am", "téléphone");
  git(autre, "push", "-q");
  fs.writeFileSync(path.join(m.depot, "README.md"), "version du Mac\n");
  git(m.depot, "commit", "-q", "-am", "Mac");
  const journal = [];
  const s = new Synchro({ depot: m.depot, pauseRejeuMs: 10, journal: (e, d) => journal.push([e, d]) });
  const r = await s.tirer();
  assert.equal(r.etat, "ok");
  assert.ok(!fs.existsSync(path.join(m.depot, ".git", "rebase-merge")), "aucun rebase laissé en plan");
  const texte = fs.readFileSync(path.join(m.depot, "README.md"), "utf8");
  assert.equal(texte, "version du téléphone\nversion du Mac\n");
  // Le raccord est parti en ligne, par-dessus le travail du téléphone (pas de force).
  assert.deepEqual(git(distant, "log", "--format=%s", "main").trim().split("\n").slice(0, 2), ["Mac", "téléphone"]);
  const raccord = journal.find(([e]) => e === "synchro_raccord")[1];
  assert.deepEqual(raccord.fichiers.map((f) => f.fichier), ["README.md"]);
  assert.equal(git(m.depot, "show", `${raccord.sauvegarde}:README.md`), "version du Mac\n", "la version du Mac reste dans la sauvegarde");
  assert.equal(git(m.depot, "status", "--porcelain").trim(), "");
});

test("synchro : conflit JSON = fusion clé par clé ; liste à id fusionnée ; supprimé contre modifié", async () => {
  const { m, autre, distant } = avecDistant();
  const ecrireDes2 = (rel, v) => {
    fs.mkdirSync(path.dirname(path.join(m.depot, rel)), { recursive: true });
    fs.writeFileSync(path.join(m.depot, rel), JSON.stringify(v, null, 2) + "\n");
  };
  ecrireDes2("contenus/x/etat.json", { titre: "X", jour_prevu: null, valide: null, refuse: null });
  ecrireDes2("veille/statuts.json", { outliers: [{ id: "A1", statut: "proposé" }] });
  fs.writeFileSync(path.join(m.depot, "note.md"), "avant\n");
  git(m.depot, "add", "-A"); git(m.depot, "commit", "-q", "-m", "base"); git(m.depot, "push", "-q");
  git(autre, "pull", "-q", "--rebase");
  const ecrireDans = (d, rel, v) => fs.writeFileSync(path.join(d, rel), typeof v === "string" ? v : JSON.stringify(v, null, 2) + "\n");
  ecrireDans(autre, "contenus/x/etat.json", { titre: "X", jour_prevu: "2026-11-20", valide: null, refuse: null });
  ecrireDans(autre, "veille/statuts.json", { outliers: [{ id: "A1", statut: "proposé" }, { id: "B2", statut: "refusé" }] });
  git(autre, "rm", "-q", "note.md");
  git(autre, "add", "-A"); git(autre, "commit", "-q", "-m", "téléphone"); git(autre, "push", "-q");
  ecrireDans(m.depot, "contenus/x/etat.json", { titre: "X", jour_prevu: null, valide: { empreinte: "sha256:1" }, refuse: null });
  ecrireDans(m.depot, "veille/statuts.json", { outliers: [{ id: "A1", statut: "retenu" }] });
  ecrireDans(m.depot, "note.md", "modifiée au Mac\n");
  git(m.depot, "add", "-A"); git(m.depot, "commit", "-q", "-m", "Mac");
  const r = await new Synchro({ depot: m.depot, pauseRejeuMs: 10 }).tirer();
  assert.equal(r.etat, "ok");
  const enLigne = (rel) => git(distant, "show", `main:${rel}`);
  assert.deepEqual(JSON.parse(enLigne("contenus/x/etat.json")), { titre: "X", jour_prevu: "2026-11-20", valide: { empreinte: "sha256:1" }, refuse: null });
  assert.deepEqual(JSON.parse(enLigne("veille/statuts.json")).outliers, [{ id: "A1", statut: "retenu" }, { id: "B2", statut: "refusé" }]);
  assert.equal(enLigne("note.md"), "modifiée au Mac\n");
});

test("synchro : modification pas encore enregistrée sur les mêmes lignes = gardée, sans marques de conflit", async () => {
  const { m, autre } = avecDistant();
  fs.writeFileSync(path.join(autre, "README.md"), "version du téléphone\n");
  git(autre, "commit", "-q", "-am", "téléphone");
  git(autre, "push", "-q");
  fs.writeFileSync(path.join(m.depot, "README.md"), "brouillon du Mac\n");
  const r = await new Synchro({ depot: m.depot, pauseRejeuMs: 10 }).tirer();
  assert.equal(r.etat, "ok");
  const texte = fs.readFileSync(path.join(m.depot, "README.md"), "utf8");
  assert.ok(texte.includes("version du téléphone") && texte.includes("brouillon du Mac") && !texte.includes("<<<<<<<"), texte);
  assert.equal(git(m.depot, "status", "--porcelain").trim(), "M README.md");
});

function fauxDistant(m, script) {
  const p = path.join(m.racine, "faux-distant.sh");
  fs.writeFileSync(p, `#!/bin/sh\n${script}`, { mode: 0o755 });
  git(m.depot, "remote", "set-url", "origin", `ext::${p}`);
}

test("synchro : clé refusée = « souci » avec la vraie cause, message de git au journal", async () => {
  const { m } = avecDistant();
  fauxDistant(m, 'echo "git@github.com: Permission denied (publickey)." >&2\nexit 128\n');
  const journal = [];
  const s = new Synchro({ depot: m.depot, pauseRejeuMs: 10, env: { ...process.env, GIT_ALLOW_PROTOCOL: "ext:file" }, journal: (e, d) => journal.push([e, d]) });
  const r = await s.tirer();
  assert.equal(r.etat, "souci");
  assert.equal(r.cause, "cle");
  assert.match(r.message, /autorisation/);
  assert.ok(!/conflit|git/i.test(r.message));
  assert.match(journal.find(([e]) => e === "synchro_impossible")[1].erreur, /publickey/);
});

test("synchro : délai dépassé (Mac en veille, réseau lent) = hors ligne, pas conflit", async () => {
  const { m } = avecDistant();
  fauxDistant(m, "sleep 30\n");
  const s = new Synchro({ depot: m.depot, pauseRejeuMs: 10, delaiGitMs: 1500, env: { ...process.env, GIT_ALLOW_PROTOCOL: "ext:file" } });
  const r = await s.tirer();
  assert.equal(r.etat, "hors_ligne");
  assert.equal(r.cause, "delai");
  assert.ok(!fs.existsSync(path.join(m.depot, ".git", "rebase-merge")));
});

test("synchro : verrou laissé par un git mort = retiré, la synchro repart seule", async () => {
  const { m, autre } = avecDistant();
  fs.writeFileSync(path.join(autre, "idees.md"), "idée du téléphone\n");
  git(autre, "add", "-A"); git(autre, "commit", "-q", "-m", "téléphone"); git(autre, "push", "-q");
  fs.writeFileSync(path.join(m.depot, "README.md"), "en cours\n"); // force l'autostash (qui écrit l'index)
  const verrou = path.join(m.depot, ".git", "index.lock");
  fs.writeFileSync(verrou, "");
  const vieux = new Date(Date.now() - 3600 * 1000);
  fs.utimesSync(verrou, vieux, vieux);
  const r = await new Synchro({ depot: m.depot, pauseRejeuMs: 10 }).tirer();
  assert.equal(r.etat, "ok");
  assert.ok(!fs.existsSync(verrou));
  assert.equal(fs.readFileSync(path.join(m.depot, "idees.md"), "utf8"), "idée du téléphone\n");
});

test("synchro : verrou récent (un autre enregistrement tourne) = on attend, rien de cassé", async () => {
  const { m } = avecDistant();
  fs.writeFileSync(path.join(m.depot, ".git", "index.lock"), "");
  const r = await new Synchro({ depot: m.depot, pauseRejeuMs: 10 }).tirer();
  assert.equal(r.etat, "hors_ligne");
  assert.equal(r.cause, "occupe");
  assert.ok(fs.existsSync(path.join(m.depot, ".git", "index.lock")), "un verrou vivant n'est jamais retiré");
});

test("causeGit : chaque message de git donne sa vraie cause", () => {
  assert.equal(causeGit("fatal: unable to access 'https://github.com/x/': Could not resolve host: github.com"), "hors_ligne");
  assert.equal(causeGit("git@github.com: Permission denied (publickey).\nfatal: Could not read from remote repository."), "cle");
  assert.equal(causeGit("", { delai: true }), "delai");
  assert.equal(causeGit("fatal: Unable to create '/x/.git/index.lock': File exists."), "occupe");
  assert.equal(causeGit("CONFLICT (content): Merge conflict in a.md"), "conflit");
  assert.equal(causeGit("quelque chose d'autre"), "autre");
});

test("fusionValeur : sans perte quand les deux côtés touchent des clés différentes", () => {
  const pertes = [];
  assert.deepEqual(fusionValeur({ a: 1, b: 1 }, { a: 2, b: 1 }, { a: 1, b: 3 }, "", pertes), { a: 2, b: 3 });
  assert.deepEqual(pertes, []);
  assert.deepEqual(fusionValeur({ a: 1 }, { a: 2 }, { a: 3 }, "f", pertes), { a: 2 });
  assert.deepEqual(pertes, ["f.a"]);
});

test("synchro : pas de dépôt = hors ligne avec une phrase claire ; pas d'amont = ok", async () => {
  const m = monde();
  mondes.push(m);
  const s = new Synchro({ depot: m.depot });
  const r = await s.tirer();
  assert.equal(r.etat, "hors_ligne");
  assert.match(r.message, /Yoan/);
  git(m.depot, "init", "-q", "-b", "main");
  assert.equal((await new Synchro({ depot: m.depot }).tirer()).etat, "ok");
});

test("synchro : distant injoignable = hors ligne", async () => {
  const { m, distant } = avecDistant();
  fs.renameSync(distant, distant + ".parti");
  const r = await new Synchro({ depot: m.depot, pauseRejeuMs: 10 }).tirer();
  assert.ok(["hors_ligne", "conflit"].includes(r.etat));
  assert.ok(!fs.existsSync(path.join(m.depot, ".git", "rebase-merge")));
});

test("pousserFichier : seul le fichier du studio est enregistré et poussé", async () => {
  const { m, distant } = avecDistant();
  fs.mkdirSync(path.join(m.depot, "bibliotheque"));
  fs.writeFileSync(path.join(m.depot, "bibliotheque", "index.json"), "{}\n");
  fs.writeFileSync(path.join(m.depot, "autre.txt"), "à ne pas pousser\n");
  const s = new Synchro({ depot: m.depot });
  assert.equal(await s.pousserFichier("bibliotheque/index.json", "Studio : bibliothèque"), true);
  const fichiers = git(distant, "show", "--name-only", "--format=", "main").trim().split("\n");
  assert.deepEqual(fichiers, ["bibliotheque/index.json"]);
});

test("jeton : gardé d'un démarrage à l'autre, recréé seulement s'il manque", () => {
  const m = monde();
  mondes.push(m);
  const a = jetonDuStudio(m.home);
  assert.equal(jetonDuStudio(m.home), a);
  fs.rmSync(path.join(m.home, "jeton"));
  const b = jetonDuStudio(m.home);
  assert.notEqual(b, a);
  assert.equal(fs.statSync(path.join(m.home, "jeton")).mode & 0o777, 0o600);
});

test("verdict des outils : dernière ligne OK ou BLOQUE", () => {
  assert.deepEqual(lireVerdict("bla\nOK slug=faim-a-16h\n").champs, { slug: "faim-a-16h" });
  const b = lireVerdict("x\nBLOQUE DEJA_GARDEE cette idée est déjà gardée\n");
  assert.equal(b.ok, false);
  assert.equal(b.code, "DEJA_GARDEE");
  assert.equal(lireVerdict("rien"), null);
});

test("synchro : pousser envoie un enregistrement resté hors ligne, après avoir tiré", async () => {
  const { m, autre, distant } = avecDistant();
  fs.writeFileSync(path.join(autre, "idees.md"), "idée du téléphone\n");
  git(autre, "add", "-A");
  git(autre, "commit", "-q", "-m", "téléphone");
  git(autre, "push", "-q");
  fs.writeFileSync(path.join(m.depot, "valide.txt"), "validé hors ligne\n");
  git(m.depot, "add", "-A");
  git(m.depot, "commit", "-q", "-m", "Studio : validé");
  const s = new Synchro({ depot: m.depot, pauseRejeuMs: 10 });
  const r = await s.pousser();
  assert.equal(r.etat, "ok");
  assert.equal(git(distant, "log", "-1", "--format=%s", "main").trim(), "Studio : validé");
  assert.equal(git(m.depot, "rev-list", "--count", "@{u}..HEAD").trim(), "0");
  assert.ok(fs.existsSync(path.join(m.depot, "idees.md")));
  // Rien à envoyer : pousser ne fait que tirer.
  assert.equal((await s.pousser()).etat, "ok");
});
