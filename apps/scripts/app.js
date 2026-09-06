(function () {
  const state = {
    scripts: [],
    settings: { stopOnError: true },
    activeId: null,
    dirty: false,
    running: false,
  };

  const $ = (id) => document.getElementById(id);

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function invoke(channel, args) {
    if (!window.myApp?.invoke) throw new Error("App bridge unavailable");
    return window.myApp.invoke(channel, args || {});
  }

  function activeScript() {
    return state.scripts.find((s) => s.id === state.activeId) || null;
  }

  function formatWhen(iso) {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  function countLines(body) {
    return String(body || "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#")).length;
  }

  function markDirty(on = true) {
    state.dirty = on;
    const meta = $("script-meta");
    if (!meta) return;
    const s = activeScript();
    if (!s) {
      meta.textContent = "Command-line name: type it after right-click on the desktop";
      return;
    }
    const cmd = s.name || "name";
    const base = `Command line: ${cmd} · ${countLines(s.body)} steps · ${formatWhen(s.updatedAt)}`;
    meta.textContent = state.dirty ? `${base} · unsaved` : base;
  }

  function renderList() {
    const list = $("script-list");
    if (!list) return;
    if (!state.scripts.length) {
      list.innerHTML = `<p class="output-empty" style="padding:0.5rem">No scripts yet.</p>`;
      return;
    }
    list.innerHTML = state.scripts
      .map((s) => {
        const active = s.id === state.activeId ? " is-active" : "";
        return `<button type="button" class="script-item${active}" data-id="${escapeHtml(s.id)}">
          <strong>${escapeHtml(s.name)}</strong>
          <span>${countLines(s.body)} steps</span>
        </button>`;
      })
      .join("");

    list.querySelectorAll("[data-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (state.dirty && !(await confirmLeave())) return;
        selectScript(btn.dataset.id);
      });
    });
  }

  async function confirmLeave() {
    return window.confirm("You have unsaved changes. Discard them?");
  }

  function selectScript(id) {
    const s = state.scripts.find((x) => x.id === id);
    if (!s) return;
    state.activeId = s.id;
    state.dirty = false;
    const nameEl = $("script-name");
    const bodyEl = $("script-body");
    if (nameEl) nameEl.value = s.name;
    if (bodyEl) bodyEl.value = s.body;
    renderList();
    markDirty(false);
  }

  function readEditorIntoState() {
    const s = activeScript();
    if (!s) return null;
    s.name = ($("script-name")?.value || s.name).trim() || s.name;
    s.body = $("script-body")?.value ?? s.body;
    return s;
  }

  async function refresh() {
    const res = await invoke("storage.load");
    if (!res?.ok) throw new Error(res?.error || "Load failed");
    state.scripts = res.data.scripts || [];
    state.settings = res.data.settings || { stopOnError: true };
    const stop = $("stop-on-error");
    if (stop) stop.checked = state.settings.stopOnError !== false;
    if (!state.activeId || !state.scripts.some((s) => s.id === state.activeId)) {
      state.activeId = state.scripts[0]?.id || null;
    }
    if (state.activeId) selectScript(state.activeId);
    else {
      renderList();
      if ($("script-name")) $("script-name").value = "";
      if ($("script-body")) $("script-body").value = "";
    }
  }

  async function save() {
    const s = readEditorIntoState();
    if (!s) return;
    const res = await invoke("scripts.update", {
      id: s.id,
      name: s.name,
      body: s.body,
    });
    if (!res?.ok) {
      window.alert(res?.error || "Save failed");
      return;
    }
    const idx = state.scripts.findIndex((x) => x.id === s.id);
    if (idx >= 0) state.scripts[idx] = res.script;
    state.dirty = false;
    renderList();
    markDirty(false);
  }

  async function createNew() {
    if (state.dirty && !(await confirmLeave())) return;
    const res = await invoke("scripts.create", {});
    if (!res?.ok) {
      window.alert(res?.error || "Create failed");
      return;
    }
    state.scripts.unshift(res.script);
    selectScript(res.script.id);
  }

  async function duplicate() {
    const s = activeScript();
    if (!s) return;
    if (state.dirty) await save();
    const res = await invoke("scripts.duplicate", { id: s.id });
    if (!res?.ok) {
      window.alert(res?.error || "Duplicate failed");
      return;
    }
    state.scripts.unshift(res.script);
    selectScript(res.script.id);
  }

  async function remove() {
    const s = activeScript();
    if (!s) return;
    if (!window.confirm(`Delete script "${s.name}"?`)) return;
    const res = await invoke("scripts.delete", { id: s.id });
    if (!res?.ok) {
      window.alert(res?.error || "Delete failed");
      return;
    }
    state.scripts = state.scripts.filter((x) => x.id !== s.id);
    state.activeId = state.scripts[0]?.id || null;
    state.dirty = false;
    if (state.activeId) selectScript(state.activeId);
    else {
      renderList();
      if ($("script-name")) $("script-name").value = "";
      if ($("script-body")) $("script-body").value = "";
      markDirty(false);
    }
  }

  function paintLog(results, summary) {
    const log = $("output-log");
    if (!log) return;
    if (!results?.length) {
      log.innerHTML = `<p class="output-empty">Run a script to see each step here.</p>`;
      return;
    }
    const rows = results
      .map(
        (r, i) => `<div class="output-row ${r.ok ? "ok" : "err"}">
        <span class="output-idx">${r.ok ? "ok" : "err"} ${i + 1}</span>
        <code class="output-cmd">${escapeHtml(r.line)}</code>
        <span class="output-msg">${escapeHtml(r.message || "")}</span>
      </div>`
      )
      .join("");
    const sum = summary
      ? `<p class="output-summary ${summary.ok ? "is-ok" : "is-err"}">${escapeHtml(summary.text)}</p>`
      : "";
    log.innerHTML = rows + sum;
    log.scrollTop = log.scrollHeight;
  }

  async function run() {
    if (state.running) return;
    const s = readEditorIntoState();
    if (!s) return;
    if (state.dirty) {
      try {
        await save();
      } catch {
      }
    }

    const stopOnError = $("stop-on-error")?.checked !== false;
    state.running = true;
    const btn = $("btn-run");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Running…";
    }
    paintLog([], null);

    try {
      const res = await invoke("scripts.run", {
        body: $("script-body")?.value ?? s.body,
        stopOnError,
      });
      const results = res?.results || [];
      const text =
        res?.message ||
        (res?.stopped
          ? `Stopped after ${res.ran}/${res.total} steps`
          : `Finished ${results.length} steps`);
      paintLog(results, { ok: !!res?.ok, text });
    } catch (err) {
      paintLog(
        [{ line: "(runner)", ok: false, message: err?.message || String(err) }],
        { ok: false, text: "Runner failed" }
      );
    } finally {
      state.running = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Run";
      }
    }
  }

  function openScript(nameOrId) {
    const key = String(nameOrId || "").trim().toLowerCase();
    if (!key) return false;
    const hit = state.scripts.find(
      (s) => s.id === nameOrId || s.name.toLowerCase() === key
    );
    if (!hit) return false;
    selectScript(hit.id);
    return true;
  }

  async function openAndRun(nameOrId) {
    const ok = openScript(nameOrId);
    if (!ok) return { ok: false, error: "Script not found" };
    await run();
    return { ok: true };
  }

  async function exportSpace() {
    const s = readEditorIntoState() || activeScript();
    if (!s) return;
    if (state.dirty) {
      try {
        await save();
      } catch {
      }
    }
    if (!window.spaceFile?.export) {
      paintLog(
        [{ line: "(export)", ok: false, message: "Export unavailable" }],
        { ok: false, text: "Could not export .space" }
      );
      return;
    }
    try {
      const res = await window.spaceFile.export({
        kind: "script",
        payload: { name: s.name, body: $("script-body")?.value ?? s.body },
      });
      if (res?.cancelled) return;
      if (!res?.ok) throw new Error(res?.error || "Export failed");
      paintLog([], { ok: true, text: res.message || `Exported ${res.path}` });
    } catch (err) {
      paintLog(
        [{ line: "(export)", ok: false, message: err?.message || String(err) }],
        { ok: false, text: "Could not export .space" }
      );
    }
  }

  function bind() {
    $("btn-new")?.addEventListener("click", () => createNew());
    $("btn-save")?.addEventListener("click", () => save());
    $("btn-export-space")?.addEventListener("click", () => exportSpace());
    $("btn-run")?.addEventListener("click", () => run());
    $("btn-duplicate")?.addEventListener("click", () => duplicate());
    $("btn-delete")?.addEventListener("click", () => remove());
    $("btn-clear-log")?.addEventListener("click", () => paintLog([], null));

    $("script-name")?.addEventListener("input", () => {
      const s = activeScript();
      if (!s) return;
      s.name = $("script-name").value;
      markDirty(true);
      renderList();
    });
    $("script-body")?.addEventListener("input", () => {
      const s = activeScript();
      if (!s) return;
      s.body = $("script-body").value;
      markDirty(true);
      renderList();
    });
    $("script-body")?.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        run();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const ta = e.target;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        ta.value = `${ta.value.slice(0, start)}  ${ta.value.slice(end)}`;
        ta.selectionStart = ta.selectionEnd = start + 2;
        ta.dispatchEvent(new Event("input"));
      }
    });

    $("stop-on-error")?.addEventListener("change", async (e) => {
      const on = !!e.target.checked;
      state.settings.stopOnError = on;
      await invoke("settings.patch", { stopOnError: on });
    });
  }

  async function init() {
    bind();
    try {
      await refresh();
    } catch (err) {
      paintLog(
        [{ line: "(load)", ok: false, message: err?.message || String(err) }],
        { ok: false, text: "Could not load scripts" }
      );
    }
  }

  window.ScriptsApp = {
    openScript,
    openAndRun,
    run,
    save,
    refresh,
    selectScript,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();