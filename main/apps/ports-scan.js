const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);

const PROCESS_CACHE_MS = 8000;
let processCache = { at: 0, map: new Map() };

async function getProcessMap() {
  const now = Date.now();
  if (now - processCache.at < PROCESS_CACHE_MS && processCache.map.size) {
    return processCache.map;
  }

  const map = new Map();
  if (process.platform !== "win32") {
    processCache = { at: now, map };
    return map;
  }

  try {
    const { stdout } = await execAsync(
      'powershell.exe -NoProfile -Command "Get-Process | Select-Object Id,ProcessName,Path | ConvertTo-Json -Compress"',
      { windowsHide: true, maxBuffer: 8 * 1024 * 1024 }
    );
    const parsed = JSON.parse(stdout || "[]");
    const list = Array.isArray(parsed) ? parsed : [parsed];
    for (const p of list) {
      if (p?.Id != null) {
        map.set(Number(p.Id), {
          name: p.ProcessName || "Unknown",
          path: p.Path || "",
        });
      }
    }
  } catch {
  }

  processCache = { at: now, map };
  return map;
}

function parseNetstatLine(line) {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 4) return null;

  const protocol = parts[0].toUpperCase();
  if (protocol !== "TCP" && protocol !== "UDP") return null;

  const local = parts[1];
  const remote = parts[2];
  const stateOrPid = protocol === "TCP" ? parts[3] : parts[3];
  const pidRaw = protocol === "TCP" ? parts[4] : parts[3];

  let state = "—";
  let pid = 0;

  if (protocol === "TCP") {
    state = stateOrPid || "—";
    pid = parseInt(pidRaw, 10) || 0;
  } else {
    pid = parseInt(stateOrPid, 10) || 0;
    state = parts.length > 4 ? parts[4] : "—";
  }

  const localMatch = local.match(/^\[?([^\]]+)\]?:?(\d+)?$/);
  const remoteMatch = remote.match(/^\[?([^\]]+)\]?:?(\d+)?$/);

  return {
    protocol,
    localAddress: localMatch?.[1] || local,
    localPort: parseInt(localMatch?.[2], 10) || 0,
    remoteAddress: remoteMatch?.[1] || remote,
    remotePort: parseInt(remoteMatch?.[2], 10) || 0,
    state,
    pid,
  };
}

function parseAddressHost(addr) {
  if (!addr || addr === "*" || addr === "0.0.0.0" || addr === "::" || addr === "[::]") {
    return "All interfaces";
  }
  if (addr === "127.0.0.1" || addr === "::1" || addr === "[::1]") {
    return "Localhost";
  }
  return addr;
}

async function scanPorts() {
  if (process.platform !== "win32") {
    return {
      ok: true,
      scannedAt: new Date().toISOString(),
      summary: { total: 0, listening: 0, established: 0, timeWait: 0, uniqueProcesses: 0 },
      ports: [],
      note: "Port scan is supported on Windows only.",
    };
  }

  const { stdout } = await execAsync("netstat -ano", {
    windowsHide: true,
    maxBuffer: 12 * 1024 * 1024,
  });

  const procMap = await getProcessMap();
  const ports = [];
  const lines = stdout.split(/\r?\n/);

  for (const line of lines) {
    if (!/^\s*(TCP|UDP)\s/i.test(line)) continue;
    const row = parseNetstatLine(line);
    if (!row || !row.localPort) continue;

    const proc = procMap.get(row.pid) || { name: row.pid ? "Unknown" : "System", path: "" };

    ports.push({
      ...row,
      processName: proc.name,
      processPath: proc.path,
      localHostLabel: parseAddressHost(row.localAddress),
      remoteHostLabel: parseAddressHost(row.remoteAddress),
      key: `${row.protocol}:${row.localPort}:${row.pid}:${row.state}`,
    });
  }

  ports.sort((a, b) => a.localPort - b.localPort || a.protocol.localeCompare(b.protocol));

  const listening = ports.filter((p) => p.state === "LISTENING").length;
  const established = ports.filter((p) => p.state === "ESTABLISHED").length;
  const timeWait = ports.filter((p) => p.state === "TIME_WAIT").length;
  const uniqueProcesses = new Set(ports.map((p) => p.pid).filter(Boolean)).size;

  return {
    ok: true,
    scannedAt: new Date().toISOString(),
    summary: {
      total: ports.length,
      listening,
      established,
      timeWait,
      uniqueProcesses,
    },
    ports,
  };
}

module.exports = { scanPorts };
