#!/usr/bin/env node
// theme.mjs : le loader commun des scripts du skill : la DA, la bibliothèque d'illustrations, la clé.
//
// Copie du moteur carrousel-image de Yoan, rendue autonome pour le studio : la DA vit dans le skill
// (../da/ : theme.json, illustrations.json, polices, fonds), jamais lue ailleurs à l'exécution.
// Principe inchangé : AUCUNE valeur de style ne vit dans le code. Tout vient de la DA :
//   ../da/theme.json         → mise en page des slides (slide.mjs)
//   ../da/illustrations.json → brief de génération des illustrations (illustration.mjs)
// Contrat exact des tokens : ../references/contrat-theme.md
//
// Réglages par l'environnement (tous facultatifs) :
//   CARROUSEL_DA            un autre dossier de DA (tests)
//   CARROUSEL_BIBLIOTHEQUE  la bibliothèque d'illustrations détourées ; sinon <STUDIO_RACINE>/carrousel/illustrations,
//                           sinon ../da/illustrations
//   CARROUSEL_ENV           le fichier .env de la clé des illustrations ; sinon <STUDIO_RACINE>/carrousel/.env

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));

export const GABARITS = ['hook', 'corps', 'statement', 'steps', 'cta'];

export const MSG_THEME = 'DA absente : da/theme.json manquant';
export const MSG_ILLUSTRATIONS = 'DA absente : da/illustrations.json manquant';

// ---------- la DA, la bibliothèque, la clé ----------

export function dossierDA() {
  const d = process.env.CARROUSEL_DA ? resolve(process.env.CARROUSEL_DA) : resolve(ICI, '..', 'da');
  if (!existsSync(d)) throw new Error(`dossier de la DA introuvable : ${d}`);
  return d;
}

// bibliothèque d'illustrations : un actif de la DA, pas du deck ; hors du dépôt quand le studio a une racine
export function bibliotheque(da) {
  if (process.env.CARROUSEL_BIBLIOTHEQUE) return resolve(process.env.CARROUSEL_BIBLIOTHEQUE);
  if (process.env.STUDIO_RACINE) return join(process.env.STUDIO_RACINE, 'carrousel', 'illustrations');
  return join(da, 'illustrations');
}

// chemin d'un spec/job : absolu tel quel, relatif résolu depuis le dossier du fichier qui le donne
export function chemin(p, base) {
  return isAbsolute(p) ? p : resolve(base, p);
}

export async function lireEnv(cle) {
  if (process.env[cle]) return process.env[cle];
  const f = process.env.CARROUSEL_ENV
    || (process.env.STUDIO_RACINE ? join(process.env.STUDIO_RACINE, 'carrousel', '.env') : null);
  if (!f || !existsSync(f)) return null;
  const m = (await readFile(f, 'utf8')).match(new RegExp(`^[ \\t]*${cle}[ \\t]*=[ \\t]*(.+)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
}

// ---------- DA : chargement + validation ----------

const valeur = (obj, chemin) => chemin.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

// les limites typographiques : mêmes clés pour les 5 gabarits (limites.commun + surcharge par gabarit)
export const CLES_LIMITES = [
  'titreMots', 'titreLignes', 'kickerMots', 'sousMots',
  'leadMots', 'supportMots', 'punchMots', 'punchMax',
  'etapesMax', 'etapeMots',
  'surlignageMin', 'surlignageMax', 'lueurMin', 'accentsMax',
  'corpsAutorise', 'sousAvecCorps', 'etapesAutorisees',
];

// tokens SANS lesquels une slide ne peut pas être rendue (aucun défaut n'est inventé)
export const REQUIS = [
  'canvas.largeur', 'canvas.hauteur',
  'fond.couleur', 'fond.calques',
  'marque.texte', 'marque.taille', 'marque.graisse', 'marque.interlettre', 'marque.couleur', 'marque.marge',
  'bloc.marges.haut', 'bloc.marges.cotes', 'bloc.marges.bas',
  'typo.couleur',
  'typo.familles.titre', 'typo.familles.corps', 'typo.familles.marque',
  'typo.kicker.taille', 'typo.kicker.graisse', 'typo.kicker.interlettre', 'typo.kicker.couleur', 'typo.kicker.margeBas',
  'typo.titre.graisse', 'typo.titre.interligne', 'typo.titre.interlettre', 'typo.titre.couleur',
  'typo.titre.tailleMin', 'typo.titre.largeurMax',
  ...GABARITS.map(g => `typo.titre.tailles.${g}`),
  'typo.sous.ratioTitre', 'typo.sous.graisse', 'typo.sous.interligne', 'typo.sous.interlettre', 'typo.sous.couleur', 'typo.sous.margeHaut',
  'typo.lead.taille', 'typo.lead.graisse', 'typo.lead.interligne', 'typo.lead.couleur',
  'typo.support.taille', 'typo.support.graisse', 'typo.support.interligne', 'typo.support.couleur',
  'typo.punch.taille', 'typo.punch.graisse', 'typo.punch.interligne', 'typo.punch.interlettre', 'typo.punch.couleur', 'typo.punch.margeHaut',
  'typo.gras.graisse', 'typo.gras.couleur',
  'texte.margeHaut', 'texte.margeHautApres', 'texte.largeurMax', 'texte.interParagraphe', 'texte.interlettre',
  'accents.surlignage.couleur', 'accents.surlignage.fond', 'accents.surlignage.epaisseurBord',
  'accents.surlignage.poignee', 'accents.surlignage.padding',
  'accents.lueur.couleur', 'accents.lueur.epaisseur', 'accents.lueur.rayon', 'accents.lueur.halo',
  ...GABARITS.map(g => `illustration.hauteurs.${g}`),
  'illustration.hauteurMin', 'illustration.largeurMax', 'illustration.margeHaut',
  'illustration.ombre', 'illustration.halo', 'illustration.haloDebord',
  'steps.margeHaut', 'steps.interCarte', 'steps.largeur',
  'steps.carte.fond', 'steps.carte.bord', 'steps.carte.bordHaut', 'steps.carte.epaisseurBord',
  'steps.carte.rayon', 'steps.carte.flou', 'steps.carte.ombre', 'steps.carte.padding', 'steps.carte.gap',
  'steps.numero.cote', 'steps.numero.rayon', 'steps.numero.fond', 'steps.numero.bord',
  'steps.numero.epaisseurBord', 'steps.numero.couleur', 'steps.numero.graisse', 'steps.numero.taille',
  'steps.texte.taille', 'steps.texte.graisse', 'steps.texte.interligne', 'steps.texte.couleur',
  'steps.icone.largeurBoite', 'steps.icone.hauteurBoite', 'steps.icone.hauteurMax', 'steps.icone.largeurMax',
  'steps.icone.filtre', 'steps.icone.halo', 'steps.icone.haloDebord',
  ...CLES_LIMITES.map(k => `limites.commun.${k}`),
];

async function lireJson(fichier, msgManquant) {
  if (!existsSync(fichier)) {
    throw new Error(`${msgManquant}\n  → attendu : ${fichier}\n  → contrat des tokens : references/contrat-theme.md`);
  }
  try {
    return JSON.parse(await readFile(fichier, 'utf8'));
  } catch (e) {
    throw new Error(`${fichier} illisible (JSON invalide) : ${e.message}`);
  }
}

// thème brut, sans validation : pour les scripts qui n'ont besoin que d'un token (ex. la couleur de fond)
export function fichierTheme(da) { return join(da, 'theme.json'); }
export const chargerThemeBrut = da => lireJson(fichierTheme(da), MSG_THEME);

export async function chargerTheme(da) {
  const T = await chargerThemeBrut(da);
  const manquants = REQUIS.filter(p => valeur(T, p) === undefined);
  for (const g of GABARITS) {
    if (!T.limites || typeof T.limites[g] !== 'object' || T.limites[g] === null) manquants.push(`limites.${g}`);
  }
  if (!Array.isArray(valeur(T, 'fond.calques'))) manquants.push('fond.calques (doit être un tableau, éventuellement vide)');
  if (manquants.length) {
    throw new Error(
      `DA incomplète : da/theme.json ne fournit pas ${manquants.length} token(s) requis :\n` +
      manquants.map(m => `  - ${m}`).join('\n') +
      `\n  → contrat complet : references/contrat-theme.md`
    );
  }
  return T;
}

export const chargerIllustrations = da => lireJson(join(da, 'illustrations.json'), MSG_ILLUSTRATIONS);

// limites effectives d'un gabarit : le commun, surchargé par ce que le gabarit redéclare
export const limitesDe = (T, gabarit) => ({ ...T.limites.commun, ...(T.limites[gabarit] || {}) });

// tout actif référencé par le thème (police, fond matiéré) : chemin relatif au dossier de la DA
export function fichierDA(fichier, da) {
  return isAbsolute(fichier) ? fichier : resolve(da, fichier);
}
export const fichierPolice = fichierDA;

export const urlFichier = p => `file://${encodeURI(resolve(p).split(sep).join('/'))}`;
