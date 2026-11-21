#!/usr/bin/env node
// La Galerie en ligne de commande (lot 15, CONTRAT-STUDIO.md section 18). Appelée par le serveur du studio (boutons
// du client) et par les agents (head of content, monteur, carrousel) pour lire le stock. Toute écriture qui touche le
// dossier média prend le verrou du rangement, puis celui de la Galerie ; rien n'est écrit de mémoire.
//
//   node galerie.mjs lister [--pour <slug>] [--config C]                  -> JSON : les fichiers, leur description, la règle des 3 vidéos
//   node galerie.mjs montrer <id> [--config C]                            -> JSON : une fiche
//   node galerie.mjs ajouter <chemin> (--envoi | --a-ranger) [--slug S [--slide N]] [--config C]
//                                                                          -> AJOUTE <id> <photo|b-roll> [puis POSE ...]
//   node galerie.mjs poser <slug> <id> [--slide N] [--config C]           -> POSE <id> -> <slug>/<b-roll|photos>
//   node galerie.mjs retirer <slug> <id> [--slide N] [--config C]         -> RETIRE <id> <slug>
//   node galerie.mjs supprimer <id> [--config C]                          -> SUPPRIME <id> octets=<n> ; BLOQUE UTILISE <slug>
//   node galerie.mjs decrire <id> --depuis <fichier.json> [--par toi] [--action <id>] [--config C]
//                                                                          -> DECRIT <id> ; BLOQUE SCHEMA <pourquoi>
//   node galerie.mjs plan <slug> <n> tourner|stock|proposition [<id>] [--debut s --fin s] [--config C]
//                                                                          -> PLAN <slug> <n> <stock|a_tourner>
//   node galerie.mjs plans <slug> [--config C]                            -> JSON : les plans effectifs du brief
//   node galerie.mjs relier-stock <slug> [--config C]                     -> LIE / DELIE ... puis FIN
//   node galerie.mjs reindexer [--config C]
//
// Sortie : une ligne par effet, puis « OK ... » ; un refus : « BLOQUE <CODE> <phrase> » et le code 2.
import fs from 'node:fs';
import path from 'node:path';
import { lireConfig, lireJson, prendreVerrou, SLUG, typeFichier, isoZurich } from './lib/commun.mjs';
import { vignettes, imagePhoto } from './lib/sens.mjs';
import { Media } from './lib/media.mjs';
import { Galerie, dossierGalerie, ID_GALERIE, validerDescription, ecart, postes, plansEffectifs, relierStock, ecrireChoixPlan,
  infosEntree, lienVersId, reservationsStock } from './lib/galerie.mjs';

const say = (l) => process.stdout.write(l + '\n');
const bloque = (code, phrase) => { say(`BLOQUE ${code} ${phrase}`); return 2; };

function args(argv) {
  const o = { pos: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (['--config', '--pour', '--slug', '--slide', '--depuis', '--par', '--action', '--debut', '--fin'].includes(a)) o[a.slice(2)] = argv[++i];
    else if (a === '--envoi') o.envoi = true;
    else if (a === '--a-ranger') o.aRanger = true;
    else o.pos.push(a);
  }
  return o;
}

const o = args(process.argv.slice(2));
const config = lireConfig(o.config);
const galerie = new Galerie(dossierGalerie(config));

function avecVerrouMedia(fn) {
  const liberer = prendreVerrou(config.media);
  if (!liberer) return bloque('OCCUPE', 'un rangement est en cours, réessaie dans un instant');
  try { return fn(); } finally { liberer(); }
}

const slide = () => (o.slide != null ? Number(o.slide) : null);
function exigerSlide() {
  const n = slide();
  return n == null || (Number.isInteger(n) && n >= 1 && n <= 99);
}
const contenuExiste = (slug) => SLUG.test(slug) && fs.existsSync(path.join(config.depot, 'contenus', slug));

function lister() {
  const sorties = postes(config.depot);
  const reservations = reservationsStock(config.depot);
  const pour = o.pour && SLUG.test(o.pour) ? o.pour : null;
  const fichiers = galerie.index().fichiers.map((f) => {
    const { fichier, vignettes: v, ...reste } = f;
    return { ...reste, ecart: ecart(f, config.depot, { pour, sorties, reservations }) };
  });
  say(JSON.stringify({ version: 1, regle: { ecart_min_videos: 3 }, fichiers }, null, 2));
  return 0;
}

function ajouter() {
  const source = o.pos[1];
  if (!source || !fs.existsSync(source) || !fs.statSync(source).isFile()) return bloque('FICHIER', 'je ne trouve pas ce fichier');
  // Seulement un fichier envoyé depuis le studio (<home>/envois/) ou mis de côté par le rangement (_a-ranger/) : jamais
  // un fichier pris ailleurs sur le Mac.
  const reel = fs.realpathSync(source);
  const permis = o.envoi ? path.join(config.home, 'envois') : o.aRanger ? path.join(config.media, '_a-ranger') : null;
  const racine = permis && fs.existsSync(permis) ? fs.realpathSync(permis) : null;
  if (!racine || !reel.startsWith(racine + path.sep)) return bloque('FICHIER', 'je ne trouve pas ce fichier');
  if (o.slug && !contenuExiste(o.slug)) return bloque('CONTENU', 'je ne trouve pas ce contenu');
  if (!exigerSlide()) return bloque('SLIDE', 'je ne trouve pas cette slide');
  const nom = path.basename(reel);
  const genre = typeFichier(nom);
  if (genre !== 'photo' && genre !== 'video') return bloque('FORMAT', "ce n'est ni une photo ni une vidéo");
  const infos = infosEntree(reel, nom);
  if (!infos) return bloque('ILLISIBLE', "je n'arrive pas à lire cette vidéo");
  if (o.slug && slide() && infos.type !== 'photo') return bloque('TYPE', "une slide prend une photo, pas une vidéo");
  return avecVerrouMedia(() => {
    const media = new Media(config.media);
    media.galerie = galerie;
    media.ouvrir('galerie', null);
    let fiche;
    try {
      if (o.aRanger) media.retirerDeARanger(nom);
      fiche = galerie.ajouter(reel, { ...infos, nom_origine: nom, origine: { genre: 'ajout' } }, {
        media,
        vignettes: (fichier, id) => {
          fs.mkdirSync(galerie.vignettesD, { recursive: true });
          return infos.type === 'photo' ? imagePhoto(fichier, path.join(galerie.vignettesD, `${id}.jpg`))
            : vignettes(fichier, infos.duree, path.join(galerie.vignettesD, id));
        },
      });
      say(fiche.doublon ? `DOUBLON ${fiche.id} ${fiche.type} déjà dans la Galerie` : `AJOUTE ${fiche.id} ${fiche.type}`);
      if (o.slug) {
        if (slide()) for (const autre of photosDeLaSlide(o.slug, slide())) if (autre !== fiche.id) galerie.delier(config.media, o.slug, autre, { slide: slide(), media });
        galerie.lier(config.media, o.slug, fiche.id, { slide: slide(), source: 'toi', media });
        say(`POSE ${fiche.id} -> ${o.slug}/${fiche.type === 'photo' ? 'photos' : 'b-roll'}`);
      }
    } finally { media.fermer(); }
    say(`OK id=${fiche.id} type=${fiche.type}${fiche.doublon ? ' doublon=1' : ''}`);
    return 0;
  });
}

function photosDeLaSlide(slug, n) {
  let noms = [];
  try { noms = fs.readdirSync(path.join(config.media, slug, 'photos')); } catch { return []; }
  return noms.map(lienVersId).filter((l) => l && l.slide === n).map((l) => l.id);
}

function poser() {
  const [, slug, id] = o.pos;
  if (!contenuExiste(slug)) return bloque('CONTENU', 'je ne trouve pas ce contenu');
  if (!ID_GALERIE.test(String(id || '')) || !galerie.fiche(id)) return bloque('INCONNU', "ce fichier n'est plus dans ta Galerie");
  if (!exigerSlide()) return bloque('SLIDE', 'je ne trouve pas cette slide');
  const f = galerie.fiche(id);
  if (slide() && f.type !== 'photo') return bloque('TYPE', "une slide prend une photo, pas une vidéo");
  // La règle des 3 vidéos (b-roll) : jamais reposé à moins de 3 vidéos postées d'écart, ni s'il sert à un autre
  // contenu pas encore posté.
  if (f.type === 'b-roll') {
    const e = ecart(f, config.depot, { pour: slug });
    if (!e.reutilisable) return bloque(e.raison === 'reserve' ? 'RESERVE' : 'RECENT', e.raison === 'reserve'
      ? 'ce plan sert déjà à un autre contenu pas encore posté' : `ce plan est passé dans une vidéo trop récente : attends encore ${e.attendre} vidéo${e.attendre > 1 ? 's' : ''}`);
  }
  return avecVerrouMedia(() => {
    const media = new Media(config.media);
    media.galerie = galerie;
    media.ouvrir('galerie', null);
    try {
      if (slide()) for (const autre of photosDeLaSlide(slug, slide())) if (autre !== id) galerie.delier(config.media, slug, autre, { slide: slide(), media });
      galerie.lier(config.media, slug, id, { slide: slide(), source: 'toi', media });
    } finally { media.fermer(); }
    say(`POSE ${id} -> ${slug}/${f.type === 'photo' ? 'photos' : 'b-roll'}`);
    say(`OK id=${id}`);
    return 0;
  });
}

function retirer() {
  const [, slug, id] = o.pos;
  if (!SLUG.test(String(slug || ''))) return bloque('CONTENU', 'je ne trouve pas ce contenu');
  if (!ID_GALERIE.test(String(id || ''))) return bloque('INCONNU', "ce fichier n'est plus dans ta Galerie");
  return avecVerrouMedia(() => {
    const media = new Media(config.media);
    media.galerie = galerie;
    media.ouvrir('galerie', null);
    let n;
    try { n = galerie.delier(config.media, slug, id, { slide: slide(), media }); } finally { media.fermer(); }
    say(`RETIRE ${id} ${slug} liens=${n}`);
    say(`OK id=${id}`);
    return 0;
  });
}

function supprimer() {
  const id = o.pos[1];
  if (!ID_GALERIE.test(String(id || '')) || !galerie.fiche(id)) return bloque('INCONNU', "ce fichier n'est plus dans ta Galerie");
  return avecVerrouMedia(() => {
    try {
      const octets = galerie.supprimer(id, { mediaRacine: config.media, depot: config.depot });
      say(`SUPPRIME ${id} octets=${octets}`);
      say(`OK id=${id}`);
      return 0;
    } catch (e) {
      if (e.code === 'UTILISE') return bloque('UTILISE', e.slug);
      throw e;
    }
  });
}

function decrire() {
  const id = o.pos[1];
  const f = ID_GALERIE.test(String(id || '')) ? galerie.fiche(id) : null;
  if (!f) return bloque('INCONNU', "ce fichier n'est plus dans ta Galerie");
  let brut;
  try { brut = fs.readFileSync(o.depuis, 'utf8'); } catch { return bloque('SCHEMA', 'description illisible'); }
  const v = validerDescription(brut, { type: f.type, duree_s: f.duree_s });
  if (!v.ok) return bloque('SCHEMA', v.pourquoi);
  galerie.decrire(id, v.description, { par: o.par === 'toi' ? 'toi' : 'studio', action: o.action || null });
  say(`DECRIT ${id}`);
  say(`OK id=${id}`);
  return 0;
}

function plan() {
  const [, slug, nBrut, choix, id] = o.pos;
  if (!contenuExiste(slug)) return bloque('CONTENU', 'je ne trouve pas ce contenu');
  const n = Number(nBrut);
  const plans = plansEffectifs(config, slug, { galerie });
  const p = plans?.find((x) => x.n === n);
  if (!p) return bloque('PLAN', 'je ne trouve pas ce plan dans ton brief');
  if (!['tourner', 'stock', 'proposition'].includes(choix)) return bloque('USAGE', 'plan <slug> <n> tourner|stock|proposition [<id>]');
  let ecrit;
  if (choix === 'tourner') ecrit = { choix: 'tourner' };
  else if (choix === 'proposition') ecrit = null;
  else {
    const f = ID_GALERIE.test(String(id || '')) ? galerie.fiche(id) : null;
    if (!f) return bloque('INCONNU', "ce fichier n'est plus dans ta Galerie");
    if (f.type !== p.type) return bloque('TYPE', p.type === 'photo' ? 'ce plan demande une photo' : 'ce plan demande une vidéo');
    const e = ecart(f, config.depot, { pour: slug });
    if (!e.reutilisable) return bloque(e.raison === 'reserve' ? 'RESERVE' : 'RECENT', e.raison === 'reserve'
      ? 'ce plan sert déjà à un autre contenu pas encore posté' : `ce plan est passé dans une vidéo trop récente : attends encore ${e.attendre} vidéo${e.attendre > 1 ? 's' : ''}`);
    const debut = o.debut != null ? Number(o.debut) : null, fin = o.fin != null ? Number(o.fin) : null;
    ecrit = { choix: 'stock', id, debut: Number.isFinite(debut) ? debut : null, fin: Number.isFinite(fin) ? fin : null };
  }
  return avecVerrouMedia(() => {
    ecrireChoixPlan(config, slug, n, ecrit, { texte: p.texte });
    for (const l of relierStock(config, slug, { galerie })) say(l);
    const apres = plansEffectifs(config, slug, { galerie }).find((x) => x.n === n);
    say(`PLAN ${slug} ${n} ${apres.etat}`);
    say(`OK slug=${slug} n=${n} etat=${apres.etat}`);
    return 0;
  });
}

function plans() {
  const slug = o.pos[1];
  if (!contenuExiste(slug)) return bloque('CONTENU', 'je ne trouve pas ce contenu');
  say(JSON.stringify({ version: 1, slug, plans: plansEffectifs(config, slug, { galerie }) }, null, 2));
  return 0;
}

function relier() {
  const slug = o.pos[1];
  if (!contenuExiste(slug)) return bloque('CONTENU', 'je ne trouve pas ce contenu');
  return avecVerrouMedia(() => {
    const faits = relierStock(config, slug, { galerie });
    faits.forEach(say);
    say(`OK slug=${slug} changes=${faits.length}`);
    return 0;
  });
}

let code;
try {
  const cmd = o.pos[0];
  if (cmd === 'lister') code = lister();
  else if (cmd === 'montrer') { const f = galerie.fiche(o.pos[1]); code = f ? (say(JSON.stringify(f, null, 2)), 0) : bloque('INCONNU', "ce fichier n'est plus dans ta Galerie"); }
  else if (cmd === 'ajouter') code = ajouter();
  else if (cmd === 'poser') code = poser();
  else if (cmd === 'retirer') code = retirer();
  else if (cmd === 'supprimer') code = supprimer();
  else if (cmd === 'decrire') code = decrire();
  else if (cmd === 'plan') code = plan();
  else if (cmd === 'plans') code = plans();
  else if (cmd === 'relier-stock') code = relier();
  else if (cmd === 'reindexer') { galerie.sousVerrou(() => {}); say(`OK fichiers=${galerie.index().fichiers.length} le=${isoZurich()}`); code = 0; }
  else code = bloque('USAGE', 'lister | montrer | ajouter | poser | retirer | supprimer | decrire | plan | plans | relier-stock | reindexer');
} catch (e) {
  process.stderr.write(`erreur : ${e.stack || e.message}\n`);
  if (e.code === 'OCCUPE') code = bloque('OCCUPE', 'la Galerie est occupée, réessaie dans un instant');
  // Supprimé entre la vérification et l'écriture (une suppression passée juste avant) : un refus clair, pas un plantage.
  else if (e.code === 'INCONNU') code = bloque('INCONNU', "ce fichier n'est plus dans ta Galerie");
  else code = 1;
}
process.exitCode = code;
