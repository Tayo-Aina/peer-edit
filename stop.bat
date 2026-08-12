@echo off
title PeerEdit stop
echo === PeerEdit stop ===
echo.
echo Releasing port 9876 (relay)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":9876 " ^| findstr "LISTENING" 2^>nul') do (
    taskkill /f /pid %%a 2>nul
    echo   Killed PID %%a on port 9876.
)
echo Releasing port 5173 (frontend)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173 " ^| findstr "LISTENING" 2^>nul') do (
    taskkill /f /pid %%a 2>nul
    echo   Killed PID %%a on port 5173.
)
echo.
echo Done.
pause
