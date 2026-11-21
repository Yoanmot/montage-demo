// La Galerie (lot 15, contrat section 18) : le stock (fiche, index, liens physiques), l'entrée par le studio, la
// description par la file (validée, refusée, reprise après coupure), la retouche, la suppression (refusée tant qu'un
// contenu pas posté s'en sert), les photos de carrousel slide par slide, les plans du brief, la règle des 3 vidéos.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { demarrer } from "../studio.mjs";
import { monde, attendreQue } from "./aide.mjs";
import { outil } from "../../rangement/lib/commun.mjs";
import { Galerie, validerDescription, ecart, postes, plansEffectifs, lienVersId, empreintePlans } from "../../rangement/lib/galerie.mjs";
import { reglagesChat } from "../reglages.mjs";
import { messageAction } from "../file.mjs";

const SKIP = process.platform !== "darwin" && "macOS seulement";
const REEL = "pompes-sur-les-genoux";
const CARROUSEL = "ton-assiette-ideale";
const nettoyages = [];
after(async () => { for (const f of nettoyages.reverse()) await f(); });

function requete(port, cookie, methode, chemin, { json, brut } = {}) {
  return new Promise((resolve, reject) => {
    const data = json === undefined ? null : Buffer.from(JSON.stringify(json));
    const corps = data || brut || null;
    const req = http.request({ host: "127.0.0.1", port, method: methode, path: chemin, headers: {
      Host: `127.0.0.1:${port}`, Origin: `http://127.0.0.1:${port}`, Cookie: cookie,
      ...(data ? { "Content-Type": "application/json" } : {}), ...(corps ? { "Content-Length": corps.length } : {}),
    } }, (res) => {
      const m = [];
      res.on("data", (x) => m.push(x));
      res.on("end", () => { const t = Buffer.concat(m).toString("utf8"); let j = null; try { j = JSON.parse(t); } catch { /* texte */ } resolve({ statut: res.statusCode, json: j, octets: Buffer.concat(m).length }); });
    });
    req.on("error", reject);
    if (corps) req.write(corps);
    req.end();
  });
}

function preparer(env = {}) {
  const m = monde();
  m.contenu(REEL, { titre: "Pompes sur les genoux : pas une honte" });
  m.ecrire(`depot/contenus/${REEL}/script.md`, "# Pompes\n\n## Texte complet\nLes pompes sur les genoux.\n\n## Plans à tourner\n- Vidéo, 8 s : ton bol\n- Photo : toi en pompe\n\n## Légende\nLégende\n");
  m.contenu(CARROUSEL, { titre: "Ton assiette idéale en 4 cases", format: "carrousel" });
  m.ecrire(`depot/contenus/${CARROUSEL}/carrousel.md`, "# Assiette\n\n```json\n{\"slides\": [{\"titre\": \"Un\", \"texte\": \"a\", \"photo-a-prevoir\": \"toi à la salle\"}, {\"titre\": \"Deux\", \"texte\": \"b\", \"photo-a-prevoir\": \"un banc\"}, {\"titre\": \"Trois\", \"texte\": \"c\", \"photo-a-prevoir\": \"aucune, fond noir\"}]}\n```\n\n## Légende\nLégende\n");
  return { m, env: { ...m.env, ...env } };
}

// Le pont lance claude avec l'environnement du processus : les réglages du faux claude y vont aussi (remis après).
async function studio({ env = {}, avant = null } = {}) {
  delete process.env.FAUX_CLAUDE_DESCRIPTION;
  const p = preparer(env);
  const avantEnv = {};
  for (const k of ["FAUX_CLAUDE_JOURNAL", "FAUX_CLAUDE_DESCRIPTION"]) { avantEnv[k] = process.env[k]; if (p.env[k] !== undefined) process.env[k] = p.env[k]; else delete process.env[k]; }
  nettoyages.push(async () => { for (const [k, v] of Object.entries(avantEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
  if (avant) avant(p.m);
  const s = await demarrer({ env: p.env, silencieux: true });
  const port = s.config.port;
  const r = await new Promise((ok, ko) => http.get({ host: "127.0.0.1", port, path: `/?t=${s.jeton}`, headers: { Host: `127.0.0.1:${port}` } }, ok).on("error", ko));
  r.resume();
  const cookie = String(r.headers["set-cookie"]).split(";")[0];
  nettoyages.push(async () => { await s.arreter("tests"); p.m.nettoyer(); });
  const g = new Galerie(path.join(p.m.racine, "Galerie"));
  return { ...p, s, g, api: (methode, chemin, o) => requete(port, cookie, methode, chemin, o) };
}

function video(dest, secondes = 3) {
  const r = spawnSync(outil("ffmpeg"), ["-nostdin", "-v", "error", "-y", "-f", "lavfi", "-i", `testsrc2=size=720x1280:rate=30:duration=${secondes}`,
    "-c:v", "libx264", "-pix_fmt", "yuv420p", dest], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return dest;
}
function photo(dest, couleur = "orange") {
  const r = spawnSync(outil("ffmpeg"), ["-nostdin", "-v", "error", "-y", "-f", "lavfi", "-i", `color=c=${couleur}:s=800x1000`, "-frames:v", "1", dest], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return dest;
}
async function envoyer(api, fichier, q = {}) {
  const corps = fs.readFileSync(fichier);
  const route = `/api/galerie/envoyer?${new URLSearchParams({ nom: path.basename(fichier), ...q })}`;
  const v = await api("POST", `${route}&verifier=1&taille=${corps.length}`);
  if (v.statut !== 200) return v;
  return api("POST", route, { brut: corps });
}
const decrite = (g, id) => attendreQue(() => g.fiche(id)?.description || g.fiche(id)?.description_erreur, { delaiMs: 30000 });

// ---------------------------------------------------------------- fonctions pures

test("description : le schéma valide, nettoie, et refuse ce qui manque", () => {
  const ok = validerDescription('Voici :\n```json\n{"titre":"Barre chargée \u2014 vue de côté","ce_qu_on_voit":"Une barre.","action":"La caméra glisse.","lieu":"Ta salle.","cadrage":"Vertical.","personne_a_l_image":false,"passages":[{"debut":2,"fin":6,"note":"net"}],"mots_cles":["Salle","barre","salle"],"inconnu":1}\n```', { type: "b-roll", duree_s: 14 });
  assert.equal(ok.ok, true, ok.pourquoi);
  assert.equal(ok.description.titre, "Barre chargée, vue de côté", "le tiret long devient une virgule");
  assert.deepEqual(ok.description.mots_cles, ["salle", "barre"]);
  assert.equal(ok.description.inconnu, undefined);
  const base = { titre: "Bol", ce_qu_on_voit: "Un bol.", action: "Aucune.", lieu: "Cuisine.", cadrage: "Dessus.", personne_a_l_image: false, passages: [], mots_cles: ["bol"] };
  assert.equal(validerDescription(base, { type: "photo" }).ok, true);
  assert.equal(validerDescription({ ...base, lieu: "" }, { type: "photo" }).ok, false);
  // « "true" » entre guillemets (vu en essai réel) : lu comme vrai ; un texte qui ne dit ni oui ni non reste refusé.
  assert.equal(validerDescription({ ...base, personne_a_l_image: "true" }, { type: "photo" }).description.personne_a_l_image, true);
  assert.equal(validerDescription({ ...base, personne_a_l_image: "non" }, { type: "photo" }).description.personne_a_l_image, false);
  assert.equal(validerDescription({ ...base, personne_a_l_image: "peut-être" }, { type: "photo" }).ok, false);
  // Secondes écrites en texte avec une virgule (vu en essai réel) : lues.
  assert.deepEqual(validerDescription({ ...base, passages: [{ debut: "0,8", fin: "2,5" }] }, { type: "b-roll", duree_s: 5 }).description.passages, [{ debut: 0.8, fin: 2.5 }]);
  assert.equal(validerDescription({ ...base, passages: [{ debut: "début", fin: "2" }] }, { type: "b-roll", duree_s: 5 }).ok, false);
  assert.equal(validerDescription({ ...base, mots_cles: [] }, { type: "photo" }).ok, false);
  assert.equal(validerDescription(base, { type: "b-roll", duree_s: 10 }).ok, false, "un b-roll a au moins un passage");
  assert.equal(validerDescription({ ...base, passages: [{ debut: 3, fin: 30 }] }, { type: "b-roll", duree_s: 10 }).ok, false, "passage après la fin");
  assert.equal(validerDescription({ ...base, passages: [{ debut: 5, fin: 2 }] }, { type: "b-roll", duree_s: 10 }).ok, false);
  assert.equal(validerDescription("Je vois une salle.", { type: "photo" }).ok, false);
});

test("règle des 3 vidéos : calculée sur les vidéos postées, réservée par un contenu pas posté, jamais pour une photo", () => {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), "galerie-ecart-"));
  try {
    const depot = path.join(racine, "depot");
    const jours = (n) => new Date(Date.now() - n * 86400e3).toISOString();
    const pub = {};
    ["v1", "v2", "v3", "v4", "v5"].forEach((s, i) => {
      fs.mkdirSync(path.join(depot, "contenus", s), { recursive: true });
      fs.writeFileSync(path.join(depot, "contenus", s, "etat.json"), JSON.stringify({ format: "reel" }));
      pub[s] = { statut: "publié", publie_le: jours(10 - i) };
    });
    fs.mkdirSync(path.join(depot, "contenus", "c1"), { recursive: true });
    fs.writeFileSync(path.join(depot, "contenus", "c1", "etat.json"), JSON.stringify({ format: "carrousel" }));
    pub.c1 = { statut: "publié", publie_le: jours(1) };
    pub["programme-futur"] = { statut: "programmé", prevu_le: new Date(Date.now() + 86400e3).toISOString() };
    for (const s of ["pas-poste", "programme-futur", "mis-de-cote"]) fs.mkdirSync(path.join(depot, "contenus", s), { recursive: true });
    fs.writeFileSync(path.join(depot, "contenus", "mis-de-cote", "etat.json"), JSON.stringify({ format: "reel", refuse: { le: jours(1) } }));
    fs.mkdirSync(path.join(depot, "publications"), { recursive: true });
    fs.writeFileSync(path.join(depot, "publications", "registre.json"), JSON.stringify({ publications: pub }));
    assert.deepEqual(postes(depot).map((p) => p.slug), ["v1", "v2", "v3", "v4", "v5", "c1"], "le programmé à venir n'est pas sorti");
    const broll = (slugs) => ({ type: "b-roll", utilisations: slugs.map((slug) => ({ slug })) });
    // dans la dernière vidéo (v5) : il y a 1 vidéo, il faut en attendre 2
    let e = ecart(broll(["v5"]), depot);
    assert.deepEqual([e.derniere.il_y_a, e.reutilisable, e.raison, e.attendre, e.videos_postees], [1, false, "recent", 2, 1]);
    // v4 : il y a 2 vidéos (le carrousel c1, posté après, ne compte pas)
    e = ecart(broll(["v1", "v4"]), depot);
    assert.deepEqual([e.derniere.slug, e.derniere.il_y_a, e.reutilisable, e.videos_postees], ["v4", 2, false, 2]);
    // v3 : il y a 3 vidéos, il peut revenir
    assert.equal(ecart(broll(["v3"]), depot).reutilisable, true);
    // pour le contenu qui l'utilise déjà : toujours permis
    assert.equal(ecart(broll(["v5"]), depot, { pour: "v5" }).reutilisable, true);
    // réservé par un contenu pas encore posté (ni un programmé à venir), sauf s'il est mis de côté
    assert.deepEqual([ecart(broll(["pas-poste"]), depot).reutilisable, ecart(broll(["pas-poste"]), depot).raison], [false, "reserve"]);
    assert.equal(ecart(broll(["programme-futur"]), depot).raison, "reserve");
    assert.equal(ecart(broll(["mis-de-cote"]), depot).reutilisable, true);
    assert.equal(ecart(broll(["pas-poste"]), depot, { pour: "pas-poste" }).reutilisable, true);
    // une photo de carrousel resservira sans limite
    assert.equal(ecart({ type: "photo", utilisations: [{ slug: "v5" }, { slug: "pas-poste" }] }, depot).reutilisable, true);
  } finally { fs.rmSync(racine, { recursive: true, force: true }); }
});

test("nom des liens d'un contenu : <id>.<ext> ou slide-NN-<id>.<ext>", () => {
  assert.deepEqual(lienVersId("20261121-101500-ab12.mov"), { id: "20261121-101500-ab12", slide: null });
  assert.deepEqual(lienVersId("slide-02-20261121-101500-ab12.jpg"), { id: "20261121-101500-ab12", slide: 2 });
  assert.equal(lienVersId("IMG_1001.MOV"), null);
});

// ---------------------------------------------------------------- le studio

test("ajouter une photo et une vidéo : dans la Galerie (fichier, fiche, vignettes, index), décrites par la file et le schéma", { skip: SKIP }, async () => {
  const { m, g, api } = await studio();
  let r = await envoyer(api, photo(path.join(m.racine, "IMG_2201.JPG")));
  assert.equal(r.statut, 200, JSON.stringify(r.json));
  const idPhoto = r.json.id;
  r = await envoyer(api, video(path.join(m.racine, "IMG_2202.MOV")));
  assert.equal(r.statut, 200, JSON.stringify(r.json));
  const idVideo = r.json.id;
  const fp = g.fiche(idPhoto), fv = g.fiche(idVideo);
  assert.deepEqual([fp.type, fv.type, fp.origine.genre, fv.duree_s], ["photo", "b-roll", "ajout", 3]);
  assert.ok(fs.existsSync(g.chemin(fp)) && fs.existsSync(g.chemin(fv)));
  assert.equal(fp.vignettes.length, 1);
  assert.equal(fv.vignettes.length, 3);
  assert.ok(fs.existsSync(path.join(m.racine, "IMG_2201.JPG")), "le fichier du Mac n'est pas touché");
  assert.equal(fs.readdirSync(path.join(m.home, "envois")).length, 0);
  // la file décrit chacune (faux claude : réponse valide), la fiche porte la description et l'action qui l'a écrite
  await decrite(g, idPhoto); await decrite(g, idVideo);
  const dp = g.fiche(idPhoto).description, dv = g.fiche(idVideo).description;
  assert.equal(dp.titre, "Bol de flocons vu du dessus");
  assert.deepEqual(dp.passages, []);
  assert.deepEqual(dv.passages, [{ debut: 0.2, fin: 1, note: "net" }]);
  assert.equal(dv.par, "studio");
  assert.match(dv.action_id, /^a-/);
  assert.equal(dv.action, "La caméra glisse.");
  const lancement = m.lancements().filter((x) => x.evenement === "message" && x.images);
  assert.equal(lancement.length, 2, "une session par fichier, images dans le message");
  assert.ok(lancement.every((x) => /Réponds uniquement par un objet JSON/.test(x.texte)));
  const args = m.lancements().filter((x) => x.evenement === "lancement").map((x) => x.argv).find((a) => a.includes("--no-session-persistence"));
  assert.ok(args && args.includes("--tools") && args[args.indexOf("--tools") + 1] === "", "aucun outil pour la session qui décrit");
  // la liste et la fiche
  const v = (await api("GET", "/api/galerie")).json;
  assert.deepEqual([v.total, v.photos, v.brolls, v.pas_utilises, v.en_description], [2, 1, 1, 2, 0]);
  assert.ok(v.taille_totale > 0);
  const fiche = (await api("GET", `/api/galerie/${idVideo}`)).json;
  assert.deepEqual([fiche.titre, fiche.supprimable.ok, fiche.utilisations.length, fiche.origine.genre], ["Barre chargée sur le rack", true, 0, "ajout"]);
  const vig = await api("GET", fiche.vignette_url);
  assert.equal(vig.statut, 200);
  // la copie sans chemins du head of content
  await attendreQue(() => fs.existsSync(path.join(m.depot, "galerie", "index.json")), { delaiMs: 8000 });
  const copie = JSON.parse(fs.readFileSync(path.join(m.depot, "galerie", "index.json"), "utf8"));
  assert.equal(copie.fichiers.length, 2);
  assert.ok(!JSON.stringify(copie).includes(m.racine), "aucun chemin du Mac");
  assert.ok(copie.fichiers.every((f) => f.ecart && f.fichier === undefined));
  // refus propres
  const pdf = path.join(m.racine, "facture.pdf"); fs.writeFileSync(pdf, "x");
  assert.equal((await envoyer(api, pdf)).statut, 415);
  assert.equal((await api("GET", "/api/galerie/pas-un-id")).statut, 404);
});

test("description refusée par le schéma : refaite une fois, puis « pas réussi » ; Réessayer relance ; retouche par le client validée", { skip: SKIP }, async () => {
  const { m, g, api } = await studio({ env: { FAUX_CLAUDE_DESCRIPTION: "invalide" } });
  const r = await envoyer(api, photo(path.join(m.racine, "IMG_3001.JPG")));
  const id = r.json.id;
  await decrite(g, id);
  assert.equal(g.fiche(id).description, null);
  assert.match(g.fiche(id).description_erreur.message, /pas réussi/);
  assert.equal(m.lancements().filter((x) => x.evenement === "message" && x.images).length, 2, "deux essais, pas plus");
  const fiche = (await api("GET", `/api/galerie/${id}`)).json;
  assert.equal(fiche.description, "erreur");
  // retouche par le client : même schéma
  const desc = { titre: "Ma salle", ce_qu_on_voit: "La salle vide.", action: "Aucune : photo.", lieu: "Ta salle.", cadrage: "Vertical.", personne_a_l_image: false, passages: [], mots_cles: ["salle"] };
  assert.equal((await api("POST", `/api/galerie/${id}/description`, { json: { description: { ...desc, lieu: " " } } })).statut, 400);
  const ok = await api("POST", `/api/galerie/${id}/description`, { json: { description: desc } });
  assert.equal(ok.statut, 200, JSON.stringify(ok.json));
  assert.deepEqual([g.fiche(id).description.par, g.fiche(id).description_erreur], ["toi", null]);
  assert.equal(ok.json.titre, "Ma salle");
});

test("reprise : une description coupée par l'arrêt du studio repart en entier au redémarrage", { skip: SKIP }, async () => {
  let id;
  const { g } = await studio({ avant: (m) => {
    // Un fichier déjà dans la Galerie, et une description « en cours » quand le studio s'est arrêté.
    const g0 = new Galerie(path.join(m.racine, "Galerie"));
    const src = photo(path.join(m.racine, "IMG_4001.JPG"));
    const f = g0.ajouter(src, { type: "photo", nom_origine: "IMG_4001.JPG", date: new Date(), origine: { genre: "ajout" } }, { copier: true });
    id = f.id;
    fs.writeFileSync(path.join(m.home, "file.json"), JSON.stringify({ version: 1, actions: [{ id: "a-1", type: "description", galerie: id, lot: "l-1",
      statut: "en_cours", cree_le: new Date().toISOString(), debut: new Date().toISOString(), fin: null, session: `galerie:${id}`, erreur: null }] }));
  } });
  await decrite(g, id);
  assert.equal(g.fiche(id).description.action_id, "a-1", "la même action, reprise");
});

test("photos d'un carrousel slide par slide : choisie dans la Galerie (lien physique), remplacée, ajoutée ; la mise en page les voit", { skip: SKIP }, async () => {
  const { m, g, api } = await studio();
  const a = (await envoyer(api, photo(path.join(m.racine, "A.JPG"), "red"))).json.id;
  const b = (await envoyer(api, photo(path.join(m.racine, "B.JPG"), "blue"))).json.id;
  let r = await api("POST", `/api/cartes/${CARROUSEL}/galerie/poser`, { json: { id: a, slide: 2 } });
  assert.equal(r.statut, 200, JSON.stringify(r.json));
  const lien = path.join(m.media, CARROUSEL, "photos", `slide-02-${a}.jpg`);
  assert.equal(fs.statSync(lien).ino, fs.statSync(g.chemin(g.fiche(a))).ino, "lien physique, pas de place en double");
  assert.deepEqual(g.fiche(a).utilisations.map((u) => [u.slug, u.slide]), [[CARROUSEL, 2]]);
  // la même photo sert aussi à une autre slide ; une autre photo remplace celle de la slide 2
  await api("POST", `/api/cartes/${CARROUSEL}/galerie/poser`, { json: { id: a, slide: 1 } });
  r = await api("POST", `/api/cartes/${CARROUSEL}/galerie/poser`, { json: { id: b, slide: 2 } });
  assert.equal(r.statut, 200);
  assert.deepEqual(fs.readdirSync(path.join(m.media, CARROUSEL, "photos")).sort(), [`slide-01-${a}.jpg`, `slide-02-${b}.jpg`]);
  assert.deepEqual(g.fiche(a).utilisations.map((u) => u.slide), [1]);
  // une nouvelle photo ajoutée pour la slide 3 : dans la Galerie et sur la slide
  const n = (await envoyer(api, photo(path.join(m.racine, "C.JPG"), "green"), { slug: CARROUSEL, slide: "3" })).json.id;
  assert.ok(fs.existsSync(path.join(m.media, CARROUSEL, "photos", `slide-03-${n}.jpg`)));
  const d = (await api("GET", `/api/cartes/${CARROUSEL}`)).json;
  assert.deepEqual(Object.keys(d.photos_slides.choisies).sort(), ["1", "2", "3"]);
  assert.equal(d.photos_slides.choisies[2][0].id, b);
  // les propositions de l'agent (phase 2) s'affichent si elles existent
  m.json(`depot/contenus/${CARROUSEL}/stock.json`, { version: 1, slides: [{ n: 1, propositions: [{ id: b, raison: "c'est ta salle" }, { id: "20260101-000000-zzzz", raison: "partie" }], note: "Pas de photo de toi de face." }] });
  const d2 = (await api("GET", `/api/cartes/${CARROUSEL}`)).json;
  assert.deepEqual(d2.photos_slides.propositions[1].propositions.map((x) => [x.id, x.raison]), [[b, "c'est ta salle"]], "une proposition partie de la Galerie n'est pas montrée");
  assert.equal(d2.photos_slides.propositions[1].note, "Pas de photo de toi de face.");
  // la mise en page reçoit les photos avec leur slide
  const texte = messageAction({ type: "mise_en_page", slug: CARROUSEL }, { ...JSON.parse(JSON.stringify({})), depot: m.depot, media: m.media, skills: "/x", client: { prenom: "Test" } });
  assert.match(texte, new RegExp(`slide-02-${b}\\.jpg \\(choisie par Test pour la slide 2\\)`));
  // refus : une vidéo sur une slide, un id inconnu
  const v = (await envoyer(api, video(path.join(m.racine, "V.MOV")))).json.id;
  assert.equal((await api("POST", `/api/cartes/${CARROUSEL}/galerie/poser`, { json: { id: v, slide: 1 } })).statut, 409);
  assert.equal((await api("POST", `/api/cartes/${CARROUSEL}/galerie/poser`, { json: { id: "20260101-000000-zzzz" } })).statut, 409);
});

test("supprimer : refusé tant qu'un contenu pas posté s'en sert, accepté ensuite (fichier, fiche, liens partis, place libérée)", { skip: SKIP }, async () => {
  const { m, g, api } = await studio();
  const id = (await envoyer(api, photo(path.join(m.racine, "BOL.JPG")))).json.id;
  await api("POST", `/api/cartes/${CARROUSEL}/galerie/poser`, { json: { id, slide: 1 } });
  let r = await api("POST", `/api/galerie/${id}/supprimer`);
  assert.deepEqual([r.statut, r.json.erreur, r.json.slug], [409, "UTILISE", CARROUSEL]);
  assert.match(r.json.message, /Ton assiette idéale en 4 cases/);
  assert.deepEqual((await api("GET", `/api/galerie/${id}`)).json.supprimable, { ok: false, slug: CARROUSEL, titre: "Ton assiette idéale en 4 cases", format: "carrousel" });
  assert.ok(fs.existsSync(g.chemin(g.fiche(id))));
  // posté : la suppression passe, et emporte le lien du contenu (sinon la place n'est pas libérée)
  m.json("depot/publications/registre.json", { version: 1, publications: { [CARROUSEL]: { statut: "publié", publie_le: new Date(Date.now() - 3600e3).toISOString() } } });
  const chemin = g.chemin(g.fiche(id));
  r = await api("POST", `/api/galerie/${id}/supprimer`);
  assert.equal(r.statut, 200, JSON.stringify(r.json));
  assert.ok(!fs.existsSync(chemin));
  assert.equal(g.fiche(id), null);
  assert.deepEqual(fs.readdirSync(path.join(m.media, CARROUSEL, "photos")), []);
  assert.equal((await api("GET", "/api/galerie")).json.total, 0);
  assert.equal((await api("POST", `/api/galerie/${id}/supprimer`)).statut, 404);
});

test("plans du brief : déjà en stock ou à tourner (stock.json + choix du client), liens posés et retirés, règle des 3 vidéos", { skip: SKIP }, async () => {
  const { m, g, api } = await studio();
  const bol = (await envoyer(api, video(path.join(m.racine, "BOL.MOV")))).json.id;
  const barre = (await envoyer(api, video(path.join(m.racine, "BARRE.MOV")))).json.id;
  // la barre vient de passer dans la dernière vidéo postée
  m.contenu("derniere-video", { titre: "Dernière" });
  await api("POST", `/api/cartes/derniere-video/galerie/poser`, { json: { id: barre } });
  m.json("depot/publications/registre.json", { version: 1, publications: { "derniere-video": { statut: "publié", publie_le: new Date(Date.now() - 3600e3).toISOString() } } });
  m.json(`depot/contenus/${REEL}/stock.json`, { version: 1, plans: [
    { n: 1, type: "b-roll", texte: "Vidéo, 8 s : ton bol", essentiel: "préparer un bol", detail: "plan large", phrase: "tu prépares ton bol", stock: { id: bol, debut: 0.5, fin: 2, pourquoi: "même geste" } },
    { n: 2, type: "b-roll", texte: "Vidéo, 4 s : la barre", stock: { id: barre, debut: 0, fin: 2, pourquoi: "ta salle" } },
    { n: 3, type: "photo", texte: "Photo : toi en pompe", stock: null, manque: "Rien ne te montre en pompe." },
  ] });
  let d = (await api("GET", `/api/cartes/${REEL}`)).json;
  assert.deepEqual(d.stock.map((p) => p.etat), ["stock", "a_tourner", "a_tourner"], "la barre, trop récente, repasse à tourner");
  assert.match(d.stock[1].note, /trop récente/);
  assert.equal(d.stock[0].fichier.id, bol);
  assert.equal(d.stock[2].note, "Rien ne te montre en pompe.");
  // « J'en tourne un nouveau »
  let r = await api("POST", `/api/cartes/${REEL}/plans/1`, { json: { choix: "tourner" } });
  assert.deepEqual([r.statut, r.json.etat], [200, "a_tourner"]);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(m.depot, "contenus", REEL, "stock-choix.json"), "utf8")).plans["1"].choix, "tourner");
  // « Prends plutôt celui-là » : refusé pour la barre (règle des 3 vidéos), accepté pour le bol ; lien posé dans le reel
  r = await api("POST", `/api/cartes/${REEL}/plans/2`, { json: { choix: "stock", id: barre } });
  assert.deepEqual([r.statut, r.json.erreur], [409, "RECENT"]);
  assert.match(r.json.message, /attends encore 2 vidéos/);
  r = await api("POST", `/api/cartes/${REEL}/plans/2`, { json: { choix: "stock", id: bol, debut: 1, fin: 2 } });
  assert.deepEqual([r.statut, r.json.etat], [200, "stock"]);
  assert.deepEqual(fs.readdirSync(path.join(m.media, REEL, "b-roll")), [`${bol}.mov`]);
  assert.deepEqual(g.fiche(bol).utilisations.map((u) => [u.slug, u.source]), [[REEL, "stock"]]);
  // une photo pour un plan vidéo : refusé
  const ph = (await envoyer(api, photo(path.join(m.racine, "P.JPG")))).json.id;
  assert.equal((await api("POST", `/api/cartes/${REEL}/plans/2`, { json: { choix: "stock", id: ph } })).json.erreur, "TYPE");
  // retour à « tourner » : le lien posé par le stock part, le fichier reste dans la Galerie
  r = await api("POST", `/api/cartes/${REEL}/plans/2`, { json: { choix: "tourner" } });
  assert.equal(r.json.etat, "a_tourner");
  assert.deepEqual(fs.readdirSync(path.join(m.media, REEL, "b-roll")), []);
  assert.deepEqual(g.fiche(bol).utilisations, []);
  assert.ok(fs.existsSync(g.chemin(g.fiche(bol))));
  // revenir à la proposition : le bol reprend le plan 1, lien reposé ; lecture des plans pour les agents
  await api("POST", `/api/cartes/${REEL}/plans/1`, { json: { choix: "proposition" } });
  d = (await api("GET", `/api/cartes/${REEL}`)).json;
  assert.deepEqual(d.stock.map((p) => p.etat), ["stock", "a_tourner", "a_tourner"]);
  assert.deepEqual(fs.readdirSync(path.join(m.media, REEL, "b-roll")), [`${bol}.mov`]);
  const plans = plansEffectifs({ depot: m.depot, media: m.media, galerie: g.racine }, REEL, { galerie: g });
  assert.deepEqual(plans.map((p) => p.n), [1, 2, 3]);
  // le sélecteur dit ce qui ne peut pas resservir ici, et pourquoi (jamais filtré en silence)
  const v = (await api("GET", `/api/galerie?pour=${REEL}`)).json.fichiers;
  assert.deepEqual([v.find((f) => f.id === barre).reutilisable, v.find((f) => f.id === barre).raison], [false, "recent"]);
  assert.equal(v.find((f) => f.id === bol).reutilisable, true);
});

test("phase 2 : le monteur reçoit les plans pris dans la Galerie ; des plans changés depuis la comparaison la rendent caduque ; l'outil de la Galerie est donné aux sessions", { skip: SKIP }, async () => {
  const { m, g, s, api } = await studio();
  const bol = (await envoyer(api, video(path.join(m.racine, "BOL.MOV")))).json.id;
  const script = fs.readFileSync(path.join(m.depot, "contenus", REEL, "script.md"), "utf8");
  m.json(`depot/contenus/${REEL}/stock.json`, { version: 1, plans_empreinte: empreintePlans(script), plans: [
    { n: 1, type: "b-roll", texte: "Vidéo, 8 s : ton bol", essentiel: "toi ; tu prépares un bol", detail: "plan large", phrase: "tu prépares ton bol",
      stock: { id: bol, debut: 0.5, fin: 2, pourquoi: "même geste" } },
    { n: 2, type: "photo", texte: "Photo : toi en pompe", stock: null, manque: "Rien ne te montre en pompe." },
  ] });
  let d = (await api("GET", `/api/cartes/${REEL}`)).json;
  assert.deepEqual(d.stock.map((p) => p.etat), ["stock", "a_tourner"]);
  await api("POST", `/api/cartes/${REEL}/plans/1`, { json: { choix: "proposition" } });
  const msg = messageAction({ type: "montage", slug: REEL }, s.config);
  assert.match(msg, /Plans de son brief pris dans sa Galerie/);
  assert.ok(msg.includes(`plan 1, pour « tu prépares ton bol » : ${path.join(m.media, REEL, "b-roll", `${bol}.mov`)}, passage proposé de 0.5 à 2 s`), msg);
  assert.match(msg, /Ce qu'il doit montrer : toi ; tu prépares un bol ; détail qui peut différer : plan large\./);
  assert.match(msg, /STUDIO_CODE\/rangement\/galerie\.mjs" montrer/);
  // Un agent pose un plan de la Galerie par l'outil : la copie du head of content le voit (règle des 3 vidéos à jour).
  const autre = (await envoyer(api, video(path.join(m.racine, "SAC.MOV")))).json.id;
  m.contenu("un-autre-reel", { titre: "Autre" });
  const copie = () => { try { return JSON.parse(fs.readFileSync(path.join(m.depot, "galerie", "index.json"), "utf8")); } catch { return null; } };
  await attendreQue(() => copie()?.fichiers.some((f) => f.id === autre), { delaiMs: 8000 });
  await new Promise((r) => setTimeout(r, 1800)); // la copie d'après l'envoi est faite : seul l'outil peut la changer ensuite
  const r0 = spawnSync(process.execPath, [fileURLToPath(new URL("../../rangement/galerie.mjs", import.meta.url)),
    "poser", "un-autre-reel", autre, "--config", s.config.fichier], { env: { ...process.env, ...m.env }, encoding: "utf8" });
  assert.equal(r0.status, 0, r0.stdout + r0.stderr);
  await attendreQue(() => (copie()?.fichiers.find((f) => f.id === autre)?.ecart.reserve || []).includes("un-autre-reel"), { delaiMs: 8000 });
  // Le client retouche ses plans : la comparaison ne vaut plus (brief comme avant, lien du stock retiré au montage suivant).
  m.ecrire(`depot/contenus/${REEL}/script.md`, script.replace("Vidéo, 8 s : ton bol", "Vidéo, 8 s : ton bol de skyr"));
  d = (await api("GET", `/api/cartes/${REEL}`)).json;
  assert.equal(d.stock, undefined);
  assert.equal(plansEffectifs({ depot: m.depot, media: m.media }, REEL, { galerie: g }), null);
  assert.doesNotMatch(messageAction({ type: "montage", slug: REEL }, s.config), /Plans de son brief pris dans sa Galerie/);
  // Toutes les sessions savent où est l'outil de la Galerie et la configuration du studio.
  const r = reglagesChat(`${REEL}:monteur`, s.config);
  assert.ok(fs.existsSync(path.join(r.env.STUDIO_CODE, "rangement", "galerie.mjs")));
  assert.equal(r.env.STUDIO_CONFIG, s.config.fichier);
});

test("arrivé dans « À ranger » avant la Galerie : un clic le fait entrer dans la Galerie", { skip: SKIP }, async () => {
  const { m, g, api } = await studio({ avant: (m) => {
    fs.mkdirSync(path.join(m.media, "_a-ranger"), { recursive: true });
    photo(path.join(m.media, "_a-ranger", "IMG_5000.JPG"));
    m.json("Contenu/_a-ranger/a-ranger.json", { version: 1, fichiers: [{ nom: "IMG_5000.JPG", raison: "je ne sais pas pour quel contenu est cette photo", type_probable: "photo", candidats: [] }] });
  } });
  let e = (await api("GET", "/api/etat")).json;
  assert.equal(e.a_ranger.length, 1);
  assert.equal(e.a_ranger[0].type, "photo");
  const r = await api("POST", "/api/galerie/a-ranger", { json: { fichier: "IMG_5000.JPG" } });
  assert.equal(r.statut, 200, JSON.stringify(r.json));
  assert.equal(g.fiche(r.json.id).nom_origine, "IMG_5000.JPG");
  e = (await api("GET", "/api/etat")).json;
  assert.deepEqual(e.a_ranger, []);
  assert.equal((await api("POST", "/api/galerie/a-ranger", { json: { fichier: "../x" } })).statut, 404);
});
