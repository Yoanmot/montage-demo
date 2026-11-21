// La consommation de l'abonnement Claude, montée discrètement en haut du studio.
//
// Source : l'événement `rate_limit_event` que `claude` écrit en stream-json à chaque session (vu le 2026-11-21 avec
// claude 2.1.328). Ce qu'il contient vraiment :
//   rate_limit_info.status         allowed | allowed_warning | rejected   (type public SDKRateLimitInfo)
//   rate_limit_info.resetsAt       secondes epoch de la remise à zéro de la fenêtre annoncée (public)
//   rate_limit_info.rateLimitType  five_hour | seven_day | ...                                   (public)
//   rate_limit_info.utilization    part utilisée, 0 à 1 (public mais facultatif : absent quand tout va bien)
//   rate_limit_info.unifiedWindows { five_hour: { utilization, resetsAt, status }, seven_day: {...} }
//                                  (marqué « interne » dans Claude Code : lu s'il est là, jamais exigé)
// `/usage` en mode non interactif ne donne que les jetons de la session, pas la limite : pas une source.
// Aucun appel réseau ici : on retient le dernier événement reçu, dans un fichier (STUDIO_HOME/conso-claude.json),
// et ce qu'on montre s'efface après l'heure de remise à zéro.
import path from "node:path";
import { lireJson, ecrireJson, isoZurich } from "./outils.mjs";
import { quandReprise } from "./normalisation.mjs";

const FENETRES = ["five_hour", "seven_day"];
const SEUIL_PROCHE = 0.8;

const nombre = (x) => (typeof x === "number" && Number.isFinite(x) ? x : null);
const ms = (s) => (nombre(Number(s)) && Number(s) > 0 ? Number(s) * 1000 : null);

// Ce qu'on garde d'un rate_limit_info : seulement des nombres et des statuts connus.
export function lireInfo(info) {
  if (!info || typeof info !== "object") return null;
  const statut = ["allowed", "allowed_warning", "rejected"].includes(info.status) ? info.status : null;
  if (!statut) return null;
  const fenetres = {};
  const w = info.unifiedWindows && typeof info.unifiedWindows === "object" ? info.unifiedWindows : {};
  for (const f of FENETRES) {
    const x = w[f];
    if (!x || typeof x !== "object") continue;
    const u = nombre(x.utilization);
    const r = ms(x.resetsAt);
    if (u === null || !r) continue;
    fenetres[f] = { utilisation: u, reprise: r, statut: typeof x.status === "string" ? x.status : null };
  }
  // L'utilisation publique, quand Claude la donne, vaut pour la fenêtre annoncée.
  const type = FENETRES.includes(info.rateLimitType) ? info.rateLimitType : null;
  const u = nombre(info.utilization);
  if (type && u !== null && ms(info.resetsAt)) fenetres[type] = { utilisation: u, reprise: ms(info.resetsAt), statut };
  return { statut, type, reprise: ms(info.resetsAt), fenetres };
}

export class Conso {
  constructor({ home, journal = () => {} }) {
    this.fichier = path.join(home, "conso-claude.json");
    this.journal = journal;
    this.etat = lireJson(this.fichier, null);
  }

  // Le dernier événement fait foi (il est plus récent que tout ce qu'on savait).
  noter(info) {
    const lu = lireInfo(info);
    if (!lu) return false;
    this.etat = { version: 1, le: isoZurich(), ...lu };
    this.sauver();
    return true;
  }

  // Une limite vue seulement dans le texte de Claude (sans événement) : l'heure de reprise vient du texte.
  noterLimite(reprise) {
    const r = nombre(Number(reprise));
    if (this.etat?.statut === "rejected" && this.etat.reprise && (!r || r <= this.etat.reprise)) return false;
    this.etat = { version: 1, le: isoZurich(), statut: "rejected", type: this.etat?.type || null, reprise: r || null, fenetres: this.etat?.fenetres || {} };
    this.sauver();
    return true;
  }

  sauver() {
    try { ecrireJson(this.fichier, this.etat); } catch (e) { this.journal("ecriture_impossible", { fichier: "conso-claude.json", erreur: e.code || String(e) }); }
  }

  // Ce que montre le haut du studio : { niveau: large | proche | atteinte, phrase, jusqua } ou null (rien de sûr).
  vue(maintenant = Date.now()) {
    const e = this.etat;
    if (!e?.statut) return null;
    const quand = (r) => quandReprise(r, maintenant);
    if (e.statut === "rejected") {
      // Sans heure donnée, une limite vue il y a plus de 5 h n'est plus sûre.
      const jusqua = e.reprise || (Date.parse(e.le) || 0) + 5 * 3600e3;
      if (jusqua <= maintenant) return null;
      return { niveau: "atteinte", jusqua: iso(jusqua), phrase: `Claude : limite atteinte, ça repart ${e.reprise ? quand(e.reprise) : "dans quelques heures"}` };
    }
    // Un pourcentage : celui de la fenêtre la plus remplie parmi celles qui ne sont pas encore remises à zéro.
    const vivantes = Object.entries(e.fenetres || {}).filter(([, f]) => f.reprise > maintenant);
    if (vivantes.length) {
      const [nom, f] = vivantes.sort((a, b) => b[1].utilisation - a[1].utilisation)[0];
      const pct = Math.max(0, Math.min(100, Math.round(f.utilisation * 100)));
      const proche = f.utilisation >= SEUIL_PROCHE || f.statut === "allowed_warning" || f.statut === "rejected";
      const de = nom === "seven_day" ? "de ta limite de la semaine" : "de ta limite";
      return { niveau: proche ? "proche" : "large", jusqua: iso(f.reprise), phrase: `Claude : ${pct} % ${de}, remise à zéro ${quand(f.reprise)}` };
    }
    if (!e.reprise || e.reprise <= maintenant) return null;
    if (e.statut === "allowed_warning") {
      return { niveau: "proche", jusqua: iso(e.reprise), phrase: `Claude : tu approches de ta limite, remise à zéro ${quand(e.reprise)}` };
    }
    return { niveau: "large", jusqua: iso(e.reprise), phrase: "Claude : tu as de la marge" };
  }
}

const iso = (x) => new Date(x).toISOString();
