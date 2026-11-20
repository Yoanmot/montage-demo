#!/usr/bin/env node
// partout.mjs : la multitude (geste « partout »). Quand il dit qu'une chose se voit ou se dit partout (« on voit ce
// chiffre partout », « tout le monde le répète », « tu l'as lu cent fois »), on la montre comme une multitude : des
// captures d'articles sur téléphone défilent en coupes sèches de 2 à 4 images, et son mot reste fixe au même endroit,
// sur un surligneur orange (text match cut). Validé par Yoan sur le test v19 (« l'effet plein de screens, c'était bien »),
// passé du sur-mesure (a06 du test v19) à la bibliothèque le 2026-11-20.
//
// Chaque page est une vraie capture de téléphone (STYLE.md, « Captures d'articles sur téléphone ») : construite à
// PARTOUT.capture px CSS de large puis agrandie jusqu'aux 1080 px de la vidéo ; barre d'état, barre du navigateur avec
// l'adresse, en-tête du site, rubrique, titre, chapô, auteur, photo sans personne, corps à taille réelle, « À lire
// aussi », publicité ; traînées de mouvement vers le bas, plus longues loin du mot ; certaines pages entièrement en flou.
// Le mot fait partie du texte de la page, dans la police du site : à l'ouverture, le navigateur mesure les débuts de
// ligne possibles (les derniers mots de « avant », au besoin un mot coupé en fin de ligne), choisit un bord gauche commun
// à toutes les pages (PARTOUT.mot.x : au plus près de la place de la v19) et, page par page, le début de ligne, la marge
// et le corps du site qui y amènent le mot ; puis il défile la page pour que sa ligne de base tombe à PARTOUT.mot.base.
// Calque natif (origine.natif, pages data-natif).
// Ce qui vient du plan : le mot fixe et, par page, le titre et la phrase autour du mot. Le reste (8 sites inventés,
// photos, auteurs, paragraphes de remplissage, « À lire aussi », publicités) est le décor fixe de la brique :
// bibliotheque/partout/decor.json, sans chiffre et sans marque.
// Entrée : flash craie (50 % sur la dernière image de lui, 100 % sur la première page) et clic de transition ; puis un
// petit clic à chaque changement d'écran (SONS.ecran). Sortie : sèche à la coupe qui suit son passage (le plan peut poser
// un transition-flash sur cette coupe).
// Contrôle : les fonds de page (classe fd) ne comptent pas pour la zone sûre ; le mot et son surligneur, si (une copie de
// la ligne du mot, hors fd, sous la page).
//
// La demande du plan (bibliotheque/partout/README.md) :
//   { "id": "a03", "geste": "partout", "intention": "...", "de": "<premier mot du passage>", "a": "<dernier mot>",
//     "elements": [ { "texte": "<le mot fixe, qu'il a dit>", "sur": "<premier mot du passage>", "chiffre_source"?: "..." } ],
//     "composition": { "pages": [ { "titre": "<titre d'article, 70 car. au plus>", "avant": "<début de la phrase qui
//                                    mène au mot>", "apres": "<suite de la phrase>" }, ... 6 à 12 ] } }
// Usage : node partout.mjs <dossier -montage> <id>
// Après : verifier.mjs <dossier> <id> --video ..., puis calques.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { S, K, FPS, BIB, Couche, chargerMots, coupes, img, tImg, f4, son, ecrireCalque, normaliser } from './lib/style.mjs';

const [Marg, ID] = process.argv.slice(2);
const M = Marg && path.resolve(Marg);
if (!M || !ID) { console.log('Usage : node partout.mjs <dossier -montage> <id>'); process.exit(3); }
const resoluF = path.join(M, 'animations', 'plan-resolu.json');
if (!fs.existsSync(resoluF)) { console.log(`PLAN_NON_CALÉ : lance d'abord caler.mjs (il manque ${resoluF})`); process.exit(3); }
const d = JSON.parse(fs.readFileSync(resoluF, 'utf8')).demandes.find((x) => x.id === ID);
if (!d || d.geste !== 'partout') { console.log(`DEMANDE_INTROUVABLE : pas de demande ${ID} « partout » dans le plan calé`); process.exit(3); }
const PT = S.PARTOUT;
const DECOR = JSON.parse(fs.readFileSync(path.join(BIB, 'partout', 'decor.json'), 'utf8'));
const refus = [], avis = [];
const R = (code, msg) => refus.push(`${code} : ${msg}`);
const fin = () => { for (const a of avis) console.log(`AVIS ${a}`); for (const r of refus) console.log(`REFUS ${r}`); console.log(`REFUSÉ : ${refus.length} problème(s) à corriger dans la demande ${ID} du plan`); process.exit(2); };

// ------------------------------------------------------------------ la demande
const mots = chargerMots(M);
if (d.elements.length !== 1) R('ELEMENTS', 'un seul élément : le mot fixe');
const E = d.elements[0] || {};
const MOT = String(E.texte || '').trim().replace(/\s+/g, ' ');
if (!MOT) R('ELEMENTS', 'le mot fixe (« texte ») est vide');
else if (MOT.length > PT.motMax) R('ELEMENTS', `« ${MOT} » : ${MOT.length} caractères, ${PT.motMax} au plus (le mot fixe tient sur sa ligne, avec son début de phrase)`);
// le mot fixe est un mot qu'il a dit, dans le passage ou dans les 20 s avant (« ce chiffre » renvoie à ce qu'il vient de dire)
const UNITES = { un: '1', une: '1', deux: '2', trois: '3', quatre: '4', cinq: '5', six: '6', sept: '7', huit: '8', neuf: '9', dix: '10', onze: '11', douze: '12', quinze: '15', vingt: '20', trente: '30', cent: '100' };
const jet = (s) => normaliser(s).split(/\s+/).filter(Boolean).map((w) => UNITES[w] || w);
const cherche = jet(MOT), dits = mots.map((w) => jet(w.text)[0] || '');
const finPassage = d.a ? d.a.dernier : d.de.dernier;
let ditAvant = false;
for (let i = 0; cherche.length && i + cherche.length <= finPassage + 1; i++) {
  if (mots[i].start < d.de.debut_s - PT.ditAvantMax) continue;
  if (cherche.every((c, j) => dits[i + j] === c)) { ditAvant = true; break; }
}
if (MOT && !ditAvant && !E.titre_reformule) R('MOT_NON_DIT', `« ${MOT} » n'est pas dit dans le passage ni dans les ${PT.ditAvantMax} s avant : le mot fixe est le sien (ou « titre_reformule » avec sa raison)`);
// La multitude est une preuve (Yoan, 2026-11-20) : les pages qui défilent montrent qu'une chose se voit, se dit ou se vend
// partout, parce qu'il AFFIRME cette fréquence. Sur une phrase de connivence (il prend le spectateur à témoin d'une
// expérience commune), elle ne prouve rien : c'est un regard échangé, on reste sur lui. Le plan écrit l'affirmation prouvée.
const preuve = String((d.composition && d.composition.preuve) || '').trim();
if (preuve.length < 20) R('PREUVE', '« composition.preuve » : l\'affirmation de fréquence ou d\'omniprésence qu\'il fait dans cette phrase (ce qui se voit, se dit ou se vend partout) et que les pages prouvent ; s\'il ne l\'affirme pas (connivence, constat partagé avec le spectateur), pas de multitude : reste sur lui');
const pages = (d.composition && d.composition.pages) || [];
if (pages.length < PT.pagesMin || pages.length > PT.pagesMax) R('PAGES', `${pages.length} page(s) : ${PT.pagesMin} à ${PT.pagesMax} (« composition.pages » : titre, avant, apres)`);
for (const [k, p] of pages.entries()) {
  if (!p.titre || !p.avant || !p.apres) R('PAGES', `page ${k + 1} : il faut « titre », « avant » et « apres »`);
  else if (String(p.titre).length > PT.titreMax) R('PAGES', `page ${k + 1} : titre de ${String(p.titre).length} caractères (${PT.titreMax} au plus)`);
  const chiffres = `${p.titre || ''} ${p.avant || ''} ${p.apres || ''}`.match(/\d+/g) || [];
  for (const n of chiffres) if (!cherche.includes(n)) R('CHIFFRE_NON_DIT', `page ${k + 1} : « ${n} » ; aucun chiffre sur les pages, sauf celui du mot fixe`);
}
if (refus.length) fin();

// ------------------------------------------------------------------ le temps
const cs = coupes(M);
const aDe = d.de;
const debut = Math.max(0, aDe.image - 1);                    // flash à 50 % sur la dernière image de lui
const finA = (d.a || d.de).fin_image;
const finImg = cs.find((c) => c >= finA && c <= finA + img(PT.aimant)) ?? finA + img(0.2);
let n = finImg - debut;
if (n / FPS > PT.dureeMax) { avis.push(`passage de ${(n / FPS).toFixed(1)} s : l'effet est coupé à ${PT.dureeMax} s (il retourne sur lui)`); n = img(PT.dureeMax); }
if (n / FPS < PT.dureeMin) R('TROP_COURT', `${(n / FPS).toFixed(1)} s : il faut ${PT.dureeMin} s au moins pour voir défiler les pages (« a » plus loin)`);
if (refus.length) fin();
// une page par coupe sèche : durées (images) tirées de PT.durees, la dernière ajustée pour finir pile, toutes de 2 à 4
const durees = [];
for (let reste = n - 1, k = 0; reste > 0; k++) { const x = Math.min(reste, PT.durees[k % PT.durees.length]); durees.push(x); reste -= x; }
if (durees.length > 1 && durees.at(-1) < 2) {
  const r = durees.pop();
  if (durees.at(-1) + r <= 4) durees[durees.length - 1] += r; else { durees[durees.length - 1] -= 1; durees.push(r + 1); }
}
const vues = [];                                             // [{ page, a, b }] en images du calque
for (let k = 0, a = 1; k < durees.length; a += durees[k], k++) vues.push({ page: k % pages.length, a, b: a + durees[k] });

// ------------------------------------------------------------------ une page (DOM de site, PT.capture px CSS de large)
const ECH = 1080 / PT.capture;
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const photo = ([cle, h, legende]) => `<figure class="ph"><div class="img" style="height:${h}px"><div class="flou" style="background:${DECOR.photos[cle]}">`
  + (cle === 'chemin' ? '<i class="sentier"></i>' : cle === 'carnet' ? '<i class="lignes"></i>' : '') + '</div><i class="grain"></i></div>'
  + (legende ? `<figcaption>${legende}</figcaption>` : '') + '</figure>';
const bloc = (b) => {
  if (b.chapo) return `<p class="chapo">${b.chapo}</p>`;
  if (b.auteur) return `<p class="aut"><span class="av"></span><span><b>${b.auteur[0]}</b><br>${b.auteur[1]}</span></p>`;
  if (b.photo) return photo(b.photo);
  if (b.p) return `<p>${b.p}</p>`;
  if (b.h2) return `<h2>${b.h2}</h2>`;
  if (b.pub) return `<div class="pub"><p>Publicité</p><div class="pubv"><span>${b.pub}</span><i>En savoir plus</i></div></div>`;
  if (b.lire) return `<aside class="lire"><p class="lt">À lire aussi</p>${b.lire.map((t) => `<a>${t}</a>`).join('')}</aside>`;
  throw new Error(`decor.json : bloc inconnu ${JSON.stringify(b)}`);
};
const lier = (s) => (/^[,.)…]/.test(s) ? s : ` ${s}`);
// Coupures d'un mot en fin de ligne, à la française (« lende-main », « pro-gramme ») : avant une consonne suivie d'une
// voyelle, ou entre deux consonnes qui ne vont pas ensemble ; deux lettres au moins de chaque côté ; mots de lettres
// seulement (ponctuation finale admise), jamais après une apostrophe.
const VOY = 'aeiouyàâäéèêëîïôöùûüœæ', INSEP = ['bl', 'br', 'ch', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'gn', 'ph', 'pl', 'pr', 'qu', 'th', 'tr', 'vr', 'gu'];
function coupures(mot) {
  const m = mot.match(/^([A-Za-zÀ-ÿœŒæÆ]+)([,.;:!?]*)$/);
  if (!m || m[1].length < 5) return [];
  const w = m[1], l = w.toLowerCase(), v = (i) => VOY.includes(l[i]), out = [];
  for (let i = 2; i <= w.length - 2; i++) {
    if (v(i - 1) && !v(i) && i + 1 < w.length && v(i + 1)) out.push(i);                       // V-CV
    else if (!v(i - 1) && !v(i) && i >= 2 && v(i - 2) && i + 1 < w.length && v(i + 1) && !INSEP.includes(l.slice(i - 1, i + 1))) out.push(i);   // VC-CV
  }
  return out.filter((i) => w.length - i >= 2).map((i) => [w.slice(0, i), w.slice(i) + m[2]]);
}
// Débuts de ligne possibles : les derniers mots de la phrase (1 à PT.debutsMax, pris dans « avant » puis, s'il est court,
// dans la fin de la phrase d'amorce du décor), ou aucun, ou un mot coupé en fin de ligne (« lende- / main. Comptez »,
// moins bien noté) ; le navigateur garde celui qui donne la marge et le corps les plus proches de ceux du site
function debuts(avant, amorce) {
  const w = `${amorce} ${String(avant).trim()}`.split(/\s+/), out = [];
  for (let j = 1; j <= Math.min(PT.debutsMax, w.length - 1); j++) out.push({ reste: w.slice(0, -j).join(' '), debut: w.slice(-j).join(' ') });
  out.push({ reste: w.join(' '), debut: '' });
  for (let j = 0; j < Math.min(PT.debutsMax, w.length - 1); j++) {
    const i = w.length - 1 - j;                              // le mot coupé, suivi des j derniers mots
    for (const [a, b] of coupures(w[i])) out.push({ reste: [...w.slice(0, i), `${a}-`].join(' '), debut: [b, ...w.slice(i + 1)].join(' '), coupe: true });
  }
  return out;
}
const SITES = pages.map((_, k) => DECOR.ordre[k % DECOR.ordre.length]);
const MODELES = pages.map((_, k) => DECOR.modeles[k % DECOR.modeles.length]);
function article(p, k) {
  const Si = DECOR.sites[SITES[k]], Mo = MODELES[k];
  const ligne = `<p class="pm"><span class="av0"></span><br><span class="nw"><span class="deb"></span><span class="k">${esc(MOT)}</span></span>${esc(lier(p.apres))}</p>`;
  return `<div class="site" style="--m:${Si.marge}px;--ui:${Si.ui};--corps:${Si.corps};--titre:${Si.titre};--t:${Si.taille}px;--lh:${Si.lh};--tx:${Si.texte};--acc:${Si.accent};--lien:${Si.lien}">`
    + `<header class="ent" style="background:${Si.fondEntete};color:${Si.logoCouleur}"><svg width="20" height="16" viewBox="0 0 20 16" fill="${Si.logoCouleur}"><rect y="1" width="20" height="2.2" rx="1"/><rect y="7" width="20" height="2.2" rx="1"/><rect y="13" width="20" height="2.2" rx="1"/></svg>`
    + `<span class="logo">${Si.logo}</span><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="${Si.logoCouleur}" stroke-width="2"><circle cx="7.5" cy="7.5" r="5.5"/><path d="M12 12l4.5 4.5" stroke-linecap="round"/></svg></header>`
    + `<article class="art"><p class="rub">${Mo.rub}</p><h1>${esc(p.titre)}</h1>${Mo.haut.map(bloc).join('')}${ligne}${Mo.bas.map(bloc).join('')}`
    + DECOR.fin.map((t) => `<p>${t}</p>`).join('') + '</article></div>';
}

// ------------------------------------------------------------------ barres du téléphone et du navigateur
const ICONES_ETAT = `<svg width="68" height="12" viewBox="0 0 68 12"><g fill="#000"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="4.5" y="6" width="3" height="6" rx="1"/><rect x="9" y="3.5" width="3" height="8.5" rx="1"/><rect x="13.5" y="1" width="3" height="11" rx="1"/>
  <path d="M29 3.2a9.5 9.5 0 0 1 13 0l-1.6 1.7a7.2 7.2 0 0 0-9.8 0zM31.4 5.8a6 6 0 0 1 8.2 0l-1.6 1.7a3.7 3.7 0 0 0-5 0zM33.9 8.4a2.4 2.4 0 0 1 3.2 0L35.5 10z"/>
  <rect x="44.5" y="1" width="21" height="10.5" rx="3" fill="none" stroke="#000" stroke-opacity=".4"/><rect x="46.3" y="2.8" width="15" height="6.9" rx="1.6"/><rect x="66.5" y="4" width="1.4" height="4" rx=".7" fill-opacity=".45"/></g></svg>`;
const etat = (fond) => `<div class="etat" style="background:${fond}"><span>9:41</span>${ICONES_ETAT}</div>`;
const cadenas = '<svg width="9" height="11" viewBox="0 0 9 11"><rect x=".5" y="4.5" width="8" height="6" rx="1.4" fill="#555"/><path d="M2.3 4.6V3.2a2.2 2.2 0 0 1 4.4 0v1.4" fill="none" stroke="#555" stroke-width="1.2"/></svg>';
const recharger = '<svg width="13" height="13" viewBox="0 0 13 13"><path d="M10.6 4.2A4.6 4.6 0 1 0 11.2 8" fill="none" stroke="#1b1b1b" stroke-width="1.5" stroke-linecap="round"/><path d="M11.4 1.3v3.4H8" fill="none" stroke="#1b1b1b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const outilsSafari = `<div class="outils"><svg width="300" height="24" viewBox="0 0 300 24" fill="none" stroke="#0a7aff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M14 4l-8 8 8 8"/><path d="M72 4l8 8-8 8" stroke-opacity=".35"/><path d="M150 3v13M144 8l6-6 6 6M141 12v9h18v-9"/><path d="M212 4h14a2 2 0 0 1 2 2v15l-9-5-9 5V6a2 2 0 0 1 2-2z"/><rect x="272" y="6" width="13" height="13" rx="2.5"/><path d="M276 3h10a2 2 0 0 1 2 2v10"/></svg></div>`;
const barre = (Si) => {
  if (Si.barre === 'safariBas') return { haut: etat('#fff'), bas: `<div class="sbas"><div class="pill"><span class="aa">A<small>A</small></span><span class="dom">${cadenas} ${Si.dom}</span>${recharger}</div>${outilsSafari}</div>` };
  if (Si.barre === 'safariHaut') return { haut: etat('#f2f2f7') + `<div class="shaut"><div class="pill"><span class="aa">A<small>A</small></span><span class="dom">${cadenas} ${Si.dom}</span>${recharger}</div></div>`, bas: '<div class="indic"></div>' };
  return { haut: etat('#fff') + `<div class="chr"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#444" stroke-width="1.7" stroke-linejoin="round"><path d="M3 8.5L9 3l6 5.5V15H3z"/></svg><div class="url">${cadenas}<span>${Si.dom}/article</span></div><span class="onglets">4</span><svg width="4" height="16" viewBox="0 0 4 16" fill="#444"><circle cx="2" cy="2" r="1.6"/><circle cx="2" cy="8" r="1.6"/><circle cx="2" cy="14" r="1.6"/></svg></div>`, bas: '<div class="indic"></div>' };
};

// ------------------------------------------------------------------ traînées verticales (par bandes sous la ligne du mot)
// plus la bande est loin du mot, plus la traînée est longue (nette sur la ligne du mot, illisible en bas) ; une page en
// flou traîne partout, plus fort
const filtres = new Set();
const filtre = (v) => { if (v <= 0) return 'none'; const k = Math.round(v); filtres.add(k); return `url(#tr${k})`; };
const surligneur = `<svg class="hl" width="1080" height="1920"><polygon fill="${K.orange}"/></svg>`;
let html = '  <div class="pages" data-natif>\n';
pages.forEach((p, k) => {
  const Si = DECOR.sites[SITES[k]], fl = MODELES[k].flou || 0, fac = PT.flous[fl], b = barre(Si);
  const vLigne = fl ? PT.flouLigne * fl : 0;
  const copie = (cls, v, hl) => `    <div class="${cls}" style="filter:${filtre(v)}">${hl ? surligneur : ''}<div class="vp"><div class="defile">${article(p, k)}</div></div></div>\n`;
  html += `  <div class="pg" id="pg${k}">\n    <div class="fondpg fd"></div>\n`;
  // la ligne du mot, hors fd (contrôlée : mot et surligneur), recouverte par la bande 0 identique
  html += copie('kx', vLigne, true);
  PT.bandes.forEach((_, j) => { html += copie('bd fd', j === 0 ? vLigne : PT.trainees[j] * fac, j === 0); });
  html += `    <div class="chrome fd">${b.haut}<div class="bas">${b.bas}</div></div>\n  </div>\n`;
});
const defs = [...filtres].map((v) => `<filter id="tr${v}" x="-2%" y="-10%" width="104%" height="130%">`
  + `<feGaussianBlur in="SourceGraphic" stdDeviation="0 ${(v * 0.25).toFixed(2)}" result="a"/>`
  + `<feOffset in="SourceGraphic" dy="${(v * 0.55).toFixed(1)}" result="o1"/><feGaussianBlur in="o1" stdDeviation="0 ${(v * 0.5).toFixed(2)}" result="b1"/>`
  + `<feOffset in="SourceGraphic" dy="${(v * 1.25).toFixed(1)}" result="o2"/><feGaussianBlur in="o2" stdDeviation="0 ${(v * 0.9).toFixed(2)}" result="b2"/>`
  + `<feComponentTransfer in="b1" result="c1"><feFuncA type="linear" slope="0.75"/></feComponentTransfer>`
  + `<feComponentTransfer in="b2" result="c2"><feFuncA type="linear" slope="0.5"/></feComponentTransfer>`
  + `<feMerge><feMergeNode in="c2"/><feMergeNode in="c1"/><feMergeNode in="a"/></feMerge></filter>`).join('');
html += `  </div>\n  <svg class="a" width="0" height="0"><defs>${defs}</defs></svg>\n  <div class="a fd" id="flash"></div>\n`;

const c = new Couche(n);
c.css = `.pages{position:absolute;inset:0;}
.pg{position:absolute;inset:0;visibility:hidden;overflow:hidden;}
.fondpg{position:absolute;inset:0;background:#fff;}
.bd,.kx{position:absolute;inset:0;}
.hl{position:absolute;left:0;top:0;}
.vp{position:absolute;left:0;top:0;width:${PT.capture}px;height:2000px;transform:scale(${ECH.toFixed(5)});transform-origin:0 0;}
.defile{position:absolute;left:0;top:0;width:${PT.capture}px;}
.chrome{position:absolute;left:0;top:0;width:${PT.capture}px;height:${(1920 / ECH).toFixed(2)}px;transform:scale(${ECH.toFixed(5)});transform-origin:0 0;font-family:-apple-system,'Helvetica Neue',sans-serif;}
.etat{height:47px;display:flex;align-items:center;justify-content:space-between;padding:4px 26px 0 34px;box-sizing:border-box;font-weight:600;font-size:16px;color:#000;}
.shaut{background:#f2f2f7;padding:2px 12px 8px;border-bottom:0.5px solid #c8c8cc;}
.pill{height:38px;border-radius:12px;background:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 12px;box-shadow:0 0.5px 2px rgba(0,0,0,.12);font-size:15px;color:#1b1b1b;}
.shaut .pill{background:#e3e3e8;box-shadow:none;}
.aa{font-size:16px;font-weight:500;}.aa small{font-size:12px;}
.dom{display:flex;align-items:center;gap:5px;letter-spacing:-0.1px;}
.bas{position:absolute;left:0;bottom:0;width:${PT.capture}px;}
.sbas{position:relative;background:rgba(246,246,248,.98);border-top:0.5px solid #c8c8cc;padding:8px 12px 0;height:128px;box-sizing:border-box;}
.sbas::after{content:'';position:absolute;left:128px;bottom:8px;width:134px;height:5px;border-radius:3px;background:#111;}
.outils{display:flex;justify-content:center;padding-top:12px;}
.indic{height:22px;position:relative;}.indic::after{content:'';position:absolute;left:128px;bottom:8px;width:134px;height:5px;border-radius:3px;background:#111;}
.chr{height:52px;display:flex;align-items:center;gap:12px;padding:0 14px;background:#fff;border-bottom:1px solid #e3e3e3;}
.url{flex:1;height:36px;border-radius:18px;background:#eef1f4;display:flex;align-items:center;gap:7px;padding:0 14px;font-size:14px;color:#3c4043;}
.onglets{width:17px;height:17px;border:1.8px solid #444;border-radius:4px;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;color:#444;}
.site{font-family:var(--ui);color:var(--tx);background:transparent;}
.ent{display:flex;align-items:center;justify-content:space-between;height:52px;padding:0 var(--m);border-bottom:1px solid rgba(0,0,0,.08);}
.logo{font-size:21px;letter-spacing:-0.4px;font-weight:400;}.logo b{font-weight:800;}
.art{padding:14px var(--m) 40px;}
.rub{margin:4px 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--acc);}
h1{font-family:var(--titre);font-size:27px;line-height:1.18;font-weight:700;margin:0 0 12px;letter-spacing:-0.3px;color:#111;}
.chapo{font-family:var(--ui);font-size:17px;line-height:1.45;font-weight:500;color:#3a3a3a;margin:0 0 14px;}
.aut{display:flex;align-items:center;gap:10px;font-size:13px;line-height:1.35;color:#666;margin:0 0 14px;}.aut b{color:#222;font-weight:600;}
.av{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#d9d4cc,#b9b2a7);flex:none;}
.ph{margin:0 calc(-1 * var(--m)) 16px;}
.img{position:relative;overflow:hidden;}
.img .flou{position:absolute;inset:-6px;filter:blur(2.2px) saturate(.92);}
.img::after{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,transparent 55%,rgba(0,0,0,.28) 100%);}
.img .grain{position:absolute;inset:0;opacity:.18;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E");}
.img .sentier{position:absolute;left:0;right:0;bottom:0;height:54%;background:linear-gradient(180deg,rgba(214,196,160,.9),rgba(196,170,128,.95));clip-path:polygon(47% 0,53% 0,78% 100%,22% 100%);}
.img .lignes{position:absolute;left:24%;width:44%;top:16%;height:70%;background:repeating-linear-gradient(180deg,transparent 0 13px,rgba(70,90,140,.35) 13px 14px);}
figcaption{font-size:12px;color:#777;padding:6px var(--m) 0;line-height:1.35;}
.art p:not(.rub):not(.chapo):not(.aut):not(.lt){font-family:var(--corps);font-size:var(--t);line-height:var(--lh);margin:0 0 16px;color:var(--tx);}
.art a{color:var(--lien);text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:2px;}
h2{font-family:var(--titre);font-size:21px;line-height:1.25;margin:22px 0 10px;color:#111;}
.lire{border-top:3px solid var(--acc);background:#f6f6f4;padding:12px 14px 6px;margin:6px 0 18px;}
.lire .lt{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;margin:0 0 6px;color:var(--acc);}
.lire a{display:block;font-family:var(--titre);font-size:16px;line-height:1.3;font-weight:700;color:#111 !important;text-decoration:none !important;padding:8px 0;border-top:1px solid #e2e2de;}
.pub{margin:8px calc(-1 * var(--m)) 18px;padding:0 var(--m);}
.pub p{font-size:10px !important;line-height:1 !important;letter-spacing:.6px;text-transform:uppercase;color:#999 !important;margin:0 0 6px !important;font-family:var(--ui) !important;}
.pubv{height:118px;border-radius:6px;background:linear-gradient(120deg,#e9eef5,#d6e0ec);display:flex;flex-direction:column;justify-content:space-between;padding:14px;box-sizing:border-box;font-family:var(--ui);}
.pubv span{font-size:16px;font-weight:700;color:#1f2a37;line-height:1.25;}.pubv i{font-style:normal;align-self:flex-start;font-size:13px;font-weight:700;background:#1f2a37;color:#fff;padding:7px 12px;border-radius:16px;}
.nw{white-space:nowrap;}
.k{position:relative;}
#flash{inset:0;background:${K.craie};opacity:0;}
`;
c.html = html;
// Pose des pages par le navigateur (une fois, à l'ouverture) : bord gauche XK commun, puis début de ligne, corps et
// marge du site de chaque page pour que le mot commence à XK ; défilement pour que sa ligne de base tombe à BASE ; bandes
// de traînée sous la ligne du mot ; surligneur aux bords irréguliers autour du mot ; la copie « kx » ne garde que la
// boîte du surligneur.
const SL = PT.surligne;
c.js += `
const ECH = ${ECH}, XV = ${JSON.stringify(PT.mot.x)}, BASE = ${PT.mot.base}, BANDES = ${JSON.stringify(PT.bandes)}, MS = ${JSON.stringify(PT.margeSite)};
const DEBUTS = ${JSON.stringify(pages.map((p, k) => debuts(p.avant, MODELES[k].amorce)))}, MARGES = ${JSON.stringify(SITES.map((s) => DECOR.sites[s].marge))};
const TAILLES = ${JSON.stringify(SITES.map((s) => DECOR.sites[s].taille))}, CORPS = ${JSON.stringify(PT.corps)}, PEN = ${PT.coupure};
window.__poses = [];
const pgs = [...document.querySelectorAll('.pg')];
const copiesDe = (pg) => [...pg.querySelectorAll('.kx, .bd')];
const poser = (pg, d) => copiesDe(pg).forEach((b) => { b.querySelector('.av0').textContent = d.reste; b.querySelector('.deb').textContent = d.debut ? d.debut + ' ' : ''; });
// coût d'une mise en page : marge proche de celle du site et plausible (MS), corps proche de celui du site, dans CORPS
const cout = (m, t, k, coupe) => (coupe ? PEN : 0) + Math.abs(m - MARGES[k]) + (m < MS[0] || m > MS[1] ? 100 + 4 * Math.max(MS[0] - m, m - MS[1]) : 0) + 3 * Math.abs(t - TAILLES[k]);
// 1. largeur (px CSS) de chaque début de ligne possible, page par page, au corps du site
const largeurs = pgs.map((pg, k) => {
  const c0 = copiesDe(pg)[0], art = c0.querySelector('.art'), kk = c0.querySelector('.k');
  const vis = pg.style.visibility; pg.style.visibility = 'visible';
  const ws = DEBUTS[k].map((d) => { poser(pg, d); return (kk.getBoundingClientRect().left - art.getBoundingClientRect().left) / ECH - parseFloat(getComputedStyle(art).paddingLeft); });
  pg.style.visibility = vis;
  return ws;
});
// meilleure mise en page d'une page pour un bord gauche x (px vidéo) : début de ligne, corps (la largeur suit le corps)
function choix(x, k) {
  let b = null;
  largeurs[k].forEach((w, i) => { for (let t = CORPS[0]; t <= CORPS[1] + 1e-9; t += 0.25) {
    const m = x / ECH - w * t / TAILLES[k], c = cout(m, t, k, DEBUTS[k][i].coupe);
    if (!b || c < b.c) b = { i, t, m, c };
  } });
  return b;
}
// 2. bord gauche du mot (px vidéo), le même pour toutes les pages, au plus près de XV.pref (la place validée en v19)
let XK = XV.pref, meilleur = Infinity;
for (let x = XV.min; x <= XV.max; x += 2) {
  const t = largeurs.reduce((s, ws, k) => s + choix(x, k).c, 0) + 0.05 * Math.abs(x - XV.pref);
  if (t < meilleur - 1e-9) { meilleur = t; XK = x; }
}
function poserPages() {
  pgs.forEach((pg, k) => {
    const copies = copiesDe(pg);
    const sites = copies.map((b) => b.querySelector('.site')), art = copies[0].querySelector('.art'), kk = copies[0].querySelector('.k');
    const vis = pg.style.visibility; pg.style.visibility = 'visible';
    const ch = choix(XK, k), d = DEBUTS[k][ch.i];
    poser(pg, d);
    sites.forEach((s) => s.style.setProperty('--t', ch.t + 'px'));
    // largeur réelle au corps choisi, puis marge exacte
    const w = (kk.getBoundingClientRect().left - art.getBoundingClientRect().left) / ECH - parseFloat(getComputedStyle(art).paddingLeft);
    const best = { d, m: XK / ECH - w, t: ch.t };
    const essais = DEBUTS[k].map((e, j) => (e.debut || '(aucun)') + '=' + (XK / ECH - largeurs[k][j]).toFixed(1));
    sites.forEach((s) => s.style.setProperty('--m', best.m.toFixed(3) + 'px'));
    // défilement : ligne de base du mot à BASE
    const fs = parseFloat(getComputedStyle(kk).fontSize) * ECH;
    const pr = document.createElement('span'); pr.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline;'; kk.appendChild(pr);
    const base = pr.getBoundingClientRect().top; pr.remove();
    const dy = (BASE - base) / ECH;
    copies.forEach((b) => { b.querySelector('.defile').style.top = dy.toFixed(3) + 'px'; });
    // surligneur : forme irrégulière autour du mot (sa boîte après défilement)
    const q = kk.getBoundingClientRect(), cap = 0.7 * fs;
    const x0 = q.left - ${SL.marge} * fs, x1 = q.right + ${SL.marge} * fs, y0 = BASE - cap - ${SL.haut} * fs, y1 = BASE + ${SL.bas} * fs;
    let s = 7 + k; const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    const pts = [];
    for (let x = x0; x <= x1; x += 22) pts.push([x + (rnd() - 0.5) * 5, y0 + (rnd() - 0.5) * 6]);
    for (let y = y0; y <= y1; y += 18) pts.push([x1 + 3 + (rnd() - 0.5) * 7, y]);
    for (let x = x1; x >= x0; x -= 22) pts.push([x + (rnd() - 0.5) * 5, y1 + (rnd() - 0.5) * 6]);
    for (let y = y1; y >= y0; y -= 18) pts.push([x0 - 3 + (rnd() - 0.5) * 7, y]);
    const pp = pts.map(([x, y]) => x.toFixed(1) + ',' + y.toFixed(1)).join(' ');
    pg.querySelectorAll('.hl polygon').forEach((p) => p.setAttribute('points', pp));
    // bandes : coupe horizontale (px vidéo) sous la ligne de base du mot ; la copie kx : la boîte du surligneur
    pg.querySelectorAll('.bd').forEach((b, j) => { const [a, z] = BANDES[j]; b.style.clipPath = 'inset(' + (j ? BASE + a * fs : 0).toFixed(1) + 'px 0 ' + Math.max(0, 1920 - (BASE + z * fs)).toFixed(1) + 'px 0)'; });
    const e = 10;
    pg.querySelector('.kx').style.clipPath = 'inset(' + (y0 - e).toFixed(1) + 'px ' + (1080 - x1 - e).toFixed(1) + 'px ' + (1920 - y1 - e).toFixed(1) + 'px ' + (x0 - e).toFixed(1) + 'px)';
    window.__poses.push({ page: k, x: XK, essais: essais.join(' | '), debut: best.d.debut, marge: +best.m.toFixed(2), corps: best.t, gauche: +q.left.toFixed(1), base: BASE, defile: +dy.toFixed(1), taille: +fs.toFixed(1) });
    pg.style.visibility = vis;
  });
  document.documentElement.dataset.poses = JSON.stringify(window.__poses);
}
poserPages();
`;
c.montre('.pages', 1, `${MOT} (mot fixe)`);
for (const v of vues) c.js += `tl.set('#pg${v.page}', { visibility: 'visible' }, ${f4(tImg(v.a))});\ntl.set('#pg${v.page}', { visibility: 'hidden' }, ${f4(tImg(v.b))});\n`;
c.js += `tl.set('#flash', { opacity: 0.5 }, ${f4(tImg(0))});\ntl.set('#flash', { opacity: 1 }, ${f4(tImg(1))});\ntl.set('#flash', { opacity: 0 }, ${f4(tImg(2))});\n`;
c.attendus.at(-1).mot_image = aDe.image;
const sons = [son('transition', debut + 1, 'flash d\'entrée de la multitude : un clic, la première page arrive avec lui')];
if (S.SONS.ecran) for (const v of vues.slice(1)) sons.push(son('ecran', debut + v.a, 'changement d\'écran de la multitude : un petit clic'));
ecrireCalque(M, {
  id: ID, demande: ID, debut, images: n, couche: 'devant', ordre: 20, masque_sous_titres: true, oranges: [[debut + 1, debut + n]],
  sons_suggeres: sons,
  attendus: c.attendus.map(({ mi, ...a }) => a),
  origine: { natif: true, sur_mesure: `la multitude : captures d'articles sur téléphone (${pages.length} pages, ${new Set(SITES).size} sites inventés), « ${MOT} » fixe sur surligneur orange, coupes sèches de 2 à 4 images, traînées vers le bas, flash d'entrée`, gestes_repris: ['transition-flash (paliers 50 / 100 %)', 'text match cut', 'formats connus : page web mobile reproduite'] },
  params: { mot: MOT, pages: pages.length, vues: vues.length, durees },
}, c.page());
for (const a of avis) console.log(`AVIS ${a}`);
console.log(`PARTOUT ${ID} : images ${debut} à ${debut + n - 1} (${(n / FPS).toFixed(1)} s), « ${MOT} » fixe (bord gauche choisi par le navigateur entre x ${PT.mot.x.min} et ${PT.mot.x.max}), base ${PT.mot.base} ; ${vues.length} écrans (${pages.length} pages écrites, ${durees.join(' ')} images)`);
console.log(`Ensuite : verifier.mjs ${M} ${ID} --video <vidéo coupée>, puis calques.mjs.`);
