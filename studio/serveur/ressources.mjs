// Les ressources gratuites dans le studio (studio de Yoan, lot 4B) : la liste, l'aperçu local d'une page,
// la mise en ligne au clic du client. Seulement pour un client qui a un site de ressources réglé
// (clients/<id>.json, « ressources.site » ; config.apercuRessources) : sinon rien n'apparaît et aucun
// outil n'est lancé (Romain aujourd'hui).
//
// Les outils du dépôt du head of content font le travail ; le studio lit leur sortie :
//   outils/ressource.py lister --format json     pages (brouillon, en ligne, vérification)
//   outils/zernio.py ressources --format json    mot, message, prête pour un post (lecture seule)
//   outils/ressource.py servir --port 0          aperçu local de site/ (un processus, gardé ouvert)
//   outils/ressource.py mettre-en-ligne <slug> --oui --pousser --attendre   au seul clic du client
// Tous tournent dans DEPOT (la copie du studio, où le head of content écrit les brouillons), lecture
// seule sauf la mise en ligne (son propre git pull, commit, push). Jamais de variable d'écriture Zernio.
import { spawn } from "node:child_process";
import path from "node:path";
import { executer, lireVerdict } from "./commandes.mjs";
import { existe, lireJson, SLUG_RE } from "./outils.mjs";
import { ErreurStudio, MESSAGE_GENERIQUE } from "./depot-outils.mjs";
import { VARIABLES_ECRITURE, contact } from "./client.mjs";

export const ressourcesActives = (config) => Boolean(config?.apercuRessources);

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
  [/^message pas validé/, "Tu n'as pas encore validé le message que reçoivent ceux qui commentent."],
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

export class Ressources {
  constructor({ config, journal = () => {}, cartes = () => [] }) {
    this.config = config;
    this.journal = journal;
    this.cartes = cartes; // les cartes du studio (titres des contenus reliés)
    this.apercuProc = null;
    this.apercuBase = null;
    this.enLigneEnCours = new Set();
  }

  actif() { return ressourcesActives(this.config); }

  exiger() {
    if (!this.actif()) throw new ErreurStudio("INTROUVABLE", "Je ne trouve pas ce que tu demandes.", 404);
  }

  // La liste complète : pages, fiches, mots, posts reliés. { actif, ressources: [...] }.
  async lister() {
    if (!this.actif()) return { actif: false, ressources: [] };
    const [pages, fiches] = await Promise.all([
      outilJson(this.config, "ressource.py", ["lister", "--format", "json"]),
      outilJson(this.config, "zernio.py", ["ressources", "--format", "json"]),
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
      ressources.push(this.fusion(slug, page, fiche, cartes, registre));
    }
    // En ligne d'abord, puis à vérifier, puis le reste ; par titre.
    const rang = { en_ligne: 0, a_verifier: 1, a_finir: 2, sans_page: 3 };
    ressources.sort((a, b) => (rang[a.etat] - rang[b.etat]) || a.titre.localeCompare(b.titre, "fr"));
    return { actif: true, site: pages?.site || this.config.apercuRessources, ressources };
  }

  fusion(slug, page, fiche, cartes, registre) {
    const enLigne = Boolean(page ? page.en_ligne : fiche?.en_ligne);
    const brouillon = Boolean(page?.brouillon) && !page?.page_en_ligne;
    const avant = page?.avant_en_ligne || null;
    const verif = page?.verification || null;
    const aCorriger = [
      ...(avant?.raisons || []).map((r) => r.charAt(0).toUpperCase() + r.slice(1) + "."),
      ...(verif && !verif.ok ? verif.lignes.filter((l) => /^ERREUR/.test(l)).map(ligneVerif) : []),
    ];
    const peut = brouillon && Boolean(page?.fiche) && Boolean(verif?.ok) && Boolean(avant?.ok);
    const etat = enLigne ? "en_ligne" : brouillon ? (peut ? "a_verifier" : "a_finir") : "sans_page";
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
    return {
      slug,
      titre,
      etat,
      en_ligne: enLigne,
      brouillon,
      peut_mettre_en_ligne: peut,
      a_corriger: aCorriger,
      mot: fiche?.mot || page?.mot || null,
      lien: page?.lien || fiche?.lien || null,
      bouton: fiche?.bouton || null,
      // Le prénom de la personne que Zernio glisse dans le message, lisible par le client.
      message: fiche?.message ? fiche.message.replace(/\{\{\s*first_name\s*\}\}/g, "[son prénom]") : null,
      prete: Boolean(fiche?.prete),
      problemes: [...new Set((fiche?.problemes || []).map(phraseProbleme))],
      apercu: Boolean(page?.apercu),
      contenu: carte ? { slug, titre: carte.titre, format: carte.format, stade: carte.stade } : null,
      posts,
    };
  }

  // Les ressources qu'un post peut offrir : en ligne, message complet et validé (zernio.py « prete »).
  async pretes() {
    if (!this.actif()) return [];
    const l = await this.lister();
    return l.ressources.filter((r) => r.prete && r.mot).map((r) => ({ slug: r.slug, titre: r.titre, mot: r.mot }));
  }

  // ---------------------------------------------------------- aperçu local

  // L'adresse locale où lire la page d'une ressource (brouillon ou en ligne) : le site du dépôt servi par
  // ressource.py servir, sur un port libre de 127.0.0.1, ouvert à la première demande.
  async apercu(slug) {
    this.exiger();
    if (!SLUG_RE.test(slug)) throw new ErreurStudio("INTROUVABLE", "Je ne trouve pas cette ressource.", 404);
    const d = await outilJson(this.config, "ressource.py", ["apercu", slug]);
    if (!d?.apercu) throw new ErreurStudio("PAS_DE_PAGE", "Cette ressource n'a pas encore de page à regarder.", 404);
    const base = await this.servir();
    return { url: base.replace(/\/$/, "") + d.apercu };
  }

  servir() {
    if (this.apercuBase && this.apercuProc && this.apercuProc.exitCode === null) return Promise.resolve(this.apercuBase);
    const fichier = path.join(this.config.depot, "outils", "ressource.py");
    if (!existe(fichier)) return Promise.reject(new ErreurStudio("OUTIL_ABSENT", MESSAGE_GENERIQUE, 503));
    return new Promise((resolve, reject) => {
      const p = spawn("python3", ["-u", fichier, "servir", "--port", "0"], {
        cwd: this.config.depot, env: environnement(this.config), detached: true, stdio: ["ignore", "pipe", "pipe"],
      });
      let tampon = "";
      let fini = false;
      const echec = () => {
        if (fini) return;
        fini = true;
        this.arreterApercu();
        reject(new ErreurStudio("APERCU", `Je n'arrive pas à ouvrir l'aperçu. Réessaie, et si ça recommence, préviens ${contact()}.`, 503));
      };
      const minuterie = setTimeout(echec, 15000);
      p.stdout.setEncoding("utf8");
      p.stdout.on("data", (d) => {
        tampon += d;
        const m = /^APERCU (http:\/\/127\.0\.0\.1:\d+\/)\s*$/m.exec(tampon);
        if (m && !fini) {
          fini = true;
          clearTimeout(minuterie);
          this.apercuBase = m[1];
          resolve(m[1]);
        }
      });
      p.stderr.on("data", () => {});
      p.on("error", () => { clearTimeout(minuterie); echec(); });
      p.on("exit", () => {
        clearTimeout(minuterie);
        if (this.apercuProc === p) { this.apercuProc = null; this.apercuBase = null; }
        echec();
      });
      this.apercuProc = p;
    });
  }

  arreterApercu() {
    const p = this.apercuProc;
    this.apercuProc = null;
    this.apercuBase = null;
    if (!p) return;
    try { process.kill(-p.pid, "SIGTERM"); } catch { try { p.kill("SIGTERM"); } catch { /* déjà fini */ } }
  }

  fermer() { this.arreterApercu(); }

  // ---------------------------------------------------------- mise en ligne (au clic)

  async mettreEnLigne(slug) {
    this.exiger();
    if (!SLUG_RE.test(slug)) throw new ErreurStudio("INTROUVABLE", "Je ne trouve pas cette ressource.", 404);
    if (this.enLigneEnCours.has(slug)) throw new ErreurStudio("OCCUPE", "Elle est déjà en train de partir : attends un instant.", 409);
    const fichier = path.join(this.config.depot, "outils", "ressource.py");
    if (!existe(fichier)) throw new ErreurStudio("OUTIL_ABSENT", MESSAGE_GENERIQUE, 503);
    const attente = Math.max(0, Number(this.config.brut?.ressources_attente_s ?? 120));
    const args = [fichier, "mettre-en-ligne", slug, "--oui", "--pousser", ...(attente ? ["--attendre", "--delai", String(attente)] : [])];
    this.enLigneEnCours.add(slug);
    try {
      const r = await executer("python3", args, { cwd: this.config.depot, env: environnement(this.config), delaiMs: (attente + 180) * 1000 });
      const v = lireVerdict(r.sortie);
      this.journal("ressource_mise_en_ligne", { slug, ok: Boolean(v?.ok), code: v?.code || null });
      if (v?.ok) {
        if (/^OK en ligne\b/.test(v.ligne)) return { statut: "en_ligne", message: "C'est en ligne : la page répond à son adresse." };
        return { statut: "envoyee", message: "C'est envoyé : la page sera visible à son adresse dans une minute ou deux." };
      }
      const PHRASES = {
        PAS_DE_FICHE: "Cette ressource n'a pas encore de fiche : demande-la à ton head of content. Rien n'a changé.",
        DEJA_EN_LIGNE: "Elle est déjà en ligne.",
        PAS_DE_BROUILLON: "Je ne trouve plus la page à mettre en ligne. Rien n'a changé.",
        PAGE_PAS_PRETE: "La page n'est pas prête à partir : rien n'a changé. Demande à ton head of content de la corriger.",
        SYNCHRO: "Je n'arrive pas à me mettre à jour (pas d'internet ?) : rien n'a changé, réessaie dans un moment.",
        CONFLIT: "Rien n'a changé : réessaie dans un moment.",
      };
      throw new ErreurStudio(v?.code || "ECHEC", (v && PHRASES[v.code]) || MESSAGE_GENERIQUE, 409);
    } finally {
      this.enLigneEnCours.delete(slug);
    }
  }
}

// Pour lecture.mjs : les dossiers de contenus à garder dans l'arborescence.
export function dossiersDeContenus(config, slugs) {
  if (!ressourcesActives(config)) return slugs;
  return slugs.filter((s) => !ressourceSeule(config, s));
}
