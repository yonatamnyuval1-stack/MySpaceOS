@echo off
cd /d "%~dp0"
echo Browser preview only - websites work, programs do NOT open.
echo For full desktop use: open.bat
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"