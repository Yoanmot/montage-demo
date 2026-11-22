// Retirer un plan du brief (Yoan, 22/11/2026 : « je ne peux pas supprimer un b-roll »). La lecture des plans tient
// quand une ligne part, revient, se déplace ou laisse une ligne vide ; le bouton « Retirer » passe par l'outil du dépôt ;
// un plan de tournage déjà écrit ne demande plus le plan retiré ; un plan déjà filmé ne se retire plus.
//
// Le parcours complet avec les vrais outils du head of content tourne quand STUDIO_HOC_OUTILS donne leur dossier
// (outils/ d'un dépôt du head of content) ; sans lui, il est sauté.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { demarrer } from "../studio.mjs";
import { monde, depotGit } from "./aide.mjs";
import { plansDuScript, prisesEffectives, plansRetires } from "../../rangement/lib/galerie.mjs";
import { briefDe } from "../lecture.mjs";
import { bulles, verifierArrivees, lireSuivi } from "../tournage.mjs";

const SLUG = "ton-site-sans-agence";
const LIGNES = [
  "- Vidéo, 4 s : ton écran, Claude Code qui s'ouvre ; serré sur l'écran. Pour « Étape un, tu vas sur Claude Code. »",
  "- Vidéo, 5 s : ton écran, la page d'inscription ; serré sur l'écran. Pour « Étape deux, tu t'inscris ».",
  "- Vidéo, 4 s : ton écran, la recherche d'un nom de domaine ; serré sur l'écran. Pour « tu l'achètes direct et tu le branches ».",
  "- Vidéo, 8 s : ton écran, tu colles un prompt, puis la page en ligne ; serré sur l'écran. Pour « tu regardes ton site se faire ».",
  "- Photo : une capture de ton site de ressources. Pour « le site où je mets mes ressources ».",
];
const script = (lignes) => `# Ton site\n\n- Format : face caméra\n- Durée estimée : ≈40 s\n\n## Texte complet\nÉtape un, tu vas sur Claude Code.\nÉtape deux, tu t'inscris.\n\n## Plans à tourner\n${lignes.join("\n")}\n\n## Légende\nTa légende\n`;
const PHRASES = ["Étape un, tu vas sur Claude Code.", "Étape deux, tu t'inscris.", "tu l'achètes direct et tu le branches.", "tu regardes ton site se faire"];
const PLAN = {
  version: 1, id: "2026-11-22-1940", cree_le: "2026-11-22T19:40:00+01:00", contenus: [SLUG], duree_estimee_min: 15,
  prises: [
    { n: 1, type: "face", contenus: [{ slug: SLUG, usages: [] }], lieu: "là où tu tournes d'habitude", materiel: [], ce_qu_on_voit: "toi", mouvements: [], duree_s: 40, deja_en_bibliotheque: null },
    { n: 2, type: "b-roll", contenus: [{ slug: SLUG, usages: PHRASES.map((phrase, i) => ({ mouvement: i + 1, phrase })) }], lieu: "ton bureau", materiel: ["ordinateur"],
      ce_qu_on_voit: "une seule prise, sans couper", mouvements: ["tu ouvres Claude Code", "tu t'inscris", "tu cherches un nom de domaine", "tu colles un prompt"], duree_s: 21, deja_en_bibliotheque: null },
    { n: 3, type: "photo", contenus: [{ slug: SLUG, usages: [] }], lieu: "ton ordinateur", materiel: [], ce_qu_on_voit: "une capture de ton site de ressources", mouvements: [], duree_s: 0, deja_en_bibliotheque: null },
  ],
};

let m, s, port, cookie;
const FAUX_OUTIL = `#!/usr/bin/env python3
import json, os, sys
with open(os.environ["FAUX_OUTILS_LOG"], "a") as f:
    f.write(json.dumps({"outil": os.path.basename(sys.argv[0]), "argv": sys.argv[1:]}) + "\\n")
print("OK plan retire slug=x n=1 type=b-roll empreinte=sha256:%s" % ("d" * 64))
# retirer-plan
`;
const LOG = () => { try { return fs.readFileSync(process.env.FAUX_OUTILS_LOG, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };

function requete(methode, chemin, corps) {
  return new Promise((resolve, reject) => {
    const data = corps === undefined ? null : JSON.stringify(corps);
    const req = http.request({ host: "127.0.0.1", port, method: methode, path: chemin, headers: {
      Host: `127.0.0.1:${port}`, Origin: `http://127.0.0.1:${port}`, ...(cookie ? { Cookie: cookie } : {}),
      ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}),
    } }, (res) => {
      const morceaux = [];
      res.on("data", (x) => morceaux.push(x));
      res.on("end", () => { const t = Buffer.concat(morceaux).toString("utf8"); let json = null; try { json = JSON.parse(t); } catch { /* texte */ } resolve({ statut: res.statusCode, json, texte: t }); });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function connecter(srv) {
  const r = await new Promise((ok, ko) => http.get({ host: "127.0.0.1", port: srv.config.port, path: `/?t=${srv.jeton}`, headers: { Host: `127.0.0.1:${srv.config.port}` } }, ok).on("error", ko));
  r.resume();
  return String(r.headers["set-cookie"]).split(";")[0];
}

before(async () => {
  m = monde();
  process.env.FAUX_CLAUDE_JOURNAL = m.journalClaude;
  process.env.FAUX_OUTILS_LOG = path.join(m.racine, "outils.jsonl");
  m.ecrire("depot/outils/brief.py", FAUX_OUTIL);
  m.contenu(SLUG, { titre: "Ton site sans agence" });
  m.ecrire(`depot/contenus/${SLUG}/script.md`, script(LIGNES));
  s = await demarrer({ env: m.env, silencieux: true });
  port = s.config.port;
  cookie = await connecter(s);
});
after(async () => { await s?.arreter("tests"); m?.nettoyer(); });

test("lecture des plans : numérotés comme l'outil, lignes vides et notes ignorées, ancien script lu", () => {
  const p = plansDuScript(script([LIGNES[0], "", "  ", "Une note sans plan", LIGNES[1], "* " + LIGNES[4].slice(2)]));
  assert.deepEqual(p.map((x) => [x.n, x.type]), [[1, "b-roll"], [2, "b-roll"], [3, "photo"]]);
  assert.equal(p[0].phrase, "Étape un, tu vas sur Claude Code.");
  assert.equal(p[1].duree_s, 5);
  const ancien = "# X\n\n## À filmer en plus\n(ce qui se filme en plus)\n- Vidéo, 3 s : ton bol. Pour « ton bol »\n\n## Photos à envoyer\n- toi en pompe\n- rien\n";
  assert.deepEqual(plansDuScript(ancien).map((x) => x.texte), ["Vidéo, 3 s : ton bol. Pour « ton bol »", "Photo : toi en pompe"]);
  const b = briefDe(m.config, SLUG, "reel");
  assert.equal(b.plans_liste.length, 5);
  assert.equal(b.plans_retirables, true, "l'outil du dépôt sait retirer un plan");
});

test("plan de tournage déjà écrit : le plan retiré n'est plus demandé, le reste du plan ne bouge pas", () => {
  const d = path.join(m.racine, "retire");
  const config = { ...m.config, depot: path.join(d, "depot"), media: path.join(d, "Contenu") };
  fs.mkdirSync(path.join(config.depot, "contenus", SLUG), { recursive: true });
  const ecrire = (lignes, retires) => {
    fs.writeFileSync(path.join(config.depot, "contenus", SLUG, "script.md"), script(lignes));
    fs.writeFileSync(path.join(config.depot, "contenus", SLUG, "stock-choix.json"), JSON.stringify({ version: 1, plans: {}, retires }));
  };
  const retire = (i, type = "b-roll") => ({ texte: LIGNES[i].slice(2), phrase: plansDuScript(script([LIGNES[i]]))[0].phrase, type, le: "2026-11-22T20:00:00+01:00" });
  // Le nom de domaine retiré : la prise fusionnée garde ses trois autres mouvements, renumérotés.
  ecrire([LIGNES[0], LIGNES[1], LIGNES[3], LIGNES[4]], [retire(2)]);
  let prises = prisesEffectives(config, PLAN);
  const b = prises.find((p) => p.n === 2);
  assert.deepEqual(b.mouvements, ["tu ouvres Claude Code", "tu t'inscris", "tu colles un prompt"]);
  assert.deepEqual(b.contenus[0].usages.map((u) => [u.mouvement, u.phrase]), [[1, PHRASES[0]], [2, PHRASES[1]], [3, PHRASES[3]]]);
  assert.equal(prises.length, 3);
  // La bulle du studio suit (une phrase et un geste de moins).
  const bl = bulles(config, PLAN, new Map([[SLUG, "Ton site"]])).find((x) => x.n === 2);
  assert.equal(bl.mouvements.length, 3);
  assert.ok(!bl.mouvements.some((x) => /domaine/.test(x.texte)));
  // Le plan remis dans le brief après coup : il est de nouveau demandé.
  ecrire(LIGNES, [retire(2)]);
  assert.deepEqual(plansRetires(config.depot, SLUG), []);
  assert.equal(prisesEffectives(config, PLAN).find((p) => p.n === 2).mouvements.length, 4);
  // Tous les plans de la prise et la photo retirés : la prise et la photo sortent du plan (plus rien d'attendu pour elles).
  ecrire([], [0, 1, 2, 3].map((i) => retire(i)).concat([retire(4, "photo")]));
  prises = prisesEffectives(config, PLAN);
  assert.deepEqual(prises.map((p) => p.n), [1]);
  const v = verifierArrivees({ ...config, arrivees: path.join(d, "arrivees") }, PLAN, lireSuivi(config, PLAN.id));
  assert.deepEqual(v.attendu, { videos: 1, photos: 0 });
  // Sans plan retiré noté : le plan tel qu'il est écrit.
  ecrire([LIGNES[0]], []);
  assert.equal(prisesEffectives(config, PLAN).find((p) => p.n === 2).mouvements.length, 4);
});

test("bouton « Retirer » : par l'outil du dépôt avec la ligne vue ; refusé si le plan a changé, s'il est filmé, après le tournage", async () => {
  const b = briefDe(m.config, SLUG, "reel");
  let r = await requete("POST", `/api/cartes/${SLUG}/plans/3/retirer`, { texte: b.plans_liste[2].texte, empreinte: b.empreinte });
  assert.equal(r.statut, 200, r.texte);
  assert.deepEqual(LOG().at(-1).argv, ["retirer-plan", SLUG, "3", "--texte", b.plans_liste[2].texte, "--empreinte", b.empreinte, "--pousser"]);
  // Le texte vu ne correspond plus à ce numéro : rien n'est lancé.
  const avant = LOG().length;
  r = await requete("POST", `/api/cartes/${SLUG}/plans/3/retirer`, { texte: "Vidéo, 1 s : un autre plan" });
  assert.deepEqual([r.statut, r.json.erreur], [409, "CHANGE"]);
  assert.equal((await requete("POST", `/api/cartes/${SLUG}/plans/x/retirer`, { texte: "a" })).statut, 400);
  // Plan de tournage écrit, la prise qui sert ce plan cochée : refusé (bouton et retouche à la main).
  m.json(`depot/tournages/${PLAN.id}.json`, PLAN);
  m.json(`studio/tournages/${PLAN.id}.json`, { version: 1, coches: [2], sautees: [], envoi: false });
  r = await requete("POST", `/api/cartes/${SLUG}/plans/3/retirer`, { texte: b.plans_liste[2].texte });
  assert.deepEqual([r.statut, r.json.erreur], [409, "DEJA_FILME"]);
  assert.match(r.json.message, /déjà filmé ce plan/);
  r = await requete("POST", `/api/cartes/${SLUG}/brief`, { plans: [LIGNES[0], LIGNES[1], LIGNES[3], LIGNES[4]].join("\n") });
  assert.deepEqual([r.statut, r.json.erreur], [409, "DEJA_FILME"]);
  // La photo n'est pas cochée : elle se retire encore ; une retouche qui garde tous les plans passe.
  r = await requete("POST", `/api/cartes/${SLUG}/plans/5/retirer`, { texte: b.plans_liste[4].texte });
  assert.equal(r.statut, 200, r.texte);
  r = await requete("POST", `/api/cartes/${SLUG}/brief`, { plans: LIGNES.join("\n\n") });
  assert.equal(r.statut, 200, r.texte);
  assert.equal(LOG().length, avant + 2);
  // Vidéo tournée : plus de retrait d'ici.
  m.ecrire(`Contenu/${SLUG}/face/IMG_1.MOV`, "v");
  r = await requete("POST", `/api/cartes/${SLUG}/plans/1/retirer`, { texte: b.plans_liste[0].texte });
  assert.deepEqual([r.statut, r.json.erreur], [409, "TROP_TARD"]);
  fs.rmSync(path.join(m.media, SLUG), { recursive: true });
  fs.rmSync(path.join(m.depot, "tournages"), { recursive: true });
  fs.rmSync(path.join(m.home, "tournages", `${PLAN.id}.json`));
});

const HOC = process.env.STUDIO_HOC_OUTILS;
test("parcours complet avec les vrais outils : ligne enlevée à la main puis bouton, plan de tournage juste", { skip: !HOC && "STUDIO_HOC_OUTILS absent" }, async () => {
  const w = monde();
  depotGit(w);
  fs.cpSync(HOC, path.join(w.depot, "outils"), { recursive: true, filter: (f) => !/__pycache__|\/tests(\/|$)/.test(f) });
  const client = path.join(HOC, "..", "client.json");   // les réglages du client du dépôt (absents chez le premier client)
  if (fs.existsSync(client)) fs.copyFileSync(client, path.join(w.depot, "client.json"));
  w.contenu(SLUG, { titre: "Ton site sans agence" });
  w.ecrire(`depot/contenus/${SLUG}/script.md`, script(LIGNES));
  const lus = plansDuScript(script(LIGNES));
  // Comparaison faite par le head of content, Galerie vide : tous à tourner.
  execFileSync("python3", [path.join(w.depot, "outils", "stock.py"), "plans", SLUG, "--depuis", "-"], { cwd: w.depot, env: { ...process.env, HOC_DEPOT: w.depot },
    input: JSON.stringify({ plans: lus.map((p) => ({ n: p.n, essentiel: ["un écran"], detail: [] })) }) });
  execFileSync("git", ["add", "-A"], { cwd: w.depot }); execFileSync("git", ["commit", "-qm", "brief"], { cwd: w.depot }); execFileSync("git", ["push", "-q"], { cwd: w.depot });
  const srv = await demarrer({ env: w.env, silencieux: true });
  try {
    const p0 = port, c0 = cookie;
    port = srv.config.port; cookie = await connecter(srv);
    try {
      // Comme Yoan : « Retoucher », la ligne du nom de domaine enlevée, une ligne vide à la place.
      let b = briefDe(w.config, SLUG, "reel");
      let r = await requete("POST", `/api/cartes/${SLUG}/brief`, { plans: [LIGNES[0], LIGNES[1], "", LIGNES[3], LIGNES[4]].join("\n"), empreinte: b.empreinte });
      assert.equal(r.statut, 200, r.texte);
      const nouveau = (args) => execFileSync("python3", [path.join(w.depot, "outils", "tournage.py"), ...args], { cwd: w.depot, env: { ...process.env, HOC_DEPOT: w.depot }, encoding: "utf8" });
      const sortie = nouveau(["nouveau", SLUG]);
      assert.match(sortie, /^OK id=/m, "plus de comparaison à refaire");
      assert.equal((sortie.match(/^A_TOURNER /gm) || []).length, 4);
      assert.doesNotMatch(sortie, /domaine/);
      // Le plan de tournage est écrit, puis Yoan retire un plan d'un clic : le plan de tournage ne le demande plus.
      w.json(`depot/tournages/${PLAN.id}.json`, PLAN);
      b = briefDe(w.config, SLUG, "reel");
      const premier = b.plans_liste[0];
      r = await requete("POST", `/api/cartes/${SLUG}/plans/1/retirer`, { texte: premier.texte, empreinte: b.empreinte });
      assert.equal(r.statut, 200, r.texte);
      b = briefDe(w.config, SLUG, "reel");
      assert.deepEqual(b.plans_liste.map((p) => p.n), [1, 2, 3]);
      assert.ok(!b.plans_liste.some((p) => p.texte === premier.texte));
      const t = (await requete("GET", `/api/tournages/${PLAN.id}`)).json;
      const br = t.bulles.find((x) => x.type === "b-roll");
      assert.deepEqual(br.mouvements.map((x) => x.texte), ["tu t'inscris", "tu colles un prompt"]);
      assert.match(nouveau(["nouveau", SLUG]), /^OK id=/m);
      // Tout est enregistré et poussé (le brief, la comparaison, les plans retirés).
      assert.equal(execFileSync("git", ["status", "--porcelain", "contenus"], { cwd: w.depot, encoding: "utf8" }).trim(), "");
    } finally { port = p0; cookie = c0; }
  } finally { await srv.arreter("tests"); w.nettoyer(); }
});
