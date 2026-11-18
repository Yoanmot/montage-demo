# Bibliothèque de motion design (tour 12 : copie du tour 11 + fichier-partout)

Grammaire du reel 4 (references/notes.md, section 6) avec les valeurs verrouillées de Yoan (STYLE.md).
Chaque dossier = un gabarit HyperFrames paramétré : une fonction `(p, o) -> { css, html, js }` à assembler dans un
calque avec `page()` de `commun.mjs`. `p` préfixe les ids (plusieurs gabarits par calque), `o` = textes, instants
(secondes depuis le début du calque, calés sur les mots de la voix), positions. Couleurs, polices et durées viennent
toutes de `S` dans `commun.mjs`, jamais en dur.

- `commun.mjs` : constantes `S`, `page()`, fond r4-01c `fondC()`, faisceau `faisceauJs()`, `pleinEcran()`, sous-titres
  verrouillés `groupes()` + `sousTitres()`, croix de viseur, crochets dorés, icônes en trait, frappe, entrée/sortie.
- `_fonts/` : Satoshi Black (FFL), Inter, JetBrains Mono et IBM Plex Mono (OFL, google/fonts, licences jointes).

| Gabarit | Où | Reel 4 |
|---|---|---|
| `champ-saisie` | sur la caméra | anim. 1 |
| `regle-pin` | sur la caméra ou en demi-écran | anim. 2, 7, 11 |
| `objet-signature` | sur la caméra, à côté de la tête | anim. 5 |
| `demi-ecran` | cadre du demi-écran (le fond pousse le visage) | anim. 6, 7, 17 |
| `panneau-viseurs` | cadre de panneau (demi ou plein écran) | anim. 3, 9, 10, 11, 13, 16 |
| `liste-cascade` | contenu de panneau | anim. 13, 16 |
| `schema-noeuds` | contenu de panneau | anim. 9 |
| `comparaison-empilee` | demi ou plein écran | anim. 15 |
| `vignette-morph` | plein écran | anim. 4, 8, 12 |
| `appariement` | plein écran | anim. 14, 17 |
| `minuteur` | plein écran ou caméra | (CTA, anim. 18) |
| `fichier-heros` | plein, demi ou caméra | anim. 4, 12 |
| `fichier-partout` | plein écran | anim. 14, 17 (le fichier du héros vers les outils) |
| `liste-torse` | sur la caméra, sur le buste | (2026-10-23 : liste à puces depuis `liste-cascade`) |

`fichier-heros` accepte depuis le 2026-10-23 une version courte sans sources (voir son README).

Exemples d'assemblage : `../../../r11/_build/r11-anim/build.mjs`, `../r12-anim/build.mjs` (fichier-partout). Corrections du tour 11 : coins des crochets `tl tr bl bd` (le `br` du
tour 10 était masqué par le retour à la ligne des sous-titres), étiquettes JetBrains Mono par défaut (`S.etiquette`),
crochets des sous-titres sur le mot doré (capitales, 11 px), logos de marque (`logo()`, `MARQUES`, `tuileTeinte()`,
`captureCss()`).
