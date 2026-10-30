---
name: zooms
description: Brique du skill montage. Prépare les zooms d'une vidéo déjà coupée, repérés par la phrase dite (depuis le plan de montage que l'utilisateur colle, ou choisis avec retenue s'il n'en a pas), zoom sec sur une coupe, zoom progressif ou recul d'ouverture (mouvements à courbe douce, jamais linéaires), cadrés sur son visage. Ne fabrique pas la vidéo : c'est le skill montage qui fait le rendu. Pour toute demande de zooms, passe par le skill montage, qui t'enverra ici.
---

# Préparer les zooms

Tu arrives ici depuis le skill montage, une fois les coupes prêtes. Fais les étapes ci-dessous, puis retourne au skill montage pour fabriquer la vidéo.
Parle simplement, en français, en tutoyant. Ne montre ni les commandes ni les fichiers.

**Règle d'or : un zoom qui se remarque est raté.** Il veut un rendu « organique », qui a l'air simple et naturel : peu de zooms, bien placés, plutôt qu'un zoom par phrase.

## La commande
Le script est `scripts/zooms.ps1` dans le dossier de ce skill. Lance-le toujours ainsi, avec un **timeout de 600000 ms** :
```
powershell -NoProfile -ExecutionPolicy Bypass -File "<dossier du skill>\scripts\zooms.ps1" <commande> "<dossier>-montage"
```
(depuis un terminal bash, écris le chemin avec des `/` ; `powershell` fonctionne pareil.)

## Le déroulé

### 1. Le texte : `texte "<dossier>"`
Écrit `<dossier>\texte-numerote.md` : le texte de la vidéo coupée, une phrase par ligne, chaque mot précédé de son numéro (`[12]abdos`). Lis-le en entier.
- `TEXTE_INTROUVABLE` : la vidéo n'est pas encore coupée. Retourne au skill montage pour faire les coupes d'abord.

### 2. Choisir les zooms (c'est ton travail)
**S'il a collé un plan de montage** (souvent fait par ChatGPT, souvent un tableau « phrase par phrase ») : prends chaque zoom qu'il demande et retrouve **la phrase dite** dans le texte numéroté.
- **N'utilise jamais les minutages du plan** : ils sont devinés depuis le script, avant le tournage et avant les coupes. Seule la phrase compte.
- Il a improvisé autour de son script : la phrase n'est pas forcément mot pour mot. Prends celle qui dit la même chose au même endroit du propos. Si tu ne la retrouves pas, ne l'invente pas : dis-lui laquelle tu n'as pas trouvée.
- Garde l'échelle qu'il demande (« zoom 120 % » = `1.2`). Sans échelle précisée, `1.2`. « 100 % » ou « retour au cadrage normal » veut dire **pas de zoom** : c'est la fin du zoom d'avant.
- **Où le zoom commence** : au premier mot indiqué (« dès « Voici les quatre exercices » », « sur « Deuxièmement » »), sinon au début de la phrase de la ligne.
- **Où il finit** : un zoom tient tant que le plan ne change pas. Il finit sur le dernier mot avant le changement suivant du plan : un retour à 100 %, un autre zoom, ou un B-roll qui commence (le B-roll couvre l'image). Une ligne « fin de l'explication » sans phrase citée tombe au bout de la phrase d'avant.
- **Le mouvement** : s'il écrit « coupe franche », « changement de cadrage », ou rien de précis, c'est `sec`. `progressif` ou `recul` seulement s'il parle d'un zoom lent, qui avance ou recule doucement.
- Ignore ce qui n'est pas un zoom : les B-rolls sont pour le skill b-roll, les textes à afficher pour le skill sous-titres ; les plans à tourner et la musique ne sont faits par aucun skill. Dis-lui en une phrase ce que tu as laissé de côté.

**S'il n'a pas de plan** : choisis toi-même, avec retenue, selon cette grammaire (celle des montages de Yoan) :
- l'ouverture part un cran plus serré et recule jusqu'au cadrage normal : un `recul` sur la première phrase, `1.15` à `1.25` ;
- ensuite des paliers `sec` sur les phrases fortes : une affirmation qui tranche, le chiffre ou la promesse qui compte, l'appel à l'action de la fin ;
- au plus un `progressif` dans la vidéo, sur une phrase posée ou une confidence.
Environ un zoom toutes les 15 à 20 secondes, jamais deux phrases de suite. Dis-lui lesquelles tu as prises.

Écris `<dossier>\zooms.json` :
```json
{
  "zooms": [
    { "debut": 27, "fin": 40, "echelle": 1.2, "entree": "sec" },
    { "debut": 79, "fin": 93, "echelle": 1.15, "entree": "progressif", "cadrage": [0.42, 0.33] }
  ]
}
```
- `debut`, `fin` : numéros du premier et du dernier mot de la phrase zoomée (en général, la phrase entière).
- `echelle` : de `1.05` à `1.6`. `1.1` = léger, `1.2` = net, `1.3` et plus = fort (à réserver à un moment clé). En 1080p, au-delà de `1.3` l'image perd un peu en netteté ; en 4K, aucun souci.
- `entree` :
  - `sec` (par défaut) : l'image passe d'un coup plus près et tient. Le saut se cale tout seul sur la coupe la plus proche, il se lit alors comme un changement de plan. C'est le zoom « Edits » classique.
  - `progressif` : l'image s'avance doucement pendant toute la phrase : vive au départ, elle ralentit et se pose (jamais un mouvement linéaire, qui fait amateur). Plus discret, bien pour une phrase posée ou une confidence. Échelle conseillée : `1.1` à `1.2`.
  - `recul` : l'image part serrée d'un coup, puis recule doucement jusqu'au cadrage normal, avec la même courbe. Fait pour l'ouverture de la vidéo, ou pour relancer après un passage. Prends 2 à 3 secondes de mots, échelle `1.15` à `1.25`.
  - Le départ se cale sur la coupe la plus proche. La sortie d'un `sec` ou d'un `progressif` est sèche, calée elle aussi sur la coupe la plus proche ; un `recul` finit déjà au cadrage normal.
- `cadrage` (facultatif) : le point de l'image vers lequel on zoome, `[horizontal, vertical]` de `0` à `1` (`[0.5, 0.5]` = le centre). Ce point reste à sa place pendant que l'image grossit. Par défaut `[0.5, 0.35]`, entre ses yeux quand il est cadré en buste. Mets-y son visage.

### 3. Fabriquer les zooms : `preparer "<dossier>"`
Rien ne part sur le serveur. Quelques secondes.
Le script liste les zooms retenus (moment dans la vidéo, échelle, phrase) et fabrique une **image de contrôle par zoom** dans `<dossier>\zooms-apercu\` : l'image telle qu'elle sera au plus serré du zoom.
- `ZOOMS_ILLISIBLE` : corrige `zooms.json` comme indiqué (zooms qui se chevauchent, zoom trop court ou trop rapide, numéro inexistant), puis relance.

### 4. Vérifier avant de rendre (c'est ton travail)
Regarde chaque image de contrôle :
- son visage est entier, ni coupé par le bord ni collé au bord ;
- il reste un peu d'air au-dessus de sa tête.

S'il est décentré, déplace `cadrage` vers lui (il est à gauche : baisse la première valeur ; tête coupée en haut : baisse la seconde), puis relance `preparer`. C'est instantané.
Quand tout est bon, retourne au skill montage et fabrique la vidéo avec les couches demandées (par exemple `coupes,zooms` ou `coupes,zooms,b-roll,sous-titres`).

## Les retouches (à proposer quand il a vu la vidéo)
- « moins de zooms », « pas sur cette phrase » : retire-les de `zooms.json` ;
- « ajoute un zoom sur telle phrase » : ajoute-le ;
- « plus léger », « plus fort » : baisse ou monte `echelle` ;
- « plus doux » : `progressif` au lieu de `sec` ;
- « fais un zoom qui recule au début » : `recul` sur la première phrase.
Puis `preparer`, et le skill montage refait la vidéo depuis l'originale.
