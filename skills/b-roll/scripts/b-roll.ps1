# Préparer les B-rolls d'une vidéo coupée par couper-silences (Windows, PowerShell 5.1 et plus).
# Chaque B-roll est posé par ses mots (numéros de words.cut.json), jamais par un minutage : le clip couvre l'image
# pendant que sa voix continue. Rien ne part sur le serveur. La vidéo n'est fabriquée que par le skill montage,
# en un seul rendu depuis l'original (le clip est mis au cadre, à la cadence et au sens de la vidéo dans ce rendu).
#
#   b-roll.ps1 vignettes <dossier des clips>   une image par clip dans b-roll-vignettes\ (pour savoir lequel montre quoi)
#   b-roll.ps1 texte <dossier>                 écrit texte-numerote.md : le texte, chaque mot précédé de son numéro
#   b-roll.ps1 preparer <dossier>              lit b-roll.json, écrit b-roll.txt (la couche pour le rendu)
#
# Codes de sortie : 0 ok · 2 fichier introuvable · 7 outil vidéo impossible à installer · 13 b-roll.json illisible
param([string]$Commande, [string]$Arg1)
$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ProgressPreference = "SilentlyContinue"

$UserHome = $env:USERPROFILE; if (-not $UserHome) { $UserHome = $HOME }   # $HOME : tests sur Mac (pwsh)
$HomeDir = Join-Path $UserHome ".montage-yoan"
$Curl = "curl.exe"; if (-not (Get-Command curl.exe -ErrorAction SilentlyContinue)) { $Curl = "curl" }
$Bin = Join-Path $HomeDir "bin"
New-Item -ItemType Directory -Force -Path $Bin | Out-Null

$Videos = @(".mov", ".mp4", ".m4v", ".avi", ".mkv", ".hevc")
$Avance = 0.04   # le clip arrive une image avant le mot : il tombe pile quand le mot commence

function Say($m) { Write-Output $m }
# Fichiers lus et écrits sans interprétation des crochets (« Rush [1].MOV ») et en UTF-8 sans BOM
$Utf8 = New-Object System.Text.UTF8Encoding $false
function WriteText($path, $text) { [IO.File]::WriteAllText($path, $text, $Utf8) }
function ReadText($path) { return [IO.File]::ReadAllText($path, $Utf8) }
function Exists($path) { return [IO.File]::Exists($path) }
function Fail($code, $m) { Write-Output $m; exit $code }
function Num($x) { return ([double]$x).ToString("0.####", [Globalization.CultureInfo]::InvariantCulture) }

function Tool($name) {
  if ($env:MONTAGE_FFMPEG -and (Exists $env:MONTAGE_FFMPEG)) {   # tests
    $t = Join-Path (Split-Path -Parent $env:MONTAGE_FFMPEG) $name
    if (Exists $t) { return $t }
  }
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

function Words($w) {
  $p = [IO.Path]::Combine($w, "words.cut.json")
  if (-not (Exists $p)) { Fail 2 "TEXTE_INTROUVABLE : lance d'abord le skill couper-silences sur cette vidéo (il manque words.cut.json dans $w)." }
  return @((ReadText $p | ConvertFrom-Json).words)
}

# Durée d'un clip en secondes (images comptées / cadence : la durée du conteneur omet la dernière image)
function Duree($ffprobe, $f) {
  $j = (& $ffprobe -v error -select_streams v:0 -count_packets -show_entries stream=nb_read_packets,r_frame_rate,duration -of json $f) -join "" | ConvertFrom-Json
  $s = $j.streams[0]
  $r = ([string]$s.r_frame_rate).Split("/"); $fps = [double]$r[0] / [Math]::Max(1, [double]$r[1])
  if ($s.nb_read_packets -and $fps -gt 0) { return [double]$s.nb_read_packets / $fps }
  return [double]$s.duration
}

function Cmd-Vignettes($d) {
  if (-not $d) { Fail 2 "Usage : b-roll.ps1 vignettes <dossier des clips>" }
  $d = [IO.Path]::GetFullPath($d)
  if (-not [IO.Directory]::Exists($d)) { Fail 2 "DOSSIER_INTROUVABLE : $d" }
  $ffmpeg = Tool "ffmpeg"; $ffprobe = Tool "ffprobe"
  $out = [IO.Path]::Combine($d, "b-roll-vignettes")
  [IO.Directory]::CreateDirectory($out) | Out-Null
  $n = 0
  foreach ($f in [IO.Directory]::GetFiles($d)) {
    if ($Videos -notcontains [IO.Path]::GetExtension($f).ToLower()) { continue }
    $n++
    $len = Duree $ffprobe $f
    $img = [IO.Path]::Combine($out, [IO.Path]::GetFileNameWithoutExtension($f) + ".jpg")
    # trois moments du clip côte à côte : début, milieu, fin
    $t = @(0.2, ($len / 2), [Math]::Max(0, $len - 0.3)) | ForEach-Object { Num $_ }
    & $ffmpeg -nostdin -v error -y -ss $t[0] -i $f -ss $t[1] -i $f -ss $t[2] -i $f -filter_complex "[0:v]scale=-2:360[a];[1:v]scale=-2:360[b];[2:v]scale=-2:360[c];[a][b][c]hstack=3,format=yuvj420p" -frames:v 1 -q:v 4 $img
    Say ("  {0} : {1} s -> {2}" -f [IO.Path]::GetFileName($f), (Num ([Math]::Round($len, 1))), $img)
  }
  if ($n -eq 0) { Fail 2 "AUCUN_CLIP : pas de vidéo dans $d." }
  Say "PRÊT clips=$n vignettes=$out"
}

function Cmd-Texte($w) {
  if (-not $w) { Fail 2 "Usage : b-roll.ps1 texte <dossier>" }
  $w = [IO.Path]::GetFullPath($w)
  $words = Words $w
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.AppendLine("# Texte de la vidéo coupée, chaque mot précédé de son numéro")
  [void]$sb.AppendLine("")
  $line = @()
  for ($i = 0; $i -lt $words.Count; $i++) {
    $t = [string]$words[$i].text
    if (-not $t.Trim()) { continue }
    $line += "[$i]$t"
    if ($t.Trim() -match "[.!?…]$") { [void]$sb.AppendLine(($line -join " ")); $line = @() }
  }
  if ($line.Count) { [void]$sb.AppendLine(($line -join " ")) }
  $out = [IO.Path]::Combine($w, "texte-numerote.md")
  WriteText $out $sb.ToString()
  Say "PRÊT texte=$out mots=$($words.Count)"
}

function Cmd-Preparer($w) {
  if (-not $w) { Fail 2 "Usage : b-roll.ps1 preparer <dossier>" }
  $w = [IO.Path]::GetFullPath($w)
  $info = ReadText ([IO.Path]::Combine($w, "info.json")) | ConvertFrom-Json
  $words = Words $w
  $fps = [int]$info.fps
  $edlPath = [IO.Path]::Combine($w, "edl.json")
  if (-not (Exists $edlPath)) { Fail 2 "COUPES_INTROUVABLES : lance d'abord le skill couper-silences (compiler) sur cette vidéo." }
  $segs = @((ReadText $edlPath | ConvertFrom-Json).segments)
  $total = [double]$segs[-1].outOutF / $fps

  $bp = [IO.Path]::Combine($w, "b-roll.json")
  if (-not (Exists $bp)) { Fail 2 "B-ROLL_INTROUVABLE : écris d'abord b-roll.json dans $w." }
  try { $plan = ReadText $bp | ConvertFrom-Json } catch { Fail 13 ("B-ROLL_ILLISIBLE : " + $_.Exception.Message) }
  $liste = @($plan.brolls | Where-Object { $_ })
  if ($liste.Count -eq 0) { Fail 13 "B-ROLL_ILLISIBLE : aucun B-roll dans b-roll.json (retire plutôt la couche b-roll du rendu)." }

  $ffprobe = Tool "ffprobe"
  $poses = @(); $n = 0
  foreach ($b in $liste) {
    $n++
    $f = [string]$b.fichier
    if (-not $f -or -not (Exists $f)) { Fail 13 "B-ROLL_ILLISIBLE : B-roll n°$n, fichier introuvable : $f" }
    $a = [int]$b.debut
    if ($a -lt 0 -or $a -ge $words.Count) { Fail 13 "B-ROLL_ILLISIBLE : B-roll n°$n, mot n°$a inexistant (0 à $($words.Count - 1))." }
    # Sans fin : jusqu'au bout de la phrase où il commence
    $z = $a
    if ($null -ne $b.fin) { $z = [int]$b.fin } else { while ($z -lt $words.Count - 1 -and ([string]$words[$z].text).Trim() -notmatch "[.!?…]$") { $z++ } }
    if ($z -lt $a -or $z -ge $words.Count) { Fail 13 "B-ROLL_ILLISIBLE : B-roll n°$n, mots $a à $z invalides (début avant fin)." }
    $depart = if ($null -ne $b.depart) { [double]$b.depart } else { 0.0 }
    $t0 = [Math]::Max(0.0, [double]$words[$a].start - $Avance)
    $t1 = [Math]::Min($total, [double]$words[$z].end)
    $len = Duree $ffprobe $f
    if ($depart -lt 0 -or $depart -ge $len - 0.3) { Fail 13 "B-ROLL_ILLISIBLE : B-roll n°$n, départ $depart s hors du clip ($(Num ([Math]::Round($len, 1))) s)." }
    $court = $false
    if ($t1 - $t0 -gt $len - $depart) { $t1 = $t0 + $len - $depart; $court = $true }   # clip trop court : on revient sur lui plus tôt
    if ($t1 - $t0 -lt 0.5) { Fail 13 "B-ROLL_ILLISIBLE : B-roll n°$n trop court à l'écran (moins d'une demi-seconde)." }
    $phrase = (@($a..$z | ForEach-Object { [string]$words[$_].text }) -join " ").Trim()
    $poses += [pscustomobject]@{ n = $n; f = $f; t0 = $t0; t1 = $t1; depart = $depart; court = $court; phrase = $phrase }
  }
  $poses = @($poses | Sort-Object t0)
  for ($i = 1; $i -lt $poses.Count; $i++) {
    if ($poses[$i].t0 -lt $poses[$i - 1].t1 - 0.001) { Fail 13 "B-ROLL_ILLISIBLE : les B-rolls n°$($poses[$i - 1].n) et n°$($poses[$i].n) se chevauchent." }
  }

  # La couche : un clip par entrée du rendu (entrées 1, 2… après la vidéo d'origine), recadré plein cadre,
  # à la cadence de la vidéo, décalé à son moment, posé par-dessus l'image. Son son à lui n'est pas gardé.
  $L = [int]$info.largeur; $Ht = [int]$info.hauteur
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.AppendLine("# entrées (une par ligne : départ, durée, fichier), puis le filtre")
  foreach ($p in $poses) { [void]$sb.AppendLine("ENTREE`t$(Num $p.depart)`t$(Num ($p.t1 - $p.t0))`t$($p.f)") }
  $cur = "[ENTREE]"; $k = 0
  $parts = @()
  foreach ($p in $poses) {
    $k++
    $out = if ($k -eq $poses.Count) { "[SORTIE]" } else { "[bo$k]" }
    $parts += "[${k}:v]fps=$fps,scale=${L}:${Ht}:force_original_aspect_ratio=increase:flags=lanczos,crop=${L}:${Ht},setsar=1,setpts=PTS-STARTPTS+$(Num $p.t0)/TB[bc$k]"
    $parts += "$cur[bc$k]overlay=eof_action=pass:repeatlast=0:enable='between(t,$(Num $p.t0),$(Num ($p.t1 - 0.001)))'$out"
    $cur = "[bo$k]"
  }
  [void]$sb.AppendLine("FILTRE`t" + ($parts -join ";"))
  WriteText ([IO.Path]::Combine($w, "b-roll.txt")) $sb.ToString()

  Say "PRÊT brolls=$($poses.Count)"
  foreach ($p in $poses) {
    $msg = "  n°{0} {1}s à {2}s : {3} sur « {4} »" -f $p.n, (Num ([Math]::Round($p.t0, 1))), (Num ([Math]::Round($p.t1, 1))), [IO.Path]::GetFileName($p.f), $p.phrase
    if ($p.court) { $msg += " (clip plus court que la phrase : retour sur lui plus tôt)" }
    Say $msg
  }
}

switch ($Commande) {
  "vignettes" { Cmd-Vignettes $Arg1 }
  "texte" { Cmd-Texte $Arg1 }
  "preparer" { Cmd-Preparer $Arg1 }
  default { Say "Usage : b-roll.ps1 vignettes <dossier des clips> | texte <dossier> | preparer <dossier>"; exit 1 }
}
