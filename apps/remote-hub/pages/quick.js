window.RemoteHubPages = window.RemoteHubPages || {};

window.RemoteHubPages.quick = (function () {
  const { escapeHtml, invoke } = window.RemoteHub;

  const page = document.getElementById("page-quick");

  async function scan() {
    await render();
  }

  async function render() {
    const tools = await invoke("tools.local");
    const load = await invoke("storage.load");
    const recent = load.data?.settings?.recentHosts || [];

    const t = tools.tools || {};
    const badges = [
      ["RDP (mstsc)", t.rdp],
      ["SSH", t.ssh],
      ["WinRS", t.winrs],
      ["Terminal", t.windowsTerminal],
      ["Tailscale", t.tailscale],
    ];

    page.querySelector("#quick-tools").innerHTML = badges
      .map(
        ([label, ok]) =>
          `<span class="tool-badge ${ok ? "ok" : "missing"}">${escapeHtml(label)} ${ok ? "✓" : "—"}</span>`
      )
      .join("");

    const recentEl = page.querySelector("#quick-recent");
    if (!recent.length) {
      recentEl.innerHTML = `<p class="muted">Recent hosts appear here after you connect.</p>`;
    } else {
      recentEl.innerHTML = recent
        .slice(0, 8)
        .map(
          (h) =>
            `<button type="button" class="chip-btn" data-host="${escapeHtml(h)}">${escapeHtml(h)}</button>`
        )
        .join("");
      recentEl.querySelectorAll("[data-host]").forEach((btn) => {
        btn.addEventListener("click", () => {
          page.querySelector("#qc-host").value = btn.dataset.host;
        });
      });
    }
  }

  async function connect(mode) {
    const host = page.querySelector("#qc-host").value.trim();
    if (!host) {
      alert("Enter an IP or computer name");
      return;
    }
    const payload = {
      quick: true,
      host,
      connectionType: mode,
      mode,
      rdpPort: parseInt(page.querySelector("#qc-rdp-port")?.value, 10) || 3389,
      rdpUser: page.querySelector("#qc-rdp-user")?.value.trim() || "",
      sshUser: page.querySelector("#qc-ssh-user")?.value.trim() || "",
      sshPort: parseInt(page.querySelector("#qc-ssh-port")?.value, 10) || 22,
    };

    const labels = { rdp: "Remote Desktop", ssh: "SSH", psremoting: "PowerShell", explorer: "File share" };
    try {
      await window.RemoteHubHologram.run(`Connecting · ${labels[mode] || mode}`, async () => {
        const res = await invoke("connect", payload);
        if (!res?.ok) throw new Error(res?.error || "Failed");
        return res;
      });
    } catch (err) {
      alert(err.message || "Connect failed");
    }
  }

  function bind() {
    page.querySelector("#qc-connect-rdp")?.addEventListener("click", () => connect("rdp"));
    page.querySelector("#qc-connect-ssh")?.addEventListener("click", () => connect("ssh"));
    page.querySelector("#qc-connect-ps")?.addEventListener("click", () => connect("psremoting"));
    page.querySelector("#qc-connect-explorer")?.addEventListener("click", () => connect("explorer"));
    page.querySelector("#qc-control")?.addEventListener("click", () => {
      const host = page.querySelector("#qc-host").value.trim();
      if (!host) {
        alert("Enter an IP or computer name");
        return;
      }
      window.RemoteHubControl?.open({ host });
    });
    page.querySelector("#qc-live-view")?.addEventListener("click", () => {
      const host = page.querySelector("#qc-host").value.trim();
      const user = page.querySelector("#qc-rdp-user")?.value.trim() || "";
      if (!host) {
        alert("Enter an IP or computer name");
        return;
      }
      window.RemoteHubViewer?.open({ host, user });
    });

    page.querySelector("#qc-host")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") connect("rdp");
    });
  }

  return { id: "quick", page, scan, bind };
})();
