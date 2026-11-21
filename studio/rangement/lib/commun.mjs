// Outils communs du rangement des rushs (lot 4 du studio) : config, JSON atomique, dates de Zurich, ffprobe,
// types de fichiers, verrou. Aucune clé, aucune donnée de Romain ici (dépôt public).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';

export const VIDEOS = new Set(['.mov', '.mp4', '.m4v', '.hevc']);
export const PHOTOS = new Set(['.jpg', '.jpeg', '.heic', '.heif', '.png', '.dng']);
// Fichiers pas encore arrivés en entier (téléchargement ou transfert en cours).
export const PARTIELS = new Set(['.download', '.crdownload', '.part', '.partial', '.tmp']);

import { chargerClient } from '../../serveur/client.mjs';
import { genreDe } from './reconnaitre.mjs';

// Le client du studio (STUDIO_CLIENT, défaut romain) : racine d'installation et dossier de config Claude.
const CLIENT = chargerClient({ maison: os.homedir() });
export const STUDIO_HOME = process.env.STUDIO_HOME ? deplierTot(process.env.STUDIO_HOME) : path.join(CLIENT.racineAbs, 'studio');

function deplierTot(p) {
  return p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : path.resolve(p);
}

export function deplier(p) {
  if (p == null) return p;
  p = String(p);
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return path.resolve(p);
}

export function lireJson(p, defaut = undefined) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, '')); }
  catch (e) { if (defaut !== undefined) return defaut; throw e; }
}

// Écriture atomique : fichier temporaire dans le même dossier puis rename (contrat, en-tête).
export function ecrireJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = path.join(path.dirname(p), `.${path.basename(p)}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  fs.renameSync(tmp, p);
}

// Un modèle fixé par le fichier du client (null s'il n'en fixe pas).
function modeleClient(cle) {
  const v = CLIENT.claude?.[cle];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export function lireConfig(fichier) {
  const p = deplier(fichier || path.join(STUDIO_HOME, 'studio.config.json'));
  const c = lireJson(p);
  return {
    fichier: p,
    home: path.dirname(p),
    depot: deplier(c.depot_hoc),
    media: deplier(c.media || '~/Contenu'),
    // La Galerie (lot 15) : à côté du dossier média sauf réglage contraire (`galerie`).
    galerie: c.galerie ? deplier(c.galerie) : path.join(path.dirname(deplier(c.media || '~/Contenu')), 'Galerie'),
    arrivees: deplier(c.arrivees || '~/Downloads'),
    disque: c.disque_externe ? deplier(c.disque_externe) : null,
    skills: deplier(c.skills || path.join(CLIENT.dossierClaude, 'skills')),
    // Le regard sur les vignettes prend claude.modele_rangement (contrat section 11) : celui de la config s'il est
    // fixé, sinon celui du fichier du client (clients/<id>.json, « claude »), sinon sonnet (absent) ou rien (null).
    claude: { binaire: c.claude?.binaire || 'claude', modele: c.claude?.modele || modeleClient('modele') || null,
      modeleRangement: c.claude?.modele_rangement || modeleClient('modele_rangement')
        || (c.claude?.modele_rangement === undefined ? 'sonnet' : null) },
    simulation: process.env.STUDIO_SIMULATION === '1' || c.publication?.simulation === true,
    brut: c,
  };
}

// Dates : ISO 8601 au fuseau de Zurich (contrat, en-tête).
const FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
function partsZurich(d) {
  const o = {};
  for (const { type, value } of FMT.formatToParts(d)) o[type] = value;
  return o;
}
export function isoZurich(d = new Date()) {
  const o = partsZurich(d);
  const local = Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour, +o.minute, +o.second);
  const off = Math.round((local - Math.floor(d.getTime() / 1000) * 1000) / 60000);
  const s = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return `${o.year}-${o.month}-${o.day}T${o.hour}:${o.minute}:${o.second}${s}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}
export function horodatageZurich(d) {   // AAAAMMJJ-HHMMSS (clip_id)
  const o = partsZurich(d);
  return `${o.year}${o.month}${o.day}-${o.hour}${o.minute}${o.second}`;
}
// « 2026-11-16T14:30:12+0100 » (iPhone) ou « 2026-11-16T13:30:12.000000Z » (creation_time) -> Date
export function lireDate(s) {
  if (!s) return null;
  const t = String(s).trim().replace(/([+-]\d{2})(\d{2})$/, '$1:$2').replace(' ', 'T');
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
}

export function clipId(date) {
  const lettres = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let r = '';
  for (const b of crypto.randomBytes(4)) r += lettres[b % lettres.length];
  return `${horodatageZurich(date)}-${r}`;
}

export function outil(nom) {
  for (const p of [process.env[`MONTAGE_${nom.toUpperCase()}`], `/opt/homebrew/bin/${nom}`, `/usr/local/bin/${nom}`]) {
    if (p && fs.existsSync(p)) return p;
  }
  const w = spawnSync('which', [nom], { encoding: 'utf8' });
  if (w.status === 0 && w.stdout.trim()) return w.stdout.trim();
  throw new Error(`OUTIL_MANQUANT ${nom}`);
}

// Lance un programme et attend sa fin par son PID (jamais par un motif de commande). Le groupe de processus est tué
// au dépassement du délai.
export function lancer(cmd, args, { cwd, entree, delaiS = 600, env } = {}) {
  return new Promise((ok) => {
    const p = spawn(cmd, args, { cwd, env: env || process.env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '', fini = false;
    const minuteur = setTimeout(() => { if (!fini) { try { process.kill(-p.pid, 'SIGKILL'); } catch {} } }, delaiS * 1000);
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', (e) => { fini = true; clearTimeout(minuteur); ok({ code: -1, out, err: err + String(e.message) }); });
    p.on('close', (code, signal) => { fini = true; clearTimeout(minuteur); ok({ code: code ?? (signal ? 128 : -1), out, err }); });
    p.stdin.on('error', () => {});
    if (entree != null) p.stdin.end(entree); else p.stdin.end();
  });
}

// Métadonnées d'une vidéo : date de prise (com.apple.quicktime.creationdate d'abord), durée, orientation, son.
export function sonder(fichier) {
  const r = spawnSync(outil('ffprobe'), ['-v', 'error', '-show_entries',
    'format=duration:format_tags:stream=codec_type,width,height:stream_tags=creation_time:stream_side_data=rotation',
    '-of', 'json', fichier], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  let j;
  try { j = JSON.parse(r.stdout); } catch { return null; }
  const v = (j.streams || []).find((s) => s.codec_type === 'video');
  if (!v || !v.width) return null;
  const tags = j.format?.tags || {};
  const date = lireDate(tags['com.apple.quicktime.creationdate'])
    || lireDate(tags.creation_time) || lireDate(v.tags?.creation_time);
  const rot = Number((v.side_data_list || []).find((d) => 'rotation' in d)?.rotation || 0);
  let [l, h] = [v.width, v.height];
  if (Math.abs(rot) % 180 === 90) [l, h] = [h, l];
  const duree = Number(j.format?.duration || 0);
  return {
    date, source_date: tags['com.apple.quicktime.creationdate'] ? 'creationdate' : (date ? 'creation_time' : null),
    duree_s: Math.round(duree * 10) / 10, duree,
    orientation: h > l ? 'portrait' : (h === l ? 'carre' : 'paysage'),
    son: (j.streams || []).some((s) => s.codec_type === 'audio'),
  };
}

export function typeFichier(nom) {
  const ext = path.extname(nom).toLowerCase();
  if (VIDEOS.has(ext)) return 'video';
  if (PHOTOS.has(ext)) return 'photo';
  if (PARTIELS.has(ext)) return 'partiel';
  return null;
}

export function sha256(fichier) {
  return new Promise((ok, ko) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(fichier).on('data', (d) => h.update(d)).on('end', () => ok(h.digest('hex'))).on('error', ko);
  });
}

// Déplace un fichier ; d'un disque à l'autre : copie, vérification (taille), puis suppression de l'original.
export function deplacer(de, vers) {
  fs.mkdirSync(path.dirname(vers), { recursive: true });
  if (fs.existsSync(vers)) throw new Error(`destination déjà prise : ${vers}`);
  try { fs.renameSync(de, vers); }
  catch (e) {
    if (e.code !== 'EXDEV') throw e;
    fs.copyFileSync(de, vers, fs.constants.COPYFILE_EXCL);
    if (fs.statSync(de).size !== fs.statSync(vers).size) { fs.rmSync(vers, { force: true }); throw new Error('copie incomplète'); }
    fs.unlinkSync(de);
  }
}

// Nom libre dans un dossier : IMG_1.MOV, sinon IMG_1-2.MOV, IMG_1-3.MOV...
export function nomLibre(dossier, nom) {
  const { name, ext } = path.parse(nom);
  let n = 1, c = nom;
  while (fs.existsSync(path.join(dossier, c)) || estLien(path.join(dossier, c))) c = `${name}-${++n}${ext}`;
  return c;
}
export function estLien(p) { try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; } }

// Verrou : un seul rangement ou archivage à la fois sur un même dossier média.
export function prendreVerrou(media) {
  fs.mkdirSync(media, { recursive: true });
  const p = path.join(media, '.rangement.lock');
  for (let essai = 0; essai < 2; essai++) {
    try {
      const fd = fs.openSync(p, 'wx');
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      const liberer = () => { try { if (fs.readFileSync(p, 'utf8') === String(process.pid)) fs.unlinkSync(p); } catch {} };
      process.on('exit', liberer);
      return liberer;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const pid = Number(fs.readFileSync(p, 'utf8'));
      let vivant = false;
      try { process.kill(pid, 0); vivant = true; } catch (k) { vivant = k.code === 'EPERM'; }
      if (vivant) return null;
      fs.rmSync(p, { force: true });
    }
  }
  return null;
}

// Un rangement tient-il le verrou en ce moment (processus vivant) ? Un verrou laissé par un processus mort ne compte pas.
export function verrouPris(media) {
  let pid;
  try { pid = Number(fs.readFileSync(path.join(media, '.rangement.lock'), 'utf8')); } catch { return false; }
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (k) { return k.code === 'EPERM'; }
}

export const SLUG = /^[a-z0-9-]{3,60}$/;

// ---------- Ce qui compte comme arrivée d'un tournage (lot 12) ----------
// Le dossier d'arrivée est le dossier Téléchargements de Romain (AirDrop y dépose ses fichiers) : il y a
// aussi tout le reste de sa vie. Ne compte, et ne sera jamais déplacé, que ce qui ressemble à un envoi de
// son téléphone : une vidéo (MOV, MP4) ou une photo (HEIC, JPG) arrivée après la création du plan, qui
// n'est ni un dossier, ni un lien, ni un fichier caché, ni un téléchargement venu d'internet (macOS note
// la page d'origine de ceux-là ; un AirDrop n'en a pas). Les autres fichiers ne sont jamais touchés.
export const ARRIVEES_VIDEOS = new Set(['.mov', '.mp4']);
export const ARRIVEES_PHOTOS = new Set(['.heic', '.heif', '.jpg', '.jpeg']);
// Un mémo vocal (2026-11-20) : la voix d'un reel en plans filmés avec sa voix, enregistrée avec Dictaphone. Compté
// seulement quand le plan attend une voix (option audio, voir voixAttendues) : sinon un fichier audio de ses
// Téléchargements n'est jamais lu, nommé ni déplacé.
export const ARRIVEES_AUDIOS = new Set(['.m4a', '.mp3', '.wav', '.aac']);

// Les attributs étendus d'un fichier (noms seulement), et la quarantaine que macOS pose à la réception.
function attributs(chemin) {
  if (process.platform !== 'darwin') return new Set();
  const r = spawnSync('/usr/bin/xattr', [chemin], { encoding: 'utf8' });
  return new Set(r.status === 0 ? (r.stdout || '').split('\n').filter(Boolean) : []);
}

export function venuDInternet(chemin) {
  return attributs(chemin).has('com.apple.metadata:kMDItemWhereFroms');
}

// « 0081;6afca6b7;sharingd;<uuid> » : drapeaux, instant de réception (secondes, en hexadécimal), qui l'a posée.
export function quarantaine(chemin) {
  const r = spawnSync('/usr/bin/xattr', ['-p', 'com.apple.quarantine', chemin], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  const [drapeaux, hex, agent] = String(r.stdout || '').trim().split(';');
  const s = parseInt(hex, 16);
  return { drapeaux: drapeaux || '', quand: Number.isFinite(s) && s > 0 ? s * 1000 : null, agent: agent || '' };
}

// Une copie du Finder en cours : type « brok » dans com.apple.FinderInfo.
function copieFinderEnCours(chemin) {
  const r = spawnSync('/usr/bin/xattr', ['-px', 'com.apple.FinderInfo', chemin], { encoding: 'utf8' });
  return r.status === 0 && /^62\s*72\s*6F\s*6B/i.test(String(r.stdout || '').trim());
}

// Ce qu'un AirDrop fait vraiment sur macOS 15 (journal de sharingd relu le 2026-11-18, essai de Yoan) :
//  - au début, le fichier est créé tout de suite dans Téléchargements sous son NOM FINAL (IMG_7254.mov), vide,
//    et grossit pendant tout le transfert (plusieurs minutes pour une grosse vidéo), sans extension temporaire ;
//  - à la fin seulement, sharingd pose la quarantaine « 0081;<instant>;sharingd;… » puis remet au fichier les
//    dates de l'iPhone : création et modification redeviennent la date de prise de la vidéo (16 août pour une
//    vidéo filmée le 16 août), seule la date de changement (ctime) dit qu'il vient d'arriver.
// Donc : un fichier reçu par AirDrop est fini quand sa quarantaine « sharingd » est là, et il est arrivé à
// l'instant écrit dans cette quarantaine (pas à sa date de création). Sans cette quarantaine (copie par un
// autre moyen), un fichier qui a bougé il y a moins de ARRIVEES_CALME_S secondes (20 par défaut) est encore
// en train d'arriver.
export const CALME_S = () => Number(process.env.ARRIVEES_CALME_S ?? 20);

// Les arrivées pertinentes : [{ nom, chemin, type: 'video' | 'photo' | 'audio', taille, quand }], les fichiers encore en
// cours de réception (en_cours : même forme, taille du moment) et ceux à extension partielle (partiels : noms),
// pour pouvoir dire « attends que l'envoi soit fini ». Un fichier en cours n'est jamais compté comme reçu.
// audio : compter aussi les mémos vocaux (seulement quand le plan attend une voix, voir voixAttendues).
export function arriveesPertinentes(dossier, depuis, { maintenant = Date.now(), audio = false } = {}) {
  const r = { fichiers: [], partiels: [], en_cours: [] };
  if (!dossier || !fs.existsSync(dossier)) return r;
  const seuil = depuis instanceof Date ? depuis.getTime() : Number(depuis) || 0;
  const calme = CALME_S() * 1000;
  for (const nom of fs.readdirSync(dossier)) {
    if (nom.startsWith('.')) continue;
    const chemin = path.join(dossier, nom);
    let st;
    try { st = fs.lstatSync(chemin); } catch { continue; }
    if (st.isSymbolicLink() || st.isDirectory() || !st.isFile()) continue;
    const ext = path.extname(nom).toLowerCase();
    const type = ARRIVEES_VIDEOS.has(ext) ? 'video' : ARRIVEES_PHOTOS.has(ext) ? 'photo'
      : audio && ARRIVEES_AUDIOS.has(ext) ? 'audio' : null;
    const cree = Math.max(st.birthtimeMs || 0, st.mtimeMs || 0);
    // La date de changement est toujours au moins l'instant d'arrivée : en dessous du seuil, rien de neuf.
    if (Math.max(cree, st.ctimeMs || 0) < seuil) continue;
    if (PARTIELS.has(ext)) { if (cree >= seuil) r.partiels.push(nom); continue; }
    if (!type) continue;
    const attrs = attributs(chemin);
    if (attrs.has('com.apple.metadata:kMDItemWhereFroms')) continue;   // téléchargé d'internet
    const q = attrs.has('com.apple.quarantine') ? quarantaine(chemin) : null;
    const airdrop = Boolean(q && /sharingd/i.test(q.agent));
    const quand = airdrop && q.quand ? q.quand : cree;
    if (quand < seuil) continue;
    const bouge = calme > 0 && maintenant - Math.max(st.mtimeMs || 0, st.ctimeMs || 0) < calme;
    const enCours = st.size === 0
      || attrs.has('com.apple.progress.fractionCompleted')
      || (attrs.has('com.apple.FinderInfo') && copieFinderEnCours(chemin))
      || (!airdrop && bouge);
    (enCours ? r.en_cours : r.fichiers).push({ nom, chemin, type, taille: st.size, quand });
  }
  r.fichiers.sort((a, b) => a.quand - b.quand || a.nom.localeCompare(b.nom));
  r.en_cours.sort((a, b) => a.nom.localeCompare(b.nom));
  return r;
}

// ---------- La voix d'un reel en plans filmés avec sa voix (2026-11-20) ----------

// Les contenus du plan t qui attendent encore leur voix : reel « plans-voix » avec une prise face (sa voix) à filmer,
// et pas encore de vidéo dans son dossier face/. Vide : aucun mémo vocal n'est attendu, l'audio reste ignoré.
export function voixAttendues(config, t) {
  const slugs = new Set();
  for (const p of t?.prises || []) {
    if (p.type !== 'face' || p.deja_en_bibliotheque) continue;
    for (const { slug } of p.contenus || []) {
      if (!SLUG.test(String(slug || '')) || slugs.has(slug)) continue;
      const dossier = path.join(config.depot, 'contenus', slug);
      let md = null;
      try { md = fs.readFileSync(path.join(dossier, 'script.md'), 'utf8'); } catch { /* pas de script */ }
      if (genreDe(lireJson(path.join(dossier, 'etat.json'), null), md) !== 'plans-voix') continue;
      const face = path.join(config.media, slug, 'face');
      let noms = [];
      try { noms = fs.readdirSync(face); } catch { /* pas encore de dossier */ }
      if (!noms.some((n) => !n.startsWith('.') && typeFichier(n) === 'video' && !/-monte(-\d+)?\.mp4$/i.test(n) && !/-coupe/i.test(n))) slugs.add(slug);
    }
  }
  return [...slugs];
}

// Un mémo vocal lisible : sa durée (secondes), ou null s'il n'a pas de son qu'on sait lire.
export function sonderAudio(fichier) {
  const r = spawnSync(outil('ffprobe'), ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type', '-of', 'json', fichier], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  let j;
  try { j = JSON.parse(r.stdout); } catch { return null; }
  if (!(j.streams || []).some((s) => s.codec_type === 'audio')) return null;
  const duree = Number(j.format?.duration || 0);
  return duree > 0 ? duree : null;
}

// Le monteur part d'une vidéo : le mémo devient une vidéo verticale noire avec sa voix (l'image ne sert pas, ses
// clips la couvrent). Même date que le mémo, pour que la transcription déjà faite resserve au passage suivant.
export function voixEnVideo(audio, sortie) {
  const r = spawnSync(outil('ffmpeg'), ['-nostdin', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=black:s=1080x1920:r=30',
    '-i', audio, '-map', '0:v', '-map', '1:a', '-shortest', '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'stillimage',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', sortie], { encoding: 'utf8' });
  if (r.status !== 0 || !fs.existsSync(sortie)) { fs.rmSync(sortie, { force: true }); return false; }
  try { const st = fs.statSync(audio); fs.utimesSync(sortie, st.atime, st.mtime); } catch { /* date laissée */ }
  return true;
}
