(function () {
  const I = window.MySpaceI18n;
  if (!I) {
    console.warn("[i18n-boot] MySpaceI18n missing");
    return;
  }

  let subscribed = false;

  function currentLang() {
    try {
      const settings = window.MySpaceConfig?.getSettings?.();
      return I.normalizeLang(settings?.language || "en");
    } catch {
      return "en";
    }
  }

  function notifyServices(lang) {
    try {
      window.mySpace?.uiLanguage?.notifyChanged?.(lang);
    } catch {
    }
    try {
      window.osI18n?.notifyChanged?.(lang);
    } catch {
    }
  }

  function applyShellLanguage(lang, opts = {}) {
    const next = I.setLanguage(lang, { force: Boolean(opts.force) });
    I.applyDom(document);
    notifyServices(next);
    window.dispatchEvent(new CustomEvent("myspace-i18n-applied", { detail: { language: next } }));
    return next;
  }

  function ensureConfigSubscribe() {
    if (subscribed || !window.MySpaceConfig?.subscribe) return;
    subscribed = true;
    window.MySpaceConfig.subscribe(() => {
      const lang = currentLang();
      if (lang !== I.getLanguage()) applyShellLanguage(lang);
    });
  }

  function boot() {
    ensureConfigSubscribe();
    applyShellLanguage(currentLang(), { force: true });
  }

  window.MySpaceI18nBoot = {
    boot,
    applyShellLanguage,
    currentLang,
  };

  ensureConfigSubscribe();

  function onRemoteLanguage(data) {
    const lang = I.normalizeLang(data?.language || "en");
    I.setLanguage(lang, { force: true });
    I.applyDom(document);
    window.dispatchEvent(new CustomEvent("myspace-i18n-applied", { detail: { language: lang } }));
  }

  window.mySpace?.uiLanguage?.onChanged?.(onRemoteLanguage);
  window.osI18n?.onChanged?.(onRemoteLanguage);
})();