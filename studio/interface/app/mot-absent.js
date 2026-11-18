// « La légende ne cite pas le mot X » : la règle de zernio.py (preparer), écrite une seule fois. Module pur
// (ni page, ni fichier) : le serveur (publication.mjs) s'en sert pour le récapitulatif, l'interface
// (programmer.js) pour suivre la légende pendant qu'elle se retouche. Le mot, sans accents ni casse,
// quelque part dans la légende.
export function motAbsent(legende, mot) {
  if (!mot) return false;
  const t = String(legende ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return !t.includes(String(mot).toLowerCase());
}
