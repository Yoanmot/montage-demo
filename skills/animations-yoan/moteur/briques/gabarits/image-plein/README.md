# image-plein (2026-10-23, plein écran)

Une photo sur le fond r4-01c, dans le cadre du style (filet crème 1,5 px, croix « + » de viseur aux 4 coins), étalonnée pour
rejoindre l'image du reel (sépia 0,28, saturation 0,82, contraste 1,06, luminosité 0,92), vignette, grain qui vibre (opacité 0,32 : à 0,5 une petite photo agrandie devenait bruitée), zoom
lent continu linéaire de 100 à 106 % tant qu'elle est là. Entrée en fondu depuis un flou (12 px, 0,17 s) depuis 104 %.
Usage : un moment drôle ou une image qui dit la phrase mieux que des mots (démo : « la manière dont tu t'en sers » -> un
singe devant un ordinateur), sous-titres en haut, son comique ou impactant (`son` de la timeline, effet `comique`).

`imagePlein(p, { image, x: 90, y: 560, w: 900, h, entree, sortie?, fin, zoom: 1.06, etalonnage? })`

- Générique : l'image est un paramètre (copiée dans le calque). Le gabarit n'embarque aucune photo. Pour un reel client,
  une image dont on a les droits ; la photo de la démo est dans `executeur/test/medias/` (usage personnel).
- Dans la timeline : `motion` support `plein` ; posé juste après un plein écran à mots (`de` = son `a`), il enchaîne sur le
  même fond sans faisceau (le plein écran continue, son contenu change).
