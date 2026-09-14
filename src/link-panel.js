(function () {
  let root = null;
  let open = false;
  let tab = "routes";
  let routes = { commands: [], events: [] };
  let subscriptions = [];
  let logEntries = [];
  let filter = "";
  let sendTarget = "notes";
  let sendVerb = "create";
  let sendArgs = "title=Hello from Pulse";
  let sendTopic = "pulse.ping";
  let sendPayload = "message=ping";
  let stats = null;

  function tt(key, fallback, vars) {
    const I = window.MySpaceI18n;
    const fb = fallback || key;
    const withVars = (s) => {
      if (!vars) return s;
      return String(s).replace(/\{(\w+)\}/g, (_, k) =>
        vars[k] != null ? String(vars[k]) : `{${k}}`
      );
    };
    if (!I?.t) return withVars(fb);
    const v = I.t(key, vars);
    return v === key ? withVars(fb) : v;
  }

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

  async function refresh() {
    const [routesRes, subsRes, logRes, statsRes] = await Promise.all([
      window.mySpace?.link?.routes?.(),
      window.mySpace?.link?.subscriptions?.(),
      window.mySpace?.link?.log?.({ limit: 80 }),
      window.mySpace?.link?.stats?.(),
    ]);
    routes = routesRes?.ok ? { commands: routesRes.commands || [], events: routesRes.events || [] } : { commands: [], events: [] };
    subscriptions = subsRes?.ok ? subsRes.subscriptions || [] : [];
    logEntries = logRes?.ok ? logRes.entries || [] : [];
    stats = statsRes?.ok ? statsRes : null;
    paint();
  }

  function filteredCommands() {
    const q = filter.trim().toLowerCase();
    if (!q) return routes.commands;
    return routes.commands.filter((r) =>
      `${r.id} ${r.title} ${r.description} ${r.target} ${r.delivery}`.toLowerCase().includes(q)
    );
  }

  function paintRoutes() {
    const list = root.querySelector("#link-panel-list");
    const meta = root.querySelector("#link-panel-meta");
    if (!list) return;
    const cmds = filteredCommands();
    meta.textContent = tt("service.pulse.commandsEvents", "{cmds} commands · {events} events", {
      cmds: cmds.length,
      events: routes.events.length,
    });
    if (!cmds.length) {
      list.innerHTML = `<p class="link-panel-empty">${escapeHtml(tt("service.pulse.noCommandsMatch", "No command routes match."))}</p>`;
      return;
    }
    list.innerHTML = cmds
      .map(
        (r) => `
      <article class="link-panel-row" data-route="${escapeHtml(r.id)}">
        <div>
          <strong>${escapeHtml(r.id)}</strong>
          <span>${escapeHtml(r.title)} · <em>${escapeHtml(r.delivery)}</em></span>
          <em>${escapeHtml(r.description)}</em>
        </div>
        <div class="link-panel-row-actions">
          <button type="button" data-fill-send="${escapeHtml(r.target)}" data-fill-verb="${escapeHtml(r.verb)}">${escapeHtml(tt("service.common.try", "Try"))}</button>
        </div>
      </article>`
      )
      .join("");

    list.querySelectorAll("[data-fill-send]").forEach((btn) => {
      btn.addEventListener("click", () => {
        sendTarget = btn.dataset.fillSend || "";
        sendVerb = btn.dataset.fillVerb || "";
        tab = "send";
        paintTabs();
        paintSend();
      });
    });
  }

  function paintEvents() {
    const list = root.querySelector("#link-panel-list");
    const meta = root.querySelector("#link-panel-meta");
    if (!list) return;
    const q = filter.trim().toLowerCase();
    const evts = routes.events.filter((r) =>
      !q ? true : `${r.id} ${r.title} ${r.description}`.toLowerCase().includes(q)
    );
    meta.textContent = tt("service.pulse.eventTopics", "{count} event topics", { count: evts.length });
    if (!evts.length) {
      list.innerHTML = `<p class="link-panel-empty">${escapeHtml(tt("service.pulse.noEventsMatch", "No events match."))}</p>`;
      return;
    }
    list.innerHTML = evts
      .map(
        (r) => `
      <article class="link-panel-row">
        <div>
          <strong>${escapeHtml(r.id)}</strong>
          <span>${escapeHtml(r.title)}</span>
          <em>${escapeHtml(r.description)}</em>
        </div>
        <div class="link-panel-row-actions">
          <button type="button" data-fill-topic="${escapeHtml(r.id)}">${escapeHtml(tt("service.pulse.publish", "Publish"))}</button>
        </div>
      </article>`
      )
      .join("");
    list.querySelectorAll("[data-fill-topic]").forEach((btn) => {
      btn.addEventListener("click", () => {
        sendTopic = btn.dataset.fillTopic || "";
        tab = "send";
        paintTabs();
        paintSend();
      });
    });
  }

  function paintSubscriptions() {
    const list = root.querySelector("#link-panel-list");
    const meta = root.querySelector("#link-panel-meta");
    if (!list) return;
    meta.textContent = tt("service.pulse.activeSubs", "{count} active subscriptions", {
      count: subscriptions.length,
    });
    if (!subscriptions.length) {
      list.innerHTML = `<p class="link-panel-empty">${escapeHtml(tt("service.pulse.noSubs", "No windows are subscribed yet. Apps call Link.subscribe(…) on load."))}</p>`;
      return;
    }
    list.innerHTML = subscriptions
      .map(
        (s) => `
      <article class="link-panel-row">
        <div>
          <strong>${escapeHtml(s.moduleId || s.caller)}</strong>
          <span>wc #${escapeHtml(s.webContentsId)}</span>
          <em>${escapeHtml((s.topics || []).join(" · "))}</em>
        </div>
      </article>`
      )
      .join("");
  }

  function paintLog() {
    const list = root.querySelector("#link-panel-list");
    const meta = root.querySelector("#link-panel-meta");
    if (!list) return;
    meta.textContent = stats
      ? tt("service.pulse.logEntries", "{count} log entries", { count: stats.total || 0 })
      : tt("service.pulse.entries", "{count} entries", { count: logEntries.length });
    if (!logEntries.length) {
      list.innerHTML = `<p class="link-panel-empty">${escapeHtml(tt("service.pulse.noActivity", "No activity yet. Send a command or publish an event."))}</p>`;
      return;
    }
    const failedLabel = tt("service.pulse.failed", "failed");
    list.innerHTML = logEntries
      .map(
        (e) => `
      <article class="link-panel-row link-panel-log-row">
        <div>
          <strong>${escapeHtml(e.kind || "?")}</strong>
          <span>${escapeHtml(e.at || "")}</span>
          <em>${escapeHtml(e.route || e.topic || "")} · ${escapeHtml(e.caller || "")}${
            e.ok === false ? ` · ${escapeHtml(failedLabel)}` : ""
          }</em>
        </div>
      </article>`
      )
      .join("");
  }

  function paintSend() {
    const list = root.querySelector("#link-panel-list");
    const meta = root.querySelector("#link-panel-meta");
    if (!list) return;
    meta.textContent = tt("service.pulse.testCommands", "Test commands and events");
    list.innerHTML = `
      <div class="link-panel-form">
        <h3 class="link-panel-form-title">${escapeHtml(tt("service.pulse.sendCommand", "Send command"))}</h3>
        <label class="link-panel-field">
          <span>${escapeHtml(tt("service.pulse.target", "Target"))}</span>
          <input id="link-send-target" value="${escapeHtml(sendTarget)}" spellcheck="false" />
        </label>
        <label class="link-panel-field">
          <span>${escapeHtml(tt("service.pulse.verb", "Verb"))}</span>
          <input id="link-send-verb" value="${escapeHtml(sendVerb)}" spellcheck="false" />
        </label>
        <label class="link-panel-field">
          <span>${escapeHtml(tt("service.pulse.args", "Args (key=value …)"))}</span>
          <input id="link-send-args" value="${escapeHtml(sendArgs)}" spellcheck="false" />
        </label>
        <div class="link-panel-row-actions">
          <button type="button" id="link-send-cmd-btn">${escapeHtml(tt("service.pulse.sendCommand", "Send command"))}</button>
        </div>
        <h3 class="link-panel-form-title">${escapeHtml(tt("service.pulse.publishEvent", "Publish event"))}</h3>
        <label class="link-panel-field">
          <span>${escapeHtml(tt("service.pulse.topic", "Topic"))}</span>
          <input id="link-send-topic" value="${escapeHtml(sendTopic)}" spellcheck="false" />
        </label>
        <label class="link-panel-field">
          <span>${escapeHtml(tt("service.pulse.payload", "Payload (key=value …)"))}</span>
          <input id="link-send-payload" value="${escapeHtml(sendPayload)}" spellcheck="false" />
        </label>
        <div class="link-panel-row-actions">
          <button type="button" id="link-send-pub-btn">${escapeHtml(tt("service.pulse.publishEvent", "Publish event"))}</button>
        </div>
        <pre class="link-panel-uri" id="link-send-result">${escapeHtml(tt("service.pulse.ready", "Ready"))}</pre>
      </div>`;

    root.querySelector("#link-send-cmd-btn")?.addEventListener("click", async () => {
      sendTarget = root.querySelector("#link-send-target")?.value || "";
      sendVerb = root.querySelector("#link-send-verb")?.value || "";
      sendArgs = root.querySelector("#link-send-args")?.value || "";
      const out = root.querySelector("#link-send-result");
      const res = await window.mySpace?.link?.send?.({
        target: sendTarget,
        verb: sendVerb,
        args: parseKv(sendArgs),
      });
      if (out) out.textContent = JSON.stringify(res, null, 2);
      void refresh();
    });

    root.querySelector("#link-send-pub-btn")?.addEventListener("click", async () => {
      sendTopic = root.querySelector("#link-send-topic")?.value || "";
      sendPayload = root.querySelector("#link-send-payload")?.value || "";
      const out = root.querySelector("#link-send-result");
      const res = await window.mySpace?.link?.publish?.({
        topic: sendTopic,
        payload: parseKv(sendPayload),
      });
      if (out) out.textContent = JSON.stringify(res, null, 2);
      void refresh();
    });
  }

  function paintTabs() {
    root.querySelectorAll(".link-panel-tabs button").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.tab === tab);
    });
    const search = root.querySelector("#link-panel-search");
    if (search) search.classList.toggle("is-hidden", tab === "send" || tab === "log");
  }

  function repaintChrome() {
    if (!root) return;
    root.setAttribute("aria-label", tt("platform.pulse.name", "Pulse"));
    const brand = root.querySelector(".link-panel-brand div");
    if (brand) {
      const h2 = brand.querySelector("h2");
      const p = brand.querySelector("p");
      if (h2) h2.textContent = tt("platform.pulse.name", "Pulse");
      if (p) p.textContent = tt("platform.pulse.panelTagline", "Link Bus — commands & events between apps");
    }
    root.querySelector(".link-panel-close")?.setAttribute("aria-label", tt("service.common.close", "Close"));
    const expandBtn = root.querySelector("#link-panel-expand");
    if (expandBtn) {
      const expanded = root.querySelector(".link-panel-shell")?.classList.contains("is-expanded");
      expandBtn.title = expanded
        ? tt("service.common.restore", "Restore panel size")
        : tt("service.common.expand", "Expand panel");
      expandBtn.setAttribute("aria-label", expandBtn.title);
    }
    const tabs = {
      routes: tt("service.pulse.routes", "Routes"),
      events: tt("service.pulse.events", "Events"),
      subs: tt("service.pulse.subscriptions", "Subscriptions"),
      log: tt("service.pulse.log", "Log"),
      send: tt("service.pulse.sendTab", "Send"),
    };
    root.querySelectorAll(".link-panel-tabs button").forEach((btn) => {
      const id = btn.dataset.tab;
      if (tabs[id]) btn.textContent = tabs[id];
    });
    const search = root.querySelector("#link-panel-search");
    if (search) search.placeholder = tt("service.pulse.filterRoutes", "Filter routes…");
    const refreshBtn = root.querySelector("#link-panel-refresh");
    if (refreshBtn) refreshBtn.textContent = tt("service.common.refresh", "Refresh");
    const foot = root.querySelector(".link-panel-foot span");
    if (foot) foot.textContent = tt("service.pulse.shellHint", "Shell: pulse(send notes create title=Hi) · pulse(pub pulse.ping message=hi)");
  }

  function paint() {
    paintTabs();
    if (tab === "routes") paintRoutes();
    else if (tab === "events") paintEvents();
    else if (tab === "subs") paintSubscriptions();
    else if (tab === "log") paintLog();
    else if (tab === "send") paintSend();
  }

  function ensure() {
    if (root) return root;
    root = document.createElement("div");
    root.id = "link-panel";
    root.className = "link-panel hidden";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", tt("platform.pulse.name", "Pulse"));
    root.innerHTML = `
      <div class="link-panel-shell">
        <header class="link-panel-head">
          <div class="link-panel-brand">
            <img src="brand/atom-violet.png" width="36" height="36" alt="" />
            <div>
              <h2>${escapeHtml(tt("platform.pulse.name", "Pulse"))}</h2>
              <p>${escapeHtml(tt("platform.pulse.panelTagline", "Link Bus — commands & events between apps"))}</p>
            </div>
          </div>
          <button type="button" class="link-panel-expand" id="link-panel-expand" title="${escapeHtml(tt("service.common.expand", "Expand panel"))}" aria-label="${escapeHtml(tt("service.common.expand", "Expand panel"))}">⤢</button>
          <button type="button" class="link-panel-close" aria-label="${escapeHtml(tt("service.common.close", "Close"))}">×</button>
        </header>
        <div class="link-panel-toolbar">
          <div class="link-panel-tabs">
            <button type="button" data-tab="routes" class="is-active">${escapeHtml(tt("service.pulse.routes", "Routes"))}</button>
            <button type="button" data-tab="events">${escapeHtml(tt("service.pulse.events", "Events"))}</button>
            <button type="button" data-tab="subs">${escapeHtml(tt("service.pulse.subscriptions", "Subscriptions"))}</button>
            <button type="button" data-tab="log">${escapeHtml(tt("service.pulse.log", "Log"))}</button>
            <button type="button" data-tab="send">${escapeHtml(tt("service.pulse.sendTab", "Send"))}</button>
          </div>
          <input id="link-panel-search" type="search" placeholder="${escapeHtml(tt("service.pulse.filterRoutes", "Filter routes…"))}" spellcheck="false" />
          <span id="link-panel-meta" class="link-panel-meta"></span>
        </div>
        <div class="link-panel-list" id="link-panel-list"></div>
        <footer class="link-panel-foot">
          <span>${escapeHtml(tt("service.pulse.shellHint", "Shell: pulse(send notes create title=Hi) · pulse(pub pulse.ping message=hi)"))}</span>
          <button type="button" id="link-panel-refresh">${escapeHtml(tt("service.common.refresh", "Refresh"))}</button>
        </footer>
      </div>`;

    root.querySelector(".link-panel-close").addEventListener("click", hide);
    root.querySelector("#link-panel-expand")?.addEventListener("click", () => {
      const shell = root.querySelector(".link-panel-shell");
      const btn = root.querySelector("#link-panel-expand");
      const expanded = shell?.classList.toggle("is-expanded");
      if (btn) {
        btn.title = expanded
          ? tt("service.common.restore", "Restore panel size")
          : tt("service.common.expand", "Expand panel");
        btn.setAttribute("aria-label", btn.title);
        btn.textContent = expanded ? "⤡" : "⤢";
      }
    });
    root.querySelectorAll(".link-panel-tabs button").forEach((btn) => {
      btn.addEventListener("click", () => {
        tab = btn.dataset.tab || "routes";
        paint();
      });
    });
    root.querySelector("#link-panel-search")?.addEventListener("input", (e) => {
      filter = e.target.value || "";
      if (tab === "routes" || tab === "events") paint();
    });
    root.querySelector("#link-panel-refresh")?.addEventListener("click", () => void refresh());
    root.addEventListener("click", (e) => {
      if (e.target === root) hide();
    });
    document.body.appendChild(root);
    return root;
  }

  async function show(nextTab) {
    if (window.MySpacePulse?.open) {
      const page =
        nextTab === "log" || nextTab === "activity"
          ? "activity"
          : nextTab === "events" || nextTab === "subs" || nextTab === "send" || nextTab === "routes"
            ? "directory"
            : nextTab || "directory";
      await window.MySpacePulse.open({ page });
      return;
    }
    await ensure();
    if (nextTab && ["routes", "events", "subs", "log", "send"].includes(nextTab)) tab = nextTab;
    filter = "";
    const search = root.querySelector("#link-panel-search");
    if (search) search.value = "";
    await refresh();
    open = true;
    root.classList.remove("hidden");
    if (tab === "routes") search?.focus();
  }

  function hide() {
    open = false;
    root?.classList.add("hidden");
  }

  function toggle() {
    if (open) hide();
    else void show();
  }

  function isOpen() {
    return open;
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) hide();
  });

  window.addEventListener("myspace-i18n-applied", () => {
    if (!open || !root) return;
    repaintChrome();
    paint();
  });

  window.MySpaceLinkPanel = { show, hide, toggle, isOpen, refresh };
})();
