const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { launchExternalApp } = require("./launch");

function escapePsString(value) {
  return String(value).replace(/'/g, "''");
}

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      { windowsHide: true }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() }));
  });
}

async function focusExternalApp(exePath) {
  if (!exePath) {
    return { ok: false, error: "No program path" };
  }
  if (!fs.existsSync(exePath)) {
    return launchExternalApp(exePath);
  }

  if (process.platform !== "win32") {
    return launchExternalApp(exePath);
  }

  const fullPath = path.resolve(exePath);
  const procName = path.basename(fullPath, path.extname(fullPath));
  const exePathPs = escapePsString(fullPath);
  const procNamePs = escapePsString(procName);

  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$exePath = '${exePathPs}'
$procName = '${procNamePs}'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MySpaceFocus {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
}
"@
$target = $null
foreach ($p in Get-Process -Name $procName -ErrorAction SilentlyContinue) {
  if ($p.MainWindowHandle -ne [IntPtr]::Zero) {
    $target = $p
    break
  }
}
if ($target) {
  [void][MySpaceFocus]::ShowWindow($target.MainWindowHandle, 9)
  [void][MySpaceFocus]::BringWindowToTop($target.MainWindowHandle)
  $shell = New-Object -ComObject WScript.Shell
  $null = $shell.AppActivate($target.Id)
  [void][MySpaceFocus]::SetForegroundWindow($target.MainWindowHandle)
  Write-Output 'FOCUSED'
} else {
  Write-Output 'NOTFOUND'
}
`;

  try {
    const { stdout } = await runPowerShell(script);
    if (stdout.includes("FOCUSED")) {
      return { ok: true, focused: true };
    }
    return launchExternalApp(exePath);
  } catch {
    return launchExternalApp(exePath);
  }
}

module.exports = { focusExternalApp };