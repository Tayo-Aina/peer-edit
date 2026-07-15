Write-Host "=== PeerEdit Frontend ===" -ForegroundColor Cyan
Write-Host "Open http://localhost:5173 in your browser" -ForegroundColor Green
cd "$PSScriptRoot\frontend"
npx vite
