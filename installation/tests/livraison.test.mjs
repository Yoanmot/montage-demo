// Tests de la livraison du 21/11 : code de livraison (format, somme, collage abîmé, clé manquante), connexion de
// Claude sans Terminal (pseudo-terminal, faux claude qui rejoue la vraie sortie), disque externe détecté, appareil
// par défaut, Sovo (téléchargement vérifié, touche Fn, autorisations lues dans son journal).
//   cd installation && node --test tests/*.test.mjs
// Aucune vraie clé : valeurs factices. Aucun réseau (proxy mort), rien dans /Applications ni dans les réglages du Mac.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEPOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const INST = path.join(DEPOT, "installation");
const FIX = path.join(INST, "tests", "fixtures");
const CREES = [];
function tmp() {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "livraison-")));
  CREES.push(d);
  return d;
}
process.on("exit", () => { for (const d of CREES) fs.rmSync(d, { recursive: true, force: true }); });

const SANS_RESEAU = { https_proxy: "http://127.0.0.1:9", HTTPS_PROXY: "http://127.0.0.1:9", http_proxy: "http://127.0.0.1:9" };
function envDe(maison, ajout = {}) {
  return {
    HOME: maison, USER: process.env.USER, PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin:/usr/sbin:/sbin`,
    LANG: "fr_FR.UTF-8", TMPDIR: `${maison}/`, STUDIO_SANS_SERVICE: "1", STUDIO_SANS_DOCK: "1", STUDIO_SANS_CLAUDE: "1",
    ...SANS_RESEAU, ...ajout,
  };
}
function lance(script, args, env, input) {
  const r = spawnSync("/bin/bash", [script, ...args], { env, input, encoding: "utf8", timeout: 120000 });
  return { code: r.status, sortie: (r.stdout || "") + (r.stderr || "") };
}
function py(args, input) {
  const r = spawnSync("/usr/bin/python3", ["-I", path.join(INST, "livraison.py"), ...args], { input, encoding: "utf8" });
  return { code: r.status, sortie: (r.stdout || "") + (r.stderr || "") };
}
const mode = (p) => (fs.statSync(p).mode & 0o777).toString(8);

// Clés factices (jamais une vraie) et une vraie paire SSH jetable.
const FAUX = { zernio: "FAUXzernio_0123456789abcdef0123", elevenlabs: "sk_FAUXelevenlabs0123456789abcdef0123456789abcd", code: "CODE-FAUX-0042" };
function cles(d, sans = []) {
  fs.mkdirSync(d, { recursive: true });
  for (const [n, v] of Object.entries(FAUX)) if (!sans.includes(n)) fs.writeFileSync(path.join(d, n), `${v}\n`);
  if (!sans.includes("ssh")) {
    execFileSync("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-C", "essai", "-f", path.join(d, "cle")]);
    fs.copyFileSync(path.join(d, "cle"), path.join(d, "ssh"));
  }
  return d;
}
function code(t, sans = []) {
  const d = cles(path.join(t, "cles"), sans);
  const r = py(["encoder", "romain", d]);
  assert.equal(r.code, 0, r.sortie);
  return r.sortie.trim();
}

// Un faux dépôt du head of content (nu, local).
function fauxHoc(dossier) {
  const src = path.join(dossier, "hoc-src");
  fs.mkdirSync(src, { recursive: true });
  fs.writeFileSync(path.join(src, "CLAUDE.md"), "# essai\n");
  const g = (a) => execFileSync("git", a, { cwd: src, stdio: "pipe" });
  g(["init", "-q", "-b", "main"]); g(["add", "."]); g(["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "init"]);
  const nu = path.join(dossier, "hoc.git");
  execFileSync("git", ["clone", "-q", "--bare", src, nu], { stdio: "pipe" });
  return nu;
}

test("code de livraison : une ligne, rien que A-Z, 0-9 et « - », relu à l'identique", () => {
  const t = tmp();
  const c = code(t);
  assert.match(c, /^STUDIO1-ROMAIN-[A-Z2-7]+-[0-9A-F]{10}-FIN$/);
  assert.ok(c.length < 1200, `code trop long : ${c.length}`);
  for (const v of Object.values(FAUX)) assert.ok(!c.includes(v.toUpperCase()), "une clé lisible dans le code");
  const r = py(["decoder", "romain", path.join(t, "sortie")], c);
  assert.equal(r.code, 0, r.sortie);
  assert.match(r.sortie, /^LIVRAISON_OK zernio,elevenlabs,code,ssh/);
  for (const n of ["zernio", "elevenlabs", "code"]) {
    assert.equal(fs.readFileSync(path.join(t, "sortie", n), "utf8"), `${FAUX[n]}\n`);
    assert.equal(mode(path.join(t, "sortie", n)), "600");
  }
  assert.ok(fs.readFileSync(path.join(t, "sortie", "ssh")).equals(fs.readFileSync(path.join(t, "cles", "ssh"))));
  for (const v of Object.values(FAUX)) assert.doesNotMatch(r.sortie, new RegExp(v));
});

test("code de livraison : collage depuis WhatsApp (date, retours à la ligne, espaces insécables, invisibles) accepté", () => {
  const t = tmp();
  const c = code(t);
  const morceaux = c.match(/.{1,61}/g);
  const colle = `[15:20, 21/11/2026] Yoan: ${morceaux.join("\n")} ​ \r\n`;
  const r = py(["decoder", "romain", path.join(t, "s")], colle);
  assert.equal(r.code, 0, r.sortie);
  assert.match(r.sortie, /^LIVRAISON_OK /);
  const r2 = py(["decoder", "romain", path.join(t, "s2")], c.replace(/(.{40})/g, "$1 ").toLowerCase());
  assert.match(r2.sortie, /^LIVRAISON_OK /, "minuscules et espaces");
});

test("code de livraison : coupé, abîmé, d'un autre client ou vide : refusé, rien d'écrit", () => {
  const t = tmp();
  const c = code(t);
  const cas = [
    [c.slice(0, Math.floor(c.length / 2)), /^LIVRAISON_INCOMPLET/],
    [c.slice(0, -4), /^LIVRAISON_INCOMPLET/],
    [c.replace(/-FIN$/, "").slice(0, -3) + "-FIN", /^LIVRAISON_ABIME/],
    [c.slice(0, 30) + (c[30] === "A" ? "B" : "A") + c.slice(31), /^LIVRAISON_ABIME la somme/],
    [c.replace("STUDIO1-", "STUDIO2-"), /^LIVRAISON_VERSION 2/],
    ["bonjour Romain", /^LIVRAISON_ABIME ce n'est pas un code/],
    ["  \n ", /^LIVRAISON_VIDE/],
  ];
  for (const [i, [texte, attendu]] of cas.entries()) {
    const s = path.join(t, `s${i}`);
    const r = py(["decoder", "romain", s], texte);
    assert.equal(r.code, 2, `${i} ${r.sortie}`);
    assert.match(r.sortie, attendu, `${i}`);
    assert.ok(!fs.existsSync(s), `${i} : des fichiers écrits`);
  }
  const r = py(["decoder", "yoan", path.join(t, "y")], c);
  assert.match(r.sortie, /^LIVRAISON_AUTRE_CLIENT romain/);
});

test("code de livraison : une clé manquante est dite, les autres sont livrées", () => {
  const t = tmp();
  const c = code(t, ["elevenlabs"]);
  const r = py(["decoder", "romain", path.join(t, "s")], c);
  assert.equal(r.code, 0);
  assert.match(r.sortie, /^LIVRAISON_MANQUE elevenlabs$/m);
  assert.match(r.sortie, /^LIVRAISON_OK zernio,code,ssh/m);
  assert.ok(!fs.existsSync(path.join(t, "s", "elevenlabs")));
});

test("preparer-livraison.sh : clé SSH neuve, ajout en écriture demandé à GitHub, code relu, aucune valeur affichée", () => {
  const t = tmp();
  const d = cles(path.join(t, "cles"), ["ssh"]);
  const sortie = path.join(t, "code.txt");
  const r = lance(path.join(INST, "preparer-livraison.sh"), ["romain"], envDe(t, { LIVRAISON_CLES: d, LIVRAISON_SANS_GITHUB: "1", LIVRAISON_SORTIE: sortie }));
  assert.equal(r.code, 0, r.sortie);
  assert.match(r.sortie, /gh repo deploy-key add <clé publique> --repo Yoanmot\/head-of-content-romain --title "Mac de Romain \(livraison [0-9-]+\)" --allow-write/);
  for (const v of Object.values(FAUX)) assert.doesNotMatch(r.sortie, new RegExp(v));
  assert.doesNotMatch(r.sortie, /PRIVATE KEY|STUDIO1-/);
  assert.equal(mode(sortie), "600");
  const dec = py(["decoder", "romain", path.join(t, "s")], fs.readFileSync(sortie, "utf8"));
  assert.match(dec.sortie, /^LIVRAISON_OK zernio,elevenlabs,code,ssh/);
  assert.match(fs.readFileSync(path.join(t, "s", "ssh"), "utf8"), /BEGIN OPENSSH PRIVATE KEY/);
  // Rien ne reste sur le Mac de Yoan : le dossier de travail est effacé.
  assert.deepEqual(fs.readdirSync(t).filter((n) => n.startsWith("preparer-livraison.")), []);
});

test("livraison.sh : chaque clé dans son fichier (600), clé SSH posée et vérifiée sur le dépôt, l'ancienne rangée", () => {
  const t = tmp();
  const maison = path.join(t, "maison");
  fs.mkdirSync(path.join(maison, ".ssh"), { recursive: true });
  fs.writeFileSync(path.join(maison, ".ssh/fitavecromain_head_of_content"), "ancienne clé\n");
  const hoc = fauxHoc(t);
  const c = code(t);
  const r = lance(path.join(INST, "livraison.sh"), ["--stdin"], envDe(maison, { HOC_DEPOT_URL: hoc }), `${c}\n`);
  assert.equal(r.code, 0, r.sortie);
  for (const v of Object.values(FAUX)) assert.doesNotMatch(r.sortie, new RegExp(v));
  assert.doesNotMatch(r.sortie, /PRIVATE KEY/);
  const f = {
    zernio: [".montage-yoan/zernio.env", "ZERNIO_API_KEY"], elevenlabs: [".config/monteur-romain/.env", "ELEVENLABS_API_KEY"],
    code: [".montage-yoan/config", "CODE"],
  };
  for (const [n, [p, v]] of Object.entries(f)) {
    assert.equal(fs.readFileSync(path.join(maison, p), "utf8"), `${v}=${FAUX[n]}\n`, n);
    assert.equal(mode(path.join(maison, p)), "600", n);
  }
  const cle = path.join(maison, ".ssh/fitavecromain_head_of_content");
  assert.ok(fs.readFileSync(cle).equals(fs.readFileSync(path.join(t, "cles", "ssh"))));
  assert.equal(mode(cle), "600");
  assert.match(fs.readFileSync(`${cle}.pub`, "utf8"), /^ssh-ed25519 \S+ mac-romain-head-of-content\n$/);
  assert.match(r.sortie, /^CLE_OK ssh$/m);
  assert.match(r.sortie, /^LIVRAISON_FIN ok=4 manque=rien refusees=rien$/m);
  const ranges = fs.readdirSync(path.join(maison, ".montage-yoan/anciennes-versions"));
  assert.equal(fs.readFileSync(path.join(maison, ".montage-yoan/anciennes-versions", ranges[0], "ssh/fitavecromain_head_of_content"), "utf8"), "ancienne clé\n");
  // Relancé avec le même code : rien ne change, la clé SSH est « déjà là ».
  const r2 = lance(path.join(INST, "livraison.sh"), ["--stdin"], envDe(maison, { HOC_DEPOT_URL: hoc }), `${c}\n`);
  assert.match(r2.sortie, /^DEJA ssh$/m);
  assert.deepEqual(fs.readdirSync(t).filter((n) => n.startsWith("livraison.")), []);
});

test("livraison.sh : code abîmé = rien posé ; clé manquante dite ; dépôt qui refuse la clé = CLE_REFUSEE ssh", () => {
  const t = tmp();
  const maison = path.join(t, "maison");
  fs.mkdirSync(maison);
  const c = code(t, ["zernio"]);
  let r = lance(path.join(INST, "livraison.sh"), ["--stdin"], envDe(maison, { HOC_DEPOT_URL: path.join(t, "absent.git") }), c.slice(0, 200));
  assert.match(r.sortie, /^LIVRAISON_ABANDON code illisible/m);
  assert.ok(!fs.existsSync(path.join(maison, ".montage-yoan/config")));
  assert.ok(!fs.existsSync(path.join(maison, ".ssh")));
  r = lance(path.join(INST, "livraison.sh"), ["--stdin"], envDe(maison, { HOC_DEPOT_URL: path.join(t, "absent.git") }), c);
  assert.match(r.sortie, /^LIVRAISON_MANQUE zernio$/m);
  assert.match(r.sortie, /^CLE_REFUSEE ssh /m);
  assert.match(r.sortie, /^LIVRAISON_FIN ok=\d manque=zernio refusees=ssh$/m);
  assert.ok(!fs.existsSync(path.join(maison, ".montage-yoan/zernio.env")));
});

// ------------------------------------------------------------------ connexion de Claude
function fauxClaude(maison, { accepter = null, sortie = null } = {}) {
  const bin = path.join(maison, ".local/bin");
  fs.mkdirSync(bin, { recursive: true });
  fs.copyFileSync(path.join(FIX, "faux-claude-setup-token.sh"), path.join(bin, "claude"));
  fs.chmodSync(path.join(bin, "claude"), 0o755);
  fs.copyFileSync(path.join(FIX, "setup-token-debut.log"), path.join(bin, "setup-token-debut.log"));
  if (accepter !== null) fs.writeFileSync(path.join(bin, "claude.accepter"), String(accepter));
  if (sortie) fs.writeFileSync(path.join(bin, "claude.sortie"), sortie);
  return bin;
}
const JETON_FAUX = "sk-ant-oat01-FAUXjetonDEssai0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJ_-0123456789abcdefghijklmnopqrstuv-AAAA";
function restants(maison) {
  const r = spawnSync("/bin/ps", ["-axo", "pid=,command="], { encoding: "utf8" });
  return r.stdout.split("\n").filter((l) => l.includes(maison) && /setup-token|sleep 3600|script -q/.test(l));
}

test("connexion_lire.py : la vraie sortie de claude setup-token (avant l'acceptation) = ATTENTE, aucun jeton", () => {
  const r = spawnSync("/usr/bin/python3", ["-I", path.join(INST, "connexion_lire.py"), "etat", path.join(FIX, "setup-token-debut.log")], { encoding: "utf8" });
  assert.equal(r.stdout.trim(), "ATTENTE");
  const j = spawnSync("/usr/bin/python3", ["-I", path.join(INST, "connexion_lire.py"), "jeton", path.join(FIX, "setup-token-debut.log")], { encoding: "utf8" });
  assert.equal(j.status, 1);
  assert.equal(j.stdout, "");
});

test("connexion-claude.sh : Accepter dans le navigateur = jeton lu dans le pseudo-terminal, posé (600) et vérifié, jamais affiché", () => {
  const t = tmp();
  const maison = path.join(t, "maison");
  fauxClaude(maison, { accepter: 1 });
  const nav = path.join(t, "nav.sh");
  fs.writeFileSync(nav, `#!/bin/bash\necho "$1" >> ${t}/ouvert.txt\n`, { mode: 0o755 });
  const env = envDe(maison, { CONNEXION_NAVIGATEUR: nav, CLAUDE_CODE_OAUTH_TOKEN: "sk-ant-oat01-JETONdeLaCONVERSATIONquiNeDoitPasServir000000" });
  const r = lance(path.join(INST, "connexion-claude.sh"), [], env);
  assert.match(r.sortie, /^CONNEXION_OK$/m, r.sortie);
  assert.match(r.sortie, /^CLE_OK claude$/m);
  assert.doesNotMatch(r.sortie, /sk-ant-oat01-[A-Za-z]/);
  assert.match(fs.readFileSync(path.join(t, "ouvert.txt"), "utf8"), /oauth\/authorize/);
  const env2 = path.join(maison, ".montage-yoan/claude.env");
  assert.equal(fs.readFileSync(env2, "utf8"), `CLAUDE_CODE_OAUTH_TOKEN=${JETON_FAUX}\n`);
  assert.equal(mode(env2), "600");
  assert.ok(fs.existsSync(path.join(maison, ".montage-yoan/connexion-claude.json")));
  assert.deepEqual(restants(maison), []);
  assert.deepEqual(fs.readdirSync(maison).filter((n) => n.startsWith("connexion-claude.")), [], "dossier privé laissé");
  // Déjà connecté : rien n'est relancé.
  const r2 = lance(path.join(INST, "connexion-claude.sh"), [], env);
  assert.match(r2.sortie, /^CONNEXION_DEJA$/m);
});

test("connexion-claude.sh : personne n'accepte = CONNEXION_DELAI ; échange refusé = CONNEXION_ECHEC ; rien ne reste", () => {
  const t = tmp();
  const m1 = path.join(t, "m1");
  fauxClaude(m1);
  const nav = path.join(t, "nav.sh");
  fs.writeFileSync(nav, "#!/bin/bash\nexit 0\n", { mode: 0o755 });
  let r = lance(path.join(INST, "connexion-claude.sh"), ["--delai", "3"], envDe(m1, { CONNEXION_NAVIGATEUR: nav }));
  assert.match(r.sortie, /^CONNEXION_DELAI$/m, r.sortie);
  assert.ok(!fs.existsSync(path.join(m1, ".montage-yoan/claude.env")));
  assert.deepEqual(restants(m1), []);
  const m2 = path.join(t, "m2");
  fauxClaude(m2, { accepter: 1, sortie: "erreur" });
  r = lance(path.join(INST, "connexion-claude.sh"), [], envDe(m2, { CONNEXION_NAVIGATEUR: nav }));
  assert.match(r.sortie, /^CONNEXION_ECHEC échange du code refusé/m, r.sortie);
  assert.deepEqual(restants(m2), []);
});

// ------------------------------------------------------------------ disque externe et appareil, sans question
function installerStudio(maison, volumes, confAvant) {
  const env = envDe(maison, { STUDIO_VOLUMES: volumes, HOC_DEPOT_URL: path.join(maison, "absent.git") });
  if (confAvant) {
    fs.mkdirSync(path.join(maison, ".montage-yoan/studio"), { recursive: true });
    fs.writeFileSync(path.join(maison, ".montage-yoan/studio/studio.config.json"), JSON.stringify(confAvant));
  }
  const r = lance(path.join(INST, "studio.sh"), ["installer"], env);
  return { r, conf: JSON.parse(fs.readFileSync(path.join(maison, ".montage-yoan/studio/studio.config.json"), "utf8")) };
}
function volumes(d, disques) {
  fs.mkdirSync(d, { recursive: true });
  for (const [n, genre] of Object.entries(disques)) { fs.mkdirSync(path.join(d, n)); fs.writeFileSync(path.join(d, `${n}.disque`), genre); }
  return d;
}

test("studio.sh : un seul disque externe branché est retenu, sinon aucun ; image disque ignorée ; appareil iPhone", () => {
  const t = tmp();
  let v = volumes(path.join(t, "v1"), { "Disque Romain": "externe", Claude: "image", "Macintosh HD": "interne", TM: "sauvegarde" });
  let { r, conf } = installerStudio(path.join(t, "m1"), v);
  assert.match(r.sortie, /INSTALLE studio-disque disque externe retenu : Disque Romain/, r.sortie);
  assert.equal(conf.disque_externe, path.join(v, "Disque Romain"));
  assert.equal(conf.appareil, "iPhone");
  v = volumes(path.join(t, "v2"), { A: "externe", B: "externe" });
  ({ r, conf } = installerStudio(path.join(t, "m2"), v));
  assert.match(r.sortie, /OK studio-disque 2 disques externes branchés, aucun choisi/);
  assert.equal(conf.disque_externe, null);
  v = volumes(path.join(t, "v3"), { Claude: "image" });
  ({ r, conf } = installerStudio(path.join(t, "m3"), v));
  assert.match(r.sortie, /OK studio-disque aucun disque externe branché/);
  assert.equal(conf.disque_externe, null);
  // Réglages déjà posés : jamais remplacés.
  v = volumes(path.join(t, "v4"), { Nouveau: "externe" });
  const ex = JSON.parse(fs.readFileSync(path.join(DEPOT, "studio/studio.config.exemple.json"), "utf8"));
  ({ r, conf } = installerStudio(path.join(t, "m4"), v, { ...ex, disque_externe: "/Volumes/Ancien", appareil: "iPhone 15 Pro" }));
  assert.equal(conf.disque_externe, "/Volumes/Ancien");
  assert.equal(conf.appareil, "iPhone 15 Pro");
});

// ------------------------------------------------------------------ Sovo
function journalSovo(f, blocs) {
  fs.writeFileSync(f, blocs.map(([quand, lignes]) => `\n===== Sovo launched ${quand} +0000 =====\n${lignes.join("\n")}\n[Transcription] Done in 2.00s (0.4x RTF) → texte dicté privé`).join("\n"));
}
const etatSovo = (f, depuis) => spawnSync("/usr/bin/python3", ["-I", path.join(INST, "sovo_etat.py"), f, ...(depuis ? [String(depuis)] : [])], { encoding: "utf8" }).stdout.trim();

test("sovo_etat.py : autorisations lues dans le dernier lancement de Sovo, jamais le texte dicté", () => {
  const t = tmp();
  const f = path.join(t, "Sovo.log");
  journalSovo(f, [
    ["2026-11-18 10:00:00", ["[Hotkey] Input Monitoring not granted — requesting", "[Hotkey] register() — accessibility granted at startup: false", "[Audio] Requesting mic access…", "[Audio] Mic access denied"]],
  ]);
  assert.equal(etatSovo(f), "SOVO_ETAT lance=1 micro=refuse accessibilite=non surveillance=non lancement=2026-11-18T10:00:00");
  journalSovo(f, [
    ["2026-11-18 10:00:00", ["[Hotkey] Input Monitoring not granted — requesting", "[Hotkey] register() — accessibility granted at startup: false", "[Hotkey] Accessibility granted after 12s polling", "[Audio] Mic access granted"]],
  ]);
  assert.match(etatSovo(f), /micro=oui accessibilite=oui surveillance=non/);
  journalSovo(f, [
    ["2026-11-18 10:00:00", ["[Hotkey] Input Monitoring not granted — requesting"]],
    ["2026-11-18 10:05:00", ["[Hotkey] register() — accessibility granted at startup: true", "[Hotkey] Fn key listener active", "[Audio] Mic access already authorized"]],
  ]);
  const e = etatSovo(f);
  assert.match(e, /lance=1 micro=oui accessibilite=oui surveillance=oui/);
  assert.doesNotMatch(e, /dicté/);
  // Un lancement plus ancien que l'installation ne compte pas.
  assert.match(etatSovo(f, Date.parse("2026-11-18T11:00:00Z") / 1000), /^SOVO_ETAT lance=0/);
  assert.match(etatSovo(path.join(t, "absent.log")), /^SOVO_ETAT lance=0/);
});

const ZIP_SOVO = "/Users/yoanmottier/Workspace Claude Code/execution/sovo/Sovo-1.1.zip";
test("sovo.sh installer : version publiée vérifiée (sha256, signature), posée sans quarantaine, Fn sur « Ne rien faire »", { skip: !fs.existsSync(ZIP_SOVO) && "zip de Sovo absent" }, () => {
  const t = tmp();
  const zip = path.join(t, "Sovo-1.1.zip");
  fs.copyFileSync(ZIP_SOVO, zip);
  execFileSync("xattr", ["-w", "com.apple.quarantine", "0081;00000000;Essai;", zip]);
  const applis = path.join(t, "Applications");
  const fn = path.join(t, "fn.plist");
  execFileSync("/usr/bin/defaults", ["write", fn, "AppleFnUsageType", "-int", "2"]);
  const journal = path.join(t, "Sovo.log");
  const lanceur = path.join(t, "lancer.sh");
  // « Lancer » Sovo pendant l'essai = écrire un lancement dans son journal, comme lui (autorisations pas encore données).
  fs.writeFileSync(lanceur, `#!/bin/bash\nprintf '\\n===== Sovo launched %s +0000 =====\\n[Hotkey] Input Monitoring not granted — requesting\\n[Hotkey] register() — accessibility granted at startup: false\\n[Audio] Requesting mic access…\\n' "$(date -u '+%Y-%m-%d %H:%M:%S')" >> ${journal}\n`, { mode: 0o755 });
  const env = envDe(t, { SOVO_URL: `file://${zip}`, SOVO_APPLIS: applis, SOVO_FN_DOMAINE: fn, SOVO_JOURNAL: journal, SOVO_LANCER: lanceur, SOVO_SANS_LANCEMENT: "" });
  delete env.https_proxy; delete env.HTTPS_PROXY; delete env.http_proxy;
  // Le faux lanceur remplace open : SOVO_SANS_LANCEMENT vide, et aucun vrai réglage ouvert (open neutralisé dans PATH).
  const bin = path.join(t, "bin"); fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "open"), `#!/bin/bash\necho "$@" >> ${t}/reglages.txt\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, "osascript"), "#!/bin/bash\nexit 0\n", { mode: 0o755 });
  fs.writeFileSync(path.join(bin, "pgrep"), "#!/bin/bash\nexit 1\n", { mode: 0o755 });
  env.PATH = `${bin}:${env.PATH}`;
  const s = fs.readFileSync(path.join(INST, "sovo.sh"), "utf8").replace(/\/usr\/bin\/open/g, "open");
  const script = path.join(t, "sovo.sh");
  fs.writeFileSync(script, s);
  for (const f of ["sovo_etat.py"]) fs.copyFileSync(path.join(INST, f), path.join(t, f));
  let r = lance(script, ["installer"], env);
  assert.match(r.sortie, /^INSTALLE sovo 1\.1 dans /m, r.sortie);
  assert.match(r.sortie, /^INSTALLE sovo-fn touche Fn réglée sur « Ne rien faire » \(avant : 2\)/m);
  assert.equal(execFileSync("/usr/bin/defaults", ["read", fn, "AppleFnUsageType"], { encoding: "utf8" }).trim(), "0");
  assert.match(r.sortie, /^SOVO_ETAT lance=1 micro=non accessibilite=non surveillance=non/m);
  assert.match(fs.readFileSync(path.join(t, "reglages.txt"), "utf8"), /Privacy_Accessibility/);
  const app = path.join(applis, "Sovo.app");
  assert.equal(spawnSync("xattr", ["-p", "com.apple.quarantine", app]).status, 1, "quarantaine restée");
  assert.equal(spawnSync("codesign", ["--verify", "--deep", "--strict", app]).status, 0);
  // Relancé : déjà là, rien de retéléchargé.
  r = lance(script, ["installer"], env);
  assert.match(r.sortie, /^OK sovo version 1\.1 déjà installée/m);
  assert.match(r.sortie, /^OK sovo-fn /m);
  // Fichier différent de la version publiée : refusé, l'appli en place n'est pas touchée.
  fs.rmSync(app, { recursive: true });
  r = lance(script, ["installer"], { ...env, SOVO_SHA256: "0".repeat(64) });
  assert.match(r.sortie, /^ECHEC sovo : fichier téléchargé différent de la version publiée/m);
  assert.ok(!fs.existsSync(app));
});
