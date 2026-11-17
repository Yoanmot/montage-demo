// Le récapitulatif avant programmation, dans la page (lot 9 : plus de fenêtre par-dessus).
// Rien ne part sans le clic sur « Programmer » ; un changement de date ou un retrait se revérifie.

import { el, icone, annoncer, quandLisible, pluriel } from "./outils.js";

const VERDICTS = {
  OK: { cls: "ok", texte: "Prêt à partir" },
  ATTENTION: { cls: "attention", texte: "À regarder" },
  BLOQUE: { cls: "bloque", texte: "Ne peut pas partir" },
};

// conteneur : où dessiner ; chercher() : la promesse du récapitulatif (recap ou semaine du serveur).
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
  const retires = new Set();
  const lignes = els.map((e) => ligne(e, modifs, retires, () => majPied()));
  const resume = el("p", { class: "recap-resume" });
  const confirmer = el("button", { class: "bouton bouton-accent bouton-grand", type: "button" });
  const maj = el("button", { class: "bouton", type: "button", hidden: true, html: `${icone("synchro")}<span>Revérifier avec les changements</span>` });

  function majPied() {
    const restants = els.filter((e) => !retires.has(e.slug));
    const change = modifs.size > 0 || retires.size > 0;
    const bloque = restants.some((e) => e.verdict === "BLOQUE");
    maj.hidden = !change;
    confirmer.hidden = change;
    confirmer.disabled = bloque || !restants.length;
    confirmer.innerHTML = `${icone("envoi")}<span>${restants.length > 1 ? `Programmer les ${restants.length}` : "Programmer"}</span>`;
    resume.textContent = change ? "Tu as changé quelque chose : je revérifie avant que tu confirmes."
      : bloque ? "Une publication ne peut pas partir. Change sa date ou retire-la, puis revérifie."
      : `${pluriel(restants.length, "publication", "publications")}. Rien ne part tant que tu n'as pas cliqué.`;
  }

  maj.addEventListener("click", () => {
    const elements = els.filter((e) => !retires.has(e.slug)).map((e) => ({ slug: e.slug, quand: modifs.get(e.slug) || e.quand }));
    if (!elements.length) { conteneur.replaceChildren(); return; }
    recapDans(studio, conteneur, () => studio.api.recap(elements), { apres });
  });

  confirmer.addEventListener("click", async () => {
    confirmer.disabled = true;
    confirmer.innerHTML = "<span>Je programme</span>";
    try {
      const r = await studio.api.confirmer(recap.recap_id);
      resultats(conteneur, r.resultats || [], els);
      apres?.();
    } catch (e) { annoncer(e.message, "erreur"); majPied(); }
  });

  conteneur.replaceChildren(el("div", { class: "recap" }, ...lignes,
    el("div", { class: "recap-pied" }, resume, el("div", { class: "recap-boutons" }, maj, confirmer))));
  majPied();
}

function ligne(e, modifs, retires, auChangement) {
  const v = VERDICTS[e.verdict] || VERDICTS.ATTENTION;
  const [j, h] = (e.quand || " ").split(" ");
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
  n.append(
    media ? el("div", { class: "recap-media" }, media) : null,
    el("div", { class: "recap-infos" },
      el("div", { class: "recap-ligne-tete" },
        el("h4", {}, e.titre),
        el("span", { class: `verdict verdict-${v.cls}` }, el("span", { html: icone(v.cls === "ok" ? "coche" : "attention") }), v.texte)),
      e.messages?.length ? el("ul", { class: "recap-messages" }, ...e.messages.map((m) => el("li", {}, m))) : null,
      el("dl", { class: "recap-champs" },
        el("dt", {}, "Quand"), el("dd", { class: "recap-quand" }, el("span", { class: "quand-texte" }, quandLisible(e.quand)), el("span", { class: "quand-champs" }, date, heure)),
        el("dt", {}, "Légende"), el("dd", {}, el("p", { class: "recap-legende" }, e.legende || "Pas de légende.")),
        el("dt", {}, "Mot en commentaire"), el("dd", {}, e.mot ? el("strong", { class: "mot-com" }, e.mot) : el("span", { class: "doux" }, "Aucun : pas de message automatique"))),
      el("div", { class: "recap-ligne-pied" }, retirer)));
  return n;
}

function resultats(conteneur, res, els) {
  const titre = (s) => els.find((e) => e.slug === s)?.titre || "Un contenu";
  conteneur.replaceChildren(el("div", { class: "recap" },
    el("ul", { class: "recap-resultats" }, ...res.map((r) => {
      const bon = /programm|publi|simulation/i.test(r.statut || "");
      const e = els.find((x) => x.slug === r.slug);
      return el("li", { class: bon ? "ok" : "ko" }, el("span", { html: icone(bon ? "coche" : "attention") }),
        el("div", {}, el("strong", {}, titre(r.slug)), el("p", {}, r.message || (bon && e ? `Part ${quandLisible(e.quand)}.` : "Pas programmé."))));
    })),
    el("p", { class: "recap-note" }, "Tu peux fermer ton Mac : tout part à l'heure prévue.")));
}
