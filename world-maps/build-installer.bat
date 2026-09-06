@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
cd /d "%~dp0"
title World Maps build installer

echo.
echo  World Maps - building Windows installer...
echo.

set "ROOT=%~dp0.."
set "BUILDER=%ROOT%\node_modules\.bin\electron-builder.cmd"
set "PARENT_ELECTRON=%ROOT%\node_modules\electron"
set "SETUP=WorldMapsSetup-1.0.6.exe"
set "PORTABLE=WorldMapsPortable-1.0.6.exe"
set "DOWNLOADS=%USERPROFILE%\Downloads"

where npm >nul 2>&1
if %errorlevel%==0 (
  echo  Running npm install...
  call npm install
  if errorlevel 1 goto :fail
) else (
  echo  npm not found - using Electron from parent project...
  if not exist "%PARENT_ELECTRON%" (
    echo.
    echo  Install Node.js from https://nodejs.org
    goto :fail
  )
  if not exist "node_modules" mkdir "node_modules"
  if not exist "node_modules\electron" (
    mklink /J "node_modules\electron" "%PARENT_ELECTRON%" >nul
  )
)

echo  Close World Maps if it is running...
taskkill /IM "World Maps.exe" /F >nul 2>&1

echo  Removing old installers from Downloads...
del /Q "%DOWNLOADS%\WorldMapsSetup *.exe" >nul 2>&1
del /Q "%DOWNLOADS%\WorldMapsPortable *.exe" >nul 2>&1
del /Q "%DOWNLOADS%\World Maps Setup *.exe" >nul 2>&1

if exist "dist" rmdir /S /Q "dist" >nul 2>&1

set CSC_IDENTITY_AUTO_DISCOVERY=false
if exist "%BUILDER%" (
  call "%BUILDER%" --win
) else (
  call npm run build
)
if errorlevel 1 goto :fail

if not exist "dist\%SETUP%" (
  echo.
  echo  Build finished but installer not found: dist\%SETUP%
  goto :fail
)

copy /Y "dist\%SETUP%" "%DOWNLOADS%\%SETUP%" >nul
if exist "dist\%PORTABLE%" copy /Y "dist\%PORTABLE%" "%DOWNLOADS%\%PORTABLE%" >nul
copy /Y "INSTALL.txt" "%DOWNLOADS%\World Maps INSTALL.txt" >nul

echo.
echo  ========================================
echo   Done!
echo.
echo   %DOWNLOADS%
echo.
echo   %SETUP%
if exist "%DOWNLOADS%\%PORTABLE%" echo   %PORTABLE%
echo   World Maps INSTALL.txt
echo  ========================================
echo.
explorer /select,"%DOWNLOADS%\%SETUP%"
pause
exit /b 0

:fail
echo.
echo  Build failed.
pause
exit /b 1