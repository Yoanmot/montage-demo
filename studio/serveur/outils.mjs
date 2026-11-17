// Petits outils partagés par le serveur du studio : chemins, JSON atomique, dates de Zurich,
// empreintes, journal. Aucune dépendance.
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,58})[a-z0-9]$/;
export const EXT_VIDEO = new Set([".mov", ".mp4", ".m4v", ".hevc", ".avi", ".mkv"]);
export const EXT_IMAGE = new Set([".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp", ".gif"]);

export function etendre(p, home = os.homedir()) {
  if (!p) return p;
  if (p === "~") return home;
  if (p.startsWith("~/")) return path.join(home, p.slice(2));
  return path.resolve(p);
}

export function lireJson(chemin, defaut = null) {
  try {
    return JSON.parse(fs.readFileSync(chemin, "utf8"));
  } catch {
    return defaut;
  }
}

export function lireTexte(chemin, defaut = null) {
  try {
    return fs.readFileSync(chemin, "utf8");
  } catch {
    return defaut;
  }
}

// Écriture atomique (contrat : fichier temporaire dans le même dossier puis rename).
export function ecrireJson(chemin, donnees, mode) {
  fs.mkdirSync(path.dirname(chemin), { recursive: true });
  const tmp = `${chemin}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(donnees, null, 2) + "\n", mode ? { mode } : undefined);
  fs.renameSync(tmp, chemin);
}

export function ecrireTexte(chemin, texte, mode) {
  fs.mkdirSync(path.dirname(chemin), { recursive: true });
  const tmp = `${chemin}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  fs.writeFileSync(tmp, texte, mode ? { mode } : undefined);
  if (mode) fs.chmodSync(tmp, mode);
  fs.renameSync(tmp, chemin);
}

export function empreinteTexte(texte) {
  return "sha256:" + crypto.createHash("sha256").update(texte).digest("hex");
}

export function empreinteFichier(chemin) {
  try {
    return "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(chemin)).digest("hex");
  } catch {
    return null;
  }
}

export function existe(chemin) {
  try {
    fs.accessSync(chemin);
    return true;
  } catch {
    return false;
  }
}

export function stat(chemin) {
  try {
    return fs.statSync(chemin);
  } catch {
    return null;
  }
}

export function lister(dossier) {
  try {
    return fs.readdirSync(dossier, { withFileTypes: true });
  } catch {
    return [];
  }
}

// Vrai si `enfant` est `parent` ou dedans (chemins déjà résolus).
export function dedans(parent, enfant) {
  const rel = path.relative(parent, enfant);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

// ---------------------------------------------------------------- dates (Europe/Zurich)

const FMT_ZURICH = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Zurich",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
  hourCycle: "h23", timeZoneName: "longOffset",
});

function parties(date) {
  const p = {};
  for (const { type, value } of FMT_ZURICH.formatToParts(date)) p[type] = value;
  const decal = (p.timeZoneName || "GMT").replace("GMT", "") || "+00:00";
  return { ...p, decal };
}

export function isoZurich(date = new Date()) {
  const p = parties(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${p.decal}`;
}

export function jourZurich(date = new Date()) {
  const p = parties(date);
  return `${p.year}-${p.month}-${p.day}`;
}

// "AAAA-MM-JJ HH:MM" (heure de Zurich) -> Date. null si illisible.
export function dateDepuisZurich(texte) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(texte || "").trim());
  if (!m) return null;
  const [, a, mo, j, h, mi] = m.map(Number);
  // On devine le décalage puis on corrige (deux passes suffisent autour des changements d'heure).
  let t = Date.UTC(a, mo - 1, j, h, mi);
  for (let i = 0; i < 2; i++) {
    const d = parties(new Date(t)).decal;
    const s = d.startsWith("-") ? -1 : 1;
    const [dh, dm] = d.slice(1).split(":").map(Number);
    t = Date.UTC(a, mo - 1, j, h, mi) - s * (dh * 60 + dm) * 60000;
  }
  return new Date(t);
}

// Date lisible d'un texte de date quelconque du registre (ISO ou "AAAA-MM-JJ HH:MM").
export function lireDate(texte) {
  if (!texte) return null;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}$/.test(String(texte).trim())) return dateDepuisZurich(texte);
  const d = new Date(texte);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function lundiDe(jour) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(jour || "");
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const decalage = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - decalage);
  return d.toISOString().slice(0, 10);
}

export function ajouterJours(jour, n) {
  const d = new Date(jour + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
export function nomDuJour(jour) {
  return JOURS[new Date(jour + "T12:00:00Z").getUTCDay()];
}
export const JOURS_SEMAINE = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

// ---------------------------------------------------------------- identifiants

export function horodatage(date = new Date()) {
  const p = parties(date);
  return `${p.year}${p.month}${p.day}-${p.hour}${p.minute}${p.second}`;
}

let compteurId = 0;
export function nouvelId(prefixe) {
  compteurId += 1;
  return `${prefixe}-${horodatage()}-${compteurId}`;
}

// ---------------------------------------------------------------- journal

export function creerJournal(fichier) {
  return (evenement, details = {}) => {
    const ligne = JSON.stringify({ le: isoZurich(), evenement, ...details });
    try {
      fs.mkdirSync(path.dirname(fichier), { recursive: true });
      fs.appendFileSync(fichier, ligne + "\n");
    } catch {
      /* le journal ne doit jamais faire tomber le serveur */
    }
  };
}

export async function attendre(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export { fsp };
