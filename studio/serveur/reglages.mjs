// Réglages de chaque session `claude` : dossier, agent, dossiers en plus, permissions, variables
// d'environnement. Le pourquoi est dans PERMISSIONS.md (à garder d'accord avec ce fichier).
import path from "node:path";
import { SLUG_RE } from "./outils.mjs";
import { clientActif, VARIABLES_ECRITURE } from "./client.mjs";

// Outils toujours permis (lecture, recherche, skills, sous-agents). Les écritures de fichiers
// sont bornées par des règles Edit(...) ajoutées selon le dossier de la session.
const OUTILS_DE_BASE = [
  "Read", "Glob", "Grep", "Bash", "Skill", "Task", "Agent", "TodoWrite", "ToolSearch",
  "WebFetch", "WebSearch", "Monitor", "TaskOutput", "TaskStop", "SendMessage",
];

// Refus valables pour toutes les sessions (ils gagnent sur toute permission). Secrets et configuration
// Claude tirés du client : pour Romain (racine ~/.montage-yoan, config Claude dans ~/.claude), la liste
// d'avant, plus le garde-fou générique de publication.
export function refusCommuns(client = clientActif()) {
  const maison = client.racine === "~/.montage-yoan" || !client.racine;
  const racine = maison ? "~/.montage-yoan" : absolu(client.racineAbs);
  const secrets = ["~/.ssh/**", `${racine}/*.env`, "~/.config/monteur-romain/**", "~/.aws/**", "~/.gnupg/**"];
  // Dossiers de configuration Claude protégés : ~/.claude toujours, plus celui du client s'il en a un.
  const configs = ["~/.claude", ...(client.configClaudeAbs ? [absolu(client.configClaudeAbs)] : [])];
  if (client.configClaudeAbs) secrets.push(`${absolu(client.configClaudeAbs)}/.credentials.json`);
  return [
    ...secrets.flatMap((s) => [`Read(${s})`, `Edit(${s})`]),
    ...configs.flatMap((c) => [
      `Edit(${c}/settings.json)`, `Edit(${c}/settings.local.json)`, `Edit(${c}/CLAUDE.md)`,
      `Edit(${c}/agents/**)`, `Edit(${c}/skills/**)`, `Edit(${c}/hooks/**)`,
    ]),
    "Edit(~/.zshrc)", "Edit(~/.bash_profile)", "Edit(~/.profile)",
    "Edit(~/Library/LaunchAgents/**)",
    // Suppressions hors du dossier de la session : chemin absolu, maison, ou remontée.
    ...["rm -rf", "rm -fr", "rm -r -f", "rm -Rf", "rm -r"].flatMap((r) => [
      `Bash(${r} /*)`, `Bash(${r} ~*)`, `Bash(${r} ..*)`, `Bash(${r} $HOME*)`,
    ]),
    "Bash(sudo *)",
    "Bash(git push --force*)", "Bash(git push -f*)", "Bash(git push * --force*)", "Bash(git push * -f*)",
    "Bash(git push --force-with-lease*)", "Bash(git push * --force-with-lease*)",
    "Bash(git reset --hard*)", "Bash(git clean *)",
    "Bash(*/.ssh*)", "Bash(*~/.ssh*)", "Bash(*zernio.env*)", "Bash(*monteur-romain/.env*)",
    ...(maison ? [] : ["Bash(*elevenlabs.env*)", "Bash(*claude.env*)"]),
    // La publication ne part que d'un clic sur le récapitulatif du studio (ZERNIO_ECRITURE=<compte>, et
    // l'ancien ZERNIO_ECRITURE_ROMAIN=oui).
    "Bash(*ZERNIO_ECRITURE_ROMAIN*)", "Bash(*ZERNIO_ECRITURE*)", "Bash(*zernio.py publier*--envoyer*)",
    "Bash(security *)", "Bash(launchctl *)", "Bash(defaults write*)",
  ];
}

export function typeDeChat(chatId) {
  if (chatId === "general") return { genre: "general" };
  let m = /^tournage:([A-Za-z0-9-]{1,64})$/.exec(chatId);
  if (m) return { genre: "tournage", id: m[1] };
  m = /^([a-z0-9-]+):(hoc|monteur)$/.exec(chatId);
  if (m && SLUG_RE.test(m[1])) return { genre: m[2], slug: m[1] };
  return null;
}

// La consigne « chat du studio » (lot 13), ajoutée à chaque session lancée par le studio : la colonne
// de chat est étroite et tout ce que la session enregistre s'affiche déjà à gauche (arborescence) ou au
// milieu (fichier ouvert). Hors studio (téléphone, cloud), rien ne l'ajoute : le chat y reste la seule
// interface et montre le contenu.
export function consigneStudio(prenom = clientActif().prenom) {
  return [
    `Tu parles à ${prenom} dans son studio, une appli de son Mac. Son chat est une colonne étroite à droite.`,
    "Tout ce que tu enregistres s'affiche déjà ailleurs dans le studio : à gauche dans ses dossiers (« Idées proposées », « Mis de côté », « En cours », « Tournages », « À ranger », « Publier sur Instagram ») et au milieu dans le fichier ouvert (« Idée », « Brief », plan de tournage, « Montage », vidéo, images).",
    "Règle du chat : ne recopie jamais dans le chat ce qui s'y affiche déjà. Ni les idées, ni leurs accroches, ni le brief, ni le script, ni les plans à tourner, ni la légende, ni le plan de tournage, ni le rangement, ni le détail du montage.",
    "Réponds en une ou deux phrases courtes : ce que tu as fait et où il le voit, par exemple « Les 3 idées sont prêtes, tu les vois dans Idées proposées. » ou « Ton brief est écrit, relis-le dans Brief. ». Puis ta question, s'il t'en faut une, en une phrase. Pas de liste, pas de titre, pas de récapitulatif.",
    "S'il te demande expressément de lui montrer ou de lui expliquer quelque chose dans le chat, fais-le, court. Quand tu n'enregistres rien (une question, un conseil), réponds normalement, court aussi.",
  ].join("\n");
}
export const CONSIGNE_STUDIO = consigneStudio();

function absolu(p) {
  return `//${path.resolve(p).replace(/^\/+/, "")}`;
}

// Renvoie { cwd, args, env } pour lancer `claude` sur ce chat (sans --resume, ajouté par le pont).
export function reglagesChat(chatId, config, { besoin = {} } = {}) {
  const t = typeDeChat(chatId);
  if (!t) throw new Error(`chat inconnu : ${chatId}`);
  const client = config.client || clientActif();
  const memoire = client.configClaudeAbs ? `${absolu(client.configClaudeAbs)}/agent-memory/**` : "~/.claude/agent-memory/**";
  const autorises = [
    ...OUTILS_DE_BASE, "Edit(./**)", "Write(./**)", "NotebookEdit(./**)",
    // La mémoire des agents (préférences apprises du monteur) vit hors du dossier de travail.
    `Edit(${memoire})`, `Write(${memoire})`,
  ];
  const dossiersEnPlus = [];
  let cwd = config.depot;
  let agent = null;
  // Toutes les sessions du studio le savent (le head of content aussi : le même dépôt sert le téléphone).
  const env = { STUDIO: "1" };
  // Client à configuration Claude isolée : chaque session la reçoit, même si le serveur l'a perdue.
  if (client.configClaudeAbs) env.CLAUDE_CONFIG_DIR = client.configClaudeAbs;
  if (t.genre === "monteur") {
    cwd = path.join(config.media, t.slug);
    agent = config.agents?.montage || "monteur";
    if (config.skills) env.MONTEUR_SK = config.skills;
    if (config.skills) dossiersEnPlus.push(config.skills);
    // Le monteur lit le script du contenu lui-même (lecture seule : Read est permis partout
    // sauf les secrets, rien d'autre à ouvrir).
  } else if (besoin.miseEnPage) {
    // Mise en page d'un carrousel (gabarit du lot 5) : skills du Mac, photos du contenu, dossier
    // des slides rendues. Les écritures passent par les scripts du skill ; le modèle peut écrire
    // dans le dossier des slides seulement.
    const slides = config.carrousels || path.join(config.maison || process.env.HOME || "", "Pictures", "Carrousels");
    if (config.skills) dossiersEnPlus.push(config.skills);
    if (besoin.slug) dossiersEnPlus.push(path.join(config.media, besoin.slug, "photos"));
    dossiersEnPlus.push(slides);
    autorises.push(`Edit(${absolu(slides)}/**)`, `Write(${absolu(slides)}/**)`);
  }
  // Les scripts du Mac lancés depuis une session du dépôt (a-rendre.py de la mise en page) tournent
  // dans leur propre copie, jamais dans DEPOT (contrat, section 12).
  if (t.genre !== "monteur" && config.depotMac) env.RENDUS_DEPOT = config.depotMac;
  if (t.genre !== "monteur" && config.carrousels) env.RENDUS_CARROUSELS = config.carrousels;
  // Le chat général, les chats de contenu et le tournage tournent dans le dépôt : l'agent est celui
  // de DEPOT/.claude/settings.json (head of content), on ne le force pas.
  if (t.genre !== "monteur" && config.agents?.idees && config.agents.forcer === true) agent = config.agents.idees;

  const reglages = { permissions: { deny: refusCommuns(client) } };
  const args = [
    "-p",
    "--input-format", "stream-json",
    "--output-format", "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--permission-mode", "dontAsk",
    "--allowedTools", autorises.join(" "),
    "--settings", JSON.stringify(reglages),
    "--append-system-prompt", consigneStudio(client.prenom),
  ];
  if (agent) args.push("--agent", agent);
  for (const d of dossiersEnPlus) args.push("--add-dir", d);
  if (config.claude?.modele) args.push("--model", config.claude.modele);
  return { cwd, args, env, agent, genre: t.genre, slug: t.slug || null };
}

// Variables d'environnement d'une session : celles du serveur, sans clé d'API (la session tourne
// sur l'abonnement du client) ni verrou de publication.
export function environnement(base, ajout) {
  const env = { ...base, ...ajout };
  for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", ...VARIABLES_ECRITURE, "ZERNIO_API_KEY", "CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT"]) {
    delete env[k];
  }
  return env;
}
