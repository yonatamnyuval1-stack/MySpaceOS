@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Run install.ps1 as Administrator first, or: npm install
  pause
  exit /b 1
)
node server.js
pause
