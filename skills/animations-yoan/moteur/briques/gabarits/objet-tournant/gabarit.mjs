// Objet tournant (retours de Yoan du 2026-10-23) : un cube 3D qui tourne sur lui-même, posé à l'endroit que pointe un geste
// de la main (doigt levé au hook : « une animation au-dessus genre un cube un peu mystère qui tourne »). Générique : les
// faces prennent une IMAGE en paramètre (texture) ; sans image, la face par défaut est celle du style (verre sombre, filet
// doré avec halo, point d'interrogation doré en Satoshi Black). Aucun élément sous droits dans le gabarit : une image de
// marque n'entre que par les paramètres d'un reel (voir executeur/test/medias/SOURCES.md).
// Rotation continue sans à-coup (linéaire), légère inclinaison, flottement lent ; ombrage de chaque face calculé à chaque
// image d'après son orientation (lumière en haut à gauche) ; halo doré doux derrière ; grain qui vibre sur les faces.
// Entrée des objets du style : fondu depuis un flou (12 px, 0,17 s), sans rebond ; sortie courte vers un flou.
import { S, f3, grainJs, RGB_D } from '../commun.mjs';

// o = {
//   cx, cy                 centre de l'objet (px de l'image)
//   taille = 130           arête du cube
//   image                  chemin d'une image carrée pour les faces (facultatif) ; copiée dans le calque
//   entree, sortie?        instants (s, dans le calque)
//   tour = 2.6             durée d'un tour complet (s)
//   inclinaison = -16      rotation X fixe (degrés, négatif : on voit le dessus)
//   flottement = 6         amplitude du flottement vertical (px), période 1,8 s
//   halo = true            halo doré doux derrière l'objet
//   fin                    durée du calque (pour le grain et l'ombrage)
// }
export function objetTournant(p, o) {
  const T = o.taille ?? 130, h = T / 2, tour = o.tour ?? 2.6, incl = o.inclinaison ?? -16, fl = o.flottement ?? 6;
  const fin = o.fin ?? (o.sortie ?? o.entree + 4) + 0.2;
  const img = o.image ? `img-${p}${o.image.slice(o.image.lastIndexOf('.'))}` : null;
  const faces = [['f', `translateZ(${h}px)`], ['d', `rotateY(90deg) translateZ(${h}px)`], ['b', `rotateY(180deg) translateZ(${h}px)`],
    ['g', `rotateY(-90deg) translateZ(${h}px)`], ['h', `rotateX(90deg) translateZ(${h}px)`], ['s', `rotateX(-90deg) translateZ(${h}px)`]];
  const faceCss = img
    ? `background:url('${img}') center/cover no-repeat;border-radius:${Math.round(T * 0.06)}px;`
    : `background:${S.verreObjet};border:2px solid ${S.dore};border-radius:${Math.round(T * 0.08)}px;box-shadow:inset 0 0 ${Math.round(T * 0.18)}px rgba(${RGB_D},0.28),0 0 10px rgba(${RGB_D},0.55);`;
  const css = `
#${p}o{position:absolute;left:${o.cx - h}px;top:${o.cy - h}px;width:${T}px;height:${T}px;perspective:${T * 7}px;opacity:0;z-index:35;}
#${p}halo{position:absolute;left:${-T * 0.9}px;top:${-T * 0.9}px;width:${T * 2.8}px;height:${T * 2.8}px;border-radius:50%;
  background:radial-gradient(circle,rgba(${RGB_D},0.34) 0%,rgba(${RGB_D},0.14) 38%,rgba(${RGB_D},0) 70%);}
#${p}fl{position:absolute;left:0;top:0;width:${T}px;height:${T}px;transform-style:preserve-3d;}
#${p}c{position:absolute;left:0;top:0;width:${T}px;height:${T}px;transform-style:preserve-3d;}
.${p}fa{position:absolute;left:0;top:0;width:${T}px;height:${T}px;box-sizing:border-box;overflow:hidden;backface-visibility:hidden;${faceCss}}
.${p}q{position:absolute;left:0;top:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:'Satoshi';font-weight:900;
  font-size:${Math.round(T * 0.66)}px;line-height:1;color:${S.dore};text-shadow:0 0 0.143em rgba(${RGB_D},0.75),0 0 0.4em rgba(${RGB_D},0.45);}
.${p}om{position:absolute;left:0;top:0;width:100%;height:100%;background:#0b0603;opacity:0;}
.${p}gr{position:absolute;left:-80px;top:-80px;width:${T + 160}px;height:${T + 160}px;background:url('grain.png') repeat;mix-blend-mode:overlay;opacity:0.35;}`;
  const html = `  <div id="${p}o"><div id="${p}halo"></div><div id="${p}fl"><div id="${p}c">` + faces.map(([k, tr]) =>
    `<div class="${p}fa" id="${p}f${k}" style="transform:${tr}">${img ? '' : `<div class="${p}q">?</div>`}<div class="${p}gr"></div><div class="${p}om" id="${p}om${k}"></div></div>`).join('')
    + `</div></div></div>\n`;
  let js = `tl.fromTo('#${p}o', { opacity: 0, filter: 'blur(${S.objet.flou}px)', scale: 0.86 }, { opacity: 1, filter: 'blur(0px)', scale: 1, duration: ${S.objet.duree}, ease: 'power2.out', immediateRender: true }, ${f3(o.entree)});\n`;
  // rotation, flottement et ombrage posés image par image (rendu déterministe, aucune dépendance au temps réel)
  const ips = 30, n0 = Math.max(0, Math.floor(o.entree * ips) - 1), n1 = Math.ceil(fin * ips);
  const L = [-0.45, -0.6, 0.66]; const nl = Math.hypot(...L); const lum = L.map((x) => x / nl);   // lumière en haut à gauche, devant
  const normale = (k, ay, ax) => {
    const n0 = { f: [0, 0, 1], b: [0, 0, -1], d: [1, 0, 0], g: [-1, 0, 0], h: [0, -1, 0], s: [0, 1, 0] }[k];
    const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
    let [x, y, z] = [n0[0] * cy + n0[2] * sy, n0[1], -n0[0] * sy + n0[2] * cy];   // rotateY
    [y, z] = [y * cx - z * sx, y * sx + z * cx];                                    // rotateX
    return [x, y, z];
  };
  for (let f = n0; f <= n1; f++) {
    const t = f / ips, ang = ((t - o.entree) / tour) * 360, by = fl * Math.sin((2 * Math.PI * (t - o.entree)) / 1.8);
    // inclinaison fixe dans le monde sur le parent (rotateX), rotation propre sur le cube (rotateY) : pas de toupie qui vacille
    js += `tl.set('#${p}c', { rotationY: ${ang.toFixed(2)} }, ${f3(t + 0.0005)});\n`;
    js += `tl.set('#${p}fl', { y: ${by.toFixed(2)}, rotationX: ${incl} }, ${f3(t + 0.0005)});\n`;
    for (const k of ['f', 'd', 'b', 'g', 'h', 's']) {
      const [x, y, z] = normale(k, (ang * Math.PI) / 180, (incl * Math.PI) / 180);
      const d = Math.max(0, x * lum[0] + y * lum[1] + z * lum[2]);
      js += `tl.set('#${p}om${k}', { opacity: ${(0.62 * (1 - d)).toFixed(3)} }, ${f3(t + 0.0005)});\n`;
    }
  }
  js += grainJs(`.${p}gr`, o.entree, fin, 2468, 60);
  if (o.sortie !== undefined) js += `tl.to('#${p}o', { opacity: 0, filter: 'blur(10px)', duration: 0.12, ease: 'power1.in' }, ${f3(o.sortie)});\n`;
  return { css, html, js, fichiers: img ? [[o.image, img]] : [] };
}
