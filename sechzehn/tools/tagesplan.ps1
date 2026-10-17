# Schreibt die Tagespläne fest: data/plan.json (Tagesnummer → fünf Runden mit Land und fünf Fakt-IDs, Stufe 1→5).
# Das Spiel liest heute und alle Tage aus dem Plan; vergangene Tage und HEUTE ändert dieses Tool nie.
# Regeln je Tag: fünf verschiedene Länder (zufällig, ohne tagesübergreifende Länder-Sperre), je Runde Stufe 1–5 aus fünf verschiedenen
# Kategorien, Stufe 5 eindeutig (trifft_auch_zu leer), keine zwei Fakten derselben Gruppe (Spalte gruppe) in einer Runde, nur Status
# geprüft. Wiederverwendungssperre: ein Fakt frühestens nach -Sperre Tagen (Standard 30) wieder. Reicht der Pool dafür nicht, wird die
# Sperre für diesen Tag gelockert (die am längsten nicht benutzten Fakten zuerst) und das gemeldet.
# Aufruf: & .\tools\tagesplan.ps1 [-Tage 60] [-NeuPlanen] [-Sperre 30] [-Heute N]
#   ohne -NeuPlanen: vorhandene Tage bleiben, nur fehlende bis heute+Tage werden angehängt; künftige Tage mit inzwischen ungültigen
#                    Fakten (gelöscht, nicht mehr geprüft) werden neu geplant.
#   -NeuPlanen:      alle Tage ab morgen neu planen (z. B. nach einem Paket neuer Fakten), heute und davor bleiben.
#   -Heute N:        Tagesnummer von heute vorgeben (Test); sonst aus START_DATE in app.js und dem lokalen Datum.
param([int]$Tage = 60, [switch]$NeuPlanen, [int]$Sperre = 30, [int]$Heute = 0)

$root = Join-Path $PSScriptRoot '..'
$planPath = Join-Path $root 'data\plan.json'
$KATEGORIEN = 'Politik', 'Geografie', 'Geschichte', 'Kultur', 'Sport', 'Wirtschaft', 'Alltag', 'Persönlichkeiten'
$ORDER = 'BW BY BB BE HE MV NI HB NW RP SL ST SN SH TH HH'.Split(' ')

$start = [regex]::Match((Get-Content -Raw -Encoding UTF8 (Join-Path $root 'app.js')), "START_DATE:\s*'(\d{4}-\d\d-\d\d)'").Groups[1].Value
if (-not $Heute) { $Heute = [int]((Get-Date).Date - [datetime]::ParseExact($start, 'yyyy-MM-dd', $null)).TotalDays + 1 }

$alle = Import-Csv -Path (Join-Path $root 'data\fakten.csv') -Delimiter ';' -Encoding UTF8
$byId = @{}; foreach ($f in $alle) { $byId[$f.id] = $f }
$pool = @($alle | Where-Object { $_.status -eq 'geprüft' -and $KATEGORIEN -contains $_.kategorie -and $_.stufe -match '^[1-5]$' })
$usable = @{}; foreach ($f in $pool) { $usable[$f.id] = $true }
# Kandidaten je Land und Stufe einmal vorab (Stufe 5 nur eindeutige Fakten)
$kandidaten = @{}; foreach ($l in $ORDER) { foreach ($s in 1..5) { $kandidaten["$l|$s"] = @() } }
foreach ($f in $pool) { $s = [int]$f.stufe; if ($s -lt 5 -or -not $f.trifft_auch_zu) { $kandidaten["$($f.land)|$s"] += $f } }

# Vorhandenen Plan laden (Tage als sortierte Zahlen)
$plan = @{} # Hashtabelle: [ordered] behandelt Zahlen-Schlüssel als Position
if (Test-Path $planPath) {
  $j = Get-Content -Raw -Encoding UTF8 $planPath | ConvertFrom-Json
  foreach ($p in $j.tage.PSObject.Properties | Sort-Object { [int]$_.Name }) { $plan[[int]$p.Name] = @($p.Value) }
}
$behalten = @{}; $neuGeplant = @()
foreach ($d in @($plan.Keys | Sort-Object)) {
  if ($d -le $Heute) { $behalten[$d] = $plan[$d]; continue }           # Vergangenheit und heute: nie ändern
  if ($NeuPlanen) { continue }
  $ok = -not @($plan[$d] | ForEach-Object { $_.fakten } | Where-Object { -not $usable[$_] }).Count
  if ($ok) { $behalten[$d] = $plan[$d] } else { $neuGeplant += $d }   # ungültige Fakten: Tag neu planen
}

function Shuffle($arr, $rnd) { $a = @($arr); for ($i = $a.Count - 1; $i -gt 0; $i--) { $k = $rnd.Next($i + 1); $t = $a[$i]; $a[$i] = $a[$k]; $a[$k] = $t }; return , $a }

# Eine Runde für ein Land: je Stufe ein Fakt, verschiedene Kategorien, verschiedene Gruppen. $erlaubt: Filter für die Sperre.
function Build-Round($land, $rnd, $lastUsed, $tag, [bool]$locker) {
  $byStufe = foreach ($s in 1..5) {
    $c = $kandidaten["$land|$s"]
    $frei = New-Object System.Collections.ArrayList; $gesperrt = New-Object System.Collections.ArrayList
    foreach ($f in $c) { if (-not $lastUsed.ContainsKey($f.id) -or $tag - $lastUsed[$f.id] -ge $Sperre) { [void]$frei.Add($f) } else { [void]$gesperrt.Add($f) } }
    if ($locker) { # zuerst freie (zufällig), dann gesperrte nach Alter (am längsten unbenutzt zuerst)
      $gesperrt = @($gesperrt | Sort-Object { $lastUsed[$_.id] })
      $gemischt = Shuffle $frei $rnd # Zuweisung packt das Array aus (Shuffle gibt es als ein Objekt zurück)
      , (@($gemischt) + @($gesperrt))
    } else { , (Shuffle $frei $rnd) }
  }
  $kat = New-Object System.Collections.Generic.HashSet[string]; $grp = New-Object System.Collections.Generic.HashSet[string]
  $pick = New-Object System.Collections.ArrayList
  function Go($i) {
    if ($i -eq 5) { return $true }
    foreach ($f in $byStufe[$i]) {
      if ($kat.Contains($f.kategorie)) { continue }
      if ($f.gruppe -and $grp.Contains($f.gruppe)) { continue }
      [void]$kat.Add($f.kategorie); if ($f.gruppe) { [void]$grp.Add($f.gruppe) }; [void]$pick.Add($f.id)
      if (Go ($i + 1)) { return $true }
      [void]$kat.Remove($f.kategorie); if ($f.gruppe) { [void]$grp.Remove($f.gruppe) }; $pick.RemoveAt($pick.Count - 1)
    }
    return $false
  }
  if (Go 0) { return , @($pick) } else { return $null }
}

$letzter = $Heute + $Tage
$gelockert = @()
$tageNeu = @{}; foreach ($d in $behalten.Keys) { $tageNeu[$d] = $behalten[$d] }
for ($d = 1; $d -le $letzter; $d++) {
  if ($tageNeu.ContainsKey($d)) { continue }
  if ($d -le $Heute -and -not $plan.ContainsKey($d)) { continue } # Lücken in der Vergangenheit nicht nachträglich füllen
  # Letzte Verwendung jedes Fakts in den 30 Tagen davor (aus dem bisherigen Plan und den neu geplanten Tagen)
  $lastUsed = @{}
  foreach ($k in $tageNeu.Keys) { if ($k -lt $d -and $d - $k -lt $Sperre) { foreach ($r in $tageNeu[$k]) { foreach ($id in $r.fakten) { $lastUsed[$id] = $k } } } }
  $rnd = New-Object System.Random ($d * 7919 + 17)
  $runden = @(); $locker = $false
  foreach ($pass in 0, 1) {
    foreach ($land in (Shuffle $ORDER $rnd)) {
      if ($runden.Count -ge 5) { break }
      if (@($runden | Where-Object { $_.land -eq $land }).Count) { continue }
      $ids = Build-Round $land $rnd $lastUsed $d ([bool]$pass)
      if ($ids) { $runden += [pscustomobject][ordered]@{ land = $land; fakten = $ids }; if ($pass) { $locker = $true } }
    }
    if ($runden.Count -ge 5) { break }
  }
  if ($runden.Count -lt 5) { Write-Host "Tag ${d}: nur $($runden.Count) Runden möglich – Pool zu klein. Abbruch."; exit 1 }
  if ($locker) { $gelockert += $d }
  $tageNeu[$d] = $runden
}

# Schreiben: eine Zeile je Tag, damit Änderungen in git gut lesbar sind
$zeilen = foreach ($d in ($tageNeu.Keys | Sort-Object)) {
  $r = ($tageNeu[$d] | ForEach-Object { '{"land":"' + $_.land + '","fakten":["' + ($_.fakten -join '","') + '"]}' }) -join ','
  "    `"$d`": [$r]"
}
$json = "{`n  `"start`": `"$start`",`n  `"sperre_tage`": $Sperre,`n  `"tage`": {`n" + ($zeilen -join ",`n") + "`n  }`n}`n"
[IO.File]::WriteAllText($planPath, $json, (New-Object System.Text.UTF8Encoding($false)))

# Zusammenfassung
$zukunft = @($tageNeu.Keys | Where-Object { $_ -gt $Heute })
$haeufig = $zukunft | ForEach-Object { $tageNeu[$_] } | Group-Object land | Sort-Object Count -Descending | ForEach-Object { "$($_.Name) $($_.Count)" }
Write-Host "Heute = Tag $Heute. Plan: Tag $(@($tageNeu.Keys | Sort-Object)[0]) bis $letzter ($($tageNeu.Count) Tage), davon $($zukunft.Count) künftige."
if ($neuGeplant.Count) { Write-Host "Neu geplant wegen ungültiger Fakten: $($neuGeplant -join ', ')" }
Write-Host "Sperre ($Sperre Tage) gelockert an: $(if ($gelockert.Count) { $gelockert -join ', ' } else { 'keinem Tag' })"
Write-Host "Länder in den künftigen Tagen: $($haeufig -join ', ')"
