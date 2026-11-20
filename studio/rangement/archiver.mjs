#!/usr/bin/env node
// Archivage sur le disque externe (lot 4 du studio, CONTRAT-STUDIO.md section 2).
//
//   node archiver.mjs --config <studio.config.json> [--simulation]
//
// Seulement si le disque est branché. On y déplace les rushs d'un contenu publié (face/ sauf les -monte*.mp4,
// photos/) et les clips de bibliothèque dont tous les contenus sont publiés depuis plus de 30 jours. Déplacer =
// copie, vérification (taille et empreinte sha256 de la copie relue sur le disque), puis suppression de l'original.
// La vidéo finale reste sur le Mac. Disque absent : rien n'est fait, une ligne le dit.
//
// Sortie : « ARCHIVE <nom> -> <destination dans le disque> », « GARDE <nom> <raison> », « DISQUE_ABSENT <phrase> »,
// puis « FIN archives=<n> gardes=<n> ». ARCHIVE_DISQUE_LOCAL=1 (tests) accepte un dossier qui n'est pas un disque.
import fs from 'node:fs';
import path from 'node:path';
import { lireConfig, lireJson, ecrireJson, lireDate, sha256, typeFichier, prendreVerrou, estLien, PHOTOS } from './lib/commun.mjs';
import { Media } from './lib/media.mjs';

const say = (l) => process.stdout.write(l + '\n');
const note = (l) => process.stderr.write(l + '\n');
const JOURS_BIBLIO = 30;

const o = { simulation: false };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--config') o.config = argv[++i];
  else if (argv[i] === '--simulation') o.simulation = true;
}

function disqueBranche(d) {
  if (!d || !fs.existsSync(d)) return false;
  if (process.env.ARCHIVE_DISQUE_LOCAL === '1') return true;
  try { return fs.statSync(d).dev !== fs.statSync('/').dev && fs.statSync(d).isDirectory(); } catch { return false; }
}

// Date de publication de chaque contenu publié. Lot 12 : seulement « publié » (Instagram l'a confirmé). Un
// « programmé » dont l'heure est passée peut avoir été refusé par Instagram : ses rushs restent sur le Mac.
function publies(depot) {
  const reg = lireJson(path.join(depot, 'publications', 'registre.json'), { publications: {} });
  const out = {};
  for (const [slug, e] of Object.entries(reg.publications || {})) {
    const quand = lireDate(e.publie_le) || lireDate(e.prevu_le) || lireDate(e.enregistre_le);
    if (e.statut === 'publié') out[slug] = quand || new Date(0);
  }
  return out;
}

async function copieVerifiee(de, vers) {
  fs.mkdirSync(path.dirname(vers), { recursive: true });
  const h = await sha256(de);
  const taille = fs.statSync(de).size;
  if (fs.existsSync(vers)) {
    if (fs.statSync(vers).size === taille && await sha256(vers) === h) return { ok: true, deja: true };
    return { ok: false, pourquoi: 'un autre fichier porte déjà ce nom sur ton disque' };
  }
  const tmp = `${vers}.copie-en-cours`;
  fs.rmSync(tmp, { force: true });
  fs.copyFileSync(de, tmp);
  const fd = fs.openSync(tmp, 'r+'); fs.fsyncSync(fd); fs.closeSync(fd);
  if (fs.statSync(tmp).size !== taille || await sha256(tmp) !== h) {
    fs.rmSync(tmp, { force: true });
    return { ok: false, pourquoi: "la copie sur ton disque n'est pas identique, je garde l'original" };
  }
  fs.renameSync(tmp, vers);
  return { ok: true };
}

async function main() {
  const config = lireConfig(o.config);
  const simulation = o.simulation;
  let archives = 0, gardes = 0;
  if (!config.disque) { say("DISQUE_ABSENT aucun disque externe n'est réglé, je garde tout sur le Mac"); say('FIN archives=0 gardes=0'); return 0; }
  if (!disqueBranche(config.disque)) { say("DISQUE_ABSENT ton disque n'est pas branché, j'archiverai la prochaine fois qu'il le sera"); say('FIN archives=0 gardes=0'); return 0; }
  const liberer = simulation ? () => {} : prendreVerrou(config.media);
  if (!liberer) { note('un rangement est en cours'); say('FIN archives=0 gardes=0'); return 0; }
  const media = new Media(config.media);
  const cible = path.join(config.disque, 'Contenu');
  if (!simulation) media.ouvrir('archiver', null);
  try {
    const pub = publies(config.depot);
    const archiver = async (de, rel, nom) => {
      const vers = path.join(cible, rel);
      if (simulation) { say(`ARCHIVE ${nom} -> ${rel}`); archives++; return vers; }
      const r = await copieVerifiee(de, vers);
      if (!r.ok) { say(`GARDE ${nom} ${r.pourquoi}`); gardes++; return null; }
      fs.unlinkSync(de);
      media.noter({ op: 'archive', de, vers });
      say(`ARCHIVE ${nom} -> ${rel}`); archives++;
      return vers;
    };

    // 1. Rushs des contenus publiés : face/ (originaux seulement) et photos/.
    for (const slug of Object.keys(pub).sort()) {
      for (const sous of ['face', 'photos']) {
        const d = path.join(config.media, slug, sous);
        if (!fs.existsSync(d)) continue;
        for (const nom of fs.readdirSync(d).sort()) {
          const f = path.join(d, nom);
          if (estLien(f) || !fs.statSync(f).isFile() || nom.startsWith('.')) continue;
          const t = typeFichier(nom);
          if (sous === 'face' && (t !== 'video' || /-monte(-\d+)?\.mp4$/i.test(nom))) continue;   // la vidéo finale reste
          if (sous === 'photos' && !PHOTOS.has(path.extname(nom).toLowerCase())) continue;
          await archiver(f, path.join(slug, sous, nom), nom);
        }
      }
    }

    // 2. Clips de bibliothèque dont tous les contenus sont publiés depuis plus de 30 jours.
    const ix = media.index();
    const limite = Date.now() - JOURS_BIBLIO * 86400e3;
    for (const [id, c] of Object.entries(ix.clips)) {
      if (c.archive || !c.contenus?.length) continue;
      if (!c.contenus.every((s) => pub[s] && pub[s].getTime() < limite)) continue;
      const f = path.join(config.media, c.fichier);
      if (!fs.existsSync(f)) continue;
      const vers = await archiver(f, c.fichier, path.basename(c.fichier));
      if (!vers || simulation) continue;
      const ix2 = media.index();
      ix2.clips[id].archive = vers;
      media.ecrireIndex(ix2);
      // Les liens des contenus pointent désormais vers le disque (ils marchent quand il est branché).
      for (const s of c.contenus) {
        const lien = path.join(config.media, s, 'b-roll', path.basename(c.fichier));
        if (estLien(lien)) { fs.unlinkSync(lien); fs.symlinkSync(vers, lien); }
      }
    }
    return 0;
  } finally {
    if (!simulation) media.fermer();
    say(`FIN archives=${archives} gardes=${gardes}`);
    liberer();
  }
}

try { process.exitCode = await main(); }
catch (e) { note(`erreur : ${e.stack || e.message}`); process.exitCode = 1; }
