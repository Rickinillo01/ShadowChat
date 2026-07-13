# Simple HTTP server for local development
# Usage: powershell -File serve.ps1
# Then open http://localhost:3001

$port = 3001
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host ""
Write-Host "  ShadowChat dev server running at http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Tip: Type 'shadow' on the keyboard to reveal the hidden chat!" -ForegroundColor DarkGray
Write-Host "  Press Ctrl+C to stop the server." -ForegroundColor DarkGray
Write-Host ""

$rootDir = $PSScriptRoot

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $urlPath = $request.Url.LocalPath
    if ($urlPath -eq '/') { $urlPath = '/index.html' }

    $filePath = Join-Path $rootDir $urlPath.TrimStart('/')

    if (Test-Path $filePath) {
        $ext = [System.IO.Path]::GetExtension($filePath)
        $mimeType = switch ($ext) {
            '.html' { 'text/html; charset=utf-8' }
            '.css'  { 'text/css; charset=utf-8' }
            '.js'   { 'application/javascript; charset=utf-8' }
            '.json' { 'application/json; charset=utf-8' }
            '.svg'  { 'image/svg+xml' }
            '.png'  { 'image/png' }
            '.ico'  { 'image/x-icon' }
            '.woff2' { 'font/woff2' }
            default { 'application/octet-stream' }
        }

        $response.ContentType = $mimeType
        $response.StatusCode = 200

        $content = [System.IO.File]::ReadAllBytes($filePath)
        $response.ContentLength64 = $content.Length
        $response.OutputStream.Write($content, 0, $content.Length)
        
        Write-Host "  200 $urlPath" -ForegroundColor Green
    } else {
        $response.StatusCode = 404
        $errorBytes = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
        $response.OutputStream.Write($errorBytes, 0, $errorBytes.Length)
        
        Write-Host "  404 $urlPath" -ForegroundColor Red
    }

    $response.Close()
}
