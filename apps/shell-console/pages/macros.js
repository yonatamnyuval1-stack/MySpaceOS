window.ConsolePages.macros = (function () {
  const { escapeHtml, invoke, filterItems } = window.Console;
  const page = document.getElementById("page-macros");
  let items = [];
  let query = "";

  function filtered() {
    return filterItems(
      items.map((m) => ({ ...m, chain: (m.commands || []).join("; ") })),
      query,
      ["name", "chain"]
    );
  }

  function render() {
    const shown = filtered();
    page.innerHTML = `
      <div class="page-head">
        <p class="muted">${items.length} macro(s) : separate commands with <code>;</code>.</p>
        <button type="button" class="btn btn-primary btn-sm" id="macro-add">+ Add macro</button>
      </div>
      <div class="toolbar">
        <input type="search" class="search" id="macro-search" placeholder="Search macros…" value="${escapeHtml(query)}" />
      </div>
      <div class="item-list" id="macro-list">${
        shown.length
          ? shown.map((m) => rowHtml(m, items.findIndex((x) => x.name === m.name))).join("")
          : `<p class="empty">${items.length ? "No matches." : "No macros yet: click Sync or add one."}</p>`
      }</div>`;

    page.querySelector("#macro-add")?.addEventListener("click", () => openEditor());
    page.querySelector("#macro-search")?.addEventListener("input", (e) => {
      query = e.target.value;
      render();
    });
    page.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => openEditor(items[parseInt(btn.dataset.edit, 10)]));
    });
    page.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const item = items[parseInt(btn.dataset.del, 10)];
        if (!item || !confirm(`Delete macro "${item.name}"?`)) return;
        await invoke("macros.remove", { name: item.name });
        await scan();
        window.ConsoleApp?.refreshStats?.();
        window.Console.showToast(`Deleted macro "${item.name}"`);
      });
    });
    page.querySelectorAll("[data-run]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const item = items[parseInt(btn.dataset.run, 10)];
        if (!item) return;
        window.ConsoleApp?.setActivePage?.("runner");
        await window.ConsolePages.runner?.runLine?.(`macro ${item.name}`);
      });
    });
  }

  function rowHtml(m, i) {
    if (i < 0) return "";
    const chain = (m.commands || m.chain || "").toString();
    const commands = m.commands || chain.split(";").map((s) => s.trim()).filter(Boolean);
    return `<article class="item-row">
      <div class="item-main">
        <strong class="item-name">${escapeHtml(m.name)}</strong>
        <code class="item-value">${escapeHtml(commands.join(" ; "))}</code>
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
      existing ? "Edit macro" : "New macro",
      `
      <form class="edit-form" id="macro-form">
        <label><span>Name</span><input type="text" id="f-name" value="${escapeHtml(existing?.name || "")}" placeholder="morning" required autofocus /></label>
        <label><span>Commands (semicolon-separated)</span><textarea id="f-cmd" rows="4" placeholder="run builds; run drift" required>${escapeHtml((existing?.commands || []).join("; "))}</textarea></label>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" id="macro-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>`
    );
    document.getElementById("macro-cancel")?.addEventListener("click", () => window.ConsoleApp?.closeModal?.());
    document.getElementById("macro-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("f-name")?.value.trim();
      const commands = document.getElementById("f-cmd")?.value.trim();
      await invoke("macros.set", { name, commands });
      window.ConsoleApp?.closeModal?.();
      await scan();
      window.ConsoleApp?.refreshStats?.();
      window.Console.showToast(`Saved macro "${name}"`);
    });
  }

  async function scan() {
    const res = await invoke("macros.list");
    items = res.items || [];
    render();
  }

  return { id: "macros", page, scan };
})();