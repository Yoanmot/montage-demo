// Tests de l'installation réglée par client (lot 1C du studio de Yoan) :
//   cd installation && node --test tests/*.test.mjs
// Tout se passe dans un dossier temporaire avec un HOME de test : rien n'est chargé dans launchd, rien
// n'est ajouté au Dock (STUDIO_SANS_SERVICE=1, STUDIO_SANS_DOCK=1), aucun réseau (dépôts locaux).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEPOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const REF_ROMAIN = "b100e4f"; // studio de Romain avant le multi-clients

const CREES = [];
function tmp() {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "install-clients-")));
  CREES.push(d);
  return d;
}
process.on("exit", () => { for (const d of CREES) fs.rmSync(d, { recursive: true, force: true }); });

// Un faux claude (l'installation ne doit jamais aller chercher le vrai, ni l'installer).
const FAUX_BIN = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "install-clients-bin-")));
fs.writeFileSync(path.join(FAUX_BIN, "claude"), "#!/bin/bash\necho '0.0.0 (faux claude)'\n", { mode: 0o755 });
process.on("exit", () => fs.rmSync(FAUX_BIN, { recursive: true, force: true }));

// Environnement propre (comme le service) : seulement ce que le test donne.
function envDe(maison, ajout = {}) {
  return {
    HOME: maison, USER: process.env.USER, PATH: `${FAUX_BIN}:${path.dirname(process.execPath)}:/usr/bin:/bin:/usr/sbin:/sbin`,
    LANG: "fr_FR.UTF-8", STUDIO_SANS_SERVICE: "1", STUDIO_SANS_DOCK: "1", STUDIO_SANS_CLAUDE: "1", ...ajout,
  };
}

function bash(script, args, env, cwd) {
  const r = spawnSync("/bin/bash", [script, ...args], { env, cwd, encoding: "utf8", timeout: 120000 });
  return { code: r.status, sortie: (r.stdout || "") + (r.stderr || "") };
}

// Variables du client vues par les scripts (client.sh puis commun.sh).
function variables(env) {
  const r = spawnSync("/bin/bash", ["-c", '. studio/lancement/commun.sh; set | grep -E "^(CLIENT|STUDIO)_"'], {
    cwd: DEPOT, env, encoding: "utf8",
  });
  const v = {};
  for (const l of r.stdout.split("\n")) {
    const m = /^([A-Z_]+)=(.*)$/.exec(l);
    if (m) v[m[1]] = m[2].replace(/^'(.*)'$/, "$1");
  }
  return v;
}

// Un faux dépôt du head of content (bare local) avec un CLAUDE.md et le skill publier.
function fauxHoc(dossier) {
  const src = path.join(dossier, "hoc-src");
  fs.mkdirSync(path.join(src, ".claude", "skills", "publier"), { recursive: true });
  fs.writeFileSync(path.join(src, "CLAUDE.md"), "# Dépôt de test\n");
  fs.writeFileSync(path.join(src, ".claude", "skills", "publier", "SKILL.md"), "---\nname: publier\ndescription: test\n---\n");
  const g = (a) => execFileSync("git", a, { cwd: src, stdio: "pipe" });
  g(["init", "-q", "-b", "main"]); g(["add", "."]);
  g(["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "init"]);
  const nu = path.join(dossier, "hoc.git");
  execFileSync("git", ["clone", "-q", "--bare", src, nu], { stdio: "pipe" });
  return nu;
}

function lireArbre(d) {
  const r = [];
  const marche = (p) => {
    for (const n of fs.readdirSync(p, { withFileTypes: true })) {
      const q = path.join(p, n.name);
      if (n.isDirectory()) { if (n.name !== ".git") marche(q); }
      else if (n.isFile()) r.push(q);
    }
  };
  marche(d);
  return r;
}

test("syntaxe : chaque script se lit avec le bash 3.2 de macOS (/bin/bash)", () => {
  const scripts = [...fs.readdirSync(path.join(DEPOT, "installation")).filter((f) => f.endsWith(".sh")).map((f) => `installation/${f}`),
    ...fs.readdirSync(path.join(DEPOT, "studio/lancement")).filter((f) => f.endsWith(".sh")).map((f) => `studio/lancement/${f}`)];
  for (const f of scripts) {
    const r = spawnSync("/bin/bash", ["-n", path.join(DEPOT, f)], { encoding: "utf8" });
    assert.equal(r.status, 0, `${f} : ${r.stderr}`);
  }
});

test("client.sh : Romain garde ses valeurs historiques, avec ou sans fichier de client", () => {
  const maison = tmp();
  for (const env of [envDe(maison), envDe(maison, { STUDIO_CLIENT: "romain" })]) {
    const v = variables(env);
    assert.equal(v.CLIENT_ID, "romain");
    assert.equal(v.STUDIO_RACINE, `${maison}/.montage-yoan`);
    assert.equal(v.STUDIO_HOME, `${maison}/.montage-yoan/studio`);
    assert.equal(v.STUDIO_LABEL, "com.montage-yoan.studio");
    assert.equal(v.STUDIO_PLIST, `${maison}/Library/LaunchAgents/com.montage-yoan.studio.plist`);
    assert.equal(v.STUDIO_APP, `${maison}/Applications/Studio.app`);
    assert.equal(v.STUDIO_JETON_CLAUDE, `${maison}/.montage-yoan/claude.env`);
    assert.equal(v.CLIENT_CLAUDE, `${maison}/.claude`);
    assert.equal(v.CLIENT_CONFIG_CLAUDE, "");
    assert.equal(v.CLIENT_SONS, `${maison}/.config/monteur-romain`);
    assert.equal(v.CLIENT_CLE_SSH, `${maison}/.ssh/fitavecromain_head_of_content`);
    assert.equal(v.CLIENT_BRANCHE, "main");
    assert.equal(v.CLIENT_PORT, "4747");
    assert.equal(v.CLIENT_HOOK, '/bin/bash "$HOME/.montage-yoan/montage-demo/installation/mettre-a-jour.sh" --hook');
    assert.match(v.CLIENT_ICONE, /studio\/lancement\/icone\.icns$/);
  }
  fs.rmSync(maison, { recursive: true, force: true });
});

test("client.sh : Yoan n'a aucun chemin ni nom de Romain", () => {
  const v = variables(envDe("/Users/yoanmottier", { STUDIO_CLIENT: "yoan" }));
  assert.equal(v.CLIENT_ID, "yoan");
  assert.equal(v.STUDIO_RACINE, "/Users/Shared/studio-yoan");
  assert.equal(v.STUDIO_LABEL, "com.ia-yoan.studio");
  assert.equal(v.CLIENT_CONFIG_CLAUDE, "/Users/Shared/studio-yoan/claude");
  assert.equal(v.CLIENT_CLAUDE, "/Users/Shared/studio-yoan/claude");
  assert.equal(v.CLIENT_ISOLE, "1");
  assert.equal(v.CLIENT_SONS, "/Users/Shared/studio-yoan/monteur");
  assert.equal(v.CLIENT_PORT, "4748");
  assert.equal(v.CLIENT_BRANCHE, "studio-multi-clients");
  assert.equal(v.CLIENT_HOOK, '/bin/bash "/Users/Shared/studio-yoan/montage-demo/installation/mettre-a-jour.sh" --hook');
  for (const [k, x] of Object.entries(v)) {
    if (k === "CLIENT_FICHIER") continue; // chemin du dépôt de travail
    assert.doesNotMatch(x, /romain|montage-yoan|\/\.claude(\/|$)/i, `${k}=${x}`);
  }
});

test("client.sh : client inconnu refusé, client retrouvé par sa racine sans variable", () => {
  const r = spawnSync("/bin/bash", ["-c", ". studio/lancement/client.sh; studio_client_charger; echo \"rc=$? $CLIENT_ERREUR\""], {
    cwd: DEPOT, env: envDe(tmp(), { STUDIO_CLIENT: "inconnu" }), encoding: "utf8",
  });
  assert.match(r.stdout, /rc=1 client inconnu/);
  // Une installation : <racine>/client.json + <racine>/montage-demo/studio/lancement/client.sh.
  const racine = tmp();
  const lanc = path.join(racine, "montage-demo", "studio", "lancement");
  fs.mkdirSync(lanc, { recursive: true });
  fs.copyFileSync(path.join(DEPOT, "studio/lancement/client.sh"), path.join(lanc, "client.sh"));
  fs.writeFileSync(path.join(racine, "client.json"), JSON.stringify({ id: "essai", prenom: "Essai", racine, config_claude: `${racine}/claude` }));
  const s = spawnSync("/bin/bash", ["-c", `. "${lanc}/client.sh"; studio_client_charger; echo "$CLIENT_ID $CLIENT_RACINE $CLIENT_CLAUDE"`], {
    env: envDe(tmp()), encoding: "utf8",
  });
  assert.equal(s.stdout.trim(), `essai ${racine} ${racine}/claude`);
  fs.rmSync(racine, { recursive: true, force: true });
});

test("studio.sh installer : Romain identique à avant le multi-clients (service, appli, config)", () => {
  const t = tmp();
  const hoc = fauxHoc(t);
  // L'ancien code (b100e4f) et le nouveau, chacun dans sa copie, chacun dans son HOME de test.
  const copies = {};
  for (const [nom, ref] of [["ancien", REF_ROMAIN], ["nouveau", null]]) {
    const c = path.join(t, nom);
    for (const f of ["installation/studio.sh", "studio/lancement/commun.sh", "studio/lancement/client.sh", "studio/lancement/demarrer.sh",
      "studio/lancement/ouvrir.sh", "studio/lancement/icone.icns", "studio/studio.config.exemple.json", "studio/clients/romain.json"]) {
      fs.mkdirSync(path.dirname(path.join(c, f)), { recursive: true });
      if (ref) {
        const r = spawnSync("git", ["show", `${ref}:${f}`], { cwd: DEPOT, maxBuffer: 1 << 24 });
        if (r.status === 0) fs.writeFileSync(path.join(c, f), r.stdout);
      } else {
        fs.copyFileSync(path.join(DEPOT, f), path.join(c, f));
      }
    }
    const maison = path.join(t, `maison-${nom}`);
    fs.mkdirSync(maison);
    const r = bash(path.join(c, "installation/studio.sh"), ["installer"], envDe(maison, { HOC_DEPOT_URL: hoc }));
    assert.match(r.sortie, /STUDIO_FIN ok=\d+ a_faire=0 echecs=1/, r.sortie); // seul échec : pas de serveur dans la copie
    copies[nom] = { c, maison };
  }
  const norm = (s, { c, maison }) => s.split(c).join("<CODE>").split(maison).join("<HOME>");
  for (const f of ["Library/LaunchAgents/com.montage-yoan.studio.plist", "Applications/Studio.app/Contents/Info.plist",
    "Applications/Studio.app/Contents/MacOS/Studio", ".montage-yoan/studio/studio.config.json"]) {
    const a = norm(fs.readFileSync(path.join(copies.ancien.maison, f), "utf8"), copies.ancien);
    const b = norm(fs.readFileSync(path.join(copies.nouveau.maison, f), "utf8"), copies.nouveau);
    assert.equal(b, a, f);
  }
  const git = (m, k) => execFileSync("git", ["-C", path.join(m, ".montage-yoan/studio/head-of-content"), "config", k], { encoding: "utf8" }).trim();
  assert.equal(git(copies.nouveau.maison, "user.name"), "Mac de Romain");
  assert.equal(git(copies.nouveau.maison, "user.email"), "mac-romain@users.noreply.github.com");
  assert.match(fs.readFileSync(path.join(copies.nouveau.maison, ".ssh/fitavecromain_head_of_content.pub"), "utf8"), /mac-romain-head-of-content/);
  fs.rmSync(t, { recursive: true, force: true });
});

test("studio.sh installer : autre client isolé, tout dans sa racine, rien de Romain", () => {
  const t = tmp();
  const hoc = fauxHoc(t);
  const maison = path.join(t, "maison");
  fs.mkdirSync(maison);
  const racine = path.join(t, "racine");
  const fichier = path.join(t, "essai.json");
  // Copie du dépôt (studio complet : le serveur crée la config du client).
  const c = path.join(t, "copie");
  fs.cpSync(path.join(DEPOT, "studio"), path.join(c, "studio"), { recursive: true, filter: (s) => !/\/(node_modules|tests)(\/|$)/.test(s) });
  fs.cpSync(path.join(DEPOT, "installation"), path.join(c, "installation"), { recursive: true });
  fs.writeFileSync(fichier, JSON.stringify({
    id: "essai", prenom: "Camille", contact: "", racine, label_launchd: "com.essai.studio",
    appli: { nom: "Studio Camille", icone: "essai" }, port: 4799, theme: "essai",
    head_of_content: { depot: hoc, cle_ssh: `${racine}/cle-hoc` }, zernio: { compte: "camille", profil: null },
    ressources: { site: null }, branche_mise_a_jour: "essai", config_claude: `${racine}/claude`,
  }));
  fs.copyFileSync(fichier, path.join(c, "studio/clients/essai.json"));
  const services = path.join(t, "services"), applis = path.join(t, "applis");
  const env = envDe(maison, { STUDIO_CLIENT: "essai", STUDIO_SERVICES_DOSSIER: services, STUDIO_APPLIS_DOSSIER: applis });
  const r = bash(path.join(c, "installation/studio.sh"), ["installer"], env);
  assert.match(r.sortie, /studio-config créée pour Camille/, r.sortie);
  assert.match(r.sortie, /studio-icone : pas d'icône propre au client/, r.sortie);
  assert.doesNotMatch(r.sortie, /^ECHEC (?!studio-serveur)/m, r.sortie);

  const plist = fs.readFileSync(path.join(services, "com.essai.studio.plist"), "utf8");
  assert.match(plist, /<key>Label<\/key>\s*<string>com\.essai\.studio<\/string>/);
  assert.match(plist, new RegExp(`<key>CLAUDE_CONFIG_DIR</key>\\s*<string>${racine}/claude</string>`));
  assert.match(plist, /<key>STUDIO_CLIENT<\/key>\s*<string>essai<\/string>/);
  assert.match(plist, new RegExp(`<key>MONTEUR_CONFIG</key>\\s*<string>${racine}/monteur</string>`));
  assert.match(plist, new RegExp(`[>:]${racine}/bin:`));
  const app = path.join(applis, "Studio Camille.app");
  assert.match(fs.readFileSync(path.join(app, "Contents/Info.plist"), "utf8"), /<string>Studio Camille<\/string>/);
  const exe = fs.readFileSync(path.join(app, "Contents/MacOS/Studio"), "utf8");
  assert.doesNotMatch(exe, /Yoan|Romain/);
  assert.match(exe, /STUDIO_SERVICES_DOSSIER/);

  const conf = JSON.parse(fs.readFileSync(path.join(racine, "studio/studio.config.json"), "utf8"));
  assert.equal(conf.prenom, "Camille");
  assert.equal(conf.port, 4799);
  assert.equal(conf.depot_hoc, `${racine}/studio/head-of-content`);
  assert.equal(conf.media, `${racine}/Contenu`);
  assert.equal(conf.skills, `${racine}/claude/skills`);
  assert.ok(fs.existsSync(path.join(racine, "Contenu")));
  assert.ok(fs.existsSync(`${racine}/cle-hoc.pub`));
  assert.match(fs.readFileSync(`${racine}/cle-hoc.pub`, "utf8"), /mac-essai-head-of-content/);
  // Rien chez l'utilisateur : ni ~/.claude, ni ~/.montage-yoan, ni ~/.ssh, ni réglage launchd.
  for (const d of [".claude", ".montage-yoan", ".ssh", "Library/LaunchAgents", "Applications", ".config"]) {
    assert.ok(!fs.existsSync(path.join(maison, d)), `écrit dans ~/${d}`);
  }
  // Aucun nom ni chemin de Romain dans ce que l'installation a écrit.
  for (const f of [...lireArbre(racine), path.join(services, "com.essai.studio.plist"), ...lireArbre(app)]) {
    if (/\.icns$|\/cle-hoc$|\/jeton$/.test(f)) continue;
    assert.doesNotMatch(fs.readFileSync(f, "utf8"), /romain|montage-yoan|fitavecromain/i, f);
  }
  fs.rmSync(t, { recursive: true, force: true });
});

test("mettre-a-jour.sh : liens, branche et mémoire dans la config Claude du client isolé", () => {
  const t = tmp();
  const maison = path.join(t, "maison");
  fs.mkdirSync(maison);
  const racine = path.join(t, "racine");
  // Un « dépôt du monteur » minimal publié sur une branche du client, et sa copie installée.
  const src = path.join(t, "montage-src");
  fs.mkdirSync(path.join(src, "skills", "sous-titres"), { recursive: true });
  fs.mkdirSync(path.join(src, "agents"), { recursive: true });
  fs.writeFileSync(path.join(src, "skills/sous-titres/SKILL.md"), "---\nname: sous-titres\n---\n");
  fs.writeFileSync(path.join(src, "agents/monteur.md"), "---\nname: monteur\n---\n");
  fs.cpSync(path.join(DEPOT, "installation"), path.join(src, "installation"), { recursive: true });
  fs.mkdirSync(path.join(src, "studio/lancement"), { recursive: true });
  fs.mkdirSync(path.join(src, "studio/clients"), { recursive: true });
  fs.copyFileSync(path.join(DEPOT, "studio/lancement/client.sh"), path.join(src, "studio/lancement/client.sh"));
  fs.copyFileSync(path.join(DEPOT, "studio/lancement/commun.sh"), path.join(src, "studio/lancement/commun.sh"));
  fs.writeFileSync(path.join(src, "studio/clients/essai.json"), JSON.stringify({
    id: "essai", prenom: "Camille", racine, branche_mise_a_jour: "essai", config_claude: `${racine}/claude`,
    head_of_content: { depot: "", cle_ssh: `${racine}/cle` },
  }));
  const g = (cwd, a) => execFileSync("git", a, { cwd, stdio: "pipe", encoding: "utf8" });
  g(src, ["init", "-q", "-b", "main"]); g(src, ["add", "."]);
  g(src, ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "init"]);
  g(src, ["branch", "essai"]);
  fs.mkdirSync(racine);
  g(t, ["clone", "-q", "--branch", "main", src, path.join(racine, "montage-demo")]);
  fs.writeFileSync(path.join(racine, "client.json"), JSON.stringify({ id: "essai" }));
  // Un commit sur la branche du client seulement : la mise à jour doit le suivre.
  g(src, ["checkout", "-q", "essai"]);
  fs.writeFileSync(path.join(src, "skills/sous-titres/NOUVEAU.md"), "branche essai\n");
  g(src, ["add", "."]); g(src, ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "essai"]);

  const r = bash(path.join(racine, "montage-demo/installation/mettre-a-jour.sh"), ["--liens-installation"], envDe(maison));
  assert.equal(r.code, 0, r.sortie);
  const clone = path.join(racine, "montage-demo");
  assert.equal(g(clone, ["rev-parse", "--abbrev-ref", "HEAD"]).trim(), "essai");
  assert.ok(fs.existsSync(path.join(clone, "skills/sous-titres/NOUVEAU.md")));
  assert.equal(fs.readlinkSync(path.join(racine, "claude/skills/sous-titres")), path.join(clone, "skills/sous-titres"));
  assert.equal(fs.readlinkSync(path.join(racine, "claude/agents/monteur.md")), path.join(clone, "agents/monteur.md"));
  assert.ok(!fs.existsSync(path.join(maison, ".claude")), "liens posés dans ~/.claude");
  fs.rmSync(t, { recursive: true, force: true });
});

test("cles.sh --stdin : clé lue sur l'entrée standard, jamais affichée, posée dans la racine du client", () => {
  const t = tmp();
  const maison = path.join(t, "maison");
  fs.mkdirSync(maison);
  const racine = path.join(t, "racine");
  const fichier = path.join(t, "essai.json");
  fs.writeFileSync(fichier, JSON.stringify({ id: "essai", racine, config_claude: `${racine}/claude` }));
  const env = envDe(maison, { STUDIO_CLIENT: "essai", STUDIO_CLIENT_FICHIER: fichier });
  const secret = "sk-test-NE-PAS-AFFICHER-123";
  for (const [nom, f, v] of [["zernio", "zernio.env", "ZERNIO_API_KEY"], ["elevenlabs", "monteur/.env", "ELEVENLABS_API_KEY"]]) {
    // Pas de réseau dans le test : la vérification échoue ou n'est pas faite, la clé est quand même posée.
    const r = spawnSync("/bin/bash", [path.join(DEPOT, "installation/cles.sh"), "--stdin", nom], {
      env: { ...env, https_proxy: "http://127.0.0.1:9", HTTPS_PROXY: "http://127.0.0.1:9" }, input: `${secret}\n`, encoding: "utf8", timeout: 60000,
    });
    assert.doesNotMatch(r.stdout + r.stderr, new RegExp(secret));
    const p = path.join(racine, f);
    assert.equal(fs.readFileSync(p, "utf8"), `${v}=${secret}\n`);
    assert.equal((fs.statSync(p).mode & 0o777).toString(8), "600");
  }
  assert.ok(!fs.existsSync(path.join(maison, ".config")), "clé posée dans ~/.config");
  assert.ok(!fs.existsSync(path.join(maison, ".montage-yoan")));
  fs.rmSync(t, { recursive: true, force: true });
});
