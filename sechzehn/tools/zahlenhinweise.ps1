# Erzeugt berechnete Hinweise aus amtlichen bzw. belegten Tabellen: Fläche, Einwohner, Dichte, Landeshauptstädte (Destatis),
# Flächen bekannter Staaten (bpb nach CIA World Factbook), Nachbarschaften (aus data/map.json berechnet, Staatsgrenzen als Tabelle),
# gesetzliche Feiertage (BMI: bundesweite; DGB-Übersicht nach den Landesgesetzen: regionale). trifft_auch_zu wird exakt berechnet,
# Stufe wie bei den Namens-Hinweisen: passt auf >= 4 Länder → 1, 2–3 → 2, eindeutig → 3. Status geprüft (mechanisch berechnet).
# Je Land 2–4 Hinweise (-ProLand), bevorzugt eingrenzende (Stufe 2) und verschiedene Arten; Kombinationen, die es schon als Fakt gibt,
# sind ausgeschlossen ($SCHON_DA). Aufruf: & .\tools\zahlenhinweise.ps1 [-Ausgabe arbeit\zahlenhinweise.json] [-ProLand 3] [-Alle]
# Danach einspielen: & .\tools\pruefung-einspielen.ps1 arbeit\zahlenhinweise.json
param([string]$Ausgabe = (Join-Path $PSScriptRoot '..\arbeit\zahlenhinweise.json'), [int]$ProLand = 3, [switch]$Alle)

$Q_DESTATIS = 'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/02-bundeslaender.html'
$STICHTAG = '31.12.2024'
$Q_STAATEN = 'https://www.bpb.de/kurz-knapp/zahlen-und-fakten/europa/70500/flaechen-und-bevoelkerungsdichte/'
$Q_FEIERTAGE = 'https://www.dgb.de/service/ratgeber/feiertage/ https://www.bmi.bund.de/DE/themen/verfassung/staatliche-symbole/nationale-feiertage/nationale-feiertage-node.html'
$Q_KARTE = 'berechnet aus den Kartendaten (data/map.json, Quelle deutschlandGeoJSON)'

# Destatis, Gemeindeverzeichnis: Fläche (km²), Bevölkerung (Basis Zensus 2022), Dichte; Landeshauptstadt (Name, km², Einwohner). Stand 31.12.2024.
$L = [ordered]@{
  SH = @{ name = 'Schleswig-Holstein'; km2 = 15804.31; ew = 2959517; dichte = 187; hs = 'Kiel'; hsKm2 = 118.65; hsEw = 252668 }
  HH = @{ name = 'Hamburg'; km2 = 755.09; ew = 1862565; dichte = 2467; hs = 'Hamburg'; hsKm2 = 755.09; hsEw = 1862565 }
  NI = @{ name = 'Niedersachsen'; km2 = 47709.9; ew = 8004489; dichte = 168; hs = 'Hannover'; hsKm2 = 204.3; hsEw = 522131 }
  HB = @{ name = 'Bremen'; km2 = 419.61; ew = 704881; dichte = 1680; hs = 'Bremen'; hsKm2 = 318.2; hsEw = 586271 }
  NW = @{ name = 'Nordrhein-Westfalen'; km2 = 34112.65; ew = 18034454; dichte = 529; hs = 'Düsseldorf'; hsKm2 = 217.41; hsEw = 618685 }
  HE = @{ name = 'Hessen'; km2 = 21115.64; ew = 6280793; dichte = 297; hs = 'Wiesbaden'; hsKm2 = 203.87; hsEw = 288850 }
  RP = @{ name = 'Rheinland-Pfalz'; km2 = 19857.96; ew = 4129569; dichte = 208; hs = 'Mainz'; hsKm2 = 97.73; hsEw = 224684 }
  BW = @{ name = 'Baden-Württemberg'; km2 = 35747.85; ew = 11245898; dichte = 315; hs = 'Stuttgart'; hsKm2 = 207.33; hsEw = 612663 }
  BY = @{ name = 'Bayern'; km2 = 70541.77; ew = 13248928; dichte = 188; hs = 'München'; hsKm2 = 310.7; hsEw = 1505005 }
  SL = @{ name = 'Saarland'; km2 = 2572.01; ew = 1012141; dichte = 394; hs = 'Saarbrücken'; hsKm2 = 167.52; hsEw = 182971 }
  BE = @{ name = 'Berlin'; km2 = 891.12; ew = 3685265; dichte = 4136; hs = 'Berlin'; hsKm2 = 891.12; hsEw = 3685265 }
  BB = @{ name = 'Brandenburg'; km2 = 29654.36; ew = 2556747; dichte = 86; hs = 'Potsdam'; hsKm2 = 188.24; hsEw = 184754 }
  MV = @{ name = 'Mecklenburg-Vorpommern'; km2 = 23294.83; ew = 1573597; dichte = 68; hs = 'Schwerin'; hsKm2 = 130.52; hsEw = 98308 }
  SN = @{ name = 'Sachsen'; km2 = 18449.89; ew = 4042422; dichte = 219; hs = 'Dresden'; hsKm2 = 328.48; hsEw = 564904 }
  ST = @{ name = 'Sachsen-Anhalt'; km2 = 20554.84; ew = 2135597; dichte = 104; hs = 'Magdeburg'; hsKm2 = 201.68; hsEw = 244329 }
  TH = @{ name = 'Thüringen'; km2 = 16202.39; ew = 2100277; dichte = 130; hs = 'Erfurt'; hsKm2 = 269.91; hsEw = 218793 }
}
$DE_EW = 83577140
$STADTSTAATEN = 'BE', 'HB', 'HH'
# Bekannte Staaten (km², bpb nach CIA World Factbook, Stand 05/2018)
$STAATEN = [ordered]@{ 'Belgien' = 30528; 'den Niederlanden' = 41543; 'der Schweiz' = 41277; 'Österreich' = 83871; 'Dänemark' = 43094; 'Luxemburg' = 2586; 'Irland' = 70273; 'Tschechien' = 78867; 'Slowenien' = 20273 }
# Staatsgrenzen (Landgrenzen; Bodensee ohne festgelegte Grenze, daher Schweiz/Österreich nicht verwendet)
$AUSLAND = @{ SH = 'Dänemark'; NI = 'die Niederlande'; NW = 'die Niederlande,Belgien'; RP = 'Frankreich,Luxemburg,Belgien'; SL = 'Frankreich,Luxemburg'; SN = 'Polen,Tschechien'; BB = 'Polen'; MV = 'Polen'; BY = 'Tschechien'; BW = 'Frankreich' }
# Regionale gesetzliche Feiertage, die im ganzen Land gelten (ohne nur teilweise geltende wie Fronleichnam in SN/TH, Mariä Himmelfahrt in BY)
$FEIERTAGE = [ordered]@{
  'Heilige Drei Könige (6. Januar)' = 'BW,BY,ST'
  'der Internationale Frauentag (8. März)' = 'BE,MV'
  'Fronleichnam' = 'BW,BY,HE,NW,RP,SL'
  'Mariä Himmelfahrt (15. August)' = 'SL'
  'der Reformationstag (31. Oktober)' = 'BB,HB,HH,MV,NI,SN,ST,SH,TH'
  'Allerheiligen (1. November)' = 'BW,BY,NW,RP,SL'
  'der Buß- und Bettag' = 'SN'
}
# Gibt es schon als Fakt (Art|Land) – nicht noch einmal erzeugen
$SCHON_DA = 'nachbarn|BB', 'nachbarn|HE', 'nachbarn|HB', 'nachbarn|NW', 'nachbarn|ST', 'nachbarn|TH', 'nachbarn|SH', 'nachbarn|RP',
  'ausland|SN', 'ausland|RP', 'ausland|SH', 'feiertag-frauentag|BE', 'feiertag-frauentag|MV', 'feiertag-reformation|SH', 'feiertag-reformation|HB',
  'feiertag-mariae|SL', 'anteil|NW', 'dichte-min|MV', 'flaeche-kleinste|SL', 'ausland|TH', 'ausland|HE', 'ausland|ST', 'ausland|HB', 'feiertag-weltkindertag|TH'
$ZAHL = @{ 1 = 'eins'; 2 = 'zwei'; 3 = 'drei'; 4 = 'vier'; 5 = 'fünf'; 6 = 'sechs'; 7 = 'sieben'; 8 = 'acht'; 9 = 'neun' }
$NTE = @{ 4 = 'vierte'; 5 = 'fünfte'; 6 = 'sechste'; 7 = 'siebte'; 8 = 'achte'; 9 = 'neunte'; 10 = 'zehnte'; 11 = 'elfte'; 12 = 'zwölfte'; 13 = 'dreizehnte' }

# Nachbarschaften aus der Karte: zwei Länder grenzen aneinander, wenn ihre Umrisse mindestens 3 gemeinsame Punkte haben
$map = Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot '..\data\map.json') | ConvertFrom-Json
$pts = @{}; foreach ($p in $map.states.PSObject.Properties) { $set = New-Object System.Collections.Generic.HashSet[string]; foreach ($mm in [regex]::Matches($p.Value.d, '-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?')) { [void]$set.Add($mm.Value) }; $pts[$p.Name] = $set }
$NACHBARN = @{}; foreach ($a in $L.Keys) { $NACHBARN[$a] = @(foreach ($b in $L.Keys) { if ($b -ne $a) { $c = 0; foreach ($q in $pts[$a]) { if ($pts[$b].Contains($q)) { $c++; if ($c -ge 3) { break } } }; if ($c -ge 3) { $b } } }) }

$k = New-Object System.Collections.ArrayList
function Add($land, $art, $passend, $text, $kat, $thema, $denkweg, $quelle, $zeit, $notiz) {
  if ($SCHON_DA -contains "$art|$land") { return }
  $passend = @($passend | Select-Object -Unique); if ($passend -notcontains $land) { return }
  $stufe = if ($passend.Count -ge 4) { 1 } elseif ($passend.Count -ge 2) { 2 } else { 3 }
  [void]$k.Add([pscustomobject]@{ land = $land; art = $art; stufe = $stufe; passt = $passend.Count; text = $text; trifft_auch_zu = (@($passend | Where-Object { $_ -ne $land }) -join ','); kategorie = $kat; thema = $thema; denkweg = $denkweg; quelle = $quelle; zeitabhaengig = $zeit; notiz = $notiz })
}
function InName($id) { if ($id -eq 'SL') { 'im Saarland' } else { "in $($L[$id].name)" } }
function Fmt($n) { ([double]$n).ToString('N0', [Globalization.CultureInfo]'de-DE') }

foreach ($id in $L.Keys) {
  $x = $L[$id]
  # Fläche: etwa so groß wie ein bekannter Staat (±6 %); trifft = alle Länder in derselben Spanne
  foreach ($s in $STAATEN.Keys) {
    $pass = @($L.Keys | Where-Object { [math]::Abs($L[$_].km2 / $STAATEN[$s] - 1) -le 0.06 })
    if ($pass -contains $id) { Add $id 'flaeche-staat' $pass "Dieses Land ist etwa so groß wie $s." 'Geografie' 'Geografie' 'Herleitung' "$Q_DESTATIS $Q_STAATEN" 'nein' "Fläche $(Fmt $x.km2) km² (Destatis, $STICHTAG) gegenüber $(Fmt $STAATEN[$s]) km² (bpb/CIA Factbook 2018), Abweichung höchstens 6 %." }
  }
  # Fläche: das Saarland passt mehr als N-mal hinein (nur größere Flächenländer)
  if ($id -ne 'SL' -and $STADTSTAATEN -notcontains $id -and $x.km2 / $L.SL.km2 -ge 6) {
    $n = [math]::Floor($x.km2 / $L.SL.km2)
    $pass = @($L.Keys | Where-Object { [math]::Floor($L[$_].km2 / $L.SL.km2) -eq $n })
    Add $id 'saarland' $pass "Das Saarland passt mehr als $n-mal in dieses Land." 'Geografie' 'Geografie' 'Herleitung' $Q_DESTATIS 'nein' "Fläche $(Fmt $x.km2) km² : Saarland $(Fmt $L.SL.km2) km² = $([math]::Round($x.km2 / $L.SL.km2, 1)) (Destatis, $STICHTAG)."
  }
  # Einwohner: etwa jeder N-te Einwohner Deutschlands lebt hier (N ≤ 13, Abweichung ≤ 8 %)
  $n = [math]::Round($DE_EW / $x.ew)
  if ($n -ge 4 -and $n -le 13 -and [math]::Abs($n * $x.ew / $DE_EW - 1) -le 0.08) {
    $pass = @($L.Keys | Where-Object { [math]::Round($DE_EW / $L[$_].ew) -eq $n })
    Add $id 'anteil' $pass "Etwa jeder $($NTE[[int]$n]) Einwohner Deutschlands lebt hier." 'Geografie' 'Bevölkerung und Städte' 'Herleitung' $Q_DESTATIS 'ja' "Einwohner $(Fmt $x.ew) von $(Fmt $DE_EW) (Destatis, $STICHTAG) = 1/$([math]::Round($DE_EW / $x.ew, 2)); als Rangfolge stabil."
  }
  # Einwohner: mehr als zwei andere Länder zusammen (Abstand mindestens 5 %, damit stabil); das Paar mit der größten Summe
  $best = $null
  foreach ($a in $L.Keys) { foreach ($b in $L.Keys) { if ($a -lt $b -and $a -ne $id -and $b -ne $id) {
    $sum = $L[$a].ew + $L[$b].ew
    if ($sum * 1.05 -le $x.ew -and (-not $best -or $sum -gt $best.sum)) { $best = @{ a = $a; b = $b; sum = $sum } } } } }
  if ($best -and $best.sum -ge 0.6 * $x.ew) {
    $pass = @($L.Keys | Where-Object { $L[$_].ew -ge $best.sum * 1.05 -and $_ -ne $best.a -and $_ -ne $best.b })
    Add $id 'mehr-als-zwei' $pass "Hier leben mehr Menschen als $(InName $best.a) und $(InName $best.b) zusammen." 'Geografie' 'Bevölkerung und Städte' 'Herleitung' $Q_DESTATIS 'ja' "$(Fmt $x.ew) gegenüber $(Fmt $L[$best.a].ew) + $(Fmt $L[$best.b].ew) = $(Fmt $best.sum) Einwohner (Destatis, $STICHTAG), Abstand mindestens 5 %."
  }
  # Dichte
  if ($x.dichte -lt 100) { Add $id 'dichte-unter100' @($L.Keys | Where-Object { $L[$_].dichte -lt 100 }) 'Hier leben weniger als 100 Menschen auf einem Quadratkilometer.' 'Geografie' 'Bevölkerung und Städte' 'Herleitung' $Q_DESTATIS 'ja' "Dichte $($x.dichte) Ew./km² (Destatis, $STICHTAG); alle anderen Länder über 100." }
  if ($x.dichte -gt 1000) { Add $id 'dichte-ueber1000' @($L.Keys | Where-Object { $L[$_].dichte -gt 1000 }) 'Auf jedem Quadratkilometer leben hier im Schnitt mehr als 1.000 Menschen.' 'Geografie' 'Bevölkerung und Städte' 'Herleitung' $Q_DESTATIS 'ja' "Dichte $($x.dichte) Ew./km² (Destatis, $STICHTAG)." }
  $minDichte = ($L.Keys | Sort-Object { $L[$_].dichte })[0]
  if ($id -eq $minDichte) { Add $id 'dichte-min' @($id) 'Das am dünnsten besiedelte Bundesland.' 'Geografie' 'Bevölkerung und Städte' 'Herleitung' $Q_DESTATIS 'ja' '' }
  # Landeshauptstadt (nur Flächenländer)
  if ($STADTSTAATEN -notcontains $id) {
    $fl = @($L.Keys | Where-Object { $STADTSTAATEN -notcontains $_ })
    $minHs = ($fl | Sort-Object { $L[$_].hsEw })[0]
    if ($id -eq $minHs) { Add $id 'hs-kleinste' @($id) 'Keine andere Landeshauptstadt hat so wenige Einwohner wie die dieses Landes.' 'Geografie' 'Bevölkerung und Städte' 'Herleitung' $Q_DESTATIS 'ja' "$($x.hs) $(Fmt $x.hsEw) Einwohner, kleinste Landeshauptstadt (Destatis, $STICHTAG)." }
    if ($x.hsEw -lt 200000) { Add $id 'hs-unter200k' @($fl | Where-Object { $L[$_].hsEw -lt 200000 }) 'Die Landeshauptstadt hat weniger als 200.000 Einwohner.' 'Geografie' 'Bevölkerung und Städte' 'Herleitung' $Q_DESTATIS 'ja' "$($x.hs) $(Fmt $x.hsEw) Einwohner (Destatis, $STICHTAG)." }
    if ($x.hsKm2 -lt 100) { Add $id 'hs-flaeche' @($fl | Where-Object { $L[$_].hsKm2 -lt 100 }) 'Die Landeshauptstadt ist kleiner als 100 Quadratkilometer, kleiner als jede andere.' 'Geografie' 'Bevölkerung und Städte' 'Herleitung' $Q_DESTATIS 'nein' "$($x.hs) $($x.hsKm2) km² (Destatis, $STICHTAG)." }
    $anteil = $x.hsEw / $x.ew
    if ($anteil -ge 0.1) { $n = [math]::Round(1 / $anteil); if ($n -ge 2 -and $n -le 9 -and [math]::Abs($n * $anteil - 1) -le 0.1) {
      $pass = @($fl | Where-Object { [math]::Round($L[$_].ew / $L[$_].hsEw) -eq $n -and [math]::Abs($n * $L[$_].hsEw / $L[$_].ew - 1) -le 0.1 })
      Add $id 'hs-anteil' $pass "Etwa jeder $($NTE[[int]$n]) Einwohner dieses Landes lebt in der Landeshauptstadt." 'Geografie' 'Bevölkerung und Städte' 'Herleitung' $Q_DESTATIS 'ja' "$($x.hs) $(Fmt $x.hsEw) von $(Fmt $x.ew) (Destatis, $STICHTAG)." } }
  }
  # Nachbarn (Bundesländer) und Staaten
  $nb = $NACHBARN[$id].Count
  $pass = @($L.Keys | Where-Object { $NACHBARN[$_].Count -eq $nb })
  $txt = if ($nb -eq 1) { 'Grenzt an genau ein anderes Bundesland.' } else { "Grenzt an $($ZAHL[$nb]) andere Bundesländer." }
  Add $id 'nachbarn' $pass $txt 'Geografie' 'Geografie' 'Herleitung' $Q_KARTE 'nein' "Nachbarn laut Karte: $($NACHBARN[$id] -join ', ')."
  if (-not $AUSLAND[$id]) { Add $id 'ausland' @($L.Keys | Where-Object { -not $AUSLAND[$_] }) 'Grenzt an keinen anderen Staat.' 'Geografie' 'Geografie' 'Herleitung' $Q_KARTE 'nein' 'Keine Staatsgrenze (Binnenland in Deutschland).' }
  foreach ($staat in "$($AUSLAND[$id])".Split(',') | Where-Object { $_ }) {
    $pass = @($L.Keys | Where-Object { "$($AUSLAND[$_])".Split(',') -contains $staat })
    if ($pass.Count -ge 2) { Add $id "ausland-$staat" $pass "Grenzt an $staat." 'Geografie' 'Geografie' 'Herleitung' $Q_KARTE 'nein' "Staatsgrenzen: $(($pass | ForEach-Object { "$_ ($($AUSLAND[$_]))" }) -join '; ')." }
  }
  # Feiertage, die nur einige Länder landesweit haben
  foreach ($ft in $FEIERTAGE.Keys) {
    $pass = @($FEIERTAGE[$ft].Split(','))
    $art = 'feiertag-' + $(switch -Wildcard ($ft) { '*Drei*' { 'dreikoenige' } '*Frauen*' { 'frauentag' } 'Fronl*' { 'fronleichnam' } '*Mariä*' { 'mariae' } '*Reform*' { 'reformation' } 'Allerh*' { 'allerheiligen' } '*Buß*' { 'buss' } })
    $txt = if ($art -eq 'feiertag-mariae') { "Mariä Himmelfahrt (15. August) ist hier im ganzen Land gesetzlicher Feiertag." } else { "$($ft.Substring(0,1).ToUpper())$($ft.Substring(1)) ist hier im ganzen Land gesetzlicher Feiertag." }
    Add $id $art $pass $txt 'Alltag' 'Feste und Bräuche' $(if ($pass.Count -eq 1) { 'Wissen' } else { 'Herleitung' }) $Q_FEIERTAGE 'nein' "Landesweit gesetzlicher Feiertag in: $($FEIERTAGE[$ft]) (DGB-Übersicht nach den Feiertagsgesetzen der Länder, Stand 09/2026; nur teilweise geltende Länder nicht mitgezählt)."
  }
}

if ($Alle) { $k | Sort-Object land, stufe | Format-Table land, stufe, passt, art, text -AutoSize | Out-String -Width 220 | Write-Host; return }

# Auswahl je Land: erst Stufe 2 (grenzt gut ein), dann 3, dann 1; je Art-Familie höchstens einmal je Land
$csv = Import-Csv -Path (Join-Path $PSScriptRoot '..\data\fakten.csv') -Delimiter ';' -Encoding UTF8
$rang = @{ 2 = 0; 3 = 1; 1 = 2 }
$auswahl = @(); $artZahl = @{} # jede Art insgesamt höchstens 4-mal
foreach ($id in $L.Keys) {
  $nimm = @(); $familien = @()
  foreach ($c in ($k | Where-Object { $_.land -eq $id } | Sort-Object { $rang[$_.stufe] }, art)) {
    if ($nimm.Count -ge $ProLand) { break }
    $fam = ($c.art -split '-')[0]; if ($familien -contains $fam) { continue }
    if ($artZahl[$c.art] -ge 4) { continue }
    $nimm += $c; $familien += $fam; $artZahl[$c.art] = 1 + [int]$artZahl[$c.art]
  }
  $nr = @{}
  foreach ($c in $nimm) {
    $kat = @{ 'Geografie' = 'GEO'; 'Alltag' = 'ALL' }[$c.kategorie]
    if (-not $nr[$kat]) { $nr[$kat] = 1 + [int](@($csv | Where-Object { $_.id -match "^$id-$kat-(\d{3})$" } | ForEach-Object { [int]($_.id.Substring($_.id.Length - 3)) }) | Measure-Object -Maximum).Maximum }
    $auswahl += [pscustomobject][ordered]@{
      id = '{0}-{1}-{2:000}' -f $id, $kat, $nr[$kat]; land = $id; kategorie = $c.kategorie; thema = $c.thema; denkweg = $c.denkweg; stufe = $c.stufe
      text = $c.text; trifft_auch_zu = $c.trifft_auch_zu; quelle = $c.quelle; zeitabhaengig = $c.zeitabhaengig; status = 'geprüft'
      pruefnotiz = "Berechnet mit tools/zahlenhinweise.ps1 ($($c.art)): passt auf $($c.passt) Länder. $($c.notiz)".Trim()
    }
    $nr[$kat]++
  }
}
[IO.File]::WriteAllText($Ausgabe, (ConvertTo-Json @($auswahl) -Depth 3), (New-Object System.Text.UTF8Encoding($false)))
$auswahl | Format-Table id, stufe, denkweg, trifft_auch_zu, text -AutoSize | Out-String -Width 220 | Write-Host
Write-Host "$($auswahl.Count) berechnete Hinweise nach $Ausgabe geschrieben."
