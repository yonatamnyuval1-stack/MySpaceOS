
(function () {
  const STYLE_ID = "myspace-theme-buttons";

  const BUTTON_VARS = {
    default: null,
    soft: {
      "--theme-btn-bg": "var(--accent-dim, var(--accent-soft))",
      "--theme-btn-border": "transparent",
      "--theme-btn-radius": "999px",
      "--theme-btn-primary-bg": "var(--accent-dim, var(--accent-soft))",
      "--theme-btn-primary-image": "none",
      "--theme-btn-primary-color": "var(--accent)",
      "--theme-btn-primary-border": "transparent",
      "--theme-btn-ghost-bg": "transparent",
      "--theme-btn-ghost-border": "transparent",
      "--theme-btn-ghost-color": "var(--text-muted, var(--muted, var(--mute)))",
    },
    solid: {
      "--theme-btn-bg": "var(--bg-hover, var(--elevated, var(--panel-soft)))",
      "--theme-btn-border": "transparent",
      "--theme-btn-radius": "6px",
      "--theme-btn-primary-bg": "var(--accent)",
      "--theme-btn-primary-image": "none",
      "--theme-btn-primary-color": "#0b1220",
      "--theme-btn-primary-border": "transparent",
      "--theme-btn-ghost-bg": "var(--bg-elevated, var(--elevated, var(--panel)))",
      "--theme-btn-ghost-border": "transparent",
      "--theme-btn-ghost-color": "var(--text, var(--ink))",
    },
    outline: {
      "--theme-btn-bg": "transparent",
      "--theme-btn-border": "var(--border-strong, var(--line-strong, var(--border, var(--line))))",
      "--theme-btn-radius": "10px",
      "--theme-btn-primary-bg": "transparent",
      "--theme-btn-primary-image": "none",
      "--theme-btn-primary-color": "var(--accent)",
      "--theme-btn-primary-border": "var(--accent)",
      "--theme-btn-ghost-bg": "transparent",
      "--theme-btn-ghost-border": "transparent",
      "--theme-btn-ghost-color": "var(--text-muted, var(--muted, var(--mute)))",
    },
  };

  const BUTTON_VARS_LIGHT_SOLID_COLOR = "#ffffff";
  const VAR_KEYS = Object.keys(BUTTON_VARS.soft);

  function themesApi() {
    return window.myAppThemes || window.myApp?.themes || null;
  }

  function moduleId() {
    return window.myApp?.moduleId || window.myAppThemes?.moduleId || null;
  }

  function clearRootVars() {
    const root = document.documentElement;
    for (const key of VAR_KEYS) root.style.removeProperty(key);
  }

  function setRootVars(vars) {
    const root = document.documentElement;
    clearRootVars();
    for (const [prop, value] of Object.entries(vars)) {
      root.style.setProperty(prop, value);
    }
  }

  function removeButtonStyle() {
    document.getElementById(STYLE_ID)?.remove();
  }

  function injectButtonStyle(buttons, vars) {
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(el);
    }
    const sel = `html[data-buttons="${buttons}"] .app-shell`;
    el.textContent = `
${sel} .btn,
${sel} button.btn {
  border-radius: ${vars["--theme-btn-radius"]};
  border-color: ${vars["--theme-btn-border"]};
  background: ${vars["--theme-btn-bg"]};
  background-image: none;
  box-shadow: none;
}
${sel} .btn-primary,
${sel} button.btn-primary {
  border-radius: ${vars["--theme-btn-radius"]};
  background: ${vars["--theme-btn-primary-bg"]};
  background-color: ${vars["--theme-btn-primary-bg"]};
  background-image: ${vars["--theme-btn-primary-image"]};
  border-color: ${vars["--theme-btn-primary-border"]};
  color: ${vars["--theme-btn-primary-color"]};
  box-shadow: none;
}
${sel} .btn-ghost,
${sel} button.btn-ghost {
  background: ${vars["--theme-btn-ghost-bg"]};
  background-image: none;
  border-color: ${vars["--theme-btn-ghost-border"]};
  color: ${vars["--theme-btn-ghost-color"]};
}
`.trim();
  }

  function applyButtonVars(mode, buttons) {
    const key = buttons || "default";
    if (key === "default" || !BUTTON_VARS[key]) {
      clearRootVars();
      removeButtonStyle();
      return;
    }

    const vars = { ...BUTTON_VARS[key] };
    if (key === "solid" && mode === "light") {
      vars["--theme-btn-primary-color"] = BUTTON_VARS_LIGHT_SOLID_COLOR;
    }
    setRootVars(vars);
    injectButtonStyle(key, vars);
  }

  function apply(theme) {
    if (!theme) return;
    if (!moduleId()) return;

    const mode = theme.mode || "dark";
    const buttons = theme.buttons || "default";
    const root = document.documentElement;

    root.setAttribute("data-theme", mode);
    root.setAttribute("data-buttons", buttons);
    root.classList.toggle("theme-light", mode === "light");
    for (const cls of ["buttons-default", "buttons-soft", "buttons-solid", "buttons-outline"]) {
      root.classList.remove(cls);
    }
    root.classList.add(`buttons-${buttons}`);
    applyButtonVars(mode, buttons);
  }

  async function boot(explicitId) {
    const id = explicitId || moduleId();
    if (!id) return;
    try {
      const api = themesApi();
      if (!api?.get) return;
      const res = await api.get({ appId: id });
      if (res?.ok && res.theme) apply(res.theme);
    } catch {
    }
  }

  function listen(explicitId) {
    const id = explicitId || moduleId();
    if (!id || listen._bound === id) return;
    listen._bound = id;
    const api = themesApi();
    api?.onChange?.((payload) => {
      if (!payload) return;
      if (payload.appId && payload.appId !== id) return;
      if (payload.theme) apply(payload.theme);
    });
    window.addEventListener("myspace-theme", (e) => {
      const detail = e.detail || {};
      if (detail.appId && detail.appId !== id) return;
      if (detail.theme) apply(detail.theme);
    });
  }

  function start() {
    const id = moduleId();
    if (!id) return;
    listen(id);
    void boot(id);
  }

  window.MySpaceThemeRuntime = { apply, boot, listen, start, applyButtonVars };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();