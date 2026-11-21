// Chasse aux bugs de la Galerie (2026-11-21, avant la livraison à Romain) : chaque test reproduit un défaut trouvé en
// lisant le code ou en essayant le studio, et échouait avant son correctif (rapport : rapports/chasse-bugs-galerie.md
// du studio de Yoan). Le stock face au plan de tournage, les plans d'un autre brief, les choix du client quand le brief
// change, les arrivées d'un tournage, la description retouchée, le fichier partagé par lien physique.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { monde } from "./aide.mjs";
import * as G from "../../rangement/lib/galerie.mjs";
const { Galerie, plansEffectifs, ecart, bloquantsSuppression, ecrireChoixPlan } = G;
const prisesEffectives = (...a) => G.prisesEffectives(...a);
import { resteARanger, verifierArrivees, bulles } from "../tournage.mjs";
import { ecrireDescriptionDeSession, retoucherDescription } from "../galerie.mjs";
import { montageDe } from "../lecture.mjs";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const OUTIL = path.join(ICI, "..", "..", "rangement", "galerie.mjs");
const nettoyages = [];
after(() => { for (const f of nettoyages.reverse()) f(); });

const DESCRIPTION = { titre: "Toi qui marches avec tes sacs", ce_qu_on_voit: "Tu marches sur le trottoir, deux sacs de courses.",
  action: "Tu marches vers la caméra.", lieu: "Une rue.", cadrage: "Vertical, plan moyen.", personne_a_l_image: true,
  passages: [{ debut: 0, fin: 3 }], mots_cles: ["courses", "sacs"] };

function preparer() {
  const m = monde();
  nettoyages.push(() => m.nettoyer());
  const g = new Galerie(m.config.galerie);
  let k = 0;
  const fichier = (type = "b-roll", contenu = `clip-${k}`) => {
    const src = path.join(m.racine, `IMG_${++k}.${type === "photo" ? "jpg" : "mov"}`);
    fs.writeFileSync(src, contenu);
    const f = g.ajouter(src, { type, nom_origine: path.basename(src), duree_s: type === "photo" ? null : 3, origine: { genre: "ajout" } });
    g.decrire(f.id, { ...DESCRIPTION, passages: type === "photo" ? [] : DESCRIPTION.passages });
    return g.fiche(f.id);
  };
  return { m, g, fichier };
}

// Un reel avec son brief : chaque plan « Vidéo, 3 s : <sujet>. Pour « <phrase> » » ou « Photo : ... ».
function reel(m, slug, plans) {
  m.contenu(slug);
  const lignes = plans.map((p) => p.type === "photo" ? `- Photo : ${p.sujet}. Pour « ${p.phrase} »` : `- Vidéo, 3 s : ${p.sujet}. Pour « ${p.phrase} »`);
  m.ecrire(`depot/contenus/${slug}/script.md`, `# ${slug}\n\n## Texte complet\nUn texte.\n\n## Plans à tourner\n${lignes.join("\n")}\n\n## Légende\nLégende\n`);
  return lignes.map((l) => l.replace(/^- /, ""));
}

// stock.json tel que l'écrit stock.py poser : l'empreinte des plans, la comparaison datée, le fichier pris par plan.
function stock(m, slug, textes, pris, { le = "2026-11-21T10:00:00+01:00" } = {}) {
  const script = fs.readFileSync(path.join(m.depot, "contenus", slug, "script.md"), "utf8");
  const lignes = script.split("## Plans à tourner\n")[1].split("\n\n")[0].split("\n").map((l) => l.trim()).filter(Boolean);
  const emp = `sha256:${crypto.createHash("sha256").update(lignes.join("\n")).digest("hex").slice(0, 16)}`;
  m.json(`depot/contenus/${slug}/stock.json`, {
    version: 1, plans_empreinte: emp, essentiel_fixe_le: le, vu: { le, plans_empreinte: emp },
    comparaison: { fait_le: le, plans_empreinte: emp, galerie: 1 },
    plans: textes.map((texte, i) => {
      const type = texte.startsWith("Photo") ? "photo" : "b-roll";
      const phrase = /«\s*(.+?)\s*»/.exec(texte)?.[1] || null;
      const id = pris[i + 1] || null;
      return { n: i + 1, type, texte, phrase, essentiel: "toi", detail: "", duree_s: type === "photo" ? null : 3,
        stock: id ? { id, debut: type === "photo" ? null : 0, fin: type === "photo" ? null : 3, pourquoi: "Il montre ce que dit la phrase." } : null,
        manque: id ? null : "Rien dans ta Galerie ne le montre pour l'instant : celui-là, il faut le faire." };
    }),
  });
}

function tournage(m, id, prises, contenus) {
  const t = { version: 1, id, cree_le: "2026-11-21T09:00:00+01:00", contenus, duree_estimee_min: 10, prises };
  m.json(`depot/tournages/${id}.json`, t);
  return t;
}
const priseBroll = (n, slug, phrase, sujet = "toi qui marches") => ({ n, type: "b-roll", contenus: [{ slug, usages: [{ phrase, mouvement: 1 }] }],
  lieu: "dehors", materiel: [], ce_qu_on_voit: sujet, mouvements: [sujet], duree_s: 5, deja_en_bibliotheque: null });
const priseFace = (n, slug) => ({ n, type: "face", contenus: [{ slug, usages: [] }], lieu: "", materiel: [], ce_qu_on_voit: "toi", mouvements: [], duree_s: 30, deja_en_bibliotheque: null });
const outil = (m, ...args) => spawnSync(process.execPath, [OUTIL, ...args, "--config", m.config.fichier], { encoding: "utf8", env: { ...m.env } });

// ---------------------------------------------------------------- les arrivées d'un tournage

test("tournage : un b-roll rangé dans la Galerie compte comme rangé (sinon le plan reste « à finir » pour toujours)", () => {
  const { m, g } = preparer();
  m.contenu("reel-a");
  const t = tournage(m, "2026-11-21-0900", [priseFace(1, "reel-a"), priseBroll(2, "reel-a", "tu rentres à pied")], ["reel-a"]);
  fs.mkdirSync(path.join(m.media, "reel-a", "face"), { recursive: true });
  fs.writeFileSync(path.join(m.media, "reel-a", "face", "IMG_9.mov"), "face");
  const src = path.join(m.racine, "IMG_10.mov"); fs.writeFileSync(src, "broll");
  const f = g.ajouter(src, { type: "b-roll", nom_origine: "IMG_10.mov", origine: { genre: "tournage", tournage: t.id, prise: 2 } });
  g.lier(m.media, "reel-a", f.id, { source: "tournage" });
  assert.deepEqual(resteARanger(m.config, t, { sautees: [] }), { videos: 0, photos: 0 });
});

test("tournage : une photo de la Galerie posée dans le reel (plan pris en stock) ne compte pas comme la photo du tournage", () => {
  const { m, g, fichier } = preparer();
  m.contenu("reel-a");
  const ph = fichier("photo");
  g.lier(m.media, "reel-a", ph.id, { source: "stock" });
  const t = tournage(m, "2026-11-21-0901", [{ n: 1, type: "photo", contenus: [{ slug: "reel-a", usages: [] }], ce_qu_on_voit: "ton assiette", mouvements: [], deja_en_bibliotheque: null }], ["reel-a"]);
  assert.deepEqual(resteARanger(m.config, t, { sautees: [] }), { videos: 0, photos: 1 }, "la photo du tournage n'est pas encore là");
});

// ---------------------------------------------------------------- stock contre plan de tournage

test("plan pris dans la Galerie APRÈS le plan de tournage : la prise n'est plus attendue ni à tourner", () => {
  const { m, fichier } = preparer();
  const x = fichier();
  const textes = reel(m, "reel-a", [{ sujet: "tu marches avec tes sacs", phrase: "tu rentres à pied" }, { sujet: "ton frigo", phrase: "tu ranges tout" }]);
  stock(m, "reel-a", textes, {});
  const t = tournage(m, "2026-11-21-0902", [priseFace(1, "reel-a"), priseBroll(2, "reel-a", "tu rentres à pied"), priseBroll(3, "reel-a", "tu ranges tout", "ton frigo")], ["reel-a"]);
  // Romain : « Prends plutôt celui-là » sur le plan 1, après le plan de tournage.
  const r = outil(m, "plan", "reel-a", "1", "stock", x.id);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const bs = bulles(m.config, t);
  const b2 = bs.find((b) => b.n === 2);
  assert.equal(b2.galerie, true, "la prise 2 est marquée « déjà dans ta Galerie »");
  assert.equal(b2.deja, true, "rien à tourner pour elle");
  assert.equal(bs.find((b) => b.n === 3).deja, false);
  const v = verifierArrivees({ ...m.config, arrivees: path.join(m.racine, "vide") }, t, { sautees: [] });
  assert.equal(v.attendu.videos, 2, "face caméra + le frigo, pas le plan pris dans la Galerie");
});

test("« J'en tourne un nouveau » APRÈS le plan de tournage : le plan apparaît dans le tournage et il est attendu", () => {
  const { m, fichier } = preparer();
  const x = fichier();
  const textes = reel(m, "reel-a", [{ sujet: "tu marches avec tes sacs", phrase: "tu rentres à pied" }]);
  stock(m, "reel-a", textes, { 1: x.id });
  const t = tournage(m, "2026-11-21-0903", [priseFace(1, "reel-a")], ["reel-a"]);
  assert.equal(bulles(m.config, t).length, 1, "avant : seule la face caméra");
  const r = outil(m, "plan", "reel-a", "1", "tourner");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const bs = bulles(m.config, t);
  assert.equal(bs.length, 2);
  const ajoutee = bs.find((b) => b.type === "b-roll");
  assert.equal(ajoutee.ajoutee, true);
  assert.equal(ajoutee.deja, false);
  assert.match(ajoutee.mouvements[0].texte, /tu marches avec tes sacs/);
  assert.equal(ajoutee.mouvements[0].phrases[0].phrase, "tu rentres à pied");
  const v = verifierArrivees({ ...m.config, arrivees: path.join(m.racine, "vide") }, t, { sautees: [] });
  assert.equal(v.attendu.videos, 2);
  // Le rangement range le nouveau plan à sa place : la prise ajoutée a un numéro stable.
  assert.deepEqual(prisesEffectives(m.config, t).map((p) => p.n), bs.map((b) => b.n).sort((a, b) => a - b));
  // Le montage ne la dit pas « arrivée » : elle manque.
  const mo = montageDe(m.config, "reel-a", null, t);
  assert.ok(mo.manquants.some((x) => /tu rentres à pied/.test(x.detail)), JSON.stringify(mo.manquants));
});

test("montage : un plan pris dans la Galerie après le tournage n'est pas dit « pas encore arrivé »", () => {
  const { m, fichier } = preparer();
  const x = fichier();
  const textes = reel(m, "reel-a", [{ sujet: "tu marches avec tes sacs", phrase: "tu rentres à pied" }]);
  stock(m, "reel-a", textes, {});
  const t = tournage(m, "2026-11-21-0904", [priseFace(1, "reel-a"), priseBroll(2, "reel-a", "tu rentres à pied")], ["reel-a"]);
  assert.equal(outil(m, "plan", "reel-a", "1", "stock", x.id).status, 0);
  const mo = montageDe(m.config, "reel-a", null, t);
  assert.deepEqual(mo.manquants.filter((y) => /rentres/.test(y.detail)), []);
});

// ---------------------------------------------------------------- deux briefs, un seul fichier

test("deux briefs comparés au même stock : le fichier proposé au premier n'est plus libre pour le second", () => {
  const { m, fichier } = preparer();
  const x = fichier();
  const ta = reel(m, "reel-a", [{ sujet: "tu marches avec tes sacs", phrase: "tu rentres à pied" }]);
  const tb = reel(m, "reel-b", [{ sujet: "tu marches avec tes sacs", phrase: "tu rentres des courses" }]);
  stock(m, "reel-a", ta, { 1: x.id }, { le: "2026-11-21T10:00:00+01:00" });
  // B ne doit plus le voir libre (son brief n'est pas encore comparé).
  assert.equal(ecart(x, m.depot, { pour: "reel-b" }).reutilisable, false, "réservé par le brief de A");
  assert.deepEqual(ecart(x, m.depot, { pour: "reel-b" }).reserve, ["reel-a"]);
  assert.equal(ecart(x, m.depot, { pour: "reel-a" }).reutilisable, true, "A le garde");
  // Les deux l'ont pris (comparaisons en même temps) : le premier le garde, le second le tourne.
  stock(m, "reel-b", tb, { 1: x.id }, { le: "2026-11-21T10:05:00+01:00" });
  assert.equal(plansEffectifs(m.config, "reel-a")[0].etat, "stock");
  assert.equal(plansEffectifs(m.config, "reel-b")[0].etat, "a_tourner");
  // « Prends plutôt celui-là » ou le monteur sur un troisième contenu : refusé.
  reel(m, "reel-c", [{ sujet: "tu marches", phrase: "tu marches" }]);
  const r = outil(m, "poser", "reel-c", x.id);
  assert.equal(r.status, 2, r.stdout);
  assert.match(r.stdout, /BLOQUE RESERVE/);
});

test("suppression : un fichier seulement proposé par un brief pas encore posté ne se supprime pas", () => {
  const { m, g, fichier } = preparer();
  const x = fichier();
  const ta = reel(m, "reel-a", [{ sujet: "tu marches avec tes sacs", phrase: "tu rentres à pied" }]);
  stock(m, "reel-a", ta, { 1: x.id });
  assert.deepEqual(bloquantsSuppression(x, m.depot), ["reel-a"]);
  const r = outil(m, "supprimer", x.id);
  assert.match(r.stdout, /BLOQUE UTILISE reel-a/);
  assert.ok(g.fiche(x.id), "toujours là");
  // « J'en tourne un nouveau » : la proposition ne réserve plus rien.
  ecrireChoixPlan(m.config, "reel-a", 1, { choix: "tourner" }, { texte: ta[0] });
  assert.deepEqual(bloquantsSuppression(x, m.depot), []);
});

// ---------------------------------------------------------------- choix du client et brief retouché

test("un choix du client suit son plan : brief retouché (plan inséré), il ne s'applique pas au plan qui a pris son numéro", () => {
  const { m, fichier } = preparer();
  const x = fichier(), y = fichier();
  let t = reel(m, "reel-a", [{ sujet: "ton frigo", phrase: "tu ranges tout" }, { sujet: "tu marches avec tes sacs", phrase: "tu rentres à pied" }]);
  stock(m, "reel-a", t, { 1: x.id });
  assert.equal(outil(m, "plan", "reel-a", "2", "stock", y.id).status, 0);
  assert.equal(plansEffectifs(m.config, "reel-a")[1].etat, "stock");
  // Le brief change : un plan est inséré en tête ; le head of content refait stock.json (le plan 2 est un autre plan).
  t = reel(m, "reel-a", [{ sujet: "ta liste de courses", phrase: "tu fais ta liste" }, { sujet: "ton frigo", phrase: "tu ranges tout" }, { sujet: "tu marches avec tes sacs", phrase: "tu rentres à pied" }]);
  stock(m, "reel-a", t, { 2: x.id });
  const p = plansEffectifs(m.config, "reel-a");
  assert.equal(p[1].etat, "stock");
  assert.equal(p[1].stock.id, x.id, "le plan 2 (le frigo) garde sa proposition, pas le choix fait pour l'ancien plan 2");
  assert.equal(p[1].stock.par, "proposition");
});

// ---------------------------------------------------------------- description et fichier partagé

test("description : une retouche du client pendant la session n'est pas écrasée par la réponse qui arrive après", () => {
  const { m, g } = preparer();
  const src = path.join(m.racine, "IMG_50.jpg"); fs.writeFileSync(src, "photo");
  const f = g.ajouter(src, { type: "photo", nom_origine: "IMG_50.jpg", origine: { genre: "ajout" } });
  const action = { id: "a-1", cree_le: new Date(Date.now() - 60e3).toISOString() };
  retoucherDescription(m.config, f.id, { ...DESCRIPTION, titre: "Mon titre à moi", passages: [] });
  const r = ecrireDescriptionDeSession(m.config, f.id, JSON.stringify({ ...DESCRIPTION, titre: "Titre du modèle", passages: [] }), action.id, { action });
  assert.equal(r.ok, true);
  assert.equal(g.fiche(f.id).description.titre, "Mon titre à moi");
  assert.equal(g.fiche(f.id).description.par, "toi");
});

test("lien physique : un contenu ne peut pas modifier le fichier de la Galerie en écrivant dans son lien", () => {
  const { m, g, fichier } = preparer();
  m.contenu("reel-a");
  const x = fichier("b-roll", "original");
  const lien = g.lier(m.media, "reel-a", x.id, { source: "toi" });
  assert.throws(() => fs.writeFileSync(lien, "modifié par un outil"), /EACCES|EPERM/);
  assert.equal(fs.readFileSync(g.chemin(x), "utf8"), "original");
  // Le retirer du contenu ou le supprimer reste possible.
  g.delier(m.media, "reel-a", x.id);
  assert.ok(!fs.existsSync(lien));
});

test("doublon : le même fichier envoyé deux fois n'entre qu'une fois dans la Galerie", () => {
  const { m, g } = preparer();
  const a = path.join(m.racine, "IMG_70.mov"), b = path.join(m.racine, "IMG_70 2.mov");
  fs.writeFileSync(a, "même contenu"); fs.writeFileSync(b, "même contenu");
  const f1 = g.ajouter(a, { type: "b-roll", nom_origine: "IMG_70.mov", duree_s: 3 });
  const f2 = g.ajouter(b, { type: "b-roll", nom_origine: "IMG_70 2.mov", duree_s: 3 });
  assert.equal(f2.id, f1.id);
  assert.equal(f2.doublon, true);
  assert.equal(g.fiches().length, 1);
  assert.ok(!fs.existsSync(b), "le doublon ne reste pas dans les arrivées");
  // Même taille, autre contenu : deux fichiers.
  const c = path.join(m.racine, "IMG_71.mov"); fs.writeFileSync(c, "autre contenu");
  assert.notEqual(g.ajouter(c, { type: "b-roll", nom_origine: "IMG_71.mov", duree_s: 3 }).id, f1.id);
});
