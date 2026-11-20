// Tests du lot 12 C : garde (retour arrière automatique), dépendances, rattrapage des installations existantes.
//   cd installation && node --test tests/*.test.mjs
// Tout se passe dans des dossiers temporaires avec un HOME de test : un dépôt git local joue le dépôt en ligne, un faux
// service (au lieu de launchd) lance un petit serveur node sur un port libre. Aucun réseau, rien dans launchd.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEPOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CREES = [];
const SERVEURS = [];
function tmp() {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "garde-")));
  CREES.push(d);
  return d;
}
function nettoyer() {
  for (const f of SERVEURS) {
    try { process.kill(Number(fs.readFileSync(f, "utf8")), "SIGKILL"); } catch {}
  }
  for (const d of CREES) fs.rmSync(d, { recursive: true, force: true });
}
after(nettoyer);
process.on("exit", nettoyer);

const g = (cwd, a) => execFileSync("git", a, { cwd, stdio: "pipe", encoding: "utf8" }).trim();
const gc = (cwd, a) => g(cwd, ["-c", "user.name=t", "-c", "user.email=t@t", ...a]);

async function portLibre() {
  return new Promise((ok) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => ok(p)); });
  });
}

const SERVEUR_BON = (n) => `// version ${n}\nimport http from "node:http";\nhttp.createServer((q, r) => { r.writeHead(200); r.end("ok ${n}"); }).listen(Number(process.env.FAUX_PORT), "127.0.0.1");\n`;
const SERVEUR_CASSE = `import { rien } from "./module-qui-n-existe-pas.mjs";\nconsole.log(rien);\n`;

// Un client isolé, son dépôt « en ligne » (branche essai), sa copie installée, son studio et le faux service.
async function monde({ dependances = "pip json json\n", py = null } = {}) {
  const t = tmp();
  const maison = path.join(t, "maison");
  const racine = path.join(t, "racine");
  const src = path.join(t, "src");
  fs.mkdirSync(maison);
  for (const f of ["installation/mettre-a-jour.sh", "installation/garde.sh", "installation/studio.sh", "installation/dependances.sh",
    "studio/lancement/client.sh", "studio/lancement/commun.sh", "studio/lancement/appli.sh"]) {
    fs.mkdirSync(path.dirname(path.join(src, f)), { recursive: true });
    fs.copyFileSync(path.join(DEPOT, f), path.join(src, f));
  }
  fs.writeFileSync(path.join(src, "installation/dependances.txt"), dependances);
  const port = await portLibre();
  fs.mkdirSync(path.join(src, "studio/clients"), { recursive: true });
  fs.writeFileSync(path.join(src, "studio/clients/essai.json"), JSON.stringify({
    id: "essai", prenom: "Camille", contact: "", racine, label_launchd: "com.essai-garde.studio", port,
    appli: { nom: "Studio Camille" }, head_of_content: { depot: "", cle_ssh: `${racine}/cle` },
    branche_mise_a_jour: "essai", config_claude: `${racine}/claude`,
  }));
  fs.mkdirSync(path.join(src, "studio/serveur"), { recursive: true });
  fs.writeFileSync(path.join(src, "studio/serveur/studio.mjs"), SERVEUR_BON("A"));
  g(t, ["init", "-q", "-b", "essai", src]);
  g(src, ["add", "."]); gc(src, ["commit", "-q", "-m", "A"]);
  const clone = path.join(racine, "montage-demo");
  fs.mkdirSync(racine);
  g(t, ["clone", "-q", "--branch", "essai", src, clone]);
  fs.writeFileSync(path.join(racine, "client.json"), JSON.stringify({ id: "essai" }));
  fs.mkdirSync(path.join(racine, "studio"));
  fs.writeFileSync(path.join(racine, "studio/studio.config.json"), JSON.stringify({ port, carrousels: "~/Pictures/Carrousels", media: `${racine}/Contenu` }));
  fs.mkdirSync(path.join(racine, "claude"));
  fs.writeFileSync(path.join(racine, "claude/settings.json"), JSON.stringify({ hooks: { SessionStart: [] } }));

  // Le faux service : démarre node sur le studio.mjs de la copie, comme launchd le ferait par demarrer.sh.
  const etat = path.join(t, "service");
  fs.mkdirSync(etat);
  const pidf = path.join(etat, "pid");
  SERVEURS.push(pidf);
  const faux = path.join(t, "faux-service.sh");
  fs.writeFileSync(faux, `#!/bin/bash
P="${pidf}"
vivant() { [ -f "$P" ] && kill -0 "$(cat "$P")" 2>/dev/null; }
lancer() { FAUX_PORT=${port} nohup "${process.execPath}" "${clone}/studio/serveur/studio.mjs" >>"${etat}/serveur.log" 2>&1 & echo $! > "$P"; }
case "$1" in
  charge) exit 0;;
  pid) vivant && cat "$P"; exit 0;;
  redemarrer) if vivant; then kill "$(cat "$P")"; while vivant; do sleep 0.1; done; fi; lancer;;
  demarrer) vivant || lancer;;
esac
`, { mode: 0o755 });
  const env = {
    HOME: maison, USER: process.env.USER, PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin:/usr/sbin:/sbin`, LANG: "fr_FR.UTF-8",
    STUDIO_SANS_SERVICE: "1", STUDIO_SANS_DOCK: "1", STUDIO_SANS_CLAUDE: "1", STUDIO_SANS_TELECHARGEMENT: "1",
    STUDIO_SERVICES_DOSSIER: path.join(t, "services"), STUDIO_APPLIS_DOSSIER: path.join(t, "applis"),
    GARDE_FAUX_SERVICE: faux, GARDE_ATTENTE: "6",
    ...(py ? { STUDIO_PY: py } : { STUDIO_SANS_DEPENDANCES: "1" }),
  };
  const bash = (script, args = [], ajout = {}) => {
    const r = spawnSync("/bin/bash", [script, ...args], { env: { ...env, ...ajout }, encoding: "utf8", timeout: 180000 });
    return { code: r.status, sortie: (r.stdout || "") + (r.stderr || "") };
  };
  const m = {
    t, maison, racine, src, clone, port, env, bash,
    tete: () => g(clone, ["rev-parse", "HEAD"]),
    journal: () => fs.readFileSync(path.join(racine, "mise-a-jour.log"), "utf8"),
    lire: (f) => { try { return fs.readFileSync(path.join(racine, f), "utf8").trim(); } catch { return ""; } },
    garde: (...a) => bash(path.join(racine, "garde/garde.sh"), a),
    rattraper: () => bash(path.join(clone, "installation/studio.sh"), ["rattraper"]),
    publier: (fichiers, msg) => {
      for (const [f, c] of Object.entries(fichiers)) { fs.mkdirSync(path.dirname(path.join(src, f)), { recursive: true }); fs.writeFileSync(path.join(src, f), c); }
      g(src, ["add", "."]); gc(src, ["commit", "-q", "-m", msg]);
      return g(src, ["rev-parse", "HEAD"]);
    },
    repond: async () => { try { return (await fetch(`http://127.0.0.1:${port}/`)).status; } catch { return 0; } },
  };
  return m;
}

test("garde : version qui casse le serveur => retour automatique, jamais reprise, la suivante l'est", async () => {
  const m = await monde();
  const A = m.tete();
  // Le garde se pose par le rattrapage de la mise à jour (installation existante).
  const r0 = m.rattraper();
  assert.match(r0.sortie, /RATTRAPAGE INSTALLE studio-garde posé/, r0.sortie);
  assert.ok(fs.existsSync(path.join(m.racine, "garde/garde.sh")));
  assert.match(fs.readFileSync(path.join(m.t, "services/com.essai-garde.studio.garde.plist"), "utf8"), /<key>StartInterval<\/key>\s*<integer>300<\/integer>/);
  // Premier passage : le serveur démarre et répond, la version en place devient la bonne.
  m.garde("--maintenant");
  assert.equal(await m.repond(), 200);
  assert.equal(m.lire("maj/bonne"), A);

  // Une version dont le serveur plante au démarrage.
  const B = m.publier({ "studio/serveur/studio.mjs": SERVEUR_CASSE }, "B cassée");
  const r1 = m.garde("--maintenant");
  assert.equal(m.tete(), A, r1.sortie + m.journal());
  assert.equal(await m.repond(), 200);
  assert.match(m.lire("maj/cassees"), new RegExp(`^${B} `));
  assert.match(m.journal(), new RegExp(`GARDE RETOUR ${B.slice(0, 7)} -> ${A.slice(0, 7)} : le serveur ne répond plus`));
  assert.match(m.journal(), /GARDE RETOUR_OK/);
  assert.equal(m.lire("maj/precedente"), A);
  const retour = JSON.parse(m.lire("maj/dernier-retour.json"));
  assert.equal(retour.de, B); assert.equal(retour.vers, A);

  // Passage suivant : la version cassée n'est pas reprise (pas de boucle).
  m.garde("--maintenant");
  assert.equal(m.tete(), A);
  assert.match(m.journal(), new RegExp(`VERSION_ECARTEE ${B.slice(0, 7)}`));
  assert.equal((m.journal().match(/GARDE RETOUR /g) || []).length, 1);

  // Une version plus récente (le correctif) est prise, le serveur redémarre dessus et elle devient la bonne.
  const C = m.publier({ "studio/serveur/studio.mjs": SERVEUR_BON("C") }, "C corrige");
  m.garde("--maintenant");
  assert.equal(m.tete(), C, m.journal());
  assert.equal(m.lire("maj/bonne"), C);
  assert.equal(await (await fetch(`http://127.0.0.1:${m.port}/`)).text(), "ok C");
});

test("garde : serveur qui ne répond plus sur une version validée => relance simple, pas de retour ni de boucle", async () => {
  const m = await monde();
  m.rattraper();
  m.garde("--maintenant");
  const A = m.tete();
  assert.equal(m.lire("maj/bonne"), A);
  process.kill(Number(fs.readFileSync(path.join(m.t, "service/pid"), "utf8")), "SIGKILL");
  m.garde();
  assert.equal(m.tete(), A);
  assert.equal(await m.repond(), 200);
  assert.match(m.journal(), /SERVEUR_MUET/);
  assert.doesNotMatch(m.journal(), /GARDE RETOUR /);
});

test("garde : mise à jour elle-même cassée (erreur de syntaxe) => retour, et la version n'est jamais validée", async () => {
  const m = await monde();
  m.rattraper();
  m.garde("--maintenant");
  const A = m.tete();
  const B = m.publier({ "installation/mettre-a-jour.sh": "#!/bin/bash\nmain() {\n  if then\n}\n" }, "B mise à jour cassée");
  m.garde("--maintenant");
  assert.equal(m.tete(), A, m.journal());
  assert.match(m.lire("maj/cassees"), new RegExp(`^${B} `));
  assert.match(m.journal(), /la mise à jour ne marche pas/);
  assert.equal(m.lire("maj/bonne"), A);
});

test("garde : redémarrage attendu tant qu'une session tourne, fait au repos", async () => {
  const m = await monde();
  m.rattraper();
  m.garde("--maintenant");
  const C = m.publier({ "studio/serveur/studio.mjs": SERVEUR_BON("C") }, "C");
  // Faux service qui annonce un serveur occupé (pid d'un shell qui a un enfant).
  const parent = spawnSync("/bin/bash", ["-c", "(sleep 20 & sleep 20; ) >/dev/null 2>&1 & echo $!"], { encoding: "utf8" }).stdout.trim();
  const occupeSvc = path.join(m.t, "occupe.sh");
  fs.writeFileSync(occupeSvc, `#!/bin/bash\n[ "$1" = pid ] && { echo ${parent}; exit 0; }\nexec "${m.env.GARDE_FAUX_SERVICE}" "$@"\n`, { mode: 0o755 });
  const r = m.bash(path.join(m.racine, "garde/garde.sh"), ["--maintenant"], { GARDE_FAUX_SERVICE: occupeSvc });
  assert.equal(m.tete(), C, r.sortie);
  assert.ok(fs.existsSync(path.join(m.racine, "studio/redemarrage-demande")), "redémarrage fait alors qu'une session tournait");
  assert.match(m.journal(), /GARDE ATTEND le studio travaille/);
  try { process.kill(Number(parent), "SIGKILL"); } catch {}
  // Au repos : redémarré sur C, validé.
  m.garde();
  assert.ok(!fs.existsSync(path.join(m.racine, "studio/redemarrage-demande")));
  assert.equal(await (await fetch(`http://127.0.0.1:${m.port}/`)).text(), "ok C");
  assert.equal(m.lire("maj/bonne"), C);
});

test("dépendances : une dépendance nouvelle qui ne s'installe pas => retour ; une liste inchangée n'est pas refaite", async () => {
  const t = tmp();
  const py = path.join(t, "python3");
  // Faux python : le module « inexistant » ne s'importe pas et pip ne sait pas l'installer ; le reste passe au vrai.
  fs.writeFileSync(py, `#!/bin/bash\ncase "$*" in *inexistant*) exit 1;; esac\nexec /usr/bin/python3 "$@"\n`, { mode: 0o755 });
  const m = await monde({ py });
  m.rattraper();
  m.garde("--maintenant");
  const A = m.tete();
  assert.equal(m.lire("maj/bonne"), A);
  assert.ok(m.lire("maj/dependances-ok"), m.journal());
  const avant = (m.journal().match(/DEP_FIN/g) || []).length;
  m.garde("--maintenant");
  assert.equal((m.journal().match(/DEP_FIN/g) || []).length, avant, "dépendances refaites alors que la liste n'a pas changé");

  const B = m.publier({ "installation/dependances.txt": "pip json json\npip module_inexistant paquet_inexistant\n" }, "B nouvelle dépendance");
  m.garde("--maintenant");
  assert.equal(m.tete(), A, m.journal());
  assert.match(m.journal(), /DEP_MANQUE_NOUVELLE pip module_inexistant paquet_inexistant/);
  assert.match(m.lire("maj/cassees"), new RegExp(`^${B} .*dépendance nouvelle`));
  assert.equal(await m.repond(), 200);
});

test("dependances.sh : copie fixée de claude, essayée avant d'être reliée ; un drapeau disparu la refuse", () => {
  const t = tmp();
  const maison = path.join(t, "maison");
  const racine = path.join(t, "racine");
  const copie = path.join(t, "copie");
  for (const f of ["installation/dependances.sh", "studio/lancement/client.sh"]) {
    fs.mkdirSync(path.dirname(path.join(copie, f)), { recursive: true });
    fs.copyFileSync(path.join(DEPOT, f), path.join(copie, f));
  }
  fs.mkdirSync(path.join(copie, "studio/clients"), { recursive: true });
  fs.writeFileSync(path.join(copie, "studio/clients/essai.json"), JSON.stringify({ id: "essai", racine, config_claude: `${racine}/claude` }));
  const versions = path.join(maison, ".local/share/claude/versions");
  fs.mkdirSync(versions, { recursive: true });
  const drapeaux = "--print --input-format --output-format --verbose --include-partial-messages --permission-mode dontAsk --allowedTools --settings --append-system-prompt --agent --add-dir --model --resume --tools --no-session-persistence --strict-mcp-config --disable-slash-commands --setting-sources";
  const faux = (v, aide) => fs.writeFileSync(path.join(versions, v), `#!/bin/bash\ncase "$1" in --version) echo "${v} (Claude Code)";; --help) echo "${aide}";; esac\n`, { mode: 0o755 });
  faux("9.9.9", drapeaux);
  faux("9.9.10", drapeaux.replace("--agent ", ""));
  const env = { HOME: maison, PATH: "/usr/bin:/bin:/usr/sbin:/sbin", STUDIO_CLIENT: "essai", STUDIO_SANS_CLAUDE: "1", STUDIO_SANS_TELECHARGEMENT: "1" };
  const lancer = (liste, args = []) => {
    fs.writeFileSync(path.join(copie, "installation/dependances.txt"), liste);
    const r = spawnSync("/bin/bash", [path.join(copie, "installation/dependances.sh"), ...args], { env, encoding: "utf8" });
    return { code: r.status, sortie: r.stdout + r.stderr };
  };
  let r = lancer("claude 9.9.9\n");
  assert.equal(r.code, 0, r.sortie);
  assert.equal(fs.readlinkSync(path.join(racine, "bin/claude")), path.join(racine, "outils/claude/9.9.9/claude"));
  r = lancer("claude 9.9.9\n");
  assert.match(r.sortie, /DEP_OK claude 9\.9\.9/); // idempotent
  // Montée vers une version qui a perdu --agent : refusée, l'ancienne reste reliée ; nouvelle par rapport à la liste d'avant.
  const ancien = path.join(t, "ancien.txt");
  fs.writeFileSync(ancien, "claude 9.9.9\n");
  r = lancer("claude 9.9.10\n", ["--ancien", ancien]);
  assert.equal(r.code, 3, r.sortie);
  assert.match(r.sortie, /DEP_MANQUE_NOUVELLE claude 9\.9\.10 : le drapeau --agent/);
  assert.equal(fs.readlinkSync(path.join(racine, "bin/claude")), path.join(racine, "outils/claude/9.9.9/claude"));
  // Première pose impossible (rien de relié avant, pas de téléchargement) : jamais bloquante.
  fs.rmSync(path.join(racine, "bin/claude"));
  r = lancer("claude 1.2.3\n", ["--ancien", ancien]);
  assert.equal(r.code, 4, r.sortie);
  assert.match(r.sortie, /^DEP_MANQUE claude 1\.2\.3/m);
});

test("rattrapage : conservation des conversations, claude figé (client isolé), carrousels sous la racine, date du jeton ; idempotent", async () => {
  const m = await monde();
  fs.writeFileSync(path.join(m.racine, "claude.env"), "CLAUDE_CODE_OAUTH_TOKEN=sk-ant-faux\n");
  const t0 = new Date("2026-11-17T18:06:00");
  fs.utimesSync(path.join(m.racine, "claude.env"), t0, t0);
  const r1 = m.rattraper();
  assert.match(r1.sortie, /RATTRAPAGE claude : conversations gardées 10 ans, claude sans mise à jour automatique/);
  assert.match(r1.sortie, new RegExp(`RATTRAPAGE carrousels : ${m.racine}/Carrousels`));
  assert.match(r1.sortie, /RATTRAPAGE connexion-claude/);
  const s = JSON.parse(fs.readFileSync(path.join(m.racine, "claude/settings.json"), "utf8"));
  assert.equal(s.cleanupPeriodDays, 3650);
  assert.equal(s.env.DISABLE_AUTOUPDATER, "1");
  assert.deepEqual(s.hooks, { SessionStart: [] });
  const conf = JSON.parse(fs.readFileSync(path.join(m.racine, "studio/studio.config.json"), "utf8"));
  assert.equal(conf.carrousels, `${m.racine}/Carrousels`);
  assert.ok(fs.existsSync(path.join(m.racine, "Carrousels")));
  const cx = JSON.parse(fs.readFileSync(path.join(m.racine, "connexion-claude.json"), "utf8"));
  assert.equal(new Date(cx.pose_le).getTime(), t0.getTime());
  assert.equal(new Date(cx.expire_le).getTime() - t0.getTime(), 365 * 86400000);
  assert.equal(cx.source, "date-du-fichier");
  assert.doesNotMatch(fs.readFileSync(path.join(m.racine, "connexion-claude.json"), "utf8"), /sk-ant/);
  // Deuxième passage : rien à faire, rien d'écrit.
  const avant = fs.readFileSync(path.join(m.racine, "claude/settings.json"), "utf8");
  const r2 = m.rattraper();
  assert.equal(r2.sortie.trim(), "", r2.sortie);
  assert.equal(fs.readFileSync(path.join(m.racine, "claude/settings.json"), "utf8"), avant);
  // Le jeton reposé ensuite (fichier plus récent) : la date suit.
  const t1 = new Date("2027-02-01T10:00:00");
  fs.utimesSync(path.join(m.racine, "claude.env"), t1, t1);
  m.rattraper();
  assert.equal(new Date(JSON.parse(m.lire("connexion-claude.json")).pose_le).getTime(), t1.getTime());
  // Rien chez l'utilisateur du Mac.
  assert.ok(!fs.existsSync(path.join(m.maison, "Pictures")));
  assert.ok(!fs.existsSync(path.join(m.maison, ".claude")));
});

test("rattrapage : Romain (non isolé) garde ses carrousels et son claude à mises à jour automatiques", () => {
  const t = tmp();
  const maison = path.join(t, "maison");
  fs.mkdirSync(path.join(maison, ".claude"), { recursive: true });
  fs.writeFileSync(path.join(maison, ".claude/settings.json"), JSON.stringify({ cleanupPeriodDays: 7, model: "x" }));
  fs.mkdirSync(path.join(maison, ".montage-yoan/studio"), { recursive: true });
  fs.writeFileSync(path.join(maison, ".montage-yoan/studio/studio.config.json"), JSON.stringify({ carrousels: "~/Pictures/Carrousels" }));
  const r = spawnSync("/bin/bash", [path.join(DEPOT, "installation/studio.sh"), "rattraper"], {
    env: { HOME: maison, PATH: "/usr/bin:/bin:/usr/sbin:/sbin", STUDIO_SANS_SERVICE: "1", STUDIO_SERVICES_DOSSIER: path.join(t, "services") },
    encoding: "utf8",
  });
  assert.match(r.stdout, /RATTRAPAGE claude : conversations gardées 10 ans$/m, r.stdout + r.stderr);
  const s = JSON.parse(fs.readFileSync(path.join(maison, ".claude/settings.json"), "utf8"));
  assert.equal(s.cleanupPeriodDays, 3650);
  assert.equal(s.model, "x");
  assert.equal(s.env, undefined);
  assert.equal(JSON.parse(fs.readFileSync(path.join(maison, ".montage-yoan/studio/studio.config.json"), "utf8")).carrousels, "~/Pictures/Carrousels");
});

test("clients : Romain et son essai sur opus (session et sous-agents), rangement inchangé", () => {
  for (const id of ["romain", "romain-test"]) {
    const c = JSON.parse(fs.readFileSync(path.join(DEPOT, `studio/clients/${id}.json`), "utf8"));
    assert.equal(c.claude.modele, "opus", id);
    assert.equal(c.claude.modele_sous_agents, "opus", id);
    assert.equal(c.claude.modele_rangement, null, id);
  }
});
