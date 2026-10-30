---
name: b-roll
description: Brique du skill montage. Pose les B-rolls d'une vidéo déjà coupée (ses clips de démonstration), chacun sur la phrase indiquée par son plan de montage, par-dessus l'image pendant que sa voix continue, mis au cadre de la vidéo. Ne fabrique pas la vidéo : c'est le skill montage qui fait le rendu, avec les sous-titres par-dessus les B-rolls. Pour toute demande de B-rolls, passe par le skill montage, qui t'enverra ici.
---

# Poser les B-rolls

Tu arrives ici depuis le skill montage, une fois les coupes prêtes. Fais les étapes ci-dessous, puis retourne au skill montage pour fabriquer la vidéo.
Parle simplement, en français, en tutoyant. Ne montre ni les commandes ni les fichiers.

Un B-roll, c'est un clip (sa démonstration d'un exercice, un plan de lui à l'entraînement) qui couvre l'image pendant qu'il parle. Sa voix continue, le son du clip n'est pas gardé. Les sous-titres et les titres restent visibles par-dessus.

## La commande
Le script est `scripts/b-roll.ps1` dans le dossier de ce skill. Lance-le toujours ainsi, avec un **timeout de 600000 ms** :
```
powershell -NoProfile -ExecutionPolicy Bypass -File "<dossier du skill>\scripts\b-roll.ps1" <commande> "<chemin>"
```
(depuis un terminal bash, écris le chemin avec des `/` ; `powershell` fonctionne pareil.)

## Le déroulé

### 1. Ses clips : `vignettes "<dossier des clips>"`
Il faut savoir quel fichier montre quoi. S'il ne t'a pas dit où sont ses clips, demande-lui de les glisser dans la conversation ou de te donner leur dossier (une seule question).
La commande écrit, pour chaque clip, une image avec trois moments du clip (début, milieu, fin) dans `<dossier des clips>\b-roll-vignettes\`, et donne la durée de chaque clip. **Regarde chaque image** : c'est comme ça que tu sais que tel fichier est « PAILs/RAILs au sol » ou « dips excentriques ».
- Un nom de fichier qui porte le numéro du plan (`broll-2`, `B-ROLL 2`) suffit, mais vérifie quand même l'image : un mauvais clip sur une explication se voit tout de suite.
- Un clip du plan que tu ne retrouves pas : ne mets pas un autre clip à sa place. Dis-lui lequel manque.

### 2. Le texte : `texte "<dossier>-montage"`
Écrit `texte-numerote.md` : le texte de la vidéo coupée, une phrase par ligne, chaque mot précédé de son numéro (`[12]abdos`). Lis-le en entier.
- `TEXTE_INTROUVABLE` : la vidéo n'est pas encore coupée. Retourne au skill montage pour faire les coupes d'abord.

### 3. Placer chaque B-roll (c'est ton travail)
Pour chaque B-roll de son plan, retrouve **la phrase dite** dans le texte numéroté, comme pour les zooms :
- **N'utilise jamais les minutages du plan** : ils sont devinés avant le tournage et avant les coupes. Seule la phrase compte. Il a improvisé : prends la phrase qui dit la même chose au même endroit du propos.
- **Début** : le premier mot indiqué (« Début sur « Je travaille l'extension » », « Faire apparaître sur « retrouver des dips » »).
- **Fin** : le dernier mot avant que le plan revienne sur lui (la ligne suivante du plan : « FACECAM », « retour au cadrage normal », « revenir sur mon visage à la fin de l'explication »). Si l'explication continue au-delà de la phrase citée, le B-roll la couvre jusqu'au bout, puis on revient sur lui.
- Le même clip peut servir deux fois (« B-ROLL 5 » au début et à la fin) : prends alors un autre passage du clip la deuxième fois, avec `depart`.

Écris `<dossier>-montage\b-roll.json` :
```json
{
  "brolls": [
    { "fichier": "C:\\Users\\romain\\Videos\\dips\\broll-1.mov", "debut": 25, "fin": 47 },
    { "fichier": "C:\\Users\\romain\\Videos\\dips\\broll-5.mov", "debut": 120, "fin": 131, "depart": 4 }
  ]
}
```
- `fichier` : le chemin complet du clip.
- `debut`, `fin` : numéros du premier et du dernier mot couverts par le clip. Sans `fin`, il couvre jusqu'au bout de la phrase où il commence.
- `depart` (facultatif) : à combien de secondes du clip on commence, `0` par défaut. Utile si le début du clip est un temps mort (il se met en place) ou pour réutiliser un clip.

### 4. Vérifier : `preparer "<dossier>-montage"`
Quelques secondes. Le script liste chaque B-roll posé : moment dans la vidéo, clip, phrase couverte.
- « clip plus court que la phrase » : le clip s'arrête avant la fin de la phrase, et on revient sur lui plus tôt. Dis-le-lui : il peut garder comme ça, ou t'envoyer un clip plus long.
- `B-ROLL_ILLISIBLE` : corrige `b-roll.json` comme indiqué (fichier introuvable, B-rolls qui se chevauchent, départ hors du clip), puis relance.

Quand tout est bon, retourne au skill montage et fabrique la vidéo avec la couche `b-roll` en plus des autres demandées.

## Ce qu'il faut savoir
- Un clip filmé à l'horizontale est recadré au centre pour remplir l'image verticale : on perd ses côtés. S'il filme ses B-rolls, conseille-lui de les filmer à la verticale.
- Le clip est mis à la cadence et au sens de sa vidéo dans le même rendu : rien à préparer de son côté.

## Les retouches (à proposer quand il a vu la vidéo)
- « le B-roll arrive trop tôt / trop tard » : avance ou recule `debut` d'un mot ou deux ;
- « reste plus longtemps sur la démo » : `fin` plus loin ;
- « commence plus loin dans le clip » : `depart` ;
- « pas de B-roll ici » : retire-le de `b-roll.json`.
Puis `preparer`, et le skill montage refait la vidéo depuis l'originale.
