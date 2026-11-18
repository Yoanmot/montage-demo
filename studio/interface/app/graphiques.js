// Les graphiques de la vue d'ensemble (lot 10) : vraies données seulement (les chiffres lus par le serveur), jamais un
// point inventé. Chaque graphique répond à une question écrite dans son titre ; une donnée absente donne un état vide
// qui dit pourquoi. Marques fines (traits de 2 px, colonnes de 24 px au plus, bout arrondi de 4 px, droites à la base),
// axes et repères en filets discrets, une seule couleur par graphique (l'encre du thème) : la forme se lit sans
// légende de couleurs. Chaque valeur est aussi lisible au clavier (focus) et au survol, dans une bulle de texte.
// Les graphiques se redessinent à la largeur de leur cadre (fenêtre réduite, téléphone).

import { el, dateCourte } from "./outils.js";

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

// ---------------------------------------------------------------- abonnés, jour par jour
// historique : [{ jour: "AAAA-MM-JJ", abonnes }] (un relevé par jour, écrit par le serveur).
export function courbeAbonnes(historique) {
  const h = (historique || []).filter((x) => typeof x.abonnes === "number").slice(-90);
  if (h.length < 2) {
    // dateCourte finit déjà par un point (« 18 nov. ») : pas de second point.
    const d = h.length ? dateCourte(h[0].jour) : "";
    return vide(h.length
      ? `La courbe se dessine au fil des jours : un relevé par jour, le premier le ${d}${d.endsWith(".") ? "" : "."}`
      : "La courbe se dessine au fil des jours : un relevé par jour, dès que tes chiffres sont lus.");
  }
  return cadreAdaptatif("graph-courbe", (L, bulle) => {
    const H = 150, g = 46, d = 58, haut = 14, bas = 24;
    const vals = h.map((x) => x.abonnes);
    let min = Math.min(...vals), max = Math.max(...vals);
    if (min === max) { min -= 1; max += 1; }
    const marge = (max - min) * 0.12; min -= marge; max += marge;
    const t = (j) => Date.parse(`${j}T12:00:00Z`);
    const t0 = t(h[0].jour), t1 = t(h[h.length - 1].jour);
    const X = (j) => g + ((t(j) - t0) / Math.max(1, t1 - t0)) * (L - g - d);
    const Y = (v) => haut + (1 - (v - min) / (max - min)) * (H - haut - bas);
    const ext = [Math.min(...vals), Math.max(...vals)];
    const grille = [...new Set(ext)].map((v) => svgEl("g", {},
      svgEl("line", { class: "graph-grille", x1: g, x2: L - d, y1: Y(v), y2: Y(v) }),
      svgEl("text", { class: "graph-axe", x: g - 8, y: Y(v) + 4, "text-anchor": "end" }, document.createTextNode(compact(v)))));
    const pts = h.map((x) => `${X(x.jour).toFixed(1)},${Y(x.abonnes).toFixed(1)}`).join(" ");
    const dernier = h[h.length - 1];
    const svg = svgEl("svg", { class: "graph", width: L, height: H, viewBox: `0 0 ${L} ${H}`, role: "img",
      "aria-label": `Abonnés : ${nombreFr(h[0].abonnes)} le ${dateCourte(h[0].jour)}, ${nombreFr(dernier.abonnes)} le ${dateCourte(dernier.jour)}.` },
      ...grille,
      svgEl("text", { class: "graph-axe", x: g, y: H - 6 }, document.createTextNode(dateCourte(h[0].jour))),
      svgEl("text", { class: "graph-axe", x: L - d, y: H - 6, "text-anchor": "end" }, document.createTextNode(dateCourte(dernier.jour))),
      svgEl("polyline", { class: "graph-ligne", points: pts }),
      svgEl("circle", { class: "graph-point", cx: X(dernier.jour), cy: Y(dernier.abonnes), r: 4 }),
      svgEl("text", { class: "graph-fin", x: X(dernier.jour) + 10, y: Y(dernier.abonnes) + 4 }, document.createTextNode(nombreFr(dernier.abonnes))));
    // Le repère vertical suit la souris et s'accroche au relevé le plus proche ; au clavier, les flèches.
    const repere = svgEl("line", { class: "graph-repere", x1: 0, x2: 0, y1: haut, y2: H - bas, visibility: "hidden" });
    const point = svgEl("circle", { class: "graph-point", r: 4, visibility: "hidden" });
    const zoneSvg = svgEl("rect", { class: "graph-capte", x: g, y: 0, width: L - g - d, height: H, tabindex: "0",
      "aria-label": "Parcourir les relevés avec les flèches" });
    svg.append(repere, point, zoneSvg);
    let i = h.length - 1;
    const voir = (k) => {
      i = Math.max(0, Math.min(h.length - 1, k));
      const x = X(h[i].jour), y = Y(h[i].abonnes);
      for (const n of [repere, point]) n.setAttribute("visibility", "visible");
      repere.setAttribute("x1", x); repere.setAttribute("x2", x);
      point.setAttribute("cx", x); point.setAttribute("cy", y);
      montrer(bulle, x, y, L, nombreFr(h[i].abonnes), " abonnés", `le ${dateCourte(h[i].jour)}`);
    };
    const cacher = () => { for (const n of [repere, point]) n.setAttribute("visibility", "hidden"); bulle.hidden = true; };
    zoneSvg.addEventListener("pointermove", (e) => {
      const r = svg.getBoundingClientRect(); const x = e.clientX - r.left;
      let k = 0; for (let j = 1; j < h.length; j++) if (Math.abs(X(h[j].jour) - x) < Math.abs(X(h[k].jour) - x)) k = j;
      voir(k);
    });
    zoneSvg.addEventListener("pointerleave", cacher);
    zoneSvg.addEventListener("focus", () => voir(i));
    zoneSvg.addEventListener("blur", cacher);
    zoneSvg.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); voir(i + (e.key === "ArrowRight" ? 1 : -1)); }
      if (e.key === "Escape") cacher();
    });
    return svg;
  });
}

// ---------------------------------------------------------------- vues de chaque publication (un format)
// pubs : [{ le, titre, vues, x_vues, comparable, lien, slug }] d'un seul format, du plus ancien au plus récent.
// normale : les vues habituelles de ce format (ou null). ouvrir(p) : ce que fait un clic sur une colonne.
export function colonnesVues(pubs, { normale = null, ouvrir = null, nom = "publication" } = {}) {
  const ps = [...pubs].filter((p) => p.le).sort((a, b) => String(a.le).localeCompare(String(b.le)));
  if (!ps.length) return vide(`Pas de ${nom} ces 30 derniers jours.`);
  return cadreAdaptatif("graph-colonnes", (L, bulle) => {
    const H = 170, g = 46, d = 12, haut = 22, bas = 24;
    const vals = ps.map((p) => p.vues).filter((v) => typeof v === "number");
    const top = Math.max(1, ...vals, typeof normale === "number" ? normale : 0);
    const pas = pasRond(top, 2);
    const max = Math.ceil(top / pas) * pas;
    const Y = (v) => haut + (1 - v / max) * (H - haut - bas);
    const bande = (L - g - d) / ps.length;
    const larg = Math.max(4, Math.min(24, bande * 0.62));
    const svg = svgEl("svg", { class: "graph", width: L, height: H, viewBox: `0 0 ${L} ${H}` });
    for (let v = 0; v <= max; v += pas) {
      svg.append(svgEl("line", { class: v ? "graph-grille" : "graph-base", x1: g, x2: L - d, y1: Y(v), y2: Y(v) }),
        svgEl("text", { class: "graph-axe", x: g - 8, y: Y(v) + 4, "text-anchor": "end" }, document.createTextNode(compact(v))));
    }
    // Une date sous une colonne sur deux (ou trois) quand elles sont serrées : jamais de dates qui se chevauchent.
    const tous = Math.max(1, Math.ceil(40 / bande));
    ps.forEach((p, k) => {
      const cx = g + bande * (k + 0.5);
      const v = typeof p.vues === "number" ? p.vues : null;
      const y = v === null ? Y(0) : Y(v);
      const h = v === null ? 0 : Math.max(0, Y(0) - y);
      const r = Math.min(4, h, larg / 2);
      const x0 = cx - larg / 2, x1 = cx + larg / 2, yb = Y(0);
      const forme = h > 0 ? svgEl("path", { class: "graph-colonne", d: `M${x0},${yb} V${y + r} Q${x0},${y} ${x0 + r},${y} H${x1 - r} Q${x1},${y} ${x1},${y + r} V${yb} Z` }) : null;
      if (k % tous === 0 || k === ps.length - 1) {
        svg.append(svgEl("text", { class: "graph-axe", x: cx, y: H - 6, "text-anchor": "middle" }, document.createTextNode(dateCourte(String(p.le).slice(0, 10)))));
      }
      const fois = p.comparable && typeof p.x_vues === "number" ? `${String(p.x_vues.toFixed(1)).replace(".", ",")} fois ta normale` : "trop récente pour la comparer";
      const titre = p.titre || "Sans légende";
      const etiquette = `${titre}, ${dateCourte(String(p.le).slice(0, 10))} : ${v === null ? "pas de chiffre" : `${nombreFr(v)} vues`}, ${fois}`;
      const action = ouvrir?.(p) || null;
      const capte = svgEl("rect", { class: `graph-capte${action ? " cliquable" : ""}`, x: g + bande * k, y: haut - 8, width: bande, height: H - haut - bas + 8,
        tabindex: "0", role: action ? "button" : "img", "aria-label": action ? `${etiquette}. ${action.libelle}` : etiquette });
      const g1 = svgEl("g", { class: "graph-barre" }, forme, capte);
      const voir = () => { g1.classList.add("actif"); montrer(bulle, cx, y, L, v === null ? "pas de chiffre" : nombreFr(v), v === null ? "" : " vues", `${titre} · ${fois}${action ? ` · ${action.libelle}` : ""}`); };
      const cacher = () => { g1.classList.remove("actif"); bulle.hidden = true; };
      capte.addEventListener("pointerenter", voir); capte.addEventListener("pointerleave", cacher);
      capte.addEventListener("focus", voir); capte.addEventListener("blur", cacher);
      if (action) {
        capte.addEventListener("click", () => action.faire());
        capte.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); action.faire(); } });
      }
      svg.append(g1);
    });
    if (typeof normale === "number" && normale > 0) {
      const y = Y(normale);
      svg.append(svgEl("line", { class: "graph-normale", x1: g, x2: L - d, y1: y, y2: y }),
        svgEl("text", { class: "graph-normale-texte", x: L - d, y: y - 6, "text-anchor": "end" }, document.createTextNode(`ta normale : ${nombreFr(normale)}`)));
    }
    return svg;
  });
}

// ---------------------------------------------------------------- 28 jours contre les 28 d'avant
// Deux barres, ces 28 jours en encre, les 28 d'avant en filet : la longueur se compare sans lire les chiffres.
export function comparaison(avant, apres) {
  if (typeof apres !== "number") return null;
  const max = Math.max(1, apres, typeof avant === "number" ? avant : 0);
  const ligne = (classe, quoi, v) => el("div", { class: `cmp-ligne ${classe}` },
    el("span", { class: "cmp-quoi" }, quoi),
    el("span", { class: "cmp-piste" }, el("span", { class: "cmp-barre", style: `width:${Math.max(v ? 2 : 0, (v / max) * 100).toFixed(1)}%` })),
    el("span", { class: "cmp-valeur" }, nombreFr(v)));
  return el("div", { class: "cmp", role: "img", "aria-label": `Ces 28 jours : ${nombreFr(apres)}${typeof avant === "number" ? `, les 28 d'avant : ${nombreFr(avant)}` : ""}.` },
    ligne("cmp-maintenant", "ces 28 jours", apres),
    typeof avant === "number" ? ligne("cmp-avant", "les 28 d'avant", avant) : null);
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
