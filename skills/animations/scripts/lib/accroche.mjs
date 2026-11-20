// accroche.mjs (lib) : ce que l'accroche composée a le droit de varier, le contrôle d'une composition du plan, et le
// registre qui empêche de refaire la même accroche deux vidéos de suite.
// Décision de Yoan (2026-11-20, direction A « Romain, en plus nerveux ») : la signature ne bouge jamais (police, casse,
// un seul accent orange, charbon et craie, ouverture en dézoom, trois temps, son sur le mot fort) ; la disposition se
// décide pour chaque vidéo selon l'accroche et l'effet voulu chez le spectateur.
// Le registre est tenu par un script (jamais par la mémoire du modèle) : un fichier JSON par client, dans la mémoire du
// monteur (`$CLAUDE_CONFIG_DIR/agent-memory/monteur/registre-accroches.json`, ~/.claude si la variable est vide), à côté de
// preferences.md. MONTEUR_REGISTRE (chemin complet) le remplace, pour les essais et les tests.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ------------------------------------------------------------------ vocabulaire
export const TYPES = ['mot-derriere', 'chiffre', 'question-coupee', 'deux-paves', 'titre-depuis-le-dezoom', 'substitution', 'libre'];
export const EFFETS = ['surprise', 'tension', 'curiosite', 'identification'];
export const ROLES = ['phrase', 'mot', 'relance'];
export const PLACES = ['derriere', 'haut', 'bas'];
export const ALIGNES = ['gauche', 'droite', 'centre'];
export const ENTREES = { phrase: ['apparition', 'pose'], mot: ['apparition', 'saccade', 'pose'], relance: ['saccade', 'apparition', 'pose'] };
export const TAILLES = { phrase: ['normale', 'grande'], mot: ['geant', 'grand', 'moyen'], relance: ['normale', 'grande'] };
export const PAVES = ['orange', 'craie', 'aucun'];

// Substitution (Yoan, 2026-11-20) : deux exemples parallèles qui servent le même propos se montrent au même endroit, le
// second remplaçant le premier, élément par élément (« remplace » : le texte de l'élément remplacé). Le second prend la
// place, l'alignement, la taille et le pavé du premier : on voit que c'est la même phrase, avec d'autres mots.
const texteDe = (e) => String(e?.texte ?? '').trim().toLocaleUpperCase('fr');
export function remplacements(els) {
  const out = new Map();   // index de l'élément qui remplace -> index de l'élément remplacé
  els.forEach((e, j) => {
    if (e.remplace == null) return;
    const i = els.findIndex((x, k) => k !== j && texteDe(x) === String(e.remplace).trim().toLocaleUpperCase('fr'));
    out.set(j, i);
  });
  return out;
}
// Le mot fort est le dernier « mot » à l'écran : celui qu'aucun autre ne remplace.
export const motFort = (els) => {
  const R = remplacements(els), remplaces = new Set([...R.values()]);
  return els.find((e, j) => e.role === 'mot' && !remplaces.has(j));
};

const sansAccents = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// Contrôle d'une demande « accroche » du plan (avant le calage des ancres). Renvoie { refus: [[code, msg]], avis: [msg] }.
// d : { composition: { type, effet, pourquoi, barre_sur?, jusqua?, derogation?, demande_de_romain? }, elements: [...] }
export function controler(d) {
  const refus = [], avis = [];
  const R = (code, msg) => refus.push([code, msg]);
  const c = d.composition;
  if (!c || typeof c !== 'object') {
    R('COMPOSITION_MANQUANTE', 'une accroche composée a sa « composition » : type, effet, pourquoi (voir format.md)');
    return { refus, avis };
  }
  if (!TYPES.includes(c.type)) R('TYPE_INCONNU', `type « ${c.type} » : ${TYPES.join(', ')}`);
  if (!EFFETS.includes(sansAccents(c.effet))) R('EFFET_INCONNU', `effet « ${c.effet} » : ${EFFETS.join(', ')} (ce qu'on veut faire ressentir au spectateur)`);
  if (!c.pourquoi || String(c.pourquoi).trim().length < 25) R('POURQUOI_MANQUANT', 'une phrase qui dit l\'effet visé et pourquoi cette disposition (25 caractères au moins)');
  const els = Array.isArray(d.elements) ? d.elements : [];
  const RM = remplacements(els), remplaces = new Set([...RM.values()]);
  const mots = els.filter((e, j) => e.role === 'mot' && !remplaces.has(j));
  if (mots.length !== 1) R('MOT_FORT', `il faut exactement un élément « mot » (le mot fort), il y en a ${mots.length}${RM.size ? ' (sans compter ceux qui sont remplacés)' : ''}`);
  for (const [j, i] of RM) {
    const e = els[j], nom = `elements[${j}]`;
    if (i < 0) { R('REMPLACE', `${nom} : « remplace » ${JSON.stringify(e.remplace)} ne nomme aucun autre élément (écris le texte exact de l'élément remplacé)`); continue; }
    const r = els[i];
    if (r.role !== e.role) R('REMPLACE', `${nom} : « ${e.texte} » (${e.role}) remplace « ${r.texte} » (${r.role}) : un élément ne remplace qu'un élément du même rôle`);
    if (RM.has(i)) R('REMPLACE', `${nom} : « ${r.texte} » remplace déjà un autre élément ; une seule substitution par emplacement`);
    if ([...RM.values()].filter((x) => x === i).length > 1) R('REMPLACE', `« ${r.texte} » est remplacé deux fois`);
    if ((r.place ?? null) === 'derriere' || e.place === 'derriere') R('REMPLACE', `${nom} : une substitution se fait devant lui (haut ou bas), pas derrière lui`);
    if (e.place != null && r.place != null && e.place !== r.place) R('REMPLACE', `${nom} : « ${e.texte} » prend la place de « ${r.texte} » (${r.place}) ; ne lui donne pas d'autre place`);
    const surDe = (x) => (x.sur && typeof x.sur === 'object' ? `w${x.sur.premier}` : sansAccents(x.sur));
    if (e.sur && r.sur && surDe(e) === surDe(r)) R('REMPLACE', `${nom} : il arrive sur le même mot que l'élément qu'il remplace`);
  }
  if (RM.size && c.type !== 'substitution') R('TYPE_INCONNU', `des éléments en remplacent d'autres : le type est « substitution » (pour le registre)`);
  if (c.type === 'substitution' && !RM.size) R('REMPLACE', 'type « substitution » sans élément qui en remplace un autre (« remplace » : le texte de l\'élément remplacé)');
  const relances = els.filter((e) => e.role === 'relance');
  if (relances.length > 2) R('RELANCES', 'deux relances au plus');
  let oranges = 0;
  for (const [j, e] of els.entries()) {
    const remplaceOrange = RM.has(j) && RM.get(j) >= 0;   // même emplacement que l'élément remplacé : un seul orange à l'image
    const nom = `elements[${j}]`;
    if (!ROLES.includes(e.role)) { R('ROLE_INCONNU', `${nom} : rôle « ${e.role} » (${ROLES.join(', ')})`); continue; }
    const place = e.place ?? (e.role === 'phrase' ? null : undefined);
    if (e.role !== 'phrase' && !PLACES.includes(place) && !(RM.has(j) && e.place == null)) R('PLACE_INCONNUE', `${nom} (${e.role}) : place « ${e.place} » (${PLACES.join(', ')})`);
    if (e.role === 'phrase' && e.place != null && !PLACES.includes(e.place)) R('PLACE_INCONNUE', `${nom} : place « ${e.place} »`);
    if (e.role === 'relance' && e.place === 'derriere') R('PLACE_INCONNUE', `${nom} : la relance passe devant lui (haut ou bas) ; derrière, sous le mot, on ne la verrait pas`);
    if (e.aligne != null && !ALIGNES.includes(e.aligne)) R('ALIGNE_INCONNU', `${nom} : aligne « ${e.aligne} » (${ALIGNES.join(', ')})`);
    if (e.entree != null && !ENTREES[e.role].includes(e.entree)) R('ENTREE_INCONNUE', `${nom} (${e.role}) : entrée « ${e.entree} » (${ENTREES[e.role].join(', ')})`);
    if (e.taille != null && !TAILLES[e.role].includes(e.taille)) R('TAILLE_INCONNUE', `${nom} (${e.role}) : taille « ${e.taille} » (${TAILLES[e.role].join(', ')})`);
    if (e.pave != null && !PAVES.includes(e.pave)) R('PAVE_INCONNU', `${nom} : pavé « ${e.pave} » (${PAVES.join(', ')})`);
    if (e.role === 'phrase' && e.pave && e.pave !== 'aucun') R('PAVE_INCONNU', `${nom} : la phrase reste en minuscules sans pavé (signature)`);
    if (e.compte_de != null) {
      if (e.role !== 'mot' || !/^\d+$/.test(String(e.texte).trim())) R('COMPTE', `${nom} : seul un mot fort qui est un nombre peut compter jusqu'à lui`);
      else if (!(Number.isInteger(+e.compte_de) && +e.compte_de >= 0 && +e.compte_de < +e.texte)) R('COMPTE', `${nom} : compte_de doit être un entier plus petit que ${e.texte}`);
    }
    if (e.role === 'mot' && e.place === 'derriere' && e.pave && e.pave !== 'aucun') R('PAVE_INCONNU', `${nom} : un mot derrière lui n'a pas de pavé`);
    const pave = e.role === 'relance' ? (e.pave ?? 'auto') : (e.pave ?? 'aucun');
    if (pave === 'orange' && !remplaceOrange) oranges++;
    if (e.role === 'mot' && e.souligne && !remplaceOrange) oranges++;
  }
  if (oranges > 1) R('ACCENT_DOUBLE', 'un seul accent orange par image : un pavé orange OU un soulignage orange, pas deux');
  if (c.type === 'question-coupee' && !c.barre_sur) avis.push('question coupée sans « barre_sur » : la question n\'est pas barrée quand la réponse arrive');
  if (c.barre_sur && !els.some((e) => e.role === 'phrase' && e.barre)) R('BARRE', '« barre_sur » sans phrase marquée « barre »: true');
  return { refus, avis };
}

// ------------------------------------------------------------------ la signature d'une accroche (ce que le registre compare)
export function signature(d) {
  const c = d.composition || {};
  const mot = motFort(d.elements || []) || {};
  const relance = (d.elements || []).find((e) => e.role === 'relance') || null;
  return {
    type: c.type || null,
    mot: String(mot.texte ?? '').trim().toUpperCase(),
    place: mot.place || null,
    entree: mot.entree || 'apparition',
    relance: relance ? { place: relance.place || null, entree: relance.entree || 'saccade' } : null,
    effet: c.effet || null,
  };
}
const combinaison = (s) => `${s.type} / ${s.place} / ${s.entree}`;

// ------------------------------------------------------------------ le registre
export function cheminRegistre(env = process.env) {
  if (env.MONTEUR_REGISTRE) return path.resolve(env.MONTEUR_REGISTRE);
  const base = env.CLAUDE_CONFIG_DIR || path.join(env.HOME || os.homedir(), '.claude');
  return path.join(base, 'agent-memory', 'monteur', 'registre-accroches.json');
}
export function lireRegistre(f = cheminRegistre()) {
  if (!fs.existsSync(f)) return { version: 1, accroches: [] };
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (!Array.isArray(r.accroches)) throw new Error(`REGISTRE_ILLISIBLE ${f} : pas de liste « accroches »`);
  return r;
}
// Les n dernières accroches, sans celle de cette vidéo (une vidéo refaite remplace sa propre ligne)
export function dernieres(registre, video, n = 2) {
  return registre.accroches.filter((a) => a.video !== video).slice(-n);
}
// Règles (page validée par Yoan, « Comment le monteur variera d'une vidéo à l'autre ») :
//  - jamais la même combinaison (type, place du mot fort, entrée du mot fort) qu'une des deux dernières ;
//  - jamais le même mot mis en avant qu'une des deux dernières ;
//  - jamais la même place que la toute dernière.
// Une demande de Romain (composition.demande_de_romain) passe : la règle devient un avis.
export function comparer(sig, precedentes) {
  const pb = [];
  for (const p of precedentes) {
    if (combinaison(p) === combinaison(sig)) pb.push(`même combinaison que l'accroche de « ${p.titre || p.video} » (${combinaison(sig)})`);
    if (p.mot && p.mot === sig.mot) pb.push(`même mot mis en avant que « ${p.titre || p.video} » (${sig.mot})`);
  }
  const der = precedentes.at(-1);
  if (der && der.place && der.place === sig.place) pb.push(`même place que la dernière accroche (« ${der.titre || der.video} », ${sig.place})`);
  return pb;
}
export function verifier(d, video, f = cheminRegistre()) {
  const sig = signature(d), prec = dernieres(lireRegistre(f), video);
  const pb = comparer(sig, prec);
  const demande = d.composition && d.composition.demande_de_romain;
  return { sig, precedentes: prec, repetitions: demande ? [] : pb, avis: demande ? pb.map((x) => `${x} (demandé par Romain : « ${demande} »)`) : [] };
}
// Écrit (ou remplace) la ligne de cette vidéo, en dernier. Écriture à côté puis renommage : jamais un fichier à moitié écrit.
export function noter(d, video, extra = {}, f = cheminRegistre()) {
  const r = lireRegistre(f);
  const ligne = { video, ...signature(d), pourquoi: (d.composition || {}).pourquoi || null, ...extra, note_le: new Date().toISOString() };
  r.accroches = r.accroches.filter((a) => a.video !== video);
  r.accroches.push(ligne);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = `${f}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(r, null, 1) + '\n');
  fs.renameSync(tmp, f);
  return ligne;
}
export const decrire = (a) => `${a.titre || path.basename(a.video)} : ${a.type}, mot « ${a.mot} » ${a.place}, entrée ${a.entree}`
  + (a.relance ? `, relance ${a.relance.entree} ${a.relance.place}` : '') + (a.effet ? `, effet ${a.effet}` : '');
