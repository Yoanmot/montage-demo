import { test, after } from "node:test";
import assert from "node:assert/strict";
import { Pont } from "../pont.mjs";
import { monde, attendreQue } from "./aide.mjs";

const mondes = [];
after(() => mondes.forEach((m) => m.nettoyer()));

// Une conversation reprise garde les consignes de son ouverture : quand le fichier de l'agent change,
// la version à jour part avec le message suivant, une seule fois.
test("consignes changées : jointes une fois au message suivant d'une conversation reprise", async () => {
  const m = monde();
  mondes.push(m);
  m.contenu("style-a-changer");
  m.json("depot/.claude/settings.json", { agent: "head-of-content" });
  m.ecrire("depot/.claude/agents/head-of-content.md", "---\nname: head-of-content\n---\nRègle d'origine.\n");
  const pont = new Pont({ config: m.config, envBase: m.env });
  const chat = "style-a-changer:hoc";
  let tours = 0;
  pont.on("fin", () => { tours += 1; });
  const tour = async (texte) => {
    const avant = tours;
    pont.envoyer(chat, { texte });
    await attendreQue(() => tours > avant);
  };
  const messages = () => m.lancements().filter((x) => x.evenement === "message").map((x) => x.texte);

  await tour("premier");
  await tour("deuxième");
  m.ecrire("depot/.claude/agents/head-of-content.md", "---\nname: head-of-content\n---\nNouvelle règle : tu le fais.\n");
  await tour("troisième");
  await tour("quatrième");

  const t = messages();
  assert.equal(t.length, 4);
  assert.equal(t[0], "premier", "nouvelle conversation : consignes déjà à jour");
  assert.equal(t[1], "deuxième", "rien n'a changé : rien de joint");
  assert.match(t[2], /Nouvelle règle : tu le fais\./);
  assert.doesNotMatch(t[2], /name: head-of-content/, "sans l'en-tête du fichier");
  assert.match(t[2], /troisième$/);
  assert.equal(t[3], "quatrième", "jointes une seule fois");
  assert.equal(pont.historique(chat).filter((x) => x.role === "romain").at(-2).texte, "troisième", "le chat montre le message tel quel");
});
