// Les images des cartes (lot 10) : la vignette du hook d'un reel monté (une image tirée de sa vidéo montée) et le petit
// aperçu d'une page de ressource gratuite (capture de la page par Chrome sans fenêtre). Fabriquées à la demande, une
// seule fois par version (le nom du fichier porte l'empreinte de la source), gardées dans STUDIO_HOME, jamais dans git
// ni dans le dossier média. Écrites à côté puis renommées : une image n'est jamais lue pendant son écriture.
// Aucun processus ne survit à sa fabrication : chaque outil est lancé dans son groupe, attendu par son PID, tué au délai.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { existe } from "./outils.mjs";
import { outil } from "../rangement/lib/commun.mjs";

const MONTE = /-monte(-\d+)?\.mp4$/i;
export const INSTANT_HOOK = 1.0; // s : la première image peut être noire ou en fondu ; à 1 s le titre du hook est posé
const enCours = new Map(); // fichier de sortie -> promesse (deux demandes de la même image n'en fabriquent qu'une)

// La vidéo montée la plus récente d'un contenu (même règle que la publication et la lecture).
export function videoMonteeDe(config, slug) {
  const dossier = path.join(config.media, slug, "face");
  let noms;
  try { noms = fs.readdirSync(dossier, { withFileTypes: true }); } catch { return null; }
  let r = null;
  for (const e of noms) {
    if (!e.isFile() || !MONTE.test(e.name)) continue;
    const st = fs.statSync(path.join(dossier, e.name));
    if (!r || st.mtimeMs > r.mtimeMs) r = { chemin: path.join(dossier, e.name), nom: e.name, taille: st.size, mtimeMs: st.mtimeMs };
  }
  return r;
}

// La version d'une vidéo (nom, taille, date) : l'adresse de la vignette change quand la vidéo est refaite.
export const versionVideo = (v) => crypto.createHash("sha1").update(`${v.nom}|${v.taille}|${Math.round(v.mtimeMs)}`).digest("hex").slice(0, 12);

function lancerOutil(cmd, args, { delaiMs = 30000, cwd } = {}) {
  return new Promise((ok) => {
    let p;
    try { p = spawn(cmd, args, { cwd, detached: true, stdio: ["ignore", "ignore", "pipe"] }); } catch (e) { ok({ code: -1, erreur: String(e.message) }); return; }
    let err = "";
    p.stderr.on("data", (d) => { if (err.length < 4000) err += d; });
    const minuteur = setTimeout(() => { try { process.kill(-p.pid, "SIGKILL"); } catch { /* déjà fini */ } }, delaiMs);
    p.on("error", (e) => { clearTimeout(minuteur); ok({ code: -1, erreur: String(e.message) }); });
    p.on("close", (code) => { clearTimeout(minuteur); ok({ code, erreur: err }); });
  });
}

function unSeul(sortie, fabriquer) {
  if (existe(sortie)) return Promise.resolve(sortie);
  if (enCours.has(sortie)) return enCours.get(sortie);
  const p = (async () => {
    try { return await fabriquer(); } finally { enCours.delete(sortie); }
  })();
  enCours.set(sortie, p);
  return p;
}

// Retire les anciennes versions d'une même image (même préfixe, autre empreinte).
function nettoyer(dossier, prefixe, garder) {
  try {
    for (const n of fs.readdirSync(dossier)) if (n.startsWith(prefixe) && n !== garder) fs.rmSync(path.join(dossier, n), { force: true });
  } catch { /* rien */ }
}

// La vignette du hook : une image JPEG de 360 px de large, à INSTANT_HOOK (ou la première, pour une vidéo plus courte).
// Rend le chemin de l'image, ou null (pas de vidéo montée, ffmpeg absent ou en échec).
export async function vignetteReel(config, slug, { ffmpeg = null } = {}) {
  const v = videoMonteeDe(config, slug);
  if (!v) return null;
  const dossier = path.join(config.home, "vignettes");
  const nom = `${slug}--${versionVideo(v)}.jpg`;
  const sortie = path.join(dossier, nom);
  return unSeul(sortie, async () => {
    let bin = ffmpeg;
    try { bin ||= outil("ffmpeg"); } catch { return null; }
    fs.mkdirSync(dossier, { recursive: true });
    const tmp = path.join(dossier, `.${nom}.${process.pid}.${crypto.randomBytes(3).toString("hex")}.jpg`);
    for (const t of [INSTANT_HOOK, 0]) {
      const r = await lancerOutil(bin, ["-nostdin", "-v", "error", "-y", "-ss", String(t), "-i", v.chemin, "-frames:v", "1", "-vf", "scale=360:-2", "-q:v", "4", tmp], { delaiMs: 20000 });
      if (r.code === 0 && existe(tmp) && fs.statSync(tmp).size > 0) {
        fs.renameSync(tmp, sortie);
        nettoyer(dossier, `${slug}--`, nom);
        return sortie;
      }
      fs.rmSync(tmp, { force: true });
    }
    return null;
  });
}

// ---------------------------------------------------------------- aperçu d'une page de ressource

// Le fichier de la page (en ligne, sinon brouillon) et sa version (contenu de la page et de sa feuille de style).
export function pageRessource(config, slug) {
  const site = path.join(config.depot, "site");
  for (const rel of [[slug, "index.html"], ["_brouillons", slug, "index.html"]]) {
    const f = path.join(site, ...rel);
    if (!existe(f)) continue;
    const h = crypto.createHash("sha1");
    h.update(fs.readFileSync(f));
    for (const a of ["ressource.css", "ressource.js"]) { const x = path.join(site, "assets", a); if (existe(x)) h.update(fs.readFileSync(x)); }
    return { site, fichier: f, adresse: "/" + rel.slice(0, -1).join("/") + "/", version: h.digest("hex").slice(0, 12) };
  }
  return null;
}

export function cheminChrome() {
  for (const p of [process.env.STUDIO_CHROME, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium"]) {
    if (p && existe(p)) return p;
  }
  return null;
}

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".svg": "image/svg+xml",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf" };

// Un petit serveur du dossier site/ (les pages lisent /assets/... à la racine), sur 127.0.0.1 seulement, le temps
// d'une capture : il est fermé juste après, quoi qu'il arrive.
function servirSite(site) {
  const racine = fs.realpathSync(site);
  const serveur = http.createServer((req, res) => {
    let rel;
    try { rel = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { res.writeHead(400); res.end(); return; }
    let f = path.join(racine, rel);
    if (rel.endsWith("/")) f = path.join(f, "index.html");
    if (!f.startsWith(racine + path.sep) || !existe(f) || !fs.statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(f).toLowerCase()] || "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((ok, ko) => {
    serveur.once("error", ko);
    serveur.listen(0, "127.0.0.1", () => ok(serveur));
  });
}

// L'aperçu : le haut de la page à 500 px de large (Chrome sans fenêtre ne descend pas plus bas : en dessous, la page
// est mise en page à 500 px et l'image rognée), en PNG. Animations coupées (sinon la page peut rester vide sous
// Chrome sans fenêtre). Pas de --virtual-time-budget : il peut ne jamais rendre la main. Rend le chemin de l'image, ou null (pas de page, pas de
// Chrome, capture en échec) : l'interface montre alors une vignette au titre.
export async function apercuRessource(config, slug, { chrome = undefined } = {}) {
  const page = pageRessource(config, slug);
  if (!page) return null;
  const dossier = path.join(config.home, "apercus-ressources");
  const nom = `${slug}--${page.version}.png`;
  const sortie = path.join(dossier, nom);
  return unSeul(sortie, async () => {
    const bin = chrome === undefined ? cheminChrome() : chrome;
    if (!bin) return null;
    fs.mkdirSync(dossier, { recursive: true });
    const profil = fs.mkdtempSync(path.join(dossier, ".profil-"));
    const tmp = path.join(dossier, `.${nom}.${process.pid}.png`);
    let serveur = null;
    try {
      serveur = await servirSite(page.site);
      const url = `http://127.0.0.1:${serveur.address().port}${page.adresse}`;
      const r = await lancerOutil(bin, ["--headless=new", `--user-data-dir=${profil}`, "--no-first-run", "--no-default-browser-check",
        // Jamais le trousseau du Mac (sans ça, Chrome attend le trousseau et ne rend jamais la main hors de la session).
        "--use-mock-keychain", "--password-store=basic",
        "--disable-extensions", "--hide-scrollbars", "--force-prefers-reduced-motion", "--force-color-profile=srgb", "--mute-audio",
        "--window-size=500,880", `--screenshot=${tmp}`, url], { delaiMs: 30000 });
      if (r.code === 0 && existe(tmp) && fs.statSync(tmp).size > 0) {
        fs.renameSync(tmp, sortie);
        nettoyer(dossier, `${slug}--`, nom);
        return sortie;
      }
      return null;
    } catch {
      return null;
    } finally {
      if (serveur) await new Promise((ok) => { serveur.closeAllConnections?.(); serveur.close(() => ok()); });
      fs.rmSync(tmp, { force: true });
      fs.rmSync(profil, { recursive: true, force: true });
    }
  });
}
