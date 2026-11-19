---
name: animations-yoan
description: >-
  Brique du monteur de Yoan (@ia.yoan). Prépare tout ce qu'on voit et entend dans son style à partir de son plan
  de montage, avec les gestes et la banque de motion de son pipeline de montage : hook (ouverture et titre en
  Anton derrière la tête, hook secondaire), faisceaux, pleins écrans à mots, demi-écrans, ses 17 gabarits de motion
  (fichier en héros, minuteur, liste sur le torse, schéma, comparaison...), mot derrière la tête, CTA au-dessus de
  la tête, animations sur mesure écrites avec la grammaire de motion validée par Yoan, sons de la famille « motion
  premium » et musique. Traduit le plan en couches du moteur partagé (zooms, aperçu, rendu). Utiliser quand le
  monteur de Yoan arrive à « préparer ce qu'on verra » ou retouche une animation.
---

# Animations, sons et musique de Yoan

Le **dessin** de chaque geste vient du pipeline de montage de Yoan (copié dans `moteur/`, valeurs dans
`moteur/style/style.json`, rien en dur ailleurs) ; le **zoom, le détourage, l'aperçu et le rendu** sont ceux du moteur
partagé avec Romain (briques `zooms` et `rendu`), sans changement. Le script `scripts/yoan.py` fait le pont : il lit
`plan-montage.json` (skill `plan-montage-yoan`) et écrit les couches au contrat des briques (`$SK/animations/CONTRAT.md`).
Si tu parles à Yoan : français, tutoiement, jamais de commande, de fichier ni de nom d'outil.

## Ce qu'il y a dans ce dossier
- `scripts/yoan.py` : `texte`, `regarder`, `valider`, `zooms`, `calques`, `sons` (aide : `python3 scripts/yoan.py`).
- `scripts/plan.py` : la résolution du plan (validateur du pipeline de Yoan + contraintes du moteur, sous-titres auto).
- `scripts/sur-mesure.mjs` : écrire une animation sur mesure avec les briques du style.
- `moteur/executeur/calques/` (gestes : `commun.mjs`, `gestes.mjs`), `moteur/briques/gabarits/<nom>/` (17 gabarits et
  leur README), `moteur/briques/encre/`, `moteur/briques/logos/`, `moteur/style/` (style.json, polices, grain, musiques),
  `moteur/executeur/valider_timeline.py` et `CONTRAT-TIMELINE.md` (le contrat d'origine du plan).
- `references/motion-design.md` : la grammaire du motion (After Effects traduit en HTML, CSS, SVG et GSAP) ; §10 = la
  barre de qualité de Yoan pour un effet qui illustre un propos.
- `references/exemple-annonce-memoire.mjs` : l'exemple canonique de §10 (`demi-haut-annonce-memoire` v5.3, cinq
  itérations validées par Yoan), à LIRE pour ses gestes (popIn, glisse, sortie accélérée, punch, poussée et dérive),
  son vocabulaire illustratif et ses règles de déterminisme. Il vient de l'ancienne banque : ne le lance pas.

## Le déroulé (après `yoan.py valider` vert)
Toutes les commandes : `STUDIO_CLIENT=yoan`, dossier = `<nom>-montage`, `Y` = `scripts/yoan.py` de ce skill.
1. **Zooms** : `python3 "$Y" zooms <dossier>` puis `/usr/bin/python3 "$SK/zooms/scripts/zooms.py" preparer <dossier>`.
   Le cadre serré du hook devient le dézoom d'ouverture (120 % vers 100 % jusqu'à la sortie du hook), les zooms éclair
   et rapprochements tiennent jusqu'à la coupe de prise qui suit. Regarde `zooms-apercu/`.
2. **Sur mesure** (si le plan en a, `A_ECRIRE` à la validation) : voir plus bas.
3. **Calques** : `python3 "$Y" calques <dossier>` (une vingtaine de secondes ; mesures de la tête par Apple Vision pour le
   hook, le mot derrière la tête et le CTA sur la caméra). Écrit `calques/<id>/` et les entrées « animations » de
   `calques.json` :
   | Calque | Couche, ordre | Ce que c'est |
   |---|---|---|
   | `hook-titre` | derrière, 10 | ouverture puis titre Anton, troués par la tête ; suit le dézoom d'ouverture, posé sur la tête mesurée (haut des cheveux au tiers de la 2e ligne) |
   | `hook-secondaire` | devant, 31 | le second hook dans son cadre doré, là dès la première image |
   | `md<i>` | derrière, 12 | mot derrière la tête (Anton doré), sur les cheveux mesurés |
   | `de<i>` | devant, 20 | demi-écran (fond granuleux + gabarit), visage poussé (`plan.decalage_y`) |
   | `mo<i>` | devant, 22 ou 40 | gabarit de motion sur la caméra, ou plein écran (fond + gabarit) |
   | `pe<i>` | devant, 40 | plein écran à mots |
   | `sm<id>` | devant 45 (derrière s'il est troué) | animation sur mesure |
   | `cta<i>` | devant, 60 | CTA au-dessus de la tête (cheveux mesurés sur toute sa durée) ou sur fond |
   | `fx<i>` | devant, 90 | faisceau (la seule transition flash) |
4. **Sous-titres** : skill `sous-titres-yoan` (après les calques).
5. **Sons et musique** : `python3 "$Y" sons <dossier>` écrit `sons.json` : flash sur chaque faisceau, son du CTA à
   l'entrée du mot et ses lignes 11 dB plus bas, chaque `son` du plan à son niveau du style (whoosh 21, clic et pop 18,
   glisse 21, shimmer 22, curseur 20 dB RMS sous la voix ; famille générée pour Yoan, « motion premium SaaS explainer »),
   et la musique de l'ambiance du plan : une piste préparée une fois (`sons/musique-<ambiance>.wav`, tempo ramené à
   135, boucle reprise à la 2e mesure, 15 dB K sous la voix, ducking de 2 dB pendant la parole, entrée 0,3 s, sortie
   0,6 s), que l'aperçu et le rendu ajoutent telle quelle. Pas de brique sound-design ici (ses règles sont celles de
   Romain).
6. **Regarder** : la planche (`rendu`, « La planche ») aux moments clés, puis l'aperçu.

Une retouche : corrige le plan, relance seulement ce qui dépend du changement (`zooms` + brique zooms, `calques`,
sous-titres, `sons`), puis l'aperçu. Un calque d'un plan précédent qui n'est plus dans le plan est retiré seul.

## Le style de cette vidéo (`style-video.json`)
Le style (`moteur/style/style.json`) est le défaut. Une demande pour **cette vidéo** (une couleur, une durée ou une
entrée d'animation, le niveau d'un son) s'écrit dans `<nom>-montage/style-video.json`, clé `style`, avec les mêmes noms
que `style.json` et seulement ce qui change (ex. `{"style": {"couleurs": {"dore": "#E8C77A"}}}`,
`{"style": {"entrees": {"texte": {"flou": 6}}}}`). `yoan.py` (toutes ses commandes) et les sous-titres l'appliquent ;
relance ce qui en dépend (`calques`, sous-titres, `sons`) puis l'aperçu. `format` ne se change pas ; une clé inconnue est
refusée. L'étalonnage se règle dans le même fichier (skill `rendu`). Sans fichier, rien ne change.

## Le motion sur mesure
Quand le catalogue n'a rien qui illustre la phrase (règle du planificateur : le contenu d'une animation illustre la
phrase), tu l'écris toi-même pour ce montage. Il ne rentre jamais dans la banque.
1. **Vérifie d'abord** que rien du catalogue ne répond, réglages compris (lis les README de la famille, pas seulement les
   noms).
2. **Lis** `references/motion-design.md` (§5 recettes, §6 grammaire d'une séquence, §7 déterminisme, §10 barre de
   qualité, §11 relais de cartons) et, pour un effet qui illustre un propos, `references/exemple-annonce-memoire.mjs`.
3. **Écris** `<dossier>/sur-mesure/<id>.mjs` avec `scripts/sur-mesure.mjs` (exemple en tête du fichier) : les briques
   du style (`M.fondC`, `M.ent`, `M.sortie`, `M.croix`, `M.crochetsCss/Html/Entree`, `M.icone`, `M.logo`, `M.etiqCss`,
   `M.grainJs`, et les gabarits eux-mêmes comme parts), les instants par `instant(dossier, ancre)`. Lance-le avec node.
4. Dans le plan : `{"type": "sur_mesure", "calque": "calques/<id>", "de": ..., "a": ..., "plein"?: true}` et un `son` par
   événement visuel.
5. **Regarde-le** à plusieurs instants (planche de vignettes `{ "image": N }`) : un défaut de cette famille ne se voit
   qu'à l'image.
Règles (constructeur de Yoan) : un accent par intention (sur un reel de 30 s, le geste qui porte, pas les quatre qui
l'entourent) ; la courbe n'est jamais un paramètre ; un geste qui traverse les sous-titres (haut de l'image) se pose sur
le torse ; logos seulement dans une tuile, jamais de fausse capture d'interface ; toutes les couleurs et polices viennent
du style (doré #F2B544 avec halo, crème, fond granuleux ; Satoshi, Inter, JetBrains Mono, Anton) ; pas de `will-change`,
pas d'échelle sur une surface à texte (translation), bascules en `display`.

## Les erreurs
- `PLAN_REFUSÉ` / `FAUTE ...` : le plan est faux, corrige-le (skill plan-montage-yoan).
- `MESURE_IMPOSSIBLE` : personne n'est vu à l'image d'un mot derrière la tête ou du CTA : déplace le geste.
- `CALQUES_RATÉS` : un paramètre de gabarit illisible (lis son README) ou une erreur dans un sur mesure.
- `SUR_MESURE_A_ECRIRE` : l'animation sur mesure n'est pas encore écrite.

## Dépendances
Python 3 (numpy, scipy, Pillow, pyobjc Vision), Node 20+, ffmpeg 7+, la bibliothèque du style `yoan` du skill
`animations` (sons avec leur fiche d'attaque, Satoshi posée à l'installation, GSAP). Rien ne part sur un serveur.
