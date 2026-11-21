// La Galerie vue par le serveur (lot 15, CONTRAT-STUDIO.md section 18) : listes et fiches pour l'interface, le stock
// d'un brief, les photos d'un carrousel, la copie sans chemins pour le head of content, la description par la file.
// Lecture seule ici, sauf la description (validée par le schéma, écrite sous le verrou de la Galerie) ; les écritures
// qui touchent le dossier média passent par rangement/galerie.mjs (outilGalerie).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { CODE } from "./config.mjs";
import { lireJson, existe } from "./outils.mjs";
import { executer, lireVerdict } from "./commandes.mjs";
import { ErreurStudio, MESSAGE_GENERIQUE } from "./depot-outils.mjs";
import { contact, clientActif } from "./client.mjs";
import {
  Galerie, dossierGalerie, ID_GALERIE, ecart, postes, plansEffectifs, photosDesSlides, validerDescription, consigneDescription,
  bloquantsSuppression,
} from "../rangement/lib/galerie.mjs";
import { outil } from "../rangement/lib/commun.mjs";

export { ID_GALERIE, dossierGalerie };
export const galerieDe = (config) => new Galerie(dossierGalerie(config));

const enc = encodeURIComponent;
export const urlFichier = (f) => `/api/galerie/${enc(f.id)}/fichier?v=${f.taille || 0}`;
export function urlVignette(f) {
  const v = f.vignettes || [];
  if (!v.length) return null;
  return `/api/galerie/${enc(f.id)}/vignette?v=${enc(String(f.ajoute_le || "")).slice(-12)}`;
}
// L'image d'une fiche : celle du milieu d'un clip, ou la photo réduite.
export function cheminVignette(g, f) {
  const v = f.vignettes || [];
  const rel = v[1] || v[0];
  return rel ? path.join(g.racine, rel) : null;
}

// Les actions de description de la file, par id de fichier.
function descriptions(actions = []) {
  const r = new Map();
  for (const a of actions) if (a.type === "description" && a.galerie && ["en_file", "en_cours"].includes(a.statut)) r.set(a.galerie, a.statut);
  return r;
}

// Ce que la recherche lit : la description entière, les mots-clés, le type.
function texteRecherche(f) {
  const d = f.description || {};
  return [d.titre, d.ce_qu_on_voit, d.action, d.lieu, d.cadrage, ...(d.mots_cles || []), f.type === "photo" ? "photo" : "b-roll video",
    f.origine?.ligne, f.origine?.vu].filter(Boolean).join(" ");
}

function resume(f, enFile) {
  const slugs = [...new Set((f.utilisations || []).map((u) => u.slug))];
  return {
    id: f.id, type: f.type, titre: f.description?.titre || null, taille: f.taille || 0, duree_s: f.duree_s ?? null,
    orientation: f.orientation || null, pris_le: f.pris_le || null, ajoute_le: f.ajoute_le || null,
    utilise: slugs.length, contenus: slugs,
    description: enFile.has(f.id) ? "en_cours" : f.description ? "faite" : f.description_erreur ? "erreur" : "a_faire",
    url: urlFichier(f), vignette_url: urlVignette(f), recherche: texteRecherche(f),
  };
}

// GET /api/galerie : tous les fichiers (le plus récent d'abord), les compteurs et la place prise.
export function vueGalerie(config, { actions = [], pour = null } = {}) {
  const g = galerieDe(config);
  const enFile = descriptions(actions);
  const sorties = pour ? postes(config.depot) : null;
  // Pour un contenu (sélecteur du brief, du montage, d'une slide) : ce qui peut y resservir, et sinon pourquoi.
  const fichiers = g.index().fichiers.map((f) => {
    const r = resume(f, enFile);
    if (!pour) return r;
    const e = ecart(f, config.depot, { pour, sorties });
    return { ...r, reutilisable: e.reutilisable, raison: e.raison, attendre: e.attendre };
  });
  return {
    fichiers,
    total: fichiers.length,
    photos: fichiers.filter((f) => f.type === "photo").length,
    brolls: fichiers.filter((f) => f.type === "b-roll").length,
    pas_utilises: fichiers.filter((f) => !f.utilise).length,
    taille_totale: fichiers.reduce((s, f) => s + (f.taille || 0), 0),
    en_description: fichiers.filter((f) => f.description === "en_cours").length,
  };
}

// GET /api/galerie/:id : la fiche, ses contenus (titre, étape, posté ou pas), si on peut la supprimer, la règle des 3 vidéos.
export function ficheGalerie(config, id, { actions = [], cartes = [] } = {}) {
  const g = galerieDe(config);
  const f = g.fiche(id);
  if (!f) return null;
  const parSlug = new Map(cartes.filter((c) => c.slug).map((c) => [c.slug, c]));
  const sorties = postes(config.depot);
  const sortis = new Map(sorties.map((p) => [p.slug, p]));
  const vus = new Set();
  const utilisations = [];
  for (const u of f.utilisations || []) {
    if (vus.has(u.slug)) continue;
    vus.add(u.slug);
    const c = parSlug.get(u.slug);
    utilisations.push({
      slug: u.slug, titre: c?.titre || u.slug, format: c?.format || null, stade: c?.stade || null, libelle: c?.libelle || null,
      poste_le: sortis.has(u.slug) ? new Date(sortis.get(u.slug).quand).toISOString() : null, le: u.le || null,
      slides: (f.utilisations || []).filter((x) => x.slug === u.slug && x.slide).map((x) => x.slide),
      existe: Boolean(c),
    });
  }
  const bloquants = bloquantsSuppression(f, config.depot);
  const b = bloquants[0] ? parSlug.get(bloquants[0]) : null;
  let tournage = null;
  if (f.origine?.tournage) {
    const t = lireJson(path.join(config.depot, "tournages", `${f.origine.tournage}.json`), null);
    tournage = t ? { id: f.origine.tournage, cree_le: t.cree_le || null } : { id: f.origine.tournage, cree_le: null };
  }
  return {
    ...resume(f, descriptions(actions)),
    description_detail: f.description || null,
    description_erreur: f.description_erreur?.message || null,
    nom_origine: f.nom_origine || null,
    origine: { genre: f.origine?.genre || "ajout", ligne: f.origine?.ligne || null, tournage },
    utilisations,
    supprimable: bloquants.length ? { ok: false, slug: bloquants[0], titre: b?.titre || bloquants[0], format: b?.format || null } : { ok: true },
    ecart: ecart(f, config.depot, { sorties }),
  };
}

// Le stock d'un brief de reel (section 18) : les plans effectifs avec de quoi les montrer.
export function stockDuBrief(config, slug) {
  const g = galerieDe(config);
  const plans = plansEffectifs(config, slug, { galerie: g });
  if (!plans) return null;
  return plans.map((p) => {
    if (p.etat !== "stock") return p;
    const f = g.fiche(p.stock.id);
    return { ...p, fichier: f ? { id: f.id, type: f.type, titre: f.description?.titre || null, duree_s: f.duree_s ?? null,
      url: urlFichier(f), vignette_url: urlVignette(f) } : null };
  });
}

// Les photos d'un carrousel slide par slide, et les propositions écrites par l'agent (stock.json, « slides »).
export function photosDuCarrousel(config, slug) {
  const g = galerieDe(config);
  const montrer = (id) => {
    const f = g.fiche(id);
    return f ? { id: f.id, titre: f.description?.titre || null, vignette_url: urlVignette(f), url: urlFichier(f),
      utilise: new Set((f.utilisations || []).map((u) => u.slug)).size } : null;
  };
  const posees = photosDesSlides(config.media, slug);
  const choisies = {};
  for (const [n, ids] of Object.entries(posees)) choisies[n] = ids.map(montrer).filter(Boolean);
  const stock = lireJson(path.join(config.depot, "contenus", slug, "stock.json"), null);
  const propositions = {};
  for (const s of Array.isArray(stock?.slides) ? stock.slides : []) {
    const n = Number(s?.n);
    if (!Number.isInteger(n)) continue;
    propositions[n] = {
      propositions: (Array.isArray(s.propositions) ? s.propositions : []).map((p) => {
        const m = montrer(p?.id);
        return m ? { ...m, raison: String(p.raison || "") } : null;
      }).filter(Boolean),
      note: s.note ? String(s.note) : null,
    };
  }
  return { choisies, propositions };
}

// La copie sans chemins pour le head of content (DEPOT/galerie/index.json) : ce qui est en stock, décrit, utilisé, et
// la règle des 3 vidéos, pour qu'il cherche dans la Galerie depuis le cloud comme sur le Mac.
export function galerieSansChemins(config) {
  const g = galerieDe(config);
  if (!existe(g.racine)) return null;
  const sorties = postes(config.depot);
  return {
    version: 1,
    regle: { ecart_min_videos: 3 },
    fichiers: g.index().fichiers.map((f) => {
      const { fichier, vignettes, nom_origine, ...reste } = f;
      return { ...reste, ecart: ecart(f, config.depot, { sorties }) };
    }),
  };
}

// ---------------------------------------------------------------- l'outil (écritures)

const PHRASES = {
  OCCUPE: "Un rangement est en cours : réessaie dans un instant.",
  INCONNU: "Ce fichier n'est plus dans ta Galerie.",
  CONTENU: "Je ne trouve pas ce contenu.",
  TYPE: "Ce n'est pas le bon genre de fichier pour ici.",
  RESERVE: "Ce plan sert déjà à un autre contenu pas encore posté : prends-en un autre.",
  FORMAT: "Je ne sais garder que des vidéos (MOV, MP4) et des photos (JPG, HEIC, PNG).",
  ILLISIBLE: "Je n'arrive pas à lire cette vidéo : rien n'est gardé. Essaie de l'exporter à nouveau.",
  FICHIER: "Je ne trouve plus ce fichier.",
  PLAN: "Je ne trouve plus ce plan dans ton brief : recharge.",
  SLIDE: "Je ne trouve pas cette slide.",
  SCHEMA: "Cette description n'est pas complète : remplis chaque ligne.",
};

export async function outilGalerie(config, args, { delaiMs = 10 * 60000 } = {}) {
  const script = path.join(CODE, "rangement", "galerie.mjs");
  if (!existe(script)) throw new ErreurStudio("GALERIE_ABSENTE", `Cette partie n'est pas encore installée sur ton Mac. Préviens ${contact()}.`, 503);
  const r = await executer(process.execPath, [script, ...args, "--config", config.fichier], {
    cwd: CODE, env: { ...process.env, STUDIO_CONFIG: config.fichier }, delaiMs,
  });
  const v = lireVerdict(r.sortie);
  if (v?.ok) return { ...v, sortie: r.sortie };
  if (v && !v.ok) {
    const e = new ErreurStudio(v.code, v.code === "RECENT" ? phraseRecente(v.message) : PHRASES[v.code] || MESSAGE_GENERIQUE, 409);
    e.detail = v.message || null;
    throw e;
  }
  throw new ErreurStudio("GALERIE_ECHEC", `Ça n'a pas marché. Réessaie, et si ça recommence, préviens ${contact()}.`, 500);
}

function phraseRecente(message) {
  const n = /attends encore (\d+)/.exec(String(message || ""))?.[1];
  return n ? `Ce plan est passé dans une vidéo trop récente : attends encore ${n} vidéo${n > 1 ? "s" : ""} avant de le reprendre.`
    : "Ce plan est passé dans une vidéo trop récente : prends-en un autre.";
}

// ---------------------------------------------------------------- la description (file des actions)

// Les images d'un clip, prises à intervalles réguliers (3 à 8), avec leur instant ; une photo réduite.
function imagesDe(g, f, travail) {
  const chemin = g.chemin(f);
  if (f.type === "photo") {
    const vers = path.join(travail, "photo.jpg");
    const r = spawnSync("/usr/bin/sips", ["-s", "format", "jpeg", "-Z", "1024", chemin, "--out", vers], { encoding: "utf8" });
    if (r.status !== 0 || !fs.existsSync(vers)) {
      spawnSync(outil("ffmpeg"), ["-nostdin", "-v", "error", "-y", "-i", chemin, "-frames:v", "1", "-vf", "scale=-2:1024", vers]);
    }
    return fs.existsSync(vers) ? [{ chemin: vers, t: null }] : [];
  }
  const L = Math.max(0.2, Number(f.duree_s) || 1);
  const n = Math.max(3, Math.min(8, Math.ceil(L / 2)));
  const r = [];
  for (let i = 0; i < n; i++) {
    const t = Math.round(((i + 0.5) * L / n) * 10) / 10;
    const img = path.join(travail, `image-${i + 1}.jpg`);
    const x = spawnSync(outil("ffmpeg"), ["-nostdin", "-v", "error", "-y", "-ss", t.toFixed(2), "-i", chemin, "-frames:v", "1",
      "-vf", "scale=-2:480", "-q:v", "4", img]);
    if (x.status === 0 && fs.existsSync(img)) r.push({ chemin: img, t });
  }
  return r;
}

// Le message de la session qui décrit un fichier : la consigne, puis les images. null si le fichier n'est plus là.
export function messageDescription(config, id) {
  const g = galerieDe(config);
  const f = g.fiche(id);
  if (!f || !existe(g.chemin(f))) return null;
  fs.mkdirSync(path.join(config.home, "galerie-travail"), { recursive: true });
  const travail = fs.mkdtempSync(path.join(os.tmpdir(), "galerie-description-"));
  try {
    const images = imagesDe(g, f, travail);
    if (!images.length) return null;
    const prenom = (config.client || clientActif()).prenom;
    const contenu = [{ type: "text", text: consigneDescription(f, { prenom }) }];
    for (const im of images) {
      if (im.t != null) contenu.push({ type: "text", text: `Image à ${String(im.t).replace(".", ",")} s :` });
      contenu.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: fs.readFileSync(im.chemin).toString("base64") } });
    }
    return contenu;
  } finally {
    fs.rmSync(travail, { recursive: true, force: true });
  }
}

// La réponse d'une session de description : validée par le schéma, puis écrite dans la fiche (sous le verrou).
export function ecrireDescriptionDeSession(config, id, texte, actionId) {
  const g = galerieDe(config);
  const f = g.fiche(id);
  if (!f) return { ok: false, pourquoi: "fichier absent", absent: true };
  const v = validerDescription(texte, { type: f.type, duree_s: f.duree_s });
  if (!v.ok) return v;
  g.decrire(id, v.description, { par: "studio", action: actionId });
  return { ok: true };
}

export function noterEchecDescription(config, id) {
  try { galerieDe(config).noterErreurDescription(id, "Je n'ai pas réussi à décrire ce fichier."); } catch { /* fiche partie */ }
}

// La retouche du client (fiche) : même schéma, écrite par « toi ».
export function retoucherDescription(config, id, description) {
  const g = galerieDe(config);
  const f = g.fiche(id);
  if (!f) throw new ErreurStudio("INCONNU", PHRASES.INCONNU, 404);
  const v = validerDescription(description, { type: f.type, duree_s: f.duree_s });
  if (!v.ok) throw new ErreurStudio("SCHEMA", PHRASES.SCHEMA, 400);
  try { g.decrire(id, v.description, { par: "toi" }); }
  catch (e) { if (e.code === "OCCUPE") throw new ErreurStudio("OCCUPE", PHRASES.OCCUPE, 409); throw e; }
  return g.fiche(id);
}

// Les fichiers qui attendent leur description (ni décrits, ni en échec) : la file les prend un par un.
export function aDecrire(config) {
  return galerieDe(config).index().fichiers.filter((f) => !f.description && !f.description_erreur).map((f) => f.id);
}

// L'action de description est finie quand la fiche porte une description écrite par elle (ou que le fichier est parti).
export function descriptionFaitePar(config, id, actionId) {
  const f = galerieDe(config).fiche(id);
  if (!f) return true;
  return Boolean(f.description && f.description.action_id === actionId);
}
