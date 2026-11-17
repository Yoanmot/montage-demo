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

export function lireConfig(fichier) {
  const p = deplier(fichier || path.join(STUDIO_HOME, 'studio.config.json'));
  const c = lireJson(p);
  return {
    fichier: p,
    home: path.dirname(p),
    depot: deplier(c.depot_hoc),
    media: deplier(c.media || '~/Contenu'),
    arrivees: deplier(c.arrivees || '~/Downloads'),
    disque: c.disque_externe ? deplier(c.disque_externe) : null,
    skills: deplier(c.skills || path.join(CLIENT.dossierClaude, 'skills')),
    // Le regard sur les vignettes prend claude.modele_rangement (sonnet par défaut, contrat section 11).
    claude: { binaire: c.claude?.binaire || 'claude', modele: c.claude?.modele || null,
      modeleRangement: c.claude?.modele_rangement === undefined ? 'sonnet' : (c.claude.modele_rangement || null) },
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

export const SLUG = /^[a-z0-9-]{3,60}$/;

// ---------- Ce qui compte comme arrivée d'un tournage (lot 12) ----------
// Le dossier d'arrivée est le dossier Téléchargements de Romain (AirDrop y dépose ses fichiers) : il y a
// aussi tout le reste de sa vie. Ne compte, et ne sera jamais déplacé, que ce qui ressemble à un envoi de
// son téléphone : une vidéo (MOV, MP4) ou une photo (HEIC, JPG) arrivée après la création du plan, qui
// n'est ni un dossier, ni un lien, ni un fichier caché, ni un téléchargement venu d'internet (macOS note
// la page d'origine de ceux-là ; un AirDrop n'en a pas). Les autres fichiers ne sont jamais touchés.
export const ARRIVEES_VIDEOS = new Set(['.mov', '.mp4']);
export const ARRIVEES_PHOTOS = new Set(['.heic', '.heif', '.jpg', '.jpeg']);

export function venuDInternet(chemin) {
  if (process.platform !== 'darwin') return false;
  const r = spawnSync('/usr/bin/xattr', [chemin], { encoding: 'utf8' });
  return r.status === 0 && /^com\.apple\.metadata:kMDItemWhereFroms$/m.test(r.stdout || '');
}

// Les arrivées pertinentes : [{ nom, chemin, type: 'video' | 'photo', taille, quand }], plus les fichiers
// encore en cours de transfert (extension partielle) pour pouvoir dire « attends que l'envoi soit fini ».
export function arriveesPertinentes(dossier, depuis) {
  const r = { fichiers: [], partiels: [] };
  if (!dossier || !fs.existsSync(dossier)) return r;
  const seuil = depuis instanceof Date ? depuis.getTime() : Number(depuis) || 0;
  for (const nom of fs.readdirSync(dossier)) {
    if (nom.startsWith('.')) continue;
    const chemin = path.join(dossier, nom);
    let st;
    try { st = fs.lstatSync(chemin); } catch { continue; }
    if (st.isSymbolicLink() || st.isDirectory() || !st.isFile()) continue;
    const quand = Math.max(st.birthtimeMs || 0, st.mtimeMs || 0);
    if (quand < seuil) continue;
    const ext = path.extname(nom).toLowerCase();
    if (PARTIELS.has(ext)) { r.partiels.push(nom); continue; }
    const type = ARRIVEES_VIDEOS.has(ext) ? 'video' : ARRIVEES_PHOTOS.has(ext) ? 'photo' : null;
    if (!type || venuDInternet(chemin)) continue;
    r.fichiers.push({ nom, chemin, type, taille: st.size, quand });
  }
  r.fichiers.sort((a, b) => a.quand - b.quand || a.nom.localeCompare(b.nom));
  return r;
}
