(function () {
  const I = window.MySpaceI18n;
  if (!I?.setLanguage) return;

  function pickLang(raw) {
    return I.normalizeLang(raw || "en");
  }

  let lang = "en";
  try {
    if (typeof window.osI18n?.getLanguageSync === "function") {
      lang = pickLang(window.osI18n.getLanguageSync());
    } else if (typeof window.mySpace?.uiLanguage?.getSync === "function") {
      lang = pickLang(window.mySpace.uiLanguage.getSync());
    }
  } catch {
    lang = "en";
  }

  I.setLanguage(lang, { applyDom: typeof document !== "undefined" });
  window.__myspaceUiLang = lang;
})();