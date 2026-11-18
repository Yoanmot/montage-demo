// Image en plein écran (retours de Yoan du 2026-10-23, « une photo de singe devant un ordinateur avec un sound design
// marrant ») : une photo posée sur le fond r4-01c dans un cadre du style (filet crème, croix « + » de viseur aux 4 coins),
// étalonnée pour rejoindre l'image du reel (chaude, un peu désaturée, contraste léger, vignette, grain qui vibre), avec un
// zoom lent continu linéaire (100 à 106 %) tant qu'elle est là. Générique : l'image est un paramètre. Sous-titres en haut
// (y 256) comme sur tout plein écran à panneau. Le son (comique ou impactant) se pose avec l'élément « son » de la timeline.
// Entrée : fondu depuis un flou (12 px) en 0,17 s, départ à 104 % (on transforme, pas de pop ni de rebond).
import { S, f3, croix, grainJs } from '../commun.mjs';

// o = {
//   image                   chemin de la photo (copiée dans le calque)
//   x = 90, y = 560, w = 900, h        cadre (h défaut : w x 3/4) ; panneau des pleins écrans : x 90 à 990, haut à y 560
//   entree, sortie?, fin     instants (s, dans le calque)
//   zoom = 1.06             échelle de fin du zoom lent continu
//   etalonnage              filtre CSS (défaut : chaud, un peu désaturé)
// }
export function imagePlein(p, o) {
  const x = o.x ?? 90, y = o.y ?? 560, w = o.w ?? 900, h = o.h ?? Math.round(w * 3 / 4), fin = o.fin ?? (o.sortie ?? o.entree + 3) + 0.2;
  const img = `img-${p}${o.image.slice(o.image.lastIndexOf('.'))}`;
  const et = o.etalonnage ?? 'sepia(0.28) saturate(0.82) contrast(1.06) brightness(0.92)';
  const cx = croix(`${p}k`, { x, y, w, h });
  const css = `
#${p}cad{position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;box-sizing:border-box;overflow:hidden;border-radius:${S.rayon.panneau}px;
  border:${S.trait}px solid ${S.filet};opacity:0;z-index:20;background:#120a06;}
#${p}im{position:absolute;left:0;top:0;width:100%;height:100%;background:url('${img}') center/cover no-repeat;filter:${et};transform-origin:50% 50%;}
#${p}vg{position:absolute;left:0;top:0;width:100%;height:100%;background:radial-gradient(ellipse 75% 70% at 50% 50%,rgba(0,0,0,0) 55%,rgba(12,6,3,0.55) 100%);}
#${p}gr{position:absolute;left:-120px;top:-120px;right:-120px;bottom:-120px;background:url('grain.png') repeat;mix-blend-mode:overlay;opacity:0.32;}
${cx.css}`;
  const html = `  <div id="${p}cad"><div id="${p}im"></div><div id="${p}vg"></div><div id="${p}gr"></div></div>${cx.html}\n`;
  let js = `tl.fromTo('#${p}cad', { opacity: 0, filter: 'blur(${S.objet.flou}px)', scale: 1.04 }, { opacity: 1, filter: 'blur(0px)', scale: 1, duration: ${S.objet.duree}, ease: 'power2.out', immediateRender: true }, ${f3(o.entree)});\n`;
  js += `tl.fromTo('#${p}im', { scale: 1 }, { scale: ${o.zoom ?? 1.06}, duration: ${f3(Math.max(0.1, (o.sortie ?? fin) - o.entree))}, ease: 'none', immediateRender: true }, ${f3(o.entree)});\n`;
  js += `tl.fromTo('${cx.sel}', { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.2, ease: 'power2.out', immediateRender: true }, ${f3(o.entree + 0.05)});\n`;
  js += grainJs(`#${p}gr`, o.entree, fin, 9753, 100);
  if (o.sortie !== undefined) js += `tl.to('#${p}cad, ${cx.sel}', { opacity: 0, filter: 'blur(10px)', duration: 0.12, ease: 'power1.in' }, ${f3(o.sortie)});\n`;
  return { css, html, js, fichiers: [[o.image, img]], box: { x, y, w, h } };
}
