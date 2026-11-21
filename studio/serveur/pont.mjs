// Le pont vers `claude` (contrat, section 9). Un processus par tour de chat : on écrit le message
// sur l'entrée stream-json, on garde l'entrée ouverte tant qu'un tour attend sa fin (un message
// envoyé pendant un tour part sur la même entrée), puis on la ferme : le processus se termine.
// Le tour suivant reprend la conversation par --resume. Chaque processus est lancé dans son
// propre groupe (detached) et tué par groupe.
//
// Lot 12 : jamais deux processus sur un même chat (un message arrivé pendant qu'un processus finit, ou fait un
// rendu en arrière-plan, attend sa fin) ; une erreur passagère de Claude est réessayée avant d'être dite ; une
// conversation effacée par Claude repart sur une conversation neuve sans erreur visible.
import { spawn, execFileSync } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { isoZurich, lireJson, ecrireJson } from "./outils.mjs";
import { reglagesChat, environnement, typeDeChat } from "./reglages.mjs";
import { Normaliseur, classerErreur, phraseErreur } from "./normalisation.mjs";
import { contact } from "./client.mjs";

const DELAI_KILL_MS = 3000;
// Erreurs passagères (Claude surchargé, coupure réseau) : réessayées après ces délais, puis dites.
const DELAIS_REESSAI_MS = [15000, 45000];
const PASSAGERES = new Set(["surcharge", "reseau"]);
const PERDUE = /No conversation found/i;

// Ce que reçoit le modèle quand le studio réessaie un tour coupé, ou repart d'une conversation neuve.
const LIGNE_REESSAI = "[Message du studio : ta réponse précédente a été coupée par une erreur passagère de Claude. "
  + "Reprends exactement où tu en étais, sans en parler.]";
const RAPPEL_NEUVE = "[Message du studio : la conversation précédente de ce chat n'existe plus. Tu repars d'une conversation "
  + "neuve : relis d'abord les fichiers utiles (le contenu, son brief, son script, ce qui est déjà fait), sans en parler.]\n\n";

const ligneUtilisateur = (contenu) => JSON.stringify({ type: "user", message: { role: "user", content: contenu } }) + "\n";

function prefixer(ligne, texte) {
  const evt = JSON.parse(ligne);
  const c = evt.message.content;
  evt.message.content = typeof c === "string" ? texte + c : [{ type: "text", text: texte }, ...(Array.isArray(c) ? c : [])];
  return JSON.stringify(evt) + "\n";
}

// Les consignes d'une conversation (fichier de l'agent et consigne du studio) sont figées à son
// ouverture : une conversation reprise par --resume garde les anciennes, même passées en ligne de
// commande. Quand elles ont changé depuis, on les joint au message suivant pour qu'elles s'appliquent
// tout de suite (vu le 2026-11-19 : le monteur refusait encore un réglage que la nouvelle règle permet).
export function consignesActuelles(r, envBase = process.env) {
  let nom = r.agent;
  if (!nom) nom = lireJson(path.join(r.cwd, ".claude", "settings.json"), {})?.agent || null;
  let agent = "";
  if (nom) {
    const config = r.env?.CLAUDE_CONFIG_DIR || envBase.CLAUDE_CONFIG_DIR
      || path.join(envBase.HOME || "", ".claude");
    for (const d of [path.join(r.cwd, ".claude", "agents"), path.join(config, "agents")]) {
      const f = path.join(d, `${nom}.md`);
      if (fs.existsSync(f)) {
        agent = fs.readFileSync(f, "utf8").replace(/^---\n[\s\S]*?\n---\n/, "").trim();
        break;
      }
    }
  }
  const i = r.args.indexOf("--append-system-prompt");
  const studio = i >= 0 ? r.args[i + 1] : "";
  const empreinte = crypto.createHash("sha256").update(agent + "\0" + studio).digest("hex").slice(0, 16);
  return { empreinte, agent, studio };
}

function joindreConsignes(ligne, c) {
  const bloc = [
    "[Tes consignes ont été mises à jour depuis le début de cette conversation. Voici la version à jour :",
    "elle remplace entièrement celle que tu avais au départ, y compris pour ce que tu as répondu plus haut",
    "dans cette conversation. Applique-la dès ce message, sans en parler sauf si on te le demande.]",
    "",
    c.agent ? `<consignes>\n${c.agent}\n</consignes>` : "",
    c.studio ? `<consignes-du-studio>\n${c.studio}\n</consignes-du-studio>` : "",
    "",
    "[Le message :]",
    "",
  ].filter((x, k, t) => x || t[k - 1] !== "").join("\n");
  const evt = JSON.parse(ligne);
  const contenu = evt.message.content;
  evt.message.content = typeof contenu === "string"
    ? bloc + contenu
    : [{ type: "text", text: bloc }, ...(Array.isArray(contenu) ? contenu : [])];
  return JSON.stringify(evt) + "\n";
}

export class Pont extends EventEmitter {
  // envConfig : l'environnement du studio (HOME, CLAUDE_CONFIG_DIR) pour retrouver les conversations de Claude ;
  // envBase reste lu à chaque lancement (les tests le changent en cours de route).
  constructor({ config, journal = () => {}, envBase = process.env, envConfig = null, delaisReessai = DELAIS_REESSAI_MS }) {
    super();
    this.config = config;
    this.journal = journal;
    this.envBase = envBase;
    this.envConfig = envConfig;
    this.delaisReessai = delaisReessai;
    this.dossierChats = path.join(config.home, "chats");
    this.fichierSessions = path.join(config.home, "sessions.json");
    this.fichierProcessus = path.join(config.home, "processus.json");
    this.processus = new Map(); // chat_id -> tour en cours { enfant, enAttente, arret, normaliseur, parFile, ... }
    this.vivants = new Map();   // chat_id -> processus lancé et pas encore terminé (même après la fin du tour)
    this.differes = new Map();  // chat_id -> { lignes, opts, minuterie } : messages qui attendent (fin du processus, réessai)
    this.compteurs = new Map(); // chat_id -> dernier n
    this.etats = new Map();     // chat_id -> dernier état
    // Décide l'état de fin de tour ("fini" ou "a_toi"), branché par la file.
    this.resoudreFin = () => "a_toi";
    fs.mkdirSync(this.dossierChats, { recursive: true });
    this.nettoyerOrphelins();
    this.marquerCoupes();
  }

  // ------------------------------------------------------------ après un arrêt brutal

  // Sessions d'un serveur tombé (plantage, disque plein) : leurs groupes tournent encore, détachés. On les arrête
  // avant d'en relancer une sur la même conversation. Un PID n'est visé que s'il fait encore tourner `claude`.
  nettoyerOrphelins() {
    const notes = lireJson(this.fichierProcessus, {}) || {};
    for (const [chatId, x] of Object.entries(notes)) {
      const pid = Number(x?.pid);
      if (!Number.isInteger(pid) || pid <= 1) continue;
      let commande = "";
      try { commande = execFileSync("ps", ["-o", "command=", "-p", String(pid)], { encoding: "utf8" }).trim(); } catch { continue; }
      if (!commande || !commande.includes(path.basename(String(x.binaire || this.config.claude.binaire)))) continue;
      try { process.kill(-pid, "SIGTERM"); } catch { try { process.kill(pid, "SIGTERM"); } catch { /* déjà fini */ } }
      const t = setTimeout(() => { try { process.kill(-pid, "SIGKILL"); } catch { /* déjà fini */ } }, DELAI_KILL_MS);
      t.unref?.();
      this.journal("session_orpheline_arretee", { chat_id: chatId, pid });
    }
    this.ecrireProcessus({});
  }

  ecrireProcessus(notes) {
    try { ecrireJson(this.fichierProcessus, notes); } catch (e) { this.journal("ecriture_impossible", { fichier: "processus.json", erreur: e.code || String(e) }); }
  }

  noterProcessus(chatId, pid) {
    const notes = lireJson(this.fichierProcessus, {}) || {};
    if (pid) notes[chatId] = { pid, binaire: this.config.claude.binaire };
    else delete notes[chatId];
    this.ecrireProcessus(notes);
  }

  // Un tour coupé par l'arrêt du studio : le chat le dit (« Tu as arrêté » était faux), une seule fois.
  marquerCoupes() {
    let noms = [];
    try { noms = fs.readdirSync(this.dossierChats).filter((f) => f.endsWith(".jsonl")); } catch { return; }
    for (const f of noms) {
      const chatId = f.slice(0, -6);
      if (!typeDeChat(chatId)) continue;
      const e = this.historique(chatId).filter((m) => m.type === "etat").at(-1);
      if (e?.etat === "en_cours") this.noter(chatId, { n: this.prochainN(chatId), le: isoZurich(), role: "studio", type: "etat", etat: "coupe" });
    }
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

  // Ajoute un message à l'historique et le diffuse. Une écriture impossible (disque plein) est journalisée : le
  // message part quand même à l'écran, et le serveur ne tombe pas.
  noter(chatId, message, { partiel = false } = {}) {
    if (!partiel) {
      try {
        fs.appendFileSync(this.fichierChat(chatId), JSON.stringify(message) + "\n");
      } catch (e) {
        this.journal("ecriture_impossible", { chat_id: chatId, erreur: e.code || String(e) });
      }
      if (message.type === "etat") this.etats.set(chatId, message.etat);
    }
    this.emit("chat", { chat_id: chatId, message, ...(partiel ? { partiel: true } : {}) });
  }

  etat(chatId) {
    if (this.processus.has(chatId) || this.differes.has(chatId)) return "en_cours";
    if (this.etats.has(chatId)) return this.etats.get(chatId);
    const h = this.historique(chatId).filter((m) => m.type === "etat");
    const e = h.length ? h[h.length - 1].etat : null;
    // Un tour coupé par un arrêt brutal du serveur ne peut plus être en cours.
    return e === "en_cours" ? "coupe" : e;
  }

  // Dernier message du chat (sa date), pour la remise à zéro du chat général après une pause.
  dernierMessage(chatId) {
    const h = this.historique(chatId);
    return h.length ? h[h.length - 1] : null;
  }

  // Le chat général repart sur une conversation neuve (bouton, ou retour après une pause) : l'ancien fil est
  // archivé à côté (jamais effacé), la session oubliée. Refusé pendant qu'il travaille.
  reinitialiser(chatId) {
    if (this.actif(chatId)) return false;
    const f = this.fichierChat(chatId);
    if (fs.existsSync(f)) {
      const archives = path.join(this.dossierChats, "archives");
      fs.mkdirSync(archives, { recursive: true });
      const nom = `${chatId}-${isoZurich().replace(/[:+]/g, "-").slice(0, 19)}.jsonl`;
      let dest = path.join(archives, nom);
      for (let k = 2; fs.existsSync(dest); k++) dest = path.join(archives, nom.replace(/\.jsonl$/, `-${k}.jsonl`));
      fs.renameSync(f, dest);
    }
    this.oublierSession(chatId);
    this.compteurs.delete(chatId);
    this.etats.delete(chatId);
    this.journal("chat_reinitialise", { chat_id: chatId });
    this.emit("reinitialise", { chat_id: chatId });
    return true;
  }

  // ------------------------------------------------------------ sessions (--resume)

  sessions() {
    return lireJson(this.fichierSessions, {}) || {};
  }

  noterSession(chatId, infos) {
    const s = this.sessions();
    s[chatId] = { ...s[chatId], ...infos, maj: isoZurich() };
    try { ecrireJson(this.fichierSessions, s); } catch (e) { this.journal("ecriture_impossible", { fichier: "sessions.json", erreur: e.code || String(e) }); }
  }

  oublierSession(chatId) {
    const s = this.sessions();
    if (!(chatId in s)) return;
    delete s[chatId];
    try { ecrireJson(this.fichierSessions, s); } catch { /* la vérification au prochain lancement la rattrapera */ }
  }

  // La conversation notée existe-t-elle encore chez Claude ? Il efface les conversations inactives (30 jours par
  // défaut) : son fichier disparaît de <config Claude>/projects/<dossier>/<id>.jsonl. Sans dossier projects (pas
  // encore de conversation sur ce Mac, ou tests), on ne peut rien en dire : on la tient pour vivante.
  conversationExiste(sessionId, env = {}) {
    const base = this.envConfig || this.envBase;
    const config = env.CLAUDE_CONFIG_DIR || base.CLAUDE_CONFIG_DIR || path.join(base.HOME || "", ".claude");
    const projets = path.join(config, "projects");
    let dossiers;
    try { dossiers = fs.readdirSync(projets); } catch { return true; }
    return dossiers.some((d) => fs.existsSync(path.join(projets, d, `${sessionId}.jsonl`)));
  }

  // Une session reprenable pour ce chat (même dossier, conversation encore là). Oublie une session perdue.
  sessionVivante(chatId, r = null) {
    const session = this.sessions()[chatId];
    if (!session?.session_id) return false;
    try { r = r || reglagesChat(chatId, this.config); } catch { return false; }
    if (path.resolve(session.cwd || "") !== path.resolve(r.cwd)) return false;
    if (this.conversationExiste(session.session_id, r.env)) return true;
    this.journal("conversation_perdue", { chat_id: chatId });
    this.oublierSession(chatId);
    return false;
  }

  aUneSession(chatId) {
    return this.sessionVivante(chatId);
  }

  // Les chats qui travaillent : tour en cours, message en attente, ou suite après la fin du tour (rendu en
  // arrière-plan). Un processus qui sort juste après son tour n'en fait pas partie (mais reste « actif »).
  actives() {
    const suites = [...this.vivants].filter(([, p]) => p.suite).map(([c]) => c);
    return [...new Set([...this.processus.keys(), ...this.differes.keys(), ...suites])];
  }

  // Un chat est occupé tant qu'un processus tourne pour lui (même après la fin de son tour, par exemple pendant un
  // rendu en arrière-plan) ou qu'un message y attend son lancement.
  actif(chatId) {
    return this.processus.has(chatId) || this.vivants.has(chatId) || this.differes.has(chatId);
  }

  // ------------------------------------------------------------ envoyer

  // texte : ce que voit Romain (noté dans l'historique si `romain`) ; envoi : ce qui part au modèle.
  envoyer(chatId, { texte, envoi, romain = true, parFile = false, besoin = {} }) {
    if (!typeDeChat(chatId)) throw new Error(`chat inconnu : ${chatId}`);
    const le = isoZurich();
    if (romain && texte) {
      this.noter(chatId, { n: this.prochainN(chatId), le, role: "romain", type: "texte", texte });
    }
    const ligne = ligneUtilisateur(envoi ?? texte);
    const p = this.processus.get(chatId);
    if (p && !p.entreeFermee) {
      p.enAttente += 1;
      p.lignes.push(ligne);
      p.enfant.stdin.write(ligne);
      if (parFile) p.parFile = true;
      return { nouveau: false };
    }
    const d = this.differes.get(chatId);
    if (d) {
      d.lignes.push(ligne);
      if (parFile) d.opts.parFile = true;
      return { nouveau: false, attend: true };
    }
    if (this.vivants.has(chatId)) {
      // Le processus d'avant n'est pas fini (il sort, ou il rend une vidéo en arrière-plan) : le message part
      // quand il a fini, sur la même conversation. Jamais deux processus sur un même chat.
      this.differes.set(chatId, { lignes: [ligne], opts: { parFile, besoin, sansEtat: true }, minuterie: null });
      this.noter(chatId, { n: this.prochainN(chatId), le, role: "studio", type: "etat", etat: "en_cours" });
      this.journal("message_differe", { chat_id: chatId });
      this.emit("actives", this.actives());
      return { nouveau: false, attend: true };
    }
    this.lancer(chatId, [ligne], { parFile, besoin });
    return { nouveau: true };
  }

  lancerDifferes(chatId) {
    const d = this.differes.get(chatId);
    if (!d || this.vivants.has(chatId)) return;
    this.differes.delete(chatId);
    if (d.minuterie) clearTimeout(d.minuterie);
    this.lancer(chatId, d.lignes, d.opts);
  }

  lancer(chatId, lignes, { parFile = false, besoin = {}, essais = 0, sansEtat = false, neuve = false } = {}) {
    const opts = { parFile, besoin, essais, sansEtat, neuve };
    const r = reglagesChat(chatId, this.config, { besoin });
    const args = [...r.args];
    const consignes = consignesActuelles(r, this.envBase);
    const avaitSession = Boolean(this.sessions()[chatId]?.session_id);
    lignes = [...lignes];
    if (r.sansReprise) {
      // Une session d'un seul tour (description d'un fichier de la Galerie) : jamais reprise, le message est complet.
    } else if (!neuve && this.sessionVivante(chatId, r)) {
      args.push("--resume", this.sessions()[chatId].session_id);
      if (this.sessions()[chatId].consignes !== consignes.empreinte) {
        lignes[0] = joindreConsignes(lignes[0], consignes);
        this.journal("consignes_jointes", { chat_id: chatId });
      }
    } else if (avaitSession || neuve) {
      // La conversation de ce chat a disparu : on repart d'une neuve, le dossier du contenu porte le contexte.
      this.oublierSession(chatId);
      lignes[0] = prefixer(lignes[0], RAPPEL_NEUVE);
      this.journal("conversation_neuve", { chat_id: chatId });
    }
    if (!sansEtat) {
      this.noter(chatId, { n: this.prochainN(chatId), le: isoZurich(), role: "studio", type: "etat", etat: "en_cours" });
    }
    if (!fs.existsSync(r.cwd)) {
      this.finir(chatId, null, "Le dossier de ce contenu n'existe pas encore sur ton Mac.", undefined, { parFile });
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
      this.finir(chatId, null, `Je n'arrive pas à démarrer l'assistant sur ce Mac. Préviens ${contact()}.`, undefined, { parFile });
      this.journal("lancement_impossible", { chat_id: chatId, erreur: e.code || String(e) });
      return;
    }
    const p = {
      enfant, enAttente: lignes.length, arret: false, parFile, entreeFermee: false, fini: false, ferme: false,
      normaliseur: new Normaliseur(() => this.prochainN(chatId)), stderr: "", cwd: r.cwd, agent: r.agent,
      consignes: consignes.empreinte, lignes: [...lignes], opts,
    };
    this.processus.set(chatId, p);
    this.vivants.set(chatId, p);
    this.noterProcessus(chatId, enfant.pid);
    this.journal("session_lancee", { chat_id: chatId, pid: enfant.pid, reprise: args.includes("--resume"), essai: essais || undefined });
    this.emit("actives", this.actives());

    enfant.on("error", (e) => {
      this.journal("session_erreur", { chat_id: chatId, erreur: e.code || String(e) });
      this.finir(chatId, p, `Je n'arrive pas à démarrer l'assistant sur ce Mac. Préviens ${contact()}.`);
    });
    enfant.stdin.on("error", () => {});
    for (const l of lignes) enfant.stdin.write(l);

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
        try { this.traiter(chatId, p, evt); } catch (e) { this.journal("evenement_ignore", { chat_id: chatId, erreur: String(e?.message || e) }); }
      }
    });
    enfant.stderr.setEncoding("utf8");
    enfant.stderr.on("data", (m) => { p.stderr = (p.stderr + m).slice(-2000); });
    enfant.on("close", (code, signal) => {
      p.ferme = true;
      // Sorti sans résultat de fin : le dernier texte reçu n'est jamais perdu.
      for (const el of p.normaliseur.vider()) {
        try { this.noter(chatId, { n: el.n, le: isoZurich(), role: "studio", type: "texte", texte: el.texte }); } catch { /* rien */ }
      }
      if (p.minuterieKill) clearTimeout(p.minuterieKill);
      if (this.vivants.get(chatId) === p) this.vivants.delete(chatId);
      this.noterProcessus(chatId, null);
      this.journal("session_terminee", { chat_id: chatId, pid: enfant.pid, code, signal, stderr: p.stderr.slice(-300) || undefined });
      if (p.suite) this.finirSuite(chatId, p, null, p.arret ? "arrete" : undefined);
      if (p.reessai && p.arret) {
        this.finir(chatId, p, null, "arrete");
      } else if (p.reessai) {
        this.reessayer(chatId, p);
      } else if (!p.fini) {
        if (p.arret) this.finir(chatId, p, null, "arrete");
        else if (p.enAttente > 0) this.coupure(chatId, p);
        else this.finir(chatId, p, null, null);
      }
      // Un message arrivé pendant que ce processus finissait part maintenant.
      if (this.differes.get(chatId) && !this.differes.get(chatId).minuterie) this.lancerDifferes(chatId);
      this.emit("actives", this.actives());
      // Le chat est libre : une action de la file qui l'attendait peut partir.
      if (!this.actif(chatId)) this.emit("libre", { chat_id: chatId });
    });
  }

  // Le processus est sorti sans résultat de fin : conversation effacée, coupure réseau, ou plantage.
  coupure(chatId, p) {
    if (PERDUE.test(p.stderr) && !p.opts.neuve) {
      this.journal("conversation_perdue", { chat_id: chatId, par: "claude" });
      this.oublierSession(chatId);
      if (this.processus.get(chatId) === p) this.processus.delete(chatId);
      p.fini = true;
      this.lancer(chatId, p.lignes, { ...p.opts, sansEtat: true, neuve: true });
      return;
    }
    const c = classerErreur(p.stderr);
    if (PASSAGERES.has(c.motif) && p.opts.essais < this.delaisReessai.length) {
      this.reessayer(chatId, p);
      return;
    }
    const erreur = c.motif === "autre"
      ? `La conversation s'est coupée d'un coup. Réessaie, et si ça recommence, préviens ${contact()}.`
      : phraseErreur(c, { parFile: p.parFile });
    this.finir(chatId, p, erreur, undefined, { motif: c.motif, reprise: c.reprise });
  }

  // Réessai d'un tour coupé par une erreur passagère, après un délai. Le chat reste « en cours » pendant l'attente ;
  // un message envoyé entre-temps part avec le réessai.
  reessayer(chatId, p) {
    p.fini = true;
    if (this.processus.get(chatId) === p) this.processus.delete(chatId);
    const essais = p.opts.essais + 1;
    const delai = this.delaisReessai[essais - 1] ?? this.delaisReessai.at(-1) ?? 15000;
    const reprendre = this.sessionVivante(chatId) ? [ligneUtilisateur(LIGNE_REESSAI)] : p.lignes;
    const avant = this.differes.get(chatId);
    const d = { lignes: [...reprendre, ...(avant?.lignes || [])], opts: { ...p.opts, parFile: p.parFile, essais, sansEtat: true, neuve: false }, minuterie: null };
    if (avant?.minuterie) clearTimeout(avant.minuterie);
    d.minuterie = setTimeout(() => { d.minuterie = null; this.lancerDifferes(chatId); }, delai);
    d.minuterie.unref?.();
    this.differes.set(chatId, d);
    this.journal("tour_reessaye", { chat_id: chatId, essai: essais, delai_ms: delai });
    this.emit("actives", this.actives());
  }

  traiter(chatId, p, evt) {
    for (const el of p.normaliseur.traiter(evt)) {
      // Tour déjà rendu, mais le processus reparle : un travail lancé en arrière-plan (un rendu long)
      // a fini et l'agent continue. Le chat repasse « en cours », puis reçoit son état de fin à la fin
      // de cette suite (vu le 2026-11-19 : sans ça, le chat restait « en train de travailler »).
      if (p.fini && !p.suite && !p.reessai && (el.genre === "texte" || el.genre === "activite")) {
        p.suite = true;
        if (!this.differes.has(chatId)) this.noter(chatId, { n: this.prochainN(chatId), le: isoZurich(), role: "studio", type: "etat", etat: "en_cours" });
        this.journal("suite_apres_fin", { chat_id: chatId });
      }
      if (p.suite && el.genre === "fin") {
        this.finirSuite(chatId, p, el.erreur, undefined, el);
        continue;
      }
      if (el.genre === "session") {
        this.noterSession(chatId, { session_id: el.session_id, cwd: p.cwd, agent: p.agent || null, consignes: p.consignes });
      } else if (el.genre === "texte") {
        const m = { n: el.n, le: isoZurich(), role: "studio", type: "texte", texte: el.texte };
        this.noter(chatId, m, { partiel: el.partiel });
      } else if (el.genre === "activite") {
        // Un texte intermédiaire (déjà affiché en partiel) devient une ligne d'activité sous le même numéro.
        this.noter(chatId, { n: el.remplace ? el.n : this.prochainN(chatId), le: isoZurich(), role: "studio", type: "activite", texte: el.texte });
      } else if (el.genre === "fin") {
        p.enAttente = Math.max(0, p.enAttente - 1);
        if (el.erreur) this.journal("tour_en_erreur", { chat_id: chatId, motif: el.motif, limite: el.limite });
        if (p.enAttente === 0) {
          // Tour fini : on ferme l'entrée, le processus se termine de lui-même.
          p.entreeFermee = true;
          try { p.enfant.stdin.end(); } catch { /* déjà fermée */ }
          if (PASSAGERES.has(el.motif) && !p.arret && p.opts.essais < this.delaisReessai.length) {
            // Erreur passagère : réessayée quand ce processus est sorti, rien n'est dit tout de suite.
            p.reessai = true;
            continue;
          }
          // La phrase dépend de qui a lancé le tour : un travail de la file repart tout seul, un message se redemande.
          const erreur = el.motif ? phraseErreur(el, { parFile: p.parFile }) : el.erreur;
          this.finir(chatId, p, erreur, undefined, { motif: el.motif, reprise: el.reprise });
        }
      }
    }
  }

  // Fin d'une suite après la fin du tour : pas de file à prévenir (l'action est déjà close), seulement
  // l'état du chat. Si une nouvelle conversation a pris le relais entre-temps, elle garde la main.
  finirSuite(chatId, p, erreur, etatForce, infos = {}) {
    if (!p.suite) return;
    p.suite = false;
    if (this.processus.has(chatId) || this.differes.has(chatId)) return;
    const etat = etatForce || (erreur ? "erreur" : "a_toi");
    const m = { n: this.prochainN(chatId), le: isoZurich(), role: "studio", type: "etat", etat };
    if (erreur) m.texte = erreur;
    if (erreur && infos.motif) m.motif = infos.motif;
    this.noter(chatId, m);
  }

  // Termine un tour : écrit l'état final et prévient la file. La décision « fini » ou « à toi »
  // peut demander un instant (synchro) : le chat reste marqué occupé jusque-là.
  async finir(chatId, p, erreur, etatForce, { motif = null, reprise = null, parFile = false } = {}) {
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
    if (etat && !this.differes.has(chatId)) {
      const m = { n: this.prochainN(chatId), le: isoZurich(), role: "studio", type: "etat", etat };
      if (erreur) m.texte = erreur;
      if (erreur && motif) m.motif = motif;
      if (erreur && reprise) m.reprise = new Date(reprise).toISOString();
      this.noter(chatId, m);
    }
    this.emit("fin", { chat_id: chatId, etat, erreur: erreur || null, parFile: Boolean(p?.parFile || parFile), motif: erreur ? motif : null, reprise: erreur ? reprise : null });
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

  // Arrête tout ce qui tourne pour ce chat : le tour en cours, un processus qui continue après la fin de son tour
  // (rendu en arrière-plan), un message en attente ou un réessai prévu. Rend faux s'il n'y avait rien.
  arreter(chatId) {
    let fait = false;
    const d = this.differes.get(chatId);
    if (d) {
      if (d.minuterie) clearTimeout(d.minuterie);
      this.differes.delete(chatId);
      fait = true;
    }
    const p = this.processus.get(chatId) || this.vivants.get(chatId);
    if (p && !p.ferme) {
      p.arret = true;
      this.tuerGroupe(p, "SIGTERM");
      if (p.minuterieKill) clearTimeout(p.minuterieKill);
      p.minuterieKill = setTimeout(() => this.tuerGroupe(p, "SIGKILL"), DELAI_KILL_MS);
      p.minuterieKill.unref?.();
      this.journal("session_arretee", { chat_id: chatId, pid: p.enfant.pid });
      fait = true;
    }
    // Rien en cours de tour : c'est ici qu'on écrit l'arrêt (sinon la fin du processus s'en charge).
    if (d && !this.processus.has(chatId) && !p?.suite) {
      this.finir(chatId, null, null, "arrete", { parFile: d.opts?.parFile });
    }
    if (fait) this.emit("actives", this.actives());
    return fait;
  }

  // Arrête tout et attend la fin de chaque processus (par son PID, jamais par motif).
  async toutArreter() {
    const attentes = [];
    for (const chatId of this.actives()) {
      const p = this.vivants.get(chatId);
      if (p && !p.ferme) attentes.push(new Promise((r) => p.enfant.once("close", r)));
      this.arreter(chatId);
    }
    await Promise.race([Promise.all(attentes), new Promise((r) => setTimeout(r, DELAI_KILL_MS + 1500))]);
  }
}
