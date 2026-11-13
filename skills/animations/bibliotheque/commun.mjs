// commun.mjs : toutes les constantes du style des reels @fitavecromain, version 2 (Style Lab clos le 2026-11-11).
// Dessin (couleurs, polices, tailles, rayons, ombres, onglet, marche) : planche statique validée par Yoan le 2026-11-10,
// valeurs en px de la vidéo 1080 x 1920. Mouvement, durées, calage, positions, étalonnage, sons et niveaux : repris de la v1
// verrouillée du Style Lab. Les règles écrites sont dans STYLE.md du labo ; chaque gabarit de cette bibliothèque dit
// lesquelles de ces constantes il utilise.
// Polices : ./fonts/ (OFL). Sons : ./sons/ (ElevenLabs, licence : sons/LICENCE.md).
// Règle : aucun effet ne met une de ces valeurs en dur ; il l'importe d'ici.

export const VIDEO = { w: 1080, h: 1920, fps: 30 };

// Zone sûre Instagram (v1) : texte dans x 91-990, y 237-1479 ; colonne des boutons à droite dès y 997.
export const ZONE_SURE = { x0: 91, x1: 990, y0: 237, y1: 1479, boutons: { x0: 990, y0: 997 } };

// ---------------------------------------------------------------- couleurs (planche)
export const COULEURS = {
  orange: '#F15A24',   // pavés, onglets, numéros, mot en cours. Un seul accent par image.
  charbon: '#1A1612',  // cartes, pleins écrans, texte posé sur l'orange
  craie: '#F6F0E7',    // sous-titres, titres, ligne en cours
  braise: '#B8400F',   // uniquement la marche sous les pavés orange
};
// Contrastes mesurés (planche) : charbon sur orange 5,33:1 ; craie sur charbon 15,88:1 ; craie sur orange 2,98:1.
// D'où : jamais de texte clair sur l'orange.

// Formats natifs recopiés (Instagram) : leurs propres codes, rien de la marque.
export const NATIF = {
  bleuInstagram: '#0095F6',
  blanc: '#FFFFFF',
  noir: '#000000',
};

// ---------------------------------------------------------------- polices (planche), embarquées en local, OFL
export const POLICES = {
  titre: { family: 'Big Shoulders Display', file: 'BigShouldersDisplay.ttf', ofl: 'OFL-bigshoulders.txt',
    poids: 900, poidsOnglet: 800, casse: 'uppercase', interligne: 0.84, chiffres: 'tabular-nums' },
  texte: { family: 'Bricolage Grotesque', file: 'BricolageGrotesque.ttf', ofl: 'OFL-bricolage.txt',
    poids: 800, casse: 'none', interligne: 1.06, approche: '-0.012em', variation: '"opsz" 96' },
  natif: { family: 'Roboto', file: 'Roboto.ttf', ofl: 'OFL-roboto.txt', poids: 500 },
};

// ---------------------------------------------------------------- rayons (px vidéo, planche)
export const RAYONS = { panneau: 0, pave: 10, vignette: 10, onglet: 10, carte: 18, tampon: 16, pilule: 999 };

// ---------------------------------------------------------------- matières et ombres (planche)
export const OMBRES = {
  // texte posé sur la vidéo (sous-titres) : ombre dure 4 px vers le bas, charbon à 60 %, + halo 20 px à 35 %
  texteDure: '0 4px 0 rgba(26,22,18,.6),0 0 20px rgba(0,0,0,.35)',
  // titres des hooks (planche : « ombre-douce »)
  texteDouce: '0 6px 30px rgba(0,0,0,.45)',
  // carte posée sur la vidéo
  carte: 'inset 0 0 0 2px rgba(246,240,231,.08),0 18px 50px rgba(0,0,0,.5)',
  // champ Instagram recopié
  champNatif: '0 14px 40px rgba(0,0,0,.35)',
};
export const MARCHE = {
  pave: { hauteur: 5, couleur: COULEURS.braise },                 // pavé orange des hooks et cartes
  sousTitre: { hauteur: 4, couleur: COULEURS.braise },            // pavé du mot en cours
  paveCraie: { hauteur: 5, couleur: 'rgba(26,22,18,.35)' },       // pavé craie des hooks simples
};
export const ONGLET = { hauteur: 64, taille: 46, interligne: 68, padX: 26, fond: COULEURS.orange, texte: COULEURS.charbon,
  rayon: RAYONS.onglet, approche: '.01em', secondaireOpacite: 0.62 };
export const CARTE = { fond: COULEURS.charbon, texte: COULEURS.craie, rayon: RAYONS.carte, ombre: OMBRES.carte,
  ligneEnCours: { fond: COULEURS.craie, texte: COULEURS.charbon }, lignePassee: 0.38, secondaire: 0.62 };
// Voile sombre du haut du cadre sous les hooks : 46 % en haut, 28 % à y 520, nul à y 1020 (sous le menton).
export const VOILE = {
  standard: [[0, 0.46], [520, 0.28], [1020, 0]],
  cuisine: [[0, 0.62], [600, 0.40], [1000, 0]],     // cuisine éclairée par le haut
  demo: [[0, 0.60], [620, 0.35], [1000, 0]],        // démo en salle
  teinte: [10, 8, 6],
};

// ---------------------------------------------------------------- tailles (planche)
export const SOUS_TITRES = {
  // centreY : planche 1440, remonté de 10 px pour que pavé + marche finissent au-dessus de y 1479
  taille: 66, centreY: 1430, x0: 91, x1: 990, interligne: 1.12,
  pave: { padX: 14, padBas: 4, rayon: RAYONS.pave, marche: MARCHE.sousTitre.hauteur },
  motFort: { taille: 128, interligne: 0.86, ecart: 6, centreY: 1386 },   // planche : 1400, remonté pour la zone sûre
  motsParGroupe: 3, // formelle, mot en cours orange, mot fort
};
export const HOOKS = {
  paves: { taille: 58, interligne: 1.15, haut: 300, ecart: 10, padY: [6, 10], padX: 20 },
  titre: { phrase: 54, pave: 56, phraseXY: [91, 262], paveX: 600, ecartPave: 22 },   // pavé 22 px sous les capitales du mot géant (écart de la planche)
  motGeant: { petits: 52, hautXY: [96, 250], geantXY: [88, 300], basY: 640, basDroite: 990 },
  chiffre: { chiffre: 330, suite: 60, chiffreXY: [86, 250], suiteXY: [96, 540], paveXY: [91, 625] },
  question: { pave: 62, sujetXY: [88, 262], paveX: 91, ecartPave: 20 },
  contour: 4, // px, variante contour (v1 r3-03b)
  // Mots géants (titre, mot géant, question, CTA) : taille calculée pour que l'encre couvre la zone sûre x 94-987 (v1),
  // (mesure de l'encre de la police à la taille voulue) ; titre derrière lui : bas des capitales 30 % sous le haut du crâne (v1).
};
export const CTA = {
  champ: { x: 91, y: 1120, w: 899, pad: [18, 30, 18, 18], gap: 22, pfp: 84, taille: 46, publier: 40, curseur: [4, 52] },
  motDerriere: { top: 270 },   // planche : haut à y 270 ; taille = encre sur la zone sûre (v1)
  carte: { x: 91, y: 1110, w: 780, pad: [30, 38, 34, 38], commente: 52, mot: 170, gap: 24 },
};

// ---------------------------------------------------------------- mouvement (v1)
// Jamais de mouvement linéaire à cadence régulière (Yoan, tour 7). Courbes GSAP.
export const COURBES = { entree: 'power2.out', descente: 'power3.out', flouMouvement: 'power3.in',
  faisceauEntree: 'power1.in', faisceauSortie: 'none',
  ressortObjet: 'back.out(1.4)' };   // objets réalistes seulement (calendrier, pièce, feuille) qui se posent ; jamais les textes (Yoan, 2026-11-12)

// Objets réalistes des animations sur mesure (Yoan, 2026-11-12 : « ça fait cheap »). Seules teintes ajoutées à la palette.
export const MATIERES = {
  feutreRouge: '#D7261E',   // cercle entouré à main levée, quand le plan le demande ; jamais à la place de l'orange
  carton: '#C9A27A',        // calendrier mural, support carton
  cartonOmbre: '#9C7A55',   // tranche et pli du carton
  papier: '#FBF7F0',        // feuilles, cases du calendrier
  encre: '#2B2622',         // chiffres imprimés sur le papier
  spirale: '#8C8C8C',       // spirale métal du calendrier
};

// Dessin animé dans la DA de Romain (Yoan, 2026-11-12) : personnages au vrai dessin, aplats COULEURS + ces teintes.
export const DESSIN = {
  peauClaire: '#F2C9A5', peauMoyenne: '#D49A6A', peauFoncee: '#8D5A3B',
  cheveuxBruns: '#4A3326', cheveuxBlonds: '#D9B26F', cheveuxNoirs: '#231C17',
  vertValide: '#2FB463',    // réglage qui « s'affiche en vert », validation
  contour: '#1A1612',       // = charbon, trait des personnages
};
export const ENTREES = {
  hook: { flou: 22, duree: 0.32, cascade: [0.06, 0.18, 0.30] },  // mot géant en cascade (r5-01a)
  tete: { flou: 16, duree: 0.30 },                                // mot derrière la tête, mot du CTA (r5-02a)
  plein: { flou: 14, duree: 0.22, avance: 0.04 },                 // plein écran, panneau
  descente: { duree: 0.32, flouMouvement: 26 },                   // ABDOS qui descend du haut du cadre (r5-02c)
};
export const SOUS_TITRES_TEMPS = {
  avancePave: 1 / 30,             // paire 1 : le pavé arrive une image avant l'attaque du mot (r1-03e)
  apparitionSeche: true,          // formelle : le groupe apparaît à l'image de l'attaque de son premier mot (r2-01a)
};
export const HOOK_TEMPS = { finPaves: 60 };   // hooks pavés : affichés images 0 à 59 (r2-03)
export const CTA_TEMPS = { apparition: 43, motApres: 3 };   // CTA à l'image 43 de l'extrait, le mot 3 images après (r4-02, r5-02)
export const FAISCEAU = { largeur: 2200, etroit: 1000, hauteur: 3200, angle: 12, bord: 0.16, depart: 2300, arrivee: -2500,
  entree: 0.067, sortie: 0.09 };
export const FLASH = { paliers: [[-1, 0.5], [0, 1], [1, 0]] };   // dernière image du plan A à 50 %, coupe à 100 %
export const FRAPPE = { base: 0.036, alea: [0.7, 1.3], pause: [0.03, 0.07], avance: 0.03, lettresParSeconde: 18 };
// r11-01b : intervalle de base 0,036 s plus les pauses entre les mots = environ 18 lettres/s mesurées. Pour un mot seul (pas de pause),
// l'intervalle de base devient 1/18 s, sinon chaque lettre tombe sur l'image suivante à cadence fixe.

// ---------------------------------------------------------------- étalonnage (v1, r1-01c « contrasté net »)
export const ETALONNAGE = "curves=all='0/0 0.22/0.185 0.5/0.5 0.78/0.81 1/1',huesaturation=saturation=-0.18:colors=g+c+b,eq=saturation=1.02,unsharp=7:7:0.55:5:5:0";

// ---------------------------------------------------------------- sons (v1), niveaux par rapport à la voix
export const SONS = {
  faisceau: { fichier: 'faisceau-obtu.wav', ecartLU: 9, repere: 'debut' },   // r13-01b, sur l'image de la coupe
  arrivee: { fichier: 'arrivee-tick.wav', ecartLU: 8, repere: 'debut' },      // r13-02c, image où le mot devient lisible
  frappe: { dossier: 'frappes', ecartRmsDb: 23, variationDb: 1.5 },           // r11-01b, une par lettre
  voix: { lufs: -16, crete: -1.5 },
  cretMax: -1.0,
};

// ---------------------------------------------------------------- rendus (v1)
export const RENDU = { fullMaxMbps: 16, fullMaxMo: 20, previewMaxMo: 2, previewTaille: [540, 960], crf: 17, crfPreview: 25 };

// ================================================================ ajouts du tour 20
// ---------------------------------------------------------------- apparition v2 (ref de Yoan, references/apparition-texte.md)
// Toute entrée animée de texte ou d'élément (vignette, cadre, carte, pavé) : l'élément monte depuis un peu plus bas
// en gagnant son opacité, et son flou se dissipe un peu après (traîne). Chaque élément sur sa propre attaque de voix,
// jamais tout le bloc d'un coup. Pas de rebond, pas d'échelle. h = hauteur des capitales (ou de l'élément) en px vidéo.
export const APPARITION = {
  montee: { part: 0.13, min: 10, courbe: 'power3.out' },        // départ à +0,13 h sous sa place
  opacite: { courbe: 'power2.out' },
  flou: { part: 0.05, min: 8, courbe: 'power2.out' },           // départ à 0,05 h, finit après la montée
  // durées (s) : petit texte (h <= 50, taille sous-titre) et gros mot (h >= 280), interpolées entre les deux
  petit: { h: 50, montee: 0.35, opacite: 0.30, flou: 0.30 },
  gros: { h: 280, montee: 0.55, opacite: 0.45, flou: 0.85 },
  avance: 0.04,       // l'élément démarre 0,04 s avant l'attaque de son mot (calage v1 des entrées sur la voix)
  ecartRef: 0.17,     // écart entre deux éléments dits d'un trait sans attaque nette (ref : 0,17 s)
};
export function apparitionReglages(h) {
  const A = APPARITION, k = Math.min(1, Math.max(0, (h - A.petit.h) / (A.gros.h - A.petit.h)));
  const mix = (c) => A.petit[c] + (A.gros[c] - A.petit[c]) * k;
  return { dy: Math.max(A.montee.min, A.montee.part * h), flou: Math.max(A.flou.min, A.flou.part * h),
    dMontee: mix('montee'), dOpacite: mix('opacite'), dFlou: mix('flou') };
}
// Code GSAP de l'apparition (timeline « tl »). L'élément animé ne doit porter aucun transform CSS (sinon l'envelopper).
export function apparitionJs(sel, t, h) {
  const R = apparitionReglages(h), A = APPARITION, f = (x) => Math.max(0, x).toFixed(4);
  return `tl.fromTo('${sel}', { y: ${R.dy.toFixed(1)} }, { y: 0, duration: ${R.dMontee.toFixed(3)}, ease: '${A.montee.courbe}', immediateRender: true }, ${f(t)});\n`
    + `tl.fromTo('${sel}', { opacity: 0 }, { opacity: 1, duration: ${R.dOpacite.toFixed(3)}, ease: '${A.opacite.courbe}', immediateRender: true }, ${f(t)});\n`
    + `tl.fromTo('${sel}', { filter: 'blur(${R.flou.toFixed(1)}px)' }, { filter: 'blur(0px)', duration: ${R.dFlou.toFixed(3)}, ease: '${A.flou.courbe}', immediateRender: true }, ${f(t)});\n`;
}
// Instant où l'opacité passe 0,5 (power2.out : p = 1 - 1/sqrt(2)) : le tick d'arrivée (SONS.arrivee) se cale sur cette image.
export function apparitionMiOpacite(t, h) { return t + (1 - Math.SQRT1_2) * apparitionReglages(h).dOpacite; }

// ---------------------------------------------------------------- sous-titres classiques resserrés (note du tour 19)
// Espace entre les mots resserré (word-spacing CSS), deux réglages proposés au tour 20.
export const SOUS_TITRES_ECART = { serre: '-0.08em', tresSerre: '-0.14em' };   // lettres de deux mots voisins : 27 px au tour 19, 22 et 18 px ici
// Mot fort (correction du tour 19) : les sous-titres restent en bas ; le mot fort se pose au-dessus de la ligne,
// sur son mot, avec l'apparition v2. ecart = entre le bas de ses capitales et le haut des minuscules de la ligne.
export const MOT_FORT = { taille: 128, ecart: 22 };
// Titre derrière lui (correction) : toute la composition derrière lui, phrase plus haut, écart resserré entre la phrase
// et le mot géant (ligne de base de la phrase -> haut des capitales). Deux écarts proposés.
export const TITRE_DERRIERE = { phraseTop: 250, ecarts: [16, 34], ecartPave: 22 };

// ---------------------------------------------------------------- pleins écrans (planche + v1 r4-03)
export const FONDS = {
  charbon: { fond: COULEURS.charbon, texte: COULEURS.craie },
  orange: { fond: COULEURS.orange, texte: COULEURS.charbon },
  craie: { fond: COULEURS.craie, texte: COULEURS.charbon },
  // sa vidéo qui continue de tourner sous le flou (jamais une image figée), CSS blur = sigma
  flou: { sigma: 20, niveau: 0.40, texte: COULEURS.craie },        // planche : liste sur sa vidéo floutée
  flouFort: { sigma: 40, niveau: 0.28, texte: COULEURS.craie },    // planche : barre qui se vide
};
export const PLEIN = { x: 91, largeur: 899, centreY: 960, coupPoing: 250, calme: 72, ecartChute: 24 };
// Demi-écran (v1 r6-01, mouvement du labo de Yoan) : panneau charbon qui descend (courbe « banque » 0,70 s), pousse son
// visage de 560 px, fondu de 260 px ; sortie sèche 0,07 s, bascule en plein écran 0,5 s power2.inOut, ou faisceau.
export const DEMI = { ty: 560, hauteur: 1080, fondu: 260, sortie: 0.07, bascule: { d: 0.5, hauteur: 2200, pousse: 1080, courbe: 'power2.inOut' },
  phrase: 66, mot: 180, motMax: 180, ecartMot: 18, xy: [91, 250] };
// Liste (planche « Liste sur charbon ») : bloc centré à y 960, chiffres Big Shoulders orange 96, texte Bricolage 72,
// ligne en cours craie (texte charbon), lignes passées à 38 %. Passage d'une ligne à l'autre en 0,25 s sine.inOut (v1).
export const LISTE = { centreY: 960, chiffre: 96, texte: 72, colChiffre: 70, gap: 24, pad: 14, rayon: 12, ecartLignes: 8,
  passe: 0.38, bascule: { d: 0.25, courbe: 'sine.inOut' } };
// Minuteur (v1 r8-03 pour le mouvement, planche pour le dessin) : à-coups qui partent lentement et se précipitent.
export const MINUTEUR = { ecarts: [6, 5, 4, 4, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2],
  sortie: { d: 0.05, y: -0.16, flou: 8, courbe: 'power3.in' }, entree: { dmax: 0.22, y: 0.20, flou: 10, courbe: 'expo.out' },
  cran: { dmax: 0.26, courbe: 'expo.out' },
  seuls: { taille: 470, centreY: 960, libelle: 52, libelleY: 1230, libelleOpacite: 0.62 },
  barre: { taille: 330, chiffreY: 780, x: 91, w: 899, h: 44, y: 1080, separation: 4, couleurSeparation: '#120f0c', fond: 'rgba(246,240,231,.14)',
    libelleY: 1150 } };
// Schéma (planche) : causes en cadres à trait craie 3 px à 22 %, Bricolage 60 ; trait 5 px de 130 px avec un point à
// chaque bout ; effet sur pavé orange Big Shoulders 140 texte charbon. Le « + » en craie (un seul orange par image).
export const SCHEMA = { cadre: { trait: 3, couleur: 'rgba(246,240,231,.22)', rayon: 18, pad: 34, texte: 60, fond: 'rgba(246,240,231,.05)' },
  plus: 110, trait: { ep: 5, point: 9, long: 130, d: 0.35, courbe: 'power2.inOut' }, effet: { taille: 140, pad: [28, 30, 22] },
  descente: { d: 0.55, courbe: 'power3.inOut' } };
// Comparaison (planche « la bonne option » + v1 r9-01a) : grille de pictos craie qui sature, se grise et s'effondre,
// puis trois vignettes carrées 286 px rayon 10 sur une ligne (clic + éclair 65 % sur chacune), puis le mot en Big Shoulders 170.
export const COMPARAISON = { gris: '#56524D', vignette: 286, ecart: 20, vignetteY: 700, eclair: 0.65, mot: 170, motY: 1060 };
SONS.clic = { fichier: 'clic.wav', ecartRmsDb: 14 };   // v1 r8-02 / r9-01 : clic d'appareil photo, 14 dB sous la voix parlée
// Décision de Yoan (2026-11-13) : un clic sur chaque transition (flash, entrée et sortie d'un plein écran), le même clic
// et le même niveau que les tests v2 à v8 ; le « Vine boom » sur chaque image de réaction (mème), 12 LU sous la voix
// comme au test v3 (son grave fourni par Yoan, seule exception à « rien sous 300 Hz »).
SONS.transition = { fichier: 'clic.wav', ecartRmsDb: 14 };
SONS.meme = { fichier: 'meme-vine-boom.wav', ecartLU: 12 };
SONS.entree = { fichier: 'entree.wav', ecartRmsDb: 17 };

// ================================================================ ajouts du tour 21
// Sous-titres classiques (note du tour 20) : mots resserrés à 18 px (SOUS_TITRES_ECART.tresSerre) et le pavé GLISSE d'un
// mot à l'autre au lieu de sauter. Il part avant l'attaque du mot et s'y pose pile à l'image où le mot devient le mot en
// cours (avancePave), en courbe, jamais en ligne droite.
export const SOUS_TITRES_GLISSE = { d: 0.12, courbe: 'power2.inOut' };
// Pleins écrans (note du tour 20) : le fond s'affiche un peu avant le premier texte ; texte sur 2 lignes de même largeur.
export const PLEIN_TEMPS = { avanceFond: 0.25 };

// ---------------------------------------------------------------- cartes de la planche (px vidéo)
// Toutes : carte charbon rayon 18 (CARTE), onglet orange (ONGLET), une seule zone orange en plus. Chaque élément entre
// avec l'apparition v2 (APPARITION), la carte d'abord, puis chaque ligne sur son mot.
export const LIGNE_CARTE = { num: 72, img: 132, nm: 46, sm: 30, gap: 24, pad: 14, rayon: 12, ecart: 8, smOpacite: 0.62 };
export const SEANCE = { x: 91, y: 600, w: 899, pad: 38 };
export const SUPERSET = { x: 91, y: 560, w: 899, pad: 30, barre: 14, barreRayon: 7, barreMarge: 70, gapBarre: 26 };
export const FICHE = { x: 140, y: 398, w: 800, pad: 24, nom: 70, nomMarge: [26, 10, 20], cases: { chiffre: 96, legende: 28, pad: 18, gap: 12, fond: 'rgba(246,240,231,.08)', legendeOpacite: 0.7 } };
export const RESULTAT = { x: 91, y: 1110, wMin: 640, pad: [34, 40, 38], chiffre: 210, unite: 0.38, ligne: 40, ligneMarge: 18 };
export const CHAPITRE = { x: 91, y: 280, num: 200, titre: 120, petit: 38, rayon: 14, petitOpacite: 0.7 };
// Présentation : x 97 pour que l'anneau orange de 6 px de la photo commence à x 91 (bord de la zone sûre).
export const PRESENTATION = { x: 97, y: 1150, pfp: 150, anneau: 6, gap: 26, nom: 110, ligne: 38, pseudo: 34, voileBas: [[0, 0.55], [760, 0]] };
export const NUTRITION = { x: 91, y: 1008, w: 820, pad: 26, gap: 14, legende: 34, total: 96, totalSuite: 34 };
export const CHRONO = { x: 520, y: 300, w: 470, pad: [26, 32, 30], chiffre: 190, legende: 34, legendeOpacite: 0.7 };
// B-roll annoté : sa démo dans une carte rayon 18 (x 91-990, y 380-1504) sur charbon ; point orange 26 px avec halo 7 px à
// 30 %, trait orange de 5 px coudé qui se trace (comme le schéma), étiquette sur pavé orange Bricolage 46 texte charbon.
export const BROLL = { carte: [91, 380, 899, 1124], point: 26, halo: 7, trait: 5, trace: { d: 0.35, courbe: 'power2.inOut' }, etiquette: 46, pente: 0.4 };
// Angle du coude (v1 r15-03c, valeur mesurée image par image) : rayons et arc craie, centre orange, valeur Big Shoulders.
export const ANGLE = { trait: 5, arc: 84, rayon: 250, centre: 9, chiffre: 96, ecartChiffre: 175 };
// Tampon verdict (planche) : cadre craie 10 px rayon 16, coche craie et texte Big Shoulders 108, penché de 4 degrés.
export const TAMPON = { droite: 975, y: 300, cadre: 10, rayon: 16, coche: 84, texte: 108, angle: -4, fond: 'rgba(26,22,18,.35)', pad: [16, 30, 10], gap: 18 };
// Anatomie (v1 r10-03a) : silhouettes inchangées, muscle allumé en orange, fond charbon.
export const ANATOMIE = { gris: '#3A3734', echelle: 4.2, haut: 540, centres: [302, 778], allume: { d: 0.20, courbe: 'power2.out' }, eteint: { d: 0.25, courbe: 'sine.inOut' } };
// Fond vert (planche) : lui détouré devant ses mots, Big Shoulders 900 ; a fond orange, texte charbon, chiffre craie à 92 % ;
// b fond charbon, texte craie, chiffre orange, lui réduit à 70 % en bas à droite, ses mots au-dessus de sa tête.
export const VERT = { phraseMax: 150, chiffreA: 980, chiffreOpacite: 0.92, phraseB: 170, chiffreB: 400, ecart: 16 };
// Tier list (format connu, v1 r17-01a, codes de TierMaker) : rangées et vignettes de la planche (rangée 170, vignette 162
// posée dans la rangée), étiquettes Liberation Sans 56 (métrique d'Arial, même dessin qu'Arimo).
export const TIER = { x: 91, y: 238, w: 898, filet: 3, etiquette: 170, rangee: 170, vignette: 162, taille: 56, reserveEcart: 40,
  rangs: [['S', '#FF7F7F'], ['A', '#FFBF7F'], ['B', '#FFDF7F'], ['C', '#FFFF7F'], ['D', '#BFFF7F']], fond: '#1A1A17', noir: '#121212' };
