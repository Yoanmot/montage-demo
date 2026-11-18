// Ressources gratuites dans le studio (studio de Yoan, lot 4B, puis « ressources directes » du
// 18/11/2026 : plus d'aperçu ni de bouton de mise en ligne, état lu à l'adresse de la page) et phrases
// adressées au client quand il est son propre contact. STUDIO_CLIENT=yoan dans tout ce fichier. Les
// outils du dépôt sont des faux (outils/ressource.py, outils/zernio.py) qui notent leurs appels : aucune
// mise en ligne, aucun réseau.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

process.env.STUDIO_CLIENT = "yoan";
const { adresser, contactEstLeClient } = await import("../client.mjs");
const { demarrer } = await import("../studio.mjs");
const { monde } = await import("./aide.mjs");

const FAUX = String.raw`#!/usr/bin/env python3
import json, os, sys
outil = os.path.basename(sys.argv[0])
with open(os.environ["FAUX_OUTILS_LOG"], "a") as f:
    f.write(json.dumps({"outil": outil, "argv": sys.argv[1:], "pid": os.getpid(),
                        "ecriture": [k for k in os.environ if k.startswith("ZERNIO_ECRITURE")]}) + "\n")
mode = open(os.environ["FAUX_OUTILS_MODE"]).read().strip() if os.path.exists(os.environ["FAUX_OUTILS_MODE"]) else ""
if mode == "muet":
    sys.exit(1)
cmd = sys.argv[1]
if outil == "ressource.py" and cmd == "lister":
    print(json.dumps({"version": 1, "site": "https://ressources.yoanmottier.com", "ressources": [
        {"slug": "messages-a-23h", "titre": "Le tableur", "statut": "à vérifier", "fiche": True, "brouillon": True,
         "page_en_ligne": False, "en_ligne": False, "mot": "TABLEUR", "lien": "https://ressources.yoanmottier.com/messages-a-23h/",
         "apercu": "/_brouillons/messages-a-23h/", "verification": {"ok": True, "lignes": []}, "avant_en_ligne": {"ok": True, "raisons": []}},
        {"slug": "exemple-seul", "titre": "Un exemple", "statut": "exemple", "fiche": True, "brouillon": True,
         "page_en_ligne": False, "en_ligne": False, "mot": None, "lien": "https://ressources.yoanmottier.com/exemple-seul/",
         "apercu": "/_brouillons/exemple-seul/", "verification": {"ok": True, "lignes": []},
         "avant_en_ligne": {"ok": False, "raisons": ["la page porte encore le bandeau « Exemple »"]}},
        {"slug": "le-carnet", "titre": "Le carnet", "statut": "en ligne le 10/11/2026", "fiche": True, "brouillon": False,
         "page_en_ligne": True, "en_ligne": True, "mot": "CARNET", "lien": "https://ressources.yoanmottier.com/le-carnet/",
         "apercu": "/le-carnet/", "verification": {"ok": True, "lignes": []},
         "en_ligne_reel": {"etat": "en_ligne", "code": "OK", "detail": "", "http": 200}},
        {"slug": "la-grille", "titre": "La grille", "statut": "en ligne le 18/11/2026", "fiche": True, "brouillon": False,
         "page_en_ligne": True, "en_ligne": True, "mot": "GRILLE", "lien": "https://ressources.yoanmottier.com/la-grille/",
         "apercu": "/la-grille/", "verification": {"ok": True, "lignes": []},
         "en_ligne_reel": {"etat": "erreur", "code": "VERCEL_REFUS", "detail": "Deployment was blocked", "http": 404}},
        {"slug": "le-plan", "titre": "Le plan", "statut": "en ligne le 18/11/2026", "fiche": True, "brouillon": False,
         "page_en_ligne": True, "en_ligne": True, "mot": "PLANNING", "lien": "https://ressources.yoanmottier.com/le-plan/",
         "apercu": "/le-plan/", "verification": {"ok": True, "lignes": []},
         "en_ligne_reel": {"etat": "mise_a_jour", "code": "EN_COURS", "detail": "envoyée", "http": 200}}]}))
elif outil == "zernio.py" and cmd == "ressources":
    print(json.dumps({"version": 1, "ressources": [
        {"slug": "messages-a-23h", "titre": "Ressource gratuite : Le tableur", "mot": "TABLEUR", "lien": None, "bouton": None,
         "message": None, "valide": False, "statut": "à vérifier", "en_ligne": False, "prete": False,
         "problemes": ["message pas validé par Yoan (ligne « Validé par Yoan » vide)"]},
        {"slug": "le-carnet", "titre": "Le carnet", "mot": "CARNET", "lien": "https://ressources.yoanmottier.com/le-carnet/",
         "bouton": "Ouvrir", "message": "Voici le carnet.", "valide": True, "statut": "en ligne le 10/11/2026",
         "en_ligne": True, "prete": True, "problemes": []},
        {"slug": "la-grille", "titre": "La grille", "mot": "GRILLE", "lien": "https://ressources.yoanmottier.com/la-grille/",
         "bouton": "Ouvrir", "message": "Voici la grille.", "valide": True, "statut": "en ligne le 18/11/2026",
         "en_ligne": True, "prete": True, "problemes": []}]}))
else:
    print("BLOQUE INCONNU")
    sys.exit(2)
`;

let m, s, port, cookie, journal, modeFichier;

function requete(chemin, { methode = "GET", corps } = {}) {
  return new Promise((resolve, reject) => {
    const brut = corps === undefined ? null : JSON.stringify(corps);
    const req = http.request({ host: "127.0.0.1", port, path: chemin, method: methode, headers: {
      Host: `127.0.0.1:${port}`, ...(cookie ? { Cookie: cookie } : {}),
      ...(methode !== "GET" ? { Origin: `http://127.0.0.1:${port}`, "Content-Type": "application/json" } : {}),
    } }, (res) => {
      const morceaux = [];
      res.on("data", (x) => morceaux.push(x));
      res.on("end", () => {
        const texte = Buffer.concat(morceaux).toString("utf8");
        let json = null; try { json = JSON.parse(texte); } catch { /* pas du JSON */ }
        resolve({ statut: res.statusCode, entetes: res.headers, texte, json });
      });
    });
    req.on("error", reject);
    if (brut) req.write(brut);
    req.end();
  });
}

const appels = () => (fs.existsSync(journal) ? fs.readFileSync(journal, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);

before(async () => {
  m = monde({ config: { prenom: undefined } });
  journal = path.join(m.racine, "outils.jsonl");
  modeFichier = path.join(m.racine, "mode");
  m.env.FAUX_OUTILS_LOG = journal;
  m.env.FAUX_OUTILS_MODE = modeFichier;
  process.env.FAUX_OUTILS_LOG = journal;
  process.env.FAUX_OUTILS_MODE = modeFichier;
  for (const n of ["ressource.py", "zernio.py"]) m.ecrire(`depot/outils/${n}`, FAUX);
  // Un reel avec sa ressource ; une ressource seule (pas de dossier de contenu) ; un post qui offre le carnet.
  m.contenu("messages-a-23h", { titre: "Tes messages de 23 h" });
  m.ecrire("depot/contenus/messages-a-23h/ressource.md", "# Le tableur\n\n- Statut : à vérifier\n");
  m.ecrire("depot/site/_brouillons/messages-a-23h/index.html", "<!doctype html>\n");
  m.ecrire("depot/contenus/exemple-seul/ressource.md", "# Un exemple\n");
  m.contenu("le-carnet", { titre: "Le carnet de séance" });
  m.ecrire("depot/contenus/le-carnet/ressource.md", "# Le carnet\n\n- Statut : en ligne le 10/11/2026\n");
  m.ecrire("depot/site/le-carnet/index.html", "<!doctype html>\n");
  m.json("depot/publications/registre.json", { version: 1, publications: {
    "le-carnet": { statut: "programmé", prevu_le: "2026-12-01 18:30", ressource: "le-carnet", mot: "CARNET",
      regle_mot: { id: "r1", cible: "postId", valeur: "6aa000000000000000000001", mot: "CARNET" } },
  } });
  s = await demarrer({ env: m.env, silencieux: true });
  port = s.config.port;
  const r = await requete(`/?t=${s.jeton}`);
  cookie = r.entetes["set-cookie"][0].split(";")[0];
});

after(async () => {
  await s?.arreter("fin");
  m?.nettoyer();
});

test("phrases : le client qui est son propre contact n'est jamais prié de se prévenir lui-même", () => {
  const yoan = { prenom: "Yoan", contact: "Yoan" };
  const romain = { prenom: "Romain", contact: "Yoan" };
  assert.ok(contactEstLeClient(yoan));
  assert.ok(!contactEstLeClient(romain));
  const textes = [
    "Ça n'a pas marché. Réessaie, et si ça recommence, préviens Yoan.",
    "Il y a eu un souci pendant l'envoi : je ne sais pas si c'est parti. Ne relance pas, préviens Yoan avec le message ci-dessous.",
    "Ce contenu ne peut pas partir pour l'instant : préviens Yoan avec le message ci-dessous.",
    "Ton studio n'est plus connecté à ton compte Claude. Préviens Yoan : la reconnexion prend deux minutes.",
    "Ce contenu est déjà programmé (le 3 mai). Pour le décaler, préviens Yoan.",
    "Un point est à vérifier sur ce contenu : préviens Yoan si tu as un doute.",
    "Une modification faite ailleurs ne se raccorde pas à celle de ton Mac. Rien n'est perdu : préviens Yoan.",
    "Je n'arrive pas à démarrer l'assistant sur ce Mac. Préviens Yoan.",
  ];
  for (const t of textes) {
    const a = adresser(t, yoan);
    assert.ok(!/réviens/.test(a), a);
    assert.ok(!a.includes('"') && !a.includes("\\"), "utilisable dans du JSON déjà écrit");
    assert.equal(adresser(t, romain), t, "Romain : rien ne change");
  }
  assert.equal(adresser(JSON.stringify({ message: textes[0] }), yoan), JSON.stringify({ message: adresser(textes[0], yoan) }));
});

test("serveur yoan : ressources dans l'état, fichier « Ressource gratuite » dans le dossier, ressource seule hors de l'arborescence", async () => {
  const e = (await requete("/api/etat")).json;
  assert.equal(e.config.ressources, true);
  const slugs = e.cartes.map((c) => c.slug);
  assert.ok(!slugs.includes("exemple-seul"), "une ressource seule vit dans « Ressources gratuites »");
  const c = e.cartes.find((x) => x.slug === "messages-a-23h");
  assert.ok(c.fichiers.includes("ressource"), c.fichiers.join(","));
  assert.equal(c.ressource, "brouillon");
  assert.equal(e.cartes.find((x) => x.slug === "le-carnet").ressource, "en_ligne");
});

test("serveur yoan : liste fusionnée, état lu à l'adresse, phrases claires, posts reliés", async () => {
  const r = await requete("/api/ressources");
  assert.equal(r.statut, 200, r.texte);
  const lister = appels().filter((a) => a.outil === "ressource.py" && a.argv[0] === "lister");
  assert.ok(lister.length && lister.every((a) => a.argv.includes("--en-ligne")), "la page est lue à son adresse");
  const l = r.json.ressources;
  assert.deepEqual(l.map((x) => x.slug), ["la-grille", "le-plan", "le-carnet", "messages-a-23h", "exemple-seul"]);
  const tableur = l.find((x) => x.slug === "messages-a-23h");
  assert.equal(tableur.etat, "en_preparation");
  assert.ok(!("peut_mettre_en_ligne" in tableur), "plus de bouton de mise en ligne");
  assert.equal(tableur.contenu.titre, "Tes messages de 23 h");
  assert.deepEqual(tableur.problemes, ["Tu n'as pas encore validé le message que reçoivent ceux qui commentent."]);
  const seul = l.find((x) => x.slug === "exemple-seul");
  assert.equal(seul.etat, "en_preparation");
  assert.equal(seul.contenu, null);
  assert.deepEqual(seul.a_corriger, ["La page porte encore le bandeau « Exemple »."]);
  const carnet = l.find((x) => x.slug === "le-carnet");
  assert.equal(carnet.etat, "en_ligne");
  assert.equal(carnet.en_ligne_reel.http, 200);
  assert.equal(carnet.prete, true);
  assert.equal(carnet.titre, "Le carnet");
  assert.deepEqual(carnet.posts.map((p) => [p.slug, p.regle]), [["le-carnet", "posee"]]);
  const grille = l.find((x) => x.slug === "la-grille");
  assert.equal(grille.etat, "erreur");
  assert.match(grille.en_ligne_reel.texte, /refusé la dernière version/);
  assert.equal(grille.en_ligne_reel.detail, "Deployment was blocked");
  assert.equal(grille.prete, false, "une page qui ne répond pas ne s'offre pas sur un post");
  assert.equal(l.find((x) => x.slug === "le-plan").etat, "mise_a_jour");
  assert.ok(appels().every((a) => !a.ecriture.length), "jamais de variable d'écriture Zernio");
});

test("serveur yoan : plus d'aperçu ni de mise en ligne depuis le studio", async () => {
  assert.equal((await requete("/api/ressources/messages-a-23h/apercu")).statut, 404);
  const r = await requete("/api/ressources/messages-a-23h/mettre-en-ligne", { methode: "POST", corps: {} });
  assert.equal(r.statut, 404, r.texte);
  assert.ok(!appels().some((a) => ["mettre-en-ligne", "servir", "apercu"].includes(a.argv[0])), "aucun outil d'écriture ni d'aperçu");
});

test("serveur yoan : un souci affiché à Yoan ne lui dit pas de se prévenir lui-même", async () => {
  fs.writeFileSync(modeFichier, "muet");
  try {
    const r = await requete("/api/ressources");
    assert.equal(r.statut, 503);
    assert.ok(!/réviens/.test(r.json.message), r.json.message);
    assert.match(r.json.message, /souci du studio à corriger/);
  } finally {
    fs.unlinkSync(modeFichier);
  }
});
