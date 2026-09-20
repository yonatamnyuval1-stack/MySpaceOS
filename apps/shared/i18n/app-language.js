(function (root) {
  "use strict";

  const I = () => root.MySpaceI18n;
  const Langs = () => root.MySpaceLanguages;

  function normalizeLang(raw) {
    if (I()?.normalizeLang) return I().normalizeLang(raw);
    if (Langs()?.normalizeLang) return Langs().normalizeLang(raw);
    return "en";
  }

  function supportedIds() {
    return Langs()?.ids?.() || I()?.supportedIds?.() || ["en", "he", "ar", "fr", "ru", "es"];
  }

  function readOsLanguage() {
    try {
      if (typeof root.osI18n?.getLanguageSync === "function") {
        return normalizeLang(root.osI18n.getLanguageSync());
      }
    } catch {
    }
    try {
      if (typeof root.mySpace?.uiLanguage?.getSync === "function") {
        return normalizeLang(root.mySpace.uiLanguage.getSync());
      }
    } catch {
    }
    return "en";
  }

  function readPreference() {
    const runtime = root.AppSettingsRuntime;
    const fromUi = runtime?.get?.("uiLanguage");
    if (fromUi === "system") return "system";
    if (fromUi && supportedIds().includes(normalizeLang(fromUi))) return normalizeLang(fromUi);
    const legacy = runtime?.get?.("language");
    if (legacy === "system") return "system";
    if (legacy && supportedIds().includes(normalizeLang(legacy))) return normalizeLang(legacy);
    return "system";
  }

  function resolve(pref) {
    const mode = pref == null ? readPreference() : String(pref || "system");
    if (mode === "system") return readOsLanguage();
    if (supportedIds().includes(normalizeLang(mode))) return normalizeLang(mode);
    return readOsLanguage();
  }

  function apply(lang, opts = {}) {
    const next = normalizeLang(lang);
    const api = I();
    const meta = Langs()?.meta?.(next);
    if (api?.setLanguage) {
      api.setLanguage(next, { force: Boolean(opts.force) });
      api.applyDom?.(document);
    } else if (typeof document !== "undefined") {
      document.documentElement.lang = meta?.htmlLang || next;
      document.documentElement.dir = meta?.rtl ? "rtl" : "ltr";
      document.documentElement.dataset.uiLang = next;
    }
    root.__myspaceAppUiLang = next;
    root.__myspaceAppUiLangMode = readPreference();
    document.dispatchEvent(
      new CustomEvent("myspace-app-i18n-applied", {
        detail: { language: next, mode: root.__myspaceAppUiLangMode },
      })
    );
    return next;
  }

  function applyFromSettings(opts = {}) {
    return apply(resolve(), { force: true, ...opts });
  }

  let wired = false;

  function boot(opts = {}) {
    if (wired) {
      applyFromSettings(opts);
      return root.MySpaceAppLanguage;
    }
    wired = true;

    const run = () => applyFromSettings(opts);

    if (root.AppSettingsRuntime?.onApplied) {
      root.AppSettingsRuntime.onApplied(() => run());
    } else {
      document.addEventListener("app-settings-applied", () => run());
    }

    document.addEventListener("app-setting-changed", (e) => {
      const key = e?.detail?.key;
      if (key === "uiLanguage" || key === "language") run();
    });

    const onOsChanged = (data) => {
      if (readPreference() !== "system") return;
      apply(normalizeLang(data?.language || readOsLanguage()), { force: true });
    };
    try {
      root.osI18n?.onChanged?.(onOsChanged);
    } catch {
    }
    try {
      root.mySpace?.uiLanguage?.onChanged?.(onOsChanged);
    } catch {
    }

    const start = () => {
      Promise.resolve()
        .then(() => root.AppSettingsRuntime?.load?.())
        .catch(() => null)
        .finally(() => run());
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
      start();
    }

    return root.MySpaceAppLanguage;
  }

  root.MySpaceAppLanguage = {
    normalizeLang,
    readOsLanguage,
    readPreference,
    resolve,
    apply,
    applyFromSettings,
    boot,
    supportedIds,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.MySpaceAppLanguage;
  }
})(typeof globalThis !== "undefined" ? globalThis : window); 