# fichier-heros (tour 11, r11-02)

Le fichier de contexte en héros : un grand document en verre (800 x 960 px à l'échelle 1) qui se construit en direct.
Sources en couleur (logo Instagram, vocaux sur tuile bleue #3078A8, vignette vidéo bleue, logo Notion) ; le document
apparaît vide (squelette discret), logos ChatGPT / Claude / Gemini dans l'en-tête ; les sources s'y versent (0,36 s,
power3.in, le bord prend leur couleur) ; le nom se tape ; sections TA VOIX (onde), TES MOTS (mots réels de la rush),
TES EXEMPLES (une ligne par source) ; au dernier mot tout passe au doré (filet, étiquettes, onde, crochets r4-04a, reflet).

`fichierHeros(p, { mode: 'plein'|'demi'|'camera', doc: { x, y, k }, sources: [{ x, y, t }] x4, taille, tDoc, tIA, verse: [t x4], titre: { t, texte }, sections: [t, t, t], tOr, sortie })`

Mises en scène : plein (doc x 140, y 600, k 1, sources en ligne au-dessus) ; demi (dans demi-ecran, doc x 320, y 462,
k 0,55, sources à gauche et à droite) ; camera (doc devant le buste x 390, y 1104, k 0,56, monte en perspective et se
redresse, sources sur le mur autour de la tête). Son : un tic à l'arrivée du document (ou du fond), un au doré.
Exemples : r11-02a, r11-02b, r11-02c.

Version courte (2026-10-23, démo replacée) : sans `sources` (ni `verse`), le document monte seul, le nom se tape, les
sections se construisent et tout passe au doré, sur une phrase de 2 s (« un fichier de contexte dédié à ta voix »).
Avec `sources`, le HTML est inchangé (vérifié octet pour octet sur r11-02a, b et c).
