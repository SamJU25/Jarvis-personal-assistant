# Stops project-local whisper.cpp server
param(
    [string]$Port = "8080"
)

$ErrorActionPreference = "SilentlyContinue"

$connection = Get-NetTCPConnection -LocalPort ([int]$Port) -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" }
if ($connection) {
    foreach ($pidNum in ($connection.OwningProcess | Select-Object -Unique)) {
        $p = Get-Process -Id $pidNum -ErrorAction SilentlyContinue
        if ($p -and $p.ProcessName -match "whisper-server") {
            Write-Output "Stopping whisper-server (PID $pidNum)..."
            Stop-Process -Id $pidNum -Force -ErrorAction SilentlyContinue
        }
    }
    Write-Output "Whisper server on port $Port stopped."
} else {
    Write-Output "No Whisper server found listening on port $Port."
}
