(function () {
  function tt(key, vars) {
    return window.MySpaceI18n?.t?.(key, vars) ?? key;
  }

  const PAGES = ["inbox", "playbooks", "about"];

  const state = {
    page: "inbox",
    incidents: [],
    playbooks: [],
    stats: null,
    filter: "open",
    search: "",
    unsub: null,
  };

  const el = {
    nav: document.getElementById("main-nav"),
    blurb: document.getElementById("sidebar-blurb"),
    openCount: document.getElementById("nav-open-count"),
    statRow: document.getElementById("stat-row"),
    incidentList: document.getElementById("incident-list"),
    inboxEmpty: document.getElementById("inbox-empty"),
    inboxSearch: document.getElementById("inbox-search"),
    inboxFilter: document.getElementById("inbox-filter"),
    playbookList: document.getElementById("playbook-list"),
    aboutPaths: document.getElementById("about-paths"),
    btnRefresh: document.getElementById("btn-refresh"),
  };

  function api() {
    return window.myApp?.resolve;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatTime(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  function setPage(page) {
    const next = PAGES.includes(page) ? page : "inbox";
    state.page = next;
    PAGES.forEach((p) => {
      document.getElementById(`view-${p}`)?.classList.toggle("hidden", p !== next);
    });
    el.nav?.querySelectorAll("[data-page]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.page === next);
    });
    paint();
  }

  async function refresh() {
    const resolve = api();
    if (!resolve) return;
    const [listRes, statusRes, pbRes] = await Promise.all([
      resolve.list({
        status: state.filter || undefined,
        q: state.search || undefined,
        limit: 80,
      }),
      resolve.status(),
      resolve.playbooks(),
    ]);
    if (listRes?.ok) state.incidents = listRes.incidents || [];
    if (statusRes?.ok) state.stats = statusRes;
    if (pbRes?.ok) state.playbooks = pbRes.playbooks || [];
    paint();
  }

  function paintStats() {
    const s = state.stats || {};
    if (el.statRow) {
      el.statRow.innerHTML = `
        <span class="stat-chip"><strong>${s.open || 0}</strong> ${escapeHtml(tt("service.resolve.statOpen"))}</span>
        <span class="stat-chip"><strong>${s.resolved || 0}</strong> ${escapeHtml(tt("service.resolve.statResolved"))}</span>
        <span class="stat-chip"><strong>${s.playbooks || 0}</strong> ${escapeHtml(tt("service.resolve.statPlaybooks"))}</span>`;
    }
    if (el.blurb) {
      el.blurb.textContent = tt("service.resolve.blurbOpen", { open: s.open || 0 });
    }
    if (el.openCount) {
      const n = s.open || 0;
      el.openCount.textContent = String(n);
      el.openCount.classList.toggle("hidden", n < 1);
    }
    if (el.aboutPaths && s.storePath) {
      el.aboutPaths.textContent = `Incidents: ${s.storePath}`;
    }
  }

  function paintInbox() {
    const list = state.incidents || [];
    if (el.inboxEmpty) el.inboxEmpty.classList.toggle("hidden", list.length > 0);
    if (!el.incidentList) return;
    if (!list.length) {
      el.incidentList.innerHTML = "";
      return;
    }
    el.incidentList.innerHTML = list
      .map((inc) => {
        const statusCls =
          inc.status === "resolved" ? "is-resolved" : inc.status === "dismissed" ? "is-dismissed" : "is-open";
        const sev = inc.severity === "warn" ? "warn" : inc.severity === "error" ? "error" : "";
        const canFix = inc.status === "open";
        return `<article class="incident-card ${statusCls}" data-id="${escapeHtml(inc.id)}">
          <div class="incident-head">
            <div>
              <h3>${escapeHtml(inc.appId)} · <code>${escapeHtml(inc.kind || inc.code)}</code></h3>
              <div class="incident-meta">
                <span class="pill ${sev}">${escapeHtml(inc.severity || "error")}</span>
                <span class="pill data">${escapeHtml(inc.category || "unknown")}</span>
                <span class="pill">${escapeHtml(inc.status || "open")}</span>
              </div>
            </div>
            <span class="incident-time">${escapeHtml(formatTime(inc.createdAt))}</span>
          </div>
          <p class="incident-msg">${escapeHtml(inc.message || "—")}</p>
          <div class="incident-actions">
            ${
              canFix
                ? `<button type="button" class="btn btn-primary btn-sm" data-apply="${escapeHtml(inc.id)}">${escapeHtml(tt("service.resolve.applyFix"))}</button>
                   <button type="button" class="btn btn-ghost btn-sm" data-dismiss="${escapeHtml(inc.id)}">${escapeHtml(tt("service.resolve.dismiss"))}</button>`
                : ""
            }
          </div>
        </article>`;
      })
      .join("");

    el.incidentList.querySelectorAll("[data-apply]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm(tt("service.resolve.confirmApply"))) return;
        const res = await api()?.apply({ id: btn.dataset.apply });
        if (res?.ok === false) alert(res.error || "Apply failed");
        else if (res?.result?.message) alert(res.result.message);
        await refresh();
      });
    });
    el.incidentList.querySelectorAll("[data-dismiss]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await api()?.dismiss({ id: btn.dataset.dismiss });
        await refresh();
      });
    });
  }

  function paintPlaybooks() {
    if (!el.playbookList) return;
    const list = state.playbooks || [];
    if (!list.length) {
      el.playbookList.innerHTML = `<p class="empty-msg">${escapeHtml(tt("service.resolve.emptyPlaybooks"))}</p>`;
      return;
    }
    el.playbookList.innerHTML = list
      .map(
        (pb) => `<article class="playbook-card">
          <h3><code>${escapeHtml(pb.id)}</code>${pb.universal ? ` <span class="pill data">${escapeHtml(tt("service.resolve.universal"))}</span>` : ""}</h3>
          <p>${escapeHtml(pb.title)} · ${escapeHtml(pb.category)}${pb.kind ? ` · ${escapeHtml(pb.kind)}` : ""} · ${escapeHtml(tt("service.resolve.steps", { count: pb.stepCount }))}</p>
        </article>`
      )
      .join("");
  }

  function paint() {
    paintStats();
    if (state.page === "inbox") paintInbox();
    if (state.page === "playbooks") paintPlaybooks();
  }

  function bind() {
    el.nav?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-page]");
      if (!btn) return;
      setPage(btn.dataset.page);
    });

    el.btnRefresh?.addEventListener("click", () => void refresh());

    el.inboxSearch?.addEventListener("input", () => {
      state.search = el.inboxSearch.value.trim();
      void refresh();
    });

    el.inboxFilter?.addEventListener("change", () => {
      state.filter = el.inboxFilter.value;
      void refresh();
    });

    state.unsub = api()?.onUpdated?.(() => void refresh());
  }

  function readRoute() {
    try {
      const hash = String(location.hash || "").replace(/^#/, "");
      const params = new URLSearchParams(hash);
      const page = params.get("page");
      if (page && PAGES.includes(page)) setPage(page);
    } catch {
      /* ignore */
    }
  }

  function applyRoute(route) {
    const page = String(route?.page || "inbox").toLowerCase();
    if (["inbox", "playbooks", "about"].includes(page)) setPage(page);
  }

  function onI18nApplied() {
    paint();
  }
  window.addEventListener("myspace-i18n-applied", onI18nApplied);
  window.addEventListener("myspace-i18n-ready", onI18nApplied);

  bind();
  readRoute();
  void refresh();

  if (window.Link?.onCommand) {
    window.Link.onCommand("open", async (args) => {
      const page = args?.page || "inbox";
      setPage(page);
      return { ok: true, page };
    });
  }

  window.ResolveApp = { setPage, refresh, applyRoute };
})();
