(function () {
  function keyFor(appId) {
    return `myspace-appset-${appId}`;
  }

  function get(appId) {
    if (!appId) return {};
    try {
      return JSON.parse(localStorage.getItem(keyFor(appId)) || "{}") || {};
    } catch {
      return {};
    }
  }

  function set(appId, patch) {
    if (!appId) return {};
    const next = { ...get(appId), ...patch };
    localStorage.setItem(keyFor(appId), JSON.stringify(next));
    return next;
  }

  window.MySpaceAppPrefs = { get, set, keyFor };
})();