# Préparer les sous-titres d'une vidéo coupée par couper-silences (Windows, PowerShell 5.1 et plus).
# Part du texte calé sur la vidéo coupée (<nom>-montage\words.cut.json) : pas de nouvelle transcription.
# Le fichier de sous-titres est fabriqué sur le serveur de Yoan Mottier (seuls les mots partent) ;
# la vidéo, elle, n'est fabriquée que par le skill montage, en un seul rendu depuis l'original.
#
#   sous-titres.ps1 texte <dossier>      écrit texte-numerote.md : le texte, chaque mot précédé de son numéro
#   sous-titres.ps1 preparer <dossier>   applique sous-titres.json (corrections, mots masqués, taille, position)
#                                        et écrit sous-titres.ass dans le dossier
#
# Codes de sortie : 0 ok · 2 fichier introuvable · 3 code manquant · 5 erreur serveur · 6 réseau
#                   7 outil vidéo impossible à installer · 13 sous-titres.json illisible
param([string]$Commande, [string]$Arg1)
$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ProgressPreference = "SilentlyContinue"

$API = "https://195-15-255-230.sslip.io/v1"
$UserHome = $env:USERPROFILE; if (-not $UserHome) { $UserHome = $HOME }   # $HOME : tests sur Mac (pwsh)
$HomeDir = Join-Path $UserHome ".montage-yoan"
$Curl = "curl.exe"; if (-not (Get-Command curl.exe -ErrorAction SilentlyContinue)) { $Curl = "curl" }
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

function Words($w) {
  $p = [IO.Path]::Combine($w, "words.cut.json")
  if (-not (Exists $p)) { Fail 2 "TEXTE_INTROUVABLE : lance d'abord le skill couper-silences sur cette vidéo (il manque words.cut.json dans $w)." }
  return @((ReadText $p | ConvertFrom-Json).words)
}

# Taille de l'image telle qu'on la voit : l'iPhone filme souvent couché et indique une rotation
function Display-Size($video) {
  $ffprobe = Tool "ffprobe"
  $p = (& $ffprobe -v error -select_streams v:0 -show_entries stream=width,height:stream_side_data=rotation -of json $video) -join "" | ConvertFrom-Json
  $s = $p.streams[0]
  $L = [int]$s.width; $Ht = [int]$s.height
  $rot = 0
  foreach ($d in @($s.side_data_list)) { if ($d -and $d.PSObject.Properties["rotation"]) { $rot = [int]$d.rotation } }
  if ([Math]::Abs($rot) % 180 -eq 90) { $t = $L; $L = $Ht; $Ht = $t }
  return @($L, $Ht)
}

function Cmd-Texte($w) {
  if (-not $w) { Fail 2 "Usage : sous-titres.ps1 texte <dossier>" }
  $w = [IO.Path]::GetFullPath($w)
  $words = Words $w
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.AppendLine("# Texte des sous-titres, chaque mot précédé de son numéro")
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
  if (-not $w) { Fail 2 "Usage : sous-titres.ps1 preparer <dossier>" }
  $w = [IO.Path]::GetFullPath($w)
  Need-Code | Out-Null
  $info = ReadText ([IO.Path]::Combine($w, "info.json")) | ConvertFrom-Json
  if (-not (Exists $info.video)) { Fail 2 "VIDÉO_INTROUVABLE : $($info.video) (la vidéo d'origine a été déplacée ?)" }
  $words = Words $w

  # Les choix de Claude : corrections de mots, mots masqués, taille et position
  $reglages = $null
  $rp = [IO.Path]::Combine($w, "sous-titres.json")
  if (Exists $rp) {
    try { $reglages = ReadText $rp | ConvertFrom-Json } catch { Fail 13 ("SOUS-TITRES_ILLISIBLE : " + $_.Exception.Message) }
  }
  $texte = @{}; $masque = @{}
  $taille = 1.0; $position = 0.75
  if ($reglages) {
    if ($reglages.corrections) {
      foreach ($p in $reglages.corrections.PSObject.Properties) {
        $k = 0
        if (-not [int]::TryParse($p.Name, [ref]$k) -or $k -lt 0 -or $k -ge $words.Count) { Fail 13 "SOUS-TITRES_ILLISIBLE : mot n°$($p.Name) inexistant (0 à $($words.Count - 1))." }
        $texte[$k] = [string]$p.Value
      }
    }
    foreach ($r in @($reglages.masquer | Where-Object { $_ })) {
      $a = [int]$r[0]; $b = [int]$r[-1]
      for ($k = $a; $k -le $b; $k++) { $masque[$k] = $true }
    }
    if ($reglages.taille) { $taille = [double]$reglages.taille }
    if ($reglages.position) { $position = [double]$reglages.position }
  }
  $liste = New-Object System.Collections.ArrayList
  for ($i = 0; $i -lt $words.Count; $i++) {
    if ($masque[$i]) { continue }
    $t = [string]$words[$i].text; if ($texte.ContainsKey($i)) { $t = $texte[$i] }
    if (-not $t.Trim()) { continue }
    [void]$liste.Add(@{ text = $t; start = [double]$words[$i].start; end = [double]$words[$i].end })
  }
  if ($liste.Count -eq 0) { Fail 13 "SOUS-TITRES_ILLISIBLE : tous les mots sont masqués." }

  # (les variables PowerShell ignorent la casse : $W écraserait le dossier $w)
  $Larg, $Haut = Display-Size $info.video
  $body = @{ words = $liste; largeur = $Larg; hauteur = $Haut; taille = $taille; position = $position }
  $tmp = [IO.Path]::Combine($w, "requete-sous-titres.json")
  WriteText $tmp ($body | ConvertTo-Json -Depth 5 -Compress)
  Say "Fabrication des sous-titres…"
  $r = Call @("-X", "POST", "-H", "Content-Type: application/json", "--data-binary", "@$tmp", "$API/sous-titres")
  [IO.File]::Delete($tmp)
  if ($r.Status -ne 200) { Fail 5 ("ERREUR : " + (Err $r)) }
  $j = Json $r.Body
  WriteText ([IO.Path]::Combine($w, "sous-titres.ass")) $j.ass
  Say "PRÊT sous-titres=$([IO.Path]::Combine($w, 'sous-titres.ass')) mots=$($liste.Count) masqués=$($masque.Count) corrigés=$($texte.Count) image=${Larg}x${Haut}"
}

switch ($Commande) {
  "texte" { Cmd-Texte $Arg1 }
  "preparer" { Cmd-Preparer $Arg1 }
  default { Say "Usage : sous-titres.ps1 texte <dossier> | preparer <dossier>"; exit 1 }
}
