# champ-saisie (gabarit 1)

Champ en verre sombre (705x200, rayon 18, filet crème 1,5 px, sans ombre) posé sur la caméra à hauteur de poitrine.
Il entre net depuis un flou (5 images), se tape caractère par caractère, ses lignes se raturent en doré (trait 3 px
tracé en 0,1 s), puis il s'écrase en une ligne en 4 images (0,13 s) et la ligne se rétracte.

`champSaisie(p, { x, y, w, h, entree, lignes: [...], frappe: { debut, cps }, ratures: [{ ligne, t }], ecrasement: { t, vers: 'ligne'|'rien' }, placeholder, libelle })`

Usage : lister ce qui ne va pas, poser une consigne. Son : le tic r6-02b sur l'écrasement, jamais sur la frappe.
Exemple : carte r10-02a.
