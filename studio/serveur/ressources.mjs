// Les ressources gratuites dans le studio (studio de Yoan, lots 4B et « ressources directes ») : la liste,
// et ce qui est vraiment en ligne. Seulement pour un client qui a un site de ressources réglé
// (clients/<id>.json, « ressources.site » ; config.apercuRessources) : sinon rien n'apparaît et aucun
// outil n'est lancé (Romain aujourd'hui).
//
// Décision de Yoan du 18/11/2026 : plus d'aperçu ni de bouton de mise en ligne. Le head of content met
// une ressource en ligne dès qu'elle est prête et donne le lien dans le chat ; une modification est
// remise en ligne derrière. Le studio montre le lien, et l'état lu à l'adresse même de la page.
//
// Les outils du dépôt du head of content font le travail ; le studio lit leur sortie (lecture seule) :
//   outils/ressource.py lister --format json --en-ligne   pages, et la page lue à son adresse
//                                                        (« en_ligne_reel » : 200 et contenu identique
//                                                        au dépôt, sinon ce que l'hébergeur a dit)
//   outils/zernio.py ressources --format json            mot, message, prête pour un post
//   outils/ressource.py supprimer <slug> --oui --pousser  bouton « Supprimer » (21/11/2026) : la page
//                                                        quitte le site par le push (même chemin que la
//                                                        mise en ligne), brouillon et fiche effacés
// Jamais de variable d'écriture Zernio : une ressource qu'un post offre encore n'est pas supprimée.
import path from "node:path";
import fs from "node:fs";
import { executer, lireVerdict } from "./commandes.mjs";
import { existe, lireJson, SLUG_RE } from "./outils.mjs";
import { ErreurStudio, phraseBloque } from "./depot-outils.mjs";
import { VARIABLES_ECRITURE, contact } from "./client.mjs";
import { pageRessource } from "./vignettes.mjs";

export const ressourcesActives = (config) => Boolean(config?.apercuRessources);
// Le studio pose-t-il lui-même le mot en commentaire (choix de la ressource au moment de poster, règle
// Zernio attachée au post) ? Non chez un client dont le serveur s'en charge (Romain, « ressources.mot » :
// « serveur ») : là, rien au moment de poster, aucun appel d'écriture chez Zernio depuis le Mac.
export const motParLeServeur = (config) => ressourcesActives(config) && config?.ressourcesMot === "serveur";
export const motParLeStudio = (config) => ressourcesActives(config) && !motParLeServeur(config);

function environnement(config) {
  const env = { ...process.env, HOC_DEPOT: config.depot, PYTHONIOENCODING: "utf-8" };
  for (const k of VARIABLES_ECRITURE) delete env[k];
  return env;
}

// La dernière ligne JSON d'une sortie (les outils écrivent une ligne JSON), ou null.
function derniereLigneJson(sortie) {
  const lignes = String(sortie || "").split("\n").map((l) => l.trim()).filter((l) => l.startsWith("{"));
  for (let i = lignes.length - 1; i >= 0; i--) {
    try { return JSON.parse(lignes[i]); } catch { /* ligne suivante */ }
  }
  return null;
}

async function outilJson(config, script, args, delaiMs = 60000) {
  const fichier = path.join(config.depot, "outils", script);
  if (!existe(fichier)) return null;
  const r = await executer("python3", [fichier, ...args], { cwd: config.depot, env: environnement(config), delaiMs });
  return derniereLigneJson(r.sortie);
}

// Ce qui manque à la fiche d'une ressource pour qu'un post puisse l'offrir (erreurs de zernio.py,
// fonction erreurs_message), en phrases pour le client.
const PROBLEMES = [
  [/^mot invalide : ''/, "Il n'y a pas encore de mot à commenter."],
  [/^mot invalide/, "Le mot à commenter doit être un seul mot sans accent, de 5 à 14 lettres."],
  [/^mot trop courant/, "Le mot est trop courant : des gens l'écriraient sans avoir vu ton post. Il faut un mot propre à la ressource."],
  [/^le lien doit être/, "Le lien vers la page n'est pas encore le bon."],
  [/^message pas validé/, "Le message que reçoivent ceux qui commentent n'est pas encore validé : tu le valides quand tu postes le contenu qui l'offre."],
  [/^message vide ou trop long/, "Le message que reçoivent ceux qui commentent est vide ou trop long."],
  [/^texte du bouton/, "Le texte du bouton du message manque, ou il est trop long."],
  [/tiret long/, "Le message contient un tiret long."],
];

export function phraseProbleme(texte) {
  for (const [motif, p] of PROBLEMES) if (motif.test(texte)) return p;
  return "Un point de la fiche est à revoir.";
}

// Une ligne du vérificateur de page (« ERREUR : ... »), sans son étiquette.
const ligneVerif = (l) => String(l).replace(/^(ERREUR|ATTENTION)\s*:\s*/, "").trim();

// Les dossiers de contenus qui ne sont qu'une ressource (une fiche, rien d'autre) : ils vivent dans
// « Ressources gratuites », pas dans l'arborescence des contenus.
export function ressourceSeule(config, slug) {
  const d = path.join(config.depot, "contenus", slug);
  if (!existe(path.join(d, "ressource.md"))) return false;
  return !["idee.md", "etat.json", "script.md", "carrousel.md"].some((n) => existe(path.join(d, n)));
}

// L'état d'une ressource tel que l'arborescence le montre, déduit des fichiers seuls (rapide).
export function etatRessourceRapide(config, slug) {
  if (!existe(path.join(config.depot, "contenus", slug, "ressource.md"))) return null;
  if (existe(path.join(config.depot, "site", slug, "index.html"))) return "en_ligne";
  if (existe(path.join(config.depot, "site", "_brouillons", slug, "index.html"))) return "brouillon";
  return "fiche";
}

// La page lue à son adresse (ressource.py, « en_ligne_reel »), en mots pour le client. Le détail donné
// par l'hébergeur est gardé tel quel, en plus petit, pour savoir quoi corriger.
const ETATS_EN_LIGNE = {
  en_ligne: "La page répond à son adresse, dans sa dernière version.",
  mise_a_jour: "La nouvelle version sera en ligne dans une minute ou deux.",
  injoignable: "Je n'arrive pas à joindre la page pour vérifier (pas d'internet ?).",
};
const ERREURS_EN_LIGNE = {
  VERCEL_REFUS: "Le site a refusé la dernière version",
  VERCEL_ECHEC: "La dernière version n'a pas pu être construite",
  PAS_A_JOUR: "La page en ligne n'est toujours pas la dernière version, plusieurs minutes après l'envoi.",
  INTROUVABLE: "La page ne répond pas à son adresse.",
  NON_ENVOYEE: "Une modification de la page n'a pas été remise en ligne.",
};

export function etatEnLigne(reel) {
  if (!reel || !reel.etat) return { etat: "injoignable", texte: ETATS_EN_LIGNE.injoignable, detail: null, http: null };
  if (reel.etat === "erreur") {
    // Refus ou échec de l'hébergeur : l'ancienne version reste en ligne, ou rien du tout la première fois.
    const suite = reel.http === 200 ? " : la page en ligne est restée l'ancienne." : " : la page n'est pas en ligne.";
    const texte = /^VERCEL_/.test(reel.code || "") ? ERREURS_EN_LIGNE[reel.code] + suite : ERREURS_EN_LIGNE[reel.code];
    return { etat: "erreur", code: reel.code || null, texte: texte || "La page en ligne a un souci.",
      detail: reel.detail || null, http: reel.http ?? null };
  }
  const etat = ETATS_EN_LIGNE[reel.etat] ? reel.etat : "injoignable";
  return { etat, code: reel.code || null, texte: ETATS_EN_LIGNE[etat], detail: null, http: reel.http ?? null };
}

// Un post qui offre encore la ressource : son mot en commentaire (règle attachée au post) enverrait le
// lien. Seul un envoi raté ne compte plus (même règle que outils/ressource.py supprimer).
// Chez un client dont le serveur pose le mot (publications/a-brancher.json) : « en attente » (il attend la
// vidéo qui l'annonce) et « branché » (la règle est posée) retiennent aussi la ressource.
const STATUTS_RELIES = ["programmé", "envoyé", "publié", "en attente", "branché"];
export const postActif = (p) => STATUTS_RELIES.includes(p?.statut);

const listeTitres = (l) => (l.length === 1 ? l[0] : `${l.slice(0, -1).join(", ")} et ${l[l.length - 1]}`);

// Pourquoi on garde une ressource qu'on voudrait supprimer, ou null si rien ne la retient.
// Le lien d'un mot du serveur mène-t-il à cette ressource (<site>/<slug>/) ?
const lienVers = (lien, slug) => new RegExp(`/${slug}/?$`).test(String(lien || ""));

// Les contenus dont le mot (posé par le serveur) envoie le lien de la ressource, au format des posts reliés.
export function postsDuServeur(mots, cartes) {
  return (mots || []).filter((x) => x && x.contenu).map((x) => ({
    slug: x.contenu,
    titre: cartes.get(x.contenu)?.titre || x.contenu,
    statut: x.statut || null,
    quand: null, // branche_le est en UTC : pas d'heure plutôt qu'une heure fausse
    lien: x.video || null,
    mot: x.mot || null,
    regle: x.statut === "branché" ? "posee" : null,
    libelle: x.statut === "en attente" ? `mot ${x.mot || ""} en attente de la vidéo qui l'annonce`.replace("  ", " ")
      : x.statut === "branché" ? null : x.statut === "coupé" ? `mot ${x.mot || ""} coupé`.replace("  ", " ") : x.statut || null,
  }));
}

// Où en est le mot de cette ressource chez le serveur, en une phrase pour le client.
function etatMotServeur(r, mots) {
  const actifs = (mots || []).filter((x) => postActif(x));
  if (actifs.some((x) => x.statut === "branché")) return { etat: "branche", texte: "Branché : ceux qui commentent le mot sous ta vidéo reçoivent le lien." };
  if (actifs.length) return { etat: "en_attente", texte: "En attente : il se branchera tout seul sur ta vidéo qui annonce le mot, quelques minutes après sa sortie, d'où que tu la postes." };
  if (!r.en_ligne) return { etat: "sans_page", texte: "Pas encore : elle doit d'abord être en ligne." };
  if (!r.valide) return { etat: "a_valider", texte: "Pas encore : valide d'abord la page, puis le message, avec ton head of content." };
  return { etat: "libre", texte: "Pas encore relié à une vidéo : ton head of content met le mot en attente quand tu valides le message de la vidéo qui l'offre." };
}

export function raisonDeGarder(posts, mot) {
  const actifs = (posts || []).filter(postActif);
  if (!actifs.length) return null;
  mot = mot || actifs.find((p) => p.mot)?.mot || null;
  const titres = actifs.map((p) => `« ${p.titre} »`);
  // Mot posé par le serveur, qui attend encore sa vidéo : personne ne l'a reçu, mais il l'enverra.
  if (actifs.every((p) => p.statut === "en attente")) {
    const ta = actifs.length === 1 ? `ta vidéo ${titres[0]}` : `tes vidéos ${listeTitres(titres)}`;
    return `Je la garde : ${mot ? `le mot ${mot}` : "son mot"} attend ${ta} pour envoyer son lien. Sans elle, ceux qui le commenteront tomberaient sur une page qui n'existe plus.`;
  }
  const ceux = mot ? `ceux qui commentent ${mot} sous ` : "ceux qui commentent sous ";
  const ou = actifs.length === 1 ? `ton post ${titres[0]}` : `tes posts ${listeTitres(titres)}`;
  return `Je la garde : ${ceux}${ou} reçoivent son lien. Sans elle, ils tomberaient sur une page qui n'existe plus.`;
}

export class Ressources {
  constructor({ config, journal = () => {}, cartes = () => [] }) {
    this.config = config;
    this.journal = journal;
    this.cartes = cartes; // les cartes du studio (titres des contenus reliés)
  }

  actif() { return ressourcesActives(this.config); }

  exiger() {
    if (!this.actif()) throw new ErreurStudio("INTROUVABLE", "Je ne trouve pas ce que tu demandes.", 404);
  }

  // La liste complète : pages, état en ligne lu à l'adresse, fiches, mots, posts reliés.
  async lister() {
    if (!this.actif()) return { actif: false, ressources: [] };
    // Un dépôt du head of content qui n'a pas encore l'outil des ressources : la liste est vide, sans erreur.
    if (!existe(path.join(this.config.depot, "outils", "ressource.py"))) return { actif: true, site: this.config.apercuRessources, ressources: [] };
    const serveur = motParLeServeur(this.config);
    const [pages, fiches] = await Promise.all([
      outilJson(this.config, "ressource.py", ["lister", "--format", "json", "--en-ligne"], 90000),
      // Mot posé par le serveur : la fiche du mot vient de ressource.py (mot, message, mot chez le serveur).
      serveur ? null : outilJson(this.config, "zernio.py", ["ressources", "--format", "json"]),
    ]);
    if (!pages && !fiches) {
      throw new ErreurStudio("RESSOURCES_ILLISIBLES", `Je n'arrive pas à lire tes ressources gratuites pour l'instant. Réessaie, et si ça recommence, préviens ${contact()}.`, 503);
    }
    const parSlug = new Map();
    for (const p of pages?.ressources || []) parSlug.set(p.slug, { page: p, fiche: null });
    for (const f of fiches?.ressources || []) parSlug.set(f.slug, { ...(parSlug.get(f.slug) || { page: null }), fiche: f });
    const cartes = new Map(this.cartes().filter((c) => c.slug).map((c) => [c.slug, c]));
    const registre = lireJson(path.join(this.config.depot, "publications", "registre.json"), {})?.publications || {};
    const ressources = [];
    for (const [slug, { page, fiche }] of parSlug) {
      if (!SLUG_RE.test(slug)) continue;
      ressources.push(serveur ? this.fusionServeur(slug, page, cartes) : this.fusion(slug, page, fiche, cartes, registre));
    }
    // En erreur d'abord (à régler), puis en cours, en ligne, en préparation ; par titre.
    const rang = { erreur: 0, mise_a_jour: 1, en_ligne: 2, injoignable: 3, en_preparation: 4, sans_page: 5 };
    ressources.sort((a, b) => (rang[a.etat] - rang[b.etat]) || a.titre.localeCompare(b.titre, "fr"));
    return { actif: true, site: pages?.site || this.config.apercuRessources, ressources };
  }

  fusion(slug, page, fiche, cartes, registre) {
    const surLeSite = Boolean(page ? page.page_en_ligne : fiche?.en_ligne);
    const brouillon = Boolean(page?.brouillon) && !surLeSite;
    const avant = page?.avant_en_ligne || null;
    const verif = page?.verification || null;
    const aCorriger = brouillon ? [
      ...(avant?.raisons || []).map((r) => r.charAt(0).toUpperCase() + r.slice(1) + "."),
      ...(verif && !verif.ok ? verif.lignes.filter((l) => /^ERREUR/.test(l)).map(ligneVerif) : []),
    ] : [];
    const enLigne = surLeSite ? etatEnLigne(page?.en_ligne_reel) : null;
    const etat = enLigne ? enLigne.etat : brouillon ? "en_preparation" : "sans_page";
    const carte = cartes.get(slug);
    const posts = Object.entries(registre)
      .filter(([, e]) => e && e.ressource === slug)
      .map(([s, e]) => ({
        slug: s,
        titre: cartes.get(s)?.titre || s,
        statut: e.statut || null,
        quand: e.prevu_le || e.publie_le || null,
        lien: e.lien || null,
        mot: e.mot || e.regle_mot?.mot || null,
        regle: e.regle_mot?.id ? "posee" : e.regle_mot?.erreur ? "erreur" : null,
      }))
      .sort((a, b) => String(b.quand || "").localeCompare(String(a.quand || "")));
    const titre = (page?.titre || fiche?.titre || slug).replace(/^Ressource gratuite\s*:\s*/i, "").trim();
    // Un post ne peut l'offrir que si la page répond à son adresse (ou qu'on ne peut pas le vérifier).
    const repond = Boolean(enLigne) && (enLigne.http === 200 || enLigne.etat === "injoignable");
    return {
      slug,
      titre,
      etat,
      en_ligne: surLeSite,
      en_ligne_reel: enLigne,
      brouillon,
      a_corriger: aCorriger,
      mot: fiche?.mot || page?.mot || null,
      lien: page?.lien || fiche?.lien || null,
      bouton: fiche?.bouton || null,
      // Le prénom de la personne que Zernio glisse dans le message, lisible par le client.
      message: fiche?.message ? fiche.message.replace(/\{\{\s*first_name\s*\}\}/g, "[son prénom]") : null,
      prete: Boolean(fiche?.prete) && repond,
      valide: Boolean(fiche?.valide),
      empreinte: fiche?.empreinte || null,
      repond,
      problemes: [...new Set((fiche?.problemes || []).map(phraseProbleme))],
      // Ce qui empêche un post de l'offrir, hors validation du message (le clic sur Programmer la fait).
      bloquants: [...new Set((fiche?.problemes || []).filter((p) => !/^message pas validé/.test(p)).map(phraseProbleme))],
      contenu: carte ? { slug, titre: carte.titre, format: carte.format, stade: carte.stade } : null,
      posts,
      // Le bouton « Supprimer » (21/11/2026) : refusé tant qu'un post programmé ou publié l'offre.
      garder: raisonDeGarder(posts, fiche?.mot || page?.mot || null),
      // Le petit aperçu de la page sur sa carte (lot 10) : capture fabriquée à la demande, l'adresse change avec la page.
      vignette_url: (() => { const p = pageRessource(this.config, slug); return p ? `/api/ressources/${encodeURIComponent(slug)}/vignette?v=${p.version}` : null; })(),
    };
  }

  // Client dont le serveur pose le mot (Romain) : tout vient de ressource.py (page, fiche, mot, message, et
  // les mots de publications/a-brancher.json qui envoient son lien). Rien ne se choisit au moment de poster.
  fusionServeur(slug, page, cartes) {
    const r = this.fusion(slug, page, null, cartes, {});
    const mots = Array.isArray(page?.mot_serveur) ? page.mot_serveur : [];
    r.mot_par = "serveur";
    r.valide = Boolean(page?.valide);
    r.mot = page?.mot || null;
    r.bouton = page?.bouton || null;
    r.message = page?.message ? page.message.replace(/\{\{\s*first_name\s*\}\}/g, "[son prénom]") : null;
    r.prete = false;
    r.problemes = [];
    r.bloquants = [];
    r.posts = postsDuServeur(mots, cartes);
    r.garder = raisonDeGarder(r.posts, r.mot);
    // Ce que le serveur fera du mot, en une phrase (lue dans les fichiers, jamais supposée).
    r.mot_serveur = etatMotServeur(r, mots);
    return r;
  }

  // La liste déroulante du récapitulatif : chaque ressource du site, offrable ou non (avec la raison).
  // Un message pas encore validé ne l'empêche pas : le clic sur Programmer le valide (18/11/2026).
  // `note` dit pourquoi la liste est vide, ou qu'aucune ne peut être offerte.
  async pourUnPost() {
    if (!this.actif() || motParLeServeur(this.config)) return { ressources: [], note: null };
    const l = await this.lister();
    const ressources = [];
    let enPreparation = 0;
    for (const r of l.ressources) {
      if (!r.en_ligne) { if (r.brouillon) enPreparation++; continue; }
      const raisons = [...r.bloquants];
      if (!r.repond) raisons.unshift(r.en_ligne_reel?.texte || "La page ne répond pas à son adresse.");
      if (!r.mot && !raisons.length) raisons.push("Il n'y a pas encore de mot à commenter.");
      const o = { slug: r.slug, titre: r.titre, mot: r.mot, disponible: !raisons.length };
      if (o.disponible) Object.assign(o, { a_valider: !r.valide, message: r.message, bouton: r.bouton, empreinte: r.empreinte });
      else o.probleme = raisons[0];
      ressources.push(o);
    }
    let note = null;
    if (!ressources.length) {
      note = "Aucune ressource gratuite n'est en ligne pour l'instant"
        + (enPreparation ? ` (${enPreparation > 1 ? `${enPreparation} sont en préparation` : "une est en préparation"})` : "")
        + " : personne ne reçoit de message.";
    } else if (!ressources.some((r) => r.disponible)) {
      note = "Aucune ressource ne peut être offerte pour l'instant : la raison est sous la liste.";
    }
    return { ressources, note };
  }

  // Les posts du registre qui offrent cette ressource (titres des cartes), lus dans les fichiers.
  postsRelies(slug) {
    if (motParLeServeur(this.config)) {
      const d = lireJson(path.join(this.config.depot, "publications", "a-brancher.json"), {})?.mots || {};
      const cartes = new Map(this.cartes().filter((c) => c.slug).map((c) => [c.slug, c]));
      return postsDuServeur(Object.entries(d).filter(([, e]) => e && lienVers(e.lien, slug))
        .map(([contenu, e]) => ({ contenu, mot: e.mot, statut: e.statut, prevu_le: e.prevu_le, branche_le: e.branche_le, video: e.video })), cartes);
    }
    const registre = lireJson(path.join(this.config.depot, "publications", "registre.json"), {})?.publications || {};
    const cartes = new Map(this.cartes().filter((c) => c.slug).map((c) => [c.slug, c]));
    return Object.entries(registre).filter(([, e]) => e && e.ressource === slug)
      .map(([s, e]) => ({ slug: s, titre: cartes.get(s)?.titre || s, statut: e.statut || null, mot: e.mot || e.regle_mot?.mot || null }));
  }

  // Le bouton « Supprimer » (21/11/2026) : la page quitte le site (le push la met hors ligne, comme la
  // mise en ligne), son brouillon et sa fiche sont effacés, puis elle disparaît du studio (tout se relit
  // dans les fichiers). Refusé si un post l'offre encore : on ne touche jamais au mot chez Zernio.
  async supprimer(slug) {
    this.exiger();
    if (!SLUG_RE.test(String(slug || ""))) throw new ErreurStudio("INTROUVABLE", "Je ne trouve plus cette ressource : elle a peut-être déjà été supprimée.", 404);
    const d = this.config.depot;
    const existeEncore = existe(path.join(d, "contenus", slug, "ressource.md"))
      || existe(path.join(d, "site", slug, "index.html")) || existe(path.join(d, "site", "_brouillons", slug, "index.html"));
    if (!existeEncore) throw new ErreurStudio("INTROUVABLE", "Je ne trouve plus cette ressource : elle a peut-être déjà été supprimée.", 404);
    const mot = () => {
      const t = (() => { try { return fs.readFileSync(path.join(d, "contenus", slug, "ressource.md"), "utf8"); } catch { return ""; } })();
      return /^-\s*Mot\s*:\s*`?([A-Za-z]+)`?/mi.exec(t)?.[1]?.toUpperCase() || null;
    };
    const garder = raisonDeGarder(this.postsRelies(slug), mot());
    if (garder) throw new ErreurStudio("RELIEE", garder, 409);
    const fichier = path.join(d, "outils", "ressource.py");
    if (!existe(fichier)) throw new ErreurStudio("OUTIL_ABSENT", phraseBloque("OUTIL_ABSENT"), 503);
    const r = await executer("python3", [fichier, "supprimer", slug, "--oui", "--pousser"],
      { cwd: d, env: environnement(this.config), delaiMs: 120000 });
    const v = lireVerdict(r.sortie);
    if (!v) throw new ErreurStudio("ECHEC", phraseBloque("ECHEC"), 500);
    if (!v.ok) {
      this.journal("ressource_suppression_refusee", { slug, code: v.code });
      if (v.code === "RELIEE") throw new ErreurStudio("RELIEE", raisonDeGarder(this.postsRelies(slug), mot()) || "Je la garde : un de tes posts l'offre encore.", 409);
      if (v.code === "INCONNUE") throw new ErreurStudio("INTROUVABLE", "Je ne trouve plus cette ressource : elle a peut-être déjà été supprimée.", 404);
      throw new ErreurStudio(v.code, `Elle n'est pas supprimée. ${phraseBloque(v.code)}`, 409);
    }
    // Les petits aperçus de sa page ne servent plus.
    const apercus = path.join(this.config.home || "", "apercus-ressources");
    try { for (const n of fs.readdirSync(apercus)) if (n.startsWith(`${slug}--`)) fs.rmSync(path.join(apercus, n), { force: true }); } catch { /* pas d'aperçu */ }
    this.journal("ressource_supprimee", { slug });
    return { slug };
  }

  fermer() { /* plus de processus à arrêter (l'aperçu local n'existe plus) */ }
}

// Pour lecture.mjs : les dossiers de contenus à garder dans l'arborescence.
export function dossiersDeContenus(config, slugs) {
  if (!ressourcesActives(config)) return slugs;
  return slugs.filter((s) => !ressourceSeule(config, s));
}
