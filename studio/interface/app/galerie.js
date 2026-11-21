// La Galerie (lot 15, CONTRAT-STUDIO.md section 18) : les photos et les b-rolls gardés pour resservir. La vue de la
// Galerie (bandeau « Arrivés, à placer », recherche, filtres, tri, grille, ajout par bouton ou glisser-déposer), la
// fiche d'un fichier (page à part), le sélecteur réutilisé par les carrousels, le brief d'un reel et le montage.
// Tout ce qui s'affiche vient du serveur (fiches écrites par des scripts), jamais de la mémoire d'un modèle.

import { el, icone, annoncer, pluriel } from "./outils.js";

const VIDEOS = [".mov", ".mp4", ".m4v", ".hevc"];
const PHOTOS = [".jpg", ".jpeg", ".heic", ".heif", ".png", ".dng"];
const MAX = 20 * 1024 ** 3;
const ext = (nom) => { const i = nom.lastIndexOf("."); return i > 0 ? nom.slice(i).toLowerCase() : ""; };
const genreFichier = (nom) => (VIDEOS.includes(ext(nom)) ? "video" : PHOTOS.includes(ext(nom)) ? "photo" : null);

// « 212 Mo », « 4,1 Mo », « 11,4 Go ».
export function poids(o) {
  const n = Number(o) || 0;
  const f = (x) => x.toLocaleString("fr-CH", { maximumFractionDigits: 1 });
  if (n >= 1e9) return `${f(n / 1e9)} Go`;
  if (n >= 1e7) return `${Math.round(n / 1e6)} Mo`;
  if (n >= 1e6) return `${f(n / 1e6)} Mo`;
  return `${Math.max(1, Math.round(n / 1e3))} Ko`;
}
// « 0:14 », « 1:05 ».
export function minutes(s) {
  const n = Math.max(0, Math.round(Number(s) || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
}
const jour = (iso) => (iso ? new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "short" }).format(new Date(iso)) : "");
const jourCourt = (iso) => (iso ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(iso)) : "");
const sansAccents = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const maj = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
// Les mots cherchés sont tous dans la description (accents et majuscules ignorés).
export function correspond(f, q) {
  const mots = sansAccents(q).split(/[^a-z0-9]+/).filter(Boolean);
  if (!mots.length) return true;
  const t = sansAccents(`${f.titre || ""} ${f.recherche || ""}`);
  return mots.every((m) => t.includes(m));
}
// « Arrivé à l'instant », « Arrivée aujourd'hui », « Arrivé le 12 nov. » (photo au féminin).
function arrivee(f) {
  const e = f.type === "photo" ? "Arrivée" : "Arrivé";
  const t = Date.parse(f.ajoute_le || 0);
  if (Date.now() - t < 10 * 60e3) return `${e} à l'instant`;
  if (new Date(t).toDateString() === new Date().toDateString()) return `${e} aujourd'hui`;
  return `${e} le ${jourCourt(f.ajoute_le)}`;
}
// Une phrase qui finit par un point, sans doubler celui d'une abréviation (« 16 nov. »).
const point = (t) => (/[.!?]$/.test(t) ? t : `${t}.`);
const titreDe = (f) => f.titre || (f.description === "erreur" ? "Pas encore décrit" : "Description en cours");
const nomType = (f) => (f.type === "photo" ? "Photo" : "B-roll");
// La règle des 3 vidéos dite simplement (dernière vidéo postée qui l'a utilisé).
export function phraseEcart(e) {
  if (!e?.derniere) return null;
  const n = e.videos_postees;
  return `Déjà vu dans ${pluriel(n, "vidéo postée", "vidéos postées")}, la dernière ${e.derniere.il_y_a === 1 ? "est ta dernière vidéo" : `il y a ${e.derniere.il_y_a} vidéos`}.`;
}
export function raisonPasPris(f) {
  if (f.reutilisable !== false) return null;
  if (f.raison === "reserve") return "déjà pris pour un contenu pas encore posté";
  if (f.raison === "recent") return `passé dans une vidéo trop récente, encore ${pluriel(f.attendre || 1, "vidéo", "vidéos")}`;
  return "pas disponible";
}

// L'image d'un fichier, avec ses pastilles (« dans 2 contenus », durée) et l'état « je le décris ».
function media(f, { pastilles = true } = {}) {
  const m = el("span", { class: "gal-media" },
    f.vignette_url ? el("img", { src: f.vignette_url, alt: "", loading: "lazy", draggable: "false" })
      : el("span", { class: "gal-media-vide", html: icone(f.type === "photo" ? "photo" : "film") }));
  if (pastilles && f.utilise) m.append(el("span", { class: "gal-pastille" }, `dans ${pluriel(f.utilise, "contenu", "contenus")}`));
  if (pastilles && f.type === "b-roll" && f.duree_s) m.append(el("span", { class: "gal-duree", html: `${icone("lecture")}<span>${minutes(f.duree_s)}</span>` }));
  return m;
}

// ---------------------------------------------------------------- l'envoi de fichiers du Mac vers la Galerie

export class AjoutGalerie {
  constructor({ api, slug = null, slide = null, photosSeulement = false, apres = null, libelle = "Ajouter" }) {
    Object.assign(this, { api, slug, slide, photosSeulement, apres, libelle });
    this.lignes = [];
    this.envoi = null;
    const accept = photosSeulement ? [...PHOTOS, "image/*"] : [...VIDEOS, ...PHOTOS, "video/*", "image/*"];
    this.input = el("input", { type: "file", multiple: true, class: "visuel-cache", tabindex: "-1", "aria-hidden": "true", accept: accept.join(",") });
    this.input.addEventListener("change", () => { const fs = [...this.input.files]; this.input.value = ""; this.ajouter(fs); });
    this.racine = el("div", { class: "ajout gal-ajout" });
    this.dessiner();
  }
  get actif() { return this.lignes.length > 0; }
  choisir() { this.input.click(); }
  brancher(zone) {
    const fichiers = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
    zone.addEventListener("dragover", (e) => { if (!fichiers(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; zone.classList.add("ajout-survol"); });
    zone.addEventListener("dragleave", (e) => { if (!zone.contains(e.relatedTarget)) zone.classList.remove("ajout-survol"); });
    zone.addEventListener("drop", (e) => { zone.classList.remove("ajout-survol"); if (!fichiers(e)) return; e.preventDefault(); this.ajouter([...e.dataTransfer.files]); });
  }
  ajouter(fichiers) {
    if (!fichiers.length) return;
    this.lignes = this.lignes.filter((l) => ["pret", "envoi"].includes(l.etat));
    for (const f of fichiers) {
      const g = genreFichier(f.name);
      const refus = !g ? (this.photosSeulement ? "Je ne garde ici que des photos (JPG, HEIC, PNG)." : "Je ne garde que des vidéos (MOV, MP4) et des photos (JPG, HEIC, PNG).")
        : this.photosSeulement && g !== "photo" ? "Une slide prend une photo, pas une vidéo."
          : f.size > MAX ? "Trop lourd : 20 Go au plus." : f.size === 0 ? "Ce fichier est vide." : null;
      this.lignes.push({ f, etat: refus ? "refus" : "pret", message: refus, n: 0 });
    }
    this.dessiner();
    if (!this.envoi) this.envoyer();
  }
  dessiner() {
    const a = this.racine;
    a.replaceChildren(this.input);
    a.hidden = !this.lignes.length;
    if (!this.lignes.length) return;
    a.append(el("ul", { class: "ajout-liste" }, ...this.lignes.map((l, i) => {
      let fin;
      if (l.etat === "envoi") fin = el("span", { class: "ajout-progres" }, el("progress", { max: "100", value: String(l.n), "aria-label": `Envoi de ${l.f.name}` }),
        el("span", { class: "ajout-pct" }, l.n >= 100 ? "Je le garde..." : `${l.n} %`));
      else if (l.etat === "pret") fin = el("span", { class: "ajout-etat" }, "En attente");
      else if (l.etat === "fait") fin = el("span", { class: "ajout-etat ajout-ok", html: `${icone("coche")}<span>${l.doublon ? "Déjà dans ta Galerie" : "Dans ta Galerie"}</span>` });
      else fin = el("span", { class: "ajout-etat ajout-erreur" }, l.message || "Pas gardé.");
      return el("li", { class: `ajout-ligne ajout-${l.etat}`, dataset: { i: String(i) } },
        el("span", { class: "ajout-fichier" }, el("span", { class: "ajout-nom", title: l.f.name }, l.f.name), el("span", { class: "ajout-poids" }, poids(l.f.size))), fin);
    })));
    const pied = el("div", { class: "ajout-pied" });
    if (this.envoi) {
      const stop = el("button", { class: "bouton bouton-petit", type: "button", html: `${icone("arreter")}<span>Arrêter l'envoi</span>` });
      stop.addEventListener("click", () => this.envoi?.arreter());
      pied.append(stop);
    } else {
      const fermer = el("button", { class: "bouton bouton-discret bouton-petit", type: "button" }, "Fermer");
      fermer.addEventListener("click", () => { this.lignes = []; this.dessiner(); });
      pied.append(fermer);
    }
    a.append(pied);
  }
  async envoyer() {
    let arrete = false, faits = 0;
    for (const l of this.lignes) {
      if (l.etat !== "pret") continue;
      if (arrete) { l.etat = "arrete"; l.message = "Pas envoyé."; continue; }
      l.etat = "envoi"; l.n = 0;
      const maj = (n) => {
        l.n = n;
        const li = this.racine.querySelector(`.ajout-ligne[data-i="${this.lignes.indexOf(l)}"]`);
        const p = li?.querySelector("progress"); const t = li?.querySelector(".ajout-pct");
        if (p) p.value = n;
        if (t) t.textContent = n >= 100 ? "Je le garde..." : `${n} %`;
      };
      const tache = this.api.envoyerGalerie(l.f, { slug: this.slug, slide: this.slide }, maj);
      this.envoi = { arreter: () => { arrete = true; tache.arreter(); } };
      this.dessiner();
      try { const r = await tache.fin; l.etat = "fait"; if (r?.doublon) l.doublon = true; else faits++; }
      catch (e) { l.etat = e.code === "ARRETE" ? "arrete" : "erreur"; l.message = e.code === "ARRETE" ? "Envoi arrêté : rien n'est gardé." : e.message; }
      this.envoi = null;
      this.dessiner();
    }
    const doublons = this.lignes.filter((l) => l.etat === "fait" && l.doublon).length;
    if (faits) annoncer(faits > 1 ? `${faits} fichiers dans ta Galerie : je les décris un par un.` : "C'est dans ta Galerie : je le décris.");
    else if (doublons) annoncer(doublons > 1 ? "Ces fichiers sont déjà dans ta Galerie : je ne les garde pas deux fois." : "Ce fichier est déjà dans ta Galerie : je ne le garde pas deux fois.");
    if (this.lignes.every((l) => l.etat === "fait" && !l.doublon)) this.lignes = [];
    this.dessiner();
    this.apres?.();
  }
}

// ---------------------------------------------------------------- le sélecteur (carrousels, brief, montage)

// Une grille compacte de la Galerie : recherche, un clic choisit, « Prendre celle-ci » valide. Ce qui ne peut pas être
// pris reste visible, grisé avec sa raison (jamais filtré en silence).
export class Selecteur {
  constructor({ api, type, pour = null, choisie = null, note = "", prendre, libelleOk }) {
    Object.assign(this, { api, type, pour, prendre });
    this.choix = choisie;
    this.q = "";
    this.liste = null;
    this.note = note || (type === "photo" ? "Une photo peut servir à plusieurs carrousels." : "Un plan ne revient pas à moins de 3 vidéos postées d'écart.");
    this.libelleOk = libelleOk || (type === "photo" ? "Prendre celle-ci" : "Prendre celui-ci");
    this.racine = el("div", { class: "gal-choisir" });
    this.charger();
  }
  async charger() {
    this.racine.replaceChildren(el("p", { class: "vide-doux" }, "J'ouvre ta Galerie..."));
    try { this.liste = (await this.api.galerie(this.pour)).fichiers.filter((f) => f.type === this.type); }
    catch (e) { this.racine.replaceChildren(el("p", { class: "recap-erreur" }, e.message)); return; }
    this.dessiner();
  }
  dessiner() {
    const quoi = this.type === "photo" ? ["photo", "photos"] : ["b-roll", "b-rolls"];
    const champ = el("input", { class: "champ", type: "search", placeholder: this.type === "photo" ? "Cherche dans tes photos" : "Cherche dans tes b-rolls", value: this.q });
    const visibles = this.liste.filter((f) => correspond(f, this.q));
    const grille = el("ul", { class: "gal-mini" }, ...visibles.map((f) => {
      const pas = raisonPasPris(f);
      const b = el("button", { type: "button", class: "gal-mini-choix", "aria-pressed": String(f.id === this.choix), disabled: pas ? true : null,
        "aria-label": `${titreDe(f)}${pas ? ` : ${pas}` : ""}` }, media(f, { pastilles: false }), el("span", {}, titreDe(f)), pas ? el("span", { class: "gal-mini-raison" }, pas) : null);
      b.addEventListener("click", () => { this.choix = f.id; this.dessiner(); this.racine.querySelector(".gal-prendre")?.focus(); });
      return el("li", { class: f.id === this.choix ? "choisie" : "" }, b);
    }));
    const ok = el("button", { class: "bouton bouton-plein bouton-petit gal-prendre", type: "button", disabled: this.choix ? null : true, html: `${icone("coche")}<span>${this.libelleOk}</span>` });
    ok.addEventListener("click", async () => {
      ok.disabled = true;
      try { await this.prendre(this.choix); } catch (e) { annoncer(e.message, "erreur"); ok.disabled = false; }
    });
    champ.addEventListener("input", () => { this.q = champ.value; const pos = champ.selectionStart; this.dessiner(); const c = this.racine.querySelector("input"); c.focus(); c.setSelectionRange(pos, pos); });
    const compte = this.liste.length ? `${pluriel(this.liste.length, quoi[0], quoi[1])}, les plus ${this.type === "photo" ? "récentes" : "récents"} d'abord` : "";
    this.racine.replaceChildren(
      el("div", { class: "gal-outils" }, el("label", { class: "gal-recherche" }, el("span", { class: "visuel-cache" }, "Chercher"), el("span", { html: icone("chercher") }), champ),
        compte ? el("span", { class: "vide-doux gal-compte" }, compte) : null),
      !this.liste.length ? el("p", { class: "vide-doux" }, this.type === "photo" ? "Pas encore de photo dans ta Galerie : ajoutes-en une." : "Pas encore de b-roll dans ta Galerie.")
        : visibles.length ? grille : el("p", { class: "vide-doux" }, "Rien ne correspond à ta recherche."),
      el("div", { class: "gal-mini-pied" }, el("span", {}, this.note), ok));
  }
}

// ---------------------------------------------------------------- la vue Galerie et la fiche

export class VueGalerie {
  constructor(vue) {
    this.vue = vue; this.studio = vue.studio; this.api = vue.studio.api;
    this.filtre = { type: "tous", libres: false, q: "", tri: "recents" };
    this.ajout = new AjoutGalerie({ api: this.api, apres: () => this.vue.afficher() });
    this.donnees = null;
  }

  chemin(fin) {
    const s = this.studio;
    return el("nav", { class: "vue-chemin", "aria-label": "Où tu es" },
      el("button", { type: "button", onclick: () => s.selectionner({ genre: "accueil" }) }, "Studio"), el("span", { html: icone("fleche") }),
      fin ? el("button", { type: "button", onclick: () => s.selectionner({ genre: "transverse", quoi: "galerie" }) }, "Galerie") : el("span", { class: "courant" }, "Galerie"),
      ...(fin ? [el("span", { html: icone("fleche") }), el("span", { class: "courant" }, fin.length > 48 ? `${fin.slice(0, 46)}…` : fin)] : []));
  }

  // Les fichiers arrivés qui attendent sa décision : une face caméra pas reconnue (elle va dans son reel), et ce que
  // le rangement d'avant la Galerie avait mis de côté.
  bandeau() {
    const s = this.studio;
    const liste = s.a_ranger || [];
    if (!liste.length) return null;
    s.rangement.dessiner();
    const videos = liste.filter((f) => f.type !== "photo" && f.libelle !== "ta photo").length;
    const photos = liste.length - videos;
    const aide = [videos ? pluriel(videos, "vidéo", "vidéos") : null, photos ? pluriel(photos, "photo", "photos") : null].filter(Boolean).join(", ");
    return el("section", { class: "gal-arrives", "aria-label": "Arrivés, à placer" },
      el("header", { class: "bloc-tete" }, el("h3", {}, "Arrivés, à placer", el("span", { class: "aide" }, aide))), s.rangement.racine);
  }

  async page(jeton) {
    let d;
    try { d = await this.api.galerie(); } catch (e) { return el("article", { class: "vue" }, this.chemin(), el("p", { class: "recap-erreur" }, e.message)); }
    if (jeton !== this.vue.jeton) return null;
    this.donnees = d;
    const intro = el("p", { class: "vide-doux gal-intro" }, "Tes photos et tes b-rolls, gardés pour resservir. Pour chaque brief, chaque montage et chaque carrousel, je regarde d'abord ici.");
    const ajouter = el("button", { class: "bouton bouton-plein", type: "button", html: `${icone("plus")}<span>Ajouter</span>` });
    ajouter.addEventListener("click", () => this.ajout.choisir());
    const tete = el("header", { class: "vue-tete" }, el("div", {}, el("h1", { class: "vue-titre" }, "Galerie"), intro),
      d.total ? el("div", { class: "vue-reglages" }, ajouter) : null);
    const art = el("article", { class: "vue vue-galerie" }, this.chemin(), tete);
    const b = this.bandeau();
    if (b) art.append(b);
    if (!d.total) {
      const gros = el("button", { class: "bouton bouton-plein bouton-grand", type: "button", html: `${icone("plus")}<span>Ajouter des photos et des vidéos</span>` });
      gros.addEventListener("click", () => this.ajout.choisir());
      const vide = el("section", { class: "gal-vide", "aria-label": "Ta Galerie est vide" },
        el("span", { class: "gal-vide-ico", html: icone("galerie") }),
        el("h2", {}, "Commence par ce que tu as déjà sur ton téléphone"),
        el("p", {}, "Ajoute un maximum de photos et de petites vidéos de ton quotidien. Chaque fichier que tu mets ici, c'est un plan que tu n'auras plus à tourner : pour chaque brief, je regarde d'abord dans ta Galerie."),
        el("div", { class: "gal-vide-idees", "aria-label": "Ce qui resservira le plus" },
          ...["Ton lieu de travail et ton matériel", "Tes repas et ta cuisine", "Tes trajets et tes sorties", "Tes carnets et tes programmes", "Les lieux où tu coaches"].map((t) => el("span", {}, t))),
        el("div", { class: "gal-boutons gal-centre" }, gros),
        el("p", { class: "doux" }, "Ou glisse-les ici, ou envoie-les par AirDrop sur ce Mac. Pas tes vidéos face caméra : elles vont dans leur reel."),
        this.ajout.racine);
      this.ajout.brancher(vide);
      art.append(vide);
      return art;
    }
    art.append(...this.outils(d), this.zoneDepot(), this.ajout.racine, this.grille());
    this.ajout.brancher(art);
    return art;
  }

  outils(d) {
    const f = this.filtre;
    const champ = el("input", { class: "champ", type: "search", placeholder: "Cherche : cuisine, course, barre...", value: f.q, "aria-label": "Chercher dans ta Galerie" });
    champ.addEventListener("input", () => { f.q = champ.value; this.majGrille(); });
    const tri = el("select", { class: "champ", "aria-label": "Trier" },
      ...[["recents", "Les plus récents"], ["lourds", "Les plus lourds"], ["anciens", "Les plus anciens"]].map(([v, t]) => el("option", { value: v, selected: v === f.tri || null }, t)));
    tri.addEventListener("change", () => { f.tri = tri.value; this.majGrille(); });
    const seg = el("div", { class: "segment", role: "group", "aria-label": "Quoi montrer" },
      ...[["tous", "Tout", d.total, null], ["photo", "Photos", d.photos, "photo"], ["b-roll", "B-rolls", d.brolls, "film"]].map(([v, t, n, ico]) => {
        const bt = el("button", { type: "button", "aria-pressed": String(f.type === v), html: `${ico ? icone(ico) : ""}${t} <span class="gal-nb">${n}</span>` });
        bt.addEventListener("click", () => { f.type = v; seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === bt))); this.majGrille(); });
        return bt;
      }));
    const libres = el("button", { class: "gal-bascule", type: "button", "aria-pressed": String(f.libres), html: `Pas encore utilisés <span class="gal-nb">${d.pas_utilises}</span>` });
    libres.addEventListener("click", () => { f.libres = !f.libres; libres.setAttribute("aria-pressed", String(f.libres)); this.majGrille(); });
    return [
      el("div", { class: "gal-outils" }, el("label", { class: "gal-recherche" }, el("span", { class: "visuel-cache" }, "Chercher"), el("span", { html: icone("chercher") }), champ),
        el("label", { class: "gal-tri" }, "Trier", tri)),
      el("div", { class: "gal-outils" }, seg, libres),
      el("p", { class: "gal-resume" }, el("span", {}, el("strong", {}, String(d.total)), d.total > 1 ? " fichiers" : " fichier"),
        el("span", {}, el("strong", {}, poids(d.taille_totale)), " en tout sur ton disque"),
        el("span", {}, "Pour faire de la place : trie par « Les plus lourds »."),
        d.en_description ? el("span", {}, `${pluriel(d.en_description, "fichier", "fichiers")} à décrire`) : null),
    ];
  }

  zoneDepot() {
    return el("div", { class: "gal-depot" }, el("span", { html: icone("telecharger") }),
      el("p", {}, el("strong", {}, "Glisse ici tes photos et tes vidéos"), ", ou envoie-les par AirDrop sur ce Mac. Je décris chacune à son arrivée."));
  }

  visibles() {
    const f = this.filtre;
    const l = (this.donnees?.fichiers || []).filter((x) => (f.type === "tous" || x.type === f.type) && (!f.libres || !x.utilise) && correspond(x, f.q));
    const cle = { recents: (a, b) => String(b.ajoute_le).localeCompare(String(a.ajoute_le)), anciens: (a, b) => String(a.ajoute_le).localeCompare(String(b.ajoute_le)),
      lourds: (a, b) => (b.taille || 0) - (a.taille || 0) }[f.tri];
    return l.sort(cle);
  }

  grille() {
    this._grille = el("div", { class: "gal-grille-zone" });
    this.majGrille();
    return this._grille;
  }

  majGrille() {
    const l = this.visibles();
    if (!this._grille) return;
    if (!l.length) { this._grille.replaceChildren(el("p", { class: "vide-doux" }, "Rien ne correspond à ta recherche.")); return; }
    this._grille.replaceChildren(el("ul", { class: "gal-grille" }, ...l.map((f) => {
      const cours = f.description === "en_cours" || f.description === "a_faire";
      const m = media(f);
      if (cours) m.append(el("span", { class: "gal-attente" }, el("span", { class: "tag tag-cours" }, el("span", { class: "rond-cours", "aria-hidden": "true" }), "je le décris"),
        el("span", {}, arrivee(f))));
      const b = el("button", { class: "gal-ouvrir", type: "button", "aria-label": `${titreDe(f)}, ${nomType(f).toLowerCase()}` }, m,
        el("span", { class: "gal-corps" }, el("span", { class: "gal-titre" }, titreDe(f)), el("span", { class: "gal-meta" }, `${nomType(f)} · ${poids(f.taille)}`)));
      b.addEventListener("click", () => this.studio.selectionner({ genre: "transverse", quoi: "galerie", id: f.id }));
      return el("li", { class: `gal-carte${cours ? " gal-encours" : ""}` }, b);
    })));
  }

  // ---------- la fiche d'un fichier (page à part : Studio > Galerie > fichier) ----------
  async fiche(id, jeton) {
    let f;
    try { f = await this.api.ficheGalerie(id); }
    catch (e) {
      return el("article", { class: "vue" }, this.chemin("Fichier"), el("p", { class: "recap-erreur" }, e.message),
        el("button", { class: "bouton", type: "button", onclick: () => this.studio.selectionner({ genre: "transverse", quoi: "galerie" }) }, "Revenir à ta Galerie"));
    }
    if (jeton !== this.vue.jeton) return null;
    const photo = f.type === "photo";
    const titre = titreDe(f);
    const tags = el("div", { class: "vue-etiquettes" },
      el("span", { class: "tag" }, el("span", { class: "rond", "aria-hidden": "true" }), nomType(f)),
      f.duree_s ? el("span", { class: "tag" }, minutes(f.duree_s)) : null,
      el("span", { class: "tag" }, poids(f.taille)),
      el("span", { class: "tag" }, `${photo ? "arrivée" : "arrivé"} le ${jourCourt(f.ajoute_le)}`));
    const sup = el("button", { class: "bouton bouton-discret bouton-petit", type: "button", html: `${icone("corbeille")}<span>Supprimer</span>` });
    const tete = el("header", { class: "vue-tete" }, el("div", {}, el("h1", { class: "vue-titre" }, titre), tags), el("div", { class: "vue-reglages" }, sup));
    const zoneSup = this.supprimer(f);
    sup.addEventListener("click", () => { zoneSup.scrollIntoView({ block: "center", behavior: "smooth" }); if (f.supprimable.ok) zoneSup.querySelector(".gal-sup-depart")?.click(); else zoneSup.querySelector("button")?.focus(); });
    const art = el("article", { class: "vue vue-galerie" }, this.chemin(titre), tete,
      el("div", { class: "gal-fiche" }, this.apercu(f),
        el("div", {}, this.description(f), this.utilisations(f), this.bloc("Supprimer", zoneSup))));
    return art;
  }

  bloc(titre, contenu, { aide = null, outils = null } = {}) {
    return el("section", { class: "bloc" }, el("header", { class: "bloc-tete" }, el("h3", {}, titre, aide ? el("span", { class: "aide" }, aide) : null),
      outils ? el("div", { class: "bloc-outils" }, ...outils) : null), contenu);
  }

  apercu(f) {
    const photo = f.type === "photo";
    const cadre = el("div", { class: `gal-apercu-cadre${photo ? " photo" : ""}` },
      f.vignette_url ? el("img", { src: photo ? f.url : f.vignette_url, alt: "" }) : el("span", { class: "gal-media-vide", html: icone(photo ? "photo" : "film") }));
    // Une photo HEIC ne s'affiche pas dans le navigateur : on garde son image réduite.
    const img = cadre.querySelector("img");
    if (photo && img) img.addEventListener("error", () => { if (f.vignette_url && img.src !== location.origin + f.vignette_url) img.src = f.vignette_url; }, { once: true });
    const r = el("div", { class: "gal-apercu" }, cadre);
    if (!photo) {
      const lire = el("button", { class: "gal-lire", type: "button", "aria-label": "Lire", html: icone("lecture") });
      lire.addEventListener("click", () => cadre.replaceChildren(el("video", { src: f.url, controls: true, autoplay: true, playsinline: true, poster: f.vignette_url || null })));
      cadre.append(lire);
      const p = f.description_detail?.passages || [];
      if (f.duree_s && p.length) {
        const L = f.duree_s;
        r.append(el("div", { class: "gal-frise", "aria-label": "Passages utilisables" },
          el("div", { class: "gal-frise-barre" }, ...p.map((x) => el("i", { style: `left:${(100 * x.debut / L).toFixed(1)}%;width:${(100 * (x.fin - x.debut) / L).toFixed(1)}%` }))),
          el("div", { class: "gal-frise-legende" }, el("span", {}, "0:00"), el("span", {}, minutes(L))),
          el("p", { class: "gal-frise-note" }, "Passages utilisables")));
      }
    }
    return r;
  }

  description(f) {
    const d = f.description_detail;
    const photo = f.type === "photo";
    const origine = el("p", { class: "gal-origine" }, el("span", { html: icone(f.origine.genre === "ajout" ? "telecharger" : "camera") }),
      el("span", {}, f.origine.genre === "tournage"
        ? point(`Vient de ton tournage${f.origine.tournage?.cree_le ? ` du ${jour(f.origine.tournage.cree_le)}` : ""}${f.origine.ligne ? `, plan demandé : « ${f.origine.ligne} »` : ""}`)
        : f.origine.genre === "arrivee" ? `${photo ? "Arrivée" : "Arrivé"} de ton tournage${f.origine.tournage?.cree_le ? ` du ${jour(f.origine.tournage.cree_le)}` : ""}, sans contenu prévu.`
          : point(`${photo ? "Ajoutée" : "Ajouté"} par toi le ${jour(f.ajoute_le)}`)));
    if (!d) {
      let corps;
      if (f.description === "erreur") {
        const re = el("button", { class: "bouton bouton-petit", type: "button", html: `${icone("synchro")}<span>Réessayer</span>` });
        re.addEventListener("click", async () => { re.disabled = true; try { await this.api.redecrireGalerie(f.id); annoncer("Je le décris de nouveau."); this.vue.afficher(); } catch (e) { annoncer(e.message, "erreur"); re.disabled = false; } });
        corps = el("div", {}, el("p", { class: "vide-doux" }, f.description_erreur || "Je n'ai pas réussi à le décrire."), el("div", { class: "gal-boutons" }, re));
      } else {
        corps = el("p", { class: "recap-charge" }, el("span", { class: "points", "aria-hidden": "true" }, el("i"), el("i"), el("i")),
          f.description === "en_cours" ? "Je le décris en ce moment : sa description arrive ici." : "Il attend sa description : je les fais une par une.");
      }
      return this.bloc("Description", el("div", {}, corps, origine));
    }
    const passages = (d.passages || []).map((p, i) => `${i ? "de" : "De"} ${minutes(p.debut)} à ${minutes(p.fin)}${p.note ? ` (${p.note})` : ""}`).join(" et ");
    const dl = el("dl", { class: "gal-desc" },
      el("dt", {}, "Ce qu'on voit"), el("dd", {}, d.ce_qu_on_voit),
      el("dt", {}, "Action"), el("dd", {}, d.action),
      el("dt", {}, "Lieu"), el("dd", {}, d.lieu),
      el("dt", {}, "Cadrage"), el("dd", {}, d.cadrage),
      el("dt", {}, "Toi à l'image"), el("dd", {}, d.personne_a_l_image ? "Oui." : "Non."),
      ...(photo ? [] : [el("dt", {}, "Passages utilisables"), el("dd", {}, passages ? `${passages}.` : "Aucun.")]));
    const retoucher = el("button", { class: "bouton bouton-discret bouton-petit bouton-modifier", type: "button", html: `${icone("crayon")}<span>Retoucher</span>` });
    const sec = this.bloc("Description", el("div", {}, dl, origine), { aide: d.par === "toi" ? "retouchée par toi" : "écrite à son arrivée, corrige-la si besoin", outils: [retoucher] });
    retoucher.addEventListener("click", () => this.retoucher(f, sec, dl, retoucher));
    return sec;
  }

  // La description se retouche ligne par ligne ; le serveur la valide (même schéma que la session qui l'a écrite).
  retoucher(f, sec, dl, bouton) {
    const d = f.description_detail;
    const photo = f.type === "photo";
    this.vue.edition = "galerie";
    const champ = (v, label, lignes = 2) => { const t = el("textarea", { class: "champ", rows: String(lignes), "aria-label": label }); t.value = v || ""; return t; };
    const c = {
      titre: el("input", { class: "champ", type: "text", value: d.titre, "aria-label": "Titre" }),
      ce_qu_on_voit: champ(d.ce_qu_on_voit, "Ce qu'on voit", 3), action: champ(d.action, "Action"), lieu: champ(d.lieu, "Lieu", 1),
      cadrage: champ(d.cadrage, "Cadrage"), toi: el("select", { class: "champ", "aria-label": "Toi à l'image" },
        el("option", { value: "non", selected: !d.personne_a_l_image || null }, "Non"), el("option", { value: "oui", selected: d.personne_a_l_image || null }, "Oui")),
      passages: el("input", { class: "champ", type: "text", value: (d.passages || []).map((p) => `${minutes(p.debut)} à ${minutes(p.fin)}`).join(" ; "), "aria-label": "Passages utilisables" }),
      mots: el("input", { class: "champ", type: "text", value: (d.mots_cles || []).join(", "), "aria-label": "Mots pour la recherche" }),
    };
    const ligne = (t, x, aide) => el("label", { class: "gal-champ" }, el("span", {}, t), x, aide ? el("span", { class: "note" }, aide) : null);
    const ok = el("button", { class: "bouton bouton-plein bouton-petit", type: "button", html: `${icone("coche")}<span>Enregistrer</span>` });
    const non = el("button", { class: "bouton bouton-discret bouton-petit", type: "button" }, "Annuler");
    const fin = () => { this.vue.edition = null; this.vue.afficher(); };
    non.addEventListener("click", fin);
    ok.addEventListener("click", async () => {
      const sec2s = (t) => { const m = /^(\d+):(\d{1,2})$/.exec(t.trim()); return m ? Number(m[1]) * 60 + Number(m[2]) : Number(t.replace(",", ".")); };
      const passages = photo ? [] : c.passages.value.split(/[;,]/).map((x) => x.split(/\s*(?:à|-)\s*/)).filter((x) => x.length === 2)
        .map(([a, b], i) => ({ debut: sec2s(a), fin: sec2s(b), ...(d.passages?.[i]?.note ? { note: d.passages[i].note } : {}) }));
      const corps = { titre: c.titre.value, ce_qu_on_voit: c.ce_qu_on_voit.value, action: c.action.value, lieu: c.lieu.value, cadrage: c.cadrage.value,
        personne_a_l_image: c.toi.value === "oui", passages, mots_cles: c.mots.value.split(",").map((x) => x.trim()).filter(Boolean) };
      ok.disabled = true;
      try { await this.api.decrireGalerie(f.id, corps); annoncer("C'est enregistré."); fin(); }
      catch (e) { annoncer(e.message, "erreur"); ok.disabled = false; }
    });
    const form = el("div", { class: "gal-form" }, ligne("Titre", c.titre), ligne("Ce qu'on voit", c.ce_qu_on_voit), ligne("Action", c.action), ligne("Lieu", c.lieu),
      ligne("Cadrage", c.cadrage), ligne("Toi à l'image", c.toi),
      photo ? null : ligne("Passages utilisables", c.passages, "Par exemple : 0:02 à 0:06 ; 0:09 à 0:13"),
      ligne("Mots pour la recherche", c.mots, "Séparés par des virgules"),
      el("div", { class: "bloc-pied" }, ok, non));
    form.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fin(); } });
    dl.replaceWith(form);
    bouton.hidden = true;
    c.titre.focus();
  }

  utilisations(f) {
    const s = this.studio;
    const lignes = f.utilisations.map((u) => {
      const meta = u.poste_le ? `posté le ${jour(u.poste_le)}` : !u.existe ? "ce contenu n'existe plus"
        : u.stade === "abandonne" ? "mis de côté" : u.prevu ? "prévu par son brief, pas encore posté" : `pas encore posté${u.libelle ? `, ${u.libelle}` : ""}`;
      const b = el("button", { class: "accueil-ligne", type: "button" },
        el("span", { class: `pastille pastille-${u.format || "reel"}`, "aria-hidden": "true" }),
        el("span", { class: "ligne-corps" }, el("span", { class: "ligne-titre" }, u.titre),
          el("span", { class: "ligne-meta" }, `${meta}${u.slides?.length ? ` · slide ${u.slides.join(", ")}` : ""}`)),
        el("span", { html: icone("fleche") }));
      if (u.existe) b.addEventListener("click", () => s.selectionner({ genre: "dossier", cle: u.slug, fichier: u.format === "carrousel" ? "brief" : "montage" }));
      else b.disabled = true;
      return b;
    });
    const ecart = f.type === "b-roll" ? phraseEcart(f.ecart) : null;
    return this.bloc("Utilisé dans", el("div", {},
      lignes.length ? el("div", { class: "accueil-liste" }, ...lignes) : el("p", { class: "vide-doux" }, "Pas encore utilisé."),
      ecart ? el("p", { class: "gal-plan-note" }, ecart) : null),
    { aide: lignes.length ? pluriel(lignes.length, "contenu", "contenus") : null });
  }

  // Supprimer : confirmation dans la page (jamais la fenêtre du navigateur). Refusé tant qu'un contenu pas encore posté
  // s'en sert : on dit lequel et on propose de l'ouvrir.
  supprimer(f) {
    const s = this.studio;
    const photo = f.type === "photo";
    const le = photo ? "la" : "le";
    const zone = el("div", { class: "gal-sup" });
    if (!f.supprimable.ok) {
      const b = f.supprimable;
      const genre = b.format === "carrousel" ? "carrousel" : "reel";
      const ouvrir = el("button", { class: "bouton bouton-petit", type: "button", html: `${icone("fleche")}<span>Ouvrir le ${genre}</span>` });
      ouvrir.addEventListener("click", () => s.selectionner({ genre: "dossier", cle: b.slug }));
      zone.append(el("div", { class: "gal-refus", role: "status" },
        el("p", { class: "titre", html: `${icone("attention")}<span>Tu ne peux pas ${le} supprimer pour l'instant</span>` }),
        el("p", {}, `${photo ? "Elle" : "Il"} sert au ${genre} « ${b.titre} », pas encore posté. Une fois qu'il est posté, tu pourras ${le} supprimer d'ici.`),
        el("div", { class: "gal-boutons" }, ouvrir)));
      return zone;
    }
    const postes = f.utilisations.filter((u) => u.poste_le).length;
    const depart = () => {
      const bt = el("button", { class: "bouton gal-sup-depart", type: "button", html: `${icone("corbeille")}<span>Supprimer</span>` });
      bt.addEventListener("click", confirmer);
      zone.replaceChildren(el("p", { class: "vide-doux" }, `${photo ? "Elle" : "Il"} libère ${poids(f.taille)} sur ton disque.`), el("div", { class: "gal-boutons" }, bt));
      return bt;
    };
    const confirmer = () => {
      const oui = el("button", { class: "bouton bouton-danger", type: "button", html: `${icone("corbeille")}<span>Oui, supprimer</span>` });
      const non = el("button", { class: "bouton", type: "button" }, el("span", {}, "Garder"));
      non.addEventListener("click", () => depart().focus());
      oui.addEventListener("click", async () => {
        oui.disabled = true; non.disabled = true;
        try {
          await this.api.supprimerGalerie(f.id);
          annoncer(`C'est supprimé : ${poids(f.taille)} de libérés.`);
          s.selectionner({ genre: "transverse", quoi: "galerie" });
        } catch (e) { annoncer(e.message, "erreur"); this.vue.afficher(); }
      });
      const reste = postes
        ? `${postes > 1 ? `Les ${postes === 2 ? "deux" : postes} ${photo ? "contenus" : "vidéos"} déjà ${photo ? "postés" : "postées"} ne bougent pas` : `${photo ? "Le contenu déjà posté ne bouge" : "La vidéo déjà postée ne bouge"} pas`}, mais je ne pourrai plus ${le} reprendre dans un prochain ${photo ? "carrousel" : "montage"}.`
        : `Je ne pourrai plus ${le} reprendre dans un prochain ${photo ? "carrousel" : "montage"}.`;
      const boite = el("div", { class: "res-confirmer", role: "group", "aria-label": `Supprimer ${photo ? "cette photo" : "ce b-roll"}` },
        el("p", {}, el("strong", { class: "gal-sup-titre" }, `Supprimer ${photo ? "cette photo" : "ce b-roll"} pour de bon ?`)),
        el("p", {}, `${photo ? "Elle disparaît" : "Il disparaît"} de ta Galerie et libère ${poids(f.taille)}. ${reste}`),
        el("div", { class: "gal-boutons" }, oui, non));
      boite.addEventListener("keydown", (e) => { if (e.key === "Escape" && !oui.disabled) { e.preventDefault(); e.stopPropagation(); depart().focus(); } });
      zone.replaceChildren(boite);
      non.focus();
    };
    depart();
    return zone;
  }
}
