# Catalogue des gestes

Copie du catalogue du planificateur de Yoan (`planificateur/CATALOGUE.md`, 2026-10-30), réglée pour son monteur du
studio (2026-11-18). Une ligne par geste : quand le poser, support, ce que le plan donne. Les valeurs ne te regardent
pas. Champs exacts : `format.md`. Paramètres complets d'un gabarit : son README dans
`$SK/animations-yoan/moteur/briques/gabarits/<nom>/README.md`, à lire SEULEMENT pour un gabarit que tu poses ; un
exemple écrit : `grep` ciblé dans `exemple-demo.json`. Support : caméra (sur lui), demi (demi-écran), plein (fond
granuleux r4-01c).

**Ce que le moteur du studio ne fait pas** (le validateur le refuse) : sorties de zoom `dezoom_eclair`, `dezoom_lent`,
`retour_adouci` (un zoom tient jusqu'à la coupe qui suit : sortie `coupe`), `suivi`, `broll` « dossier » (ses plans
filmés passent par la brique b-roll), cadre `large` du hook (accepté, rendu comme `serre`).

## Gestes de base (éléments de la timeline)

| Geste | Support | Quand | La timeline donne |
|---|---|---|---|
| `hook` | caméra | toujours, une fois, sur la 1re phrase | ouverture (mots dits avant le titre), titre en 2 lignes + mot doré (le mot appuyé), secondaire (2e hook, dès la 1re image), cadre `serre` ou `large` (main qui pointe), `jusqua` (une coupe), sortie `coupe` (le dézoom d'ouverture la fait) |
| `sous_titres` | haut de l'image | tout le reel sauf hook, plein écran à mots, CTA | groupes de 1 à 2 lignes (`|`), un mot ou une expression dorée par groupe au plus, `{"accent": "fort"}` 1 ou 2 fois par reel |
| `zoom` éclair | caméra | accentuer un mot appuyé, cacher une coupe (sortie `coupe` sur `@coupeN`) | `a` (attaque du mot), sortie `coupe` (le zoom tient jusqu'à la coupe de prise qui suit) |
| `zoom` adouci | caméra | marquer un moment sans le frapper (rapprochement 110 % en 1 s) | `a` ; tient jusqu'à la coupe qui suit |
| `zoom` lent | caméra | une phrase qui se déroule, jamais pour accentuer (rapprochement) | `a`, `fin` ; tient jusqu'à la coupe qui suit |
| `suivi` | | n'existe pas ici (cadre fixe) | |
| `mot_derriere` | caméra | le mot qui porte l'idée, dit, derrière la tête ; rare | `mot`, `a`, `jusqua` |
| `faisceau` | transition | cacher une coupe, entrer/sortir d'un plein écran (déduit seul pour les pleins) | `a`, `recadrage`? |
| `plein_ecran` | plein | une phrase forte à lire en grand, mot par mot | `lignes` (texte dit, en entier), `variante` `seule` (une ligne à la fois) ou `milieu` (exige un doré), `dore` |
| `demi_ecran` | demi | montrer l'objet dont on parle plus longtemps que la caméra ne le permet, visage présent | `contenu` (gabarit), `bascule`? vers plein (`pousse` ou `faisceau`), `sortie` `remonte` ou `coupe` |
| `broll` | plein | n'existe qu'en visuel de démonstration (`dossier`) : à éviter, préférer un gabarit | |
| `cta` | caméra (au-dessus de la tête) ou fond | une fois, sur le mot-clé à commenter | `mot`, `consigne`, `bas`, `quand` (3 ancres), `jusqua` |
| `motion` | plein ou caméra | un gabarit ci-dessous | `gabarit`, `support`, `de`, `a`, `params` (instants en `{"@": ancre}`) |
| `sur_mesure` | plein ou caméra | une animation que le catalogue n'a pas : commandée au constructeur (étape 4) | `calque` (dossier écrit par le constructeur), `de`, `a`, `plein`? |
| `son` | | un son de la famille par événement visuel d'une animation ; un son de moment drôle | `son` (`whoosh`, `pop`, `clic`, `glisse`, `shimmer`, `curseur`, `tic`, `cta`, `cta_lignes`) + `a` (+ `duree` pour curseur) ; ou `fichier` + `sousVoix` |

## Gabarits de motion (`$SK/animations-yoan/moteur/briques/gabarits/`)

Sons : familles de REGLES « Son » (whoosh = un panneau ou un document qui entre, pop = un petit objet qui éclot, clic =
un élément d'interface qui s'ajoute, glisse = un objet qui glisse ou se verse, shimmer = un état qui passe au doré,
curseur = un curseur qui se déplace). Instants : ceux des paramètres du gabarit.

| Gabarit | Support | Quand l'utiliser | Paramètres clés | Sons (un par événement) |
|---|---|---|---|---|
| `fichier-heros` | caméra (phrase courte) ou plein (phrase qui construit le fichier) ; jamais demi | « fichier de contexte », un document qui se construit | `mode`, `doc {x,y,k}`, `sources` x4 + `verse` (option), `tDoc`, `tIA`, `titre {t, texte}`, `sections` x3, `tOr` | whoosh au doc, pop par source, glisse au versement, clic par section, shimmer au doré |
| `fichier-partout` | plein ou demi | « n'importe quelle IA, n'importe quel outil », le même fichier partout | `mode` `copies`/`cle`/`coffre`, `tuiles [{logo,x,y,t}]`, `tFichier`, `tPrecieux`, `copies [t]` | pop par tuile, whoosh au fichier, shimmer au doré, clic par copie arrivée |
| `minuteur` | plein (centre) ou caméra (au-dessus de la tête, ou torse si sous-titres en haut) | une durée dite (« 30 minutes ») | `cx, cy`, `depart` (s), `entree`, `debut`, `fin`, `etiquette`, `reduction` | `cta` à l'entrée, `cta_lignes` 0,25 s après, glisse à la réduction |
| `minuteur-suite` | caméra (torse) | la durée PUIS ce qu'on fait pendant (liste) : remplace un B-roll | `minuteur {...}`, `panneau {x,y,w,entree,entete}`, `liste {items [{icone,texte,t}]}` | comme minuteur + whoosh au panneau, clic par ligne |
| `liste-torse` | caméra (buste) | une énumération dite face caméra (3 lignes, 4 au plus) | `items [{texte,t}]`, `actif`, `sortie` | clic par ligne (3e passage : du son sur toutes les animations ; le « muette » de son README est antérieur) |
| `liste-cascade` | contenu de panneau (demi, plein) | une ligne par idée dite, avec icône | `items [{icone,texte,tag,t}]`, `actif` | clic par ligne |
| `panneau-viseurs` | cadre (demi, plein) | contenant d'une liste ou d'un schéma | `entete {gauche,droite,t}`, `contenu` | whoosh à l'entrée |
| `schema-noeuds` | contenu de panneau | des étapes reliées, un système, un flux | `noeuds [{x,y,icone,etiquette,t}]`, `liens [{de,a,t}]`, `actif`, `consigne`? | pop par nœud |
| `comparaison-empilee` | demi ou plein | avant / après, sans / avec, V1 / V2 | `cartes [{y,h,titre,texte,etiquette,t}]`, `actif` | whoosh par carte, shimmer à l'actif |
| `vignette-morph` | plein | un chiffre qui devient une étiquette, puis ce qu'il recouvre | `chiffre {texte,unite,t}`, `pastille {t}`, `titre`, `lignes` | glisse au morph, clic par ligne |
| `appariement` | plein | relier, brancher, « ça marche avec tout » (logos) | `gauche`, `droite {icones|logo}`, `contact {t}`, `plus`, `legende` | glisse au contact, clic aux « + » |
| `regle-pin` | caméra (bas) ou demi | « à quel moment », une progression, une valeur qui monte, V1 -> V6 | `y`, `reperes [{x,texte}]`, `entree`, `sortie`, `pin {t, arrets [{t,x,texte,d}]}`, `ellipse {t}` | whoosh à l'entrée, pop au pin, curseur par déplacement (`duree`), shimmer à l'ellipse |
| `champ-saisie` | caméra (poitrine) | une consigne qu'on tape, ce qui ne va pas (raturé) | `lignes`, `frappe`, `ratures`, `ecrasement` | rien sur la frappe ; clic à l'écrasement |
| `objet-signature` | caméra (à côté de la tête) | métaphore courte : `fichier` ou `horloge` (refusé tel quel au tour 10 : à éviter) | `objet`, `cx, cy`, `entree`, `sortie` | pop |
| `objet-tournant` | caméra | là où la main pointe (cube « ? » mystère au-dessus d'un doigt levé) | `cx, cy`, `taille`, `image`? (sinon face du style), `entree`, `fin` | pop à l'entrée |
| `image-plein` | plein, enchaîné après un plein à mots | moment drôle ou image qui dit la phrase (photo fournie) | `image` (relative à la timeline), `entree`, `h` | son du moment drôle (`fichier`) sur la 1re image visible (entrée + 1 image) |
| `demi-ecran` | cadre | (posé par l'élément `demi_ecran`, ne pas l'appeler en motion) | | |

Icônes (`icone`) : fichier, video, micro, onde, etincelle, bulle, mail, agenda, pile, texte, ecran. Logos (`logo`) :
openai (ChatGPT), claude, gemini, mistral, perplexity, notion, instagram, make, n8n (toujours dans une tuile). Pas de
WhatsApp, pas de fausse capture d'interface. Musique (`ambiance`) : hiphop (défaut), trap, boombap, nappe, null.

## Zone sûre (pour les positions en params)

x 91 à 990 à partir de y 237 ; à droite sous y 997 pas au-delà de x 899 ; en bas à gauche sous y 1479 pas avant
x 366 ; rien sous y 1650. Sous-titres : haut à y 256, jusqu'à ~y 470 sur 3 lignes. Tête au repos : cheveux vers
y 620, menton vers y 1130 ; poitrine vers y 1190 à 1480. Plein écran : contenu de y 560 à ~1500.
