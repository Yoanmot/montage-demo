# Hook chiffre

Carte verrouillée : r20-01g (Style Lab v2). Calque tiré du build du tour 20.

## Ce qu'il montre
« 120 g » en chiffre géant, puis « de protéines », puis le pavé orange, chacun avec l'apparition v2.

## Quand l'utiliser
Hook qui tient sur un chiffre (nutrition, résultat).

## Paramètres
Textes dans le HTML (`textes` d'instancier.mjs) : `#h1n` le chiffre, `#h1u` l'unité (vide s'il n'y en a pas), `#h2` la suite,
`#h3t` le pavé orange. `#h1` (chiffre + unité) s'anime d'un bloc mais ne se remplit pas d'un bloc. Instants `T`. Sans voix
sur le plan, les éléments se suivent à l'écart de la ref (APPARITION.ecartRef 0,17 s).
- `devant/index.html` : durée 1.8666666666666667 s ; 3 instants dans l'objet `T` en tête du script.

## Constantes de `commun.mjs`
HOOKS.chiffre (chiffre 330, suite 60, chiffreXY [86, 250], suiteXY [96, 540], paveXY [91, 625]), APPARITION, VOILE.cuisine.

## Son associé
`arrivee-tick.wav` sur le chiffre (image où il passe 50 %), 8 LU sous la voix. Fichiers dans `../sons/` (licence : `../sons/LICENCE.md`).

## Composition
- `devant/` : calque transparent DEVANT Romain.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/hook-chiffre-devant.mov
```

## Aperçu
- `apercu.mp4` : aperçu muet 540 x 960 de la carte r20-01g, refait le 2026-11-14 sur la rush de test (police unique Inter Black), instants par défaut du gabarit.
