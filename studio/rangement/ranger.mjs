#!/usr/bin/env node
// Rangement des rushs d'un tournage groupé (lot 4 du studio, CONTRAT-STUDIO.md sections 2, 5 et 11).
//
//   node ranger.mjs --config <studio.config.json> [--tournage <id>] [--simulation]
//   node ranger.mjs placer <nom> <slug> <face|b-roll|photo|ecran> [--config ...] placement à la main (ecran : enregistrement d'écran)
//   node ranger.mjs placer <nom> <slug> <type> --arrivee <tournage>          idem, pour une vidéo ou une photo encore dans
//                                                                             le dossier d'arrivée (arrivée après ce plan)
//   node ranger.mjs placer <nom> <slug> <type> --envoi <chemin>              idem, pour un fichier envoyé depuis le studio
//                                                                             (« Ajouter une vidéo », vue Montage) : seulement
//                                                                             un fichier du dossier <home>/envois/
//   node ranger.mjs annuler <date|dernier> [--config ...]                      remet en place ce qu'un rangement a fait
//   node ranger.mjs retirer <slug> <face|b-roll|photo> <nom> [--config ...]    « pas le bon » (lot 9) : le fichier sort du
//                                                                             contenu et repart dans _a-ranger/
//   node ranger.mjs changer <slug> <face|b-roll> <nom> <b-roll|face>           change le type d'une vidéo rangée (vue
//                                                                             Montage) : même effet que retirer puis placer
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
import { lireConfig, lireJson, isoZurich, sonder, typeFichier, clipId, nomLibre, prendreVerrou, lireDate, SLUG, estLien, arriveesPertinentes, deplacer,
  voixAttendues, sonderAudio, voixEnVideo } from './lib/commun.mjs';
import { racines, texteDuScript, reconnaitreFace, apparier, validerVue, genreDe, principauxSansParole } from './lib/reconnaitre.mjs';
import { transcrire, vignettes, imagePhoto, regarder, promptVue } from './lib/sens.mjs';
import { Media } from './lib/media.mjs';
import { Galerie, dossierGalerie, lienVersId, prisesEffectives } from './lib/galerie.mjs';

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
  pendant: "arrivé pendant que je rangeais, il t'attend dans ta Galerie, à placer",
  quelques_mots: "j'entends quelques mots sans reconnaître ton texte : si c'est ta face caméra, mets-la dans son reel ; sinon, mets-la dans ta Galerie",
  audio_illisible: "je n'arrive pas à lire ce mémo vocal, il n'est peut-être pas arrivé en entier",
  voix_ecoute: "je n'ai pas pu écouter ce mémo vocal, il t'attend dans ta Galerie, à placer",
  voix_aucune: "je n'ai pas reconnu le texte d'un de tes reels dans ce mémo vocal, il t'attend dans ta Galerie, à placer",
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
    else if (a === '--arrivee') o.arrivee = argv[++i];
    else if (a === '--envoi') o.envoi = argv[++i];
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

async function arrivees(config, depuis, { audio = false } = {}) {
  const lignes = [], candidats = [];
  // Seulement les vidéos et photos envoyées depuis le téléphone après la création du plan (lot 12) : les
  // autres fichiers du dossier d'arrivée (ses Téléchargements) ne sont ni lus, ni nommés, ni déplacés.
  // Un fichier encore en réception (AirDrop pas fini : pas encore de quarantaine, taille qui bouge) n'est
  // jamais rangé : il reste où il est, le plan de tournage le montre et propose de ranger plus tard.
  const { fichiers: trouves, partiels, en_cours: enCours } = arriveesPertinentes(config.arrivees, depuis, { audio });
  for (const nom of partiels) lignes.push(`IGNORE ${nom} ${RAISONS.partiel}`);
  for (const f of enCours) lignes.push(`IGNORE ${f.nom} ${RAISONS.instable}`);
  for (const f of trouves) candidats.push({ nom: f.nom, chemin: f.chemin, type: f.type, taille: f.taille });
  const noms = new Set([...partiels, ...enCours.map((f) => f.nom), ...trouves.map((f) => f.nom)]);
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
    } else if (c.type === 'audio') {
      const duree = sonderAudio(c.chemin);
      if (!duree) { lignes.push(`IGNORE ${c.nom} ${RAISONS.audio_illisible}`); continue; }
      fichiers.push({ ...c, date: dateFichier(c.chemin, st), duree, duree_s: Math.round(duree * 10) / 10, orientation: 'portrait' });
    } else {
      fichiers.push({ ...c, date: dateFichier(c.chemin, st), duree: 0, duree_s: 0, orientation: null });
    }
  }
  fichiers.sort((a, b) => a.date - b.date || a.nom.localeCompare(b.nom));
  return { lignes, fichiers, noms };
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
  let places = 0, aRanger = 0, enGalerie = 0;
  const liberer = simulation ? () => {} : prendreVerrou(config.media);
  if (!liberer) { note('un autre rangement est en cours'); say('FIN places=0 a_ranger=0'); return 0; }

  const t = choisirTournage(config, o.tournage);
  if (!t) {
    note(o.tournage ? `tournage ${o.tournage} introuvable` : 'aucun tournage en cours');
    say('FIN places=0 a_ranger=0'); return 0;
  }
  // Lot 15 : le plan tel qu'il vaut maintenant. Une prise dont le plan a été pris dans la Galerie après coup n'est plus
  // attendue (un fichier filmé quand même entre dans la Galerie) ; un plan passé « à tourner » après coup est attendu.
  try { t.prises = prisesEffectives(config, t); } catch (e) { note(`plans du brief illisibles : ${e.message}`); }
  note(`tournage ${t.id} (${t.contenus?.length || 0} contenus)`);
  if (!simulation) media.ouvrir('ranger', t.id);
  const travail = fs.mkdtempSync(path.join(os.tmpdir(), 'rangement-'));
  let vus = null;   // noms des arrivées lues au début du rangement

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

    // 2. Les fichiers arrivés depuis le début du tournage (les mémos vocaux seulement si un reel attend sa voix).
    const voix = voixAttendues(config, t);
    const { lignes, fichiers, noms } = await arrivees(config, lireDate(t.cree_le), { audio: voix.length > 0 });
    vus = noms;
    lignes.forEach(say);
    if (!fichiers.length) return 0;

    const videos = fichiers.filter((f) => f.type === 'video');
    const photos = fichiers.filter((f) => f.type === 'photo');
    const memos = fichiers.filter((f) => f.type === 'audio');

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

    // 3 bis. Mémos vocaux : la voix d'un reel en plans filmés avec sa voix. Changé en vidéo (le monteur part d'une
    // vidéo), écouté, comparé aux seuls textes des reels qui attendent leur voix. Pas reconnu : il reste où il est
    // (dans ses Téléchargements, montré dans « À ranger ») ; jamais mis de côté ni rangé au hasard.
    const scriptsVoix = scripts.filter((s) => voix.includes(s.slug));
    for (const m of memos) {
      const video = path.join(travail, `${path.parse(m.nom).name}.mp4`);
      if (!voixEnVideo(m.chemin, video)) { say(`IGNORE ${m.nom} ${RAISONS.audio_illisible}`); continue; }
      const e = await transcrire(video, config);
      if (!e.ok) { note(`transcription impossible pour ${m.nom} : ${e.detail}`); say(`IGNORE ${m.nom} ${RAISONS.voix_ecoute}`); continue; }
      const r = reconnaitreFace(e.texte, scriptsVoix);
      if (r.decision !== 'place') { say(`IGNORE ${m.nom} ${RAISONS.voix_aucune}`); continue; }
      decisions.push({ f: { ...m, chemin: video, voix: m.chemin }, type: 'face', slugs: [r.slug] });
    }

    // 4. B-rolls et photos : ordre de tournage et durée, puis confirmation par l'image.
    const aFilmer = (type) => t.prises.filter((p) => p.type === type && !p.deja_en_bibliotheque && !p.en_galerie);
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
    // Reel sans parole : son plan principal devient sa vidéo du reel (2026-11-20).
    const genre = (s) => genreDe(lireJson(path.join(config.depot, 'contenus', s, 'etat.json'), null),
      fs.existsSync(path.join(config.depot, 'contenus', s, 'script.md')) ? fs.readFileSync(path.join(config.depot, 'contenus', s, 'script.md'), 'utf8') : null);
    principauxSansParole(decisions, t.prises, genre, (s) => aSaFace(config.media, s));
    for (const d of decisions) {
      const slugsValides = (d.slugs || []).filter((s) => SLUG.test(s));
      if (d.type && slugsValides.length) {
        const fiche = simulation ? null : placer(media, config, d.f, d.type, slugsValides, { tournage: t.id, prise: d.prise, vu: d.vu });
        // face et photo : un fichier réel dans un seul contenu (le premier) ; b-roll : un lien par contenu servi
        for (const s of d.type === 'b-roll' ? slugsValides : slugsValides.slice(0, 1)) say(`PLACE ${d.f.nom} -> ${s}/${d.type}`);
        // Le même fichier envoyé deux fois (AirDrop refait) : la fiche existante sert, il ne compte pas deux fois au bilan.
        if (fiche?.doublon) say(`DOUBLON ${d.f.nom} ${fiche.id}`);
        else places++;
      } else if (d.f.type === 'photo' || (d.f.type === 'video' && d.f.reconnaissance?.decision === 'sans_parole' && !quelquesMots(d.f))) {
        // Une photo ou un b-roll rattaché à rien (lot 15) : il entre dans la Galerie, où il resservira.
        const type = d.f.type === 'photo' ? 'photo' : 'b-roll';
        if (!simulation) {
          const fiche = entrerGalerie(media, config, d.f, type, { genre: 'arrivee', tournage: t.id, ...(d.vu?.ce_qu_on_voit ? { vu: d.vu.ce_qu_on_voit } : {}) });
          if (fiche.doublon) { say(`DOUBLON ${d.f.nom} ${fiche.id}`); continue; }
          say(`GALERIE ${d.f.nom} ${fiche.id}`);
        } else say(`GALERIE ${d.f.nom} simulation`);
        enGalerie++;
      } else {
        // Une vidéo où l'on entend quelques mots, rattachée à rien : peut-être une face caméra courte (jamais dans la
        // Galerie) ; elle attend dans « Arrivés, à placer », où Romain dit si c'est une face caméra ou un plan.
        const peutEtreFace = d.f.type === 'video' && d.f.reconnaissance?.decision === 'sans_parole' && quelquesMots(d.f);
        const raison = peutEtreFace ? RAISONS.quelques_mots : (RAISONS[d.raison] || RAISONS.vue_aucune);
        if (!simulation) {
          const nom = media.mettreDeCote(d.f.chemin, {
            raison, code: peutEtreFace ? 'quelques_mots' : d.raison, candidats: d.candidats || [], tournage: t.id,
            type_probable: d.f.type === 'photo' ? 'photo' : peutEtreFace ? null : (d.f.reconnaissance?.decision === 'sans_parole' ? 'b-roll' : 'face'),
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
    // Relu à la fin (studio de Yoan, 19/11) : une vidéo posée dans le dossier d'arrivée pendant le rangement
    // (qui écoute et regarde, donc dure) n'a pas été lue au début. Elle n'est pas rangée en silence : elle est
    // signalée, le plan reste « à finir » et « À ranger » la montre.
    if (vus) {
      try {
        const r = arriveesPertinentes(config.arrivees, lireDate(t.cree_le));
        for (const f of [...r.fichiers, ...r.en_cours]) if (!vus.has(f.nom)) say(`IGNORE ${f.nom} ${RAISONS.pendant}`);
      } catch { /* dossier d'arrivée illisible : rien à signaler */ }
    }
    say(`FIN places=${places} a_ranger=${aRanger}${enGalerie ? ` galerie=${enGalerie}` : ""}`);
    liberer();
  }
}

// Une vidéo sans assez de mots pour être reconnue, mais où l'on parle un peu (5 mots pleins ou plus, sans les petits
// mots) : une face caméra courte ou ratée est possible. Un vrai plan filmé en plus n'a pas de parole (ou un ou deux mots
// entendus dans le bruit).
const MOTS_FACE_POSSIBLE = 5;
function quelquesMots(f) { return (Number(f.reconnaissance?.mots) || 0) >= MOTS_FACE_POSSIBLE; }

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

// La Galerie du client (lot 15), attachée au journal du rangement pour pouvoir annuler.
function galerieDe(config, media) {
  const g = new Galerie(dossierGalerie(config));
  media.galerie = g;
  return g;
}

// La ligne du plan qui a demandé ce fichier (jointe à sa fiche, et à la session qui le décrit).
function ligneDePrise(prise) {
  if (!prise) return null;
  const m = (prise.mouvements || []).filter(Boolean);
  return String(m.length ? m.join(' ; ') : prise.ce_qu_on_voit || '').trim() || null;
}
function phrasesDePrise(prise) {
  return (prise?.contenus || []).flatMap((c) => (c.usages || []).map((u) => u.phrase)).filter(Boolean);
}

// Fait entrer une photo ou un b-roll dans la Galerie (déplacé, jamais copié) avec ses vignettes. Renvoie la fiche.
function entrerGalerie(media, config, f, type, origine) {
  const g = galerieDe(config, media);
  return g.ajouter(f.chemin, {
    type, nom_origine: f.nom, date: f.date, duree_s: f.duree_s || null, orientation: f.orientation || null, origine,
  }, {
    media,
    vignettes: (fichier, id) => {
      if (type === 'photo') return imagePhoto(fichier, path.join(g.vignettesD, `${id}.jpg`));
      // Les images déjà extraites pour le regard du modèle resservent ; sinon on les fait.
      if (f.images?.length) return f.images;
      fs.mkdirSync(g.vignettesD, { recursive: true });
      return vignettes(fichier, f.duree, path.join(g.vignettesD, id));
    },
  });
}

// Place un fichier : face dans le dossier du contenu ; photo et b-roll dans la Galerie (lot 15), avec un lien physique
// dans le contenu (une photo : le premier contenu ; un b-roll : chaque contenu servi).
function placer(media, config, f, type, slugs, { tournage = null, prise = null, vu = null, source = null } = {}) {
  // Un enregistrement d'écran (format écran partagé, studio de Yoan) : dans le dossier du contenu, à côté de sa face
  // caméra, jamais dans la Galerie (il ne sert qu'à cette vidéo).
  if (type === 'ecran') {
    const dossier = path.join(config.media, slugs[0], 'ecran');
    fs.mkdirSync(dossier, { recursive: true });
    media.deplacer(f.chemin, path.join(dossier, nomLibre(dossier, f.nom)), type);
    return null;
  }
  if (type === 'face') {
    const dossier = path.join(config.media, slugs[0], 'face');
    fs.mkdirSync(dossier, { recursive: true });
    // Un mémo vocal : sa vidéo (fabriquée par le studio) va là où le monteur prend la voix, le mémo d'origine à côté.
    if (f.voix) {
      const video = path.join(dossier, nomLibre(dossier, `${path.parse(f.nom).name}.mp4`));
      deplacer(f.chemin, video);
      media.creer(video);
      media.deplacer(f.voix, path.join(dossier, nomLibre(dossier, f.nom)), 'voix');
      return null;
    }
    media.deplacer(f.chemin, path.join(dossier, nomLibre(dossier, f.nom)), type);
    return null;
  }
  const origine = tournage
    ? { genre: 'tournage', tournage, prise: prise?.n ?? null, ligne: ligneDePrise(prise), phrases: phrasesDePrise(prise), ...(vu?.ce_qu_on_voit ? { vu: vu.ce_qu_on_voit } : {}) }
    : { genre: 'ajout' };
  const fiche = entrerGalerie(media, config, f, type, origine);
  for (const s of type === 'b-roll' ? slugs : slugs.slice(0, 1)) media.galerie.lier(config.media, s, fiche.id, { media, source: source || (tournage ? 'tournage' : 'toi') });
  return fiche;
}

// ---------- Placement à la main ----------

async function placerALaMain(o) {
  const [nom, slug, type] = o.pos.slice(1);
  const config = lireConfig(o.config);
  const media = new Media(config.media);
  const bloque = (code, phrase) => { say(`BLOQUE ${code} ${phrase}`); return 2; };
  if (!nom || !slug || !type) return bloque('USAGE', 'placer <nom> <slug> <face|b-roll|photo|ecran>');
  if (!['face', 'b-roll', 'photo', 'ecran'].includes(type)) return bloque('TYPE', 'le type est face, b-roll, photo ou ecran');
  if (!SLUG.test(slug) || !fs.existsSync(path.join(config.depot, 'contenus', slug))) return bloque('CONTENU', "je ne trouve pas ce contenu");
  if (nom !== path.basename(nom) || nom.startsWith('.')) return bloque('FICHIER', 'je ne trouve pas ce fichier');
  const liberer = prendreVerrou(config.media);
  if (!liberer) return bloque('OCCUPE', 'un rangement est déjà en cours, réessaie dans un instant');
  try {
    // Une arrivée pas encore rangée (studio de Yoan, 19/11) : seulement une vidéo ou une photo arrivée en
    // entier dans le dossier d'arrivée après la création de ce plan, pas venue d'internet (mêmes règles
    // que le rangement). Aucun autre fichier de ses Téléchargements n'est jamais touché.
    if (o.arrivee) {
      const t = lireTournages(config.depot).find((x) => x.id === o.arrivee);
      if (!t) return bloque('PLAN', 'je ne trouve pas ce plan de tournage');
      const voix = voixAttendues(config, t);
      const f = arriveesPertinentes(config.arrivees, lireDate(t.cree_le), { audio: voix.length > 0 }).fichiers.find((x) => x.nom === nom);
      if (!f) return bloque('FICHIER', 'je ne trouve plus ce fichier sur ton Mac');
      // Un mémo vocal ne se range que comme la voix d'un reel qui l'attend (plans filmés avec ta voix).
      if (f.type === 'audio') {
        if (type !== 'face' || !voix.includes(slug)) return bloque('TYPE', "un mémo vocal ne se range que comme la voix d'un reel en plans filmés avec ta voix");
        const travail = fs.mkdtempSync(path.join(os.tmpdir(), 'rangement-voix-'));
        try {
          const video = path.join(travail, `${path.parse(nom).name}.mp4`);
          if (!sonderAudio(f.chemin) || !voixEnVideo(f.chemin, video)) return bloque('FICHIER', "je n'arrive pas à lire ce mémo vocal");
          media.ouvrir('placer', t.id);
          placer(media, config, { nom, chemin: video, voix: f.chemin, type: 'audio' }, 'face', [slug], { tournage: t.id });
          media.fermer();
        } finally { fs.rmSync(travail, { recursive: true, force: true }); }
        say(`PLACE ${nom} -> ${slug}/face`);
        say(`FIN places=1 a_ranger=${media.aRanger().fichiers.length}`);
        return 0;
      }
      const m = f.type === 'video' ? sonder(f.chemin) : null;
      if (type !== 'photo' && !m) return bloque('FICHIER', "ce n'est pas une vidéo que je sais lire");
      const st = fs.statSync(f.chemin);
      const d = { nom, chemin: f.chemin, type: f.type, date: m?.date || st.mtime,
        duree: m?.duree || 0, duree_s: m?.duree_s || 0, orientation: m?.orientation || null };
      media.ouvrir('placer', t.id);
      placer(media, config, d, type, [slug], { tournage: t.id, source: 'toi' });
      media.fermer();
      say(`PLACE ${nom} -> ${slug}/${type}`);
      say(`FIN places=1 a_ranger=${media.aRanger().fichiers.length}`);
      return 0;
    }
    // Un fichier envoyé depuis le studio (« Ajouter une vidéo », 19/11) : copié par le serveur dans <home>/envois/,
    // jamais ailleurs. Il est rangé comme un placement à la main (journal « placer »), puis son dossier d'envoi part.
    if (o.envoi) {
      const envois = path.join(config.home, 'envois');
      let chemin;
      try { chemin = fs.realpathSync(o.envoi); } catch { return bloque('FICHIER', 'je ne trouve pas ce fichier'); }
      const racine = fs.existsSync(envois) ? fs.realpathSync(envois) : envois;
      if (!chemin.startsWith(racine + path.sep) || path.basename(chemin) !== nom || !fs.statSync(chemin).isFile()) return bloque('FICHIER', 'je ne trouve pas ce fichier');
      const genre = typeFichier(nom);
      if (!genre || genre === 'partiel' || (type === 'photo') !== (genre === 'photo')) return bloque('TYPE', type === 'photo' ? "ce n'est pas une photo" : "ce n'est pas une vidéo");
      const m = genre === 'video' ? sonder(chemin) : null;
      if (genre === 'video' && !m) return bloque('FICHIER', "ce n'est pas une vidéo que je sais lire");
      const st = fs.statSync(chemin);
      const d = { nom, chemin, type: genre, date: m?.date || st.mtime,
        duree: m?.duree || 0, duree_s: m?.duree_s || 0, orientation: m?.orientation || null };
      media.ouvrir('placer', null);
      placer(media, config, d, type, [slug], { source: 'toi' });
      media.fermer();
      say(`PLACE ${nom} -> ${slug}/${type}`);
      say(`FIN places=1 a_ranger=${media.aRanger().fichiers.length}`);
      return 0;
    }
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
    placer(media, config, f, type, [slug], { tournage: entree.tournage || null, vu: entree.vu || null, source: 'toi' });
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
  if (!slug || !type || !nom) return bloque('USAGE', 'retirer <slug> <face|b-roll|photo|ecran> <nom>');
  if (!['face', 'b-roll', 'photo', 'ecran'].includes(type)) return bloque('TYPE', 'le type est face, b-roll, photo ou ecran');
  if (!SLUG.test(slug)) return bloque('CONTENU', 'je ne trouve pas ce contenu');
  if (nom !== path.basename(nom) || nom.startsWith('.')) return bloque('FICHIER', 'je ne trouve pas ce fichier');
  const dossier = path.join(config.media, slug, type === 'photo' ? 'photos' : type);
  const chemin = path.join(dossier, nom);
  const ext = path.extname(nom).toLowerCase();
  if (type === 'face' && /-monte(-\d+)?\.mp4$|-coupe/i.test(nom)) return bloque('FICHIER', 'ce fichier vient du montage, je n\'y touche pas');
  const liberer = prendreVerrou(config.media);
  if (!liberer) return bloque('OCCUPE', 'un rangement est déjà en cours, réessaie dans un instant');
  try {
    // Un fichier de la Galerie (lot 15) : seul le lien du contenu part, le fichier reste dans la Galerie.
    const lg = type !== 'face' && type !== 'ecran' && !estLien(chemin) && fs.existsSync(chemin) ? lienVersId(nom) : null;
    const g = lg ? galerieDe(config, media) : null;
    if (lg && g.fiche(lg.id)) {
      media.ouvrir('retirer', null);
      g.delier(config.media, slug, lg.id, { slide: lg.slide, media });
      media.fermer();
      say(`RETIRE ${nom} ${slug}/${type} galerie`);
      say('FIN retires=1');
      return 0;
    }
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

// ---------- Changer le type d'une vidéo rangée (vue Montage, 19/11) ----------
// Face caméra -> plan filmé en plus : la vidéo quitte face/ pour la bibliothèque, avec un lien dans le contenu.
// Plan filmé en plus -> face caméra : le clip quitte la bibliothèque pour face/ (sous son nom d'origine), seulement
// s'il ne sert à aucun autre contenu. Une seule entrée « placer » au journal (annulable, « rangée ici par toi »).

function changer(o) {
  const [slug, type, nom, nouveau] = o.pos.slice(1);
  const config = lireConfig(o.config);
  const media = new Media(config.media);
  const bloque = (code, phrase) => { say(`BLOQUE ${code} ${phrase}`); return 2; };
  if (!slug || !type || !nom || !nouveau) return bloque('USAGE', 'changer <slug> <face|b-roll> <nom> <b-roll|face>');
  if (!['face', 'b-roll'].includes(type) || !['face', 'b-roll'].includes(nouveau) || type === nouveau) return bloque('TYPE', 'on passe de face à b-roll ou de b-roll à face');
  if (!SLUG.test(slug) || !fs.existsSync(path.join(config.depot, 'contenus', slug))) return bloque('CONTENU', 'je ne trouve pas ce contenu');
  if (nom !== path.basename(nom) || nom.startsWith('.') || typeFichier(nom) !== 'video') return bloque('FICHIER', 'je ne trouve pas ce fichier');
  if (/-monte(-\d+)?\.mp4$|-coupe/i.test(nom)) return bloque('FICHIER', 'ce fichier vient du montage, je n\'y touche pas');
  const liberer = prendreVerrou(config.media);
  if (!liberer) return bloque('OCCUPE', 'un rangement est déjà en cours, réessaie dans un instant');
  try {
    if (type === 'face') {
      const chemin = path.join(config.media, slug, 'face', nom);
      if (!fs.existsSync(chemin) || estLien(chemin) || !fs.statSync(chemin).isFile()) return bloque('FICHIER', 'je ne trouve pas ce fichier');
      if (fs.existsSync(path.join(config.media, slug, 'face', `${path.parse(nom).name}-montage`))) return bloque('MONTAGE', 'le montage a déjà commencé avec cette vidéo');
      const m = sonder(chemin);
      if (!m) return bloque('FICHIER', "ce n'est pas une vidéo que je sais lire");
      media.ouvrir('placer', null);
      placer(media, config, { nom, chemin, type: 'video', date: m.date || fs.statSync(chemin).mtime,
        duree: m.duree, duree_s: m.duree_s, orientation: m.orientation }, 'b-roll', [slug], { source: 'toi' });
      media.fermer();
    } else if (lienVersId(nom) && !estLien(path.join(config.media, slug, 'b-roll', nom)) && galerieDe(config, media).fiche(lienVersId(nom).id)) {
      // Un b-roll de la Galerie qui est en fait sa face caméra : il sort de la Galerie (jamais de face caméra dedans),
      // seulement s'il ne sert à aucun autre contenu.
      const g = media.galerie;
      const id = lienVersId(nom).id;
      const fiche = g.fiche(id);
      if ((fiche.utilisations || []).some((u) => u.slug !== slug)) return bloque('PARTAGE', 'ce plan sert aussi à un autre contenu, je ne peux pas en faire ta face caméra');
      const dossier = path.join(config.media, slug, 'face');
      fs.mkdirSync(dossier, { recursive: true });
      const origine = fiche.nom_origine && fiche.nom_origine === path.basename(fiche.nom_origine) && !fiche.nom_origine.startsWith('.') ? fiche.nom_origine : nom;
      media.ouvrir('placer', fiche.origine?.tournage || null);
      g.delier(config.media, slug, id, { media });
      g.sortir(id, path.join(dossier, nomLibre(dossier, origine)), { media });
      media.fermer();
    } else {
      const lienP = path.join(config.media, slug, 'b-roll', nom);
      if (!estLien(lienP)) return bloque('FICHIER', 'je ne trouve pas ce fichier');
      const id = path.basename(nom, path.extname(nom));
      const clip = media.index().clips[id];
      const fichier = clip && path.join(config.media, clip.fichier);
      if (!clip || !fs.existsSync(fichier)) return bloque('FICHIER', 'je ne trouve pas ce fichier');
      if ((clip.contenus || []).some((s) => s !== slug)) return bloque('PARTAGE', 'ce plan sert aussi à un autre contenu, je ne peux pas en faire ta face caméra');
      const dossier = path.join(config.media, slug, 'face');
      fs.mkdirSync(dossier, { recursive: true });
      const origine = clip.origine && clip.origine === path.basename(clip.origine) && !clip.origine.startsWith('.') ? clip.origine : nom;
      media.ouvrir('placer', clip.tournage || null);
      media.delier(lienP, 'changer');
      media.retirerContenu(id, slug);
      media.deplacer(fichier, path.join(dossier, nomLibre(dossier, origine)), 'face');
      media.retirerClip(id);
      media.fermer();
    }
    say(`CHANGE ${nom} ${slug}/${type} -> ${slug}/${nouveau}`);
    say('FIN changes=1');
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
    galerieDe(config, media);
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
  else if (o.pos[0] === 'changer') code = changer(o);
  else if (o.pos.length) { say('BLOQUE USAGE ranger.mjs --config <fichier> [--tournage <id>] [--simulation] | placer <nom> <slug> <type> | annuler <date|dernier> | retirer <slug> <type> <nom> | changer <slug> <type> <nom> <nouveau>'); code = 2; }
  else code = await ranger(o);
} catch (e) {
  note(`erreur : ${e.stack || e.message}`);
  code = 1;
}
process.exitCode = code;
