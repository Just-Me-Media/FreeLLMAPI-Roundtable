@echo off
setlocal

REM Roundtable Server Restart Utility
REM Allows users to restart the server without losing chat history

set ROOT=%~dp0
set SERVER=%ROOT%server.js
set LOG=%ROOT%roundtable-server.log
set PORT=5173

echo ========================================
echo   Roundtable Server Restart Utility
echo ========================================
echo.

REM Check if Node exists
where node >nul 2>nul || (
    echo ERROR: Node.js not found in PATH
    echo Please install Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)

REM Find and kill existing server processes on port 5173
echo Checking for existing server instances...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PORT% ^| findstr LISTENING') do (
    echo Stopping existing server (PID %%a)...
    taskkill /PID %%a /F >nul 2>&1
    timeout /t 1 /nobreak >nul
)

echo.
echo Starting Roundtable server...
echo.

REM Start server in new window with logging
start "Roundtable Server (%PORT%)" cmd /c "node %SERVER% > %LOG% 2>&1"

REM Wait for server to start
timeout /t 3 /nobreak >nul

REM Check if server is listening
netstat -ano | findstr :%PORT% | findstr LISTENING >nul
if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   SUCCESS: Server is running on port %PORT%
    echo ========================================
    echo.
    echo Your chat history is preserved in browser storage.
    echo Open http://localhost:%PORT% in your browser
    echo.
) else (
    echo.
    echo ERROR: Server failed to start
    echo Check log file: %LOG%
    echo.
)

echo.
pause