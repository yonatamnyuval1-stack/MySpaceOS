@echo off
chcp 65001 >nul
cd /d "%~dp0"
title World Maps

if exist "%~dp0node_modules\electron\dist\electron.exe" (
  call npm start
  goto :done
)

set "ELECTRON=%~dp0..\node_modules\.bin\electron.cmd"
if exist "%ELECTRON%" (
  echo Starting World Maps...
  call "%ELECTRON%" "%~dp0."
  goto :done
)

echo.
echo  World Maps needs Electron.
echo  Run once:  npm install
echo  Or use the installed app from build-installer.bat
echo.
pause
exit /b 1

:done
