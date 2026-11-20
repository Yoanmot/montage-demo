import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { stade, libelle, superposition } from "../stades.mjs";
import { instantane, lireDepot, construireCartes, decouperScript, dureeScript, detail, brolls, briefDe, montageDe, listeTournages, lireTournage } from "../lecture.mjs";
import { empreinteTexte, isoZurich } from "../outils.mjs";
import { monde } from "./aide.mjs";

const mondes = [];
after(() => mondes.forEach((m) => m.nettoyer()));
function nouveau() {
  const m = monde();
  mondes.push(m);
  return m;
}

function stadeDe(m, slug, etatLocal = {}) {
  const { contenu, fichiers } = instantane(m.config, slug, lireDepot(m.depot));
  return stade(contenu, fichiers, etatLocal);
}

const SCRIPT = "# Pourquoi tu as faim à 16 h\n\n## Texte complet\nBonjour\n\n## En points\n- un\n\n## Légende\nLa légende\n";

test("reel : tous les stades, du moins avancé au plus avancé", () => {
  const m = nouveau();
  const s = "faim-a-16h";
  m.contenu(s);
  assert.equal(stadeDe(m, s).stade, "gardee");

  m.ecrire(`depot/contenus/${s}/script.md`, SCRIPT);
  assert.equal(stadeDe(m, s).stade, "script_ecrit");

  m.contenu(s, { valide: m.valider(s, SCRIPT) });
  assert.equal(stadeDe(m, s).stade, "valide");

  m.json("depot/tournages/2026-11-16-1400.json", { version: 1, id: "2026-11-16-1400", contenus: [s, "autre"], prises: [] });
  assert.equal(stadeDe(m, s).stade, "tournage_prevu");

  m.ecrire(`Contenu/${s}/face/IMG_1.mov`, "video");
  m.ecrire(`Contenu/${s}/face/IMG_1-coupe.mp4`, "coupe");
  assert.equal(stadeDe(m, s).stade, "rushs_recus");

  // La planche interne du monteur (ses moments clés) ne fait pas avancer le contenu : seul l'aperçu attend la validation.
  m.ecrire(`Contenu/${s}/face/IMG_1-montage/planche/planche.png`, "png");
  assert.equal(stadeDe(m, s).stade, "rushs_recus");
  m.ecrire(`Contenu/${s}/face/IMG_1-montage/apercu/apercu.json`, "{}");
  assert.equal(stadeDe(m, s).stade, "planche");

  m.ecrire(`Contenu/${s}/face/IMG_1-monte.mp4`, "final");
  assert.equal(stadeDe(m, s).stade, "monte");

  const futur = "2099-01-01 18:30";
  m.json("depot/publications/registre.json", { version: 1, publications: { [s]: { statut: "programmé", prevu_le: futur } } });
  const p = stadeDe(m, s);
  assert.equal(p.stade, "programme");
  assert.match(libelle("programme", "reel", { prevu_le: futur }), /^programmé jeu\. 01\/01$/);

  m.json("depot/publications/registre.json", { version: 1, publications: { [s]: { statut: "programmé", prevu_le: "2020-01-01 18:30" } } });
  // Lot 12 : l'heure passée ne suffit plus, il faut la confirmation d'Instagram (relue chez Zernio).
  const passe = stadeDe(m, s);
  assert.equal(passe.stade, "programme", "programmé avec une date passée : programmé tant qu'Instagram n'a pas confirmé");
  assert.equal(libelle("programme", "reel", { statut: "programmé", prevu_le: "2020-01-01 18:30" }), "sortie à confirmer");

  m.json("depot/publications/registre.json", { version: 1, publications: { [s]: { statut: "failed", prevu_le: "2020-01-01 18:30" } } });
  assert.equal(stadeDe(m, s).stade, "monte", "refusé par Instagram : revient à publier");
  assert.equal(libelle("monte", "reel", { statut: "failed" }), "refusé par Instagram");

  m.json("depot/publications/registre.json", { version: 1, publications: { [s]: { statut: "publié" } } });
  assert.equal(stadeDe(m, s).stade, "publie");

  // Parti tout de suite, encore en préparation chez Instagram : déjà posté.
  for (const statut of ["envoyé", "publishing"]) {
    m.json("depot/publications/registre.json", { version: 1, publications: { [s]: { statut, zernio_post: "6aa" } } });
    assert.equal(stadeDe(m, s).stade, "publie", statut);
  }
  m.json("depot/publications/registre.json", { version: 1, publications: { [s]: { statut: "failed", zernio_post: "6aa" } } });
  assert.equal(stadeDe(m, s).stade, "monte", "un échec se republie");

  m.contenu(s, { valide: m.valider(s, SCRIPT), refuse: { le: isoZurich(), raison: null } });
  assert.equal(stadeDe(m, s).stade, "abandonne");
});

test("reel : un script modifié après validation redevient « script à relire »", () => {
  const m = nouveau();
  const s = "dos-qui-tire";
  m.contenu(s, { valide: m.valider(s, SCRIPT) });
  m.ecrire(`depot/contenus/${s}/script.md`, SCRIPT);
  assert.equal(stadeDe(m, s).stade, "valide");
  m.ecrire(`depot/contenus/${s}/script.md`, SCRIPT + "\nune phrase de plus\n");
  assert.equal(stadeDe(m, s).stade, "script_ecrit");
});

test("reel : -monte-2.mp4 compte comme monté, -coupe seul ne compte pas comme rush", () => {
  const m = nouveau();
  const s = "proteines";
  m.contenu(s);
  m.ecrire(`Contenu/${s}/face/a-coupe.mp4`, "x");
  assert.equal(stadeDe(m, s).stade, "gardee");
  m.ecrire(`Contenu/${s}/face/a-monte-2.mp4`, "x");
  assert.equal(stadeDe(m, s).stade, "monte");
});

test("carrousel : tous les stades et version corrigée après rendu", () => {
  const m = nouveau();
  const s = "trois-erreurs";
  const texte = "# Trois erreurs\n\nslide 1\n";
  m.contenu(s, { format: "carrousel" });
  assert.equal(stadeDe(m, s).stade, "gardee");
  m.ecrire(`depot/contenus/${s}/carrousel.md`, texte);
  assert.equal(stadeDe(m, s).stade, "script_ecrit", "le brouillon suffit");
  assert.equal(detail(m.config, s, {}).textes.carrousel, texte.trim());
  // La validation recopie le brouillon dans a-rendre/ (etat.py).
  m.ecrire(`depot/a-rendre/carrousels/${s}.md`, texte);
  assert.equal(stadeDe(m, s).stade, "script_ecrit");
  m.contenu(s, { format: "carrousel", valide: m.valider(s, texte) });
  assert.equal(stadeDe(m, s).stade, "valide");
  // Le brouillon retouché après validation : à relire, même si a-rendre/ garde l'ancien texte.
  m.ecrire(`depot/contenus/${s}/carrousel.md`, texte + "retouche\n");
  assert.equal(stadeDe(m, s).stade, "script_ecrit");
  m.ecrire(`depot/contenus/${s}/carrousel.md`, texte);
  assert.equal(stadeDe(m, s).stade, "valide");
  assert.equal(libelle("valide", "carrousel"), "à mettre en page");
  assert.equal(libelle("rushs_recus", "reel"), "rushs reçus");
  // Le Mac rend : le texte passe dans rendus/, le registre porte son empreinte.
  fs.rmSync(path.join(m.depot, "a-rendre", "carrousels", `${s}.md`));
  m.ecrire(`depot/rendus/carrousels/${s}.md`, texte);
  m.json("depot/rendus/registre.json", { version: 1, carrousels: { [s]: { empreinte: empreinteTexte(texte), rendu_le: isoZurich() } } });
  assert.equal(stadeDe(m, s).stade, "mis_en_page");
  // Correction après rendu : le brouillon ne correspond plus à l'empreinte validée, à relire,
  // même mis en page ; validée, elle part dans a-rendre/.
  m.ecrire(`depot/contenus/${s}/carrousel.md`, texte + "correction\n");
  assert.equal(stadeDe(m, s).stade, "script_ecrit");
  m.json("depot/publications/registre.json", { version: 1, publications: { [s]: { statut: "programmé", prevu_le: "2099-01-01 12:15" } } });
  assert.equal(stadeDe(m, s).stade, "programme", "programmé reste devant");
  m.json("depot/publications/registre.json", { version: 1, publications: {} });
  m.ecrire(`depot/a-rendre/carrousels/${s}.md`, texte + "correction\n");
  m.contenu(s, { format: "carrousel", valide: m.valider(s, texte + "correction\n") });
  assert.equal(stadeDe(m, s).stade, "valide");
  m.json("depot/publications/registre.json", { version: 1, publications: { [s]: { statut: "publié" } } });
  assert.equal(stadeDe(m, s).stade, "publie");
});

test("carrousel sans dossier contenus/ : détecté par son texte", () => {
  const m = nouveau();
  m.ecrire("depot/a-rendre/carrousels/ancien-carrousel.md", "# Ancien\n");
  const cartes = construireCartes(m.config, {});
  const c = cartes.find((x) => x.slug === "ancien-carrousel");
  assert.equal(c.format, "carrousel");
  assert.equal(c.stade, "script_ecrit");
  assert.equal(c.titre, "Ancien");
});

test("propositions : proposée, mise de côté, supprimée (plus de carte), gardée (remplacée par sa carte de contenu)", () => {
  const m = nouveau();
  m.json("depot/propositions/2026-11-15-1730.json", {
    version: 1, cree_le: "2026-11-15T17:30:00+01:00", demande: "idées",
    idees: [
      { id: "2026-11-15-1730-01", titre: "Une", format: "reel", angle: "a", source: { type: "chat", ref: null }, pourquoi_maintenant: "p", statut: "proposee", slug: null },
      { id: "2026-11-15-1730-02", titre: "Deux", format: "carrousel", angle: "b", source: { type: "chat", ref: null }, pourquoi_maintenant: "p", statut: "refusee", raison_refus: "non", slug: null },
      { id: "2026-11-15-1730-03", titre: "Trois", format: "reel", statut: "gardee", slug: "trois" },
      { id: "2026-11-15-1730-04", titre: "Quatre", format: "reel", angle: "d", source: { type: "chat", ref: null }, pourquoi_maintenant: "p", statut: "de_cote", slug: null },
    ],
  });
  m.contenu("trois", { titre: "Trois" });
  const cartes = construireCartes(m.config, {});
  const prop = cartes.filter((c) => !c.slug);
  assert.deepEqual(prop.map((c) => [c.proposition_id, c.stade, c.libelle]), [
    ["2026-11-15-1730-01", "proposee", "idée proposée"],
    ["2026-11-15-1730-04", "de_cote", "mise de côté"],
  ]);
  assert.equal(prop[0].angle, "a");
  assert.equal(cartes.find((c) => c.slug === "trois").stade, "gardee");
});

test("superposition : en_cours, en_file, erreur, a_toi", () => {
  const s = "faim-a-16h";
  const a = (statut, extra = {}) => ({ id: statut, type: "script", slug: s, statut, ...extra });
  assert.deepEqual(superposition(s, { actions: [a("en_file")] }), { activite: "en_file", a_toi: false });
  assert.deepEqual(superposition(s, { actions: [a("en_cours")] }), { activite: "en_cours", a_toi: false });
  assert.deepEqual(superposition(s, { actions: [a("fini"), a("erreur", { erreur: "Ça a coincé." })] }),
    { activite: "erreur", a_toi: false, erreur_message: "Ça a coincé." });
  assert.deepEqual(superposition(s, { actions: [a("a_toi")] }), { activite: null, a_toi: true });
  // Romain répond : la session tourne, la carte n'« attend » plus sa réponse.
  assert.deepEqual(superposition(s, { actions: [a("a_toi")], actives: [`${s}:hoc`] }), { activite: "en_cours", a_toi: false });
  // Une action d'un tournage groupé concerne chacun de ses slugs.
  assert.deepEqual(superposition(s, { actions: [{ id: "t", type: "tournage", slugs: ["x", s], statut: "en_cours" }] }), { activite: "en_cours", a_toi: false });
  assert.deepEqual(superposition("autre", { actions: [a("en_cours")] }), { activite: null, a_toi: false });
  // Le stade se calcule toujours, la superposition s'y ajoute.
  const r = stade({ slug: s, format: "reel", etat: null }, { dossier: true }, { actions: [a("a_toi")] });
  assert.deepEqual(r, { stade: "gardee", activite: null, a_toi: true });
});

test("ancien script.md (avant le lot 9) : plans à tourner = à filmer + photos, points et conseils ignorés", () => {
  const texte = [
    "# Sujet", "", "- Format : x", "", "## Accroches proposées", "1. (a) une", "",
    "## Texte complet", "Le texte.", "", "## En points", "- point", "", "## À filmer en plus",
    "(À coller au monteur avec la vidéo.)", "- 5 s : cuisine", "", "## Photos à envoyer", "- rien", "",
    "## Conseils de tournage", "- lumière", "", "## Légende", "Ma légende", "", "## Message automatique",
    "- Mot : NUQUE", "", "## À vérifier", "- rien",
  ].join("\n");
  const t = decouperScript(texte);
  assert.equal(t.script, "Le texte.");
  assert.equal(t.plans, "- 5 s : cuisine");
  assert.equal(t.legende, "Ma légende");
  assert.equal(t.message_auto, "- Mot : NUQUE");
  assert.equal(t.accroches, "1. (a) une");
  assert.equal(t.a_verifier, "- rien");
  for (const k of ["en_points", "a_filmer", "photos", "conseils"]) assert.equal(t[k], undefined, k);
  const avecPhotos = decouperScript(texte.replace("## Photos à envoyer\n- rien", "## Photos à envoyer\n- ton bol de skyr"));
  assert.equal(avecPhotos.plans, "- 5 s : cuisine\n- Photo : ton bol de skyr");
});

test("script.md du lot 9 : accroches, texte, plans à tourner, légende ; durée lue dans l'en-tête", () => {
  const texte = [
    "# Sujet", "", "- Durée estimée : ≈50 s (40 à 60 s) · mots écrits : 160", "", "## Accroches proposées", "1. (a) une", "",
    "## Texte complet", "Le texte.", "", "## Plans à tourner", "- Vidéo, 5 s : cuisine", "- Photo : ton bol", "",
    "## Légende", "Ma légende",
  ].join("\n");
  const t = decouperScript(texte);
  assert.deepEqual(t, { accroches: "1. (a) une", script: "Le texte.", plans: "- Vidéo, 5 s : cuisine\n- Photo : ton bol", legende: "Ma légende" });
  assert.equal(dureeScript(texte), "≈50 s (40 à 60 s)");
  assert.equal(dureeScript("- Durée estimée : ≈50 s lu (40 à 60 s), ≈60 s à partir des points · mots"), "≈50 s (40 à 60 s)");
});

test("détail d'une carte : textes et médias, sans chemin disque", () => {
  const m = nouveau();
  const s = "faim-a-16h";
  m.contenu(s);
  m.ecrire(`depot/contenus/${s}/idee.md`, "# Faim\n\nAngle\n");
  m.ecrire(`depot/contenus/${s}/script.md`, SCRIPT);
  m.ecrire(`Contenu/${s}/face/IMG 1.mov`, "v");
  m.ecrire(`Contenu/${s}/face/IMG 1-montage/planche/planche.png`, "p");
  m.ecrire(`Contenu/${s}/face/IMG 1-montage/planche/planche.md`, "1. le titre\n2. un zoom\n");
  m.ecrire(`Contenu/${s}/photos/bol.jpg`, "j");
  const d = detail(m.config, s, {});
  assert.equal(d.textes.script, "Bonjour");
  assert.equal(d.textes.legende, "La légende");
  // La planche interne du monteur n'est jamais montrée (19/11) : ni image, ni lignes, ni stade « aperçu à valider ».
  assert.equal(d.medias.planche, undefined);
  assert.equal(d.medias.planche_lignes, undefined);
  assert.equal(d.medias.apercu, undefined);
  assert.equal(d.stade, "rushs_recus");
  assert.ok(!JSON.stringify(d).includes("planche"), "aucune adresse de la planche dans la réponse");
  assert.deepEqual(d.medias.rushs.map((r) => r.type).sort(), ["face", "photo"]);
  assert.ok(!JSON.stringify(d).includes(m.racine), "aucun chemin du disque dans la réponse");
});

test("à ranger : libellé lisible (type probable, ce qui est vu, durée), vignette, jamais le nom", async () => {
  const { aRanger } = await import("../lecture.mjs");
  const m = nouveau();
  m.ecrire("Contenu/_a-ranger/IMG_4821.MOV", "v");
  m.ecrire("Contenu/_a-ranger/IMG_4822.MOV", "v");
  m.ecrire("Contenu/_a-ranger/.vignettes/IMG_4821.MOV.jpg", "j");
  m.json("Contenu/_a-ranger/a-ranger.json", {
    version: 1,
    fichiers: [
      { nom: "IMG_4821.MOV", raison: "je ne sais pas à quelle prise il correspond", code: "vue_aucune", type_probable: "b-roll",
        duree_s: 12.4, vu: { ce_qu_on_voit: "Tu marches au parc.", mouvements: [] }, candidats: [{ slug: "faim-a-16h", type: "b-roll", score: 0.5 }] },
      { nom: "IMG_4822.MOV", raison: "x", type_probable: "face", duree_s: 48, candidats: [] },
    ],
  });
  const [a, b] = aRanger(m.config);
  assert.equal(a.libelle, "ton plan : tu marches au parc (12 s)");
  assert.equal(a.vignette_url, "/api/media/_a-ranger/.vignettes/IMG_4821.MOV.jpg");
  assert.deepEqual(a.candidats, [{ slug: "faim-a-16h", type: "b-roll", score: 0.5 }]);
  assert.equal(b.libelle, "ta vidéo face caméra (48 s)");
  assert.ok(!a.libelle.includes("IMG"));
});

test("carte : erreur_message quand la dernière action a échoué ; aperçu de la ressource", () => {
  const m = monde({ config: { apercu_ressources: "https://apercu.exemple.invalid/" } });
  mondes.push(m);
  const s = "faim-a-16h";
  m.contenu(s);
  const actions = [{ id: "a", type: "script", slug: s, statut: "erreur", erreur: "Le studio s'est arrêté pendant ce travail. Relance-le." }];
  const c = construireCartes(m.config, { actions }).find((x) => x.slug === s);
  assert.equal(c.activite, "erreur");
  assert.equal(c.erreur_message, actions[0].erreur);
  assert.equal(construireCartes(m.config, {}).find((x) => x.slug === s).erreur_message, undefined);
  assert.equal(detail(m.config, s, {}).ressource_url, undefined, "pas de page, pas d'aperçu");
  m.ecrire(`depot/site/${s}/index.html`, "<p>page</p>");
  assert.equal(detail(m.config, s, {}).ressource_url, `https://apercu.exemple.invalid/${s}/`);
});

test("clips b-roll : les vignettes du monteur (b-roll-vignettes/) ne sont pas des clips", () => {
  const m = monde();
  mondes.push(m);
  m.ecrire("Contenu/_bibliotheque/b-roll/20261116-143012-kq3x.mov", "v");
  fs.mkdirSync(path.join(m.media, "faim-a-16h", "b-roll", "b-roll-vignettes"), { recursive: true });
  m.ecrire("Contenu/faim-a-16h/b-roll/b-roll-vignettes/20261116-143012-kq3x.jpg", "j");
  fs.symlinkSync("../../_bibliotheque/b-roll/20261116-143012-kq3x.mov", path.join(m.media, "faim-a-16h", "b-roll", "20261116-143012-kq3x.mov"));
  assert.deepEqual(brolls(m.config, "faim-a-16h").map((f) => path.basename(f)), ["20261116-143012-kq3x.mov"]);
});

test("slides d'un carrousel : seules les slide-NN, jamais la planche de contrôle de la mise en page", () => {
  const m = nouveau();
  m.contenu("trois-erreurs", { format: "carrousel" });
  for (const n of ["planche.jpg", "slide-02.png", "slide-01.png", "slide-10.png", "carrousel.json"]) m.ecrire(`Contenu/trois-erreurs/slides/${n}`, "x");
  const s = detail(m.config, "trois-erreurs", {}).medias.slides;
  assert.deepEqual(s.map((u) => u.split("/").pop()), ["slide-01.png", "slide-02.png", "slide-10.png"]);
});

test("arborescence : les fichiers de chaque dossier apparaissent au fil des étapes (lot 9)", () => {
  const m = nouveau();
  const r = "faim-a-16h";
  const c = "escaliers";
  m.contenu(r);
  m.contenu(c, { format: "carrousel" });
  m.json("depot/propositions/2026-11-15-1730.json", { version: 1, cree_le: "2026-11-15T17:30:00+01:00", idees: [
    { id: "2026-11-15-1730-01", titre: "Une idée", format: "reel", statut: "proposee" }] });
  const fichiers = (slug) => construireCartes(m.config, {}).find((x) => x.slug === slug).fichiers;
  assert.deepEqual(construireCartes(m.config, {}).find((x) => x.proposition_id).fichiers, ["idee"]);
  assert.deepEqual(fichiers(r), ["idee"]);
  m.ecrire(`depot/contenus/${r}/script.md`, SCRIPT);
  assert.deepEqual(fichiers(r), ["idee", "brief"]);
  m.ecrire(`Contenu/${r}/face/IMG_1.MOV`, "v");
  assert.deepEqual(fichiers(r), ["idee", "brief", "montage"]);
  m.ecrire(`Contenu/${r}/face/IMG_1-monte.mp4`, "v");
  assert.deepEqual(fichiers(r), ["idee", "brief", "montage", "video"]);
  assert.deepEqual(fichiers(c), ["idee"]);
  m.ecrire(`depot/contenus/${c}/carrousel.md`, "# Escaliers\n");
  assert.deepEqual(fichiers(c), ["idee", "brief"]);
  m.ecrire(`Contenu/${c}/slides/planche.jpg`, "j");
  assert.deepEqual(fichiers(c), ["idee", "brief"], "la planche de contrôle n'est pas une slide");
  m.ecrire(`Contenu/${c}/slides/slide-01.png`, "p");
  assert.deepEqual(fichiers(c), ["idee", "brief", "slides"]);
});

test("brief : reel (empreinte, durée) et carrousel (slides lisibles, sinon texte brut)", () => {
  const m = nouveau();
  m.contenu("faim-a-16h");
  m.contenu("escaliers", { format: "carrousel" });
  const script = "# Faim\n\n- Durée estimée : ≈45 s (35 à 55 s) · mots écrits : 150\n\n## Accroches proposées\n1. (question) Faim ?\n\n## Texte complet\nBonjour.\n\n## Plans à tourner\n- Vidéo, 5 s : le placard\n\n## Légende\nLa légende.\n";
  m.ecrire("depot/contenus/faim-a-16h/script.md", script);
  const b = briefDe(m.config, "faim-a-16h", "reel");
  assert.equal(b.genre, "reel");
  assert.equal(b.empreinte, empreinteTexte(script));
  assert.equal(b.texte, "Bonjour.");
  assert.equal(b.plans, "- Vidéo, 5 s : le placard");
  assert.equal(b.duree, "≈45 s (35 à 55 s)");
  const carrousel = "# Escaliers\n\n```json\n{\"slides\": [{\"photo-a-prevoir\": \"toi\", \"titre\": \"Monte\", \"texte\": \"Deux étages.\"}]}\n```\n\n## Légende (pour la publication, pas pour les slides)\n\nL'escalier.\n";
  m.ecrire("depot/contenus/escaliers/carrousel.md", carrousel);
  const bc = briefDe(m.config, "escaliers", "carrousel");
  assert.deepEqual(bc.slides, [{ n: 1, titre: "Monte", texte: "Deux étages.", photo: "toi" }]);
  assert.equal(bc.legende, "L'escalier.");
  assert.equal(bc.modifiable, true);
  m.ecrire("depot/contenus/escaliers/carrousel.md", "# Escaliers\n\nslides en vrac\n");
  const bv = briefDe(m.config, "escaliers", "carrousel");
  assert.equal(bv.modifiable, false);
  assert.match(bv.brut, /slides en vrac/);
  assert.equal(detail(m.config, "faim-a-16h", {}).brief.texte, "Bonjour.");
});

test("vue Montage : rushs titrés par rôle avec les mots du plan, prises pas encore arrivées", () => {
  const m = nouveau();
  const s = "faim-a-16h";
  m.contenu(s);
  m.ecrire(`depot/contenus/${s}/script.md`, SCRIPT);
  m.json("depot/tournages/2026-11-16-1400.json", { version: 1, id: "2026-11-16-1400", cree_le: "2026-11-16T14:00:00+01:00",
    contenus: [s], duree_estimee_min: 20, prises: [
      { n: 1, type: "face", contenus: [{ slug: s, usages: [] }], lieu: "salon", materiel: [], ce_qu_on_voit: "toi", mouvements: [], duree_s: 50, deja_en_bibliotheque: null },
      { n: 2, type: "b-roll", contenus: [{ slug: s, usages: [{ mouvement: 1, phrase: "tu ouvres le placard" }] }], lieu: "cuisine", materiel: [],
        ce_qu_on_voit: "une seule prise", mouvements: ["tu ouvres le placard", "tu sors le skyr"], duree_s: 12, deja_en_bibliotheque: null },
      { n: 3, type: "b-roll", contenus: [{ slug: s, usages: [{ mouvement: 1, phrase: "tu marches" }] }], lieu: "parc", materiel: [],
        ce_qu_on_voit: "une prise", mouvements: ["tu marches"], duree_s: 8, deja_en_bibliotheque: null },
      { n: 4, type: "photo", contenus: [{ slug: s, usages: [] }], lieu: "cuisine", materiel: [], ce_qu_on_voit: "ton bol de skyr", mouvements: [], duree_s: 0, deja_en_bibliotheque: null },
    ] });
  m.ecrire(`Contenu/${s}/face/IMG_1.MOV`, "v");
  m.ecrire("Contenu/_bibliotheque/b-roll/20261116-143012-kq3x.mov", "v");
  m.ecrire("Contenu/_bibliotheque/vignettes/20261116-143012-kq3x-2.jpg", "j");
  m.json("Contenu/_bibliotheque/index.json", { version: 1, clips: { "20261116-143012-kq3x": {
    fichier: "_bibliotheque/b-roll/20261116-143012-kq3x.mov", duree_s: 13.2, lieu: "cuisine", ce_qu_on_voit: "Romain ouvre un placard.",
    mouvements: ["ouvre le placard"], contenus: [s], tournage: "2026-11-16-1400", prise: 2,
    vignettes: ["_bibliotheque/vignettes/20261116-143012-kq3x-1.jpg", "_bibliotheque/vignettes/20261116-143012-kq3x-2.jpg"] } } });
  fs.mkdirSync(path.join(m.media, s, "b-roll"), { recursive: true });
  fs.symlinkSync("../../_bibliotheque/b-roll/20261116-143012-kq3x.mov", path.join(m.media, s, "b-roll", "20261116-143012-kq3x.mov"));
  const d = detail(m.config, s, {});
  assert.deepEqual(d.fichiers, ["idee", "brief", "montage"]);
  const [face, broll] = d.montage.rushs;
  assert.equal(face.titre, "Plan face caméra");
  assert.equal(face.id, "face/IMG_1.MOV");
  assert.equal(broll.titre, "Tu ouvres le placard, puis tu sors le skyr");
  assert.equal(broll.detail, "Cuisine · 13 s · pour « tu ouvres le placard » Ce que je vois : Romain ouvre un placard.");
  assert.equal(broll.vignette_url, "/api/media/_bibliotheque/vignettes/20261116-143012-kq3x-2.jpg");
  assert.deepEqual(d.montage.manquants.map((x) => x.titre), ["Tu marches", "Photo : ton bol de skyr"]);
  assert.ok(!JSON.stringify(d.montage).includes(m.racine));
  assert.equal(face.detail, "Reconnu à ce que tu dis dans ton texte.");
  assert.equal(face.range_par_toi, undefined);
  // Une prise sautée dans le plan (« Je ne la fais pas ») n'est plus attendue (test de bout en bout du 18/11).
  m.json("studio/tournages/2026-11-16-1400.json", { version: 1, coches: [1], sautees: [3], envoi: true });
  assert.deepEqual(detail(m.config, s, {}).montage.manquants.map((x) => x.titre), ["Photo : ton bol de skyr"]);
  // Vidéo mise de côté par le rangement puis rangée à la main dans « À ranger » : elle n'a pas été reconnue.
  m.json("Contenu/_journal-rangement.json", { version: 1, rangements: [
    { id: "a", commande: "ranger", tournage: "2026-11-16-1400", ops: [{ op: "deplacement", de: "/x/IMG_1.MOV", vers: path.join(m.media, "_a-ranger", "IMG_1.MOV"), raison: "a_ranger" }], annule: null },
    { id: "b", commande: "placer", tournage: "2026-11-16-1400", ops: [{ op: "deplacement", de: "/y", vers: path.join(m.media, s, "face", "IMG_1.MOV"), raison: "face" }], annule: null }] });
  const facePlacee = detail(m.config, s, {}).montage.rushs[0];
  assert.equal(facePlacee.detail, "Rangée ici par toi.");
  assert.equal(facePlacee.range_par_toi, true);
  fs.rmSync(path.join(m.media, "_journal-rangement.json"));
  fs.rmSync(path.join(m.home, "tournages"), { recursive: true });
  // Les plans de tournage : liste (en cours tant qu'une face manque) et lecture.
  m.ecrire("depot/tournages/2026-11-16-1400.md", "# Ton tournage\n");
  const [t] = listeTournages(m.config);
  assert.deepEqual(t, { id: "2026-11-16-1400", cree_le: "2026-11-16T14:00:00+01:00", contenus: [s], duree_estimee_min: 20, valide: false, en_cours: false });
  const lu = lireTournage(m.config, "2026-11-16-1400");
  assert.equal(lu.texte, "# Ton tournage");
  assert.deepEqual(lu.contenus, [{ slug: s, titre: `Titre ${s}` }]);
});
