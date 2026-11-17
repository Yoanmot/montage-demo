// Appels aux outils du dépôt (lot 3 : outils/idees.py, outils/etat.py ; contrat section 4) et au
// rangement (lot 4 : rangement/ranger.mjs ; contrat section 11), par leur interface en ligne de
// commande. Le studio lit seulement la ligne `OK ...` ou `BLOQUE <CODE> ...`.
import path from "node:path";
import { executer, lireVerdict } from "./commandes.mjs";
import { existe } from "./outils.mjs";
import { CODE } from "./config.mjs";
import { contact } from "./client.mjs";

export class ErreurStudio extends Error {
  constructor(code, message, statut = 409) {
    super(message);
    this.code = code;
    this.messageRomain = message;
    this.statut = statut;
  }
}

export const MESSAGE_GENERIQUE = `Ça n'a pas marché. Réessaie, et si ça recommence, préviens ${contact()}.`;
const ABSENT = `Cette partie n'est pas encore installée sur ton Mac. Préviens ${contact()}.`;

// Retire les chemins d'un message avant de le montrer à Romain.
export function sansChemins(texte) {
  return String(texte || "")
    .replace(/(?<![\w/])(?:~|\/(?:Users|private|tmp|Volumes|home|var|opt))(?:\/[^\s,;)»"']+)+/g, "le fichier")
    .replace(/(?<![\w/])[\w.-]+(?:\/[\w.-]+)*\.(?:md|json|py|mjs|mp4|mov|png|jpe?g)\b/gi, "le fichier")
    .replace(/\s+/g, " ").trim();
}

// Phrases pour Romain, par code de BLOQUE des outils du dépôt (lot 3). BLOQUE = rien n'a changé.
const PHRASES = {
  ID: "Je ne trouve plus cette idée.",
  INTROUVABLE: "Je ne trouve plus cette idée.",
  DEJA_GARDEE: "Cette idée est déjà gardée.",
  MIS_DE_COTE: "Ce contenu a été mis de côté.",
  PAS_DE_TEXTE: "Il n'y a pas encore de texte écrit pour ce contenu.",
  TIRET_LONG: "Le texte contient un tiret long : demande dans le chat de la carte de le corriger, puis valide.",
  LEGENDE_MANQUANTE: "Il manque encore la légende : demande-la dans le chat de la carte, puis valide les slides et la légende ensemble.",
  LEGENDE_PROVISOIRE: "La légende n'est pas encore écrite (il n'y a qu'un texte d'attente) : demande-la dans le chat de la carte, puis valide.",
  JOUR: "Cette date n'est pas lisible.",
  SLUG: "Je ne trouve pas ce contenu.",
  INCONNU: "Je ne trouve pas ce contenu.",
  SYNCHRO: "Je n'arrive pas à me mettre à jour (pas d'internet ?) : rien n'a changé, réessaie dans un moment.",
  CONFLIT: "Rien n'a changé : réessaie dans un moment.",
  CHANGE: "Ton texte a changé entre-temps (le chat l'a peut-être retouché). Je te remets la dernière version : refais ta modification dessus.",
  VIDE: "Le texte ne peut pas être vide : rien n'est enregistré.",
  FORMAT: "Je n'arrive pas à retoucher ces images ici : demande la modification dans le chat.",
  ACCROCHE: "Je ne trouve plus cette accroche : recharge le brief.",
  SUPPRIMEE: "Cette idée a été supprimée.",
  STATUT: "Cette idée a déjà changé de place : recharge.",
  ENTREE: `Ça n'a pas marché. Réessaie, et si ça recommence, préviens ${contact()}.`,
};

export async function outilDepot(config, script, args, { delaiMs = 120000 } = {}) {
  const fichier = path.join(config.depot, "outils", script);
  if (!existe(fichier)) throw new ErreurStudio("OUTIL_ABSENT", ABSENT, 503);
  const r = await executer("python3", [fichier, ...args], {
    cwd: config.depot,
    env: { ...process.env, HOC_DEPOT: config.depot },
    delaiMs,
  });
  const v = lireVerdict(r.sortie);
  if (v?.ok) return { ...v, sortie: r.sortie };
  if (v && !v.ok) throw new ErreurStudio(v.code, PHRASES[v.code] || MESSAGE_GENERIQUE, 409);
  throw new ErreurStudio("ECHEC", MESSAGE_GENERIQUE, 500);
}

// --------------------------------------------------------------- rangement (lot 4)

export function cheminRanger() {
  return path.join(CODE, "rangement", "ranger.mjs");
}

export function lireSortieRangement(sortie) {
  const r = { places: [], a_ranger: [], ignores: [], fin: null };
  for (const l of String(sortie || "").split("\n")) {
    let m;
    if ((m = /^PLACE\s+(.+?)\s+->\s+([a-z0-9-]+)\/(\S+)\s*$/.exec(l))) r.places.push({ nom: m[1], slug: m[2], type: m[3] });
    else if ((m = /^A_RANGER\s+(\S+)\s*(.*)$/.exec(l))) r.a_ranger.push({ nom: m[1], raison: m[2] });
    else if ((m = /^IGNORE\s+(\S+)\s*(.*)$/.exec(l))) r.ignores.push({ nom: m[1], raison: m[2] });
    else if ((m = /^FIN\s+places=(\d+)\s+a_ranger=(\d+)/.exec(l))) r.fin = { places: +m[1], a_ranger: +m[2] };
  }
  return r;
}

export async function lancerRangement(config, { tournage } = {}) {
  const script = cheminRanger();
  if (!existe(script)) throw new ErreurStudio("RANGEMENT_ABSENT", ABSENT, 503);
  const args = [script, "--config", config.fichier];
  if (tournage) args.push("--tournage", tournage);
  const r = await executer(process.execPath, args, {
    cwd: CODE, env: { ...process.env, STUDIO_CONFIG: config.fichier }, delaiMs: 30 * 60000,
  });
  const lu = lireSortieRangement(r.sortie);
  if (r.code !== 0 && !lu.fin) throw new ErreurStudio("RANGEMENT_ECHEC", `Le rangement de tes vidéos n'a pas abouti. Réessaie, et si ça recommence, préviens ${contact()}.`, 500);
  return lu;
}

export async function placerManuel(config, { fichier, slug, type }) {
  const script = cheminRanger();
  if (!existe(script)) throw new ErreurStudio("RANGEMENT_ABSENT", ABSENT, 503);
  const r = await executer(process.execPath, [script, "placer", fichier, slug, type, "--config", config.fichier], {
    cwd: CODE, env: { ...process.env, STUDIO_CONFIG: config.fichier }, delaiMs: 10 * 60000,
  });
  const lu = lireSortieRangement(r.sortie);
  if (r.code !== 0 || lu.a_ranger.length) {
    const v = lireVerdict(r.sortie);
    throw new ErreurStudio(v?.code || "PLACEMENT_ECHEC",
      v?.message ? sansChemins(v.message) : `Je n'ai pas pu ranger ce fichier là. Réessaie, et si ça recommence, préviens ${contact()}.`, 409);
  }
  return lu;
}

// « Pas le bon » dans la vue Montage (lot 9) : le rush sort du contenu et repart dans « à ranger ».
export async function retirerRush(config, { slug, type, nom }) {
  const script = cheminRanger();
  if (!existe(script)) throw new ErreurStudio("RANGEMENT_ABSENT", ABSENT, 503);
  const r = await executer(process.execPath, [script, "retirer", slug, type, nom, "--config", config.fichier], {
    cwd: CODE, env: { ...process.env, STUDIO_CONFIG: config.fichier }, delaiMs: 2 * 60000,
  });
  if (r.code !== 0 || !/^RETIRE /m.test(r.sortie)) {
    const v = lireVerdict(r.sortie);
    throw new ErreurStudio(v?.code || "RETRAIT_ECHEC",
      v?.message ? sansChemins(v.message) : `Je n'ai pas pu le retirer. Réessaie, et si ça recommence, préviens ${contact()}.`, 409);
  }
  return true;
}
