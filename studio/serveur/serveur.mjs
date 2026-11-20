// Le serveur HTTP local du studio (contrat, section 10) : 127.0.0.1 seulement, contrôles Host
// (421), Origin (403) et jeton par cookie (401), interface statique, API JSON, flux SSE.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { CODE } from "./config.mjs";
import {
  SLUG_RE, existe, dedans, lireJson, ecrireJson, etendre, isoZurich,
} from "./outils.mjs";
import {
  construireCartes, detail, aRanger, cleCarte, indexSansChemins, videoFace, listeTournages, lireTournage, dateBrief,
  instantane, lireDepot, apercuDe, notesApercu,
} from "./lecture.mjs";
import { stade as stadeDe } from "./stades.mjs";
import { typeDeChat } from "./reglages.mjs";
import { attenduPresent } from "./attendus.mjs";
import { lierSlides } from "../publication/carrousels.mjs";
import { configBrute } from "./publication.mjs";
import {
  ErreurStudio, MESSAGE_GENERIQUE, outilDepot, lancerRangement, placerManuel, retirerRush, changerTypeRush, lancerArchivage,
} from "./depot-outils.mjs";
import { alertes as lireAlertes } from "./alertes.mjs";
import { Publication } from "./publication.mjs";
import { Stats } from "./stats.mjs";
import { executer } from "./commandes.mjs";
import { lireSuivi, ecrireSuivi, verifierArrivees, bulles, suiviPublic, receptionDuPlan, resteARanger, tailleLisible } from "./tournage.mjs";
import { arriveesPertinentes, typeFichier, verrouPris, voixAttendues } from "../rangement/lib/commun.mjs";
import { Ressources, ressourcesActives } from "./ressources.mjs";
import { adresser, clientActif } from "./client.mjs";
import { vignetteReel, apercuRessource } from "./vignettes.mjs";
import { fichierAutre } from "./autres.mjs";
import { telechargerVideo } from "./telecharger.mjs";

const TYPES_MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".heic": "image/heic", ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
  ".otf": "font/otf", ".mp4": "video/mp4", ".m4v": "video/mp4", ".mov": "video/quicktime", ".md": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4",
};

// Les traits d'une zone entourée sur l'aperçu (coordonnées 0..1 de l'écran 9:16) : bornés, arrondis.
export function traitsPropres(brut) {
  if (!Array.isArray(brut)) return [];
  const r = [];
  for (const t of brut.slice(0, 20)) {
    if (!Array.isArray(t)) continue;
    const pts = [];
    for (const pt of t.slice(0, 600)) {
      if (!Array.isArray(pt) || pt.length !== 2) continue;
      const [x, y] = pt.map(Number);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      pts.push([Math.round(Math.min(1, Math.max(0, x)) * 10000) / 10000, Math.round(Math.min(1, Math.max(0, y)) * 10000) / 10000]);
    }
    if (pts.length) r.push(pts);
  }
  return r;
}

// Le rectangle qui contient la zone entourée (0..1), ou null.
export function zoneDe(traits) {
  const pts = traits.flat();
  if (!pts.length) return null;
  const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
  const r = (v) => Math.round(v * 1000) / 1000;
  return { x: r(Math.min(...xs)), y: r(Math.min(...ys)), l: r(Math.max(...xs) - Math.min(...xs)), h: r(Math.max(...ys) - Math.min(...ys)) };
}

export const instantLisible = (image) => {
  const t = image / 30; const m = Math.floor(t / 60);
  return `${m}:${(t - m * 60).toFixed(1).padStart(4, "0")}`;
};

const echapper = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// L'accueil du studio aux couleurs du client : nom de l'appli (titre, marque), thème, prénom et contact
// (lus par l'interface sur <html>). Le fichier index.html garde les valeurs de Romain (maquette sans serveur).
export function pageAccueil(html, config) {
  const nom = echapper(config.appli?.nom || "Studio");
  const theme = /^[a-z0-9-]+$/.test(config.theme || "") ? config.theme : "romain";
  const liens = theme === "romain"
    ? '<link rel="preload" href="/app/polices/manrope.woff2" as="font" type="font/woff2" crossorigin>\n  <link rel="stylesheet" href="/app/themes/romain.css">'
    : `<link rel="stylesheet" href="/app/themes/${theme}.css">`;
  return html
    .replace(/<!-- theme :[^>]*-->[\s\S]*?<!-- \/theme -->/, liens)
    .replace("<title>Studio</title>", `<title>${nom}</title>`)
    .replace(/(<(span|p) class="mot">)Studio(<\/\2>)/g, `$1${nom}$3`)
    .replace('<html lang="fr">', `<html lang="fr" data-prenom="${echapper(config.prenom)}" data-contact="${echapper(config.contact)}" data-theme-client="${theme}">`);
}

const PAGE_ATTENTE = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Studio</title>
<meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: -apple-system, system-ui, sans-serif; padding: 48px; background: #f6f5f2; color: #1d1d1b">
<p>Ton studio démarre. Recharge la page dans un instant.</p></body></html>`;

const PAGE_JETON = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Studio</title></head>
<body style="font-family: -apple-system, system-ui, sans-serif; padding: 48px; background: #f6f5f2; color: #1d1d1b">
<p>Ouvre le studio depuis son icône dans le Dock.</p></body></html>`;

function egalConstant(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function cookies(req) {
  const r = {};
  for (const morceau of String(req.headers.cookie || "").split(";")) {
    const i = morceau.indexOf("=");
    if (i > 0) r[morceau.slice(0, i).trim()] = morceau.slice(i + 1).trim();
  }
  return r;
}

// Tout texte qui part vers l'interface passe par adresser() : chez un client qui est son propre contact,
// « préviens <lui-même> » devient une phrase qui s'adresse à lui (client.mjs). Sinon rien ne change.
function envoyerJson(res, statut, donnees) {
  const corps = adresser(JSON.stringify(donnees));
  res.writeHead(statut, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(corps),
  });
  res.end(corps);
}

function erreur(res, statut, code, message) {
  envoyerJson(res, statut, { erreur: code, message });
}

function lireCorps(req, max = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let taille = 0;
    const morceaux = [];
    req.on("data", (m) => {
      taille += m.length;
      if (taille > max) {
        reject(new ErreurStudio("TROP_GROS", "C'est trop long à envoyer d'un coup.", 413));
        req.destroy();
      } else morceaux.push(m);
    });
    req.on("end", () => {
      const t = Buffer.concat(morceaux).toString("utf8").trim();
      if (!t) return resolve({});
      try {
        const v = JSON.parse(t);
        resolve(v && typeof v === "object" && !Array.isArray(v) ? v : {});
      } catch {
        reject(new ErreurStudio("CORPS_ILLISIBLE", MESSAGE_GENERIQUE, 400));
      }
    });
    req.on("error", reject);
  });
}

// Fichier statique ou média, avec Range.
function servirFichier(req, res, chemin, { cache = "no-cache", entetes: enPlus = {} } = {}) {
  let s;
  try {
    s = fs.statSync(chemin);
  } catch {
    return erreur(res, 404, "INTROUVABLE", "Je ne trouve pas ce fichier.");
  }
  if (!s.isFile()) return erreur(res, 404, "INTROUVABLE", "Je ne trouve pas ce fichier.");
  const type = TYPES_MIME[path.extname(chemin).toLowerCase()] || "application/octet-stream";
  const entetes = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": cache, "Last-Modified": s.mtime.toUTCString(), ...enPlus };
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ""));
  if (range && (range[1] || range[2])) {
    let debut = range[1] ? Number(range[1]) : Math.max(0, s.size - Number(range[2]));
    let fin = range[1] && range[2] ? Number(range[2]) : s.size - 1;
    fin = Math.min(fin, s.size - 1);
    if (debut > fin || debut >= s.size) {
      res.writeHead(416, { "Content-Range": `bytes */${s.size}` });
      return res.end();
    }
    res.writeHead(206, { ...entetes, "Content-Range": `bytes ${debut}-${fin}/${s.size}`, "Content-Length": fin - debut + 1 });
    if (req.method === "HEAD") return res.end();
    return fs.createReadStream(chemin, { start: debut, end: fin }).pipe(res);
  }
  res.writeHead(200, { ...entetes, "Content-Length": s.size });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(chemin).pipe(res);
}

function segmentsSurs(liste) {
  const r = [];
  for (const brut of liste) {
    let s;
    try { s = decodeURIComponent(brut); } catch { return null; }
    if (!s || s === "." || s === ".." || s.includes("/") || s.includes("\\") || s.includes("\0")) return null;
    r.push(s);
  }
  return r;
}

// ---------------------------------------------------------- « Ajouter une vidéo » (vue Montage, 19/11)
// Le fichier arrive en flux (jamais lu en entier en mémoire) dans STUDIO_HOME/envois/<dossier>/, puis le rangement le
// place comme un placement à la main. Le fichier d'origine sur le Mac n'est pas touché : le navigateur en envoie une copie.
export const ENVOI_MAX = 20 * 1024 ** 3;          // 20 Go
const ENVOI_MARGE = 512 * 1024 ** 2;              // place à laisser libre sur le disque
const RANGEMENT_OCCUPE = "Un rangement est en cours : réessaie dans un instant.";

// Nom propre : sans dossier, sans caractère de contrôle ni « : », sans point au début, 100 caractères au plus.
export function nomEnvoi(brut) {
  let n = String(brut || "").normalize("NFC").split(/[\\/]/).pop() || "";
  n = n.replace(/[\u0000-\u001f\u007f:]/g, "").replace(/^[.\s]+/, "").trim();
  const ext = path.extname(n).toLowerCase();
  const base = path.basename(n, path.extname(n)).replace(/[^\p{L}\p{N} ._()'-]/gu, "_").trim().slice(0, 100).trim();
  return `${base || "video"}${ext}`;
}

function placeLibre(dossier) {
  try { const s = fs.statfsSync(dossier); return Number(s.bavail) * Number(s.bsize); } catch { return Infinity; }
}

// Le chat général repart sur une conversation neuve quand Romain revient après une pause (lot 12, demande de Yoan :
// « entre plusieurs sessions ça peut se reset »). Six heures : une après-midi de travail, même entrecoupée, garde
// son fil ; le lendemain matin, ou le soir après une matinée, on repart à zéro. Un « nouveau jour » couperait une
// séance tardive en plein milieu (minuit), ce que ce seuil ne fait pas.
export const PAUSE_CHAT_GENERAL_MS = 6 * 3600e3;

// La version du code servi (lot 12) : le commit du dépôt lu au démarrage, sinon l'heure de démarrage. Une interface
// restée ouverte pendant une mise à jour la compare à chaque reconnexion et se recharge (sinon : nouvelle interface
// d'un côté, ancien serveur de l'autre, ou l'inverse).
function versionDuCode() {
  try {
    const r = spawnSync("git", ["rev-parse", "HEAD"], { cwd: CODE, encoding: "utf8", timeout: 5000 });
    const h = String(r.stdout || "").trim();
    if (r.status === 0 && /^[0-9a-f]{40}$/.test(h)) return h.slice(0, 12);
  } catch { /* pas de git */ }
  return `d${Date.now()}`;
}

export function creerServeur({ config, jeton, pont, file, synchro, journal = () => {} }) {
  const VERSION = versionDuCode();
  const port = config.port;
  const hotes = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const origines = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]);
  const clients = new Set();
  const interfaceDir = path.join(CODE, "interface");
  let cartes = new Map();
  let aRangerJson = "[]";
  let tournagesJson = null;

  const etatLocal = () => ({ actions: file.liste(), actives: pont.actives(), maintenant: new Date() });
  const ressources = new Ressources({ config, journal, cartes: () => [...cartes.values()] });
  const publication = new Publication({ config, file, synchro, journal, etatLocal, ressources });
  const stats = new Stats({ config, journal });

  // ------------------------------------------------------------ SSE

  function diffuser(evenement, donnees) {
    const t = `event: ${evenement}\ndata: ${adresser(JSON.stringify(donnees))}\n\n`;
    for (const c of clients) {
      try { c.write(t); } catch { clients.delete(c); }
    }
  }

  function rafraichir() {
    let liste;
    try {
      liste = construireCartes(config, etatLocal());
    } catch (e) {
      journal("lecture_impossible", { erreur: String(e.message || e) });
      return;
    }
    const nouvelles = new Map(liste.map((c) => [cleCarte(c), c]));
    for (const [cle, c] of nouvelles) {
      const avant = cartes.get(cle);
      if (!avant || JSON.stringify(avant) !== JSON.stringify(c)) diffuser("carte", c);
    }
    for (const [cle, c] of cartes) {
      if (!nouvelles.has(cle)) diffuser("carte_retiree", c.slug ? { slug: c.slug } : { proposition_id: c.proposition_id });
    }
    cartes = nouvelles;
    // La liste des plans de tournage (lot 10) : un nouveau plan apparaît sans recharger la page.
    try {
      const tournages = listeTournages(config);
      const tj = JSON.stringify(tournages);
      if (tournagesJson !== null && tj !== tournagesJson) diffuser("tournages", { tournages });
      tournagesJson = tj;
    } catch { /* dossier absent */ }
    majARanger();
  }

  // « À ranger » : les fichiers mis de côté par le rangement, puis les rushs arrivés sur le Mac pour un plan
  // validé de moins de 14 jours, fini de ranger ou non (arrivés après la vérification, pendant le
  // rangement ou après la fin du tournage, ou encore en réception). Ceux-là restent dans le dossier
  // d'arrivée tant que Romain n'a pas cliqué « Ranger maintenant ». Studio de Yoan, 19/11 : un
  // enregistrement d'écran posé dans Téléchargements pendant le rangement du plan n'était plus montré
  // nulle part une fois le plan fini (seuls les plans « à finir » étaient relus).
  let attentesCache = { le: 0, liste: [] };
  // Ce que le rangement a déjà déplacé depuis le dossier d'arrivée (journal) : un fichier revenu sous le
  // même nom avec la même taille, alors que sa copie rangée existe, est un doublon, pas une arrivée.
  function dejaRanges() {
    const r = new Map();
    const j = lireJson(path.join(config.media, "_journal-rangement.json"), null);
    for (const e of Array.isArray(j?.rangements) ? j.rangements : []) {
      if (e?.annule) continue;
      for (const op of Array.isArray(e.ops) ? e.ops : []) {
        if (op?.op === "deplacement" && op.de && op.vers) r.set(op.de, op.vers);
      }
    }
    return r;
  }
  function rushsEnAttente() {
    if (Date.now() - attentesCache.le < 3000) return attentesCache.liste;
    const liste = [];
    try {
      const tous = listeTournages(config);   // du plus récent au plus ancien
      const plans = tous.filter((t) => (t.a_finir || t.valide) && !rangementsTournage.has(t.id)
        && Date.now() - (Date.parse(t.cree_le) || 0) < 14 * 86400e3);
      const ranges = plans.length ? dejaRanges() : new Map();
      const doublon = (f) => {
        const vers = ranges.get(f.chemin);
        try { return Boolean(vers) && fs.statSync(vers).size === f.taille; } catch { return false; }
      };
      const vus = new Set();
      for (const t of plans) {
        const voix = voixAttendues(config, t);
        const { fichiers, en_cours: enCours } = arriveesPertinentes(config.arrivees, new Date(Date.parse(t.cree_le) || 0), { audio: voix.length > 0 });
        for (const [f, recu] of [...enCours.map((f) => [f, false]), ...fichiers.map((f) => [f, true])]) {
          if (vus.has(f.nom) || doublon(f)) continue;
          // Un fichier va au plan le plus récent créé avant son arrivée : celui d'un plan plus récent, pas
          // encore validé, attend la fin de ce plan-là.
          const sien = tous.find((x) => (Date.parse(x.cree_le) || 0) <= f.quand);
          if (sien && sien.id !== t.id) continue;
          vus.add(f.nom);
          liste.push({
            nom: f.nom, attente: true, en_cours: !recu, tournage: t.id, cree_le: t.cree_le,
            libelle: f.type === "photo" ? "ta photo" : f.type === "audio" ? "ton mémo vocal" : "ta vidéo", taille_lisible: tailleLisible(f.taille),
            raison: recu ? "arrivée sur ton Mac après ton tournage, pas encore rangée" : "en cours de réception",
            // Les contenus du plan d'abord, pour la ranger à la main ; une vidéo arrivée en retard est le plus
            // souvent un plan de coupe (un enregistrement d'écran, par exemple) : le type se change avant de ranger.
            // Un mémo vocal ne va que comme voix d'un reel qui l'attend.
            candidats: f.type === "audio" ? voix.map((slug) => ({ slug, type: "face" }))
              : (t.contenus || []).map((slug) => ({ slug, type: f.type === "photo" ? "photo" : "b-roll" })),
          });
        }
      }
    } catch { /* dossier absent */ }
    attentesCache = { le: Date.now(), liste };
    return liste;
  }

  function majARanger({ frais = false } = {}) {
    if (frais) attentesCache.le = 0;
    let fichiers = [];
    try { fichiers = aRanger(config); } catch { /* dossier absent */ }
    fichiers = [...fichiers, ...rushsEnAttente()];
    const j = JSON.stringify(fichiers);
    if (j !== aRangerJson) {
      aRangerJson = j;
      diffuser("a_ranger", { fichiers });
    }
  }

  const titresCartes = () => new Map([...cartes.values()].filter((c) => c.slug).map((c) => [c.slug, c.titre]));
  stats.on(() => diffuser("stats", stats.vue(titresCartes())));
  pont.on("chat", (e) => diffuser("chat", e));
  pont.on("reinitialise", (e) => diffuser("chat_reinitialise", e));
  pont.on("actives", () => rafraichir());
  const vueFile = () => ({ actions: file.liste(), pause: file.vuePause?.() || null });
  file.on("change", () => {
    diffuser("file", vueFile());
    rafraichir();
  });
  // Les slides d'une mise en page se lient à la fin de chaque tour de sa session (gabarit du lot 5),
  // pour que la carte les montre avant même que Romain valide.
  pont.on("fin", ({ chat_id: chatId }) => {
    const t = typeDeChat(chatId);
    if (t?.genre !== "hoc") return;
    try { lierSlides(t.slug, configBrute(config)); } catch { /* le lien se reposera au prochain passage */ }
    plusTard();
  });
  synchro.on("sync", (s) => {
    diffuser("sync", s);
    if (s.etat !== "en_cours") rafraichir();
  });

  // ------------------------------------------------------------ surveillance des fichiers

  const veilleurs = [];
  let attente = null;
  // Regroupe les changements (un montage écrit sans arrêt) : au plus un recalcul toutes les 300 ms.
  const plusTard = () => {
    if (attente) return;
    attente = setTimeout(() => { attente = null; rafraichir(); }, 300);
  };
  function surveiller(dossier, filtre) {
    if (!dossier || !existe(dossier)) return null;
    try {
      const w = fs.watch(dossier, { recursive: true }, (_t, nom) => {
        if (filtre(String(nom || ""))) plusTard();
      });
      w.on("error", () => {});
      veilleurs.push(w);
      return w;
    } catch {
      return null;
    }
  }
  let veilleDepot = null;
  let veilleMedia = null;
  let rangementEnCours = false;
  const rangementsTournage = new Set(); // plans dont le rangement tourne (lot 12)

  // Lot 12 : plus de rangement à l'arrivée des fichiers. Il part au clic de Romain sur « Valider la fin du
  // tournage » (ranger ce plan-là) ; « Réessayer de tout ranger » (À ranger) reprend le dernier plan
  // validé de moins de 7 jours, jamais un plan dont la fin n'est pas validée.
  async function rangerMaintenant(tournage = null) {
    if (rangementEnCours) return null;
    let id = tournage;
    if (!id) {
      const valide = listeTournages(config).filter((x) => x.valide && Date.now() - (Date.parse(x.cree_le) || 0) < 7 * 86400e3)[0];
      if (!valide) return null;
      id = valide.id;
    }
    rangementEnCours = true;
    rangementsTournage.add(id);
    try {
      return await file.suivre("rangement", {}, async () => {
        const r = await lancerRangement(config, { tournage: id });
        await copierBibliotheque();
        return r;
      });
    } catch (e) {
      journal("rangement_erreur", { code: e.code || null });
      throw e;
    } finally {
      rangementEnCours = false;
      rangementsTournage.delete(id);
      rafraichir();
    }
  }

  // Le bilan d'un rangement dans le suivi du plan : posé par « Valider la fin » et « Ranger maintenant », et
  // aussi par « Réessayer de tout ranger » (qui range le dernier plan validé) : sans lui, un plan « à finir »
  // le restait alors que ses fichiers étaient rangés (studio de Yoan, 18/11).
  function noterRangement(id, lu, { valider = false } = {}) {
    const t = lireTournage(config, id);
    const s = lireSuivi(config, id);
    if (!t || (!valider && !s.valide_le)) return;
    s.valide_le ||= isoZurich();
    // Ce qui n'a pas pu être rangé reste visible : fichiers laissés où ils étaient (encore en réception,
    // illisibles) et prises attendues qui ne sont ni rangées ni dans « À ranger ».
    s.rangement = { fini_le: isoZurich(), places: lu?.fin?.places ?? lu?.places?.length ?? 0, a_ranger: lu?.fin?.a_ranger ?? lu?.a_ranger?.length ?? 0,
      en_attente: lu?.ignores?.length ?? 0, reste: resteARanger(config, { ...t.brut, id }, s) };
    ecrireSuivi(config, id, s);
    rafraichir();
    majARanger({ frais: true });
    diffuser("tournages", { tournages: listeTournages(config) });
  }

  async function copierBibliotheque() {
    const idx = indexSansChemins(config);
    if (!idx) return;
    const cible = path.join(config.depot, "bibliotheque", "index.json");
    if (JSON.stringify(lireJson(cible, null)) === JSON.stringify(idx)) return;
    ecrireJson(cible, idx);
    await synchro.pousserFichier("bibliotheque/index.json", "Studio : bibliothèque");
  }

  function brancherVeilleurs() {
    if (!veilleDepot) veilleDepot = surveiller(config.depot, (n) => !n.startsWith(".git"));
    if (!veilleMedia) veilleMedia = surveiller(config.media, (n) => !path.basename(n).startsWith("."));
    // Le dossier d'arrivée (ses Téléchargements) n'est pas surveillé (lot 12) : on ne le lit qu'au moment
    // où Romain coche « tout est envoyé » ou valide la fin d'un tournage, quand l'écran du plan suit un
    // envoi en cours, et toutes les 10 s tant qu'un plan validé n'est pas fini de ranger (ci-dessous).
  }
  const attentes = setInterval(() => {
    // Seulement s'il y a un plan dont les arrivées comptent (validé de moins de 14 jours, ou à finir).
    let plans = null;
    try { plans = tournagesJson ? JSON.parse(tournagesJson) : null; } catch { /* relu au prochain passage */ }
    if (plans && !plans.some((t) => t.a_finir || (t.valide && Date.now() - (Date.parse(t.cree_le) || 0) < 14 * 86400e3))) return;
    majARanger({ frais: true });
  }, 10000);
  attentes.unref?.();
  const periodique = setInterval(() => {
    brancherVeilleurs();
    rafraichir();
    // Les slides d'un carrousel mis en page ailleurs (terminal) se lient aussi.
    for (const c of cartes.values()) {
      if (c.slug && c.stade === "mis_en_page") {
        try { lierSlides(c.slug, configBrute(config)); } catch { /* rien */ }
      }
    }
  }, 30000);
  periodique.unref?.();
  const ping = setInterval(() => diffuser("ping", {}), 20000);
  ping.unref?.();
  // Alertes (lot 12) : place libre et connexion au compte Claude, relues toutes les 5 minutes.
  let alertesJson = "[]";
  const alertesDuStudio = () => {
    let a = [];
    try { a = lireAlertes(config, config.client || clientActif()); } catch { /* relu au prochain passage */ }
    const j = JSON.stringify(a);
    if (j !== alertesJson) {
      alertesJson = j;
      if (a.length) journal("alertes", { ids: a.map((x) => `${x.id}:${x.genre}`) });
      diffuser("alertes", { alertes: a });
    }
    return a;
  };
  const veilleAlertes = setInterval(alertesDuStudio, 5 * 60000);
  veilleAlertes.unref?.();

  // ------------------------------------------------------------ routes API

  function exigerSlug(slug) {
    if (!SLUG_RE.test(String(slug || ""))) throw new ErreurStudio("INTROUVABLE", "Je ne trouve pas ce contenu.", 404);
    const ok = existe(path.join(config.depot, "contenus", slug))
      || existe(path.join(config.depot, "a-rendre", "carrousels", `${slug}.md`))
      || existe(path.join(config.depot, "rendus", "carrousels", `${slug}.md`));
    if (!ok) throw new ErreurStudio("INTROUVABLE", "Je ne trouve pas ce contenu.", 404);
    return slug;
  }

  function exigerJour(jour) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(jour)) || Number.isNaN(new Date(`${jour}T12:00:00Z`).getTime())) {
      throw new ErreurStudio("DATE", "Cette date n'est pas lisible.", 400);
    }
    return jour;
  }

  function texteCourt(v, max = 500) {
    if (v === undefined || v === null || v === "") return null;
    if (typeof v !== "string") throw new ErreurStudio("CORPS_ILLISIBLE", MESSAGE_GENERIQUE, 400);
    return v.slice(0, max);
  }

  // Les vidéos rangées d'un contenu ne bougent plus quand le montage tourne ou a commencé. stadeExact : seulement au
  // stade « rushs reçus » (retirer, changer le type) ; sinon tout stade avant l'aperçu (ajouter une vidéo).
  function exigerMontageLibre(slug, { stadeExact = false } = {}) {
    const inst = instantane(config, slug, lireDepot(config.depot));
    const st = stadeDe(inst.contenu, inst.fichiers, etatLocal()).stade;
    const montage = pont.actif(`${slug}:monteur`)
      || file.liste().some((a) => a.slug === slug && a.type === "montage" && ["en_cours", "en_file"].includes(a.statut));
    const tard = stadeExact ? st !== "rushs_recus" : ["planche", "monte", "programme", "publie"].includes(st);
    if (tard || montage) {
      throw new ErreurStudio("TROP_TARD", "Le montage a déjà commencé avec ces vidéos : dis dans le chat du montage ce qui ne va pas.", 409);
    }
  }

  // POST /api/cartes/<slug>/rushs/envoyer?nom=<nom>&type=<face|b-roll|photo>[&verifier=1] , corps = le fichier brut.
  // verifier=1 (corps vide, taille=<octets>) : les mêmes contrôles sans rien envoyer, pour répondre proprement avant
  // de lancer plusieurs Go.
  async function recevoirEnvoi(req, res, slug, url) {
    const verifier = url.searchParams.get("verifier") === "1";
    const refuser = (statut, code, message) => {
      // Corps pas lu : on répond puis on coupe, pour ne pas recevoir des Go pour rien.
      res.setHeader("Connection", "close");
      erreur(res, statut, code, message);
      res.on("finish", () => req.destroy());
    };
    if (!existe(path.join(config.depot, "contenus", slug))) return refuser(404, "INTROUVABLE", "Je ne trouve pas ce contenu.");
    const type = url.searchParams.get("type");
    if (!["face", "b-roll", "photo"].includes(type)) return refuser(400, "TYPE", MESSAGE_GENERIQUE);
    const nom = nomEnvoi(url.searchParams.get("nom"));
    const genre = typeFichier(nom);
    if (genre !== "video" && genre !== "photo") {
      return refuser(415, "FORMAT", "Je ne sais ranger que des vidéos (MOV, MP4) et des photos (JPG, HEIC, PNG).");
    }
    if ((type === "photo") !== (genre === "photo")) {
      return refuser(400, "TYPE", genre === "photo" ? "C'est une photo : range-la comme photo." : "C'est une vidéo : choisis face caméra ou plan filmé en plus.");
    }
    const taille = Number(verifier ? url.searchParams.get("taille") : req.headers["content-length"]);
    if (!Number.isSafeInteger(taille) || taille <= 0) return refuser(411, "TAILLE", MESSAGE_GENERIQUE);
    if (taille > ENVOI_MAX) return refuser(413, "TROP_GROS", "Ce fichier est trop lourd : 20 Go au plus.");
    try { exigerMontageLibre(slug); } catch (e) { return refuser(e.statut, e.code, e.messageRomain); }
    if (rangementEnCours || verrouPris(config.media)) return refuser(409, "OCCUPE", RANGEMENT_OCCUPE);
    const envois = path.join(config.home, "envois");
    fs.mkdirSync(envois, { recursive: true });
    fs.mkdirSync(config.media, { recursive: true });
    const besoin = taille + ENVOI_MARGE;
    if (placeLibre(envois) < besoin || placeLibre(config.media) < besoin) {
      return refuser(507, "PLUS_DE_PLACE", "Ton Mac n'a plus assez de place pour ce fichier. Libère de la place, puis réessaie.");
    }
    if (verifier) return envoyerJson(res, 200, {});

    // Les envois d'avant un arrêt brutal (plus d'un jour) partent.
    for (const e of fs.readdirSync(envois)) {
      const d = path.join(envois, e);
      try { if (Date.now() - fs.statSync(d).mtimeMs > 86400e3) fs.rmSync(d, { recursive: true, force: true }); } catch { /* rien */ }
    }
    const dossier = fs.mkdtempSync(path.join(envois, "e-"));
    const chemin = path.join(dossier, nom);
    let recu = 0;
    const compteur = new Transform({
      transform(morceau, _enc, suite) {
        recu += morceau.length;
        if (recu > taille) return suite(new ErreurStudio("TROP_GROS", MESSAGE_GENERIQUE, 400));
        suite(null, morceau);
      },
    });
    try {
      try {
        await pipeline(req, compteur, fs.createWriteStream(chemin, { flags: "wx" }));
      } catch (e) {
        if (e?.code === "ENOSPC") return refuser(507, "PLUS_DE_PLACE", "Ton Mac n'a plus assez de place pour ce fichier. Libère de la place, puis réessaie.");
        if (e instanceof ErreurStudio) return refuser(e.statut, e.code, e.messageRomain);
        if (req.destroyed || res.destroyed || e?.code === "ERR_STREAM_PREMATURE_CLOSE" || e?.code === "ECONNRESET") {
          journal("envoi_annule", { slug, recu });
          if (!res.headersSent && !res.destroyed) return refuser(400, "INCOMPLET", "L'envoi a été coupé : rien n'est rangé.");
          return;
        }
        throw e;
      }
      if (recu !== taille) return refuser(400, "INCOMPLET", "L'envoi a été coupé : rien n'est rangé.");
      if (rangementEnCours) throw new ErreurStudio("OCCUPE", RANGEMENT_OCCUPE, 409);
      try {
        await file.suivre("rangement", { slug }, () => placerManuel(config, { fichier: nom, slug, type, envoi: chemin }));
      } catch (e) {
        if (e.code === "OCCUPE") throw new ErreurStudio("OCCUPE", RANGEMENT_OCCUPE, 409);
        if (e.code === "FICHIER") throw new ErreurStudio("ILLISIBLE", "Je n'arrive pas à lire cette vidéo : rien n'est rangé. Essaie de l'exporter à nouveau.", 400);
        throw e;
      }
      journal("envoi_range", { slug, type, taille });
      await copierBibliotheque().catch(() => {});
      rafraichir();
      return envoyerJson(res, 200, { nom });
    } finally {
      fs.rmSync(dossier, { recursive: true, force: true });
    }
  }

  async function avantAction() {
    try { await synchro.tirer(); } catch { /* hors ligne : on travaille avec ce qu'on a */ }
  }

  function exigerChat(chatId) {
    const t = typeDeChat(chatId);
    if (!t) throw new ErreurStudio("INTROUVABLE", "Je ne trouve pas cette conversation.", 404);
    if (t.slug) exigerSlug(t.slug);
    return t;
  }

  // Romain a retouché son brief dans le studio depuis le dernier message de ce chat (dates des
  // fichiers, jamais la mémoire du modèle) : le modèle doit relire le fichier avant d'y toucher.
  function briefRetouche(chatId, slug) {
    const h = pont.historique(chatId);
    const dernier = h.length ? Date.parse(h[h.length - 1].le) : NaN;
    if (!Number.isFinite(dernier)) return false;
    const format = instantane(config, slug, lireDepot(config.depot)).contenu.format;
    const d = dateBrief(config, slug, format);
    return Boolean(d && d > dernier + 1000);
  }

  function messagePourModele(chatId, t, texte) {
    if (pont.aUneSession(chatId)) {
      if (t.genre === "hoc" && briefRetouche(chatId, t.slug)) {
        return `${config.client?.prenom || config.prenom} a retouché son texte dans le studio depuis ton dernier message : relis le fichier avant d'y toucher.\n\n${texte}`;
      }
      return texte;
    }
    if (t.genre === "hoc") return `On travaille sur le contenu ${t.slug} (contenus/${t.slug}/).\n\n${texte}`;
    if (t.genre === "monteur") {
      const script = path.join(config.depot, "contenus", t.slug, "script.md");
      const video = videoFace(config, t.slug);
      return `On travaille sur le contenu ${t.slug}. Vidéo face caméra : ${video || "aucune pour l'instant"}. Son script : ${script}.\n\n${texte}`;
    }
    return texte;
  }

  async function api(req, res, url) {
    const p = url.pathname.split("/").slice(2); // après /api/
    const m = req.method;
    // L'envoi d'une vidéo (plusieurs Go) se lit en flux : la limite de 1 Mo des routes JSON ne s'y applique pas.
    const estEnvoi = m === "POST" && p[0] === "cartes" && p[2] === "rushs" && p[3] === "envoyer" && p.length === 4;
    const corps = m === "POST" && !estEnvoi ? await lireCorps(req) : {};

    if (m === "GET" && p[0] === "etat" && p.length === 1) {
      rafraichir();
      majARanger({ frais: true });
      return envoyerJson(res, 200, {
        cartes: [...cartes.values()],
        a_ranger: JSON.parse(aRangerJson),
        file: file.liste(),
        file_pause: file.vuePause?.() || null,
        version: VERSION,
        alertes: alertesDuStudio(),
        sync: synchro.etat,
        tournages: listeTournages(config),
        config: {
          prenom: config.prenom,
          contact: config.contact,
          appli: config.appli?.nom || "Studio",
          // Ressources gratuites (site réglé pour ce client) : entrée du menu, fichier du dossier, choix au
          // récapitulatif. Faux = rien de tout ça n'apparaît.
          ressources: ressourcesActives(config),
          jours_par_defaut: config.publication?.jours_par_defaut || [],
          heures_par_defaut: config.publication?.heures_par_defaut || {},
        },
      });
    }

    if (p[0] === "cartes" && p.length >= 2) {
      const slug = exigerSlug(decodeURIComponent(p[1]));
      // La vignette du hook d'un reel monté (lot 10) : fabriquée une fois par version de la vidéo.
      if (m === "GET" && p[2] === "vignette" && p.length === 3) {
        const f = await vignetteReel(config, slug);
        if (!f) throw new ErreurStudio("INTROUVABLE", "Pas de vignette pour ce contenu.", 404);
        return servirFichier(req, res, f, { cache: "private, max-age=86400" });
      }
      // Les autres fichiers du dossier (19/11) : images et textes seulement, en lecture, confinés au dossier du
      // contenu ; aucun script ne s'exécute (un SVG s'affiche en <img>, et la page servie seule est bac à sable).
      if (m === "GET" && p[2] === "fichiers" && p.length >= 4) {
        const seg = segmentsSurs(p.slice(3));
        const f = seg && fichierAutre(path.join(config.depot, "contenus", slug), seg);
        if (!f) throw new ErreurStudio("INTROUVABLE", "Je ne trouve pas ce fichier.", 404);
        return servirFichier(req, res, f, { cache: "private, max-age=86400",
          entetes: { "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox", "Content-Disposition": "inline" } });
      }
      if (m === "GET" && p.length === 2) {
        const d = detail(config, slug, etatLocal());
        if (!d) throw new ErreurStudio("INTROUVABLE", "Je ne trouve pas ce contenu.", 404);
        return envoyerJson(res, 200, d);
      }
      if (m === "POST" && p[2] === "telecharger" && p.length === 3) {
        const r = await telechargerVideo(config, slug, { montrer: process.env.STUDIO_SANS_FINDER !== "1" });
        if (!r) throw new ErreurStudio("INTROUVABLE", "Pas encore de vidéo montée pour ce contenu.", 404);
        journal("video_telechargee", { slug, nom: r.nom });
        return envoyerJson(res, 200, { nom: r.nom });
      }
      if (m === "POST" && p[2] === "valider") {
        await avantAction();
        await outilDepot(config, "etat.py", ["valider", slug, "--pousser"]);
        // Le head of content enregistre la matière et le statut de la semaine (contrat, section 10).
        const chat = `${slug}:hoc`;
        pont.envoyer(chat, {
          texte: "J'ai validé ce contenu.",
          envoi: messagePourModele(chat, typeDeChat(chat), `J'ai validé le contenu ${slug}.`),
          romain: true,
        });
        rafraichir();
        return envoyerJson(res, 200, {});
      }
      if (m === "POST" && p[2] === "brief" && p.length === 3) {
        // Romain retouche son brief (lot 9) : écrit par outils/brief.py, jamais par le modèle.
        const occupe = pont.actif(`${slug}:hoc`)
          || file.liste().some((a) => a.slug === slug && ["script", "mise_en_page"].includes(a.type) && ["en_cours", "en_file"].includes(a.statut));
        if (occupe) throw new ErreurStudio("OCCUPE", "Je travaille encore sur ce texte : attends que j'aie fini pour le retoucher.", 409);
        const entree = {};
        for (const k of ["texte", "plans", "legende"]) {
          if (corps[k] === undefined) continue;
          if (typeof corps[k] !== "string") throw new ErreurStudio("CORPS_ILLISIBLE", MESSAGE_GENERIQUE, 400);
          entree[k] = corps[k].slice(0, 20000);
        }
        if (corps.slides !== undefined) {
          if (!Array.isArray(corps.slides)) throw new ErreurStudio("CORPS_ILLISIBLE", MESSAGE_GENERIQUE, 400);
          entree.slides = corps.slides.slice(0, 30).map((s) => {
            const r = { n: Number(s?.n) };
            if (!Number.isInteger(r.n) || r.n < 1) throw new ErreurStudio("CORPS_ILLISIBLE", MESSAGE_GENERIQUE, 400);
            for (const k of ["titre", "texte"]) if (typeof s?.[k] === "string") r[k] = s[k].slice(0, 2000);
            return r;
          });
        }
        if (!Object.keys(entree).length) throw new ErreurStudio("RIEN", "Rien à enregistrer.", 400);
        const empreinte = typeof corps.empreinte === "string" && /^sha256:[0-9a-f]{64}$/.test(corps.empreinte) ? corps.empreinte : null;
        const dossierTmp = path.join(config.home, "tmp");
        fs.mkdirSync(dossierTmp, { recursive: true });
        const tmp = path.join(dossierTmp, `brief-${crypto.randomBytes(6).toString("hex")}.json`);
        fs.writeFileSync(tmp, JSON.stringify(entree));
        let r;
        try {
          await avantAction();
          r = await outilDepot(config, "brief.py", ["ecrire", slug, "--depuis", tmp, ...(empreinte ? ["--empreinte", empreinte] : []), "--pousser"]);
        } finally {
          fs.rmSync(tmp, { force: true });
        }
        rafraichir();
        return envoyerJson(res, 200, { empreinte: /empreinte=(sha256:[0-9a-f]+)/.exec(r.sortie)?.[1] || null });
      }
      if (m === "POST" && p[2] === "accroche" && p.length === 3) {
        // Romain choisit son accroche (lot 12) : écrite par outils/brief.py, jamais par le modèle.
        const n = Number(corps.n);
        if (!Number.isInteger(n) || n < 1 || n > 20) throw new ErreurStudio("CORPS_ILLISIBLE", MESSAGE_GENERIQUE, 400);
        const occupe = pont.actif(`${slug}:hoc`)
          || file.liste().some((a) => a.slug === slug && a.type === "script" && ["en_cours", "en_file"].includes(a.statut));
        if (occupe) throw new ErreurStudio("OCCUPE", "Je travaille encore sur ce texte : attends que j'aie fini pour changer l'accroche.", 409);
        const inst = instantane(config, slug, lireDepot(config.depot));
        const st = stadeDe(inst.contenu, inst.fichiers, etatLocal()).stade;
        if (!["script_ecrit", "valide", "tournage_prevu"].includes(st)) {
          throw new ErreurStudio("TROP_TARD", "Ta vidéo est déjà tournée : l'accroche ne se change plus ici. Dis-le à ton monteur si besoin.", 409);
        }
        const empreinte = typeof corps.empreinte === "string" && /^sha256:[0-9a-f]{64}$/.test(corps.empreinte) ? corps.empreinte : null;
        await avantAction();
        const r = await outilDepot(config, "brief.py", ["accroche", slug, String(n), ...(empreinte ? ["--empreinte", empreinte] : []), "--pousser"]);
        rafraichir();
        return envoyerJson(res, 200, { empreinte: /empreinte=(sha256:[0-9a-f]+)/.exec(r.sortie)?.[1] || null });
      }
      if (estEnvoi) return recevoirEnvoi(req, res, slug, url);
      if (m === "POST" && p[2] === "rushs" && p[3] === "type" && p.length === 4) {
        const id = String(corps.id || "");
        const mm = /^(face|b-roll)\/([^/\\]+)$/.exec(id);
        if (!mm || mm[2].startsWith(".")) throw new ErreurStudio("INTROUVABLE", "Je ne trouve plus ce fichier.", 404);
        const nouveau = corps.type;
        if (!["face", "b-roll"].includes(nouveau) || nouveau === mm[1]) throw new ErreurStudio("TYPE", MESSAGE_GENERIQUE, 400);
        exigerMontageLibre(slug, { stadeExact: true });
        if (rangementEnCours || verrouPris(config.media)) throw new ErreurStudio("OCCUPE", RANGEMENT_OCCUPE, 409);
        await file.suivre("rangement", { slug }, () => changerTypeRush(config, { slug, type: mm[1], nom: mm[2], nouveau }));
        await copierBibliotheque().catch(() => {});
        rafraichir();
        return envoyerJson(res, 200, {});
      }
      if (m === "POST" && p[2] === "rushs" && p[3] === "retirer" && p.length === 4) {
        const id = String(corps.id || "");
        const mm = /^(face|b-roll|photos)\/([^/\\]+)$/.exec(id);
        if (!mm || mm[2].startsWith(".")) throw new ErreurStudio("INTROUVABLE", "Je ne trouve plus ce fichier.", 404);
        const lu = lireDepot(config.depot);
        const inst = instantane(config, slug, lu);
        const st = stadeDe(inst.contenu, inst.fichiers, etatLocal()).stade;
        const montage = pont.actif(`${slug}:monteur`)
          || file.liste().some((a) => a.slug === slug && a.type === "montage" && ["en_cours", "en_file"].includes(a.statut));
        if (st !== "rushs_recus" || montage) {
          throw new ErreurStudio("TROP_TARD", "Le montage a déjà commencé avec ces vidéos : dis dans le chat du montage ce qui ne va pas.", 409);
        }
        const type = mm[1] === "photos" ? "photo" : mm[1];
        await file.suivre("rangement", { slug }, () => retirerRush(config, { slug, type, nom: mm[2] }));
        await copierBibliotheque().catch(() => {});
        rafraichir();
        return envoyerJson(res, 200, {});
      }
      if (m === "POST" && p[2] === "jour") {
        const jour = corps.jour === null || corps.jour === undefined || corps.jour === "" ? "aucun" : exigerJour(corps.jour);
        await avantAction();
        await outilDepot(config, "etat.py", ["jour", slug, jour, "--pousser"]);
        rafraichir();
        return envoyerJson(res, 200, {});
      }
      // L'aperçu du montage (lot 8, contrat section 16) : une note de correction, ou « Fabrique la vidéo ». Les deux
      // partent au chat du monteur ; la note s'écrit d'abord dans notes-apercu.json du dossier de montage (l'état vient
      // des fichiers). Aucune édition directe du montage.
      if (m === "POST" && p[2] === "apercu" && p.length === 4 && ["notes", "fabriquer"].includes(p[3])) {
        const faceDir = path.join(config.media, slug, "face");
        const a = apercuDe(faceDir);
        if (!a) throw new ErreurStudio("PAS_D_APERCU", "Il n'y a pas encore d'aperçu pour ce montage.", 409);
        const dossier = path.join(faceDir, a.dossier);
        const chat = `${slug}:monteur`;
        const prenom = config.client?.prenom || config.prenom || "la personne";
        let texte, envoi;
        if (p[3] === "notes") {
          const total = Number(lireJson(path.join(dossier, "apercu", "apercu.json"), null)?.images) || 0;
          const image = Number(corps.image);
          if (!Number.isInteger(image) || image < 0 || (total && image >= total)) throw new ErreurStudio("CORPS_ILLISIBLE", MESSAGE_GENERIQUE, 400);
          const t = typeof corps.texte === "string" ? corps.texte.trim().slice(0, 2000) : "";
          if (!t) throw new ErreurStudio("VIDE", "Écris ce que tu veux changer, puis envoie.", 400);
          const traits = traitsPropres(corps.traits);
          const zone = zoneDe(traits);
          const notes = notesApercu(dossier);
          const note = { n: notes.reduce((x, y) => Math.max(x, Number(y.n) || 0), 0) + 1, le: isoZurich(), image,
            instant: Math.round(image / 30 * 1000) / 1000, texte: t, zone, traits };
          ecrireJson(path.join(dossier, "notes-apercu.json"), { notes: [...notes, note] });
          texte = `À ${instantLisible(image)} (image ${image}) : ${t}${zone ? " (zone entourée)" : ""}`;
          const ou = zone
            ? `Zone entourée sur l'écran (en part de la largeur et de la hauteur, depuis le coin en haut à gauche) : x de ${zone.x} à ${Math.round((zone.x + zone.l) * 1000) / 1000}, y de ${zone.y} à ${Math.round((zone.y + zone.h) * 1000) / 1000} (traits complets dans le fichier).`
            : "Pas de zone entourée.";
          envoi = `Note de correction de ${prenom} sur l'aperçu, n°${note.n} dans ${path.join(dossier, "notes-apercu.json")} : `
            + `image ${image} de la vidéo coupée (${note.instant} s). « ${t} » ${ou}`;
        } else {
          if (pont.actif(chat)) throw new ErreurStudio("OCCUPE", "Ton monteur travaille encore : attends qu'il ait fini pour fabriquer la vidéo.", 409);
          texte = "C'est bon, fabrique la vidéo.";
          envoi = `${prenom} a validé l'aperçu (bouton « Fabrique la vidéo »). Fabrique la vidéo avec les couches de l'aperçu `
            + `(${path.join(dossier, "apercu", "apercu.json")}, « couches »), puis vérifie-la comme d'habitude.`;
        }
        if (!pont.actif(chat)) await avantAction();
        file.repriseParRomain(chat);
        pont.envoyer(chat, { texte, envoi: messagePourModele(chat, typeDeChat(chat), envoi), romain: true, besoin: { slug } });
        rafraichir();
        return envoyerJson(res, 200, {});
      }
      if (m === "POST" && p[2] === "abandonner") {
        const raison = texteCourt(corps.raison, 20000);
        await avantAction();
        await outilDepot(config, "etat.py", ["abandonner", slug, ...(raison ? ["--raison", raison] : []), "--pousser"]);
        rafraichir();
        return envoyerJson(res, 200, {});
      }
    }

    // Chiffres Instagram (contrat, section 15) : le cache tout de suite ; s'il est vieux, une relecture
    // part en fond et l'événement « stats » apporte les nouveaux chiffres.
    if (m === "GET" && p[0] === "stats" && p.length === 1) {
      if (stats.perime()) stats.actualiser().catch(() => {});
      return envoyerJson(res, 200, stats.vue(titresCartes()));
    }
    if (m === "POST" && p[0] === "stats" && p[1] === "actualiser" && p.length === 2) {
      await stats.actualiser();
      return envoyerJson(res, 200, stats.vue(titresCartes()));
    }

    if (p[0] === "tournages" && p.length >= 2) {
      const id = decodeURIComponent(p[1]);
      if (!/^[A-Za-z0-9-]{1,64}$/.test(id)) throw new ErreurStudio("INTROUVABLE", "Je ne trouve pas ce plan de tournage.", 404);
      const t = lireTournage(config, id);
      if (!t) throw new ErreurStudio("INTROUVABLE", "Je ne trouve pas ce plan de tournage.", 404);
      const { brut, titres, ...lisible } = t;
      const plan = { ...brut, id };
      const nums = new Set((brut.prises || []).map((x) => x.n));
      const reponse = (suivi) => {
        const pub = suiviPublic(suivi, rangementsTournage.has(id));
        // Ce qui arrive en ce moment, quand l'écran doit le montrer : envoi coché pas encore validé, ou plan à finir.
        const suivre = (suivi.envoi && !suivi.valide_le) || pub.a_finir;
        return { ...lisible, bulles: bulles(config, plan, titres), suivi: pub, reception: suivre ? receptionDuPlan(config, plan) : null };
      };
      if (m === "GET" && p.length === 2) return envoyerJson(res, 200, reponse(lireSuivi(config, id)));
      if (m === "GET" && p[2] === "reception" && p.length === 3) {
        // Où en est l'envoi (l'écran du plan le redemande toutes les deux secondes tant qu'un fichier arrive) :
        // si la dernière étape est cochée et que la vérification attendait, elle est refaite ici.
        const suivi = lireSuivi(config, id);
        if (suivi.envoi && !suivi.valide_le && suivi.verification && !suivi.verification.complet) {
          const v = verifierArrivees(config, plan, suivi);
          const sans = ({ le, ...x }) => JSON.stringify(x);
          if (sans(v) !== sans(suivi.verification)) { suivi.verification = v; ecrireSuivi(config, id, suivi); }
        }
        return envoyerJson(res, 200, { reception: receptionDuPlan(config, plan), suivi: suiviPublic(suivi, rangementsTournage.has(id)) });
      }
      if (m === "POST" && p[2] === "cocher" && p.length === 3) {
        // Une prise cochée, ou la dernière étape (« envoi ») : seule celle-ci lance la vérification des
        // fichiers arrivés ; la décocher l'efface (le bouton se désactive).
        const suivi = lireSuivi(config, id);
        const coche = corps.coche === true;
        if (corps.cle === "envoi") {
          suivi.envoi = coche;
          suivi.verification = coche ? verifierArrivees(config, plan, suivi) : null;
        } else {
          const n = Number(corps.cle);
          if (!nums.has(n)) throw new ErreurStudio("INTROUVABLE", "Je ne trouve pas cette prise.", 404);
          suivi.coches = coche ? [...new Set([...suivi.coches, n])].sort((a, b) => a - b) : suivi.coches.filter((x) => x !== n);
        }
        ecrireSuivi(config, id, suivi);
        rafraichir();
        return envoyerJson(res, 200, reponse(suivi));
      }
      if (m === "POST" && p[2] === "sauter" && p.length === 3) {
        // « Je ne la fais pas » : la prise n'est plus attendue (une photo qu'il n'a pas, un plan laissé).
        const n = Number(corps.n);
        if (!nums.has(n)) throw new ErreurStudio("INTROUVABLE", "Je ne trouve pas cette prise.", 404);
        const suivi = lireSuivi(config, id);
        suivi.sautees = corps.sautee === true ? [...new Set([...suivi.sautees, n])].sort((a, b) => a - b) : suivi.sautees.filter((x) => x !== n);
        suivi.coches = suivi.coches.filter((x) => x !== n);
        if (suivi.envoi) suivi.verification = verifierArrivees(config, plan, suivi);
        ecrireSuivi(config, id, suivi);
        return envoyerJson(res, 200, reponse(suivi));
      }
      if (m === "POST" && p[2] === "valider" && p.length === 3) {
        // Revérifie au clic ; complet : le rangement de ce plan part (fichiers répartis dans les dossiers
        // des contenus, le reste dans « À ranger ») et la fin du tournage est posée à la fin du rangement.
        if (rangementsTournage.has(id) || rangementEnCours) throw new ErreurStudio("OCCUPE", "Je range déjà tes fichiers : attends un instant.", 409);
        const suivi = lireSuivi(config, id);
        const encore = Boolean(suivi.valide_le);
        // Jamais de rangement pendant qu'un fichier arrive : il serait laissé de côté (lot de l'AirDrop lent).
        if (encore && receptionDuPlan(config, plan).en_cours.length) {
          throw new ErreurStudio("EN_RECEPTION", "Un fichier est encore en train d'arriver sur ton Mac. Attends la fin de l'envoi, puis range.", 409);
        }
        if (!encore) {
          if (!suivi.envoi) throw new ErreurStudio("PAS_ENVOYE", "Coche d'abord la dernière étape, quand tout est envoyé.", 409);
          suivi.verification = verifierArrivees(config, plan, suivi);
          ecrireSuivi(config, id, suivi);
          if (!suivi.verification.complet) {
            return envoyerJson(res, 409, { erreur: "PAS_COMPLET", message: suivi.verification.message, ...reponse(suivi) });
          }
        }
        rangementsTournage.add(id);
        rangerMaintenant(id).then((lu) => {
          noterRangement(id, lu, { valider: true });
        }).catch((e) => {
          rangementsTournage.delete(id);
          const s = lireSuivi(config, id);
          s.rangement = { erreur: e?.messageRomain || MESSAGE_GENERIQUE, le: isoZurich() };
          ecrireSuivi(config, id, s);
          diffuser("tournages", { tournages: listeTournages(config) });
        });
        diffuser("tournages", { tournages: listeTournages(config) });
        return envoyerJson(res, 200, reponse(lireSuivi(config, id)));
      }
    }

    // Un lien externe (la vidéo d'un outlier, une publication) s'ouvre dans le navigateur habituel de
    // Romain, pas dans la fenêtre du studio (lot 12). https seulement, sans identifiants.
    if (m === "POST" && p[0] === "lien" && p.length === 1) {
      let u = null;
      try { u = new URL(String(corps.url || "")); } catch { /* illisible */ }
      if (!u || u.protocol !== "https:" || u.username || u.password || !u.hostname.includes(".") || String(corps.url).length > 2000) {
        throw new ErreurStudio("LIEN", "Je n'ouvre pas ce lien.", 400);
      }
      const commande = process.env.STUDIO_OUVRIR || "/usr/bin/open";
      const r = await executer(commande, [u.href], { delaiMs: 15000 });
      if (r.code !== 0) throw new ErreurStudio("LIEN", "Je n'ai pas pu ouvrir ce lien.", 500);
      journal("lien_ouvert", { hote: u.hostname });
      return envoyerJson(res, 200, {});
    }

    if (m === "POST" && p[0] === "propositions" && p.length === 3) {
      const id = decodeURIComponent(p[1]);
      if (!/^[A-Za-z0-9-]{1,80}$/.test(id)) throw new ErreurStudio("INTROUVABLE", "Je ne trouve pas cette idée.", 404);
      if (p[2] === "garder") {
        const args = ["garder", id];
        if (corps.jour) args.push("--jour", exigerJour(corps.jour));
        await avantAction();
        const r = await outilDepot(config, "idees.py", [...args, "--pousser"]);
        rafraichir();
        return envoyerJson(res, 200, { slug: r.champs.slug || null });
      }
      // « Supprimer » (lot 12) = le refus existant : l'idée disparaît, sa raison sert au head of content.
      if (p[2] === "refuser" || p[2] === "supprimer") {
        const raison = texteCourt(corps.raison, 20000);
        await avantAction();
        await outilDepot(config, "idees.py", ["refuser", id, ...(raison ? ["--raison", raison] : []), "--pousser"]);
        rafraichir();
        return envoyerJson(res, 200, {});
      }
      if (p[2] === "mettre-de-cote" || p[2] === "reprendre") {
        await avantAction();
        await outilDepot(config, "idees.py", [p[2], id, "--pousser"]);
        rafraichir();
        return envoyerJson(res, 200, {});
      }
    }

    if (m === "POST" && p[0] === "actions" && p.length === 1) {
      const type = corps.type;
      if (!["script", "tournage", "montage", "mise_en_page"].includes(type)) {
        throw new ErreurStudio("ACTION_INCONNUE", MESSAGE_GENERIQUE, 400);
      }
      const slugs = [...new Set(Array.isArray(corps.slugs) ? corps.slugs : [])];
      if (!slugs.length) throw new ErreurStudio("RIEN_CHOISI", "Choisis au moins un contenu.", 400);
      for (const s of slugs) exigerSlug(s);
      const titres = new Map(construireCartes(config, etatLocal()).filter((c) => c.slug).map((c) => [c.slug, c]));
      for (const s of slugs) {
        const c = titres.get(s);
        if (type === "montage" && !videoFace(config, s)) {
          throw new ErreurStudio("PAS_DE_VIDEO", `Il n'y a pas encore de vidéo tournée pour « ${c?.titre || s} ».`, 409);
        }
        if (type === "mise_en_page" && c?.format !== "carrousel") {
          throw new ErreurStudio("PAS_UN_CARROUSEL", `« ${c?.titre || s} » n'est pas un carrousel.`, 409);
        }
        if (type === "mise_en_page" && !existe(path.join(config.depot, "a-rendre", "carrousels", `${s}.md`))
          && !existe(path.join(config.depot, "rendus", "carrousels", `${s}.md`))) {
          throw new ErreurStudio("PAS_DE_TEXTE", `Le texte de « ${c?.titre || s} » n'est pas encore écrit.`, 409);
        }
      }
      // Pas de doublon : un contenu déjà dans la file pour ce travail n'y entre pas deux fois.
      const deja = file.liste().filter((a) => a.type === type && ["en_file", "en_cours"].includes(a.statut));
      const restants = type === "tournage" ? slugs
        : slugs.filter((s) => !deja.some((a) => a.slug === s));
      if (!restants.length) return envoyerJson(res, 200, { lot: deja[0]?.lot || null, actions: deja.filter((a) => slugs.includes(a.slug)) });
      const r = file.ajouter(type, restants);
      return envoyerJson(res, 200, r);
    }

    if (m === "POST" && p[0] === "actions" && p[2] === "arreter" && p.length === 3) {
      if (!file.arreter(decodeURIComponent(p[1]))) throw new ErreurStudio("INTROUVABLE", "Je ne trouve pas ce travail.", 404);
      return envoyerJson(res, 200, {});
    }
    // Une action en souci (lot 12) : la relancer (elle repart sur sa conversation) ou l'effacer de la liste.
    if (m === "POST" && p[0] === "actions" && ["relancer", "effacer"].includes(p[2]) && p.length === 3) {
      const r = p[2] === "relancer" ? file.relancer(decodeURIComponent(p[1])) : file.effacer(decodeURIComponent(p[1]));
      if (r.code === "INTROUVABLE") throw new ErreurStudio("INTROUVABLE", "Je ne trouve pas ce travail.", 404);
      if (r.code === "PAS_RELANCABLE") throw new ErreurStudio("PAS_RELANCABLE", "Ce travail se relance depuis son bouton, dans le dossier du contenu.", 409);
      if (!r.ok) throw new ErreurStudio(r.code, "Ce travail n'est pas en souci.", 409);
      return envoyerJson(res, 200, {});
    }
    // « Faire de la place » (lot 12) : les vidéos de tournage des contenus publiés partent sur le disque externe.
    if (m === "POST" && p[0] === "archiver" && p.length === 1) {
      if (file.liste().some((a) => a.type === "archivage" && a.statut === "en_cours")) {
        throw new ErreurStudio("OCCUPE", "Je fais déjà de la place : attends que ce soit fini.", 409);
      }
      const r = await file.suivre("archivage", {}, () => lancerArchivage(config));
      alertesJson = "";
      alertesDuStudio();
      rafraichir();
      return envoyerJson(res, 200, r);
    }

    if (p[0] === "chats" && p.length >= 2) {
      const chatId = decodeURIComponent(p[1]);
      const t = exigerChat(chatId);
      if (m === "GET" && p.length === 2) {
        return envoyerJson(res, 200, { messages: pont.historique(chatId), etat: pont.etat(chatId) });
      }
      if (m === "POST" && p[2] === "nouvelle" && p.length === 3) {
        if (t.genre !== "general") throw new ErreurStudio("INTROUVABLE", "Je ne trouve pas cette conversation.", 404);
        if (!pont.reinitialiser(chatId)) throw new ErreurStudio("OCCUPE", "J'ai un travail en cours ici : attends qu'il soit fini, ou arrête-le.", 409);
        return envoyerJson(res, 200, {});
      }
      if (m === "POST" && p[2] === "messages") {
        const texte = typeof corps.texte === "string" ? corps.texte.trim().slice(0, 20000) : "";
        if (!texte) throw new ErreurStudio("VIDE", "Écris ton message avant de l'envoyer.", 400);
        // Retour après une pause : le chat général repart sur une conversation neuve (l'ancienne est archivée).
        if (t.genre === "general" && !pont.actif(chatId)) {
          const dernier = pont.dernierMessage(chatId);
          const quand = Date.parse(dernier?.le || "");
          if (Number.isFinite(quand) && Date.now() - quand > PAUSE_CHAT_GENERAL_MS) pont.reinitialiser(chatId);
        }
        if (t.genre === "monteur" && !existe(path.join(config.media, t.slug))) {
          throw new ErreurStudio("PAS_DE_VIDEO", "Il n'y a pas encore de vidéo pour ce contenu.", 409);
        }
        if (!pont.actif(chatId)) await avantAction();
        file.repriseParRomain(chatId);
        const action = file.actionDuChat(chatId, ["en_cours"]);
        pont.envoyer(chatId, {
          texte, envoi: messagePourModele(chatId, t, texte), romain: true,
          besoin: { miseEnPage: action?.type === "mise_en_page", slug: t.slug },
        });
        return envoyerJson(res, 200, {});
      }
      if (m === "POST" && p[2] === "arreter") {
        if (!pont.arreter(chatId)) throw new ErreurStudio("RIEN_A_ARRETER", "Il n'y a rien en cours ici.", 409);
        return envoyerJson(res, 200, {});
      }
    }

    if (m === "POST" && p[0] === "rangement") {
      if (p[1] === "placer") {
        const fichier = String(corps.fichier || "");
        // Un fichier de _a-ranger/, ou un clip de la bibliothèque (clip_id) à lier à une autre carte.
        const estClip = /^\d{8}-\d{6}-[a-z0-9]{4}$/.test(fichier);
        // Ou une vidéo arrivée sur le Mac après un plan et pas encore rangée (« À ranger », en attente) :
        // seulement si elle est dans cette liste, relue à l'instant, et arrivée en entier.
        let arrivee = null;
        if (corps.arrivee === true && fichier && !fichier.includes("/") && !fichier.startsWith(".")) {
          attentesCache.le = 0;
          const a = rushsEnAttente().find((x) => x.nom === fichier);
          if (a?.en_cours) throw new ErreurStudio("EN_RECEPTION", "Ce fichier est encore en train d'arriver sur ton Mac. Attends la fin de l'envoi, puis range-le.", 409);
          arrivee = a?.tournage || null;
          if (!arrivee) throw new ErreurStudio("INTROUVABLE", "Je ne trouve plus ce fichier.", 404);
        }
        if (!arrivee && (!fichier || fichier.includes("/") || fichier.startsWith(".")
          || (!estClip && !existe(path.join(config.media, "_a-ranger", fichier))))) {
          throw new ErreurStudio("INTROUVABLE", "Je ne trouve plus ce fichier.", 404);
        }
        const slug = exigerSlug(corps.slug);
        if (!["face", "b-roll", "photo"].includes(corps.type)) throw new ErreurStudio("TYPE", MESSAGE_GENERIQUE, 400);
        if (arrivee && (rangementsTournage.has(arrivee) || rangementEnCours)) throw new ErreurStudio("OCCUPE", "Je range déjà tes fichiers : attends un instant.", 409);
        await file.suivre("rangement", { slug }, () => placerManuel(config, { fichier, slug, type: corps.type, arrivee }));
        if (arrivee) majARanger({ frais: true });
        await copierBibliotheque().catch(() => {});
        rafraichir();
        return envoyerJson(res, 200, {});
      }
      if (p[1] === "relancer") {
        // Le plan rangé (le dernier validé) garde son bilan, comme après « Ranger maintenant ».
        const dernier = listeTournages(config).filter((x) => x.valide && Date.now() - (Date.parse(x.cree_le) || 0) < 7 * 86400e3)[0];
        rangerMaintenant(dernier?.id || null).then((lu) => { if (lu && dernier) noterRangement(dernier.id, lu); }).catch(() => {});
        return envoyerJson(res, 200, {});
      }
    }

    // Ressources gratuites (studio de Yoan) : 404 pour un client sans site de ressources. Lecture seule :
    // la mise en ligne est faite par le head of content dès qu'une ressource est prête (18/11/2026).
    if (p[0] === "ressources") {
      ressources.exiger();
      if (m === "GET" && p.length === 1) return envoyerJson(res, 200, await ressources.lister());
      // Le petit aperçu d'une page (lot 10) : une capture de la page, une fois par version de la page.
      // (« vignette » : l'ancienne adresse « apercu », l'aperçu local retiré le 18/11, reste introuvable.)
      if (m === "GET" && p.length === 3 && p[2] === "vignette") {
        const f = await apercuRessource(config, exigerSlug(decodeURIComponent(p[1])));
        if (!f) throw new ErreurStudio("INTROUVABLE", "Pas d'aperçu pour cette page.", 404);
        return servirFichier(req, res, f, { cache: "private, max-age=86400" });
      }
    }

    if (m === "POST" && p[0] === "publication") {
      if (p[1] === "recap") return envoyerJson(res, 200, await publication.recap(corps.elements));
      if (p[1] === "poser-mot") {
        const r = await publication.poserMot(corps.slug, corps.ressource);
        rafraichir();
        return envoyerJson(res, 200, r);
      }
      if (p[1] === "confirmer") {
        const textes = corps.textes && typeof corps.textes === "object" && !Array.isArray(corps.textes) ? corps.textes : {};
        // Le quand de chaque post, choisi après la préparation (lot 10) : « maintenant » ou « AAAA-MM-JJ HH:MM ».
        const quands = corps.quands && typeof corps.quands === "object" && !Array.isArray(corps.quands) ? corps.quands : {};
        const r = await publication.confirmer(String(corps.recap_id || ""), textes, quands);
        rafraichir();
        return envoyerJson(res, 200, r);
      }
      if (p[1] === "semaine") return envoyerJson(res, 200, await publication.semaine(corps.lundi));
    }

    if (m === "GET" && p[0] === "media" && p.length >= 3) {
      return media(req, res, p.slice(1));
    }

    if (m === "GET" && p[0] === "evenements" && p.length === 1) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      res.write(": studio\n\n");
      res.write(`event: sync\ndata: ${adresser(JSON.stringify(synchro.etat))}\n\n`);
      res.write(`event: file\ndata: ${adresser(JSON.stringify(vueFile()))}\n\n`);
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return undefined;
    }

    throw new ErreurStudio("INTROUVABLE", "Je ne trouve pas ce que tu demandes.", 404);
  }

  function media(req, res, brut) {
    const seg = segmentsSurs(brut);
    if (!seg) return erreur(res, 404, "INTROUVABLE", "Je ne trouve pas ce fichier.");
    const [tete, ...reste] = seg;
    if (!(tete === "_a-ranger" || tete === "_bibliotheque" || SLUG_RE.test(tete))) {
      return erreur(res, 404, "INTROUVABLE", "Je ne trouve pas ce fichier.");
    }
    const racine = path.join(config.media, tete);
    const chemin = path.join(racine, ...reste);
    if (!dedans(racine, chemin)) return erreur(res, 404, "INTROUVABLE", "Je ne trouve pas ce fichier.");
    let reel;
    try {
      reel = fs.realpathSync(chemin);
    } catch {
      return erreur(res, 404, "INTROUVABLE", "Je ne trouve pas ce fichier.");
    }
    // Les liens suivis ne mènent qu'au dossier média (bibliothèque) ou aux slides rendues.
    const permis = [config.media, config.carrousels || etendre("~/Pictures/Carrousels", config.maison)]
      .map((d) => { try { return fs.realpathSync(d); } catch { return null; } }).filter(Boolean);
    if (!permis.some((d) => dedans(d, reel))) return erreur(res, 404, "INTROUVABLE", "Je ne trouve pas ce fichier.");
    // Les calques de l'aperçu (compositions du monteur) se jouent dans des cadres de la page du studio.
    if (path.extname(reel).toLowerCase() === ".html") res.setHeader("X-Frame-Options", "SAMEORIGIN");
    return servirFichier(req, res, reel, { cache: "private, max-age=60" });
  }

  function statique(req, res, url) {
    if (url.pathname === "/" || url.pathname === "/index.html") {
      const index = path.join(interfaceDir, "index.html");
      if (!existe(index)) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        return res.end(PAGE_ATTENTE.replace("<title>Studio</title>", `<title>${echapper(config.appli?.nom || "Studio")}</title>`));
      }
      const html = Buffer.from(pageAccueil(fs.readFileSync(index, "utf8"), config), "utf8");
      res.writeHead(200, { "Content-Type": TYPES_MIME[".html"], "Cache-Control": "no-store", "Content-Length": html.length });
      return res.end(req.method === "HEAD" ? undefined : html);
    }
    if (url.pathname.startsWith("/app/")) {
      const seg = segmentsSurs(url.pathname.slice(5).split("/").filter(Boolean));
      if (seg && seg.length) {
        for (const base of [path.join(interfaceDir, "app"), interfaceDir]) {
          const f = path.join(base, ...seg);
          if (dedans(base, f) && existe(f) && fs.statSync(f).isFile()) return servirFichier(req, res, f);
        }
      }
    }
    // La police de titre que le client ne peut pas mettre dans le dépôt public (lot 10, Satoshi chez Yoan) : posée par
    // l'installation dans STUDIO_HOME/polices depuis un fichier à lui (polices_locales du fichier du client). Absente :
    // 404, le thème retombe sur sa police de repli.
    const pol = /^\/app\/polices-client\/([A-Za-z0-9][A-Za-z0-9._-]*\.(?:woff2|woff|ttf|otf))$/.exec(url.pathname);
    if (pol) return servirFichier(req, res, path.join(config.home, "polices", pol[1]), { cache: "private, max-age=86400" });
    if (url.pathname === "/favicon.ico") {
      res.writeHead(204);
      return res.end();
    }
    return erreur(res, 404, "INTROUVABLE", "Je ne trouve pas cette page.");
  }

  async function traiter(req, res) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    const hote = String(req.headers.host || "");
    if (!hotes.has(hote)) {
      res.writeHead(421, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Mauvaise adresse.");
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      if (!origines.has(String(req.headers.origin || ""))) {
        return erreur(res, 403, "ORIGINE", "Cette demande ne vient pas de ton studio.");
      }
    }
    let url;
    try {
      url = new URL(req.url, `http://${hote}`);
    } catch {
      return erreur(res, 400, "ADRESSE", MESSAGE_GENERIQUE);
    }
    if (url.pathname === "/" && url.searchParams.has("t")) {
      if (egalConstant(url.searchParams.get("t"), jeton)) {
        res.writeHead(302, {
          "Set-Cookie": `studio=${jeton}; HttpOnly; SameSite=Strict; Path=/`,
          Location: "/",
          "Cache-Control": "no-store",
        });
        return res.end();
      }
      res.writeHead(401, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      return res.end(PAGE_JETON.replace("<title>Studio</title>", `<title>${echapper(config.appli?.nom || "Studio")}</title>`));
    }
    if (url.pathname.startsWith("/api/")) {
      if (!egalConstant(cookies(req).studio, jeton)) {
        return erreur(res, 401, "NON_CONNECTE", "Ouvre le studio depuis son icône dans le Dock.");
      }
      try {
        return await api(req, res, url);
      } catch (e) {
        if (e instanceof ErreurStudio) return erreur(res, e.statut, e.code, e.messageRomain);
        journal("erreur_route", { route: url.pathname, erreur: String(e?.message || e) });
        return erreur(res, 500, "ERREUR", MESSAGE_GENERIQUE);
      }
    }
    if (req.method !== "GET" && req.method !== "HEAD") return erreur(res, 405, "METHODE", MESSAGE_GENERIQUE);
    return statique(req, res, url);
  }

  const serveur = http.createServer((req, res) => {
    traiter(req, res).catch((e) => {
      journal("erreur_serveur", { erreur: String(e?.message || e) });
      if (!res.headersSent) erreur(res, 500, "ERREUR", MESSAGE_GENERIQUE);
      else res.end();
    });
  });
  serveur.keepAliveTimeout = 5000;
  // Une vidéo de plusieurs Go peut mettre plus que les 5 minutes par défaut à arriver.
  serveur.requestTimeout = 2 * 3600e3;

  function ecouter() {
    brancherVeilleurs();
    rafraichir();
    return new Promise((resolve, reject) => {
      serveur.once("error", reject);
      serveur.listen(port, "127.0.0.1", () => resolve(serveur.address()));
    });
  }

  async function fermer() {
    ressources.fermer();
    clearInterval(periodique);
    clearInterval(ping);
    clearInterval(attentes);
    clearTimeout(attente);
    for (const w of veilleurs) { try { w.close(); } catch { /* rien */ } }
    for (const c of clients) { try { c.end(); } catch { /* rien */ } }
    clients.clear();
    await new Promise((r) => { serveur.close(() => r()); serveur.closeAllConnections?.(); });
  }

  return { serveur, ecouter, fermer, rafraichir, diffuser, publication, stats, ressources, rangerMaintenant, etatLocal, attenduPresent };
}
