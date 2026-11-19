// Studio de test de Romain sur le Mac de Yoan (romain-test) : les vrais chiffres d'Instagram en LECTURE, avec une clé à
// part (<racine>/zernio-lecture.env) donnée au seul appel `zernio.py stats`. La publication reste simulée. Faux zernio.py
// dans un dossier temporaire : aucun appel réseau, jamais la vraie racine de l'installation.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { monde } from "./aide.mjs";
import { chargerConfig, lectureDuClient } from "../config.mjs";
import { chargerClient } from "../client.mjs";
import { Stats, sourceStats, cleLecturePosee, fenetreSemaines } from "../stats.mjs";
import { configBrute } from "../publication.mjs";
import { refusCommuns } from "../reglages.mjs";
import { lancerZernio, argsLectureSeule, enSimulation } from "../../publication/publication.mjs";

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLE = "cle-de-lecture-de-test-123";
const EXEMPLE = { version: 1, compte: "fitavecromain", le: new Date().toISOString(), abonnes: 1850, publications: [], semaines: [] };

// Un monde de test réglé comme romain-test : simulation forcée, fichier de stats en repli, lecture par la clé à part.
function mondeEssai() {
  const m = monde();
  const log = path.join(m.racine, "zernio-appels.jsonl");
  m.ecrire("copie-mac/outils/zernio.py", `import json, os, sys
with open(${JSON.stringify(log)}, "a") as f:
    f.write(json.dumps({"argv": sys.argv[1:], "env_file": os.environ.get("ZERNIO_ENV_FILE"), "cle_env": bool(os.environ.get("ZERNIO_API_KEY")),
                        "ecriture": os.environ.get("ZERNIO_ECRITURE"), "ecriture_romain": os.environ.get("ZERNIO_ECRITURE_ROMAIN")}) + "\\n")
if "stats" in sys.argv:
    print(${JSON.stringify(JSON.stringify({ ...EXEMPLE, semaines: [] }))})
else:
    print("SIMULATION_OK")
`);
  m.json("stats-fichier.json", { ...EXEMPLE, abonnes: 1700, exemple: false });
  const cleFichier = path.join(m.racine, "zernio-lecture.env");
  // Ce que le service d'une installation d'essai pose (demarrer.sh) : simulation, aucune clé dans l'environnement.
  const env = { ...m.env, STUDIO_SIMULATION: "1", ZERNIO_ENV_FILE: "/dev/null", ZERNIO_API_KEY: "cle-qui-ne-doit-pas-passer" };
  const brut = JSON.parse(fs.readFileSync(path.join(m.home, "studio.config.json"), "utf8"));
  fs.writeFileSync(path.join(m.home, "studio.config.json"), JSON.stringify({ ...brut, stats: { fichier: path.join(m.racine, "stats-fichier.json") } }));
  const config = chargerConfig({ home: m.home, env });
  config.stats.lecture = { compte: "romain", cleFichier };
  const appels = () => (fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
  return { m, config, cleFichier, env, appels, poser: () => fs.writeFileSync(cleFichier, `ZERNIO_API_KEY=${CLE}\n`, { mode: 0o600 }) };
}

// lancerZernio lit process.env : on y pose ce que le service poserait, le temps du test.
async function avecEnv(env, f) {
  const avant = {};
  for (const k of ["STUDIO_SIMULATION", "ZERNIO_ENV_FILE", "ZERNIO_API_KEY"]) { avant[k] = process.env[k]; process.env[k] = env[k]; }
  try { return await f(); } finally {
    for (const [k, v] of Object.entries(avant)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
}

test("client : seul romain-test lit les vrais chiffres (compte romain, clé dans sa racine) ; rien pour yoan ni romain", () => {
  const essai = chargerClient({ id: "romain-test" });
  assert.deepEqual(lectureDuClient(essai), { compte: "romain", cleFichier: "/Users/Shared/studio-romain-test/zernio-lecture.env" });
  assert.equal(essai.zernio.compte, null); // aucun compte d'écriture : ZERNIO_ECRITURE ne peut pas être posé
  assert.equal(lectureDuClient(chargerClient({ id: "yoan" })), null);
  assert.equal(lectureDuClient(chargerClient({ id: "romain" })), null);
  // stats_reelles sans simulation forcée : ignoré (une vraie installation a sa clé de publication, pas celle-ci).
  assert.equal(lectureDuClient({ ...essai, simulation_forcee: false }), null);
  assert.equal(lectureDuClient({ ...essai, stats_reelles: { compte: "../x" } }), null);
  // Le compte nommé existe dans le zernio.py de Romain (COMPTES["romain"]) : vérifié par le test d'installation.
});

test("forme d'appel permise avec la clé de lecture : zernio.py stats en json vers la sortie, rien d'autre", () => {
  const sem = fenetreSemaines()[0];
  assert.equal(argsLectureSeule(["--compte", "romain", "stats", "--jours", "30", "--format", "json", "--sortie", "-"]), true);
  assert.equal(argsLectureSeule(["--compte", "romain", "stats", "--jours", "30", "--format", "json", "--sortie", "-", "--semaines-depuis", sem]), true);
  assert.equal(argsLectureSeule(["stats", "--format", "json", "--sortie", "-"]), true);
  for (const a of [
    ["--compte", "romain", "publier", "x", "--envoyer"], ["publier", "x", "--maintenant"], ["verifier", "x"], ["poser-mot", "x", "--ressource", "y", "--envoyer"],
    ["couper", "MOT"], ["attendre", "x"], ["mots"], ["etat"],
    ["stats", "--format", "json"], // sans --sortie - : écrirait publications/stats.md
    ["stats", "--format", "json", "--sortie", "fichier"], ["stats", "--format", "md", "--sortie", "-"],
    ["stats", "--format", "json", "--sortie", "-", "--envoyer", "1"], ["stats", "--format", "json", "--sortie", "-", "--format", "json"],
    ["--compte", "romain;x", "stats", "--format", "json", "--sortie", "-"], ["stats", "--format", "json", "--sortie", "-", "--jours"],
  ]) assert.equal(argsLectureSeule(a), false, a.join(" "));
});

test("sans clé de lecture : le fichier de stats, comme avant ; avec : Instagram, et la source qui change relit tout de suite", async () => {
  const e = mondeEssai();
  try {
    assert.equal(cleLecturePosee(e.config.stats.lecture), false);
    assert.equal(sourceStats(e.config), "fichier");
    const s = new Stats({ config: e.config });
    const v1 = await avecEnv(e.env, () => s.actualiser());
    assert.equal(v1.abonnes, 1700);
    assert.equal(e.appels().length, 0);
    assert.equal(s.perime(), false);
    fs.writeFileSync(e.cleFichier, "ZERNIO_API_KEY=\n");
    assert.equal(cleLecturePosee(e.config.stats.lecture), false); // ligne vide : pas une clé
    e.poser();
    assert.equal(cleLecturePosee(e.config.stats.lecture), true);
    assert.equal(sourceStats(e.config), "instagram");
    assert.equal(s.perime(), true); // cache lu du fichier : relu sans attendre 6 heures
  } finally { e.m.nettoyer(); }
});

test("avec la clé : zernio.py --compte romain stats, la clé passée par ZERNIO_ENV_FILE à ce seul appel, aucune écriture", async () => {
  const e = mondeEssai();
  try {
    e.poser();
    const v = await avecEnv(e.env, () => new Stats({ config: e.config }).actualiser());
    assert.equal(v.abonnes, 1850);
    assert.equal(v.source, "instagram");
    const [a] = e.appels();
    assert.deepEqual(a.argv.slice(0, 3), ["--compte", "romain", "stats"]);
    assert.ok(argsLectureSeule(a.argv), a.argv.join(" "));
    assert.equal(a.env_file, e.cleFichier);
    assert.equal(a.cle_env, false); // la variable de l'environnement est retirée : seule la clé du fichier lit
    assert.equal(a.ecriture, null);
    assert.equal(a.ecriture_romain, null);
    // Le cache ne garde jamais la clé.
    assert.ok(!fs.readFileSync(path.join(e.m.home, "stats", "cache.json"), "utf8").includes(CLE));
  } finally { e.m.nettoyer(); }
});

test("la clé de lecture est refusée à toute autre commande ; la publication reste simulée et ne la voit jamais", async () => {
  const e = mondeEssai();
  try {
    e.poser();
    const brut = configBrute(e.config);
    await avecEnv(e.env, async () => {
      // Simulation forcée : vraie quelle que soit la présence de la clé.
      assert.equal(e.config.simulation, true);
      assert.equal(enSimulation(brut), true);
      // Même demandé, un appel d'écriture avec la clé de lecture ne part pas (zernio.py n'est pas lancé).
      for (const args of [["--compte", "romain", "publier", "x", "--envoyer"], ["poser-mot", "x", "--ressource", "y", "--envoyer"], ["verifier", "x"]]) {
        const r = await lancerZernio(brut, args, { cleLecture: e.cleFichier });
        assert.equal(r.code, -1);
        assert.match(r.sortie, /LECTURE_REFUSEE/);
      }
      const statsEcriture = await lancerZernio(brut, ["stats", "--format", "json", "--sortie", "-"], { cleLecture: e.cleFichier, ecriture: true });
      assert.match(statsEcriture.sortie, /LECTURE_REFUSEE/);
      assert.equal(e.appels().length, 0);
      // Les appels de la publication (sans cleLecture) gardent l'environnement du service : ZERNIO_ENV_FILE=/dev/null.
      await lancerZernio(brut, ["verifier", "x"]);
      await lancerZernio(brut, ["publier", "x", "--quand", "2026-12-01 18:30"]);
      const vus = e.appels();
      assert.equal(vus.length, 2);
      for (const a of vus) {
        assert.equal(a.env_file, "/dev/null");
        assert.notEqual(a.env_file, e.cleFichier);
        assert.ok(!a.argv.includes("--envoyer"));
        assert.equal(a.ecriture, null);
        assert.equal(a.ecriture_romain, null);
      }
    });
  } finally { e.m.nettoyer(); }
});

test("seul stats.mjs donne la clé de lecture à zernio.py (aucun autre module du studio)", () => {
  const trouves = [];
  const parcourir = (d) => {
    for (const n of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, n.name);
      if (n.isDirectory()) { if (!["tests", "node_modules", "interface"].includes(n.name)) parcourir(p); continue; }
      const code = fs.readFileSync(p, "utf8").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
      if (n.name.endsWith(".mjs") && /cleLecture\s*:/.test(code)) trouves.push(path.relative(STUDIO, p));
    }
  };
  parcourir(STUDIO);
  assert.deepEqual(trouves.sort(), ["serveur/stats.mjs"]);
});

test("sessions Claude de romain-test : la clé de lecture ne passe par aucune commande ; rien ne change pour yoan ni romain", () => {
  const essai = refusCommuns(chargerClient({ id: "romain-test" }));
  for (const r of ["Bash(*zernio-lecture*)", "Bash(*ZERNIO_ENV_FILE*)", "Bash(*ZERNIO_API_KEY*)", "Read(//Users/Shared/studio-romain-test/*.env)"]) {
    assert.ok(essai.includes(r), r);
  }
  for (const id of ["yoan", "romain"]) {
    const l = refusCommuns(chargerClient({ id }));
    assert.ok(!l.some((r) => /zernio-lecture|ZERNIO_ENV_FILE|ZERNIO_API_KEY/.test(r)), id);
  }
});
