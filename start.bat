@echo off
setlocal
cd /d "%~dp0"

where pwsh >nul 2>nul
if %errorlevel%==0 (
  pwsh -ExecutionPolicy Bypass -File "%~dp0start.ps1"
) else (
  powershell -ExecutionPolicy Bypass -File "%~dp0start.ps1"
)

endlocal
