const { runPowerShell, toArray } = require("./exec-utils");

function normalizeList(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(normalizeList).filter(Boolean);
  if (typeof value === "object") {
    if (value.IPAddress != null) return normalizeList(value.IPAddress);
    if (value.NextHop != null) return normalizeList(value.NextHop);
    if (value.ServerAddresses != null) return normalizeList(value.ServerAddresses);
    return [];
  }
  const s = String(value).trim();
  if (!s) return [];
  if (/MSFT_|CreationClassName|@{/.test(s)) return [];
  return [s];
}

function looksLikeIpv4(s) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(String(s || ""));
}

async function scanNetwork() {
  const scannedAt = new Date().toISOString();

  if (process.platform !== "win32") {
    return {
      ok: true,
      scannedAt,
      adapters: [],
      summary: { adapters: 0, connected: 0 },
      note: "Network scan is supported on Windows only.",
    };
  }

  try {
    const adapterRaw = await runPowerShell(
      "Get-NetAdapter | Select-Object Name,InterfaceDescription,Status,LinkSpeed,MacAddress,MediaType,PhysicalMediaType | ConvertTo-Json -Compress"
    );
    const ipRaw = await runPowerShell(
      "Get-NetIPConfiguration | Select-Object InterfaceAlias,InterfaceDescription,IPv4Address,IPv4DefaultGateway,IPv6Address,IPv6DefaultGateway,DnsServer,NetAdapter.Status,NetAdapter.LinkSpeed,NetAdapter.MacAddress | ConvertTo-Json -Compress"
    );

    const adapters = toArray(adapterRaw);
    const ipConfigs = toArray(ipRaw);

    const merged = ipConfigs.map((cfg, index) => {
      const ipv4 = normalizeList(
        cfg.IPv4Address?.IPAddress || cfg.IPv4Address
      ).filter(looksLikeIpv4);
      const ipv6 = normalizeList(
        cfg.IPv6Address?.IPAddress || cfg.IPv6Address
      ).filter((ip) => !ip.startsWith("fe80"));
      const gateway4 = normalizeList(
        cfg.IPv4DefaultGateway?.NextHop || cfg.IPv4DefaultGateway
      ).filter(looksLikeIpv4);
      const gateway6 = normalizeList(
        cfg.IPv6DefaultGateway?.NextHop || cfg.IPv6DefaultGateway
      );
      const dns = normalizeList(
        cfg.DnsServer?.ServerAddresses || cfg.DnsServer
      ).filter((d) => looksLikeIpv4(d) || (d.includes(":") && !/MSFT_/.test(d)));
      const status =
        cfg.NetAdapter?.Status || adapters.find((a) => a.Name === cfg.InterfaceAlias)?.Status || "Unknown";
      const linkSpeed =
        cfg.NetAdapter?.LinkSpeed || adapters.find((a) => a.Name === cfg.InterfaceAlias)?.LinkSpeed || "";
      const mac =
        cfg.NetAdapter?.MacAddress || adapters.find((a) => a.Name === cfg.InterfaceAlias)?.MacAddress || "";

      return {
        key: `adapter-${index}-${cfg.InterfaceAlias || index}`,
        name: cfg.InterfaceAlias || cfg.InterfaceDescription || `Adapter ${index}`,
        description: cfg.InterfaceDescription || "",
        status,
        statusLabel: status === "Up" ? "Connected" : status,
        linkSpeed: linkSpeed || "—",
        macAddress: mac || "—",
        ipv4,
        ipv6,
        ipv4Primary: ipv4[0] || "—",
        ipv6Primary: ipv6[0] || "—",
        gateway4: gateway4.join(", ") || "—",
        gateway6: gateway6.join(", ") || "—",
        dns: dns.length ? dns : ["—"],
        dnsPrimary: dns[0] || "—",
        connected: status === "Up",
      };
    });

    if (!merged.length && adapters.length) {
      adapters.forEach((a, index) => {
        merged.push({
          key: `adapter-${index}-${a.Name}`,
          name: a.Name,
          description: a.InterfaceDescription || "",
          status: a.Status,
          statusLabel: a.Status === "Up" ? "Connected" : a.Status,
          linkSpeed: a.LinkSpeed || "—",
          macAddress: a.MacAddress || "—",
          ipv4: [],
          ipv6: [],
          ipv4Primary: "—",
          ipv6Primary: "—",
          gateway4: "—",
          gateway6: "—",
          dns: ["—"],
          dnsPrimary: "—",
          connected: a.Status === "Up",
        });
      });
    }

    const connected = merged.filter((a) => a.connected).length;
    const ranked = [...merged].sort((a, b) => {
      const sa = (a.connected ? 100 : 0) + scoreName(a.name, a.ipv4Primary);
      const sb = (b.connected ? 100 : 0) + scoreName(b.name, b.ipv4Primary);
      return sb - sa;
    });

    return {
      ok: true,
      scannedAt,
      adapters: merged,
      summary: {
        adapters: merged.length,
        connected,
        primaryIp: ranked.find((a) => a.connected && a.ipv4Primary !== "—")?.ipv4Primary || "—",
        primaryName: ranked.find((a) => a.connected)?.name || null,
      },
    };
  } catch (err) {
    return { ok: false, error: err.message || "Network scan failed" };
  }
}

function scoreName(name, address) {
  const n = String(name || "").toLowerCase();
  let score = 10;
  if (/wi-?fi|wlan|wireless|wifi|wl/.test(n)) score += 40;
  if (/ethernet|eth\d|lan/.test(n) && !/vethernet|virtual/.test(n)) score += 30;
  if (/vethernet|wsl|hyper-v|vmware|virtualbox|docker|loopback|bluetooth|teredo|isatap|vpn/.test(n)) {
    score -= 60;
  }
  if (address && String(address).startsWith("169.254.")) score -= 30;
  return score;
}

module.exports = { scanNetwork };