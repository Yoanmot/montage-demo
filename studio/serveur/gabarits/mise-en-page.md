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
Mets en page le carrousel {{slug}} : « {{titre}} » (mode studio). Romain voit ta réponse dans la carte du
carrousel : parle-lui comme d'habitude (tutoiement, court, jamais de commande, de chemin ni de nom de fichier).

Son texte validé : {{texte}}
Les photos qu'il a mises pour ce contenu :
{{photos}}

Suis le skill des carrousels en attente ({{skills}}/carrousels-en-attente/SKILL.md), pour ce seul carrousel :
1. Lance `python3 "{{skills}}/carrousels-en-attente/scripts/a-rendre.py" attente`. Si {{slug}} n'y est ni
   `NOUVEAU` ni `MIS_A_JOUR` (il est `DEJA_FAIT`, ou absent), ne mets rien en page : dis-le-lui en une phrase et
   arrête-toi.
2. `prepare {{slug}}`, puis lis le texte validé et le `carrousel.json` du dossier qu'il donne : texte, style et
   format sont déjà choisis, tu ne changes pas un mot.
3. Les photos : prends celles de la liste ci-dessus, en suivant les `PHOTO slide=N` du script (regarde chaque photo
   pour savoir laquelle va où). S'il en manque une, ou si tu ne sais pas laquelle va sur une slide, demande-la-lui
   en un seul message (ce que chaque photo doit montrer) et arrête-toi : il répondra dans la carte.
4. Mets en page avec le skill carrousel ({{skills}}/carrousel/SKILL.md, à partir de son étape « Rendre »), dans le
   dossier donné par `prepare`, puis vérifie toi-même chaque slide comme il le demande. Ne lance jamais `open` et ne
   lui demande pas d'ouvrir un dossier ou une page : les slides s'affichent dans sa carte.
5. Écris-lui que ses slides sont dans sa carte, combien il y en a, et les retouches possibles en une ligne, puis
   demande-lui si c'est bon. Arrête-toi là : il répond dans la carte.
6. Quand il valide (« c'est bon », « ok », « parfait ») : `termine {{slug}}`, puis dis-lui « C'est rangé, ton
   carrousel est prêt à programmer. » et arrête ton tour. S'il demande une retouche : fais-la, revérifie, remontre,
   et attends son ok.
Tu n'écris rien dans ce dossier de travail ni dans la copie du head of content : seuls les scripts y écrivent.
