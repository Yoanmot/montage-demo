// Fabrique un faux tournage complet dans un dossier temporaire (jamais ~/Downloads ni ~/Contenu) : un dépôt avec
// 3 contenus et leurs scripts, un plan de tournage conforme à la section 5 du contrat, une bibliothèque qui contient
// déjà un clip, et un dossier d'arrivées rempli de vidéos fabriquées avec ffmpeg (date de prise posée dans les
// métadonnées) dont les face caméra parlent avec la voix de « say », plus des pièges.
//
//   node tests/fabrique.mjs [dossier]     fabrique et affiche le chemin de la config (pour un essai à la main)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isoZurich, outil } from '../lib/commun.mjs';

export const SCRIPTS = {
  'faim-a-16h': "Tu as faim à seize heures tous les après-midi ? Ce n'est pas un manque de volonté. Ton déjeuner manquait sûrement de protéines et de fibres, alors ta glycémie redescend vite et ton corps réclame du sucre. Ajoute une portion de viande, de poisson ou de lentilles à midi, et garde une pomme avec une poignée d'amandes pour la pause. Teste pendant une semaine et regarde ce qui change.",
  'proteines-au-petit-dej': "Au petit déjeuner, la plupart des gens mangent des céréales, une tartine de confiture et un jus d'orange. Résultat, presque aucune protéine jusqu'à midi. Remplace une partie par un bol de skyr, des œufs brouillés ou du fromage blanc avec des flocons d'avoine. Tu tiens plus longtemps, tu grignotes moins, et tes muscles récupèrent mieux de tes séances.",
  'dos-qui-tire-au-bureau': "Ton dos tire après une journée au bureau ? Ta chaise n'est pas la seule coupable. Rester assis huit heures sans bouger raidit les hanches et le haut du dos. Toutes les heures, lève-toi, fais dix rotations du buste et étire tes fléchisseurs de hanche contre le mur. Deux minutes suffisent, et ton dos te dira merci le soir.",
};
// Moitié d'un script, moitié d'un autre : impossible de trancher.
export const AMBIGU = "Ton déjeuner manquait sûrement de protéines et de fibres, alors ta glycémie redescend vite et ton corps réclame du sucre. Remplace une partie par un bol de skyr, des œufs brouillés ou du fromage blanc avec des flocons d'avoine, tu grignotes moins.";
export const HORS_SUJET = "Demain il va pleuvoir sur tout le canton, alors pense à prendre ton parapluie et une veste chaude pour aller faire tes courses au marché du samedi matin avec les enfants et la voisine.";

// Ce que le faux modèle « voit » selon la couleur du clip (voir faux-modele.mjs).
export const TABLE_COULEURS = {
  rouge: { prise: 4, ce_qu_on_voit: 'un plan entièrement rouge', mouvements: ['le plan rouge reste fixe'] },
  vert: { prise: 5, ce_qu_on_voit: 'un plan entièrement vert', mouvements: ['le plan vert reste fixe'] },
  jaune: { prise: 7, ce_qu_on_voit: 'une photo entièrement jaune', mouvements: [] },
};

function ff(args) {
  const r = spawnSync(outil('ffmpeg'), ['-nostdin', '-v', 'error', '-y', ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg : ${r.stderr}`);
}
const meta = (d) => ['-movflags', 'use_metadata_tags', '-metadata', `com.apple.quicktime.creationdate=${isoZurich(d).replace(/:(\d\d)$/, '$1')}`];

function faceCamera(fichier, texte, date, travail) {
  const aiff = path.join(travail, `${path.basename(fichier)}.aiff`);
  const r = spawnSync('/usr/bin/say', ['-v', 'Jacques', '-o', aiff, texte]);
  if (r.status !== 0) throw new Error('say a échoué');
  ff(['-f', 'lavfi', '-i', 'color=c=gray:s=360x640:r=30', '-i', aiff, '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', ...meta(date), fichier]);
}
function clipCouleur(fichier, couleur, duree, date) {
  ff(['-f', 'lavfi', '-i', `color=c=${couleur}:s=360x640:r=30:d=${duree}`, '-f', 'lavfi', '-i', `anullsrc=r=48000:cl=mono:d=${duree}`,
    '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', ...meta(date), fichier]);
}

function script(titre, texte) {
  return `# ${titre}\n\n- Format : face caméra\n\n## Accroches proposées\n1. (question) ${texte.split('?')[0]} ?\n\n## Texte complet\n${texte}\n\n## En points\n- l'idée principale\n\n## À filmer en plus\n- rien\n\n## Légende\nUne légende.\n`;
}

export function fabriquer(racine = fs.mkdtempSync(path.join(os.tmpdir(), 'faux-tournage-'))) {
  const depot = path.join(racine, 'depot'), media = path.join(racine, 'Contenu'), arrivees = path.join(racine, 'arrivees');
  const home = path.join(racine, 'studio-home'), travail = path.join(racine, '.travail'), disque = path.join(racine, 'disque');
  for (const d of [depot, media, arrivees, home, travail]) fs.mkdirSync(d, { recursive: true });

  for (const [slug, texte] of Object.entries(SCRIPTS)) {
    fs.mkdirSync(path.join(depot, 'contenus', slug), { recursive: true });
    fs.writeFileSync(path.join(depot, 'contenus', slug, 'script.md'), script(slug, texte));
  }
  fs.mkdirSync(path.join(depot, 'publications'), { recursive: true });
  fs.writeFileSync(path.join(depot, 'publications', 'registre.json'), JSON.stringify({ version: 1, publications: {} }, null, 2) + '\n');

  // Un clip déjà en bibliothèque (tournage précédent).
  const ancien = '20261102-101500-ab12';
  fs.mkdirSync(path.join(media, '_bibliotheque', 'b-roll'), { recursive: true });
  clipCouleur(path.join(media, '_bibliotheque', 'b-roll', `${ancien}.mov`), 'blue', 2, new Date(Date.now() - 13 * 86400e3));
  fs.writeFileSync(path.join(media, '_bibliotheque', 'index.json'), JSON.stringify({ version: 1, clips: { [ancien]: {
    fichier: `_bibliotheque/b-roll/${ancien}.mov`, origine: 'IMG_0001.MOV', pris_le: '2026-11-02T10:15:00+01:00', duree_s: 2,
    orientation: 'portrait', lieu: 'bureau', materiel: [], ce_qu_on_voit: 'un plan bleu', mouvements: ['le plan bleu reste fixe'],
    themes: [], contenus: ['un-ancien-contenu'], tournage: '2026-11-02-0900', vignettes: [] } } }, null, 2) + '\n');

  // Un vieux fichier, arrivé avant le tournage : jamais regardé.
  fs.writeFileSync(path.join(arrivees, 'vieux-fichier.mov'), 'vieux');
  spawnSync('/bin/sleep', ['1.5']);

  const creeLe = new Date(Math.floor(Date.now() / 1000) * 1000);   // à la seconde, comme dans le fichier
  const id = 'essai-tournage';
  const contenu = (slug, usages = []) => ({ slug, usages });
  const tournage = {
    version: 1, id, cree_le: isoZurich(creeLe), contenus: Object.keys(SCRIPTS), duree_estimee_min: 20,
    prises: [
      { n: 1, type: 'face', contenus: [contenu('faim-a-16h')], lieu: 'salon', materiel: [], ce_qu_on_voit: 'toi face caméra', mouvements: [], duree_s: 30, deja_en_bibliotheque: null },
      { n: 2, type: 'face', contenus: [contenu('proteines-au-petit-dej')], lieu: 'salon', materiel: [], ce_qu_on_voit: 'toi face caméra', mouvements: [], duree_s: 30, deja_en_bibliotheque: null },
      { n: 3, type: 'face', contenus: [contenu('dos-qui-tire-au-bureau')], lieu: 'salon', materiel: [], ce_qu_on_voit: 'toi face caméra', mouvements: [], duree_s: 30, deja_en_bibliotheque: null },
      { n: 4, type: 'b-roll', contenus: [contenu('faim-a-16h', [{ mouvement: 1, phrase: 'ton corps réclame du sucre' }]), contenu('proteines-au-petit-dej', [{ mouvement: 1, phrase: 'un bol de skyr' }])],
        lieu: 'cuisine', materiel: [], ce_qu_on_voit: 'un plan entièrement rouge, une seule prise', mouvements: ['le plan rouge reste fixe'], duree_s: 6, deja_en_bibliotheque: null },
      { n: 5, type: 'b-roll', contenus: [contenu('dos-qui-tire-au-bureau', [{ mouvement: 1, phrase: 'dix rotations du buste' }])],
        lieu: 'bureau', materiel: [], ce_qu_on_voit: 'un plan entièrement vert', mouvements: ['le plan vert reste fixe'], duree_s: 4, deja_en_bibliotheque: null },
      { n: 6, type: 'b-roll', contenus: [contenu('dos-qui-tire-au-bureau', [{ mouvement: 1, phrase: 'au bureau' }])],
        lieu: 'bureau', materiel: [], ce_qu_on_voit: 'déjà filmé le 02/11 : pas besoin de refilmer', mouvements: ['le plan bleu reste fixe'], duree_s: 0, deja_en_bibliotheque: ancien },
      { n: 7, type: 'photo', contenus: [contenu('proteines-au-petit-dej')], lieu: 'cuisine', materiel: [], ce_qu_on_voit: 'une photo entièrement jaune', mouvements: [], duree_s: 0, deja_en_bibliotheque: null },
    ],
  };
  fs.mkdirSync(path.join(depot, 'tournages'), { recursive: true });
  fs.writeFileSync(path.join(depot, 'tournages', `${id}.json`), JSON.stringify(tournage, null, 2) + '\n');

  // Les rushs, dans l'ordre où ils ont été filmés (dates de prise une minute d'écart).
  let minute = 0;
  const prise = () => new Date(creeLe.getTime() + 60e3 * (++minute));
  faceCamera(path.join(arrivees, 'IMG_1001.MOV'), SCRIPTS['faim-a-16h'], prise(), travail);
  faceCamera(path.join(arrivees, 'IMG_1002.MOV'), SCRIPTS['proteines-au-petit-dej'], prise(), travail);
  faceCamera(path.join(arrivees, 'IMG_1003.MOV'), SCRIPTS['dos-qui-tire-au-bureau'], prise(), travail);
  faceCamera(path.join(arrivees, 'IMG_1004.MOV'), AMBIGU, prise(), travail);           // piège : deux scripts à la fois
  faceCamera(path.join(arrivees, 'IMG_1005.MOV'), HORS_SUJET, prise(), travail);       // piège : aucun script
  clipCouleur(path.join(arrivees, 'IMG_1006.MOV'), 'red', 6, prise());
  clipCouleur(path.join(arrivees, 'IMG_1007.MOV'), 'magenta', 5, prise());             // piège : aucun plan prévu
  clipCouleur(path.join(arrivees, 'IMG_1008.MOV'), 'green', 4, prise());
  ff(['-f', 'lavfi', '-i', 'color=c=yellow:s=360x640', '-frames:v', '1', path.join(arrivees, 'IMG_1009.JPG')]);
  // Pièges : vidéo tronquée (arrivée incomplète), transfert en cours, fichier qui n'est pas un média.
  clipCouleur(path.join(travail, 'entier.mov'), 'red', 3, prise());
  const entier = fs.readFileSync(path.join(travail, 'entier.mov'));
  fs.writeFileSync(path.join(arrivees, 'IMG_1010.MOV'), entier.subarray(0, Math.floor(entier.length * 0.3)));
  fs.writeFileSync(path.join(arrivees, 'IMG_1011.MOV.download'), 'en cours');
  fs.writeFileSync(path.join(arrivees, 'facture.pdf'), '%PDF-1.4');
  // Le reste d'un dossier Téléchargements (lot 12) : rien de tout ça n'est lu, nommé ni déplacé.
  fs.writeFileSync(path.join(arrivees, 'Capture d’écran.png'), 'png');
  fs.copyFileSync(path.join(arrivees, 'IMG_1008.MOV'), path.join(arrivees, 'tuto-internet.mov'));
  spawnSync('/usr/bin/xattr', ['-w', 'com.apple.metadata:kMDItemWhereFroms', 'https://exemple.invalid/tuto.mov', path.join(arrivees, 'tuto-internet.mov')]);
  fs.mkdirSync(path.join(arrivees, 'Dossier perso'));
  fs.writeFileSync(path.join(arrivees, 'Dossier perso', 'IMG_2000.MOV'), 'x');
  fs.rmSync(travail, { recursive: true, force: true });

  const config = {
    version: 1, prenom: 'Essai', port: 4747, depot_hoc: depot, media, arrivees, disque_externe: disque,
    skills: path.join(racine, 'skills'), agents: { idees: 'head-of-content', montage: 'monteur' }, sessions_en_parallele: 1,
    synchro_minutes: 5, publication: { heures_par_defaut: { reel: '18:30', carrousel: '12:15' }, jours_par_defaut: ['mardi'], simulation: true },
    claude: { binaire: 'claude', modele: null },
  };
  const configP = path.join(home, 'studio.config.json');
  fs.writeFileSync(configP, JSON.stringify(config, null, 2) + '\n');
  return { racine, depot, media, arrivees, home, disque, config: configP, tournage: id, ancien };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = fabriquer(process.argv[2] ? path.resolve(process.argv[2]) : undefined);
  console.log(JSON.stringify(r, null, 2));
}
