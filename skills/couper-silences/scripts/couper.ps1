# Couper les silences et les reprises d'une vidéo face caméra (Windows, PowerShell 5.1 et plus).
# La transcription calée se fait sur le serveur de Yoan Mottier (seul l'audio part) ; la découpe se fait ici,
# en qualité d'origine.
#
#   couper.ps1 code <code>                    enregistre le code d'accès
#   couper.ps1 transcrire <vidéo>             envoie l'audio, récupère le transcript calé (dossier <nom>-montage)
#   couper.ps1 compiler <dossier> [rythme]    compile cuts.json (rythme : normal | serre | tres-serre), affiche le discours final
#   couper.ps1 rendre <dossier>               fabrique <nom>-coupe.mp4 à côté de la vidéo d'origine
#
# Codes de sortie : 0 ok · 2 fichier introuvable · 3 code manquant · 4 code refusé · 5 erreur serveur
#                   6 réseau · 7 outil vidéo impossible à installer · 8 coupes refusées · 10 pas encore fini
param([string]$Commande, [string]$Arg1, [string]$Arg2)
$ErrorActionPreference = "Continue"   # les outils écrivent sur stderr : on teste leurs codes de sortie nous-mêmes
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ProgressPreference = "SilentlyContinue"

$API = "https://195-15-255-230.sslip.io/v1"
$UserHome = $env:USERPROFILE; if (-not $UserHome) { $UserHome = $HOME }   # $HOME : tests sur Mac (pwsh)
$HomeDir = Join-Path $UserHome ".montage-yoan"
$Curl = "curl.exe"; if (-not (Get-Command curl.exe -ErrorAction SilentlyContinue)) { $Curl = "curl" }   # « curl » seul = Invoke-WebRequest sous Windows
$Bin = Join-Path $HomeDir "bin"
$Conf = Join-Path $HomeDir "config"
New-Item -ItemType Directory -Force -Path $Bin | Out-Null

function Say($m) { Write-Output $m }
# Fichiers lus et écrits sans interprétation des crochets (« Rush [1].MOV ») et en UTF-8 sans BOM
$Utf8 = New-Object System.Text.UTF8Encoding $false
function WriteText($path, $text) { [IO.File]::WriteAllText($path, $text, $Utf8) }
function ReadText($path) { return [IO.File]::ReadAllText($path, $Utf8) }
function Exists($path) { return [IO.File]::Exists($path) }
function Fail($code, $m) { Write-Output $m; exit $code }

function Get-Code {
  if (Exists $Conf) { return ((ReadText $Conf) -replace "^CODE=", "").Trim() }
  return ""
}
function Need-Code {
  $c = Get-Code
  if (-not $c) { Fail 3 "CODE_MANQUANT : demande le code d'accès envoyé par Yoan, puis lance : couper.ps1 code <le code>" }
  return $c
}

# Appel au serveur avec curl.exe (livré avec Windows 10 et 11). Renvoie @{Status; Body}.
function Call([string[]]$CurlArgs, [int]$Timeout = 120) {
  $code = Get-Code
  $out = & $Curl -sS --max-time $Timeout -w "`n%{http_code}" -H "Authorization: Bearer $code" @CurlArgs 2>&1
  if ($LASTEXITCODE -ne 0) { Fail 6 "Connexion au serveur impossible : $out" }
  $text = ($out -join "`n")
  $i = $text.LastIndexOf("`n")
  return @{ Status = [int]$text.Substring($i + 1).Trim(); Body = $text.Substring(0, [Math]::Max(0, $i)) }
}
function Json($s) { try { return $s | ConvertFrom-Json } catch { return $null } }
function Err($r) { $j = Json $r.Body; if ($j -and $j.erreur) { return $j.erreur } return $r.Body }

# ffmpeg et ffprobe : ceux de la machine s'ils existent, sinon une version autonome posée dans ~/.montage-yoan/bin
function Tool($name) {
  $sys = Get-Command "$name.exe", $name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($sys) { return $sys.Source }
  $exe = Join-Path $Bin "$name.exe"
  if (-not (Exists $exe)) {
    Say "Première utilisation : installation de l'outil vidéo (une seule fois, 1 à 2 minutes)…"
    $zip = Join-Path $HomeDir "ffmpeg.zip"; $tmp = Join-Path $HomeDir "ffx"
    & $Curl -sSL --fail "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" -o $zip
    if ($LASTEXITCODE -ne 0) { Fail 7 "Téléchargement de l'outil vidéo impossible." }
    Expand-Archive -Force -Path $zip -DestinationPath $tmp
    foreach ($n in "ffmpeg", "ffprobe") {
      Copy-Item (Get-ChildItem -Path $tmp -Recurse -Filter "$n.exe" | Select-Object -First 1).FullName (Join-Path $Bin "$n.exe")
    }
    Remove-Item -Recurse -Force $tmp, $zip
    if (-not (Exists $exe)) { Fail 7 "Installation de l'outil vidéo impossible." }
  }
  return $exe
}

function Work-Dir($video) {
  return [IO.Path]::Combine([IO.Path]::GetDirectoryName($video), [IO.Path]::GetFileNameWithoutExtension($video) + "-montage")
}

function Cmd-Code($c) {
  if (-not $c) { Fail 3 "Usage : couper.ps1 code <code>" }
  WriteText $Conf "CODE=$c"
  $r = Call @("$API/compte")
  if ($r.Status -ne 200) { [IO.File]::Delete($Conf); Fail 4 ("CODE_REFUSÉ : " + (Err $r)) }
  Say ("Code enregistré pour " + (Json $r.Body).nom + ".")
}

function Cmd-Transcrire($video) {
  if (-not $video -or -not (Exists $video)) { Fail 2 "VIDÉO_INTROUVABLE : $video" }
  $video = [IO.Path]::GetFullPath($video)
  Need-Code | Out-Null
  $ffmpeg = Tool "ffmpeg"; $ffprobe = Tool "ffprobe"
  $w = Work-Dir $video
  [IO.Directory]::CreateDirectory($w) | Out-Null

  # Ce qu'il faut savoir de la vidéo pour la recouper à l'identique
  $p = (& $ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,codec_name,color_transfer,color_primaries,color_space,pix_fmt -of json $video) -join "" | ConvertFrom-Json
  $s = $p.streams[0]
  $num, $den = $s.r_frame_rate -split "/"
  $raw = [double]$num / [double]$den
  $fps = 30
  foreach ($f in 24, 25, 30, 48, 50, 60) { if ([Math]::Abs($raw - $f) -lt [Math]::Abs($raw - $fps)) { $fps = $f } }
  $hdr = @("smpte2084", "arib-std-b67") -contains $s.color_transfer
  $info = @{ video = $video; fps = $fps; largeur = $s.width; hauteur = $s.height; hdr = $hdr;
             color_transfer = $s.color_transfer; color_primaries = $s.color_primaries; color_space = $s.color_space }
  WriteText ([IO.Path]::Combine($w, "info.json")) ($info | ConvertTo-Json)

  Say "Extraction du son…"
  $audio = [IO.Path]::Combine($w, "audio.flac")
  & $ffmpeg -nostdin -v error -y -i $video -vn -ac 1 -ar 16000 -c:a flac $audio
  if ($LASTEXITCODE -ne 0) { Fail 2 "Lecture de la vidéo impossible (fichier abîmé ?)." }
  $mo = [Math]::Round((New-Object IO.FileInfo $audio).Length / 1MB, 1)
  Say "Envoi du son au serveur ($mo Mo)…"
  $name = [Uri]::EscapeDataString([IO.Path]::GetFileName($video))
  $r = Call @("-X", "POST", "-H", "X-Filename: $name", "--data-binary", "@$audio", "$API/transcriptions") 600
  [IO.File]::Delete($audio)
  if ($r.Status -ne 202) { Fail 5 ("ENVOI_REFUSÉ : " + (Err $r)) }
  $id = (Json $r.Body).id
  $info.id = $id
  WriteText ([IO.Path]::Combine($w, "info.json")) ($info | ConvertTo-Json)
  Cmd-Suivre $w
}

function Cmd-Suivre($w) {
  $info = ReadText ([IO.Path]::Combine($w, "info.json")) | ConvertFrom-Json
  $start = Get-Date; $last = ""
  while ($true) {
    $r = Call @("$API/transcriptions/$($info.id)")
    if ($r.Status -ne 200) { Fail 5 ("ERREUR : " + (Err $r)) }
    $j = Json $r.Body
    if ($j.etape -and $j.etape -ne $last) { Say "… $($j.etape)"; $last = $j.etape }
    if ($j.etat -eq "fini") { break }
    if ($j.etat -eq "erreur") { Fail 5 "ERREUR_TRANSCRIPTION : $($j.message)" }
    if (((Get-Date) - $start).TotalSeconds -gt 540) { Fail 10 "PAS_FINI : relance « couper.ps1 suivre `"$w`" »" }
    Start-Sleep -Seconds 4
  }
  # Le transcript : JSON brut du serveur, écrit tel quel (aucune ré-sérialisation qui l'abîmerait)
  WriteText ([IO.Path]::Combine($w, "draft.md")) $j.draft
  WriteText ([IO.Path]::Combine($w, "words.json")) ($j.words | ConvertTo-Json -Depth 6 -Compress)
  Say "PRÊT dossier=$w"
  Say ("Lis " + [IO.Path]::Combine($w, "draft.md") + ", décide les coupes, écris " + [IO.Path]::Combine($w, "cuts.json") + ", puis lance : couper.ps1 compiler `"$w`"")
}

function Cmd-Compiler($w, $rythme) {
  if (-not $rythme) { $rythme = "serre" }
  $info = ReadText ([IO.Path]::Combine($w, "info.json")) | ConvertFrom-Json
  $cutsPath = [IO.Path]::Combine($w, "cuts.json")
  if (-not (Exists $cutsPath)) { Fail 2 "cuts.json manquant dans $w" }
  $cuts = ReadText $cutsPath | ConvertFrom-Json
  $body = @{ cuts = @($cuts.cuts); holds = @($cuts.holds | Where-Object { $_ }); fps = $info.fps; rythme = $rythme }
  if ($cuts.force) { $body.force = $true }
  $tmp = [IO.Path]::Combine($w, "requete.json")
  WriteText $tmp ($body | ConvertTo-Json -Depth 5 -Compress)
  $r = Call @("-X", "POST", "-H", "Content-Type: application/json", "--data-binary", "@$tmp", "$API/transcriptions/$($info.id)/coupes")
  [IO.File]::Delete($tmp)
  $j = Json $r.Body
  if ($r.Status -eq 422) { Say $j.sortie; Fail 8 "COUPES_REFUSÉES : corrige cuts.json (un passage gardé doit faire au moins 0,3 s) et relance." }
  if ($r.Status -ne 200) { Fail 5 ("ERREUR : " + (Err $r)) }
  WriteText ([IO.Path]::Combine($w, "edl.json")) ($j.edl | ConvertTo-Json -Depth 8)
  WriteText ([IO.Path]::Combine($w, "words.cut.json")) ($j.words_cut | ConvertTo-Json -Depth 6 -Compress)
  WriteText ([IO.Path]::Combine($w, "filtre.txt")) $j.filtre
  WriteText ([IO.Path]::Combine($w, "discours.txt")) $j.sortie
  Say $j.sortie
  Say ""
  Say ("COMPILÉ : {0} morceaux, {1} s gardées (rythme {2}). Relis chaque jointure « // », puis lance : couper.ps1 rendre `"{3}`"" -f $j.edl.stats.segments, $j.edl.stats.out_duration_s, $rythme, $w)
}

function Cmd-Rendre($w) {
  $info = ReadText ([IO.Path]::Combine($w, "info.json")) | ConvertFrom-Json
  $filtre = [IO.Path]::Combine($w, "filtre.txt")
  if (-not (Exists $filtre)) { Fail 2 "Lance d'abord : couper.ps1 compiler `"$w`"" }
  $ffmpeg = Tool "ffmpeg"
  $dir = [IO.Path]::GetDirectoryName($info.video); $base = [IO.Path]::GetFileNameWithoutExtension($info.video)
  $out = [IO.Path]::Combine($dir, "$base-coupe.mp4")
  $n = 2
  while (Exists $out) { $out = [IO.Path]::Combine($dir, "$base-coupe-$n.mp4"); $n++ }
  if ($info.hdr) {   # HDR de l'iPhone : on reste en HEVC 10 bits avec ses métadonnées, sinon les couleurs se délavent
    $enc = @("-c:v", "libx265", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p10le", "-tag:v", "hvc1",
             "-color_primaries", $info.color_primaries, "-color_trc", $info.color_transfer, "-colorspace", $info.color_space)
  } else {
    $enc = @("-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p")
  }
  Say "Découpe de la vidéo en qualité d'origine ($($info.largeur)x$($info.hauteur))…"
  $t0 = Get-Date
  & $ffmpeg -nostdin -v error -y -i $info.video "-/filter_complex" $filtre -map "[v]" -map "[a]" @enc -c:a aac -b:a 320k -movflags +faststart $out
  if ($LASTEXITCODE -ne 0) { Fail 5 "La découpe a échoué (ffmpeg code $LASTEXITCODE)." }
  $s = [Math]::Round(((Get-Date) - $t0).TotalSeconds)
  Say "PRÊT $out (découpe en $s s)"
  try { Start-Process -FilePath $out } catch { }
}

switch ($Commande) {
  "code" { Cmd-Code $Arg1 }
  "transcrire" { Cmd-Transcrire $Arg1 }
  "suivre" { Cmd-Suivre $Arg1 }
  "compiler" { Cmd-Compiler $Arg1 $Arg2 }
  "rendre" { Cmd-Rendre $Arg1 }
  default { Say "Usage : couper.ps1 code <code> | transcrire <vidéo> | compiler <dossier> [rythme] | rendre <dossier>"; exit 1 }
}
