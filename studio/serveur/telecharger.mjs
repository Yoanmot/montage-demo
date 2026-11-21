// « Télécharger la vidéo » (19/11) : la vidéo montée la plus récente est copiée dans Téléchargements, pour la
// poster soi-même (AirDrop vers l'iPhone, appli Instagram). La copie porte la marque « téléchargé » de macOS
// (kMDItemWhereFroms) : le rangement ignore ces fichiers, elle ne revient donc jamais dans « À ranger » même
// quand Téléchargements est le dossier des arrivées. Puis le Finder la montre, sélectionnée.
// Les slides d'un carrousel (21/11) passent par le même chemin : une slide seule, ou toutes dans un zip.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { estMonte } from "./stades.mjs";
import { executer } from "./commandes.mjs";
import { slidesDe } from "../publication/carrousels.mjs";

// plistlib.dumps(["Studio"], fmt=FMT_BINARY) : la provenance, comme un navigateur l'écrit.
const PROVENANCE = "62706c6973743030a1015653747564696f080a0000000000000101000000000000000200000000000000000000000000000011";

export function videoMontee(config, slug) {
  const dir = path.join(config.media, slug, "face");
  let noms = [];
  try { noms = fs.readdirSync(dir).filter(estMonte); } catch { return null; }
  const avec = noms.map((n) => ({ n, t: fs.statSync(path.join(dir, n)).mtimeMs })).sort((a, b) => b.t - a.t);
  return avec.length ? path.join(dir, avec[0].n) : null;
}

function nomLibre(dossier, base, ext = ".mp4") {
  let nom = `${base}${ext}`;
  for (let i = 2; fs.existsSync(path.join(dossier, nom)); i += 1) nom = `${base}-${i}${ext}`;
  return nom;
}

// Dépose un fichier dans Téléchargements : écrit sous un nom caché, marqué « téléchargé », puis renommé ; le Finder
// le montre. ecrire(partiel) fabrique le fichier (copie ou zip).
async function deposer(config, base, ext, ecrire, { montrer = true } = {}) {
  const dossier = path.join(config.maison || os.homedir(), "Downloads");
  fs.mkdirSync(dossier, { recursive: true });
  const nom = nomLibre(dossier, base, ext);
  const cible = path.join(dossier, nom);
  const partiel = path.join(dossier, `.${nom}.partiel`);
  try { await ecrire(partiel); } catch (e) { fs.rmSync(partiel, { force: true }); throw e; }
  // Marque posée avant que le fichier porte son vrai nom : le rangement ne le voit jamais sans elle.
  const x = await executer("xattr", ["-wx", "com.apple.metadata:kMDItemWhereFroms", PROVENANCE, partiel], { delaiMs: 15000 });
  if (x.code !== 0) { fs.rmSync(partiel, { force: true }); throw new Error("provenance impossible à poser"); }
  fs.renameSync(partiel, cible);
  if (montrer) await executer("open", ["-R", cible], { delaiMs: 15000 });
  return { nom, chemin: cible };
}

export async function telechargerVideo(config, slug, { montrer = true } = {}) {
  const source = videoMontee(config, slug);
  if (!source) return null;
  return deposer(config, slug, ".mp4", (partiel) => fs.promises.copyFile(source, partiel, fs.constants.COPYFILE_FICLONE), { montrer });
}

// Le nom d'un fichier tiré du titre du contenu : lisible dans le Finder (accents gardés), sans ce que macOS refuse
// ou cache (« / », « : », point en tête), court. Sans titre utilisable : le nom du contenu.
export function nomDepuisTitre(titre, secours) {
  const t = String(titre || "").normalize("NFC").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ").trim().replace(/^\.+/, "").slice(0, 80).trim();
  return t || secours;
}

// Les slides d'un carrousel dans l'ordre d'envoi (numérique : slide-2 avant slide-10), vues par le lien du dossier média.
export function slidesDuCarrousel(config, slug) {
  return slidesDe(slug, { media: config.media }).map((n) => path.join(config.media, slug, "slides", n));
}

// « Télécharger cette slide » (n, à partir de 1) ou « Tout télécharger » (n absent : un zip, slides 01, 02...).
// Rend null si le carrousel n'a pas de slides, ou si la slide demandée n'existe pas.
export async function telechargerSlides(config, slug, { n = null, titre = null, montrer = true } = {}) {
  const slides = slidesDuCarrousel(config, slug);
  if (!slides.length) return null;
  const base = nomDepuisTitre(titre, slug);
  const chiffres = Math.max(2, String(slides.length).length);
  const numero = (i) => String(i + 1).padStart(chiffres, "0");
  if (n !== null) {
    const source = slides[n - 1];
    if (!source) return null;
    return deposer(config, `${base} ${numero(n - 1)}`, path.extname(source).toLowerCase(),
      (partiel) => fs.promises.copyFile(source, partiel, fs.constants.COPYFILE_FICLONE), { montrer });
  }
  const entrees = slides.map((f, i) => ({ nom: `${numero(i)}${path.extname(f).toLowerCase()}`, chemin: f }));
  return deposer(config, base, ".zip", (partiel) => ecrireZip(partiel, entrees), { montrer });
}

// Un zip sans compression (des PNG et JPEG le sont déjà) : en-tête local, données, répertoire central. Noms en UTF-8.
export async function ecrireZip(cible, entrees) {
  const date = dateDos(new Date());
  const central = [];
  const fd = await fs.promises.open(cible, "w");
  let pos = 0;
  try {
    for (const e of entrees) {
      const donnees = await fs.promises.readFile(e.chemin);
      const nom = Buffer.from(e.nom, "utf8");
      const crc = zlib.crc32(donnees) >>> 0;
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(0, 8);
      local.writeUInt16LE(date.heure, 10); local.writeUInt16LE(date.jour, 12); local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(donnees.length, 18); local.writeUInt32LE(donnees.length, 22); local.writeUInt16LE(nom.length, 26); local.writeUInt16LE(0, 28);
      await fd.write(Buffer.concat([local, nom, donnees]));
      const c = Buffer.alloc(46);
      c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(0, 10);
      c.writeUInt16LE(date.heure, 12); c.writeUInt16LE(date.jour, 14); c.writeUInt32LE(crc, 16);
      c.writeUInt32LE(donnees.length, 20); c.writeUInt32LE(donnees.length, 24); c.writeUInt16LE(nom.length, 28);
      c.writeUInt32LE(pos, 42);
      central.push(Buffer.concat([c, nom]));
      pos += 30 + nom.length + donnees.length;
      if (pos > 0xffffffff) throw new Error("zip trop gros");
    }
    const rep = Buffer.concat(central);
    const fin = Buffer.alloc(22);
    fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(entrees.length, 8); fin.writeUInt16LE(entrees.length, 10);
    fin.writeUInt32LE(rep.length, 12); fin.writeUInt32LE(pos, 16);
    await fd.write(Buffer.concat([rep, fin]));
  } finally {
    await fd.close();
  }
}

function dateDos(d) {
  return { heure: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    jour: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() };
}
