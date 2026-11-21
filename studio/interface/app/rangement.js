// Les vidéos et photos que le studio n'a pas su ranger tout seul (vue « À ranger », lot 9).
// Romain choisit « Mettre dans… » ou glisse le fichier sur un dossier de l'arborescence, puis confirme.

import { el, icone, annoncer } from "./outils.js";

const TYPES = [["face", "vidéo face caméra"], ["b-roll", "plan filmé en plus"], ["photo", "photo"]];
const MIME = "application/x-studio-clip";

export class Rangement {
  constructor(studio) {
    this.studio = studio; this.api = studio.api;
    this.racine = el("section", { class: "ranger", "aria-label": "Fichiers à ranger" });
    this.choix = new Map(); // nom -> { slug, type }
    this.glisse = null;
  }

  nomLisible(f) {
    if (f.libelle) return f.libelle;
    return /\.(jpe?g|heic|png)$/i.test(f.nom) ? "une photo" : "une vidéo";
  }

  dessiner() {
    const tous = this.studio.a_ranger || [];
    // Les rushs arrivés sur le Mac pour un tournage pas fini de ranger (encore dans ses Téléchargements) :
    // en haut, avec « Ranger maintenant » ; puis ce que le rangement a mis de côté.
    const attente = tous.filter((f) => f.attente);
    const fs = tous.filter((f) => !f.attente);
    if (!tous.length) { this.racine.replaceChildren(); return; }
    const blocs = [];
    if (attente.length) blocs.push(this.dessinerAttente(attente));
    if (fs.length) {
      const relancer = el("button", { class: "bouton bouton-discret bouton-petit ranger-relancer", type: "button", html: `${icone("synchro")}<span>Réessayer de tout ranger</span>` });
      relancer.addEventListener("click", async () => { relancer.disabled = true; try { await this.api.relancerRangement(); annoncer("Je réessaie."); } catch (e) { annoncer(e.message, "erreur"); } finally { relancer.disabled = false; } });
      blocs.push(el("div", { class: "ranger-liste" }, ...fs.map((f) => this.dessinerFichier(f))), el("div", { class: "bloc-pied ranger-relancer-pied" }, relancer));
    }
    this.racine.replaceChildren(...blocs);
  }

  // Un groupe par plan de tournage : chaque fichier reçu ou en cours de réception, et un bouton qui range
  // ce plan (il ne s'active qu'une fois tous ses fichiers arrivés en entier).
  dessinerAttente(attente) {
    const plans = [...new Set(attente.map((f) => f.tournage))];
    return el("div", { class: "ranger-attente" }, ...plans.map((id) => {
      const fs = attente.filter((f) => f.tournage === id);
      const arrive = fs.some((f) => f.en_cours);
      const t = (this.studio.tournages || []).find((x) => x.id === id);
      const quand = t?.cree_le ? new Date(t.cree_le).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : null;
      const go = el("button", { class: "bouton bouton-plein bouton-petit", type: "button", disabled: arrive || null, html: `${icone("coche")}<span>Ranger maintenant</span>` });
      go.addEventListener("click", async () => {
        go.disabled = true;
        try { await this.api.validerTournage(id); annoncer("Je range tes fichiers dans leurs dossiers."); }
        catch (e) { annoncer(e.message, "erreur"); go.disabled = false; }
      });
      return el("div", { class: "ranger-liste" },
        ...fs.map((f) => {
          // Arrivée en entier : elle se range aussi à la main (choisir le contenu, ou la glisser sur un dossier).
          const ch = f.en_cours ? null : this.choix.get(f.nom);
          const n = el("article", { class: "ranger-fichier", "aria-label": f.libelle, draggable: f.en_cours ? null : "true" },
            f.en_cours ? null : el("span", { class: "poignee", "aria-hidden": "true", html: icone("poignee") }),
            el("div", { class: "ranger-media" }, el("div", { class: "ranger-vignette ranger-vignette-vide", html: icone(f.libelle === "ta photo" ? "photo" : "film") })),
            el("div", { class: "ranger-corps" },
              el("p", { class: "ranger-nom" }, `${f.libelle.replace(/^./, (x) => x.toUpperCase())}${quand ? `, pour ton tournage du ${quand}` : ""}`),
              f.en_cours
                ? el("p", { class: "recap-charge", role: "status" }, el("span", { class: "points", "aria-hidden": "true" }, el("i"), el("i"), el("i")), `En cours de réception : ${f.taille_lisible} reçus pour l'instant`)
                : el("p", { class: "ranger-raison" }, `${String(f.raison || "arrivée en entier, pas encore rangée").replace(/^./, (x) => x.toUpperCase())} (${f.taille_lisible}).`),
              f.en_cours ? null : ch ? this.confirmation(f, ch) : el("div", { class: "ranger-actions" }, this.menu(f))));
          if (!f.en_cours) this.glissable(n, f);
          return n;
        }),
        el("div", { class: "bloc-pied" }, go, el("span", { class: "note" }, arrive
          ? "Le bouton s'active quand l'envoi est fini. Laisse ton téléphone près du Mac."
          : "Je range dans son contenu ce que je reconnais, le reste revient ici. Tu peux aussi choisir toi-même avec « Mettre dans... ».")));
    }));
  }

  // Une face caméra pas reconnue (lot 15, bandeau « Arrivés, à placer » de la Galerie) : son jour et sa durée.
  nomFace(f) {
    const jour = f.pris_le ? new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "short" }).format(new Date(f.pris_le)) : null;
    const d = Number(f.duree_s);
    const duree = d > 0 ? ` (${Math.floor(d / 60)}:${String(Math.round(d % 60)).padStart(2, "0")})` : "";
    return `Vidéo face caméra${jour ? ` du ${jour}` : ""}${duree}`;
  }

  dessinerFichier(f) {
    const face = f.type === "face";
    const nom = face ? this.nomFace(f) : this.nomLisible(f);
    const apercu = f.vignette_url
      ? el("img", { class: "ranger-vignette", src: f.vignette_url, alt: "", width: "72", height: "128", draggable: "false" })
      : el("div", { class: "ranger-vignette ranger-vignette-vide", html: icone("film") });
    const lire = el("button", { class: "ranger-lire", type: "button", "aria-label": `Regarder ${nom}`, html: icone("lecture") });
    const media = el("div", { class: "ranger-media" }, apercu, f.url ? lire : null);
    lire.addEventListener("click", () => {
      const v = el("video", { class: "ranger-vignette", src: f.url, controls: true, autoplay: true, width: "72", height: "128" });
      media.replaceChildren(v);
    });
    const ch = this.choix.get(f.nom);
    // Une photo ou un plan d'avant la Galerie, mis de côté par le rangement : il peut entrer dans la Galerie d'un clic.
    let versGalerie = null;
    if (!face) {
      versGalerie = el("button", { class: "bouton bouton-petit", type: "button", html: `${icone("galerie")}<span>Mettre dans la Galerie</span>` });
      versGalerie.addEventListener("click", async () => {
        versGalerie.disabled = true;
        try { await this.api.versGalerie(f.nom); annoncer("C'est dans ta Galerie : je le décris."); }
        catch (e) { annoncer(e.message, "erreur"); versGalerie.disabled = false; }
      });
    }
    const raison = face ? `${String(f.raison || "je ne retrouve pas à quel reel elle appartient").replace(/^./, (x) => x.toUpperCase())} : dis-moi dans quel reel elle va. Les vidéos face caméra ne restent pas dans la Galerie.` : f.raison;
    const corps = el("div", { class: "ranger-corps" },
      el("p", { class: "ranger-nom" }, nom.replace(/^./, (x) => x.toUpperCase())),
      el("p", { class: "ranger-raison" }, raison),
      ch ? this.confirmation(f, ch) : el("div", { class: "ranger-actions" }, this.menu(f), versGalerie));
    const n = el("article", { class: "ranger-fichier", draggable: "true", "aria-label": nom }, el("span", { class: "poignee", "aria-hidden": "true", html: icone("poignee") }), media, corps);
    this.glissable(n, f);
    return n;
  }

  glissable(n, f) {
    const nom = this.nomLisible(f);
    n.addEventListener("dragstart", (e) => {
      this.glisse = f; e.dataTransfer.setData(MIME, f.nom); e.dataTransfer.setData("text/plain", nom); e.dataTransfer.effectAllowed = "move";
      document.body.classList.add("glisse-clip");
    });
    n.addEventListener("dragend", () => { this.glisse = null; document.body.classList.remove("glisse-clip"); document.querySelectorAll(".cible-on").forEach((x) => x.classList.remove("cible-on")); });
  }

  candidatsDe(f) {
    const cartes = [...this.studio.cartes.values()].filter((c) => c.slug && !["publie", "abandonne", "refusee", "proposee"].includes(c.stade));
    const cands = (f.candidats || []).map((x) => ({ ...x, carte: this.studio.cartes.get(x.slug) })).filter((x) => x.carte);
    const autres = cartes.filter((c) => !cands.some((x) => x.slug === c.slug)).sort((a, b) => a.titre.localeCompare(b.titre, "fr"));
    return { cands, autres };
  }

  menu(f) {
    let { cands, autres } = this.candidatsDe(f);
    // Une face caméra ne va que dans un reel.
    const face = f.type === "face";
    if (face) { cands = cands.filter((x) => x.carte.format === "reel"); autres = autres.filter((c) => c.format === "reel"); }
    const sel = el("select", { class: "champ", "aria-label": face ? "Mettre dans quel reel" : "Mettre dans quel contenu" },
      el("option", { value: "" }, face ? "Mettre dans le reel..." : "Mettre dans..."),
      cands.length ? el("optgroup", { label: "Le plus probable" }, ...cands.map((x) => el("option", { value: x.slug }, x.carte.titre))) : null,
      autres.length ? el("optgroup", { label: "Les autres contenus" }, ...autres.map((c) => el("option", { value: c.slug }, c.titre))) : null);
    sel.addEventListener("change", () => { if (sel.value) this.proposer(f, sel.value); });
    return sel;
  }

  proposer(f, slug) {
    const cand = (f.candidats || []).find((x) => x.slug === slug);
    const type = cand?.type || (f.type === "face" ? "face" : /\.(jpe?g|heic|png)$/i.test(f.nom) ? "photo" : "b-roll");
    this.choix.set(f.nom, { slug, type });
    this.dessiner();
  }

  confirmation(f, ch) {
    const carte = this.studio.cartes.get(ch.slug);
    const type = el("select", { class: "champ", "aria-label": "C'est quoi" }, ...TYPES.map(([v, t]) => el("option", { value: v, selected: v === ch.type || null }, t)));
    type.addEventListener("change", () => { ch.type = type.value; });
    const ok = el("button", { class: "bouton bouton-plein bouton-petit", type: "button", html: `${icone("coche")}<span>Ranger</span>` });
    const non = el("button", { class: "bouton bouton-discret bouton-petit", type: "button" }, "Annuler");
    ok.addEventListener("click", async () => {
      ok.disabled = true;
      try { await this.api.placer(f.nom, ch.slug, ch.type, Boolean(f.attente)); this.choix.delete(f.nom); annoncer(`Rangé dans « ${carte?.titre || "ton contenu"} ».`); }
      catch (e) { annoncer(e.message, "erreur"); ok.disabled = false; }
    });
    non.addEventListener("click", () => { this.choix.delete(f.nom); this.dessiner(); });
    return el("div", { class: "ranger-confirmer" },
      el("p", {}, "Dans ", el("strong", {}, `« ${carte?.titre || "ce contenu"} »`), ", comme"),
      el("div", { class: "ranger-actions" }, type, ok, non));
  }

  // Un dossier de l'arborescence accepte un fichier glissé
  cible(noeud, carte) {
    noeud.classList.add("dossier-cible");
    noeud.addEventListener("dragover", (e) => {
      if (!this.glisse) return;
      e.preventDefault(); e.dataTransfer.dropEffect = "move"; noeud.classList.add("cible-on");
    });
    noeud.addEventListener("dragleave", (e) => { if (!noeud.contains(e.relatedTarget)) noeud.classList.remove("cible-on"); });
    noeud.addEventListener("drop", (e) => {
      if (!this.glisse) return;
      e.preventDefault(); noeud.classList.remove("cible-on");
      const f = this.glisse; this.glisse = null; document.body.classList.remove("glisse-clip");
      this.proposer(f, carte.slug);
      if (this.studio.sel.genre !== "transverse" || this.studio.sel.quoi !== "galerie" || this.studio.sel.id) this.studio.selectionner({ genre: "transverse", quoi: "galerie" });
    });
  }
}
