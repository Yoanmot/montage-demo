// Le texte d'une face caméra découpé comme Romain le tourne (lot 14) : un bloc par morceau qu'il dit
// d'une traite, une pause entre deux morceaux. Module pur (ni page, ni fichier) : l'interface s'en sert
// pour le plan de tournage, la maquette aussi, et les tests du serveur l'importent. Contrat, section 5.
//
// - Script au format du lot 14 (en-tête « - Découpage : un morceau par ligne », écrit par le skill
//   reel-script) : chaque ligne du texte complet est un morceau, une ligne vide ouvre une nouvelle partie.
//   Rien n'est recoupé ni regroupé : c'est la source de vérité.
// - Script plus ancien (une ligne = un paragraphe, parfois tout le texte sur une ligne) : regroupement de
//   repli. On coupe aux lignes, puis aux phrases ; une phrase courte (moins de 8 mots) se dit avec la
//   suivante ; une toute petite phrase (3 mots au plus, « Tu le sais. ») qui suit un morceau complet
//   le termine ; un morceau ne dépasse jamais 20 mots par regroupement (une seule phrase plus longue
//   reste entière).

export const COURT = 8;
export const PETIT = 3;
export const MAX_MOTS = 20;

const ESPACE = "[\\s\\u00a0\\u202f]";
// Coupe après . ! ? ou … (éventuellement suivis d'un guillemet fermant), devant un mot qui ne commence
// pas en minuscule ni par une ponctuation.
const FIN_PHRASE = new RegExp(`(?<=[.!?…](?:${ESPACE}?["»])?)${ESPACE}+(?=[^a-zà-ÿ\\s\\u00a0\\u202f»"),;:])`, "u");

export const enTeteEnMorceaux = (scriptMd) => /^-\s*D[ée]coupage\s*:\s*[^\n]*morceau/imu.test(String(scriptMd || ""));

const brut = (t) => String(t ?? "")
  .replace(/\*\*(.+?)\*\*/g, "$1").replace(/(^|\s)\*(\S.+?)\*/g, "$1$2").replace(/`([^`]+)`/g, "$1")
  .replace(/^\s*[-*•]\s+/, "").replace(/^#{1,6}\s+/, "").trim();

export const phrasesDe = (ligne) => brut(ligne).split(FIN_PHRASE).map((x) => x.trim()).filter(Boolean);
export const motsDe = (t) => String(t || "").split(/[\s  ]+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;

// Les morceaux d'un paragraphe sans découpage (repli).
export function regrouper(ligne) {
  const morceaux = [];
  let cours = null; // { phrases: [], mots }
  const fermer = () => { if (cours) morceaux.push(cours.phrases.join(" ")); cours = null; };
  for (const ph of phrasesDe(ligne)) {
    const n = motsDe(ph);
    if (cours && cours.mots < COURT && cours.mots + n <= MAX_MOTS) { cours.phrases.push(ph); cours.mots += n; continue; }
    if (cours && n <= PETIT && !/\?\s*["»]?$/.test(ph) && cours.mots + n <= MAX_MOTS) { cours.phrases.push(ph); cours.mots += n; continue; }
    fermer();
    cours = { phrases: [ph], mots: n };
  }
  fermer();
  return morceaux;
}

const comparable = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "'")
  .toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(Boolean).join(" ");

// [{ texte, accroche?, partie? }] : `partie` marque le premier morceau d'un nouveau paragraphe (pas le
// premier du texte), `accroche` le morceau qui est l'accroche choisie (en tête du texte).
export function morceauxDuTexte(texte, { parLigne = false, accroche = null } = {}) {
  const lignes = String(texte || "").replace(/\r/g, "").split("\n");
  const r = [];
  let nouvellePartie = false;
  let premiere = true;
  const pousser = (t, extra = {}) => {
    if (!t) return;
    r.push({ texte: t, ...(r.length && nouvellePartie ? { partie: true } : {}), ...extra });
    nouvellePartie = false;
  };
  for (const l of lignes) {
    if (!l.trim()) { if (r.length) nouvellePartie = true; continue; }
    let reste = brut(l);
    if (premiere && accroche) {
      const a = brut(accroche);
      const ca = comparable(a);
      const cr = comparable(reste);
      if (ca && (cr === ca || cr.startsWith(`${ca} `))) {
        // L'accroche est un morceau à elle seule ; la suite de la ligne (ancien script) se regroupe.
        const mots = reste.split(/\s+/);
        // Le plus long début de ligne qui redonne l'accroche (sa ponctuation finale comprise : « ? »).
        let k = mots.length;
        for (let i = 1; i <= mots.length; i++) {
          const c = comparable(mots.slice(0, i).join(" "));
          if (c === ca) k = i; else if (c.length > ca.length) break;
        }
        pousser(mots.slice(0, k).join(" "), { accroche: true });
        nouvellePartie = true; // l'accroche est toujours mise à part
        reste = mots.slice(k).join(" ").trim();
      }
    }
    premiere = false;
    if (!reste) continue;
    if (parLigne) pousser(reste);
    else {
      // Ancien script : chaque ligne est un paragraphe.
      if (r.length) nouvellePartie = true;
      for (const m of regrouper(reste)) pousser(m);
    }
  }
  return r;
}
