# demi-ecran (gabarit 4)

Le fond r4-01c descend du haut en 0,15 s (power2.out) et pousse le visage de 560 px vers le bas dès qu'il l'atteint ;
frontière en fondu doux de 260 px (jamais un filet dur) ; sortie sèche : tout remonte en 2 images (0,07 s, linéaire).
Le contenu (un panneau, une comparaison...) se pose au-dessus et remonte avec le fond.

`demiEcran(p, { t0, t1, contenu: { css, html, js } })`, constantes `DEMI = { ty: 560, H: 1080, fondu: 260, dE: 0.15, dS: 0.07 }`.

La caméra se fabrique à part avec la même loi (`../r10-anim/camera10.py`, type `split`) : décalage du visage =
clamp(V(t) + 560, 0, 560), V = position du fond. Contenu entre y 452 (sous les sous-titres) et y 1000.
Son : un tic à la descente du fond. Exemples : r10-03a, r10-03b.

Tour 11 : `demiEcran(p, { t0, t1, courbe, contenu })`, `courbe` dans `COURBES` (actuelle, banque, power3, expo ; défaut
`banque` = courbe mesurée de l'effet half-anim-apparition de l'ancienne banque, table dans `style/style.json`, `demiEcran.courbes`). Le contenu
descend avec le fond. Caméra : `../../r11-anim/camera11.py`. Exemples : r11-01a à d.
