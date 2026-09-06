(() => {
  const MAX_MEMORY = 8;

  function googleGSvg() {
    return `
    <svg class="ai-chat-g-logo" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
      <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
      <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
      <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
    </svg>`; 
  }
  let open = false;
  let busy = false;
  let messages = [];

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

  function trimMemory() {
    if (messages.length > MAX_MEMORY) {
      messages = messages.slice(-MAX_MEMORY);
    }
  }

  function clearChat() {
    messages = [];
    renderMessages();
  }

  function ensureUi() {
    if (document.getElementById("ai-chat-root")) return;

    const root = el("div", "ai-chat-root");
    root.id = "ai-chat-root";

    const panel = el("div", "ai-chat-panel hidden");
    panel.id = "ai-chat-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Gemini chat");

    panel.innerHTML = `
      <header class="ai-chat-header">
        <div class="ai-chat-header-brand">
          ${googleGSvg()}
          <div>
            <div class="ai-chat-title">Gemini</div>
            <div class="ai-chat-subtitle">World Maps</div>
          </div>
        </div>
        <div class="ai-chat-header-actions">
          <button type="button" class="ai-chat-icon-btn" id="ai-chat-clear" title="New chat" aria-label="New chat">↻</button>
          <button type="button" class="ai-chat-icon-btn" id="ai-chat-close" title="Close" aria-label="Close">×</button>
        </div>
      </header>
      <div class="ai-chat-messages" id="ai-chat-messages" aria-live="polite"></div>
      <form class="ai-chat-composer" id="ai-chat-form">
        <textarea id="ai-chat-input" rows="1" placeholder="Ask Gemini…" autocomplete="off" spellcheck="true"></textarea>
        <button type="submit" class="ai-chat-send" id="ai-chat-send" title="Send">➤</button>
      </form>
    `;

    const fab = el("button", "ai-chat-fab");
    fab.id = "ai-chat-fab";
    fab.type = "button";
    fab.title = "Open Gemini chat";
    fab.setAttribute("aria-label", "Open Gemini chat");
    fab.setAttribute("aria-expanded", "false");
    fab.innerHTML = googleGSvg();

    root.appendChild(panel);
    root.appendChild(fab);
    document.body.appendChild(root);

    fab.addEventListener("click", () => setOpen(!open));
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
      if (e.key === "Escape" && open) setOpen(false);
    });

    renderMessages();
  }

  function autoGrow(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(120, textarea.scrollHeight)}px`;
  }

  function setOpen(next) {
    open = Boolean(next);
    const panel = document.getElementById("ai-chat-panel");
    const fab = document.getElementById("ai-chat-fab");
    if (!panel || !fab) return;
    panel.classList.toggle("hidden", !open);
    fab.classList.toggle("is-open", open);
    fab.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      document.getElementById("ai-chat-input")?.focus();
      scrollToBottom();
    }
  }

  function renderMessages() {
    const box = document.getElementById("ai-chat-messages");
    if (!box) return;
    if (!messages.length) {
      box.innerHTML = `
        <div class="ai-chat-empty">
          <div class="ai-chat-empty-title">Chat with Gemini</div>
          <p>Ask anything. Memory keeps the last ${MAX_MEMORY} messages.</p>
        </div>
      `;
      return;
    }
    box.innerHTML = messages
      .map((m) => {
        const role = m.role === "user" ? "user" : "assistant";
        const label = role === "user" ? "You" : "Gemini";
        return `<div class="ai-chat-bubble ai-chat-bubble--${role}"><span class="ai-chat-bubble-role">${label}</span><div class="ai-chat-bubble-text">${formatMessage(m.content)}</div></div>`;
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

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    const input = document.getElementById("ai-chat-input");
    const text = (input?.value || "").trim();
    if (!text) return;

    input.value = "";
    autoGrow(input);
    messages.push({ role: "user", content: text });
    trimMemory();
    renderMessages();
    setBusy(true);

    const pending = el("div", "ai-chat-bubble ai-chat-bubble--assistant ai-chat-bubble--pending");
    pending.innerHTML = `<span class="ai-chat-bubble-role">Gemini</span><div class="ai-chat-bubble-text">Thinking…</div>`;
    document.getElementById("ai-chat-messages")?.appendChild(pending);
    scrollToBottom();

    try {
      if (!window.WorldMapsAiAgent?.runAgent) {
        throw new Error("AI agent unavailable");
      }
      const payload = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await window.WorldMapsAiAgent.runAgent(payload);
      pending.remove();
      if (!res?.ok) {
        throw new Error(res?.error || "Chat failed");
      }
      messages.push({ role: "assistant", content: res.content || "(empty response)" });
      trimMemory();
      renderMessages();
    } catch (err) {
      pending.remove();
      const msg = err?.message || String(err);
      messages.push({ role: "assistant", content: `⚠ ${msg}` });
      trimMemory();
      renderMessages();
    } finally {
      setBusy(false);
      input?.focus();
    }
  }

  function init() {
    ensureUi();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.WorldMapsAiChat = { init, open: () => setOpen(true), close: () => setOpen(false), clear: clearChat };
})();