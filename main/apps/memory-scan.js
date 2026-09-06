const { runPowerShell, toArray, formatBytes } = require("./exec-utils");
const { scanProcesses } = require("./processes-scan");

async function scanMemory() {
  const scannedAt = new Date().toISOString();

  if (process.platform !== "win32") {
    return {
      ok: true,
      scannedAt,
      physical: null,
      virtual: null,
      topProcesses: [],
      note: "Memory scan is supported on Windows only.",
    };
  }

  try {
    const osRaw = await runPowerShell(
      "Get-CimInstance Win32_OperatingSystem | Select-Object TotalVisibleMemorySize,FreePhysicalMemory,TotalVirtualMemorySize,FreeVirtualMemory,LastBootUpTime | ConvertTo-Json -Compress"
    );
    const csRaw = await runPowerShell(
      "Get-CimInstance Win32_ComputerSystem | Select-Object TotalPhysicalMemory | ConvertTo-Json -Compress"
    );

    const os = toArray(osRaw)[0] || {};
    const cs = toArray(csRaw)[0] || {};

    const totalKb = Number(os.TotalVisibleMemorySize) || 0;
    const freeKb = Number(os.FreePhysicalMemory) || 0;
    const totalPhys = Number(cs.TotalPhysicalMemory) || totalKb * 1024;
    const usedKb = Math.max(0, totalKb - freeKb);

    const totalBytes = totalPhys || totalKb * 1024;
    const usedBytes = usedKb * 1024;
    const freeBytes = freeKb * 1024;
    const usagePercent = totalBytes ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0;

    const virtTotalKb = Number(os.TotalVirtualMemorySize) || 0;
    const virtFreeKb = Number(os.FreeVirtualMemory) || 0;
    const virtUsedKb = Math.max(0, virtTotalKb - virtFreeKb);

    let topProcesses = [];
    try {
      const procResult = await scanProcesses();
      if (procResult.processes) {
        topProcesses = procResult.processes.slice(0, 24).map((p) => ({
          pid: p.pid,
          name: p.name,
          memoryBytes: p.memoryBytes,
          memoryLabel: p.memoryLabel,
          percentOfTotal: totalBytes
            ? Math.round((p.memoryBytes / totalBytes) * 1000) / 10
            : 0,
        }));
      }
    } catch {
    }

    return {
      ok: true,
      scannedAt,
      physical: {
        totalBytes,
        usedBytes,
        freeBytes,
        usagePercent,
        totalLabel: formatBytes(totalBytes),
        usedLabel: formatBytes(usedBytes),
        freeLabel: formatBytes(freeBytes),
      },
      virtual: {
        totalBytes: virtTotalKb * 1024,
        usedBytes: virtUsedKb * 1024,
        freeBytes: virtFreeKb * 1024,
        usagePercent: virtTotalKb
          ? Math.round((virtUsedKb / virtTotalKb) * 1000) / 10
          : 0,
        totalLabel: formatBytes(virtTotalKb * 1024),
        usedLabel: formatBytes(virtUsedKb * 1024),
        freeLabel: formatBytes(virtFreeKb * 1024),
      },
      lastBoot: os.LastBootUpTime || null,
      topProcesses,
    };
  } catch (err) {
    return { ok: false, error: err.message || "Memory scan failed" };
  }
}

module.exports = { scanMemory };