const path = require("path");
const fs = require("fs");
const net = require("net");
const os = require("os");
const crypto = require("crypto");
const { exec, spawn } = require("child_process");
const { promisify } = require("util");
const { app, clipboard } = require("electron");
const {
  setupLocalAuthApp,
  requireSignedIn,
  userStorageRoot,
  registerLegacyMigrator,
  registerSingleFileMigrator,
} = require("./local-auth-app-helper");

const APP_ID = "remote-hub";
const auth = setupLocalAuthApp(APP_ID);
registerSingleFileMigrator(APP_ID, "remote-hub.json");

const DATA_FILE = () => auth.userDataPath("data.json");

function signedInGuard() {
  return requireSignedIn(auth);
}


const execAsync = promisify(exec);


const DEFAULT_DATA = {
  machines: [],
  settings: {
    pingTimeoutMs: 2000,
    checkPort: true,
    wolPort: 9,
    recentHosts: [],
  },
};

const RUSTDESK_PATHS = [
  path.join(process.env.ProgramFiles || "C:\\Program Files", "RustDesk", "rustdesk.exe"),
  path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "RustDesk", "rustdesk.exe"),
  path.join(process.env.LOCALAPPDATA || "", "RustDesk", "rustdesk.exe"),
];

const SSH_PATHS = [
  path.join(process.env.WINDIR || "C:\\Windows", "System32", "OpenSSH", "ssh.exe"),
  "ssh.exe",
];

const WT_PATHS = [
  path.join(process.env.LOCALAPPDATA || "", "Microsoft", "WindowsApps", "wt.exe"),
  "wt.exe",
];

const TAILSCALE_PATHS = [
  path.join(process.env.ProgramFiles || "C:\\Program Files", "Tailscale", "tailscale.exe"),
  path.join(process.env.LOCALAPPDATA || "", "Tailscale", "tailscale.exe"),
  "tailscale.exe",
];

const WINRS_PATH = path.join(process.env.WINDIR || "C:\\Windows", "System32", "winrs.exe");

const ENABLE_SCRIPTS = {
  rdp: `# SECURITY: opens Remote Desktop (firewall) on this PC.
# Run once on TARGET PC as Administrator only if you trust your network.
Set-ItemProperty -Path 'HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server' -Name fDenyTSConnections -Value 0
Enable-NetFirewallRule -DisplayGroup 'Remote Desktop'
Write-Host 'RDP enabled. Note: Windows Home cannot accept incoming RDP.'`,

  winrm: `# SECURITY: enables WinRM + firewall on this PC (Live View).
# Run on TARGET PC as Administrator only if you trust your network.
Enable-PSRemoting -Force -SkipNetworkProfileCheck
Set-Item WSMan:\\localhost\\Service\\Auth\\Basic -Value $true -Force
Set-Item WSMan:\\localhost\\Service\\AllowUnencrypted -Value $true -Force
Enable-NetFirewallRule -DisplayGroup 'Windows Remote Management' -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName 'WinRM-HTTP-In' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5985 -ErrorAction SilentlyContinue
Start-Service WinRM
Set-Service WinRM -StartupType Automatic
Write-Host 'WinRM ready on port 5985'`,

  ssh: `# SECURITY: installs OpenSSH Server and opens port 22.
# Run once on TARGET PC as Administrator only if you trust your network.
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Start-Service sshd
Set-Service -Name sshd -StartupType Automatic
New-NetFirewallRule -Name sshd -DisplayName 'OpenSSH Server (sshd)' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22
Write-Host 'SSH server running on port 22'`,

  client: `# SECURITY: sets TrustedHosts=* on THIS PC (WinRM client trusts any host).
# Prefer listing specific IPs instead of * when you can.
# Run on YOUR My Space computer as Administrator only after opt-in in Remote Hub.
Set-Item WSMan:\\localhost\\Client\\TrustedHosts -Value '*' -Force
Write-Host 'TrustedHosts=* set. This PC can connect via WinRM to other machines on your network.'`,

  all: `# SECURITY: enables RDP + WinRM + OpenSSH (firewall) on TARGET PC.
# Run as Administrator only if you trust your network.
Set-ItemProperty -Path 'HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server' -Name fDenyTSConnections -Value 0
Enable-NetFirewallRule -DisplayGroup 'Remote Desktop'
Enable-PSRemoting -Force -SkipNetworkProfileCheck
Set-Item WSMan:\\localhost\\Service\\Auth\\Basic -Value $true -Force
Enable-NetFirewallRule -DisplayGroup 'Windows Remote Management' -ErrorAction SilentlyContinue
Start-Service WinRM -ErrorAction SilentlyContinue
Set-Service WinRM -StartupType Automatic -ErrorAction SilentlyContinue
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0 -ErrorAction SilentlyContinue
Start-Service sshd -ErrorAction SilentlyContinue
Set-Service -Name sshd -StartupType Automatic -ErrorAction SilentlyContinue
Write-Host 'Done. Live View needs WinRM (5985). RDP uses 3389. Full control uses Agent (8765).'`,

  agent: `# My Space Remote Agent: FULL control (mouse + keyboard + screen) on port 8765
# STEP 1: On THIS PC open Remote Hub -> Enable access -> "Open agent folder"
# STEP 2: Copy the whole "agent" folder to the TARGET PC (USB, network share, etc.)
# STEP 3: On TARGET PC install Node.js if needed:
#   winget install OpenJS.NodeJS.LTS
# STEP 4: On TARGET PC: PowerShell as Administrator:
#   cd C:\\path\\to\\agent
#   .\\install.ps1
# STEP 5: When prompted, answer Y only if you want LAN + firewall (required for Control from another PC).
#         Answer N to keep the agent on localhost only.
# STEP 6: Copy the Agent token printed by install.ps1 into Remote Hub → machine → Agent token
# STEP 7: In Remote Hub click Control on that machine
Write-Host 'Agent install asks before opening firewall / binding 0.0.0.0. Token is in agent-config.json.'`,
};

function dataPath() {
  return DATA_FILE();
}

function uid() {
  return `rm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function findFirstExisting(paths) {
  for (const p of paths) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

function normalizeMachine(raw) {
  if (!raw || !raw.name) return null;
  const type = raw.connectionType || "rdp";
  return {
    id: String(raw.id || uid()),
    name: String(raw.name).trim(),
    group: String(raw.group || "General").trim(),
    host: String(raw.host || "").trim(),
    connectionType: type,
    rdpPort: Math.min(65535, Math.max(1, parseInt(raw.rdpPort, 10) || 3389)),
    rdpUser: String(raw.rdpUser || "").trim(),
    sshUser: String(raw.sshUser || "").trim(),
    sshPort: Math.min(65535, Math.max(1, parseInt(raw.sshPort, 10) || 22)),
    rustdeskId: String(raw.rustdeskId || "").trim(),
    macAddress: String(raw.macAddress || "").trim().replace(/-/g, ":").toUpperCase(),
    wolPort: Math.min(65535, Math.max(1, parseInt(raw.wolPort, 10) || 9)),
    psUser: String(raw.psUser || "").trim(),
    customCommand: String(raw.customCommand || "").trim(),
    agentToken: String(raw.agentToken || "").trim(),
    notes: String(raw.notes || "").trim(),
    favorite: Boolean(raw.favorite),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    lastOnline: raw.lastOnline || null,
    lastChecked: raw.lastChecked || null,
    lastLatencyMs: raw.lastLatencyMs ?? null,
  };
}

function normalizeData(raw) {
  const machines = (Array.isArray(raw?.machines) ? raw.machines : [])
    .map(normalizeMachine)
    .filter(Boolean);
  const recentHosts = Array.isArray(raw?.settings?.recentHosts)
    ? raw.settings.recentHosts.slice(0, 20).map(String)
    : [];
  return {
    machines,
    settings: {
      pingTimeoutMs: Math.min(10000, Math.max(500, parseInt(raw?.settings?.pingTimeoutMs, 10) || 2000)),
      checkPort: raw?.settings?.checkPort !== false,
      wolPort: Math.min(65535, Math.max(1, parseInt(raw?.settings?.wolPort, 10) || 9)),
      recentHosts,
    },
  };
}

async function loadStorage() {
  try {
    const raw = JSON.parse(await fs.promises.readFile(dataPath(), "utf8"));
    return { ok: true, data: normalizeData(raw) };
  } catch (err) {
    if (err?.code === "ENOENT") return { ok: true, data: normalizeData(DEFAULT_DATA) };
    return { ok: false, error: err.message || "Failed to load" };
  }
}

async function saveStorage(args) {
  const data = normalizeData(args?.data ?? args);
  await fs.promises.mkdir(path.dirname(dataPath()), { recursive: true });
  await fs.promises.writeFile(dataPath(), JSON.stringify(data, null, 2), "utf8");
  return { ok: true, data };
}

function pushRecentHost(data, host) {
  if (!host) return;
  const list = data.settings.recentHosts.filter((h) => h !== host);
  list.unshift(host);
  data.settings.recentHosts = list.slice(0, 20);
}

function checkPort(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      try {
        socket.destroy();
      } catch (_) {
      }
      resolve(v);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(false));
    socket.connect(port, host);
  });
}

async function pingHost(host, timeoutMs) {
  if (process.platform !== "win32") return { ok: false, ms: null };
  const safe = host.replace(/[^a-zA-Z0-9.\-:[\]]/g, "");
  if (!safe) return { ok: false, ms: null };
  const start = Date.now();
  try {
    const { stdout } = await execAsync(`ping -n 1 -w ${timeoutMs} ${safe}`, {
      windowsHide: true,
      timeout: timeoutMs + 2000,
    });
    const match = stdout.match(/time[=<](\d+)ms/i) || stdout.match(/time=(\d+)ms/i);
    const ms = match ? parseInt(match[1], 10) : Date.now() - start;
    return { ok: true, ms };
  } catch {
    return { ok: false, ms: null };
  }
}

function portForMachine(m) {
  switch (m.connectionType) {
    case "ssh":
      return m.sshPort || 22;
    case "rdp":
      return m.rdpPort || 3389;
    case "psremoting":
      return 5985;
    default:
      return null;
  }
}

async function checkMachineStatus(machine, settings) {
  const host = machine.host;
  const timeoutMs = settings.pingTimeoutMs || 2000;
  const result = {
    id: machine.id,
    online: false,
    ping: false,
    portOpen: null,
    ports: {},
    latencyMs: null,
  };

  if (!host) return result;

  const ping = await pingHost(host, timeoutMs);
  result.ping = ping.ok;
  result.latencyMs = ping.ms;

  const portsToCheck =
    machine.connectionType === "rdp"
      ? [machine.rdpPort || 3389]
      : machine.connectionType === "ssh"
        ? [machine.sshPort || 22]
        : machine.connectionType === "psremoting"
          ? [5985, 5986]
          : [3389, 22, 5985, 8765];

  if (settings.checkPort) {
    for (const port of portsToCheck) {
      const open = await checkPort(host, port, timeoutMs);
      result.ports[port] = open;
      if (open) result.portOpen = true;
    }
    result.online = result.ping || result.portOpen;
  } else {
    result.online = result.ping;
  }

  return result;
}

async function checkAllStatus(args) {
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  const data = loaded.data;
  const ids = args?.ids;
  let list = data.machines;
  if (Array.isArray(ids) && ids.length) {
    const set = new Set(ids);
    list = list.filter((m) => set.has(m.id));
  }

  const now = new Date().toISOString();
  const statuses = await Promise.all(list.map((m) => checkMachineStatus(m, data.settings)));

  const statusMap = Object.fromEntries(statuses.map((s) => [s.id, s]));
  data.machines = data.machines.map((m) => {
    const st = statusMap[m.id];
    if (!st) return m;
    return {
      ...m,
      lastChecked: now,
      lastOnline: st.online ? now : m.lastOnline,
      lastLatencyMs: st.latencyMs,
    };
  });
  await saveStorage({ data });

  return { ok: true, scannedAt: now, statuses, machines: data.machines };
}

function spawnDetached(command, args, options) {
  return new Promise((resolve, reject) => {
    try {
      const child = spawn(command, args, {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
        shell: false,
        ...options,
      });
      child.on("error", reject);
      child.unref();
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

async function connectRdp(machine) {
  const mstsc = path.join(process.env.WINDIR || "C:\\Windows", "System32", "mstsc.exe");
  if (!fs.existsSync(mstsc)) {
    return { ok: false, error: "mstsc.exe not found. Use Windows Pro on the target PC with RDP enabled." };
  }
  const host = machine.host;
  const port = machine.rdpPort || 3389;
  const target = port === 3389 ? host : `${host}:${port}`;

  if (machine.rdpUser) {
    const profile = require("../myspace-profile");
    const rdpPath = profile.profileScopedPath("remote-hub-last.rdp");
    const lines = [
      "screen mode id:i:2",
      "use multimon:i:0",
      "desktopwidth:i:1920",
      "desktopheight:i:1080",
      "session bpp:i:32",
      `full address:s:${target}`,
      `username:s:${machine.rdpUser}`,
      "prompt for credentials:i:1",
      "authentication level:i:2",
    ];
    await fs.promises.writeFile(rdpPath, lines.join("\r\n"), "utf8");
    await spawnDetached(mstsc, [rdpPath]);
  } else {
    await spawnDetached(mstsc, [`/v:${target}`]);
  }

  const loaded = await loadStorage();
  if (loaded.ok) {
    pushRecentHost(loaded.data, host);
    await saveStorage({ data: loaded.data });
  }
  return { ok: true, mode: "rdp", target };
}

async function connectSsh(machine) {
  const user = machine.sshUser || machine.rdpUser || process.env.USERNAME || "Administrator";
  const host = machine.host;
  const port = machine.sshPort || 22;
  const target = `${user}@${host}`;

  const wt = findFirstExisting(WT_PATHS);
  if (wt) {
    const args = port === 22 ? ["ssh", target] : ["ssh", "-p", String(port), target];
    await spawnDetached(wt, args);
    return { ok: true, mode: "ssh", via: "Windows Terminal" };
  }

  const ssh = findFirstExisting(SSH_PATHS);
  if (!ssh) {
    return {
      ok: false,
      error:
        "OpenSSH Client not found. On this PC: Settings → Optional features → OpenSSH Client. On target: run the Enable SSH script once.",
    };
  }
  const args = port === 22 ? [target] : ["-p", String(port), target];
  await spawnDetached(ssh, args);

  const loaded = await loadStorage();
  if (loaded.ok) {
    pushRecentHost(loaded.data, host);
    await saveStorage({ data: loaded.data });
  }
  return { ok: true, mode: "ssh", via: "ssh.exe" };
}

async function connectRustDesk(machine) {
  const id = machine.rustdeskId;
  if (!id) return { ok: false, error: "RustDesk ID is missing." };
  const exe = findFirstExisting(RUSTDESK_PATHS);
  if (!exe) {
    return {
      ok: false,
      error: "RustDesk not installed on THIS PC. Use RDP or SSH: built into Windows.",
    };
  }
  await spawnDetached(exe, [`--connect`, id]);
  return { ok: true, mode: "rustdesk", id };
}

async function connectPsRemoting(machine) {
  const host = machine.host.replace(/'/g, "''");
  const user = machine.psUser || machine.rdpUser || "";
  const ps = path.join(
    process.env.WINDIR || "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe"
  );
  const session = user
    ? `Enter-PSSession -ComputerName '${host}' -Credential (Get-Credential -UserName '${user.replace(/'/g, "''")}')`
    : `Enter-PSSession -ComputerName '${host}'`;
  await spawnDetached(ps, ["-NoExit", "-Command", session]);
  return { ok: true, mode: "psremoting", host: machine.host };
}

async function connectExplorer(machine) {
  const host = machine.host;
  if (!host) return { ok: false, error: "Host required" };
  await execAsync(`explorer "\\\\${host.replace(/"/g, "")}"`, { windowsHide: true, shell: true });
  return { ok: true, mode: "explorer" };
}

async function connectWinRs(machine, args) {
  if (!fs.existsSync(WINRS_PATH)) {
    return { ok: false, error: "winrs.exe not found. Enable WinRM on the target PC first." };
  }
  const host = machine.host;
  const user = args?.user || machine.psUser || machine.rdpUser || "";
  const command = args?.command || "hostname && whoami && systeminfo | findstr /B /C:\"OS Name\" /C:\"OS Version\"";
  const winrsArgs = [`-r:${host}`];
  if (user) winrsArgs.push(`-u:${user}`);
  winrsArgs.push(command);
  const ps = path.join(
    process.env.WINDIR || "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe"
  );
  await spawnDetached(ps, ["-NoExit", "-Command", `& '${WINRS_PATH.replace(/'/g, "''")}' ${winrsArgs.map((a) => `'${a.replace(/'/g, "''")}'`).join(" ")}`]);
  return { ok: true, mode: "winrs" };
}

async function connectCustom(machine) {
  const cmd = machine.customCommand;
  if (!cmd) return { ok: false, error: "Custom command is empty." };
  const expanded = cmd
    .replace(/\{host\}/gi, machine.host)
    .replace(/\{user\}/gi, machine.sshUser || machine.rdpUser || "")
    .replace(/\{port\}/gi, String(machine.sshPort || 22))
    .replace(/\{rustdeskId\}/gi, machine.rustdeskId || "");
  await execAsync(`start "" ${expanded}`, { windowsHide: true, shell: true });
  return { ok: true, mode: "custom" };
}

async function connectMachine(args) {
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;

  let machine;
  if (args?.quick) {
    machine = normalizeMachine({
      id: "quick",
      name: "Quick",
      host: args.host,
      connectionType: args.connectionType || "rdp",
      rdpPort: args.rdpPort,
      rdpUser: args.rdpUser,
      sshUser: args.sshUser,
      sshPort: args.sshPort,
      rustdeskId: args.rustdeskId,
    });
  } else {
    const id = args?.id;
    machine = loaded.data.machines.find((m) => m.id === id);
    if (!machine) return { ok: false, error: "Machine not found" };
  }

  const mode = args?.mode || machine.connectionType;
  if (!machine.host && mode !== "rustdesk") {
    return { ok: false, error: "Host / address is required" };
  }

  try {
    switch (mode) {
      case "rdp":
        return await connectRdp(machine);
      case "ssh":
        return await connectSsh(machine);
      case "rustdesk":
        return await connectRustDesk(machine);
      case "psremoting":
        return await connectPsRemoting(machine);
      case "explorer":
        return await connectExplorer(machine);
      case "winrs":
        return await connectWinRs(machine, args);
      case "custom":
        return await connectCustom(machine);
      default:
        return { ok: false, error: `Unknown mode: ${mode}` };
    }
  } catch (err) {
    return { ok: false, error: err.message || "Connection failed to start" };
  }
}

function parseMac(mac) {
  const clean = mac.replace(/[^a-fA-F0-9]/g, "");
  if (clean.length !== 12) return null;
  const buf = Buffer.alloc(6);
  for (let i = 0; i < 6; i++) {
    buf[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return buf;
}

async function wakeOnLan(args) {
  const mac = args?.mac || args?.macAddress;
  const buf = parseMac(mac);
  if (!buf) return { ok: false, error: "Invalid MAC address" };

  const loaded = await loadStorage();
  const port = args?.port || loaded.data?.settings?.wolPort || 9;
  const packet = Buffer.alloc(102);
  for (let i = 0; i < 6; i++) packet[i] = 0xff;
  for (let i = 6; i < 102; i += 6) buf.copy(packet, i);

  return new Promise((resolve) => {
    const socket = require("dgram").createSocket("udp4");
    socket.once("error", (err) => {
      socket.close();
      resolve({ ok: false, error: err.message });
    });
    socket.bind(() => {
      socket.setBroadcast(true);
      socket.send(packet, 0, packet.length, port, "255.255.255.255", (err) => {
        socket.close();
        if (err) resolve({ ok: false, error: err.message });
        else resolve({ ok: true, message: `Wake packet sent to ${mac}` });
      });
    });
  });
}

function getLocalSubnets() {
  const nets = os.networkInterfaces();
  const subnets = [];
  for (const addrs of Object.values(nets)) {
    for (const a of addrs || []) {
      if (a.family !== "IPv4" || a.internal) continue;
      const parts = a.address.split(".").map(Number);
      if (parts.length !== 4) continue;
      const base = `${parts[0]}.${parts[1]}.${parts[2]}`;
      subnets.push({ base, self: a.address });
    }
  }
  return [...new Map(subnets.map((s) => [s.base, s])).values()];
}

async function scanSubnet(args) {
  const timeoutMs = Math.min(1500, Math.max(300, parseInt(args?.timeoutMs, 10) || 600));
  const ports = args?.ports || [3389, 22, 5985, 8765];
  const subnetBase = args?.subnet;

  let targets = [];
  if (subnetBase) {
    const base = subnetBase.replace(/\.\d+$/, "").replace(/\.+$/, "");
    for (let i = 1; i <= 254; i++) targets.push(`${base}.${i}`);
  } else {
    const subnets = getLocalSubnets();
    if (!subnets.length) return { ok: false, error: "No local network interface found" };
    const base = subnets[0].base;
    for (let i = 1; i <= 254; i++) targets.push(`${base}.${i}`);
  }

  const selfIps = new Set(getLocalSubnets().map((s) => s.self));
  targets = targets.filter((ip) => !selfIps.has(ip));

  const concurrency = 40;
  const found = [];
  let idx = 0;

  async function scanHost(ip) {
    const openPorts = [];
    for (const port of ports) {
      if (await checkPort(ip, port, timeoutMs)) openPorts.push(port);
    }
    if (openPorts.length) {
      const ping = await pingHost(ip, timeoutMs);
      found.push({ ip, openPorts, ping: ping.ok, latencyMs: ping.ms });
    }
  }

  async function worker() {
    while (idx < targets.length) {
      const i = idx++;
      await scanHost(targets[i]);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  found.sort((a, b) => {
    const score = (h) =>
      (h.openPorts.includes(8765) ? 4 : 0) +
      (h.openPorts.includes(3389) ? 3 : 0) +
      (h.openPorts.includes(22) ? 2 : 0) +
      (h.ping ? 1 : 0);
    return score(b) - score(a);
  });

  return { ok: true, hosts: found, scanned: targets.length, subnet: subnetBase || getLocalSubnets()[0]?.base };
}

async function detectLocalTools() {
  const mstsc = path.join(process.env.WINDIR || "C:\\Windows", "System32", "mstsc.exe");
  return {
    ok: true,
    tools: {
      rdp: fs.existsSync(mstsc),
      ssh: Boolean(findFirstExisting(SSH_PATHS)),
      windowsTerminal: Boolean(findFirstExisting(WT_PATHS)),
      winrs: fs.existsSync(WINRS_PATH),
      rustdesk: Boolean(findFirstExisting(RUSTDESK_PATHS)),
      tailscale: Boolean(findFirstExisting(TAILSCALE_PATHS)),
    },
  };
}

async function tailscaleStatus() {
  const exe = findFirstExisting(TAILSCALE_PATHS);
  if (!exe) {
    return { ok: false, error: "Tailscale not installed on this PC" };
  }
  try {
    const { stdout } = await execAsync(`"${exe}" status --json`, {
      windowsHide: true,
      timeout: 15000,
      maxBuffer: 2 * 1024 * 1024,
    });
    const json = JSON.parse(stdout);
    const self = json.Self;
    const peers = [];
    if (json.Peer) {
      for (const [key, peer] of Object.entries(json.Peer)) {
        const ips = peer.TailscaleIPs || [];
        peers.push({
          id: key,
          name: peer.HostName || peer.DNSName || key,
          ip: ips[0] || "",
          os: peer.OS || "",
          online: peer.Online,
        });
      }
    }
    return {
      ok: true,
      self: self
        ? { name: self.HostName, ips: self.TailscaleIPs || [], online: true }
        : null,
      peers: peers.filter((p) => p.ip),
    };
  } catch (err) {
    return { ok: false, error: err.message || "Could not read Tailscale status" };
  }
}

async function importTailscalePeers() {
  const status = await tailscaleStatus();
  if (!status.ok) return status;

  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  const data = loaded.data;
  const existingHosts = new Set(data.machines.map((m) => m.host));
  let added = 0;

  for (const peer of status.peers) {
    if (!peer.ip || existingHosts.has(peer.ip)) continue;
    data.machines.push(
      normalizeMachine({
        id: uid(),
        name: peer.name || peer.ip,
        group: "Tailscale",
        host: peer.ip,
        connectionType: "rdp",
        notes: `Imported from Tailscale (${peer.os || "peer"})`,
      })
    );
    existingHosts.add(peer.ip);
    added++;
  }
  await saveStorage({ data });
  return { ok: true, added, machines: data.machines };
}

function getEnableScript(args) {
  const key = args?.script || "all";
  const text = ENABLE_SCRIPTS[key] || ENABLE_SCRIPTS.all;
  return { ok: true, script: text, id: key };
}

async function copyToClipboard(args) {
  const text = args?.text || "";
  clipboard.writeText(text);
  return { ok: true };
}

async function exportMachines() {
  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  return { ok: true, json: JSON.stringify(loaded.data.machines, null, 2) };
}

async function importMachines(args) {
  let list;
  try {
    list = typeof args?.json === "string" ? JSON.parse(args.json) : args?.machines;
  } catch {
    return { ok: false, error: "Invalid JSON" };
  }
  if (!Array.isArray(list)) return { ok: false, error: "Expected array of machines" };

  const loaded = await loadStorage();
  if (!loaded.ok) return loaded;
  const data = loaded.data;
  const existing = new Set(data.machines.map((m) => m.id));
  let added = 0;
  for (const raw of list) {
    const m = normalizeMachine({ ...raw, id: raw.id && existing.has(raw.id) ? uid() : raw.id });
    if (m) {
      data.machines.push(m);
      added++;
    }
  }
  await saveStorage({ data });
  return { ok: true, added, machines: data.machines };
}

async function openTailscaleDownload() {
  const { shell } = require("electron");
  await shell.openExternal("https://tailscale.com/download/windows");
  return { ok: true };
}

async function openRustDeskDownload() {
  const { shell } = require("electron");
  await shell.openExternal("https://github.com/rustdesk/rustdesk/releases/latest");
  return { ok: true };
}

function toEncodedCommand(psScript) {
  return Buffer.from(String(psScript || ""), "utf16le").toString("base64");
}

function getCaptureScript(opts = {}) {
  const maxW = Math.min(1920, Math.max(320, parseInt(opts.maxWidth, 10) || 1280));
  const jpegQ = Math.min(92, Math.max(35, parseInt(opts.jpegQuality, 10) || 70));

  return `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)

# scale down for speed
$targetW = ${maxW}
if ($bmp.Width -gt $targetW) {
  $ratio = $targetW / [double]$bmp.Width
  $targetH = [int]($bmp.Height * $ratio)
  $scaled = New-Object System.Drawing.Bitmap $targetW, $targetH
  $gs = [System.Drawing.Graphics]::FromImage($scaled)
  $gs.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $gs.DrawImage($bmp, 0, 0, $targetW, $targetH)
  $gs.Dispose()
  $bmp.Dispose()
  $bmp = $scaled
}

$ms = New-Object System.IO.MemoryStream
$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1
$p = New-Object System.Drawing.Imaging.EncoderParameters 1
$p.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ${jpegQ}
$bmp.Save($ms, $enc, $p)
$g.Dispose()
$bmp.Dispose()

$bytes = $ms.ToArray()
$ms.Dispose()
[Convert]::ToBase64String($bytes)
`.trim();
}

function parseWinRsError(raw) {
  const msg = String(raw || "");
  if (/cannot connect to the destination/i.test(msg)) {
    return {
      code: "winrm_unreachable",
      message:
        "Cannot reach WinRM on that PC. On the TARGET: Enable access → WinRM script (Admin). On THIS PC: Client script. Same Wi‑Fi or VPN required.",
    };
  }
  if (/access is denied|logon failure|authentication/i.test(msg)) {
    return {
      code: "auth_failed",
      message:
        "Access denied. Set the correct Windows username, enter the password below, and use an account that is Administrator on the target PC.",
    };
  }
  if (/trustedhosts/i.test(msg)) {
    return {
      code: "trusted_hosts",
      message:
        'On THIS PC run Enable access → "Client" script as Administrator, then try again.',
    };
  }
  return { code: "unknown", message: msg.slice(0, 400) || "WinRM command failed" };
}

function runWinRs(args) {
  const host = String(args.host || "").trim();
  const user = String(args.user || "").trim();
  const password = String(args.password || "");
  const remoteArgs = Array.isArray(args.remoteArgs) ? args.remoteArgs : [];
  const timeoutMs = Math.min(25000, Math.max(3000, parseInt(args.timeoutMs, 10) || 12000));

  const winrsArgs = [`-r:${host}`];
  if (user) winrsArgs.push(`-u:${user}`);
  if (password) winrsArgs.push(`-p:${password}`);
  winrsArgs.push(...remoteArgs);

  return new Promise((resolve, reject) => {
    const child = spawn(WINRS_PATH, winrsArgs, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
    });
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch (_) {
      }
      reject(new Error("Timed out waiting for the remote PC."));
    }, timeoutMs);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else {
        const parsed = parseWinRsError(stderr || stdout);
        const err = new Error(parsed.message);
        err.code = parsed.code;
        reject(err);
      }
    });
  });
}

async function probeWinRM(args) {
  const host = String(args?.host || "").trim();
  if (!host) return { ok: false, error: "Host is required" };

  const loaded = await loadStorage();
  const timeoutMs = loaded.data?.settings?.pingTimeoutMs || 2000;
  const ping = await pingHost(host, timeoutMs);
  const port5985 = await checkPort(host, 5985, timeoutMs);
  const port5986 = await checkPort(host, 5986, timeoutMs);

  let hint = "";
  if (!ping.ok && !port5985 && !port5986) {
    hint =
      "PC not reachable on the network. Check IP, Wi‑Fi, firewall, or that the other computer is on.";
  } else if (ping.ok && !port5985 && !port5986) {
    hint =
      'WinRM is OFF on the target. On that PC: Remote Hub → Enable access → copy "WinRM" or "Enable everything" → Run as Administrator in PowerShell.';
  } else if (port5985 || port5986) {
    hint = "WinRM port is open. If Live View still fails, set username/password and run Client script on this PC.";
  }

  return {
    ok: true,
    host,
    ping: ping.ok,
    latencyMs: ping.ms,
    winrmPortOpen: port5985 || port5986,
    port5985,
    port5986,
    ready: port5985 || port5986,
    hint,
  };
}

function getAgentDir() {
  const { app } = require("electron");
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "apps", "remote-hub", "agent");
  }
  return path.join(__dirname, "..", "..", "apps", "remote-hub", "agent");
}

const AGENT_DEFAULT_PORT = 8765;

function agentConfigPath() {
  return path.join(getAgentDir(), "agent-config.json");
}

function ensureLocalAgentToken() {
  const configPath = agentConfigPath();
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const existing = String(cfg?.token || "").trim();
    if (existing && existing !== "myspace") return existing;
  } catch {
    /* create below */
  }
  const token = crypto.randomBytes(24).toString("base64url");
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(
    configPath,
    JSON.stringify({ token, createdAt: new Date().toISOString() }, null, 2),
    "utf8"
  );
  return token;
}

async function probeAgent(args) {
  const host = String(args?.host || "").trim();
  if (!host) return { ok: false, error: "Host is required" };

  const port = Math.min(65535, Math.max(1, parseInt(args?.port, 10) || AGENT_DEFAULT_PORT));
  const loaded = await loadStorage();
  const timeoutMs = loaded.data?.settings?.pingTimeoutMs || 2000;
  const ping = await pingHost(host, timeoutMs);
  const agentPortOpen = await checkPort(host, port, timeoutMs);

  let hint = "";
  if (!agentPortOpen) {
    hint =
      "Agent not running. Copy the agent folder to the target PC and run install.ps1 as Administrator (Enable access → Remote Agent). Paste the printed Agent token into the machine settings.";
  } else {
    hint = "Agent port open. Connect with the Agent token from install.ps1 / agent-config.json.";
  }

  return {
    ok: true,
    host,
    port,
    ping: ping.ok,
    latencyMs: ping.ms,
    agentReady: agentPortOpen,
    ready: agentPortOpen,
    hint,
  };
}

async function openAgentFolder() {
  const { shell } = require("electron");
  const dir = getAgentDir();
  if (!fs.existsSync(dir)) {
    return { ok: false, error: "Agent folder not found in this install." };
  }
  await shell.openPath(dir);
  return { ok: true, path: dir };
}

async function startLocalAgent() {
  const dir = getAgentDir();
  const server = path.join(dir, "server.js");
  if (!fs.existsSync(server)) {
    return { ok: false, error: "Agent server.js not found." };
  }
  const nodeModules = path.join(dir, "node_modules", "ws");
  if (!fs.existsSync(nodeModules)) {
    return {
      ok: false,
      error: "Agent dependencies missing. Run: cd apps/remote-hub/agent && npm install",
    };
  }
  const token = ensureLocalAgentToken();
  spawn("node", [server], {
    cwd: dir,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: { ...process.env, RH_AGENT_TOKEN: token },
  }).unref();
  return {
    ok: true,
    message: `Agent starting on port ${AGENT_DEFAULT_PORT}. Token saved in agent-config.json (not logged).`,
    token,
  };
}

async function captureRemoteScreen(args) {
  const host = String(args?.host || "").trim();
  if (!host) return { ok: false, error: "Host is required" };

  if (!fs.existsSync(WINRS_PATH)) {
    return {
      ok: false,
      error:
        "winrs.exe not found on THIS PC. Settings → Optional features → add Windows Remote Management tools.",
    };
  }

  const probe = await probeWinRM({ host });
  if (!probe.ready) {
    return { ok: false, code: "winrm_not_ready", error: probe.hint, probe };
  }

  const user = String(args?.user || "").trim();
  const password = String(args?.password || "");
  const encoded = toEncodedCommand(getCaptureScript(args));

  try {
    const { stdout, stderr } = await runWinRs({
      host,
      user,
      password,
      timeoutMs: args?.timeoutMs,
      remoteArgs: [
        "powershell",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-EncodedCommand",
        encoded,
      ],
    });
    const combined = `${stdout}\n${stderr}`;
    const lines = combined
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const b64Line = lines.filter((l) => /^[A-Za-z0-9+/=]+$/.test(l) && l.length > 200).pop();
    const b64 = b64Line || lines[lines.length - 1] || "";
    if (!b64 || b64.length < 100) {
      return {
        ok: false,
        error:
          "Connected but no screenshot returned. Try another user account or lower quality. Target needs Windows PowerShell 5.1 with .NET (normal on Windows).",
      };
    }
    return { ok: true, mime: "image/jpeg", dataBase64: b64 };
  } catch (err) {
    return {
      ok: false,
      code: err.code || "capture_failed",
      error: err.message || "Screen capture failed.",
      probe,
    };
  }
}

const CHANNELS = {
  "storage.load": () => loadStorage(),
  "storage.save": (args) => saveStorage(args),
  "machines.check": (args) => checkAllStatus(args),
  connect: (args) => connectMachine(args),
  "screen.probe": (args) => probeWinRM(args),
  "screen.capture": (args) => captureRemoteScreen(args),
  "agent.probe": (args) => probeAgent(args),
  "agent.openFolder": () => openAgentFolder(),
  "agent.startLocal": () => startLocalAgent(),
  "wol.wake": (args) => wakeOnLan(args),
  "network.scan": (args) => scanSubnet(args),
  "tools.local": () => detectLocalTools(),
  "tailscale.status": () => tailscaleStatus(),
  "tailscale.import": () => importTailscalePeers(),
  "scripts.get": (args) => getEnableScript(args),
  "clipboard.copy": (args) => copyToClipboard(args),
  "machines.export": () => exportMachines(),
  "machines.import": (args) => importMachines(args),
  "help.tailscale": () => openTailscaleDownload(),
  "help.rustdesk": () => openRustDeskDownload(),
};

async function handleRemoteHubInvoke(channel, args) {
  const authErr = signedInGuard();
  if (authErr) return authErr;
  const handler = CHANNELS[channel];
  if (!handler) return { ok: false, error: `Unknown channel: ${channel}` };
  try {
    return await handler(args);
  } catch (err) {
    return { ok: false, error: err.message || "Request failed" };
  }
}

module.exports = { handleRemoteHubInvoke };