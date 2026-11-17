// Groupes de sous-titres (repris tels quels de captions_romain.py, groups() et sous_titres()), partagés par la brique
// sous-titres (sous-titres.mjs preparer) et par les effets qui affichent une phrase en sous-titres (groupesSousTitres de
// animations/scripts/lib/style.mjs : phrase du bas du plein écran puzzle). Aucune dépendance.

export const finDePhrase = (t) => /[.!?…]\s*[»"”)]?\s*$/.test(String(t).trim());

// Une phrase (ou un bout de phrase entre deux pauses) n'est jamais à cheval sur deux groupes ; trop longue, elle se
// coupe en groupes de longueur égale (le groupe le plus large le moins large possible) plutôt que de laisser un mot
// seul à la fin. Un groupe tient : 4 mots au plus, et (s'il a plus d'un mot) 20 caractères au plus (divisé par la
// taille) et une largeur d'au plus 0,84 x la largeur de la vidéo, mesurée avec la police (lettres resserrées, pas les
// espaces). Coupe de phrase : fin de phrase (. ! ? …) ou blanc de plus de 0,15 s entre deux mots.
export function decouper(liste, largeur, ST, G) {
  const phrases = [];
  let cur = [];
  for (const m of liste) {
    if (cur.length && (m.s - cur.at(-1).e > (G.coupePause ?? ST.coupePhrase) || m.coupeAvant || cur.at(-1).barriere !== undefined)) { phrases.push(cur); cur = []; }
    cur.push(m);
    if (finDePhrase(m.brut) || m.coupeApres) { phrases.push(cur); cur = []; }
  }
  if (cur.length) phrases.push(cur);
  // G.lignes 2 (réglage « volume » de sous-titres.json) : un groupe tient s'il se pose sur une ligne, ou sur deux lignes
  // qui tiennent chacune (coupeLignes) ; « pire largeur » = sa ligne la plus large
  const uneLigne = (g) => { const line = g.map((x) => x.w).join(' '); return g.length === 1 || ([...line].length <= G.caracteresMax && largeur(line) <= G.largeurMax); };
  const tient = (g) => g.length <= ST.motsMax && (uneLigne(g) || ((G.lignes || 1) > 1 && coupeLignes(g, largeur, G) > 0));
  const larg = (g) => { const k = uneLigne(g) ? 0 : coupeLignes(g, largeur, G); const L = (h) => largeur(h.map((x) => x.w).join(' ')); return k ? Math.max(L(g.slice(0, k)), L(g.slice(k))) : L(g); };
  const out = [];
  for (const p of phrases) {
    const n = p.length;
    for (let k = 1; k <= n; k++) {
      // mots placés -> [pire largeur, coupures, pénalités] ; G.virgules (réglage « volume ») : une coupure qui ne tombe pas
      // sur une virgule (ou « : », « ; ») et un groupe d'un seul mot coûtent G.penalite px (respirations et sens)
      let best = new Map([[0, [0, [], 0]]]);
      for (let r = 0; r < k; r++) {
        const nxt = new Map();
        for (const [i, [pire, cuts, pen]] of best) {
          for (let j = i + 1; j <= n; j++) {
            const g = p.slice(i, j);
            if (!tient(g)) break;
            const pj = G.virgules ? pen + (j < n && !/[,;:]\s*$/.test(p[j - 1].brut) ? G.penalite : 0) + (g.length === 1 && n > 1 ? G.penalite : 0) : 0;
            const cand = [Math.max(pire, larg(g)), cuts.concat(j), pj];
            if (!nxt.has(j) || cand[0] + cand[2] < nxt.get(j)[0] + nxt.get(j)[2]) nxt.set(j, cand);
          }
        }
        best = nxt;
      }
      if (best.has(n)) {
        let choix = best.get(n);
        // G.virgules : un groupe de plus est permis s'il évite des coupures hors virgule (score + 0,3 x la largeur max)
        if (G.virgules && k < n) {
          let b2 = new Map([[0, [0, [], 0]]]);
          for (let r = 0; r <= k; r++) {
            const nx = new Map();
            for (const [i, [pire, cuts, pen]] of b2) for (let j = i + 1; j <= n; j++) {
              const g = p.slice(i, j); if (!tient(g)) break;
              const pj = pen + (j < n && !/[,;:]\s*$/.test(p[j - 1].brut) ? G.penalite : 0) + (g.length === 1 && n > 1 ? G.penalite : 0);
              const cand = [Math.max(pire, larg(g)), cuts.concat(j), pj];
              if (!nx.has(j) || cand[0] + cand[2] < nx.get(j)[0] + nx.get(j)[2]) nx.set(j, cand);
            }
            b2 = nx;
          }
          const plus = b2.get(n);
          if (plus && plus[0] + plus[2] + 0.3 * G.largeurMax < choix[0] + choix[2]) choix = plus;
        }
        let i = 0; for (const j of choix[1]) { out.push(p.slice(i, j)); i = j; } break;
      }
    }
  }
  return out;
}

// Deux lignes (réglage « volume », lignes 2) : où couper un groupe trop long pour une ligne. Renvoie l'indice du premier
// mot de la deuxième ligne (0 = une seule ligne suffit, -1 = aucune coupe ne tient). Chaque ligne tient (caractères,
// largeur) ; on préfère une coupe qui ne laisse pas un mot seul sur une ligne, puis la plus équilibrée.
export function coupeLignes(g, largeur, G) {
  const txt = (h) => h.map((x) => x.w).join(' ');
  const ok = (h) => h.length === 1 ? largeur(txt(h)) <= G.largeurMax : [...txt(h)].length <= G.caracteresMax && largeur(txt(h)) <= G.largeurMax;
  if (ok(g)) return 0;
  let best = -1, cout = Infinity;
  for (let k = 1; k < g.length; k++) {
    const a = g.slice(0, k), b = g.slice(k);
    if (!ok(a) || !ok(b)) continue;
    const c = Math.abs(largeur(txt(a)) - largeur(txt(b))) + (g.length >= 3 && (a.length === 1 || b.length === 1) ? 1e4 : 0)
      + (G.virgules && !/[,;:]\s*$/.test(String(a.at(-1).brut || a.at(-1).w)) ? (G.penalite || 0) : 0);
    if (c < cout) { cout = c; best = k; }
  }
  return best;
}

// Instants (captions_romain.py, sous_titres()) : un groupe apparaît à l'attaque de son premier mot ; suivi d'un blanc de
// moins de ST.pause il part au début du suivant, sinon ST.apresDernier après son dernier mot, en fondu ; le premier groupe
// après un blanc de ST.pause (et le tout premier) monte en fondu.
// Un groupe suivi de mots repris par une animation s'arrête au plus tard à l'attaque du premier mot repris (barriere) :
// l'animation montre ces mots, les sous-titres ne les montrent pas avant elle.
export function instants(gs, ST) {
  return gs.map((g, gi) => {
    const fin = g.at(-1).e, b = g.at(-1).barriere;
    const nxt = b !== undefined ? b : gi + 1 < gs.length ? gs[gi + 1][0].s : null;
    const joint = nxt !== null && nxt - fin < ST.pause;
    let t1 = joint ? nxt : fin + ST.apresDernier;
    if (b !== undefined) t1 = Math.min(t1, b);
    return { mots: g.map((m) => ({ w: m.w, s: +m.s.toFixed(3), i: m.i })), t0: +g[0].s.toFixed(3), t1: +t1.toFixed(3),
      monte: gi === 0 || g[0].s - gs[gi - 1].at(-1).e >= ST.pause, sortie: !joint };
  });
}
