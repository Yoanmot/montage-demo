# Contrat de la DA : ce que `banque/da/` doit fournir

> Copie du contrat du moteur carrousel-image de Yoan. Dans ce skill, `banque/da/` (ou `content/banque/da/`)
> se lit `da/` (le dossier de la DA du skill), et la bibliothèque d'illustrations vit dans
> `<racine du studio>/carrousel/illustrations/` (voir `scripts/theme.mjs`).

Le code de ce skill ne porte **aucune** couleur, police, taille, graisse, marge, ombre ni limite
typographique. Il porte la structure (layout, conteneurs, auto-fit, protocole de refus) et va
chercher toutes les valeurs dans deux fichiers :

| Fichier | Consommé par | Rôle |
|---|---|---|
| `content/banque/da/theme.json` | `slide.mjs` | mise en page des slides |
| `content/banque/da/illustrations.json` | `illustration.mjs` | brief de génération des illustrations |
| `content/banque/da/illustrations/` | les deux | bibliothèque de PNG détourés (`<slug>.png` + `<slug>.json`) |

Tant que ces fichiers n'existent pas, les scripts s'arrêtent net :
`DA non extraite (phase 3) : banque/da/theme.json manquant`.
S'ils existent mais qu'il manque des tokens, l'erreur liste **exactement** les tokens manquants.

**Conventions de valeur.** Un nombre est interprété en pixels (`28` → `28px`). Une chaîne est
injectée telle quelle dans le CSS (`"1.8rem"`, `"-0.02em"`, `"rgba(255,255,255,.7)"`,
`"0 16px 36px rgba(0,0,0,.35)"`, `"linear-gradient(...)"`). Les ratios sont des nombres décimaux
(`0.8` = 80 %). Rien n'a de valeur par défaut : un token absent est une erreur, jamais un choix
implicite du code.

---

## 1. `theme.json` : les tokens requis

### Format et fond

| Token | Type | Rôle |
|---|---|---|
| `canvas.largeur` | nb | largeur du PNG (Instagram 4:5 : 1080) |
| `canvas.hauteur` | nb | hauteur du PNG (4:5 : 1350) |
| `fond.couleur` | couleur | fond plein de la slide |
| `fond.calques` | tableau | calques posés par-dessus, dans l'ordre. Tableau vide = fond plein seul. |

Trois types de calques sont compris (tout autre type est une erreur explicite) :

```jsonc
{ "type": "points", "couleur": "…", "pas": 28, "rayon": 1.4 }        // trame de points
{ "type": "halo", "couleur": "…", "bord": "…",                        // poche de lumière + coins éteints
  "centre": "50% 26%", "etendue": "120% 92%", "arret": "52%" }
{ "type": "image", "fichier": "fonds/fond1-1080x1350.png",            // fond matiéré de la DA
  "taille": "cover" }                                                 // chemin relatif à banque/da/
```

Le type `image` existe parce que le grain de la charte est un bruit 1 px, qu'aucune fonction
CSS ne sait produire : il faut un fichier. `taille` est optionnel (défaut `cover`).

### Marque (le handle du compte)

| Token | Type | Rôle |
|---|---|---|
| `marque.texte` | texte | le handle affiché sur chaque slide (ex. `"@ia.yoan"`) |
| `marque.taille` · `marque.graisse` · `marque.interlettre` · `marque.couleur` | | typo du handle |
| `marque.marge` | nb | distance au bord haut (le handle est centré en haut) |

La famille du handle est `typo.familles.marque`.

### Bloc de contenu

| Token | Type | Rôle |
|---|---|---|
| `bloc.marges.haut` · `.cotes` · `.bas` | nb | padding du cluster centré verticalement |

### Typographie

| Token | Type | Rôle |
|---|---|---|
| `typo.couleur` | couleur | couleur de texte par défaut |
| `typo.familles.titre` | texte | famille du titre et de la punchline |
| `typo.familles.corps` | texte | famille du kicker, sous-ligne, lead, support, cartes |
| `typo.familles.marque` | texte | famille du handle |
| `typo.familles.service` | texte | OPTIONNEL : famille du kicker (défaut : `corps`) |
| `typo.familles.accent` | texte | OPTIONNEL : famille de la sous-ligne (défaut : `corps`) |
| `typo.kicker.taille` · `.graisse` · `.interlettre` · `.couleur` · `.margeBas` | | micro-ligne au-dessus du titre |
| `typo.titre.graisse` · `.interligne` · `.interlettre` · `.couleur` | | titre |
| `typo.titre.casse` | texte | OPTIONNEL : `text-transform` du titre (défaut : `none`) |
| `typo.titre.tailles.hook` · `.corps` · `.statement` · `.steps` · `.cta` | nb | taille de départ du titre, **par gabarit** |
| `typo.titre.tailleMin` | nb | plancher de l'auto-fit horizontal (sous lequel la slide est REFUSÉE) |
| `typo.titre.largeurMax` | ratio | part de la largeur du canvas qu'une ligne de titre peut occuper (ex. `0.8`) |
| `typo.sous.ratioTitre` | ratio | taille de la sous-ligne, en part du titre **rendu** (ex. `0.55`) |
| `typo.sous.graisse` · `.interligne` · `.interlettre` · `.couleur` · `.margeHaut` | | sous-ligne |
| `typo.sous.style` | texte | OPTIONNEL : `font-style` de la sous-ligne (défaut : `normal`) |
| `typo.sous.casse` | texte | OPTIONNEL : `text-transform` de la sous-ligne (défaut : `none`) |
| `typo.lead.taille` · `.graisse` · `.interligne` · `.couleur` | | 1re ligne de corps (l'idée) |
| `typo.support.taille` · `.graisse` · `.interligne` · `.couleur` | | lignes suivantes (la preuve, atténuée) |
| `typo.punch.taille` · `.graisse` · `.interligne` · `.interlettre` · `.couleur` · `.margeHaut` | | punchline (`!!` en tête de ligne) |
| `typo.gras.graisse` · `typo.gras.couleur` | | rendu de `**payload**` |

### Bloc de texte

| Token | Type | Rôle |
|---|---|---|
| `texte.margeHaut` | nb | air entre le titre (ou la sous-ligne) et le corps |
| `texte.margeHautApres` | nb | air avant les lignes `apres` (rendues sous l'illustration) |
| `texte.largeurMax` | nb | largeur de la colonne de texte |
| `texte.interParagraphe` | nb | air entre deux paragraphes |
| `texte.interlettre` | texte | interlettrage du corps |

### Accents

| Token | Type | Rôle |
|---|---|---|
| `accents.surlignage.couleur` | couleur | couleur pleine des repères de sélection (barres et poignées) |
| `accents.surlignage.fond` | couleur | le wash derrière le texte surligné (alpha autorisé) |
| `accents.surlignage.epaisseurBord` | nb | épaisseur des barres verticales |
| `accents.surlignage.poignee` | texte | diamètre des poignées, en em (ex. `".26em"`) |
| `accents.surlignage.padding` | texte | respiration horizontale du wash, en em |
| `accents.lueur.couleur` · `.epaisseur` · `.rayon` | | le trait de soulignement `__x__` |
| `accents.lueur.halo` | texte | `box-shadow` complet du trait (sa lueur) |

### Illustration

| Token | Type | Rôle |
|---|---|---|
| `illustration.hauteurs.hook` · `.corps` · `.statement` · `.steps` · `.cta` | nb | hauteur de départ, **par gabarit** |
| `illustration.hauteurMin` | nb | plancher de l'auto-fit vertical |
| `illustration.largeurMax` | nb | largeur maximale de l'objet |
| `illustration.margeHaut` | nb | air au-dessus de l'illustration |
| `illustration.ombre` | texte | chaîne `filter` (ombres portées) |
| `illustration.halo` | texte | chaîne `background` du halo ambiant |
| `illustration.haloDebord` | texte | `inset` du halo (ex. `"-14% -22%"`) |

### Cartes du gabarit `steps`

| Token | Type | Rôle |
|---|---|---|
| `steps.margeHaut` · `steps.interCarte` · `steps.largeur` | nb | pose de la pile de cartes |
| `steps.carte.fond` · `.bord` · `.bordHaut` · `.epaisseurBord` · `.rayon` · `.flou` · `.ombre` · `.padding` · `.gap` | | la carte (`.flou` = chaîne `backdrop-filter`, `.padding` = chaîne CSS) |
| `steps.numero.cote` · `.rayon` · `.fond` · `.bord` · `.epaisseurBord` · `.couleur` · `.graisse` · `.taille` | | la pastille numérotée |
| `steps.texte.taille` · `.graisse` · `.interligne` · `.couleur` | | le texte de l'étape |
| `steps.icone.largeurBoite` · `.hauteurBoite` · `.hauteurMax` · `.largeurMax` | nb | la mini-illustration de droite |
| `steps.icone.filtre` · `.halo` · `.haloDebord` | texte | son `filter`, son halo, l'`inset` du halo |

### Limites éditoriales (`limites`)

Le moteur avertit (`⚠`) quand le script dépasse la DA, sans jamais toucher au texte : la fidélité
au script prime, l'avertissement sert à re-découper. `limites.commun` porte les 17 clés ci-dessous
(toutes requises) ; `limites.<gabarit>` existe pour les 5 gabarits et ne **redéclare que ce qui
diffère** (un objet vide est valide).

| Clé | Type | Sens |
|---|---|---|
| `titreMots` | nb | mots max dans le titre |
| `titreLignes` | nb | lignes max dans le titre |
| `kickerMots` · `sousMots` | nb | mots max du kicker / de la sous-ligne |
| `leadMots` | nb | mots max de la 1re ligne de corps |
| `supportMots` | nb | mots max cumulés des lignes de support |
| `punchMots` · `punchMax` | nb | mots max d'une punchline / nombre de punchlines |
| `etapesMax` · `etapeMots` | nb | rangées max / mots max par rangée |
| `surlignageMin` · `surlignageMax` | nb | bornes des `==surlignages==` |
| `lueurMin` | nb | minimum de `__soulignements__` |
| `accentsMax` | nb | total surlignages + soulignements |
| `corpsAutorise` | bool | le gabarit accepte-t-il un `corps` |
| `sousAvecCorps` | bool | sous-ligne ET corps sur la même slide |
| `etapesAutorisees` | bool | le gabarit porte-t-il des `etapes` |

Les 5 gabarits sont **éditoriaux**, pas décoratifs : `hook` (S1, l'accroche), `corps`
(l'argumentation), `statement` (titre seul, la rupture de rythme), `steps` (le système en rangées,
la slide qu'on enregistre), `cta` (la dernière). Une DA leur donne des tailles et des limites
différentes, elle ne les supprime pas.

---

## 2. `theme.json` : les tokens optionnels

| Token | Effet s'il est absent |
|---|---|
| `typo.polices` | aucune police embarquée : les familles doivent être disponibles sur la machine |
| `bloc.margesRail.haut` · `.cotes` · `.bas` + `texte.largeurMaxRail` | la variante `align: "gauche"` est refusée (erreur explicite, avant tout rendu) |

`typo.polices` est un tableau d'objets `{ famille, fichier, graisse, style }` ; `fichier` est
relatif à `banque/da/` (ex. `"fonts/ma-police-700.woff2"`). Une famille embarquée doit être
référencée dans `typo.familles.*` sous le même nom.

---

## 3. `illustrations.json`

| Clé | Requis | Rôle |
|---|---|---|
| `style` | oui | le brief artistique complet, joint à **chaque** prompt : matière, lumière, caméra, cadrage, interdits. C'est lui qui tient la cohérence de la bibliothèque. |
| `consigneFond` | oui | la phrase qui impose le fond de génération (uni, sans dégradé, jusqu'aux bords). Elle doit nommer la même couleur que `fond` ci-dessous : l'un-premultiply s'appuie dessus. |
| `fond` | non | couleur de fond de génération, en `#RRGGBB`. Absente, c'est `theme.json > fond.couleur` (le cas normal : l'illustration se pose sur le fond du template). |
| `styleRef` | non | référence de style jointe aux générations. Nom simple = fichier de la bibliothèque (ex. `"_style-3d.png"`), sinon chemin relatif à `content/`. Sans elle, le style dérive d'une image à l'autre. |

Le prompt envoyé au modèle est toujours : `prompt de l'item` + `style` + `consigneFond`. Le prompt
de l'item ne décrit **que l'objet** ; tout le reste est la DA.

---

## 4. Ce que la phase 3 doit livrer, en résumé

1. `banque/da/theme.json` avec les 128 tokens requis ci-dessus, plus les 5 objets `limites.<gabarit>`.
2. `banque/da/illustrations.json` avec au minimum `style` et `consigneFond`.
3. `banque/da/illustrations/` (créé au premier appel), et si la DA a une police propre,
   `banque/da/fonts/` + `typo.polices`.

Vérification : `node scripts/slide.mjs <spec.json>` sur un spec d'une slide. Le script liste
lui-même ce qui manque, token par token. Zéro token manquant = la DA est branchée.
