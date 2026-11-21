// Chez Romain (client par défaut) : son site des ressources est branché (21/11/2026), mais le mot en
// commentaire est posé par son serveur (« ressources.mot » : « serveur »). Le studio montre l'entrée
// « Ressources gratuites » (lien, état lu à l'adresse, suppression) ; au moment de poster, rien à choisir,
// et aucune règle n'est jamais écrite chez Zernio depuis le Mac (sa clé n'a pas le droit : 403).
// Les outils du dépôt sont des faux qui notent leurs appels (même sortie que outils/ressource.py de Romain).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

delete process.env.STUDIO_CLIENT;
const { demarrer } = await import("../studio.mjs");
const { monde } = await import("./aide.mjs");
const { configBrute } = await import("../publication.mjs");

const SITE = "https://ressources.fitavecromain.com";
const FAUX = String.raw`#!/usr/bin/env python3
import json, os, sys, shutil
outil = os.path.basename(sys.argv[0])
with open(os.environ["FAUX_OUTILS_LOG"], "a") as f:
    f.write(json.dumps({"outil": outil, "argv": sys.argv[1:],
                        "ecriture": [k for k in os.environ if k.startswith("ZERNIO_ECRITURE")]}) + "\n")
d = os.environ["FAUX_DEPOT"]
cmd = sys.argv[1]
if outil == "ressource.py" and cmd == "lister":
    mots = json.load(open(os.path.join(d, "publications", "a-brancher.json"))).get("mots", {})
    def serveur(slug):
        return [{"contenu": c, "mot": e["mot"], "statut": e["statut"], "prevu_le": e.get("prevu_le"),
                 "branche_le": e.get("branche_le"), "video": e.get("video")}
                for c, e in sorted(mots.items()) if e.get("lien") == "${SITE}/%s/" % slug]
    res = []
    for slug, titre, mot in (("routine-du-soir", "Ta routine du soir", "SOIREE"), ("liste-courses", "Ta liste de courses", "COURSES")):
        if os.path.exists(os.path.join(d, "site", slug, "index.html")):
            res.append({"slug": slug, "titre": titre, "statut": "validée par Romain le 20/11/2026", "fiche": True,
                        "brouillon": False, "page_en_ligne": True, "en_ligne": True, "valide": True, "mot": mot,
                        "lien": "${SITE}/%s/" % slug, "message": "Salut {{first_name}}, la voilà.", "bouton": "Ouvrir",
                        "mot_serveur": serveur(slug),
                        "en_ligne_reel": {"etat": "en_ligne", "code": "OK", "detail": "", "http": 200}})
    print(json.dumps({"version": 1, "site": "${SITE}", "ressources": res}))
elif outil == "ressource.py" and cmd == "supprimer":
    shutil.rmtree(os.path.join(d, "site", sys.argv[2]), ignore_errors=True)
    print("OK supprimée %s" % sys.argv[2])
else:
    print("BLOQUE INCONNU")
    sys.exit(2)
`;

let m, s, port, cookie, journal;

function requete(chemin, { methode = "GET", corps } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: chemin, method: methode, headers: { Host: `127.0.0.1:${port}`, ...(cookie ? { Cookie: cookie } : {}),
      ...(methode !== "GET" ? { Origin: `http://127.0.0.1:${port}`, "Content-Type": "application/json" } : {}) } }, (res) => {
      const morceaux = [];
      res.on("data", (x) => morceaux.push(x));
      res.on("end", () => {
        const texte = Buffer.concat(morceaux).toString("utf8");
        let json = null;
        try { json = JSON.parse(texte); } catch { /* pas du JSON */ }
        resolve({ statut: res.statusCode, entetes: res.headers, texte, json });
      });
    });
    req.on("error", reject);
    if (corps !== undefined) req.write(JSON.stringify(corps));
    req.end();
  });
}

const appels = () => { try { return fs.readFileSync(journal, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };

before(async () => {
  // Comme le studio installé chez Romain avant le 21/11/2026 : « apercu_ressources: null » écrit dans son fichier.
  m = monde({ config: { apercu_ressources: null } });
  journal = path.join(m.racine, "outils.jsonl");
  for (const n of ["ressource.py", "zernio.py"]) m.ecrire(`depot/outils/${n}`, FAUX);
  process.env.FAUX_OUTILS_LOG = journal;
  process.env.FAUX_DEPOT = m.depot;
  m.contenu("un-reel", { titre: "Un reel" });
  m.contenu("routine-du-soir", { titre: "Ta routine du soir (reel)" });
  m.ecrire("depot/contenus/routine-du-soir/script.md", "# Script\n");
  m.ecrire("depot/contenus/routine-du-soir/ressource.md", "# Ressource gratuite : Ta routine du soir\n");
  m.ecrire("depot/site/routine-du-soir/index.html", "<!doctype html><title>Ta routine du soir</title>\n");
  m.ecrire("depot/contenus/liste-courses/ressource.md", "# Ressource gratuite : Ta liste de courses\n");
  m.ecrire("depot/site/liste-courses/index.html", "<!doctype html><title>Ta liste de courses</title>\n");
  m.json("depot/publications/a-brancher.json", { version: 1, mots: {
    "routine-du-soir": { mot: "SOIREE", lien: `${SITE}/routine-du-soir/`, statut: "en attente", prevu_le: "2026-11-24" },
  } });
  s = await demarrer({ env: { ...m.env, FAUX_OUTILS_LOG: journal, FAUX_DEPOT: m.depot }, silencieux: true });
  port = s.config.port;
  const r = await requete(`/?t=${s.jeton}`);
  cookie = r.entetes["set-cookie"][0].split(";")[0];
});

after(async () => {
  await s?.arreter("fin");
  m?.nettoyer();
});

test("Romain : son site rattrape une configuration écrite avant (apercu_ressources: null), mot posé par le serveur", async () => {
  assert.equal(s.config.client.id, "romain");
  assert.equal(JSON.parse(fs.readFileSync(path.join(m.home, "studio.config.json"), "utf8")).apercu_ressources, null);
  assert.equal(s.config.apercuRessources, SITE);
  assert.equal(s.config.ressourcesMot, "serveur");
  assert.equal(s.config.stats.visitesRessources, null, "pas de compteur de visites chez Romain");
  const e = (await requete("/api/etat")).json;
  assert.equal(e.config.ressources, true);
  assert.equal(e.config.ressources_mot, "serveur");
  const c = e.cartes.find((x) => x.slug === "routine-du-soir");
  assert.ok(c.fichiers.includes("ressource"), "fichier « Ressource gratuite » dans le dossier du contenu");
  assert.ok(!e.cartes.some((x) => x.slug === "liste-courses"), "une ressource seule vit dans « Ressources gratuites »");
});

test("Romain : la liste montre le lien, l'état lu à l'adresse et ce que fait le serveur du mot ; jamais Zernio", async () => {
  const n = appels().length;
  const r = await requete("/api/ressources");
  assert.equal(r.statut, 200, r.texte);
  const par = Object.fromEntries(r.json.ressources.map((x) => [x.slug, x]));
  const a = par["routine-du-soir"];
  assert.equal(a.lien, `${SITE}/routine-du-soir/`);
  assert.equal(a.etat, "en_ligne");
  assert.equal(a.mot, "SOIREE");
  assert.equal(a.message, "Salut [son prénom], la voilà.");
  assert.equal(a.prete, false, "rien à choisir au moment de poster");
  assert.equal(a.mot_serveur.etat, "en_attente");
  assert.match(a.mot_serveur.texte, /se branchera tout seul sur ta vidéo/);
  assert.equal(a.posts.length, 1);
  assert.equal(a.posts[0].titre, "Ta routine du soir (reel)");
  assert.match(a.posts[0].libelle, /mot SOIREE en attente/);
  assert.equal(a.garder, "Je la garde : le mot SOIREE attend ta vidéo « Ta routine du soir (reel) » pour envoyer son lien. Sans elle, ceux qui le commenteront tomberaient sur une page qui n'existe plus.");
  assert.equal(par["liste-courses"].garder, null);
  assert.equal(par["liste-courses"].mot_serveur.etat, "libre");
  const faits = appels().slice(n);
  assert.deepEqual(faits.map((x) => `${x.outil} ${x.argv[0]}`), ["ressource.py lister"], "zernio.py n'est pas lancé");
});

test("Romain : au moment de poster, ni liste de ressources, ni --ressource, ni « Brancher le mot »", async () => {
  assert.equal(configBrute(s.config).ressources, false);
  const c = await s.app.publication.choixRessources();
  assert.deepEqual(c, { ressources: null, note: null });
  const n = appels().length;
  const p = await requete("/api/publication/poser-mot", { methode: "POST", corps: { slug: "routine-du-soir", ressource: "routine-du-soir" } });
  assert.equal(p.statut, 404, p.texte);
  assert.ok(!appels().slice(n).some((x) => x.outil === "zernio.py"), "aucun appel Zernio depuis le Mac");
});

test("Romain : supprimer est refusé tant que le mot attend sa vidéo, permis sinon, sans variable d'écriture", async () => {
  const r = await requete("/api/ressources/routine-du-soir/supprimer", { methode: "POST", corps: {} });
  assert.equal(r.statut, 409, r.texte);
  assert.match(r.json.message, /^Je la garde : le mot SOIREE attend ta vidéo/);
  assert.ok(!appels().some((x) => x.argv[0] === "supprimer"), "refusé avant l'outil");
  const ok = await requete("/api/ressources/liste-courses/supprimer", { methode: "POST", corps: {} });
  assert.equal(ok.statut, 200, ok.texte);
  const a = appels().filter((x) => x.argv[0] === "supprimer").at(-1);
  assert.deepEqual(a.argv, ["supprimer", "liste-courses", "--oui", "--pousser"]);
  assert.deepEqual(a.ecriture, []);
  assert.ok(!fs.existsSync(path.join(m.depot, "site", "liste-courses")));
});

test("Romain : un dépôt sans l'outil des ressources donne une liste vide, sans erreur", async () => {
  const f = path.join(m.depot, "outils", "ressource.py");
  const avant = fs.readFileSync(f);
  fs.unlinkSync(f);
  try {
    const r = await requete("/api/ressources");
    assert.equal(r.statut, 200, r.texte);
    assert.deepEqual(r.json.ressources, []);
  } finally {
    fs.writeFileSync(f, avant);
  }
});

test("Romain : « préviens Yoan » reste tel quel", async () => {
  const r = await requete("/api/cartes/inconnu-du-tout");
  assert.equal(r.statut, 404);
  const { adresser } = await import("../client.mjs");
  assert.equal(adresser("Réessaie, et si ça recommence, préviens Yoan."), "Réessaie, et si ça recommence, préviens Yoan.");
});
