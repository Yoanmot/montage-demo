---
name: carrousel
description: Met en page un carrousel Instagram de Yoan (@ia.yoan) dans sa DA (charte v1 du Carrousel Lab : fond sombre dégradé et grainé, titre Anton blanc en capitales, ligne d'accent en serif italique orange, corps Instrument Sans, numéros et handle en JetBrains Mono), à partir du texte validé avec son head of content. Une image par slide (1080 × 1350), prêtes à poster, plus une planche de contrôle. Déclencheurs : « mets en page ce carrousel », « fais les slides », « refais la slide 3 », un carrousel validé qui attend sa mise en page dans le studio. N'écrit pas le texte (c'est le head of content) et ne le change jamais.
---

# Mettre en page un carrousel de Yoan

Parle à Yoan simplement, en français, en le tutoyant. Ne lui montre ni commande, ni chemin, ni nom de
fichier : dis ce qui se passe (« je mets en page », « je vérifie les slides »).

**Son texte est le sien, au caractère près.** Tu ne reformules pas, tu ne raccourcis pas, tu n'ajoutes
rien (ni phrase, ni appel à l'action, ni emoji, ni slide). Une faute de frappe évidente : signale-la et
demande avant de corriger. Tout cela vaut de toi-même : s'il demande un mot changé, une slide en plus ou une autre photo, tu le fais (le texte se change dans son brouillon, revalidé comme d'habitude, puis tu remets en page).

**La DA ne se discute pas ici.** Couleurs, polices, tailles, marges, grain du fond : tout vient de
`da/theme.json` (la charte v1 de Yoan, copiée telle quelle). Tu ne changes jamais un fichier de `da/` ni
de `scripts/`. Si une demande sort de la DA (une autre police, une autre couleur, un nouvel élément),
dis-le franchement et note-la dans `demandes-pour-yoan.md` (dossier de ce skill, une ligne datée).
Il n'y a donc **ni style ni format à choisir** (une seule mise en page, 1080 × 1350) : ne pose pas de
question de style avant la mise en page.

## Le dossier du carrousel

Le studio (ou le skill des carrousels en attente) te donne un dossier qui contient `carrousel.json` :
le texte validé, slide par slide, au format du head of content.

```json
{ "format": "4:5", "slides": [
  { "gabarit": "hook", "titre": "...", "texte": "la sous-ligne" },
  { "gabarit": "corps", "titre": "...", "texte": "lead\n\nsupport", "punch": "facultatif" },
  { "gabarit": "steps", "titre": "...", "texte": "", "etapes": [ { "texte": "...", "icone": "..." } ], "closer": "..." },
  { "gabarit": "statement", "titre": "...", "texte": "" },
  { "gabarit": "cta", "titre": "...", "texte": "une ou deux lignes", "action": "la ligne d'action" } ] }
```

Comment chaque gabarit est posé (rien à faire de ta part, c'est le script) :
- `hook`, `statement`, `cta` : le titre en Anton blanc, le `texte` dessous en serif italique orange
  (la ligne d'accent de la charte) ; l'`action` d'un CTA en Anton orange tout en bas (en corps de texte
  si elle dépasse 8 mots).
- `corps` : le titre, puis le premier bloc du `texte` (le lead), puis les autres (supports), puis le
  `punch` en Anton orange.
- `steps` : le titre, les étapes en rangées numérotées, puis le `closer`.
- Marqueurs : `**mots**` en gras blanc ; `__mot__` et `==mot==` sont désactivés par la DA (le texte
  reste, sans effet visible). Les signes ne s'affichent jamais.

**Tu ne modifies `carrousel.json` que pour une correction de texte demandée par Yoan** (au caractère
près, seulement ce qu'il demande) : c'est ce fichier que le studio compare au texte validé pour reporter
la correction chez son head of content.

### La mise en page à la main : `mise-en-page.json` (facultatif)

Tout ce qui est mise en page, et seulement ça, va dans `mise-en-page.json` du même dossier :

```json
{ "slides": {
  "1": { "titre": "TU CRÉES TES MEILLEURES IDÉES\nDE CONTENU TOUS LES JOURS.\nTU T'EN SERS JAMAIS." },
  "3": { "illustration": "loupe-lecture", "illuHeight": 300 },
  "4": { "icones": ["telephone", "loupe-lecture", null] } } }
```

- `titre` : où couper les lignes du titre. Mêmes mots, même ordre, seuls les retours à la ligne
  changent (la casse n'importe pas, le titre s'affiche en capitales). Sinon il est ignoré (ligne
  `IGNORE`). Par défaut le script coupe tout seul : le moins de lignes possible, équilibrées, jamais un
  petit mot (« à », « de », « ton ») en fin de ligne, jamais au milieu d'un mot mis en valeur.
- `illustration`, `illuHeight`, `icones` : une illustration de la bibliothèque (voir plus bas) sous le
  texte d'une slide, ou en icône des étapes. Sans illustration, la slide est complète : c'est le cas
  normal de la charte.
- `align: "gauche"` : texte aligné à gauche au lieu de centré.

## Rendre

```
node "<dossier de ce skill>/scripts/carrousel.mjs" rendre "<dossier du carrousel>"
```

(timeout de 600000 ms ; ajoute un numéro à la fin, `rendre "<dossier>" 3`, pour ne refaire qu'une slide.)
Il faut Google Chrome (ou Microsoft Edge) sur le Mac : rien d'autre, aucune connexion.

Il fabrique `slide-01.png`, `slide-02.png`... (1080 × 1350) et `planche.jpg` (toutes les slides en petit,
pour toi : ce n'est pas une slide) dans le dossier. Compte une seconde par slide. Ce qu'il répond :
- `SLIDE n OK` : la slide est faite.
- `ATTENTION slide n : ...` : le texte dépasse une limite de la charte (titre trop long, trop de mots
  dans le lead...). La slide est faite quand même : le texte de Yoan prime. Regarde-la de près.
- `DEBORDE slide n : ...` : même à la plus petite taille permise, ça ne tient pas : pas d'image pour
  cette slide. Essaie une autre coupe du titre (`mise-en-page.json`) ; si ça ne suffit pas, dis à Yoan
  que la slide est trop chargée et propose-lui de la couper en deux ou de raccourcir (c'est lui qui
  décide, et c'est son head of content qui réécrit le texte).
- `IGNORE ...` : une ligne de `mise-en-page.json` ne s'applique plus (texte changé depuis).
- `RETIRE slide-NN.png` : le carrousel a moins de slides qu'avant, l'ancienne en trop est retirée.
- `FINI slides=x/y ...` : le bilan.
- `CARROUSEL_ILLISIBLE` : `carrousel.json` manque ou est abîmé. Ne le répare pas : dis-le à Yoan.
- `NAVIGATEUR_INTROUVABLE` : il faut installer Google Chrome.

## Vérifier avant de lui montrer (c'est ton travail)

Ouvre `planche.jpg`, puis chaque slide où tu as un doute (les `ATTENTION` toujours). Vérifie :
- le texte est **exactement** le sien, rien ne manque, rien n'est coupé ;
- les titres sont coupés à des endroits naturels (sinon, `mise-en-page.json`, et tu refais la slide) ;
- rien ne touche les bords, l'air est égal en haut et en bas ;
- deux slides qui se suivent n'ont pas exactement la même silhouette (sinon dis-le à Yoan, c'est le
  découpage du texte qui décide, pas toi).

## Rendre compte

Dis combien il y a de slides et qu'elles se postent dans l'ordre des numéros. Propose les retouches
possibles, sans jargon, en une ligne : « couper le titre autrement », « une illustration sur la slide 3 »,
« texte aligné à gauche », « corriger un mot ». Chaque retouche prend quelques secondes.

## Les illustrations (facultatif)

La bibliothèque d'illustrations détourées est `<racine du studio>/carrousel/illustrations/` (un
`<slug>.png` par objet). Ne mets une illustration que si elle est déjà dans la bibliothèque, ou si Yoan
en demande une. Pour en créer une, il faut le générateur (`scripts/illustration.mjs`, ses modules
installés par `npm install` dans `scripts/`) et la clé `OPENAI_API_KEY` dans
`<racine du studio>/carrousel/.env` : si l'un des deux manque, dis-lui que la création d'illustrations
n'est pas encore branchée dans son studio. Avant tout lot, préviens-le du coût (quelques centimes par
image). Le brief artistique est celui de `da/illustrations.json` : le prompt ne décrit que l'objet.
Jamais de photo de Yoan générée.

## Apprendre de ses remarques

Quand il demande une retouche, fais-la d'abord. Puis demande-toi si c'est un **goût durable** (« coupe
toujours après la virgule », « jamais d'illustration ») ou une retouche ponctuelle. Durable : propose
en une phrase de t'en souvenir ; s'il dit oui, ajoute une ligne datée à `preferences.md` dans le dossier
de ce skill (titre `# Préférences de carrousel`), une règle claire que tu sauras appliquer seule. Une
ligne qui contredit une ancienne la remplace. **Lis `preferences.md` avant chaque mise en page** : ses
goûts passent avant les règles de ce fichier, sauf deux : son texte reste le sien, et la DA ne change pas.
