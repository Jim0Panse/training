# Zeichnet die App-Icons (schlichte Hantel auf Akzentfarbe) nach fitness-app/icons.
# Start:  powershell -NoProfile -ExecutionPolicy Bypass -File fitness-app/tools/make-icons.ps1
Add-Type -AssemblyName System.Drawing

$out = Join-Path $PSScriptRoot '..\icons'
New-Item -ItemType Directory -Force $out | Out-Null

function New-RoundedRect([single]$x, [single]$y, [single]$w, [single]$h, [single]$r) {
  $p = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $p.AddArc($x, $y, 2 * $r, 2 * $r, 180, 90)
  $p.AddArc($x + $w - 2 * $r, $y, 2 * $r, 2 * $r, 270, 90)
  $p.AddArc($x + $w - 2 * $r, $y + $h - 2 * $r, 2 * $r, 2 * $r, 0, 90)
  $p.AddArc($x, $y + $h - 2 * $r, 2 * $r, 2 * $r, 90, 90)
  $p.CloseFigure()
  return $p
}

# $scale: Groesse der Hantel relativ zum Icon (maskable braucht mehr Rand)
function Save-Icon([int]$size, [string]$name, [double]$scale) {
  $bmp = [System.Drawing.Bitmap]::new($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.PixelOffsetMode = 'HighQuality'

  # Hintergrund: Akzentfarbe mit leichtem Verlauf (vollflaechig, iOS rundet selbst ab)
  $rect = [System.Drawing.Rectangle]::new(0, 0, $size, $size)
  $top = [System.Drawing.Color]::FromArgb(255, 104, 120, 255)
  $bottom = [System.Drawing.Color]::FromArgb(255, 68, 85, 240)
  $bg = [System.Drawing.Drawing2D.LinearGradientBrush]::new($rect, $top, $bottom, 90)
  $g.FillRectangle($bg, $rect)

  # Hantel, entworfen auf 512 px, mittig
  $k = $size / 512.0 * $scale
  $c = $size / 2.0
  function P([double]$v) { return [single]($c + $v * $k) }
  function L([double]$v) { return [single]($v * $k) }
  $white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)

  # Stange
  $g.FillPath($white, (New-RoundedRect (P -150) (P -13) (L 300) (L 26) (L 13)))
  # innere Scheiben
  foreach ($x in @(-104, 64)) { $g.FillPath($white, (New-RoundedRect (P $x) (P -92) (L 40) (L 184) (L 18))) }
  # aeussere Scheiben
  foreach ($x in @(-140, 108)) { $g.FillPath($white, (New-RoundedRect (P $x) (P -62) (L 32) (L 124) (L 14))) }

  $g.Dispose()
  $bmp.Save((Join-Path $out $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "$name ($size px)"
}

Save-Icon 180 'icon-180.png' 1.0
Save-Icon 192 'icon-192.png' 1.0
Save-Icon 512 'icon-512.png' 1.0
Save-Icon 512 'icon-maskable-512.png' 0.78
