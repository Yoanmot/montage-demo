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
export function refusCommuns(client = clientActif(), config = null) {
  const maison = client.racine === "~/.montage-yoan" || !client.racine;
  const racine = maison ? "~/.montage-yoan" : absolu(client.racineAbs);
  const secrets = ["~/.ssh/**", `${racine}/*.env`, "~/.config/monteur-romain/**", "~/.aws/**", "~/.gnupg/**", ...(maison ? [] : [`${racine}/monteur/**`])];
  // Dossiers de configuration Claude protégés : ~/.claude toujours, plus celui du client s'il en a un.
  const configs = ["~/.claude", ...(client.configClaudeAbs ? [absolu(client.configClaudeAbs)] : [])];
  if (client.configClaudeAbs) secrets.push(`${absolu(client.configClaudeAbs)}/.credentials.json`);
  return [
    ...secrets.flatMap((s) => [`Read(${s})`, `Edit(${s})`]),
    ...configs.flatMap((c) => [
      `Edit(${c}/settings.json)`, `Edit(${c}/settings.local.json)`, `Edit(${c}/CLAUDE.md)`,
      `Edit(${c}/agents/**)`, `Edit(${c}/skills/**)`, `Edit(${c}/hooks/**)`,
    ]),
    // Le studio lui-même (son code, ses skills et agents d'origine, ses réglages) : une session ne le modifie pas.
    // Seules les écritures de fichiers sont refusées : lancer les scripts des skills (Bash) reste permis.
    ...[`${racine}/montage-demo/**`, `${racine}/studio/studio.config.json`, `${racine}/client.json`]
      .flatMap((c) => [`Edit(${c})`, `Write(${c})`]),
    // Les consignes du head of content et les outils dont le studio dépend, dans son dépôt (les références des skills,
    // comme la calibration du débit, restent écrites par lui).
    ...(config?.depot ? ["CLAUDE.md", ".claude/settings.json", ".claude/settings.local.json", ".claude/agents/**",
      ".claude/skills/*/SKILL.md", "outils/**"].map((f) => `${absolu(config.depot)}/${f}`)
      .flatMap((c) => [`Edit(${c})`, `Write(${c})`]) : []),
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
    // l'ancien ZERNIO_ECRITURE_ROMAIN=oui). Lot 13 : le renvoi d'une plateforme (reessayer) et l'accord TikTok
    // (--tiktok-consentement, que seul le clic donne) aussi, même en simulation.
    "Bash(*ZERNIO_ECRITURE_ROMAIN*)", "Bash(*ZERNIO_ECRITURE*)", "Bash(*zernio.py publier*--envoyer*)",
    "Bash(*zernio.py reessayer*--envoyer*)", "Bash(*zernio.py poser-mot*--envoyer*)", "Bash(*--tiktok-consentement*)",
    // Installation d'essai qui lit les vrais chiffres (stats_reelles) : la clé de lecture (<racine>/zernio-lecture.env,
    // déjà illisible par Read comme tout <racine>/*.env) ne passe pas non plus par une commande, ni par les variables
    // qui la donneraient à zernio.py.
    ...(client.stats_reelles ? ["Bash(*zernio-lecture*)", "Bash(*ZERNIO_ENV_FILE*)", "Bash(*ZERNIO_API_KEY*)"] : []),
    "Bash(security *)", "Bash(launchctl *)", "Bash(defaults write*)",
  ];
}

export function typeDeChat(chatId) {
  if (chatId === "general") return { genre: "general" };
  let m = /^tournage:([A-Za-z0-9-]{1,64})$/.exec(chatId);
  if (m) return { genre: "tournage", id: m[1] };
  m = /^([a-z0-9-]+):(hoc|monteur)$/.exec(chatId);
  if (m && SLUG_RE.test(m[1])) return { genre: m[2], slug: m[1] };
  // La description d'un fichier de la Galerie (lot 15) : une courte session sans outil, jamais montrée au client.
  m = /^galerie:(\d{8}-\d{6}-[a-z0-9]{4})$/.exec(chatId);
  if (m) return { genre: "galerie", id: m[1] };
  return null;
}

// La consigne « chat du studio » (lot 13), ajoutée à chaque session lancée par le studio : la colonne
// de chat est étroite et tout ce que la session enregistre s'affiche déjà à gauche (arborescence) ou au
// milieu (fichier ouvert). Hors studio (téléphone, cloud), rien ne l'ajoute : le chat y reste la seule
// interface et montre le contenu.
export function consigneStudio(prenom = clientActif().prenom, contact = clientActif().contact) {
  // Ce qui reste fermé, dit comme à un client : le studio se change avec la personne qui l'a installé.
  const studioFerme = contact && contact !== prenom
    ? `dis-lui en une phrase que ça se voit avec ${contact}`
    : "dis-lui en une phrase que ça se change en dehors du studio, pas depuis ce chat";
  return [
    `Tu parles à ${prenom} dans son studio, une appli de son Mac. Son chat est une colonne étroite à droite.`,
    `Tu fais ce que ${prenom} te demande, comme un assistant qui travaille directement sur son Mac, même hors du déroulé prévu : un plan en plus de ceux du brief, un nouveau fichier ou des images dans le dossier du contenu, un brief changé, une étape refaite, une recherche, un petit outil fait pour l'occasion. Le déroulé de tes consignes dit ce que tu fais quand il ne demande rien ; ce n'est jamais une limite. Ne réponds jamais « ce n'est pas prévu » ou « ce n'est pas mon rôle » : fais-le, ou dis en une phrase ce qu'il te manque pour le faire.`,
    `Ce qui reste fermé, même s'il le demande : rien ne part sur Instagram ni sur TikTok depuis ce chat (la publication se fait par son clic sur le récapitulatif de « Poster ») ; ses clés restent secrètes ; rien n'est supprimé hors de ses dossiers de travail ; jamais de visage ni de voix de ${prenom} fabriqués (une autre image générée ou un visuel qu'il demande expressément, oui) ; tu ne modifies ni tes propres consignes, ni le studio lui-même (son interface, ses réglages) : s'il le demande, ${studioFerme}.`,
    "Tout ce que tu enregistres s'affiche déjà ailleurs dans le studio : à gauche dans ses dossiers (« Idées proposées », « Mis de côté », « En cours », « Tournages », « Galerie », « Poster ») et au milieu dans le fichier ouvert (« Idée », « Brief », plan de tournage, « Montage », vidéo, images).",
    "Règle du chat : ne recopie jamais dans le chat ce qui s'y affiche déjà. Ni les idées, ni leurs accroches, ni le brief, ni le script, ni les plans à tourner, ni la légende, ni le plan de tournage, ni le rangement, ni le détail du montage.",
    "Réponds en une ou deux phrases courtes : ce que tu as fait et où il le voit, par exemple « Les 3 idées sont prêtes, tu les vois dans Idées proposées. » ou « Ton brief est écrit, relis-le dans Brief. ». Puis ta question, s'il t'en faut une, en une phrase. Pas de liste, pas de titre, pas de récapitulatif.",
    "S'il te demande expressément de lui montrer ou de lui expliquer quelque chose dans le chat, fais-le, court. Quand tu n'enregistres rien (une question, un conseil), réponds normalement, court aussi.",
    "Rangement d'un fichier que tu fabriques à sa demande (un tableau, un document, des images, une version à partager) : s'il concerne un contenu, dans le dossier de ce contenu dans le dépôt (`$STUDIO_DEPOT/contenus/<slug>/`), où le studio l'affiche dans « Autres fichiers » de ce contenu ; s'il ne concerne aucun contenu, dans le dossier des médias (`$STUDIO_MEDIA`), à sa racine. Jamais sur le Bureau, dans Téléchargements, dans Documents ni ailleurs, même par un script, sauf s'il nomme lui-même un autre endroit. Puis dis-lui en une phrase où il le trouve : « dans Autres fichiers de ce contenu », ou « dans ton dossier » suivi du nom de ce dossier des médias tel qu'il le voit sur son Mac.",
    "Avant de lui dire où en est un contenu (déjà filmé, monté, à tourner, mis en page) ou de faire un récapitulatif, relis l'état par tes outils à ce moment-là, jamais de mémoire de la conversation : ce qui a changé dans le studio depuis ton dernier message ne t'est pas dit.",
    `Écris toujours en français, ${prenom} lit tout ce que tu écris, y compris les petites phrases entre deux étapes de travail.`,
    `${prenom} ne voit pas tes outils. Dans le chat, ne nomme jamais un outil, une commande, un langage ni un fichier technique (par exemple sed, Edit, Bash, git, python, JSON, .md, script). Si une étape technique rate et que tu la refais, ne raconte pas l'incident : dis seulement ce qui est fait.`,
  ].join("\n");
}
export const CONSIGNE_STUDIO = consigneStudio();

export const JOURS_CONVERSATIONS = 3650;

export function absolu(p) {
  return `//${path.resolve(p).replace(/^\/+/, "")}`;
}

// Renvoie { cwd, args, env } pour lancer `claude` sur ce chat (sans --resume, ajouté par le pont).
export function reglagesChat(chatId, config, { besoin = {} } = {}) {
  const t = typeDeChat(chatId);
  if (!t) throw new Error(`chat inconnu : ${chatId}`);
  const client = config.client || clientActif();
  if (t.genre === "galerie") return reglagesDescription(config, client);
  const memoire = client.configClaudeAbs ? `${absolu(client.configClaudeAbs)}/agent-memory/**` : "~/.claude/agent-memory/**";
  // Écritures dans le dossier de la session : par son chemin absolu, posé plus bas une fois le dossier choisi.
  // `./**` seul ne suffit pas (lot 12, essai du 2026-11-20) : Claude le résout depuis le dossier courant du shell,
  // que chaque `cd` de l'outil Bash déplace ; après `cd outils`, une écriture dans `contenus/` était refusée.
  const autorises = [
    ...OUTILS_DE_BASE, "Edit(./**)", "Write(./**)", "NotebookEdit(./**)",
    // La mémoire des agents (préférences apprises du monteur) vit hors du dossier de travail.
    `Edit(${memoire})`, `Write(${memoire})`,
  ];
  const dossiersEnPlus = [];
  // Liberté (19/11/2026) : toute session écrit aussi dans tout le dossier des médias (une vidéo, une image ou un
  // fichier demandé pour un contenu, la bibliothèque des clips) ; le monteur écrit aussi dans les contenus du head of
  // content (un brief changé à la demande). Les refus communs gagnent toujours.
  const ouvrir = (d) => {
    if (!d) return;
    autorises.push(`Edit(${absolu(d)}/**)`, `Write(${absolu(d)}/**)`);
    dossiersEnPlus.push(d);
  };
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
    ouvrir(config.media);
    if (config.depot) ouvrir(path.join(config.depot, "contenus"));
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
  if (t.genre !== "monteur") ouvrir(config.media);
  // Où sont les médias et le dépôt du head of content, pour qu'un agent y range ce qu'on lui demande.
  if (config.media) env.STUDIO_MEDIA = config.media;
  if (config.depot) env.STUDIO_DEPOT = config.depot;
  if (config.home) env.STUDIO_STATS = config.stats?.fichier || path.join(config.home, "stats", "cache.json");
  // Modèle des sous-agents (fichier du client, « claude.modele_sous_agents ») : sans lui, un sous-agent intégré
  // peut tourner sur un modèle plus petit que la session.
  if (config.claude?.modeleSousAgents) env.CLAUDE_CODE_SUBAGENT_MODEL = config.claude.modeleSousAgents;
  // Les scripts du Mac lancés depuis une session du dépôt (a-rendre.py de la mise en page) tournent
  // dans leur propre copie, jamais dans DEPOT (contrat, section 12).
  if (t.genre !== "monteur" && config.depotMac) env.RENDUS_DEPOT = config.depotMac;
  if (t.genre !== "monteur" && config.carrousels) env.RENDUS_CARROUSELS = config.carrousels;
  // Le chat général, les chats de contenu et le tournage tournent dans le dépôt : l'agent est celui
  // de DEPOT/.claude/settings.json (head of content), on ne le force pas.
  if (t.genre !== "monteur" && config.agents?.idees && config.agents.forcer === true) agent = config.agents.idees;

  if (cwd) autorises.push(`Edit(${absolu(cwd)}/**)`, `Write(${absolu(cwd)}/**)`, `NotebookEdit(${absolu(cwd)}/**)`);

  // cleanupPeriodDays : Claude efface les conversations inactives depuis 30 jours par défaut ; un contenu repris après
  // des vacances perdait son fil (lot 12). Le pont repart aussi d'une conversation neuve si elle a disparu.
  const reglages = { cleanupPeriodDays: JOURS_CONVERSATIONS, permissions: { deny: refusCommuns(client, config) } };
  const args = [
    "-p",
    "--input-format", "stream-json",
    "--output-format", "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--permission-mode", "dontAsk",
    "--allowedTools", autorises.join(" "),
    "--settings", JSON.stringify(reglages),
    "--append-system-prompt", consigneStudio(client.prenom, client.contact),
  ];
  if (agent) args.push("--agent", agent);
  for (const d of [...new Set(dossiersEnPlus)]) args.push("--add-dir", d);
  if (config.claude?.modele) args.push("--model", config.claude.modele);
  return { cwd, args, env, agent, genre: t.genre, slug: t.slug || null };
}

// La session qui décrit un fichier de la Galerie (lot 15) : les images sont dans le message, la réponse est un JSON
// validé par un script avant écriture. Aucun outil, aucun réglage ni agent chargé, rien de gardé entre deux essais
// (une description coupée se refait en entier), dossier de travail vide dans STUDIO_HOME.
function reglagesDescription(config, client) {
  const env = { STUDIO: "1" };
  if (client.configClaudeAbs) env.CLAUDE_CONFIG_DIR = client.configClaudeAbs;
  const args = [
    "-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose",
    "--tools", "", "--strict-mcp-config", "--disable-slash-commands", "--setting-sources", "", "--no-session-persistence",
    "--settings", JSON.stringify({ permissions: { deny: refusCommuns(client, config) } }),
  ];
  const modele = config.claude?.modeleDescription || config.claude?.modele || null;
  if (modele) args.push("--model", modele);
  return { cwd: path.join(config.home, "galerie-travail"), args, env, agent: null, genre: "galerie", slug: null, sansReprise: true };
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
