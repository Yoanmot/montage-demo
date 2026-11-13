# CTA mot derrière lui

Carte verrouillée : r20-01h (Style Lab v2). Calques tirés du build du tour 20.

## Ce qu'il montre
ABDOS géant monte à sa place derrière sa tête avec l'apparition v2 ; devant, « commente ABDOS » en sous-titre classique.

## Quand l'utiliser
CTA « commente MOT » quand le plan laisse de la place au-dessus de sa tête.

## Paramètres
Le mot (couche derrière) et le sous-titre (couche devant), instants `T`. Le mot arrive 3 images après « commente » (CTA_TEMPS.motApres).
- `derriere/index.html` : durée 3 s ; 1 instants dans l'objet `T` en tête du script.
- `devant/index.html` : durée 3 s ; 2 instants dans l'objet `T` en tête du script : `t01` la ligne apparaît (sans pavé), `t02` le pavé orange se pose sur le mot **une image avant son attaque** (`SOUS_TITRES_TEMPS.avancePave`, comme les sous-titres classiques ; jamais dès l'apparition de la ligne). À l'instanciation : `"t02": { "pave": "<le mot>" }`.

## Constantes de `commun.mjs`
CTA.motDerriere (top 270), CTA_TEMPS, APPARITION, VOILE.standard, SOUS_TITRES.

## Son associé
`arrivee-tick.wav` quand ABDOS passe 50 % d'opacité, 8 LU sous la voix. Fichiers dans `../sons/` (licence : `../sons/LICENCE.md`).

## Composition
- `derriere/` : calque transparent DERRIÈRE Romain.
- `devant/` : calque transparent DEVANT Romain.
Couche `derriere/` trouée par son masque, couche `devant/` par-dessus.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd derriere && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/cta-mot-derriere-derriere.mov
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/cta-mot-derriere-devant.mov
```

## Aperçu
- `apercu.mp4` : aperçu muet 540 x 960 de la carte r20-01h, rendu dans le labo.
