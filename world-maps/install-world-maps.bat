@echo off
chcp 65001 >nul
title Install World Maps

cd /d "%~dp0"

for %%F in ("World Maps Setup *.exe") do (
  echo.
  echo  Installing World Maps on this PC...
  echo  Desktop + Start menu shortcuts will be created automatically.
  echo  Please wait. do not close this window.
  echo.
  "%%~fF" /S
  if errorlevel 1 (
    echo  Silent install failed. opening normal installer...
    start "" "%%~fF"
    exit /b 0
  )
  timeout /t 3 /nobreak >nul
  call "%~dp0add-world-maps-to-windows.bat"
  exit /b 0
)

echo.
echo  Installer not found. Look for World Maps Setup 1.0.x.exe
pause
exit /b 1
