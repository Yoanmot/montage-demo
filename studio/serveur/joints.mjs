// Fichiers joints dans un chat (22/11/2026, demande de Yoan) : le client joint un fichier de son Mac (un logo, une
// image, un document) à son message ; le studio le range dans le dépôt du head of content et donne son chemin à
// l'agent, qui le regarde (outil Read) et s'en sert là où on le lui demande.
//
// Rangement : dans le chat d'un contenu (head of content ou monteur), DEPOT/contenus/<slug>/fichiers-joints/, où « Autres
// fichiers » de ce contenu le montre (groupe « Fichiers joints ») ; dans le chat général ou un chat de tournage, DEPOT/fichiers-joints/.
// Le fichier est enregistré dans git par le studio (comme la bibliothèque) : le head of content du téléphone le voit.
// Vidéos refusées (lourdes pour git, et elles ont leur chemin : la Galerie, « Ajouter une vidéo ») ; 20 Mo au plus.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { VIDEOS } from "../rangement/lib/commun.mjs";

export const JOINT_MAX = 20 * 1024 ** 2;          // 20 Mo par fichier
export const JOINTS_PAR_MESSAGE = 10;
export const DOSSIER_COMMUN = "fichiers-joints";
const IMAGES = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".heic", ".heif"]);
const HEIC = new Set([".heic", ".heif"]);
// Formats de vidéo en plus de ceux du rangement : aucun ne passe par le chat.
const VIDEOS_EN_PLUS = new Set([".avi", ".mkv", ".webm", ".mts", ".m2ts", ".3gp", ".mpg", ".mpeg", ".wmv", ".flv", ".prores"]);
// Un fichier de clés, ou un fichier encore en cours de téléchargement : jamais rangé.
const REFUSES = new Set([".env", ".download", ".crdownload", ".part", ".partial", ".tmp"]);

// Dans le chat d'un contenu, la vidéo a aussi sa place dans Montage (« Ajouter une vidéo »).
export const messageVideo = (contenu) => `Une vidéo ne passe pas par le chat : ajoute-la dans ta Galerie${contenu ? ", ou dans Montage pour ce contenu" : ""}, puis dis-moi ici ce que tu veux en faire.`;

// Nom propre, comme pour « Ajouter une vidéo » (nomEnvoi de serveur.mjs) : sans dossier, sans caractère de contrôle ni
// « : », sans point au début, 100 caractères au plus ; extension en minuscules, lettres et chiffres seulement.
export function nomJoint(brut) {
  let n = String(brut || "").normalize("NFC").split(/[\\/]/).pop() || "";
  n = n.replace(/[\u0000-\u001f\u007f:]/g, "").replace(/^[.\s]+/, "").trim();
  const extBrute = path.extname(n);
  const ext = extBrute.toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 11);
  const base = path.basename(n, extBrute).replace(/[^\p{L}\p{N} ._()'-]/gu, "_").replace(/[.\s]+$/, "").slice(0, 100).trim();
  return `${base || "fichier"}${ext.length > 1 ? ext : ""}`;
}

export function genreJoint(nom) {
  const ext = path.extname(nom).toLowerCase();
  if (VIDEOS.has(ext) || VIDEOS_EN_PLUS.has(ext)) return "video";
  return IMAGES.has(ext) ? "image" : "autre";
}

// null si le fichier peut être joint, sinon { statut, code, message } (message pour le client).
export function refusJoint(nom, taille, { contenu = false } = {}) {
  const ext = path.extname(nom).toLowerCase();
  if (genreJoint(nom) === "video") return { statut: 415, code: "VIDEO", message: messageVideo(contenu) };
  if (REFUSES.has(ext)) return { statut: 415, code: "FORMAT", message: "Je ne peux pas joindre ce fichier." };
  if (!Number.isSafeInteger(taille) || taille <= 0) return { statut: 411, code: "TAILLE", message: "Ce fichier est vide." };
  if (taille > JOINT_MAX) return { statut: 413, code: "TROP_GROS", message: "Ce fichier est trop lourd pour le chat : 20 Mo au plus." };
  return null;
}

// Le dossier des fichiers joints d'un chat, relatif au dépôt (t : typeDeChat).
export function dossierJoints(t) {
  return t?.slug ? `contenus/${t.slug}/${DOSSIER_COMMUN}` : DOSSIER_COMMUN;
}

// Un nom libre dans ce dossier : « logo.png », puis « logo 2.png », « logo 3.png »... (APFS ignore la casse : la
// vérification d'existence aussi).
function nomLibre(dossier, nom) {
  const ext = path.extname(nom);
  const base = path.basename(nom, ext);
  for (let i = 1; i < 1000; i++) {
    const n = i === 1 ? nom : `${base} ${i}${ext}`;
    if (!fs.existsSync(path.join(dossier, n))) return n;
  }
  return `${base} ${Date.now()}${ext}`;
}

// Range le fichier reçu (source) dans le dépôt. Une photo HEIC d'iPhone devient un JPEG (l'agent ne lit pas le HEIC,
// le navigateur ne l'affiche pas) ; si la conversion rate, le HEIC est gardé tel quel. Rend { fichier, relatif }.
export function placerJoint(depot, relDossier, source, nom) {
  const dossier = path.join(depot, relDossier);
  fs.mkdirSync(dossier, { recursive: true });
  const ext = path.extname(nom).toLowerCase();
  if (HEIC.has(ext) && process.platform === "darwin") {
    const voulu = nomLibre(dossier, `${path.basename(nom, path.extname(nom))}.jpg`);
    const tmp = path.join(path.dirname(source), `.conversion-${process.pid}.jpg`);
    const r = spawnSync("/usr/bin/sips", ["-s", "format", "jpeg", source, "--out", tmp], { encoding: "utf8", timeout: 60000 });
    if (r.status === 0 && fs.existsSync(tmp)) {
      fs.copyFileSync(tmp, path.join(dossier, voulu), fs.constants.COPYFILE_EXCL);
      fs.rmSync(tmp, { force: true });
      return { fichier: voulu, relatif: `${relDossier}/${voulu}` };
    }
    fs.rmSync(tmp, { force: true });
  }
  // Écriture exclusive : deux envois du même nom au même instant ne s'écrasent jamais.
  for (let essai = 0; essai < 5; essai++) {
    const n = nomLibre(dossier, nom);
    try {
      fs.copyFileSync(source, path.join(dossier, n), fs.constants.COPYFILE_EXCL);
      return { fichier: n, relatif: `${relDossier}/${n}` };
    } catch (e) {
      if (e?.code !== "EEXIST") throw e;
    }
  }
  throw new Error("nom de fichier joint introuvable");
}

// La ligne ajoutée au message envoyé à l'agent (jamais montrée au client) : le chemin absolu de chaque fichier.
export function ligneJoints(prenom, depot, places) {
  if (!places.length) return "";
  const lignes = places.map((p) => `- ${path.join(depot, p.relatif)}${p.genre === "image" ? " (image : lis ce chemin pour la regarder)" : ""}`);
  return `Fichiers joints par ${prenom}, déjà rangés et enregistrés dans son dépôt (ne les déplace pas) :\n${lignes.join("\n")}`;
}
