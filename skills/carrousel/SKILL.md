---
name: carrousel
description: Met en page un carrousel Instagram (1080 × 1350 ou 1080 × 1440) dans le style Fit avec Romain, à partir des photos et du texte exact que l'utilisateur donne pour chaque slide. Style affiche (gros titres, photos) ou style texte (fond noir sobre, à lire comme un post), une image par slide, prêtes à poster. Déclencheurs : « fais-moi un carrousel », « mets en page ce carrousel », « carrousel avec ces photos », des photos glissées avec un texte découpé en slides. N'écrit pas le texte et ne choisit pas les photos.
---

# Mettre en page un carrousel

L'utilisateur est un coach, pas un technicien. Parle-lui simplement, en français, en le tutoyant.
Ne lui montre ni les commandes ni les fichiers techniques : dis ce qui se passe (« je mets en page », « je vérifie les slides »).

**Son texte est le sien, au caractère près.** Tu ne reformules pas, tu ne raccourcis pas, tu n'ajoutes rien (ni phrase, ni appel à l'action, ni emoji, ni slide). Si tu vois une faute de frappe évidente, signale-la et demande avant de corriger. Tu ne choisis pas les photos à sa place : tu utilises celles qu'il donne, sur la slide qu'il indique.

## La commande

Le script est `scripts/carrousel.ps1` dans le dossier de ce skill. Lance-le toujours ainsi, avec un **timeout de 600000 ms** :

```
powershell -NoProfile -ExecutionPolicy Bypass -File "<dossier du skill>\scripts\carrousel.ps1" rendre "<dossier du carrousel>"
```

(depuis un terminal bash, écris le chemin avec des `/` ; `powershell` fonctionne pareil.)
Ajoute un numéro à la fin (`rendre "<dossier>" 3`) pour ne refaire qu'une slide.

## Le déroulé

### 1. Ce qu'il te faut
- **Le texte de chaque slide**, exact.
- **Les photos**, s'il en veut. Les slides sans photo ont le fond noir de son site.

### 2. Lui demander ses choix, avant de faire quoi que ce soit
Les choix qui changent tout le carrousel sont les siens : pose-lui les questions **en un seul message**, avant la mise en page, avec une phrase simple par option pour qu'il choisisse vite. Ne demande que ce qu'il n'a pas déjà dit.
- **Le style** :
  - **affiche** : gros titres en capitales, fond en diagonale ou photos, son logo et le numéro de la slide en bas. Fait pour peu de texte par slide.
  - **texte** : fond noir uni, petit titre au-dessus d'un texte qui se lit comme un post, une flèche orange pour passer à la slide suivante, son logo sur la dernière. Fait pour les carrousels où il explique (conseils, listes).
- **Le format** : **4:5** (1080 × 1350, le format carrousel classique) ou **3:4** (1080 × 1440, un peu plus haut, celui qu'affiche maintenant la grille de son profil).
- **Les photos** : si tu ne sais pas sur quelle slide va chacune, demande.
- **Le découpage** : si son texte arrive d'un bloc sans dire où couper les slides, propose un découpage en reprenant ses mots tels quels, et attends son accord.

S'il répond « comme tu veux », prends le style affiche avec photos ou le style texte sans photos, et le format 4:5, et dis-lui ce que tu as pris.
Le reste (où placer le texte sur la photo, le cadrage, la taille, les mots en orange) c'est toi qui le décides : il corrigera s'il veut.

### 3. Préparer le dossier
Crée un dossier `carrousel-<sujet en deux ou trois mots>` (sans `#` ni `%`) :
- à côté de ses photos s'il en a donné ;
- sinon dans `%USERPROFILE%\Pictures\Carrousels\`.

Regarde chaque photo (les JPEG et PNG se lisent directement ; les HEIC d'iPhone, tu les verras après le premier rendu, convertis dans `<dossier>\_rendu\photo-NN.jpg`). Repère où est son visage et où il reste de la place pour le texte.

### 4. Écrire `<dossier>\carrousel.json`

```json
{
  "slides": [
    { "fond": "photo", "photo": "C:\\...\\IMG_2201.HEIC", "cadrage": "50% 30%", "position": "bas",
      "titre": "3 erreurs qui *bloquent* ta perte de gras" },
    { "fond": "noir", "surtitre": "Erreur n°1", "titre": "Tu manges *trop peu*",
      "texte": "Première phrase.\n\nDeuxième paragraphe." }
  ]
}
```

En tête du fichier, ses choix de l'étape 2 : `"style": "texte"` pour le style texte (sinon affiche), `"format": "3:4"` pour 1080 × 1440 (sinon 4:5). Exemple : `{ "style": "texte", "format": "3:4", "slides": [...] }`.

Pour chaque slide :
- `fond` : `noir`, `photo` (la photo remplit la slide, un voile sombre côté texte) ou `photo-haut` (la photo en haut, coupée en biais, le texte dessous sur fond noir : quand la photo n'a pas de place libre pour le texte ; au-delà de trois ou quatre lignes de texte, préfère le fond noir).
- `photo` : le chemin complet de sa photo (JPEG, PNG ou HEIC).
- `cadrage` : quelle partie de la photo garder, en `horizontal% vertical%`. `50% 50%` = le centre, `50% 20%` = garder le haut (la tête), `30% 50%` = garder la gauche. Le visage ne doit jamais être coupé.
- `position` : `haut`, `centre` ou `bas`, pour le texte sur une photo. Mets le texte dans la zone sans visage.
- Le texte, réparti sans changer un mot :
  - `titre` : la phrase forte de la slide. Gros, en capitales italiques (comme son site). En style texte, il devient un intertitre de la taille du texte quand la slide a aussi un `texte`, et reste grand quand il est seul (l'accroche de la slide 1, par exemple).
  - `surtitre` (facultatif) : une petite ligne orange au-dessus du titre (« Erreur n°1 », « Étape 2 »), seulement si cette ligne existe dans son texte.
  - `texte` (facultatif) : le développement, en plus petit. Garde ses retours à la ligne ; une ligne vide = nouveau paragraphe.
  - Une slide peut n'avoir qu'un titre, ou qu'un texte.
- Mise en valeur : `*mot*` met en **orange** (sa couleur), `**mot**` en gras. Un à trois mots clés par titre au maximum, et pas forcément sur chaque slide. Les astérisques ne s'affichent pas.
- `logo: true` (facultatif) : son logo en grand au-dessus du texte, pour une slide d'ouverture ou de fin.
- `aligne: "centre"` (facultatif) : texte centré au lieu d'aligné à gauche.
- `taille` (facultatif) : `1` par défaut, `1.15` = 15 % plus gros, `0.9` = plus petit. Le texte se réduit tout seul s'il ne tient pas.
- `pied` : son logo en petit et le numéro (« 2 / 7 ») sont en bas de chaque slide. `"pied": false` sur une slide les retire, et en tête du fichier (`{ "pied": false, "slides": [...] }`) sur toutes.

### 5. Rendre : `rendre "<dossier>"`
Fabrique `slide-01.png`, `slide-02.png`… et `planche.jpg` (toutes les slides en petit) dans le dossier, puis l'ouvre. Compte une à deux secondes par slide.
- `PHOTO_ILLISIBLE` : la photo n'a pas pu être lue. Demande-lui la même photo en JPEG.
- `NAVIGATEUR_INTROUVABLE` : il faut Microsoft Edge (présent sur tout Windows) ou Google Chrome.

### 6. Vérifier avant de lui montrer (c'est ton travail)
Ouvre `planche.jpg`, puis chaque slide où tu as un doute. Vérifie :
- le texte est **exactement** le sien, rien ne manque, rien n'est coupé ;
- le texte se lit bien, il ne passe pas sur son visage ni sur une zone trop claire ;
- personne n'a la tête coupée par le cadrage.
Si quelque chose cloche, corrige `carrousel.json` (cadrage, position, `photo-haut`, taille) et refais la slide. C'est instantané.

### 7. Rendre compte
Dis où sont les slides et combien il y en a. Rappelle qu'elles se postent dans l'ordre des numéros.
Propose les retouches possibles, sans jargon : « texte plus gros », « mets le texte en haut sur la slide 3 », « décale la photo vers la gauche », « photo en haut et texte dessous », « enlève l'orange », « sans les numéros ». Chaque retouche, c'est quelques secondes.
