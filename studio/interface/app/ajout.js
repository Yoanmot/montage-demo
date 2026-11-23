// « Ajouter une vidéo » dans la vue Montage d'un contenu (19/11) : une vidéo ou une photo prise sur le Mac (bouton ou
// glisser-déposer sur « Tes vidéos rangées »), son type choisi avant l'envoi, envoyée au studio avec une barre de
// progression qu'on peut arrêter. Le studio en range une copie dans ce contenu ; le fichier du Mac ne bouge pas.
// La zone vit d'un affichage à l'autre (un envoi continue quand la vue se recharge) : une zone par contenu.

import { el, icone, annoncer } from "./outils.js";

const VIDEOS = [".mov", ".mp4", ".m4v", ".hevc"];
const PHOTOS = [".jpg", ".jpeg", ".heic", ".heif", ".png", ".dng"];
const MAX = 20 * 1024 ** 3;
const ext = (nom) => { const i = nom.lastIndexOf("."); return i > 0 ? nom.slice(i).toLowerCase() : ""; };
const genre = (nom) => (VIDEOS.includes(ext(nom)) ? "video" : PHOTOS.includes(ext(nom)) ? "photo" : null);
const taille = (o) => (o >= 1e9 ? `${(o / 1e9).toLocaleString("fr-CH", { maximumFractionDigits: 1 })} Go`
  : o >= 1e6 ? `${Math.round(o / 1e6)} Mo` : `${Math.max(1, Math.round(o / 1e3))} Ko`);
const TYPES = [["b-roll", "Plan filmé en plus"], ["face", "Vidéo face caméra"]];
// Écran partagé (studio de Yoan, 23/11) : l'enregistrement de son écran, fait sur le Mac en même temps que la caméra.
const TYPE_ECRAN = ["ecran", "Enregistrement d'écran"];
// Nom donné par défaut par l'enregistreur d'écran (« 2026-11-23 15-02-41.mp4 ») : proposé comme enregistrement d'écran.
const NOM_ENREGISTREMENT = /^\d{4}-\d{2}-\d{2}[ _]\d{2}-\d{2}-\d{2}\.[a-z0-9]+$/i;

export class AjoutVideos {
  constructor({ slug, api, apres, ecran = false }) {
    this.slug = slug; this.api = api; this.apres = apres;
    this.types = ecran ? [...TYPES, TYPE_ECRAN] : TYPES;
    this.lignes = [];        // { f, type, refus, etat: "pret"|"envoi"|"range"|"erreur"|"arrete", message, n }
    this.envoi = null;       // { arreter } pendant un envoi
    this.input = el("input", { type: "file", multiple: true, class: "visuel-cache", tabindex: "-1", "aria-hidden": "true",
      accept: [...VIDEOS, ...PHOTOS, "video/*", "image/*"].join(",") });
    this.input.addEventListener("change", () => { this.choisir([...this.input.files]); this.input.value = ""; });
    this.racine = el("div", { class: "ajout" });
    this.dessiner();
  }

  get actif() { return this.lignes.length > 0; }

  // La zone qui accepte un glisser-déposer de fichiers du Mac (« Tes vidéos rangées »).
  brancher(zone) {
    const fichiers = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
    zone.addEventListener("dragover", (e) => { if (!fichiers(e) || this.envoi) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; zone.classList.add("ajout-survol"); });
    zone.addEventListener("dragleave", (e) => { if (!zone.contains(e.relatedTarget)) zone.classList.remove("ajout-survol"); });
    zone.addEventListener("drop", (e) => {
      zone.classList.remove("ajout-survol");
      if (!fichiers(e) || this.envoi) return;
      e.preventDefault();
      this.choisir([...e.dataTransfer.files]);
    });
  }

  choisir(fichiers) {
    if (this.envoi || !fichiers.length) return;
    // Une liste finie (rangées, erreurs) laisse la place au nouveau choix.
    this.lignes = this.lignes.filter((l) => l.etat === "pret");
    for (const f of fichiers) {
      const g = genre(f.name);
      const refus = !g ? "Je ne sais ranger que des vidéos (MOV, MP4) et des photos (JPG, HEIC, PNG)."
        : f.size > MAX ? "Trop lourd : 20 Go au plus." : f.size === 0 ? "Ce fichier est vide." : null;
      const ecran = g === "video" && this.types.includes(TYPE_ECRAN) && NOM_ENREGISTREMENT.test(f.name);
      this.lignes.push({ f, type: g === "photo" ? "photo" : ecran ? "ecran" : "b-roll", refus, etat: refus ? "refus" : "pret", message: refus, n: 0 });
    }
    this.dessiner();
    this.racine.querySelector(".ajout-envoyer")?.focus();
  }

  dessiner() {
    const choisir = el("button", { class: "bouton bouton-petit", type: "button", disabled: this.envoi ? true : null, html: `${icone("plus")}<span>Ajouter une vidéo</span>` });
    choisir.addEventListener("click", () => this.input.click());
    const tete = el("div", { class: "ajout-tete" }, choisir,
      el("span", { class: "ajout-note" }, "Ou glisse-la ici depuis ton Mac. J'en range une copie : ton fichier reste où il est."));
    const a = this.racine;
    a.replaceChildren(this.input, tete);
    if (!this.lignes.length) return;
    const liste = el("ul", { class: "ajout-liste" }, ...this.lignes.map((l, i) => this.ligne(l, i)));
    a.append(liste);
    const prets = this.lignes.filter((l) => l.etat === "pret").length;
    const pied = el("div", { class: "ajout-pied" });
    if (this.envoi) {
      const stop = el("button", { class: "bouton bouton-petit", type: "button", html: `${icone("arreter")}<span>Arrêter l'envoi</span>` });
      stop.addEventListener("click", () => this.envoi?.arreter());
      pied.append(stop);
    } else if (prets) {
      const go = el("button", { class: "bouton bouton-plein bouton-petit ajout-envoyer", type: "button", html: `${icone("envoyer")}<span>${prets > 1 ? `Ranger les ${prets} ici` : "Ranger ici"}</span>` });
      go.addEventListener("click", () => this.envoyer());
      const non = el("button", { class: "bouton bouton-discret bouton-petit", type: "button" }, "Annuler");
      non.addEventListener("click", () => { this.lignes = []; this.dessiner(); });
      pied.append(go, non);
    } else {
      const fermer = el("button", { class: "bouton bouton-discret bouton-petit", type: "button" }, "Fermer");
      fermer.addEventListener("click", () => { this.lignes = []; this.dessiner(); });
      pied.append(fermer);
    }
    a.append(pied);
  }

  ligne(l, i) {
    const nom = el("span", { class: "ajout-nom", title: l.f.name }, l.f.name);
    const poids = el("span", { class: "ajout-poids" }, taille(l.f.size));
    let fin;
    if (l.etat === "pret" && l.type !== "photo") {
      const id = `ajout-${this.slug}-${i}`;
      const sel = el("select", { class: "champ", id }, ...this.types.map(([v, t]) => el("option", { value: v, selected: v === l.type || null }, t)));
      sel.addEventListener("change", () => { l.type = sel.value; });
      fin = el("span", { class: "ajout-type" }, el("label", { for: id, class: "visuel-cache" }, `C'est quoi, ${l.f.name}`), sel);
    } else if (l.etat === "pret") fin = el("span", { class: "ajout-etat" }, "Photo");
    else if (l.etat === "envoi") {
      fin = el("span", { class: "ajout-progres" },
        el("progress", { max: "100", value: String(l.n), "aria-label": `Envoi de ${l.f.name}` }),
        el("span", { class: "ajout-pct" }, l.n >= 100 ? "Je range..." : `${l.n} %`));
    } else if (l.etat === "range") fin = el("span", { class: "ajout-etat ajout-ok", html: `${icone("coche")}<span>Rangée</span>` });
    else fin = el("span", { class: "ajout-etat ajout-erreur" }, l.message || "Pas rangée.");
    const retirer = l.etat === "pret" || l.etat === "refus"
      ? el("button", { class: "bouton-icone ajout-retirer", type: "button", "aria-label": `Ne pas ranger ${l.f.name}`, html: icone("croix") })
      : null;
    retirer?.addEventListener("click", () => { this.lignes.splice(i, 1); this.dessiner(); });
    return el("li", { class: `ajout-ligne ajout-${l.etat}`, dataset: { i: String(i) } }, el("span", { class: "ajout-fichier" }, nom, poids), fin, retirer);
  }

  // Un fichier après l'autre ; « Arrêter l'envoi » coupe celui en cours et laisse les suivants.
  async envoyer() {
    let arrete = false, ranges = 0;
    for (const l of this.lignes) {
      if (l.etat !== "pret") continue;
      if (arrete) { l.etat = "arrete"; l.message = "Pas envoyée."; continue; }
      l.etat = "envoi"; l.n = 0;
      const majProgres = (n) => {
        l.n = n;
        const li = this.racine.querySelector(`.ajout-ligne[data-i="${this.lignes.indexOf(l)}"]`);
        const p = li?.querySelector("progress"); const t = li?.querySelector(".ajout-pct");
        if (p) p.value = n;
        if (t) t.textContent = n >= 100 ? "Je range..." : `${n} %`;
      };
      const tache = this.api.envoyerFichier(this.slug, l.f, l.type, majProgres);
      this.envoi = { arreter: () => { arrete = true; tache.arreter(); } };
      this.dessiner();
      try {
        await tache.fin;
        l.etat = "range"; ranges++;
      } catch (e) {
        l.etat = e.code === "ARRETE" ? "arrete" : "erreur";
        l.message = e.code === "ARRETE" ? "Envoi arrêté : rien n'est rangé." : e.message;
      }
      this.envoi = null;
      this.dessiner();
    }
    if (ranges) annoncer(ranges > 1 ? `${ranges} fichiers rangés dans tes vidéos.` : "Rangée dans tes vidéos.");
    // Tout est rangé : la liste se referme, la vidéo apparaît dans la grille.
    if (this.lignes.every((l) => l.etat === "range")) this.lignes = [];
    this.dessiner();
    this.apres?.();
  }
}
