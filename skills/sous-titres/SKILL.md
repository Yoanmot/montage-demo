---
name: sous-titres
description: Brique du skill montage. Prépare les sous-titres d'une vidéo déjà coupée, au style choisi par l'utilisateur (blanc très gras, le mot prononcé sur un pavé orange qui glisse de mot en mot), à partir du texte calé par couper-silences, avec l'orthographe corrigée sans toucher à ce qu'il dit, plus les titres à l'écran de son plan de montage (carte noire bordée d'orange en haut de l'image, mot-clé en orange). Ne fabrique pas la vidéo : c'est le skill montage qui fait le rendu. Pour toute demande de sous-titres, passe par le skill montage, qui t'enverra ici.
---

# Préparer les sous-titres

Tu arrives ici depuis le skill montage, une fois les coupes prêtes. Fais les étapes ci-dessous, puis retourne au skill montage pour fabriquer la vidéo.
Parle simplement, en français, en tutoyant. Ne montre ni les commandes ni les fichiers.

## La commande
Le script est `scripts/sous-titres.ps1` dans le dossier de ce skill. Lance-le toujours ainsi, avec un **timeout de 600000 ms** :
```
powershell -NoProfile -ExecutionPolicy Bypass -File "<dossier du skill>\scripts\sous-titres.ps1" <commande> "<dossier>-montage"
```
(depuis un terminal bash, écris le chemin avec des `/` ; `powershell` fonctionne pareil.)

## Le déroulé

### 1. Le texte : `texte "<dossier>"`
Écrit `<dossier>\texte-numerote.md` : le texte de la vidéo coupée, une phrase par ligne, chaque mot précédé de son numéro (`[12]abdos`). Lis-le en entier.
- `TEXTE_INTROUVABLE` : la vidéo n'est pas encore coupée. Retourne au skill montage pour faire les coupes d'abord.

### 2. Corriger l'orthographe (c'est ton travail)
Le texte vient d'une transcription automatique : quelques mots peuvent être mal écrits (noms propres, marques, vocabulaire de coach, mots mal entendus).
**Tu corriges l'orthographe, tu ne réécris jamais ce qu'il dit** : pas de reformulation, pas de mot ajouté ou retiré, pas de « euh » enlevé s'il a été gardé à la coupe. Dans le doute, ne touche pas. Les nombres restent comme ils sont écrits.

Écris `<dossier>\sous-titres.json` :
```json
{
  "corrections": { "57": "Ekklo", "102": "squats," },
  "masquer": [[140, 145]],
  "taille": 1,
  "position": 0.70,
  "titres": [
    { "debut": 0, "texte": "4 EXERCICES POUR TES *DIPS*" },
    { "debut": 41, "fin": 52, "texte": "1. PAILs / RAILs" }
  ]
}
```
- `corrections` : numéro du mot → le mot corrigé. **Garde la ponctuation du mot d'origine** (elle sert à découper les lignes).
- `masquer` (facultatif) : des plages de numéros de mots à ne pas afficher, bornes incluses. Seulement s'il le demande.
- `taille` (facultatif) : `1` par défaut, `1.15` = 15 % plus gros, `0.9` = plus petit.
- `position` (facultatif) : hauteur du centre de la ligne, de `0` (tout en haut) à `1` (tout en bas). `0.70` par défaut ; `0.62` = plus haut, `0.80` = plus bas.
- `titres` (facultatif) : les textes à afficher de son plan de montage (souvent un tableau « Textes à afficher »). Chacun s'affiche en haut de l'image, dans une carte noire arrondie bordée d'orange, à la police de ses titres (les lignes se coupent toutes seules). Le titre du début de la vidéo est là dès la première image, sans animation : c'est l'image de la miniature.
  - `texte` : **exactement le texte de son plan**, majuscules comprises. Tu n'en inventes pas s'il n'en a pas demandé.
  - Le mot-clé : entoure d'étoiles le mot qui porte l'idée du titre (`*DIPS*`, `*CONTRÔLE*`), il passe en orange. Un seul par titre, un à trois mots, le reste du texte ne bouge pas. Un numéro de tête (« 1. ») passe en orange tout seul : sur un titre numéroté, pas de mot-clé en plus. S'il désigne lui-même le mot à mettre en avant, c'est le sien.
  - `debut` : numéro du mot où il apparaît : le premier mot de la phrase indiquée (« Écris-moi en DM » : le mot « Écris-moi »).
  - `fin` (facultatif) : numéro du dernier mot pendant lequel il reste. Sans `fin`, il reste jusqu'au bout de la phrase où il commence (au moins 2 s). Un titre s'efface quand le suivant arrive.
- Rien à corriger : `{}` suffit.
- Les consignes de sous-titres d'un plan de montage (« groupes de mots lisibles qui suivent les phrases », « présents pendant les démonstrations ») sont déjà ce que fait ce skill : rien à régler.

### 3. Fabriquer les sous-titres : `preparer "<dossier>"`
Seuls les mots partent sur le serveur de Yoan (pas la vidéo). Quelques secondes.
- `CODE_MANQUANT` : demande le code d'accès que Yoan lui a envoyé, puis enregistre-le avec le skill couper-silences (commande `code`).
- `SOUS-TITRES_ILLISIBLE` : corrige `sous-titres.json` comme indiqué, puis relance.
- `PRÊT` : le script liste les titres posés (moment, texte). Retourne au skill montage et fabrique la vidéo avec les couches demandées : `coupes,sous-titres`, plus `zooms` et `b-roll` s'il les a demandés.

## Les retouches (à proposer quand il a vu la vidéo)
- « tel mot est mal écrit » : une ligne dans `corrections` ;
- « enlève cette phrase des sous-titres » : `masquer` ;
- « plus gros », « plus petit » : `taille` ;
- « plus haut », « plus bas » : `position` ;
- « change ce titre », « ajoute un titre ici », « le titre reste trop longtemps », « mets tel mot en orange » : `titres`.
Puis `preparer`, et le skill montage refait la vidéo depuis l'originale.
Les sous-titres sont incrustés dans l'image : on ne peut pas les retoucher dans Edits. Pour changer un mot, il le demande ici et la vidéo est refaite en quelques minutes.
