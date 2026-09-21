# Starts project-local Kokoro TTS server bound to 127.0.0.1:8880
param(
    [string]$Port = "8880",
    [string]$HostAddress = "127.0.0.1"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = (Resolve-Path (Join-Path $scriptDir "../../..")).Path
Set-Location $projectRoot

$pythonExe = Join-Path $projectRoot ".jarvis/voice/kokoro/.venv/Scripts/python.exe"
if (-not (Test-Path $pythonExe)) {
    Write-Error "Kokoro Python virtual environment not found at $pythonExe."
    exit 1
}

$serverScript = Join-Path $projectRoot ".jarvis/voice/kokoro/server.py"
if (-not (Test-Path $serverScript)) {
    Write-Error "Kokoro server script not found at $serverScript."
    exit 1
}

# Check if port is already in use
$connection = Get-NetTCPConnection -LocalPort ([int]$Port) -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" }
if ($connection) {
    Write-Output "Kokoro server is already listening on port $Port (PID $($connection.OwningProcess[0]))."
    exit 0
}

$logDir = Join-Path $projectRoot ".jarvis/voice/logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}
$logFile = Join-Path $logDir "kokoro.log"
$errFile = Join-Path $logDir "kokoro.err.log"

Write-Output "Starting Kokoro TTS server on ${HostAddress}:${Port}..."
$kokoroDir = Join-Path $projectRoot ".jarvis/voice/kokoro"
$arguments = "-m uvicorn server:app --app-dir `"$kokoroDir`" --host $HostAddress --port $Port"

$process = Start-Process -FilePath $pythonExe -ArgumentList $arguments -RedirectStandardOutput $logFile -RedirectStandardError $errFile -PassThru -WindowStyle Hidden

# Poll up to 10 seconds for Kokoro server to bind
$bound = $false
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 500
    $healthCheck = Get-NetTCPConnection -LocalPort ([int]$Port) -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" }
    if ($healthCheck) {
        $bound = $true
        break
    }
}

if ($bound) {
    Write-Output "Kokoro TTS server successfully started (PID $($process.Id)) on http://${HostAddress}:${Port}"
    exit 0
} else {
    Write-Error "Kokoro TTS server failed to bind to port $Port within 10 seconds. Check logs at $logFile and $errFile"
    exit 1
}
