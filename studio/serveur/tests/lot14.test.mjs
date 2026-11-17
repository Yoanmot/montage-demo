// Lot 14 (2026-11-17) : le script d'une face caméra en morceaux dits d'une traite. Format du skill
// reel-script (un morceau par ligne, en-tête « - Découpage : un morceau par ligne ») respecté tel quel ;
// regroupement de repli pour les scripts plus anciens (une ligne = un paragraphe).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { morceauxDuTexte, regrouper, motsDe, phrasesDe, enTeteEnMorceaux, MAX_MOTS } from "../../interface/app/morceaux.js";
import { bulles } from "../tournage.mjs";

const PIRE = `Tu crois que changer, c'est risqué ? Regarde ce qui se passe si tu ne changes rien.
Imagine. Ça fait un moment que tu veux t'y remettre. Tu le sais. Mais tu repousses : pas le bon moment, trop de boulot, peur de ne pas tenir.
Alors pose-toi deux questions. Le pire qui puisse arriver si tu commences ? Tu rates une séance, tu te trouves nul, tu ajustes. C'est tout. Et le meilleur ? Dans un an, t'as de la force, de l'énergie, et un rythme que tu tiens.
Maintenant, l'autre scénario. Tu ne changes rien. Dans un an, même fatigue, mêmes excuses, une année de plus. Le pire, c'est pas d'échouer. C'est que rien change.
Moi, à 23 ans, j'ai tout arrêté. Plus aucune motivation. Et je suis revenu. Alors si t'as fait une pause, repartir, c'est toujours possible.
Cette semaine, pas besoin de tout changer. Choisis une seule chose, et fais-la.
Et toi, c'est quoi la chose que tu repousses depuis trop longtemps ? Dis-le-moi en commentaire. Bonne semaine.`;
const ACC_PIRE = "Tu crois que changer, c'est risqué ? Regarde ce qui se passe si tu ne changes rien.";
const FETES = "Les fêtes arrivent, ton agenda se remplit, et tu te dis que tu reprendras en janvier. Sauf que repartir de zéro en janvier, c'est bien plus dur que de réduire en décembre. Après, je te dis pas de t'entraîner comme d'habitude. Moi, quand ma semaine est pleine, je ne m'arrête pas, je réduis. Ensuite, très peu d'isolation. Peu de temps de repos, et surtout de l'intensité.";
const ACC_FETES = "Les fêtes arrivent, ton agenda se remplit, et tu te dis que tu reprendras en janvier.";

test("repli : les phrases courtes se disent avec leurs voisines, l'exemple de Yoan tient en un morceau", () => {
  const m = morceauxDuTexte(PIRE, { accroche: ACC_PIRE });
  assert.deepEqual(m[0], { texte: ACC_PIRE, accroche: true });
  assert.equal(m[1].texte, "Imagine. Ça fait un moment que tu veux t'y remettre. Tu le sais.");
  assert.equal(m[1].partie, true, "nouvelle ligne de l'ancien script = nouvelle partie");
  assert.equal(m[2].texte, "Mais tu repousses : pas le bon moment, trop de boulot, peur de ne pas tenir.");
  assert.ok(m.some((x) => x.texte === "Le pire, c'est pas d'échouer. C'est que rien change."));
  assert.ok(m.some((x) => x.texte === "Tu rates une séance, tu te trouves nul, tu ajustes. C'est tout."));
  // Aucun morceau démesuré, et rien de perdu ni d'ajouté.
  for (const x of m) assert.ok(motsDe(x.texte) <= MAX_MOTS || phrasesDe(x.texte).length === 1, x.texte);
  assert.equal(m.map((x) => x.texte).join(" "), PIRE.replace(/\n/g, " "));
  assert.ok(m.length >= 10 && m.length <= 16, `${m.length} morceaux`);
});

test("repli : tout le texte sur une ligne, l'accroche à part, puis des morceaux de taille raisonnable", () => {
  const m = morceauxDuTexte(FETES, { accroche: ACC_FETES });
  assert.deepEqual(m.map((x) => x.texte), [ACC_FETES,
    "Sauf que repartir de zéro en janvier, c'est bien plus dur que de réduire en décembre.",
    "Après, je te dis pas de t'entraîner comme d'habitude.",
    "Moi, quand ma semaine est pleine, je ne m'arrête pas, je réduis.",
    "Ensuite, très peu d'isolation. Peu de temps de repos, et surtout de l'intensité."]);
  assert.equal(m[0].accroche, true);
  assert.equal(m[1].partie, true, "l'accroche est mise à part, comme dans un script écrit en morceaux");
  assert.ok(!m[2].partie, "même ligne : pas de nouvelle partie");
});

test("repli : une suite de petites phrases ne dépasse jamais la limite", () => {
  const ligne = Array.from({ length: 12 }, (_, i) => `Phrase courte numéro ${i}.`).join(" ");
  for (const x of regrouper(ligne)) assert.ok(motsDe(x) <= MAX_MOTS, x);
});

test("format du lot 14 : chaque ligne est un morceau, rien de recoupé ni de regroupé, ligne vide = partie", () => {
  const texte = "Tu crois que changer, c'est risqué ? Regarde ce qui se passe si tu ne changes rien.\nImagine.\nÇa fait un moment que tu veux t'y remettre. Tu le sais. Mais tu repousses : pas le bon moment, trop de boulot, peur de ne pas tenir.\n\nAlors pose-toi deux questions.";
  const m = morceauxDuTexte(texte, { parLigne: true, accroche: ACC_PIRE });
  assert.deepEqual(m, [
    { texte: ACC_PIRE, accroche: true },
    { texte: "Imagine.", partie: true },
    { texte: "Ça fait un moment que tu veux t'y remettre. Tu le sais. Mais tu repousses : pas le bon moment, trop de boulot, peur de ne pas tenir." },
    { texte: "Alors pose-toi deux questions.", partie: true },
  ]);
});

test("en-tête : « - Découpage : un morceau par ligne » reconnu, et passé au plan de tournage", () => {
  assert.equal(enTeteEnMorceaux("# X\n\n- Format : éducatif\n- Découpage : un morceau par ligne\n"), true);
  assert.equal(enTeteEnMorceaux("# X\n\n- Format : éducatif\n"), false);
  const depot = fs.mkdtempSync(path.join(os.tmpdir(), "studio-lot14-"));
  const ecrire = (slug, entete) => {
    fs.mkdirSync(path.join(depot, "contenus", slug), { recursive: true });
    fs.writeFileSync(path.join(depot, "contenus", slug, "script.md"),
      `# Sujet\n\n- Format : éducatif\n${entete}- Accroche retenue : 1\n\n## Accroches proposées\n1. (question) Tu as faim à 16 h ?\n\n## Texte complet\nTu as faim à 16 h ?\nNormal. Voilà pourquoi.\n\n## Légende\nL.\n`);
  };
  ecrire("neuf", "- Découpage : un morceau par ligne\n");
  ecrire("ancien", "");
  try {
    const b = bulles({ depot }, { prises: [{ n: 1, type: "face", contenus: [{ slug: "neuf" }] }, { n: 2, type: "face", contenus: [{ slug: "ancien" }] }] });
    assert.equal(b[0].decoupage, "morceaux");
    assert.equal(b[0].accroche, "Tu as faim à 16 h ?");
    assert.equal(b[1].decoupage, null);
    assert.deepEqual(morceauxDuTexte(b[0].script, { parLigne: true, accroche: b[0].accroche }).map((x) => x.texte), ["Tu as faim à 16 h ?", "Normal. Voilà pourquoi."]);
  } finally { fs.rmSync(depot, { recursive: true, force: true }); }
});
