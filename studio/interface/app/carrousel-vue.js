// Les slides d'un carrousel en grand et en aperçu de post (21/11/2026, retour de Yoan sur sa première mise en page).
// - ouvrirVisionneuse : une slide en grand, à sa vraie proportion, par-dessus la page. Flèches (écran et clavier),
//   balayage au doigt, Échap pour fermer, « 3 / 7 ». « Télécharger cette slide » et « Tout télécharger » (un zip au
//   nom du contenu) : le serveur les dépose dans Téléchargements, comme la vidéo montée.
// - apercuPost : le post tel qu'il apparaîtra dans le fil (compte en tête, slides qui défilent, points, légende coupée
//   avec « plus »), dans l'ordre que le récapitulatif a lu dans ce qui part vraiment. Aux couleurs du studio.
import { el, icone, annoncer } from "./outils.js";

// Le texte de la ligne d'état après un téléchargement.
function phraseDepot(r) {
  return `C'est fait : « ${r.nom} » est dans Téléchargements.`;
}

// Un bouton qui télécharge (une slide si n() rend un numéro, tout sinon) et dit où c'est arrivé dans `info`.
function boutonTelecharger(api, slug, libelle, n, info, { petit = false } = {}) {
  const b = el("button", { class: `bouton${petit ? " bouton-petit" : ""}`, type: "button", html: `${icone("telecharger")}<span>${libelle}</span>` });
  b.addEventListener("click", async () => {
    b.disabled = true;
    const span = b.querySelector("span");
    span.textContent = "Je prépare le fichier";
    try {
      const r = await api.telechargerSlides(slug, n());
      if (info) info.textContent = phraseDepot(r); else annoncer(phraseDepot(r));
    } catch (e) {
      const t = e?.message || "Je n'arrive pas à le télécharger. Réessaie dans un moment.";
      if (info) info.textContent = t; else annoncer(t, "erreur");
    } finally {
      span.textContent = libelle;
      b.disabled = false;
    }
  });
  return b;
}

// « Tout télécharger », à poser sous une grille de slides.
export function barreTelechargement(api, slug, nb) {
  const info = el("p", { class: "cv-info", role: "status", "aria-live": "polite" });
  return el("div", { class: "cv-barre" }, boutonTelecharger(api, slug, nb > 1 ? `Tout télécharger (${nb} slides)` : "Télécharger", () => null, info), info);
}

// Le balayage au doigt (ou à la souris) : plus de 40 px à l'horizontale, et plus qu'à la verticale.
function balayage(zone, aller) {
  let x0 = null, y0 = null, id = null;
  zone.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse" && e.button !== 0) return; x0 = e.clientX; y0 = e.clientY; id = e.pointerId; });
  const fin = (e) => {
    if (x0 === null || e.pointerId !== id) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { zone.dataset.balaye = "1"; aller(dx < 0 ? 1 : -1); setTimeout(() => delete zone.dataset.balaye, 0); }
  };
  zone.addEventListener("pointerup", fin);
  zone.addEventListener("pointercancel", () => { x0 = null; });
}

// urls : les slides dans l'ordre ; depart : l'index ouvert ; retour : l'élément qui reprend le focus à la fermeture.
export function ouvrirVisionneuse({ urls, depart = 0, titre = "", slug, api, retour = null }) {
  if (!urls?.length) return;
  let i = Math.min(Math.max(0, depart), urls.length - 1);
  const img = el("img", { class: "cv-image", alt: "", decoding: "async" });
  const compte = el("p", { class: "cv-compte", "aria-live": "polite" });
  const nom = el("h2", { class: "cv-titre", id: "cv-titre" }, titre || "Ton carrousel");
  const prec = el("button", { class: "cv-fleche cv-prec", type: "button", "aria-label": "Slide précédente", html: icone("fleche") });
  const suiv = el("button", { class: "cv-fleche cv-suiv", type: "button", "aria-label": "Slide suivante", html: icone("fleche") });
  const fermer = el("button", { class: "bouton bouton-petit", type: "button", html: `${icone("fermer")}<span>Fermer</span>` });
  const info = el("p", { class: "cv-info", role: "status", "aria-live": "polite" });
  const scene = el("div", { class: "cv-scene" }, img);
  const boite = el("dialog", { class: "cv-boite", "aria-labelledby": "cv-titre" },
    el("div", { class: "cv-tete" }, el("div", { class: "cv-tete-texte" }, nom, compte), fermer),
    el("div", { class: "cv-centre" }, urls.length > 1 ? prec : null, scene, urls.length > 1 ? suiv : null),
    slug && api ? el("div", { class: "cv-pied" },
      el("div", { class: "cv-boutons" },
        boutonTelecharger(api, slug, "Télécharger cette slide", () => i + 1, info, { petit: true }),
        urls.length > 1 ? boutonTelecharger(api, slug, "Tout télécharger", () => null, info, { petit: true }) : null),
      info) : null);
  const aller = (n) => {
    if (n < 0 || n >= urls.length) return;
    i = n;
    img.src = urls[i];
    img.alt = `Slide ${i + 1} sur ${urls.length}${titre ? ` de « ${titre} »` : ""}`;
    compte.textContent = `${i + 1} / ${urls.length}`;
    prec.disabled = i === 0;
    suiv.disabled = i === urls.length - 1;
    // Les voisines se chargent d'avance : le passage est immédiat.
    for (const k of [i - 1, i + 1]) if (urls[k]) { const p = new Image(); p.src = urls[k]; }
  };
  prec.addEventListener("click", () => aller(i - 1));
  suiv.addEventListener("click", () => aller(i + 1));
  fermer.addEventListener("click", () => boite.close());
  balayage(scene, (d) => aller(i + d));
  // Un clic sur le fond sombre (hors de la slide et des boutons) ferme aussi.
  boite.addEventListener("click", (e) => { if (e.target === boite || e.target.classList?.contains("cv-centre")) boite.close(); });
  boite.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); aller(i - 1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); aller(i + 1); }
    // Échap ferme la visionneuse seulement : sans ça, le studio reviendrait aussi à l'accueil.
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); boite.close(); }
  });
  boite.addEventListener("close", () => { boite.remove(); retour?.focus?.(); });
  document.body.append(boite);
  aller(i);
  boite.showModal();
  fermer.focus();
}

// La légende coupée comme dans le fil : la première ligne, 125 signes au plus, puis « plus ».
export function legendeCoupee(texte, max = 125) {
  const t = String(texte || "").trim();
  if (!t) return { court: "", coupee: false };
  const ligne = t.split("\n")[0];
  let court = ligne.length > max ? ligne.slice(0, max).replace(/\s+\S*$/, "") : ligne;
  if (!court) court = ligne.slice(0, max);
  return { court, coupee: court.length < t.length };
}

// La proportion du cadre : celle des slides, dans ce que le fil accepte (de 4:5 en hauteur à 1,91:1 en largeur).
export function proportionCadre(largeur, hauteur) {
  if (!(largeur > 0 && hauteur > 0)) return 4 / 5;
  return Math.min(1.91, Math.max(4 / 5, largeur / hauteur));
}

// L'aperçu du post. compte : le nom du compte (sans @) ; legende : celle qui part. Rend { noeud, tiktok(on) }.
let numeroApercu = 0;
export function apercuPost({ urls, compte, legende, titre = "", slug, api }) {
  const id = `ig-${++numeroApercu}`;
  let i = 0;
  const nomCompte = compte || "ton compte";
  const piste = el("div", { class: "ig-piste" }, ...urls.map((u, k) => {
    const b = el("button", { class: "ig-slide", type: "button", tabindex: "-1", "aria-label": `Voir la slide ${k + 1} en grand` },
      el("img", { src: u, alt: "", width: "1080", height: "1350", loading: k < 2 ? "eager" : "lazy", decoding: "async", draggable: "false" }));
    b.addEventListener("click", () => {
      if (cadre.dataset.balaye) return;
      ouvrirVisionneuse({ urls, depart: k, titre, slug, api, retour: cadre });
    });
    return b;
  }));
  const compteur = el("span", { class: "ig-compteur", "aria-hidden": "true" });
  const prec = el("button", { class: "ig-fleche ig-prec", type: "button", "aria-label": "Slide précédente", html: icone("fleche") });
  const suiv = el("button", { class: "ig-fleche ig-suiv", type: "button", "aria-label": "Slide suivante", html: icone("fleche") });
  const points = el("div", { class: "ig-points", "aria-hidden": "true" }, ...urls.map(() => el("span", { class: "ig-point" })));
  const annonce = el("span", { class: "visuel-cache", "aria-live": "polite" });
  // Le cadre prend le focus : flèches gauche et droite pour passer d'une slide à l'autre, Entrée pour l'ouvrir en grand.
  const cadre = el("div", { class: "ig-media", tabindex: "0", role: "group", "aria-roledescription": "carrousel",
    "aria-label": `Les ${urls.length} slides, dans l'ordre où elles partiront. Flèches gauche et droite pour les faire défiler, Entrée pour la voir en grand.`,
    "aria-describedby": `${id}-annonce` }, piste, compteur, urls.length > 1 ? prec : null, urls.length > 1 ? suiv : null);
  annonce.id = `${id}-annonce`;
  const aller = (n) => {
    i = Math.min(Math.max(0, n), urls.length - 1);
    piste.style.transform = `translateX(${-100 * i}%)`;
    compteur.textContent = `${i + 1}/${urls.length}`;
    annonce.textContent = `Slide ${i + 1} sur ${urls.length}`;
    prec.hidden = i === 0;
    suiv.hidden = i === urls.length - 1;
    [...points.children].forEach((p, k) => p.classList.toggle("actif", k === i));
  };
  prec.addEventListener("click", (e) => { e.stopPropagation(); aller(i - 1); });
  suiv.addEventListener("click", (e) => { e.stopPropagation(); aller(i + 1); });
  balayage(cadre, (d) => aller(i + d));
  cadre.addEventListener("keydown", (e) => {
    if (e.target !== cadre) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); aller(i - 1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); aller(i + 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ouvrirVisionneuse({ urls, depart: i, titre, slug, api, retour: cadre }); }
  });
  // La proportion vient de la première slide, dès qu'elle est lue (4:5 en attendant, le format des slides du studio).
  cadre.style.aspectRatio = String(4 / 5);
  const premiere = piste.querySelector("img");
  const regler = () => { cadre.style.aspectRatio = String(proportionCadre(premiere.naturalWidth, premiere.naturalHeight)); };
  if (premiere.complete && premiere.naturalWidth) regler(); else premiere.addEventListener("load", regler, { once: true });

  const { court, coupee } = legendeCoupee(legende);
  const texte = el("span", { class: "ig-legende-texte" }, court);
  const plus = coupee ? el("button", { class: "ig-plus", type: "button", "aria-expanded": "false" }, "plus") : null;
  plus?.addEventListener("click", () => {
    const ouvert = plus.getAttribute("aria-expanded") === "true";
    texte.textContent = ouvert ? court : String(legende).trim();
    plus.textContent = ouvert ? "plus" : "moins";
    plus.setAttribute("aria-expanded", String(!ouvert));
    texte.parentElement.classList.toggle("ouverte", !ouvert);
  });
  const lettre = (nomCompte.match(/[\p{L}\p{N}]/u) || ["?"])[0].toUpperCase();
  const tiktok = el("p", { class: "ig-tiktok doux", hidden: true },
    `Sur TikTok : les mêmes ${urls.length} images, dans le même ordre. La première sert de couverture.`);
  const noeud = el("div", { class: "ig-zone" },
    el("figure", { class: "ig-post", "aria-label": `Aperçu du post « ${titre} » sur Instagram` },
      el("div", { class: "ig-tete" }, el("span", { class: "ig-avatar", "aria-hidden": "true" }, lettre), el("span", { class: "ig-compte" }, nomCompte)),
      cadre, annonce, points,
      el("figcaption", { class: "ig-legende" },
        ...(legende ? [el("strong", { class: "ig-legende-compte" }, nomCompte), " ", texte, ...(coupee ? [/[.!?…]$/.test(court) ? " " : "… ", plus] : [])]
          : [el("span", { class: "doux" }, "Pas de légende.")]))),
    tiktok);
  aller(0);
  return { noeud, tiktok: (on) => { tiktok.hidden = !on; } };
}
