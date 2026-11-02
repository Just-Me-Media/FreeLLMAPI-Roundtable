@echo off
setlocal

REM Roundtable Windows Launcher
REM Starts local proxy server then launches Tauri app

set ROOT=%~dp0
set SERVER=%ROOT%server.js
set NODE=node

REM Check Node exists
where node >nul 2>nul || (
    echo Node.js not found in PATH. Please install Node.js 18+
    pause
    exit /b 1
)

REM Start server in background
start "Roundtable Server" cmd /c "%NODE% %SERVER% > %ROOT%roundtable-server.log 2>&1"

REM Wait a bit for server to start
timeout /t 2 /nobreak >nul

REM Launch Tauri app
set APP=%ROOT%app.exe
if exist "%APP%" (
    start "" "%APP%"
) else (
    echo Tauri app not found at %APP%
    echo Build the app first with cargo tauri build --config tauri.windows.conf.json
    pause
)

endlocal