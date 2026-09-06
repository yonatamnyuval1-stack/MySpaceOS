window.RemoteHubPages = window.RemoteHubPages || {};

window.RemoteHubPages.network = (function () {
  const { escapeHtml, invoke, uid } = window.RemoteHub;

  const page = document.getElementById("page-network");
  let scanning = false;
  let lastHosts = [];

  async function scan() {
    if (scanning) return;
    const btn = page.querySelector("#net-scan");
    const results = page.querySelector("#net-results");
    scanning = true;
    btn.disabled = true;
    btn.classList.add("loading");
    results.innerHTML = `<p class="loading-cell">Scanning local network for RDP (3389), SSH (22), WinRM (5985)…</p>`;

    try {
      await window.RemoteHubHologram.play({ label: "Scanning network" });
      const res = await invoke("network.scan", { timeoutMs: 500 });
      lastHosts = res.hosts || [];
      renderResults(res);
    } catch (err) {
      results.innerHTML = `<p class="empty-cell">${escapeHtml(err.message)}</p>`;
    } finally {
      scanning = false;
      btn.disabled = false;
      btn.classList.remove("loading");
    }
  }

  function portLabel(port) {
    if (port === 3389) return "RDP";
    if (port === 22) return "SSH";
    if (port === 5985) return "WinRM";
    return String(port);
  }

  function renderResults(res) {
    const results = page.querySelector("#net-results");
    const summary = page.querySelector("#net-summary");
    summary.textContent = res.hosts?.length
      ? `Found ${res.hosts.length} host(s) on ${res.subnet}.x (scanned ${res.scanned} IPs)`
      : `No remote services found on ${res.subnet || "local"}.x — enable RDP/SSH on target PCs first.`;

    if (!res.hosts?.length) {
      results.innerHTML = `<div class="empty-state">
        <p>No PCs with open RDP, SSH, or WinRM on your LAN.</p>
        <p class="empty-hint">On the target PC run the <strong>Enable access</strong> scripts once (built-in Windows).</p>
      </div>`;
      return;
    }

    results.innerHTML = res.hosts
      .map((h) => {
        const ports = h.openPorts.map((p) => `<span class="port-tag">${portLabel(p)}</span>`).join("");
        const lat = h.latencyMs != null ? `${h.latencyMs}ms` : "—";
        return `
        <article class="net-host-card">
          <div class="net-host-top">
            <span class="status-dot ${h.ping ? "on" : "off"}"></span>
            <strong class="mono">${escapeHtml(h.ip)}</strong>
            <span class="net-lat">${escapeHtml(lat)}</span>
          </div>
          <div class="net-ports">${ports}</div>
          <footer class="net-host-foot">
            <button type="button" class="btn btn-primary btn-sm" data-add="${escapeHtml(h.ip)}">+ Save</button>
            <button type="button" class="btn btn-ghost btn-sm" data-rdp="${escapeHtml(h.ip)}">RDP</button>
            <button type="button" class="btn btn-ghost btn-sm" data-ssh="${escapeHtml(h.ip)}">SSH</button>
          </footer>
        </article>`;
      })
      .join("");

    results.querySelectorAll("[data-rdp]").forEach((btn) => {
      btn.addEventListener("click", () => quickConnect(btn.dataset.rdp, "rdp"));
    });
    results.querySelectorAll("[data-ssh]").forEach((btn) => {
      btn.addEventListener("click", () => quickConnect(btn.dataset.ssh, "ssh"));
    });
    results.querySelectorAll("[data-add]").forEach((btn) => {
      btn.addEventListener("click", () => addMachine(btn.dataset.add));
    });
  }

  async function quickConnect(host, mode) {
    try {
      await invoke("connect", { quick: true, host, mode, connectionType: mode });
    } catch (err) {
      alert(err.message);
    }
  }

  async function addMachine(ip) {
    const host = lastHosts.find((h) => h.ip === ip);
    const type = host?.openPorts?.includes(3389) ? "rdp" : host?.openPorts?.includes(22) ? "ssh" : "rdp";
    const load = await invoke("storage.load");
    const data = load.data || { machines: [], settings: {} };
    data.machines.push({
      id: uid(),
      name: `PC ${ip.split(".").pop()}`,
      group: "Discovered",
      host: ip,
      connectionType: type,
      rdpPort: 3389,
      sshPort: 22,
      notes: `Auto-discovered: ${(host?.openPorts || []).join(", ")}`,
    });
    await invoke("storage.save", { data });
    alert(`Saved ${ip} to Machines`);
  }

  function bind() {
    page.querySelector("#net-scan")?.addEventListener("click", scan);
  }

  return { id: "network", page, scan, bind };
})();
