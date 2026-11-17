// Publication depuis le studio (CONTRAT-STUDIO.md, sections 7, 10 et 12). Node 24, sans dépendance.
//
//   recap(elements, config)          vérifie chaque contenu avec `zernio.py verifier` et rend l'objet de
//                                    POST /api/publication/recap ; le récapitulatif est gardé ici (recap_id)
//   confirmer(recap_id, config)      publie ce récapitulatif-là, et seulement lui, une seule fois
//   semaine(lundi, config, cartes)   propose une date par contenu monté (ou mis en page) non programmé,
//                                    puis rend recap(...) de ces propositions
//
// Sécurité :
//   - `--envoyer` n'est passé que par confirmer(), hors simulation, et ZERNIO_ECRITURE_ROMAIN=oui n'est
//     posé que sur cet appel-là (il est retiré de l'environnement de tous les autres).
//   - Simulation : config.publication.simulation === true, ou STUDIO_SIMULATION=1 (prioritaire). Alors
//     confirmer() lance `publier` sans --envoyer ni --pousser : rien ne part, rien n'est écrit (verifier
//     --pousser aligne seulement la copie des scripts du Mac, depot_mac, sur le dépôt en ligne).
//   - Un récapitulatif sert une fois, expire au bout de 30 minutes, et confirmer() revérifie que la vidéo
//     et la légende sont celles qui ont été montrées. Après une erreur d'envoi, rien n'est relancé.

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { developper, lierSlides, slidesDe, slugValide } from './carrousels.mjs';

export const RECAP_MINUTES = 30;
const MONTE = /-monte(?:-\d+)?\.mp4$/;
const QUAND = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre',
  'octobre', 'novembre', 'décembre'];

const recaps = new Map();

export class ErreurPublication extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
  versApi() { return { erreur: this.code, message: this.message }; }
}

// Pour les tests.
export function oublierRecaps() { recaps.clear(); }

export function enSimulation(config) {
  if (process.env.STUDIO_SIMULATION === '1') return true;
  return !!(config && config.publication && config.publication.simulation === true);
}

// ------------------------------------------------------------------ heure de Zurich

function decalageZurich(ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Zurich', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const vu = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return vu - Math.floor(ms / 1000) * 1000;
}

// "AAAA-MM-JJ HH:MM" (heure de Zurich) -> Date, ou null si illisible.
export function dateZurich(quand) {
  const m = QUAND.exec(quand || '');
  if (!m) return null;
  const naif = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let t = naif - decalageZurich(naif);
  t = naif - decalageZurich(t);
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

function partiesZurich(date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Zurich', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short',
  }).formatToParts(date).map((x) => [x.type, x.value]));
  return p;
}

// "mardi 18 novembre à 18 h 30"
export function quandLisible(quand) {
  if (quand === 'maintenant') return 'maintenant';
  const m = QUAND.exec(quand || '');
  if (!m) return quand || '';
  const jour = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
  return `${JOURS[jour]} ${+m[3]} ${MOIS[+m[2] - 1]} à ${+m[4]} h ${m[5]}`;
}

// ------------------------------------------------------------------ lancer zernio.py

// depot : la copie de travail du studio (DEPOT), où on lit titres et formats ; depotMac : la copie
// des scripts du Mac, la seule où zernio.py tourne (il l'aligne de force sur le dépôt en ligne :
// contrat, section 12). Le serveur pousse DEPOT avant et le tire après.
export const DEPOT_MAC_DEFAUT = '~/.montage-yoan/head-of-content';

function chemins(config) {
  const depot = path.resolve(developper(config.depot_hoc));
  const depotMac = path.resolve(developper(config.depot_mac || DEPOT_MAC_DEFAUT));
  return { depot, depotMac, media: path.resolve(developper(config.media)), zernio: path.join(depotMac, 'outils', 'zernio.py') };
}

function environnement(depot, ecriture) {
  const env = { ...process.env, HOC_DEPOT: depot, PYTHONIOENCODING: 'utf-8' };
  delete env.ZERNIO_ECRITURE_ROMAIN;
  if (ecriture) env.ZERNIO_ECRITURE_ROMAIN = 'oui';
  return env;
}

// Lance zernio.py dans son propre groupe de processus ; rend { code, sortie }.
export function lancerZernio(config, args, { ecriture = false, timeoutMs = 120000 } = {}) {
  const { depotMac: depot, zernio } = chemins(config);
  return new Promise((resolve) => {
    let sortie = '';
    let fini = false;
    const p = spawn('python3', [zernio, ...args], {
      cwd: depot, env: environnement(depot, ecriture), detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    const minuterie = setTimeout(() => {
      try { process.kill(-p.pid, 'SIGTERM'); } catch { /* déjà fini */ }
    }, timeoutMs);
    p.stdout.on('data', (b) => { sortie += b; });
    p.stderr.on('data', (b) => { sortie += b; });
    const finir = (code) => {
      if (fini) return;
      fini = true;
      clearTimeout(minuterie);
      resolve({ code, sortie });
    };
    p.on('error', (e) => { sortie += String(e); finir(-1); });
    p.on('close', (code) => finir(code));
  });
}

// ------------------------------------------------------------------ lire la sortie de verifier

// Sortie de `zernio.py verifier` (fonction rapport) :
//   CONTENU <slug> (<type>) sur @<compte>
//   LEGENDE (<source>, <n> caractères) :
//   <la légende, n caractères, sur plusieurs lignes>
//   MEDIA <fichier> (<taille> Mo)            (0 à 20 lignes)
//   MOT <MOT> | MOT aucun (...)
//   ATTENTION <texte>                          (0 à n)
//   BLOQUE <texte>                             (0 à n)
//   OK prêt                                    (si aucun BLOQUE ; code de sortie 0, sinon 1)
export function lireVerifier(sortie) {
  const r = { legende: null, mot: null, attention: [], bloque: [], ok: false, medias: [] };
  let reste = sortie;
  const m = /^LEGENDE \((.*), (\d+) caractères\) :\n/m.exec(sortie);
  if (m) {
    const apres = Array.from(sortie.slice(m.index + m[0].length));
    r.legende = apres.slice(0, +m[2]).join('');
    reste = sortie.slice(0, m.index) + '\n' + apres.slice(+m[2]).join('');
  }
  for (const ligne of reste.split('\n')) {
    if (ligne.startsWith('ATTENTION ')) r.attention.push(ligne.slice(10).trim());
    else if (ligne.startsWith('BLOQUE ')) r.bloque.push(ligne.slice(7).trim());
    else if (ligne.startsWith('MEDIA ')) r.medias.push(ligne.slice(6).trim());
    else if (ligne.startsWith('MOT ')) {
      const mot = ligne.slice(4).trim();
      r.mot = /^[A-Z]{2,}$/.test(mot) ? mot : null;
    } else if (ligne.trim() === 'OK prêt') r.ok = true;
  }
  return r;
}

// ------------------------------------------------------------------ phrases pour Romain

// Chaque BLOQUE / ATTENTION de zernio.py (fonctions preparer, heure_publication) et chaque code
// d'arrêt de cmd_publier / appel / main, traduit en une phrase claire. Les motifs suivent le texte
// exact du script : un texte inconnu donne une phrase générique, jamais le message brut.
const BLOQUES = [
  [/^slug invalide/, () => "Ce contenu a un nom que je ne reconnais pas : préviens Yoan."],
  [/^légende : .*introuvable|^légende : pas de section|^légende : aucun texte de carrousel/,
    () => "Il n'y a pas encore de légende validée pour ce contenu : demande-la à ton head of content dans la carte."],
  [/^légende : /, () => "Je ne trouve pas la légende de ce contenu : demande-la à ton head of content dans la carte."],
  [/^légende provisoire/, () => "La légende de ce contenu n'est pas encore écrite (il n'y a qu'un texte d'attente) : demande-la à ton head of content dans la carte, puis valide-la."],
  [/tiret long/, () => 'La légende contient un tiret long : demande à ton head of content de le remplacer.'],
  [/^légende trop longue : (\d+)/, (m) => `La légende est trop longue pour Instagram (${m[1]} caractères, 2200 au plus) : demande à ton head of content de la raccourcir.`],
  [/^--video manquant|^vidéo introuvable/, () => "Je ne trouve pas la vidéo montée de ce contenu sur ton Mac."],
  [/^la vidéo doit être en/, () => "La vidéo n'est pas dans un format qu'Instagram accepte : refais le montage."],
  [/^vidéo trop lourde : (\d+)/, (m) => `La vidéo est trop lourde pour Instagram (${m[1]} Mo, 300 au plus).`],
  [/^carrousel pas encore mis en page/, () => "Le carrousel n'est pas encore mis en page : clique sur « mettre en page » dans sa carte."],
  [/^dossier des slides introuvable|^aucune slide-/, () => "Je ne retrouve pas les images du carrousel sur ton Mac : refais la mise en page."],
  [/^un carrousel a 2 à 20 slides \((\d+)/, (m) => `Un carrousel doit avoir entre 2 et 20 images (il en a ${m[1]}).`],
  [/^les slides n'ont pas toutes la même taille/, () => "Les images du carrousel n'ont pas toutes la même taille : refais la mise en page."],
  [/^déjà (programmé|publié) le (.+?) \(zernio_post/, (m) => `Ce contenu est déjà ${m[1]} (${dateCourte(m[2])}). Pour le décaler, préviens Yoan.`],
  [/^le mot (\S+) n'est pas en attente/, (m) => `Le message automatique du mot ${m[1]} n'est pas prêt : demande à ton head of content de le mettre en attente, sinon personne ne recevra ta ressource.`],
  [/^le mot (\S+) ne sera pas branché \((.*)\) :/, (m) => `Le mot ${m[1]} ne pourra pas encore envoyer ta ressource (${m[2]}) : la légende promettrait un message que personne ne recevrait. Attends que ce soit réglé, ou demande à ton head of content une légende sans le mot.`],
  [/^le mot du script \((\S+)\) n'est pas celui en attente \((\S+)\)/, (m) => `Le mot de ton script (${m[1]}) n'est pas celui qui attend (${m[2]}) : demande à ton head of content de remettre le bon mot en attente.`],
];

const ATTENTIONS = [
  [/^le fichier ne finit pas par -monte\.mp4/, () => "Cette vidéo ne porte pas le nom d'une vidéo montée : vérifie que c'est la bonne."],
  [/^message automatique pas encore en service/, () => "Les messages automatiques ne sont pas encore en service : vérifie que la légende ne promet pas d'envoyer quelque chose en message."],
  [/^la légende ne cite pas le mot (\S+)/, (m) => `La légende ne cite pas le mot ${m[1]} : il sera cherché dans ce que tu dis dans la vidéo.`],
  [/^la légende semble demander un mot en commentaire/, () => "La légende demande de commenter un mot, mais aucun message automatique n'est prévu pour ce contenu : personne ne recevrait rien."],
];

const ARRETS = [
  [/^QUAND_PASSE/, () => "L'heure choisie est déjà passée, ou dans moins de 10 minutes : choisis une heure plus tard."],
  [/^QUAND_ILLISIBLE|^QUAND_MANQUANT/, () => "Je n'ai pas compris la date choisie : choisis-la à nouveau."],
  [/^VERROU/, () => "Rien n'est parti : la publication n'a pas été autorisée de mon côté. Préviens Yoan."],
  [/^CLE_ABSENTE|^CLE_REFUSEE|^DROITS|^COMPTE_ABSENT/, () => "Rien n'est parti : l'accès à ton compte Instagram ne marche pas de mon côté. Préviens Yoan avec le message ci-dessous."],
  [/^HORS_LIGNE/, () => "Rien n'est parti : pas d'internet. Vérifie ta connexion et refais le récapitulatif."],
  [/^ECHEC_PUBLICATION/, () => "Instagram a refusé la publication. Ne la relance pas : préviens Yoan avec le message ci-dessous."],
  [/^ERREUR_ZERNIO/, () => "Il y a eu un souci pendant l'envoi : je ne sais pas si c'est parti. Ne relance pas, préviens Yoan avec le message ci-dessous."],
];

function dateCourte(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(iso || '');
  if (!m) return iso;
  return `le ${+m[3]} ${MOIS[+m[2] - 1]}${m[4] ? ` à ${+m[4]} h ${m[5]}` : ''}`;
}

export function phrase(genre, texte) {
  const table = genre === 'BLOQUE' ? BLOQUES : genre === 'ATTENTION' ? ATTENTIONS : ARRETS;
  for (const [motif, f] of table) {
    const m = motif.exec(texte);
    if (m) return f(m);
  }
  if (genre === 'ATTENTION') return 'Un point est à vérifier sur ce contenu : préviens Yoan si tu as un doute.';
  return "Ce contenu ne peut pas partir pour l'instant : préviens Yoan avec le message ci-dessous.";
}

// La première ligne d'arrêt reconnue dans une sortie de `publier` (ou null).
function arret(sortie) {
  for (const ligne of sortie.split('\n')) {
    if (/^(QUAND_[A-Z]+|VERROU|CLE_ABSENTE|CLE_REFUSEE|DROITS|COMPTE_ABSENT|HORS_LIGNE|ECHEC_PUBLICATION|ERREUR_ZERNIO)\b/.test(ligne)) return ligne.trim();
  }
  return null;
}

// ------------------------------------------------------------------ ce qu'il y a sur le disque

function lireJson(chemin, defaut) {
  try { return JSON.parse(fs.readFileSync(chemin, 'utf8')); } catch { return defaut; }
}

function lireTexte(chemin) {
  try { return fs.readFileSync(chemin, 'utf8'); } catch { return null; }
}

function typeDe(slug, depot, media) {
  const etat = lireJson(path.join(depot, 'contenus', slug, 'etat.json'), null);
  if (etat && (etat.format === 'reel' || etat.format === 'carrousel')) return etat.format;
  for (const d of ['a-rendre', 'rendus']) {
    if (fs.existsSync(path.join(depot, d, 'carrousels', slug + '.md'))) return 'carrousel';
  }
  if (fs.existsSync(path.join(depot, 'contenus', slug, 'script.md'))) return 'reel';
  if (fs.existsSync(path.join(media, slug, 'face'))) return 'reel';
  return 'reel';
}

function titreDe(slug, depot) {
  const etat = lireJson(path.join(depot, 'contenus', slug, 'etat.json'), null);
  if (etat && etat.titre) return etat.titre;
  for (const rel of [['contenus', slug, 'script.md'], ['a-rendre', 'carrousels', slug + '.md'], ['rendus', 'carrousels', slug + '.md']]) {
    const t = lireTexte(path.join(depot, ...rel));
    const m = t && /^#\s+(.+)$/m.exec(t);
    if (m) return m[1].replace(/\*/g, '').trim();
  }
  return slug;
}

// La vidéo montée la plus récente : MEDIA/<slug>/face/*-monte*.mp4 (la dernière retouche gagne).
export function videoMontee(slug, config) {
  const dossier = path.join(chemins(config).media, slug, 'face');
  let noms;
  try { noms = fs.readdirSync(dossier); } catch { return null; }
  const vus = noms.filter((n) => MONTE.test(n)).map((n) => {
    const f = path.join(dossier, n);
    const st = fs.statSync(f);
    return { f, n, st };
  }).filter((x) => x.st.isFile());
  if (!vus.length) return null;
  vus.sort((a, b) => b.st.mtimeMs - a.st.mtimeMs || b.n.localeCompare(a.n, 'en', { numeric: true }));
  return { chemin: vus[0].f, nom: vus[0].n, taille: vus[0].st.size, mtimeMs: vus[0].st.mtimeMs };
}

// Ce qui identifie les slides montrées : nom, taille et date de chaque image vue par le lien.
function empreinteSlides(slug, config) {
  const dossier = path.join(chemins(config).media, slug, 'slides');
  return JSON.stringify(slidesDe(slug, config).map((n) => {
    try { const st = fs.statSync(path.join(dossier, n)); return [n, st.size, st.mtimeMs]; } catch { return [n]; }
  }));
}

function urlMedia(slug, ...parties) {
  return '/api/media/' + [slug, ...parties].map(encodeURIComponent).join('/');
}

// ------------------------------------------------------------------ recap

// --pousser : la copie des scripts se remet d'abord au niveau du dépôt en ligne (texte validé depuis
// le studio ou le téléphone). Rien n'est envoyé ni écrit dans le dépôt par verifier.
function argsVerifier(el) {
  const media = el.type === 'carrousel' ? ['--carrousel'] : ['--video', el.video.chemin];
  return ['verifier', el.slug, ...media, '--pousser'];
}

async function verifierUn(demande, config, maintenant, executer) {
  const { depot, media } = chemins(config);
  const slug = demande && demande.slug;
  const quand = demande && typeof demande.quand === 'string' ? demande.quand.trim() : null;
  const el = { slug, quand, type: 'reel', titre: slug || '', legende: null, mot: null, messages: [], bloque: false, attention: false };

  if (!slugValide(slug)) {
    el.messages.push("Ce contenu a un nom que je ne reconnais pas : préviens Yoan.");
    el.bloque = true;
    return el;
  }
  el.type = typeDe(slug, depot, media);
  el.titre = titreDe(slug, depot);

  if (quand !== 'maintenant') {
    const d = dateZurich(quand);
    if (!d) {
      el.messages.push('Choisis une date et une heure pour ce contenu.');
      el.bloque = true;
    } else if (d.getTime() < maintenant.getTime() + 10 * 60 * 1000) {
      el.messages.push("L'heure choisie est déjà passée, ou dans moins de 10 minutes : choisis une heure plus tard.");
      el.bloque = true;
    }
  }

  if (el.type === 'reel') {
    el.video = videoMontee(slug, config);
    if (!el.video) {
      el.messages.push("Je ne trouve pas encore de vidéo montée pour ce contenu.");
      el.bloque = true;
      return el;
    }
    el.video_url = urlMedia(slug, 'face', el.video.nom);
  } else {
    lierSlides(slug, config);
    el.slides_urls = slidesDe(slug, config).map((n) => urlMedia(slug, 'slides', n));
    el.slides = empreinteSlides(slug, config);
  }

  const { code, sortie } = await executer(argsVerifier(el), { ecriture: false });
  const v = lireVerifier(sortie);
  el.legende = v.legende;
  el.mot = v.mot;
  if (code !== 0 && code !== 1 && !v.bloque.length) {
    el.messages.push("Je n'arrive pas à vérifier ce contenu : préviens Yoan.");
    el.detail = sortie.trim().split('\n').slice(-3).join(' / ');
    el.bloque = true;
  }
  for (const b of v.bloque) {
    el.messages.push(phrase('BLOQUE', b));
    el.bloque = true;
  }
  for (const a of v.attention) {
    // Le studio choisit lui-même la dernière retouche (-monte-2.mp4...) : pas d'alerte pour elle.
    if (/^le fichier ne finit pas par -monte\.mp4/.test(a) && el.video && MONTE.test(el.video.nom)) continue;
    el.messages.push(phrase('ATTENTION', a));
    el.attention = true;
  }
  if (code === 0 && !v.ok && !el.bloque) {
    el.messages.push("Je n'arrive pas à vérifier ce contenu : préviens Yoan.");
    el.bloque = true;
  }
  return el;
}

function versApi(el) {
  const o = {
    slug: el.slug, titre: el.titre, type: el.type, quand: el.quand, legende: el.legende, mot: el.mot,
    verdict: el.bloque ? 'BLOQUE' : el.attention ? 'ATTENTION' : 'OK', messages: el.messages,
  };
  if (el.type === 'carrousel') o.slides_urls = el.slides_urls || [];
  else if (el.video_url) o.video_url = el.video_url;
  return o;
}

export async function recap(elements, config, opts = {}) {
  if (!Array.isArray(elements) || !elements.length) {
    throw new ErreurPublication('RIEN_A_PUBLIER', 'Choisis au moins un contenu à programmer.');
  }
  const maintenant = opts.maintenant ? opts.maintenant() : new Date();
  const vus = [];
  const executer = opts.executer || ((args, o) => lancerZernio(config, args, o));
  for (const demande of elements) vus.push(await verifierUn(demande, config, maintenant, executer));
  const id = 'r-' + crypto.randomBytes(12).toString('hex');
  const minutes = opts.minutes || RECAP_MINUTES;
  recaps.set(id, { id, expire: maintenant.getTime() + minutes * 60 * 1000, utilise: false, elements: vus });
  return { recap_id: id, elements: vus.map(versApi) };
}

// ------------------------------------------------------------------ confirmer

function argsPublier(el) {
  const media = el.type === 'carrousel' ? ['--carrousel'] : ['--video', el.video.chemin];
  const quand = el.quand === 'maintenant' ? ['--maintenant'] : ['--quand', el.quand];
  return ['publier', el.slug, ...media, ...quand];
}

function phraseQuand(el, futur) {
  const quoi = el.type === 'carrousel' ? 'ton carrousel' : 'ta vidéo';
  if (el.quand === 'maintenant') return futur ? `${quoi} serait publié${el.type === 'carrousel' ? '' : 'e'} tout de suite` : `${quoi} est en ligne`;
  return `${quoi} ${futur ? 'serait' : 'est'} programmé${el.type === 'carrousel' ? '' : 'e'} pour ${quandLisible(el.quand)}`;
}

function majuscule(t) { return t.charAt(0).toUpperCase() + t.slice(1); }

// Ce qui a changé depuis le récapitulatif (vidéo, légende, vérification) : rend une phrase, ou null.
async function encorePareil(el, config, executer) {
  if (el.type === 'reel') {
    let st = null;
    try { st = fs.statSync(el.video.chemin); } catch { /* disparue */ }
    if (!st || st.size !== el.video.taille || st.mtimeMs !== el.video.mtimeMs) {
      return 'La vidéo a changé depuis le récapitulatif : refais-le pour revoir ce qui partira.';
    }
    const plusRecente = videoMontee(el.slug, config);
    if (plusRecente && plusRecente.chemin !== el.video.chemin) {
      return 'Une vidéo plus récente a été montée depuis le récapitulatif : refais-le pour revoir ce qui partira.';
    }
  } else if (empreinteSlides(el.slug, config) !== el.slides) {
    return 'Les images du carrousel ont changé depuis le récapitulatif : refais-le pour revoir ce qui partira.';
  }
  const { sortie } = await executer(argsVerifier(el), { ecriture: false });
  const v = lireVerifier(sortie);
  if (v.bloque.length) return phrase('BLOQUE', v.bloque[0]);
  if (v.legende !== el.legende) return 'La légende a changé depuis le récapitulatif : refais-le pour relire ce qui partira.';
  if (v.mot !== el.mot) return 'Le mot en commentaire a changé depuis le récapitulatif : refais-le pour revoir ce qui partira.';
  return null;
}

export async function confirmer(recapOuId, config, opts = {}) {
  const id = typeof recapOuId === 'string' ? recapOuId : recapOuId && recapOuId.recap_id;
  const r = id ? recaps.get(id) : null;
  if (!r) throw new ErreurPublication('RECAP_INCONNU', "Ce récapitulatif n'existe plus : refais-le avant de confirmer.");
  const maintenant = opts.maintenant ? opts.maintenant() : new Date();
  if (r.utilise) throw new ErreurPublication('RECAP_DEJA_UTILISE', 'Ce récapitulatif a déjà été confirmé : rien ne part deux fois.');
  if (maintenant.getTime() > r.expire) {
    recaps.delete(id);
    throw new ErreurPublication('RECAP_EXPIRE', "Ce récapitulatif date de plus de 30 minutes : refais-le pour vérifier que rien n'a changé.");
  }
  r.utilise = true; // avant toute attente : un double clic ne publie pas deux fois
  recaps.delete(id);

  const simulation = enSimulation(config);
  const executer = opts.executer || ((args, o) => lancerZernio(config, args, o));
  const resultats = [];
  let stop = null;

  for (const el of r.elements) {
    const res = (statut, message, detail) => resultats.push({ slug: el.slug, statut, message, ...(detail ? { detail } : {}) });
    if (stop) { res('pas_envoye', "Pas envoyé : je me suis arrêté après le souci précédent."); continue; }
    if (el.bloque) { res('bloque', 'Pas programmé : ' + (el.messages[0] || 'ce contenu ne peut pas partir.')); continue; }
    if (el.quand !== 'maintenant') {
      const d = dateZurich(el.quand);
      if (!d || d.getTime() < maintenant.getTime() + 10 * 60 * 1000) {
        res('bloque', "Pas programmé : l'heure choisie est passée entre-temps. Choisis-en une autre."); continue;
      }
    }
    const change = await encorePareil(el, config, executer);
    if (change) { res('bloque', 'Pas programmé : ' + change); continue; }

    if (simulation) {
      const { sortie } = await executer(argsPublier(el), { ecriture: false });
      if (/^SIMULATION_OK$/m.test(sortie)) {
        res('simulation', `Simulation, rien n'est parti : en vrai, ${phraseQuand(el, true)}.`);
      } else {
        const a = arret(sortie);
        const b = lireVerifier(sortie).bloque[0];
        res('erreur', a ? phrase('ARRET', a) : b ? phrase('BLOQUE', b) : phrase('ARRET', ''), (a || b || '').slice(0, 300));
      }
      continue;
    }

    const { code, sortie } = await executer([...argsPublier(el), '--envoyer', '--pousser'], { ecriture: true, timeoutMs: 30 * 60 * 1000 });
    const post = /^POST (\S+) statut=(\S+) lien=(\S+)/m.exec(sortie);
    if (code === 0 && /^FAIT$/m.test(sortie)) {
      const statut = post ? post[2] : 'programmé';
      const lien = post && post[3] !== 'à' ? post[3] : null;
      if (statut === 'publié') res('publié', `C'est en ligne.${lien ? ' ' + lien : ''}`);
      else res('programmé', majuscule(`${phraseQuand(el, false)}. Tu peux fermer ton Mac, tout sort à l'heure.`));
      continue;
    }
    const a = arret(sortie);
    const b = lireVerifier(sortie).bloque[0];
    if (!a && b) { res('bloque', 'Pas programmé : ' + phrase('BLOQUE', b)); continue; }
    // Une erreur pendant l'envoi : on ne sait pas toujours ce qui est parti. On s'arrête là, sans relance.
    res('erreur', a ? phrase('ARRET', a) : "Il y a eu un souci pendant l'envoi : je ne sais pas si c'est parti. Ne relance pas, préviens Yoan avec le message ci-dessous.",
      (a || sortie.trim().split('\n').slice(-2).join(' / ')).slice(0, 300));
    stop = true;
  }
  return { simulation, resultats };
}

// ------------------------------------------------------------------ semaine

const INDICE = { lundi: 0, mardi: 1, mercredi: 2, jeudi: 3, vendredi: 4, samedi: 5, dimanche: 6 };

function jourPlus(jour, n) {
  const [y, m, d] = jour.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// Propose une date par contenu monté (reel) ou mis en page (carrousel) et pas encore programmé :
// son jour prévu s'il tombe dans la semaine, sinon le premier jour par défaut libre (config), sinon
// un autre jour libre de la semaine ; heure par défaut de son format. Rend recap(...) de ces dates.
export async function semaine(lundi, config, cartes, opts = {}) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(lundi || '');
  if (!m) throw new ErreurPublication('DATE_ILLISIBLE', "Je n'ai pas compris la semaine choisie.");
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const debut = jourPlus(lundi, -((d.getUTCDay() + 6) % 7)); // le lundi de cette semaine
  const jours = [0, 1, 2, 3, 4, 5, 6].map((i) => jourPlus(debut, i));
  const pub = (config && config.publication) || {};
  const heures = { reel: '18:30', carrousel: '12:15', ...(pub.heures_par_defaut || {}) };
  const parDefaut = (pub.jours_par_defaut || ['mardi', 'jeudi', 'dimanche']).map((j) => INDICE[j]).filter((i) => i !== undefined);
  const maintenant = opts.maintenant ? opts.maintenant() : new Date();
  const possible = (jour, format) => {
    const t = dateZurich(`${jour} ${heures[format] || '18:30'}`);
    return t && t.getTime() >= maintenant.getTime() + 10 * 60 * 1000;
  };

  const prets = (cartes || []).filter((c) => c && c.slug
    && ((c.format === 'reel' && c.stade === 'monte') || (c.format === 'carrousel' && c.stade === 'mis_en_page')));
  const dansSemaine = (c) => (c.jour_prevu && jours.includes(c.jour_prevu) ? 1 : 0);
  prets.sort((a, b) => (dansSemaine(b) - dansSemaine(a)) || String(a.jour_prevu || '9').localeCompare(String(b.jour_prevu || '9'))
    || String(a.maj || '').localeCompare(String(b.maj || '')));

  const pris = new Set();
  const elements = [];
  for (const c of prets) {
    let jour = null;
    if (dansSemaine(c) && possible(c.jour_prevu, c.format)) jour = c.jour_prevu;
    if (!jour) jour = parDefaut.map((i) => jours[i]).find((j) => !pris.has(j) && possible(j, c.format)) || null;
    if (!jour) jour = jours.find((j) => !pris.has(j) && possible(j, c.format)) || null;
    if (!jour) continue; // plus aucun jour possible cette semaine : il reste à programmer
    pris.add(jour);
    elements.push({ slug: c.slug, quand: `${jour} ${heures[c.format] || '18:30'}` });
  }
  if (!elements.length) {
    throw new ErreurPublication('RIEN_A_PUBLIER', 'Aucun contenu monté ou mis en page ne reste à programmer cette semaine.');
  }
  return recap(elements, config, opts);
}
