const { runPowerShell, toArray, formatBytes } = require("./exec-utils");

const DRIVE_LABELS = {
  2: "Removable",
  3: "Local disk",
  4: "Network",
  5: "CD/DVD",
};

async function scanStorage() {
  const scannedAt = new Date().toISOString();

  if (process.platform !== "win32") {
    return {
      ok: true,
      scannedAt,
      summary: { drives: 0, totalBytes: 0, usedBytes: 0, freeBytes: 0 },
      drives: [],
      note: "Storage scan is supported on Windows only.",
    };
  }

  try {
    const raw = await runPowerShell(
      "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,VolumeName,FileSystem,DriveType,Size,FreeSpace,VolumeSerialNumber,Description,ProviderName,Compressed | ConvertTo-Json -Compress"
    );

    const drives = toArray(raw)
      .filter((d) => d?.DeviceID && Number(d.Size) > 0)
      .map((d) => {
        const size = Number(d.Size) || 0;
        const free = Number(d.FreeSpace) || 0;
        const used = Math.max(0, size - free);
        const usagePercent = size ? Math.round((used / size) * 1000) / 10 : 0;
        const driveType = Number(d.DriveType) || 0;
        const serial = d.VolumeSerialNumber
          ? String(d.VolumeSerialNumber).trim()
          : "";
        const provider = d.ProviderName ? String(d.ProviderName).trim() : "";
        const description = d.Description ? String(d.Description).trim() : "";

        return {
          id: d.DeviceID,
          letter: d.DeviceID.replace(":", ""),
          name: d.VolumeName || "Local Disk",
          fileSystem: d.FileSystem || "—",
          driveType,
          driveTypeLabel: DRIVE_LABELS[driveType] || "Other",
          sizeBytes: size,
          usedBytes: used,
          freeBytes: free,
          usagePercent,
          sizeLabel: formatBytes(size),
          usedLabel: formatBytes(used),
          freeLabel: formatBytes(free),
          volumeSerial: serial || null,
          description: description || null,
          providerName: provider || null,
          compressed: Boolean(d.Compressed),
          key: `drive-${d.DeviceID}`,
        };
      })
      .sort((a, b) => a.letter.localeCompare(b.letter));

    const totalBytes = drives.reduce((s, d) => s + d.sizeBytes, 0);
    const freeBytes = drives.reduce((s, d) => s + d.freeBytes, 0);
    const usedBytes = totalBytes - freeBytes;

    return {
      ok: true,
      scannedAt,
      summary: {
        drives: drives.length,
        totalBytes,
        usedBytes,
        freeBytes,
        usagePercent: totalBytes ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0,
        totalLabel: formatBytes(totalBytes),
        usedLabel: formatBytes(usedBytes),
        freeLabel: formatBytes(freeBytes),
      },
      drives,
    };
  } catch (err) {
    return { ok: false, error: err.message || "Storage scan failed" };
  }
}

module.exports = { scanStorage };
