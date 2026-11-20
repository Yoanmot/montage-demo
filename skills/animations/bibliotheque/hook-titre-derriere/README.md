# Titre derrière lui

Carte verrouillée : r20-01d (Style Lab v2). Calque tiré du build du tour 20.

## Ce qu'il montre
Phrase en minuscules (`t01`), mot géant (`t02`) et pavé orange en saccade (`t03`), chacun sur son mot (animé depuis le 2026-11-20), tous DERRIÈRE lui ; le mot géant passe au-dessus de sa tête, 16 px entre la ligne de base de la phrase et le haut des capitales du mot géant. Voile sombre en haut du cadre.

## Quand l'utiliser
Hook « pro » quand sa tête est assez basse dans le cadre pour laisser le mot géant passer derrière.

## Paramètres
Textes dans le HTML. Taille du mot géant : son encre couvre la zone sûre ; le bas des capitales du mot géant à 30 % sous le haut du crâne.
- `derriere/index.html` : durée 3 s ; instants dans l'objet `T` en tête du script.

## Constantes de `commun.mjs`
TITRE_DERRIERE (phraseTop 250, écart 16 retenu, ecartPave 22), HOOKS.titre, VOILE.standard, OMBRES.texteDouce.

## Son associé
`arrivee-tick.wav` quand le mot géant devient lisible (`#mot`).

## Composition
- `derriere/` : calque transparent DERRIÈRE Romain.
Calque `derriere/` : rendu puis troué image par image par le masque de Romain (détourage), posé SOUS lui.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd derriere && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/hook-titre-derriere-derriere.mov
```

## Aperçu
- `apercu.mp4` : aperçu muet 540 x 960 de la carte r20-01d, refait le 2026-11-14 sur la rush de test (police unique Inter Black), instants par défaut du gabarit ; antérieur à l'animation du 2026-11-20 (il montre encore la version posée d'un coup).
