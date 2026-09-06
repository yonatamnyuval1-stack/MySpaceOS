@echo off
cd /d "%~dp0"
title My Space

if not exist "node_modules\electron\dist\electron.exe" (
  echo.
  echo  My Space - first-time setup
  echo  Installing dependencies... this may take a few minutes.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo  Install failed. Make sure Node.js is installed: https://nodejs.org
    pause
    exit /b 1
  )
)

echo Starting My Space desktop...
call npm start