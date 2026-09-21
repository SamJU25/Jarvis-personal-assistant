# Starts project-local whisper.cpp server bound to 127.0.0.1:8080
param(
    [string]$Port = "8080",
    [string]$HostAddress = "127.0.0.1",
    [string]$ModelPath = ".jarvis/voice/models/ggml-base.en.bin"
)

$ErrorActionPreference = "Stop"

# Resolve project root from script location (.jarvis/voice/runtime/ -> ../../../)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = (Resolve-Path (Join-Path $scriptDir "../../..")).Path
Set-Location $projectRoot

$fullModelPath = Join-Path $projectRoot $ModelPath
if (-not (Test-Path $fullModelPath)) {
    Write-Error "Whisper model not found at $fullModelPath. Please ensure the model is downloaded."
    exit 1
}

$whisperServerExe = Join-Path $projectRoot ".jarvis/voice/whisper/Release/whisper-server.exe"
if (-not (Test-Path $whisperServerExe)) {
    Write-Error "whisper-server.exe not found at $whisperServerExe."
    exit 1
}

# Check if port is already in use
$connection = Get-NetTCPConnection -LocalPort ([int]$Port) -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" }
if ($connection) {
    Write-Output "Whisper server is already listening on port $Port (PID $($connection.OwningProcess[0]))."
    exit 0
}

$logDir = Join-Path $projectRoot ".jarvis/voice/logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}
$logFile = Join-Path $logDir "whisper.log"
$errFile = Join-Path $logDir "whisper.err.log"

Write-Output "Starting whisper-server on ${HostAddress}:${Port}..."
$arguments = @(
    "-m", "`"$fullModelPath`"",
    "--host", $HostAddress,
    "--port", $Port,
    "--inference-path", "/inference",
    "--convert"
)

$process = Start-Process -FilePath $whisperServerExe -ArgumentList ($arguments -join " ") -RedirectStandardOutput $logFile -RedirectStandardError $errFile -PassThru -WindowStyle Hidden

# Poll up to 10 seconds for whisper-server to bind
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
    Write-Output "Whisper server successfully started (PID $($process.Id)) on http://${HostAddress}:${Port}"
    exit 0
} else {
    Write-Error "Whisper server failed to bind to port $Port within 10 seconds. Check logs at $logFile and $errFile"
    exit 1
}
