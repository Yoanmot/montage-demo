# CTA champ Instagram

Carte verrouillée : r19-03a (Style Lab v2). Calque tiré du build du tour 19.

## Ce qu'il montre
Le champ de commentaire Instagram recopié se pose sur sa poitrine, le mot à commenter (ABDOS) se tape lettre par lettre, « Publier » s'allume.

## Quand l'utiliser
CTA « commente MOT » de fin de vidéo.

## Paramètres
Le mot dans le HTML (une lettre par élément), instants `T` des lettres : règle FRAPPE (environ 18 lettres/s, jamais avant qu'il dise le mot). La photo de profil est un emplacement « image à fournir ».
- `devant/index.html` : durée 3 s ; 9 instants dans l'objet `T` en tête du script. `t09` : le pavé orange de la ligne « commente MOT » se pose sur le mot **une image avant son attaque** (`SOUS_TITRES_TEMPS.avancePave`, comme les sous-titres classiques). À l'instanciation : `"t09": { "pave": "<le mot>" }`.
- Images : remplacées par l'emplacement `../../images/image-a-fournir.svg`. À fournir (attribut `data-a-fournir` de chaque `<img>`) :
  - photo de profil Instagram de Romain (carrée)

## Constantes de `commun.mjs`
CTA.champ (x 91, y 1120, w 899, pfp 84, taille 46, publier 40, curseur [4, 52]), CTA_TEMPS (apparition image 43, mot 3 images après), FRAPPE, NATIF.bleuInstagram, OMBRES.champNatif, POLICES.natif (Roboto).

## Son associé
Une frappe par lettre (`frappes/t1` à `t4`, tournantes, jamais deux fois la même de suite), RMS 23 dB sous la voix, ±1,5 dB.

## Composition
- `devant/` : calque transparent DEVANT Romain.
- Le calque se rend seul, puis se pose sur le plan étalonné (voir `../README.md`).

## Rendu
```
cd devant && npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o ../../_rendus/cta-champ-instagram-devant.mov
```

## Aperçu
- `apercu.mp4` : aperçu muet 540 x 960 de la carte r19-03a, rendu dans le labo.
