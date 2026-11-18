// Calques HyperFrames du pilote : lit la liste des calques à écrire (JSON préparé par monter.py, instants déjà relatifs
// au début de chaque calque) et écrit chaque dossier hf/ avec les gestes de calques/ et les gabarits de briques/gabarits/.
// Aucune valeur de style ici : tout passe par les fonctions de calques/ (style/style.json).
// Usage : node calques.mjs <calques.json>   -> écrit <dossier>/index.html (+ polices, grain) pour chaque calque
//
// Un calque : { dossier, duree, polices, grain, fondPage?, parts: [part...] }. Une part :
//   { k: 'sousTitres', mots: [{w,t,fin}], specs: [[texte, doré, {crochets}]], coupures: [t...], crochets }
//   { k: 'faisceaux', T: [t...] }            { k: 'pleinMots', lignes, T1, T2, variante }
//   { k: 'demi', t0, t1, contenu: gab, bascule, sortie }   { k: 'hookTitre', lignes }   { k: 'hookOuverture', groupes }
//   { k: 'hookSecondaire', lignes, t, fin, variante, tAllume }
//   { k: 'motDerriere', mot, t, hautCheveux, xCentre }     { k: 'broll', duree, instants }
//   { k: 'cta', ...options de cta() }                      { k: 'gabarit', gab, plein?: { T1, T2 } }
// gab = { gabarit: 'liste-cascade', params: {...} } ; un objet { gabarit, params } dans les params devient une part.
import fs from 'node:fs';
import { page, ecrireCalque, groupes, sousTitres, faisceaux, pleinEcranMots, demiEcran, champChat, hookTitre, etiquetteHook,
  motDerriere, broll, visuelDossier, cta, pleinEcran, champSaisie, reglePin, objetSignature, demiEcranGabarit, panneau, listeCascade,
  comparaisonEmpilee, schemaNoeuds, vignetteMorph, appariement, minuteur, fichierHeros, fichierPartout, listeTorse, hookOuverture, hookSecondaire, objetTournant, imagePlein, minuteurSuite } from '../calques/index.mjs';
import path from 'node:path';

const GABARITS = {
  'champ-chat': champChat, 'champ-saisie': champSaisie, 'regle-pin': reglePin, 'objet-signature': objetSignature,
  'demi-ecran': demiEcranGabarit, 'panneau-viseurs': panneau, 'liste-cascade': listeCascade, 'comparaison-empilee': comparaisonEmpilee,
  'schema-noeuds': schemaNoeuds, 'vignette-morph': vignetteMorph, appariement, minuteur, 'fichier-heros': fichierHeros,
  'fichier-partout': fichierPartout, 'liste-torse': listeTorse, 'objet-tournant': objetTournant, 'image-plein': imagePlein,
  'minuteur-suite': minuteurSuite,
};
let n = 0;
const prefixe = () => `g${String.fromCharCode(97 + Math.floor(n / 26))}${String.fromCharCode(97 + (n++ % 26))}`;
function gabarit(g) {
  const f = GABARITS[g.gabarit];
  if (!f) throw new Error(`gabarit inconnu : ${g.gabarit}`);
  const inst = (v) => (Array.isArray(v) ? v.map(inst) : v && typeof v === 'object' ? (v.gabarit ? gabarit(v) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, inst(x)]))) : v);
  return f(prefixe(), inst(g.params ?? {}));
}

function part(x, D) {
  switch (x.k) {
    case 'sousTitres': {
      const gs = groupes(x.mots, x.specs, D);
      // jamais de sous-titre pendant un plein écran à mots, le titre du hook ou le CTA : le groupe s'arrête net avant
      gs.forEach((g) => { const c = (x.coupures ?? []).find((t) => t > g.start); if (c != null && g.end > c) g.end = c; });
      return sousTitres(gs, 's', { crochets: x.crochets ?? true });
    }
    case 'faisceaux': return faisceaux(x.T);
    case 'pleinMots': return pleinEcranMots('p', { lignes: x.lignes, T1: x.T1, T2: x.T2, variante: x.variante });
    case 'demi': return demiEcran('d', { t0: x.t0, t1: x.t1, contenu: gabarit(x.contenu), bascule: x.bascule ?? undefined, sortie: x.sortie });
    case 'hookTitre': return hookTitre('h', { lignes: x.lignes });
    case 'hookOuverture': return hookOuverture('o', { groupes: x.groupes });
    case 'hookSecondaire': return hookSecondaire('e', { lignes: x.lignes, t: x.t, fin: x.fin, variante: x.variante, tAllume: x.tAllume });
    case 'motDerriere': return motDerriere('g', { mot: x.mot, t: x.t, hautCheveux: x.hautCheveux, xCentre: x.xCentre });
    case 'broll': {
      const [a, v, tr] = x.instants, ten = x.tenue;
      const vis = visuelDossier('b', { anciens: a, finAnciens: a + ten, vocaux: v, finVocaux: v + ten, transcription: tr, finTranscription: tr + ten });
      return broll('r', { duree: x.duree, visuel: vis, annotations: vis.annotations, cadre: vis.cadre });
    }
    case 'cta': return cta('k', x);
    case 'gabarit': {
      const g = gabarit(x.gab);
      return x.plein ? { ...pleinEcran('pf', x.plein.T1, x.plein.T2, g), fichiers: g.fichiers } : g;
    }
    default: throw new Error(`part inconnue : ${x.k}`);
  }
}

const L = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const c of L) {
  n = 0;
  const parts = c.parts.map((x) => part(x, c.duree));
  const fondPage = c.fondPage ?? parts.find((p) => p.fondPage)?.fondPage ?? 'transparent';
  fs.rmSync(c.dossier, { recursive: true, force: true });
  ecrireCalque(c.dossier, page(c.duree, parts, c.polices, fondPage), c.polices, c.grain);
  // images passées en paramètre d'un gabarit (texture d'objet, photo) : copiées à côté de la page
  for (const pt of parts) for (const [src, nom] of pt.fichiers ?? []) fs.copyFileSync(src, path.join(c.dossier, nom));
}
console.log(`${L.length} calques écrits`);
