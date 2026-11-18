# Règles du plan : quoi poser, et quand

Copie des règles de PLACEMENT du pipeline de montage de Yoan (`style/REGLES-PLANIFICATEUR.md`, extrait de `REGLES.md`
pour l'agent `planificateur`, 2026-10-30, toutes validées par Yoan), recopiées pour son monteur du studio le 2026-11-18,
sans les valeurs de rendu (tailles, couleurs, courbes, niveaux : le skill animations-yoan s'en charge). Deux changements
seulement, propres au studio : il n'y a plus de storyboard à valider (ce qui s'y proposait se décide ici, et Yoan le
corrige sur l'aperçu par une note), et la caméra est celle du moteur partagé avec Romain (section 4, encadrés « Ici »).
Exemple d'écriture : `exemple-demo.json` (la démo validée par Yoan après 3 passages).

## 1. La matière (les coupes, avant le plan)

- **L'ordre du script, la voix de la rush.** On garde l'ordre des idées du script ; le texte est celui que Yoan a dit,
  jamais réécrit. Le script n'est pas un texte récité : Yoan improvise, il ajoute ou retire des idées, c'est la rush
  qui fait foi.
- **Prises répétées : une seule par groupe**, la meilleure : complète (pas de mot coupé `--`), fluide, sans filler, et
  la plus nette sur la fin. On peut combiner des morceaux de deux prises si les bornes tombent sur des blancs (`{i}`).
- **Couper ce qui n'apporte rien** : faux départs, hésitations, fillers (« bah », « euh ») quand un blanc permet la
  coupe, redites, récapitulatif avant le CTA (Yoan a fait couper « Donc voilà, je pense que [...] et tout ira mieux »).
  Ici, c'est toi qui tranches aux coupes (couper-silences) ; dans le doute, garde la phrase.
- **Ne pas couper une idée du script** (ni une information dont dépend la suite) : si tu le fais, dis-le dans ton message
  de fin.
- **Une coupe tombe dans un silence** (borne sous -60 dBFS, posée par la préparation) : seulement aux `{i}` du
  transcript, ou entre deux phrases.

## 2. Le hook (toujours)

- **Le titre du hook est la phrase d'ouverture**, en deux lignes de 880 px au plus (repère : « TON IA SONNE », 12 signes, tient sur une ligne). Si la
  phrase commence avant les mots du titre, l'**ouverture** affiche ces premiers mots derrière la tête, groupe par groupe ;
  le titre garde la fin, qui porte le mot appuyé (démo : ouverture « VOICI CE QUI / TE MANQUE POUR QUE / TON IA SONNE »,
  titre « EXACTEMENT / COMME TOI »). Les mots du titre ne sont jamais doublés dans l'ouverture.
- **Le mot doré du titre est celui que Yoan appuie à la voix** (EXACTEMENT, pas TOI).
- **Le hook secondaire** est un deuxième hook écrit pour la vidéo : une vraie phrase tirée du propos qui promet la suite
  (« COMMENT DONNER / TA VOIX À UNE IA »), jamais une catégorie ou un sujet (« IA POUR COACHS » refusé : « le tag est
  nul »). 1 ou 2 lignes, 18 caractères par ligne au plus, en MAJUSCULES. Il est là dès la première image, muet, et part
  avec le titre.
- **Le geste qui pointe** : une main qui pointe (doigt levé, main vers un côté) pendant le hook appelle une animation à
  l'endroit pointé (`objet-tournant` au-dessus d'un doigt levé, cube « ? » mystère), et le cadre passe en `large`, la tête
  décalée du côté opposé (`vers`). Un hook qui ouvre une boucle montre l'EXISTENCE de l'objet, pas son contenu.
- **Ici** : le cadre serré du hook est rendu par le dézoom d'ouverture du moteur (de 120 % à 100 % jusqu'à la sortie du
  hook, le titre suit la caméra et se pose sur la tête mesurée). Pas de variante `large` : le cadre reste centré ; un
  geste qui pointe garde son objet (`objet-tournant`) posé du côté libre. Le hook sort à 1 s au plus tôt.
- **Sortie** : titre et secondaire tiennent jusqu'à la première coupe, puis dézoom éclair (ou demi-écran qui cache la
  coupe). Jamais de sous-titres pendant le titre.

## 3. Sous-titres et mot doré

- Partout, en haut, sauf pendant le titre du hook, un plein écran à mots et le CTA. Groupes de 1 ou 2 lignes (3 au plus),
  coupés là où la voix respire, lignes équilibrées. Chaque mot affiché est un mot dit, dans l'ordre : jamais un mot non
  dit (Yoan avait écrit « mais », la voix dit « c'est juste » : refusé), jamais une phrase amputée (« PAS L'IA EN
  ELLE-MÊME », pas « PAS L'IA »).
- **Un mot doré par groupe au plus : le mot que Yoan appuie à la voix**, pas celui qui semble important sur le papier
  (20 s de la démo : UNE SEULE FOIS, pas MINUTES). Le texte ne dit pas l'accent : choisis-le (le mot que la phrase
  frappe à l'oral : l'adverbe d'intensité, le chiffre, le mot qui contredit, la fin d'une liste ; jamais un mot-outil),
  regarde la règle de ta mémoire, et Yoan le corrige sur l'aperçu par une note si tu t'es trompé.
- **Une expression accentuée se dore en entier** (UNE SEULE FOIS, pas SEULE), sur une seule ligne.
- **Accent fort** : pour la phrase la plus forte, le groupe entier devient l'expression en grand (`{"accent": "fort"}`,
  2 lignes au plus), avec un zoom éclair sur le PREMIER mot de l'expression (« hyper », pas « généralistes »). Un ou deux
  par reel au plus.
- Pas de crochets sur un B-roll (ils doubleraient l'annotation).

## 4. Caméra

- **Zoom éclair** : pour accentuer un mot, partant sur son attaque. Jamais suivi d'un dézoom immédiat (0,3 s au moins).
  Trois sorties : coupe sèche sur la phrase suivante dans le silence (cache une coupe de montage), dézoom éclair au début
  de la phrase suivante (relance), dézoom lent sur toute la phrase suivante (pose).
- **Zoom adouci** : marquer un moment sans le frapper. **Zoom lent continu** : une phrase qui se déroule, jamais pour
  accentuer un mot. Pas de punch-in sec (coupe directe à 115 %).
- **Ici, ce que la caméra du moteur sait faire** : le zoom éclair (115 % en 0,13 s, flou de mouvement) et le
  rapprochement (110 % en 1 s, pour `adouci` et `lent`) tiennent tous les deux **jusqu'à la coupe de prise qui suit**
  (ou la fin de la phrase s'il n'y en a pas dans les 4 s) : leur seule sortie est `coupe`. Pas de dézoom éclair, de
  dézoom lent ni de retour adouci au milieu d'un plan, pas de suivi de tête (cadre fixe). Un zoom part au moins 0,2 s
  après une coupe (éclair) et une coupe arrive au moins 0,4 s (éclair) ou 1,1 s (rapprochement) après son départ ;
  jamais pendant le hook. Le validateur le vérifie. Pour relancer après un zoom, la coupe de prise suivante fait le
  dézoom toute seule : c'est souvent le meilleur endroit pour un zoom (il cache la coupe).
- **Mot derrière la tête** : le mot qui porte l'idée de la phrase, forcément dit, posé sur ce mot ; jamais un mot de
  remplissage ni le mot déjà doré du titre (TOI à 51 s : « pas le bon »). Rare.
- **Chaque coupe de montage est cachée** (le validateur refuse sinon) : dézoom éclair, coupe sèche depuis un zoom tenu,
  faisceau, demi-écran qui entre dessus, plein écran ou B-roll qui la couvre. Plus il y a de coupes, plus il faut de
  gestes : en tenir compte dès le choix des prises.

## 5. Changements de monde : caméra, demi-écran, plein écran

- **Dosage du reel 4** (la référence) : 18 animations, 4 sur la caméra, 3 en demi-écran (2 passages), 11 en plein écran
  (3 passages). En temps : plein 49 %, demi 19 %, objet sur la caméra 11 %, caméra seule 21 %. Les pleins écrans sont
  longs (2,4 à 17 s) et changent de contenu à l'intérieur ; les gestes sur la caméra sont courts et fréquents (zooms par
  paires, objets à la poitrine). **Jamais une seule animation sur la caméra dans toute la vidéo** (démo v1 refusée).
  La démo validée était encore sous le reel 4 en demi et plein : viser plus de demi et de plein, pas moins.
- **Un demi-écran ou un plein écran a un rôle** : il montre l'objet ou l'idée dont on parle, plus longtemps que la caméra
  ne le permet. Il tient au moins 1,6 s, au mieux 2,4 s ou plus.
- **Jamais collé à un mouvement de caméra** : au moins 0,9 s entre la fin d'un zoom ou dézoom rapide (ou la sortie du
  hook) et l'entrée d'un demi-écran (démo : « trop rapide et saccadé »).
- **Demi -> plein -> caméra** : chaque état tient, et le retour est caché (faisceau, dézoom, coupe de prise) ; sinon un
  seul état, ou un geste sur la caméra (« ça switch trop rapidement »).
- Le contenu d'un demi-écran entre après la descente du fond (0,7 s), sinon il traverse les sous-titres.
- **Pleins écrans enchaînés** : un plein qui commence où un autre finit continue le même fond sans faisceau (plein à mots
  puis photo) : le contenu change, le plein écran continue.
- Plein écran à mots : `seule` (une ligne à la fois) ou `milieu` (le doré au milieu, la pile autour, exige un doré).

## 6. Choisir le geste

- **Un objet ou une durée nommés appellent leur geste du catalogue** : « fichier de contexte » -> `fichier-heros` (caméra
  si la phrase est courte, plein écran si elle construit le fichier, jamais en demi) ; une durée (« 30 minutes ») ->
  `minuteur`, puis `minuteur-suite` si la phrase qui suit dit ce qu'on fait pendant (un B-roll générique ne remplace pas
  le geste qui prolonge l'animation d'avant) ; « n'importe quelle IA, n'importe quel outil » -> `fichier-partout` ; une
  énumération dite face caméra -> `liste-torse`. Un geste générique (champ de chat, panneau à liste) posé sur une phrase
  pour laquelle le catalogue a un geste dédié est une faute de plan.
- **Le contenu d'une animation illustre la phrase** (champ de chat et panneau hors sujet refusés). Si le catalogue n'a
  rien de juste, commande une animation sur mesure au constructeur : l'intention, pas le code.
- **Une animation sur la caméra va sur le torse quand le haut est pris par les sous-titres** (minuteur, liste : « elle
  se mélange aux captions »). Le CTA, lui, va au-dessus de la tête.
- **Moment drôle possible** (un par reel au plus) : une image qui dit la phrase avec humour (`image-plein`, enchaînée
  dans un plein écran, sous-titres en haut) et un son comique calé sur la première image visible de la photo (entrée +
  1 image). L'image et le son sont fournis pour le reel (Yoan, ou recherche avec droits), jamais rangés dans le style.
- **Médias externes** : ce que la voix montre et que la rush n'a pas (« les vidéos que tu vois là », une capture, une
  photo) se demande à Yoan dans ton message de fin, avec ce qu'il faut exactement (nombre, format, durée). En attendant,
  pose un geste du catalogue qui illustre la phrase ; jamais une fausse capture.

## 7. Le CTA

- Une fois, sur la phrase du mot-clé à commenter : consigne au-dessus (« COMMENTE »), le mot en doré, la ligne du bas
  (« ET JE T'AIDE EN DM »), chacun calé sur sa voix ; le mot est le mot-clé dit (CONTEXTE, MONTEUR...).
- Sur la caméra, **au-dessus de la tête sans la chevaucher** (« il faut juste que ce soit au-dessus de ma tête pour que
  les 2 ne se superposent pas »), aucun sous-titre pendant. Sur fond uni : avec faisceau et quadrillage.
- Jamais en mot seul très grand, en faux champ de commentaire, ou avec le mot derrière la tête.

## 8. Son

- **Le son va sur les animations et les transitions** : chaque faisceau (déduit), l'apparition du CTA (déduit), et
  **chaque événement visuel d'une animation de motion**, dans le registre « motion design premium de SaaS explainer »
  (« des sound design pas hyper forts mais qui font la différence ») : whoosh (un panneau, un document, une règle qui
  entre, posé au début de l'entrée), pop (un petit objet qui éclot), clic (un élément d'interface qui s'ajoute, les « + »
  de l'accent fort), glisse (un objet qui glisse, se réduit, se verse), shimmer (un état qui passe au doré), curseur (un
  curseur qui se déplace, `duree` = son déplacement). Tu les écris (éléments `son`) aux instants des paramètres.
- **Jamais de son** sur un zoom, le suivi, les sous-titres, le mot doré, les crochets, le hook secondaire, le glissement
  du demi-écran, la frappe. Un son hors de toute fenêtre d'animation est refusé.
- Le minuteur se présente comme le CTA : `cta` à son entrée, `cta_lignes` 0,25 s après.
- Musique : `hiphop` par défaut ; `trap`, `boombap` selon le sujet ; `nappe` pour un reel calme et cinématique.

## 9. Densité

Un geste = un événement visible (faisceau, zoom ou dézoom rapide, coupe avec recadrage, changement de contenu d'un plein
écran, incrustation ou demi-écran qui apparaît, CTA). Deux régimes : **sobre** (un geste marquant toutes les 4 à 5 s,
plus un zoom lent continu) ou **dense** (6 à 7 gestes par 10 s comme le reel 4 ; la démo validée : 4,9 par 10 s).

## 10. Ce qu'on ne pose jamais

Un mot doré qui n'est pas le mot appuyé ; une expression dorée coupée ; un hook secondaire en catégorie ; un hook sans
ouverture quand la phrase commence avant le titre ; un demi-écran sans rôle ou collé à un mouvement de caméra ; une
chaîne demi -> plein -> caméra qui ne tient pas ; un retour à la caméra sans transition ; une animation en haut de
l'image pendant les sous-titres ; un CTA qui chevauche la tête ; un zoom lent pour accentuer ; un dézoom immédiat après
un zoom éclair ; un fichier en héros en demi-écran ; une fausse capture d'interface ou un logo hors tuile ; du vert vif.
