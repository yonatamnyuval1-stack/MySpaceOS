window.WMSettings = (function () {
  const DEFAULTS = {
    language: "en",
    showMapHint: true,
    showNoteLabels: true,
    showZoomControls: true,
    confirmDelete: true,
  };

  const SCHEMA = [
    {
      id: "general",
      labelKey: "settingsSectionGeneral",
      items: [
        {
          key: "language",
          type: "select",
          labelKey: "language",
          hintKey: "languageHint",
          default: "en",
          options: [
            { value: "en", labelKey: "langEn" },
            { value: "he", labelKey: "langHe" },
          ],
        },
      ],
    },
    {
      id: "map",
      labelKey: "settingsSectionMap",
      items: [
        { key: "showMapHint", type: "toggle", labelKey: "showMapHint", hintKey: "showMapHintHint", default: true },
        { key: "showNoteLabels", type: "toggle", labelKey: "showNoteLabels", hintKey: "showNoteLabelsHint", default: true },
        { key: "showZoomControls", type: "toggle", labelKey: "showZoomControls", hintKey: "showZoomControlsHint", default: true },
        { key: "confirmDelete", type: "toggle", labelKey: "confirmDelete", hintKey: "confirmDeleteHint", default: true },
      ],
    },
  ];

  let settings = { ...DEFAULTS };
  let saveTimer = null;
  let onEffects = null;

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function get(key) {
    return settings[key] ?? DEFAULTS[key];
  }

  function merge(raw) {
    const out = { ...DEFAULTS };
    if (raw && typeof raw === "object") {
      for (const k of Object.keys(DEFAULTS)) {
        if (Object.prototype.hasOwnProperty.call(raw, k)) out[k] = raw[k];
      }
    }
    if (out.language !== "en" && out.language !== "he") out.language = "en";
    for (const sec of SCHEMA) {
      for (const item of sec.items) {
        if (item.type === "toggle") out[item.key] = out[item.key] !== false && out[item.key] !== "false";
      }
    }
    return out;
  }

  async function load() {
    try {
      settings = merge(await window.worldMaps.loadSettings());
    } catch {
      settings = { ...DEFAULTS };
    }
    return settings;
  }

  async function save() {
    settings = merge(settings);
    await window.worldMaps.saveSettings(settings);
    return settings;
  }

  async function setKey(key, value) {
    settings[key] = value;
    await save();
    if (key === "language") window.WMi18n.applyDom();
    onEffects?.(settings);
    return settings;
  }

  async function reset() {
    settings = { ...DEFAULTS };
    await save();
    window.WMi18n.applyDom();
    onEffects?.(settings);
    render(document.getElementById("settings-root"));
  }

  function flashSaving() {
    const el = document.getElementById("settings-saving");
    if (!el) return;
    el.classList.add("visible");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => el.classList.remove("visible"), 900);
  }

  function renderToggle(item) {
    const on = get(item.key) !== false;
    const onLabel = window.WMi18n.t("toggleOn");
    const offLabel = window.WMi18n.t("toggleOff");
    return `<div class="breaker-control">
      <button type="button" class="settings-toggle ${on ? "is-on" : "is-off"}" data-key="${escapeHtml(item.key)}" role="switch" aria-checked="${on}">
        <span class="settings-toggle-track"><span class="settings-toggle-thumb"></span></span>
      </button>
      <span class="breaker-state ${on ? "is-on" : "is-off"}">${on ? escapeHtml(onLabel) : escapeHtml(offLabel)}</span>
    </div>`;
  }

  function renderSelect(item) {
    const val = get(item.key);
    const opts = (item.options || [])
      .map(
        (o) =>
          `<option value="${escapeHtml(o.value)}"${String(o.value) === String(val) ? " selected" : ""}>${escapeHtml(window.WMi18n.t(o.labelKey))}</option>`
      )
      .join("");
    return `<div class="breaker-control breaker-select-wrap">
      <div class="breaker-select-slot">
        <select class="breaker-select" data-key="${escapeHtml(item.key)}">${opts}</select>
      </div>
    </div>`;
  }

  function renderPanel() {
    const sections = SCHEMA.map(
      (sec) => `<section class="settings-section">
        <h3 class="settings-section-label">${escapeHtml(window.WMi18n.t(sec.labelKey))}</h3>
        <div class="settings-breaker-grid">${sec.items
          .map(
            (item) => `<div class="breaker-row" data-setting="${escapeHtml(item.key)}">
              <div class="breaker-info">
                <span class="breaker-label">${escapeHtml(window.WMi18n.t(item.labelKey))}</span>
                <span class="breaker-hint">${escapeHtml(window.WMi18n.t(item.hintKey || ""))}</span>
              </div>
              ${item.type === "select" ? renderSelect(item) : renderToggle(item)}
            </div>`
          )
          .join("")}</div>
      </section>`
    ).join("");

    return `<div class="settings-panel-wrap">
      <div class="settings-panel">
        <header class="settings-panel-head">
          <h2 class="settings-panel-title">⚡ ${escapeHtml(window.WMi18n.t("settingsTitle"))}</h2>
          <span class="settings-panel-badge">${escapeHtml(window.WMi18n.t("settingsBadge"))}</span>
          <button type="button" class="btn btn-ghost btn-sm" id="settings-reset">${escapeHtml(window.WMi18n.t("resetDefaults"))}</button>
          <span class="settings-saving" id="settings-saving">${escapeHtml(window.WMi18n.t("saving"))}</span>
        </header>
        <p class="settings-panel-note">${escapeHtml(window.WMi18n.t("settingsNote"))}</p>
        ${sections}
      </div>
    </div>`;
  }

  function bindEvents(root) {
    root.querySelector("#settings-reset")?.addEventListener("click", async () => {
      if (!confirm(window.WMi18n.t("resetConfirm"))) return;
      await reset();
      flashSaving();
    });

    root.querySelectorAll(".settings-toggle").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const key = btn.dataset.key;
        const wasOn = btn.classList.contains("is-on");
        const next = !wasOn;
        const onLabel = window.WMi18n.t("toggleOn");
        const offLabel = window.WMi18n.t("toggleOff");
        btn.classList.toggle("is-on", next);
        btn.classList.toggle("is-off", !next);
        btn.setAttribute("aria-checked", String(next));
        const state = btn.closest(".breaker-row")?.querySelector(".breaker-state");
        if (state) {
          state.textContent = next ? onLabel : offLabel;
          state.classList.toggle("is-on", next);
          state.classList.toggle("is-off", !next);
        }
        try {
          await setKey(key, next);
          flashSaving();
        } catch (err) {
          alert(err.message);
          btn.classList.toggle("is-on", !next);
          btn.classList.toggle("is-off", next);
        }
      });
    });

    root.querySelectorAll(".breaker-select").forEach((sel) => {
      sel.addEventListener("change", async () => {
        try {
          await setKey(sel.dataset.key, sel.value);
          render(root);
          flashSaving();
        } catch (err) {
          alert(err.message);
        }
      });
    });
  }

  function render(root) {
    if (!root) return;
    root.innerHTML = renderPanel();
    bindEvents(root);
  }

  function open() {
    render(document.getElementById("settings-root"));
    const ov = document.getElementById("settings-overlay");
    ov?.classList.remove("hidden");
    ov?.setAttribute("aria-hidden", "false");
  }

  function close() {
    const ov = document.getElementById("settings-overlay");
    ov?.classList.add("hidden");
    ov?.setAttribute("aria-hidden", "true");
  }

  function setOnEffects(fn) {
    onEffects = fn;
  }

  return { load, save, get, setKey, reset, render, open, close, setOnEffects, DEFAULTS };
})();
