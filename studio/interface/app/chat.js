// Un fil de discussion (chat général ou chat d'une carte), relayé au fil de l'eau.

import { el, markdown, icone, annoncer, heure } from "./outils.js";

// Espaces insécables du français (lot 13) : « Idées proposées » ne se coupe plus avant le guillemet,
// ni avant : ? ! ;, dans une colonne étroite.
const insecables = (t) => String(t ?? "").replace(/« /g, "«\u00a0").replace(/ ([»:;?!])/g, "\u00a0$1");

const LIGNES_ETAT = {
  fini: "C'est fait.",
  arrete: "Tu as arrêté. Écris quand tu veux reprendre.",
  erreur: "Ça a coincé. Réessaie, et si ça recommence, préviens Yoan.",
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
    const zone = el("div", { class: "chat-saisie" }, this.bandeau, el("div", { class: "chat-ligne" }, this.champ, this.bouton, this.stop), aide);
    this.racine.append(this.fil, this.ecrit, zone);

    this.champ.addEventListener("input", () => this.ajuster());
    this.champ.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); this.envoyer(); }
    });
    this.bouton.addEventListener("click", () => this.envoyer());
    this.stop.addEventListener("click", () => this.arreter());
  }

  ajuster() { this.champ.style.height = "auto"; this.champ.style.height = Math.min(this.champ.scrollHeight, 200) + "px"; }

  async charger() {
    this.fil.classList.add("charge");
    try {
      const r = await this.api.chat(this.chatId);
      this.fil.querySelectorAll(".msg").forEach((n) => n.remove());
      this.messages.clear();
      for (const m of r.messages || []) this.recevoir(m, false, true);
      this.poserEtat(r.etat ?? this.etat);
      this.basDeFil(true);
    } catch (e) { annoncer(e.message, "erreur"); }
    finally { this.fil.classList.remove("charge"); }
  }

  enBas() { return this.fil.scrollHeight - this.fil.scrollTop - this.fil.clientHeight < 60; }
  basDeFil(force) { if (force || this._collé) this.fil.scrollTop = this.fil.scrollHeight; }

  recevoir(m, partiel, silencieux) {
    this._collé = this.enBas();
    if (m.type === "etat") { this.poserEtat(m.etat); if (!LIGNES_ETAT[m.etat]) return; }
    const exist = this.messages.get(m.n);
    const noeud = this.dessiner(m, partiel);
    if (exist) exist.noeud.replaceWith(noeud); else this.fil.append(noeud);
    this.messages.set(m.n, { message: m, noeud });
    this.videNoeud.hidden = this.messages.size > 0;
    if (m.type === "texte" && m.role === "studio" && this.etat !== "en_cours" && partiel) this.poserEtat("en_cours");
    if (!silencieux) this.basDeFil();
  }

  dessiner(m, partiel) {
    if (m.type === "activite") return el("div", { class: "msg msg-activite" }, el("span", { class: "trait", "aria-hidden": "true" }), m.texte);
    if (m.type === "etat") return el("div", { class: `msg msg-etat msg-etat-${m.etat}` }, LIGNES_ETAT[m.etat]);
    if (m.role === "romain") return el("div", { class: "msg msg-romain" }, el("div", { class: "bulle", texte: insecables(m.texte) }), m.le ? el("time", { texte: heure(m.le) }) : null);
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
    if (!texte || this.etat === "en_cours") return;
    this.champ.value = ""; this.ajuster();
    this.bouton.disabled = true;
    try { await this.api.envoyer(this.chatId, texte); this.poserEtat("en_cours"); this._collé = true; }
    catch (e) { this.champ.value = texte; this.ajuster(); annoncer(e.message, "erreur"); }
    finally { this.bouton.disabled = false; }
  }

  async arreter() {
    this.stop.disabled = true;
    try { await this.api.arreterChat(this.chatId); } catch (e) { annoncer(e.message, "erreur"); }
    finally { this.stop.disabled = false; }
  }

  focus() { this.champ.focus(); }
}
