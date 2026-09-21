# Stops both local Whisper and Kokoro voice servers
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Output "Stopping JARVIS Local Voice Services..."
& (Join-Path $scriptDir "stop-whisper.ps1")
& (Join-Path $scriptDir "stop-kokoro.ps1")
Write-Output "Local voice services stopped."
