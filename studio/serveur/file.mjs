// La file des actions (contrat, sections 8 et 9) : STUDIO_HOME/file.json, relue au démarrage,
// parallélisme réglable, statut « fini » seulement quand le fichier attendu existe.
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lireJson, ecrireJson, isoZurich, horodatage, lireTexte, existe, lister } from "./outils.mjs";
import { attenduPresent, formatDuContenu } from "./attendus.mjs";
import { lireDepot, videoFace, videosFace, brolls } from "./lecture.mjs";

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

// Un gabarit peut commencer par un commentaire pour qui le maintient (<!-- ... -->) : retiré.
export function remplir(gabarit, valeurs) {
  const corps = gabarit.startsWith("<!--") && gabarit.includes("-->")
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
  if (a.type === "script") {
    const format = formatDuContenu(config, a.slug);
    return remplir(gabarit("script.md"), {
      slug: a.slug, titre, format,
      skill: format === "carrousel" ? "carrousel-script" : "reel-script",
      ou_ecrire: format === "carrousel"
        ? `Le brouillon va dans contenus/${a.slug}/carrousel.md (la validation le recopiera pour la mise en page).`
        : `Le script va dans contenus/${a.slug}/script.md.`,
    });
  }
  if (a.type === "tournage") {
    const liste = (a.slugs || []).map((s) => `${s} (« ${titreDe(config, s)} »)`).join(", ");
    return remplir(gabarit("tournage.md"), { slugs: liste });
  }
  if (a.type === "montage") {
    const video = videoFace(config, a.slug);
    const autres = videosFace(config, a.slug).filter((v) => v !== video);
    const clips = brolls(config, a.slug).sort();
    const tournages = lireDepot(config.depot).tournages.filter((x) => x.contenus.includes(a.slug))
      .sort((x, y) => String(y.cree_le || "").localeCompare(String(x.cree_le || "")));
    return remplir(gabarit("montage.md"), {
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
    return remplir(gabarit("mise-en-page.md"), {
      slug: a.slug, titre: titre.replace(/\*/g, ""), texte,
      photos: photos.length ? photos.map((f) => `- ${f}`).join("\n") : "- aucune",
      skills: config.skills || "",
    });
  }
  return "";
}

const REPRISE = "Le studio a redémarré pendant que tu travaillais sur ce contenu : reprends où tu en étais.";

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
    pont.resoudreFin = (chatId) => this.resoudreFin(chatId);
    pont.on("fin", (e) => this.surFin(e));
  }

  charger() {
    const d = lireJson(this.fichier, null);
    this.actions = Array.isArray(d?.actions) ? d.actions : [];
    let repris = 0;
    for (const a of this.actions) {
      if (a.statut === "en_cours") {
        // Reprise après redémarrage : le fichier attendu a pu être écrit avant la coupure.
        if (TYPES_CLAUDE.has(a.type) && attenduPresent(a, this.config)) {
          a.statut = "fini";
          a.fin = isoZurich();
        } else if (TYPES_CLAUDE.has(a.type)) {
          a.statut = "en_file";
          a.reprise = true;
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
      if (a.statut === "a_toi" && TYPES_CLAUDE.has(a.type) && a.type !== "idees" && attenduPresent(a, this.config)) {
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
    ecrireJson(this.fichier, { version: 1, actions: this.actions });
    this.emit("change", this.liste());
  }

  liste() {
    return this.actions.map((a) => {
      const { reprise, ...reste } = a;
      return reste;
    });
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
      a.erreur = e.messageRomain || "Ça n'a pas marché. Réessaie, et si ça recommence, préviens Yoan.";
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

  surFin({ chat_id: chatId, etat, erreur }) {
    const a = this.actionDuChat(chatId, ["en_cours"]);
    this.lancesParFile.delete(a?.id);
    if (a && etat) {
      a.statut = etat;
      if (etat === "erreur") a.erreur = erreur;
      if (["fini", "erreur", "arrete"].includes(etat)) a.fin = isoZurich();
      if (etat === "fini") this.cloreAttendus();
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
      envoi = reprise ? REPRISE : messageAction(a, this.config);
    } catch (e) {
      a.statut = "erreur";
      a.erreur = "Je n'ai pas pu préparer ce travail. Préviens Yoan.";
      a.fin = isoZurich();
      this.sauver();
      this.journal("action_impossible", { id: a.id, erreur: String(e.message || e) });
      return;
    }
    a.statut = "en_cours";
    a.debut = a.debut || isoZurich();
    a.session = chat;
    delete a.reprise;
    this.lancesParFile.add(a.id);
    this.sauver();
    this.journal("action_lancee", { id: a.id, type: a.type, chat_id: chat });
    this.pont.envoyer(chat, { envoi, romain: false, parFile: true, besoin: { miseEnPage: a.type === "mise_en_page", slug: a.slug } });
  }
}

export { lister };
