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

function Measure-HttpWithCurl($label, $url, $accept = "text/html") {
  $format = "status=%{http_code}`nnamelookup=%{time_namelookup}`nconnect=%{time_connect}`nappconnect=%{time_appconnect}`npretransfer=%{time_pretransfer}`nstarttransfer=%{time_starttransfer}`ntotal=%{time_total}`nsize=%{size_download}`nredirect=%{time_redirect}`n"
  $output = & curl.exe -sS -L -o NUL -H "Accept: $accept" -w $format $url 2>&1
  $record = [ordered]@{
    label = $label
    url = $url
    ok = $LASTEXITCODE -eq 0
    curlExitCode = $LASTEXITCODE
  }

  foreach ($line in $output) {
    if ($line -match "^([^=]+)=(.*)$") {
      $key = $Matches[1]
      $value = $Matches[2]
      if ($key -eq "status") {
        $record[$key] = [int]$value
      } elseif ($key -eq "size") {
        $record[$key] = [int64]$value
      } else {
        $record[$key + "Ms"] = [math]::Round(([double]$value) * 1000, 2)
      }
    }
  }

  if (-not $record.ok) {
    $record.error = ($output -join "`n")
  }

  return $record
}

function Find-BrowserExecutable {
  $candidates = @(
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
  )

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) {
      return $candidate
    }
  }

  return $null
}

function Measure-BrowserDump($label, $url, $browserExe, $domFileName, $errFileName) {
  if (-not $browserExe) {
    return [ordered]@{
      label = $label
      url = $url
      ok = $false
      skipped = $true
      reason = "No local Edge/Chrome executable found for headless DOM dump."
    }
  }

  $tempProfile = Join-Path $env:TEMP ("buyer-final-browser-" + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Force -Path $tempProfile | Out-Null
  $stdoutPath = Join-Path $PSScriptRoot $domFileName
  $stderrPath = Join-Path $PSScriptRoot $errFileName
  Remove-Item -LiteralPath $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue

  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $arguments = @(
      "--headless",
      "--disable-gpu",
      "--user-data-dir=$tempProfile",
      "--dump-dom",
      $url
    )
    $browserProcess = Start-Process `
      -FilePath $browserExe `
      -ArgumentList $arguments `
      -RedirectStandardOutput $stdoutPath `
      -RedirectStandardError $stderrPath `
      -WindowStyle Hidden `
      -PassThru
    $exited = $browserProcess.WaitForExit(30000)
    if (-not $exited) {
      taskkill /PID $browserProcess.Id /T /F | Out-Null
    }
    $sw.Stop()
    $text = if (Test-Path $stdoutPath) { Get-Content -Raw -LiteralPath $stdoutPath } else { "" }
    $stderr = if (Test-Path $stderrPath) { Get-Content -Raw -LiteralPath $stderrPath } else { "" }
    $normalized = ($text -replace "\s+", " ").Trim()
    $visibleTextSample = $normalized
    if ($visibleTextSample.Length -gt 500) {
      $visibleTextSample = $visibleTextSample.Substring(0, 500)
    }

    return [ordered]@{
      label = $label
      url = $url
      ok = $exited -and $text.Length -gt 0
      exitCode = $browserProcess.ExitCode
      browser = $browserExe
      elapsedMs = [int]$sw.ElapsedMilliseconds
      domLength = $text.Length
      stderrLength = $stderr.Length
      domFile = $domFileName
      stderrFile = $errFileName
      hasMarketplaceText = $normalized -match "Marketplace|Shopee|Flash|Search|Product|Category"
      hasLoadingText = $normalized -match "Loading|loading"
      hasHomeHeroText = $normalized -match "Shopee|Flash|Deal|Marketplace"
      hasProductCardText = $normalized -match "cart|Add|Product|Shop"
      hasSearchResultText = $normalized -match "Search|phone|Product|result"
      visibleTextSample = $visibleTextSample
    }
  } catch {
    $sw.Stop()
    return [ordered]@{
      label = $label
      url = $url
      ok = $false
      browser = $browserExe
      elapsedMs = [int]$sw.ElapsedMilliseconds
      error = $_.Exception.Message
    }
  } finally {
    Remove-Item -LiteralPath $tempProfile -Recurse -Force -ErrorAction SilentlyContinue
  }
}

New-Item -ItemType Directory -Force -Path $PSScriptRoot | Out-Null
Remove-Item -LiteralPath $outLog, $errLog, $resultJson -Force -ErrorAction SilentlyContinue

$process = $null
$usedExistingServer = (Test-UrlReady "http://localhost:3000/th") -and (Test-UrlReady "http://localhost:3001/api/health")
if (-not $usedExistingServer) {
  $process = Start-Process `
    -FilePath "bun" `
    -ArgumentList @("run", "dev") `
    -WorkingDirectory $root.Path `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog `
    -WindowStyle Hidden `
    -PassThru
} else {
  "Reused existing local frontend/backend servers." | Set-Content -LiteralPath $outLog -Encoding UTF8
  "" | Set-Content -LiteralPath $errLog -Encoding UTF8
}

try {
  $ready = $false
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 1
    if ((Test-UrlReady "http://localhost:3000/th") -and (Test-UrlReady "http://localhost:3001/api/health")) {
      $ready = $true
      break
    }
  }

  $browserExe = Find-BrowserExecutable
  $homeUrl = "http://localhost:3000/th"
  $searchUrl = "http://localhost:3000/th/search?q=phone"

  $results = [ordered]@{
    measuredAt = (Get-Date).ToString("o")
    ready = $ready
    usedExistingServer = $usedExistingServer
    notes = @(
      "Local development-mode final verification after buyer-entry task 6 and 7 changes.",
      "HTTP timings use the same curl transfer buckets as the task-5 baseline.",
      "Browser observations use a local headless Edge/Chrome DOM dump and save DOM evidence under the task-8 report folder.",
      "No production app or server code was modified by this measurement script."
    )
    httpRequests = @(
      (Measure-HttpWithCurl "home route cold" $homeUrl "text/html"),
      (Measure-HttpWithCurl "home route warm" $homeUrl "text/html"),
      (Measure-HttpWithCurl "search route cold" $searchUrl "text/html"),
      (Measure-HttpWithCurl "search route warm" $searchUrl "text/html"),
      (Measure-HttpWithCurl "home products api cold" 'http://localhost:3001/api/products?limit=50&locale=th' "application/json"),
      (Measure-HttpWithCurl "home products api warm" 'http://localhost:3001/api/products?limit=50&locale=th' "application/json"),
      (Measure-HttpWithCurl "home categories api" 'http://localhost:3001/api/categories?locale=th' "application/json"),
      (Measure-HttpWithCurl "home coupons api" 'http://localhost:3001/api/coupons?locale=th' "application/json"),
      (Measure-HttpWithCurl "search products api cold" 'http://localhost:3001/api/search/products?q=phone&sort=newest&limit=40&locale=th' "application/json"),
      (Measure-HttpWithCurl "search products api warm" 'http://localhost:3001/api/search/products?q=phone&sort=newest&limit=40&locale=th' "application/json"),
      (Measure-HttpWithCurl "search suggestions api" 'http://localhost:3001/api/search/suggestions?q=phone&limit=8&locale=th' "application/json"),
      (Measure-HttpWithCurl "search categories api" 'http://localhost:3001/api/categories?locale=th' "application/json")
    )
    browserObservations = @(
      (Measure-BrowserDump "home /th" $homeUrl $browserExe "browser-home-dom.html" "browser-home.err.log"),
      (Measure-BrowserDump "search /th/search?q=phone" $searchUrl $browserExe "browser-search-dom.html" "browser-search.err.log")
    )
  }

  $results | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resultJson -Encoding UTF8
  $results | ConvertTo-Json -Depth 8
} finally {
  if ($process -and -not $process.HasExited) {
    taskkill /PID $process.Id /T /F | Out-Null
  }
}
