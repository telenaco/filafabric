@echo off
setlocal
rem Starts the local studio from the folder this file sits in, whatever branch is checked out there.
set "FILAFABRIC_DIR=%~dp0"
if not exist "%FILAFABRIC_DIR%dev\tools\serve.mjs" (
  echo The studio's server was not found next to this file:
  echo   %FILAFABRIC_DIR%dev\tools\serve.mjs
  pause
  exit /b 1
)
cd /d "%FILAFABRIC_DIR%"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node 20 or newer from https://nodejs.org and run this again.
  pause
  exit /b 1
)
echo Starting the local Filafabric studio from:
echo   %CD%
git branch --show-current 2>nul
node dev\tools\serve.mjs --open
pause
