# Sons du style : sources

Tous générés avec ElevenLabs (sound generation, `executeur/son/generer.py`), aucun échantillon tiers. Les fichiers bruts
gardés sont dans `sources/`. Niveaux : jamais un gain fixe, réglés à la pose par rapport à la voix mesurée (`style.json`,
`son.effets`), lus sur un seul canal (`pan=mono|c0=c0`), contrôlés dans le final par leur émergence (`pilote/verifier.py`).

| Fichier | Usage |
|---|---|
| `flash.wav` | faisceau (r4-02c, voir REGLES.md) |
| `cta-apparition.wav` | CTA et ses lignes, minuteur à la manière du CTA (r6-02b) |

## Famille « motion premium SaaS explainer » (2026-10-23, 3e passage de Yoan)

Retour de Yoan sur la famille précédente (pop, glisse, curseur, bruh) : « ne fait pas motion design premium de SaaS
explainer, or c'est le but sur toutes les animations » ; curseur : « il faudrait plus un truc digital ». La famille
précédente est retirée. Trois candidats par type, comparés par l'analyse (`scratchpad/outils/analyse.py` : début, durée
active, attaque 10 à 90 %, nombre de pics, centre du spectre, répartition par bandes) ; on garde des sons courts, d'une seule
frappe, au-dessus de la voix (centre 2 à 9 kHz), sans graves, qui se tiennent entre eux.

| Fichier (brut) | Prompt (durée, influence 0,6) | Mesures du gardé | Pourquoi lui |
|---|---|---|---|
| `whoosh.wav` (`sources/whoosh-whoosh-5.mp3`) | « short airy whoosh, breathy high-frequency swish of a UI card sliding in, soft and thin, premium SaaS explainer transition, no low end, no rumble » (0,5 s) | 166 ms actifs, montée 109 ms, centre 5,5 kHz, 7 % entre 250 Hz et 1 kHz | 1er prompt (« short soft muffled whoosh ») : 3 tirages à 77 à 94 % d'énergie sous 250 Hz, un grondement ; 2e prompt : le 5 a un peu de corps (feutré), le 4 et le 6 sont plus fins et plus longs |
| `clic.wav` (`sources/clic-clic-3.mp3`) | « clean crisp UI click, premium app interface tap, soft and precise, very short, dry, no reverb, not cartoon » (0,5 s) | 31 ms, attaque 0,6 ms, un seul pic, 96 % entre 1 et 4 kHz | le 1 traîne 348 ms (trois frappes), le 2 en fait deux |
| `pop.wav` (`sources/pop-pop-2.mp3`) | « soft rounded UI pop, premium motion graphics element appearing, gentle and warm, short, not cartoon, no bass » (0,5 s) | 38 ms, attaque 3,5 ms, un seul pic, centre 2,2 kHz | le 1 est presque muet (-28,6 dB), le 3 plus sourd (1,3 kHz, sous la voix) |
| `glisse.wav` (`sources/glisse-glisse-3.mp3`) | « smooth soft slide, UI panel gliding into place, short airy swish, premium motion design, no bass, no metallic » (0,7 s) | 444 ms, montée 251 ms, centre 6,2 kHz | le 1 démarre 0,11 s en retard, le 2 est sourd et faible (-12,8 dB) |
| `shimmer.wav` (`sources/shimmer-shimmer-3.mp3`) | « subtle soft shimmer glint, gentle glassy sparkle as an icon turns gold, premium UI success, short and warm, not metallic, not harsh » (1 s) | 414 ms, 3 scintillements, centre 8,4 kHz, 26 % au-dessus de 10 kHz | le 2 a 75 % au-dessus de 10 kHz (aigu criard), le 1 scintille 7 fois sur 0,67 s (trop chargé) |
| `curseur.wav` (`sources/curseur-curseur-2.mp3`) | « fine digital tick with a tiny electronic glide, futuristic interface scrubber moving on a timeline, clean, short, subtle » (0,6 s) | 468 ms, attaque 8,6 ms, 5 ticks, centre 9 kHz | le 1 monte en 339 ms (pas de tick net), le 3 en 77 ms |

Médias tiers d'un reel (son comique, photos) : jamais ici, dans le dossier du reel (ex. `executeur/test/medias/`, usage
personnel).
