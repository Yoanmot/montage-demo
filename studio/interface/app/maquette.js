// Maquette du serveur, dans le navigateur (activée par ?maquette=1).
// Données fabriquées pour développer et faire des captures sans le serveur : rien ici n'est vrai.
// Même interface que creerApiServeur() dans api.js. Tous les stades d'un dossier y sont (lot 9).

import { aujourdhui, ajouterJours, lundiDe, CONTACT } from "./outils.js";
import { ErreurStudio } from "./api.js";

const LIBELLES = {
  proposee: "idée proposée", gardee: "brief à écrire", script_ecrit: "brief à relire",
  valide_reel: "brief validé", valide_carrousel: "à mettre en page", tournage_prevu: "à tourner",
  rushs_recus: "rushs reçus", planche: "planche à valider", monte: "monté", mis_en_page: "mis en page",
  publie: "publié", abandonne: "mis de côté", refusee: "refusée", de_cote: "mise de côté",
};
function libelle(c) {
  if (c.stade === "valide") return LIBELLES[`valide_${c.format}`];
  if (c.stade === "programme") {
    if (!c.programme_le) return "programmé";
    const j = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"][new Date(`${c.programme_le.slice(0, 10)}T12:00:00Z`).getUTCDay()];
    return `programmé ${j}. ${c.programme_le.slice(8, 10)}/${c.programme_le.slice(5, 7)}`;
  }
  return LIBELLES[c.stade] || c.stade;
}
const ORDRE = ["gardee", "script_ecrit", "valide", "tournage_prevu", "rushs_recus", "planche", "monte", "mis_en_page", "programme", "publie"];
const apres = (s, x) => ORDRE.indexOf(s) >= ORDRE.indexOf(x);
function fichiersDe(c) {
  if (!c.slug) return ["idee"];
  const f = ["idee"];
  if (c.stade !== "gardee") f.push("brief");
  if (c.format === "reel" && ["rushs_recus", "planche", "monte", "programme", "publie"].includes(c.stade)) f.push("montage");
  if (c.format === "reel" && ["monte", "programme", "publie"].includes(c.stade)) f.push("video");
  if (c.format === "carrousel" && ["mis_en_page", "programme", "publie"].includes(c.stade)) f.push("slides");
  return f;
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const maintenant = () => new Date().toISOString();
let compteurEmpreinte = 1;
const empreinte = () => `sha256:${String(compteurEmpreinte++).padStart(64, "0")}`;

// ---------- Images fabriquées (aplats et texte, pour la maquette seulement) ----------
function svgUrl(svg) { return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); }
function vignette(lieu, teinte) {
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="320" viewBox="0 0 180 320">
  <rect width="180" height="320" fill="${teinte}"/><rect x="0" y="210" width="180" height="110" fill="#000" opacity=".28"/>
  <rect x="24" y="96" width="132" height="84" rx="10" fill="#fff" opacity=".18"/>
  <text x="18" y="290" font-family="Helvetica, Arial" font-size="18" font-weight="700" fill="#fff">${lieu}</text></svg>`);
}
function planche() {
  const cases = ["Accroche", "Le bol", "Les flocons", "Le chiffre", "Ta main", "Le mot"];
  const teintes = ["#2a2522", "#6b4a35", "#8a6a4f", "#2a2522", "#5b5550", "#F15A24"];
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560" viewBox="0 0 900 560"><rect width="900" height="560" fill="#141414"/>`;
  cases.forEach((t, i) => {
    const x = 24 + (i % 6) * 144, y = 40;
    s += `<rect x="${x}" y="${y}" width="128" height="228" rx="8" fill="${teintes[i]}"/>`;
    s += `<rect x="${x + 14}" y="${y + 150}" width="100" height="18" rx="3" fill="#fff" opacity=".9"/>`;
    s += `<circle cx="${x + 18}" cy="${y + 18}" r="13" fill="#F15A24"/><text x="${x + 18}" y="${y + 23}" text-anchor="middle" font-family="Helvetica, Arial" font-size="14" font-weight="700" fill="#111">${i + 1}</text>`;
    s += `<text x="${x}" y="${y + 252}" font-family="Helvetica, Arial" font-size="15" fill="#ddd">${t}</text>`;
  });
  ["#3a3330", "#F15A24", "#2a2522"].forEach((f, i) => {
    const x = 24 + i * 144, y = 310;
    s += `<rect x="${x}" y="${y}" width="128" height="200" rx="8" fill="${f}"/>`;
    s += `<circle cx="${x + 18}" cy="${y + 18}" r="13" fill="#F15A24" stroke="#111" stroke-width="2"/><text x="${x + 18}" y="${y + 23}" text-anchor="middle" font-family="Helvetica, Arial" font-size="14" font-weight="700" fill="#111">${i + 7}</text>`;
  });
  return svgUrl(s + "</svg>");
}
function slide(n, titre, fond, encre) {
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
  <rect width="400" height="500" fill="${fond}"/>
  <text x="32" y="64" font-family="Helvetica, Arial" font-size="15" font-weight="700" fill="${encre}" opacity=".7">${n} / 5</text>
  <foreignObject x="32" y="150" width="336" height="220"><div xmlns="http://www.w3.org/1999/xhtml" style="font:900 36px/1.05 Helvetica, Arial;text-transform:uppercase;color:${encre}">${titre}</div></foreignObject>
  <rect x="32" y="440" width="90" height="6" fill="#F15A24"/></svg>`);
}
const VIDEO = "/app/maquette/video-exemple.mp4";

// ---------- Jeu de données ----------
function fabriquer() {
  const auj = aujourdhui();
  const lundi = lundiDe(auj);
  const prochain = ajouterJours(lundi, 7);
  const j = (base, n) => ajouterJours(base, n);
  const carte = (o) => {
    const c = { activite: null, a_toi: false, jour_prevu: null, declinaison_de: null, maj: maintenant(), ...o };
    c.semaine = c.jour_prevu ? lundiDe(c.jour_prevu) : null; c.libelle = libelle(c); c.fichiers = fichiersDe(c);
    return c;
  };
  const propositions = [
    { proposition_id: "p-01", titre: "Pourquoi tu as faim à 16 h", format: "reel", stade: "proposee", maj: "2026-11-16T09:04:00+01:00",
      angle: "Le creux de l'après-midi vient souvent d'un midi sans protéines. Tu montres ton assiette de midi et ce que tu changes.",
      accroche: "Tu as faim à 16 h tous les jours ? C'est pas un manque de volonté.",
      source: { type: "outlier", compte: "@coach.exemple", lien: "https://www.instagram.com/reel/exemple/" }, pourquoi_maintenant: "Une vidéo sur ce sujet a fait 4 fois les vues habituelles de ce compte cette semaine." },
    { proposition_id: "p-02", titre: "3 étirements pour le dos après le bureau", format: "reel", stade: "proposee", maj: "2026-11-16T09:03:00+01:00",
      angle: "Ce que tu fais faire à tes clients qui passent la journée assis, sans tapis, à côté de la chaise.",
      source: { type: "idee_romain", ref: j(auj, -3) }, pourquoi_maintenant: "Tu l'as noté jeudi après une séance." },
    { proposition_id: "p-03", titre: "Les protéines expliquées avec ta main", format: "carrousel", stade: "proposee", maj: "2026-11-16T09:02:00+01:00",
      angle: "Ton reel sur le petit-déjeuner, repris en 5 images : une paume, un poing, un pouce.",
      source: { type: "declinaison", ref: "proteines-au-petit-dej" }, declinaison_de: "proteines-au-petit-dej",
      pourquoi_maintenant: "Le reel n'est pas encore sorti : le carrousel peut le suivre de quelques jours." },
    { proposition_id: "p-04", titre: "Ton premier mois de reprise, semaine par semaine", format: "carrousel", stade: "de_cote", maj: "2026-11-14T10:00:00+01:00",
      angle: "Quatre semaines, une image par semaine : ce que tu fais, ce que tu sens, ce qui change.",
      source: { type: "chat", ref: null }, pourquoi_maintenant: "Pour janvier, quand tout le monde reprend." },
  ].map((p) => carte({ ...p, slug: null }));

  const contenus = [
    { slug: "mythe-des-10000-pas", titre: "Le mythe des 10 000 pas", format: "reel", stade: "gardee", jour_prevu: j(prochain, 2), activite: "en_cours" },
    { slug: "manger-avant-la-seance", titre: "Ce que je mange avant une séance", format: "reel", stade: "gardee", jour_prevu: j(prochain, 4) },
    { slug: "collations-qui-calent", titre: "Les collations qui calent vraiment", format: "carrousel", stade: "gardee", jour_prevu: j(prochain, 5) },
    { slug: "squat-ou-vont-tes-genoux", titre: "Squat : où vont tes genoux", format: "reel", stade: "script_ecrit", a_toi: true, jour_prevu: j(prochain, 1) },
    { slug: "5-erreurs-reprise-sport", titre: "5 erreurs quand tu reprends le sport", format: "carrousel", stade: "script_ecrit", jour_prevu: j(prochain, 3) },
    { slug: "pompes-sur-les-genoux", titre: "Pompes sur les genoux : pas une honte", format: "reel", stade: "valide", jour_prevu: j(prochain, 6) },
    { slug: "assiette-en-4-cases", titre: "Ton assiette idéale en 4 cases", format: "carrousel", stade: "valide", jour_prevu: j(lundi, 5) },
    { slug: "gainage-qui-sert", titre: "Le gainage qui sert vraiment", format: "reel", stade: "tournage_prevu", jour_prevu: j(lundi, 3), tournage_id: `${j(auj, -1)}-1400` },
    { slug: "respirer-pendant-l-effort", titre: "Bien respirer pendant l'effort", format: "reel", stade: "rushs_recus", jour_prevu: j(lundi, 6) },
    { slug: "marcher-apres-le-repas", titre: "Marcher 10 minutes après le repas", format: "reel", stade: "rushs_recus", jour_prevu: j(lundi, 7) },
    { slug: "proteines-au-petit-dej", titre: "Des protéines au petit-déj, sans te compliquer", format: "reel", stade: "planche", a_toi: true, jour_prevu: j(lundi, 3) },
    { slug: "mobilite-des-hanches", titre: "Mobilité des hanches en 3 minutes", format: "reel", stade: "monte", jour_prevu: j(lundi, 1) },
    { slug: "combien-de-seances", titre: "Combien de séances par semaine ?", format: "carrousel", stade: "mis_en_page", jour_prevu: j(lundi, 3) },
    { slug: "ton-dos-te-dit-merci", titre: "Ton dos te dit merci", format: "reel", stade: "programme", jour_prevu: j(auj, 2), programme_le: `${j(auj, 2)} 18:30` },
    { slug: "tu-ne-progresses-plus", titre: "Pourquoi tu ne progresses plus", format: "reel", stade: "publie", jour_prevu: j(auj, -2), publication_quand: `${j(auj, -2)} 18:30` },
    { slug: "squat-sans-douleur", titre: "Le squat sans douleur aux genoux", format: "reel", stade: "publie", jour_prevu: j(auj, -6), publication_quand: `${j(auj, -6)} 18:30` },
    { slug: "3-erreurs-abdos", titre: "3 erreurs sur tes abdos", format: "carrousel", stade: "publie", jour_prevu: j(auj, -9), publication_quand: `${j(auj, -9)} 12:15` },
    { slug: "cardio-a-jeun", titre: "Le cardio à jeun", format: "reel", stade: "abandonne" },
  ].map(carte);
  for (const c of contenus) if (c.programme_le) c.publication_quand = c.programme_le;

  const file = [
    { id: "a-1", type: "script", slug: "mythe-des-10000-pas", lot: "l-1", statut: "en_cours", cree_le: maintenant(), debut: maintenant(), fin: null, session: null, erreur: null },
    { id: "a-3", type: "script", slug: "squat-ou-vont-tes-genoux", lot: "l-1", statut: "a_toi", cree_le: maintenant(), debut: maintenant(), fin: null, session: null, erreur: null },
  ];
  const a_ranger = [
    { nom: "IMG_4830.MOV", url: VIDEO, vignette_url: vignette("au parc", "#4d5a3f"), libelle: "ton plan : tu marches au parc (12 s)",
      raison: "Je ne retrouve pas ce plan dans ton plan de tournage : dis-moi où il va.",
      candidats: [{ slug: "gainage-qui-sert", type: "b-roll", score: 0.41 }, { slug: "respirer-pendant-l-effort", type: "b-roll", score: 0.33 }] },
  ];
  const tournages = [
    { id: `${j(auj, -1)}-1400`, cree_le: `${j(auj, -1)}T14:00:00+01:00`, contenus: ["gainage-qui-sert", "respirer-pendant-l-effort", "marcher-apres-le-repas"], duree_estimee_min: 30, en_cours: true },
    { id: `${j(auj, -9)}-1015`, cree_le: `${j(auj, -9)}T10:15:00+01:00`, contenus: ["proteines-au-petit-dej", "mobilite-des-hanches", "ton-dos-te-dit-merci"], duree_estimee_min: 40, en_cours: false },
    { id: `${j(auj, -16)}-1730`, cree_le: `${j(auj, -16)}T17:30:00+01:00`, contenus: ["tu-ne-progresses-plus", "squat-sans-douleur"], duree_estimee_min: 25, en_cours: false },
  ];
  // Chiffres Instagram fabriqués (une courbe d'abonnés sur 60 jours, des vues, 5 publications).
  const historique = Array.from({ length: 61 }, (_, i) => ({ jour: j(auj, i - 60), abonnes: Math.round(1612 + i * 3.4 + Math.sin(i / 4) * 6 + (i > 44 ? (i - 44) * 2.2 : 0)) }));
  const stats = {
    disponible: true, source: "fichier", exemple: true, maj: new Date(Date.now() - 3 * 3600e3).toISOString(), chiffres_du: new Date(Date.now() - 3 * 3600e3).toISOString(),
    en_cours: false, erreur: null, abonnes: historique.at(-1).abonnes,
    variation_abonnes: { valeur: historique.at(-1).abonnes - historique[30].abonnes, depuis: historique[30].jour, partielle: false },
    historique, compte_28j: { vues: 48300, portee: 19650, visites_profil: 612, interactions: 2210, comptes_engages: 940 },
    compte_28j_avant: { vues: 37100, portee: 16900, visites_profil: 480, interactions: 1800, comptes_engages: 800 },
    publications_30j: 7, vues_publications_30j: 31400, normale_vues: { reel: 3100, carrousel: 1400 },
    publications: [
      { le: `${j(auj, -2)}T17:30:00Z`, type: "reel", titre: "Pourquoi tu ne progresses plus", slug: "tu-ne-progresses-plus", lien: "https://www.instagram.com/", vues: 2400, x_vues: null, comparable: false },
      { le: `${j(auj, -6)}T17:30:00Z`, type: "reel", titre: "Le squat sans douleur aux genoux", slug: "squat-sans-douleur", lien: "https://www.instagram.com/", vues: 7900, x_vues: 2.5, comparable: true },
      { le: `${j(auj, -9)}T11:15:00Z`, type: "carrousel", titre: "3 erreurs sur tes abdos", slug: "3-erreurs-abdos", lien: "https://www.instagram.com/", vues: 1250, x_vues: 0.9, comparable: true },
      { le: `${j(auj, -13)}T17:30:00Z`, type: "reel", titre: "Ta séance en 20 minutes, sans matériel", slug: null, lien: "https://www.instagram.com/", vues: 3300, x_vues: 1.1, comparable: true },
      { le: `${j(auj, -20)}T17:30:00Z`, type: "reel", titre: "Le gras du ventre ne part pas avec des abdos", slug: null, lien: "https://www.instagram.com/", vues: 1900, x_vues: 0.6, comparable: true },
    ],
  };
  const chats = {
    general: { etat: "a_toi", messages: [
      { n: 1, le: maintenant(), role: "romain", type: "texte", texte: "propose-moi 3 idées de contenu, plutôt motivation un peu" },
      { n: 2, le: maintenant(), role: "studio", type: "activite", texte: "je regarde ce qui a marché cette semaine" },
      { n: 3, le: maintenant(), role: "studio", type: "activite", texte: "j'enregistre" },
      { n: 5, le: maintenant(), role: "studio", type: "texte", texte: "Les 3 idées sont prêtes, tu les vois dans « Idées proposées »." },
      { n: 6, le: maintenant(), role: "studio", type: "etat", etat: "a_toi" },
      { n: 7, le: maintenant(), role: "romain", type: "texte", texte: "Pour la semaine prochaine j'aimerais surtout parler de la reprise après les fêtes, des gens qui se sentent coupables d'avoir lâché.\nEt si possible une idée sur le dos au bureau, beaucoup de mes clients en parlent en ce moment." },
      { n: 8, le: maintenant(), role: "studio", type: "activite", texte: "j'enregistre" },
      { n: 9, le: maintenant(), role: "studio", type: "texte", texte: "C'est fait : 2 idées de plus dans « Idées proposées », une sur la reprise sans culpabilité, une sur le dos au bureau." },
      { n: 10, le: maintenant(), role: "studio", type: "etat", etat: "a_toi" },
    ] },
    "squat-ou-vont-tes-genoux:hoc": { etat: "a_toi", messages: [
      { n: 1, le: maintenant(), role: "studio", type: "activite", texte: "je lis ton idée" },
      { n: 2, le: maintenant(), role: "studio", type: "activite", texte: "j'écris ton brief" },
      { n: 3, le: maintenant(), role: "studio", type: "texte", texte: "Ton brief est écrit, relis-le dans « Brief ». Une question avant que tu le valides : à la fin, tu montres le squat avec l'élastique autour des genoux, ou sans matériel ?" },
      { n: 4, le: maintenant(), role: "studio", type: "etat", etat: "a_toi" },
    ] },
    "proteines-au-petit-dej:monteur": { etat: "a_toi", messages: [
      { n: 1, le: maintenant(), role: "studio", type: "activite", texte: "je regarde ta vidéo face caméra" },
      { n: 2, le: maintenant(), role: "studio", type: "activite", texte: "je coupe les silences" },
      { n: 3, le: maintenant(), role: "studio", type: "activite", texte: "je place tes plans de la cuisine" },
      { n: 4, le: maintenant(), role: "studio", type: "texte", texte: "Ta planche est prête dans « Montage ». Réponds **ok**, ou dis-moi par numéro ce que tu changes." },
      { n: 5, le: maintenant(), role: "studio", type: "etat", etat: "a_toi" },
    ] },
  };
  return { propositions, contenus, file, a_ranger, tournages, stats, chats, briefs: {}, sync: { derniere: new Date(Date.now() - 120000).toISOString(), etat: "ok" } };
}

const BRIEF_SQUAT = {
  texte: "Tu as peur que tes genoux dépassent tes pointes de pieds quand tu fais un squat ?\n\nOn t'a dit que c'était dangereux. En vrai, pour descendre bas, tes genoux doivent avancer. Regarde.\n\nCe qui compte, c'est que ton genou parte dans la même direction que ton pied. Pas vers l'intérieur.\n\nEssaie devant un miroir : pieds un peu ouverts, tu descends, et tu pousses tes genoux vers l'extérieur.\n\nEnregistre la vidéo pour ta prochaine séance.",
  plans: "- Vidéo, 6 s : un squat de profil, tes genoux avancent au-dessus des pieds ; à hauteur de hanche, à la verticale. Pour « tes genoux doivent avancer ».\n- Vidéo, 6 s : un squat de face, le genou rentre puis suit le pied ; plan serré sur les jambes. Pour « pas vers l'intérieur ».\n- Vidéo, 8 s : toi devant le miroir, pieds un peu ouverts, tu descends ; plan large. Pour « essaie devant un miroir ».\n- Photo : tes pieds au sol, un peu ouverts, vus du dessus. Pour « pieds un peu ouverts ».",
  legende: "Tes genoux peuvent dépasser tes pieds. Ce qui compte vraiment, c'est leur direction.\n\nEssaie l'exercice du miroir à ta prochaine séance et dis-moi en commentaire si tu sens la différence.",
  accroches: [
    { n: 1, texte: "Tes genoux ne doivent jamais dépasser tes pieds ? Faux." },
    { n: 2, texte: "Tu as peur que tes genoux dépassent tes pointes de pieds quand tu fais un squat ?" },
    { n: 3, texte: "Le squat que je corrige le plus souvent." },
    { n: 4, texte: "Voici ce qui compte vraiment au squat." },
  ],
  accroche: 2,
  a_verifier: "- « pieds un peu ouverts » : tu ouvres de combien chez tes clients ? Je n'ai pas trouvé de chiffre dans ce que tu as dit.",
  duree: "≈45 s (35 à 55 s)",
};
const SLIDES_ERREURS = [
  { n: 1, titre: "5 erreurs quand tu reprends le sport", texte: "", photo: "toi à la salle, de face, de la place en haut pour le texte" },
  { n: 2, titre: "Trop, trop vite", texte: "Cinq séances la première semaine.\n\nTu lâches la deuxième.", photo: "toi qui t'assois sur un banc, l'air fatigué" },
  { n: 3, titre: "Pas de pause", texte: "Le muscle se construit au repos.", photo: "aucune, fond noir" },
  { n: 4, titre: "Copier un programme d'athlète", texte: "Ton programme part de ta semaine, pas de la sienne.", photo: "ton carnet de séance ouvert sur la table" },
  { n: 5, titre: "Enregistre pour ta reprise", texte: "Et envoie-le à quelqu'un qui reprend.", photo: "aucune, fond noir" },
];

const LIGNES_PLANCHE = [
  "Accroche face caméra : « Tu manges des protéines le matin ? »",
  "Ton plan dans la cuisine : tu sors le skyr",
  "Même plan : tu verses les flocons",
  "Le chiffre à l'écran : 20 à 30 g",
  "Ta main ouverte : une paume de protéines",
  "Face caméra : les trois exemples",
  "Ton plan du bol fini, vu de haut",
  "Face caméra : « Enregistre pour demain matin »",
  "Le mot en commentaire : PETITDEJ",
];

// ---------- L'API fabriquée ----------
export function creerApiMaquette() {
  const d = fabriquer();
  let ecouteurs = null;
  const emettre = (type, data) => { if (ecouteurs) setTimeout(() => ecouteurs.onEvenement(type, data), 0); };
  const toutes = () => [...d.propositions, ...d.contenus];
  const parSlug = (s) => d.contenus.find((c) => c.slug === s);
  const majCarte = (c, champs) => {
    Object.assign(c, champs, { maj: maintenant() });
    c.libelle = libelle(c); c.fichiers = fichiersDe(c); c.semaine = c.jour_prevu ? lundiDe(c.jour_prevu) : null;
    emettre("carte", { ...c });
  };
  const config = { prenom: document.documentElement.dataset.prenom || "Romain", jours_par_defaut: ["mardi", "jeudi", "dimanche"], heures_par_defaut: { reel: "18:30", carrousel: "12:15" } };
  let nAction = 10; const recaps = {};

  function chatDe(id) { return (d.chats[id] ||= { etat: null, messages: [] }); }
  function pousser(id, msg, partiel) {
    const ch = chatDe(id);
    const i = ch.messages.findIndex((m) => m.n === msg.n);
    if (i >= 0) ch.messages[i] = msg; else ch.messages.push(msg);
    if (msg.type === "etat") ch.etat = msg.etat;
    emettre("chat", partiel ? { chat_id: id, message: msg, partiel: true } : { chat_id: id, message: msg });
  }
  const enCours = {};
  async function repondre(id, texteRomain) {
    const jeton = (enCours[id] = Symbol());
    let n = (chatDe(id).messages.at(-1)?.n || 0) + 1;
    pousser(id, { n: n++, le: maintenant(), role: "romain", type: "texte", texte: texteRomain });
    pousser(id, { n: n++, le: maintenant(), role: "studio", type: "etat", etat: "en_cours" });
    const slug = id.includes(":") ? id.split(":")[0] : null;
    const c = slug && parSlug(slug);
    if (c) majCarte(c, { activite: "en_cours", a_toi: false });
    const monteur = id.endsWith(":monteur");
    const activites = monteur ? ["je relis ta planche", "je raccourcis le moment 4"] : (slug ? ["je relis ton brief", "je mets ton texte à jour"] : ["je regarde ce qui a marché cette semaine"]);
    for (const a of activites) { await attendre(700); if (enCours[id] !== jeton) return; pousser(id, { n: n++, le: maintenant(), role: "studio", type: "activite", texte: a }); }
    const reponse = monteur
      ? "C'est noté. Je finis la vidéo, elle arrive dans « Vidéo montée » dans quelques minutes."
      : slug ? "C'est fait, relis ton « Brief » : si ça te va, valide."
        : "Les 2 idées sont prêtes, tu les vois dans « Idées proposées ».";
    const mots = reponse.split(" ");
    const nTexte = n++;
    for (let i = 1; i <= mots.length; i++) {
      await attendre(90);
      if (enCours[id] !== jeton) return;
      pousser(id, { n: nTexte, le: maintenant(), role: "studio", type: "texte", texte: mots.slice(0, i).join(" ") }, i < mots.length);
    }
    pousser(id, { n: n++, le: maintenant(), role: "studio", type: "etat", etat: "a_toi" });
    if (c) majCarte(c, { activite: null, a_toi: true });
  }

  function lancerFile() {
    if (d.file.some((a) => a.statut === "en_cours" && a.id !== "a-1")) return;
    const a = d.file.find((x) => x.statut === "en_file");
    if (!a) return;
    a.statut = "en_cours"; a.debut = maintenant();
    emettre("file", { actions: d.file.map((x) => ({ ...x })) });
    for (const s of a.slugs || [a.slug]) { const c = parSlug(s); if (c) majCarte(c, { activite: "en_cours" }); }
    setTimeout(() => {
      a.statut = "fini"; a.fin = maintenant();
      const suite = { script: "script_ecrit", tournage: "tournage_prevu", montage: "planche", mise_en_page: "mis_en_page" }[a.type];
      for (const s of a.slugs || [a.slug]) { const c = parSlug(s); if (c) majCarte(c, { activite: null, stade: suite, a_toi: a.type === "montage" }); }
      if (a.type === "tournage") {
        const h = new Date(); const hm = `${String(h.getHours()).padStart(2, "0")}${String(h.getMinutes()).padStart(2, "0")}`;
        const t = { id: `${aujourdhui()}-${hm}`, cree_le: `${aujourdhui()}T${hm.slice(0, 2)}:${hm.slice(2)}:00+01:00`, contenus: a.slugs, duree_estimee_min: 25, en_cours: true };
        d.tournages.unshift(t);
        for (const s of a.slugs) { const c = parSlug(s); if (c) c.tournage_id = t.id; }
        emettre("tournages", { tournages: d.tournages.map((x) => ({ ...x })) });
      }
      d.file = d.file.filter((x) => x !== a);
      emettre("file", { actions: d.file.map((x) => ({ ...x })) });
      lancerFile();
    }, 8000);
  }

  function briefDe(c) {
    if (d.briefs[c.slug]) return d.briefs[c.slug];
    let b;
    if (c.format === "reel") {
      b = c.slug === "squat-ou-vont-tes-genoux" ? { ...BRIEF_SQUAT, accroches: BRIEF_SQUAT.accroches.map((a) => ({ ...a })) } : {
        texte: `Le texte de « ${c.titre} », mot à mot, comme tu le dis face caméra.\n\nDeuxième paragraphe : l'explication, avec un exemple de tes séances.\n\nLa fin : ce que la personne fait dès aujourd'hui.`,
        plans: "- Vidéo, 8 s : dans la cuisine, une seule prise, trois gestes ; plan large, à la verticale. Pour « tu prépares ton bol ».\n- Photo : ton bol fini, vu du dessus. Pour « voilà ce que ça donne ».",
        legende: `${c.titre}.\n\nEnregistre la vidéo pour la refaire demain.`, a_verifier: null, duree: "≈50 s (40 à 60 s)",
        accroches: [{ n: 1, texte: `Le texte de « ${c.titre} », mot à mot, comme tu le dis face caméra.` }, { n: 2, texte: "Tu fais sûrement cette erreur sans le savoir." }], accroche: 1,
      };
      if (c.slug === "gainage-qui-sert") {
        // Un vrai texte au format du lot 14 : un morceau dit d'une traite par ligne, une ligne vide entre
        // deux parties (l'en-tête du script dit « - Découpage : un morceau par ligne »).
        b.texte = "Ton gainage ne sert à rien si tu fais ça.\nTu tiens la planche deux minutes, le dos creusé, les fesses en l'air.\n\nRegarde. Tu rentres le nombril, tu serres les fesses.\nEt tu pousses le sol avec tes avant-bras.\nTrente secondes comme ça, c'est plus dur que deux minutes mal faites.\n\nCommence par trois fois trente secondes.\nEt dis-moi en commentaire combien tu tiens.";
        b.decoupage = "morceaux";
        b.accroches = [{ n: 1, texte: "Ton gainage ne sert à rien si tu fais ça." }, { n: 2, texte: "Deux minutes de planche, zéro résultat ?" }];
      }
      if (c.slug === "proteines-au-petit-dej") b.message_auto = "- Mot : PETITDEJ\n- Message : « Salut ! Voilà les trois petits-déj de la vidéo, avec les quantités en paumes. Dis-moi lequel tu testes. »";
      b.genre = "reel";
    } else {
      b = { genre: "carrousel", slides: c.slug === "5-erreurs-reprise-sport" ? SLIDES_ERREURS.map((s) => ({ ...s })) : SLIDES_ERREURS.slice(0, 4).map((s, i) => ({ ...s, titre: i === 0 ? c.titre : s.titre })),
        legende: "Enregistre-le pour ta reprise, et envoie-le à quelqu'un qui recommence.", modifiable: true, brut: null, a_verifier: null };
    }
    b.empreinte = empreinte();
    d.briefs[c.slug] = b;
    return b;
  }

  function montageDe(c) {
    if (c.montage) return c.montage;
    c.montage = {
      rushs: [
        { id: "face/IMG_2001.MOV", url: VIDEO, type: "face", titre: "Plan face caméra", detail: "Reconnu à ce que tu dis dans ton texte.", vignette_url: vignette("salon", "#3d3530") },
        { id: "b-roll/20261116-143012-kq3x.mov", url: VIDEO, type: "b-roll", titre: "Tu ouvres le frigo, puis tu sors le skyr", vignette_url: vignette("cuisine", "#6b4a35"),
          detail: "Cuisine · 13 s · pour « à 16 h, tu ouvres le frigo » Ce que je vois : tu ouvres un frigo et tu sors un pot blanc." },
        { id: "b-roll/20261116-143410-p2mz.mov", url: VIDEO, type: "b-roll", titre: "Tu inspires en montant, tu souffles en poussant", vignette_url: vignette("salle", "#4d5a3f"),
          detail: "Salle · 9 s · pour « tu souffles quand tu pousses » Ce que je vois : un développé couché, de profil." },
      ],
      manquants: [{ titre: "Photo : ta gourde posée sur le banc", detail: "Salle · pour « garde ta gourde à côté » · pas encore arrivé" }],
    };
    return c.montage;
  }

  function detail(slug) {
    const c = parSlug(slug);
    if (!c) throw new ErreurStudio("INTROUVABLE", "Ce contenu n'existe plus.", 404);
    const textes = { idee: `# ${c.titre}\n\n- Format : ${c.format}\n- Source : idée de ${config.prenom} du 12/11\n\n**L'angle** : ce que tu fais faire à tes clients, montré simplement, avec une erreur fréquente et sa correction.\n\n**Ce que tu en as dit** : « je le vois tout le temps en séance ».` };
    const medias = { rushs: [] };
    const res = { ...c, textes, medias };
    if (c.stade !== "gardee") res.brief = briefDe(c);
    if (c.fichiers.includes("montage")) res.montage = montageDe(c);
    if (c.stade === "planche") { medias.planche = planche(); medias.planche_lignes = LIGNES_PLANCHE.map((ligne, i) => ({ n: i + 1, ligne })); }
    if (c.fichiers.includes("video")) medias.video_montee = VIDEO;
    if (c.fichiers.includes("slides")) medias.slides = [slide(1, c.titre, "#111111", "#F3F3F3"), slide(2, "Une par semaine", "#F5F3EF", "#151515"), slide(3, "Deux, c'est bien", "#F5F3EF", "#151515"), slide(4, "Trois si tu peux", "#F15A24", "#111111"), slide(5, "Enregistre", "#111111", "#F3F3F3")];
    if (c.stade === "programme") res.publication = { statut: "programmé", quand: c.programme_le, lien: null };
    if (c.stade === "publie") res.publication = { statut: "publié", quand: `${c.jour_prevu} 18:30`, lien: "#publication" };
    return res;
  }

  function fabriquerRecap(elements) {
    const id = "r-" + Date.now();
    const els = elements.map(({ slug, quand }) => {
      const c = parSlug(slug);
      const reel = c.format === "reel";
      const e = { slug, titre: c.titre, type: c.format, quand, legende: briefDe(c).legende, mot: reel ? "HANCHES" : null, verdict: "OK", messages: [] };
      if (reel) e.video_url = VIDEO;
      else e.slides_urls = [slide(1, c.titre, "#111111", "#F3F3F3"), slide(2, "Une par semaine", "#F5F3EF", "#151515"), slide(3, "Trois si tu peux", "#F15A24", "#111111")];
      if (!reel) { e.verdict = "ATTENTION"; e.messages = ["Pas de mot en commentaire : personne ne recevra de message automatique. Ça peut partir comme ça."]; }
      if (quand && quand.slice(0, 10) < aujourdhui()) { e.verdict = "BLOQUE"; e.messages = ["Cette date est déjà passée : choisis un autre jour."]; }
      return e;
    });
    recaps[id] = els;
    return { recap_id: id, elements: els };
  }

  // Le plan de tournage (lot 12, cartes par type au lot 13) : fabriqué depuis les contenus du plan.
  const suivis = {};
  const suiviDe = (t) => (suivis[t.id] ||= t.en_cours ? { coches: [1], sautees: [], envoi: false, verification: null, valide_le: null, rangement: null }
    : { coches: [], sautees: [], envoi: true, verification: null, valide_le: t.cree_le, rangement: { places: 6, a_ranger: 0 } });
  function bullesDe(t) {
    const titres = t.contenus.map((s) => parSlug(s)?.titre || s);
    const r = t.contenus.map((s, i) => {
      const c = parSlug(s);
      const b = c && c.format === "reel" ? briefDe(c) : null;
      return { n: i + 1, type: "face", titre: "Face caméra", lieu: "là où tu tournes d'habitude", materiel: [], duree_s: 50, deja: false,
        contenus: [{ slug: s, titre: titres[i] }], decoupage: b?.decoupage || null,
        script: (b?.decoupage === "morceaux" ? b.texte : b?.texte?.replace(/\n\n/g, "\n")) || null,
        accroche: b?.accroches?.find((a) => a.n === b.accroche)?.texte || null };
    });
    let n = r.length;
    r.push({ n: ++n, type: "b-roll", titre: "B-roll", lieu: "salle", materiel: ["tapis"], duree_s: 25, deja: false, contenus: t.contenus.slice(0, 2).map((s, i) => ({ slug: s, titre: titres[i] })),
      mouvements: [
        { texte: "tu tiens une planche sur les avant-bras", phrases: [{ phrase: "ton gainage ne sert à rien si tu fais ça", titre: titres[0] }] },
        { texte: "tu passes sur les genoux, tu souffles en poussant", phrases: [{ phrase: "tu souffles quand tu pousses", titre: titres[1] || titres[0] }] },
      ], consigne: "une seule prise, sans couper ; de profil, à la verticale" });
    r.push({ n: ++n, type: "b-roll", titre: "B-roll", lieu: "cuisine", materiel: [], duree_s: 0, deja: true, contenus: [{ slug: t.contenus[0], titre: titres[0] }],
      mouvements: [{ texte: "tu ouvres le frigo et tu sors le skyr", phrases: [] }], consigne: null });
    r.push({ n: ++n, type: "photo", titre: "Photo", lieu: "salle", materiel: [], duree_s: null, deja: false, contenus: [{ slug: t.contenus.at(-1), titre: titres.at(-1) }],
      photo: "ta gourde posée sur le banc", phrases: [{ phrase: "garde ta gourde à côté", titre: titres[1] || titres[0] }] });
    return r;
  }
  function verifier(t, s) {
    const bulles = bullesDe(t).filter((b) => !b.deja && !s.sautees.includes(b.n));
    const videos = bulles.filter((b) => b.type !== "photo").length; const photos = bulles.filter((b) => b.type === "photo").length;
    const recu = { videos: Math.min(videos, s.coches.length + 1), photos: 0 };
    const manque = { videos: videos - recu.videos, photos };
    const complet = !manque.videos && !manque.photos;
    const morceaux = [manque.videos ? `${manque.videos} vidéo${manque.videos > 1 ? "s" : ""}` : null, manque.photos ? `${manque.photos} photo${manque.photos > 1 ? "s" : ""}` : null].filter(Boolean);
    return { complet, attendu: { videos, photos }, recu, manque, message: complet ? "Tout est arrivé. Tu peux valider la fin du tournage."
      : `Je ne vois pas encore tous tes fichiers : il manque ${morceaux.join(" et ")} (j'en vois ${recu.videos} vidéo${recu.videos > 1 ? "s" : ""} et 0 photo). Attends que l'envoi soit fini, puis recoche.` };
  }
  function planDe(t) {
    const s = suiviDe(t);
    return { ...t, contenus: t.contenus.map((x) => ({ slug: x, titre: parSlug(x)?.titre || x })), texte: null, bulles: bullesDe(t),
      suivi: { ...s, peut_valider: Boolean(s.envoi && s.verification?.complet && !s.valide_le && !s.rangement?.en_cours) } };
  }

  return {
    maquette: true,
    async etat() {
      await attendre(120);
      return { cartes: toutes().map((c) => ({ ...c })), a_ranger: d.a_ranger.map((f) => ({ ...f })), file: d.file.map((a) => ({ ...a })), sync: { ...d.sync }, tournages: d.tournages.map((t) => ({ ...t })), config };
    },
    async carte(slug) { await attendre(100); return detail(slug); },
    async tournage(id) {
      await attendre(100);
      const t = d.tournages.find((x) => x.id === id);
      if (!t) throw new ErreurStudio("INTROUVABLE", "Je ne trouve pas ce plan de tournage.", 404);
      return planDe(t);
    },
    async cocherPlan(id, cle, coche) {
      await attendre(150);
      const t = d.tournages.find((x) => x.id === id); const s = suiviDe(t);
      if (cle === "envoi") { s.envoi = coche; s.verification = coche ? verifier(t, s) : null; }
      else s.coches = coche ? [...new Set([...s.coches, cle])] : s.coches.filter((x) => x !== cle);
      return planDe(t);
    },
    async sauterPrise(id, n, sautee) {
      await attendre(150);
      const t = d.tournages.find((x) => x.id === id); const s = suiviDe(t);
      s.sautees = sautee ? [...new Set([...s.sautees, n])] : s.sautees.filter((x) => x !== n);
      s.coches = s.coches.filter((x) => x !== n);
      if (s.envoi) s.verification = verifier(t, s);
      return planDe(t);
    },
    async validerTournage(id) {
      await attendre(300);
      const t = d.tournages.find((x) => x.id === id); const s = suiviDe(t);
      s.verification = verifier(t, s);
      if (!s.verification.complet) { const e = new ErreurStudio("PAS_COMPLET", s.verification.message, 409); e.donnees = planDe(t); throw e; }
      s.rangement = { en_cours: true };
      setTimeout(() => { s.rangement = { places: 4, a_ranger: 0 }; s.valide_le = maintenant(); t.en_cours = false; emettre("tournages", { tournages: d.tournages.map((x) => ({ ...x })) }); }, 2500);
      return planDe(t);
    },
    async ouvrirLien() { await attendre(100); return {}; },
    async garder(id, jour) {
      await attendre(300);
      const p = d.propositions.find((x) => x.proposition_id === id);
      d.propositions = d.propositions.filter((x) => x !== p);
      emettre("carte_retiree", { proposition_id: id });
      const slug = p.titre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
      const c = { slug, titre: p.titre, format: p.format, stade: "gardee", activite: null, a_toi: false, jour_prevu: jour || null, declinaison_de: p.declinaison_de, maj: maintenant() };
      c.libelle = libelle(c); c.fichiers = fichiersDe(c); c.semaine = jour ? lundiDe(jour) : null;
      d.contenus.push(c); emettre("carte", { ...c });
      return { slug };
    },
    async mettreDeCote(id) {
      await attendre(250);
      const p = d.propositions.find((x) => x.proposition_id === id);
      Object.assign(p, { stade: "de_cote", libelle: "mise de côté" }); emettre("carte", { ...p });
      return {};
    },
    async reprendre(id) {
      await attendre(250);
      const p = d.propositions.find((x) => x.proposition_id === id);
      Object.assign(p, { stade: "proposee", libelle: "idée proposée" }); emettre("carte", { ...p });
      return {};
    },
    async accroche(slug, n) {
      await attendre(300);
      const c = parSlug(slug); const b = briefDe(c);
      const ancienne = b.accroches.find((a) => a.n === b.accroche); const neuve = b.accroches.find((a) => a.n === n);
      if (ancienne && b.texte.startsWith(ancienne.texte)) b.texte = neuve.texte + b.texte.slice(ancienne.texte.length);
      else b.texte = `${neuve.texte}\n\n${b.texte}`;
      b.accroche = n; b.empreinte = empreinte();
      if (c.stade === "valide") majCarte(c, { stade: "script_ecrit" }); else emettre("carte", { ...c });
      return { empreinte: b.empreinte };
    },
    async supprimer(id) { return this.refuser(id); },
    async refuser(id) {
      await attendre(250);
      d.propositions = d.propositions.filter((x) => x.proposition_id !== id);
      emettre("carte_retiree", { proposition_id: id });
      return {};
    },
    async valider(slug) { await attendre(400); majCarte(parSlug(slug), { stade: "valide", a_toi: false }); return {}; },
    async jour(slug, jour) { await attendre(250); majCarte(parSlug(slug), { jour_prevu: jour || null }); return {}; },
    async abandonner(slug) { await attendre(250); majCarte(parSlug(slug), { stade: "abandonne", activite: null, a_toi: false }); return {}; },
    async brief(slug, corps) {
      await attendre(350);
      const c = parSlug(slug); const b = briefDe(c);
      if (corps.empreinte && corps.empreinte !== b.empreinte) throw new ErreurStudio("CHANGE", "Ton texte a changé entre-temps. Je te remets la dernière version : refais ta modification dessus.", 409);
      for (const k of ["texte", "plans", "legende"]) if (typeof corps[k] === "string") b[k] = corps[k].trim();
      for (const s of corps.slides || []) { const x = b.slides[s.n - 1]; if (x) { x.titre = s.titre; x.texte = s.texte; } }
      b.empreinte = empreinte();
      if (["valide"].includes(c.stade)) majCarte(c, { stade: "script_ecrit" }); else emettre("carte", { ...c });
      return { empreinte: b.empreinte };
    },
    async retirerRush(slug, id) {
      await attendre(300);
      const c = parSlug(slug); const m = montageDe(c);
      const r = m.rushs.find((x) => x.id === id);
      m.rushs = m.rushs.filter((x) => x.id !== id);
      d.a_ranger.push({ nom: id.split("/")[1], url: r?.url || VIDEO, vignette_url: r?.vignette_url, libelle: r ? `${r.type === "face" ? "ta vidéo face caméra" : "ton plan"} : ${r.titre.toLowerCase()}` : "ta vidéo",
        raison: "tu l'as retiré de ce contenu : dis-moi où il va", candidats: [] });
      emettre("a_ranger", { fichiers: d.a_ranger.map((f) => ({ ...f })) });
      emettre("carte", { ...c });
      return {};
    },
    async lancer(type, slugs) {
      await attendre(250);
      const lot = "l-" + Date.now();
      const base = { lot, statut: "en_file", cree_le: maintenant(), debut: null, fin: null, session: null, erreur: null };
      const nouvelles = type === "tournage" ? [{ id: `a-${++nAction}`, type, slugs, ...base }] : slugs.map((slug) => ({ id: `a-${++nAction}`, type, slug, ...base }));
      d.file.push(...nouvelles);
      for (const a of nouvelles) for (const s of a.slugs || [a.slug]) { const c = parSlug(s); if (c) majCarte(c, { activite: "en_file" }); }
      emettre("file", { actions: d.file.map((x) => ({ ...x })) });
      lancerFile();
      return { lot, actions: nouvelles };
    },
    async arreterAction(id) {
      await attendre(200);
      const a = d.file.find((x) => x.id === id);
      if (a) { d.file = d.file.filter((x) => x !== a); for (const s of a.slugs || [a.slug]) { const c = parSlug(s); if (c) majCarte(c, { activite: null }); } }
      emettre("file", { actions: d.file.map((x) => ({ ...x })) });
      lancerFile();
      return {};
    },
    async chat(id) { await attendre(100); const ch = chatDe(id); return { messages: ch.messages.map((m) => ({ ...m })), etat: ch.etat }; },
    async envoyer(id, texte) { await attendre(150); repondre(id, texte); return {}; },
    async arreterChat(id) {
      await attendre(150); enCours[id] = null;
      const ch = chatDe(id); const n = (ch.messages.at(-1)?.n || 0) + 1;
      pousser(id, { n, le: maintenant(), role: "studio", type: "etat", etat: "arrete" });
      const slug = id.includes(":") ? id.split(":")[0] : null; const c = slug && parSlug(slug); if (c) majCarte(c, { activite: null });
      return {};
    },
    async placer(fichier) {
      await attendre(300);
      d.a_ranger = d.a_ranger.filter((f) => f.nom !== fichier);
      emettre("a_ranger", { fichiers: d.a_ranger.map((f) => ({ ...f })) });
      return {};
    },
    async relancerRangement() { await attendre(300); return {}; },
    async recap(elements) { await attendre(450); return fabriquerRecap(elements); },
    async stats() {
      await attendre(150);
      // ?stats=absent : l'écran quand les chiffres ne sont pas encore lus (capture).
      if (new URLSearchParams(location.search).get("stats") === "absent") {
        return { disponible: false, source: "instagram", en_cours: false, historique: [], publications: [],
          erreur: `Je n'arrive pas à lire tes chiffres Instagram pour l'instant. Je réessaie dans une heure ; si ça dure, préviens ${CONTACT}.` };
      }
      return { ...d.stats };
    },
    async actualiserStats() { await attendre(900); d.stats = { ...d.stats, maj: maintenant(), chiffres_du: maintenant() }; return { ...d.stats }; },
    async confirmer(recap_id) {
      await attendre(800);
      const resultats = (recaps[recap_id] || []).map((e) => {
        if (e.verdict === "BLOQUE") return { slug: e.slug, statut: "bloque", message: e.messages[0] };
        majCarte(parSlug(e.slug), { stade: "programme", programme_le: e.quand, publication_quand: e.quand, jour_prevu: e.quand.slice(0, 10) });
        return { slug: e.slug, statut: "programmé", message: null };
      });
      return { resultats };
    },
    ecouter(h) { ecouteurs = h; setTimeout(() => h.onConnexion("ok"), 50); return () => { ecouteurs = null; }; },
    // pour les captures
    _demoRepondre: (id, texte) => repondre(id, texte),
    _demoNouvellesIdees() {
      const neuves = [
        { proposition_id: "p-10", titre: "La marche après le repas", format: "reel", angle: "Dix minutes après manger, ce que ça change pour ta glycémie et ta faim du soir.", source: { type: "chat" }, pourquoi_maintenant: "Tu l'as demandé dans le chat." },
        { proposition_id: "p-11", titre: "Les escaliers au bureau", format: "carrousel", angle: "Ton défi de la semaine en 5 images : un étage de plus chaque jour.", source: { type: "chat" }, pourquoi_maintenant: "Tu l'as demandé dans le chat." },
      ];
      neuves.forEach((p, i) => setTimeout(() => {
        const c = { ...p, slug: null, stade: "proposee", activite: null, a_toi: false, jour_prevu: null, maj: maintenant(), libelle: "idée proposée", fichiers: ["idee"] };
        d.propositions.push(c); emettre("carte", { ...c });
      }, i * 500));
    },
  };
}
