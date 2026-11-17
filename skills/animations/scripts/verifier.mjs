#!/usr/bin/env node
// verifier.mjs : contrôle un calque d'animation avant de le passer au rendu.
//   1. style : aucune valeur hors du style (couleurs, police unique, courbes, rayons), aucun chemin absolu ;
//   2. HyperFrames lint ;
//   3. rendu de contrôle du calque (.mov avec transparence) et rendu « encre » (fonds .fd cachés) ;
//   4. image par image : zone sûre et 4 coins de l'encre, arrivées des éléments sur leurs mots (jamais avant) ;
//   4 bis. captions (meme-ligne.mjs) : dans les textes déclarés data-captions (sa phrase au fil de sa voix), les mots
//      d'une même ligne ont la même taille et la même police, toutes les couches de la même demande ensemble ;
//   4 ter. chaque mot dit ne s'affiche qu'une fois (lib/mots-affiches.mjs) : un mot montré par les sous-titres et par une
//      animation, ou par deux animations, est une erreur (MOT_DOUBLE, avec le mot et l'instant). Avec « --mots » à la
//      place de l'id : ce seul contrôle, sur toute la vidéo (à lancer après « sous-titres preparer »).
//   5. avec --video : aperçu posé sur la vidéo coupée (plan flou, décalé ou détouré, couche derrière trouée par le masque
//      de Romain) et planche des images clés à regarder.
// Les rendus de contrôle vont dans <dossier -montage>/animations/verif/<id>/ (jamais dans le calque).
//
// Usage : node verifier.mjs <dossier -montage> <id> [--video <video coupée>] [--sans-rendu]
//         node verifier.mjs <dossier -montage> --mots
// Codes : 0 conforme · 2 problème(s) listé(s) · 3 calque introuvable.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { S, ICI, geoSousTitres, reglagesSousTitres } from './lib/style.mjs';
import { controler as controlerLignes, phrase as phraseLignes } from './meme-ligne.mjs';
import { doublons, phraseDoublon } from './lib/mots-affiches.mjs';

const args = process.argv.slice(2);
const [dossier, id] = args;
if (dossier && id === '--mots') {
  if (!fs.existsSync(path.join(dossier, 'words.cut.json'))) { console.log(`words.cut.json absent de ${dossier}`); process.exit(3); }
  const r = doublons(dossier);
  for (const a of r.avis) console.log(`NOTE ${a}`);
  if (r.sousTitresAbsents) console.log('NOTE pas de calque de sous-titres (calques/st) : seules les animations sont comparées');
  for (const d of r.doublons) console.log(`PROBLÈME MOT_DOUBLE ${phraseDoublon(d)}`);
  if (r.doublons.length) { console.log(`${r.doublons.length} mot(s) affiché(s) deux fois. Les mots qu'une animation reprend sortent des sous-titres : déclare-les dans mots_repris du calque (ecrireCalque) ou passe-les en { mots } (instancier), puis relance « sous-titres preparer ».`); process.exit(2); }
  console.log('CONFORME aucun mot affiché deux fois');
  process.exit(0);
}
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const video = opt('--video'), sansRendu = args.includes('--sans-rendu');
const dc = path.join(dossier || '', 'calques', id || '');
if (!dossier || !id || !fs.existsSync(path.join(dc, 'index.html'))) { console.log('Usage : node verifier.mjs <dossier -montage> <id> [--video <video coupée>] [--sans-rendu]'); process.exit(3); }
const fiche = JSON.parse(fs.readFileSync(path.join(dc, 'calque.json'), 'utf8'));
const html = fs.readFileSync(path.join(dc, 'index.html'), 'utf8');
const vd = path.join(dossier, 'animations', 'verif', id);
fs.mkdirSync(vd, { recursive: true });
const pb = [], notes = [];
const FF = fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';
const HF = ['--yes', 'hyperframes@0.7.55'];

// ------------------------------------------------------------------ 1. style
const gab = fiche.origine && fiche.origine.gabarit;
const NATIFS = ['recherche-google', 'tier-list', 'cta-champ-instagram'];   // formats recopiés : leurs propres couleurs
const hex2 = (h) => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(','); };
const permises = new Set([
  ...Object.values(S.COULEURS), ...Object.values(S.NATIF), S.COMPARAISON.gris, S.ANATOMIE.gris, S.MINUTEUR.barre.couleurSeparation,
  ...S.TIER.rangs.map((r) => r[1]), S.TIER.fond, S.TIER.noir, '#000', '#fff', ...Object.values(S.MATIERES || {}), ...Object.values(S.DESSIN || {}),
].map(hex2));
permises.add(S.VOILE.teinte.join(','));
// natif : format réel reproduit à l'identique (Yoan, 2026-11-12) : ses couleurs, ses coins arrondis et la police
// système d'Apple sont les siens (l'appli Calendrier, un écran d'iPhone). Les calques se rendent sur le Mac de Romain,
// qui a cette police.
const natif = NATIFS.includes(gab) || (fiche.origine && fiche.origine.natif === true);
// Un « #b84 » qui nomme un élément du calque (id="b84", sélecteur '#b84' dans le script) n'est pas une couleur.
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
if (!natif) {
  const vues = new Set();
  for (const m of html.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b(?![\w-])/g)) {
    if (ids.has(m[1]) || /id=|href=/.test(html.slice(Math.max(0, m.index - 4), m.index))) continue;
    vues.add(hex2(m[0]));
  }
  for (const m of html.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) vues.add(`${+m[1]},${+m[2]},${+m[3]}`);
  for (const c of vues) if (!permises.has(c)) pb.push(`STYLE couleur hors palette : rgb(${c})`);
}
// Police unique (Yoan, 2026-11-14) : tout texte de la vidéo est dans POLICES.sousTitres. Seuls un format réel reproduit
// (calque natif, ou partie marquée data-natif d'un effet : pages de journaux, une appli) garde la police du vrai.
const police = S.POLICES.sousTitres.family;
const partieNative = /\bdata-natif\b/.test(html);
// Polices : la première famille de chaque déclaration, écrite entre apostrophes, entre guillemets ou sans rien (CSS
// font-family et raccourci font, style en ligne, fontFamily en JS), hors des @font-face (qui déclarent sans employer).
// Les familles génériques de secours qui suivent (sans-serif…) ne comptent pas ; une générique seule ou en premier est
// refusée (le navigateur choisirait la police).
const GENERIQUES = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded', '-apple-system', 'blinkmacsystemfont', 'inherit', 'initial', 'unset', 'revert']);
const premiereFamille = (liste) => liste.split(',')[0].trim().replace(/^\\?["']|\\?["']$/g, '').replace(/\s+/g, ' ').trim();
const policesVues = [];
const htmlSansFace = html.replace(/@font-face\s*\{[^}]*\}/g, '');
for (const m of htmlSansFace.matchAll(/font-family\s*:\s*([^;}<]+)/gi)) policesVues.push(premiereFamille(m[1]));
for (const m of htmlSansFace.matchAll(/fontFamily\s*[:=]\s*(["'`])([^"'`]+)\1/g)) policesVues.push(premiereFamille(m[2]));
for (const m of htmlSansFace.matchAll(/(?<![\w-])font\s*:\s*([^;}<]+)/gi)) {
  const f = m[1].match(/[\d.]+(?:px|em|rem|%)(?:\s*\/\s*[\d.]+(?:px|em|rem|%)?)?\s+(.+)$/);
  if (f) policesVues.push(premiereFamille(f[1]));
}
for (const f of new Set(policesVues)) {
  if (!f || f === police) continue;
  if (GENERIQUES.has(f.toLowerCase())) { if (!natif || !['-apple-system', 'system-ui', 'blinkmacsystemfont'].includes(f.toLowerCase())) pb.push(`STYLE police générique en premier : ${f} (le navigateur choisirait la police)`); continue; }
  // Un format réel reproduit garde la police du vrai (Georgia d'une une de journal, Roboto de Google, Liberation de TierMaker).
  if (natif) continue;
  if (partieNative) { notes.push(`police ${f} : admise seulement dans la partie data-natif (format réel reproduit), à regarder`); continue; }
  pb.push(`STYLE police hors style : ${f} (une seule police dans la vidéo : ${police}, POLICES.sousTitres)`);
}
if (!natif && /-apple-system|system-ui|BlinkMacSystemFont|SF Pro/.test(html)) pb.push('STYLE police système (réservée à un format réel reproduit à l\'identique : origine.natif dans calque.json)');
if (/font-style\s*:\s*italic/i.test(html) && /Georgia|Times|Playfair|Fraunces|Bodoni|Instrument Serif|DM Serif|serif['"\s,;]/i.test(html.replace(/sans-serif/gi, ''))) pb.push('STYLE serif en italique : interdite partout, même dans un format réel (Yoan)');
const courbes = new Set([...Object.values(S.COURBES), 'power2.inOut', 'power3.inOut', 'sine.inOut', 'expo.out', 'power3.in', 'power2.in', 'power1.in', 'power2.out', 'power3.out']);
for (const m of html.matchAll(/duration:\s*([\d.]+),\s*ease:\s*'([^']+)'/g)) {
  if (m[2] === 'none' && +m[1] > 0.1) pb.push(`STYLE mouvement linéaire de ${m[1]} s (seule la sortie du faisceau, 0,09 s, l'est)`);
  else if (m[2] !== 'none' && !courbes.has(m[2])) pb.push(`STYLE courbe hors style : ${m[2]}`);
}
for (const m of html.matchAll(/ease:\s*'((back|elastic|bounce)[^']*)'/g)) if (m[1] !== S.COURBES.ressortObjet) pb.push(`STYLE rebond interdit : ${m[2]}`);   // seul le ressort des objets (COURBES.ressortObjet) passe
const rayons = new Set([...Object.values(S.RAYONS), S.LIGNE_CARTE.rayon, S.CHAPITRE.rayon, S.SUPERSET.barreRayon, S.SCHEMA.cadre.rayon, 0].map(String));
if (!natif) for (const m of html.matchAll(/border-radius:\s*([^;"]+)/g)) for (const v of m[1].trim().split(/\s+/)) {
  const n = v.replace('px', '');
  if (v.endsWith('%') || v === 'inherit' || v === `${S.SOUS_TITRES.pave.rayon}em`) continue;   // pavé des sous-titres : rayon en fraction de la taille
  if (!rayons.has(String(+n))) pb.push(`STYLE rayon hors style : ${v}`);
}
// Sous-titres enrichis (conteneur data-enrichi) : 1,0 à 1,2 x la taille des sous-titres au plus (ENRICHI.max, Yoan
// 2026-11-14, retour sur v13 : « ça doit juste ressortir un peu, pas sauter aux yeux »)
if (/\bdata-enrichi\b/.test(html)) {
  const pxST = geoSousTitres(reglagesSousTitres(dossier)).px, maxi = S.ENRICHI.max * pxST;
  for (const m of html.matchAll(/class="w [^"]*" style="[^"]*font-size:([\d.]+)px/g)) {
    if (+m[1] > maxi + 0.5) pb.push(`ENRICHI taille ${m[1]} px : au-delà de ${S.ENRICHI.max} x les sous-titres (${pxST} px, plafond ${Math.round(maxi)} px)`);
  }
}
if (/(\/Users\/|file:\/\/|[A-Z]:\\\\)/.test(html)) pb.push('STYLE chemin absolu dans le calque (le Mac de Romain ne l\'aura pas)');
if (/src="\.\.\//.test(html) || /url\('\.\.\//.test(html)) pb.push('chemin qui sort du dossier du calque (rendu noir ou muet)');
for (const f of [...html.matchAll(/(?:src="|url\(')([^"')]+)/g)].map((m) => m[1]).filter((u) => !/^(data:|https?:)/.test(u))) {
  if (!fs.existsSync(path.join(dc, f))) pb.push(`fichier manquant dans le calque : ${f}`);
}
const dur = +html.match(/data-duration="([\d.]+)"/)[1];
if (Math.abs(dur * 30 - fiche.images) > 0.01) pb.push(`durée du HTML (${dur} s) différente de calque.json (${fiche.images} images)`);
if (fiche.a_fournir.length) notes.push(`photos à demander à Romain : ${fiche.a_fournir.join(' ; ')}`);
// Titre qui suit le dézoom d'ouverture (suit_ouverture dans calque.json) : pendant le dézoom (caméra de 120 % à 100 %) il
// grossit avec elle et dépasse la zone sûre, c'est voulu. La zone se contrôle à partir de l'image où le dézoom est fini
// (ouverture.json de la brique zooms : « images »), là où il doit couvrir la zone sûre comme le gabarit.
let zoneDes = 0;
if (fiche.suit_ouverture) {
  const fo = path.join(dossier, 'ouverture.json');
  if (!fs.existsSync(fo)) pb.push('suit_ouverture sans ouverture.json : prépare d\'abord le zoom « ouverture » (brique zooms)');
  else {
    zoneDes = Math.max(0, JSON.parse(fs.readFileSync(fo, 'utf8')).images - fiche.debut);
    if (zoneDes >= fiche.images) { pb.push(`le calque part (image ${fiche.debut + fiche.images}) avant la fin du dézoom (image ${fiche.debut + zoneDes}) : la zone sûre ne peut pas se contrôler à 100 %`); zoneDes = 0; }
    else notes.push(`suit le dézoom d'ouverture : zone sûre contrôlée à partir de l'image ${zoneDes} du calque (dézoom fini)`);
  }
}

// ------------------------------------------------------------------ 1 bis. captions : même ligne = même taille, même police
// Textes déclarés data-captions (sa phrase au fil de sa voix : sous-titres enrichis, plein écran texte qui suit sa voix).
// Toutes les couches de la même demande (a01-derriere + a01-devant), alignées sur la vidéo coupée, contrôlées ensemble.
let captions = null;
if (!natif) try {
  const freres = fs.readdirSync(path.join(dossier, 'calques')).map((d) => path.join(dossier, 'calques', d, 'calque.json'))
    .filter((f) => fs.existsSync(f)).map((f) => [path.dirname(f), JSON.parse(fs.readFileSync(f, 'utf8'))])
    .filter(([, c]) => c.id === fiche.id || (fiche.demande && c.demande === fiche.demande));
  captions = await controlerLignes(freres.map(([d]) => path.join(d, 'index.html')), { decalages: freres.map(([, c]) => c.debut) });
  const qui = freres.map(([, c]) => c.id).join(' + ');
  if (!captions.conforme) pb.push(`LIGNE captions à tailles ou polices mêlées sur ${qui} : ${phraseLignes(captions)}. Sur une même ligne, tous les mots ont la même taille et la même police ; pour faire ressortir des mots, mets-les sur leur propre ligne (STYLE.md, « Captions »).`);
  else if (captions.declare) notes.push(`captions sur ${qui} : ${phraseLignes(captions)}`);
} catch (e) { pb.push(`LIGNE captions non contrôlées : ${e.message.split('\n')[0]}`); }

// ------------------------------------------------------------------ 1 ter. un mot dit ne s'affiche qu'une fois
try {
  if (fs.existsSync(path.join(dossier, 'words.cut.json'))) {
    const r = doublons(dossier);
    const moi = fiche.demande || id;
    for (const d of r.doublons) if (d.sources.some((x) => x.startsWith(`${moi} `) || x.startsWith(`${id} `))) pb.push(`MOT_DOUBLE ${phraseDoublon(d)}`);
    for (const a of r.avis) notes.push(a);
  }
} catch (e) { notes.push(`mots affichés deux fois non contrôlés : ${e.message.split('\n')[0]}`); }

// ------------------------------------------------------------------ 2. lint
const lint = spawnSync('npx', [...HF, 'lint'], { cwd: dc, encoding: 'utf8' });
const lintTxt = (lint.stdout || '') + (lint.stderr || '');
const nErr = (lintTxt.match(/(\d+) error/) || [0, lint.status ? 1 : 0])[1];
if (+nErr > 0) pb.push(`lint HyperFrames : ${nErr} erreur(s)\n${lintTxt.trim().split('\n').slice(-12).join('\n')}`);

// ------------------------------------------------------------------ 3-5. rendus et contrôles image par image
let analyse = null;
if (!sansRendu && !pb.some((p) => p.startsWith('lint'))) {
  const mov = path.join(vd, 'calque.mov');
  const rendre = (src, out) => {
    const r = spawnSync('npx', [...HF, 'render', '.', '--format', 'mov', '-w', '1', '-q', 'high', '-o', path.resolve(out)], { cwd: src, encoding: 'utf8' });
    if (r.status !== 0 || !fs.existsSync(out)) throw new Error(`rendu impossible : ${(r.stdout + r.stderr).trim().split('\n').slice(-6).join(' | ')}`);
  };
  try {
    rendre(dc, mov);
    // Rendu « encre » : sans les fonds (.fd) ni les objets qui sortent du cadre exprès (.objet : pièce qui tombe,
    // post-it qui glisse, objet qui entre par le bord). La zone sûre et les arrivées se mesurent sur le reste (texte,
    // cartes, marques). Un texte ne porte jamais la classe objet.
    let encre = mov;
    const classe = (c) => new RegExp(`class="(?:[^"]*\\s)?${c}(?:\\s[^"]*)?"`).test(html);
    if (classe('fd') || classe('objet')) {
      const ed = path.join(vd, 'encre-src');
      fs.rmSync(ed, { recursive: true, force: true });
      fs.cpSync(dc, ed, { recursive: true });
      fs.writeFileSync(path.join(ed, 'index.html'), html.replace('</style>', '\n.fd,.objet{visibility:hidden !important;}</style>'));
      encre = path.join(vd, 'encre.mov');
      rendre(ed, encre);
      fs.rmSync(ed, { recursive: true, force: true });
    }
    const sansZone = gab && ['transition-faisceau', 'transition-flash', 'recherche-google'].includes(gab);
    const out = execFileSync('python3', [path.join(ICI, 'verifier.py'), 'analyse', encre, path.join(dc, 'calque.json'), path.join(vd, 'analyse.json'), ...(sansZone ? ['--sans-zone'] : []), ...(zoneDes ? ['--zone-des', String(zoneDes)] : [])], { encoding: 'utf8' });
    console.log(out.trim());
    analyse = JSON.parse(fs.readFileSync(path.join(vd, 'analyse.json'), 'utf8'));
    // entrée « coup de poing » des sous-titres enrichis (échelle 1,3 -> 1 en 0,2 s, STYLE.md) : une ligne large déborde
    // pendant ses premières images, c'est voulu ; calque.json entrees_echelle = [[image de début, image de fin], ...]
    const tol = fiche.entrees_echelle || [];
    const dedans = (i) => tol.some(([a, b]) => i >= a && i <= b);
    const tolerees = analyse.hors_zone.filter((h) => dedans(h.image));
    if (tolerees.length) {
      notes.push(`zone sûre dépassée pendant l'entrée « coup de poing » (échelle 1,3), voulu : images ${tolerees.map((h) => h.image).join(', ')} du calque`);
      analyse.hors_zone = analyse.hors_zone.filter((h) => !dedans(h.image));
      analyse.nb_hors_zone -= tolerees.length;
    }
    if (analyse.nb_hors_zone) pb.push(`ZONE ${analyse.nb_hors_zone} image(s) avec de l'encre hors zone sûre (x ${S.ZONE_SURE.x0}-${S.ZONE_SURE.x1}, y ${S.ZONE_SURE.y0}-${S.ZONE_SURE.y1}), première : image ${analyse.hors_zone[0].image} boîte ${analyse.hors_zone[0].boite}`);
    for (const a of analyse.attendus) {
      if (a.avant_son_mot) pb.push(`CALAGE ${a.nom} visible à l'image ${fiche.debut + (a.detectee ?? a.image)} avant son mot (image ${a.mot_image})`);
      if (a.detectee === null) notes.push(`${a.nom} : arrivée non détectée à ±2 images de l'image ${a.image} (élément qui glisse ou déjà là : à regarder sur la planche)`);
    }
    if (analyse.arrivees_imprevues.length) notes.push(`encre neuve non prévue aux images ${analyse.arrivees_imprevues.join(', ')} du calque (à regarder)`);
    if (video) {
      const o = execFileSync('python3', [path.join(ICI, 'verifier.py'), 'apercu', video, mov, path.join(dc, 'calque.json'), path.join(vd, 'apercu.mp4'), path.join(vd, 'planche.png'), FF], { encoding: 'utf8', maxBuffer: 1 << 26 });
      console.log(o.trim());
    }
  } catch (e) { pb.push(e.message.split('\n')[0]); }
}

const rapport = { id, conforme: pb.length === 0, problemes: pb, notes, captions, analyse: analyse && { coins: analyse.coins, boite_totale: analyse.boite_totale },
  apercu: video ? path.join(vd, 'apercu.mp4') : null, planche: video ? path.join(vd, 'planche.png') : null };
fs.writeFileSync(path.join(vd, 'rapport.json'), JSON.stringify(rapport, null, 2) + '\n');
for (const n of notes) console.log(`NOTE ${n}`);
if (analyse && analyse.coins) console.log(`COINS de l'encre : ${Object.entries(analyse.coins).map(([k, v]) => `${k} ${v.join(',')}`).join(' ; ')}`);
if (pb.length) { for (const p of pb) console.log(`PROBLÈME ${p}`); process.exit(2); }
console.log(`CONFORME ${id}${video ? ` : regarde ${rapport.planche} et ${rapport.apercu}` : ''}`);
