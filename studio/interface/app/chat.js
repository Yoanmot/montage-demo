// Un fil de discussion (chat général ou chat d'une carte), relayé au fil de l'eau.

import { el, markdown, icone, annoncer, heure, previens } from "./outils.js";

// Fichiers joints (22/11/2026) : le trombone ou un glisser-déposer sur le chat. Chaque fichier part au studio dès qu'il
// est choisi (pastille avec sa progression), puis le message emporte leurs identifiants. Les mêmes refus que le studio,
// dits avant d'envoyer quoi que ce soit.
const JOINT_MAX = 20 * 1024 ** 2;
const JOINTS_MAX = 10;
const VIDEOS = [".mov", ".mp4", ".m4v", ".hevc", ".avi", ".mkv", ".webm", ".mts", ".m2ts", ".3gp", ".mpg", ".mpeg", ".wmv", ".flv"];
const IMAGES_VUES = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"];
const extDe = (nom) => { const i = nom.lastIndexOf("."); return i > 0 ? nom.slice(i).toLowerCase() : ""; };
const poids = (o) => (o >= 1e6 ? `${(o / 1e6).toLocaleString("fr-CH", { maximumFractionDigits: 1 })} Mo` : `${Math.max(1, Math.round(o / 1e3))} Ko`);

// Espaces insécables du français (lot 13) : « Idées proposées » ne se coupe plus avant le guillemet,
// ni avant : ? ! ;, dans une colonne étroite.
const insecables = (t) => String(t ?? "").replace(/« /g, "«\u00a0").replace(/ ([»:;?!])/g, "\u00a0$1");

// La ligne d'état sous le dernier message. Une erreur porte sa propre phrase (m.texte, écrite par le serveur : limite
// de l'abonnement avec l'heure de reprise, Claude surchargé, pas d'internet, compte déconnecté) ; la phrase fixe
// ne sert que de repli (lot 12 : avant, la phrase du serveur n'était jamais affichée).
const LIGNES_ETAT = {
  fini: "C'est fait.",
  arrete: "Tu as arrêté. Écris quand tu veux reprendre.",
  coupe: "Le studio a redémarré pendant que je travaillais. Écris « continue » pour que je reprenne.",
  erreur: `Ça a coincé. Réessaie, et si ça recommence, ${previens()}.`,
};

export class Chat {
  constructor({ api, chatId, vide, invite, onEtat }) {
    this.api = api; this.chatId = chatId; this.onEtat = onEtat;
    this.messages = new Map(); // n -> { message, noeud }
    this.etat = null;
    this.racine = el("section", { class: "chat", "aria-label": "Discussion" });
    this.fil = el("div", { class: "chat-fil", role: "log", "aria-live": "polite" });
    this.videNoeud = el("div", { class: "chat-vide" }, vide || "Écris ce que tu veux, comme à quelqu'un de ton équipe.");
    this.fil.append(this.videNoeud);
    this.ecrit = el("div", { class: "chat-ecrit", hidden: true }, el("span", { class: "points", "aria-hidden": "true" }, el("i"), el("i"), el("i")), el("span", { texte: "en train de travailler" }));
    this.bandeau = el("div", { class: "chat-a-toi", hidden: true, role: "status" }, el("strong", { texte: "À toi de répondre." }), el("span", { texte: " Écris ou dicte ta réponse juste en dessous." }));
    this.champ = el("textarea", { class: "chat-champ", rows: "1", placeholder: invite || "Écris ou dicte ici", "aria-label": "Ton message" });
    this.bouton = el("button", { class: "bouton bouton-plein chat-envoyer", type: "button", html: `${icone("envoyer")}<span>Envoyer</span>` });
    this.stop = el("button", { class: "bouton chat-stop", type: "button", hidden: true, html: `${icone("arreter")}<span>Arrêter</span>` });
    const aide = el("p", { class: "chat-aide" }, "Entrée envoie, Maj + Entrée va à la ligne. Pour dicter, appuie deux fois sur la touche fn.");
    this.joints = []; // { f, apercu, etat: "envoi"|"pret"|"erreur", n, id, message, tache }
    this.entreeJoints = el("input", { type: "file", multiple: true, class: "visuel-cache", tabindex: "-1", "aria-hidden": "true" });
    this.entreeJoints.addEventListener("change", () => { this.joindre([...this.entreeJoints.files]); this.entreeJoints.value = ""; });
    this.trombone = el("button", { class: "bouton-icone chat-joindre", type: "button", title: "Joindre un fichier", "aria-label": "Joindre un fichier", html: icone("trombone") });
    this.trombone.addEventListener("click", () => this.entreeJoints.click());
    this.pastilles = el("ul", { class: "pj-pastilles", hidden: true, "aria-label": "Fichiers joints" });
    const zone = el("div", { class: "chat-saisie" }, this.bandeau, this.pastilles,
      el("div", { class: "chat-ligne" }, this.trombone, this.entreeJoints, this.champ, this.bouton, this.stop), aide);
    // « Nouveaux messages » : seulement quand on est remonté lire plus haut et que quelque chose arrive.
    this.nouveaux = el("button", { class: "chat-nouveaux", type: "button", hidden: true, html: `<span>Nouveaux messages</span>${icone("bas")}` });
    this.nouveaux.addEventListener("click", () => { this._collé = true; this.basDeFil(true, true); });
    const cadre = el("div", { class: "chat-cadre" }, this.fil, this.nouveaux);
    this.racine.append(cadre, this.ecrit, zone);

    // Défilement comme une messagerie : collé en bas tant qu'on y est (on y est au départ), libre dès
    // qu'on remonte. Seul un défilement fait par la personne change ce choix ; tout ce qui fait grandir
    // le fil (message, réponse en cours, étape, bandeau, zone de saisie) le recolle en bas s'il l'était.
    this._collé = true; this._pos = 0;
    this.fil.addEventListener("scroll", () => {
      if (!this.fil.isConnected || !this.fil.clientHeight) return;
      this._collé = this.enBas(); this._pos = this.fil.scrollTop;
      if (this._collé) this.nouveaux.hidden = true;
    }, { passive: true });
    const recoller = () => { if (this._collé && this.fil.isConnected) this.basDeFil(true); };
    this._obs = new MutationObserver(() => {
      if (!this.fil.isConnected) return;
      if (this._collé) this.basDeFil(true);
      else if (this.messages.size && !this.enBas()) this.nouveaux.hidden = false;
    });
    this._obs.observe(this.fil, { childList: true, subtree: true, characterData: true });
    if (typeof ResizeObserver === "function") new ResizeObserver(recoller).observe(this.fil);

    this.champ.addEventListener("input", () => this.ajuster());
    this.champ.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); this.envoyer(); }
    });
    this.bouton.addEventListener("click", () => this.envoyer());
    this.stop.addEventListener("click", () => this.arreter());

    // Glisser un fichier du Mac n'importe où sur le chat.
    const fichiers = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
    this.racine.addEventListener("dragover", (e) => { if (!fichiers(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; this.racine.classList.add("pj-survol"); });
    this.racine.addEventListener("dragleave", (e) => { if (!this.racine.contains(e.relatedTarget)) this.racine.classList.remove("pj-survol"); });
    this.racine.addEventListener("drop", (e) => {
      this.racine.classList.remove("pj-survol");
      if (!fichiers(e)) return;
      e.preventDefault();
      this.joindre([...e.dataTransfer.files]);
    });
  }

  // ---------- Fichiers joints ----------
  joindre(fichiers) {
    for (const f of fichiers) {
      if (this.joints.length >= JOINTS_MAX) { annoncer(`Tu peux joindre ${JOINTS_MAX} fichiers au plus par message.`, "erreur"); break; }
      const ext = extDe(f.name);
      const refus = VIDEOS.includes(ext)
        ? `Une vidéo ne passe pas par le chat : ajoute-la dans ta Galerie${/:(hoc|monteur)$/.test(this.chatId) ? ", ou dans Montage pour ce contenu" : ""}, puis dis-moi ici ce que tu veux en faire.`
        : f.size > JOINT_MAX ? "Trop lourd pour le chat : 20 Mo au plus." : f.size === 0 ? "Ce fichier est vide." : null;
      const j = { f, apercu: IMAGES_VUES.includes(ext) && !refus ? URL.createObjectURL(f) : null, etat: refus ? "erreur" : "envoi", n: 0, id: null, message: refus };
      this.joints.push(j);
      if (!refus) this.envoyerJoint(j);
    }
    this.dessinerJoints();
  }

  envoyerJoint(j) {
    j.tache = this.api.envoyerJoint(this.chatId, j.f, (n) => {
      j.n = n;
      const li = this.pastilles.children[this.joints.indexOf(j)];
      const p = li?.querySelector("progress");
      if (p) p.value = n;
    });
    j.tache.fin.then((r) => { j.id = r.id; j.etat = "pret"; }, (e) => { j.etat = "erreur"; j.message = e.code === "ARRETE" ? null : e.message; })
      .finally(() => this.dessinerJoints());
  }

  retirerJoint(j) {
    const i = this.joints.indexOf(j);
    if (i < 0) return;
    this.joints.splice(i, 1);
    if (j.etat === "envoi") j.tache?.arreter();
    if (j.id) this.api.retirerJoint(this.chatId, j.id).catch(() => {});
    if (j.apercu) URL.revokeObjectURL(j.apercu);
    this.dessinerJoints();
    this.champ.focus();
  }

  viderJoints() {
    for (const j of this.joints) if (j.apercu) URL.revokeObjectURL(j.apercu);
    this.joints = [];
    this.dessinerJoints();
  }

  dessinerJoints() {
    this.pastilles.hidden = !this.joints.length;
    this.pastilles.replaceChildren(...this.joints.map((j) => {
      const vignette = j.apercu
        ? el("img", { class: "pj-vignette", src: j.apercu, alt: "", width: "36", height: "36" })
        : el("span", { class: "pj-vignette pj-icone", html: icone("brief") });
      const etat = j.etat === "envoi"
        ? el("progress", { class: "pj-progres", max: "100", value: String(j.n), "aria-label": `Envoi de ${j.f.name}` })
        : j.etat === "erreur" ? el("span", { class: "pj-erreur" }, j.message || "Pas joint.")
          : el("span", { class: "pj-poids" }, poids(j.f.size));
      const croix = el("button", { class: "bouton-icone pj-retirer", type: "button", "aria-label": `Retirer ${j.f.name}`, title: "Retirer", html: icone("croix") });
      croix.addEventListener("click", () => this.retirerJoint(j));
      return el("li", { class: `pj-pastille pj-etat-${j.etat}` }, vignette, el("span", { class: "pj-texte" }, el("span", { class: "pj-nom", title: j.f.name }, j.f.name), etat), croix);
    }));
  }

  // Une image jointe en grand (même boîte que « Autres fichiers »).
  agrandirJoint(url, nom, retour) {
    const fermer = el("button", { class: "bouton bouton-petit", type: "button", html: `${icone("fermer")}<span>Fermer</span>` });
    const boite = el("dialog", { class: "af-boite", "aria-labelledby": "pj-grand-nom" },
      el("div", { class: "af-boite-tete" }, el("p", { class: "af-grand-nom", id: "pj-grand-nom" }, nom), fermer),
      el("div", { class: "af-boite-image" }, el("img", { class: "af-grande", src: url, alt: nom })));
    fermer.addEventListener("click", () => boite.close());
    boite.addEventListener("click", (e) => { if (e.target === boite) boite.close(); });
    // Échap ferme la boîte seulement : sans ça, le studio reviendrait aussi à l'accueil.
    boite.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); boite.close(); } });
    boite.addEventListener("close", () => { boite.remove(); retour?.focus(); });
    document.body.append(boite);
    boite.showModal();
    fermer.focus();
  }

  jointsDuMessage(m) {
    if (!m.joints?.length) return null;
    return el("ul", { class: "pj-msg", "aria-label": "Fichiers joints" }, ...m.joints.map((j) => {
      if (j.genre === "image") {
        const url = this.api.urlJoint(this.chatId, j.fichier);
        const b = el("button", { class: "pj-msg-image", type: "button", "aria-label": `Voir ${j.fichier} en grand` },
          el("img", { src: url, alt: "", loading: "lazy", decoding: "async" }));
        b.addEventListener("click", () => this.agrandirJoint(url, j.fichier, b));
        return el("li", {}, b);
      }
      return el("li", { class: "pj-msg-fichier" }, el("span", { class: "pj-msg-ico", html: icone("brief") }), el("span", { class: "pj-msg-nom" }, j.fichier));
    }));
  }

  ajuster() { this.champ.style.height = "auto"; this.champ.style.height = Math.min(this.champ.scrollHeight, 200) + "px"; }

  async charger() {
    this.fil.classList.add("charge");
    try {
      const r = await this.api.chat(this.chatId);
      this.fil.querySelectorAll(".msg").forEach((n) => n.remove());
      this.messages.clear();
      for (const m of r.messages || []) this.recevoir(m, false, true);
      this.videNoeud.hidden = this.messages.size > 0;
      this.poserEtat(r.etat ?? null);
      if (this._collé) this.basDeFil(true); else this.fil.scrollTop = this._pos;
      this._obs.takeRecords(); // un rechargement n'est pas un nouveau message
    } catch (e) { annoncer(e.message, "erreur"); }
    finally { this.fil.classList.remove("charge"); }
  }

  enBas() { return this.fil.scrollHeight - this.fil.scrollTop - this.fil.clientHeight < 60; }
  basDeFil(force, doux) {
    if (!force && !this._collé) return;
    this.nouveaux.hidden = true;
    if (doux) { this.fil.scrollTo({ top: this.fil.scrollHeight, behavior: "smooth" }); return; }
    this.fil.scrollTop = this.fil.scrollHeight; this._pos = this.fil.scrollTop;
  }

  // Le fil vient d'être (re)mis dans la page (changement de dossier, chat redessiné) : un élément qui
  // défile revient en haut quand on le déplace ; on remet la position d'avant, ou le bas s'il y était.
  rattache() {
    if (this._collé) this.basDeFil(true); else this.fil.scrollTop = this._pos;
  }

  recevoir(m, partiel, silencieux) {
    if (m.type === "etat") { this.poserEtat(m.etat); if (!LIGNES_ETAT[m.etat]) return; }
    const exist = this.messages.get(m.n);
    const noeud = this.dessiner(m, partiel);
    if (exist) exist.noeud.replaceWith(noeud); else this.fil.append(noeud);
    this.messages.set(m.n, { message: m, noeud });
    this.videNoeud.hidden = this.messages.size > 0;
    if (m.type === "texte" && m.role === "studio" && this.etat !== "en_cours" && partiel) this.poserEtat("en_cours");
    if (!silencieux && this._collé) this.basDeFil(true);
  }

  dessiner(m, partiel) {
    if (m.type === "activite") return el("div", { class: "msg msg-activite" }, el("span", { class: "trait", "aria-hidden": "true" }), m.texte);
    if (m.type === "etat") {
      const texte = m.etat === "erreur" && m.texte ? m.texte : LIGNES_ETAT[m.etat];
      return el("div", { class: `msg msg-etat msg-etat-${m.etat}${m.motif ? ` msg-motif-${m.motif}` : ""}` }, insecables(texte));
    }
    if (m.role === "romain") {
      return el("div", { class: "msg msg-romain" }, m.texte ? el("div", { class: "bulle", texte: insecables(m.texte) }) : null,
        this.jointsDuMessage(m), m.le ? el("time", { texte: heure(m.le) }) : null);
    }
    const n = el("div", { class: `msg msg-studio${partiel ? " partiel" : ""}`, html: markdown(insecables(m.texte)) });
    return n;
  }

  poserEtat(etat) {
    this.etat = etat || null;
    const enCours = this.etat === "en_cours";
    this.ecrit.hidden = !enCours;
    this.bandeau.hidden = this.etat !== "a_toi";
    this.racine.classList.toggle("attend", this.etat === "a_toi");
    this.stop.hidden = !enCours; this.bouton.hidden = enCours;
    this.onEtat?.(this.etat);
  }

  async envoyer() {
    const texte = this.champ.value.trim();
    // Rien d'écrit : le clic sur « Envoyer » met le curseur dans le champ, au lieu de ne rien faire.
    if (!texte && !this.joints.length) { this.champ.focus(); return; }
    if (this.etat === "en_cours" || this.bouton.disabled) return;
    this.bouton.disabled = true;
    try {
      // Un fichier encore en route : on attend la fin de son envoi.
      await Promise.all(this.joints.filter((j) => j.etat === "envoi").map((j) => j.tache.fin.catch(() => {})));
      if (this.joints.some((j) => j.etat === "erreur")) { annoncer("Un fichier n'a pas pu être joint : retire-le, puis envoie ton message.", "erreur"); return; }
      const joints = this.joints.map((j) => j.id);
      this.champ.value = ""; this.ajuster();
      this._collé = true; this.basDeFil(true);
      try {
        await this.api.envoyer(this.chatId, texte, joints);
        this.viderJoints();
        this.poserEtat("en_cours"); this._collé = true; this.basDeFil(true);
      } catch (e) { this.champ.value = texte; this.ajuster(); annoncer(e.message, "erreur"); }
    } finally { this.bouton.disabled = false; }
  }

  async arreter() {
    this.stop.disabled = true;
    try { await this.api.arreterChat(this.chatId); } catch (e) { annoncer(e.message, "erreur"); }
    finally { this.stop.disabled = false; }
  }

  focus() { this.champ.focus(); }
}
