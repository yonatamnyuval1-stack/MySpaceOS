window.TranslatePages = window.TranslatePages || {};

window.TranslatePages.phrases = (function () {
  const { escapeHtml, invoke, buildLangOptions } = window.Translate;
  const page = document.getElementById("page-phrases");
  let targetLang = "he";

  async function scan() {
    const loaded = await invoke("storage.load");
    targetLang = loaded.data?.settings?.toLang || "he";
    const sel = page.querySelector("#phrases-lang");
    sel.innerHTML = buildLangOptions(false);
    sel.value = targetLang;
    renderCategories();
  }

  function renderCategories() {
    const cats = window.TranslateLangs?.PHRASE_CATEGORIES || [];
    const nav = page.querySelector("#phrase-cats");
    const content = page.querySelector("#phrase-content");
    let activeId = cats[0]?.id;

    nav.innerHTML = cats
      .map(
        (c, i) =>
          `<button type="button" class="phrase-cat-btn ${i === 0 ? "active" : ""}" data-cat="${escapeHtml(c.id)}">${c.icon} ${escapeHtml(c.name)}</button>`
      )
      .join("");

    async function showCategory(catId) {
      const cat = cats.find((c) => c.id === catId);
      if (!cat) return;
      content.innerHTML = `<p class="muted loading-msg">Translating phrases…</p>`;
      const rows = [];
      for (const p of cat.phrases) {
        try {
          const res = await invoke("translate.text", { text: p.en, from: "en", to: targetLang });
          rows.push({ en: p.en, tr: res.translation });
        } catch {
          rows.push({ en: p.en, tr: "—" });
        }
        await new Promise((r) => setTimeout(r, 80));
      }
      content.innerHTML = rows
        .map(
          (r) => `<div class="phrase-row">
          <span class="phrase-en">${escapeHtml(r.en)}</span>
          <span class="phrase-tr">${escapeHtml(r.tr)}</span>
          <button type="button" class="btn btn-ghost btn-sm" data-copy-tr="${escapeHtml(r.tr)}">Copy</button>
          <button type="button" class="btn btn-ghost btn-sm" data-use-tr data-src="${escapeHtml(r.en)}" data-tr="${escapeHtml(r.tr)}">Open</button>
        </div>`
        )
        .join("");

      content.querySelectorAll("[data-copy-tr]").forEach((btn) => {
        btn.addEventListener("click", () => invoke("clipboard.write", { text: btn.dataset.copyTr }));
      });
      content.querySelectorAll("[data-use-tr]").forEach((btn) => {
        btn.addEventListener("click", () => {
          window.TranslateApp.openTranslate({
            source: btn.dataset.src,
            from: "en",
            to: targetLang,
          });
        });
      });
    }

    nav.querySelectorAll(".phrase-cat-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeId = btn.dataset.cat;
        nav.querySelectorAll(".phrase-cat-btn").forEach((b) => b.classList.toggle("active", b === btn));
        showCategory(activeId);
      });
    });

    showCategory(activeId);
  }

  function bind() {
    page.querySelector("#phrases-lang")?.addEventListener("change", (e) => {
      targetLang = e.target.value;
      renderCategories();
    });
  }

  return { id: "phrases", page, bind, scan };
})();
