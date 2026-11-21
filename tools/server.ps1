# Minimaler statischer Webserver zum lokalen Testen der Trainings-App (kein Node/Python noetig).
# Start:  powershell -NoProfile -ExecutionPolicy Bypass -File fitness-app/tools/server.ps1 -Port 8100
param([int]$Port = 8100)

$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\') + '\'
$mime = @{
  '.html'        = 'text/html; charset=utf-8'
  '.js'          = 'text/javascript; charset=utf-8'
  '.css'         = 'text/css; charset=utf-8'
  '.json'        = 'application/json; charset=utf-8'
  '.webmanifest' = 'application/manifest+json; charset=utf-8'
  '.svg'         = 'image/svg+xml'
  '.png'         = 'image/png'
  '.jpg'         = 'image/jpeg'
  '.ico'         = 'image/x-icon'
  '.pdf'         = 'application/pdf'
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Training laeuft auf http://localhost:$Port/  (Strg+C zum Beenden)"

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $res = $ctx.Response
    try {
      $pfad = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
      if ([string]::IsNullOrEmpty($pfad) -or $pfad.EndsWith('/')) { $pfad = $pfad + 'index.html' }
      $datei = [System.IO.Path]::GetFullPath((Join-Path $root $pfad))

      if ($datei.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $datei -PathType Leaf)) {
        $bytes = [System.IO.File]::ReadAllBytes($datei)
        $ext = [System.IO.Path]::GetExtension($datei).ToLower()
        if ($mime.ContainsKey($ext)) { $res.ContentType = $mime[$ext] } else { $res.ContentType = 'application/octet-stream' }
        $res.Headers.Add('Cache-Control', 'no-store')
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $res.StatusCode = 404
        $bytes = [System.Text.Encoding]::UTF8.GetBytes('Nicht gefunden')
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      }
    } catch {
      Write-Host "Fehler bei $($ctx.Request.Url): $_"
    } finally {
      $res.Close()
    }
  }
} finally {
  $listener.Stop()
}
