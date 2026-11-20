# Animation sur lui (texte sur la caméra)

Geste composé : `../../scripts/texte-sur-lui.mjs`. Yoan (2026-11-20) : « sur la fin de la vidéo il manque au moins une ou
deux animations sur la cam, donc pas de plein écran ; sur une phrase d'enjeu, une animation pour accentuer un peu le
truc. »

## Ce qu'il montre
Ses mots, en capitales craie, au-dessus de sa tête (haut du crâne mesuré) ou sous son visage, au-dessus de ses
sous-titres ; chaque ligne arrive sur sa voix (apparition) ; une ligne peut être sur pavé craie (texte charbon, un clac
quand elle se pose) ; dans une opposition, la ligne qui tombe se barre d'un trait craie et s'estompe quand la suivante
arrive. Il reste à l'image ; ses sous-titres continuent, sans les mots affichés. Pas d'orange.

## Quand l'utiliser
Une phrase d'enjeu ou de contraste : une condition (« si tu… », une question qui l'engage), une opposition (maintenant /
plus tard, ce qu'on croit / ce qui est), une projection dans le temps, une adresse qui pousse à agir. Au moins une dans le
dernier tiers de la vidéo (contrôle `DENSITE` au calage).

## La demande
Format et exemple : `../../../plan-montage/references/format.md`, « Animation sur lui ». Refus : `FORME`, `LIGNES`,
`OPPOSITION`, `LECTURE`, `TAILLE` (1,6 fois au plus entre deux lignes), `PLACE` (pas la place au-dessus de sa tête),
`VISAGE`.

## Constantes de `commun.mjs`
`TEXTE_SUR_LUI` (formes, tailles de capitales, lignes, écarts, tenue, durée), `ACCROCHE.barre` (trait), `ACCROCHE.hautY`
et `basY` (places), `VOILE.standard`, `APPARITION`.
Test : `../../tests/composes.test.mjs`.
