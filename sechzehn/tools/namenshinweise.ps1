# Erzeugt Namens-Hinweise aus den 16 gebräuchlichen Ländernamen (Kurzform, Bindestrich-Namen als ein Name) und berechnet
# trifft_auch_zu exakt. Stufe: passt auf >= 4 Länder → 1, auf 2–3 → 2, eindeutig → 3 (nur nicht-triviale Eigenschaften).
# Kategorie Alltag, Thema „Sprache und Identität“, Denkweg Herleitung, Quelle „berechnet aus dem Ländernamen“, Status geprüft.
# Je Land höchstens -ProLand Hinweise (Standard 2), ausgewählt nach Vorrang der Eigenschaften (interessant vor banal) und so,
# dass ein Land nicht zweimal dieselbe Art bekommt. IDs: LAND-ALL-NNN ab der höchsten vorhandenen Nummer + 1.
# Aufruf: & .\tools\namenshinweise.ps1 [-Ausgabe namenshinweise.json] [-ProLand 2] [-Alle]
#   -Alle: alle Kandidaten ausgeben (ohne Auswahl, ohne IDs), zum Durchsehen.
# Danach einspielen: & .\tools\pruefung-einspielen.ps1 namenshinweise.json
param([string]$Ausgabe = (Join-Path $PSScriptRoot '..\arbeit\namenshinweise.json'), [int]$ProLand = 2, [switch]$Alle)

$NAMEN = [ordered]@{
  BW = 'Baden-Württemberg'; BY = 'Bayern'; BE = 'Berlin'; BB = 'Brandenburg'; HB = 'Bremen'; HH = 'Hamburg'; HE = 'Hessen'
  MV = 'Mecklenburg-Vorpommern'; NI = 'Niedersachsen'; NW = 'Nordrhein-Westfalen'; RP = 'Rheinland-Pfalz'; SL = 'Saarland'
  SN = 'Sachsen'; ST = 'Sachsen-Anhalt'; SH = 'Schleswig-Holstein'; TH = 'Thüringen'
}
$ZAHL = @{ 1 = 'einem'; 2 = 'zwei'; 3 = 'drei'; 4 = 'vier'; 5 = 'fünf'; 6 = 'sechs'; 7 = 'sieben'; 8 = 'acht' }
$MAL = @{ 0 = 'kein'; 1 = 'einmal'; 2 = 'zweimal'; 3 = 'dreimal'; 4 = 'viermal' }
function Buchstaben($n) { ($n -replace '[^\p{L}]', '').ToLower() }

# Eigenschaften: Art, Vorrang (kleiner = interessanter), Test je Name, Text (darf vom Land abhängen)
$arten = @(
  @{ art = 'steckt'; rang = 1; test = { param($id, $n) @($NAMEN.Keys | Where-Object { $_ -ne $id -and $n.ToLower().Contains($NAMEN[$_].ToLower()) }).Count -gt 0 }
     text = { 'Im Namen dieses Landes steckt der Name eines anderen Bundeslandes.' } }
  @{ art = 'anfang-ende'; rang = 2; test = { param($id, $n) $b = Buchstaben $n; $b[0] -eq $b[-1] }
     text = { 'Der Name dieses Landes beginnt und endet mit demselben Buchstaben.' } }
  @{ art = 'ohne-e'; rang = 3; test = { param($id, $n) -not (Buchstaben $n).Contains('e') }
     text = { 'Im Namen dieses Landes kommt kein „e“ vor.' } }
  @{ art = 'ohne-a'; rang = 4; test = { param($id, $n) -not (Buchstaben $n).Contains('a') }
     text = { 'Im Namen dieses Landes kommt kein „a“ vor.' } }
  @{ art = 'doppelt'; rang = 5; test = { param($id, $n) (Buchstaben $n) -match '(\p{L})\1' }
     text = { 'Im Namen dieses Landes steht ein Buchstabe doppelt hintereinander.' } }
  @{ art = 'umlaut'; rang = 6; test = { param($id, $n) $n -match '[äöüÄÖÜ]' }
     text = { 'Der Name dieses Landes enthält einen Umlaut.' } }
  @{ art = 'burg'; rang = 7; test = { param($id, $n) $n.ToLower().Contains('burg') }
     text = { 'Im Namen dieses Landes steckt eine „Burg“.' } }
  @{ art = 'laenge'; rang = 8; key = { param($id, $n) (Buchstaben $n).Length }
     text = { param($id, $n) $l = (Buchstaben $n).Length; if ($n.Contains('-')) { "Der Name dieses Landes hat $l Buchstaben (ohne Bindestrich)." } else { "Der Name dieses Landes hat $l Buchstaben." } } }
  @{ art = 'endet-en'; rang = 9; test = { param($id, $n) $n.EndsWith('en') }
     text = { 'Der Name dieses Landes endet auf „-en“.' } }
  @{ art = 'anfang-geteilt'; rang = 10; key = { param($id, $n) $n.Substring(0, 1) }
     text = { param($id, $n) $k = @($NAMEN.Keys | Where-Object { $_ -ne $id -and $NAMEN[$_][0] -eq $n[0] }).Count
       if ($k -eq 1) { 'Der Name dieses Landes beginnt mit demselben Buchstaben wie der Name genau eines anderen Landes.' }
       else { "Der Name dieses Landes beginnt mit demselben Buchstaben wie die Namen von $($ZAHL[$k]) anderen Ländern." } } }
  @{ art = 'bindestrich'; rang = 11; test = { param($id, $n) $n.Contains('-') }
     text = { 'Der Name dieses Landes besteht aus zwei Teilen, die ein Bindestrich verbindet.' } }
)

# Kandidaten: für jede Art und jedes Land, auf das sie zutrifft, die Menge aller passenden Länder
$kandidaten = foreach ($a in $arten) {
  foreach ($id in $NAMEN.Keys) {
    $n = $NAMEN[$id]
    if ($a.key) { $wert = & $a.key $id $n; $passend = @($NAMEN.Keys | Where-Object { (& $a.key $_ $NAMEN[$_]) -eq $wert }) }
    else { if (-not (& $a.test $id $n)) { continue }; $passend = @($NAMEN.Keys | Where-Object { & $a.test $_ $NAMEN[$_] }) }
    if ($a.art -eq 'anfang-geteilt' -and $passend.Count -lt 2) { continue } # Anfangsbuchstabe allein: kein Hinweis
    $andere = @($passend | Where-Object { $_ -ne $id })
    $stufe = if ($passend.Count -ge 4) { 1 } elseif ($passend.Count -ge 2) { 2 } else { 3 }
    # Eindeutige Eigenschaften nur, wenn nicht trivial: die bloße Länge des längsten/kürzesten Namens ist trivial
    if ($stufe -eq 3 -and $a.art -eq 'laenge') { continue }
    [pscustomobject]@{ land = $id; art = $a.art; rang = $a.rang; stufe = $stufe; text = (& $a.text $id $n); trifft_auch_zu = ($andere -join ','); passt = $passend.Count }
  }
}

if ($Alle) { $kandidaten | Sort-Object land, rang | Format-Table land, stufe, passt, art, text -AutoSize | Out-String -Width 200 | Write-Host; return }

# Auswahl: je Land die ProLand Kandidaten mit dem kleinsten Rang, verschiedene Arten; jede Art insgesamt höchstens 4-mal,
# damit der Pool abwechslungsreich bleibt
$csv = Import-Csv -Path (Join-Path $PSScriptRoot '..\data\fakten.csv') -Delimiter ';' -Encoding UTF8
$artZahl = @{}; $auswahl = @()
foreach ($id in $NAMEN.Keys) {
  $nimm = @()
  # Vorrang: erst Hinweise für 2–3 Länder (Stufe 2, grenzen gut ein), dann nach Rang der Art
  foreach ($k in ($kandidaten | Where-Object { $_.land -eq $id } | Sort-Object @{ e = { [int]($_.stufe -ne 2) } }, rang)) {
    if ($nimm.Count -ge $ProLand) { break }
    if ($artZahl[$k.art] -ge 4) { continue }
    if (@($nimm | Where-Object { $_.trifft_auch_zu -eq $k.trifft_auch_zu }).Count) { continue } # zweiter Hinweis: andere Ländergruppe
    $nimm += $k; $artZahl[$k.art] = 1 + [int]$artZahl[$k.art]
  }
  $nr = 1 + [int](@($csv | Where-Object { $_.id -match "^$id-ALL-(\d{3})$" } | ForEach-Object { [int]($_.id.Substring($_.id.Length - 3)) }) | Measure-Object -Maximum).Maximum
  foreach ($k in $nimm) {
    $auswahl += [pscustomobject][ordered]@{
      id = '{0}-ALL-{1:000}' -f $id, $nr; land = $id; kategorie = 'Alltag'; thema = 'Sprache und Identität'; denkweg = 'Herleitung'
      stufe = $k.stufe; text = $k.text; trifft_auch_zu = $k.trifft_auch_zu; quelle = 'berechnet aus dem Ländernamen'; zeitabhaengig = 'nein'
      status = 'geprüft'; pruefnotiz = "Berechnet mit tools/namenshinweise.ps1 ($($k.art)): passt auf $($k.passt) Länder, Stufe nach Anzahl."
    }
    $nr++
  }
}
$json = ConvertTo-Json @($auswahl) -Depth 3
[IO.File]::WriteAllText($Ausgabe, $json, (New-Object System.Text.UTF8Encoding($false)))
$auswahl | Format-Table id, stufe, trifft_auch_zu, text -AutoSize | Out-String -Width 200 | Write-Host
Write-Host "$($auswahl.Count) Namens-Hinweise nach $Ausgabe geschrieben."
