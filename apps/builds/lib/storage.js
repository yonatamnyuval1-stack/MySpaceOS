window.BuildsStorage = (function () {
  const { invoke } = window.Builds;
  let cache = null;

  async function load() {
    const res = await invoke("storage.load");
    if (!res?.data) throw new Error(res?.error || "Failed to load Builds data");
    cache = res.data;
    if (res.recovered) {
      console.warn("[Builds] Recovered projects from a damaged builds.json");
    }
    return cache;
  }

  async function save(data) {
    const res = await invoke("storage.save", { data });
    cache = res?.data || data;
    return cache;
  }

  async function get() {
    if (!cache) await load();
    return cache;
  }

  async function update(mutator) {
    const data = structuredClone(await get());
    mutator(data);
    return save(data);
  }

  return { load, save, get, update };
})();
