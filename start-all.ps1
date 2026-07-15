Write-Host "=== PeerEdit - Starting Relay + Frontend ===" -ForegroundColor Cyan
Write-Host ""

$root = $PSScriptRoot
$relayDir = Join-Path $root "relay-server"
$frontendDir = Join-Path $root "frontend"

# Start relay in a separate window
$relayCmd = "cd '$relayDir'; npx tsx src/index.ts"
Start-Process powershell -ArgumentList @('-NoExit', '-Command', $relayCmd) -WindowStyle Normal

# Wait for relay to be ready
Start-Sleep -Seconds 3

# Start frontend
Write-Host "Relay running on ws://localhost:9876" -ForegroundColor Yellow
Write-Host "Open http://localhost:5173 in your browser" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the frontend (close the relay window manually)" -ForegroundColor Gray
Write-Host ""

Set-Location $frontendDir
npx vite
