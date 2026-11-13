@echo off
setlocal

REM Roundtable Windows Launcher (post-build)
REM Starts FreeLLMAPI (if needed), the local proxy server, then the Tauri app.
REM
REM Usage: after building, double-click this file.
REM Build first: powershell -ExecutionPolicy Bypass -File .\build-windows.ps1

set ROOT=%~dp0
set SERVER=%ROOT%server.js
set LOG=%ROOT%roundtable-server.log
set PORT=5173

echo ========================================
echo   Roundtable for Windows
echo ========================================
echo.

REM 1. Node.js present?
where node >nul 2>nul || (
    echo [ERROR] Node.js not found in PATH
    echo Install Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)

REM 2. FreeLLMAPI running on :31415?
echo [1/3] Checking FreeLLMAPI...
curl -s -m 3 http://127.0.0.1:31415/api/ping >nul 2>&1
if %errorlevel% equ 0 (
    echo      FreeLLMAPI is running on :31415
) else (
    echo      FreeLLMAPI not detected on :31415
    echo      Start FreeLLMAPI.app / FreeLLMAPI.exe before continuing
    echo      (It must run on localhost:31415 for Roundtable to connect)
    pause
    exit /b 1
)

REM 3. Start the local proxy server (if not already up)
echo [2/3] Starting Roundtable proxy server on :%PORT%...
netstat -ano | findstr :%PORT% | findstr LISTENING >nul 2>&1
if %errorlevel% equ 0 (
    echo      Server already running on :%PORT%
) else (
    start "Roundtable Server" cmd /c "%SERVER% > %LOG% 2>&1"
    timeout /t 2 /nobreak >nul
)

REM 4. Launch the built Tauri app
echo [3/3] Launching Roundtable app...
set APP=%ROOT%app.exe
if exist "%APP%" (
    start "" "%APP%"
) else (
    echo [WARN] app.exe not found in repo root
    echo        The build produces it at:
    echo        src-tauri\target\release\bundle\nsis\Roundtable_*_setup.exe
    echo        Copy it to the repo root, or launch it directly from that path.
    echo.
    set NSIS=src-tauri\target\release\bundle\nsis
    if exist "%NSIS%" (
        for %%f in ("%NSIS%\*setup.exe") do start "" "%%~ff"
    ) else (
        echo [ERROR] No built installer found. Build first:
        echo        powershell -ExecutionPolicy Bypass -File .\build-windows.ps1
        pause
        exit /b 1
    )
)

echo.
echo Roundtable is starting. Open http://localhost:%PORT% if the app does not open.
echo Server log: %LOG%
echo.
endlocal