// Le client du studio (CONTRAT-STUDIO.md, section 7) : studio/clients/<id>.json, choisi par la variable
// STUDIO_CLIENT (défaut « romain » : chez Romain, rien ne change). Identité, racine d'installation, port,
// thème, compte Instagram, dossier de configuration Claude. Aucune clé dans ces fichiers.
// Sans dépendance : le serveur, le rangement et la publication le lisent.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DOSSIER_CLIENTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "clients");
export const CLIENT_PAR_DEFAUT = "romain";
const ID_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;

function deplier(p, maison) {
  if (!p) return p;
  if (p === "~") return maison;
  if (p.startsWith("~/")) return path.join(maison, p.slice(2));
  return path.resolve(p);
}

export function idClient(env = process.env) {
  const id = String(env.STUDIO_CLIENT || CLIENT_PAR_DEFAUT).trim();
  if (!ID_RE.test(id)) throw new Error(`STUDIO_CLIENT invalide : ${id}`);
  return id;
}

// Rend le client tel qu'écrit dans son fichier, plus les chemins développés :
//   racineAbs, configClaudeAbs (null = ~/.claude, comportement de Romain), dossierClaude (toujours un chemin).
export function chargerClient({ env = process.env, id = idClient(env), maison = env.HOME || os.homedir() } = {}) {
  const fichier = path.join(DOSSIER_CLIENTS, `${id}.json`);
  let brut;
  try {
    brut = JSON.parse(fs.readFileSync(fichier, "utf8"));
  } catch (e) {
    throw new Error(`client inconnu ou illisible : ${id} (${e.code || e.message})`);
  }
  if (brut.id !== id) throw new Error(`le fichier du client ${id} annonce un autre id : ${brut.id}`);
  const racineAbs = deplier(brut.racine, maison);
  const configClaudeAbs = brut.config_claude ? deplier(brut.config_claude, maison) : null;
  return {
    ...brut,
    fichier,
    racineAbs,
    configClaudeAbs,
    dossierClaude: configClaudeAbs || path.join(maison, ".claude"),
  };
}

// Le client du processus (lu une fois) : textes fixes des modules (« préviens <contact> », consigne).
let actif = null;
export function clientActif() {
  if (!actif) actif = chargerClient();
  return actif;
}

// Variables d'environnement qui autorisent l'écriture chez Zernio (publication) : jamais dans une
// session ni dans un autre appel que la confirmation. ZERNIO_ECRITURE=<compte> est le garde-fou
// générique ; ZERNIO_ECRITURE_ROMAIN=oui reste posé pour Romain (son zernio.py le demande encore).
export const VARIABLES_ECRITURE = ["ZERNIO_ECRITURE", "ZERNIO_ECRITURE_ROMAIN"];

export function variablesEcriture(client) {
  const v = {};
  if (client?.zernio?.compte) v.ZERNIO_ECRITURE = client.zernio.compte;
  if (client?.id === "romain") v.ZERNIO_ECRITURE_ROMAIN = "oui";
  return v;
}

// Qui prévenir quand quelque chose coince (« préviens <contact> ») : Yoan pour tous les clients.
export function contact() {
  return clientActif().contact || "Yoan";
}

// Le contact est le client lui-même (Yoan dans son propre studio) : « préviens Yoan » n'a pas de sens.
// Les phrases s'adressent alors à lui directement. Chez un client dont le contact est quelqu'un d'autre
// (Romain), rien ne change.
export function contactEstLeClient(client = clientActif()) {
  return Boolean(client?.contact) && client.contact === client.prenom;
}

function echapperRe(t) { return String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// Remplacements dans l'ordre : du plus précis au plus général. Aucun guillemet ni barre oblique inverse
// dans les remplacements : ils s'appliquent aussi à du JSON déjà écrit.
function reglesSoi(nom) {
  const p = `[Pp]réviens ${echapperRe(nom)}`;
  const maj = (m, t) => (m.charAt(0) === "P" ? t.charAt(0).toUpperCase() : t.charAt(0)) + t.slice(1);
  return [
    [new RegExp(`Ne relance pas, préviens ${echapperRe(nom)} avec le message ci-dessous\\.`, "g"), () => "Ne relance pas : le message ci-dessous dit ce qui coince."],
    [new RegExp(`${p} avec le message ci-dessous\\.`, "g"), (m) => maj(m, "le message ci-dessous dit ce qui coince.")],
    [new RegExp(`${p} si tu as un doute\\.`, "g"), (m) => maj(m, "relis-le avant de confirmer.")],
    [new RegExp(`Pour le décaler, préviens ${echapperRe(nom)}\\.`, "g"), () => "Pour le décaler, il faut d'abord l'annuler : ça ne se fait pas encore depuis le studio."],
    [new RegExp(`${p} : la reconnexion prend deux minutes\\.`, "g"), (m) => maj(m, "reconnecte-le : ça prend deux minutes.")],
    [new RegExp(`${p} avant cette date : il la renouvelle en deux minutes\\.`, "g"), (m) => maj(m, "renouvelle-la avant cette date : ça prend deux minutes.")],
    [new RegExp(`${p} : une autorisation est à donner dans les réglages de ton Mac\\.`, "g"), (m) => maj(m, "donne-lui l'autorisation dans les réglages de ton Mac (Confidentialité et sécurité, Fichiers et dossiers).")],
    [new RegExp(`Rien n'est perdu : préviens ${echapperRe(nom)}\\.`, "g"), () => "Rien n'est perdu, mais il faut les raccorder à la main."],
    [new RegExp(`${p}\\b`, "g"), (m) => maj(m, "c'est un souci du studio à corriger")],
  ];
}

// Rend le texte adressé au client lui-même quand il est son propre contact ; sinon le texte tel quel.
export function adresser(texte, client = clientActif()) {
  if (typeof texte !== "string" || !contactEstLeClient(client) || !/réviens /.test(texte)) return texte;
  let t = texte;
  for (const [motif, f] of reglesSoi(client.contact)) t = t.replace(motif, f);
  return t;
}
