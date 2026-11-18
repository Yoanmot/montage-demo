// Les étapes d'un contenu, par format (lot 10) : une seule définition pour la barre en tirets de l'arborescence et pour
// « Tes contenus » de la vue d'ensemble (même découpage, même ordre). Module pur, sans page : le serveur le teste.

// De la première étape à « publié », comme la barre de l'arborescence (lot 12).
export const ETAPES = {
  reel: ["gardee", "script_ecrit", "valide", "tournage_prevu", "rushs_recus", "planche", "monte", "programme", "publie"],
  carrousel: ["gardee", "script_ecrit", "valide", "mis_en_page", "programme", "publie"],
};

// Ce que dit chaque étape dans « Tes contenus » : ce qui reste à faire, ou ce qui est fait.
export const NOMS = {
  reel: {
    proposee: "idées proposées", gardee: "brief à écrire", script_ecrit: "brief à relire", valide: "brief validé",
    tournage_prevu: "à tourner", rushs_recus: "vidéos à vérifier", planche: "aperçu à valider", monte: "prêts à poster",
    programme: "programmés", publie: "publiés",
  },
  carrousel: {
    proposee: "idées proposées", gardee: "texte à écrire", script_ecrit: "texte à relire", valide: "à mettre en page",
    mis_en_page: "prêts à poster", programme: "programmés", publie: "publiés",
  },
};

// L'avancement d'un dossier dans la barre de l'arborescence : index de son étape (ou -1) et nombre d'étapes.
export function position(c) {
  const e = ETAPES[c.format] || ETAPES.reel;
  return { i: e.indexOf(c.stade), n: e.length };
}

// Combien de contenus à chaque étape, format par format (reels d'abord). Les idées proposées ouvrent la ligne : c'est
// l'étape d'avant le dossier. Ce qui est mis de côté n'est compté nulle part.
export function comptesParFormat(cartes) {
  const r = [];
  for (const format of ["reel", "carrousel"]) {
    const ici = [...cartes].filter((c) => (c.format === "carrousel" ? "carrousel" : "reel") === format);
    const etapes = ["proposee", ...ETAPES[format]].map((stade) => ({
      stade, nom: NOMS[format][stade], n: ici.filter((c) => c.stade === stade).length,
    }));
    r.push({ format, titre: format === "reel" ? "Reels" : "Carrousels", total: etapes.reduce((s, x) => s + x.n, 0), etapes });
  }
  return r;
}
