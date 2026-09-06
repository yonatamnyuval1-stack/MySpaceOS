param([string]$Json)
$ErrorActionPreference = 'SilentlyContinue'

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class RhInput {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

  const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
  const uint MOUSEEVENTF_LEFTUP = 0x0004;
  const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
  const uint MOUSEEVENTF_RIGHTUP = 0x0010;
  const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
  const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
  const uint MOUSEEVENTF_WHEEL = 0x0800;
  const uint KEYEVENTF_KEYUP = 0x0002;

  public static void Move(int x, int y) { SetCursorPos(x, y); }

  public static void MouseDown(int x, int y, int button) {
    SetCursorPos(x, y);
    uint f = button == 2 ? MOUSEEVENTF_RIGHTDOWN : (button == 1 ? MOUSEEVENTF_MIDDLEDOWN : MOUSEEVENTF_LEFTDOWN);
    mouse_event(f, 0, 0, 0, UIntPtr.Zero);
  }

  public static void MouseUp(int x, int y, int button) {
    SetCursorPos(x, y);
    uint f = button == 2 ? MOUSEEVENTF_RIGHTUP : (button == 1 ? MOUSEEVENTF_MIDDLEUP : MOUSEEVENTF_LEFTUP);
    mouse_event(f, 0, 0, 0, UIntPtr.Zero);
  }

  public static void Wheel(int x, int y, int delta) {
    SetCursorPos(x, y);
    mouse_event(MOUSEEVENTF_WHEEL, 0, 0, (uint)delta, UIntPtr.Zero);
  }

  public static void KeyDown(byte vk) { keybd_event(vk, 0, 0, UIntPtr.Zero); }
  public static void KeyUp(byte vk) { keybd_event(vk, 0, KEYEVENTF_KEYUP, UIntPtr.Zero); }
}
"@

if (-not $Json) { exit 0 }
$msg = $Json | ConvertFrom-Json
$x = [int]$msg.x
$y = [int]$msg.y
$button = if ($null -ne $msg.button) { [int]$msg.button } else { 0 }
$delta = if ($null -ne $msg.delta) { [int]$msg.delta } else { 0 }
$vk = if ($null -ne $msg.vk) { [byte]$msg.vk } else { 0 }

switch ($msg.action) {
  'move' { [RhInput]::Move($x, $y) }
  'mousedown' { [RhInput]::MouseDown($x, $y, $button) }
  'mouseup' { [RhInput]::MouseUp($x, $y, $button) }
  'wheel' { [RhInput]::Wheel($x, $y, $delta) }
  'keydown' { if ($vk -gt 0) { [RhInput]::KeyDown($vk) } }
  'keyup' { if ($vk -gt 0) { [RhInput]::KeyUp($vk) } }
}
