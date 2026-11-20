<!--
Gabarit du premier message du chat <slug>:monteur (lot 5, CONTRAT-STUDIO.md sections 9 et 12).

Le serveur retire ce commentaire (tout jusqu'au premier « --> » et le saut de ligne qui suit), remplace
les variables, puis envoie le reste tel quel comme premier message de la session. Ce message n'est pas
montré à Romain (il contient des chemins) : la carte affiche à la place une ligne comme « Je monte ta vidéo. ».

Session : cwd = MEDIA/<slug>/, --agent monteur, env STUDIO=1 et MONTEUR_SK=<skills de la config>.

Variables :
  {{slug}}      le slug du contenu.
  {{titre}}     le titre de la carte (etat.json), sans astérisques.
  {{video}}     chemin absolu de la vidéo face caméra originale : MEDIA/<slug>/face/<nom>.<ext>
                (jamais un -monte*.mp4 ni un -coupe.mp4). S'il y en a plusieurs, la plus récente, suivie
                sur la même ligne de « (autres prises : <chemins absolus séparés par des virgules>) ».
  {{clips}}     une ligne « - <chemin absolu> » par fichier de MEDIA/<slug>/b-roll/ (liens de la
                bibliothèque, chemin du lien lui-même), dans l'ordre alphabétique ; « - aucun » s'il n'y en a pas.
  {{script}}    chemin absolu de DEPOT/contenus/<slug>/script.md.
  {{genre}}     un saut de ligne puis comment le reel a été tourné (plans filmés sans parler, ou avec sa voix) ;
                vide pour une face caméra.
  {{tournage}}  « Plan de tournage groupé : <chemin absolu> » pour chaque DEPOT/tournages/*.json dont
                `contenus` contient le slug (une ligne chacun, le plus récent d'abord) ; vide s'il n'y en a pas.

Pour une reprise (Romain répond dans le chat, une note sur l'aperçu, « Fabrique la vidéo »), le serveur n'utilise pas ce gabarit : il envoie le texte
de Romain tel quel avec --resume.
-->
Monte la vidéo du contenu {{slug}} : « {{titre}} » (mode studio).

Vidéo face caméra : {{video}}{{genre}}

Ses clips filmés en plus pour ce contenu (liens vers sa bibliothèque) :
{{clips}}

Son script : {{script}}
{{tournage}}

Lis toi-même son script : ce qu'il voulait dire, la section « Plans à tourner » (quel plan va sur quelle phrase, et
les photos prévues ; dans un script plus ancien : « À filmer en plus » et « Photos à envoyer »). Il a pu retoucher son
texte lui-même dans son studio : c'est le fichier qui fait foi. S'il y a un plan de tournage groupé ci-dessus, lis-le aussi : les prises de ce contenu disent
quel mouvement de quel clip sert quelle phrase. Ce que montre chaque clip est décrit dans
`../_bibliotheque/index.json`.

Montage complet, jusqu'à l'aperçu (sons compris). Regarde toi-même les moments clés sur une planche, lance l'aperçu,
puis écris-lui ton message et arrête-toi : l'aperçu s'affiche dans son dossier. Ses corrections t'arriveront en notes
dans ce chat ; tu ne fabriques la vidéo que quand il clique « Fabrique la vidéo ».
