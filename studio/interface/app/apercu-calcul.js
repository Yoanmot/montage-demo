// Calculs de l'aperçu sans DOM (testés côté serveur) : le plan caméra à l'image n, comme le rendu.
const FPS = 30;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const eo = (p) => { p = clamp(p, 0, 1); return 1 - (1 - p) ** 2; };
const eio = (p) => { p = clamp(p, 0, 1); return p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2; };

// Échelle d'un zoom à l'image n, comme le graphe du rendu (zooms.py, graphe) : dézoom d'ouverture d'un pas égal par
// image ; geste en mouvement = moyenne des 10 sous-images de l'obturateur ; geste posé = son échelle.
export function zoomA(zooms, n) {
  for (const z of zooms || []) {
    if (z.type === "ouverture") {
      if (n >= 0 && n < z.f1) return { s: z.echelle - (z.echelle - 1) * n / z.f1, ancre: z.ancre };
      continue;
    }
    if (n < z.f0 || n >= z.f1) continue;
    if (n >= z.fixe) return { s: z.echelle, ancre: z.ancre };
    let somme = 0;
    for (let j = 0; j < 10; j++) {
      const t = (n + j / 10) / FPS;
      const p = t < z.t0 ? 0 : (t - z.t0) / z.duree;
      somme += 1 + (z.echelle - 1) * (z.courbe === "power2.out" ? eo(p) : eio(p));
    }
    return { s: somme / 10, ancre: z.ancre };
  }
  return { s: 1, ancre: [0.5, 0.5] };
}

// Le plan caméra à l'image n : zoom, décalage (px sur 1920), flou (rayon en px sur 1080, assombrissement).
export function planA(d, n) {
  const z = zoomA(d.zooms, n);
  let dy = 0;
  for (const x of d.decalages || []) if (n >= x.debut && n < x.debut + x.valeurs.length) dy = x.valeurs[n - x.debut];
  const flou = (d.flous || []).find((f) => n >= f.debut && n < f.fin) || null;
  return { ...z, dy, flou };
}
