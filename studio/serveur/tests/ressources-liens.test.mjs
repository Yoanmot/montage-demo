// Une ressource gratuite reliée à ses contenus (22/11/2026) : la ressource apparaît dans le dossier de chaque
// contenu relié, se relie et se délie depuis là, chaque contenu a son mot et son message (retouchables dans son
// dossier et au récapitulatif), le récapitulatif la choisit d'office, la suppression reste refusée tant qu'un
// post l'offre. STUDIO_CLIENT=yoan. Les outils du dépôt sont des faux qui notent leurs appels : aucun réseau.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

process.env.STUDIO_CLIENT = "yoan";
const { demarrer } = await import("../studio.mjs");
const { monde } = await import("./aide.mjs");
const { raisonDeGarder } = await import("../ressources.mjs");

const FAUX = String.raw`#!/usr/bin/env python3
import json, os, sys
outil = os.path.basename(sys.argv[0])
entree = None
if "--depuis" in sys.argv:
    entree = json.load(open(sys.argv[sys.argv.index("--depuis") + 1], encoding="utf-8"))
with open(os.environ["FAUX_OUTILS_LOG"], "a") as f:
    f.write(json.dumps({"outil": outil, "argv": sys.argv[1:], "entree": entree,
                        "ecriture": [k for k in os.environ if k.startswith("ZERNIO_ECRITURE")]}) + "\n")
cmd = sys.argv[1]
D = os.environ["FAUX_DEPOT"]
def liee(c):
    try:
        return json.load(open(os.path.join(D, "contenus", c, "ressource-liee.json")))
    except Exception:
        return None
CONTENUS = {"reel-a": {"mot": "SOVO", "message": "Salut {{first_name}}, voici Sovo.", "bouton": "Télécharger", "valide": True, "propre": False},
            "reel-b": {"mot": "DICTEE", "message": "Salut {{first_name}}, voici la dictée.", "bouton": "Télécharger", "valide": False, "propre": True}}
if outil == "ressource.py" and cmd == "lister":
    print(json.dumps({"version": 1, "site": "https://ressources.yoanmottier.com", "ressources": [
        {"slug": "sovo", "titre": "Arrête de taper, parle", "statut": "en ligne le 22/11/2026", "fiche": True, "brouillon": False,
         "page_en_ligne": True, "en_ligne": True, "mot": "SOVO", "lien": "https://ressources.yoanmottier.com/sovo/",
         "apercu": "/sovo/", "verification": {"ok": True, "lignes": []}, "en_ligne_reel": {"etat": "en_ligne", "code": "OK", "detail": "", "http": 200}}]}))
elif outil == "zernio.py" and cmd == "ressources":
    contenus = []
    for c in sorted(os.listdir(os.path.join(D, "contenus"))):
        l = liee(c)
        if l and l.get("ressource") == "sovo":
            x = dict(CONTENUS.get(c, {"mot": "SOVO", "message": "Salut {{first_name}}, voici Sovo.", "bouton": "Télécharger", "valide": True, "propre": False}))
            x.update({"contenu": c, "empreinte": "sha256:%016x" % (len(c)), "offert": c == "reel-publie", "problemes": [] if x["valide"] else ["message pas validé par Yoan (ligne « Validé par Yoan » vide)"]})
            contenus.append(x)
    print(json.dumps({"version": 1, "liaisons": 1, "ressources": [
        {"slug": "sovo", "titre": "Ressource gratuite : Arrête de taper, parle", "mot": "SOVO", "lien": "https://ressources.yoanmottier.com/sovo/",
         "bouton": "Télécharger", "message": "Salut {{first_name}}, voici Sovo.", "valide": True, "empreinte": "sha256:0000000000000001",
         "statut": "en ligne le 22/11/2026", "en_ligne": True, "prete": True, "problemes": [], "contenus": contenus}]}))
elif outil == "zernio.py" and cmd == "relier":
    c, r = sys.argv[2], sys.argv[sys.argv.index("--ressource") + 1]
    if entree and entree.get("mot") == "MERCI":
        print("BLOQUE MESSAGE mot trop courant : MERCI s'écrit en commentaire sans avoir entendu l'appel, choisis un mot propre à la ressource")
        sys.exit(2)
    d = {"version": 1, "ressource": r}
    d.update({k: v for k, v in (entree or {}).items() if v})
    json.dump(d, open(os.path.join(D, "contenus", c, "ressource-liee.json"), "w"))
    print("OK liaison contenu=%s ressource=%s mot=%s" % (c, r, (entree or {}).get("mot") or "SOVO"))
elif outil == "zernio.py" and cmd == "delier":
    c = sys.argv[2]
    if c == "reel-publie":
        print("BLOQUE OFFERTE le post de reel-publie offre déjà sovo")
        sys.exit(2)
    os.remove(os.path.join(D, "contenus", c, "ressource-liee.json"))
    print("OK deliee contenu=%s" % c)
elif outil == "zernio.py" and cmd in ("verifier", "publier"):
    slug = sys.argv[2]
    res = sys.argv[sys.argv.index("--ressource") + 1] if "--ressource" in sys.argv else None
    mot = CONTENUS.get(slug, {}).get("mot", "SOVO") if res else None
    leg = "Commente %s et je te l'envoie." % (mot or "SOVO")
    print("CONTENU %s (reel) sur @ia.yoan" % slug)
    print("LEGENDE (contenus/%s/script.md, %d caractères) :" % (slug, len(leg)))
    print(leg)
    print("MOT %s" % (mot or "aucun"))
    if cmd == "verifier":
        print("OK prêt")
    else:
        print("SIMULATION_OK")
elif outil == "zernio.py" and cmd == "valider-message":
    print("OK liaison contenu=%s ressource=%s" % (sys.argv[sys.argv.index("--contenu") + 1] if "--contenu" in sys.argv else "-", sys.argv[2]))
else:
    print("BLOQUE INCONNU")
    sys.exit(2)
`;

let m, s, port, cookie, journal;

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
        resolve({ statut: res.statusCode, texte, json, entetes: res.headers });
      });
    });
    req.on("error", reject);
    if (brut) req.write(brut);
    req.end();
  });
}

const appels = () => (fs.existsSync(journal) ? fs.readFileSync(journal, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const carte = async (slug) => (await requete(`/api/cartes/${slug}`)).json;
const DANS_3_JOURS = new Date(Date.now() + 3 * 86400e3).toISOString().slice(0, 10);

before(async () => {
  m = monde({ config: { prenom: undefined } });
  journal = path.join(m.racine, "outils.jsonl");
  for (const e of [m.env, process.env]) Object.assign(e, { FAUX_OUTILS_LOG: journal, FAUX_DEPOT: m.depot });
  for (const n of ["ressource.py", "zernio.py"]) m.ecrire(`depot/outils/${n}`, FAUX);
  m.ecrire("depot/outils/liaison.py", "# l'outil de liaison est là\n");
  m.ecrire("copie-mac/outils/zernio.py", FAUX);
  // Une ressource seule (créée sous son propre nom), deux reels qui l'offrent, un reel sans ressource.
  m.ecrire("depot/contenus/sovo/ressource.md", "# Ressource gratuite : Arrête de taper, parle\n\n- Statut : en ligne le 22/11/2026\n");
  m.ecrire("depot/site/sovo/index.html", "<!doctype html>\n");
  for (const [slug, titre] of [["reel-a", "Ce coach bloqué en 2010"], ["reel-b", "Des mois sans clavier"], ["reel-c", "Un reel sans ressource"]]) {
    m.contenu(slug, { titre });
    m.ecrire(`depot/contenus/${slug}/script.md`, `# ${titre}\n\n## Légende\nCommente SOVO et je te l'envoie.\n`);
    m.ecrire(`Contenu/${slug}/face/rush-monte.mp4`, "video");
  }
  m.json("depot/contenus/reel-a/ressource-liee.json", { version: 1, ressource: "sovo" });
  m.json("depot/contenus/reel-b/ressource-liee.json", { version: 1, ressource: "sovo", mot: "DICTEE" });
  s = await demarrer({ env: m.env, silencieux: true });
  port = s.config.port;
  const r = await requete(`/?t=${s.jeton}`);
  cookie = r.entetes["set-cookie"][0].split(";")[0];
});

after(async () => {
  await s?.arreter("fin");
  m?.nettoyer();
});

test("dossier : la ressource reliée apparaît dans chaque contenu qui l'offre ; un contenu sans ressource peut en relier une", async () => {
  for (const slug of ["reel-a", "reel-b"]) {
    const c = await carte(slug);
    assert.ok(c.fichiers.includes("ressource"), slug);
    assert.equal(c.ressource, "en_ligne");
    assert.equal(c.ressource_slug, "sovo");
    assert.equal(c.ressource_url, "https://ressources.yoanmottier.com/sovo/");
  }
  const c = await carte("reel-c");
  assert.ok(c.fichiers.includes("ressource"));
  assert.equal(c.ressource, "aucune");
  assert.equal(c.ressource_slug, undefined);
});

test("liste : chaque contenu qui l'offre, avec son mot et son message ; on peut relier depuis le studio", async () => {
  const r = (await requete("/api/ressources")).json.ressources.find((x) => x.slug === "sovo");
  assert.equal(r.liaisons, true);
  assert.equal(r.contenu, null, "pas de dossier de contenu à elle");
  assert.deepEqual(r.contenus.map((x) => [x.slug, x.titre, x.mot, x.valide, x.propre]),
    [["reel-a", "Ce coach bloqué en 2010", "SOVO", true, false], ["reel-b", "Des mois sans clavier", "DICTEE", false, true]]);
  assert.equal(r.contenus[1].message, "Salut [son prénom], voici la dictée.");
});

test("relier puis délier depuis le dossier : l'outil écrit, rien chez Zernio, texte affiché transmis tel quel", async () => {
  const n = appels().length;
  const r = await requete("/api/ressources/relier", { methode: "POST", corps: { contenu: "reel-c", ressource: "sovo",
    mot: "parle", message: "Salut [son prénom], la voici.", bouton: "Ouvrir", empreinte: "sha256:0000000000000001" } });
  assert.equal(r.statut, 200, r.texte);
  const a = appels().slice(n).find((x) => x.argv[0] === "relier");
  assert.deepEqual(a.argv.slice(0, 5), ["relier", "reel-c", "--ressource", "sovo", "--pousser"]);
  assert.ok(a.argv.includes("--valider") && a.argv.includes("--empreinte"), a.argv.join(" "));
  assert.deepEqual(a.entree, { message: "Salut [son prénom], la voici.", bouton: "Ouvrir", mot: "parle" });
  assert.deepEqual(a.ecriture, [], "jamais l'autorisation d'écrire chez Zernio");
  assert.equal((await carte("reel-c")).ressource_slug, "sovo");
  // Un mot refusé par l'outil : une phrase claire, rien d'écrit.
  const x = await requete("/api/ressources/relier", { methode: "POST", corps: { contenu: "reel-c", ressource: "sovo", mot: "MERCI", message: "x", bouton: "y" } });
  assert.equal(x.statut, 409);
  assert.match(x.json.message, /trop courant/);
  assert.doesNotMatch(x.json.message, /zernio|BLOQUE|commentaire sans avoir/i);
  const d = await requete("/api/ressources/delier", { methode: "POST", corps: { contenu: "reel-c" } });
  assert.equal(d.statut, 200, d.texte);
  assert.equal((await carte("reel-c")).ressource, "aucune");
  // Un contenu dont le post l'offre ne se délie pas.
  m.contenu("reel-publie", { titre: "Déjà posté" });
  m.json("depot/contenus/reel-publie/ressource-liee.json", { version: 1, ressource: "sovo" });
  const o = await requete("/api/ressources/delier", { methode: "POST", corps: { contenu: "reel-publie" } });
  assert.equal(o.statut, 409);
  assert.match(o.json.message, /ton post l'offre déjà/);
  fs.rmSync(path.join(m.depot, "contenus", "reel-publie"), { recursive: true, force: true });
});

test("récapitulatif : la ressource reliée est choisie d'office, avec le mot et le message de CE contenu ; « Aucune » reste aucune", async () => {
  const r = await requete("/api/publication/recap", { methode: "POST", corps: { elements: [{ slug: "reel-b", quand: `${DANS_3_JOURS} 18:30` }] } });
  assert.equal(r.statut, 200, r.texte);
  const e = r.json.elements[0];
  assert.equal(e.ressource, "sovo");
  assert.equal(e.ressource_par_defaut, true);
  assert.deepEqual(e.message_dm, { mot: "DICTEE", message: "Salut [son prénom], voici la dictée.", bouton: "Télécharger", a_valider: true, mot_modifiable: true });
  const v = appels().filter((x) => x.argv[0] === "verifier" && x.argv[1] === "reel-b").pop();
  assert.ok(v.argv.includes("--ressource") && v.argv[v.argv.indexOf("--ressource") + 1] === "sovo");
  const sans = (await requete("/api/publication/recap", { methode: "POST", corps: { elements: [{ slug: "reel-b", quand: `${DANS_3_JOURS} 18:30`, ressource: "" }] } })).json.elements[0];
  assert.equal(sans.ressource, null);
  assert.equal(sans.message_dm, undefined);
});

test("récapitulatif : le mot et le message retouchés partent pour ce contenu seulement (valider-message --contenu), en simulation rien n'est écrit", async () => {
  const r = await requete("/api/publication/recap", { methode: "POST", corps: { elements: [{ slug: "reel-b", quand: `${DANS_3_JOURS} 18:30` }] } });
  const n = appels().length;
  const c = await requete("/api/publication/confirmer", { methode: "POST", corps: { recap_id: r.json.recap_id, plateformes: { "reel-b": ["instagram"] },
    textes: { "reel-b": { mot: "clavier", message: "Salut [son prénom], la dictée promise." } } } });
  assert.equal(c.statut, 200, c.texte);
  assert.equal(c.json.resultats[0].statut, "simulation", c.json.resultats[0].message);
  assert.match(c.json.resultats[0].message, /CLAVIER/);
  const v = appels().slice(n).find((x) => x.argv[0] === "valider-message");
  assert.deepEqual(v.argv.slice(0, 3), ["valider-message", "sovo", "--contenu"]);
  assert.equal(v.argv[3], "reel-b");
  assert.ok(v.argv.includes("--essai"), "simulation : contrôle seul");
  assert.deepEqual(v.entree, { message: "Salut [son prénom], la dictée promise.", mot: "CLAVIER" });
  const p = appels().slice(n).find((x) => x.argv[0] === "publier");
  const f = p.argv[p.argv.indexOf("--message-fichier") + 1];
  assert.ok(f, "publier lit le message retouché");
  // Un mot de mauvaise forme ne part pas.
  const r2 = await requete("/api/publication/recap", { methode: "POST", corps: { elements: [{ slug: "reel-b", quand: `${DANS_3_JOURS} 18:30` }] } });
  const c2 = await requete("/api/publication/confirmer", { methode: "POST", corps: { recap_id: r2.json.recap_id, plateformes: { "reel-b": ["instagram"] },
    textes: { "reel-b": { mot: "DICTÉE" } } } });
  assert.equal(c2.json.resultats[0].statut, "bloque");
  assert.match(c2.json.resultats[0].message, /5 à 14 lettres/);
});

test("supprimer : plusieurs posts, chacun son mot : la phrase cite chaque mot sous son post", () => {
  const t = raisonDeGarder([{ titre: "Ce coach bloqué", statut: "programmé", mot: "SOVO" }, { titre: "Des mois sans clavier", statut: "publié", mot: "DICTEE" }], "SOVO");
  assert.match(t, /SOVO sous ton post « Ce coach bloqué » ou DICTEE sous ton post « Des mois sans clavier »/);
  assert.equal(raisonDeGarder([{ titre: "A", statut: "failed", mot: "SOVO" }], "SOVO"), null);
});
