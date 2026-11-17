// Slides d'un carrousel vues depuis le dossier média (CONTRAT-STUDIO.md, section 2).
//
// La mise en page (skill carrousel, enregistrée par a-rendre.py) écrit les slides dans
// <config carrousels>/carrousel-<slug>/ (~/Pictures/Carrousels par défaut). Le studio pose un lien MEDIA/<slug>/slides vers ce dossier
// pour que la carte les affiche (route /api/media/<slug>/slides/...). Rien n'est copié ni déplacé.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLIDE = /^slide-\d+\.(png|jpe?g)$/i;

export function developper(chemin) {
  if (!chemin) return chemin;
  if (chemin === '~') return os.homedir();
  if (chemin.startsWith('~/')) return path.join(os.homedir(), chemin.slice(2));
  return chemin;
}

export function slugValide(slug) {
  return typeof slug === 'string' && slug.length >= 3 && slug.length <= 60 && SLUG.test(slug);
}

function lireJson(chemin, defaut) {
  try { return JSON.parse(fs.readFileSync(chemin, 'utf8')); } catch { return defaut; }
}

// Le dossier des slides : celui que le registre des rendus a noté, sinon la convention de a-rendre.py.
export function dossierSlides(slug, config) {
  const reg = lireJson(path.join(developper(config.depot_hoc), 'rendus', 'registre.json'), {});
  const noté = reg && reg.carrousels && reg.carrousels[slug] && reg.carrousels[slug].dossier;
  if (noté) return path.resolve(developper(noté));
  return path.join(developper(config.carrousels || '~/Pictures/Carrousels'), 'carrousel-' + slug);
}

// Pose (ou corrige) le lien MEDIA/<slug>/slides -> dossier des slides.
// Rend { lie: true, cible } ou { lie: false, raison: 'SLUG_INVALIDE' | 'PAS_DE_SLIDES' | 'OCCUPE' }.
export function lierSlides(slug, config) {
  if (!slugValide(slug)) return { lie: false, raison: 'SLUG_INVALIDE' };
  const cible = dossierSlides(slug, config);
  let st;
  try { st = fs.statSync(cible); } catch { st = null; }
  if (!st || !st.isDirectory()) return { lie: false, raison: 'PAS_DE_SLIDES', cible };

  const dossier = path.join(developper(config.media), slug);
  fs.mkdirSync(dossier, { recursive: true });
  const lien = path.join(dossier, 'slides');
  let actuel;
  try { actuel = fs.lstatSync(lien); } catch { actuel = null; }
  if (actuel && !actuel.isSymbolicLink()) return { lie: false, raison: 'OCCUPE', cible };
  if (actuel && path.resolve(dossier, fs.readlinkSync(lien)) === cible) return { lie: true, cible };

  // Remplacement atomique : lien temporaire à côté, puis rename par-dessus l'ancien.
  const tmp = path.join(dossier, '.slides-' + process.pid + '-' + Date.now());
  fs.symlinkSync(cible, tmp);
  fs.renameSync(tmp, lien);
  return { lie: true, cible };
}

// Les noms des slides visibles par le lien (slide-01.png, ...), dans l'ordre.
export function slidesDe(slug, config) {
  if (!slugValide(slug)) return [];
  try {
    return fs.readdirSync(path.join(developper(config.media), slug, 'slides'))
      .filter((n) => SLIDE.test(n))
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  } catch {
    return [];
  }
}
