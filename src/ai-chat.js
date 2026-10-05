(() => {
  function mindLogoHtml(className = "ai-chat-mind-logo") {
    return `<img class="${className}" src="brand/atom-rose.png" alt="" width="28" height="28" />`;
  }

  let open = false;
  let busy = false;
  let messages = [];
  let conversationId = null;
  let sessionAllowActions = false;
  let confirmResolver = null;
  let confirmTimer = null;

  function el(tag, className, html) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatMessage(text) {
    return escapeHtml(text).replace(/\n/g, "<br>");
  }

  function summarizeTools(toolsUsed) {
    if (!Array.isArray(toolsUsed) || !toolsUsed.length) return "";
    return toolsUsed
      .map((t) => {
        const label = escapeHtml(t.label || t.resolvedTool || t.name || "action");
        const declined = t.declined || t.result?.declined;
        const ok = t.result?.ok !== false && !declined;
        const cls = declined ? "skipped" : ok ? "ok" : "fail";
        const mark = declined ? "skipped" : ok ? "done" : "failed";
        return `<span class="ai-chat-action-chip ai-chat-action-chip--${cls}" title="${escapeHtml(t.name || "")}">${mark}: ${label}</span>`;
      })
      .join("");
  }

  async function ensureConversation() {
    if (conversationId) return conversationId;
    if (window.mySpace?.aiChat?.newConversation) {
      const res = await window.mySpace.aiChat.newConversation();
      if (res?.ok && res.conversationId) {
        conversationId = res.conversationId;
        return conversationId;
      }
    }
    conversationId = `oschat_local_${Date.now()}`;
    return conversationId;
  }

  async function clearChat() {
    messages = [];
    conversationId = null;
    sessionAllowActions = false;
    resolveConfirm({ approved: false, reason: "chat cleared" });
    await ensureConversation();
    renderMessages();
  }

  function resolveConfirm(payload) {
    if (confirmTimer) {
      clearTimeout(confirmTimer);
      confirmTimer = null;
    }
    const resolve = confirmResolver;
    confirmResolver = null;
    const card = document.getElementById("ai-chat-confirm");
    if (card) card.remove();
    if (resolve) resolve(payload);
  }

  function ensureUi() {
    if (document.getElementById("ai-chat-root")) return;

    const root = el("div", "ai-chat-root");
    root.id = "ai-chat-root";

    const panel = el("div", "ai-chat-panel hidden");
    panel.id = "ai-chat-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Mind Chat");

    panel.innerHTML = `
      <header class="ai-chat-header">
        <div class="ai-chat-header-brand">
          ${mindLogoHtml()}
          <div>
            <div class="ai-chat-title">Mind Chat</div>
            <div class="ai-chat-subtitle">Can run actions · saved in Chat history</div>
          </div>
        </div>
        <div class="ai-chat-header-actions">
          <button type="button" class="ai-chat-icon-btn" id="ai-chat-clear" title="New chat" aria-label="New chat">⌫</button>
          <button type="button" class="ai-chat-icon-btn" id="ai-chat-close" title="Close" aria-label="Close">×</button>
        </div>
      </header>
      <div class="ai-chat-messages" id="ai-chat-messages" aria-live="polite"></div>
      <form class="ai-chat-composer" id="ai-chat-form">
        <textarea id="ai-chat-input" rows="1" placeholder="Ask or command — open Stocks, close Clock…" autocomplete="off" spellcheck="true"></textarea>
        <button type="submit" class="ai-chat-send" id="ai-chat-send" title="Send">➤</button>
      </form>
    `;

    root.appendChild(panel);
    document.body.appendChild(root);

    panel.querySelector("#ai-chat-close").addEventListener("click", () => setOpen(false));
    panel.querySelector("#ai-chat-clear").addEventListener("click", () => clearChat());
    panel.querySelector("#ai-chat-form").addEventListener("submit", onSubmit);

    const input = panel.querySelector("#ai-chat-input");
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        panel.querySelector("#ai-chat-form").requestSubmit();
      }
    });
    input.addEventListener("input", () => autoGrow(input));

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && open) {
        if (confirmResolver) {
          resolveConfirm({ approved: false, reason: "cancelled" });
          return;
        }
        setOpen(false);
      }
    });

    const taskbarBtn = document.getElementById("btn-ask-ai");
    if (taskbarBtn && !taskbarBtn.dataset.aiBound) {
      taskbarBtn.dataset.aiBound = "1";
      taskbarBtn.addEventListener("click", () => setOpen(!open));
    }

    renderMessages();
    ensureConversation();
    syncHostVisibility();
  }

  function autoGrow(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(120, textarea.scrollHeight)}px`;
  }

  function isAppOwnedChatFocused() {
    const ws = window.MySpaceWorkspace;
    if (!ws?.isOpen?.()) return false;
    const activeId = ws.getActiveTabId?.();
    if (!activeId) return false;
    const tab = (ws.getTabs?.() || []).find((t) => t.id === activeId);
    if (!tab) return false;
    const id = String(tab.appId || tab.module || "").toLowerCase();
    return id === "world-maps" || id === "studies" || id === "stocks";
  }

  function syncTaskbarButton() {
    const btn = document.getElementById("btn-ask-ai");
    if (!btn) return;
    btn.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function syncHostVisibility() {
    const root = document.getElementById("ai-chat-root");
    if (!root) return;
    const hide = isAppOwnedChatFocused();
    root.classList.toggle("hidden", hide);
    root.setAttribute("aria-hidden", hide ? "true" : "false");
    const taskbarBtn = document.getElementById("btn-ask-ai");
    if (taskbarBtn) {
      taskbarBtn.classList.toggle("is-hidden-for-app", hide);
      taskbarBtn.disabled = hide;
    }
    if (hide && open) {
      open = false;
      const panel = document.getElementById("ai-chat-panel");
      panel?.classList.add("hidden");
    }
    window.MySpaceWorkspace?.setAiChatInset?.({ visible: false, panelOpen: false });
    syncTaskbarButton();
  }

  function setOpen(next) {
    open = Boolean(next);
    ensureUi();
    const panel = document.getElementById("ai-chat-panel");
    if (!panel) return;
    panel.classList.toggle("hidden", !open);
    syncHostVisibility();
    if (open) {
      const input = document.getElementById("ai-chat-input");
      input?.focus();
      scrollToBottom();
    }
  }

  function openChat(opts = {}) {
    ensureUi();
    setOpen(true);
    const prompt = String(opts.prompt || "").trim();
    const input = document.getElementById("ai-chat-input");
    if (input && prompt) {
      input.value = prompt;
      autoGrow(input);
    }
    if (opts.send && prompt) {
      const form = document.getElementById("ai-chat-form");
      requestAnimationFrame(() => {
        form?.requestSubmit?.();
      });
    } else {
      input?.focus();
    }
  }

  function renderMessages() {
    const box = document.getElementById("ai-chat-messages");
    if (!box) return;
    if (!messages.length) {
      box.innerHTML = `
        <div class="ai-chat-empty">
          <div class="ai-chat-empty-title">Mind Chat</div>
          <p>Ask it to <strong>do</strong> things: open apps, run <code>stocks</code>, close Clock. Chats are saved in Mind Chat history, etc.. Sensitive actions ask for a quick Run / Skip.</p>
        </div>
      `;
      return;
    }
    box.innerHTML = messages
      .map((m) => {
        const role = m.role === "user" ? "user" : "assistant";
        const label = role === "user" ? "You" : "Mind";
        const actions = role === "assistant" ? summarizeTools(m.toolsUsed) : "";
        return `<div class="ai-chat-bubble ai-chat-bubble--${role}"><span class="ai-chat-bubble-role">${label}</span><div class="ai-chat-bubble-text">${formatMessage(m.content)}</div>${
          actions ? `<div class="ai-chat-actions">${actions}</div>` : ""
        }</div>`;
      })
      .join("");
    scrollToBottom();
  }

  function scrollToBottom() {
    const box = document.getElementById("ai-chat-messages");
    if (box) box.scrollTop = box.scrollHeight;
  }

  function setBusy(next) {
    busy = Boolean(next);
    const send = document.getElementById("ai-chat-send");
    const input = document.getElementById("ai-chat-input");
    if (send) send.disabled = busy;
    if (input) input.disabled = busy;
  }

  function showConfirmCard(action) {
    const box = document.getElementById("ai-chat-messages");
    if (!box) return;
    document.getElementById("ai-chat-confirm")?.remove();

    const card = el("div", "ai-chat-confirm");
    card.id = "ai-chat-confirm";
    const label = escapeHtml(action?.label || action?.name || "Run action");
    const detail = escapeHtml(
      action?.arguments?.command ||
        action?.arguments?.app ||
        action?.name ||
        ""
    );
    card.innerHTML = `
      <div class="ai-chat-confirm-title">Allow action?</div>
      <div class="ai-chat-confirm-label">${label}</div>
      ${detail && detail !== label ? `<div class="ai-chat-confirm-detail">${detail}</div>` : ""}
      <div class="ai-chat-confirm-actions">
        <button type="button" class="ai-chat-confirm-btn ai-chat-confirm-btn--run" data-act="run">Run</button>
        <button type="button" class="ai-chat-confirm-btn" data-act="session">Always this chat</button>
        <button type="button" class="ai-chat-confirm-btn ai-chat-confirm-btn--skip" data-act="skip">Skip</button>
      </div>
    `;
    card.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const act = btn.getAttribute("data-act");
      if (act === "run") resolveConfirm({ approved: true });
      else if (act === "session") {
        sessionAllowActions = true;
        resolveConfirm({ approved: true });
      } else resolveConfirm({ approved: false, reason: "skipped" });
    });
    box.appendChild(card);
    scrollToBottom();
  }

  /**
   * Called from main process via executeJavaScript before mutating tools.
   * @returns {Promise<{approved:boolean, auto?:boolean, reason?:string}>}
   */
  function confirmAction(action) {
    ensureUi();
    setOpen(true);
    if (sessionAllowActions) {
      return Promise.resolve({ approved: true, auto: true });
    }
    if (confirmResolver) {
      resolveConfirm({ approved: false, reason: "replaced" });
    }
    return new Promise((resolve) => {
      confirmResolver = resolve;
      showConfirmCard(action || {});
      confirmTimer = setTimeout(() => {
        resolveConfirm({ approved: false, reason: "timeout" });
      }, 60000);
    });
  }

  function toolMutatesWorkspace(toolsUsed) {
    if (!Array.isArray(toolsUsed) || !toolsUsed.length) return false;
    return toolsUsed.some((t) => {
      const name = String(t?.name || t?.resolvedTool || "").toLowerCase();
      return /open|focus|close|launch|stock|country|navigate|run_command|shell_/.test(name);
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    const input = document.getElementById("ai-chat-input");
    const text = (input?.value || "").trim();
    if (!text) return;

    input.value = "";
    autoGrow(input);
    messages.push({ role: "user", content: text });
    renderMessages();
    setBusy(true);

    const activeBefore = window.MySpaceWorkspace?.getActiveTabId?.() || null;

    const pending = el("div", "ai-chat-bubble ai-chat-bubble--assistant ai-chat-bubble--pending");
    pending.innerHTML = `<span class="ai-chat-bubble-role">Mind</span><div class="ai-chat-bubble-text">Working…</div>`;
    document.getElementById("ai-chat-messages")?.appendChild(pending);
    scrollToBottom();

    const hangTimer = setTimeout(() => {
      const textEl = pending.querySelector(".ai-chat-bubble-text");
      if (textEl && pending.isConnected) {
        textEl.textContent = "Still waiting for Mind… add a Gemini key in Mind → Setup if chat isn’t set up yet.";
      }
    }, 12_000);

    try {
      if (!window.mySpace?.aiChat?.chat) {
        throw new Error("AI bridge unavailable — restart My Space");
      }
      const convId = await ensureConversation();
      const payload = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await window.mySpace.aiChat.chat(payload, convId);
      clearTimeout(hangTimer);
      pending.remove();
      if (!res?.ok) {
        throw new Error(res?.error || "Chat failed");
      }
      if (res.conversationId) conversationId = res.conversationId;
      messages.push({
        role: "assistant",
        content: res.content || "(empty response)",
        toolsUsed: res.toolsUsed || [],
      });
      renderMessages();

      const activeAfter = window.MySpaceWorkspace?.getActiveTabId?.() || null;
      if (
        activeBefore &&
        activeAfter &&
        activeBefore !== activeAfter &&
        !toolMutatesWorkspace(res.toolsUsed)
      ) {
        window.MySpaceWorkspace?.showWorkspace?.(activeBefore);
      }
    } catch (err) {
      clearTimeout(hangTimer);
      pending.remove();
      const msg = err?.message || String(err);
      messages.push({ role: "assistant", content: `⚠️ ${msg}` });
      renderMessages();
      const activeAfter = window.MySpaceWorkspace?.getActiveTabId?.() || null;
      if (activeBefore && activeAfter && activeBefore !== activeAfter) {
        window.MySpaceWorkspace?.showWorkspace?.(activeBefore);
      }
    } finally {
      clearTimeout(hangTimer);
      setBusy(false);
      input?.focus();
    }
  }

  function init() {
    ensureUi();
    window.addEventListener("myspace-tabs-change", syncHostVisibility);
    syncHostVisibility();
  }

  window.__myspaceAiConfirmAction = confirmAction;

  window.MySpaceAiChat = {
    init,
    open: (opts) => (opts && typeof opts === "object" ? openChat(opts) : setOpen(true)),
    close: () => setOpen(false),
    clear: clearChat,
    confirmAction,
    isOpen: () => open,
  };
})();