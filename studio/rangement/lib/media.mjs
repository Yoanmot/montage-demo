// Écritures dans le dossier média : bibliothèque, liens, à ranger, journal. Chaque opération faite est notée dans le
// journal au moment où elle est faite (pour pouvoir annuler, même après un arrêt brutal).
import fs from 'node:fs';
import path from 'node:path';
import { ecrireJson, lireJson, isoZurich, deplacer, nomLibre, estLien } from './commun.mjs';

export class Media {
  constructor(racine) {
    this.racine = racine;
    this.indexP = path.join(racine, '_bibliotheque', 'index.json');
    this.arangerP = path.join(racine, '_a-ranger', 'a-ranger.json');
    this.journalP = path.join(racine, '_journal-rangement.json');
  }

  index() { return lireJson(this.indexP, { version: 1, clips: {} }); }
  ecrireIndex(ix) { ecrireJson(this.indexP, ix); }
  aRanger() { return lireJson(this.arangerP, { version: 1, fichiers: [] }); }
  ecrireARanger(a) { ecrireJson(this.arangerP, a); }
  journal() { return lireJson(this.journalP, { version: 1, rangements: [] }); }

  // Ouvre une entrée de journal ; chaque op y est ajoutée et le journal réécrit aussitôt.
  ouvrir(commande, tournage) {
    const j = this.journal();
    const le = isoZurich();
    let id = le, k = 1;
    while (j.rangements.some((r) => r.id === id)) id = `${le}#${++k}`;
    this.entree = { id, le, commande, tournage: tournage || null, ops: [], annule: null };
    j.rangements.push(this.entree);
    ecrireJson(this.journalP, j);
  }
  noter(op) {
    if (!this.entree) return;
    this.entree.ops.push({ ...op, le: isoZurich() });
    const j = this.journal();
    const i = j.rangements.findIndex((r) => r.id === this.entree.id);
    if (i >= 0) j.rangements[i] = this.entree; else j.rangements.push(this.entree);
    ecrireJson(this.journalP, j);
  }
  fermer() {
    if (!this.entree) return;
    const j = this.journal();
    const i = j.rangements.findIndex((r) => r.id === this.entree.id);
    if (i >= 0 && !this.entree.ops.length) j.rangements.splice(i, 1);   // rien fait : pas d'entrée vide
    ecrireJson(this.journalP, j);
    this.entree = null;
  }

  deplacer(de, vers, raison) {
    deplacer(de, vers);
    this.noter({ op: 'deplacement', de, vers, raison });
  }
  creer(chemin) { this.noter({ op: 'creation', chemin }); }

  // Lien <slug>/b-roll/<clip_id>.<ext> -> ../../_bibliotheque/b-roll/<clip_id>.<ext> (relatif : suit un déplacement
  // du dossier média). Renvoie false si le lien existe déjà.
  lier(slug, fichierBiblio, raison) {
    const dossier = path.join(this.racine, slug, 'b-roll');
    fs.mkdirSync(dossier, { recursive: true });
    const chemin = path.join(dossier, path.basename(fichierBiblio));
    if (estLien(chemin) || fs.existsSync(chemin)) return false;
    fs.symlinkSync(path.relative(dossier, fichierBiblio), chemin);
    this.noter({ op: 'lien', chemin, cible: fichierBiblio, raison });
    return true;
  }

  ajouterClip(clipId, entree) {
    const ix = this.index();
    ix.clips[clipId] = entree;
    this.ecrireIndex(ix);
    this.noter({ op: 'index_ajout', clip_id: clipId });
  }
  ajouterContenu(clipId, slug) {
    const ix = this.index();
    const c = ix.clips[clipId];
    if (!c) return;
    c.contenus = c.contenus || [];
    if (c.contenus.includes(slug)) return;
    c.contenus.push(slug);
    this.ecrireIndex(ix);
    this.noter({ op: 'index_contenu', clip_id: clipId, slug });
  }

  // Met un fichier de côté dans _a-ranger/ avec sa raison et ses candidats.
  mettreDeCote(fichier, infos) {
    const dossier = path.join(this.racine, '_a-ranger');
    fs.mkdirSync(dossier, { recursive: true });
    const nom = nomLibre(dossier, path.basename(fichier));
    this.deplacer(fichier, path.join(dossier, nom), 'a_ranger');
    const a = this.aRanger();
    a.fichiers = a.fichiers.filter((f) => f.nom !== nom);
    const entree = { nom, ...infos, mis_de_cote_le: isoZurich() };
    a.fichiers.push(entree);
    this.ecrireARanger(a);
    this.noter({ op: 'a_ranger_ajout', nom });
    return nom;
  }
  retirerDeARanger(nom) {
    const a = this.aRanger();
    const entree = a.fichiers.find((f) => f.nom === nom);
    if (!entree) return null;
    a.fichiers = a.fichiers.filter((f) => f.nom !== nom);
    this.ecrireARanger(a);
    this.noter({ op: 'a_ranger_retrait', nom, entree });
    return entree;
  }

  // Retire un lien b-roll d'un contenu (Romain : « pas le bon », lot 9).
  delier(chemin, raison) {
    const cible = fs.readlinkSync(chemin);
    fs.unlinkSync(chemin);
    this.noter({ op: 'lien_retrait', chemin, cible, raison });
  }
  retirerContenu(clipId, slug) {
    const ix = this.index();
    const c = ix.clips[clipId];
    if (!c || !(c.contenus || []).includes(slug)) return;
    c.contenus = c.contenus.filter((s) => s !== slug);
    this.ecrireIndex(ix);
    this.noter({ op: 'index_contenu_retrait', clip_id: clipId, slug });
  }
  retirerClip(clipId) {
    const ix = this.index();
    const entree = ix.clips[clipId];
    if (!entree) return null;
    delete ix.clips[clipId];
    this.ecrireIndex(ix);
    this.noter({ op: 'index_retrait', clip_id: clipId, entree });
    return entree;
  }

  // Annule une entrée du journal, dans l'ordre inverse. Renvoie les lignes à afficher.
  annuler(entree) {
    const lignes = [];
    for (const op of [...entree.ops].reverse()) {
      try {
        if (op.op === 'deplacement') {
          if (fs.existsSync(op.vers) && !fs.existsSync(op.de)) { deplacer(op.vers, op.de); lignes.push(`ANNULE ${path.basename(op.de)} remis où il était`); }
          else lignes.push(`GARDE ${path.basename(op.de)} déjà déplacé depuis, je n'y touche pas`);
        } else if (op.op === 'lien') {
          if (estLien(op.chemin)) fs.unlinkSync(op.chemin);
        } else if (op.op === 'creation') {
          fs.rmSync(op.chemin, { force: true });
        } else if (op.op === 'index_ajout') {
          const ix = this.index(); delete ix.clips[op.clip_id]; this.ecrireIndex(ix);
        } else if (op.op === 'index_contenu') {
          const ix = this.index(); const c = ix.clips[op.clip_id];
          if (c) { c.contenus = (c.contenus || []).filter((s) => s !== op.slug); this.ecrireIndex(ix); }
        } else if (op.op === 'a_ranger_ajout') {
          const a = this.aRanger(); a.fichiers = a.fichiers.filter((f) => f.nom !== op.nom); this.ecrireARanger(a);
        } else if (op.op === 'lien_retrait') {
          if (!estLien(op.chemin) && !fs.existsSync(op.chemin)) { fs.mkdirSync(path.dirname(op.chemin), { recursive: true }); fs.symlinkSync(op.cible, op.chemin); }
        } else if (op.op === 'index_contenu_retrait') {
          const ix = this.index(); const c = ix.clips[op.clip_id];
          if (c && !(c.contenus || []).includes(op.slug)) { c.contenus = [...(c.contenus || []), op.slug]; this.ecrireIndex(ix); }
        } else if (op.op === 'index_retrait') {
          const ix = this.index(); if (!ix.clips[op.clip_id]) { ix.clips[op.clip_id] = op.entree; this.ecrireIndex(ix); }
        } else if (op.op === 'a_ranger_retrait') {
          const a = this.aRanger(); if (!a.fichiers.some((f) => f.nom === op.nom)) a.fichiers.push(op.entree); this.ecrireARanger(a);
        }
      } catch (e) {
        lignes.push(`GARDE ${path.basename(op.de || op.chemin || op.nom || op.clip_id || '?')} ${e.message}`);
      }
    }
    const j = this.journal();
    const r = j.rangements.find((x) => x.id === entree.id);
    if (r) r.annule = isoZurich();
    ecrireJson(this.journalP, j);
    return lignes;
  }
}
