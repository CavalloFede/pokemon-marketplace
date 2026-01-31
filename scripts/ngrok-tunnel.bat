@echo off
REM ngrok tunnel script for Pokemon Marketplace

echo ==================================
echo Pokemon Marketplace - ngrok Tunnel
echo ==================================

REM Check if ngrok is installed
where ngrok >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Error: ngrok is not installed.
    echo.
    echo Install ngrok:
    echo   - Windows: choco install ngrok
    echo   - Or download from: https://ngrok.com/download
    exit /b 1
)

REM Parse arguments
set PORT=3000
set SERVICE=API

if "%1"=="--api" (
    set PORT=3000
    set SERVICE=API
    goto start
)

if "%1"=="--web" (
    set PORT=5173
    set SERVICE=Web
    goto start
)

if "%1"=="--both" (
    echo Starting tunnels for both API and Web...
    echo.
    echo Opening two command windows...
    start cmd /k "ngrok http 3000"
    start cmd /k "ngrok http 5173"
    echo.
    echo Two ngrok windows should now be open.
    echo Check each window for the public URLs.
    exit /b 0
)

if "%1"=="--help" goto help
if "%1"=="-h" goto help

goto start

:help
echo Usage: %0 [options]
echo.
echo Options:
echo   --api      Expose API (port 3000) - Default
echo   --web      Expose Web (port 5173)
echo   --both     Expose both API and Web (opens two windows)
echo   --help     Show this help message
exit /b 0

:start
echo Starting ngrok tunnel for %SERVICE% (port %PORT%)...
echo.
echo Once started, you'll see a public URL like:
echo   https://abc123.ngrok.io
echo.
echo Press Ctrl+C to stop the tunnel
echo.

ngrok http %PORT%
