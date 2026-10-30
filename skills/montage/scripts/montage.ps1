# Rendu final d'une vidéo montée (Windows, PowerShell 5.1 et plus).
# Un seul encodage, toujours depuis la vidéo d'origine : on applique dans le même passage les couches demandées,
# préparées à l'avance par les briques dans <nom>-montage\ :
#   coupes       filtre.txt       (skill couper-silences)
#   zooms        zooms.txt        (skill zooms)
#   b-roll       b-roll.txt       (skill b-roll), posés après les zooms : un B-roll n'est pas zoomé
#   sous-titres  sous-titres.ass  (skill sous-titres), posés en dernier : ni zoomés, ni cachés par un B-roll
#
#   montage.ps1 rendre <dossier> <couches>   ex. : rendre "C:\...\IMG_2180-montage" coupes,zooms,b-roll,sous-titres
#
# Codes de sortie : 0 ok · 2 couche ou fichier manquant · 5 rendu raté · 7 outil vidéo impossible à installer
param([string]$Commande, [string]$Arg1, [string]$Arg2)
$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ProgressPreference = "SilentlyContinue"

$Skill = Split-Path -Parent $PSScriptRoot
$UserHome = $env:USERPROFILE; if (-not $UserHome) { $UserHome = $HOME }   # $HOME : tests sur Mac (pwsh)
$HomeDir = Join-Path $UserHome ".montage-yoan"
$Bin = Join-Path $HomeDir "bin"
$Curl = "curl.exe"; if (-not (Get-Command curl.exe -ErrorAction SilentlyContinue)) { $Curl = "curl" }
New-Item -ItemType Directory -Force -Path $Bin | Out-Null

function Say($m) { Write-Output $m }
$Utf8 = New-Object System.Text.UTF8Encoding $false
function WriteText($path, $text) { [IO.File]::WriteAllText($path, $text, $Utf8) }
function ReadText($path) { return [IO.File]::ReadAllText($path, $Utf8) }
function Exists($path) { return [IO.File]::Exists($path) }
function Fail($code, $m) { Write-Output $m; exit $code }

# Version autonome de gyan.dev (« essentials », avec libass pour les sous-titres), posée une fois dans ~/.montage-yoan/bin
function Gyan($name) {
  $exe = Join-Path $Bin "$name.exe"
  if (-not (Exists $exe)) {
    Say "Installation de l'outil vidéo (une seule fois, 1 à 2 minutes)…"
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
# ffmpeg de la machine s'il sait faire ce qu'on lui demande, sinon la version autonome.
# Les sous-titres demandent libass, absent de certaines installations.
function FFmpeg($besoinAss) {
  if ($env:MONTAGE_FFMPEG -and (Exists $env:MONTAGE_FFMPEG)) { return $env:MONTAGE_FFMPEG }   # tests
  $sys = Get-Command "ffmpeg.exe", "ffmpeg" -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($sys) {
    if (-not $besoinAss) { return $sys.Source }
    $f = (& $sys.Source -hide_banner -filters 2>$null) -join "`n"
    if ($f -match "\sass\s") { return $sys.Source }
  }
  $local = Join-Path $Bin "ffmpeg.exe"
  if (Exists $local) {
    $f = (& $local -hide_banner -filters 2>$null) -join "`n"
    if ((-not $besoinAss) -or $f -match "\sass\s") { return $local }
  }
  return (Gyan "ffmpeg")
}

function Cmd-Rendre($w, $couches) {
  if (-not $w -or -not $couches) { Fail 2 "Usage : montage.ps1 rendre <dossier> <couches> (ex. coupes,zooms,b-roll,sous-titres)" }
  $w = [IO.Path]::GetFullPath($w)
  $infoPath = [IO.Path]::Combine($w, "info.json")
  if (-not (Exists $infoPath)) { Fail 2 "DOSSIER_INCONNU : $w n'est pas un dossier de montage (lance d'abord couper-silences)." }
  $info = ReadText $infoPath | ConvertFrom-Json
  if (-not (Exists $info.video)) { Fail 2 "VIDÉO_INTROUVABLE : $($info.video) (la vidéo d'origine a été déplacée ?)" }

  $liste = @($couches.ToLower() -split "[,; ]+" | Where-Object { $_ })
  foreach ($c in $liste) { if (@("coupes", "zooms", "b-roll", "sous-titres") -notcontains $c) { Fail 2 "COUCHE_INCONNUE : $c (couches possibles : coupes, zooms, b-roll, sous-titres)" } }
  $liste = @("coupes", "zooms", "b-roll", "sous-titres" | Where-Object { $liste -contains $_ })
  $sousTitres = $liste -contains "sous-titres"

  # Coupes : toujours là pour l'instant, les sous-titres sont calés sur la vidéo coupée
  $filtrePath = [IO.Path]::Combine($w, "filtre.txt")
  if (-not ($liste -contains "coupes") -or -not (Exists $filtrePath)) { Fail 2 "COUCHE_MANQUANTE coupes : passe d'abord par couper-silences (les autres couches se calent sur la vidéo coupée)." }
  $graphe = (ReadText $filtrePath).TrimEnd()
  $sortieV = "[v]"
  # L'ordre des couches ne dépend pas de la demande : coupes, puis zooms, puis B-rolls, puis sous-titres
  if ($liste -contains "zooms") {
    $zoomsPath = [IO.Path]::Combine($w, "zooms.txt")
    if (-not (Exists $zoomsPath)) { Fail 2 "COUCHE_MANQUANTE zooms : lance d'abord le skill zooms (preparer)." }
    $graphe += ";`n[v]" + (ReadText $zoomsPath).Trim() + "[vz]"
    $sortieV = "[vz]"
  }
  $entrees = @()
  if ($liste -contains "b-roll") {
    $brollPath = [IO.Path]::Combine($w, "b-roll.txt")
    if (-not (Exists $brollPath)) { Fail 2 "COUCHE_MANQUANTE b-roll : lance d'abord le skill b-roll (preparer)." }
    foreach ($l in ((ReadText $brollPath) -split "`n")) {
      $c = $l.TrimEnd("`r").Split("`t")
      # chaque clip n'est lu que sur sa durée à l'écran (plus une marge), à partir de son départ
      if ($c[0] -eq "ENTREE") { $entrees += @("-ss", $c[1], "-t", ([double]::Parse($c[2], [Globalization.CultureInfo]::InvariantCulture) + 0.5).ToString([Globalization.CultureInfo]::InvariantCulture), "-i", $c[3]) }
      elseif ($c[0] -eq "FILTRE") { $graphe += ";`n" + $c[1].Replace("[ENTREE]", $sortieV).Replace("[SORTIE]", "[vb]"); $sortieV = "[vb]" }
    }
  }
  if ($sousTitres) {
    if (-not (Exists ([IO.Path]::Combine($w, "sous-titres.ass")))) { Fail 2 "COUCHE_MANQUANTE sous-titres : lance d'abord le skill sous-titres (preparer)." }
    # Chemins relatifs au dossier de travail : pas d'échappement des « C:\ » dans le filtre
    $polices = [IO.Path]::Combine($w, "polices")
    [IO.Directory]::CreateDirectory($polices) | Out-Null
    # Polices des sous-titres (.otf) et des titres à l'écran (.ttf)
    foreach ($f in Get-ChildItem -Path (Join-Path $Skill "assets\fonts") | Where-Object { $_.Extension -in ".otf", ".ttf" }) { [IO.File]::Copy($f.FullName, [IO.Path]::Combine($polices, $f.Name), $true) }
    $graphe += ";`n$($sortieV)ass=sous-titres.ass:fontsdir=polices[vs]"
    $sortieV = "[vs]"
  }
  $graphePath = [IO.Path]::Combine($w, "rendu-filtre.txt")
  WriteText $graphePath $graphe

  $ffmpeg = FFmpeg $sousTitres
  $dir = [IO.Path]::GetDirectoryName($info.video); $base = [IO.Path]::GetFileNameWithoutExtension($info.video)
  $suffixe = if ($liste.Count -eq 1) { "coupe" } else { "monte" }
  $out = [IO.Path]::Combine($dir, "$base-$suffixe.mp4")
  $n = 2
  while (Exists $out) { $out = [IO.Path]::Combine($dir, "$base-$suffixe-$n.mp4"); $n++ }
  if ($info.hdr) {   # HDR de l'iPhone : on reste en HEVC 10 bits avec ses métadonnées, sinon les couleurs se délavent
    $enc = @("-c:v", "libx265", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p10le", "-tag:v", "hvc1",
             "-color_primaries", $info.color_primaries, "-color_trc", $info.color_transfer, "-colorspace", $info.color_space)
  } else {
    $enc = @("-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p")
  }
  Say "Fabrication de la vidéo en qualité d'origine ($($info.largeur)x$($info.hauteur)), couches : $($liste -join ', ')…"
  $t0 = Get-Date
  Push-Location -LiteralPath $w
  [Environment]::CurrentDirectory = $w
  & $ffmpeg -nostdin -v error -y -i $info.video @entrees "-/filter_complex" "rendu-filtre.txt" -map $sortieV -map "[a]" @enc -c:a aac -b:a 320k -movflags +faststart $out
  $code = $LASTEXITCODE
  Pop-Location
  if ($code -ne 0) { Fail 5 "Le rendu a échoué (ffmpeg code $code)." }
  $s = [Math]::Round(((Get-Date) - $t0).TotalSeconds)
  Say "PRÊT $out (rendu en $s s)"
  if ($env:OS -eq "Windows_NT") { try { Start-Process -FilePath $out } catch { } }
}

switch ($Commande) {
  "rendre" { Cmd-Rendre $Arg1 $Arg2 }
  default { Say "Usage : montage.ps1 rendre <dossier> <couches>"; exit 1 }
}
