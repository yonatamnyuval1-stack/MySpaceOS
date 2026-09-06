@echo off
chcp 65001 >nul
title Add World Maps to Windows

set "EXE="
set "WORKDIR="

if exist "%LOCALAPPDATA%\Programs\world-maps\World Maps.exe" (
  set "EXE=%LOCALAPPDATA%\Programs\world-maps\World Maps.exe"
  set "WORKDIR=%LOCALAPPDATA%\Programs\world-maps"
)
if exist "%LOCALAPPDATA%\Programs\World Maps\World Maps.exe" (
  set "EXE=%LOCALAPPDATA%\Programs\World Maps\World Maps.exe"
  set "WORKDIR=%LOCALAPPDATA%\Programs\World Maps"
)
if exist "%USERPROFILE%\Downloads\World Maps\World Maps.exe" (
  set "EXE=%USERPROFILE%\Downloads\World Maps\World Maps.exe"
  set "WORKDIR=%USERPROFILE%\Downloads\World Maps"
)

if not defined EXE (
  echo.
  echo  World Maps is not installed yet.
  echo  Double-click: Install World Maps.bat
  echo.
  pause
  exit /b 1
)

echo.
echo  Adding World Maps to Desktop and Start menu...
echo  Location: %EXE%
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$exe = '%EXE%'; $dir = '%WORKDIR%';" ^
  "$desk = [Environment]::GetFolderPath('Desktop');" ^
  "$start = [Environment]::GetFolderPath('Programs');" ^
  "$w = New-Object -ComObject WScript.Shell;" ^
  "$s1 = $w.CreateShortcut((Join-Path $desk 'World Maps.lnk'));" ^
  "$s1.TargetPath = $exe; $s1.WorkingDirectory = $dir; $s1.Description = 'World Maps'; $s1.Save();" ^
  "$folder = Join-Path $start 'World Maps'; New-Item -ItemType Directory -Force -Path $folder | Out-Null;" ^
  "$s2 = $w.CreateShortcut((Join-Path $folder 'World Maps.lnk'));" ^
  "$s2.TargetPath = $exe; $s2.WorkingDirectory = $dir; $s2.Description = 'World Maps'; $s2.Save();" ^
  "$s3 = $w.CreateShortcut((Join-Path $start 'World Maps.lnk'));" ^
  "$s3.TargetPath = $exe; $s3.WorkingDirectory = $dir; $s3.Description = 'World Maps'; $s3.Save();"

echo  Done!
echo  - Desktop: World Maps icon
echo  - Start menu: World Maps
echo.
echo  Tip: For a proper system install, run Install World Maps.bat
echo.
pause
