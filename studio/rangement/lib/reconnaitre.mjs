// Reconnaissance des rushs : face caméra par les mots dits (comparés aux scripts), b-rolls et photos par l'ordre de
// tournage et la durée (puis confirmation par l'image, voir modele.mjs). Fonctions pures, testées.

// Réglages de la reconnaissance de la face caméra.
export const FACE = {
  MOTS_MIN: 12,      // en dessous : la vidéo est considérée sans parole (b-roll ou photo animée)
  SEUIL: 0.35,       // part minimale des mots dits (distincts, normalisés) qu'on retrouve dans le script
  MARGE: 0.12,       // écart minimal avec le deuxième script
  RAPPORT: 0.6,      // et le deuxième fait au plus 60 % du premier (le premier domine nettement)
};

// Les nombres dits en lettres et écrits en chiffres se rejoignent (« seize heures » et « 16 h »).
const NOMBRES = { zero: '0', deux: '2', trois: '3', quatre: '4', cinq: '5', six: '6', sept: '7',
  huit: '8', neuf: '9', dix: '10', onze: '11', douze: '12', treize: '13', quatorze: '14', quinze: '15', seize: '16',
  vingt: '20', trente: '30', quarante: '40', cinquante: '50', soixante: '60', cent: '100', mille: '1000' };

const VIDES = new Set(`a au aux avec ce ces cette cet c ca d dans de des du elle elles en est et etre eu il ils
  j je l la le les leur leurs lui m ma mais me mes moi mon n ne nos notre nous on ou par pas plus pour qu que qui s sa
  se ses si son sont sur t ta te tes toi ton tu un une vos votre vous y es suis ai as avez avons ont fait faire
  bon bien alors donc voila tout tous toute toutes comme quand meme aussi tres trop peu euh hein ben bah oui non
  ici la cela ceci leur dont ou car ni soit ete etait c est quoi`.split(/\s+/).filter(Boolean));

// Texte -> racines de mots porteurs de sens (minuscules, sans accents, sans mots vides, tronqués à 6 lettres pour
// absorber pluriels et conjugaisons : « protéines » et « protéine » se rejoignent).
export function racines(texte) {
  const mots = String(texte || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ').replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean);
  const out = [];
  for (let m of mots) {
    if (NOMBRES[m]) m = NOMBRES[m];
    if (VIDES.has(m)) continue;
    if (m.length < 3 && !/^\d+$/.test(m)) continue;
    out.push(m.slice(0, 6));
  }
  return out;
}

// Le texte d'un script à comparer : « Texte complet », plus « En points » (s'il a parlé à partir des points).
export function texteDuScript(md) {
  const sections = {};
  let cle = null;
  for (const ligne of String(md || '').split('\n')) {
    const t = ligne.match(/^##\s+(.+?)\s*$/);
    if (t) { cle = t[1].toLowerCase(); sections[cle] = []; continue; }
    if (cle) sections[cle].push(ligne);
  }
  const prendre = (k) => (sections[k] || []).join('\n');
  return [prendre('texte complet'), prendre('en points')].join('\n').trim();
}

// Le genre d'un reel (2026-11-20) : `genre` de etat.json, sinon un brief qui n'a qu'un « Texte à l'écran » (reel muet
// d'avant ce champ) est en plans filmés avec texte, sinon face caméra. Même règle que genreDe (serveur/lecture.mjs) et
// commun.genre_de (outils du head of content).
export function genreDe(etat, md = null) {
  if (['face-camera', 'plans-texte', 'plans-voix'].includes(etat?.genre)) return etat.genre;
  const titres = [...String(md || '').matchAll(/^##\s+(.+?)\s*$/gm)]
    .map((m) => m[1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/’/g, "'"));
  if (titres.some((x) => /^texte a l.ecran/.test(x)) && !titres.some((x) => x.startsWith('texte complet'))) return 'plans-texte';
  return 'face-camera';
}

// Le plan principal d'un reel sans parole (genre plans-texte) est la vidéo du reel : il se range comme une face caméra
// (dans le dossier du contenu, pas en bibliothèque), pour que le montage parte de lui. Une seule par contenu : le clip
// de la prise à filmer de plus petit numéro qui ne sert que ce contenu, s'il n'a pas déjà sa vidéo.
// decisions : [{ type, slugs, prise }] triées par date de prise ; genre(slug) ; aDeja(slug). Modifie et renvoie decisions.
export function principauxSansParole(decisions, prises, genre, aDeja) {
  const principale = new Map();   // slug -> n de sa prise principale
  for (const p of prises || []) {
    if (p.type !== 'b-roll' || p.deja_en_bibliotheque || (p.contenus || []).length !== 1) continue;
    const s = p.contenus[0].slug;
    if (!principale.has(s) || p.n < principale.get(s)) principale.set(s, p.n);
  }
  const faits = new Set();
  for (const d of decisions) {
    if (d.type !== 'b-roll' || !d.prise || (d.slugs || []).length !== 1) continue;
    const s = d.slugs[0];
    if (faits.has(s) || principale.get(s) !== d.prise.n || genre(s) !== 'plans-texte' || aDeja(s)) continue;
    d.type = 'face';
    faits.add(s);
  }
  return decisions;
}

// Part des mots dits qu'on retrouve dans chaque script ; décision avec seuil et marge sur le deuxième.
// scripts : [{ slug, texte }]. Renvoie { decision: 'place'|'aucun'|'ambigu'|'sans_parole', slug?, scores: [...] }.
export function reconnaitreFace(transcription, scripts, reglages = FACE) {
  const dits = racines(transcription);
  const T = new Set(dits);
  if (dits.length < reglages.MOTS_MIN) return { decision: 'sans_parole', mots: dits.length, scores: [] };
  const scores = scripts.map(({ slug, texte }) => {
    const S = new Set(racines(texte));
    let communs = 0;
    for (const m of T) if (S.has(m)) communs++;
    return { slug, score: S.size ? Math.round((communs / T.size) * 1000) / 1000 : 0 };
  }).sort((a, b) => b.score - a.score);
  const [p, d] = scores;
  if (!p || p.score < reglages.SEUIL) return { decision: 'aucun', mots: dits.length, scores };
  if (d && (p.score - d.score < reglages.MARGE || d.score > reglages.RAPPORT * p.score)) {
    return { decision: 'ambigu', mots: dits.length, scores };
  }
  return { decision: 'place', slug: p.slug, mots: dits.length, scores };
}

// Appariement des clips (dans l'ordre de prise) avec les prises du plan (dans l'ordre de tournage), par
// programmation dynamique monotone : un clip va à une prise au moins aussi loin que le précédent (une prise refaite
// deux fois = deux clips sur la même prise), une prise peut être sautée. Coût : écart de durée (log), saut, reprise.
// clips : [{ duree }], prises : [{ n, duree_s }]. Renvoie un tableau d'indices de prise (un par clip).
export function apparier(clips, prises, { SAUT = 0.7, REPRISE = 0.6 } = {}) {
  const C = clips.length, P = prises.length;
  if (!C || !P) return clips.map(() => null);
  const cout = (c, p) => {
    const a = Number(clips[c].duree) || 0, b = Number(prises[p].duree_s) || 0;
    if (a <= 0 || b <= 0) return 0.3;
    return Math.min(1.5, Math.abs(Math.log(a / b)));
  };
  const INF = Infinity;
  const dp = Array.from({ length: C }, () => new Array(P).fill(INF));
  const prec = Array.from({ length: C }, () => new Array(P).fill(-1));
  for (let j = 0; j < P; j++) dp[0][j] = j * SAUT + cout(0, j);
  for (let i = 1; i < C; i++) {
    for (let j = 0; j < P; j++) {
      for (let k = 0; k <= j; k++) {
        const v = dp[i - 1][k] + (k === j ? REPRISE : (j - k - 1) * SAUT) + cout(i, j);
        if (v < dp[i][j]) { dp[i][j] = v; prec[i][j] = k; }
      }
    }
  }
  let best = 0, bv = INF;
  for (let j = 0; j < P; j++) {
    const v = dp[C - 1][j] + (P - 1 - j) * SAUT;
    if (v < bv) { bv = v; best = j; }
  }
  const res = new Array(C);
  for (let i = C - 1, j = best; i >= 0; i--) { res[i] = j; j = prec[i][j]; }
  return res;
}

// Réponse du modèle sur un clip : validée sur son contenu (leçon du 2026-11-15), pas seulement sur sa forme.
// Renvoie { ok: true, prise, ce_qu_on_voit, mouvements } ou { ok: false, pourquoi }.
export function validerVue(texte, numerosPossibles, { exigerMouvements = true } = {}) {
  let j = null;
  const s = String(texte || '');
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { j = JSON.parse(m[0]); } catch { j = null; } }
  if (!j || typeof j !== 'object') return { ok: false, pourquoi: 'reponse_illisible' };
  const voit = typeof j.ce_qu_on_voit === 'string' ? j.ce_qu_on_voit.trim() : '';
  const mouv = Array.isArray(j.mouvements) ? j.mouvements.map((x) => String(x ?? '').trim()).filter(Boolean) : [];
  if (!voit) return { ok: false, pourquoi: 'champ_vide' };
  if (j.prise === null || j.prise === undefined || j.prise === 'aucune') {
    return { ok: true, prise: null, ce_qu_on_voit: voit, mouvements: mouv };
  }
  const n = Number(j.prise);
  if (!Number.isInteger(n) || !numerosPossibles.includes(n)) return { ok: false, pourquoi: 'prise_inexistante' };
  if (exigerMouvements && !mouv.length) return { ok: false, pourquoi: 'champ_vide' };
  return { ok: true, prise: n, ce_qu_on_voit: voit, mouvements: mouv };
}
