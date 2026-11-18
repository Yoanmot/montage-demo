// Le récapitulatif avant programmation, dans la page (lot 9 : plus de fenêtre par-dessus).
// Rien ne part sans le clic sur « Programmer » ; un changement de date ou un retrait se revérifie.
// Ressources gratuites (recap.ressources présent : client qui a un site de ressources) : chaque post
// choisit dans une liste la ressource que reçoivent ceux qui commentent son mot ; ce choix se revérifie
// comme une date. Sans recap.ressources (Romain), la ligne « Mot en commentaire » d'avant reste.
// Retouches en place (18/11/2026) : la légende d'un reel et le message de la ressource choisie se
// modifient ici ; le clic sur Programmer les enregistre (et valide le message) avant d'envoyer, et ce
// qui part est ce qui est affiché. Une retouche fausse bloque le bouton, avec la raison sous le champ.
// « La légende ne cite pas le mot X » suit la légende en direct (même règle que zernio.py, motAbsent) :
// il disparaît dès que la légende retouchée contient le mot, revient s'il en sort.
// Reel d'essai (e.reel_essai présent : client qui l'a activé, reels seulement ; lot 9D) : une case et le
// choix du passage en reel normal. Comme une date, un changement se revérifie avant de pouvoir programmer.
// Aucune limite de durée : si Instagram refuse, la phrase du refus le dit.

import { el, icone, annoncer, quandLisible, pluriel } from "./outils.js";
import { motAbsent } from "./mot-absent.js";

const VERDICTS = {
  OK: { cls: "ok", texte: "Prêt à partir" },
  ATTENTION: { cls: "attention", texte: "À regarder" },
  BLOQUE: { cls: "bloque", texte: "Ne peut pas partir" },
};

// conteneur : où dessiner ; chercher() : la promesse du récapitulatif (recap ou semaine du serveur).
// Les retouches en cours, gardées quand le récapitulatif se revérifie (conteneur -> Map slug -> textes).
const retouchesDe = new WeakMap();

export async function recapDans(studio, conteneur, chercher, { apres } = {}) {
  conteneur.replaceChildren(el("p", { class: "recap-charge" }, el("span", { class: "points", "aria-hidden": "true" }, el("i"), el("i"), el("i")), "Je vérifie chaque publication"));
  let recap;
  try { recap = await chercher(); }
  catch (e) { conteneur.replaceChildren(el("p", { class: "recap-erreur" }, e.message)); return; }
  dessiner(studio, conteneur, recap, apres);
}

function dessiner(studio, conteneur, recap, apres) {
  const els = recap.elements || [];
  if (!els.length) {
    conteneur.replaceChildren(el("p", { class: "vide-doux" }, "Rien à programmer ici : aucun contenu monté ou mis en page qui attend. Ce qui est déjà programmé ne bouge pas."));
    return;
  }
  const modifs = new Map();
  const choixRessource = new Map(); // slug -> slug de ressource choisi (ou "" pour aucune), s'il a changé
  const choixEssai = new Map(); // slug -> "MANUAL" | "SS_PERFORMANCE" | null, s'il a changé
  const retires = new Set();
  if (!retouchesDe.has(conteneur)) retouchesDe.set(conteneur, new Map());
  const retouches = retouchesDe.get(conteneur); // slug -> { legende?, message?, bouton?, ressource? }
  const erreurs = new Map(); // "slug:champ" -> phrase
  const ctx = { recap, retouches, erreurs, limites: recap.limites || { legende: 2200, message: 640, bouton: 20 }, pret: false, maj: () => { if (ctx.pret) majPied(); } };
  const lignes = els.map((e) => ligne(e, modifs, retires, () => majPied(), recap.ressources, choixRessource, ctx, choixEssai));
  const toutDeSuite = els.every((e) => e.quand === "maintenant");
  const resume = el("p", { class: "recap-resume" });
  const confirmer = el("button", { class: "bouton bouton-accent bouton-grand", type: "button" });
  const maj = el("button", { class: "bouton", type: "button", hidden: true, html: `${icone("synchro")}<span>Revérifier avec les changements</span>` });

  function majPied() {
    const restants = els.filter((e) => !retires.has(e.slug));
    const change = modifs.size > 0 || retires.size > 0 || choixRessource.size > 0 || choixEssai.size > 0;
    const bloque = restants.some((e) => e.verdict === "BLOQUE");
    const faux = [...erreurs.keys()].some((k) => restants.some((e) => k.startsWith(e.slug + ":")));
    maj.hidden = !change;
    confirmer.hidden = change;
    confirmer.disabled = bloque || faux || !restants.length;
    confirmer.innerHTML = `${icone("envoi")}<span>${toutDeSuite ? "Publier maintenant" : restants.length > 1 ? `Programmer les ${restants.length}` : "Programmer"}</span>`;
    resume.textContent = change ? "Tu as changé quelque chose : je revérifie avant que tu confirmes."
      : bloque ? "Une publication ne peut pas partir. Change sa date ou retire-la, puis revérifie."
      : faux ? "Un texte est à corriger (la raison est sous le champ) avant de programmer."
      : `${pluriel(restants.length, "publication", "publications")}. Rien ne part tant que tu n'as pas cliqué.`;
  }

  maj.addEventListener("click", () => {
    const elements = els.filter((e) => !retires.has(e.slug)).map((e) => {
      const r = choixRessource.has(e.slug) ? choixRessource.get(e.slug) : e.ressource;
      const essai = choixEssai.has(e.slug) ? choixEssai.get(e.slug) : e.reel_essai?.choix || null;
      return { slug: e.slug, quand: modifs.get(e.slug) || e.quand, ...(r ? { ressource: r } : {}), ...(essai ? { essai } : {}) };
    });
    if (!elements.length) { conteneur.replaceChildren(); return; }
    recapDans(studio, conteneur, () => studio.api.recap(elements), { apres });
  });

  confirmer.addEventListener("click", async () => {
    confirmer.disabled = true;
    confirmer.innerHTML = `<span>${toutDeSuite ? "Je publie" : "Je programme"}</span>`;
    try {
      const textes = {};
      for (const e of els) {
        if (retires.has(e.slug)) continue;
        const t = retouches.get(e.slug);
        if (!t) continue;
        const o = {};
        if (typeof t.legende === "string" && e.legende_modifiable) o.legende = t.legende;
        if (e.message_dm && t.ressource === e.ressource) {
          if (typeof t.message === "string") o.message = t.message;
          if (typeof t.bouton === "string") o.bouton = t.bouton;
        }
        if (Object.keys(o).length) textes[e.slug] = o;
      }
      const r = await studio.api.confirmer(recap.recap_id, textes);
      retouchesDe.delete(conteneur);
      resultats(studio, conteneur, r.resultats || [], els);
      apres?.();
    } catch (e) { annoncer(e.message, "erreur"); majPied(); }
  });

  conteneur.replaceChildren(el("div", { class: "recap" }, ...lignes,
    el("div", { class: "recap-pied" }, resume, el("div", { class: "recap-boutons" }, maj, confirmer))));
  ctx.pret = true;
  majPied();
}

function ligne(e, modifs, retires, auChangement, ressources, choixRessource, ctx, choixEssai) {
  const v = VERDICTS[e.verdict] || VERDICTS.ATTENTION;
  const toutDeSuite = e.quand === "maintenant";
  const [j, h] = toutDeSuite ? ["", ""] : (e.quand || " ").split(" ");
  const date = el("input", { type: "date", class: "champ champ-date", value: j, "aria-label": `Jour de « ${e.titre} »` });
  const heure = el("input", { type: "time", class: "champ champ-heure", value: h, step: "300", "aria-label": `Heure de « ${e.titre} »` });
  const change = () => { const q = `${date.value} ${heure.value}`; if (q === e.quand) modifs.delete(e.slug); else modifs.set(e.slug, q); auChangement(); };
  date.addEventListener("change", change); heure.addEventListener("change", change);
  const retirer = el("button", { class: "bouton bouton-discret bouton-petit", type: "button" }, "Retirer");
  const n = el("article", { class: `recap-ligne v-${v.cls}` });
  retirer.addEventListener("click", () => {
    const r = !retires.has(e.slug);
    if (r) retires.add(e.slug); else retires.delete(e.slug);
    n.classList.toggle("retiree", r); retirer.textContent = r ? "Remettre" : "Retirer"; auChangement();
  });
  const media = e.video_url
    ? el("video", { class: "recap-video", src: e.video_url, controls: true, preload: "metadata", width: "110", height: "196" })
    : e.slides_urls?.length ? el("div", { class: "recap-slides" }, ...e.slides_urls.slice(0, 4).map((u, i) => el("img", { src: u, alt: `Image ${i + 1}`, width: "54", height: "68", loading: "lazy" }))) : null;
  if (!media) n.classList.add("sans-media");
  // Les messages du serveur, et l'avertissement du mot absent qui suit la légende telle qu'elle est tapée.
  const absent = e.mot_absent || null;
  const base = (e.messages || []).filter((m) => !absent || m !== absent.message);
  const messages = el("ul", { class: "recap-messages" });
  const verdict = el("span", { class: "verdict" });
  const majMot = (legende) => {
    const manque = Boolean(absent) && motAbsent(legende, absent.mot);
    const x = VERDICTS[absent ? (manque && absent.verdict_sinon === "OK" ? "ATTENTION" : absent.verdict_sinon) : e.verdict] || VERDICTS.ATTENTION;
    messages.replaceChildren(...base.map((m) => el("li", {}, m)), ...(manque ? [el("li", { class: "recap-mot-absent" }, absent.message)] : []));
    messages.hidden = !messages.children.length;
    verdict.className = `verdict verdict-${x.cls}`;
    verdict.replaceChildren(el("span", { html: icone(x.cls === "ok" ? "coche" : "attention") }), x.texte);
    for (const c of ["ok", "attention", "bloque"]) n.classList.toggle(`v-${c}`, c === x.cls);
  };
  const legende = e.legende_modifiable ? champLegende(e, ctx, majMot) : el("p", { class: "recap-legende" }, e.legende || "Pas de légende.");
  if (!e.legende_modifiable) majMot(e.legende);
  n.append(
    media ? el("div", { class: "recap-media" }, media) : null,
    el("div", { class: "recap-infos" },
      el("div", { class: "recap-ligne-tete" },
        el("h4", {}, e.titre),
        verdict),
      messages,
      el("dl", { class: "recap-champs" },
        el("dt", {}, "Quand"), toutDeSuite ? el("dd", { class: "recap-quand" }, el("span", { class: "quand-texte" }, "Tout de suite, dès que tu confirmes"))
          : el("dd", { class: "recap-quand" }, el("span", { class: "quand-texte" }, quandLisible(e.quand)), el("span", { class: "quand-champs" }, date, heure)),
        el("dt", {}, "Légende"), el("dd", {}, legende),
        ...(e.reel_essai ? champEssai(e, choixEssai, auChangement) : []),
        ...(Array.isArray(ressources) ? champRessource(e, ressources, choixRessource, auChangement, ctx)
          : [el("dt", {}, "Mot en commentaire"), el("dd", {}, e.mot ? el("strong", { class: "mot-com" }, e.mot) : el("span", { class: "doux" }, "Aucun : pas de message automatique"))])),
      el("div", { class: "recap-ligne-pied" }, retirer)));
  return n;
}

// « Reel d'essai » : une case, puis comment il passe en reel normal.
let numeroEssai = 0;
function champEssai(e, choixEssai, auChangement) {
  const info = e.reel_essai;
  const id = `essai-${++numeroEssai}`;
  const depart = info.choix || null;
  const coche = el("input", { type: "checkbox", id, checked: depart ? true : null, "aria-describedby": `${id}-note` });
  const option = (valeur, texte) => {
    const r = el("input", { type: "radio", name: `${id}-passage`, value: valeur, checked: (depart || "MANUAL") === valeur ? true : null });
    return { r, label: el("label", { class: "recap-essai-option" }, r, el("span", {}, texte)) };
  };
  const manuel = option("MANUAL", "moi, depuis Instagram");
  const auto = option("SS_PERFORMANCE", "tout seul, s'il marche auprès de ceux qui ne te suivent pas");
  const passage = el("fieldset", { class: "recap-essai-passage", hidden: !depart || null },
    el("legend", {}, "Le passer en reel normal"), manuel.label, auto.label);
  const valeur = () => (coche.checked ? (auto.r.checked ? "SS_PERFORMANCE" : "MANUAL") : null);
  const change = () => {
    passage.hidden = !coche.checked;
    const v = valeur();
    if (v === depart) choixEssai.delete(e.slug); else choixEssai.set(e.slug, v);
    auChangement();
  };
  coche.addEventListener("change", change);
  manuel.r.addEventListener("change", change);
  auto.r.addEventListener("change", change);
  return [el("dt", {}, "Format"), el("dd", { class: "recap-essai" },
    el("label", { class: "recap-essai-case", for: id }, coche, el("span", {}, "Reel d'essai")),
    passage,
    el("p", { class: "recap-essai-note doux", id: `${id}-note` }, "Instagram doit avoir ouvert cette fonction sur ton compte. Sinon, il la refuse et rien ne part."))];
}

// Les contrôles de zernio.py sur ce qui part (mêmes phrases que le serveur, publication.mjs erreursTextes).
const TIRET_LONG = "\u2014";
function erreurTexte(champ, valeur, limites) {
  const v = champ === "bouton" ? String(valeur).split(/\s+/).filter(Boolean).join(" ") : String(valeur).trim();
  const nom = { legende: "La légende", message: "Le message", bouton: "Le texte du bouton" }[champ];
  if (!v) return champ === "bouton" ? "Le bouton a besoin d'un texte." : `${nom} ne peut pas être vide.`;
  if (v.includes(TIRET_LONG)) return `${nom} contient un tiret long : remplace-le par une virgule ou deux points.`;
  const n = champ === "legende" ? Array.from(v).length : champ === "message" ? v.replace(/\[\s*son\s+pr[ée]nom\s*\]/gi, "{{first_name}}").length : v.length;
  if (n > limites[champ]) return champ === "legende" ? `La légende est trop longue pour Instagram (${n} caractères, ${limites[champ]} au plus).`
    : `${nom} est trop long (${n} caractères, ${limites[champ]} au plus).`;
  return null;
}

// Un champ retouchable : la valeur affichée est celle qui partira ; l'erreur s'écrit dessous et bloque le bouton.
function champTexte(e, ctx, champ, initiale, { multi = true, label, ressource, aChaqueFrappe } = {}) {
  const t = ctx.retouches.get(e.slug) || {};
  const garde = ressource === undefined || t.ressource === ressource;
  const valeur = garde && typeof t[champ] === "string" ? t[champ] : initiale || "";
  const lignes = Math.min(14, Math.max(2, String(valeur).split("\n").length));
  const n = multi
    ? el("textarea", { class: `champ recap-texte recap-texte-${champ}`, rows: String(lignes), "aria-label": label, spellcheck: "true" }, valeur)
    : el("input", { type: "text", class: `champ recap-texte recap-texte-${champ}`, value: valeur, "aria-label": label });
  const erreur = el("p", { class: "recap-champ-erreur", role: "alert", hidden: true });
  const cle = `${e.slug}:${champ}`;
  const verifier = () => {
    const x = erreurTexte(champ, n.value, ctx.limites);
    erreur.textContent = x || ""; erreur.hidden = !x; n.classList.toggle("faux", Boolean(x));
    if (x) ctx.erreurs.set(cle, x); else ctx.erreurs.delete(cle);
  };
  // Un texte se lit en entier : la zone prend la hauteur de son contenu (bornée), dès qu'elle est affichée.
  const ajuster = () => { if (!multi || !n.isConnected) return; n.style.height = "auto"; n.style.height = `${Math.min(n.scrollHeight + 2, 460)}px`; };
  if (multi) requestAnimationFrame(() => requestAnimationFrame(ajuster));
  n.addEventListener("input", () => {
    ajuster();
    const r = ctx.retouches.get(e.slug) || {};
    if (ressource !== undefined && r.ressource !== ressource) { delete r.message; delete r.bouton; r.ressource = ressource; }
    r[champ] = n.value;
    ctx.retouches.set(e.slug, r);
    verifier(); aChaqueFrappe?.(n.value); ctx.maj();
  });
  verifier();
  aChaqueFrappe?.(n.value);
  return { champ: n, erreur, oublier: () => ctx.erreurs.delete(cle) };
}

function champLegende(e, ctx, aChaqueFrappe) {
  const c = champTexte(e, ctx, "legende", e.legende, { label: `Légende de « ${e.titre} »`, aChaqueFrappe });
  return el("div", { class: "recap-texte-bloc" }, c.champ, c.erreur);
}

// La ressource offerte par ce post : la liste des ressources du site (celle dont la légende cite le mot
// en premier), choisie par le client, jamais d'office. Une ressource qui ne peut pas être offerte est
// grisée, avec sa raison sous la liste ; une liste vide dit pourquoi. Puis le message exact du DM.
function champRessource(e, ressources, choixRessource, auChangement, ctx) {
  const legende = String(e.legende || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const cite = (r) => r.mot && new RegExp(`(^|[^A-Z0-9])${r.mot}([^A-Z0-9]|$)`).test(legende);
  const offrable = (r) => r.disponible !== false;
  const triees = [...ressources].sort((a, b) => (offrable(b) - offrable(a)) || (cite(b) - cite(a)) || a.titre.localeCompare(b.titre, "fr"));
  const choix = el("select", { class: "champ recap-ressource", "aria-label": `Ressource offerte avec « ${e.titre} »` },
    el("option", { value: "" }, "Aucune ressource"),
    ...triees.map((r) => el("option", { value: r.slug, selected: r.slug === e.ressource || null, disabled: !offrable(r) && r.slug !== e.ressource ? true : null },
      `${r.mot || "Sans mot"} : ${r.titre}${!offrable(r) ? " (indisponible)" : cite(r) ? " (dans ta légende)" : ""}`)));
  if (!triees.some((r) => r.slug === e.ressource) && e.ressource) {
    choix.append(el("option", { value: e.ressource, selected: true }, `${e.ressource_titre || "Ressource choisie"} (pas en ligne)`));
  }
  const grisees = triees.filter((r) => !offrable(r));
  const raisons = grisees.length ? el("ul", { class: "recap-ressource-raisons" },
    ...grisees.map((r) => el("li", {}, el("strong", {}, r.titre), ` : ${r.probleme || "elle ne peut pas être offerte pour l'instant."}`))) : null;
  const note = ctx.recap.ressources_note ? el("p", { class: "recap-ressource-note doux" }, ctx.recap.ressources_note) : null;
  const phrase = el("p", { class: "recap-mot" });
  const message = el("div", { class: "recap-dm" });
  let champsDm = [];
  const majPhrase = () => {
    const r = triees.find((x) => x.slug === choix.value && offrable(x));
    phrase.replaceChildren(...(r ? ["Ceux qui commentent ", el("strong", { class: "mot-com" }, r.mot), " reçoivent : ", el("span", {}, r.titre)]
      : [el("span", { class: "doux" }, triees.some(offrable) ? "Aucun mot : personne ne reçoit de message." : "Personne ne reçoit de message.")]));
    for (const c of champsDm) c.oublier();
    champsDm = [];
    // Le message exact du DM : celui vérifié au récapitulatif si c'est la ressource choisie, sinon celui de la liste.
    const dm = r && r.slug === e.ressource && e.message_dm ? e.message_dm : r && typeof r.message === "string" ? { mot: r.mot, message: r.message, bouton: r.bouton || "", a_valider: r.a_valider } : null;
    if (!dm) { message.replaceChildren(); message.hidden = true; ctx.maj(); return; }
    const m = champTexte(e, ctx, "message", dm.message, { label: `Message privé envoyé à ceux qui commentent ${dm.mot}`, ressource: r.slug });
    const b = champTexte(e, ctx, "bouton", dm.bouton, { multi: false, label: "Texte du bouton du message", ressource: r.slug });
    champsDm = [m, b];
    message.hidden = false;
    message.replaceChildren(
      el("p", { class: "recap-dm-titre" }, "Le message privé qu'ils reçoivent"),
      m.champ, m.erreur,
      el("label", { class: "recap-dm-bouton" }, el("span", {}, "Bouton"), b.champ), b.erreur,
      el("p", { class: "recap-dm-note" + (dm.a_valider ? " a-valider" : "") }, dm.a_valider
        ? "Ce message n'est pas encore validé : en cliquant sur Programmer, tu le valides tel qu'il est ici."
        : "Tu peux le retoucher ici : il est enregistré tel qu'il est affiché quand tu cliques sur Programmer."),
      el("p", { class: "recap-dm-aide doux" }, "[son prénom] est remplacé par le prénom de la personne qui commente."));
    ctx.maj();
  };
  choix.addEventListener("change", () => {
    if ((choix.value || null) === (e.ressource || null)) choixRessource.delete(e.slug); else choixRessource.set(e.slug, choix.value);
    majPhrase(); auChangement();
  });
  majPhrase();
  return [el("dt", {}, "Ressource gratuite"), el("dd", { class: "recap-ressource-champ" }, choix, raisons, note, phrase, message)];
}

function resultats(studio, conteneur, res, els) {
  const titre = (s) => els.find((e) => e.slug === s)?.titre || "Un contenu";
  const toutDeSuite = els.every((e) => e.quand === "maintenant");
  conteneur.replaceChildren(el("div", { class: "recap" },
    el("ul", { class: "recap-resultats" }, ...res.map((r) => {
      const bon = /programm|publi|simulation/i.test(r.statut || "");
      const e = els.find((x) => x.slug === r.slug);
      // Le post est parti, pas la règle du mot : un bouton pour la brancher, une fois.
      let brancher = null;
      if (r.poser_mot) {
        brancher = el("button", { class: "bouton bouton-petit", type: "button" }, "Brancher le mot");
        brancher.addEventListener("click", async () => {
          brancher.disabled = true; brancher.textContent = "Je branche le mot";
          try { const x = await studio.api.poserMot(r.poser_mot.slug, r.poser_mot.ressource); brancher.replaceWith(el("p", {}, x.message)); }
          catch (err) { annoncer(err.message, "erreur"); brancher.disabled = false; brancher.textContent = "Brancher le mot"; }
        });
      }
      // Simulation : les textes exacts qui partiraient (lus dans les requêtes préparées, retouches comprises).
      const envoi = r.envoi ? el("dl", { class: "recap-envoi" },
        el("dt", {}, "Légende qui partirait"), el("dd", {}, r.envoi.legende),
        ...(r.envoi.reel_essai ? [el("dt", {}, "Reel d'essai"), el("dd", {}, r.envoi.reel_essai === "SS_PERFORMANCE"
          ? "Oui : montré seulement aux gens qui ne te suivent pas, passé en reel normal tout seul s'il marche."
          : "Oui : montré seulement aux gens qui ne te suivent pas, passé en reel normal par toi depuis Instagram.")] : []),
        ...(typeof r.envoi.message === "string" ? [
          el("dt", {}, `Message à ceux qui commentent ${r.envoi.mot || ""}`.trim()), el("dd", {}, r.envoi.message),
          el("dt", {}, "Bouton"), el("dd", {}, r.envoi.bouton)] : [])) : null;
      return el("li", { class: bon ? "ok" : "ko" }, el("span", { html: icone(bon ? "coche" : "attention") }),
        el("div", {}, el("strong", {}, titre(r.slug)), el("p", {}, r.message || (bon && e ? `Part ${quandLisible(e.quand)}.` : "Pas programmé.")), envoi, brancher));
    })),
    toutDeSuite ? null : el("p", { class: "recap-note" }, "Tu peux fermer ton Mac : tout part à l'heure prévue.")));
}
