$root = $PSScriptRoot
$port = 8765
$url = "http://localhost:$port/src/index.html"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host "My Space: $url"
Write-Host "Close this window to stop the server."
Start-Process $url

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $request = $context.Request
  $response = $context.Response

  $relative = [Uri]::UnescapeDataString($request.Url.LocalPath).TrimStart("/")
  if ($relative -eq "" -or $relative -eq "/") {
    $relative = "src/index.html"
  }

  $file = [IO.Path]::GetFullPath((Join-Path $root ($relative -replace "/", [IO.Path]::DirectorySeparatorChar)))
  $rootFull = [IO.Path]::GetFullPath($root)

  if (-not $file.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase)) {
    $response.StatusCode = 403
    $response.Close()
    continue
  }

  if (Test-Path $file -PathType Leaf) {
    $ext = [IO.Path]::GetExtension($file).ToLowerInvariant()
    $response.ContentType = switch ($ext) {
      ".css" { "text/css; charset=utf-8" }
      ".js" { "application/javascript; charset=utf-8" }
      ".json" { "application/json; charset=utf-8" }
      ".html" { "text/html; charset=utf-8" }
      default { "application/octet-stream" }
    }
    $bytes = [IO.File]::ReadAllBytes($file)
    $response.ContentLength64 = $bytes.Length
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $response.StatusCode = 404
  }

  $response.Close()
}
