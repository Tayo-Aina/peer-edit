@echo off
echo === PeerEdit Killswitch ===
echo.

echo Killing Node processes (relay + vite)...
taskkill /f /im node.exe 2>nul
if %errorlevel% equ 0 (
    echo   Node processes terminated.
) else (
    echo   No Node processes were running.
)

echo.
echo Freeing port 9876 (relay)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":9876.*LISTENING" 2^>nul') do (
    taskkill /f /pid %%a 2>nul
    echo   Killed PID %%a on port 9876.
)

echo Freeing port 5173 (vite)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173.*LISTENING" 2^>nul') do (
    taskkill /f /pid %%a 2>nul
    echo   Killed PID %%a on port 5173.
)

echo.
echo All clear.
pause
