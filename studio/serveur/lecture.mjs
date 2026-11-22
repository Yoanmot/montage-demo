// Lecture du dépôt du head of content (DEPOT) et du dossier média (MEDIA) : instantanés pour le
// calcul des stades, objets Carte et CarteDetail (contrat, section 10), fichiers à ranger.
// Lecture seule : ce module n'écrit rien.
import path from "node:path";
import fs from "node:fs";
import {
  lireJson, lireTexte, empreinteFichier, existe, stat, lister, isoZurich, lundiDe,
  SLUG_RE, EXT_IMAGE, EXT_VIDEO, lireDate, jourZurich, isoZurich as iso,
} from "./outils.mjs";
import { stade, libelle, estMonte, estOriginale, sortieAConfirmer } from "./stades.mjs";
import { contact } from "./client.mjs";
import { ressourcesActives, dossiersDeContenus, ressourceDuDossier } from "./ressources.mjs";
import { videoMonteeDe, versionVideo } from "./vignettes.mjs";
import { autresFichiers } from "./autres.mjs";
import { listePlateformes } from "../publication/plateformes.mjs";
import { Galerie, dossierGalerie, lienVersId, prisesEffectives, plansDuScript } from "../rangement/lib/galerie.mjs";
import { stockDuBrief, photosDuCarrousel, urlVignette } from "./galerie.mjs";

export function urlMedia(...segments) {
  return "/api/media/" + segments.flatMap((s) => String(s).split("/")).filter(Boolean)
    .map(encodeURIComponent).join("/");
}

// ---------------------------------------------------------------- le genre d'un reel

// Comment un reel se tourne (2026-11-20, champ `genre` de etat.json et des propositions, écrit par les outils du
// head of content : commun.GENRES). Sans genre : face caméra ; un brief qui n'a qu'un « Texte à l'écran » (reel muet
// d'avant ce champ) se tourne en plans filmés avec texte. Même règle que commun.genre_de.
export const GENRES = ["face-camera", "plans-texte", "plans-voix"];
export function genreDe(etat, scriptMd = null) {
  if (GENRES.includes(etat?.genre)) return etat.genre;
  const titres = [...String(scriptMd || "").matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => normaliser(m[1]));
  if (titres.some((x) => x.startsWith("texte a l'ecran") || x.startsWith("texte a l ecran")) && !titres.some((x) => x.startsWith("texte complet"))) {
    return "plans-texte";
  }
  return "face-camera";
}
export function genreDuContenu(config, slug) {
  const dossier = path.join(config.depot, "contenus", slug);
  return genreDe(lireJson(path.join(dossier, "etat.json"), null), lireTexte(path.join(dossier, "script.md"), null));
}

// ---------------------------------------------------------------- script.md

// Titres de sections de script.md (modèle du lot 9, contrat section 4) et des anciens scripts. Même
// table que outils/brief.py du head of content (qui écrit ces sections quand Romain retouche son brief).
const SECTIONS = [
  ["accroches", "accroches"],
  ["texte complet", "script"],
  ["texte a l'ecran", "script"],
  ["texte a l ecran", "script"],
  ["a l'ecran", "script"],
  ["plans a tourner", "plans"],
  ["a filmer en plus", "a_filmer"],
  ["photos a envoyer", "photos"],
  ["legende tiktok", "legende_tiktok"],
  ["legende", "legende"],
  ["message automatique", "message_auto"],
  ["a verifier", "a_verifier"],
  ["en points", "en_points"],
  ["conseils", "conseils"],
];

function normaliser(t) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/’/g, "'").toLowerCase().replace(/\s+/g, " ").trim();
}

// Une ancienne section « Photos à envoyer », au format des plans à tourner (« - Photo : ... »).
function enPhotos(t) {
  return String(t || "").split("\n").map((l) => l.trim())
    .filter((l) => l && !/^[-*\s(]*rien[\s.)]*$/i.test(l))
    .map((l) => l.replace(/^[-*]\s*/, ""))
    .map((l) => `- ${normaliser(l).startsWith("photo") ? l : `Photo : ${l}`}`).join("\n");
}

// La ligne d'aide entre parenthèses qui ouvrait « À filmer en plus » (ancien modèle) ne se montre pas.
function sansConsigne(t) {
  const l = String(t || "").split("\n");
  while (l.length && /^\(.*\)\s*$/.test(l[0].trim())) l.shift();
  return l.join("\n").trim();
}

// Découpe contenus/<slug>/script.md par ses titres « ## ». Ancien script : « À filmer en plus » et
// « Photos à envoyer » deviennent `plans` ; « En points » et « Conseils de tournage » ne sont plus montrés.
export function decouperScript(texte) {
  const brut = decouperBrut(texte);
  const textes = {};
  for (const k of ["accroches", "script", "plans", "legende", "message_auto", "a_verifier"]) if (brut[k]) textes[k] = brut[k];
  if (!textes.plans) {
    const plans = [sansConsigne(brut.a_filmer), enPhotos(brut.photos)].filter(Boolean).join("\n");
    if (plans) textes.plans = plans;
  }
  return textes;
}

// La ligne « - Durée estimée : ≈50 s (40 à 60 s) · ... » de l'en-tête, sans le reste.
export function dureeScript(texte) {
  const m = /^-\s*Dur[ée]e estim[ée]e\s*:\s*(.+)$/m.exec(texte || "");
  if (!m) return null;
  return m[1].split("·")[0].split(/,\s*≈/)[0].replace(" lu ", " ").trim() || null;
}

function decouperBrut(texte) {
  const textes = {};
  if (!texte) return textes;
  const lignes = texte.replace(/\r\n/g, "\n").split("\n");
  let cle = null;
  let tampon = [];
  let dansCode = false;
  const fermer = () => {
    if (cle) {
      const corps = tampon.join("\n").trim();
      if (corps) textes[cle] = textes[cle] ? `${textes[cle]}\n\n${corps}` : corps;
    }
    tampon = [];
  };
  for (const ligne of lignes) {
    if (/^```/.test(ligne)) dansCode = !dansCode;
    const m = !dansCode && /^##\s+(.+?)\s*$/.exec(ligne);
    if (m) {
      fermer();
      const titre = normaliser(m[1]);
      const trouve = SECTIONS.find(([debut]) => titre.startsWith(debut));
      cle = trouve ? trouve[1] : null;
      continue;
    }
    if (cle) tampon.push(ligne);
  }
  fermer();
  return textes;
}

function titreMarkdown(texte) {
  const m = /^#\s+(.+?)\s*$/m.exec(texte || "");
  return m ? m[1].trim() : null;
}

// ---------------------------------------------------------------- idee.md, tel que Romain le lit (lot 12)

const enDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "").trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

// Le fichier Idée sans trace technique : ni la ligne « Écrit par ... » des anciens fichiers, ni les
// identifiants (outlier, proposition), ni les lignes vides de sens. Le fichier, lui, ne change pas.
// Le prénom du client n'y est pas écrit en dur : « idée de Romain du », « ce que Yoan en a dit ».
export function ideePourClient(md, titreDuSlug = () => null) {
  const r = [];
  for (const brut of String(md || "").replace(/\r\n/g, "\n").split("\n")) {
    const l = brut.trimEnd();
    if (/^[ÉE]crit par outils\//i.test(l.trim())) continue;
    const m = /^- ([^:]+?) : ?(.*)$/.exec(l);
    if (!m) { r.push(l); continue; }
    const cle = m[1].trim();
    const v = m[2].trim();
    if (!v || /^aucune?$/i.test(v)) continue;
    if (/^source$/i.test(cle)) {
      let s = v;
      const o = /^outlier\s+\S+?,\s*(@[\w.]+|\?)\s*,\s*(https:\/\/\S+|\?)/i.exec(v);
      const d = /^d[ée]clinaison de ([a-z0-9-]+)(.*)$/i.exec(v);
      const i = /^id[ée]e de [\p{L}-]+ du (\d{4}-\d{2}-\d{2})/iu.exec(v);
      if (o) s = `une vidéo qui a bien marché${o[1] !== "?" ? ` chez ${o[1]}` : ""}${o[2] !== "?" ? ` ([voir la vidéo](${o[2]}))` : ""}`;
      else if (d) s = `tirée de « ${titreDuSlug(d[1]) || "un de tes contenus"} »${/republication/.test(d[2]) ? " (à republier)" : ""}`;
      else if (i) s = `ton idée du ${enDate(i[1]).slice(0, 5)}`;
      r.push(`- D'où elle vient : ${s}`);
      continue;
    }
    if (/^ce que [\p{L}-]+ en a dit$/iu.test(cle)) { r.push(`- Ce que tu en as dit : ${v}`); continue; }
    if (/^(propos[ée]e le|gard[ée]e le|jour pr[ée]vu)$/i.test(cle)) {
      r.push(`- ${cle} : ${enDate(v.replace(/\s*\([^)]*\)\s*$/, ""))}`);
      continue;
    }
    r.push(`- ${cle} : ${v}`);
  }
  return r.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export const ideePourRomain = ideePourClient;

function titreDe(config, slug) {
  const e = lireJson(path.join(config.depot, "contenus", slug, "etat.json"), null);
  return e?.titre || titreMarkdown(lireTexte(path.join(config.depot, "contenus", slug, "idee.md"), "")) || null;
}

// Les accroches de « Accroches proposées » : « 1. (famille) texte » -> { n, texte } (la famille est une
// note du head of content, jamais montrée). Même lecture que outils/brief.py.
export function accrochesDe(section) {
  const r = [];
  for (const l of String(section || "").split("\n")) {
    const m = /^\s*(\d{1,2})\s*[.)]\s*(?:\(([^)]*)\)\s*)?(.+?)\s*$/.exec(l);
    if (!m) continue;
    const v = m[3].trim().replace(/^[«"\s]+|[»"\s]+$/g, "").trim();
    if (v) r.push({ n: Number(m[1]), texte: v });
  }
  return r;
}

const comparable = (s) => normaliser(String(s || "")).replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();

export function accrocheDansTexte(accroches, texte) {
  const premiere = String(texte || "").split("\n").find((l) => l.trim()) || "";
  const debut = comparable(premiere);
  for (const a of accroches) {
    const x = comparable(a.texte);
    if (x && (debut === x || debut.startsWith(`${x} `))) return a.n;
  }
  return null;
}

function accrocheRetenue(texte) {
  const m = /^-\s*Accroche retenue\s*:\s*(\d{1,2})\b/m.exec(texte || "");
  return m ? Number(m[1]) : null;
}

// ---------------------------------------------------------------- le dépôt

export function lireDepot(depot) {
  const propositions = [];
  for (const e of lister(path.join(depot, "propositions"))) {
    if (!e.isFile() || !e.name.endsWith(".json")) continue;
    const d = lireJson(path.join(depot, "propositions", e.name), null);
    for (const idee of d?.idees || []) {
      if (idee?.id) propositions.push({ ...idee, cree_le: d.cree_le, fichier: e.name });
    }
  }
  const contenus = lister(path.join(depot, "contenus"))
    .filter((e) => e.isDirectory() && SLUG_RE.test(e.name)).map((e) => e.name);
  // Les carrousels peuvent n'exister que par leur texte (a-rendre/ ou rendus/).
  for (const sous of ["a-rendre/carrousels", "rendus/carrousels"]) {
    for (const e of lister(path.join(depot, sous))) {
      const slug = e.name.replace(/\.md$/, "");
      if (e.isFile() && e.name.endsWith(".md") && SLUG_RE.test(slug) && !contenus.includes(slug)) {
        contenus.push(slug);
      }
    }
  }
  const tournages = [];
  for (const e of lister(path.join(depot, "tournages"))) {
    if (!e.isFile() || !e.name.endsWith(".json")) continue;
    const t = lireJson(path.join(depot, "tournages", e.name), null);
    if (t && Array.isArray(t.contenus)) tournages.push({ ...t, fichier: e.name });
  }
  const pub = lireJson(path.join(depot, "publications", "registre.json"), {})?.publications || {};
  const rendus = lireJson(path.join(depot, "rendus", "registre.json"), {})?.carrousels || {};
  return { propositions, contenus: contenus.sort(), tournages, pub, rendus };
}

function formatDe(etat, idee, fichiers) {
  if (etat?.format === "reel" || etat?.format === "carrousel") return etat.format;
  const m = /format\s*:\s*\**\s*(reel|carrousel)/i.exec(idee || "");
  if (m) return m[1].toLowerCase();
  if (fichiers.brouillon || fichiers.a_rendre || fichiers.rendu) return "carrousel";
  return "reel";
}

// Instantané d'un contenu : tout ce dont stade() a besoin, lu sur le disque.
export function instantane(config, slug, depotLu) {
  const d = config.depot;
  const dossier = path.join(d, "contenus", slug);
  const etat = lireJson(path.join(dossier, "etat.json"), null);
  const idee = lireTexte(path.join(dossier, "idee.md"), null);
  const faceDir = path.join(config.media, slug, "face");
  const face = lister(faceDir);
  const fichiers = {
    dossier: existe(dossier),
    script: empreinteFichier(path.join(dossier, "script.md")),
    brouillon: empreinteFichier(path.join(dossier, "carrousel.md")),
    a_rendre: empreinteFichier(path.join(d, "a-rendre", "carrousels", `${slug}.md`)),
    rendu: empreinteFichier(path.join(d, "rendus", "carrousels", `${slug}.md`)),
    registre_rendu: depotLu.rendus[slug] || null,
    publication: depotLu.pub[slug] || null,
    face: face.map((e) => e.name),
    // L'aperçu du montage (lot 8) : le montage attend la validation. La planche (<rush>-montage/planche/) est l'outil
    // interne du monteur pour regarder ses moments clés : elle ne fait pas avancer le contenu et ne se montre jamais (19/11).
    planche: face.some((e) => e.isDirectory() && e.name.endsWith("-montage") && existe(path.join(faceDir, e.name, "apercu", "apercu.json"))),
    tournage: depotLu.tournages.some((t) => t.contenus.includes(slug)),
  };
  const contenu = { slug, format: formatDe(etat, idee, fichiers), etat };
  return { contenu, fichiers, etat, idee };
}

function majDe(chemins) {
  let t = 0;
  for (const c of chemins) {
    const s = stat(c);
    if (s && s.mtimeMs > t) t = s.mtimeMs;
  }
  return t ? isoZurich(new Date(t)) : null;
}

// Le tournage le plus récent qui contient ce slug.
export function tournageDe(depotLu, slug) {
  return depotLu.tournages.filter((t) => t.contenus.includes(slug))
    .sort((a, b) => String(b.cree_le || b.id || "").localeCompare(String(a.cree_le || a.id || "")))[0] || null;
}

// "AAAA-MM-JJ HH:MM" (heure de Zurich) d'une entrée du registre des publications.
export function quandPublication(pub) {
  if (!pub || !["programmé", "publié"].includes(pub.statut)) return null;
  const brut = pub.statut === "programmé" ? pub.prevu_le || pub.publie_le : pub.publie_le || pub.prevu_le;
  if (!brut) return null;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(brut)) return brut;
  const d = lireDate(brut);
  return d ? iso(d).slice(0, 16).replace("T", " ") : null;
}

function carteContenu(config, slug, depotLu, etatLocal) {
  const { contenu, fichiers, etat, idee } = instantane(config, slug, depotLu);
  const r = stade(contenu, fichiers, etatLocal);
  const dossier = path.join(config.depot, "contenus", slug);
  const titre = etat?.titre || titreMarkdown(idee)
    || titreMarkdown(lireTexte(path.join(dossier, "script.md"), ""))
    || titreMarkdown(lireTexte(path.join(dossier, "carrousel.md"), ""))
    || titreMarkdown(lireTexte(path.join(config.depot, "a-rendre", "carrousels", `${slug}.md`), ""))
    || titreMarkdown(lireTexte(path.join(config.depot, "rendus", "carrousels", `${slug}.md`), ""))
    || slug;
  const fichiersDossier = lister(dossier).map((e) => path.join(dossier, e.name));
  const faceDir = path.join(config.media, slug, "face");
  const carte = {
    slug,
    titre,
    format: contenu.format,
    stade: r.stade,
    libelle: libelle(r.stade, contenu.format, fichiers.publication),
    activite: r.activite,
    a_toi: r.a_toi,
    ...(r.activite === "erreur" ? { erreur_message: r.erreur_message || `Ça n'a pas marché. Réessaie, et si ça recommence, préviens ${contact()}.` } : {}),
    jour_prevu: etat?.jour_prevu || null,
    semaine: null,
    declinaison_de: etat?.declinaison_de || null,
    maj: majDe([
      ...fichiersDossier,
      path.join(config.depot, "a-rendre", "carrousels", `${slug}.md`),
      path.join(config.depot, "rendus", "carrousels", `${slug}.md`),
      ...lister(faceDir).map((e) => path.join(faceDir, e.name)),
    ]),
  };
  carte.fichiers = fichiersDuDossier(config, slug, contenu.format, fichiers);
  if (contenu.format === "reel") {
    const genre = genreDe(etat, lireTexte(path.join(dossier, "script.md"), null));
    if (genre !== "face-camera") carte.genre = genre;
  }
  // L'image de la carte (lot 10, « Poster ») : la vignette du hook tirée de la vidéo montée (fabriquée à
  // la demande, l'adresse change avec la vidéo), ou la première slide d'un carrousel mis en page.
  const vignette = vignetteDe(config, slug, contenu.format);
  if (vignette) carte.vignette = vignette;
  // Ressource gratuite (client qui a un site de ressources) : un fichier de plus dans le dossier, et
  // son état lu sur le disque (« fiche », « brouillon », « en_ligne »). Depuis le 22/11/2026, c'est la ressource
  // reliée au contenu (elle peut vivre ailleurs et servir plusieurs contenus), ou « aucune » : l'entrée reste,
  // pour en relier une depuis le dossier (pas pour un contenu déjà programmé ou publié).
  const ressource = ressourcesActives(config) ? ressourceDuDossier(config, slug) : null;
  if (ressource && (ressource.slug || !["programme", "publie"].includes(carte.stade))) {
    carte.fichiers.push("ressource");
    carte.ressource = ressource.etat;
    if (ressource.slug) carte.ressource_slug = ressource.slug;
  }
  // Les autres fichiers (19/11) : ce que le head of content a rangé dans le dossier hors de la liste connue.
  if (autresFichiers(dossier, { max: 1 }).length) carte.fichiers.push("autres");
  const quand = quandPublication(fichiers.publication);
  if (quand) carte.publication_quand = quand;
  carte.semaine = lundiDe(etat?.jour_prevu || (quand ? quand.slice(0, 10) : null)) || null;
  const t = tournageDe(depotLu, slug);
  if (t) carte.tournage_id = t.id || t.fichier.replace(/\.json$/, "");
  if (etat?.proposition) carte.proposition_id = etat.proposition;
  return carte;
}

function vignetteDe(config, slug, format) {
  if (format === "reel") {
    const v = videoMonteeDe(config, slug);
    return v ? `/api/cartes/${encodeURIComponent(slug)}/vignette?v=${versionVideo(v)}` : null;
  }
  const dossier = path.join(config.media, slug, "slides");
  const premiere = imagesDe(dossier).find((n) => /^slide-\d+\.(png|jpe?g)$/i.test(n));
  return premiere ? `${urlMedia(slug, "slides", premiere)}?v=${Math.round(stat(path.join(dossier, premiere))?.mtimeMs || 0)}` : null;
}

function carteProposition(p) {
  const r = stade({ slug: null, proposition: { id: p.id, statut: p.statut } });
  return {
    slug: null,
    titre: p.titre || "",
    format: p.format === "carrousel" ? "carrousel" : "reel",
    stade: r.stade,
    libelle: libelle(r.stade),
    activite: null,
    a_toi: false,
    jour_prevu: null,
    semaine: null,
    proposition_id: p.id,
    declinaison_de: p.declinaison_de || null,
    maj: p.date_statut && p.statut !== "proposee" ? p.date_statut : p.cree_le || null,
    angle: p.angle || "",
    accroche: p.accroche || null,
    source: p.source || null,
    pourquoi_maintenant: p.pourquoi_maintenant || "",
    republication: p.republication === true,
    ...(p.format !== "carrousel" && GENRES.includes(p.genre) && p.genre !== "face-camera" ? { genre: p.genre } : {}),
    fichiers: ["idee"],
  };
}

// Les fichiers d'un dossier dans l'arborescence (contrat, section 10, lot 9), chacun seulement quand
// ce qu'il montre existe sur le disque.
function fichiersDuDossier(config, slug, format, f) {
  const base = path.join(config.media, slug);
  const r = ["idee"];
  if (format === "carrousel") {
    if (f.brouillon || f.a_rendre || f.rendu) r.push("brief");
    if (imagesDe(path.join(base, "slides")).some((n) => /^slide-\d+\.(png|jpe?g)$/i.test(n))) r.push("slides");
    return r;
  }
  if (f.script) r.push("brief");
  const rushs = (f.face || []).some(estOriginale) || clipsBroll(path.join(base, "b-roll")).length > 0
    || imagesDe(path.join(base, "photos")).length > 0;
  if (rushs || f.planche || (f.face || []).some(estMonte)) r.push("montage");
  if ((f.face || []).some(estMonte)) r.push("video");
  return r;
}

export function cleCarte(c) {
  return c.slug ? c.slug : `p:${c.proposition_id}`;
}

export function construireCartes(config, etatLocal) {
  const lu = lireDepot(config.depot);
  const cartes = [];
  for (const p of lu.propositions) {
    // Une idée supprimée (« refusee ») n'a plus de carte (lot 12) ; mise de côté : dans « Mis de côté ».
    if (p.statut === "proposee" || p.statut === "de_cote") cartes.push(carteProposition(p));
  }
  for (const slug of dossiersDeContenus(config, lu.contenus)) cartes.push(carteContenu(config, slug, lu, etatLocal));
  return cartes;
}

// ---------------------------------------------------------------- détail d'une carte

function imagesDe(dossier) {
  return lister(dossier)
    .filter((e) => !e.name.startsWith(".") && EXT_IMAGE.has(path.extname(e.name).toLowerCase()))
    .map((e) => e.name).sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
}

function plusRecent(dossier, noms) {
  let meilleur = null;
  let t = -1;
  for (const n of noms) {
    const s = stat(path.join(dossier, n));
    if (s && s.mtimeMs > t) { t = s.mtimeMs; meilleur = n; }
  }
  return meilleur;
}

// Le dossier de montage dont l'aperçu est le plus récent : { dossier (nom), fait (ms) } ou null.
export function apercuDe(faceDir, face = lister(faceDir)) {
  let r = null;
  for (const e of face) {
    if (!e.isDirectory() || !e.name.endsWith("-montage")) continue;
    const s = stat(path.join(faceDir, e.name, "apercu", "apercu.json"));
    if (s && (!r || s.mtimeMs > r.fait)) r = { dossier: e.name, fait: s.mtimeMs };
  }
  return r;
}

// Les notes de correction envoyées sur l'aperçu (écrites par le serveur, jamais par le modèle) : contrat, section 16.
export function notesApercu(dossierMontage) {
  const j = lireJson(path.join(dossierMontage, "notes-apercu.json"), null);
  return Array.isArray(j?.notes) ? j.notes.filter((n) => n && Number.isInteger(n.image) && typeof n.texte === "string") : [];
}

export function detail(config, slug, etatLocal) {
  const lu = lireDepot(config.depot);
  if (!lu.contenus.includes(slug)) return null;
  const carte = carteContenu(config, slug, lu, etatLocal);
  const dossier = path.join(config.depot, "contenus", slug);
  const textes = {};
  const idee = lireTexte(path.join(dossier, "idee.md"), null);
  if (idee) textes.idee = ideePourClient(idee, (s) => (lu.contenus.includes(s) ? titreDe(config, s) : null));
  Object.assign(textes, decouperScript(lireTexte(path.join(dossier, "script.md"), null)));
  // Le texte validé (a-rendre/, puis rendus/) s'il existe, sinon le brouillon.
  const carrousel = lireTexte(path.join(config.depot, "a-rendre", "carrousels", `${slug}.md`), null)
    ?? lireTexte(path.join(config.depot, "rendus", "carrousels", `${slug}.md`), null)
    ?? lireTexte(path.join(dossier, "carrousel.md"), null);
  if (carrousel) textes.carrousel = carrousel.trim();
  const ressource = lireTexte(path.join(dossier, "ressource.md"), null);
  if (ressource) textes.ressource = ressource.trim();
  const tournage = tournageDe(lu, slug);
  if (tournage) {
    const md = lireTexte(path.join(config.depot, "tournages", tournage.fichier.replace(/\.json$/, ".md")), null);
    if (md) textes.tournage = md.trim();
  }

  const base = path.join(config.media, slug);
  const faceDir = path.join(base, "face");
  const face = lister(faceDir);
  const medias = { rushs: [] };
  const montes = face.filter((e) => !e.isDirectory() && estMonte(e.name)).map((e) => e.name);
  const montee = plusRecent(faceDir, montes);
  if (montee) medias.video_montee = urlMedia(slug, "face", montee);
  // L'aperçu (lot 8) remplace la planche : le plus récent des dossiers de montage qui en a un.
  const apercu = apercuDe(faceDir, face);
  if (apercu) {
    medias.apercu = {
      // ?v= : un aperçu refait (après une retouche) change d'adresse, le lecteur le recharge à la même image.
      url: urlMedia(slug, "face", apercu.dossier, "apercu", "apercu.json") + "?v=" + Math.round(apercu.fait),
      base: urlMedia(slug, "face", apercu.dossier) + "/",
      notes: notesApercu(path.join(faceDir, apercu.dossier)).map((n) => ({
        n: n.n, image: n.image, texte: n.texte, traits: n.traits || [], le: n.le,
        prise: Boolean(Date.parse(n.le) < apercu.fait - 1000),
      })),
    };
  }
  // Seules les slide-NN comptent : la mise en page écrit aussi sa planche de contrôle (planche.jpg).
  const slides = imagesDe(path.join(base, "slides")).filter((n) => /^slide-\d+\.(png|jpe?g)$/i.test(n));
  if (slides.length) medias.slides = slides.map((n) => urlMedia(slug, "slides", n));
  const faces = face.filter((e) => !e.isDirectory() && estOriginale(e.name)).map((e) => e.name).sort();
  faces.forEach((n, i) => medias.rushs.push({
    url: urlMedia(slug, "face", n), type: "face",
    libelle: faces.length > 1 ? `ta vidéo face caméra (prise ${i + 1})` : "ta vidéo face caméra",
  }));
  const index = clipsConnus(config);
  for (const e of clipsBroll(path.join(base, "b-roll"))) {
    const clip = index[e.name.replace(/\.[^.]+$/, "")];
    medias.rushs.push({ url: urlMedia(slug, "b-roll", e.name), type: "b-roll", libelle: libelleClip(clip) });
  }
  imagesDe(path.join(base, "photos")).forEach((n, i, tout) => {
    medias.rushs.push({ url: urlMedia(slug, "photos", n), type: "photo", libelle: tout.length > 1 ? `ta photo ${i + 1}` : "ta photo" });
  });

  const r = { ...carte, textes, medias };
  if (carte.fichiers.includes("autres")) {
    r.autres = autresFichiers(dossier).map((f) => ({
      nom: f.nom, dossier: f.dossier, genre: f.genre, taille: f.taille,
      ...(f.genre === "autre" ? {} : { url: `/api/cartes/${encodeURIComponent(slug)}/fichiers/${f.chemin.split("/").map(encodeURIComponent).join("/")}?v=${f.maj}` }),
    }));
  }
  const brief = briefDe(config, slug, carte.format);
  if (brief) r.brief = brief;
  // Lot 15 : les plans du brief déjà en stock ou à tourner (stock.json du head of content, choix du client), et les
  // photos d'un carrousel choisies slide par slide dans la Galerie (avec les propositions de l'agent s'il y en a).
  try {
    if (carte.format === "reel") { const st = stockDuBrief(config, slug); if (st) r.stock = st; }
    else r.photos_slides = photosDuCarrousel(config, slug);
  } catch { /* Galerie illisible : le brief s'affiche comme avant */ }
  if (carte.fichiers.includes("montage")) r.montage = montageDe(config, slug, lu, tournage);
  const pub = lu.pub[slug];
  if (pub) {
    r.publication = { statut: pub.statut, quand: pub.prevu_le || pub.publie_le || null, lien: pub.lien || null,
      // Lot 13 : une ligne par plateforme (Instagram, TikTok) : statut, lien, heure, erreur. Une entrée d'avant = Instagram.
      plateformes: listePlateformes(pub) };
    // Lot 12 : l'heure prévue est passée, Instagram n'a pas encore confirmé (relu chez Zernio après chaque synchro).
    if (sortieAConfirmer(pub)) r.publication.a_confirmer = true;
    if (pub.statut === "failed") r.publication.refuse = true;
  }
  const res = carte.ressource_slug || slug;
  if (config.apercuRessources && existe(path.join(config.depot, "site", res, "index.html"))) {
    r.ressource_url = `${config.apercuRessources.replace(/\/$/, "")}/${res}/`;
  }
  return r;
}

function duree(s) {
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n < 60) return ` (${Math.round(n)} s)`;
  const m = Math.floor(n / 60);
  const r = Math.round(n % 60);
  return ` (${m} min${r ? ` ${r} s` : ""})`;
}

const ARTICLES = /^(la|le|les|l'|au|aux|à|dans|sur|en|chez|devant)\b/i;

// « : tu verses le skyr dans un bol » à partir de ce que le modèle a vu (court, sans nom de fichier).
function ceQuOnVoit(vu) {
  let t = String(vu?.ce_qu_on_voit || "").replace(/\s+/g, " ").trim().replace(/[.!]+$/, "");
  if (!t) return "";
  if (t.length > 48) t = `${t.slice(0, 47).replace(/\s+\S*$/, "")}…`;
  return ` : ${t.charAt(0).toLowerCase()}${t.slice(1)}`;
}

// « ton plan dans la cuisine (18 s) » à partir de l'entrée de la bibliothèque.
export function libelleClip(clip) {
  if (!clip) return "ton plan filmé en plus";
  const lieu = String(clip.lieu || "").trim();
  const ou = lieu ? (ARTICLES.test(lieu) ? ` ${lieu}` : ` : ${lieu}`) : "";
  return `ton plan${ou}${duree(clip.duree_s)}`;
}

// Chemins réels utiles au montage et à la publication (jamais montrés à Romain).
export function videoFace(config, slug) {
  const faceDir = path.join(config.media, slug, "face");
  const noms = lister(faceDir).filter((e) => !e.isDirectory() && estOriginale(e.name)).map((e) => e.name);
  const n = plusRecent(faceDir, noms);
  return n ? path.join(faceDir, n) : null;
}

export function videosFace(config, slug) {
  const faceDir = path.join(config.media, slug, "face");
  return lister(faceDir).filter((e) => !e.isDirectory() && estOriginale(e.name)).map((e) => path.join(faceDir, e.name)).sort();
}

export function videoMontee(config, slug) {
  const faceDir = path.join(config.media, slug, "face");
  const noms = lister(faceDir).filter((e) => !e.isDirectory() && estMonte(e.name)).map((e) => e.name);
  const n = plusRecent(faceDir, noms);
  return n ? path.join(faceDir, n) : null;
}

// Les clips de MEDIA/<slug>/b-roll/ : les liens (ou fichiers) vidéo seulement. La brique b-roll du
// monteur écrit ses vignettes dans un dossier b-roll-vignettes/ au même endroit : ce n'est pas un clip.
function clipsBroll(dossier) {
  return lister(dossier).filter((e) => !e.name.startsWith(".") && !e.isDirectory()
    && EXT_VIDEO.has(path.extname(e.name).toLowerCase()));
}

export function brolls(config, slug) {
  return clipsBroll(path.join(config.media, slug, "b-roll")).map((e) => path.join(config.media, slug, "b-roll", e.name));
}

// ---------------------------------------------------------------- à ranger

export function aRanger(config) {
  const dossier = path.join(config.media, "_a-ranger");
  const j = lireJson(path.join(dossier, "a-ranger.json"), null);
  const infos = new Map();
  const liste = Array.isArray(j) ? j : Array.isArray(j?.fichiers) ? j.fichiers
    : j?.fichiers && typeof j.fichiers === "object"
      ? Object.entries(j.fichiers).map(([nom, v]) => ({ nom, ...v })) : [];
  for (const f of liste) if (f?.nom) infos.set(f.nom, f);
  const r = [];
  for (const e of lister(dossier)) {
    if (e.isDirectory() || e.name.startsWith(".") || e.name === "a-ranger.json") continue;
    const ext = path.extname(e.name).toLowerCase();
    if (!EXT_VIDEO.has(ext) && !EXT_IMAGE.has(ext)) continue;
    const i = infos.get(e.name) || {};
    const video = EXT_VIDEO.has(ext);
    const type = i.type_probable || i.type;
    const genre = type === "face" ? "ta vidéo face caméra" : type === "b-roll" ? "ton plan"
      : type === "photo" || !video ? "ta photo" : "ta vidéo";
    const f = {
      nom: e.name,
      libelle: `${genre}${ceQuOnVoit(i.vu)}${duree(i.duree_s)}`,
      url: urlMedia("_a-ranger", e.name),
      raison: i.raison || "je n'ai pas su où le ranger",
      // Lot 15 : ce que le bandeau « Arrivés, à placer » de la Galerie dit du fichier (genre, jour de prise, durée).
      type: type || (video ? null : "photo"), pris_le: i.pris_le || null, duree_s: i.duree_s ?? null,
      candidats: Array.isArray(i.candidats) ? i.candidats.filter((c) => c && c.slug)
        .map((c) => ({ slug: c.slug, type: c.type || null, score: typeof c.score === "number" ? c.score : null })) : [],
    };
    // Vignette posée par le rangement (contrat, section 11) : _a-ranger/.vignettes/<nom>.jpg.
    if (existe(path.join(dossier, ".vignettes", `${e.name}.jpg`))) f.vignette_url = urlMedia("_a-ranger", ".vignettes", `${e.name}.jpg`);
    r.push(f);
  }
  return r.sort((a, b) => a.nom.localeCompare(b.nom));
}

// Copie de l'index de la bibliothèque sans chemins (contrat, section 2).
export function indexSansChemins(config) {
  const idx = lireJson(path.join(config.media, "_bibliotheque", "index.json"), null);
  if (!idx?.clips) return null;
  const clips = {};
  for (const [id, c] of Object.entries(idx.clips)) {
    const { fichier, origine, vignettes, archive, ...reste } = c;
    clips[id] = reste;
  }
  return { version: idx.version || 1, clips };
}

export { fs };

// ---------------------------------------------------------------- le brief (lot 9)

// Le fichier « Brief » : reel, script.md ; carrousel, son brouillon (sinon a-rendre/ puis rendus/,
// pour un carrousel d'avant le studio). Même choix que outils/brief.py, qui écrit les retouches.
function fichierBrief(config, slug, format) {
  const dossier = path.join(config.depot, "contenus", slug);
  const candidats = format === "carrousel"
    ? [path.join(dossier, "carrousel.md"), path.join(config.depot, "a-rendre", "carrousels", `${slug}.md`),
      path.join(config.depot, "rendus", "carrousels", `${slug}.md`)]
    : [path.join(dossier, "script.md")];
  return candidats.find((p) => existe(p)) || null;
}

export function blocJson(texte) {
  const m = /^```json[ \t]*\n([\s\S]*?)\n```[ \t]*$/m.exec(texte || "");
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

// L'outil du head of content sait-il retirer un plan (brief.py retirer-plan) ? Un dépôt pas encore à jour : pas de bouton.
export function retraitPossible(config) {
  return /\bretirer-plan\b/.test(lireTexte(path.join(config.depot, "outils", "brief.py"), "") || "");
}

export function briefDe(config, slug, format) {
  const f = fichierBrief(config, slug, format);
  if (!f) return null;
  const texte = lireTexte(f, "") || "";
  const brut = decouperBrut(texte);
  const empreinte = empreinteFichier(f);
  if (format === "carrousel") {
    const j = blocJson(texte);
    const slides = Array.isArray(j?.slides) ? j.slides.map((s, i) => ({
      n: i + 1, titre: String(s?.titre || ""), texte: String(s?.texte || ""),
      photo: String(s?.["photo-a-prevoir"] || s?.photo || ""),
    })) : [];
    const ok = slides.length > 0;
    return { genre: "carrousel", empreinte, slides, legende: brut.legende || null, a_verifier: brut.a_verifier || null,
      modifiable: ok, brut: ok ? null : texte.trim() };
  }
  const textes = decouperScript(texte);
  const accroches = accrochesDe(textes.accroches);
  const dans = accrocheDansTexte(accroches, textes.script);
  const retenue = accrocheRetenue(texte);
  return {
    genre: "reel", empreinte, texte: textes.script || null, plans: textes.plans || null, legende: textes.legende || null,
    // Les plans un par un, numérotés comme l'outil du head of content : chacun se retire d'un clic (22/11/2026).
    plans_liste: plansDuScript(texte).map(({ n, type, texte: t }) => ({ n, type, texte: t })),
    plans_retirables: retraitPossible(config),
    // Lot 12 : les accroches proposées, et celle par laquelle le texte commence (sinon celle de l'en-tête).
    accroches, accroche: dans ?? (accroches.some((a) => a.n === retenue) ? retenue : null),
    message_auto: textes.message_auto || null, a_verifier: textes.a_verifier || null,
    duree: dureeScript(texte),
  };
}

// La date de dernière écriture du brief (pour prévenir le chat quand Romain l'a retouché).
export function dateBrief(config, slug, format) {
  const f = fichierBrief(config, slug, format);
  return f ? stat(f)?.mtimeMs ?? null : null;
}

// ---------------------------------------------------------------- la vue Montage (lot 9)

const majuscule = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const egaux = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);

function sujetPrise(p) {
  const m = (p?.mouvements || []).filter(Boolean);
  if (m.length) return majuscule(m.join(", puis "));
  return majuscule(String(p?.ce_qu_on_voit || "").trim()) || null;
}

function phrasesPour(prise, slug) {
  const c = (prise?.contenus || []).find((x) => x.slug === slug);
  return (c?.usages || []).map((u) => u.phrase).filter(Boolean);
}

function dureeCourte(s) {
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n < 60 ? `${Math.round(n)} s` : `${Math.floor(n / 60)} min ${Math.round(n % 60)} s`;
}

// Les rushs rangés dans MEDIA/<slug>/, titrés par leur rôle (face caméra, sujet du plan, photo), et les
// prises du plan de tournage prévues pour ce contenu qui ne sont pas encore arrivées.
// Qui a mis ce fichier là, d'après le journal des rangements : « placer » = le client l'a rangé lui-même
// (« À ranger »), « ranger » = le rangement l'a reconnu. Sans trace : null.
function origineRangement(config, chemin) {
  const j = lireJson(path.join(config.media, "_journal-rangement.json"), null);
  let origine = null;
  for (const r of Array.isArray(j?.rangements) ? j.rangements : []) {
    if (r?.annule) continue;
    // Une voix venue d'un mémo vocal : sa vidéo est fabriquée (création), pas déplacée.
    if ((r.ops || []).some((o) => (o?.op === "deplacement" && o.vers === chemin) || (o?.op === "creation" && o.chemin === chemin))) origine = r.commande === "placer" ? "toi" : "rangement";
  }
  return origine;
}

// Les clips connus, par id : ceux de la bibliothèque d'avant la Galerie, puis les b-rolls de la Galerie (lot 15), sous
// la même forme (tournage, prise, ce qu'on voit, lieu, durée, contenus), avec leur chemin et leur image.
export function clipsConnus(config) {
  const r = {};
  for (const [id, c] of Object.entries(lireJson(path.join(config.media, "_bibliotheque", "index.json"), null)?.clips || {})) {
    r[id] = { ...c, fichierAbs: path.join(config.media, c.fichier || "") };
  }
  const g = new Galerie(dossierGalerie(config));
  for (const f of g.index().fichiers) {
    if (f.type !== "b-roll") continue;
    r[f.id] = {
      galerie: true, fichierAbs: g.chemin(f), tournage: f.origine?.tournage || null, prise: f.origine?.prise ?? null,
      mouvements: [], ce_qu_on_voit: f.description?.titre || f.origine?.vu || null, lieu: f.description?.lieu || null,
      duree_s: f.duree_s ?? null, contenus: [...new Set((f.utilisations || []).map((u) => u.slug))], utilisations: f.utilisations || [],
      vignette_url: urlVignette(f),
    };
  }
  return r;
}

export function montageDe(config, slug, lu, tournage) {
  const base = path.join(config.media, slug);
  const faceDir = path.join(base, "face");
  const rushs = [];
  const faces = lister(faceDir).filter((e) => !e.isDirectory() && estOriginale(e.name)).map((e) => e.name).sort();
  // Reel sans face caméra (2026-11-20) : sa voix seule (plans-voix) ou son plan principal sans parole (plans-texte),
  // rangés là où irait la face caméra.
  const genre = genreDuContenu(config, slug);
  const nomFace = genre === "plans-voix" ? "Ta voix" : genre === "plans-texte" ? "Ta vidéo du reel" : "Plan face caméra";
  faces.forEach((n, i) => {
    // Une vidéo rangée à la main n'a pas été « reconnue » : le dire serait faux (rush mis de côté puis placé).
    const parToi = origineRangement(config, path.join(faceDir, n)) === "toi";
    rushs.push({
      id: `face/${n}`, url: urlMedia(slug, "face", n), type: "face",
      titre: faces.length > 1 ? `${nomFace} (prise ${i + 1})` : nomFace,
      detail: parToi ? "Rangée ici par toi." : genre === "plans-texte" ? "Ton plan principal, filmé sans parler."
        : genre === "plans-voix" ? "Reconnue à ce que tu dis dans ton texte." : "Reconnu à ce que tu dis dans ton texte.",
      ...(parToi ? { range_par_toi: true } : {}),
      // Changer le type (19/11) : en plan filmé en plus, tant que le montage n'a rien fait de cette vidéo.
      ...(existe(path.join(faceDir, `${n.replace(/\.[^.]+$/, "")}-montage`)) ? {} : { changer: { vers: "b-roll" } }),
    });
  });
  const index = clipsConnus(config);
  // Les prises que le client a sautées dans son plan (« Je ne la fais pas ») ne sont plus attendues.
  const idPlan = tournage ? tournage.id || String(tournage.fichier || "").replace(/\.json$/, "") : null;
  const sautees = new Set(idPlan && config.home ? lireJson(path.join(config.home, "tournages", `${idPlan}.json`), null)?.sautees || [] : []);
  // Lot 15 : les prises telles qu'elles valent maintenant (plan pris dans la Galerie après le tournage : servi par son
  // lien, plus attendu ; plan passé « à tourner » après coup : attendu).
  let prisesPlan = tournage?.prises || [];
  try { if (tournage) prisesPlan = prisesEffectives(config, tournage); } catch { /* Galerie illisible */ }
  const prises = prisesPlan.filter((p) => (p.contenus || []).some((c) => c.slug === slug) && !sautees.has(p.n));
  const servies = new Set(prises.filter((p) => p.en_galerie).map((p) => p.n));
  // Le plan principal d'un reel sans parole est arrivé quand sa vidéo du reel est là (rangement, principauxSansParole).
  if (genre === "plans-texte" && faces.length) {
    const principale = prises.filter((p) => p.type === "b-roll" && !p.deja_en_bibliotheque && (p.contenus || []).length === 1)
      .sort((a, b) => a.n - b.n)[0];
    if (principale) servies.add(principale.n);
  }
  for (const e of clipsBroll(path.join(base, "b-roll"))) {
    const id = e.name.replace(/\.[^.]+$/, "");
    const clip = index[id] || null;
    // La prise du plan : par son numéro (rangement du lot 9), sinon « déjà filmé », sinon mêmes mouvements.
    const prise = prises.find((p) => p.type === "b-roll" && clip && clip.tournage === tournage?.id && clip.prise != null && p.n === clip.prise)
      || prises.find((p) => p.deja_en_bibliotheque === id)
      || prises.find((p) => p.type === "b-roll" && clip && egaux(p.mouvements, clip.mouvements))
      || null;
    if (prise) servies.add(prise.n);
    const morceaux = [];
    const lieu = String(prise?.lieu || clip?.lieu || "").trim();
    if (lieu) morceaux.push(majuscule(lieu));
    const d = dureeCourte(clip?.duree_s);
    if (d) morceaux.push(d);
    const phrases = phrasesPour(prise, slug);
    if (phrases.length) morceaux.push(`pour ${phrases.map((x) => `« ${x} »`).join(" et ")}`);
    const vu = String(clip?.ce_qu_on_voit || "").trim().replace(/[.!]+$/, "");
    const r = {
      id: `b-roll/${e.name}`, url: urlMedia(slug, "b-roll", e.name), type: "b-roll",
      titre: sujetPrise(prise) || sujetPrise(clip) || "Ton plan filmé en plus",
      detail: [morceaux.join(" · "), vu && prise ? `Ce que je vois : ${vu}.` : ""].filter(Boolean).join(" "),
    };
    // En face caméra : seulement un clip qui ne sert qu'à ce contenu (sinon on le dit, le bouton reste grisé).
    if (clip) {
      const autres = (clip.contenus || []).filter((s) => s !== slug).length;
      r.changer = autres ? { vers: "face", impossible: "Ce plan sert aussi à un autre contenu." } : { vers: "face" };
    }
    // Rangé à la main (« À ranger », « Ajouter une vidéo », changement de type) : l'étape ne dit pas « toutes seules ».
    if (clip?.galerie ? (clip.utilisations || []).some((u) => u.slug === slug && u.source === "toi")
      : clip && origineRangement(config, clip.fichierAbs) === "toi") r.range_par_toi = true;
    // Un b-roll de la Galerie (lot 15) : « Pas le bon » le retire de ce contenu seulement, il reste dans la Galerie.
    if (clip?.galerie) r.galerie = true;
    const v = (clip?.vignettes || [])[1] || (clip?.vignettes || [])[0];
    if (clip?.vignette_url) r.vignette_url = clip.vignette_url;
    else if (v && existe(path.join(config.media, v))) r.vignette_url = urlMedia(...v.split("/"));
    rushs.push(r);
  }
  const photos = imagesDe(path.join(base, "photos"));
  const prisesPhotos = prises.filter((p) => p.type === "photo");
  const g = new Galerie(dossierGalerie(config));
  photos.forEach((n, i) => rushs.push({
    id: `photos/${n}`, url: urlMedia(slug, "photos", n), type: "photo",
    // Une photo de la Galerie (lot 15) : « Pas la bonne » la retire de ce contenu seulement.
    ...(lienVersId(n) && g.fiche(lienVersId(n).id) ? { galerie: true } : {}),
    titre: prisesPhotos[i] ? `Photo : ${String(sujetPrise(prisesPhotos[i]) || "").replace(/^./, (x) => x.toLowerCase())}` : (photos.length > 1 ? `Ta photo ${i + 1}` : "Ta photo"),
    detail: prisesPhotos[i] && phrasesPour(prisesPhotos[i], slug).length ? `Pour « ${phrasesPour(prisesPhotos[i], slug)[0]} »` : "",
  }));
  prisesPhotos.slice(0, photos.length).forEach((p) => servies.add(p.n));
  const manquants = [];
  if (!faces.length && prises.some((p) => p.type === "face")) manquants.push({ titre: nomFace, detail: "Pas encore arrivé." });
  for (const p of prises) {
    if (p.type === "face" || servies.has(p.n)) continue;
    const phrases = phrasesPour(p, slug);
    manquants.push({
      titre: p.type === "photo" ? `Photo : ${String(sujetPrise(p) || "").replace(/^./, (x) => x.toLowerCase())}` : (sujetPrise(p) || "Un plan filmé en plus"),
      detail: [p.lieu ? majuscule(p.lieu) : "", phrases.length ? `pour « ${phrases[0]} »` : "",
        p.deja_en_bibliotheque ? "déjà filmé, pas encore relié" : "pas encore arrivé"].filter(Boolean).join(" · "),
    });
  }
  return { rushs, manquants };
}

// ---------------------------------------------------------------- les plans de tournage (lot 9)

// Un plan validé est « à finir » quand son dernier rangement a échoué, a laissé un fichier où il était
// (encore en réception, illisible), ou n'a pas trouvé tout ce qui était attendu. Un suivi d'avant ce
// correctif sans aucun fichier rangé l'est aussi : c'est le cas du rangement qui n'a rien trouvé.
export function aFinir(suivi) {
  if (!suivi?.valide_le) return false;
  const r = suivi.rangement;
  if (!r || r.en_cours) return false;
  if (r.erreur) return true;
  if (r.reste) return Boolean(r.reste.videos || r.reste.photos || r.en_attente);
  return !(r.places || r.a_ranger);
}

export function listeTournages(config, lu = lireDepot(config.depot)) {
  return [...lu.tournages]
    .sort((a, b) => String(b.cree_le || b.id || "").localeCompare(String(a.cree_le || a.id || "")))
    .slice(0, 60)
    .map((t) => {
      const id = t.id || t.fichier.replace(/\.json$/, "");
      // Lot 12 : un plan dont Romain a validé la fin est tourné, même si une vidéo est partie dans « À ranger ».
      const suivi = config.home ? lireJson(path.join(config.home, "tournages", `${id}.json`), null) : null;
      const valide = Boolean(suivi?.valide_le);
      return {
        id, cree_le: t.cree_le || null, contenus: t.contenus, duree_estimee_min: t.duree_estimee_min ?? null,
        valide, en_cours: !valide && t.contenus.some((s) => !videosFace(config, s).length),
        // Validé mais pas fini de ranger (rien trouvé, fichier encore en réception, échec) : il reste en vue.
        ...(aFinir(suivi) ? { a_finir: true } : {}),
      };
    });
}

export function lireTournage(config, id) {
  const lu = lireDepot(config.depot);
  const t = lu.tournages.find((x) => (x.id || x.fichier.replace(/\.json$/, "")) === id);
  if (!t) return null;
  const texte = lireTexte(path.join(config.depot, "tournages", t.fichier.replace(/\.json$/, ".md")), null);
  const titres = new Map(construireCartes(config, {}).filter((c) => c.slug).map((c) => [c.slug, c.titre]));
  return {
    id, cree_le: t.cree_le || null, duree_estimee_min: t.duree_estimee_min ?? null,
    contenus: t.contenus.map((s) => ({ slug: s, titre: titres.get(s) || s })),
    texte: texte ? texte.trim() : null,
    brut: t, titres,
  };
}
