// Le stade d'une carte (contrat, section 6). Fonction PURE : aucune lecture de disque ici.
// Les entrées sont un instantané fabriqué par lecture.mjs à partir des fichiers ; l'état ne repose
// jamais sur la mémoire du modèle.
//
// stade(contenu, fichiers, etatLocal) -> { stade, activite, a_toi }
//
// contenu : { slug, format: "reel" | "carrousel", etat: <etat.json> | null,
//             proposition?: { id, statut } }            (proposition seule : pas de slug)
// fichiers : {
//   dossier: bool,                 contenus/<slug>/ existe
//   script: "sha256:..." | null,   empreinte actuelle de contenus/<slug>/script.md
//   brouillon: "sha256:..." | null, empreinte de contenus/<slug>/carrousel.md (carrousel)
//   a_rendre: "sha256:..." | null, empreinte de a-rendre/carrousels/<slug>.md
//   rendu: "sha256:..." | null,    empreinte de rendus/carrousels/<slug>.md
//   registre_rendu: { empreinte } | null,   rendus/registre.json carrousels[slug]
//   publication: { statut, prevu_le } | null, publications/registre.json publications[slug]
//   face: [noms],                  entrées de MEDIA/<slug>/face/
//   planche: bool,                 un face/*-montage/apercu/apercu.json (ou, avant le lot 8, planche/planche.png) existe
//   tournage: bool,                le slug est dans un tournages/*.json
// }
// etatLocal : { actions: [Action], actives: [chat_id], maintenant: Date }
import { EXT_VIDEO, lireDate } from "./outils.mjs";
import path from "node:path";

export const LIBELLES = {
  proposee: "idée proposée",
  gardee: "brief à écrire",
  script_ecrit: "brief à relire",
  valide: "brief validé",
  tournage_prevu: "à tourner",
  rushs_recus: "rushs reçus",
  planche: "aperçu à valider",
  monte: "monté",
  mis_en_page: "mis en page",
  programme: "programmé",
  publie: "publié",
  abandonne: "mis de côté",
  refusee: "refusée",
  de_cote: "mise de côté",
};

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

export function libelle(stade, format, publication) {
  if (stade === "valide" && format === "carrousel") return "à mettre en page";
  if (stade === "programme" && publication?.prevu_le) {
    const d = lireDate(publication.prevu_le);
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(publication.prevu_le));
    if (d && m) return `programmé ${JOURS[new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`).getUTCDay()].slice(0, 3)}. ${m[3]}/${m[2]}`;
  }
  return LIBELLES[stade] || stade;
}

export function estMonte(nom) {
  return /-monte(-\d+)?\.mp4$/i.test(nom);
}

export function estOriginale(nom) {
  const ext = path.extname(nom).toLowerCase();
  if (!EXT_VIDEO.has(ext)) return false;
  const base = nom.slice(0, -ext.length);
  return !/-monte(-\d+)?$/i.test(base) && !/-coupe/i.test(base) && !nom.startsWith(".");
}

function stadePublication(pub, maintenant) {
  if (!pub) return null;
  if (pub.statut === "publié") return "publie";
  // Parti tout de suite, Instagram le prépare encore (« envoyé », ou l'état brut de Zernio d'avant le
  // 2026-11-19 comme « publishing ») : déjà posté, on ne le propose plus à la publication.
  if (pub.statut === "envoyé" || ["pending", "processing", "uploading", "publishing", "partial", "published"].includes(pub.statut)) return "publie";
  if (pub.statut === "programmé") {
    const d = lireDate(pub.prevu_le);
    if (d && d.getTime() <= maintenant.getTime()) return "publie";
    return "programme";
  }
  return null;
}

function stadeReel(c, f, maintenant) {
  if (c.etat?.refuse) return "abandonne";
  const pub = stadePublication(f.publication, maintenant);
  if (pub) return pub;
  const face = f.face || [];
  if (face.some(estMonte)) return "monte";
  if (f.planche) return "planche";
  if (face.some(estOriginale)) return "rushs_recus";
  if (f.tournage) return "tournage_prevu";
  if (c.etat?.valide?.empreinte && f.script && c.etat.valide.empreinte === f.script) return "valide";
  if (f.script) return "script_ecrit";
  if (f.dossier) return "gardee";
  return null;
}

function stadeCarrousel(c, f, maintenant) {
  if (c.etat?.refuse) return "abandonne";
  const pub = stadePublication(f.publication, maintenant);
  if (pub) return pub;
  // Brouillon retouché après validation : à relire, même s'il était mis en page.
  const valideAvant = c.etat?.valide?.empreinte;
  if (valideAvant && f.brouillon && f.brouillon !== valideAvant) return "script_ecrit";
  if (f.registre_rendu?.empreinte && f.rendu && f.registre_rendu.empreinte === f.rendu && !f.a_rendre) {
    return "mis_en_page";
  }
  // Même texte de référence que `etat.py` (texte_du_contenu) : le brouillon, sinon (carrousel
  // d'avant le studio) a-rendre/, sinon rendus/.
  const valide = c.etat?.valide?.empreinte;
  const reference = f.brouillon || f.a_rendre || f.rendu || null;
  if (valide && reference && valide === reference) return "valide";
  // Brouillon écrit (contrat, section 4) ; un ancien carrousel sans brouillon compte par son texte.
  if (f.brouillon || f.a_rendre || f.rendu) return "script_ecrit";
  if (f.dossier) return "gardee";
  return null;
}

function concerne(action, slug) {
  return action.slug === slug || (Array.isArray(action.slugs) && action.slugs.includes(slug));
}

export function superposition(slug, etatLocal = {}) {
  const actions = (etatLocal.actions || []).filter((a) => concerne(a, slug));
  const actives = new Set(etatLocal.actives || []);
  const chatActif = actives.has(`${slug}:hoc`) || actives.has(`${slug}:monteur`);
  let activite = null;
  if (chatActif || actions.some((a) => a.statut === "en_cours")) activite = "en_cours";
  else if (actions.some((a) => a.statut === "en_file")) activite = "en_file";
  const derniere = actions[actions.length - 1];
  if (!activite && derniere?.statut === "erreur") activite = "erreur";
  const a_toi = activite !== "en_cours" && derniere?.statut === "a_toi";
  if (activite === "erreur") return { activite, a_toi, erreur_message: derniere.erreur || null };
  return { activite, a_toi };
}

export function stade(contenu, fichiers = {}, etatLocal = {}) {
  const maintenant = etatLocal.maintenant || new Date();
  if (!contenu.slug) {
    const st = contenu.proposition?.statut;
    const s = st === "refusee" ? "refusee" : st === "de_cote" ? "de_cote" : "proposee";
    return { stade: s, activite: null, a_toi: false };
  }
  const s = contenu.format === "carrousel"
    ? stadeCarrousel(contenu, fichiers, maintenant)
    : stadeReel(contenu, fichiers, maintenant);
  return { stade: s || "gardee", ...superposition(contenu.slug, etatLocal) };
}
