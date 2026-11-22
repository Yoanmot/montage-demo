// Branchement de la publication (lot 5, studio/publication/publication.mjs) sur le serveur :
// le serveur ne réécrit rien de la publication, il passe la config, les cartes et suit chaque
// confirmation dans la file. Erreurs du lot 5 -> réponses JSON du contrat (section 10).
import * as pub from "../publication/publication.mjs";
import { construireCartes } from "./lecture.mjs";
import { ErreurStudio, MESSAGE_GENERIQUE } from "./depot-outils.mjs";
import { motParLeStudio, motParLeServeur } from "./ressources.mjs";

const STATUT_HTTP = { RESSOURCES_ABSENTES: 404, RIEN_A_POSER: 400, RIEN_A_REESSAYER: 400, PAS_DE_POST: 409, REFUS: 409, ARRET: 409, REESSAI_IMPOSSIBLE: 409, RIEN_A_PUBLIER: 409, DATE_ILLISIBLE: 400, RECAP_INCONNU: 409, RECAP_EXPIRE: 409, RECAP_DEJA_UTILISE: 409 };

// Le lot 5 lit la config sous sa forme de fichier (depot_hoc, depot_mac, media...) : on lui donne
// les chemins déjà développés.
export function configBrute(config) {
  return {
    ...config.brut,
    depot_hoc: config.depot,
    depot_mac: config.depotMac,
    media: config.media,
    carrousels: config.carrousels,
    skills: config.skills,
    // Le client (compte Zernio du garde-fou d'écriture) : jamais écrit dans un fichier.
    client: config.client,
    // Ressources gratuites dont le studio pose le mot : choix de la ressource au récapitulatif (--ressource).
    // Chez un client dont le serveur pose le mot (Romain), rien : ni liste, ni --ressource, ni règle depuis le Mac.
    ressources: motParLeStudio(config),
    publication: { ...(config.brut.publication || {}), simulation: config.simulation },
  };
}

function traduireErreur(e) {
  if (e instanceof ErreurStudio) return e;
  if (e instanceof pub.ErreurPublication) return new ErreurStudio(e.code, e.message, STATUT_HTTP[e.code] || 409);
  return new ErreurStudio("ERREUR", MESSAGE_GENERIQUE, 500);
}

export class Publication {
  constructor({ config, file, synchro, journal = () => {}, etatLocal = () => ({}), ressources = null }) {
    this.ressources = ressources;
    this.config = config;
    this.file = file;
    this.synchro = synchro;
    this.journal = journal;
    this.etatLocal = etatLocal;
  }

  // zernio.py tourne dans la copie des scripts du Mac (depot_mac), alignée sur le dépôt en ligne :
  // DEPOT est poussé avant (une validation restée hors ligne), et tiré après (registre).
  async pousser() {
    try { await this.synchro?.pousser(); } catch { /* hors ligne : on vérifie avec ce qu'on a */ }
  }

  async tirer() {
    try { await this.synchro?.tirer(); } catch { /* hors ligne */ }
  }

  // La liste des ressources du récapitulatif (offrables ou non, avec la raison) et la phrase qui dit
  // pourquoi elle est vide. Jamais une liste vide sans explication.
  async choixRessources() {
    if (!configBrute(this.config).ressources || !this.ressources?.actif()) return { ressources: null, note: null };
    try { return await this.ressources.pourUnPost(); } catch {
      return { ressources: [], note: "Je n'arrive pas à lire tes ressources gratuites pour l'instant : revérifie dans un moment." };
    }
  }

  // Lot 13 : le TikTok du client est-il relié chez Zernio, et que permet-il ? Lu par `zernio.py tiktok` (lecture
  // seule), gardé deux minutes. L'identifiant du fichier du client (zernio.tiktok) est passé s'il est connu ; sinon
  // zernio.py le découvre sur le profil (GET /v1/accounts) dès qu'il y apparaît. Illisible : null (TikTok grisé).
  async etatTiktok(maintenant = Date.now()) {
    if (this.tiktokCache && maintenant - this.tiktokCache.le < 120e3) return this.tiktokCache.etat;
    const id = this.config.client?.zernio?.tiktok;
    const args = ['tiktok', '--format', 'json', ...(id ? ['--tiktok-compte', String(id)] : [])];
    let etat = null;
    try {
      const { code, sortie } = await pub.lancerZernio(configBrute(this.config), args, { timeoutMs: 60000 });
      const ligne = String(sortie || '').trim().split('\n').pop();
      const j = code === 0 ? JSON.parse(ligne) : null;
      if (j && typeof j === 'object' && 'relie' in j) etat = j;
    } catch { etat = null; }
    this.tiktokCache = { le: maintenant, etat };
    this.journal("tiktok_lu", { relie: etat ? etat.relie : "illisible" });
    return etat;
  }

  async recap(elements) {
    await this.pousser();
    try {
      const c = await this.choixRessources();
      const tiktok = await this.etatTiktok();
      const r = await pub.recap(elements, configBrute(this.config), { ressources: c.ressources, ressourcesNote: c.note, tiktok: tiktok || { relie: null } });
      // Chez Romain (le serveur pose le mot, 22/11/2026) : le mot, le message et le bouton de la ressource reliée à chaque
      // contenu, retouchables ici ; « Enregistrer » les met en attente pour son serveur (route ressources/relier).
      if (motParLeServeur(this.config) && this.ressources) {
        let mots = new Map();
        try { mots = await this.ressources.motsPourUnPost(); } catch { mots = new Map(); }
        for (const e of r.elements) {
          const m = mots.get(e.slug);
          if (!m) continue;
          e.mot_serveur = { ressource: m.ressource, ressource_titre: m.ressource_titre, mot: m.mot, message: m.message, bouton: m.bouton,
            empreinte: m.empreinte, valide: m.valide, offert: m.offert, bloquants: m.bloquants, etat: m.mot_serveur.etat, texte: m.mot_serveur.texte };
        }
      }
      this.journal("recap_publication", { recap_id: r.recap_id, n: r.elements.length });
      return r;
    } catch (e) {
      throw traduireErreur(e);
    }
  }

  // textes : { <slug>: { legende?, message?, bouton? } } retouchés au récapitulatif juste avant le clic.
  // quands : { <slug>: "maintenant" | "AAAA-MM-JJ HH:MM" } choisis après la préparation (lot 10).
  // plateformes : { <slug>: ["instagram", "tiktok"] } cochées au clic (lot 13) ; tiktok : { <slug>: { commentaires,
  // duo, collage, consentement } }, les réglages et l'accord donnés par ce clic.
  async confirmer(recapId, textes, quands = {}, plateformes = {}, tiktok = {}) {
    await this.pousser();
    try {
      const r = await this.file.suivre("publication", {}, () => pub.confirmer(recapId, configBrute(this.config), { textes, quands, plateformes, tiktok }));
      await this.tirer();
      this.journal("publication", { recap_id: recapId, simulation: Boolean(r.simulation), n: r.resultats?.length || 0,
        plateformes: (r.resultats || []).map((x) => `${x.slug}:${(x.plateformes_choisies || []).join("+") || "aucune"}:${x.statut}`) });
      return { resultats: r.resultats };
    } catch (e) {
      throw traduireErreur(e);
    }
  }

  // « Brancher le mot » : la règle du mot sur un post déjà parti dont le clic n'a pas pu la poser.
  async poserMot(slug, ressource) {
    await this.pousser();
    try {
      const r = await this.file.suivre("publication", {}, () => pub.poserMot(slug, ressource, configBrute(this.config)));
      await this.tirer();
      this.journal("poser_mot", { slug, statut: r.statut });
      return r;
    } catch (e) {
      throw traduireErreur(e);
    }
  }

  // « Réessayer sur TikTok » (ou Instagram) : seulement cette plateforme, au clic.
  async reessayer(slug, plateforme) {
    await this.pousser();
    try {
      const r = await this.file.suivre("publication", {}, () => pub.reessayer(slug, plateforme, configBrute(this.config)));
      await this.tirer();
      this.journal("reessayer", { slug, plateforme, statut: r.statut });
      return r;
    } catch (e) {
      throw traduireErreur(e);
    }
  }

  async semaine(lundi) {
    await this.pousser();
    try {
      return await pub.semaine(lundi, configBrute(this.config), construireCartes(this.config, this.etatLocal()));
    } catch (e) {
      throw traduireErreur(e);
    }
  }
}
