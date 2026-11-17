// police.mjs : lecture des métriques d'une police TrueType (.ttf statique) en Node, sans dépendance.
// Sert aux sous-titres (largeur d'une ligne pour découper les groupes, hauteur des capitales et ligne de base pour placer
// la ligne) et au contrôle des captions (hauteur des capitales et ascendante de chaque police du style).
// Largeur = somme des avances des glyphes (table hmtx), sans crénage, arrondies au px avec `arrondi` : c'est exactement ce
// que mesurait Pillow sans raqm dans l'ancien script des sous-titres (captions_romain.py), dont on reprend la découpe des
// groupes telle quelle.
// Une police variable est lue à son instance par défaut : pour les sous-titres, prendre un fichier statique (une graisse).
import fs from 'node:fs';

const _cache = new Map();

export function lirePolice(fichier) {
  if (_cache.has(fichier)) return _cache.get(fichier);
  const b = fs.readFileSync(fichier);
  const u16 = (o) => b.readUInt16BE(o), i16 = (o) => b.readInt16BE(o), u32 = (o) => b.readUInt32BE(o);
  const tables = {};
  const n = u16(4);
  for (let i = 0; i < n; i++) {
    const o = 12 + 16 * i;
    tables[b.toString('latin1', o, o + 4)] = u32(o + 8);
  }
  for (const t of ['head', 'hhea', 'hmtx', 'cmap', 'OS/2']) if (tables[t] === undefined) throw new Error(`POLICE_ILLISIBLE ${fichier} : table ${t} absente`);
  const upm = u16(tables.head + 18);
  const hh = tables.hhea, nbMetriques = u16(hh + 34);
  const os2 = tables['OS/2'], version = u16(os2);
  const metr = {
    upm,
    hheaAsc: i16(hh + 4), hheaDesc: -i16(hh + 6), hheaGap: i16(hh + 8),
    typoAsc: i16(os2 + 68), typoDesc: -i16(os2 + 70), typoGap: i16(os2 + 72),
    winAsc: u16(os2 + 74), winDesc: u16(os2 + 76),
    useTypo: (u16(os2 + 62) & 0x80) !== 0,
    cap: version >= 2 ? i16(os2 + 88) : null,
    variable: tables.fvar !== undefined,
  };
  // avances
  const avances = [];
  for (let g = 0; g < nbMetriques; g++) avances.push(u16(tables.hmtx + 4 * g));
  const avance = (g) => avances[Math.min(g, nbMetriques - 1)];
  // cmap : format 12 (3,10 ou 0,4) de préférence, sinon format 4 (3,1)
  const cm = tables.cmap, nb = u16(cm + 2);
  let sous = null, fmt = 0;
  for (let i = 0; i < nb; i++) {
    const p = u16(cm + 4 + 8 * i), e = u16(cm + 6 + 8 * i), o = cm + u32(cm + 8 + 8 * i), f = u16(o);
    if (f === 12 && ((p === 3 && e === 10) || p === 0)) { sous = o; fmt = 12; break; }
    if (f === 4 && ((p === 3 && e === 1) || p === 0) && fmt !== 12) { sous = o; fmt = 4; }
  }
  if (sous === null) throw new Error(`POLICE_ILLISIBLE ${fichier} : pas de table cmap Unicode`);
  const glyphes = new Map();
  if (fmt === 12) {
    const ng = u32(sous + 12);
    for (let i = 0; i < ng; i++) {
      const o = sous + 16 + 12 * i, a = u32(o), z = u32(o + 4), g0 = u32(o + 8);
      for (let c = a; c <= z && c <= 0x2FFFF; c++) glyphes.set(c, g0 + c - a);
    }
  } else {
    const segX2 = u16(sous + 6), fins = sous + 14, debuts = fins + segX2 + 2, deltas = debuts + segX2, ranges = deltas + segX2;
    for (let s = 0; s < segX2 / 2; s++) {
      const fin = u16(fins + 2 * s), deb = u16(debuts + 2 * s), delta = i16(deltas + 2 * s), ro = u16(ranges + 2 * s);
      for (let c = deb; c <= fin && c !== 0xFFFF; c++) {
        let g;
        if (ro === 0) g = (c + delta) & 0xFFFF;
        else { g = u16(ranges + 2 * s + ro + 2 * (c - deb)); if (g) g = (g + delta) & 0xFFFF; }
        glyphes.set(c, g);
      }
    }
  }
  const police = {
    fichier, ...metr,
    // hauteur des capitales en em (OS/2 sCapHeight)
    capEm: metr.cap !== null ? metr.cap / upm : null,
    // ascendante et descendante utilisées par Chrome sur Mac pour la boîte de ligne (typo si USE_TYPO_METRICS, sinon hhea)
    ascEm: (metr.useTypo ? metr.typoAsc : metr.hheaAsc) / upm,
    descEm: (metr.useTypo ? metr.typoDesc : metr.hheaDesc) / upm,
    // avance d'un texte en px à une taille donnée (sans crénage) ; un caractère absent compte comme le glyphe 0.
    // arrondi : chaque avance arrondie au px, comme Pillow (FreeType avec hinting), vérifié égal à Pillow sur Inter Black.
    avance(texte, px, arrondi = false) {
      let s = 0;
      for (const ch of texte) { const a = avance(glyphes.get(ch.codePointAt(0)) ?? 0) * px / upm; s += arrondi ? Math.round(a) : a; }
      return s;
    },
    a(ch) { return glyphes.has(ch.codePointAt(0)); },
  };
  _cache.set(fichier, police);
  return police;
}
