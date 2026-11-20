# Contrat entre les briques du monteur de Romain

Écrit le 2026-11-11. Toutes les briques du monteur lisent et écrivent selon ce contrat. Si une brique a besoin
d'un champ qui n'y est pas, elle l'ajoute ici (section « Extensions ») au lieu d'inventer un format à part.

**Où est ce fichier, et pourquoi.** Source unique : `skills/animations/CONTRAT.md` du dépôt des skills de Romain,
installé avec le skill `animations` dans `<config Claude>/skills/animations/CONTRAT.md` (`<config Claude>` = `${CLAUDE_CONFIG_DIR:-$HOME/.claude}`). Le skill `animations` est déjà le
socle commun que les autres briques lisent à côté d'elles (`../animations/bibliotheque/`) : le contrat voyage avec lui,
à chaque installation, sans étape de plus. Lecture : l'agent monteur par `$SK/animations/CONTRAT.md`, une brique par
`../animations/CONTRAT.md`. Toute autre copie (côté Yoan : `agents/monteur/CONTRAT.md` du projet) n'est qu'un renvoi
vers celle-ci.

## Décisions (Yoan, 2026-11-11)
- L'**agent monteur** orchestre les briques ; le skill `montage` disparaît. Le rendu unique devient la brique `rendu`.
- Le **plan de montage** dit quoi et où ; les briques exécutent, elles ne choisissent pas où vont les animations.
  Depuis le 2026-11-13 (Yoan), c'est l'**agent monteur** qui l'écrit lui-même, après le tournage, sur la transcription
  de ce que Romain a vraiment dit et avec les clips réellement fournis (skill `plan-montage`), et le fait valider par
  Romain avant de fabriquer. Il place aussi les sons (skill `sound-design`).
- **Pas de B-roll généré par IA de soi-même** (Yoan, 2026-11-13 : Romain ne les aime pas). Les B-rolls sont ses clips filmés
  et toute vidéo qu'il donne (enregistrement d'écran, vidéo du dossier), même hors du brief. Sur sa demande expresse,
  une image ou un clip généré est permis, jamais son visage ni sa voix (2026-11-19).
- Cible : un Mac comme celui de Yoan (Apple Silicon, macOS 15). Rien n'est vérifié chez Romain : un prompt de
  réinstallation final installera ce qui manque. Chaque brique liste ses dépendances dans une section
  « Dépendances » de son `SKILL.md`.
- Un seul réencodage de l'original. Les fichiers intermédiaires qui ne servent qu'à calculer (masques de détourage,
  aperçus) sont permis ; l'image finale vient de l'original en un passage.
- Sons : ElevenLabs, usage commercial réglé (Yoan).
- Rush de test (côté Yoan) : `execution/romain/monteur-tests/rush-whatsapp.mp4` (576x1024, 71 s, face caméra,
  recompressée par WhatsApp). Pas de 4K pour l'instant.
- Vidéos d'iPhone acceptées telles quelles (2026-11-13) : HDR (HLG, PQ) converti en SDR et 60 i/s ou cadence variable
  remis à 30 i/s, dans le même passage du rendu. Sortie toujours en 1080 x 1920, sous le plafond de poids du style.
- **Le style gagne sur le plan** (Yoan, 2026-11-11) : voir « Plan contre style ».
- **Sous-titres, police unique, captions** (Yoan, 2026-11-13 et 2026-11-14) : les sous-titres redeviennent ceux de
  son ancien skill (Inter Black, pavé orange qui glisse) ; tous les textes de la vidéo passent à leur police
  (`POLICES.sousTitres`), sauf les formats natifs recopiés ; tout texte d'un effet qui reprend ses mots a un
  comportement de sous-titres ; les captions (sa phrase au fil de sa voix) ont une taille et une police par ligne
  (STYLE.md). Lignes datées plus bas.
- **Format du plan de montage** : source unique dans `skills/plan-montage/references/format.md` (installé dans
  `<config Claude>/skills/plan-montage/`). Ce contrat dit seulement ce que chaque brique en fait.

## Où vit quoi
- Dépôt des skills de Romain (git Yoanmot/montage-demo ; côté Yoan : `projets/clients/Romain/skills-montage/depot/`) :
  `agents/monteur.md` (installé dans `<config Claude>/agents/`), `skills/<brique>/` (installés dans `<config Claude>/skills/`).
  **Aucun commit ni push par une brique** : Yoan valide d'abord.
- Briques : `couper-silences` (Node), `plan-montage`, `zooms` (Python), `animations` (Node), `sous-titres` (Node),
  `b-roll` (Python), `sound-design` (Node et Python), `rendu` (Python). Plus aucun PowerShell dans le monteur depuis le
  2026-11-13 (couper-silences et b-roll portés, mêmes coupes vérifiées sur la rush de test).
- **Bibliothèque du style** : copiée dans `skills/animations/bibliotheque/` (source côté Yoan :
  `projets/clients/Romain/agents/monteur/style-lab/bibliotheque/`, les deux restent identiques ; règles dans son
  `STYLE.md`, constantes dans `commun.mjs`). Les autres briques la lisent par `../animations/bibliotheque/` (skills
  voisins une fois installés).
- Scripts : Node (`.mjs`, Node 24 ; Node est obligatoire pour HyperFrames) ou Python 3 système
  (`/usr/bin/python3`, numpy, scipy, Pillow, pyobjc Quartz/Vision pour le détourage). Jamais de PowerShell.
- HyperFrames : `npx --yes hyperframes@0.7.55 render . --format mov -w 1 -q high -o <sortie.mov>` (calque avec alpha,
  ProRes 4444). ffmpeg : celui du système s'il est en version 7 ou plus (`/opt/homebrew/bin/ffmpeg` ici).

## Le dossier de travail
`<dossier de la vidéo>/<nom>-montage/` (convention existante). Base de temps : **la vidéo coupée**, 30 images par
seconde, image 0 = début de la vidéo coupée. Toute position s'exprime en **images** de la vidéo coupée.

| Fichier | Écrit par | Contenu |
|---|---|---|
| `words.cut.json`, `filtre.txt` | couper-silences | mots calés sur la vidéo coupée (numérotés), coupes |
| `edl.json` | couper-silences | les morceaux gardés : `segments` (`srcInF`/`srcOutF` dans l'original, `outInF`/`outOutF` dans la vidéo coupée, `words` premier et dernier mot), `stats` (`out_frames`…). **La source des coupes** : `outInF` > 0 de chaque morceau = une coupe (lu par `coupes()` et `coupeAvant()` de `scripts/lib/style.mjs`, donc par le calage des transitions et le `/` de `texte-sous-titres.md`) |
| `draft.md`, `cuts.json`, `discours.txt` | couper-silences | transcript à trancher, coupes décidées, dernière sortie de `compiler` |
| `texte-zooms.md`, `texte-sous-titres.md`, `texte-b-roll.md` | zooms, sous-titres, b-roll | texte numéroté de la brique (un fichier par brique : leurs formats diffèrent) |
| `texte-sous-titres.md` | sous-titres (`texte`) | aussi le texte sur lequel l'agent monteur écrit le plan (`/` = une coupe de la vidéo juste avant le mot, même règle que `coupeAvant` : un flash s'y pose) |
| `plan-montage.json` | agent monteur (skill plan-montage) | le plan validé par Romain (format : `skills/plan-montage/references/format.md`) |
| `remarques-plan.md` | animations (`caler.mjs`), agent monteur | trace : ce que le plan demandait et que le style a remplacé (voir « Plan contre style ») |
| `zooms.json`, `zooms.txt` | zooms | zooms demandés, et ce que lit le rendu |
| `ouverture.json` | zooms | le dézoom d'ouverture (images, échelle de départ, point fixe), suivi par le titre derrière lui |
| `accroche.json` | animations (`accroche.mjs`) | l'accroche composée retenue pour cette vidéo (type, effet, pourquoi, disposition de chaque élément, temps) ; sa ligne va aussi au registre des accroches du client (`agent-memory/monteur/registre-accroches.json`, tenu par `registre-accroches.mjs`) |
| `b-roll.json`, `b-roll.txt` | b-roll | B-rolls |
| `calques/<id>/` | sous-titres, animations | un projet HyperFrames prêt à rendre (`index.html` + ses fichiers), 1080x1920, 30 i/s |
| `calques.json` | sous-titres, animations (chacun ses entrées) | la liste des calques (voir plus bas) |
| `sons.json` | sound-design | les sons posés et leurs niveaux |
| `style-video.json` | le monteur | facultatif : le style de CETTE vidéo demandé par la personne (`etalonnage`, `etalonnage_en_plus` lus par rendu, aperçu et planche ; `style` lu par les sous-titres et, chez Yoan, `animations-yoan`). Absent : le style du client |
| `<nom>-monte.mp4` | rendu | la vidéo finale, à côté de l'originale |

### `calques.json`
```json
{ "calques": [
  { "id": "st", "source": "sous-titres", "dossier": "calques/st", "debut": 0, "images": 2130,
    "couche": "devant", "ordre": 100 },
  { "id": "a03-hook", "source": "animations", "dossier": "calques/a03-hook", "debut": 0, "images": 75,
    "couche": "derriere", "ordre": 10 },
  { "id": "a07-plein", "source": "animations", "dossier": "calques/a07-plein", "debut": 412, "images": 90,
    "couche": "devant", "ordre": 20, "plan": { "flou": { "rayon": 40, "assombrir": 0.28 } } }
] }
```
- Chaque brique ne réécrit que **ses** entrées (filtre par `source`) et laisse les autres.
- `couche` : `devant` (posé sur l'image) ou `derriere` (posé sous Romain : le rendu le troue par le masque de Romain).
- `ordre` : ordre de pose dans une même couche, croissant. Les sous-titres ont `ordre` 100 : toujours au-dessus.
- `plan` (facultatif) : ce que l'effet fait subir à l'image caméra pendant le calque.
  - `{ "flou": { "rayon": px, "assombrir": 0..1 } }` : plein écran sur sa vidéo floutée.
  - `{ "decalage_y": "<fichier json : un décalage en px par image du calque>" }` : demi-écran qui pousse le visage.
  - `{ "detoure": true }` : fond vert, le calque est le fond complet et Romain détouré est posé dessus (couche
    `derriere` obligatoire).

### `sons.json`
```json
{ "sons": [
  { "fichier": "faisceau-obtu.wav", "image": 412, "niveau": { "lu_sous_voix": 9 }, "pourquoi": "faisceau r19-04a" },
  { "fichier": "frappes/t2.wav", "image": 530, "niveau": { "rms_db_sous_voix": 23 }, "pourquoi": "frappe CTA" }
], "musique": null }
```
- `fichier` : relatif à `../animations/bibliotheque/sons/`, ou chemin absolu pour un son généré pour la vidéo.
- `niveau` : une des deux mesures de `STYLE.md` (« Sons et niveaux »).

## Ordre de composition (brique `rendu`)
1. Plan caméra depuis l'original : coupes, puis zooms, puis effets `plan` (décalage, flou), puis étalonnage
   « contrasté net » (`ETALONNAGE` de `commun.mjs`).
2. Calques `derriere`, troués par le masque de Romain (Apple Vision, calculé sur le plan coupé et zoomé, non
   étalonné ; voir `style-lab/renders/r21/_build/detourage.py`). Pour `detoure`, Romain détouré posé sur le calque.
3. B-rolls.
4. Calques `devant` par `ordre` croissant, sous-titres en dernier.
5. Audio : voix loudnorm -16 LUFS, crête -1,5 dBTP, LRA 11, plus les sons de `sons.json` à leurs niveaux ; crête du
   mix sous -1 dBFS.
6. Sortie : H.264 yuv420p bt709, faststart, AAC 192 kb/s 48 kHz, toujours en 1080 x 1920, sous `RENDU.fullMaxMo`
   (250 Mo) de `commun.mjs`.

## Plan de montage (`<nom>-montage/plan-montage.json`)
Écrit par l'agent monteur avec le skill `plan-montage`, après les coupes, sur `texte-sous-titres.md` et les clips
fournis ; validé par Romain avant toute fabrication. **Le format (clés, ancres, demandes d'animation, exemples) est
dans `skills/plan-montage/references/format.md`, source unique** : ce contrat n'en garde pas de copie. Il dit **quoi
et où** pour tout sauf les sons, que le monteur place à l'étape sons. Si une ancre change après validation, la version
validée reste à côté (`plan-montage.recu.json`).

Ancres : citation exacte de ce qu'il dit (`"dix pas"`, `#n` pour la n-ième occurrence, sinon `ANCRE_AMBIGUE`) ou numéro
de mot de `words.cut.json` (`"w68"`, `"w68-w70"`). Jamais de minutage.

### Ce que chaque brique fait des clés
| Clé | Absente | Traduite par le monteur en |
|---|---|---|
| `coupes` | rythme `serre` | argument de `compiler` (couper-silences), choisi aux coupes et recopié dans le plan |
| `sous_titres` | ses sous-titres (un seul style) | `sous-titres.json` (`corrections` guidées par `vocabulaire` ; `masquer` ; `citations` en numéros de mots) ; `style` et `mots_forts` d'un ancien plan sont ignorés |
| `zooms` | zooms choisis avec retenue | `zooms.json` (`type`, `mot`) ; `[]` = aucun |
| `b_roll` | aucun B-roll | `b-roll.json` (`fichier` = clip de Romain, vérifié par ses vignettes ; `debut`, `fin`, `depart`) |
| `animations` | aucune animation | lu tel quel par `caler.mjs` |

- Pas de clé `sons`. Une clé inconnue est signalée, jamais exécutée.
- Une valeur du plan que le style interdit ou que le gabarit ne prévoit pas : le style gagne (section suivante).
- Mode simple (Romain veut seulement « coupe et sous-titre ») : pas de plan ; coupes (rythme `serre`), sous-titres,
  zooms avec retenue. Le monteur le dit à Romain.

### Plan contre style
Le plan dit **quoi et où** ; le style (`bibliotheque/STYLE.md`, `commun.mjs`, les gabarits) dit **comment**. Quand le plan
demande un « comment » que le style ne permet pas, **le style gagne** :
- réglage que le gabarit ne prévoit pas (`"fond": "flou"` sur une carte chapitre, qui n'a pas de réglage `fond`) :
  ignoré ;
- valeur hors des valeurs du gabarit (lues dans le commentaire de son objet `P`) : valeur par défaut du gabarit ;
- durée que le style fixe (`duree_style` de `scripts/lib/gestes.json`, par exemple hook pavés : images 0 à 59, soit
  2 s, `HOOK_TEMPS.finPaves`) : la durée du style, à partir du début demandé, même si le passage du plan est plus long.
Qui fait quoi :
- `caler.mjs` détecte ces cas (avertissement `STYLE_GAGNE`, la demande reste exécutable), écrit dans
  `animations/plan-resolu.json` ce qui sera appliqué (`reglages`, `reglages_plan`, `duree_style`, `style_gagne`) et
  réécrit la section « Animations » de `remarques-plan.md` ;
- `instancier.mjs` refuse un réglage inconnu ou hors style dans les paramètres et ramène une durée hors style à celle du
  style (`STYLE_GAGNE`) : rien ne passe en silence ;
- l'agent monteur, qui a écrit le plan, le corrige avec la valeur du style et recale (le plan s'écrit dans ce que le
  style permet : `skills/plan-montage/references/gestes.md`).
`remarques-plan.md` : une section par brique, une ligne par cas :
`- <id> (<geste>) : <ce que le plan demandait>, <ce que dit le style> : <ce qui a été appliqué>`. C'est une trace dans le
dossier de montage. Pour obtenir autre chose que le style, on change le style avec Yoan, pas le plan.

### Ordre d'exécution (agent monteur) : la seule version
1. couper-silences (rythme choisi après la transcription) ; 2. ses clips regardés (vignettes de b-roll) ; 3. plan
(`sous-titres texte`, puis skill `plan-montage`, `plan-montage.json` posé dans le dossier) ; 4. zooms (avant les
animations : le titre de l'accroche suit le dézoom d'ouverture, `ouverture.json`) ; 5. animations (`caler.mjs` d'abord,
puis `calques.mjs`) ; 6. sous-titres (après les animations : ils s'effacent sous les calques qui portent leur ligne ou
couvrent l'écran) ; 7. b-roll ; 8. planche (`rendu/scripts/planche.py`) et validation par Romain, corrections refaites
dans la brique touchée (une animation qui change : relancer `sous-titres preparer`) ; 9. sound-design (sur
`calques.json` complet) ; 10. rendu avec les couches préparées. `agents/monteur.md` suit cet ordre ; les lignes datées
ci-dessous qui en citent un autre sont l'historique. Exemple de plan complet : `format.md` du skill plan-montage.

### Poser une image dans un effet sur mesure (exemple : image de réaction)
L'image vit dans `M/animations/images/` (téléchargée par le monteur pour un mème, ou photo donnée par Romain), est
recopiée **dans le dossier du calque** après `ecrireCalque` (qui crée `calques/<id>/images/`), et le HTML la cite en
chemin relatif `images/<fichier>` (jamais de chemin absolu ni `../` : `verifier.mjs` les refuse). Squelette, à lancer
comme les autres sur-mesure (`node M/animations/sur-mesure/<id>.mjs "$M" "$SK"`, où `$SK` = le dossier du skill
animations) :
```js
import fs from 'node:fs';
import path from 'node:path';
const [M, SK] = process.argv.slice(2);
const { S, Couche, chargerMots, resoudre, son, ecrireCalque } = await import(path.join(SK, 'scripts', 'lib', 'style.mjs'));
const mots = chargerMots(M);
const a = resoudre('pourquoi', mots), b = resoudre('douze semaines#1', mots);      // ancres du plan
const debut = a.image, images = b.fin_image - debut + 1;
const fichier = 'mr-bean-montre.jpg', w = 432, h = Math.round(w * 702 / 958);     // ratio de l'image
const x = S.ZONE_SURE.x1 - w, y = 262;                                             // en haut à droite, dans la zone sûre
const c = new Couche(images);
c.css = `#m{position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:${S.RAYONS.vignette}px;object-fit:cover;box-shadow:${S.OMBRES.carte};}`;
c.html = `  <img id="m" src="images/${fichier}">\n`;
c.montre('#m', 0, 'image de réaction');          // pop : posée d'un coup sur l'image du mot
c.attendus.at(-1).mot_image = a.image;
const r = ecrireCalque(M, { id: 'a03', demande: 'a03', debut, images, couche: 'devant', ordre: 25,
  sons_suggeres: [son('meme', debut, 'image de réaction sur « pourquoi »')],
  attendus: c.attendus.map(({ mi, ...q }) => q),
  origine: { sur_mesure: 'image de réaction : Mr Bean qui regarde sa montre', gestes_repris: ['image de réaction'] } }, c.page());
fs.copyFileSync(path.join(M, 'animations', 'images', fichier), path.join(r.dossier, 'images', fichier));
```
Une photo de Romain qui manque encore : `<img src="images/image-a-fournir.svg" data-a-fournir="<ce qu'elle doit
montrer>">` (l'emplacement est déjà dans `images/`) ; `calque.json` la liste dans `a_fournir`.

### Les réglages valides des gestes de base
La seule liste est le commentaire de l'objet `const P` de chaque gabarit (`bibliotheque/<geste>/*/index.html`), lu par
`reglagesGabarit()` de `scripts/lib/style.mjs` (calage et instanciation) ; elle est recopiée pour le plan dans
`skills/plan-montage/references/gestes.md`. À ce jour (vérifié le 2026-11-13) :
| Geste | Réglage | Valeurs (défaut en premier) |
|---|---|---|
| `hook-paves` | `couleur` | `craie`, `orange` |
| `transition-faisceau` | `couleur` ; `largeur` | `craie`, `orange` ; `2200`, `1000` |
| `demi-ecran` | `sortie` | `faisceau`, `bascule` |
| `plein-ecran-fond` | `fond` | `charbon`, `orange`, `craie`, `flou` |
Tous les autres gestes n'ont aucun réglage. Pour relire la liste à jour :
`node -e "import('$SK/scripts/lib/style.mjs').then(m=>{for(const g in m.GESTES)if(!g.startsWith('_')){const r=m.reglagesGabarit(g);if(Object.keys(r).length)console.log(g,JSON.stringify(r))}})"`.

## Extensions
(Ajoutées par les briques, une ligne datée chacune.)
- 2026-11-11 (sous-titres) : le plan de montage dit le style des sous-titres (`classique` ou `formelle`) et, en formelle, les mots forts (texte exact) ; sans indication, classique sans mot fort. La brique écrit aussi `texte-sous-titres.md` et `sous-titres.json` (style, corrections, groupes, motsForts : numéros de mots de `words.cut.json`). `calques/st/` est autonome (polices et gsap recopiés à côté de `index.html`), sa durée `images` = somme des morceaux de `filtre.txt`.
- 2026-11-11 (zooms) : `zooms.txt` reste un morceau de graphe ffmpeg à poser tel quel entre le plan coupé et la suite, `[v]<zooms.txt>[vz]` (comme l'ancien `montage.ps1`), mais il contient maintenant plusieurs chaînes (`split`, `trim`, `perspective`, `mix`, `concat`, étiquettes internes préfixées `zs`/`zp`/`zb`/`zc`) : ne rien préfixer ni suffixer d'autre que les deux étiquettes. Entrée et sortie à la définition de l'original, 30 i/s, même nombre d'images ; le flou de mouvement (10 sous-images moyennées) y est inclus ; `null` s'il n'y a aucun zoom. `zooms.json` : `{ "zooms": [ { "type": "eclair"|"rapprochement", "mot": <n° de mot>, "echelle"?, "cadrage"?: [x, y], "fin"? } ] }`, fin toujours à la coupe suivante. Script : `skills/zooms/scripts/zooms.py` (Python, le `.ps1` est retiré).
- 2026-11-11 (sound-design) : chaque entrée de `sons.json` porte aussi `geste` (`faisceau`, `arrivee`, `photo`, `frappe`, `entree`, `sur_mesure`) et `calque` (id du calque, facultatif). Calage : le son se pose pour que son échantillon `debut_echantillon` (fiche `<son>.json` à côté du wav, ou `frappes.json[tN]` pour les frappes, 48 kHz) tombe pile sur `image / 30` s. Niveaux mesurés comme le labo (`mix21.py`) : `lu_sous_voix` = sonie K (sans porte) de la partie active du son sous la sonie intégrée de la voix ; `rms_db_sous_voix` = RMS actif du son sous le RMS de la voix parlée (blocs de 50 ms au-dessus de -45 dBFS) ; voix et sons lus canal par canal (L = R), pas par la réduction en mono de ffmpeg (+3 dB). Un son généré pour une vidéo vit dans `<dossier>-montage/sons/<nom>.wav` avec sa fiche `<nom>.json`, chemin absolu dans `sons.json`. Les `sons_suggeres` des calques d'animation sont lus au format des entrées de `sons.json` (image absolue) ; l'agent monteur les trie dans `gestes.json` avant `sons.json`.
- 2026-11-11 (rendu) : commande `python3 skills/rendu/scripts/rendu.py <dossier>-montage <couches>`, couches `coupes` (obligatoire), `zooms`, `b-roll`, `animations`, `sous-titres`, `sons` ; un calque n'est posé que si sa `source` est demandée. Ordre précisé : les zooms se posent à la définition de l'original, avant la mise à la définition de sortie ; l'étalonnage passe avant le flou du plein écran (comme le labo r21-01f), le décalage avant l'étalonnage. `plan.flou` : `rayon` = sigma en px 1080, `assombrir` = niveau gardé (0,40 = image ramenée à 40 %, comme `FONDS.flou.niveau`), `debut`/`fin` facultatifs en images relatives au calque (sinon tout le calque). `plan.decalage_y` : chemin relatif au dossier de montage (ou au dossier du calque) d'un JSON liste, ou `{ "decalage": [...] }`, px vers le bas en 1080 x 1920 par image du calque, arrondis au px, 0 au-delà. Voix normalisée à -16 LUFS mesurée sur un canal (L = R), comme le labo : le fichier stéréo final mesure environ -13 LUFS. Intermédiaires (calques mov, masques, bande son) dans `<dossier>-montage/rendu-cache/`, trace du rendu dans `rendu.json`, sortie `<nom>-monte.mp4` (numérotée si elle existe).
- 2026-11-11 (animations) : chaque entrée `source: "animations"` de `calques.json` porte `sons_suggeres` : les sons que le style associe au geste, au format des entrées de `sons.json` (`fichier` relatif à `bibliotheque/sons/`, `image` absolue de la vidéo coupée, `niveau`, `geste`, `calque`, `pourquoi`) ; la brique animations ne pose aucun son, le sound design décide. Chaque `calques/<id>/` contient aussi `calque.json` (l'entrée + `demande`, `origine` gabarit ou sur mesure, `attendus`, `a_fournir` = photos à demander à Romain, `params`) ; `calques.json` en est tiré par `skills/animations/scripts/calques.mjs`. Un gabarit à deux couches donne deux calques (`<id>-derriere`, `<id>-devant`). `plan.decalage_y` du demi-écran : `calques/<id>/decalage.json`, chemin relatif au dossier de montage. Les demandes d'animation du plan de montage sont dans `plan-montage.json`, clé `animations` (format dans `skills/animations/SKILL.md`).
- 2026-11-11 (sous-titres, animations, rendu : ligne de sous-titre des calques) : une entrée de `calques.json` peut porter `masque_sous_titres: true` : le calque a sa propre ligne de sous-titre (gabarits tier-list, cta-mot-derriere, cta-champ-instagram, couche `devant`, marqués dans `gestes.json` ; effet sur mesure qui en porte une). Pendant ce calque, c'est sa ligne qui reste : `sous-titres preparer` retire ou coupe net les groupes qui chevauchent le calque (règle à jour : ligne datée « décision Yoan » plus bas) et note dans son entrée `masques: [{id, debut, images}]`. La ligne du calque est écrite par animations avec `textes: { "#st0": { "mots": "<ancre>" } }` : texte de `sous-titres.json` (corrections, mots masqués) s'il existe, sinon `words.cut.json`. **Ordre** : voir « Ordre d'exécution » (sous-titres après les animations) ; si les animations changent après les sous-titres, relancer `sous-titres preparer` avant le rendu (le rendu refuse sinon : `SOUS-TITRES_PÉRIMÉS`). Si une correction de sous-titres change le texte d'une ligne de calque, refaire ce calque d'animation.
- 2026-11-11 (rendu) : le cache des calques est une suite de PNG RGBA par calque (`rendu-cache/calques/<id>-<empreinte>/frame_000001.png`…, HyperFrames `--format png-sequence`), sans perte, 3 à 11 fois plus léger que le ProRes 4444 ; nettoyé après chaque rendu réussi (ne restent que les calques et masques à jour de `calques.json`). Le fond vert (`plan.detoure`) a maintenant un bord décontaminé (plus de liseré sur mur clair). Les effets sur le plan (`decalage_y`, `flou`, `detoure`) sont posés sur le plan entier, actifs sur les images du calque, sans branche découpée. Contrôle final avant `PRÊT` : images et durée du son du mp4 comparées à la vidéo coupée (`RENDU_INCOMPLET` sinon), garde-fou de temps (`RENDU_BLOQUÉ`).
- 2026-11-11 (sous-titres, animations : pleins écrans) : `masque_sous_titres: true` vaut aussi pour les calques qui couvrent
  tout l'écran avec le texte qu'il dit (sinon les sous-titres le répètent en petit) : `plein-ecran-fond`,
  `plein-ecran-orange`, `liste`, `minuteur-chiffres`, `minuteur-barre`, `schema`, `recherche-google` (couche `devant`,
  marqués dans `gestes.json`). Même règle de retrait que pour les calques à ligne propre. Une ligne de sous-titre de
  gabarit entièrement vidée (`sa_ligne: "retirer"`) n'est plus marquée : les sous-titres de la vidéo restent.
- 2026-11-11 (animations : ligne « commente MOT » des CTA) : le pavé orange de la ligne se pose sur le mot **une image
  avant son attaque**, comme les sous-titres classiques (`SOUS_TITRES_TEMPS.avancePave`), plus dès l'apparition de la
  ligne : instant `t02` (`cta-mot-derriere`) ou `t09` (`cta-champ-instagram`), calé par `{ "pave": "<ancre>" }`
  (`instancier.mjs` refuse s'il n'est pas calé).
- 2026-11-11 (fichiers) : chaque brique écrit son propre texte numéroté (`texte-zooms.md`, `texte-sous-titres.md`,
  `texte-b-roll.md`) ; `texte-numerote.md` n'existe plus (deux briques l'écrasaient dans des formats différents).
  couper-silences n'affiche plus les chemins du serveur et ne lève plus l'alerte « % de la durée coupée » sur les
  blancs : elle mesure la parole retirée par `cuts.json`.
- 2026-11-11 (sous-titres, décision Yoan) : `masque_sous_titres` : un groupe déjà affiché à l'entrée du calque est coupé net à l'image d'entrée (retiré en entier s'il n'aurait été visible que moins de 6 images avant) ; un groupe qui apparaîtrait pendant le calque est retiré. Champ `coupes` ajouté aux paramètres du calque `st`. Remplace la règle « retiré en entier, jamais de ligne coupée ».
- 2026-11-12 (b-roll) : B-roll généré par IA (`source: "genere"`) : retiré le 2026-11-13 (ligne suivante).
- 2026-11-13 (plan, b-roll, décision Yoan) : le plan de montage est écrit par l'agent monteur après le tournage (skill
  `plan-montage`, format dans `skills/plan-montage/references/format.md`, seule source) et validé par Romain avant la
  fabrication. Plus de B-roll généré : `b_roll` n'a plus de clé `source`, chaque entrée est un clip filmé par Romain ;
  le script de génération est sorti du dépôt.
- 2026-11-13 (rendu : la planche, décision Yoan) : Romain valide sur une planche de 8 à 12 vignettes de sa vidéo
  montée, faite par `rendu/scripts/planche.py` avant le rendu, à partir des couches préparées (mêmes fichiers que le
  rendu, sans les sons) et de `<dossier>-montage/planche.json` (demande du monteur). Sorties et cache dans
  `<dossier>-montage/planche/`. Détail dans `rendu/SKILL.md`, « La planche, avant de fabriquer ».
- 2026-11-13 (couper-silences, b-roll : plus de PowerShell) : `couper-silences/scripts/couper.mjs` (Node) et
  `b-roll/scripts/b-roll.py` (Python) remplacent les `.ps1`. couper-silences compile toujours à 30 i/s (`info.json` :
  `fps` 30, `fps_source` de la vidéo, largeur et hauteur après rotation). Les briques prennent la vidéo d'origine à
  côté du dossier de montage avant le chemin de `info.json` (un dossier copié avec sa vidéo retrouve la sienne).
- 2026-11-13 (b-roll) : calage à l'image près dans `b-roll.txt` (`between(n,…)`, pts en images exactes, dernière image
  comprise, plus de marge de 3 images) ; début sur la coupe si le premier mot ouvre un morceau, fin sur la coupe si le
  dernier le ferme, sinon à la reprise de parole ; `vitesse` (nombre ou `"ajuster"`), `jusqua`, `coupes` dans
  `b-roll.json` (et `vitesse` dans le `b_roll` du plan). `lit_brolls` du rendu donne `plages` (images couvertes).
- 2026-11-13 (zooms) : type `ouverture` (dézoom de l'accroche, 120 % au plus vers 100 % de l'image 0 au mot clé),
  `ouverture.json` pour le titre derrière lui ; `zooms.txt` finit par `settb=1/30,setpts=N` (et le rendu remet aussi le
  plan en images exactes après les zooms) : plus d'image de retard des calques.
- 2026-11-13 (sound-design, décision Yoan) : gestes `transition` (clic sur chaque flash, entrée et sortie de plein
  écran, `SONS.transition`) et `meme` (Vine boom, `SONS.meme`) ; le son sur un flash n'est plus interdit (seuls zoom et
  sous-titres le restent). Sons générés avec ElevenLabs, en cache sous l'empreinte de leur description
  (`~/.config/monteur-romain/sons-generes/`), clé dans `~/.config/monteur-romain/.env`. `ecoute.py` prend la voix et le
  limiteur du rendu : l'écoute et le rendu mesurent le même mix.
- 2026-11-13 (rendu) : HDR et 60 i/s convertis, sortie 1080 x 1920 sous 20 Mo (débit maximal tiré de la durée),
  limiteur de crête du mix (au-delà de 3 dB : `MIX_SATURÉ`), masque de Romain borné à sa tête au-dessus du menton
  (correctif du test v3 resté dans les copies de test, perdu au v8). Plus de `VIDÉO_NON_PRISE_EN_CHARGE`.
- 2026-11-13 (animations, zooms : titre qui suit le dézoom, décision Yoan) : `calque.json` peut porter
  `suit_ouverture: true` (passé à `ecrireCalque`) : le titre de l'accroche suit le dézoom d'ouverture et dépasse
  légitimement la zone sûre pendant le dézoom. `verifier.mjs` contrôle sa zone sûre à partir de l'image `images` de
  `ouverture.json` (moins `debut` du calque), quand la caméra est revenue à 100 % ; à cette image, le mot géant couvre
  la zone sûre comme le gabarit (STYLE.md, « Titre derrière lui »). Un calque qui part avant la fin du dézoom est
  refusé (zone incontrôlable).
- 2026-11-13 (animations) : `calques.mjs` laisse hors de `calques.json` un dossier de calque dont la demande n'est plus
  dans `plan-resolu.json` ; `verifier.mjs` : un `#xxx` qui nomme un élément n'est pas une couleur, un format réel
  (`origine.natif`) garde ses rayons et la police système, la classe `objet` sort un objet qui quitte le cadre exprès du
  contrôle de zone sûre ; `sons_suggeres` : `transition` sur `transition-flash`.
- 2026-11-13 (sous-titres, décision Yoan) : un seul style, celui de l'ancien skill de Romain (`captions_romain.py`),
  refait en calque HyperFrames. `sous-titres.json` : `corrections`, `masquer`, `taille` (1 par défaut), `position`
  (0,70 par défaut) ; `style`, `groupes`, `motsForts` sont ignorés (signalés « à relire »). Les groupes se découpent
  seuls (algorithme `groups()` repris tel quel, largeurs mesurées sur la police par `animations/scripts/lib/police.mjs`).
  Le calque `st` porte dans `P` : `groupes` (`mots` avec attaques, `t0`, `t1`, `monte`, `sortie`), `caches`, `coupes`,
  `images` ; même entrée de `calques.json` (ordre 100), même règle de coupe nette sous un calque `masque_sous_titres`.
  La police est un réglage unique : `POLICES.sousTitres` de `commun.mjs` (Inter Black, `fonts/Inter-Black.ttf`, OFL).
- 2026-11-13 (animations, sous-titres : lignes de sous-titre des gabarits) : le style des sous-titres est écrit une fois
  (`blocSousTitres` de `scripts/lib/style.mjs`) et posé entre les marqueurs `SOUS-TITRES:debut` / `SOUS-TITRES:fin` du
  calque `st` et des gabarits à ligne propre (`cta-mot-derriere`, `cta-champ-instagram`, `tier-list`), avec la `taille`
  et la `position` de `sous-titres.json`. `instancier.mjs` écrit `data-attaques` (attaque de chaque mot, secondes du
  calque) sur une ligne `#st…` remplie avec `{ mots }` : le pavé glisse de mot en mot. `{ "pave": "<ancre>" }` = l'image
  de l'attaque (`SOUS_TITRES_TEMPS.avancePave` 0 : le pavé part du mot d'avant et glisse 0,12 s), plus une image avant.
  `{ mots }` garde la casse de la transcription par défaut (`casse` : `telle`).
- 2026-11-14 (animations : police unique et captions ; remplace le contrôle d'écart de taille du 2026-11-13, retiré) :
  - Police : `POLICES.titre` et `POLICES.texte` dérivent de `POLICES.sousTitres` ; chaque gabarit porte un bloc
    `POLICE:debut` / `POLICE:fin` (`blocPolice` de `scripts/lib/style.mjs`), réécrit avec le bloc `SOUS-TITRES` par
    `scripts/maj-sous-titres.mjs`. `verifier.mjs` refuse toute autre famille (`STYLE police hors style`) hors calque
    `origine.natif` ; une partie `[data-natif]` d'un effet (format réel reproduit) peut garder la sienne (note).
  - Captions : un conteneur `[data-captions]` déclare des textes qui disent sa phrase au fil de sa voix ;
    `scripts/meme-ligne.mjs` (Chrome de HyperFrames) regroupe leurs mots par ligne de base, image par image, toutes les
    couches de la même `demande` ensemble ; `verifier.mjs` refuse une ligne dont les capitales diffèrent de plus de 3 %
    ou qui mêle deux polices, vue sur 3 images au moins (problème `LIGNE`). `rapport.json` porte `captions`.
  - `mesure.py geant` n'a plus de `--cap-max` ; `mesure.py` compte l'approche (letter-spacing) de la police.
    `.ti` n'a plus de chiffres en chasse fixe (dans Inter, `tabular-nums` élargit aussi des lettres et faussait les
    mesures de 2 %) : un chiffre qui défile porte la classe `.num`.
- 2026-11-14 (sous-titres, animations : retours de Yoan sur le test v11) :
  - **Un mot dit ne s'affiche qu'une fois.** Un calque d'animation déclare les mots dits qu'il affiche en texte :
    `mots_repris` (numéros de mots de `words.cut.json`) dans `calque.json` et `calques.json` (`ecrireCalque({ mots_repris
    })` pour un effet sur mesure, accepte `12`, `"w12"`, `"w12-w15"`, `[12, 15]` ; `instancier.mjs` compte tout seul les
    textes `{ mots }` et prend `mots_repris` du fichier de demande pour un texte libre ; `calques.mjs` recopie). `sous-titres
    preparer` retire ces mots : le groupe d'avant s'arrête au plus tard à l'attaque du premier mot repris, les mots
    d'après commencent un nouveau groupe. Le calque `st` porte le numéro de chaque mot (`P.groupes[].mots[].i`).
    `verifier.mjs` refuse un mot affiché par deux sources (`MOT_DOUBLE`, le mot et l'image de la deuxième fois), déclaré
    ou deviné (un texte attendu à l'image d'un mot, égal à ce que les sous-titres montrent) ; `verifier.mjs <dossier>
    --mots` fait ce seul contrôle sur toute la vidéo (`scripts/lib/mots-affiches.mjs`).
  - **Citations** : `sous-titres.json` `citations: [[premier, dernier]]` ; corrigé après la v12 (Yoan) : rien ne
    s'affiche en plus, ni guillemets ni autre marque, dans les sous-titres comme dans `texteSousTitres` ; la citation
    fait seulement ses propres groupes (`bornesCitations()` de `scripts/lib/style.mjs`). Plus d'alerte « citation probable
    non marquée ». Plan : `sous_titres.citations` (ancres, `skills/plan-montage/references/format.md`).
  - **Pavé réglable** : `sous-titres.json` `pave` (`true` / `false`, défaut `SOUS_TITRES.pave.actif` de `commun.mjs`,
    `true`) ; passé à `blocSousTitres` et lu par `reglagesSousTitres` (lignes des gabarits). Sans pavé : rien d'autre ne
    change ; la ligne « commente MOT » des CTA garde son pavé posé sur le MOT (sans glissé).
  - ~~Montée des mots en gros~~ (`MONTEE_MOT`, `Couche.monte`) : retirée après la v12. Remplacée par la **montée du bas
    en saccade 12 i/s**, un accent rare : `MONTEE_ACCENT`, `progresAccent`, `monteeAccentJs` de `commun.mjs`,
    `Couche.accent(sel, attaque)` de `scripts/lib/style.mjs` (STYLE.md, « Montée du bas »). Montée et saccade vont
    toujours ensemble ; jamais pour l'apparition des sous-titres enrichis ni des pleins écrans texte.
- 2026-11-14 (retours de Yoan sur le test v12) :
  - **Phrase en sous-titres dans un effet** : `groupesSousTitres(dossier, ancre, mots, { casse, taille, position })` de
    `scripts/lib/style.mjs` rend les groupes et instants de la brique sous-titres (découpe et instants déplacés dans
    `skills/sous-titres/scripts/groupes.mjs`, partagés par `sous-titres.mjs preparer`) ; l'effet les pose avec le bloc
    `blocSousTitres({ pave: false })` (`SousTitres.ligne / monter / sortir`). Exemple : phrase du bas du plein écran
    puzzle, en majuscules.
  - **Sous-titres enrichis** : `APPARITION_LIGNE`, `apparitionLigneJs(sel, t)` et `SOULIGNE` de `commun.mjs` (coup de
    poing par ligne, soulignage 0,13 x la taille en 0,17 s) ; les mots de la ligne (et son soulignage) sont dans un
    conteneur, seul animé, `transform-origin: 50% 70%`. Pendant l'entrée (0,2 s), une ligne large dépasse la zone
    sûre à l'échelle 1,3 : `calque.json` `entrees_echelle` ([[image, image]], `ecrireCalque`) et `verifier.mjs` l'excepte
    (NOTE au lieu de ZONE).
  - **Taille des sous-titres enrichis** (retour sur v13) : `ENRICHI` (`min` 1, `max` 1,2, `fort` 1,2, `moyen` 1,15,
    `secondaire` 1,05 x les sous-titres) ; le conteneur porte `data-enrichi`, `verifier.mjs` refuse une ligne au-delà
    de `max` (`ENRICHI taille ...`).
  - **Attaque d'un mot** (règle définitive, retours sur v14) : `ATTAQUE` de `commun.mjs` (0,1 s, plancher au milieu du
    mot précédent), `attaqueMot(mots, i)` de `scripts/lib/style.mjs`, seule fonction ; `resoudre` rend l'attaque dans
    `debut_s` / `image` et le début transcrit dans `transcrit_s` / `image_transcrite`. `APPARITION.avance` et
    `MONTEE_ACCENT.avance` passent à 0 (l'entrée part à l'attaque). `mot_image` des attendus = l'image d'attaque :
    `verifier.mjs` refuse un texte visible avant elle ; `mots-affiches.mjs` et `sons.mjs` (arrivée sur un `mot`) prennent
    la même fonction. Les sous-titres de la brique gardent le début transcrit.
  - **Sons retenus sur le test v17** (sound-design) : gestes `ecran` (`images`, série), `pose` (`images`), `coche`
    (`images`, série, `coche-1` à `coche-3`), `montee` (`fin` = image du son d'entrée du moment fort) ; niveaux `SONS.ecran`,
    `SONS.pose`, `SONS.coche`, `SONS.montee` de `commun.mjs` (dB RMS sous la voix : 21, 8, 8, 10). `sons.json` peut porter
    `serie` (sons d'un même geste, exemptés de l'écart de 3 images s'ils sont à moins de `SONS.serieMaxS`) et `fin`
    (montée). Le contrôle refuse : un son sur un sous-titre enrichi, plus d'une montée, une montée qui ne finit pas net
    sur un son d'entrée, un son autre qu'une transition dans la dernière seconde.
  - **Case cochée** : `CASE_COCHEE` de `commun.mjs`, `caseCocheeSvg(id, cote, ep, trait, fond)` et `caseCocheeJs(id, t)`
    de `scripts/lib/style.mjs` (case qui se remplit, coche couleur du fond qui l'occupe, même repère).
  - **Captures d'écran natives dans un effet sur mesure** : `origine.natif: true` dans `calque.json` (couleurs, rayons et
    polices du vrai format) et `data-natif` sur la partie native ; une mise en page faite par le navigateur au chargement
    (marge, défilement) se calcule une fois dans le script du calque, avant la timeline.
- 2026-11-18 (rendu, sons : musique ; monteur de Yoan) : `sons.json` peut porter `"musique": { "fichier": <piste wav déjà
  réglée sous la voix, de la durée de la vidéo coupée, chemin absolu ou relatif au dossier de montage>, "gain_db"?: 0 }`.
  `bande_son` de la brique rendu (donc le rendu, l'aperçu et l'écoute qui la partagent) l'ajoute telle quelle au mix,
  avant le limiteur ; `null` (Romain) ne change rien. La piste est préparée par `animations-yoan/scripts/yoan.py sons`
  (musique du pipeline de Yoan : boucle, ducking). Le monteur de Yoan (`agents/monteur-yoan.md`, relié sous le nom
  `monteur` chez lui seulement) écrit ses couches avec les skills `plan-montage-yoan`, `animations-yoan`,
  `sous-titres-yoan` (réservés au client yoan, fichier `CLIENT`) : mêmes fichiers et même contrat que ci-dessus.
- 2026-11-19 (style de la vidéo) : `style-video.json` dans le dossier de montage, facultatif. Le style du client reste le défaut ; ce fichier porte les demandes de la personne pour cette vidéo seulement. `etalonnage` (chaîne ffmpeg, remplace `ETALONNAGE`) ou `etalonnage_en_plus` (ajoutée après), lus par `rendu.constantes(node, biblio, w)` : même image dans le rendu, l'aperçu et la planche. `style` : valeurs fusionnées par-dessus le style, désignées aux pages par `STYLE_VIDEO` (Romain : constantes de `commun.mjs`, lues par la brique sous-titres ; Yoan : clés de `animations-yoan/moteur/style/style.json`, lues par `yoan.py` et `sous-titres-yoan`). Sans fichier, sortie identique à l'octet.
- 2026-11-20 (accroche composée, monteur de Romain) : geste `accroche` du plan (format dans `plan-montage/references/format.md`), contrôlé par `caler.mjs` (composition recopiée dans `plan-resolu.json`) et composé par `scripts/accroche.mjs` (calques `a01-derriere`, `a01-devant`, `accroche.json`, sons `arrivee` et `pose` suggérés) ; registre des accroches par client (`registre-accroches.mjs`, `MONTEUR_REGISTRE` pour les essais). Zooms : type `suivi` et option `suivre` (le cadre suit sa tête pendant le zoom tenu) ; `zooms-donnees.json` porte alors `suivi` (images clés, décalage du cadre en part de l'original) : un lecteur qui ne le lit pas montre le zoom fixe. Montée du bas en saccade : la courbe rend 0 à p = 0 (avant, le texte se voyait à 50 % dès l'image 0 du calque). Rien ne change pour le monteur de Yoan (ses zooms n'ont pas `suivi`).
