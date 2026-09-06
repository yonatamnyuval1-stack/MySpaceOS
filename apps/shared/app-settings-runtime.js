(function () {
  let cache = null;
  let appId = null;
  let ready = false;

  function schema() {
    return window.APP_SETTINGS_SCHEMA?.[appId] || null;
  }

  function merge(raw) {
    return window.mergeAppSettings?.(schema(), raw || {}) || raw || {};
  }

  function get(key) {
    if (!ready || !cache) {
      const item = findItem(key);
      return item?.default;
    }
    return cache[key];
  }

  function findItem(key) {
    for (const sec of schema()?.sections || []) {
      const item = (sec.items || []).find((i) => i.key === key);
      if (item) return item;
    }
    return null;
  }

  function isOn(key) {
    const item = findItem(key);
    return window.toggleIsOn?.(ready ? cache?.[key] : undefined, item?.default) ?? true;
  }

  function effectRoot() {
    return document.getElementById("app-shell") || document.documentElement;
  }

  function clearEffectClasses() {
    const classes = window.allEffectClasses?.() || new Set();
    for (const cls of classes) {
      document.documentElement.classList.remove(cls);
      document.getElementById("app-shell")?.classList.remove(cls);
    }
  }

  function applyEffects() {
    if (!appId || !ready) return;
    const root = effectRoot();
    clearEffectClasses();
    for (const sec of schema()?.sections || []) {
      for (const item of sec.items || []) {
        if (item.whenOff) root.classList.toggle(item.whenOff, !isOn(item.key));
        if (item.whenOn) root.classList.toggle(item.whenOn, isOn(item.key));
      }
    }
    document.dispatchEvent(
      new CustomEvent("app-settings-applied", {
        detail: { appId, settings: { ...cache } },
      })
    );
  }

  async function load() {
    appId = window.myApp?.moduleId || appId;
    if (!window.AppSettings?.load) {
      cache = merge({});
      ready = Boolean(schema());
      applyEffects();
      return cache;
    }
    const raw = await window.AppSettings.load();
    cache = merge(raw);
    ready = true;
    applyEffects();
    return cache;
  }

  function onApplied(fn) {
    document.addEventListener("app-settings-applied", (e) => {
      if (e.detail?.appId === appId) fn(e.detail.settings || {});
    });
  }

  document.addEventListener("app-setting-changed", (e) => {
    if (!appId) appId = window.myApp?.moduleId;
    if (e.detail?.appId !== appId) return;
    cache = merge(e.detail.settings || cache);
    ready = true;
    applyEffects();
  });

  async function boot() {
    appId = window.myApp?.moduleId;
    if (!appId || !schema()) return;
    if (!window.AppSettings) {
      setTimeout(boot, 50);
      return;
    }
    try {
      await load();
    } catch (_) {
      cache = merge({});
      ready = true;
      applyEffects();
    }
  }

  window.AppSettingsRuntime = { get, isOn, load, onApplied, boot, isReady: () => ready };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 10));
  } else {
    setTimeout(boot, 10);
  }
})();
