# minuteur-suite (carte r11-03b, recâblée le 2026-10-23)

La suite du minuteur, telle que la carte r11-03b du labo la montrait (r11-03a : même chose sur fond uni) : au mot qui donne
la durée, le minuteur doré MM:SS:CC présenté comme le CTA ; sur la phrase suivante il se réduit en continuant de défiler
(0,45 s, power2.inOut, échelle 0,34) pendant que le panneau de verre arrive dessous (en-tête à deux étiquettes, ex. « UNE
FOIS » / « 30 MIN ») et se remplit d'une ligne par chose dite (« Transcriptions », « Anciens contenus », « Vocaux »), les
crochets dorés glissant de ligne en ligne. Remplace le B-roll noir et blanc de la démo (retours de Yoan du 2026-10-23 :
« il y en a une autre qui est la continuité du minuteur de 30 min qui explique mieux »).

`minuteurSuite(p, { minuteur: {...}, panneau: { x, y, w, entree, sortie?, entete }, liste: { y0, pas, items: [{ icone, texte, t }] }, camera: true })`

- Sur la caméra, minuteur sur le torse (les sous-titres prennent le haut, retours du 2026-10-23), réduit au coin haut gauche
  du panneau ; panneau sur le buste (x 290, y 1150, 500 px de large).
- Son : comme le minuteur (son d'apparition du CTA à l'entrée, le même 11 dB plus bas aux lignes, un tic à la réduction),
  posé par les éléments `son` et `tics` de la timeline.
- Gestes repris : `minuteur`, `panneau-viseurs`, `liste-cascade` (une seule version de chaque).
