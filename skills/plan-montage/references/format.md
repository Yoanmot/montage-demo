# Format du plan de montage (`plan-montage.json`)

Source unique du format (version 1, écrit le 2026-11-11, repris le 2026-11-13 quand le plan est passé
au monteur). Le contrat des briques (`../../animations/CONTRAT.md`, « Plan de montage ») y renvoie et
ne dit que ce que chaque brique en fait. Une clé inconnue n'est jamais exécutée : n'en
invente pas.

## Le fichier

`<nom>-montage/plan-montage.json`, écrit par toi à l'étape du plan, après les coupes et avant toute
autre brique, puis validé par Romain sur la planche (images de sa vidéo, une par moment du plan) avant la fabrication. Chaque brique
y lit ses clés : `caler.mjs` (animations) la clé `animations`, et toi, pour les autres briques, `coupes`,
`sous_titres`, `zooms`, `b_roll`. Si tu dois changer une ancre après validation, garde la version
validée à côté (`plan-montage.recu.json`).

## Les ancres

Une ancre désigne des mots que Romain dit dans la vidéo coupée :
- une **citation exacte** de `texte-sous-titres.md` (`"dix pas"`), ponctuation et majuscules
  ignorées ;
- `#n` pour la n-ième fois qu'il dit la même chose (`"douze semaines#2"`). Sans `#n`, une citation
  dite plusieurs fois est refusée (`ANCRE_AMBIGUE`) ;
- ou un **numéro de mot** de `words.cut.json` (`"w68"`, `"w68-w70"`). Préfère les citations : elles
  survivent à un nouveau `compiler`, les numéros non.
- Jamais de minutage.

Comme tu écris sur ce qu'il a vraiment dit, chaque ancre doit se trouver telle quelle dans le
texte : **2 à 4 mots**, distinctifs (le chiffre, le nom d'exercice, le mot clé), pas les liaisons
(« alors », « du coup ») ni une phrase entière. Une ancre qui pourrait tomber à trois endroits prend
son `#n`. Si la transcription a mal écrit un mot, l'ancre reprend le mot tel qu'il est écrit dans le
texte (l'orthographe se corrige dans les sous-titres, pas dans l'ancre).

## Les clés

| Clé | Absente | Contenu |
|---|---|---|
| `plan` | obligatoire | version du format : `1` |
| `video` | facultatif | titre court, pour reconnaître la vidéo |
| `notes` | facultatif | le niveau choisi, ce qui compte le plus. Pas de consigne de style : aucune brique ne l'exécute |
| `coupes` | `serre` | `{ "rythme": "normal" \| "serre" \| "tres-serre" }` : le rythme utilisé aux coupes |
| `sous_titres` | ses sous-titres (un seul style) | `{ "masquer", "vocabulaire", "citations" }` (ci-dessous) |
| `zooms` | quelques zooms avec retenue | `[{ "type": "suivi" \| "eclair" \| "rapprochement" \| "ouverture", "sur": ancre, "suivre"?, "echelle"?, "pourquoi"? }]` ; `[]` = aucun zoom |
| `b_roll` | aucun B-roll | `[{ "id", "clip", "quoi", "de", "a"?, "depart"?, "vitesse"? }]` (ci-dessous) |
| `animations` | aucune animation | liste de demandes (ci-dessous) |

Pas de clé `sons` : tu les places à l'étape sons (skill sound-design).

- `sous_titres` : un seul style depuis le 2026-11-13 (ceux de son ancien skill : Inter Black, pavé
  orange qui glisse, groupes découpés tout seuls) ; `style` et `mots_forts` n'existent plus (un ancien
  plan qui les donne : ignorés) ; `masquer` = `[{ "de": ancre, "a": ancre }]`,
  passages à ne pas sous-titrer (rare) ; `vocabulaire` = l'orthographe exacte des noms d'exercices,
  des mots de coach et des chiffres tels qu'ils doivent s'écrire (« GHD sit-up », « 12 », « 3 mois ») ;
  rappelle aussi dans `notes` : « chiffres toujours en chiffres dans les sous-titres » ; `citations` =
  `[{ "de": ancre, "a": ancre }]`, chaque passage où il cite une pensée ou une phrase (« tu vas te dire : Mince,
  c'est passé vite » : `{ "de": "mince", "a": "passé vite" }`) : facultatif, il fait ses propres groupes de
  sous-titres ; rien ne s'affiche en plus (pas de guillemets). Une animation qui affiche ses mots les retire des sous-titres
  (chaque mot n'est vu qu'une fois) : rien à écrire dans le plan pour ça.
- `zooms` : suivi = le zoom qui suit sa tête (l'image se resserre à 110 % puis le cadre suit sa tête
  jusqu'à la coupe), l'ancre est le début de la phrase ; éclair = part sur le premier mot de l'ancre (le
  mot qui claque) ; rapprochement = l'ancre est le début de la phrase qui monte ; ouverture = le dézoom
  de l'accroche (`echelle` 1.12 conseillée, 1.2 au plus, vers 100 % depuis l'image 0), l'ancre est le mot
  fort où il s'arrête net. `"suivre": true` donne le suivi de sa tête à un éclair ou un rapprochement.
- `b_roll` : un clip **filmé par Romain**, ou toute vidéo qu'il donne, même hors du brief (enregistrement d'écran,
  vidéo du dossier). Pas de B-roll généré par IA, sauf s'il le demande expressément.
  `{ "id": "b01", "clip": "<chemin complet du clip reçu>", "quoi": "<ce que montre le clip, vérifié
  sur sa vignette>", "de": ancre, "a": ancre, "depart": <s> }`. `a` absent = jusqu'au bout de la
  phrase. `depart` (facultatif) : à combien de secondes du clip on commence (temps mort au début,
  ou même clip réutilisé). `vitesse` (facultatif) : `"ajuster"` quand la scène doit tenir tout le
  passage (accélérée ou ralentie, de 0,5 à 4 fois), ou un nombre (`2` = deux fois plus vite). Le clip
  se cale tout seul sur les coupes qui bordent le passage.

## Une demande d'animation

```json
{
  "id": "a03",
  "geste": "carte-chapitre",
  "reglages": {},
  "intention": "Chapitre 2 : ce qu'il faut manger, annoncé avant qu'il l'explique.",
  "de": "deuxième erreur",
  "a": "tes repas",
  "elements": [
    { "texte": "2", "sur": "deuxième erreur", "role": "numero", "chiffre_source": "numéro de partie du plan" },
    { "texte": "tes repas", "sur": "tes repas", "role": "titre" }
  ],
  "photos": []
}
```
- `id` : `a01`, `a02`… dans l'ordre de la vidéo. Les calques prennent ce préfixe (`a03`, ou
  `a01-derriere` / `a01-devant` pour un gabarit à deux couches).
- `geste` : un nom de `gestes.md` (un dossier de `../animations/bibliotheque/`), ou `sur-mesure`.
- `intention` : toujours, en une ou deux phrases : ce qu'on doit comprendre et pourquoi ce geste
  (pour un plein écran, laquelle des raisons de `regles.md`). Obligatoire et précise pour
  `sur-mesure` (20 caractères au moins, mieux : 2 ou 3 phrases).
- `de`, `a` : le passage couvert. Transition (`transition-flash`, `transition-faisceau`) : `de`
  seulement, le premier mot après la coupe (un mot précédé d'un `/` dans le texte), pas d'`elements`.
- `elements` : chaque texte affiché et son mot (`sur`). `role` décrit l'élément (`numero`, `titre`,
  `mot`, `sous-titre`, `ligne`…). Pour une tier list, `rang` (donné par Romain) ; pour une liste,
  l'ordre. Un chiffre affiché doit être dit dans le passage ; sinon `chiffre_source` dit d'où il
  vient (numéro de partie), et jamais un chiffre sur lui ou ses clients qu'il ne dit pas.
- `reglages` : seulement ceux de `gestes.md` (objet `P` du gabarit : `fond`, `couleur`, `largeur`,
  `sortie`…).
- `photos` : `[{ "pour": "<élément>", "fichier": "<chemin>" | null, "quoi": "<ce que la photo doit
  montrer>" }]`. `fichier` = la photo qu'il t'a donnée ; `null` = un emplacement « image à fournir »
  est posé et tu la lui demandes. Une image de réaction : `quoi` commence par « à télécharger par le
  monteur » (tu la télécharges toi-même).
- `sa_ligne` : pour `tier-list`, `cta-mot-derriere`, `cta-champ-instagram` : `"garder"` (par
  défaut : la ligne du geste reste, les sous-titres s'effacent) ou `"retirer"` (ligne vidée, les
  sous-titres de la vidéo restent).

### Plein écran avec flash d'entrée et de sortie

```json
{ "id": "a05", "geste": "transition-flash", "intention": "Entrée du message principal, avec un clic.", "de": "le vrai problème" },
{ "id": "a06", "geste": "plein-ecran-fond", "reglages": { "fond": "orange" },
  "intention": "Message principal : la phrase à retenir de la vidéo, sur fond uni. (Avec de petites animations sur ses mots, passe en sur-mesure basé sur plein-ecran-fond et décris-les.)",
  "de": "le vrai problème", "a": "ce que tu manges",
  "elements": [ { "texte": "le vrai problème", "sur": "le vrai problème" },
                { "texte": "ce que tu manges", "sur": "ce que tu manges" } ] },
{ "id": "a07", "geste": "transition-flash", "intention": "Retour sur lui après le message principal, avec un clic.", "de": "et ça" }
```
Le plein écran commence sur un début de phrase précédé d'un `/` (une coupe) et le flash de sortie se
pose sur le premier mot de la phrase suivante, lui aussi après un `/`. Pas de `/` : le flash fait
partie de l'animation (écris-le dans son `intention`, pas de geste `transition-flash`).

### Accroche composée (`accroche`, toujours `a01`)
La signature est fixée par le script (`../../animations/scripts/accroche.mjs`) ; le plan dit la
disposition. `elements` : chaque texte et son mot, avec son rôle et sa disposition.
```json
{ "id": "a01", "geste": "accroche",
  "intention": "Accroche : « tes courbatures ne prouvent rien, rien du tout » (sa première phrase).",
  "de": "tes courbatures", "a": "du tout",
  "composition": {
    "type": "mot-derriere",
    "effet": "surprise",
    "pourquoi": "Surprise : RIEN en géant derrière lui casse l'idée reçue, la relance en bas à droite enfonce le clou."
  },
  "elements": [
    { "role": "phrase", "texte": "tes courbatures", "sur": "tes courbatures" },
    { "role": "mot", "texte": "rien", "sur": "rien#1", "place": "derriere", "taille": "geant", "entree": "apparition" },
    { "role": "relance", "texte": "du tout", "sur": "du tout", "place": "bas", "aligne": "droite", "entree": "saccade" }
  ] }
```
- `composition.type` : `mot-derriere`, `chiffre`, `question-coupee`, `deux-paves`, `titre-depuis-le-dezoom`
  ou `libre` (la famille, pour le registre). `effet` : `surprise`, `tension`, `curiosite`, `identification`.
  `pourquoi` : une phrase, l'effet visé et pourquoi cette disposition (obligatoire). Facultatifs : `barre_sur`
  (ancre de la réponse : les phrases marquées `"barre": true` se barrent et s'estompent), `jusqua` (ancre :
  l'accroche repart après ce mot, sinon 1 s après le dernier mot affiché, jamais avant 4 s),
  `demande_de_romain` (ses mots, quand il demande une accroche qui en répète une autre), `derogation` (une
  phrase, quand sa voix ne permet pas les trois temps : ils deviennent un avis).
- `role` : `phrase` (minuscules, prend la place du mot fort par défaut), `mot` (exactement un),
  `relance` (une ou deux). `place` : `derriere` (derrière sa tête : le mot fort et les phrases au-dessus de
  lui seulement), `haut`, `bas`. `aligne` : `gauche`, `droite`, `centre`. `taille` : `geant`, `grand`,
  `moyen` (mot), `normale`, `grande` (phrase, relance). `entree` : `apparition`, `saccade`, `pose`.
  `pave` : `orange`, `craie` ou `aucun` (relance : orange par défaut s'il n'y a pas d'autre orange ; mot :
  `aucun` par défaut). `souligne: true` (mot) : soulignage orange. `compte_de` (mot qui est un nombre dit) :
  le chiffre compte depuis cette valeur jusqu'au sien.
- Le dézoom va dans `zooms` : `{ "type": "ouverture", "sur": "<le mot fort>", "echelle": 1.12 }`, seul
  zoom de l'accroche.

### Image de réaction (mème)
Le calage exige un élément avec un texte : mets un élément `role: "image"` dont le texte dit qu'il
n'y a rien à afficher, et la photo à télécharger par le monteur.
```json
{ "id": "a02", "geste": "sur-mesure",
  "intention": "Image de réaction : le mème <lequel, décrit>, mots pour le chercher : « ... ». À télécharger par le monteur. En vignette à droite de sa tête, environ un tiers de la largeur, sans toucher son visage. Arrive sur « ... », part à la fin de la phrase.",
  "de": "te demandes", "a": "semaines#1",
  "elements": [ { "texte": "image seule, pas de texte à l'écran", "sur": "te demandes", "role": "image" } ],
  "photos": [ { "pour": "image de réaction", "fichier": null, "quoi": "à télécharger par le monteur : le mème ..., recherche « ... »" } ] }
```

### Sous-titre enrichi (sur mesure)
`de` et `a` couvrent les mots remplacés ; les `sur` des éléments peuvent être un seul mot (avec `#n`
s'il revient).
```json
{ "id": "a03", "geste": "sur-mesure",
  "intention": "Sous-titre enrichi, à la place des sous-titres de ces mots (même hauteur, même comportement : chaque mot sur sa voix, part avec la phrase). « pourquoi » en sous-titre normal, puis, sur sa propre ligne, « 12 semaines » en plus gros à la même hauteur, souligné à main levée en orange. Les sous-titres ne redisent pas ces mots. La suite de la phrase reprend en sous-titres normaux.",
  "de": "pourquoi", "a": "semaines#2",
  "elements": [ { "texte": "pourquoi", "sur": "pourquoi", "role": "sous-titre" },
                { "texte": "12 semaines", "sur": "douze semaines#2", "role": "mot en grand souligné" } ] }
```

### Animation qui illustre (sur mesure)
```json
{ "id": "a07", "geste": "sur-mesure",
  "intention": "Plein écran fond charbon, entrée et sortie par flash avec clic. En haut, « tu comprends aussi » en petit puis « CE QUI MARCHE » en grand, « pour toi » souligné, qui restent ; au centre, une brique « une façon de manger et de t'entraîner » qui s'emboîte pile dans une brique « ta vie » sur « colle à ta vie ». Sous-titres retirés pendant l'animation.",
  "de": "tu comprends aussi", "a": "ta vie",
  "elements": [ { "texte": "tu comprends aussi", "sur": "tu comprends aussi", "role": "ligne" },
                { "texte": "CE QUI MARCHE", "sur": "ce qui marche", "role": "mot" },
                { "texte": "étape sans texte : la brique s'emboîte", "sur": "colle à ta vie", "role": "étape (pas de texte)" } ] }
```

### Élément accroché à son geste (sur mesure)

```json
{ "id": "a04", "geste": "sur-mesure",
  "intention": "Il annonce trois choses en comptant sur ses doigts (vu à l'image) : le chiffre 3 en grand à côté de sa main, côté libre. Comme le chiffre de l'accroche chiffre, sans pavé. Reste jusqu'à la fin de la phrase.",
  "de": "trois choses", "a": "trois choses",
  "elements": [ { "texte": "3", "sur": "trois" } ] }
```

## Exemple complet (forme seulement, jamais de contenu à reprendre)

```json
{
  "plan": 1,
  "video": "Trois erreurs qui bloquent ta perte de poids",
  "notes": "Niveau travaillé. Le moment fort est la deuxième erreur. Chiffres toujours en chiffres dans les sous-titres.",
  "coupes": { "rythme": "serre" },
  "sous_titres": { "vocabulaire": ["3"] },
  "zooms": [
    { "type": "ouverture", "sur": "trois erreurs", "echelle": 1.12, "pourquoi": "le dézoom de l'accroche s'arrête sur le mot fort" },
    { "type": "suivi", "sur": "et c'est là", "pourquoi": "il parle directement à la personne : le cadre le suit" }
  ],
  "b_roll": [
    { "id": "b01", "clip": "<dossier de ses clips>/IMG_2041.MOV", "quoi": "lui qui prépare son assiette", "de": "ton assiette", "depart": 1.5 }
  ],
  "animations": [
    { "id": "a01", "geste": "accroche", "intention": "Accroche : « il y a trois erreurs qui bloquent ta perte de poids ».",
      "de": "il y a", "a": "perte de poids",
      "composition": { "type": "chiffre", "effet": "tension", "pourquoi": "Tension : le 3 qui compte en haut à gauche annonce le problème, la relance en bas nomme ce qu'on perd." },
      "elements": [ { "role": "phrase", "texte": "il y a", "sur": "il y a", "place": "haut" },
                    { "role": "mot", "texte": "3", "sur": "trois erreurs", "place": "haut", "taille": "grand", "compte_de": 1 },
                    { "role": "relance", "texte": "ta perte de poids", "sur": "perte de poids", "place": "bas" } ] },
    { "id": "a02", "geste": "plein-ecran-fond", "reglages": { "fond": "orange" },
      "intention": "La phrase à retenir, sur fond uni (flashs d'entrée et de sortie : voir plus haut).",
      "de": "le vrai problème", "a": "ce que tu manges",
      "elements": [ { "texte": "le vrai problème", "sur": "le vrai problème" },
                    { "texte": "ce que tu manges", "sur": "ce que tu manges" } ] },
    { "id": "a03", "geste": "cta-champ-instagram", "intention": "Fin : le mot qu'il demande de commenter se tape.",
      "de": "commente", "a": "programme", "sa_ligne": "garder",
      "elements": [ { "texte": "commente PROGRAMME", "sur": "commente", "role": "sous-titre" },
                    { "texte": "PROGRAMME", "sur": "programme", "role": "mot" } ] }
  ]
}
```
