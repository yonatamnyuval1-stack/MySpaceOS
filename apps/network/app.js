(() => {
  const PAGES = ["status", "adapters", "ports", "about"];

  const state = {
    page: "status",
    status: null,
    checks: null,
    adapters: [],
    adapterSummary: {},
    ports: [],
    portSummary: {},
    portsScannedAt: null,
    checking: false,
  };

  const el = {
    nav: document.getElementById("main-nav"),
    sidebarMeta: document.getElementById("sidebar-meta"),
    navAdapterCount: document.getElementById("nav-adapter-count"),
    navPortCount: document.getElementById("nav-port-count"),
    statusHero: document.getElementById("status-hero"),
    statusEyebrow: document.getElementById("status-eyebrow"),
    statusTitle: document.getElementById("status-title"),
    statusPrimary: document.getElementById("status-primary"),
    statusDesc: document.getElementById("status-desc"),
    statusMetaRow: document.getElementById("status-meta-row"),
    checkList: document.getElementById("check-list"),
    checksEmpty: document.getElementById("checks-empty"),
    checksSub: document.getElementById("checks-sub"),
    adapterStats: document.getElementById("adapter-stats"),
    adapterList: document.getElementById("adapter-list"),
    adapterEmpty: document.getElementById("adapter-empty"),
    adapterSearch: document.getElementById("adapter-search"),
    adapterFilter: document.getElementById("adapter-filter"),
    portStats: document.getElementById("port-stats"),
    portsBody: document.getElementById("ports-body"),
    portsFoot: document.getElementById("ports-foot"),
    portSearch: document.getElementById("port-search"),
    portFilterState: document.getElementById("port-filter-state"),
    portFilterProtocol: document.getElementById("port-filter-protocol"),
    aboutMeta: document.getElementById("about-meta"),
    btnCheck: document.getElementById("btn-check"),
    btnRefresh: document.getElementById("btn-refresh"),
    btnSettings: document.getElementById("btn-settings"),
    btnRefreshAdapters: document.getElementById("btn-refresh-adapters"),
    btnRefreshPorts: document.getElementById("btn-refresh-ports"),
  };

  function api() {
    return window.myApp?.network;
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
      paintChecks();
    }
    if (page === "adapters") {
      void loadAdapters();
    }
    if (page === "ports") {
      void loadPorts();
    }
    if (page === "about") paintAbout();
  }

  function paintChrome() {
    const s = state.status || {};
    if (el.sidebarMeta) {
      const online = s.online ? tt("service.network.online") : tt("service.network.offline");
      const ip = s.primaryIp || "—";
      el.sidebarMeta.textContent = `${online} · ${ip}`;
    }
    const nAdapters = state.adapterSummary.adapters ?? s.summary?.adapters ?? 0;
    if (el.navAdapterCount) {
      el.navAdapterCount.textContent = String(nAdapters);
      el.navAdapterCount.classList.toggle("hidden", !nAdapters);
    }
    const nPorts = state.portSummary.listening ?? 0;
    if (el.navPortCount) {
      el.navPortCount.textContent = String(nPorts);
      el.navPortCount.classList.toggle("hidden", !nPorts);
    }
  }

  function paintStatus() {
    const s = state.status || {};
    const online = !!s.online;
    el.statusHero?.classList.toggle("is-online", online);
    el.statusHero?.classList.toggle("is-offline", s.online === false);

    if (el.statusEyebrow) el.statusEyebrow.textContent = s.hostname || "Host";
    if (el.statusTitle) {
      el.statusTitle.textContent = online ? tt("service.network.connected") : tt("service.network.offlineLimited");
    }
    if (el.statusPrimary) {
      el.statusPrimary.textContent = s.primaryIp
        ? tt("service.network.primaryIp", { ip: s.primaryIp })
        : tt("service.network.noPrimaryIpv4");
    }
    if (el.statusDesc) {
      const parts = [];
      if (s.primaryName) parts.push(`Active adapter: ${s.primaryName}`);
      if (s.mediaHint) parts.push(s.mediaHint);
      if (s.gateway) parts.push(`Gateway ${s.gateway}`);
      if (s.dns) parts.push(`DNS ${s.dns}`);
      if (s.linkSpeed && s.linkSpeed !== "—") parts.push(s.linkSpeed);
      el.statusDesc.textContent =
        parts.join(" · ") ||
        (s.scanNote || "Refresh or run a reachability check for a live picture.");
    }
    if (el.statusMetaRow) {
      const chips = [];
      chips.push(`<span class="pill ${online ? "ok" : "bad"}">${online ? "online" : "offline"}</span>`);
      if (s.mediaHint) chips.push(`<span class="pill">${escapeHtml(s.mediaHint)}</span>`);
      if (s.summary?.connected != null) {
        chips.push(
          `<span class="pill">${escapeHtml(String(s.summary.connected))} connected</span>`
        );
      }
      if (s.lastChecks?.checkedAt) {
        chips.push(
          `<span class="pill">${escapeHtml(s.lastChecks.passed)}/${escapeHtml(
            String(s.lastChecks.total)
          )} probes · ${escapeHtml(formatTime(s.lastChecks.checkedAt))}</span>`
        );
      }
      el.statusMetaRow.innerHTML = chips.join("");
    }
  }

  function paintChecks() {
    const checks = state.checks;
    const results = checks?.results || [];
    if (el.checksSub) {
      el.checksSub.textContent = checks?.checkedAt
        ? tt("service.network.checksSubLast", {
            time: formatTime(checks.checkedAt),
            passed: checks.passed,
            total: checks.total,
          })
        : tt("service.network.checksSubDefault");
    }
    if (el.checksEmpty) el.checksEmpty.classList.toggle("hidden", results.length > 0);
    if (!el.checkList) return;
    if (!results.length) {
      el.checkList.innerHTML = "";
      return;
    }
    el.checkList.innerHTML = results
      .map((r) => {
        const ok = !!r.ok;
        const detail = ok
          ? [r.detail, r.ms != null ? `${r.ms} ms` : null].filter(Boolean).join(" · ")
          : r.error || "Failed";
        return `<article class="check-card ${ok ? "is-ok" : "is-fail"}">
          <div class="check-head">
            <div>
              <h3>${escapeHtml(r.label)}</h3>
              <p class="check-target">${escapeHtml(r.target || "")}</p>
            </div>
            <span class="pill ${ok ? "ok" : "bad"}">${ok ? "ok" : "fail"}</span>
          </div>
          <p class="check-detail">${escapeHtml(detail)}</p>
        </article>`;
      })
      .join("");
  }

  function filteredAdapters() {
    const q = (el.adapterSearch?.value || "").trim().toLowerCase();
    const filter = el.adapterFilter?.value || "all";
    return (state.adapters || []).filter((a) => {
      if (filter === "connected" && !a.connected) return false;
      if (filter === "down" && a.connected) return false;
      if (!q) return true;
      return `${a.name} ${a.description} ${a.ipv4Primary} ${a.macAddress} ${a.gateway4} ${a.dnsPrimary}`
        .toLowerCase()
        .includes(q);
    });
  }

  function paintAdapters() {
    const list = filteredAdapters();
    const s = state.adapterSummary || {};
    if (el.adapterStats) {
      el.adapterStats.innerHTML = `
        <span class="stat-chip"><strong>${s.adapters ?? state.adapters.length}</strong> adapters</span>
        <span class="stat-chip"><strong>${s.connected ?? 0}</strong> connected</span>
        <span class="stat-chip"><strong>${escapeHtml(s.primaryIp || "—")}</strong> primary</span>`;
    }
    if (el.adapterEmpty) el.adapterEmpty.classList.toggle("hidden", list.length > 0);
    if (!el.adapterList) return;
    if (!list.length) {
      el.adapterList.innerHTML = "";
      return;
    }
    el.adapterList.innerHTML = list
      .map((a) => {
        const ipv4 = (a.ipv4 || []).join(", ") || a.ipv4Primary || "—";
        const dns = Array.isArray(a.dns) ? a.dns.join(", ") : a.dnsPrimary || "—";
        return `<article class="adapter-card">
          <div class="adapter-head">
            <div>
              <h3>${escapeHtml(a.name)}</h3>
              ${a.description ? `<p class="adapter-desc">${escapeHtml(a.description)}</p>` : ""}
              <div class="adapter-grid-meta">
                <span class="pill ${a.connected ? "ok" : "warn"}">${escapeHtml(
                  a.statusLabel || a.status || "—"
                )}</span>
                ${a.linkSpeed && a.linkSpeed !== "—" ? `<span class="pill">${escapeHtml(a.linkSpeed)}</span>` : ""}
              </div>
            </div>
          </div>
          <div class="adapter-fields">
            <div><span class="field-label">IPv4</span><span class="field-value">${escapeHtml(ipv4)}</span></div>
            <div><span class="field-label">Gateway</span><span class="field-value">${escapeHtml(
              a.gateway4 || "—"
            )}</span></div>
            <div><span class="field-label">DNS</span><span class="field-value">${escapeHtml(dns)}</span></div>
            <div><span class="field-label">MAC</span><span class="field-value">${escapeHtml(
              a.macAddress || "—"
            )}</span></div>
          </div>
        </article>`;
      })
      .join("");
  }

  async function loadAdapters() {
    const res = await api()?.adapters?.();
    state.adapters = res?.adapters || [];
    state.adapterSummary = res?.summary || {};
    paintAdapters();
    paintChrome();
  }

  async function loadPorts() {
    const stateFilter = el.portFilterState?.value || "LISTENING";
    const protocol = el.portFilterProtocol?.value || "all";
    const q = el.portSearch?.value || "";
    const args = { q, limit: 250 };
    if (stateFilter !== "all") args.state = stateFilter;
    if (protocol !== "all") args.protocol = protocol;
    if (el.portsBody) {
      el.portsBody.innerHTML = `<tr><td colspan="6" class="muted">${escapeHtml(tt("service.network.scanningPorts"))}</td></tr>`;
    }
    const res = await api()?.ports?.(args);
    state.ports = res?.ports || [];
    state.portSummary = res?.summary || {};
    state.portsScannedAt = res?.scannedAt || null;
    paintPorts(res);
    paintChrome();
  }

  function paintPorts(res) {
    const s = state.portSummary || {};
    if (el.portStats) {
      el.portStats.innerHTML = `
        <span class="stat-chip"><strong>${s.listening ?? 0}</strong> listening</span>
        <span class="stat-chip"><strong>${s.established ?? 0}</strong> established</span>
        <span class="stat-chip"><strong>${s.uniqueProcesses ?? 0}</strong> processes</span>
        <span class="stat-chip"><strong>${s.total ?? 0}</strong> total</span>`;
    }
    const rows = state.ports || [];
    if (!el.portsBody) return;
    if (!rows.length) {
      el.portsBody.innerHTML = `<tr><td colspan="6" class="muted">${escapeHtml(tt("service.network.noPortsMatch"))}</td></tr>`;
    } else {
      el.portsBody.innerHTML = rows
        .map((p) => {
          const local = `${p.localAddress}:${p.localPort}`;
          const remote =
            p.remotePort > 0 ? `${p.remoteAddress}:${p.remotePort}` : p.remoteAddress || "—";
          return `<tr>
            <td>${escapeHtml(p.protocol)}</td>
            <td>${escapeHtml(local)}</td>
            <td>${escapeHtml(remote)}</td>
            <td>${escapeHtml(p.state)}</td>
            <td>${escapeHtml(String(p.pid || "—"))}</td>
            <td class="proc-name">${escapeHtml(p.processName || "—")}</td>
          </tr>`;
        })
        .join("");
    }
    if (el.portsFoot) {
      const matched = res?.totalMatched ?? rows.length;
      const trunc = res?.truncated ? " · truncated" : "";
      el.portsFoot.textContent = `${matched} shown${trunc} · scanned ${formatTime(
        state.portsScannedAt
      ) || "—"}`;
    }
  }

  function paintAbout() {
    if (!el.aboutMeta) return;
    const s = state.status || {};
    el.aboutMeta.textContent = [
      s.hostname ? `Host: ${s.hostname}` : null,
      s.platform ? `Platform: ${s.platform}` : null,
      s.scannedAt ? `Last status: ${formatTime(s.scannedAt)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  async function refreshStatus() {
    const res = await api()?.status?.();
    state.status = res || null;
    if (res?.lastChecks && !state.checks) {
      /* keep until check */
    }
    paintStatus();
    paintChrome();
    if (state.page === "about") paintAbout();
  }

  async function runCheck() {
    if (state.checking) return;
    state.checking = true;
    if (el.btnCheck) el.btnCheck.disabled = true;
    try {
      const res = await api()?.check?.();
      state.status = res || state.status;
      state.checks = res?.checks || null;
      paintStatus();
      paintChecks();
      paintChrome();
    } finally {
      state.checking = false;
      if (el.btnCheck) el.btnCheck.disabled = false;
    }
  }

  async function refresh() {
    await refreshStatus();
    if (state.page === "adapters") await loadAdapters();
    if (state.page === "ports") await loadPorts();
    if (state.page === "status" && !state.checks) {
      /* optional auto-check once */
    }
  }

  function bind() {
    el.nav?.querySelectorAll("[data-page]").forEach((btn) => {
      btn.addEventListener("click", () => setPage(btn.dataset.page));
    });
    el.btnRefresh?.addEventListener("click", () => void refresh());
    el.btnCheck?.addEventListener("click", () => void runCheck());
    el.btnSettings?.addEventListener("click", async () => {
      const res = await api()?.openSettings?.();
      if (res?.ok === false) alert(res.error || "Could not open Windows Network settings");
    });
    el.btnRefreshAdapters?.addEventListener("click", () => void loadAdapters());
    el.btnRefreshPorts?.addEventListener("click", () => void loadPorts());

    let t = null;
    const debouncedAdapters = () => {
      clearTimeout(t);
      t = setTimeout(() => paintAdapters(), 150);
    };
    el.adapterSearch?.addEventListener("input", debouncedAdapters);
    el.adapterFilter?.addEventListener("change", () => paintAdapters());

    let pt = null;
    const debouncedPorts = () => {
      clearTimeout(pt);
      pt = setTimeout(() => void loadPorts(), 200);
    };
    el.portSearch?.addEventListener("input", debouncedPorts);
    el.portFilterState?.addEventListener("change", () => void loadPorts());
    el.portFilterProtocol?.addEventListener("change", () => void loadPorts());
  }

  function applyRoute(route) {
    const page = route?.page;
    if (PAGES.includes(page)) setPage(page);
  }

  window.__myspaceApplyRoute = applyRoute;
  window.NetworkApp = { setPage, applyRoute };

  function onI18nApplied() {
    paintChrome();
    if (state.page === "status") {
      paintStatus();
      paintChecks();
    }
    if (state.page === "adapters") paintAdapters();
    if (state.page === "ports") paintPorts({ totalMatched: state.ports.length });
    if (state.page === "about") paintAbout();
  }

  window.addEventListener("myspace-i18n-applied", onI18nApplied);

  bind();
  setPage("status");
  void (async () => {
    await refreshStatus();
    await runCheck();
  })();
})();
