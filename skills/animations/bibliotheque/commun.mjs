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
  craie: '#F6F0E7',    // titres, ligne en cours
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

// ---------------------------------------------------------------- police (une seule dans toute la vidéo), embarquée en local, OFL
// Yoan, 2026-11-14 : tous les textes de la vidéo (sous-titres, hooks, titres, pleins écrans, cartes, listes, schéma, CTA,
// minuteurs, mots géants...) sont dans LA police des sous-titres. Seuls les formats natifs recopiés (Roboto de la recherche
// Google et du champ Instagram, Liberation Sans de la tier list, police système du Calendrier d'Apple) gardent la leur.
// La police est UN réglage : POLICES.sousTitres. Inter Black (choisie par Romain le 29/10) tant qu'il n'en a pas choisi une
// autre. Pour changer : poser le .ttf STATIQUE (une seule graisse) et sa licence OFL dans fonts/, changer ces quatre
// valeurs, puis `node scripts/maj-sous-titres.mjs` (skill animations) qui réécrit les blocs POLICE et SOUS-TITRES de tous
// les gabarits ; les calques d'une vidéo se refont (sous-titres preparer, instancier, effets sur mesure). Interligne et
// approche de titre et texte sont réglés pour Inter Black : à revoir sur la planche avec une autre police. Candidates
// (OFL) : Atkinson Hyperlegible Next, Archivo, Barlow Semi Condensed, Schibsted Grotesk, Rubik, Lexend.
const POLICE = { family: 'Inter Black', file: 'Inter-Black.ttf', ofl: 'OFL-inter.txt', poids: 900 };
export const POLICES = {
  sousTitres: POLICE,
  // capitales (titres, mots géants, chiffres, onglets) : interligne 0,92 (lignes de capitales serrées sans se toucher),
  // approche -0,02 em ; chasse fixe des chiffres (chiffres) seulement par la classe .num (dans Inter, tabular-nums
  // élargit aussi des lettres)
  titre: { ...POLICE, casse: 'uppercase', interligne: 0.92, approche: '-0.02em', chiffres: 'tabular-nums' },
  // minuscules (phrases des hooks, textes des cartes et des animations)
  texte: { ...POLICE, casse: 'none', interligne: 1.06, approche: '-0.02em' },
  natif: { family: 'Roboto', file: 'Roboto.ttf', ofl: 'OFL-roboto.txt', poids: 500 },   // formats natifs seulement
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
// Sous-titres (Yoan, 2026-11-13, après le retour de Romain) : ceux qu'il a choisis le 29/10 et utilisés jusqu'ici
// (captions_romain.py du serveur de montage, fonctions groups() et sous_titres()), refaits en calque HyperFrames.
// Tailles en fraction : px de la police = round(taille x largeur x réglage « taille » de sous-titres.json), 71 px en 1080.
export const SOUS_TITRES = {
  police: POLICES.sousTitres,   // le réglage police est dans POLICES.sousTitres (un seul endroit)
  taille: 0.066,          // x largeur de la vidéo (71 px en 1080), x le réglage « taille » (1 par défaut)
  approche: -0.05,        // lettres resserrées de 5 % de la taille, pas les espaces
  couleur: '#FFFFFF',     // blanc pur, posé aussi sur le pavé orange (choix de Romain)
  position: 0.70,         // centre de la ligne (milieu des capitales), fraction de la hauteur : réglage « position »
  largeurMax: 0.84,       // une ligne fait au plus 0,84 x la largeur
  caracteresMax: 20,      // par groupe, divisé par le réglage « taille »
  motsMax: 4,             // groupes de 1 à 4 mots
  coupePhrase: 0.15,      // s : un blanc plus long entre deux mots coupe la phrase (la coupe des silences laisse ~0,2 s)
  pause: 0.5,             // s : après un blanc >= 0,5 s le groupe monte en fondu ; suivi d'un blanc < 0,5 s, il part au début du suivant
  apresDernier: 0.25,     // s : un groupe suivi d'un blanc reste 0,25 s après la fin de son dernier mot, puis s'efface
  entree: { duree: 0.15, montee: 14 },   // fondu et montée de 14 px (en 1080) du premier groupe après un blanc
  // Volume (réglage « volume » de sous-titres.json) : PROVISOIRE (Yoan, 2026-11-15) en attendant le choix de Romain :
  // par défaut le niveau 2 de la page de choix (3 à 4 mots, une ligne). L'ancien réglage (1 à 4 mots, 20 caractères,
  // coupe à 0,15 s) reste accessible : « volume »: "ancien".
  volume: { mots_max: 4, caracteres_max: null, lignes: 1, coupe_pause: 0.25, virgules: true },
  volumeAncien: { mots_max: 4, caracteres_max: 20, lignes: 1, coupe_pause: 0.15, virgules: false },
  sortie: 0.11,           // s : fondu de sortie d'un groupe suivi d'un blanc
  glisse: 0.12,           // s : le pavé glisse d'un mot au suivant, bords gauche et droit à vitesse constante (comme l'ASS)
  // ombre douce : copie noire du texte, bordure 4 px, flou 9 (px en 1080), opacités du texte 0,655 et de la bordure 0,404
  // (alphas ASS &H58 et &H98). flouCss : écart-type du flou CSS équivalent au \blur9 de libass, dont le noyau gaussien
  // tombe à 1/256 au rayon 9 : sigma = 9 / racine(2 ln 256) = 2,7.
  ombre: { bord: 4, flou: 9, flouCss: 2.7, texte: 0.655, bordure: 0.404 },
  // pavé orange arrondi sous le mot dit, en fraction de la taille px : marges padX ; du haut des capitales - padY - haut
  // jusqu'à capitales + 2 padY + bas plus bas ; rayon 0,18
  // actif : le pavé sous le mot dit (choix de Romain du 29/10). Essai de Yoan du 2026-11-14 : sans pavé, pour voir si
  // ça fait plus professionnel ; réglage « pave » de sous-titres.json (true / false), qui passe avant cette valeur.
  // Sans pavé, tout le reste est identique (police, blanc, ombre, montée en fondu, groupes) ; la ligne « commente MOT »
  // des CTA garde son pavé sur le MOT (il marque le mot à écrire).
  pave: { actif: true, couleur: COULEURS.orange, padX: 0.17, padY: 0.11, haut: 0.03, bas: 0.16, rayon: 0.18 },
};
export const HOOKS = {
  paves: { taille: 58, interligne: 1.15, haut: 300, ecart: 10, padY: [6, 10], padX: 20 },
  titre: { phrase: 54, pave: 56, phraseXY: [91, 262], paveX: 600, ecartPave: 22 },   // pavé 22 px sous les capitales du mot géant (écart de la planche)
  motGeant: { petits: 52, hautXY: [96, 250], geantXY: [94, 278.88], basY: 532, basDroite: 990 },   // Inter (2026-11-14) : mêmes écarts qu'en Big Shoulders
  chiffre: { chiffre: 330, suite: 60, chiffreXY: [86, 250], suiteXY: [96, 540], paveXY: [91, 625] },
  question: { pave: 62, sujetXY: [88, 262], paveX: 91, ecartPave: 20 },
  contour: 4, // px, variante contour (v1 r3-03b)
  // Mots géants (titre, mot géant, question, CTA) : taille calculée pour que l'encre couvre la zone sûre x 94-987 (v1),
  // (mesure de l'encre de la police à la taille voulue) ; titre derrière lui : bas des capitales 30 % sous le haut du crâne (v1).
};
export const CTA = {
  champ: { x: 91, y: 1120, w: 899, pad: [18, 30, 18, 18], gap: 22, pfp: 84, taille: 46, publier: 40, curseur: [4, 52] },
  motDerriere: { top: 247 },   // haut des capitales à y 272 (planche) ; taille = encre sur la zone sûre (v1)
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
// Pavé d'une ligne de sous-titre (sous-titres, ligne « commente MOT » des CTA) : il part du mot d'avant à l'attaque du mot
// et glisse SOUS_TITRES.glisse (sous-titres de Romain, 2026-11-13 ; avant : une image avant l'attaque).
export const SOUS_TITRES_TEMPS = { avancePave: 0 };
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
// Attaque d'un mot (Yoan, 2026-11-14, retours sur v14, règle définitive) : tout texte animé calé sur un mot (sous-titres
// enrichis, mots et lignes des pleins écrans et animations) démarre 3 images (0,1 s) AVANT le début transcrit du mot, pour
// être pleinement visible quand il commence à le dire (la transcription place souvent le début sur la voyelle :
// « semaines » transcrit 5,522 s, le « s » part vers 5,46 s). Garde-fou : jamais avant le milieu du mot précédent
// (plancher x sa durée), jamais avant 0. Une seule fonction : attaqueMot de scripts/lib/style.mjs (resoudre la donne
// dans debut_s / image ; le début transcrit reste dans transcrit_s / image_transcrite). Les sous-titres de la brique
// sous-titres n'utilisent pas cette fonction (leurs groupes partent au début transcrit, règle de l'ancien skill).
export const ATTAQUE = { avance: 0.1, plancher: 0.5 };
export const APPARITION = {
  montee: { part: 0.13, min: 10, courbe: 'power3.out' },        // départ à +0,13 h sous sa place
  opacite: { courbe: 'power2.out' },
  flou: { part: 0.05, min: 8, courbe: 'power2.out' },           // départ à 0,05 h, finit après la montée
  // durées (s) : petit texte (h <= 50, taille sous-titre) et gros mot (h >= 280), interpolées entre les deux
  petit: { h: 50, montee: 0.35, opacite: 0.30, flou: 0.30 },
  gros: { h: 280, montee: 0.55, opacite: 0.45, flou: 0.85 },
  avance: 0,          // l'élément démarre à l'attaque de son mot (ATTAQUE : 0,1 s avant la transcription) ; avant le
                      // 2026-11-14 : 0,04 s avant le début transcrit
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

// Montée du bas, accent rare (Yoan, 2026-11-14, retours sur v12) : le mot monte de 40 px depuis plus bas en passant de
// transparent à plein, en 0,4 s, sortie cubique (1 - (1 - p)^3), départ 0,04 s avant l'attaque de son mot, sans flou,
// TOUJOURS en saccade à 12 i/s (paliers de 1/12 s comptés depuis le départ, le premier palier dès l'image du départ).
// Elle ne sert qu'à accentuer une phrase (rupture de motif), avec parcimonie : jamais l'apparition des sous-titres
// enrichis ni des pleins écrans texte. Exemple validé : le titre du haut du plein écran puzzle (a14 du test v12).
// L'élément animé ne doit porter aucun transform CSS.
export const MONTEE_ACCENT = { montee: 40, duree: 0.4, avance: 0, ips: 12 };   // départ = l'attaque (ATTAQUE)
// progression (0 à 1, avant la courbe) d'un élément parti à l'instant « depart », vue à l'instant t : paliers de 1/ips s
export function progresAccent(t, depart) {
  const M = MONTEE_ACCENT;
  return t < depart - 1e-6 ? 0 : Math.min(1, (Math.floor((t - depart) * M.ips + 1e-6) + 1) / M.ips / M.duree);
}
export const sortieCubique = (x) => 1 - Math.pow(1 - x, 3);
// Code GSAP (timeline « tl ») : la courbe est quantifiée dans la fonction d'ease (paliers de 1/12 s depuis le départ).
export function monteeAccentJs(sel, t) {
  const M = MONTEE_ACCENT, f = (x) => Math.max(0, x).toFixed(4);
  const ease = `(p) => { const q = Math.min(1, (Math.floor(p * ${M.duree} * ${M.ips} + 1e-6) + 1) / ${M.ips} / ${M.duree}); return 1 - Math.pow(1 - q, 3); }`;
  return `tl.fromTo('${sel}', { y: ${M.montee}, opacity: 0 }, { y: 0, opacity: 1, duration: ${M.duree}, ease: ${ease}, immediateRender: true }, ${f(t)});\n`;
}

// Apparition « coup de poing » des sous-titres enrichis (Yoan, 2026-11-14, choisie sur le comparatif des apparitions,
// carte C2) : PAR LIGNE, toute la ligne arrive d'un coup à l'attaque du premier mot de la ligne (« 12 premières » sur
// « douze », « semaines » sur « semaines ») ; échelle 1,3 -> 1 en 0,2 s, sortie cubique (power2.out de GSAP), opacité
// 0 -> 1 sur le premier tiers (0,067 s, trop court pour se voir linéaire), origine de l'échelle au centre de la ligne,
// à 70 % de sa hauteur ; 30 i/s. Sortie inchangée : tout repart d'un coup. Seule exception à « pas d'échelle sur un texte ».
export const APPARITION_LIGNE = { duree: 0.2, echelle: 1.3, opacite: 0.067, origine: [0.5, 0.7], courbe: 'power2.out' };
// sel : le conteneur de la ligne (la ligne se comporte comme UN mot : une seule échelle pour toute la ligne, jamais une
// par mot), transform-origin 50 % 70 % ; t : départ (s du calque)
export function apparitionLigneJs(sel, t) {
  const A = APPARITION_LIGNE, f = (x) => Math.max(0, x).toFixed(4);
  return `tl.fromTo('${sel}', { scale: ${A.echelle} }, { scale: 1, duration: ${A.duree}, ease: '${A.courbe}', immediateRender: true }, ${f(t)});\n`
    + `tl.fromTo('${sel}', { opacity: 0 }, { opacity: 1, duration: ${A.opacite}, ease: 'none', immediateRender: true }, ${f(t)});\n`;
}
// Soulignage à main levée des sous-titres enrichis (Yoan, 2026-11-14, carte 1b) : même trait, plus épais (0,13 x la
// taille du mot) et plus vif (0,17 s, power2.out), départ inchangé (attaque du dernier mot souligné).
export const SOULIGNE = { ep: 0.13, duree: 0.17, courbe: 'power2.out' };
// Sous-titres enrichis, règle finale (Yoan, 2026-11-14) : texte en gros en majuscules ; taille = les sous-titres x 1,0 à
// 1,2 AU PLUS selon l'importance (retour sur v13 : 1,45 était trop gros, les majuscules grossissent déjà ; ça doit
// ressortir un peu, pas sauter aux yeux) : fort 1,2 (« 12 SEMAINES »), moyen 1,15 (« SUR LE / LONG TERME »), ligne
// secondaire d'un groupe à deux étages 1,05 (« 12 PREMIÈRES ») ; une taille par ligne ; plus de motsMax mots en gros =
// deux lignes ; écart entre deux lignes : ligne de base du haut = base du bas - capitales du bas - ecart x taille du bas.
// verifier.mjs refuse une ligne d'enrichi au-delà de max x la taille des sous-titres.
export const ENRICHI = { min: 1.0, max: 1.2, fort: 1.2, moyen: 1.15, secondaire: 1.05, motsMax: 2, ecart: 0.3, casse: 'haute' };

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
// Liste (planche « Liste sur charbon ») : bloc centré à y 960, chiffres capitales orange 96, texte 72,
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
// Schéma (planche) : causes en cadres à trait craie 3 px à 22 %, texte 60 ; trait 5 px de 130 px avec un point à
// chaque bout ; effet sur pavé orange capitales 140 texte charbon. Le « + » en craie (un seul orange par image).
// Case cochée (Yoan, 2026-11-14, retours sur v12 : « la coche ne remplit pas la case, c'est bizarre ») : sur son instant,
// la case se remplit de la couleur de son trait (0,08 s), puis la coche se trace par-dessus dans la couleur du fond
// (0,12 s) et occupe la case (de 20 % à 80 % de sa largeur, 26 % à 74 % de sa hauteur). Case et coche sont dessinées
// dans le MÊME repère (un seul SVG de la taille de la case, trait compris) : la v12 traçait la coche dans un repère
// décalé de l'épaisseur du bord, elle tombait en bas à droite et petite. Rayon : RAYONS.vignette rapporté à la case.
export const CASE_COCHEE = { remplir: 0.08, tracer: 0.12, ecart: 0.15, coche: [[0.22, 0.52], [0.42, 0.72], [0.80, 0.28]], epCoche: 0.13 };
export const SCHEMA = { cadre: { trait: 3, couleur: 'rgba(246,240,231,.22)', rayon: 18, pad: 34, texte: 60, fond: 'rgba(246,240,231,.05)' },
  plus: 110, trait: { ep: 5, point: 9, long: 130, d: 0.35, courbe: 'power2.inOut' }, effet: { taille: 140, pad: [28, 30, 22] },
  descente: { d: 0.55, courbe: 'power3.inOut' } };
// Comparaison (planche « la bonne option » + v1 r9-01a) : grille de pictos craie qui sature, se grise et s'effondre,
// puis trois vignettes carrées 286 px rayon 10 sur une ligne (clic + éclair 65 % sur chacune), puis le mot en capitales (170 au plus, dans la zone sûre).
export const COMPARAISON = { gris: '#56524D', vignette: 286, ecart: 20, vignetteY: 700, eclair: 0.65, mot: 170, motY: 1060 };
SONS.clic = { fichier: 'clic.wav', ecartRmsDb: 14 };   // v1 r8-02 / r9-01 : clic d'appareil photo, 14 dB sous la voix parlée
// Décision de Yoan (2026-11-13) : un clic sur chaque transition (flash, entrée et sortie d'un plein écran), le même clic
// et le même niveau que les tests v2 à v8 ; le « Vine boom » sur chaque image de réaction (mème), 12 LU sous la voix
// comme au test v3 (son grave fourni par Yoan, seule exception à « rien sous 300 Hz »).
SONS.transition = { fichier: 'clic.wav', ecartRmsDb: 14 };
SONS.meme = { fichier: 'meme-vine-boom.wav', ecartLU: 12 };
SONS.entree = { fichier: 'entree.wav', ecartRmsDb: 17 };
// Sons retenus par Yoan sur le test v17 (2026-11-14). Niveaux en dB RMS sous la voix parlée, l'échelle des clics
// (clics 14 ; le Vine boom, réglé en 12 LU, vaut 8,2 sur cette échelle).
SONS.ecran = { fichier: 'clic-court.wav', ecartRmsDb: 21 };        // captures qui défilent : un clic par changement d'écran (7 dB sous les transitions)
SONS.pose = { fichier: 'pose-clac.wav', ecartRmsDb: 8 };           // objet qui se pose (pièce de puzzle) : clac sec, niveau du Vine boom
SONS.coche = { fichiers: ['coche-1.wav', 'coche-2.wav', 'coche-3.wav'], ecartRmsDb: 8 };   // une case = un tick, de plus en plus aigu
SONS.montee = { fichier: 'montee.wav', ecartRmsDb: 10, finAvantImages: 1 };   // moment fort principal (un seul) : finit net sur son son d'entrée
SONS.serieMaxS = 0.2;   // une série (écrans, cases) : sons d'un même geste à moins de 0,2 s l'un de l'autre

// ================================================================ ajouts du tour 21
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
export const NUTRITION = { x: 91, y: 1008, w: 820, pad: 26, gap: 14, legende: 34, total: 73, totalSuite: 34 };   // total : même largeur d'encre que 96 px en Big Shoulders (2026-11-14)
export const CHRONO = { x: 500, y: 300, w: 490, pad: [26, 32, 30], chiffre: 145, legende: 34, legendeOpacite: 0.7 };   // chiffre : même largeur que 190 px en Big Shoulders
// B-roll annoté : sa démo dans une carte rayon 18 (x 91-990, y 380-1504) sur charbon ; point orange 26 px avec halo 7 px à
// 30 %, trait orange de 5 px coudé qui se trace (comme le schéma), étiquette sur pavé orange 46 texte charbon.
export const BROLL = { carte: [91, 380, 899, 1124], point: 26, halo: 7, trait: 5, trace: { d: 0.35, courbe: 'power2.inOut' }, etiquette: 46, pente: 0.4 };
// Angle du coude (v1 r15-03c, valeur mesurée image par image) : rayons et arc craie, centre orange, valeur en capitales.
export const ANGLE = { trait: 5, arc: 84, rayon: 250, centre: 9, chiffre: 96, ecartChiffre: 175 };
// Tampon verdict (planche) : cadre craie 10 px rayon 16, coche craie et texte capitales 108, penché de 4 degrés.
export const TAMPON = { droite: 975, y: 300, cadre: 10, rayon: 16, coche: 84, texte: 108, angle: -4, fond: 'rgba(26,22,18,.35)', pad: [16, 30, 10], gap: 18 };
// Anatomie (v1 r10-03a) : silhouettes inchangées, muscle allumé en orange, fond charbon.
export const ANATOMIE = { gris: '#3A3734', echelle: 4.2, haut: 540, centres: [302, 778], allume: { d: 0.20, courbe: 'power2.out' }, eteint: { d: 0.25, courbe: 'sine.inOut' } };
// Fond vert (planche) : lui détouré devant ses mots, en capitales ; a fond orange, texte charbon, chiffre craie à 92 % ;
// b fond charbon, texte craie, chiffre orange, lui réduit à 70 % en bas à droite, ses mots au-dessus de sa tête.
export const VERT = { phraseMax: 150, chiffreA: 729, chiffreOpacite: 0.92, phraseB: 170, chiffreB: 400, ecart: 16 };
// Tier list (format connu, v1 r17-01a, codes de TierMaker) : rangées et vignettes de la planche (rangée 170, vignette 162
// posée dans la rangée), étiquettes Liberation Sans 56 (métrique d'Arial, même dessin qu'Arimo).
export const TIER = { x: 91, y: 238, w: 898, filet: 3, etiquette: 170, rangee: 170, vignette: 162, taille: 56, reserveEcart: 40,
  rangs: [['S', '#FF7F7F'], ['A', '#FFBF7F'], ['B', '#FFDF7F'], ['C', '#FFFF7F'], ['D', '#BFFF7F']], fond: '#1A1A17', noir: '#121212' };
