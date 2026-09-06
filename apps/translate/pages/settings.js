window.TranslatePages = window.TranslatePages || {};

window.TranslatePages.settings = (function () {
  const { invoke, buildLangOptions } = window.Translate;
  const page = document.getElementById("page-settings");

  async function scan() {
    const loaded = await invoke("storage.load");
    const s = loaded.data?.settings || {};
    page.querySelector("#set-from").innerHTML = buildLangOptions(true);
    page.querySelector("#set-to").innerHTML = buildLangOptions(false);
    page.querySelector("#set-from").value = s.fromLang || "auto";
    page.querySelector("#set-to").value = s.toLang || "he";
    page.querySelector("#set-auto").checked = s.autoTranslate !== false;
    page.querySelector("#set-history").checked = s.saveHistory !== false;
    page.querySelector("#set-font").value = s.fontSize || 15;
    page.querySelector("#history-count").textContent = String(loaded.data?.history?.length || 0);
  }

  async function saveSettings() {
    const loaded = await invoke("storage.load");
    loaded.data.settings = {
      fromLang: page.querySelector("#set-from").value,
      toLang: page.querySelector("#set-to").value,
      autoTranslate: page.querySelector("#set-auto").checked,
      saveHistory: page.querySelector("#set-history").checked,
      fontSize: parseInt(page.querySelector("#set-font").value, 10) || 15,
    };
    await invoke("storage.save", { data: loaded.data });
    document.documentElement.style.setProperty("--text-size", `${loaded.data.settings.fontSize}px`);
    page.querySelector("#save-status").textContent = "Saved ✓";
    setTimeout(() => (page.querySelector("#save-status").textContent = ""), 2000);
  }

  function bind() {
    page.querySelector("#btn-save-settings")?.addEventListener("click", saveSettings);
    page.querySelector("#set-font")?.addEventListener("input", (e) => {
      document.documentElement.style.setProperty("--text-size", `${e.target.value}px`);
    });
    page.querySelector("#btn-export")?.addEventListener("click", async () => {
      const res = await invoke("data.export");
      await invoke("clipboard.write", { text: res.json });
      page.querySelector("#save-status").textContent = "Exported to clipboard";
    });
    page.querySelector("#btn-import")?.addEventListener("click", async () => {
      const clip = await invoke("clipboard.read");
      if (!clip.text?.trim()) return;
      try {
        await invoke("data.import", { json: clip.text });
        page.querySelector("#save-status").textContent = "Imported ✓";
        scan();
      } catch (err) {
        page.querySelector("#save-status").textContent = err.message;
      }
    });
  }

  return { id: "settings", page, bind, scan };
})();
