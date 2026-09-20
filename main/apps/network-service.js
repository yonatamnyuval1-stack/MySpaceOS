const dns = require("dns").promises;
const http = require("http");
const https = require("https");
const os = require("os");
const { shell } = require("electron");
const { scanNetwork } = require("./network-scan");
const { scanPorts } = require("./ports-scan");

const CHECK_TARGETS = [
  {
    id: "dns",
    label: "DNS resolve",
    kind: "dns",
    host: "dns.google",
  },
  {
    id: "cloudflare",
    label: "Internet (Cloudflare)",
    kind: "https",
    url: "https://cloudflare.com/cdn-cgi/trace",
  },
  {
    id: "microsoft",
    label: "Microsoft connectivity",
    kind: "http",
    url: "http://www.msftconnecttest.com/connecttest.txt",
  },
  {
    id: "gemini",
    label: "Gemini API host",
    kind: "dns",
    host: "generativelanguage.googleapis.com",
  },
  {
    id: "github",
    label: "GitHub",
    kind: "https",
    url: "https://api.github.com",
  },
];

let lastStatus = null;
let lastChecks = null;
let watchTimer = null;

function scoreInterface(name, address) {
  const n = String(name || "").toLowerCase();
  let score = 10;
  if (/wi-?fi|wlan|wireless|wifi|wl/.test(n)) score += 40;
  if (/ethernet|eth|lan/.test(n)) score += 25;
  if (/virtual|vethernet|vpn|hyper-v|vmware|virtualbox|loopback|docker|wsl|bluetooth|teredo|isatap/.test(n)) {
    score -= 50;
  }
  if (address && address.startsWith("169.254.")) score -= 30;
  if (address && (address.startsWith("10.") || address.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[0-1])\./.test(address))) {
    score += 5;
  }
  return score;
}

function nodeInterfaces() {
  const out = [];
  const ifaces = os.networkInterfaces() || {};
  for (const [name, list] of Object.entries(ifaces)) {
    for (const info of list || []) {
      if (!info || info.internal) continue;
      if (!(info.family === "IPv4" || info.family === 4)) continue;
      out.push({
        name,
        address: info.address,
        netmask: info.netmask,
        mac: info.mac,
        score: scoreInterface(name, info.address),
      });
    }
  }
  out.sort((a, b) => b.score - a.score || a.address.localeCompare(b.address));
  return out;
}

function probeHttp(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const started = Date.now();
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      finish({ ok: false, error: "Invalid URL", ms: 0 });
      return;
    }

    const lib = parsed.protocol === "http:" ? http : https;
    const req = lib.get(
      url,
      {
        timeout: timeoutMs,
        headers: { "User-Agent": "MySpace-Network/1.0", Accept: "*/*" },
      },
      (res) => {
        res.resume();
        finish({
          ok: res.statusCode >= 200 && res.statusCode < 500,
          statusCode: res.statusCode,
          ms: Date.now() - started,
        });
      }
    );
    req.on("timeout", () => {
      req.destroy();
      finish({ ok: false, error: "Timeout", ms: Date.now() - started });
    });
    req.on("error", (err) => {
      finish({ ok: false, error: err.message || String(err), ms: Date.now() - started });
    });
  });
}

async function probeDns(host, timeoutMs = 4000) {
  const started = Date.now();
  try {
    const result = await Promise.race([
      dns.lookup(host, { all: false }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs)),
    ]);
    return {
      ok: true,
      address: result?.address || null,
      ms: Date.now() - started,
    };
  } catch (err) {
    return { ok: false, error: err.message || String(err), ms: Date.now() - started };
  }
}

async function runReachabilityChecks(targets = CHECK_TARGETS) {
  const checkedAt = new Date().toISOString();
  const results = [];

  for (const t of targets) {
    let probe;
    if (t.kind === "dns") {
      probe = await probeDns(t.host);
    } else {
      probe = await probeHttp(t.url);
    }
    results.push({
      id: t.id,
      label: t.label,
      kind: t.kind,
      target: t.host || t.url,
      ok: !!probe.ok,
      ms: probe.ms ?? null,
      detail: probe.address || (probe.statusCode != null ? `HTTP ${probe.statusCode}` : null),
      error: probe.error || null,
    });
  }

  const passed = results.filter((r) => r.ok).length;
  const online = results.some((r) => r.id === "dns" || r.id === "cloudflare" || r.id === "microsoft")
    ? results.some((r) => (r.id === "dns" || r.id === "cloudflare" || r.id === "microsoft") && r.ok)
    : passed > 0;

  lastChecks = {
    ok: true,
    checkedAt,
    online,
    passed,
    total: results.length,
    results,
  };
  return lastChecks;
}

async function buildStatus() {
  const scannedAt = new Date().toISOString();
  const nodeIfaces = nodeInterfaces();
  let scan = null;
  try {
    scan = await scanNetwork();
  } catch (err) {
    scan = { ok: false, error: err?.message || String(err), adapters: [], summary: {} };
  }

  const adapters = scan?.adapters || [];
  const connected = adapters.filter((a) => a.connected);
  const ranked = [...(connected.length ? connected : adapters)].sort(
    (a, b) => scoreInterface(b.name, b.ipv4Primary) - scoreInterface(a.name, a.ipv4Primary)
  );
  const primaryFromScan = ranked.find((a) => a.ipv4Primary && a.ipv4Primary !== ":") || ranked[0] || null;
  const primaryNode = nodeIfaces[0] || null;

  const scanIp =
    primaryFromScan?.ipv4Primary &&
    primaryFromScan.ipv4Primary !== ":" &&
    /^\d{1,3}(\.\d{1,3}){3}$/.test(primaryFromScan.ipv4Primary)
      ? primaryFromScan.ipv4Primary
      : null;

  const primaryIp = scanIp || primaryNode?.address || null;
  const primaryName =
    (scanIp ? primaryFromScan?.name : null) || primaryNode?.name || primaryFromScan?.name || null;
  const gateway =
    primaryFromScan?.gateway4 && primaryFromScan.gateway4 !== ":"
      ? primaryFromScan.gateway4
      : null;
  const dnsPrimary =
    primaryFromScan?.dnsPrimary && primaryFromScan.dnsPrimary !== ":"
      ? primaryFromScan.dnsPrimary
      : null;

  const checks = lastChecks;
  const online =
    checks?.online != null
      ? checks.online
      : connected.length > 0 || nodeIfaces.length > 0;

  lastStatus = {
    ok: true,
    scannedAt,
    online,
    hostname: os.hostname(),
    platform: process.platform,
    primaryIp,
    primaryName,
    gateway,
    dns: dnsPrimary,
    linkSpeed: primaryFromScan?.linkSpeed || null,
    mediaHint: /wi-?fi|wlan|wireless/i.test(String(primaryName || ""))
      ? "Wi‑Fi"
      : /eth|lan/i.test(String(primaryName || ""))
        ? "Ethernet"
        : null,
    summary: {
      adapters: adapters.length || nodeIfaces.length,
      connected: connected.length || nodeIfaces.length,
      primaryIp: primaryIp || "—",
    },
    adaptersPreview: (adapters.length ? adapters : nodeIfaces.map((n, i) => ({
      key: `node-${i}`,
      name: n.name,
      ipv4Primary: n.address,
      connected: true,
      statusLabel: "Up",
      macAddress: n.mac || ":",
      gateway4: ":",
      dnsPrimary: ":",
      linkSpeed: ":",
    }))).slice(0, 4),
    lastChecks: checks
      ? {
          checkedAt: checks.checkedAt,
          online: checks.online,
          passed: checks.passed,
          total: checks.total,
        }
      : null,
    scanOk: scan?.ok !== false,
    scanError: scan?.error || null,
    scanNote: scan?.note || null,
  };
  return lastStatus;
}

async function listAdapters() {
  const scan = await scanNetwork();
  const node = nodeInterfaces();

  function enrich(adapters) {
    return adapters.map((a) => {
      if (a.ipv4Primary && a.ipv4Primary !== "—") {
        return { ...a, score: scoreInterface(a.name, a.ipv4Primary) };
      }
      const match = node.find((n) => {
        const an = String(a.name || "")
          .replace(/[^\w.-]+/g, "")
          .toLowerCase();
        const nn = String(n.name || "")
          .replace(/[^\w.-]+/g, "")
          .toLowerCase();
        return an && nn && (an.includes(nn) || nn.includes(an) || an === nn);
      });
      if (!match) return { ...a, score: scoreInterface(a.name, a.ipv4Primary) };
      return {
        ...a,
        ipv4: [match.address],
        ipv4Primary: match.address,
        macAddress: a.macAddress && a.macAddress !== ":" ? a.macAddress : match.mac || ":",
        score: scoreInterface(a.name, match.address),
      };
    });
  }

  if (!scan?.ok && !(scan?.adapters || []).length) {
    return {
      ok: true,
      scannedAt: new Date().toISOString(),
      adapters: node.map((n, i) => ({
        key: `node-${i}`,
        name: n.name,
        description: "",
        status: "Up",
        statusLabel: "Connected",
        linkSpeed: ":",
        macAddress: n.mac || ":",
        ipv4: [n.address],
        ipv6: [],
        ipv4Primary: n.address,
        ipv6Primary: ":",
        gateway4: ":",
        gateway6: ":",
        dns: [":"],
        dnsPrimary: ":",
        connected: true,
        score: n.score,
      })),
      summary: {
        adapters: node.length,
        connected: node.length,
        primaryIp: node[0]?.address || ":",
      },
      source: "node",
      note: scan?.note || scan?.error || null,
    };
  }

  const adapters = enrich(scan.adapters || []).sort(
    (a, b) => Number(b.connected) - Number(a.connected) || b.score - a.score
  );

  const primary =
    adapters.find((a) => a.connected && a.ipv4Primary && a.ipv4Primary !== ":") ||
    node[0];

  return {
    ok: true,
    scannedAt: scan.scannedAt || new Date().toISOString(),
    adapters,
    summary: {
      adapters: adapters.length,
      connected: adapters.filter((a) => a.connected).length,
      primaryIp: primary?.ipv4Primary || primary?.address || scan.summary?.primaryIp || ":",
    },
    source: "windows",
    note: scan.note || null,
  };
}

async function listPorts(args = {}) {
  const scan = await scanPorts();
  if (!scan?.ok) return scan;

  let ports = scan.ports || [];
  const q = String(args.q || args.query || "")
    .trim()
    .toLowerCase();
  const state = String(args.state || "").trim().toUpperCase();
  const protocol = String(args.protocol || "").trim().toUpperCase();
  const listeningOnly = args.listening === true || String(args.filter || "").toLowerCase() === "listening";

  if (listeningOnly) ports = ports.filter((p) => p.state === "LISTENING");
  if (state) ports = ports.filter((p) => String(p.state).toUpperCase() === state);
  if (protocol === "TCP" || protocol === "UDP") {
    ports = ports.filter((p) => p.protocol === protocol);
  }
  if (q) {
    ports = ports.filter((p) =>
      `${p.localPort} ${p.protocol} ${p.state} ${p.processName} ${p.localAddress} ${p.remoteAddress} ${p.pid}`
        .toLowerCase()
        .includes(q)
    );
  }

  const limit = Math.min(Number(args.limit) || 200, 500);
  return {
    ok: true,
    scannedAt: scan.scannedAt,
    summary: scan.summary,
    ports: ports.slice(0, limit),
    truncated: ports.length > limit,
    totalMatched: ports.length,
  };
}

async function openWindowsNetworkSettings() {
  if (process.platform !== "win32") {
    return { ok: false, error: "Windows Settings link is only available on Windows" };
  }
  try {
    await shell.openExternal("ms-settings:network");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

async function handleNetworkInvoke(channel, args = {}) {
  switch (String(channel || "").trim()) {
    case "status":
      return buildStatus();
    case "adapters":
    case "interfaces":
      return listAdapters();
    case "ports":
      return listPorts(args || {});
    case "check":
      await runReachabilityChecks();
      return {
        ...(await buildStatus()),
        checks: lastChecks,
      };
    case "checks":
      return lastChecks || (await runReachabilityChecks());
    case "open-settings":
    case "settings":
      return openWindowsNetworkSettings();
    default:
      return { ok: false, error: `Unknown network channel: ${channel}` };
  }
}

function startNetworkService() {
  if (watchTimer) return;
  watchTimer = setInterval(() => {
    void buildStatus().catch(() => {});
  }, 60 * 1000);
  void buildStatus().catch(() => {});
}

module.exports = {
  startNetworkService,
  handleNetworkInvoke,
  buildStatus,
  listAdapters,
  listPorts,
  runReachabilityChecks,
};