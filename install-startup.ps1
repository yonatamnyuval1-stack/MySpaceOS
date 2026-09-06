param(
  [string]$ExePath = ""
)

if (-not $ExePath) {
  $Guess = "${env:LOCALAPPDATA}\Programs\My Space\My Space.exe"
  if (Test-Path $Guess) { $ExePath = $Guess }
}

if (-not $ExePath -or -not (Test-Path $ExePath)) {
  Write-Host "My Space.exe not found."
  Write-Host "Usage: .\install-startup.ps1 -ExePath 'C:\path\to\My Space.exe'"
  exit 1
}

$RunKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$Name = "MySpace"
Set-ItemProperty -Path $RunKey -Name $Name -Value "`"$ExePath`"" -Type String

Write-Host "Registered: $ExePath"
Write-Host "To remove: Remove-ItemProperty -Path '$RunKey' -Name '$Name'"