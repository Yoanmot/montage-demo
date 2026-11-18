# objet-tournant (2026-10-23, sur la caméra)

Un cube 3D qui tourne sur lui-même, posé là où pointe un geste de la main (au hook de la démo : le doigt levé, « une
animation au-dessus genre un cube un peu mystère qui tourne »). Rotation continue linéaire (un tour en 2,6 s), inclinaison
fixe de -16 degrés (on voit le dessus), flottement vertical lent (6 px, 1,8 s), ombrage de chaque face recalculé à chaque
image (lumière en haut à gauche), halo doré doux derrière, grain qui vibre sur les faces. Entrée des objets du style
(fondu depuis un flou 12 px en 0,17 s, départ à 86 %, sans rebond), sortie courte vers un flou.

`objetTournant(p, { cx, cy, taille: 130, image?, entree, sortie?, tour: 2.6, inclinaison: -16, flottement: 6, fin })`

- `image` : texture des six faces (image carrée), copiée dans le calque. Sans image : face du style (verre sombre, filet
  doré avec halo, « ? » doré en Satoshi Black), utilisable telle quelle dans un reel client.
- Le gabarit n'embarque aucune image : une image de marque n'entre que par les paramètres d'un reel. La démo utilise le bloc
  « ? » de Mario (`executeur/test/medias/`, usage personnel, ne pas livrer aux clients).
- Placement : au-dessus du bout du doigt, sans toucher le titre du hook (bas de la 2e ligne vers y 515) ni sortir de la
  zone sûre (x 990 au plus au-dessus de y 997). Cadre du hook `large` (zoom 1,15) pour lui laisser la place.
- Son : `pop` à l'entrée (objet qui arrive, `style.json` son.effets).
