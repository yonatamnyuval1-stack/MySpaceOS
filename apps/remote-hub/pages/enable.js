window.RemoteHubPages = window.RemoteHubPages || {};
window.RemoteHubPages.enable = (function () {
  const { escapeHtml, invoke } = window.RemoteHub;
  const page = document.getElementById("page-enable");
  const SCRIPTS = [
    {
      id: "agent",
      title: "Remote Agent (full control)",
      desc: "Mouse + keyboard + screen on target · port 8765. install.ps1 asks before LAN/firewall.",
      risk: null,
    },
    {
      id: "all",
      title: "Enable everything (recommended)",
      desc: "On the TARGET PC: RDP + WinRM + SSH",
      risk: "Opens Remote Desktop, WinRM, and SSH firewall rules on the target PC.",
    },
    {
      id: "winrm",
      title: "WinRM only (Live View)",
      desc: "On the TARGET PC: port 5985; required for Live View screenshots",
      risk: "Enables PowerShell Remoting and opens WinRM (5985) on the target PC.",
    },
    {
      id: "client",
      title: "This PC (client)",
      desc: "On YOUR My Space computer: allows connecting to other PCs via WinRM",
      risk: "Sets TrustedHosts=* so this PC trusts any WinRM host. Prefer specific IPs when possible.",
    },
    {
      id: "rdp",
      title: "Remote Desktop only",
      desc: "On the TARGET PC: port 3389 (Windows Pro on target)",
      risk: "Enables Remote Desktop and its firewall group on the target PC.",
    },
    {
      id: "ssh",
      title: "OpenSSH Server",
      desc: "On the TARGET PC: port 22",
      risk: "Installs OpenSSH Server and opens inbound TCP 22.",
    },
  ];

  async function scan() {
    await loadScripts();
    await loadTailscale();
  }

  function confirmRisk(script) {
    if (!script.risk) return true;
    return window.confirm(
      `${script.title}\n\n${script.risk}\n\nCopy this PowerShell script only if you understand and accept that risk.`
    );
  }

  async function loadScripts() {
    const grid = page.querySelector("#enable-scripts");
    grid.innerHTML = SCRIPTS.map((s) => {
      const riskBlock = s.risk
        ? `<p class="script-risk">${escapeHtml(s.risk)}</p>
        <label class="script-optin">
          <input type="checkbox" data-optin="${s.id}" />
          <span>I understand and want to copy this script</span>
        </label>`
        : `<p class="script-safe muted">install.ps1 will ask before opening the firewall or binding to the LAN.</p>`;
      return `
      <article class="script-card${s.risk ? " script-card--risk" : ""}" data-script="${s.id}">
        <h3>${escapeHtml(s.title)}</h3>
        <p>${escapeHtml(s.desc)}</p>
        ${riskBlock}
        <pre class="script-pre" id="script-${s.id}">Loading…</pre>
        <div class="script-actions">
          <button type="button" class="btn btn-primary btn-sm" data-copy="${s.id}" ${
            s.risk ? "disabled" : ""
          }>Copy script</button>
        </div>
      </article>`;
    }).join("");
    for (const s of SCRIPTS) {
      const res = await invoke("scripts.get", { script: s.id });
      const pre = page.querySelector(`#script-${s.id}`);
      if (pre) pre.textContent = res.script || "";
    }
    grid.querySelectorAll("[data-optin]").forEach((box) => {
      box.addEventListener("change", () => {
        const id = box.getAttribute("data-optin");
        const btn = grid.querySelector(`[data-copy="${id}"]`);
        if (btn) btn.disabled = !box.checked;
      });
    });
    grid.querySelectorAll("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.copy;
        const script = SCRIPTS.find((s) => s.id === id);
        if (!script) return;
        if (script.risk) {
          const opted = grid.querySelector(`[data-optin="${id}"]`)?.checked;
          if (!opted) {
            window.alert("Check “I understand…” before copying this script.");
            return;
          }
          if (!confirmRisk(script)) return;
        }
        const res = await invoke("scripts.get", { script: id });
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