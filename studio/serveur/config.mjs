// Configuration du studio (contrat, section 7) : STUDIO_HOME/studio.config.json, créé s'il manque depuis
// CODE/studio.config.exemple.json et les valeurs du client (clients/<id>.json, STUDIO_CLIENT). Aucune clé ici.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { etendre, lireJson, ecrireJson } from "./outils.mjs";
import { chargerClient } from "./client.mjs";

export const CODE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function studioHome(env = process.env) {
  if (env.STUDIO_HOME) return etendre(env.STUDIO_HOME);
  return path.join(chargerClient({ env, maison: os.homedir() }).racineAbs, "studio");
}

const EXEMPLE = lireJson(path.join(CODE, "studio.config.exemple.json"), {});

// Ce que le client fixe dans un studio.config.json neuf. Pour Romain : exactement les valeurs de
// l'exemple (prénom, port 4747, dépôts sous ~/.montage-yoan, skills dans ~/.claude, pas d'aperçu).
export function defautsDuClient(client) {
  const r = String(client.racine).replace(/\/+$/, "");
  return {
    prenom: client.prenom,
    port: client.port,
    depot_hoc: `${r}/studio/head-of-content`,
    depot_mac: `${r}/head-of-content`,
    skills: client.config_claude ? `${String(client.config_claude).replace(/\/+$/, "")}/skills` : "~/.claude/skills",
    apercu_ressources: client.ressources?.site || null,
    // Lot 11 : le compteur des visites des ressources gratuites (site du client), lu par stats.mjs. Clé de lecture hors
    // du dépôt : <racine>/ressources.env (ligne VISITES_RESSOURCES_CLE=...), illisible par les sessions (*.env).
    ...(client.ressources?.site ? {
      stats: {
        visites_ressources: {
          url: `${String(client.ressources.site).replace(/\/+$/, "")}/api/visites/`,
          debut: client.ressources.compteur_depuis || null,
          cle_fichier: `${r}/ressources.env`,
          cle_variable: "VISITES_RESSOURCES_CLE",
        },
      },
    } : {}),
    // Client à configuration Claude isolée : le dossier média (dossier des sessions du monteur) vit sous
    // la racine, hors de la maison, pour que claude n'y trouve en remontant ni ~/.claude ni un CLAUDE.md.
    ...(client.config_claude ? { media: `${r}/Contenu` } : {}),
    // Modèles du client (clients/<id>.json, « claude ») : seulement ceux qu'il fixe. Romain n'en fixe aucun :
    // ses valeurs restent celles de l'exemple (abonnement par défaut, rangement en sonnet).
    ...(modelesDuClient(client) ? { claude: modelesDuClient(client) } : {}),
  };
}

// Les modèles fixés par le fichier du client (« claude » : modele, modele_rangement, modele_sous_agents), sans les vides.
export function modelesDuClient(client) {
  const c = client?.claude;
  if (!c || typeof c !== "object") return null;
  const r = {};
  for (const k of ["modele", "modele_rangement", "modele_sous_agents"]) {
    if (typeof c[k] === "string" && c[k].trim()) r[k] = c[k].trim();
  }
  return Object.keys(r).length ? r : null;
}

// La lecture des vrais chiffres d'une installation d'essai : seulement un client à simulation forcée qui la demande.
export function lectureDuClient(client) {
  const compte = client?.stats_reelles?.compte;
  if (client?.simulation_forcee !== true || typeof compte !== "string" || !/^[a-z0-9]{1,32}$/.test(compte)) return null;
  if (!client.racineAbs) return null;
  return { compte, cleFichier: path.join(client.racineAbs, "zernio-lecture.env") };
}

function fusion(base, ajout) {
  if (!ajout || typeof ajout !== "object" || Array.isArray(ajout)) return ajout ?? base;
  const r = { ...(base || {}) };
  for (const [k, v] of Object.entries(ajout)) {
    r[k] = v && typeof v === "object" && !Array.isArray(v) ? fusion(base?.[k], v) : v;
  }
  return r;
}

export function chargerConfig({ home = studioHome(), env = process.env } = {}) {
  const client = chargerClient({ env });
  const DEFAUTS = fusion(EXEMPLE, defautsDuClient(client));
  const fichier = path.join(home, "studio.config.json");
  fs.mkdirSync(home, { recursive: true });
  if (!fs.existsSync(fichier)) ecrireJson(fichier, DEFAUTS);
  const lu = lireJson(fichier, null);
  if (!lu) throw new Error(`configuration illisible : ${fichier}`);
  const brut = fusion(DEFAUTS, lu);
  const maison = env.HOME || os.homedir();
  const c = {
    fichier,
    home,
    brut,
    prenom: brut.prenom || client.prenom || "",
    // Le client (identité, appli, thème, compte, dossier de config Claude) : clients/<id>.json.
    client,
    appli: { nom: client.appli?.nom || "Studio", icone: client.appli?.icone || null },
    theme: client.theme || "romain",
    contact: client.contact || "",
    port: Number(env.STUDIO_PORT || brut.port || client.port || 4747),
    depot: etendre(brut.depot_hoc, maison),
    // Copie du dépôt gérée par les scripts du Mac (zernio.py, a-rendre.py) : ils l'alignent de force
    // sur le dépôt en ligne, donc ils n'y tournent que là, jamais dans DEPOT (contrat, section 12).
    depotMac: etendre(brut.depot_mac || DEFAUTS.depot_mac, maison),
    media: etendre(brut.media, maison),
    // Dossier où la mise en page écrit les slides (carrousel-<slug>/) : a-rendre.py le reçoit par
    // RENDUS_CARROUSELS, le lien MEDIA/<slug>/slides y mène (contrat, sections 2 et 7).
    carrousels: etendre(brut.carrousels || "~/Pictures/Carrousels", maison),
    arrivees: brut.arrivees ? etendre(brut.arrivees, maison) : null,
    disque: brut.disque_externe ? etendre(brut.disque_externe, maison) : null,
    appareil: brut.appareil || null,
    skills: brut.skills ? etendre(brut.skills, maison) : null,
    agents: brut.agents || {},
    parallele: Math.max(1, Number(brut.sessions_en_parallele) || 1),
    synchroMinutes: Math.max(0, Number(brut.synchro_minutes ?? 5)),
    publication: brut.publication || {},
    // Modèle des sessions : celui de studio.config.json s'il en fixe un, sinon celui du fichier du client,
    // sinon rien (l'abonnement choisit). Les sous-agents suivent modele_sous_agents (CLAUDE_CODE_SUBAGENT_MODEL).
    claude: {
      binaire: env.STUDIO_CLAUDE || brut.claude?.binaire || "claude",
      modele: brut.claude?.modele || modelesDuClient(client)?.modele || null,
      modeleSousAgents: brut.claude?.modele_sous_agents || modelesDuClient(client)?.modele_sous_agents || null,
    },
    // Variable prioritaire (contrat, section 7) : STUDIO_SIMULATION=1 => jamais --envoyer.
    simulation: env.STUDIO_SIMULATION === "1" || brut.publication?.simulation === true,
    // Adresse d'aperçu des ressources gratuites (contrat, section 7) : ressource_url = <apercu>/<slug>/.
    apercuRessources: brut.apercu_ressources || null,
    // Chiffres Instagram de la vue d'ensemble (contrat, sections 7 et 15) : fichier local (tests, bac à
    // sable) ou lecture par zernio.py hors simulation, au plus toutes les `heures` heures.
    stats: {
      fichier: brut.stats?.fichier ? etendre(brut.stats.fichier, maison) : null,
      heures: Math.max(1, Number(brut.stats?.heures) || 6),
      // Environnement de test de Yoan seulement (lot 11) : vrais chiffres en lecture, même quand la
      // publication est en simulation.
      // Aussi réglable dans la config (`stats.instagram_en_simulation`) : la lecture des chiffres ne publie
      // rien, elle peut rester active pendant que la publication est en simulation (studio de Yoan).
      instagramEnSimulation: env.STUDIO_STATS_INSTAGRAM === "1" || brut.stats?.instagram_en_simulation === true,
      // Installation d'essai (simulation_forcee) dont le client porte `stats_reelles` (romain-test) : les vrais chiffres
      // d'Instagram en LECTURE, avec la clé de <racine>/zernio-lecture.env (cles.sh zernio-lecture), passée au seul
      // appel `zernio.py --compte <compte> stats` (stats.mjs). Sans cette clé : le fichier de stats, comme avant.
      lecture: lectureDuClient(client),
      // Lot 11 : compteur des visites des ressources gratuites (null : le client n'en a pas).
      visitesRessources: brut.stats?.visites_ressources?.url ? {
        url: String(brut.stats.visites_ressources.url),
        debut: /^\d{4}-\d{2}-\d{2}$/.test(brut.stats.visites_ressources.debut || "") ? brut.stats.visites_ressources.debut : null,
        cleFichier: brut.stats.visites_ressources.cle_fichier ? etendre(brut.stats.visites_ressources.cle_fichier, maison) : null,
        cleVariable: brut.stats.visites_ressources.cle_variable || null,
      } : null,
    },
    maison,
  };
  return c;
}
