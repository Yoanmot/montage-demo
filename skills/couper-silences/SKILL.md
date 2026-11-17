---
name: couper-silences
description: Brique de l'agent monteur. Prépare la coupe des silences, des reprises et des faux départs d'une vidéo face caméra filmée d'une traite, en gardant la dernière prise de chaque phrase. Ne fabrique pas la vidéo : c'est la brique rendu qui le fait, en un seul passage avec les autres couches demandées. Pour toute demande de montage (« coupe les silences », « dérushe », « mets les sous-titres »…), passe par l'agent monteur, qui t'enverra ici.
---

# Couper les silences et les reprises

L'utilisateur est un coach, pas un technicien. Parle-lui simplement, en français, en le tutoyant.
Ne lui montre ni les commandes ni les fichiers techniques : dis ce qui se passe (« j'envoie le son », « je choisis les prises », « je coupe la vidéo »).

## Les commandes

Tu arrives ici depuis l'agent monteur. Fais les étapes 1 à 4, puis rends-lui la main : il prépare les autres couches et fait fabriquer la vidéo par la brique rendu.

Le script est `scripts/couper.mjs` dans le dossier de ce skill. Lance-le toujours ainsi, avec un **timeout de 600000 ms** :

```
node "<dossier du skill>/scripts/couper.mjs" <commande> <arguments>
```

## Le déroulé

### 1. La vidéo
Si l'utilisateur ne l'a pas donnée, demande-lui de la glisser ici. Une vidéo à la fois.

### 2. Transcrire : `transcrire "<chemin de la vidéo>"`
Seul le son part sur le serveur (quelques Mo). Compte environ 20 s par minute de vidéo.
- `CODE_MANQUANT` : demande le code d'accès que Yoan lui a envoyé, lance `code <le code>`, puis relance.
- `OUTIL_MANQUANT` : ffmpeg manque sur le Mac ; préviens Yoan (le prompt d'installation l'installe).
- `PAS_FINI` : lance la commande `suivre "<dossier>"` indiquée.
- Vidéo filmée en HDR, à 60 images par seconde ou à cadence variable (iPhone) : rien à faire. Les coupes se calent
  toujours à 30 images par seconde et la brique rendu convertit le HDR en un seul passage.
- `PRÊT dossier=<dossier>` : passe à l'étape 3.

**Vidéo sans parole** (démo muette, reel sur musique : `ERREUR_TRANSCRIPTION`, ou aucun mot dans `draft.md`) : pas de
coupes à décider. Lance `sans-parole "<chemin de la vidéo>"` : toute la vidéo est gardée, sans coupe, à 30 images par
seconde, avec son son d'origine (`PRÊT_SANS_PAROLE`). Rends la main au monteur, qui suit sa section « Vidéo sans
parole ». Rien n'est envoyé au serveur.

### 3. Décider les coupes (c'est ton travail, pas celui du script)
Lis `<dossier>/draft.md` : le transcript découpé en passages, chaque passage précédé des numéros de ses mots `[wA-wB]`.
Écris `<dossier>/cuts.json` : `{"cuts": [[début, fin], ...]}`, les numéros de mots **à supprimer**, bornes incluses.

Les règles, dans cet ordre :
1. **Reprises : garde TOUJOURS la dernière prise.** L'utilisateur filme ainsi : il redit une phrase jusqu'à ce qu'elle soit bonne, puis passe à la suivante. Quand une phrase ou un passage est dit plusieurs fois, coupe toutes les prises sauf la dernière, entièrement, même si une prise précédente paraît plus complète.
2. **Faux départs** : un mot coupé net (terminé par un tiret) ou une phrase avortée se coupe jusqu'au début de la reprise, amorce comprise.
3. **Auto-corrections** : la tentative ratée se coupe avec son amorce, pas seulement le mot fautif.
4. **Répétition voulue** : une formule répétée exprès pour l'effet n'est pas une reprise, garde-la.
5. **Début et fin** : coupe ce qui précède la première vraie phrase (« c'est bon ça tourne ? ») et ce qui suit la dernière phrase complète.
6. **Ne touche à rien d'autre.** Les blancs, les « euh » et les petits mots isolés sont coupés automatiquement : ne les liste pas. Ne coupe jamais un passage pour raccourcir ou « améliorer » le propos : tu enlèves les ratés, pas le contenu. Dans le doute, garde.

### 4. Compiler : `compiler "<dossier>"`
Le script affiche le **discours final** : les passages gardés séparés par `//`.
**Relis chaque `//`** : la phrase doit rester correcte et rien ne doit être dit deux fois. Si une jointure cloche, corrige `cuts.json` et relance `compiler`. C'est gratuit et instantané, refais-le autant que nécessaire.
- `COUPES_REFUSÉES` : un passage gardé fait moins de 0,3 s. Étends la coupe voisine pour l'englober, ou garde un peu plus, puis relance.
- « coupes/min » : les blancs sont coupés automatiquement, donc ce chiffre est souvent haut. Information seulement.
- « % de la parole retirée par cuts.json (plus de 20 %) » : sort seulement quand **tes** coupes (reprises, faux départs,
  début et fin) retirent plus d'un cinquième de ce qu'il dit. Relis chaque coupe : c'est normal s'il a beaucoup repris,
  pas si une coupe enlève du propos.

### 5. La suite
Les coupes sont prêtes. Rends la main à l'agent monteur : la brique rendu fabrique la vidéo, avec les coupes et les autres couches demandées, en un seul passage depuis la vidéo d'origine.

### Réglages possibles (à proposer quand il a vu la vidéo)
- **le rythme** : `compiler "<dossier>" normal` (plus aéré), `serre` (par défaut), `tres-serre` (plus nerveux) ;
- **une prise précise** : « garde plutôt la 2e prise de telle phrase » se règle dans `cuts.json`, puis `compiler`.
Ensuite, le monteur refait la vidéo (brique rendu). Rien de tout ça ne renvoie la vidéo au serveur ni ne consomme de crédit.

## Ce qui reste dans le dossier `<nom>-montage`
`words.cut.json` (le texte calé sur la vidéo coupée) sert aux autres briques (sous-titres, zooms, animations), et `filtre.txt` (les coupes) à la brique rendu. `discours.txt` garde la dernière sortie de `compiler`. `info.json` note la vidéo d'origine : les briques prennent d'abord la vidéo qui est à côté du dossier (même nom sans `-montage`), donc un dossier copié ou déplacé avec sa vidéo retrouve la sienne. Ne supprime pas ce dossier.

## Dépendances
- Node.js 24 (`node`) : lance `couper.mjs` (appels au serveur par `fetch`, sans autre outil).
- `ffmpeg` / `ffprobe` (Homebrew : `/opt/homebrew/bin/`).
- Le code d'accès au serveur de transcription envoyé par Yoan (`couper.mjs code <code>`, gardé dans `<racine du studio>/config`, `~/.montage-yoan/config` chez Romain).
