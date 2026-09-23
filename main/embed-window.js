const path = require("path");
const { spawn } = require("child_process");
const { launchExternalApp } = require("./launch");

const ELECTRON_EDITOR_EXE_NAMES = new Set(["cursor.exe", "code.exe", "code - insiders.exe"]);

let apis = null;

const SW_HIDE = 0;
const SW_SHOW = 5;
const SW_RESTORE = 9;
const GWL_STYLE = -16;
const GWL_EXSTYLE = -20;
const WS_CHILD = 0x40000000;
const WS_VISIBLE = 0x10000000;
const WS_CAPTION = 0x00c00000;
const WS_THICKFRAME = 0x00040000;
const WS_POPUP = 0x80000000;
const WS_SYSMENU = 0x00080000;
const WS_MINIMIZEBOX = 0x00020000;
const WS_MAXIMIZEBOX = 0x00010000;
const WS_BORDER = 0x00800000;
const WS_DLGFRAME = 0x00400000;
const WS_EX_TOOLWINDOW = 0x00000080;
const WS_EX_NOACTIVATE = 0x08000000;
const SWP_NOSIZE = 0x0001;
const SWP_NOMOVE = 0x0002;
const SWP_NOZORDER = 0x0004;
const SWP_FRAMECHANGED = 0x0020;
const SWP_SHOWWINDOW = 0x0040;
const HWND_TOP = 0;

function loadApis() {
  if (apis) return apis;
  if (process.platform !== "win32") {
    apis = { ok: false, error: "Window embedding is only supported on Windows" };
    return apis;
  }
  try {
    const koffi = require("koffi");
    const user32 = koffi.load("user32.dll");

    const EnumWindowsProc = koffi.proto(
      "bool __stdcall EnumWindowsProc(void *hwnd, intptr lParam)"
    );

    apis = {
      ok: true,
      koffi,
      user32,
      SetParent: user32.func("__stdcall", "SetParent", "void *", ["void *", "void *"]),
      ShowWindow: user32.func("__stdcall", "ShowWindow", "int", ["void *", "int"]),
      MoveWindow: user32.func("__stdcall", "MoveWindow", "int", [
        "void *",
        "int",
        "int",
        "int",
        "int",
        "int",
      ]),
      SetWindowPos: user32.func("__stdcall", "SetWindowPos", "int", [
        "void *",
        "void *",
        "int",
        "int",
        "int",
        "int",
        "uint32",
      ]),
      IsWindow: user32.func("__stdcall", "IsWindow", "int", ["void *"]),
      IsWindowVisible: user32.func("__stdcall", "IsWindowVisible", "int", ["void *"]),
      IsIconic: user32.func("__stdcall", "IsIconic", "int", ["void *"]),
      GetWindowRect: user32.func("__stdcall", "GetWindowRect", "int", ["void *", "void *"]),
      GetWindowLongPtr:
        process.arch === "x64"
          ? user32.func("__stdcall", "GetWindowLongPtrW", "int64", ["void *", "int"])
          : user32.func("__stdcall", "GetWindowLongW", "int32", ["void *", "int"]),
      SetWindowLongPtr:
        process.arch === "x64"
          ? user32.func("__stdcall", "SetWindowLongPtrW", "int64", ["void *", "int", "int64"])
          : user32.func("__stdcall", "SetWindowLongW", "int32", ["void *", "int", "int32"]),
      SetForegroundWindow: user32.func("__stdcall", "SetForegroundWindow", "int", ["void *"]),
      BringWindowToTop: user32.func("__stdcall", "BringWindowToTop", "int", ["void *"]),
      SetFocus: user32.func("__stdcall", "SetFocus", "void *", ["void *"]),
      GetForegroundWindow: user32.func("__stdcall", "GetForegroundWindow", "void *", []),
      AttachThreadInput: user32.func("__stdcall", "AttachThreadInput", "int", [
        "uint32",
        "uint32",
        "int",
      ]),
      GetWindowThreadProcessId: user32.func("__stdcall", "GetWindowThreadProcessId", "uint32", [
        "void *",
        koffi.out("uint32 *"),
      ]),
      EnumWindows: user32.func("__stdcall", "EnumWindows", "int", [
        koffi.pointer(EnumWindowsProc),
        "intptr",
      ]),
      EnumWindowsProc,
      PostMessageW: user32.func("__stdcall", "PostMessageW", "int", [
        "void *",
        "uint32",
        "uintptr",
        "intptr",
      ]),
      GetWindow: user32.func("__stdcall", "GetWindow", "void *", ["void *", "uint32"]),
      GetParent: user32.func("__stdcall", "GetParent", "void *", ["void *"]),
      GetDpiForWindow: null,
    };

    try {
      apis.GetDpiForWindow = user32.func("__stdcall", "GetDpiForWindow", "uint32", ["void *"]);
    } catch {
      apis.GetDpiForWindow = null;
    }

    try {
      const kernel32 = koffi.load("kernel32.dll");
      apis.GetCurrentThreadId = kernel32.func("__stdcall", "GetCurrentThreadId", "uint32", []);
    } catch {
      apis.GetCurrentThreadId = null;
    }

    try {
      apis.AllowSetForegroundWindow = user32.func("__stdcall", "AllowSetForegroundWindow", "int", [
        "uint32",
      ]);
    } catch {
      apis.AllowSetForegroundWindow = null;
    }

    return apis;
  } catch (err) {
    apis = { ok: false, error: err.message || String(err) };
    return apis;
  }
}

function hwndFromElectronHandle(buf) {
  if (!buf || !Buffer.isBuffer(buf)) return null;
  if (process.arch === "x64") {
    return buf.length >= 8 ? buf.readBigUInt64LE(0) : null;
  }
  return buf.length >= 4 ? buf.readUInt32LE(0) : null;
}

function toNativeHwnd(value) {
  if (value == null) return null;
  if (typeof value === "bigint" || typeof value === "number") return value;
  return null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getWindowRect(hwnd) {
  const a = loadApis();
  if (!a.ok) return null;
  try {
    const buf = Buffer.alloc(16);
    if (!a.GetWindowRect(hwnd, buf)) return null;
    const left = buf.readInt32LE(0);
    const top = buf.readInt32LE(4);
    const right = buf.readInt32LE(8);
    const bottom = buf.readInt32LE(12);
    const width = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);
    return { left, top, width, height, area: width * height };
  } catch {
    return null;
  }
}

function isToolWindow(hwnd) {
  const a = loadApis();
  try {
    const ex = Number(a.GetWindowLongPtr(hwnd, GWL_EXSTYLE));
    return Boolean(ex & (WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE));
  } catch {
    return false;
  }
}

function findWindowsForPid(pid) {
  const a = loadApis();
  if (!a.ok) return [];
  const found = [];
  const pidNum = Number(pid);
  const GW_OWNER = 4;

  const callback = a.koffi.register((hwnd) => {
    try {
      const outPid = [0];
      a.GetWindowThreadProcessId(hwnd, outPid);
      if (Number(outPid[0]) !== pidNum) return true;
      if (!a.IsWindow(hwnd)) return true;
      const owner = a.GetWindow(hwnd, GW_OWNER);
      if (owner) return true;
      if (isToolWindow(hwnd)) return true;
      found.push(hwnd);
    } catch {
    }
    return true;
  }, a.koffi.pointer(a.EnumWindowsProc));

  try {
    a.EnumWindows(callback, 0);
  } finally {
    try {
      a.koffi.unregister(callback);
    } catch {
    }
  }
  return found;
}

function isElectronEditorExe(exePath) {
  if (!exePath) return false;
  return ELECTRON_EDITOR_EXE_NAMES.has(path.basename(exePath).toLowerCase());
}

function getWindowClassName(hwnd) {
  const a = loadApis();
  if (!a.ok || hwnd == null) return "";
  try {
    if (!a.GetClassNameW) {
      a.GetClassNameW = a.user32.func("__stdcall", "GetClassNameW", "int", [
        "void *",
        "str16",
        "int",
      ]);
    }
    const buf = Buffer.alloc(512);
    const len = Number(a.GetClassNameW(hwnd, buf, 256));
    if (len <= 0) return "";
    return buf.toString("utf16le").replace(/\0/g, "").slice(0, len);
  } catch {
    return "";
  }
}

function scoreHwnd(hwnd, { minArea = 0, exePath = null } = {}) {
  const a = loadApis();
  try {
    if (!a.IsWindow(hwnd)) return -1;
    const rect = getWindowRect(hwnd);
    if (!rect) return 0;
    if (rect.area < minArea) return rect.area > 0 ? 1 : 0;
    let score = rect.area;
    if (a.IsWindowVisible(hwnd) && !a.IsIconic(hwnd)) score += 5_000_000;
    else if (a.IsWindowVisible(hwnd)) score += 1_000_000;
    if (rect.width >= 400 && rect.height >= 300) score += 500_000;
    const cls = getWindowClassName(hwnd);
    if (cls === "Chrome_WidgetWin_1") score += 2_000_000;
    if (isElectronEditorExe(exePath) && cls === "Chrome_WidgetWin_1") score += 3_000_000;
    return score;
  } catch {
    return 0;
  }
}

function pickBestHwnd(hwnds, { minArea = 0, exePath = null } = {}) {
  if (!hwnds.length) return null;
  let best = null;
  let bestScore = -1;
  for (const h of hwnds) {
    const s = scoreHwnd(h, { minArea, exePath });
    if (s > bestScore) {
      bestScore = s;
      best = h;
    }
  }
  return best;
}

async function waitForProcessWindow(
  pid,
  { timeoutMs = 22000, intervalMs = 250, minArea = 40000, exePath = null } = {}
) {
  const start = Date.now();
  let lastAny = null;
  while (Date.now() - start < timeoutMs) {
    const hwnds = findWindowsForPid(pid);
    const solid = pickBestHwnd(hwnds, { minArea, exePath });
    if (solid && scoreHwnd(solid, { minArea, exePath }) >= minArea) return solid;
    const any = pickBestHwnd(hwnds, { minArea: 0, exePath });
    if (any) lastAny = any;
    const elapsed = Date.now() - start;
    if (elapsed > timeoutMs * 0.6) {
      const medium = pickBestHwnd(hwnds, { minArea: Math.floor(minArea / 4), exePath });
      if (medium) return medium;
    }
    await sleep(intervalMs);
  }
  return lastAny;
}

function spawnTracked(exePath, args = []) {
  return new Promise((resolve) => {
    try {
      const child = spawn(exePath, Array.isArray(args) ? args : [], {
        detached: true,
        stdio: "ignore",
        windowsHide: false,
      });
      child.unref();
      if (child.pid) {
        resolve({ ok: true, pid: child.pid, spawned: true });
        return;
      }
    } catch {
    }
    if (args && args.length) {
      resolve({ ok: false, pid: null, spawned: false, error: "Could not start program with arguments" });
      return;
    }
    launchExternalApp(exePath).then((r) => {
      resolve({ ok: r.ok, pid: null, spawned: false, error: r.error });
    });
  });
}

function listProcessTreePids(rootPid) {
  return new Promise((resolve) => {
    if (!rootPid || process.platform !== "win32") {
      resolve(rootPid ? [Number(rootPid)] : []);
      return;
    }
    const ps = `
$ErrorActionPreference='SilentlyContinue'
$root=${Number(rootPid)}
$all=@($root)
$queue=[System.Collections.Generic.Queue[int]]::new()
$queue.Enqueue($root)
while($queue.Count -gt 0){
  $p=$queue.Dequeue()
  Get-CimInstance Win32_Process -Filter "ParentProcessId=$p" | ForEach-Object {
    $id=[int]$_.ProcessId
    if($all -notcontains $id){ $all+=$id; $queue.Enqueue($id) }
  }
}
$all -join ','
`;
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps],
      { windowsHide: true }
    );
    let out = "";
    child.stdout.on("data", (c) => {
      out += c.toString();
    });
    child.on("close", () => {
      const ids = String(out || "")
        .trim()
        .split(",")
        .map((s) => parseInt(s, 10))
        .filter((n) => Number.isFinite(n) && n > 0);
      resolve(ids.length ? ids : [Number(rootPid)]);
    });
    child.on("error", () => resolve([Number(rootPid)]));
  });
}

async function waitForProcessTreeWindow(
  rootPid,
  { timeoutMs = 28000, intervalMs = 250, minArea = 20000, exePath = null } = {}
) {
  const start = Date.now();
  let lastAny = null;
  while (Date.now() - start < timeoutMs) {
    const pids = await listProcessTreePids(rootPid);
    const hwnds = [];
    for (const pid of pids) {
      hwnds.push(...findWindowsForPid(pid));
    }
    const solid = pickBestHwnd(hwnds, { minArea, exePath });
    if (solid && scoreHwnd(solid, { minArea, exePath }) >= minArea) return solid;
    const any = pickBestHwnd(hwnds, { minArea: 0, exePath });
    if (any) lastAny = any;
    const elapsed = Date.now() - start;
    if (elapsed > timeoutMs * 0.55) {
      const medium = pickBestHwnd(hwnds, { minArea: Math.floor(minArea / 4), exePath });
      if (medium) return medium;
    }
    await sleep(intervalMs);
  }
  return lastAny;
}

function killProcessTree(pid) {
  if (!pid || process.platform !== "win32") return;
  try {
    const child = spawn(
      "taskkill",
      ["/PID", String(pid), "/T", "/F"],
      { detached: true, stdio: "ignore", windowsHide: true }
    );
    child.unref();
  } catch {
  }
}

function findPidByExePath(exePath) {
  return new Promise((resolve) => {
    const full = path.resolve(exePath).toLowerCase();
    const base = path.basename(exePath, path.extname(exePath));
    const ps = `
$ErrorActionPreference='SilentlyContinue'
$want='${full.replace(/'/g, "''")}'
$base='${base.replace(/'/g, "''")}'
$p = Get-Process -Name $base -ErrorAction SilentlyContinue | Where-Object {
  try { $_.Path -and ($_.Path.ToLower() -eq $want) } catch { $false }
} | Select-Object -First 1
if ($p) { Write-Output $p.Id } else {
  $p2 = Get-Process -Name $base -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($p2) { Write-Output $p2.Id }
}
`;
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps],
      { windowsHide: true }
    );
    let out = "";
    child.stdout.on("data", (c) => {
      out += c.toString();
    });
    child.on("close", () => {
      const id = parseInt(out.trim(), 10);
      resolve(Number.isFinite(id) ? id : null);
    });
    child.on("error", () => resolve(null));
  });
}

function styleAsChild(hwnd, { preserveFrame = false } = {}) {
  const a = loadApis();
  try {
    let style = Number(a.GetWindowLongPtr(hwnd, GWL_STYLE));
    style |= WS_CHILD | WS_VISIBLE;
    style &= ~WS_POPUP;
    if (!preserveFrame) {
      style &= ~(
        WS_CAPTION |
        WS_THICKFRAME |
        WS_SYSMENU |
        WS_MINIMIZEBOX |
        WS_MAXIMIZEBOX |
        WS_BORDER |
        WS_DLGFRAME
      );
    }
    a.SetWindowLongPtr(hwnd, GWL_STYLE, style);
    a.SetWindowPos(hwnd, HWND_TOP, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED);
  } catch {
  }
}

function embedHwnd(childHwnd, parentHwnd, bounds, { preserveFrame = false } = {}) {
  const a = loadApis();
  if (!a.ok) return { ok: false, error: a.error };
  const child = toNativeHwnd(childHwnd);
  const parent = toNativeHwnd(parentHwnd);
  if (child == null || parent == null) return { ok: false, error: "Invalid window handle" };
  if (!a.IsWindow(child) || !a.IsWindow(parent)) {
    return { ok: false, error: "Window no longer exists" };
  }

  try {
    if (a.IsIconic(child)) a.ShowWindow(child, SW_RESTORE);
  } catch {
  }

  styleAsChild(child, { preserveFrame });
  a.SetParent(child, parent);
  const x = Math.round(bounds?.x || 0);
  const y = Math.round(bounds?.y || 0);
  const w = Math.max(50, Math.round(bounds?.width || 800));
  const h = Math.max(50, Math.round(bounds?.height || 600));
  a.MoveWindow(child, x, y, w, h, 1);
  a.SetWindowPos(child, HWND_TOP, x, y, w, h, SWP_SHOWWINDOW | SWP_FRAMECHANGED);
  a.ShowWindow(child, SW_SHOW);
  a.BringWindowToTop(child);
  return { ok: true };
}

function updateEmbeddedBounds(childHwnd, bounds) {
  const a = loadApis();
  if (!a.ok) return { ok: false, error: a.error };
  const child = toNativeHwnd(childHwnd);
  if (child == null || !a.IsWindow(child)) return { ok: false, error: "Window gone", gone: true };
  const x = Math.round(bounds?.x || 0);
  const y = Math.round(bounds?.y || 0);
  const w = Math.max(50, Math.round(bounds?.width || 800));
  const h = Math.max(50, Math.round(bounds?.height || 600));
  a.MoveWindow(child, x, y, w, h, 1);
  return { ok: true };
}

function setEmbeddedVisible(childHwnd, visible) {
  const a = loadApis();
  if (!a.ok) return { ok: false, error: a.error };
  const child = toNativeHwnd(childHwnd);
  if (child == null || !a.IsWindow(child)) return { ok: false, error: "Window gone", gone: true };
  a.ShowWindow(child, visible ? SW_SHOW : SW_HIDE);
  return { ok: true };
}

function threadIdForHwnd(hwnd) {
  const a = loadApis();
  if (!a.ok || hwnd == null) return 0;
  try {
    const outPid = [0];
    const tid = Number(a.GetWindowThreadProcessId(hwnd, outPid) || 0);
    return tid || 0;
  } catch {
    return 0;
  }
}

function focusEmbeddedHwnd(childHwnd, parentHwnd) {
  const a = loadApis();
  if (!a.ok) return { ok: false, error: a.error };
  const child = toNativeHwnd(childHwnd);
  if (child == null || !a.IsWindow(child)) return { ok: false, error: "Window gone", gone: true };

  try {
    if (a.IsIconic(child)) a.ShowWindow(child, SW_RESTORE);
  } catch {
  }
  a.ShowWindow(child, SW_SHOW);
  a.BringWindowToTop(child);

  const parent = parentHwnd != null ? toNativeHwnd(parentHwnd) : null;
  const fg = a.GetForegroundWindow ? a.GetForegroundWindow() : null;
  const childTid = threadIdForHwnd(child);
  const fgTid = fg ? threadIdForHwnd(fg) : 0;
  const curTid = a.GetCurrentThreadId ? Number(a.GetCurrentThreadId() || 0) : 0;

  const attached = [];
  const attach = (aTid, bTid) => {
    if (!aTid || !bTid || aTid === bTid) return;
    try {
      if (a.AttachThreadInput(aTid, bTid, 1)) attached.push([aTid, bTid]);
    } catch {
    }
  };

  try {
    if (a.AllowSetForegroundWindow) a.AllowSetForegroundWindow(0xffffffff);
  } catch {
  }

  attach(fgTid, childTid);
  attach(curTid, childTid);
  if (parent) {
    const parentTid = threadIdForHwnd(parent);
    attach(parentTid, childTid);
    try {
      a.SetForegroundWindow(parent);
    } catch {
    }
  }

  let focused = false;
  try {
    focused = Boolean(a.SetForegroundWindow(child));
  } catch {
    focused = false;
  }
  try {
    a.SetFocus(child);
  } catch {
  }
  try {
    a.BringWindowToTop(child);
  } catch {
  }

  for (const [aTid, bTid] of attached) {
    try {
      a.AttachThreadInput(aTid, bTid, 0);
    } catch {
    }
  }

  return { ok: true, focused };
}

function isHwndAlive(childHwnd) {
  const a = loadApis();
  if (!a.ok) return false;
  const child = toNativeHwnd(childHwnd);
  if (child == null) return false;
  try {
    return Boolean(a.IsWindow(child));
  } catch {
    return false;
  }
}

function positionTopLevelHwnd(hwnd, screenBounds) {
  const a = loadApis();
  if (!a.ok) return { ok: false, error: a.error };
  const child = toNativeHwnd(hwnd);
  if (child == null || !a.IsWindow(child)) return { ok: false, error: "Window gone", gone: true };
  try {
    if (a.IsIconic(child)) a.ShowWindow(child, SW_RESTORE);
  } catch {
  }
  const x = Math.round(screenBounds?.x || 0);
  const y = Math.round(screenBounds?.y || 0);
  const w = Math.max(50, Math.round(screenBounds?.width || 800));
  const h = Math.max(50, Math.round(screenBounds?.height || 600));
  a.SetWindowPos(child, HWND_TOP, x, y, w, h, SWP_SHOWWINDOW);
  a.ShowWindow(child, SW_SHOW);
  return { ok: true };
}

function detachHwnd(childHwnd, { close = false } = {}) {
  const a = loadApis();
  if (!a.ok) return { ok: false, error: a.error };
  const child = toNativeHwnd(childHwnd);
  if (child == null || !a.IsWindow(child)) return { ok: true, gone: true };
  try {
    a.SetParent(child, null);
  } catch {
  }
  if (close) {
    try {
      a.PostMessageW(child, 0x0010, 0, 0); 
    } catch {
      a.ShowWindow(child, SW_RESTORE);
    }
  } else {
    a.ShowWindow(child, SW_RESTORE);
  }
  return { ok: true };
}

function getDpiForHwnd(hwnd) {
  const a = loadApis();
  if (!a.ok || !a.GetDpiForWindow) return null;
  try {
    const dpi = Number(a.GetDpiForWindow(toNativeHwnd(hwnd)));
    return dpi > 0 ? dpi : null;
  } catch {
    return null;
  }
}

function isEmbedAvailable() {
  return loadApis().ok;
}

module.exports = {
  isEmbedAvailable,
  isElectronEditorExe,
  loadApis,
  hwndFromElectronHandle,
  spawnTracked,
  findPidByExePath,
  waitForProcessWindow,
  waitForProcessTreeWindow,
  listProcessTreePids,
  findWindowsForPid,
  pickBestHwnd,
  embedHwnd,
  positionTopLevelHwnd,
  updateEmbeddedBounds,
  setEmbeddedVisible,
  focusEmbeddedHwnd,
  detachHwnd,
  isHwndAlive,
  killProcessTree,
  getDpiForHwnd,
  sleep,
};