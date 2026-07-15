Write-Host "=== PeerEdit Relay Server ===" -ForegroundColor Cyan
cd "$PSScriptRoot\relay-server"
npx tsx src/index.ts
