// Comment un reel se tourne (2026-11-20, champ `genre` des cartes) : les mots que l'interface montre. Module pur,
// importé aussi par les tests du serveur. Sans genre : face caméra.
export function nomFormat(c) {
  if (c?.format !== "reel") return "Carrousel";
  if (c.genre === "plans-texte") return "Reel, texte à l'écran";
  if (c.genre === "plans-voix") return "Reel, avec ta voix";
  return "Reel";
}

// Le rôle d'une vidéo rangée (vue Montage). Un reel sans parole range son plan principal comme sa vidéo du reel ;
// un reel en voix off range sa voix là où irait la face caméra.
export function nomRole(type, genre = null) {
  if (type === "face" && genre === "plans-texte") return "Vidéo du reel";
  if (type === "face" && genre === "plans-voix") return "Ta voix";
  return { face: "Face caméra", "b-roll": "Plan en plus", photo: "Photo", ecran: "Écran" }[type] || "";
}
