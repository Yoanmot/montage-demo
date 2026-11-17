# DA @ia.yoan : la typographie

Source : charte graphique v1 (`charte/charte-graphique-v1.html`, section 03). Toutes les
polices sont dans `fonts/`, en woff2 latin (Easy Pixel en TTF, tel que fourni par Yoan).
Aucune n'est chargée depuis un CDN : les visuels se rendent hors ligne.

## 1. Quatre rôles, quatre polices (plus une, pour les sous-titres)

| Famille | Fichier | Rôle | Où |
|---|---|---|---|
| **Anton** | `fonts/anton-latin.woff2` | **le titre qui frappe** | hooks, titres de slide, cartons, logo |
| **Instrument Serif Italic** | `fonts/instrument-serif-italic-latin.woff2` | **l'accentuation** : le mot ou la ligne qui porte le sens | la deuxième ligne, sous le titre |
| **Instrument Sans** | `fonts/instrument-sans-latin.woff2` | **le corps qui se lit** | paragraphes, phrases de contexte |
| **JetBrains Mono** | `fonts/jetbrains-mono-latin.woff2` | **le service** : numéros, tags, timecodes, handle | micro-labels uniquement |
| **Easy Pixel** | `fonts/EasyPixel.ttf` | **les sous-titres vidéo** | bandeau de captions, et rien d'autre |

## 2. La combinaison type

Anton blanc en majuscules, Instrument Serif italique orange juste en dessous, Instrument Sans
pour la phrase de contexte, JetBrains Mono pour le numéro et le handle. **Ce bloc de quatre
suffit à construire n'importe quelle slide.**

La troisième ligne est la plus importante pour l'identité : c'est le contraste entre le
condensé et le serif italique qui distingue les visuels d'un carrousel générique. Un serif
italique posé sous un titre ultra-condensé crée à lui seul la signature.

## 3. Règles par police

### Anton, le titre
- **Toujours en majuscules.** Jamais en corps de texte. Jamais sous 40 px.
- Interlignage 0,92. Interlettrage -0,02em.
- Blanc `#FFFFFF`. Un titre n'est jamais orange.
- Anton n'a **qu'une seule graisse** (400). Il n'y a pas de gras d'Anton : pour appuyer,
  on monte en taille, pas en graisse.

### Instrument Serif Italic, l'accentuation
- 60 à 80 % de la taille du titre.
- **Toujours en couleur** (`#FFA31A` sur fond sombre), toujours en minuscules.
- Toujours en deuxième ligne, sous le titre.
- **Une seule fois par visuel.**

### Instrument Sans, le corps
- 26 à 34 px, interlignage 1,55, **4 lignes maximum**.
- Gris clair `#F2EEE8`. Blanc pur réservé à une phrase seule au centre d'une slide.
- Neutre et ouverte : c'est elle qui tient la lisibilité en petit sur fond sombre.

### JetBrains Mono, le service
- Majuscules, interlettrage large (0,16 à 0,34em selon la taille).
- Numéros de slide, tags, timecodes, handle. 20 à 24 px en vidéo.
- Toujours petit, toujours orange ou gris. **Jamais pour du texte long.**

### Easy Pixel, les sous-titres
- Voir `contraintes-captions.json` : c'est là que vivent les valeurs exactes.
- Elle ne sert **qu'aux** sous-titres vidéo. Jamais un titre, jamais un corps de texte.

## 4. Échelle

### Carrousel (1080 × 1350)

| Usage | Taille | Police |
|---|---|---|
| Hook (slide 1) | 120 px | Anton |
| Statement | 112 px | Anton |
| CTA | 96 px | Anton |
| Titre de slide interne | 84 px | Anton |
| Titre de slide à étapes | 76 px | Anton |
| Ligne d'accentuation | 0,68 × le titre | Instrument Serif Italic |
| Corps | 28 px | Instrument Sans |
| Kicker, numéro, handle | 20 px | JetBrains Mono |

Les titres tiennent dans la fourchette 72 à 120 px annoncée par la charte. Anton étant
ultra-condensé, un hook long tient sur deux lignes en très gros : c'est exactement ce que
demande le format Instagram.

### Vidéo (1080 × 1920)

| Usage | Taille |
|---|---|
| Sous-titre (Easy Pixel) | 72 px |
| Titre à l'image (Anton) | 96 à 172 px |
| Micro-label (JetBrains Mono) | 20 à 24 px |

## 5. Casse, interlettrage, interlignage

| Paramètre | Règle |
|---|---|
| Casse des titres | capitales, toujours |
| Casse de l'accentuation | minuscules, toujours |
| Casse du corps | casse phrase |
| Casse des sous-titres | capitales, sans ponctuation finale |
| Casse des micro-labels | capitales |
| Interlettrage des titres | -0,02em |
| Interlettrage des micro-labels | 0,16 à 0,34em |
| Interligne de titre | 0,92 |
| Interligne d'accentuation | 1,05 |
| Interligne de corps | 1,55 |
| Italique | réservé à Instrument Serif. Jamais de faux italique sur Anton ni Instrument Sans |
| Souligné | jamais |

## 6. Traitement du glyphe

- **Aucun contour, aucune ombre portée.** Sur les sous-titres, c'est le bandeau noir qui
  assure la lisibilité, pas un cerne.
- **Aucun dégradé dans les lettres.** Une lettre est d'une seule couleur.
- **Aucune rotation, aucun étirement**, ni sur le logo ni sur le texte.
- **Aucun emoji dans le texte à l'écran.** Ils vivent dans la légende Instagram.
- Le grain ne passe jamais sur le texte : il s'arrête au fond.

## 7. Le logo

- `YOAN.` en Anton majuscules, le point toujours de la couleur opposée au mot
  (blanc sur noir → point `#C2700B` ; noir sur orange → point `#FFFFFF`).
- Baseline `IA POUR COACHS` en JetBrains Mono, interlettrage 0,3em.
- Zone de protection : la hauteur d'un « O » tout autour. Jamais posé sur une zone de photo
  chargée.
- Taille minimale du bloc logo + baseline : 120 px de large. En dessous, logo seul.
- Interdits : contour, ombre portée, dégradé dans les lettres, rotation, étirement.

## 8. Le style d'accent Anton pour les captions vidéo (ajouté le 2026-08-12, fourni par Yoan)

Ce style est le **second** des deux seuls styles de captions autorisés dans un reel : le style
COURANT reste Easy Pixel (`captions-bandeau-pixel`), le style ACCENT est celui-ci. Il ne concerne
que la **vidéo** : rien ici ne s'applique aux carrousels, où les règles du §3 tiennent telles
quelles.

**Usages.** Le hook, ou les mots vraiment importants du reel (punchline, chiffre, mot-pivot).
Quelques mots à la fois, jamais une phrase de service, jamais le sous-titrage courant.

**Traitements permis** (et seulement en vidéo, sur ce style) :

- **Mélange de graisses dans un même bloc** : thin, bold, ultrabold sur des mots voisins. C'est le
  traitement signature, il assure la hiérarchie sans changer de police.
- **Contours** sur les lettres.
- **Couleurs de la palette** (`couleurs.md`), jamais une couleur hors palette.
- **Remplissage réactif au fond** : le mot prend ses couleurs de ce qu'il y a derrière lui.

Référence visuelle fournie par Yoan : `../../references/montage/sources/anton-accent-exemple.png`
(« and they » en light, « actually » en bold, « crush. » en ultrabold rempli par le fond).

**Note.** Ce style **lève, pour ce cas d'emploi uniquement**, trois règles du §3 et du §6 (Anton
d'une seule graisse, aucun contour, une lettre d'une seule couleur) : elles continuent de valoir
partout ailleurs. Et comme toujours, **la charte HTML fait foi en cas de conflit**
(`charte/charte-graphique-v1.html`).

## 9. Les polices héritées de la v0 (@mussy0.2)

`oswald-latin`, `inter-latin`, `playfair-latin`, `playfair-italic-latin`, `bogart-*`,
`abril-fatface` restent dans `fonts/` parce que **les 15 templates de `banque/effets/` sont
calibrés dessus** et cesseraient de rendre si on les retirait. Elles ne font plus partie de
la charte : aucun nouveau visuel ne doit les employer.

## 9. La chute de hook en serif italique (validée par Yoan le 2026-08-18)

Application VALIDÉE du couple de signature de la charte (Anton blanc, Instrument Serif Italic
orange juste en dessous) au hook d'un reel. Ce n'est pas une règle neuve : c'est le §3 appliqué
à la vidéo, avec deux écarts que Yoan a acceptés en connaissance de cause.

**La forme.** La DERNIÈRE ligne du hook, et elle seule, passe en Instrument Serif Italic,
**bas de casse**, en orange éclat `#FFA31A`. Tout le reste du hook est en Anton. Une ligne
entière, jamais un mot enchâssé au milieu d'une ligne Anton : cette variante-là a été essayée
(« d'*idées* de contenu ») et refusée par Yoan (« c'est nul en fait »).

**Les deux écarts acceptés**, à redéclarer à chaque emploi :

1. **Le corps.** Le §7 donne la ligne d'accentuation à 0,68 × le titre. Sur une chute de hook
   elle est composée à environ 1,6 × la taille d'Anton. La règle du §7 compare une bas de casse
   serif à des capitales ultra-condensées : au corps de charte, la chute devient une note de bas
   de page. Ce qui doit rester vrai, c'est le rapport optique, pas le rapport numérique.
2. **Le contraste.** L'orange éclat ne tient pas les seuils habituels sur un fond clair : mesuré
   à 1,39:1 sur un t-shirt blanc, 2,3-2,4:1 sur un mur gris. Ce qui fait lire ce mot est sa
   TEINTE et sa forme, pas sa luminance.
   **Le remède est la POSITION, jamais une plaque ni une ombre** (le §6 les interdit) : aller
   chercher un fond sombre déjà présent dans l'image. Sur le reel `creer-contenu-le-plus-facile`,
   poser la ligne sur l'ombre du bras a fait passer le contraste de 1,39 à 3,60:1 sans changer
   une seule couleur.

**Méthode de mesure, à appliquer partout.** Le fond se mesure **SOUS L'ENCRE des glyphes**, pas
sous la boîte de la ligne : une boîte compte des pixels qu'aucune lettre ne touche et donne des
contrastes faux (écart constaté sur ce reel : 2,4-3,7:1 annoncé contre 3,6-4,8:1 réel). Et il se
mesure sur TOUTES les images de la fenêtre, gestes de caméra joués, jamais sur une image choisie.
