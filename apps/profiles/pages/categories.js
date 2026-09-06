window.ProfilesPages = window.ProfilesPages || {};

window.ProfilesPages.categories = (function () {
  const { escapeHtml, uid } = window.Profiles;
  const page = document.getElementById("page-categories");

  const DEFAULT_IDS = new Set(["general", "accounts", "projects", "people", "tools", "websites", "finance"]);

  let data = null;

  function render() {
    if (!data) return;
    page.innerHTML = `
      <div class="cat-page-head">
        <h2>Categories</h2>
        <button type="button" class="btn btn-primary btn-sm" id="cat-add">+ Add category</button>
      </div>
      <p class="muted">Organize profiles into groups. accounts, projects, people, tools, and more.</p>
      <div class="cat-list" id="cat-list">${data.categories
        .map(
          (c) => `
        <article class="cat-row" data-id="${escapeHtml(c.id)}">
          <span class="cat-row-icon" style="background:${escapeHtml(c.color)}20;color:${escapeHtml(c.color)}">${escapeHtml(c.icon)}</span>
          <input type="text" class="field-input cat-name" value="${escapeHtml(c.name)}" />
          <input type="text" class="field-input cat-icon" value="${escapeHtml(c.icon)}" maxlength="4" title="Emoji" />
          <input type="color" class="cat-color" value="${escapeHtml(c.color)}" />
          <span class="cat-count">${data.profiles.filter((p) => p.categoryId === c.id).length} profiles</span>
          <button type="button" class="btn btn-ghost btn-sm cat-del" ${DEFAULT_IDS.has(c.id) ? "disabled title=\"Built-in category\"" : ""}>✕</button>
        </article>`
        )
        .join("")}</div>`;

    page.querySelector("#cat-add")?.addEventListener("click", async () => {
      data.categories.push({
        id: uid("cat"),
        name: "New category",
        icon: "📁",
        color: "#8b9dc3",
      });
      await window.ProfilesStorage.save(data);
      render();
    });

    page.querySelectorAll(".cat-row").forEach((row) => {
      const id = row.dataset.id;
      row.querySelector(".cat-name")?.addEventListener("change", () => saveRow(row, id));
      row.querySelector(".cat-icon")?.addEventListener("change", () => saveRow(row, id));
      row.querySelector(".cat-color")?.addEventListener("change", () => saveRow(row, id));
      row.querySelector(".cat-del")?.addEventListener("click", async () => {
        if (DEFAULT_IDS.has(id)) return;
        const used = data.profiles.some((p) => p.categoryId === id);
        if (used && !confirm("Profiles use this category. They will move to General. Continue?")) return;
        data.profiles.forEach((p) => {
          if (p.categoryId === id) p.categoryId = "general";
        });
        data.categories = data.categories.filter((c) => c.id !== id);
        await window.ProfilesStorage.save(data);
        render();
        window.ProfilesPages.browse?.render?.();
      });
    });
  }

  async function saveRow(row, id) {
    const cat = data.categories.find((c) => c.id === id);
    if (!cat) return;
    cat.name = row.querySelector(".cat-name")?.value.trim() || cat.name;
    cat.icon = row.querySelector(".cat-icon")?.value.trim() || cat.icon;
    cat.color = row.querySelector(".cat-color")?.value || cat.color;
    await window.ProfilesStorage.save(data);
    window.ProfilesPages.browse?.render?.();
  }

  async function scan() {
    data = await window.ProfilesStorage.load();
    render();
  }

  function bind() {}

  return { id: "categories", page, scan, bind };
})();