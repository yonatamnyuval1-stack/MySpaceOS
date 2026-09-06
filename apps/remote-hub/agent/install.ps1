# My Space Remote Agent — run on TARGET PC as Administrator (once)
# Requires Node.js 18+ (winget install OpenJS.NodeJS.LTS)

$AgentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Port = 8765

Write-Host "Installing agent in $AgentDir ..."

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js not found. Install: winget install OpenJS.NodeJS.LTS'
  exit 1
}

Push-Location $AgentDir
npm install --omit=dev 2>&1 | Out-Host
Pop-Location

New-NetFirewallRule -DisplayName 'MySpace Remote Agent' -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -ErrorAction SilentlyContinue | Out-Null

$taskName = 'MySpaceRemoteAgent'
$node = (Get-Command node).Source
$action = New-ScheduledTaskAction -Execute $node -Argument "`"$AgentDir\server.js`"" -WorkingDirectory $AgentDir
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

Write-Host "Agent installed. Port $Port open. Starts at logon."
Write-Host "Test: node `"$AgentDir\server.js`" then connect from Remote Hub -> Control."
