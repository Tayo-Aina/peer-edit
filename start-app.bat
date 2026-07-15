@echo off
echo === PeerEdit Frontend ===
echo Open http://localhost:5173 in your browser
cd /d "%~dp0frontend"
npx vite
pause
