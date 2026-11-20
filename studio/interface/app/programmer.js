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
// Lot 10 : c'est la « préparation » de « Poster ». Elle se vérifie sans date (comme « tout de suite ») ;
// le quand de chaque post (jour et heure, ou tout de suite) se choisit APRÈS, en bas de chaque post, sans revérifier :
// le serveur refait au clic les contrôles de date (lisible, au moins 10 minutes plus tard) avant tout envoi, et la page
// les montre avant (bouton éteint, raison sous le champ). Le clic envoie le quand choisi (confirmer, « quands »).

// Lot 13 (TikTok) : pour chaque contenu, deux cases, Instagram et TikTok, jamais cochées d'office ; un bloc par
// plateforme cochée (TikTok : sa légende avec son compteur, ses réglages, « visible par tout le monde ») ; TikTok
// grisé avec sa raison s'il n'est pas relié ; la ressource gratuite grisée sans Instagram ; bouton inactif tant
// qu'un contenu n'a pas de case ; en bas, où part chaque contenu et la phrase d'accord de TikTok (le clic la vaut).

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
// Le quand choisi pour chaque post (conteneur -> Map slug -> "maintenant" | "AAAA-MM-JJ HH:MM"), gardé aux revérifications.
const quandsDe = new WeakMap();

// opts.quands : Map slug -> quand proposé au départ ; opts.fermer : refermer la préparation sans rien envoyer.
export async function recapDans(studio, conteneur, chercher, { apres, quands, fermer } = {}) {
  if (quands) quandsDe.set(conteneur, new Map(quands));
  conteneur.replaceChildren(el("p", { class: "recap-charge" }, el("span", { class: "points", "aria-hidden": "true" }, el("i"), el("i"), el("i")), "Je prépare chaque publication"));
  let recap;
  try { recap = await chercher(); }
  catch (e) {
    conteneur.replaceChildren(el("div", { class: "recap-erreur-bloc" }, el("p", { class: "recap-erreur" }, e.message), boutonFermer(fermer)));
    return;
  }
  dessiner(studio, conteneur, recap, apres, chercher, fermer);
}

function boutonFermer(fermer) {
  if (!fermer) return null;
  const b = el("button", { class: "bouton bouton-discret", type: "button" }, "Fermer sans poster");
  b.addEventListener("click", () => fermer());
  return b;
}

// Au moins 10 minutes plus tard (même règle que le serveur) : sinon la raison, sous le champ.
function erreurQuand(q) {
  if (q === "maintenant") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(q || "");
  if (!m) return "Choisis un jour et une heure.";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(Date.now() + 10 * 60 * 1000)).reduce((o, x) => ({ ...o, [x.type]: x.value }), {});
  const limite = `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
  return q < limite ? "Cette heure est déjà passée, ou dans moins de 10 minutes : choisis plus tard." : null;
}

// Lot 13 : où part chaque contenu (Instagram, TikTok), coché par le client à chaque préparation. Rien n'est coché
// d'office, jamais, pas même le dernier choix : une nouvelle préparation repart de zéro. Une revérification de la
// même préparation (date, ressource changées) garde ce qui vient d'être coché. (conteneur -> Map slug -> choix)
const choixDe = new WeakMap();
const NOMS = { instagram: "Instagram", tiktok: "TikTok" };
const ou = (plats) => (plats.length > 1 ? `${plats.slice(0, -1).map((p) => NOMS[p]).join(", ")} et ${NOMS[plats[plats.length - 1]]}` : NOMS[plats[0]]);
// La phrase de TikTok : il exige, sur chaque post, que tu aies relu le post et que tu acceptes sa publication.
export const PHRASE_ACCORD_TIKTOK = "En cliquant, tu confirmes avoir relu ce post et tu acceptes qu'il parte sur ton TikTok, visible par tout le monde, en suivant les règles de TikTok (dont celles sur la musique).";
// Le champ d'une erreur -> la plateforme qu'il concerne (le reste vaut pour toutes).
const CHAMP_PLATEFORME = { legende: "instagram", message: "instagram", bouton: "instagram", legende_tiktok: "tiktok" };

function dessiner(studio, conteneur, recap, apres, chercher, fermer) {
  const els = recap.elements || [];
  if (!els.length) {
    conteneur.replaceChildren(el("p", { class: "vide-doux" }, "Rien à poster ici : aucun contenu monté ou mis en page qui attend. Ce qui est déjà programmé ne bouge pas."));
    return;
  }
  if (!quandsDe.has(conteneur)) quandsDe.set(conteneur, new Map());
  const quands = quandsDe.get(conteneur);
  for (const e of els) if (!quands.has(e.slug)) quands.set(e.slug, e.quand && e.quand !== "maintenant" ? e.quand : "maintenant");
  if (!choixDe.has(conteneur)) choixDe.set(conteneur, new Map());
  const choix = choixDe.get(conteneur);
  for (const e of els) {
    const it = e.plateformes?.tiktok?.interactions || {};
    const c = choix.get(e.slug) || { instagram: false, tiktok: false,
      reglages: { commentaires: it.commentaires !== false, duo: it.duo === null ? null : it.duo !== false, collage: it.collage === null ? null : it.collage !== false } };
    if (!e.plateformes?.tiktok?.possible) c.tiktok = false;
    choix.set(e.slug, c);
  }
  const plats = (e) => ["instagram", "tiktok"].filter((p) => choix.get(e.slug)?.[p]);
  const modifs = new Map();
  const choixRessource = new Map(); // slug -> slug de ressource choisi (ou "" pour aucune), s'il a changé
  const choixEssai = new Map(); // slug -> "MANUAL" | "SS_PERFORMANCE" | null, s'il a changé
  const retires = new Set();
  if (!retouchesDe.has(conteneur)) retouchesDe.set(conteneur, new Map());
  const retouches = retouchesDe.get(conteneur); // slug -> { legende?, legende_tiktok?, message?, bouton?, ressource? }
  const erreurs = new Map(); // "slug:champ" -> phrase
  const verdicts = new Map(); // slug -> () => "ok" | "attention" | "bloque" | null (rien de coché)
  const ctx = { recap, retouches, erreurs, quands, choix, verdicts, limites: recap.limites || { legende: 2200, message: 640, bouton: 20 }, pret: false, maj: () => { if (ctx.pret) majPied(); } };
  const lignes = els.map((e) => ligne(e, modifs, retires, () => majPied(), recap.ressources, choixRessource, ctx, choixEssai));
  const resume = el("p", { class: "recap-resume" });
  const ouListe = el("ul", { class: "rp-ou", "aria-label": "Où part chaque contenu" });
  const accord = el("p", { class: "rp-accord", hidden: true }, PHRASE_ACCORD_TIKTOK);
  const confirmer = el("button", { class: "bouton bouton-accent bouton-grand", type: "button" });
  const maj = el("button", { class: "bouton", type: "button", hidden: true, html: `${icone("synchro")}<span>Revérifier avec les changements</span>` });

  function majPied() {
    const restants = els.filter((e) => !retires.has(e.slug));
    const change = modifs.size > 0 || retires.size > 0 || choixRessource.size > 0 || choixEssai.size > 0;
    const sansChoix = restants.filter((e) => !plats(e).length);
    const bloque = restants.some((e) => verdicts.get(e.slug)?.() === "bloque");
    const faux = [...erreurs.keys()].some((k) => restants.some((e) => {
      if (!k.startsWith(e.slug + ":")) return false;
      const p = CHAMP_PLATEFORME[k.slice(e.slug.length + 1)];
      return !p || plats(e).includes(p);
    }));
    const tout = restants.length > 0 && restants.every((e) => quands.get(e.slug) === "maintenant");
    const aucun = restants.every((e) => quands.get(e.slug) !== "maintenant");
    maj.hidden = !change;
    confirmer.hidden = change;
    confirmer.disabled = bloque || faux || !restants.length || sansChoix.length > 0;
    const n = restants.length;
    confirmer.innerHTML = `${icone("envoi")}<span>${tout ? (n > 1 ? `Poster les ${n} maintenant` : "Poster maintenant")
      : aucun ? (n > 1 ? `Programmer les ${n}` : "Programmer") : `Poster et programmer les ${n}`}</span>`;
    resume.textContent = change ? "Tu as changé quelque chose : je revérifie avant que tu confirmes."
      : sansChoix.length ? (n > 1 ? "Coche où part chaque contenu : Instagram, TikTok, ou les deux. Rien n'est coché d'office." : "Coche où il part : Instagram, TikTok, ou les deux. Rien n'est coché d'office.")
      : bloque ? "Une publication ne peut pas partir. Décoche l'endroit qui bloque, retire-la, ou corrige ce qui est dit, puis revérifie."
      : faux ? "Un point est à corriger (la raison est sous le champ) avant de poster."
      : `${pluriel(n, "publication", "publications")}. Rien ne part tant que tu n'as pas cliqué.`;
    // Le récapitulatif dit clairement où chaque contenu part.
    ouListe.replaceChildren(...restants.map((e) => el("li", {}, el("strong", {}, e.titre), " : ",
      plats(e).length ? el("span", {}, `${ou(plats(e))}, ${quands.get(e.slug) === "maintenant" ? "tout de suite" : quandLisible(quands.get(e.slug))}`)
        : el("span", { class: "rp-ou-vide" }, "pas encore choisi"))));
    ouListe.hidden = !restants.length;
    accord.hidden = !restants.some((e) => plats(e).includes("tiktok"));
  }

  maj.addEventListener("click", () => {
    const elements = els.filter((e) => !retires.has(e.slug)).map((e) => {
      const r = choixRessource.has(e.slug) ? choixRessource.get(e.slug) : e.ressource;
      const essai = choixEssai.has(e.slug) ? choixEssai.get(e.slug) : e.reel_essai?.choix || null;
      return { slug: e.slug, quand: modifs.get(e.slug) || e.quand, ...(r ? { ressource: r } : {}), ...(essai ? { essai } : {}) };
    });
    if (!elements.length) { conteneur.replaceChildren(); fermer?.(); return; }
    recapDans(studio, conteneur, () => (chercher.length ? chercher(elements) : studio.api.recap(elements)), { apres, fermer });
  });

  confirmer.addEventListener("click", async () => {
    confirmer.disabled = true;
    const restants = els.filter((e) => !retires.has(e.slug));
    confirmer.innerHTML = `<span>${restants.every((e) => quands.get(e.slug) === "maintenant") ? "Je poste" : "Je programme"}</span>`;
    try {
      const textes = {};
      const plateformes = {};
      const tiktok = {};
      for (const e of restants) {
        const p = plats(e);
        plateformes[e.slug] = p;
        // Le clic vaut l'accord demandé par TikTok, pour les contenus où TikTok est coché, et seulement eux.
        if (p.includes("tiktok")) tiktok[e.slug] = { ...choix.get(e.slug).reglages, consentement: true };
        const t = retouches.get(e.slug);
        if (!t) continue;
        const o = {};
        if (p.includes("instagram") && typeof t.legende === "string" && e.legende_modifiable) o.legende = t.legende;
        if (p.includes("tiktok") && typeof t.legende_tiktok === "string" && e.plateformes?.tiktok?.legende_modifiable) o.legende_tiktok = t.legende_tiktok;
        if (p.includes("instagram") && e.message_dm && t.ressource === e.ressource) {
          if (typeof t.message === "string") o.message = t.message;
          if (typeof t.bouton === "string") o.bouton = t.bouton;
        }
        if (Object.keys(o).length) textes[e.slug] = o;
      }
      const choisis = {};
      for (const e of restants) choisis[e.slug] = quands.get(e.slug);
      const r = await studio.api.confirmer(recap.recap_id, textes, choisis, plateformes, tiktok);
      retouchesDe.delete(conteneur); quandsDe.delete(conteneur); choixDe.delete(conteneur);
      resultats(studio, conteneur, r.resultats || [], els.map((e) => ({ ...e, quand: choisis[e.slug] || e.quand })), fermer);
      apres?.();
    } catch (e) { annoncer(e.message, "erreur"); majPied(); }
  });

  conteneur.replaceChildren(el("div", { class: "recap" },
    el("h2", { class: "recap-titre" }, els.length > 1 ? `Préparer ${els.length} contenus à poster` : "Préparer à poster"),
    ...lignes,
    el("div", { class: "recap-pied" }, el("div", { class: "rp-pied-texte" }, resume, ouListe, accord), el("div", { class: "recap-boutons" }, boutonFermer(fermer), maj, confirmer))));
  ctx.pret = true;
  majPied();
}

function ligne(e, modifs, retires, auChangement, ressources, choixRessource, ctx, choixEssai) {
  void modifs;
  const c = ctx.choix.get(e.slug);
  const tk = e.plateformes?.tiktok || { possible: false, raison: "Ton TikTok n'est pas encore relié." };
  const retirer = el("button", { class: "bouton bouton-discret bouton-petit", type: "button" }, "Retirer");
  const n = el("article", { class: "recap-ligne" });
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
  const messagesTiktok = el("ul", { class: "recap-messages" });
  const verdict = el("span", { class: "verdict" });
  let legendeIg = e.legende;
  const verdictIg = () => {
    const manque = Boolean(absent) && motAbsent(legendeIg, absent.mot);
    return VERDICTS[absent ? (manque && absent.verdict_sinon === "OK" ? "ATTENTION" : absent.verdict_sinon) : e.verdict] || VERDICTS.ATTENTION;
  };
  const verdictTk = () => VERDICTS[tk.verdict] || VERDICTS.ATTENTION;
  // Le verdict du contenu : le pire des endroits cochés ; rien de coché, rien à dire encore.
  const rang = { ok: 0, attention: 1, bloque: 2 };
  const verdictTout = () => {
    const vs = [c.instagram ? verdictIg() : null, c.tiktok ? verdictTk() : null].filter(Boolean);
    return vs.length ? vs.sort((a, b) => rang[b.cls] - rang[a.cls])[0] : null;
  };
  ctx.verdicts.set(e.slug, () => verdictTout()?.cls || null);
  const blocIg = el("div", { class: "rp-bloc rp-bloc-instagram" });
  const blocTk = el("div", { class: "rp-bloc rp-bloc-tiktok" });
  const majMot = (legende) => {
    if (legende !== undefined) legendeIg = legende;
    const manque = Boolean(absent) && motAbsent(legendeIg, absent.mot);
    messages.replaceChildren(...base.map((m) => el("li", {}, m)), ...(manque ? [el("li", { class: "recap-mot-absent" }, absent.message)] : []));
    messages.hidden = !messages.children.length || !c.instagram;
    messagesTiktok.replaceChildren(...(tk.messages || []).map((m) => el("li", {}, m)));
    messagesTiktok.hidden = !messagesTiktok.children.length;
    const x = verdictTout();
    verdict.className = `verdict verdict-${x ? x.cls : "neutre"}`;
    verdict.replaceChildren(...(x ? [el("span", { html: icone(x.cls === "ok" ? "coche" : "attention") }), x.texte] : ["Où part-il ?"]));
    for (const k of ["ok", "attention", "bloque"]) n.classList.toggle(`v-${k}`, Boolean(x) && k === x.cls);
    blocIg.hidden = !c.instagram;
    blocTk.hidden = !c.tiktok;
    // Une zone de texte dessinée cachée n'a pas de hauteur : elle reprend celle de son texte quand son bloc s'ouvre.
    requestAnimationFrame(() => {
      for (const z of n.querySelectorAll("textarea.recap-texte")) {
        if (!z.offsetParent) continue;
        z.style.height = "auto"; z.style.height = `${Math.min(z.scrollHeight + 2, 460)}px`;
      }
    });
  };

  // Les deux cases, décochées tant que tu n'as pas choisi. TikTok grisé, avec sa raison, s'il n'est pas relié.
  const caseIg = el("input", { type: "checkbox", id: `rp-ig-${e.slug}`, checked: c.instagram || null });
  const caseTk = el("input", { type: "checkbox", id: `rp-tk-${e.slug}`, checked: c.tiktok || null, disabled: tk.possible ? null : true,
    "aria-describedby": tk.possible ? null : `rp-tk-raison-${e.slug}` });
  const plateformes = el("fieldset", { class: "rp-plateformes" },
    el("legend", { class: "visuel-cache" }, `Où part « ${e.titre} »`),
    el("label", { class: "rp-case", for: caseIg.id }, caseIg, el("span", {}, "Instagram")),
    el("label", { class: `rp-case${tk.possible ? "" : " rp-case-grisee"}`, for: caseTk.id }, caseTk, el("span", {}, "TikTok")),
    tk.possible ? null : el("p", { class: "rp-raison doux", id: `rp-tk-raison-${e.slug}` }, tk.raison));

  const legende = e.legende_modifiable ? champLegende(e, ctx, majMot) : el("p", { class: "recap-legende" }, e.legende || "Pas de légende.");
  let ressource = [];
  const ressourceNote = el("p", { class: "rp-raison doux" }, "Le mot en commentaire passe par Instagram : coche Instagram pour offrir une ressource.");
  if (Array.isArray(ressources)) {
    ressource = champRessource(e, ressources, choixRessource, auChangement, ctx);
    ressource[1].prepend(ressourceNote);
  }
  const majRessource = () => {
    if (!ressource.length) return;
    ressourceNote.hidden = c.instagram;
    for (const x of ressource[1].querySelectorAll("select, textarea, input")) x.disabled = !c.instagram;
    ressource[1].classList.toggle("rp-grise", !c.instagram);
  };
  blocIg.append(el("p", { class: "rp-bloc-titre" }, "Instagram"), messages,
    el("dl", { class: "recap-champs" },
      el("dt", {}, "Légende"), el("dd", {}, legende),
      ...(e.reel_essai ? champEssai(e, choixEssai, auChangement) : []),
      ...(Array.isArray(ressources) ? [] : [el("dt", {}, "Mot en commentaire"), el("dd", {}, e.mot ? el("strong", { class: "mot-com" }, e.mot) : el("span", { class: "doux" }, "Aucun : pas de message automatique"))])));
  if (tk.possible) blocTk.append(el("p", { class: "rp-bloc-titre" }, `TikTok${tk.nom ? ` (@${tk.nom})` : ""}`), messagesTiktok, champsTiktok(e, tk, c, ctx));

  for (const [k, x] of [["instagram", caseIg], ["tiktok", caseTk]]) {
    x.addEventListener("change", () => { c[k] = x.checked; majMot(); majRessource(); ctx.maj(); });
  }
  majMot(e.legende);
  majRessource();
  n.append(
    media ? el("div", { class: "recap-media" }, media) : null,
    el("div", { class: "recap-infos" },
      el("div", { class: "recap-ligne-tete" },
        el("h4", {}, e.titre),
        verdict),
      el("dl", { class: "recap-champs" }, el("dt", {}, "Où il part"), el("dd", {}, plateformes)),
      blocIg, blocTk,
      ressource.length ? el("dl", { class: "recap-champs" }, ...ressource) : null,
      el("dl", { class: "recap-champs" },
        // Après la préparation : quand ce post part.
        el("dt", {}, "Quand"), el("dd", {}, champQuand(e, ctx))),
      el("div", { class: "recap-ligne-pied" }, retirer)));
  return n;
}

// TikTok : sa légende (la variante du brief, sinon celle d'Instagram) avec son compteur, ses réglages (ouverts par
// défaut, fermés seulement si tu les as fermés dans ton appli TikTok) et sa visibilité.
let numeroTiktok = 0;
function champsTiktok(e, tk, c, ctx) {
  const id = `rp-tiktok-${++numeroTiktok}`;
  const max = tk.limite || 2200;
  const compteur = el("p", { class: "rp-compteur doux", "aria-live": "polite" });
  const majCompteur = (v) => {
    const nb = Array.from(String(v ?? "").trim()).length;
    compteur.textContent = `${nb} / ${max} caractères`;
    compteur.classList.toggle("rp-compteur-trop", nb > max);
  };
  const source = { variante: "Ta légende pour TikTok, écrite à part.", instagram: "Ta légende Instagram, reprise telle quelle.",
    coupee: `Ta légende Instagram, coupée à ${max} caractères pour TikTok.` }[tk.legende_source] || null;
  let legende;
  if (tk.legende_modifiable) {
    const t = champTexte(e, ctx, "legende_tiktok", tk.legende, { label: `Légende TikTok de « ${e.titre} »`, aChaqueFrappe: majCompteur, limite: max });
    legende = el("div", { class: "recap-texte-bloc" }, t.champ, compteur, t.erreur);
  } else {
    majCompteur(tk.legende);
    legende = el("div", { class: "recap-texte-bloc" }, el("p", { class: "recap-legende" }, tk.legende || "Pas de légende."), compteur,
      el("p", { class: "doux rp-note" }, "La légende d'un carrousel se retouche dans son brief."));
  }
  const reglage = (cle, texte) => {
    if (c.reglages[cle] === null) return null;
    const ferme = tk.interactions?.[cle] === false;
    const x = el("input", { type: "checkbox", id: `${id}-${cle}`, checked: c.reglages[cle] && !ferme ? true : null, disabled: ferme ? true : null });
    x.addEventListener("change", () => { c.reglages[cle] = x.checked; });
    return el("label", { class: `rp-case${ferme ? " rp-case-grisee" : ""}`, for: x.id }, x, el("span", {}, texte),
      ferme ? el("span", { class: "doux rp-note" }, " (fermé dans ton appli TikTok)") : null);
  };
  return el("dl", { class: "recap-champs" },
    el("dt", {}, "Légende TikTok"), el("dd", {}, source ? el("p", { class: "doux rp-note" }, source) : null, legende),
    el("dt", {}, "Les gens peuvent"), el("dd", { class: "rp-reglages" },
      reglage("commentaires", "commenter"),
      reglage("duo", "faire un duo avec ta vidéo"),
      reglage("collage", "reprendre un passage de ta vidéo (collage)")),
    el("dt", {}, "Visible par"), el("dd", {}, "Tout le monde"));
}

// Tout de suite, ou un jour et une heure (proposés d'avance). Changer le quand ne revérifie rien : seule la date est
// contrôlée, ici et par le serveur au clic.
let numeroQuand = 0;
function champQuand(e, ctx) {
  const id = `quand-${++numeroQuand}`;
  const depart = ctx.quands.get(e.slug) || "maintenant";
  const [j0, h0] = depart === "maintenant" ? propose(e) : depart.split(" ");
  const plusTard = el("input", { type: "radio", name: id, value: "date", checked: depart !== "maintenant" || null, id: `${id}-date` });
  const toutDeSuite = el("input", { type: "radio", name: id, value: "maintenant", checked: depart === "maintenant" || null, id: `${id}-maintenant` });
  const date = el("input", { type: "date", class: "champ champ-date", value: j0, "aria-label": `Jour de « ${e.titre} »` });
  const heure = el("input", { type: "time", class: "champ champ-heure", value: h0, step: "300", "aria-label": `Heure de « ${e.titre} »` });
  const erreur = el("p", { class: "recap-champ-erreur", role: "alert", hidden: true });
  const cle = `${e.slug}:quand`;
  const maj = () => {
    const q = toutDeSuite.checked ? "maintenant" : `${date.value} ${heure.value}`;
    ctx.quands.set(e.slug, q);
    for (const x of [date, heure]) x.classList.toggle("en-retrait", toutDeSuite.checked);
    const x = erreurQuand(q);
    erreur.textContent = x || ""; erreur.hidden = !x;
    if (x) ctx.erreurs.set(cle, x); else ctx.erreurs.delete(cle);
    ctx.maj();
  };
  for (const n of [plusTard, toutDeSuite]) n.addEventListener("change", maj);
  for (const n of [date, heure]) {
    n.addEventListener("change", maj);
    n.addEventListener("focus", () => { if (!plusTard.checked) { plusTard.checked = true; maj(); } });
  }
  maj();
  return el("fieldset", { class: "recap-quand-choix" },
    el("legend", { class: "visuel-cache" }, `Quand « ${e.titre} » part`),
    el("div", { class: "recap-quand-option" }, el("label", { for: `${id}-date` }, plusTard, el("span", {}, "Programmer le")), el("span", { class: "quand-champs" }, date, el("span", { class: "doux" }, "à"), heure)),
    el("label", { class: "recap-quand-option", for: `${id}-maintenant` }, toutDeSuite, el("span", {}, "Tout de suite, dès que tu confirmes")),
    erreur);
}

// Le jour et l'heure proposés quand on passe de « tout de suite » à « programmer » : demain, à l'heure habituelle.
function propose(e) {
  const d = new Date(Date.now() + 864e5);
  const j = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return [j, e.type === "carrousel" ? "12:15" : "18:30"];
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
  const nom = { legende: "La légende", legende_tiktok: "La légende pour TikTok", message: "Le message", bouton: "Le texte du bouton" }[champ];
  if (champ === "legende_tiktok") {
    if (!v) return `${nom} ne peut pas être vide.`;
    if (v.includes(TIRET_LONG)) return `${nom} contient un tiret long : remplace-le par une virgule ou deux points.`;
    const n = Array.from(v).length;
    return n > limites.legende_tiktok ? `La légende est trop longue pour TikTok (${n} caractères, ${limites.legende_tiktok} au plus).` : null;
  }
  if (!v) return champ === "bouton" ? "Le bouton a besoin d'un texte." : `${nom} ne peut pas être vide.`;
  if (v.includes(TIRET_LONG)) return `${nom} contient un tiret long : remplace-le par une virgule ou deux points.`;
  const n = champ === "legende" ? Array.from(v).length : champ === "message" ? v.replace(/\[\s*son\s+pr[ée]nom\s*\]/gi, "{{first_name}}").length : v.length;
  if (n > limites[champ]) return champ === "legende" ? `La légende est trop longue pour Instagram (${n} caractères, ${limites[champ]} au plus).`
    : `${nom} est trop long (${n} caractères, ${limites[champ]} au plus).`;
  return null;
}

// Un champ retouchable : la valeur affichée est celle qui partira ; l'erreur s'écrit dessous et bloque le bouton.
function champTexte(e, ctx, champ, initiale, { multi = true, label, ressource, aChaqueFrappe, limite } = {}) {
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
    const x = erreurTexte(champ, n.value, limite ? { ...ctx.limites, [champ]: limite } : ctx.limites);
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
        ? "Ce message n'est pas encore validé : en cliquant pour poster (Programmer ou Publier maintenant), tu le valides tel qu'il est ici."
        : "Tu peux le retoucher ici : il est enregistré tel qu'il est affiché quand tu cliques pour poster."),
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

// Un bouton qui fait une action une fois, au clic, puis se remplace par la phrase du résultat.
function boutonUneFois(texte, enCours, action) {
  const b = el("button", { class: "bouton bouton-petit", type: "button" }, texte);
  b.addEventListener("click", async () => {
    b.disabled = true; b.textContent = enCours;
    try { const x = await action(); b.replaceWith(el("p", {}, x.message)); }
    catch (err) { annoncer(err.message, "erreur"); b.disabled = false; b.textContent = texte; }
  });
  return b;
}

// Les liens d'un post, un par plateforme (lot 13).
export function liensPlateformes(plateformes) {
  const avec = (plateformes || []).filter((x) => x.lien);
  if (!avec.length) return null;
  return el("div", { class: "rp-liens" }, ...avec.map((x) => el("a", { class: "bouton bouton-petit", href: x.lien, target: "_blank", rel: "noopener",
    html: `${icone("lien")}<span>Voir sur ${NOMS[x.plateforme] || x.plateforme}</span>` })));
}

function resultats(studio, conteneur, res, els, fermer) {
  const titre = (s) => els.find((e) => e.slug === s)?.titre || "Un contenu";
  const toutDeSuite = els.every((e) => e.quand === "maintenant");
  conteneur.replaceChildren(el("div", { class: "recap" },
    el("ul", { class: "recap-resultats" }, ...res.map((r) => {
      const bon = /programm|publi|simulation/i.test(r.statut || "");
      const e = els.find((x) => x.slug === r.slug);
      // Le post est parti, pas la règle du mot : un bouton pour la brancher, une fois.
      const brancher = r.poser_mot ? boutonUneFois("Brancher le mot", "Je branche le mot", () => studio.api.poserMot(r.poser_mot.slug, r.poser_mot.ressource)) : null;
      // Une plateforme a refusé, l'autre est partie : renvoyer seulement celle-là, au clic.
      const reessayer = r.reessayer ? boutonUneFois(`Réessayer sur ${NOMS[r.reessayer.plateforme]}`, `Je renvoie sur ${NOMS[r.reessayer.plateforme]}`,
        () => studio.api.reessayer(r.reessayer.slug, r.reessayer.plateforme)) : null;
      // Simulation : les textes exacts qui partiraient (lus dans les requêtes préparées, retouches comprises).
      const v = r.envoi;
      const envoi = v ? el("dl", { class: "recap-envoi" },
        ...(v.plateformes?.length ? [el("dt", {}, "Où ça partirait"), el("dd", {}, ou(v.plateformes))] : []),
        ...(typeof v.legende === "string" ? [el("dt", {}, "Légende Instagram qui partirait"), el("dd", {}, v.legende)] : []),
        ...(typeof v.legende_tiktok === "string" ? [el("dt", {}, "Légende TikTok qui partirait"), el("dd", {}, v.legende_tiktok)] : []),
        ...(v.tiktok ? [el("dt", {}, "Sur TikTok"), el("dd", {}, [
          v.tiktok.public ? "visible par tout le monde" : null,
          v.tiktok.commentaires ? "commentaires ouverts" : "commentaires fermés",
          v.tiktok.duo === undefined ? null : v.tiktok.duo ? "duos ouverts" : "duos fermés",
          v.tiktok.collage === undefined ? null : v.tiktok.collage ? "collages ouverts" : "collages fermés",
          v.tiktok.consentement ? "ton accord donné par ton clic" : null].filter(Boolean).join(", "))] : []),
        ...(v.reel_essai ? [el("dt", {}, "Reel d'essai"), el("dd", {}, v.reel_essai === "SS_PERFORMANCE"
          ? "Oui : montré seulement aux gens qui ne te suivent pas, passé en reel normal tout seul s'il marche."
          : "Oui : montré seulement aux gens qui ne te suivent pas, passé en reel normal par toi depuis Instagram.")] : []),
        ...(typeof v.message === "string" ? [
          el("dt", {}, `Message à ceux qui commentent ${v.mot || ""}`.trim()), el("dd", {}, v.message),
          el("dt", {}, "Bouton"), el("dd", {}, v.bouton)] : [])) : null;
      const partiel = r.statut === "partiel";
      return el("li", { class: partiel ? "partiel" : bon ? "ok" : "ko" }, el("span", { html: icone(bon && !partiel ? "coche" : "attention") }),
        el("div", {}, el("strong", {}, titre(r.slug)), el("p", {}, r.message || (bon && e ? `Part ${quandLisible(e.quand)}.` : "Pas programmé.")),
          envoi, liensPlateformes(r.plateformes), reessayer, brancher));
    })),
    toutDeSuite ? null : el("p", { class: "recap-note" }, "Tu peux fermer ton Mac : tout part à l'heure prévue."),
    fermer ? el("div", { class: "recap-boutons" }, (() => { const b = el("button", { class: "bouton", type: "button" }, "Revenir aux contenus prêts"); b.addEventListener("click", () => fermer()); return b; })()) : null));
}
