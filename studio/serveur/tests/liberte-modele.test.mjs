// Liberté des agents et modèle par client (19/11/2026). Modèle : fixé par le fichier du client (« claude »), utilisé
// quand studio.config.json n'en fixe pas ; Romain n'en fixe aucun (comportement d'avant). Liberté : écriture dans tout
// le dossier des médias, le monteur aussi dans les contenus du head of content ; le code du studio, ses réglages et
// les consignes restent fermés en écriture. Tout tourne dans des dossiers temporaires.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.STUDIO_CLIENT = "yoan";
const { chargerClient } = await import("../client.mjs");
const { chargerConfig, defautsDuClient, modelesDuClient } = await import("../config.mjs");
const { reglagesChat, refusCommuns, consigneStudio } = await import("../reglages.mjs");

const arg = (r, nom) => r.args[r.args.indexOf(nom) + 1];
const addDirs = (r) => r.args.flatMap((x, i) => (r.args[i - 1] === "--add-dir" ? [x] : []));

function configAvec(id, fichier) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), `liberte-${id}-`));
  if (fichier) fs.writeFileSync(path.join(home, "studio.config.json"), JSON.stringify(fichier));
  try {
    return chargerConfig({ home, env: { ...process.env, STUDIO_CLIENT: id, STUDIO_PORT: "" } });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}

test("modèle : Yoan sur opus partout par son fichier de client, Romain sur opus aussi (lot 12)", () => {
  const y = chargerClient({ id: "yoan" });
  assert.deepEqual(modelesDuClient(y), { modele: "opus", modele_rangement: "opus", modele_sous_agents: "opus" });
  assert.deepEqual(defautsDuClient(y).claude, { modele: "opus", modele_rangement: "opus", modele_sous_agents: "opus" });
  for (const id of ["romain", "romain-test"]) {
    const c = chargerClient({ id });
    assert.deepEqual(modelesDuClient(c), { modele: "opus", modele_sous_agents: "opus" }, id);
    assert.deepEqual(defautsDuClient(c).claude, { modele: "opus", modele_sous_agents: "opus" }, id);
  }
  // Config neuve, config qui ne fixe rien (null, valeurs de l'exemple), config qui fixe un modèle.
  assert.equal(configAvec("yoan").claude.modele, "opus");
  assert.equal(configAvec("yoan", { claude: { binaire: "claude", modele: null } }).claude.modele, "opus");
  assert.equal(configAvec("yoan", { claude: { modele: "sonnet" } }).claude.modele, "sonnet");
  assert.equal(configAvec("yoan").claude.modeleSousAgents, "opus");
  assert.equal(configAvec("romain").claude.modele, "opus");
  assert.equal(configAvec("romain").claude.modeleSousAgents, "opus");
});

test("modèle : --model et modèle des sous-agents passés aux sessions de Yoan, rien chez Romain", () => {
  const base = { depot: "/tmp/depot", media: "/tmp/media", skills: "/tmp/skills", agents: {} };
  const y = { ...base, client: chargerClient({ id: "yoan" }), claude: { modele: "opus", modeleSousAgents: "opus" } };
  for (const id of ["general", "un-reel:hoc", "un-reel:monteur", "tournage:2026-11-19-1200"]) {
    const r = reglagesChat(id, y);
    assert.equal(arg(r, "--model"), "opus", id);
    assert.equal(r.env.CLAUDE_CODE_SUBAGENT_MODEL, "opus", id);
  }
  // Sans modèle fixé, rien n'est forcé ; Romain a le sien par son fichier de client (opus, lot 12).
  const sans = reglagesChat("un-reel:monteur", { ...base, client: chargerClient({ id: "romain" }), claude: { modele: null } });
  assert.ok(!sans.args.includes("--model"));
  assert.equal(sans.env.CLAUDE_CODE_SUBAGENT_MODEL, undefined);
  const r = reglagesChat("un-reel:monteur", { ...base, client: chargerClient({ id: "romain" }), claude: { modele: "opus", modeleSousAgents: "opus" } });
  assert.equal(arg(r, "--model"), "opus");
  assert.equal(r.env.CLAUDE_CODE_SUBAGENT_MODEL, "opus");
});

test("liberté : écriture dans les médias pour toutes les sessions, contenus du head of content pour le monteur", () => {
  for (const id of ["yoan", "romain"]) {
    const config = { client: chargerClient({ id }), depot: "/tmp/depot", media: "/tmp/media", skills: "/tmp/skills", agents: {} };
    const g = reglagesChat("general", config);
    assert.match(arg(g, "--allowedTools"), /Edit\(\/\/tmp\/media\/\*\*\) Write\(\/\/tmp\/media\/\*\*\)/);
    assert.deepEqual(addDirs(g), ["/tmp/media"]);
    assert.equal(g.env.STUDIO_MEDIA, "/tmp/media");
    const m = reglagesChat("un-reel:monteur", config);
    const am = arg(m, "--allowedTools");
    assert.match(am, /Edit\(\/\/tmp\/media\/\*\*\)/);
    assert.match(am, /Write\(\/\/tmp\/depot\/contenus\/\*\*\)/);
    assert.ok(!/Edit\(\/\/tmp\/depot\/\*\*\)/.test(am), "le monteur n'écrit pas tout le dépôt");
    assert.deepEqual(addDirs(m), ["/tmp/skills", "/tmp/media", "/tmp/depot/contenus"]);
    assert.equal(m.env.STUDIO_DEPOT, "/tmp/depot");
    assert.ok(!/(^| )(Edit|Write)( |$)/.test(am), "jamais d'écriture sans borne");
  }
});

test("garde-fous : code du studio, réglages, consignes et publication fermés, chez les deux clients", () => {
  const ry = refusCommuns(chargerClient({ id: "yoan" }));
  for (const x of [
    "Edit(//Users/Shared/studio-yoan/montage-demo/**)", "Write(//Users/Shared/studio-yoan/montage-demo/**)",
    "Edit(//Users/Shared/studio-yoan/studio/studio.config.json)", "Edit(//Users/Shared/studio-yoan/client.json)",
    "Edit(//Users/Shared/studio-yoan/claude/agents/**)", "Edit(//Users/Shared/studio-yoan/claude/skills/**)",
    "Bash(*ZERNIO_ECRITURE*)", "Bash(*zernio.py publier*--envoyer*)", "Bash(sudo *)", "Bash(launchctl *)",
    "Bash(security *)", "Bash(defaults write*)", "Bash(git push --force*)", "Read(//Users/Shared/studio-yoan/*.env)",
  ]) assert.ok(ry.includes(x), x);
  // Les scripts des skills (reliés depuis montage-demo) se lancent toujours : aucun refus Bash sur le code.
  assert.ok(!ry.some((x) => x.startsWith("Bash(") && x.includes("montage-demo")));
  const rr = refusCommuns(chargerClient({ id: "romain" }));
  for (const x of ["Edit(~/.montage-yoan/montage-demo/**)", "Write(~/.montage-yoan/montage-demo/**)",
    "Edit(~/.montage-yoan/studio/studio.config.json)", "Edit(~/.claude/agents/**)", "Bash(*ZERNIO_ECRITURE_ROMAIN*)"]) {
    assert.ok(rr.includes(x), x);
  }
  assert.ok(!rr.some((x) => x.includes("/Users/Shared")));
});

test("garde-fous : le head of content ne réécrit ni ses consignes ni les outils dont le studio dépend", () => {
  const config = { client: chargerClient({ id: "yoan" }), depot: "/tmp/depot", media: "/tmp/media", agents: {} };
  const refus = JSON.parse(arg(reglagesChat("general", config), "--settings")).permissions.deny;
  for (const f of ["CLAUDE.md", ".claude/settings.json", ".claude/agents/**", ".claude/skills/*/SKILL.md", "outils/**"]) {
    assert.ok(refus.includes(`Edit(//tmp/depot/${f})`), f);
    assert.ok(refus.includes(`Write(//tmp/depot/${f})`), f);
  }
  // La calibration du débit (références des skills) et les contenus restent ouverts.
  assert.ok(!refus.some((x) => x.includes("references") || x.includes("contenus")));
});

test("consigne du studio : on fait ce qui est demandé, le studio se change ailleurs, sans tiret long", () => {
  const y = consigneStudio("Yoan", "Yoan");
  const r = consigneStudio("Romain", "Yoan");
  for (const c of [y, r]) {
    assert.match(c, /ce n'est jamais une limite/);
    assert.match(c, /un plan en plus de ceux du brief/);
    assert.match(c, /rien ne part sur Instagram ni sur TikTok depuis ce chat/);
    assert.match(c, /ni le studio lui-même/);
    assert.ok(!c.includes("\u2014"));
    // Lot 12, dernière passe : fichiers fabriqués rangés dans le studio, état relu, français entre deux étapes.
    assert.match(c, /Autres fichiers/);
    assert.match(c, /\$STUDIO_MEDIA/);
    assert.match(c, /Jamais sur le Bureau/);
    assert.match(c, /relis l'état par tes outils/);
    assert.match(c, /Écris toujours en français/);
  }
  assert.match(y, /en dehors du studio/);
  assert.match(r, /ça se voit avec Yoan/);
  assert.match(r, /jamais de visage ni de voix de Romain fabriqués/);
});

test("agents monteurs : la demande passe avant le déroulé, plans hors brief permis, garde-fous dits", () => {
  const AGENTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "agents");
  for (const f of ["monteur.md", "monteur-yoan.md"]) {
    const t = fs.readFileSync(path.join(AGENTS, f), "utf8");
    assert.match(t, /## Ce qu'il te demande passe avant le déroulé/, f);
    assert.match(t, /Des plans qui ne sont pas dans le brief/, f);
    assert.match(t, /ce n'est jamais une limite/, f);
    assert.match(t, /rien ne part sur Instagram ni sur TikTok depuis ce chat/, f);
    assert.ok(!/Jamais de B-roll généré par IA\*\*|Jamais d'image générée par IA\*\*/.test(t), f);
    assert.ok(!t.includes("\u2014"), f);
  }
});
