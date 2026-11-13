---
name: plan-montage
description: >-
  Brique du monteur. Écrit le plan de montage d'un reel de Romain (@fitavecromain) après le tournage,
  sur la transcription de ce qu'il a vraiment dit et avec les clips qu'il a fournis : ce qui
  s'affiche, où et sur quel mot (accroche à l'écran, sous-titres enrichis, pleins écrans, éléments
  posés sur la caméra, cartes, B-rolls, zooms, rythme, fin), dans son style. Sort le
  plan-montage.json lu par les autres briques et les lignes de la planche que Romain valide avant
  la fabrication. Utiliser quand l'agent monteur arrive à l'étape « plan », une fois la
  vidéo coupée et ses clips regardés.
---

# Plans de montage de Romain

Tu es l'agent monteur, à l'étape du plan. La vidéo est tournée et coupée : tu as **ce qu'il a
vraiment dit** et **les clips qu'il t'a vraiment donnés**. Le plan dit **quoi et où** ; les briques
(zooms, animations, sous-titres, b-roll) font le **comment** avec la bibliothèque de son style. Tu
choisis les moments, les mots, les gestes, ce qu'ils affichent, et les choix que les règles te
confient (le mot surligné, le fond du message principal, les mots en grand et leur étage dans les
sous-titres enrichis, ce que montre une animation, quel clip va où). Tu ne donnes jamais de valeur
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
   pause). Lis-le en entier. Les ancres du plan sont des morceaux de ce texte ; les `/` te disent où
   il y a une coupe, donc où un flash peut se poser.
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
2. **Choisis le niveau de montage** (`regles.md`, « Deux niveaux ») : simple (organique, comme ce
   qu'il fait déjà) ou travaillé. Une histoire perso, un coup de gueule, une réponse rapide : simple.
   Une explication, une liste, une méthode, un chiffre qui surprend : travaillé. Le rythme des
   coupes a été choisi aux coupes ; s'il ne colle plus au niveau, refais `compiler` avant le calage
   (tes ancres en citations survivent, les `wNN` non).
3. **Découpe le texte en temps** : l'accroche (les 3 premières secondes), le corps (ses étapes),
   le moment le plus fort, la fin. Repère les phrases qui portent l'idée, les chiffres, les
   contrastes (« pas X, mais Y »), les listes, les moments où il montre quelque chose, les scènes de
   vie qu'il raconte, et les endroits où l'attention risque de tomber (explication longue,
   transition entre deux idées).
4. **Pose les éléments, dans cet ordre** :
   1. l'accroche : titre derrière lui et dézoom d'ouverture (`regles.md`, « L'accroche ») ;
   2. le message principal (plein écran sur fond uni ou pas, `regles.md`, « Plein écran, caméra,
      demi-écran ») ;
   3. ce qui doit être montré pour être compris (liste, schéma, carte, démo annotée, format connu) ;
   4. ses clips, chacun sur la phrase qu'il joue ; puis les idées à illustrer sans clip (plein écran
      minimaliste pour une idée abstraite, une chose qui existe reproduite à l'identique, animation
      sur la caméra en dernier ; une scène de vie sans clip reste sur lui avec un sous-titre
      enrichi), les mots clés en sous-titres enrichis, les images de réaction, **jusqu'à la fin de
      la vidéo** ;
   5. les relances aux endroits où l'attention tombe, puis les zooms ;
   6. la fin.
   À chaque élément, demande-toi : retenir, faire comprendre ou faire agir ? Sinon, retire-le.
5. **Vérifie le dosage** (`regles.md`, « Dosage ») sur tout le plan : un seul accent à la fois,
   2 à 4 pleins écrans au plus, lui à l'écran au moins 55 % du temps, des passages où on ne voit
   que lui.
6. **Écris le plan** dans `<nom>-montage/plan-montage.json` (`format.md`). Chaque ancre est une
   citation courte et distinctive de `texte-sous-titres.md` (ou un `wNN`). Chaque chiffre affiché
   est un chiffre qu'il dit. Rien d'inventé sur lui.
7. **Relis avec la checklist** (plus bas). La validation par Romain se fait ensuite sur la planche
   (section suivante), une fois les briques préparées, avant de fabriquer la vidéo.

## La validation par Romain : la planche

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
- ne demande que les gestes et les réglages listés dans `gestes.md`, plus les ajouts de Yoan qu'il
  liste (titre et dézoom d'ouverture, sous-titres enrichis, animations qui illustrent sur la
  caméra ou en plein écran, images de réaction et leur pop, message principal sur fond uni, clic
  des flashs) : ceux-là se demandent en `sur-mesure` même si la bibliothèque ne les a pas encore ;
- un besoin que rien ne couvre : un geste `sur-mesure` avec une intention précise (ce qu'on doit
  comprendre, le geste repris d'un gabarit, sur quels mots, combien de temps) ;
- une envie de Romain qui demande de changer le style (nouvelle couleur, nouveau son, nouvelle
  police) : pas dans le plan ; une ligne datée dans `demandes-pour-yoan.md` de ta mémoire.
Si le calage signale `STYLE_GAGNE`, c'est ton plan qui demande un réglage ou une durée hors style :
corrige le plan avec la valeur du style et recale. `remarques-plan.md` (écrit par le calage) reste
une simple trace dans le dossier de montage.

## Checklist avant de montrer le plan

- [ ] L'accroche a un élément à l'écran dès la première image, lisible en une seconde.
- [ ] Niveau travaillé : titre derrière lui dès l'image 1, dézoom d'ouverture qui s'arrête sur le
  mot clé.
- [ ] Le message principal a son plein écran sur fond uni, avec flash et clic à l'entrée et à la
  sortie, et de petites animations sur ses mots (le message principal prend un ou deux pleins
  écrans ; 2 à 4 pleins écrans au total dans la vidéo).
- [ ] Jamais plus de 6 à 8 s de sous-titres simples seuls, y compris dans la deuxième moitié.
- [ ] Aucun mot en double : ce qui s'affiche en grand est retiré des sous-titres ; les sous-titres
  enrichis restent à la place des sous-titres. Chiffres en chiffres.
- [ ] Ses clips sont posés sur la phrase qu'ils jouent, chacun vérifié sur sa vignette ; jamais un
  clip qui montre autre chose que ce qu'il dit.
- [ ] Les idées racontées sont montrées (son clip, sinon idée abstraite en plein écran minimaliste,
  chose réelle à l'identique, animation sur la caméra en dernier), jamais un mot en grand au-dessus
  de sa tête ; une action ou une scène de la vie ne va jamais en plein écran ; une scène de vie
  sans clip reste sur lui, notée « à filmer la prochaine fois » pour ton compte rendu.
- [ ] Aucun B-roll généré par IA, aucune image de lui prise ailleurs.
- [ ] 2 à 4 pleins écrans au plus (message principal et idées abstraites), séparés par lui, fonds
  alternés ; lui à l'écran au moins 55 % (56 % validé par Yoan en v5) du temps.
- [ ] Chaque animation nomme l'original exact à reproduire (appli Calendrier d'Apple), ou elle est
  minimaliste (texte mis en forme comme un titre, une ou deux formes nettes) ; jamais de
  personnages, de fausse 3D, de stylo qui dessine les marques.
- [ ] Le titre d'accroche se comprend sans le son ; l'objet du désir est surligné.
- [ ] Images de réaction : 1 ou 2, mème nommé précisément avec les mots pour le chercher.
- [ ] Chaque plein écran a une raison écrite dans son `intention` (`regles.md`).
- [ ] Demi-écran : zéro, ou un seul avec sa raison.
- [ ] Chaque flash est posé sur un mot précédé d'un `/` (une coupe) ; sinon le flash fait partie de
  l'animation.
- [ ] Rien ne s'affiche avant que Romain dise le mot (sauf le titre d'accroche, qui peut ne pas
  être dit) ; chaque chiffre affiché est dit.
- [ ] `mots_forts` vide (l'ancien mot fort doublait les sous-titres).
- [ ] Jamais deux accents en même temps (sauf exceptions de `regles.md`) ; jamais trois pleins
  écrans de suite, deux de suite seulement avec des fonds différents.
- [ ] Les mots forts sont des mots qui portent le sens (nom, chiffre, verbe fort, contraste), jamais
  « vraiment », « en fait », « très ».
- [ ] Chaque ancre est courte, distinctive, présente telle quelle dans `texte-sous-titres.md`, avec
  `#n` si elle revient plusieurs fois.
- [ ] Un format connu (recherche Google, commentaire Instagram, classement) est demandé à
  l'identique, jamais aux couleurs de Romain.
- [ ] La fin suit ce qu'il dit : un geste « mot en commentaire » seulement s'il dit un mot à
  commenter, avec exactement ce mot.
- [ ] Le JSON suit `format.md` (aucune clé inventée, pas de clé `sons`).
