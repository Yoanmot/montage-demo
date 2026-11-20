// La file des actions (contrat, sections 8 et 9) : STUDIO_HOME/file.json, relue au démarrage,
// parallélisme réglable, statut « fini » seulement quand le fichier attendu existe.
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lireJson, ecrireJson, isoZurich, horodatage, lireTexte, existe, lister } from "./outils.mjs";
import { attenduPresent, formatDuContenu } from "./attendus.mjs";
import { lireDepot, videoFace, videosFace, brolls } from "./lecture.mjs";
import { contact, clientActif } from "./client.mjs";
import { quandReprise, PHRASE_CONNEXION } from "./normalisation.mjs";

const TYPES_CLAUDE = new Set(["script", "tournage", "montage", "mise_en_page"]);
const GARDER_TERMINEES = 300;
const DOSSIER_GABARITS = path.join(path.dirname(fileURLToPath(import.meta.url)), "gabarits");

export function chatDeAction(a) {
  switch (a.type) {
    case "script":
    case "mise_en_page":
      return `${a.slug}:hoc`;
    case "montage":
      return `${a.slug}:monteur`;
    case "tournage":
      return `tournage:${a.lot}`;
    default:
      return null;
  }
}

// Un gabarit peut commencer par un commentaire pour qui le maintient (<!-- ... -->) : retiré jusqu'à la
// ligne « --> » seule (le commentaire cite lui-même « --> » dans son texte : le premier ne le ferme pas).
export function remplir(gabarit, valeurs) {
  const fin = /\r?\n-->[ \t]*(\r?\n|$)/.exec(gabarit);
  const corps = gabarit.startsWith("<!--") && fin
    ? gabarit.slice(fin.index + fin[0].length)
    : gabarit.startsWith("<!--") && gabarit.includes("-->")
      ? gabarit.slice(gabarit.indexOf("-->") + 3).replace(/^\r?\n/, "") : gabarit;
  return corps.replace(/\{\{(\w+)\}\}/g, (_, k) => (valeurs[k] ?? "")).replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

function gabarit(nom) {
  return lireTexte(path.join(DOSSIER_GABARITS, nom), "") || "";
}

function titreDe(config, slug) {
  const e = lireJson(path.join(config.depot, "contenus", slug, "etat.json"), null);
  return e?.titre || slug;
}

// Le premier message d'une action (gabarits/).
export function messageAction(a, config) {
  const titre = a.slug ? titreDe(config, a.slug) : "";
  // Le prénom du client dans les gabarits ({{prenom}}).
  const prenom = (config.client || clientActif()).prenom;
  if (a.type === "script") {
    const format = formatDuContenu(config, a.slug);
    return remplir(gabarit("script.md"), { prenom,
      slug: a.slug, titre, format,
      skill: format === "carrousel" ? "carrousel-script" : "reel-script",
      ou_ecrire: format === "carrousel"
        ? `Le brouillon va dans contenus/${a.slug}/carrousel.md (la validation le recopiera pour la mise en page).`
        : `Le script va dans contenus/${a.slug}/script.md.`,
    });
  }
  if (a.type === "tournage") {
    const liste = (a.slugs || []).map((s) => `${s} (« ${titreDe(config, s)} »)`).join(", ");
    return remplir(gabarit("tournage.md"), { prenom, slugs: liste });
  }
  if (a.type === "montage") {
    const video = videoFace(config, a.slug);
    const autres = videosFace(config, a.slug).filter((v) => v !== video);
    const clips = brolls(config, a.slug).sort();
    const tournages = lireDepot(config.depot).tournages.filter((x) => x.contenus.includes(a.slug))
      .sort((x, y) => String(y.cree_le || "").localeCompare(String(x.cree_le || "")));
    return remplir(gabarit("montage.md"), { prenom,
      slug: a.slug, titre: titre.replace(/\*/g, ""),
      video: (video || "aucune") + (autres.length ? ` (autres prises : ${autres.join(", ")})` : ""),
      clips: clips.length ? clips.map((c) => `- ${c}`).join("\n") : "- aucun",
      script: path.join(config.depot, "contenus", a.slug, "script.md"),
      tournage: tournages.map((t) => `Plan de tournage groupé : ${path.join(config.depot, "tournages", t.fichier)}`).join("\n"),
    });
  }
  if (a.type === "mise_en_page") {
    const texte = existe(path.join(config.depot, "a-rendre", "carrousels", `${a.slug}.md`))
      ? path.join(config.depot, "a-rendre", "carrousels", `${a.slug}.md`)
      : path.join(config.depot, "rendus", "carrousels", `${a.slug}.md`);
    const dossierPhotos = path.join(config.media, a.slug, "photos");
    const photos = lister(dossierPhotos).filter((e) => !e.name.startsWith(".")).map((e) => path.join(dossierPhotos, e.name)).sort();
    return remplir(gabarit("mise-en-page.md"), { prenom,
      slug: a.slug, titre: titre.replace(/\*/g, ""), texte,
      photos: photos.length ? photos.map((f) => `- ${f}`).join("\n") : "- aucune",
      skills: config.skills || "",
    });
  }
  return "";
}

const REPRISES = {
  redemarrage: "Le studio a redémarré pendant que tu travaillais sur ce contenu : reprends où tu en étais.",
  limite: "La limite d'utilisation de l'abonnement Claude est repassée : reprends ce travail où tu en étais.",
  connexion: "Le studio est de nouveau connecté au compte Claude : reprends ce travail où tu en étais.",
  relance: "On relance ce travail, qui avait coincé la dernière fois : reprends où tu en étais.",
};
// Sans heure de reprise donnée par Claude, la file réessaie après ce délai (limite d'abonnement).
const PAUSE_LIMITE_MS = 30 * 60e3;
const MOTIFS_PAUSE = new Set(["limite", "connexion"]);

export class File extends EventEmitter {
  constructor({ config, pont, journal = () => {}, avant = async () => {} }) {
    super();
    this.config = config;
    this.pont = pont;
    this.journal = journal;
    this.avant = avant;
    this.fichier = path.join(config.home, "file.json");
    this.actions = [];
    this.lancesParFile = new Set();
    this.enTick = false;
    this.compteur = 0;
    // Pause de toute la file (lot 12) : limite d'abonnement (jusqu'à l'heure de reprise) ou compte déconnecté
    // (jusqu'au prochain tour réussi ou au redémarrage). Les actions restent en attente, rien n'échoue en chaîne.
    this.pause = null;   // { motif, jusqua: ms | null }
    this.minuteriePause = null;
    pont.resoudreFin = (chatId) => this.resoudreFin(chatId);
    pont.on("fin", (e) => this.surFin(e));
    // Un processus qui finit après son tour (lot 12 : un chat reste occupé tant que son processus vit) libère le chat.
    pont.on("libre", () => setImmediate(() => this.tick()));
  }

  charger() {
    const d = lireJson(this.fichier, null);
    this.actions = Array.isArray(d?.actions) ? d.actions : [];
    // Une limite d'abonnement survit au redémarrage ; une déconnexion non (le jeton a pu être reposé).
    const pause = d?.pause;
    if (pause?.motif === "limite" && Number(pause.jusqua) > Date.now()) this.poserPause("limite", Number(pause.jusqua), { sauver: false });
    let repris = 0;
    for (const a of this.actions) {
      if (a.statut === "en_cours") {
        // Reprise après redémarrage : le fichier attendu a pu être écrit avant la coupure.
        if (TYPES_CLAUDE.has(a.type) && attenduPresent(a, this.config)) {
          a.statut = "fini";
          a.fin = isoZurich();
        } else if (TYPES_CLAUDE.has(a.type)) {
          a.statut = "en_file";
          a.reprise = a.reprise || "redemarrage";
          repris += 1;
        } else {
          a.statut = "erreur";
          a.erreur = "Le studio s'est arrêté pendant ce travail. Relance-le.";
          a.fin = isoZurich();
        }
      }
    }
    this.cloreAttendus();
    this.sauver();
    if (repris) this.journal("file_reprise", { actions: repris });
    return this;
  }

  // Une action qui attendait Romain (« à toi ») dont le fichier attendu existe maintenant est finie,
  // même si c'est une autre action (relancée depuis la carte) qui l'a produit : sinon elle resterait
  // « à toi » dans la file pour toujours (vu au lot 7, mise en page relancée). Rend le nombre closes.
  cloreAttendus() {
    let n = 0;
    for (const a of this.actions) {
      // Une action en souci dont le fichier existe maintenant (refaite depuis la carte ou le chat) est finie aussi.
      if (["a_toi", "erreur"].includes(a.statut) && TYPES_CLAUDE.has(a.type) && a.type !== "idees" && attenduPresent(a, this.config)) {
        a.statut = "fini";
        a.fin = isoZurich();
        n += 1;
      }
    }
    return n;
  }

  sauver() {
    const terminees = this.actions.filter((a) => ["fini", "erreur", "arrete"].includes(a.statut));
    if (terminees.length > GARDER_TERMINEES) {
      const retirer = new Set(terminees.slice(0, terminees.length - GARDER_TERMINEES).map((a) => a.id));
      this.actions = this.actions.filter((a) => !retirer.has(a.id));
    }
    try {
      ecrireJson(this.fichier, { version: 1, actions: this.actions, ...(this.pause ? { pause: this.pause } : {}) });
    } catch (e) {
      // Disque plein : la file reste juste en mémoire, le serveur ne tombe pas.
      this.journal("ecriture_impossible", { fichier: "file.json", erreur: e.code || String(e) });
    }
    this.emit("change", this.liste());
  }

  liste() {
    return this.actions.filter((a) => a.statut !== "efface").map((a) => {
      const { reprise, ...reste } = a;
      return reste;
    });
  }

  // ------------------------------------------------------------ pause (limite d'abonnement, déconnexion)

  pauseActive() {
    if (!this.pause) return false;
    if (this.pause.jusqua && Date.now() >= this.pause.jusqua) {
      this.leverPause("heure");
      return false;
    }
    return true;
  }

  poserPause(motif, jusqua, { sauver = true } = {}) {
    this.pause = { motif, jusqua: jusqua || null };
    if (this.minuteriePause) clearTimeout(this.minuteriePause);
    this.minuteriePause = null;
    if (jusqua) {
      // Une minute de marge après l'heure donnée par Claude.
      const dans = Math.max(1000, jusqua - Date.now() + 60e3);
      this.minuteriePause = setTimeout(() => { this.leverPause("heure"); this.tick(); }, Math.min(dans, 2 ** 31 - 1));
      this.minuteriePause.unref?.();
    }
    this.journal("file_en_pause", { motif, jusqua: jusqua ? new Date(jusqua).toISOString() : null });
    if (sauver) this.sauver();
  }

  leverPause(raison) {
    if (!this.pause) return;
    this.journal("file_reprend", { motif: this.pause.motif, raison });
    this.pause = null;
    if (this.minuteriePause) clearTimeout(this.minuteriePause);
    this.minuteriePause = null;
    this.sauver();
  }

  // Ce que l'interface montre de la pause : une phrase, jamais un détail technique.
  vuePause() {
    if (!this.pauseActive()) return null;
    const { motif, jusqua } = this.pause;
    const n = this.actions.filter((a) => a.statut === "en_file").length;
    const quand = quandReprise(jusqua) || "dans quelques heures";
    const phrase = motif === "limite"
      ? `Limite de ton abonnement Claude atteinte : ${n > 1 ? "tes travaux reprennent" : "ça reprend"} tout seul ${quand}.`
      : PHRASE_CONNEXION;
    return { motif, jusqua: jusqua ? new Date(jusqua).toISOString() : null, phrase };
  }

  // ------------------------------------------------------------ relancer, effacer (actions en souci)

  // Relance une action en souci (ou arrêtée) qui passe par Claude : elle revient en file, sur sa conversation.
  relancer(id) {
    const a = this.trouver(id);
    if (!a || a.statut === "efface") return { ok: false, code: "INTROUVABLE" };
    if (!["erreur", "arrete"].includes(a.statut)) return { ok: false, code: "PAS_EN_SOUCI" };
    if (!TYPES_CLAUDE.has(a.type)) return { ok: false, code: "PAS_RELANCABLE" };
    a.statut = "en_file";
    a.erreur = null;
    a.fin = null;
    a.reprise = "relance";
    this.sauver();
    this.journal("action_relancee", { id: a.id, type: a.type });
    setImmediate(() => this.tick());
    return { ok: true };
  }

  // Efface une action terminée (en souci ou arrêtée) de la liste : elle n'est plus montrée.
  effacer(id) {
    const a = this.trouver(id);
    if (!a || a.statut === "efface") return { ok: false, code: "INTROUVABLE" };
    if (!["erreur", "arrete", "fini"].includes(a.statut)) return { ok: false, code: "PAS_TERMINEE" };
    a.statut = "efface";
    this.sauver();
    this.journal("action_effacee", { id: a.id, type: a.type });
    return { ok: true };
  }

  nouvelId(prefixe) {
    this.compteur += 1;
    return `${prefixe}-${horodatage()}-${this.compteur}`;
  }

  // Ajoute des actions (une par slug ; un seul tournage pour tous les slugs).
  ajouter(type, slugs) {
    const lot = `l-${horodatage()}-${++this.compteur}`;
    const le = isoZurich();
    const base = { lot, statut: "en_file", cree_le: le, debut: null, fin: null, session: null, erreur: null };
    const nouvelles = type === "tournage"
      ? [{ id: this.nouvelId("a"), type, slugs: [...slugs], ...base }]
      : slugs.map((slug) => ({ id: this.nouvelId("a"), type, slug, ...base }));
    this.actions.push(...nouvelles);
    this.sauver();
    this.journal("actions_ajoutees", { type, lot, n: nouvelles.length });
    setImmediate(() => this.tick());
    return { lot, actions: nouvelles };
  }

  // Action hors Claude (rangement, publication, archivage) suivie dans la file.
  async suivre(type, details, travail) {
    const a = {
      id: this.nouvelId("a"), type, ...details, lot: `l-${horodatage()}-${++this.compteur}`,
      statut: "en_cours", cree_le: isoZurich(), debut: isoZurich(), fin: null, session: null, erreur: null,
    };
    this.actions.push(a);
    this.sauver();
    try {
      const r = await travail();
      a.statut = "fini";
      return r;
    } catch (e) {
      a.statut = "erreur";
      a.erreur = e.messageRomain || `Ça n'a pas marché. Réessaie, et si ça recommence, préviens ${contact()}.`;
      throw e;
    } finally {
      a.fin = isoZurich();
      this.sauver();
    }
  }

  trouver(id) {
    return this.actions.find((a) => a.id === id) || null;
  }

  actionDuChat(chatId, statuts = ["en_cours"]) {
    for (let i = this.actions.length - 1; i >= 0; i--) {
      const a = this.actions[i];
      if (a.session === chatId && statuts.includes(a.statut)) return a;
    }
    return null;
  }

  arreter(id) {
    const a = this.trouver(id);
    if (!a) return false;
    if (a.statut === "en_cours" && a.session && this.pont.actif(a.session)) {
      this.pont.arreter(a.session); // surFin passera l'action à « arrete »
      return true;
    }
    if (["en_file", "a_toi", "en_cours"].includes(a.statut)) {
      a.statut = "arrete";
      a.fin = isoZurich();
      this.sauver();
    }
    return true;
  }

  // Romain répond dans le chat d'une action qui attendait sa réponse : elle repart.
  repriseParRomain(chatId) {
    const a = this.actionDuChat(chatId, ["a_toi"]);
    if (a) {
      a.statut = "en_cours";
      this.sauver();
    }
  }

  // Fin de tour : « fini » si le fichier attendu existe, sinon « à toi ». Une mise en page est
  // enregistrée par le Mac dans sa propre copie du dépôt puis poussée : on tire avant de regarder.
  async resoudreFin(chatId) {
    const a = this.actionDuChat(chatId, ["en_cours"]);
    if (!a) return "a_toi";
    if (a.type === "mise_en_page" && !attenduPresent(a, this.config)) {
      try { await this.avant(a); } catch { /* hors ligne */ }
    }
    return attenduPresent(a, this.config) ? "fini" : "a_toi";
  }

  surFin({ chat_id: chatId, etat, erreur, motif, reprise }) {
    const a = this.actionDuChat(chatId, ["en_cours"]);
    this.lancesParFile.delete(a?.id);
    // Limite d'abonnement ou compte déconnecté : l'action attend, et toute la file se met en pause au lieu
    // d'enchaîner des échecs. Elle repart seule à l'heure de reprise (ou au prochain tour réussi).
    if (etat === "erreur" && MOTIFS_PAUSE.has(motif)) {
      if (a) {
        a.statut = "en_file";
        a.reprise = motif;
        a.attente = motif;
        this.journal("action_en_pause", { id: a.id, type: a.type, motif });
      }
      this.poserPause(motif, motif === "limite" ? (Number(reprise) || Date.now() + PAUSE_LIMITE_MS) : null);
      return;
    }
    // Un tour qui réussit prouve que Claude répond : la pause éventuelle est levée.
    if (["fini", "a_toi"].includes(etat) && this.pause) this.leverPause("tour_reussi");
    if (a && etat) {
      a.statut = etat;
      if (etat === "erreur") a.erreur = erreur;
      if (["fini", "erreur", "arrete"].includes(etat)) a.fin = isoZurich();
      if (etat === "fini") {
        // Les essais précédents du même travail, restés en souci, sont clos avec lui.
        for (const x of this.actions) {
          if (x !== a && x.statut === "erreur" && x.type === a.type && x.slug && x.slug === a.slug) { x.statut = "fini"; x.fin = isoZurich(); }
        }
        this.cloreAttendus();
      }
      this.sauver();
      this.journal("action_terminee", { id: a.id, type: a.type, statut: etat });
      if (etat === "fini") this.emit("fini", a);
    }
    setImmediate(() => this.tick());
  }

  enCoursParFile() {
    return this.actions.filter((a) => a.statut === "en_cours" && this.lancesParFile.has(a.id)).length;
  }

  async tick() {
    if (this.enTick) return;
    this.enTick = true;
    try {
      for (;;) {
        if (this.pauseActive()) break;
        if (this.enCoursParFile() >= this.config.parallele) break;
        const a = this.actions.find((x) => x.statut === "en_file" && TYPES_CLAUDE.has(x.type)
          && !this.pont.actif(chatDeAction(x)));
        if (!a) break;
        try {
          await this.avant(a);
        } catch {
          /* la synchro hors ligne ne bloque pas le travail local */
        }
        if (a.statut !== "en_file") continue;
        this.demarrer(a);
      }
    } finally {
      this.enTick = false;
    }
  }

  demarrer(a) {
    const chat = chatDeAction(a);
    const reprise = a.reprise && a.debut && this.pont.aUneSession(chat);
    let envoi;
    try {
      envoi = reprise ? (REPRISES[a.reprise] || REPRISES.redemarrage) : messageAction(a, this.config);
    } catch (e) {
      a.statut = "erreur";
      a.erreur = `Je n'ai pas pu préparer ce travail. Préviens ${contact()}.`;
      a.fin = isoZurich();
      this.sauver();
      this.journal("action_impossible", { id: a.id, erreur: String(e.message || e) });
      return;
    }
    a.statut = "en_cours";
    a.debut = a.debut || isoZurich();
    a.session = chat;
    delete a.reprise;
    delete a.attente;
    this.lancesParFile.add(a.id);
    this.sauver();
    this.journal("action_lancee", { id: a.id, type: a.type, chat_id: chat });
    this.pont.envoyer(chat, { envoi, romain: false, parFile: true, besoin: { miseEnPage: a.type === "mise_en_page", slug: a.slug } });
  }
}

export { lister };
