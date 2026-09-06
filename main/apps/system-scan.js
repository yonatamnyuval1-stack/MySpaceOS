const { runPowerShell, toArray, formatBytes, parsePsDate } = require("./exec-utils");

function formatUptime(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

async function scanSystem() {
  const scannedAt = new Date().toISOString();

  if (process.platform !== "win32") {
    return {
      ok: true,
      scannedAt,
      info: null,
      note: "System scan is supported on Windows only.",
    };
  }

  try {
    const osRaw = await runPowerShell(
      "Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,BuildNumber,OSArchitecture,LastBootUpTime,LocalDateTime,RegisteredUser,SerialNumber,InstallDate | ConvertTo-Json -Compress"
    );
    const csRaw = await runPowerShell(
      "Get-CimInstance Win32_ComputerSystem | Select-Object Name,Domain,Manufacturer,Model,TotalPhysicalMemory,SystemType,UserName,NumberOfProcessors,NumberOfLogicalProcessors | ConvertTo-Json -Compress"
    );
    const biosRaw = await runPowerShell(
      "Get-CimInstance Win32_BIOS | Select-Object Manufacturer,SMBIOSBIOSVersion,ReleaseDate,SerialNumber | ConvertTo-Json -Compress"
    );
    const tzRaw = await runPowerShell(
      "Get-TimeZone | Select-Object Id,DisplayName,BaseUtcOffset | ConvertTo-Json -Compress"
    );

    const os = toArray(osRaw)[0] || {};
    const cs = toArray(csRaw)[0] || {};
    const bios = toArray(biosRaw)[0] || {};
    const tz = toArray(tzRaw)[0] || {};

    const lastBoot = parsePsDate(os.LastBootUpTime);
    const uptimeSeconds = lastBoot
      ? Math.floor((Date.now() - new Date(lastBoot).getTime()) / 1000)
      : 0;
    const installDate = parsePsDate(os.InstallDate);

    const totalRam = Number(cs.TotalPhysicalMemory) || 0;

    const info = {
      hostname: cs.Name || "—",
      domain: cs.Domain || "WORKGROUP",
      user: cs.UserName || os.RegisteredUser || "—",
      manufacturer: cs.Manufacturer || "—",
      model: cs.Model || "—",
      systemType: cs.SystemType || os.OSArchitecture || "—",
      osName: os.Caption || "Windows",
      osVersion: os.Version || "—",
      osBuild: os.BuildNumber || "—",
      osArch: os.OSArchitecture || "—",
      osSerial: os.SerialNumber || "—",
      processors: Number(cs.NumberOfProcessors) || 0,
      logicalProcessors: Number(cs.NumberOfLogicalProcessors) || 0,
      totalRamLabel: formatBytes(totalRam),
      totalRamBytes: totalRam,
      lastBoot,
      lastBootLabel: lastBoot ? new Date(lastBoot).toLocaleString() : "—",
      uptimeSeconds,
      uptimeLabel: formatUptime(uptimeSeconds),
      localTime: os.LocalDateTime ? new Date(os.LocalDateTime).toLocaleString() : "—",
      timezone: tz.DisplayName || tz.Id || "—",
      timezoneId: tz.Id || "—",
      biosVendor: bios.Manufacturer || "—",
      biosVersion: bios.SMBIOSBIOSVersion || "—",
      biosDate: parsePsDate(bios.ReleaseDate),
      biosSerial: bios.SerialNumber || "—",
      installDate,
      installDateLabel: installDate ? new Date(installDate).toLocaleDateString() : "—",
    };

    return {
      ok: true,
      scannedAt,
      info,
      summary: {
        hostname: info.hostname,
        os: info.osName,
        uptime: info.uptimeLabel,
        ram: info.totalRamLabel,
      },
    };
  } catch (err) {
    return { ok: false, error: err.message || "System scan failed" };
  }
}

module.exports = { scanSystem };
