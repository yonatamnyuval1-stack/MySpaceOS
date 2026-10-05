window.RemoteHubPages = window.RemoteHubPages || {};
window.RemoteHubPages.machines = (function () {
  const { escapeHtml, invoke, uid, formatTime, typeLabel, CONNECTION_TYPES, QUICK_ACTIONS } =
    window.RemoteHub;
  const page = document.getElementById("page-machines");
  const statsEl = document.getElementById("machines-stats");
  const gridEl = document.getElementById("machines-grid");
  const tbody = document.getElementById("machines-body");
  const searchInput = document.getElementById("machines-search");
  const groupFilter = document.getElementById("machines-group-filter");
  const favOnly = document.getElementById("machines-favorites-only");
  const lastScanEl = document.getElementById("machines-last-scan");
  const btnAdd = document.getElementById("btn-add-machine");
  let machines = [];
  let statusMap = {};
  let selectedId = null;
  let draft = null;
  let appUi = null;

  function groups() {
    const set = new Set(machines.map((m) => m.group || "General"));
    return [...set].sort();
  }

  function filtered() {
    const q = (searchInput?.value || "").trim().toLowerCase();
    return machines.filter((m) => {
      if (favOnly?.checked && !m.favorite) return false;
      const gf = groupFilter?.value;
      if (gf && gf !== "all" && m.group !== gf) return false;
      if (!q) return true;
      const hay = `${m.name} ${m.host} ${m.group} ${m.rustdeskId} ${m.notes}`.toLowerCase();
      return hay.includes(q);
    });
  }

  function statusBadge(m) {
    const st = statusMap[m.id];
    if (!st) return `<span class="status-pill unknown">Unknown</span>`;
    const lat = st.latencyMs != null ? ` · ${st.latencyMs}ms` : "";
    if (st.online) return `<span class="status-pill online">Online${lat}</span>`;
    return `<span class="status-pill offline">Offline</span>`;
  }

  function renderStats() {
    const online = Object.values(statusMap).filter((s) => s.online).length;
    renderStatCards(statsEl, [
      { label: "Machines", value: machines.length, cls: "accent" },
      { label: "Online", value: online, cls: "success" },
      { label: "Offline", value: machines.length - online, cls: "warn" },
      { label: "Favorites", value: machines.filter((m) => m.favorite).length },
    ]);
  }

  function renderStatCards(container, cards) {
    if (!container) return;
    container.innerHTML = cards
      .map(
        (c) => `
      <article class="stat-card ${c.cls || ""}">
        <div class="stat-label">${escapeHtml(c.label)}</div>
        <div class="stat-value">${escapeHtml(String(c.value))}</div>
      </article>`
      )
      .join("");
  }

  function renderGrid(list) {
    if (!list.length) {
      gridEl.innerHTML = `<div class="empty-state">
        <p>No machines yet.</p>
        <p class="empty-hint">Add a PC, enable RDP or install free RustDesk + Tailscale for access from anywhere.</p>
        <button type="button" class="btn btn-primary" id="empty-add">Add machine</button>
      </div>`;
      gridEl.querySelector("#empty-add")?.addEventListener("click", async () => {
        await window.RemoteHubHologram.play({ label: "Initialize new machine" });
        openEditor(null);
      });
      return;
    }
    gridEl.innerHTML = list
      .map((m) => {
        const sel = m.id === selectedId ? " selected" : "";
        const fav = m.favorite ? "★" : "☆";
        const addr =
          m.connectionType === "rustdesk"
            ? `ID ${escapeHtml(m.rustdeskId || "—")}`
            : escapeHtml(m.host || "—");
        return `
        <article class="machine-card${sel}" data-id="${escapeHtml(m.id)}" tabindex="0">
          <header class="machine-card-head">
            <span class="status-dot ${statusMap[m.id]?.online ? "on" : "off"}"></span>
            <h3>${escapeHtml(m.name)}</h3>
            <button type="button" class="fav-btn" data-fav="${escapeHtml(m.id)}" title="Favorite">${fav}</button>
          </header>
          <p class="machine-group">${escapeHtml(m.group)} · ${escapeHtml(typeLabel(m.connectionType))}</p>
          <p class="machine-host mono">${addr}</p>
          <footer class="machine-card-foot">
            ${statusBadge(m)}
            <button type="button" class="btn btn-primary btn-sm" data-connect="${escapeHtml(m.id)}">Connect</button>
          </footer>
        </article>`;
      })
      .join("");
    gridEl.querySelectorAll(".machine-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-connect]") || e.target.closest("[data-fav]")) return;
        openEditor(card.dataset.id);
      });
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter") openEditor(card.dataset.id);
      });
    });
    gridEl.querySelectorAll("[data-connect]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        connect(btn.dataset.connect);
      });
    });
    gridEl.querySelectorAll("[data-fav]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFavorite(btn.dataset.fav);
      });
    });
  }

  function renderTable(list) {
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-cell">No machines</td></tr>`;
      return;
    }
    tbody.innerHTML = list
      .map(
        (m) => `<tr data-id="${escapeHtml(m.id)}" class="${m.id === selectedId ? "selected" : ""}">
        <td>${statusBadge(m)}</td>
        <td class="process-cell">${escapeHtml(m.name)}</td>
        <td>${escapeHtml(m.group)}</td>
        <td>${escapeHtml(typeLabel(m.connectionType))}</td>
        <td class="mono">${escapeHtml(m.connectionType === "rustdesk" ? m.rustdeskId : m.host)}</td>
        <td><button type="button" class="btn btn-primary btn-sm" data-connect="${escapeHtml(m.id)}">Connect</button></td>
      </tr>`
      )
      .join("");
    tbody.querySelectorAll("tr[data-id]").forEach((row) => {
      row.addEventListener("click", (e) => {
        if (e.target.closest("[data-connect]")) return;
        openEditor(row.dataset.id);
      });
    });
    tbody.querySelectorAll("[data-connect]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        connect(btn.dataset.connect);
      });
    });
  }

  function refreshFilters() {
    const gs = groups();
    const cur = groupFilter.value;
    groupFilter.innerHTML =
      `<option value="all">All groups</option>` +
      gs.map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");
    if ([...groupFilter.options].some((o) => o.value === cur)) groupFilter.value = cur;
  }

  function render() {
    const list = filtered();
    refreshFilters();
    renderStats();
    renderGrid(list);
    renderTable(list);
  }

  async function load() {
    const res = await invoke("storage.load");
    machines = res.data?.machines || [];
    render();
  }

  async function save() {
    const res = await invoke("storage.load");
    const data = res.data || { machines: [], settings: {} };
    data.machines = machines;
    await invoke("storage.save", { data });
  }

  async function checkStatus() {
    const res = await invoke("machines.check");
    machines = res.machines || machines;
    statusMap = Object.fromEntries((res.statuses || []).map((s) => [s.id, s]));
    lastScanEl.textContent = res.scannedAt
      ? `Last check: ${new Date(res.scannedAt).toLocaleTimeString()}`
      : "—";
    render();
  }

  async function connectWithMode(id, mode) {
    const machine = machines.find((m) => m.id === id);
    const label = machine ? `Linking · ${machine.name}` : "Establishing remote link";
    try {
      await window.RemoteHubHologram.run(label, async () => {
        const res = await invoke("connect", { id, mode });
        if (res?.ok) {
          lastScanEl.textContent = `Launched ${res.mode || mode} · ${new Date().toLocaleTimeString()}`;
        }
        return res;
      });
    } catch (err) {
      alert(err.message || "Connect failed");
    }
  }

  async function connect(id) {
    const machine = machines.find((m) => m.id === id);
    await connectWithMode(id, machine?.connectionType || "rdp");
  }

  async function toggleFavorite(id) {
    const m = machines.find((x) => x.id === id);
    if (!m) return;
    m.favorite = !m.favorite;
    await save();
    render();
  }

  function fieldHtml(m) {
    const type = m.connectionType || "rdp";
    const fields = {
      rdp: `
        <label><span>Host / IP</span><input type="text" id="ed-host" value="${escapeHtml(m.host)}" placeholder="192.168.1.10 or 100.x.x.x" /></label>
        <label><span>Windows username</span><input type="text" id="ed-rdp-user" value="${escapeHtml(m.rdpUser)}" placeholder="DESKTOP\\User" /></label>
        <label><span>RDP port</span><input type="number" id="ed-rdp-port" value="${m.rdpPort || 3389}" min="1" max="65535" /></label>`,
      ssh: `
        <label><span>Host / IP</span><input type="text" id="ed-host" value="${escapeHtml(m.host)}" /></label>
        <label><span>SSH user</span><input type="text" id="ed-ssh-user" value="${escapeHtml(m.sshUser)}" placeholder="Administrator" /></label>
        <label><span>SSH port</span><input type="number" id="ed-ssh-port" value="${m.sshPort || 22}" min="1" max="65535" /></label>`,
      rustdesk: `
        <label><span>RustDesk ID (optional app)</span><input type="text" id="ed-rustdesk-id" value="${escapeHtml(m.rustdeskId)}" placeholder="123 456 789" /></label>
        <label><span>Host (for ping)</span><input type="text" id="ed-host" value="${escapeHtml(m.host)}" placeholder="optional" /></label>`,
      psremoting: `
        <label><span>Computer name / IP</span><input type="text" id="ed-host" value="${escapeHtml(m.host)}" /></label>
        <label><span>Username (optional)</span><input type="text" id="ed-ssh-user" value="${escapeHtml(m.psUser || m.rdpUser)}" /></label>`,
      explorer: `
        <label><span>Host / IP</span><input type="text" id="ed-host" value="${escapeHtml(m.host)}" placeholder="PC name or IP" /></label>`,
      custom: `
        <label><span>Custom command</span><input type="text" id="ed-custom" value="${escapeHtml(m.customCommand)}" placeholder="mstsc /v:{host}" /></label>
        <p class="field-hint">Placeholders: {host} {user} {port} {rustdeskId}</p>`,
    };
    const wol = `
      <fieldset class="fieldset-wol">
        <legend>Wake-on-LAN (optional)</legend>
        <label><span>MAC address</span><input type="text" id="ed-mac" value="${escapeHtml(m.macAddress)}" placeholder="AA:BB:CC:DD:EE:FF" /></label>
      </fieldset>`;
    const agent = `
      <fieldset class="fieldset-wol">
        <legend>Remote Agent</legend>
        <label><span>Agent token</span><input type="password" id="ed-agent-token" value="${escapeHtml(m.agentToken || "")}" placeholder="From install.ps1 on target" autocomplete="off" spellcheck="false" /></label>
        <p class="field-hint">Random token created by install.ps1: required for Control.</p>
      </fieldset>`;
    return (fields[type] || fields.rdp) + wol + agent;
  }

  function openEditor(id) {
    const ui = appUi;
    if (!ui?.shell || !ui.detailPanel) {
      console.error("Remote Hub: UI not ready");
      return;
    }
    selectedId = id;
    const existing = id ? machines.find((m) => m.id === id) : null;
    draft = existing
      ? { ...existing }
      : {
          id: uid(),
          name: "",
          group: "General",
          host: "",
          connectionType: "rdp",
          rdpPort: 3389,
          rdpUser: "",
          sshUser: "",
          sshPort: 22,
          rustdeskId: "",
          macAddress: "",
          psUser: "",
          customCommand: "",
          agentToken: "",
          notes: "",
          favorite: false,
          tags: [],
        };

    ui.shell.classList.add("detail-open");
    ui.detailPanel.classList.remove("hidden");
    ui.detailTitle.textContent = existing ? `Edit · ${existing.name}` : "Add machine";
    const typeOptions = CONNECTION_TYPES.map(
      (t) =>
        `<option value="${t.id}" ${draft.connectionType === t.id ? "selected" : ""}>${escapeHtml(t.label)}</option>`
    ).join("");
    const st = statusMap[draft.id];
    const quickBtns = QUICK_ACTIONS.map(
      (a) =>
        `<button type="button" class="btn btn-ghost btn-sm quick-action" data-mode="${a.id}" title="${escapeHtml(a.label)}">${a.icon} ${escapeHtml(a.label)}</button>`
    ).join("");

    ui.detailBody.innerHTML = `
      ${existing && st ? `<div class="detail-status">${statusBadge(draft)} <span class="muted">Checked ${formatTime(draft.lastChecked)}</span></div>` : ""}
      <div class="quick-actions-bar">${quickBtns}
        ${draft.macAddress || existing?.macAddress ? `<button type="button" class="btn btn-ghost btn-sm" id="ed-wake">⏻ Wake</button>` : ""}
        <button type="button" class="btn btn-ghost btn-sm" id="ed-copy-ip">Copy IP</button>
      </div>
      <form class="machine-form" id="machine-form">
        <label><span>Name</span><input type="text" id="ed-name" value="${escapeHtml(draft.name)}" required /></label>
        <label><span>Group</span><input type="text" id="ed-group" value="${escapeHtml(draft.group)}" list="group-list" /></label>
        <datalist id="group-list">${groups().map((g) => `<option value="${escapeHtml(g)}"></option>`).join("")}</datalist>
        <label><span>Connection</span><select id="ed-type">${typeOptions}</select></label>
        <div id="ed-type-fields">${fieldHtml(draft)}</div>
        <label><span>Notes</span><textarea id="ed-notes" rows="3">${escapeHtml(draft.notes)}</textarea></label>
        <label class="check-row"><input type="checkbox" id="ed-favorite" ${draft.favorite ? "checked" : ""} /> Favorite</label>
        <div class="detail-actions">
          <button type="submit" class="btn btn-primary">Save</button>
          ${existing ? `<button type="button" class="btn btn-danger" id="ed-delete">Delete</button>` : ""}
          <button type="button" class="btn" id="ed-connect">Connect now</button>
        </div>
      </form>`;
    ui.detailBody.querySelectorAll(".quick-action").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await saveFromForm();
        const mode = btn.dataset.mode;
        if (mode === "control") {
          const host = draft.host;
          window.RemoteHubControl?.open({
            host,
            id: draft.id,
            user: draft.psUser || draft.rdpUser || "",
            agentToken: draft.agentToken || "",
          });
          return;
        }
        if (mode === "view") {
          const host = draft.host;
          const user = draft.psUser || draft.rdpUser || "";
          window.RemoteHubViewer?.open({ host, user });
          return;
        }
        await connectWithMode(draft.id, mode);
      });
    });

    ui.detailBody.querySelector("#ed-wake")?.addEventListener("click", async () => {
      await saveFromForm();
      const mac = draft.macAddress || ui.detailBody.querySelector("#ed-mac")?.value;
      try {
        const res = await invoke("wol.wake", { mac });
        alert(res.message || "Wake packet sent");
      } catch (err) {
        alert(err.message);
      }
    });

    ui.detailBody.querySelector("#ed-copy-ip")?.addEventListener("click", async () => {
      const host = ui.detailBody.querySelector("#ed-host")?.value || draft.host;
      await invoke("clipboard.copy", { text: host });
    });

    const typeEl = ui.detailBody.querySelector("#ed-type");
    const fieldsWrap = ui.detailBody.querySelector("#ed-type-fields");
    typeEl.addEventListener("change", () => {
      draft.connectionType = typeEl.value;
      fieldsWrap.innerHTML = fieldHtml(draft);
    });

    ui.detailBody.querySelector("#machine-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      await window.RemoteHubHologram.run("Saving machine profile", async () => {
        await saveFromForm();
        closeEditor();
      });
    });

    ui.detailBody.querySelector("#ed-connect")?.addEventListener("click", async () => {
      await saveFromForm();
      await connect(draft.id);
    });

    ui.detailBody.querySelector("#ed-delete")?.addEventListener("click", async () => {
      if (!confirm("Delete this machine?")) return;
      await window.RemoteHubHologram.run("Removing machine", async () => {
        machines = machines.filter((m) => m.id !== draft.id);
        await save();
        closeEditor();
      });
    });

    ui.detailBody.querySelector("#ed-name")?.focus();
  }

  async function saveFromForm() {
    const root = document.getElementById("machine-form");
    if (!root) return;
    draft.name = root.querySelector("#ed-name").value.trim();
    draft.group = root.querySelector("#ed-group").value.trim() || "General";
    draft.connectionType = root.querySelector("#ed-type").value;
    draft.notes = root.querySelector("#ed-notes").value.trim();
    draft.favorite = root.querySelector("#ed-favorite").checked;

    const hostEl = root.querySelector("#ed-host");
    if (hostEl) draft.host = hostEl.value.trim();
    const rdpUser = root.querySelector("#ed-rdp-user");
    if (rdpUser) draft.rdpUser = rdpUser.value.trim();
    const rdpPort = root.querySelector("#ed-rdp-port");
    if (rdpPort) draft.rdpPort = parseInt(rdpPort.value, 10) || 3389;
    const sshUser = root.querySelector("#ed-ssh-user");
    if (sshUser) draft.sshUser = sshUser.value.trim();
    const sshPort = root.querySelector("#ed-ssh-port");
    if (sshPort) draft.sshPort = parseInt(sshPort.value, 10) || 22;
    const rdId = root.querySelector("#ed-rustdesk-id");
    if (rdId) draft.rustdeskId = rdId.value.trim().replace(/\s/g, "");
    const mac = root.querySelector("#ed-mac");
    if (mac) draft.macAddress = mac.value.trim();
    const custom = root.querySelector("#ed-custom");
    if (custom) draft.customCommand = custom.value.trim();
    const agentToken = root.querySelector("#ed-agent-token");
    if (agentToken) draft.agentToken = agentToken.value.trim();

    const idx = machines.findIndex((m) => m.id === draft.id);
    if (idx >= 0) machines[idx] = { ...draft };
    else machines.push({ ...draft });
    await save();
    render();
  }

  function closeEditor() {
    const ui = appUi;
    if (!ui) return;
    selectedId = null;
    draft = null;
    ui.shell.classList.remove("detail-open");
    ui.detailPanel.classList.add("hidden");
    render();
  }

  async function scan() {
    await load();
    try {
      await checkStatus();
    } catch (err) {
      if (lastScanEl) lastScanEl.textContent = err.message || "Status check failed";
    }
  }

  function bind(ui) {
    appUi = ui;
    searchInput?.addEventListener("input", render);
    groupFilter?.addEventListener("change", render);
    favOnly?.addEventListener("change", render);
    ui.detailClose?.addEventListener("click", () => closeEditor());
  }

  return { id: "machines", page, scan, bind, openEditor };
})();