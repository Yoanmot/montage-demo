# Préparer les zooms d'une vidéo coupée par couper-silences (Windows, PowerShell 5.1 et plus).
# Chaque zoom est repéré par ses mots (numéros de words.cut.json), jamais par un minutage.
# Rien ne part sur le serveur. La vidéo, elle, n'est fabriquée que par le skill montage, en un seul rendu depuis l'original.
#
#   zooms.ps1 texte <dossier>      écrit texte-numerote.md : le texte, chaque mot précédé de son numéro
#   zooms.ps1 preparer <dossier>   lit zooms.json, écrit zooms.txt (la couche pour le rendu)
#                                  et une image de contrôle par zoom dans zooms-apercu\
#
# Codes de sortie : 0 ok · 2 fichier introuvable · 7 outil vidéo impossible à installer · 13 zooms.json illisible
param([string]$Commande, [string]$Arg1)
$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ProgressPreference = "SilentlyContinue"

$UserHome = $env:USERPROFILE; if (-not $UserHome) { $UserHome = $HOME }   # $HOME : tests sur Mac (pwsh)
$HomeDir = Join-Path $UserHome ".montage-yoan"
$Curl = "curl.exe"; if (-not (Get-Command curl.exe -ErrorAction SilentlyContinue)) { $Curl = "curl" }
$Bin = Join-Path $HomeDir "bin"
New-Item -ItemType Directory -Force -Path $Bin | Out-Null

# Le saut d'un zoom sec se cale sur la coupe la plus proche si elle est à moins de ça : il se lit alors comme la coupe
$AimantCoupe = 0.35
$EchelleMin = 1.05; $EchelleMax = 1.6
$RampeMax = 3.0   # un zoom progressif atteint son échelle en 3 s au plus, puis tient

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

function Cmd-Texte($w) {
  if (-not $w) { Fail 2 "Usage : zooms.ps1 texte <dossier>" }
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

# Coupe la plus proche de la frame f (en frames de la vidéo coupée), ou f elle-même si aucune n'est assez près
function Aimante($f, $coupes, $fps) {
  $best = $f; $d = [int][Math]::Round($AimantCoupe * $fps) + 1
  foreach ($c in $coupes) { $e = [Math]::Abs($c - $f); if ($e -lt $d) { $d = $e; $best = $c } }
  return $best
}

function Cmd-Preparer($w) {
  if (-not $w) { Fail 2 "Usage : zooms.ps1 preparer <dossier>" }
  $w = [IO.Path]::GetFullPath($w)
  $info = ReadText ([IO.Path]::Combine($w, "info.json")) | ConvertFrom-Json
  if (-not (Exists $info.video)) { Fail 2 "VIDÉO_INTROUVABLE : $($info.video) (la vidéo d'origine a été déplacée ?)" }
  $edlPath = [IO.Path]::Combine($w, "edl.json")
  if (-not (Exists $edlPath)) { Fail 2 "COUPES_INTROUVABLES : lance d'abord le skill couper-silences (compiler) sur cette vidéo." }
  $words = Words $w
  $fps = [int]$info.fps
  $segs = @((ReadText $edlPath | ConvertFrom-Json).segments)
  $totalF = [int]$segs[-1].outOutF
  # Les coupes, plus le tout début de la vidéo : un zoom sec qui ouvre la vidéo part de la première image
  $coupes = @($segs | ForEach-Object { [int]$_.outInF })

  $zp = [IO.Path]::Combine($w, "zooms.json")
  if (-not (Exists $zp)) { Fail 2 "ZOOMS_INTROUVABLES : écris d'abord zooms.json dans $w." }
  try { $plan = ReadText $zp | ConvertFrom-Json } catch { Fail 13 ("ZOOMS_ILLISIBLE : " + $_.Exception.Message) }
  $liste = @($plan.zooms | Where-Object { $_ })
  if ($liste.Count -eq 0) { Fail 13 "ZOOMS_ILLISIBLE : aucun zoom dans zooms.json (une liste « zooms » vide ne sert à rien : retire la couche zooms du rendu)." }

  $zooms = @()
  $n = 0
  foreach ($z in $liste) {
    $n++
    $a = [int]$z.debut; $b = if ($null -ne $z.fin) { [int]$z.fin } else { $a }
    if ($a -lt 0 -or $b -ge $words.Count -or $b -lt $a) { Fail 13 "ZOOMS_ILLISIBLE : zoom n°$n, mots $a à $b invalides (0 à $($words.Count - 1), début avant fin)." }
    $s = if ($null -ne $z.echelle) { [double]$z.echelle } else { 1.2 }
    if ($s -lt $EchelleMin -or $s -gt $EchelleMax) { Fail 13 "ZOOMS_ILLISIBLE : zoom n°$n, échelle $s hors de $EchelleMin à $EchelleMax." }
    $entree = if ($z.entree) { [string]$z.entree } else { "sec" }
    if (@("sec", "progressif") -notcontains $entree) { Fail 13 "ZOOMS_ILLISIBLE : zoom n°$n, entrée « $entree » inconnue (sec ou progressif)." }
    $px = 0.5; $py = 0.35
    if ($z.cadrage) {
      $px = [double]$z.cadrage[0]; $py = [double]$z.cadrage[1]
      if ($px -lt 0 -or $px -gt 1 -or $py -lt 0 -or $py -gt 1) { Fail 13 "ZOOMS_ILLISIBLE : zoom n°$n, cadrage hors de 0 à 1." }
    }
    # Fenêtre en frames de la vidéo coupée : du début du premier mot à la fin du dernier
    $f0 = [int][Math]::Round([double]$words[$a].start * $fps)
    $f1 = [int][Math]::Round([double]$words[$b].end * $fps)
    if ($entree -eq "sec") { $f0 = Aimante $f0 $coupes $fps }
    $f1 = Aimante $f1 $coupes $fps
    $f0 = [Math]::Max(0, $f0); $f1 = [Math]::Min($totalF, $f1)
    if ($f1 - $f0 -lt [Math]::Round(0.5 * $fps)) { Fail 13 "ZOOMS_ILLISIBLE : zoom n°$n trop court (moins d'une demi-seconde) : prends quelques mots de plus." }
    $phrase = (@($a..$b | ForEach-Object { [string]$words[$_].text }) -join " ").Trim()
    $zooms += [pscustomobject]@{ n = $n; f0 = $f0; f1 = $f1; s = $s; entree = $entree; px = $px; py = $py; phrase = $phrase }
  }
  $zooms = @($zooms | Sort-Object f0)
  for ($i = 1; $i -lt $zooms.Count; $i++) {
    if ($zooms[$i].f0 -lt $zooms[$i - 1].f1) { Fail 13 "ZOOMS_ILLISIBLE : les zooms n°$($zooms[$i - 1].n) et n°$($zooms[$i].n) se chevauchent." }
  }

  # La couche : un zoompan par image (z = 1 hors des zooms, l'image reste alors identique à l'originale).
  # Le zoom va vers le point de cadrage : ce point reste à sa place à l'écran pendant que l'image grossit.
  $zExpr = "1"; $xExpr = "0.5"; $yExpr = "0.5"
  for ($i = $zooms.Count - 1; $i -ge 0; $i--) {
    $z = $zooms[$i]
    $dans = "between(on,$($z.f0),$($z.f1 - 1))"
    if ($z.entree -eq "progressif") {
      # Rampe lissée (départ et arrivée en douceur), puis l'échelle tient jusqu'à la fin
      $r = [Math]::Max(1, [Math]::Min($z.f1 - $z.f0, [int][Math]::Round($RampeMax * $fps)))
      $p = "min((on-$($z.f0))/$r,1)"
      $val = "1+$(Num ($z.s - 1))*$p*$p*(3-2*$p)"
    } else { $val = Num $z.s }
    $zExpr = "if($dans,$val,$zExpr)"
    $xExpr = "if($dans,$(Num $z.px),$xExpr)"
    $yExpr = "if($dans,$(Num $z.py),$yExpr)"
  }
  $couche = "zoompan=z='$zExpr':x='(iw-iw/zoom)*($xExpr)':y='(ih-ih/zoom)*($yExpr)':d=1:s=$($info.largeur)x$($info.hauteur):fps=$fps"
  WriteText ([IO.Path]::Combine($w, "zooms.txt")) $couche

  # Une image de contrôle par zoom, au moment où il est le plus serré, prise dans la vidéo d'origine
  $ffmpeg = Tool "ffmpeg"
  $apercu = [IO.Path]::Combine($w, "zooms-apercu")
  if ([IO.Directory]::Exists($apercu)) { [IO.Directory]::Delete($apercu, $true) }
  [IO.Directory]::CreateDirectory($apercu) | Out-Null
  foreach ($z in $zooms) {
    $f = if ($z.entree -eq "progressif") { $z.f1 - 2 } else { [int](($z.f0 + $z.f1) / 2) }
    $seg = $segs | Where-Object { $f -ge [int]$_.outInF -and $f -lt [int]$_.outOutF } | Select-Object -First 1
    $t = Num (([int]$seg.srcInF + $f - [int]$seg.outInF) / $fps)
    $s = Num $z.s
    $vf = "crop=iw/${s}:ih/${s}:(iw-iw/${s})*$(Num $z.px):(ih-ih/${s})*$(Num $z.py),scale=540:-2"
    $img = [IO.Path]::Combine($apercu, ("zoom-{0:D2}.jpg" -f $z.n))
    & $ffmpeg -nostdin -v error -y -ss $t -i $info.video -frames:v 1 -vf $vf -q:v 3 $img
  }

  Say "PRÊT zooms=$($zooms.Count) apercu=$apercu"
  foreach ($z in $zooms) {
    $d = Num ([Math]::Round($z.f0 / $fps, 1)); $e = Num ([Math]::Round($z.f1 / $fps, 1))
    Say ("  n°{0} {1}s à {2}s, {3} % {4} : « {5} »" -f $z.n, $d, $e, [Math]::Round($z.s * 100), $z.entree, $z.phrase)
  }
}

switch ($Commande) {
  "texte" { Cmd-Texte $Arg1 }
  "preparer" { Cmd-Preparer $Arg1 }
  default { Say "Usage : zooms.ps1 texte <dossier> | preparer <dossier>"; exit 1 }
}
