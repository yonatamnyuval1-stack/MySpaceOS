window.RemoteHubPages = window.RemoteHubPages || {};

window.RemoteHubPages.enable = (function () {
  const { escapeHtml, invoke } = window.RemoteHub;

  const page = document.getElementById("page-enable");
  const SCRIPTS = [
    { id: "agent", title: "Remote Agent (full control)", desc: "Mouse + keyboard + screen on target : port 8765. Copy agent folder, run install.ps1" },
    { id: "all", title: "Enable everything (recommended)", desc: "On the TARGET PC : RDP + WinRM + SSH" },
    { id: "winrm", title: "WinRM only (Live View)", desc: "On the TARGET PC: port 5985; required for Live View screenshots" },
    { id: "client", title: "This PC (client)", desc: "On YOUR My Space computer : allows connecting to other PCs via WinRM" },
    { id: "rdp", title: "Remote Desktop only", desc: "On the TARGET PC : port 3389 (Windows Pro on target)" },
    { id: "ssh", title: "OpenSSH Server", desc: "On the TARGET PC : port 22" },
  ];

  async function scan() {
    await loadScripts();
    await loadTailscale();
  }

  async function loadScripts() {
    const grid = page.querySelector("#enable-scripts");
    grid.innerHTML = SCRIPTS.map(
      (s) => `
      <article class="script-card" data-script="${s.id}">
        <h3>${escapeHtml(s.title)}</h3>
        <p>${escapeHtml(s.desc)}</p>
        <pre class="script-pre" id="script-${s.id}">Loading…</pre>
        <div class="script-actions">
          <button type="button" class="btn btn-primary btn-sm" data-copy="${s.id}">Copy script</button>
        </div>
      </article>`
    ).join("");

    for (const s of SCRIPTS) {
      const res = await invoke("scripts.get", { script: s.id });
      const pre = page.querySelector(`#script-${s.id}`);
      if (pre) pre.textContent = res.script || "";
    }

    grid.querySelectorAll("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const res = await invoke("scripts.get", { script: btn.dataset.copy });
        await invoke("clipboard.copy", { text: res.script });
        btn.textContent = "Copied!";
        setTimeout(() => {
          btn.textContent = "Copy script";
        }, 2000);
      });
    });
  }

  async function loadTailscale() {
    const box = page.querySelector("#tailscale-box");
    const res = await invoke("tailscale.status");
    if (!res.ok) {
      box.innerHTML = `<p class="muted">${escapeHtml(res.error)}</p>
        <button type="button" class="btn btn-ghost btn-sm" id="btn-ts-dl">Get Tailscale (optional)</button>`;
      box.querySelector("#btn-ts-dl")?.addEventListener("click", () => invoke("help.tailscale"));
      return;
    }

    const peers = res.peers || [];
    box.innerHTML = `
      <p><strong>Your Tailscale:</strong> <span class="mono">${escapeHtml((res.self?.ips || [])[0] || "—")}</span></p>
      <p>${peers.length} peer(s) online</p>
      <button type="button" class="btn btn-primary btn-sm" id="btn-ts-import">Import peers to Machines</button>
      <ul class="peer-list">${peers
        .slice(0, 12)
        .map(
          (p) =>
            `<li><span class="status-dot ${p.online ? "on" : "off"}"></span> ${escapeHtml(p.name)} <span class="mono">${escapeHtml(p.ip)}</span></li>`
        )
        .join("")}</ul>`;

    box.querySelector("#btn-ts-import")?.addEventListener("click", async () => {
      try {
        const imp = await invoke("tailscale.import");
        alert(`Added ${imp.added} machine(s) from Tailscale`);
      } catch (err) {
        alert(err.message);
      }
    });
  }

  function bind() {
    page.querySelector("#btn-open-agent-folder")?.addEventListener("click", () => invoke("agent.openFolder"));
  }

  return { id: "enable", page, scan, bind };
})();