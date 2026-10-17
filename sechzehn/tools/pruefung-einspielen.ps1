# Spielt Ergebnisse des Prüf- und des Erzeuger-Agenten (JSON-Dateien) in data/fakten.csv ein.
# Aufruf: & .\tools\pruefung-einspielen.ps1 ergebnis1.json [ergebnis2.json ...] [-Csv kopie.csv]
# Vorhandene ID: übernimmt nur die Felder, die im JSON-Objekt stehen: quelle, trifft_auch_zu, zeitabhaengig, status,
# pruefnotiz, text, stufe, kategorie, thema, denkweg. Ist status dabei, wird stand auf den aktuellen Monat gesetzt.
# Neue ID: hängt eine Zeile an. Pflicht: id, land, kategorie, thema, denkweg, stufe, text; die ID muss zum Schema
# LAND-KAT-NNN passen (Land und Kategorie wie im Objekt), status fehlt → entwurf; stand nur, wenn status nicht entwurf.
# Kommt eine neue ID in den Eingaben mehrfach vor, wird sie ganz abgelehnt.
# Fehlen die Spalten thema/denkweg in der CSV, werden sie hinter kategorie eingefügt. -Csv: andere Datei (zum Testen).
param([Parameter(Mandatory, Position = 0, ValueFromRemainingArguments)][string[]]$Json, [Parameter()][string]$Csv)

$csvPath = if ($Csv) { $Csv } else { Join-Path $PSScriptRoot '..\data\fakten.csv' }
$utf8 = New-Object System.Text.UTF8Encoding($false)
$FIELDS = 'quelle', 'trifft_auch_zu', 'zeitabhaengig', 'status', 'pruefnotiz', 'text', 'stufe', 'kategorie', 'thema', 'denkweg'
$STATUS = 'entwurf', 'geprüft', 'unsicher', 'falsch'
$LAENDER = 'BW BY BE BB HB HH HE MV NI NW RP SL SN ST SH TH'.Split(' ')
# Kategoriensystem (siehe CLAUDE.md): Spielkategorie -> erlaubte Themen. Muss zu CATEGORIES in app.js passen.
$KAT_THEMEN = [ordered]@{
  'Geografie'        = 'Geografie', 'Natur und Umwelt', 'Bevölkerung und Städte'
  'Geschichte'       = , 'Geschichte'
  'Politik'          = , 'Politik und Verwaltung'
  'Wirtschaft'       = 'Wirtschaft und Industrie', 'Unternehmen und Marken', 'Infrastruktur und Verkehr'
  'Kultur'           = 'Kultur und Kunst', 'Medien und Popkultur', 'Architektur und Sehenswürdigkeiten', 'Wissenschaft und Bildung'
  'Sport'            = , 'Sport'
  'Persönlichkeiten' = , 'Persönlichkeiten'
  'Alltag'           = 'Essen und Produkte', 'Sprache und Identität', 'Feste und Bräuche'
}
$THEMA_KAT = @{}; foreach ($k in $KAT_THEMEN.Keys) { foreach ($t in $KAT_THEMEN[$k]) { $THEMA_KAT[$t] = $k } }
$DENKWEGE = 'Wissen', 'Herleitung', 'Wiedererkennung'
$KAT_KUERZEL = @{ 'Geografie' = 'GEO'; 'Geschichte' = 'GES'; 'Politik' = 'POL'; 'Wirtschaft' = 'WIR'; 'Kultur' = 'KUL'; 'Sport' = 'SPO'; 'Persönlichkeiten' = 'PER'; 'Alltag' = 'ALL' }
$PFLICHT = 'id', 'land', 'kategorie', 'thema', 'denkweg', 'stufe', 'text'

function Parse-Csv([string]$text) {
  # Wie parseCSV in app.js: Semikolon-getrennt, Felder dürfen in "..." stehen.
  $text = $text.TrimStart([char]0xFEFF)
  $rows = New-Object System.Collections.ArrayList; $row = New-Object System.Collections.ArrayList
  $field = New-Object System.Text.StringBuilder; $q = $false
  for ($i = 0; $i -lt $text.Length; $i++) {
    $c = $text[$i]
    if ($q) {
      if ($c -eq '"' -and $i + 1 -lt $text.Length -and $text[$i + 1] -eq '"') { [void]$field.Append('"'); $i++ }
      elseif ($c -eq '"') { $q = $false }
      else { [void]$field.Append($c) }
    } elseif ($c -eq '"') { $q = $true }
    elseif ($c -eq ';') { [void]$row.Add($field.ToString()); [void]$field.Clear() }
    elseif ($c -eq "`n" -or $c -eq "`r") {
      if ($c -eq "`r" -and $i + 1 -lt $text.Length -and $text[$i + 1] -eq "`n") { $i++ }
      [void]$row.Add($field.ToString()); [void]$field.Clear()
      if (($row | Where-Object { $_ -ne '' }).Count) { [void]$rows.Add(@($row)) }
      $row = New-Object System.Collections.ArrayList
    } else { [void]$field.Append($c) }
  }
  if ($field.Length -or $row.Count) { [void]$row.Add($field.ToString()); [void]$rows.Add(@($row)) }
  return , $rows
}

function Quote([string]$v) {
  $v = ($v -replace '[\r\n]+', ' ').Trim()
  if ($v -match '[;"]') { return '"' + ($v -replace '"', '""') + '"' }
  return $v
}

$raw = [IO.File]::ReadAllBytes((Resolve-Path $csvPath))
$bom = $raw.Length -ge 3 -and $raw[0] -eq 0xEF -and $raw[1] -eq 0xBB -and $raw[2] -eq 0xBF
$text = $utf8.GetString($raw)
$nl = if ($text.Contains("`r`n")) { "`r`n" } else { "`n" }   # Zeilenenden und BOM der Datei beibehalten
$rows = Parse-Csv $text

# Spalten thema und denkweg bei Bedarf hinter kategorie einfügen
foreach ($neu in 'denkweg', 'thema') {
  if ($rows[0] -contains $neu) { continue }
  $at = [array]::IndexOf($rows[0], 'kategorie') + 1
  for ($r = 0; $r -lt $rows.Count; $r++) {
    $list = New-Object System.Collections.ArrayList(, $rows[$r])
    while ($list.Count -lt $at) { [void]$list.Add('') }
    $list.Insert($at, $(if ($r -eq 0) { $neu } else { '' }))
    $rows[$r] = @($list)
  }
}

$head = $rows[0]
$col = @{}; for ($i = 0; $i -lt $head.Count; $i++) { $col[$head[$i]] = $i }
$byId = @{}; for ($r = 1; $r -lt $rows.Count; $r++) { $byId[$rows[$r][$col['id']]] = $r }

$stand = Get-Date -Format 'yyyy-MM'
$n = 0; $neu = 0; $errors = @()
$alle = @(foreach ($file in $Json) { Get-Content -Raw -Encoding UTF8 $file | ConvertFrom-Json | ForEach-Object { $_ } })
# Neue IDs, die mehrfach vorkommen, sind mehrdeutig: ganz ablehnen
$doppelt = @($alle | Where-Object { -not $byId.ContainsKey("$($_.id)") } | Group-Object { "$($_.id)" } | Where-Object { $_.Count -gt 1 } | ForEach-Object { $_.Name })
foreach ($d in $doppelt) { $errors += "${d}: neue ID mehrfach in den Eingaben" }
foreach ($it in $alle) {
    $has = { param($f) [bool]$it.PSObject.Properties[$f] }
    $istNeu = -not $byId.ContainsKey("$($it.id)")
    if ($istNeu) {
      if ($doppelt -contains "$($it.id)") { continue }
      $fehlt = @($PFLICHT | Where-Object { -not "$($it.$_)".Trim() })
      if ($fehlt.Count) { $errors += "$($it.id): neue Zeile, Pflichtfelder fehlen: $($fehlt -join ', ')"; continue }
      if ($LAENDER -notcontains $it.land) { $errors += "$($it.id): unbekanntes Land '$($it.land)'"; continue }
      if (-not $KAT_THEMEN.Contains("$($it.kategorie)")) { $errors += "$($it.id): unbekannte Kategorie '$($it.kategorie)'"; continue }
      if ("$($it.id)" -cnotmatch "^$($it.land)-$($KAT_KUERZEL["$($it.kategorie)"])-\d{3}$") { $errors += "$($it.id): ID passt nicht zu Land/Kategorie (erwartet $($it.land)-$($KAT_KUERZEL["$($it.kategorie)"])-NNN)"; continue }
      $row = @('') * $head.Count
      $row[$col['id']] = "$($it.id)"; $row[$col['land']] = "$($it.land)"
      if (-not (& $has 'status')) { $it | Add-Member -NotePropertyName status -NotePropertyValue 'entwurf' }
    } else { $row = $rows[$byId[$it.id]] }
    if ((& $has 'status') -and $STATUS -notcontains $it.status) { $errors += "$($it.id): ungültiger Status '$($it.status)'"; continue }
    if ((& $has 'zeitabhaengig') -and 'ja', 'nein' -notcontains $it.zeitabhaengig) { $errors += "$($it.id): zeitabhaengig muss ja/nein sein"; continue }
    $bad = @("$($it.trifft_auch_zu)".Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ -and $LAENDER -notcontains $_ })
    if ($bad.Count) { $errors += "$($it.id): unbekannte Länder in trifft_auch_zu: $($bad -join ',')"; continue }
    if ((& $has 'stufe') -and "$($it.stufe)" -notmatch '^[1-5]$') { $errors += "$($it.id): stufe muss 1-5 sein"; continue }
    if ((& $has 'kategorie') -and -not $KAT_THEMEN.Contains("$($it.kategorie)")) { $errors += "$($it.id): unbekannte Kategorie '$($it.kategorie)'"; continue }
    if ((& $has 'thema') -and $it.thema -and -not $THEMA_KAT.ContainsKey("$($it.thema)")) { $errors += "$($it.id): unbekanntes Thema '$($it.thema)'"; continue }
    if ((& $has 'denkweg') -and $it.denkweg -and $DENKWEGE -notcontains $it.denkweg) { $errors += "$($it.id): unbekannter Denkweg '$($it.denkweg)'"; continue }
    # Thema muss zur (neuen oder bisherigen) Kategorie passen
    $kat = if (& $has 'kategorie') { "$($it.kategorie)" } else { $row[$col['kategorie']] }
    $thema = if (& $has 'thema') { "$($it.thema)" } else { $row[$col['thema']] }
    if ($thema -and $THEMA_KAT[$thema] -ne $kat) { $errors += "$($it.id): Thema '$thema' gehört zu '$($THEMA_KAT[$thema])', nicht zu '$kat'"; continue }

    while ($row.Count -lt $head.Count) { $row += '' }
    foreach ($f in $FIELDS) { if (& $has $f) { $row[$col[$f]] = "$($it.$f)" } }
    if (& $has 'trifft_auch_zu') { $row[$col['trifft_auch_zu']] = ("$($it.trifft_auch_zu)" -replace '\s', '') }
    if ((& $has 'status') -and -not ($istNeu -and $it.status -eq 'entwurf')) { $row[$col['stand']] = $stand }
    if ($istNeu) { [void]$rows.Add($row); $byId["$($it.id)"] = $rows.Count - 1; $neu++ }
    else { $rows[$byId[$it.id]] = $row; $n++ }
}

$out = ($rows | ForEach-Object { ($_ | ForEach-Object { Quote $_ }) -join ';' }) -join $nl
[IO.File]::WriteAllText((Resolve-Path $csvPath), $out + $nl, (New-Object System.Text.UTF8Encoding($bom)))
Write-Host "$n Fakten aktualisiert, $neu neu angehängt$(if ($n) { ", stand = $stand bei Einträgen mit status" })."
if ($errors.Count) { Write-Host "Übersprungen:"; $errors | ForEach-Object { Write-Host "  $_" }; exit 1 }
