// Tests de l'installation d'essai (client à simulation forcée, ex. romain-test sur le Mac de Yoan) :
//   cd installation && node --test tests/*.test.mjs
// Tout se passe dans des dossiers temporaires, HOME de test, aucun réseau, rien dans launchd ni le Dock.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEPOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CREES = [];
function tmp() {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "install-essai-")));
  CREES.push(d);
  return d;
}
process.on("exit", () => { for (const d of CREES) fs.rmSync(d, { recursive: true, force: true }); });

const FAUX_BIN = tmp();
fs.writeFileSync(path.join(FAUX_BIN, "claude"), "#!/bin/bash\necho '0.0.0 (faux claude)'\n", { mode: 0o755 });

function envDe(maison, ajout = {}) {
  return {
    HOME: maison, USER: process.env.USER, PATH: `${FAUX_BIN}:${path.dirname(process.execPath)}:/usr/bin:/bin:/usr/sbin:/sbin`,
    LANG: "fr_FR.UTF-8", STUDIO_SANS_SERVICE: "1", STUDIO_SANS_DOCK: "1", STUDIO_SANS_CLAUDE: "1",
    STUDIO_SANS_DEPENDANCES: "1", STUDIO_SANS_TELECHARGEMENT: "1", ...ajout,
  };
}
const g = (cwd, a) => execFileSync("git", a, { cwd, stdio: "pipe", encoding: "utf8" });
const gc = (cwd, a) => g(cwd, ["-c", "user.name=t", "-c", "user.email=t@t", ...a]);
function variables(env) {
  const r = spawnSync("/bin/bash", ["-c", '. studio/lancement/client.sh; studio_client_charger; set | grep -E "^CLIENT_"'], { cwd: DEPOT, env, encoding: "utf8" });
  const v = {};
  for (const l of r.stdout.split("\n")) {
    const m = /^([A-Z_]+)=(.*)$/.exec(l);
    if (m) v[m[1]] = m[2].replace(/^'(.*)'$/, "$1");
  }
  return v;
}
// Un client d'essai dans un dossier temporaire (racine, dépôt nu, config Claude).
function clientEssai(t, ajout = {}) {
  const racine = path.join(t, "racine");
  const fichier = path.join(t, "essai-test.json");
  fs.writeFileSync(fichier, JSON.stringify({
    id: "essai-test", prenom: "Romain", contact: "Yoan", racine, label_launchd: "com.essai.studio-test",
    appli: { nom: "Studio Romain (test)", icone: "romain" }, port: 4798, theme: "romain",
    head_of_content: { depot: `${racine}/hoc-essai.git`, cle_ssh: `${racine}/ssh/hoc-essai` },
    zernio: { compte: null, profil: null }, ressources: { site: null }, skill_carrousel: "carrousel",
    branche_mise_a_jour: "studio-multi-clients", config_claude: `${racine}/claude`, simulation_forcee: true, ...ajout,
  }));
  return { racine, fichier };
}

test("romain-test.json : Romain (thème, monteur, carrousel), à part de Yoan et du vrai Romain, sans clé Zernio", () => {
  const c = JSON.parse(fs.readFileSync(path.join(DEPOT, "studio/clients/romain-test.json"), "utf8"));
  const r = JSON.parse(fs.readFileSync(path.join(DEPOT, "studio/clients/romain.json"), "utf8"));
  const y = JSON.parse(fs.readFileSync(path.join(DEPOT, "studio/clients/yoan.json"), "utf8"));
  assert.equal(c.simulation_forcee, true);
  assert.equal(c.prenom, r.prenom);
  assert.equal(c.theme, r.theme);
  assert.equal(c.skill_carrousel, r.skill_carrousel);
  assert.equal(c.appli.icone, r.appli.icone);
  assert.equal(c.zernio.compte, null); // jamais de ZERNIO_ECRITURE pour ce client
  assert.match(c.racine, /^\/Users\/Shared\//);
  assert.ok(c.config_claude.startsWith(c.racine + "/"));
  assert.ok(c.head_of_content.depot.startsWith(c.racine + "/"), "dépôt du head of content hors de la racine");
  assert.ok(c.head_of_content.cle_ssh.startsWith(c.racine + "/"), "clé SSH hors de la racine");
  assert.doesNotMatch(JSON.stringify(c), /github|head-of-content-romain/);
  for (const k of ["racine", "label_launchd", "port", "config_claude"]) {
    assert.notEqual(c[k], r[k], k); assert.notEqual(c[k], y[k], k);
  }
  assert.notEqual(c.appli.nom, r.appli.nom); assert.notEqual(c.appli.nom, y.appli.nom);
  // Le monteur : aucun dossier de style ni modèles de mémoire à ce nom, donc ceux de Romain.
  assert.ok(!fs.existsSync(path.join(DEPOT, "skills/animations/bibliotheque/styles/romain-test")));
  assert.ok(!fs.existsSync(path.join(DEPOT, "agents/monteur-memoire/romain-test")));
  const v = variables(envDe(tmp(), { STUDIO_CLIENT: "romain-test" }));
  assert.equal(v.CLIENT_SIMULATION_FORCEE, "1");
  assert.equal(v.CLIENT_ZERNIO_COMPTE, "");
  assert.equal(v.CLIENT_ISOLE, "1");
  // La branche à livrer (l'installation réelle peut suivre une autre branche par <racine>/branche).
  assert.equal(c.branche_mise_a_jour, "studio-multi-clients");
  assert.equal(v.CLIENT_SKILL_CARROUSEL, "carrousel");
  // Romain et Yoan : jamais en simulation forcée.
  assert.equal(variables(envDe(tmp())).CLIENT_SIMULATION_FORCEE, "");
  assert.equal(variables(envDe(tmp(), { STUDIO_CLIENT: "yoan" })).CLIENT_SIMULATION_FORCEE, "");
});

test("client.sh : <racine>/branche fait suivre une autre branche, retiré on revient à celle du client", () => {
  const t = tmp();
  const { racine, fichier } = clientEssai(t);
  const env = envDe(path.join(t, "maison"), { STUDIO_CLIENT: "essai-test", STUDIO_CLIENT_FICHIER: fichier });
  assert.equal(variables(env).CLIENT_BRANCHE, "studio-multi-clients");
  fs.mkdirSync(racine, { recursive: true });
  fs.writeFileSync(path.join(racine, "branche"), "romain-test\n");
  assert.equal(variables(env).CLIENT_BRANCHE, "romain-test");
  fs.writeFileSync(path.join(racine, "branche"), "--upload-pack=x\n"); // nom refusé
  assert.equal(variables(env).CLIENT_BRANCHE, "studio-multi-clients");
  fs.rmSync(path.join(racine, "branche"));
  assert.equal(variables(env).CLIENT_BRANCHE, "studio-multi-clients");
});

test("demarrer.sh : simulation forcée et aucune clé Zernio dans l'environnement du serveur", () => {
  const t = tmp();
  const { fichier } = clientEssai(t);
  const bin = path.join(t, "bin");
  fs.mkdirSync(bin);
  // Faux node : écrit l'environnement que le serveur aurait reçu.
  fs.writeFileSync(path.join(bin, "node"), "#!/bin/bash\n[ \"$1\" = -v ] && { echo v24; exit 0; }\nenv | grep -E '^(STUDIO_SIMULATION|ZERNIO_)' | sort\n", { mode: 0o755 });
  const lancer = (ajout) => spawnSync("/bin/bash", [path.join(DEPOT, "studio/lancement/demarrer.sh")], {
    env: { ...envDe(path.join(t, "maison"), ajout), PATH: `${bin}:/usr/bin:/bin`, ZERNIO_API_KEY: "sk-fuite", ZERNIO_ECRITURE: "x", ZERNIO_ECRITURE_ROMAIN: "oui" },
    encoding: "utf8" }).stdout;
  const essai = lancer({ STUDIO_CLIENT: "essai-test", STUDIO_CLIENT_FICHIER: fichier });
  assert.match(essai, /publication=simulation-forcee/);
  assert.match(essai, /^STUDIO_SIMULATION=1$/m);
  assert.match(essai, /^ZERNIO_ENV_FILE=\/dev\/null$/m);
  assert.doesNotMatch(essai, /ZERNIO_API_KEY|ZERNIO_ECRITURE/);
  // Romain : rien de changé (aucune variable retirée ni ajoutée).
  const romain = lancer({ STUDIO_CLIENT: "romain" });
  assert.doesNotMatch(romain, /STUDIO_SIMULATION|ZERNIO_ENV_FILE|simulation-forcee/);
  assert.match(romain, /^ZERNIO_API_KEY=sk-fuite$/m);
});

test("studio.sh installer : simulation dans le service et la config, appli au nom avec espaces", () => {
  const t = tmp();
  const { racine, fichier } = clientEssai(t);
  const c = path.join(t, "copie");
  fs.cpSync(path.join(DEPOT, "studio"), path.join(c, "studio"), { recursive: true, filter: (s) => !/\/(node_modules|tests)(\/|$)/.test(s) });
  fs.cpSync(path.join(DEPOT, "installation"), path.join(c, "installation"), { recursive: true });
  fs.copyFileSync(fichier, path.join(c, "studio/clients/essai-test.json"));
  // Le dépôt nu du head of content, comme hoc-essai.sh preparer le fait.
  const src = path.join(t, "hoc-src");
  fs.mkdirSync(path.join(src, ".claude/skills/publier"), { recursive: true });
  fs.writeFileSync(path.join(src, "CLAUDE.md"), "# test\n");
  g(t, ["init", "-q", "-b", "main", src]); g(src, ["add", "."]); gc(src, ["commit", "-q", "-m", "init"]);
  const p = spawnSync("/bin/bash", [path.join(c, "installation/hoc-essai.sh"), "preparer", src], {
    env: envDe(path.join(t, "maison"), { STUDIO_CLIENT: "essai-test" }), encoding: "utf8" });
  assert.match(p.stdout, /INSTALLE depot-nu/, p.stdout + p.stderr);
  const services = path.join(t, "services"), applis = path.join(t, "applis");
  const r = spawnSync("/bin/bash", [path.join(c, "installation/studio.sh"), "installer"], {
    env: envDe(path.join(t, "maison"), { STUDIO_CLIENT: "essai-test", STUDIO_SERVICES_DOSSIER: services, STUDIO_APPLIS_DOSSIER: applis }),
    encoding: "utf8", timeout: 120000 });
  const sortie = r.stdout + r.stderr;
  assert.match(sortie, /studio-simulation publication passée en simulation/, sortie);
  assert.doesNotMatch(sortie, /^ECHEC (?!studio-serveur)/m, sortie);
  const plist = fs.readFileSync(path.join(services, "com.essai.studio-test.plist"), "utf8");
  assert.match(plist, /<key>STUDIO_SIMULATION<\/key>\s*<string>1<\/string>/);
  const conf = JSON.parse(fs.readFileSync(path.join(racine, "studio/studio.config.json"), "utf8"));
  assert.equal(conf.publication.simulation, true);
  assert.equal(conf.depot_hoc, `${racine}/studio/head-of-content`);
  const info = fs.readFileSync(path.join(applis, "Studio Romain (test).app/Contents/Info.plist"), "utf8");
  assert.match(info, /<key>CFBundleIdentifier<\/key>\s*<string>com\.essai\.studio-test\.app<\/string>/);
  assert.match(info, /<key>CFBundleName<\/key>\s*<string>Studio Romain \(test\)<\/string>/);
  // Relancée : la simulation reste, rien n'est réécrit.
  const r2 = spawnSync("/bin/bash", [path.join(c, "installation/studio.sh"), "installer"], {
    env: envDe(path.join(t, "maison"), { STUDIO_CLIENT: "essai-test", STUDIO_SERVICES_DOSSIER: services, STUDIO_APPLIS_DOSSIER: applis }),
    encoding: "utf8", timeout: 120000 });
  assert.match(r2.stdout, /OK studio-simulation/);
  // L'adresse du Dock : espaces encodés, Romain et Yoan inchangés.
  const url = (p) => spawnSync("/bin/bash", ["-c", `PY=/usr/bin/python3; eval "$(sed -n '/^studio_url_fichier()/p' "${DEPOT}/installation/studio.sh")"; studio_url_fichier "$1"`, "_", p], { encoding: "utf8" }).stdout.trim();
  assert.equal(url("/Users/x/Applications/Studio Romain (test).app"), "file:///Users/x/Applications/Studio%20Romain%20(test).app");
  assert.equal(url("/Users/x/Applications/Studio.app"), "file:///Users/x/Applications/Studio.app");
});

test("cles.sh : aucune clé Zernio posable dans une installation d'essai", () => {
  const t = tmp();
  const { racine, fichier } = clientEssai(t);
  const r = spawnSync("/bin/bash", [path.join(DEPOT, "installation/cles.sh"), "--stdin", "zernio"], {
    env: envDe(path.join(t, "maison"), { STUDIO_CLIENT: "essai-test", STUDIO_CLIENT_FICHIER: fichier }), input: "sk-NE-PAS-POSER\n", encoding: "utf8" });
  assert.match(r.stdout, /^CLE_INTERDITE zernio/m);
  assert.doesNotMatch(r.stdout + r.stderr, /sk-NE-PAS-POSER/);
  assert.ok(!fs.existsSync(path.join(racine, "zernio.env")));
});

test("stats réelles : romain-test lit le compte romain de zernio.py ; ni yoan ni romain", () => {
  assert.equal(variables(envDe(tmp(), { STUDIO_CLIENT: "romain-test" })).CLIENT_STATS_REELLES, "romain");
  assert.equal(variables(envDe(tmp())).CLIENT_STATS_REELLES, "");
  assert.equal(variables(envDe(tmp(), { STUDIO_CLIENT: "yoan" })).CLIENT_STATS_REELLES, "");
  // Le compte nommé est bien celui de Romain dans son zernio.py (copie locale du head of content, si présente).
  const z = path.resolve(DEPOT, "../../agents/head-of-content/depot/outils/zernio.py");
  if (fs.existsSync(z)) assert.match(fs.readFileSync(z, "utf8"), /"romain": \{"profil": "6ac75dec9a27558cf4810eff", "compte": "6af31ec6f19c6d2112b2cc4a"/);
});

test("cles.sh zernio-lecture : posée dans son fichier à elle (600), jamais affichée ; refusée sans stats_reelles", () => {
  const t = tmp();
  const { racine, fichier } = clientEssai(t, { stats_reelles: { compte: "romain" } });
  const env = envDe(path.join(t, "maison"), { STUDIO_CLIENT: "essai-test", STUDIO_CLIENT_FICHIER: fichier });
  const r = spawnSync("/bin/bash", [path.join(DEPOT, "installation/cles.sh"), "--stdin", "zernio-lecture"], { env, input: "sk-LECTURE-TEST\n", encoding: "utf8" });
  // Pas de copie du head of content ici : la vérification ne part pas sur le réseau.
  assert.match(r.stdout, /^CLE_NON_VERIFIEE zernio-lecture/m);
  assert.doesNotMatch(r.stdout + r.stderr, /sk-LECTURE-TEST/);
  const f = path.join(racine, "zernio-lecture.env");
  assert.equal(fs.readFileSync(f, "utf8"), "ZERNIO_API_KEY=sk-LECTURE-TEST\n");
  assert.equal(fs.statSync(f).mode & 0o777, 0o600);
  assert.ok(!fs.existsSync(path.join(racine, "zernio.env")));
  // Sans le nom, cles.sh ne la demande jamais (la liste des clés manquantes reste celle d'avant).
  assert.doesNotMatch(fs.readFileSync(path.join(DEPOT, "installation/cles.sh"), "utf8").split("if [ $# -gt 0 ]")[1], /poser zernio-lecture|DEJA zernio-lecture/);
  // Client d'essai sans stats_reelles, ou vraie installation : refusée, rien d'écrit.
  for (const ajout of [{}, { simulation_forcee: false, stats_reelles: { compte: "romain" } }]) {
    const t2 = tmp();
    const c2 = clientEssai(t2, ajout);
    const r2 = spawnSync("/bin/bash", [path.join(DEPOT, "installation/cles.sh"), "--stdin", "zernio-lecture"], {
      env: envDe(path.join(t2, "maison"), { STUDIO_CLIENT: "essai-test", STUDIO_CLIENT_FICHIER: c2.fichier }), input: "sk-NON\n", encoding: "utf8" });
    assert.match(r2.stdout, /^CLE_INTERDITE zernio-lecture/m);
    assert.ok(!fs.existsSync(path.join(c2.racine, "zernio-lecture.env")));
  }
});

test("hoc-essai.sh : dépôt nu local, envois vers GitHub impossibles, retouches tirées sans perdre le test", () => {
  const t = tmp();
  const { racine, fichier } = clientEssai(t);
  const env = envDe(path.join(t, "maison"), { STUDIO_CLIENT: "essai-test", STUDIO_CLIENT_FICHIER: fichier });
  const hoc = (a) => spawnSync("/bin/bash", [path.join(DEPOT, "installation/hoc-essai.sh"), ...a], { env, encoding: "utf8" });
  // La copie de Yoan (source) : il y peaufine les skills.
  const src = path.join(t, "source");
  fs.mkdirSync(path.join(src, ".claude/skills/reel-script"), { recursive: true });
  fs.writeFileSync(path.join(src, ".claude/skills/reel-script/SKILL.md"), "v1\n");
  fs.writeFileSync(path.join(src, "idees.md"), "# Idées\n");
  g(t, ["init", "-q", "-b", "main", src]); g(src, ["add", "."]); gc(src, ["commit", "-q", "-m", "init"]);
  const r1 = hoc(["preparer", src]);
  assert.match(r1.stdout, /INSTALLE depot-nu .*aucun lien vers GitHub/, r1.stdout + r1.stderr);
  const nu = path.join(racine, "hoc-essai.git");
  assert.equal(g(nu, ["remote"]).trim(), "");
  // Les deux copies posées par l'installation (clones du dépôt nu), puis protégées.
  const travail = path.join(racine, "studio/head-of-content"), mac = path.join(racine, "head-of-content");
  for (const d of [travail, mac]) g(t, ["clone", "-q", nu, d]);
  const r2 = hoc(["proteger"]);
  assert.match(r2.stdout, /HOC_ESSAI_FIN ok=2 echecs=0/, r2.stdout);
  // GitHub : refusé sans réseau (adresse réécrite vers un chemin impossible), autre dépôt : refusé par le crochet.
  for (const u of ["git@github.com:Yoanmot/head-of-content-romain.git", "https://github.com/Yoanmot/head-of-content-romain.git"]) {
    const p = spawnSync("git", ["-C", travail, "push", u, "HEAD:main"], { encoding: "utf8", env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
    assert.notEqual(p.status, 0, u);
    assert.match(p.stderr, /envoi-interdit-installation-essai/, p.stderr);
  }
  const autre = path.join(t, "autre.git");
  g(t, ["init", "-q", "--bare", autre]);
  const p = spawnSync("git", ["-C", travail, "push", autre, "HEAD:main"], { encoding: "utf8" });
  assert.notEqual(p.status, 0);
  assert.match(p.stderr, /ENVOI_INTERDIT/);
  // Le test écrit (idée), Yoan retouche un skill : les deux restent.
  fs.appendFileSync(path.join(travail, "idees.md"), "- idée du test\n");
  gc(travail, ["commit", "-qam", "idée du test"]); g(travail, ["push", "-q", "origin", "HEAD:main"]);
  fs.writeFileSync(path.join(src, ".claude/skills/reel-script/SKILL.md"), "v2\n");
  gc(src, ["commit", "-qam", "reel-script v2"]);
  const r3 = hoc(["tirer"]);
  assert.match(r3.stdout, /INSTALLE retouches 1 commit\(s\) de main fusionnés/, r3.stdout + r3.stderr);
  assert.match(r3.stdout, /HOC_ESSAI_FIN ok=\d+ echecs=0/, r3.stdout);
  for (const d of [travail, mac]) {
    assert.equal(fs.readFileSync(path.join(d, ".claude/skills/reel-script/SKILL.md"), "utf8"), "v2\n", d);
    assert.match(fs.readFileSync(path.join(d, "idees.md"), "utf8"), /idée du test/, d);
  }
  assert.equal(g(nu, ["rev-parse", "main"]), g(travail, ["rev-parse", "HEAD"]));
  assert.match(hoc(["tirer"]).stdout, /OK retouches rien de nouveau/);
  // Conflit : rien ne change.
  fs.writeFileSync(path.join(travail, "idees.md"), "réécrit par le test\n");
  gc(travail, ["commit", "-qam", "test"]);
  fs.writeFileSync(path.join(src, "idees.md"), "réécrit par Yoan\n");
  gc(src, ["commit", "-qam", "yoan"]);
  const avant = g(travail, ["rev-parse", "HEAD"]);
  const r4 = hoc(["tirer"]);
  assert.match(r4.stdout, /ECHEC tirer : conflit .*idees\.md.*rien changé/, r4.stdout);
  assert.equal(g(travail, ["rev-parse", "HEAD"]), avant);
  assert.equal(g(travail, ["status", "--porcelain"]).trim(), "");
});

test("hoc-essai.sh : refuse une vraie installation (sans simulation forcée)", () => {
  for (const id of ["romain", "yoan"]) {
    const r = spawnSync("/bin/bash", [path.join(DEPOT, "installation/hoc-essai.sh"), "proteger"], {
      env: envDe(tmp(), { STUDIO_CLIENT: id }), encoding: "utf8" });
    assert.notEqual(r.status, 0);
    assert.match(r.stdout, /pas une installation d'essai/);
  }
});
