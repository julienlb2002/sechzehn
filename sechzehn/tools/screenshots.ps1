# Erstellt Screenshots in echter Auflösung mit Edge im Hintergrundmodus (headless) aus den festen Demo-Spielständen des Entwicklermodus.
# Voraussetzung: Server läuft auf http://localhost:8000 (Konfiguration "sechzehn" in .claude/launch.json).
# Aufruf: & .\tools\screenshots.ps1 [-Breite 1920] [-Hoehe 1080] [-Tag 3] [-Ziel screenshots] [-Ansichten 'name=parameter', ...]
# Ohne -Ansichten: spiel-hell.png, spiel-dunkel.png (erste Runde, zwei falsche Tipps), ende-hell.png, ende-dunkel.png (Auswertung).
# Eigene Ansichten: Dateiname = URL-Parameter (ohne tag/dev), z. B. 'hover-sh-hell=demo=spiel&falsch=0&hover=SH&theme=light'.
# -Faktor 2 rendert mit doppelter Pixeldichte (Bild 3840×2160 bei 1920×1080), gut für Detailausschnitte.
param([int]$Breite = 1920, [int]$Hoehe = 1080, [int]$Tag = 3, [string]$Ziel = (Join-Path $PSScriptRoot '..\screenshots'), [string[]]$Ansichten, [int]$Faktor = 1)

$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") |
  Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { Write-Host 'Microsoft Edge nicht gefunden.'; exit 1 }
New-Item -ItemType Directory -Force $Ziel | Out-Null
$Ziel = (Resolve-Path $Ziel).Path

if (-not $Ansichten) {
  $Ansichten = 'spiel-hell=demo=spiel&theme=light', 'spiel-dunkel=demo=spiel&theme=dark', 'ende-hell=demo=ende&theme=light', 'ende-dunkel=demo=ende&theme=dark'
}
foreach ($ansicht in $Ansichten) {
  $name, $query = $ansicht -split '=', 2
  $datei = Join-Path $Ziel "$name.png"
  $profil = Join-Path $env:TEMP ("sechzehn-shot-" + [guid]::NewGuid())   # leeres Profil: keine gespeicherten Spielstände
  $url = "http://localhost:8000/?tag=$Tag&dev=1&$query"
  # Start-Process fügt die Argumente nur mit Leerzeichen zusammen: Pfade mit Leerzeichen selbst in Anführungszeichen setzen
  $argumente = @('--headless=new', '--disable-gpu', '--hide-scrollbars', "--force-device-scale-factor=$Faktor", "--window-size=$Breite,$Hoehe",
    '--virtual-time-budget=8000', "`"--user-data-dir=$profil`"", "`"--screenshot=$datei`"", "`"$url`"")
  Start-Process -FilePath $edge -ArgumentList ($argumente -join ' ') -Wait -WindowStyle Hidden
  Remove-Item -Recurse -Force $profil -ErrorAction SilentlyContinue
  if (Test-Path $datei) { Write-Host "OK  $datei" } else { Write-Host "FEHLT  $datei" }
}
