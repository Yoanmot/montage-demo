# Apparition du texte : analyse de `ref-apparition-texte.mov` (ref de Yoan, 2026-11-10)

Fichier : 1180 x 1582, 60 i/s, 1,62 s, 97 images. Contenu animé à environ 24 i/s (images
doublées ou triplées). Texte bleu sur fond clair : « COMMENT » « THE WORD » (petit, ~70 px de
haut), « Claude » (gros, ~347 px de haut), « BELOW » (petit). Images 1-2 : écran précédent.

Méthode : pour chaque mot, image par image, ajustement de la forme finale floutée (sigma),
décalée verticalement (dy) et atténuée (alpha) sur l'image mesurée, faite dans le Style Lab (la vidéo de
référence reste dans le labo). La recette ci-dessous est celle de `APPARITION` dans `commun.mjs`.

## Ce que fait chaque mot

Chaque élément entre seul, sur son propre départ, avec trois choses en même temps :
1. **Opacité** de 0 à 1.
2. **Montée** depuis un peu plus bas que sa place (il monte vers sa place, jamais il ne descend).
3. **Flou** qui se dissipe, plus lentement que les deux autres (traîne de netteté).

Mesures (t = 0 à la première image où le mot est visible) :

| mot | départ | dy à t=0 | opacité 0,5 atteinte | dy ~0 | net |
|---|---|---|---|---|---|
| COMMENT (70 px) | 0,00 s | +12 px (17 % de sa hauteur) | ~0,10 s | ~0,58 s | ~0,22 s |
| THE WORD (70 px) | +0,17 s | +22 px (30 %) | ~0,08 s | ~0,5 s | ~0,25 s |
| Claude (347 px) | +0,58 s | +36 px (≥ 10 %, ~13 % au vrai départ) | 0,08 s | 0,42 s | 0,83 s (flou 16 → 0) |
| BELOW (70 px) | +1,25 s | +8 px (11 %) | 0,07 s | 0,13 s | 0,25 s |

Détail du gros mot (le plus propre à mesurer) :
- dy : 36, 28, 22, 16, 12, 8, 6, 4, 2, 0 px à 0 / 0,05 / 0,08 / 0,13 / 0,17 / 0,22 / 0,25 /
  0,30 / 0,33 / 0,42 s.
- opacité : 0,18 / 0,37 / 0,53 / 0,66 / 0,75 / 0,82 / 0,86 / 0,91 / 0,95 / 0,99 aux mêmes instants
  (dernier à 0,42 s).
- flou (sigma en px) : 16 → 13 (0,08 s) → 10 (0,17 s) → 8 (0,25 s) → 6 (0,33 à 0,42 s) → 4 →
  3 → 2 → 1 → 0 (0,83 s).

## Recette à reproduire (en px de la vidéo 1080, h = hauteur des capitales de l'élément)

- **Montée** : départ à `+0,13 h` sous sa place (au moins 10 px), courbe `power3.out`, 0,55 s
  pour un gros mot, 0,35 s pour un texte de taille sous-titre.
- **Opacité** : 0 → 1, `power2.out`, 0,45 s (gros mot), 0,30 s (petit texte).
- **Flou** : départ à `0,05 h` (au moins 8 px), jusqu'à 0, `power2.out`, 0,85 s (gros mot),
  0,30 s (petit texte). Le flou finit après la montée : c'est la traîne qui donne l'effet.
- **Cascade** : un élément = un mot ou un groupe de mots dit d'un trait. Chacun démarre sur sa
  propre attaque dans la voix (dans la ref : 0,17 s entre deux mots d'une même ligne, puis le
  gros mot et la fin de phrase sur leur moment). Jamais tout le bloc d'un coup.
- Pas de rebond, pas de dépassement, pas d'échelle.
- Le tick d'arrivée (v1, r13-02c) se cale sur l'image où l'opacité passe 0,5.
