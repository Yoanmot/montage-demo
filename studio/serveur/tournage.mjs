// Le plan de tournage dans le studio (lot 12) : une bulle par prise (chaque fois que Romain appuie sur
// le bouton rouge puis coupe), cochable ; dernière étape « envoie tout sur ton Mac par AirDrop ».
// Le suivi (coches, prises sautées, envoi, vérification, fin validée) est écrit par le serveur seulement,
// dans STUDIO_HOME/tournages/<id>.json : jamais par le modèle.
//
// La vérification des fichiers tourne quand Romain coche la dernière étape, au clic sur « Valider la fin
// du tournage », et tant qu'un fichier est en cours de réception (l'écran du plan redemande où en est
// l'envoi toutes les deux secondes). Un fichier en cours de réception (AirDrop pas fini) n'est jamais
// compté comme reçu, et la fin du tournage ne se valide pas tant qu'il arrive.
import path from "node:path";
import { lireJson, ecrireJson, lireTexte, lister, isoZurich, lireDate, EXT_IMAGE, existe } from "./outils.mjs";
import { decouperScript, accrochesDe, accrocheDansTexte, aFinir } from "./lecture.mjs";
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

// La taille lisible d'un fichier qui arrive (« 120 Mo »).
export function tailleLisible(octets) {
  const mo = (Number(octets) || 0) / 1e6;
  if (mo < 0.1) return "moins de 0,1 Mo";
  if (mo >= 1000) return `${(mo / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Go`;
  return `${Math.max(mo < 10 ? Math.round(mo * 10) / 10 : Math.round(mo), 0).toLocaleString("fr-FR")} Mo`;
}

// Ce qui arrive en ce moment dans le dossier d'arrivée pour ce plan : les fichiers reçus en entier et ceux
// encore en réception, avec leur taille du moment (jamais de chemin : l'interface n'en montre pas).
export function receptionDuPlan(config, t) {
  const { fichiers, en_cours: enCours, partiels } = arriveesPertinentes(config.arrivees, lireDate(t.cree_le) || new Date(0));
  const vu = (f) => ({ nom: f.nom, type: f.type, taille: f.taille, taille_lisible: tailleLisible(f.taille) });
  return { recus: fichiers.map(vu), en_cours: enCours.map(vu), partiels: partiels.length, le: isoZurich() };
}

// Vérifie ce qui est arrivé : compare le nombre de vidéos et de photos attendues (prises à filmer, pas
// encore rangées) à ce que le dossier d'arrivée contient depuis la création du plan (mêmes règles que le
// rangement : vidéos et photos du téléphone seulement, jamais les autres fichiers ; un fichier encore en
// réception ne compte pas).
export function verifierArrivees(config, t, suivi) {
  const rangees = dejaRangees(config, t);
  const attendues = aFilmer(t, suivi).filter((p) => !rangees.has(p.n));
  const attendu = { videos: attendues.filter((p) => p.type !== "photo").length, photos: attendues.filter((p) => p.type === "photo").length };
  const { fichiers, partiels, en_cours: enCours } = arriveesPertinentes(config.arrivees, lireDate(t.cree_le) || new Date(0));
  const recu = { videos: fichiers.filter((f) => f.type === "video").length, photos: fichiers.filter((f) => f.type === "photo").length };
  const manque = { videos: Math.max(0, attendu.videos - recu.videos), photos: Math.max(0, attendu.photos - recu.photos) };
  const en_trop = { videos: Math.max(0, recu.videos - attendu.videos), photos: Math.max(0, recu.photos - attendu.photos) };
  const en_reception = enCours.map((f) => ({ nom: f.nom, type: f.type, taille: f.taille, taille_lisible: tailleLisible(f.taille) }));
  const complet = !manque.videos && !manque.photos && !partiels.length && !enCours.length;
  const morceaux = [];
  if (manque.videos) morceaux.push(pluriel(manque.videos, "vidéo", "vidéos"));
  if (manque.photos) morceaux.push(pluriel(manque.photos, "photo", "photos"));
  let message;
  if (!config.arrivees) message = `Je ne sais pas encore où arrivent tes fichiers sur ce Mac. Préviens ${contact()}.`;
  else if (enCours.length) {
    const quoi = enCours.length === 1
      ? `${enCours[0].type === "photo" ? "Une photo" : "Une vidéo"} est en cours de réception (${tailleLisible(enCours[0].taille)} reçus pour l'instant)`
      : `${pluriel(enCours.length, "fichier", "fichiers")} sont en cours de réception (${tailleLisible(enCours.reduce((n, f) => n + f.taille, 0))} reçus pour l'instant)`;
    message = `${quoi}. Laisse ton téléphone près du Mac jusqu'à la fin de l'envoi : je regarde tout seul et je te dis quand c'est fini.`;
  } else if (morceaux.length) {
    message = `Je ne vois pas encore tous tes fichiers : il manque ${morceaux.join(" et ")} (j'en vois ${pluriel(recu.videos, "vidéo", "vidéos")}${attendu.photos || recu.photos ? ` et ${pluriel(recu.photos, "photo", "photos")}` : ""}). Attends que l'envoi soit fini, puis recoche.`;
  } else if (partiels.length) message = "Un envoi est encore en cours. Attends qu'il soit fini, puis recoche.";
  else {
    const trop = [];
    if (en_trop.videos) trop.push(pluriel(en_trop.videos, "vidéo", "vidéos"));
    if (en_trop.photos) trop.push(pluriel(en_trop.photos, "photo", "photos"));
    message = `Tout est arrivé${trop.length ? `, et même ${trop.join(" et ")} de plus que prévu : ce que je ne reconnais pas ira dans « À ranger »` : ""}. Tu peux valider la fin du tournage.`;
  }
  return { le: isoZurich(), complet: complet && Boolean(config.arrivees), attendu, recu, manque, en_trop, en_reception, message };
}

// Après un rangement : ce qui manque encore pour ce plan (prises à filmer ni rangées dans leur dossier, ni
// posées dans « À ranger »). Tant qu'il en reste, le plan reste « à finir » et propose de ranger à nouveau.
export function resteARanger(config, t, suivi) {
  const rangees = dejaRangees(config, t);
  const attendues = aFilmer(t, suivi).filter((p) => !rangees.has(p.n));
  const j = lireJson(path.join(config.media, "_a-ranger", "a-ranger.json"), null);
  const liste = Array.isArray(j?.fichiers) ? j.fichiers : j?.fichiers && typeof j.fichiers === "object"
    ? Object.entries(j.fichiers).map(([nom, v]) => ({ nom, ...v })) : [];
  const deCote = liste.filter((f) => f?.nom && f.tournage === t.id && existe(path.join(config.media, "_a-ranger", f.nom)));
  const photosDeCote = deCote.filter((f) => f.type_probable === "photo").length;
  const videosDeCote = deCote.length - photosDeCote;
  return {
    videos: Math.max(0, attendues.filter((p) => p.type !== "photo").length - videosDeCote),
    photos: Math.max(0, attendues.filter((p) => p.type === "photo").length - photosDeCote),
  };
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
    a_finir: !enCours && aFinir(suivi),
  };
}
