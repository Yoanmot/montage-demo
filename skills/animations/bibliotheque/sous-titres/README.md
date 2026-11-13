# Sous-titres

Cartes verrouillées : r21-01a (classique, pavé qui glisse), r19-01b (formelle), r22-01a (mot fort qui part avec la
phrase). Un seul gabarit paramétré couvre les trois : `devant/index.html` construit les groupes et la timeline depuis
`P` (logique reprise des builds des tours 19, 21 et 22).

## Ce qu'il montre
- **Classique** : Bricolage Grotesque 800 minuscules 66 px, craie, ombre dure, une ligne centrée à y 1430. Mots resserrés
  (18 px entre les lettres de deux mots). Le mot en cours est sur un pavé orange arrondi 10 px posé sur une marche braise
  de 4 px, texte charbon ; le pavé GLISSE d'un mot à l'autre en 0,12 s power2.inOut (moins si les mots se suivent de
  trop près) ; les deux mots changent de couleur à mi-glissé ; le pavé arrive sur le mot une image avant son attaque.
- **Formelle** : même police et position, sans pavé, 3 mots au plus par groupe, le groupe apparaît d'un coup à l'image
  de l'attaque de son premier mot.
- **Mot fort** (formelle) : le groupe qui porte l'idée passe en Big Shoulders 900 capitales 128 px au-dessus de la ligne
  restée affichée (22 px entre le bas de ses capitales et le haut des minuscules), avec l'apparition v2 démarrée 0,04 s
  avant son mot ; il disparaît à la même image que la ligne de fin de phrase, à la fin du dernier mot de la phrase.

## Quand l'utiliser
Classique : vidéos simples, organiques. Formelle : vidéos plus qualis. Mot fort : un mot par idée forte, pas plus d'un
toutes les quelques phrases.

## Paramètres (objet `P` en tête de `devant/index.html`)
- `style` : `classique` | `formelle`.
- `mots` : `[{ w, s, e }]`, texte tel que dit et instants de début et fin en secondes (transcription calée sur la voix).
  Le texte affiché est en minuscules, ponctuation de fin retirée.
- `groupes` : indice de fin (exclu) de chaque groupe.
- `motFort` : `null` ou `{ groupe, finPhrase }` (formelle seulement).
- `images` : durée du calque en images ; garder `data-duration` de `#root` = `images / 30`.
Les trois réglages verrouillés sont écrits en commentaire au-dessus de `P`.

## Constantes de `commun.mjs`
SOUS_TITRES (taille 66, centreY 1430, x 91 à 990, interligne 1,12, pave { padX 14, padBas 4, rayon 10, marche 4 },
motFort 128), SOUS_TITRES_ECART.tresSerre (-0,14 em), SOUS_TITRES_GLISSE (0,12 s power2.inOut), SOUS_TITRES_TEMPS
(avancePave 1/30), MOT_FORT (taille 128, écart 22), APPARITION, COULEURS, MARCHE.sousTitre, OMBRES.texteDure.
Le gabarit recopie ces valeurs en tête de son script (un HTML de rendu ne peut pas importer le module) : si une
constante change dans `commun.mjs`, la changer ici aussi.

## Son associé
Aucun. Jamais de son sur les sous-titres.

## Composition
- `devant/` : calque transparent DEVANT Romain. Rien sous y 1479 (le pavé et sa marche finissent au-dessus).

## Rendu
```
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/sous-titres-devant.mov
```

## Aperçus
- `apercu-classique.mp4` (r21-01a), `apercu-formelle.mp4` (r19-01b), `apercu-mot-fort.mp4` (r22-01a) : aperçus muets
  540 x 960 rendus dans le labo, sur l'extrait « mais faire des abdos ne suffit pas à enlever la graisse qui les recouvre ».
