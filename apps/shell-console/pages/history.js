window.ConsolePages.history = (function () {
  const { escapeHtml, invoke, formatTime, filterItems } = window.Console;
  const page = document.getElementById("page-history");
  let items = [];
  let query = "";

  function filtered() {
    return filterItems(items, query, ["line", "message", "source"]);
  }

  function render() {
    const shown = filtered();
    page.innerHTML = `
      <div class="page-head">
        <p class="muted">${items.length} command(s) logged from desktop shell and Console.</p>
        <button type="button" class="btn btn-ghost btn-sm" id="hist-clear">Clear history</button>
      </div>
      <div class="toolbar">
        <input type="search" class="search" id="hist-search" placeholder="Search history…" value="${escapeHtml(query)}" />
      </div>
      <div class="history-list">${
        shown.length
          ? shown.map((h) => rowHtml(h, items.indexOf(h))).join("")
          : `<p class="empty">${items.length ? "No matches." : "No history yet — run a command from Run or right-click the desktop."}</p>`
      }</div>`;

    page.querySelector("#hist-clear")?.addEventListener("click", async () => {
      if (!confirm("Clear all command history?")) return;
      await invoke("history.clear");
      await scan();
      window.ConsoleApp?.refreshStats?.();
      window.Console.showToast("History cleared");
    });
    page.querySelector("#hist-search")?.addEventListener("input", (e) => {
      query = e.target.value;
      render();
    });
    page.querySelectorAll("[data-rerun]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const line = items[parseInt(btn.dataset.rerun, 10)]?.line;
        if (!line) return;
        window.ConsoleApp?.setActivePage?.("runner");
        await window.ConsolePages.runner?.runLine?.(line);
      });
    });
  }

  function rowHtml(h, i) {
    if (i < 0) return "";
    return `<article class="history-row ${h.ok ? "ok" : "err"}">
      <div class="history-meta">
        <span>${escapeHtml(formatTime(h.at))}</span>
        <span class="history-src">${escapeHtml(h.source || "")}</span>
      </div>
      <code class="history-cmd">${escapeHtml(h.line)}</code>
      ${h.message ? `<span class="history-msg">${escapeHtml(h.message)}</span>` : ""}
      <button type="button" class="btn btn-ghost btn-sm" data-rerun="${i}">Re-run</button>
    </article>`;
  }

  async function scan() {
    const res = await invoke("history.list");
    items = res.items || [];
    render();
  }

  return { id: "history", page, scan };
})();