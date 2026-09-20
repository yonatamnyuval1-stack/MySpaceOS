(function () {
  const PAGE_ID = "app-settings";

  let appId = null;
  let schema = null;
  let settings = {};
  let saveTimer = null;
  let pageEl = null;
  let active = false;

  async function invoke(channel, args) {
    if (!window.myApp?.invoke) throw new Error("Settings require My Space.");
    return window.myApp.invoke(channel, args || {});
  }

  async function load() {
    const res = await invoke("settings.load");
    if (!res?.ok) throw new Error(res?.error || "Failed to load settings");
    schema = res.schema || window.APP_SETTINGS_SCHEMA?.[appId];
    settings = window.mergeAppSettings?.(schema, res.settings || {}) || res.settings || {};
    return settings;
  }

  async function setKey(key, value) {
    const res = await invoke("settings.set", { key, value });
    if (!res?.ok) throw new Error(res?.error || "Failed to save");
    settings = window.mergeAppSettings?.(schema, res.settings || {}) || { ...settings, [key]: value };
    document.dispatchEvent(
      new CustomEvent("app-setting-changed", {
        detail: { appId, key, value, settings },
      })
    );
    return settings;
  }

  function formatSelectLabel(item, value) {
    if (item.key === "vaultLockMinutes" && value === 0) return "Never";
    if (item.key === "uiLanguage" || item.key === "language") {
      const ui = window.MySpaceI18n?.getLanguage?.() || window.__myspaceAppUiLang || "en";
      if (value === "system") {
        return ui === "he" ? "מערכת" : ui === "ar" ? "النظام" : ui === "fr" ? "Système" : ui === "ru" ? "Система" : ui === "es" ? "Sistema" : "System";
      }
      const meta = window.MySpaceLanguages?.meta?.(value);
      if (meta) {
        // Prefer native name; when UI is English show English name for clarity
        return ui === "en" ? meta.name : meta.nativeName || meta.name;
      }
      if (value === "he") return ui === "he" ? "עברית" : "Hebrew";
      if (value === "en") return "English";
    }
    if (item.key.endsWith("Minutes") || item.key.endsWith("Minutes")) {
      return value === 1 ? "1 min" : `${value} min`;
    }
    if (item.key.endsWith("Seconds") || item.key === "connectionTimeout") {
      if (value >= 60 && value % 60 === 0) {
        const m = value / 60;
        return m === 1 ? "1 min" : `${m} min`;
      }
      return value === 1 ? "1 sec" : `${value} sec`;
    }
    if (item.key === "reminderDaysBefore" || item.key === "expiryDaysAhead") {
      return value === 0 ? "Same day" : value === 1 ? "1 day" : `${value} days`;
    }
    return String(value);
  }

  function renderToggle(item) {
    const on = window.toggleIsOn(settings[item.key], item.default);
    return `<div class="breaker-control">
      <button type="button" class="settings-toggle ${on ? "is-on" : "is-off"}" data-key="${escapeAttr(item.key)}" role="switch" aria-checked="${on}" aria-label="${escapeAttr(item.label)}">
        <span class="settings-toggle-track"><span class="settings-toggle-thumb"></span></span>
      </button>
      <span class="breaker-state ${on ? "is-on" : "is-off"}">${on ? "ON" : "OFF"}</span>
    </div>`;
  }

  function renderSelect(item) {
    const val = settings[item.key] ?? item.default;
    const opts = (item.options || [])
      .map(
        (o) =>
          `<option value="${escapeAttr(o)}"${String(o) === String(val) ? " selected" : ""}>${escapeHtml(formatSelectLabel(item, o))}</option>`
      )
      .join("");
    return `<div class="breaker-control breaker-select-wrap">
      <div class="breaker-select-slot">
        <select class="breaker-select" data-key="${escapeAttr(item.key)}" aria-label="${escapeAttr(item.label)}">${opts}</select>
      </div>
      <span class="breaker-state is-on">${escapeHtml(formatSelectLabel(item, val))}</span>
    </div>`;
  }

  function renderRow(item) {
    const control = item.type === "select" ? renderSelect(item) : renderToggle(item);
    return `<div class="breaker-row" data-setting="${escapeAttr(item.key)}">
      <div class="breaker-info">
        <span class="breaker-label">${escapeHtml(item.label)}</span>
        <span class="breaker-hint">${escapeHtml(item.hint || "")}</span>
      </div>
      ${control}
    </div>`;
  }

  function renderPanel() {
    if (!schema?.sections?.length) {
      return `<div class="settings-empty"><p>No configurable switches for this app yet.</p></div>`;
    }
    const sections = schema.sections
      .map(
        (sec) => `<section class="settings-section">
        <h3 class="settings-section-label">${escapeHtml(sec.label)}</h3>
        <div class="settings-breaker-grid">${(sec.items || []).map(renderRow).join("")}</div>
      </section>`
      )
      .join("");

    return `<div class="settings-panel-wrap">
      <div class="settings-panel">
        <header class="settings-panel-head">
          <h2 class="settings-panel-title">⚡ Control Panel</h2>
          <span class="settings-panel-badge">${escapeHtml(schema.title || appId)}</span>
          <button type="button" class="btn btn-ghost btn-sm" id="settings-reset">Reset defaults</button>
          <span class="settings-saving" id="settings-saving">Saving…</span>
        </header>
        <p class="settings-panel-note">Flip a switch: <strong>ON</strong> keeps the feature active, <strong>OFF</strong> turns it off.</p>
        ${sections}
      </div>
    </div>`;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  function flashSaving() {
    const el = document.getElementById("settings-saving");
    if (!el) return;
    el.classList.add("visible");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => el.classList.remove("visible"), 900);
  }

  function bindPanelEvents() {
    if (!pageEl) return;

    pageEl.querySelector("#settings-reset")?.addEventListener("click", async () => {
      if (!confirm("Reset all switches on this panel to their defaults?")) return;
      try {
        const res = await invoke("settings.reset");
        if (!res?.ok) throw new Error(res?.error || "Reset failed");
        settings = window.mergeAppSettings?.(schema, res.settings || {}) || res.settings || {};
        pageEl.innerHTML = renderPanel();
        bindPanelEvents();
        document.dispatchEvent(
          new CustomEvent("app-setting-changed", {
            detail: { appId, key: "*", value: null, settings },
          })
        );
        flashSaving();
      } catch (err) {
        alert(err.message);
      }
    });

    pageEl.querySelectorAll(".settings-toggle").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const key = btn.dataset.key;
        const wasOn = btn.classList.contains("is-on");
        const next = !wasOn;
        btn.classList.toggle("is-on", next);
        btn.classList.toggle("is-off", !next);
        btn.setAttribute("aria-checked", String(next));
        const row = btn.closest(".breaker-row");
        const state = row?.querySelector(".breaker-state");
        if (state) {
          state.textContent = next ? "ON" : "OFF";
          state.classList.toggle("is-on", next);
          state.classList.toggle("is-off", !next);
        }
        try {
          await setKey(key, next);
          flashSaving();
        } catch (err) {
          btn.classList.toggle("is-on", wasOn);
          btn.classList.toggle("is-off", !wasOn);
          btn.setAttribute("aria-checked", String(wasOn));
          if (state) {
            state.textContent = wasOn ? "ON" : "OFF";
            state.classList.toggle("is-on", wasOn);
            state.classList.toggle("is-off", !wasOn);
          }
          alert(err.message);
        }
      });
    });

    pageEl.querySelectorAll(".breaker-select").forEach((sel) => {
      sel.addEventListener("change", async () => {
        const key = sel.dataset.key;
        const raw = sel.value;
        const item = findItem(key);
        const value = item?.type === "select" && item.options?.every((o) => typeof o === "number")
          ? Number(raw)
          : raw;
        const state = sel.closest(".breaker-control")?.querySelector(".breaker-state");
        if (state && item) state.textContent = formatSelectLabel(item, value);
        try {
          await setKey(key, value);
          flashSaving();
        } catch (err) {
          alert(err.message);
        }
      });
    });
  }

  function findItem(key) {
    for (const sec of schema?.sections || []) {
      const item = (sec.items || []).find((i) => i.key === key);
      if (item) return item;
    }
    return null;
  }

  function ensurePage() {
    if (pageEl) return pageEl;
    const main = document.querySelector(".main");
    if (!main) return null;
    pageEl = document.createElement("section");
    pageEl.className = "page page--scroll page-app-settings";
    pageEl.id = "page-app-settings";
    pageEl.hidden = true;
    main.appendChild(pageEl);
    return pageEl;
  }

  function uiT(key, fallback) {
    const i18n = window.AppUiI18n || window.FlagQuizI18n || window.StocksI18n;
    const text = i18n?.t?.(key);
    return text && text !== key ? text : fallback;
  }

  function refreshSettingsChromeLabels() {
    const label = uiT("page.settings", "Settings") || uiT("nav.settings", "Settings");
    const navBtn = document.querySelector('#main-nav .nav-item[data-page="app-settings"]');
    if (navBtn) {
      const icon = navBtn.querySelector(".nav-icon");
      navBtn.innerHTML = "";
      if (icon) navBtn.appendChild(icon);
      else {
        const span = document.createElement("span");
        span.className = "nav-icon";
        span.textContent = "⚙";
        navBtn.appendChild(span);
      }
      navBtn.appendChild(document.createTextNode(` ${label}`));
    }
    const gear = document.querySelector(".topbar-settings-btn");
    if (gear) {
      gear.title = label;
      gear.setAttribute("aria-label", label);
    }
    if (active) {
      const title = document.getElementById("page-title");
      const subtitle = document.getElementById("page-subtitle");
      if (title) title.textContent = label;
      if (subtitle) subtitle.textContent = uiT("page.settings.sub", "Circuit panel: flip switches to control this app");
    }
  }

  function ensureNavButton() {
    const nav = document.getElementById("main-nav");
    const skipSidebarSettings = window.myApp?.moduleId === "stocks";

    if (nav && !nav.querySelector('[data-page="app-settings"]') && !skipSidebarSettings) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "nav-item nav-item--settings";
      btn.dataset.page = "app-settings";
      const label = uiT("page.settings", "Settings") || uiT("nav.settings", "Settings");
      btn.innerHTML = `<span class="nav-icon">⚙</span> ${label}`;
      nav.appendChild(btn);
    }

    const topbar = document.querySelector(".topbar");
    if (topbar && !topbar.querySelector(".topbar-settings-btn")) {
      const actions =
        topbar.querySelector(".topbar-actions") ||
        (() => {
          const div = document.createElement("div");
          div.className = "topbar-actions settings-topbar-actions";
          topbar.appendChild(div);
          return div;
        })();
      const gear = document.createElement("button");
      gear.type = "button";
      gear.className = "btn btn-ghost btn-sm topbar-settings-btn";
      gear.dataset.page = "app-settings";
      const label = uiT("page.settings", "Settings");
      gear.title = label;
      gear.setAttribute("aria-label", label);
      gear.textContent = "⚙";
      actions.appendChild(gear);
    }
  }

  function hideOtherPages() {
    document.querySelectorAll(".main > .page, .main > section.page").forEach((p) => {
      if (p.id !== "page-app-settings") {
        p.hidden = true;
        p.classList.remove("active");
      }
    });
    document.getElementById("project-view")?.classList.add("hidden");
  }

  async function showSettings() {
    ensurePage();
    if (!pageEl) return;
    active = true;
    hideOtherPages();
    pageEl.hidden = false;
    pageEl.classList.add("active");

    const title = document.getElementById("page-title");
    const subtitle = document.getElementById("page-subtitle");
    const brandSub = document.getElementById("brand-sub");
    if (title) title.textContent = uiT("page.settings", "Settings");
    if (subtitle) subtitle.textContent = uiT("page.settings.sub", "Circuit panel: flip switches to control this app");
    if (brandSub) brandSub.textContent = `⚡ ${schema?.title || uiT("page.settings", "Settings")}`;

    document.getElementById("app-shell")?.classList.add("settings-mode");
    document.querySelectorAll("#main-nav .nav-item[data-page], .topbar-settings-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.page === PAGE_ID);
    });

    try {
      await load();
      pageEl.innerHTML = renderPanel();
      bindPanelEvents();
    } catch (err) {
      pageEl.innerHTML = `<div class="settings-empty"><p>${escapeHtml(err.message)}</p></div>`;
    }
  }

  function hideSettings() {
    if (!active) return;
    active = false;
    pageEl?.classList.remove("active");
    pageEl && (pageEl.hidden = true);
    document.getElementById("app-shell")?.classList.remove("settings-mode");
    document.querySelectorAll(".nav-item[data-page='app-settings'], .topbar-settings-btn").forEach((btn) => {
      btn.classList.remove("active");
    });
    window.AppSettingsRuntime?.load?.();
    document.dispatchEvent(new CustomEvent("app-settings-closed", { detail: { appId } }));
  }

  function settingsNavButton(target) {
    return target.closest(".nav-item[data-page], .topbar-settings-btn[data-page]")?.dataset.page === PAGE_ID
      ? target.closest(".nav-item[data-page], .topbar-settings-btn[data-page]")
      : null;
  }

  function wireNavigation() {
    document.addEventListener(
      "click",
      (e) => {
        const btn = settingsNavButton(e.target);
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        if (active) hideSettings();
        else showSettings();
      },
      true
    );

    const nav = document.getElementById("main-nav");
    nav?.addEventListener(
      "click",
      (e) => {
        const btn = e.target.closest(".nav-item[data-page]");
        if (!btn || btn.dataset.page === PAGE_ID) return;
        hideSettings();
      },
      true
    );
  }

  async function boot() {
    appId = window.myApp?.moduleId;
    if (!appId || !window.APP_SETTINGS_SCHEMA?.[appId]) return;

    schema = window.APP_SETTINGS_SCHEMA[appId];
    ensureNavButton();
    ensurePage();
    wireNavigation();

    try {
      await load();
    } catch (_) {
    }
  }

  window.AppSettings = {
    get appId() {
      return appId;
    },
    get settings() {
      return { ...settings };
    },
    get: (key) => {
      const item = findItem(key);
      return settings[key] ?? item?.default;
    },
    load,
    set: setKey,
    refresh: async () => {
      await load();
      if (active && pageEl) {
        pageEl.innerHTML = renderPanel();
        bindPanelEvents();
      }
    },
    show: showSettings,
    hide: hideSettings,
    refreshLabels: refreshSettingsChromeLabels,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  document.addEventListener("myspace-app-i18n-applied", () => {
    refreshSettingsChromeLabels();
    if (active && pageEl) {
      pageEl.innerHTML = renderPanel();
      bindPanelEvents();
    }
  });
})();