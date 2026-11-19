import { test, after } from "node:test";
import assert from "node:assert/strict";
import { Pont } from "../pont.mjs";
import { monde, attendreQue } from "./aide.mjs";

const mondes = [];
after(() => mondes.forEach((m) => m.nettoyer()));

// Un rendu lancé en arrière-plan : le tour finit (« à toi »), puis l'agent reparle quand le rendu est
// prêt. Le chat repasse « en cours », puis finit « à toi » : il ne reste jamais bloqué.
test("suite après la fin du tour : le chat repasse en cours puis finit", async () => {
  const m = monde();
  mondes.push(m);
  m.contenu("rendu-en-fond");
  const pont = new Pont({ config: m.config, envBase: { ...m.env, FAUX_CLAUDE_SCENARIO: "suite", FAUX_CLAUDE_ATTENTE: "200" } });
  const chat = "rendu-en-fond:hoc";
  pont.envoyer(chat, { texte: "fabrique la vidéo" });
  await attendreQue(() => m.lancements().some((x) => x.evenement === "fin"), { delaiMs: 8000 });
  await attendreQue(() => pont.historique(chat).filter((x) => x.type === "etat").length >= 4);
  const etats = pont.historique(chat).filter((x) => x.type === "etat").map((x) => x.etat);
  assert.deepEqual(etats, ["en_cours", "a_toi", "en_cours", "a_toi"]);
  assert.equal(pont.etat(chat), "a_toi");
});
