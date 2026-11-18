// encre.mjs (tour 10) : brique réutilisable du futur monteur. Pose les crochets verrouillés (r4-04a) autour d'un mot en
// Satoshi Black. Copie de renders/r9/_build/encre.mjs, plus le choix de la référence de centrage VERTICAL (tour 10).
// En largeur, les crochets suivent toujours l'encre réelle du mot (même marge à gauche et à droite).
// En hauteur, quatre modes :
//   'capitales' (r10-01a) : la boîte de référence va de la ligne de base à la hauteur des capitales ; un accent
//                           déborde librement dans la marge du haut (et au-delà si la marge est plus petite que l'accent).
//   'optique'   (r10-01b) : à mi-chemin entre la boîte des capitales et la boîte d'encre (haut et bas moyennés).
//   'releve'    (r10-01c) : centré sur les capitales, mais le haut est relevé de la hauteur de l'accent quand le mot
//                           en a un (marge du haut comptée au-dessus de l'accent, marge du bas depuis la ligne de base).
//   'encre'     (tour 9)  : la boîte d'encre réelle, accents et descendantes compris (r9-01a..c).
// Données : satoshi-glyphes.json (python3 glyphes.py). Vérifié sur l'image : renders/r10/_build/r10-01/mesures.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const G = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'satoshi-glyphes.json'), 'utf8'));
export const MODES = ['capitales', 'optique', 'releve', 'encre'];

// Boîte d'encre d'un mot, mesurée depuis la boîte d'un span inline-block (font-size taille, line-height lh en multiple
// de taille, letter-spacing ls en em). Rend des distances en px depuis chaque bord du span (positives vers l'intérieur,
// négatives si l'encre dépasse : un accent dépasse en haut). Rend aussi la boîte des capitales (cap_haut : haut des
// capitales, cap_bas : ligne de base) et la hauteur de ce qui dépasse au-dessus des capitales (accent_px).
export function encre(mot, taille, lh = 1, ls = 0) {
  const s = taille / G.upm, cs = [...mot].map((c) => G.chars[c]);
  if (cs.some((c) => !c)) throw new Error(`caractère inconnu dans ${mot}`);
  const hBoite = taille * lh;
  const base = (hBoite - (G.ascent + G.descent) * s) / 2 + G.ascent * s;   // ligne de base depuis le haut du span
  const haut = Math.max(...cs.map((c) => c.y1)), bas = Math.min(...cs.map((c) => c.y0));
  const der = cs[cs.length - 1];
  // un accent = de l'encre nettement au-dessus des capitales (le dépassement optique d'un O ou d'un S, 13 unités, n'en est pas un)
  const accent = haut > G.cap * 1.05 ? (haut - G.cap) * s : 0;
  return {
    gauche: cs[0].x0 * s,
    droite: (der.adv - der.x1) * s + ls * taille,          // Chrome ajoute l'interlettrage après la dernière lettre aussi
    haut: base - haut * s,
    bas: hBoite - base + bas * s,
    cap_haut: base - G.cap * s,
    cap_bas: hBoite - base,
    accent_px: accent,
    hauteur_lettres: G.cap * s,
    ligne_de_base: base,
  };
}

// Références verticales (distances depuis le haut et le bas du span, positives vers l'intérieur) selon le mode.
export function reference(e, mode = 'capitales') {
  switch (mode) {
    case 'capitales': return { haut: e.cap_haut, bas: e.cap_bas };
    case 'optique': return { haut: (e.cap_haut + e.haut) / 2, bas: (e.cap_bas + e.bas) / 2 };
    case 'releve': return { haut: e.cap_haut - e.accent_px, bas: e.cap_bas };
    case 'encre': return { haut: e.haut, bas: e.bas };
    default: throw new Error(`mode inconnu : ${mode} (${MODES.join(', ')})`);
  }
}

// Position CSS (left/right/top/bottom) de la boîte des crochets dans le span du mot : bord INTÉRIEUR du trait à « marge »
// px de la référence (encre en largeur, référence du mode en hauteur). Le trait (épaisseur) est à l'extérieur.
// Appel du tour 9 inchangé si on ne passe pas de mode : boiteCrochets(mot, taille, lh, ls, marge, trait) = mode 'encre'.
export function boiteCrochets(mot, taille, lh, ls, marge, trait, mode = 'encre') {
  const e = encre(mot, taille, lh, ls), d = marge + trait, ref = reference(e, mode);
  const r = (x) => Math.round(x * 10) / 10;
  // marges attendues entre le bord intérieur du trait et, d'un côté, les capitales, de l'autre, l'encre (négatif : l'encre dépasse)
  const attendu = {
    capitales: { haut: r(e.cap_haut - ref.haut + marge), bas: r(e.cap_bas - ref.bas + marge) },
    encre: { haut: r(e.haut - ref.haut + marge), bas: r(e.bas - ref.bas + marge) },
  };
  return { mode, left: r(e.gauche - d), right: r(e.droite - d), top: r(ref.haut - d), bottom: r(ref.bas - d), encre: e, attendu };
}
