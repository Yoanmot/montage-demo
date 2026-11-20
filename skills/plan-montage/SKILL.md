---
name: plan-montage
description: >-
  Brique du monteur. Écrit le plan de montage d'un reel de Romain (@fitavecromain) après le tournage,
  sur la transcription de ce qu'il a vraiment dit et avec les clips qu'il a fournis : ce qui
  s'affiche, où et sur quel mot (accroche composée, ses plans filmés, zooms dont celui qui suit sa
  tête, plein écran sur fond uni, animations légères, rythme, fin), dans son style classique. Sort le
  plan-montage.json lu par les autres briques et les lignes de la planche que Romain valide avant
  la fabrication. Utiliser quand l'agent monteur arrive à l'étape « plan », une fois la
  vidéo coupée et ses clips regardés.
---

# Plans de montage de Romain

Tu es l'agent monteur, à l'étape du plan. La vidéo est tournée et coupée : tu as **ce qu'il a
vraiment dit** et **les clips qu'il t'a vraiment donnés**. Le plan dit **quoi et où** ; les briques
(zooms, animations, sous-titres, b-roll) font le **comment** avec la bibliothèque de son style. Tu
choisis les moments, les mots, les gestes, ce qu'ils affichent, et les choix que les règles te
confient (la disposition de l'accroche et l'effet qu'elle vise, le fond du plein écran, les zooms et
leur type, quel clip va où). Tu ne donnes jamais de valeur
technique (pixels, codes couleur, police, courbe, durée d'animation) : le style les fixe.

Le but d'un plan : que quelqu'un qui tombe sur la vidéo reste jusqu'au bout et comprenne mieux grâce
à ce qu'il voit. Chaque élément à l'écran doit soit retenir (accroche, relance), soit faire
comprendre (montrer ce qui est dit), soit faire agir (la fin). Un élément qui ne fait rien des trois
n'entre pas dans le plan.

Lis avant d'écrire :
- `references/regles.md` : les règles de montage (accroche, rétention, dosage, plein écran contre
  caméra, illustrer une idée, formats connus, rythme, fin). Elles font foi.
- `references/gestes.md` : les gestes du style de Romain, quand les prendre, ce qu'ils demandent.
- `references/format.md` : le format exact du plan (`plan-montage.json`) et des ancres. C'est la
  source unique du format : le contrat des briques y renvoie.
- `references/preferences.md` : les retours de Yoan sur les plans de test. Ils passent avant les
  règles générales.
- Ta mémoire, section `## Pour le plan` de `preferences.md` (les goûts que Romain t'a demandé de
  retenir) : elle passe avant tout le reste.

## Ce qu'il te faut

1. **La vidéo coupée** : couper-silences est passé (`words.cut.json` et `filtre.txt` dans
   `<nom>-montage`).
2. **Le texte numéroté** : `node "$SK/sous-titres/scripts/sous-titres.mjs" texte "<nom>-montage"`
   écrit `texte-sous-titres.md` (une phrase par ligne, `[12]abdos`, un `/` devant un mot qui suit une
   coupe de la vidéo). Lis-le en entier. Les ancres du plan sont des morceaux de ce texte ; les `/`
   sont les coupes, calculées comme le calage des transitions : un flash posé sur un mot précédé
   d'un `/` passe, ailleurs il est refusé (`PAS_DE_COUPE`).
3. **Ses clips** (B-rolls), s'il en a donné : ce que montre chacun (tu as regardé les vignettes de la
   brique b-roll) et sa durée. S'il a collé son **brief de tournage**, il dit sur quelle phrase va
   chaque plan filmé : sers-t'en, en vérifiant sur la vignette que le clip montre bien ça.
4. **Ce que tu vois de lui** quand ça compte : extrais une image au moment d'un mot (ffmpeg sur la
   vidéo coupée de contrôle, ou sur l'originale au temps du mot) pour savoir s'il compte sur ses
   doigts, pointe un côté, tient un objet, de quel côté il y a de la place.

Pas de script à suivre : ce qu'il a dit fait foi, même s'il a improvisé.

## Le process

1. **Comprends le reel en une phrase** : ce que la personne doit avoir compris ou ressenti à la
   fin. Tout le plan sert cette phrase.
2. **Le style est classique, pas vide** (`regles.md`, « Le principe », « Comment penser chaque moment »,
   « Densité ») : une accroche composée qui claque, puis un montage simple et propre (ses sous-titres, ses plans
   filmés au bon moment, de bons zooms, le plein écran qui commence sur lui pour la phrase à retenir, un temps fort
   toutes les 10 à 15 s, chacun tiré d'une phrase). Ce qu'il a
   demandé de retenir (ta mémoire, `## Pour le plan`) passe avant. Le rythme des coupes a été choisi aux
   coupes ; s'il ne colle plus, refais `compiler` avant le calage.
3. **Lis la forme de chaque phrase** (`regles.md`, « Comment penser chaque moment ») et écris-la, une ligne
   par phrase, dans `<nom>-montage/remarques-plan.md` (section « Lecture des phrases », avant toute décision) :
   exemples parallèles, opposition, énumération, multitude (« partout », « tout le monde »), chose concrète qu'on
   peut voir (même citée pour s'en moquer), phrase à retenir, confidence, ou rien de particulier. Pour chacune :
   ce que le spectateur doit comprendre ou ressentir. Puis découpe en temps : l'accroche (les 5 premières
   secondes), le corps, la phrase à retenir, la fin, et repère les passages de plus de 15 s sans temps fort.
4. **Compose l'accroche** (`regles.md`, « L'accroche ») :
   1. lis le registre : `node "$SK/animations/scripts/registre-accroches.mjs" lire "<nom>-montage"` (les
      deux dernières accroches, ce qu'il ne faut pas reprendre) ;
   2. regarde une image de ses premières secondes (où est sa tête, de quel côté il reste de la place) ;
   3. regarde la forme de ses premières phrases : deux exemples parallèles = substitution (le second
      remplace le premier au même endroit) ; puis choisis l'effet voulu, le mot qui porte, sa taille, sa place,
      son entrée, la relance, et écris en une phrase pourquoi (`composition.pourquoi`) ;
   4. le dézoom d'ouverture dans `zooms`, sur le mot fort.
5. **Pose le reste, dans cet ordre** :
   1. ce qu'il montre : chaque chose concrète qu'il cite et qu'on peut voir a son plan filmé, sur la phrase
      qui la cite, en coupe sèche (un flash avec clic seulement à un changement de lieu ou de partie) ; sans
      clip, l'écran « B-ROLL » (`plan-a-filmer`) avec ce qu'il faut filmer ;
   2. la phrase à retenir en plein écran qui commence sur lui (`plein-ecran-visage`), flash et clic à la
      sortie ;
   3. la multitude (`partout`) s'il dit qu'une chose se voit ou se dit partout ;
   4. les zooms : le zoom qui suit sa tête sur les phrases qui comptent et les passages longs, un éclair
      sur un mot qui claque ;
   5. les animations sur la caméra (`texte-sur-lui`) sur les phrases d'enjeu ou de contraste (condition, opposition,
      projection, adresse), au moins une dans le dernier tiers, et partout où la densité manque (plus de 15 s sans
      temps fort) ;
   6. la fin.
   À chaque élément, demande-toi : qu'est-ce que le spectateur doit comprendre ou ressentir ici, et est-ce
   que ça le garde avec Romain ? Un effet qui ne répond à aucune phrase se retire.
6. **Vérifie le dosage** (`regles.md`, « Dosage », « Densité ») : un seul accent à la fois, lui à l'écran au
   moins 60 % du temps, 1 plein écran (2 au plus), un temps fort toutes les 10 à 15 s hors accroche, aucun
   passage de plus de 15 s avec seulement des sous-titres et des zooms (sauf une histoire ou une émotion).
7. **Écris le plan** dans `<nom>-montage/plan-montage.json` (`format.md`). Chaque ancre est une
   citation courte et distinctive de `texte-sous-titres.md` (ou un `wNN`). Chaque chiffre affiché
   est un chiffre qu'il dit. Rien d'inventé sur lui.
8. **Relis avec la checklist** (plus bas). La validation par Romain se fait ensuite sur l'aperçu ou la
   planche, une fois les briques préparées, avant de fabriquer la vidéo.

## La validation par Romain : la planche

Dans le studio, il valide sur **l'aperçu** (agent monteur, étape 6, « En mode studio ») : la planche n'y est qu'un
outil interne, et dans le chat on dit toujours « l'aperçu », jamais « planche », « vignette » ni pixels.

Romain ne valide pas un texte : il valide une **planche de 8 à 12 images de sa vidéo**, une par moment
du plan, avec chaque élément dans son style final (agent monteur, étape 6, et brique rendu, section
« La planche, avant de fabriquer »). Le plan est d'abord préparé par les briques (animations,
sous-titres, zooms, b-roll), sans fabriquer la vidéo. Sous chaque image : le minutage, ses mots entre
guillemets et une ligne simple sur ce qui se passe. C'est toi qui écris ces lignes, sur ton plan :
- une phrase, ses mots à lui : « Au début, "3 erreurs" s'écrit en gros derrière ta tête », « la
  liste s'affiche sur tout l'écran », « ton plan dans la cuisine prend tout l'écran » ;
- pas de JSON, pas de nom de geste, pas de mot comme « calque », « ancre », « hook », « CTA »,
  « B-roll », « overlay ». On dit « l'accroche à l'écran », « la fin », « ton plan dans la cuisine »,
  « un plan où tu montres ».
Avec la planche, en quelques lignes : le rythme en une phrase (« montage serré, sans blancs » ou
« montage qui respire, c'est une histoire ») ; les photos qu'il te faut (ce que chacune doit montrer)
s'il y en a ; une question seulement si le plan dépend de lui (un classement, un chiffre qu'il donne à
moitié, l'orthographe d'un nom d'exercice).

Il répond par numéro (« enlève le 4 », « le 6 plutôt en orange ») : corrige le plan, fais refaire la
brique touchée, refais la planche (seules les vignettes touchées changent) et dis-lui ce qui a changé.
Il valide : passe à la fabrication (sons, puis rendu).

Sa correction vaut pour les prochaines vidéos (« jamais de plein écran orange », « moins de mots en
gros ») : propose-lui en une phrase de t'en souvenir ; s'il dit oui, ajoute une ligne datée dans ta
mémoire, `preferences.md`, section `## Pour le plan`. Une correction qui ne vaut que pour cette
vidéo ne va nulle part. Tu ne modifies jamais les fichiers de ce skill (`references/preferences.md`
est tenu par Yoan).

## Écrire dans ce que le style permet

Le plan s'écrit directement dans le style de Romain :
- ne demande que les gestes et les réglages listés dans `gestes.md` (l'accroche composée, les
  gestes de la bibliothèque, ou `sur-mesure` pour ce qu'il demande et que rien ne couvre) ;
- un besoin que rien ne couvre : un geste `sur-mesure` avec une intention précise (ce qu'on doit
  comprendre, le geste repris d'un gabarit, sur quels mots, combien de temps) ;
- une envie de Romain qui demande de changer le style (nouvelle couleur, nouveau son, nouvelle
  police) : pas dans le plan ; une ligne datée dans `demandes-pour-yoan.md` de ta mémoire.
Si le calage signale `STYLE_GAGNE`, c'est ton plan qui demande un réglage ou une durée hors style :
corrige le plan avec la valeur du style et recale. `remarques-plan.md` (écrit par le calage) reste
une simple trace dans le dossier de montage.

## Checklist avant de montrer le plan

- [ ] L'accroche est composée (geste `accroche`) : un mot fort dit vers 1 à 2 s, une relance vers 2,5 s,
  quelque chose dès le début ; `effet` et `pourquoi` écrits ; dézoom d'ouverture sur le mot fort.
- [ ] Le registre a été lu : ni la combinaison (type, place, entrée) ni le mot des deux dernières
  accroches, ni la place de la dernière (sauf demande de Romain, écrite dans `demande_de_romain`).
- [ ] La disposition suit l'image : sa tête laisse la place au mot derrière lui, le texte va du côté
  libre, rien sur son visage.
- [ ] Le titre d'accroche se comprend sans le son, ne promet rien qu'il ne dit pas, reprend ses mots
  quand c'est possible ; l'`intention` cite la phrase de lui d'où il vient.
- [ ] L'accroche commence sur son premier mot et n'en saute aucun jusqu'à son dernier élément ; une phrase courte
  est en entier (petits mots, « ? ») ; tout en capitales, des tailles proches (1,6 fois au plus entre voisins).
- [ ] Au moins une animation sur la caméra (`texte-sur-lui`) dans le dernier tiers, sur une phrase d'enjeu ou de
  contraste ; 15 s au plus sans temps fort, fin comprise (le calage le contrôle).
- [ ] Le plein écran qui commence sur lui n'a pas de `transition-flash` autour (entrée et sortie sont dans l'effet).
- [ ] La forme de chaque phrase est lue (`remarques-plan.md`, « Lecture des phrases ») et chaque effet en vient :
  exemples parallèles en substitution, énumération chose par chose, multitude en `partout`, chose concrète
  montrée, phrase à retenir en plein écran qui commence sur lui.
- [ ] Le corps est simple mais pas vide : ses sous-titres, ses plans filmés (ou écrans « B-ROLL ») sur leurs
  phrases, 3 à 6 zooms (le zoom qui suit sa tête d'abord), la phrase à retenir en plein écran qui commence sur lui,
  un temps fort toutes les 10 à 15 s.
- [ ] Aucun effet « sur sa demande » (sous-titres enrichis, mème, carte, demi-écran, format connu,
  animation qui illustre) qu'il n'a pas demandé, pour cette vidéo ou dans ta mémoire.
- [ ] Ses clips sont posés sur la phrase qu'ils jouent, chacun vérifié sur sa vignette ; jamais un
  clip qui montre autre chose que ce qu'il dit ; une chose concrète citée sans clip (exercice, geste,
  aliment, scène de vie, même citée pour s'en moquer) a son écran « B-ROLL » qui dit quoi filmer.
- [ ] Aucun B-roll généré par IA qu'il n'a pas demandé, aucune image de lui prise ailleurs.
- [ ] Plein écran : il commence sur lui (`plein-ecran-visage` : le mot clé au-dessus de sa tête, puis le fond),
  jamais sur sa vidéo floutée, sa raison écrite dans l'`intention` ; 5,5 s au plus sans le voir ; sortie par un
  flash sur une coupe (`/`).
- [ ] Chaque flash est posé sur un mot précédé d'un `/` (une coupe).
- [ ] Aucun mot en double : ce qui s'affiche en grand est retiré des sous-titres. Chiffres en chiffres.
- [ ] Rien ne s'affiche avant que Romain dise le mot (sauf le titre d'accroche, qui ne promet rien
  qu'il ne dit pas) ; chaque chiffre affiché est dit.
- [ ] Jamais deux accents en même temps ; jamais un zoom pendant un plein écran ou un plan filmé.
- [ ] Chaque ancre est courte, distinctive, présente telle quelle dans `texte-sous-titres.md`, avec
  `#n` si elle revient plusieurs fois.
- [ ] La fin suit ce qu'il dit : un geste « mot en commentaire » seulement s'il dit un mot à
  commenter, avec exactement ce mot.
- [ ] Le JSON suit `format.md` (aucune clé inventée, pas de clé `sons`).
