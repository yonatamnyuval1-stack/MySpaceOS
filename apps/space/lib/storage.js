window.SpaceStorage = (function () {
  const { invoke } = window.Space;
  let cache = null;

  async function load() {
    const res = await invoke("storage.load");
    cache = res.data;
    return cache;
  }

  async function save(data) {
    const res = await invoke("storage.save", { data });
    cache = res.data;
    return cache;
  }

  async function get() {
    if (!cache) await load();
    return cache;
  }

  return { load, save, get };
})();