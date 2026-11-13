// EXEMPLE d'effet sur mesure, à copier dans <dossier -montage>/animations/sur-mesure/<id>.mjs et à réécrire pour la demande.
// Testé le 2026-11-11 sur la rush de test (demande a05 du plan de test). Ce qu'il montre de la méthode :
//   - les ancres viennent du plan (resoudre) ; chaque élément part sur SON mot (entrée = attaque - AV) ;
//   - toutes les valeurs viennent de S (commun.mjs) : positions, tailles, courbes, durées, couleurs ; aucune en dur ;
//   - les gestes sont repris de gabarits nommés (carte + onglet, apparition, pas du minuteur) ;
//   - ecrireCalque écrit le calque, ses attendus (avec mot_image pour le contrôle « jamais avant son mot ») et ses sons.
// Demande d'origine : compteur de pas. Carte charbon en haut du cadre (position et marges de CHRONO, largeur de la zone
// sûre), onglet orange « de l'avance » ; sur « dix », le chiffre monte de 0 à 10 par à-coups (MINUTEUR.ecarts, gestes
// d'entrée et de sortie du minuteur) et 10 crans craie se remplissent un par un (MINUTEUR.cran, séparations du minuteur
// barre) ; « pas en avant » arrive sur ses mots à droite du chiffre. Tick quand le 10 se pose.
// Gestes repris : carte + onglet (carte-chrono), apparition v2, chiffres et crans (minuteur-chiffres, minuteur-barre).
// Un seul orange (l'onglet) : chiffre et crans en craie.
// Usage : node <id>.mjs <dossier -montage> <dossier du skill animations>
import path from 'node:path';
const [dossier, skill] = process.argv.slice(2);
const L = await import(path.join(skill, 'scripts', 'lib', 'style.mjs'));
const { S, K, P, FPS, AV, Couche, CSS_CARTE, chargerMots, resoudre, img, tImg, f4, cap, son, ecrireCalque } = L;

const mots = chargerMots(dossier);
const A = (x) => resoudre(x, mots);
const aOnglet = A("l'avance"), aDix = A('dix'), aLegende = A('pas en avant');
const debut = img(aOnglet.debut_s - AV - 0.1);
const images = img(aLegende.fin_s + 0.7) - debut;
const t = (a) => a.debut_s - AV - debut / FPS;             // entrée calée sur un mot (secondes du calque)

const CH = S.CHRONO, MB = S.MINUTEUR.barre, MN = S.MINUTEUR, LC = S.LIGNE_CARTE;
const X = S.ZONE_SURE.x0, LARG = S.ZONE_SURE.x1 - S.ZONE_SURE.x0;   // carte sur toute la largeur de la zone sûre
const [padH, padX, padB] = CH.pad;
const TAILLE = CH.chiffre, HCH = P.titre.interligne * TAILLE;     // boîte du chiffre
const NB = 10, GAP = 24;
const c = new Couche(images);
c.css = CSS_CARTE + `
#cd{left:${X}px;top:${CH.y}px;width:${LARG}px;padding:${padH}px ${padX}px ${padB}px;}
#ligne{position:relative;display:flex;align-items:flex-end;gap:${GAP}px;height:${HCH.toFixed(1)}px;}
#chiW{position:relative;width:${(TAILLE * 0.95).toFixed(0)}px;height:${HCH.toFixed(1)}px;}
#chiW span{position:absolute;left:0;top:0;font-size:${TAILLE}px;opacity:0;}
#leg{font-size:${LC.nm}px;padding-bottom:${(TAILLE * 0.06).toFixed(0)}px;}
#crans{position:relative;margin-top:${GAP}px;height:${MB.h}px;display:grid;grid-template-columns:repeat(${NB},1fr);gap:${MB.separation}px;}
#crans i{display:block;background:${MB.fond};border-radius:${S.RAYONS.pave}px;overflow:hidden;position:relative;}
#crans b{position:absolute;inset:0;background:${K.craie};transform-origin:0 50%;transform:scaleX(0);}
`;
const chiffres = Array.from({ length: NB + 1 }, (_, k) => `<span class="ti c-cr" id="v${k}">${k}</span>`).join('');
c.html = `  <div class="card tabbed" id="cd"><div class="tab" id="tab">de l'avance</div>
    <div id="ligne"><div id="chiW">${chiffres}</div><div class="tx c-cr" id="leg">pas en avant</div></div>
    <div id="crans">${Array.from({ length: NB }, (_, k) => `<i><b id="k${k}"></b></i>`).join('')}</div>
  </div>
`;
// 1. la carte et son onglet sur « l'avance » (bloc non textuel plus haut qu'un gros mot : réglages du gros mot)
const hCarte = padH + HCH + GAP + MB.h + padB;
c.app('#cd', t(aOnglet), hCarte, 'carte');
// 2. le 0 sur « dix » (apparition), puis 1 à 10 par à-coups : écarts MINUTEUR.ecarts pris à l'envers (lent puis précipité)
const hc = cap('titre', TAILLE);
// le 0 entre comme les chiffres du minuteur (même geste que les suivants), à l'image de l'attaque de « dix »
const n0 = img(aDix.debut_s) - debut;
c.js += `tl.fromTo('#v0', { opacity: 0, y: ${(MN.entree.y * hc).toFixed(1)}, filter: 'blur(${MN.entree.flou}px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: ${Math.min(MN.entree.dmax, MN.ecarts[0] / FPS).toFixed(4)}, ease: '${MN.entree.courbe}', immediateRender: true }, ${f4(tImg(n0) - 0.0245)});\n`;
c.attendus.push({ nom: '0 sur « dix »', image: n0 });
const ecarts = MN.ecarts.slice(0, NB);                    // 6 5 4 4 3 3 3 2 2 2 images
let n = n0 + ecarts[0];            // premier pas : un écart après l'attaque de « dix »
let miDix = 0;
for (let k = 1; k <= NB; k++) {
  // comme minuteur-chiffres : l'entrée part 0,025 s avant l'image du pas (lisible à plus de 50 % SUR cette image),
  // la sortie du chiffre d'avant 0,025 s avant l'entrée ; jamais d'image sans chiffre
  const tk = tImg(n) - 0.0245, suivant = k < NB ? ecarts[k] : 8, d = Math.min(MN.entree.dmax, suivant / FPS);
  c.js += `tl.to('#v${k - 1}', { opacity: 0, y: ${(MN.sortie.y * hc).toFixed(1)}, filter: 'blur(${MN.sortie.flou}px)', duration: ${MN.sortie.d}, ease: '${MN.sortie.courbe}' }, ${f4(tk - 0.025)});\n`;
  c.js += `tl.fromTo('#v${k}', { opacity: 0, y: ${(MN.entree.y * hc).toFixed(1)}, filter: 'blur(${MN.entree.flou}px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: ${d.toFixed(4)}, ease: '${MN.entree.courbe}', immediateRender: false }, ${f4(tk)});\n`;
  c.js += `tl.to('#k${k - 1}', { scaleX: 1, duration: ${Math.min(MN.cran.dmax, suivant / FPS).toFixed(4)}, ease: '${MN.cran.courbe}' }, ${f4(tk)});\n`;
  if (k === NB) miDix = n;
  if (k < NB) n += ecarts[k];
}
c.attendus.push({ nom: '10 posé', image: miDix, mot_image: aDix.image });
// 3. la légende sur « pas en avant »
c.app('#leg', t(aLegende), cap('texte', LC.nm), 'pas en avant');
// le 0 et la légende sont calés sur leurs mots : on le note pour la vérification « jamais avant son mot »
c.attendus.find((a) => a.nom === '0 sur « dix »').mot_image = aDix.image;
c.attendus.find((a) => a.nom === 'pas en avant').mot_image = aLegende.image;
c.attendus.find((a) => a.nom === 'carte').mot_image = aOnglet.image;

ecrireCalque(dossier, {
  id: 'a05', demande: 'a05', debut, images, couche: 'devant', ordre: 20,
  sons_suggeres: [son('arrivee', debut + miDix, 'le 10 se pose (dernier pas du compteur)')],
  attendus: c.attendus.map(({ mi, ...a }) => a),
  origine: { sur_mesure: 'compteur de pas : carte + onglet, chiffre qui monte par à-coups, crans qui se remplissent',
    gestes_repris: ['carte-chrono', 'minuteur-chiffres', 'minuteur-barre', 'apparition v2'] },
}, c.page());
console.log(`CALQUE a05 : images ${debut} à ${debut + images - 1} (${images}), 10 posé à l'image ${debut + miDix}`);
