# Stops project-local Kokoro TTS server
param(
    [string]$Port = "8880"
)

$ErrorActionPreference = "SilentlyContinue"

$connection = Get-NetTCPConnection -LocalPort ([int]$Port) -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" }
if ($connection) {
    foreach ($pidNum in ($connection.OwningProcess | Select-Object -Unique)) {
        $p = Get-Process -Id $pidNum -ErrorAction SilentlyContinue
        if ($p -and ($p.ProcessName -match "python" -or $p.ProcessName -match "uvicorn")) {
            Write-Output "Stopping Kokoro TTS server (PID $pidNum)..."
            Stop-Process -Id $pidNum -Force -ErrorAction SilentlyContinue
        }
    }
    Write-Output "Kokoro TTS server on port $Port stopped."
} else {
    Write-Output "No Kokoro TTS server found listening on port $Port."
}
