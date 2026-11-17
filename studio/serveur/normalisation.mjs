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
// (lot 11) : jamais montré tel quel, remplacé par une phrase pour Romain.
const CONNEXION = /not logged in|run \/login|oauth token|token has expired|invalid api key|authentication_error|revoked/i;
export const PHRASE_CONNEXION = `Ton studio n'est plus connecté à ton compte Claude. Préviens ${contact()} : la reconnexion prend deux minutes.`;

// Un normaliseur par processus `claude`. `allouer()` donne le numéro du prochain message du chat.
export class Normaliseur {
  constructor(allouer) {
    this.allouer = allouer;
    this.blocs = new Map();       // "<message>:<index>" -> { n, texte }
    this.avecPartiels = new Set(); // messages dont le texte est arrivé par morceaux
    this.derniereActivite = null;
  }

  // Renvoie une liste d'éléments :
  //   { genre: "session", session_id }
  //   { genre: "texte", n, texte, partiel: bool }
  //   { genre: "activite", texte }
  //   { genre: "fin", erreur: string | null, limite: bool }
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
          if (b.texte.trim()) sortie.push({ genre: "texte", n: b.n, texte: b.texte, partiel: false });
        }
      }
    }
    if (evt.type === "assistant" && evt.message) {
      const id = evt.message.id || "m";
      for (const bloc of evt.message.content || []) {
        if (bloc.type === "text" && evt.message.model === "<synthetic>" && CONNEXION.test(bloc.text || "")) { this.connexion = true; continue; }
        if (bloc.type === "text" && !evt.parent_tool_use_id && !this.avecPartiels.has(id) && bloc.text?.trim()) {
          sortie.push({ genre: "texte", n: this.allouer(), texte: bloc.text, partiel: false });
        }
        if (bloc.type === "tool_use") {
          const phrase = phraseActivite(bloc.name, bloc.input || {});
          if (phrase && phrase !== this.derniereActivite) {
            this.derniereActivite = phrase;
            sortie.push({ genre: "activite", texte: phrase });
          }
        }
      }
    }
    if (evt.type === "result") {
      // Les blocs encore ouverts (flux coupé) sont fermés avec ce qu'on a reçu.
      for (const b of this.blocs.values()) {
        if (b.texte.trim()) sortie.push({ genre: "texte", n: b.n, texte: b.texte, partiel: false });
      }
      this.blocs.clear();
      this.derniereActivite = null;
      const limite = evt.api_error_status === 429 || /limit|quota/i.test(String(evt.result || "")) && evt.is_error;
      const connexion = this.connexion || (evt.is_error && CONNEXION.test(String(evt.result || "")));
      const erreur = connexion ? PHRASE_CONNEXION : evt.is_error || (evt.subtype && evt.subtype !== "success")
        ? (limite
          ? "Ton abonnement a atteint sa limite pour le moment. Ça reprendra tout seul plus tard."
          : `Quelque chose a coincé de mon côté. Réessaie, et si ça recommence, préviens ${contact()}.`)
        : null;
      sortie.push({ genre: "fin", erreur, limite: Boolean(limite) });
    }
    return sortie;
  }
}
