window.ContactsStorage = (function () {
  const { invoke } = window.Contacts;
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

  return { load, save, get };
})();
