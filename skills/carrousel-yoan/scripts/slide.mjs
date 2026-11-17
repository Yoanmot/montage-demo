#!/usr/bin/env node
// slide.mjs : compose les slides d'un carrousel en HTML et les rend en PNG via Chrome headless.
// Le texte est EXACT par construction : il est posé en HTML, jamais généré par un modèle d'image,
// donc il ne dérive jamais (rectifier un mot = éditer le spec + relancer).
//
// AUCUNE valeur de style ne vit ici. Le CSS ci-dessous ne porte que la STRUCTURE (layout, grille,
// conteneurs, ordre d'empilement) ; couleurs, familles, tailles, graisses, marges, ombres et
// limites typographiques viennent toutes de ../da/theme.json (cf. theme.mjs et
// references/contrat-theme.md). Sans DA, le script refuse proprement.
// Copie autonome du moteur carrousel-image de Yoan (skill carrousel-yoan du studio) : seuls changent
// l'emplacement de la DA, les noms de sortie (slide-01.png...), un profil de navigateur à part, et
// l'auto-ajustement qui attend les polices (sinon les titres sortaient à moitié de leur taille).
//
// Usage : node slide.mjs <spec.json>
// spec.json : {
//   outdir: "/chemin/du/carrousel",        // absolu, ou relatif au dossier du spec
//   library: "/chemin/illustrations",      // optionnel : défaut : la bibliothèque (theme.mjs)
//   slides: [{
//     k: 1,
//     type: "hook" | "corps" | "statement" | "steps" | "cta",   // gabarits ÉDITORIAUX
//     kicker: "Micro-ligne au-dessus du titre.",                 // optionnel
//     titre: "Ligne une\n==ligne deux== ?",                      // ==x== = surlignage
//     sous: "Sous-ligne du hook ou du CTA.",                     // __x__ = soulignement
//     corps: ["Phrase lead.", "!!Punchline.", "Phrase support."],
//                       // 1re ligne = LEAD, suivantes = SUPPORT ; préfixe "!!" = PUNCH.
//                       // **gras** = payload scannable.
//     etapes: ["Étape une.", { "txt": "Étape deux.", "icon": "slug-biblio" }],
//                       // gabarit steps : rangées-cartes numérotées, icône = slug de la bibliothèque
//     apres: ["!!__Ligne d'action__ du CTA."],   // lignes rendues APRÈS l'illustration
//     illustration: "slug-biblio",               // optionnel : PNG détouré de la bibliothèque
//     illuHeight: 470,                           // hauteur de DÉPART (défaut : thème, par gabarit)
//     align: "gauche"                            // variante rail, si le thème la déclare
//   }]
// }
// Markup : ==x== surlignage · __x__ soulignement · **x** gras · \n saut de ligne · "!!" en tête
// d'une ligne de corps = punchline. Un marqueur ne peut PAS enjamber un \n (contrôlé).
// Sorties : <outdir>/slide-<kk>.png (k sur deux chiffres) + sources dans <outdir>/_src/ (slide-kk.html + spec.json).
// Une slide dont le titre déborde même à la taille plancher du thème, OU dont le cluster déborde
// encore après réduction de l'illustration au plancher, est REFUSÉE (✗, pas de PNG, exit ≠ 0).

import { readFile, writeFile, mkdir, unlink, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import {
  GABARITS, bibliotheque, dossierDA, chemin, chargerTheme, limitesDe,
  fichierPolice, fichierDA, urlFichier,
} from './theme.mjs';

const CANDIDATS_CHROME = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const specPath = process.argv[2];
if (!specPath) { console.error('Usage: node slide.mjs <spec.json>'); process.exit(1); }
const spec = JSON.parse(await readFile(specPath, 'utf8'));
if (!spec.outdir || !spec.slides?.length) { console.error('spec.outdir et spec.slides requis.'); process.exit(1); }

const typeOf = s => s.type || (s.k === 1 ? 'hook' : 'corps');

// ---------- DA, chemins ----------
let racine, T;   // racine = le dossier de la DA (../da), d'où se résolvent polices et fonds
try {
  racine = dossierDA();
  T = await chargerTheme(racine);
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
const baseSpec = dirname(resolve(specPath));
const outdir = chemin(spec.outdir, baseSpec);
const library = spec.library ? chemin(spec.library, baseSpec) : bibliotheque(racine);
const kk = k => String(k).padStart(2, '0');
const CHROME = CANDIDATS_CHROME.find(p => existsSync(p));
if (!CHROME) {
  console.error('✗ Chrome introuvable : installe Google Chrome ou renseigne CHROME_PATH.');
  process.exit(1);
}

// ---------- validation amont : tout échoue AVANT d'écrire le moindre fichier ----------
{
  const missing = [];
  for (const s of spec.slides) {
    if (s.k == null || !s.titre) { console.error(`✗ spec : slide ${s.k ?? '?'} : champs k et titre obligatoires.`); process.exit(1); }
    if (!GABARITS.includes(typeOf(s))) { console.error(`✗ spec : slide ${s.k} : type inconnu « ${typeOf(s)} » (attendu : ${GABARITS.join(' | ')}).`); process.exit(1); }
    if (s.align === 'gauche' && !(T.bloc.margesRail && T.texte.largeurMaxRail)) {
      console.error(`✗ spec : slide ${s.k} : align "gauche" demandé mais la DA ne déclare pas la variante rail (bloc.margesRail + texte.largeurMaxRail).`);
      process.exit(1);
    }
    for (const slug of [s.illustration, ...(s.etapes || []).map(e => typeof e === 'object' ? e.icon : null)]) {
      if (!slug) continue;
      if (!existsSync(resolve(library, `${slug}.png`))) missing.push(`${slug} (slide ${s.k})`);
    }
  }
  if (missing.length) {
    console.error(`✗ illustrations absentes de la bibliothèque (${library}) : ${missing.join(', ')}\n  → génère-les d'abord avec illustration.mjs, puis relance.`);
    process.exit(1);
  }
}

const srcDir = join(outdir, '_src');
await mkdir(srcDir, { recursive: true });
// le spec archivé reflète l'INTENTION du run : écrit avant la boucle pour rester cohérent même en cas d'échec
await writeFile(join(srcDir, 'spec.json'), JSON.stringify(spec, null, 2));

// ---------- markup ----------
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function rich(s) {
  return esc(s)
    .replace(/==(.+?)==/g, '<span class="selection"><span class="pg"></span>$1<span class="pd"></span></span>')
    .replace(/__(.+?)__/g, '<span class="lueur">$1</span>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\n/g, '<br>');
}
const words = s => (s || '').replace(/^!!/, '').replace(/==|__|\*\*/g, '').split(/\s+/).filter(Boolean).length;
const pairs = (s, re) => ((s || '').match(re) || []).length / 2;

// ---------- thème → CSS (la structure est ici, les valeurs viennent du thème) ----------
const px = v => (typeof v === 'number' ? `${v}px` : String(v));

function calquesDeFond(T) {
  const images = [], tailles = [];
  for (const c of T.fond.calques) {
    if (c.type === 'points') {
      images.push(`radial-gradient(circle, ${c.couleur} ${px(c.rayon)}, transparent ${px(c.rayon)})`);
      tailles.push(`${px(c.pas)} ${px(c.pas)}`);
    } else if (c.type === 'halo') {
      images.push(`radial-gradient(${c.etendue} at ${c.centre}, ${c.couleur} 0%, ${T.fond.couleur} ${c.arret}, ${c.bord} 100%)`);
      tailles.push('100% 100%');
    } else if (c.type === 'image') {
      // Le fond matiéré de la DA (dégradé + grain) est un PNG, pas un dégradé CSS : le grain
      // de la charte est un bruit 1 px, qu'aucune fonction CSS ne sait produire.
      images.push(`url("${urlFichier(fichierDA(c.fichier, racine))}")`);
      tailles.push(c.taille ?? 'cover');
    } else {
      throw new Error(`da/theme.json : calque de fond de type inconnu « ${c.type} » (attendus : points | halo | image).`);
    }
  }
  return images.length
    ? `background-image:${images.join(',')}; background-size:${tailles.join(',')};`
    : '';
}

function feuilleDeStyle(T) {
  const { canvas, marque, bloc, typo, texte, accents, illustration, steps } = T;
  const polices = (typo.polices || []).map(p => `
  @font-face { font-family:${p.famille}; src:url("${urlFichier(fichierPolice(p.fichier, racine))}");
               font-weight:${p.graisse ?? 400}; font-style:${p.style ?? 'normal'}; font-display:block; }`).join('');
  const rail = bloc.margesRail && texte.largeurMaxRail ? `
  /* variante rail : un seul axe de lecture à gauche, l'illustration reste centrée */
  #slide.rail .bloc { align-items:flex-start; text-align:left;
                      padding:${px(bloc.margesRail.haut)} ${px(bloc.margesRail.cotes)} ${px(bloc.margesRail.bas)}; }
  #slide.rail .texte { max-width:${px(texte.largeurMaxRail)}; }
  #slide.rail .illu-wrap { align-self:center; }` : '';

  return `${polices}
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:${px(canvas.largeur)}; height:${px(canvas.hauteur)}; overflow:hidden; }
  #slide {
    position:relative; width:${px(canvas.largeur)}; height:${px(canvas.hauteur)};
    background-color:${T.fond.couleur};
    ${calquesDeFond(T)}
    font-family:${typo.familles.corps}; text-align:center; color:${typo.couleur};
  }
  .marque {
    position:absolute; top:${px(marque.marge)}; left:0; right:0; z-index:2;
    font-family:${typo.familles.marque}; font-weight:${marque.graisse}; font-size:${px(marque.taille)};
    letter-spacing:${marque.interlettre}; color:${marque.couleur};
  }
  /* cluster centré verticalement : air égal haut/bas quel que soit le contenu */
  .bloc {
    position:absolute; inset:0; z-index:1;
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    padding:${px(bloc.marges.haut)} ${px(bloc.marges.cotes)} ${px(bloc.marges.bas)};
  }
  .kicker { font-family:${typo.familles.service ?? typo.familles.corps};
            font-size:${px(typo.kicker.taille)}; font-weight:${typo.kicker.graisse};
            letter-spacing:${typo.kicker.interlettre}; color:${typo.kicker.couleur};
            margin-bottom:${px(typo.kicker.margeBas)}; }
  .titre { font-family:${typo.familles.titre}; font-weight:${typo.titre.graisse};
           line-height:${typo.titre.interligne}; letter-spacing:${typo.titre.interlettre};
           text-transform:${typo.titre.casse ?? 'none'}; color:${typo.titre.couleur}; }
  .titre .tl { white-space:nowrap; }   /* les retours à la ligne sont ceux du script, jamais du moteur */
${GABARITS.map(g => `  .titre.${g} { font-size:${px(typo.titre.tailles[g])}; }`).join('\n')}
  /* la sous-ligne est calée sur le titre RENDU (ratio du thème) par l'auto-fit */
  .sous { font-family:${typo.familles.accent ?? typo.familles.corps};
          font-style:${typo.sous.style ?? 'normal'}; text-transform:${typo.sous.casse ?? 'none'};
          font-weight:${typo.sous.graisse}; letter-spacing:${typo.sous.interlettre};
          line-height:${typo.sous.interligne}; margin-top:${px(typo.sous.margeHaut)};
          color:${typo.sous.couleur}; text-wrap:balance; }
  /* corps à deux voix : lead (l'idée) / support (la preuve, atténué) ; le gras est le seul relief,
     la punchline la seule récompense : la hiérarchie est portée par les tokens, pas par le code */
  .texte { margin-top:${px(texte.margeHaut)}; max-width:${px(texte.largeurMax)}; }
  .texte.apres { margin-top:${px(texte.margeHautApres)}; }
  .texte.apres p.punch { margin-top:0; }
  .texte p { text-wrap:balance; letter-spacing:${texte.interlettre}; }
  .texte p + p { margin-top:${px(texte.interParagraphe)}; }
  .texte p.lead    { font-size:${px(typo.lead.taille)}; font-weight:${typo.lead.graisse};
                     line-height:${typo.lead.interligne}; color:${typo.lead.couleur}; }
  .texte p.support { font-size:${px(typo.support.taille)}; font-weight:${typo.support.graisse};
                     line-height:${typo.support.interligne}; color:${typo.support.couleur}; }
  .texte p.punch   { font-family:${typo.familles.titre}; font-size:${px(typo.punch.taille)};
                     font-weight:${typo.punch.graisse}; line-height:${typo.punch.interligne};
                     letter-spacing:${typo.punch.interlettre}; color:${typo.punch.couleur};
                     margin-top:${px(typo.punch.margeHaut)}; }
  .texte b, .sous b, .etape .txt b { font-weight:${typo.gras.graisse}; color:${typo.gras.couleur}; }
  /* rangées-cartes du gabarit steps */
  .etapes { margin-top:${px(steps.margeHaut)}; display:flex; flex-direction:column; gap:${px(steps.interCarte)}; }
  .etape { display:flex; align-items:center; gap:${px(steps.carte.gap)}; text-align:left;
           width:${px(steps.largeur)}; border:${px(steps.carte.epaisseurBord)} solid ${steps.carte.bord};
           border-top-color:${steps.carte.bordHaut}; border-radius:${px(steps.carte.rayon)};
           background:${steps.carte.fond}; backdrop-filter:${steps.carte.flou};
           box-shadow:${steps.carte.ombre}; padding:${steps.carte.padding}; }
  .etape .num { flex:none; width:${px(steps.numero.cote)}; height:${px(steps.numero.cote)};
                border-radius:${px(steps.numero.rayon)}; display:flex; align-items:center; justify-content:center;
                background:${steps.numero.fond}; border:${px(steps.numero.epaisseurBord)} solid ${steps.numero.bord};
                color:${steps.numero.couleur}; font-weight:${steps.numero.graisse}; font-size:${px(steps.numero.taille)}; }
  .etape .txt { flex:1; font-size:${px(steps.texte.taille)}; font-weight:${steps.texte.graisse};
                line-height:${steps.texte.interligne}; color:${steps.texte.couleur}; }
  .ico-box { flex:none; width:${px(steps.icone.largeurBoite)}; height:${px(steps.icone.hauteurBoite)};
             position:relative; display:flex; align-items:center; justify-content:center; }
  .ico-box::before { content:""; position:absolute; inset:${steps.icone.haloDebord}; background:${steps.icone.halo}; }
  .etape .ico { position:relative; max-height:${px(steps.icone.hauteurMax)}; max-width:${px(steps.icone.largeurMax)};
                width:auto; object-fit:contain; filter:${steps.icone.filtre}; }
  /* illustration : halo ambiant + ombre, identiques sur toutes les slides (le PNG est détouré en
     vrai alpha par illustration.mjs, le fond du template passe donc derrière l'objet) */
  .illu-wrap { position:relative; margin-top:${px(illustration.margeHaut)}; }
  .illu-wrap::before { content:""; position:absolute; inset:${illustration.haloDebord}; background:${illustration.halo}; }
  .illu { position:relative; display:block; max-width:${px(illustration.largeurMax)}; width:auto;
          object-fit:contain; filter:${illustration.ombre}; }
${rail}
  .selection { position:relative; background:${accents.surlignage.fond};
               padding:0 ${accents.surlignage.padding}; white-space:nowrap; }
  .selection::before, .selection::after { content:""; position:absolute;
               width:${px(accents.surlignage.epaisseurBord)}; background:${accents.surlignage.couleur};
               top:-.26em; bottom:-.10em; }
  .selection::before { left:-${px(accents.surlignage.epaisseurBord)}; }
  .selection::after  { right:-${px(accents.surlignage.epaisseurBord)}; top:-.10em; bottom:-.26em; }
  .selection .pg, .selection .pd { position:absolute; width:${accents.surlignage.poignee};
               height:${accents.surlignage.poignee}; background:${accents.surlignage.couleur}; border-radius:50%; }
  .selection .pg { left:-.19em; top:-.40em; }
  .selection .pd { right:-.19em; bottom:-.40em; }
  .lueur { position:relative; padding-bottom:3px; white-space:nowrap; }
  .lueur::after { content:""; position:absolute; left:0; right:0; bottom:-2px;
                  height:${px(accents.lueur.epaisseur)}; background:${accents.lueur.couleur};
                  border-radius:${px(accents.lueur.rayon)}; box-shadow:${accents.lueur.halo}; }
`;
}

const CSS = feuilleDeStyle(T);

function slideHtml(s) {
  const type = typeOf(s);
  const parts = [`<div class="marque">${esc(T.marque.texte)}</div>`, `<div class="bloc">`];
  if (s.kicker) parts.push(`<div class="kicker">${rich(s.kicker)}</div>`);
  const titreLines = s.titre.split('\n').map(l => `<span class="tl">${rich(l)}</span>`).join('<br>');
  parts.push(`<div class="titre ${type}">${titreLines}</div>`);
  if (s.sous) parts.push(`<div class="sous">${rich(s.sous)}</div>`);
  if (s.etapes?.length) parts.push(`<div class="etapes">${s.etapes.map((e, i) => {
    const txt = typeof e === 'string' ? e : e.txt;
    const ico = typeof e === 'object' && e.icon
      ? `<div class="ico-box"><img class="ico" src="${urlFichier(resolve(library, `${e.icon}.png`))}"></div>` : '';
    return `<div class="etape"><div class="num">${i + 1}</div><div class="txt">${rich(txt)}</div>${ico}</div>`;
  }).join('')}</div>`);
  const parasHtml = lines => {
    let leadDone = false;
    return lines.map(l => {
      const punch = l.startsWith('!!');
      let cls;
      if (punch) cls = 'punch';
      else if (!leadDone) { cls = 'lead'; leadDone = true; }
      else cls = 'support';
      return `<p class="${cls}">${rich(punch ? l.slice(2).trim() : l)}</p>`;
    }).join('');
  };
  if (s.corps?.length) parts.push(`<div class="texte">${parasHtml(s.corps)}</div>`);
  if (s.illustration) {
    const h = s.illuHeight || T.illustration.hauteurs[type];
    parts.push(`<div class="illu-wrap"><img class="illu" style="height:${px(h)}" src="${urlFichier(resolve(library, `${s.illustration}.png`))}"></div>`);
  }
  if (s.apres?.length) parts.push(`<div class="texte apres">${parasHtml(s.apres)}</div>`);
  parts.push(`</div>`);

  // auto-ajustement (mécanique du moteur ; ses BORNES viennent du thème) :
  // 1. le titre rétrécit jusqu'à tenir dans la largeur utile, plancher typo.titre.tailleMin ;
  // 2. la sous-ligne suit à typo.sous.ratioTitre du titre RENDU ;
  // 3. si le cluster déborde encore, on RÉDUIT l'illustration (jamais le texte : fidélité au
  //    script), plancher illustration.hauteurMin.
  // Débordement irréductible → le DOM est marqué OVERFLOW et le rendu est refusé côté node.
  const bornes = {
    largeurMax: Math.round(T.canvas.largeur * T.typo.titre.largeurMax),
    tailleMin: T.typo.titre.tailleMin,
    ratioSous: T.typo.sous.ratioTitre,
    illuMin: T.illustration.hauteurMin,
  };
  // Les mesures attendent que les polices de la DA soient chargées : mesuré avec la police de
  // secours, plus large, le titre rétrécissait à la moitié de sa taille (63 px au lieu de 120 pour un hook).
  const FIT = `<script>
    Promise.all([].map.call(document.fonts, function(f){ return f.load().catch(function(){}); })).then(function(){ return document.fonts.ready; }).then(function(){
      var B = ${JSON.stringify(bornes)};
      var t = document.querySelector('.titre');
      var fs = parseFloat(getComputedStyle(t).fontSize);
      var tooWide = function(){ return [].some.call(t.querySelectorAll('.tl'), function(e){ return e.getBoundingClientRect().width > B.largeurMax; }); };
      while (fs > B.tailleMin && tooWide()) { fs -= 1; t.style.fontSize = fs + 'px'; }
      var s = document.querySelector('.sous');
      if (s) s.style.fontSize = Math.round(fs * B.ratioSous) + 'px';
      if (tooWide()) { document.title = 'OVERFLOW'; return; }

      var bloc = document.querySelector('.bloc');
      var cs = getComputedStyle(bloc);
      var avail = bloc.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      var contentH = function(){
        var top = Infinity, bot = -Infinity, k = bloc.children;
        for (var i = 0; i < k.length; i++) { var r = k[i].getBoundingClientRect(); if (r.height === 0) continue; if (r.top < top) top = r.top; if (r.bottom > bot) bot = r.bottom; }
        return bot - top;
      };
      var illu = document.querySelector('.illu');
      if (illu) {
        var h = parseFloat(getComputedStyle(illu).height);
        while (h > B.illuMin && contentH() > avail) { h -= 12; illu.style.height = h + 'px'; }
      }
      if (contentH() > avail) document.title = 'OVERFLOW';
    });
  </script>`;
  const cls = s.align === 'gauche' ? ' class="rail"' : '';
  return `<meta charset="utf-8"><title>slide ${s.k}</title><style>${CSS}</style><div id="slide"${cls}>${parts.join('\n')}</div>${FIT}`;
}

// ---------- garde-fous éditoriaux (le script s'adapte à la slide, jamais l'inverse) ----------
// Le mécanisme est ici, les nombres viennent du thème : limites.commun surchargé par gabarit.
function checkLimits(s) {
  const type = typeOf(s);
  const L = limitesDe(T, type);
  const warn = m => console.warn(`  ⚠ slide ${s.k} (${type}) : ${m}`);

  const nT = words(s.titre), lignes = (s.titre.match(/\n/g) || []).length + 1;
  if (nT > L.titreMots) warn(`titre à ${nT} mots (DA : ≤ ${L.titreMots}) : raccourcir le script`);
  if (lignes > L.titreLignes) warn(`titre sur ${lignes} lignes (DA : ≤ ${L.titreLignes})`);
  if (s.kicker && words(s.kicker) > L.kickerMots) warn(`kicker à ${words(s.kicker)} mots (DA : ≤ ${L.kickerMots})`);
  if (s.sous && words(s.sous) > L.sousMots) warn(`sous-ligne à ${words(s.sous)} mots (DA : ≤ ${L.sousMots})`);

  if (s.corps?.length) {
    if (!L.corpsAutorise) warn(`corps sur un gabarit qui n'en porte pas (DA : titre + sous-ligne seulement)`);
    const leads = s.corps.filter(l => !l.startsWith('!!'));
    const punches = s.corps.filter(l => l.startsWith('!!'));
    if (leads[0] && words(leads[0]) > L.leadMots) warn(`lead à ${words(leads[0])} mots (DA : ≤ ${L.leadMots})`);
    const nSupport = leads.slice(1).reduce((n, l) => n + words(l), 0);
    if (nSupport > L.supportMots) warn(`support à ${nSupport} mots (DA : ≤ ${L.supportMots} au total)`);
    for (const p of punches) if (words(p) > L.punchMots) warn(`punch à ${words(p)} mots (DA : ≤ ${L.punchMots})`);
    if (punches.length > L.punchMax) warn(`${punches.length} punchlines (DA : ≤ ${L.punchMax})`);
  }
  if (s.sous && s.corps?.length && !L.sousAvecCorps) warn(`sous-ligne + corps = un niveau de texte de trop (DA) : choisir l'un des deux`);

  const etapesTxt = (s.etapes || []).map(e => typeof e === 'string' ? e : e.txt);
  if (s.etapes?.length && !L.etapesAutorisees) warn(`etapes sur un gabarit qui n'en porte pas (DA)`);
  if (L.etapesAutorisees && !s.etapes?.length) warn(`gabarit à étapes sans etapes`);
  if (etapesTxt.length > L.etapesMax) warn(`${etapesTxt.length} étapes (DA : ≤ ${L.etapesMax} rangées)`);
  for (const [i, e] of etapesTxt.entries()) if (words(e) > L.etapeMots) warn(`étape ${i + 1} à ${words(e)} mots (DA : ≤ ${L.etapeMots})`);

  // marqueurs non appariés par ligne (un marqueur ne peut pas enjamber un retour à la ligne)
  for (const [nom, val] of [['titre', s.titre], ['sous', s.sous], ['kicker', s.kicker], ['corps', (s.corps || []).join('\n')], ['apres', (s.apres || []).join('\n')], ['etapes', etapesTxt.join('\n')]]) {
    if (!val) continue;
    val.split('\n').forEach((l, i) => {
      for (const [m, re] of [['==', /==/g], ['__', /__/g], ['**', /\*\*/g]]) {
        if (((l.match(re) || []).length) % 2) warn(`marqueur ${m} non apparié (${nom}, ligne ${i + 1}) : il ne peut pas enjamber un retour à la ligne`);
      }
    });
  }

  // accents : comptés sur TOUT le texte de la slide (les numéraux des cartes et l'élément lumineux
  // d'une illustration sont structurels, ils ne comptent pas)
  const all = [s.kicker, s.titre, s.sous, (s.corps || []).join(' '), (s.apres || []).join(' '), etapesTxt.join(' ')].filter(Boolean).join(' ');
  const nSel = pairs(all, /==/g), nLueur = pairs(all, /__/g);
  if (nSel < L.surlignageMin) warn(`aucun surlignage (DA : ≥ ${L.surlignageMin} sur ce gabarit)`);
  if (nSel > L.surlignageMax) warn(`${nSel} surlignages (DA : ≤ ${L.surlignageMax})`);
  if (nLueur < L.lueurMin) warn(`aucun soulignement (DA : ≥ ${L.lueurMin} sur ce gabarit)`);
  if (nSel + nLueur > L.accentsMax) warn(`${nSel + nLueur} accents (DA : ≤ ${L.accentsMax} sur ce gabarit)`);
}

// Un profil de navigateur à part, effacé à la fin : jamais celui de l'utilisateur (son Chrome peut être ouvert).
const profil = await mkdtemp(join(tmpdir(), 'carrousel-yoan-'));
let ok = 0;
for (const s of spec.slides) {
  try {
    checkLimits(s);
    const htmlPath = join(srcDir, `slide-${kk(s.k)}.html`);
    await writeFile(htmlPath, slideHtml(s));
    const out = resolve(outdir, `slide-${kk(s.k)}.png`);
    const dom = execFileSync(CHROME, [
      '--headless=new', `--user-data-dir=${profil}`, '--no-first-run', '--no-default-browser-check',
      '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--virtual-time-budget=5000',
      `--screenshot=${out}`, `--window-size=${T.canvas.largeur},${T.canvas.hauteur}`, '--dump-dom',
      urlFichier(htmlPath),
    ], { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    if (dom.includes('<title>OVERFLOW</title>')) {
      await unlink(out).catch(() => {});
      console.error(`✗ slide ${s.k} : le contenu déborde même à la taille plancher de la DA : raccourcir la ligne du script (pas les marges)`);
      process.exitCode = 1;
      continue;
    }
    console.log(`✓ slide-${kk(s.k)}.png`);
    ok++;
  } catch (e) {
    console.error(`✗ slide ${s.k} : ${e.message}`);
    process.exitCode = 1;
  }
}
await rm(profil, { recursive: true, force: true }).catch(() => {});
console.log(`\nTerminé : ${ok}/${spec.slides.length} slide(s) dans ${outdir} (sources : _src/)`);
