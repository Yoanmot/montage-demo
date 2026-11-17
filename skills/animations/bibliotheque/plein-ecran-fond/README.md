# Plein écran, fond au choix

Cartes verrouillées : r21-01c, r21-01d, r21-01e, r21-01f (Style Lab v2). Calque tiré du build du tour 21.

## Ce qu'il montre
Sa phrase sur 2 lignes de même largeur d'encre (la ligne courte est agrandie, la longue réduite, encre x 94 à 987), bloc centré à y 960, chaque ligne sur son mot avec l'apparition v2 ; le fond s'affiche 0,25 s avant la première ligne.

## Quand l'utiliser
Une phrase forte. Fond selon la vidéo et le moment : charbon, orange, craie, ou sa vidéo floutée.

## Paramètres
`P.fond` (`charbon` | `orange` | `craie` | `flou`). Textes et tailles dans le HTML (tailles calculées pour la même largeur d'encre), instants `T`.
- `devant/index.html` : durée 4 s ; 4 instants dans l'objet `T` en tête du script.

## Constantes de `commun.mjs`
FONDS (charbon texte craie, orange texte charbon, craie texte charbon, flou sigma 20 niveau 0,40 texte craie), PLEIN (x 91, largeur 899, centreY 960), PLEIN_TEMPS.avanceFond (0,25), APPARITION.

## Son associé
Aucun.

## Composition
- `devant/` : calque transparent DEVANT Romain.
Fond `flou` : pas de fond dans le calque ; sa vidéo qui continue de tourner est floutée (sigma 20) et assombrie à 40 % entre l'image d'apparition du fond et sa sortie. Coupe sèche avant et après.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/plein-ecran-fond-devant.mov
```

## Aperçu
- `apercu-charbon.mp4` : aperçu muet 540 x 960 de la carte r21-01c, refait le 2026-11-14 sur la rush de test (police unique Inter Black), instants par défaut du gabarit.
- `apercu-orange.mp4` : aperçu muet 540 x 960 de la carte r21-01d, refait le 2026-11-14 sur la rush de test (police unique Inter Black), instants par défaut du gabarit.
- `apercu-craie.mp4` : aperçu muet 540 x 960 de la carte r21-01e, refait le 2026-11-14 sur la rush de test (police unique Inter Black), instants par défaut du gabarit.
- `apercu-flou.mp4` : aperçu muet 540 x 960 de la carte r21-01f, refait le 2026-11-14 sur la rush de test (police unique Inter Black), instants par défaut du gabarit.
