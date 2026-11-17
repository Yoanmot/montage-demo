// Les chiffres Instagram de la vue d'ensemble (contrat, section 15). Lecture seule, toujours.
//
// D'où ils viennent :
//   - `stats.fichier` dans la config (tests, bac à sable de Yoan) : un fichier JSON local au format de
//     `zernio.py stats --format json`, jamais d'appel réseau ;
//   - sinon, hors simulation : `python3 <depot_mac>/outils/zernio.py stats --jours 30 --format json
//     --sortie -` (lecture seule, rien d'écrit), au plus toutes les `stats.heures` heures ;
//   - en simulation sans fichier : rien (les chiffres s'affichent absents), sauf avec
//     STUDIO_STATS_INSTAGRAM=1 (environnement de test de Yoan, lot 11) : la même lecture seule.
// Le cache et le relevé quotidien des abonnés (pour la courbe) vivent dans STUDIO_HOME/stats/, jamais
// dans git. Une donnée absente reste absente : rien n'est inventé.
import path from "node:path";
import { lireJson, ecrireJson, jourZurich, ajouterJours, existe } from "./outils.mjs";
import { lancerZernio } from "../publication/publication.mjs";
import { configBrute } from "./publication.mjs";
import { contact } from "./client.mjs";

const JOUR_RE = /^\d{4}-\d{2}-\d{2}$/;

export function dossierStats(config) { return path.join(config.home, "stats"); }

export function sourceStats(config) {
  if (config.stats?.fichier) return "fichier";
  if (config.simulation && !config.stats?.instagramEnSimulation) return null;
  return "instagram";
}

const nombre = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

// Ajoute le relevé du jour (un par jour, le dernier de la journée gagne) ; garde 400 jours.
export function ajouterReleve(historique, jour, abonnes) {
  const h = (Array.isArray(historique) ? historique : []).filter((x) => x && JOUR_RE.test(x.jour) && nombre(x.abonnes) !== null);
  if (nombre(abonnes) === null || !JOUR_RE.test(jour)) return h;
  const sans = h.filter((x) => x.jour !== jour);
  sans.push({ jour, abonnes });
  sans.sort((a, b) => a.jour.localeCompare(b.jour));
  return sans.slice(-400);
}

// Variation des abonnés sur 30 jours : contre le relevé le plus proche d'il y a 30 jours (ou plus
// ancien). Moins de 30 jours de relevés : la variation depuis le premier relevé, marquée partielle.
export function variationAbonnes(historique, aujourdHui) {
  const h = (historique || []).filter((x) => x.jour <= aujourdHui);
  if (h.length < 2) return null;
  const dernier = h[h.length - 1];
  const limite = ajouterJours(aujourdHui, -30);
  const avant = [...h].reverse().find((x) => x.jour <= limite);
  const base = avant || h[0];
  if (base.jour === dernier.jour) return null;
  return { valeur: dernier.abonnes - base.abonnes, depuis: base.jour, partielle: !avant };
}

function lireSource(config) {
  const d = lireJson(config.stats.fichier, null);
  if (!d || typeof d !== "object") throw Object.assign(new Error("fichier de stats illisible"), { code: "FICHIER" });
  return d;
}

async function lireInstagram(config) {
  if (!existe(path.join(config.depotMac, "outils", "zernio.py"))) {
    throw Object.assign(new Error("zernio.py absent de la copie du Mac"), { code: "ABSENT" });
  }
  const r = await lancerZernio(configBrute(config), ["stats", "--jours", "30", "--format", "json", "--sortie", "-"], { timeoutMs: 150000 });
  const ligne = String(r.sortie || "").split("\n").map((l) => l.trim()).filter((l) => l.startsWith("{")).pop();
  if (r.code !== 0 || !ligne) {
    const derniere = String(r.sortie || "").trim().split("\n").pop() || "";
    throw Object.assign(new Error(`zernio.py stats : code ${r.code} ${derniere.slice(0, 160)}`), { code: "ZERNIO" });
  }
  return JSON.parse(ligne);
}

export class Stats {
  constructor({ config, journal = () => {}, lire } = {}) {
    this.config = config;
    this.journal = journal;
    this.lireExterne = lire || null; // tests : remplace la lecture
    this.enCours = null;
    this.ecouteurs = new Set();
  }

  get fichierCache() { return path.join(dossierStats(this.config), "cache.json"); }

  cache() {
    const c = lireJson(this.fichierCache, null);
    return c && typeof c === "object" ? c : { version: 1, maj: null, donnees: null, historique: [], erreur: null };
  }

  perime(c = this.cache()) {
    if (!sourceStats(this.config)) return false;
    if (!c.maj) return true;
    const heures = Math.max(1, Number(this.config.stats?.heures) || 6);
    // Après un échec, on retente au bout d'une heure, pas à chaque ouverture.
    const base = Date.parse(c.essai_le && c.erreur ? c.essai_le : c.maj);
    return Date.now() - base > (c.erreur ? 3600e3 : heures * 3600e3);
  }

  on(f) { this.ecouteurs.add(f); return () => this.ecouteurs.delete(f); }

  // Relit la source (une seule lecture à la fois) ; garde l'ancien cache si ça échoue.
  actualiser() {
    if (this.enCours) return this.enCours;
    const source = sourceStats(this.config);
    if (!source) return Promise.resolve(this.vue());
    this.enCours = (async () => {
      await null; // jamais fini avant d'être noté « en cours » (sinon enCours resterait posé)
      const c = this.cache();
      const essai = new Date().toISOString();
      try {
        const d = this.lireExterne ? await this.lireExterne(this.config)
          : source === "fichier" ? lireSource(this.config) : await lireInstagram(this.config);
        let h = c.historique || [];
        // Un fichier d'exemple peut apporter son propre relevé (courbe dès le premier jour).
        for (const x of Array.isArray(d.historique_abonnes) ? d.historique_abonnes : []) h = ajouterReleve(h, x.jour, x.abonnes);
        h = ajouterReleve(h, jourZurich(new Date(d.le || Date.now())), nombre(d.abonnes));
        ecrireJson(this.fichierCache, { version: 1, maj: essai, essai_le: essai, source, donnees: d, historique: h, erreur: null });
        this.journal("stats_ok", { source });
      } catch (e) {
        ecrireJson(this.fichierCache, { ...c, version: 1, essai_le: essai, erreur: e.code || "ERREUR" });
        this.journal("stats_erreur", { source, erreur: String(e.message || e).slice(0, 200) });
      } finally {
        this.enCours = null;
      }
      const v = this.vue();
      for (const f of this.ecouteurs) { try { f(v); } catch { /* rien */ } }
      return v;
    })();
    return this.enCours;
  }

  // Ce que l'interface reçoit (contrat, section 15). titres : slug -> titre de la carte.
  vue(titres = new Map()) {
    const c = this.cache();
    const d = c.donnees || null;
    const source = sourceStats(this.config);
    const auj = jourZurich();
    const r = {
      disponible: Boolean(d), source, exemple: Boolean(d?.exemple), maj: c.maj || null, chiffres_du: d?.le || null,
      en_cours: Boolean(this.enCours), erreur: null,
      abonnes: nombre(d?.abonnes), variation_abonnes: variationAbonnes(c.historique, auj),
      historique: (c.historique || []).filter((x) => x.jour >= ajouterJours(auj, -90)),
      compte_28j: d?.compte_28j || null, compte_28j_avant: d?.compte_28j_avant || null,
      publications_30j: nombre(d?.publications_30j), vues_publications_30j: nombre(d?.vues_publications_30j),
      normale_vues: d?.normale_vues || null,
      publications: (Array.isArray(d?.publications) ? d.publications : []).slice(0, 6).map((p) => ({
        le: p.le || null, type: p.type || null, titre: (p.slug && titres.get(p.slug)) || p.sujet || null,
        slug: p.slug || null, lien: typeof p.lien === "string" && /^https:\/\//.test(p.lien) ? p.lien : null,
        vues: nombre(p.vues), likes: nombre(p.likes), commentaires: nombre(p.commentaires),
        enregistrements: nombre(p.enregistrements), partages: nombre(p.partages),
        x_vues: nombre(p.x_vues), comparable: Boolean(p.comparable),
      })),
    };
    if (!source && !d) r.erreur = "Les chiffres d'Instagram ne se lisent pas dans ce studio d'essai.";
    else if (c.erreur && !d) r.erreur = `Je n'arrive pas à lire tes chiffres Instagram pour l'instant. Je réessaie dans une heure ; si ça dure, préviens ${contact()}.`;
    else if (c.erreur) r.erreur = "La dernière mise à jour n'a pas marché : ce sont les chiffres d'avant. Je réessaie dans une heure.";
    return r;
  }
}
