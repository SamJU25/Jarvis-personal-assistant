# Starts both local Whisper and Kokoro servers and verifies health
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = (Resolve-Path (Join-Path $scriptDir "../../..")).Path
Set-Location $projectRoot

Write-Output "=== Starting JARVIS Local Voice Services ==="

# 1. Start Whisper
& (Join-Path $scriptDir "start-whisper.ps1")

# 2. Start Kokoro
& (Join-Path $scriptDir "start-kokoro.ps1")

# 3. Perform Functional Health Checks
Write-Output "Verifying service endpoints..."
$whisperOk = $false
$kokoroOk = $false

for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Milliseconds 1000
    if (-not $whisperOk) {
        try {
            $r = Invoke-WebRequest -Uri "http://127.0.0.1:8080/health" -UseBasicParsing -TimeoutSec 2
            if ($r.StatusCode -eq 200 -or $r.StatusCode -eq 404) { $whisperOk = $true }
        } catch { }
    }
    if (-not $kokoroOk) {
        try {
            $r = Invoke-WebRequest -Uri "http://127.0.0.1:8880/health" -UseBasicParsing -TimeoutSec 2
            if ($r.StatusCode -eq 200) { $kokoroOk = $true }
        } catch { }
    }
    if ($whisperOk -and $kokoroOk) { break }
}

if (-not $whisperOk) {
    Write-Error "Whisper server failed health check on http://127.0.0.1:8080/health."
    exit 1
}

if (-not $kokoroOk) {
    Write-Error "Kokoro server failed health check on http://127.0.0.1:8880/health."
    exit 1
}

Write-Output "✓ Whisper STT is healthy at http://127.0.0.1:8080"
Write-Output "✓ Kokoro TTS is healthy at http://127.0.0.1:8880"
Write-Output "=== JARVIS Local Voice Runtime is Ready ==="
exit 0
