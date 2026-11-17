// Synchronisation du dépôt du head of content (git pull --rebase) : à l'ouverture, toutes les N
// minutes, avant chaque action. Conflit : on abandonne le rebase et on rejoue une fois, jamais de
// force. L'état (Sync, contrat section 10) est diffusé à l'interface.
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { executer } from "./commandes.mjs";
import { isoZurich, attendre } from "./outils.mjs";
import { contact } from "./client.mjs";

const MESSAGES = {
  hors_ligne: "Pas d'internet pour l'instant : tes textes se remettront à jour tout seuls.",
  conflit: `Une modification faite ailleurs ne se raccorde pas à celle de ton Mac. Rien n'est perdu : préviens ${contact()}.`,
  absent: `Tes textes ne sont pas encore installés sur ce Mac. Préviens ${contact()}.`,
};

function horsLigne(texte) {
  return /could not resolve|unable to access|could not read from remote|network|timed out|connection|no route|ssl|proxy/i.test(texte);
}

export class Synchro extends EventEmitter {
  constructor({ depot, journal = () => {}, env = process.env, pauseRejeuMs = 2000 }) {
    super();
    this.depot = depot;
    this.journal = journal;
    this.env = { ...env, GIT_TERMINAL_PROMPT: "0", GIT_EDITOR: "true" };
    this.pauseRejeuMs = pauseRejeuMs;
    this.etat = { derniere: null, etat: "ok" };
    this.enCours = null;
    this.minuterie = null;
  }

  git(args, delaiMs = 60000) {
    return executer("git", args, { cwd: this.depot, env: this.env, delaiMs });
  }

  poser(etat, message) {
    this.etat = { derniere: etat === "en_cours" ? this.etat.derniere : isoZurich(), etat };
    if (message) this.etat.message = message;
    this.emit("sync", this.etat);
  }

  rebaseEnCours() {
    const g = path.join(this.depot, ".git");
    return fs.existsSync(path.join(g, "rebase-merge")) || fs.existsSync(path.join(g, "rebase-apply"));
  }

  async aUnAmont() {
    const r = await this.git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
    return r.code === 0;
  }

  // Une seule synchro à la fois : les appels simultanés attendent la même.
  tirer() {
    if (!this.enCours) {
      this.enCours = this._tirer().finally(() => { this.enCours = null; });
    }
    return this.enCours;
  }

  async _tirer() {
    if (!fs.existsSync(path.join(this.depot, ".git"))) {
      this.poser("hors_ligne", MESSAGES.absent);
      return this.etat;
    }
    if (!(await this.aUnAmont())) {
      this.poser("ok");
      return this.etat;
    }
    this.poser("en_cours");
    for (let essai = 1; essai <= 2; essai++) {
      const r = await this.git(["-c", "rebase.autoStash=true", "pull", "--rebase", "--quiet"]);
      if (r.code === 0) {
        this.poser("ok");
        this.journal("synchro", { essai });
        return this.etat;
      }
      const texte = `${r.erreurs}\n${r.sortie}`;
      if (this.rebaseEnCours()) await this.git(["rebase", "--abort"]);
      if (horsLigne(texte)) {
        this.poser("hors_ligne", MESSAGES.hors_ligne);
        this.journal("synchro_hors_ligne", {});
        return this.etat;
      }
      this.journal("synchro_conflit", { essai });
      if (essai === 1) await attendre(this.pauseRejeuMs);
    }
    this.poser("conflit", MESSAGES.conflit);
    return this.etat;
  }

  // Tire, puis envoie les enregistrements de DEPOT pas encore en ligne (un push resté hors ligne).
  // Appelé avant ce qui tourne dans la copie des scripts du Mac (mise en page, publication) : ces
  // scripts s'alignent sur le dépôt en ligne, ils ne voient que ce qui y est (contrat, section 12).
  async pousser() {
    await this.tirer();
    if (this.etat.etat !== "ok" || !(await this.aUnAmont())) return this.etat;
    const avance = await this.git(["rev-list", "--count", "@{u}..HEAD"]);
    if (avance.code !== 0 || Number(avance.sortie.trim()) === 0) return this.etat;
    if (!(await this.envoyer())) this.journal("envoi_impossible", {});
    return this.etat;
  }

  async envoyer() {
    for (let essai = 1; essai <= 2; essai++) {
      const p = await this.git(["push", "-q", "origin", "HEAD:main"]);
      if (p.code === 0) return true;
      await this.tirer();
      if (this.etat.etat !== "ok") return false;
    }
    return false;
  }

  // Enregistre et pousse un seul fichier écrit par le studio (bibliothèque). Rejoue une fois.
  async pousserFichier(relatif, message) {
    if (!fs.existsSync(path.join(this.depot, ".git"))) return false;
    await this.git(["add", "--", relatif]);
    const diff = await this.git(["diff", "--cached", "--quiet", "--", relatif]);
    if (diff.code === 0) return true;
    const c = await this.git(["commit", "-q", "-m", message, "--", relatif]);
    if (c.code !== 0) return false;
    if (!(await this.aUnAmont())) return true;
    return this.envoyer();
  }

  demarrer(minutes) {
    this.arreter();
    if (minutes > 0) {
      this.minuterie = setInterval(() => this.tirer(), minutes * 60000);
      this.minuterie.unref?.();
    }
    return this.tirer();
  }

  arreter() {
    if (this.minuterie) clearInterval(this.minuterie);
    this.minuterie = null;
  }
}
