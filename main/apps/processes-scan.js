const { runPowerShell, toArray, formatBytes, parsePsDate } = require("./exec-utils");

async function scanProcesses() {
  const scannedAt = new Date().toISOString();

  if (process.platform !== "win32") {
    return {
      ok: true,
      scannedAt,
      summary: { total: 0, running: 0, notResponding: 0, totalMemoryBytes: 0 },
      processes: [],
      note: "Process scan is supported on Windows only.",
    };
  }

  try {
    const raw = await runPowerShell(
      "Get-Process -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,CPU,WS,PM,StartTime,Path,Responding,@{N='ThreadCount';E={$_.Threads.Count}} | ConvertTo-Json -Compress"
    );

    const list = toArray(raw);
    const processes = list
      .filter((p) => p?.Id != null)
      .map((p) => {
        const ws = Number(p.WS) || 0;
        const pm = Number(p.PM) || 0;
        const cpu = Number(p.CPU) || 0;
        const startTime = parsePsDate(p.StartTime);
        return {
          pid: Number(p.Id),
          name: p.ProcessName || "Unknown",
          path: p.Path || "",
          cpuSeconds: Math.round(cpu * 100) / 100,
          memoryBytes: ws,
          privateBytes: pm,
          memoryLabel: formatBytes(ws),
          threads: Number(p.ThreadCount) || 0,
          responding: p.Responding !== false,
          startTime,
          key: `proc-${p.Id}`,
        };
      })
      .sort((a, b) => b.memoryBytes - a.memoryBytes);

    const running = processes.filter((p) => p.responding).length;
    const notResponding = processes.length - running;
    const totalMemoryBytes = processes.reduce((s, p) => s + p.memoryBytes, 0);

    return {
      ok: true,
      scannedAt,
      summary: {
        total: processes.length,
        running,
        notResponding,
        totalMemoryBytes,
        totalMemoryLabel: formatBytes(totalMemoryBytes),
      },
      processes,
    };
  } catch (err) {
    return { ok: false, error: err.message || "Process scan failed" };
  }
}

module.exports = { scanProcesses };
