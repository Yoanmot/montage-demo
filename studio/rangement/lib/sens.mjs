// Ce que le rangement « entend » et « voit » : transcription (brique couper-silences, même serveur, même code
// d'accès, gardé par elle dans ~/.montage-yoan/config), vignettes (3 images par clip, mêmes instants que la brique
// b-roll), et le regard du modèle sur les vignettes (session claude -p courte, sans aucun outil, images envoyées dans
// le message). Aucune clé ici.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { lancer, outil, lireJson, ecrireJson } from './commun.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));

export function cheminCouper(config) {
  const candidats = [process.env.RANGEMENT_COUPER,
    path.resolve(ICI, '../../../skills/couper-silences/scripts/couper.mjs'),
    config?.skills && path.join(config.skills, 'couper-silences/scripts/couper.mjs')];
  return candidats.find((p) => p && fs.existsSync(p)) || null;
}

function cleFichier(f) {
  const s = fs.statSync(f);
  return crypto.createHash('sha1').update(`${path.basename(f)}|${s.size}|${Math.round(s.mtimeMs)}`).digest('hex').slice(0, 20);
}

// Transcrit une vidéo par la brique couper-silences, sans rien écrire à côté de la vidéo : on lui donne un lien
// dans un dossier de travail temporaire (elle écrit son dossier <nom>-montage à côté du lien).
// Renvoie { ok: true, texte } (texte vide = pas de parole) ou { ok: false, detail }.
export async function transcrire(fichier, config) {
  const cacheDir = path.join(config.home, 'cache-rangement', 'transcriptions');
  const cache = path.join(cacheDir, `${cleFichier(fichier)}.json`);
  const deja = lireJson(cache, null);
  if (deja && typeof deja.texte === 'string') return { ok: true, texte: deja.texte, cache: true };
  const couper = cheminCouper(config);
  if (!couper) return { ok: false, detail: 'brique couper-silences introuvable' };
  const travail = fs.mkdtempSync(path.join(os.tmpdir(), 'rangement-tr-'));
  try {
    const lien = path.join(travail, path.basename(fichier));
    fs.symlinkSync(path.resolve(fichier), lien);
    // Le serveur ne prend qu'une vidéo à la fois par compte (le monteur peut aussi être en train d'en envoyer une) :
    // on attend son tour, 10 minutes au plus.
    let r;
    for (let essai = 0; essai < 120; essai++) {
      r = await lancer(process.execPath, [couper, 'transcrire', lien], { cwd: travail, delaiS: 660 });
      if (!(r.code === 5 && /déjà en cours/i.test(r.out))) break;
      await new Promise((ok) => setTimeout(ok, 5000));
    }
    const dossier = path.join(travail, `${path.parse(lien).name}-montage`);
    for (let essai = 0; r.code === 10 && essai < 2; essai++) {
      r = await lancer(process.execPath, [couper, 'suivre', dossier], { cwd: travail, delaiS: 660 });
    }
    let texte;
    if (r.code === 0) {
      const w = lireJson(path.join(dossier, 'words.json'), null);
      texte = (w?.words || []).map((m) => String(m.text || '')).join(' ').trim();
    } else if (r.code === 5 && /ERREUR_TRANSCRIPTION/.test(r.out)) {
      texte = '';   // le serveur n'a trouvé aucune parole
    } else {
      const ligne = (r.out + r.err).trim().split('\n').filter(Boolean).at(-1) || `code ${r.code}`;
      return { ok: false, detail: ligne.slice(0, 200) };
    }
    ecrireJson(cache, { version: 1, fichier: path.basename(fichier), texte, le: new Date().toISOString() });
    return { ok: true, texte };
  } finally {
    fs.rmSync(travail, { recursive: true, force: true });
  }
}

// Trois images d'un clip (début, milieu, fin : mêmes instants que « b-roll.py vignettes »), 360 px de haut.
export function vignettes(fichier, duree, versPrefixe) {
  const ff = outil('ffmpeg');
  const L = Math.max(0.1, Number(duree) || 0.1);
  const instants = [Math.min(0.2, L / 4), L / 2, Math.max(0, L - 0.3)];
  const out = [];
  instants.forEach((t, i) => {
    const img = `${versPrefixe}-${i + 1}.jpg`;
    fs.mkdirSync(path.dirname(img), { recursive: true });
    const r = spawnSync(ff, ['-nostdin', '-v', 'error', '-y', '-ss', t.toFixed(3), '-i', fichier, '-frames:v', '1',
      '-vf', 'scale=-2:360', '-q:v', '4', img]);
    if (r.status === 0 && fs.existsSync(img)) out.push(img);
  });
  return out;
}

// Une photo en JPEG de 720 px au plus (HEIC compris) pour la montrer au modèle.
export function imagePhoto(fichier, vers) {
  fs.mkdirSync(path.dirname(vers), { recursive: true });
  const r = spawnSync('/usr/bin/sips', ['-s', 'format', 'jpeg', '-Z', '720', fichier, '--out', vers], { encoding: 'utf8' });
  if (r.status === 0 && fs.existsSync(vers)) return [vers];
  const f = spawnSync(outil('ffmpeg'), ['-nostdin', '-v', 'error', '-y', '-i', fichier, '-frames:v', '1', '-vf', 'scale=-2:720', vers]);
  return f.status === 0 && fs.existsSync(vers) ? [vers] : [];
}

// Le modèle regarde des images et répond en texte (JSON attendu, validé ailleurs sur son contenu).
// RANGEMENT_MODELE=<programme> remplace le modèle (tests) : il reçoit { prompt, images } en JSON sur son entrée et
// écrit sa réponse sur sa sortie.
export async function regarder(prompt, images, config) {
  const faux = process.env.RANGEMENT_MODELE;
  if (faux) {
    const estJs = /\.m?js$/.test(faux);
    const r = await lancer(estJs ? process.execPath : faux, estJs ? [faux] : [], { entree: JSON.stringify({ prompt, images }), delaiS: 60 });
    return r.code === 0 ? { ok: true, texte: r.out } : { ok: false, detail: `faux modèle : code ${r.code}` };
  }
  const contenu = images.map((f) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg',
    data: fs.readFileSync(f).toString('base64') } }));
  contenu.push({ type: 'text', text: prompt });
  const message = JSON.stringify({ type: 'user', message: { role: 'user', content: contenu } }) + '\n';
  const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose',
    '--tools', '', '--no-session-persistence', '--strict-mcp-config', '--disable-slash-commands', '--setting-sources', ''];
  const modele = process.env.RANGEMENT_MODELE_NOM || config.claude.modeleRangement || config.claude.modele;
  if (modele) args.push('--model', modele);
  const vide = fs.mkdtempSync(path.join(os.tmpdir(), 'rangement-vue-'));
  try {
    const r = await lancer(config.claude.binaire, args, { cwd: vide, entree: message, delaiS: 180 });
    let texte = null;
    for (const l of r.out.split('\n')) {
      try { const j = JSON.parse(l); if (j.type === 'result' && !j.is_error) texte = String(j.result ?? ''); } catch {}
    }
    return texte != null ? { ok: true, texte } : { ok: false, detail: `claude : code ${r.code}` };
  } finally {
    fs.rmSync(vide, { recursive: true, force: true });
  }
}

export function promptVue(type, prises, attendue) {
  const liste = prises.map((p) => {
    const l = [`Prise ${p.n} (${p.lieu || 'lieu non précisé'})`];
    if (p.ce_qu_on_voit) l.push(`  ce qu'on doit voir : ${p.ce_qu_on_voit}`);
    if (p.materiel?.length) l.push(`  matériel : ${p.materiel.join(', ')}`);
    (p.mouvements || []).forEach((m, i) => l.push(`  mouvement ${i + 1} : ${m}`));
    return l.join('\n');
  }).join('\n');
  const quoi = type === 'photo' ? 'une photo' : 'trois images d\'un même clip vidéo (début, milieu, fin)';
  return [
    `Tu vois ${quoi}, prise pendant un tournage de contenu d'un coach sportif.`,
    `Voici les prises prévues au plan de tournage :`, liste, '',
    attendue != null ? `D'après l'ordre de tournage, ce devrait être la prise ${attendue}. Vérifie-le sur l'image, sans te laisser influencer : si l'image ne correspond pas, dis laquelle correspond, ou aucune.` : '',
    `Réponds uniquement par un objet JSON, sans texte autour :`,
    `{"prise": <numéro de la prise qui correspond, ou null si aucune ne correspond clairement>, "ce_qu_on_voit": "<ce qu'on voit dans le clip, une phrase simple en français, sans parler d'images ni de vignettes>", "mouvements": [${type === 'photo' ? '' : '"<chaque geste ou action visible, dans l\'ordre>"'}]}`,
    `Ne choisis une prise que si l'image la montre vraiment. Dans le doute, mets null.`,
  ].filter((x) => x !== '').join('\n');
}
