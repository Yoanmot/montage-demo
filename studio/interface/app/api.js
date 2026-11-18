// Le lien avec le serveur du studio (contrat, section 10).
// Même interface que la maquette (maquette.js) : l'appli ne sait pas laquelle elle utilise.
import { previens } from "./outils.js";

const MESSAGE_RESEAU = "Le studio ne répond pas. Il redémarre peut-être : réessaie dans un instant.";

export class ErreurStudio extends Error {
  constructor(code, message, statut) { super(message); this.code = code; this.statut = statut; }
}

async function appel(methode, route, corps) {
  let rep;
  try {
    rep = await fetch(route, {
      method: methode,
      credentials: "same-origin",
      headers: corps !== undefined ? { "Content-Type": "application/json" } : {},
      body: corps !== undefined ? JSON.stringify(corps) : undefined,
    });
  } catch {
    throw new ErreurStudio("RESEAU", MESSAGE_RESEAU, 0);
  }
  let donnees = null;
  const texte = await rep.text();
  if (texte) { try { donnees = JSON.parse(texte); } catch { donnees = null; } }
  if (rep.status === 401) window.dispatchEvent(new CustomEvent("studio-deconnecte"));
  if (!rep.ok) {
    const code = donnees?.erreur || (rep.status === 401 ? "NON_CONNECTE" : "ERREUR");
    const message = donnees?.message || (rep.status === 401
      ? "Rouvre le studio depuis son icône."
      : `Ça n'a pas marché. Réessaie, et si ça recommence, ${previens()}.`);
    const e = new ErreurStudio(code, message, rep.status);
    e.donnees = donnees;
    throw e;
  }
  return donnees ?? {};
}

const enc = encodeURIComponent;

export function creerApiServeur() {
  return {
    maquette: false,
    etat: () => appel("GET", "/api/etat"),
    carte: (slug) => appel("GET", `/api/cartes/${enc(slug)}`),
    garder: (id, jour) => appel("POST", `/api/propositions/${enc(id)}/garder`, jour ? { jour } : {}),
    refuser: (id, raison) => appel("POST", `/api/propositions/${enc(id)}/supprimer`, raison ? { raison } : {}),
    supprimer: (id, raison) => appel("POST", `/api/propositions/${enc(id)}/supprimer`, raison ? { raison } : {}),
    mettreDeCote: (id) => appel("POST", `/api/propositions/${enc(id)}/mettre-de-cote`, {}),
    reprendre: (id) => appel("POST", `/api/propositions/${enc(id)}/reprendre`, {}),
    accroche: (slug, n, empreinte) => appel("POST", `/api/cartes/${enc(slug)}/accroche`, { n, empreinte }),
    cocherPlan: (id, cle, coche) => appel("POST", `/api/tournages/${enc(id)}/cocher`, { cle, coche }),
    sauterPrise: (id, n, sautee) => appel("POST", `/api/tournages/${enc(id)}/sauter`, { n, sautee }),
    validerTournage: (id) => appel("POST", `/api/tournages/${enc(id)}/valider`, {}),
    ouvrirLien: (url) => appel("POST", "/api/lien", { url }),
    valider: (slug) => appel("POST", `/api/cartes/${enc(slug)}/valider`, {}),
    jour: (slug, jour) => appel("POST", `/api/cartes/${enc(slug)}/jour`, { jour: jour || null }),
    abandonner: (slug, raison) => appel("POST", `/api/cartes/${enc(slug)}/abandonner`, raison ? { raison } : {}),
    lancer: (type, slugs) => appel("POST", "/api/actions", { type, slugs }),
    arreterAction: (id) => appel("POST", `/api/actions/${enc(id)}/arreter`, {}),
    chat: (chatId) => appel("GET", `/api/chats/${enc(chatId)}`),
    envoyer: (chatId, texte) => appel("POST", `/api/chats/${enc(chatId)}/messages`, { texte }),
    arreterChat: (chatId) => appel("POST", `/api/chats/${enc(chatId)}/arreter`, {}),
    tournage: (id) => appel("GET", `/api/tournages/${enc(id)}`),
    receptionPlan: (id) => appel("GET", `/api/tournages/${enc(id)}/reception`),
    brief: (slug, corps) => appel("POST", `/api/cartes/${enc(slug)}/brief`, corps),
    retirerRush: (slug, id) => appel("POST", `/api/cartes/${enc(slug)}/rushs/retirer`, { id }),
    noteApercu: (slug, note) => appel("POST", `/api/cartes/${enc(slug)}/apercu/notes`, note),
    fabriquer: (slug) => appel("POST", `/api/cartes/${enc(slug)}/apercu/fabriquer`, {}),
    placer: (fichier, slug, type) => appel("POST", "/api/rangement/placer", { fichier, slug, type }),
    relancerRangement: () => appel("POST", "/api/rangement/relancer", {}),
    recap: (elements) => appel("POST", "/api/publication/recap", { elements }),
    confirmer: (recap_id, textes, quands) => appel("POST", "/api/publication/confirmer", { recap_id, ...(textes ? { textes } : {}), ...(quands ? { quands } : {}) }),
    poserMot: (slug, ressource) => appel("POST", "/api/publication/poser-mot", { slug, ressource }),
    ressources: () => appel("GET", "/api/ressources"),
    stats: () => appel("GET", "/api/stats"),
    actualiserStats: () => appel("POST", "/api/stats/actualiser", {}),
    ecouter: ecouterServeur,
  };
}

// Flux d'événements : reconnexion automatique avec attente croissante.
// À chaque reconnexion, l'appli recharge l'état complet (onConnexion("ok")) pour ne rien rater.
function ecouterServeur({ onEvenement, onConnexion }) {
  const TYPES = ["carte", "carte_retiree", "chat", "file", "a_ranger", "sync", "stats", "tournages", "ping"];
  let source = null; let attente = 1000; let minuteur = null; let ferme = false; let dernierSignal = Date.now();
  let veille = null;

  const ouvrir = () => {
    if (ferme) return;
    source = new EventSource("/api/evenements", { withCredentials: true });
    source.onopen = () => { attente = 1000; dernierSignal = Date.now(); onConnexion("ok"); };
    source.onerror = () => {
      onConnexion("coupe");
      if (source.readyState === EventSource.CLOSED) relancer();
    };
    for (const t of TYPES) {
      source.addEventListener(t, (e) => {
        dernierSignal = Date.now();
        if (t === "ping") return;
        let d = null; try { d = JSON.parse(e.data); } catch { return; }
        onEvenement(t, d);
      });
    }
  };
  const relancer = () => {
    try { source?.close(); } catch {}
    clearTimeout(minuteur);
    minuteur = setTimeout(ouvrir, attente);
    attente = Math.min(attente * 2, 15000);
  };
  // Le serveur envoie un ping toutes les 20 s : sans signal depuis 50 s, on rouvre.
  veille = setInterval(() => { if (Date.now() - dernierSignal > 50000) { dernierSignal = Date.now(); onConnexion("coupe"); relancer(); } }, 10000);
  ouvrir();
  return () => { ferme = true; clearInterval(veille); clearTimeout(minuteur); try { source?.close(); } catch {} };
}
