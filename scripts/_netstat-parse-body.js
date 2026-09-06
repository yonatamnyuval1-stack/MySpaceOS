function splitHostPort(addr) {
  const s = String(addr || "");
  const bracket = s.match(/^\[([^\]]+)\]:(\d+)$/);
  if (bracket) {
    return { host: bracket[1], port: parseInt(bracket[2], 10) || 0 };
  }
  const lastColon = s.lastIndexOf(":");
  if (lastColon > 0 && /^\d+$/.test(s.slice(lastColon + 1))) {
    return { host: s.slice(0, lastColon), port: parseInt(s.slice(lastColon + 1), 10) || 0 };
  }
  return { host: s, port: 0 };
}

function parseNetstatLine(line) {
  const parts = String(line || "")
    .trim()
    .split(/\s+/);
  if (parts.length < 4) return null;

  const protocol = parts[0].toUpperCase();
  if (protocol !== "TCP" && protocol !== "UDP") return null;

  const local = parts[1];
  const remote = parts[2];
  const stateOrPid = parts[3];
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

  const localParts = splitHostPort(local);
  const remoteParts = splitHostPort(remote);

  return {
    protocol,
    localAddress: localParts.host,
    localPort: localParts.port,
    remoteAddress: remoteParts.host,
    remotePort: remoteParts.port,
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

function parseNetstatOutput(stdout) {
  const ports = [];
  for (const line of String(stdout || "").split(/\r?\n/)) {
    if (!/^\s*(TCP|UDP)\s/i.test(line)) continue;
    const row = parseNetstatLine(line);
    if (!row || !row.localPort) continue;
    ports.push({
      ...row,
      localHostLabel: parseAddressHost(row.localAddress),
      remoteHostLabel: parseAddressHost(row.remoteAddress),
      key: `${row.protocol}:${row.localPort}:${row.pid}:${row.state}`,
    });
  }
  ports.sort((a, b) => a.localPort - b.localPort || a.protocol.localeCompare(b.protocol));
  return ports;
}

function summarizePorts(ports) {
  const list = Array.isArray(ports) ? ports : [];
  return {
    total: list.length,
    listening: list.filter((p) => p.state === "LISTENING").length,
    established: list.filter((p) => p.state === "ESTABLISHED").length,
    timeWait: list.filter((p) => p.state === "TIME_WAIT").length,
    uniqueProcesses: new Set(list.map((p) => p.pid).filter(Boolean)).size,
  };
}

const api = {
  parseNetstatLine,
  parseAddressHost,
  parseNetstatOutput,
  summarizePorts,
};

if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.PartsNetstatParse = api;
