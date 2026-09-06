(() => {
  const MAX_MEMORY = 8;
  let open = false;
  let busy = false;
  let messages = [];

  function googleGSvg() {
    return `
    <svg class="ai-chat-g-logo" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
      <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
      <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
      <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
    </svg>`;
  }

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
    if (messages.length > MAX_MEMORY) messages = messages.slice(-MAX_MEMORY);
  }

  function chatApi() {
    return window.stocksAi || window.myApp || null;
  }

  function detectAnalyzeRequest(text) {
    const m = String(text || "").match(
      /(?:analyze|analysis|נתח|ניתוח)\s+(?:of\s+|את\s+|על\s+)?([A-Za-z][A-Za-z0-9.^=-]{0,14})/i
    );
    return m ? String(m[1]).toUpperCase() : null;
  }

  function getFocusSymbol() {
    const fromPage = window.StocksPages?.aiAnalysis?.getSymbol?.();
    if (fromPage) return fromPage;
    const stockSym = document.querySelector("#page-stock:not([hidden]) #stock-symbol")?.textContent;
    if (stockSym && stockSym !== "—") return String(stockSym).trim().toUpperCase();
    return "";
  }

  async function buildContextPayload(baseMessages) {
    const api = chatApi();
    const symbol = getFocusSymbol();
    const payload = {
      messages: baseMessages.map((m) => ({ role: m.role, content: m.content })),
      symbol: symbol || undefined,
    };

    if (symbol && api?.invoke) {
      try {
        const quoteRes = await api.invoke("quote.get", { symbols: [symbol] });
        const q = quoteRes?.quotes?.[0];
        if (q) {
          payload.quoteSummary = JSON.stringify({
            symbol: q.symbol,
            name: q.name,
            price: q.price,
            changePct: q.changePct,
            trailingPE: q.trailingPE,
            marketCap: q.marketCap,
            beta: q.beta,
            fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
            fiftyTwoWeekLow: q.fiftyTwoWeekLow,
          });
        }
      } catch {
      }
      try {
        const cached = await api.invoke("analysis.getCached", { symbol });
        const a = cached?.analysis;
        if (a?.snapshot) {
          payload.analysisSummary = JSON.stringify({
            score: a.snapshot.score,
            summary: a.snapshot.summary,
            valuation: a.valuation?.stance,
            action: a.bottomLine?.action,
            bullets: a.bottomLine?.bullets,
          });
        }
      } catch {
      }
    }

    try {
      const pf = await api.invoke("portfolio.get");
      if (pf?.ok && pf.positions?.length) {
        payload.portfolioSummary = JSON.stringify({
          totalValue: pf.summary?.totalValue,
          totalPlPct: pf.summary?.totalPlPct,
          top: pf.positions.slice(0, 8).map((p) => ({
            symbol: p.symbol,
            qty: p.qty,
            plPct: p.plPct,
          })),
        });
      }
    } catch {
    }

    return payload;
  }

  function ensureUi() {
    if (document.getElementById("stocks-ai-chat-root")) return;

    const root = el("div", "ai-chat-root");
    root.id = "stocks-ai-chat-root";

    const panel = el("div", "ai-chat-panel hidden");
    panel.id = "stocks-ai-chat-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Stocks Gemini chat");

    panel.innerHTML = `
      <header class="ai-chat-header">
        <div class="ai-chat-header-brand">
          ${googleGSvg()}
          <div>
            <div class="ai-chat-title">Gemini</div>
            <div class="ai-chat-subtitle">Stocks</div>
          </div>
        </div>
        <div class="ai-chat-header-actions">
          <button type="button" class="ai-chat-icon-btn" id="stocks-ai-chat-clear" title="New chat" aria-label="New chat">✦</button>
          <button type="button" class="ai-chat-icon-btn" id="stocks-ai-chat-close" title="Close" aria-label="Close">✕</button>
        </div>
      </header>
      <div class="ai-chat-messages" id="stocks-ai-chat-messages" aria-live="polite"></div>
      <form class="ai-chat-composer" id="stocks-ai-chat-form">
        <textarea id="stocks-ai-chat-input" rows="1" placeholder="Ask about a stock, risk, valuation…" autocomplete="off" spellcheck="true"></textarea>
        <button type="submit" class="ai-chat-send" id="stocks-ai-chat-send" title="Send">➤</button>
      </form>
    `;

    const fab = el("button", "ai-chat-fab");
    fab.id = "stocks-ai-chat-fab";
    fab.type = "button";
    fab.title = "Open Stocks Gemini chat";
    fab.setAttribute("aria-label", "Open Stocks Gemini chat");
    fab.setAttribute("aria-expanded", "false");
    fab.innerHTML = googleGSvg();

    root.appendChild(panel);
    root.appendChild(fab);
    document.body.appendChild(root);

    fab.addEventListener("click", () => setOpen(!open));
    panel.querySelector("#stocks-ai-chat-close").addEventListener("click", () => setOpen(false));
    panel.querySelector("#stocks-ai-chat-clear").addEventListener("click", () => clearChat());
    panel.querySelector("#stocks-ai-chat-form").addEventListener("submit", onSubmit);

    const input = panel.querySelector("#stocks-ai-chat-input");
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        panel.querySelector("#stocks-ai-chat-form").requestSubmit();
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
    const panel = document.getElementById("stocks-ai-chat-panel");
    const fab = document.getElementById("stocks-ai-chat-fab");
    if (!panel || !fab) return;
    panel.classList.toggle("hidden", !open);
    fab.classList.toggle("is-open", open);
    fab.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      document.getElementById("stocks-ai-chat-input")?.focus();
      scrollToBottom();
    }
  }

  function clearChat() {
    messages = [];
    renderMessages();
  }

  function setBusy(on) {
    busy = on;
    const send = document.getElementById("stocks-ai-chat-send");
    const input = document.getElementById("stocks-ai-chat-input");
    if (send) send.disabled = on;
    if (input) input.disabled = on;
  }

  function scrollToBottom() {
    const box = document.getElementById("stocks-ai-chat-messages");
    if (box) box.scrollTop = box.scrollHeight;
  }

  function renderMessages() {
    const box = document.getElementById("stocks-ai-chat-messages");
    if (!box) return;
    if (!messages.length) {
      box.innerHTML = `
        <div class="ai-chat-empty">
          <div class="ai-chat-empty-title">Chat with Gemini</div>
          <p>Ask about tickers, valuation, risks, or catalysts. Separate from the system AI.</p>
          <p class="muted">Tip: “analyze AAPL” opens full AI Analysis and fills every category.</p>
        </div>`;
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

  async function runStructuredAnalysis(symbol) {
    const api = chatApi();
    messages.push({
      role: "assistant",
      content: `Running full AI Analysis for ${symbol} (all categories)…`,
    });
    trimMemory();
    renderMessages();
    setBusy(true);

    try {
      window.StocksApp?.openAiAnalysis?.(symbol);
      const lang =
        window.StocksPages?.aiAnalysis?.getAnalysisLang?.() ||
        window.StocksI18n?.lang?.() ||
        "en";
      const res = await (api.analysisGenerate
        ? api.analysisGenerate({ symbol, force: true, lang })
        : api.invoke("analysis.generate", { symbol, force: true, lang }));
      if (!res?.ok) throw new Error(res?.error || "Analysis failed");
      const a = res.analysis;
      const score = a?.snapshot?.score != null ? `${a.snapshot.score}/10` : "—";
      const summary = a?.snapshot?.summary || "Analysis ready.";
      messages.push({
        role: "assistant",
        content: `Done for ${symbol} (score ${score}).\n${summary}\n\nAll categories are filled on the AI Analysis page.`,
      });
    } catch (err) {
      messages.push({ role: "assistant", content: `⚠ ${err?.message || String(err)}` });
    } finally {
      trimMemory();
      renderMessages();
      setBusy(false);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    const input = document.getElementById("stocks-ai-chat-input");
    const text = String(input?.value || "").trim();
    if (!text) return;
    input.value = "";
    autoGrow(input);

    const analyzeSym = detectAnalyzeRequest(text);
    messages.push({ role: "user", content: text });
    trimMemory();
    renderMessages();

    if (analyzeSym) {
      await runStructuredAnalysis(analyzeSym);
      input?.focus();
      return;
    }

    setBusy(true);
    const pending = el("div", "ai-chat-bubble ai-chat-bubble--assistant ai-chat-bubble--pending");
    pending.innerHTML = `<span class="ai-chat-bubble-role">Gemini</span><div class="ai-chat-bubble-text">Thinking…</div>`;
    document.getElementById("stocks-ai-chat-messages")?.appendChild(pending);
    scrollToBottom();

    try {
      const api = chatApi();
      if (!api?.geminiChat) throw new Error("Stocks AI unavailable — restart My Space");
      const payload = await buildContextPayload(messages);
      const res = await api.geminiChat(payload);
      pending.remove();
      if (!res?.ok) throw new Error(res?.error || "Chat failed");
      messages.push({ role: "assistant", content: res.content || "(empty response)" });
      trimMemory();
      renderMessages();
    } catch (err) {
      pending.remove();
      messages.push({ role: "assistant", content: `⚠ ${err?.message || String(err)}` });
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

  window.StocksAiChat = {
    init,
    open: () => setOpen(true),
    close: () => setOpen(false),
    clear: clearChat,
  };
})();
