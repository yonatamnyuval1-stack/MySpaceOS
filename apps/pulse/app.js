(function () {
  const HIDE_MODULES = new Set(["pulse", "composio", "parts"]);

  const els = {
    content: document.getElementById("content"),
    pageTitle: document.getElementById("page-title"),
    pageSubtitle: document.getElementById("page-subtitle"),
    searchInput: document.getElementById("search-input"),
    sidebarBlurb: document.getElementById("sidebar-blurb"),
    btnBack: document.getElementById("btn-back"),
    btnReload: document.getElementById("btn-reload"),
    nav: document.getElementById("main-nav"),
    banner: document.getElementById("banner"),
  };

  const state = {
    page: "directory",
    profiles: [],
    log: [],
    selectedId: null,
    search: "",
    lastResult: null,
    error: null,
    external: {
      status: null,
      toolkits: [],
      connections: [],
      toolkitQ: "",
      result: null,
      pendingConnect: null,
      pollTimer: null,
      nextCursor: null,
      totalItems: null,
    },
  };

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function parseKv(raw) {
    const input = {};
    for (const part of String(raw || "").trim().split(/\s+/).filter(Boolean)) {
      const m = part.match(/^([^:=]+)[:=](.+)$/);
      if (m) input[m[1]] = m[2];
    }
    return input;
  }

  function showBanner(msg, isError) {
    if (!els.banner) return;
    if (!msg) {
      els.banner.classList.add("hidden");
      els.banner.textContent = "";
      return;
    }
    els.banner.textContent = msg;
    els.banner.classList.toggle("is-error", !!isError);
    els.banner.classList.remove("hidden");
  }

  async function api(channel, args) {
    if (!window.myApp?.invoke) {
      throw new Error("Pulse could not connect. ");
    }
    return window.myApp.invoke(channel, args || {});
  }

  function visibleProfiles() {
    return state.profiles.filter(
      (p) => !HIDE_MODULES.has(p.moduleId) && !String(p.moduleId || "").startsWith("composio.")
    );
  }

  function logoHtml(p, sizeClass = "") {
    const name = escapeHtml(p.name || p.moduleId);
    if (p.iconSrc) {
      return `<img class="app-logo ${sizeClass}" src="${escapeHtml(p.iconSrc)}" alt="" width="40" height="40" />`;
    }
    if (p.icon) {
      return `<span class="app-logo app-logo--emoji ${sizeClass}" aria-hidden="true">${escapeHtml(p.icon)}</span>`;
    }
    return `<span class="app-logo app-logo--fallback ${sizeClass}" aria-hidden="true">${escapeHtml(
      String(name).slice(0, 1).toUpperCase()
    )}</span>`;
  }

  function deliveryLabel(delivery) {
    return delivery === "ui" ? "Opens the app" : "Runs quietly";
  }

  async function loadProfiles() {
    const res = await api("link.profiles.list", { q: state.search });
    if (!res?.ok) throw new Error(res?.error || "Could not load apps");
    state.profiles = res.profiles || [];
    updateSidebarBlurb();
  }

  async function composio(verb, args) {
    return api("link.command.send", { target: "composio", verb, args: args || {} });
  }

  async function loadLog() {
    const res = await api("link.log.list", { limit: 80 });
    if (!res?.ok) throw new Error(res?.error || "Could not load activity");
    state.log = res.entries || [];
  }

  async function loadExternal() {
    const statusRes = await composio("status");
    if (!statusRes?.ok && statusRes?.error) {
      state.external.status = statusRes;
      state.external.toolkits = [];
      state.external.connections = [];
      state.external.nextCursor = null;
      state.external.totalItems = null;
      return;
    }
    state.external.status = statusRes;

    if (statusRes?.hasKey) {
      const [tk, conn] = await Promise.all([
        composio("listToolkits", {
          q: state.external.toolkitQ || undefined,
          limit: 500,
          pageSize: 250,
        }),
        composio("listConnections"),
      ]);
      state.external.toolkits = tk?.toolkits || [];
      state.external.nextCursor = tk?.nextCursor || null;
      state.external.totalItems = tk?.totalItems ?? state.external.toolkits.length;
      state.external.connections = conn?.connections || [];
      if (tk?.error) state.external.result = JSON.stringify(tk, null, 2);
    } else {
      state.external.toolkits = [];
      state.external.connections = [];
      state.external.nextCursor = null;
      state.external.totalItems = null;
    }
  }

  function updateSidebarBlurb() {
    const rows = visibleProfiles();
    const cmds = rows.reduce((n, p) => n + (p.commandCount || 0), 0);
    if (els.sidebarBlurb) {
      els.sidebarBlurb.textContent = rows.length
        ? `${rows.length} apps · ${cmds} commands available`
        : "Pick an app to see what other apps can ask it to do.";
    }
  }

  function setPage(page) {
    state.page = page;
    if (page === "directory") state.selectedId = null;
    els.nav?.querySelectorAll(".nav-item").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.page === page);
    });
    const showBack = page === "profile";
    els.btnBack?.classList.toggle("hidden", !showBack);
    els.searchInput?.classList.toggle("hidden", page !== "directory");
    void refresh();
  }

  function openProfile(moduleId) {
    state.selectedId = moduleId;
    state.page = "profile";
    els.btnBack?.classList.remove("hidden");
    els.searchInput?.classList.add("hidden");
    paintProfile();
  }

  function paintDirectory() {
    els.pageTitle.textContent = "Apps on Pulse";
    els.pageSubtitle.textContent = "Choose an app to see the commands it accepts from other apps";

    const rows = visibleProfiles();
    if (!rows.length) {
      els.content.innerHTML = `
        <div class="empty-state">
          <h3>No apps yet</h3>
          <p>When an app adds a Pulse profile, it will show up here.</p>
        </div>`;
      return;
    }

    els.content.innerHTML = `
      <div class="app-list">
        ${rows
          .map(
            (p) => `
          <button type="button" class="app-row" data-module="${escapeHtml(p.moduleId)}">
            ${logoHtml(p)}
            <div class="app-row-text">
              <strong>${escapeHtml(p.name || p.moduleId)}</strong>
              <span>${escapeHtml(p.tagline || p.description || "")}</span>
            </div>
            <div class="app-row-meta">
              ${p.isExternal ? `<span class="pill pill--external">External</span>` : ""}
              ${p.isService && !p.isExternal ? `<span class="pill pill--service">Service</span>` : ""}
              <span>${p.commandCount || 0} command${(p.commandCount || 0) === 1 ? "" : "s"}</span>
              ${(p.eventCount || 0) > 0 ? `<span>${p.eventCount} event${p.eventCount === 1 ? "" : "s"}</span>` : ""}
            </div>
            <span class="app-row-chevron" aria-hidden="true">›</span>
          </button>`
          )
          .join("")}
      </div>`;

    els.content.querySelectorAll(".app-row").forEach((btn) => {
      btn.addEventListener("click", () => openProfile(btn.dataset.module));
    });
  }

  function paintCommand(moduleId, cmd) {
    const fields = Object.keys(cmd.input || {});
    const hint = fields.length
      ? fields.map((f) => `<code>${escapeHtml(f)}</code>`).join(" ")
      : "No parameters";
    const placeholder = fields.map((f) => `${f}=`).join(" ") || "optional args…";

    return `
      <article class="cmd-card">
        <div class="cmd-card-top">
          <div>
            <h4>${escapeHtml(cmd.title || cmd.verb)}</h4>
            <p>${escapeHtml(cmd.description || "")}</p>
          </div>
          <span class="pill">${escapeHtml(deliveryLabel(cmd.delivery))}</span>
        </div>
        <div class="cmd-card-params">
          <span class="params-label">Needs</span>
          <span class="params-list">${hint}</span>
        </div>
        <details class="cmd-try">
          <summary>Try this command</summary>
          <form class="try-form" data-verb="${escapeHtml(cmd.verb)}">
            <input type="text" name="args" placeholder="${escapeHtml(placeholder)}" spellcheck="false" autocomplete="off" />
            <button type="submit" class="btn btn-primary">Send</button>
          </form>
        </details>
      </article>`;
  }

  function paintEvent(evt) {
    return `
      <article class="cmd-card cmd-card--event">
        <div class="cmd-card-top">
          <div>
            <h4>${escapeHtml(evt.title || evt.id)}</h4>
            <p>${escapeHtml(evt.description || "")}</p>
          </div>
          <span class="pill pill-event">Broadcasts</span>
        </div>
        <div class="cmd-card-params">
          <span class="params-label">Topic</span>
          <code class="topic">${escapeHtml(evt.id)}</code>
        </div>
      </article>`;
  }

  function paintProfile() {
    const p = state.profiles.find((x) => x.moduleId === state.selectedId);
    if (!p) {
      setPage("directory");
      return;
    }

    els.pageTitle.textContent = p.name || p.moduleId;
    els.pageSubtitle.textContent = p.tagline || p.description || "";

    const commands = p.commands || [];
    const events = p.events || [];

    els.content.innerHTML = `
      <header class="profile-hero">
        ${logoHtml(p, "app-logo--lg")}
        <div>
          <h2>${escapeHtml(p.name || p.moduleId)}${
            p.isService ? ` <span class="pill pill--service">Service</span>` : ""
          }</h2>
          <p>${escapeHtml(p.tagline || p.description || "")}</p>
        </div>
      </header>

      <section class="block">
        <h3>Commands other apps can send</h3>
        ${
          commands.length
            ? `<div class="cmd-list">${commands.map((c) => paintCommand(p.moduleId, c)).join("")}</div>`
            : `<p class="quiet">This app has not published any commands yet.</p>`
        }
      </section>

      <section class="block">
        <h3>Events this app can broadcast</h3>
        ${
          events.length
            ? `<div class="cmd-list">${events.map((e) => paintEvent(e)).join("")}</div>`
            : `<p class="quiet">No events published yet.</p>`
        }
      </section>

      <div class="result-panel ${state.lastResult ? "" : "hidden"}" id="profile-result">
        <h4>Response</h4>
        <pre></pre>
      </div>`;

    const pre = els.content.querySelector("#profile-result pre");
    if (pre && state.lastResult) pre.textContent = state.lastResult;

    els.content.querySelectorAll(".try-form").forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const verb = form.dataset.verb;
        const args = parseKv(form.querySelector('[name="args"]')?.value);
        try {
          const res = await api("link.command.send", { target: p.moduleId, verb, args });
          state.lastResult = JSON.stringify(res, null, 2);
          const box = document.getElementById("profile-result");
          if (box) {
            box.classList.remove("hidden");
            box.querySelector("pre").textContent = state.lastResult;
          }
        } catch (err) {
          showBanner(err.message || "Command failed", true);
        }
      });
    });
  }

  function paintExternal() {
    els.pageTitle.textContent = "External tools";
    els.pageSubtitle.textContent = "Connect accounts and call tools outside My Space";

    const st = state.external.status || {};
    const hasKey = !!st.hasKey;
    const connections = state.external.connections || [];
    const toolkits = state.external.toolkits || [];
    const connectedSlugs = new Set(
      connections
        .filter((c) => c.active !== false && /^(ACTIVE|SUCCESS|CONNECTED)$/i.test(String(c.status || "ACTIVE")))
        .map((c) => String(c.toolkit || "").trim().toLowerCase())
        .filter(Boolean)
    );
    const pending = state.external.pendingConnect || null;

    els.content.innerHTML = `
      <section class="ext-panel">
        <header class="ext-hero">
          <img src="logo.png" width="44" height="44" alt="" />
          <div>
            <h2>Composio on Pulse</h2>
            <p>Connect Gmail, GitHub, Slack and more, then call them from Pulse.</p>
          </div>
        </header>

        <div class="ext-status ${hasKey ? "is-ready" : ""}">
          <div>
            <strong>${hasKey ? "Composio ready" : "API key required"}</strong>
            <span>${
              hasKey
                ? `Key ${escapeHtml(st.keyPreview || "••••")} · ${connections.length} connected account${connections.length === 1 ? "" : "s"}`
                : "Get a key at dashboard.composio.dev → Project settings → API keys"
            }</span>
          </div>
        </div>

        ${
          hasKey
            ? `
        <details class="ext-details">
          <summary>API key &amp; allowlist</summary>
          <form class="ext-form" id="ext-key-form">
            <label>
              Replace Composio API key
              <input type="password" name="apiKey" placeholder="••••••••" autocomplete="off" spellcheck="false" />
            </label>
            <div class="ext-form-actions">
              <button type="submit" class="btn btn-primary">Save key</button>
              <button type="button" class="btn" id="ext-clear-key">Clear</button>
            </div>
          </form>
          <form class="ext-form" id="ext-allow-form">
            <label>
              Toolkit allowlist <span class="quiet">(empty = popular defaults on sync)</span>
              <input type="text" name="allowlist" value="${escapeHtml((st.allowlist || []).join(", "))}" placeholder="gmail, github, slack" spellcheck="false" />
            </label>
            <div class="ext-form-actions">
              <button type="submit" class="btn">Save allowlist</button>
              <button type="button" class="btn btn-primary" id="ext-sync">Sync to Pulse directory</button>
            </div>
          </form>
        </details>

        ${
          pending
            ? `<div class="ext-pending" id="ext-pending">
                <strong>Finish signing in to ${escapeHtml(pending)}</strong>
                <span>Complete the browser window, then this page will refresh. You can also press Check now.</span>
                <button type="button" class="btn" id="ext-check-now">Check now</button>
              </div>`
            : ""
        }

        <section class="ext-section">
          <div class="ext-block-head">
            <h3>Toolkits <span class="ext-count">${toolkits.length}${state.external.totalItems != null ? ` / ${state.external.totalItems}` : ""}</span></h3>
            <div class="ext-block-actions">
              <form id="ext-search-form" class="ext-inline">
                <input type="search" name="q" value="${escapeHtml(state.external.toolkitQ)}" placeholder="Search…" />
                <button type="submit" class="btn">Find</button>
              </form>
              <button type="button" class="btn" id="ext-refresh-conn">Refresh</button>
            </div>
          </div>
          <div class="ext-tile-grid">
            ${
              toolkits.length
                ? toolkits
                    .map((t) => {
                      const slug = String(t.slug || "").toLowerCase();
                      const isOn = connectedSlugs.has(slug);
                      const busy = pending === slug;
                      const logo =
                        t.logo ||
                        `https://logos.composio.dev/api/${encodeURIComponent(slug || "composio")}`;
                      return `
                  <article class="ext-tile ${isOn ? "is-connected" : ""} ${busy ? "is-busy" : ""}">
                    <div class="ext-tile-logo">
                      <img src="${escapeHtml(logo)}" alt="" loading="lazy" width="48" height="48" />
                    </div>
                    <strong class="ext-tile-name">${escapeHtml(t.name || t.slug)}</strong>
                    <span class="ext-tile-slug">${escapeHtml(t.slug)}</span>
                    ${
                      isOn
                        ? `<button type="button" class="ext-tile-btn is-connected" disabled>Connected</button>`
                        : `<button type="button" class="ext-tile-btn" data-connect="${escapeHtml(t.slug)}" ${busy ? "disabled" : ""}>${busy ? "Opening…" : "Connect"}</button>`
                    }
                  </article>`;
                    })
                    .join("")
                : `<p class="quiet ext-tile-empty">No toolkits loaded. Check your key or search.</p>`
            }
          </div>
          ${
            state.external.nextCursor
              ? `<div class="ext-load-more">
                  <button type="button" class="btn btn-primary" id="ext-load-more">Load more toolkits</button>
                </div>`
              : ""
          }
        </section>

        <details class="ext-details">
          <summary>Try execute (advanced)</summary>
          <form class="ext-form" id="ext-exec-form">
            <label>
              Tool slug
              <input type="text" name="tool" placeholder="GMAIL_FETCH_EMAILS" spellcheck="false" />
            </label>
            <label>
              Arguments (JSON)
              <textarea name="arguments" rows="3" placeholder="{}"></textarea>
            </label>
            <button type="submit" class="btn btn-primary">Execute</button>
          </form>
        </details>
        `
            : `
        <form class="ext-form" id="ext-key-form">
          <label>
            Composio API key
            <input type="password" name="apiKey" placeholder="ck_… or ak_…" autocomplete="off" spellcheck="false" />
          </label>
          <div class="ext-form-actions">
            <button type="submit" class="btn btn-primary">Save key</button>
          </div>
        </form>
        `
        }

        <div class="result-panel ${state.external.result ? "" : "hidden"}" id="ext-result">
          <h4>Last response</h4>
          <pre>${escapeHtml(state.external.result || "")}</pre>
        </div>
      </section>`;

    const showResult = (res) => {
      const slim =
        res && typeof res === "object"
          ? {
              ok: res.ok,
              error: res.error,
              warning: res.warning,
              toolkit: res.toolkit,
              tool: res.tool,
              opened: res.opened,
              url: res.url,
              hasKey: res.hasKey,
              keyPreview: res.keyPreview,
              synced: res.synced,
              source: res.source,
            }
          : res;
      state.external.result = JSON.stringify(slim, null, 2);
      const box = document.getElementById("ext-result");
      if (box) {
        box.classList.remove("hidden");
        box.querySelector("pre").textContent = state.external.result;
      }
    };

    const stopConnectPoll = () => {
      if (state.external.pollTimer) {
        clearInterval(state.external.pollTimer);
        state.external.pollTimer = null;
      }
    };

    const refreshConnectionsOnly = async () => {
      const conn = await composio("listConnections");
      if (conn?.ok) {
        state.external.connections = conn.connections || [];
        const statusRes = await composio("status");
        if (statusRes?.ok || statusRes?.hasKey != null) state.external.status = statusRes;
      }
      return conn;
    };

    const startConnectPoll = (toolkit) => {
      stopConnectPoll();
      state.external.pendingConnect = toolkit;
      let ticks = 0;
      state.external.pollTimer = setInterval(async () => {
        ticks += 1;
        try {
          await refreshConnectionsOnly();
          const nowOn = (state.external.connections || []).some((c) => {
            const slug = String(c.toolkit || "").toLowerCase();
            const active =
              c.active === true || /^(ACTIVE|SUCCESS|CONNECTED)$/i.test(String(c.status || ""));
            return slug === toolkit && active;
          });
          if (nowOn || ticks >= 40) {
            stopConnectPoll();
            state.external.pendingConnect = null;
            paintExternal();
            if (nowOn) showBanner(`${toolkit} connected`);
            else if (ticks >= 40) showBanner(`Still waiting for ${toolkit} — try Connect again if needed`, true);
          }
        } catch {
        }
      }, 3000);
    };

    els.content.querySelector("#ext-key-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const apiKey = e.target.apiKey?.value?.trim();
      if (!apiKey) return showBanner("Paste an API key first", true);
      try {
        const res = await composio("setKey", { apiKey });
        showResult(res);
        e.target.apiKey.value = "";
        await loadExternal();
        paintExternal();
        showBanner(res?.ok ? "API key saved" : res?.error || "Save failed", !res?.ok);
      } catch (err) {
        showBanner(err.message || "Save failed", true);
      }
    });

    els.content.querySelector("#ext-clear-key")?.addEventListener("click", async () => {
      try {
        await composio("clearKey");
        state.external.result = null;
        stopConnectPoll();
        state.external.pendingConnect = null;
        await loadExternal();
        paintExternal();
        showBanner("API key cleared");
      } catch (err) {
        showBanner(err.message || "Clear failed", true);
      }
    });

    els.content.querySelector("#ext-allow-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const raw = e.target.allowlist?.value || "";
      const allowlist = raw
        .split(/[,\s]+/)
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean);
      try {
        const res = await composio("setAllowlist", { allowlist });
        showResult(res);
        await loadExternal();
        paintExternal();
      } catch (err) {
        showBanner(err.message || "Allowlist failed", true);
      }
    });

    els.content.querySelector("#ext-sync")?.addEventListener("click", async () => {
      try {
        showBanner("Syncing Composio profiles…");
        const res = await composio("sync");
        showResult(res);
        await api("link.routes.reload", {});
        await loadProfiles();
        showBanner(res?.ok ? `Synced ${res.synced || 0} toolkit profile(s)` : res?.error || "Sync failed", !res?.ok);
      } catch (err) {
        showBanner(err.message || "Sync failed", true);
      }
    });

    els.content.querySelector("#ext-search-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      state.external.toolkitQ = e.target.q?.value || "";
      try {
        await loadExternal();
        paintExternal();
      } catch (err) {
        showBanner(err.message || "Search failed", true);
      }
    });

    els.content.querySelector("#ext-load-more")?.addEventListener("click", async () => {
      const btn = els.content.querySelector("#ext-load-more");
      if (!state.external.nextCursor) return;
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Loading…";
      }
      try {
        const tk = await composio("listToolkits", {
          q: state.external.toolkitQ || undefined,
          cursor: state.external.nextCursor,
          limit: 500,
          pageSize: 250,
        });
        if (!tk?.ok) {
          showBanner(tk?.error || "Load more failed", true);
          if (btn) {
            btn.disabled = false;
            btn.textContent = "Load more toolkits";
          }
          return;
        }
        const seen = new Set(state.external.toolkits.map((t) => t.slug));
        for (const row of tk.toolkits || []) {
          if (!seen.has(row.slug)) {
            seen.add(row.slug);
            state.external.toolkits.push(row);
          }
        }
        state.external.nextCursor = tk.nextCursor || null;
        if (tk.totalItems != null) state.external.totalItems = tk.totalItems;
        paintExternal();
      } catch (err) {
        showBanner(err.message || "Load more failed", true);
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Load more toolkits";
        }
      }
    });

    els.content.querySelector("#ext-refresh-conn")?.addEventListener("click", async () => {
      try {
        await refreshConnectionsOnly();
        paintExternal();
        showBanner("Connections refreshed");
      } catch (err) {
        showBanner(err.message || "Refresh failed", true);
      }
    });

    els.content.querySelector("#ext-check-now")?.addEventListener("click", async () => {
      try {
        await refreshConnectionsOnly();
        const toolkit = state.external.pendingConnect;
        const on = (state.external.connections || []).some((c) => {
          const slug = String(c.toolkit || "").toLowerCase();
          const active =
            c.active === true || /^(ACTIVE|SUCCESS|CONNECTED)$/i.test(String(c.status || ""));
          return slug === toolkit && active;
        });
        if (on) {
          stopConnectPoll();
          state.external.pendingConnect = null;
          showBanner(`${toolkit} connected`);
        } else {
          showBanner(`${toolkit || "Account"} is not active yet`, true);
        }
        paintExternal();
      } catch (err) {
        showBanner(err.message || "Check failed", true);
      }
    });

    els.content.querySelectorAll("[data-connect]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const toolkit = btn.getAttribute("data-connect");
        btn.disabled = true;
        btn.textContent = "Opening…";
        try {
          const res = await composio("connect", { toolkit, open: true });
          showResult(res);
          if (!res?.ok) {
            showBanner(res?.error || "Connect failed", true);
            btn.disabled = false;
            btn.textContent = "Connect";
            return;
          }
          if (res.warning) {
            showBanner(res.warning, true);
          } else {
            showBanner(`Browser opened for ${toolkit} — finish sign-in there`);
          }
          startConnectPoll(String(toolkit).toLowerCase());
          paintExternal();
        } catch (err) {
          showBanner(err.message || "Connect failed", true);
          btn.disabled = false;
          btn.textContent = "Connect";
        }
      });
    });

    els.content.querySelector("#ext-exec-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const tool = e.target.tool?.value?.trim();
      let arguments_ = {};
      try {
        arguments_ = JSON.parse(e.target.arguments?.value || "{}");
      } catch {
        showBanner("Arguments must be valid JSON", true);
        return;
      }
      if (!tool) return showBanner("Tool slug required", true);
      try {
        const res = await composio("execute", { tool, arguments: arguments_ });
        const slim = {
          ok: res?.ok,
          error: res?.error,
          tool: res?.tool,
          source: res?.source,
          result: res?.result,
        };
        state.external.result = JSON.stringify(slim, null, 2);
        const box = document.getElementById("ext-result");
        if (box) {
          box.classList.remove("hidden");
          box.querySelector("pre").textContent = state.external.result;
        }
        showBanner(res?.ok ? "Executed" : res?.error || "Execute failed", !res?.ok);
      } catch (err) {
        showBanner(err.message || "Execute failed", true);
      }
    });
  }

  function paintActivity() {
    els.pageTitle.textContent = "Recent activity";
    els.pageSubtitle.textContent = "Commands and events that recently went through Pulse";

    if (!state.log.length) {
      els.content.innerHTML = `
        <div class="empty-state">
          <h3>Nothing yet</h3>
          <p>Activity will show up here when apps talk to each other.</p>
        </div>`;
      return;
    }

    els.content.innerHTML = `
      <div class="activity-list">
        ${state.log
          .map((row) => {
            const when = String(row.at || "").replace("T", " ").slice(0, 19);
            const label = row.route || row.topic || "—";
            const kind =
              row.kind === "event"
                ? "Event"
                : row.kind === "command-ui" || row.kind === "command-ipc"
                  ? "Command"
                  : row.kind || "Update";
            return `
              <div class="activity-row">
                <span class="activity-kind">${escapeHtml(kind)}</span>
                <span class="activity-label">${escapeHtml(label)}</span>
                <span class="activity-from">${escapeHtml(row.caller || "")}</span>
                <span class="activity-time">${escapeHtml(when)}</span>
              </div>`;
          })
          .join("")}
      </div>`;
  }

  async function refresh() {
    showBanner(null);
    els.content.innerHTML = `<div class="loading-state"><div class="loading-bar"></div><p>Loading…</p></div>`;
    try {
      if (state.page === "activity") {
        await loadLog();
        paintActivity();
      } else if (state.page === "external") {
        await loadExternal();
        paintExternal();
      } else {
        await loadProfiles();
        if (state.page === "profile") paintProfile();
        else paintDirectory();
      }
    } catch (err) {
      state.error = err.message || "Load failed";
      showBanner(state.error, true);
      els.content.innerHTML = `
        <div class="empty-state">
          <h3>Could not load</h3>
          <p>${escapeHtml(state.error)}</p>
        </div>`;
    }
  }

  function bind() {
    els.nav?.querySelectorAll(".nav-item").forEach((btn) => {
      btn.addEventListener("click", () => setPage(btn.dataset.page || "directory"));
    });
    els.btnBack?.addEventListener("click", () => setPage("directory"));
    let searchTimer = null;
    els.searchInput?.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.search = els.searchInput.value || "";
        void refresh();
      }, 160);
    });
    els.btnReload?.addEventListener("click", async () => {
      try {
        await api("link.routes.reload", {});
        state.lastResult = null;
        await refresh();
      } catch (err) {
        showBanner(err.message || "Refresh failed", true);
      }
    });
  }

  async function applyRoute(route) {
    if (route?.moduleId || route?.target) {
      await loadProfiles();
      openProfile(route.moduleId || route.target);
      return;
    }
    if (route?.page === "activity" || route?.page === "log") {
      setPage("activity");
      return;
    }
    if (route?.page === "external" || route?.page === "composio") {
      setPage("external");
      return;
    }
    setPage("directory");
  }

  window.PulseApp = { setPage, openProfile, refresh, applyRoute };
  bind();
  void refresh();
})();