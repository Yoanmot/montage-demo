# Format du plan de montage de Yoan (`<nom>-montage/plan-montage.json`)

C'est la timeline du pipeline de Yoan (contrat `timeline/1`, source : `$SK/animations-yoan/moteur/executeur/CONTRAT-TIMELINE.md`,
à lire pour le détail d'un champ), écrite sur la vidéo coupée par couper-silences. Elle dit QUOI et QUAND, jamais
COMMENT. Validation : `python3 "$SK/animations-yoan/scripts/yoan.py" valider "<nom>-montage"` (règles du pipeline de Yoan
plus ce que le moteur du studio sait faire ; `FAUTE ...` = à corriger, `AVERTISSEMENT ...` = à lire).

## En-tête
```json
{ "contrat": "timeline/1",
  "densite": "dense",            // ou "sobre" (règles, section 9)
  "ambiance": "hiphop",          // musique : hiphop (défaut), trap, boombap, nappe, ou null (sans musique)
  "elements": [ ... ] }
```
Pas de `rush` ni de `preparation` : le plan vit dans le dossier de montage, à côté de `words.cut.json` et `edl.json`.

## Ancres : jamais de secondes en dur
Tout instant est une ancre, lue dans `texte-plan.md` (`yoan.py texte`) :
| Ancre | Instant |
|---|---|
| `"manière"` | attaque du mot (s'il n'apparaît qu'une fois ; sinon refus avec la liste des occurrences) |
| `"contexte#2"` | 2e occurrence du mot (comparaison sans casse ni ponctuation) |
| `"w128"` | le mot n°128 de words.cut.json (`[w120]` en tête de ligne de `texte-plan.md`, puis on compte) : pour un mot-outil |
| `"toi#1:fin"` | fin du mot |
| `"fichier#3-0.10"`, `"voix#2:fin+0.2"` | décalage en secondes, toujours à la fin |
| `"@coupe4"` | 4e coupe de prise (`‖@coupe4‖` dans le texte) |
| `"@debut"`, `"@fin"` | début et fin de la vidéo coupée |
Dans les `params` d'un gabarit, un instant s'écrit `{"@": "ancre"}`.

## Éléments
| `type` | Champs |
|---|---|
| `hook` | `lignes` (2 chaînes en MAJUSCULES), `dore` (un mot du titre), `ouverture`?: `{"groupes": [["CETTE VIDÉO\|A ÉTÉ"]]}` (les mots dits AVANT le titre, dans l'ordre de la voix), `secondaire`?: `"LIGNE 1\|LIGNE 2"` (18 caractères par ligne au plus), `jusqua` (une coupe : `@coupe1`), `sortie`: `coupe` |
| `sous_titres` | **auto** : `{"type": "sous_titres", "auto": true, "dores": [...], "forts": [...]}` (voir plus bas) ; ou explicite : `depuis` (premier mot), `groupes`: `[["LIGNE 1\|LIGNE 2", "MOT DORÉ"?, {"accent": "fort"}?], ...]` |
| `zoom` | `geste`: `eclair` \| `adouci` \| `lent`, `a` (le mot), `sortie`: `{"geste": "coupe", "a": "@coupeN"}` (éclair) ; `fin` (lent) |
| `mot_derriere` | `mot` (en MAJUSCULES, dit), `a` (son mot), `jusqua` |
| `plein_ecran` | `de`, `a`, `variante`: `seule` \| `milieu`, `lignes` (mots dits, dans l'ordre, en MAJUSCULES, 11 caractères par ligne environ : 120 px dans 900 px), `dore` (un seul mot, obligatoire en `milieu` ; une expression dorée passe par les sous-titres) |
| `demi_ecran` | `de`, `a`, `contenu`: `{"gabarit": ..., "params": {...}}`, `bascule`?: `{"type": "pousse"\|"faisceau", "a": ancre}`, `sortie`: `remonte` \| `coupe` |
| `motion` | `gabarit`, `support`: `plein` \| `camera`, `de`, `a`, `params` |
| `sur_mesure` | `calque`: `"calques/<id>"` (écrit avant, skill animations-yoan), `de`, `a`, `plein`? (faisceaux aux deux bouts), `perforer`? (derrière la tête) |
| `faisceau` | `a` (une coupe à cacher, ou une transition) |
| `cta` | `support`: `camera` \| `fond`, `mot` (le mot-clé dit, en MAJUSCULES), `consigne` (« COMMENTE »), `bas` (« ET JE T'AIDE EN DM »), `quand`: `{"consigne": ancre, "mot": ancre, "bas": ancre, "faisceau"?: ancre (fond)}`, `jusqua` (`@fin`) |
| `son` | `son`: `whoosh` \| `clic` \| `pop` \| `glisse` \| `shimmer` \| `curseur` \| `tic` \| `cta` \| `cta_lignes`, `a` ; ou `fichier` (son propre au reel, chemin relatif au dossier de montage) + `sousVoix` (dB) |

Déduits seuls (ne pas les écrire) : un faisceau et son flash à chaque bout d'un plein écran, d'un `motion` plein, d'un
`sur_mesure` plein, d'une bascule faisceau et d'un CTA sur fond ; le son du CTA et de ses lignes ; les sous-titres coupés
pendant le hook, un plein écran à mots et le CTA ; le titre du hook troué par la tête et posé sur elle.

## Sous-titres automatiques (le cas normal)
```json
{ "type": "sous_titres", "auto": true,
  "dores": ["touché", {"a": "une#1", "mots": 3}, "w212"],
  "forts": [{"a": "pas#1", "mots": 3}] }
```
Les groupes se découpent seuls au style de Yoan (1 ou 2 lignes équilibrées, coupés où la voix respire : ponctuation,
blanc, coupe de prise ; 6 mots au plus), sur toute la vidéo hors hook, pleins écrans à mots et CTA.
- `dores` : un mot (ancre) ou une expression (`{"a": premier mot, "mots": n}`) : doré avec son halo et ses crochets, une
  seule ligne, un par groupe au plus (le groupe se ferme avant un 2e doré). Un par phrase qui porte une idée, pas plus.
- `forts` : l'accent fort, 1 ou 2 par reel : l'expression seule en grand (2 lignes de 840 px à 104 px au plus : 3 ou 4
  mots courts) ; pose un zoom éclair sur son PREMIER mot.
- `depuis` / `jusqua` (facultatifs) : limiter à un passage.
Explicite (`groupes`) seulement pour une coupure de ligne précise : chaque mot affiché consomme le mot suivant de la
voix, dans l'ordre, sans en sauter.

## Positions dans les params (zone sûre et repères, en px de 1080 x 1920)
x 91 à 990 à partir de y 237 ; à droite sous y 997 pas au-delà de x 899 ; en bas à gauche sous y 1479 pas avant x 366 ;
rien sous y 1650. Sous-titres : y 256 à ~470. Tête au repos : cheveux vers y 620, menton vers y 1130 ; poitrine
y 1190 à 1480. Plein écran : contenu de y 560 à ~1500. **Demi-écran** : le fond descend sur la moitié haute (jusqu'à
y 1080) et pousse le visage vers le bas ; son contenu va de y 500 à ~1000 (jamais plus haut : les sous-titres sont en
haut), et il entre après la descente (0,7 s après `de`).

## Exemple (extrait, tiré de la démo validée par Yoan : ses ancres sont celles d'une autre vidéo)
```json
{ "contrat": "timeline/1", "densite": "dense", "ambiance": "hiphop", "elements": [
  {"type": "hook", "ouverture": {"groupes": [["VOICI CE QUI"], ["TE MANQUE|POUR QUE"], ["TON IA SONNE"]]},
   "lignes": ["EXACTEMENT", "COMME TOI"], "dore": "EXACTEMENT", "secondaire": "COMMENT DONNER|TA VOIX À UNE IA",
   "jusqua": "@coupe1", "sortie": "coupe"},
  {"type": "plein_ecran", "de": "@coupe2", "a": "la#1", "variante": "seule", "lignes": ["LE PROBLÈME", "PAS L'IA EN", "ELLE-MÊME", "C'EST JUSTE"]},
  {"type": "zoom", "geste": "eclair", "a": "vocaux#1", "sortie": {"geste": "coupe", "a": "@coupe5"}},
  {"type": "faisceau", "a": "@coupe4"},
  {"type": "motion", "gabarit": "regle-pin", "support": "camera", "de": "force#1-0.06", "a": "@coupe10",
   "params": {"y": 1390, "entree": {"@": "force#1-0.06"}, "sortie": {"@": "temps#1+0.34"},
              "reperes": [{"x": 160, "texte": "V1"}, {"x": 500, "texte": "V3"}, {"x": 840, "texte": "V6"}],
              "pin": {"t": {"@": "correction#1+0.04"}, "arrets": [{"x": 160, "texte": "V1"}, {"t": {"@": "de#10+0.04"}, "x": 840, "texte": "V6", "d": 0.6}]},
              "ellipse": {"t": {"@": "précis#2+0.1"}}}},
  {"type": "son", "son": "whoosh", "a": "force#1-0.06"}, {"type": "son", "son": "curseur", "a": "de#10+0.04"},
  {"type": "cta", "support": "camera", "mot": "CONTEXTE", "consigne": "COMMENTE", "bas": "ET JE T'AIDE EN DM",
   "quand": {"consigne": "commente#1", "mot": "contexte#3", "bas": "et#11-0.02"}, "jusqua": "@fin"},
  {"type": "sous_titres", "auto": true, "dores": ["manière#1", {"a": "une#3", "mots": 3}], "forts": [{"a": "hyper#1", "mots": 2}]}
] }
```
Un exemple complet écrit par le planificateur de Yoan : `exemple-demo.json` (ses ancres sont celles d'une autre vidéo).
