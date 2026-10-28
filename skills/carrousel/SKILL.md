---
name: carrousel
description: Met en page un carrousel Instagram (1080 × 1350 ou 1080 × 1440) dans le style Fit avec Romain, à partir des photos et du texte exact que l'utilisateur donne pour chaque slide. Plusieurs styles, mélangeables : affiche (titres en capitales), texte (fond noir sobre), tweet (la copie d'une capture de X, sur fond noir ou posée sur une photo), étiquettes (texte dans des étiquettes sur photo), photo assombrie (texte lisible par-dessus, liste en cartes). Peut s'inspirer d'un carrousel qu'il aime en gardant son style à lui. Une image par slide, prêtes à poster. Déclencheurs : « fais-moi un carrousel », « mets en page ce carrousel », « carrousel avec ces photos », « fais comme ce carrousel », une capture d'un carrousel en inspiration, des photos glissées avec un texte découpé en slides. N'écrit pas le texte et ne choisit pas les photos.
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

### 0. Ses préférences
Avant tout, lis `preferences.md` dans le dossier de ce skill, s'il existe : ce sont ses goûts, appris au fil de ses remarques. **Ils passent avant les règles de ce fichier** (sauf une : son texte reste le sien, au caractère près). Ne lui en parle pas, applique-les.

### 1. Ce qu'il te faut
- **Le texte de chaque slide**, exact.
- **Les photos**, s'il en veut. Les slides sans photo ont le fond noir de son site.
- **Une inspiration**, s'il en a une : une capture d'écran d'un carrousel qui lui plaît (un lien Instagram ne s'ouvre pas ici : demande-lui la capture). Tu la **reproduis à l'identique** avec le style `libre` (voir plus bas). Seules quatre choses changent : **ses photos**, **ses polices**, **ses couleurs** (son orange à la place de la couleur vive de l'inspiration, son noir, du blanc) et **son texte**. Tout le reste est copié : où est chaque bloc de texte, sa taille par rapport aux autres (un mot énorme reste énorme), l'alignement, les retours à la ligne, le bandeau, les cartes, l'assombrissement de la photo. Jamais le logo ni le nom de l'auteur de l'inspiration.

### 2. Lui demander ses choix, avant de faire quoi que ce soit
Les choix qui changent tout le carrousel sont les siens : pose-lui les questions **en un seul message**, avant la mise en page, avec une phrase simple par option pour qu'il choisisse vite. Ne demande que ce qu'il n'a pas déjà dit.
- **Le style** (sauf s'il a donné une inspiration : c'est alors le style libre, sans question) :
  - **affiche** : gros titres en capitales, fond noir ou photo, son logo et le numéro de la slide en bas. Fait pour peu de texte par slide.
  - **texte** : fond noir uni, petit titre au-dessus d'un texte qui se lit comme un post, une flèche orange pour passer à la slide suivante, son logo sur la dernière. Fait pour les carrousels où il explique (conseils, listes).
  - **tweet** : son texte présenté comme une capture d'écran de X (polices, tailles et couleurs de l'appli), avec sa photo de profil, son nom, la pastille bleue et son @. Sur fond noir, ou en carte posée sur une de ses photos. Fait pour une phrase forte ou un avis tranché.
  - **étiquettes** : sa photo en plein cadre, le titre dans une étiquette orange en capitales, le texte dans des étiquettes blanches (comme ses carrousels « ce que j'achète », à ses couleurs). Fait pour peu de texte sur de belles photos.
  - **photo assombrie** : sa photo en fond, assombrie pour que le texte se lise par-dessus ; tout centré, texte fin, liste en cartes, phrase de chute en bas ; minimaliste, sans numéro de slide. Fait pour les carrousels qui expliquent avec ses photos.
  - Il peut **mélanger** : par exemple une couverture en étiquettes, puis des slides en photo assombrie, et une fin en tweet. Propose-le si son texte s'y prête.
- **Le format** : **4:5** (1080 × 1350, le format carrousel classique) ou **3:4** (1080 × 1440, un peu plus haut, celui qu'affiche maintenant la grille de son profil).
- **Les photos** : si tu ne sais pas sur quelle slide va chacune, demande.
- **Le découpage** : si son texte arrive d'un bloc sans dire où couper les slides, propose un découpage en reprenant ses mots tels quels, et attends son accord.

- **Pour le style tweet** : sa photo de profil est déjà dans le skill. Ne demande une autre photo que s'il veut en changer.

S'il répond « comme tu veux » : avec photos, la photo assombrie (ou les étiquettes s'il y a très peu de texte) ; sans photos, le style texte ; format 4:5. Dis-lui ce que tu as pris.
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

En tête du fichier, ses choix de l'étape 2 : `"style"` = `affiche` (par défaut), `texte`, `tweet`, `etiquettes`, `sombre` (photo assombrie) ou `libre` (inspiration) ; `"format": "3:4"` pour 1080 × 1440 (sinon 4:5). Exemple : `{ "style": "sombre", "format": "3:4", "slides": [...] }`.
Une slide peut avoir son propre `"style"` : c'est comme ça qu'on mélange les styles dans un carrousel.
Pour le style tweet, en tête du fichier et seulement s'il veut changer : `"avatar"` (chemin d'une autre photo de profil), `"nom"` (par défaut « Romain »), `"pseudo"` (par défaut « @fitavecromain ») et `"certifie": false` pour retirer la pastille bleue.

Pour chaque slide :
- `fond` (styles affiche et texte) : `noir`, `photo` (la photo remplit la slide, un voile sombre côté texte) ou `photo-haut` (la photo en haut, coupée en biais, le texte dessous sur fond noir). **Préfère toujours `photo`**, la photo en plein cadre : `photo-haut` seulement s'il le demande. Si une photo en largeur oblige à couper une personne, garde-le lui (cadrage sur lui) et dis-le-lui.
- `photo` : le chemin complet de sa photo (JPEG, PNG ou HEIC).
- `cadrage` : quelle partie de la photo garder, en `horizontal% vertical%`. `50% 50%` = le centre, `50% 20%` = garder le haut (la tête), `30% 50%` = garder la gauche. Le visage ne doit jamais être coupé.
- `position` : `haut`, `centre` ou `bas`, pour le texte (ou la carte tweet) sur une photo. Mets le texte dans la zone sans visage. En photo assombrie, `position` place le bloc titre et texte : au milieu par défaut, `haut` ou `bas` quand le milieu tombe sur son visage (la chute reste en bas).
- Dans les styles tweet, étiquettes et photo assombrie, une slide avec `photo` a la photo en fond ; sans `photo`, fond noir.
- **Les retours à la ligne** : la mise en page coupe les lignes elle-même, comme un graphiste (lignes équilibrées, jamais un mot seul sur une ligne, jamais une ligne qui finit par « à » ou « de » ou par le début de la phrase suivante). N'ajoute pas de `\n` toi-même : garde seulement ceux de son texte. En style tweet, les lignes se coupent comme sur X.
- Le texte, réparti sans changer un mot :
  - `titre` : la phrase forte de la slide. Gros, en capitales italiques (comme son site). En style texte, il devient un intertitre de la taille du texte quand la slide a aussi un `texte`, et reste grand quand il est seul (l'accroche de la slide 1, par exemple).
  - `surtitre` (facultatif) : une petite ligne orange au-dessus du titre (« Erreur n°1 », « Étape 2 »), seulement si cette ligne existe dans son texte.
  - `texte` (facultatif) : le développement, en plus petit. Garde ses retours à la ligne ; une ligne vide = nouveau paragraphe.
  - `liste` (facultatif) : des cartes numérotées en verre dépoli sous le texte, une par élément. Soit `["Communication", "Leadership"]`, soit avec une petite ligne dessous : `[{"titre": "Des protéines", "texte": "à chaque repas"}]`. Seulement si son texte est une liste.
  - `chute` (facultatif, photo assombrie) : la phrase de fin, en gras, posée en bas de la slide.
  - `bandeau` (facultatif, photo assombrie et affiche) : une ligne en capitales sur un bandeau orange, sous le titre (« Voilà ce que je ferais »). Seulement si cette ligne existe dans son texte.
  - Une slide peut n'avoir qu'un titre, ou qu'un texte.
  - En style tweet, le titre et le texte forment le texte du post, l'un sous l'autre.
- Mise en valeur (sans changer un mot) : `*mot*` met en **orange** (sa couleur), `**phrase**` en gras, `__phrase__` souligne en orange d'un double trait à main levée. Les astérisques ne s'affichent pas.
  - **Styles texte et photo assombrie** : c'est ce qui donne envie de lire. Chaque slide a sa mise en valeur, et elle varie d'une slide à l'autre : un à trois mots clés du titre en orange, la phrase qui compte dans le texte en gras (elle ressort en blanc sur le texte un peu plus clair), et sur une ou deux slides du carrousel, une phrase forte **courte** soulignée (cinq ou six mots, qu'elle tienne sur une ligne ; jamais deux lignes soulignées qui se suivent). Jamais tout sur la même slide.
  - **Style tweet** : rien en orange ni en gras (un vrai tweet n'en a pas) ; souligné seulement s'il le demande, et là il peut passer sur deux lignes. Même taille de texte sur toutes les slides.
  - **Autres styles** (affiche, étiquettes) : plus sobre. Un à trois mots clés par titre en orange, pas forcément sur chaque slide ; souligné seulement s'il le demande.
  - S'il demande « sobre » ou « sans orange », tu n'en mets pas.
  - Hors style tweet, un groupe mis en valeur (« *n'as pas besoin* ») reste sur une seule ligne : la mise en page coupe avant ou après, jamais au milieu. Garde donc ces groupes courts.
- **Une accroche en plusieurs phrases** (« Des abdos en deux semaines. Un ventre plat en trente jours. On a tous déjà vu ça. ») ne doit pas faire un gros bloc. Donne-lui du rythme sans changer un mot : sépare les phrases en blocs avec une ligne vide dans `titre` (`"Des abdos en deux semaines.\n\nUn ventre plat en trente jours."`), et mets la phrase de chute à part, en `texte` (elle s'affiche plus petite, en dessous, et le titre reste grand).
- `logo: true` (facultatif) : son logo en grand au-dessus du texte, pour une slide d'ouverture ou de fin.
- `aligne: "centre"` (facultatif) : texte centré au lieu d'aligné à gauche.
- `voile` (facultatif, photo assombrie, tweet et étiquettes) : à quel point la photo est assombrie, de `0` à `0.9`. En photo assombrie `0.7` par défaut (`0.55` = photo plus visible, `0.8` = texte plus lisible) ; en tweet et étiquettes, pas de voile par défaut.
- `taille` (facultatif) : `1` par défaut, `1.15` = 15 % plus gros, `0.9` = plus petit. Le texte se réduit tout seul s'il ne tient pas.
- `taille-titre` (facultatif) : comme `taille`, mais seulement pour le titre (`0.85` = titre 15 % plus petit, le texte ne bouge pas).
- `pied` : son logo en petit et le numéro (« 2 / 7 ») sont en bas de chaque slide. `"pied": false` sur une slide les retire, et en tête du fichier (`{ "pied": false, "slides": [...] }`) sur toutes.

#### Le style libre (inspiration)
Pour reproduire une inspiration, chaque slide est `{ "style": "libre", "photo": "C:\\...\\photo.jpg", "html": "..." }` : tu écris toi-même la mise en page en HTML, sur une page de 1080 px de large (1350 ou 1440 de haut).
- Mesure l'inspiration : la position de chaque bloc en % de la hauteur et de la largeur, les tailles de texte en proportion de la largeur de la slide (une capture de 1080 px se lit directement en px). Reprends-les telles quelles.
- La photo : `{{photo}}` est remplacé par sa photo. Exemple : `<img src="{{photo}}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 20%">`, puis un `<div>` en dégradé sombre par-dessus si l'inspiration est assombrie.
- Ses polices : `class="t"` = sa police de titre (capitales italiques, la remplaçante de toute police de titre de l'inspiration), sinon le texte est en Manrope (poids 300 à 800). `class="o"` ou `var(--orange)` = son orange, `#111` = son noir. Son logo : `<img src="logo.png">`.
- Le texte reste le sien mot pour mot ; les retours à la ligne (`<br>`) se calent sur ceux de l'inspiration.
- Exemple (couverture : deux lignes de titre centrées, un mot énorme en orange, un bandeau, trois lignes en bas) :
```html
<img src="{{photo}}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 20%">
<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(17,17,17,.5),rgba(17,17,17,.55) 55%,rgba(17,17,17,.96))"></div>
<div style="position:absolute;left:0;right:0;top:35%;text-align:center">
  <div class="t" style="font-size:64px;line-height:1.02">Si je devais perdre<br>mon ventre en partant</div>
  <div class="t o" style="font-size:200px;line-height:.95">de zéro</div>
  <div style="display:inline-block;background:var(--orange);color:#111;font-size:56px;padding:0 18px;text-transform:uppercase">Voilà ce que je ferais</div>
</div>
<div style="position:absolute;left:10%;right:10%;top:76%;font-size:38px;line-height:1.55">Pas de routine miracle.<br>Pas de défi trente jours.<br>Ce qui marche vraiment.</div>
```
- En style libre, rien ne s'ajuste tout seul : après le rendu, **mets chaque slide à côté de la slide d'inspiration correspondante** et corrige jusqu'à ce que la mise en page soit la même (place, taille, alignement), que rien ne déborde et que le texte ne passe pas sur son visage.

### 5. Rendre : `rendre "<dossier>"`
Fabrique `slide-01.png`, `slide-02.png`… et `planche.jpg` (toutes les slides en petit) dans le dossier, puis l'ouvre. Compte une à deux secondes par slide.
- `PHOTO_ILLISIBLE` : la photo n'a pas pu être lue. Demande-lui la même photo en JPEG.
- `NAVIGATEUR_INTROUVABLE` : il faut Microsoft Edge (présent sur tout Windows) ou Google Chrome.

### 6. Vérifier avant de lui montrer (c'est ton travail)
Ouvre `planche.jpg`, puis chaque slide où tu as un doute. Vérifie :
- le texte est **exactement** le sien, rien ne manque, rien n'est coupé ;
- le texte se lit bien, il ne passe pas sur son visage ni sur une zone trop claire (en photo assombrie, monte `voile` si besoin) ;
- personne n'a la tête coupée par le cadrage.
Si quelque chose cloche, corrige `carrousel.json` (cadrage, position, `photo-haut`, taille) et refais la slide. C'est instantané.

### 7. Rendre compte
Dis où sont les slides et combien il y en a. Rappelle qu'elles se postent dans l'ordre des numéros.
Propose les retouches possibles, sans jargon : « texte plus gros », « mets le texte en haut sur la slide 3 », « décale la photo vers la gauche », « photo en haut et texte dessous », « photo plus sombre », « mets cette slide en tweet », « enlève l'orange », « sans les numéros ». Chaque retouche, c'est quelques secondes.

### 8. Apprendre de ses remarques
Quand il te demande une retouche, fais-la d'abord. Puis demande-toi si c'est un **goût durable** ou une **retouche ponctuelle** :
- ponctuelle (« décale cette photo », « la slide 3 en tweet », « corrige ce mot ») : rien de plus ;
- durable (« je préfère les titres plus petits », « jamais de souligné », « toujours le texte en bas », « moins d'orange », ou la même remarque pour la deuxième fois) : propose-lui en une phrase de t'en souvenir. Par exemple : « Tu veux que je retienne ça pour tes prochains carrousels ? Je mettrais les titres un peu plus petits par défaut. »

S'il dit oui, ajoute une ligne à `preferences.md` dans le dossier de ce skill (crée le fichier s'il n'existe pas, avec le titre `# Préférences de carrousel`) : la date, puis la règle en une phrase claire que tu sauras appliquer seule (« Titres 10 % plus petits que par défaut : `"taille": 0.9` sur toutes les slides. »). Une ligne qui contredit une ancienne la remplace. Dis-lui simplement « C'est noté, ce sera comme ça la prochaine fois. »
S'il te demande d'oublier une préférence ou de lui dire ce que tu as retenu, ouvre `preferences.md` et fais-le.

Ne touche jamais aux autres fichiers du skill. Si sa remarque demande quelque chose que la mise en page ne sait pas faire (une nouvelle police, un nouvel élément, un style qui n'existe pas), dis-le-lui franchement, note sa demande dans `demandes-pour-yoan.md` (même dossier, une ligne datée) et propose-lui d'envoyer ce fichier à Yoan, qui pourra améliorer le skill.
