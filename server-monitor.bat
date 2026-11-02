@echo off
setlocal

REM Roundtable Server Auto-Recovery
REM Keeps server running even if it crashes

set ROOT=%~dp0
set SERVER=%ROOT%server.js
set LOG=%ROOT%roundtable-server.log
set PORT=5173
set CHECK_INTERVAL=30

echo ========================================
echo   Roundtable Server Monitor
echo ========================================
echo Monitoring server on port %PORT%
echo Check interval: %CHECK_INTERVAL% seconds
echo.
echo Press Ctrl+C to stop monitoring
echo.

:loop
netstat -ano | findstr :%PORT% | findstr LISTENING >nul
if %errorlevel% neq 0 (
    echo [%time%] Server DOWN - restarting...
    call "%ROOT%Restart-Server.bat"
)

timeout /t %CHECK_INTERVAL% /nobreak >nul
goto loop