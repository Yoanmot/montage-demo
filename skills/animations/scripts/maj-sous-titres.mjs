#!/usr/bin/env node
// maj-sous-titres.mjs : réécrit, dans chaque gabarit de la bibliothèque, les deux blocs écrits depuis commun.mjs :
//   - POLICE : la police unique de la vidéo (POLICES.sousTitres, déclinée en .ti et .tx par POLICES.titre et
//     POLICES.texte) ; si la police a changé, son nom est remplacé partout dans le gabarit ;
//   - SOUS-TITRES : le style des sous-titres (SOUS_TITRES), dans les gabarits qui affichent une ligne de sous-titre.
// À lancer après avoir changé la police ou une valeur des sous-titres dans commun.mjs. Les calques d'une vidéo se
// refont avec `sous-titres preparer` (brique sous-titres), instancier.mjs et les effets sur mesure, qui posent les
// mêmes blocs.
// Usage : node maj-sous-titres.mjs
import fs from 'node:fs';
import path from 'node:path';
import { BIB, poserBlocSousTitres, poserBlocPolice } from './lib/style.mjs';

let n = 0;
for (const g of fs.readdirSync(BIB).sort()) {
  for (const c of ['derriere', 'devant']) {
    const f = path.join(BIB, g, c, 'index.html');
    if (!fs.existsSync(f)) continue;
    const html = fs.readFileSync(f, 'utf8');
    let neuf = html;
    if (neuf.includes('POLICE:debut')) neuf = poserBlocPolice(neuf, '../../');
    if (neuf.includes('SOUS-TITRES:debut')) neuf = poserBlocSousTitres(neuf, {}, '../../');
    if (neuf === html && !html.includes('POLICE:debut') && !html.includes('SOUS-TITRES:debut')) continue;
    if (neuf !== html) { fs.writeFileSync(f, neuf); n++; }
    console.log(`${neuf !== html ? 'réécrit ' : 'à jour  '} ${g}/${c}`);
  }
}
console.log(`PRÊT ${n} gabarit(s) réécrit(s)`);
