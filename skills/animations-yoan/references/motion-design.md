# Motion design : écrire un effet à la main, sans référence à mesurer

Ce fichier traduit le vocabulaire du motion design After Effects (celui des tutos VSL : animateurs
de texte, nuls parentés, graphes de vitesse, caméras 3D, track mattes, trim paths, bounce) en
**HyperFrames** : du HTML, du CSS, du SVG et une timeline GSAP sérialisable.

Il sert quand il n'y a **rien à mesurer** : Yoan décrit une intention (« le titre arrive lettre par
lettre avec un écho vert », « la scène part vers la gauche et la suivante entre en zoom »), pas une
vidéo de référence. Quand il y a une vidéo, on ne devine pas : on passe par `effet-clone`, qui
mesure. Écrire à la main est un chemin par défaut plus faible, il ne remplace jamais une mesure
disponible.

> Le contrat d'une entrée de banque reste **`contrat-template.md`**, sans exception ni tolérance.
> Les pièges de rendu restent **`pieges-rendu.md`**. Ce fichier n'ouvre aucune permission : il
> donne des recettes qui tiennent DANS ces deux contrats.

---

## 1. Les cinq murs

Ils décident de tout ce qui suit. Une recette qui les franchit n'est pas une recette, c'est une
panne différée.

1. **Aucun plugin GSAP.** La page rend avec le GSAP de base. Sont dedans : `CSSPlugin` (donc
   `transform`, `opacity`, `filter`, `clipPath`, les variables CSS) et `AttrPlugin` (donc
   `attr: { ... }` sur les attributs SVG). Sont dehors : `SplitText`, `MorphSVG`, `DrawSVG`,
   `TextPlugin`, `MotionPath`, `Physics2D`. Tout ce que ces plugins font se refait à la main,
   les recettes ci-dessous sont exactement ça.
2. **Rien que du JSON dans `vars`.** Pas de `onUpdate`, pas de valeur fonction, pas de `stagger`
   calculé. Le désordre, le décalage et l'aléatoire se calculent dans `render` et sortent en
   nombres.
3. **Chaque instruction porte son temps absolu**, en secondes depuis le début de la compo, dérivé
   de `c.start`. Aucun enchaînement implicite.
4. **État de départ ET état d'arrivée posés en dur** (`tl.set`) autour de chaque geste. Une image
   rendue seule doit être complète.
5. **Déterminisme total** : pas de `Math.random`, pas d'horloge, pas de réseau. Deux rendus, deux
   fichiers identiques au bit près.

Corollaire pratique : **tout se découpe dans `render`**. Les caractères, les mots, les copies, les
valeurs d'un compteur, les positions d'une grille existent déjà dans le HTML avant que la timeline
ne commence. GSAP ne fait que déplacer et éteindre ce qui est déjà là.

---

## 2. Le dictionnaire After Effects → HyperFrames

| Ce que dit le tuto | Ce qu'on écrit |
|---|---|
| calque nul, tout est parenté dessus | un `<div>` conteneur ; on anime le conteneur, les enfants suivent |
| pré-composition | un `<div>` avec son propre `transform`, ses enfants en coordonnées locales |
| animateur de texte + sélecteur de plage + offset | un `<span>` par caractère (ou par mot), une instruction par span, décalée d'un nombre d'images fixe |
| plugin Text Exploder | `Array.from(texte)` pour les caractères, `split(/\s+/)` pour les mots, dans `render` |
| track matte (alpha / luma) | `-webkit-mask-image` + `mask-image`, ou un parent en `overflow:hidden` |
| calque de forme + Trim Paths | un `<path>` SVG, `stroke-dasharray` figé, `strokeDashoffset` animé |
| Fast Box Blur | `filter: blur(Npx)` |
| Deep Glow / lueur | empilement de `drop-shadow()`, ou `text-shadow` à deux lobes |
| effet Fill | une copie du calque avec une autre `color`, posée dessous ou dessus |
| mode de fusion (subtract, screen) | `mix-blend-mode: difference` · `screen` · `multiply` |
| Turbulent Displace | filtre SVG `feTurbulence` + `feDisplacementMap`, `scale` animé par `attr` |
| effet Grid | `repeating-linear-gradient`, masqué par un `radial-gradient` |
| caméra 3D + calques en 3D | parent en `perspective`, monde en `transform-style: preserve-3d`, calques en `translate3d` |
| déplacer la caméra | déplacer le MONDE dans le sens inverse (voir §6) |
| Depth of Field | `filter: blur()` par calque, calculé depuis `|z − focus|` dans `render` |
| Light Sweep | une bande en dégradé qui traverse, masquée par la forme du calque |
| effet Typewriter | un span par caractère, `tl.set` d'opacité à des temps explicites |
| plugin compteur de nombres | un span par valeur affichée, allumé/éteint par `tl.set` |
| plugin Bouncer, « bounce it » | `ease: c.ez("back.out(n)")`, ou une table d'amortissement écrite à la main |
| F9 puis on tire le graphe | voir la table des courbes (§3) |
| marqueur sur la voix off | une ancre de la timeline, résolue par `resolveAnchor` |
| couper au raccord, `Ctrl+Shift+D` | la borne de l'élément dans `timeline.json`, pas une affaire de template |

---

## 3. Les courbes : la table qui traduit les graphes du tuto

Le tuto ne dit jamais « ease », il dit « appuie F9 et fais un graphe qui part de 100 vers 0 ». Ces
quatre formulations reviennent en boucle et valent quatre courbes :

| Formulation du tuto | Ce que ça fait | Courbe |
|---|---|---|
| graphe de 100 vers 0 | démarre vite, freine à l'arrivée. C'est l'ENTRÉE d'une scène | `power2.out` · `power3.out` si le geste est long |
| graphe de 0 vers 100 | part lentement, accélère au maximum sur le raccord. C'est la SORTIE d'une scène | `power2.in` · `power3.in` sur une sortie franche |
| smooth graph | freine des deux côtés, geste interne à une scène | `power2.inOut` |
| bounce it (plugin) | dépasse la cible puis revient, sans osciller longtemps | `back.out(1.7)` à `back.out(3)` |

Trois règles qui viennent de la structure même du tuto :

- **Une sortie de scène accélère jusqu'au raccord.** Le mouvement est coupé à sa vitesse maximale,
  c'est ça qui rend une transition invisible. `power2.in`, et l'image de coupe tombe sur la
  dernière image du geste.
- **Une entrée de scène freine.** `power2.out`, et le mouvement finit avant que la voix n'attaque
  le mot suivant.
- **Un geste interne (icône qui pope, ligne qui pousse) est symétrique ou rebondit.** `power2.inOut`
  ou `back.out`, jamais une accélération franche : elle se lirait comme une transition.

`back.out(n)` : `n` est l'amplitude du dépassement, l'équivalent exact de l'« amplitude » du plugin
Bouncer du tuto (il la règle autour de 25 %). `back.out(1.7)` dépasse d'environ 10 %,
`back.out(3)` d'environ 22 %. Au-delà de 4, le geste devient élastique et cesse d'être un pop.

Une courbe reste **l'identité de l'effet** : elle ne s'expose jamais en paramètre (contrat, §2).

---

## 4. Le timing : les nombres du tuto, en images

Le tuto compte en images, jamais en secondes, et toujours les mêmes nombres. À 30 images par
seconde :

| Geste | Images | Secondes |
|---|---|---|
| pop d'un élément (échelle, rotation, bounce) | 6 à 7 | 0,20 à 0,23 |
| décalage entre deux éléments d'un même groupe | 2 à 3 | 0,07 à 0,10 |
| écho d'ombre portée derrière un texte | 3 | 0,10 |
| entrée d'un bloc de texte (position + flou + opacité) | 8 à 12 | 0,27 à 0,40 |
| transition de scène (zoom, glissement) | 10 à 14 | 0,33 à 0,47 |
| balayage de lumière sur un badge | 12 à 18 | 0,40 à 0,60 |

Durée d'un geste de `n` images : **`(n − 1) / fps`**, jamais `n / fps` (contrat, §3). Un décalage de
3 images s'écrit `3 / c.fps`, lui, parce que c'est un déplacement dans le temps et non une durée.

---

## 5. Les recettes

Toutes se posent dans un `render(params, ctx)` conforme au contrat. `id` dérive toujours de
`ctx.uid`. Les extraits ci-dessous montrent le morceau qui compte, pas le template entier.

### 5.1 L'animateur de texte (le geste central du tuto)

Opacité, position Y et flou par caractère, décalés de quelques images. C'est ce que le tuto fabrique
avec « animate → opacity → position → blur » puis un offset de sélecteur de plage.

```js
const chars = Array.from(params.texte);          // points de code, jamais slice (piège 12)
const PAS   = 2 / ctx.fps;                       // décalage entre deux caractères, en secondes
const N     = 9;                                 // images du geste, par caractère
const DUR   = (N - 1) / ctx.fps;
const FLOU  = 14;                                // rayon de départ, en pixels de scène

html: `<div id="${id}">${chars.map((ch, i) =>
  ch === " " ? "&nbsp;"
             : `<span class="c" id="${id}-c${i}">${echappe(ch)}</span>`).join("")}</div>`,

apply(tl, c) {
  chars.forEach((ch, i) => {
    if (ch === " ") return;
    const sel = `#${id}-c${i}`;
    const t = c.start + i * PAS;                 // temps ABSOLU, calculé ici, pas un stagger
    tl.set(sel, { opacity: 0, y: 100, filter: `blur(${FLOU}px)` }, c.start);
    tl.to(sel, { opacity: 1, y: 0, duration: DUR, ease: c.ez("power3.out") }, t);
    // le FLOU ne s'interpole pas : paliers ENTIERS posés image par image (voir §7)
    for (let k = 0; k < N; k++) {
      tl.set(sel, { filter: `blur(${Math.round(FLOU * (1 - k / (N - 1)))}px)` }, t + k / c.fps);
    }
    tl.set(sel, { opacity: 1, y: 0, filter: "blur(0px)" }, t + DUR);
  });
},
```

Quatre points qui décident du résultat :

- **Les espaces ne sont pas des spans.** Un `<span>` vide s'effondre en largeur nulle et le mot se
  recolle. `&nbsp;` dans un nœud texte, sans animation.
- **`y` en pixels de scène**, dérivé de `ctx.height` si le geste doit tenir sur un autre format.
- **Le flou se pose, il ne se tween pas.** Un `tl.to` sur `filter: blur()` produit des rayons
  fractionnaires, et un rayon fractionnaire n'est pas rendu deux fois pareil : le rendu cesse
  d'être reproductible (§7, mesuré). Les paliers entiers coûtent une instruction par image et par
  caractère, ce qui reste très en dessous des limites du moteur.
- **Le mot, pas la lettre**, quand le texte dépasse quatre ou cinq mots : le tuto passe lui-même de
  `characters` à `words` dès que la phrase s'allonge. Un span par mot, `PAS` à 3 images.

### 5.2 L'écho d'ombre portée

Le tuto duplique le texte, décale l'animateur de 3 images, applique un Fill et passe en mode
soustraction. En HyperFrames : une copie sous l'original, une autre couleur, le même geste décalé.

```js
// deux blocs identiques, l'écho DESSOUS, décalé de 3 images
tl.set(`#${id}-echo`, { opacity: 0, y: 100 }, c.start);
tl.to(`#${id}-echo`, { opacity: 1, y: 0, duration: DUR, ease: c.ez("power3.out") },
      c.start + 3 / c.fps);
```

`mix-blend-mode: difference` sur l'écho reproduit le mode soustraction du tuto. Sur un fond filmé,
`difference` devient imprévisible : préférer une couleur pleine et `mix-blend-mode: normal` dès que
l'effet se pose sur de la vidéo.

### 5.3 Le balayage lumineux sur un texte (track matte)

Le tuto pose une forme colorée qui traverse, et la track-matte avec le texte. Ici : une copie du
texte dans la couleur d'accent, révélée par une bande qui se déplace.

```js
css: `#${id}-bande{position:absolute;inset:0;
        -webkit-mask-image:linear-gradient(90deg,transparent 0%,#000 35%,#000 65%,transparent 100%);
        mask-image:linear-gradient(90deg,transparent 0%,#000 35%,#000 65%,transparent 100%);
        -webkit-mask-size:60% 100%;mask-size:60% 100%;
        -webkit-mask-repeat:no-repeat;mask-repeat:no-repeat}`,

apply(tl, c) {
  tl.set(`#${id}-bande`, { "--sweep": "-60%" }, c.start);            // variable CSS = JSON
  tl.to(`#${id}-bande`, { "--sweep": "160%", duration: c.dur, ease: c.ez("power2.inOut") }, c.start);
  tl.set(`#${id}-bande`, { "--sweep": "160%" }, c.start + c.dur);
}
```

avec `-webkit-mask-position: var(--sweep) 0;` dans le CSS. Le flou de bord que le tuto obtient avec
un Fast Box Blur sur la forme est déjà dans les arrêts `transparent` du dégradé : c'est moins cher
et parfaitement déterministe.

### 5.4 Le pop d'icône (bounce)

Échelle 0 et rotation de départ, arrivée en dépassement, 6 images.

```js
const D = (7 - 1) / ctx.fps;
tl.set(`#${id}-ico`, { scale: 0, rotation: -28, transformOrigin: "50% 50%" }, c.start);
tl.to(`#${id}-ico`, { scale: 1, duration: D, ease: c.ez("back.out(2.4)") }, c.start);
tl.to(`#${id}-ico`, { rotation: 0, duration: D, ease: c.ez("back.out(1.9)") }, c.start);
tl.set(`#${id}-ico`, { scale: 1, rotation: 0 }, c.start + D);
```

Deux amplitudes légèrement différentes sur l'échelle et la rotation : c'est ce qui empêche le geste
de ressembler à une seule interpolation, et c'est exactement ce que fait le tuto en réglant le
Bouncer séparément sur chaque propriété.

### 5.4 bis Un objet qui grandit BEAUCOUP se dessine grand et se REDUIT

Un élément porté par `will-change: transform` est rastérisé UNE FOIS, à sa taille CSS, puis le
compositeur met la texture à l'échelle. Un disque de 40 px agrandi à 260 px sort donc flou sur son
bord, exactement là où l'oeil se pose à la fin du geste. C'est le même mécanisme que le §16 des
pièges de rendu, vu à l'endroit : le calque cache bien un coût, et ce coût est la définition.

La règle : **la taille CSS est la taille FINALE, et c'est le départ qu'on met à l'échelle.**

```js
/* le disque existe à 260 px, il commence à 40/260 et il finit à 1 */
const petite = 40 / 260;
tl.set(`#${id}-gros`, { x: dx, y: dy, scale: petite }, c.start);
// … table d'arrivée mesurée, de (dx, dy, petite) vers (0, 0, 1)
tl.set(`#${id}-gros`, { x: 0, y: 0, scale: 1 }, c.start + D);
```

Le flou existe toujours, mais il est au DÉPART, sur un objet minuscule et en mouvement, où
personne ne peut le voir. Quand l'objet réduit doit prendre la place d'un autre (une pastille
d'une grille qui devient le sujet du plan), le relais se fait à l'image exacte : l'un passe à
opacité 0, l'autre à 1, au même instant, à la même position et à la même taille.

Corollaire symétrique : un objet qui RÉTRÉCIT beaucoup n'a pas ce problème, et un objet qui fait
l'aller-retour se dessine à sa plus GRANDE taille.

### 5.5 Le trait qui pousse (Trim Path)

```js
const L = 1200;                                   // longueur du chemin, calculée ou mesurée
css: `#${id}-p{stroke-dasharray:${L};stroke-linecap:round;fill:none}`,
apply(tl, c) {
  tl.set(`#${id}-p`, { strokeDashoffset: L }, c.start);
  tl.to(`#${id}-p`, { strokeDashoffset: 0, duration: c.dur, ease: c.ez("power2.inOut") }, c.start);
  tl.set(`#${id}-p`, { strokeDashoffset: 0 }, c.start + c.dur);
}
```

- La longueur se calcule dans `render` (formule géométrique pour une ligne ou un arc) ou se pose en
  constante mesurée. Jamais de `getTotalLength()` : `render` ne touche pas au DOM.
- Le **taper** du tuto (trait qui s'affine aux extrémités) se rend avec un `<linearGradient>` en
  masque sur le trait, pas avec une largeur variable : SVG ne sait pas faire varier `stroke-width`
  le long d'un chemin.
- La **lueur interne** (Inner Glow) se rend avec un second `<path>` identique, plus fin, plus clair,
  posé par-dessus.

### 5.6 Le compteur de nombres

Aucun plugin de texte n'est disponible, donc les valeurs sont écrites à l'avance et allumées une à
une.

```js
const N = Math.round(c.dur * ctx.fps);                     // une valeur par image
const vals = Array.from({ length: N + 1 }, (_, i) =>
  Math.round(params.debut + (params.fin - params.debut) * (i / N)));

html: vals.map((v, i) => `<span class="v" id="${id}-v${i}">${params.prefixe}${v}</span>`).join(""),
apply(tl, c) {
  vals.forEach((_, i) => {
    tl.set(`#${id}-v${i}`, { opacity: i === 0 ? 1 : 0 }, c.start);
    if (i > 0) tl.set(`#${id}-v${i}`, { opacity: 1 }, c.start + i / c.fps);
    if (i < vals.length - 1) tl.set(`#${id}-v${i}`, { opacity: 0 }, c.start + (i + 1) / c.fps);
  });
}
```

Tous les spans sont superposés en `position:absolute` et alignés sur la même origine, sinon le
nombre danse. Utiliser des chiffres tabulaires (`font-variant-numeric: tabular-nums`) : sans ça, la
largeur change à chaque valeur et le bloc respire.

Même mécanique pour le **typewriter** : un span par caractère, `opacity` posée à 1 à
`c.start + i * pas`, rien d'autre.

### 5.7 La scène 3D et sa caméra

```js
css: `#${id}{position:absolute;inset:0;perspective:${(1.1 * ctx.width).toFixed(0)}px;
        perspective-origin:50% 50%}
      #${id} .monde{position:absolute;inset:0;transform-style:preserve-3d}
      #${id} .plan{position:absolute;transform-style:preserve-3d}`,
```

- **La caméra n'existe pas.** Un travelling caméra vers la gauche, c'est le monde qui va vers la
  droite. Un zoom avant, c'est le monde qui avance en `z`. On anime `.monde`, jamais la perspective.
- `perspective` autour de `1,1 × ctx.width` donne une profondeur proche d'un objectif de 50 mm sur
  une compo verticale. Plus court, les plans en `z` s'écrasent ; plus long, la 3D disparaît.
- Chaque plan porte son `translate3d(x, y, z)` en CSS statique, calculé dans `render`. GSAP n'anime
  que le monde et, éventuellement, l'échelle d'un plan.
- **Profondeur de champ** : `filter: blur(k × |z − focus|)` calculé dans `render`, posé en CSS
  statique par plan. Un flou animé sur six plans coûte très cher au rendu pour un gain invisible.
- Le tuto pose une **ombre** derrière chaque capture en dupliquant la forme, en la floutant et en la
  décalant d'un pixel dans l'axe. Ici : un `<div>` frère, même géométrie, `filter: blur(...)`,
  `translateZ(-1px)`, couleur du thème.

### 5.8 La transition de scène

Le tuto n'a que deux transitions, répétées vingt fois : le zoom et le glissement. Les deux
s'écrivent pareil et suivent la règle du §3.

```js
// SORTIE : accélère jusqu'au raccord, coupée au maximum de vitesse
tl.set(`#${id}-monde`, { scale: 1, x: 0 }, c.start);
tl.to(`#${id}-monde`, { scale: 1.6, duration: c.dur, ease: c.ez("power2.in") }, c.start);
tl.set(`#${id}-monde`, { scale: 1.6 }, c.start + c.dur);

// ENTRÉE : freine, le geste finit avant le mot suivant
tl.set(`#${id}-monde`, { scale: 1.35 }, c.start);
tl.to(`#${id}-monde`, { scale: 1, duration: c.dur, ease: c.ez("power2.out") }, c.start);
tl.set(`#${id}-monde`, { scale: 1 }, c.start + c.dur);
```

Le raccord lui-même n'appartient pas au template : c'est la borne de l'élément dans
`timeline.json`. Un template de transition dit COMMENT ça part, jamais QUAND ça coupe.

### 5.9 La grille et le fond

```css
background-image:
  repeating-linear-gradient(0deg,  var(--g) 0 1px, transparent 1px var(--pas)),
  repeating-linear-gradient(90deg, var(--g) 0 1px, transparent 1px var(--pas));
-webkit-mask-image: radial-gradient(ellipse at 50% 45%, #000 0%, transparent 70%);
```

Le `--pas` se calcule depuis `ctx.width` (le tuto le règle « autour de 70 ou 80 » sur une compo
verticale, soit environ `ctx.width / 14`). Le masque radial remplace le masque de calque à contour
progressif du tuto, exactement.

Les **taches floues d'arrière-plan** (les deux cercles des coins) : un `<div>` rond,
`filter: blur(0.12 × ctx.width)`, opacité autour de 0,5. Elles ne s'animent pas.

### 5.9 bis Le fond traité : dégradé diagonal vers accent, plus grain soustractif

Un fond plat fait plat, et c'est la moitié de ce qui sépare une animation qui fait premium d'une
animation qui fait cheap. La recette ci-dessous est **mesurée sur une référence visuelle**, pas
décrite : c'est ce qui la rend rejouable. Rien ici ne s'anime.

```css
/* le dégradé : LINÉAIRE et DIAGONAL, du noir vers l'accent MÉLANGÉ au noir.
   135deg = coin noir en haut à gauche. La ligne du dégradé mesure (L + H) / racine(2), et les
   deux coins opposés tombent exactement sur 0 % et 100 % : c'est ce qui rend l'angle
   indépendant du rapport du cadre, contrairement à `to bottom right`. */
background: linear-gradient(135deg, <noir> 0%, <accent mélangé au noir> 100%);
```

```css
/* le grain : une IMAGE PNG à graine fixe, NOIRE, dont seul l'ALPHA varie */
background-image: url("grain.png");   /* tuile 256 px, alpha = u^10, u uniforme */
background-repeat: repeat;
background-size: 256px 256px;         /* posée au pixel, 1:1 */
opacity: 0.47;
```

**Le grain d'un fond premium est SOUSTRACTIF et MULTIPLICATIF, pas un bruit gris centré.** C'est
la trouvaille qui change tout, et elle se mesure en trois chiffres sur n'importe quelle
référence : le 99e centile de l'écart au dégradé lissé est **positif de moins de 3 niveaux**
(donc rien ne s'éclaircit), le minimum descend très bas, et l'écart-type est **proportionnel à la
base** (mesuré sur une référence : 3,3 sur une base de 32, 10,0 sur 102, 16,3 sur 165, soit un
rapport constant de 0,10). Ce sont des POINTS SOMBRES, et leur force suit la lumière du fond.

Un calque NOIR d'alpha variable composé normalement donne exactement `fond x (1 - alpha)` : c'est
la mécanique, gratuitement, sans blend mode. Une distribution `alpha = u^g` avec `u` uniforme a
pour moyenne `1 / (g + 1)`, ce qui suffit à viser la mesure : `g = 10` plus une opacité de 0,47
redonnent une moyenne de 0,043 et un écart-type de 0,093, contre 0,043 et 0,099 mesurés.

Générer la tuile hors ligne (vingt lignes de Python, graine fixe) et la **stager comme asset**.
Pas de `feTurbulence` : un filtre SVG dans un contexte d'empilement dont l'opacité est animée est
un signal fort de non-déterminisme (§ pièges de rendu), et une image ne coûte rien de plus.

**Mesurer une référence de fond, la méthode qui marche** :

1. **Convertir depuis son profil ICC** avant de lire un seul pixel. Une capture d'écran macOS est
   taggée au profil de l'écran, pas sRGB : lire ses octets bruts fait mentir la teinte (mesuré :
   un coin ocre lu à `#BE9236` en brut vaut `#C59016` en sRGB, et le second est nettement plus
   proche de l'accent).
2. **Séparer le dégradé du grain** par un médian 9 suivi d'un flou 6. Le résultat est le dégradé
   seul ; l'image moins le résultat est le grain seul.
3. **Régresser le dégradé lissé** en `a·x + b·y + c` sur un canal. Si le résidu maximal tient sous
   3 niveaux sur 255, c'est un dégradé linéaire, et `atan2(b, a)` donne l'angle RÉEL. `a = b`
   signifie 45 degrés, ce qui n'est PAS `to bottom right` sur un cadre non carré.
4. **Recouper les canaux** : un rapport `G/R` constant le long de la diagonale prouve que
   l'interpolation est en sRGB non linéaire, c'est-à-dire ce que CSS fait par défaut.

Trois choses se paient si on les rate :

- **La tuile posée à l'échelle 1:1**, sinon elle se voit et le grain se lit comme un motif.
- **Le grain vit dans le FOND**, sous les cartes. Posé au-dessus, il salit les surfaces claires.
- **Le mp4 mange le grain.** Mesuré sur un même rendu : un rapport de 0,10 dans l'image source
  retombe à 0,02 mesuré dans le mp4 encodé, parce que la quantification h264 lisse le bruit à
  1 pixel. Régler le grain sur une référence en PNG et le vérifier ensuite DANS le mp4, jamais
  l'inverse.

Ce qui est borné sur ce fond, c'est la **VALEUR** de l'accent, pas sa **SURFACE** : il a le droit
de couvrir la majeure partie du cadre tant qu'il reste un ocre sombre (mélange avec le noir, pas
l'accent en aplat), assez sourd pour qu'un sujet clair posé dessus se lise sans halo de secours.
Corollaire à connaître avant d'écrire : avec une zone chaude aussi large, **aucune diagonale ne
rend le milieu du cadre sombre**. Un mot en accent posé au milieu du cadre sera forcément sur du
chaud. Deux sorties, pas de troisième : l'ancrer dans le coin sombre de la diagonale, ou mesurer
le contraste obtenu et le déclarer au lieu de le supposer.

Le fond change de DIAGONALE à chaque coupe (pas d'intensité, pas de couleur) : c'est ce qui fait
que chaque plan est une composition neuve sans ajouter un seul mouvement.

### 5.10 La déformation (Turbulent Displace, fisheye)

Les deux existent, les deux coûtent cher, et aucune n'est un premier choix.

```html
<filter id="${id}-turb" filterUnits="userSpaceOnUse" x="80" y="1380" width="920" height="240">
  <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="7" result="n"/>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="0" id="${id}-disp"
                     xChannelSelector="R" yChannelSelector="G"/>
</filter>
```

```js
tl.set(`#${id}-disp`, { attr: { scale: 0 } }, c.start);
tl.to(`#${id}-disp`, { attr: { scale: 18 }, duration: c.dur, ease: c.ez("power1.inOut") }, c.start);
```

- `seed` reste **fixe** : le tuto anime `evolution` par une expression `time * 60`, ce qui ici
  reviendrait à animer `attr: { seed }`, coûteux et laid (le bruit saute à chaque entier). Le
  frétillement s'obtient mieux en animant `scale` sur une table courte.
- Le **fisheye** du tuto (Warp en style fisheye) n'a pas d'équivalent CSS. Deux chemins : un
  `feDisplacementMap` avec une carte radiale en `data:` URI, ou une approximation par
  `perspective` + `rotateX` sur le conteneur. Prendre l'approximation d'abord, et ne sortir le
  filtre que si le rendu ne tient pas.
- Un filtre SVG sur une zone plein cadre multiplie le temps de rendu. Le poser sur la plus petite
  boîte possible, jamais sur `#root`.

---

## 6. La grammaire d'une séquence

Le tuto monte 20 scènes avec toujours la même ossature. C'est elle qu'on reproduit, plus que
n'importe quel effet isolé.

1. **Une scène = un segment de voix off**, borné par deux marqueurs. Ici, deux ancres de mots.
2. **Le texte entre en freinant** (§3), sur l'attaque du mot qu'il porte, jamais au milieu.
3. **Un seul geste porte l'accent** : le texte pope, ou l'icône pope, pas les deux ensemble.
4. **Les éléments secondaires sont décalés de 2 à 3 images** les uns des autres. Simultané se lit
   comme une erreur, décalé se lit comme une intention.
5. **La scène sort en accélérant**, coupée au raccord.
6. **La transition suivante repart de la direction de la sortie** : une scène qui part à gauche est
   suivie d'une scène qui entre par la droite. Le tuto ne se contredit jamais là-dessus, et c'est ce
   qui donne la continuité malgré 20 coupes.

7. **Une coupe de poussée est BORNÉE par le texte qu'elle doit garder lisible.** La poussée
   maximale vaut `largeur du cadre / largeur de la colonne de texte` quand la colonne est centrée
   (une colonne de 864 px dans 1080 plafonne à x1,25, marges comprises il reste x1,20). Au-delà, le
   texte est tranché sur les bords, sans aucune erreur au lint, et c'est le défaut le plus coûteux
   de la chaîne. Une référence qui pousse à x1,85 le fait parce que son texte n'a pas à être lu :
   avant de recopier une valeur de poussée, vérifier ce que le plan doit faire LIRE.

8. **La respiration fait partie du style, au même titre que les coupes franches.** Un sujet est
   POSÉ dans du vide, ses quatre angles visibles, OU il est coupé **franchement et
   volontairement**. Jamais « presque » : une carte qui dépasse de 20 à 60 px, dont on aperçoit
   l'amorce d'un angle arrondi avant qu'elle ne se perde sur le bord, se lit comme un défaut de
   cadrage, pas comme un parti pris. La règle « le sujet occupe 63 à 89 % de la largeur » décrit un
   sujet posé, pas un sujet rogné : elle ne dispense pas de la marge.

   Corollaire géométrique, à vérifier AVANT d'écrire une coupe de poussée sur une carte qui
   contient une boîte : mettre toute la scène à l'échelle `P` crope la carte de
   `(carte × P − cadre)/2` et réduit la marge de la boîte à `(cadre − boîte × P)/2`. Les deux ne
   peuvent pas être grands ensemble : à `P` faible la carte est coupée « presque », à `P` fort la
   boîte affleure les bords. La sortie n'est pas un compromis, c'est de **couper sur l'élément
   seul** : la carte disparaît à l'image de la coupe, la boîte grandit et se centre sur le fond
   traité. C'est aussi ce que fait la référence, qui pose ses barres de prompt seules sur un fond
   travaillé.

9. **Une géométrie PARTIELLE (bandeau, encart, demi-écran) se dessine en PLEIN CADRE, et n'en
   montre qu'une fenêtre.** Le réflexe est de dériver toute la mise en page de la hauteur du
   bandeau ; c'est ce qui produit du chrome d'interface réduit, donc du cheap. Dessiner la scène
   en 1080 x 1920 et masquer le reste par `overflow:hidden` règle trois choses d'un coup :
   - le fond traité du §5.9 bis reste celui d'une animation plein cadre, ce qui est le cas que la
     DA autorise (`couleurs.md` §2 bis) : c'est le plan filmé qui en masque le bas, pas le fond
     qui a été fabriqué à la taille d'un bandeau ;
   - la typographie et les traits gardent leur échelle de plein cadre, donc rien n'est « réduit » ;
   - le même template, rendu à hauteur de fenêtre = 1, donne EXACTEMENT la plaque dont a besoin
     l'effet qui métamorphose ce bandeau en plein cadre. La continuité devient vraie par
     construction au lieu d'être recollée à la main.

   Ce que ça impose AUSSI, et qui ne se voit qu'au rendu : **la DIAGONALE du fond n'est plus
   libre**. Sur une fenêtre HAUTE, une diagonale montante (0 à 90 degrés, ou 270 à 360) place le
   coin chaud DANS la fenêtre, et il ne reste plus un seul endroit sombre où poser un accent :
   mesuré sur un demi-écran haut de 904 px, le fond passe d'une luminance médiane de 0,029 à
   135 degrés à 0,24 sur toute la zone à 340 degrés, et un aplat d'accent posé dessus tombe à
   2,1:1. Les diagonales d'une fenêtre haute se prennent dans la famille « vers le bas »
   (environ 105 à 255 degrés) ; ce qui varie d'un plan à l'autre, c'est OÙ tombe le coin chaud
   dans le bas du cadre, pas sa présence. Le raisonnement se retourne pour une fenêtre BASSE.

   Corollaire de méthode : la diagonale s'indexe sur le NUMÉRO du plan, jamais sur sa position
   dans la liste reçue. Sinon un aperçu qui ne joue que trois plans montre des fonds que le
   montage complet n'aura pas, et c'est justement le fond qu'on fait valider.

   Ce que ça impose ENFIN, et qui a coûté un aller-retour de validation : quand la fenêtre porte
   une RÉSERVE (une bande basse laissée libre pour un bandeau de sous-titres, un logo, un cadre),
   il faut **deux fenêtres emboîtées, pas une**. La réserve est une interdiction de DESSINER, elle
   n'est pas une bande à peindre :
   - la fenêtre VISIBLE (`overflow:hidden` à la hauteur du bandeau entier) porte le FOND, qui court
     donc jusqu'à la couture avec le plan filmé, sans rupture ;
   - la zone de DESSIN est un SECOND `overflow:hidden` intérieur, fermé à `bandeau − réserve`, qui
     contient tout le contenu.

   Fermer la fenêtre unique à `bandeau − réserve` paraît équivalent et ne l'est pas : la réserve
   se retrouve peinte par ce qu'il y a derrière, en général un noir plat, et ça produit **une barre
   pleine largeur entre le motion et la vidéo** (mesuré : 56 px à (0,0,0) sur toute la largeur,
   alors que le fond juste au-dessus est un dégradé grainé). Ça ne lève aucune erreur, et ça se
   lit comme un défaut de montage. Le contrôle qui tranche est une lecture de lignes : la médiane
   par ligne de part et d'autre de la frontière de réserve doit être continue (écart ≤ 1 niveau),
   et le seul saut de la bande doit être la couture elle-même.

   Reste un effet de bord à mesurer, pas à supposer : une fois la barre supprimée, tout objet
   coupé par la frontière INVISIBLE de la zone de dessin devient visible, alors que le noir plat
   le masquait. Compter les images concernées avant de conclure (sur le cas mesuré : une carte
   qui entrait par le bas dépassait de 20 px, sur exactement UNE image de 279, soit 33 ms ; les
   19 autres images n'exposaient que son ombre portée, à 6 niveaux d'écart). Une image se
   rapporte, elle ne justifie pas de retoucher un geste déjà validé.

   Ce que ça impose : le PLANCHER de la hauteur de fenêtre n'est plus une affaire de lisibilité
   mais de respiration. Il se calcule sur l'élément le plus bas de chaque plan, et il exclut les
   valeurs qui font tomber la frontière EN PLEIN MILIEU d'un élément (mesuré sur un lot : à
   0,30 de hauteur, une carte d'éditeur descendait 36 px sous la frontière, soit exactement le
   « presque coupé » que le point 8 interdit). Les deux bornes se rendent et se regardent.

Ce qui NE se transpose pas : la densité. Le tuto travaille pour une VSL de 90 secondes avec une
voix off dense. Sur un reel de 30 secondes, la même densité de gestes devient du bruit. Un accent
par phrase, pas par mot.

---

## 7. Ce qui casse le déterminisme, mesuré sur banc

Le contrat impose que deux rendus de la même compo sortent **identiques au pixel près**. Toutes les
recettes de ce fichier ont été passées à ce banc (compo 1080 x 1920 @ 30 i/s, deux rendus, hachage
des pixels décodés). Résultat :

| Mécanique | Deux rendus identiques |
|---|---|
| `filter: blur()` **animé par `tl.to`** | **NON** |
| `filter: blur()` posé par paliers entiers (`tl.set`) | oui |
| variable CSS animée (`--sweep`) sur un masque | oui |
| `mix-blend-mode: difference` | oui |
| `back.out(n)` sur échelle et rotation | oui |
| `strokeDashoffset` sur un `<path>` | oui |
| `feTurbulence` + `feDisplacementMap`, `scale` animé par `attr` | oui |
| grain `feTurbulence` à graine fixe servi en **data-URI** (image de fond statique) | oui, 5 passes, 1 classe |
| dégradé radial de fond, statique, 5 variantes montrées par coupe | oui, 5 passes, 1 classe |

Le seul coupable est donc le **rayon de flou fractionnaire**. Un `tl.to` sur
`filter: blur(14px) → blur(0px)` traverse des rayons comme 3,72 px, et la rastérisation d'un rayon
fractionnaire varie d'un rendu à l'autre : sur le banc, l'écart reste imperceptible à l'œil
(PSNR 70,6 dB) mais il suffit à faire échouer la gate, et il rend toute comparaison de rendus
inutilisable. La parade est celle du §5.1 : des paliers entiers posés par `tl.set`.

La même prudence vaut pour toute propriété qui se rastérise en niveaux de gris à partir d'une
valeur continue : `box-shadow` à rayon animé, `backdrop-filter`. Les poser par paliers, ou les
figer.

### Le piège du filtre SVG sur une boîte plate

Un filtre SVG se dimensionne **par défaut sur la boîte englobante de l'objet**. Une ligne
horizontale a une boîte de hauteur nulle, donc une région de filtre de hauteur nulle : le trait
**disparaît complètement**, sans erreur, sans avertissement (constaté au banc). Sur tout objet plat,
poser la région en coordonnées de scène :

```html
<filter id="${id}-turb" filterUnits="userSpaceOnUse" x="80" y="1380" width="920" height="240">
```

---

### 7 bis. La 3D et le « remplissage réactif au fond » (mesuré le 2026-08-12)

Deux mécaniques que le §7 ne couvrait pas, criblées sur un lot de sept templates, trois rendus
chacun en `-w 1` :

| Mécanique | Trois rendus identiques |
|---|---|
| `rotationY` + `transform-style: preserve-3d` + `backface-visibility: hidden` | **NON** (3 classes sur 3) |
| `mix-blend-mode: difference` sur du texte, sans opacité animée | oui (1 classe, deux compos) |
| logo SVG à `linearGradient` statique | oui |

Le témoin qui tranche : le panneau JUMEAU du fautif (même kit, même fond, sans 3D) sort 1 classe
dans la même session. Ce n'est donc ni l'environnement ni le multi-workers, c'est la 3D.

**Un retournement de carte se joue en TRANSLATION** : les deux couches existent depuis la
première image, et le DOS (une surface sans texte) remonte hors de la carte, qui le clippe en
`overflow:hidden`. Même lecture, geste déterministe.

**« Le remplissage prend les couleurs du fond »** se traite par `mix-blend-mode: difference` sur
du blanc, et jamais par un remplissage transparent : mesurer d'abord la luminance du plan filmé
derrière le bloc (sur le cas mesuré, médiane 5 à 10 sur 255 : un remplissage transparent y est
invisible, un knockout dans une plaque sombre aussi). Deux conditions pour que la difference
tienne : aucun ancêtre isolant (`opacity` < 1, `filter`, `isolation`) entre le calque et le fond,
donc **bascule en `display` et entrée en TRANSLATION, jamais en opacité** (un blend mode sur un
calque dont l'opacité est animée est une cause connue de bistabilité) ; et un crible, parce que
la règle ne se déduit pas, elle se rend.

### 7 ter. « On ne lit rien », puis « on lit » : le voile en BANDES (mesuré le 2026-08-12)

Un contenu qu'on montre d'abord illisible puis qu'on révèle est une demande fréquente (teaser,
boucle ouverte, mot qui se dévoile sur sa prononciation). **Le flou est le mauvais réflexe** : un
flou animé est interdit par le contrat, et un `filter` STATIQUE isole le contexte d'empilement,
ce qui est exactement la cause de bistabilité du §7. Il n'y a donc rien à flouter.

Ce qui marche, et qui n'a coûté aucun crible rouge :

1. **L'illisible est DESSINÉ, pas dégradé.** Une couche opaque, de la couleur exacte de la
   surface, portant du caviardage : un bâtonnet par mot, aux places exactes du vrai texte. Sa
   silhouette se calcule sans navigateur, à **0,49 em par signe** en français courant sur une
   grotesque (calibré : « phrases courtes » fait 204,9 px à 28 px pour 15 signes, soit 0,488).
   L'objet reste LE MÊME objet (même forme, même place, même couleur), seule sa lisibilité change.
2. **Le voile se retire par BANDES horizontales**, une par ligne de contenu (plus l'en-tête et le
   pied), effacées une par une en `display`, deux images d'écart. Rien à interpoler, et la lecture
   se fait dans l'ordre voulu, ligne après ligne.

**Les deux mises en scène « d'un seul bloc » ont été essayées et rejetées à l'image**, et l'erreur
ne se voit qu'au rendu : un voile qui sort par le HAUT découvre le BAS en premier (donc la lecture
à l'envers, le pied avant le titre) ; le même qui sort par le BAS a le bon ordre mais fait
traverser tout le contenu révélé par son propre caviardage, et on lit deux couches superposées
pendant 0,3 s. La direction d'une translation clippée décide de l'ordre de lecture : la choisir
en regardant, jamais en la déduisant du verbe employé par le plan (« le voile se **lève** » y
demandait un mouvement vers le **bas**).

---

## 8. Ce qui coûte cher au rendu

Par ordre décroissant, sur une compo verticale :

1. un filtre SVG plein cadre (`feTurbulence`, `feDisplacementMap`) ;
2. `filter: blur()` animé sur une grande surface ;
3. `mix-blend-mode` sur une grande surface ;
4. plus d'une centaine de nœuds animés simultanément (un compteur d'une seconde en fait déjà 31,
   un texte de 40 caractères en fait 40) ;
5. `box-shadow` à grand rayon, qui se recalcule à chaque image.

Les contre-mesures, dans l'ordre : réduire la boîte du filtre, pré-calculer le flou en CSS statique
plutôt que l'animer, découper en mots plutôt qu'en caractères.

---

## 9. La gate d'un effet écrit à la main

En plus de la gate du skill (`SKILL.md`, gate de sortie), qui s'applique intégralement :

- [ ] `meta.source` vaut `"écrit à la main"` suivi de l'intention et de la date. Un effet écrit
      sans référence ne se déguise jamais en clone mesuré.
- [ ] chaque `note` de paramètre dit **ce qui casse au-delà**, vérifié aux deux bornes par un rendu
      regardé. Sans référence à mesurer, ces bornes sont la seule preuve que l'effet est piloté.
- [ ] aucun paramètre n'expose la courbe.
- [ ] la première image est complète : rendue seule, elle contient déjà l'état de départ.
- [ ] deux rendus, deux empreintes identiques.
- [ ] `preview.mp4` régénéré et galerie relancée.

## 10. La barre de qualité « annonce produit » (session du 2026-08-10, cinq itérations validées par Yoan)

Le template `demi-haut-annonce-memoire` (banque, v5.3.0) est l'EXEMPLE CANONIQUE : douze plans
qui illustrent un discours parlé, au niveau de `sequence-annonce-produit`, dans la DA. Il a
coûté cinq allers-retours avec Yoan ; ce qui suit est ce que chaque aller-retour a appris,
pour que le prochain effet parte de la v5 et pas de la v1. Lire son `template.mjs` avant
d'écrire un effet de cette famille : les gestes y sont des fonctions réutilisables.

### 10.1 Les deux grammaires, et l'erreur qui coûte une itération

« S'inspirer d'une référence » se spécifie sur DEUX grammaires. La TEMPORELLE (courbes,
coupes, frappe) et la SPATIALE (échelle, vide, lumière). La v1 avait cloné la première et
ignoré la seconde : rendu « cheap » immédiat. Les ratios spatiaux se mesurent comme les
courbes : titre de la référence = 2,4 % de la hauteur du cadre (la v1 était à 13 %), un
objet héros centré dans ~85 % de vide, cartes dimensionnées au CONTENU (jamais bord à bord),
compositions centrées dans la zone visible, jamais ancrées en haut.

### 10.2 Le mouvement qui fait premium (les tables sont dans le template canonique)

Yoan : « ça accélère d'un coup, puis ça freine, puis il y a un truc qui se passe ». Concrètement :

- **Rien ne disparaît sur place.** Tout plan SORT en accélération exponentielle juste avant
  la coupe (table SORTIE : 0 / 0,036 / 0,107 / 0,25 / 0,464 / 1 sur 6-7 images) et la coupe
  l'attrape en plein vol. Exceptions nommées : continuité entre deux plans, dernier plan.
- **Les entrées traversent le cadre** (300 à 700 px de course, table ARRIVEE à longue queue),
  jamais un offset timide de 40 px.
- **Les impacts s'encaissent** : punch d'échelle (surtension 6-14 % amortie en 6 images) pour
  les formes simples, punchY (plongée de 4 à 12 px) pour les surfaces qui portent du texte.
- **La poussée est un saut franc puis une DÉRIVE** (x1,85 puis 1,85 vers 2,18, table DERIVE) :
  l'énergie puis l'amorti, jamais un zoom continu.
- **Les groupes se décalent** (2 à 5 images par élément), y compris à la SORTIE (escalier).
- Entre deux gestes, un plan TIENT, immobile : la respiration temporelle est du style.

### 10.2 bis Montrer un CHOC (quatre mesures du 2026-08-15, reel `coach-ia-moins-humain`)

Un objet qui se cogne à une surface est le geste le plus fragile de cette grammaire : il tient à
quatre images, et chacune des quatre erreurs ci-dessous suffit à faire lire « il s'est arrêté »
au lieu de « il s'est cogné ». Toutes ont été vues à l'image, pas déduites.

- **La surface existe AVANT le mouvement.** Une butée qui apparaît à l'impact (ou pire, après
  l'arrêt) inverse la cause et l'effet : l'oeil voit un objet arrêté, puis une barre qui pope à
  côté de lui. Poser la surface au moins 8 à 10 images avant le départ de l'objet, et faire
  finir son déploiement à l'image EXACTE où l'objet s'ébranle : l'ordre devient lisible sans un
  mot. (§10.3 le dit déjà pour les flux : le trait qui pope ne raconte rien.)
- **L'approche N'A PAS LE DROIT DE FREINER.** ARRIVEE, avec sa longue queue de freinage, POSE
  l'objet contre la surface : il n'y a plus rien à encaisser. Il faut une table de distance
  PARCOURUE qui accélère jusqu'au contact (CHARGE : 0 / 0,02 / 0,06 / 0,12 / 0,20 / 0,30 / 0,42
  / 0,55 / 0,69 / 0,84 / 1), et le rebond qui suit reprend, lui, une table amortie.
- **La progression d'une Bézier n'est PAS sa longueur d'arc.** Un point de contrôle lointain
  (une belle arche) fait partir l'objet d'un coup vers le contrôle puis ramper sur la fin :
  mesuré, à 20 % de la progression l'objet avait fait 60 % du chemin latéral. Un geste « prendre
  de l'élan puis charger » s'écrit donc en DEUX mouvements (un court recul qui décélère, puis
  une descente qui accélère), jamais en un seul arc paramétré.
- **La surface cède, et l'objet SUIT le creux.** L'objet heurté fléchit sur l'axe du coup (une
  échelle amortie, table PUNCH) : son bord se déplace de plusieurs pixels À L'IMAGE DU CONTACT.
  Si l'objet mobile reste sur sa position d'arrivée, un jour s'ouvre entre les deux au moment
  précis où l'oeil cherche le contact. Il faut avancer l'objet de l'enfoncement (mesuré :
  environ 12 px pour un fléchissement de 5,5 % sur une forme de 525 px) et faire partir le
  rebond de là.

Deux corollaires : **un objet qui se rétracte ne traverse jamais ce qu'il protégeait** (choisir
l'origine de transformation du côté où il s'en va, sinon son bord passe à travers les figures en
se résorbant), et **une surface de protection ne survit pas à sa raison d'être** : elle sort dès
que la dernière tentative a renoncé, sinon elle finit en décor.

### 10.3 Le vocabulaire ILLUSTRATIF (Yoan : « des points pour des personnes, c'est pas premium »)

Un effet qui explique un propos MONTRE des choses reconnaissables, dessinées en code comme les
cartes de fichiers de la référence. Le lexique validé, réutilisable depuis le template canonique :

- **Des personnes** : pile d'avatars à initiales qui se chevauchent (+ pastille « +N » pour le
  nombre), ou BUSTE dessiné (tête + épaules) avec un POINT-REGARD dans la tête. Une tête ronde
  qui pivote ne se lit pas ; un point qui se déplace vers chaque objet d'attention se lit
  instantanément. Le prénom témoin est « Yoan » (décision du 2026-08-10), initiale « Y ».
- **Des messages** : bulles à queue (le petit carré tourné à 45°), avec de VRAIS textes courts
  de mise en scène, jamais des barres grises.
- **Des systèmes** : icônes dessinées (bulle de messagerie, pile de disques de base de données)
  dans des modules carte, avec micro-label mono.
- **Des flux** : quand le propos dit « de A vers B », un objet VOYAGE de A vers B (le message
  qui quitte la messagerie, survole le connecteur en arc et se fait absorber par la base qui
  encaisse). Un trait qui pope ne raconte pas un transfert.
- **Des états** : toggle qui s'active (le motif d'interface que tout le monde connaît), badge
  circulaire (« ? », coche posée sur le bord d'un avatar), puce d'horodatage mono
  (« ARCHIVÉ · 12 MARS »), pastille « OBLIGATOIRE ».
- **Des progressions dramatiques** : 1, puis 2, puis 3, puis la CASCADE (six d'un coup, une
  toutes les 3 images) et le personnage décroche (le regard tombe). La courbe du propos
  (surmenage, doute) se joue dans le RYTHME des apparitions, pas dans un texte.
- **La signature de la charte** : la ligne clé d'un plan de révélation se compose en
  Instrument Serif Italic, minuscules, en couleur (l'éclat sur fond sombre), et c'est elle
  qui porte la poussée. Anton reste sur les statements et les chiffres ; Instrument Sans en
  casse phrase porte tout le reste (écart de charte autorisé par Yoan le 2026-08-10).

### 10.4 Les fonds (décision du 2026-08-10 : celui de la référence, aux couleurs de la DA)

La recette est CODÉE dans le template canonique : la première seconde du fond du plan 1 de
`sequence-annonce-produit` (aplat + 4 blobs elliptiques 2·r·largeur x 2·r·hauteur, dégradé
rgba(c,a) vers transparent, positions MESURÉES par image, 30 lignes nettoyées de 2 aberrations),
à l'échelle x3, SANS GRAIN, couleurs dans l'ordre nommé par Yoan : base noir chaud, puis
#C2700B, #FFA31A, #1A1A18, #A39B90. Trois règles de vie :

- **Alternance** : le fond ne BOUGE que sur les plans d'énergie ; les plans de carte reçoivent
  une pose FIGÉE de la table, différente par plan. La référence alterne, on alterne.
- **Tempo unique** : la table se parcourt en 5 s quelle que soit la durée du plan (aller-retour
  sans à-coup si plus long). Jamais étirée sur la durée du plan : c'est ce qui rend un fond
  arbitrairement rapide sur un plan court.
- **Intensité tempérée** : les alphas de la référence font un fond CLAIR (sa nature) ; sur la
  scène sombre de la DA ils noient le contenu (rendu et regardé : cadre entier ambre, compteur
  orange illisible). Multiplicateurs validés : 0,62 / 0,5 / 1,0 / 0,34. Le miroir horizontal
  sur les plans pairs fait changer la coupe de côté de lumière.

### 10.5 Ce que cette famille d'effets a appris sur le déterminisme

Complète le §7, dans l'ordre où ça a mordu :

- **L'OUTILLAGE D'ABORD** : le rendu multi-workers de hyperframes 0.7.55 n'est PAS reproductible
  bit à bit sur cette machine. Contrôle du 2026-08-10 : `sequence-annonce-produit`, validée
  « 4 rendus, 1 empreinte » le 2026-08-05, sort 3 classes sur 4 rendus en multi-workers, et
  1 seule en `-w 1`. TOUT crible de déterminisme et tout rendu de preview se font en
  `render -q high -w 1`. Avant d'accuser un template, re-cribler un template DÉJÀ VALIDÉ dans
  le même environnement : si le témoin diverge aussi, c'est l'environnement.
- Jamais de BASCULE DE CONTENU pendant une transformation animée (un chiffre qui change pendant
  un pop re-rasterise la texture en course).
- Les compteurs à valeurs empilées basculent en `display`, jamais en opacité : un seul glyphe
  existe pour le peintre à chaque image.
- L'échelle animée est réservée aux nœuds SIMPLES (un texte d'un seul tenant, un disque, un
  trait) ; les surfaces qui portent des piles de spans (cartes, compteurs) bougent en
  TRANSLATION (entrées freinées, plongées d'impact).
- Aucun `will-change` hors du calque de plan (bascule d'opacité aux coupes).

### 10.6 La gate visuelle de cette famille

En plus de la gate du §9 : chaque plan se rend et se REGARDE image par image aux instants clés
(arrivée du héros, impact, sortie, coupe), parce que les défauts de cette famille (texte qui
déborde d'une puce, ombre tranchée par une réserve, élément encore visible après sa sortie,
fond qui noie le contenu) ne lèvent aucune erreur et ne se voient qu'à l'image.

## 11. Un relais de cartons : l'entrant arrive quand le sortant a FINI

Mesuré à l'image le 2026-08-17, sur un hook dont trois cartons de titre se chassent dans la même
bande. Faire sortir un carton « en rouleau » à t et arriver le suivant « d'un coup sec » au MÊME t
donne **sept images de deux blocs de titre superposés au même pixel**, et le titre y est
littéralement illisible. La table de sortie est exponentielle : à la deuxième image le sortant n'a
parcouru que 10 px. Comme les deux blocs partagent la même origine par construction (c'est ce qui
fait qu'ils s'alignent), il n'existe pas de « croisement lisible ».

La règle : **l'arrivée de l'entrant ne peut pas précéder la FIN du geste de sortie du sortant**,
et c'est une garde de template, pas une discipline d'écriture du plan. Elle propose les DEUX
corrections chiffrées (avancer la sortie de la durée du geste, ou retarder l'arrivée d'autant) :
laquelle est la bonne dépend de ce que la VOIX dit à cet instant, et ce n'est pas au template d'en
décider.

Conséquence de chaîne à ne pas oublier : déplacer l'arrivée d'un carton déplace l'ACTION VISIBLE,
donc le son qui la marque doit se déplacer avec elle. Un son laissé en place retombe sur le geste
de caméra d'à côté, ce qui est précisément interdit (un SFX se pose sur une action visible, jamais
sur un mouvement de cadre).
