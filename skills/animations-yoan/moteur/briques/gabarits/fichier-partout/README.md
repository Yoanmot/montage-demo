# fichier-partout (tour 12, r12-01)

« Garde précieusement ce fichier, c'est le même que tu mets partout. » Le fichier est le document en verre doré du héros
(`fichier-heros`, état final : filet doré et halo, étiquettes et onde dorées, pastilles des sources, logos des IA dans
l'en-tête), dessiné par `docHtml()` (même dessin, épaississement du filet et du halo aux petites échelles). Autour, un
anneau de tuiles avec les vrais logos (`commun.MARQUES`, ../../logos/) : grises au départ (logo crème atténué), elles
s'allument dans leur couleur de marque (tuile teintée à 30 %, filet de la couleur, impulsion 0,45 s, nom qui s'éclaire)
quand le fichier les atteint. Aucune fausse capture, aucune interface de marque.

`fichierPartout(p, { mode: 'copies'|'cle'|'coffre', centre: { x, y }, k, tuiles: [{ logo, x, y, t }], taille, tFichier, tPrecieux,
copies: [t] | visites: [t] + retour | dossier: { t, range, y, sortie } + sortie + fils, legende: { texte, t, y }, cadre })`

- `copies` (r12-01a) : l'original reste au centre (halo doré qui respire, crochets, reflet) ; une copie s'en détache et
  glisse dans chaque tuile (0,34 s, power3.in, flou de vitesse), l'une après l'autre ; la tuile s'allume à l'arrivée.
- `cle` (r12-01b) : un seul fichier passe d'un outil à l'autre (0,26 s, power2.inOut), se pose devant (à 150 px du centre
  de la tuile, côté intérieur), l'outil s'ouvre (couleur + coche dorée au coin extérieur) ; les crochets embrassent la
  paire tuile + fichier et glissent avec lui ; retour au centre à la fin.
- `coffre` (r12-01c) : dossier en verre (dos + onglet, face avant « GARDE-LE ») ; le fichier s'y range, le dossier se dore
  sur « précieusement » ; il ressort au centre, le dossier s'efface, des fils dorés (tracés en 0,35 s) le relient à toutes
  les tuiles, qui s'allument ensemble.

Mise en page des exemples : plein écran, fichier k 0,36 au centre (540, 1010), 6 tuiles de 150 px sur un cercle de 365 px,
croix « + » aux coins du cadre x 120 à 960, y 545 à 1505, légende en JetBrains Mono à y 1560. Son : un tic sur
« précieusement », un quand tout est allumé. Renvoie `allume` (instants où chaque tuile s'allume). Exemples : r12-01a à c.
