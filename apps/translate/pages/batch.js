window.TranslatePages = window.TranslatePages || {};

window.TranslatePages.batch = (function () {
  const { escapeHtml, invoke, buildLangOptions } = window.Translate;
  const page = document.getElementById("page-batch");

  async function scan() {
    const loaded = await invoke("storage.load");
    const from = page.querySelector("#batch-from");
    const to = page.querySelector("#batch-to");
    from.innerHTML = buildLangOptions(true);
    to.innerHTML = buildLangOptions(false);
    from.value = loaded.data?.settings?.fromLang || "auto";
    to.value = loaded.data?.settings?.toLang || "he";
  }

  async function runBatch() {
    const text = page.querySelector("#batch-input").value.trim();
    const from = page.querySelector("#batch-from").value;
    const to = page.querySelector("#batch-to").value;
    const out = page.querySelector("#batch-output");
    const status = page.querySelector("#batch-status");

    if (!text) return;
    status.textContent = "Translating…";
    page.querySelector("#btn-batch-run").disabled = true;
    try {
      const res = await invoke("translate.batch", { text, from, to });
      out.value = res.results.map((r) => (r.error ? `[ERROR] ${r.source}` : r.translation)).join("\n");
      const errors = res.results.filter((r) => r.error).length;
      status.textContent = `Done — ${res.results.length} lines${errors ? `, ${errors} errors` : ""}`;
    } catch (err) {
      status.textContent = err.message;
    } finally {
      page.querySelector("#btn-batch-run").disabled = false;
    }
  }

  function bind() {
    page.querySelector("#btn-batch-run")?.addEventListener("click", runBatch);
    page.querySelector("#btn-batch-paste")?.addEventListener("click", async () => {
      const clip = await invoke("clipboard.read");
      page.querySelector("#batch-input").value = clip.text || "";
    });
    page.querySelector("#btn-batch-copy")?.addEventListener("click", async () => {
      await invoke("clipboard.write", { text: page.querySelector("#batch-output").value });
    });
    page.querySelector("#btn-batch-clear")?.addEventListener("click", () => {
      page.querySelector("#batch-input").value = "";
      page.querySelector("#batch-output").value = "";
      page.querySelector("#batch-status").textContent = "";
    });
  }

  return { id: "batch", page, bind, scan };
})();
