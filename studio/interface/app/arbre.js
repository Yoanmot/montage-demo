// L'arborescence de gauche : en haut les entrées transverses, puis un dossier par idée (fond teinté
// selon le format, étiquette courte du stade dans « En cours » seulement), et dans chaque dossier ses
// fichiers, qui apparaissent au fil des étapes (contrat, section 14, lot 10).

import { el, icone } from "./outils.js";
import { cle, NOMS_FICHIERS, ICONES_FICHIERS, fichierParDefaut } from "./commun.js";

const GROUPES = [
  { id: "proposees", titre: "Idées proposées", ok: (c) => c.stade === "proposee", vide: "Demande « fais-moi 10 idées » dans le chat : chaque idée arrive ici dans son dossier." },
  { id: "en-cours", titre: "En cours", ok: (c) => c.slug && !["publie", "abandonne"].includes(c.stade), tags: true },
  { id: "publies", titre: "Publiés", ok: (c) => c.stade === "publie", ferme: true },
  { id: "cote", titre: "Mis de côté", ok: (c) => ["abandonne", "de_cote"].includes(c.stade), ferme: true },
];

// Les étapes d'un dossier, de la première à « publié » (lot 12) : un segment par étape, rempli en orange
// pour celles qui sont franchies.
const ETAPES = {
  reel: ["gardee", "script_ecrit", "valide", "tournage_prevu", "rushs_recus", "planche", "monte", "programme", "publie"],
  carrousel: ["gardee", "script_ecrit", "valide", "mis_en_page", "programme", "publie"],
};
function progression(c) {
  const e = ETAPES[c.format] || ETAPES.reel;
  const i = e.indexOf(c.stade);
  if (i < 0) return null;
  return el("span", { class: "progression", role: "img", "aria-label": `étape ${i + 1} sur ${e.length}` },
    ...e.map((_, k) => el("i", { class: k <= i ? "fait" : null })));
}

// Ce que dit un fichier à côté de son nom, selon le stade du dossier.
function etatFichier(c, f, etatsRessources = null) {
  const s = c.stade;
  if (f === "idee" && s === "proposee") return ["à garder ?", true];
  if (f === "idee" && s === "de_cote") return ["en réserve", false];
  if (f === "brief") {
    if (s === "script_ecrit") return ["à relire", true];
    if (s === "gardee" && c.activite) return ["en cours", false];
    if (["valide", "tournage_prevu", "rushs_recus", "planche", "monte", "mis_en_page", "programme", "publie"].includes(s)) return ["validé", false];
  }
  if (f === "montage") {
    if (s === "rushs_recus") return c.activite === "en_cours" ? ["en cours", false] : c.activite === "en_file" ? ["en attente", false] : ["à vérifier", true];
    if (s === "planche") return c.activite === "en_cours" ? ["en cours", false] : ["aperçu à valider", true];
  }
  if (f === "ressource") {
    if (c.ressource === "en_ligne") {
      // Dans le site, mais lue à son adresse ? L'état réel s'il est connu (liste des ressources déjà lue).
      const reel = etatsRessources?.get(c.slug);
      if (reel === "mise_a_jour") return ["mise en ligne", false];
      if (reel === "erreur") return ["en erreur", true];
      return ["en ligne", false];
    }
    if (c.ressource === "brouillon") return ["en préparation", false];
    return ["en préparation", false];
  }
  if (f === "video" || f === "slides") {
    if (s === "programme") return ["programmée", false];
    if (s === "publie") return ["publiée", false];
    if (s === "monte" || s === "mis_en_page") return ["à programmer", false];
  }
  return null;
}

export class Arbre {
  constructor(studio, racine) {
    this.studio = studio;
    this.racine = racine;
    this.groupesFermes = new Set(GROUPES.filter((g) => g.ferme).map((g) => g.id));
    this.connus = null; // clés déjà vues : une nouvelle idée s'allume en arrivant
    this.fichiersConnus = new Map();
    racine.addEventListener("keydown", (e) => this.clavier(e));
  }

  visible(c) {
    const f = this.studio.filtres.format;
    return f === "tous" || c.format === f;
  }

  dessiner() {
    const s = this.studio;
    const focus = document.activeElement?.closest?.("[data-nav]")?.dataset.nav;
    const premier = this.connus === null;
    this.connus ||= new Set();
    const enfants = [this.dessinerEntrees()];
    const toutes = [...s.cartes.values()].filter((c) => this.visible(c));
    const ordre = (a, b) => (b.a_toi - a.a_toi)
      || String(a.jour_prevu || "9999").localeCompare(String(b.jour_prevu || "9999")) || a.titre.localeCompare(b.titre, "fr");
    for (const g of GROUPES) {
      const cs = toutes.filter(g.ok);
      if (g.id === "proposees") cs.sort((a, b) => String(b.maj || "").localeCompare(String(a.maj || "")) || a.titre.localeCompare(b.titre, "fr"));
      else cs.sort(ordre);
      if (!cs.length && g.id !== "proposees" && g.id !== "en-cours") continue;
      const ferme = this.groupesFermes.has(g.id);
      const tete = el("button", { class: "groupe-tete", type: "button", "aria-expanded": String(!ferme), html: `${icone("bas")}<span>${g.titre}</span><span class="compte">${cs.length}</span>` });
      tete.addEventListener("click", () => { if (ferme) this.groupesFermes.delete(g.id); else this.groupesFermes.add(g.id); this.dessiner(); });
      const corps = el("div", { role: "group" });
      if (!ferme) {
        if (!cs.length) corps.append(el("p", { class: "groupe-vide" }, g.vide || "Rien pour l'instant."));
        for (const c of cs) corps.append(...this.dessinerDossier(c, premier, g.tags));
      }
      enfants.push(el("section", { class: `groupe groupe-${g.id}` }, tete, corps));
    }
    this.racine.replaceChildren(...enfants);
    for (const c of s.cartes.values()) this.connus.add(cle(c));
    if (focus) this.racine.querySelector(`[data-nav="${CSS.escape(focus)}"]`)?.focus({ preventScroll: true });
    const choisi = this.racine.querySelector('[aria-selected="true"]');
    if (choisi && !this._defile) { choisi.scrollIntoView({ block: "nearest" }); }
  }

  // ---------- Entrées transverses ----------
  // Vue d'ensemble (les chiffres), juste dessous la publication sur Instagram, puis les tournages et
  // « À ranger » (le seul compteur orange : il attend Romain).
  dessinerEntrees() {
    const s = this.studio;
    const ent = [];
    const entree = (quoi, libelle, ico, nb, urgente) => {
      const choisi = s.sel.genre === (quoi === "accueil" ? "accueil" : "transverse") && (quoi === "accueil" || s.sel.quoi === quoi);
      const n = el("div", { class: `entree${urgente ? " urgente" : ""}`, role: "treeitem", tabindex: "0", "aria-selected": String(choisi), dataset: { nav: `t:${quoi}` } },
        el("span", { html: icone(ico) }), el("span", {}, libelle), nb ? el("span", { class: "entree-nb" }, String(nb)) : null);
      n.addEventListener("click", () => s.selectionner(quoi === "accueil" ? { genre: "accueil" } : { genre: "transverse", quoi }));
      ent.push(n);
    };
    const cs = [...s.cartes.values()];
    entree("accueil", "Vue d'ensemble", "maison");
    entree("publier", "Publier sur Instagram", "envoi", cs.filter((c) => ["monte", "mis_en_page"].includes(c.stade)).length || null);
    entree("tournage", "Tournages", "camera", s.tournages.filter((t) => t.en_cours || t.a_finir).length || null);
    // Seulement pour un client qui a un site de ressources gratuites (studio de Yoan).
    if (s.config.ressources) entree("ressources", "Ressources gratuites", "cadeau");
    // Toujours là (test de Yoan, AirDrop lent) : on doit pouvoir la trouver même vide ; compteur orange
    // quand un fichier attend, y compris un rush arrivé sur le Mac après la fin d'un tournage.
    entree("ranger", "À ranger", "ranger", s.a_ranger.length || null, s.a_ranger.length > 0);
    return el("div", { class: "entrees", role: "group", "aria-label": "Vues d'ensemble" }, ...ent);
  }

  // ---------- Un dossier et ses fichiers ----------
  dessinerDossier(c, premier, avecTags = false) {
    const s = this.studio;
    const k = cle(c);
    const ouvert = s.ouverts.has(k);
    const choisiDossier = s.sel.genre === "dossier" && s.sel.cle === k;
    const nouveau = !premier && !this.connus.has(k);
    const ligne = el("div", {
      class: `ligne dossier f-${c.format}${nouveau ? " nouveau" : ""}`, role: "treeitem", tabindex: "0",
      "aria-expanded": String(ouvert), "aria-selected": String(choisiDossier && !ouvert), dataset: { nav: `d:${k}` },
      "aria-label": `${c.titre}, ${c.format === "reel" ? "reel" : "carrousel"}, ${c.a_toi ? "attend ta réponse" : c.libelle}`,
    });
    const chevron = el("button", { class: "chevron", type: "button", tabindex: "-1", "aria-label": ouvert ? "Fermer le dossier" : "Ouvrir le dossier", html: icone("fleche") });
    chevron.addEventListener("click", (e) => { e.stopPropagation(); this.basculer(k); });
    // Pas de case à cocher (lot 11) : les actions en lot se choisissent dans la vue qui les concerne
    // (Tournages, Publier sur Instagram, ou le fichier où vit le bouton de l'action).
    const parts = [chevron];
    const tags = this.etiquettes(c, avecTags);
    parts.push(el("span", { class: "ligne-corps" }, el("span", { class: "ligne-titre" }, c.titre),
      tags.length ? el("span", { class: "ligne-meta" }, ...tags) : null,
      avecTags ? progression(c) : null));
    ligne.append(...parts);
    ligne.addEventListener("click", () => {
      if (choisiDossier && ouvert && s.sel.fichier === fichierParDefaut(c)) { this.basculer(k); return; }
      s.selectionner({ genre: "dossier", cle: k });
    });
    if (c.slug && !["publie", "abandonne"].includes(c.stade)) s.rangement.cible(ligne, c);
    const r = [ligne];
    if (ouvert) {
      const avant = this.fichiersConnus.get(k);
      const liste = el("ul", { class: "fichiers", role: "group" });
      for (const f of c.fichiers || ["idee"]) {
        const choisi = choisiDossier && s.sel.fichier === f;
        const etat = etatFichier(c, f, s.etatsRessources);
        const n = el("li", { class: `fichier${avant && !avant.includes(f) ? " nouveau" : ""}`, role: "treeitem", tabindex: "0", "aria-selected": String(choisi), dataset: { nav: `f:${k}:${f}` } },
          el("span", { html: icone(ICONES_FICHIERS[f]) }), el("span", {}, NOMS_FICHIERS[f]),
          etat ? el("span", { class: `fichier-etat${etat[1] ? " a-toi" : ""}` }, etat[0]) : null);
        n.addEventListener("click", () => s.selectionner({ genre: "dossier", cle: k, fichier: f }));
        liste.append(n);
      }
      r.push(liste);
    }
    this.fichiersConnus.set(k, [...(c.fichiers || ["idee"])]);
    return r;
  }

  // Ce qui se fait en ce moment (attend ta réponse, en cours...) partout ; le stade seulement dans
  // « En cours » (les autres sections le disent déjà par leur titre).
  etiquettes(c, avecStade = false) {
    const r = [];
    if (c.a_toi) r.push(el("span", { class: "tag tag-a-toi" }, el("span", { class: "rond", "aria-hidden": "true" }), "attend ta réponse"));
    else if (c.activite === "en_cours") r.push(el("span", { class: "tag tag-cours" }, "en cours"));
    else if (c.activite === "en_file") r.push(el("span", { class: "tag tag-file" }, "en attente"));
    else if (c.activite === "erreur") r.push(el("span", { class: "tag tag-erreur", title: c.erreur_message || "" }, "souci"));
    if (avecStade) r.push(el("span", { class: "tag tag-stade" }, c.libelle));
    return r;
  }

  basculer(k) {
    const s = this.studio;
    if (s.ouverts.has(k)) s.ouverts.delete(k); else s.ouverts.add(k);
    this.dessiner();
  }

  // Flèches haut et bas pour passer d'une ligne à l'autre, droite et gauche pour ouvrir et fermer.
  clavier(e) {
    const items = [...this.racine.querySelectorAll("[data-nav]")];
    const i = items.indexOf(document.activeElement);
    if (i < 0) return;
    const n = items[i];
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      items[Math.max(0, Math.min(items.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))]?.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault(); n.click();
    } else if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && n.dataset.nav.startsWith("d:")) {
      const k = n.dataset.nav.slice(2);
      const ouvert = this.studio.ouverts.has(k);
      if ((e.key === "ArrowRight") !== ouvert) { e.preventDefault(); this.basculer(k); }
    }
  }
}
