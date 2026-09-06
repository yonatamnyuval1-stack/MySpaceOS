(function () {
  const api = window.myApp;
  const $ = (id) => document.getElementById(id);

  const els = {
    shell: $("shell"),
    side: $("side"),
    scrim: $("scrim"),
    list: $("list"),
    search: $("search"),
    btnNew: $("btn-new"),
    btnSettings: $("btn-settings"),
    btnModes: $("btn-modes"),
    modeChipLabel: $("mode-chip-label"),
    modePill: $("mode-pill"),
    modesModal: $("modes-modal"),
    modesGrid: $("modes-grid"),
    btnSideOpen: $("btn-side-open"),
    btnSideClose: $("btn-side-close"),
    title: $("title"),
    task: $("task"),
    btnMenu: $("btn-menu"),
    menu: $("menu"),
    thread: $("thread"),
    empty: $("empty"),
    composer: $("composer"),
    input: $("input"),
    btnSend: $("btn-send"),
    btnStop: $("btn-stop"),
    fine: $("fine"),
    settingsModal: $("settings-modal"),
    mindStatus: $("mind-status"),
    setTask: $("set-task"),
    setModel: $("set-model"),
    setContext: $("set-context"),
    setTemp: $("set-temp"),
    setSystem: $("set-system"),
    setMemoryEnabled: $("set-memory-enabled"),
    memoryList: $("memory-list"),
    memoryNewText: $("memory-new-text"),
    memoryNewTags: $("memory-new-tags"),
    memoryAddBtn: $("memory-add-btn"),
    settingsSave: $("settings-save"),
    renameModal: $("rename-modal"),
    renameForm: $("rename-form"),
    renameInput: $("rename-input"),
    confirmModal: $("confirm-modal"),
    confirmTitle: $("confirm-title"),
    confirmCopy: $("confirm-copy"),
    confirmOk: $("confirm-ok"),
    toast: $("toast"),
  };

  const TASK_LABELS = { quick: "Quick", chat: "Everyday", think: "Deep" };
  const MODE_FALLBACK = [
    { id: "companion", name: "Companion", tagline: "Warm everyday Mind" },
    { id: "cynical", name: "Cynical", tagline: "Nothing is sacred" },
    { id: "spacehand", name: "Spacehand", tagline: "My Space OS guide" },
    { id: "probe", name: "Probe", tagline: "Questions until the answer is earned" },
    { id: "counsel", name: "Counsel", tagline: "Sober call when it matters" },
  ];
  const SIDEBAR_KEY = "myspace-chat-side";
  const DRAFTS_KEY = "myspace-chat-drafts";
  let draftSaveTimer = null;

  const state = {
    list: [],
    activeId: null,
    conversation: null,
    settings: null,
    modes: MODE_FALLBACK.slice(),
    mindTasks: [],
    search: "",
    sending: false,
    sendToken: 0,
    messageTask: "chat",
    toastTimer: null,
    confirmAction: null,
  };

  function currentModeId() {
    return state.conversation?.mode || state.settings?.chatMode || "companion";
  }

  function draftKey(id) {
    return id || "__new__";
  }

  function readDrafts() {
    try {
      const raw = sessionStorage.getItem(DRAFTS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeDrafts(map) {
    try {
      sessionStorage.setItem(DRAFTS_KEY, JSON.stringify(map));
    } catch {
    }
  }

  function saveCurrentDraft() {
    const key = draftKey(state.activeId);
    const text = els.input?.value ?? "";
    const drafts = readDrafts();
    if (text.trim()) drafts[key] = text;
    else delete drafts[key];
    writeDrafts(drafts);
  }

  function scheduleDraftSave() {
    clearTimeout(draftSaveTimer);
    draftSaveTimer = setTimeout(saveCurrentDraft, 250);
  }

  function restoreDraftFor(id) {
    const drafts = readDrafts();
    const text = drafts[draftKey(id)] || "";
    if (els.input) {
      els.input.value = text;
      autosize();
    }
  }

  function clearDraftFor(id) {
    const drafts = readDrafts();
    delete drafts[draftKey(id)];
    writeDrafts(drafts);
  }

  function modeMeta(id) {
    const key = String(id || "companion").toLowerCase();
    return (state.modes || []).find((m) => m.id === key) || MODE_FALLBACK.find((m) => m.id === key) || MODE_FALLBACK[0];
  }

  function paintModeChrome() {
    const mode = modeMeta(currentModeId());
    if (els.modeChipLabel) els.modeChipLabel.textContent = mode.name;
    els.btnModes?.classList.toggle("is-cynical", mode.id === "cynical");
    els.btnModes?.classList.toggle("is-spacehand", mode.id === "spacehand");
    els.btnModes?.classList.toggle("is-probe", mode.id === "probe");
    els.btnModes?.classList.toggle("is-counsel", mode.id === "counsel");
    if (els.modePill) {
      els.modePill.textContent = mode.name;
      els.modePill.classList.toggle("hidden", false);
      els.modePill.classList.toggle("is-cynical", mode.id === "cynical");
      els.modePill.classList.toggle("is-spacehand", mode.id === "spacehand");
      els.modePill.classList.toggle("is-probe", mode.id === "probe");
      els.modePill.classList.toggle("is-counsel", mode.id === "counsel");
    }
  }

  async function ensureModes() {
    if (state.modes?.length > 1 && state.settings) return;
    try {
      const res = await invoke("chat.modes.list");
      if (res?.ok !== false && res.modes?.length) state.modes = res.modes;
      if (res?.active && !state.settings) state.settings = { chatMode: res.active };
    } catch {
    }
  }

  function openModesCatalog() {
    const active = currentModeId();
    els.modesGrid.innerHTML = (state.modes || MODE_FALLBACK)
      .map((m) => {
        const on = m.id === active ? " is-active" : "";
        return `<button type="button" class="mode-card${on}" data-mode="${escapeHtml(m.id)}">
          <strong>${escapeHtml(m.name)}</strong>
          <span>${escapeHtml(m.tagline || "")}</span>
        </button>`;
      })
      .join("");
    els.modesGrid.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => void selectMode(btn.dataset.mode));
    });
    els.modesModal.classList.remove("hidden");
  }

  async function selectMode(modeId) {
    els.modesModal.classList.add("hidden");
    const id = String(modeId || "").trim();
    if (!id) return;
    const payload = state.activeId ? { id: state.activeId, mode: id } : { mode: id };
    const res = await invoke("chat.mode.set", payload);
    if (res?.ok === false) return toast(res.error || "Could not switch mode");
    if (res.conversation) state.conversation = res.conversation;
    if (res.settings) state.settings = res.settings;
    else if (!state.settings) state.settings = { chatMode: id };
    else state.settings.chatMode = id;
    paintModeChrome();
    paintThread();
    toast(`Mode · ${modeMeta(id).name}`);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatWhyLines(why) {
    return String(why || "")
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*[-•*]\s*/, "").trim())
      .filter(Boolean)
      .map((l) => `<li>${escapeHtml(l)}</li>`)
      .join("");
  }

  function renderCounselBubble(m) {
    const frame = m.counselFrame || "steady";
    if (frame === "decide" && m.counselCall) {
      const why = formatWhyLines(m.counselWhy);
      return `<div class="counsel-card">
        <p class="counsel-kicker">The call</p>
        <p class="counsel-call">${escapeHtml(m.counselCall)}</p>
        ${why ? `<ul class="counsel-why">${why}</ul>` : ""}
        ${
          m.counselWatch
            ? `<p class="counsel-watch"><span>Watch</span>${escapeHtml(m.counselWatch)}</p>`
            : ""
        }
        ${
          m.counselReviseIf
            ? `<p class="counsel-revise"><span>Revise if</span>${escapeHtml(m.counselReviseIf)}</p>`
            : ""
        }
      </div>`;
    }
    return `<p class="bubble${frame === "hold" ? " is-hold" : ""}">${escapeHtml(m.content)}</p>`;
  }

  function frameBadge(m) {
    if (m.role !== "assistant") return "";
    if (m.probePhase === "ask" || m.probePhase === "verdict") {
      return `<span class="probe-phase is-${m.probePhase}">${
        m.probePhase === "ask" ? "Asking" : "Verdict"
      }</span>`;
    }
    if (m.counselFrame === "decide") return `<span class="counsel-phase is-decide">Call</span>`;
    if (m.counselFrame === "hold") return `<span class="counsel-phase is-hold">Holding</span>`;
    if (m.counselFrame === "steady") return `<span class="counsel-phase is-steady">Steady</span>`;
    return "";
  }

  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.remove("hidden");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => els.toast.classList.add("hidden"), 2200);
  }

  function isMobile() {
    return window.innerWidth <= 760;
  }

  function sideOpen() {
    if (isMobile()) return els.shell.classList.contains("side-open");
    return !els.shell.classList.contains("side-closed");
  }

  function setSide(open) {
    if (isMobile()) {
      els.shell.classList.toggle("side-open", open);
      els.shell.classList.remove("side-closed");
      els.scrim.hidden = !open;
    } else {
      els.shell.classList.toggle("side-closed", !open);
      els.shell.classList.remove("side-open");
      els.scrim.hidden = true;
    }
    try {
      sessionStorage.setItem(SIDEBAR_KEY, open ? "1" : "0");
    } catch {
    }
  }

  function restoreSide() {
    let open = true;
    try {
      const v = sessionStorage.getItem(SIDEBAR_KEY);
      if (v === "0") open = false;
    } catch {
      /* ignore */
    }
    if (isMobile()) open = false;
    setSide(open);
  }

  function fmtWhen(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      if (d.toDateString() === new Date().toDateString()) {
        return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
      }
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  }

  function isToday(iso) {
    try {
      return new Date(iso).toDateString() === new Date().toDateString();
    } catch {
      return false;
    }
  }

  async function invoke(channel, args) {
    return api.invoke(channel, args || {});
  }

  function setBusy(busy) {
    state.sending = busy;
    els.btnSend.disabled = busy;
    els.input.disabled = busy;
    els.btnSend.textContent = busy ? "…" : "Send";
    els.btnStop.classList.toggle("hidden", !busy);
    els.fine.textContent = busy ? "Waiting…" : "Enter to send · Shift+Enter for a new line";
  }

  function updateMenuEnabled() {
    els.btnMenu.disabled = !state.activeId;
    const pinBtn = els.menu.querySelector('[data-act="pin"]');
    if (pinBtn) pinBtn.textContent = state.conversation?.pinned ? "Unpin" : "Pin";
  }

  function filtered() {
    const q = state.search.trim().toLowerCase();
    if (!q) return state.list;
    return state.list.filter(
      (c) =>
        String(c.title || "").toLowerCase().includes(q) ||
        String(c.preview || "").toLowerCase().includes(q)
    );
  }

  function paintList() {
    const rows = filtered();
    if (!rows.length) {
      els.list.innerHTML = `<p class="empty-list">${
        state.search.trim() ? "No matches." : "No chats yet."
      }</p>`;
      return;
    }

    const pinned = rows.filter((c) => c.pinned);
    const today = rows.filter((c) => !c.pinned && isToday(c.updatedAt));
    const earlier = rows.filter((c) => !c.pinned && !isToday(c.updatedAt));

    const item = (c) => `
      <button type="button" class="item${c.id === state.activeId ? " on" : ""}" data-id="${escapeHtml(c.id)}">
        <span class="t">${escapeHtml(c.title || "New chat")}${
      c.source === "mind-chat" ? ' <span class="src-mind">Mind Chat</span>' : ""
    }${c.pinned ? " ·" : ""}</span>
        <span class="m">${escapeHtml(fmtWhen(c.updatedAt))}</span>
      </button>`;

    const parts = [];
    if (pinned.length) parts.push(`<div class="group">Pinned</div>${pinned.map(item).join("")}`);
    if (today.length) parts.push(`<div class="group">Today</div>${today.map(item).join("")}`);
    if (earlier.length) {
      parts.push(
        `<div class="group">${pinned.length || today.length ? "Earlier" : "Chats"}</div>${earlier
          .map(item)
          .join("")}`
      );
    }
    els.list.innerHTML = parts.join("");
    els.list.querySelectorAll(".item").forEach((btn) => {
      btn.addEventListener("click", () => void openChat(btn.dataset.id));
    });
    requestAnimationFrame(() => {
      els.list.querySelector(".item.on")?.scrollIntoView({ block: "nearest" });
    });
  }

  function paintThread() {
    const conv = state.conversation;
    const has = Boolean(conv?.messages?.length);
    els.empty.classList.toggle("hidden", has);
    els.thread.classList.toggle("hidden", !has);
    els.title.textContent = conv?.title || "New chat";
    paintModeChrome();
    updateMenuEnabled();

    if (!has) {
      els.thread.innerHTML = "";
      return;
    }

    const msgs = conv.messages;
    const lastBot = [...msgs].map((m, i) => ({ m, i })).reverse().find((x) => x.m.role === "assistant")?.i;
    const botName = modeMeta(currentModeId()).name;

    els.thread.innerHTML = msgs
      .map((m, idx) => {
        const err = m.role === "assistant" && /^Error:/i.test(m.content || "");
        const metaBits = [];
        if (m.role === "assistant" && (m.model || m.task)) {
          metaBits.push([TASK_LABELS[m.task] || m.task, m.model].filter(Boolean).join(" · "));
        }
        const meta = metaBits.length ? `<p class="meta">${escapeHtml(metaBits.join(" · "))}</p>` : "";
        const tools =
          m.role === "assistant" && Array.isArray(m.toolsUsed) && m.toolsUsed.length
            ? `<div class="tool-chips">${m.toolsUsed
                .map((t) => {
                  const cls = t.declined ? "is-skip" : t.result?.ok === false ? "is-fail" : "is-ok";
                  return `<span class="tool-chip ${cls}">${escapeHtml(t.label || t.name || "action")}</span>`;
                })
                .join("")}</div>`
            : "";
        const phase = frameBadge(m);
        const body =
          m.role === "assistant" && currentModeId() === "counsel"
            ? renderCounselBubble(m)
            : m.role === "assistant" && m.counselFrame === "decide" && m.counselCall
              ? renderCounselBubble(m)
              : `<p class="bubble">${escapeHtml(m.content)}</p>`;
        const regen = m.role === "assistant" && idx === lastBot && !state.sending;
        return `
          <article class="msg ${m.role === "user" ? "user" : "bot"}${err ? " err" : ""}${
            m.counselFrame === "decide" ? " is-counsel-decide" : ""
          }">
            <p class="who">${m.role === "user" ? "You" : escapeHtml(botName)}${phase}</p>
            ${body}
            ${tools}
            ${meta}
            <div class="acts">
              <button type="button" data-copy="${idx}">Copy</button>
              ${regen ? `<button type="button" data-regen="1">Regenerate</button>` : ""}
            </div>
          </article>`;
      })
      .join("");

    if (state.sending) {
      els.thread.insertAdjacentHTML(
        "beforeend",
        `<article class="msg bot"><p class="who">${escapeHtml(botName)}</p><p class="bubble"><span class="typing"><i></i><i></i><i></i></span></p></article>`
      );
    }

    els.thread.querySelectorAll("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(msgs[Number(btn.dataset.copy)]?.content || "");
          toast("Copied");
        } catch {
          toast("Copy failed");
        }
      });
    });
    els.thread.querySelector("[data-regen]")?.addEventListener("click", () => void regenerate());
    els.thread.scrollTop = els.thread.scrollHeight;
  }

  async function refreshList() {
    const res = await invoke("chat.list");
    if (res?.ok === false) return toast(res.error || "Load failed");
    state.list = res.conversations || [];
    paintList();
  }

  async function openChat(id) {
    saveCurrentDraft();
    const res = await invoke("chat.get", { id });
    if (res?.ok === false) return toast(res.error || "Not found");
    state.activeId = id;
    state.conversation = res.conversation;
    paintList();
    paintThread();
    paintModeChrome();
    restoreDraftFor(id);
    els.input.focus();
    if (isMobile()) setSide(false);
  }

  async function newChat() {
    saveCurrentDraft();
    const res = await invoke("chat.create", { mode: currentModeId() });
    if (res?.ok === false) return toast(res.error || "Could not create");
    await refreshList();
    state.activeId = res.conversation.id;
    state.conversation = res.conversation;
    paintList();
    paintThread();
    paintModeChrome();
    restoreDraftFor(state.activeId);
    els.input.focus();
    if (isMobile()) setSide(false);
  }

  async function send() {
    const text = els.input.value.trim();
    if (!text || state.sending) return;
    const token = ++state.sendToken;
    const convId = state.activeId;
    setBusy(true);
    els.input.value = "";
    autosize();
    if (convId) clearDraftFor(convId);
    else clearDraftFor(null);

    if (!state.activeId) {
      const created = await invoke("chat.create");
      if (created?.ok === false) {
        setBusy(false);
        els.input.value = text;
        autosize();
        return toast(created.error || "Could not create");
      }
      state.activeId = created.conversation.id;
      state.conversation = created.conversation;
    }

    if (!state.conversation.messages) state.conversation.messages = [];
    state.conversation.messages.push({ role: "user", content: text, createdAt: new Date().toISOString() });
    paintThread();

    const res = await invoke("chat.send", {
      conversationId: state.activeId,
      text,
      mindTask: state.messageTask,
      mode: currentModeId(),
    });

    if (token !== state.sendToken) return;
    setBusy(false);
    if (res?.conversation) {
      state.conversation = res.conversation;
      state.activeId = res.conversation.id;
    }
    if (res?.ok === false) toast(res.error || "Send failed");
    else if (res?.mind?.counselFrame === "decide") {
      els.fine.textContent = "Counsel · call on the table";
    } else if (res?.mind?.counselFrame === "hold") {
      els.fine.textContent = "Counsel · holding for one fact";
    } else if (res?.mind?.counselFrame === "steady") {
      els.fine.textContent = "Counsel · steady";
    } else if (res?.mind?.probePhase === "ask") {
      els.fine.textContent = "Probe · gathering — answer when ready, or say “מספיק”";
    } else if (res?.mind?.probePhase === "verdict") {
      els.fine.textContent = "Probe · verdict ready";
    } else if (res?.mind?.knowledgeCards?.length) {
      els.fine.textContent = `Spacehand cards · ${res.mind.knowledgeCards.join(", ")}`;
    } else if (currentModeId() === "spacehand") {
      els.fine.textContent = "Spacehand · index only (no card matched)";
    } else if (currentModeId() === "probe") {
      els.fine.textContent = "Probe · questions first, then a verdict";
    } else if (currentModeId() === "counsel") {
      els.fine.textContent = "Counsel · a clear call, the cost, and when to reverse";
    } else {
      els.fine.textContent = "Enter to send · Shift+Enter for a new line";
    }
    await refreshList();
    paintList();
    paintThread();
    els.input.focus();
  }

  function stopWait() {
    state.sendToken += 1;
    setBusy(false);
    paintThread();
    toast("Stopped waiting");
  }

  async function regenerate() {
    if (!state.activeId || state.sending) return;
    const token = ++state.sendToken;
    setBusy(true);
    paintThread();
    const res = await invoke("chat.regenerate", {
      conversationId: state.activeId,
      mindTask: state.messageTask,
    });
    if (token !== state.sendToken) return;
    setBusy(false);
    if (res?.conversation) state.conversation = res.conversation;
    if (res?.ok === false) toast(res.error || "Failed");
    await refreshList();
    paintList();
    paintThread();
  }

  async function togglePin() {
    if (!state.activeId) return;
    const res = await invoke("chat.pin", {
      id: state.activeId,
      pinned: !state.conversation?.pinned,
    });
    if (res?.ok === false) return toast(res.error || "Pin failed");
    state.conversation = res.conversation;
    await refreshList();
    paintList();
    updateMenuEnabled();
  }

  function openRename() {
    if (!state.activeId) return;
    els.renameInput.value = state.conversation?.title || "";
    els.renameModal.classList.remove("hidden");
    els.renameInput.focus();
    els.renameInput.select();
  }

  async function submitRename(e) {
    e.preventDefault();
    const title = els.renameInput.value.trim();
    if (!title || !state.activeId) return;
    const res = await invoke("chat.rename", { id: state.activeId, title });
    els.renameModal.classList.add("hidden");
    if (res?.ok === false) return toast(res.error || "Rename failed");
    state.conversation = res.conversation;
    await refreshList();
    paintList();
    paintThread();
  }

  function askConfirm(type) {
    if (!state.activeId) return;
    state.confirmAction = { type, id: state.activeId };
    if (type === "delete") {
      els.confirmTitle.textContent = "Delete chat?";
      els.confirmCopy.textContent = `"${state.conversation?.title || "New chat"}" will be removed.`;
      els.confirmOk.textContent = "Delete";
    } else {
      els.confirmTitle.textContent = "Clear messages?";
      els.confirmCopy.textContent = "Messages will be removed. The chat stays in history.";
      els.confirmOk.textContent = "Clear";
    }
    els.confirmModal.classList.remove("hidden");
  }

  async function runConfirm() {
    const action = state.confirmAction;
    els.confirmModal.classList.add("hidden");
    state.confirmAction = null;
    if (!action) return;

    if (action.type === "delete") {
      const res = await invoke("chat.delete", { id: action.id });
      if (res?.ok === false) return toast(res.error || "Delete failed");
      clearDraftFor(action.id);
      if (state.activeId === action.id) {
        state.activeId = null;
        state.conversation = null;
      }
      await refreshList();
      if (!state.activeId && state.list[0]) await openChat(state.list[0].id);
      else {
        paintList();
        paintThread();
      }
      return;
    }

    if (action.type === "clear") {
      const res = await invoke("chat.clear", { id: action.id });
      if (res?.ok === false) return toast(res.error || "Clear failed");
      state.conversation = res.conversation;
      await refreshList();
      paintList();
      paintThread();
    }
  }

  function fillModels(tasks, selected) {
    const seen = new Set();
    const opts = ['<option value="">Task default</option>'];
    for (const t of tasks || []) {
      for (const m of t.modelOptions || []) {
        if (seen.has(m.id)) continue;
        seen.add(m.id);
        opts.push(
          `<option value="${escapeHtml(m.id)}"${m.id === selected ? " selected" : ""}>${escapeHtml(
            m.label
          )}</option>`
        );
      }
    }
    els.setModel.innerHTML = opts.join("");
  }

  function renderMemoryList(facts = []) {
    if (!els.memoryList) return;
    if (!facts.length) {
      els.memoryList.innerHTML = `<li class="memory-empty">No memories yet — add facts Mind should remember.</li>`;
      return;
    }
    els.memoryList.innerHTML = facts
      .map(
        (f) => `<li class="memory-item" data-id="${escapeHtml(f.id)}">
          <div class="memory-item-main">
            <span class="memory-text">${escapeHtml(f.text)}</span>
            ${
              f.tags?.length
                ? `<span class="memory-tagline">${escapeHtml(f.tags.join(" · "))}</span>`
                : ""
            }
          </div>
          <div class="memory-item-actions">
            <button type="button" class="ghost memory-pin${f.pinned ? " is-on" : ""}" data-pin="${escapeHtml(f.id)}" title="Pin">★</button>
            <button type="button" class="ghost memory-del" data-del="${escapeHtml(f.id)}" title="Delete">×</button>
          </div>
        </li>`
      )
      .join("");
    els.memoryList.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-del");
        try {
          await invoke("chat.memory.delete", { id });
          toast("Memory removed");
          await refreshMemoryList();
        } catch (err) {
          toast(err.message || "Delete failed");
        }
      });
    });
    els.memoryList.querySelectorAll("[data-pin]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-pin");
        const item = facts.find((f) => f.id === id);
        if (!item) return;
        try {
          await invoke("chat.memory.update", { id, pinned: !item.pinned });
          await refreshMemoryList();
        } catch (err) {
          toast(err.message || "Update failed");
        }
      });
    });
  }

  async function refreshMemoryList() {
    const res = await invoke("chat.memory.list");
    renderMemoryList(res.facts || []);
    if (els.setMemoryEnabled) els.setMemoryEnabled.checked = res.enabled !== false;
  }

  async function addMemoryFact() {
    const text = els.memoryNewText?.value?.trim();
    if (!text) return toast("Enter a memory");
    const tags = els.memoryNewTags?.value?.trim();
    try {
      await invoke("chat.memory.add", { text, tags: tags || undefined });
      if (els.memoryNewText) els.memoryNewText.value = "";
      if (els.memoryNewTags) els.memoryNewTags.value = "";
      toast("Memory saved");
      await refreshMemoryList();
    } catch (err) {
      toast(err.message || "Could not save");
    }
  }

  async function openSettings() {
    const res = await invoke("chat.settings.get");
    if (res?.ok === false) return toast(res.error || "Settings failed");
    state.settings = res.settings;
    state.mindTasks = res.mind?.tasks || [];
    els.mindStatus.className = `status ${res.mind?.hasKey ? "ok" : "warn"}`;
    els.mindStatus.textContent = res.mind?.hasKey
      ? `Mind ready · ${TASK_LABELS[res.mind.defaultTask] || "Everyday"}`
      : "Add a Gemini key — palette: Mind Setup, or mind(setup)";
    els.setTask.innerHTML = (state.mindTasks || [])
      .map(
        (t) =>
          `<option value="${escapeHtml(t.id)}"${t.id === res.settings.mindTask ? " selected" : ""}>${escapeHtml(
            t.label
          )}</option>`
      )
      .join("");
    fillModels(state.mindTasks, res.settings.model || "");
    els.setContext.value = res.settings.contextMessages ?? 20;
    els.setTemp.value = res.settings.temperature ?? 0.6;
    els.setSystem.value = res.settings.systemPrompt || "";
    if (els.setMemoryEnabled) {
      els.setMemoryEnabled.checked = res.settings.memoryEnabled !== false && res.memory?.enabled !== false;
    }
    await refreshMemoryList();
    if (res.settings.mindTask) {
      state.messageTask = res.settings.mindTask;
      els.task.value = state.messageTask;
    }
    els.settingsModal.classList.remove("hidden");
  }

  async function saveSettings() {
    const res = await invoke("chat.settings.set", {
      settings: {
        mindTask: els.setTask.value,
        model: els.setModel.value,
        contextMessages: Number(els.setContext.value) || 20,
        temperature: Number(els.setTemp.value) || 0.6,
        systemPrompt: els.setSystem.value,
        memoryEnabled: els.setMemoryEnabled ? els.setMemoryEnabled.checked : true,
      },
    });
    if (res?.ok === false) return toast(res.error || "Save failed");
    if (els.setMemoryEnabled) {
      await invoke("chat.memory.enabled", { enabled: els.setMemoryEnabled.checked });
    }
    state.settings = res.settings;
    state.messageTask = res.settings.mindTask || "chat";
    els.task.value = state.messageTask;
    els.settingsModal.classList.add("hidden");
    toast("Saved");
  }

  function autosize() {
    els.input.style.height = "auto";
    els.input.style.height = `${Math.min(140, Math.max(22, els.input.scrollHeight))}px`;
  }

  function closeMenu() {
    els.menu.classList.add("hidden");
  }

  window.ChatApp = {
    setPage(page) {
      if (page === "memory") void openSettings();
    },
    openChat(id) {
      if (id) void openChat(id);
    },
    newChat() {
      void newChat();
    },
    openSettings() {
      void openSettings();
    },
  };

  els.btnNew.addEventListener("click", () => void newChat());
  els.btnSettings.addEventListener("click", () => void openSettings());
  els.btnModes?.addEventListener("click", () => {
    void ensureModes().then(() => openModesCatalog());
  });
  els.btnSideOpen.addEventListener("click", () => setSide(!sideOpen()));
  els.btnSideClose.addEventListener("click", () => setSide(false));
  els.scrim.addEventListener("click", () => setSide(false));
  els.btnStop.addEventListener("click", stopWait);
  els.confirmOk.addEventListener("click", () => void runConfirm());
  els.renameForm.addEventListener("submit", (e) => void submitRename(e));
  els.settingsSave.addEventListener("click", () => void saveSettings());
  els.memoryAddBtn?.addEventListener("click", () => void addMemoryFact());
  els.memoryNewText?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void addMemoryFact();
    }
  });

  els.task.addEventListener("change", () => {
    state.messageTask = els.task.value;
  });

  els.btnMenu.addEventListener("click", (e) => {
    e.stopPropagation();
    if (els.btnMenu.disabled) return;
    els.menu.classList.toggle("hidden");
  });
  els.menu.addEventListener("click", (e) => {
    const act = e.target?.dataset?.act;
    if (!act) return;
    closeMenu();
    if (act === "pin") void togglePin();
    if (act === "rename") openRename();
    if (act === "clear") askConfirm("clear");
    if (act === "delete") askConfirm("delete");
  });
  document.addEventListener("click", () => closeMenu());

  els.composer.addEventListener("submit", (e) => {
    e.preventDefault();
    void send();
  });
  els.input.addEventListener("input", () => {
    autosize();
    scheduleDraftSave();
  });
  els.input.addEventListener("blur", saveCurrentDraft);
  els.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  });
  els.search.addEventListener("input", () => {
    state.search = els.search.value || "";
    paintList();
  });

  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => $(btn.dataset.close)?.classList.add("hidden"));
  });
  [els.settingsModal, els.renameModal, els.confirmModal, els.modesModal].forEach((modal) => {
    modal?.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    });
  });

  document.querySelectorAll(".starter").forEach((btn) => {
    btn.addEventListener("click", () => {
      els.input.value = (btn.dataset.prompt || "").replace(/&#10;/g, "\n");
      autosize();
      els.input.focus();
    });
  });

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
      e.preventDefault();
      void newChat();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      setSide(!sideOpen());
    }
    if (e.key === "Escape") {
      ["settings-modal", "rename-modal", "confirm-modal", "modes-modal"].forEach((id) =>
        $(id)?.classList.add("hidden")
      );
      closeMenu();
      if (isMobile() && sideOpen()) setSide(false);
    }
  });

  window.addEventListener("resize", () => {
    if (isMobile()) {
      els.shell.classList.remove("side-closed");
      if (!els.shell.classList.contains("side-open")) els.scrim.hidden = true;
    } else {
      els.shell.classList.remove("side-open");
      els.scrim.hidden = true;
      restoreSide();
    }
  });

  void (async () => {
    restoreSide();
    const settingsRes = await invoke("chat.settings.get");
    if (settingsRes?.ok !== false) {
      if (settingsRes?.settings) state.settings = settingsRes.settings;
      if (settingsRes?.modes?.length) state.modes = settingsRes.modes;
      if (settingsRes?.settings?.mindTask) {
        state.messageTask = settingsRes.settings.mindTask;
        els.task.value = state.messageTask;
      }
    }
    paintModeChrome();
    await refreshList();
    const lastId = state.settings?.lastConversationId;
    const preferred =
      (lastId && state.list.find((c) => c.id === lastId)?.id) || state.list[0]?.id || null;
    if (preferred) await openChat(preferred);
    else paintThread();
    els.input.focus();
  })();
})();
