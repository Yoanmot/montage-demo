// L'aperçu du montage dans le fichier Montage (lot 8 du studio de Yoan, 2026-11-18) : le montage joué image par image
// sans fabriquer la vidéo, à partir de ce que le monteur a préparé (format : CONTRAT-STUDIO.md, section 16).
//   - la vidéo coupée légère, déjà étalonnée, avec la bande son exacte du rendu, sert d'horloge ;
//   - zooms, décalages et flous du plan sont rejoués en CSS, image par image, avec les mêmes calculs que le rendu ;
//   - chaque calque (animations, sous-titres) est la composition HyperFrames du monteur, jouée telle quelle dans un
//     cadre, sa timeline calée sur l'image courante (exacte en pause, à chaque image affichée en lecture) ;
//   - derrière la personne : son masque (basse définition) découpe la caméra par-dessus le calque ;
//   - B-rolls : lus par le lecteur, recalés au-delà de 0,12 s en lecture, exacts en pause.
// Les corrections partent en note au chat du monteur (texte, image, zone entourée en 0..1) ; aucune édition directe.
import { el, icone, annoncer } from "./outils.js";
import { zoomA, planA } from "./apercu-calcul.js";

const FPS = 30;
const ECART_LECTURE = 0.12;   // en lecture, un B-roll ou une vidéo de calque n'est recalé qu'au-delà de cet écart (s)
const AVANCE_MASQUES = 45;    // images de masque chargées d'avance

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const fmt = (n) => {
  const t = n / FPS; const m = Math.floor(t / 60);
  return `${m}:${(t - m * 60).toFixed(2).padStart(5, "0")}`;
};

export class Apercu {
  // slug, base (adresse du dossier de montage, se termine par /), url (apercu.json versionné), notes, actions :
  // { envoyerNote({ image, texte, traits }), fabriquer() }, etat : { occupe, fabrication }.
  constructor({ slug, base, url, actions }) {
    this.slug = slug; this.base = base; this.url = null; this.actions = actions;
    this.d = null; this.n = 0; this.enLecture = false; this.pret = false;
    this.calques = []; this.brolls = []; this.masques = new Map(); this.traits = []; this.modeDessin = false;
    this.attente = null;
    try { this.n = Number(sessionStorage.getItem(`apercu:${slug}`)) || 0; } catch { this.n = 0; }
    this.construire();
    this.charger(url);
  }

  // ------------------------------------------------------------------ interface
  construire() {
    this.cam = el("video", { class: "apercu-camera", playsinline: true, preload: "auto", "aria-hidden": "true" });
    this.plan = el("div", { class: "apercu-plan" }, this.cam);
    this.personne = el("canvas", { class: "apercu-personne", "aria-hidden": "true" });
    this.couches = el("div", { class: "apercu-couches" });
    this.dessin = el("canvas", { class: "apercu-dessin", "aria-label": "Zone à entourer" });
    this.chargement = el("div", { class: "apercu-chargement" }, "Je prépare l'aperçu…");
    // Couleurs des calques telles que le rendu les pose (mesuré le 2026-11-18) : ffmpeg convertit les images RGBA des
    // calques en YUV avec la matrice bt601 en plage pleine, puis la vidéo est lue en bt709 plage limitée (l'orange
    // #F15A24 sort en (255, 98, 25), le fond #1A1612 en (8, 3, 0)). La même transformation, affine, rejouée ici.
    const filtre = el("span", { class: "apercu-svg", "aria-hidden": "true", html:
      '<svg width="0" height="0" style="position:absolute"><filter id="apercu-couleurs-rendu" color-interpolation-filters="sRGB">'
      + '<feColorMatrix type="matrix" values="1.24452 -0.06711 -0.01303 0 -0.07306 0.11768 0.97726 0.06945 0 -0.07306 -0.00829 -0.01627 1.18894 0 -0.07306 0 0 0 1 0"/>'
      + "</filter></svg>" });
    this.ecran = el("div", { class: "apercu-ecran" }, filtre, this.plan, this.couches, this.dessin,
      el("span", { class: "apercu-badge" }, "aperçu"), this.chargement);
    this.bLire = el("button", { class: "bouton bouton-accent apercu-lire", type: "button", disabled: true, html: `${icone("lecture")}<span>Lire</span>` });
    this.bAvant = el("button", { class: "bouton bouton-petit", type: "button", title: "Image précédente", "aria-label": "Image précédente" }, "−1 image");
    this.bApres = el("button", { class: "bouton bouton-petit", type: "button", title: "Image suivante", "aria-label": "Image suivante" }, "+1 image");
    this.curseur = el("input", { type: "range", class: "apercu-curseur", min: "0", max: "0", step: "1", value: "0", "aria-label": "Position dans la vidéo" });
    this.temps = el("span", { class: "apercu-temps" }, "0:00.00");
    const barre = el("div", { class: "apercu-barre", role: "group", "aria-label": "Lecture de l'aperçu" },
      this.bLire, this.bAvant, this.bApres, this.curseur, this.temps);
    this.ecarts = el("p", { class: "apercu-ecarts" });

    this.bEntourer = el("button", { class: "bouton bouton-petit", type: "button", "aria-pressed": "false", html: `${icone("entourer")}<span>Entourer</span>` });
    this.bEffacer = el("button", { class: "bouton bouton-discret bouton-petit", type: "button", hidden: true }, "Effacer");
    this.texte = el("textarea", { class: "champ apercu-texte", rows: "3", maxlength: "2000",
      placeholder: "Ce que tu veux changer à cette image. Par exemple : le titre passe sur mon visage, monte-le un peu." });
    this.bNote = el("button", { class: "bouton bouton-plein bouton-petit", type: "button", html: `${icone("envoyer")}<span>Envoyer au monteur</span>` });
    this.ouNote = el("p", { class: "apercu-ou" });
    this.liste = el("ol", { class: "apercu-notes" });
    this.bFabriquer = el("button", { class: "bouton bouton-plein apercu-fabriquer", type: "button", html: `${icone("film")}<span>Fabrique la vidéo</span>` });
    this.etatFab = el("p", { class: "apercu-fab-etat" });
    const notes = el("section", { class: "apercu-panneau", "aria-label": "Tes corrections" },
      el("h3", { class: "apercu-titre" }, "Une correction ?"),
      el("p", { class: "apercu-aide" }, "Mets pause sur l'image, entoure ce qui ne va pas si tu veux, écris ce que tu veux. Ta note part à ton monteur, qui retouche puis te remontre l'aperçu."),
      this.ouNote,
      el("div", { class: "apercu-outils" }, this.bEntourer, this.bEffacer),
      this.texte,
      el("div", { class: "apercu-outils" }, this.bNote),
      this.liste,
      el("div", { class: "apercu-fin" },
        el("p", { class: "apercu-aide" }, "Tout est bon ? Ton monteur fabrique la vidéo finale, en une fois."),
        this.bFabriquer, this.etatFab));
    this.racine = el("div", { class: "apercu-hote", tabindex: "-1", dataset: { slug: this.slug } },
      el("div", { class: "apercu-grille" },
        el("div", { class: "apercu-colonne" }, this.ecran, barre, this.ecarts),
        notes));

    this.bLire.addEventListener("click", () => (this.enLecture ? this.pause() : this.lire()));
    this.bAvant.addEventListener("click", () => { this.pause(); this.aller(this.n - 1); });
    this.bApres.addEventListener("click", () => { this.pause(); this.aller(this.n + 1); });
    this.curseur.addEventListener("input", () => { if (this.enLecture) this.pause(); this.aller(Number(this.curseur.value)); });
    this.racine.addEventListener("keydown", (e) => {
      if (["TEXTAREA", "INPUT"].includes(e.target.tagName) || !this.pret) return;
      if (e.code === "Space") { e.preventDefault(); this.enLecture ? this.pause() : this.lire(); }
      if (e.code === "ArrowLeft") { e.preventDefault(); this.pause(); this.aller(this.n - 1); }
      if (e.code === "ArrowRight") { e.preventDefault(); this.pause(); this.aller(this.n + 1); }
    });
    this.bEntourer.addEventListener("click", () => this.basculerDessin());
    this.bEffacer.addEventListener("click", () => { this.traits = []; this.redessiner(); });
    this.bNote.addEventListener("click", () => this.envoyerNote());
    this.bFabriquer.addEventListener("click", async () => {
      this.bFabriquer.disabled = true;
      try { await this.actions.fabriquer(); this.pause(); }
      catch (e) { annoncer(e.message, "erreur"); this.bFabriquer.disabled = false; }
    });
    this.brancherDessin();
    new ResizeObserver(() => this.taille()).observe(this.ecran);
    this.cam.addEventListener("ended", () => { this.pause(); });
  }

  // ------------------------------------------------------------------ données
  async charger(url) {
    if (!url || url === this.url) return;
    this.url = url;
    const garde = this.n;
    this.pause();
    this.pret = false; this.bLire.disabled = true; this.chargement.hidden = false;
    let d;
    try {
      const r = await fetch(url, { credentials: "same-origin", cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      d = await r.json();
    } catch {
      this.chargement.textContent = "Je n'arrive pas à lire l'aperçu. Rouvre ce fichier dans un instant.";
      return;
    }
    if (url !== this.url) return;
    this.d = d;
    this.curseur.max = String(d.images - 1);
    this.ecarts.textContent = "C'est un aperçu : en pause, chaque image est celle de la vidéo finale. En lecture, une image peut sauter. La vidéo fabriquée sera plus nette"
      + (d.derriere ? ", et le contour autour de toi plus précis." : ".");
    this.masques.clear();
    // Couches, dans l'ordre du rendu : calques derrière, la personne découpée, B-rolls, calques devant (sous-titres en dernier).
    const derriere = d.calques.filter((c) => c.couche === "derriere").sort((a, b) => a.ordre - b.ordre);
    const devant = d.calques.filter((c) => c.couche === "devant")
      .sort((a, b) => (a.source === "sous-titres") - (b.source === "sous-titres") || a.ordre - b.ordre);
    const cadre = (c) => {
      const f = el("iframe", { class: "apercu-calque", title: "", tabindex: "-1", "aria-hidden": "true",
        src: `${this.base}${c.dossier.split("/").map(encodeURIComponent).join("/")}/index.html?v=${encodeURIComponent(c.version || "")}` });
      const x = { c, f, tl: null, videos: [] };
      // Un cadre qui se recharge (lecteur sorti puis remis dans la page) reprend sa timeline et se recale.
      f.addEventListener("load", () => {
        if (!this.pret) return;
        x.tl = null;
        this.attendreCalque(x).then(() => { if (!this.enLecture) this.poser(this.n, true); });
      });
      return x;
    };
    this.calques = [...derriere.map(cadre)];
    const noeuds = this.calques.map((x) => x.f);
    noeuds.push(this.personne);
    this.brolls = (d.brolls || []).map((b) => ({ b, v: el("video", { class: "apercu-broll", muted: true, playsinline: true, preload: "auto", "aria-hidden": "true",
      src: this.base + b.fichier.split("/").map(encodeURIComponent).join("/") }) }));
    for (const b of this.brolls) { b.v.muted = true; noeuds.push(b.v); }
    const av = devant.map(cadre);
    this.calques.push(...av);
    noeuds.push(...av.map((x) => x.f));
    this.couches.replaceChildren(...noeuds);
    this.cam.src = this.base + d.camera.fichier.split("/").map(encodeURIComponent).join("/");
    this.taille();
    const prets = [new Promise((ok) => { this.cam.addEventListener("loadeddata", ok, { once: true }); this.cam.addEventListener("error", ok, { once: true }); }),
      ...this.calques.map((x) => this.attendreCalque(x))];
    await Promise.all(prets);
    if (url !== this.url) return;
    this.pret = true; this.bLire.disabled = false; this.chargement.hidden = true;
    await this.aller(Math.min(garde, d.images - 1));
  }

  attendreCalque(x) {
    return new Promise((ok) => {
      const debut = Date.now();
      const voir = () => {
        let w = null;
        try { w = x.f.contentWindow; } catch { w = null; }
        const tl = w?.__timelines?.root;
        if (tl && w.document.readyState === "complete") {
          x.tl = tl;
          x.videos = [...w.document.querySelectorAll("video[data-start]")].map((v) => {
            v.muted = true; v.pause();
            return { v, debut: Number(v.dataset.start) || 0, duree: Number(v.dataset.duration) || Infinity, media: Number(v.dataset.mediaStart) || 0 };
          });
          (w.document.fonts?.ready || Promise.resolve()).then(() => ok());
          return;
        }
        if (Date.now() - debut > 20000) return ok();   // un calque qui ne répond pas ne bloque pas l'aperçu
        setTimeout(voir, 50);
      };
      voir();
    });
  }

  // ------------------------------------------------------------------ taille
  taille() {
    const w = this.ecran.clientWidth, h = this.ecran.clientHeight;
    if (!w) return;
    this.k = w / 1080;
    for (const x of this.calques) x.f.style.transform = `scale(${this.k})`;
    const dpr = window.devicePixelRatio || 1;
    for (const c of [this.personne, this.dessin]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    this.redessiner();
    if (this.pret) this.poser(this.n, true);
  }

  // ------------------------------------------------------------------ image courante
  poser(n, exact) {
    const d = this.d; if (!d) return;
    this.n = n;
    const p = planA(d, n);
    const k = this.k || (this.ecran.clientWidth / 1080);
    this.cam.style.transformOrigin = `${p.ancre[0] * 100}% ${p.ancre[1] * 100}%`;
    this.cam.style.transform = p.s === 1 ? "" : `scale(${p.s})`;
    this.plan.style.transform = p.dy ? `translateY(${p.dy * (this.ecran.clientHeight / 1920)}px)` : "";
    this.plan.style.filter = p.flou ? `blur(${p.flou.rayon * k}px) brightness(${p.flou.assombrir})` : "";
    for (const x of this.calques) {
      const dedans = n >= x.c.debut && n < x.c.debut + x.c.images;
      x.f.style.visibility = dedans ? "visible" : "hidden";
      if (!dedans || !x.tl) { for (const v of x.videos) if (!v.v.paused) v.v.pause(); continue; }
      // Image k d'un calque = instant k/30 (arrondi à la ms supérieure comme la planche : pile sur k/30, GSAP peut
      // encore montrer l'état d'avant).
      const local = Math.ceil((n - x.c.debut) * 1000 / FPS) / 1000;
      try { x.tl.seek(local, false); } catch { /* calque cassé : il reste figé */ }
      for (const v of x.videos) this.caler(v.v, local >= v.debut && local < v.debut + v.duree, v.media + (local - v.debut), exact);
    }
    for (const b of this.brolls) {
      const dedans = n >= b.b.debut && n < b.b.debut + b.b.images;
      b.v.style.visibility = dedans ? "visible" : "hidden";
      this.caler(b.v, dedans, (n - b.b.debut + 0.5) / FPS, exact);
    }
    this.dessinerPersonne(n);
    this.curseur.value = String(n);
    this.temps.textContent = `${fmt(n)} · image ${n}`;
    if (!this.enLecture) { try { sessionStorage.setItem(`apercu:${this.slug}`, String(n)); } catch { /* rien */ } }
  }

  caler(v, dedans, cible, exact) {
    if (!dedans) { if (!v.paused) v.pause(); return; }
    const ecart = Math.abs(v.currentTime - cible);
    if (exact) { if (!v.paused) v.pause(); if (ecart > 0.005) v.currentTime = cible; return; }
    if (ecart > ECART_LECTURE) v.currentTime = cible;
    if (v.paused) v.play().catch(() => {});
  }

  calqueDerriere(n) {
    return this.calques.find((x) => x.c.masque && n >= x.c.debut && n < x.c.debut + x.c.images) || null;
  }

  masque(x, i) {
    const cle = `${x.c.id}:${i}`;
    let m = this.masques.get(cle);
    if (!m) {
      m = new Image();
      m.decoding = "async";
      m.src = `${this.base}${x.c.masque.dossier.split("/").map(encodeURIComponent).join("/")}/${String(i).padStart(4, "0")}.png`;
      this.masques.set(cle, m);
    }
    return m;
  }

  // La personne découpée par son masque, posée sur les calques derrière elle (même résultat que le trou du rendu :
  // caméra, calque, puis caméra x masque par-dessus).
  dessinerPersonne(n) {
    const x = this.calqueDerriere(n);
    const ctx = this.personne.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.personne.width, this.personne.height);
    if (!x) return;
    const i = n - x.c.debut;
    for (let j = 1; j <= AVANCE_MASQUES && i + j < x.c.images; j += 1) this.masque(x, i + j);
    const m = this.masque(x, i);
    if (!m.complete) { m.onload = () => { if (this.n === n) this.dessinerPersonne(n); }; return; }
    if (this.cam.readyState < 2) return;
    const W = this.personne.width, H = this.personne.height;
    const p = planA(this.d, n);
    const k = W / 1080;
    ctx.filter = p.flou ? `blur(${p.flou.rayon * k}px) brightness(${p.flou.assombrir})` : "none";
    ctx.setTransform(p.s, 0, 0, p.s, p.ancre[0] * W * (1 - p.s), p.ancre[1] * H * (1 - p.s) + p.dy * H / 1920);
    ctx.drawImage(this.cam, 0, 0, W, H);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = "none";
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(m, 0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
  }

  // Va à l'image n, en pause, exacte : la promesse se tient quand tout ce qui s'affiche est à cette image.
  aller(n) {
    if (!this.d) return Promise.resolve();
    n = clamp(Math.round(n), 0, this.d.images - 1);
    const attentes = [];
    const cible = (n + 0.5) / FPS;
    const vu = (v) => new Promise((ok) => {
      const fin = () => { v.removeEventListener("seeked", fin); ok(); };
      v.addEventListener("seeked", fin);
      setTimeout(fin, 3000);
    });
    if (Math.abs(this.cam.currentTime - cible) > 0.005) { attentes.push(vu(this.cam)); this.cam.currentTime = cible; }
    for (const b of this.brolls) {
      if (n >= b.b.debut && n < b.b.debut + b.b.images && Math.abs(b.v.currentTime - (n - b.b.debut + 0.5) / FPS) > 0.005) attentes.push(vu(b.v));
    }
    this.poser(n, true);
    const x = this.calqueDerriere(n);
    if (x) {
      const m = this.masque(x, n - x.c.debut);
      if (!m.complete) attentes.push(new Promise((ok) => { m.addEventListener("load", ok, { once: true }); m.addEventListener("error", ok, { once: true }); }));
    }
    return Promise.all(attentes).then(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))))
      .then(() => { if (this.n === n && !this.enLecture) this.poser(n, true); });
  }

  lire() {
    if (!this.pret || this.enLecture) return;
    if (this.n >= this.d.images - 1) this.n = 0;
    this.traits = []; this.redessiner();
    if (this.modeDessin) this.basculerDessin();
    this.enLecture = true;
    this.bLire.innerHTML = `${icone("pause")}<span>Pause</span>`;
    this.cam.currentTime = (this.n + 0.5) / FPS;
    this.cam.muted = false;
    const partir = () => {
      const rvfc = typeof this.cam.requestVideoFrameCallback === "function";
      const image = (now, meta) => {
        if (!this.enLecture) return;
        const n = rvfc ? Math.round(meta.mediaTime * FPS) : Math.floor(this.cam.currentTime * FPS + 1e-3);
        if (n >= this.d.images - 1) { this.pause(); this.aller(this.d.images - 1); return; }
        this.poser(n, false);
        if (rvfc) this.cam.requestVideoFrameCallback(image); else requestAnimationFrame(image);
      };
      if (rvfc) this.cam.requestVideoFrameCallback(image); else requestAnimationFrame(image);
    };
    this.cam.play().then(partir).catch(() => { this.cam.muted = true; this.cam.play().then(partir).catch(() => this.pause()); });
  }

  pause() {
    if (!this.enLecture) return;
    this.enLecture = false;
    this.bLire.innerHTML = `${icone("lecture")}<span>Lire</span>`;
    this.cam.pause();
    for (const b of this.brolls) b.v.pause();
    for (const x of this.calques) for (const v of x.videos) v.v.pause();
    this.aller(this.n);
  }

  // ------------------------------------------------------------------ entourer
  basculerDessin() {
    this.modeDessin = !this.modeDessin;
    if (this.modeDessin) this.pause();
    this.dessin.classList.toggle("actif", this.modeDessin);
    this.bEntourer.setAttribute("aria-pressed", String(this.modeDessin));
    this.bEntourer.innerHTML = `${icone("entourer")}<span>${this.modeDessin ? "J'ai fini d'entourer" : "Entourer"}</span>`;
  }

  brancherDessin() {
    let trait = null;
    const point = (e) => {
      const r = this.dessin.getBoundingClientRect();
      return [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)].map((v) => Math.round(v * 10000) / 10000);
    };
    this.dessin.addEventListener("pointerdown", (e) => {
      if (!this.modeDessin) return;
      this.dessin.setPointerCapture(e.pointerId);
      trait = [point(e)]; this.traits.push(trait); this.redessiner();
    });
    this.dessin.addEventListener("pointermove", (e) => { if (trait) { trait.push(point(e)); this.redessiner(); } });
    const fin = () => { trait = null; };
    this.dessin.addEventListener("pointerup", fin);
    this.dessin.addEventListener("pointercancel", fin);
  }

  redessiner() {
    const ctx = this.dessin.getContext("2d");
    const W = this.dessin.width, H = this.dessin.height;
    ctx.clearRect(0, 0, W, H);
    this.bEffacer.hidden = !this.traits.length;
    if (!this.traits.length) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const [couleur, epaisseur] of [["rgba(0,0,0,.55)", 7], [getComputedStyle(this.racine).getPropertyValue("--orange").trim() || "#FFA31A", 4]]) {
      ctx.strokeStyle = couleur; ctx.lineWidth = epaisseur * dpr;
      for (const t of this.traits) {
        ctx.beginPath();
        t.forEach(([x, y], i) => (i ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H)));
        if (t.length === 1) ctx.lineTo(t[0][0] * W + 0.1, t[0][1] * H);
        ctx.stroke();
      }
    }
  }

  async envoyerNote() {
    const texte = this.texte.value.trim();
    if (!texte) { annoncer("Écris ce que tu veux changer, puis envoie.", "erreur"); this.texte.focus(); return; }
    this.pause();
    this.bNote.disabled = true;
    try {
      await this.actions.envoyerNote({ image: this.n, texte, traits: this.traits });
      this.texte.value = ""; this.traits = []; this.redessiner();
      if (this.modeDessin) this.basculerDessin();
      annoncer("Ta note est partie à ton monteur.");
    } catch (e) { annoncer(e.message, "erreur"); }
    this.bNote.disabled = false;
  }

  // ------------------------------------------------------------------ état venu du serveur (fichiers)
  // a : medias.apercu (url, notes) ; occupe : le monteur travaille ; ouChat : où est le chat.
  maj(a, { occupe = false, ouChat = "à droite" } = {}) {
    this.charger(a.url);
    this.ouNote.textContent = `Tes notes s'affichent aussi dans le chat du montage, ${ouChat}.`;
    const notes = a.notes || [];
    this.liste.replaceChildren(...notes.map((x) => {
      const aller = el("button", { class: "apercu-note-t", type: "button", title: "Revoir cette image" }, fmt(x.image));
      aller.addEventListener("click", () => { this.pause(); this.aller(x.image).then(() => { this.traits = JSON.parse(JSON.stringify(x.traits || [])); this.redessiner(); }); });
      return el("li", { class: "apercu-note" }, aller,
        el("span", { class: "apercu-note-texte" }, x.texte, x.traits?.length ? el("span", { class: "apercu-note-zone" }, " · zone entourée") : null),
        el("span", { class: `apercu-note-etat${x.prise ? " apercu-note-faite" : ""}` }, x.prise ? "retouchée" : "envoyée"));
    }));
    this.liste.hidden = !notes.length;
    this.bFabriquer.disabled = occupe;
    this.etatFab.textContent = occupe ? "Ton monteur travaille : attends qu'il ait fini pour fabriquer la vidéo." : "";
  }

  detruire() {
    this.pause();
    this.cam.removeAttribute("src"); this.cam.load();
    this.couches.replaceChildren();
  }
}
