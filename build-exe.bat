@echo off
title PeerEdit - build exe
echo === Building self-contained PeerEdit.exe ===
echo.
cd /d "%~dp0"
npm run build:exe
echo.
pause
