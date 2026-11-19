// Le tableau de bord de la vue d'ensemble (lot 11 du studio de Yoan) : les chiffres semaine par semaine. Module pur, sans
// page : le serveur le teste (serveur/tests/lot11.test.mjs). Les semaines viennent de /api/stats (52, la plus ancienne
// d'abord, la dernière est celle en cours) ; une valeur absente (null) n'est jamais comptée comme un zéro.

// Les périodes, en semaines affichées (la semaine en cours comprise). « 12 mois » : décision de Yoan, 12 derniers mois
// glissants, soit 52 semaines (la liste des publications ne remonte pas à plus d'un an).
export const PERIODES = [
  { id: "1m", nom: "Dernier mois", semaines: 5, avant: "les 4 semaines d'avant" },
  { id: "3m", nom: "3 mois", semaines: 13, avant: "les 3 mois d'avant" },
  { id: "6m", nom: "6 mois", semaines: 26, avant: "les 6 mois d'avant" },
  { id: "12m", nom: "12 mois", semaines: 52, avant: null },
];
export const PERIODE_PAR_DEFAUT = "3m";

export function periode(id) {
  return PERIODES.find((p) => p.id === id) || PERIODES.find((p) => p.id === PERIODE_PAR_DEFAUT);
}

const estNombre = (v) => typeof v === "number" && Number.isFinite(v);
const somme = (vals) => vals.reduce((a, b) => a + b, 0);

// Ce qu'une card montre pour une période : ses barres, le total, la moyenne par semaine finie, et l'écart avec la même
// durée juste avant (semaines finies seulement, et seulement si toutes ont un chiffre : rien d'extrapolé).
export function resumer(semaines, idPeriode, cle) {
  const p = periode(idPeriode);
  const toutes = Array.isArray(semaines) ? semaines : [];
  const barres = toutes.slice(-p.semaines).map((s) => ({ debut: s.debut, fin: s.fin, en_cours: Boolean(s.en_cours), valeur: estNombre(s[cle]) ? s[cle] : null }));
  const connues = barres.filter((b) => b.valeur !== null);
  const total = connues.length ? somme(connues.map((b) => b.valeur)) : null;
  const finies = barres.filter((b) => !b.en_cours);
  const finiesConnues = finies.filter((b) => b.valeur !== null);
  const moyenne = finiesConnues.length ? somme(finiesConnues.map((b) => b.valeur)) / finiesConnues.length : null;
  let ecart = null;
  const n = finies.length;
  const avantFin = toutes.length - barres.length; // index (exclu) de la fin de la période d'avant
  if (p.avant && n > 0 && avantFin - n >= 0 && finiesConnues.length === n) {
    const avant = toutes.slice(avantFin - n, avantFin).map((s) => s[cle]);
    if (avant.every(estNombre)) {
      const a = somme(avant); const b = somme(finies.map((x) => x.valeur));
      if (a > 0) ecart = { pourcent: Math.round(((b - a) / a) * 100), avant: a, apres: b, libelle: p.avant };
    }
  }
  return { periode: p, barres, total, mesurees: connues.length, moyenne, ecart };
}

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const lire = (j) => { const [a, m, d] = String(j).slice(0, 10).split("-").map(Number); return { a, m, d }; };

// « du 10 au 16 nov. », « du 27 oct. au 2 nov. », « du 29 déc. 2025 au 4 janv. 2026 » ; l'année est écrite quand elle
// n'est pas celle de `annee` (l'année en cours : sur 12 mois, « 24 nov. » serait ambigu).
export function plageSemaine(debut, fin, annee = null) {
  const x = lire(debut); const y = lire(fin);
  if (x.a !== y.a) return `du ${x.d} ${MOIS[x.m - 1]} ${x.a} au ${y.d} ${MOIS[y.m - 1]} ${y.a}`;
  const an = annee && y.a !== annee ? ` ${y.a}` : "";
  if (x.m !== y.m) return `du ${x.d} ${MOIS[x.m - 1]} au ${y.d} ${MOIS[y.m - 1]}${an}`;
  return `du ${x.d} au ${y.d} ${MOIS[y.m - 1]}${an}`;
}

// Repère sous l'axe : « 24 août », ou « nov. 2025 » quand l'année n'est pas celle en cours (court, pour tenir dans une card).
export function dateSemaine(j, annee = null) {
  const x = lire(j);
  return annee && x.a !== annee ? `${MOIS[x.m - 1]} ${x.a}` : `${x.d} ${MOIS[x.m - 1]}`;
}
