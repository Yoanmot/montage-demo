// Les graphiques de la vue d'ensemble (lot 10, tableau de bord du lot 11) : vraies données seulement (les chiffres lus par
// le serveur), jamais un point inventé. Chaque graphique répond à une question écrite dans le titre de sa card ; une
// donnée absente reste visible comme absente. Marques fines (barres de 26 px au plus, bout arrondi de 3 px, droites à la
// base), axes et repères en filets discrets, une seule couleur par graphique (l'accent du client : orange chez Romain,
// ambre de la charte chez Yoan). Chaque valeur est aussi lisible au clavier (focus) et au survol, dans une bulle de texte.
// Les graphiques se redessinent à la largeur de leur cadre (fenêtre réduite, téléphone).

import { el } from "./outils.js";
import { plageSemaine, dateSemaine } from "./tableau.js";

const NS = "http://www.w3.org/2000/svg";
const svgEl = (nom, attrs = {}, ...enfants) => {
  const n = document.createElementNS(NS, nom);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) n.setAttribute(k, String(v));
  for (const e of enfants) if (e) n.append(e);
  return n;
};
export const nombreFr = (n) => (typeof n === "number" && Number.isFinite(n) ? Math.round(n).toLocaleString("fr-CH").replace(/[’']/g, " ") : null);
const compact = (n) => (n >= 10000 ? `${nombreFr(Math.round(n / 1000))} k` : nombreFr(n));

// Un pas « rond » pour l'axe : 1, 2 ou 5 fois une puissance de 10.
function pasRond(max, n = 2) {
  if (!(max > 0)) return 1;
  const brut = max / n; const p = 10 ** Math.floor(Math.log10(brut));
  return [1, 2, 2.5, 5, 10].map((x) => x * p).find((x) => x >= brut) || 10 * p;
}

// Un cadre qui se redessine à sa largeur. dessiner(largeur) rend le contenu (SVG). La bulle est partagée.
function cadreAdaptatif(classe, dessiner) {
  const bulle = el("div", { class: "graph-bulle", role: "status", "aria-live": "polite", hidden: true });
  const zone = el("div", { class: "graph-zone" });
  const cadre = el("div", { class: `graph-cadre ${classe}` }, zone, bulle);
  let derniere = 0;
  const peindre = () => {
    const l = Math.round(zone.clientWidth || 0);
    if (!l || l === derniere) return;
    derniere = l;
    bulle.hidden = true;
    zone.replaceChildren(dessiner(l, bulle));
  };
  // Retiré de la page (la vue est redessinée) : sa taille passe à zéro, on cesse d'observer.
  const obs = new ResizeObserver(() => { if (!zone.isConnected) { obs.disconnect(); return; } peindre(); });
  obs.observe(zone);
  return cadre;
}

// Montre la bulle près d'un point (coordonnées dans la zone), le chiffre d'abord, puis ce qu'il compte.
function montrer(bulle, x, y, largeur, valeur, quoi, detail = null) {
  bulle.replaceChildren(el("strong", {}, valeur), el("span", {}, quoi), detail ? el("span", { class: "graph-bulle-detail" }, detail) : null);
  bulle.hidden = false;
  const l = bulle.offsetWidth || 160;
  bulle.style.left = `${Math.max(0, Math.min(largeur - l, x - l / 2))}px`;
  bulle.style.top = `${Math.max(0, y - bulle.offsetHeight - 12)}px`;
}

function vide(texte) {
  return el("p", { class: "graph-vide" }, texte);
}

// ---------------------------------------------------------------- une card du tableau de bord, semaine par semaine (lot 11)
// barres : [{ debut, fin, en_cours, valeur }] de la plus ancienne à la semaine en cours (tableau.js, resumer).
// Une barre par semaine à l'accent du client (--orange). La semaine en cours, pas finie, est en contour pointillé et
// claire. Zéro : un trait plat à l'accent ; pas de chiffre : un point gris sur la ligne de base (jamais une barre à 0).
// Survol et clavier (un seul arrêt de tabulation par graphique, flèches, Début, Fin) : la bulle dit la semaine et la valeur.
// unite(n) : « 1 240 vues » ; absent : ce que dit la bulle pour une semaine sans chiffre.
export function barresSemaines(barres, { unite = (n) => nombreFr(n), absent = "pas de chiffre", titre = "" } = {}) {
  const bs = barres || [];
  if (!bs.length) return vide("Pas encore de semaine à montrer.");
  return cadreAdaptatif("graph-semaines", (L, bulle) => {
    const H = 112, g = 34, d = 4, haut = 12, bas = 20;
    const vals = bs.map((b) => b.valeur).filter((v) => typeof v === "number");
    const top = Math.max(1, ...vals);
    const pas = pasRond(top, 1);
    const max = Math.ceil(top / pas) * pas;
    const Y = (v) => haut + (1 - v / max) * (H - haut - bas);
    const bande = (L - g - d) / bs.length;
    const larg = Math.max(2, Math.min(26, bande * (bs.length > 20 ? 0.72 : 0.6)));
    const yb = Y(0);
    const annee = new Date().getFullYear();
    const resume = `${titre ? `${titre}, ` : ""}${bs.length} semaines${vals.length ? `, de ${unite(Math.min(...vals))} à ${unite(Math.max(...vals))} par semaine` : ", sans chiffre"}. Flèches pour parcourir les semaines.`;
    const svg = svgEl("svg", { class: "graph", width: L, height: H, viewBox: `0 0 ${L} ${H}` },
      svgEl("line", { class: "graph-grille", x1: g, x2: L - d, y1: Y(max), y2: Y(max) }),
      svgEl("text", { class: "graph-axe", x: g - 6, y: Y(max) + 4, "text-anchor": "end" }, document.createTextNode(compact(max))),
      svgEl("line", { class: "graph-base", x1: g, x2: L - d, y1: yb, y2: yb }),
      svgEl("text", { class: "graph-axe", x: g - 6, y: yb + 4, "text-anchor": "end" }, document.createTextNode("0")),
      svgEl("text", { class: "graph-axe", x: g, y: H - 4 }, document.createTextNode(dateSemaine(bs[0].debut, annee))),
      svgEl("text", { class: "graph-axe", x: L - d, y: H - 4, "text-anchor": "end" }, document.createTextNode(bs[bs.length - 1].en_cours ? "cette semaine" : dateSemaine(bs[bs.length - 1].debut, annee))));
    const formes = bs.map((b, k) => {
      const cx = g + bande * (k + 0.5);
      const x0 = cx - larg / 2, x1 = cx + larg / 2;
      let f;
      if (b.valeur === null) f = svgEl("circle", { class: "sem-absente", cx, cy: yb, r: Math.min(2, larg / 2) });
      else if (b.valeur === 0) f = svgEl("rect", { class: `sem-zero${b.en_cours ? " sem-en-cours" : ""}`, x: x0, y: yb - 2, width: larg, height: 2 });
      else {
        const y = Y(b.valeur); const h = Math.max(2, yb - y); const r = Math.min(3, h, larg / 2); const yt = yb - h;
        f = svgEl("path", { class: `sem-barre${b.en_cours ? " sem-en-cours" : ""}`, d: `M${x0},${yb} V${yt + r} Q${x0},${yt} ${x0 + r},${yt} H${x1 - r} Q${x1},${yt} ${x1},${yt + r} V${yb} Z` });
      }
      svg.append(f);
      return { f, cx, y: b.valeur ? Y(b.valeur) : yb };
    });
    const capte = svgEl("rect", { class: "graph-capte", x: g, y: 0, width: L - g - d, height: H - bas + 4, tabindex: "0", role: "img", "aria-label": resume });
    svg.append(capte);
    let i = bs.length - 1;
    const voir = (k) => {
      formes[i]?.f.classList.remove("actif");
      i = Math.max(0, Math.min(bs.length - 1, k));
      const b = bs[i]; const { f, cx, y } = formes[i];
      f.classList.add("actif");
      montrer(bulle, cx, y, L, b.valeur === null ? absent : unite(b.valeur), "", `${plageSemaine(b.debut, b.fin, annee)}${b.en_cours ? ", semaine en cours, pas finie" : ""}`);
    };
    const cacher = () => { formes[i]?.f.classList.remove("actif"); bulle.hidden = true; };
    capte.addEventListener("pointermove", (e) => {
      const x = e.clientX - svg.getBoundingClientRect().left;
      voir(Math.floor((x - g) / bande));
    });
    capte.addEventListener("pointerleave", cacher);
    capte.addEventListener("focus", () => voir(i));
    capte.addEventListener("blur", cacher);
    capte.addEventListener("keydown", (e) => {
      const pas1 = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
      if (pas1) { e.preventDefault(); voir(i + pas1); }
      else if (e.key === "Home") { e.preventDefault(); voir(0); }
      else if (e.key === "End") { e.preventDefault(); voir(bs.length - 1); }
      else if (e.key === "Escape") cacher();
    });
    return svg;
  });
}

// ---------------------------------------------------------------- les contenus d'un format, étape par étape
// Tous les chiffres sur une ligne, la barre en tirets juste dessous (un tiret par étape, comme la barre de
// l'arborescence), le nom de l'étape sous son tiret. Un tiret plein : il y a au moins un contenu à cette étape.
export function etapesFormat({ format, titre, total, etapes }) {
  const cases = etapes.map((e) => el("div", { class: `etp${e.n ? "" : " zero"}`, role: "listitem" },
    el("strong", { class: "etp-n" }, String(e.n)),
    el("i", { class: "etp-tiret", "aria-hidden": "true" }),
    el("span", { class: "etp-nom" }, e.nom)));
  return el("section", { class: `etapes f-${format}`, "aria-label": `${titre} : ${total} en tout` },
    el("h4", { class: "etapes-titre" }, el("span", { class: `pastille pastille-${format}`, "aria-hidden": "true" }), titre,
      el("span", { class: "etapes-total" }, `${total} en tout`)),
    el("div", { class: "etapes-ligne", role: "list", style: `--n:${etapes.length}` }, ...cases));
}
