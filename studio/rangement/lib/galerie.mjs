// La Galerie (lot 15 du studio, CONTRAT-STUDIO.md section 18) : les photos et les b-rolls gardés pour resservir,
// jamais la face caméra. Un fichier réel par élément dans GALERIE/fichiers/, une fiche JSON par élément dans
// GALERIE/fiches/, un index reconstruit après chaque écriture. Un contenu qui s'en sert le reçoit par lien physique
// (copie seulement si la Galerie est sur un autre disque) : archiver ou retirer le contenu n'efface que le lien.
//
// Toutes les écritures passent par ce module, sous le verrou de la Galerie (GALERIE/.galerie.lock), pris par un
// processus vivant ; jamais d'état dans la mémoire d'un modèle. Le serveur et les scripts lisent l'index.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { lireJson, ecrireJson, isoZurich, lireDate, clipId, sonder, typeFichier, deplacer, estLien, SLUG } from './commun.mjs';

export const ID_GALERIE = /^\d{8}-\d{6}-[a-z0-9]{4}$/;
// Le nom d'un lien dans un contenu : <id>.<ext>, ou slide-NN-<id>.<ext> pour la photo d'une slide de carrousel.
const NOM_LIEN = /^(?:slide-(\d{2})-)?(\d{8}-\d{6}-[a-z0-9]{4})\.[A-Za-z0-9]{2,5}$/;
export const ECART_MIN = 3;   // un b-roll ne revient pas à moins de 3 vidéos postées d'écart (Yoan, 2026-11-21)

export function dossierGalerie(config) {
  if (config.galerie) return config.galerie;
  return path.join(path.dirname(config.media), 'Galerie');
}

export function lienVersId(nom) {
  const m = NOM_LIEN.exec(String(nom || ''));
  return m ? { id: m[2], slide: m[1] ? Number(m[1]) : null } : null;
}

const dormir = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function lectureSeule(p) { try { fs.chmodSync(p, 0o444); } catch { /* disque qui ne le permet pas : rien de plus */ } }

// L'empreinte d'un fichier (sha256 de tout le fichier, lu par morceaux) : sert à reconnaître un doublon.
export function empreinteFichier(p) {
  const h = crypto.createHash('sha256');
  const fd = fs.openSync(p, 'r');
  try {
    const buf = Buffer.allocUnsafe(4 * 1024 * 1024);
    for (let n; (n = fs.readSync(fd, buf, 0, buf.length, null)) > 0;) h.update(buf.subarray(0, n));
  } finally { fs.closeSync(fd); }
  return `sha256:${h.digest('hex')}`;
}

// ---------------------------------------------------------------- le verrou

function vivant(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (k) { return k.code === 'EPERM'; }
}

// Attend le verrou (les écritures durent quelques millisecondes) ; null après `attenteMs`.
export function prendreVerrouGalerie(racine, { attenteMs = 8000 } = {}) {
  fs.mkdirSync(racine, { recursive: true });
  const p = path.join(racine, '.galerie.lock');
  const fin = Date.now() + attenteMs;
  for (;;) {
    try {
      const fd = fs.openSync(p, 'wx');
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      const liberer = () => { try { if (fs.readFileSync(p, 'utf8') === String(process.pid)) fs.unlinkSync(p); } catch {} };
      return liberer;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let pid = null;
      try { pid = Number(fs.readFileSync(p, 'utf8')); } catch { /* relâché entre-temps */ }
      if (pid === process.pid) return () => {};   // déjà tenu par ce processus (appel imbriqué)
      if (pid !== null && !vivant(pid)) { fs.rmSync(p, { force: true }); continue; }
      if (Date.now() > fin) return null;
      dormir(40);
    }
  }
}

export function verrouGaleriePris(racine) {
  try { return vivant(Number(fs.readFileSync(path.join(racine, '.galerie.lock'), 'utf8'))); } catch { return false; }
}

// ---------------------------------------------------------------- la description (schéma)

const TIRET_LONG = /\s*\u2014\s*/g;
const propre = (s, max) => String(s ?? '').replace(TIRET_LONG, ', ').replace(/\s+/g, ' ').trim().slice(0, max);

// Valide une description (sortie du modèle, ou retouche du client) avant toute écriture. Renvoie
// { ok, description } ou { ok: false, pourquoi }. Les champs inconnus sont retirés.
export function validerDescription(brut, { type, duree_s = null } = {}) {
  let d = brut;
  if (typeof d === 'string') {
    const t = d.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    const i = t.indexOf('{'), j = t.lastIndexOf('}');
    if (i < 0 || j <= i) return { ok: false, pourquoi: 'pas de JSON' };
    try { d = JSON.parse(t.slice(i, j + 1)); } catch { return { ok: false, pourquoi: 'JSON illisible' }; }
  }
  if (!d || typeof d !== 'object' || Array.isArray(d)) return { ok: false, pourquoi: 'pas un objet' };
  const r = {};
  for (const [k, max] of [['titre', 100], ['ce_qu_on_voit', 900], ['action', 900], ['lieu', 300], ['cadrage', 500]]) {
    const v = propre(d[k], max);
    if (!v) return { ok: false, pourquoi: `champ vide : ${k}` };
    r[k] = v;
  }
  if (r.titre.length < 3) return { ok: false, pourquoi: 'titre trop court' };
  // Le modèle écrit parfois « "true" » entre guillemets (vu en essai réel, deux fois de suite) : le sens est sûr, on le lit.
  const personne = typeof d.personne_a_l_image === 'string'
    ? ({ true: true, vrai: true, oui: true, false: false, faux: false, non: false })[d.personne_a_l_image.trim().toLowerCase()]
    : d.personne_a_l_image;
  if (typeof personne !== 'boolean') return { ok: false, pourquoi: 'personne_a_l_image doit être vrai ou faux' };
  r.personne_a_l_image = personne;
  const mots = Array.isArray(d.mots_cles) ? d.mots_cles.map((m) => propre(m, 40).toLowerCase()).filter(Boolean) : [];
  if (!mots.length) return { ok: false, pourquoi: 'mots_cles vide' };
  r.mots_cles = [...new Set(mots)].slice(0, 12);
  const passages = Array.isArray(d.passages) ? d.passages : [];
  if (type === 'photo') {
    r.passages = [];
  } else {
    const L = Number(duree_s) || null;
    r.passages = [];
    for (const p of passages) {
      // Des secondes écrites « 0,8 » entre guillemets (vu en essai réel) : la virgule française se lit comme un point.
      const nombre = (v) => Number(typeof v === 'string' ? v.trim().replace(',', '.') : v);
      const debut = Math.round(nombre(p?.debut) * 10) / 10, fin = Math.round(nombre(p?.fin) * 10) / 10;
      if (!Number.isFinite(debut) || !Number.isFinite(fin) || debut < 0 || fin <= debut) return { ok: false, pourquoi: 'passage illisible' };
      if (L && fin > L + 0.5) return { ok: false, pourquoi: 'passage après la fin du clip' };
      r.passages.push({ debut, fin: L ? Math.min(fin, Math.round(L * 10) / 10) : fin, ...(propre(p?.note, 200) ? { note: propre(p.note, 200) } : {}) });
    }
    if (!r.passages.length) return { ok: false, pourquoi: 'aucun passage utilisable' };
    r.passages.sort((a, b) => a.debut - b.debut);
  }
  return { ok: true, description: r };
}

// Le message de la courte session qui décrit un fichier (texte seulement ; les images sont jointes par le serveur).
export function consigneDescription(fiche, { prenom = 'la personne' } = {}) {
  const video = fiche.type === 'b-roll';
  const l = [
    `Tu décris ${video ? "un clip vidéo (des images prises à intervalles réguliers, l'instant de chacune est écrit juste avant)" : 'une photo'} de la Galerie de ${prenom}, un créateur de contenu qui filme son quotidien.`,
    "Cette description sert à retrouver ce fichier plus tard, quand un script demande un plan : sois concret et précis sur ce qu'on voit vraiment, n'invente rien.",
  ];
  if (fiche.origine?.genre === 'tournage' && fiche.origine.ligne) {
    l.push(`Il a été filmé pour cette ligne d'un plan de tournage : « ${fiche.origine.ligne} ». Décris ce que tu vois, même si ça ne correspond pas à cette ligne.`);
  }
  if (video && fiche.duree_s) l.push(`Le clip dure ${fiche.duree_s} s.`);
  l.push('Réponds uniquement par un objet JSON, sans texte autour, en français, tutoiement quand tu parles de lui :');
  l.push(JSON.stringify({
    titre: 'ce qu\'on voit en quelques mots, comme un titre (« Barre chargée sur le rack, vue de côté »)',
    ce_qu_on_voit: 'une ou deux phrases',
    action: video ? 'ce qui bouge ou se passe, en deux phrases au plus (« Personne ne bouge : la caméra glisse... »)' : '« Aucune : photo. » ou ce que fait la personne',
    lieu: 'le lieu (« Ta salle, zone des racks. »)',
    cadrage: 'vertical ou horizontal, plan large, moyen ou serré, angle, place libre pour un texte',
    personne_a_l_image: true,
    passages: video ? [{ debut: 1.5, fin: 4, note: 'pourquoi ce passage est bon (net, stable)' }] : [],
    mots_cles: ['5 à 10 mots simples pour la recherche'],
  }, null, 1));
  l.push('« personne_a_l_image » : true si une personne est visible, sinon false (sans guillemets).');
  if (video) l.push('« passages » : les moments propres et utilisables (image nette, sans à-coup), au moins un ; « debut » et « fin » en secondes, des nombres (1.5, pas « 1,5 »).');
  l.push('Aucun tiret long.');
  return l.join('\n');
}

// ---------------------------------------------------------------- la Galerie

export class Galerie {
  constructor(racine) {
    this.racine = racine;
    this.fichesD = path.join(racine, 'fiches');
    this.fichiersD = path.join(racine, 'fichiers');
    this.vignettesD = path.join(racine, 'vignettes');
    this.indexP = path.join(racine, 'index.json');
  }

  fiche(id) {
    if (!ID_GALERIE.test(String(id || ''))) return null;
    return lireJson(path.join(this.fichesD, `${id}.json`), null);
  }
  chemin(f) { return path.join(this.racine, f.fichier); }

  fiches() {
    let noms = [];
    try { noms = fs.readdirSync(this.fichesD); } catch { return []; }
    return noms.filter((n) => n.endsWith('.json') && ID_GALERIE.test(n.slice(0, -5)))
      .map((n) => lireJson(path.join(this.fichesD, n), null)).filter((f) => f && f.id);
  }

  // L'index : les fiches, rangées de la plus récente à la plus ancienne (arrivée).
  index() { return lireJson(this.indexP, null) || { version: 1, maj: null, fichiers: [] }; }
  reindexer() {
    const fichiers = this.fiches().sort((a, b) => String(b.ajoute_le || '').localeCompare(String(a.ajoute_le || '')) || a.id.localeCompare(b.id));
    ecrireJson(this.indexP, { version: 1, maj: isoZurich(), fichiers });
    return fichiers;
  }

  ecrireFiche(f) {
    ecrireJson(path.join(this.fichesD, `${f.id}.json`), f);
  }

  // Exécute fn sous le verrou, puis reconstruit l'index.
  sousVerrou(fn) {
    const liberer = prendreVerrouGalerie(this.racine);
    if (!liberer) { const e = new Error('galerie occupée'); e.code = 'OCCUPE'; throw e; }
    try { const r = fn(); this.reindexer(); return r; } finally { liberer(); }
  }

  // Ajoute un fichier : il est DÉPLACÉ dans GALERIE/fichiers/ (déplacer: true) ou copié. Vignettes faites ici.
  // infos : { type, nom_origine, date, duree_s, orientation, origine }. Renvoie la fiche.
  ajouter(source, infos, { copier = false, media = null, vignettes = null } = {}) {
    return this.sousVerrou(() => {
      // Le même fichier envoyé deux fois (AirDrop refait, deux « Ajouter ») : il n'entre qu'une fois, la fiche qui
      // existe sert (même taille, même contenu octet par octet). Le doublon ne reste pas où il était (sauf copie).
      const deja = this.memeFichier(source);
      if (deja) {
        if (!copier) { fs.rmSync(source, { force: true }); media?.noter({ op: 'galerie_doublon', id: deja.id, nom: path.basename(source) }); }
        return { ...deja, doublon: true };
      }
      const date = infos.date instanceof Date ? infos.date : (lireDate(infos.date) || new Date());
      let id;
      do { id = clipId(date); } while (fs.existsSync(path.join(this.fichesD, `${id}.json`)));
      const ext = path.extname(infos.nom_origine || source).toLowerCase() || path.extname(source).toLowerCase();
      const dest = path.join(this.fichiersD, `${id}${ext}`);
      fs.mkdirSync(this.fichiersD, { recursive: true });
      if (copier) fs.copyFileSync(source, dest, fs.constants.COPYFILE_EXCL);
      else if (media) media.deplacer(source, dest, 'galerie');
      else deplacer(source, dest);
      // Lecture seule : un contenu le reçoit par lien physique (même fichier) ; un outil qui écrirait dans le lien
      // (recadrage d'une photo, réencodage sur place) changerait la Galerie et tous les autres contenus.
      lectureSeule(dest);
      const vigs = [];
      if (vignettes) {
        try {
          for (const [i, src] of vignettes(dest, id).entries()) {
            const v = path.join(this.vignettesD, infos.type === 'photo' ? `${id}.jpg` : `${id}-${i + 1}.jpg`);
            fs.mkdirSync(this.vignettesD, { recursive: true });
            if (src !== v) fs.copyFileSync(src, v);
            vigs.push(path.relative(this.racine, v));
          }
        } catch { /* sans vignette : la fiche reste lisible */ }
      }
      const f = {
        version: 1, id, type: infos.type, fichier: path.relative(this.racine, dest),
        nom_origine: infos.nom_origine || path.basename(source), taille: fs.statSync(dest).size, empreinte: empreinteFichier(dest),
        duree_s: infos.type === 'b-roll' ? (infos.duree_s ?? null) : null,
        orientation: infos.orientation || null,
        pris_le: isoZurich(date), ajoute_le: isoZurich(),
        origine: infos.origine || { genre: 'ajout' },
        vignettes: vigs, description: null, description_erreur: null, utilisations: [],
      };
      this.ecrireFiche(f);
      media?.noter({ op: 'galerie_ajout', id, fichier: dest, vignettes: vigs.map((v) => path.join(this.racine, v)) });
      return f;
    });
  }

  // Une fiche dont le fichier est identique à `source` (taille, puis contenu), ou null.
  memeFichier(source) {
    let taille;
    try { taille = fs.statSync(source).size; } catch { return null; }
    const memes = this.fiches().filter((f) => f.taille === taille && fs.existsSync(this.chemin(f)));
    if (!memes.length) return null;
    const e = empreinteFichier(source);
    return memes.find((f) => (f.empreinte || empreinteFichier(this.chemin(f))) === e) || null;
  }

  // Pose le lien d'un fichier dans un contenu : <media>/<slug>/b-roll/<id>.<ext> ou photos/[slide-NN-]<id>.<ext>.
  // Lien physique (même disque), sinon copie. Note l'utilisation dans la fiche. Renvoie le chemin posé.
  lier(mediaRacine, slug, id, { slide = null, source = 'tournage', media = null } = {}) {
    if (!SLUG.test(slug)) throw Object.assign(new Error('contenu inconnu'), { code: 'CONTENU' });
    return this.sousVerrou(() => {
      const f = this.fiche(id);
      if (!f) throw Object.assign(new Error('fichier inconnu'), { code: 'INCONNU' });
      const sous = f.type === 'b-roll' ? 'b-roll' : 'photos';
      const dossier = path.join(mediaRacine, slug, sous);
      fs.mkdirSync(dossier, { recursive: true });
      const ext = path.extname(f.fichier);
      const nom = slide ? `slide-${String(slide).padStart(2, '0')}-${id}${ext}` : `${id}${ext}`;
      const dest = path.join(dossier, nom);
      if (!fs.existsSync(dest)) {
        try { fs.linkSync(this.chemin(f), dest); }
        catch (e) { if (e.code !== 'EXDEV') throw e; fs.copyFileSync(this.chemin(f), dest); }
        media?.noter({ op: 'lien_galerie', chemin: dest, id });
      }
      const u = { slug, type: f.type, le: isoZurich(), source, ...(slide ? { slide: Number(slide) } : {}) };
      const deja = (f.utilisations || []).some((x) => x.slug === slug && (x.slide || null) === (slide ? Number(slide) : null));
      if (!deja) {
        f.utilisations = [...(f.utilisations || []), u];
        this.ecrireFiche(f);
        media?.noter({ op: 'galerie_utilisation', id, slug, slide: slide ? Number(slide) : null });
      }
      return dest;
    });
  }

  // Retire le lien d'un contenu (le fichier de la Galerie reste) et l'utilisation de la fiche.
  delier(mediaRacine, slug, id, { slide = null, media = null, garderUtilisation = false } = {}) {
    return this.sousVerrou(() => {
      const f = this.fiche(id);
      const sous = f?.type === 'photo' ? 'photos' : 'b-roll';
      let retire = 0;
      for (const s of f ? [sous] : ['b-roll', 'photos']) {
        const dossier = path.join(mediaRacine, slug, s);
        let noms = [];
        try { noms = fs.readdirSync(dossier); } catch { continue; }
        for (const n of noms) {
          const l = lienVersId(n);
          if (!l || l.id !== id || (slide != null && l.slide !== Number(slide))) continue;
          const p = path.join(dossier, n);
          if (estLien(p)) continue;
          fs.unlinkSync(p);
          media?.noter({ op: 'lien_galerie_retrait', chemin: p, id, source: f ? this.chemin(f) : null });
          retire++;
        }
      }
      if (f && !garderUtilisation) {
        const avant = (f.utilisations || []).length;
        f.utilisations = (f.utilisations || []).filter((x) => !(x.slug === slug && (slide == null || (x.slide || null) === Number(slide))));
        if (f.utilisations.length !== avant) { this.ecrireFiche(f); media?.noter({ op: 'galerie_utilisation_retrait', id, slug, slide }); }
      }
      return retire;
    });
  }

  // Sort un fichier de la Galerie (b-roll devenu face caméra) : la fiche et les vignettes partent, le fichier est
  // déplacé vers `vers`. Les liens des contenus ne sont pas touchés ici.
  sortir(id, vers, { media = null } = {}) {
    return this.sousVerrou(() => {
      const f = this.fiche(id);
      if (!f) return null;
      if (media) media.deplacer(this.chemin(f), vers, 'galerie_sortie'); else deplacer(this.chemin(f), vers);
      try { fs.chmodSync(vers, 0o644); } catch { /* il redevient un fichier ordinaire du contenu */ }
      for (const v of f.vignettes || []) fs.rmSync(path.join(this.racine, v), { force: true });
      fs.rmSync(path.join(this.fichesD, `${id}.json`), { force: true });
      media?.noter({ op: 'galerie_retrait', id, fiche: f });
      return f;
    });
  }

  // Écrit une description validée (du modèle : par = "studio" ; du client : par = "toi").
  decrire(id, description, { par = 'studio', action = null } = {}) {
    return this.sousVerrou(() => {
      const f = this.fiche(id);
      if (!f) throw Object.assign(new Error('fichier inconnu'), { code: 'INCONNU' });
      f.description = { ...description, ecrite_le: isoZurich(), par, ...(action ? { action_id: action } : {}) };
      f.description_erreur = null;
      this.ecrireFiche(f);
      return f;
    });
  }

  noterErreurDescription(id, message) {
    return this.sousVerrou(() => {
      const f = this.fiche(id);
      if (!f) return null;
      f.description_erreur = { le: isoZurich(), message };
      this.ecrireFiche(f);
      return f;
    });
  }

  // Supprime pour de bon : fichier, fiche, vignettes, et les liens des contenus déjà postés ou mis de côté (sinon la
  // place n'est pas libérée). Refusé (code UTILISE) si un contenu pas encore posté s'en sert. Renvoie les octets libérés.
  supprimer(id, { mediaRacine, depot, maintenant = Date.now() }) {
    return this.sousVerrou(() => {
      const f = this.fiche(id);
      if (!f) throw Object.assign(new Error('fichier inconnu'), { code: 'INCONNU' });
      const bloquant = bloquantsSuppression(f, depot, { maintenant });
      if (bloquant.length) throw Object.assign(new Error(bloquant[0]), { code: 'UTILISE', slug: bloquant[0] });
      const taille = f.taille || 0;
      for (const u of f.utilisations || []) {
        for (const sous of ['b-roll', 'photos']) {
          const dossier = path.join(mediaRacine, u.slug, sous);
          let noms = [];
          try { noms = fs.readdirSync(dossier); } catch { continue; }
          for (const n of noms) if (lienVersId(n)?.id === id && !estLien(path.join(dossier, n))) fs.rmSync(path.join(dossier, n), { force: true });
        }
      }
      fs.rmSync(this.chemin(f), { force: true });
      for (const v of f.vignettes || []) fs.rmSync(path.join(this.racine, v), { force: true });
      fs.rmSync(path.join(this.fichesD, `${id}.json`), { force: true });
      return taille;
    });
  }
}

// ---------------------------------------------------------------- posté, pas posté ; la règle des 3 vidéos

// Les publications sorties (statut « publié », ou « programmé » dont l'heure est passée), par date croissante.
export function postes(depot, { maintenant = Date.now() } = {}) {
  const reg = lireJson(path.join(depot, 'publications', 'registre.json'), {})?.publications || {};
  const r = [];
  for (const [slug, e] of Object.entries(reg)) {
    if (!e || !['publié', 'programmé'].includes(e.statut)) continue;
    const quand = lireDate(e.publie_le) || lireDate(e.prevu_le) || lireDate(e.enregistre_le);
    if (e.statut === 'programmé' && (!quand || quand.getTime() > maintenant)) continue;
    const etat = lireJson(path.join(depot, 'contenus', slug, 'etat.json'), null);
    const format = etat?.format === 'carrousel' || (!etat && fs.existsSync(path.join(depot, 'rendus', 'carrousels', `${slug}.md`))) ? 'carrousel' : 'reel';
    r.push({ slug, quand: quand ? quand.getTime() : 0, format });
  }
  return r.sort((a, b) => a.quand - b.quand || a.slug.localeCompare(b.slug));
}

function existeContenu(depot, slug) {
  return fs.existsSync(path.join(depot, 'contenus', slug)) || fs.existsSync(path.join(depot, 'a-rendre', 'carrousels', `${slug}.md`))
    || fs.existsSync(path.join(depot, 'rendus', 'carrousels', `${slug}.md`));
}
function misDeCote(depot, slug) {
  return Boolean(lireJson(path.join(depot, 'contenus', slug, 'etat.json'), null)?.refuse);
}

// Les contenus pas encore postés (ni mis de côté) qui se servent de ce fichier : ils empêchent la suppression. Un brief
// qui compte dessus sans l'avoir encore reçu (plan pris dans la Galerie, lien posé seulement avant le montage) aussi.
export function bloquantsSuppression(f, depot, { maintenant = Date.now(), reservations = null } = {}) {
  const sortis = new Set(postes(depot, { maintenant }).map((p) => p.slug));
  const parStock = ((reservations || reservationsStock(depot)).get(f.id) || []).map((r) => r.slug);
  return [...new Set([...(f.utilisations || []).map((u) => u.slug), ...parStock])]
    .filter((s) => !sortis.has(s) && existeContenu(depot, s) && !misDeCote(depot, s));
}

// Les plans des briefs qui comptent sur un fichier de la Galerie (stock.json à jour du brief, choix du client) sans
// l'avoir encore reçu : id -> [{ slug, le }]. Le lien n'est posé qu'avant le montage ; sans ceci, deux briefs comparés
// l'un après l'autre prenaient le même plan, et le second partait au tournage sans lui au moment du montage.
export function reservationsStock(depot) {
  const r = new Map();
  let slugs = [];
  try { slugs = fs.readdirSync(path.join(depot, 'contenus')); } catch { return r; }
  for (const slug of slugs) {
    if (!SLUG.test(slug)) continue;
    const st = stockAJour(depot, slug);
    if (!st) continue;
    const choix = lireJson(path.join(depot, 'contenus', slug, 'stock-choix.json'), null)?.plans || {};
    const le0 = st.comparaison?.fait_le || st.essentiel_fixe_le || null;
    for (const p of st.plans) {
      if (!p || !Number.isInteger(Number(p.n))) continue;
      const c = choixDuPlan(choix, p);
      if (c?.choix === 'tourner') continue;
      const id = c?.choix === 'stock' ? c.id : p.stock?.id;
      if (!ID_GALERIE.test(String(id || ''))) continue;
      const le = c?.choix === 'stock' ? c.le || le0 : le0;
      r.set(id, [...(r.get(id) || []), { slug, le }]);
    }
  }
  return r;
}

// stock.json d'un reel s'il est à jour de son brief (même empreinte des plans), sinon null.
function stockAJour(depot, slug) {
  const dossier = path.join(depot, 'contenus', slug);
  const stock = lireJson(path.join(dossier, 'stock.json'), null);
  if (!stock || !Array.isArray(stock.plans)) return null;
  if (stock.plans_empreinte) {
    let script = '';
    try { script = fs.readFileSync(path.join(dossier, 'script.md'), 'utf8'); } catch { /* pas de brief : rien à comparer */ }
    if (empreintePlans(script) !== stock.plans_empreinte) return null;
  }
  return stock;
}

// Le choix du client pour ce plan, s'il porte bien sur lui : il est rangé par numéro, et un brief retouché (plan inséré
// ou retiré) donne ce numéro à un autre plan. Un choix qui garde le texte de son plan ne vaut que pour ce texte.
const sansEspaces = (t) => String(t || '').normalize('NFC').replace(/\s+/g, ' ').trim();
function choixDuPlan(choix, p) {
  const c = choix?.[String(Number(p.n))] || null;
  if (!c) return null;
  if (c.texte != null && sansEspaces(c.texte) !== sansEspaces(p.texte)) return null;
  return c;
}

// Avant ou après : deux dates ISO (fuseaux différents possibles), puis le nom du contenu pour départager.
function avant(a, b) {
  const ta = lireDate(a.le)?.getTime() ?? Infinity, tb = lireDate(b.le)?.getTime() ?? Infinity;
  return ta < tb || (ta === tb && a.slug < b.slug);
}

// La règle des 3 vidéos, calculée sur le registre des publications (jamais de mémoire) : pour chaque fichier,
// sa dernière vidéo postée (il_y_a = 1 pour la dernière vidéo sortie du compte), les contenus pas encore postés
// qui le réservent, et s'il peut resservir à `pour` (un slug, facultatif). Les photos de carrousel resservent sans
// limite ; la règle vaut pour les b-rolls.
export function ecart(f, depot, { pour = null, maintenant = Date.now(), sorties = null, reservations = null } = {}) {
  const liste = sorties || postes(depot, { maintenant });
  const videos = liste.filter((p) => p.format === 'reel');
  const slugs = [...new Set((f.utilisations || []).map((u) => u.slug))];
  const sortis = new Set(liste.map((p) => p.slug));
  let derniere = null;
  videos.forEach((p, i) => { if (slugs.includes(p.slug)) derniere = { slug: p.slug, le: isoZurich(new Date(p.quand)), il_y_a: videos.length - i }; });
  const postees = videos.filter((p) => slugs.includes(p.slug)).length;
  const libre = (s) => s !== pour && !sortis.has(s) && existeContenu(depot, s) && !misDeCote(depot, s);
  const reserveLiens = slugs.filter(libre);
  // Les briefs qui comptent dessus sans l'avoir reçu : le premier qui l'a pris le garde (date de sa comparaison ou du
  // choix du client) ; pour un contenu qui ne l'a pas pris, tous comptent.
  const prises = f.type === 'b-roll' ? ((reservations || reservationsStock(depot)).get(f.id) || []) : [];
  const mien = prises.filter((x) => x.slug === pour).sort((a, b) => (avant(a, b) ? -1 : 1))[0] || null;
  const parStock = prises.filter((x) => libre(x.slug) && (!mien || avant(x, mien))).map((x) => x.slug);
  const reserve = [...new Set([...reserveLiens, ...parStock])];
  let reutilisable = true, raison = null;
  if (f.type === 'b-roll') {
    if (reserve.length) { reutilisable = false; raison = 'reserve'; }
    else if (derniere && derniere.il_y_a < ECART_MIN && derniere.slug !== pour) { reutilisable = false; raison = 'recent'; }
  }
  return { videos_postees: postees, derniere, reserve, reserve_liens: reserveLiens, reutilisable, raison, attendre: raison === 'recent' ? ECART_MIN - derniere.il_y_a : 0 };
}

// ---------------------------------------------------------------- le stock d'un brief (format de la phase 2)

// DEPOT/contenus/<slug>/stock.json (écrit par le head of content) et stock-choix.json (écrit par le studio, les
// boutons du client) : les plans effectifs, déjà en stock ou à tourner. Déterministe, lu sur les fichiers.
// L'empreinte des plans d'un brief, calculée comme outils/stock.py du head of content : la section « Plans à tourner »
// de script.md, lignes sans espaces autour ni lignes vides. stock.json la garde : des plans changés depuis (retouche
// du client) rendent sa comparaison caduque, le brief se montre alors comme avant jusqu'à la nouvelle comparaison.
export function empreintePlans(texte) {
  const sansAccents = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/’/g, "'").toLowerCase();
  const lignes = [];
  let dans = false, code = false;
  for (const l of String(texte || '').replace(/\r\n/g, '\n').split('\n')) {
    if (l.startsWith('```')) code = !code;
    const m = code ? null : /^##\s+(.+?)\s*$/.exec(l);
    if (m) {
      if (dans) break;
      dans = sansAccents(m[1]).replace(/\s+/g, ' ').trim().startsWith('plans a tourner');
      continue;
    }
    if (dans && l.trim()) lignes.push(l.trim());
  }
  return `sha256:${crypto.createHash('sha256').update(lignes.join('\n')).digest('hex').slice(0, 16)}`;
}

// Les plans d'un brief, numérotés comme outils/stock.py du head of content (plans_du_script) : la section « Plans à
// tourner » (sinon, dans un ancien script, « À filmer en plus » puis « Photos à envoyer »), une entrée par ligne qui
// commence par « Vidéo » ou « Photo », dans l'ordre ; les lignes vides et les autres lignes ne comptent pas.
const sansAccentsMin = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/’/g, "'").toLowerCase();
export function plansDuScript(texte) {
  const sections = {};
  let cle = null, code = false;
  for (const l of String(texte || '').replace(/\r\n/g, '\n').split('\n')) {
    if (l.startsWith('```')) code = !code;
    const m = code ? null : /^##\s+(.+?)\s*$/.exec(l);
    if (m) {
      const t = sansAccentsMin(m[1]).replace(/\s+/g, ' ').trim();
      cle = t.startsWith('plans a tourner') ? 'plans' : t.startsWith('a filmer en plus') ? 'a_filmer' : t.startsWith('photos a envoyer') ? 'photos' : null;
      if (cle && sections[cle]) cle = `_${cle}`;   // seule la première section de ce nom compte (comme brief.py)
      if (cle) sections[cle] = [];
      continue;
    }
    if (cle) sections[cle].push(l);
  }
  let lignes;
  if (sections.plans) lignes = sections.plans;
  else {
    const photos = (sections.photos || []).map((l) => l.trim()).filter((l) => l && !/^[-*\s(]*rien[\s.)]*$/i.test(l))
      .map((l) => l.replace(/^[-*]\s*/, '')).map((l) => (sansAccentsMin(l).startsWith('photo') ? l : `Photo : ${l}`));
    lignes = [...(sections.a_filmer || []), ...photos];
  }
  const plans = [];
  for (const l of lignes) {
    const s = l.replace(/^\s*[-*]\s*/, '').trim();
    const tete = sansAccentsMin(s.slice(0, 12)).replace(/[^a-z0-9]+/g, ' ').trim();
    if (!tete.startsWith('video') && !tete.startsWith('photo')) continue;
    const d = /^vid[ée]o\s*,\s*(\d+(?:[.,]\d+)?)\s*s\b/i.exec(s);
    const pour = /\bPour\b(.*)$/.exec(s);
    const q = pour ? /[«"“]\s*(.+?)\s*[»"”]/.exec(pour[1]) : null;
    plans.push({ n: plans.length + 1, type: tete.startsWith('photo') ? 'photo' : 'b-roll', texte: s,
      phrase: q ? q[1] : null, duree_s: d ? Number(d[1].replace(',', '.')) : null });
  }
  return plans;
}

// Les plans que le client a retirés de son brief (outils/brief.py, « retires » de stock-choix.json) et qui n'y sont pas
// revenus depuis : le plan de tournage déjà écrit ne les demande plus.
export function plansRetires(depot, slug) {
  const retires = lireJson(path.join(depot, 'contenus', slug, 'stock-choix.json'), null)?.retires;
  if (!Array.isArray(retires) || !retires.length) return [];
  let script = '';
  try { script = fs.readFileSync(path.join(depot, 'contenus', slug, 'script.md'), 'utf8'); } catch { return []; }
  const actuels = plansDuScript(script);
  const cle = (t) => String(t || '').replace(/\s+/g, ' ').trim();
  return retires.filter((r) => r && (r.type === 'photo' || r.phrase)
    && !actuels.some((p) => cle(p.texte) === cle(r.texte) || (r.type !== 'photo' && p.type === r.type && memePhrase(p.phrase, r.phrase))));
}

// Retire d'un plan de tournage ce qui ne sert plus qu'à des plans retirés du brief : une phrase d'une prise, le
// mouvement qui ne servait qu'elle, la prise entière s'il ne lui reste rien ; une photo par photo retirée (la plus
// proche de sa description). Les prises déjà filmées ne passent pas par ici : le studio refuse de retirer leur plan.
function sansRetires(config, prises, contenus) {
  let r = prises;
  for (const slug of contenus) {
    if (!SLUG.test(String(slug || ''))) continue;
    let retires;
    try { retires = plansRetires(config.depot, slug); } catch { retires = []; }
    if (!retires.length) continue;
    const phrases = retires.filter((x) => x.type !== 'photo').map((x) => x.phrase);
    r = r.flatMap((p) => {
      if (p.type !== 'b-roll' || p.deja_en_bibliotheque) return [p];
      const avaient = new Set((p.contenus || []).flatMap((c) => (c.usages || []).map((u) => u.mouvement || 1)));
      const contenusP = (p.contenus || []).map((c) => c.slug !== slug ? c
        : { ...c, usages: (c.usages || []).filter((u) => !phrases.some((ph) => memePhrase(ph, u.phrase))) });
      const ont = new Set(contenusP.flatMap((c) => (c.usages || []).map((u) => u.mouvement || 1)));
      const gardes = (p.mouvements || []).map((m, i) => i + 1).filter((i) => !avaient.has(i) || ont.has(i));
      if (!ont.size && avaient.size) return [];
      if (gardes.length === (p.mouvements || []).length && contenusP.every((c, i) => c.usages.length === (p.contenus[i].usages || []).length)) return [p];
      const nouveau = new Map(gardes.map((i, k) => [i, k + 1]));
      return [{ ...p, mouvements: gardes.map((i) => p.mouvements[i - 1]),
        contenus: contenusP.filter((c) => c.slug !== slug || c.usages.length || !(p.contenus.find((x) => x.slug === slug)?.usages || []).length)
          .map((c) => ({ ...c, usages: (c.usages || []).map((u) => ({ ...u, mouvement: nouveau.get(u.mouvement || 1) || 1 })) })) }];
    });
    const photosRetirees = retires.filter((x) => x.type === 'photo');
    if (photosRetirees.length) {
      let script = '';
      try { script = fs.readFileSync(path.join(config.depot, 'contenus', slug, 'script.md'), 'utf8'); } catch { /* rien */ }
      const voulues = plansDuScript(script).filter((x) => x.type === 'photo').length;
      const pp = r.filter((p) => p.type === 'photo' && !p.deja_en_bibliotheque && (p.contenus || []).length === 1 && p.contenus[0].slug === slug);
      const mots = (t) => new Set(normPhrase(t).split(' ').filter((m) => m.length > 3));
      const enlever = new Set();
      for (const x of photosRetirees.slice(0, Math.max(0, pp.length - voulues))) {
        const mx = mots(String(x.texte || '').replace(/^\s*photo\s*:?\s*/i, ''));
        const choix = pp.filter((p) => !enlever.has(p))
          .map((p) => ({ p, score: [...mots(p.ce_qu_on_voit)].filter((m) => mx.has(m)).length }))
          .sort((a, b) => b.score - a.score)[0];
        if (choix) enlever.add(choix.p);
      }
      r = r.filter((p) => !enlever.has(p));
    }
  }
  return r;
}

export function plansEffectifs(config, slug, { galerie = new Galerie(dossierGalerie(config)), maintenant = Date.now(), reservations = null } = {}) {
  const dossier = path.join(config.depot, 'contenus', slug);
  const stock = stockAJour(config.depot, slug);
  if (!stock) return null;
  const choix = lireJson(path.join(dossier, 'stock-choix.json'), null)?.plans || {};
  const sorties = postes(config.depot, { maintenant });
  const resa = reservations || reservationsStock(config.depot);
  return stock.plans.filter((p) => p && Number.isInteger(Number(p.n))).map((p) => {
    const n = Number(p.n);
    const c = choixDuPlan(choix, p);
    const base = { n, type: p.type === 'photo' ? 'photo' : 'b-roll', texte: String(p.texte || ''), phrase: p.phrase || null,
      essentiel: p.essentiel || null, detail: p.detail || null, duree_s: Number(p.duree_s) || null };
    if (c?.choix === 'tourner') return { ...base, etat: 'a_tourner', par: 'toi', note: p.manque || null, proposition: p.stock?.id || null };
    const pris = c?.choix === 'stock' ? { id: c.id, debut: c.debut ?? null, fin: c.fin ?? null, pourquoi: null, par: 'toi' }
      : p.stock?.id ? { id: p.stock.id, debut: p.stock.debut ?? null, fin: p.stock.fin ?? null, pourquoi: p.stock.pourquoi || null, par: 'proposition' } : null;
    const f = pris ? galerie.fiche(pris.id) : null;
    if (!pris) return { ...base, etat: 'a_tourner', note: p.manque || null };
    if (!f) return { ...base, etat: 'a_tourner', note: "Le fichier prévu n'est plus dans ta Galerie : celui-là, il faut le faire." };
    const e = ecart(f, config.depot, { pour: slug, sorties, reservations: resa });
    // Le choix du client ne prend qu'un fichier du bon genre (un choix d'avant pour un plan changé depuis).
    if (f.type !== base.type) return { ...base, etat: 'a_tourner', note: p.manque || null };
    if (!e.reutilisable && pris.par === 'proposition') {
      return { ...base, etat: 'a_tourner', note: e.raison === 'reserve' ? 'Le plan prévu sert déjà à un autre contenu pas encore posté : celui-là, il faut le faire.'
        : `Le plan prévu est passé dans une vidéo trop récente : celui-là, il faut le faire.` };
    }
    return { ...base, etat: 'stock', stock: { ...pris, id: f.id }, ecart: e };
  });
}

// Pose (ou retire) les liens des plans pris dans la Galerie pour ce reel : seuls les liens posés par le stock
// (source « stock ») sont retirés quand le plan repasse à tourner.
export function relierStock(config, slug, { galerie = new Galerie(dossierGalerie(config)) } = {}) {
  const plans = plansEffectifs(config, slug, { galerie }) || [];
  const voulus = new Set(plans.filter((p) => p.etat === 'stock').map((p) => p.stock.id));
  const faits = [];
  for (const id of voulus) {
    const f = galerie.fiche(id);
    if (!f) continue;
    if ((f.utilisations || []).some((u) => u.slug === slug)) continue;
    galerie.lier(config.media, slug, id, { source: 'stock' });
    faits.push(`LIE ${id} -> ${slug}`);
  }
  for (const f of galerie.fiches()) {
    if (voulus.has(f.id)) continue;
    if ((f.utilisations || []).some((u) => u.slug === slug && u.source === 'stock')) {
      galerie.delier(config.media, slug, f.id);
      faits.push(`DELIE ${f.id} -> ${slug}`);
    }
  }
  return faits;
}

// ---------------------------------------------------------------- le plan de tournage face au stock

// Même règle que tournage.py (meme_phrase) : deux phrases égales sans accents ni ponctuation, ou l'une dans l'autre.
function normPhrase(t) {
  return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/’/g, "'").toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
export function memePhrase(a, b) {
  const x = normPhrase(a), y = normPhrase(b);
  if (!x || !y) return false;
  return x === y || (Math.min(x.length, y.length) >= 8 && (x.includes(y) || y.includes(x)));
}

// Ce que montre un plan du brief, sans « Vidéo, 3 s : » devant ni « Pour « ... » » derrière.
function sujetDuPlan(texte) {
  return String(texte || '').replace(/^\s*(?:vid[ée]o|photo)\b[^:]*:\s*/i, '').replace(/\s*[.,;]?\s*Pour\s*[«"“].*$/i, '').trim() || String(texte || '').trim();
}

// Les prises d'un plan de tournage telles qu'elles valent maintenant (lot 15) : le plan de tournage est écrit une fois,
// mais le client peut encore choisir dans la Galerie. Une prise dont tous les plans sont désormais pris dans la Galerie
// n'est plus à tourner (en_galerie) ; un plan passé « à tourner » après coup (« J'en tourne un nouveau ») qu'aucune prise
// ne couvre devient une prise ajoutée (ajoutee, numéro stable : 1000 + 100 x rang du contenu + numéro du plan).
// B-rolls : par la phrase du plan (comme tournage.py verifier) ; photos : par leur nombre. Sans stock.json : rien ne change.
export function prisesEffectives(config, t, { galerie = null } = {}) {
  const contenus = Array.isArray(t?.contenus) ? t.contenus : [];
  // Les plans retirés du brief après coup (bouton « Retirer » ou retouche) ne se tournent plus.
  const prises = sansRetires(config, (t?.prises || []).map((p) => ({ ...p })), contenus);
  const g = galerie || new Galerie(dossierGalerie(config));
  let resa = null;
  const couverts = new Map();   // n -> slugs pour lesquels la prise n'a plus rien à montrer
  const ajoutees = [];
  contenus.forEach((slug, k) => {
    if (!SLUG.test(String(slug || ''))) return;
    let plans = null;
    try { plans = plansEffectifs(config, slug, { galerie: g, reservations: resa ||= reservationsStock(config.depot) }); } catch { plans = null; }
    if (!plans) return;
    const phrasesDe = (p) => (p.contenus || []).filter((c) => c.slug === slug).flatMap((c) => (c.usages || []).map((u) => u.phrase).filter(Boolean));
    const ajouter = (plan, type) => ajoutees.push({
      n: 1000 + 100 * k + plan.n, type, contenus: [{ slug, usages: plan.phrase ? [{ phrase: plan.phrase, mouvement: 1 }] : [] }],
      lieu: null, materiel: [], ce_qu_on_voit: sujetDuPlan(plan.texte), mouvements: type === 'b-roll' ? [sujetDuPlan(plan.texte)] : [],
      duree_s: plan.duree_s || null, deja_en_bibliotheque: null, ajoutee: true,
    });
    // B-rolls : par la phrase.
    const bp = plans.filter((x) => x.type === 'b-roll');
    const enStock = bp.filter((x) => x.etat === 'stock'), aTourner = bp.filter((x) => x.etat === 'a_tourner');
    const pb = prises.filter((p) => p.type === 'b-roll' && (p.contenus || []).some((c) => c.slug === slug));
    for (const p of pb) {
      const ph = phrasesDe(p);
      if (!ph.length) continue;
      if (ph.every((x) => enStock.some((s) => memePhrase(s.phrase, x)) && !aTourner.some((a) => memePhrase(a.phrase, x)))) {
        couverts.set(p.n, new Set([...(couverts.get(p.n) || []), slug]));
      }
    }
    for (const a of aTourner) {
      if (!a.phrase || pb.some((p) => phrasesDe(p).some((x) => memePhrase(a.phrase, x)))) continue;
      ajouter(a, 'b-roll');
    }
    // Photos : autant de prises que de photos à prendre (tournage.py verifier compte les photos).
    const photosATourner = plans.filter((x) => x.type === 'photo' && x.etat === 'a_tourner');
    const pp = prises.filter((p) => p.type === 'photo' && !p.deja_en_bibliotheque && (p.contenus || []).length === 1 && p.contenus[0].slug === slug);
    if (pp.length > photosATourner.length) {
      for (const p of pp.slice(photosATourner.length)) couverts.set(p.n, new Set([slug]));
    } else if (photosATourner.length > pp.length) {
      for (const a of photosATourner.slice(pp.length)) ajouter(a, 'photo');
    }
  });
  for (const p of prises) {
    const c = couverts.get(p.n);
    if (c && (p.contenus || []).every((x) => c.has(x.slug))) p.en_galerie = true;
  }
  const nums = new Set(prises.map((p) => p.n));
  return [...prises, ...ajoutees.filter((p) => !nums.has(p.n))];
}

// Écrit le choix du client pour un plan (« J'en tourne un nouveau », « Prends plutôt celui-là »).
export function ecrireChoixPlan(config, slug, n, choix, { texte = null } = {}) {
  const p = path.join(config.depot, 'contenus', slug, 'stock-choix.json');
  const d = lireJson(p, null) || { version: 1, plans: {} };
  d.plans = d.plans || {};
  // Le texte du plan est gardé avec le choix : un brief retouché qui renumérote les plans ne le reporte pas sur un autre.
  if (choix === null) delete d.plans[String(n)];
  else d.plans[String(n)] = { ...choix, ...(texte ? { texte } : {}), le: isoZurich() };
  ecrireJson(p, d);
  return d;
}

// Les photos posées pour chaque slide d'un carrousel (liens slide-NN-<id> de MEDIA/<slug>/photos/).
export function photosDesSlides(mediaRacine, slug) {
  const r = {};
  let noms = [];
  try { noms = fs.readdirSync(path.join(mediaRacine, slug, 'photos')); } catch { return r; }
  for (const n of noms.sort()) {
    const l = lienVersId(n);
    if (l?.slide) (r[l.slide] ||= []).push(l.id);
  }
  return r;
}

// ---------------------------------------------------------------- utilitaires d'entrée

// Les infos d'un fichier qui entre : type (photo | b-roll), date de prise, durée et orientation.
export function infosEntree(chemin, nom = path.basename(chemin)) {
  const genre = typeFichier(nom);
  if (genre === 'photo') {
    const st = fs.statSync(chemin);
    return { type: 'photo', date: st.mtime, duree_s: null, orientation: null };
  }
  if (genre !== 'video') return null;
  const m = sonder(chemin);
  if (!m) return null;
  return { type: 'b-roll', date: m.date || fs.statSync(chemin).mtime, duree_s: m.duree_s, duree: m.duree, orientation: m.orientation };
}

export function empreinteCourte(texte) {
  return crypto.createHash('sha256').update(String(texte)).digest('hex').slice(0, 12);
}
