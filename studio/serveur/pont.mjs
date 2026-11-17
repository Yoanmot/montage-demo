// Le pont vers `claude` (contrat, section 9). Un processus par tour de chat : on écrit le message
// sur l'entrée stream-json, on garde l'entrée ouverte tant qu'un tour attend sa fin (un message
// envoyé pendant un tour part sur la même entrée), puis on la ferme : le processus se termine.
// Le tour suivant reprend la conversation par --resume. Chaque processus est lancé dans son
// propre groupe (detached) et tué par groupe.
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { isoZurich, lireJson, ecrireJson } from "./outils.mjs";
import { reglagesChat, environnement, typeDeChat } from "./reglages.mjs";
import { Normaliseur } from "./normalisation.mjs";

const DELAI_KILL_MS = 3000;

export class Pont extends EventEmitter {
  constructor({ config, journal = () => {}, envBase = process.env }) {
    super();
    this.config = config;
    this.journal = journal;
    this.envBase = envBase;
    this.dossierChats = path.join(config.home, "chats");
    this.fichierSessions = path.join(config.home, "sessions.json");
    this.processus = new Map(); // chat_id -> { enfant, enAttente, arret, normaliseur, parFile }
    this.compteurs = new Map(); // chat_id -> dernier n
    this.etats = new Map();     // chat_id -> dernier état
    // Décide l'état de fin de tour ("fini" ou "a_toi"), branché par la file.
    this.resoudreFin = () => "a_toi";
    fs.mkdirSync(this.dossierChats, { recursive: true });
  }

  // ------------------------------------------------------------ historique

  fichierChat(chatId) {
    return path.join(this.dossierChats, `${chatId}.jsonl`);
  }

  historique(chatId) {
    let texte = "";
    try {
      texte = fs.readFileSync(this.fichierChat(chatId), "utf8");
    } catch {
      return [];
    }
    const r = [];
    for (const l of texte.split("\n")) {
      if (!l.trim()) continue;
      try { r.push(JSON.parse(l)); } catch { /* ligne abîmée : ignorée */ }
    }
    return r;
  }

  prochainN(chatId) {
    if (!this.compteurs.has(chatId)) {
      const h = this.historique(chatId);
      this.compteurs.set(chatId, h.reduce((m, x) => Math.max(m, Number(x.n) || 0), 0));
    }
    const n = this.compteurs.get(chatId) + 1;
    this.compteurs.set(chatId, n);
    return n;
  }

  // Ajoute un message à l'historique et le diffuse.
  noter(chatId, message, { partiel = false } = {}) {
    if (!partiel) {
      fs.appendFileSync(this.fichierChat(chatId), JSON.stringify(message) + "\n");
      if (message.type === "etat") this.etats.set(chatId, message.etat);
    }
    this.emit("chat", { chat_id: chatId, message, ...(partiel ? { partiel: true } : {}) });
  }

  etat(chatId) {
    if (this.processus.has(chatId)) return "en_cours";
    if (this.etats.has(chatId)) return this.etats.get(chatId);
    const h = this.historique(chatId).filter((m) => m.type === "etat");
    const e = h.length ? h[h.length - 1].etat : null;
    // Un tour coupé par un arrêt brutal du serveur ne peut plus être en cours.
    return e === "en_cours" ? "arrete" : e;
  }

  // ------------------------------------------------------------ sessions (--resume)

  sessions() {
    return lireJson(this.fichierSessions, {}) || {};
  }

  noterSession(chatId, infos) {
    const s = this.sessions();
    s[chatId] = { ...s[chatId], ...infos, maj: isoZurich() };
    ecrireJson(this.fichierSessions, s);
  }

  actives() {
    return [...this.processus.keys()];
  }

  actif(chatId) {
    return this.processus.has(chatId);
  }

  // ------------------------------------------------------------ envoyer

  // texte : ce que voit Romain (noté dans l'historique si `romain`) ; envoi : ce qui part au modèle.
  envoyer(chatId, { texte, envoi, romain = true, parFile = false, besoin = {} }) {
    if (!typeDeChat(chatId)) throw new Error(`chat inconnu : ${chatId}`);
    const le = isoZurich();
    if (romain && texte) {
      this.noter(chatId, { n: this.prochainN(chatId), le, role: "romain", type: "texte", texte });
    }
    const contenu = envoi ?? texte;
    const ligne = JSON.stringify({ type: "user", message: { role: "user", content: contenu } }) + "\n";
    const p = this.processus.get(chatId);
    if (p && !p.entreeFermee) {
      p.enAttente += 1;
      p.enfant.stdin.write(ligne);
      if (parFile) p.parFile = true;
      return { nouveau: false };
    }
    this.lancer(chatId, ligne, { parFile, besoin });
    return { nouveau: true };
  }

  aUneSession(chatId) {
    return Boolean(this.sessions()[chatId]?.session_id);
  }

  lancer(chatId, ligne, { parFile, besoin }) {
    const r = reglagesChat(chatId, this.config, { besoin });
    const args = [...r.args];
    const session = this.sessions()[chatId];
    if (session?.session_id && path.resolve(session.cwd || "") === path.resolve(r.cwd)) {
      args.push("--resume", session.session_id);
    }
    const etat = { n: this.prochainN(chatId), le: isoZurich(), role: "studio", type: "etat", etat: "en_cours" };
    this.noter(chatId, etat);
    if (!fs.existsSync(r.cwd)) {
      this.finir(chatId, null, "Le dossier de ce contenu n'existe pas encore sur ton Mac.");
      return;
    }
    let enfant;
    try {
      enfant = spawn(this.config.claude.binaire, args, {
        cwd: r.cwd,
        env: environnement(this.envBase, r.env),
        detached: true,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (e) {
      this.finir(chatId, null, "Je n'arrive pas à démarrer l'assistant sur ce Mac. Préviens Yoan.");
      this.journal("lancement_impossible", { chat_id: chatId, erreur: e.code || String(e) });
      return;
    }
    const p = {
      enfant, enAttente: 1, arret: false, parFile, entreeFermee: false, fini: false,
      normaliseur: new Normaliseur(() => this.prochainN(chatId)), stderr: "", cwd: r.cwd, agent: r.agent,
    };
    this.processus.set(chatId, p);
    this.journal("session_lancee", { chat_id: chatId, pid: enfant.pid, reprise: args.includes("--resume") });
    this.emit("actives", this.actives());

    enfant.on("error", (e) => {
      this.journal("session_erreur", { chat_id: chatId, erreur: e.code || String(e) });
      this.finir(chatId, p, "Je n'arrive pas à démarrer l'assistant sur ce Mac. Préviens Yoan.");
    });
    enfant.stdin.on("error", () => {});
    enfant.stdin.write(ligne);

    let reste = "";
    enfant.stdout.setEncoding("utf8");
    enfant.stdout.on("data", (morceau) => {
      reste += morceau;
      let i;
      while ((i = reste.indexOf("\n")) >= 0) {
        const l = reste.slice(0, i).trim();
        reste = reste.slice(i + 1);
        if (!l) continue;
        let evt;
        try { evt = JSON.parse(l); } catch { continue; }
        this.traiter(chatId, p, evt);
      }
    });
    enfant.stderr.setEncoding("utf8");
    enfant.stderr.on("data", (m) => { p.stderr = (p.stderr + m).slice(-2000); });
    enfant.on("close", (code, signal) => {
      this.journal("session_terminee", { chat_id: chatId, pid: enfant.pid, code, signal, stderr: p.stderr.slice(-300) || undefined });
      if (!p.fini) {
        if (p.arret) this.finir(chatId, p, null, "arrete");
        else if (p.enAttente > 0) this.finir(chatId, p, "La conversation s'est coupée d'un coup. Réessaie, et si ça recommence, préviens Yoan.");
        else this.finir(chatId, p, null, null);
      }
    });
  }

  traiter(chatId, p, evt) {
    for (const el of p.normaliseur.traiter(evt)) {
      if (el.genre === "session") {
        this.noterSession(chatId, { session_id: el.session_id, cwd: p.cwd, agent: p.agent || null });
      } else if (el.genre === "texte") {
        const m = { n: el.n, le: isoZurich(), role: "studio", type: "texte", texte: el.texte };
        this.noter(chatId, m, { partiel: el.partiel });
      } else if (el.genre === "activite") {
        this.noter(chatId, { n: this.prochainN(chatId), le: isoZurich(), role: "studio", type: "activite", texte: el.texte });
      } else if (el.genre === "fin") {
        p.enAttente = Math.max(0, p.enAttente - 1);
        if (el.erreur) this.journal("tour_en_erreur", { chat_id: chatId, limite: el.limite });
        if (p.enAttente === 0) {
          // Tour fini : on ferme l'entrée, le processus se termine de lui-même.
          p.entreeFermee = true;
          try { p.enfant.stdin.end(); } catch { /* déjà fermée */ }
          this.finir(chatId, p, el.erreur);
        }
      }
    }
  }

  // Termine un tour : écrit l'état final et prévient la file. La décision « fini » ou « à toi »
  // peut demander un instant (synchro) : le chat reste marqué occupé jusque-là.
  async finir(chatId, p, erreur, etatForce) {
    if (p) {
      if (p.fini) return;
      p.fini = true;
      if (p.minuterie) clearTimeout(p.minuterie);
    }
    let etat = etatForce;
    if (etat === undefined) {
      try {
        etat = erreur ? "erreur" : await this.resoudreFin(chatId);
      } catch {
        etat = "a_toi";
      }
    }
    if (p && this.processus.get(chatId) === p) this.processus.delete(chatId);
    if (etat) {
      const m = { n: this.prochainN(chatId), le: isoZurich(), role: "studio", type: "etat", etat };
      if (erreur) m.texte = erreur;
      this.noter(chatId, m);
    }
    this.emit("fin", { chat_id: chatId, etat, erreur: erreur || null, parFile: Boolean(p?.parFile) });
    this.emit("actives", this.actives());
  }

  // ------------------------------------------------------------ arrêter

  tuerGroupe(p, signal) {
    try {
      process.kill(-p.enfant.pid, signal);
    } catch {
      try { p.enfant.kill(signal); } catch { /* déjà mort */ }
    }
  }

  arreter(chatId) {
    const p = this.processus.get(chatId);
    if (!p) return false;
    p.arret = true;
    this.tuerGroupe(p, "SIGTERM");
    p.minuterie = setTimeout(() => this.tuerGroupe(p, "SIGKILL"), DELAI_KILL_MS);
    p.minuterie.unref?.();
    this.journal("session_arretee", { chat_id: chatId, pid: p.enfant.pid });
    return true;
  }

  // Arrête tout et attend la fin de chaque processus (par son PID, jamais par motif).
  async toutArreter() {
    const attentes = [];
    for (const [chatId, p] of this.processus) {
      attentes.push(new Promise((r) => p.enfant.once("close", r)));
      this.arreter(chatId);
    }
    await Promise.race([Promise.all(attentes), new Promise((r) => setTimeout(r, DELAI_KILL_MS + 1500))]);
  }
}
