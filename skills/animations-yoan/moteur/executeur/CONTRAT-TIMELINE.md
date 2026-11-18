# Contrat de timeline (`timeline/1`)

Ce que le planificateur écrit et ce que `monter.py` exécute. La timeline dit QUOI et QUAND, jamais COMMENT : tailles,
couleurs, durées, courbes, niveaux sont dans `style/style.json` et `style/REGLES.md`. Validation :
`python3 executeur/valider_timeline.py <timeline.json>` (exit ≠ 0 et la liste des fautes si invalide).

## En-tête

```json
{ "contrat": "timeline/1",
  "rush": "chemin/IMG_7203.mov",              // la rush 4K (relatif au fichier timeline, ou absolu)
  "preparation": "chemin/dossier",            // sortie de la préparation : edl.json + words.cut.json
  "densite": "sobre" | "dense",               // régime de REGLES.md (Densité), contrôlé à titre indicatif
  "ambiance": "hiphop" | "trap" | "boombap" | "nappe" | null,   // null : pas de musique
  "elements": [ ... ] }
```

Le choix et l'ordre des prises sont dans `edl.json` (préparation) : la timeline ne les change pas. Le reel dure la
somme des segments de l'EDL.

## Ancres : jamais de secondes en dur

Tout instant est une ancre, résolue sur `words.cut.json` (temps de sortie) :

| Ancre | Instant |
|---|---|
| `"manière"` | attaque du mot (s'il n'apparaît qu'une fois ; sinon le validateur refuse et liste les occurrences) |
| `"contexte#2"` | attaque de la 2e occurrence du mot |
| `"toi#1:fin"` | fin du mot |
| `"fichier#3-0.10"`, `"voix#2:fin+0.2"` | décalage en secondes, toujours à la fin |
| `"@coupe4"` | 4e jointure de l'EDL (entre les segments 4 et 5) |
| `"@debut"`, `"@fin"` | début et fin du reel |

Comparaison sans casse ni ponctuation (`l'IA` = `l'ia`, `toi.` = `toi`). Les jetons de ponctuation seuls (`«`, `»`)
ne comptent pas. **Avance :** une ancre sur l'attaque d'un mot vise l'image où le geste démarre, et le pilote retire
lui-même l'avance du style (0,04 s) ; ne pas la compter. Les mots affichés (sous-titres, plein écran, annotations) se
calent seuls sur leur mot.

Dans les `params` d'un gabarit, un instant s'écrit `{"@": "ancre"}` ; le pilote le convertit en secondes depuis le
début du calque.

## Éléments

Chaque élément a un `type`. Champs `de` / `a` = fenêtre de l'élément.

| `type` | Champs | Ce que le pilote déduit seul |
|---|---|---|
| `hook` | `lignes` (2 chaînes), `dore`, `ouverture`?: `{depuis?, groupes}`, `titre`?, `secondaire`?, `cadre`?: `serre`\|`large`\|`{variante, vers}`, `jusqua`, `sortie`: `dezoom_eclair`\|`coupe` | cadre du hook, rythme des mots du titre, ouverture et titre troués par la tête, détourage, pas de sous-titres jusqu'à `jusqua` |
| `sous_titres` | `depuis` (premier mot), `groupes`: `[["LIGNE 1\|LIGNE 2", "MOT DORÉ" ou "EXPRESSION DORÉE"?, {"crochets": false, "accent": "fort"}?], ...]` | chaque mot affiché consomme le mot suivant de la voix ; coupés pendant hook, plein écran à mots, CTA ; sans crochets sur un B-roll |
| `zoom` | `geste`: `eclair`\|`adouci`\|`lent`, `a`, `fin` (lent), `sortie`: `{geste: coupe\|dezoom_eclair\|dezoom_lent\|retour_adouci, a, fin?}` | échelles, durées, flou de mouvement, centre entre les yeux |
| `suivi` | `de`, `a` | visages Apple Vision, lissage, zoom de base |
| `mot_derriere` | `mot`, `a`, `jusqua` | haut des cheveux et centre de la tête mesurés, détourage |
| `plein_ecran` | `de`, `a`, `variante`: `seule`\|`milieu`, `lignes` (chaînes), `dore` | faisceaux et flash aux deux bouts, chaque mot calé sur sa voix, recadrage caméra au retour |
| `demi_ecran` | `de`, `a`, `contenu` (gabarit), `bascule`?: `{type: pousse\|faisceau, a}`, `sortie`?: `remonte`\|`coupe` | caméra poussée (même loi que le calque), flash sur la bascule faisceau |
| `broll` | `de`, `a`, `visuel`: `"dossier"`, `annotations`: [ancre, ...] | noir et blanc, zoom lent, retour au blanc des annotations |
| `cta` | `support`: `camera`\|`fond`, `mot`, `consigne`, `bas`, `quand`: `{consigne, mot, bas, faisceau?}`, `jusqua` | haut des cheveux, sons d'apparition et des lignes, faisceau et flash (fond) |
| `faisceau` | `a`, `recadrage`?: `true` | flash ; avec recadrage, la caméra passe au cadre de retour du plein écran |
| `motion` | `gabarit` (dossier de `briques/gabarits/`), `support`: `plein`\|`camera`, `de`, `a`, `params`, `tics`?: [ancres] | fond et faisceaux (plein) ; un tic par ancre de `tics` |
| `sur_mesure` | `calque` (dossier HyperFrames déjà écrit, `index.html`), `de`, `a`, `plein`?, `perforer`?, `tics`? | rendu, pose à `de`, coupé à `a` ; `plein` : faisceaux et flash aux deux bouts |
| `son` | `son`: `tic`\|`flash`\|`cta`\|`cta_lignes`\|un effet de `style.json` (`whoosh`, `clic`, `pop`, `glisse`, `shimmer`, `curseur`), `a`, `duree`? ; ou `fichier` (son propre au reel, relatif à la timeline) + `sousVoix` (dB de RMS actif sous la voix, négatif = au-dessus) | seulement si une règle ne le déduit pas (ex. le minuteur à la manière du CTA : `cta` à son entrée, `cta_lignes` 0,25 s après) |

### Le hook (2026-10-23, retours de Yoan sur la démo)

```json
{"type": "hook", "cadre": {"variante": "large", "vers": "droite"},
 "ouverture": {"groupes": [["VOICI CE QUI"], ["TE MANQUE|POUR QUE"], ["TON IA SONNE"]]},
 "lignes": ["EXACTEMENT", "COMME TOI"], "dore": "EXACTEMENT", "secondaire": "COMMENT DONNER|TA VOIX À UNE IA",
 "jusqua": "@coupe1", "sortie": "dezoom_eclair"}
```

- `ouverture` : les mots dits AVANT le titre, en groupes comme `sous_titres` (une ou deux lignes, `|` pour la ligne,
  mot doré facultatif), à partir de `depuis` (défaut : le premier mot de la voix). Ils défilent derrière la tête, en
  Anton, sur les lignes du titre, chaque mot calé sur sa voix ; un groupe disparaît net au début du suivant. Aucun mot du
  titre dans l'ouverture (le titre ne se double pas).
- `titre` : ancre où le titre commence à s'installer (défaut : le mot qui suit l'ouverture ; sans ouverture, 0,06 s).
  Ses mots entrent ensuite au rythme du style (`hook.titre.rythme`).
- `secondaire` : le hook secondaire, texte libre en MAJUSCULES, une ou deux lignes (`|`), 18 caractères par ligne au
  plus. C'est un deuxième hook qui donne envie de rester, jamais une catégorie (« IA POUR COACHS » refusé). Rectangle
  noir à coins arrondis, contour doré lumineux, à hauteur de poitrine ; entrée, place et variante dans `style.json`
  (`hook.secondaire`). `etiquette` n'existe plus : le validateur la refuse.

### 2e passage de Yoan (2026-10-23)

- `hook.cadre` : `large` (zoom 1,15, cheveux à y 430, tête décalée de 60 px du côté opposé à `vers`) quand une animation se
  pose là où la main pointe ; `serre` (1,30, défaut). Le cadre de sortie du hook suit.
- Doré d'un groupe : un mot, ou une **expression** de plusieurs mots qui se suivent sur une même ligne (crochets autour de
  toute l'expression, au dernier mot). `{"accent": "fort"}` : le groupe entier est l'expression, en grand (deux lignes au
  plus, chaque ligne dans 840 px), entre quatre « + », sans lignes ni crochets. Refusé : expression sur deux lignes,
  expression absente, accent fort sur une partie du groupe ou trop large.
- **Pleins écrans enchaînés** : un `plein_ecran`, `motion` plein ou `sur_mesure` plein dont `de` est le `a` d'un autre plein
  continue le même fond, sans faisceau ni flash à la jonction ; la chaîne compte pour un seul état (1,6 s au moins). Les
  sous-titres reviennent sur un `motion` plein (en haut).
- Une image passée à un gabarit (`params.image` d'un `motion`, ex. `objet-tournant`, `image-plein`) est relative au fichier
  timeline ; le pilote la copie dans le calque. Une image sous droits n'entre que là, jamais dans les briques.
- `son` : les effets du motion (famille « motion premium SaaS explainer » du 3e passage : `whoosh`, `clic`, `pop`, `glisse`,
  `shimmer`, `curseur`), comme le `tic`, seulement dans une fenêtre d'animation (l'accent fort en est une, pour le clic de
  ses « + ») ; `duree` coupe l'effet (curseur qui se déplace 0,3 s) ; `fichier` + `sousVoix` pour un son propre au reel
  (moment drôle), jamais rangé dans le style.
- CTA sur la caméra : au-dessus de la tête sans la chevaucher (3e passage) ; `position: torse` est refusée.

Contenu d'un demi-écran ou d'un `motion` : `{"gabarit": "liste-cascade", "params": {...}}`, imbricable
(`panneau-viseurs` avec `"contenu": {"gabarit": ...}`). `champ-chat` = le champ de chat des cartes r3-03
(`texte`, `entree`, `debutFrappe`). Paramètres de chaque gabarit : son README dans `briques/gabarits/`.
`sur_mesure` est le point d'entrée du futur constructeur : il fournit un calque écrit, le pilote ne fait que le poser.

## Règles contrôlées (exit ≠ 0)

- Toute ancre se résout ; tout mot affiché correspond à la voix ; groupes de sous-titres : un seul mot doré.
- Chaque jointure de l'EDL est cachée : faisceau, dézoom éclair, coupe sèche, sortie du hook, B-roll ou plein écran
  qui la couvre, demi-écran qui entre (au plus 0,7 s avant) ou sort sur elle.
- Zoom éclair : toujours une sortie, jamais de dézoom à moins de 0,3 s ; aucune coupe sèche pendant un mot.
- Aucun sous-titre pendant le titre du hook, un plein écran à mots ou le CTA ; aucun zoom pendant un plein écran ou
  un B-roll ; fenêtres dans le reel, `de` < `a`.
- Le son reste sur les animations et les transitions : un `tic` ou un effet du motion hors de toute fenêtre d'animation est
  refusé.
- Rythme des changements de monde (seuils et sources : `style.json`, `transitions`) : un demi-écran n'entre pas moins
  de 0,9 s après la fin d'un mouvement de caméra rapide (zoom ou dézoom éclair, zoom ou retour adouci, coupe avec
  recadrage, dézoom de sortie du hook) ni pendant un tel mouvement ; zoom lent et dézoom lent ne comptent pas. Un état
  demi-écran ou plein écran tient au moins 1,6 s (plein écran à mots, `motion` plein, demi-écran avant sa bascule,
  plein écran après la bascule) ; une chaîne demi -> plein -> caméra où un état ne tient pas 1,6 s est refusée comme
  telle. Un retour à la caméra par une coupe (`sortie: coupe` d'un demi-écran) se cache : faisceau, dézoom éclair, ou
  coupe posée sur une coupe de prise (`@coupeN`).

Avertissements (sans échec) : état demi ou plein sous 2,4 s (le plus court du reel 4), densité hors du régime, mot ancré dont l'alignement est peu sûr (score < 0,2), contenu
de demi-écran qui entre avant la fin de la descente du fond (0,7 s : il traverse les sous-titres).

Tests : `python3 executeur/test/test_valider.py` (la démo passe ; 26 cas négatifs refusés, dont les trois transitions que Yoan
a refusées dans la démo v1 et les sept règles du 2e passage : expression sur deux lignes ou absente, accent fort partiel ou
trop large, son du motion hors animation, cadre inconnu ; au 3e passage : CTA sur le torse refusé, son de fichier sans niveau).
