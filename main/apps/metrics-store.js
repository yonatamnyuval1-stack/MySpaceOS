const path = require("path");
const fs = require("fs");
const { app } = require("electron");
const { runPowerShell, toArray } = require("./exec-utils");
const { scanStorage } = require("./storage-scan");

const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_POINTS = 3000;

function metricsPath() {
  const profile = require("../myspace-profile");
  return profile.profileScopedPath("system-info-metrics.json");
}

async function loadSamples() {
  try {
    const raw = await fs.promises.readFile(metricsPath(), "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data.samples) ? data.samples : [];
  } catch (err) {
    if (err?.code === "ENOENT") return [];
    return [];
  }
}

async function saveSamples(samples) {
  await fs.promises.mkdir(path.dirname(metricsPath()), { recursive: true });
  await fs.promises.writeFile(metricsPath(), JSON.stringify({ samples }, null, 0), "utf8");
}

function prune(samples) {
  const cut = Date.now() - MAX_AGE_MS;
  let out = samples.filter((s) => s.t >= cut);
  if (out.length > MAX_POINTS) out = out.slice(out.length - MAX_POINTS);
  return out;
}

async function quickCpuPercent() {
  if (process.platform !== "win32") return null;
  try {
    const raw = await runPowerShell(
      "$v=(Get-Counter '\\Processor(_Total)\\% Processor Time' -ErrorAction SilentlyContinue).CounterSamples.CookedValue; @{v=[math]::Round($v,1)} | ConvertTo-Json -Compress"
    );
    const v = parseFloat(raw?.v);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

async function quickMemoryPercent() {
  if (process.platform !== "win32") return null;
  try {
    const raw = await runPowerShell(
      "$o=Get-CimInstance Win32_OperatingSystem; $p=[math]::Round((1-$o.FreePhysicalMemory/$o.TotalVisibleMemorySize)*100,1); @{v=$p} | ConvertTo-Json -Compress"
    );
    const v = parseFloat(raw?.v);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

async function quickDiskPercent() {
  try {
    const storage = await scanStorage();
    const drives = storage.drives || [];
    if (!drives.length) return null;
    const total = drives.reduce((s, d) => s + d.sizeBytes, 0);
    const used = drives.reduce((s, d) => s + d.usedBytes, 0);
    return total ? Math.round((used / total) * 1000) / 10 : null;
  } catch {
    return null;
  }
}

async function sampleMetrics() {
  const [cpu, memory, disk] = await Promise.all([
    quickCpuPercent(),
    quickMemoryPercent(),
    quickDiskPercent(),
  ]);

  const point = {
    t: Date.now(),
    cpu: cpu ?? 0,
    memory: memory ?? 0,
    disk: disk ?? 0,
  };

  let samples = prune(await loadSamples());
  const last = samples[samples.length - 1];
  if (!last || last.t < point.t - 1500) {
    samples.push(point);
    samples = prune(samples);
    await saveSamples(samples);
  }

  return {
    ok: true,
    point,
    count: samples.length,
    current: { cpu, memory, disk },
  };
}

async function getMetricsHistory(args) {
  const range = args?.range || "1h";
  const ranges = { "15m": 15 * 60 * 1000, "1h": 60 * 60 * 1000, "6h": 6 * 60 * 60 * 1000, "24h": MAX_AGE_MS };
  const ms = ranges[range] || ranges["1h"];
  const cut = Date.now() - ms;
  const samples = (await loadSamples()).filter((s) => s.t >= cut);

  return {
    ok: true,
    range,
    samples,
    count: samples.length,
  };
}

async function clearMetrics() {
  await saveSamples([]);
  return { ok: true };
}

module.exports = { sampleMetrics, getMetricsHistory, clearMetrics };