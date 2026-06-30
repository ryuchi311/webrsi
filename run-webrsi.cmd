@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ============================================
echo   WebRSI - One Click Launcher
echo ============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js not found. Installing Node.js LTS...
  where winget >nul 2>&1
  if errorlevel 1 goto :fail_winget
  winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements --silent
  if errorlevel 1 goto :fail_node
  for %%D in ("%ProgramFiles%\nodejs" "%ProgramFiles(x86)%\nodejs") do (
    if exist "%%~D" set "PATH=%%~D;%PATH%"
  )
)

where node >nul 2>&1
if errorlevel 1 goto :fail_node

where npm >nul 2>&1
if errorlevel 1 goto :fail_npm

if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 goto :fail_deps
  echo.
)

start "" /b cmd /c "cd /d ""%~dp0"" && node scripts\settings-server.mjs >nul 2>&1"

echo Starting the app...
start "WebRSI Dev Server" cmd /k "cd /d ""%~dp0"" && npm run dev -- --host 127.0.0.1 --port 5173 --strictPort"

echo Waiting for localhost:5173...
set /a attempts=0
:wait_for_server
curl -fs http://127.0.0.1:5173 >nul 2>&1
if not errorlevel 1 goto open_browser
set /a attempts+=1
if %attempts% geq 30 goto open_browser
timeout /t 1 /nobreak >nul
goto wait_for_server

:open_browser
start "" "http://127.0.0.1:5173"
exit /b 0

:fail
echo.
echo Failed to start WebRSI.
pause
exit /b 1

:fail_winget
echo.
echo Winget is required to install Node.js automatically, but it was not found.
pause
exit /b 1

:fail_node
echo.
echo Node.js installation or detection failed.
pause
exit /b 1

:fail_npm
echo.
echo npm was not found after Node.js setup.
pause
exit /b 1

:fail_deps
echo.
echo Failed to install project dependencies.
pause
exit /b 1