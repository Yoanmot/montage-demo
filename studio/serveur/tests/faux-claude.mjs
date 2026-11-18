#!/usr/bin/env node
// Faux binaire `claude` pour les tests : lit l'entrée stream-json et rejoue, pour chaque message,
// un échange enregistré une fois avec le vrai `claude` (tests/enregistrements/bonjour.jsonl).
//
// Variables :
//   FAUX_CLAUDE_JOURNAL   fichier où noter chaque lancement (arguments, dossier, variables utiles)
//                         et chaque message reçu (une ligne JSON par événement)
//   FAUX_CLAUDE_SCENARIO  normal (défaut) | lent (attend avant de répondre, lance un sous-processus
//                         `sleep` du même groupe) | erreur (résultat en erreur) | coupe (sort sans résultat)
//                         | long (réponse longue écrite morceau par morceau, pour regarder le défilement du chat)
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
  if (f) fs.appendFileSync(f, JSON.stringify({ pid: process.pid, ...evt }) + "\n");
}

noter({
  evenement: "lancement", argv, cwd: process.cwd(),
  env: {
    STUDIO: process.env.STUDIO ?? null, MONTEUR_SK: process.env.MONTEUR_SK ?? null,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? "présente" : null,
    ZERNIO_ECRITURE_ROMAIN: process.env.ZERNIO_ECRITURE_ROMAIN ?? null,
  },
});

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

const rl = readline.createInterface({ input: process.stdin });
let chaine = Promise.resolve();
rl.on("line", (l) => {
  if (!l.trim()) return;
  let evt;
  try { evt = JSON.parse(l); } catch { return; }
  if (evt.type === "user") chaine = chaine.then(() => repondre(evt.message));
});
rl.on("close", () => {
  chaine.then(() => {
    noter({ evenement: "fin" });
    process.exit(0);
  });
});
