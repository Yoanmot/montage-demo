---
name: b-roll
description: Brique de l'agent monteur. Pose les B-rolls d'une vidéo déjà coupée (ses clips filmés : démonstrations, scènes tournées pour le brief), chacun sur la phrase indiquée par son plan de montage, calés sur les coupes, accélérés au besoin pour tenir le passage exact, par-dessus l'image pendant que sa voix continue. Ne fabrique pas la vidéo : c'est la brique rendu qui le fait, avec les sous-titres par-dessus. Pour toute demande de B-rolls, passe par l'agent monteur, qui t'enverra ici.
---

# Poser les B-rolls

Tu arrives ici depuis l'agent monteur, une fois les coupes prêtes. Fais les étapes ci-dessous, puis rends-lui la main :
il fabrique la vidéo avec la brique rendu.
Parle simplement, en français, en tutoyant. Ne montre ni les commandes ni les fichiers.

Un B-roll, c'est un clip **filmé par Romain** (sa démonstration d'un exercice, un plan de lui à l'entraînement, une scène de sa vie tournée pour le brief de la vidéo) qui couvre l'image pendant qu'il parle. Jamais de B-roll généré par IA : Romain n'en veut pas. Sa voix continue, le son du clip n'est pas gardé. Les sous-titres et les titres restent visibles par-dessus.

## La commande
Le script est `scripts/b-roll.py` dans le dossier de ce skill. Lance-le toujours ainsi, avec un **timeout de 600000 ms** :
```
/usr/bin/python3 "<dossier du skill>/scripts/b-roll.py" <commande> "<chemin>"
```

## Le déroulé

### 1. Ses clips : `vignettes "<dossier des clips>"`
Il faut savoir quel fichier montre quoi. S'il ne t'a pas dit où sont ses clips, demande-lui de les glisser dans la conversation ou de te donner leur dossier (une seule question). Cette étape se fait **avant le plan** : c'est en voyant ses clips que le monteur décide où les poser. S'il a collé son brief de tournage, il dit sur quelle phrase va chaque plan filmé.
La commande écrit, pour chaque clip, une image avec trois moments du clip (début, milieu, fin) dans `<dossier des clips>/b-roll-vignettes/`, et donne la durée de chaque clip. **Regarde chaque image** : c'est comme ça que tu sais que tel fichier est « PAILs/RAILs au sol » ou « dips excentriques ».
- Un nom de fichier qui porte le numéro du plan (`broll-2`, `B-ROLL 2`) suffit, mais vérifie quand même l'image : un mauvais clip sur une explication se voit tout de suite.
- Un clip du brief que tu ne retrouves pas : ne mets pas un autre clip à sa place. Dis-lui lequel manque.

### 2. Le texte : `texte "<dossier>-montage"`
Écrit `texte-b-roll.md` : le texte de la vidéo coupée, une phrase par ligne, chaque mot précédé de son numéro (`[12]abdos`). Lis-le en entier.
- `TEXTE_INTROUVABLE` : la vidéo n'est pas encore coupée. Les coupes d'abord.

### 3. Placer chaque B-roll (c'est ton travail)
Pour chaque entrée `b_roll` du plan de montage, retrouve **la phrase dite** dans le texte numéroté, comme pour les zooms :
- Seule la phrase compte, jamais un minutage. Les ancres du plan (`de`, `a`) sont des citations de ce qu'il a dit : prends les numéros de leurs mots.
- **Début** : le premier mot de l'ancre `de`. **Fin** : le dernier mot de l'ancre `a` ; sans `a`, le dernier mot de la phrase où il commence.
- `depart`, `vitesse` du plan : recopie-les. Le même clip peut servir deux fois : un autre passage du clip la deuxième fois, avec `depart`.

Écris `<dossier>-montage/b-roll.json` :
```json
{
  "brolls": [
    { "fichier": "/Users/romain/Movies/dips/broll-1.mov", "debut": 25, "fin": 47 },
    { "fichier": "/Users/romain/Movies/cuisine/IMG_2041.MOV", "debut": 69, "fin": 94, "vitesse": "ajuster" },
    { "fichier": "/Users/romain/Movies/dips/broll-5.mov", "debut": 120, "fin": 131, "depart": 4, "jusqua": 9 }
  ]
}
```
- `fichier` : le chemin complet du clip.
- `debut`, `fin` : numéros du premier et du dernier mot couverts par le clip.
- **Calage, tout seul, à l'image près** : si le premier mot ouvre un morceau gardé, le clip part sur la coupe (il la
  cache) ; sinon une image avant l'attaque du mot. Si le dernier mot ferme un morceau, le clip s'arrête sur la coupe
  suivante ; sinon il reste jusqu'à ce qu'il reprenne la parole (pause de 0,6 s au plus), sinon jusqu'à la fin du mot.
  Toutes les images du passage sont couvertes, la dernière comprise. `"coupes": false` cale sur les mots seulement.
- `depart` (facultatif) : à combien de secondes du clip on commence, `0` par défaut (début du clip qui est un temps
  mort, ou clip réutilisé). `jusqua` (facultatif) : où s'arrête la partie du clip à montrer.
- `vitesse` (facultatif) : `1` par défaut ; un nombre (`2` = deux fois plus vite) ; `"ajuster"` = la partie choisie du
  clip (de `depart` à `jusqua`, sinon jusqu'au bout) passe **exactement** sur la durée du passage, accélérée ou ralentie
  (de 0,5 à 4 fois). C'est ce qu'il faut quand le plan dit « en accéléré » ou qu'une scène doit tenir toute la phrase.

### 4. Vérifier : `preparer "<dossier>-montage"`
Quelques secondes. Le script liste chaque B-roll posé : images de la vidéo coupée, calage (coupe ou mot), clip, vitesse, phrase couverte.
- « clip plus court que le passage » : à vitesse normale, le clip s'arrête avant la fin et on revient sur lui plus tôt. Dis-le-lui, ou mets `"vitesse": "ajuster"` si la scène peut être accélérée.
- `B-ROLL_ILLISIBLE` : corrige `b-roll.json` comme indiqué (fichier introuvable, B-rolls qui se chevauchent, départ hors du clip, vitesse hors de 0,5 à 4), puis relance.

Quand tout est bon, rends la main au monteur : la couche `b-roll` part dans la planche puis dans le rendu.

## Ce qu'il faut savoir
- Un clip filmé à l'horizontale est recadré au centre pour remplir l'image verticale : on perd ses côtés. S'il filme ses B-rolls, conseille-lui de les filmer à la verticale.
- Le clip est mis à 30 images par seconde, au cadre et en SDR (un clip HDR d'iPhone est converti) dans le même rendu : rien à préparer de son côté.

## Les retouches (à proposer quand il a vu la vidéo)
- « le B-roll arrive trop tôt / trop tard » : avance ou recule `debut` d'un mot ou deux ;
- « reste plus longtemps sur la démo » : `fin` plus loin ;
- « commence plus loin dans le clip » : `depart` ; « plus vite » : `vitesse` ;
- « pas de B-roll ici » : retire-le de `b-roll.json`.
Puis `preparer`, et le monteur refait la vidéo depuis l'originale.

## Dépendances
- Python 3 du Mac (`/usr/bin/python3`), sans module en plus.
- ffmpeg et ffprobe (Homebrew : `/opt/homebrew/bin/`).
