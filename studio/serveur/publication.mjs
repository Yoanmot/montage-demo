// Branchement de la publication (lot 5, studio/publication/publication.mjs) sur le serveur :
// le serveur ne réécrit rien de la publication, il passe la config, les cartes et suit chaque
// confirmation dans la file. Erreurs du lot 5 -> réponses JSON du contrat (section 10).
import * as pub from "../publication/publication.mjs";
import { construireCartes } from "./lecture.mjs";
import { ErreurStudio, MESSAGE_GENERIQUE } from "./depot-outils.mjs";
import { ressourcesActives } from "./ressources.mjs";

const STATUT_HTTP = { RESSOURCES_ABSENTES: 404, RIEN_A_POSER: 400, RIEN_A_PUBLIER: 409, DATE_ILLISIBLE: 400, RECAP_INCONNU: 409, RECAP_EXPIRE: 409, RECAP_DEJA_UTILISE: 409 };

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
    // Ressources gratuites réglées pour ce client : choix de la ressource au récapitulatif (--ressource).
    ressources: ressourcesActives(config),
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

  // Les ressources qu'un post peut offrir (en ligne, message prêt), pour la liste du récapitulatif.
  async pretes() {
    if (!this.ressources?.actif()) return null;
    try { return await this.ressources.pretes(); } catch { return []; }
  }

  async recap(elements) {
    await this.pousser();
    try {
      const r = await pub.recap(elements, configBrute(this.config), { ressources: await this.pretes() });
      this.journal("recap_publication", { recap_id: r.recap_id, n: r.elements.length });
      return r;
    } catch (e) {
      throw traduireErreur(e);
    }
  }

  async confirmer(recapId) {
    await this.pousser();
    try {
      const r = await this.file.suivre("publication", {}, () => pub.confirmer(recapId, configBrute(this.config)));
      await this.tirer();
      this.journal("publication", { recap_id: recapId, simulation: Boolean(r.simulation), n: r.resultats?.length || 0 });
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

  async semaine(lundi) {
    await this.pousser();
    try {
      return await pub.semaine(lundi, configBrute(this.config), construireCartes(this.config, this.etatLocal()));
    } catch (e) {
      throw traduireErreur(e);
    }
  }
}
