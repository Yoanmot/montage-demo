import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pont } from "../pont.mjs";
import { File, messageAction, chatDeAction } from "../file.mjs";
import { lireJson } from "../outils.mjs";
import { monde, attendreQue, ICI } from "./aide.mjs";

const mondes = [];
after(() => mondes.forEach((m) => m.nettoyer()));

function installer(m, env = {}) {
  const pont = new Pont({ config: m.config, envBase: { ...m.env, ...env } });
  const avant = [];
  const file = new File({ config: m.config, pont, avant: async (a) => { avant.push(a.id); } }).charger();
  return { pont, file, avant };
}

test("script : « fini » seulement quand le fichier attendu est écrit", async () => {
  const m = monde();
  mondes.push(m);
  m.contenu("faim-a-16h");
  const { file, avant, pont } = installer(m, { FAUX_CLAUDE_ECRIT: "contenus/{slug}/script.md" });
  const { actions } = file.ajouter("script", ["faim-a-16h"]);
  await attendreQue(() => file.trouver(actions[0].id).statut === "fini");
  const a = file.trouver(actions[0].id);
  assert.equal(a.session, "faim-a-16h:hoc");
  assert.ok(a.debut && a.fin);
  assert.deepEqual(avant, [a.id], "synchro avant l'action");
  assert.ok(fs.existsSync(path.join(m.depot, "contenus", "faim-a-16h", "script.md")));
  assert.equal(pont.historique("faim-a-16h:hoc").at(-1).etat, "fini");
  const premier = m.lancements().find((x) => x.evenement === "message").texte;
  assert.match(premier, /contenus\/faim-a-16h\//);
  assert.equal(lireJson(path.join(m.home, "file.json")).actions[0].statut, "fini", "la file est un fichier");
});

test("script : sans fichier produit, l'action passe « à toi », puis repart quand Romain répond", async () => {
  const m = monde();
  mondes.push(m);
  m.contenu("dos-qui-tire");
  const { file, pont } = installer(m);
  const { actions } = file.ajouter("script", ["dos-qui-tire"]);
  await attendreQue(() => file.trouver(actions[0].id).statut === "a_toi");
  assert.equal(pont.historique("dos-qui-tire:hoc").at(-1).etat, "a_toi");
  // Romain répond ; cette fois le head of content écrit le script.
  pont.envBase = { ...pont.envBase, FAUX_CLAUDE_ECRIT: "contenus/dos-qui-tire/script.md" };
  file.repriseParRomain("dos-qui-tire:hoc");
  assert.equal(file.trouver(actions[0].id).statut, "en_cours");
  pont.envoyer("dos-qui-tire:hoc", { texte: "voilà ma réponse" });
  await attendreQue(() => file.trouver(actions[0].id).statut === "fini");
  const l = m.lancements().filter((x) => x.evenement === "lancement");
  assert.ok(l[1].argv.includes("--resume"), "la réponse reprend la même conversation");
});

test("parallélisme : une session à la fois par défaut, réglable", async () => {
  for (const parallele of [1, 2]) {
    const m = monde({ config: { sessions_en_parallele: parallele } });
    mondes.push(m);
    for (const s of ["un-a", "deux-b", "trois-c"]) m.contenu(s);
    const { file, pont } = installer(m, { FAUX_CLAUDE_SCENARIO: "lent", FAUX_CLAUDE_ATTENTE: "400" });
    let max = 0;
    pont.on("actives", (a) => { max = Math.max(max, a.length); });
    const { actions } = file.ajouter("script", ["un-a", "deux-b", "trois-c"]);
    await attendreQue(() => actions.every((a) => file.trouver(a.id).statut === "a_toi"), { delaiMs: 15000 });
    assert.equal(max, parallele, `au plus ${parallele} session(s) en même temps`);
  }
});

test("reprise au démarrage : une action coupée repart, une action dont le fichier existe est finie", async () => {
  const m = monde();
  mondes.push(m);
  m.contenu("coupe-a");
  m.contenu("ecrit-b");
  m.ecrire("depot/contenus/ecrit-b/script.md", "# fait\n");
  const debut = new Date(Date.now() - 1000).toISOString();
  m.json("studio/file.json", {
    version: 1,
    actions: [
      { id: "a-1", type: "script", slug: "coupe-a", lot: "l-1", statut: "en_cours", cree_le: debut, debut, fin: null, session: "coupe-a:hoc", erreur: null },
      { id: "a-2", type: "script", slug: "ecrit-b", lot: "l-1", statut: "en_cours", cree_le: debut, debut, fin: null, session: "ecrit-b:hoc", erreur: null },
      { id: "a-3", type: "rangement", lot: "l-2", statut: "en_cours", cree_le: debut, debut, fin: null, session: null, erreur: null },
    ],
  });
  m.json("studio/sessions.json", { "coupe-a:hoc": { session_id: "11111111-2222-3333-4444-555555555555", cwd: m.depot, agent: null, maj: debut } });
  const { file } = installer(m);
  assert.equal(file.trouver("a-2").statut, "fini");
  assert.equal(file.trouver("a-3").statut, "erreur");
  assert.equal(file.trouver("a-1").statut, "en_file");
  await file.tick();
  await attendreQue(() => file.trouver("a-1").statut === "a_toi");
  const l = m.lancements();
  const lance = l.find((x) => x.evenement === "lancement");
  assert.equal(lance.argv[lance.argv.indexOf("--resume") + 1], "11111111-2222-3333-4444-555555555555");
  assert.match(l.find((x) => x.evenement === "message").texte, /redémarré/);
});

test("arrêter : en file ou en cours, l'action passe « arrete »", async () => {
  const m = monde();
  mondes.push(m);
  m.contenu("un-a");
  m.contenu("deux-b");
  const { file } = installer(m, { FAUX_CLAUDE_SCENARIO: "lent" });
  const { actions } = file.ajouter("script", ["un-a", "deux-b"]);
  await attendreQue(() => file.trouver(actions[0].id).statut === "en_cours");
  file.arreter(actions[1].id);
  assert.equal(file.trouver(actions[1].id).statut, "arrete");
  file.arreter(actions[0].id);
  await attendreQue(() => file.trouver(actions[0].id).statut === "arrete");
});

test("tournage : une seule action pour plusieurs slugs, fini quand le plan les contient tous", async () => {
  const m = monde();
  mondes.push(m);
  m.contenu("un-a");
  m.contenu("deux-b");
  const { file } = installer(m, { FAUX_CLAUDE_ECRIT: "tournages/2026-11-16-1400.json" });
  const { actions } = file.ajouter("tournage", ["un-a", "deux-b"]);
  assert.equal(actions.length, 1);
  assert.equal(chatDeAction(actions[0]), `tournage:${actions[0].lot}`);
  // Le faux claude écrit un fichier vide : pas un plan qui contient les slugs, donc « à toi ».
  await attendreQue(() => file.trouver(actions[0].id).statut === "a_toi");
  assert.match(m.lancements().find((x) => x.evenement === "message").texte, /Prépare le tournage de : un-a/);
});

test("gabarits : montage et mise en page donnent au modèle ce qu'il lui faut", () => {
  const m = monde();
  mondes.push(m);
  m.contenu("faim-a-16h");
  m.ecrire("Contenu/faim-a-16h/face/IMG_1.mov", "v");
  m.ecrire("Contenu/faim-a-16h/b-roll/20261116-143012-kq3x.mov", "b");
  const t = messageAction({ type: "montage", slug: "faim-a-16h" }, m.config);
  assert.ok(!t.includes("<!--"), "le commentaire du gabarit est retiré");
  assert.match(t, /IMG_1\.mov/);
  assert.match(t, /^- .*20261116-143012-kq3x\.mov$/m);
  assert.ok(!/\{\{\w+\}\}/.test(t), "toutes les variables sont remplies");
  assert.ok(t.includes(path.join(m.depot, "contenus", "faim-a-16h", "script.md")));
  m.contenu("car-a", { format: "carrousel" });
  m.ecrire("depot/a-rendre/carrousels/car-a.md", "# Car\n");
  const mp = messageAction({ type: "mise_en_page", slug: "car-a" }, m.config);
  assert.ok(mp.includes(path.join(m.depot, "a-rendre", "carrousels", "car-a.md")));
  assert.match(mp, /- aucune/);
  assert.ok(mp.includes(`${m.config.skills}/carrousels-en-attente/SKILL.md`));
  assert.ok(!/\{\{\w+\}\}/.test(mp) && !mp.includes("<!--"));
  // Le style se choisit à la mise en page (2026-11-20) : une seule question courte avant les photos, le texte
  // jamais changé sans son accord, une version raccourcie revalidée par le circuit habituel.
  assert.match(mp, /« Je pars sur <style proposé> en\s+<format>, ou tu en veux un autre \? »/);
  assert.ok(mp.indexOf("Le style, avant tout le reste") < mp.indexOf("Les photos :"), "le style avant les photos");
  assert.match(mp, /n'a qu'une seule mise en page/);
  assert.match(mp, /déjà dit son style/);
  assert.match(mp, /sans son\s+accord, son texte ne change pas/);
  assert.ok(mp.includes("python3 outils/etat.py valider car-a --pousser"));
  assert.ok(!/style et\s+format sont déjà choisis/.test(mp));
  assert.match(messageAction({ type: "script", slug: "car-a" }, m.config), /contenus\/car-a\/carrousel\.md/);
  for (const g of fs.readdirSync(path.join(ICI, "..", "gabarits"))) {
    assert.ok(!fs.readFileSync(path.join(ICI, "..", "gabarits", g), "utf8").includes(String.fromCharCode(0x2014)), g);
  }
});

test("une action « à toi » relancée par une autre : finie quand la seconde produit le fichier attendu", async () => {
  const m = monde();
  mondes.push(m);
  m.contenu("dos-qui-tire");
  const { file, pont } = installer(m);
  const premiere = file.ajouter("script", ["dos-qui-tire"]).actions[0];
  await attendreQue(() => file.trouver(premiere.id).statut === "a_toi");
  pont.envBase = { ...pont.envBase, FAUX_CLAUDE_ECRIT: "contenus/dos-qui-tire/script.md" };
  const seconde = file.ajouter("script", ["dos-qui-tire"]).actions[0];
  await attendreQue(() => file.trouver(seconde.id).statut === "fini");
  assert.equal(file.trouver(premiere.id).statut, "fini", "plus rien « à toi » pour ce contenu");
  // et au redémarrage, une « à toi » déjà satisfaite se ferme aussi
  const d = lireJson(path.join(m.home, "file.json"));
  d.actions.find((a) => a.id === premiere.id).statut = "a_toi";
  fs.writeFileSync(path.join(m.home, "file.json"), JSON.stringify(d));
  const { file: f2 } = installer(m);
  assert.equal(f2.trouver(premiere.id).statut, "fini");
});
