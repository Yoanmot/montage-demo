---
name: carrousels-en-attente
description: Met en page, un par un, les carrousels que Romain a validés avec son head of content (sur son téléphone ou ailleurs) et qui attendent son Mac. Récupère la liste, prépare chaque carrousel, lui demande ses photos, le met en page avec le skill carrousel, puis le sort de la liste pour qu'il ne revienne jamais. Déclencheurs : « fais mes carrousels en attente », « mes carrousels à mettre en page », « il y a des carrousels qui attendent ? », « où en sont mes carrousels ».
---

# Les carrousels en attente

Romain valide le texte de ses carrousels avec son head of content, souvent depuis son téléphone. La
mise en page, elle, se fait ici, sur son Mac, avec ses photos et le skill **carrousel** (déjà installé
dans `~/.claude/skills/carrousel/`). Ce skill fait le lien entre les deux.

Romain est coach, pas technicien. Parle-lui simplement, en français, en le tutoyant. Ne lui montre
jamais une commande, un chemin, un nom de fichier ni un code comme `NOUVEAU` : dis ce qui se passe
(« je regarde ce qui t'attend », « je prépare le carrousel du mardi », « c'est rangé »).

## La règle d'or : c'est le script qui sait ce qui est fait, pas toi

Tu ne décides jamais toi-même qu'un carrousel est à faire ou déjà fait, et tu ne t'en souviens pas
d'une conversation à l'autre. Le script `scripts/a-rendre.py` (dans le dossier de ce skill) tient la
liste et le registre de ce qui est rendu, et il vérifie sur le disque ce qui a déjà été mis en page.
- Tu ne mets en page **que** ce qu'`attente` vient de lister comme `NOUVEAU` ou `MIS_A_JOUR`.
- Tu ne touches jamais à la copie du travail de Romain (`~/.montage-yoan/head-of-content/`) : ni
  fichier modifié à la main, ni commande git. Seul le script y écrit.
- Si tu oublies `termine`, ce n'est pas grave : au prochain `attente`, le script trouve les slides
  dans le dossier du carrousel et le range tout seul. Mais appelle-le quand même, au bon moment.

Le script se lance toujours ainsi (timeout de 120000 ms) :

```
python3 ~/.claude/skills/carrousels-en-attente/scripts/a-rendre.py <commande>
```

| Commande | Ce qu'elle fait |
|---|---|
| `attente` | récupère les derniers textes validés, range ce qui est déjà mis en page, liste le reste |
| `prepare <slug>` | crée le dossier du carrousel, y met le texte validé (`carrousel.json`) et dit quelles photos prévoir |
| `termine <slug>` | enregistre le carrousel comme fait, le sort de la liste, envoie l'info au head of content |
| `cle`, `verifier` | seulement pour la première fois (voir en bas) |

Ce que le script répond (une ligne par carrousel, puis le total) :
- `NOUVEAU slug=… slides=… publication="…" titre="…"` : à mettre en page.
- `MIS_A_JOUR slug=… rendu_le="…"` : déjà mis en page le …, mais Romain a changé le texte depuis.
  À refaire avec le nouveau texte.
- `DEJA_FAIT slug=… rendu_le="…"` : trouvé déjà mis en page (le `termine` avait été oublié, ou pas
  envoyé) : le script l'a rangé. Rien à refaire.
- `TEXTE_REPORTE slug=… : slide N (…) : « avant » -> « après »` : une correction faite sur le Mac
  pendant la mise en page a été reportée dans le texte du head of content. Rien à faire.
- `RESTE n` ou `RIEN_EN_ATTENTE`.
- `HORS_LIGNE` : pas d'internet. Le script travaille avec la dernière copie ; dis à Romain que la
  liste n'est peut-être pas à jour.
- `PAS_ENVOYE` : pas d'internet au moment d'enregistrer. C'est noté sur le Mac et le script
  l'enverra tout seul au prochain lancement : rien à faire, n'en parle pas à Romain.
- `ACCES_A_CONFIGURER` : voir « Première fois ».
- `ERREUR_DEPOT` ou `TEXTE_ILLISIBLE` : ne répare rien. Dis à Romain qu'il y a un souci de ton côté
  et que Yoan va regarder, et donne-lui le message exact à transférer à Yoan.

## Le déroulé

### 1. Ce qui l'attend
Lance `attente`. Puis dis à Romain, en quelques lignes :
- les carrousels rangés (`DEJA_FAIT`) en une phrase : « Celui sur … était déjà mis en page le …, je
  l'ai rangé. » ;
- ceux qui l'attendent, dans l'ordre de leur publication prévue : le sujet (le titre, sans les
  astérisques), le nombre de slides, le jour de publication ; pour un `MIS_A_JOUR`, précise que le
  texte a changé depuis la première mise en page ;
- puis : « On commence par celui de … ? »

`RIEN_EN_ATTENTE` : « Rien ne t'attend, tous tes carrousels validés sont mis en page. »

### 2. Pour chaque carrousel, un par un
1. `prepare <slug>`. Il répond `PRET dossier="…"` et une ligne `PHOTO slide=N : …` par slide. Le
   dossier du carrousel est **toujours** celui-là (`~/Pictures/Carrousels/carrousel-<slug>/`) : n'en
   crée jamais un autre, sinon le script ne retrouvera pas les slides.
   S'il dit `ANCIENNE_VERSION` (texte mis à jour), l'ancienne mise en page est rangée dans un
   sous-dossier : tu peux y relire l'ancien `carrousel.json` pour reprendre les photos que Romain
   avait choisies, et lui proposer de les garder.
2. Lis le texte validé (le fichier `texte="…"` donné par `attente`) et `carrousel.json` dans le
   dossier : le texte, le style et le format sont **déjà choisis** par Romain. Tu ne les redemandes
   pas, tu ne changes pas un mot (règle du skill carrousel : son texte au caractère près).
3. Demande-lui ses photos en un seul message, slide par slide, avec ce qu'il faut prévoir
   (`PHOTO slide=N`), par exemple : « Slide 1 : toi au rayon riz du supermarché, en pied. » Les
   slides « aucune, fond noir » n'ont besoin de rien.
4. Dans `carrousel.json` du dossier, pour chaque slide : remplace la clé `photo-a-prevoir` par
   `photo` (chemin complet de sa photo), `cadrage` et `position`, comme le décrit le skill carrousel.
   Une slide sans photo : retire seulement `photo-a-prevoir`.
5. Suis le skill carrousel à partir de son étape « Rendre » (lis son `SKILL.md` et son
   `preferences.md` s'il existe), sur ce dossier : mise en page, vérification, présentation à
   Romain, retouches, préférences retenues. Lance la mise en page exactement comme ce skill
   l'indique sur ce Mac.
6. **Quand Romain valide le résultat** (« c'est bon », « parfait », « je prends ») : `termine <slug>`.
   Puis dis-lui : « C'est rangé, il ne reviendra plus dans la liste. Tes slides sont dans
   Images > Carrousels > carrousel-… » et passe au suivant s'il en reste (« On fait celui de … ? »).
   - `AUCUN_RENDU` : la mise en page n'a pas été faite dans le bon dossier. Refais-la dans le dossier
     donné par `prepare`, puis relance `termine`.
   - S'il s'arrête avant de valider (« je finis demain »), n'appelle pas `termine` : le carrousel
     reviendra au prochain `attente` (ou sera rangé tout seul si les slides existent déjà ; il pourra
     toujours te demander une retouche dans ce dossier).

### Si Romain change un mot ici, sur son Mac
C'est son texte : fais-le dans `carrousel.json` (seulement ce qu'il demande, au caractère près). Tu
n'as rien d'autre à faire : au moment de `termine`, le script compare le texte rendu au texte validé
et reporte la correction dans le texte de son head of content (ligne `TEXTE_REPORTE`). Dis-lui
seulement : « C'est corrigé, et ton head of content a la nouvelle version. » La légende ne se
change pas ici : elle se change avec son head of content.

### « Où en sont mes carrousels ? »
Lance `attente` et réponds avec ce qu'il dit, sans rien mettre en page.

## Première fois sur ce Mac (une seule fois)

Le script a besoin de deux choses : les outils de développement d'Apple, et l'accès aux textes de
Romain.

1. `xcode-select -p` ne répond pas un chemin ? Lance `xcode-select --install` et dis à Romain : « Une
   fenêtre d'Apple va te proposer d'installer des outils : clique sur Installer, ça prend quelques
   minutes. Dis-moi quand c'est fini. »
2. Lance `attente`. S'il répond `ACCES_A_CONFIGURER` :
   - lance `cle` : il crée la clé d'accès de ce Mac (une seule fois) et l'affiche après `CLE_PUBLIQUE` ;
   - donne à Romain ce message à copier tel quel et à envoyer à Yoan sur WhatsApp, avec la ligne qui
     commence par `ssh-ed25519` en entier :
     « Yoan, voici la clé de mon Mac pour les carrousels : ssh-ed25519 … »
   - dis-lui : « Dès que Yoan te répond que c'est fait, redis-moi “fais mes carrousels en attente”. »
   - quand il revient : `verifier` doit répondre `ACCES_OK`, puis `attente`.

La clé ne donne accès qu'aux textes de Romain, rien d'autre. Rien n'est à refaire ensuite.

## Ce que tu ne fais jamais
- Mettre en page un carrousel qu'`attente` n'a pas listé, ou deux fois le même.
- Appeler `termine` avant que Romain ait validé les slides, ou pour un carrousel pas mis en page.
- Modifier, déplacer ou effacer quoi que ce soit dans `~/.montage-yoan/head-of-content/`, ou y lancer
  une commande git.
- Montrer à Romain un message technique : traduis-le en une phrase simple.
