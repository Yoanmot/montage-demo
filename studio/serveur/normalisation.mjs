// Traduit le flux stream-json de `claude` en messages du studio (contrat, section 10) :
// texte relayé au fil de l'eau, activité en une phrase humaine (jamais de chemin, jamais de nom
// d'outil, jamais le contenu d'une commande), fin de tour.
import { contact, clientActif } from "./client.mjs";

function bas(t) {
  return String(t || "").toLowerCase();
}

// Une phrase courte, en français, pour le client. Déduite de l'outil appelé et de son entrée, sans
// jamais recopier l'entrée.
export function phraseActivite(outil, entree = {}) {
  const fichier = bas(entree.file_path || entree.path || entree.notebook_path || "");
  const commande = bas(entree.command || "");
  switch (outil) {
    case "Read":
      if (fichier.endsWith("script.md")) return "je lis ton script";
      if (/\.(png|jpe?g|heic|webp)$/.test(fichier)) return "je regarde les images";
      if (/\.(mov|mp4|m4v)$/.test(fichier)) return "je regarde ta vidéo";
      if (fichier.includes("/veille/")) return "je regarde ce qui marche en ce moment";
      if (fichier.includes("/matiere/") || fichier.endsWith(`${clientActif().id}.md`)) return "je relis tes notes";
      if (fichier.includes("/skills/") || fichier.includes("/.claude/")) return "je relis ma méthode";
      return "je relis ce qu'on a déjà";
    case "Write":
    case "Edit":
    case "MultiEdit":
    case "NotebookEdit":
      if (fichier.endsWith("script.md")) return "j'écris ton script";
      if (fichier.includes("/propositions/")) return "je note les idées";
      if (fichier.includes("/tournages/")) return "je prépare ton plan de tournage";
      if (fichier.includes("/a-rendre/")) return "j'écris le texte du carrousel";
      if (fichier.includes("/site/")) return "je prépare ta ressource gratuite";
      return "j'enregistre";
    case "Glob":
    case "Grep":
      return "je cherche dans tes notes";
    case "WebFetch":
    case "WebSearch":
      return "je cherche en ligne";
    case "Task":
    case "Agent":
      return "je lance une partie du travail en parallèle";
    case "Skill": {
      const s = bas(entree.skill || entree.name || "");
      if (s.includes("reel-script")) return "je prépare l'écriture de ton script";
      if (s.includes("carrousel")) return "je prépare tes images";
      if (s.includes("tournage")) return "je prépare ton plan de tournage";
      if (s.includes("ressource")) return "je prépare ta ressource gratuite";
      if (s.includes("publier")) return "je prépare la publication";
      if (s.includes("bilan")) return "je regarde tes chiffres";
      return "je m'organise";
    }
    case "Bash": {
      if (/\bgit\s+(pull|fetch)\b/.test(commande)) return "je récupère la dernière version";
      if (/\bgit\s+(add|commit|push)\b/.test(commande)) return "j'enregistre";
      if (commande.includes("zernio")) return "je regarde ton Instagram";
      if (/idees\.py|etat\.py/.test(commande)) return "j'enregistre";
      if (/transcri|whisper/.test(commande)) return "j'écoute ce que tu dis";
      if (/sous-titres|captions/.test(commande)) return "je pose les sous-titres";
      if (/carrousel|slide/.test(commande)) return "je prépare tes images";
      if (/ffmpeg|ffprobe|pwsh|montage|rendu|render|zoom|b-roll|silence/.test(commande)) return "je travaille sur ta vidéo";
      return "je travaille";
    }
    case "TodoWrite":
    case "ToolSearch":
      return null;
    default:
      return "je travaille";
  }
}

// Ce que claude écrit lui-même (modèle « <synthetic> ») quand il n'est pas ou plus connecté au compte
// (lot 11), qu'une limite d'abonnement est atteinte ou que l'API répond en erreur (« API Error: 529 {...} ») :
// jamais montré tel quel (anglais, technique), remplacé par une phrase pour le client (lot 12).
const CONNEXION = /not logged in|run \/login|oauth token|token has expired|invalid api key|authentication_error|authentication failed|revoked|\b401\b/i;
const LIMITE = /you(?:'|’)ve hit your|you(?:'|’)ve reached your|usage limit|limit reached|session limit|weekly limit|out of (?:extra )?usage|usage credits|rate[_ ]limit|quota/i;
const RESEAU = /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENETUNREACH|EHOSTUNREACH|fetch failed|network|socket hang up|connection error|unable to connect|request timed out|timed out/i;
const SURCHARGE = /overloaded|\b(?:500|502|503|504|529)\b|internal server error|bad gateway|service unavailable|gateway timeout|api error/i;
export const PHRASE_CONNEXION = `Ton studio n'est plus connecté à ton compte Claude. Préviens ${contact()} : la reconnexion prend deux minutes.`;
export const PHRASE_SURCHARGE = "Claude est surchargé en ce moment, ce n'est pas ton studio. Réessaie dans quelques minutes.";
export const PHRASE_RESEAU = "Ton Mac n'a pas internet en ce moment. Réessaie quand la connexion est revenue.";
export const PHRASE_AUTRE = `Quelque chose a coincé de mon côté. Réessaie, et si ça recommence, préviens ${contact()}.`;

// Classe une erreur de Claude d'après son texte (résultat, message <synthetic>, sortie d'erreur) et son code HTTP.
// Rend { motif: "connexion" | "limite" | "reseau" | "surcharge" | "autre", reprise: ms | null }.
export function classerErreur(texte, statut = null, { maintenant = Date.now() } = {}) {
  const t = String(texte || "");
  const code = Number(statut) || null;
  if (code === 401 || CONNEXION.test(t)) return { motif: "connexion", reprise: null };
  if (code === 429 || LIMITE.test(t)) return { motif: "limite", reprise: heureDeReprise(t, maintenant) };
  if (RESEAU.test(t)) return { motif: "reseau", reprise: null };
  if ((code && code >= 500) || SURCHARGE.test(t)) return { motif: "surcharge", reprise: null };
  return { motif: "autre", reprise: null };
}

const MOIS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

// L'heure de reprise écrite par Claude : « resets 3pm », « resets 3:30 pm (Europe/Zurich) », « resets 15:00 »,
// « resets Nov 21, 3pm », « resets Nov 21 at 3pm », « resets in 2h 30m ». Heure du Mac (celle de Claude aussi).
export function heureDeReprise(texte, maintenant = Date.now()) {
  const t = String(texte || "");
  const dans = /resets?\s+in\s+((?:\d+\s*(?:d|h|hr|hrs|hours?|m|min|mins|minutes?)\s*)+)/i.exec(t);
  if (dans) {
    let ms = 0;
    for (const [, n, u] of dans[1].matchAll(/(\d+)\s*([a-z]+)/gi)) {
      const k = u[0].toLowerCase();
      ms += Number(n) * (k === "d" ? 86400e3 : k === "h" ? 3600e3 : 60e3);
    }
    return ms ? maintenant + ms : null;
  }
  const m = /resets?\s+(?:at\s+|on\s+)?(?:([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})(?:,|\s+at)?\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(t);
  if (!m) return null;
  let h = Number(m[3]);
  const min = Number(m[4] || 0);
  const ap = (m[5] || "").toLowerCase();
  if (!ap && !m[4]) return null; // « resets 3 » seul : trop flou
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  const d = new Date(maintenant);
  if (m[1] && m[2] && MOIS[m[1].toLowerCase()] !== undefined) {
    d.setMonth(MOIS[m[1].toLowerCase()], Number(m[2]));
    d.setHours(h, min, 0, 0);
    if (d.getTime() < maintenant - 86400e3) d.setFullYear(d.getFullYear() + 1);
    return d.getTime();
  }
  d.setHours(h, min, 0, 0);
  if (d.getTime() <= maintenant) d.setDate(d.getDate() + 1);
  return d.getTime();
}

// « vers 15 h », « demain vers 9 h 30 », « le 23 novembre vers 9 h » (heure de Zurich).
export function quandReprise(ms, maintenant = Date.now()) {
  if (!ms || !Number.isFinite(ms)) return null;
  const jour = (x) => new Intl.DateTimeFormat("fr-CH", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(x));
  const p = Object.fromEntries(new Intl.DateTimeFormat("fr-CH", { timeZone: "Europe/Zurich", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const heure = `${Number(p.hour)} h${p.minute !== "00" ? ` ${p.minute}` : ""}`;
  if (jour(ms) === jour(maintenant)) return `vers ${heure}`;
  if (jour(ms) === jour(maintenant + 86400e3)) return `demain vers ${heure}`;
  const date = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Zurich", day: "numeric", month: "long" }).format(new Date(ms));
  return `le ${date} vers ${heure}`;
}

// La phrase du chat pour une erreur classée. parFile : un travail lancé par un bouton (il repart tout seul).
export function phraseErreur({ motif, reprise = null } = {}, { parFile = false, maintenant = Date.now() } = {}) {
  if (motif === "connexion") return PHRASE_CONNEXION;
  if (motif === "limite") {
    const quand = quandReprise(reprise, maintenant) || "dans quelques heures";
    return `Tu as atteint la limite d'utilisation de ton abonnement Claude. Rien n'est cassé : ça repart tout seul ${quand}. `
      + (parFile ? "Ce travail reprendra tout seul à ce moment-là." : "Redemande-moi à ce moment-là.");
  }
  if (motif === "surcharge") return PHRASE_SURCHARGE;
  if (motif === "reseau") return PHRASE_RESEAU;
  return PHRASE_AUTRE;
}

// Lot 12 : un texte écrit entre deux appels d'outil (« Let me check a few. », « Je regarde tes posts. ») n'est
// pas une réponse. Seul le dernier texte du tour reste un message ; un texte intermédiaire devient une ligne
// d'activité : sa première phrase s'il est en français et court, sinon la phrase de l'outil qui suit. Une
// question posée au client (texte en français avec un « ? ») reste un message, même au milieu du tour.
const MOTS_FR = new Set("je tu il on nous vous le la les un une des de du et est sont pas ne que qui quoi pour avec dans sur ton ta tes mon ma mes ce cette ces ça c'est j'ai je vais puis aussi déjà encore voici voilà".split(" "));
const MOTS_EN = new Set("i i'll i'm let let's me the a an and is are was it this that these to of for with now will check look looking first then next see here there my your".split(" "));

export function enFrancais(texte) {
  const t = String(texte || "").toLowerCase();
  const mots = t.match(/[a-zàâäçéèêëîïôöùûüœ']+/g) || [];
  if (mots.length < 2) return false;
  let fr = 0, en = 0;
  for (const m of mots) {
    if (MOTS_FR.has(m)) fr++;
    if (MOTS_EN.has(m)) en++;
  }
  if (/[àâçéèêëîïôùûœ]/.test(t)) fr += 2;
  return fr > 0 && fr >= en;
}

// La ligne d'activité tirée d'un texte intermédiaire en français (première phrase, sans « : » final), ou null.
export function activiteDeTexte(texte) {
  const t = String(texte || "").replace(/\s+/g, " ").trim();
  if (!enFrancais(t)) return null;
  const phrase = (/^.*?[.!…](?=\s|$)/.exec(t)?.[0] || t).replace(/[\s:.…]+$/, "").trim();
  if (phrase.length < 8 || phrase.length > 140 || /[`/\\]|\.(?:md|json|py|mjs)\b/i.test(phrase)) return null;
  return phrase.charAt(0).toLowerCase() + phrase.slice(1);
}

export function questionAuClient(texte) {
  return enFrancais(texte) && /\?\s*(?:\*\*)?\s*$|\?\s/.test(String(texte || ""));
}

// Un normaliseur par processus `claude`. `allouer()` donne le numéro du prochain message du chat.
export class Normaliseur {
  constructor(allouer) {
    this.allouer = allouer;
    this.blocs = new Map();       // "<message>:<index>" -> { n, texte }
    this.avecPartiels = new Set(); // messages dont le texte est arrivé par morceaux
    this.derniereActivite = null;
    this.attente = null;          // dernier texte fini du tour : message si le tour s'arrête là, activité si un outil suit
  }

  // Le texte en attente devient un message (fin du tour, nouveau texte sans outil entre les deux, processus fini).
  libererTexte(sortie) {
    const a = this.attente;
    this.attente = null;
    if (a) sortie.push({ genre: "texte", n: a.n, texte: a.texte, partiel: false });
  }

  // Un outil suit le texte en attente : c'était un texte intermédiaire.
  texteIntermediaire(sortie, phraseOutil) {
    const a = this.attente;
    this.attente = null;
    if (!a) return false;
    if (questionAuClient(a.texte)) {
      sortie.push({ genre: "texte", n: a.n, texte: a.texte, partiel: false });
      return false;
    }
    const ligne = activiteDeTexte(a.texte) || phraseOutil || "je travaille";
    this.derniereActivite = phraseOutil || ligne;
    sortie.push({ genre: "activite", n: a.n, texte: ligne, remplace: true });
    return true;
  }

  // Processus sorti sans résultat de fin : ce qui reste en attente est rendu tel quel.
  vider() {
    const sortie = [];
    for (const b of this.blocs.values()) {
      if (b.texte.trim()) sortie.push({ genre: "texte", n: b.n, texte: b.texte, partiel: false });
    }
    this.blocs.clear();
    this.libererTexte(sortie);
    return sortie;
  }

  // Renvoie une liste d'éléments :
  //   { genre: "session", session_id }
  //   { genre: "texte", n, texte, partiel: bool }
  //   { genre: "activite", texte, n?, remplace? }  (n + remplace : un texte intermédiaire déjà montré en partiel,
  //                                                  qui devient une ligne d'activité sous le même numéro)
  //   { genre: "fin", erreur: string | null, limite: bool, motif?, reprise? }  (motif : voir classerErreur)
  traiter(evt) {
    const sortie = [];
    if (!evt || typeof evt !== "object") return sortie;
    if (evt.session_id && evt.type === "system" && evt.subtype === "init") {
      sortie.push({ genre: "session", session_id: evt.session_id });
    }
    if (evt.type === "stream_event" && !evt.parent_tool_use_id) {
      const e = evt.event || {};
      const id = evt.api_message_id || e.message?.id || "m";
      const cle = `${id}:${e.index}`;
      if (e.type === "content_block_start" && e.content_block?.type === "text") {
        this.libererTexte(sortie);
        this.blocs.set(cle, { n: this.allouer(), texte: e.content_block.text || "" });
        this.avecPartiels.add(id);
      } else if (e.type === "content_block_delta" && e.delta?.type === "text_delta") {
        const b = this.blocs.get(cle);
        if (b) {
          b.texte += e.delta.text || "";
          sortie.push({ genre: "texte", n: b.n, texte: b.texte, partiel: true });
        }
      } else if (e.type === "content_block_stop") {
        const b = this.blocs.get(cle);
        if (b) {
          this.blocs.delete(cle);
          if (b.texte.trim()) this.attente = { n: b.n, texte: b.texte };
        }
      }
    }
    // L'abonnement refuse la demande : Claude donne l'heure de reprise (en secondes) avant tout texte.
    if (evt.type === "rate_limit_event" && evt.rate_limit_info?.status === "rejected") {
      this.limite = { reprise: Number(evt.rate_limit_info.resetsAt) * 1000 || null };
    }
    if (evt.type === "assistant" && evt.message) {
      const id = evt.message.id || "m";
      for (const bloc of evt.message.content || []) {
        // Un texte écrit par Claude lui-même (limite, erreur d'API, connexion) n'est jamais relayé : il nourrit
        // seulement le classement de l'erreur de fin de tour.
        if (bloc.type === "text" && evt.message.model === "<synthetic>") {
          this.synthetiques = `${this.synthetiques || ""}\n${bloc.text || ""}`.slice(-2000);
          continue;
        }
        if (bloc.type === "text" && !evt.parent_tool_use_id && !this.avecPartiels.has(id) && bloc.text?.trim()) {
          this.libererTexte(sortie);
          this.attente = { n: this.allouer(), texte: bloc.text };
        }
        if (bloc.type === "tool_use") {
          const phrase = phraseActivite(bloc.name, bloc.input || {});
          if (!evt.parent_tool_use_id && this.texteIntermediaire(sortie, phrase)) continue;
          if (phrase && phrase !== this.derniereActivite) {
            this.derniereActivite = phrase;
            sortie.push({ genre: "activite", texte: phrase });
          }
        }
      }
    }
    if (evt.type === "result") {
      // Les blocs encore ouverts (flux coupé) sont fermés avec ce qu'on a reçu.
      sortie.push(...this.vider());
      this.derniereActivite = null;
      const enErreur = Boolean(evt.is_error || (evt.subtype && evt.subtype !== "success"));
      const synth = this.synthetiques || "";
      this.synthetiques = "";
      const limiteVue = this.limite;
      this.limite = null;
      if (!enErreur) {
        sortie.push({ genre: "fin", erreur: null, limite: false });
        return sortie;
      }
      const c = classerErreur(`${synth}\n${evt.result || ""}\n${(evt.errors || []).join?.("\n") || ""}`, evt.api_error_status);
      if (limiteVue && c.motif !== "connexion") {
        c.motif = "limite";
        c.reprise = limiteVue.reprise || c.reprise;
      }
      sortie.push({ genre: "fin", erreur: phraseErreur(c), limite: c.motif === "limite", motif: c.motif, reprise: c.reprise || null });
    }
    return sortie;
  }
}
