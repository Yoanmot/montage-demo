// Le serveur HTTP local du studio (contrat, section 10) : 127.0.0.1 seulement, contrôles Host
// (421), Origin (403) et jeton par cookie (401), interface statique, API JSON, flux SSE.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { CODE } from "./config.mjs";
import {
  SLUG_RE, existe, dedans, lireJson, ecrireJson, etendre, isoZurich,
} from "./outils.mjs";
import {
  construireCartes, detail, aRanger, cleCarte, indexSansChemins, videoFace, listeTournages, lireTournage, dateBrief,
  instantane, lireDepot,
} from "./lecture.mjs";
import { stade as stadeDe } from "./stades.mjs";
import { typeDeChat } from "./reglages.mjs";
import { attenduPresent } from "./attendus.mjs";
import { lierSlides } from "../publication/carrousels.mjs";
import { configBrute } from "./publication.mjs";
import {
  ErreurStudio, MESSAGE_GENERIQUE, outilDepot, lancerRangement, placerManuel, retirerRush,
} from "./depot-outils.mjs";
import { Publication } from "./publication.mjs";
import { Stats } from "./stats.mjs";
import { executer } from "./commandes.mjs";
import { lireSuivi, ecrireSuivi, verifierArrivees, bulles, suiviPublic, receptionDuPlan, resteARanger, tailleLisible } from "./tournage.mjs";
import { arriveesPertinentes } from "../rangement/lib/commun.mjs";
import { Ressources, ressourcesActives } from "./ressources.mjs";
import { adresser } from "./client.mjs";

const TYPES_MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".heic": "image/heic", ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
  ".otf": "font/otf", ".mp4": "video/mp4", ".m4v": "video/mp4", ".mov": "video/quicktime", ".md": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4",
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
function servirFichier(req, res, chemin, { cache = "no-cache" } = {}) {
  let s;
  try {
    s = fs.statSync(chemin);
  } catch {
    return erreur(res, 404, "INTROUVABLE", "Je ne trouve pas ce fichier.");
  }
  if (!s.isFile()) return erreur(res, 404, "INTROUVABLE", "Je ne trouve pas ce fichier.");
  const type = TYPES_MIME[path.extname(chemin).toLowerCase()] || "application/octet-stream";
  const entetes = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": cache, "Last-Modified": s.mtime.toUTCString() };
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

export function creerServeur({ config, jeton, pont, file, synchro, journal = () => {} }) {
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
  // validé mais pas fini de ranger (arrivés après la fin du tournage, ou encore en réception). Ceux-là
  // restent dans le dossier d'arrivée tant que Romain n'a pas cliqué « Ranger maintenant ».
  let attentesCache = { le: 0, liste: [] };
  function rushsEnAttente() {
    if (Date.now() - attentesCache.le < 3000) return attentesCache.liste;
    const liste = [];
    try {
      const tous = listeTournages(config);   // du plus récent au plus ancien
      const plans = tous.filter((t) => t.a_finir && Date.now() - (Date.parse(t.cree_le) || 0) < 14 * 86400e3);
      const vus = new Set();
      for (const t of plans) {
        const { fichiers, en_cours: enCours } = arriveesPertinentes(config.arrivees, new Date(Date.parse(t.cree_le) || 0));
        for (const [f, recu] of [...enCours.map((f) => [f, false]), ...fichiers.map((f) => [f, true])]) {
          if (vus.has(f.nom)) continue;
          // Un fichier va au plan le plus récent créé avant son arrivée : celui d'un plan plus récent, pas
          // encore validé, attend la fin de ce plan-là.
          const sien = tous.find((x) => (Date.parse(x.cree_le) || 0) <= f.quand);
          if (sien && sien.id !== t.id) continue;
          vus.add(f.nom);
          liste.push({
            nom: f.nom, attente: true, en_cours: !recu, tournage: t.id, cree_le: t.cree_le,
            libelle: f.type === "photo" ? "ta photo" : "ta vidéo", taille_lisible: tailleLisible(f.taille),
            raison: recu ? "arrivée sur ton Mac après la fin de ton tournage, pas encore rangée" : "en cours de réception",
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
  pont.on("actives", () => rafraichir());
  file.on("change", (actions) => {
    diffuser("file", { actions });
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
    if (tournagesJson && !tournagesJson.includes('"a_finir":true')) return;
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
    const corps = m === "POST" ? await lireCorps(req) : {};

    if (m === "GET" && p[0] === "etat" && p.length === 1) {
      rafraichir();
      majARanger({ frais: true });
      return envoyerJson(res, 200, {
        cartes: [...cartes.values()],
        a_ranger: JSON.parse(aRangerJson),
        file: file.liste(),
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
      if (m === "GET" && p.length === 2) {
        const d = detail(config, slug, etatLocal());
        if (!d) throw new ErreurStudio("INTROUVABLE", "Je ne trouve pas ce contenu.", 404);
        return envoyerJson(res, 200, d);
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
      if (m === "POST" && p[2] === "abandonner") {
        const raison = texteCourt(corps.raison);
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
          const s = lireSuivi(config, id);
          s.valide_le ||= isoZurich();
          // Ce qui n'a pas pu être rangé reste visible : fichiers laissés où ils étaient (encore en réception,
          // illisibles) et prises attendues qui ne sont ni rangées ni dans « À ranger ».
          s.rangement = { fini_le: isoZurich(), places: lu?.fin?.places ?? lu?.places?.length ?? 0, a_ranger: lu?.fin?.a_ranger ?? lu?.a_ranger?.length ?? 0,
            en_attente: lu?.ignores?.length ?? 0, reste: resteARanger(config, plan, s) };
          ecrireSuivi(config, id, s);
          rafraichir();
          majARanger({ frais: true });
          diffuser("tournages", { tournages: listeTournages(config) });
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
        const raison = texteCourt(corps.raison);
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

    if (p[0] === "chats" && p.length >= 2) {
      const chatId = decodeURIComponent(p[1]);
      const t = exigerChat(chatId);
      if (m === "GET" && p.length === 2) {
        return envoyerJson(res, 200, { messages: pont.historique(chatId), etat: pont.etat(chatId) });
      }
      if (m === "POST" && p[2] === "messages") {
        const texte = typeof corps.texte === "string" ? corps.texte.trim().slice(0, 20000) : "";
        if (!texte) throw new ErreurStudio("VIDE", "Écris ton message avant de l'envoyer.", 400);
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
        pont.arreter(chatId);
        return envoyerJson(res, 200, {});
      }
    }

    if (m === "POST" && p[0] === "rangement") {
      if (p[1] === "placer") {
        const fichier = String(corps.fichier || "");
        // Un fichier de _a-ranger/, ou un clip de la bibliothèque (clip_id) à lier à une autre carte.
        const estClip = /^\d{8}-\d{6}-[a-z0-9]{4}$/.test(fichier);
        if (!fichier || fichier.includes("/") || fichier.startsWith(".")
          || (!estClip && !existe(path.join(config.media, "_a-ranger", fichier)))) {
          throw new ErreurStudio("INTROUVABLE", "Je ne trouve plus ce fichier.", 404);
        }
        const slug = exigerSlug(corps.slug);
        if (!["face", "b-roll", "photo"].includes(corps.type)) throw new ErreurStudio("TYPE", MESSAGE_GENERIQUE, 400);
        await file.suivre("rangement", { slug }, () => placerManuel(config, { fichier, slug, type: corps.type }));
        await copierBibliotheque().catch(() => {});
        rafraichir();
        return envoyerJson(res, 200, {});
      }
      if (p[1] === "relancer") {
        rangerMaintenant().catch(() => {});
        return envoyerJson(res, 200, {});
      }
    }

    // Ressources gratuites (studio de Yoan) : 404 pour un client sans site de ressources. Lecture seule :
    // la mise en ligne est faite par le head of content dès qu'une ressource est prête (18/11/2026).
    if (p[0] === "ressources") {
      ressources.exiger();
      if (m === "GET" && p.length === 1) return envoyerJson(res, 200, await ressources.lister());
    }

    if (m === "POST" && p[0] === "publication") {
      if (p[1] === "recap") return envoyerJson(res, 200, await publication.recap(corps.elements));
      if (p[1] === "poser-mot") {
        const r = await publication.poserMot(corps.slug, corps.ressource);
        rafraichir();
        return envoyerJson(res, 200, r);
      }
      if (p[1] === "confirmer") {
        const r = await publication.confirmer(String(corps.recap_id || ""));
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
      res.write(`event: file\ndata: ${adresser(JSON.stringify({ actions: file.liste() }))}\n\n`);
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
