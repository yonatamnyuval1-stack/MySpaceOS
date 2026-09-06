window.ConsoleStorage = (function () {
  const { invoke } = window.Console;
  let cache = null;

  function invalidate() {
    cache = null;
  }

  async function load() {
    const res = await invoke("storage.load");
    cache = res.data;
    return cache;
  }

  async function save(data) {
    cache = data;
    await invoke("storage.save", { data });
    return cache;
  }

  async function get() {
    if (!cache) await load();
    return cache;
  }

  async function syncFromDesktop() {
    const res = await invoke("sync.fromDesktop");
    cache = res.data || cache;
    return res;
  }

  return { load, save, get, invalidate, syncFromDesktop };
})();
