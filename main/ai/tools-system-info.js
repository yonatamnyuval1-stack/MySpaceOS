const { scanSystem } = require("../apps/system-scan");
const { scanCpu } = require("../apps/cpu-scan");
const { scanMemory } = require("../apps/memory-scan");
const { scanProcesses } = require("../apps/processes-scan");
const { scanStorage } = require("../apps/storage-scan");
const { scanNetwork } = require("../apps/network-scan");
const { scanPorts } = require("../apps/ports-scan");
const { scanEnvironment } = require("../apps/environment-scan");
const { sampleMetrics, getMetricsHistory } = require("../apps/metrics-store");
const { shellOpenPage } = require("./tools-shell");

function clampInt(value, fallback, min, max) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function slimProcess(p) {
  if (!p || typeof p !== "object") return p;
  return {
    pid: p.pid,
    name: p.name,
    memoryLabel: p.memoryLabel,
    memoryBytes: p.memoryBytes,
    cpuSeconds: p.cpuSeconds,
    threads: p.threads,
    responding: p.responding,
    path: p.path || undefined,
  };
}

function slimPort(p) {
  if (!p || typeof p !== "object") return p;
  return {
    protocol: p.protocol,
    localAddress: p.localAddress,
    localPort: p.localPort,
    remoteAddress: p.remoteAddress,
    remotePort: p.remotePort,
    state: p.state,
    pid: p.pid,
    processName: p.processName || p.name,
  };
}

async function sysinfoGetOverview() {
  const res = await scanSystem();
  if (!res?.ok) return res || { ok: false, error: "System scan failed" };
  return {
    ok: true,
    scannedAt: res.scannedAt,
    info: res.info
      ? {
          hostname: res.info.hostname,
          user: res.info.user,
          manufacturer: res.info.manufacturer,
          model: res.info.model,
          osName: res.info.osName,
          osVersion: res.info.osVersion,
          osBuild: res.info.osBuild,
          osArch: res.info.osArch,
          processors: res.info.processors,
          logicalProcessors: res.info.logicalProcessors,
          totalRamLabel: res.info.totalRamLabel,
          uptimeLabel: res.info.uptimeLabel,
          timezone: res.info.timezone,
          lastBootLabel: res.info.lastBootLabel,
        }
      : null,
    note: res.note,
  };
}

async function sysinfoGetCpu() {
  const res = await scanCpu();
  if (!res?.ok) return res || { ok: false, error: "CPU scan failed" };
  return {
    ok: true,
    scannedAt: res.scannedAt,
    summary: res.summary,
    processor: res.processor,
    cores: Array.isArray(res.cores) ? res.cores.slice(0, 64) : [],
    topProcesses: (res.topProcesses || []).slice(0, 10).map(slimProcess),
    note: res.note,
  };
}

async function sysinfoGetMemory() {
  const res = await scanMemory();
  if (!res?.ok) return res || { ok: false, error: "Memory scan failed" };
  return {
    ok: true,
    scannedAt: res.scannedAt,
    physical: res.physical,
    virtual: res.virtual,
    topProcesses: (res.topProcesses || []).slice(0, 12).map(slimProcess),
    note: res.note,
  };
}

async function sysinfoGetProcesses(args = {}) {
  const res = await scanProcesses();
  if (!res?.ok) return res || { ok: false, error: "Process scan failed" };

  const limit = clampInt(args.limit, 25, 1, 100);
  const query = String(args.query || args.name || args.filter || "")
    .trim()
    .toLowerCase();
  const sortBy = String(args.sortBy || "memory").toLowerCase();

  let list = Array.isArray(res.processes) ? [...res.processes] : [];
  if (query) {
    list = list.filter(
      (p) =>
        String(p.name || "").toLowerCase().includes(query) ||
        String(p.path || "").toLowerCase().includes(query) ||
        String(p.pid || "") === query
    );
  }

  if (sortBy === "cpu") {
    list.sort((a, b) => (b.cpuSeconds || 0) - (a.cpuSeconds || 0));
  } else if (sortBy === "name") {
    list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  } else {
    list.sort((a, b) => (b.memoryBytes || 0) - (a.memoryBytes || 0));
  }

  return {
    ok: true,
    scannedAt: res.scannedAt,
    summary: res.summary,
    query: query || undefined,
    sortBy,
    count: list.length,
    processes: list.slice(0, limit).map(slimProcess),
    note: res.note,
  };
}

async function sysinfoGetStorage() {
  const res = await scanStorage();
  if (!res?.ok) return res || { ok: false, error: "Storage scan failed" };
  return {
    ok: true,
    scannedAt: res.scannedAt,
    summary: res.summary,
    drives: (res.drives || []).map((d) => ({
      id: d.id,
      letter: d.letter,
      name: d.name,
      fileSystem: d.fileSystem,
      driveType: d.driveTypeLabel || d.driveType,
      sizeLabel: d.sizeLabel,
      usedLabel: d.usedLabel,
      freeLabel: d.freeLabel,
      usagePercent: d.usagePercent,
    })),
    note: res.note,
  };
}

async function sysinfoGetNetwork() {
  const res = await scanNetwork();
  if (!res?.ok) return res || { ok: false, error: "Network scan failed" };
  return {
    ok: true,
    scannedAt: res.scannedAt,
    summary: res.summary,
    adapters: (res.adapters || []).map((a) => ({
      name: a.name,
      status: a.statusLabel || a.status,
      linkSpeed: a.linkSpeed,
      macAddress: a.macAddress,
      ipv4: a.ipv4 || [],
      ipv6: a.ipv6 || [],
      gateway: a.gateway4 || a.gateway,
      dns: a.dns,
      connected: !!a.connected,
    })),
    note: res.note,
  };
}

async function sysinfoGetPorts(args = {}) {
  const res = await scanPorts();
  if (!res?.ok) return res || { ok: false, error: "Ports scan failed" };

  const limit = clampInt(args.limit, 40, 1, 150);
  const state = String(args.state || "").trim().toLowerCase();
  const query = String(args.query || args.process || args.filter || "")
    .trim()
    .toLowerCase();
  const port = args.port != null ? Number(args.port) : null;

  let list = Array.isArray(res.ports) ? [...res.ports] : Array.isArray(res.listeners) ? [...res.listeners] : [];
  if (Number.isFinite(port)) {
    list = list.filter((p) => Number(p.localPort) === port || Number(p.port) === port);
  }
  if (state) {
    list = list.filter((p) => String(p.state || "").toLowerCase().includes(state));
  }
  if (query) {
    list = list.filter(
      (p) =>
        String(p.processName || p.name || "").toLowerCase().includes(query) ||
        String(p.localAddress || "").toLowerCase().includes(query) ||
        String(p.pid || "") === query
    );
  }

  return {
    ok: true,
    scannedAt: res.scannedAt,
    summary: res.summary,
    count: list.length,
    ports: list.slice(0, limit).map(slimPort),
    note: res.note,
  };
}

async function sysinfoGetEnvironment(args = {}) {
  const res = await scanEnvironment();
  if (!res?.ok) return res || { ok: false, error: "Environment scan failed" };

  const limit = clampInt(args.limit, 40, 1, 120);
  const query = String(args.query || args.name || args.filter || "")
    .trim()
    .toLowerCase();
  let vars = Array.isArray(res.variables) ? [...res.variables] : [];
  if (query) {
    vars = vars.filter((v) => String(v.name || "").toLowerCase().includes(query));
  }

  return {
    ok: true,
    scannedAt: res.scannedAt,
    summary: res.summary,
    query: query || undefined,
    count: vars.length,
    variables: vars.slice(0, limit).map((v) => ({
      name: v.name,
      value: String(v.value || "").slice(0, 400),
      length: v.length,
      truncated: String(v.value || "").length > 400,
    })),
    pathEntries: query ? undefined : (res.pathEntries || []).slice(0, 40),
    note: res.note,
  };
}

async function sysinfoGetMetrics(args = {}) {
  const sample = await sampleMetrics();
  const rawRange = String(args.range || args.hours || "1h").trim().toLowerCase();
  const rangeMap = { "15": "15m", "15m": "15m", "1": "1h", "1h": "1h", "6": "6h", "6h": "6h", "24": "24h", "24h": "24h" };
  const range = rangeMap[rawRange] || "1h";
  const history = await getMetricsHistory({ range });
  const samples = Array.isArray(history?.samples) ? history.samples : [];
  return {
    ok: true,
    latest: sample?.current || sample?.point || null,
    historySummary: {
      range: history?.range || range,
      points: samples.length,
      latest: samples.slice(-5),
    },
  };
}

const SYSINFO_TOOL_DEFS = [
  {
    name: "sysinfo_get_overview",
    description:
      "Get host overview from System Info: hostname, OS, user, CPU count, RAM, uptime, timezone.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "sysinfo_get_cpu",
    description:
      "Scan live CPU usage, processor details, per-core load, and top CPU processes.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "sysinfo_get_memory",
    description:
      "Scan live RAM / virtual memory usage and top memory-consuming processes.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "sysinfo_get_processes",
    description:
      "List running processes (from System Info). Filter by name/path/pid and sort by memory, cpu, or name.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Filter by process name, path, or pid" },
        sortBy: { type: "string", description: "memory | cpu | name (default memory)" },
        limit: { type: "number", description: "Max processes to return (1–100, default 25)" },
      },
    },
  },
  {
    name: "sysinfo_get_storage",
    description: "List disk drives with size, free space, and usage percent.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "sysinfo_get_network",
    description: "List network adapters with status, speed, MAC, IPv4/IPv6, gateway, and DNS.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "sysinfo_get_ports",
    description:
      "List open/listening network ports and owning processes. Filter by port, state, or process.",
    parameters: {
      type: "object",
      properties: {
        port: { type: "number", description: "Filter by local port number" },
        state: { type: "string", description: "Filter by state (e.g. Listen, Established)" },
        query: { type: "string", description: "Filter by process name, address, or pid" },
        limit: { type: "number", description: "Max rows (1–150, default 40)" },
      },
    },
  },
  {
    name: "sysinfo_get_environment",
    description: "Read environment variables (and PATH entries). Filter by variable name.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Filter by variable name substring" },
        limit: { type: "number", description: "Max variables (1–120, default 40)" },
      },
    },
  },
  {
    name: "sysinfo_get_metrics",
    description:
      "Get latest CPU/memory/disk performance sample and a short recent history from System Info metrics.",
    parameters: {
      type: "object",
      properties: {
        range: {
          type: "string",
          description: "History window: 15m | 1h | 6h | 24h (default 1h)",
        },
      },
    },
  },
];

async function maybeOpenSysInfo(page, ctx, result) {
  if (!result?.ok || !ctx?.getMainWindow) return result;
  try {
    const opened = await shellOpenPage({ app: "system-info", page }, ctx);
    if (opened?.ok) result.openedPage = page || "overview";
    else if (opened?.error) result.openWarning = opened.error;
  } catch (err) {
    result.openWarning = err.message || String(err);
  }
  return result;
}

async function executeSysInfoTool(name, args, ctx) {
  let result;
  let page = null;
  switch (name) {
    case "sysinfo_get_overview":
      result = await sysinfoGetOverview();
      page = "system";
      break;
    case "sysinfo_get_cpu":
      result = await sysinfoGetCpu();
      page = "cpu";
      break;
    case "sysinfo_get_memory":
      result = await sysinfoGetMemory();
      page = "memory";
      break;
    case "sysinfo_get_processes":
      result = await sysinfoGetProcesses(args || {});
      page = "processes";
      break;
    case "sysinfo_get_storage":
      result = await sysinfoGetStorage();
      page = "storage";
      break;
    case "sysinfo_get_network":
      result = await sysinfoGetNetwork();
      page = "network";
      break;
    case "sysinfo_get_ports":
      result = await sysinfoGetPorts(args || {});
      page = "ports";
      break;
    case "sysinfo_get_environment":
      result = await sysinfoGetEnvironment(args || {});
      page = "environment";
      break;
    case "sysinfo_get_metrics":
      result = await sysinfoGetMetrics(args || {});
      page = "performance";
      break;
    default:
      result = { ok: false, error: `Unknown system-info tool: ${name}` };
  }

  if (result?.ok && page && args?.open === true) {
    result = await maybeOpenSysInfo(page, ctx, result);
  }

  return result;
}

module.exports = {
  SYSINFO_TOOL_DEFS,
  executeSysInfoTool,
};
