// sur-mesure.mjs : écrire une animation sur mesure du monteur de Yoan avec les briques de son pipeline (moteur/).
//
// Une animation sur mesure est un calque HyperFrames écrit pour ce montage (il ne rentre pas dans la banque). Elle se
// compose avec les mêmes briques que les gabarits : fond granuleux (fondC), faisceau, entrées depuis un flou (ent),
// sorties (sortie), croix « + », crochets dorés, icônes en trait, logos dans leur tuile, étiquettes JetBrains Mono, et la
// grammaire de references/motion-design.md (§10 pour un effet qui illustre un propos). Les instants sont en secondes
// depuis le début du calque ; toutes les valeurs de style viennent de moteur/style/style.json.
//
// Usage, dans un petit script du dossier de montage (<dossier>-montage/sur-mesure/<id>.mjs), lancé avec node :
//   import { M, ecrireSurMesure, instant } from '<SK>/animations-yoan/scripts/sur-mesure.mjs';
//   const W = '<dossier>-montage';
//   const t0 = instant(W, 'milliseconde', -0.1);            // début du calque (ancre du plan, décalage en s)
//   const d = instant(W, '@coupe12') - t0;                   // durée
//   const r = (a, dec = 0) => instant(W, a, dec) - t0;      // un instant dans le calque
//   const fond = M.fondC('f', 0, d);                          // plein écran : le fond du style
//   const part = { css: '...', html: '...', js: M.ent('#x', r('caler')) };
//   ecrireSurMesure(W, 'sm-onde', d, [fond, part], { polices: ['satoshi', 'jetbrains'], grain: true });
// Puis, dans le plan : { "type": "sur_mesure", "calque": "calques/sm-onde", "de": "milliseconde-0.1", "a": "@coupe12",
// "plein": true } (de et a = les mêmes ancres qu'ici), et « yoan.py calques » le pose.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
export const M = await import(path.join(ICI, '..', 'moteur', 'executeur', 'calques', 'index.mjs'));

// Instant (s, vidéo coupée) d'une ancre du plan (« mot#2 », « w12 », « @coupe3 », « mot:fin »), résolue par le validateur
// du pipeline de Yoan sur le dossier de montage, plus un décalage en secondes.
export function instant(dossier, ancre, decalage = 0) {
  const py = `import sys, json; sys.path.insert(0, ${JSON.stringify(path.join(ICI, '..', 'moteur', 'executeur'))})
import valider_timeline as VT
from pathlib import Path
w = Path(${JSON.stringify(path.resolve(dossier))})
A = VT.Ancres(json.loads((w / "words.cut.json").read_text())["words"], json.loads((w / "edl.json").read_text()))
print(A.t(${JSON.stringify(ancre)}))`;
  const t = parseFloat(execFileSync('python3', ['-c', py], { encoding: 'utf8' }).trim());
  return Math.round((t + decalage) * 30) / 30;
}

// Écrit <dossier>/calques/<id>/index.html (page HyperFrames du style, polices, grain et GSAP copiés à côté) et les
// fichiers donnés ([[source, nom]] : une image propre au reel, citée en chemin relatif dans le HTML).
export function ecrireSurMesure(dossier, id, duree, parts, { polices = ['satoshi'], grain = false, fichiers = [], fondPage = 'transparent' } = {}) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error(`id « ${id} » : minuscules, chiffres et tirets`);
  const dc = path.join(path.resolve(dossier), 'calques', id);
  fs.rmSync(dc, { recursive: true, force: true });
  M.ecrireCalque(dc, M.page(Math.round(duree * 30) / 30, parts, polices, fondPage), polices, grain);
  for (const [src, nom] of fichiers) fs.copyFileSync(src, path.join(dc, nom));
  console.log(`PRÊT ${dc}/index.html (${duree.toFixed(2)} s)`);
  return dc;
}
