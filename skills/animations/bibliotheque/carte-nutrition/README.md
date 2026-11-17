# Nutrition, le bilan

Carte verrouillée : r21-02g (Style Lab v2). Calque tiré du build du tour 21.

## Ce qu'il montre
Carte à onglet : les trois plats (vignettes) puis ses deux totaux (120 g de protéines, 14 min), un élément à la fois sur sa voix.

## Quand l'utiliser
Bilan d'un batch cooking ou d'une journée de repas. Les chiffres sont les siens, jamais estimés.

## Paramètres
Vignettes (« image à fournir »), légendes et totaux dans le HTML, instants `T`. Totaux : `#t1n` / `#t1u` / `#t1l` (chiffre,
unité, légende) et `#t2n` / `#t2u`, remplis un par un (`#t1` et `#t2` s'animent d'un bloc).
- `devant/index.html` : durée 3.5 s ; 6 instants dans l'objet `T` en tête du script.
- Images : remplacées par l'emplacement `../../images/image-a-fournir.svg`. À fournir (attribut `data-a-fournir` de chaque `<img>`) :
  - photo du plat 1 (poulet), photo de Romain
  - photo du plat 2 (patate douce), photo de Romain
  - photo du plat 3 (ratatouille), photo de Romain

## Constantes de `commun.mjs`
CARTE (fond charbon, rayon 18, ombre, ligne en cours craie texte charbon, lignes passées 38 %), ONGLET (hauteur 64, capitales 46 px, fond orange, texte charbon, rayon 10), LIGNE_CARTE, APPARITION, NUTRITION (x 91, y 1008, w 820, pad 26, gap 14, legende 34, total 73, totalSuite 34).

## Son associé
Aucun.

## Composition
- `devant/` : calque transparent DEVANT Romain.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/carte-nutrition-devant.mov
```

## Aperçu
- `apercu.mp4` : aperçu muet 540 x 960 de la carte r21-02g, refait le 2026-11-14 sur la rush de test (police unique Inter Black), instants par défaut du gabarit.
