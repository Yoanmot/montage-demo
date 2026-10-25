---
name: couper-silences
description: Coupe les silences, les reprises et les faux départs d'une vidéo face caméra filmée d'une traite, en gardant la dernière prise de chaque phrase. La vidéo coupée sort en qualité d'origine (4K gardée), sans sous-titres ni effets, à côté de l'originale. Déclencheurs : « coupe les silences », « coupe les blancs », « dérushe cette vidéo », « enlève les reprises », une vidéo glissée avec une demande de découpe. Ne pose ni sous-titres, ni zooms, ni b-rolls.
---

# Couper les silences et les reprises

L'utilisateur est un coach, pas un technicien. Parle-lui simplement, en français, en le tutoyant.
Ne lui montre ni les commandes ni les fichiers techniques : dis ce qui se passe (« j'envoie le son », « je choisis les prises », « je coupe la vidéo »).

## Les commandes

Le script est `scripts/couper.ps1` dans le dossier de ce skill. Lance-le toujours ainsi, avec un **timeout de 600000 ms** :

```
powershell -NoProfile -ExecutionPolicy Bypass -File "<dossier du skill>\scripts\couper.ps1" <commande> <arguments>
```

(depuis un terminal bash, écris le chemin avec des `/` ; `powershell` fonctionne pareil.)

## Le déroulé

### 1. La vidéo
Si l'utilisateur ne l'a pas donnée, demande-lui de la glisser ici. Une vidéo à la fois.

### 2. Transcrire : `transcrire "<chemin de la vidéo>"`
Seul le son part sur le serveur (quelques Mo). Compte environ 20 s par minute de vidéo.
- `CODE_MANQUANT` : demande le code d'accès que Yoan lui a envoyé, lance `code <le code>`, puis relance.
- La première fois, le script installe un outil vidéo (1 à 2 min) : préviens que ça n'arrive qu'une fois.
- `PAS_FINI` : lance la commande `suivre` indiquée.
- `PRÊT dossier=<dossier>` : passe à l'étape 3.

### 3. Décider les coupes (c'est ton travail, pas celui du script)
Lis `<dossier>\draft.md` : le transcript découpé en passages, chaque passage précédé des numéros de ses mots `[wA-wB]`.
Écris `<dossier>\cuts.json` : `{"cuts": [[début, fin], ...]}`, les numéros de mots **à supprimer**, bornes incluses.

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
- Les avertissements « % de la durée coupée » ou « coupes/min » sont normaux quand il y a beaucoup de reprises : ignore-les.

### 5. Rendre : `rendre "<dossier>"`
Fabrique `<nom>-coupe.mp4` à côté de la vidéo d'origine, même résolution, et l'ouvre. Compte une à quelques minutes selon la longueur et l'ordinateur.

### 6. Rendre compte
Dis où est la vidéo, sa durée, et en une phrase ce que tu as coupé (par exemple « 6 reprises et 2 faux départs, de 4 min 44 à 52 s »).
Propose les réglages possibles, sans jargon :
- **le rythme** : `compiler "<dossier>" normal` (plus aéré), `serre` (par défaut), `tres-serre` (plus nerveux), puis `rendre` ;
- **une prise précise** : « garde plutôt la 2e prise de telle phrase » se règle dans `cuts.json`, puis `compiler` et `rendre`.
Rien de tout ça ne renvoie la vidéo au serveur ni ne consomme de crédit.

## Ce qui reste dans le dossier `<nom>-montage`
`words.cut.json` (le texte calé sur la vidéo coupée) servira aux prochains skills (sous-titres, zooms). Ne supprime pas ce dossier.
