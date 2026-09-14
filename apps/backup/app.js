(() => {
  const PAGES = ["status", "history", "about"];

  const state = {
    page: "status",
    status: null,
    history: [],
    busy: false,
  };

  const el = {
    nav: document.getElementById("main-nav"),
    sidebarMeta: document.getElementById("sidebar-meta"),
    navHistoryCount: document.getElementById("nav-history-count"),
    statusTitle: document.getElementById("status-title"),
    statusSize: document.getElementById("status-size"),
    statusDesc: document.getElementById("status-desc"),
    statusMetaRow: document.getElementById("status-meta-row"),
    pendingBanner: document.getElementById("pending-banner"),
    pendingBannerText: document.getElementById("pending-banner-text"),
    activityList: document.getElementById("activity-list"),
    activityEmpty: document.getElementById("activity-empty"),
    activitySub: document.getElementById("activity-sub"),
    historyList: document.getElementById("history-list"),
    historyEmpty: document.getElementById("history-empty"),
    historyFilter: document.getElementById("history-filter"),
    aboutMeta: document.getElementById("about-meta"),
    btnExport: document.getElementById("btn-export"),
    btnImport: document.getElementById("btn-import"),
    btnFolder: document.getElementById("btn-folder"),
    btnRefresh: document.getElementById("btn-refresh"),
    btnRefreshHistory: document.getElementById("btn-refresh-history"),
  };

  function api() {
    return window.myApp?.backup;
  }

  function tt(key, vars) {
    const fn = window.MySpaceI18n?.t;
    return typeof fn === "function" ? fn(key, vars) : key;
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
        year: "numeric",
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
    if (page === "status") {
      paintStatus();
      paintActivity();
    }
    if (page === "history") void loadHistory();
    if (page === "about") paintAbout();
  }

  function paintChrome() {
    const s = state.status || {};
    if (el.sidebarMeta) {
      el.sidebarMeta.textContent = s.sizeLabel
        ? `${s.sizeLabel} on disk`
        : "My Space backup";
    }
    const n = state.history.length || s.historyCount || 0;
    if (el.navHistoryCount) {
      el.navHistoryCount.textContent = String(n);
      el.navHistoryCount.classList.toggle("hidden", n <= 0);
    }
  }

  function paintStatus() {
    const s = state.status || {};
    if (el.statusTitle) el.statusTitle.textContent = tt("service.backup.mySpaceData");
    if (el.statusSize) el.statusSize.textContent = s.sizeLabel ? s.sizeLabel : "—";
    if (el.statusDesc) {
      el.statusDesc.textContent = s.path
        ? s.path
        : "Could not read the user data folder.";
    }
    if (el.statusMetaRow) {
      const chips = [];
      if (s.appVersion) chips.push(`<span class="pill mono">App ${escapeHtml(s.appVersion)}</span>`);
      if (s.lastExportAt) {
        chips.push(
          `<span class="pill ok">Exported ${escapeHtml(formatTime(s.lastExportAt))}</span>`
        );
      }
      if (s.lastRestoreAt) {
        chips.push(
          `<span class="pill">Restored ${escapeHtml(formatTime(s.lastRestoreAt))}</span>`
        );
      }
      if (s.pendingRestore) chips.push(`<span class="pill warn">restore pending</span>`);
      el.statusMetaRow.innerHTML = chips.join("");
    }
    if (el.pendingBanner) {
      el.pendingBanner.classList.toggle("hidden", !s.pendingRestore);
      if (el.pendingBannerText && s.pendingRestore) {
        el.pendingBannerText.textContent = s.pendingSource
          ? tt("service.backup.restorePendingStaged", { source: s.pendingSource })
          : tt("service.backup.restorePendingText");
      }
    }
  }

  function entryCard(e, { reveal } = {}) {
    const kind = e.kind || "export";
    const pathLabel = e.path || "—";
    const size = e.sizeLabel || "";
    return `<article class="history-card">
      <div class="history-head">
        <div>
          <h3>${kind === "restore" ? escapeHtml(tt("service.backup.restore")) : escapeHtml(tt("service.backup.export"))}</h3>
          <p class="history-path">${escapeHtml(pathLabel)}</p>
        </div>
        <span class="pill ${kind === "restore" ? "warn" : "ok"}">${escapeHtml(kind)}</span>
      </div>
      <div class="history-meta">
        <span>${escapeHtml(formatTime(e.at))}</span>
        ${size ? `<span>${escapeHtml(size)}</span>` : ""}
        ${e.note ? `<span>${escapeHtml(e.note)}</span>` : ""}
      </div>
      ${
        reveal && e.path
          ? `<div class="history-actions">
              <button type="button" class="btn btn-ghost" data-reveal="${escapeHtml(
                e.path
              )}">${escapeHtml(tt("service.backup.showInFolder"))}</button>
            </div>`
          : ""
      }
    </article>`;
  }

  function paintActivity() {
    const list = (state.history || []).slice(0, 4);
    if (el.activitySub) {
      el.activitySub.textContent = list.length
        ? tt("service.backup.activitySubCount", { count: state.history.length })
        : tt("service.backup.activitySubDefault");
    }
    if (el.activityEmpty) el.activityEmpty.classList.toggle("hidden", list.length > 0);
    if (!el.activityList) return;
    el.activityList.innerHTML = list.map((e) => entryCard(e)).join("");
  }

  function paintHistory() {
    const filter = el.historyFilter?.value || "all";
    const list = (state.history || []).filter((e) => {
      if (filter === "all") return true;
      return e.kind === filter;
    });
    if (el.historyEmpty) el.historyEmpty.classList.toggle("hidden", list.length > 0);
    if (!el.historyList) return;
    if (!list.length) {
      el.historyList.innerHTML = "";
      return;
    }
    el.historyList.innerHTML = list.map((e) => entryCard(e, { reveal: true })).join("");
    el.historyList.querySelectorAll("[data-reveal]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const res = await api()?.reveal?.(btn.dataset.reveal);
        if (res?.ok === false) alert(res.error || "Could not reveal file");
      });
    });
  }

  function paintAbout() {
    if (!el.aboutMeta) return;
    const s = state.status || {};
    el.aboutMeta.textContent = [
      s.path ? `Data: ${s.path}` : null,
      s.configPath ? `Config: ${s.configPath}` : null,
      s.sizeLabel ? `Size: ${s.sizeLabel}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  async function loadHistory() {
    const filter = el.historyFilter?.value || "all";
    const res = await api()?.history?.({ kind: filter === "all" ? "" : filter });
    state.history = res?.entries || [];
    paintHistory();
    paintChrome();
  }

  async function refresh() {
    const [status, hist] = await Promise.all([
      api()?.status?.() || {},
      api()?.history?.({}) || {},
    ]);
    state.status = status || null;
    state.history = hist?.entries || [];
    paintChrome();
    if (state.page === "status") {
      paintStatus();
      paintActivity();
    }
    if (state.page === "history") paintHistory();
    if (state.page === "about") paintAbout();
  }

  function setBusy(busy) {
    state.busy = busy;
    [el.btnExport, el.btnImport, el.btnFolder, el.btnRefresh].forEach((b) => {
      if (b) b.disabled = !!busy;
    });
  }

  function bind() {
    el.nav?.querySelectorAll("[data-page]").forEach((btn) => {
      btn.addEventListener("click", () => setPage(btn.dataset.page));
    });
    el.btnRefresh?.addEventListener("click", () => void refresh());
    el.btnRefreshHistory?.addEventListener("click", () => void loadHistory());
    el.historyFilter?.addEventListener("change", () => void loadHistory());
    el.btnFolder?.addEventListener("click", async () => {
      const res = await api()?.path?.();
      if (res?.ok === false) alert(res.error || "Could not open folder");
    });
    el.btnExport?.addEventListener("click", async () => {
      if (state.busy) return;
      setBusy(true);
      try {
        const res = await api()?.export?.();
        if (res?.cancelled) return;
        if (res?.ok === false) alert(res.error || "Export failed");
        else if (res?.ok) alert(res.message || "Backup exported");
        await refresh();
      } finally {
        setBusy(false);
      }
    });
    el.btnImport?.addEventListener("click", async () => {
      if (state.busy) return;
      if (
        !confirm(
          "Restore will replace current My Space data with the zip and restart. Continue?"
        )
      ) {
        return;
      }
      setBusy(true);
      try {
        const res = await api()?.import?.();
        if (res?.cancelled) return;
        if (res?.ok === false) {
          alert(res.error || "Restore failed");
          setBusy(false);
          return;
        }
        // Relaunch on success — keep busy state
        if (el.btnImport) el.btnImport.textContent = tt("service.backup.restarting");
      } catch (err) {
        alert(err?.message || "Restore failed");
        setBusy(false);
      }
    });
  }

  function applyRoute(route) {
    const page = route?.page;
    if (PAGES.includes(page)) setPage(page);
  }

  window.__myspaceApplyRoute = applyRoute;
  window.BackupApp = { setPage, applyRoute };

  function onI18nApplied() {
    paintChrome();
    if (state.page === "status") {
      paintStatus();
      paintActivity();
    }
    if (state.page === "history") paintHistory();
    if (state.page === "about") paintAbout();
  }

  window.addEventListener("myspace-i18n-applied", onI18nApplied);

  bind();
  setPage("status");
  void refresh();
})();
