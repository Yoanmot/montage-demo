#!/usr/bin/env node
// Faux binaire `claude` pour les tests : lit l'entrée stream-json et rejoue, pour chaque message,
// un échange enregistré une fois avec le vrai `claude` (tests/enregistrements/bonjour.jsonl).
//
// Variables :
//   FAUX_CLAUDE_JOURNAL   fichier où noter chaque lancement (arguments, dossier, variables utiles)
//                         et chaque message reçu (une ligne JSON par événement)
//   FAUX_CLAUDE_SCENARIO  normal (défaut) | lent (attend avant de répondre, lance un sous-processus
//                         `sleep` du même groupe) | erreur (résultat en erreur) | coupe (sort sans résultat)
//                         | suite (reparle après la fin du tour, comme après un rendu en arrière-plan)
//                         | long (réponse longue écrite morceau par morceau, pour regarder le défilement du chat)
//                         | limite (abonnement au maximum : rate_limit_event refusé, texte <synthetic>, résultat en erreur)
//                         | surcharge (« API Error: 529 ... overloaded », texte <synthetic> et résultat en erreur)
//                         | perdue (--resume d'une conversation effacée : « No conversation found » puis sortie 1)
//                         | intermediaire (textes entre deux outils, dont un en anglais, puis une question finale)
//                         | rendu (faux monteur : un faux rendu par message, limite possible en plein rendu ; voir rendu())
//   FAUX_CLAUDE_ECHECS    fichier : nombre d'échecs restants pour limite et surcharge (décompté ; à 0, réponse normale)
//   FAUX_CLAUDE_REPRISE   secondes epoch de reprise annoncées par le scénario limite (défaut : dans 2 h)
//   FAUX_CLAUDE_DELAI_LONG ms entre deux morceaux du scénario long (défaut 60)
//   FAUX_CLAUDE_ATTENTE   ms d'attente du scénario lent (défaut 60000)
//   FAUX_CLAUDE_ECRIT     chemin relatif au dossier de travail à écrire avant le résultat ;
//                         {slug} = slug trouvé dans le message (« contenus/<slug>/ ») ou nom du dossier
//   FAUX_CLAUDE_DELAI     ms entre deux lignes rejouées (défaut 2)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import readline from "node:readline";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const ENREG = path.join(ICI, "enregistrements", "bonjour.jsonl");
const scenario = process.env.FAUX_CLAUDE_SCENARIO || "normal";
const delai = Number(process.env.FAUX_CLAUDE_DELAI ?? 2);
const argv = process.argv.slice(2);
const iResume = argv.indexOf("--resume");
const session = iResume >= 0 ? argv[iResume + 1] : crypto.randomUUID();

function noter(evt) {
  const f = process.env.FAUX_CLAUDE_JOURNAL;
  if (f) fs.appendFileSync(f, JSON.stringify({ pid: process.pid, t: Date.now(), ...evt }) + "\n");
}

noter({
  evenement: "lancement", argv, cwd: process.cwd(),
  env: {
    STUDIO: process.env.STUDIO ?? null, MONTEUR_SK: process.env.MONTEUR_SK ?? null,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? "présente" : null,
    ZERNIO_ECRITURE_ROMAIN: process.env.ZERNIO_ECRITURE_ROMAIN ?? null,
  },
});

// Conversation effacée par Claude (plus de 30 jours) : il le dit sur la sortie d'erreur et s'arrête.
if (scenario === "perdue" && iResume >= 0) {
  process.stderr.write(`No conversation found with session ID: ${session}\n`);
  process.exit(1);
}

function echecRestant() {
  const f = process.env.FAUX_CLAUDE_ECHECS;
  if (!f) return true;
  const n = Number(fs.readFileSync(f, "utf8")) || 0;
  if (n <= 0) return false;
  fs.writeFileSync(f, String(n - 1));
  return true;
}

const modele = fs.readFileSync(ENREG, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

function ecrire(evt) {
  const t = JSON.stringify(evt)
    .replaceAll("242b8afe-eb03-4395-8018-5c00c3e142ee", session)
    .replaceAll("/tmp/exemple", process.cwd());
  process.stdout.write(t + "\n");
}

const REPONSE_LONGUE = [
  "Voilà dix idées tirées de ta semaine, de la plus simple à tourner à la plus longue.",
  "",
  ...Array.from({ length: 10 }, (_, i) => `${i + 1}. **Idée ${i + 1}** : une question qu'on t'a posée cette semaine, reprise telle quelle, avec ta réponse en trente secondes et un exemple de ta journée.`),
  "",
  "Dis-moi lesquelles tu gardes : je les range dans tes dossiers et je prépare les briefs dans la foulée.",
].join("\n");

let premier = true;
async function repondre(message) {
  const texte = typeof message?.content === "string" ? message.content
    : (message?.content || []).map((b) => b.text || "").join("");
  noter({ evenement: "message", texte });
  if ((scenario === "limite" || scenario === "surcharge") && echecRestant()) {
    if (premier) ecrire(modele.find((e) => e.type === "system" && e.subtype === "init"));
    premier = false;
    const limite = scenario === "limite";
    const reprise = Number(process.env.FAUX_CLAUDE_REPRISE) || Math.floor(Date.now() / 1000) + 7200;
    const texteErreur = limite ? "You've hit your session limit · resets 3pm"
      : 'API Error: 529 {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}';
    if (limite) ecrire({ type: "rate_limit_event", rate_limit_info: { status: "rejected", resetsAt: reprise, rateLimitType: "five_hour" }, session_id: session });
    ecrire({ type: "assistant", message: { id: `msg_${crypto.randomUUID()}`, model: "<synthetic>", role: "assistant", type: "message", content: [{ type: "text", text: texteErreur }] }, parent_tool_use_id: null, session_id: session });
    ecrire({ type: "result", subtype: "success", is_error: true, api_error_status: limite ? 429 : 529, result: texteErreur, session_id: session });
    return;
  }
  if (scenario === "rendu") return rendu(texte);
  if (scenario === "intermediaire") {
    if (premier) ecrire(modele.find((e) => e.type === "system" && e.subtype === "init"));
    premier = false;
    const base = { session_id: session, parent_tool_use_id: null };
    // Un texte écrit au fil de l'eau (stream_event), puis le message complet, comme le vrai claude.
    const texteEnFlux = async (id, texte) => {
      ecrire({ type: "stream_event", event: { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }, api_message_id: id, ...base });
      for (const m of texte.match(/[^ ]+ ?/g)) {
        ecrire({ type: "stream_event", event: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: m } }, api_message_id: id, ...base });
        await pause(delai);
      }
      ecrire({ type: "stream_event", event: { type: "content_block_stop", index: 0 }, api_message_id: id, ...base });
      ecrire({ type: "assistant", message: { id, model: "claude-opus-5-5", role: "assistant", type: "message", content: [{ type: "text", text: texte }] }, ...base });
    };
    const outil = (id, name, input) => {
      ecrire({ type: "assistant", message: { id, model: "claude-opus-5-5", role: "assistant", type: "message", content: [{ type: "tool_use", id: `toolu_${id}`, name, input }] }, ...base });
      ecrire({ type: "user", message: { role: "user", content: [{ tool_use_id: `toolu_${id}`, type: "tool_result", content: "ok" }] }, ...base });
    };
    await texteEnFlux("msg_i1", "Let me check a few.");
    outil("msg_i1", "Read", { file_path: `${process.cwd()}/veille/outliers.md` });
    await texteEnFlux("msg_i2", "Je regarde tes trois derniers posts.");
    outil("msg_i2", "Bash", { command: "python3 outils/zernio.py stats" });
    const fin = "Ton meilleur post de la semaine est celui des courbatures. Tu veux que j'en tire une idée ?";
    await texteEnFlux("msg_i3", fin);
    ecrire({ type: "result", subtype: "success", is_error: false, result: fin, ...base });
    return;
  }
  if (scenario === "lent") {
    const enfant = spawn("sleep", ["300"], { stdio: "ignore" });
    noter({ evenement: "sous_processus", pid_enfant: enfant.pid });
    await pause(Number(process.env.FAUX_CLAUDE_ATTENTE || 60000));
  }
  let texteFait = false;
  for (const evt of modele) {
    if (evt.type === "system" && evt.subtype === "init" && !premier) continue;
    if (scenario === "long") {
      // Le texte enregistré est remplacé par une réponse longue, écrite par petits morceaux.
      const d = evt.type === "stream_event" && evt.event?.type === "content_block_delta" && evt.event.delta?.type === "text_delta";
      if (d) {
        if (texteFait) continue;
        texteFait = true;
        for (const morceau of REPONSE_LONGUE.match(/[^ ]+ ?/g)) {
          ecrire({ ...evt, event: { ...evt.event, delta: { type: "text_delta", text: morceau } } });
          await pause(Number(process.env.FAUX_CLAUDE_DELAI_LONG || 60));
        }
        continue;
      }
      if (evt.type === "assistant" && (evt.message?.content || []).some((b) => b.type === "text")) {
        ecrire({ ...evt, message: { ...evt.message, content: [{ type: "text", text: REPONSE_LONGUE }] } });
        continue;
      }
      if (evt.type === "result") { ecrire({ ...evt, result: REPONSE_LONGUE }); continue; }
    }
    if (evt.type === "result") {
      if (scenario === "coupe") process.exit(1);
      const cible = process.env.FAUX_CLAUDE_ECRIT;
      if (cible) {
        const slug = /contenus\/([a-z0-9-]+)\//.exec(texte)?.[1] || path.basename(process.cwd());
        const f = path.join(process.cwd(), cible.replaceAll("{slug}", slug));
        fs.mkdirSync(path.dirname(f), { recursive: true });
        fs.writeFileSync(f, "# écrit par le faux claude\n");
      }
      if (scenario === "erreur") {
        ecrire({ ...evt, is_error: true, subtype: "error_during_execution", result: "" });
        continue;
      }
    }
    ecrire(evt);
    if (delai) await pause(delai);
  }
  premier = false;
}

// Scénario rendu (montages en lot) : un faux monteur dans le dossier du contenu (MEDIA/<slug>). Chaque message lance
// un faux rendu, processus à part dans son propre groupe (comme rendu.py), noté dans FAUX_CLAUDE_RENDUS (début, fin)
// et qui écrit face/<slug>-monte.mp4 en finissant. Une vidéo déjà montée ne se refait pas, sauf message « corrige ».
// FAUX_CLAUDE_LIMITE_SLUG : la limite tombe une fois sur ce contenu, au milieu du montage, le rendu en cours en fond :
// Claude refuse la suite, reste en vie tant que le rendu tourne (comme une tâche de fond), puis s'arrête.
async function rendu(texte) {
  const slug = path.basename(process.cwd());
  const journalRendus = process.env.FAUX_CLAUDE_RENDUS;
  const duree = Number(process.env.FAUX_CLAUDE_RENDU_MS || 300);
  const video = path.join(process.cwd(), "face", `${slug}-monte.mp4`);
  if (premier) ecrire(modele.find((e) => e.type === "system" && e.subtype === "init"));
  premier = false;
  const fin = (t, erreur = false) => ecrire({ type: "result", subtype: "success", is_error: erreur, ...(erreur ? { api_error_status: 429 } : {}), result: t, session_id: session });
  if (fs.existsSync(video) && !/corrige/i.test(texte)) { fin("La vidéo est déjà faite."); return; }
  const code = `const fs=require("fs");const [j,s,v,d]=process.argv.slice(1);const n=(e)=>j&&fs.appendFileSync(j,JSON.stringify({e,s,pid:process.pid,t:Date.now()})+"\\n");`
    + `n("debut");setTimeout(()=>{fs.mkdirSync(require("path").dirname(v),{recursive:true});fs.writeFileSync(v,"mp4");n("fin");},Number(d));`;
  const enfant = spawn(process.execPath, ["-e", code, journalRendus || "", slug, video, String(duree)], { detached: true, stdio: "ignore" });
  const termine = new Promise((r) => enfant.once("exit", r));
  const marque = journalRendus ? `${journalRendus}.limite-${slug}` : null;
  if (process.env.FAUX_CLAUDE_LIMITE_SLUG === slug && marque && !fs.existsSync(marque)) {
    fs.writeFileSync(marque, "1");
    const reprise = Number(process.env.FAUX_CLAUDE_REPRISE) || Math.floor(Date.now() / 1000) + 7200;
    const refus = () => {
      ecrire({ type: "rate_limit_event", rate_limit_info: { status: "rejected", resetsAt: reprise, rateLimitType: "five_hour" }, session_id: session });
      ecrire({ type: "assistant", message: { id: `msg_${crypto.randomUUID()}`, model: "<synthetic>", role: "assistant", type: "message", content: [{ type: "text", text: "You've hit your session limit · resets 3pm" }] }, parent_tool_use_id: null, session_id: session });
      fin("You've hit your session limit · resets 3pm", true);
    };
    await pause(Math.min(50, duree / 4));
    refus();
    // Le rendu continue en fond ; à sa fin, Claude voudrait reprendre la main et se heurte encore à la limite.
    await termine;
    refus();
    return;
  }
  await termine;
  fin("Ta vidéo est prête.");
}

const rl = readline.createInterface({ input: process.stdin });
let chaine = Promise.resolve();
rl.on("line", (l) => {
  if (!l.trim()) return;
  let evt;
  try { evt = JSON.parse(l); } catch { return; }
  if (evt.type === "user") chaine = chaine.then(() => repondre(evt.message));
});
rl.on("close", () => {
  chaine.then(async () => {
    // Scénario suite : un travail lancé en arrière-plan finit après la fin du tour, et l'agent reparle
    // (texte puis nouveau résultat) avant de se terminer.
    if (scenario === "suite") {
      await pause(Number(process.env.FAUX_CLAUDE_ATTENTE || 300));
      await repondre({ content: "(notification de tâche de fond)" });
    }
    noter({ evenement: "fin" });
    process.exit(0);
  });
});
