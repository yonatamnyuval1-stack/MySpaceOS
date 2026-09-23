(function () {
  let root = null;
  let open = false;
  let snap = null;
  let tab = "ask";
  let task = "chat";
  let askText = "";
  let askReply = "";
  let busy = false;
  let unsub = null;
  let geminiKeyInput = "";

  function tt(key, fallback, vars) {
    const I = window.MySpaceI18n;
    const fb = fallback || key;
    const withVars = (s) => {
      if (!vars) return s;
      return String(s).replace(/\{(\w+)\}/g, (_, k) =>
        vars[k] != null ? String(vars[k]) : `{${k}}`
      );
    };
    if (!I?.t) return withVars(fb);
    const v = I.t(key, vars);
    return v === key ? withVars(fb) : v;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function refresh() {
    const res = await window.mySpace?.mind?.status?.();
    if (res?.ok !== false) {
      snap = res;
      if (!["quick", "chat", "think"].includes(task)) {
        task = res.defaultTask || "chat";
      }
    }
    paint();
  }

  function taskList() {
    return snap?.tasks || [];
  }

  function currentTask() {
    return taskList().find((t) => t.id === task) || taskList()[1] || null;
  }

  function paintAsk() {
    const list = root.querySelector("#mind-panel-list");
    const tasks = taskList();
    const cur = currentTask();
    const ready = snap?.hasKey || snap?.ready;
    const replyDefault = askReply || tt("service.mind.replyHere", "Reply shows up here.");
    list.innerHTML = `
      <div class="mind-panel-form">
        ${
          ready
            ? ""
            : `<p class="mind-banner">${escapeHtml(tt("service.mind.addKeyBannerBefore", "Add a Gemini API key in"))} <button type="button" data-mind-goto="setup">${escapeHtml(tt("service.mind.setup", "Setup"))}</button> ${escapeHtml(tt("service.mind.addKeyBannerAfter", "first."))}</p>`
        }
        <div class="mind-task-row" role="group" aria-label="${escapeHtml(tt("service.mind.task", "Task"))}">
          ${tasks
            .map(
              (t) => `
            <button type="button" class="mind-task-chip${t.id === task ? " is-active" : ""}" data-mind-task="${escapeHtml(
              t.id
            )}">
              <strong>${escapeHtml(t.label)}</strong>
              <span>${escapeHtml(t.blurb)}</span>
              <em>${escapeHtml(t.model)}</em>
            </button>`
            )
            .join("")}
        </div>
        <label class="mind-field">
          <span>${escapeHtml(tt("service.mind.askMind", "Ask Mind"))}${cur ? ` · ${escapeHtml(cur.label)}` : ""}</span>
          <textarea id="mind-ask-input" rows="5" spellcheck="true" placeholder="${escapeHtml(tt("service.mind.placeholder", "What do you need?"))}">${escapeHtml(
            askText
          )}</textarea>
        </label>
        <div class="mind-row-actions">
          <button type="button" id="mind-ask-send" ${busy || !ready ? "disabled" : ""}>${
            busy ? escapeHtml(tt("service.mind.thinking", "Thinking…")) : escapeHtml(tt("service.common.send", "Send"))
          }</button>
          <button type="button" id="mind-ask-test" class="mind-btn-ghost" ${!ready ? "disabled" : ""}>${escapeHtml(tt("service.common.test", "Test"))}</button>
        </div>
        <pre class="mind-reply">${escapeHtml(replyDefault)}</pre>
      </div>`;

    list.querySelectorAll("[data-mind-task]").forEach((btn) => {
      btn.addEventListener("click", () => {
        task = btn.dataset.mindTask;
        paint();
      });
    });
    list.querySelector("[data-mind-goto]")?.addEventListener("click", () => {
      tab = "setup";
      paint();
    });
    list.querySelector("#mind-ask-input")?.addEventListener("input", (e) => {
      askText = e.target.value || "";
    });
    list.querySelector("#mind-ask-send")?.addEventListener("click", () => void sendAsk());
    list.querySelector("#mind-ask-test")?.addEventListener("click", async () => {
      const res = await window.mySpace?.mind?.test?.({ task });
      window.showMySpaceToast?.(
        res?.ok === false ? res.error || tt("service.mind.testFailed", "Test failed") : res.message || "OK"
      );
    });
  }

  async function sendAsk() {
    const prompt = askText.trim();
    if (!prompt || busy) return;
    busy = true;
    askReply = tt("service.mind.thinking", "Thinking…");
    paint();
    const res = await window.mySpace?.mind?.ask?.({ prompt, task });
    askReply =
      res?.ok === false
        ? res.error || tt("service.mind.failed", "Failed")
        : `${res.text || ""}\n\n— ${res.taskLabel || res.task || "Mind"} · ${res.model || ""}${
            res.tokens ? ` · ${res.tokens} tok` : ""
          }`;
    busy = false;
    paint();
  }

  function paintSetup() {
    const list = root.querySelector("#mind-panel-list");
    const gemini = (snap?.providers || []).find((p) => p.id === "gemini");
    const ollama = (snap?.providers || []).find((p) => p.id === "ollama");
    const tasks = taskList();
    const keyStatus = gemini?.hasKey
      ? tt("service.mind.keySavedPreview", "(saved {preview})", { preview: gemini.keyPreview })
      : tt("service.mind.keyNotSet", "(not set)");
    list.innerHTML = `
      <div class="mind-panel-form">
        <label class="mind-field">
          <span>${escapeHtml(tt("service.mind.geminiKey", "Gemini API key"))} ${escapeHtml(keyStatus)}</span>
          <input id="mind-gemini-key" type="password" placeholder="${escapeHtml(tt("service.mind.pasteKey", "Paste key…"))}" spellcheck="false" value="${escapeHtml(
            geminiKeyInput
          )}" />
        </label>
        <div class="mind-row-actions">
          <button type="button" id="mind-save-key">${escapeHtml(tt("service.mind.saveKey", "Save key"))}</button>
          <button type="button" id="mind-clear-key" class="mind-btn-ghost">${escapeHtml(tt("service.common.clear", "Clear"))}</button>
        </div>

        <h3 class="mind-subhead">${escapeHtml(tt("service.mind.modelsByTask", "Models by task"))}</h3>
        ${tasks
          .map(
            (t) => `
          <label class="mind-field">
            <span>${escapeHtml(t.label)} <em class="mind-tier">${escapeHtml(t.tier)}</em></span>
            <select data-task-model="${escapeHtml(t.id)}">
              ${(t.modelOptions || [])
                .map(
                  (m) =>
                    `<option value="${escapeHtml(m.id)}"${m.id === t.model ? " selected" : ""}>${escapeHtml(
                      m.label
                    )} · ${escapeHtml(m.id)}</option>`
                )
                .join("")}
            </select>
          </label>`
          )
          .join("")}
        <div class="mind-row-actions">
          <button type="button" id="mind-save-tasks">${escapeHtml(tt("service.mind.saveModels", "Save models"))}</button>
        </div>

        <h3 class="mind-subhead">${escapeHtml(tt("service.mind.optional", "Optional"))}</h3>
        <label class="mind-check">
          <input type="checkbox" id="mind-ollama-on" ${ollama?.enabled ? "checked" : ""} />
          <span>${escapeHtml(tt("service.mind.useOllama", "Use local Ollama when you ask with task local"))}</span>
        </label>
        <label class="mind-field">
          <span>${escapeHtml(tt("service.mind.ollamaModel", "Ollama model"))}</span>
          <input id="mind-ollama-model" type="text" value="${escapeHtml(ollama?.model || "llama3.2")}" />
        </label>
        <label class="mind-field">
          <span>${escapeHtml(tt("service.mind.dailyBudget", "Daily token budget (0 = no limit)"))}</span>
          <input id="mind-budget" type="number" min="0" value="${escapeHtml(snap?.budget?.dailyTokens ?? 0)}" />
        </label>
        <div class="mind-row-actions">
          <button type="button" id="mind-save-optional">${escapeHtml(tt("service.mind.saveOptional", "Save optional"))}</button>
        </div>
      </div>`;

    list.querySelector("#mind-gemini-key")?.addEventListener("input", (e) => {
      geminiKeyInput = e.target.value || "";
    });
    list.querySelector("#mind-save-key")?.addEventListener("click", async () => {
      if (!geminiKeyInput.trim()) {
        window.showMySpaceToast?.(tt("service.mind.pasteKeyFirst", "Paste a key first"));
        return;
      }
      await window.mySpace?.mind?.setKey?.({ provider: "gemini", apiKey: geminiKeyInput.trim() });
      geminiKeyInput = "";
      window.showMySpaceToast?.(tt("service.mind.keySavedToast", "Key saved"));
      await refresh();
    });
    list.querySelector("#mind-clear-key")?.addEventListener("click", async () => {
      await window.mySpace?.mind?.clearKey?.({ provider: "gemini" });
      window.showMySpaceToast?.(tt("service.mind.keyCleared", "Key cleared"));
      await refresh();
    });
    list.querySelector("#mind-save-tasks")?.addEventListener("click", async () => {
      const patch = {};
      list.querySelectorAll("[data-task-model]").forEach((sel) => {
        patch[sel.dataset.taskModel] = { model: sel.value, provider: "gemini" };
      });
      await window.mySpace?.mind?.setSettings?.({ tasks: patch, defaultTask: "chat" });
      window.showMySpaceToast?.(tt("service.mind.taskModelsSaved", "Task models saved"));
      await refresh();
    });
    list.querySelector("#mind-save-optional")?.addEventListener("click", async () => {
      await window.mySpace?.mind?.setSettings?.({
        providers: {
          ollama: {
            enabled: !!list.querySelector("#mind-ollama-on")?.checked,
            model: list.querySelector("#mind-ollama-model")?.value || "llama3.2",
          },
        },
        budget: { dailyTokens: Number(list.querySelector("#mind-budget")?.value) || 0 },
      });
      window.showMySpaceToast?.(tt("service.common.saved", "Saved"));
      await refresh();
    });
  }

  function repaintChrome() {
    if (!root) return;
    root.setAttribute("aria-label", tt("platform.mind.name", "Mind"));
    const brand = root.querySelector(".mind-panel-brand div");
    if (brand) {
      const h2 = brand.querySelector("h2");
      const p = brand.querySelector("p");
      if (h2) h2.textContent = tt("platform.mind.name", "Mind");
      if (p) p.textContent = tt("platform.mind.panelTagline", "Mind Chat: pick a task, get an answer");
    }
    root.querySelector(".mind-panel-close")?.setAttribute("aria-label", tt("service.common.close", "Close"));
    const askBtn = root.querySelector('[data-mind-tab="ask"]');
    const setupBtn = root.querySelector('[data-mind-tab="setup"]');
    if (askBtn) askBtn.textContent = tt("service.mind.ask", "Ask");
    if (setupBtn) setupBtn.textContent = tt("service.mind.setup", "Setup");
    const foot = root.querySelector(".mind-panel-foot span");
    if (foot) foot.textContent = tt("service.mind.shellHint", "mind(ask …), mind(quick …), mind(think …)");
  }

  function paint() {
    if (!root) return;
    root.querySelectorAll("[data-mind-tab]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.mindTab === tab);
    });
    const meta = root.querySelector("#mind-panel-meta");
    if (meta) {
      const cur = currentTask();
      meta.textContent = snap?.hasKey
        ? cur
          ? `${cur.label} · ${cur.model}`
          : tt("service.mind.ready", "Ready")
        : tt("service.mind.needsKey", "Needs API key");
    }
    if (tab === "setup") paintSetup();
    else paintAsk();
  }

  function ensure() {
    if (root) return root;
    root = document.createElement("div");
    root.className = "mind-panel hidden";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", tt("platform.mind.name", "Mind"));
    root.innerHTML = `
      <div class="mind-panel-shell">
        <header class="mind-panel-head">
          <div class="mind-panel-brand">
            <img src="brand/atom-rose.png" alt="" width="28" height="28" />
            <div>
              <h2>${escapeHtml(tt("platform.mind.name", "Mind"))}</h2>
              <p>${escapeHtml(tt("platform.mind.panelTagline", "Mind Chat: pick a task, get an answer"))}</p>
            </div>
          </div>
          <button type="button" class="mind-panel-close" aria-label="${escapeHtml(tt("service.common.close", "Close"))}">×</button>
        </header>
        <div class="mind-panel-toolbar">
          <div class="mind-panel-tabs">
            <button type="button" data-mind-tab="ask" class="is-active">${escapeHtml(tt("service.mind.ask", "Ask"))}</button>
            <button type="button" data-mind-tab="setup">${escapeHtml(tt("service.mind.setup", "Setup"))}</button>
          </div>
          <span id="mind-panel-meta" class="mind-panel-meta"></span>
        </div>
        <div class="mind-panel-list" id="mind-panel-list"></div>
        <footer class="mind-panel-foot">
          <span>${escapeHtml(tt("service.mind.shellHint", "mind(ask …), mind(quick …), mind(think …)"))}</span>
        </footer>
      </div>`;
    root.querySelector(".mind-panel-close").addEventListener("click", hide);
    root.addEventListener("click", (e) => {
      if (e.target === root) hide();
    });
    root.querySelectorAll("[data-mind-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        tab = btn.dataset.mindTab;
        paint();
      });
    });
    document.body.appendChild(root);
    return root;
  }

  async function show(initial) {
    ensure();
    open = true;
    if (initial === "setup" || initial === "providers") tab = "setup";
    else if (initial === "ask" || !initial || initial === "panel" || initial === "status") tab = "ask";
    else if (["quick", "chat", "think"].includes(initial)) {
      tab = "ask";
      task = initial;
    } else tab = "ask";
    root.classList.remove("hidden");
    if (!unsub && window.mySpace?.mind?.onUpdated) {
      unsub = window.mySpace.mind.onUpdated((data) => {
        if (!open) return;
        snap = data;
        paint();
      });
    }
    await refresh();
  }

  function hide() {
    open = false;
    root?.classList.add("hidden");
  }

  function toggle() {
    if (open) hide();
    else void show();
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) hide();
  });

  window.addEventListener("myspace-i18n-applied", () => {
    if (!open || !root) return;
    repaintChrome();
    paint();
  });

  window.MySpaceMindPanel = { show, hide, toggle, isOpen: () => open, refresh };
})();