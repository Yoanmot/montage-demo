// Publication depuis le studio (CONTRAT-STUDIO.md, sections 7, 10 et 12). Node 24, sans dépendance.
//
//   recap(elements, config)          vérifie chaque contenu avec `zernio.py verifier` et rend l'objet de
//                                    POST /api/publication/recap ; le récapitulatif est gardé ici (recap_id)
//   confirmer(recap_id, config)      publie ce récapitulatif-là, et seulement lui, une seule fois
//   semaine(lundi, config, cartes)   propose une date par contenu monté (ou mis en page) non programmé,
//                                    puis rend recap(...) de ces propositions
//   poserMot(slug, ressource, config) « Brancher le mot » : la règle du mot en commentaire sur un post
//                                    déjà parti dont le clic n'a pas pu la poser (zernio.py poser-mot)
//
// Ressources gratuites (config.ressources, client avec un site de ressources ; studio de Yoan, lot 4C) :
// chaque élément du récapitulatif peut porter `ressource` (le slug choisi par le client dans la liste des
// ressources en ligne) ; il est passé en --ressource à verifier et à publier, qui posent la règle du mot
// sur CE post seulement. Un post dont la légende annonce un mot sans ressource choisie est bloqué.
// Sans config.ressources (Romain), `ressource` est ignoré et rien ne change.
//
// Message pas encore validé (18/11/2026) : la ressource reste dans la liste ; le récapitulatif montre
// le message exact, et le clic sur Programmer vaut validation (`zernio.py valider-message`, écrit et
// poussé dans le dépôt du head of content avant l'envoi). Retouches au récapitulatif : la légende d'un
// reel (`brief.py ecrire`) et le message de la ressource choisie (`valider-message --depuis`) sont
// enregistrés au même clic, puis revérifiés : ce qui part est ce qui était affiché.
//
// Reel d'essai (client dont le fichier dit « reels_essai » : true ; studio de Yoan, lot 9D) : un reel du
// récapitulatif peut porter `essai` (MANUAL : le client le passe en reel normal depuis Instagram ;
// SS_PERFORMANCE : Instagram le passe tout seul s'il marche). Montré seulement aux gens qui ne suivent pas le
// compte. Passé en --reel-essai à verifier et à publier. Aucune limite de durée (décision de Yoan,
// 18/11/2026 : rien d'officiel) ; si Instagram le refuse, ESSAI_REFUSE donne la phrase claire. Sans le
// réglage (Romain), rien ne change : `essai` est ignoré et aucune ligne n'apparaît.
//
// Sécurité :
//   - `--envoyer` n'est passé que par confirmer(), hors simulation, et ZERNIO_ECRITURE=<compte> (plus
//     ZERNIO_ECRITURE_ROMAIN=oui chez Romain) n'est posé que sur cet appel-là (il est retiré de
//     l'environnement de tous les autres).
//   - Simulation : config.publication.simulation === true, ou STUDIO_SIMULATION=1 (prioritaire). Alors
//     confirmer() lance `publier` sans --envoyer ni --pousser : rien ne part, rien n'est écrit (verifier
//     --pousser aligne seulement la copie des scripts du Mac, depot_mac, sur le dépôt en ligne).
//   - Un récapitulatif sert une fois, expire au bout de 30 minutes, et confirmer() revérifie que la vidéo
//     et la légende sont celles qui ont été montrées. Après une erreur d'envoi, rien n'est relancé.

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { developper, lierSlides, slidesDe, slugValide } from './carrousels.mjs';
import { contact, clientActif, VARIABLES_ECRITURE, variablesEcriture } from '../serveur/client.mjs';
import { motAbsent } from '../interface/app/mot-absent.js';
import { enRouteEntree } from './plateformes.mjs';
import { ressourceDuContenu } from '../serveur/liaisons.mjs';
export { motAbsent };

export const RECAP_MINUTES = 30;
// Reel d'essai : les deux façons de le passer en reel normal (Zernio, trialParams.graduationStrategy ;
// mêmes valeurs que ESSAIS dans zernio.py).
export const ESSAIS = ['MANUAL', 'SS_PERFORMANCE'];
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

// ------------------------------------------------------------------ publications en route

// Une publication partie tout de suite reste quelques minutes en préparation chez Instagram. Le registre
// la note alors « envoyé » (ou garde l'état brut de Zernio, comme « publishing » avant le 2026-11-19).
// Le studio la relit chez Zernio (lecture seule, `zernio.py actualiser`) jusqu'à ce qu'elle soit sortie.
let derniereActualisation = 0;

// Lot 12 : un programmé dont l'heure est passée est relu aussi (lecture seule), pour ne le dire « publié » que quand
// Instagram l'a sorti, et montrer clairement un refus (« failed »). Cinq minutes de marge : Instagram met un moment.

// Lot 13 : plateforme par plateforme (même règle que zernio.py a_relire), dont un TikTok sorti sans son lien.
export function enRoute(config, maintenant = Date.now()) {
  const reg = lireJson(path.join(chemins(config).depot, 'publications', 'registre.json'), {});
  return Object.entries(reg?.publications || {})
    .filter(([, e]) => e && enRouteEntree(e, maintenant))
    .map(([slug]) => slug);
}

export async function actualiserPublications(config, { executer = lancerZernio, maintenant = Date.now, intervalleMs = 60000 } = {}) {
  if (enSimulation(config) || !enRoute(config).length) return null;
  if (maintenant() - derniereActualisation < intervalleMs) return null;
  derniereActualisation = maintenant();
  return executer(config, ['actualiser', '--pousser'], { timeoutMs: 120000 });
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
  const client = config.client || clientActif();
  const depotMac = path.resolve(developper(config.depot_mac || `${client.racine}/head-of-content`));
  return { depot, depotMac, media: path.resolve(developper(config.media)), zernio: path.join(depotMac, 'outils', 'zernio.py') };
}

// Garde-fou d'écriture : ZERNIO_ECRITURE=<compte du client> (et ZERNIO_ECRITURE_ROMAIN=oui pour Romain,
// que son zernio.py demande encore), posé sur le seul appel de confirmation, retiré de tous les autres.
function environnement(depot, ecriture, client) {
  const env = { ...process.env, HOC_DEPOT: depot, PYTHONIOENCODING: 'utf-8' };
  for (const k of VARIABLES_ECRITURE) delete env[k];
  if (ecriture) Object.assign(env, variablesEcriture(client));
  return env;
}

// La seule forme d'appel qui peut recevoir la clé de lecture d'une installation d'essai (stats.mjs) :
//   [--compte <compte>] stats --jours <n> --format json --sortie - [--semaines-depuis AAAA-MM-JJ]
// `stats` en json vers la sortie standard ne fait que des GET chez Zernio et n'écrit aucun fichier.
export function argsLectureSeule(args) {
  const a = [...(args || [])].map(String);
  if (a[0] === '--compte') {
    if (!/^[a-z0-9]{1,32}$/.test(a[1] || '')) return false;
    a.splice(0, 2);
  }
  if (a.shift() !== 'stats') return false;
  const vu = new Set();
  const formes = { '--jours': /^\d{1,3}$/, '--format': /^json$/, '--sortie': /^-$/, '--semaines-depuis': /^\d{4}-\d{2}-\d{2}$/ };
  while (a.length) {
    const k = a.shift();
    const v = a.shift();
    if (!formes[k] || vu.has(k) || v === undefined || !formes[k].test(v)) return false;
    vu.add(k);
  }
  return vu.has('--format') && vu.has('--sortie');
}

// Lance zernio.py dans son propre groupe de processus ; rend { code, sortie }.
// dans: 'depot' : un outil du dépôt de travail du studio (écritures du clic, poussées comme les autres
// écritures du studio), jamais avec les variables d'écriture Zernio.
// cleLecture : le fichier de la clé de lecture d'une installation d'essai (<racine>/zernio-lecture.env), donné à
// zernio.py par ZERNIO_ENV_FILE pour ce seul appel, et seulement pour une lecture des chiffres (argsLectureSeule) ;
// tout autre appel est refusé sans rien lancer.
export function lancerZernio(config, args, { ecriture = false, timeoutMs = 120000, dans = 'mac', script = 'zernio.py', cleLecture = null } = {}) {
  const c = chemins(config);
  const depot = dans === 'depot' ? c.depot : c.depotMac;
  const outil = path.join(depot, 'outils', script);
  if (dans === 'depot') ecriture = false;
  const env = environnement(depot, ecriture, config.client || clientActif());
  if (cleLecture) {
    if (ecriture || dans !== 'mac' || script !== 'zernio.py' || !argsLectureSeule(args)) {
      return Promise.resolve({ code: -1, sortie: 'LECTURE_REFUSEE : la clé de lecture ne sert qu\'à lire les chiffres (zernio.py stats)' });
    }
    delete env.ZERNIO_API_KEY;
    env.ZERNIO_ENV_FILE = path.resolve(cleLecture);
  }
  return new Promise((resolve) => {
    let sortie = '';
    let fini = false;
    const p = spawn('python3', [outil, ...args], {
      cwd: depot, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
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
//
// Lot 13 (TikTok), avec --plateformes : en plus PLATEFORMES, LEGENDE_TIKTOK (même forme que LEGENDE),
// TIKTOK compte=... | TIKTOK_ABSENT | TIKTOK_INCONNU, BLOQUE_<PLATEFORME> / ATTENTION_<PLATEFORME> (ce qui ne
// vaut que pour une plateforme ; BLOQUE / ATTENTION seuls valent pour toutes), « OK <plateforme> ».
function texteCompte(sortie, etiquette) {
  const m = new RegExp(`^${etiquette} \\((.*), (\\d+) caractères\\) :\\n`, 'm').exec(sortie);
  if (!m) return null;
  const apres = Array.from(sortie.slice(m.index + m[0].length));
  return { texte: apres.slice(0, +m[2]).join(''), source: m[1], debut: m.index, fin: m.index + m[0].length + apres.slice(0, +m[2]).join('').length };
}

export function lireVerifier(sortie) {
  const r = { legende: null, mot: null, attention: [], bloque: [], ok: false, medias: [],
    legende_tiktok: null, legende_tiktok_source: null, tiktok: null, ok_plateformes: [],
    par_plateforme: { instagram: { bloque: [], attention: [] }, tiktok: { bloque: [], attention: [] } } };
  let reste = String(sortie || '');
  // Les textes comptés d'abord (ils peuvent contenir des lignes qui ressemblent à BLOQUE ...).
  for (const [etiquette, cle] of [['LEGENDE_TIKTOK', 'legende_tiktok'], ['LEGENDE', 'legende']]) {
    const x = texteCompte(reste, etiquette);
    if (!x) continue;
    r[cle] = x.texte;
    if (cle === 'legende_tiktok') r.legende_tiktok_source = x.source;
    reste = reste.slice(0, x.debut) + '\n' + reste.slice(x.fin);
  }
  for (const ligne of reste.split('\n')) {
    const p = /^(BLOQUE|ATTENTION)_(INSTAGRAM|TIKTOK) (.*)$/.exec(ligne);
    if (p) { r.par_plateforme[p[2].toLowerCase()][p[1] === 'BLOQUE' ? 'bloque' : 'attention'].push(p[3].trim()); continue; }
    if (ligne.startsWith('ATTENTION ')) r.attention.push(ligne.slice(10).trim());
    else if (ligne.startsWith('BLOQUE ')) r.bloque.push(ligne.slice(7).trim());
    else if (ligne.startsWith('MEDIA ')) r.medias.push(ligne.slice(6).trim());
    else if (ligne.startsWith('MOT ')) {
      const mot = ligne.slice(4).trim();
      r.mot = /^[A-Z]{2,}$/.test(mot) ? mot : null;
    } else if (ligne.trim() === 'OK prêt') r.ok = true;
    else if (/^OK (instagram|tiktok)$/.test(ligne.trim())) r.ok_plateformes.push(ligne.trim().slice(3));
    else if (ligne.startsWith('TIKTOK ')) {
      const o = { relie: true };
      for (const [, k, v] of ligne.slice(7).matchAll(/(\w+)=(\S+)/g)) o[k] = v;
      r.tiktok = o;
    } else if (ligne.startsWith('TIKTOK_ABSENT')) r.tiktok = { relie: false };
    else if (ligne.startsWith('TIKTOK_INCONNU')) r.tiktok = { relie: null, raison: ligne.slice(15).trim() };
  }
  return r;
}

// ------------------------------------------------------------------ phrases pour Romain

// Chaque BLOQUE / ATTENTION de zernio.py (fonctions preparer, heure_publication) et chaque code
// d'arrêt de cmd_publier / appel / main, traduit en une phrase claire. Les motifs suivent le texte
// exact du script : un texte inconnu donne une phrase générique, jamais le message brut.
const BLOQUES = [
  // TikTok (lot 13) : avant les règles d'Instagram, dont certains motifs les prendraient.
  [/^tiktok pas relié/, () => "Ton TikTok n'est pas encore relié."],
  [/^tiktok illisible/, () => "Je n'arrive pas à vérifier ton TikTok pour l'instant : revérifie dans un moment."],
  [/^tiktok pas public/, () => `TikTok ne permet pas de poster en public depuis ce compte : préviens ${contact()}.`],
  [/^tiktok complet/, () => "TikTok n'accepte plus de publication de ton compte pour l'instant (sa limite de la journée) : réessaie plus tard, ou poste sur Instagram seul."],
  [/^consentement TikTok absent/, () => "TikTok demande ta confirmation : elle se donne en cliquant pour poster."],
  [/^légende TikTok provisoire/, () => "La légende pour TikTok n'est pas encore écrite (il n'y a qu'un texte d'attente) : écris-la ici, ou demande-la à ton head of content."],
  [/^la légende TikTok contient un tiret long/, () => 'La légende pour TikTok contient un tiret long : remplace-le par une virgule ou deux points.'],
  [/^légende TikTok trop longue : (\d+) caractères \(TikTok : (\d+)\)/, (m) => `La légende est trop longue pour TikTok (${m[1]} caractères, ${m[2]} au plus) : raccourcis-la ici.`],
  [/^légende TikTok : /, () => "Il n'y a pas encore de légende pour TikTok : écris-la ici, ou demande-la à ton head of content dans la carte."],
  [/^la vidéo doit être en \.mp4, \.mov ou \.webm pour TikTok/, () => "La vidéo n'est pas dans un format que TikTok accepte : refais le montage."],
  [/^vidéo trop lourde pour TikTok : (\d+)/, (m) => `La vidéo est trop lourde pour TikTok (${m[1]} Mo, 4 Go au plus).`],
  [/^vidéo trop courte pour TikTok : (\d+)/, (m) => `La vidéo est trop courte pour TikTok (${m[1]} s, 3 s au moins).`],
  [/^vidéo trop longue pour TikTok : (\d+) s \((\d+)/, (m) => `La vidéo est trop longue pour TikTok (${m[1]} s, ${m[2]} s au plus).`],
  [/^un carrousel TikTok a 35 images au plus \((\d+)/, (m) => `Un carrousel TikTok a 35 images au plus (il en a ${m[1]}).`],
  [/^images trop lourdes pour TikTok/, () => "Des images du carrousel sont trop lourdes pour TikTok (20 Mo au plus chacune) : refais la mise en page."],
  [/^déjà (programmé|publié) sur TikTok le (.+?) \(zernio_post/, (m) => `Ce contenu est déjà ${m[1]} sur TikTok (${dateCourte(m[2])}). Pour le décaler, préviens ${contact()}.`],
  [/^ressource \S+ : le mot en commentaire passe par Instagram/, () => "La ressource gratuite passe par Instagram : coche Instagram, ou choisis « Aucune ressource »."],
  [/^slug invalide/, () => `Ce contenu a un nom que je ne reconnais pas : préviens ${contact()}.`],
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
  [/^déjà (programmé|publié) le (.+?) \(zernio_post/, (m) => `Ce contenu est déjà ${m[1]} (${dateCourte(m[2])}). Pour le décaler, préviens ${contact()}.`],
  [/^le mot (\S+) n'est pas en attente/, (m) => `Le mot ${m[1]} n'attend pas encore ta vidéo : enregistre-le dans « Ressource gratuite » (ou demande à ton head of content de le mettre en attente), sinon personne ne recevra ta ressource.`],
  [/^le mot (\S+) ne sera pas branché \((.*)\) :/, (m) => `Le mot ${m[1]} ne pourra pas encore envoyer ta ressource (${m[2]}) : la légende promettrait un message que personne ne recevrait. Attends que ce soit réglé, ou demande à ton head of content une légende sans le mot.`],
  [/^aucune ressource gratuite pour /, () => "Je ne trouve plus la ressource choisie : choisis-en une autre, ou aucune."],
  [/^la ressource \S+ n'est pas en ligne/, () => "La ressource choisie n'est pas encore en ligne : mets-la en ligne dans « Ressources gratuites », ou choisis-en une autre."],
  [/^ressource \S+ : message pas validé/, () => "Tu n'as pas encore validé le message que reçoivent ceux qui commentent : valide-le avec ton head of content, ou choisis une autre ressource."],
  [/^ressource \S+ : mot trop courant : (\S+)/, (m) => `Le mot ${m[1]} est trop courant : des gens l'écriraient sans avoir vu ton post. Choisis un mot propre à cette vidéo.`],
  [/^ressource \S+ : mot invalide/, () => "Le mot à commenter doit être un seul mot sans accent, de 5 à 14 lettres."],
  [/^ressource \S+ : /, () => "Le message automatique de la ressource choisie n'est pas prêt : demande à ton head of content de le finir, ou choisis une autre ressource."],
  [/^reel d'essai : seulement pour un reel/, () => "Un carrousel ne peut pas partir en reel d'essai : décoche la case."],
  [/^le mot du script \((\S+)\) n'est pas celui en attente \((\S+)\)/, (m) => `Le mot de ton script (${m[1]}) n'est pas celui qui attend (${m[2]}) : demande à ton head of content de remettre le bon mot en attente.`],
];

const ATTENTIONS = [
  [/^tiktok (commentaires|duo|collage) fermés/, (m) => `${{ commentaires: 'Les commentaires', duo: 'Les duos', collage: 'Les collages' }[m[1]]} sont fermés dans ton appli TikTok : ils restent fermés sur ce post.`],
  [/^durée de la vidéo pas vérifiée pour TikTok/, () => "Je n'ai pas pu lire la durée de la vidéo : TikTok accepte de 3 secondes à 10 minutes."],
  [/^le fichier ne finit pas par -monte\.mp4/, () => "Cette vidéo ne porte pas le nom d'une vidéo montée : vérifie que c'est la bonne."],
  [/^message automatique pas encore en service/, () => "Les messages automatiques ne sont pas encore en service : vérifie que la légende ne promet pas d'envoyer quelque chose en message."],
  [/^la légende ne cite pas le mot (\S+) : dis-le/, (m) => `La légende ne cite pas le mot ${m[1]} : dis-le bien dans la vidéo, sinon personne ne saura quoi commenter.`],
  [/^la légende ne cite pas le mot (\S+)/, (m) => `La légende ne cite pas le mot ${m[1]} : il sera cherché dans ce que tu dis dans la vidéo.`],
  [/^la légende semble demander un mot en commentaire/, () => "La légende demande de commenter un mot, mais aucun message automatique n'est prévu pour ce contenu : personne ne recevrait rien."],
];

const ARRETS = [
  [/^PLATEFORMES_VIDES|^PLATEFORMES_INCONNUES/, () => "Rien n'est parti : choisis où poster, Instagram, TikTok, ou les deux."],
  [/^VALIDATION_REFUSEE/, () => `Rien n'est parti : la vérification juste avant l'envoi a refusé ce post. Préviens ${contact()} avec le message ci-dessous.`],
  [/^QUAND_PASSE/, () => "L'heure choisie est déjà passée, ou dans moins de 10 minutes : choisis une heure plus tard."],
  [/^QUAND_ILLISIBLE|^QUAND_MANQUANT/, () => "Je n'ai pas compris la date choisie : choisis-la à nouveau."],
  [/^VERROU/, () => `Rien n'est parti : la publication n'a pas été autorisée de mon côté. Préviens ${contact()}.`],
  [/^CLE_ABSENTE|^CLE_REFUSEE|^DROITS|^COMPTE_ABSENT/, () => `Rien n'est parti : l'accès à ton compte Instagram ne marche pas de mon côté. Préviens ${contact()} avec le message ci-dessous.`],
  [/^HORS_LIGNE/, () => "Rien n'est parti : pas d'internet. Vérifie ta connexion et refais le récapitulatif."],
  [/^ESSAI_REFUSE/, () => "Instagram a refusé le reel d'essai, rien n'est parti. Le plus souvent, la fonction n'est pas encore ouverte sur ton compte (Instagram la donne aux comptes publics, petit à petit). Décoche « Reel d'essai » et revérifie pour le publier en reel normal."],
  [/^ECHEC_PUBLICATION/, () => `Instagram a refusé la publication. Ne la relance pas : préviens ${contact()} avec le message ci-dessous.`],
  [/^ERREUR_ZERNIO/, () => `Il y a eu un souci pendant l'envoi : je ne sais pas si c'est parti. Ne relance pas, préviens ${contact()} avec le message ci-dessous.`],
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
  if (genre === 'ATTENTION') return `Un point est à vérifier sur ce contenu : préviens ${contact()} si tu as un doute.`;
  return `Ce contenu ne peut pas partir pour l'instant : préviens ${contact()} avec le message ci-dessous.`;
}

// La première ligne d'arrêt reconnue dans une sortie de `publier` (ou null).
function arret(sortie) {
  for (const ligne of sortie.split('\n')) {
    if (/^(QUAND_[A-Z]+|VERROU|CLE_ABSENTE|CLE_REFUSEE|DROITS|COMPTE_ABSENT|HORS_LIGNE|ESSAI_REFUSE|ECHEC_PUBLICATION|ERREUR_ZERNIO|PLATEFORMES_[A-Z]+|VALIDATION_REFUSEE)\b/.test(ligne)) return ligne.trim();
  }
  return null;
}

// ------------------------------------------------------------------ ce qu'il y a sur le disque

function empreinteFichier(chemin) {
  try { return 'sha256:' + crypto.createHash('sha256').update(fs.readFileSync(chemin)).digest('hex'); } catch { return null; }
}

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

// Le reel d'essai est-il proposé à ce client ? (clients/<id>.json, « reels_essai »)
export function essaiActif(config) {
  return Boolean((config && config.client ? config.client : clientActif())?.reels_essai);
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

// Les noms des slides, dans l'ordre des lignes « MEDIA <chemin> (<taille> Mo) » de verifier.
export function slidesEnvoyees(medias) {
  return (medias || []).map((m) => path.basename(String(m).replace(/\s+\([\d.,]+ Mo\)\s*$/, '')))
    .filter((n) => /^slide-\d+\.(png|jpe?g)$/i.test(n));
}

// ------------------------------------------------------------------ recap

// --pousser : la copie des scripts se remet d'abord au niveau du dépôt en ligne (texte validé depuis
// le studio ou le téléphone). Rien n'est envoyé ni écrit dans le dépôt par verifier.
// Plateformes (lot 13) : au récapitulatif, les deux quand TikTok est relié (pour tout savoir sans revérifier au
// changement d'une case) ; au clic, celles qui sont cochées. Sans TikTok relié : l'appel d'avant, inchangé.
function argsVerifier(el, plats = el.verif_plateformes) {
  const media = el.type === 'carrousel' ? ['--carrousel'] : ['--video', el.video.chemin];
  return ['verifier', el.slug, ...media, ...argsPlateformes(el, plats), ...argsRessource(el, plats), ...argsEssai(el, plats),
    ...argsLegende(el, plats), '--pousser'];
}

function argsPlateformes(el, plats) {
  if (!plats) return [];
  const a = ['--plateformes', plats.join(',')];
  if (plats.includes('tiktok') && el.tiktok_compte) a.push('--tiktok-compte', el.tiktok_compte);
  return a;
}

// Une légende retouchée pas enregistrée (simulation, ou carrousel) : zernio.py la lit dans un fichier.
function argsLegende(el, plats) {
  const a = el.legende_fichier ? ['--legende-fichier', el.legende_fichier] : [];
  if (el.legende_tiktok_fichier && (!plats || plats.includes('tiktok'))) a.push('--legende-tiktok-fichier', el.legende_tiktok_fichier);
  return a;
}

const MESSAGE_PAS_VALIDE = /^ressource \S+ : message pas validé/;

// La légende telle que zernio.py la relira dans le fichier (brief.py, fonction propre).
export function legendePropre(t) {
  return String(t ?? '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/^#+[ \t]+/, '').replace(/\s+$/, ''))
    .join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Le message tel que le client le voit (« [son prénom] ») et tel que la fiche le garde.
const versFiche = (t) => String(t ?? '').replace(/\[\s*son\s+pr[ée]nom\s*\]/gi, '{{first_name}}');
const versClient = (t) => String(t ?? '').replace(/\{\{\s*first_name\s*\}\}/g, '[son prénom]');
function messagePropre(t) {
  return String(t ?? '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Les limites de zernio.py (LEGENDE_MAX, MESSAGE_MAX, BOUTON_MAX), pour les champs du récapitulatif.
export const LIMITES = { legende: 2200, message: 640, bouton: 20 };
// TikTok (lot 13) : légende d'une vidéo 2 200 caractères, d'un carrousel photo 4 000 (doc Zernio).
export const LIMITES_TIKTOK = { reel: 2200, carrousel: 4000 };
export const PLATEFORMES = ['instagram', 'tiktok'];
const TIRET_LONG = '\u2014';

// Ce qui empêche une retouche de partir, en phrases (le studio montre la même chose sous le champ).
export function erreursTextes({ legende, message, bouton, mot } = {}) {
  const e = {};
  if (mot !== undefined) {
    const m = String(mot ?? '').trim().toUpperCase();
    if (!m) e.mot = 'Il faut un mot à commenter.';
    else if (!/^[A-Z]{5,14}$/.test(m)) e.mot = 'Le mot doit être un seul mot sans accent, de 5 à 14 lettres.';
  }
  if (legende !== undefined) {
    const l = legendePropre(legende);
    if (!l) e.legende = 'La légende ne peut pas être vide.';
    else if (l.includes(TIRET_LONG)) e.legende = 'La légende contient un tiret long : remplace-le par une virgule ou deux points.';
    else if (Array.from(l).length > LIMITES.legende) e.legende = `La légende est trop longue pour Instagram (${Array.from(l).length} caractères, ${LIMITES.legende} au plus).`;
  }
  if (message !== undefined) {
    const m = messagePropre(versFiche(message));
    if (!m) e.message = 'Le message ne peut pas être vide.';
    else if (m.includes(TIRET_LONG)) e.message = 'Le message contient un tiret long : remplace-le par une virgule ou deux points.';
    else if (m.length > LIMITES.message) e.message = `Le message est trop long (${m.length} caractères, ${LIMITES.message} au plus).`;
  }
  if (bouton !== undefined) {
    const b = String(bouton ?? '').split(/\s+/).filter(Boolean).join(' ');
    if (!b) e.bouton = 'Le bouton a besoin d\'un texte.';
    else if (b.includes(TIRET_LONG)) e.bouton = 'Le texte du bouton contient un tiret long.';
    else if (b.length > LIMITES.bouton) e.bouton = `Le texte du bouton est trop long (${b.length} caractères, ${LIMITES.bouton} au plus).`;
  }
  return e;
}

// La ressource gratuite et le reel d'essai ne valent que sur Instagram : sans Instagram choisi, jamais passés.
function argsRessource(el, plats) {
  return el.ressource && (!plats || plats.includes('instagram')) ? ['--ressource', el.ressource] : [];
}

function argsEssai(el, plats) {
  return el.essai && (!plats || plats.includes('instagram')) ? ['--reel-essai', el.essai] : [];
}

const sansAccents = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// La légende annonce-t-elle un mot à commenter ? Ce que dit zernio.py (« semble demander un mot »), ou
// un mot d'une ressource en ligne écrit tel quel dans la légende.
function annonceUnMot(legende, attention, pretes) {
  if (attention.some((a) => /^la légende semble demander un mot en commentaire/.test(a))) return true;
  const t = sansAccents(legende).toUpperCase();
  return (pretes || []).some((r) => r.mot && new RegExp(`(^|[^A-Z0-9])${r.mot}([^A-Z0-9]|$)`).test(t));
}

export const PHRASE_MOT_SANS_RESSOURCE = 'Ta légende demande de commenter un mot : choisis la ressource que recevront ceux qui commentent. Sans elle, personne ne recevrait rien.';

// TikTok (lot 13) : relié ou non pour ce client (lu par `zernio.py tiktok`, côté serveur), ce que le contenu
// peut en faire. Rien de connu : TikTok est grisé, avec une phrase.
export const PHRASE_TIKTOK_ABSENT = "Ton TikTok n'est pas encore relié.";
export const PHRASE_TIKTOK_INCONNU = "Je n'arrive pas à vérifier ton TikTok pour l'instant : revérifie dans un moment.";

function tiktokPour(type, etat) {
  if (!etat || etat.relie === false) return { possible: false, raison: PHRASE_TIKTOK_ABSENT };
  if (etat.relie !== true || !etat.compte) return { possible: false, raison: PHRASE_TIKTOK_INCONNU };
  const infos = (type === 'carrousel' ? etat.photo : etat.video) || {};
  const ouvert = (k) => (infos[k] === undefined || infos[k] === null ? null : infos[k] !== false);
  return {
    possible: true, raison: null, compte: etat.compte, nom: etat.nom || null,
    // null : sans objet (duo et collage d'un carrousel) ; false : fermé par toi dans ton appli TikTok.
    interactions: { commentaires: ouvert('commentaires') ?? true, duo: type === 'carrousel' ? null : ouvert('duo') ?? true,
      collage: type === 'carrousel' ? null : ouvert('collage') ?? true },
  };
}

function sourceTiktok(source) {
  if (!source) return null;
  if (/^variante/.test(source)) return 'variante';
  if (/coupée/.test(source)) return 'coupee';
  return 'instagram';
}

async function verifierUn(demande, config, maintenant, executer, pretes, tiktokEtat) {
  const { depot, media } = chemins(config);
  const slug = demande && demande.slug;
  const quand = demande && typeof demande.quand === 'string' ? demande.quand.trim() : null;
  const el = { slug, quand, type: 'reel', titre: slug || '', legende: null, mot: null, messages: [], bloque: false, attention: false,
    messages_commun: [], bloque_commun: false };
  // Ce qui empêche le contenu de partir où que ce soit (pas de vidéo, nom, date, vérification impossible).
  const bloquerTout = (m) => { el.messages.push(m); el.messages_commun.push(m); el.bloque = true; el.bloque_commun = true; };
  if (config.ressources) {
    // Rien de choisi encore (première préparation) : la ressource reliée au contenu, si elle peut être offerte
    // (22/11/2026). Un choix « Aucune ressource » arrive en texte vide et reste aucune.
    let r = demande && typeof demande.ressource === 'string' ? demande.ressource.trim() : null;
    if (r === null) {
      const liee = slugValide(slug) ? ressourceDuContenu(chemins(config).depot, slug) : null;
      r = liee && (pretes || []).some((y) => y.slug === liee && y.disponible !== false) ? liee : '';
      if (r) el.ressource_par_defaut = true;
    }
    el.ressource = r && slugValide(r) ? r : null;
    const x = el.ressource ? (pretes || []).find((y) => y.slug === el.ressource) : null;
    el.ressource_titre = x?.titre || null;
    // Le mot et le message de CE contenu s'il est relié à la ressource (sa liaison), sinon ceux de la fiche.
    const propre = x && Array.isArray(x.contenus) ? x.contenus.find((c) => c.slug === slug) : null;
    el.liaisons = Boolean(x?.liaisons);
    // Ressource offrable : son message (validé ou non) est montré, et peut être retouché, au récapitulatif.
    const dm = propre && typeof propre.message === 'string' ? propre : x;
    if (x && x.disponible !== false && dm && typeof dm.message === 'string') {
      el.message_dm = { mot: dm.mot || null, message: dm.message, bouton: dm.bouton || '', empreinte: dm.empreinte || null, a_valider: Boolean(dm.a_valider) };
    }
    if (x && x.disponible === false) el.ressource_probleme = x.probleme || null;
    else if (propre?.probleme) el.ressource_probleme = propre.probleme;
  }

  el.tiktok = { possible: false, raison: PHRASE_TIKTOK_ABSENT, messages: [], bloque: false, attention: false };
  if (!slugValide(slug)) {
    bloquerTout(`Ce contenu a un nom que je ne reconnais pas : préviens ${contact()}.`);
    return el;
  }
  el.type = typeDe(slug, depot, media);
  el.titre = titreDe(slug, depot);
  // Le texte d'où vient la légende d'un reel : son empreinte garde une retouche du récapitulatif d'écraser
  // un texte changé entre-temps (brief.py ecrire --empreinte).
  if (el.type === 'reel') el.script_empreinte = empreinteFichier(path.join(depot, 'contenus', slug, 'script.md'));

  if (quand !== 'maintenant') {
    const d = dateZurich(quand);
    if (!d) {
      bloquerTout('Choisis une date et une heure pour ce contenu.');
    } else if (d.getTime() < maintenant.getTime() + 10 * 60 * 1000) {
      bloquerTout("L'heure choisie est déjà passée, ou dans moins de 10 minutes : choisis une heure plus tard.");
    }
  }

  if (el.type === 'reel') {
    el.video = videoMontee(slug, config);
    if (!el.video) {
      bloquerTout("Je ne trouve pas encore de vidéo montée pour ce contenu.");
      return el;
    }
    el.video_url = urlMedia(slug, 'face', el.video.nom);
    if (essaiActif(config)) {
      el.essai_propose = true;
      if (demande && ESSAIS.includes(demande.essai)) el.essai = demande.essai;
    }
  } else {
    lierSlides(slug, config);
    el.slides_urls = slidesDe(slug, config).map((n) => urlMedia(slug, 'slides', n));
    el.slides = empreinteSlides(slug, config);
  }

  const tt = tiktokPour(el.type, tiktokEtat);
  Object.assign(el.tiktok, { possible: tt.possible, raison: tt.raison, nom: tt.nom || null, interactions: tt.interactions || null });
  if (tt.possible) {
    el.tiktok_compte = tt.compte;
    el.verif_plateformes = ['instagram', 'tiktok'];
  }

  const { code, sortie } = await executer(argsVerifier(el), { ecriture: false });
  const v = lireVerifier(sortie);
  // L'ordre des slides montré au récapitulatif est celui que zernio.py enverra (ses lignes MEDIA, la liste même qu'il
  // envoie à Zernio), jamais une autre lecture du dossier ; sans elles (vérification impossible), la lecture du lien.
  if (el.type === 'carrousel') {
    const ordre = slidesEnvoyees(v.medias);
    if (ordre.length) el.slides_urls = ordre.map((n) => urlMedia(slug, 'slides', n));
  }
  el.legende = v.legende;
  el.mot = v.mot;
  if (code !== 0 && code !== 1 && !v.bloque.length) {
    bloquerTout(`Je n'arrive pas à vérifier ce contenu : préviens ${contact()}.`);
    el.detail = sortie.trim().split('\n').slice(-3).join(' / ');
  }
  for (const b of v.bloque) {
    // Message pas encore validé d'une ressource offrable : le clic sur Programmer le validera.
    if (el.message_dm && MESSAGE_PAS_VALIDE.test(b)) continue;
    bloquerTout(phrase('BLOQUE', b));
  }
  for (const b of v.par_plateforme.instagram.bloque) {
    if (el.message_dm && MESSAGE_PAS_VALIDE.test(b)) continue;
    el.messages.push(phrase('BLOQUE', b));
    el.bloque = true;
  }
  // TikTok : ce qui ne vaut que pour lui, à part (la case TikTok a son propre verdict).
  if (tt.possible) {
    if (v.tiktok && v.tiktok.relie !== true) {
      Object.assign(el.tiktok, { possible: false, raison: v.tiktok.relie === false ? PHRASE_TIKTOK_ABSENT : PHRASE_TIKTOK_INCONNU });
    } else {
      el.tiktok.legende = v.legende_tiktok;
      el.tiktok.legende_source = sourceTiktok(v.legende_tiktok_source);
      for (const b of v.par_plateforme.tiktok.bloque) { el.tiktok.messages.push(phrase('BLOQUE', b)); el.tiktok.bloque = true; }
      for (const a of v.par_plateforme.tiktok.attention) { el.tiktok.messages.push(phrase('ATTENTION', a)); el.tiktok.attention = true; }
    }
  }
  v.attention.push(...v.par_plateforme.instagram.attention);
  if (el.ressource_probleme) {
    el.messages.push(`La ressource choisie ne peut pas être offerte pour l'instant : ${el.ressource_probleme} Choisis-en une autre, ou aucune.`);
    el.bloque = true;
  }
  // Une légende qui annonce un mot sans ressource choisie ne part pas : personne ne recevrait rien.
  const motSansRessource = Boolean(config.ressources) && !el.ressource && annonceUnMot(v.legende, v.attention, pretes);
  if (motSansRessource) {
    el.messages.push(PHRASE_MOT_SANS_RESSOURCE);
    el.bloque = true;
  }
  for (const a of v.attention) {
    // Le studio choisit lui-même la dernière retouche (-monte-2.mp4...) : pas d'alerte pour elle.
    if (/^le fichier ne finit pas par -monte\.mp4/.test(a) && el.video && MONTE.test(el.video.nom)) continue;
    if (motSansRessource && /^la légende semble demander un mot en commentaire/.test(a)) continue;
    // « La légende ne cite pas le mot » : gardé à part, le studio le recalcule pendant que la légende se
    // retouche (même règle que zernio.py, motAbsent) et le retire dès qu'elle cite le mot.
    const absent = /^la légende ne cite pas le mot (\S+)/.exec(a);
    if (absent) { el.mot_absent = { mot: absent[1], message: phrase('ATTENTION', a) }; continue; }
    el.messages.push(phrase('ATTENTION', a));
    el.attention = true;
  }
  if (code === 0 && !v.ok && !el.bloque) {
    bloquerTout(`Je n'arrive pas à vérifier ce contenu : préviens ${contact()}.`);
  }
  return el;
}

// Le verdict de TikTok pour ce contenu : ce qui bloque partout compte aussi pour lui.
function verdictTiktok(el) {
  if (!el.tiktok?.possible) return null;
  return el.bloque_commun || el.tiktok.bloque ? 'BLOQUE' : el.tiktok.attention ? 'ATTENTION' : 'OK';
}

function versApi(el) {
  // L'avertissement du mot absent compte dans le verdict et les messages ; `mot_absent` dit lequel c'est et
  // quel verdict resterait sans lui, pour que l'interface le suive pendant une retouche de la légende.
  const sansMot = el.bloque ? 'BLOQUE' : el.attention ? 'ATTENTION' : 'OK';
  const absent = el.mot_absent && motAbsent(el.legende, el.mot_absent.mot) ? el.mot_absent : null;
  const o = {
    slug: el.slug, titre: el.titre, type: el.type, quand: el.quand, legende: el.legende, mot: el.mot,
    verdict: absent && sansMot === 'OK' ? 'ATTENTION' : sansMot,
    messages: absent ? [...el.messages, absent.message] : el.messages,
  };
  if (el.mot_absent) o.mot_absent = { mot: el.mot_absent.mot, message: el.mot_absent.message, verdict_sinon: sansMot };
  if ('ressource' in el) { o.ressource = el.ressource; o.ressource_titre = el.ressource_titre; if (el.ressource_par_defaut) o.ressource_par_defaut = true; }
  if (el.message_dm) {
    o.message_dm = { mot: el.message_dm.mot, message: versClient(el.message_dm.message), bouton: el.message_dm.bouton, a_valider: el.message_dm.a_valider,
      // Le mot se retouche aussi, pour ce contenu seulement (sa liaison) : seulement si l'outil sait le faire.
      ...(el.liaisons ? { mot_modifiable: true } : {}) };
  }
  // La légende se retouche ici : celle d'un reel est enregistrée dans son script, celle d'un carrousel part telle
  // qu'elle est tapée (ses slides sont déjà mises en page, son texte ne change pas).
  o.legende_modifiable = el.legende !== null && (el.type === 'carrousel' || Boolean(el.script_empreinte));
  // La case « Reel d'essai » (client qui l'a activée, reels seulement) et le choix fait.
  if (el.essai_propose) o.reel_essai = { choix: el.essai || null };
  if (el.type === 'carrousel') o.slides_urls = el.slides_urls || [];
  else if (el.video_url) o.video_url = el.video_url;
  // Lot 13 : où ce contenu peut partir. Instagram toujours ; TikTok s'il est relié (sinon grisé, avec sa raison).
  // Aucune case n'est cochée ici : c'est le client qui coche, à chaque fois.
  const t = el.tiktok || { possible: false, raison: PHRASE_TIKTOK_ABSENT };
  o.plateformes = {
    instagram: { possible: true },
    tiktok: t.possible
      ? { possible: true, nom: t.nom, verdict: verdictTiktok(el), messages: [...el.messages_commun, ...t.messages],
        legende: t.legende ?? null, legende_source: t.legende_source || null,
        legende_modifiable: el.type === 'carrousel' || Boolean(el.script_empreinte),
        limite: LIMITES_TIKTOK[el.type] || LIMITES_TIKTOK.reel, interactions: t.interactions }
      : { possible: false, raison: t.raison },
  };
  return o;
}

// opts.tiktok : ce que `zernio.py tiktok --format json` a dit (serveur) ; absent = TikTok pas relié.
export async function recap(elements, config, opts = {}) {
  if (!Array.isArray(elements) || !elements.length) {
    throw new ErreurPublication('RIEN_A_PUBLIER', 'Choisis au moins un contenu à programmer.');
  }
  const maintenant = opts.maintenant ? opts.maintenant() : new Date();
  const vus = [];
  const executer = opts.executer || ((args, o) => lancerZernio(config, args, o));
  const pretes = config.ressources ? (opts.ressources || []) : null;
  for (const demande of elements) vus.push(await verifierUn(demande, config, maintenant, executer, pretes, opts.tiktok));
  const id = 'r-' + crypto.randomBytes(12).toString('hex');
  const minutes = opts.minutes || RECAP_MINUTES;
  recaps.set(id, { id, expire: maintenant.getTime() + minutes * 60 * 1000, utilise: false, elements: vus });
  const r = { recap_id: id, elements: vus.map(versApi), limites_tiktok: LIMITES_TIKTOK };
  // La liste déroulante du récapitulatif : les ressources du site, offrables ou grisées avec leur raison.
  if (pretes) {
    r.ressources = pretes.map((x) => {
      const o = { slug: x.slug, titre: x.titre, mot: x.mot };
      for (const k of ['disponible', 'a_valider', 'probleme', 'bouton']) if (x[k] !== undefined) o[k] = x[k];
      if (x.message !== undefined) o.message = x.message === null ? null : versClient(x.message);
      return o;
    });
    if (opts.ressourcesNote) r.ressources_note = opts.ressourcesNote;
    r.limites = LIMITES;
  }
  return r;
}

// ------------------------------------------------------------------ confirmer

// Les plateformes cochées (el.choisies, lot 13) partent seules : --plateformes toujours, TikTok avec son compte,
// ses réglages et le consentement du clic (el.tiktok_choix.consentement), jamais posé autrement.
function argsPublier(el) {
  const plats = el.choisies;
  const media = el.type === 'carrousel' ? ['--carrousel'] : ['--video', el.video.chemin];
  const quand = el.quand === 'maintenant' ? ['--maintenant'] : ['--quand', el.quand];
  const message = el.message_fichier && plats.includes('instagram') ? ['--message-fichier', el.message_fichier] : [];
  const tiktok = [];
  if (plats.includes('tiktok')) {
    const c = el.tiktok_choix || {};
    if (c.commentaires === false) tiktok.push('--tiktok-sans-commentaires');
    if (c.duo === false && el.type !== 'carrousel') tiktok.push('--tiktok-sans-duo');
    if (c.collage === false && el.type !== 'carrousel') tiktok.push('--tiktok-sans-collage');
    if (c.consentement === true) tiktok.push('--tiktok-consentement');
  }
  return ['publier', el.slug, ...media, ...quand, ...argsPlateformes(el, plats), ...argsRessource(el, plats), ...argsEssai(el, plats),
    ...argsLegende(el, plats), ...message, ...tiktok];
}

// Ce qui partirait, lu dans les requêtes que `publier` montre en simulation (3-post, 4-mot) : la légende,
// le message et le bouton exacts, tels que la personne les verra (« [son prénom] »), et, par plateforme,
// où ça part et la légende de chacune (lot 13).
export function textesSimules(sortie) {
  const corps = (titre) => {
    const lignes = String(sortie || '').split('\n');
    const i = lignes.findIndex((l) => l.startsWith(`REQUETE ${titre} `));
    if (i < 0 || lignes[i + 1] !== '{') return null;
    const fin = lignes.indexOf('}', i + 1);
    if (fin < 0) return null;
    try { return JSON.parse(lignes.slice(i + 1, fin + 1).join('\n')); } catch { return null; }
  };
  const post = corps('3-post');
  if (!post || typeof post.content !== 'string') return null;
  const plats = (post.platforms || []).map((x) => x && x.platform).filter(Boolean);
  const ig = (post.platforms || []).find((x) => x && x.platform === 'instagram');
  const tt = (post.platforms || []).find((x) => x && x.platform === 'tiktok');
  const o = { plateformes: plats };
  if (ig) o.legende = post.content;
  if (tt) {
    const s = post.tiktokSettings || {};
    o.legende_tiktok = s.media_type === 'photo' ? s.description : (tt.customContent ?? post.content);
    o.tiktok = { commentaires: s.allow_comment, duo: s.allow_duet, collage: s.allow_stitch, public: s.privacy_level === 'PUBLIC_TO_EVERYONE',
      consentement: s.content_preview_confirmed === true && s.express_consent_given === true };
  }
  const essai = ig?.platformSpecificData?.trialParams?.graduationStrategy;
  if (essai) o.reel_essai = essai;
  const regle = corps('4-mot');
  if (regle && typeof regle.dmMessage === 'string') {
    o.mot = (regle.keywords || [])[0] || null;
    o.message = versClient(regle.dmMessage);
    o.bouton = regle.buttons?.[0]?.title || '';
  }
  return o;
}

// « Ceux qui commentent MOT reçoivent « titre » », pour les résultats (Instagram seulement).
function phraseMot(el, futur) {
  if (!el.ressource || !el.mot || !(el.choisies || ['instagram']).includes('instagram')) return '';
  const titre = el.ressource_titre ? ` « ${el.ressource_titre} »` : ' la ressource';
  return futur ? ` Ceux qui commenteraient ${el.mot} sur Instagram recevraient${titre}.` : ` Ceux qui commentent ${el.mot} sur Instagram reçoivent${titre}.`;
}

// « En reel d'essai : ... », pour les résultats.
export function phraseEssai(el, futur) {
  if (!el.essai || !(el.choisies || ['instagram']).includes('instagram')) return '';
  const qui = futur ? 'serait montrée' : 'est montrée';
  const passage = el.essai === 'SS_PERFORMANCE'
    ? `Instagram la ${futur ? 'passerait' : 'passera'} en reel normal toute seule si elle marche`
    : `tu la ${futur ? 'passerais' : 'passeras'} en reel normal toi-même depuis Instagram`;
  return ` En reel d'essai : elle ${qui} seulement aux gens qui ne te suivent pas, et ${passage}.`;
}

export const NOMS = { instagram: 'Instagram', tiktok: 'TikTok' };
// « Instagram et TikTok »
export function ou(plats) {
  const n = (plats || ['instagram']).map((p) => NOMS[p] || p);
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} et ${n[n.length - 1]}` : n[0];
}

function phraseQuand(el, futur) {
  const quoi = el.type === 'carrousel' ? 'ton carrousel' : 'ta vidéo';
  const sur = ` sur ${ou(el.choisies)}`;
  if (el.quand === 'maintenant') return futur ? `${quoi} serait publié${el.type === 'carrousel' ? '' : 'e'} tout de suite${sur}` : `${quoi} est en ligne${sur}`;
  return `${quoi} ${futur ? 'serait' : 'est'} programmé${el.type === 'carrousel' ? '' : 'e'}${sur} pour ${quandLisible(el.quand)}`;
}

function majuscule(t) { return t.charAt(0).toUpperCase() + t.slice(1); }

// Ce qui a changé depuis le récapitulatif (vidéo, légendes, vérification), sur les plateformes cochées : rend une
// phrase, ou null.
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
  const plats = el.verif_plateformes ? el.choisies : null;
  const { sortie } = await executer(argsVerifier(el, plats), { ecriture: false });
  const v = lireVerifier(sortie);
  const bloque = [...v.bloque, ...v.par_plateforme.instagram.bloque].filter((b) => !(el.message_dm && MESSAGE_PAS_VALIDE.test(b)));
  if (bloque.length) return phrase('BLOQUE', bloque[0]);
  if (v.par_plateforme.tiktok.bloque.length) return phrase('BLOQUE', v.par_plateforme.tiktok.bloque[0]);
  const ig = el.choisies.includes('instagram');
  if (ig && v.legende !== el.legende) return 'La légende a changé depuis le récapitulatif : refais-le pour relire ce qui partira.';
  if (ig && v.mot !== el.mot) return 'Le mot en commentaire a changé depuis le récapitulatif : refais-le pour revoir ce qui partira.';
  if (el.choisies.includes('tiktok') && v.legende_tiktok !== el.tiktok.legende) {
    return 'La légende pour TikTok a changé depuis le récapitulatif : refais-le pour relire ce qui partira.';
  }
  return null;
}

// Les lignes « PLATEFORME <p> statut=<s> lien=<l> [erreur=...] » de publier ou reessayer.
export function lirePlateformes(sortie) {
  const r = [];
  for (const m of String(sortie || '').matchAll(/^PLATEFORME (instagram|tiktok) statut=(\S+) lien=(\S+)(?: venir)?(?: erreur=(.*))?$/gm)) {
    r.push({ plateforme: m[1], statut: m[2], lien: m[3] === 'à' ? null : m[3], ...(m[4] ? { erreur: m[4].trim() } : {}) });
  }
  return r;
}

// opts.plateformes : { <slug>: ["instagram", "tiktok"] } cochées au clic, rien d'autre ne part (lot 13) ;
// opts.tiktok : { <slug>: { commentaires, duo, collage, consentement } }, réglages et accord du clic.
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
  const textes = opts.textes && typeof opts.textes === 'object' ? opts.textes : {};
  // Le quand choisi après la préparation (lot 10) : il remplace celui du récapitulatif, avec les mêmes contrôles
  // (date lisible, au moins 10 minutes plus tard) faits plus bas avant tout envoi. Rien d'autre ne change.
  const quands = opts.quands && typeof opts.quands === 'object' ? opts.quands : {};
  const choixPlateformes = opts.plateformes && typeof opts.plateformes === 'object' ? opts.plateformes : {};
  const choixTiktok = opts.tiktok && typeof opts.tiktok === 'object' ? opts.tiktok : {};
  const resultats = [];
  let stop = null;
  const temporaires = [];

  for (const el of r.elements) {
    const res = (statut, message, detail, extra) => resultats.push({ slug: el.slug, statut, message, ...(detail ? { detail } : {}), ...(extra || {}) });
    if (stop) { res('pas_envoye', "Pas envoyé : je me suis arrêté après le souci précédent."); continue; }
    if (Object.prototype.hasOwnProperty.call(quands, el.slug)) {
      const q = typeof quands[el.slug] === 'string' ? quands[el.slug].trim() : '';
      if (q !== 'maintenant' && !dateZurich(q)) { res('bloque', 'Pas programmé : choisis une date et une heure pour ce contenu.'); continue; }
      el.quand = q;
    }
    // Où ça part : seulement ce qui a été coché, dans l'ordre fixe. Rien de coché : rien ne part.
    const coche = Array.isArray(choixPlateformes[el.slug]) ? choixPlateformes[el.slug].map(String) : [];
    el.choisies = PLATEFORMES.filter((p) => coche.includes(p));
    if (!el.choisies.length) { res('bloque', "Pas posté : coche où il part (Instagram, TikTok, ou les deux). Rien ne part sans ton choix."); continue; }
    if (el.choisies.includes('tiktok') && !el.tiktok?.possible) { res('bloque', `Pas posté : ${el.tiktok?.raison || PHRASE_TIKTOK_ABSENT}`); continue; }
    if (el.choisies.includes('instagram') && el.bloque) { res('bloque', 'Pas programmé : ' + (el.messages[0] || 'ce contenu ne peut pas partir.')); continue; }
    if (el.bloque_commun) { res('bloque', 'Pas programmé : ' + (el.messages_commun[0] || 'ce contenu ne peut pas partir.')); continue; }
    if (el.choisies.includes('tiktok') && el.tiktok.bloque) { res('bloque', 'Pas posté sur TikTok : ' + (el.tiktok.messages[0] || 'il ne peut pas partir.')); continue; }
    if (el.choisies.includes('tiktok')) {
      const c = choixTiktok[el.slug] && typeof choixTiktok[el.slug] === 'object' ? choixTiktok[el.slug] : {};
      el.tiktok_choix = { commentaires: c.commentaires !== false, duo: c.duo !== false, collage: c.collage !== false, consentement: c.consentement === true };
      if (!el.tiktok_choix.consentement) { res('bloque', "Pas posté : TikTok demande ta confirmation, elle se donne en cliquant pour poster."); continue; }
    }
    if (el.quand !== 'maintenant') {
      const d = dateZurich(el.quand);
      if (!d || d.getTime() < maintenant.getTime() + 10 * 60 * 1000) {
        res('bloque', "Pas programmé : l'heure choisie est passée entre-temps. Choisis-en une autre."); continue;
      }
    }

    const change = await encorePareil(el, config, executer);
    if (change) { res('bloque', 'Pas programmé : ' + change); continue; }

    // Le clic vaut enregistrement de ce qui était affiché : légendes retouchées, message retouché ou à valider.
    const ecrit = await enregistrerTextes(el, textes[el.slug], config, executer, simulation, temporaires);
    if (ecrit) { res('bloque', 'Pas programmé : ' + ecrit); continue; }

    if (simulation) {
      // publier lit les textes retouchés (légendes et message en fichiers, message tenu pour validé) : les
      // requêtes montrées sont exactement celles qui partiraient au même clic en vrai.
      const { sortie } = await executer(argsPublier(el), { ecriture: false });
      if (/^SIMULATION_OK$/m.test(sortie)) {
        const envoi = textesSimules(sortie);
        resultats.push({ slug: el.slug, statut: 'simulation', plateformes_choisies: el.choisies,
          message: `Simulation, rien n'est parti : en vrai, ${phraseQuand(el, true)}.${phraseEssai(el, true)}${phraseMot(el, true)}${phraseEcrits(el)}`,
          ...(envoi ? { envoi } : {}) });
      } else {
        const a = arret(sortie);
        const v = lireVerifier(sortie);
        const b = v.bloque[0] || v.par_plateforme.instagram.bloque[0] || v.par_plateforme.tiktok.bloque[0];
        res('erreur', a ? phrase('ARRET', a) : b ? phrase('BLOQUE', b) : phrase('ARRET', ''), (a || b || '').slice(0, 300));
      }
      continue;
    }

    const { code, sortie } = await executer([...argsPublier(el), '--envoyer', '--pousser'], { ecriture: true, timeoutMs: 30 * 60 * 1000 });
    const post = /^POST (\S+) statut=(\S+) lien=(\S+)/m.exec(sortie);
    const plats = lirePlateformes(sortie);
    const extra = { plateformes_choisies: el.choisies, ...(plats.length ? { plateformes: plats } : {}) };
    // Une plateforme a refusé, l'autre est partie (code 8, ou 6 avec une ligne ECHEC_PARTIEL) : on le dit, avec
    // « Réessayer sur <plateforme> », jamais un second envoi du post entier.
    const refusees = plats.filter((x) => x.statut === 'failed').map((x) => x.plateforme);
    const partiel = refusees.length && refusees.length < el.choisies.length && [0, 6, 8].includes(code);
    if (partiel) {
      const parties = el.choisies.filter((p) => !refusees.includes(p));
      const etat = el.quand === 'maintenant' ? 'parti' : `programmé pour ${quandLisible(el.quand)}`;
      const motPasPose = code === 6 && /^MOT_NON_POSE\b/m.test(sortie) && el.ressource;
      resultats.push({ slug: el.slug, statut: 'partiel', ...extra,
        message: `C'est ${etat} sur ${ou(parties)}, mais ${ou(refusees)} l'a refusé. Clique sur « Réessayer sur ${NOMS[refusees[0]]} » : ça renvoie seulement là, sans reposter ailleurs.${motPasPose ? ` Et le mot${el.mot ? ` ${el.mot}` : ''} n'est pas encore branché : clique sur « Brancher le mot », une seule fois.` : ''}`,
        detail: (/^ECHEC_PARTIEL .*$/m.exec(sortie) || [''])[0].slice(0, 300),
        reessayer: { slug: el.slug, plateforme: refusees[0] },
        ...(motPasPose ? { poser_mot: { slug: el.slug, ressource: el.ressource } } : {}) });
      continue;
    }
    if (code === 0 && /^FAIT$/m.test(sortie)) {
      const statut = post ? post[2] : 'programmé';
      const lien = post && post[3] !== 'à' ? post[3] : null;
      const liens = plats.filter((x) => x.lien).map((x) => (plats.length > 1 ? `${NOMS[x.plateforme]} : ${x.lien}` : x.lien));
      if (statut === 'publié') res('publié', `C'est en ligne sur ${ou(el.choisies)}.${phraseEssai(el, false)}${phraseMot(el, false)}${liens.length ? ' ' + liens.join(' ; ') : lien ? ' ' + lien : ''}`, null, extra);
      // Publié tout de suite mais pas encore sorti : la plateforme traite la vidéo (quelques minutes pour
      // une vidéo longue, vu le 2026-11-19). Ne pas dire « en ligne » avant que ce soit vrai.
      else if (el.quand === 'maintenant') {
        const n = el.choisies.length;
        res('programmé', `${el.type === 'carrousel' ? 'Ton carrousel est parti' : 'Ta vidéo est partie'} sur ${ou(el.choisies)} : ${ou(el.choisies)} ${el.type === 'carrousel' ? 'le' : 'la'} prépare${n > 1 ? 'nt' : ''}, ${el.type === 'carrousel' ? 'il' : 'elle'} apparaît sur ${n > 1 ? 'tes comptes' : 'ton compte'} d'ici quelques minutes.${phraseEssai(el, false)}${phraseMot(el, false)} Tu peux fermer ton Mac.`, null, extra);
      }
      else res('programmé', majuscule(`${phraseQuand(el, false)}.${phraseEssai(el, false)}${phraseMot(el, false)} Tu peux fermer ton Mac, tout sort à l'heure.`), null, extra);
      continue;
    }
    // Le post est parti, mais pas la règle du mot (code 6) : on le dit, et on propose « Brancher le mot »
    // (poser-mot), jamais un second envoi du post.
    if (code === 6 && /^MOT_NON_POSE\b/m.test(sortie) && el.ressource) {
      const quoi = el.quand === 'maintenant' ? `${el.type === 'carrousel' ? 'Ton carrousel est en ligne' : 'Ta vidéo est en ligne'}`
        : majuscule(phraseQuand(el, false));
      resultats.push({
        slug: el.slug, statut: 'mot_non_pose', ...extra,
        message: `${quoi}, mais le mot${el.mot ? ` ${el.mot}` : ''} n'est pas encore branché : ceux qui commentent ne reçoivent rien pour l'instant. Clique sur « Brancher le mot », une seule fois.`,
        detail: (/^MOT_NON_POSE.*$/m.exec(sortie) || [''])[0].slice(0, 300),
        poser_mot: { slug: el.slug, ressource: el.ressource },
      });
      continue;
    }
    const a = arret(sortie);
    const v = lireVerifier(sortie);
    const b = v.bloque[0] || v.par_plateforme.instagram.bloque[0] || v.par_plateforme.tiktok.bloque[0];
    if (!a && b) { res('bloque', 'Pas programmé : ' + phrase('BLOQUE', b)); continue; }
    // Reel d'essai refusé par Instagram (fonction pas ouverte sur le compte) : aucun post créé, on continue.
    if (a && /^ESSAI_REFUSE\b/.test(a)) { res('bloque', phrase('ARRET', a), a.slice(0, 300)); continue; }
    // Refus avant l'envoi (validation) : rien n'est parti, on peut continuer avec les suivants.
    if (a && /^VALIDATION_REFUSEE\b/.test(a)) { res('bloque', phrase('ARRET', a), a.slice(0, 300)); continue; }
    // Une erreur pendant l'envoi : on ne sait pas toujours ce qui est parti. On s'arrête là, sans relance.
    res('erreur', a ? phrase('ARRET', a) : `Il y a eu un souci pendant l'envoi : je ne sais pas si c'est parti. Ne relance pas, préviens ${contact()} avec le message ci-dessous.`,
      (a || sortie.trim().split('\n').slice(-2).join(' / ')).slice(0, 300));
    stop = true;
  }
  for (const f of temporaires) { try { fs.rmSync(f, { recursive: true, force: true }); } catch { /* rien */ } }
  return { simulation, resultats };
}

// Ce que le clic a enregistré (pour la phrase de simulation).
function phraseEcrits(el) {
  const verbe = el.type === 'carrousel' ? 'partirait telle quelle' : 'serait enregistrée';
  const quoi = [el.legende_retouchee ? `ta légende retouchée ${verbe}` : null,
    el.legende_tiktok_retouchee ? `ta légende TikTok retouchée ${verbe}` : null,
    el.message_retouche ? 'ton message retouché serait enregistré et validé' : el.message_dm?.a_valider && el.choisies.includes('instagram') ? 'le message serait validé' : null].filter(Boolean);
  return quoi.length ? ` Et ${quoi.join(', ')}.` : '';
}

const PHRASES_ECRITURE = {
  CHANGE: 'Le texte a changé depuis le récapitulatif (le chat l\'a peut-être retouché) : refais-le pour revoir ce qui partira.',
  SYNCHRO: 'Je n\'arrive pas à enregistrer tes textes (pas d\'internet ?) : rien n\'est parti, réessaie dans un moment.',
  CONFLIT: 'Je n\'arrive pas à enregistrer tes textes pour l\'instant : rien n\'est parti, réessaie dans un moment.',
  PAS_EN_LIGNE: 'La ressource choisie n\'est plus en ligne : choisis-en une autre, ou aucune.',
  INTROUVABLE: 'Je ne trouve plus la ressource choisie : choisis-en une autre, ou aucune.',
};

function blocageOutil(sortie) {
  const m = /^BLOQUE (\S+) ?(.*)$/m.exec(sortie || '');
  return m ? { code: m[1], texte: m[2] } : null;
}

// La légende TikTok retouchée : mêmes contrôles que zernio.py (vide, tiret long, limite de TikTok).
export function erreurLegendeTiktok(t, type) {
  const l = legendePropre(t);
  const max = LIMITES_TIKTOK[type] || LIMITES_TIKTOK.reel;
  if (!l) return 'La légende pour TikTok ne peut pas être vide.';
  if (l.includes(TIRET_LONG)) return 'La légende pour TikTok contient un tiret long : remplace-le par une virgule ou deux points.';
  if (Array.from(l).length > max) return `La légende est trop longue pour TikTok (${Array.from(l).length} caractères, ${max} au plus).`;
  return null;
}

// Enregistre, au clic, les retouches du récapitulatif et la validation du message ; rend une phrase si
// quelque chose bloque (rien n'est alors parti pour ce contenu), sinon null. Simulation : contrôles
// seuls (--essai), rien d'écrit ; les légendes retouchées passent par des fichiers temporaires. Seulement ce
// qui sert aux plateformes cochées (lot 13) : sans Instagram, ni légende Instagram ni message ; sans TikTok,
// pas de légende TikTok.
async function enregistrerTextes(el, t, config, executer, simulation, temporaires) {
  t = t && typeof t === 'object' ? t : {};
  const ig = el.choisies.includes('instagram');
  const tk = el.choisies.includes('tiktok');
  const retouches = {};
  if (ig && typeof t.legende === 'string' && legendePropre(t.legende) !== legendePropre(el.legende)) {
    retouches.legende = t.legende;
  }
  if (tk && typeof t.legende_tiktok === 'string' && legendePropre(t.legende_tiktok) !== legendePropre(el.tiktok.legende)) {
    const x = erreurLegendeTiktok(t.legende_tiktok, el.type);
    if (x) return x;
    retouches.legende_tiktok = t.legende_tiktok;
  }
  if (ig && el.message_dm) {
    if (typeof t.message === 'string' && messagePropre(versFiche(t.message)) !== messagePropre(el.message_dm.message)) retouches.message = t.message;
    if (typeof t.bouton === 'string' && t.bouton.split(/\s+/).filter(Boolean).join(' ') !== el.message_dm.bouton) retouches.bouton = t.bouton;
    if (el.liaisons && typeof t.mot === 'string' && t.mot.trim().toUpperCase() !== (el.message_dm.mot || '')) retouches.mot = t.mot.trim().toUpperCase();
  }
  const err = erreursTextes({ legende: retouches.legende, message: retouches.message, bouton: retouches.bouton, mot: retouches.mot });
  const premiere = err.legende || err.mot || err.message || err.bouton;
  if (premiere) return premiere;

  if (retouches.legende !== undefined || retouches.legende_tiktok !== undefined) {
    const e = {};
    if (retouches.legende !== undefined) { e.legende = legendePropre(retouches.legende); el.legende_retouchee = true; }
    if (retouches.legende_tiktok !== undefined) { e.legende_tiktok = legendePropre(retouches.legende_tiktok); el.legende_tiktok_retouchee = true; }
    // Simulation, ou carrousel (en vrai aussi) : rien n'est écrit dans le dépôt, zernio.py lit la légende dans un
    // fichier. Le texte d'un carrousel mis en page reste tel quel : réécrire son brief le renverrait en mise en page.
    if (simulation || el.type === 'carrousel') {
      const d = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'studio-legende-'));
      temporaires.push(d);
      if (e.legende !== undefined) { el.legende_fichier = path.join(d, 'legende.txt'); fs.writeFileSync(el.legende_fichier, e.legende + '\n'); }
      if (e.legende_tiktok !== undefined) { el.legende_tiktok_fichier = path.join(d, 'legende-tiktok.txt'); fs.writeFileSync(el.legende_tiktok_fichier, e.legende_tiktok + '\n'); }
    } else {
      const f = fichierEntree(temporaires, e);
      const { sortie } = await executer(['ecrire', el.slug, '--depuis', f, '--empreinte', el.script_empreinte, '--pousser'],
        { ecriture: false, dans: 'depot', script: 'brief.py', timeoutMs: 2 * 60 * 1000 });
      if (!/^OK /m.test(sortie)) {
        const b = blocageOutil(sortie);
        return (b && PHRASES_ECRITURE[b.code]) || `Je n'ai pas pu enregistrer ta légende : rien n'est parti. Préviens ${contact()} si ça recommence.`;
      }
    }
    if (e.legende !== undefined) el.legende = e.legende;
    if (e.legende_tiktok !== undefined) el.tiktok.legende = e.legende_tiktok;
  }

  // Avec l'outil de liaison (22/11/2026), la validation et les retouches vont dans la liaison de CE contenu
  // (--contenu) : le message des autres contenus qui offrent la même ressource ne bouge pas. Au même clic, le
  // contenu se retrouve relié à la ressource choisie.
  const parContenu = ig && el.message_dm && el.liaisons;
  const relier = parContenu && el.ressource && ressourceDuContenu(chemins(config).depot, el.slug) !== el.ressource;
  if (ig && el.message_dm && (el.message_dm.a_valider || relier || retouches.message !== undefined || retouches.bouton !== undefined || retouches.mot !== undefined)) {
    el.message_retouche = retouches.message !== undefined || retouches.bouton !== undefined || retouches.mot !== undefined;
    const args = ['valider-message', el.ressource, ...(parContenu ? ['--contenu', el.slug] : [])];
    if (el.message_dm.empreinte) args.push('--empreinte', el.message_dm.empreinte);
    if (el.message_retouche) {
      const e = {};
      if (retouches.message !== undefined) e.message = retouches.message;
      if (retouches.bouton !== undefined) e.bouton = retouches.bouton;
      if (retouches.mot !== undefined) e.mot = retouches.mot;
      args.push('--depuis', fichierEntree(temporaires, e));
    }
    args.push(simulation ? '--essai' : '--pousser');
    const { sortie } = await executer(args, { ecriture: false, dans: 'depot', script: 'zernio.py', timeoutMs: 2 * 60 * 1000 });
    if (!/^OK /m.test(sortie)) {
      const b = blocageOutil(sortie);
      if (b && b.code === 'MESSAGE') return phrase('BLOQUE', `ressource ${el.ressource} : ${b.texte}`);
      return (b && PHRASES_ECRITURE[b.code]) || `Je n'ai pas pu enregistrer ton message : rien n'est parti. Préviens ${contact()} si ça recommence.`;
    }
    // Simulation : rien n'est écrit dans la fiche, publier lit donc le message (retouché ou tel quel) dans
    // un fichier et le tient pour validé, comme le clic l'aurait fait.
    if (simulation) {
      const e = {};
      if (retouches.message !== undefined) e.message = retouches.message;
      if (retouches.bouton !== undefined) e.bouton = retouches.bouton;
      if (retouches.mot !== undefined) e.mot = retouches.mot;
      el.message_fichier = fichierEntree(temporaires, e);
    }
    // Ce qui part : le mot retouché (la phrase de résultat le cite).
    if (retouches.mot !== undefined) el.mot = retouches.mot;
  }

  // Après une écriture : la vérification relit le dépôt en ligne ; ce qui part doit être ce qui était affiché.
  if (!simulation && (el.legende_retouchee || el.legende_tiktok_retouchee || (ig && el.message_dm?.a_valider) || el.message_retouche)) {
    const { sortie } = await executer(argsVerifier(el, el.verif_plateformes ? el.choisies : null), { ecriture: false });
    const v = lireVerifier(sortie);
    const b = v.bloque[0] || v.par_plateforme.instagram.bloque[0] || v.par_plateforme.tiktok.bloque[0];
    if (b) return phrase('BLOQUE', b);
    if (ig && legendePropre(v.legende) !== legendePropre(el.legende)) return 'La légende enregistrée n\'est pas celle affichée : refais le récapitulatif.';
    if (tk && legendePropre(v.legende_tiktok) !== legendePropre(el.tiktok.legende)) return 'La légende TikTok enregistrée n\'est pas celle affichée : refais le récapitulatif.';
  }
  return null;
}

function fichierEntree(temporaires, objet) {
  const d = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'studio-textes-'));
  temporaires.push(d);
  const f = path.join(d, 'entree.json');
  fs.writeFileSync(f, JSON.stringify(objet));
  return f;
}

// ------------------------------------------------------------------ brancher le mot (rattrapage)

// Pose la règle du mot sur un post déjà parti (registre) : seulement chez un client qui a des ressources,
// au clic, une fois. En simulation : la requête est montrée, rien ne part.
export async function poserMot(slug, ressource, config, opts = {}) {
  if (!config.ressources) throw new ErreurPublication('RESSOURCES_ABSENTES', "Il n'y a pas de ressources gratuites dans ce studio.");
  if (!slugValide(slug) || !slugValide(ressource)) throw new ErreurPublication('RIEN_A_POSER', 'Je ne retrouve pas ce post ou cette ressource.');
  const simulation = enSimulation(config);
  const executer = opts.executer || ((args, o) => lancerZernio(config, args, o));
  const args = ['poser-mot', slug, '--ressource', ressource];
  const { code, sortie } = simulation
    ? await executer(args, { ecriture: false })
    : await executer([...args, '--envoyer', '--pousser'], { ecriture: true, timeoutMs: 5 * 60 * 1000 });
  if (simulation && /^SIMULATION_OK$/m.test(sortie)) {
    return { simulation, statut: 'simulation', message: "Simulation, rien n'est parti : en vrai, le mot serait branché sur ce post." };
  }
  if (!simulation && code === 0 && /^FAIT$/m.test(sortie)) {
    const m = /^MOT_POSE (\S+)/m.exec(sortie);
    return { simulation, statut: 'pose', message: `Le mot ${m ? m[1] + ' ' : ''}est branché : ceux qui commentent reçoivent la ressource.` };
  }
  const b = lireVerifier(sortie).bloque[0];
  if (b && /^règle déjà posée/.test(b)) return { simulation, statut: 'pose', message: 'Le mot était déjà branché sur ce post : rien à refaire.' };
  if (b && /^aucun post de/.test(b)) {
    throw new ErreurPublication('PAS_DE_POST', "Ce contenu n'est pas encore parti : le mot se branche au moment où tu le programmes.");
  }
  if (b && /^(aucune ressource gratuite|la ressource \S+ n'est pas en ligne)/.test(b)) throw new ErreurPublication('MOT_BLOQUE', phrase('BLOQUE', b));
  if (b) throw new ErreurPublication('MOT_BLOQUE', phrase('BLOQUE', `ressource ${ressource} : ${b}`));
  const a = arret(sortie);
  if (a) throw new ErreurPublication('MOT_ARRET', phrase('ARRET', a));
  throw new ErreurPublication('MOT_NON_POSE', `Le mot n'a pas pu être branché. Ne relance pas plusieurs fois : préviens ${contact()} avec le message ci-dessous.`);
}

// ------------------------------------------------------------------ réessayer une plateforme (lot 13)

// « Réessayer sur TikTok » (ou Instagram) : renvoie seulement la plateforme refusée d'un post déjà parti, au clic,
// une fois (`zernio.py reessayer`). En simulation : la requête est montrée, rien ne part.
export async function reessayer(slug, plateforme, config, opts = {}) {
  if (!slugValide(slug) || !PLATEFORMES.includes(plateforme)) throw new ErreurPublication('RIEN_A_REESSAYER', 'Je ne retrouve pas ce post.');
  const simulation = enSimulation(config);
  const executer = opts.executer || ((args, o) => lancerZernio(config, args, o));
  const args = ['reessayer', slug, '--plateforme', plateforme];
  const nom = NOMS[plateforme];
  const { code, sortie } = simulation
    ? await executer(args, { ecriture: false })
    : await executer([...args, '--envoyer', '--pousser'], { ecriture: true, timeoutMs: 15 * 60 * 1000 });
  if (simulation && /^SIMULATION_OK$/m.test(sortie)) {
    return { simulation, statut: 'simulation', plateforme, message: `Simulation, rien n'est parti : en vrai, je renverrais seulement sur ${nom}.` };
  }
  const p = lirePlateformes(sortie).find((x) => x.plateforme === plateforme);
  if (!simulation && code === 0 && /^FAIT$/m.test(sortie)) {
    if (p?.statut === 'publié') return { simulation, statut: 'publié', plateforme, lien: p.lien, message: `C'est en ligne sur ${nom}.${p.lien ? ' ' + p.lien : ''}` };
    return { simulation, statut: 'envoyé', plateforme, message: `C'est reparti sur ${nom} : ${nom} le prépare, il apparaît d'ici quelques minutes.` };
  }
  const b = lireVerifier(sortie).bloque[0];
  if (b && /n'a pas échoué sur/.test(b)) return { simulation, statut: 'deja', plateforme, message: `Ce post n'est plus en échec sur ${nom} : rien à refaire.` };
  if (b && /^aucun post/.test(b)) throw new ErreurPublication('PAS_DE_POST', `Ce contenu n'est pas encore parti sur ${nom}.`);
  const a = arret(sortie);
  if (a && /^ECHEC_PUBLICATION/.test(a)) {
    throw new ErreurPublication('REFUS', `${nom} l'a encore refusé. Ne relance pas en boucle : préviens ${contact()} avec le message ci-dessous.`);
  }
  if (a) throw new ErreurPublication('ARRET', phrase('ARRET', a));
  throw new ErreurPublication('REESSAI_IMPOSSIBLE', `Je n'ai pas pu renvoyer sur ${nom}. Ne relance pas plusieurs fois : préviens ${contact()}.`);
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
