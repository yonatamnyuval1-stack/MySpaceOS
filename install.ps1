$ProjectRoot = $PSScriptRoot
$StartScript = Join-Path $ProjectRoot "start-myspace.bat"

@"
@echo off
cd /d "$ProjectRoot"
call npm start
"@ | Set-Content -Path $StartScript -Encoding ASCII

$RunKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$Name = "MySpace"
Set-ItemProperty -Path $RunKey -Name $Name -Value "`"$StartScript`"" -Type String

Write-Host "My Space registered to start with Windows."
Write-Host "To remove: Remove-ItemProperty -Path '$RunKey' -Name '$Name'"