(function (root) {
  async function list() {
    if (!root.myApp?.invoke) throw new Error("MSL requires My Space app bridge");
    return root.myApp.invoke("msl.list", {});
  }

  async function invoke(capability, input) {
    if (!root.myApp?.invoke) throw new Error("MSL requires My Space app bridge");
    return root.myApp.invoke("msl.invoke", {
      capability: String(capability || "").trim(),
      input: input || {},
    });
  }

  async function buildKey(capability, input) {
    return root.myApp.invoke("msl.key.build", { capability, input: input || {} });
  }

  async function parseKey(uri) {
    return root.myApp.invoke("msl.key.parse", { uri });
  }

  async function resolveKey(uri) {
    return root.myApp.invoke("msl.key.resolve", { uri });
  }

  async function listKeys() {
    return root.myApp.invoke("msl.keys.list", {});
  }

  async function saveKey(payload) {
    return root.myApp.invoke("msl.keys.save", payload || {});
  }

  async function deleteKey(payload) {
    return root.myApp.invoke("msl.keys.delete", payload || {});
  }

  async function listInjections(appId) {
    return root.myApp.invoke("msl.inject.list", appId ? { appId } : {});
  }

  async function injectKey(payload) {
    return root.myApp.invoke("msl.inject.set", payload || {});
  }

  async function removeInjection(payload) {
    return root.myApp.invoke("msl.inject.remove", payload || {});
  }

  async function injectTargets() {
    return root.myApp.invoke("msl.inject.targets", {});
  }

  root.Msl = {
    list,
    invoke,
    buildKey,
    parseKey,
    resolveKey,
    listKeys,
    saveKey,
    deleteKey,
    listInjections,
    injectKey,
    removeInjection,
    injectTargets,
  };
})(typeof window !== "undefined" ? window : globalThis);
