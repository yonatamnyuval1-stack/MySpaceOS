window.ProfilesStorage = (function () {
  const { invoke } = window.Profiles;

  let cache = null;

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

  async function update(mutator) {
    const data = structuredClone(await get());
    mutator(data);
    return save(data);
  }

  return { load, save, get, update };
})();
