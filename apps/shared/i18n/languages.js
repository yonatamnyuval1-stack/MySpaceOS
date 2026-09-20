(function (root) {
  "use strict"

  const LANGUAGES = [
    { id: "en", name: "English", nativeName: "English", rtl: false, locale: "en-US", htmlLang: "en" },
    { id: "he", name: "Hebrew", nativeName: "עברית", rtl: true, locale: "he-IL", htmlLang: "he" },
    { id: "ar", name: "Arabic", nativeName: "العربية", rtl: true, locale: "ar-SA", htmlLang: "ar" },
    { id: "fr", name: "French", nativeName: "Français", rtl: false, locale: "fr-FR", htmlLang: "fr" },
    { id: "ru", name: "Russian", nativeName: "Русский", rtl: false, locale: "ru-RU", htmlLang: "ru" },
    { id: "es", name: "Spanish", nativeName: "Español", rtl: false, locale: "es-ES", htmlLang: "es" },
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

  function list() {
    return LANGUAGES.slice();
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
    meta,
    isRtl,
    list,
    ids,
    appUiLanguageOptions,
  };

  root.MySpaceLanguages = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);