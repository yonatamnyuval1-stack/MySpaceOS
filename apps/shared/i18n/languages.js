(function (root) {
  "use strict"

  const LANGUAGES = [
    { id: "en", name: "English", nativeName: "English", rtl: false, locale: "en-US", htmlLang: "en", complete: true },
    { id: "he", name: "Hebrew", nativeName: "עברית", rtl: true, locale: "he-IL", htmlLang: "he", complete: true },
    { id: "ar", name: "Arabic", nativeName: "العربية", rtl: true, locale: "ar-SA", htmlLang: "ar", complete: false },
    { id: "fr", name: "French", nativeName: "Français", rtl: false, locale: "fr-FR", htmlLang: "fr", complete: false },
    { id: "ru", name: "Russian", nativeName: "Русский", rtl: false, locale: "ru-RU", htmlLang: "ru", complete: false },
    { id: "es", name: "Spanish", nativeName: "Español", rtl: false, locale: "es-ES", htmlLang: "es", complete: false },
  ];

  const BY_ID = Object.fromEntries(LANGUAGES.map((l) => [l.id, l]));
  const IDS = LANGUAGES.map((l) => l.id);

  function normalizeLang(raw) {
    const s = String(raw || "en").trim().toLowerCase().replace(/_/g, "-");
    if (!s) return "en";
    const primary = s.split("-")[0];
    if (BY_ID[primary]) return primary;
    if (s.startsWith("iw")) return "he"; 
    return "en";
  }

  function isSupported(raw) {
    const id = String(raw || "").trim().toLowerCase().split(/[-_]/)[0];
    return Boolean(BY_ID[id]);
  }

  function meta(raw) {
    return BY_ID[normalizeLang(raw)] || BY_ID.en;
  }

  function isRtl(raw) {
    return Boolean(meta(raw).rtl);
  }

  function isComplete(raw) {
    return Boolean(meta(raw).complete);
  }

  function list() {
    return LANGUAGES.slice();
  }

  function listComplete() {
    return LANGUAGES.filter((l) => l.complete);
  }

  function ids() {
    return IDS.slice();
  }

  function appUiLanguageOptions() {
    return ["system", ...IDS];
  }

  const api = {
    LANGUAGES,
    IDS,
    normalizeLang,
    isSupported,
    isComplete,
    meta,
    isRtl,
    list,
    listComplete,
    ids,
    appUiLanguageOptions,
  };

  root.MySpaceLanguages = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);