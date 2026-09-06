window.DriftPages = window.DriftPages || {};

window.DriftPages.zones = (function () {
  const { escapeHtml, invoke, formatWhen } = window.Drift;

  const page = document.getElementById("page-zones");

  let zones = [];
  let settings = {};
  let pendingFolder = null;

  function hideAddPanel() {
    pendingFolder = null;
    page.querySelector("#zone-add-panel")?.classList.add("hidden");
  }

  function showAddPanel(folderPath) {
    pendingFolder = folderPath;
    const panel = page.querySelector("#zone-add-panel");
    const pathEl = page.querySelector("#zone-add-path");
    const labelInput = page.querySelector("#zone-add-label");
    if (!panel || !pathEl || !labelInput) return;
    pathEl.textContent = folderPath;
    labelInput.value = folderPath.split(/[/\\]/).pop() || "Watch zone";
    panel.classList.remove("hidden");
    labelInput.focus();
    labelInput.select();
  }

  async function confirmAddZone() {
    if (!pendingFolder) return;
    const labelInput = page.querySelector("#zone-add-label");
    const label = labelInput?.value?.trim() || pendingFolder.split(/[/\\]/).pop() || "Watch zone";
    try {
      await invoke("zones.add", { path: pendingFolder, label });
      hideAddPanel();
      await scan();
      if (confirm("Run first scan now? (creates baseline snapshot)")) {
        await window.DriftApp?.runScan?.();
      }
    } catch (err) {
      alert(err.message || "Could not add watch zone");
    }
  }

  function render() {
    page.innerHTML = `
      <div class="stats-row zone-stats" id="zone-stats"></div>
      <div class="toolbar">
        <button type="button" class="btn btn-primary" id="btn-add-zone">+ Add watch folder</button>
        <button type="button" class="btn btn-ghost btn-sm" id="btn-scan-zones">↻ Scan all zones</button>
      </div>
      <div class="zone-list" id="zone-list"></div>
      <section class="settings-panel">
        <h3>Settings</h3>
        <label class="check-row">
          <input type="checkbox" id="set-paused" ${settings.paused ? "checked" : ""} />
          Pause tracking (no scans)
        </label>
        <label class="check-row">
          <input type="checkbox" id="set-git" ${settings.trackGit !== false ? "checked" : ""} />
          Track Git commits in watched repos
        </label>
        <label class="check-row">
          <input type="checkbox" id="set-auto-open" ${settings.autoScanOnOpen !== false ? "checked" : ""} />
          Auto-scan when Drift opens
        </label>
        <label class="field-row">
          <span>Repeat scan every</span>
          <select id="set-auto-interval" class="select-sm">
            <option value="0" ${!settings.autoScanMinutes ? "selected" : ""}>Off</option>
            <option value="15" ${settings.autoScanMinutes === 15 ? "selected" : ""}>15 minutes</option>
            <option value="30" ${settings.autoScanMinutes === 30 ? "selected" : ""}>30 minutes</option>
            <option value="60" ${settings.autoScanMinutes === 60 || settings.autoScanMinutes === undefined ? "selected" : ""}>1 hour</option>
            <option value="120" ${settings.autoScanMinutes === 120 ? "selected" : ""}>2 hours</option>
          </select>
        </label>
        <p class="settings-hint">Scans run while Drift is open. Minimum 5 minutes between scans.</p>
        <div class="settings-actions">
          <button type="button" class="btn btn-ghost btn-sm" id="btn-clear-old">Clear events older than 30 days</button>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-export">Export data</button>
        </div>
      </section>
      <div class="zone-add-panel hidden" id="zone-add-panel">
        <h3>Add watch folder</h3>
        <p class="muted" id="zone-add-path"></p>
        <label class="field-row">
          <span>Label</span>
          <input type="text" id="zone-add-label" class="search" placeholder="Folder name" />
        </label>
        <div class="zone-add-actions">
          <button type="button" class="btn btn-primary btn-sm" id="zone-add-save">Add zone</button>
          <button type="button" class="btn btn-ghost btn-sm" id="zone-add-cancel">Cancel</button>
        </div>
      </div>`;

    const statsEl = page.querySelector("#zone-stats");
    statsEl.innerHTML = `
      <div class="stat-card"><span class="stat-val">${zones.length}</span><span class="stat-label">Zones</span></div>
      <div class="stat-card"><span class="stat-val">${zones.filter((z) => z.enabled).length}</span><span class="stat-label">Active</span></div>
      <div class="stat-card"><span class="stat-val">${settings.paused ? "Off" : "On"}</span><span class="stat-label">Tracking</span></div>`;

    const list = page.querySelector("#zone-list");
    if (!zones.length) {
      list.innerHTML = `<div class="empty-state"><p>No watch zones yet.</p><p class="muted">Add folders you want Drift to monitor for changes.</p></div>`;
    } else {
      list.innerHTML = zones
        .map(
          (z) => `<article class="zone-card ${z.enabled ? "" : "zone-card--off"}">
            <div class="zone-card-head">
              <div>
                <h3>${escapeHtml(z.label)}</h3>
                <code class="path-code">${escapeHtml(z.path)}</code>
              </div>
              <label class="toggle">
                <input type="checkbox" class="zone-toggle" data-id="${escapeHtml(z.id)}" ${z.enabled ? "checked" : ""} />
                <span>${z.enabled ? "On" : "Off"}</span>
              </label>
            </div>
            <div class="zone-meta">
              <span>${(z.entryCount || 0).toLocaleString()} paths indexed</span>
              <span>${z.lastScannedAt ? "Last scan: " + formatWhen(z.lastScannedAt) : "Never scanned"}</span>
            </div>
            <div class="zone-actions">
              <button type="button" class="btn btn-ghost btn-sm zone-scan" data-id="${escapeHtml(z.id)}">Scan</button>
              <button type="button" class="btn btn-ghost btn-sm zone-open" data-path="${escapeHtml(z.path)}">Open</button>
              <button type="button" class="btn btn-ghost btn-sm zone-remove" data-id="${escapeHtml(z.id)}">Remove</button>
            </div>
          </article>`
        )
        .join("");
    }

    page.querySelector("#btn-add-zone")?.addEventListener("click", addZone);
    page.querySelector("#zone-add-save")?.addEventListener("click", confirmAddZone);
    page.querySelector("#zone-add-cancel")?.addEventListener("click", hideAddPanel);
    page.querySelector("#btn-scan-zones")?.addEventListener("click", () => window.DriftApp?.runScan?.());
    page.querySelector("#set-paused")?.addEventListener("change", async (e) => {
      const res = await invoke("settings.update", { paused: e.target.checked });
      window.DriftApp?.applySettings?.(res.settings);
      await scan();
    });
    page.querySelector("#set-git")?.addEventListener("change", async (e) => {
      await invoke("settings.update", { trackGit: e.target.checked });
    });
    page.querySelector("#set-auto-open")?.addEventListener("change", async (e) => {
      const res = await invoke("settings.update", { autoScanOnOpen: e.target.checked });
      window.DriftApp?.applySettings?.(res.settings);
      await scan();
    });
    page.querySelector("#set-auto-interval")?.addEventListener("change", async (e) => {
      const res = await invoke("settings.update", { autoScanMinutes: parseInt(e.target.value, 10) || 0 });
      window.DriftApp?.applySettings?.(res.settings);
      await scan();
    });
    page.querySelector("#btn-clear-old")?.addEventListener("click", async () => {
      if (!confirm("Remove events older than 30 days?")) return;
      await invoke("events.clear", { olderThanDays: 30 });
      await window.DriftPages.activity?.scan?.();
      alert("Old events cleared.");
    });
    page.querySelector("#btn-export")?.addEventListener("click", async () => {
      const res = await invoke("data.export");
      await invoke("clipboard.copy", { text: res.json });
      alert("Drift data copied to clipboard.");
    });

    page.querySelectorAll(".zone-toggle").forEach((input) => {
      input.addEventListener("change", async () => {
        await invoke("zones.toggle", { id: input.dataset.id, enabled: input.checked });
        await scan();
      });
    });
    page.querySelectorAll(".zone-scan").forEach((btn) => {
      btn.addEventListener("click", async () => {
        btn.textContent = "…";
        try {
          await invoke("scan.run", { zoneId: btn.dataset.id });
          await window.DriftPages.activity?.scan?.();
          await scan();
        } catch (err) {
          alert(err.message);
        }
      });
    });
    page.querySelectorAll(".zone-open").forEach((btn) => {
      btn.addEventListener("click", () => invoke("folder.open", { path: btn.dataset.path }));
    });
    page.querySelectorAll(".zone-remove").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Remove this watch zone and its events?")) return;
        await invoke("zones.remove", { id: btn.dataset.id });
        await window.DriftPages.activity?.scan?.();
        await scan();
      });
    });
  }

  async function addZone() {
    hideAddPanel();
    try {
      const res = await invoke("folder.pick", { title: "Select folder to watch" });
      if (!res.path) return;
      const duplicate = zones.find((z) => z.path.toLowerCase() === res.path.toLowerCase());
      if (duplicate) {
        alert(`"${duplicate.label}" already watches this folder.`);
        return;
      }
      showAddPanel(res.path);
    } catch (err) {
      alert(err.message || "Could not open folder picker");
    }
  }

  async function scan() {
    try {
      const res = await invoke("zones.list");
      zones = res.zones || [];
      settings = res.settings || {};
      render();
    } catch (err) {
      page.innerHTML = `<div class="empty-state error"><p>${escapeHtml(err.message)}</p></div>`;
    }
  }

  function bind() {}

  return { id: "zones", page, scan, bind };
})();
