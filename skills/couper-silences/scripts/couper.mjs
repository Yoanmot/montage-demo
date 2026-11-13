#!/usr/bin/env node
// Couper les silences et les reprises d'une vidéo face caméra (brique couper-silences du monteur de Romain).
// La transcription calée se fait sur le serveur de Yoan Mottier (seul le son part) ; la vidéo n'est jamais envoyée.
// La vidéo coupée est fabriquée par la brique rendu, en un seul passage depuis l'originale.
//
//   node couper.mjs code <code>                    enregistre le code d'accès
//   node couper.mjs transcrire <vidéo>             envoie le son, récupère le transcript calé (dossier <nom>-montage)
//   node couper.mjs suivre <dossier>               reprend l'attente d'une transcription pas finie
//   node couper.mjs compiler <dossier> [rythme]    compile cuts.json (rythme : normal | serre | tres-serre), affiche le discours final
//   node couper.mjs sans-parole <vidéo>            vidéo sans voix : toute la vidéo gardée, sans coupe ni transcription
//
// Base de temps : toujours 30 images par seconde (vidéo de 60 i/s ou à cadence variable comprise : la coupe la remet
// à 30 i/s, la brique rendu aussi). Une vidéo HDR est acceptée : la brique rendu la convertit.
// Codes de sortie : 0 ok · 2 fichier introuvable · 3 code manquant · 4 code refusé · 5 erreur serveur
//                   6 réseau · 7 outil vidéo manquant · 8 coupes refusées · 10 pas encore fini
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const API = 'https://195-15-255-230.sslip.io/v1';
const FPS = 30;   // base de temps de tout le monteur (CONTRAT)
const HOME_DIR = path.join(os.homedir(), '.montage-yoan');
const CONF = path.join(HOME_DIR, 'config');

const say = (m) => console.log(m);
function fail(code, m) { console.log(m); process.exit(code); }
const lire = (p) => fs.readFileSync(p, 'utf8').replace(/^﻿/, '');
const ecrire = (p, t) => fs.writeFileSync(p, t);
const json = (s) => { try { return JSON.parse(s); } catch { return null; } };

function getCode() { return fs.existsSync(CONF) ? lire(CONF).replace(/^CODE=/, '').trim() : ''; }
function needCode() {
  const c = getCode();
  if (!c) fail(3, "CODE_MANQUANT : demande le code d'accès envoyé par Yoan, puis lance : couper.mjs code <le code>");
  return c;
}

// Appel au serveur. Renvoie { status, body }.
async function call(chemin, { method = 'GET', headers = {}, body, timeout = 120 } = {}) {
  try {
    const r = await fetch(`${API}${chemin}`, { method, body, headers: { Authorization: `Bearer ${getCode()}`, ...headers },
      signal: AbortSignal.timeout(timeout * 1000) });
    return { status: r.status, body: await r.text() };
  } catch (e) {
    fail(6, `Connexion au serveur impossible : ${e.cause?.message || e.message}`);
  }
}
const err = (r) => { const j = json(r.body); return j && j.erreur ? j.erreur : r.body; };

// ffmpeg et ffprobe : ceux du Mac (Homebrew), installés par le prompt d'installation.
function tool(nom) {
  for (const p of [process.env[`MONTAGE_${nom.toUpperCase()}`], `/opt/homebrew/bin/${nom}`, `/usr/local/bin/${nom}`]) if (p && fs.existsSync(p)) return p;
  const w = spawnSync('which', [nom], { encoding: 'utf8' });
  if (w.status === 0 && w.stdout.trim()) return w.stdout.trim();
  fail(7, `OUTIL_MANQUANT ${nom} : installe ffmpeg (brew install ffmpeg).`);
}

const workDir = (video) => path.join(path.dirname(video), `${path.parse(video).name}-montage`);

async function cmdCode(c) {
  if (!c) fail(3, 'Usage : couper.mjs code <code>');
  fs.mkdirSync(HOME_DIR, { recursive: true });
  ecrire(CONF, `CODE=${c}`);
  const r = await call('/compte');
  if (r.status !== 200) { fs.rmSync(CONF, { force: true }); fail(4, `CODE_REFUSÉ : ${err(r)}`); }
  say(`Code enregistré pour ${json(r.body).nom}.`);
}

async function cmdTranscrire(video) {
  if (!video || !fs.existsSync(video)) fail(2, `VIDÉO_INTROUVABLE : ${video}`);
  video = path.resolve(video);
  needCode();
  const ffmpeg = tool('ffmpeg'), ffprobe = tool('ffprobe');
  const w = workDir(video);
  fs.mkdirSync(w, { recursive: true });

  // Ce qu'il faut savoir de la vidéo pour la recouper à l'identique
  const p = JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
    'stream=width,height,r_frame_rate,avg_frame_rate,codec_name,color_transfer,color_primaries,color_space,pix_fmt',
    '-of', 'json', video], { encoding: 'utf8' }));
  const s = p.streams[0];
  const cadence = (r) => { const [a, b] = String(r || '0/1').split('/').map(Number); return b ? a / b : 0; };
  const hdr = ['smpte2084', 'arib-std-b67'].includes(s.color_transfer);
  // Rotation (vidéo de téléphone tenue droite) : ffprobe donne la taille stockée, le rendu voit l'image tournée.
  let largeur = s.width, hauteur = s.height;
  let rot = 0;
  try {
    rot = JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream_side_data=rotation',
      '-of', 'json', video], { encoding: 'utf8' })).streams?.[0]?.side_data_list?.find((d) => 'rotation' in d)?.rotation || 0;
  } catch { rot = 0; }
  if (rot && Math.abs(rot) % 180 === 90) [largeur, hauteur] = [hauteur, largeur];
  const info = { video, fps: FPS, fps_source: +cadence(s.avg_frame_rate || s.r_frame_rate).toFixed(3), largeur, hauteur, hdr,
    color_transfer: s.color_transfer ?? null, color_primaries: s.color_primaries ?? null, color_space: s.color_space ?? null };
  const infoP = path.join(w, 'info.json');
  ecrire(infoP, JSON.stringify(info, null, 2));

  say('Extraction du son…');
  const audio = path.join(w, 'audio.flac');
  const ex = spawnSync(ffmpeg, ['-nostdin', '-v', 'error', '-y', '-i', video, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'flac', audio]);
  if (ex.status !== 0) fail(2, 'Lecture de la vidéo impossible (fichier abîmé ?).');
  const donnees = fs.readFileSync(audio);
  say(`Envoi du son au serveur (${(donnees.length / 1048576).toFixed(1).replace('.', ',')} Mo)…`);
  const r = await call('/transcriptions', { method: 'POST', body: donnees, timeout: 600,
    headers: { 'X-Filename': encodeURIComponent(path.basename(video)), 'Content-Type': 'application/octet-stream' } });
  fs.rmSync(audio, { force: true });
  if (r.status !== 202) fail(5, `ENVOI_REFUSÉ : ${err(r)}`);
  info.id = json(r.body).id;
  ecrire(infoP, JSON.stringify(info, null, 2));
  await cmdSuivre(w);
}

async function cmdSuivre(w) {
  if (!w || !fs.existsSync(path.join(w, 'info.json'))) fail(2, `DOSSIER_INTROUVABLE : ${w}`);
  w = path.resolve(w);
  const info = JSON.parse(lire(path.join(w, 'info.json')));
  const debut = Date.now(); let dernier = '', j;
  for (;;) {
    const r = await call(`/transcriptions/${info.id}`);
    if (r.status !== 200) fail(5, `ERREUR : ${err(r)}`);
    j = json(r.body);
    if (j.etape && j.etape !== dernier) { say(`… ${j.etape}`); dernier = j.etape; }
    if (j.etat === 'fini') break;
    if (j.etat === 'erreur') fail(5, `ERREUR_TRANSCRIPTION : ${j.message}`);
    if ((Date.now() - debut) / 1000 > 540) fail(10, `PAS_FINI : relance « couper.mjs suivre "${w}" »`);
    await new Promise((ok) => setTimeout(ok, 4000));
  }
  ecrire(path.join(w, 'draft.md'), nettoieDraft(j.draft));
  ecrire(path.join(w, 'words.json'), JSON.stringify(j.words));
  say(`PRÊT dossier=${w}`);
  say(`Lis ${path.join(w, 'draft.md')}, décide les coupes, écris ${path.join(w, 'cuts.json')}, puis lance : couper.mjs compiler "${w}"`);
}

// Le brouillon du serveur renvoie à son fichier de règles (regles-de-coupe.md), qui n'existe pas ici :
// les règles sont l'étape 3 du SKILL couper-silences.
function nettoieDraft(d) {
  return String(d)
    .replaceAll('trancher selon regles-de-coupe.md §1/§2/§8 : anaphore rhétorique = GARDER', "trancher selon les règles de l'étape 3 du SKILL couper-silences : répétition voulue = GARDER")
    .replaceAll(' Voir references/regles-de-coupe.md.', ' Règles : étape 3 du SKILL couper-silences.')
    .replace(/(references\/)?regles-de-coupe\.md( §[0-9/§]+)?/g, "les règles de l'étape 3 du SKILL couper-silences");
}

// La sortie du compilateur du serveur, nettoyée :
// - sans les lignes « -> /var/lib/montage/... » (chemins du serveur) ni les renvois « (§8) » ;
// - sans son alerte « % de la durée source coupée » : elle compte aussi les blancs coupés automatiquement et le silence
//   avant la première phrase, donc elle sonnait sur une vidéo sans aucune reprise. Remplacée par la part de la parole
//   retirée par cuts.json (reprises, faux départs, début et fin), la seule qui signale un problème de prise.
function nettoieSortie(sortie, cuts, w) {
  let out = String(sortie || '').split('\n')
    .filter((l) => !/^\s*-> /.test(l) && !/de la durée source coupée|de la parole retirée par cuts\.json/.test(l))
    .map((l) => l.replace(/ \(§[0-9]+\)/g, '')).join('\n').trimEnd();
  const wf = path.join(w, 'words.json');
  if (fs.existsSync(wf) && (cuts.cuts || []).length) {
    const mots = JSON.parse(lire(wf)).words;
    const parle = mots.filter((m) => String(m.text).trim());
    if (parle.length) {
      const total = parle.at(-1).end - parle[0].start;
      let retire = 0;
      for (const c of cuts.cuts) {
        const a = Math.trunc(c[0]), b = Math.trunc(c.at(-1));
        if (a < 0 || b >= mots.length || b < a) continue;
        retire += mots[b].end - mots[a].start;
      }
      const pct = Math.round(100 * retire / total);
      if (total > 0 && pct > 20) out += `\n⚠ ${pct} % de la parole retirée par cuts.json (plus de 20 %) : vérifie que chaque coupe enlève un raté (reprise, faux départ) et pas du propos.`;
    }
  }
  return out;
}

async function cmdCompiler(w, rythme = 'serre') {
  if (!w || !fs.existsSync(path.join(w, 'info.json'))) fail(2, `DOSSIER_INTROUVABLE : ${w}`);
  w = path.resolve(w);
  const info = JSON.parse(lire(path.join(w, 'info.json')));
  const cutsP = path.join(w, 'cuts.json');
  if (!fs.existsSync(cutsP)) fail(2, `cuts.json manquant dans ${w}`);
  const cuts = JSON.parse(lire(cutsP));
  // fps : toujours 30 (une ancienne info.json à 60 i/s se recompile à 30, base du monteur)
  const corps = { cuts: cuts.cuts || [], holds: (cuts.holds || []).filter(Boolean), fps: FPS, rythme };
  if (cuts.force) corps.force = true;
  const r = await call(`/transcriptions/${info.id}/coupes`, { method: 'POST', body: JSON.stringify(corps), headers: { 'Content-Type': 'application/json' } });
  const j = json(r.body);
  if (r.status === 422) { say(j?.sortie ?? ''); fail(8, 'COUPES_REFUSÉES : corrige cuts.json (un passage gardé doit faire au moins 0,3 s) et relance.'); }
  if (r.status !== 200) fail(5, `ERREUR : ${err(r)}`);
  if (info.fps !== FPS) { info.fps_source = info.fps_source ?? info.fps; info.fps = FPS; ecrire(path.join(w, 'info.json'), JSON.stringify(info, null, 2)); }
  ecrire(path.join(w, 'edl.json'), JSON.stringify(j.edl, null, 2));
  ecrire(path.join(w, 'words.cut.json'), JSON.stringify(j.words_cut));
  ecrire(path.join(w, 'filtre.txt'), j.filtre);
  const sortie = nettoieSortie(j.sortie, cuts, w);
  ecrire(path.join(w, 'discours.txt'), sortie);
  say(sortie);
  say('');
  say(`COMPILÉ : ${j.edl.stats.segments} morceaux, ${j.edl.stats.out_duration_s} s gardées (rythme ${rythme}). Relis chaque jointure « // », puis rends la main au monteur : "${w}"`);
}

// Vidéo sans parole (démo muette, reel sur musique) : le serveur ne sait rien transcrire. On garde toute la vidéo,
// sans coupe, à 30 i/s, avec son son d'origine (ou un silence s'il n'y en a pas) : mêmes fichiers que compiler, pour
// que les autres briques et le rendu travaillent pareil (aucun mot : pas de sous-titres ni de zooms sur des mots).
async function cmdSansParole(video) {
  if (!video || !fs.existsSync(video)) fail(2, `VIDÉO_INTROUVABLE : ${video}`);
  video = path.resolve(video);
  const ffprobe = tool('ffprobe');
  const w = workDir(video);
  fs.mkdirSync(w, { recursive: true });
  const sonde = (args) => JSON.parse(execFileSync(ffprobe, ['-v', 'error', ...args, '-of', 'json', video], { encoding: 'utf8' }));
  const v = sonde(['-select_streams', 'v:0', '-show_entries', 'stream=width,height,duration,color_transfer,color_primaries,color_space:format=duration']);
  const s = v.streams[0];
  const duree = +(s.duration || v.format.duration);
  const avecSon = sonde(['-select_streams', 'a', '-show_entries', 'stream=index']).streams.length > 0;
  const N = Math.floor(duree * FPS + 1e-6);
  const info = { video, fps: FPS, largeur: s.width, hauteur: s.height, hdr: ['smpte2084', 'arib-std-b67'].includes(s.color_transfer),
    color_transfer: s.color_transfer ?? null, color_primaries: s.color_primaries ?? null, color_space: s.color_space ?? null, sans_parole: true };
  ecrire(path.join(w, 'info.json'), JSON.stringify(info, null, 2));
  const d = (N / FPS).toFixed(6);
  ecrire(path.join(w, 'filtre.txt'), `[0:v]fps=${FPS}:round=near,trim=end_frame=${N},setpts=PTS-STARTPTS[v];\n`
    + (avecSon ? `[0:a]aresample=48000,atrim=end=${d},apad=whole_dur=${d},asetpts=PTS-STARTPTS[a]`
      : `anullsrc=r=48000:cl=mono,atrim=end=${d}[a]`));
  const seg = { i: 0, srcInF: 0, srcOutF: N, outInF: 0, outOutF: N, srcIn: 0, srcOut: N / FPS, outIn: 0, outOut: N / FPS, words: [], contiguous_prev: false };
  ecrire(path.join(w, 'edl.json'), JSON.stringify({ fps: FPS, segments: [seg], joints_out_s: [], stats: { segments: 1, kept_words: 0, total_words: 0, out_frames: N, out_duration_s: +(N / FPS).toFixed(3), warnings: [] } }, null, 2));
  ecrire(path.join(w, 'words.cut.json'), JSON.stringify({ language: null, text: '', words: [] }));
  ecrire(path.join(w, 'cuts.json'), JSON.stringify({ cuts: [] }));
  say(`PRÊT_SANS_PAROLE dossier=${w} : ${N} images (${(N / FPS).toFixed(1)} s) gardées sans coupe, ${avecSon ? 'son d\'origine gardé' : 'pas de son (silence)'}.`);
}

const [commande, a1, a2] = process.argv.slice(2);
switch (commande) {
  case 'code': await cmdCode(a1); break;
  case 'transcrire': await cmdTranscrire(a1); break;
  case 'suivre': await cmdSuivre(a1); break;
  case 'compiler': await cmdCompiler(a1, a2 || 'serre'); break;
  case 'sans-parole': await cmdSansParole(a1); break;
  default: say('Usage : couper.mjs code <code> | transcrire <vidéo> | suivre <dossier> | compiler <dossier> [rythme] | sans-parole <vidéo>'); process.exit(1);
}
