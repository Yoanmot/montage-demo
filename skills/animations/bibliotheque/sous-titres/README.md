# Sous-titres

Les sous-titres choisis par Romain le 29/10 et utilisés par son skill jusqu'au 2026-11-13 (`captions_romain.py` du
serveur de montage, fonctions `groups()` et `sous_titres()`, rendus en ASS), refaits en calque HyperFrames le
2026-11-13 après son retour sur le style du Style Lab (« trop de différences de taille », police pas aimée). Les styles
classique, formelle et mot fort du Style Lab n'existent plus.

## Ce qu'il montre
- **Police** : un seul réglage, `POLICES.sousTitres` de `commun.mjs` (Inter Black tant que Romain n'en a pas choisi une
  autre), blanc pur #FFFFFF, **71 px** en 1080 (0,066 x la largeur x le réglage `taille`), lettres resserrées de 5 % de
  la taille (pas les espaces), casse de la transcription, ponctuation de fin retirée.
- **Ombre douce** : copie noire du texte sous lui, bordure 4 px, flou équivalent au `\blur9` de libass (écart-type
  2,7 px), opacités 0,655 (texte) et 0,404 (bordure), sans décalage.
- **Ligne** : milieu des capitales à **0,70** de la hauteur (réglage `position`), centrée, une ligne par groupe.
- **Groupes** : 1 à 4 mots, 20 caractères au plus (divisé par `taille`), 0,84 x la largeur au plus ; une phrase
  (fin de phrase ou blanc de plus de 0,15 s) n'est jamais à cheval sur deux groupes ; trop longue, elle se coupe en
  groupes équilibrés (le plus large le moins large possible). Algorithme repris tel quel (vérifié identique à
  `groups()` sur les 79 groupes de la rush de test).
- **Temps** : un groupe apparaît à l'attaque de son premier mot. Suivi d'un blanc de moins de 0,5 s, il part au début du
  suivant ; sinon il reste 0,25 s après son dernier mot et part en fondu de 0,11 s. Le premier groupe après un blanc de
  0,5 s (et le premier de la vidéo) monte de 14 px en fondu de 0,15 s.
- **Pavé orange** #F15A24 arrondi (rayon 0,18 x la taille) sous le mot dit, texte blanc par-dessus, ombre dessous : du
  haut des capitales - 0,11 - 0,03 x la taille, haut de capitales + 0,38 x la taille, marges 0,17 x la taille de chaque
  côté. Sur le premier mot dès l'apparition, puis il **glisse** d'un mot au suivant à l'attaque du mot, en 0,12 s,
  bords gauche et droit à vitesse constante.
- Calques qui effacent les sous-titres (`masque_sous_titres`) : groupe retiré, ou coupé net à l'image d'entrée du
  calque (règle de Yoan du 2026-11-11, inchangée).

## Où vit le style
Le CSS et le JS des sous-titres sont écrits une fois, par `blocSousTitres()` de `scripts/lib/style.mjs` (depuis
`SOUS_TITRES` et `POLICES.sousTitres` de `commun.mjs`), et posés entre les marqueurs `SOUS-TITRES:debut` /
`SOUS-TITRES:fin` de ce gabarit et des gabarits qui portent leur propre ligne (`cta-mot-derriere`,
`cta-champ-instagram`, `tier-list`). Changer une valeur ou la police dans `commun.mjs`, puis
`node scripts/maj-sous-titres.mjs` (skill animations) pour la bibliothèque ; les calques d'une vidéo se refont avec
`sous-titres preparer` et `instancier.mjs`.

## Paramètres (objet `P` en tête de `devant/index.html`, écrit par `sous-titres.mjs preparer`)
- `groupes` : `[{ mots: [{ w, s }], t0, t1, monte, sortie }]` (texte affiché, attaques en secondes du calque).
- `caches`, `coupes` : groupes retirés ou coupés net sous un calque qui efface les sous-titres.
- `images` : durée du calque en images ; garder `data-duration` de `#root` = `images / 30`.

## Son associé
Aucun. Jamais de son sur les sous-titres.

## Composition
- `devant/` : calque transparent DEVANT Romain. À la position 0,70, le pavé va de y 1308 à y 1387 (zone sûre jusqu'à
  y 1479).

## Rendu
```
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/sous-titres-devant.mov
```
(le gabarit cite `../../fonts/` et `../../vendor/` : le lint HyperFrames le signale, normal pour un gabarit ; le calque
d'une vidéo a ses chemins dans son dossier.)

## Aperçu
- `apercu.mp4` : aperçu muet 540 x 960, sur les premières secondes de la rush de test (2026-11-13).
