// Petites fonctions communes à toute l'interface : éléments, dates, texte, icônes.

// Qui prévenir quand quelque chose coince : posé par le serveur sur <html> (client du studio).
export const CONTACT = document.documentElement.dataset.contact || "Yoan";
// Le client est son propre contact (Yoan dans son studio) : on ne lui dit pas « préviens Yoan ».
export const CONTACT_SOI = Boolean(document.documentElement.dataset.prenom) && document.documentElement.dataset.prenom === CONTACT;
// « préviens <contact> », ou, pour le client lui-même, une phrase qui s'adresse à lui.
export const previens = () => (CONTACT_SOI ? "c'est un souci du studio à corriger" : `préviens ${CONTACT}`);

export function el(tag, attrs = {}, ...enfants) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k === "texte") n.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(n.dataset, v);
    else if (v === true) n.setAttribute(k, "");
    else n.setAttribute(k, v);
  }
  for (const e of enfants.flat()) {
    if (e === null || e === undefined || e === false) continue;
    n.append(e instanceof Node ? e : document.createTextNode(String(e)));
  }
  return n;
}

export function echapper(t) {
  return String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- Dates (fuseau de Romain) ----------
const FUSEAU = "Europe/Zurich";
const fJour = new Intl.DateTimeFormat("fr-CH", { weekday: "short", day: "numeric", month: "short", timeZone: FUSEAU });
const fJourLong = new Intl.DateTimeFormat("fr-CH", { weekday: "long", day: "numeric", month: "long", timeZone: FUSEAU });
const fDate = new Intl.DateTimeFormat("fr-CH", { day: "numeric", month: "short", timeZone: FUSEAU });
const fHeure = new Intl.DateTimeFormat("fr-CH", { hour: "2-digit", minute: "2-digit", timeZone: FUSEAU });

// "AAAA-MM-JJ" -> Date à midi (évite les sauts de fuseau)
export function jourEnDate(j) {
  if (!j) return null;
  const [a, m, d] = j.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d, 11, 0, 0));
}
export function dateEnJour(d) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: FUSEAU, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return p; // AAAA-MM-JJ
}
export function aujourdhui() { return dateEnJour(new Date()); }
export function ajouterJours(j, n) {
  const d = jourEnDate(j); d.setUTCDate(d.getUTCDate() + n); return dateEnJour(d);
}
export function lundiDe(j) {
  const d = jourEnDate(j); const w = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - w); return dateEnJour(d);
}
export function jourCourt(j) { const d = jourEnDate(j); return d ? propre(fJour.format(d)) : ""; }
export function jourLong(j) { const d = jourEnDate(j); return d ? fJourLong.format(d) : ""; }
export function dateCourte(j) { const d = jourEnDate(j); return d ? fDate.format(d) : ""; }
export function heure(iso) { return fHeure.format(new Date(iso)); }
function propre(s) { return s.replace(/\s+/g, " "); }

// "AAAA-MM-JJ HH:MM" -> "mardi 18 novembre à 18:30"
export function quandLisible(q) {
  if (!q) return "";
  const [j, h] = q.split(" ");
  return `${jourLong(j)} à ${h ? h.replace(":", " h ").replace(/ h 00$/, " h") : ""}`.trim();
}

export function semaineLisible(lundi) {
  if (!lundi) return "Sans jour prévu";
  const ce = lundiDe(aujourdhui());
  if (lundi === ce) return "Cette semaine";
  if (lundi === ajouterJours(ce, 7)) return "La semaine prochaine";
  if (lundi === ajouterJours(ce, -7)) return "La semaine dernière";
  return `Semaine du ${dateCourte(lundi)}`;
}

export function ilYa(iso) {
  if (!iso) return "";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return "à l'instant";
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return `le ${dateCourte(dateEnJour(new Date(iso)))}`;
}

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
// prochain jour de publication par défaut à partir de "depuis" (inclus), parmi les jours de la config
export function prochainJourParDefaut(jours, depuis, pris = new Set()) {
  let j = depuis;
  for (let i = 0; i < 21; i++) {
    const nom = JOURS[jourEnDate(j).getUTCDay()];
    if ((!jours?.length || jours.includes(nom)) && !pris.has(j)) return j;
    j = ajouterJours(j, 1);
  }
  return depuis;
}

// ---------- Texte ----------
export function pluriel(n, un, plusieurs) { return `${n} ${n > 1 ? plusieurs : un}`; }

// Markdown simple -> HTML sûr : titres, gras, italique, listes, paragraphes, liens.
export function markdown(src) {
  const lignes = String(src ?? "").replace(/\r/g, "").split("\n");
  let html = ""; let liste = null; let para = [];
  const fermerPara = () => { if (para.length) { html += `<p>${para.map(enLigne).join("<br>")}</p>`; para = []; } };
  const fermerListe = () => { if (liste) { html += `</${liste}>`; liste = null; } };
  for (const brut of lignes) {
    const l = brut.trimEnd();
    let m;
    if (!l.trim()) { fermerPara(); fermerListe(); continue; }
    if ((m = l.match(/^(#{1,4})\s+(.*)$/))) { fermerPara(); fermerListe(); const n = Math.min(4, m[1].length + 2); html += `<h${n}>${enLigne(m[2])}</h${n}>`; continue; }
    if ((m = l.match(/^\s*[-*•]\s+(.*)$/))) { fermerPara(); if (liste !== "ul") { fermerListe(); html += "<ul>"; liste = "ul"; } html += `<li>${enLigne(m[1])}</li>`; continue; }
    if ((m = l.match(/^\s*(\d+)[.)]\s+(.*)$/))) { fermerPara(); if (liste !== "ol") { fermerListe(); html += `<ol start="${m[1]}">`; liste = "ol"; } html += `<li>${enLigne(m[2])}</li>`; continue; }
    if ((m = l.match(/^>\s?(.*)$/))) { fermerPara(); fermerListe(); html += `<blockquote>${enLigne(m[1])}</blockquote>`; continue; }
    fermerListe(); para.push(l);
  }
  fermerPara(); fermerListe();
  return html;
}
function enLigne(t) {
  let s = echapper(t);
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[\s(])\*(?!\s)(.+?)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return s;
}

// Texte brut pour le presse-papiers (on retire le balisage Markdown)
export function texteBrut(md) {
  return String(md ?? "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|\s)\*(\S.+?)\*/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

export async function copier(texte) {
  try { await navigator.clipboard.writeText(texte); return true; }
  catch {
    const t = el("textarea", { style: "position:fixed;opacity:0" }); t.value = texte; document.body.append(t); t.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch {} t.remove(); return ok;
  }
}

// ---------- Icônes (SVG maison, trait 1.75, coins arrondis) ----------
const P = {
  coche: '<path d="M4.5 10.5l3.5 3.5 7.5-8"/>',
  cadeau: '<rect x="3.5" y="8" width="13" height="8.5" rx="1.5"/><path d="M3 5.5h14V8H3zM10 5.5v11"/><path d="M10 5.5C8.6 3.3 6.2 3.2 6.4 4.6c.1.8 3.6.9 3.6.9zM10 5.5c1.4-2.2 3.8-2.3 3.6-.9-.1.8-3.6.9-3.6.9z"/>',
  croix: '<path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/>',
  copier: '<rect x="7" y="7" width="9" height="10" rx="2"/><path d="M4 13V5a2 2 0 0 1 2-2h7"/>',
  envoyer: '<path d="M10 16V4M5 9l5-5 5 5"/>',
  arreter: '<rect x="5.5" y="5.5" width="9" height="9" rx="1.5"/>',
  synchro: '<path d="M15.5 8A6 6 0 0 0 4.7 6.3M4.5 12a6 6 0 0 0 10.8 1.7"/><path d="M15.5 3.5V8H11M4.5 16.5V12H9"/>',
  horsligne: '<path d="M3 3l14 14"/><path d="M6.2 6.6A5 5 0 0 0 5.5 16h8.8M9 5.1A5 5 0 0 1 15 9.2a3.4 3.4 0 0 1 1.6 5.4"/>',
  calendrier: '<rect x="3.5" y="4.5" width="13" height="12" rx="2"/><path d="M3.5 8.5h13M7 3v3M13 3v3"/>',
  film: '<rect x="4" y="3" width="12" height="14" rx="2"/><path d="M4 7h3M4 13h3M13 7h3M13 13h3"/>',
  slides: '<rect x="3" y="4.5" width="10" height="11" rx="1.5"/><path d="M15.5 6.5v7M17.5 8v4"/>',
  fermer: '<path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/>',
  plus: '<path d="M10 4.5v11M4.5 10h11"/>',
  fleche: '<path d="M8 5l5 5-5 5"/>',
  bas: '<path d="M5 8l5 5 5-5"/>',
  lien: '<path d="M11 4h5v5M16 4l-7 7"/><path d="M14 11.5V15a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 4 15V7.5A1.5 1.5 0 0 1 5.5 6H9"/>',
  attention: '<path d="M10 3.5l7 12.5H3z"/><path d="M10 8.5v3.5M10 14.2v.1"/>',
  info: '<circle cx="10" cy="10" r="7"/><path d="M10 9v4.5M10 6.5v.1"/>',
  bulle: '<path d="M4 5.5A2 2 0 0 1 6 3.5h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3.2A2 2 0 0 1 4 11.5z"/>',
  ranger: '<path d="M3.5 7.5h13v8a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M3.5 7.5L5 4h10l1.5 3.5M8 10.5h4"/>',
  poignee: '<path d="M7.5 5v.1M12.5 5v.1M7.5 10v.1M12.5 10v.1M7.5 15v.1M12.5 15v.1"/>',
  lecture: '<path d="M7 5l8 5-8 5z"/>',
  pause: '<path d="M7.5 5v10M12.5 5v10"/>',
  entourer: '<path d="M10 3.5c4 0 6.5 2.6 6.5 6s-2.6 6.5-6.7 6.5S3.5 13.2 3.5 10c0-2.3 1.3-4.3 3.3-5.4"/>',
  crayon: '<path d="M12.5 4.5l3 3-8 8H4.5v-3z"/>',
  ecrire: '<path d="M4 15.5h12M5 12l7.5-7.5 2.5 2.5L7.5 14.5H5z"/>',
  ciseaux: '<circle cx="6" cy="6" r="2.2"/><circle cx="6" cy="14" r="2.2"/><path d="M8 7.2l8 6.3M8 12.8l8-6.3"/>',
  camera: '<rect x="3" y="6" width="10" height="9" rx="2"/><path d="M13 9l4-2.5v8L13 12"/>',
  mise: '<rect x="3.5" y="3.5" width="13" height="13" rx="2"/><path d="M3.5 8h13M8 8v8.5"/>',
  envoi: '<path d="M3.5 10l13-6-4.5 13-2.5-5z"/><path d="M10 12l2.5-3"/>',
  dossier: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h3.6l1.6 1.8h5.8A1.5 1.5 0 0 1 17 8.3v6.2a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5z"/>',
  idee: '<path d="M7.5 14.5h5M8.3 17h3.4"/><path d="M10 3a5 5 0 0 0-3 9c.6.5 1 1.2 1 2h4c0-.8.4-1.5 1-2a5 5 0 0 0-3-9z"/>',
  brief: '<path d="M5.5 3h6.5L15 6v10.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-13A.5.5 0 0 1 5.5 3z"/><path d="M12 3v3h3M7.5 9.5h5M7.5 12h5M7.5 14.5h3"/>',
  video: '<rect x="3.5" y="4.5" width="13" height="11" rx="2"/><path d="M8.5 7.8l4 2.2-4 2.2z"/>',
  photo: '<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h1.8l1.2-1.8h4l1.2 1.8H15a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 15 16H5a1.5 1.5 0 0 1-1.5-1.5z"/><circle cx="10" cy="10.8" r="2.7"/>',
  maison: '<path d="M3.5 9.5L10 4l6.5 5.5"/><path d="M5.5 8v8h9V8"/>',
  ecarter: '<path d="M4 6.5h12M8 6.5V4.5h4v2M5.5 6.5l.8 9a1.5 1.5 0 0 0 1.5 1.4h4.4a1.5 1.5 0 0 0 1.5-1.4l.8-9"/>',
};
export function icone(nom, cls = "ico") {
  return `<svg class="${cls}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[nom] || ""}</svg>`;
}
export function iconeEl(nom, cls) { const s = el("span", { class: "ico-c", html: icone(nom, cls) }); return s.firstChild; }

// ---------- Annonces brèves (en bas de l'écran) ----------
let zoneAnnonces;
export function annoncer(texte, genre = "info") {
  if (document.querySelector(".app.non-connecte")) return; // l'écran « rouvre le studio » suffit
  if (!zoneAnnonces) { zoneAnnonces = el("div", { class: "annonces", role: "status", "aria-live": "polite" }); document.body.append(zoneAnnonces); }
  const a = el("div", { class: `annonce annonce-${genre}` }, el("span", { html: icone(genre === "erreur" ? "attention" : "info") }), el("span", { texte }));
  zoneAnnonces.append(a);
  setTimeout(() => { a.classList.add("part"); setTimeout(() => a.remove(), 300); }, genre === "erreur" ? 7000 : 3500);
}
