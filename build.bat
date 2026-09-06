@echo off
title Build My Space Installer
cd /d "%~dp0"

echo Installing build tools...
call npm install
if errorlevel 1 goto fail

echo.
echo Building Windows installer...
set CSC_IDENTITY_AUTO_DISCOVERY=false
call npm run build
if errorlevel 1 goto fail

echo.
echo Done! Installer is in the dist folder:
dir /b dist\*.exe 2>nul
echo.
pause
exit /b 0

:fail
echo Build failed.
pause
exit /b 1