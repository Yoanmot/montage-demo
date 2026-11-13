# Anatomie

Carte verrouillée : r21-03d (Style Lab v2). Calque tiré du build du tour 21.

## Ce qu'il montre
Silhouettes face et dos sur charbon ; le muscle dont il parle s'allume en orange sur son mot (0,20 s power2.out) et s'éteint quand il passe au suivant (0,25 s sine.inOut).

## Quand l'utiliser
Il nomme un muscle ou une zone.

## Paramètres
Muscles allumés et instants `T` dans le HTML (les tracés viennent de react-body-highlighter, licence MIT jointe).
- `devant/index.html` : durée 5.6 s ; 6 instants dans l'objet `T` en tête du script.

## Constantes de `commun.mjs`
ANATOMIE (gris #3A3734, echelle 4,2, haut 540, centres [302, 778], allume 0,20 power2.out, eteint 0,25 sine.inOut), FONDS.charbon.

## Son associé
Aucun.

## Composition
- `devant/` : calque transparent DEVANT Romain.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/anatomie-devant.mov
```

## Aperçu
- `apercu.mp4` : aperçu muet 540 x 960 de la carte r21-03d, rendu dans le labo.
