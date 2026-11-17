# CTA mot derrière lui

Carte verrouillée : r20-01h (Style Lab v2). Calques tirés du build du tour 20.

## Ce qu'il montre
ABDOS géant monte à sa place derrière sa tête avec l'apparition v2 (encre sur la zone sûre : `mesure.py geant <MOT>`) ; devant, « commente ABDOS » en ligne de sous-titre, au style des sous-titres (Inter Black 71 px, pavé orange qui glisse de « commente » au mot).

## Quand l'utiliser
CTA « commente MOT » quand le plan laisse de la place au-dessus de sa tête.

## Paramètres
Le mot (couche derrière) et le sous-titre (couche devant), instants `T`. Le mot arrive 3 images après « commente » (CTA_TEMPS.motApres).
- `derriere/index.html` : durée 3 s ; 1 instants dans l'objet `T` en tête du script.
- `devant/index.html` : durée 3 s ; 2 instants dans l'objet `T` en tête du script : `t01` la ligne apparaît (pavé sur « commente »), `t02` le pavé **glisse sur le mot à son attaque** en 0,12 s (`SOUS_TITRES_TEMPS.avancePave` 0, comme les sous-titres ; jamais sur le mot dès l'apparition de la ligne). À l'instanciation : `"t02": { "pave": "<le mot>" }`.

## Constantes de `commun.mjs`
CTA.motDerriere (top 247 : haut des capitales à y 272), CTA_TEMPS, APPARITION, VOILE.standard, SOUS_TITRES.

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
- `apercu.mp4` : aperçu muet 540 x 960 de la carte r20-01h, refait le 2026-11-14 sur la rush de test (police unique Inter Black), instants par défaut du gabarit.
