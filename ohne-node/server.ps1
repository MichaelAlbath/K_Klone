param([int]$Port = 8080)

$root = $PSScriptRoot

$mimeTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
}

function Get-LanIp {
  try {
    return (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
      Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
      Select-Object -First 1).IPAddress
  } catch { return $null }
}

function Get-RequestPath($requestLine) {
  $parts = $requestLine -split ' '
  if ($parts.Length -lt 2) { return '/' }
  $path = [System.Uri]::UnescapeDataString($parts[1].Split('?')[0])
  if ($path -eq '/') { return '/host.html' }
  if ($path -eq '/host') { return '/host.html' }
  if ($path -eq '/play') { return '/play.html' }
  return $path
}

function Send-HttpResponse($stream, $statusCode, $statusText, $contentType, $bodyBytes) {
  $headers = "HTTP/1.1 $statusCode $statusText`r`n"
  $headers += "Content-Type: $contentType`r`n"
  $headers += "Content-Length: $($bodyBytes.Length)`r`n"
  $headers += "Connection: close`r`n"
  $headers += "Access-Control-Allow-Origin: *`r`n"
  $headers += "`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
  $stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($bodyBytes.Length -gt 0) {
    $stream.Write($bodyBytes, 0, $bodyBytes.Length)
  }
}

function Handle-Client($client) {
  try {
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII)
    $requestLine = $reader.ReadLine()
    if (-not $requestLine) { return }

    while (($line = $reader.ReadLine()) -and $line -ne '') {}

    $path = Get-RequestPath $requestLine
    $relative = $path.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
    $filePath = Join-Path $root $relative

    if (Test-Path $filePath -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
      $contentType = $mimeTypes[$ext]
      if (-not $contentType) { $contentType = 'application/octet-stream' }
      $body = [System.IO.File]::ReadAllBytes($filePath)
      Send-HttpResponse $stream 200 'OK' $contentType $body
    } else {
      $body = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
      Send-HttpResponse $stream 404 'Not Found' 'text/plain; charset=utf-8' $body
    }
  } catch {
  } finally {
    try { $client.Close() } catch {}
  }
}

$lanIp = Get-LanIp
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)

try {
  $listener.Start()
} catch {
  Write-Host ""
  Write-Host " FEHLER: Port $Port belegt. Bitte andere Programme schliessen." -ForegroundColor Red
  Write-Host " $($_.Exception.Message)" -ForegroundColor Red
  Read-Host "Enter zum Beenden"
  exit 1
}

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host "   QUIZ SERVER (ohne Node.js)" -ForegroundColor Cyan
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Beamer:  http://localhost:$Port/host.html" -ForegroundColor Green
if ($lanIp) {
  Write-Host "  Handy:   http://${lanIp}:$Port/play.html" -ForegroundColor Green
}
Write-Host ""
Write-Host "  Fenster NICHT schliessen waehrend des Quiz!" -ForegroundColor Yellow
Write-Host "  Internet noetig fuer Live-Verbindung." -ForegroundColor Yellow
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host ""

Start-Process "http://localhost:$Port/host.html"

while ($true) {
  $client = $listener.AcceptTcpClient()
  Handle-Client $client
}
