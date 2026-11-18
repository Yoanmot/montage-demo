# appariement (geste des animations 14 et 17)

Deux tuiles d'icône éloignées ; celle de droite peut changer d'icône toutes les 0,25 à 0,3 s ; puis elles glissent
l'une vers l'autre (power3.in, 0,32 s) avec un flou de mouvement horizontal (filtre SVG jusqu'à 26 px, retombe en
2 images au contact) ; quatre « + » dorés se posent autour de la paire ; une légende dessous.

`appariement(p, { cy, taille, ecart, gauche: { icone, etiquette, t }, droite: { icones: [{ icone, t }], etiquettes: [{ texte, t }], t }, contact: { t, d, jeu }, plus: { t }, legende: { texte, t }, etiquettes, sortie })`

Usage : relier, brancher, « ça marche avec tout ». Étiquette de droite courte (centre à x 800 : 8 caractères au plus
pour rester sous x 899). Son : un tic au contact. Exemple : r10-04c.

Tour 11 : `couleur: 'creme'|'marque'|'teinte'`, icônes `{ logo: 'claude', t }` (commun.MARQUES, logos dans ../../logos/),
`capture: { t, x, y, w, h, titre }` (vignette bleue stylisée). Exemples : r11-04a à c.
