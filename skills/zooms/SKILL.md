---
name: zooms
description: Brique du skill montage. Prépare les zooms d'une vidéo déjà coupée, repérés par la phrase dite (depuis le plan de montage que l'utilisateur colle, ou choisis avec retenue s'il n'en a pas), zoom sec sur une coupe ou zoom progressif lissé, cadrés sur son visage. Ne fabrique pas la vidéo : c'est le skill montage qui fait le rendu. Pour toute demande de zooms, passe par le skill montage, qui t'enverra ici.
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
**S'il a collé un plan de montage** (souvent fait par ChatGPT) : prends chaque zoom qu'il demande et retrouve **la phrase dite** dans le texte numéroté.
- **N'utilise jamais les minutages du plan** : ils sont devinés depuis le script, avant le tournage et avant les coupes. Seule la phrase compte.
- Il a improvisé autour de son script : la phrase n'est pas forcément mot pour mot. Prends celle qui dit la même chose au même endroit du propos. Si tu ne la retrouves pas, ne l'invente pas : dis-lui laquelle tu n'as pas trouvée.
- Garde l'échelle qu'il demande (« zoom 120 % » = `1.2`). Sans échelle précisée, `1.2`.
- Ignore ce qui n'est pas un zoom (b-rolls, plans à tourner, musique, textes à l'écran) : ce skill ne fait que les zooms. Dis-lui en une phrase ce que tu as laissé de côté.

**S'il n'a pas de plan** : choisis toi-même, avec retenue. Repère les phrases fortes : l'accroche, une affirmation qui tranche, le chiffre ou la promesse qui compte, l'appel à l'action de la fin. Environ un zoom toutes les 15 à 20 secondes, jamais deux phrases de suite. Dis-lui lesquelles tu as prises.

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
  - `sec` (par défaut) : l'image passe d'un coup plus près. Le saut se cale tout seul sur la coupe la plus proche, il se lit alors comme un changement de plan. C'est le zoom « Edits » classique.
  - `progressif` : l'image s'avance doucement pendant la phrase (lissé au départ et à l'arrivée), puis tient. Plus discret, bien pour une phrase posée ou une confidence. Échelle conseillée : `1.1` à `1.2`.
  - La sortie de chaque zoom est sèche, calée sur la coupe la plus proche.
- `cadrage` (facultatif) : le point de l'image vers lequel on zoome, `[horizontal, vertical]` de `0` à `1` (`[0.5, 0.5]` = le centre). Ce point reste à sa place pendant que l'image grossit. Par défaut `[0.5, 0.35]`, entre ses yeux quand il est cadré en buste. Mets-y son visage.

### 3. Fabriquer les zooms : `preparer "<dossier>"`
Rien ne part sur le serveur. Quelques secondes.
Le script liste les zooms retenus (moment dans la vidéo, échelle, phrase) et fabrique une **image de contrôle par zoom** dans `<dossier>\zooms-apercu\` : l'image telle qu'elle sera au plus serré du zoom.
- `ZOOMS_ILLISIBLE` : corrige `zooms.json` comme indiqué (zooms qui se chevauchent, zoom trop court, numéro inexistant), puis relance.

### 4. Vérifier avant de rendre (c'est ton travail)
Regarde chaque image de contrôle :
- son visage est entier, ni coupé par le bord ni collé au bord ;
- il reste un peu d'air au-dessus de sa tête.

S'il est décentré, déplace `cadrage` vers lui (il est à gauche : baisse la première valeur ; tête coupée en haut : baisse la seconde), puis relance `preparer`. C'est instantané.
Quand tout est bon, retourne au skill montage et fabrique la vidéo avec les couches demandées (`coupes,zooms` ou `coupes,zooms,sous-titres`).

## Les retouches (à proposer quand il a vu la vidéo)
- « moins de zooms », « pas sur cette phrase » : retire-les de `zooms.json` ;
- « ajoute un zoom sur telle phrase » : ajoute-le ;
- « plus léger », « plus fort » : baisse ou monte `echelle` ;
- « plus doux » : `progressif` au lieu de `sec`.
Puis `preparer`, et le skill montage refait la vidéo depuis l'originale.
