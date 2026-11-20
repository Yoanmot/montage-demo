// Le genre d'un reel (2026-11-20) : face caméra, plans filmés avec texte à l'écran, plans filmés avec sa voix. Ce que
// le studio en montre (étiquette, plan de tournage, vue Montage) et ce qu'il dit au monteur.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { monde } from "./aide.mjs";
import { genreDe, construireCartes, montageDe, lireDepot } from "../lecture.mjs";
import { bulles } from "../tournage.mjs";
import { messageAction } from "../file.mjs";
import { nomFormat, nomRole } from "../../interface/app/genres.js";
import { genreDe as genreDuRangement } from "../../rangement/lib/reconnaitre.mjs";

const mondes = [];
after(() => mondes.forEach((m) => m.nettoyer()));

const MUET = "# x\n\n## Accroches proposées\n1. (question) Tu fais ça ?\n\n## Texte à l'écran\nTU FAIS ÇA ?\nTOUT EST DANS LA DESCRIPTION\n\n## Légende\nTout.\n";
const PARLE = "# x\n\n## Texte complet\nBonjour.\n\n## Légende\nTout.\n";

test("genre : etat.json d'abord, un ancien reel muet se reconnaît à son brief, sinon face caméra ; même règle au rangement", () => {
  for (const f of [genreDe, genreDuRangement]) {
    assert.equal(f({ genre: "plans-voix" }, MUET), "plans-voix");
    assert.equal(f({}, MUET), "plans-texte");
    assert.equal(f({}, PARLE), "face-camera");
    assert.equal(f(null, null), "face-camera");
    assert.equal(f({ genre: "inconnu" }, PARLE), "face-camera");
  }
});

test("étiquettes : le mot montré selon le genre, jamais « b-roll »", () => {
  assert.equal(nomFormat({ format: "reel" }), "Reel");
  assert.equal(nomFormat({ format: "reel", genre: "plans-texte" }), "Reel, texte à l'écran");
  assert.equal(nomFormat({ format: "reel", genre: "plans-voix" }), "Reel, avec ta voix");
  assert.equal(nomFormat({ format: "carrousel", genre: "plans-voix" }), "Carrousel");
  assert.equal(nomRole("face"), "Face caméra");
  assert.equal(nomRole("face", "plans-voix"), "Ta voix");
  assert.equal(nomRole("face", "plans-texte"), "Vidéo du reel");
  assert.equal(nomRole("b-roll", "plans-texte"), "Plan en plus");
});

test("cartes : le genre suit les contenus et les idées proposées, absent pour une face caméra", () => {
  const m = monde();
  mondes.push(m);
  m.json("depot/contenus/muet/etat.json", { version: 1, titre: "Muet", format: "reel", genre: "plans-texte", cree_le: "2026-11-15T17:41:00+01:00" });
  m.contenu("parle");
  m.json("depot/propositions/2026-11-20-0900.json", { version: 1, cree_le: "2026-11-20T09:00:00+01:00", demande: "5 idées", idees: [
    { id: "2026-11-20-0900-01", titre: "Voix", format: "reel", genre: "plans-voix", angle: "a", accroche: null, source: { type: "chat", ref: null },
      pourquoi_maintenant: "p", declinaison_de: null, statut: "proposee", date_statut: "2026-11-20", raison_refus: null, slug: null },
    { id: "2026-11-20-0900-02", titre: "Sans", format: "reel", angle: "a", accroche: null, source: { type: "chat", ref: null },
      pourquoi_maintenant: "p", declinaison_de: null, statut: "proposee", date_statut: "2026-11-20", raison_refus: null, slug: null }] });
  const cartes = construireCartes(m.config, { actions: [], actives: [], maintenant: new Date() });
  const par = (titre) => (Array.isArray(cartes) ? cartes : cartes.cartes).find((c) => c.titre === titre);
  assert.equal(par("Muet").genre, "plans-texte");
  assert.equal("genre" in par("Titre parle"), false);
  assert.equal(par("Voix").genre, "plans-voix");
  assert.equal("genre" in par("Sans"), false);
});

test("plan de tournage : la voix d'un reel en plans filmés avec sa voix a sa propre carte", () => {
  const m = monde();
  mondes.push(m);
  m.json("depot/contenus/voix/etat.json", { version: 1, titre: "Voix", format: "reel", genre: "plans-voix" });
  m.ecrire("depot/contenus/voix/script.md", "# x\n\n## Texte complet\nTon texte.\n");
  m.contenu("face");
  m.ecrire("depot/contenus/face/script.md", "# x\n\n## Texte complet\nAutre texte.\n");
  const face = (slug, n) => ({ n, type: "face", contenus: [{ slug, usages: [] }], lieu: "calme", materiel: [], ce_qu_on_voit: "x", mouvements: [], duree_s: 30 });
  const b = bulles(m.config, { prises: [face("face", 1), face("voix", 2)] });
  assert.equal(b[0].voix, undefined);
  assert.equal(b[0].titre, "Face caméra");
  assert.equal(b[1].voix, true);
  assert.equal(b[1].titre, "Ta voix");
  assert.equal(b[1].script, "Ton texte.");
});

test("montage : le premier message dit au monteur comment le reel a été tourné", () => {
  const m = monde();
  mondes.push(m);
  for (const [slug, genre] of [["muet", "plans-texte"], ["voix", "plans-voix"], ["face", null]]) {
    m.json(`depot/contenus/${slug}/etat.json`, { version: 1, titre: slug, format: "reel", ...(genre ? { genre } : {}) });
    m.ecrire(`Contenu/${slug}/face/IMG_1.mov`, "v");
  }
  const t = (slug) => messageAction({ type: "montage", slug }, m.config);
  assert.match(t("muet"), /IMG_1\.mov\nCe reel se tourne en plans filmés sans parler.*« Texte à l'écran »/);
  assert.match(t("voix"), /sa voix seule.*couvrir toute la vidéo/);
  assert.match(t("face"), /IMG_1\.mov\n\nSes clips filmés en plus/);
  for (const s of ["muet", "voix", "face"]) assert.ok(!/\{\{\w+\}\}/.test(t(s)));
});

test("vue Montage : la vidéo du reel sans parole et la voix seule portent leur nom, le plan principal n'est plus attendu", () => {
  const m = monde();
  mondes.push(m);
  m.json("depot/contenus/muet/etat.json", { version: 1, titre: "Muet", format: "reel", genre: "plans-texte" });
  m.json("depot/contenus/voix/etat.json", { version: 1, titre: "Voix", format: "reel", genre: "plans-voix" });
  m.ecrire("Contenu/muet/face/IMG_1.MOV", "v");
  const b = (n, slug) => ({ n, type: "b-roll", contenus: [{ slug, usages: [{ mouvement: 1, phrase: "EN HAUT" }] }], lieu: "bureau",
    materiel: [], ce_qu_on_voit: "x", mouvements: ["tu tapes"], duree_s: 8, deja_en_bibliotheque: null });
  const t = { id: "t1", prises: [{ n: 1, type: "face", contenus: [{ slug: "voix", usages: [] }], lieu: "calme", materiel: [], ce_qu_on_voit: "ta voix", mouvements: [], duree_s: 30 },
    b(2, "voix"), b(3, "muet"), b(4, "muet")] };
  const muet = montageDe(m.config, "muet", lireDepot(m.depot), t);
  assert.equal(muet.rushs[0].titre, "Ta vidéo du reel");
  assert.equal(muet.rushs[0].detail, "Ton plan principal, filmé sans parler.");
  assert.equal(muet.manquants.length, 1);   // la prise 4 seulement
  assert.match(muet.manquants[0].detail, /pas encore arrivé/);
  const voix = montageDe(m.config, "voix", lireDepot(m.depot), t);
  assert.equal(voix.manquants[0].titre, "Ta voix");
});
