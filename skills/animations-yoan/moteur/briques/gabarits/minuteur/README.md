# minuteur (tour 11, r11-03)

Au mot qui donne la durée, un minuteur doré MM:SS:CC (minutes, secondes, centièmes) qui défile en temps réel, présenté
comme le CTA verrouillé : Satoshi Black 126 px doré avec halo, quatre « + » crème à 30 px des côtés de l'encre et 24 px du
haut et du bas, grosses lignes de 3 px tirées à travers le cadre 0,25 s après l'entrée (tenue 0,7 s, effacement 0,45 s),
quadrillage de 60 px seulement sur fond uni. Puis il se réduit (0,45 s, power2.inOut, échelle 0,34) vers un coin haut
gauche en continuant de défiler. Colonnes de largeur fixe : 10 chiffres superposés par position, seul le courant visible.

`minuteur(p, { cx, cy, taille, depart, entree, debut, fin, etiquette: { texte, t }, quadrillage, reduction: { t, d, x, y, echelle }, sortie })`

Placement : sur fond uni au centre (cy 900) ; sur la caméra au-dessus de la tête comme le CTA (cy 548), ou sur le torse quand le haut est pris par les sous-titres (cy 1240, retours de Yoan du 2026-10-23 : les lignes verticales partent alors 300 px au-dessus des « + »). Coin réduit :
x 112, y 452 (sous les sous-titres). Son : le son d'apparition du CTA (r6-02b) à l'entrée, 11 dB plus bas aux lignes, un
tic à la réduction. Exemples : r11-03a, r11-03b.
