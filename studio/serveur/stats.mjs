// Les chiffres Instagram de la vue d'ensemble (contrat, section 15). Lecture seule, toujours.
//
// D'où ils viennent :
//   - `stats.fichier` dans la config (tests, bac à sable de Yoan) : un fichier JSON local au format de
//     `zernio.py stats --format json`, jamais d'appel réseau ;
//   - sinon, hors simulation : `python3 <depot_mac>/outils/zernio.py stats --jours 30 --format json
//     --sortie -` (lecture seule, rien d'écrit), au plus toutes les `stats.heures` heures ;
//   - en simulation sans fichier : rien (les chiffres s'affichent absents), sauf avec
//     STUDIO_STATS_INSTAGRAM=1 (environnement de test de Yoan, lot 11) : la même lecture seule ;
//   - installation d'essai dont le client porte `stats_reelles` (romain-test) et dont la clé de lecture est posée
//     (<racine>/zernio-lecture.env) : `zernio.py --compte <compte> stats ...`, cette clé passée à ce seul appel ;
//     la publication reste simulée. Sans la clé : le fichier, comme avant.
// Le tableau de bord (lot 11 du studio de Yoan) : les chiffres semaine par semaine (lundi à dimanche, heure de Zurich),
// 52 semaines. Instagram ne donne les vues, les visites du profil et les likes qu'en total : un appel par semaine,
// donc les semaines passées sont gardées dans le cache et figées 3 jours après leur fin (Instagram annonce 48 h de
// retard) ; seules les semaines pas encore figées sont relues (`--semaines-depuis`). Les visites des ressources
// gratuites viennent du compteur du site du client (`stats.visites_ressources`), pas d'Instagram.
// Le cache et le relevé quotidien des abonnés (pour la courbe) vivent dans STUDIO_HOME/stats/, jamais
// dans git. Une donnée absente reste absente : rien n'est inventé.
import path from "node:path";
import { lireJson, ecrireJson, lireTexte, jourZurich, ajouterJours, lundiDe, existe } from "./outils.mjs";
import { lancerZernio } from "../publication/publication.mjs";
import { configBrute } from "./publication.mjs";
import { contact } from "./client.mjs";

const JOUR_RE = /^\d{4}-\d{2}-\d{2}$/;

export function dossierStats(config) { return path.join(config.home, "stats"); }

// La clé de lecture d'une installation d'essai (config.stats.lecture, client à `stats_reelles`) est-elle posée ? Une
// ligne ZERNIO_API_KEY=<non vide> dans <racine>/zernio-lecture.env. Rend vrai ou faux, jamais la valeur.
export function cleLecturePosee(lecture) {
  if (!lecture?.cleFichier) return false;
  const t = lireTexte(lecture.cleFichier, null);
  return Boolean(t && /^ZERNIO_API_KEY=["']?[^\s"']/m.test(t));
}

export function sourceStats(config) {
  // Installation d'essai à `stats_reelles` : les vrais chiffres en lecture dès que la clé de lecture est posée (la
  // publication reste simulée) ; sans elle, le fichier de stats comme avant.
  if (cleLecturePosee(config.stats?.lecture)) return "instagram";
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

// ---------------------------------------------------------------- semaines (lot 11)
export const SEMAINES = 52; // la liste des posts ne remonte pas à plus d'un an : 52 semaines, la semaine en cours comprise
export const GEL_JOURS = 3; // une semaine lue 3 jours ou plus après sa fin ne bouge plus
const CHIFFRES_SEMAINE = ["vues", "portee", "visites_profil", "likes", "publications"];

// Les lundis des 52 semaines, de la plus ancienne à celle en cours.
export function fenetreSemaines(aujourdHui = jourZurich(), n = SEMAINES) {
  const courant = lundiDe(aujourdHui);
  return Array.from({ length: n }, (_, k) => ajouterJours(courant, -7 * (n - 1 - k)));
}

// Figée : lue sans erreur au moins GEL_JOURS jours après son dimanche.
export function semaineFigee(s) {
  return Boolean(s && JOUR_RE.test(s.lu_le || "") && !s.erreur && s.lu_le >= ajouterJours(ajouterJours(s.debut, 6), GEL_JOURS));
}

// Le premier lundi à relire : la plus ancienne semaine de la fenêtre absente du cache ou pas encore figée.
export function relireDepuis(semaines, aujourdHui = jourZurich()) {
  const par = new Map((semaines || []).map((s) => [s.debut, s]));
  return fenetreSemaines(aujourdHui).find((l) => !semaineFigee(par.get(l))) || lundiDe(aujourdHui);
}

// Range les semaines lues (zernio.py) dans le cache : une entrée par lundi, la lecture la plus récente gagne ; une semaine
// figée n'est jamais remplacée. Seules les 52 semaines de la fenêtre restent.
export function fusionnerSemaines(anciennes, lues, luLe, aujourdHui = jourZurich()) {
  const par = new Map();
  for (const s of Array.isArray(anciennes) ? anciennes : []) if (s && JOUR_RE.test(s.debut || "")) par.set(s.debut, s);
  for (const s of Array.isArray(lues) ? lues : []) {
    if (!s || !JOUR_RE.test(s.debut || "") || lundiDe(s.debut) !== s.debut) continue;
    if (semaineFigee(par.get(s.debut))) continue;
    const e = { debut: s.debut, lu_le: luLe };
    for (const k of CHIFFRES_SEMAINE) e[k] = nombre(s[k]);
    if (s.erreur) e.erreur = true;
    par.set(s.debut, e);
  }
  const fenetre = new Set(fenetreSemaines(aujourdHui));
  return [...par.values()].filter((s) => fenetre.has(s.debut)).sort((a, b) => a.debut.localeCompare(b.debut));
}

// La clé de lecture du compteur : variable d'environnement, sinon ligne NOM=valeur du fichier. Jamais écrite ailleurs.
function cleVisites(v, env = process.env) {
  if (v.cleVariable && env[v.cleVariable]) return String(env[v.cleVariable]).trim();
  if (!v.cleFichier) return null;
  const t = lireTexte(v.cleFichier, null);
  if (!t) return null;
  const nom = v.cleVariable || "VISITES_RESSOURCES_CLE";
  for (const l of t.split("\n")) {
    const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/.exec(l);
    if (m && m[1] === nom) return m[2].trim().replace(/^["']|["']$/g, "") || null;
  }
  return null;
}

// Lit le compteur des visites des ressources gratuites (GET <url>?depuis=AAAA-MM-JJ, clé en Bearer).
// Rend { etat: "pas_mesure" } sans clé, { semaines: { lundi: visites }, le } sinon ; lève une erreur avec un code.
export async function lireVisites(v, depuis, { env = process.env, fetchFn = globalThis.fetch } = {}) {
  if (!/^https:\/\/|^http:\/\/(127\.0\.0\.1|localhost):\d+\//.test(v.url || "")) throw Object.assign(new Error("adresse du compteur refusée"), { code: "ADRESSE" });
  const cle = cleVisites(v, env);
  if (!cle) return { etat: "pas_mesure" };
  const u = new URL(v.url);
  u.searchParams.set("depuis", depuis);
  let r;
  try {
    r = await fetchFn(u, { headers: { Authorization: `Bearer ${cle}`, Accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(20000) });
  } catch (e) { throw Object.assign(new Error(`compteur injoignable : ${String(e.message || e).slice(0, 120)}`), { code: "RESEAU" }); }
  // 503 : le compteur répond mais ne compte pas encore (stockage pas branché) : pas encore mesuré, pas une panne.
  if (r.status === 503) return { etat: "pas_mesure" };
  if (r.status === 401 || r.status === 403) throw Object.assign(new Error(`compteur : clé refusée (${r.status})`), { code: "CLE" });
  if (!r.ok) throw Object.assign(new Error(`compteur : HTTP ${r.status}`), { code: "HTTP" });
  let d;
  try { d = await r.json(); } catch { throw Object.assign(new Error("compteur : réponse illisible"), { code: "FORMAT" }); }
  if (!d || d.version !== 1 || !Array.isArray(d.semaines)) throw Object.assign(new Error("compteur : format inconnu"), { code: "FORMAT" });
  const semaines = {};
  for (const s of d.semaines) {
    const l = JOUR_RE.test(s?.debut || "") ? lundiDe(s.debut) : null;
    if (l && nombre(s.visites) !== null) semaines[l] = (semaines[l] || 0) + s.visites;
  }
  return { etat: "ok", semaines, le: typeof d.le === "string" ? d.le : null };
}

// Les 52 semaines pour l'interface : chaque lundi de la fenêtre, absent (null) quand rien n'a été lu, jamais 0 inventé.
// visites : { debut (premier lundi mesuré), semaines: { lundi: n } } ou null.
export function semainesVue(semaines, visites, aujourdHui = jourZurich()) {
  const par = new Map((semaines || []).map((s) => [s.debut, s]));
  const courant = lundiDe(aujourdHui);
  const depart = visites?.debut || null;
  return fenetreSemaines(aujourdHui).map((l) => {
    const s = par.get(l) || {};
    const e = { debut: l, fin: ajouterJours(l, 6), en_cours: l === courant };
    for (const k of CHIFFRES_SEMAINE) e[k] = nombre(s[k]);
    e.visites_ressources = depart && l >= depart && l <= courant ? (nombre(visites.semaines?.[l]) ?? 0) : null;
    return e;
  });
}

function lireSource(config) {
  const d = lireJson(config.stats.fichier, null);
  if (!d || typeof d !== "object") throw Object.assign(new Error("fichier de stats illisible"), { code: "FICHIER" });
  return d;
}

async function lireInstagram(config, semainesDepuis = null) {
  if (!existe(path.join(config.depotMac, "outils", "zernio.py"))) {
    throw Object.assign(new Error("zernio.py absent de la copie du Mac"), { code: "ABSENT" });
  }
  // Installation d'essai à `stats_reelles` : le compte lu est dit explicitement, et la clé de lecture n'est donnée qu'à
  // cet appel (lancerZernio la refuse à toute autre commande).
  const lecture = cleLecturePosee(config.stats?.lecture) ? config.stats.lecture : null;
  const base = [...(lecture ? ["--compte", lecture.compte] : []), "stats", "--jours", "30", "--format", "json", "--sortie", "-"];
  const options = (timeoutMs) => ({ timeoutMs, ...(lecture ? { cleLecture: lecture.cleFichier } : {}) });
  // Lot 11 : un appel par semaine à relire (52 la première fois) ; le délai suit.
  let r = await lancerZernio(configBrute(config), semainesDepuis ? [...base, "--semaines-depuis", semainesDepuis] : base, options(semainesDepuis ? 420000 : 150000));
  // Une copie du head of content d'avant le lot 11 ne connaît pas l'argument : les chiffres d'avant, sans les semaines.
  if (semainesDepuis && r.code === 2 && /unrecognized arguments|--semaines-depuis/.test(String(r.sortie || ""))) {
    r = await lancerZernio(configBrute(config), base, options(150000));
  }
  const ligne = String(r.sortie || "").split("\n").map((l) => l.trim()).filter((l) => l.startsWith("{")).pop();
  if (r.code !== 0 || !ligne) {
    const derniere = String(r.sortie || "").trim().split("\n").pop() || "";
    throw Object.assign(new Error(`zernio.py stats : code ${r.code} ${derniere.slice(0, 160)}`), { code: "ZERNIO" });
  }
  return JSON.parse(ligne);
}

// Les chiffres par format (lot 10 : « Reels » puis « Carrousels » dans la vue d'ensemble) : combien de publications, leurs
// vues additionnées (seulement celles qui ont un chiffre) et la normale de vues du format. Rien d'inventé : un format
// sans publication a 0 publication et des vues absentes (null).
export function parFormat(publications, normale) {
  const r = {};
  for (const f of ["reel", "carrousel"]) {
    const ps = (publications || []).filter((p) => p.type === f);
    const vues = ps.map((p) => p.vues).filter((v) => typeof v === "number");
    r[f] = { publications: ps.length, vues: vues.length ? vues.reduce((a, b) => a + b, 0) : null, normale: nombre(normale?.[f]) };
  }
  return r;
}

export class Stats {
  constructor({ config, journal = () => {}, lire, lireVisites: lv } = {}) {
    this.config = config;
    this.journal = journal;
    this.lireExterne = lire || null; // tests : remplace la lecture
    this.lireVisitesExterne = lv || null; // tests : remplace la lecture du compteur
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
    // La source a changé (clé de lecture posée ou retirée) : relire tout de suite, pas dans 6 heures.
    if (c.source && c.source !== sourceStats(this.config)) return true;
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
      const auj = jourZurich();
      const depuis = relireDepuis(c.semaines, auj);
      let fichierVisites = null;
      try {
        const d = this.lireExterne ? await this.lireExterne(this.config, depuis)
          : source === "fichier" ? lireSource(this.config) : await lireInstagram(this.config, depuis);
        let h = c.historique || [];
        // Un fichier d'exemple peut apporter son propre relevé (courbe dès le premier jour).
        for (const x of Array.isArray(d.historique_abonnes) ? d.historique_abonnes : []) h = ajouterReleve(h, x.jour, x.abonnes);
        h = ajouterReleve(h, jourZurich(new Date(d.le || Date.now())), nombre(d.abonnes));
        // Les semaines lues (absentes si la copie du head of content ne les donne pas encore) ; un fichier d'exemple
        // peut porter les visites des ressources (bac à sable).
        const luLe = JOUR_RE.test(String(d.le || "").slice(0, 10)) ? jourZurich(new Date(d.le)) : auj;
        const semaines = fusionnerSemaines(c.semaines, d.semaines, luLe, auj);
        if (d.visites_ressources && typeof d.visites_ressources === "object") fichierVisites = d.visites_ressources;
        const { semaines: _s, visites_ressources: _v, ...donnees } = d;
        ecrireJson(this.fichierCache, { ...c, version: 1, maj: essai, essai_le: essai, source, donnees, historique: h, semaines, erreur: null });
        this.journal("stats_ok", { source, semaines_depuis: depuis, semaines_lues: Array.isArray(d.semaines) ? d.semaines.length : 0 });
      } catch (e) {
        ecrireJson(this.fichierCache, { ...c, version: 1, essai_le: essai, erreur: e.code || "ERREUR" });
        this.journal("stats_erreur", { source, erreur: String(e.message || e).slice(0, 200) });
      }
      try {
        await this.actualiserVisites(auj, fichierVisites);
      } finally {
        this.enCours = null;
      }
      const v = this.vue();
      for (const f of this.ecouteurs) { try { f(v); } catch { /* rien */ } }
      return v;
    })();
    return this.enCours;
  }

  // Le compteur des visites des ressources gratuites : relu à chaque actualisation (un seul appel), gardé dans le cache.
  async actualiserVisites(auj = jourZurich(), duFichier = null) {
    const v = this.config.stats?.visitesRessources;
    const c = this.cache();
    const le = new Date().toISOString();
    if (duFichier) { // bac à sable : { debut, semaines: { lundi: n } } dans le fichier d'exemple
      ecrireJson(this.fichierCache, { ...c, visites: { etat: "ok", debut: duFichier.debut || null, semaines: duFichier.semaines || {}, le, erreur: null } });
      return;
    }
    if (!v) return;
    const fenetre = fenetreSemaines(auj);
    const depart = v.debut ? lundiDe(v.debut) : null;
    const depuis = depart && depart > fenetre[0] ? depart : fenetre[0];
    try {
      const r = this.lireVisitesExterne ? await this.lireVisitesExterne(v, depuis) : await lireVisites(v, depuis);
      if (r.etat !== "ok") {
        if (c.visites?.etat === "ok") return; // déjà mesuré : on garde les chiffres d'avant
        ecrireJson(this.fichierCache, { ...c, visites: { etat: "pas_mesure", le, erreur: null } });
        return;
      }
      // Avant la pose du compteur, une semaine n'est pas à zéro : elle n'est pas mesurée. Sans date de pose, la première
      // semaine qui a des visites.
      const debut = depart || Object.keys(r.semaines).filter((l) => r.semaines[l] > 0).sort()[0] || null;
      ecrireJson(this.fichierCache, { ...c, visites: { etat: debut ? "ok" : "pas_mesure", debut, pose: v.debut || debut, semaines: r.semaines, le, erreur: null } });
      this.journal("visites_ok", { semaines: Object.keys(r.semaines).length });
    } catch (e) {
      ecrireJson(this.fichierCache, { ...c, visites: { ...(c.visites || {}), etat: c.visites?.etat === "ok" ? "ok" : "erreur", le_essai: le, erreur: e.code || "ERREUR" } });
      this.journal("visites_erreur", { erreur: String(e.message || e).slice(0, 200) });
    }
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
      // Toutes les publications des 30 jours lus (lot 10 : une colonne chacune dans les graphiques ; au plus 60).
      publications: (Array.isArray(d?.publications) ? d.publications : []).slice(0, 60).map((p) => ({
        le: p.le || null, type: p.type || null, titre: (p.slug && titres.get(p.slug)) || p.sujet || null,
        slug: p.slug || null, lien: typeof p.lien === "string" && /^https:\/\//.test(p.lien) ? p.lien : null,
        vues: nombre(p.vues), likes: nombre(p.likes), commentaires: nombre(p.commentaires),
        enregistrements: nombre(p.enregistrements), partages: nombre(p.partages),
        x_vues: nombre(p.x_vues), comparable: Boolean(p.comparable),
      })),
    };
    r.formats = parFormat(r.publications, r.normale_vues);
    // Lot 11 : le tableau de bord, semaine par semaine.
    const vis = c.visites || null;
    r.semaines = semainesVue(c.semaines, vis?.etat === "ok" ? vis : null, auj);
    r.visites_ressources = !this.config.stats?.visitesRessources && !vis ? { etat: "sans" }
      : vis?.erreur && vis.etat !== "ok" ? { etat: "erreur", phrase: "Je n'arrive pas à lire les visites de tes ressources pour l'instant." }
        : vis?.etat === "ok" ? { etat: "ok", depuis: vis.pose || vis.debut || null, phrase: vis.erreur ? "La dernière lecture des visites n'a pas marché : ce sont les chiffres d'avant." : null }
          : { etat: "pas_mesure" };
    if (!source && !d) r.erreur = "Les chiffres d'Instagram ne se lisent pas dans ce studio d'essai.";
    else if (c.erreur && !d) r.erreur = `Je n'arrive pas à lire tes chiffres Instagram pour l'instant. Je réessaie dans une heure ; si ça dure, préviens ${contact()}.`;
    else if (c.erreur) r.erreur = "La dernière mise à jour n'a pas marché : ce sont les chiffres d'avant. Je réessaie dans une heure.";
    return r;
  }
}
