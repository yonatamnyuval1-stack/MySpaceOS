const { runPowerShell, toArray, parsePsDate } = require("./exec-utils");
const { scanProcesses } = require("./processes-scan");

async function scanCpu() {
  const scannedAt = new Date().toISOString();

  if (process.platform !== "win32") {
    return {
      ok: true,
      scannedAt,
      summary: null,
      processor: null,
      cores: [],
      topProcesses: [],
      note: "CPU scan is supported on Windows only.",
    };
  }

  try {
    const procRaw = await runPowerShell(
      "Get-CimInstance Win32_Processor | Select-Object Name,Manufacturer,NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed,CurrentClockSpeed,LoadPercentage,Architecture | ConvertTo-Json -Compress"
    );
    const proc = toArray(procRaw)[0] || {};

    const counterRaw = await runPowerShell(
      "Get-Counter '\\Processor(*)\\% Processor Time' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty CounterSamples | Select-Object InstanceName,CookedValue | ConvertTo-Json -Compress"
    );
    const samples = toArray(counterRaw);

    let totalUsage = Number(proc.LoadPercentage) || 0;
    const cores = [];

    for (const s of samples) {
      const name = s.InstanceName;
      if (name === "_Total") {
        totalUsage = Math.round(Number(s.CookedValue) * 10) / 10;
        continue;
      }
      if (name === "Idle" || name === "_Total") continue;
      if (/^\d+$/.test(name)) {
        cores.push({
          id: Number(name),
          label: `Core ${name}`,
          usagePercent: Math.round(Number(s.CookedValue) * 10) / 10,
        });
      }
    }

    cores.sort((a, b) => a.id - b.id);

    const maxClock = Number(proc.MaxClockSpeed) || 0;
    const currentClock = Number(proc.CurrentClockSpeed) || maxClock;

    const processor = {
      name: proc.Name || "Unknown CPU",
      manufacturer: proc.Manufacturer || "",
      cores: Number(proc.NumberOfCores) || cores.length || 0,
      threads: Number(proc.NumberOfLogicalProcessors) || 0,
      maxClockMhz: maxClock,
      currentClockMhz: currentClock,
      maxClockGhz: maxClock ? `${(maxClock / 1000).toFixed(2)} GHz` : "—",
      currentClockGhz: currentClock ? `${(currentClock / 1000).toFixed(2)} GHz` : "—",
    };

    let topProcesses = [];
    try {
      const procResult = await scanProcesses();
      topProcesses = (procResult.processes || [])
        .filter((p) => p.cpuSeconds > 0)
        .sort((a, b) => b.cpuSeconds - a.cpuSeconds)
        .slice(0, 15)
        .map((p) => ({
          pid: p.pid,
          name: p.name,
          cpuSeconds: p.cpuSeconds,
          memoryLabel: p.memoryLabel,
        }));
    } catch {
    }

    return {
      ok: true,
      scannedAt,
      summary: {
        usagePercent: totalUsage,
        cores: processor.cores,
        threads: processor.threads,
        model: processor.name,
      },
      processor,
      cores,
      totalUsagePercent: totalUsage,
      topProcesses,
    };
  } catch (err) {
    return { ok: false, error: err.message || "CPU scan failed" };
  }
}

module.exports = { scanCpu };