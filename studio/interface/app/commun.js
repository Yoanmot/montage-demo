// Ce que l'arborescence, le fichier ouvert et le reste de l'interface partagent.

// Les actions qui se lancent sur plusieurs dossiers d'un coup, depuis le fichier où vit leur bouton
// (lot 11 : plus de cases dans l'arborescence). Le plan de tournage se choisit dans « Tournages », la
// publication dans « Poster ».
export const ACTIONS_LOT = [
  { type: "script", titre: "Plusieurs briefs d'un coup", libelle: (n) => `Écrire les ${n} briefs`, ok: (c) => c.stade === "gardee",
    note: "Je les écris l'un après l'autre. Si j'ai une question, le dossier concerné te la pose." },
  { type: "montage", titre: "Plusieurs vidéos au montage", libelle: (n) => `Envoyer les ${n} au montage`, ok: (c) => c.format === "reel" && c.stade === "rushs_recus",
    note: "Vérifie d'abord les vidéos rangées de chacune. Je les monte l'une après l'autre, chacune s'arrête à son aperçu." },
  { type: "mise_en_page", titre: "Plusieurs carrousels d'un coup", libelle: (n) => `Mettre les ${n} en page`, ok: (c) => c.format === "carrousel" && c.stade === "valide",
    note: "Je les mets en page l'un après l'autre." },
];
export const NOMS_ACTION = {
  script: ["brief", "briefs"], tournage: ["plan de tournage", "plans de tournage"], montage: ["montage", "montages"],
  mise_en_page: ["mise en page", "mises en page"], idees: ["recherche d'idées", "recherches d'idées"],
  rangement: ["rangement", "rangements"], publication: ["programmation", "programmations"], archivage: ["archivage", "archivages"],
  description: ["description", "descriptions"],
};
export const NOMS_FICHIERS = { idee: "Idée", brief: "Brief", montage: "Montage", video: "Vidéo montée", slides: "Images", ressource: "Ressource gratuite", autres: "Autres fichiers" };
export const ICONES_FICHIERS = { idee: "idee", brief: "brief", montage: "ciseaux", video: "video", slides: "slides", ressource: "cadeau", autres: "dossier" };

export const cle = (c) => c.slug || `p:${c.proposition_id}`;
export const libre = (c) => !["en_cours", "en_file"].includes(c.activite);

// Le fichier qu'on ouvre en cliquant sur un dossier : celui de l'étape où il en est.
export function fichierParDefaut(c) {
  const f = c.fichiers || ["idee"];
  const veut = {
    proposee: "idee", refusee: "idee", gardee: "idee", script_ecrit: "brief", valide: "brief", tournage_prevu: "brief",
    rushs_recus: "montage", planche: "montage", monte: "video", mis_en_page: "slides", programme: c.format === "reel" ? "video" : "slides",
    publie: c.format === "reel" ? "video" : "slides", abandonne: "idee", de_cote: "idee",
  }[c.stade];
  // « Autres fichiers » ne s'ouvre jamais tout seul : c'est un rangement, pas une étape.
  const etapes = f.filter((x) => x !== "autres");
  return f.includes(veut) ? veut : etapes[etapes.length - 1] || "idee";
}

// Où sont le chat et l'arborescence : à droite et à gauche sur un écran large, dessous et au-dessus
// quand les colonnes s'empilent (moins de 860 px, voir style.css).
export const ETROIT = window.matchMedia("(max-width: 860px)");
export const ouChat = () => (ETROIT.matches ? "juste en dessous" : "à droite");
export const ouArbre = () => (ETROIT.matches ? "plus haut" : "à gauche");

// Un plan de tournage s'appelle par son jour : « Tournage du mardi 17 novembre » (avec l'heure s'il y
// en a plusieurs le même jour).
export function titreTournage(t, liste = []) {
  const jour = (t.cree_le || t.id || "").slice(0, 10);
  const fJ = new Intl.DateTimeFormat("fr-CH", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Zurich" });
  const d = /^\d{4}-\d{2}-\d{2}$/.test(jour) ? new Date(`${jour}T11:00:00Z`) : null;
  let titre = d ? `Tournage du ${fJ.format(d)}` : "Tournage";
  const memeJour = liste.filter((x) => (x.cree_le || x.id || "").slice(0, 10) === jour);
  const hm = /T(\d{2}):(\d{2})/.exec(t.cree_le || "") || /-(\d{2})(\d{2})$/.exec(t.id || "");
  if (memeJour.length > 1 && hm) titre += `, ${hm[1]} h ${hm[2]}`;
  return titre;
}
