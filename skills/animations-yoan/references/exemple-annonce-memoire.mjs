/**
 * demi-haut-annonce-memoire v3 : le motion design de la MOITIE HAUTE du reel `ia-memoire-coach`,
 * dans le LANGAGE DE MOUVEMENT de `sequence-annonce-produit`.
 *
 * REFONTE du 2026-08-10 (seconde passe, sur retour de Yoan). La v2 avait corrige l'espace
 * (objets heros centres, vide, fond en tache, orange de promesse) mais restait FIGEE : les
 * objets apparaissaient sur place et y restaient. Ce que Yoan nomme « premium » dans la
 * reference (« ca accelere d'un coup, puis ca freine, puis il y a un truc qui se passe »)
 * est son VOCABULAIRE DE MOUVEMENT, lisible dans ses tables mesurees :
 *
 *   . une carte n'apparait pas : elle POPPE en echelle depuis 4 % (table P1_ECH de la
 *     reference, origine en bas au centre), 62 % de la course en 6 images ;
 *   . rien ne disparait sur place : tout SORT en ACCELERATION exponentielle juste avant la
 *     coupe (P1_SORTIE_DY : 0, -0,5, -1,5, -3,5, -6,5, -14 — chaque image double la
 *     precedente), et la coupe attrape l'objet en plein vol ;
 *   . la barre sort par la DROITE en accelerant (queue de P2_BARRE_DX) pendant que la suite
 *     entre par la gauche : les gestes se CHEVAUCHENT ;
 *   . entre deux gestes un plan TIENT, immobile, comme les cartes de la reference entre
 *     leurs gestes : la derive continue de tenue a ete essayee et RETIREE (voir la note
 *     deterministe plus bas) ;
 *   . la poussee est un SAUT FRANC (x1,85) suivi d'une DERIVE (1,85 → 2,18) : l'energie
 *     puis l'amorti.
 *
 * La v3 rejoue ces tables-la, REPRISES DE L'ENTREE `sequence-annonce-produit` (mesurees sur
 * `banque/motion-anim1.mp4`), sur la geometrie et les couleurs de la v2. Les seules courbes
 * non mesurees (le punch d'impact, l'extension de sortie hors cadre) sont declarees ecrites.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * LE CONTRAT DES « plans » EST RELACHE (décision de Yoan, 2026-08-10) : chaque action de la
 * timeline fournit un INSTANT (« t »), lu comme un BEAT de chorégraphie ; le champ « geste »
 * n'est plus contrôlé ni imposé. La mise en scène de chaque numéro de plan décide seule de
 * ce qui se passe à chaque beat. Nombre de beats attendu par plan : celui de la timeline du
 * reel (3, 4, 3, 4, 4, 3, 3, 6, 3, 6, 3, 6) ; un beat manquant lève une erreur nommée.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * LA GEOMETRIE, inchangee depuis la v2 : contenu compose en 1080 x 1920, fenetre visible
 * `hauteur_bandeau` x 1920 (le fond court jusqu'a la couture), zone de dessin fermee a
 * `reserve_bas_px` au-dessus des sous-titres. Compositions centrees sur y ≈ 452.
 * LE FOND, inchange depuis la v2 : tache gaussienne de la charte (§04), source hors cadre
 * alternee gauche/droite par parite du numero de plan, FOND 02 · ORANGE DIFFUS sur les
 * plans 3 et 12, grain PNG a graine fixe a 0,47.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * LA TYPO v3 : Instrument Sans porte presque tout (graisses 400/600/700, casse phrase,
 * chiffres tabulaires), comme la grotesque de la reference — c'est l'ecart de police que
 * Yoan a autorise (« mes polices c'est pas grave »). Anton ne reste que sur les DEUX
 * statements de marque a fond orange (« MÉMOIRE », « TU VEUX LA SUITE ? ») et le tampon
 * JAMAIS ; la signature serif italique reste sous le titre du plan 3 ; JetBrains Mono garde
 * les micro-labels. Les mesures HarfBuzz v1 encore utilisees : « MÉMOIRE » 430,7 px a 128
 * (centrage de la frappe), table AVANCES d'Instrument Sans (caret du plan 7), « JAMAIS »
 * 287 px a 96 → 251 a 84 (garde du tampon).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * L'ACCENT, UN FOYER PAR PLAN, inchange : couleur_accent sur fond gris (#C2700B nomme par
 * Yoan), couleur_accent_eclat (#FFA31A) sur fond orange, pilule finale en surface claire a
 * texte noir.
 *
 * Regles non negociables, tenues : aucune accumulation (etats poses en dur, operations
 * triees), aucun hasard, aucune horloge, aucun acces fichier ou reseau, aucun flou anime,
 * aucune ombre a rayon anime, aucun blend mode, courbes non parametrables. AUCUN `will-change`
 * hors du calque de plan (.dha-ph, bascule d'opacite aux coupes) : prudence heritee de la
 * panne des degrades du 2026-08-05, aucune promotion n'est necessaire ici.
 *
 * DETERMINISME ET OUTILLAGE (trouve le 2026-08-10 en criblant CE template) : le rendu
 * MULTI-WORKERS de hyperframes 0.7.55 n'est pas bit a bit reproductible sur cette machine.
 * Controle : `sequence-annonce-produit`, validee « 4 rendus, 1 empreinte » le 2026-08-05,
 * sort 3 classes d'empreintes sur 4 rendus en multi-workers le 2026-08-10, et 1 seule classe
 * en `-w 1`. Tout crible de deterministe et tout rendu de preview de cette entree se font
 * donc en `render -q high -w 1`.
 */

export const meta = {
  "id": "demi-haut-annonce-memoire",
  "nom": "Moitié haute : la mémoire du coach, style annonce produit",
  "categorie": "animation",
  "description": "Occupe la moitié haute du cadre pendant tout le reel, en douze plans coupés francs, au rythme de la voix, dans le langage de mouvement de sequence-annonce-produit : pops d'échelle mesurés, sorties en accélération exponentielle juste avant chaque coupe, entrées à longue queue de freinage, barre de question qui sort par la droite en accélérant, poussée à 1,85x puis dérive. Le vocabulaire est ILLUSTRATIF, dessiné en code comme les cartes de fichiers de la référence : pile d'avatars à initiales qui se chevauchent plus pastille « +46 », fiches de conversation dont la ligne s'efface, icônes messagerie et base de données entre lesquelles un message VOYAGE, vraies bulles à queue qui volent dans la base, toggle de consentement qui s'active, silhouette du client qui doute (bulle de pensée et badge « ? »), archive à puce d'horodatage, un seul client qui grandit et reçoit sa coche, pilule claire finale. Fonds GÉNÉRÉS EN CODE, sans grain (décision Yoan) : nappes de lumière radiales dans la palette DA, source alternée gauche/droite, orange sur les plans 3 et 12, STATIQUES sur les plans de carte et DÉRIVANTES sur les plans d'énergie (1, 3, 7, 8, 11, 12), Instrument Sans en casse phrase, Anton sur les statements orange, les chiffres et le tampon, signature serif italique. Rien n'est dessiné sous la réserve basse. Le buste du coach voit les messages popper autour de sa tête et décroche à la cascade.",
  "duree_defaut_s": 49.967,
  "params": [
    {
      "nom": "duree_s",
      "type": "nombre",
      "defaut": 49.967,
      "min": 3,
      "max": 120,
      "note": "durée TOTALE de l'élément. Contrairement aux autres entrées de cette famille, ce n'est PAS un maître de vitesse : chaque plan porte son propre instant et sa propre durée dans « plans », parce que le montage est calé sur la voix et qu'une mise à l'échelle globale décalerait tous les beats. Le paramètre sert de garde : si la fin du dernier plan s'écarte de plus d'une demi-seconde de cette durée, le template lève une erreur nommée au lieu de rendre un motion qui s'arrête avant la fin ou qui déborde. Aux deux bornes, ce qui casse est donc la COHÉRENCE et pas le rendu : à 3 s comme à 120 s, la liste « plans » du montage de référence fait lever l'erreur."
    },
    {
      "nom": "hauteur_bandeau",
      "type": "nombre",
      "defaut": 0.5,
      "min": 0.35,
      "max": 1,
      "note": "hauteur de la FENÊTRE VISIBLE, en fraction de la hauteur du cadre, RÉSERVE COMPRISE. C'est aussi la hauteur du FOND : la tache diffuse et son grain courent jusqu'à cette frontière, réserve incluse, pour qu'aucune rupture ne se voie à la couture avec la bande filmée. Le contenu, lui, est toujours composé en 1080 x 1920 : ce bouton ne redimensionne rien, il décide de ce qu'on en voit. Le défaut 0,5 est celui de « cadre-demi-bas » : les deux valeurs doivent rester égales, sinon la bande filmée et la scène ne partagent plus la même frontière. Le PLANCHER est fixé par l'élément le plus bas : la rangée de pastilles descend à 688 px et la pilule du plan 12 à 744, donc à 0,35 (672 px de bandeau, 616 px de zone une fois la réserve retirée) les deux sont coupées par la frontière, ce qui est exactement le « presque coupé » que la respiration interdit. À 1 la scène est montrée en entier et l'effet recouvre le plan filmé : il n'est plus un demi-écran et sa raison d'être disparaît."
    },
    {
      "nom": "reserve_bas_px",
      "type": "nombre",
      "defaut": 56,
      "min": 0,
      "max": 200,
      "note": "bande de la fenêtre laissée VIDE en bas, en pixels de la scène 1080 x 1920. C'est une INTERDICTION DE DESSINER, jamais une bande à peindre : le fond la traverse, seule la zone de dessin s'arrête à hauteur_bandeau x 1920 − reserve_bas_px. Le défaut la ferme à 904 px, soit 10 px au-dessus du bandeau de sous-titres qui commence à 914 (mesuré, mesures.json). À 0 la zone descend à 960 : la barre du plan 7, qui monte depuis le bas, apparaît alors DERRIÈRE la plaque des sous-titres pendant sa montée, et la ligne de couture avec la bande filmée n'a plus aucune garde. À 200 la zone tombe à 760 px : la pilule du plan 12 (bord bas à 744) n'a plus que 16 px de vide sous elle, et la respiration du bas disparaît."
    },
    {
      "nom": "couleur_fond",
      "type": "couleur",
      "defaut": "@theme.fond.couleur",
      "note": "le noir chaud de la charte v1 (#0A0A09). C'est le PIED des deux taches (la couleur vers laquelle tout chute) et la couleur de sécurité sous la scène. À donner en #RRGGBB : le template en dérive des transparences en hexadécimal."
    },
    {
      "nom": "couleur_fond_haut",
      "type": "couleur",
      "defaut": "#3B3B39",
      "note": "l'extrémité CLAIRE du fond gris de la charte (« Haut du fond gris », #3B3B39). Littéral et pas un jeton : theme.json ne porte aucun token pour les deux gris du fond (écart de DA remonté le 2026-08-09). En v5 c'est le CŒUR de la nappe de lumière des plans gris, hors cadre en haut (à gauche sur les plans impairs, à droite sur les pairs). À donner en #RRGGBB."
    },
    {
      "nom": "couleur_fond_bas",
      "type": "couleur",
      "defaut": "#1A1A18",
      "note": "l'extrémité SOMBRE du même fond gris (#1A1A18). En v5 c'est l'anneau intermédiaire de la nappe des plans gris, celui qui fond la lumière dans le noir chaud avant la couture. Plus claire que couleur_fond_haut, la nappe s'inverse et la lumière semble monter du bas, ce que la charte interdit. À donner en #RRGGBB."
    },
    {
      "nom": "couleur_fond2",
      "type": "couleur",
      "defaut": "#F08F24",
      "note": "le PIC du FOND 02 · ORANGE DIFFUS (#F08F24, valeur ajustée par moindres carrés sur le PNG de la charte dans banque/da/fonds/generer-fonds.py). En v5 c'est le cœur de la grande nappe des plans 3 et 12, toujours en haut à gauche comme le fichier fond2 de la charte. À donner en #RRGGBB."
    },
    {
      "nom": "couleur_accent",
      "type": "couleur",
      "defaut": "@theme.typo.kicker.couleur",
      "note": "l'accent unique des plans sur fond GRIS. Il sert au compteur, au trait de connexion, au caret de frappe, au surlignage de la ligne clé, au tampon : à chaque fois sur le geste du plan, jamais en décoration. La charte porte DEUX oranges et ne les mélange jamais dans un bloc : #C2700B (l'orange de marque) et #FFA31A (sa version lumineuse). Sur ce reel Yoan a nommé #C2700B (décision du 2026-08-09). Sur les plans à fond orange (3 et 12), l'accent passe par couleur_accent_eclat, jamais par celui-ci : les deux oranges ne se posent pas l'un sur l'autre. À donner en #RRGGBB."
    },
    {
      "nom": "couleur_accent_eclat",
      "type": "couleur",
      "defaut": "@theme.typo.kicker.couleur",
      "note": "l'orange lumineux de la charte (#FFA31A), réservé aux plans à FOND ORANGE (3 et 12) : « sur un fond orange dégradé, le texte est blanc, et l'accentuation passe en #FFA31A » (charte §02). Il porte la ligne serif italique du plan 3 et les puces du plan 12. Jamais posé sur un plan à fond gris : là c'est couleur_accent. À donner en #RRGGBB."
    },
    {
      "nom": "couleur_titre",
      "type": "couleur",
      "defaut": "@theme.typo.titre.couleur",
      "note": "le blanc des titres et des textes héros (#FFFFFF sous la charte v1). La charte est explicite : « le titre est blanc, pas orange ». Il porte aussi le disque de la coche du plan 3 sur le fond orange. À donner en #RRGGBB."
    },
    {
      "nom": "couleur_encre",
      "type": "couleur",
      "defaut": "@theme.typo.couleur",
      "note": "l'encre de la charte v1 (#F2EEE8) : lignes citées, texte tapé, curseur de souris, et la pilule claire du plan 12 (une surface d'encre à texte noir, comme la pilule finale de la référence). C'est aussi la base des surfaces secondaires, que le template obtient en lui dérivant une transparence. À donner en #RRGGBB."
    },
    {
      "nom": "couleur_secondaire",
      "type": "couleur",
      "defaut": "@theme.marque.couleur",
      "note": "le gris chaud de la charte (#A39B90), réservé aux libellés de service : dates, intitulés sous les compteurs, kickers. La DA interdit le texte gris pour marquer une hiérarchie de DISCOURS en vidéo ; ici il ne porte aucun discours, seulement des étiquettes, et toute la hiérarchie du sens passe par la taille et la graisse. À donner en #RRGGBB."
    },
    {
      "nom": "couleur_carte",
      "type": "couleur",
      "defaut": "#232120",
      "note": "fond des cartes et des fiches : la couleur que la charte nomme pour « bordures, séparateurs, cartes » (§02, jeton bordure). Ce qui fait lire la carte comme une surface n'est pas sa valeur, c'est son ombre portée (0 26px 40px noir 55 %) et son filet clair à 10 %, visibles sur la tache et invisibles sur du noir plat. À donner en #RRGGBB."
    },
    {
      "nom": "police_corps_fichier",
      "type": "texte",
      "defaut": "instrument-sans-latin.woff2",
      "note": "la police qui porte PRESQUE TOUT en v3 (Instrument Sans, variable 400 à 700) : titres de carte en 600 casse phrase, compteurs en 700 chiffres tabulaires, lignes et textes tapés en 400. C'est l'écart de police autorisé par Yoan le 2026-08-10 (« mes polices c'est pas grave ») pour retrouver la grotesque de la référence. Un fichier absent ne lève rien : le moteur retombe sur une fonte système, la métrique change et la table AVANCES du caret devient fausse."
    },
    {
      "nom": "police_titre_fichier",
      "type": "texte",
      "defaut": "anton-latin.woff2",
      "note": "Anton, réduit en v3 à TROIS emplois : les deux statements de marque à fond orange (« MÉMOIRE » au plan 3, « TU VEUX LA SUITE ? » au plan 12) et le tampon JAMAIS du plan 9. Tout le reste est passé à Instrument Sans (écart autorisé par Yoan). Un fichier absent ne lève rien : le moteur retombe sur une fonte système et le centrage mesuré de « MÉMOIRE » devient faux."
    },
    {
      "nom": "police_service_fichier",
      "type": "texte",
      "defaut": "jetbrains-mono-latin.woff2",
      "note": "la police de SERVICE de la charte v1 (JetBrains Mono, variable). Micro-labels uniquement, 20 à 24 px, majuscules, interlettrage large : « CLIENTS SUIVIS », « MESSAGES », « OBLIGATOIRE », « MESSAGERIE », « BASE DE DONNÉES », les dates. Un fichier absent ne lève rien : le moteur retombe sur une fonte système."
    },
    {
      "nom": "police_accent_fichier",
      "type": "texte",
      "defaut": "instrument-serif-italic-latin.woff2",
      "note": "la police d'ACCENTUATION de la charte v1 (Instrument Serif Italic), la signature de la marque : « un serif italique posé sous un titre ultra-condensé crée à lui seul la signature » (typographie.md §2). Elle ne compose que la ligne d'accentuation du plan 3 (« le truc tout bête »), en minuscules, en couleur. Un fichier absent ne lève rien : le moteur retombe sur une serif système et la signature disparaît."
    },
    {
      "nom": "question",
      "type": "texte",
      "defaut": "j'ai déjà dit ça à Yoan ?",
      "note": "la question tapée dans la barre du plan 7, signe par signe à une image par signe. À 40 px (Instrument Sans, chasse dérivée de la table AVANCES mesurée : environ 16 px par signe sur ce texte) elle occupe ~400 px pour 672 px utiles dans la barre. Ce n'est PAS la largeur qui borne ce paramètre mais le TEMPS : la frappe dure exactement autant d'images qu'il y a de signes, et le plan de montage a fixé le clic 2,56 s après son début, soit 77 images. Au-delà de 77 signes la frappe recouvre le clic ; au-delà d'environ 42 signes le texte touche le bouton d'envoi, qui ne se déplace pas."
    },
    {
      "nom": "ligne_cle",
      "type": "texte",
      "defaut": "oui, tu lui as déjà dit",
      "note": "la ligne que la poussée du plan 8 isole et grandit à 1,85x avant la DÉRIVE mesurée (1,85 → 2,18) — composée en Instrument Serif Italic 44, en éclat, la signature de la charte (décision Yoan 2026-08-10). À la chasse approchée de la serif italique (~0,44 em, soit 19,4 px par signe, 42 px au pic de dérive), au-delà de 23 signes la marge au pic passe sous 100 px, ce que la respiration interdit ; au-delà de 27 signes la ligne touche les bords. Le défaut fait 23 signes : pile à la borne, vérifié au rendu."
    },
    {
      "nom": "plans",
      "type": "liste",
      "defaut": [],
      "note": "le découpage, tel que le plan de montage l'a écrit : une entrée par plan, avec « n » (le numéro, qui décide de la mise en scène), « debut_montage_s » (compté depuis le DÉBUT DE L'ÉLÉMENT), « duree_s », « titre » et « actions ». CONTRAT RELÂCHÉ en v3 (décision de Yoan du 2026-08-10) : chaque action fournit un INSTANT « t » (relatif au début du plan), lu comme un BEAT de chorégraphie ; le champ « geste » n'est plus contrôlé ni imposé, la mise en scène du numéro de plan décide seule. Nombre de beats attendu par plan : 3, 4, 3, 4, 4, 3, 3, 6, 3, 6, 3, 6 (celui de la timeline du reel). Une liste vide, un « n » inconnu ou un beat manquant lèvent une erreur nommée. Les TEXTES affichés ne viennent pas d'ici : ils viennent des paramètres texte et de la mise en scène."
    }
  ],
  "contraintes": [
    "DOUZE plans écrits (1 à 12), mis en scène d'après « plans » : un numéro absent de la liste des mises en scène lève une erreur nommée, jamais un rendu approximatif. Les actions de la timeline sont lues comme des BEATS (instants seuls) : le champ « geste » n'est plus contrôlé (contrat relâché, décision de Yoan du 2026-08-10).",
    "LE LANGAGE DE MOUVEMENT EST CELUI DE sequence-annonce-produit, REPRIS DE SES TABLES MESURÉES : pop d'échelle depuis 4 % (P1_ECH, origine 50 % 95 %), sorties en accélération exponentielle juste avant les coupes (P1_SORTIE_DY, queue de P2_BARRE_DX), entrées latérales à longue queue de freinage (P5_DX), poussée en saut franc puis dérive (P4_ECH 1,85 → 2,18), sur la ligne clé composée en Instrument Serif Italic éclat (la signature de la charte, décision Yoan). ÉCART DÉCLARÉ : le zoom lent de tenue de la référence n'est pas reproduit — entre deux gestes un plan TIENT, immobile, comme les cartes de la référence entre leurs gestes. Choix de style tenu partout : les surfaces qui portent du texte (cartes, compteurs) bougent en TRANSLATION (entrées freinées, plongées d'impact), l'échelle reste aux formes simples à nœud unique (pastilles, coches, trait, statements Anton). Les seules courbes écrites et non mesurées : le punch d'impact (surtension 12-14 % amortie en 6 images) et l'extension des sorties hors cadre.",
    "RIEN NE DISPARAÎT SUR PLACE : tout plan qui précède une coupe sort en accélération (le contenu est attrapé en plein vol par la coupe), sauf le plan 7 (continuité de la barre avec le plan 8), le plan 8 (il finit sur la ligne poussée) et le plan 12 (fin du reel).",
    "UN SEUL FOYER D'ACCENT PAR PLAN (arbitrage du monteur, règle des 80/15/5 de la charte). Le plan 2 n'en porte aucun. Sur fond GRIS l'accent est couleur_accent ; sur fond ORANGE (plans 3 et 12) il passe en couleur_accent_eclat, et les deux oranges ne se posent jamais l'un sur l'autre (charte §02, règle 1).",
    "UN OBJET HÉROS PAR PLAN, dimensionné à son contenu et CENTRÉ dans la zone de dessin : aucune carte bord à bord, aucune composition ancrée au bord haut (correction v2, maintenue).",
    "TYPO v3 : Instrument Sans porte presque tout (600 casse phrase pour les titres de carte, 700 tabulaire pour les compteurs, 400 pour les lignes), écart de police autorisé par Yoan le 2026-08-10. Anton ne reste que sur les deux statements à fond orange et le tampon ; la signature serif italique reste sous « MÉMOIRE » ; JetBrains Mono garde les micro-labels 20-24 px.",
    "LES SIGNES DE JUGEMENT SONT DESSINÉS (coche, croix, flèche) : « ↗ » n'existe dans aucune des polices de la charte, et un glyphe absent tombe sur une fonte système, donc sur une métrique qu'aucune mesure ne couvre.",
    "L'effet DESSINE : il ne transforme aucune image et n'attend aucune plaque. Son vocabulaire est ILLUSTRATIF (avatars à initiales, bulles à queue, icônes messagerie/base, toggle, puces d'horodatage), et les initiales, prénoms et textes de messages des vignettes sont de la MISE EN SCÈNE, pas des paramètres : ils se changent dans le code.",
    "DEUX FENÊTRES EMBOÎTÉES : la fenêtre VISIBLE (hauteur_bandeau x 1920 = 960 px) porte le fond et court jusqu'à la couture, la zone de DESSIN (moins reserve_bas_px = 904 px) est un second overflow:hidden intérieur qui ne laisse passer aucun contenu au-dessus des sous-titres. Les sorties accélérées se font CLIPPER par cette zone : c'est voulu, la coupe attrape l'objet en plein vol.",
    "à poser AU-DESSUS de cadre-demi-bas, et avec la MÊME hauteur de bandeau (0,5) : c'est ce cadrage-là qui a fait la place.",
    "LE FOND EST CELUI DE LA RÉFÉRENCE, AUX COULEURS DE YOAN (décision du 2026-08-10, sans grain — écart charte assumé) : la première seconde du fond du plan 1 de sequence-annonce-produit, recette exacte (aplat + quatre blobs elliptiques 2·r·largeur x 2·r·hauteur, dégradé rgba(c,a) → transparent, POSITIONS MESURÉES par image, 30 lignes nettoyées de deux aberrations), rejouée à l'échelle x3, au TEMPO UNIQUE de la table parcourue en 5 s (aller-retour si le plan est plus long : jamais étirée sur la durée du plan, c'est ce qui rendait le fond arbitrairement rapide sur les plans courts), et ALTERNÉE comme dans la référence : il ne bouge que sur les plans d'énergie (1, 3, 7, 8, 11, 12), les plans de carte reçoivent une pose figée de la table, différente par plan. Les couleurs, dans l'ordre des blobs : base noir chaud (couleur_fond), marque #C2700B (couleur_accent), éclat #FFA31A (couleur_accent_eclat), gris sombre #1A1A18 (couleur_fond_bas), gris chaud clair #A39B90 (couleur_secondaire) — la liste nommée par Yoan. Les plans pairs jouent les positions en miroir horizontal : la coupe change le côté de la lumière.",
    "les couleurs se donnent en #RRGGBB : le template leur dérive des transparences en hexadécimal.",
    "aucun flou animé, aucune ombre à rayon animé, aucun blend mode : les ombres, les taches et le grain sont STATIQUES, et aucune couche ne porte de will-change hors le calque de plan. OUTILLAGE : le crible de déterminisme et le preview de cette entrée se rendent en `-w 1` — le rendu multi-workers de hyperframes 0.7.55 n'est pas bit à bit reproductible (contrôle du 2026-08-10 : sequence-annonce-produit, validée à 1 empreinte le 2026-08-05, sort 3 classes sur 4 rendus multi-workers, 1 classe en -w 1).",
    "les quatre polices viennent toutes de banque/da/fonts et sont stagées comme assets. Aucune autre."
  ],
  "version": "5.3.0",
  "valide_le": "2026-08-10",
  "source": "écrit à la main : v4 enrichie en v5 le 2026-08-10 sur retours de Yoan : buste du coach surmené dont le regard suit les messages puis décroche (plan 2), message qui voyage de la messagerie vers la base (plan 4), silhouette du client qui doute avec sa bulle de pensée et son badge « ? » (plan 9), et FONDS GÉNÉRÉS EN CODE sans grain, nappes de lumière dans la palette DA, statiques sur les plans de carte et DÉRIVANTES sur les plans d'énergie"
};


/* ═══════════════════════════════════════════════════════════════════════════════════════
   LES COURBES. Elles ne sont PAS des parametres (contrat §2). Sauf mention contraire,
   tables MESUREES de `sequence-annonce-produit` (banque/motion-anim1.mp4), reprises telles
   quelles, normalisees et reechantillonnees.
   ═══════════════════════════════════════════════════════════════════════════════════════ */

/* Pop d'echelle d'une carte : P1_ECH de la reference (f1 → f47), 62 % de la course en 6
   images, longue pose. En v3 il est joue en echelle PLEINE (origine 50 % 95 %), comme la
   reference le joue — la v1 l'appliquait a tort en ouverture de bande (scaleY seul). */
const POPE = [0.0432,0.0755,0.1295,0.2302,0.4068,0.6245,0.7474,0.8234,0.8686,0.8981,0.9222,0.9343,0.9415,0.9482,0.9518,0.9518,0.962,0.962,0.962,0.962,0.9656,0.9656,0.9656,0.9692,0.9692,0.9692,0.9692,0.9692,0.9777,0.9777,0.9795,0.9795,0.9831,0.9831,0.9831,0.9831,0.9831,0.9897,0.9897,0.9897,0.9897,0.9897,0.9897,0.9915,0.9915,0.9933,1];

/* Arrivee laterale : P5_DX normalise (1 → 0), 71 % de la course en 6 images, longue queue. */
const ARRIVEE = [1,0.8,0.63125,0.50625,0.4125,0.34375,0.2875,0.24375,0.20625,0.175,0.15,0.125,0.10625,0.0875,0.075,0.0625,0.05625,0.05,0.04375,0.04375,0.0375,0.0375,0.03125,0.03125,0.03125,0.03125,0.025,0.025,0.025,0.025,0.025,0.01875,0.01875,0.01875,0.01875,0.01875,0.01875,0.0125,0.0125,0.0125,0.0125,0.0125,0.00625,0.00625,0.00625,0.00625,0.00625,0.00625,0.00625,0.00625,0.00625,0.00625,0.00625,0.00625,0.00625,0.00625];

/* Pop d'une pastille : P1_PASTILLE_ECH. */
const POP = [0,0.053,0.105,0.316,0.526,0.737,0.842,0.895,0.947,0.947,0.947,0.947,0.947,0.947,0.947,1];

/* SORTIE acceleree : P1_SORTIE_DY normalise (0, -0,5, -1,5, -3,5, -6,5, -14 → /14).
   Chaque image double la precedente : c'est l'acceleration exponentielle de la reference,
   celle de la carte du plan 1 comme de la queue de P2_BARRE_DX (0, 2, 5,5, 11,5, 21, 32). */
const SORTIE = [0, 0.036, 0.107, 0.25, 0.464, 1];

/* Derive apres la poussee : P4_ECH f252 → f286 divise par 1,8504 (1,000 → 1,1783). */
const DERIVE = [1,1.0166,1.0332,1.0499,1.0645,1.0797,1.0914,1.1005,1.1103,1.1183,1.1258,1.134,1.14,1.1485,1.1501,1.1548,1.1592,1.1623,1.1652,1.1684,1.1724,1.1722,1.1732,1.1762,1.177,1.1774,1.178,1.1789,1.1788,1.1791,1.1786,1.1807,1.1786,1.1782,1.1783];

/* Punch d'impact : surtension amortie en 6 images. ECRIT, non mesure : la reference n'a
   pas de geste d'impact isole a mesurer, celui-ci suit la logique de ses freinages. */
const PUNCH = [1, 0.72, 0.45, 0.26, 0.12, 0.05, 0];


/* ═══════════════════════════════════════════════════════════════════════════════════════
   GEOMETRIE, en px de la scene 1080 x 1920. Compositions centrees sur le milieu de la
   zone de dessin (904 / 2 = 452 au defaut).
   ═══════════════════════════════════════════════════════════════════════════════════════ */

const SC_W = 1080, SC_H = 1920;
const FPSR = 30;
const MARGE_X = 60;

/* ── LES FONDS v5, generes en code (decision de Yoan du 2026-08-10) : plus d'image de
   fond, plus de GRAIN, uniquement des NAPPES de lumiere radiales dans la palette de la
   DA, posees sur le noir chaud. Comme la reference, les fonds VIVENT : sur les plans
   d'energie (FONDS_DYN) les nappes derivent lentement (trajectoires en sinus a phase
   fixe : deterministe, aucun hasard) ; sur les plans de carte, elles tiennent.
   La source reste en haut (a gauche sur les plans impairs et les plans orange, a droite
   sur les pairs) et la couture reste sombre : le noir chaud est la base de tout. */
const ORANGE = new Set([3, 12]);
const FONDS_DYN = new Set([1, 3, 7, 8, 11, 12]);
/* LE FOND DE LA REFERENCE, tel quel (decision de Yoan du 2026-08-10) : la PREMIERE
   SECONDE du fond du plan 1 de `sequence-annonce-produit` — un aplat plus quatre blobs
   elliptiques (2·r·largeur x 2·r·hauteur, degrade rgba(c,a) 0 % → rgba(c,0) 100 %),
   POSITIONS MESUREES par image (30 lignes, deux aberrations de mesure interpolees),
   rejouees a l'echelle x3 (leur scene fait 360 x 640) et REECHANTILLONNEES sur la duree
   de chaque plan. Seules les COULEURS changent : la palette de Yoan a la place de celle
   de la reference — base noir chaud, puis marque #C2700B, eclat #FFA31A, gris sombre
   #1A1A18, gris chaud clair #A39B90, dans l'ordre des quatre blobs. Les plans pairs
   jouent le fond en MIROIR horizontal : la coupe change le cote de la lumiere. */
const FOND_REF = {
  blobs: [{ a: 1.0, r: 1.0248 }, { a: 1.0, r: 1.0392 }, { a: 1.0, r: 1.5816 }, { a: 0.942, r: 1.0814 }],
  pos: [[[83.5,-51.1],[-193.0,1062.1],[57.6,-1082.8],[189.8,290.8]],
  [[86.2,-33.4],[-159.9,1113.5],[55.4,-1069.4],[192.4,309.7]],
  [[93.2,-8.3],[-358.9,881.1],[53.2,-1055.9],[194.8,339.1]],
  [[101.8,21.0],[-433.0,728.8],[51.0,-1042.5],[197.0,383.3]],
  [[111.5,53.3],[-471.2,617.4],[48.8,-1029.0],[198.3,448.1]],
  [[125.2,89.6],[-444.5,559.4],[46.6,-1015.6],[203.9,527.5]],
  [[225.8,-100.5],[54.3,167.9],[40.7,-1038.2],[212.2,571.3]],
  [[241.8,64.4],[-37.6,292.7],[166.1,-1029.1],[229.2,631.6]],
  [[265.0,137.0],[-43.3,378.7],[-113.5,-829.7],[252.9,685.3]],
  [[281.3,207.3],[-44.9,494.8],[49.1,-923.7],[272.0,731.9]],
  [[296.4,265.8],[-28.6,577.0],[154.4,-973.1],[291.2,784.0]],
  [[412.2,260.4],[99.2,525.0],[191.3,-1007.9],[298.5,829.7]],
  [[408.4,323.8],[97.2,585.4],[25.0,-1024.7],[315.8,879.5]],
  [[394.0,384.7],[91.4,640.6],[2.9,-1007.0],[336.0,914.4]],
  [[388.0,434.6],[88.3,681.6],[-156.5,-914.5],[359.8,949.6]],
  [[375.8,487.3],[85.0,719.5],[-142.6,-882.0],[383.0,973.2]],
  [[373.0,527.2],[86.3,748.9],[-132.0,-857.8],[405.2,997.5]],
  [[373.3,562.1],[94.7,773.2],[-135.0,-822.5],[416.2,1025.0]],
  [[373.1,591.9],[103.4,798.4],[-126.8,-800.8],[428.7,1046.2]],
  [[375.6,616.7],[112.4,821.9],[-119.1,-777.8],[441.6,1067.3]],
  [[386.9,636.5],[124.0,831.9],[-105.4,-762.5],[448.3,1094.2]],
  [[391.8,654.9],[133.8,850.3],[-98.4,-746.4],[460.6,1111.3]],
  [[422.7,658.8],[150.9,847.2],[-88.8,-731.6],[452.4,1229.0]],
  [[424.3,678.2],[158.1,868.3],[-83.0,-714.3],[444.2,1346.7]],
  [[427.7,695.4],[166.3,884.2],[-73.3,-702.1],[456.1,1391.1]],
  [[428.8,710.1],[170.9,904.2],[-65.6,-689.5],[468.0,1435.6]],
  [[428.8,726.8],[174.0,924.2],[-59.7,-676.9],[479.9,1480.0]],
  [[432.5,738.4],[177.9,940.7],[-58.2,-661.5],[491.8,1524.5]],
  [[437.3,749.3],[183.5,952.2],[-52.2,-650.8],[503.7,1568.9]],
  [[442.8,760.5],[188.3,963.7],[-48.2,-638.8],[515.5,1613.4]]],
};
const FOND_ECH = 3;                  /* la scene de la reference fait 360 x 640, la notre x3 */
const NAPPE = { pasImages: 2 };

const OMBRE_ALPHA = 0.55;

/* Amplitude du zoom de tenue et des sorties. */
const SORTIE_DY = -170;           /* sortie verticale type, en px, sur 7 images */
const SORTIE_IMAGES = 7;

/* ── Plan 1 : kicker, compteur heros, pile d'avatars qui se chevauchent + pastille « +46 ». */
const P1 = {
  kicker: "CLIENTS SUIVIS", kickerTaille: 24, kickerY: 258,
  compteurTaille: 220, compteurY: 340,
};

/* ── La pile d'AVATARS, partagee par les plans 1 et 11 : quatre initiales qui se
   chevauchent (le motif « nos clients » des interfaces produit), plus la pastille
   « +46 » qui complete les 50. Les initiales sont de la mise en scene, comme les
   prenoms des fiches : elles ne viennent pas des parametres. */
const AVATARS = {
  inits: ["Y", "L", "S", "J"], cote: 84, chevauche: 20, initTaille: 34,
  plus: "+46", plusW: 116, plusH: 58, plusTaille: 26, gouttiere: 18,
  y: 636,
};

/* ── Plan 2 : le BUSTE du coach, et les messages qui popent autour de sa tete. Son
   regard (la tete bascule) suit chaque message ; puis la cascade — trop de messages,
   la tete n'arrive plus a suivre et finit par tomber : le surmenage, montre. */
const P2 = {
  cx: 540, teteR: 62, teteCy: 344, epW: 300, epH: 150, epTop: 418,
  bulleH: 64, bulleR: 20, bulleTaille: 24,
  bulles: [
    { t: "séance de jeudi ?", w: 252, dx: -296, dy: -152 },
    { t: "ma reprise ?", w: 184, dx: 276, dy: -170 },
    { t: "le programme ?", w: 206, dx: -318, dy: 8 },
  ],
  cascade: [
    { dx: 298, dy: -8 }, { dx: 64, dy: -254 }, { dx: -158, dy: -262 },
    { dx: 240, dy: -242 }, { dx: -322, dy: -240 }, { dx: 152, dy: -288 },
  ],
  cascW: 104, cascH: 50,
  tilt: [-9, 10, -9],
};

/* ── Plan 3 : FOND ORANGE. Coche, titre frappe (Anton, centre par sa largeur MESUREE :
   « MÉMOIRE » 430,7 px a 128, HarfBuzz v1), signature serif italique. */
const P3 = {
  titre: "MÉMOIRE", titreTaille: 128, titreW: 431, titreY: 400,
  sous: "le truc tout bête", sousTaille: 60, sousY: 566, sousDx: -260,
  coche: 96, cocheY: 244,
};

/* ── Plan 4 : deux modules a ICONE DESSINEE (une bulle de messagerie, une pile de
   disques de base de donnees), le trait qui les connecte, et un MESSAGE qui voyage de
   la messagerie vers la base : on voit ce qui va de l'un vers l'autre. */
const P4 = {
  slotW: 300, slotH: 300, slotY: 290, slotR: 28, gx: [150, 630],
  traitX: 462, traitW: 156, traitY: 436, traitH: 8,
  labTaille: 22, labBas: 40,
  bulle: { w: 116, h: 84, r: 22, y: 78, queue: 22 },
  disque: { w: 116, h: 26, y: 78, pas: 38 },
  msg: { w: 68, h: 46, r: 15 },
};

/* ── Plan 5 : la base de donnees, compteur heros, et de VRAIS messages (bulles a
   queue, textes courts de coaching) qui volent dedans. Textes de mise en scene. */
const P5 = {
  w: 700, x: 190, y: 172, h: 560, pad: 48,
  kicker: "BASE DE DONNÉES", kickerTaille: 24, kickerTop: 44,
  numTaille: 150, numTop: 96, lab: "MESSAGES", labTaille: 22, labTop: 262,
  bulleH: 62, bulleR: 18, bulleTaille: 26,
  bulles: [
    { texte: "séance de jeudi ?", cote: "d", y: 330, w: 300 },
    { texte: "on passe à 4 séances", cote: "g", y: 406, w: 336 },
    { texte: "objectif tenu, on continue", cote: "d", y: 482, w: 404 },
  ],
  compteurFinal: 47,
};

/* ── Plan 6 : la carte de consentement, la pastille, et un TOGGLE qui s'active :
   le micro-geste d'interface que tout le monde connait, a la place d'une case. */
const P6 = {
  w: 760, x: 160, y: 212, h: 440,
  titre: "Consentement client", titreTaille: 60, titreTop: 56,
  lab: "OBLIGATOIRE", labTaille: 20, labW: 210, labH: 42, labY: 168,
  togX: 178, togY: 288, togW: 104, togH: 58, knob: 44,
  texte: "j'archive nos échanges", texteTaille: 32, texteX: 316,
};

/* ── Plan 7 : la barre de question, centree, entree de la reference (montee + tassement). */
const P7 = {
  barW: 840, barX: 120, barY: 394, barH: 116, pad: 44, garde: 24,
  taille: 40, bouton: 84, boutonMarge: 16, gouttiere: 24,
  caretW: 3,
};

/* ── Plan 8 : la barre SORT A DROITE en accelerant, les fiches retrouvees (avatar,
   date, citation) montent, poussee + derive. */
const P8 = {
  ficheW: 720, ficheX: 180, ficheH: 150, ficheR: 24, pad: 36,
  avCote: 60, avTaille: 24, texteX: 126,
  yPile: [191, 377, 563], xEntree: [24, -18, 28], entree: 90,
  dateTaille: 20, dateTop: 32, ligneTaille: 32, ligneTop: 68,
  poussee: 1.85, cleY: 414, cleTaille: 44,
  fiches: [
    { init: "Y", date: "IL Y A 3 SEMAINES", ligne: "on garde le même plan" },
    { init: "Y", date: "YOAN · IL Y A 3 SEMAINES", ligne: null },        /* null = `ligne_cle` */
    { init: "Y", date: "IL Y A 2 MOIS", ligne: "on en reparle après" },
  ],
  iCle: 1,
};

/* ── Plan 9 : « LA SENSATION », vue du CLIENT. Sa silhouette se pose une question :
   les deux petits ronds de pensee montent, la bulle s'ouvre (« je lui ai déjà dit
   ça… non ? »), et le badge « ? » se pose dessus. Textes de mise en scene. */
const P9 = {
  cx: 330, teteR: 56, teteCy: 470, epW: 270, epH: 140, epTop: 538,
  bulleX: 430, bulleY: 216, bulleW: 470, bulleH: 168, bulleR: 36, bullePad: 30,
  lignes: ["je lui ai déjà dit ça…", "non ?"], ligneTaille: 32, ligneLh: 46,
  pense: [{ x: 402, y: 448, r: 11 }, { x: 432, y: 402, r: 17 }],
  badge: 68, badgeTaille: 38,
  tilt: -8,
};

/* ── Plan 10 : le titre se frappe, deux lignes jugees : le souvenir en gris barre
   d'une croix, l'archive en encre avec sa puce d'horodatage et sa coche. */
const P10 = {
  w: 800, x: 140, y: 200, h: 500, pad: 48,
  titre: ["La qualité", "de tes retours"], titreTaille: 56, titreLh: 62, titreTop: 48,
  ligneY: [236, 342], ligneH: 76, ligneR: 18, lignePad: 28, ligneTaille: 30,
  lignes: ["ce que tu te rappelles", "ce qui est archivé"],
  chip: "ARCHIVÉ · 12 MARS", chipTaille: 16, chipW: 236, chipH: 36,
  marque: 52,
};

/* ── Plan 11 : la pile d'avatars revient, tout FILE dehors sauf UN client, qui
   grandit au centre, recoit sa coche et son prenom. */
const P11 = {
  survivant: 0,
  cibleX: 540, cibleY: 420, cote: 220, initTaille: 92, coche: 120,
  nomLabel: "YOAN", nomTaille: 24, nomY: 592,
};

/* ── Plan 12 : FOND ORANGE. Statement Anton, puces en eclat, pilule claire (entree de la
   pilule de la reference : longue queue de freinage depuis la droite). */
const P12 = {
  titre: "TU VEUX LA SUITE ?", titreTaille: 84, titreY: 190,
  puces: ["des systèmes qui tiennent", "testés sur mon business", "zéro théorie"],
  puceY: [356, 420, 484], puceCote: 14, puceTaille: 32, puceDx: 34, blocX: 322, puceFrom: -420,
  pilY: 640, pilW: 460, pilH: 104, pilR: 52,
  cta: "S'abonner", ctaTaille: 40, ctaFleche: 34,
};

/* Avances d'Instrument Sans 400, en em, mesurees signe par signe (HarfBuzz sur la fonte
   decompressee en TTF). Elles ne servent qu'a poser le CARET de la frappe du plan 7. */
const AVANCES = (() => {
  const G = {
  " ": 0.2,
  "'": 0.232,
  "ijlîï": 0.24,
  "IÎÏ": 0.254,
  ".,;:": 0.255,
  "!": 0.273,
  "f": 0.354,
  "r": 0.375,
  "t": 0.377,
  "\"": 0.384,
  "1": 0.391,
  "()": 0.406,
  "/": 0.443,
  "J": 0.455,
  "s": 0.473,
  "z": 0.496,
  "-": 0.506,
  "vy": 0.523,
  "+=": 0.531,
  "7": 0.532,
  "acàâäç": 0.533,
  "k": 0.535,
  "2": 0.545,
  "x": 0.551,
  "eéèêë": 0.564,
  "?": 0.567,
  "35": 0.574,
  "8": 0.582,
  "oôö": 0.584,
  "–": 0.586,
  "L": 0.588,
  "uùûü": 0.589,
  "hn6": 0.599,
  "4": 0.6,
  "F": 0.602,
  "bdgpq": 0.606,
  "S": 0.608,
  "9": 0.61,
  "Z": 0.623,
  "B": 0.636,
  "EÉÈÊË": 0.638,
  "T": 0.648,
  "…": 0.655,
  "PR": 0.656,
  "0": 0.666,
  "Y": 0.676,
  "X": 0.688,
  "K": 0.692,
  "UÙÛÜ": 0.712,
  "AVÀÂÄ": 0.728,
  "HN": 0.736,
  "CÇ": 0.741,
  "D": 0.752,
  "&": 0.755,
  "G": 0.765,
  "w": 0.767,
  "O%ÔÖ": 0.786,
  "Q": 0.787,
  "@": 0.853,
  "—": 0.886,
  "M": 0.906,
  "m": 0.922,
  "W": 1.089,  };
  const t = {};
  for (const [signes, v] of Object.entries(G)) for (const c of signes) t[c] = v;
  return t;
})();

const CUR = { w: 34, h: 50 };

const DOSSIER_ICI = decodeURIComponent(new URL(".", import.meta.url).pathname);
const DOSSIER_FONTS = decodeURIComponent(new URL("../../da/fonts/", import.meta.url).pathname);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* Les signes de jugement sont DESSINES, jamais composes. */
const svg = (cote, trait, d, c) => `<svg viewBox="0 0 24 24" width="${cote}" height="${cote}" `
  + `fill="none" stroke="${c}" stroke-width="${trait}" stroke-linecap="round" `
  + `stroke-linejoin="round"><path d="${d}"/></svg>`;
const coche = (cote, c) => svg(cote, 3, "M4 12.5l5.5 5.5L20 6.5", c);
const croix = (cote, c) => svg(cote, 3, "M6 6l12 12M18 6L6 18", c);
const fleche = (cote, c) => svg(cote, 2.6, "M7 17L17 7M9 7h8v8", c);

function av(hex, a) {
  if (!/^#[0-9a-fA-F]{6}$/.test(String(hex)))
    throw new Error(`${meta.id} : couleur « ${hex} » attendue en #RRGGBB (transparences dérivées)`);
  return hex + Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, "0");
}

const canaux = (hex) => [1, 3, 5].map((i) => parseInt(String(hex).slice(i, i + 2), 16));
const hex2 = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");

/* Reechantillonnage d'une table mesuree sur n images : une table se DILATE, jamais ne se tronque. */
function ech(T, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0 : (i / (n - 1)) * (T.length - 1);
    const j = Math.floor(x), f = x - j;
    out.push(j >= T.length - 1 ? T[T.length - 1] : T[j] + (T[j + 1] - T[j]) * f);
  }
  return out;
}


export function render(params, ctx) {
  const U = ctx.uid;
  const id = (n) => `${U}-${n}`;
  const sel = (n) => `#${U}-${n}`;

  /* ───────────────────────────────────────────────────────── la fenetre et la reserve */
  const B = Number(params.hauteur_bandeau) * SC_H;
  if (!Number.isFinite(B) || B <= 0)
    throw new Error(`${meta.id} : hauteur_bandeau doit être un nombre > 0`);
  const reserve = Number(params.reserve_bas_px);
  if (!Number.isFinite(reserve) || reserve < 0)
    throw new Error(`${meta.id} : reserve_bas_px doit être un nombre >= 0`);
  const ZONE = B - reserve;
  if (ZONE <= 0)
    throw new Error(`${meta.id} : « reserve_bas_px » (${reserve}) mange tout le bandeau `
      + `(${Math.round(B)} px) : il ne reste aucune zone de dessin`);

  const k = ctx.width / SC_W;
  const HFEN = Math.round(B * k);

  /* ───────────────────────────────────────────────────────────────── les plans du montage */
  const plans = params.plans;
  if (!Array.isArray(plans) || plans.length === 0)
    throw new Error(`${meta.id} : « plans » attend la liste des plans du montage, reçue vide`);
  plans.forEach((p, i) => {
    for (const c of ["n", "debut_montage_s", "duree_s"])
      if (typeof p?.[c] !== "number" || !Number.isFinite(p[c]))
        throw new Error(`${meta.id} : plans[${i}] n'a pas de « ${c} » numérique`);
    if (!Array.isArray(p.actions) || p.actions.length === 0)
      throw new Error(`${meta.id} : plans[${i}] (n=${p.n}) n'a aucune action`);
  });

  const fin = plans[plans.length - 1].debut_montage_s + plans[plans.length - 1].duree_s;
  const duree = Number(params.duree_s);
  if (!(duree > 0)) throw new Error(`${meta.id} : duree_s doit être > 0`);
  if (Math.abs(fin - duree) > 0.5)
    throw new Error(`${meta.id} : « duree_s » vaut ${duree.toFixed(3)} s mais le dernier plan `
      + `finit à ${fin.toFixed(3)} s (écart ${(fin - duree).toFixed(3)} s, toléré 0,5 s) : `
      + `le motion s'arrêterait avant la fin de l'élément, ou déborderait`);

  /* ─────────────────────────────────────────────────────────────────── le temps, en images */
  const pose = (tSec) => Math.max(0, (Math.round((ctx.start + tSec) * ctx.fps) - 0.5) / ctx.fps);

  const ops = [];
  const set = (s, v, t) => ops.push([s, v, t]);
  const table = (s, T, t0, n, fn) => {
    const E = ech(T, n);
    for (let i = 0; i < n; i++) set(s, fn(E[i]), pose(t0 + i / FPSR));
  };

  /* Un BEAT : l'instant d'une action, LU dans le plan de montage. Le geste n'est plus
     controle (contrat relache, decision de Yoan du 2026-08-10) : la mise en scene decide. */
  const beat = (p, i) => {
    const a = p.actions[i];
    if (!a || typeof a.t !== "number")
      throw new Error(`${meta.id} : plan ${p.n} : beat ${i} absent ou sans « t » `
        + `(cette mise en scène attend ${i + 1} beats au moins)`);
    return p.debut_montage_s + a.t;
  };

  /* ─────────────────────────────────────────── les gestes composites du langage v3 */
  /* pop d'echelle : l'objet nait a 4 % et pousse, origine en bas au centre (classe .dha-pop) */
  const popIn = (s, t, n = 16) => {
    set(s, { opacity: 0, scale: POPE[0] }, pose(0));
    set(s, { opacity: 1 }, pose(t));
    table(s, POPE, t, n, (v) => ({ scale: v }));
    set(s, { scale: 1 }, pose(t + n / FPSR));
  };
  /* sortie acceleree : l'objet part et la coupe l'attrape en plein vol */
  const sortie = (s, t, dx, dy, n = SORTIE_IMAGES) => {
    table(s, SORTIE, t, n, (v) => ({ x: Math.round(dx * v), y: Math.round(dy * v) }));
  };
  /* entree laterale a longue queue de freinage */
  const glisse = (s, t, dx, dy, n = 14) => {
    set(s, { opacity: 0, x: dx, y: dy }, pose(0));
    set(s, { opacity: 1 }, pose(t));
    table(s, ARRIVEE, t, n, (v) => ({ x: Math.round(dx * v), y: Math.round(dy * v) }));
    set(s, { x: 0, y: 0 }, pose(t + n / FPSR));
  };
  /* deux impacts : punch (surtension d'echelle) pour les formes simples a noeud unique,
     punchY (plongee amortie) pour les surfaces qui portent du texte — une carte encaisse,
     elle ne gonfle pas. */
  const punch = (s, t, ampl = 0.12, n = 7) => {
    table(s, PUNCH, t, n, (v) => ({ scale: 1 + ampl * v }));
    set(s, { scale: 1 }, pose(t + n / FPSR));
  };
  const punchY = (s, t, ampl = 8, n = 7) => {
    table(s, PUNCH, t, n, (v) => ({ y: Math.round(ampl * v) }));
    set(s, { y: 0 }, pose(t + n / FPSR));
  };
  /* PAS de derive continue de tenue : entre deux gestes, un plan TIENT, immobile,
     comme les cartes de la reference entre leurs gestes. (Une derive de 12 px a ete
     essayee puis retiree pendant le diagnostic de deterministe du 2026-08-10 ; la cause
     racine s'est revelee etre le rendu multi-workers de l'outillage, pas le template,
     mais la tenue immobile est GARDEE : c'est ce que fait la reference.) */

  /* ───────────────────────────────────────────────────────────────────────── les couleurs */
  const ACC = params.couleur_accent, ENC = params.couleur_encre;
  const ECLAT = params.couleur_accent_eclat;
  const TIT = params.couleur_titre;
  const SEC = params.couleur_secondaire, CARTE = params.couleur_carte;
  const FOND = params.couleur_fond;
  const GRIS_H = params.couleur_fond_haut, GRIS_B = params.couleur_fond_bas;
  const PIC2 = params.couleur_fond2;
  for (const c of [FOND, GRIS_H, GRIS_B, PIC2, ECLAT])
    if (!/^#[0-9a-fA-F]{6}$/.test(String(c)))
      throw new Error(`${meta.id} : couleur de fond « ${c} » attendue en #RRGGBB`);

  /* ── LE FOND DE LA REFERENCE, aux couleurs de Yoan : un aplat noir chaud, puis les
     quatre blobs de FOND_REF dans l'ordre — marque, eclat, gris sombre, gris chaud
     clair. Les tailles suivent la recette exacte de la reference (2·r·largeur x
     2·r·hauteur, centres pilotes par transform), a l'echelle x3. Les plans pairs
     jouent les positions en miroir horizontal : la coupe change le cote. */
  const FOND_COULEURS = [ACC, ECLAT, GRIS_B, SEC];
  /* les alphas de la reference font un fond CLAIR (c'est sa nature) ; sur la scene
     sombre de la DA ils noieraient le contenu (rendu du 2026-08-10 : cadre entier
     ambre, compteur orange illisible). On garde la geometrie et les positions
     mesurees, on tempere l'INTENSITE — le voile gris sombre reste plein, les
     lumieres descendent. */
  const FOND_TEMPERE = [0.62, 0.5, 1.0, 0.34];
  const fondHtml = (n) => {
    let h = "";                       /* l'aplat de base est le fond de .dha-fond */
    FOND_REF.blobs.forEach((b, j) => {
      const w = 2 * b.r * SC_W, hh = 2 * b.r * SC_H;
      h += `<div class="dha-nappe" id="${id(`fn${n}-${j}`)}" style="width:${w.toFixed(1)}px;`
        + `height:${hh.toFixed(1)}px;margin-left:${(-w / 2).toFixed(1)}px;`
        + `margin-top:${(-hh / 2).toFixed(1)}px;background:radial-gradient(ellipse closest-side,`
        + `${av(FOND_COULEURS[j], b.a * FOND_TEMPERE[j])} 0%,${av(FOND_COULEURS[j], 0)} 100%)"></div>`;
    });
    return `<div class="dha-fond">${h}</div>`;
  };

  /* la VIE du fond, comme la reference l'ALTERNE : il ne bouge que sur les plans
     d'energie (FONDS_DYN) — les plans de carte recoivent une POSE FIGEE de la table,
     differente a chaque plan. Et il avance partout au MEME TEMPO : la table de 30
     lignes est parcourue en T_FOND secondes quelle que soit la duree du plan (aller-
     retour si le plan est plus long), au lieu d'etre etiree sur le plan — c'est
     l'etirement qui rendait le fond arbitrairement rapide sur les plans courts. */
  const T_FOND = 5;
  const ligneDuFond = (u) => {
    const x = Math.max(0, Math.min(1, u)) * (FOND_REF.pos.length - 1);
    const i0 = Math.floor(x), f = x - i0;
    const i1 = Math.min(FOND_REF.pos.length - 1, i0 + 1);
    return FOND_REF.blobs.map((_b, j) => [
      FOND_REF.pos[i0][j][0] + (FOND_REF.pos[i1][j][0] - FOND_REF.pos[i0][j][0]) * f,
      FOND_REF.pos[i0][j][1] + (FOND_REF.pos[i1][j][1] - FOND_REF.pos[i0][j][1]) * f,
    ]);
  };
  const poseFond = (n, row, t) => {
    const miroir = !ORANGE.has(n) && n % 2 === 0;
    row.forEach((xy, j) => {
      const x = xy[0] * FOND_ECH;
      set(sel(`fn${n}-${j}`), {
        x: Math.round(miroir ? SC_W - x : x),
        y: Math.round(xy[1] * FOND_ECH),
      }, pose(t));
    });
  };
  const vieDuFond = (p) => {
    if (!FONDS_DYN.has(p.n)) {
      /* fond FIGE, sur une ligne de la table propre au plan */
      poseFond(p.n, ligneDuFond(((p.n * 7) % 29) / 29), p.debut_montage_s);
      return;
    }
    const nI = Math.floor(p.duree_s * FPSR / NAPPE.pasImages);
    for (let k = 0; k <= nI; k++) {
      const tRel = k * NAPPE.pasImages / FPSR;
      const ph = tRel / T_FOND;                       /* tempo UNIQUE, tous plans */
      const u = 1 - Math.abs(1 - (ph % 2));           /* aller-retour sans saut */
      poseFond(p.n, ligneDuFond(u), p.debut_montage_s + tRel);
    }
  };

  /* ═════════════════════════════════════════════════════════ MISES EN SCENE, PLAN PAR PLAN */
  const html = [];
  const ECRITS = {
    1: plan1, 2: plan2, 3: plan3, 4: plan4, 5: plan5, 6: plan6,
    7: plan7, 8: plan8, 9: plan9, 10: plan10, 11: plan11, 12: plan12,
  };

  /* Chaque plan est enveloppe dans .dha-mv : c'est elle qui porte le zoom lent de tenue et,
     pour les plans qui precedent une coupe, la sortie acceleree. Plans SANS sortie : 7 (la
     barre continue au plan 8), 8 (il finit sur la ligne poussee), 12 (fin du reel). */
  const ouvrePlan = (p) => {
    html.push(`<div class="dha-ph" id="${id("ph" + p.n)}">\n  ${fondHtml(p.n)}\n  `
      + `<div class="dha-zone"><div class="dha-mv" id="${id("mv" + p.n)}">`);
  };
  const fermePlan = () => html.push(`</div></div>\n</div>`);
  const vieDuPlan = (p, avecSortie) => {
    const s = sel("mv" + p.n);
    set(s, { x: 0, y: 0 }, pose(0));
    if (avecSortie)
      sortie(s, p.debut_montage_s + p.duree_s - SORTIE_IMAGES / FPSR, 0, SORTIE_DY);
    vieDuFond(p);
  };

  /* ── LE BUSTE (plans 2 et 9) : une tete qui peut basculer (origine au cou) et des
     epaules arrondies. La silhouette des interfaces produit, dans l'encre de la DA. */
  /* la tete porte un REGARD (un point sombre) : une tete ronde qui pivote ne se voit
     pas, un point qui se deplace vers chaque message se lit instantanement */
  const busteHtml = (pre, cx, teteR, teteCy, epW, epH, epTop) =>
    `<span class="dha-epaules" style="left:${cx - epW / 2}px;top:${epTop}px;`
    + `width:${epW}px;height:${epH}px;border-radius:${Math.round(epW / 2)}px ${Math.round(epW / 2)}px 30px 30px"></span>`
    + `<span class="dha-tete" id="${id(pre + "tete")}" style="left:${cx - teteR}px;`
    + `top:${teteCy - teteR}px;width:${2 * teteR}px;height:${2 * teteR}px">`
    + `<span class="dha-regard" id="${id(pre + "regard")}"></span></span>`;

  /* ── LA PILE D'AVATARS, partagee par les plans 1 et 11 : une seule geometrie, un
     seul code. Chevauchement negatif + lisere couleur de fond : le motif « avatars
     empiles » des interfaces produit. */
  const avPas = AVATARS.cote - AVATARS.chevauche;
  const avRangW = AVATARS.cote + (AVATARS.inits.length - 1) * avPas
    + AVATARS.gouttiere + AVATARS.plusW;
  const avRangX = Math.round((SC_W - avRangW) / 2);
  const avPlusX = avRangX + AVATARS.cote + (AVATARS.inits.length - 1) * avPas + AVATARS.gouttiere;
  const avPlusY = AVATARS.y + Math.round((AVATARS.cote - AVATARS.plusH) / 2);
  const avatarsHtml = (pre) => {
    const out = AVATARS.inits.map((ini, i) =>
      `<span class="dha-avatar" id="${id(pre + "av" + i)}" style="`
      + `left:${avRangX + i * avPas}px;top:${AVATARS.y}px;`
      + `width:${AVATARS.cote}px;height:${AVATARS.cote}px;`
      + `font-size:${AVATARS.initTaille}px;z-index:${10 + i}">${esc(ini)}</span>`);
    out.push(`<span class="dha-plus" id="${id(pre + "plus")}" style="`
      + `left:${avPlusX}px;top:${avPlusY}px;width:${AVATARS.plusW}px;`
      + `height:${AVATARS.plusH}px;font-size:${AVATARS.plusTaille}px;`
      + `border-radius:${AVATARS.plusH / 2}px">${esc(AVATARS.plus)}</span>`);
    return out.join("");
  };

  /* ── PLAN 1 : « TES CLIENTS ». Le kicker glisse, le compteur MONTE et compte, les
        avatars entrent en pile depuis la droite, et le passage a 50 fait popper la
        pastille « +46 ». Tout sort avant la coupe. */
  function plan1(p) {
    const tKick = beat(p, 0);
    const t40 = beat(p, 1);
    const t50 = beat(p, 2);

    /* le pop finit AVANT la premiere bascule de chiffre ; le passage a 50 est UNE
       bascule suivie de la plongee : jamais de bascule pendant une transform animee. */
    const RAMPE1 = 12;
    const etapes = [{ v: 0, t: t40 - 16 / FPSR }];      /* le « 0 » est la PENDANT l'entree */
    for (let i = 1; i <= RAMPE1; i++)
      etapes.push({ v: Math.round(40 * i / RAMPE1), t: t40 + i / FPSR });
    etapes.push({ v: 50, t: t50 });

    ouvrePlan(p);
    html.push(`<span class="dha-kicker" id="${id("p1kick")}" style="top:${P1.kickerY}px;
    font-size:${P1.kickerTaille}px">${esc(P1.kicker)}</span>
  <div class="dha-compteur" id="${id("p1num")}" style="top:${P1.compteurY}px;
    font-size:${P1.compteurTaille}px;line-height:${P1.compteurTaille}px;color:${ACC}">
    ${etapes.map((e, i) => `<span id="${id("p1n" + i)}">${e.v}</span>`).join("")}
  </div>
  ${avatarsHtml("p1")}`);
    fermePlan();

    return () => {
      vieDuPlan(p, true);
      glisse(sel("p1kick"), tKick, 0, 26, 12);

      /* le compteur MONTE en freinant, fini avant le comptage. Ses valeurs basculent en
         DISPLAY : un seul glyphe existe pour le peintre a chaque image. */
      glisse(sel("p1num"), t40 - 16 / FPSR, 0, 70, 14);
      etapes.forEach((e, i) => {
        set(sel("p1n" + i), { display: "none" }, pose(0));
        set(sel("p1n" + i), { display: "inline" }, pose(e.t));
        if (i < etapes.length - 1) set(sel("p1n" + i), { display: "none" }, pose(etapes[i + 1].t));
      });
      /* le passage a 50 est un IMPACT : la bascule d'abord, la plongee une image apres */
      punchY(sel("p1num"), t50 + 2 / FPSR, 12);

      /* les avatars entrent en pile depuis la droite, decales de 3 images */
      AVATARS.inits.forEach((_ini, i) => {
        glisse(sel("p1av" + i), t40 + (2 + 3 * i) / FPSR, 360, 0, 12);
      });
      /* la pastille « +46 » pope au passage a 50 : c'est elle qui complete le compte */
      const pl = sel("p1plus");
      set(pl, { opacity: 0, scale: 0.2 }, pose(0));
      set(pl, { opacity: 1 }, pose(t50));
      table(pl, POP, t50, 8, (v) => ({ scale: 0.2 + 0.8 * v }));
      set(pl, { scale: 1 }, pose(t50 + 8 / FPSR));
    };
  }

  /* ── PLAN 2 : « L'OUBLI ». Le buste du coach entre ; un message pope, son regard va
        vers lui ; un deuxieme, un troisieme… puis la CASCADE : six messages en dix-huit
        images, la tete n'arrive plus a suivre et finit par tomber. Tout sort avant la
        coupe. */
  function plan2(p) {
    const tBloc = beat(p, 0);
    const tB = [beat(p, 1), beat(p, 2), beat(p, 3)];
    const tFin = p.debut_montage_s + p.duree_s;
    const tCasc = tB[2] + 8 / FPSR;

    const bulle = (b, i) => {
      const w = b.w, h = P2.bulleH;
      return `<span class="dha-bulle-mini" id="${id("p2b" + i)}" style="`
        + `left:${P2.cx + b.dx - Math.round(w / 2)}px;top:${P2.teteCy + b.dy - Math.round(h / 2)}px;`
        + `width:${w}px;height:${h}px;border-radius:${P2.bulleR}px">`
        + `<span class="dha-bulle-txt" style="line-height:${h}px;font-size:${P2.bulleTaille}px">${esc(b.t)}</span></span>`;
    };
    const casc = (c, i) => `<span class="dha-bulle-mini" id="${id("p2c" + i)}" style="`
      + `left:${P2.cx + c.dx - Math.round(P2.cascW / 2)}px;top:${P2.teteCy + c.dy - Math.round(P2.cascH / 2)}px;`
      + `width:${P2.cascW}px;height:${P2.cascH}px;border-radius:${Math.round(P2.cascH / 2)}px">`
      + `<span class="dha-bulle-txt" style="line-height:${P2.cascH}px;font-size:22px;color:${SEC}">· · ·</span></span>`;

    ouvrePlan(p);
    html.push(`<div class="dha-groupe" id="${id("p2buste")}">
  ${busteHtml("p2", P2.cx, P2.teteR, P2.teteCy, P2.epW, P2.epH, P2.epTop)}
  </div>
  ${P2.bulles.map(bulle).join("")}
  ${P2.cascade.map(casc).join("")}`);
    fermePlan();

    return () => {
      vieDuPlan(p, false);          /* les elements portent leur propre sortie decalee */
      glisse(sel("p2buste"), tBloc, 0, 140, 13);

      /* chaque message pope, et le REGARD le suit : le point se deplace vers la bulle */
      const regard = (dx, dy, t) => set(sel("p2regard"), {
        x: Math.round(Math.max(-1, Math.min(1, dx / 200)) * 24),
        y: dy < -60 ? -10 : 6,
      }, pose(t));
      set(sel("p2regard"), { x: 0, y: -4 }, pose(0));
      P2.bulles.forEach((b, i) => {
        const sb = sel("p2b" + i);
        set(sb, { opacity: 0, scale: 0.3 }, pose(0));
        set(sb, { opacity: 1 }, pose(tB[i]));
        table(sb, POP, tB[i], 7, (v) => ({ scale: 0.3 + 0.7 * v }));
        set(sb, { scale: 1 }, pose(tB[i] + 7 / FPSR));
        regard(b.dx, b.dy, tB[i] + 2 / FPSR);
      });

      /* la cascade : six messages en dix-huit images, le regard saute de plus en plus
         vite, puis TOMBE avec la tete — le surmenage */
      P2.cascade.forEach((c, i) => {
        const sc = sel("p2c" + i);
        const t = tCasc + i * 3 / FPSR;
        set(sc, { opacity: 0, scale: 0.3 }, pose(0));
        set(sc, { opacity: 1 }, pose(t));
        table(sc, POP, t, 5, (v) => ({ scale: 0.3 + 0.7 * v }));
        set(sc, { scale: 1 }, pose(t + 5 / FPSR));
        regard(c.dx, c.dy, t + 1 / FPSR);
      });
      const tTombe = tCasc + (P2.cascade.length * 3 + 3) / FPSR;
      set(sel("p2regard"), { x: 0, y: 16 }, pose(tTombe));
      set(sel("p2tete"), { y: 12 }, pose(tTombe));
      table(sel("p2tete"), ARRIVEE, tTombe, 6, (v) => ({ y: Math.round(12 * (1 - v)) }));
      set(sel("p2tete"), { y: 12 }, pose(tTombe + 6 / FPSR));

      /* sorties decalees : les bulles filent vers le haut, le buste en dernier */
      P2.bulles.forEach((_b, i) =>
        sortie(sel("p2b" + i), tFin - (SORTIE_IMAGES + 3 - i) / FPSR, 0, -300, SORTIE_IMAGES));
      P2.cascade.forEach((_c, i) =>
        sortie(sel("p2c" + i), tFin - (SORTIE_IMAGES + 2 - (i % 3)) / FPSR, 0, -320, SORTIE_IMAGES));
      sortie(sel("p2buste"), tFin - SORTIE_IMAGES / FPSR, 0, 260, SORTIE_IMAGES);
    };
  }

  /* ── PLAN 3 : « MEMOIRE », FOND ORANGE. La coche pope, le titre se frappe, la signature
        serif entre par la GAUCHE (l'entree de l'accroche « Think X » de la reference). */
  function plan3(p) {
    const tCarte = beat(p, 0);
    const tFrappe = beat(p, 1);
    const tCoche = beat(p, 2);
    const signes = Array.from(P3.titre);
    const titreX = Math.round((SC_W - P3.titreW) / 2);

    ouvrePlan(p);
    html.push(`<span class="dha-rond" id="${id("p3coche")}" style="left:${Math.round((SC_W - P3.coche) / 2)}px;
    top:${P3.cocheY}px;width:${P3.coche}px;height:${P3.coche}px;background:${TIT}">${
    coche(Math.round(P3.coche * 0.52), FOND)}</span>
  <span class="dha-titre" style="left:${titreX}px;top:${P3.titreY}px;
    font-size:${P3.titreTaille}px;line-height:${Math.round(P3.titreTaille * 0.92)}px">${
    signes.map((c, i) => `<span id="${id("p3c" + i)}">${esc(c)}</span>`).join("")}</span>
  <span class="dha-serif" id="${id("p3sous")}" style="top:${P3.sousY}px;
    font-size:${P3.sousTaille}px;color:${ECLAT}">${esc(P3.sous)}</span>`);
    fermePlan();

    return () => {
      vieDuPlan(p, true);
      set(sel("p3coche"), { opacity: 0, scale: 0.2 }, pose(0));
      set(sel("p3coche"), { opacity: 1 }, pose(tCarte));
      table(sel("p3coche"), POP, tCarte, 9, (v) => ({ scale: 0.2 + 0.8 * v }));
      set(sel("p3coche"), { scale: 1 }, pose(tCarte + 9 / FPSR));

      signes.forEach((_c, i) => {
        set(sel("p3c" + i), { opacity: 0 }, pose(0));
        set(sel("p3c" + i), { opacity: 1 }, pose(tFrappe + i / FPSR));
      });

      /* la signature entre par la gauche, longue queue de freinage (P2_MOT_DX) */
      glisse(sel("p3sous"), tCoche, P3.sousDx, 0, 16);
    };
  }

  /* ── PLAN 4 : « CONNECTER ». Le module messagerie entre par la gauche, le trait se
        trace, le module base entre par la droite, puis un MESSAGE quitte la messagerie,
        voyage au-dessus du trait et se fait absorber par la base : on voit ce qui va de
        l'un vers l'autre. Deux voyages. */
  function plan4(p) {
    const tG = beat(p, 0);
    const tTrait = beat(p, 1);
    const tD = beat(p, 2);
    const tLien = beat(p, 3);
    const icoX = Math.round((P4.slotW - P4.bulle.w) / 2);
    /* le message part du centre de l'icone messagerie et arrive au centre des disques */
    const dep = [P4.gx[0] + P4.slotW / 2, P4.slotY + P4.bulle.y + P4.bulle.h / 2];
    const arr = [P4.gx[1] + P4.slotW / 2, P4.slotY + P4.disque.y + P4.disque.pas + P4.disque.h / 2];
    const mX = dep[0] - P4.msg.w / 2, mY = dep[1] - P4.msg.h / 2;
    const course = arr[0] - dep[0];

    ouvrePlan(p);
    html.push(`<span class="dha-trait" id="${id("p4trait")}" style="left:${P4.traitX}px;top:${P4.traitY}px;
    width:${P4.traitW}px;height:${P4.traitH}px;background:${ACC}"></span>
  <div class="dha-plaque" id="${id("p4g")}"
    style="left:${P4.gx[0]}px;top:${P4.slotY}px;width:${P4.slotW}px;height:${P4.slotH}px">
    <span class="dha-ico-bulle" style="left:${icoX}px;top:${P4.bulle.y}px;
      width:${P4.bulle.w}px;height:${P4.bulle.h}px;border-radius:${P4.bulle.r}px"></span>
    <span class="dha-ico-queue" style="left:${icoX + 16}px;
      top:${P4.bulle.y + P4.bulle.h - Math.round(P4.bulle.queue / 2) - 4}px;
      width:${P4.bulle.queue}px;height:${P4.bulle.queue}px"></span>
    <span class="dha-lab-c" style="bottom:${P4.labBas}px;font-size:${P4.labTaille}px">MESSAGERIE</span>
  </div>
  <div class="dha-plaque" id="${id("p4d")}"
    style="left:${P4.gx[1]}px;top:${P4.slotY}px;width:${P4.slotW}px;height:${P4.slotH}px">
    ${[0, 1, 2].map((k) => `<span class="dha-disque" style="left:${icoX}px;
      top:${P4.disque.y + k * P4.disque.pas}px;width:${P4.disque.w}px;
      height:${P4.disque.h}px;border-radius:${Math.round(P4.disque.h / 2)}px"></span>`).join("")}
    <span class="dha-lab-c" style="bottom:${P4.labBas}px;font-size:${P4.labTaille}px">BASE DE DONNÉES</span>
  </div>
  <span class="dha-msg-vol" id="${id("p4msg")}" style="left:${Math.round(mX)}px;top:${Math.round(mY)}px;
    width:${P4.msg.w}px;height:${P4.msg.h}px;border-radius:${P4.msg.r}px">
    <span class="dha-msg-pts">· · ·</span>
  </span>`);
    fermePlan();

    return () => {
      vieDuPlan(p, true);
      /* les deux modules entrent L'UN VERS L'AUTRE */
      glisse(sel("p4g"), tG, -420, 0, 13);
      set(sel("p4trait"), { scaleX: 0 }, pose(0));
      table(sel("p4trait"), POPE, tTrait, 8, (v) => ({ scaleX: v }));
      set(sel("p4trait"), { scaleX: 1 }, pose(tTrait + 8 / FPSR));
      glisse(sel("p4d"), tD, 420, 0, 13);

      /* le voyage : le message pope hors de la messagerie, survole le trait en arc,
         et la base l'ABSORBE (il retombe a l'echelle en entrant, la base encaisse) */
      const m = sel("p4msg");
      set(m, { opacity: 0, x: 0, y: 0, scale: 0.3 }, pose(0));
      [0, 20].forEach((dk) => {
        const t = tLien + dk / FPSR;
        set(m, { opacity: 1, x: 0, y: 0, scale: 0.3 }, pose(t));
        table(m, POP, t, 4, (v) => ({ scale: 0.3 + 0.7 * v }));
        const V = 14;
        const E = ech(ARRIVEE, V);
        for (let i = 0; i < V; i++) {
          const prog = 1 - E[i];
          set(m, {
            x: Math.round(course * prog),
            y: Math.round(-34 * Math.sin(Math.PI * prog)),
            scale: prog > 0.82 ? 1 - (prog - 0.82) * 3.5 : 1,
          }, pose(t + (4 + i) / FPSR));
        }
        set(m, { opacity: 0 }, pose(t + (4 + V) / FPSR));
        punchY(sel("p4d"), t + (2 + V) / FPSR, 6, 5);
      });
      punchY(sel("p4g"), tLien, 5, 5);
    };
  }

  /* ── PLAN 5 : « STOCKER ». La base entre, et de VRAIS messages (bulles a queue)
        volent dedans depuis les deux bords ; le compteur encaisse chaque arrivee. */
  function plan5(p) {
    const tCarte = beat(p, 0);
    const tL = [beat(p, 1), beat(p, 2), beat(p, 3)];

    const RAMPE = 14;
    const etapes = [{ v: 0, t: tCarte }, { v: 1, t: tL[0] }, { v: 2, t: tL[1] }];
    for (let i = 1; i <= RAMPE; i++)
      etapes.push({ v: Math.round(2 + (P5.compteurFinal - 2) * i / RAMPE), t: tL[2] + i / FPSR });

    ouvrePlan(p);
    html.push(`<div class="dha-carte dha-clip" id="${id("p5carte")}" style="left:${P5.x}px;width:${P5.w}px;
    top:${P5.y}px;height:${P5.h}px">
    <span class="dha-lab-c" style="top:${P5.kickerTop}px;font-size:${P5.kickerTaille}px">${esc(P5.kicker)}</span>
    <div class="dha-compteur" id="${id("p5num")}" style="top:${P5.numTop}px;
      font-size:${P5.numTaille}px;line-height:${P5.numTaille}px;color:${ACC}">
      ${etapes.map((e, i) => `<span id="${id("p5n" + i)}">${e.v}</span>`).join("")}
    </div>
    <span class="dha-lab-c" style="top:${P5.labTop}px;font-size:${P5.labTaille}px"
      id="${id("p5lab")}">${esc(P5.lab)}</span>
    ${P5.bulles.map((b, i) => {
      const bx = b.cote === "g" ? P5.pad : P5.w - P5.pad - b.w;
      const qx = b.cote === "g" ? 18 : b.w - 40;
      return `<span class="dha-bulle-mini" id="${id("p5l" + i)}"
      style="left:${bx}px;top:${b.y}px;width:${b.w}px;height:${P5.bulleH}px;
      border-radius:${P5.bulleR}px">
      <span class="dha-ico-queue-mini" style="left:${qx}px;top:${P5.bulleH - 11}px"></span>
      <span class="dha-bulle-txt" style="line-height:${P5.bulleH}px;
        font-size:${P5.bulleTaille}px">${esc(b.texte)}</span>
    </span>`;
    }).join("")}
  </div>`);
    fermePlan();

    return () => {
      vieDuPlan(p, true);
      glisse(sel("p5carte"), tCarte, 0, 110, 14);

      /* bascules en DISPLAY, jamais en opacite : voir le compteur du plan 1 */
      etapes.forEach((e, i) => {
        set(sel("p5n" + i), { display: "none" }, pose(0));
        set(sel("p5n" + i), { display: "inline" }, pose(e.t));
        if (i < etapes.length - 1) set(sel("p5n" + i), { display: "none" }, pose(etapes[i + 1].t));
      });
      set(sel("p5lab"), { opacity: 0 }, pose(0));
      set(sel("p5lab"), { opacity: 1 }, pose(tCarte + 4 / FPSR));

      /* chaque message VOLE depuis son bord (700 px en 9 images), le compteur encaisse */
      P5.bulles.forEach((b, i) => {
        glisse(sel("p5l" + i), tL[i], b.cote === "g" ? -700 : 700, 0, 9);
        punchY(sel("p5num"), tL[i] + 2 / FPSR, 6, 5);
      });
      /* la rampe finale est l'impact le plus fort du plan, UNE image apres sa
         derniere bascule (jamais de bascule pendant une transform animee) */
      punchY(sel("p5num"), tL[2] + (RAMPE + 2) / FPSR, 10);
    };
  }

  /* ── PLAN 6 : « CONSENTEMENT ». La carte entre, la pastille vole depuis la droite,
        et le TOGGLE s'active : le bouton glisse, la surface passe a l'accent. */
  function plan6(p) {
    const tCarte = beat(p, 0);
    const tPastille = beat(p, 1);
    const tCoche = beat(p, 2);
    const knobY = Math.round((P6.togH - P6.knob) / 2) - 2;
    const knobX = knobY + 2;
    const course = P6.togW - P6.knob - 2 * (knobX + 2);

    ouvrePlan(p);
    html.push(`<div class="dha-carte" id="${id("p6carte")}" style="left:${P6.x}px;width:${P6.w}px;
    top:${P6.y}px;height:${P6.h}px">
    <span class="dha-titre-s" style="left:0;right:0;text-align:center;top:${P6.titreTop}px;
      font-size:${P6.titreTaille}px;line-height:${Math.round(P6.titreTaille * 1.1)}px">${esc(P6.titre)}</span>
    <span class="dha-pastille" id="${id("p6past")}" style="left:${Math.round((P6.w - P6.labW) / 2)}px;
      top:${P6.labY}px;width:${P6.labW}px;height:${P6.labH}px">
      <span class="dha-lab" style="left:0;right:0;top:0;line-height:${P6.labH}px;
        text-align:center;font-size:${P6.labTaille}px">${esc(P6.lab)}</span>
    </span>
    <span class="dha-toggle" id="${id("p6tog")}" style="left:${P6.togX}px;top:${P6.togY}px;
      width:${P6.togW}px;height:${P6.togH}px;border-radius:${Math.round(P6.togH / 2)}px">
      <span class="dha-knob" id="${id("p6knob")}" style="left:${knobX}px;top:${knobY + 2}px;
        width:${P6.knob}px;height:${P6.knob}px"></span>
    </span>
    <span class="dha-ligne" style="left:${P6.texteX}px;
      top:${P6.togY + Math.round((P6.togH - P6.texteTaille * 1.2) / 2)}px;
      font-size:${P6.texteTaille}px;line-height:${Math.round(P6.texteTaille * 1.2)}px">${esc(P6.texte)}</span>
  </div>`);
    fermePlan();

    return () => {
      vieDuPlan(p, true);
      glisse(sel("p6carte"), tCarte, 0, 110, 14);
      glisse(sel("p6past"), tPastille, 420, 0, 10);

      /* le toggle s'active : le bouton GLISSE, la surface passe a l'accent, la carte
         encaisse d'une plongee */
      set(sel("p6tog"), { backgroundColor: av(ENC, 0.08), borderColor: av(ENC, 0.25) }, pose(0));
      set(sel("p6knob"), { x: 0 }, pose(0));
      set(sel("p6tog"), { backgroundColor: ACC, borderColor: ACC }, pose(tCoche));
      table(sel("p6knob"), ARRIVEE, tCoche, 7, (v) => ({ x: Math.round(course * (1 - v)) }));
      set(sel("p6knob"), { x: course }, pose(tCoche + 7 / FPSR));
      punchY(sel("p6carte"), tCoche + 2 / FPSR, 5, 5);
    };
  }

  /* ── PLAN 7 : « LA QUESTION ». L'ENTREE DE LA BARRE DE LA REFERENCE : montee depuis le
        bas + tassement d'echelle (P2_BARRE_ECH), caret, frappe, clic. Pas de sortie ici :
        la barre continue au plan 8, ou elle sort par la droite. */
  function plan7(p) {
    const tBarre = beat(p, 0);
    const tFrappe = beat(p, 1);
    const tClic = beat(p, 2);

    const signes = Array.from(String(params.question));
    const bx = P7.barX, by = P7.barY;
    const boutonX = P7.barW - P7.boutonMarge - P7.bouton;
    const boutonY = Math.round((P7.barH - P7.bouton) / 2);
    const course = ZONE - by + 16;

    ouvrePlan(p);
    html.push(`<div class="dha-barre" id="${id("p7barre")}" style="left:${bx}px;width:${P7.barW}px;
    top:${by}px;height:${P7.barH}px">
    <span class="dha-tape" id="${id("p7txt")}" style="left:${P7.pad}px;font-size:${P7.taille}px;
      line-height:${P7.barH}px">${signes.map((c, i) =>
        `<span id="${id("p7c" + i)}">${c === " " ? "&nbsp;" : esc(c)}</span>`).join("")}</span>
    <span class="dha-caret" id="${id("p7caret")}" style="left:${P7.pad}px;
      top:${Math.round((P7.barH - P7.taille * 1.15) / 2)}px;
      width:${P7.caretW}px;height:${Math.round(P7.taille * 1.15)}px"></span>
    <span class="dha-envoi" id="${id("p7envoi")}" style="left:${boutonX}px;top:${boutonY}px;
      width:${P7.bouton}px;height:${P7.bouton}px">
      <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="${ACC}" stroke-width="2.4"
        stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
    </span>
  </div>
  <div class="dha-cur" id="${id("p7cur")}"><svg viewBox="0 0 34 50" width="${CUR.w}" height="${CUR.h}">
    <path d="M2 2l0 40 10-10 6 14 7-3-6-13 15-1z" fill="${ENC}" stroke="#111111"
      stroke-width="3" stroke-linejoin="round"/></svg></div>`);
    fermePlan();

    return () => {
      vieDuPlan(p, false);
      /* la montee de la reference : translation freinee + tassement d'echelle subtil */
      set(sel("p7barre"), { y: course, scale: 0.963 }, pose(0));
      table(sel("p7barre"), ARRIVEE, tBarre, 15, (v) => ({
        y: Math.round(course * v), scale: 1 - 0.037 * v,
      }));
      set(sel("p7barre"), { y: 0, scale: 1 }, pose(tBarre + 15 / FPSR));

      signes.forEach((_c, i) => set(sel("p7c" + i), { opacity: 0 }, pose(0)));
      set(sel("p7caret"), { opacity: 0, x: 0 }, pose(0));
      const tCaret = tBarre + 15 / FPSR;
      for (let b = 0; ; b++) {
        const t = tCaret + b * 12 / FPSR;
        if (t >= tFrappe) break;
        set(sel("p7caret"), { opacity: b % 2 === 0 ? 1 : 0 }, pose(t));
      }
      set(sel("p7caret"), { opacity: 1 }, pose(tFrappe));

      let x = 0;
      signes.forEach((c, i) => {
        const t = tFrappe + i / FPSR;
        set(sel("p7c" + i), { opacity: 1 }, pose(t));
        x += avance(c, P7.taille);
        set(sel("p7caret"), { x: Math.round(x) }, pose(t));
      });
      const tFin = tFrappe + signes.length / FPSR;
      for (let b = 0; ; b++) {
        const t = tFin + b * 12 / FPSR;
        if (t >= tClic) break;
        set(sel("p7caret"), { opacity: b % 2 === 0 ? 1 : 0 }, pose(t));
      }
      set(sel("p7caret"), { opacity: 0 }, pose(tClic));

      const depart = [700, ZONE + 80];
      const cible = [bx + boutonX + P7.bouton - 18, by + boutonY + P7.bouton - 16];
      set(sel("p7cur"), { x: depart[0], y: depart[1], scale: 1 }, pose(0));
      const tArrivee = tClic - 24 / FPSR;
      table(sel("p7cur"), ARRIVEE, tArrivee, 20, (v) => ({
        x: Math.round(cible[0] + (depart[0] - cible[0]) * v),
        y: Math.round(cible[1] + (depart[1] - cible[1]) * v),
      }));
      set(sel("p7envoi"), { scale: 1 }, pose(0));
      set(sel("p7cur"), { scale: 0.86 }, pose(tClic));
      set(sel("p7envoi"), { scale: 0.92 }, pose(tClic));
      set(sel("p7cur"), { scale: 1 }, pose(tClic + 2 / FPSR));
      set(sel("p7envoi"), { scale: 1 }, pose(tClic + 2 / FPSR));
    };
  }

  /* ── PLAN 8 : « LA REPONSE ». La barre SORT PAR LA DROITE EN ACCELERANT pendant que
        les fiches retrouvees (avatar, date, citation) montent decalees, puis POUSSEE en
        saut franc sur la ligne cle, suivie de la DERIVE mesuree. */
  function plan8(p) {
    const tSortie = beat(p, 0);
    const tF = [beat(p, 1), beat(p, 2), beat(p, 3)];
    const tPile = beat(p, 4);
    const tPoussee = beat(p, 5);
    const tFinPlan = p.debut_montage_s + p.duree_s;

    const boutonX = P7.barW - P7.boutonMarge - P7.bouton;
    const boutonY = Math.round((P7.barH - P7.bouton) / 2);
    const lignes = P8.fiches.map((f) => f.ligne ?? String(params.ligne_cle));
    const avY = Math.round((P8.ficheH - P8.avCote) / 2);

    ouvrePlan(p);
    html.push(`<div class="dha-barre" id="${id("p8barre")}" style="left:${P7.barX}px;width:${P7.barW}px;
    top:${P7.barY}px;height:${P7.barH}px">
    <span class="dha-tape" style="left:${P7.pad}px;font-size:${P7.taille}px;line-height:${P7.barH}px">${
      Array.from(String(params.question)).map((c) => c === " " ? "&nbsp;" : esc(c)).join("")}</span>
    <span class="dha-envoi" style="left:${boutonX}px;top:${boutonY}px;width:${P7.bouton}px;height:${P7.bouton}px">
      <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="${ACC}" stroke-width="2.4"
        stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
    </span>
  </div>
  ${P8.fiches.map((f, i) => `<div class="dha-fiche" id="${id("p8f" + i)}"
    style="left:${P8.ficheX}px;width:${P8.ficheW}px;top:${P8.yPile[i]}px;height:${P8.ficheH}px">
    <span class="dha-avatar" style="left:${P8.pad}px;top:${avY}px;
      width:${P8.avCote}px;height:${P8.avCote}px;font-size:${P8.avTaille}px">${esc(f.init)}</span>
    <span class="dha-date" style="left:${P8.texteX}px;top:${P8.dateTop}px;font-size:${P8.dateTaille}px">${esc(f.date)}</span>
    <span class="dha-ligne" style="left:${P8.texteX}px;top:${P8.ligneTop}px;font-size:${P8.ligneTaille}px">${esc(lignes[i])}</span>
  </div>`).join("")}
  <div class="dha-cle" id="${id("p8cle")}" style="top:${P8.cleY}px">
    <span class="dha-cle-txt" style="font-size:${P8.cleTaille}px;
      line-height:${Math.round(P8.cleTaille * 1.3)}px">${esc(String(params.ligne_cle))}</span>
  </div>`);
    fermePlan();

    return () => {
      vieDuPlan(p, false);
      /* LA SORTIE DE LA REFERENCE : la barre accelere vers la droite, elle ne freine pas */
      set(sel("p8barre"), { x: 0, opacity: 1 }, pose(0));
      sortie(sel("p8barre"), tSortie, SC_W - P7.barX + 80, 0, 10);

      P8.fiches.forEach((_f, i) => {
        const s = sel("p8f" + i);
        set(s, { opacity: 0, x: P8.xEntree[i], y: P8.entree }, pose(0));
        set(s, { opacity: 1 }, pose(tF[i]));
        table(s, ARRIVEE, tF[i], 12, (v) => ({ y: Math.round(P8.entree * v) }));
        set(s, { y: 0 }, pose(tF[i] + 12 / FPSR));
        table(s, ARRIVEE, tPile + i * 2 / FPSR, 10, (v) => ({ x: Math.round(P8.xEntree[i] * v) }));
        set(s, { x: 0 }, pose(tPile + (i * 2 + 10) / FPSR));
        set(s, { opacity: 0 }, pose(tPoussee));
      });

      /* LA POUSSEE : saut franc a 1,85x, puis la DERIVE mesuree jusqu'a la coupe */
      set(sel("p8cle"), { opacity: 0, scale: P8.poussee }, pose(0));
      set(sel("p8cle"), { opacity: 1 }, pose(tPoussee));
      const nDerive = Math.max(4, Math.round((tFinPlan - tPoussee) * FPSR) - 1);
      table(sel("p8cle"), DERIVE, tPoussee + 1 / FPSR, nDerive,
        (v) => ({ scale: P8.poussee * v }));
    };
  }

  /* ── PLAN 9 : « LA SENSATION », vue du CLIENT. Sa silhouette entre, les deux ronds
        de pensee montent, la bulle s'ouvre (« je lui ai déjà dit ça… non ? »), puis le
        badge « ? » se pose sur la bulle et la tete bascule : le doute, montre. */
  function plan9(p) {
    const tFil = beat(p, 0);
    const tBulle = beat(p, 1);
    const tBadge = beat(p, 2);

    ouvrePlan(p);
    html.push(`<div class="dha-groupe" id="${id("p9buste")}">
  ${busteHtml("p9", P9.cx, P9.teteR, P9.teteCy, P9.epW, P9.epH, P9.epTop)}
  </div>
  ${P9.pense.map((c, i) => `<span class="dha-pense" id="${id("p9p" + i)}" style="`
    + `left:${c.x - c.r}px;top:${c.y - c.r}px;width:${2 * c.r}px;height:${2 * c.r}px"></span>`).join("")}
  <span class="dha-pensee" id="${id("p9bulle")}" style="left:${P9.bulleX}px;top:${P9.bulleY}px;
    width:${P9.bulleW}px;height:${P9.bulleH}px;border-radius:${P9.bulleR}px">
    ${P9.lignes.map((l, i) => `<span class="dha-bulle-l"
      style="left:${P9.bullePad + 6}px;top:${Math.round((P9.bulleH - P9.lignes.length * P9.ligneLh) / 2) + i * P9.ligneLh}px;
      font-size:${P9.ligneTaille}px;line-height:${P9.ligneLh}px">${esc(l)}</span>`).join("")}
  </span>
  <span class="dha-rond" id="${id("p9badge")}" style="left:${P9.bulleX + P9.bulleW - Math.round(P9.badge * 0.7)}px;
    top:${P9.bulleY - Math.round(P9.badge * 0.4)}px;width:${P9.badge}px;height:${P9.badge}px;
    background:${ACC}"><span class="dha-badge-txt" style="font-size:${P9.badgeTaille}px;
    color:${FOND}">?</span></span>`);
    fermePlan();

    return () => {
      vieDuPlan(p, true);
      glisse(sel("p9buste"), tFil, 0, 140, 13);
      set(sel("p9regard"), { x: 0, y: -4 }, pose(0));

      /* la pensee monte : petit rond, moyen rond, puis la bulle s'ouvre depuis son coin */
      P9.pense.forEach((_c, i) => {
        const sp = sel("p9p" + i);
        set(sp, { opacity: 0, scale: 0.2 }, pose(0));
        const t = tBulle + i * 4 / FPSR;
        set(sp, { opacity: 1 }, pose(t));
        table(sp, POP, t, 6, (v) => ({ scale: 0.2 + 0.8 * v }));
        set(sp, { scale: 1 }, pose(t + 6 / FPSR));
      });
      const sb = sel("p9bulle");
      set(sb, { opacity: 0, scale: POPE[0] }, pose(0));
      set(sb, { opacity: 1 }, pose(tBulle + 8 / FPSR));
      table(sb, POPE, tBulle + 8 / FPSR, 12, (v) => ({ scale: v }));
      set(sb, { scale: 1 }, pose(tBulle + 20 / FPSR));

      /* le badge « ? » se pose, la bulle encaisse, la tete bascule : le doute */
      const bg = sel("p9badge");
      set(bg, { opacity: 0, scale: 1.8 }, pose(0));
      set(bg, { opacity: 1 }, pose(tBadge));
      table(bg, POPE, tBadge, 6, (v) => ({ scale: 1.8 - 0.8 * v }));
      set(bg, { scale: 1 }, pose(tBadge + 6 / FPSR));
      punchY(sb, tBadge + 1 / FPSR, 7, 6);
      /* le regard monte vers la bulle a la pensee, puis vers le badge au doute */
      set(sel("p9regard"), { x: 18, y: -10 }, pose(tBulle + 10 / FPSR));
      set(sel("p9regard"), { x: 24, y: -14 }, pose(tBadge + 2 / FPSR));
    };
  }

  /* ── PLAN 10 : « LA QUALITE ». Le titre se frappe, deux lignes volent et sont
        jugees : le souvenir en gris prend la croix, l'archive en encre porte sa puce
        d'horodatage et prend la coche en accent. */
  function plan10(p) {
    const tCarte = beat(p, 0);
    const tFrappe = beat(p, 1);
    const tL1 = beat(p, 2);
    const tCroix = beat(p, 3);
    const tL2 = beat(p, 4);
    const tCoche = beat(p, 5);
    const ligneW = P10.w - 2 * P10.pad;
    const mx = ligneW - P10.lignePad - P10.marque;
    const chipX = mx - 24 - P10.chipW;

    const mots = [];
    P10.titre.forEach((l) => { Array.from(l).forEach((c) => mots.push(c)); });

    ouvrePlan(p);
    html.push(`<div class="dha-carte dha-clip" id="${id("p10carte")}" style="left:${P10.x}px;width:${P10.w}px;
    top:${P10.y}px;height:${P10.h}px">
    <span class="dha-titre-s" style="left:${P10.pad}px;top:${P10.titreTop}px;
      font-size:${P10.titreTaille}px;line-height:${P10.titreLh}px">${
      (() => { let kk = -1; return P10.titre.map((l) => Array.from(l)
        .map((c) => { kk++; return `<span id="${id("p10c" + kk)}">${c === " " ? "&nbsp;" : esc(c)}</span>`; }).join(""))
        .join("<br/>"); })()}</span>
    ${P10.lignes.map((t, i) => `<span class="dha-rangee" id="${id("p10r" + i)}"
      style="left:${P10.pad}px;top:${P10.ligneY[i]}px;width:${ligneW}px;height:${P10.ligneH}px">
      <span class="dha-ligne" style="left:${P10.lignePad}px;top:0;color:${i === 0 ? SEC : ENC};
        font-size:${P10.ligneTaille}px;line-height:${P10.ligneH}px">${esc(t)}</span>
      ${i === 1 ? `<span class="dha-chip" style="left:${chipX}px;
        top:${Math.round((P10.ligneH - P10.chipH) / 2)}px;width:${P10.chipW}px;
        height:${P10.chipH}px;font-size:${P10.chipTaille}px;
        border-radius:${Math.round(P10.chipH / 2)}px">${esc(P10.chip)}</span>` : ""}
      <span class="dha-rond" id="${id("p10m" + i)}" style="left:${mx}px;
        top:${Math.round((P10.ligneH - P10.marque) / 2)}px;
        width:${P10.marque}px;height:${P10.marque}px;background:${
        i === 0 ? av(ENC, 0.14) : ACC}">${i === 0
        ? croix(Math.round(P10.marque * 0.46), SEC)
        : coche(Math.round(P10.marque * 0.5), FOND)}</span>
    </span>`).join("")}
  </div>`);
    fermePlan();

    return () => {
      vieDuPlan(p, true);
      glisse(sel("p10carte"), tCarte, 0, 110, 14);

      mots.forEach((_m, kk) => {
        set(sel("p10c" + kk), { opacity: 0 }, pose(0));
        set(sel("p10c" + kk), { opacity: 1 }, pose(tFrappe + kk / FPSR));
      });

      [[0, tL1, tCroix], [1, tL2, tCoche]].forEach(([i, tEntre, tSigne]) => {
        glisse(sel("p10r" + i), tEntre, 760, 0, 10);
        const m = sel("p10m" + i);
        set(m, { opacity: 0, scale: 0.2 }, pose(0));
        set(m, { opacity: 1 }, pose(tSigne));
        table(m, POP, tSigne, 8, (v) => ({ scale: 0.2 + 0.8 * v }));
        set(m, { scale: 1 }, pose(tSigne + 8 / FPSR));
        punchY(sel("p10carte"), tSigne + 1 / FPSR, i === 0 ? 4 : 7, 5);
      });
    };
  }

  /* ── PLAN 11 : « UN SEUL CLIENT ». Le rappel du plan 1 revient, puis tout FILE
        dehors en accelerant sauf UN client, qui grandit au centre, recoit sa coche et
        son prenom. Le survivant est dessine a sa taille FINALE et reduit au depart. */
  function plan11(p) {
    const tGrille = beat(p, 0);
    const tRetrait = beat(p, 1);
    const tCoche = beat(p, 2);

    const iS = P11.survivant;
    const cx = avRangX + iS * avPas + AVATARS.cote / 2;
    const cy = AVATARS.y + AVATARS.cote / 2;
    const dx = cx - P11.cibleX, dy = cy - P11.cibleY;
    const petite = AVATARS.cote / P11.cote;

    ouvrePlan(p);
    html.push(`<span class="dha-kicker" id="${id("p11kick")}" style="top:${P1.kickerY}px;
    font-size:${P1.kickerTaille}px">${esc(P1.kicker)}</span>
  <div class="dha-compteur" id="${id("p11n")}" style="top:${P1.compteurY}px;
    font-size:${P1.compteurTaille}px;line-height:${P1.compteurTaille}px;color:${ACC}">50</div>
  ${avatarsHtml("p11")}
  <span class="dha-avatar dha-av-gros" id="${id("p11gros")}" style="left:${P11.cibleX - P11.cote / 2}px;
    top:${P11.cibleY - P11.cote / 2}px;width:${P11.cote}px;height:${P11.cote}px;
    font-size:${P11.initTaille}px">${esc(AVATARS.inits[iS])}</span>
  <span class="dha-rond" id="${id("p11coche")}" style="left:${P11.cibleX + P11.cote / 2 - 64}px;
    top:${P11.cibleY + P11.cote / 2 - 64}px;width:72px;height:72px;
    background:${ACC}">${coche(40, FOND)}</span>
  <span class="dha-kicker" id="${id("p11nom")}" style="top:${P11.nomY}px;
    font-size:${P11.nomTaille}px;color:${ENC}">${esc(P11.nomLabel)}</span>`);
    fermePlan();

    return () => {
      vieDuPlan(p, true);
      set(sel("p11kick"), { opacity: 0 }, pose(0));
      set(sel("p11kick"), { opacity: 1 }, pose(tGrille));
      set(sel("p11kick"), { opacity: 0 }, pose(tRetrait + 4 / FPSR));
      glisse(sel("p11n"), tGrille, 0, 70, 12);
      /* le compteur SORT vers le haut en accelerant au retrait (-700 : son glyphe fait
         220 px et son haut est a 340, il faut passer -560 pour quitter le cadre) */
      sortie(sel("p11n"), tRetrait, 0, -700, 9);

      /* la pile revient une initiale par image ; au retrait, chacun FILE a droite en
         escalier, la pastille « +46 » aussi, sauf le survivant */
      AVATARS.inits.forEach((_ini, i) => {
        const sv = sel("p11av" + i);
        set(sv, { opacity: 0, x: 0, y: 0 }, pose(0));
        set(sv, { opacity: 1 }, pose(tGrille + i / FPSR));
        if (i === iS) {
          set(sv, { opacity: 0 }, pose(tRetrait));
        } else {
          const d = Math.abs(i - iS);
          sortie(sv, tRetrait + Math.min(d, 6) / FPSR, 620 + 60 * d, 0, 8);
        }
      });
      const pl = sel("p11plus");
      set(pl, { opacity: 0, x: 0 }, pose(0));
      set(pl, { opacity: 1 }, pose(tGrille + AVATARS.inits.length / FPSR));
      sortie(pl, tRetrait + 5 / FPSR, 900, 0, 8);

      /* le survivant prend le relais a l'image exacte du retrait, a la taille et a la
         place de son avatar, puis rejoint le centre en grandissant */
      const s = sel("p11gros");
      set(s, { opacity: 0, x: dx, y: dy, scale: petite }, pose(0));
      set(s, { opacity: 1 }, pose(tRetrait));
      table(s, ARRIVEE, tCoche, 14, (v) => ({
        x: Math.round(dx * v), y: Math.round(dy * v), scale: petite + (1 - petite) * (1 - v),
      }));
      set(s, { x: 0, y: 0, scale: 1 }, pose(tCoche + 14 / FPSR));

      set(sel("p11coche"), { opacity: 0, scale: 0.2 }, pose(0));
      set(sel("p11coche"), { opacity: 1 }, pose(tCoche + 14 / FPSR));
      table(sel("p11coche"), POP, tCoche + 14 / FPSR, 8, (v) => ({ scale: 0.2 + 0.8 * v }));
      set(sel("p11coche"), { scale: 1 }, pose(tCoche + 22 / FPSR));

      /* le prenom monte sous l'avatar une fois la coche posee */
      set(sel("p11nom"), { opacity: 0, y: 14 }, pose(0));
      set(sel("p11nom"), { opacity: 1 }, pose(tCoche + 18 / FPSR));
      table(sel("p11nom"), ARRIVEE, tCoche + 18 / FPSR, 8, (v) => ({ y: Math.round(14 * v) }));
      set(sel("p11nom"), { y: 0 }, pose(tCoche + 26 / FPSR));
    };
  }

  /* ── PLAN 12 : « S'ABONNER », FOND ORANGE. Le statement POPPE, les puces volent depuis
        la gauche, la pilule claire entre par la droite avec la longue queue de freinage de
        la pilule de la reference, et son texte noir se frappe. */
  function plan12(p) {
    const tCarte = beat(p, 0);
    const tPuce = [beat(p, 1), beat(p, 2), beat(p, 3)];
    const tPil = beat(p, 4);
    const tFrappe = beat(p, 5);

    const signes = Array.from(P12.cta);
    const pilX = Math.round((SC_W - P12.pilW) / 2);
    const course = SC_W - pilX + 40;

    ouvrePlan(p);
    html.push(`<span class="dha-titre-p dha-pop" id="${id("p12titre")}" style="top:${P12.titreY}px;
    font-size:${P12.titreTaille}px;line-height:${Math.round(P12.titreTaille * 0.92)}px">${esc(P12.titre)}</span>
  ${P12.puces.map((t, i) => `<span class="dha-puce" id="${id("p12p" + i)}"
    style="left:${P12.blocX}px;top:${P12.puceY[i]}px">
    <span class="dha-puce-c" style="width:${P12.puceCote}px;height:${P12.puceCote}px;
      top:${Math.round((P12.puceTaille * 1.3 - P12.puceCote) / 2)}px;background:${ECLAT}"></span>
    <span class="dha-ligne" style="left:${P12.puceDx}px;top:0;font-size:${P12.puceTaille}px;
      line-height:${Math.round(P12.puceTaille * 1.3)}px;color:${TIT}">${esc(t)}</span>
  </span>`).join("")}
  <span class="dha-pil" id="${id("p12pil")}" style="left:${pilX}px;top:${P12.pilY}px;
    width:${P12.pilW}px;height:${P12.pilH}px;border-radius:${P12.pilR}px;background:${ENC}">
    <span class="dha-cta" style="left:0;right:0;text-align:center;top:0;font-size:${P12.ctaTaille}px;
      line-height:${P12.pilH}px;color:${FOND}">${
      signes.map((c, i) => `<span id="${id("p12c" + i)}">${c === " " ? "&nbsp;" : esc(c)}</span>`).join("")
      }<span class="dha-cta-f" id="${id("p12f")}">${fleche(P12.ctaFleche, FOND)}</span></span>
  </span>`);
    fermePlan();

    return () => {
      vieDuPlan(p, false);
      popIn(sel("p12titre"), tCarte, 14);

      /* les puces volent depuis la gauche, une par beat, et freinent longuement */
      P12.puces.forEach((_t, i) => glisse(sel("p12p" + i), tPuce[i], P12.puceFrom, 0, 11));

      /* l'entree de la pilule de la reference : 500 px de course, longue queue */
      set(sel("p12pil"), { opacity: 0, x: course }, pose(0));
      set(sel("p12pil"), { opacity: 1 }, pose(tPil));
      table(sel("p12pil"), ARRIVEE, tPil, 14, (v) => ({ x: Math.round(course * v) }));
      set(sel("p12pil"), { x: 0 }, pose(tPil + 14 / FPSR));

      signes.forEach((_c, i) => {
        set(sel("p12c" + i), { opacity: 0 }, pose(0));
        set(sel("p12c" + i), { opacity: 1 }, pose(tFrappe + i / FPSR));
      });
      const tF = tFrappe + signes.length / FPSR;
      set(sel("p12f"), { opacity: 0, scale: 0.3 }, pose(0));
      set(sel("p12f"), { opacity: 1 }, pose(tF));
      table(sel("p12f"), POP, tF, 6, (v) => ({ scale: 0.3 + 0.7 * v }));
      set(sel("p12f"), { scale: 1 }, pose(tF + 6 / FPSR));
    };
  }

  /* ─────────────────────────────────────────────── avance d'un signe, pour le caret. */
  const avance = (c, taille) => (AVANCES[c] ?? 0.55) * taille;

  const appliqueurs = [];
  plans.forEach((p) => {
    const f = ECRITS[p.n];
    if (!f)
      throw new Error(`${meta.id} : le plan ${p.n} n'est pas écrit. `
        + `Seuls les plans ${Object.keys(ECRITS).join(", ")} le sont.`);
    appliqueurs.push(f(p));
  });

  /* ══════════════════════════════════════════════════════════════════════════════════ CSS */
  const OMB = `0 26px 40px ${av("#000000", OMBRE_ALPHA)}`;
  const css = `
@font-face{font-family:'${U}-titre';src:url('${params.police_titre_fichier}') format('woff2');
  font-weight:400;font-style:normal;font-display:block}
@font-face{font-family:'${U}-corps';src:url('${params.police_corps_fichier}') format('woff2');
  font-weight:100 900;font-style:normal;font-display:block}
@font-face{font-family:'${U}-service';src:url('${params.police_service_fichier}') format('woff2');
  font-weight:100 900;font-style:normal;font-display:block}
@font-face{font-family:'${U}-accent';src:url('${params.police_accent_fichier}') format('woff2');
  font-weight:400;font-style:italic;font-display:block}
${sel("bd")}{position:absolute;left:0;top:0;width:${ctx.width}px;height:${HFEN}px;overflow:hidden}
${sel("scn")}{position:absolute;left:0;top:0;width:${SC_W}px;height:${SC_H}px;
  transform-origin:0 0;font-family:'${U}-corps',sans-serif;
  background:${FOND};transform:scale(${k.toFixed(6)})}
.dha-ph{position:absolute;left:0;top:0;width:${SC_W}px;height:${Math.round(B)}px;
  opacity:0;will-change:opacity}
.dha-fond{position:absolute;inset:0;background:${FOND};overflow:hidden}
.dha-zone{position:absolute;left:0;top:0;width:${SC_W}px;height:${Math.round(ZONE)}px;
  overflow:hidden}
/* l'enveloppe de vie d'un plan : elle porte le zoom lent de tenue et la sortie acceleree.
   PAS de will-change : sur une couche pleine zone qui contient tout le plan, la promotion
   en calque suffit a faire diverger la composition (panne du 2026-08-05 sur les degrades
   de sequence-annonce-produit, retrouvee ici au premier crible de deterministe). */
.dha-mv{position:absolute;inset:0;transform-origin:50% 45%}
.dha-nappe{position:absolute;border-radius:50%}

/* ── surfaces : une carte est une surface, lue par son ombre et son filet, pas sa valeur */
.dha-carte,.dha-fiche,.dha-barre,.dha-plaque{position:absolute;background:${CARTE};
  border:1px solid ${av(ENC, 0.10)};box-sizing:border-box;box-shadow:${OMB}}
.dha-carte{border-radius:28px}
.dha-fiche{border-radius:${P8.ficheR}px}
.dha-barre{border-radius:${Math.round(P7.barH / 2)}px;transform-origin:50% 50%}
.dha-plaque{border-radius:${P4.slotR}px}
/* le pop d'echelle de la reference : origine en bas au centre (P1_ORIGINE 50 % 94,7 %) */
.dha-pop{transform-origin:50% 95%}
.dha-clip{overflow:hidden}

/* ── typo : Instrument Sans porte presque tout (v3), Anton les statements, mono le service */
.dha-titre{position:absolute;font-family:'${U}-titre',sans-serif;font-weight:400;
  letter-spacing:-0.02em;text-transform:uppercase;color:${TIT};white-space:nowrap}
.dha-titre-p{position:absolute;left:${(SC_W - 840) / 2}px;width:840px;text-align:center;
  font-family:'${U}-titre',sans-serif;font-weight:400;letter-spacing:-0.02em;
  text-transform:uppercase;color:${TIT}}
.dha-titre-s{position:absolute;font-weight:600;letter-spacing:-0.01em;color:${TIT};
  white-space:nowrap}
.dha-nom{position:absolute;font-weight:700;letter-spacing:0.01em;color:${TIT};
  white-space:nowrap}
.dha-serif{position:absolute;left:0;width:${SC_W}px;text-align:center;
  font-family:'${U}-accent',serif;font-style:italic;font-weight:400}
/* les CHIFFRES en Anton, comme la charte le demande (« les chiffres des compteurs sont
   des titres ») : c'est aussi elle qui pese 200 px sans que la graisse 700 d'une
   variable ne s'en mele. */
.dha-compteur{position:absolute;left:${(SC_W - 640) / 2}px;width:640px;text-align:center;
  font-family:'${U}-titre',sans-serif;font-weight:400;
  letter-spacing:-0.02em;white-space:nowrap}
.dha-carte .dha-compteur{left:0;width:100%}
.dha-compteur > span{position:absolute;left:0;right:0;top:0;display:none}
.dha-kicker{position:absolute;left:0;width:${SC_W}px;text-align:center;
  font-family:'${U}-service',monospace;font-weight:600;letter-spacing:0.18em;
  text-transform:uppercase;color:${SEC}}
.dha-lab{position:absolute;font-family:'${U}-service',monospace;font-weight:600;
  letter-spacing:0.16em;text-transform:uppercase;color:${SEC};white-space:nowrap}
.dha-lab-c{position:absolute;left:0;right:0;text-align:center;
  font-family:'${U}-service',monospace;font-weight:600;letter-spacing:0.16em;
  text-transform:uppercase;color:${SEC}}
.dha-date{position:absolute;font-family:'${U}-service',monospace;font-weight:600;
  letter-spacing:0.16em;text-transform:uppercase;color:${SEC};white-space:nowrap}
.dha-ligne{position:absolute;font-weight:400;color:${ENC};white-space:nowrap}
.dha-perdu{position:absolute;font-weight:400;letter-spacing:0.45em;color:${SEC};
  white-space:nowrap}

/* ── le vocabulaire illustratif : avatars, pastille de compte, signes */
.dha-avatar{position:absolute;border-radius:50%;background:${av(ENC, 0.14)};
  border:3px solid ${FOND};box-sizing:border-box;color:${ENC};font-weight:600;
  display:flex;align-items:center;justify-content:center}
.dha-av-gros{background:${av(ENC, 0.16)};border:5px solid ${ACC};
  transform-origin:50% 50%}
.dha-plus{position:absolute;background:${ACC};color:${FOND};font-weight:600;
  display:flex;align-items:center;justify-content:center;z-index:20;
  transform-origin:50% 50%}
.dha-rond{position:absolute;border-radius:50%;display:flex;align-items:center;
  justify-content:center;transform-origin:50% 50%}
.dha-sep{position:absolute;height:1px;background:${av(ENC, 0.10)}}

/* ── plan 4 : le trait, l'impulsion, les icones dessinees */
.dha-trait{position:absolute;border-radius:${P4.traitH / 2}px;transform-origin:0% 50%}
.dha-pulse{position:absolute;border-radius:50%;background:${ACC}}
.dha-ico-bulle{position:absolute;background:${av(ENC, 0.18)}}
.dha-ico-queue{position:absolute;background:${av(ENC, 0.18)};transform:rotate(45deg)}
.dha-disque{position:absolute;background:${av(ENC, 0.18)}}

/* ── plan 5 : les messages, de vraies bulles a queue */
.dha-bulle-mini{position:absolute;background:${av(ENC, 0.12)}}
.dha-ico-queue-mini{position:absolute;width:18px;height:18px;
  background:${av(ENC, 0.12)};transform:rotate(45deg)}
.dha-bulle-txt{position:absolute;left:0;right:0;text-align:center;font-weight:400;
  color:${ENC};white-space:nowrap}

/* ── plan 6 : pastille de service, toggle */
.dha-pastille{position:absolute;border:1px solid ${av(ENC, 0.18)};background:${av(ENC, 0.07)};
  border-radius:${P6.labH / 2}px;box-sizing:border-box}
.dha-toggle{position:absolute;border:2px solid;box-sizing:border-box}
.dha-knob{position:absolute;border-radius:50%;background:${ENC};
  box-shadow:0 3px 8px ${av("#000000", 0.35)}}

/* ── plan 7 */
.dha-tape{position:absolute;top:0;color:${ENC};white-space:nowrap;font-weight:400}
.dha-tape > span{opacity:0}
.dha-caret{position:absolute;background:${ACC}}
.dha-envoi{position:absolute;border-radius:50%;background:${av(ACC, 0.16)};
  border:2px solid ${av(ACC, 0.55)};box-sizing:border-box;display:flex;align-items:center;
  justify-content:center;transform-origin:50% 50%}
.dha-cur{position:absolute;left:0;top:0;width:${CUR.w}px;height:${CUR.h}px;
  transform-origin:2px 2px;
  filter:drop-shadow(0 3px 4px rgba(0,0,0,0.35))}

/* ── plan 8 */
.dha-cle{position:absolute;left:0;width:${SC_W}px;text-align:center;
  transform-origin:50% 50%}
/* la ligne cle est la SIGNATURE de la charte : Instrument Serif Italic, en couleur
   (l'eclat sur fond sombre), minuscules — decision de Yoan du 2026-08-10 */
.dha-cle-txt{position:relative;display:inline-block;font-family:'${U}-accent',serif;
  font-style:italic;font-weight:400;color:${ECLAT};white-space:nowrap}

/* ── les silhouettes (plans 2 et 9), la pensee, le message voyageur */
.dha-groupe{position:absolute;inset:0}
.dha-tete{position:absolute;border-radius:50%;background:${av(ENC, 0.16)};
  transform-origin:50% 100%}
.dha-regard{position:absolute;left:50%;top:50%;margin-left:-11px;margin-top:-11px;
  width:22px;height:22px;border-radius:50%;background:${FOND}}
.dha-epaules{position:absolute;background:${av(ENC, 0.16)}}
.dha-pense{position:absolute;border-radius:50%;background:${av(ENC, 0.12)};
  transform-origin:50% 50%}
.dha-pensee{position:absolute;background:${av(ENC, 0.12)};transform-origin:12% 88%}
.dha-bulle-l{position:absolute;font-weight:400;color:${ENC};white-space:nowrap}
.dha-badge-txt{font-family:'${U}-corps',sans-serif;font-weight:700}
.dha-msg-vol{position:absolute;background:${ENC};transform-origin:50% 50%;
  display:flex;align-items:center;justify-content:center}
.dha-msg-pts{color:${FOND};font-weight:700;font-size:20px;letter-spacing:0.05em}

/* ── plan 10 : les rangees jugees et la puce d'horodatage */
.dha-titre-s > span{opacity:1}
.dha-rangee{position:absolute;border-radius:${P10.ligneR}px;background:${av(ENC, 0.07)}}
.dha-chip{position:absolute;border:1px solid ${av(ENC, 0.20)};box-sizing:border-box;
  color:${SEC};font-family:'${U}-service',monospace;font-weight:600;
  letter-spacing:0.14em;text-transform:uppercase;white-space:nowrap;
  display:flex;align-items:center;justify-content:center}

/* ── plan 12 */
.dha-puce{position:absolute}
.dha-puce-c{position:absolute;left:0;border-radius:4px}
.dha-pil{position:absolute;box-sizing:border-box;overflow:hidden;
  box-shadow:${OMB}}
.dha-cta{position:absolute;font-weight:600;letter-spacing:0em;white-space:nowrap}
.dha-cta > span{opacity:0}
.dha-cta-f{display:inline-block;vertical-align:middle;margin-left:14px;
  transform-origin:50% 50%}
`;

  return {
    css,
    html: `<div id="${id("bd")}"><div id="${id("scn")}">\n${html.join("\n")}\n</div></div>`,
    assets: [
      { src: DOSSIER_FONTS + params.police_corps_fichier, dest: params.police_corps_fichier },
      { src: DOSSIER_FONTS + params.police_titre_fichier, dest: params.police_titre_fichier },
      { src: DOSSIER_FONTS + params.police_service_fichier, dest: params.police_service_fichier },
      { src: DOSSIER_FONTS + params.police_accent_fichier, dest: params.police_accent_fichier },
    ],
    apply(tl) {
      ops.length = 0;

      /* visibilite des plans : COUPES FRANCHES, etat pose en dur des deux cotes */
      plans.forEach((p, i) => {
        const s = sel("ph" + p.n);
        set(s, { opacity: i === 0 ? 1 : 0 }, pose(0));
        if (i > 0) {
          set(sel("ph" + plans[i - 1].n), { opacity: 0 }, pose(p.debut_montage_s));
          set(s, { opacity: 1 }, pose(p.debut_montage_s));
        }
      });

      for (const f of appliqueurs) f();

      /* Les operations sont accumulees puis posees dans l'ordre du temps : une image rendue
         seule doit etre identique a la meme image atteinte en jouant depuis le debut. */
      ops.sort((a, b) => a[2] - b[2]);
      for (const o of ops) tl.set(o[0], o[1], o[2]);
    },
  };
}
