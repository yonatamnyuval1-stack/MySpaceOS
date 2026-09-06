(() => {
  const PAGES = ["status", "apps", "large-files", "cleanup", "about"];

  const state = {
    page: "status",
    status: null,
    apps: [],
    drives: [],
    cleanup: [],
    cleanupHistory: [],
    largeFiles: [],
    scanning: false,
    busy: false,
  };

  const el = {
    nav: document.getElementById("main-nav"),
    sidebarMeta: document.getElementById("sidebar-meta"),
    navAppCount: document.getElementById("nav-app-count"),
    navCleanupCount: document.getElementById("nav-cleanup-count"),
    statusHero: document.getElementById("status-hero"),
    statusEyebrow: document.getElementById("status-eyebrow"),
    statusTitle: document.getElementById("status-title"),
    statusPrimary: document.getElementById("status-primary"),
    statusDesc: document.getElementById("status-desc"),
    statusMetaRow: document.getElementById("status-meta-row"),
    driveList: document.getElementById("drive-list"),
    drivesEmpty: document.getElementById("drives-empty"),
    appsStats: document.getElementById("apps-stats"),
    appList: document.getElementById("app-list"),
    appsEmpty: document.getElementById("apps-empty"),
    largeDrive: document.getElementById("large-drive"),
    largeBody: document.getElementById("large-body"),
    largeScanNote: document.getElementById("large-scan-note"),
    cleanupStats: document.getElementById("cleanup-stats"),
    cleanupList: document.getElementById("cleanup-list"),
    cleanupEmpty: document.getElementById("cleanup-empty"),
    cleanupHistory: document.getElementById("cleanup-history"),
    cleanupHistoryEmpty: document.getElementById("cleanup-history-empty"),
    aboutMeta: document.getElementById("about-meta"),
    btnRefresh: document.getElementById("btn-refresh"),
    btnFolder: document.getElementById("btn-folder"),
    btnWinSettings: document.getElementById("btn-win-settings"),
    btnRefreshApps: document.getElementById("btn-refresh-apps"),
    btnScanLarge: document.getElementById("btn-scan-large"),
    btnCancelScan: document.getElementById("btn-cancel-scan"),
    btnRefreshCleanup: document.getElementById("btn-refresh-cleanup"),
  };

  function api() {
    return window.myApp?.storage;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatTime(d) {
    if (!d) return "";
    try {
      return new Date(d).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return String(d);
    }
  }

  function setPage(page) {
    if (!PAGES.includes(page)) page = "status";
    state.page = page;
    document.querySelectorAll(".view").forEach((v) => {
      v.classList.toggle("hidden", v.id !== `view-${page}`);
    });
    el.nav?.querySelectorAll("[data-page]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.page === page);
    });
    if (page === "status") paintStatus();
    if (page === "apps") void loadApps();
    if (page === "cleanup") void loadCleanup();
    if (page === "about") paintAbout();
  }

  function paintChrome() {
    const ud = state.status?.userData || {};
    if (el.sidebarMeta) {
      el.sidebarMeta.textContent = ud.sizeLabel
        ? `${ud.sizeLabel} · userData`
        : "Storage service";
    }
    const nApps = state.apps.length || state.status?.userData?.appCount || 0;
    if (el.navAppCount) {
      el.navAppCount.textContent = String(nApps);
      el.navAppCount.classList.toggle("hidden", nApps <= 0);
    }
    const nClean = state.cleanup.length;
    if (el.navCleanupCount) {
      el.navCleanupCount.textContent = String(nClean);
      el.navCleanupCount.classList.toggle("hidden", nClean <= 0);
    }
  }

  function usageBar(pct, warn) {
    const p = Math.min(100, Math.max(0, Number(pct) || 0));
    const cls = p >= 90 ? "is-critical" : p >= 75 ? "is-warn" : "";
    return `<div class="usage-bar ${cls}" aria-hidden="true"><span style="width:${p}%"></span></div>`;
  }

  function paintStatus() {
    const s = state.status || {};
    const ud = s.userData || {};
    const primary = s.primaryDrive;

    if (el.statusEyebrow) el.statusEyebrow.textContent = s.hostname || "This PC";
    if (el.statusTitle) {
      el.statusTitle.textContent = ud.sizeLabel ? `${ud.sizeLabel} My Space data` : "My Space data";
    }
    if (el.statusPrimary) {
      el.statusPrimary.textContent = primary
        ? `${primary.id} · ${primary.freeLabel} free of ${primary.sizeLabel}`
        : "Drive info unavailable";
    }
    if (el.statusDesc) {
      el.statusDesc.textContent = ud.path
        ? ud.path
        : "Could not read userData path.";
    }
    if (el.statusMetaRow) {
      const chips = [];
      if (ud.appCount) chips.push(`<span class="pill">${ud.appCount} apps tracked</span>`);
      if (s.driveSummary?.drives) {
        chips.push(`<span class="pill">${s.driveSummary.drives} drives</span>`);
      }
      if (s.driveSummary?.freeLabel) {
        chips.push(`<span class="pill ok">${escapeHtml(s.driveSummary.freeLabel)} free total</span>`);
      }
      if (s.scannedAt) {
        chips.push(`<span class="pill">Updated ${escapeHtml(formatTime(s.scannedAt))}</span>`);
      }
      el.statusMetaRow.innerHTML = chips.join("");
    }

    const drives = s.drives || state.drives || [];
    if (el.drivesEmpty) el.drivesEmpty.classList.toggle("hidden", drives.length > 0);
    if (!el.driveList) return;
    if (!drives.length) {
      el.driveList.innerHTML = "";
      return;
    }
    el.driveList.innerHTML = drives
      .map(
        (d) => `<article class="drive-card">
          <div class="drive-head">
            <div>
              <h3>${escapeHtml(d.id)} · ${escapeHtml(d.name || "Local Disk")}</h3>
              <p class="drive-meta">${escapeHtml(d.fileSystem || "—")} · ${escapeHtml(d.driveTypeLabel || "")}</p>
            </div>
            <span class="pill ${d.usagePercent >= 90 ? "bad" : d.usagePercent >= 75 ? "warn" : "ok"}">${d.usagePercent}% used</span>
          </div>
          ${usageBar(d.usagePercent, d.usagePercent >= 75)}
          <div class="drive-foot">
            <span>${escapeHtml(d.usedLabel)} used</span>
            <span>${escapeHtml(d.freeLabel)} free</span>
            <span>${escapeHtml(d.sizeLabel)} total</span>
          </div>
        </article>`
      )
      .join("");

    fillDriveSelect(drives);
  }

  function fillDriveSelect(drives) {
    if (!el.largeDrive) return;
    const current = el.largeDrive.value;
    el.largeDrive.replaceChildren();
    for (const d of drives) {
      const opt = document.createElement("option");
      opt.value = `${d.letter || d.id.replace(":", "")}:\\`;
      opt.textContent = `${d.id} (${d.freeLabel} free)`;
      el.largeDrive.appendChild(opt);
    }
    if (current) el.largeDrive.value = current;
  }

  function paintApps() {
    const list = state.apps || [];
    const total = list.reduce((s, a) => s + (a.bytes || 0), 0);
    if (el.appsStats) {
      el.appsStats.innerHTML = `
        <span class="stat-chip"><strong>${list.length}</strong> groups</span>
        <span class="stat-chip"><strong>${escapeHtml(formatBytesLabel(total))}</strong> total</span>`;
    }
    if (el.appsEmpty) el.appsEmpty.classList.toggle("hidden", list.length > 0);
    if (!el.appList) return;
    if (!list.length) {
      el.appList.innerHTML = "";
      return;
    }
    el.appList.innerHTML = list
      .map(
        (a) => `<article class="app-card">
          <div class="app-head">
            <div>
              <h3>${escapeHtml(a.name || a.appId)}</h3>
              <p class="app-id">${escapeHtml(a.appId)}</p>
            </div>
            <div class="app-size">
              <strong>${escapeHtml(a.sizeLabel)}</strong>
              <span>${a.percent}%</span>
            </div>
          </div>
          ${usageBar(a.percent)}
          ${
            a.files?.length
              ? `<ul class="app-files">${a.files
                  .slice(0, 5)
                  .map(
                    (f) =>
                      `<li><span>${escapeHtml(f.name)}</span><em>${escapeHtml(f.sizeLabel)}</em></li>`
                  )
                  .join("")}</ul>`
              : ""
          }
        </article>`
      )
      .join("");
  }

  function formatBytesLabel(n) {
    if (state.status?.userData?.sizeLabel && n === state.status.userData.bytes) {
      return state.status.userData.sizeLabel;
    }
    const v = Number(n) || 0;
    if (v < 1024) return `${v} B`;
    if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
    if (v < 1024 * 1024 * 1024) return `${(v / (1024 * 1024)).toFixed(1)} MB`;
    return `${(v / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  function paintLargeFiles(res) {
    const rows = state.largeFiles || [];
    if (el.largeScanNote) {
      el.largeScanNote.textContent = res?.scannedAt
        ? `Scanned ${formatTime(res.scannedAt)} · ${rows.length} files${res.cancelled ? " · cancelled" : ""}`
        : "Pick a drive and scan to find large files.";
    }
    if (!el.largeBody) return;
    if (!rows.length) {
      el.largeBody.innerHTML = `<tr><td colspan="4" class="muted">No large files found (or scan cancelled).</td></tr>`;
      return;
    }
    el.largeBody.innerHTML = rows
      .map(
        (f) => `<tr>
          <td>${escapeHtml(f.sizeLabel)}</td>
          <td class="proc-name">${escapeHtml(f.name)}</td>
          <td>${escapeHtml(f.path)}</td>
          <td><button type="button" class="btn btn-ghost btn-sm" data-reveal="${escapeHtml(f.path)}">Show</button></td>
        </tr>`
      )
      .join("");
    el.largeBody.querySelectorAll("[data-reveal]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const r = await api()?.reveal?.(btn.dataset.reveal);
        if (r?.ok === false) alert(r.error || "Could not reveal");
      });
    });
  }

  function paintCleanup() {
    const list = state.cleanup || [];
    const total = list.reduce((s, c) => s + (c.bytes || 0), 0);
    if (el.cleanupStats) {
      el.cleanupStats.innerHTML = `
        <span class="stat-chip"><strong>${list.length}</strong> items</span>
        <span class="stat-chip"><strong>${escapeHtml(formatBytesLabel(total))}</strong> reclaimable</span>`;
    }
    if (el.cleanupEmpty) el.cleanupEmpty.classList.toggle("hidden", list.length > 0);
    if (!el.cleanupList) return;
    if (!list.length) {
      el.cleanupList.innerHTML = "";
    } else {
      el.cleanupList.innerHTML = list
        .map(
          (c) => `<article class="history-card cleanup-card">
            <div class="history-head">
              <div>
                <h3>${escapeHtml(c.name)}</h3>
                <p class="history-path">${escapeHtml(c.description || c.category || "")}</p>
              </div>
              <span class="pill warn">${escapeHtml(c.sizeLabel)}</span>
            </div>
            <div class="history-actions">
              <button type="button" class="btn btn-ghost" data-reveal="${escapeHtml(c.path)}">Show</button>
              <button type="button" class="btn btn-primary" data-delete="${escapeHtml(c.path)}">Remove</button>
            </div>
          </article>`
        )
        .join("");
      el.cleanupList.querySelectorAll("[data-reveal]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          await api()?.reveal?.(btn.dataset.reveal);
        });
      });
      el.cleanupList.querySelectorAll("[data-delete]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          if (!confirm(`Remove ${btn.dataset.delete}?`)) return;
          btn.disabled = true;
          const r = await api()?.cleanupDelete?.({ path: btn.dataset.delete });
          if (r?.ok === false) alert(r.error || "Delete failed");
          else await loadCleanup();
          await refreshStatus();
        });
      });
    }

    const hist = state.cleanupHistory || [];
    if (el.cleanupHistoryEmpty) el.cleanupHistoryEmpty.classList.toggle("hidden", hist.length > 0);
    if (el.cleanupHistory) {
      el.cleanupHistory.innerHTML = hist
        .slice(0, 8)
        .map(
          (h) => `<article class="history-card">
            <div class="history-head">
              <div>
                <h3>${escapeHtml(h.name || "Removed")}</h3>
                <p class="history-path">${escapeHtml(h.path || "")}</p>
              </div>
              <span class="pill ok">${escapeHtml(h.freedLabel || "removed")}</span>
            </div>
            <div class="history-meta"><span>${escapeHtml(formatTime(h.at))}</span></div>
          </article>`
        )
        .join("");
    }
  }

  function paintAbout() {
    if (!el.aboutMeta) return;
    const ud = state.status?.userData || {};
    el.aboutMeta.textContent = [
      ud.path ? `userData: ${ud.path}` : null,
      ud.sizeLabel ? `Size: ${ud.sizeLabel}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  async function refreshStatus() {
    const res = await api()?.status?.();
    if (!res?.ok && res?.error) {
      alert(res.error);
      return;
    }
    state.status = res || null;
    state.drives = res?.drives || [];
    state.apps = res?.apps || [];
    paintStatus();
    paintChrome();
    if (state.page === "apps") paintApps();
    if (state.page === "about") paintAbout();
  }

  async function loadApps() {
    const res = await api()?.apps?.();
    state.apps = res?.apps || [];
    paintApps();
    paintChrome();
  }

  async function loadCleanup() {
    const res = await api()?.cleanup?.();
    state.cleanup = res?.candidates || [];
    state.cleanupHistory = res?.history || [];
    paintCleanup();
    paintChrome();
  }

  async function scanLarge() {
    if (state.scanning) return;
    state.scanning = true;
    if (el.btnScanLarge) el.btnScanLarge.disabled = true;
    if (el.largeBody) {
      el.largeBody.innerHTML = `<tr><td colspan="4" class="muted">Scanning… this may take a minute</td></tr>`;
    }
    try {
      const drive = el.largeDrive?.value || "C:\\";
      const res = await api()?.largeFiles?.({ path: drive });
      state.largeFiles = res?.largeFiles || [];
      paintLargeFiles(res);
    } finally {
      state.scanning = false;
      if (el.btnScanLarge) el.btnScanLarge.disabled = false;
    }
  }

  async function refresh() {
    await refreshStatus();
    if (state.page === "cleanup") await loadCleanup();
  }

  function bind() {
    el.nav?.querySelectorAll("[data-page]").forEach((btn) => {
      btn.addEventListener("click", () => setPage(btn.dataset.page));
    });
    el.btnRefresh?.addEventListener("click", () => void refresh());
    el.btnRefreshApps?.addEventListener("click", () => void loadApps());
    el.btnRefreshCleanup?.addEventListener("click", () => void loadCleanup());
    el.btnFolder?.addEventListener("click", async () => {
      const r = await api()?.path?.();
      if (r?.ok === false) alert(r.error || "Could not open folder");
    });
    el.btnWinSettings?.addEventListener("click", async () => {
      const r = await api()?.openSettings?.();
      if (r?.ok === false) alert(r.error || "Could not open settings");
    });
    el.btnScanLarge?.addEventListener("click", () => void scanLarge());
    el.btnCancelScan?.addEventListener("click", async () => {
      await api()?.cancel?.();
    });
  }

  function applyRoute(route) {
    const page = route?.page;
    if (PAGES.includes(page)) setPage(page);
  }

  window.__myspaceApplyRoute = applyRoute;
  window.StorageApp = { setPage, applyRoute };

  bind();
  setPage("status");
  void refresh();
})();
