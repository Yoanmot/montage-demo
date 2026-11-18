# regle-pin (gabarit 2)

Règle pleine largeur (trait crème, graduations fines, longue toutes les 5) qui se tire depuis le centre en 0,3 s ;
repères en étiquettes dessous ; un pin doré (tige 3 px + anneau) descend en 0,2 s, glisse d'arrêt en arrêt
(power2.inOut) avec sa valeur au-dessus ; une ellipse dorée se trace autour de sa base en 0,2 s.

`reglePin(p, { y, x0, x1, pas, majeur, reperes: [{ x, texte }], etiquettes, entree, sortie, pin: { t, arrets: [{ t, x, texte, d }] }, ellipse: { t } })`

Usage : « à quel moment », une progression, une valeur qui monte. Repères dans la zone sûre (x 91 à 899, au-dessus de
y 1479 à gauche de x 366). Son : tic sur la descente du pin et sur l'ellipse. Exemple : r10-02b.
