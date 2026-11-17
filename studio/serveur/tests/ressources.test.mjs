// Ressources gratuites dans le studio (studio de Yoan, lot 4B) et phrases adressées au client quand il
// est son propre contact. STUDIO_CLIENT=yoan dans tout ce fichier. Les outils du dépôt sont des faux
// (outils/ressource.py, outils/zernio.py) qui notent leurs appels : aucune mise en ligne, aucun réseau.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

process.env.STUDIO_CLIENT = "yoan";
const { adresser, contactEstLeClient } = await import("../client.mjs");
const { demarrer } = await import("../studio.mjs");
const { monde, attendreQue, vivant } = await import("./aide.mjs");

const FAUX = String.raw`#!/usr/bin/env python3
import json, os, sys, time
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
         "apercu": "/le-carnet/", "verification": {"ok": True, "lignes": []}}]}))
elif outil == "zernio.py" and cmd == "ressources":
    print(json.dumps({"version": 1, "ressources": [
        {"slug": "messages-a-23h", "titre": "Ressource gratuite : Le tableur", "mot": "TABLEUR", "lien": None, "bouton": None,
         "message": None, "valide": False, "statut": "à vérifier", "en_ligne": False, "prete": False,
         "problemes": ["message pas validé par Yoan (ligne « Validé par Yoan » vide)"]},
        {"slug": "le-carnet", "titre": "Le carnet", "mot": "CARNET", "lien": "https://ressources.yoanmottier.com/le-carnet/",
         "bouton": "Ouvrir", "message": "Voici le carnet.", "valide": True, "statut": "en ligne le 10/11/2026",
         "en_ligne": True, "prete": True, "problemes": []}]}))
elif outil == "ressource.py" and cmd == "apercu":
    print(json.dumps({"slug": sys.argv[2], "apercu": "/_brouillons/%s/" % sys.argv[2]}))
elif outil == "ressource.py" and cmd == "servir":
    print("APERCU http://127.0.0.1:45999/", flush=True)
    time.sleep(120)
elif outil == "ressource.py" and cmd == "mettre-en-ligne":
    print("OK en ligne https://ressources.yoanmottier.com/%s/" % sys.argv[2])
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
  m = monde({ config: { prenom: undefined, ressources_attente_s: 0 } });
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

test("serveur yoan : liste fusionnée, phrases claires, posts reliés ; rien ne part en ligne sans le clic", async () => {
  const r = await requete("/api/ressources");
  assert.equal(r.statut, 200, r.texte);
  const l = r.json.ressources;
  assert.deepEqual(l.map((x) => x.slug), ["le-carnet", "messages-a-23h", "exemple-seul"]);
  const tableur = l.find((x) => x.slug === "messages-a-23h");
  assert.equal(tableur.etat, "a_verifier");
  assert.equal(tableur.peut_mettre_en_ligne, true);
  assert.equal(tableur.contenu.titre, "Tes messages de 23 h");
  assert.deepEqual(tableur.problemes, ["Tu n'as pas encore validé le message que reçoivent ceux qui commentent."]);
  const seul = l.find((x) => x.slug === "exemple-seul");
  assert.equal(seul.etat, "a_finir");
  assert.equal(seul.peut_mettre_en_ligne, false);
  assert.equal(seul.contenu, null);
  assert.deepEqual(seul.a_corriger, ["La page porte encore le bandeau « Exemple »."]);
  const carnet = l.find((x) => x.slug === "le-carnet");
  assert.equal(carnet.prete, true);
  assert.equal(carnet.titre, "Le carnet");
  assert.deepEqual(carnet.posts.map((p) => [p.slug, p.regle]), [["le-carnet", "posee"]]);
  assert.ok(!appels().some((a) => a.argv[0] === "mettre-en-ligne"), "aucune mise en ligne sans clic");
  assert.ok(appels().every((a) => !a.ecriture.length), "jamais de variable d'écriture Zernio");
});

test("serveur yoan : aperçu servi par un seul processus, arrêté avec le studio", async () => {
  const a = await requete("/api/ressources/messages-a-23h/apercu");
  assert.equal(a.statut, 200, a.texte);
  assert.equal(a.json.url, "http://127.0.0.1:45999/_brouillons/messages-a-23h/");
  await requete("/api/ressources/messages-a-23h/apercu");
  const servirs = appels().filter((x) => x.argv[0] === "servir");
  assert.equal(servirs.length, 1, "un seul serveur d'aperçu");
  assert.ok(vivant(servirs[0].pid));
});

test("serveur yoan : « Je l'ai vérifiée, mets-la en ligne » lance la mise en ligne, avec --oui, au clic seulement", async () => {
  const r = await requete("/api/ressources/messages-a-23h/mettre-en-ligne", { methode: "POST", corps: {} });
  assert.equal(r.statut, 200, r.texte);
  assert.equal(r.json.statut, "en_ligne");
  const a = appels().filter((x) => x.argv[0] === "mettre-en-ligne");
  assert.equal(a.length, 1);
  assert.deepEqual(a[0].argv, ["mettre-en-ligne", "messages-a-23h", "--oui", "--pousser"]);
  assert.equal((await requete("/api/ressources/x/mettre-en-ligne", { methode: "GET" })).statut, 404, "jamais par une simple lecture");
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

test("serveur yoan : arrêt du studio = arrêt du serveur d'aperçu", async () => {
  const pid = appels().find((x) => x.argv[0] === "servir").pid;
  await s.arreter("fin");
  s = null;
  await attendreQue(() => !vivant(pid), { delaiMs: 5000 });
});
