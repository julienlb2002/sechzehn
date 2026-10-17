# Nimmt die von tools/karte-erzeugen.html erzeugte Karte entgegen und schreibt sie nach data/map.json (UTF-8 ohne BOM).
# Aufruf: & .\tools\karte-speichern.ps1 [-Port 8001]
# Wartet auf genau eine Sendung an http://localhost:<Port>/, prüft, dass es gültiges JSON mit 16 Ländern ist, speichert und endet.
param([int]$Port = 8001)

$ziel = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\data\map.json'))
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
Write-Host "Warte auf die Karte an http://localhost:$Port/ ..."
try {
  while ($true) {
    $ctx = $l.GetContext(); $req = $ctx.Request; $res = $ctx.Response
    $res.Headers.Add('Access-Control-Allow-Origin', '*')
    if ($req.HttpMethod -ne 'POST') { $res.StatusCode = 204; $res.Close(); continue }
    $body = (New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)).ReadToEnd()
    $antwort = ''; $ok = $false
    try {
      Add-Type -AssemblyName System.Web.Extensions
      $js = New-Object System.Web.Script.Serialization.JavaScriptSerializer; $js.MaxJsonLength = 50MB
      $karte = $js.DeserializeObject($body)
      if ($karte['states'].Count -ne 16) { throw "erwartet 16 Länder, erhalten $($karte['states'].Count)" }
      [IO.File]::WriteAllText($ziel, $body, (New-Object System.Text.UTF8Encoding($false)))
      $antwort = "$ziel ($([math]::Round($body.Length / 1024)) KB, w=$($karte['w']), h=$($karte['h']))"
      Write-Host "Gespeichert: $antwort"; $ok = $true
    } catch { $res.StatusCode = 400; $antwort = "Nicht gespeichert: $($_.Exception.Message)"; Write-Host $antwort }
    $bytes = [Text.Encoding]::UTF8.GetBytes($antwort)
    $res.ContentType = 'text/plain; charset=utf-8'; $res.OutputStream.Write($bytes, 0, $bytes.Length); $res.Close()
    if ($ok) { break }
  }
} finally { $l.Stop() }
