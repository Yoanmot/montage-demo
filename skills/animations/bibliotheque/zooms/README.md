# Zooms

Cartes verrouillées : r15-01a (zoom éclair 115 %) et r15-01c (rapprochement court 110 %), tour 15 de la v1, remis tels
quels en v2 (r21-L, r22-L21 et L22). Pas de calque HyperFrames : le zoom se calcule sur l'image, avant les calques.

## Ce qu'il montre
- **Zoom éclair** : 115 % en 0,13 s, power2.out, avec un léger flou de mouvement, sur le mot fort ; tenu jusqu'à la
  coupe, qui revient au plan large.
- **Rapprochement court** : 110 % en 1 s, power2.inOut (départ et arrivée freinés), puis coupe au plan large.
Les deux centrés entre ses yeux.

## Quand l'utiliser
Éclair : sur un mot qui claque. Rapprochement : pendant une phrase qui monte vers une idée. Jamais linéaire, jamais au-delà
de 115 % sur une rush 1080p (125 % rejeté), jamais un punch-in directement serré sur la coupe (rejeté), jamais de son.

## Paramètres
`zoom.py <eclair|rapprochement> <entree.mp4> <sortie.mov> <t_depart_s> <ancre_x> <ancre_y>` : début du geste (attaque du
mot) et point fixe (entre les yeux, en px du 1080 x 1920). L'entrée est le plan déjà étalonné.

## Constantes
Amplitudes, durées et courbes ci-dessus (STYLE.md, « Zooms »). `VIDEO` (1080 x 1920, 30 i/s) de `commun.mjs`.

## Son associé
Aucun.

## Rendu
```
python3 zoom.py eclair plan.mp4 ../_rendus/plan-zoom.mov 3.05 445 725
```
(exemple de l'aperçu : plan A ancré en x 445, y 725.) Avec une rush 4K d'origine, recadrer depuis la 4K plutôt que
d'agrandir le 1080p : sans perte jusqu'à environ 1,8x.

## Aperçus
- `apercu-eclair.mp4` (r15-01a), `apercu-rapprochement.mp4` (r15-01c) : aperçus muets 540 x 960 rendus dans le labo v1.
