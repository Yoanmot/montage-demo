// Synchronisation du dépôt du head of content (git pull --rebase) : à l'ouverture, toutes les N
// minutes, avant chaque action. L'état (Sync, contrat section 10) est diffusé à l'interface.
//
// Lot 12 : un échec dit sa vraie cause (pas d'internet, délai dépassé, clé refusée, copie occupée,
// conflit), avec la fin du message de git au journal ; un vrai conflit (le téléphone et le Mac ont
// changé les mêmes lignes) se raccorde tout seul, sans rien jeter, avec les mêmes règles que les outils
// du dépôt (outils/commun.py, « raccorder ») :
//   - Markdown et texte : fusion ligne à ligne ; là où les deux côtés diffèrent, les deux versions
//     sont gardées l'une après l'autre (d'abord celle d'en ligne) ;
//   - JSON : fusion clé par clé (élément par élément pour une liste d'objets à « id ») ; une même valeur
//     changée des deux côtés garde celle d'en ligne, celle du Mac reste dans la sauvegarde ;
//   - supprimé d'un côté, modifié de l'autre : la version modifiée ; autre fichier : celle d'en ligne ;
//   - avant tout, la version locale entière est gardée dans une branche locale « sauvegarde/<date> ».
// Jamais de force : ni push --force, ni reset --hard.
import { execFile } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { executer } from "./commandes.mjs";
import { isoZurich, attendre } from "./outils.mjs";
import { contact } from "./client.mjs";

const VERROU_VIEUX_MS = 10 * 60 * 1000;

const MESSAGES = {
  hors_ligne: "Pas d'internet pour l'instant : tes textes se remettront à jour tout seuls.",
  delai: "La connexion est trop lente pour mettre tes textes à jour : je réessaie dans quelques minutes.",
  occupe: "Une mise à jour de tes textes est déjà en cours : je réessaie dans quelques minutes.",
  cle: `Ton Mac n'a plus l'autorisation d'envoyer tes textes en ligne. Tes changements restent sur ce Mac, rien n'est perdu. Préviens ${contact()} : ça se règle en deux minutes.`,
  conflit: `Une modification faite ailleurs ne se raccorde pas toute seule à celle de ton Mac. Rien n'est perdu, je réessaie à chaque mise à jour. Si ça dure, préviens ${contact()}.`,
  autre: `La mise à jour de tes textes n'a pas marché cette fois : je réessaie dans quelques minutes. Si ça dure, préviens ${contact()}.`,
  absent: `Tes textes ne sont pas encore installés sur ce Mac. Préviens ${contact()}.`,
};

// Cause -> état montré (Sync.etat). « souci » : quelque chose que le temps ne règle pas tout seul.
const ETATS = { hors_ligne: "hors_ligne", delai: "hors_ligne", occupe: "hors_ligne", cle: "souci", conflit: "conflit", autre: "souci" };

// La vraie cause d'un échec de git (même ordre que cause_git d'outils/commun.py).
export function causeGit(texte, { delai = false } = {}) {
  if (delai) return "delai";
  const t = String(texte || "").toLowerCase();
  if (/permission denied \(publickey|host key verification failed|authentication failed|could not read username|repository not found|access denied|returned error: 40[13]|invalid username or password/.test(t)) return "cle";
  if (/could not resolve|unable to access|network is unreachable|timed out|connection (refused|reset|closed)|no route to host|ssl|proxy|does not appear to be a git repository|could not read from remote|unexpected disconnect|early eof|the remote end hung up/.test(t)) return "hors_ligne";
  if (t.includes(".lock") && /unable to create|file exists|another git process/.test(t)) return "occupe";
  if (t.includes("conflict") || t.includes("could not apply")) return "conflit";
  return "autre";
}

// ------------------------------------------------------------------ fusion à trois d'un JSON

const ABSENT = Symbol("absent");
const egal = (a, b) => a === b || (a !== ABSENT && b !== ABSENT && JSON.stringify(a) === JSON.stringify(b));
const estObjet = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function fusionListe(b, o, l, ou, pertes) {
  const tous = [...(b || []), ...o, ...l];
  if (tous.every((x) => estObjet(x) && "id" in x)) {
    const cle = (x) => JSON.stringify(x.id);
    const carte = (v) => new Map((v || []).map((x) => [cle(x), x]));
    const [mb, mo, ml] = [carte(b), carte(o), carte(l)];
    const ordre = [...o.map(cle), ...l.map(cle).filter((k) => !mo.has(k))];
    const sortie = [];
    for (const k of ordre) {
      const v = fusionValeur(mb.has(k) ? mb.get(k) : ABSENT, mo.has(k) ? mo.get(k) : ABSENT, ml.has(k) ? ml.get(k) : ABSENT, `${ou}[${k}]`, pertes);
      if (v !== ABSENT) sortie.push(v);
    }
    return sortie;
  }
  const dans = (liste, x) => (liste || []).some((y) => egal(x, y));
  return [...o.filter((x) => !(dans(b, x) && !dans(l, x))), ...l.filter((x) => !dans(o, x) && !dans(b, x))];
}

// b = l'ancêtre commun, o = en ligne, l = ce Mac. ABSENT = la clé n'existe pas de ce côté.
export function fusionValeur(b, o, l, ou = "", pertes = []) {
  if (egal(o, l) || egal(l, b)) return o;
  if (egal(o, b)) return l;
  if (estObjet(o) && estObjet(l) && (b === ABSENT || estObjet(b))) {
    const bb = b === ABSENT ? {} : b;
    const sortie = {};
    for (const k of [...Object.keys(o), ...Object.keys(l).filter((k) => !(k in o))]) {
      const v = fusionValeur(k in bb ? bb[k] : ABSENT, k in o ? o[k] : ABSENT, k in l ? l[k] : ABSENT, `${ou}.${k}`, pertes);
      if (v !== ABSENT) sortie[k] = v;
    }
    return sortie;
  }
  if (Array.isArray(o) && Array.isArray(l) && (b === ABSENT || Array.isArray(b))) return fusionListe(b === ABSENT ? null : b, o, l, ou, pertes);
  if (o === ABSENT) return l;
  if (l === ABSENT) return o;
  pertes.push(ou || "(tout le fichier)");
  return o;
}

export class Synchro extends EventEmitter {
  constructor({ depot, journal = () => {}, env = process.env, pauseRejeuMs = 2000, delaiGitMs = 60000 }) {
    super();
    this.depot = depot;
    this.journal = journal;
    this.env = { ...env, GIT_TERMINAL_PROMPT: "0", GIT_EDITOR: "true", GIT_MERGE_AUTOEDIT: "no", LC_ALL: "C" };
    this.pauseRejeuMs = pauseRejeuMs;
    this.delaiGitMs = delaiGitMs;
    this.etat = { derniere: null, etat: "ok" };
    this.enCours = null;
    this.minuterie = null;
  }

  async git(args, delaiMs = this.delaiGitMs) {
    const debut = Date.now();
    const r = await executer("git", args, { cwd: this.depot, env: this.env, delaiMs });
    // Tué au délai (executer tue le groupe : code -1, sans sortie normale).
    r.delai = r.code === -1 && !r.introuvable && Date.now() - debut >= delaiMs - 50;
    return r;
  }

  poser(etat, message, cause) {
    this.etat = { derniere: etat === "en_cours" ? this.etat.derniere : isoZurich(), etat };
    if (message) this.etat.message = message;
    if (cause) this.etat.cause = cause;
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
      this.poser("hors_ligne", MESSAGES.absent, "absent");
      return this.etat;
    }
    if (!(await this.aUnAmont())) {
      this.poser("ok");
      return this.etat;
    }
    // Un autre git tient la copie (verrou) : un verrou mort est retiré, sinon on réessaiera plus tard.
    if (fs.existsSync(path.join(this.depot, ".git", "index.lock")) && !this.retirerVerrouMort()) {
      this.journal("synchro_impossible", { cause: "occupe", essai: 0, erreur: "index.lock présent" });
      this.poser(ETATS.occupe, MESSAGES.occupe, "occupe");
      return this.etat;
    }
    this.poser("en_cours");
    const avant = (await this.git(["rev-parse", "HEAD"])).sortie.trim();
    let cause = null;
    for (let essai = 1; essai <= 2; essai++) {
      const r = await this.git(["-c", "rebase.autoStash=true", "pull", "--rebase", "--quiet"]);
      const texte = `${r.erreurs}\n${r.sortie}`;
      if (r.code === 0) {
        // La remise en place d'une modification pas encore enregistrée peut entrer en conflit.
        if ((await this.enConflit()).length) {
          const d = await this.raccorder(null);
          this.journal(d.ok ? "synchro_raccord" : "synchro_raccord_impossible", d);
          if (!d.ok) { cause = "conflit"; break; }
        }
        this.poser("ok");
        this.journal("synchro", { essai });
        return this.etat;
      }
      if (!r.delai && this.rebaseEnCours() && (await this.enConflit()).length) {
        const sauvegarde = `sauvegarde/${isoZurich().slice(0, 19).replace(/[-:]/g, "").replace("T", "-")}`;
        if (avant) await this.git(["branch", "-f", sauvegarde, avant]);
        const d = await this.raccorder(sauvegarde);
        if (d.ok) {
          this.journal("synchro_raccord", d);
          await this.envoyerSansTirer();
          this.poser("ok");
          return this.etat;
        }
        this.journal("synchro_raccord_impossible", { ...d, erreur: texte.trim().slice(-300) });
        await this.git(["rebase", "--abort"]);
        cause = "conflit";
        break;
      }
      if (this.rebaseEnCours()) await this.git(["rebase", "--abort"]);
      cause = causeGit(texte, { delai: r.delai });
      this.journal("synchro_impossible", { cause, essai, erreur: texte.trim().slice(-300) });
      if (cause === "occupe" && essai === 1 && this.retirerVerrouMort()) continue;
      if (cause === "autre" && essai === 1) { await attendre(this.pauseRejeuMs); continue; }
      break;
    }
    this.poser(ETATS[cause] || "souci", MESSAGES[cause] || MESSAGES.autre, cause);
    return this.etat;
  }

  // Un index.lock laissé par un git tué (Mac éteint pendant un enregistrement) est retiré s'il est vieux.
  retirerVerrouMort() {
    const p = path.join(this.depot, ".git", "index.lock");
    try {
      if (Date.now() - fs.statSync(p).mtimeMs > VERROU_VIEUX_MS) {
        fs.rmSync(p);
        this.journal("synchro_verrou_retire", {});
        return true;
      }
    } catch { /* pas de verrou */ }
    return false;
  }

  async enConflit() {
    const r = await this.git(["diff", "--name-only", "--diff-filter=U", "-z"]);
    return r.sortie.split("\0").filter(Boolean);
  }

  async etage(n, f) {
    // Contenu brut d'un étage de l'index (1 ancêtre, 2 en ligne, 3 ce Mac), ou null s'il n'existe pas.
    return new Promise((resolve) => {
      execFile("git", ["show", `:${n}:${f}`], { cwd: this.depot, env: this.env, encoding: "buffer", maxBuffer: 64 * 1024 * 1024 },
        (e, out) => resolve(e ? null : out));
    });
  }

  async resoudre(f, pertes) {
    const [b, o, l] = await Promise.all([1, 2, 3].map((n) => this.etage(n, f)));
    const p = path.join(this.depot, f);
    if (!o && !l) { await this.git(["rm", "--quiet", "--cached", "--", f]); return "supprimé des deux côtés"; }
    const ecrire = (contenu) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, contenu); };
    if (!o || !l) {
      ecrire(o || l);
      await this.git(["add", "--", f]);
      return "supprimé d'un côté, modifié de l'autre : version modifiée gardée";
    }
    let contenu = null;
    let facon = "";
    if (f.endsWith(".json")) {
      try {
        const jb = b ? JSON.parse(b.toString("utf8")) : ABSENT;
        const avant = pertes.length;
        const v = fusionValeur(jb, JSON.parse(o.toString("utf8")), JSON.parse(l.toString("utf8")), f, pertes);
        contenu = Buffer.from(JSON.stringify(v, null, 2) + "\n");
        facon = "fusion clé par clé" + (pertes.length > avant ? ` (${pertes.length - avant} valeur(s) du Mac en sauvegarde)` : "");
      } catch { contenu = null; }
    }
    if (!contenu) {
      const texte = [b, o, l].every((x) => !x || !x.includes(0));
      if (texte && !f.endsWith(".json")) {
        const d = fs.mkdtempSync(path.join(os.tmpdir(), "raccord-"));
        try {
          const noms = [["en-ligne", o], ["ancetre", b || Buffer.alloc(0)], ["ce-mac", l]].map(([nom, x]) => {
            const q = path.join(d, nom);
            fs.writeFileSync(q, x);
            return q;
          });
          const r = await executer("git", ["merge-file", "-p", "--union", "-L", "en ligne", "-L", "ancêtre", "-L", "ce Mac", ...noms], { cwd: this.depot, env: this.env, delaiMs: 30000 });
          contenu = Buffer.from(r.sortie, "utf8");
          facon = "fusion ligne à ligne, les deux versions gardées là où elles diffèrent";
        } finally {
          fs.rmSync(d, { recursive: true, force: true });
        }
      } else {
        contenu = o;
        pertes.push(f);
        facon = "version en ligne gardée, celle du Mac en sauvegarde";
      }
    }
    ecrire(contenu);
    await this.git(["add", "--", f]);
    return facon;
  }

  // Termine le rebase arrêté sur conflit en raccordant chaque fichier, puis la remise en place des
  // modifications pas encore enregistrées. Rend { ok, fichiers, pertes, sauvegarde }.
  async raccorder(sauvegarde) {
    const fichiers = [];
    const pertes = [];
    for (let i = 0; i < 200 && this.rebaseEnCours(); i++) {
      for (const f of await this.enConflit()) fichiers.push({ fichier: f, facon: await this.resoudre(f, pertes) });
      const r = await this.git(["-c", "core.editor=true", "rebase", "--continue"]);
      if (r.code !== 0 && this.rebaseEnCours() && !(await this.enConflit()).length) {
        await this.git(["-c", "core.editor=true", "rebase", "--skip"]); // commit devenu vide
      }
    }
    if (this.rebaseEnCours()) return { ok: false, fichiers, pertes, sauvegarde };
    const reste = await this.enConflit();
    for (const f of reste) fichiers.push({ fichier: f, facon: `${await this.resoudre(f, pertes)} (modification pas encore enregistrée)` });
    if (reste.length) await this.git(["reset", "--quiet", "--", ...reste]);
    return { ok: true, fichiers, pertes, sauvegarde };
  }

  // Après un raccord : le résultat part en ligne tout de suite, pour que le téléphone le voie.
  async envoyerSansTirer() {
    const p = await this.git(["push", "-q", "origin", "HEAD:main"]);
    if (p.code !== 0) this.journal("envoi_impossible", { cause: causeGit(p.erreurs, { delai: p.delai }), erreur: p.erreurs.trim().slice(-300) });
    return p.code === 0;
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
      this.journal("envoi_refuse", { essai, cause: causeGit(p.erreurs, { delai: p.delai }), erreur: p.erreurs.trim().slice(-300) });
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
