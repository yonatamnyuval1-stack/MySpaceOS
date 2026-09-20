window.ConsolePages.aliases = (function () {
  const { escapeHtml, invoke, filterItems } = window.Console;
  const page = document.getElementById("page-aliases");
  let items = [];
  let query = "";

  function filtered() {
    return filterItems(items, query, ["name", "command"]);
  }

  function render() {
    const shown = filtered();
    page.innerHTML = `
      <div class="page-head">
        <p class="muted">${items.length} alias(es): typing the name in the shell runs the full command.</p>
        <button type="button" class="btn btn-primary btn-sm" id="alias-add">+ Add alias</button>
      </div>
      <div class="toolbar">
        <input type="search" class="search" id="alias-search" placeholder="Search aliases…" value="${escapeHtml(query)}" />
      </div>
      <div class="item-list" id="alias-list">${
        shown.length
          ? shown.map((a) => rowHtml(a, items.indexOf(a))).join("")
          : `<p class="empty">${items.length ? "No matches." : "No aliases yet: click Sync or add one."}</p>`
      }</div>`;

    page.querySelector("#alias-add")?.addEventListener("click", () => openEditor());
    page.querySelector("#alias-search")?.addEventListener("input", (e) => {
      query = e.target.value;
      render();
    });
    page.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => openEditor(items[parseInt(btn.dataset.edit, 10)]));
    });
    page.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const item = items[parseInt(btn.dataset.del, 10)];
        if (!item || !confirm(`Delete alias "${item.name}"?`)) return;
        await invoke("aliases.remove", { name: item.name });
        await scan();
        window.ConsoleApp?.refreshStats?.();
        window.Console.showToast(`Deleted alias "${item.name}"`);
      });
    });
    page.querySelectorAll("[data-run]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.ConsoleApp?.setActivePage?.("runner");
        window.ConsolePages.runner?.runLine?.(items[parseInt(btn.dataset.run, 10)]?.name);
      });
    });
  }

  function rowHtml(a, i) {
    if (i < 0) return "";
    return `<article class="item-row">
      <div class="item-main">
        <strong class="item-name">${escapeHtml(a.name)}</strong>
        <code class="item-value">${escapeHtml(a.command)}</code>
      </div>
      <div class="item-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-run="${i}">Run</button>
        <button type="button" class="btn btn-ghost btn-sm" data-edit="${i}">Edit</button>
        <button type="button" class="btn btn-ghost btn-sm" data-del="${i}">Delete</button>
      </div>
    </article>`;
  }

  function openEditor(existing) {
    window.ConsoleApp?.openModal?.(
      existing ? "Edit alias" : "New alias",
      `
      <form class="edit-form" id="alias-form">
        <label><span>Name</span><input type="text" id="f-name" value="${escapeHtml(existing?.name || "")}" placeholder="ocean" required autofocus /></label>
        <label><span>Command</span><textarea id="f-cmd" rows="3" placeholder="run space(ocean)" required>${escapeHtml(existing?.command || "")}</textarea></label>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" id="alias-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>`
    );
    document.getElementById("alias-cancel")?.addEventListener("click", () => window.ConsoleApp?.closeModal?.());
    document.getElementById("alias-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("f-name")?.value.trim();
      const command = document.getElementById("f-cmd")?.value.trim();
      await invoke("aliases.set", { name, command });
      window.ConsoleApp?.closeModal?.();
      await scan();
      window.ConsoleApp?.refreshStats?.();
      window.Console.showToast(`Saved alias "${name}"`);
    });
  }

  async function scan() {
    const res = await invoke("aliases.list");
    items = res.items || [];
    render();
  }

  return { id: "aliases", page, scan };
})();
