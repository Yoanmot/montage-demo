// mots-affiches.mjs : chaque mot dit ne s'affiche qu'une fois (Yoan, 2026-11-14, retours sur v11 : « pendant les 12 »
// en sous-titres puis « 12 premières semaines » dans l'animation, « reprendre » deux fois).
// Lit ce qui est posé dans le dossier de montage : le calque des sous-titres (calques/st/index.html, groupes avec le
// numéro de chaque mot, groupes retirés ou coupés net sous un calque) et les calques d'animation (mots_repris de
// calques.json, et ce que chaque calque.json attend à l'écran : « attendus » avec leur texte et l'image de leur mot).
// Deux contrôles :
//   - déclaré : un numéro de mot affiché par deux sources (sous-titres et une animation, ou deux animations) ;
//   - deviné : une animation qui n'a pas déclaré ses mots mais affiche, à l'image d'un mot, le même texte que les
//     sous-titres montrent pour ce mot et les suivants (ex. « reprendre » d'un calque sans mots_repris).
// Usage dans verifier.mjs (« --mots » : toute la vidéo ; sinon les doublons qui touchent le calque contrôlé).
import fs from 'node:fs';
import path from 'node:path';
import { attaqueMot } from './style.mjs';

const FPS = 30;
const lireJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
export const normaliserMot = (w) => String(w).toLowerCase().normalize('NFC').replace(/[’`]/g, "'")
  .replace(/[«»"“”.,;:!?…() ]/g, ' ').trim();

// Ce que montrent les sous-titres : [{ i, texte, de, a }] (images de la vidéo coupée, a exclu)
export function affichesSousTitres(dossier) {
  const f = path.join(dossier, 'calques', 'st', 'index.html');
  if (!fs.existsSync(f)) return { mots: [], sansNumeros: false, absent: true };
  const html = fs.readFileSync(f, 'utf8');
  const m = html.match(/const P = (\{[\s\S]*?\});\n/);
  if (!m) return { mots: [], sansNumeros: false, absent: true };
  const P = JSON.parse(m[1]);
  const caches = new Set(P.caches || []), coupes = new Map((P.coupes || []).map((c) => [c.groupe, c.image]));
  const imageDe = (t) => Math.max(0, Math.ceil(t * FPS - 1e-6));
  const mots = [];
  let sansNumeros = false;
  P.groupes.forEach((g, gi) => {
    if (caches.has(gi)) return;
    const de = imageDe(g.t0);
    let a = Math.min(P.images, imageDe(g.t1));
    if (coupes.has(gi)) a = Math.min(a, coupes.get(gi));
    if (a <= de) return;
    for (const w of g.mots) { if (w.i === undefined) sansNumeros = true; else mots.push({ i: w.i, texte: w.w, de, a, source: 'sous-titres' }); }
  });
  return { mots, sansNumeros, absent: false };
}

// Contrôle de toute la vidéo : { doublons: [{ i, mot, image, s, sources }], avis: [] }
export function doublons(dossier) {
  const avis = [], doubles = [];
  const words = lireJson(path.join(dossier, 'words.cut.json')).words;
  const st = affichesSousTitres(dossier);
  if (st.sansNumeros) avis.push('sous-titres préparés avant le 2026-11-14 (groupes sans numéros de mots) : relance « sous-titres preparer »');
  const cj = path.join(dossier, 'calques.json');
  const calques = fs.existsSync(cj) ? (lireJson(cj).calques || []).filter((c) => c.source === 'animations') : [];
  const parMot = new Map();
  const ajoute = (x) => { if (!parMot.has(x.i)) parMot.set(x.i, []); parMot.get(x.i).push(x); };
  for (const x of st.mots) ajoute(x);
  const texteSt = new Map(st.mots.map((x) => [x.i, x.texte]));
  // une demande à deux couches (a01-derriere + a01-devant) compte pour une seule source
  const demandeDe = (c) => {
    const f = path.join(dossier, c.dossier || `calques/${c.id}`, 'calque.json');
    const fiche = fs.existsSync(f) ? lireJson(f) : {};
    return { fiche, demande: fiche.demande || c.id };
  };
  const vus = new Set();
  for (const c of calques) {
    const { fiche, demande } = demandeDe(c);
    const repris = new Set(c.mots_repris || fiche.mots_repris || []);
    for (const i of repris) {
      const cle = `${demande}:${i}`;
      if (vus.has(cle)) continue;
      vus.add(cle);
      ajoute({ i, texte: texteSt.get(i) ?? (words[i] || {}).text, de: c.debut, a: c.debut + c.images, source: demande });
    }
    // deviné : un texte attendu à l'image d'un mot, identique à ce que les sous-titres affichent pour ce mot et les suivants
    for (const at of fiche.attendus || []) {
      if (at.mot_image === undefined || !at.nom) continue;
      const jetons = normaliserMot(at.nom).split(/\s+/).filter(Boolean);
      if (!jetons.length) continue;
      // mot_image = l'image d'attaque (attaqueMot : 0,1 s avant le début transcrit), ou le début transcrit (anciens calques)
      const k = words.findIndex((w, j) => Math.abs(Math.round(attaqueMot(words, j) * FPS) - at.mot_image) <= 1 || Math.abs(Math.round(w.start * FPS) - at.mot_image) <= 1);
      if (k < 0) continue;
      const suite = [];
      for (let j = k; j < words.length && suite.length < jetons.length; j++) {
        if (repris.has(j)) { suite.length = 0; break; }
        if (texteSt.has(j)) suite.push([j, normaliserMot(texteSt.get(j))]);
        else if (normaliserMot(words[j].text)) break;   // mot dit mais pas en sous-titres : la suite s'arrête
      }
      if (suite.length === jetons.length && suite.every(([, t], q) => t === jetons[q])) {
        for (const [j] of suite) {
          const cle = `${demande}:${j}`;
          if (vus.has(cle)) continue;
          vus.add(cle);
          ajoute({ i: j, texte: texteSt.get(j), de: c.debut + (at.image ?? 0), a: c.debut + c.images, source: demande, devine: true });
        }
      }
    }
  }
  for (const [i, l] of [...parMot.entries()].sort((a, b) => a[0] - b[0])) {
    const sources = [...new Set(l.map((x) => x.source))];
    if (sources.length < 2) continue;
    const tri = [...l].sort((a, b) => a.de - b.de);
    const second = tri.find((x) => x.source !== tri[0].source);
    doubles.push({ i, mot: String(tri[0].texte ?? (words[i] || {}).text).replace(/ /g, ' '), image: second.de, s: +(second.de / FPS).toFixed(2),
      sources: tri.map((x) => `${x.source}${x.devine ? ' (non déclaré)' : ''} images ${x.de}-${x.a - 1}`) });
  }
  return { doublons: doubles, avis, sousTitresAbsents: st.absent };
}

export function phraseDoublon(d) {
  return `« ${d.mot} » (mot ${d.i}) affiché deux fois, la deuxième à l'image ${d.image} (${String(d.s).replace('.', ',')} s) : ${d.sources.join(' ; ')}`;
}
