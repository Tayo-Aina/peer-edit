@echo off
echo === PeerEdit Relay Server ===
cd /d "%~dp0relay-server"
npx tsx src/index.ts
pause
