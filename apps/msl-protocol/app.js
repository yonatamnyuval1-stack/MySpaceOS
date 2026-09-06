(function () {
  const INPUT_HINTS = {
    "space.bodies.search": ["q"],
    "space.bodies.get": ["id"],
    "space.wiki.get": ["title"],
    "space.link.open": ["url"],
    "history.figures.list": ["q"],
    "history.events.list": ["q"],
    "history.entity.get": ["id"],
    "history.link.open": ["url"],
    "geography.countries.list": ["q"],
    "geography.countries.get": ["code"],
    "geography.learn.get": ["code"],
    "geography.maps.open": ["code"],
    "stocks.quote.get": ["symbol"],
    "stocks.search": ["q"],
    "icons.search": ["q"],
    "icons.get": ["id"],
    "icons.pick": ["q"],
    "translate.text": ["text", "to", "from"],
    "translate.detect": ["text"],
    "apps.catalog.get": ["id"],
    "apps.digest.get": ["id"],
    "maps.geocode": ["q"],
    "maps.reverseGeocode": ["lat", "lon"],
    "maps.country.at": ["lat", "lon"],
    "contacts.list": ["q"],
    "contacts.email.open": ["id"],
    "contacts.phone.open": ["id"],
    "builds.projects.get": ["id"],
    "builds.folder.open": ["id"],
    "studies.docs.get": ["id"],
    "studies.export.pdf": ["id"],
    "studies.export.docx": ["id"],
    "day-planner.task.toggle": ["id"],
    "clock.calendar.openUrl": ["url"],
  };

  const FIELD_PLACEHOLDERS = {
    id: "resource id",
    q: "search query",
    title: "title",
    url: "https://…",
    code: "e.g. IL",
    symbol: "e.g. AAPL",
    text: "text to translate",
    to: "target lang",
    from: "source lang",
    lat: "latitude",
    lon: "longitude",
  };

  const PAGES = ["caps", "keys", "mint", "inject", "about"];

  const state = {
    page: "caps",
    capabilities: [],
    targets: [],
    library: [],
    injections: {},
    capsQ: "",
    keysQ: "",
    mintFilter: "",
    /** @type {Record<string, { input: Record<string, string> }>} */
    selected: {},
    injectFilter: "",
  };

  const el = {
    nav: document.getElementById("main-nav"),
    blurb: document.getElementById("sidebar-blurb"),
    status: document.getElementById("status-line"),
    btnRefresh: document.getElementById("btn-refresh"),
    capsSearch: document.getElementById("caps-search"),
    capsMeta: document.getElementById("caps-meta"),
    capsList: document.getElementById("caps-list"),
    capsEmpty: document.getElementById("caps-empty"),
    keysSearch: document.getElementById("keys-search"),
    keysMeta: document.getElementById("keys-meta"),
    keysList: document.getElementById("keys-list"),
    keysEmpty: document.getElementById("keys-empty"),
    btnKeysMint: document.getElementById("btn-keys-mint"),
    mintFilter: document.getElementById("mint-filter"),
    mintCaps: document.getElementById("mint-caps"),
    mintSelCount: document.getElementById("mint-sel-count"),
    mintParamsHint: document.getElementById("mint-params-hint"),
    mintParams: document.getElementById("mint-params"),
    mintLabel: document.getElementById("mint-label"),
    mintPreview: document.getElementById("mint-preview"),
    mintTarget: document.getElementById("mint-target"),
    btnMintCopy: document.getElementById("btn-mint-copy"),
    btnMintSave: document.getElementById("btn-mint-save"),
    btnMintInject: document.getElementById("btn-mint-inject"),
    injectTarget: document.getElementById("inject-target"),
    injectKey: document.getElementById("inject-key"),
    btnInject: document.getElementById("btn-inject"),
    injectFilter: document.getElementById("inject-filter"),
    injectList: document.getElementById("inject-list"),
    injectEmpty: document.getElementById("inject-empty"),
  };

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setStatus(msg, kind) {
    if (!el.status) return;
    el.status.textContent = msg || "";
    el.status.classList.toggle("is-ok", kind === "ok");
    el.status.classList.toggle("is-err", kind === "err");
    if (msg) {
      clearTimeout(setStatus._t);
      setStatus._t = setTimeout(() => {
        el.status.textContent = "";
        el.status.classList.remove("is-ok", "is-err");
      }, 3200);
    }
  }

  function fieldKeysFor(capId) {
    return INPUT_HINTS[capId] || ["id", "q"];
  }

  function targetName(id) {
    return state.targets.find((t) => t.id === id)?.name || id;
  }

  function selectedIds() {
    return Object.keys(state.selected);
  }

  function countInjections() {
    return Object.values(state.injections || {}).reduce((n, list) => n + (list?.length || 0), 0);
  }

  function updateBlurb() {
    if (!el.blurb) return;
    el.blurb.textContent = `${state.capabilities.length} capabilities · ${state.library.length} keys · ${countInjections()} active links`;
  }

  function setPage(page) {
    const next = PAGES.includes(page) ? page : "caps";
    state.page = next;
    PAGES.forEach((p) => {
      document.getElementById(`view-${p}`)?.classList.toggle("hidden", p !== next);
    });
    el.nav?.querySelectorAll("[data-page]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.page === next);
    });
    if (next === "caps") paintCaps();
    if (next === "keys") paintKeys();
    if (next === "mint") {
      paintMintCaps();
      paintMintParams();
      updatePreview();
      fillTargetSelects();
    }
    if (next === "inject") {
      fillTargetSelects();
      fillInjectKeySelect();
      paintInjections();
    }
  }

  function buildDrafts() {
    const prefix = (el.mintLabel?.value || "").trim();
    return selectedIds().map((capId) => {
      const cap = state.capabilities.find((c) => c.id === capId);
      const input = { ...(state.selected[capId]?.input || {}) };
      for (const k of Object.keys(input)) {
        if (!String(input[k] || "").trim()) delete input[k];
      }
      let uri = `msl:v1/${capId}`;
      try {
        uri = window.MslKey?.build?.(capId, input) || uri;
      } catch {
        /* keep bare */
      }
      const label = prefix ? `${prefix} · ${cap?.title || capId}` : cap?.title || capId;
      return { capability: capId, input, uri, label };
    });
  }

  function updatePreview() {
    const drafts = buildDrafts();
    if (el.mintPreview) {
      el.mintPreview.textContent = drafts.length
        ? drafts.map((d) => d.uri).join("\n")
        : "Select tools to preview keys";
    }
    if (el.mintSelCount) el.mintSelCount.textContent = `${drafts.length} selected`;
  }

  function paintCaps() {
    const q = state.capsQ.trim().toLowerCase();
    const rows = state.capabilities.filter((c) => {
      if (!q) return true;
      return `${c.id} ${c.title || ""} ${c.description || ""} ${c.provider || ""} ${c.kind || ""}`
        .toLowerCase()
        .includes(q);
    });
    if (el.capsMeta) el.capsMeta.textContent = `${rows.length} of ${state.capabilities.length}`;
    if (!el.capsList) return;
    if (!rows.length) {
      el.capsList.innerHTML = "";
      el.capsEmpty?.classList.remove("hidden");
      if (el.capsEmpty) {
        el.capsEmpty.innerHTML = state.capabilities.length
          ? "<strong>No capabilities match</strong><p>Try another filter, or clear the search.</p>"
          : "<strong>No capabilities loaded</strong><p>Press Refresh, or restart My Space if this persists.</p>";
      }
      return;
    }
    el.capsEmpty?.classList.add("hidden");
    el.capsList.innerHTML = rows
      .map(
        (c) => `<div class="table-row" role="row">
        <span>
          <span class="cap-title">${escapeHtml(c.title || c.id)}</span>
          <span class="cap-id">${escapeHtml(c.id)}</span>
          ${c.description ? `<span class="cap-desc">${escapeHtml(c.description)}</span>` : ""}
        </span>
        <span><span class="pill muted">${escapeHtml(c.provider || "—")}</span></span>
        <span><span class="pill">${escapeHtml(c.kind || "—")}</span></span>
        <span class="row-actions">
          <button type="button" class="btn btn-sm" data-invoke="${escapeHtml(c.id)}">Invoke</button>
          <button type="button" class="btn btn-sm btn-primary" data-mint-from="${escapeHtml(c.id)}">Mint</button>
        </span>
      </div>`
      )
      .join("");
    el.capsList.querySelectorAll("[data-invoke]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          const res = await window.Msl.invoke(btn.dataset.invoke, {});
          setStatus(
            res?.ok === false ? res.error || "Invoke failed" : `Invoked ${btn.dataset.invoke}`,
            res?.ok === false ? "err" : "ok"
          );
        } catch (err) {
          setStatus(err?.message || String(err), "err");
        } finally {
          btn.disabled = false;
        }
      });
    });
    el.capsList.querySelectorAll("[data-mint-from]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.mintFrom;
        state.selected = { [id]: { input: {} } };
        setPage("mint");
      });
    });
  }

  function paintKeys() {
    const q = state.keysQ.trim().toLowerCase();
    let keys = state.library || [];
    if (q) {
      keys = keys.filter(
        (k) =>
          `${k.label || ""} ${k.uri || ""} ${k.capability || ""}`.toLowerCase().includes(q)
      );
    }
    if (el.keysMeta) el.keysMeta.textContent = `${keys.length} key${keys.length === 1 ? "" : "s"}`;
    if (!el.keysList) return;
    if (!keys.length) {
      el.keysList.innerHTML = "";
      el.keysEmpty?.classList.remove("hidden");
      return;
    }
    el.keysEmpty?.classList.add("hidden");
    el.keysList.innerHTML = keys
      .map(
        (k) => `<article class="key-row" data-id="${escapeHtml(k.id)}">
        <div>
          <strong>${escapeHtml(k.label || k.capability || k.id)}</strong>
          <div class="key-meta"><span class="pill">${escapeHtml(k.capability || "")}</span></div>
        </div>
        <div class="key-actions">
          <button type="button" class="btn btn-sm" data-resolve="${escapeHtml(k.uri || "")}">Resolve</button>
          <button type="button" class="btn btn-sm" data-copy="${escapeHtml(k.uri || "")}">Copy</button>
          <button type="button" class="btn btn-sm btn-primary" data-inject-lib="${escapeHtml(k.id)}">Inject</button>
          <button type="button" class="btn btn-sm btn-danger" data-del="${escapeHtml(k.id)}">Delete</button>
        </div>
        <pre class="key-uri">${escapeHtml(k.uri || "")}</pre>
      </article>`
      )
      .join("");

    el.keysList.querySelectorAll("[data-resolve]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const res = await window.Msl.resolveKey(btn.dataset.resolve);
        setStatus(
          res?.ok === false ? res.error || "Resolve failed" : `Resolved · ${res.capability || "ok"}`,
          res?.ok === false ? "err" : "ok"
        );
      });
    });
    el.keysList.querySelectorAll("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(btn.dataset.copy || "");
          setStatus("Copied", "ok");
        } catch {
          setStatus("Could not copy", "err");
        }
      });
    });
    el.keysList.querySelectorAll("[data-inject-lib]").forEach((btn) => {
      btn.addEventListener("click", () => {
        fillTargetSelects();
        fillInjectKeySelect();
        if (el.injectKey) el.injectKey.value = btn.dataset.injectLib;
        setPage("inject");
      });
    });
    el.keysList.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this key from the library?")) return;
        const res = await window.Msl.deleteKey({ id: btn.dataset.del });
        if (!res?.ok) return setStatus(res?.error || "Delete failed", "err");
        state.library = res.keys || [];
        paintKeys();
        updateBlurb();
        setStatus("Deleted", "ok");
      });
    });
  }

  function paintMintCaps() {
    const q = state.mintFilter.trim().toLowerCase();
    const groups = {};
    for (const cap of state.capabilities) {
      if (
        q &&
        !`${cap.id} ${cap.title || ""} ${cap.description || ""} ${cap.provider || ""}`
          .toLowerCase()
          .includes(q)
      ) {
        continue;
      }
      const g = cap.provider || "other";
      if (!groups[g]) groups[g] = [];
      groups[g].push(cap);
    }
    if (!el.mintCaps) return;
    el.mintCaps.innerHTML =
      Object.keys(groups)
        .sort()
        .map((g) => {
          const rows = groups[g]
            .map((c) => {
              const on = !!state.selected[c.id];
              return `<label class="cap-option ${on ? "is-on" : ""}">
              <input type="checkbox" data-cap="${escapeHtml(c.id)}" ${on ? "checked" : ""} />
              <span>
                <strong>${escapeHtml(c.title || c.id)}</strong>
                <small>${escapeHtml(c.id)}</small>
              </span>
            </label>`;
            })
            .join("");
          return `<div class="cap-group">${escapeHtml(g)}</div>${rows}`;
        })
        .join("") || `<p class="panel-hint">No tools match.</p>`;

    el.mintCaps.querySelectorAll("[data-cap]").forEach((inp) => {
      inp.addEventListener("change", () => {
        const id = inp.dataset.cap;
        if (inp.checked) state.selected[id] = state.selected[id] || { input: {} };
        else delete state.selected[id];
        paintMintCaps();
        paintMintParams();
        updatePreview();
      });
    });
  }

  function paintMintParams() {
    const ids = selectedIds();
    if (el.mintParamsHint) el.mintParamsHint.hidden = ids.length > 0;
    if (!el.mintParams) return;
    el.mintParams.innerHTML = ids
      .map((capId) => {
        const cap = state.capabilities.find((c) => c.id === capId);
        const keys = fieldKeysFor(capId);
        const input = state.selected[capId]?.input || {};
        const fields = keys
          .map(
            (k) => `<label class="field">
            <span>${escapeHtml(k)}</span>
            <input type="text" data-cap-param="${escapeHtml(capId)}" data-input-key="${escapeHtml(k)}"
              value="${escapeHtml(input[k] || "")}"
              placeholder="${escapeHtml(FIELD_PLACEHOLDERS[k] || k)}" autocomplete="off" />
          </label>`
          )
          .join("");
        return `<article class="param-card">
          <div class="param-card-head">
            <strong>${escapeHtml(cap?.title || capId)}</strong>
            <span>${escapeHtml(capId)}</span>
          </div>
          <div class="field-grid">${fields}</div>
        </article>`;
      })
      .join("");

    el.mintParams.querySelectorAll("[data-cap-param]").forEach((inp) => {
      inp.addEventListener("input", () => {
        const capId = inp.dataset.capParam;
        const key = inp.dataset.inputKey;
        if (!state.selected[capId]) state.selected[capId] = { input: {} };
        state.selected[capId].input[key] = inp.value;
        updatePreview();
      });
    });
  }

  function fillTargetSelects() {
    const opts = state.targets
      .map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name || t.id)}</option>`)
      .join("");
    if (el.mintTarget) el.mintTarget.innerHTML = opts || `<option value="">No targets</option>`;
    if (el.injectTarget) el.injectTarget.innerHTML = opts || `<option value="">No targets</option>`;
    if (el.injectFilter) {
      el.injectFilter.innerHTML =
        `<option value="">All apps</option>` +
        state.targets.map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name || t.id)}</option>`).join("");
      el.injectFilter.value = state.injectFilter || "";
    }
  }

  function fillInjectKeySelect() {
    if (!el.injectKey) return;
    const keys = state.library || [];
    el.injectKey.innerHTML = keys.length
      ? keys
          .map(
            (k) =>
              `<option value="${escapeHtml(k.id)}">${escapeHtml(k.label || k.capability || k.id)}</option>`
          )
          .join("")
      : `<option value="">Mint a key first</option>`;
  }

  function paintInjections() {
    const filter = state.injectFilter || el.injectFilter?.value || "";
    const rows = [];
    const map = state.injections || {};
    const appIds = filter ? [filter] : Object.keys(map);
    for (const appId of appIds) {
      for (const k of map[appId] || []) rows.push({ appId, ...k });
    }
    if (!el.injectList) return;
    if (!rows.length) {
      el.injectList.innerHTML = "";
      el.injectEmpty?.classList.remove("hidden");
      return;
    }
    el.injectEmpty?.classList.add("hidden");
    el.injectList.innerHTML = rows
      .map(
        (k) => `<article class="key-row">
        <div>
          <strong>${escapeHtml(k.label || k.capability || "")}</strong>
          <div class="key-meta">
            <span>→ ${escapeHtml(targetName(k.appId))}</span>
            <span class="pill">${escapeHtml(k.capability || "")}</span>
          </div>
        </div>
        <div class="key-actions">
          <button type="button" class="btn btn-sm btn-danger" data-rm-inj="${escapeHtml(k.appId)}" data-rm-uri="${escapeHtml(k.uri || "")}" data-rm-id="${escapeHtml(k.id || "")}">Remove</button>
        </div>
        <pre class="key-uri">${escapeHtml(k.uri || "")}</pre>
      </article>`
      )
      .join("");

    el.injectList.querySelectorAll("[data-rm-inj]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const res = await window.Msl.removeInjection({
          appId: btn.dataset.rmInj,
          uri: btn.dataset.rmUri,
          id: btn.dataset.rmId,
        });
        if (!res?.ok) return setStatus(res?.error || "Remove failed", "err");
        await refreshInjections();
        setStatus("Link removed", "ok");
      });
    });
  }

  async function saveLibrary() {
    const drafts = buildDrafts();
    if (!drafts.length) return setStatus("Select at least one tool", "err");
    let last = null;
    for (const d of drafts) {
      last = await window.Msl.saveKey({
        capability: d.capability,
        input: d.input,
        label: d.label,
        uri: d.uri,
      });
      if (!last?.ok) return setStatus(last?.error || "Save failed", "err");
    }
    state.library = last.keys || [];
    updateBlurb();
    setPage("keys");
    setStatus(`Saved ${drafts.length} key${drafts.length === 1 ? "" : "s"}`, "ok");
  }

  async function injectCurrent() {
    const drafts = buildDrafts();
    if (!drafts.length) return setStatus("Select at least one tool", "err");
    const appId = el.mintTarget?.value;
    if (!appId) return setStatus("Pick a target app", "err");
    let okCount = 0;
    for (const d of drafts) {
      const res = await window.Msl.injectKey({
        appId,
        capability: d.capability,
        input: d.input,
        label: d.label,
        uri: d.uri,
      });
      if (!res?.ok) return setStatus(res?.error || "Inject failed", "err");
      okCount += 1;
    }
    const lib = await window.Msl.listKeys();
    if (lib?.ok) state.library = lib.keys || [];
    await refreshInjections();
    state.injectFilter = appId;
    setPage("inject");
    setStatus(`Injected ${okCount} into ${targetName(appId)}`, "ok");
  }

  async function injectSaved() {
    const id = el.injectKey?.value;
    const appId = el.injectTarget?.value;
    const key = state.library.find((k) => k.id === id);
    if (!key) return setStatus("Pick a saved key", "err");
    if (!appId) return setStatus("Pick a target app", "err");
    const res = await window.Msl.injectKey({
      appId,
      uri: key.uri,
      label: key.label,
      capability: key.capability,
      id: key.id,
    });
    if (!res?.ok) return setStatus(res?.error || "Inject failed", "err");
    await refreshInjections();
    state.injectFilter = appId;
    if (el.injectFilter) el.injectFilter.value = appId;
    paintInjections();
    setStatus(`Injected into ${targetName(appId)}`, "ok");
  }

  async function refreshInjections() {
    const res = await window.Msl.listInjections();
    if (!res?.ok) return;
    state.injections = res.injections || {};
    if (res.targets?.length) state.targets = res.targets;
    paintInjections();
    updateBlurb();
  }

  async function refreshAll() {
    if (!window.Msl) {
      setStatus("MSL bridge unavailable", "err");
      if (el.capsEmpty) {
        el.capsEmpty.classList.remove("hidden");
        el.capsEmpty.innerHTML =
          "<strong>Could not connect</strong><p>Open MSL again from Platform → MSL.</p>";
      }
      return;
    }
    const [caps, targets, lib] = await Promise.all([
      window.Msl.list(),
      window.Msl.injectTargets(),
      window.Msl.listKeys(),
    ]);
    if (!caps?.ok) {
      setStatus(caps?.error || "Failed to list capabilities", "err");
      state.capabilities = [];
      if (el.capsList) el.capsList.innerHTML = "";
      if (el.capsEmpty) {
        el.capsEmpty.classList.remove("hidden");
        el.capsEmpty.innerHTML = `<strong>Could not load capabilities</strong><p>${escapeHtml(
          caps?.error || "Unknown error"
        )}</p>`;
      }
      return;
    }
    state.capabilities = caps.capabilities || [];
    state.targets = targets?.targets || [];
    state.library = lib?.keys || [];
    for (const id of Object.keys(state.selected)) {
      if (!state.capabilities.some((c) => c.id === id)) delete state.selected[id];
    }
    updateBlurb();
    await refreshInjections();
    if (state.page === "caps") paintCaps();
    if (state.page === "keys") paintKeys();
    if (state.page === "mint") {
      paintMintCaps();
      paintMintParams();
      updatePreview();
      fillTargetSelects();
    }
    if (state.page === "inject") {
      fillTargetSelects();
      fillInjectKeySelect();
      paintInjections();
    }
    if (!state.capabilities.length) {
      setStatus("No capabilities registered", "err");
    }
  }

  function applyRoute(route) {
    const raw = String(route?.page || route?.tab || route?.param || "caps")
      .toLowerCase()
      .trim();
    const alias = {
      capabilities: "caps",
      catalog: "caps",
      library: "keys",
      key: "keys",
      workshop: "mint",
      create: "mint",
      routes: "inject",
      links: "inject",
      active: "inject",
      home: "caps",
      open: "caps",
      panel: "caps",
    };
    setPage(alias[raw] || raw);
  }

  el.nav?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-page]");
    if (btn) setPage(btn.dataset.page);
  });
  el.btnRefresh?.addEventListener("click", () => void refreshAll().then(() => setStatus("Refreshed", "ok")));
  el.capsSearch?.addEventListener("input", () => {
    state.capsQ = el.capsSearch.value || "";
    paintCaps();
  });
  el.keysSearch?.addEventListener("input", () => {
    state.keysQ = el.keysSearch.value || "";
    paintKeys();
  });
  el.btnKeysMint?.addEventListener("click", () => setPage("mint"));
  el.mintFilter?.addEventListener("input", () => {
    state.mintFilter = el.mintFilter.value || "";
    paintMintCaps();
  });
  el.mintLabel?.addEventListener("input", updatePreview);
  el.btnMintCopy?.addEventListener("click", async () => {
    const text = el.mintPreview?.textContent || "";
    if (!text || text.startsWith("Select tools")) return;
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copied", "ok");
    } catch {
      setStatus("Copy failed", "err");
    }
  });
  el.btnMintSave?.addEventListener("click", () => void saveLibrary());
  el.btnMintInject?.addEventListener("click", () => void injectCurrent());
  el.btnInject?.addEventListener("click", () => void injectSaved());
  el.injectFilter?.addEventListener("change", () => {
    state.injectFilter = el.injectFilter.value || "";
    paintInjections();
  });

  window.MslApp = {
    setPage,
    applyRoute,
    refresh: refreshAll,
  };
  window.MslProtocolApp = window.MslApp;

  void refreshAll()
    .then(() => setPage("caps"))
    .catch((err) => setStatus(err?.message || String(err), "err"));
})();
