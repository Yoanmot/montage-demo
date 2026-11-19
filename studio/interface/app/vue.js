// Le fichier ouvert, au milieu (lot 9) : Idée, Brief, Montage, Vidéo montée ou Images d'un dossier,
// ou une vue d'ensemble (chiffres, publier sur Instagram, tournages, à ranger). En plein, jamais en
// fenêtre par-dessus. Ce qui s'affiche vient du serveur (fichiers), jamais de la mémoire du modèle.

import { el, icone, annoncer, markdown, texteBrut, copier, quandLisible, jourCourt, dateCourte, dateEnJour, heure, aujourdhui, ajouterJours, prochainJourParDefaut, pluriel } from "./outils.js";
import { NOMS_FICHIERS, ICONES_FICHIERS, ACTIONS_LOT, cle, libre, fichierParDefaut, ouChat, ouArbre, titreTournage } from "./commun.js";
import { recapDans } from "./programmer.js";
import { morceauxDuTexte } from "./morceaux.js";
import { Apercu } from "./apercu.js";
import { barresSemaines, etapesFormat, nombreFr } from "./graphiques.js";
import { PERIODES, periode, resumer } from "./tableau.js";
import { comptesParFormat } from "./etapes.js";

// Réglages de cet écran retenus par ce Mac (la période du tableau de bord) : le navigateur seulement, rien d'écrit
// ailleurs ; sans stockage possible, la valeur par défaut.
const lireReglage = (k) => { try { return localStorage.getItem(`studio:${k}`); } catch { return null; } };
const ecrireReglage = (k, v) => { try { localStorage.setItem(`studio:${k}`, v); } catch { /* rien */ } };

const enCours = (c) => ["en_cours", "en_file"].includes(c?.activite);
const sansTitre = (md) => String(md || "").replace(/^#\s+.+\n+/, "").trim();
const ETATS_RESSOURCE = {
  erreur: { texte: "en erreur", groupe: "En erreur" },
  mise_a_jour: { texte: "mise à jour en cours", groupe: "Mise à jour en cours" },
  en_ligne: { texte: "en ligne", groupe: "En ligne" },
  injoignable: { texte: "pas vérifiable pour l'instant", groupe: "Pas vérifiable pour l'instant" },
  en_preparation: { texte: "en préparation", groupe: "En préparation" },
  sans_page: { texte: "sans page", groupe: "Sans page" },
};
const attente = (texte) => el("p", { class: "recap-charge" }, el("span", { class: "points", "aria-hidden": "true" }, el("i"), el("i"), el("i")), texte);

export class Vue {
  constructor(studio, racine) {
    this.studio = studio; this.api = studio.api; this.racine = racine;
    this.detail = null; this.edition = null; this.aRecharger = false; this._minuteur = null; this.jeton = 0;
  }

  // ---------- Afficher ce qui est sélectionné ----------
  async afficher() {
    const s = this.studio; const sel = s.sel;
    const jeton = ++this.jeton;
    this.edition = null; this.aRecharger = false;
    const garde = this.racine.scrollTop; const meme = this._dernier === JSON.stringify(sel);
    this._dernier = JSON.stringify(sel);
    if (this.apercu && (sel.genre !== "dossier" || s.carteSel()?.slug !== this.apercu.slug)) { this.apercu.detruire(); this.apercu = null; }
    if (sel.genre === "accueil") return this.poser(this.vueAccueil());
    if (sel.genre === "transverse") {
      if (sel.quoi === "ranger") return this.poser(this.vueRanger());
      if (sel.quoi === "tournage" && sel.id) {
        const vue = await this.vuePlan(jeton);
        if (jeton !== this.jeton) return undefined;
        this.poser(vue);
        if (meme) this.racine.scrollTop = garde;
        return undefined;
      }
      if (sel.quoi === "tournage") return this.poser(this.vueTournages());
      if (sel.quoi === "ressources" && this.studio.config.ressources) {
        if (!meme) this.poser(el("article", { class: "vue" }, ...this.entete("Ressources gratuites"), attente("Je regarde tes ressources")));
        const vue = await this.vueRessources(jeton, sel.id);
        if (jeton !== this.jeton) return undefined;
        this.poser(vue);
        if (meme) this.racine.scrollTop = garde;
        return undefined;
      }
      if (sel.quoi === "publier") return this.poser(this.vuePublier());
      return this.poser(this.vueAccueil());
    }
    const c = s.carteSel();
    if (!c) return this.poser(this.vueAccueil());
    if (!c.slug) { this.detail = null; return this.poser(this.vueProposition(c)); }
    if (!meme || this.detail?.slug !== c.slug) this.poser(this.cadre(c, sel.fichier, attente("J'ouvre le fichier")));
    let d;
    try { d = await this.api.carte(c.slug); }
    catch (e) { if (jeton === this.jeton) this.poser(this.cadre(c, sel.fichier, el("p", { class: "recap-erreur" }, e.message))); return; }
    if (jeton !== this.jeton) return;
    this.detail = d;
    const f = (d.fichiers || []).includes(sel.fichier) ? sel.fichier : fichierParDefaut(d);
    const corps = { idee: () => this.vueIdee(d), brief: () => this.vueBrief(d), montage: () => this.vueMontage(d),
      video: () => this.vueVideo(d), slides: () => this.vueSlides(d), ressource: () => this.vueFichierRessource(d, jeton) }[f]?.() || this.vueIdee(d);
    this.poser(this.cadre(d, f, corps));
    if (meme) this.racine.scrollTop = garde;
    if (f === "montage") s.majChat();
  }

  // Pose la vue. L'aperçu du montage reste en place s'il est déjà affiché (ses cadres ne se rechargent pas, la lecture
  // continue, une note en cours d'écriture est gardée) : tout ce qui l'entoure est remplacé autour de lui.
  poser(n) {
    const place = n.querySelector?.(".apercu-place");
    const vivant = this.apercu?.racine;
    if (place && vivant && this.racine.contains(vivant)) {
      const ancien = []; for (let x = vivant; x && x !== this.racine; x = x.parentNode) ancien.unshift(x);
      const neuf = []; for (let x = place; x; x = x.parentNode) { neuf.unshift(x); if (x === n) break; }
      if (ancien.length === neuf.length && neuf[0] === n) {
        for (let i = 0; i < ancien.length - 1; i++) {
          const a = ancien[i], b = neuf[i], suite = ancien[i + 1], suiteN = neuf[i + 1];
          for (const at of [...a.attributes]) if (!b.hasAttribute(at.name)) a.removeAttribute(at.name);
          for (const at of [...b.attributes]) a.setAttribute(at.name, at.value);
          for (const x of [...a.childNodes]) if (x !== suite) x.remove();
          const enfants = [...b.childNodes]; const k = enfants.indexOf(suiteN);
          suite.before(...enfants.slice(0, k)); suite.after(...enfants.slice(k + 1));
        }
        return;
      }
    }
    // Hors de l'aperçu : le lecteur s'arrête ; il est défait quand un autre dossier en ouvre un (hoteApercu) ou quand
    // on quitte ce dossier (afficher). Une vue d'attente passagère du même dossier le garde.
    if (!place && this.apercu) this.apercu.pause();
    if (place && vivant) place.replaceWith(vivant);
    this.racine.replaceChildren(n);
  }

  // Le lecteur de l'aperçu d'un montage : créé une fois par dossier, puis mis à jour (nouvel aperçu, notes, monteur
  // occupé) ; la vue reçoit une place que poser() remplace par le lecteur vivant.
  hoteApercu(d) {
    const a = d.medias.apercu;
    const etat = { occupe: enCours(d), ouChat: ouChat() };
    if (this.apercu?.slug === d.slug) {
      this.apercu.maj(a, etat);
      // Déjà affiché : une place, remplacée par le lecteur vivant. Sorti de la page (vue d'attente passagère) : il y
      // revient tel quel ; ses cadres se rechargent et se recalent d'eux-mêmes sur l'image courante.
      return this.racine.contains(this.apercu.racine) ? el("div", { class: "apercu-place", dataset: { slug: d.slug } }) : this.apercu.racine;
    }
    if (this.apercu) { this.apercu.detruire(); this.apercu = null; }
    const slug = d.slug;
    this.apercu = new Apercu({ slug, base: a.base, url: a.url, actions: {
      envoyerNote: async (note) => { await this.api.noteApercu(slug, note); this.afficher(); },
      fabriquer: async () => { await this.api.fabriquer(slug); annoncer("C'est parti : ton monteur fabrique la vidéo."); this.afficher(); },
    } });
    this.apercu.maj(a, etat);
    globalThis.__apercuStudio = this.apercu;   // pour les vérifications par le protocole de débogage de Chrome
    return this.apercu.racine;
  }

  // Le serveur dit qu'un dossier a changé : on recharge le fichier ouvert, sauf pendant une retouche.
  carteChangee(c) {
    const s = this.studio;
    if (s.sel.genre !== "dossier" || s.sel.cle !== cle(c)) return;
    if (this.edition) { this.aRecharger = true; return; }
    clearTimeout(this._minuteur);
    this._minuteur = setTimeout(() => this.afficher(), 250);
  }

  transverseChangee() {
    const s = this.studio;
    if (s.sel.genre === "dossier" || this.edition) return;
    // Les ressources se relisent par leurs outils (et l'aperçu se recharge) : seulement à l'ouverture et
    // après une action, pas à chaque mouvement d'un dossier.
    if (s.sel.quoi === "ressources") return;
    clearTimeout(this._minuteur);
    this._minuteur = setTimeout(() => this.afficher(), 250);
  }

  // ---------- Le cadre d'un fichier : chemin, titre, étiquettes, réglages ----------
  cadre(c, fichier, corps) {
    const s = this.studio;
    const chemin = el("nav", { class: "vue-chemin", "aria-label": "Où tu es" },
      el("button", { type: "button", onclick: () => s.selectionner({ genre: "accueil" }) }, "Studio"),
      el("span", { html: icone("fleche") }),
      el("button", { type: "button", onclick: () => s.selectionner({ genre: "dossier", cle: cle(c) }) }, c.titre.length > 48 ? `${c.titre.slice(0, 46)}…` : c.titre),
      el("span", { html: icone("fleche") }),
      el("span", { class: "courant" }, NOMS_FICHIERS[fichier] || "Idée"));
    const tags = el("div", { class: "vue-etiquettes" },
      el("span", { class: `tag tag-format f-${c.format}` }, el("span", { class: `pastille pastille-${c.format}`, "aria-hidden": "true" }), c.format === "reel" ? "Reel" : "Carrousel"),
      el("span", { class: "tag" }, c.stade === "proposee" ? "idée proposée" : c.stade === "de_cote" ? "mise de côté" : c.libelle),
      c.a_toi ? el("span", { class: "tag tag-a-toi" }, el("span", { class: "rond", "aria-hidden": "true" }), "attend ta réponse") : null,
      c.activite === "en_cours" ? el("span", { class: "tag tag-cours" }, "en cours") : null,
      c.activite === "en_file" ? el("span", { class: "tag tag-file" }, "en attente") : null,
      c.activite === "erreur" ? el("span", { class: "tag tag-erreur" }, c.erreur_message || "souci") : null);
    const tete = el("header", { class: "vue-tete" },
      el("div", {}, el("h1", { class: "vue-titre" }, c.titre), tags),
      c.slug ? this.reglages(c) : null);
    return el("article", { class: "vue" }, chemin, tete, corps);
  }

  reglages(c) {
    if (["programme", "publie", "abandonne"].includes(c.stade)) return null;
    // Lot 10 : plus de « Jour prévu » ici. Le jour et l'heure se choisissent à la fin, au moment de poster.
    const z = el("div", { class: "vue-reglages" });
    const cote = el("button", { class: "bouton bouton-discret bouton-petit", type: "button", html: `${icone("ecarter")}<span>Mettre de côté</span>` });
    cote.addEventListener("click", () => {
      const raison = el("input", { class: "champ", type: "text", maxlength: "60", placeholder: "Pourquoi ? (facultatif)", "aria-label": "Pourquoi tu le mets de côté (facultatif)" });
      const ok = el("button", { class: "bouton bouton-petit", type: "button" }, "Mettre de côté");
      const non = el("button", { class: "bouton bouton-discret bouton-petit", type: "button" }, "Annuler");
      const go = async () => { ok.disabled = true; try { await this.api.abandonner(c.slug, raison.value.trim() || null); annoncer("Mis de côté. Tu le retrouves en bas, dans « Mis de côté »."); } catch (e) { annoncer(e.message, "erreur"); ok.disabled = false; } };
      ok.addEventListener("click", go); raison.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); if (e.key === "Escape") { e.preventDefault(); this.afficher(); } });
      non.addEventListener("click", () => this.afficher());
      cote.replaceWith(el("span", { class: "confirmer-cote" }, raison, ok, non)); raison.focus();
    });
    z.append(cote);
    return z;
  }

  // La prochaine étape, en haut du fichier : une phrase et le bouton qui la fait.
  etape(texte, bouton, { aToi = false, cours = false } = {}) {
    return el("div", { class: `etape${aToi ? " a-toi" : ""}${cours ? " en-cours" : ""}` },
      cours ? el("span", { class: "points", "aria-hidden": "true" }, el("i"), el("i"), el("i")) : null,
      el("p", { html: texte }), bouton || null);
  }

  boutonAction(type, libelle, ico, d) {
    const b = el("button", { class: "bouton bouton-plein", type: "button", disabled: enCours(d) || null, html: `${icone(ico)}<span>${libelle}</span>` });
    b.addEventListener("click", async () => { b.disabled = true; try { await this.studio.lancer(type, [d.slug]); } catch { b.disabled = false; } });
    return b;
  }

  // Lancer la même action sur d'autres dossiers au même point (lot 11 : plus de cases dans
  // l'arborescence). Seulement s'il y en a d'autres ; ce dossier-ci et les autres sont cochés au départ,
  // Romain décoche ce qu'il ne veut pas, rien ne part sans son clic.
  enLot(d, type) {
    const s = this.studio;
    const a = ACTIONS_LOT.find((x) => x.type === type);
    if (!a || enCours(d)) return null;
    const autres = [...s.cartes.values()].filter((c) => c.slug && c.slug !== d.slug && a.ok(c) && libre(c))
      .sort((x, y) => x.titre.localeCompare(y.titre, "fr"));
    if (!autres.length) return null;
    const tous = [d, ...autres];
    if (this.choixLot?.type !== type || this.choixLot.depuis !== d.slug) this.choixLot = { type, depuis: d.slug, slugs: new Set(tous.map((c) => c.slug)) };
    const choix = this.choixLot.slugs;
    for (const k of [...choix]) if (!tous.some((c) => c.slug === k)) choix.delete(k);
    const go = el("button", { class: "bouton", type: "button" });
    const majBouton = () => {
      const n = choix.size;
      go.disabled = n < 2;
      go.innerHTML = `${icone({ script: "ecrire", montage: "ciseaux", mise_en_page: "mise" }[type])}<span>${n < 2 ? "Coche-en au moins deux" : a.libelle(n)}</span>`;
    };
    go.addEventListener("click", async () => {
      go.disabled = true;
      try { await s.lancer(type, tous.filter((c) => choix.has(c.slug)).map((c) => c.slug)); this.choixLot = null; }
      catch { majBouton(); }
    });
    const lignes = tous.map((c) => {
      const caseC = el("input", { type: "checkbox", checked: choix.has(c.slug) || null, "aria-label": `Inclure « ${c.titre} »` });
      caseC.addEventListener("change", () => { if (caseC.checked) choix.add(c.slug); else choix.delete(c.slug); majBouton(); });
      return el("label", { class: `choix-ligne f-${c.format}` }, caseC,
        el("span", { class: "ligne-corps" }, el("strong", {}, c.titre), c.slug === d.slug ? el("span", { class: "ligne-meta" }, "celui-ci") : null));
    });
    majBouton();
    return this.bloc(a.titre, el("div", {}, el("div", { class: "choix-liste" }, ...lignes),
      el("div", { class: "bloc-pied" }, go, el("span", { class: "note" }, a.note))),
    { aide: pluriel(tous.length, "dossier au même point", "dossiers au même point"), classe: "bloc-lot" });
  }

  aller(d, fichier, libelle, ico, classe = "bouton") {
    return el("button", { class: classe, type: "button", html: `${icone(ico)}<span>${libelle}</span>`, onclick: () => this.studio.selectionner({ genre: "dossier", cle: cle(d), fichier }) });
  }

  bloc(titre, contenu, { aide, outils, classe = "" } = {}) {
    return el("section", { class: `bloc ${classe}` },
      el("header", { class: "bloc-tete" }, el("h3", {}, titre, aide ? el("span", { class: "aide" }, aide) : null), outils ? el("div", { class: "bloc-outils" }, ...outils) : null),
      contenu);
  }

  boutonCopier(texte) {
    const b = el("button", { class: "bouton bouton-discret bouton-petit", type: "button", html: `${icone("copier")}<span>Copier</span>` });
    b.addEventListener("click", async () => {
      const ok = await copier(texteBrut(texte));
      b.querySelector("span").textContent = ok ? "Copié" : "Pas copié"; b.classList.toggle("fait", ok);
      setTimeout(() => { b.querySelector("span").textContent = "Copier"; b.classList.remove("fait"); }, 1800);
    });
    return b;
  }

  // ---------- Idée ----------
  vueProposition(c) {
    const src = c.source || {};
    const origine = src.type === "outlier"
      ? el("p", {}, "D'après une vidéo qui a bien marché", src.compte ? ` chez ${src.compte}` : "", ". ",
        src.lien ? el("a", { href: src.lien, target: "_blank", rel: "noopener" }, "Voir la vidéo") : null)
      : el("p", {}, String(src.type || "").startsWith("idee_") ? "Ton idée, notée en passant." : src.type === "declinaison" ? (c.republication ? "À republier : un de tes contenus déjà sortis." : "Tirée d'un de tes contenus.") : "Sortie du chat.");
    const deCote = c.stade === "de_cote";
    const garder = el("button", { class: "bouton bouton-plein", type: "button", html: `${icone("coche")}<span>Garder cette idée</span>` });
    // Lot 12 : « Mettre de côté » (pas pour maintenant, elle reste en réserve) et « Supprimer » (elle
    // disparaît ; la raison, facultative, sert à mieux viser les prochaines idées).
    const cote = el("button", { class: "bouton", type: "button", html: deCote ? `${icone("fleche")}<span>Remettre dans les idées</span>` : `${icone("ranger")}<span>Mettre de côté</span>` });
    const supprimer = el("button", { class: "bouton bouton-discret", type: "button", html: `${icone("croix")}<span>Supprimer</span>` });
    const choix = el("div", { class: "choix-idee" }, garder, cote, supprimer);
    garder.addEventListener("click", async () => {
      garder.disabled = true;
      this.studio.sel.attendGarde = true;
      try {
        const r = await this.api.garder(c.proposition_id, null);
        annoncer("C'est gardé : ton dossier est prêt.");
        if (r.slug) this.attendreDossier(r.slug);
      } catch (e) { annoncer(e.message, "erreur"); garder.disabled = false; this.studio.sel.attendGarde = false; }
    });
    cote.addEventListener("click", async () => {
      cote.disabled = true;
      try {
        if (deCote) { await this.api.reprendre(c.proposition_id); annoncer("Elle est de retour dans « Idées proposées »."); }
        else { await this.api.mettreDeCote(c.proposition_id); annoncer("Mise de côté : tu la retrouves en bas, dans « Mis de côté »."); }
      } catch (e) { annoncer(e.message, "erreur"); cote.disabled = false; }
    });
    supprimer.addEventListener("click", () => {
      const raison = el("input", { class: "champ", type: "text", maxlength: "120", placeholder: "Pourquoi ? (facultatif, ça m'aide pour les prochaines)", "aria-label": "Pourquoi tu la supprimes (facultatif)" });
      const ok = el("button", { class: "bouton", type: "button" }, "Supprimer");
      const non = el("button", { class: "bouton bouton-discret", type: "button" }, "Annuler");
      const go = async () => {
        ok.disabled = true;
        try { await this.api.supprimer(c.proposition_id, raison.value.trim() || null); annoncer(raison.value.trim() ? "Supprimée. C'est noté pour les prochaines idées." : "Supprimée."); }
        catch (e) { annoncer(e.message, "erreur"); ok.disabled = false; }
      };
      ok.addEventListener("click", go);
      raison.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); if (e.key === "Escape") { e.preventDefault(); this.afficher(); } });
      non.addEventListener("click", () => this.afficher());
      choix.replaceChildren(el("div", { class: "refus" }, raison, ok, non),
        el("p", { class: "vide-doux refus-note" }, "Elle disparaît pour de bon. Si elle peut servir plus tard, mets-la plutôt de côté."));
      raison.focus();
    });
    const corps = el("div", {},
      this.etape(deCote
        ? "<strong>Une idée mise de côté.</strong> Garde-la quand c'est le moment, remets-la dans tes idées, ou supprime-la."
        : "<strong>Une idée proposée.</strong> Garde-la si elle te parle : elle aura son dossier. Bonne mais pas pour maintenant : mets-la de côté. Pas pour toi : supprime-la."),
      c.angle ? this.bloc("L'angle", el("div", { class: "prose", html: markdown(c.angle) })) : null,
      c.accroche ? this.bloc("Une accroche possible", el("div", { class: "prose", html: markdown(`« ${c.accroche} »`) })) : null,
      el("div", { class: "idee-source" }, el("span", { html: icone(src.type === "outlier" ? "lien" : "idee") }), el("div", {}, origine,
        c.pourquoi_maintenant ? el("p", {}, el("strong", {}, "Pourquoi maintenant : "), c.pourquoi_maintenant) : null)),
      choix);
    return this.cadre(c, "idee", corps);
  }

  // La proposition gardée devient un dossier : on l'ouvre dès qu'il arrive.
  attendreDossier(slug) {
    const s = this.studio;
    const essai = (n) => {
      if (s.cartes.has(slug)) { s.selectionner({ genre: "dossier", cle: slug, fichier: "idee" }); return; }
      if (n > 40) { s.sel.attendGarde = false; s.selectionner({ genre: "accueil" }); return; }
      setTimeout(() => essai(n + 1), 150);
    };
    essai(0);
  }

  vueIdee(d) {
    let etape = null;
    if (d.stade === "gardee" && !enCours(d)) {
      // Lot 12 : plus de bloc « plusieurs briefs d'un coup » ici ; Romain le demande au chat général.
      etape = this.etape(`<strong>Idée gardée.</strong> Quand tu veux, demande ${d.format === "reel" ? "son brief (texte, plans à tourner, légende)" : "le texte de ses images et sa légende"}.`,
        this.boutonAction("script", d.format === "reel" ? "Écrire le brief" : "Écrire le carrousel", "ecrire", d));
    } else if (d.stade === "gardee") {
      etape = this.etape(`J'écris le brief. Si j'ai une question, je te la pose dans le chat ${ouChat()}.`, null, { cours: true });
    } else if ((d.fichiers || []).includes("brief")) {
      etape = this.etape("Le brief de ce contenu est écrit.", this.aller(d, "brief", "Ouvrir le brief", "brief"));
    }
    const idee = d.textes?.idee ? sansTitre(d.textes.idee) : "";
    return el("div", {}, etape,
      idee ? el("div", { class: "prose", html: markdown(idee) }) : el("p", { class: "vide-doux" }, "Pas encore de fiche pour cette idée."));
  }

  // ---------- Brief ----------
  vueBrief(d) {
    const b = d.brief;
    if (!b) return el("p", { class: "vide-doux" }, `Pas encore de brief : demande-le dans le chat ${ouChat()}.`);
    const r = [];
    const reel = d.format === "reel";
    if (d.stade === "script_ecrit") {
      const v = el("button", { class: "bouton bouton-plein", type: "button", disabled: enCours(d) || null, html: `${icone("coche")}<span>Valider le brief</span>` });
      v.addEventListener("click", async () => { v.disabled = true; try { await this.api.valider(d.slug); annoncer("C'est validé."); } catch (e) { annoncer(e.message, "erreur"); v.disabled = false; } });
      r.push(this.etape(`<strong>À relire.</strong> Retouche ce que tu veux directement ici, ou demande dans le chat ${ouChat()}. Puis valide.`, v, { aToi: !enCours(d) }));
    } else if (d.stade === "valide" && reel) {
      r.push(this.etape("<strong>Brief validé.</strong> Quand tu veux filmer, fais un plan de tournage : tu choisis ce que tu tournes ensemble, je fais un seul plan.",
        el("button", { class: "bouton", type: "button", html: `${icone("camera")}<span>Faire un plan de tournage</span>`, onclick: () => this.studio.selectionner({ genre: "transverse", quoi: "tournage", slugs: [d.slug] }) })));
    } else if (d.stade === "valide") {
      r.push(this.etape("<strong>Texte validé.</strong> Je peux mettre tes images en page.", this.boutonAction("mise_en_page", "Mettre en page", "mise", d)));
      r.push(this.enLot(d, "mise_en_page"));
    } else if (d.stade === "tournage_prevu") {
      const t = this.studio.tournages.find((x) => x.id === d.tournage_id);
      r.push(this.etape(`<strong>À tourner.</strong> Il est dans ton plan « ${t ? titreTournage(t, this.studio.tournages) : "de tournage"} ». Après, envoie tout sur ton Mac par AirDrop : je range chaque vidéo dans son dossier.`,
        el("button", { class: "bouton", type: "button", html: `${icone("camera")}<span>Ouvrir le plan</span>`, onclick: () => this.studio.selectionner({ genre: "transverse", quoi: "tournage", id: d.tournage_id || null }) })));
    }
    if (enCours(d)) r.push(this.etape("Je travaille sur ce texte en ce moment : tu pourras le retoucher quand j'aurai fini.", null, { cours: true }));
    if (reel) {
      if (b.accroches?.length) r.push(this.accroches(d));
      r.push(this.sectionModifiable(d, "texte", "Ton texte", b.texte, { aide: b.duree || null, classe: "bloc-texte", prose: "prose prose-texte", lignes: 14,
        debut: b.accroche ? b.accroches.find((a) => a.n === b.accroche)?.texte : null }));
      r.push(this.sectionModifiable(d, "plans", "Plans à tourner", b.plans, { aide: "en plus de ta vidéo face caméra", vide: "Rien à filmer en plus.", lignes: 6 }));
      r.push(this.sectionModifiable(d, "legende", "Légende", b.legende, { lignes: 8 }));
      if (b.message_auto) r.push(this.bloc("Mot en commentaire", el("div", { class: "prose", html: markdown(b.message_auto) })));
    } else {
      r.push(this.slides(d));
      r.push(this.sectionModifiable(d, "legende", "Légende", b.legende, { lignes: 8 }));
    }
    if (b.a_verifier) r.push(this.bloc("À vérifier par toi", el("div", { class: "prose", html: markdown(b.a_verifier) }), { classe: "alerte" }));
    return el("div", {}, ...r);
  }

  // Les accroches, en haut du brief (lot 12) : un clic en choisit une, l'outil du dépôt la pose au début
  // du texte. Ce qui est affiché comme choisi vient du fichier, jamais de la mémoire du modèle.
  accroches(d) {
    const b = d.brief;
    const modifiable = !enCours(d) && ["script_ecrit", "valide", "tournage_prevu"].includes(d.stade);
    const liste = el("div", { class: "accroches", role: "radiogroup", "aria-label": "Ton accroche" }, ...b.accroches.map((a) => {
      const choisie = a.n === b.accroche;
      const bt = el("button", { class: `accroche${choisie ? " choisie" : ""}`, type: "button", role: "radio", "aria-checked": String(choisie), disabled: !modifiable && !choisie ? true : null },
        el("span", { class: "accroche-rond", "aria-hidden": "true" }), el("span", { class: "accroche-texte" }, a.texte),
        choisie ? el("span", { class: "accroche-etiquette" }, "ton début") : null);
      if (!choisie && modifiable) {
        bt.addEventListener("click", async () => {
          for (const x of liste.querySelectorAll("button")) x.disabled = true;
          bt.classList.add("en-cours");
          try {
            await this.api.accroche(d.slug, a.n, b.empreinte);
            annoncer(d.stade === "script_ecrit" ? "C'est noté : ton texte commence par cette accroche." : "C'est noté : ton texte commence par cette accroche. Revalide ton brief.");
            this.afficher();
          } catch (e) { annoncer(e.message, "erreur"); this.afficher(); }
        });
      }
      return bt;
    }));
    return this.bloc("Ton accroche", liste, { aide: modifiable ? "choisis ta première phrase, ton texte suit" : "la première phrase de ta vidéo", classe: "bloc-accroches" });
  }

  // Une section du brief : lue, ou retouchée (enregistrement explicite, écrit par l'outil du dépôt).
  sectionModifiable(d, cleSection, titre, valeur, { aide, vide, classe = "", prose = "prose", lignes = 8, debut = null } = {}) {
    const libre = !enCours(d) && !["programme", "publie", "abandonne"].includes(d.stade);
    const modifier = el("button", { class: "bouton bouton-discret bouton-petit bouton-modifier", type: "button", disabled: libre ? null : true, html: `${icone("crayon")}<span>Retoucher</span>` });
    // L'accroche choisie ouvre le texte : on la montre en tête, mise en avant.
    const ouvre = valeur && debut && valeur.trimStart().startsWith(debut) ? debut : null;
    const lecture = !valeur ? el("p", { class: "vide-doux" }, vide || "Rien d'écrit.")
      : ouvre ? el("div", { class: prose }, el("p", { class: "debut-accroche" }, ouvre), el("div", { html: markdown(valeur.trimStart().slice(ouvre.length).trim()) }))
        : el("div", { class: prose, html: markdown(valeur) });
    const outils = [valeur ? this.boutonCopier(valeur) : null, modifier].filter(Boolean);
    const sec = this.bloc(titre, lecture, { aide, outils, classe });
    modifier.addEventListener("click", () => {
      this.edition = cleSection;
      const zone = el("textarea", { class: "champ", rows: String(lignes), "aria-label": titre });
      zone.value = valeur || "";
      const ok = el("button", { class: "bouton bouton-plein bouton-petit", type: "button", html: `${icone("coche")}<span>Enregistrer</span>` });
      const non = el("button", { class: "bouton bouton-discret bouton-petit", type: "button" }, "Annuler");
      const note = el("span", { class: "note" }, d.stade === "script_ecrit" ? "" : "Un texte validé puis retouché est à revalider.");
      const fin = () => { this.edition = null; if (this.aRecharger) this.afficher(); };
      non.addEventListener("click", () => { fin(); this.afficher(); });
      ok.addEventListener("click", async () => {
        if (zone.value.trim() === String(valeur || "").trim()) { fin(); this.afficher(); return; }
        ok.disabled = true;
        try {
          await this.api.brief(d.slug, { empreinte: d.brief.empreinte, [cleSection]: zone.value });
          annoncer("C'est enregistré.");
          this.edition = null; this.afficher();
        } catch (e) {
          annoncer(e.message, "erreur"); ok.disabled = false;
          if (e.code === "CHANGE") { this.edition = null; this.afficher(); }
        }
      });
      zone.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); non.click(); } if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ok.click(); });
      lecture.replaceWith(el("div", {}, zone, el("div", { class: "bloc-pied" }, ok, non, note)));
      sec.querySelector(".bloc-outils").hidden = true;
      zone.focus(); zone.setSelectionRange(zone.value.length, zone.value.length);
    });
    return sec;
  }

  // Les images d'un carrousel : titre et texte de chaque slide, retouchables ensemble.
  slides(d) {
    const b = d.brief;
    if (!b.modifiable) {
      return this.bloc("Tes images", el("div", {}, el("p", { class: "vide-doux" }, `Ce texte ne se retouche pas ici : demande la modification dans le chat ${ouChat()}.`),
        el("div", { class: "prose", html: markdown(b.brut || "") })));
    }
    const libre = !enCours(d) && !["programme", "publie", "abandonne"].includes(d.stade);
    const modifier = el("button", { class: "bouton bouton-discret bouton-petit bouton-modifier", type: "button", disabled: libre ? null : true, html: `${icone("crayon")}<span>Retoucher</span>` });
    const lecture = el("div", { class: "slides-brief" }, ...b.slides.map((s) => el("div", { class: "slide-brief" },
      el("span", { class: "slide-n" }, String(s.n)),
      el("div", {}, s.titre ? el("p", { class: "slide-titre" }, s.titre.replace(/\*+|_{2}/g, "")) : null,
        ...String(s.texte || "").split(/\n\s*\n/).filter(Boolean).map((x) => el("p", { class: "slide-texte" }, x.replace(/\*+|_{2}/g, ""))),
        s.photo ? el("p", { class: "slide-photo" }, el("span", { html: icone("photo") }), `Photo : ${s.photo}`) : null))));
    const sec = this.bloc("Tes images", lecture, { aide: pluriel(b.slides.length, "image", "images"), outils: [modifier], classe: "bloc-texte" });
    modifier.addEventListener("click", () => {
      this.edition = "slides";
      const champs = b.slides.map((s) => {
        const titre = el("input", { class: "champ", type: "text", value: s.titre, "aria-label": `Titre de l'image ${s.n}` });
        const texte = el("textarea", { class: "champ", rows: "3", "aria-label": `Texte de l'image ${s.n}` });
        texte.value = s.texte;
        return { s, titre, texte };
      });
      const ok = el("button", { class: "bouton bouton-plein bouton-petit", type: "button", html: `${icone("coche")}<span>Enregistrer</span>` });
      const non = el("button", { class: "bouton bouton-discret bouton-petit", type: "button" }, "Annuler");
      non.addEventListener("click", () => { this.edition = null; this.afficher(); });
      ok.addEventListener("click", async () => {
        const changes = champs.filter((x) => x.titre.value !== x.s.titre || x.texte.value !== x.s.texte)
          .map((x) => ({ n: x.s.n, titre: x.titre.value, texte: x.texte.value }));
        if (!changes.length) { this.edition = null; this.afficher(); return; }
        ok.disabled = true;
        try { await this.api.brief(d.slug, { empreinte: b.empreinte, slides: changes }); annoncer("C'est enregistré."); this.edition = null; this.afficher(); }
        catch (e) { annoncer(e.message, "erreur"); ok.disabled = false; if (e.code === "CHANGE") { this.edition = null; this.afficher(); } }
      });
      lecture.replaceWith(el("div", {}, el("div", { class: "slides-brief" }, ...champs.map(({ s, titre, texte }) => el("div", { class: "slide-brief" },
        el("span", { class: "slide-n" }, String(s.n)),
        el("div", {}, el("label", {}, "Titre", titre), el("label", {}, "Texte", texte),
          s.photo ? el("p", { class: "slide-photo" }, el("span", { html: icone("photo") }), `Photo : ${s.photo}`) : null)))),
        el("div", { class: "bloc-pied" }, ok, non, el("span", { class: "note" }, "*mot* en orange, **phrase** en gras, une ligne vide sépare deux blocs."))));
      modifier.hidden = true;
      champs[0]?.titre.focus();
    });
    return sec;
  }

  // ---------- Montage ----------
  vueMontage(d) {
    const m = d.montage || { rushs: [], manquants: [] };
    const r = [];
    const montageLance = enCours(d) || ["planche", "monte", "programme", "publie"].includes(d.stade);
    const verifiable = d.stade === "rushs_recus" && !enCours(d);
    if (verifiable) {
      const go = el("button", { class: "bouton bouton-plein", type: "button", html: `${icone("ciseaux")}<span>C'est bon, envoie au montage</span>` });
      go.addEventListener("click", async () => { go.disabled = true; try { await this.studio.lancer("montage", [d.slug]); } catch { go.disabled = false; } });
      // Rangées à la main (« À ranger ») : ne pas dire « toutes seules ».
      const parToi = m.rushs.some((x) => x.range_par_toi);
      const qui = parToi ? (m.rushs.every((x) => x.range_par_toi) ? "Tu les as rangées ici" : "Elles sont rangées ici") : "Je les ai rangées toutes seules";
      r.push(this.etape(`<strong>Vérifie tes vidéos.</strong> ${qui} : regarde si chacune est la bonne. Si une n'a rien à faire là, « Pas la bonne ». Puis envoie au montage.`, go, { aToi: true }));
      r.push(this.enLot(d, "montage"));
    } else if (d.stade === "rushs_recus" || (enCours(d) && d.stade !== "planche")) {
      r.push(this.etape(`Le montage est en cours (une demi-heure environ). Tu peux suivre et parler à ton monteur dans le chat ${ouChat()}.`, null, { cours: true }));
    } else if (d.stade === "planche" && d.medias?.apercu) {
      r.push(this.etape(enCours(d) ? "Ton monteur travaille sur ta vidéo. L'aperçu se recharge tout seul quand il a fini, à la même image." : `<strong>Ton aperçu est prêt.</strong> Regarde-le en entier. Quelque chose à changer : mets pause, entoure-le si tu veux et écris ta note, elle part à ton monteur. Tout est bon : « Fabrique la vidéo ».`,
        null, { aToi: !enCours(d), cours: enCours(d) }));
    } else if (d.stade === "planche") {
      r.push(this.etape(enCours(d) ? "Ton monteur reprend la vidéo avec ta réponse." : `<strong>Ta planche est prête.</strong> Regarde chaque moment, puis réponds dans le chat ${ouChat()} : « ok » pour fabriquer la vidéo, ou ce que tu changes avec son numéro.`,
        null, { aToi: !enCours(d), cours: enCours(d) }));
    } else if ((d.fichiers || []).includes("video")) {
      r.push(this.etape("<strong>Ta vidéo est montée.</strong>", this.aller(d, "video", "Voir la vidéo montée", "video")));
    }
    if (d.medias?.apercu && d.stade === "planche") r.push(this.bloc("L'aperçu de ta vidéo", this.hoteApercu(d)));
    if (d.medias?.planche) {
      r.push(this.bloc("La planche", el("div", {},
        el("img", { class: "planche-img", src: d.medias.planche, alt: "La planche du montage, moment par moment", width: "900", height: "560" }),
        d.medias.planche_lignes?.length ? el("ol", { class: "planche-lignes" }, ...d.medias.planche_lignes.map((l) => el("li", {}, el("span", { class: "n" }, String(l.n)), el("span", {}, l.ligne)))) : null)));
    }
    const grille = el("div", { class: "rushs-grille" }, ...m.rushs.map((x) => this.rush(d, x, verifiable)));
    const blocRushs = this.bloc("Tes vidéos rangées", m.rushs.length ? grille : el("p", { class: "vide-doux" }, "Aucune vidéo rangée pour l'instant."),
      { aide: pluriel(m.rushs.length, "fichier", "fichiers") });
    if ((d.medias?.planche || d.medias?.apercu) && montageLance) r.push(el("details", { class: "repli" }, el("summary", { html: `${icone("fleche")}<span>Tes vidéos rangées (${m.rushs.length})</span>` }), el("div", {}, grille)));
    else r.push(blocRushs);
    if (m.manquants?.length && !montageLance) {
      r.push(this.bloc("Pas encore arrivé", el("div", {},
        el("ul", { class: "manquants" }, ...m.manquants.map((x) => el("li", {}, el("strong", {}, x.titre), x.detail ? el("span", {}, x.detail) : null))),
        el("p", { class: "vide-doux", style: "margin-top:10px" }, "Envoie-les par AirDrop : je les range ici. Tu peux aussi monter sans.")),
      { aide: "prévu dans ton plan de tournage" }));
    }
    return el("div", {}, ...r);
  }

  rush(d, x, verifiable) {
    const role = { face: "Face caméra", "b-roll": "Plan en plus", photo: "Photo" }[x.type] || "";
    const media = x.type === "photo"
      ? el("img", { src: x.url, alt: x.titre, loading: "lazy" })
      : el("video", { src: x.url, controls: true, preload: "metadata", playsinline: true, poster: x.vignette_url || null });
    const n = el("figure", { class: "rush", style: "margin:0" },
      el("div", { class: "rush-media" }, media, el("span", { class: "rush-role" }, role)),
      el("figcaption", {}, el("p", { class: "rush-titre" }, x.titre), x.detail ? el("p", { class: "rush-detail" }, x.detail) : null));
    if (verifiable) {
      const pas = el("button", { class: "bouton bouton-discret bouton-petit", type: "button", html: `${icone("croix")}<span>Pas la bonne</span>` });
      pas.addEventListener("click", () => {
        const oui = el("button", { class: "bouton bouton-petit", type: "button" }, "La retirer");
        const non = el("button", { class: "bouton bouton-discret bouton-petit", type: "button" }, "Annuler");
        const z = el("div", { class: "ranger-confirmer" }, el("p", { class: "rush-detail" }, "Elle repart dans « À ranger », où tu choisis son dossier."), el("div", { class: "ranger-actions" }, oui, non));
        non.addEventListener("click", () => z.replaceWith(pas));
        oui.addEventListener("click", async () => {
          oui.disabled = true;
          try { await this.api.retirerRush(d.slug, x.id); annoncer("Retirée : elle t'attend dans « À ranger »."); this.afficher(); }
          catch (e) { annoncer(e.message, "erreur"); oui.disabled = false; }
        });
        pas.replaceWith(z);
      });
      n.append(pas);
    }
    return n;
  }

  // ---------- Vidéo montée, images ----------
  // Lot 10 : ici on regarde ce qui est prêt. Poster, programmer et la légende se font à un seul endroit, « Publier sur
  // Instagram » (préparation, puis quand). La légende se retouche dans le brief.
  vueVideo(d) {
    const m = d.medias || {};
    return el("div", {}, this.etapePublication(d),
      m.video_montee ? el("video", { class: "video video-seule", src: m.video_montee, controls: true, preload: "metadata", playsinline: true, width: "340", height: "604" }) : el("p", { class: "vide-doux" }, "Pas encore de vidéo montée."));
  }

  vueSlides(d) {
    const urls = d.medias?.slides || [];
    return el("div", {}, this.etapePublication(d),
      el("div", { class: "slides-grille" }, ...urls.map((u, i) => el("figure", {}, el("img", { src: u, alt: `Image ${i + 1} du carrousel`, width: "300", height: "375", loading: "lazy" }), el("figcaption", {}, `Image ${i + 1}`)))));
  }

  etapePublication(d) {
    if (d.stade === "programme" && d.publication) return this.etape(`<strong>Programmé ${quandLisible(d.publication.quand)}.</strong> Ça part tout seul, même Mac fermé.`);
    if (d.stade === "publie") return this.etape("<strong>Publié.</strong>", d.publication?.lien ? el("a", { class: "bouton", href: d.publication.lien, target: "_blank", rel: "noopener", html: `${icone("lien")}<span>Voir la publication</span>` }) : null);
    if (["monte", "mis_en_page"].includes(d.stade)) {
      return this.etape(`<strong>Prêt à poster.</strong> Tu le prépares dans « Publier sur Instagram » : tu relis sa légende et ce qu'il offre, puis tu choisis quand il part.`,
        el("button", { class: "bouton", type: "button", html: `${icone("envoi")}<span>Ouvrir Publier sur Instagram</span>`,
          onclick: () => this.studio.selectionner({ genre: "transverse", quoi: "publier", vers: d.slug }) }));
    }
    return null;
  }

  quandParDefaut(c, pris = new Set()) {
    const cfg = this.studio.config;
    const demain = ajouterJours(aujourdhui(), 1);
    const j = c.jour_prevu && c.jour_prevu >= demain && !pris.has(c.jour_prevu) ? c.jour_prevu : prochainJourParDefaut(cfg.jours_par_defaut, demain, pris);
    pris.add(j);
    return `${j} ${cfg.heures_par_defaut?.[c.format] || "18:30"}`;
  }

  // ---------- Vue d'ensemble (lot 10) : les chiffres Instagram en graphiques, puis les contenus par format ----------
  // Ce qui attend le client est déjà dans l'arborescence (étiquettes, compteur orange) : pas de doublon ici.
  vueAccueil() {
    const s = this.studio;
    const formats = comptesParFormat([...s.cartes.values()]);
    return el("article", { class: "vue vue-accueil" },
      el("header", { class: "vue-tete" }, el("div", {}, el("h1", { class: "vue-titre" }, "Ton studio"),
        el("p", { class: "vide-doux", style: "margin-top:8px" }, "Tes chiffres Instagram, et où en sont tes contenus."))),
      this.blocStats(),
      this.bloc("Tes contenus", el("div", { class: "etapes-formats" }, ...formats.map((f) => etapesFormat(f))),
        { aide: "combien à chaque étape, reels puis carrousels" }));
  }

  // Le tableau de bord (lot 11) : six cards, une barre par semaine, la période choisie en haut à gauche (retenue par ce
  // Mac), les abonnés en haut à droite. Les stades des contenus restent dessous.
  blocStats() {
    const s = this.studio;
    const st = s.stats;
    const maj = el("button", { class: "bouton bouton-discret bouton-petit", type: "button", disabled: st?.en_cours || !st?.source || null, html: `${icone("synchro")}<span>Mettre à jour</span>` });
    maj.addEventListener("click", async () => {
      maj.disabled = true; maj.querySelector("span").textContent = "Je lis tes chiffres";
      try {
        s.stats = await s.api.actualiserStats(); this.afficher();
        // Les chiffres peuvent être les mêmes qu'avant : on dit que la lecture est faite.
        annoncer(s.stats?.erreur ? s.stats.erreur : "Tes chiffres Instagram sont à jour.", s.stats?.erreur ? "erreur" : undefined);
      } catch (e) { annoncer(e.message, "erreur"); maj.disabled = false; }
    });
    const titreBloc = "Tes chiffres, semaine par semaine";
    // Pas encore de chiffres : en train de les lire (points qui bougent), ou la raison.
    if (!st || !st.disponible) {
      const lit = !st || st.en_cours || (st.source && !st.erreur);
      const texte = st?.erreur || (lit ? "Je lis tes chiffres Instagram, ils arrivent dans un instant." : "Tes chiffres Instagram arrivent ici dès que je les ai lus.");
      return this.bloc(titreBloc, lit && !st?.erreur ? attente(texte) : el("p", { class: st?.erreur ? "graph-erreur" : "vide-doux" }, texte), { outils: st?.source ? [maj] : null });
    }
    const idPeriode = periode(s.periodeStats || lireReglage("periode-stats")).id;
    const choisir = (id) => {
      s.periodeStats = id; ecrireReglage("periode-stats", id); this.afficher();
      document.querySelector(".tb-periode[aria-pressed=\"true\"]")?.focus();
    };
    const periodes = el("div", { class: "tb-periodes", role: "group", "aria-label": "Période" },
      ...PERIODES.map((p) => el("button", { type: "button", class: "tb-periode", "aria-pressed": String(p.id === idPeriode), onclick: () => choisir(p.id) }, p.nom)));
    const v = st.variation_abonnes;
    const abonnes = el("p", { class: "tb-abonnes" },
      el("strong", {}, nombreFr(st.abonnes) ?? "pas de chiffre"), typeof st.abonnes === "number" ? (st.abonnes > 1 ? " abonnés" : " abonné") : " pour tes abonnés",
      v ? el("span", { class: `evolution ${v.valeur > 0 ? "hausse" : v.valeur < 0 ? "baisse" : ""}` }, ` ${v.valeur > 0 ? "+" : ""}${nombreFr(v.valeur)}`,
        el("span", { class: "doux" }, v.partielle ? ` depuis le ${dateCourte(v.depuis)}` : " en 30 jours")) : null);
    const quand = st.chiffres_du || st.maj;
    const note = el("p", { class: "stats-note" },
      st.exemple ? el("span", { class: "tag tag-exemple" }, "chiffres d'exemple") : null,
      quand ? `Chiffres d'Instagram du ${jourCourt(dateEnJour(new Date(quand)))} à ${heure(quand).replace(":", " h ")}. Une semaine va du lundi au dimanche ; Instagram met jusqu'à deux jours à compter.` : "",
      st.en_cours ? " Je les mets à jour." : "", st.erreur ? ` ${st.erreur}` : "");
    const semaines = st.semaines || [];
    const sansSemaines = !semaines.some((x) => ["vues", "portee", "visites_profil", "likes", "publications"].some((k) => typeof x[k] === "number"));
    const p = periode(idPeriode);
    const nomPeriode = p.id === "1m" ? "le dernier mois" : `les ${p.nom}`;
    // Une card : son titre, le chiffre de la période, une ligne de lecture, ses barres. cumul : faux pour les comptes
    // touchés (une personne touchée deux semaines compte deux fois si on additionne) : on montre la moyenne par semaine.
    const carte = ({ cle, titre, un, plusieurs, cumul = true, absent, etat = null, depuis = null }) => {
      const unite = (n) => `${nombreFr(n)} ${n > 1 ? plusieurs : un}`;
      const tete = el("h4", { class: "tb-titre" }, titre);
      if (etat) return el("section", { class: "tb-carte", "aria-label": titre }, tete, etat);
      const r = resumer(semaines, idPeriode, cle);
      const ecart = r.ecart ? el("span", { class: `evolution ${r.ecart.pourcent > 0 ? "hausse" : r.ecart.pourcent < 0 ? "baisse" : ""}` },
        `${r.ecart.pourcent > 0 ? "+" : ""}${r.ecart.pourcent} %`, el("span", { class: "doux" }, ` contre ${r.ecart.libelle}`)) : null;
      const chiffre = cumul ? r.total : r.moyenne;
      // Une moyenne sous 10 garde une décimale (0,1 publication par semaine, pas 0).
      const moyen = (n) => (n < 10 && Math.round(n * 10) / 10 !== Math.round(n) ? String(Math.round(n * 10) / 10).replace(".", ",") : nombreFr(n));
      const total = chiffre === null
        ? el("p", { class: "tb-total absente" }, sansSemaines ? (st.en_cours ? "Je lis tes semaines." : "Tes semaines arrivent à la prochaine mise à jour.") : "Pas de chiffre sur cette période.")
        : el("p", { class: "tb-total" }, el("strong", {}, cumul ? nombreFr(chiffre) : moyen(chiffre)), el("span", {}, cumul ? ` ${chiffre > 1 ? plusieurs : un} sur ${nomPeriode}` : ` ${chiffre >= 2 ? plusieurs : un} par semaine en moyenne`));
      const lecture = [];
      if (cumul && r.moyenne !== null) lecture.push(`${moyen(r.moyenne)} par semaine en moyenne`);
      if (!cumul && r.mesurees) lecture.push(`sur ${nomPeriode}`);
      if (depuis) lecture.push(`${lecture.length ? ", " : ""}comptées depuis le ${depuis}`);
      return el("section", { class: "tb-carte", "aria-label": titre }, tete, total,
        (lecture.length || ecart) ? el("p", { class: "tb-lecture" }, lecture.join(""), lecture.length && ecart ? ", " : "", ecart) : null,
        chiffre === null && sansSemaines ? null : barresSemaines(r.barres, { unite, absent, titre }));
    };
    const vr = st.visites_ressources || { etat: "sans" };
    const etatVisites = vr.etat === "sans" ? el("p", { class: "tb-vide" }, "Tu n'as pas de ressource gratuite : rien à compter ici.")
      : vr.etat === "pas_mesure" ? el("p", { class: "tb-vide" }, "Pas encore mesuré : les visites de tes ressources gratuites arrivent ici dès qu'elles sont comptées.")
        : vr.etat === "erreur" ? el("p", { class: "graph-erreur" }, vr.phrase || "Je n'arrive pas à lire les visites de tes ressources pour l'instant.")
          : null;
    const cartes = el("div", { class: "tb-grille" },
      carte({ cle: "vues", titre: "Vues", un: "vue", plusieurs: "vues" }),
      carte({ cle: "publications", titre: "Publications", un: "publication", plusieurs: "publications", absent: "pas de chiffre" }),
      carte({ cle: "likes", titre: "Likes", un: "like", plusieurs: "likes" }),
      carte({ cle: "visites_ressources", titre: "Visites des ressources gratuites", un: "visite", plusieurs: "visites", absent: "pas encore mesuré", etat: etatVisites,
        depuis: vr.etat === "ok" && vr.depuis ? dateCourte(vr.depuis).replace(/\.$/, "") : null }),
      carte({ cle: "portee", titre: "Comptes touchés", un: "compte", plusieurs: "comptes", cumul: false }),
      carte({ cle: "visites_profil", titre: "Visites du profil", un: "visite", plusieurs: "visites" }));
    return this.bloc(titreBloc, el("div", {},
      el("div", { class: "tb-barre" }, periodes, abonnes), note,
      vr.etat === "ok" && vr.phrase ? el("p", { class: "stats-note" }, vr.phrase) : null,
      cartes), { outils: [maj] });
  }

  entete(titre, sous) {
    const s = this.studio;
    return [el("nav", { class: "vue-chemin", "aria-label": "Où tu es" },
      el("button", { type: "button", onclick: () => s.selectionner({ genre: "accueil" }) }, "Studio"), el("span", { html: icone("fleche") }), el("span", { class: "courant" }, titre)),
    el("header", { class: "vue-tete" }, el("div", {}, el("h1", { class: "vue-titre" }, titre), sous ? el("p", { class: "vide-doux", style: "margin-top:8px" }, sous) : null))];
  }

  vueRanger() {
    const s = this.studio;
    s.rangement.dessiner();
    const deCote = s.a_ranger.some((f) => !f.attente);
    const sous = deCote ? `Je n'ai pas su où mettre ces fichiers. Choisis le dossier de chacun, ou glisse-le sur un dossier ${ouArbre()}.`
      : s.a_ranger.length ? "Des fichiers de ton tournage sont arrivés sur ton Mac après la fin du tournage : range-les d'ici."
        : "Ce que je n'arrive pas à ranger tout seul arrive ici, et les fichiers envoyés après la fin d'un tournage.";
    return el("article", { class: "vue" }, ...this.entete("À ranger", sous),
      s.a_ranger.length ? s.rangement.racine : el("p", { class: "vide-doux" }, "Tout est rangé."));
  }

  // ---------- Tournages : sur demande seulement (lot 10) ----------
  // Romain coche ce qu'il veut filmer ensemble, le head of content fait un nouveau plan daté ; les
  // anciens plans restent dans la liste. Le stade « à tourner » se déduit des plans (contrat, 6).
  vueTournages() {
    const s = this.studio;
    const tournables = [...s.cartes.values()].filter((c) => c.slug && c.format === "reel" && ["script_ecrit", "valide", "tournage_prevu"].includes(c.stade))
      .sort((a, b) => ["valide", "script_ecrit", "tournage_prevu"].indexOf(a.stade) - ["valide", "script_ecrit", "tournage_prevu"].indexOf(b.stade) || a.titre.localeCompare(b.titre, "fr"));
    // Les cases cochées survivent aux mises à jour de l'écran ; « Faire un plan de tournage » sur un
    // brief validé arrive ici avec ce contenu déjà coché. C'est le seul endroit où l'on choisit ce
    // qu'on filme ensemble (lot 11).
    if (s.sel.slugs) { this.choixTournage = new Set(s.sel.slugs); delete s.sel.slugs; }
    this.choixTournage ||= new Set();
    for (const k of [...this.choixTournage]) if (!tournables.some((c) => c.slug === k)) this.choixTournage.delete(k);
    const enPrepa = s.file.some((a) => a.type === "tournage" && ["en_cours", "en_file"].includes(a.statut));
    const faire = el("button", { class: "bouton bouton-plein", type: "button" });
    const majBouton = () => {
      const n = this.choixTournage.size;
      faire.disabled = !n || enPrepa;
      faire.innerHTML = `${icone("camera")}<span>${n > 1 ? `Faire le plan pour ces ${n} vidéos` : "Faire le plan de tournage"}</span>`;
    };
    faire.addEventListener("click", async () => {
      faire.disabled = true;
      try { await s.lancer("tournage", [...this.choixTournage]); this.choixTournage.clear(); }
      catch { majBouton(); }
    });
    const lignes = tournables.map((c) => {
      const caseC = el("input", { type: "checkbox", checked: this.choixTournage.has(c.slug) || null, disabled: enPrepa || null, "aria-label": `Tourner « ${c.titre} »` });
      caseC.addEventListener("change", () => { if (caseC.checked) this.choixTournage.add(c.slug); else this.choixTournage.delete(c.slug); majBouton(); });
      const note = c.stade === "script_ecrit" ? "brief pas encore validé" : c.stade === "tournage_prevu" ? "déjà dans un plan" : null;
      return el("label", { class: "choix-ligne f-reel" }, caseC,
        el("span", { class: "ligne-corps" }, el("strong", {}, c.titre), note ? el("span", { class: "ligne-meta" }, note) : null),
        el("span", { class: "tag tag-stade" }, c.libelle));
    });
    majBouton();
    const nouveau = this.bloc("Nouveau plan de tournage", el("div", {},
      enPrepa ? this.etape("Je fais ton plan de tournage. Il arrive dans la liste dessous dans quelques minutes.", null, { cours: true }) : null,
      tournables.length ? el("div", { class: "choix-liste" }, ...lignes) : el("p", { class: "vide-doux" }, "Rien à tourner pour l'instant : un reel arrive ici dès que son brief est écrit."),
      tournables.length ? el("div", { class: "bloc-pied" }, faire, el("span", { class: "note" }, "Toutes tes vidéos face caméra d'abord, puis les plans en plus regroupés par lieu et par matériel.")) : null),
      { aide: "coche ce que tu veux filmer ensemble" });
    const plans = s.tournages;
    const liste = plans.length ? el("div", { class: "accueil-liste" }, ...plans.map((t) => el("button", { class: "accueil-ligne", type: "button", onclick: () => s.selectionner({ genre: "transverse", quoi: "tournage", id: t.id }) },
      el("span", { html: icone("camera") }),
      el("span", { class: "ligne-corps" }, el("strong", {}, titreTournage(t, plans)),
        el("span", { class: "ligne-meta" }, [pluriel(t.contenus.length, "vidéo", "vidéos"), t.duree_estimee_min ? `environ ${t.duree_estimee_min} min` : null].filter(Boolean).join(", "))),
      t.a_finir ? el("span", { class: "tag tag-a-toi" }, "à finir de ranger")
        : el("span", { class: `tag ${t.en_cours ? "tag-stade" : "tag-fini"}` }, t.en_cours ? "à tourner" : "tourné"),
      el("span", { html: icone("fleche") }))))
      : el("p", { class: "vide-doux" }, "Pas encore de plan de tournage.");
    return el("article", { class: "vue" }, ...this.entete("Tournages", "Un plan de tournage quand tu le demandes : tu coches ce que tu filmes ensemble, je fais un seul plan dans l'ordre où tu filmes."),
      nouveau, this.bloc("Tes plans", liste, { aide: plans.length ? pluriel(plans.length, "plan", "plans") : null }));
  }

  // Tant qu'un envoi est suivi sur l'écran du plan (fichier en réception, vérification qui attend, plan à
  // finir), le studio redemande où il en est : toutes les 2 s quand un fichier arrive, sinon toutes les 5 s.
  // L'écran se redessine seulement si quelque chose a changé ; on s'arrête dès qu'on quitte le plan.
  suivreReception(id, jeton, { suivi, reception }) {
    clearTimeout(this._reception);
    const arrive = Boolean(reception?.en_cours?.length);
    const attend = (suivi.envoi && !suivi.valide_le && !suivi.verification?.complet) || suivi.a_finir || suivi.rangement?.en_cours;
    if (!arrive && !attend) return;
    const cle = (rec, sv) => JSON.stringify([rec ? { ...rec, le: null } : null, sv]);
    const avant = cle(reception, suivi);
    this._reception = setTimeout(async () => {
      if (jeton !== this.jeton || this.studio.sel.quoi !== "tournage" || this.studio.sel.id !== id) return;
      let r;
      try { r = await this.api.receptionPlan(id); } catch { r = null; }
      if (jeton !== this.jeton) return;
      if (!r) { this.suivreReception(id, jeton, { suivi, reception }); return; }
      if (cle(r.reception, r.suivi) !== avant) { this.afficher(); return; }
      this.suivreReception(id, jeton, { suivi, reception });
    }, arrive ? 2000 : 5000);
  }

  // Le plan de tournage (lot 12) : une carte par prise, cochable ; la dernière étape (tout envoyé par
  // AirDrop) fait vérifier les fichiers arrivés ; « Valider la fin du tournage » range tout. Les coches et
  // la vérification sont écrites par le serveur, jamais par le modèle.
  async vuePlan(jeton) {
    const s = this.studio;
    const id = s.sel.id;
    const resume = s.tournages.find((x) => x.id === id);
    const titre = resume ? titreTournage(resume, s.tournages) : "Plan de tournage";
    const chemin = el("nav", { class: "vue-chemin", "aria-label": "Où tu es" },
      el("button", { type: "button", onclick: () => s.selectionner({ genre: "accueil" }) }, "Studio"), el("span", { html: icone("fleche") }),
      el("button", { type: "button", onclick: () => s.selectionner({ genre: "transverse", quoi: "tournage" }) }, "Tournages"), el("span", { html: icone("fleche") }),
      el("span", { class: "courant" }, titre));
    const tete = el("header", { class: "vue-tete" }, el("div", {}, el("h1", { class: "vue-titre" }, titre),
      resume ? el("div", { class: "vue-etiquettes" }, resume.a_finir ? el("span", { class: "tag tag-a-toi" }, "à finir de ranger")
        : el("span", { class: `tag ${resume.en_cours ? "" : "tag-fini"}` }, resume.en_cours ? "à tourner" : "tourné"),
        resume.duree_estimee_min ? el("span", { class: "tag" }, `environ ${resume.duree_estimee_min} min`) : null) : null));
    let t;
    try { t = this._planPret?.id === id ? this._planPret : await this.api.tournage(id); } catch (e) { return el("article", { class: "vue" }, chemin, tete, el("p", { class: "recap-erreur" }, e.message)); }
    this._planPret = null;
    if (jeton !== this.jeton) return this.racine.firstChild || el("div");
    const suivi = t.suivi || { coches: [], sautees: [], envoi: false, verification: null };
    const fini = Boolean(suivi.valide_le);
    const rangement = suivi.rangement || null;
    const redessiner = (rep) => { if (rep?.bulles) this._planPret = { ...rep, id }; this.afficher(); };
    const reception = t.reception || null;
    const arrive = Boolean(reception?.en_cours?.length);
    this.suivreReception(id, jeton, { suivi, reception });

    // Ce qui est sur le Mac pour ce plan, en direct : la taille d'un fichier en cours de réception avance.
    const lignesReception = reception && (reception.en_cours.length || (suivi.a_finir && reception.recus.length))
      ? el("div", { class: "prises-reception" }, ...reception.en_cours.map((f) => el("p", { class: "recap-charge", role: "status" },
        el("span", { class: "points", "aria-hidden": "true" }, el("i"), el("i"), el("i")),
        `${f.type === "photo" ? "Une photo" : "Une vidéo"} en cours de réception : ${f.taille_lisible} reçus pour l'instant.`)),
        ...(suivi.a_finir ? reception.recus.map((f) => el("p", { class: "verif verif-ok" }, el("span", { html: icone("coche") }),
          el("span", {}, `${f.type === "photo" ? "Une photo" : "Une vidéo"} arrivée en entier (${f.taille_lisible}), pas encore rangée.`))) : []))
      : null;
    const reste = rangement?.reste || null;
    const resteTexte = reste && (reste.videos || reste.photos)
      ? [reste.videos ? pluriel(reste.videos, "vidéo", "vidéos") : null, reste.photos ? pluriel(reste.photos, "photo", "photos") : null].filter(Boolean).join(" et ")
      : null;

    let etape;
    if (rangement?.en_cours) etape = this.etape("<strong>Je range tes fichiers</strong> dans le dossier de chaque contenu. Ça prend quelques minutes : tu les vérifies ensuite dans « Montage ».", null, { cours: true });
    else if (rangement?.erreur) etape = this.etape(`<strong>Le rangement n'a pas abouti.</strong> ${rangement.erreur} Ton plan reste ici : relance le rangement avec le bouton en bas.`, null, { aToi: true });
    else if (suivi.a_finir) {
      // Rien n'est perdu : le plan reste à finir tant que ses fichiers ne sont pas rangés.
      const quoi = resteTexte ? `Il manque encore ${resteTexte} dans tes dossiers.` : "Je n'ai encore rien rangé pour ce tournage.";
      const suite = arrive ? "Un fichier est en train d'arriver : attends la fin de l'envoi, puis clique sur « Ranger maintenant »."
        : reception?.recus?.length ? "Ce qui est arrivé t'attend : clique sur « Ranger maintenant »."
          : "Envoie-le par AirDrop : dès qu'il est arrivé en entier, clique sur « Ranger maintenant ». Je ne touche à rien d'ici là.";
      etape = this.etape(`<strong>Tournage pas fini de ranger.</strong> ${quoi} ${suite}`, null, { aToi: true });
    } else if (fini) {
      const n = rangement?.places ?? null; const ar = rangement?.a_ranger ?? 0;
      etape = this.etape(`<strong>Tournage terminé.</strong> ${n !== null ? `${n ? pluriel(n, "fichier rangé", "fichiers rangés") : "Aucun fichier rangé"} dans tes dossiers${ar ? `, ${pluriel(ar, "fichier", "fichiers")} dans « À ranger »` : ""}. ` : ""}Vérifie chaque vidéo dans le fichier « Montage » de ses contenus.`);
    } else etape = this.etape(`<strong>Coche chaque prise quand tu l'as filmée.</strong> Une carte, c'est une fois le bouton rouge, puis tu coupes. Ce plan est aussi sur ton téléphone.`);

    const libre = !fini && !rangement?.en_cours;
    const coches = new Set(suivi.coches); const sautees = new Set(suivi.sautees);
    // Lot 13 : une carte par prise, pleine largeur, à la hauteur de son contenu ; rien que le titre de
    // l'idée, ce qu'il faut dire ou filmer, et la case. Le titre de section (Face caméra, B-roll, Photo)
    // remplace celui de chaque carte.
    const cartePrise = (b) => {
      const sautee = sautees.has(b.n);
      const faite = coches.has(b.n);
      const titres = [...new Set((b.contenus || []).map((c) => c.titre))];
      const corps = [];
      if (b.type === "face") {
        if (b.script) {
          // Lot 14 : un bloc par morceau dit d'une traite (Romain fait une pause entre deux morceaux).
          // Découpage écrit dans le script quand il y est, sinon regroupement de repli (morceaux.js).
          const morceaux = morceauxDuTexte(b.script, { parLigne: b.decoupage === "morceaux", accroche: b.accroche });
          corps.push(el("div", { class: "prise-script" }, ...morceaux.map((m) => el("p", {
            class: `prise-morceau${m.accroche ? " prise-accroche" : ""}${m.partie ? " prise-partie" : ""}` }, m.texte))));
        } else corps.push(el("p", { class: "vide-doux" }, "Le texte n'est pas encore écrit."));
      } else if (b.type === "b-roll") {
        for (const m of b.mouvements || []) {
          for (const ph of m.phrases) corps.push(el("blockquote", { class: "prise-cite" }, `« ${ph.phrase} »`));
          if (m.texte) corps.push(el("p", { class: "prise-geste" }, el("span", { class: "prise-toi" }, "Toi : "), m.texte));
        }
      } else if (b.photo) corps.push(el("p", { class: "prise-geste" }, b.photo.replace(/^./, (x) => x.toUpperCase())));
      let caseC = null;
      if (!b.deja && !sautee) {
        caseC = el("input", { type: "checkbox", checked: faite || null, disabled: !libre || null,
          "aria-label": `${b.titre}${titres.length ? `, ${titres.join(", ")}` : ""} : ${b.type === "photo" ? "prise" : "filmé"}` });
        caseC.addEventListener("change", async () => {
          caseC.disabled = true;
          try { redessiner(await this.api.cocherPlan(id, b.n, caseC.checked)); } catch (e) { annoncer(e.message, "erreur"); this.afficher(); }
        });
      }
      const sauter = !b.deja && libre ? el("button", { class: "lien-texte prise-sauter", type: "button" }, sautee ? "Je la fais finalement" : "Je ne la fais pas") : null;
      sauter?.addEventListener("click", async () => {
        sauter.disabled = true;
        try { redessiner(await this.api.sauterPrise(id, b.n, !sautee)); } catch (e) { annoncer(e.message, "erreur"); this.afficher(); }
      });
      return el("article", { class: `prise prise-${b.type}${faite ? " faite" : ""}${sautee || b.deja ? " eteinte" : ""}`, "data-n": String(b.n) },
        el("label", { class: "prise-tete" }, caseC || el("span", { class: "prise-sans-case", "aria-hidden": "true" }),
          el("span", { class: "prise-idee" }, titres.join(" · ") || b.titre),
          sauter ? el("span", { class: "prise-outils" }, sauter) : null),
        b.deja ? el("p", { class: "prise-etat" }, "Déjà filmé : rien à refaire.") : sautee ? el("p", { class: "prise-etat" }, "Tu ne la fais pas.") : null,
        corps.length ? el("div", { class: "prise-corps" }, ...corps) : null);
    };
    const toutes = t.bulles || [];
    const sections = [["face", "Face caméra"], ["b-roll", "B-roll"], ["photo", "Photo"]]
      .map(([type, nom]) => [nom, toutes.filter((b) => b.type === type)])
      .filter(([, liste]) => liste.length)
      .map(([nom, liste]) => el("section", { class: "prises-section" }, el("h2", { class: "prises-titre" }, nom), el("div", { class: "prises" }, ...liste.map(cartePrise))));

    // La dernière étape : tout envoyer, puis le studio vérifie (seulement quand Romain la coche).
    const envoi = el("input", { type: "checkbox", checked: suivi.envoi || fini || null, disabled: !libre || null, "aria-label": "Tout est envoyé sur ton Mac" });
    envoi.addEventListener("change", async () => {
      envoi.disabled = true;
      try { redessiner(await this.api.cocherPlan(id, "envoi", envoi.checked)); } catch (e) { annoncer(e.message, "erreur"); this.afficher(); }
    });
    const ver = !fini && suivi.envoi ? suivi.verification : null;
    const derniere = el("article", { class: `prise prise-envoi${suivi.envoi || fini ? " faite" : ""}` },
      el("label", { class: "prise-tete" }, envoi, el("span", { class: "prise-idee" }, "Envoie toutes tes vidéos et tes photos sur ton Mac par AirDrop")),
      el("p", { class: "prise-note" }, fini ? "Fait." : "Coche quand l'envoi est fini : je regarde si tout est arrivé."),
      ver ? el("p", { class: `verif ${ver.complet ? "verif-ok" : "verif-manque"}`, role: "status" },
        el("span", { html: icone(ver.complet ? "coche" : "attention") }), el("span", {}, ver.complet ? ver.message : `Tu ne peux pas encore valider la fin du tournage. ${ver.message}`)) : null,
      !fini ? lignesReception : null);

    const valider = el("button", { class: "bouton bouton-plein", type: "button", disabled: !suivi.peut_valider || null, html: `${icone("coche")}<span>Valider la fin du tournage</span>` });
    valider.addEventListener("click", async () => {
      valider.disabled = true;
      try { redessiner(await this.api.validerTournage(id)); annoncer("Je range tes fichiers dans leurs dossiers."); }
      catch (e) { annoncer(e.message, "erreur"); redessiner(e.donnees); }
    });
    const encore = el("button", { class: `bouton ${suivi.a_finir ? "bouton-plein" : "bouton-discret"}`, type: "button", disabled: arrive || null,
      html: `${icone(suivi.a_finir ? "coche" : "synchro")}<span>${suivi.a_finir ? "Ranger maintenant" : "Ranger ce qui est arrivé depuis"}</span>` });
    encore.addEventListener("click", async () => {
      encore.disabled = true;
      try { redessiner(await this.api.validerTournage(id)); annoncer("Je range ce qui est arrivé depuis."); } catch (e) { annoncer(e.message, "erreur"); encore.disabled = false; }
    });
    const pied = fini
      ? (rangement?.en_cours ? null : el("div", {}, suivi.a_finir ? lignesReception : null, el("div", { class: "bloc-pied" }, encore, el("span", { class: "note" }, arrive
        ? "Le bouton s'active quand l'envoi est fini."
        : "Un fichier envoyé en retard ? Envoie-le par AirDrop, puis range-le d'ici."))))
      : el("div", { class: "bloc-pied plan-pied" }, valider, el("span", { class: "note" }, suivi.peut_valider
        ? "Je range chaque fichier dans le dossier de son contenu. Ce que je ne reconnais pas va dans « À ranger »."
        : "Le bouton s'active quand tout ce que tu as filmé est arrivé sur ton Mac."));

    return el("article", { class: "vue" }, chemin, tete, etape,
      this.bloc("Pour", el("div", { class: "liens-contenus" }, ...t.contenus.map((c) => el("button", { class: "bouton bouton-petit", type: "button",
        onclick: () => s.selectionner({ genre: "dossier", cle: c.slug }) }, c.titre)))),
      ...(sections.length ? [...sections, el("div", { class: "prises prises-fin" }, derniere)]
        : [t.texte ? el("div", { class: "prose" , html: markdown(sansTitre(t.texte)) }) : el("p", { class: "vide-doux" }, "Le plan n'est pas encore écrit.")]),
      sections.length ? pied : null);
  }

  // ---------- Ressources gratuites (studio de Yoan) ----------
  // Les pages que reçoivent ceux qui commentent un mot. Tout vient des outils du dépôt (fichiers, et la
  // page lue à son adresse), jamais de la mémoire du modèle. Décision du 18/11/2026 : plus d'aperçu ni de
  // bouton de mise en ligne ; le head of content la met en ligne dès qu'elle est prête, le studio donne le
  // lien et l'état réel, et une modification se demande dans le chat.

  // La liste (sans id), ou une ressource seule qui n'a pas de dossier de contenu (id = son slug).
  async vueRessources(jeton, id) {
    const s = this.studio;
    let liste;
    try { liste = this.noterEtatsRessources((await this.api.ressources()).ressources || []); }
    catch (e) { return el("article", { class: "vue" }, ...this.entete("Ressources gratuites"), el("p", { class: "recap-erreur" }, e.message)); }
    if (jeton !== this.jeton) return null;
    if (id) {
      const r = liste.find((x) => x.slug === id);
      if (!r) return el("article", { class: "vue" }, ...this.entete("Ressources gratuites"), el("p", { class: "vide-doux" }, "Je ne trouve plus cette ressource."));
      if (r.etat === "mise_a_jour") this.relireRessources(jeton);
      return el("article", { class: "vue" }, ...this.entete(r.titre), ...this.corpsRessource(r, jeton, liste));
    }
    const ouvrir = (r) => (r.contenu
      ? s.selectionner({ genre: "dossier", cle: r.contenu.slug, fichier: "ressource" })
      : s.selectionner({ genre: "transverse", quoi: "ressources", id: r.slug }));
    // Une carte par ressource (lot 10) : un petit aperçu de la page (capture du site), son titre, son état, son mot.
    const ligne = (r) => {
      const meta = [r.mot ? `mot ${r.mot}` : "pas encore de mot",
        r.posts.length ? pluriel(r.posts.length, "post relié", "posts reliés") : null].filter(Boolean).join(" · ");
      const repli = () => el("span", { class: "res-apercu-vide", "aria-hidden": "true" }, el("span", { html: icone("cadeau") }), el("span", {}, r.titre));
      const image = r.vignette_url ? el("img", { class: "res-apercu-img", src: r.vignette_url, alt: "", width: "500", height: "880", loading: "lazy" }) : null;
      const cadre = el("span", { class: `res-apercu${image ? " charge" : ""}` }, image || repli(),
        image ? el("span", { class: "res-apercu-attente", "aria-hidden": "true" }, el("span", { class: "points" }, el("i"), el("i"), el("i"))) : null);
      if (image) {
        image.addEventListener("load", () => cadre.classList.remove("charge"), { once: true });
        image.addEventListener("error", () => { cadre.classList.remove("charge"); image.replaceWith(repli()); }, { once: true });
      }
      return el("button", { class: `res-carte res-${r.etat}`, type: "button", onclick: () => ouvrir(r), "aria-label": `${r.titre}, ${ETATS_RESSOURCE[r.etat]?.texte || ""}, ${meta}` },
        cadre,
        el("span", { class: "res-carte-corps" },
          el("strong", { class: "res-carte-titre" }, r.titre),
          el("span", { class: "ligne-meta" }, meta)));
    };
    const groupes = Object.entries(ETATS_RESSOURCE)
      .map(([etat, e]) => [e.groupe, liste.filter((r) => r.etat === etat)]).filter(([, l]) => l.length);
    if (liste.some((r) => r.etat === "mise_a_jour")) this.relireRessources(jeton);
    return el("article", { class: "vue" }, ...this.entete("Ressources gratuites", "Les pages que reçoivent ceux qui commentent ton mot. Tu choisis laquelle offrir quand tu prépares un post à poster."),
      groupes.length ? groupes.map(([titre, l]) => this.bloc(titre, el("div", { class: "res-grille" }, ...l.map(ligne)), { aide: pluriel(l.length, "ressource", "ressources") }))
        : el("p", { class: "vide-doux" }, "Pas encore de ressource. Demande-en une à ton head of content dans le chat : il la met en ligne dès qu'elle est prête et te donne le lien."));
  }

  // Une mise à jour est en cours : on relit dans quelques secondes, tant que la même vue est affichée et
  // que rien n'est en train d'être écrit.
  relireRessources(jeton) {
    clearTimeout(this._relireRes);
    this._relireRes = setTimeout(() => {
      if (jeton !== this.jeton) return;
      if (this.edition || document.activeElement?.closest?.(".res-demande")) { this.relireRessources(jeton); return; }
      this.afficher();
    }, 8000);
  }

  // Le fichier « Ressource gratuite » d'un dossier de contenu.
  // L'état lu à l'adresse de chaque page (en ligne, mise à jour en cours, erreur) : l'arborescence le montre
  // au lieu de « en ligne » dès que la page est dans le site (test de bout en bout du 18/11).
  noterEtatsRessources(liste) {
    const s = this.studio;
    const avant = JSON.stringify([...(s.etatsRessources || new Map())]);
    s.etatsRessources = new Map(liste.map((r) => [r.slug, r.etat]));
    if (JSON.stringify([...s.etatsRessources]) !== avant) s.arbre?.dessiner();
    return liste;
  }

  vueFichierRessource(d, jeton) {
    return this.ficheRessource(d.slug, jeton, d);
  }

  ficheRessource(slug, jeton, carte = null) {
    const zone = el("div", {}, attente("Je regarde ta ressource"));
    this.api.ressources().then((l) => {
      if (jeton !== this.jeton) return;
      const liste = this.noterEtatsRessources(l.ressources || []);
      const r = liste.find((x) => x.slug === slug);
      zone.replaceChildren(...(r ? this.corpsRessource(r, jeton, liste, carte)
        : [el("p", { class: "vide-doux" }, "Je ne trouve pas encore cette ressource : demande-la à ton head of content dans le chat.")]));
      if (r?.etat === "mise_a_jour") this.relireRessources(jeton);
    }, (e) => { if (jeton === this.jeton) zone.replaceChildren(el("p", { class: "recap-erreur" }, e.message)); });
    return zone;
  }

  corpsRessource(r, jeton, liste, carte = null) {
    const s = this.studio;
    const chatId = r.contenu ? `${r.contenu.slug}:hoc` : "general";
    const envoyer = async (texte, bouton) => {
      bouton.disabled = true;
      try { await this.api.envoyer(chatId, texte); annoncer(`C'est demandé à ton head of content : sa réponse arrive dans le chat ${ouChat()}.`); return true; }
      catch (e) { annoncer(e.message, "erreur"); bouton.disabled = false; return false; }
    };
    const demander = (texte, libelle) => {
      const b = el("button", { class: "bouton", type: "button", html: `${icone("bulle")}<span>${libelle}</span>` });
      b.addEventListener("click", () => envoyer(texte, b));
      return b;
    };
    const blocs = [];
    const surLeSite = ["en_ligne", "mise_a_jour", "erreur", "injoignable"].includes(r.etat);

    // 1. Le lien, en premier, puis l'état lu à l'adresse même de la page.
    if (surLeSite && r.lien) {
      const reel = r.en_ligne_reel || {};
      const lien = el("a", { class: "res-lien", href: r.lien, target: "_blank", rel: "noopener noreferrer" },
        el("span", { html: icone("lien") }), el("span", {}, r.lien.replace(/^https:\/\//, "")));
      lien.addEventListener("click", (e) => {
        e.preventDefault();
        this.api.ouvrirLien(r.lien).then(() => annoncer("C'est ouvert dans ton navigateur."), (x) => annoncer(x.message, "erreur"));
      });
      const etat = el("div", { class: `res-etat res-etat-${r.etat}`, role: "status" },
        r.etat === "mise_a_jour" ? el("span", { class: "points", "aria-hidden": "true" }, el("i"), el("i"), el("i")) : el("span", { class: "res-point", "aria-hidden": "true" }),
        el("div", {}, el("strong", {}, ETATS_RESSOURCE[r.etat].texte.charAt(0).toUpperCase() + ETATS_RESSOURCE[r.etat].texte.slice(1)),
          el("p", {}, r.etat === "en_ligne" ? "La page répond à son adresse, dans sa dernière version. Ouvre-la pour la vérifier en vrai." : reel.texte || ""),
          reel.detail ? el("p", { class: "res-detail" }, `Détail : ${reel.detail}`) : null));
      blocs.push(el("section", { class: "res-tete" }, lien, el("div", { class: "res-tete-outils" }, this.boutonCopier(r.lien)), etat,
        r.etat === "erreur" ? demander(`La ressource gratuite « ${r.titre} » est en erreur : ${reel.texte}${reel.detail ? ` (détail : ${reel.detail})` : ""}. Regarde ce qui coince, remets-la en ligne et donne-moi le lien quand elle répond.`, "Lui demander de régler ça") : null));
    } else if (r.etat === "en_preparation") {
      blocs.push(this.etape("<strong>Pas encore en ligne.</strong> Ton head of content la met en ligne dès qu'elle est prête et te donne le lien dans le chat.",
        r.a_corriger.length ? demander(`Termine la page de la ressource « ${r.titre} » pour qu'elle puisse partir en ligne. Ce qui bloque encore :\n${r.a_corriger.map((x) => `- ${x}`).join("\n")}`, "Lui demander de la finir") : null));
      if (r.a_corriger.length) blocs.push(this.bloc("Ce qui bloque encore", el("ul", { class: "res-liste" }, ...r.a_corriger.map((x) => el("li", {}, x)))));
    } else {
      blocs.push(this.etape("<strong>Pas encore de page.</strong> Demande-la à ton head of content dans le chat."));
    }

    // 2. Demander une modification : elle part dans le chat du contenu, et la page est remise en ligne derrière.
    if (r.etat !== "sans_page") {
      const champ = el("textarea", { class: "champ res-demande-champ", rows: "3", "aria-label": "La modification à faire",
        placeholder: surLeSite ? "Ce que tu veux changer sur la page" : "Ce que tu veux changer avant qu'elle parte" });
      const go = el("button", { class: "bouton bouton-plein", type: "button", html: `${icone("bulle")}<span>Demander dans le chat</span>` });
      // Un texte en cours d'écriture n'est jamais effacé par une relecture de la vue.
      const libere = () => { this.edition = null; if (this.aRecharger) this.afficher(); };
      champ.addEventListener("input", () => { if (champ.value.trim()) this.edition = "ressource"; else libere(); });
      go.addEventListener("click", async () => {
        const texte = champ.value.trim();
        if (!texte) { champ.focus(); annoncer("Écris d'abord ce que tu veux changer."); return; }
        const ok = await envoyer(surLeSite
          ? `Modifie la ressource gratuite « ${r.titre} » (${r.lien}) : ${texte}\nRemets-la en ligne ensuite et donne-moi le lien.`
          : `Pour la ressource gratuite « ${r.titre} » : ${texte}`, go);
        if (ok) { champ.value = ""; go.disabled = false; libere(); }
      });
      blocs.push(this.bloc("Demander une modification", el("div", { class: "res-demande" },
        el("p", { class: "vide-doux" }, surLeSite ? "Ton head of content la modifie et la remet en ligne : quelques secondes, puis le lien reste le même." : "Ton head of content en tient compte avant de la mettre en ligne."),
        champ, el("div", { class: "programmer-ligne" }, go))));
    }

    // 3. Le mot, le message envoyé, et si un post peut déjà l'offrir.
    const champs = [
      el("dt", {}, "Mot à commenter"), el("dd", {}, r.mot ? el("strong", { class: "mot-com" }, r.mot) : el("span", { class: "doux" }, "Pas encore choisi")),
      el("dt", {}, "Message envoyé"), el("dd", {}, r.message ? el("div", { class: "res-message" }, el("p", {}, r.message), r.bouton ? el("span", { class: "res-bouton" }, r.bouton) : null) : el("span", { class: "doux" }, "Pas encore écrit")),
      el("dt", {}, "Pour un post"), el("dd", {}, r.prete ? el("span", { class: "res-ok" }, "Prête : tu peux la choisir en préparant un post.")
        : surLeSite && r.repond && r.mot && !(r.bloquants || []).length ? el("span", { class: "res-ok" }, "Prête : tu peux la choisir en préparant un post. Ton clic pour le poster validera son message, que tu pourras encore retoucher.")
        // La vraie raison d'abord : une page envoyée qui ne répond pas encore n'a pas un « message incomplet »
        // (test de bout en bout du 18/11) ; la liste ne garde que ce qui bloque vraiment.
        : el("div", {}, el("span", { class: "doux" }, !surLeSite ? "Pas encore : elle doit d'abord être en ligne."
            : !r.repond ? "Pas encore : la page doit d'abord répondre à son adresse."
            : !r.mot ? "Pas encore : il lui faut un mot à commenter." : "Pas encore : le message doit être complet."),
          surLeSite && (r.bloquants || []).length ? el("ul", { class: "res-liste" }, ...r.bloquants.map((x) => el("li", {}, x))) : null)),
    ];
    blocs.push(this.bloc("Le mot en commentaire", el("dl", { class: "recap-champs res-champs" }, ...champs)));

    // 4. Les posts qui l'offrent (registre des publications).
    blocs.push(this.bloc("Posts reliés", r.posts.length ? el("div", { class: "accueil-liste" }, ...r.posts.map((p) => {
      const c = s.cartes.get(p.slug);
      const quand = p.quand ? `${p.statut === "publié" ? "sorti" : "part"} ${quandLisible(String(p.quand).replace("T", " ").slice(0, 16))}` : p.statut || "";
      const mot = p.regle === "posee" ? `mot ${p.mot || r.mot} branché` : p.regle === "erreur" ? "mot pas branché" : null;
      return el("button", { class: `accueil-ligne${c ? ` f-${c.format}` : ""}`, type: "button", disabled: c ? null : true, onclick: c ? () => s.selectionner({ genre: "dossier", cle: cle(c) }) : null },
        el("span", { class: "ligne-corps" }, el("strong", {}, p.titre), el("span", { class: "ligne-meta" }, [quand, mot].filter(Boolean).join(" · "))),
        c ? el("span", { html: icone("fleche") }) : null);
    })) : el("p", { class: "vide-doux" }, "Aucun post ne l'offre encore."), { aide: r.posts.length ? pluriel(r.posts.length, "post", "posts") : null }));

    // 5. La réutiliser avec un autre contenu : la légende de ce contenu doit annoncer le mot.
    if (r.prete) {
      const cibles = [...s.cartes.values()].filter((c) => c.slug && c.slug !== r.slug && !["programme", "publie", "abandonne", "de_cote"].includes(c.stade))
        .sort((a, b) => a.titre.localeCompare(b.titre, "fr"));
      if (cibles.length) {
        const choix = el("select", { class: "champ res-choix", "aria-label": "Le contenu qui offrira cette ressource" },
          ...cibles.map((c) => el("option", { value: c.slug }, c.titre)));
        const go = el("button", { class: "bouton", type: "button", html: `${icone("bulle")}<span>Préparer sa légende</span>` });
        go.addEventListener("click", async () => {
          const cible = choix.value; go.disabled = true;
          try {
            await this.api.envoyer(`${cible}:hoc`, `Je veux offrir la ressource gratuite « ${r.titre} » avec ce contenu : ceux qui commentent ${r.mot} la recevront. Ajoute l'appel à commenter ${r.mot} dans la légende, sans changer le reste. Je choisirai la ressource au moment de le préparer à poster.`);
            annoncer("C'est demandé : ton head of content ajoute le mot à la légende de ce contenu.");
            s.selectionner({ genre: "dossier", cle: cible });
          } catch (e) { annoncer(e.message, "erreur"); go.disabled = false; }
        });
        blocs.push(this.bloc("L'offrir avec un autre contenu", el("div", { class: "res-reutiliser" },
          el("p", { class: "vide-doux" }, `Choisis le contenu : ton head of content ajoute le mot ${r.mot} à sa légende. Au moment de le programmer, tu choisis cette ressource dans la liste.`),
          el("div", { class: "programmer-ligne" }, choix, go))));
      }
    }
    return blocs;
  }

  // ---------- Publier sur Instagram (refait au lot 10 des deux studios) ----------
  // Une carte par contenu prêt (titre, image du hook). « Préparer à poster » ouvre le récapitulatif : légende et message
  // retouchables, ressource, reel d'essai ; le quand (jour et heure, ou tout de suite) se choisit après, en bas. Plusieurs
  // cartes cochées se préparent ensemble. Rien ne part sans le clic final (programmer.js).
  vuePublier() {
    const s = this.studio;
    const cs = [...s.cartes.values()];
    const prets = cs.filter((c) => ["monte", "mis_en_page"].includes(c.stade)).sort((a, b) => (a.format === b.format ? 0 : a.format === "reel" ? -1 : 1) || a.titre.localeCompare(b.titre, "fr"));
    const programmes = cs.filter((c) => c.stade === "programme").sort((a, b) => String(a.publication_quand).localeCompare(String(b.publication_quand)));
    this.choixPublier ||= new Set();
    for (const k of [...this.choixPublier]) if (!prets.some((c) => c.slug === k)) this.choixPublier.delete(k);
    const zone = el("div", { class: "zone-recap", id: "preparation" });
    const preparer = (liste) => {
      const pris = new Set();
      const quands = new Map(liste.map((c) => [c.slug, this.quandParDefaut(c, pris)]));
      // Pendant la préparation, l'écran ne se redessine pas tout seul (il effacerait ce que tu relis).
      this.edition = "recap";
      for (const c of prets) cartes.get(c.slug)?.classList.toggle("en-preparation", liste.some((x) => x.slug === c.slug));
      recapDans(s, zone, (elements) => this.api.recap(elements || liste.map((c) => ({ slug: c.slug, quand: "maintenant" }))), {
        quands, apres: () => { this.choixPublier = new Set(); },
        fermer: () => { this.edition = null; this.afficher(); },
      });
      setTimeout(() => defiler(zone, "debut"), 50);
    };
    const groupe = el("button", { class: "bouton bouton-plein pub-groupe", type: "button" });
    const vider = el("button", { class: "bouton bouton-discret bouton-petit", type: "button" }, "Tout décocher");
    const barre = el("div", { class: "pub-barre", role: "region", "aria-label": "Préparer plusieurs contenus ensemble" },
      el("p", { class: "pub-barre-texte" }), groupe, vider);
    const majGroupe = () => {
      const n = this.choixPublier.size;
      barre.hidden = n < 1;
      barre.querySelector(".pub-barre-texte").textContent = n > 1 ? `${n} contenus choisis : tu les prépares ensemble, puis tu choisis quand chacun part.` : "1 contenu choisi : coche-en d'autres pour les préparer ensemble.";
      groupe.disabled = n < 2;
      groupe.innerHTML = `${icone("envoi")}<span>${n > 1 ? `Préparer les ${n} à poster` : "Préparer ensemble"}</span>`;
      for (const [k, n2] of cartes) n2.classList.toggle("choisie", this.choixPublier.has(k));
    };
    groupe.addEventListener("click", () => preparer(prets.filter((c) => this.choixPublier.has(c.slug))));
    vider.addEventListener("click", () => { this.choixPublier.clear(); for (const x of grille.querySelectorAll("input[type=checkbox]")) x.checked = false; majGroupe(); });
    const cartes = new Map();
    const grille = el("div", { class: "pub-grille" }, ...prets.map((c) => {
      const caseC = el("input", { type: "checkbox", checked: this.choixPublier.has(c.slug) || null, id: `pub-${c.slug}` });
      caseC.addEventListener("change", () => { if (caseC.checked) this.choixPublier.add(c.slug); else this.choixPublier.delete(c.slug); majGroupe(); });
      const image = c.vignette
        ? el("img", { class: "pub-image", src: c.vignette, alt: c.format === "reel" ? `Le début de la vidéo « ${c.titre} »` : `La première image du carrousel « ${c.titre} »`, width: c.format === "reel" ? "180" : "200", height: c.format === "reel" ? "320" : "250", loading: "lazy" })
        : el("span", { class: "pub-image pub-image-vide" }, c.format === "reel" ? "Pas encore d'image de la vidéo" : "Pas encore d'image du carrousel");
      if (c.vignette) image.addEventListener("error", () => image.replaceWith(el("span", { class: "pub-image pub-image-vide" }, "Image pas disponible")), { once: true });
      const bouton = el("button", { class: "bouton bouton-plein pub-preparer", type: "button", html: `${icone("envoi")}<span>Préparer à poster</span>` });
      bouton.addEventListener("click", () => preparer([c]));
      const carte = el("article", { class: `pub-carte f-${c.format}`, dataset: { slug: c.slug } },
        el("div", { class: `pub-media pub-media-${c.format}` }, image,
          el("label", { class: "pub-choix", for: `pub-${c.slug}` }, caseC, el("span", {}, "Choisir"))),
        el("div", { class: "pub-corps" },
          el("span", { class: `tag tag-format f-${c.format}` }, el("span", { class: `pastille pastille-${c.format}`, "aria-hidden": "true" }), c.format === "reel" ? "Reel monté" : "Carrousel mis en page"),
          el("button", { class: "pub-titre lien-texte", type: "button", onclick: () => s.selectionner({ genre: "dossier", cle: cle(c) }) }, c.titre),
          bouton));
      cartes.set(c.slug, carte);
      return carte;
    }));
    majGroupe();
    // Arrivé depuis le fichier « Vidéo montée » ou « Images » : sa carte est mise en avant.
    if (s.sel.vers) {
      const k = s.sel.vers; delete s.sel.vers;
      setTimeout(() => { const n = cartes.get(k); if (n) { defiler(n, "centre"); n.querySelector(".pub-preparer")?.focus({ preventScroll: true }); } }, 60);
    }
    const ligneSimple = (c, meta) => el("button", { class: `accueil-ligne f-${c.format}`, type: "button", onclick: () => s.selectionner({ genre: "dossier", cle: cle(c) }) },
      el("span", { class: `pastille pastille-${c.format}`, "aria-hidden": "true" }), el("span", { class: "ligne-corps" }, el("strong", {}, c.titre), el("span", { class: "ligne-meta" }, meta)), el("span", { html: icone("fleche") }));
    return el("article", { class: "vue" }, ...this.entete("Publier sur Instagram", "Prépare ce qui est prêt : tu relis sa légende et ce qu'il offre, puis tu choisis s'il part tout de suite ou à un jour et une heure, même Mac fermé. Rien ne part sans ton clic."),
      this.bloc("Prêts à poster", prets.length ? el("div", {}, grille, barre)
        : el("p", { class: "vide-doux" }, "Rien de prêt pour l'instant : une vidéo montée ou un carrousel mis en page arrive ici."),
      { aide: prets.length ? `${pluriel(prets.length, "contenu", "contenus")}${prets.length > 1 ? ", coche-en plusieurs pour les préparer ensemble" : ""}` : null }),
      zone,
      this.bloc("Déjà programmés", programmes.length ? el("div", { class: "accueil-liste" }, ...programmes.map((c) => ligneSimple(c, c.publication_quand ? `part ${quandLisible(c.publication_quand)}` : c.libelle)))
        : el("p", { class: "vide-doux" }, "Rien de programmé."), { aide: programmes.length ? pluriel(programmes.length, "contenu", "contenus") : null }));
  }
}

// Fait défiler la colonne du fichier ouvert jusqu'à un élément, sans faire bouger la page entière (scrollIntoView fait
// aussi défiler le corps de la page, qui ne défile pas : la barre du haut sortait de l'écran). Téléphone : la page défile.
function defiler(n, ou = "debut") {
  const col = n.closest(".col-vue");
  if (!col || col.scrollHeight <= col.clientHeight || getComputedStyle(col).overflowY === "visible") { n.scrollIntoView({ block: ou === "centre" ? "center" : "start" }); return; }
  const r = n.getBoundingClientRect(), c = col.getBoundingClientRect();
  const haut = col.scrollTop + r.top - c.top - (ou === "centre" ? (col.clientHeight - r.height) / 2 : 16);
  col.scrollTo({ top: Math.max(0, haut), behavior: ou === "centre" ? "auto" : "smooth" });
}

export { ICONES_FICHIERS };
