---
name: monter
description: Monte automatiquement une vidéo face caméra filmée d'une traite. Coupe les blancs, les reprises et les faux départs, garde la meilleure prise, pose les sous-titres mot à mot et nettoie le son. La vidéo montée apparaît à côté de l'originale. Déclencheurs : « monte cette vidéo », « coupe les blancs », « mets les sous-titres », « /monter », une vidéo glissée avec une demande de montage.
---

# Monter une vidéo

L'utilisateur est un coach, pas un technicien. Parle-lui simplement, en français, en le tutoyant.
Ne montre jamais les commandes ni les détails techniques : dis ce qui se passe (« je prépare ta vidéo », « le montage est en cours »).

Le script est dans le dossier de ce skill : `scripts/monter.sh` (chemin complet = dossier de base du skill + `/scripts/monter.sh`).
Lance-le toujours avec `bash "<chemin>"` et un **timeout de 600000 ms** sur l'outil Bash.

## 1. Trouver la vidéo

- Si l'utilisateur a glissé ou donné un fichier, c'est lui.
- Sinon demande-lui : « Glisse ta vidéo ici (depuis le Finder ou l'Explorateur) et appuie sur Entrée. »
- Une seule vidéo à la fois.

## 2. Envoyer

```bash
bash "<chemin>/scripts/monter.sh" envoyer "<chemin de la vidéo>"
```

Selon ce qui sort :
- `CODE_MANQUANT` : c'est la première fois. Demande : « C'est ta première vidéo : colle-moi le code de démo que Yoan t'a envoyé. »
  Puis `bash "<chemin>/scripts/monter.sh" code <code>` et relance l'envoi.
- `CODE_REFUSÉ` ou `ENVOI_REFUSÉ` : répète le message tel quel à l'utilisateur, sans rien ajouter de technique.
- La première fois, le script installe un outil vidéo (environ 1 minute) : préviens que c'est normal et que ça n'arrive qu'une fois.
- `ENVOYÉ id=<id>` : passe à l'étape 3.

## 3. Suivre et récupérer

```bash
bash "<chemin>/scripts/monter.sh" attendre <id>
```

- Annonce avant : « C'est parti, le montage prend 2 à 4 minutes pour une minute de vidéo. »
- `PAS_FINI` : relance la même commande, sans rien demander.
- `PRÊT <fichier>` : la vidéo s'ouvre toute seule. Dis où elle est rangée (même dossier que l'originale, nom terminé par `-monte`) et combien de vidéos de démo il reste.
- `ERREUR_MONTAGE` : dis que le montage n'a pas abouti et propose de réessayer une fois. Si ça échoue encore, conseille d'écrire à Yoan en lui donnant l'heure.

## Ce que le montage fait (si on te le demande)

Il repère les blancs, les reprises (il garde la meilleure prise, la dernière à qualité égale), les faux départs et les hésitations, et les coupe.
Il pose des sous-titres blancs avec le mot prononcé surligné en orange, et il nettoie la voix.
C'est une démo : un petit filigrane « DÉMO » reste en haut de l'image.
