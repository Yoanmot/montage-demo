# liste-torse (2026-10-23, sur la caméra)

Liste à puces posée sur le buste, sous le menton, construite depuis `liste-cascade` (demande de Yoan sur la démo : « une
petite animation en mode bullet points sur mon torse »). Une ligne par idée dite : bande de verre sombre sur caméra
(filet crème 1,5 px, rayon du champ 18 px), puce crème, texte Inter en capitales espacées. Chaque ligne entre depuis un
flou en glissant de 14 px, calée sur son mot ; les crochets dorés se resserrent sur la première ligne puis glissent de
ligne en ligne (0,22 s, power2.inOut) ; la puce active passe au doré avec halo, les lignes déjà dites restent en
secondaire. Pas de panneau, pas de son (les entrées de lignes sont muettes, REGLES « Son »).

`listeTorse(p, { x, y, w, h, pas, taille, police: 'inter'|'jetbrains', items: [{ texte, t }], actif: [{ t, i }], sortie })`

Placement par défaut : x 296, première ligne à y 1190 (sous le menton du cadre de repos, vers y 1130), 600 x 84 px, Inter
40 px, pas de 100 px : trois lignes finissent à y 1474, dans la zone sûre (sous y 1479 à gauche il faudrait x 366), bord
droit à x 896 (899 au plus). Les sous-titres restent en haut (y 256), jamais en conflit.
Carte au banc : `executeur/banc/variantes.py liste-torse` (planche `executeur/banc/sorties/liste-torse/planche.png`).
