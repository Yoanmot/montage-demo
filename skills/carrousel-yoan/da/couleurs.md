# DA @ia.yoan : les couleurs

Source : la charte graphique v1 composée par Yoan dans Claude Design
(`charte/charte-graphique-v1.html`, section 02). Elle remplace intégralement la palette
extraite de @mussy0.2, qui reste consultable dans l'historique git.

Le socle de la marque, en une phrase : **un atelier, pas un laboratoire.** Fond sombre et
matiéré, une seule lumière orange, zéro effet froid ou futuriste.

## 1. La palette, en entier

### Les quatre couleurs de marque

| Token | hex | Où |
|---|---|---|
| `accent.signature` | **`#C2700B`** | l'orange de la marque : aplats, halos, fonds, gros titres, le point du logo |
| `accent.eclat` | **`#FFA31A`** | sa version lumineuse : un mot accentué, un chiffre, un label, sur fond noir |
| `carton.noir` | **`#000000`** | noir pur, réservé au bandeau des sous-titres |
| `texte.blanc` | **`#FFFFFF`** | titres et sous-titres |

### Les neutres : fonds et texte

| Token | hex | Où |
|---|---|---|
| `fond.defaut` | **`#0A0A09`** | le noir chaud, fond par défaut de tout |
| `fond.gris.haut` | **`#3B3B39`** | haut du fond dégradé gris (fond 01) |
| `fond.gris.bas` | **`#1A1A18`** | bas du fond dégradé gris (fond 01) |
| `bordure` | **`#232120`** | bordures, séparateurs, cartes |
| `texte.secondaire` | **`#A39B90`** | texte secondaire, légendes, mentions |
| `texte.corps` | **`#F2EEE8`** | le corps de texte, gris très clair |

## 2. Les règles d'usage

1. **Les deux oranges ne se touchent jamais dans le même bloc.** `#C2700B` est ce qu'on voit
   en grand : fonds, halos, aplats, gros titres. `#FFA31A` est réservé aux petits éléments
   sur fond noir : un mot accentué, un chiffre, un label.
2. **La règle des 80 / 15 / 5.** 80 % de noir et de matière, 15 % de blanc pour le texte,
   5 % d'orange. **Deux zones oranges dans le même écran, c'est déjà une de trop.**
3. **Sur un aplat orange plein, le texte est noir.** Sur un fond orange dégradé, il est blanc,
   et l'accentuation passe en `#FFA31A`.
4. **Le titre est blanc, pas orange.** L'orange descend sur la ligne d'accentuation en serif
   italique, juste sous le titre. C'est ce déplacement qui fait la signature.
5. **Le corps de texte est en gris clair `#F2EEE8`**, jamais en blanc pur, sauf pour une
   phrase seule au centre d'une slide.
6. **Le noir n'est pas un fond, c'est de la matière.** Il est toujours dégradé et grainé
   (voir `fonds/`), jamais un aplat plat, sauf le bandeau de sous-titres qui, lui, est un
   `#000000` opaque à 100 %.
7. **Une seule lumière, et elle est chaude.** La source est toujours hors cadre, en haut à
   gauche ou en haut à droite, et sa chute vers le noir occupe au moins 70 % de la hauteur.
8. **Le point après « YOAN » est toujours de la couleur opposée au mot.** C'est le seul
   ornement du logo.

## 3. Ce que la DA interdit

- Toute couleur froide : bleu, violet, sarcelle, vert. Rien de clinique, rien de futuriste.
- Une deuxième zone orange dans le même écran.
- Les deux oranges côte à côte dans le même bloc.
- Un titre en orange (l'orange appartient à la ligne d'accentuation).
- Un aplat noir plat en fond de visuel, sans dégradé ni grain (le bandeau de sous-titres
  est la seule exception).
- Un contour, une ombre portée, un dégradé dans les lettres, une rotation, un étirement,
  sur le logo comme sur le texte.
- Un halo net, avec un bord visible. La lumière est toujours diffuse.

## 4. Correspondance avec l'ancienne DA (v0, @mussy0.2)

Utile pour lire les 15 templates de `banque/effets/`, qui sont tous calibrés sur la v0.

| v0 | v1 | Ce qui change vraiment |
|---|---|---|
| `#1C1C1C` fond carrousel | `#0A0A09` | plus sombre, plus chaud, et désormais dégradé plus grain |
| `#090809` fond vidéo | `#0A0A09` | fond unique pour les deux supports |
| `#FFA31A` accent unique | `#C2700B` + `#FFA31A` | l'accent se dédouble : un orange de surface, un orange de détail |
| `#EFEDEA` texte repos | `#F2EEE8` | quasi identique |
| titre orange | titre blanc | l'orange descend sur la ligne d'accentuation |
| grain interdit | grain obligatoire | l'inversion la plus profonde entre les deux chartes |
