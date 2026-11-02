@echo off
setlocal

echo ========================================
echo   Roundtable Server Status Check
echo ========================================
echo.

set PORT=5173

netstat -ano | findstr :%PORT% | findstr LISTENING >nul
if %errorlevel% equ 0 (
    echo [OK] Server is RUNNING on port %PORT%
    echo.
    echo Access Roundtable at: http://localhost:%PORT%
    echo.
    echo Your chat history is safe in browser localStorage.
) else (
    echo [STOPPED] Server is NOT running on port %PORT%
    echo.
    echo To start the server:
    echo   1. Run Restart-Server.bat
    echo   2. Or double-click Roundtable-Start.bat
    echo.
)

pause