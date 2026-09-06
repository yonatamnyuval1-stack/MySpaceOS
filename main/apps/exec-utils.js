const { exec } = require("child_process");
const { promisify } = require("util");

const execAsync = promisify(exec);

async function runPowerShell(script, maxBuffer = 16 * 1024 * 1024) {
  if (process.platform !== "win32") {
    return null;
  }
  const { stdout } = await execAsync(
    `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${script.replace(/"/g, '\\"')}"`,
    { windowsHide: true, maxBuffer }
  );
  const trimmed = (stdout || "").trim();
  if (!trimmed) return null;
  return JSON.parse(trimmed);
}

function toArray(data) {
  if (data == null) return [];
  return Array.isArray(data) ? data : [data];
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function parsePsDate(value) {
  if (!value) return null;
  if (typeof value === "string" && value.startsWith("/Date(")) {
    const ms = parseInt(value.replace(/\D/g, ""), 10);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

module.exports = { runPowerShell, toArray, formatBytes, parsePsDate };