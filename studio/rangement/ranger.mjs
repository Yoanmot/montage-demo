#!/usr/bin/env node
// Rangement des rushs d'un tournage groupé (lot 4 du studio, CONTRAT-STUDIO.md sections 2, 5 et 11).
//
//   node ranger.mjs --config <studio.config.json> [--tournage <id>] [--simulation]
//   node ranger.mjs placer <nom> <slug> <face|b-roll|photo> [--config ...]     placement à la main (glisser sur une carte)
//   node ranger.mjs annuler <date|dernier> [--config ...]                      remet en place ce qu'un rangement a fait
//   node ranger.mjs retirer <slug> <face|b-roll|photo> <nom> [--config ...]    « pas le bon » (lot 9) : le fichier sort du
//                                                                             contenu et repart dans _a-ranger/
//
// Sortie : une ligne par fichier « PLACE <nom> -> <slug>/<type> » (une ligne par contenu servi quand une prise en
// sert plusieurs), « A_RANGER <nom> <raison> », « IGNORE <nom> <raison> », puis « FIN places=<n> a_ranger=<n> »
// (places = fichiers placés). Les messages pour Yoan vont sur la sortie d'erreur. Rien n'est placé en silence quand
// c'est incertain : le fichier va dans _a-ranger/ avec sa raison et ses candidats.
//
// Réglages par variables d'environnement (tests) : RANGEMENT_ATTENTE_S (taille stable, 10 s par défaut),
// RANGEMENT_MODELE (faux modèle), RANGEMENT_COUPER (autre brique de transcription), RANGEMENT_MODELE_NOM.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { lireConfig, lireJson, isoZurich, sonder, typeFichier, clipId, nomLibre, prendreVerrou, lireDate, SLUG, estLien, arriveesPertinentes } from './lib/commun.mjs';
import { racines, texteDuScript, reconnaitreFace, apparier, validerVue } from './lib/reconnaitre.mjs';
import { transcrire, vignettes, imagePhoto, regarder, promptVue } from './lib/sens.mjs';
import { Media } from './lib/media.mjs';

const RAISONS = {
  partiel: "ce fichier n'est pas encore arrivé en entier",
  instable: "ce fichier est encore en train d'arriver",
  illisible: "je n'arrive pas à lire cette vidéo, elle n'est peut-être pas arrivée en entier",
  pas_media: "ce n'est ni une vidéo ni une photo",
  face_aucun: "je n'ai pas reconnu ce que tu dis dans cette vidéo",
  face_ambigu: 'ce que tu dis ressemble à plusieurs de tes scripts, je ne sais pas lequel',
  ecoute: "je n'ai pas pu écouter cette vidéo pour la reconnaître",
  sans_prise_broll: 'je ne trouve pas dans ton tournage de plan à filmer qui corresponde à ce clip',
  sans_prise_photo: 'je ne trouve pas dans ton tournage de photo prévue qui corresponde',
  vue_impossible: "je n'ai pas pu regarder ce clip pour le reconnaître",
  vue_aucune: "je n'ai pas reconnu ce qu'on voit dans ce clip",
  vue_desaccord: "l'image ne ressemble pas au plan que j'attendais à ce moment du tournage",
  photo_aucune: 'je ne sais pas pour quel contenu est cette photo',
  biblio_absent: "ce clip n'est plus dans ta bibliothèque, il faudra le refilmer",
};

const say = (l) => process.stdout.write(l + '\n');
const note = (l) => process.stderr.write(l + '\n');

function args(argv) {
  const o = { pos: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--config') o.config = argv[++i];
    else if (a === '--tournage') o.tournage = argv[++i];
    else if (a === '--simulation') o.simulation = true;
    else o.pos.push(a);
  }
  return o;
}

// ---------- Le tournage ----------

function lireTournages(depot) {
  const d = path.join(depot, 'tournages');
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => {
    const t = lireJson(path.join(d, f), null);
    if (!t || t.version !== 1 || !t.id || !Array.isArray(t.prises) || !lireDate(t.cree_le)) {
      note(`tournage illisible, laissé de côté : ${f}`);
      return null;
    }
    return t;
  }).filter(Boolean).sort((a, b) => lireDate(a.cree_le) - lireDate(b.cree_le));
}

const estOriginale = (n) => typeFichier(n) === 'video' && !/-monte(-\d+)?\.mp4$/i.test(n) && !/-coupe/i.test(n);
function aSaFace(media, slug) {
  const d = path.join(media, slug, 'face');
  return fs.existsSync(d) && fs.readdirSync(d).some(estOriginale);
}
const slugsFace = (t) => [...new Set(t.prises.filter((p) => p.type === 'face').flatMap((p) => (p.contenus || []).map((c) => c.slug)))];

// Tournage en cours : un de ses contenus n'a pas reçu sa face caméra (contrat, section 5). À défaut, le plus récent
// de moins de 7 jours (les b-rolls arrivent souvent après les face caméra, dans un deuxième envoi).
function choisirTournage(config, id) {
  const tous = lireTournages(config.depot);
  if (id) return tous.find((t) => t.id === id) || null;
  const enCours = tous.filter((t) => slugsFace(t).some((s) => !aSaFace(config.media, s)));
  if (enCours.length) return enCours.at(-1);
  const recent = tous.filter((t) => Date.now() - lireDate(t.cree_le) < 7 * 86400e3);
  return recent.at(-1) || null;
}

// ---------- Les arrivées ----------

function dateFichier(f, st) {
  const r = spawnSync('/usr/bin/mdls', ['-raw', '-name', 'kMDItemContentCreationDate', f], { encoding: 'utf8' });
  const d = r.status === 0 ? lireDate(r.stdout.trim().replace(/ \+0000$/, 'Z').replace(' ', 'T').replace(' ', '')) : null;
  return d || st.mtime;
}

async function arrivees(config, depuis) {
  const lignes = [], candidats = [];
  // Seulement les vidéos et photos envoyées depuis le téléphone après la création du plan (lot 12) : les
  // autres fichiers du dossier d'arrivée (ses Téléchargements) ne sont ni lus, ni nommés, ni déplacés.
  const { fichiers: trouves, partiels } = arriveesPertinentes(config.arrivees, depuis);
  for (const nom of partiels) lignes.push(`IGNORE ${nom} ${RAISONS.partiel}`);
  for (const f of trouves) candidats.push({ nom: f.nom, chemin: f.chemin, type: f.type, taille: f.taille });
  // Taille stable : on remesure après l'attente (une seule attente pour tous les fichiers).
  const attente = Number(process.env.RANGEMENT_ATTENTE_S ?? 10);
  if (candidats.length && attente > 0) await new Promise((ok) => setTimeout(ok, attente * 1000));
  const fichiers = [];
  for (const c of candidats) {
    let st;
    try { st = fs.statSync(c.chemin); } catch { continue; }
    if (st.size !== c.taille || st.size === 0) { lignes.push(`IGNORE ${c.nom} ${RAISONS.instable}`); continue; }
    if (c.type === 'video') {
      const m = sonder(c.chemin);
      if (!m) { lignes.push(`IGNORE ${c.nom} ${RAISONS.illisible}`); continue; }
      fichiers.push({ ...c, ...m, date: m.date || st.mtime });
    } else {
      fichiers.push({ ...c, date: dateFichier(c.chemin, st), duree: 0, duree_s: 0, orientation: null });
    }
  }
  fichiers.sort((a, b) => a.date - b.date || a.nom.localeCompare(b.nom));
  return { lignes, fichiers };
}

async function enParallele(liste, n, fn) {
  const res = new Array(liste.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, liste.length) }, async () => {
    while (i < liste.length) { const k = i++; res[k] = await fn(liste[k], k); }
  }));
  return res;
}

// ---------- Le rangement ----------

async function ranger(o) {
  const config = lireConfig(o.config);
  const simulation = !!o.simulation;
  const media = new Media(config.media);
  let places = 0, aRanger = 0;
  const liberer = simulation ? () => {} : prendreVerrou(config.media);
  if (!liberer) { note('un autre rangement est en cours'); say('FIN places=0 a_ranger=0'); return 0; }

  const t = choisirTournage(config, o.tournage);
  if (!t) {
    note(o.tournage ? `tournage ${o.tournage} introuvable` : 'aucun tournage en cours');
    say('FIN places=0 a_ranger=0'); return 0;
  }
  note(`tournage ${t.id} (${t.contenus?.length || 0} contenus)`);
  if (!simulation) media.ouvrir('ranger', t.id);
  const travail = fs.mkdtempSync(path.join(os.tmpdir(), 'rangement-'));

  try {
    // 1. Les prises « déjà en bibliothèque » : le lien est posé, aucun fichier attendu.
    const ix = media.index();
    for (const p of t.prises.filter((p) => p.deja_en_bibliotheque)) {
      const c = ix.clips[p.deja_en_bibliotheque];
      const fichier = c && path.join(config.media, c.fichier);
      if (!c || !fs.existsSync(fichier)) { say(`IGNORE ${p.deja_en_bibliotheque} ${RAISONS.biblio_absent}`); continue; }
      for (const { slug } of p.contenus || []) {
        if (!SLUG.test(slug)) continue;
        const lien = path.join(config.media, slug, 'b-roll', path.basename(fichier));
        if (fs.existsSync(lien)) continue;
        if (!simulation) { media.lier(slug, fichier, 'deja_en_bibliotheque'); media.ajouterContenu(p.deja_en_bibliotheque, slug); }
        say(`PLACE ${path.basename(fichier)} -> ${slug}/b-roll`);
      }
    }

    // 2. Les fichiers arrivés depuis le début du tournage.
    const { lignes, fichiers } = await arrivees(config, lireDate(t.cree_le));
    lignes.forEach(say);
    if (!fichiers.length) return 0;

    const videos = fichiers.filter((f) => f.type === 'video');
    const photos = fichiers.filter((f) => f.type === 'photo');

    // 3. Face caméra : ce qu'il dit, comparé au texte de chaque script du tournage.
    const scripts = slugsFace(t).map((slug) => {
      const p = path.join(config.depot, 'contenus', slug, 'script.md');
      if (!fs.existsSync(p)) { note(`pas de script pour ${slug}`); return null; }
      return { slug, texte: texteDuScript(fs.readFileSync(p, 'utf8')) };
    }).filter((s) => s && racines(s.texte).length);

    const ecoutes = await enParallele(videos, 1, async (v) => (v.son ? transcrire(v.chemin, config) : { ok: true, texte: '' }));
    const decisions = [];   // { f, type, slugs, raison, candidats, vu }
    const sansParole = [];
    videos.forEach((v, k) => {
      const e = ecoutes[k];
      if (!e.ok) {
        note(`transcription impossible pour ${v.nom} : ${e.detail}`);
        decisions.push({ f: v, raison: 'ecoute', candidats: scripts.map((s) => ({ slug: s.slug, type: 'face', score: 0 })) });
        return;
      }
      const r = reconnaitreFace(e.texte, scripts);
      v.reconnaissance = r;
      if (r.decision === 'sans_parole') { sansParole.push(v); return; }
      const cand = r.scores.filter((s) => s.score > 0).slice(0, 3).map((s) => ({ slug: s.slug, type: 'face', score: s.score }));
      if (r.decision === 'place') decisions.push({ f: v, type: 'face', slugs: [r.slug], candidats: cand });
      else decisions.push({ f: v, raison: r.decision === 'ambigu' ? 'face_ambigu' : 'face_aucun', candidats: cand });
    });

    // 4. B-rolls et photos : ordre de tournage et durée, puis confirmation par l'image.
    const aFilmer = (type) => t.prises.filter((p) => p.type === type && !p.deja_en_bibliotheque);
    for (const [type, liste] of [['b-roll', sansParole], ['photo', photos]]) {
      if (!liste.length) continue;
      const prises = aFilmer(type);
      if (!prises.length) {
        liste.forEach((f) => decisions.push({ f, raison: type === 'photo' ? 'sans_prise_photo' : 'sans_prise_broll', candidats: [] }));
        continue;
      }
      const guess = apparier(liste, prises);
      await enParallele(liste, 2, async (f, k) => {
        const attendue = prises[guess[k]];
        const prefixe = path.join(travail, `${path.parse(f.nom).name}-${k}`);
        const images = type === 'photo' ? imagePhoto(f.chemin, `${prefixe}.jpg`) : vignettes(f.chemin, f.duree, prefixe);
        f.images = images;
        const candidat = (p, score) => (p.contenus || []).map((c) => ({ slug: c.slug, type, score }));
        if (!images.length) { decisions.push({ f, raison: 'vue_impossible', candidats: candidat(attendue, 0.5) }); return; }
        const numeros = prises.map((p) => p.n);
        let vue = null;
        for (let essai = 0; essai < 2 && !vue?.ok; essai++) {   // une sortie vide ou fausse se refait une fois
          const r = await regarder(promptVue(type, prises, attendue.n), images, config);
          vue = r.ok ? validerVue(r.texte, numeros, { exigerMouvements: type !== 'photo' }) : { ok: false, pourquoi: r.detail };
          if (!vue.ok) note(`regard du modèle refusé pour ${f.nom} : ${vue.pourquoi}`);
        }
        if (!vue.ok) { decisions.push({ f, raison: 'vue_impossible', candidats: candidat(attendue, 0.5) }); return; }
        const infos = { ce_qu_on_voit: vue.ce_qu_on_voit, mouvements: vue.mouvements };
        if (vue.prise === attendue.n) {
          decisions.push({ f, type, prise: attendue, slugs: (attendue.contenus || []).map((c) => c.slug), vu: infos });
        } else if (vue.prise == null) {
          decisions.push({ f, raison: type === 'photo' ? 'photo_aucune' : 'vue_aucune', candidats: candidat(attendue, 0.5), vu: infos });
        } else {
          const autre = prises.find((p) => p.n === vue.prise);
          decisions.push({ f, raison: 'vue_desaccord', candidats: [...candidat(autre, 0.5), ...candidat(attendue, 0.5)], vu: infos });
        }
      });
    }

    // 5. Appliquer, dans l'ordre de prise.
    decisions.sort((a, b) => a.f.date - b.f.date || a.f.nom.localeCompare(b.f.nom));
    for (const d of decisions) {
      const slugsValides = (d.slugs || []).filter((s) => SLUG.test(s));
      if (d.type && slugsValides.length) {
        if (!simulation) placer(media, config, d.f, d.type, slugsValides, { tournage: t.id, prise: d.prise, vu: d.vu });
        // face et photo : un fichier réel dans un seul contenu (le premier) ; b-roll : un lien par contenu servi
        for (const s of d.type === 'b-roll' ? slugsValides : slugsValides.slice(0, 1)) say(`PLACE ${d.f.nom} -> ${s}/${d.type}`);
        places++;
      } else {
        const raison = RAISONS[d.raison] || RAISONS.vue_aucune;
        if (!simulation) {
          const nom = media.mettreDeCote(d.f.chemin, {
            raison, code: d.raison, candidats: d.candidats || [], tournage: t.id,
            type_probable: d.f.type === 'photo' ? 'photo' : (d.f.reconnaissance?.decision === 'sans_parole' ? 'b-roll' : 'face'),
            pris_le: isoZurich(d.f.date), duree_s: d.f.duree_s || null, vu: d.vu || null,
            vignette: vignetteARanger(media, config, d.f),
          });
          say(`A_RANGER ${nom} ${raison}`);
        } else say(`A_RANGER ${d.f.nom} ${raison}`);
        aRanger++;
      }
    }
    return 0;
  } finally {
    if (!simulation) media.fermer();
    fs.rmSync(travail, { recursive: true, force: true });
    say(`FIN places=${places} a_ranger=${aRanger}`);
    liberer();
  }
}

// Une image du milieu du clip, pour que Romain reconnaisse un fichier à ranger.
function vignetteARanger(media, config, f) {
  const dossier = path.join(config.media, '_a-ranger', '.vignettes');
  const src = f.images?.[1] || f.images?.[0];
  const vers = path.join(dossier, `${f.nom}.jpg`);
  try {
    fs.mkdirSync(dossier, { recursive: true });
    if (src) fs.copyFileSync(src, vers);
    else if (f.type === 'video') {
      const imgs = vignettes(f.chemin, f.duree, path.join(dossier, `.tmp-${f.nom}`));
      const milieu = imgs.find((x) => x.endsWith('-2.jpg')) || imgs[0];
      if (milieu) fs.renameSync(milieu, vers);
      imgs.forEach((x) => fs.rmSync(x, { force: true }));
    } else if (f.type === 'photo') imagePhoto(f.chemin, vers);
    if (!fs.existsSync(vers)) return null;
    media.creer(vers);
    return path.relative(config.media, vers);
  } catch { return null; }
}

// Place un fichier : face et photo dans le dossier du contenu, b-roll en bibliothèque avec un lien par contenu.
function placer(media, config, f, type, slugs, { tournage = null, prise = null, vu = null } = {}) {
  if (type === 'face' || type === 'photo') {
    const dossier = path.join(config.media, slugs[0], type === 'face' ? 'face' : 'photos');
    fs.mkdirSync(dossier, { recursive: true });
    media.deplacer(f.chemin, path.join(dossier, nomLibre(dossier, f.nom)), type);
    return;
  }
  const id = clipId(f.date);
  const ext = path.extname(f.nom).toLowerCase();
  const fichier = path.join(config.media, '_bibliotheque', 'b-roll', `${id}${ext}`);
  media.deplacer(f.chemin, fichier, 'b-roll');
  const vdir = path.join(config.media, '_bibliotheque', 'vignettes');
  fs.mkdirSync(vdir, { recursive: true });
  const vigs = [];
  const sources = f.images?.length ? f.images : vignettes(fichier, f.duree, path.join(os.tmpdir(), `rangement-v-${id}`));
  sources.forEach((src, i) => {
    const v = path.join(vdir, `${id}-${i + 1}.jpg`);
    fs.copyFileSync(src, v);
    media.creer(v);
    vigs.push(path.relative(config.media, v));
  });
  media.ajouterClip(id, {
    fichier: path.relative(config.media, fichier),
    origine: f.nom,
    pris_le: isoZurich(f.date),
    duree_s: f.duree_s,
    orientation: f.orientation,
    lieu: prise?.lieu || null,
    materiel: prise?.materiel || [],
    ce_qu_on_voit: vu?.ce_qu_on_voit || null,
    mouvements: vu?.mouvements || [],
    themes: [],
    contenus: [],
    tournage,
    prise: prise?.n ?? null,
    vignettes: vigs,
  });
  for (const s of slugs) { media.lier(s, fichier, 'b-roll'); media.ajouterContenu(id, s); }
}

// ---------- Placement à la main ----------

async function placerALaMain(o) {
  const [nom, slug, type] = o.pos.slice(1);
  const config = lireConfig(o.config);
  const media = new Media(config.media);
  const bloque = (code, phrase) => { say(`BLOQUE ${code} ${phrase}`); return 2; };
  if (!nom || !slug || !type) return bloque('USAGE', 'placer <nom> <slug> <face|b-roll|photo>');
  if (!['face', 'b-roll', 'photo'].includes(type)) return bloque('TYPE', 'le type est face, b-roll ou photo');
  if (!SLUG.test(slug) || !fs.existsSync(path.join(config.depot, 'contenus', slug))) return bloque('CONTENU', "je ne trouve pas ce contenu");
  if (nom !== path.basename(nom) || nom.startsWith('.')) return bloque('FICHIER', 'je ne trouve pas ce fichier');
  const liberer = prendreVerrou(config.media);
  if (!liberer) return bloque('OCCUPE', 'un rangement est déjà en cours, réessaie dans un instant');
  try {
    const chemin = path.join(config.media, '_a-ranger', nom);
    // Un clip déjà en bibliothèque (par son clip_id ou son nom d'origine) : on ajoute seulement le lien.
    if (!fs.existsSync(chemin)) {
      const ix = media.index();
      const [id, c] = Object.entries(ix.clips).find(([k, v]) => k === nom || v.origine === nom) || [];
      if (!c || type !== 'b-roll') return bloque('FICHIER', 'je ne trouve pas ce fichier');
      media.ouvrir('placer', c.tournage);
      media.lier(slug, path.join(config.media, c.fichier), 'placer');
      media.ajouterContenu(id, slug);
      media.fermer();
      say(`PLACE ${path.basename(c.fichier)} -> ${slug}/b-roll`);
      say(`FIN places=1 a_ranger=${media.aRanger().fichiers.length}`);
      return 0;
    }
    const entree = media.aRanger().fichiers.find((f) => f.nom === nom) || {};
    const st = fs.statSync(chemin);
    const m = typeFichier(nom) === 'video' ? sonder(chemin) : null;
    if (type !== 'photo' && !m) return bloque('FICHIER', "ce n'est pas une vidéo que je sais lire");
    const f = { nom, chemin, type: typeFichier(nom), date: m?.date || lireDate(entree.pris_le) || st.mtime,
      duree: m?.duree || 0, duree_s: m?.duree_s || 0, orientation: m?.orientation || null };
    media.ouvrir('placer', entree.tournage);
    media.retirerDeARanger(nom);
    placer(media, config, f, type, [slug], { tournage: entree.tournage || null, vu: entree.vu || null });
    media.fermer();
    say(`PLACE ${nom} -> ${slug}/${type}`);
    say(`FIN places=1 a_ranger=${media.aRanger().fichiers.length}`);
    return 0;
  } finally { liberer(); }
}

// ---------- Retirer d'un contenu (« pas le bon », vue Montage du studio, lot 9) ----------

const RETIRE = 'tu l\'as retiré de ce contenu : dis-moi où il va';

function retirer(o) {
  const [slug, type, nom] = o.pos.slice(1);
  const config = lireConfig(o.config);
  const media = new Media(config.media);
  const bloque = (code, phrase) => { say(`BLOQUE ${code} ${phrase}`); return 2; };
  if (!slug || !type || !nom) return bloque('USAGE', 'retirer <slug> <face|b-roll|photo> <nom>');
  if (!['face', 'b-roll', 'photo'].includes(type)) return bloque('TYPE', 'le type est face, b-roll ou photo');
  if (!SLUG.test(slug)) return bloque('CONTENU', 'je ne trouve pas ce contenu');
  if (nom !== path.basename(nom) || nom.startsWith('.')) return bloque('FICHIER', 'je ne trouve pas ce fichier');
  const dossier = path.join(config.media, slug, type === 'photo' ? 'photos' : type);
  const chemin = path.join(dossier, nom);
  const ext = path.extname(nom).toLowerCase();
  if (type === 'face' && /-monte(-\d+)?\.mp4$|-coupe/i.test(nom)) return bloque('FICHIER', 'ce fichier vient du montage, je n\'y touche pas');
  const liberer = prendreVerrou(config.media);
  if (!liberer) return bloque('OCCUPE', 'un rangement est déjà en cours, réessaie dans un instant');
  try {
    if (type === 'b-roll') {
      if (!estLien(chemin)) return bloque('FICHIER', 'je ne trouve pas ce fichier');
      const id = path.basename(nom, ext);
      const ix = media.index();
      const clip = ix.clips[id];
      media.ouvrir('retirer', clip?.tournage || null);
      media.delier(chemin, 'retirer');
      media.retirerContenu(id, slug);
      const reste = media.index().clips[id];
      if (reste && !(reste.contenus || []).length) {
        // Plus aucun contenu ne l'utilise : il repart dans « à ranger » pour que Romain le replace.
        const fichier = path.join(config.media, reste.fichier);
        if (fs.existsSync(fichier)) {
          const vig = (reste.vignettes || []).map((v) => path.join(config.media, v)).find((v) => fs.existsSync(v));
          const pose = media.mettreDeCote(fichier, { raison: RETIRE, code: 'retire', candidats: [], type_probable: 'b-roll',
            tournage: reste.tournage || null, pris_le: reste.pris_le || null, duree_s: reste.duree_s || null,
            vu: reste.ce_qu_on_voit ? { ce_qu_on_voit: reste.ce_qu_on_voit, mouvements: reste.mouvements || [] } : null });
          if (vig) {
            const v = path.join(config.media, '_a-ranger', '.vignettes', `${pose}.jpg`);
            fs.mkdirSync(path.dirname(v), { recursive: true });
            if (!fs.existsSync(v)) { fs.copyFileSync(vig, v); media.creer(v); }
          }
          media.retirerClip(id);
        }
      }
      media.fermer();
    } else {
      if (!fs.existsSync(chemin) || estLien(chemin) || !fs.statSync(chemin).isFile()) return bloque('FICHIER', 'je ne trouve pas ce fichier');
      const m = typeFichier(nom) === 'video' ? sonder(chemin) : null;
      media.ouvrir('retirer', null);
      media.mettreDeCote(chemin, { raison: RETIRE, code: 'retire', candidats: [], type_probable: type,
        tournage: null, pris_le: m?.date ? isoZurich(m.date) : null, duree_s: m?.duree_s || null, vu: null });
      media.fermer();
    }
    say(`RETIRE ${nom} ${slug}/${type}`);
    say('FIN retires=1');
    return 0;
  } finally { liberer(); }
}

// ---------- Annuler ----------

function annuler(o) {
  const quoi = o.pos[1];
  const config = lireConfig(o.config);
  const media = new Media(config.media);
  if (!quoi) { say('BLOQUE USAGE annuler <date|dernier>'); return 2; }
  const liberer = prendreVerrou(config.media);
  if (!liberer) { say('BLOQUE OCCUPE un rangement est déjà en cours, réessaie dans un instant'); return 2; }
  try {
    const actifs = media.journal().rangements.filter((r) => !r.annule && r.ops.length && r.commande !== 'archiver');
    const e = quoi === 'dernier' ? actifs.at(-1) : (actifs.find((r) => r.id === quoi) || actifs.filter((r) => r.id.startsWith(quoi)).at(-1));
    if (!e) { say('BLOQUE INTROUVABLE je ne trouve pas ce rangement'); return 2; }
    const lignes = media.annuler(e);
    lignes.forEach(say);
    say(`FIN annule=${e.id} fichiers=${e.ops.filter((x) => x.op === 'deplacement').length}`);
    return 0;
  } finally { liberer(); }
}

const o = args(process.argv.slice(2));
let code;
try {
  if (o.pos[0] === 'placer') code = await placerALaMain(o);
  else if (o.pos[0] === 'annuler') code = annuler(o);
  else if (o.pos[0] === 'retirer') code = retirer(o);
  else if (o.pos.length) { say('BLOQUE USAGE ranger.mjs --config <fichier> [--tournage <id>] [--simulation] | placer <nom> <slug> <type> | annuler <date|dernier> | retirer <slug> <type> <nom>'); code = 2; }
  else code = await ranger(o);
} catch (e) {
  note(`erreur : ${e.stack || e.message}`);
  code = 1;
}
process.exitCode = code;
