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

test("isolation.sh : refuse un client non isolé sans lancer claude ni rien écrire", () => {
  const maison = tmp();
  const r = bash(path.join(DEPOT, "installation/isolation.sh"), [], envDe(maison, { PATH: "/usr/bin:/bin" }));
  assert.equal(r.code, 1);
  assert.match(r.sortie, /ISOLATION ECHEC client romain non isolé/);
  assert.deepEqual(fs.readdirSync(maison).filter((n) => n !== "Library"), []);
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
  // L'icône de Yoan quand elle est dans le dépôt (lot 5), sinon celle par défaut.
  const icone = path.join(DEPOT, "studio/lancement/icones/yoan.icns");
  assert.equal(v.CLIENT_ICONE, fs.existsSync(icone) ? icone : "");
  for (const [k, x] of Object.entries(v)) {
    if (k === "CLIENT_FICHIER" || k === "CLIENT_ICONE") continue; // chemins du dépôt de travail
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
  // « repli » : le nouveau code quand l'appli Mac ne se lance pas (ici : demandé) ; il doit poser
  // exactement l'appli d'avant (petit script qui ouvre le navigateur).
  for (const [nom, ref, ajout] of [["ancien", REF_ROMAIN], ["nouveau", null], ["repli", null, { STUDIO_APPLI_NAVIGATEUR: "1" }]]) {
    const c = path.join(t, nom);
    for (const f of ["installation/studio.sh", "studio/lancement/commun.sh", "studio/lancement/client.sh", "studio/lancement/demarrer.sh",
      "studio/lancement/ouvrir.sh", "studio/lancement/appli.sh", "studio/lancement/appli/Studio",
      "studio/lancement/icone.icns", "studio/studio.config.exemple.json", "studio/clients/romain.json"]) {
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
    const r = bash(path.join(c, "installation/studio.sh"), ["installer"], envDe(maison, { HOC_DEPOT_URL: hoc, ...ajout }));
    assert.match(r.sortie, /STUDIO_FIN ok=\d+ a_faire=0 echecs=1/, r.sortie); // seul échec : pas de serveur dans la copie
    copies[nom] = { c, maison };
  }
  const norm = (s, { c, maison }) => s.split(c).join("<CODE>").split(maison).join("<HOME>");
  const lire = (k, f) => norm(fs.readFileSync(path.join(copies[k].maison, f), "utf8"), copies[k]);
  for (const f of ["Library/LaunchAgents/com.montage-yoan.studio.plist", ".montage-yoan/studio/studio.config.json"]) {
    assert.equal(lire("nouveau", f), lire("ancien", f), f);
  }
  for (const f of ["Applications/Studio.app/Contents/Info.plist", "Applications/Studio.app/Contents/MacOS/Studio"]) {
    assert.equal(lire("repli", f), lire("ancien", f), `repli ${f}`);
  }
  // L'appli Mac de Romain : même nom, même identifiant, même icône, au même endroit ; son binaire est
  // celui du dépôt, elle demande l'adresse à ouvrir.sh de sa copie et ne se cache plus du Dock.
  const app = path.join(copies.nouveau.maison, "Applications/Studio.app/Contents");
  const plist = lire("nouveau", "Applications/Studio.app/Contents/Info.plist");
  assert.match(plist, /<key>CFBundleIdentifier<\/key>\s*<string>com\.montage-yoan\.studio\.app<\/string>/);
  assert.match(plist, /<key>CFBundleName<\/key>\s*<string>Studio<\/string>/);
  assert.match(plist, /<key>StudioOuvrir<\/key>\s*<string><CODE>\/studio\/lancement\/ouvrir\.sh<\/string>/);
  assert.doesNotMatch(plist, /LSUIElement|StudioEnvironnement/);
  assert.ok(fs.readFileSync(path.join(app, "MacOS/Studio")).equals(fs.readFileSync(path.join(DEPOT, "studio/lancement/appli/Studio"))));
  assert.ok(fs.readFileSync(path.join(app, "Resources/Studio.icns")).equals(fs.readFileSync(path.join(DEPOT, "studio/lancement/icone.icns"))));
  assert.match(execFileSync(path.join(app, "MacOS/Studio"), ["--verifier"], { encoding: "utf8" }), /^OK appli /);
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
  const exe = fs.readFileSync(path.join(app, "Contents/MacOS/Studio"), "latin1");
  assert.doesNotMatch(exe, /Yoan|Romain/);
  // Les dossiers du bac à sable passent à ouvrir.sh par les réglages de l'appli.
  assert.match(fs.readFileSync(path.join(app, "Contents/Info.plist"), "utf8"),
    new RegExp(`<key>StudioEnvironnement</key>\\s*<dict>[\\s\\S]*<key>STUDIO_SERVICES_DOSSIER</key>\\s*<string>${services}</string>`));

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

test("mettre-a-jour.sh : le skill de mise en page du client est relié sous le nom carrousel, l'autre jamais", () => {
  for (const [skill, attendu] of [["carrousel-yoan", "carrousel-yoan"], [null, "carrousel"]]) {
    const t = tmp();
    const maison = path.join(t, "maison");
    fs.mkdirSync(maison);
    const racine = path.join(t, "racine");
    const src = path.join(t, "montage-src");
    for (const s of ["carrousel", "carrousel-yoan", "carrousels-en-attente", "sous-titres"]) {
      fs.mkdirSync(path.join(src, "skills", s), { recursive: true });
      fs.writeFileSync(path.join(src, "skills", s, "SKILL.md"), `---\nname: ${s}\n---\n`);
    }
    fs.mkdirSync(path.join(src, "agents"), { recursive: true });
    fs.writeFileSync(path.join(src, "agents/monteur.md"), "---\nname: monteur\n---\n");
    fs.cpSync(path.join(DEPOT, "installation"), path.join(src, "installation"), { recursive: true });
    fs.mkdirSync(path.join(src, "studio/lancement"), { recursive: true });
    fs.mkdirSync(path.join(src, "studio/clients"), { recursive: true });
    fs.copyFileSync(path.join(DEPOT, "studio/lancement/client.sh"), path.join(src, "studio/lancement/client.sh"));
    fs.copyFileSync(path.join(DEPOT, "studio/lancement/commun.sh"), path.join(src, "studio/lancement/commun.sh"));
    fs.writeFileSync(path.join(src, "studio/clients/essai.json"), JSON.stringify({
      id: "essai", prenom: "Camille", racine, branche_mise_a_jour: "main", config_claude: `${racine}/claude`,
      head_of_content: { depot: "", cle_ssh: `${racine}/cle` }, ...(skill ? { skill_carrousel: skill } : {}),
    }));
    const g = (cwd, a) => execFileSync("git", a, { cwd, stdio: "pipe", encoding: "utf8" });
    g(src, ["init", "-q", "-b", "main"]); g(src, ["add", "."]);
    g(src, ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "init"]);
    fs.mkdirSync(racine);
    g(t, ["clone", "-q", "--branch", "main", src, path.join(racine, "montage-demo")]);
    fs.writeFileSync(path.join(racine, "client.json"), JSON.stringify({ id: "essai" }));
    // Une installation d'avant : « carrousel » menait au skill de Romain.
    fs.mkdirSync(path.join(racine, "claude/skills"), { recursive: true });
    const clone = path.join(racine, "montage-demo");
    fs.symlinkSync(path.join(clone, "skills/carrousel"), path.join(racine, "claude/skills/carrousel"));

    const r = bash(path.join(clone, "installation/mettre-a-jour.sh"), [], envDe(maison));
    assert.equal(r.code, 0, r.sortie);
    const sk = path.join(racine, "claude/skills");
    assert.equal(fs.readlinkSync(path.join(sk, "carrousel")), path.join(clone, "skills", attendu), r.sortie);
    assert.ok(!fs.existsSync(path.join(sk, "carrousel-yoan")), "carrousel-yoan relié sous son nom");
    assert.equal(fs.readlinkSync(path.join(sk, "carrousels-en-attente")), path.join(clone, "skills/carrousels-en-attente"));
    assert.equal(fs.readlinkSync(path.join(sk, "sous-titres")), path.join(clone, "skills/sous-titres"));
    if (skill) assert.match(r.sortie, /LIEN_REFAIT skills\/carrousel/);
    fs.rmSync(t, { recursive: true, force: true });
  }
});

test("mettre-a-jour.sh : le monteur du client est relié sous le nom monteur, ses skills réservés chez lui seulement", () => {
  // [client, monteur du fichier, monteur attendu, skills réservés à « essai » reliés ?]
  for (const [id, monteur, attendu, reserves] of [["essai", "monteur-essai", "monteur-essai", true], ["autre", null, "monteur", false]]) {
    const t = tmp();
    const maison = path.join(t, "maison");
    fs.mkdirSync(maison);
    const racine = path.join(t, "racine");
    const src = path.join(t, "montage-src");
    for (const s of ["animations", "plan-montage-essai", "zooms"]) {
      fs.mkdirSync(path.join(src, "skills", s), { recursive: true });
      fs.writeFileSync(path.join(src, "skills", s, "SKILL.md"), `---\nname: ${s}\n---\n`);
    }
    fs.writeFileSync(path.join(src, "skills/plan-montage-essai/CLIENT"), "essai\n");
    fs.mkdirSync(path.join(src, "agents"), { recursive: true });
    fs.writeFileSync(path.join(src, "agents/monteur.md"), "---\nname: monteur\n---\nRomain\n");
    fs.writeFileSync(path.join(src, "agents/monteur-essai.md"), "---\nname: monteur\n---\nEssai\n");
    fs.cpSync(path.join(DEPOT, "installation"), path.join(src, "installation"), { recursive: true });
    fs.mkdirSync(path.join(src, "studio/lancement"), { recursive: true });
    fs.mkdirSync(path.join(src, "studio/clients"), { recursive: true });
    fs.copyFileSync(path.join(DEPOT, "studio/lancement/client.sh"), path.join(src, "studio/lancement/client.sh"));
    fs.copyFileSync(path.join(DEPOT, "studio/lancement/commun.sh"), path.join(src, "studio/lancement/commun.sh"));
    fs.writeFileSync(path.join(src, `studio/clients/${id}.json`), JSON.stringify({
      id, prenom: "Camille", racine, branche_mise_a_jour: "main", config_claude: `${racine}/claude`,
      head_of_content: { depot: "", cle_ssh: `${racine}/cle` }, ...(monteur ? { monteur } : {}),
    }));
    const g = (cwd, a) => execFileSync("git", a, { cwd, stdio: "pipe", encoding: "utf8" });
    g(src, ["init", "-q", "-b", "main"]); g(src, ["add", "."]);
    g(src, ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "init"]);
    fs.mkdirSync(racine);
    g(t, ["clone", "-q", "--branch", "main", src, path.join(racine, "montage-demo")]);
    fs.writeFileSync(path.join(racine, "client.json"), JSON.stringify({ id }));
    const clone = path.join(racine, "montage-demo");
    // Ce qu'une version d'avant a relié : le monteur de Romain sous monteur.md, l'autre sous son nom, le skill réservé partout.
    fs.mkdirSync(path.join(racine, "claude/skills"), { recursive: true });
    fs.mkdirSync(path.join(racine, "claude/agents"), { recursive: true });
    fs.symlinkSync(path.join(clone, "agents/monteur.md"), path.join(racine, "claude/agents/monteur.md"));
    fs.symlinkSync(path.join(clone, "agents/monteur-essai.md"), path.join(racine, "claude/agents/monteur-essai.md"));
    fs.symlinkSync(path.join(clone, "skills/plan-montage-essai"), path.join(racine, "claude/skills/plan-montage-essai"));

    const r = bash(path.join(clone, "installation/mettre-a-jour.sh"), [], envDe(maison));
    assert.equal(r.code, 0, r.sortie);
    const ag = path.join(racine, "claude/agents"), sk = path.join(racine, "claude/skills");
    assert.equal(fs.readlinkSync(path.join(ag, "monteur.md")), path.join(clone, "agents", `${attendu}.md`), r.sortie);
    assert.ok(!fs.existsSync(path.join(ag, "monteur-essai.md")), "monteur d'un client relié sous son nom");
    assert.equal(fs.existsSync(path.join(sk, "plan-montage-essai")), reserves, r.sortie);
    assert.equal(fs.readlinkSync(path.join(sk, "zooms")), path.join(clone, "skills/zooms"));
    fs.rmSync(t, { recursive: true, force: true });
  }
});

test("client.sh : monteur du client, Romain inchangé ; le monteur de Yoan et ses briques sont dans le dépôt", () => {
  assert.equal(variables(envDe(tmp())).CLIENT_MONTEUR, "monteur");
  assert.equal(variables(envDe("/Users/yoanmottier", { STUDIO_CLIENT: "yoan" })).CLIENT_MONTEUR, "monteur-yoan");
  assert.match(fs.readFileSync(path.join(DEPOT, "agents/monteur-yoan.md"), "utf8"), /^---\nname: monteur\n/);
  for (const s of ["plan-montage-yoan", "animations-yoan", "sous-titres-yoan"]) {
    assert.ok(fs.existsSync(path.join(DEPOT, "skills", s, "SKILL.md")), s);
    assert.equal(fs.readFileSync(path.join(DEPOT, "skills", s, "CLIENT"), "utf8").trim(), "yoan", s);
  }
});

test("client.sh : skill de mise en page des carrousels, Romain inchangé", () => {
  assert.equal(variables(envDe(tmp())).CLIENT_SKILL_CARROUSEL, "carrousel");
  assert.equal(variables(envDe("/Users/yoanmottier", { STUDIO_CLIENT: "yoan" })).CLIENT_SKILL_CARROUSEL, "carrousel-yoan");
  assert.ok(fs.existsSync(path.join(DEPOT, "skills/carrousel-yoan/SKILL.md")));
  assert.match(fs.readFileSync(path.join(DEPOT, "skills/carrousel-yoan/SKILL.md"), "utf8"), /^---\nname: carrousel\n/);
});

test("appli : l'ancienne icône (script) devient l'appli Mac au même endroit, puis ne bouge plus", () => {
  const maison = tmp();
  const applis = path.join(maison, "applis");
  const poser = (ajout = {}) => spawnSync("/bin/bash", ["-c",
    `. "${DEPOT}/studio/lancement/commun.sh" && . "${DEPOT}/studio/lancement/appli.sh" && studio_poser_appli`],
  { env: envDe(maison, { STUDIO_CLIENT: "romain", STUDIO_APPLIS_DOSSIER: applis, ...ajout }), encoding: "utf8" }).stdout.trim();
  assert.equal(poser({ STUDIO_APPLI_NAVIGATEUR: "1" }), "POSEE navigateur (demandé)");
  const exe = path.join(applis, "Studio.app/Contents/MacOS/Studio");
  assert.match(fs.readFileSync(exe, "utf8"), /^#!\/bin\/bash/);
  assert.equal(poser(), "POSEE native");
  assert.match(execFileSync(exe, ["--verifier"], { encoding: "utf8" }), /^OK appli /);
  assert.equal(poser(), "PRESENTE native");
  // ouvrir.sh --adresse ne pose ni n'ouvre rien : il rend l'adresse ou une alerte (ici, pas de service).
  const r = spawnSync("/bin/bash", [path.join(DEPOT, "studio/lancement/ouvrir.sh"), "--adresse"], {
    env: envDe(maison, { STUDIO_CLIENT: "romain", STUDIO_APPLIS_DOSSIER: applis, STUDIO_SERVICES_DOSSIER: path.join(maison, "services"), STUDIO_LABEL: "com.essai.inexistant" }),
    encoding: "utf8" });
  assert.match(r.stdout, /^ALERTE Le studio n/m);
  fs.rmSync(maison, { recursive: true, force: true });
});

// Icône du Dock pas à jour après une mise à jour (18/11/2026) : après chaque remplacement de l'appli,
// paquet touché + lsregister -f ; l'appli ouverte est relancée seulement quand le studio est au repos ;
// jamais de réglage du Dock ni de relance du Dock. Les commandes macOS sont de faux outils qui notent
// leurs appels (PATH), ou des fonctions remplacées dans le script : rien ne touche au vrai Mac.
test("appli : icône à jour dans le Dock après un remplacement, sans toucher au Dock", () => {
  const maison = tmp();
  const applis = path.join(maison, "applis");
  const outils = path.join(maison, "outils");
  const journal = path.join(maison, "appels.log");
  const pidf = path.join(maison, "pid"), occupe = path.join(maison, "occupe");
  fs.mkdirSync(outils);
  for (const o of ["defaults", "killall", "osascript", "open", "lsappinfo"]) {
    const corps = o === "lsappinfo"
      ? `p="$(cat ${JSON.stringify(pidf)} 2>/dev/null)"; [ -n "$p" ] || exit 0; case "$1" in find) echo 'ASN:0x0-0x1-"Studio":';; info) echo "\\"pid\\"=$p";; esac`
      : "";
    fs.writeFileSync(path.join(outils, o), `#!/bin/bash\necho "${o} $*" >> ${JSON.stringify(journal)}\n${corps}\n`, { mode: 0o755 });
  }
  const env = (ajout = {}) => ({ ...envDe(maison, { STUDIO_CLIENT: "romain", STUDIO_APPLIS_DOSSIER: applis,
    STUDIO_SERVICES_DOSSIER: path.join(maison, "services"), STUDIO_LABEL: "com.essai.inexistant", STUDIO_SANS_DOCK: "", ...ajout }),
  PATH: `${outils}:${envDe(maison).PATH}` });
  const lancer = (cmd, ajout) => spawnSync("/bin/bash", ["-c",
    `. "${DEPOT}/studio/lancement/commun.sh" && . "${DEPOT}/studio/lancement/appli.sh"
     studio_lsregister() { echo "lsregister $1" >> "$JOURNAL"; }
     studio_au_repos() { [ ! -f "$OCCUPE" ]; }
     ${cmd}`], { env: { ...env(ajout), JOURNAL: journal, OCCUPE: occupe }, encoding: "utf8" }).stdout.trim();
  const brut = () => (fs.existsSync(journal) ? fs.readFileSync(journal, "utf8").trim().split("\n").filter(Boolean) : []);
  const appels = () => brut().filter((a) => !a.startsWith("lsappinfo "));   // lectures seules, sans effet
  const app = path.join(applis, "Studio.app");
  const repere = path.join(maison, ".montage-yoan/studio/appli-relance-demandee");
  const vieux = new Date("2020-01-01T00:00:00Z");

  // 1. Première pose, appli fermée : signalée à macOS, pas de relance.
  assert.equal(lancer("studio_poser_appli"), "POSEE native");
  assert.deepEqual(appels(), [`lsregister ${app}`]);
  assert.ok(!fs.existsSync(repere));
  assert.equal(lancer("studio_poser_appli"), "PRESENTE native");
  assert.equal(appels().length, 1, "rien de plus quand rien n'a changé");

  // 2. Nouvelle icône pendant que l'appli tourne et que le studio est occupé : paquet touché, registre,
  //    relance attendue (l'appli n'est pas fermée sous les pieds d'une session).
  const appliOuverte = spawnSync("/bin/bash", ["-c", "sleep 60 >/dev/null 2>&1 & echo $!"], { encoding: "utf8" }).stdout.trim();
  fs.writeFileSync(pidf, appliOuverte);
  fs.writeFileSync(occupe, "");
  // L'ancienne version installée (autre icône), dont macOS avait été prévenu.
  fs.writeFileSync(path.join(app, "Contents/Resources/Studio.icns"), "ancienne icône");
  fs.writeFileSync(path.join(maison, ".montage-yoan/studio/appli-signalee"), lancer("studio_appli_empreinte") + "\n");
  fs.utimesSync(app, vieux, vieux);
  assert.equal(lancer("studio_poser_appli"), "POSEE native");
  assert.ok(fs.statSync(app).mtimeMs > vieux.getTime() + 1000, "paquet touché");
  assert.deepEqual(appels().slice(1), [`lsregister ${app}`]);
  assert.ok(fs.existsSync(repere));
  assert.equal(lancer("studio_relancer_appli_si_demande"), "ATTEND");
  assert.doesNotThrow(() => process.kill(Number(appliOuverte), 0), "appli laissée ouverte tant que le studio est occupé");

  // 3. Au repos : au prochain clic sur l'icône (ouvrir.sh --adresse, sans service ici), l'appli est
  //    relancée en fond sur la nouvelle copie (vrai ouvrir.sh, faux lsappinfo et faux open).
  fs.rmSync(occupe);
  const r = spawnSync("/bin/bash", [path.join(DEPOT, "studio/lancement/ouvrir.sh"), "--adresse"], { env: env(), encoding: "utf8" });
  assert.match(r.stdout, /^ALERTE /m);
  const fin = Date.now() + 8000;
  while (!appels().includes(`open ${app}`) && Date.now() < fin) spawnSync("/bin/sleep", ["0.1"]);
  assert.ok(appels().includes(`open ${app}`), appels().join(" / "));
  assert.throws(() => process.kill(Number(appliOuverte), 0), "ancienne appli arrêtée avant la relance");
  assert.ok(!fs.existsSync(repere));
  fs.rmSync(pidf);

  // 4. Appli posée avant ce correctif (jamais signalée) : rattrapée une fois, même sans changement.
  fs.rmSync(path.join(maison, ".montage-yoan/studio/appli-signalee"));
  const avant = appels().length;
  assert.equal(lancer("studio_poser_appli"), "PRESENTE native");
  assert.deepEqual(appels().slice(avant), [`lsregister ${app}`]);
  assert.equal(lancer("studio_poser_appli"), "PRESENTE native");
  assert.equal(appels().length, avant + 1);

  // 5. Tests et bacs à sable (STUDIO_SANS_DOCK=1) : ni registre ni relance.
  fs.writeFileSync(path.join(app, "Contents/Resources/Studio.icns"), "autre");
  fs.writeFileSync(pidf, "999999");
  assert.equal(lancer("studio_poser_appli; studio_relancer_appli_si_demande", { STUDIO_SANS_DOCK: "1" }), "POSEE native\nRIEN");
  assert.equal(appels().length, avant + 1);

  // Jamais : réglages du Dock, relance du Dock, ordre AppleScript.
  assert.ok(brut().every((a) => /^(lsregister|lsappinfo|open) /.test(a)), brut().join(" / "));
  for (const f of ["studio/lancement/appli.sh", "studio/lancement/ouvrir.sh", "installation/mettre-a-jour.sh"]) {
    assert.doesNotMatch(fs.readFileSync(path.join(DEPOT, f), "utf8"), /com\.apple\.dock|killall\s+Dock/, f);
  }
  fs.rmSync(maison, { recursive: true, force: true });
});

test("client.sh : polices locales du client (lot 10) posées dans <racine>/studio/polices, absente sans erreur, Romain rien", () => {
  const t = tmp();
  const maison = path.join(t, "maison");
  fs.mkdirSync(maison);
  const racine = path.join(t, "racine");
  const src = path.join(maison, "polices-a-moi", "Ma-Police.woff2");
  fs.mkdirSync(path.dirname(src), { recursive: true });
  fs.writeFileSync(src, "wOF2-une");
  const fichier = path.join(t, "essai.json");
  fs.writeFileSync(fichier, JSON.stringify({ id: "essai", racine, config_claude: `${racine}/claude`,
    polices_locales: { "Ma-Police.woff2": "~/polices-a-moi/Ma-Police.woff2", "Absente.woff2": "~/nulle-part/Absente.woff2", "../sort.woff2": "~/polices-a-moi/Ma-Police.woff2", "lisez-moi.txt": "~/polices-a-moi/Ma-Police.woff2" } }));
  const env = envDe(maison, { STUDIO_CLIENT: "essai", STUDIO_CLIENT_FICHIER: fichier });
  const poser = () => spawnSync("/bin/bash", ["-c", `. studio/lancement/client.sh; studio_client_charger; studio_poser_polices "${racine}/studio"`], { cwd: DEPOT, env, encoding: "utf8" });
  let r = poser();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^POLICE_POSEE Ma-Police\.woff2$/m);
  assert.match(r.stdout, /^POLICE_ABSENTE Absente\.woff2/m);
  assert.doesNotMatch(r.stdout, /sort\.woff2|lisez-moi/, "un nom hors règle n'est jamais posé");
  assert.deepEqual(fs.readdirSync(path.join(racine, "studio", "polices")), ["Ma-Police.woff2"]);
  assert.match(poser().stdout, /^POLICE_A_JOUR Ma-Police\.woff2$/m);
  fs.writeFileSync(src, "wOF2-deux");
  assert.match(poser().stdout, /^POLICE_POSEE Ma-Police\.woff2$/m);
  assert.equal(fs.readFileSync(path.join(racine, "studio", "polices", "Ma-Police.woff2"), "utf8"), "wOF2-deux");
  // Le démarrage du service les repose aussi (une police ajoutée arrive au premier redémarrage).
  assert.match(fs.readFileSync(path.join(DEPOT, "studio/lancement/demarrer.sh"), "utf8"), /studio_poser_polices "\$STUDIO_HOME"/);
  // Romain : aucune police locale, rien n'est écrit.
  const rr = spawnSync("/bin/bash", ["-c", `. studio/lancement/client.sh; studio_client_charger; printf '[%s]' "$CLIENT_POLICES"; studio_poser_polices "${t}/romain"`],
    { cwd: DEPOT, env: envDe(maison, { STUDIO_CLIENT: "romain" }), encoding: "utf8" });
  assert.equal(rr.stdout, "[]");
  assert.ok(!fs.existsSync(path.join(t, "romain")));
  // Yoan : sa police vient de son fichier, hors du dépôt public.
  const y = JSON.parse(fs.readFileSync(path.join(DEPOT, "studio/clients/yoan.json"), "utf8")).polices_locales;
  assert.match(y["Satoshi-Black.woff2"], /^~\/Workspace Claude Code\/projets\/perso\/content\/monteur\/style\/polices\/Satoshi-Black\.woff2$/);
  assert.equal(spawnSync("git", ["ls-files", "--", "*atoshi*.woff2", "*atoshi*.woff", "*atoshi*.ttf", "*atoshi*.otf"], { cwd: DEPOT, encoding: "utf8" }).stdout.trim(), "", "Satoshi n'est pas dans le dépôt");
  fs.rmSync(t, { recursive: true, force: true });
});
