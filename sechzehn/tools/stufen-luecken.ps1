# Zeigt pro Land, ob buildRound (app.js) eine Runde bilden kann, und welche Stufe/Kategorie-Kombination fehlt.
# Aufruf: & .\tools\stufen-luecken.ps1 [-NurGeprueft]
# Ohne -NurGeprueft wie CONFIG.ALLOW_DRAFTS = true (entwurf und unsicher zählen mit).
param([switch]$NurGeprueft)

$csvPath = Join-Path $PSScriptRoot '..\data\fakten.csv'
$KATEGORIEN = 'Politik', 'Geografie', 'Geschichte', 'Kultur', 'Sport', 'Wirtschaft', 'Alltag', 'Persönlichkeiten'
$ORDER = 'BW BY BB BE HE MV NI HB NW RP SL ST SN SH TH HH'.Split(' ')
$status = if ($NurGeprueft) { @('geprüft') } else { @('geprüft', 'entwurf', 'unsicher') }

$facts = Import-Csv -Path $csvPath -Delimiter ';' -Encoding UTF8 |
  Where-Object { $KATEGORIEN -contains $_.kategorie -and $status -contains $_.status }

function Test-Round($fs) {
  # Wie buildRound: je eine Stufe 1-5, verschiedene Kategorien, Stufe 5 ohne trifft_auch_zu.
  $byStufe = 1..5 | ForEach-Object { $s = $_; , @($fs | Where-Object { [int]$_.stufe -eq $s -and ($s -lt 5 -or -not $_.trifft_auch_zu) }) }
  $used = New-Object System.Collections.Generic.HashSet[string]
  function Go($i) {
    if ($i -eq 5) { return $true }
    foreach ($f in $byStufe[$i]) {
      if (-not $used.Add($f.kategorie)) { continue }
      if (Go ($i + 1)) { return $true }
      [void]$used.Remove($f.kategorie)
    }
    return $false
  }
  return Go 0
}

$spielbar = @()
foreach ($land in $ORDER) {
  $fs = @($facts | Where-Object { $_.land -eq $land })
  if (-not $fs.Count) { continue }
  $stufen = (1..5 | ForEach-Object { $s = $_; "$s`:" + (@($fs | Where-Object { [int]$_.stufe -eq $s } | ForEach-Object { $_.kategorie.Substring(0, 3) }) -join ',') }) -join '  '
  if (Test-Round $fs) { $spielbar += $land; Write-Host "$land  spielbar      $stufen"; continue }
  Write-Host "$land  NICHT spielbar $stufen"
  foreach ($s in 1..5) {
    $passt = @($KATEGORIEN | Where-Object { Test-Round ($fs + [pscustomobject]@{ stufe = "$s"; kategorie = $_; trifft_auch_zu = '' }) })
    if ($passt.Count) { Write-Host "      fehlt Stufe $s, möglich: $($passt -join ', ')" }
  }
}
Write-Host "Spielbar ($($spielbar.Count)): $($spielbar -join ', ')"
