// Alertes du studio (lot 12) : ce qui va coincer bientôt, dit avant que ça coince, avec quoi faire.
//   disque     : la place libre du disque des vidéos (un reel prend environ 2 Go pendant son montage) ;
//   connexion  : le jeton d'un an qui connecte le studio au compte Claude. Sa date est notée par l'installation
//                (volet C du lot 12) dans <racine>/connexion-claude.json (pose_le, expire_le, aucune valeur de
//                jeton) ; fichier absent : rien n'est dit. claude.env (la clé) n'est jamais lu.
//   arrivees   : le dossier où arrivent les vidéos (Téléchargements) est illisible pour le studio (autorisation de
//                macOS), vérifié une fois par jour par le garde de l'installation : <home>/acces-arrivees.json.
import fs from "node:fs";
import path from "node:path";
import { contact } from "./client.mjs";
import { lireJson } from "./outils.mjs";

const GO = 1024 ** 3;
export const SEUIL_BAS = 20 * GO;      // environ dix reels de marge
export const SEUIL_CRITIQUE = 5 * GO;  // le prochain montage peut échouer
export const DUREE_JETON_MS = 365 * 86400e3;
export const AVANCE_JETON_MS = 30 * 86400e3;

export function placeLibre(dossier) {
  try {
    const s = fs.statfsSync(dossier);
    return Number(s.bavail) * Number(s.bsize);
  } catch {
    return Infinity;
  }
}

const go = (o) => `${Math.max(0, Math.floor(o / GO))} Go`;

// config.media : le dossier des vidéos ; config.disque : le disque externe réglé (ou null).
export function alerteDisque(config, { libre = placeLibre(config.media) } = {}) {
  if (!Number.isFinite(libre) || libre >= SEUIL_BAS) return null;
  const critique = libre < SEUIL_CRITIQUE;
  const debut = critique
    ? `Ton Mac est presque plein : il ne reste que ${go(libre)}. Le prochain montage ou le prochain envoi de vidéo risque d'échouer.`
    : `Ton Mac n'a plus que ${go(libre)} de libre. Une vidéo en prend environ 2 Go pendant son montage.`;
  const quoi = config.disque
    ? " Branche ton disque externe et clique « Faire de la place » : les vidéos de tournage des contenus déjà publiés y partent (la vidéo montée reste sur ton Mac). Tu peux aussi vider la corbeille."
    : " Vide la corbeille, et range tes anciennes vidéos sur un disque externe ou supprime celles dont tu n'as plus besoin.";
  return { id: "disque", genre: critique ? "critique" : "attention", texte: debut + quoi, action: config.disque ? "archiver" : null };
}

function dateLongue(ms) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Zurich", day: "numeric", month: "long", year: "numeric" }).format(new Date(ms));
}

// client.racineAbs : la racine d'installation du client (où l'installation pose claude.env).
export function alerteConnexion(client, { maintenant = Date.now(), racine = process.env.STUDIO_RACINE || client?.racineAbs } = {}) {
  if (!racine) return null;
  const note = lireJson(path.join(racine, "connexion-claude.json"), null);
  const fin = Date.parse(note?.expire_le || "") || (Date.parse(note?.pose_le || "") + DUREE_JETON_MS);
  if (!Number.isFinite(fin)) return null;
  if (maintenant < fin - AVANCE_JETON_MS) return null;
  if (maintenant >= fin) {
    return { id: "connexion", genre: "critique", expire_le: new Date(fin).toISOString(),
      texte: `La connexion de ton studio à ton compte Claude a sans doute expiré le ${dateLongue(fin)}. Préviens ${contact()} : la reconnexion prend deux minutes.` };
  }
  return { id: "connexion", genre: "attention", expire_le: new Date(fin).toISOString(),
    texte: `La connexion de ton studio à ton compte Claude arrive à son terme le ${dateLongue(fin)}. Préviens ${contact()} avant cette date : il la renouvelle en deux minutes.` };
}

// home : le dossier du studio (config.home), où le garde note s'il peut lire le dossier d'arrivée.
export function alerteArrivees(home) {
  const a = home ? lireJson(path.join(home, "acces-arrivees.json"), null) : null;
  if (!a || a.ok !== false) return null;
  return { id: "arrivees", genre: "attention",
    texte: `Ton studio n'a pas le droit d'ouvrir ton dossier Téléchargements : les vidéos que tu envoies par AirDrop ne peuvent pas être rangées toutes seules. Tu peux toujours les ajouter avec « Ajouter une vidéo ». Préviens ${contact()} : une autorisation est à donner dans les réglages de ton Mac.` };
}

export function alertes(config, client, options = {}) {
  return [alerteDisque(config, options), alerteConnexion(client, options), alerteArrivees(config.home)].filter(Boolean);
}
