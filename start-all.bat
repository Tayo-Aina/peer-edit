@echo off
echo === PeerEdit - Starting Relay + Frontend ===
echo.

echo [1/2] Starting relay server in new window...
start "PeerEdit Relay" cmd /c "cd /d "%~dp0relay-server" && npx tsx src/index.ts"

echo [2/2] Waiting 3 seconds for relay to start...
ping -n 4 127.0.0.1 > NUL

echo Relay running on ws://localhost:9876
echo Open http://localhost:5173 in your browser
echo Press Ctrl+C to stop the frontend (close the relay window manually)
echo.

cd /d "%~dp0frontend"
npx vite
