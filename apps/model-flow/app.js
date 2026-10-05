(function () {
  const TOOL_META = {
    email: { label: "Email", icon: "✉" },
    sheets: { label: "Sheets", icon: "▦" },
    notify: { label: "Notify", icon: "◎" },
    shell: { label: "Shell", icon: ">" },
    stocks: { label: "Stocks", icon: "↗" },
    translate: { label: "Translate", icon: "文" },
    files: { label: "Files", icon: "▣" },
    web: { label: "Web", icon: "◌" },
    model: { label: "Model", icon: "✦" },
    calendar: { label: "Calendar", icon: "◷" },
    contacts: { label: "Contacts", icon: "☺" },
    wait: { label: "Wait", icon: "⏳" },
    github: { label: "GitHub", icon: "⎇" },
    reddit: { label: "Reddit", icon: "◉" },
    search: { label: "Search", icon: "⌕" },
    google: { label: "Google", icon: "G" },
  };

  const TOOL_FIELDS = {
    email: [
      { key: "to", label: "To", placeholder: "name@example.com" },
      { key: "subject", label: "Subject", placeholder: "Subject line" },
      { key: "action", label: "Action", placeholder: "send" },
    ],
    sheets: [
      { key: "action", label: "Action", placeholder: "append" },
      { key: "symbol", label: "Sheet", placeholder: "Weekly tracker" },
    ],
    notify: [{ key: "message", label: "Message", placeholder: "Done!" }],
    stocks: [{ key: "symbol", label: "Symbol", placeholder: "AAPL" }],
    shell: [{ key: "command", label: "Command", placeholder: "today(list)" }],
    web: [{ key: "url", label: "URL", placeholder: "https://…" }],
    files: [{ key: "path", label: "Path", placeholder: "/path/to/file" }],
    translate: [
      { key: "text", label: "Text", placeholder: "Hello" },
      { key: "to", label: "To", placeholder: "en" },
    ],
    contacts: [{ key: "query", label: "Search", placeholder: "Dana" }],
    wait: [{ key: "seconds", label: "Seconds", placeholder: "2" }],
    model: [{ key: "action", label: "Action", placeholder: "summarize" }],
  };

  const STUDIO_TOOLS = [
    "notify",
    "shell",
    "stocks",
    "translate",
    "contacts",
    "wait",
    "model",
    "email",
    "sheets",
  ];

  const TEMPLATES = [
    {
      id: "quote-notify",
      title: "Quote + notify",
      blurb: "Fetch a ticker, then toast the price",
      task: "Quote AAPL and notify me",
      steps: [
        { tool: "stocks", label: "Fetch AAPL", config: { symbol: "AAPL" } },
        { tool: "notify", label: "Notify", config: { message: "Quote ready" } },
      ],
    },
    {
      id: "translate-notify",
      title: "Translate",
      blurb: "Convert text, then confirm",
      task: "Translate hello to Hebrew",
      steps: [
        { tool: "translate", label: "Translate", config: { text: "Hello", to: "he" } },
        { tool: "notify", label: "Notify", config: { message: "Translation ready" } },
      ],
    },
    {
      id: "contacts-lookup",
      title: "Find a person",
      blurb: "Search Contacts, then notify",
      task: "Look up Dana in contacts",
      steps: [
        { tool: "contacts", label: "Search contacts", config: { query: "Dana" } },
        { tool: "notify", label: "Notify", config: { message: "Contact lookup done" } },
      ],
    },
    {
      id: "shell-pulse",
      title: "Desktop pulse",
      blurb: "Run a shell check, wait, notify",
      task: "Check running apps then notify",
      steps: [
        { tool: "shell", label: "Check running", config: { command: "check running" } },
        { tool: "wait", label: "Pause", config: { seconds: "2" } },
        { tool: "notify", label: "Notify", config: { message: "Pulse done" } },
      ],
    },
  ];

  const FALLBACK_FIELDS = [
    { key: "action", label: "Action", placeholder: "" },
    { key: "to", label: "To", placeholder: "" },
    { key: "symbol", label: "Symbol", placeholder: "" },
  ];

  let pendingFlow = null;
  let lastRanFlow = null;
  let lastRunResults = [];
  let lastFailedIndex = -1;
  let libraryId = null;
  let editable = false;
  let busy = false;
  let studioPhase = "task";
  let activePanel = "history";
  let dockOpen = false;
  let toolsCache = [];
  let historyCache = [];
  let libraryCache = [];
  let historyQuery = "";

  const ui = {
    shell: document.getElementById("shell"),
    phaseRail: document.getElementById("phase-rail"),
    compose: document.getElementById("compose"),
    taskInput: document.getElementById("task-input"),
    btnPlan: document.getElementById("btn-plan"),
    composeHint: document.getElementById("compose-hint"),
    exampleChips: document.getElementById("example-chips"),
    aiStatus: document.getElementById("ai-status"),
    stageEmpty: document.getElementById("stage-empty"),
    flowPanel: document.getElementById("flow-panel"),
    flowTitle: document.getElementById("flow-title"),
    flowSummary: document.getElementById("flow-summary"),
    flowStatus: document.getElementById("flow-status"),
    flowTrack: document.getElementById("flow-track"),
    addStepBar: document.getElementById("add-step-bar"),
    addStepTools: document.getElementById("add-step-tools"),
    flowLog: document.getElementById("flow-log"),
    approveBar: document.getElementById("approve-bar"),
    approveNote: document.getElementById("approve-note"),
    btnApprove: document.getElementById("btn-approve"),
    btnReject: document.getElementById("btn-reject"),
    btnSaveScript: document.getElementById("btn-save-script"),
    btnSaveScriptDone: document.getElementById("btn-save-script-done"),
    btnSaveLibrary: document.getElementById("btn-save-library"),
    btnSaveLibraryDone: document.getElementById("btn-save-library-done"),
    btnExportSpace: document.getElementById("btn-export-space"),
    btnExportSpaceDone: document.getElementById("btn-export-space-done"),
    btnRetryFailed: document.getElementById("btn-retry-failed"),
    btnBlank: document.getElementById("btn-blank"),
    templateGrid: document.getElementById("template-grid"),
    postRunBar: document.getElementById("post-run-bar"),
    postRunNote: document.getElementById("post-run-note"),
    historySearch: document.getElementById("history-search"),
    libraryList: document.getElementById("library-list"),
    dock: document.getElementById("dock"),
    dockPanel: document.getElementById("dock-panel"),
    historyList: document.getElementById("history-list"),
    toolsList: document.getElementById("tools-list"),
    metaStatus: document.getElementById("meta-status"),
    metaModel: document.getElementById("meta-model"),
    apiKeyInput: document.getElementById("api-key-input"),
    btnSaveKey: document.getElementById("btn-save-key"),
    btnClearKey: document.getElementById("btn-clear-key"),
    connectionNote: document.getElementById("connection-note"),
  };

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function configChips(config = {}) {
    if (!config || typeof config !== "object" || Array.isArray(config)) return [];
    const skip = new Set(["task", "prompt", "body", "text", "contentFrom"]);
    return Object.entries(config)
      .filter(([k, v]) => v != null && v !== "" && !skip.has(k))
      .slice(0, 8)
      .map(([key, value]) => ({ key, value: String(value).slice(0, 80) }));
  }

  async function invoke(channel, args) {
    if (!window.myApp?.invoke) throw new Error("Model Flow bridge unavailable — restart My Space");
    return window.myApp.invoke(channel, args || {});
  }

  function setBusy(next) {
    busy = Boolean(next);
    ui.btnPlan.disabled = busy;
    ui.taskInput.disabled = busy;
    ui.btnApprove.disabled = busy;
    ui.btnReject.disabled = busy && !pendingFlow;
    if (ui.btnSaveScript) ui.btnSaveScript.disabled = busy;
    if (ui.btnSaveScriptDone) ui.btnSaveScriptDone.disabled = busy;
    if (ui.btnSaveLibrary) ui.btnSaveLibrary.disabled = busy;
    if (ui.btnSaveLibraryDone) ui.btnSaveLibraryDone.disabled = busy;
    if (ui.btnExportSpace) ui.btnExportSpace.disabled = busy;
    if (ui.btnExportSpaceDone) ui.btnExportSpaceDone.disabled = busy;
    if (ui.btnRetryFailed) ui.btnRetryFailed.disabled = busy;
    if (ui.btnBlank) ui.btnBlank.disabled = busy;
    ui.btnSaveKey.disabled = busy;
    ui.btnClearKey.disabled = busy;
  }

  function setStudioPhase(phase) {
    studioPhase = phase;
    ui.shell.dataset.phase = phase;
    ui.phaseRail.querySelectorAll(".phase").forEach((el) => {
      const p = el.dataset.phase;
      el.classList.toggle("is-active", p === phase);
      el.classList.toggle("is-done", phaseOrder(p) < phaseOrder(phase));
    });
    ui.compose.classList.toggle("is-compact", phase !== "task" && !!pendingFlow);
    ui.exampleChips.classList.toggle("hidden", phase !== "task" || !!pendingFlow);
    if (ui.postRunBar) {
      ui.postRunBar.classList.toggle("hidden", phase !== "done" || !lastRanFlow);
    }
  }

  function phaseOrder(phase) {
    return { task: 0, plan: 1, review: 2, run: 3, done: 4 }[phase] ?? 0;
  }

  function setStatus(text, kind) {
    ui.flowStatus.textContent = text;
    ui.flowStatus.className = "flow-status" + (kind ? ` is-${kind}` : "");
  }

  function formatWhen(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return String(iso).slice(0, 16);
    }
  }

  function setDockOpen(open) {
    dockOpen = Boolean(open);
    ui.dock.classList.toggle("is-open", dockOpen);
  }

  function showPanel(name) {
    activePanel = name;
    setDockOpen(true);
    document.querySelectorAll(".dock-btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.panel === name);
    });
    document.querySelectorAll(".side-pane").forEach((pane) => {
      const on = pane.dataset.pane === name;
      pane.classList.toggle("is-active", on);
      pane.hidden = !on;
    });
  }

  function fieldsForTool(tool, config = {}) {
    const defs = TOOL_FIELDS[tool] || FALLBACK_FIELDS;
    const used = new Set();
    const fields = defs.map((f) => {
      used.add(f.key);
      return { ...f, value: config[f.key] != null ? String(config[f.key]) : "" };
    });
    configChips(config).forEach((c) => {
      if (!used.has(c.key) && fields.length < 4) {
        fields.push({
          key: c.key,
          label: c.key,
          placeholder: "",
          value: c.value,
        });
        used.add(c.key);
      }
    });
    return fields.slice(0, 4);
  }

  function renderEditableFields(tool, config = {}) {
    const fields = fieldsForTool(tool, config);
    if (!fields.length) return "";
    return `<div class="step-fields">${fields
      .map(
        (f) => `<label class="field-row">
          <span class="field-row-label">${escapeHtml(f.label)}</span>
          <input type="text" data-chip-key="${escapeHtml(f.key)}" value="${escapeHtml(
            f.value
          )}" placeholder="${escapeHtml(f.placeholder || "")}" />
        </label>`
      )
      .join("")}</div>`;
  }

  function renderReadChips(chips) {
    if (!chips?.length) return "";
    return `<div class="step-chips">${chips
      .map(
        (c) =>
          `<span class="chip"><span class="chip-k">${escapeHtml(c.key)}</span><span class="chip-v">${escapeHtml(
            c.value
          )}</span></span>`
      )
      .join("")}</div>`;
  }

  function collectEditedFlow() {
    if (!pendingFlow) return null;
    const steps = [];
    ui.flowTrack.querySelectorAll(".step").forEach((el) => {
      const idx = Number(el.dataset.index);
      const base = pendingFlow.steps[idx];
      if (!base) return;
      const config = { ...(base.config || {}) };
      el.querySelectorAll("[data-chip-key]").forEach((input) => {
        const key = input.dataset.chipKey;
        const val = String(input.value || "").trim();
        if (val) config[key] = val;
        else delete config[key];
      });
      const titleInput = el.querySelector("[data-step-title]");
      steps.push({
        ...base,
        label: titleInput ? String(titleInput.value || "").trim() || base.label : base.label,
        config,
        chips: configChips(config),
      });
    });
    const titleEl = ui.flowTitle;
    const title =
      titleEl && "value" in titleEl
        ? String(titleEl.value || "").trim() || pendingFlow.title
        : pendingFlow.title;
    return {
      ...pendingFlow,
      title,
      summary: pendingFlow.summary,
      task: pendingFlow.task || (ui.taskInput.value || "").trim(),
      steps,
    };
  }

  function blankStep(tool) {
    const id = tool || "notify";
    const config =
      id === "stocks"
        ? { symbol: "AAPL" }
        : id === "translate"
          ? { text: "Hello", to: "en" }
          : id === "shell"
            ? { command: "check running" }
            : id === "wait"
              ? { seconds: "2" }
              : id === "notify"
                ? { message: "Flow finished" }
                : id === "contacts"
                  ? { query: "" }
                  : {};
    const meta = TOOL_META[id] || { label: id };
    return {
      tool: id,
      label: meta.label,
      config,
      chips: configChips(config),
    };
  }

  function mutateSteps(fn) {
    if (!pendingFlow || !editable || busy) return;
    const next = collectEditedFlow();
    if (!next) return;
    next.steps = fn(next.steps.slice()) || next.steps;
    if (!next.steps.length) {
      next.steps = [blankStep("notify")];
    }
    renderFlow(next, { editable: true });
  }

  function removeStep(index) {
    mutateSteps((steps) => steps.filter((_, i) => i !== index));
  }

  function moveStep(index, dir) {
    mutateSteps((steps) => {
      const j = index + dir;
      if (j < 0 || j >= steps.length) return steps;
      const copy = steps.slice();
      const [item] = copy.splice(index, 1);
      copy.splice(j, 0, item);
      return copy;
    });
  }

  function duplicateStep(index) {
    mutateSteps((steps) => {
      const copy = steps.slice();
      const src = copy[index];
      if (!src) return copy;
      copy.splice(index + 1, 0, {
        ...src,
        id: undefined,
        label: `${src.label || src.tool} (copy)`,
        config: { ...(src.config || {}) },
      });
      return copy;
    });
  }

  function changeStepTool(index, tool) {
    mutateSteps((steps) => {
      const copy = steps.slice();
      if (!copy[index]) return copy;
      const next = blankStep(tool);
      copy[index] = { ...copy[index], tool: next.tool, label: next.label, config: next.config, chips: next.chips };
      return copy;
    });
  }

  function addStep(tool) {
    mutateSteps((steps) => steps.concat(blankStep(tool)));
  }

  function applyTemplate(tpl) {
    if (!tpl) return;
    ui.taskInput.value = tpl.task || "";
    renderFlow(
      {
        title: tpl.title,
        summary: tpl.blurb,
        task: tpl.task || "",
        source: "template",
        steps: (tpl.steps || []).map((s) => ({
          ...s,
          chips: configChips(s.config || {}),
        })),
      },
      { editable: true }
    );
    ui.composeHint.textContent = "Template loaded — edit steps, then approve.";
  }

  async function startBlank() {
    try {
      const res = await invoke("flow.blank", { task: ui.taskInput.value || "" });
      if (!res?.ok) throw new Error(res?.error || "Could not create blank flow");
      libraryId = null;
      renderFlow(res.flow, { editable: true });
      ui.composeHint.textContent = "Blank flow — add steps, then approve.";
    } catch (err) {
      ui.composeHint.textContent = err?.message || String(err);
    }
  }

  function renderAddStepBar() {
    if (!ui.addStepBar || !ui.addStepTools) return;
    const show = editable && !!pendingFlow;
    ui.addStepBar.classList.toggle("hidden", !show);
    if (!show) return;
    ui.addStepTools.innerHTML = STUDIO_TOOLS.map((id) => {
      const meta = TOOL_META[id] || { label: id, icon: "•" };
      return `<button type="button" class="add-step-chip" data-add-tool="${escapeHtml(id)}">${escapeHtml(
        meta.icon
      )} ${escapeHtml(meta.label)}</button>`;
    }).join("");
  }

  function countStagedSteps(steps) {
    return (steps || []).filter((s) => {
      const live = toolsCache.find((t) => t.id === s.tool)?.live;
      return live === false;
    }).length;
  }

  function renderFlow(flow, opts = {}) {
    pendingFlow = flow;
    editable = opts.editable !== false;
    const keepLog = opts.keepLog === true;
    ui.stageEmpty.classList.add("hidden");
    ui.flowPanel.classList.remove("hidden");
    ui.approveBar.classList.toggle("hidden", !editable);
    if (!keepLog) {
      ui.flowLog.classList.add("hidden");
      ui.flowLog.innerHTML = "";
    }
    ui.btnApprove.textContent = "Approve & run";
    if (ui.btnRetryFailed) ui.btnRetryFailed.classList.add("hidden");
    if (ui.flowTitle) {
      if ("value" in ui.flowTitle) ui.flowTitle.value = flow.title || "Untitled flow";
      else ui.flowTitle.textContent = flow.title || "Untitled flow";
    }
    ui.flowSummary.textContent = flow.summary || "";

    const staged = countStagedSteps(flow.steps);
    if (editable) {
      setStudioPhase("review");
      setStatus("Review", "pending");
      ui.approveNote.textContent =
        staged > 0
          ? `${staged} step${staged === 1 ? "" : "s"} are not available yet and will be skipped.`
          : "Tools run only after you approve.";
    } else if (studioPhase === "run") {
      setStatus("Running", "running");
    } else {
      setStudioPhase("done");
      setStatus("Done", "done");
    }

    ui.flowTrack.innerHTML = (flow.steps || [])
      .map((step, i) => {
        const meta = TOOL_META[step.tool] || { label: step.tool || "tool", icon: "•" };
        const live = toolsCache.find((t) => t.id === step.tool)?.live;
        const liveBadge =
          live === false
            ? `<span class="step-live is-staged">Unavailable</span>`
            : live
              ? `<span class="step-live is-live">Live</span>`
              : "";
        const chips = step.chips?.length ? step.chips : configChips(step.config);
        const toolOpts = STUDIO_TOOLS.map((id) => {
          const m = TOOL_META[id] || { label: id };
          return `<option value="${escapeHtml(id)}"${id === step.tool ? " selected" : ""}>${escapeHtml(
            m.label
          )}</option>`;
        }).join("");
        const extraTool =
          step.tool && !STUDIO_TOOLS.includes(step.tool)
            ? `<option value="${escapeHtml(step.tool)}" selected>${escapeHtml(step.tool)}</option>`
            : "";
        const body = editable
          ? `<div class="step-edit-head">
               <select class="step-tool-select" data-step-tool="${i}" aria-label="Step tool">${extraTool}${toolOpts}</select>
               <input class="step-title-input" data-step-title value="${escapeHtml(
                 step.label || step.tool || "Step"
               )}" aria-label="Step title" />
               <div class="step-ops">
                 <button type="button" class="step-op" data-move="${i}" data-dir="-1" title="Move up" ${
                   i === 0 ? "disabled" : ""
                 }>↑</button>
                 <button type="button" class="step-op" data-move="${i}" data-dir="1" title="Move down" ${
                   i === (flow.steps || []).length - 1 ? "disabled" : ""
                 }>↓</button>
                 <button type="button" class="step-op" data-dup="${i}" title="Duplicate">⧉</button>
                 <button type="button" class="step-drop" data-drop="${i}" title="Remove step">✕</button>
               </div>
             </div>
             ${renderEditableFields(step.tool, step.config || {})}`
          : `<p class="step-label">${escapeHtml(step.label || step.tool || "Step")}</p>
             ${renderReadChips(chips)}`;
        return `<li class="step${editable ? " is-editable" : ""}" data-index="${i}">
          <div class="step-rail"><span class="step-index">${i + 1}</span></div>
          <article class="step-card">
            <div class="step-card-top">
              <span class="step-tool"><span aria-hidden="true">${meta.icon}</span>${escapeHtml(
                meta.label
              )}</span>
              ${liveBadge}
              <span class="step-phase">${editable ? "planned" : "done"}</span>
            </div>
            ${body}
            <div class="step-result hidden" data-result></div>
          </article>
        </li>`;
      })
      .join("");
    renderAddStepBar();
  }

  function clearFlow() {
    pendingFlow = null;
    lastRanFlow = null;
    lastRunResults = [];
    lastFailedIndex = -1;
    libraryId = null;
    editable = false;
    ui.flowPanel.classList.add("hidden");
    ui.stageEmpty.classList.remove("hidden");
    ui.approveBar.classList.add("hidden");
    if (ui.postRunBar) ui.postRunBar.classList.add("hidden");
    ui.flowTrack.innerHTML = "";
    ui.flowLog.classList.add("hidden");
    if (ui.addStepBar) ui.addStepBar.classList.add("hidden");
    if (ui.btnRetryFailed) ui.btnRetryFailed.classList.add("hidden");
    setStudioPhase("task");
    ui.composeHint.textContent = "Describe a task, plan steps, review, then approve.";
  }

  function markStep(index, state) {
    const el = ui.flowTrack.children[index];
    if (!el) return;
    el.classList.remove("is-running", "is-done", "is-failed", "is-staged");
    if (state) el.classList.add(`is-${state}`);
    const phase = el.querySelector(".step-phase");
    if (phase) {
      const map = { running: "running", done: "done", failed: "failed", staged: "staged" };
      phase.textContent = map[state] || "planned";
    }
  }

  function renderResultIntoStep(index, result) {
    const el = ui.flowTrack.children[index];
    if (!el) return;
    const slot = el.querySelector("[data-result]");
    if (!slot) return;
    const d = result.display || {
      status: result.ok ? "ok" : "error",
      title: result.label || result.tool,
      summary: result.message || result.error || "",
      facts: [],
      links: [],
    };
    const links = (d.links || [])
      .map(
        (l) =>
          `<a class="result-link" href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
            l.label || "Open"
          )}</a>`
      )
      .join("");

    slot.classList.remove("hidden");
    slot.innerHTML = `
      <p class="result-summary">${escapeHtml(d.summary || "")}</p>
      ${links ? `<div class="result-links">${links}</div>` : ""}
    `;
  }

  function appendProtocolRow(result) {
    const d = result.display || {};
    const status = d.status || (result.ok ? "ok" : "error");
    const icon = status === "ok" ? "✓" : status === "staged" ? "◌" : "✕";
    const link = d.links?.[0]
      ? ` <a href="${escapeHtml(d.links[0].url)}" target="_blank" rel="noopener noreferrer">link</a>`
      : "";
    return `<div class="log-row is-${escapeHtml(status)}">
      <span class="log-icon">${icon}</span>
      <div class="log-body">
        <div class="log-title">${escapeHtml(d.title || result.label || result.tool)}</div>
        <div class="log-summary">${escapeHtml(d.summary || result.message || result.error || "")}${link}</div>
      </div>
    </div>`;
  }

  async function refreshMeta() {
    try {
      const res = await invoke("flow.meta");
      if (!res?.ok) return;
      const hasKey = !!res.hasKey;
      ui.aiStatus.textContent = hasKey
        ? res.keySource === "product"
          ? "Lab connected"
          : "Lab connected"
        : "No Lab key";
      ui.aiStatus.classList.toggle("is-ready", hasKey);
      ui.aiStatus.title = hasKey
        ? `Connected · ${res.model || "model"} · ${res.keySource || "key"}`
        : "No Lab key — click to connect (required for Approve & run)";
      ui.metaStatus.textContent = hasKey
        ? res.keySource === "product"
          ? "Connected (built-in)"
          : `Connected (${res.keySource || "key"})`
        : "Disconnected";
      ui.metaModel.textContent = res.model || "—";
      ui.connectionNote.textContent = hasKey
        ? res.keySource === "product"
          ? "Using the My Space Lab key. You can paste your own key to override."
          : "Key stored in userData."
        : "Required for real runs. Paste a Lab key and Save.";
      if (!hasKey && studioPhase === "task" && !pendingFlow) {
        ui.composeHint.textContent = "Save a Lab key under Connection before Approve & run.";
      } else if (hasKey && studioPhase === "task" && !pendingFlow) {
        ui.composeHint.textContent = "Describe a task, plan steps, review, then approve.";
      }
      if (Array.isArray(res.tools) && res.tools.length) {
        toolsCache = res.tools;
        renderToolsList();
      }
    } catch {
    }
  }

  function renderToolsList() {
    // Hide unfinished tools from the product UI (calendar/files/web stay out until live).
    const live = toolsCache.filter((t) => t.live !== false);
    const renderGroup = (title, items) => {
      if (!items.length) return "";
      return `<section class="tool-group">
        <h3 class="tool-group-title">${escapeHtml(title)}</h3>
        ${items
          .map((t) => {
            const meta = TOOL_META[t.id] || { label: t.id, icon: "•" };
            const lab = t.labToolkit ? `<span class="tool-lab">${escapeHtml(t.labToolkit)}</span>` : "";
            return `<div class="tool-row">
              <span class="tool-row-name"><span aria-hidden="true">${meta.icon}</span> ${escapeHtml(
                meta.label
              )}${lab}</span>
              <span class="tool-row-desc">${escapeHtml(t.description || "")}</span>
            </div>`;
          })
          .join("")}
      </section>`;
    };
    ui.toolsList.innerHTML =
      renderGroup("Available", live) || '<p class="side-empty">No tools listed.</p>';
  }

  async function refreshTools() {
    try {
      const res = await invoke("flow.tools");
      if (!res?.ok) return;
      toolsCache = res.tools || [];
      renderToolsList();
      if (pendingFlow?.steps?.length) {
        renderFlow(pendingFlow, { editable });
      }
    } catch (err) {
      ui.toolsList.innerHTML = `<p class="side-empty">${escapeHtml(err?.message || String(err))}</p>`;
    }
  }

  async function refreshHistory() {
    try {
      const res = await invoke("flow.history");
      if (!res?.ok) return;
      historyCache = res.items || [];
      renderHistoryList();
    } catch (err) {
      ui.historyList.innerHTML = `<p class="side-empty">${escapeHtml(err?.message || String(err))}</p>`;
    }
  }

  function renderHistoryList() {
    const q = historyQuery.trim().toLowerCase();
    const items = historyCache.filter((item) => {
      if (!q) return true;
      const blob = [item.title, item.task, item.summary].join(" ").toLowerCase();
      return blob.includes(q);
    });
    if (!items.length) {
      ui.historyList.innerHTML = `<p class="side-empty">${
        historyCache.length ? "No matching runs." : "No runs yet."
      }</p>`;
      return;
    }
    ui.historyList.innerHTML = items
      .map((item) => {
        const title = escapeHtml(item.title || item.task || "Flow");
        const when = escapeHtml(formatWhen(item.at));
        const steps = Number(item.steps) || item.flow?.steps?.length || 0;
        const pin = item.pinned ? "Unpin" : "Pin";
        return `<article class="hist-row" data-id="${escapeHtml(item.id)}">
            <div class="hist-row-main">
              <strong>${item.pinned ? "● " : ""}${title}</strong>
              <span class="hist-meta">${when} · ${steps} step${steps === 1 ? "" : "s"}</span>
            </div>
            <div class="hist-row-actions">
              <button type="button" class="btn btn-sm btn-ghost" data-hist-open="${escapeHtml(
                item.id
              )}">Open</button>
              <button type="button" class="btn btn-sm btn-ghost" data-hist-reuse="${escapeHtml(
                item.id
              )}">Reuse</button>
              <button type="button" class="btn btn-sm btn-ghost" data-hist-pin="${escapeHtml(
                item.id
              )}">${pin}</button>
              <button type="button" class="btn btn-sm btn-ghost" data-hist-del="${escapeHtml(
                item.id
              )}">✕</button>
            </div>
          </article>`;
      })
      .join("");
  }

  async function refreshLibrary() {
    if (!ui.libraryList) return;
    try {
      const res = await invoke("flow.library.list", {});
      if (!res?.ok) return;
      libraryCache = res.items || [];
      if (!libraryCache.length) {
        ui.libraryList.innerHTML = '<p class="side-empty">No saved flows yet.</p>';
        return;
      }
      ui.libraryList.innerHTML = libraryCache
        .map((item) => {
          const title = escapeHtml(item.title || "Untitled");
          const when = escapeHtml(formatWhen(item.at));
          const steps = Number(item.steps) || item.flow?.steps?.length || 0;
          return `<article class="hist-row" data-id="${escapeHtml(item.id)}">
            <div class="hist-row-main">
              <strong>${item.pinned ? "● " : ""}${title}</strong>
              <span class="hist-meta">${when} · ${steps} step${steps === 1 ? "" : "s"}</span>
            </div>
            <div class="hist-row-actions">
              <button type="button" class="btn btn-sm btn-ghost" data-lib-open="${escapeHtml(
                item.id
              )}">Open</button>
              <button type="button" class="btn btn-sm btn-ghost" data-lib-pin="${escapeHtml(
                item.id
              )}">${item.pinned ? "Unpin" : "Pin"}</button>
              <button type="button" class="btn btn-sm btn-ghost" data-lib-del="${escapeHtml(
                item.id
              )}">✕</button>
            </div>
          </article>`;
        })
        .join("");
    } catch (err) {
      ui.libraryList.innerHTML = `<p class="side-empty">${escapeHtml(err?.message || String(err))}</p>`;
    }
  }

  async function exportSpaceFile(flowOverride) {
    const flow = flowOverride || collectEditedFlow() || pendingFlow || lastRanFlow;
    if (!flow?.steps?.length) {
      ui.composeHint.textContent = "Nothing to export — add steps first.";
      return;
    }
    if (!window.spaceFile?.export) {
      ui.composeHint.textContent = "Export unavailable — restart My Space.";
      return;
    }
    setBusy(true);
    try {
      const res = await window.spaceFile.export({
        kind: "flow",
        payload: {
          title: flow.title,
          task: flow.task || ui.taskInput.value,
          summary: flow.summary,
          source: flow.source || "studio",
          steps: flow.steps,
        },
      });
      if (res?.cancelled) return;
      if (!res?.ok) throw new Error(res?.error || "Could not export");
      const msg = res.message || `Exported ${res.path}`;
      ui.composeHint.textContent = msg;
      if (ui.approveNote) ui.approveNote.textContent = msg;
      if (ui.postRunNote) ui.postRunNote.textContent = msg;
    } catch (err) {
      ui.composeHint.textContent = err?.message || String(err);
    } finally {
      setBusy(false);
    }
  }

  async function saveToLibrary() {
    const flow = collectEditedFlow() || pendingFlow || lastRanFlow;
    if (!flow || busy) return;
    setBusy(true);
    try {
      const res = await invoke("flow.library.save", {
        flow,
        id: libraryId,
        title: flow.title,
      });
      if (!res?.ok) throw new Error(res?.error || "Could not save flow");
      libraryId = res.item?.id || libraryId;
      const msg = `Saved · ${res.item?.title || "flow"}`;
      ui.composeHint.textContent = msg;
      if (ui.approveNote && !ui.approveBar.classList.contains("hidden")) {
        ui.approveNote.textContent = msg;
      }
      if (ui.postRunNote) ui.postRunNote.textContent = msg;
      await refreshLibrary();
      showPanel("library");
    } catch (err) {
      ui.composeHint.textContent = err?.message || String(err);
    } finally {
      setBusy(false);
    }
  }

  async function openLibraryItem(id) {
    let item = libraryCache.find((x) => x.id === id);
    if (!item?.flow?.steps?.length) {
      try {
        const res = await invoke("flow.library.get", { id });
        if (res?.ok) item = res.item;
      } catch {
      }
    }
    if (!item?.flow?.steps?.length) return;
    libraryId = item.id;
    if (item.task) ui.taskInput.value = item.task;
    renderFlow(
      {
        ...item.flow,
        title: item.flow.title || item.title,
        task: item.flow.task || item.task || "",
      },
      { editable: true }
    );
    ui.composeHint.textContent = "Saved flow — edit, then approve.";
  }

  function findHistory(id) {
    return historyCache.find((h) => h.id === id) || null;
  }

  async function openHistoryItem(id) {
    let item = findHistory(id);
    if (!item?.flow?.steps?.length) {
      try {
        const res = await invoke("flow.history.get", { id });
        if (res?.ok && res.item) item = res.item;
      } catch {
      }
    }
    if (!item) return;
    if (item.task) ui.taskInput.value = item.task;
    if (item.flow?.steps?.length) {
      renderFlow(
        {
          ...item.flow,
          task: item.flow.task || item.task || "",
          title: item.flow.title || item.title,
        },
        { editable: true }
      );
      ui.composeHint.textContent = "From history — edit if needed, then approve.";
    } else if (item.task) {
      clearFlow();
      ui.composeHint.textContent = "Task restored — press Plan.";
    }
  }

  function reuseHistoryTask(id) {
    const item = findHistory(id);
    if (!item?.task) return;
    ui.taskInput.value = item.task;
    ui.taskInput.focus();
    setStudioPhase("task");
    ui.composeHint.textContent = "Task copied — press Plan.";
  }

  async function planFlow(taskOverride) {
    const task = String(taskOverride != null ? taskOverride : ui.taskInput.value || "").trim();
    if (!task || busy) return;
    if (taskOverride != null) ui.taskInput.value = task;
    setBusy(true);
    setStudioPhase("plan");
    ui.btnPlan.textContent = "…";
    ui.composeHint.textContent = "Planning…";
    try {
      const res = await invoke("flow.plan", { task });
      if (!res?.ok) throw new Error(res?.error || "Could not plan flow");
      renderFlow(res.flow, { editable: true });
      if (res.warning) ui.composeHint.textContent = res.warning;
    } catch (err) {
      ui.composeHint.textContent = err?.message || String(err);
      clearFlow();
    } finally {
      ui.btnPlan.textContent = "Plan";
      setBusy(false);
      ui.taskInput.focus();
    }
  }

  function rejectFlow() {
    if (!pendingFlow) return;
    clearFlow();
    ui.composeHint.textContent = "Cancelled — describe another task when ready.";
  }

  async function saveAsScript(sourceFlow) {
    const flow = sourceFlow || collectEditedFlow() || pendingFlow || lastRanFlow;
    if (!flow || busy) return;
    setBusy(true);
    try {
      const res = await invoke("flow.saveAsScript", { flow });
      if (!res?.ok) throw new Error(res?.error || "Could not save script");
      const name = res.script?.name || "script";
      const msg = `Saved Scripts · ${name}`;
      ui.composeHint.textContent = msg;
      if (ui.postRunNote) ui.postRunNote.textContent = `${msg} — open with scripts(open ${name})`;
      if (ui.approveNote && !ui.approveBar.classList.contains("hidden")) {
        ui.approveNote.textContent = msg;
      }
      if (window.top?.showMySpaceToast) {
        window.top.showMySpaceToast(msg);
      }
    } catch (err) {
      const msg = err?.message || String(err);
      ui.composeHint.textContent = msg;
      if (ui.postRunNote) ui.postRunNote.textContent = msg;
    } finally {
      setBusy(false);
    }
  }

  function paintRunResults(results) {
    ui.flowLog.classList.remove("hidden");
    ui.flowLog.innerHTML = `<div class="log-head">Run log</div>`;
    lastFailedIndex = -1;
    (results || []).forEach((r, i) => {
      const state = !r.ok ? "failed" : r.staged || r.display?.status === "staged" ? "staged" : "done";
      if (state === "failed" && lastFailedIndex < 0) lastFailedIndex = i;
      markStep(i, state);
      renderResultIntoStep(i, r);
      ui.flowLog.innerHTML += appendProtocolRow(r);
    });
    ui.flowLog.scrollTop = ui.flowLog.scrollHeight;
  }

  function unlockApproveForRetry(message) {
    editable = true;
    ui.approveBar.classList.remove("hidden");
    ui.btnApprove.textContent = "Retry run";
    ui.approveNote.textContent = message || "Fix the issue, then retry.";
    if (ui.btnRetryFailed) {
      ui.btnRetryFailed.classList.toggle("hidden", lastFailedIndex < 0);
    }
    setStatus("Failed", "cancelled");
    setStudioPhase("review");
    renderAddStepBar();
  }

  async function approveFlow(opts = {}) {
    if (!pendingFlow || busy) return;
    setBusy(true);
    setStudioPhase("run");
    setStatus("Running", "running");
    ui.approveBar.classList.add("hidden");
    editable = false;

    let flow = collectEditedFlow() || pendingFlow;
    try {
      const normalized = await invoke("flow.normalize", { flow });
      if (normalized?.ok && normalized.flow) {
        flow = normalized.flow;
        if ((normalized.flow.steps || []).length !== (ui.flowTrack.children.length || 0)) {
          renderFlow(flow, { editable: false });
        } else {
          pendingFlow = flow;
          editable = false;
          ui.approveBar.classList.add("hidden");
        }
        setStudioPhase("run");
        setStatus("Running…", "running");
      }
    } catch {
    }

    const fromIndex = Math.max(0, Number(opts.fromIndex) || 0);
    const priorResults = fromIndex > 0 ? lastRunResults.slice(0, fromIndex) : [];
    ui.flowLog.classList.remove("hidden");
    ui.flowLog.innerHTML = `<div class="log-head">Run log</div><div class="log-row"><span class="log-icon">…</span><div class="log-body"><div class="log-summary">${
      fromIndex ? `Retrying from step ${fromIndex + 1}…` : "Running steps…"
    }</div></div></div>`;
    (flow.steps || []).forEach((_, i) => {
      if (i < fromIndex) markStep(i, "done");
      else markStep(i, "running");
    });

    try {
      const res = await invoke("flow.run", { flow, fromIndex, priorResults });
      const results = res?.results || [];
      lastRunResults = results;
      paintRunResults(results);

      const toast =
        [...results].reverse().find((r) => r.display?.links?.length)?.display?.summary ||
        results.find((r) => r.notify)?.notify;
      if (toast && window.top?.showMySpaceToast) {
        window.top.showMySpaceToast(String(toast).slice(0, 180));
      }

      if (!res?.ok) {
        pendingFlow = flow;
        unlockApproveForRetry(res?.error || "Flow failed — see log above.");
        ui.composeHint.textContent = res?.error || "Flow failed.";
        return;
      }

      setStudioPhase("done");
      setStatus("Done", "done");
      lastRanFlow = flow;
      pendingFlow = null;
      ui.composeHint.textContent = "Finished — save as Script, plan another task, or open History.";
      if (ui.postRunNote) {
        ui.postRunNote.textContent = "Crystallize this run into Scripts for daily macros.";
      }
      await refreshHistory();
      await refreshLibrary();
    } catch (err) {
      const msg = err?.message || String(err);
      ui.flowLog.classList.remove("hidden");
      ui.flowLog.innerHTML += `<div class="log-row is-error"><span class="log-icon">✕</span><div class="log-body"><div class="log-summary">${escapeHtml(
        msg
      )}</div></div></div>`;
      pendingFlow = flow;
      unlockApproveForRetry(msg);
      ui.composeHint.textContent = msg;
    } finally {
      setBusy(false);
    }
  }

  async function saveKey() {
    const apiKey = String(ui.apiKeyInput.value || "").trim();
    if (!apiKey) {
      ui.connectionNote.textContent = "Paste a key first.";
      return;
    }
    setBusy(true);
    try {
      const res = await invoke("flow.setApiKey", { apiKey });
      if (!res?.ok) throw new Error(res?.error || "Could not save key");
      ui.apiKeyInput.value = "";
      ui.connectionNote.textContent = "Saved.";
      await refreshMeta();
    } catch (err) {
      ui.connectionNote.textContent = err?.message || String(err);
    } finally {
      setBusy(false);
    }
  }

  async function clearKey() {
    setBusy(true);
    try {
      const res = await invoke("flow.clearApiKey", {});
      if (!res?.ok) throw new Error(res?.error || "Could not clear key");
      ui.apiKeyInput.value = "";
      ui.connectionNote.textContent = "Cleared.";
      await refreshMeta();
    } catch (err) {
      ui.connectionNote.textContent = err?.message || String(err);
    } finally {
      setBusy(false);
    }
  }

  function applyRoute(route) {
    if (!route) return;
    const page = typeof route === "string" ? route : route.page;
    if (route.task) ui.taskInput.value = String(route.task);
    if (route.flow?.steps?.length) {
      renderFlow(route.flow, { editable: true });
      ui.composeHint.textContent = "Plan loaded — review, then approve.";
    } else if (route.blank) {
      startBlank();
    }
    if (page === "history" || page === "tools" || page === "connection" || page === "library") {
      showPanel(page);
    }
  }

  function bind() {
    ui.btnPlan.addEventListener("click", () => planFlow());
    ui.btnReject.addEventListener("click", rejectFlow);
    ui.btnApprove.addEventListener("click", approveFlow);
    ui.btnSaveScript?.addEventListener("click", () => saveAsScript());
    ui.btnSaveScriptDone?.addEventListener("click", () => saveAsScript(lastRanFlow));
    ui.btnSaveLibrary?.addEventListener("click", () => saveToLibrary());
    ui.btnSaveLibraryDone?.addEventListener("click", () => saveToLibrary());
    ui.btnExportSpace?.addEventListener("click", () => exportSpaceFile());
    ui.btnExportSpaceDone?.addEventListener("click", () => exportSpaceFile(lastRanFlow));
    ui.btnRetryFailed?.addEventListener("click", () => {
      if (lastFailedIndex < 0) return;
      approveFlow({ fromIndex: lastFailedIndex });
    });
    ui.btnBlank?.addEventListener("click", () => startBlank());
    ui.btnSaveKey.addEventListener("click", saveKey);
    ui.btnClearKey.addEventListener("click", clearKey);
    ui.aiStatus.addEventListener("click", () => showPanel("connection"));

    ui.taskInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        planFlow();
      }
    });

    ui.exampleChips.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-example]");
      if (!chip) return;
      ui.taskInput.value = chip.dataset.example || "";
      ui.taskInput.focus();
      setStudioPhase("task");
    });

    document.querySelectorAll(".dock-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const panel = btn.dataset.panel;
        if (dockOpen && activePanel === panel) {
          setDockOpen(false);
          return;
        }
        showPanel(panel);
      });
    });

    ui.flowTrack.addEventListener("click", (e) => {
      const drop = e.target.closest("[data-drop]");
      if (drop) {
        e.preventDefault();
        removeStep(Number(drop.dataset.drop));
        return;
      }
      const move = e.target.closest("[data-move]");
      if (move) {
        e.preventDefault();
        moveStep(Number(move.dataset.move), Number(move.dataset.dir));
        return;
      }
      const dup = e.target.closest("[data-dup]");
      if (dup) {
        e.preventDefault();
        duplicateStep(Number(dup.dataset.dup));
      }
    });

    ui.flowTrack.addEventListener("change", (e) => {
      const sel = e.target.closest("[data-step-tool]");
      if (!sel) return;
      changeStepTool(Number(sel.dataset.stepTool), sel.value);
    });

    ui.addStepTools?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-add-tool]");
      if (!btn) return;
      addStep(btn.dataset.addTool);
    });

    ui.historySearch?.addEventListener("input", () => {
      historyQuery = ui.historySearch.value || "";
      renderHistoryList();
    });

    ui.historyList.addEventListener("click", (e) => {
      const open = e.target.closest("[data-hist-open]");
      if (open) {
        openHistoryItem(open.dataset.histOpen);
        return;
      }
      const reuse = e.target.closest("[data-hist-reuse]");
      if (reuse) {
        reuseHistoryTask(reuse.dataset.histReuse);
        return;
      }
      const pin = e.target.closest("[data-hist-pin]");
      if (pin) {
        invoke("flow.history.pin", { id: pin.dataset.histPin }).then(() => refreshHistory());
        return;
      }
      const del = e.target.closest("[data-hist-del]");
      if (del) {
        invoke("flow.history.delete", { id: del.dataset.histDel }).then(() => refreshHistory());
      }
    });

    ui.libraryList?.addEventListener("click", (e) => {
      const open = e.target.closest("[data-lib-open]");
      if (open) {
        openLibraryItem(open.dataset.libOpen);
        return;
      }
      const pin = e.target.closest("[data-lib-pin]");
      if (pin) {
        invoke("flow.library.pin", { id: pin.dataset.libPin }).then(() => refreshLibrary());
        return;
      }
      const del = e.target.closest("[data-lib-del]");
      if (del) {
        invoke("flow.library.delete", { id: del.dataset.libDel }).then(() => refreshLibrary());
      }
    });
  }

  window.ModelFlowApp = {
    setPage(route) {
      applyRoute(typeof route === "string" ? { page: route } : route || {});
    },
    plan: planFlow,
    clear: clearFlow,
    showPanel,
    acceptPlan(flow, task) {
      if (task) ui.taskInput.value = task;
      if (flow?.steps?.length) renderFlow(flow, { editable: true });
    },
  };

  function renderTemplates() {
    if (!ui.templateGrid) return;
    ui.templateGrid.innerHTML = TEMPLATES.map(
      (t) => `<button type="button" class="template-card" data-template="${escapeHtml(t.id)}">
        <strong>${escapeHtml(t.title)}</strong>
        <span>${escapeHtml(t.blurb)}</span>
      </button>`
    ).join("");
    ui.templateGrid.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-template]");
      if (!btn) return;
      const tpl = TEMPLATES.find((x) => x.id === btn.dataset.template);
      applyTemplate(tpl);
    });
  }

  bind();
  renderTemplates();
  setStudioPhase("task");
  setDockOpen(false);
  refreshMeta()
    .then(() => Promise.all([refreshTools(), refreshHistory(), refreshLibrary()]))
    .catch(() => {});
})();
