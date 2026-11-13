#!/usr/bin/env node
// Sous-titres d'une vidéo coupée par couper-silences, au style verrouillé des reels de Romain (bibliothèque
// sous-titres : classique avec pavé orange qui glisse, ou formelle avec mots forts). Rien ne part sur un serveur.
//
//   node sous-titres.mjs texte <dossier>      écrit texte-sous-titres.md : le texte, chaque mot précédé de son numéro
//   node sous-titres.mjs preparer <dossier>   lit sous-titres.json (style, corrections, groupes, mots forts), écrit le
//                                             calque calques/st/ (projet HyperFrames prêt à rendre) et son entrée
//                                             dans calques.json (source « sous-titres », ordre 100)
//
// <dossier> = le dossier <nom>-montage de la vidéo. Base de temps : la vidéo coupée, 30 images par seconde.
// Le gabarit vient de ../animations/bibliotheque/sous-titres/devant/index.html (skill voisin). Pour les tests
// seulement, la variable d'environnement SOUS_TITRES_BIBLIOTHEQUE peut désigner un autre dossier bibliotheque/.
//
// Codes de sortie : 0 ok · 1 usage · 2 fichier introuvable · 9 gabarit inattendu · 13 sous-titres.json à corriger
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FPS = 30;
const LARGEUR_MAX = 899;        // SOUS_TITRES x 91 à 990
const MARGE_MESURE = 0.98;      // la mesure ignore le crénage : 2 % de marge
const MOTS_MAX_FORMELLE = 3;    // SOUS_TITRES.motsParGroupe
const PAUSE = 0.25;             // s : pause marquée « / » dans le texte numéroté

// Chasses mesurées (unités pour 1000) : Bricolage Grotesque opsz 96 wght 800, Big Shoulders Display wght 900.
const CHASSE_TEXTE = {"a":543,"b":576,"c":539,"d":576,"e":537,"f":376,"g":549,"h":562,"i":234,"j":244,"k":541,"l":234,"m":860,"n":562,"o":567,"p":574,"q":574,"r":400,"s":517,"t":368,"u":557,"v":530,"w":799,"x":543,"y":539,"z":483,"à":543,"â":543,"ä":543,"ç":539,"é":537,"è":537,"ê":537,"ë":537,"î":234,"ï":234,"ô":567,"ö":567,"ù":557,"û":557,"ü":557,"ÿ":539,"œ":928,"æ":858,"0":594,"1":310,"2":551,"3":565,"4":607,"5":565,"6":592,"7":498,"8":608,"9":603,"'":174,"’":193,"-":313,".":246,",":193,";":235,":":250,"!":268,"?":396,"…":757,"«":466,"»":466,"\"":340,"(":303,")":303,"%":948,"/":349,"+":486,"&":697,"€":680,"$":575,"°":342," ":203};
const CHASSE_TITRE = {"A":478,"B":473,"C":490,"D":495,"E":408,"F":406,"G":493,"H":485,"I":230,"J":453,"K":497,"L":402,"M":745,"N":543,"O":497,"P":471,"Q":497,"R":477,"S":474,"T":419,"U":487,"V":494,"W":800,"X":471,"Y":465,"Z":418,"À":478,"Â":478,"Ä":478,"Ç":490,"É":408,"È":408,"Ê":408,"Ë":408,"Î":230,"Ï":230,"Ô":497,"Ö":497,"Ù":487,"Û":487,"Ü":487,"Ÿ":465,"Œ":681,"Æ":684,"0":507,"1":274,"2":490,"3":504,"4":511,"5":515,"6":499,"7":485,"8":501,"9":499,"'":203,"’":251,"-":446,".":250,",":251,";":251,":":250,"!":250,"?":480,"…":700,"%":682," ":220};

const ici = path.dirname(fileURLToPath(import.meta.url));
const say = (m) => process.stdout.write(m + '\n');
function fail(code, m) { say(m); process.exit(code); }
const lire = (p) => fs.readFileSync(p, 'utf8');
const ecrire = (p, t) => fs.writeFileSync(p, t, 'utf8');

// ---------------------------------------------------------------- les mots de la vidéo coupée
function mots(w) {
  const p = path.join(w, 'words.cut.json');
  if (!fs.existsSync(p)) fail(2, `TEXTE_INTROUVABLE : lance d'abord le skill couper-silences sur cette vidéo (il manque words.cut.json dans ${w}).`);
  return JSON.parse(lire(p)).words;
}
// Ce qui s'affiche d'un mot : sans guillemets ni ponctuation autour (le style retire la ponctuation de fin).
const affiche = (t) => String(t).trim().replace(/^[«"“(\s]+/, '').replace(/[.,;:!?…»"”)\s]+$/, '');
const finDePhrase = (t) => /[.!?…]\s*[»"”)]?\s*$/.test(String(t).trim());

// Images de la vidéo coupée : somme des morceaux gardés de filtre.txt
function imagesCoupees(w) {
  const f = path.join(w, 'filtre.txt');
  if (fs.existsSync(f)) {
    let n = 0;
    for (const m of lire(f).matchAll(/trim=start_frame=(\d+):end_frame=(\d+)/g)) n += Number(m[2]) - Number(m[1]);
    if (n > 0) return n;
  }
  const e = path.join(w, 'edl.json');
  if (fs.existsSync(e)) { const s = JSON.parse(lire(e)).stats; if (s && s.out_frames) return s.out_frames; }
  fail(2, `COUPES_INTROUVABLES : il manque filtre.txt dans ${w} (relance la compilation des coupes).`);
}

// ---------------------------------------------------------------- texte
function cmdTexte(w) {
  const W = mots(w);
  const lignes = ['# Texte des sous-titres, chaque mot précédé de son numéro',
    '# « / » = pause de plus de 0,25 s avant le mot. Les signes seuls (« ? », « : », guillemets) ne s\'affichent pas.', ''];
  let ligne = [], prec = null;
  W.forEach((m, i) => {
    const t = String(m.text).trim();
    if (!t) return;
    const pause = prec !== null && m.start - prec >= PAUSE ? '/ ' : '';
    ligne.push(`${pause}[${i}]${t}`);
    prec = m.end;
    if (finDePhrase(t)) { lignes.push(ligne.join(' ')); ligne = []; }
  });
  if (ligne.length) lignes.push(ligne.join(' '));
  const out = path.join(w, 'texte-sous-titres.md');
  ecrire(out, lignes.join('\n') + '\n');
  say(`PRÊT texte=${out} mots=${W.length}`);
}

// ---------------------------------------------------------------- mesure d'une ligne (px vidéo)
function largeurTexte(txt, style) {
  const t = txt.toLowerCase(), k = 66 / 1000;
  let l = 0;
  for (const c of t) l += (CHASSE_TEXTE[c] ?? 560) * k - 0.012 * 66;   // approche -0,012 em
  const nMots = t.split(' ').length;
  if (style === 'classique') l += (nMots - 1) * (-0.14 * 66) + nMots * 14;   // mots resserrés, pavé (14 px de chaque côté, marge -7)
  return l;
}
const largeurFort = (txt) => { let l = 0; for (const c of txt.toUpperCase()) l += (CHASSE_TITRE[c] ?? 480) * 128 / 1000; return l; };

// ---------------------------------------------------------------- bibliothèque et gabarit
function bibliotheque() {
  const essais = [process.env.SOUS_TITRES_BIBLIOTHEQUE, path.resolve(ici, '..', '..', 'animations', 'bibliotheque')].filter(Boolean);
  for (const b of essais) if (fs.existsSync(path.join(b, 'sous-titres', 'devant', 'index.html'))) return b;
  fail(2, `BIBLIOTHEQUE_INTROUVABLE : le skill animations (et sa bibliotheque/) doit être installé à côté de ce skill (cherché : ${essais.join(' ; ')}).`);
}

// Formelle : le gabarit gère un seul mot fort. Cette version en gère plusieurs, à la même règle : chaque mot fort part
// avec la ligne affichée à la fin de sa phrase, à la fin du dernier mot de la phrase.
const FORMELLE_ORIGINE_DEBUT = "} else {\n  const F = P.motFort, fort = F ? gr[F.groupe] : null;";
const FORMELLE_ORIGINE_FIN = "\ntl.set({}, {}, N / FPS);";
const FORMELLE = `} else {
  // (brique sous-titres) motFort : null, un objet { groupe, finPhrase } ou une liste de ces objets.
  const FS = P.motFort ? [].concat(P.motFort) : [];
  const forts = new Set(FS.map((F) => F.groupe));
  const lignes = gr.filter((_, k) => !forts.has(k));
  const fins = FS.map((F) => img(P.mots[F.finPhrase].e));
  lignes.forEach((g, gi) => {
    const id = \`g\${gr.indexOf(g)}\`;   // numéro du groupe d'origine (P.caches s'y réfère)
    const d = document.createElement('div'); d.className = 'sub'; d.id = id;
    d.textContent = g.mots.map((m) => propre(m.w)).join(' ');
    root.appendChild(d);
    const on = img(g.mots[0].s);
    let off = gi < lignes.length - 1 ? img(lignes[gi + 1].mots[0].s) : N;
    for (const fp of fins) if (on < fp && fp < off) off = fp;   // la ligne affichée en fin de phrase part avec le mot fort
    tl.set(\`#\${id}\`, { visibility: 'hidden' }, 0); tl.set(\`#\${id}\`, { visibility: 'visible' }, tImg(on)); tl.set(\`#\${id}\`, { visibility: 'hidden' }, tImg(off));
  });
  if (FS.length) {
    // bas des capitales du mot fort = haut des minuscules hautes de la ligne - ecart
    const baseLigne = ST.centreY - ST.interligne * ST.taille / 2 + (GEO.base_texte + (ST.interligne - GEO.interligne_texte) / 2) * ST.taille;
    const top = baseLigne - 0.70 * ST.taille - FORT.ecart - GEO.base_titre * FORT.taille;
    const R = reglages(GEO.cap_titre * FORT.taille);
    FS.forEach((F, fi) => {
      const fort = gr[F.groupe], id = \`fort\${fi}\`;
      const d = document.createElement('div'); d.className = 'a ti c-cr dure'; d.id = id; d.dataset.groupe = F.groupe;
      d.style.cssText = \`left:91px;width:899px;text-align:center;top:\${top.toFixed(1)}px;font-size:\${FORT.taille}px\`;
      d.textContent = fort.mots.map((m) => propre(m.w)).join(' ');
      root.appendChild(d);
      const t = fort.mots[0].s - AV;
      tl.fromTo(\`#\${id}\`, { y: R.dy }, { y: 0, duration: R.dM, ease: 'power3.out', immediateRender: true }, t);
      tl.fromTo(\`#\${id}\`, { opacity: 0 }, { opacity: 1, duration: R.dO, ease: 'power2.out', immediateRender: true }, t);
      tl.fromTo(\`#\${id}\`, { filter: \`blur(\${R.flou}px)\` }, { filter: 'blur(0px)', duration: R.dF, ease: 'power2.out', immediateRender: true }, t);
      tl.set(\`#\${id}\`, { visibility: 'hidden' }, tImg(fins[fi]));
    });
  }
}
// (brique sous-titres) Calques marqués masque_sous_titres dans calques.json. P.caches : groupes qui apparaîtraient
// pendant le calque, retirés en entier. P.coupes : groupes déjà affichés à l'entrée du calque, coupés net à son
// image d'entrée (ligne, pavé et mot fort), sans revenir à sa sortie.
for (const k of P.caches || []) document.querySelectorAll(\`#g\${k}, #p\${k}, [data-groupe="\${k}"]\`).forEach((e) => { e.style.display = 'none'; });
for (const c of P.coupes || []) {
  const sel = [\`#g\${c.groupe}\`, \`#p\${c.groupe}\`, \`[data-groupe="\${c.groupe}"]\`].filter((q) => document.querySelector(q)).join(', ');
  if (sel) tl.set(sel, { display: 'none' }, tImg(c.image));
}`;

function calque(bib, P, images, sortie) {
  let html = lire(path.join(bib, 'sous-titres', 'devant', 'index.html'));
  const attendu = (ok, quoi) => { if (!ok) fail(9, `GABARIT_INATTENDU : le gabarit des sous-titres a changé (${quoi}). Préviens Yoan.`); };
  const reP = /const P = \{[\s\S]*?\n\};\n/;
  attendu(reP.test(html), 'paramètres P');
  html = html.replace(reP, () => `const P = ${JSON.stringify(P)};\n`);
  attendu(/data-duration="[\d.]+"/.test(html), 'data-duration');
  html = html.replace(/data-duration="[\d.]+"/, `data-duration="${(images / FPS).toFixed(4)}"`);
  const a = html.indexOf(FORMELLE_ORIGINE_DEBUT), b = html.indexOf(FORMELLE_ORIGINE_FIN);
  attendu(a > 0 && b > a, 'partie formelle');
  html = html.slice(0, a) + FORMELLE + html.slice(b);
  attendu(html.includes("'../../fonts/") && html.includes('../../vendor/gsap.min.js'), 'chemins des polices');
  html = html.split("'../../fonts/").join("'fonts/").split('../../vendor/').join('vendor/');

  fs.rmSync(sortie, { recursive: true, force: true });
  fs.mkdirSync(path.join(sortie, 'fonts'), { recursive: true });
  fs.mkdirSync(path.join(sortie, 'vendor'), { recursive: true });
  for (const f of ['BricolageGrotesque.ttf', 'BigShouldersDisplay.ttf', 'OFL-bricolage.txt', 'OFL-bigshoulders.txt'])
    fs.copyFileSync(path.join(bib, 'fonts', f), path.join(sortie, 'fonts', f));
  fs.copyFileSync(path.join(bib, 'vendor', 'gsap.min.js'), path.join(sortie, 'vendor', 'gsap.min.js'));
  ecrire(path.join(sortie, 'index.html'), html);
}

// Calques des autres briques marqués masque_sous_titres (ils portent leur propre ligne de sous-titre, ou couvrent l'écran du texte qu'il dit).
function lireMasques(w) {
  const p = path.join(w, 'calques.json');
  if (!fs.existsSync(p)) return [];
  let j;
  try { j = JSON.parse(lire(p)); } catch { fail(13, `CALQUES_ILLISIBLE : ${p} n'est pas un JSON valide.`); }
  return (j.calques || []).filter((c) => c.source !== 'sous-titres' && c.masque_sous_titres === true)
    .map((c) => ({ id: c.id, debut: Number(c.debut), images: Number(c.images) }));
}

function majCalques(w, entree) {
  const p = path.join(w, 'calques.json');
  let j = { calques: [] };
  if (fs.existsSync(p)) {
    try { j = JSON.parse(lire(p)); } catch { fail(13, `CALQUES_ILLISIBLE : ${p} n'est pas un JSON valide, rien n'a été écrit.`); }
    if (!Array.isArray(j.calques)) j.calques = [];
  }
  j.calques = j.calques.filter((c) => c.source !== 'sous-titres');
  j.calques.push(entree);
  const tmp = p + '.tmp';
  ecrire(tmp, JSON.stringify(j, null, 2) + '\n');
  fs.renameSync(tmp, p);
}

// ---------------------------------------------------------------- preparer
function cmdPreparer(w) {
  const W = mots(w);
  const n = W.length;
  const rp = path.join(w, 'sous-titres.json');
  let R = {};
  if (fs.existsSync(rp)) { try { R = JSON.parse(lire(rp)); } catch (e) { fail(13, `SOUS-TITRES_ILLISIBLE : ${e.message}`); } }
  const bad = (m) => fail(13, `SOUS-TITRES_ILLISIBLE : ${m}`);
  const num = (k, quoi) => { const i = Number(k); if (!Number.isInteger(i) || i < 0 || i >= n) bad(`${quoi} : mot n°${k} inexistant (0 à ${n - 1}).`); return i; };

  const style = R.style ?? 'classique';
  if (!['classique', 'formelle'].includes(style)) bad(`style « ${style} » inconnu (classique ou formelle).`);

  // corrections (la ponctuation de fin du mot d'origine est gardée : elle marque les fins de phrase)
  const texte = W.map((m) => String(m.text));
  const corrige = new Set();
  for (const [k, v] of Object.entries(R.corrections ?? {})) {
    const i = num(k, 'corrections');
    let c = String(v);
    const fin = (texte[i].trim().match(/[.!?…,;:]+$/) || [''])[0];
    if (fin && c.trim() && !/[.!?…,;:]$/.test(c.trim())) c = c.trim() + fin;
    texte[i] = c; corrige.add(i);
  }
  const masque = new Set();
  for (const r of R.masquer ?? []) {
    const a = num([].concat(r)[0], 'masquer'), b = num([].concat(r).at(-1), 'masquer');
    for (let k = a; k <= b; k++) masque.add(k);
  }

  // mots affichés : un signe seul (« ? », « : », guillemet) se colle au mot d'avant ; un mot corrigé en "" est réuni au précédent
  const liste = [];   // { w, s, e, src: [numéros], brut }
  for (let i = 0; i < n; i++) {
    if (masque.has(i)) continue;
    const t = texte[i];
    if (!affiche(t)) {
      const der = liste.at(-1);
      if (der) { der.brut += t.trim(); if (corrige.has(i)) der.e = W[i].end; der.src.push(i); }
      continue;
    }
    liste.push({ w: affiche(t), s: W[i].start, e: W[i].end, src: [i], brut: t.trim() });
  }
  if (!liste.length) bad('tous les mots sont masqués.');
  const position = new Map();   // numéro de mot -> indice dans la liste affichée
  liste.forEach((m, k) => m.src.forEach((i) => position.set(i, k)));

  // groupes : numéro du premier mot de chaque groupe
  let debuts = R.groupes;
  if (!Array.isArray(debuts) || !debuts.length) bad('« groupes » manquant : la liste des numéros du premier mot de chaque groupe.');
  const coupes = [];
  for (const d of debuts) {
    const i = num(d, 'groupes');
    if (!position.has(i) || liste[position.get(i)].src[0] !== i) bad(`groupes : le mot n°${i} n'est pas affiché seul (masqué, signe seul ou réuni au précédent).`);
    const k = position.get(i);
    if (coupes.length && k <= coupes.at(-1)) bad(`groupes : les numéros doivent aller croissant (n°${i}).`);
    coupes.push(k);
  }
  if (coupes[0] !== 0) bad(`groupes : le premier groupe doit commencer au premier mot affiché (n°${liste[0].src[0]}).`);
  const fins = coupes.slice(1).concat(liste.length);
  const groupes = coupes.map((a, g) => ({ a, b: fins[g], txt: liste.slice(a, fins[g]).map((m) => m.w).join(' ') }));

  // contrôles de lisibilité : une ligne, dans la zone sûre
  const erreurs = [], avis = [];
  const court = (t) => { const m = t.split(' '); return m.length > 8 ? m.slice(0, 8).join(' ') + ' …' : t; };
  groupes.forEach((g, gi) => {
    const nb = g.b - g.a, n0 = liste[g.a].src[0];
    if (style === 'formelle' && nb > MOTS_MAX_FORMELLE) erreurs.push(`groupe n°${gi + 1} (mot ${n0}) : ${nb} mots, 3 au plus en formelle : « ${court(g.txt)} »`);
    const l = largeurTexte(g.txt, style);
    if (l > LARGEUR_MAX * MARGE_MESURE) erreurs.push(`groupe n°${gi + 1} (mot ${n0}) : trop long pour une ligne (${Math.round(l)} px sur ${LARGEUR_MAX}) : « ${court(g.txt)} »`);
    for (let k = g.a; k < g.b - 1; k++) if (finDePhrase(liste[k].brut)) avis.push(`groupe n°${gi + 1} (mot ${n0}) : une fin de phrase au milieu du groupe : « ${court(g.txt)} »`);
  });

  // mots forts (formelle) : numéro du premier mot d'un groupe
  const motFort = [];
  const forts = R.motsForts ?? [];
  if (forts.length && style !== 'formelle') bad('motsForts : seulement en style formelle.');
  for (const d of forts) {
    const i = num(d, 'motsForts');
    const k = position.get(i), gi = coupes.indexOf(k);
    if (gi < 0) bad(`motsForts : le mot n°${i} ne commence pas un groupe (un mot fort est un groupe entier).`);
    let f = groupes[gi].b - 1;   // dernier mot de la phrase où se trouve le mot fort
    while (f < liste.length - 1 && !finDePhrase(liste[f].brut)) f++;
    if (gi === 0) bad(`motsForts : le mot n°${i} ouvre la vidéo ; un mot fort se pose au-dessus d'une ligne déjà affichée.`);
    if (finDePhrase(liste[coupes[gi] - 1].brut)) avis.push(`mot fort (mot ${i}) : il ouvre sa phrase, la ligne affichée dessous sera la fin de la phrase d'avant.`);
    const l = largeurFort(groupes[gi].txt);
    if (l > LARGEUR_MAX * MARGE_MESURE) erreurs.push(`mot fort (mot ${i}) : trop large en grand (${Math.round(l)} px sur ${LARGEUR_MAX}) : « ${groupes[gi].txt} »`);
    if (motFort.length && motFort.at(-1).finPhrase >= coupes[gi]) bad(`motsForts : deux mots forts dans la même phrase (mot n°${i}).`);
    motFort.push({ groupe: gi, finPhrase: f });
  }
  if (erreurs.length) fail(13, 'SOUS-TITRES_ILLISIBLE : coupe ces groupes autrement, puis relance.\n  ' + erreurs.join('\n  '));

  const images = imagesCoupees(w);

  // Calques marqués masque_sous_titres dans calques.json (écrit par animations) : pendant un tel calque, aucun
  // sous-titre de la vidéo. Règle (Yoan, 2026-11-11) : un groupe déjà affiché à l'entrée du calque est COUPÉ NET à
  // l'image d'entrée (il ne revient pas à la sortie) ; s'il n'aurait été visible que moins de COUPE_MIN images avant,
  // il est retiré en entier (pas de flash). Un groupe qui apparaîtrait pendant le calque est retiré en entier.
  // Les autres groupes gardent leurs instants exacts.
  const masques = lireMasques(w);
  const av = style === 'classique' ? 1 / FPS : 0;   // AVANCE_PAVE du gabarit classique
  const onG = groupes.map((g) => Math.max(0, Math.round((liste[g.a].s - av) * FPS)));
  const groupesForts = new Set(motFort.map((f) => f.groupe));
  const COUPE_MIN = 6;   // 0,2 s
  const caches = [], coupesNet = [], raisons = [];
  groupes.forEach((g, gi) => {
    let suiv = gi + 1;
    if (!groupesForts.has(gi)) while (suiv < groupes.length && groupesForts.has(suiv)) suiv++;   // un mot fort ne remplace pas la ligne
    const on = onG[gi], off = suiv < groupes.length ? onG[suiv] : images;
    const m = masques.filter((c) => on < c.debut + c.images && c.debut < off).sort((x, y) => x.debut - y.debut)[0];
    if (!m) return;
    if (on < m.debut && m.debut - on >= COUPE_MIN) {
      coupesNet.push({ groupe: gi, image: m.debut });
      raisons.push(`groupe ${gi + 1} « ${court(g.txt)} » coupé net à l'image ${m.debut} (entrée de ${m.id})`);
    } else {
      caches.push(gi);
      raisons.push(`groupe ${gi + 1} « ${court(g.txt)} » (images ${on} à ${off - 1}) retiré, sous ${m.id}`);
    }
  });
  const P = {
    style,
    mots: liste.map((m) => ({ w: m.w, s: +m.s.toFixed(3), e: +m.e.toFixed(3) })),
    groupes: fins,
    motFort: motFort.length ? motFort : null,
    caches,
    coupes: coupesNet,
    images,
  };
  const bib = bibliotheque();
  const dossier = path.join(w, 'calques', 'st');
  calque(bib, P, images, dossier);
  majCalques(w, { id: 'st', source: 'sous-titres', dossier: 'calques/st', debut: 0, images, couche: 'devant', ordre: 100,
    masques: masques.map((c) => ({ id: c.id, debut: c.debut, images: c.images })) });

  say(`PRÊT calque=${dossier} style=${style} groupes=${groupes.length} mots=${liste.length} masqués=${masque.size} corrigés=${corrige.size} mots-forts=${motFort.length} retirés=${caches.length} coupés=${coupesNet.length} images=${images}`);
  for (const r of raisons) say('  calque qui efface les sous-titres : ' + r);
  for (const a of avis) say('  à relire : ' + a);
  for (const f of motFort) say(`  mot fort à l'image ${Math.round(liste[groupes[f.groupe].a].s * FPS)} : « ${groupes[f.groupe].txt} »`);
}

const [cmd, arg] = process.argv.slice(2);
if (!arg && (cmd === 'texte' || cmd === 'preparer')) fail(1, `Usage : node sous-titres.mjs ${cmd} <dossier>`);
const dossier = arg ? path.resolve(arg) : '';
if (cmd === 'texte') cmdTexte(dossier);
else if (cmd === 'preparer') cmdPreparer(dossier);
else fail(1, 'Usage : node sous-titres.mjs texte <dossier> | preparer <dossier>');
