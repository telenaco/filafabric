@echo off
setlocal
set "FILAFABRIC_DIR=C:\Users\Luis\.codex\worktrees\t0-0-output-snapshots\Websites"
if not exist "%FILAFABRIC_DIR%\dev\tools\serve.mjs" (
  echo The active FilaFabric worktree was not found:
  echo   %FILAFABRIC_DIR%
  echo Open the current project worktree or update FILAFABRIC_DIR in this launcher.
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
echo Starting the latest local Textile G-code Generator from:
echo   %CD%
git branch --show-current
node dev\tools\serve.mjs --open
pause
