$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")
$outLog = Join-Path $PSScriptRoot "dev.out.log"
$errLog = Join-Path $PSScriptRoot "dev.err.log"
$resultJson = Join-Path $PSScriptRoot "measurement.json"

function Test-UrlReady($url) {
  try {
    Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Measure-Request($url, $headers = @{}) {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 30 -Headers $headers
    $sw.Stop()
    return [ordered]@{
      url = $url
      ok = $true
      status = [int]$response.StatusCode
      elapsedMs = [int]$sw.ElapsedMilliseconds
      location = $response.Headers.Location
      contentLength = $response.RawContentLength
    }
  } catch {
    $sw.Stop()
    $status = $null
    $location = $null
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
      $location = $_.Exception.Response.Headers["Location"]
    }
    return [ordered]@{
      url = $url
      ok = $false
      status = $status
      elapsedMs = [int]$sw.ElapsedMilliseconds
      location = $location
      error = $_.Exception.Message
    }
  }
}

function Measure-SessionRequest($url, $session, $headers = @{}) {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $response = Invoke-WebRequest -Uri $url -WebSession $session -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 30 -Headers $headers
    $sw.Stop()
    return [ordered]@{
      url = $url
      ok = $true
      status = [int]$response.StatusCode
      elapsedMs = [int]$sw.ElapsedMilliseconds
      location = $response.Headers.Location
      contentLength = $response.RawContentLength
    }
  } catch {
    $sw.Stop()
    $status = $null
    $location = $null
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
      $location = $_.Exception.Response.Headers["Location"]
    }
    return [ordered]@{
      url = $url
      ok = $false
      status = $status
      elapsedMs = [int]$sw.ElapsedMilliseconds
      location = $location
      error = $_.Exception.Message
    }
  }
}

function Try-SignInDemoSeller {
  $body = @{
    email = "seller-fashion@example.com"
    password = "DemoPass123!"
  } | ConvertTo-Json

  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $response = Invoke-WebRequest `
      -Uri "http://localhost:3000/api/auth/sign-in/email" `
      -Method Post `
      -Body $body `
      -ContentType "application/json" `
      -UseBasicParsing `
      -SessionVariable session `
      -TimeoutSec 30
    $sw.Stop()
    return [ordered]@{
      ok = $true
      status = [int]$response.StatusCode
      elapsedMs = [int]$sw.ElapsedMilliseconds
      session = $session
    }
  } catch {
    $sw.Stop()
    $status = $null
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
    }
    return [ordered]@{
      ok = $false
      status = $status
      elapsedMs = [int]$sw.ElapsedMilliseconds
      error = $_.Exception.Message
      session = $null
    }
  }
}

New-Item -ItemType Directory -Force -Path $PSScriptRoot | Out-Null
Remove-Item -LiteralPath $outLog, $errLog, $resultJson -Force -ErrorAction SilentlyContinue

$process = Start-Process `
  -FilePath "bun" `
  -ArgumentList @("run", "dev") `
  -WorkingDirectory $root.Path `
  -RedirectStandardOutput $outLog `
  -RedirectStandardError $errLog `
  -WindowStyle Hidden `
  -PassThru

try {
  $ready = $false
  for ($i = 0; $i -lt 45; $i++) {
    Start-Sleep -Seconds 1
    if ((Test-UrlReady "http://localhost:3000") -and (Test-UrlReady "http://localhost:3001/api/health")) {
      $ready = $true
      break
    }
  }

  $signIn = Try-SignInDemoSeller
  $authenticatedRequests = @()
  if ($signIn.ok -and $signIn.session) {
    $authenticatedRequests = @(
      (Measure-SessionRequest "http://localhost:3000/th/seller" $signIn.session @{ "Accept" = "text/html" }),
      (Measure-SessionRequest "http://localhost:3000/th/seller" $signIn.session @{ "Accept" = "text/html" }),
      (Measure-SessionRequest "http://localhost:3001/api/seller/dashboard" $signIn.session),
      (Measure-SessionRequest "http://localhost:3001/api/seller/dashboard" $signIn.session)
    )
  }

  $signInForJson = [ordered]@{
    ok = $signIn.ok
    status = $signIn.status
    elapsedMs = $signIn.elapsedMs
    error = $signIn.error
  }

  $results = [ordered]@{
    measuredAt = (Get-Date).ToString("o")
    ready = $ready
    notes = @(
      "Browser/manual auth acceptance flow was intentionally not performed by builder-agent.",
      "Authenticated measurements use the local demo seller seed credential seller-fashion@example.com / DemoPass123! when present.",
      "Measurements are HTTP-level route/API timings; they do not include browser hydration, JS chunk loading, or visual paint timing."
    )
    signIn = $signInForJson
    unauthenticatedRequests = @(
      (Measure-Request "http://localhost:3000/th/seller" @{ "Accept" = "text/html" }),
      (Measure-Request "http://localhost:3000/th/seller" @{ "Accept" = "text/html" }),
      (Measure-Request "http://localhost:3001/api/seller/dashboard"),
      (Measure-Request "http://localhost:3001/api/seller/dashboard")
    )
    authenticatedRequests = $authenticatedRequests
  }

  $results | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $resultJson -Encoding UTF8
  $results | ConvertTo-Json -Depth 6
} finally {
  if ($process -and -not $process.HasExited) {
    taskkill /PID $process.Id /T /F | Out-Null
  }
}
