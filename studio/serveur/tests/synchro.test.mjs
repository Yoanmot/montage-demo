import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Synchro } from "../synchro.mjs";
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

test("synchro : conflit = rebase abandonné, rejoué une fois, état « conflit », rien de forcé", async () => {
  const { m, autre, distant } = avecDistant();
  fs.writeFileSync(path.join(autre, "README.md"), "version du téléphone\n");
  git(autre, "commit", "-q", "-am", "téléphone");
  git(autre, "push", "-q");
  fs.writeFileSync(path.join(m.depot, "README.md"), "version du Mac\n");
  git(m.depot, "commit", "-q", "-am", "Mac");
  const s = new Synchro({ depot: m.depot, pauseRejeuMs: 10 });
  const r = await s.tirer();
  assert.equal(r.etat, "conflit");
  assert.ok(r.message && !r.message.includes("git"));
  assert.ok(!fs.existsSync(path.join(m.depot, ".git", "rebase-merge")), "aucun rebase laissé en plan");
  assert.equal(fs.readFileSync(path.join(m.depot, "README.md"), "utf8"), "version du Mac\n");
  assert.equal(git(m.depot, "log", "-1", "--format=%s").trim(), "Mac", "le travail local est intact");
  assert.equal(git(distant, "log", "-1", "--format=%s", "main").trim(), "téléphone", "rien de forcé en ligne");
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
