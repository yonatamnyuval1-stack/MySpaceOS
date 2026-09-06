(function () {
  const els = {
    nav: document.getElementById("main-nav"),
    blurb: document.getElementById("sidebar-blurb"),
    status: document.getElementById("status-line"),
    btnRefresh: document.getElementById("btn-refresh"),
    statGrid: document.getElementById("stat-grid"),
    policyCard: document.getElementById("policy-card"),
    toolsList: document.getElementById("tools-list"),
    toolsSearch: document.getElementById("tools-search"),
    toolsCategory: document.getElementById("tools-category"),
    btnToolsEnable: document.getElementById("btn-tools-enable"),
    btnToolsLock: document.getElementById("btn-tools-lock"),
    notifPanel: document.getElementById("notif-panel"),
    jobsPanel: document.getElementById("jobs-panel"),
    bridgeList: document.getElementById("bridge-list"),
    bridgeEmpty: document.getElementById("bridge-empty"),
    externalPanel: document.getElementById("external-panel"),
  };

  const PAGES = ["overview", "tools", "notifications", "jobs", "bridge", "external", "about"];

  const state = {
    page: "overview",
    summary: null,
    platform: null,
    tools: [],
    categories: [],
    toolsQ: "",
    toolsCat: "",
    notif: null,
    jobs: null,
    devices: [],
    external: null,
  };

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function api(channel, args) {
    if (!window.myApp?.invoke) {
      throw new Error("Open Permissions from Platform → Permissions inside My Space.");
    }
    const res = await window.myApp.invoke(channel, args || {});
    if (res && res.ok === false) throw new Error(res.error || "Request failed");
    return res;
  }

  function setStatus(msg, kind) {
    if (!els.status) return;
    els.status.textContent = msg || "";
    els.status.classList.toggle("is-ok", kind === "ok");
    els.status.classList.toggle("is-err", kind === "err");
    if (msg) {
      clearTimeout(setStatus._t);
      setStatus._t = setTimeout(() => {
        els.status.textContent = "";
        els.status.classList.remove("is-ok", "is-err");
      }, 3200);
    }
  }

  function toggleHtml(id, checked, onChangeAttr) {
    return `<label class="toggle" title="Toggle">
      <input type="checkbox" id="${escapeHtml(id)}" ${checked ? "checked" : ""} ${onChangeAttr || ""} />
      <span class="toggle-track"></span>
    </label>`;
  }

  function setPage(page) {
    const next = PAGES.includes(page) ? page : "overview";
    state.page = next;
    PAGES.forEach((p) => {
      document.getElementById(`view-${p}`)?.classList.toggle("hidden", p !== next);
    });
    els.nav?.querySelectorAll("[data-page]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.page === next);
    });
    void loadPage(next);
  }

  async function loadPage(page) {
    try {
      if (page === "overview") await loadOverview();
      else if (page === "tools") await loadTools();
      else if (page === "notifications") await loadNotifications();
      else if (page === "jobs") await loadJobs();
      else if (page === "bridge") await loadBridge();
      else if (page === "external") await loadExternal();
    } catch (err) {
      setStatus(err?.message || String(err), "err");
    }
  }

  async function loadOverview() {
    const res = await api("overview");
    state.summary = res.summary;
    state.platform = res.platform;
    paintOverview();
  }

  function paintOverview() {
    const s = state.summary || {};
    if (els.blurb) {
      els.blurb.textContent = `${s.toolsEnabled || 0}/${s.toolsTotal || 0} AI tools on · ${
        s.trustedDevices || 0
      } trusted devices`;
    }
    const cards = [
      { page: "tools", label: "AI tools", value: `${s.toolsEnabled || 0}/${s.toolsTotal || 0}`, hint: `${s.toolsDisabled || 0} disabled` },
      { page: "notifications", label: "Mail alerts", value: s.mailAlerts ? "On" : "Off", hint: `${s.blockedSenders || 0} blocked` },
      { page: "jobs", label: "Shell jobs", value: s.allowShell ? "Allowed" : "Blocked", hint: s.allowScript ? "Scripts on" : "Scripts off" },
      { page: "bridge", label: "Bridge", value: String(s.trustedDevices || 0), hint: "Trusted devices" },
      { page: "external", label: "External", value: s.composioEnabled ? "On" : "Off", hint: `${s.composioAllowlist || 0} allowlisted` },
      {
        page: "overview",
        label: "Confirmations",
        value: s.requireAiConfirm ? "Required" : "Off",
        hint: `${s.toolsNeedConfirm || 0} mutating tools`,
      },
    ];
    if (els.statGrid) {
      els.statGrid.innerHTML = cards
        .map(
          (c) => `<button type="button" class="stat" data-goto="${escapeHtml(c.page)}">
          <span class="stat-label">${escapeHtml(c.label)}</span>
          <span class="stat-value">${escapeHtml(c.value)}</span>
          <span class="stat-hint">${escapeHtml(c.hint)}</span>
        </button>`
        )
        .join("");
    }
    const p = state.platform || {};
    if (els.policyCard) {
      els.policyCard.innerHTML = `
        <div class="setting-row">
          <div class="setting-copy">
            <strong>Confirm mutating AI actions</strong>
            <span>Ask before Mind runs shell, Builds, Drift, or Clock changes. Session “allow for now” still applies in chat.</span>
          </div>
          ${toggleHtml("policy-confirm", p.requireAiConfirm !== false)}
        </div>
        <div class="setting-row">
          <div class="setting-copy">
            <strong>Allow unattended Flow runs</strong>
            <span>Reserved policy flag. Model Flow still uses its approve bar today — this records your preference for future auto-run.</span>
          </div>
          ${toggleHtml("policy-flow", p.allowUnattendedFlow === true)}
        </div>`;
      document.getElementById("policy-confirm")?.addEventListener("change", async (e) => {
        try {
          await api("platform.set", { requireAiConfirm: e.target.checked });
          setStatus("Confirmation policy saved", "ok");
          await loadOverview();
        } catch (err) {
          setStatus(err.message, "err");
          e.target.checked = !e.target.checked;
        }
      });
      document.getElementById("policy-flow")?.addEventListener("change", async (e) => {
        try {
          await api("platform.set", { allowUnattendedFlow: e.target.checked });
          setStatus("Flow policy saved", "ok");
        } catch (err) {
          setStatus(err.message, "err");
          e.target.checked = !e.target.checked;
        }
      });
    }
  }

  async function loadTools() {
    const res = await api("tools.list");
    state.tools = res.tools || [];
    state.categories = res.categories || [];
    if (els.toolsCategory) {
      const cur = state.toolsCat;
      els.toolsCategory.innerHTML =
        `<option value="">All categories</option>` +
        state.categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
      els.toolsCategory.value = cur;
    }
    paintTools();
  }

  function paintTools() {
    const q = state.toolsQ.trim().toLowerCase();
    const rows = state.tools.filter((t) => {
      if (state.toolsCat && t.category !== state.toolsCat) return false;
      if (!q) return true;
      return `${t.name} ${t.description} ${t.category}`.toLowerCase().includes(q);
    });
    if (!els.toolsList) return;
    if (!rows.length) {
      els.toolsList.innerHTML = `<div class="row"><div class="row-meta">No tools match.</div></div>`;
      return;
    }
    els.toolsList.innerHTML = rows
      .map((t) => {
        const badges = [
          `<span class="pill">${escapeHtml(t.category || "other")}</span>`,
          t.needsConfirm ? `<span class="pill warn">needs confirm</span>` : "",
          t.active ? `<span class="pill ok">enabled</span>` : `<span class="pill">disabled</span>`,
        ]
          .filter(Boolean)
          .join("");
        return `<div class="row" data-tool="${escapeHtml(t.name)}">
          <div>
            <div class="row-title">${escapeHtml(t.name)}</div>
            <div class="row-meta">${escapeHtml(t.description || "")}</div>
            <div class="row-badges">${badges}</div>
          </div>
          ${toggleHtml(`tool-${escapeHtml(t.name)}`, !!t.active)}
        </div>`;
      })
      .join("");
    els.toolsList.querySelectorAll(".toggle input").forEach((input) => {
      input.addEventListener("change", async () => {
        const row = input.closest("[data-tool]");
        const name = row?.dataset.tool;
        try {
          await api("tools.set", { name, active: input.checked });
          setStatus(`${name} ${input.checked ? "enabled" : "disabled"}`, "ok");
          const t = state.tools.find((x) => x.name === name);
          if (t) t.active = input.checked;
          paintTools();
        } catch (err) {
          setStatus(err.message, "err");
          input.checked = !input.checked;
        }
      });
    });
  }

  async function loadNotifications() {
    const res = await api("notifications.get");
    state.notif = res.prefs || res;
    paintNotifications();
  }

  function paintNotifications() {
    const p = state.notif || {};
    const blocked = p.blockedSenders || [];
    if (!els.notifPanel) return;
    els.notifPanel.innerHTML = `
      <div class="setting-row">
        <div class="setting-copy">
          <strong>Mail alerts</strong>
          <span>Show taskbar notifications when new mail arrives.</span>
        </div>
        ${toggleHtml("notif-mail", p.mailAlertsEnabled !== false)}
      </div>
      <div class="setting-row">
        <div class="setting-copy">
          <strong>Blocked senders</strong>
          <span>${blocked.length} address${blocked.length === 1 ? "" : "es"} silenced.</span>
        </div>
      </div>
      <div class="chip-list" id="blocked-chips">
        ${
          blocked.length
            ? blocked
                .map(
                  (e) => `<span class="chip-x" data-email="${escapeHtml(e)}">${escapeHtml(e)}
              <button type="button" data-unblock="${escapeHtml(e)}" aria-label="Unblock">×</button></span>`
                )
                .join("")
            : `<span class="row-meta">No blocked senders yet.</span>`
        }
      </div>
      <div class="block-form">
        <input type="text" id="block-input" placeholder="name@example.com or display name" spellcheck="false" />
        <button type="button" class="btn btn-primary" id="btn-block">Block</button>
      </div>`;

    document.getElementById("notif-mail")?.addEventListener("change", async (e) => {
      try {
        const res = await api("notifications.set", { mailAlertsEnabled: e.target.checked });
        state.notif = res.prefs || state.notif;
        setStatus("Mail alerts updated", "ok");
      } catch (err) {
        setStatus(err.message, "err");
        e.target.checked = !e.target.checked;
      }
    });
    document.getElementById("btn-block")?.addEventListener("click", async () => {
      const input = document.getElementById("block-input");
      const email = input?.value?.trim();
      if (!email) return;
      try {
        const res = await api("notifications.block", { email });
        state.notif = res.prefs || state.notif;
        if (input) input.value = "";
        paintNotifications();
        setStatus("Sender blocked", "ok");
      } catch (err) {
        setStatus(err.message, "err");
      }
    });
    els.notifPanel.querySelectorAll("[data-unblock]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          const res = await api("notifications.unblock", { email: btn.dataset.unblock });
          state.notif = res.prefs || state.notif;
          paintNotifications();
          setStatus("Sender unblocked", "ok");
        } catch (err) {
          setStatus(err.message, "err");
        }
      });
    });
  }

  async function loadJobs() {
    const res = await api("jobs.get");
    state.jobs = res.capacity || {};
    paintJobs();
  }

  function paintJobs() {
    const c = state.jobs || {};
    const rows = [
      { key: "allowShell", title: "Allow shell jobs", hint: "Queue shell commands through Jobs." },
      { key: "allowScript", title: "Allow script jobs", hint: "Run saved Scripts programs via Jobs." },
      { key: "allowFileWrite", title: "Allow workspace file writes", hint: "Language files(write …) and files(mkdir …) under userData/workspace." },
      { key: "allowHost", title: "Allow host language runs", hint: "Language host(run python/node …) on workspace scripts." },
      { key: "allowAppBuild", title: "Allow app scaffold & build", hint: "Language app(scaffold …) and pack(build …) for user apps." },
      { key: "allowLaunch", title: "Allow app launches", hint: "Jobs may open apps and windows." },
      { key: "allowProgram", title: "Allow program jobs", hint: "Multi-step shell programs in the queue." },
      { key: "pauseWhenFocus", title: "Pause background when focused", hint: "Hold background pool while you are in focus mode." },
      { key: "notifyOnDone", title: "Notify when jobs finish", hint: "Surface completion through notifications." },
      { key: "connectBoost", title: "Connect pool boost", hint: "Priority capacity for mail, messaging, and browsers." },
    ];
    if (!els.jobsPanel) return;
    els.jobsPanel.innerHTML = rows
      .map((r) => {
        const on = c[r.key] !== false;
        return `<div class="setting-row">
          <div class="setting-copy">
            <strong>${escapeHtml(r.title)}</strong>
            <span>${escapeHtml(r.hint)}</span>
          </div>
          ${toggleHtml(`job-${r.key}`, on)}
        </div>`;
      })
      .join("");
    rows.forEach((r) => {
      document.getElementById(`job-${r.key}`)?.addEventListener("change", async (e) => {
        try {
          const res = await api("jobs.set", { [r.key]: e.target.checked });
          state.jobs = res.capacity || state.jobs;
          setStatus("Jobs capacity updated", "ok");
        } catch (err) {
          setStatus(err.message, "err");
          e.target.checked = !e.target.checked;
        }
      });
    });
  }

  async function loadBridge() {
    const res = await api("bridge.devices");
    state.devices = res.devices || [];
    paintBridge();
  }

  function paintBridge() {
    const devices = state.devices || [];
    if (els.bridgeEmpty) els.bridgeEmpty.classList.toggle("hidden", devices.length > 0);
    if (!els.bridgeList) return;
    if (!devices.length) {
      els.bridgeList.innerHTML = "";
      return;
    }
    els.bridgeList.innerHTML = devices
      .map(
        (d) => `<div class="row" data-device="${escapeHtml(d.id)}">
          <div>
            <div class="row-title" style="font-family:var(--font)">${escapeHtml(d.name || d.id)}</div>
            <div class="row-meta">${escapeHtml(d.id)}</div>
            <div class="row-badges">
              <span class="pill ${d.trusted ? "ok" : ""}">${d.trusted ? "trusted" : "untrusted"}</span>
            </div>
          </div>
          <div style="display:flex;gap:0.4rem">
            ${d.trusted ? `<button type="button" class="btn btn-sm" data-untrust="${escapeHtml(d.id)}">Untrust</button>` : ""}
            <button type="button" class="btn btn-sm btn-danger" data-revoke="${escapeHtml(d.id)}">Revoke</button>
          </div>
        </div>`
      )
      .join("");
    els.bridgeList.querySelectorAll("[data-revoke]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await api("bridge.revoke", { deviceId: btn.dataset.revoke });
          setStatus("Device revoked", "ok");
          await loadBridge();
        } catch (err) {
          setStatus(err.message, "err");
        }
      });
    });
    els.bridgeList.querySelectorAll("[data-untrust]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await api("bridge.untrust", { deviceId: btn.dataset.untrust });
          setStatus("Device untrusted", "ok");
          await loadBridge();
        } catch (err) {
          setStatus(err.message, "err");
        }
      });
    });
  }

  async function loadExternal() {
    const res = await api("external.get");
    state.external = res;
    paintExternal();
  }

  function paintExternal() {
    const e = state.external || {};
    const list = e.allowlist || [];
    if (!els.externalPanel) return;
    els.externalPanel.innerHTML = `
      <div class="setting-row">
        <div class="setting-copy">
          <strong>External tools enabled</strong>
          <span>Master switch for Composio / Pulse external toolkits${e.hasKey ? "" : " (no API key saved yet)"}.</span>
        </div>
        ${toggleHtml("ext-enabled", e.enabled !== false)}
      </div>
      <div class="setting-row">
        <div class="setting-copy">
          <strong>Toolkit allowlist</strong>
          <span>Empty list means no extra filter beyond Composio session. Add slugs to restrict.</span>
        </div>
      </div>
      <div class="chip-list">
        ${
          list.length
            ? list
                .map(
                  (s) => `<span class="chip-x">${escapeHtml(s)}
              <button type="button" data-rm="${escapeHtml(s)}">×</button></span>`
                )
                .join("")
            : `<span class="row-meta">Allowlist empty.</span>`
        }
      </div>
      <div class="block-form">
        <input type="text" id="allow-input" placeholder="toolkit slug (e.g. gmail)" spellcheck="false" />
        <button type="button" class="btn btn-primary" id="btn-allow">Add</button>
      </div>`;

    document.getElementById("ext-enabled")?.addEventListener("change", async (ev) => {
      try {
        const res = await api("external.set", { enabled: ev.target.checked });
        state.external = { ...state.external, ...res };
        setStatus("External tools updated", "ok");
      } catch (err) {
        setStatus(err.message, "err");
        ev.target.checked = !ev.target.checked;
      }
    });
    document.getElementById("btn-allow")?.addEventListener("click", async () => {
      const input = document.getElementById("allow-input");
      const slug = input?.value?.trim();
      if (!slug) return;
      try {
        const res = await api("external.addAllow", { slug });
        state.external = { ...state.external, ...res };
        if (input) input.value = "";
        paintExternal();
        setStatus("Toolkit allowlisted", "ok");
      } catch (err) {
        setStatus(err.message, "err");
      }
    });
    els.externalPanel.querySelectorAll("[data-rm]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          const res = await api("external.removeAllow", { slug: btn.dataset.rm });
          state.external = { ...state.external, ...res };
          paintExternal();
          setStatus("Removed from allowlist", "ok");
        } catch (err) {
          setStatus(err.message, "err");
        }
      });
    });
  }

  function applyRoute(route) {
    const page = String(route?.page || route?.param || "overview")
      .toLowerCase()
      .trim();
    const alias = {
      catalog: "overview",
      home: "overview",
      ai: "tools",
      mind: "tools",
      alerts: "notifications",
      notif: "notifications",
      mail: "notifications",
      compute: "jobs",
      devices: "bridge",
      phone: "bridge",
      composio: "external",
      pulse: "external",
    };
    setPage(alias[page] || page);
  }

  els.nav?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-page]");
    if (btn) setPage(btn.dataset.page);
  });

  els.statGrid?.addEventListener("click", (e) => {
    const card = e.target.closest("[data-goto]");
    if (card?.dataset.goto && card.dataset.goto !== "overview") setPage(card.dataset.goto);
  });

  els.btnRefresh?.addEventListener("click", () => void loadPage(state.page));
  els.toolsSearch?.addEventListener("input", () => {
    state.toolsQ = els.toolsSearch.value || "";
    paintTools();
  });
  els.toolsCategory?.addEventListener("change", () => {
    state.toolsCat = els.toolsCategory.value || "";
    paintTools();
  });
  els.btnToolsEnable?.addEventListener("click", async () => {
    try {
      await api("tools.enableAll");
      setStatus("All tools enabled", "ok");
      await loadTools();
    } catch (err) {
      setStatus(err.message, "err");
    }
  });
  els.btnToolsLock?.addEventListener("click", async () => {
    try {
      await api("tools.disableMutating");
      setStatus("Mutating tools disabled", "ok");
      await loadTools();
    } catch (err) {
      setStatus(err.message, "err");
    }
  });

  window.PermissionsApp = {
    setPage,
    applyRoute,
    refresh: () => loadPage(state.page),
  };

  const bootPage =
    (typeof window.__myspaceInitialRoute === "object" && window.__myspaceInitialRoute?.page) ||
    "overview";
  setPage(bootPage);
})();