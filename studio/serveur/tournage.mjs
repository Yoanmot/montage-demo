// Le plan de tournage dans le studio (lot 12) : une bulle par prise (chaque fois que Romain appuie sur
// le bouton rouge puis coupe), cochable ; dernière étape « envoie tout sur ton Mac par AirDrop ».
// Le suivi (coches, prises sautées, envoi, vérification, fin validée) est écrit par le serveur seulement,
// dans STUDIO_HOME/tournages/<id>.json : jamais par le modèle.
//
// La vérification des fichiers ne tourne qu'à deux moments : quand Romain coche la dernière étape, et
// au clic sur « Valider la fin du tournage ». Aucune surveillance du dossier, aucun minuteur.
import path from "node:path";
import { lireJson, ecrireJson, lireTexte, lister, isoZurich, lireDate, EXT_IMAGE } from "./outils.mjs";
import { decouperScript, accrochesDe, accrocheDansTexte } from "./lecture.mjs";
import { estOriginale } from "./stades.mjs";
import { arriveesPertinentes } from "../rangement/lib/commun.mjs";
import { enTeteEnMorceaux } from "../interface/app/morceaux.js";
import { contact } from "./client.mjs";

const VIDE = { version: 1, coches: [], sautees: [], envoi: false, verification: null, valide_le: null, rangement: null };

export function cheminSuivi(config, id) {
  return path.join(config.home, "tournages", `${id}.json`);
}

export function lireSuivi(config, id) {
  const s = lireJson(cheminSuivi(config, id), null);
  if (!s || typeof s !== "object") return { ...VIDE, coches: [], sautees: [] };
  return {
    ...VIDE, ...s,
    coches: Array.isArray(s.coches) ? s.coches.filter(Number.isInteger) : [],
    sautees: Array.isArray(s.sautees) ? s.sautees.filter(Number.isInteger) : [],
    envoi: s.envoi === true,
  };
}

export function ecrireSuivi(config, id, suivi) {
  ecrireJson(cheminSuivi(config, id), { ...suivi, version: 1 });
  return suivi;
}

const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;

// Prises qu'il faut filmer : ni « déjà en bibliothèque », ni sautées par Romain.
function aFilmer(t, suivi) {
  const sautees = new Set(suivi.sautees);
  return (t.prises || []).filter((p) => ["face", "b-roll", "photo"].includes(p.type) && !p.deja_en_bibliotheque && !sautees.has(p.n));
}

// Ce qui est déjà rangé pour ce plan (plans d'avant le lot 12, rangés à l'arrivée) : ces prises ne sont
// plus attendues dans le dossier d'arrivée.
function dejaRangees(config, t) {
  const r = new Set();
  const index = lireJson(path.join(config.media, "_bibliotheque", "index.json"), null)?.clips || {};
  const clipsDuPlan = Object.values(index).filter((c) => c.tournage === t.id && c.prise != null).map((c) => c.prise);
  const photosPar = new Map();
  for (const p of t.prises || []) {
    const slugs = (p.contenus || []).map((c) => c.slug);
    if (p.type === "face") {
      if (slugs.some((s) => lister(path.join(config.media, s, "face")).some((e) => !e.isDirectory() && estOriginale(e.name)))) r.add(p.n);
    } else if (p.type === "b-roll") {
      if (clipsDuPlan.includes(p.n)) r.add(p.n);
    } else if (p.type === "photo" && slugs[0]) {
      const s = slugs[0];
      if (!photosPar.has(s)) {
        photosPar.set(s, lister(path.join(config.media, s, "photos")).filter((e) => !e.name.startsWith(".") && EXT_IMAGE.has(path.extname(e.name).toLowerCase())).length);
      }
      if (photosPar.get(s) > 0) { r.add(p.n); photosPar.set(s, photosPar.get(s) - 1); }
    }
  }
  return r;
}

// Vérifie ce qui est arrivé : compare le nombre de vidéos et de photos attendues (prises à filmer, pas
// encore rangées) à ce que le dossier d'arrivée contient depuis la création du plan (mêmes règles que le
// rangement : vidéos et photos du téléphone seulement, jamais les autres fichiers).
export function verifierArrivees(config, t, suivi) {
  const rangees = dejaRangees(config, t);
  const attendues = aFilmer(t, suivi).filter((p) => !rangees.has(p.n));
  const attendu = { videos: attendues.filter((p) => p.type !== "photo").length, photos: attendues.filter((p) => p.type === "photo").length };
  const { fichiers, partiels } = arriveesPertinentes(config.arrivees, lireDate(t.cree_le) || new Date(0));
  const recu = { videos: fichiers.filter((f) => f.type === "video").length, photos: fichiers.filter((f) => f.type === "photo").length };
  const manque = { videos: Math.max(0, attendu.videos - recu.videos), photos: Math.max(0, attendu.photos - recu.photos) };
  const en_trop = { videos: Math.max(0, recu.videos - attendu.videos), photos: Math.max(0, recu.photos - attendu.photos) };
  const complet = !manque.videos && !manque.photos && !partiels.length;
  const morceaux = [];
  if (manque.videos) morceaux.push(pluriel(manque.videos, "vidéo", "vidéos"));
  if (manque.photos) morceaux.push(pluriel(manque.photos, "photo", "photos"));
  let message;
  if (!config.arrivees) message = `Je ne sais pas encore où arrivent tes fichiers sur ce Mac. Préviens ${contact()}.`;
  else if (morceaux.length) {
    message = `Je ne vois pas encore tous tes fichiers : il manque ${morceaux.join(" et ")} (j'en vois ${pluriel(recu.videos, "vidéo", "vidéos")}${attendu.photos || recu.photos ? ` et ${pluriel(recu.photos, "photo", "photos")}` : ""}). Attends que l'envoi soit fini, puis recoche.`;
  } else if (partiels.length) message = "Un envoi est encore en cours. Attends qu'il soit fini, puis recoche.";
  else {
    const trop = [];
    if (en_trop.videos) trop.push(pluriel(en_trop.videos, "vidéo", "vidéos"));
    if (en_trop.photos) trop.push(pluriel(en_trop.photos, "photo", "photos"));
    message = `Tout est arrivé${trop.length ? `, et même ${trop.join(" et ")} de plus que prévu : ce que je ne reconnais pas ira dans « À ranger »` : ""}. Tu peux valider la fin du tournage.`;
  }
  return { le: isoZurich(), complet: complet && Boolean(config.arrivees), attendu, recu, manque, en_trop, message };
}

// Ordre des sections du plan dans le studio (lot 13) : toutes les face caméra, puis tous les b-rolls,
// puis toutes les photos. Le plan est déjà écrit dans cet ordre (tournage.py le vérifie) ; le tri, stable,
// garde le numéro de chaque prise et rattrape un plan plus ancien qui ne le serait pas.
const ORDRE_TYPES = ["face", "b-roll", "photo"];

// Les bulles du plan, dans l'ordre de tournage. Face caméra : le texte complet du script, qui commence
// par l'accroche choisie (outils/brief.py). B-roll : chaque mouvement avec la phrase qu'il illustre.
export function bulles(config, t, titres = new Map()) {
  const textes = new Map();
  // Le texte complet, et l'accroche par laquelle il commence (pour la montrer en tête de la bulle).
  const texteDe = (slug) => {
    if (!textes.has(slug)) {
      const md = lireTexte(path.join(config.depot, "contenus", slug, "script.md"), null);
      const d = decouperScript(md);
      const liste = accrochesDe(d.accroches);
      const n = accrocheDansTexte(liste, d.script);
      // Lot 14 : « - Découpage : un morceau par ligne » dans l'en-tête = chaque ligne du texte est un
      // morceau dit d'une traite (skill reel-script) ; sinon l'interface regroupe les phrases (repli).
      textes.set(slug, { script: d.script || null, accroche: liste.find((a) => a.n === n)?.texte || null,
        decoupage: d.script && enTeteEnMorceaux(md) ? "morceaux" : null });
    }
    return textes.get(slug);
  };
  const contenusDe = (p) => (p.contenus || []).map((c) => ({ slug: c.slug, titre: titres.get(c.slug) || c.slug }));
  const prises = (t.prises || []).filter((p) => ORDRE_TYPES.includes(p.type))
    .map((p, i) => ({ p, i })).sort((a, b) => ORDRE_TYPES.indexOf(a.p.type) - ORDRE_TYPES.indexOf(b.p.type) || a.i - b.i)
    .map((x) => x.p);
  return prises.map((p) => {
    const b = { n: p.n, type: p.type, lieu: p.lieu || null, materiel: Array.isArray(p.materiel) ? p.materiel : [],
      duree_s: Number(p.duree_s) || null, deja: Boolean(p.deja_en_bibliotheque), contenus: contenusDe(p) };
    if (p.type === "face") {
      b.titre = "Face caméra";
      const x = b.contenus[0] ? texteDe(b.contenus[0].slug) : { script: null, accroche: null, decoupage: null };
      b.script = x.script;
      b.accroche = x.accroche;
      b.decoupage = x.decoupage;
    } else if (p.type === "b-roll") {
      b.titre = "B-roll";
      const mouv = (p.mouvements || []).filter(Boolean);
      b.mouvements = (mouv.length ? mouv : [p.ce_qu_on_voit || ""]).map((m, i) => ({
        texte: String(m),
        phrases: (p.contenus || []).flatMap((c) => (c.usages || []).filter((u) => (u.mouvement || 1) === i + 1 && u.phrase)
          .map((u) => ({ phrase: u.phrase, titre: titres.get(c.slug) || c.slug }))),
      }));
      b.consigne = mouv.length ? (p.ce_qu_on_voit || null) : null;
    } else {
      b.titre = "Photo";
      b.photo = p.ce_qu_on_voit || null;
      b.phrases = (p.contenus || []).flatMap((c) => (c.usages || []).filter((u) => u.phrase).map((u) => ({ phrase: u.phrase, titre: titres.get(c.slug) || c.slug })));
    }
    return b;
  });
}

// Le suivi tel que l'interface le lit (le bouton n'est actif qu'après une vérification complète, la
// dernière étape cochée).
export function suiviPublic(suivi, enCours = false) {
  return {
    coches: suivi.coches, sautees: suivi.sautees, envoi: suivi.envoi, verification: suivi.verification,
    valide_le: suivi.valide_le, rangement: enCours ? { en_cours: true } : suivi.rangement,
    peut_valider: Boolean(suivi.envoi && suivi.verification?.complet && !enCours),
  };
}
