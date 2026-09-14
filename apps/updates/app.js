(() => {
  const PAGES = ["pending", "history", "about"];

  const state = {
    page: "pending",
    counts: { all: 0, pending: 0, applied: 0, skipped: 0 },
    pending: [],
    history: [],
    current: null,
    meta: {},
    busyId: null,
  };

  const el = {
    nav: document.getElementById("main-nav"),
    pendingCount: document.getElementById("nav-pending-count"),
    sidebarVersion: document.getElementById("sidebar-version"),
    pendingList: document.getElementById("pending-list"),
    pendingEmpty: document.getElementById("pending-empty"),
    newUpdatesSub: document.getElementById("new-updates-sub"),
    currentTitle: document.getElementById("current-title"),
    currentVersion: document.getElementById("current-version"),
    currentDesc: document.getElementById("current-desc"),
    currentDate: document.getElementById("current-date"),
    historyList: document.getElementById("history-list"),
    historyEmpty: document.getElementById("history-empty"),
    historySearch: document.getElementById("history-search"),
    historyFilter: document.getElementById("history-filter"),
    aboutPaths: document.getElementById("about-paths"),
    btnCheck: document.getElementById("btn-check"),
    btnRefresh: document.getElementById("btn-refresh"),
  };

  function api() {
    return window.myApp?.updates;
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

  function cleanTitle(title) {
    return String(title || "")
      .replace(/^Update ready\s*[—–-]\s*/i, "")
      .trim();
  }

  function formatDate(d) {
    if (!d) return "";
    try {
      return new Date(d).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return String(d);
    }
  }

  function setPage(page) {
    if (!PAGES.includes(page)) page = "pending";
    state.page = page;
    document.querySelectorAll(".view").forEach((v) => {
      v.classList.toggle("hidden", v.id !== `view-${page}`);
    });
    el.nav?.querySelectorAll("[data-page]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.page === page);
    });
    if (page === "history") void loadHistory();
    if (page === "pending") {
      paintCurrent();
      paintPending();
    }
    if (page === "about") paintAbout();
  }

  function paintChrome() {
    const c = state.counts || {};
    if (el.pendingCount) {
      const n = c.pending || 0;
      el.pendingCount.textContent = String(n);
      el.pendingCount.classList.toggle("hidden", n <= 0);
    }
    if (el.sidebarVersion) {
      const ver = state.meta.appVersion
        ? tt("service.updates.sidebarApp", { version: state.meta.appVersion })
        : "My Space";
      const checked = state.meta.lastCheckedAt
        ? tt("service.updates.sidebarChecked", { date: formatDate(state.meta.lastCheckedAt) })
        : "";
      el.sidebarVersion.textContent = `${ver}${checked}`;
    }
    if (el.newUpdatesSub) {
      const n = c.pending || 0;
      el.newUpdatesSub.textContent =
        n > 0
          ? tt("service.updates.newUpdatesSubReady", { count: n })
          : tt("service.updates.newUpdatesSubDefault");
    }
  }

  function paintCurrent() {
    const cur = state.current || {};
    const ver = cur.version || state.meta.appVersion || "—";
    const title = cleanTitle(cur.title) || `My Space ${ver}`;
    if (el.currentTitle) el.currentTitle.textContent = title;
    if (el.currentVersion) el.currentVersion.textContent = ver === "—" ? "—" : `Version ${ver}`;
    if (el.currentDesc) {
      el.currentDesc.textContent =
        cur.body ||
        (ver !== "—"
          ? tt("service.updates.runningBuild")
          : tt("service.updates.couldNotReadVersion"));
    }
    if (el.currentDate) {
      const d = formatDate(cur.date);
      el.currentDate.textContent = d
        ? cur.exact === false && cur.catalogVersion
          ? tt("service.updates.notesFrom", { version: cur.catalogVersion, date: d })
          : d
        : "";
    }
  }

  function cardHtml(u, { actions } = {}) {
    const status = u.status || "available";
    const busy = state.busyId === u.id;
    return `<article class="update-card${status === "pending" ? " is-pending" : ""}" data-id="${escapeHtml(u.id)}">
      <div class="update-head">
        <div>
          <h3>${escapeHtml(cleanTitle(u.title))}</h3>
          <div class="update-meta">
            <span class="pill ver">v${escapeHtml(u.version || u.id)}</span>
            <span class="pill ${escapeHtml(status)}">${escapeHtml(status)}</span>
            ${u.major ? `<span class="pill">major</span>` : ""}
          </div>
        </div>
        <span class="update-time">${escapeHtml(formatDate(u.date))}</span>
      </div>
      <p class="update-body">${escapeHtml(u.body || "")}</p>
      ${
        actions
          ? `<div class="update-actions">
              <button type="button" class="btn btn-primary" data-apply="${escapeHtml(u.id)}" ${busy ? "disabled" : ""}>
                ${busy ? escapeHtml(tt("service.updates.restarting")) : escapeHtml(tt("service.updates.restartUpdate"))}
              </button>
              <button type="button" class="btn btn-ghost" data-skip="${escapeHtml(u.id)}" ${busy ? "disabled" : ""}>${escapeHtml(tt("service.updates.skip"))}</button>
            </div>`
          : ""
      }
    </article>`;
  }

  function bindCardActions(root) {
    root?.querySelectorAll("[data-apply]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.apply;
        if (!id || !confirm(tt("service.updates.confirmRestart"))) return;
        state.busyId = id;
        paintPending();
        const res = await api()?.apply(id);
        if (res?.ok === false) {
          state.busyId = null;
          alert(res.error || "Could not apply update");
          paintPending();
        }
      });
    });
    root?.querySelectorAll("[data-skip]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.skip;
        if (!id) return;
        const res = await api()?.skip(id);
        if (res?.ok === false) alert(res.error || "Could not skip");
        await refresh();
      });
    });
  }

  function paintPending() {
    const list = state.pending || [];
    if (el.pendingEmpty) el.pendingEmpty.classList.toggle("hidden", list.length > 0);
    if (!el.pendingList) return;
    if (!list.length) {
      el.pendingList.innerHTML = "";
      return;
    }
    el.pendingList.innerHTML = list.map((u) => cardHtml(u, { actions: true })).join("");
    bindCardActions(el.pendingList);
  }

  async function loadHistory() {
    const filter = el.historyFilter?.value || "all";
    const q = el.historySearch?.value || "";
    const res = await api()?.list({ filter, q });
    state.history = res?.updates || [];
    paintHistory();
  }

  function paintHistory() {
    const list = state.history || [];
    if (el.historyEmpty) el.historyEmpty.classList.toggle("hidden", list.length > 0);
    if (!el.historyList) return;
    if (!list.length) {
      el.historyList.innerHTML = "";
      return;
    }
    el.historyList.innerHTML = list.map((u) => cardHtml(u, { actions: false })).join("");
  }

  function paintAbout() {
    if (!el.aboutPaths) return;
    const path = state.meta.catalogPath || "config/updates.json";
    el.aboutPaths.textContent = tt("service.updates.catalog", { path });
  }

  async function refresh() {
    const [status, pendingRes] = await Promise.all([
      api()?.status?.() || {},
      api()?.list?.({ filter: "pending" }) || {},
    ]);
    state.counts = status?.counts || pendingRes?.counts || state.counts;
    state.current = status?.current || pendingRes?.current || null;
    state.meta = {
      appVersion: status?.appVersion || "",
      lastCheckedAt: status?.lastCheckedAt || pendingRes?.lastCheckedAt,
      catalogPath: status?.catalogPath || pendingRes?.catalogPath,
    };
    state.pending = pendingRes?.updates || status?.pending || [];
    paintChrome();
    if (state.page === "pending") {
      paintCurrent();
      paintPending();
    }
    if (state.page === "history") await loadHistory();
    if (state.page === "about") paintAbout();
  }

  function bind() {
    el.nav?.querySelectorAll("[data-page]").forEach((btn) => {
      btn.addEventListener("click", () => setPage(btn.dataset.page));
    });
    el.btnRefresh?.addEventListener("click", () => void refresh());
    el.btnCheck?.addEventListener("click", async () => {
      const res = await api()?.check?.();
      await refresh();
      if (res?.ok === false) alert(res.error || "Check failed");
      else if ((res?.pending || 0) === 0) alert(tt("service.updates.upToDateAlert"));
      else alert(tt("service.updates.newUpdatesAlert", { count: res.pending }));
    });
    el.historyFilter?.addEventListener("change", () => void loadHistory());
    let t = null;
    el.historySearch?.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => void loadHistory(), 180);
    });
  }

  function applyRoute(route) {
    const page = route?.page;
    if (PAGES.includes(page)) setPage(page);
  }

  window.__myspaceApplyRoute = applyRoute;
  window.UpdatesApp = { setPage, applyRoute };

  function onI18nApplied() {
    paintChrome();
    if (state.page === "pending") {
      paintCurrent();
      paintPending();
    }
    if (state.page === "history") paintHistory();
    if (state.page === "about") paintAbout();
  }

  window.addEventListener("myspace-i18n-applied", onI18nApplied);

  bind();
  setPage("pending");
  void refresh();
})();
