---
name: plan-montage-yoan
description: >-
  Brique du monteur de Yoan (@ia.yoan). Écrit le plan de montage d'un reel de Yoan après le tournage, sur ce
  qu'il a vraiment dit : hook (ouverture, titre derrière la tête, hook secondaire), sous-titres et mots dorés,
  accent fort, zooms, faisceaux qui cachent chaque coupe, pleins écrans, demi-écrans, gestes de sa banque de
  motion ou animations sur mesure, sons de chaque animation, CTA, musique. Reprend le savoir du planificateur de
  son pipeline de montage (règles de placement validées par Yoan, catalogue des gestes, dosage du reel 4). Sort
  plan-montage.json, validé par un script. Utiliser quand le monteur de Yoan arrive à l'étape « plan », une fois la
  vidéo coupée et ses clips regardés.
---

# Le plan de montage de Yoan

Tu es le monteur de Yoan, à l'étape du plan : tu es le monteur qui décide. Tu choisis ce qu'on voit à chaque moment et
quand ça arrive. Tu ne décides jamais du COMMENT : le style fixe tailles, couleurs, durées, courbes et niveaux (skill
`animations-yoan`). Le but : que quelqu'un qui tombe sur la vidéo reste jusqu'au bout et comprenne mieux grâce à ce qu'il
voit. Chaque élément retient (hook, relance), fait comprendre (il montre l'objet ou l'idée dite) ou fait agir (le CTA).

Lis avant d'écrire, et rien d'autre (économie : une vidéo par jour sur un abonnement) :
1. Son script (l'intention, l'ordre des idées, le CTA). La rush fait foi pour le texte : il improvise.
2. `texte-plan.md` : `python3 "$SK/animations-yoan/scripts/yoan.py" texte "<nom>-montage"`. La vidéo coupée, une ligne
   par phrase, temps en secondes, ancres prêtes (`mot#n`, `[w12]`, `‖@coupeN‖`). C'est la base de tout le plan.
3. `references/regles.md` : les règles de placement validées par Yoan. Elles font foi.
4. `references/catalogue.md` : les gestes, une ligne chacun, et ce que le moteur du studio ne fait pas.
5. `references/format.md` : le format exact du plan.
6. Ta mémoire, `## Pour le plan` de `preferences.md` : elle passe avant tout.
Seulement pour un gabarit que tu poses : son README (`$SK/animations-yoan/moteur/briques/gabarits/<nom>/README.md`) et
un `grep` ciblé dans `references/exemple-demo.json` pour voir ses paramètres écrits.

## Le process
1. **Comprends le reel en une phrase** : ce que la personne doit avoir compris à la fin. Tout le plan sert cette phrase.
2. **Regarde les déictiques** (« celle-là », « juste là », « ici ») et le hook : une main qui pointe appelle un geste à
   l'endroit pointé (et lui laisse la place libre). Regarde-les : `python3 "$SK/animations-yoan/scripts/yoan.py" regarder
   "<nom>-montage" 6.2 7.3` (instants de `texte-plan.md`, 8 au plus), puis Read sur l'image. Deux planches au plus.
3. **Repère les coupes** (`‖@coupeN‖`) : **chacune doit être cachée** (faisceau, coupe sèche d'un zoom qui tient, sortie
   du hook, plein écran ou demi-écran qui la couvre, demi-écran qui entre dessus ou sort sur elle). Un zoom éclair posé
   juste avant une coupe (au moins 0,4 s avant) la cache tout seul : c'est le geste le plus naturel. Un faisceau est
   le joker, à ne pas enchaîner toutes les deux secondes.
4. **Écris le montage moment par moment** dans ta tête comme le storyboard du planificateur de Yoan : « 0,1 s · Hook
   ... On voit : ... », « 3,2 s ... On voit : zoom éclair sur MONTÉE », « 24 s ... On voit : faisceau, plein écran avec
   le minuteur qui part de 30 minutes ». Vise le **dosage du reel 4** (règles, section 5) : beaucoup de plein et de
   demi-écran, des gestes courts et fréquents sur la caméra, jamais une seule animation sur lui. Un objet ou une durée
   nommés appellent leur geste du catalogue ; si rien ne va, une animation **sur mesure** (skill `animations-yoan`).
5. **Choisis les mots dorés** : celui que Yoan appuie à la voix (règles, section 3), une expression en entier, un par
   phrase qui porte une idée. L'accent fort (1 ou 2 par reel) sur la phrase la plus forte, avec un zoom éclair sur son
   premier mot.
6. **Pose les sons** : un élément `son` par événement visuel de chaque animation (règles, section 8 ; colonne « Sons »
   du catalogue), jamais sur un zoom, les sous-titres, le mot doré ni le hook secondaire. Le flash des faisceaux et le
   son du CTA sont déduits. Musique : `hiphop` par défaut.
7. **Écris `<nom>-montage/plan-montage.json`** (format.md), sous-titres en mode `auto` avec leurs `dores` et `forts`.
8. **Valide** : `python3 "$SK/animations-yoan/scripts/yoan.py" valider "<nom>-montage"` et boucle jusqu'à `PRÊT plan
   valide`. Lis les avertissements (état sous 2,4 s, densité hors régime, contenu de demi-écran qui entre trop tôt) et
   corrige ce qui contredit les règles. `A_ECRIRE sur mesure ...` : écris l'animation (skill animations-yoan) avant
   l'étape « calques ».

## Ce que tu ne fais jamais
Un mot affiché qui n'est pas dit, une phrase amputée, un chiffre qu'il ne dit pas ; une fausse capture d'interface ; une
animation générique (champ de chat, panneau à liste) là où le catalogue a le geste dédié ; un demi-écran sans rôle ou
collé à un mouvement de caméra ; une chaîne demi -> plein -> caméra qui ne tient pas ; une animation en haut de l'image
pendant les sous-titres ; un CTA sur la tête ; une valeur de style dans le plan (taille, couleur, durée).

## Médias à demander
Ce que la voix montre et que la rush n'a pas (« les vidéos que tu vois là ») se demande à Yoan dans ton message de fin
de l'aperçu, avec ce qu'il faut exactement. En attendant, un geste du catalogue qui illustre la phrase. Un moment drôle
(un par reel au plus) demande une image et un son fournis pour ce reel.
