window.ConsolePages = window.ConsolePages || {};

window.ConsolePages.runner = (function () {
  const { escapeHtml, invoke } = window.Console;
  const page = document.getElementById("page-runner");
  const output = [];
  let historyUp = [];
  let quickAliases = [];
  let quickMacros = [];

  function render() {
    page.innerHTML = `
      <div class="stats-row" id="runner-stats"></div>
      <div class="quick-section" id="quick-section"></div>
      <div class="runner-box">
        <form class="runner-form" id="runner-form">
          <span class="runner-prompt">$</span>
          <input type="text" id="runner-input" class="runner-input" placeholder="run space(ocean), macro morning" spellcheck="false" autocomplete="off" />
          <button type="submit" class="btn btn-primary">Run</button>
        </form>
        <p class="runner-hint">↑↓ command history, aliases and macros from the desktop shell work here too</p>
      </div>
      <details class="settings-panel collapsible">
        <summary>Settings</summary>
        <div class="settings-inner">
          <label class="check-row">
            <input type="checkbox" id="set-log-history" />
            Log command history to disk
          </label>
          <label class="field-row">
            <span>Max history entries</span>
            <input type="number" id="set-max-history" class="runner-input" min="50" max="500" style="max-width:100px" />
          </label>
          <button type="button" class="btn btn-ghost btn-sm" id="set-save">Save settings</button>
        </div>
      </details>
      <div class="output-log" id="output-log">${output
        .map(
          (e) => `<div class="output-row ${e.ok ? "ok" : "err"}">
            <span class="output-time">${escapeHtml(e.time)}</span>
            <code class="output-cmd">${escapeHtml(e.line)}</code>
            <span class="output-msg">${escapeHtml(e.message)}</span>
          </div>`
        )
        .join("")}</div>`;

    renderStats();
    renderQuick();

    const form = page.querySelector("#runner-form");
    const input = page.querySelector("#runner-input");
    let histIdx = -1;

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const line = input.value.trim();
      if (!line) return;
      historyUp.unshift(line);
      histIdx = -1;
      input.value = "";
      await runLine(line);
    });

    input?.addEventListener("keydown", (e) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!historyUp.length) return;
        histIdx = Math.min(histIdx + 1, historyUp.length - 1);
        input.value = historyUp[histIdx] || "";
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (histIdx <= 0) {
          histIdx = -1;
          input.value = "";
          return;
        }
        histIdx -= 1;
        input.value = historyUp[histIdx] || "";
      }
    });

    input?.focus();

    page.querySelector("#set-save")?.addEventListener("click", async () => {
      const logHistory = page.querySelector("#set-log-history")?.checked !== false;
      const maxHistory = parseInt(page.querySelector("#set-max-history")?.value, 10) || 500;
      await invoke("settings.patch", { settings: { logHistory, maxHistory: Math.min(500, Math.max(50, maxHistory)) } });
      window.ConsoleApp?.refreshStats?.();
      window.Console.showToast("Settings saved");
    });

    page.querySelectorAll("[data-quick]").forEach((btn) => {
      btn.addEventListener("click", () => runLine(btn.dataset.quick));
    });

    loadSettings();
  }

  function renderStats() {
    const el = page.querySelector("#runner-stats");
    if (!el) return;
    el.innerHTML = `
      <div class="stat-card"><span class="stat-val">${quickAliases.length}</span><span class="stat-label">Aliases</span></div>
      <div class="stat-card"><span class="stat-val">${quickMacros.length}</span><span class="stat-label">Macros</span></div>
      <div class="stat-card"><span class="stat-val">${historyUp.length}</span><span class="stat-label">History</span></div>`;
  }

  function renderQuick() {
    const el = page.querySelector("#quick-section");
    if (!el) return;
    if (!quickAliases.length && !quickMacros.length) {
      el.innerHTML = `<p class="muted quick-empty">No aliases or macros yet. use <strong>Sync</strong> or add them in Aliases / Macros.</p>`;
      return;
    }
    const aliasChips = quickAliases
      .slice(0, 12)
      .map((a) => `<button type="button" class="chip chip-alias" data-quick="${escapeHtml(a.name)}" title="${escapeHtml(a.command)}">${escapeHtml(a.name)}</button>`)
      .join("");
    const macroChips = quickMacros
      .slice(0, 8)
      .map((m) => `<button type="button" class="chip chip-macro" data-quick="macro ${escapeHtml(m.name)}" title="${escapeHtml((m.commands || []).join("; "))}">${escapeHtml(m.name)}</button>`)
      .join("");
    el.innerHTML = `
      ${quickAliases.length ? `<div class="chip-group"><span class="chip-label">Aliases</span>${aliasChips}</div>` : ""}
      ${quickMacros.length ? `<div class="chip-group"><span class="chip-label">Macros</span>${macroChips}</div>` : ""}`;
  }

  async function loadSettings() {
    try {
      const data = await window.ConsoleStorage.get();
      const s = data.settings || {};
      const logEl = page.querySelector("#set-log-history");
      const maxEl = page.querySelector("#set-max-history");
      if (logEl) logEl.checked = s.logHistory !== false;
      if (maxEl) maxEl.value = String(s.maxHistory || 500);
    } catch {
    }
  }

  async function runLine(line) {
    const time = new Date().toLocaleTimeString();
    try {
      const res = await invoke("command.run", { line, source: "console-app" });
      output.unshift({ line, ok: res.ok !== false, message: res.message || "Done", time });
      if (output.length > 80) output.length = 80;
      render();
      window.ConsoleApp?.refreshStats?.();
    } catch (err) {
      output.unshift({ line, ok: false, message: err.message, time });
      render();
    }
  }

  async function scan() {
    try {
      const [histRes, aliasRes, macroRes] = await Promise.all([
        invoke("history.list"),
        invoke("aliases.list"),
        invoke("macros.list"),
      ]);
      historyUp = (histRes.items || []).map((h) => h.line).filter(Boolean);
      quickAliases = aliasRes.items || [];
      quickMacros = macroRes.items || [];
    } catch {
    }
    render();
  }

  return { id: "runner", page, scan, runLine };
})();