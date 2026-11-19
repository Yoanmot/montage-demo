#!/usr/bin/env node
// Point d'entrée du studio : lit STUDIO_HOME/studio.config.json (créé depuis l'exemple s'il
// manque), lit ou crée le jeton (droits 0600, gardé entre deux démarrages), lance la synchro, la file, le serveur, et
// affiche l'adresse à ouvrir. SIGTERM / SIGINT : tue tous les groupes de processus, puis sort.
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chargerConfig, studioHome } from "./config.mjs";
import fs from "node:fs";
import { creerJournal, ecrireTexte, lireTexte } from "./outils.mjs";
import { Pont } from "./pont.mjs";
import { File } from "./file.mjs";
import { Synchro } from "./synchro.mjs";
import { creerServeur } from "./serveur.mjs";
import { toutTuer } from "./commandes.mjs";
import { configBrute } from "./publication.mjs";
import { actualiserPublications } from "../publication/publication.mjs";

// Le jeton est gardé d'un démarrage à l'autre (contrat, section 8) : une fenêtre ouverte reste
// connectée après une mise à jour. Créé seulement s'il manque ou s'il est illisible.
export function jetonDuStudio(home) {
  const fichier = path.join(home, "jeton");
  const lu = (lireTexte(fichier, "") || "").trim();
  if (/^[0-9a-f]{64}$/.test(lu)) {
    try { fs.chmodSync(fichier, 0o600); } catch { /* droits déjà posés */ }
    return lu;
  }
  const jeton = crypto.randomBytes(32).toString("hex");
  ecrireTexte(fichier, jeton + "\n", 0o600);
  return jeton;
}

export async function demarrer({ env = process.env, silencieux = false } = {}) {
  const home = studioHome(env);
  const config = chargerConfig({ home, env });
  const journal = creerJournal(path.join(home, "serveur.log"));
  const jeton = jetonDuStudio(home);

  const synchro = new Synchro({ depot: config.depot, journal });
  const pont = new Pont({ config, journal });
  // Avant chaque action : tirer, et renvoyer ce qui serait resté hors ligne (une mise en page tourne
  // dans la copie des scripts du Mac, qui ne voit que le dépôt en ligne).
  const file = new File({ config, pont, journal, avant: () => synchro.pousser() }).charger();
  const app = creerServeur({ config, jeton, pont, file, synchro, journal });
  await app.ecouter();
  const url = `http://127.0.0.1:${config.port}/?t=${jeton}`;
  journal("demarrage", { port: config.port, simulation: config.simulation });
  if (!silencieux) {
    console.log(`Studio prêt sur http://127.0.0.1:${config.port}/`);
    console.log(`Ouvrir : ${url}`);
  }
  synchro.demarrer(config.synchroMinutes).finally(() => file.tick());
  // Après chaque synchro : une publication partie tout de suite et encore en préparation chez Instagram
  // est relue, puis notée publiée (le contenu passe « publié » dans le studio).
  synchro.on("sync", (e) => {
    if (e.etat !== "ok") return;
    actualiserPublications(configBrute(config)).then((r) => {
      if (r) journal("publications_actualisees", { code: r.code, lignes: (r.sortie.match(/^ACTUALISE .*/gm) || []).length });
      if (r && /^ACTUALISE /m.test(r.sortie)) synchro.tirer();
    }).catch(() => {});
  });

  let arret = null;
  const arreter = (raison = "arret") => {
    if (!arret) {
      arret = (async () => {
        journal("arret", { raison });
        synchro.arreter();
        await pont.toutArreter();
        toutTuer();
        await app.fermer();
      })();
    }
    return arret;
  };
  return { config, jeton, url, pont, file, synchro, app, arreter };
}

const direct = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (direct) {
  demarrer().then((s) => {
    for (const sig of ["SIGTERM", "SIGINT"]) {
      process.on(sig, () => {
        s.arreter(sig).finally(() => process.exit(0));
      });
    }
  }).catch((e) => {
    console.error(`Le studio n'a pas pu démarrer : ${e.code === "EADDRINUSE" ? "le port est déjà pris (un autre studio tourne ?)" : e.message}`);
    process.exit(1);
  });
}
