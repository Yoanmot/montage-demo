// Configuration du studio (contrat, section 7) : STUDIO_HOME/studio.config.json, créé depuis
// CODE/studio.config.exemple.json s'il manque. Aucune clé ici.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { etendre, lireJson, ecrireJson } from "./outils.mjs";

export const CODE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function studioHome(env = process.env) {
  return etendre(env.STUDIO_HOME || "~/.montage-yoan/studio");
}

const DEFAUTS = lireJson(path.join(CODE, "studio.config.exemple.json"), {});

function fusion(base, ajout) {
  if (!ajout || typeof ajout !== "object" || Array.isArray(ajout)) return ajout ?? base;
  const r = { ...(base || {}) };
  for (const [k, v] of Object.entries(ajout)) {
    r[k] = v && typeof v === "object" && !Array.isArray(v) ? fusion(base?.[k], v) : v;
  }
  return r;
}

export function chargerConfig({ home = studioHome(), env = process.env } = {}) {
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
    prenom: brut.prenom || "",
    port: Number(env.STUDIO_PORT || brut.port || 4747),
    depot: etendre(brut.depot_hoc, maison),
    // Copie du dépôt gérée par les scripts du Mac (zernio.py, a-rendre.py) : ils l'alignent de force
    // sur le dépôt en ligne, donc ils n'y tournent que là, jamais dans DEPOT (contrat, section 12).
    depotMac: etendre(brut.depot_mac || "~/.montage-yoan/head-of-content", maison),
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
    claude: {
      binaire: env.STUDIO_CLAUDE || brut.claude?.binaire || "claude",
      modele: brut.claude?.modele || null,
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
      instagramEnSimulation: env.STUDIO_STATS_INSTAGRAM === "1",
    },
    maison,
  };
  return c;
}
