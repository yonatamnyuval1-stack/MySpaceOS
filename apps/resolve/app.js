(function () {
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
        <span class="stat-chip"><strong>${s.open || 0}</strong> open</span>
        <span class="stat-chip"><strong>${s.resolved || 0}</strong> resolved</span>
        <span class="stat-chip"><strong>${s.playbooks || 0}</strong> playbooks</span>`;
    }
    if (el.blurb) {
      el.blurb.textContent = `${s.open || 0} open · Pulse reports land here`;
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
                ? `<button type="button" class="btn btn-primary btn-sm" data-apply="${escapeHtml(inc.id)}">Apply fix</button>
                   <button type="button" class="btn btn-ghost btn-sm" data-dismiss="${escapeHtml(inc.id)}">Dismiss</button>`
                : ""
            }
          </div>
        </article>`;
      })
      .join("");

    el.incidentList.querySelectorAll("[data-apply]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Apply the playbook fix for this incident?")) return;
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
      el.playbookList.innerHTML = `<p class="empty-msg">No playbooks in catalog.</p>`;
      return;
    }
    el.playbookList.innerHTML = list
      .map(
        (pb) => `<article class="playbook-card">
          <h3><code>${escapeHtml(pb.id)}</code>${pb.universal ? ' <span class="pill data">universal</span>' : ""}</h3>
          <p>${escapeHtml(pb.title)} · ${escapeHtml(pb.category)}${pb.kind ? ` · ${escapeHtml(pb.kind)}` : ""} · ${pb.stepCount} step(s)</p>
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
