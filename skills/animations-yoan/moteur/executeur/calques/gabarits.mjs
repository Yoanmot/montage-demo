// Accès aux 17 gabarits de motion design de briques/gabarits/ (un README par gabarit). Ils importent
// briques/gabarits/commun.mjs, qui réexporte executeur/calques/commun.mjs : ils lisent donc style/style.json.
// Recâblage prouvé sans changement de rendu : HTML identique octet pour octet aux cartes du labo (README de l'exécuteur).
export { champSaisie } from '../../briques/gabarits/champ-saisie/gabarit.mjs';
export { reglePin } from '../../briques/gabarits/regle-pin/gabarit.mjs';
export { objetSignature } from '../../briques/gabarits/objet-signature/gabarit.mjs';
export { demiEcran as demiEcranGabarit, DEMI, COURBES, COURBE_DEFAUT, TABLE_BANQUE } from '../../briques/gabarits/demi-ecran/gabarit.mjs';
export { panneau } from '../../briques/gabarits/panneau-viseurs/gabarit.mjs';
export { listeCascade } from '../../briques/gabarits/liste-cascade/gabarit.mjs';
export { comparaisonEmpilee } from '../../briques/gabarits/comparaison-empilee/gabarit.mjs';
export { schemaNoeuds } from '../../briques/gabarits/schema-noeuds/gabarit.mjs';
export { vignetteMorph } from '../../briques/gabarits/vignette-morph/gabarit.mjs';
export { appariement } from '../../briques/gabarits/appariement/gabarit.mjs';
export { minuteur } from '../../briques/gabarits/minuteur/gabarit.mjs';
export { fichierHeros } from '../../briques/gabarits/fichier-heros/gabarit.mjs';
export { fichierPartout } from '../../briques/gabarits/fichier-partout/gabarit.mjs';
export { listeTorse } from '../../briques/gabarits/liste-torse/gabarit.mjs';
export { objetTournant } from '../../briques/gabarits/objet-tournant/gabarit.mjs';
export { imagePlein } from '../../briques/gabarits/image-plein/gabarit.mjs';
export { minuteurSuite } from '../../briques/gabarits/minuteur-suite/gabarit.mjs';
