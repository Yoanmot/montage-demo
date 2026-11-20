// Le registre des publications par plateforme (lot 13, CONTRAT-STUDIO.md section 12.1). Fonctions pures, même
// lecture que zernio.py (plateformes_de, a_relire) : une entrée a « plateformes » { instagram?, tiktok? }, chacune
// avec statut, lien, id, zernio_post, prevu_le, publie_le et, sur un échec, erreur. Une entrée d'avant le lot 13
// (sans « plateformes ») est une publication Instagram.
import { lireDate } from '../serveur/outils.mjs';

export const ORDRE = ['instagram', 'tiktok'];
export const NOMS_PLATEFORMES = { instagram: 'Instagram', tiktok: 'TikTok' };

export function plateformesDe(e) {
  if (!e || typeof e !== 'object') return {};
  if (e.plateformes && typeof e.plateformes === 'object') return e.plateformes;
  if (!e.statut) return {};
  const x = { statut: e.statut, zernio_post: e.zernio_post || null, lien: e.lien || null, id: e.media_id || null,
    prevu_le: e.prevu_le || null, publie_le: e.publie_le || null };
  if (e.erreur) x.erreur = e.erreur;
  return { instagram: x };
}

// La liste affichable : [{ plateforme, nom, statut, lien, quand, erreur }], dans l'ordre fixe.
export function listePlateformes(e) {
  const pl = plateformesDe(e);
  return ORDRE.filter((p) => pl[p]).map((p) => ({
    plateforme: p, nom: NOMS_PLATEFORMES[p], statut: pl[p].statut || null, lien: pl[p].lien || null,
    quand: pl[p].prevu_le || pl[p].publie_le || null, ...(pl[p].erreur ? { erreur: pl[p].erreur } : {}),
  }));
}

const MARGE_PROGRAMME_MS = 5 * 60e3;
// TikTok donne le lien d'une vidéo quelques minutes après sa sortie : relu encore, 48 h au plus.
const LIEN_ATTENDU_MS = 48 * 3600e3;

// Cette plateforme est-elle encore en route (à relire chez Zernio, lecture seule) ?
export function aRelire(p, x, maintenant = Date.now()) {
  if (!x || !x.zernio_post || x.statut === 'failed') return false;
  if (x.statut === 'publié') {
    if (x.lien || p !== 'tiktok') return false;
    const d = lireDate(x.publie_le || x.prevu_le);
    return !d || d.getTime() + LIEN_ATTENDU_MS > maintenant;
  }
  if (x.statut === 'programmé') {
    const d = lireDate(x.prevu_le);
    return Boolean(d && d.getTime() + MARGE_PROGRAMME_MS <= maintenant);
  }
  return true;
}

export function enRouteEntree(e, maintenant = Date.now()) {
  const pl = plateformesDe(e);
  return Object.entries(pl).some(([p, x]) => aRelire(p, x, maintenant));
}
