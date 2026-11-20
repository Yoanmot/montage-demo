<!--
Gabarit du premier message de l'action mise_en_page d'un carrousel (lot 5, CONTRAT-STUDIO.md sections 9 et 12).

Le serveur retire ce commentaire (tout jusqu'au premier « --> » et le saut de ligne qui suit), remplace
les variables, puis envoie le reste tel quel comme premier message. Ce message n'est pas montré à Romain
(il contient des chemins) : la carte affiche à la place une ligne comme « Je mets ton carrousel en page. ».

Session : chat <slug>:hoc, cwd = DEPOT, même agent que les autres sessions du dépôt, --add-dir pour
<skills>, MEDIA/<slug>/photos et le dossier des slides (config « carrousels », ~/Pictures/Carrousels par
défaut, passé à a-rendre.py par RENDUS_CARROUSELS). La mise en page et son enregistrement passent
par les scripts déjà livrés, comme quand Romain dit « fais mes carrousels en attente » :
  - a-rendre.py (skill carrousels-en-attente) travaille sur la copie des scripts du Mac (config
    depot_mac, ~/.montage-yoan/head-of-content par défaut), jamais sur DEPOT : le serveur pose
    RENDUS_DEPOT=depot_mac dans l'environnement de la session (sa synchronisation fait un checkout -f
    qui écraserait le travail en cours du studio). Le serveur pousse DEPOT avant l'action, pour que
    le texte validé soit en ligne quand a-rendre.py s'aligne.
  - les slides sortent dans <carrousels>/carrousel-<slug>/ ; le serveur pose le lien
    MEDIA/<slug>/slides vers ce dossier (publication/carrousels.mjs, lierSlides) à la fin de chaque
    tour de cette session, pour que la carte montre les slides avant même que Romain valide.
  - fichier attendu (fin de l'action) : l'entrée <slug> dans DEPOT/rendus/registre.json, écrite et
    poussée par « a-rendre.py termine » ; le serveur fait un pull à la fin du tour pour la voir.
    Tant que Romain n'a pas validé les slides, le tour finit sans elle : la carte passe « attend ta réponse ».

Variables :
  {{slug}}     le slug du contenu.
  {{titre}}    le titre de la carte, sans astérisques.
  {{texte}}    chemin absolu du texte du carrousel dans DEPOT : a-rendre/carrousels/<slug>.md
               (ou rendus/carrousels/<slug>.md s'il n'est plus dans a-rendre/).
  {{photos}}   une ligne « - <chemin absolu> » par fichier de MEDIA/<slug>/photos/, dans l'ordre
               alphabétique ; « - aucune » s'il n'y en a pas.
  {{skills}}   le dossier des skills du Mac (config « skills », ~ développé).
-->
Mets en page le carrousel {{slug}} : « {{titre}} » (mode studio). {{prenom}} voit ta réponse dans la carte du
carrousel : parle-lui comme d'habitude (tutoiement, court, jamais de commande, de chemin ni de nom de fichier).

Son texte validé : {{texte}}
Les photos qu'il a mises pour ce contenu :
{{photos}}

Suis le skill des carrousels en attente ({{skills}}/carrousels-en-attente/SKILL.md), pour ce seul carrousel :
1. Lance `python3 "{{skills}}/carrousels-en-attente/scripts/a-rendre.py" attente`. Si {{slug}} n'y est ni
   `NOUVEAU` ni `MIS_A_JOUR` (il est `DEJA_FAIT`, ou absent), ne mets rien en page : dis-le-lui en une phrase et
   arrête-toi.
2. `prepare {{slug}}`, puis lis le texte validé et le `carrousel.json` du dossier qu'il donne. Le texte est le sien :
   tu n'en changes pas un mot sans son accord. Le style et le format qui y sont (en tête, et le `style` d'une slide
   pour un mélange) sont seulement ceux que son head of content a proposés, même si une ligne du texte dit qu'ils
   sont déjà choisis.
3. Le style, avant tout le reste (pas encore les photos) :
   - Si le skill carrousel ({{skills}}/carrousel/SKILL.md) n'a qu'une seule mise en page, sans style ni format à
     choisir, ne pose pas de question : passe à l'étape 4.
   - S'il a déjà dit son style ou son format dans ce chat ou dans ce message, prends-les sans question.
   - Sinon, un seul message court, puis arrête-toi (il répond dans la carte) : « Je pars sur <style proposé> en
     <format>, ou tu en veux un autre ? », puis les autres styles du skill carrousel (sa partie « Lui demander ses
     choix »), une demi-ligne chacun pour choisir vite, et l'autre format en une demi-ligne.
   - Sa réponse : note son choix dans le `carrousel.json` du dossier (`"style"` et `"format"` en tête ; un seul
     style pour tout le carrousel retire le `style` des slides). « Ok », « comme tu veux » : le style proposé.
   - Si son texte ne tient pas dans le style qu'il choisit (les longueurs de chaque style, dans ce dépôt :
     `.claude/skills/carrousel-script/references/format-a-rendre.md`, « Longueurs qui tiennent ») : dis-le-lui en
     une phrase (quelles slides dépassent), et propose-lui une version raccourcie (seulement les slides qui
     changent, une ligne chacune, en gardant ses mots) ou de garder le style d'origine. Arrête-toi : sans son
     accord, son texte ne change pas.
   - Version raccourcie acceptée : c'est une correction de texte validé, elle se revalide comme d'habitude.
     Réécris le texte complet dans `contenus/{{slug}}/carrousel.md` en partant du texte validé ci-dessus (le
     nouveau style et le format en tête du bloc, et dans la ligne « Slides »), enregistre-le comme tout texte du
     dépôt, puis `python3 outils/etat.py valider {{slug}} --pousser`. Puis reprends à l'étape 1, sans reposer la
     question du style.
4. Les photos : prends celles de la liste ci-dessus, en suivant les `PHOTO slide=N` du script (regarde chaque photo
   pour savoir laquelle va où). S'il en manque une, ou si tu ne sais pas laquelle va sur une slide, demande-la-lui
   en un seul message (ce que chaque photo doit montrer) et arrête-toi : il répondra dans la carte.
5. Mets en page avec le skill carrousel ({{skills}}/carrousel/SKILL.md, à partir de son étape « Rendre »), dans le
   dossier donné par `prepare`, puis vérifie toi-même chaque slide comme il le demande. Ne lance jamais `open` et ne
   lui demande pas d'ouvrir un dossier ou une page : les slides s'affichent dans sa carte.
6. Écris-lui que ses slides sont dans sa carte, combien il y en a, et les retouches possibles en une ligne, puis
   demande-lui si c'est bon. Arrête-toi là : il répond dans la carte.
7. Quand il valide (« c'est bon », « ok », « parfait ») : `termine {{slug}}`, puis dis-lui « C'est rangé, ton
   carrousel est prêt à programmer. » et arrête ton tour. S'il demande une retouche : fais-la, revérifie, remontre,
   et attends son ok.
Dans le dépôt, tu n'écris que ce brouillon (version raccourcie acceptée) ; jamais dans `a-rendre/`, `rendus/` ni
dans la copie du head of content du Mac : seuls les scripts y écrivent.
