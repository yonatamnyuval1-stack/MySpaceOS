# My Space Remote Agent — run on TARGET PC as Administrator (once)
# Requires Node.js 18+ (winget install OpenJS.NodeJS.LTS)

$AgentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Port = 8765
$ConfigPath = Join-Path $AgentDir "agent-config.json"

Write-Host "Installing agent in $AgentDir ..."

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js not found. Install: winget install OpenJS.NodeJS.LTS'
  exit 1
}

# Random token per install (never the old default "myspace")
$Token = $null
$HadLanBefore = $false
if (Test-Path $ConfigPath) {
  try {
    $existing = Get-Content -Raw -Path $ConfigPath | ConvertFrom-Json
    if ($existing.token -and [string]$existing.token -ne "myspace") {
      $Token = [string]$existing.token
    }
    if ($existing.bindLan -eq $true -or $existing.openFirewall -eq $true) { $HadLanBefore = $true }
  } catch { }
}
if (-not $Token) {
  $bytes = New-Object byte[] 24
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $Token = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

Write-Host ""
Write-Host "NETWORK EXPOSURE (required for Control from another PC)"
Write-Host "  - Listen on all interfaces (0.0.0.0:$Port)"
Write-Host "  - Open Windows Firewall inbound TCP $Port"
Write-Host "Without this, the agent stays on localhost only (this PC)."
Write-Host ""
$answer = Read-Host "Allow LAN access + firewall rule for Remote Agent? [y/N]"
$AllowLan = $answer -match '^[Yy]'
if (-not $AllowLan -and $HadLanBefore) {
  Write-Host "LAN/firewall previously enabled — now turning OFF (answer was not Y)."
}

@{
  token = $Token
  createdAt = (Get-Date).ToUniversalTime().ToString("o")
  bindLan = [bool]$AllowLan
  openFirewall = [bool]$AllowLan
} | ConvertTo-Json | Set-Content -Path $ConfigPath -Encoding UTF8

Push-Location $AgentDir
npm install --omit=dev 2>&1 | Out-Host
Pop-Location

if ($AllowLan) {
  New-NetFirewallRule -DisplayName 'MySpace Remote Agent' -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -ErrorAction SilentlyContinue | Out-Null
  Write-Host "Firewall rule allowed for TCP $Port (LAN)."
} else {
  Get-NetFirewallRule -DisplayName 'MySpace Remote Agent' -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
  Write-Host "No firewall rule. Agent will bind to 127.0.0.1 only."
}

$taskName = 'MySpaceRemoteAgent'
$node = (Get-Command node).Source
$action = New-ScheduledTaskAction -Execute $node -Argument "`"$AgentDir\server.js`"" -WorkingDirectory $AgentDir
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Agent installed. Starts at logon."
if ($AllowLan) {
  Write-Host "Listening for LAN on port $Port (0.0.0.0)."
} else {
  Write-Host "Listening on localhost only. Re-run install.ps1 and answer Y for remote Control."
}
Write-Host "IMPORTANT — copy this Agent token into Remote Hub (machine → Agent token):"
Write-Host $Token
Write-Host "(Also saved in agent-config.json on this PC. Do not share it publicly.)"
Write-Host "Test: node `"$AgentDir\server.js`" then connect from Remote Hub -> Control."