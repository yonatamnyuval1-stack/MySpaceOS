(async function () {
  const I = window.MySpaceI18n;
  if (!I) return;

  async function resolveLang() {
    try {
      if (window.osI18n?.getLanguageSync) {
        return I.normalizeLang(window.osI18n.getLanguageSync());
      }
    } catch {
    }
    try {
      if (window.osI18n?.getLanguage) return I.normalizeLang(await window.osI18n.getLanguage());
    } catch {
    }
    try {
      if (window.mySpace?.uiLanguage?.getSync) {
        return I.normalizeLang(window.mySpace.uiLanguage.getSync());
      }
    } catch {
    }
    try {
      if (window.mySpace?.uiLanguage?.get) {
        const res = await window.mySpace.uiLanguage.get();
        return I.normalizeLang(res?.language || res || "en");
      }
    } catch {
    }
    return "en";
  }

  function apply(lang, { force } = {}) {
    const next = I.setLanguage(lang, { force: Boolean(force) });
    I.applyDom(document);
    window.__myspaceUiLang = next;
    window.dispatchEvent(new CustomEvent("myspace-i18n-ready", { detail: { language: next } }));
    window.dispatchEvent(new CustomEvent("myspace-i18n-applied", { detail: { language: next } }));
    return next;
  }

  const lang = await resolveLang();
  apply(lang, { force: true });

  const onChanged = window.osI18n?.onChanged || window.mySpace?.uiLanguage?.onChanged;
  if (typeof onChanged === "function") {
    onChanged((data) => {
      const next = I.normalizeLang(data?.language || "en");
      apply(next, { force: true });
    });
  }
})();
