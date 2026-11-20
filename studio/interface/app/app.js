// Le studio (lot 9) : trois colonnes, comme un explorateur de fichiers.
// À gauche l'arborescence (un dossier par idée), au milieu le fichier ouvert, à droite le chat,
// dont la portée suit ce qui est sélectionné (contrat, section 14).

import { creerApiServeur } from "./api.js";
import { el, icone, annoncer, ilYa, pluriel, CONTACT, CONTACT_SOI } from "./outils.js";
import { Chat } from "./chat.js";
import { Arbre } from "./arbre.js";
import { Vue } from "./vue.js";
import { Rangement } from "./rangement.js";
import { NOMS_ACTION, cle, fichierParDefaut, ETROIT, ouArbre } from "./commun.js";

const params = new URLSearchParams(location.search);
const MAQUETTE = params.get("maquette") === "1";
if (["light", "dark"].includes(params.get("theme"))) document.documentElement.dataset.theme = params.get("theme");

// Lot 12 : hors ligne, le bandeau ne promet plus que les changements partiront au retour (les boutons qui
// enregistrent échouent sans internet, et le chat aussi). Il dit ce qui attend la connexion.
const HORS_LIGNE = "Pas d'internet : le chat et l'enregistrement de tes textes attendent la connexion";
const syncHonnete = (s) => (s && s.etat === "hors_ligne" ? { ...s, message: HORS_LIGNE } : s || null);

class Studio {
  constructor(api) {
    this.api = api;
    this.cartes = new Map();
    this.a_ranger = []; this.file = []; this.sync = null; this.tournages = []; this.stats = null;
    this.config = { prenom: document.documentElement.dataset.prenom || "", jours_par_defaut: [], heures_par_defaut: { reel: "18:30", carrousel: "12:15" } };
    this.filtres = { format: "tous" };
    this.ouverts = new Set();
    this.sel = { genre: "accueil" };
    this.chats = new Map();
    this.connexion = "ok";
  }

  q(s) { return document.querySelector(s); }

  // ---------- Démarrage ----------
  async demarrer() {
    window.addEventListener("studio-deconnecte", () => { this.q(".app").classList.add("non-connecte"); document.querySelector(".annonces")?.replaceChildren(); });
    this.rangement = new Rangement(this);
    this.arbre = new Arbre(this, this.q(".arbre"));
    this.vue = new Vue(this, this.q(".col-vue"));
    this.monterBarre();
    // Lot 12 : un lien vers l'extérieur (la vidéo d'un outlier, une publication) s'ouvre dans le
    // navigateur habituel de Romain, jamais dans une fenêtre du studio sans onglets.
    const lienExterne = (e) => {
      const a = e.target.closest?.("a[href]");
      if (!a || !/^https?:\/\//i.test(a.getAttribute("href") || "")) return;
      if (e.type === "auxclick" && e.button !== 1) return;
      e.preventDefault();
      this.api.ouvrirLien(a.href).then(() => annoncer("C'est ouvert dans ton navigateur."), (err) => annoncer(err.message, "erreur"));
    };
    document.addEventListener("click", lienExterne);
    document.addEventListener("auxclick", lienExterne);
    this.lireAdresse();
    await this.recharger();
    this.chargerStats();
    // Sous 860 px les colonnes s'empilent : les phrases « à droite » deviennent « juste en dessous ».
    ETROIT.addEventListener("change", () => { if (!this.vue.edition) this.vue.afficher(); this.majChat(); });
    this.api.ecouter({
      onEvenement: (t, d) => this.evenement(t, d),
      onConnexion: (e) => {
        const avant = this.connexion; this.connexion = e; this.dessinerSync();
        if (e === "ok" && avant === "coupe") { this.recharger(); this.chargerStats(); for (const c of this.chats.values()) c.charger(); }
      },
    });
    setInterval(() => this.dessinerSync(), 30000);
    window.addEventListener("hashchange", () => { if (this.lireAdresse()) this.toutDessiner(); });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || e.defaultPrevented || document.activeElement?.closest("textarea, input")) return;
      this.selectionner({ genre: "accueil" });
    });
    if (MAQUETTE) this.scenarioMaquette();
  }

  monterBarre() {
    this.q(".marque").addEventListener("click", () => this.selectionner({ genre: "accueil" }));
    this.q(".filtre-format").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-format]"); if (!b) return;
      this.filtres.format = b.dataset.format;
      this.q(".filtre-format").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      this.arbre.dessiner();
    });
    // Chat général (lot 12) : repartir d'une conversation neuve. L'ancienne est gardée de côté, pas montrée.
    this.q(".chat-nouvelle").addEventListener("click", async (e) => {
      const b = e.currentTarget; b.disabled = true;
      try { await this.api.nouvelleConversation("general"); await this.chats.get("general")?.charger(); this.chats.get("general")?.focus(); }
      catch (err) { annoncer(err.message, "erreur"); }
      finally { b.disabled = false; this.majNouvelle(); }
    });
    const bFile = this.q("#file-bouton");
    bFile.addEventListener("click", () => { const p = this.q("#file-liste"); p.hidden = !p.hidden; bFile.setAttribute("aria-expanded", String(!p.hidden)); this.dessinerFile(); });
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#file-bouton, #file-liste")) { this.q("#file-liste").hidden = true; bFile.setAttribute("aria-expanded", "false"); }
    });
  }

  async recharger() {
    try {
      const e = await this.api.etat();
      this.cartes.clear();
      for (const c of e.cartes || []) this.cartes.set(cle(c), c);
      this.a_ranger = e.a_ranger || []; this.file = e.file || []; this.sync = syncHonnete(e.sync); this.tournages = e.tournages || [];
      this.filePause = e.file_pause || null; this.alertes = e.alertes || [];
      if (e.config) this.config = { ...this.config, ...e.config };
      // Le code du studio a changé (mise à jour, retour arrière) : la page se recharge pour parler au bon serveur.
      if (this.version && e.version && e.version !== this.version) { this.rechargerQuandLibre(); return; }
      if (e.version) this.version = e.version;
      this.q(".prenom").textContent = this.config.prenom || "";
      this.q(".app").classList.remove("non-connecte");
      this.toutDessiner();
    } catch (err) {
      if (err.statut === 401) { this.q(".app").classList.add("non-connecte"); return; }
      annoncer(err.message, "erreur");
      this.connexion = "coupe"; this.dessinerSync();
    }
  }

  // Les chiffres Instagram : le serveur répond tout de suite avec ce qu'il a, et envoie « stats »
  // quand une relecture finit.
  async chargerStats() {
    try { this.stats = await this.api.stats(); } catch { return; }
    if (this.sel.genre === "accueil") this.vue.transverseChangee();
  }

  // Recharge la page, mais jamais pendant que la personne écrit (un message, un brief en cours de retouche) : on
  // attend qu'elle ait envoyé ou vidé son texte.
  rechargerQuandLibre() {
    const occupe = () => Boolean(this.vue?.edition) || [...document.querySelectorAll("textarea, input[type=text]")].some((x) => x.value.trim());
    if (!occupe()) { location.reload(); return; }
    clearInterval(this._rechargement);
    this._rechargement = setInterval(() => { if (!occupe()) location.reload(); }, 3000);
  }

  toutDessiner() { this.arbre.dessiner(); this.vue.afficher(); this.majChat(); this.dessinerFile(); this.dessinerSync(); this.dessinerAlertes(); }

  // « Nouvelle conversation » : seulement dans le chat général, quand il a un fil et qu'il ne travaille pas.
  majNouvelle(id = this.porteeChat().id) {
    const b = this.q(".chat-nouvelle");
    const ch = this.chats.get("general");
    b.hidden = !(id === "general" && ch && ch.messages.size > 0 && ch.etat !== "en_cours");
  }

  // ---------- Alertes (lot 12) : place libre, connexion au compte Claude ----------
  dessinerAlertes() {
    const z = this.q(".alertes-studio");
    const liste = this.alertes || [];
    z.hidden = !liste.length;
    z.replaceChildren(...liste.map((a) => {
      const action = a.action === "archiver" ? el("button", { class: "bouton bouton-petit", type: "button" }, "Faire de la place") : null;
      action?.addEventListener("click", async () => {
        action.disabled = true; action.textContent = "Je fais de la place…";
        try {
          const r = await this.api.archiver();
          annoncer(r.disque_absent ? "Ton disque externe n'est pas branché : branche-le, puis réessaie."
            : r.archives ? `C'est fait : ${pluriel(r.archives, "vidéo rangée", "vidéos rangées")} sur ton disque externe.`
              : "Rien à ranger pour l'instant : aucun contenu publié n'a encore ses vidéos de tournage sur ton Mac.");
        } catch (e) { annoncer(e.message, "erreur"); }
        finally { action.disabled = false; action.textContent = "Faire de la place"; }
      });
      return el("div", { class: `bandeau-alerte bandeau-${a.genre}`, role: a.genre === "critique" ? "alert" : "status" },
        el("span", { html: icone("attention") }), el("p", {}, a.texte), action);
    }));
  }

  evenement(type, d) {
    if (type === "carte") {
      this.cartes.set(cle(d), d);
      this.arbre.dessiner(); this.vue.carteChangee(d);
      if (this.sel.genre === "dossier" && this.sel.cle === cle(d)) this.majChat();
      if (this.sel.genre !== "dossier") this.vue.transverseChangee();
    } else if (type === "carte_retiree") {
      const k = d.slug || `p:${d.proposition_id}`;
      this.cartes.delete(k);
      if (this.sel.genre === "dossier" && this.sel.cle === k && !this.sel.attendGarde) this.selectionner({ genre: "accueil" });
      else { this.arbre.dessiner(); this.vue.transverseChangee(); }
    } else if (type === "chat") {
      this.chats.get(d.chat_id)?.recevoir(d.message, d.partiel);
      if (d.chat_id === "general") this.majNouvelle();
    } else if (type === "chat_reinitialise") { this.chats.get(d.chat_id)?.charger(); }
    else if (type === "alertes") { this.alertes = d.alertes || []; this.dessinerAlertes(); }
    else if (type === "file") { this.file = d.actions || []; this.filePause = d.pause || null; this.dessinerFile(); }
    else if (type === "a_ranger") { this.a_ranger = d.fichiers || []; this.arbre.dessiner(); this.vue.transverseChangee(); }
    else if (type === "sync") { this.sync = syncHonnete(d); this.dessinerSync(); }
    else if (type === "tournages") { this.tournages = d.tournages || []; this.arbre.dessiner(); this.vue.transverseChangee(); }
    else if (type === "stats") { this.stats = d; if (this.sel.genre === "accueil") this.vue.transverseChangee(); }
  }

  // ---------- Sélection (et adresse de la page, pour retrouver où on était) ----------
  selectionner(sel, { ouvrir = true } = {}) {
    if (sel.genre === "dossier") {
      const c = this.cartes.get(sel.cle);
      if (!c && !sel.attendGarde) sel = { genre: "accueil" };
      else if (c) {
        if (!sel.fichier || !(c.fichiers || ["idee"]).includes(sel.fichier)) sel.fichier = fichierParDefaut(c);
        if (ouvrir) this.ouverts.add(sel.cle);
      }
    }
    this.sel = sel;
    const h = sel.genre === "dossier" ? `#/d/${encodeURIComponent(sel.cle)}/${sel.fichier || ""}` : sel.genre === "transverse" ? `#/t/${sel.quoi}${sel.id ? `/${encodeURIComponent(sel.id)}` : ""}` : "#/";
    if (location.hash !== h) history.replaceState(null, "", h);
    this.arbre.dessiner(); this.vue.afficher(); this.majChat();
  }

  lireAdresse() {
    const m = /^#\/(d|t)\/([^/]+)(?:\/([^/]*))?$/.exec(location.hash);
    let sel = { genre: "accueil" };
    if (m && m[1] === "d") sel = { genre: "dossier", cle: decodeURIComponent(m[2]), fichier: m[3] || null };
    if (m && m[1] === "t") sel = { genre: "transverse", quoi: m[2], id: m[3] ? decodeURIComponent(m[3]) : null };
    const avant = JSON.stringify(this.sel);
    this.sel = sel;
    if (sel.genre === "dossier") this.ouverts.add(sel.cle);
    return avant !== JSON.stringify(sel);
  }

  carteSel() { return this.sel.genre === "dossier" ? this.cartes.get(this.sel.cle) || null : null; }

  // ---------- Le chat de droite : sa portée suit la sélection ----------
  porteeChat() {
    const c = this.carteSel();
    if (!c || !c.slug) {
      return { id: "general", portee: "Chat général", ico: "bulle", titre: "Ton studio",
        sous: "Demande des idées, pose une question sur tout, raconte ta semaine.",
        invite: "Par exemple : fais-moi 10 idées", vide: `Ce que tu demandes ici arrive dans tes dossiers ${ouArbre()}.`,
        note: c ? "Cette idée n'a pas encore de dossier à elle : garde-la pour en parler seule. Ici, tu parles à tout ton studio." : null };
    }
    if (this.sel.fichier === "montage") {
      return { id: `${c.slug}:monteur`, portee: "Ton monteur", ico: "ciseaux", titre: c.titre, monteur: true,
        sous: "Ce qui va ou pas dans le montage de cette vidéo.", invite: "Par exemple : la 4 plus courte",
        vide: "Je monte ta vidéo quand tu cliques « Envoyer au montage ». Tu peux aussi me dire ici ce que tu veux avant." };
    }
    return { id: `${c.slug}:hoc`, portee: "Chat de ce contenu", ico: "dossier", titre: c.titre,
      sous: "Ton texte, ta légende, tes questions sur ce contenu seulement.",
      invite: "Écris ou dicte ici", vide: "Demande le brief, une autre accroche, une légende plus courte..." };
  }

  majChat() {
    const p = this.porteeChat();
    const portee = this.q(".chat-portee");
    portee.className = `chat-portee${p.monteur ? " monteur" : ""}`;
    portee.innerHTML = `${icone(p.ico)}<span></span>`;
    portee.querySelector("span").textContent = p.portee;
    this.q("#chat-titre").textContent = p.titre;
    this.q(".chat-sous").textContent = p.sous;
    let ch = this.chats.get(p.id);
    if (!ch) {
      ch = new Chat({ api: this.api, chatId: p.id, vide: p.vide, invite: p.invite, onEtat: () => this.majNouvelle() });
      this.chats.set(p.id, ch);
      ch.charger();
    }
    this.majNouvelle(p.id);
    const zone = this.q(".chat-zone");
    const extra = [];
    if (p.note) extra.push(el("p", { class: "chat-note" }, p.note));
    const d = this.vue.detail;
    if (p.monteur && d && d.slug === this.carteSel()?.slug && d.stade === "planche" && d.medias?.apercu) {
      extra.push(el("div", { class: "chat-planche" },
        el("span", {}, el("strong", {}, ETROIT.matches ? "Ton aperçu est plus haut. " : "Ton aperçu est à gauche. "), "Les notes que tu y écris arrivent ici, et ton monteur te répond ici.")));
    }
    // Le chat ne bouge pas de la page quand seuls les à-côtés changent (une carte qui avance, un
    // message qui part) : le déplacer le renvoyait tout en haut et faisait perdre la saisie en cours.
    let pile = zone.firstElementChild;
    if (!pile?.classList.contains("chat-pile") || pile.lastElementChild !== ch.racine) {
      pile = el("div", { class: "chat-pile" }, ch.racine);
      zone.replaceChildren(pile);
      ch.rattache();
    }
    while (pile.firstChild && pile.firstChild !== ch.racine) pile.firstChild.remove();
    for (const x of extra) pile.insertBefore(x, ch.racine);
    this.chatActif = ch;
  }

  // ---------- Lancer une action (un dossier, ou plusieurs choisis dans la vue concernée) ----------
  async lancer(type, slugs) {
    try {
      await this.api.lancer(type, slugs);
      annoncer(type === "tournage" ? "Je fais ton plan de tournage : il arrive dans « Tournages » dans quelques minutes." : slugs.length > 1
        ? `C'est lancé : ${pluriel(slugs.length, NOMS_ACTION[type][0], NOMS_ACTION[type][1])}, l'un après l'autre.` : "C'est lancé.");
    } catch (e) { annoncer(e.message, "erreur"); throw e; }
  }

  // ---------- File des actions ----------
  dessinerFile() {
    const b = this.q("#file-bouton"); const texte = b.querySelector(".file-texte");
    const actives = this.file.filter((a) => ["en_cours", "en_file", "a_toi", "erreur"].includes(a.statut));
    const pause = this.filePause;
    b.hidden = !actives.length && !pause;
    if (!actives.length) { this.q("#file-liste").hidden = true; return; }
    const cours = actives.filter((a) => a.statut === "en_cours");
    const parType = {};
    for (const a of cours) parType[a.type] = (parType[a.type] || 0) + 1;
    const morceaux = Object.entries(parType).map(([t, n]) => `${pluriel(n, NOMS_ACTION[t]?.[0] || "action", NOMS_ACTION[t]?.[1] || "actions")} en cours`);
    const attente = actives.filter((a) => a.statut === "en_file").length;
    if (attente) morceaux.push(`${attente} en attente`);
    const atoi = actives.filter((a) => a.statut === "a_toi").length;
    if (atoi) morceaux.push(`${atoi} attend${atoi > 1 ? "ent" : ""} ta réponse`);
    const err = actives.filter((a) => a.statut === "erreur").length;
    if (err) morceaux.push(`${err} en souci`);
    // En pause (limite de l'abonnement, compte déconnecté) : c'est la première chose à dire.
    if (pause) morceaux.unshift(pause.motif === "limite" ? "En pause jusqu'à la reprise de ton abonnement" : "En pause : compte Claude déconnecté");
    texte.textContent = morceaux.join(", ");
    b.classList.toggle("en-pause", Boolean(pause));
    b.classList.toggle("travaille", cours.length > 0);
    const liste = this.q("#file-liste");
    if (liste.hidden) return;
    const SANS_CONTENU = { rangement: "tes vidéos", archivage: "ton disque externe", publication: "ta publication" };
    const titre = (a) => (a.slugs || [a.slug]).filter(Boolean).map((s) => this.cartes.get(s)?.titre || "un contenu").join(", ") || SANS_CONTENU[a.type] || "le chat";
    const STATUT = { en_cours: "en cours", en_file: "en attente", a_toi: "attend ta réponse", erreur: "souci" };
    const bouton = (texteB, faire) => {
      const x = el("button", { class: "bouton bouton-discret bouton-petit", type: "button" }, texteB);
      x.addEventListener("click", async (e) => { e.stopPropagation(); x.disabled = true; try { await faire(); } catch (err) { annoncer(err.message, "erreur"); x.disabled = false; } });
      return x;
    };
    // Relancer : seulement un travail fait par Claude (script, plan de tournage, montage, mise en page) ; les autres
    // se relancent depuis leur bouton, dans le dossier du contenu.
    const RELANCABLES = new Set(["script", "tournage", "montage", "mise_en_page"]);
    liste.replaceChildren(el("p", { class: "file-tete" }, "Ce qui tourne"),
      ...(pause ? [el("p", { class: "file-pause" }, pause.phrase)] : []),
      ...actives.map((a) => {
        let boutons = null;
        if (["en_cours", "en_file"].includes(a.statut)) boutons = bouton(a.statut === "en_file" ? "Retirer" : "Arrêter", () => this.api.arreterAction(a.id));
        else if (a.statut === "erreur") {
          boutons = el("div", { class: "file-boutons" },
            RELANCABLES.has(a.type) ? bouton("Relancer", () => this.api.relancerAction(a.id)) : null,
            bouton("Effacer", () => this.api.effacerAction(a.id)));
        }
        const statut = a.statut === "erreur" && a.erreur ? a.erreur
          : a.statut === "en_file" && pause?.motif === "limite" ? "en pause, reprend tout seul"
            : a.statut === "en_file" && pause ? "en pause, en attente de la connexion" : STATUT[a.statut];
        return el("div", { class: `file-ligne file-${a.statut}` },
          el("div", {}, el("p", { class: "file-quoi" }, `${(NOMS_ACTION[a.type]?.[0] || "action").replace(/^./, (x) => x.toUpperCase())} : ${titre(a)}`),
            el("p", { class: "file-statut" }, statut)),
          boutons);
      }));
  }

  // ---------- Synchro ----------
  dessinerSync() {
    const z = this.q(".sync");
    let ico = "synchro", texte, genre = "ok";
    if (this.connexion === "coupe") { texte = "reconnexion…"; genre = "reconnexion"; }
    else if (!this.sync) { texte = ""; }
    else if (this.sync.etat === "en_cours") { texte = "Mise à jour"; genre = "cours"; }
    else if (this.sync.etat === "hors_ligne") { texte = this.sync.message || "Pas d'internet : tes changements partiront au retour"; genre = "coupe"; ico = "horsligne"; }
    else if (this.sync.etat === "conflit") { texte = this.sync.message || `Un changement fait ailleurs coince. ${CONTACT_SOI ? "Il faut le raccorder à la main." : `Préviens ${CONTACT}.`}`; genre = "conflit"; ico = "attention"; }
    else texte = `À jour, ${ilYa(this.sync.derniere)}`;
    z.className = `sync sync-${genre}`;
    z.innerHTML = texte ? `${icone(ico)}<span>${texte}</span>` : "";
  }

  // ---------- Maquette : mises en scène pour les captures (?maquette=1&demo=...) ----------
  scenarioMaquette() {
    const demo = params.get("demo");
    if (demo === "stream" && this.sel.genre === "dossier") setTimeout(() => this.api._demoRepondre(this.porteeChat().id, "plus court, et je le fais au salon"), 400);
    if (demo === "edition") setTimeout(() => document.querySelector(".bloc-texte .bouton-modifier")?.click(), 500);
    if (demo === "recap") setTimeout(() => { for (const x of document.querySelectorAll(".pub-choix input")) x.click(); document.querySelector(".pub-groupe")?.click(); }, 500);
    if (demo === "envoi") setTimeout(() => document.querySelector(".prise-envoi input")?.click(), 700);
    if (demo === "supprimer") setTimeout(() => [...document.querySelectorAll(".choix-idee button")].find((b) => /Supprimer/.test(b.textContent))?.click(), 600);
    if (demo === "nouvelles") setTimeout(() => this.api._demoNouvellesIdees(), 600);
    if (demo === "tournage") setTimeout(() => this.selectionner({ genre: "transverse", quoi: "tournage", slugs: ["pompes-sur-les-genoux", "squat-ou-vont-tes-genoux"] }), 300);
  }
}

// ---------- Lancement ----------
async function lancer() {
  const api = MAQUETTE ? (await import("./maquette.js")).creerApiMaquette() : creerApiServeur();
  if (MAQUETTE) document.documentElement.classList.add("maquette");
  const studio = new Studio(api);
  window.studio = studio;
  studio.demarrer();
}
lancer();
