# Mettre en page un carrousel Instagram @fitavecromain (Windows, PowerShell 5.1 et plus).
# Le texte et les photos viennent de l'utilisateur ; ce script ne fait que la mise en page et l'export.
# Tout se passe sur l'ordinateur : rien ne part sur un serveur.
#
#   carrousel.ps1 rendre <dossier> [numéro]   lit <dossier>\carrousel.json, fabrique slide-01.png, slide-02.png…
#                                             et planche.jpg (toutes les slides en petit). [numéro] : une seule slide.
#
# Codes de sortie : 0 ok · 2 fichier introuvable · 3 carrousel.json illisible · 7 outil vidéo impossible à installer
#                   9 navigateur introuvable · 11 photo illisible · 12 export d'une slide raté
param([string]$Commande, [string]$Arg1, [string]$Arg2)
$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ProgressPreference = "SilentlyContinue"

$Skill = Split-Path -Parent $PSScriptRoot
$Assets = Join-Path $Skill "assets"
$UserHome = $env:USERPROFILE; if (-not $UserHome) { $UserHome = $HOME }   # $HOME : tests sur Mac (pwsh)
$HomeDir = Join-Path $UserHome ".montage-yoan"
$Bin = Join-Path $HomeDir "bin"
$Curl = "curl.exe"; if (-not (Get-Command curl.exe -ErrorAction SilentlyContinue)) { $Curl = "curl" }
New-Item -ItemType Directory -Force -Path $Bin | Out-Null

function Say($m) { Write-Output $m }
# Fichiers lus et écrits sans interprétation des crochets et en UTF-8 sans BOM
$Utf8 = New-Object System.Text.UTF8Encoding $false
function WriteText($path, $text) { [IO.File]::WriteAllText($path, $text, $Utf8) }
function ReadText($path) { return [IO.File]::ReadAllText($path, $Utf8) }
function Exists($path) { return [IO.File]::Exists($path) }
function Fail($code, $m) { Write-Output $m; exit $code }

# ffmpeg : celui de la machine s'il existe, sinon la version autonome posée par couper-silences (ou installée ici)
function Tool($name) {
  $sys = Get-Command "$name.exe", $name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($sys) { return $sys.Source }
  $exe = Join-Path $Bin "$name.exe"
  if (-not (Exists $exe)) {
    Say "Première utilisation : installation de l'outil photo et vidéo (une seule fois, 1 à 2 minutes)…"
    $zip = Join-Path $HomeDir "ffmpeg.zip"; $tmp = Join-Path $HomeDir "ffx"
    & $Curl -sSL --fail "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" -o $zip
    if ($LASTEXITCODE -ne 0) { Fail 7 "Téléchargement de l'outil impossible." }
    Expand-Archive -Force -Path $zip -DestinationPath $tmp
    foreach ($n in "ffmpeg", "ffprobe") {
      Copy-Item (Get-ChildItem -Path $tmp -Recurse -Filter "$n.exe" | Select-Object -First 1).FullName (Join-Path $Bin "$n.exe")
    }
    Remove-Item -Recurse -Force $tmp, $zip
    if (-not (Exists $exe)) { Fail 7 "Installation de l'outil impossible." }
  }
  return $exe
}

# Le navigateur qui photographie chaque slide : Edge (présent sur tout Windows), sinon Chrome
function Browser {
  $c = @()
  foreach ($base in ${env:ProgramFiles(x86)}, $env:ProgramFiles, $env:LOCALAPPDATA) {
    if ($base) { $c += (Join-Path $base "Microsoft\Edge\Application\msedge.exe"), (Join-Path $base "Google\Chrome\Application\chrome.exe") }
  }
  $c += "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  foreach ($p in $c) { if ($p -and (Exists $p)) { return $p } }
  Fail 9 "NAVIGATEUR_INTROUVABLE : ni Edge ni Chrome sur cet ordinateur."
}

# Le navigateur photographie une fenêtre plus haute que la slide, puis on recadre à la bonne hauteur :
# sans cette marge, il lui arrive de rendre une page plus courte que la fenêtre (bande noire en bas).
function Shoot($browser, $html, $png, $hauteur) {
  $brut = $png + ".brut.png"
  if (-not (Shoot-Brut $browser $html $brut ($hauteur + 200))) { return $false }
  $ffmpeg = Tool "ffmpeg"
  & $ffmpeg -nostdin -v error -y -i $brut -vf "crop=1080:${hauteur}:0:0" $png
  [IO.File]::Delete($brut)
  return (Exists $png)
}

function Shoot-Brut($browser, $html, $png, $hauteur) {
  $profil = $script:Profil
  $url = ([Uri]$html).AbsoluteUri
  if ($html.StartsWith("/")) { $url = ([Uri]("file://" + $html)).AbsoluteUri }   # tests sur Mac
  $a = @("--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
         "--disable-extensions", "--allow-file-access-from-files", "--force-device-scale-factor=1",
         "--user-data-dir=$profil", "--window-size=1080,$hauteur", "--virtual-time-budget=4000", "--screenshot=$png", $url)
  $argLine = ($a | ForEach-Object { '"' + $_ + '"' }) -join " "
  for ($essai = 1; $essai -le 2; $essai++) {
    if (Exists $png) { [IO.File]::Delete($png) }
    $opt = @{}; if ($env:OS -eq "Windows_NT") { $opt.WindowStyle = "Hidden" }
    $log = $script:Profil + ".log"
    $p = Start-Process -FilePath $browser -ArgumentList $argLine -PassThru -RedirectStandardError $log @opt
    if (-not $p.WaitForExit(60000)) { try { $p.Kill() } catch {} }
    for ($i = 0; $i -lt 20 -and -not (Exists $png); $i++) { Start-Sleep -Milliseconds 250 }
    if (Exists $png) { return $true }
  }
  return $false
}

# Copie une photo dans le dossier de rendu, en JPEG si elle vient d'un iPhone (HEIC). Rend son nom dans ce dossier.
function Photo($src, $nom, $i) {
  if (-not [IO.Path]::IsPathRooted($src)) { $src = [IO.Path]::Combine($dossier, $src) }
  if (-not (Exists $src)) { Fail 2 "PHOTO_INTROUVABLE (slide $i) : $src" }
  $ext = [IO.Path]::GetExtension($src).ToLower()
  if (@(".heic", ".heif") -contains $ext) {
    $dst = [IO.Path]::Combine($w, "$nom.jpg")
    $ffmpeg = Tool "ffmpeg"
    & $ffmpeg -nostdin -v error -y -i $src -frames:v 1 -q:v 2 $dst
    if ($LASTEXITCODE -ne 0 -or -not (Exists $dst)) { Fail 11 "PHOTO_ILLISIBLE (slide $i) : $src. Demande la photo en JPEG." }
  } elseif (@(".jpg", ".jpeg", ".png", ".webp") -contains $ext) {
    $dst = [IO.Path]::Combine($w, "$nom$ext")
    [IO.File]::Copy($src, $dst, $true)
  } else { Fail 11 "PHOTO_ILLISIBLE (slide $i) : format $ext non pris en charge. Demande une photo JPEG, PNG ou HEIC." }
  return [IO.Path]::GetFileName($dst)
}

function Cmd-Rendre($dossier, $seule) {
  if (-not $dossier) { Fail 2 "Usage : carrousel.ps1 rendre <dossier> [numéro]" }
  $dossier = [IO.Path]::GetFullPath($dossier)
  $jsonPath = [IO.Path]::Combine($dossier, "carrousel.json")
  if (-not (Exists $jsonPath)) { Fail 2 "CARROUSEL_INTROUVABLE : $jsonPath" }
  try { $c = (ReadText $jsonPath) | ConvertFrom-Json } catch { Fail 3 ("CARROUSEL_ILLISIBLE : " + $_.Exception.Message) }
  $slides = @($c.slides)
  if ($slides.Count -eq 0) { Fail 3 "CARROUSEL_ILLISIBLE : aucune slide dans carrousel.json." }
  $total = $slides.Count
  $pied = $true; if ($c.PSObject.Properties["pied"] -and $c.pied -eq $false) { $pied = $false }
  $style = "affiche"; if ($c.style) { $style = [string]$c.style }
  $hauteur = 1350; if ($c.format -eq "3:4") { $hauteur = 1440 }

  # Dossier de travail : gabarit, polices, logo et photos prêtes à lire par le navigateur
  $w = [IO.Path]::Combine($dossier, "_rendu")
  [IO.Directory]::CreateDirectory($w) | Out-Null
  foreach ($f in Get-ChildItem -Path (Join-Path $Assets "fonts") -Filter "*.ttf") { [IO.File]::Copy($f.FullName, [IO.Path]::Combine($w, $f.Name), $true) }
  [IO.File]::Copy((Join-Path $Assets "logo.png"), [IO.Path]::Combine($w, "logo.png"), $true)
  [IO.File]::Copy((Join-Path $Assets "avatar.jpg"), [IO.Path]::Combine($w, "avatar.jpg"), $true)   # sa photo de profil, pour le style tweet
  $gabarit = ReadText (Join-Path $Assets "slide.html")
  $browser = Browser
  # Un profil de navigateur par rendu : deux carrousels rendus en même temps ne se bloquent pas
  $script:Profil = Join-Path $HomeDir ("navigateur-carrousel-" + $PID)

  $a = 1; $b = $total
  if ($seule) {
    $n = 0
    if (-not [int]::TryParse($seule, [ref]$n) -or $n -lt 1 -or $n -gt $total) { Fail 2 "Numéro de slide hors carrousel : $seule (1 à $total)." }
    $a = $n; $b = $n
  } else {
    # Les slides d'un rendu précédent plus long ne doivent pas traîner
    foreach ($f in Get-ChildItem -Path $dossier -Filter "slide-*.png") { [IO.File]::Delete($f.FullName) }
  }

  for ($i = $a; $i -le $b; $i++) {
    $s = $slides[$i - 1]
    $nn = "{0:D2}" -f $i
    $d = [ordered]@{}
    foreach ($p in $s.PSObject.Properties) { $d[$p.Name] = $p.Value }
    $d.numero = $i; $d.total = $total
    if (-not $d.Contains("pied")) { $d.pied = $pied }
    if (-not $d.Contains("style")) { $d.style = $style }
    # Style tweet : photo de profil, nom et @ communs à tout le carrousel
    foreach ($k in "avatar", "nom", "pseudo") { if (-not $d.Contains($k) -and $c.$k) { $d[$k] = $c.$k } }
    $d.hauteur = $hauteur

    if ($s.photo) { $d.photo = Photo ([string]$s.photo) "photo-$nn" $i }
    if ($d.avatar) { $d.avatar = Photo ([string]$d.avatar) "avatar-$nn" $i }

    $html = [IO.Path]::Combine($w, "slide-$nn.html")
    WriteText $html ($gabarit.Replace("/*SLIDE*/", "window.SLIDE = " + ($d | ConvertTo-Json -Depth 5 -Compress) + ";"))
    $png = [IO.Path]::Combine($dossier, "slide-$nn.png")
    Say "Slide $i / $total…"
    if (-not (Shoot $browser $html $png $hauteur)) { Fail 12 "EXPORT_RATÉ (slide $i) : le navigateur n'a pas produit l'image." }
  }

  # Planche : toutes les slides en petit, pour vérifier d'un coup d'oeil
  $ffmpeg = Tool "ffmpeg"
  $cols = [Math]::Min($total, 5); $rows = [Math]::Ceiling($total / 5)
  $planche = [IO.Path]::Combine($dossier, "planche.jpg")
  & $ffmpeg -nostdin -v error -y -framerate 1 -i ([IO.Path]::Combine($dossier, "slide-%02d.png")) -vf "scale=324:-2,tile=${cols}x${rows}:padding=12:color=0x444444" -frames:v 1 -q:v 3 $planche

  try { Remove-Item -Recurse -Force -LiteralPath $script:Profil, ($script:Profil + ".log") -ErrorAction SilentlyContinue } catch { }
  Say "PRÊT dossier=$dossier slides=$total planche=$planche"
  if ($env:OS -eq "Windows_NT") { Invoke-Item $dossier }
}

switch ($Commande) {
  "rendre" { Cmd-Rendre $Arg1 $Arg2 }
  default { Fail 2 "Commandes : rendre <dossier> [numéro]" }
}
