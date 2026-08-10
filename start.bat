@echo off
title PeerEdit (dev)
echo === PeerEdit (dev) ===
echo Starting relay + frontend together. Press Ctrl+C in this window to stop.
echo.
cd /d "%~dp0"
npm run dev
pause
