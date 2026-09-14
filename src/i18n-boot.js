(function () {
  const I = window.MySpaceI18n;
  if (!I) {
    console.warn("[i18n-boot] MySpaceI18n missing");
    return;
  }

  function currentLang() {
    try {
      const settings = window.MySpaceConfig?.getSettings?.();
      return I.normalizeLang(settings?.language || "en");
    } catch {
      return "en";
    }
  }

  function applyShellLanguage(lang, opts = {}) {
    const next = I.setLanguage(lang, { force: Boolean(opts.force) });
    try {
      window.mySpace?.uiLanguage?.notifyChanged?.(next);
    } catch {
    }
    window.dispatchEvent(new CustomEvent("myspace-i18n-applied", { detail: { language: next } }));
    return next;
  }

  function boot() {
    applyShellLanguage(currentLang(), { force: true });
  }

  window.MySpaceI18nBoot = {
    boot,
    applyShellLanguage,
    currentLang,
  };

  if (window.MySpaceConfig?.subscribe) {
    window.MySpaceConfig.subscribe(() => {
      const lang = currentLang();
      if (lang !== I.getLanguage()) applyShellLanguage(lang);
    });
  }

  window.mySpace?.uiLanguage?.onChanged?.((data) => {
    const lang = I.normalizeLang(data?.language || "en");
    I.setLanguage(lang, { force: true });
    I.applyDom(document);
    window.dispatchEvent(new CustomEvent("myspace-i18n-applied", { detail: { language: lang } }));
  });
})();
