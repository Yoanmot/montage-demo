#!/bin/bash
# Vérifie, après l'installation, que chaque brique marche sur ce Mac, sur une petite vidéo d'essai fabriquée ici
# (un aperçu de la bibliothèque du style, avec une voix de synthèse du Mac). Rien n'est publié, aucun crédit
# ElevenLabs n'est consommé (vérification de la clé en lecture seulement).
#   /bin/bash <racine>/montage-demo/installation/verifier.sh   (<racine> = ~/.montage-yoan chez Romain)
# Une ligne par brique : VERIF_OK <brique> ... | VERIF_ECHEC <brique> ... | VERIF_A_FAIRE <brique> ...
# Dernière ligne : TOUT_EST_PRET, ou A_REGARDER <n>. La vidéo d'essai montée reste dans
# <racine>/verification/essai-monte.mp4 (le dossier est refait à chaque vérification).

main() {
  set -u
  # Rien ici ne lit le Terminal : un rendu lancé dans son propre groupe y resterait figé.
  exec </dev/null
  export GIT_TERMINAL_PROMPT=0
  # shellcheck source=../studio/lancement/client.sh
  . "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../studio/lancement/client.sh"
  studio_client_charger || { echo "VERIF_ECHEC client : $CLIENT_ERREUR"; echo "A_REGARDER 1"; return 1; }
  studio_client_env_claude
  local BASE="$CLIENT_RACINE"
  local CLONE="$BASE/montage-demo"
  local HOC="$BASE/head-of-content"
  local CC="$CLIENT_CLAUDE"
  local SK="$CC/skills"
  local PY=/usr/bin/python3
  local W="$BASE/verification"
  local nb_ko=0 debut=$SECONDS
  for b in /opt/homebrew/bin /usr/local/bin "$BASE/bin"; do case ":$PATH:" in *":$b:"*) ;; *) PATH="$b:$PATH";; esac; done
  export PATH

  okv()  { echo "VERIF_OK $*"; }
  kov()  { echo "VERIF_ECHEC $*"; nb_ko=$((nb_ko + 1)); }
  afv()  { echo "VERIF_A_FAIRE $*"; nb_ko=$((nb_ko + 1)); }

  rm -rf "$W"; mkdir -p "$W"
  local M="$W/essai-montage"

  # -------------------------------------------------- les liens et la mise à jour automatique
  local n=0 s
  for s in couper-silences plan-montage sous-titres zooms b-roll animations sound-design rendu carrousel carrousels-en-attente; do
    [ -f "$SK/$s/SKILL.md" ] || { kov "skills $s absent de $SK"; n=$((n + 1)); }
  done
  [ -f "$CC/agents/monteur.md" ] || { kov "agent monteur absent"; n=$((n + 1)); }
  [ "$n" -eq 0 ] && okv "skills et agent monteur en place"
  if grep -qs "montage-demo/installation/mettre-a-jour.sh" "$CC/settings.json"; then
    local t0=$SECONDS
    /bin/bash "$CLONE/installation/mettre-a-jour.sh" --hook
    okv "mise-a-jour-auto branchée ($((SECONDS - t0)) s au lancement ; dernier passage : $(tail -1 "$BASE/mise-a-jour.log" 2>/dev/null | cut -c1-80))"
  else
    kov "mise-a-jour-auto : pas branchée dans les réglages de Claude"
  fi

  # -------------------------------------------------- le studio (service, sécurité, appli, session Claude d'essai)
  if [ -f "$CLONE/installation/studio.sh" ]; then
    local l
    while IFS= read -r l; do
      echo "$l"
      case "$l" in VERIF_ECHEC*|VERIF_A_FAIRE*) nb_ko=$((nb_ko + 1));; esac
    done < <(/bin/bash "$CLONE/installation/studio.sh" verifier 2>&1)
  else
    kov "studio : installation/studio.sh absent"
  fi

  # -------------------------------------------------- la vidéo d'essai
  local voix
  voix="$(say -v '?' 2>/dev/null | awk '/fr_FR/ {sub(/ +fr_FR.*/, ""); print; exit}')"
  local phrase="Salut, c'est un essai de ton monteur. Trois exercices simples pour ton dos, tous les matins. Tiens douze semaines, et tu verras la différence."
  if [ -n "$voix" ]; then say -v "$voix" -o "$W/voix.aiff" "$phrase"; else say -o "$W/voix.aiff" "$phrase"; fi
  ffmpeg -nostdin -v error -y -stream_loop -1 -i "$CLONE/skills/animations/bibliotheque/fond-vert/apercu.mp4" \
    -i "$W/voix.aiff" -map 0:v -map 1:a -shortest -vf "scale=1080:1920,fps=30" -c:v libx264 -preset veryfast -crf 20 \
    -pix_fmt yuv420p -c:a aac -b:a 128k "$W/essai.mp4"
  if [ ! -s "$W/essai.mp4" ]; then kov "video-essai : ffmpeg n'a pas pu la fabriquer"; echo "A_REGARDER $nb_ko"; return 1; fi
  okv "video-essai fabriquée ($(ffprobe -v error -show_entries format=duration -of csv=p=0 "$W/essai.mp4" | cut -c1-4) s, voix ${voix:-par défaut})"

  # -------------------------------------------------- couper-silences (serveur de transcription, code d'accès)
  local r
  r="$(cd "$W" && node "$SK/couper-silences/scripts/couper.mjs" transcrire "$W/essai.mp4" 2>&1)"
  case "$r" in
    *CODE_MANQUANT*) afv "couper-silences : code d'accès du montage absent (cles.sh code)"; echo "A_REGARDER $nb_ko"; return 1;;
    *"PRÊT dossier="*) ;;
    *) kov "couper-silences transcription : $(echo "$r" | tail -2 | tr '\n' ' ' | cut -c1-160)"; echo "A_REGARDER $nb_ko"; return 1;;
  esac
  echo '{"cuts": []}' > "$M/cuts.json"
  r="$(node "$SK/couper-silences/scripts/couper.mjs" compiler "$M" serre 2>&1)"
  if [ -s "$M/filtre.txt" ] && [ -s "$M/words.cut.json" ]; then
    okv "couper-silences transcription et coupes ($("$PY" -c 'import json,sys; print(len(json.load(open(sys.argv[1]))["words"]))' "$M/words.cut.json" 2>/dev/null) mots)"
  else
    kov "couper-silences compilation : $(echo "$r" | tail -2 | tr '\n' ' ' | cut -c1-160)"; echo "A_REGARDER $nb_ko"; return 1
  fi
  local nmots
  nmots="$("$PY" -c 'import json,sys; print(len(json.load(open(sys.argv[1]))["words"]))' "$M/words.cut.json")"

  # -------------------------------------------------- zooms (Apple Vision : ses yeux)
  "$PY" "$SK/zooms/scripts/zooms.py" texte "$M" >/dev/null 2>&1
  local i zok=""
  for i in $(seq 3 $((nmots - 4))); do
    printf '{ "zooms": [ { "type": "eclair", "mot": %d } ] }\n' "$i" > "$M/zooms.json"
    if "$PY" "$SK/zooms/scripts/zooms.py" preparer "$M" > "$W/zooms.log" 2>&1 && [ -s "$M/zooms.txt" ]; then zok="$i"; break; fi
  done
  if [ -n "$zok" ]; then
    if grep -q "VISAGE INTROUVABLE" "$W/zooms.log"; then kov "zooms : visage introuvable (Apple Vision)"; else okv "zooms (yeux trouvés par Apple Vision)"; fi
  else
    kov "zooms : $(tail -2 "$W/zooms.log" | tr '\n' ' ' | cut -c1-160)"
  fi

  # -------------------------------------------------- sous-titres (calque HyperFrames)
  node "$SK/sous-titres/scripts/sous-titres.mjs" texte "$M" >/dev/null 2>&1
  "$PY" - "$M" <<'PYEOF'
import json, sys, os
m = sys.argv[1]
mots = json.load(open(os.path.join(m, "words.cut.json")))["words"]
idx = [i for i, w in enumerate(mots) if any(c.isalnum() for c in str(w.get("text") or ""))]
groupes = idx[::3] if idx else [0]
json.dump({"style": "classique", "groupes": groupes}, open(os.path.join(m, "sous-titres.json"), "w"))
PYEOF
  r="$(node "$SK/sous-titres/scripts/sous-titres.mjs" preparer "$M" 2>&1)"
  if echo "$r" | grep -q "PRÊT"; then okv "sous-titres"; else kov "sous-titres : $(echo "$r" | grep -v '^ ' | tail -2 | tr '\n' ' ' | cut -c1-160)"; fi

  # -------------------------------------------------- animations : mesure du texte (polices, crénage)
  if "$PY" "$SK/animations/scripts/lib/mesure.py" geant "ESSAI" >/dev/null 2>&1; then okv "animations (mesure du texte)"; else kov "animations : mesure.py a échoué"; fi

  # -------------------------------------------------- planche puis rendu
  local couches="coupes,sous-titres"; [ -n "$zok" ] && couches="coupes,zooms,sous-titres"
  printf '{ "couches": "%s", "vignettes": [ { "mot": 2, "ligne": "Le début." }, { "mot": %d, "ligne": "La fin." } ] }\n' \
    "$couches" "$((nmots - 3))" > "$M/planche.json"
  r="$("$PY" "$SK/rendu/scripts/planche.py" "$M" 2>&1)"
  if [ -s "$M/planche/planche.png" ]; then okv "planche"; else kov "planche : $(echo "$r" | tail -2 | tr '\n' ' ' | cut -c1-160)"; fi
  local t1=$SECONDS
  r="$("$PY" "$SK/rendu/scripts/rendu.py" "$M" "$couches" 2>&1)"
  local sortie="$W/essai-monte.mp4"
  if [ -s "$sortie" ]; then
    okv "rendu ($couches) en $((SECONDS - t1)) s, $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$sortie" | cut -c1-4) s de vidéo"
  else
    kov "rendu : $(echo "$r" | tail -3 | tr '\n' ' ' | cut -c1-200)"
  fi

  # -------------------------------------------------- sons : bibliothèque et clé ElevenLabs (lecture seule)
  if node -e 'import(process.argv[1]).then(()=>process.exit(0),()=>process.exit(1))' "$SK/animations/bibliotheque/commun.mjs" >/dev/null 2>&1 \
     && "$PY" -c "import numpy, scipy" >/dev/null 2>&1; then
    local cle; cle="$(sed -n 's/^ELEVENLABS_API_KEY=//p' "$CLIENT_SONS/.env" 2>/dev/null | tail -1 | tr -d "\"'")"
    [ -n "${ELEVENLABS_API_KEY:-}" ] && cle="$ELEVENLABS_API_KEY"
    if [ -z "$cle" ]; then afv "sound-design : clé des sons absente (cles.sh elevenlabs)"
    else
      local corps; corps="$(printf 'xi-api-key: %s\n' "$cle" | curl -s --max-time 20 -w '\n%{http_code}' -H @- https://api.elevenlabs.io/v1/user)"
      local st="${corps##*$'\n'}"
      if [ "$st" = "200" ] || echo "$corps" | grep -q "missing_permissions"; then okv "sound-design (clé des sons reconnue, aucun crédit consommé)"
      else kov "sound-design : clé des sons refusée (http $st)"; fi
      corps=""
    fi
    cle=""
  else
    kov "sound-design : bibliothèque ou modules Python illisibles"
  fi

  # -------------------------------------------------- carrousel : le skill de mise en page du client
  local C="$W/carrousel-essai" ps skc="${CLIENT_SKILL_CARROUSEL:-carrousel}"
  mkdir -p "$C"
  if [ "$skc" != "carrousel" ]; then
    # Skill propre au client (relié sous le nom « carrousel ») : Node et le navigateur, sans PowerShell.
    case "$(readlink "$SK/carrousel" 2>/dev/null)" in
      */skills/"$skc") r="$(node "$SK/carrousel/scripts/carrousel.mjs" essai "$C" 2>&1)"
        if [ -s "$C/slide-01.png" ]; then okv "carrousel (slide d'essai mise en page, $skc)"; else kov "carrousel ($skc) : $(echo "$r" | tail -2 | tr '\n' ' ' | cut -c1-160)"; fi;;
      *) kov "carrousel : le skill relié n'est pas $skc ($(readlink "$SK/carrousel" 2>/dev/null || echo absent))";;
    esac
  else
    ps="$(command -v pwsh || echo "$BASE/bin/pwsh")"
    printf '{ "style": "texte", "slides": [ { "fond": "noir", "titre": "Essai de *mise en page*", "texte": "Si tu lis ça, ton Mac sait faire tes carrousels." } ] }\n' > "$C/carrousel.json"
    r="$("$ps" -NoProfile -File "$SK/carrousel/scripts/carrousel.ps1" rendre "$C" 2>&1)"
    pkill -f "$BASE/navigateur-carrousel" >/dev/null 2>&1 || true
    if [ -s "$C/slide-01.png" ]; then okv "carrousel (slide d'essai mise en page)"; else kov "carrousel : $(echo "$r" | tail -2 | tr '\n' ' ' | cut -c1-160)"; fi
  fi

  # -------------------------------------------------- head of content : copie, carrousels en attente, publication
  if [ -d "$HOC/.git" ]; then
    r="$("$PY" "$SK/carrousels-en-attente/scripts/a-rendre.py" verifier 2>&1)"
    if echo "$r" | grep -q ACCES_OK; then okv "carrousels-en-attente (accès aux textes de $CLIENT_PRENOM)"; else kov "carrousels-en-attente : $(echo "$r" | tail -1 | cut -c1-160)"; fi
    [ -f "$SK/publier/SKILL.md" ] && okv "publier (skill relié)" || kov "publier : skill absent"
    local cz; cz="${ZERNIO_API_KEY:-$(sed -n 's/^ZERNIO_API_KEY=//p' "$BASE/zernio.env" 2>/dev/null | tail -1 | tr -d "\"'")}"
    if [ -n "${CLIENT_SIMULATION_FORCEE:-}" ]; then
      # Installation d'essai : aucune clé, simulation imposée au service et dans la config.
      local sim; sim="$(/usr/bin/plutil -extract publication.simulation raw -o - "$BASE/studio/studio.config.json" 2>/dev/null)"
      if [ -n "$cz" ] || [ -f "$BASE/zernio.env" ]; then kov "publier : une clé de publication est posée dans une installation d'essai (à retirer)"
      elif [ "$sim" != "true" ]; then kov "publier : publication.simulation n'est pas à vrai dans la config de l'installation d'essai"
      else okv "publier simulation forcée (aucune clé de publication, rien ne peut partir sur Instagram)"; fi
    elif [ -z "$cz" ]; then afv "publier : clé de publication absente (cles.sh zernio)"
    else
      r="$(ZERNIO_API_KEY="$cz" "$PY" - "$HOC/outils" "$CLIENT_ID" <<'PYEOF' 2>&1
import sys
sys.path.insert(0, sys.argv[1])
import zernio
c = (getattr(zernio, "COMPTES", {}).get(sys.argv[2]) or {}).get("compte")
r = zernio.appel("GET", "/v1/accounts/%s/posts" % c if c else "/v1/posts", {"limit": 1})
print("LECTURE_OK %d" % len(r.get("posts") or []))
PYEOF
)"
      if echo "$r" | grep -q LECTURE_OK; then okv "publier (clé de publication valide, lecture seule de son compte)"; else kov "publier : $(echo "$r" | tail -1 | cut -c1-160)"; fi
    fi
    cz=""
  else
    afv "head-of-content : copie absente (clé du Mac à ajouter par Yoan, puis relancer installer.sh)"
  fi

  echo "DUREE $((SECONDS - debut)) s"
  if [ "$nb_ko" -eq 0 ]; then echo "TOUT_EST_PRET"; return 0; fi
  echo "A_REGARDER $nb_ko"; return 1
}

main "$@"; exit $?
