---
name: montage
description: Monte une vidéo face caméra avec les briques que l'utilisateur demande (couper les silences et les reprises, poser les sous-titres) et fabrique la vidéo en un seul rendu depuis l'originale, en qualité d'origine. Point d'entrée de toute demande de montage vidéo. Déclencheurs : « coupe les silences », « dérushe cette vidéo », « mets les sous-titres », « monte cette vidéo », « coupe et sous-titre », une vidéo glissée avec une demande de montage, une retouche sur une vidéo déjà montée (« corrige ce mot », « plus serré », « sous-titres plus gros »).
---

# Monter une vidéo

L'utilisateur est un coach, pas un technicien. Parle-lui simplement, en français, en le tutoyant.
Ne lui montre ni les commandes ni les fichiers techniques : dis ce qui se passe (« je coupe », « je pose les sous-titres », « je fabrique la vidéo »).

## Le principe : une brique par demande, un seul rendu
Chaque brique prépare sa couche sans toucher à la vidéo. Ce skill fabrique ensuite la vidéo **une seule fois**, depuis la vidéo d'origine, avec les couches demandées. C'est ce qui garde la qualité : la vidéo n'est jamais réencodée deux fois.

Les briques sont dans les dossiers voisins de celui de ce skill :
- **coupes** : `..\couper-silences\SKILL.md` (silences, reprises, faux départs) ;
- **sous-titres** : `..\sous-titres\SKILL.md` (sous-titres à son style).

Règles qui ne bougent jamais :
- Ne pars **jamais** d'une vidéo déjà fabriquée (`-coupe.mp4`, `-monte.mp4`). S'il te donne une de ces vidéos, retrouve l'originale (même nom sans `-coupe` ou `-monte`, au même endroit) et son dossier `<nom>-montage`.
- Ne lance jamais ffmpeg toi-même sur la vidéo : le rendu passe par la commande ci-dessous.
- N'applique que les couches qu'il a demandées. Un fichier d'une autre brique qui traîne dans le dossier ne compte pas.

## Le déroulé

### 1. Ce qu'il veut
Repère les briques demandées. S'il n'est pas clair (« monte cette vidéo »), demande-lui en une question : couper les silences seulement, ou couper et mettre les sous-titres ?
Les sous-titres se calent sur la vidéo coupée : demander les sous-titres, c'est aussi couper. Si les coupes ont déjà été faites dans une conversation précédente (le dossier `<nom>-montage` contient `filtre.txt`), ne les refais pas, sauf s'il le demande.

### 2. Préparer chaque brique, dans l'ordre : coupes, puis sous-titres
Lis le SKILL.md de la brique et fais ses étapes. Aucune brique ne fabrique la vidéo : quand la brique a fini, reviens ici.

### 3. Fabriquer la vidéo
```
powershell -NoProfile -ExecutionPolicy Bypass -File "<dossier de ce skill>\scripts\montage.ps1" rendre "<dossier>-montage" <couches>
```
avec un **timeout de 600000 ms**, et `<couches>` = ce qu'il a demandé, séparé par des virgules : `coupes` ou `coupes,sous-titres`.
(depuis un terminal bash, écris le chemin avec des `/` ; `powershell` fonctionne pareil.)
- La vidéo sort à côté de l'originale : `<nom>-coupe.mp4` (coupes seules) ou `<nom>-monte.mp4` (plusieurs couches), avec un numéro si le fichier existe déjà. Elle s'ouvre toute seule.
- Compte une à quelques minutes selon la longueur et l'ordinateur. La première fois avec des sous-titres, un outil vidéo peut s'installer (1 à 2 min) : préviens que ça n'arrive qu'une fois.
- `COUCHE_MANQUANTE` : la brique indiquée n'a pas été préparée. Fais-la, puis relance.

### 4. Rendre compte
Dis où est la vidéo, sa durée, et en une phrase ce qui a été fait (« 6 reprises coupées, de 4 min 44 à 52 s, sous-titres posés »).
Propose les retouches de chaque brique utilisée, sans jargon (la liste est dans le SKILL.md de chaque brique).

### 5. Les retouches
Une retouche ne change que la couche concernée : refais l'étape de la brique (corriger un mot, rythme plus serré…), puis refabrique la vidéo avec **les mêmes couches**, toujours depuis l'originale. Les anciennes versions restent à côté, numérotées.
