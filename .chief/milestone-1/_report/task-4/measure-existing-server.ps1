$ErrorActionPreference = "Stop"

$resultJson = Join-Path $PSScriptRoot "measurement-existing-server.json"

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

function SignInDemoSeller {
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

$signIn = SignInDemoSeller
$authenticatedRequests = @()
if ($signIn.ok -and $signIn.session) {
  $authenticatedRequests = @(
    (Measure-SessionRequest "http://localhost:3000/th/seller" $signIn.session @{ "Accept" = "text/html" }),
    (Measure-SessionRequest "http://localhost:3000/th/seller" $signIn.session @{ "Accept" = "text/html" }),
    (Measure-SessionRequest "http://localhost:3001/api/seller/dashboard" $signIn.session),
    (Measure-SessionRequest "http://localhost:3001/api/seller/dashboard" $signIn.session)
  )
}

$results = [ordered]@{
  measuredAt = (Get-Date).ToString("o")
  notes = @(
    "Uses already-running localhost:3000 and localhost:3001 servers.",
    "HTTP-level timings only; does not include visual paint or hydration timing."
  )
  signIn = [ordered]@{
    ok = $signIn.ok
    status = $signIn.status
    elapsedMs = $signIn.elapsedMs
    error = $signIn.error
  }
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
