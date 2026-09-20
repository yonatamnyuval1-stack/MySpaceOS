(function (root) {
  "use strict";

  const Langs = () => root.MySpaceLanguages;
  let language = "en";
  const listeners = new Set();

  function normalizeLang(raw) {
    if (Langs()?.normalizeLang) return Langs().normalizeLang(raw);
    const s = String(raw || "en").trim().toLowerCase();
    if (s.startsWith("he") || s.startsWith("iw")) return "he";
    if (s.startsWith("ar")) return "ar";
    if (s.startsWith("fr")) return "fr";
    if (s.startsWith("ru")) return "ru";
    if (s.startsWith("es")) return "es";
    return "en";
  }

  function catalog(lang) {
    const pack = root.MySpaceI18nMessages || {};
    return pack[lang] || pack.en || {};
  }

  function interpolate(str, vars) {
    if (!vars || typeof vars !== "object") return str;
    return String(str).replace(/\{(\w+)\}/g, (_, key) =>
      vars[key] != null ? String(vars[key]) : `{${key}}`
    );
  }

  function looksHebrew(s) {
    return /[\u0590-\u05FF]/.test(String(s));
  }

  function t(key, vars) {
    const k = String(key || "").trim();
    if (!k) return "";
    const primary = catalog(language);
    const fallback = catalog("en");
    let raw = primary[k] != null ? primary[k] : fallback[k] != null ? fallback[k] : k;
    if (language === "en" && looksHebrew(raw)) {
      if (fallback[k] != null && !looksHebrew(fallback[k])) raw = fallback[k];
      else raw = k;
    }
    return interpolate(raw, vars);
  }

  function isRtl(lang) {
    if (Langs()?.isRtl) return Langs().isRtl(lang || language);
    return ["he", "ar", "fa", "ur"].includes(normalizeLang(lang || language));
  }

  function applyDocument(doc) {
    const d = doc || (typeof document !== "undefined" ? document : null);
    if (!d?.documentElement) return;
    const m = Langs()?.meta?.(language);
    d.documentElement.lang = m?.htmlLang || language || "en";
    d.documentElement.dir = isRtl() ? "rtl" : "ltr";
    d.documentElement.dataset.uiLang = language;
  }

  function applyAttr(el, attr, key) {
    if (!el || !key) return;
    const value = t(key);
    if (attr === "text") el.textContent = value;
    else if (attr === "html") el.innerHTML = value;
    else el.setAttribute(attr, value);
  }

  function applyDom(rootEl) {
    const rootNode = rootEl || (typeof document !== "undefined" ? document : null);
    if (!rootNode?.querySelectorAll) return;
    rootNode.querySelectorAll("[data-i18n]").forEach((el) => {
      applyAttr(el, "text", el.getAttribute("data-i18n"));
    });
    rootNode.querySelectorAll("[data-i18n-html]").forEach((el) => {
      applyAttr(el, "html", el.getAttribute("data-i18n-html"));
    });
    rootNode.querySelectorAll("[data-i18n-title]").forEach((el) => {
      applyAttr(el, "title", el.getAttribute("data-i18n-title"));
    });
    rootNode.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      applyAttr(el, "aria-label", el.getAttribute("data-i18n-aria"));
    });
    rootNode.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      applyAttr(el, "placeholder", el.getAttribute("data-i18n-placeholder"));
    });
  }

  function setLanguage(next, opts = {}) {
    const lang = normalizeLang(next);
    const changed = lang !== language;
    language = lang;
    if (opts.applyDocument !== false) applyDocument();
    if (opts.applyDom !== false && typeof document !== "undefined") applyDom(document);
    if (changed || opts.force) {
      listeners.forEach((fn) => {
        try {
          fn(language);
        } catch {
        }
      });
    }
    return language;
  }

  function getLanguage() {
    return language;
  }

  function onChange(fn) {
    if (typeof fn !== "function") return () => {};
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function platformField(serviceId, field, fallback) {
    const key = `platform.${serviceId}.${field}`;
    const value = t(key);
    return value === key ? fallback || "" : value;
  }

  const api = {
    t,
    setLanguage,
    getLanguage,
    normalizeLang,
    isRtl,
    applyDocument,
    applyDom,
    onChange,
    platformField,
    supportedIds: () => (Langs()?.ids?.() || ["en", "he", "ar", "fr", "ru", "es"]).slice(),
  };

  root.MySpaceI18n = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);