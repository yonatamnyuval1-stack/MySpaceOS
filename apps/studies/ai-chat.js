(() => {
  const MAX_MEMORY = 8;
  let open = false;
  let busy = false;
  let messages = [];
  let fillLang = null;
  let fillMode = "project";
  let fillPageCount = 7;
  let fillDensity = 80;
  let pendingTopic = null;

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
    return window.studiesAi || window.myApp || null;
  }

  function looksLikeFillRequest(text) {
    return /מלא|תמל[אא]|fill|populate|complete.*(slot|template|layout)|write.*(into|for).*(slot|template)/i.test(
      String(text || "")
    );
  }

  function looksLikeProjectRequest(text) {
    return /(פרויקט\s*מלא|עבודה\s*מלאה|multi-?\s*page|full\s*project|\b\d+\s*pages?\b|\b\d+\s*עמודים\b|עמודים\s*מפורטים|10\s*עמוד)/i.test(
      String(text || "")
    );
  }

  function detectLang(text) {
    return /[\u0590-\u05FF]/.test(String(text || "")) ? "he" : "en";
  }

  function countEditorSheets(editor) {
    const fromDom = editor?.page?.querySelectorAll?.("#editor-sheets .editor-sheet")?.length || 0;
    const fromApi = editor?.editor?.getPageCount?.() || 0;
    return Math.max(fromDom, fromApi);
  }

  function parseFillsJson(raw) {
    const text = String(raw || "").trim();
    if (!text) return null;
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fence ? fence[1].trim() : text;
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      const obj = JSON.parse(candidate.slice(start, end + 1));
      if (Array.isArray(obj.fills) || Array.isArray(obj.pages)) return obj;
      if (Array.isArray(obj.slots)) return { fills: obj.slots, title: obj.title };
      return null;
    } catch {
      return null;
    }
  }

  function ensureUi() {
    if (document.getElementById("studies-ai-chat-root")) return;

    const root = el("div", "ai-chat-root");
    root.id = "studies-ai-chat-root";

    const panel = el("div", "ai-chat-panel hidden");
    panel.id = "studies-ai-chat-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Studies Gemini chat");

    panel.innerHTML = `
      <header class="ai-chat-header">
        <div class="ai-chat-header-brand">
          ${googleGSvg()}
          <div>
            <div class="ai-chat-title">Gemini</div>
            <div class="ai-chat-subtitle">Studies</div>
          </div>
        </div>
        <div class="ai-chat-header-actions">
          <button type="button" class="ai-chat-icon-btn" id="studies-ai-chat-clear" title="New chat" aria-label="New chat">✦</button>
          <button type="button" class="ai-chat-icon-btn" id="studies-ai-chat-close" title="Close" aria-label="Close">✕</button>
        </div>
      </header>
      <div class="ai-fill-setup hidden" id="studies-ai-fill-setup">
        <div class="ai-fill-setup-title" id="studies-ai-fill-title">AI Fill</div>
        <div class="ai-fill-step" id="studies-ai-fill-lang-step">
          <div class="ai-fill-label">Language / שפה</div>
          <div class="ai-fill-lang-row">
            <button type="button" class="ai-fill-lang-btn" data-lang="en">English</button>
            <button type="button" class="ai-fill-lang-btn" data-lang="he">עברית</button>
          </div>
        </div>
        <div class="ai-fill-step hidden" id="studies-ai-fill-topic-step">
          <div class="ai-fill-label" id="studies-ai-fill-topic-label">Describe the topic</div>
          <textarea id="studies-ai-fill-topic" rows="3" placeholder="e.g. Photosynthesis for 9th grade…"></textarea>
          <div class="ai-fill-mode-row">
            <button type="button" class="ai-fill-mode-btn" data-mode="fill" id="studies-ai-mode-fill">Fill current pages</button>
            <button type="button" class="ai-fill-mode-btn is-active" data-mode="project" id="studies-ai-mode-project">Full multi-page project</button>
          </div>
          <div class="ai-fill-pages" id="studies-ai-fill-pages">
            <div class="ai-fill-label" id="studies-ai-fill-pages-label">Pages (AI picks templates)</div>
            <div class="ai-fill-pages-row">
              <button type="button" class="ai-fill-pages-btn" data-pages="5">5</button>
              <button type="button" class="ai-fill-pages-btn is-active" data-pages="7">7</button>
              <button type="button" class="ai-fill-pages-btn" data-pages="10">10</button>
            </div>
            <p class="ai-fill-hint" id="studies-ai-fill-hint">Gemini chooses cover + mixed layouts and writes the full assignment.</p>
          </div>
          <div class="ai-fill-density" id="studies-ai-fill-density">
            <div class="ai-fill-label" id="studies-ai-fill-density-label">Page fill (~how full each page)</div>
            <div class="ai-fill-pages-row" id="studies-ai-fill-density-row">
              <button type="button" class="ai-fill-density-btn" data-density="40">40%</button>
              <button type="button" class="ai-fill-density-btn" data-density="60">60%</button>
              <button type="button" class="ai-fill-density-btn is-active" data-density="80">80%</button>
              <button type="button" class="ai-fill-density-btn" data-density="100">100%</button>
            </div>
            <p class="ai-fill-hint" id="studies-ai-fill-density-hint">Higher = more text per page. Lower = more intentional white space.</p>
          </div>
          <div class="ai-fill-actions">
            <button type="button" class="ai-fill-cancel" id="studies-ai-fill-cancel">Cancel</button>
            <button type="button" class="ai-fill-go" id="studies-ai-fill-go" disabled>Generate</button>
          </div>
        </div>
      </div>
      <div class="ai-chat-messages" id="studies-ai-chat-messages" aria-live="polite"></div>
      <form class="ai-chat-composer" id="studies-ai-chat-form">
        <textarea id="studies-ai-chat-input" rows="1" placeholder="Ask Gemini…" autocomplete="off" spellcheck="true"></textarea>
        <button type="submit" class="ai-chat-send" id="studies-ai-chat-send" title="Send">➤</button>
      </form>
    `;

    const fab = el("button", "ai-chat-fab");
    fab.id = "studies-ai-chat-fab";
    fab.type = "button";
    fab.title = "Open Gemini chat";
    fab.setAttribute("aria-label", "Open Gemini chat");
    fab.setAttribute("aria-expanded", "false");
    fab.innerHTML = googleGSvg();

    root.appendChild(panel);
    root.appendChild(fab);
    document.body.appendChild(root);

    fab.addEventListener("click", () => setOpen(!open));
    panel.querySelector("#studies-ai-chat-close").addEventListener("click", () => setOpen(false));
    panel.querySelector("#studies-ai-chat-clear").addEventListener("click", () => clearChat());
    panel.querySelector("#studies-ai-chat-form").addEventListener("submit", onSubmit);
    panel.querySelector("#studies-ai-fill-cancel").addEventListener("click", () => hideFillSetup());
    panel.querySelector("#studies-ai-fill-go").addEventListener("click", () => runFillFromSetup());
    panel.querySelector("#studies-ai-fill-topic").addEventListener("input", syncFillGoEnabled);

    panel.querySelectorAll("[data-lang]").forEach((btn) => {
      btn.addEventListener("click", () => selectFillLanguage(btn.dataset.lang));
    });
    panel.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => selectFillMode(btn.dataset.mode));
    });
    panel.querySelectorAll("[data-pages]").forEach((btn) => {
      btn.addEventListener("click", () => selectFillPageCount(Number(btn.dataset.pages)));
    });
    panel.querySelectorAll("[data-density]").forEach((btn) => {
      btn.addEventListener("click", () => selectFillDensity(Number(btn.dataset.density)));
    });

    const input = panel.querySelector("#studies-ai-chat-input");
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        panel.querySelector("#studies-ai-chat-form").requestSubmit();
      }
    });
    input.addEventListener("input", () => autoGrow(input));

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !open) return;
      const setup = document.getElementById("studies-ai-fill-setup");
      if (setup && !setup.classList.contains("hidden")) hideFillSetup();
      else setOpen(false);
    });

    renderMessages();
  }

  function autoGrow(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(120, textarea.scrollHeight)}px`;
  }

  function setOpen(next) {
    open = Boolean(next);
    const panel = document.getElementById("studies-ai-chat-panel");
    const fab = document.getElementById("studies-ai-chat-fab");
    if (!panel || !fab) return;
    panel.classList.toggle("hidden", !open);
    fab.classList.toggle("is-open", open);
    fab.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      const setup = document.getElementById("studies-ai-fill-setup");
      if (!setup || setup.classList.contains("hidden")) {
        document.getElementById("studies-ai-chat-input")?.focus();
      }
      scrollToBottom();
    }
  }

  function clearChat() {
    messages = [];
    hideFillSetup();
    renderMessages();
  }

  function hideFillSetup() {
    document.getElementById("studies-ai-fill-setup")?.classList.add("hidden");
    fillLang = null;
    fillMode = "project";
    fillPageCount = 7;
    fillDensity = 80;
    pendingTopic = null;
  }

  function openFillComposer(prefillTopic) {
    ensureUi();
    setOpen(true);
    fillLang = null;
    fillMode = "project";
    fillPageCount = 7;
    fillDensity = 80;
    pendingTopic = prefillTopic ? String(prefillTopic).trim() : null;

    const setup = document.getElementById("studies-ai-fill-setup");
    const topic = document.getElementById("studies-ai-fill-topic");
    setup?.classList.remove("hidden");
    document.getElementById("studies-ai-fill-lang-step")?.classList.remove("hidden");
    document.getElementById("studies-ai-fill-topic-step")?.classList.add("hidden");
    if (topic) topic.value = "";
    document.querySelectorAll(".ai-fill-lang-btn").forEach((b) => b.classList.remove("is-active"));
    document.querySelectorAll(".ai-fill-mode-btn").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.mode === "project");
    });
    document.querySelectorAll(".ai-fill-pages-btn").forEach((b) => {
      b.classList.toggle("is-active", Number(b.dataset.pages) === 7);
    });
    document.querySelectorAll(".ai-fill-density-btn").forEach((b) => {
      b.classList.toggle("is-active", Number(b.dataset.density) === 80);
    });
    syncPagesVisibility();
    document.getElementById("studies-ai-fill-title").textContent = "AI Fill";
    syncFillGoEnabled();
  }

  function selectFillLanguage(lang) {
    fillLang = lang === "he" ? "he" : "en";
    document.querySelectorAll(".ai-fill-lang-btn").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.lang === fillLang);
    });
    document.getElementById("studies-ai-fill-lang-step")?.classList.add("hidden");
    document.getElementById("studies-ai-fill-topic-step")?.classList.remove("hidden");

    const topicLabel = document.getElementById("studies-ai-fill-topic-label");
    const topic = document.getElementById("studies-ai-fill-topic");
    const go = document.getElementById("studies-ai-fill-go");
    const modeFill = document.getElementById("studies-ai-mode-fill");
    const modeProject = document.getElementById("studies-ai-mode-project");
    const cancel = document.getElementById("studies-ai-fill-cancel");
    const pagesLabel = document.getElementById("studies-ai-fill-pages-label");
    const hint = document.getElementById("studies-ai-fill-hint");
    const densityLabel = document.getElementById("studies-ai-fill-density-label");
    const densityHint = document.getElementById("studies-ai-fill-density-hint");

    if (fillLang === "he") {
      document.getElementById("studies-ai-fill-title").textContent = "מילוי AI";
      if (topicLabel) topicLabel.textContent = "תאר את נושא העבודה";
      if (topic) topic.placeholder = "לדוגמה: פוטוסינתזה לכיתה ט׳ — עבודה מלאה עם תרשימים…";
      if (go) go.textContent = "יצירה";
      if (modeFill) modeFill.textContent = "מלא עמודים נוכחיים";
      if (modeProject) modeProject.textContent = "פרויקט מלא (תבניות של המודל)";
      if (cancel) cancel.textContent = "ביטול";
      if (pagesLabel) pagesLabel.textContent = "מספר עמודים (המודל בוחר תבניות)";
      if (hint) hint.textContent = "Gemini בוחר שער + תבניות מעורבות וכותב עבודה מלאה.";
      if (densityLabel) densityLabel.textContent = "מילוי עמוד (~כמה מלא כל עמוד)";
      if (densityHint) densityHint.textContent = "גבוה יותר = יותר טקסט בכל עמוד. נמוך יותר = יותר רווח לבן מכוון.";
    } else {
      document.getElementById("studies-ai-fill-title").textContent = "AI Fill";
      if (topicLabel) topicLabel.textContent = "Describe the topic";
      if (topic) topic.placeholder = "e.g. Photosynthesis for 9th grade — full project with diagrams…";
      if (go) go.textContent = "Generate";
      if (modeFill) modeFill.textContent = "Fill current pages";
      if (modeProject) modeProject.textContent = "Full project (AI picks templates)";
      if (cancel) cancel.textContent = "Cancel";
      if (pagesLabel) pagesLabel.textContent = "Pages (AI picks templates)";
      if (hint) hint.textContent = "Gemini chooses cover + mixed layouts and writes the full assignment.";
      if (densityLabel) densityLabel.textContent = "Page fill (~how full each page)";
      if (densityHint) densityHint.textContent = "Higher = more text per page. Lower = more intentional white space.";
    }

    if (pendingTopic && topic) {
      topic.value = pendingTopic;
      pendingTopic = null;
    }
    syncPagesVisibility();
    topic?.focus();
    syncFillGoEnabled();
  }

  function selectFillMode(mode) {
    fillMode = mode === "project" ? "project" : "fill";
    document.querySelectorAll(".ai-fill-mode-btn").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.mode === fillMode);
    });
    syncPagesVisibility();
  }

  function selectFillPageCount(n) {
    const allowed = [5, 7, 10];
    fillPageCount = allowed.includes(n) ? n : 7;
    document.querySelectorAll(".ai-fill-pages-btn").forEach((b) => {
      b.classList.toggle("is-active", Number(b.dataset.pages) === fillPageCount);
    });
  }

  function selectFillDensity(n) {
    const allowed = [40, 60, 80, 100];
    fillDensity = allowed.includes(n) ? n : 80;
    document.querySelectorAll(".ai-fill-density-btn").forEach((b) => {
      b.classList.toggle("is-active", Number(b.dataset.density) === fillDensity);
    });
  }

  function syncPagesVisibility() {
    const row = document.getElementById("studies-ai-fill-pages");
    if (!row) return;
    row.classList.toggle("hidden", fillMode !== "project");
  }

  function syncFillGoEnabled() {
    const go = document.getElementById("studies-ai-fill-go");
    const topic = document.getElementById("studies-ai-fill-topic");
    if (!go) return;
    go.disabled = busy || !String(topic?.value || "").trim() || !fillLang;
  }

  function buildUserPrompt(topic, language, mode, pageCount, density) {
    const dens = density || fillDensity || 80;
    if (language === "he") {
      return mode === "project"
        ? `צור פרויקט מלא של ${pageCount} עמודים (מילוי ~${dens}% לכל עמוד) עם תבניות שתבחר בעצמך בנושא: ${topic}`
        : `מלא את משבצות התבנית במסמך הפתוח (~${dens}% מילוי) בנושא: ${topic}`;
    }
    return mode === "project"
      ? `Create a full ${pageCount}-page project (~${dens}% fill per page), choosing your own templates, about: ${topic}`
      : `Fill template slots in the open document (~${dens}% fill) about: ${topic}`;
  }

  async function runFillFromSetup() {
    if (busy || !fillLang) return;
    const topic = String(document.getElementById("studies-ai-fill-topic")?.value || "").trim();
    if (!topic) return;
    const language = fillLang;
    const mode = fillMode === "fill" ? "fill" : "project";
    const pageCount = mode === "project" ? fillPageCount || 7 : undefined;
    const density = fillDensity || 80;
    hideFillSetup();
    await executeFill({ topic, language, mode, pageCount, fillDensity: density });
  }

  function renderMessages() {
    const box = document.getElementById("studies-ai-chat-messages");
    if (!box) return;
    if (!messages.length) {
      box.innerHTML = `
        <div class="ai-chat-empty">
          <div class="ai-chat-empty-title">Chat with Gemini</div>
          <p>Use <strong>✦ AI Fill</strong> → language → topic → pages (5–10) → Generate. AI picks templates for a full project.</p>
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
    const box = document.getElementById("studies-ai-chat-messages");
    if (box) box.scrollTop = box.scrollHeight;
  }

  function setBusy(next) {
    busy = Boolean(next);
    const send = document.getElementById("studies-ai-chat-send");
    const input = document.getElementById("studies-ai-chat-input");
    if (send) send.disabled = busy;
    if (input) input.disabled = busy;
    syncFillGoEnabled();
  }

  async function callFillApi(payload) {
    const api = chatApi();
    if (typeof api?.geminiFillSlots === "function") return api.geminiFillSlots(payload);
    if (typeof api?.invoke === "function") return api.invoke("gemini-fill-slots", payload);
    if (typeof window.myApp?.invoke === "function") return window.myApp.invoke("gemini-fill-slots", payload);
    return { ok: false, error: "Studies AI fill unavailable — restart the app" };
  }

  async function executeFill({ topic, language, mode, pageCount, fillDensity: densityArg }) {
    const editor = window.StudiesPages?.editor;
    if (!editor?.getOpenDocumentContext) {
      return { ok: false, error: "Open a document first" };
    }
    if (!editor.applyAiProject && mode === "project") {
      return { ok: false, error: language === "he" ? "העורך לא מעודכן — הפעל מחדש את My Space" : "Editor outdated — restart My Space" };
    }

    const requestedPages = Math.max(5, Math.min(10, Number(pageCount) || fillPageCount || 7));
    const density = [40, 60, 80, 100].includes(Number(densityArg))
      ? Number(densityArg)
      : fillDensity || 80;
    const effectiveMode = mode === "fill" ? "fill" : "project";

    messages.push({
      role: "user",
      content: buildUserPrompt(topic, language, effectiveMode, requestedPages, density),
    });
    trimMemory();
    renderMessages();
    setBusy(true);

    const pending = el("div", "ai-chat-bubble ai-chat-bubble--assistant ai-chat-bubble--pending");
    let mslHintCount = 0;
    try {
      const inj = await window.Msl?.listInjections?.("studies");
      mslHintCount = Array.isArray(inj?.keys) ? inj.keys.length : 0;
    } catch {
      mslHintCount = 0;
    }
    const mslHint =
      mslHintCount > 0
        ? language === "he"
          ? ` · עם ${mslHintCount} מקורות MSL`
          : ` · using ${mslHintCount} MSL source${mslHintCount === 1 ? "" : "s"}`
        : "";
    const pendingText =
      language === "he"
        ? effectiveMode === "project"
          ? `בונה ${requestedPages} עמודים במקביל (מילוי ~${density}%)${mslHint}… בדרך כלל כ־1–2 דקות.`
          : `עובד על המסמך${mslHint}…`
        : effectiveMode === "project"
          ? `Building ${requestedPages} pages in parallel (~${density}% fill)${mslHint}… usually about 1–2 minutes.`
          : `Working on your document${mslHint}…`;
    pending.innerHTML = `<span class="ai-chat-bubble-role">Gemini</span><div class="ai-chat-bubble-text">${pendingText}</div>`;
    document.getElementById("studies-ai-chat-messages")?.appendChild(pending);
    scrollToBottom();

    try {
      const ctx = editor.getOpenDocumentContext();
      const schemas =
        window.StudiesTemplates?.getTemplateSchemas?.() ||
        (window.StudiesTemplates?.getAllTemplates?.() || [])
          .filter((t) => t.id !== "blank")
          .map((t) => ({ id: t.id, name: t.name, description: t.description || "", roles: [] }));

      const res = await callFillApi({
        topic,
        language,
        mode: effectiveMode,
        pageCount: effectiveMode === "project" ? requestedPages : undefined,
        fillDensity: density,
        title: ctx.title,
        slots: ctx.slots || [],
        templates: schemas,
      });

      pending.remove();
      if (!res?.ok) throw new Error(res?.error || "Fill failed");

      if (effectiveMode === "project") {
        if (!Array.isArray(res.pages) || res.pages.length < 3) {
          throw new Error(
            language === "he"
              ? `השרת לא החזיר עמודי פרויקט (קיבלתי ${Array.isArray(res.pages) ? res.pages.length : 0}). הפעל מחדש את My Space לגמרי ואז נסה שוב.`
              : `Server did not return project pages (got ${Array.isArray(res.pages) ? res.pages.length : 0}). Fully restart My Space and try again.`
          );
        }

        const before = countEditorSheets(editor);
        const applied = editor.applyAiProject(res);
        if (!applied?.ok) throw new Error(applied?.error || "Could not apply project pages");

        const after = countEditorSheets(editor);
        if (after < Math.min(5, res.pages.length)) {
          throw new Error(
            language === "he"
              ? `המסמך לא הוחלף (לפני ${before}, אחרי ${after}, ציפיתי ל-${res.pages.length}). הפעל מחדש את My Space.`
              : `Document not replaced (before ${before}, after ${after}, expected ${res.pages.length}). Restart My Space.`
          );
        }

        if (typeof editor.flushSave === "function") await editor.flushSave();
        const tplList = [...new Set(res.pages.map((p) => p.template).filter(Boolean))].join(", ");
        const summary = String(res.summary || applied.summary || "").trim();
        const densNote = res.fillDensity || density;
        const sparseNote =
          res.sparsePages > 0
            ? language === "he"
              ? `\n⚠ ${res.sparsePages} עמודים עדיין דלילים — אפשר לנסות שוב עם מילוי 100%.`
              : `\n⚠ ${res.sparsePages} pages still look sparse — try again at 100% fill.`
            : "";
        const mslNote =
          Number(res.mslSources) > 0
            ? language === "he"
              ? `\n🔗 נעשה שימוש ב־${res.mslSources} מקורות MSL.`
              : `\n🔗 Grounded with ${res.mslSources} MSL source${Number(res.mslSources) === 1 ? "" : "s"}.`
            : "";
        messages.push({
          role: "assistant",
          content:
            language === "he"
              ? `${summary}\n\n✓ ${after} עמודים נכתבו במסמך (מילוי ~${densNote}%, תבניות: ${tplList}).${sparseNote}${mslNote}`
              : `${summary}\n\n✓ Wrote ${after} pages into the document (~${densNote}% fill, templates: ${tplList}).${sparseNote}${mslNote}`,
        });
      } else {
        let fills = res.fills;
        if (!fills?.length && res.content) fills = parseFillsJson(res.content)?.fills;
        if (!fills?.length) throw new Error("AI returned no slot fills");
        if (res.title && editor.page) {
          const titleInput = editor.page.querySelector("#editor-title");
          if (titleInput) {
            titleInput.value = res.title;
            editor.dirty = true;
          }
        }
        const applied = editor.applyAiFills(fills);
        const mslNote =
          Number(res.mslSources) > 0
            ? language === "he"
              ? ` (MSL: ${res.mslSources})`
              : ` (MSL sources: ${res.mslSources})`
            : "";
        messages.push({
          role: "assistant",
          content: (res.summary || `Filled ${applied.applied} slots.`) + mslNote,
        });
      }

      trimMemory();
      renderMessages();
      return { ok: true };
    } catch (err) {
      pending.remove();
      messages.push({ role: "assistant", content: `⚠ ${err?.message || String(err)}` });
      trimMemory();
      renderMessages();
      return { ok: false, error: err?.message || String(err) };
    } finally {
      setBusy(false);
    }
  }

  async function fillOpenDocument(topic) {
    openFillComposer(topic);
    return { ok: true, deferred: true };
  }

  function formatFactCheckReport(res, language) {
    const verdictMapHe = {
      accurate: "מדויק",
      mostly_accurate: "מדויק ברובו",
      mixed: "מעורב",
      unreliable: "לא אמין",
    };
    const verdictMapEn = {
      accurate: "Accurate",
      mostly_accurate: "Mostly accurate",
      mixed: "Mixed",
      unreliable: "Unreliable",
    };
    const verdict =
      language === "he"
        ? verdictMapHe[res.verdict] || res.verdict || "מעורב"
        : verdictMapEn[res.verdict] || res.verdict || "Mixed";
    const score =
      typeof res.score === "number"
        ? language === "he"
          ? `ציון אמינות: ${res.score}/100`
          : `Credibility score: ${res.score}/100`
        : "";
    const lines = [
      language === "he" ? `בדיקת אמינות — ${verdict}` : `Fact check — ${verdict}`,
      score,
      res.summary || "",
    ].filter(Boolean);

    const issues = Array.isArray(res.issues) ? res.issues : [];
    if (issues.length) {
      lines.push(language === "he" ? "\nהערות לתיקון:" : "\nIssues to fix:");
      issues.forEach((issue, i) => {
        const claim = issue.claim || issue.problem || "";
        const problem = issue.problem && issue.claim ? issue.problem : "";
        const suggestion = issue.suggestion || "";
        lines.push(
          `${i + 1}. ${claim}` +
            (problem ? `\n   ${problem}` : "") +
            (suggestion ? `\n   → ${suggestion}` : "")
        );
      });
    } else if (language === "he") {
      lines.push("\nלא נמצאו בעיות עובדתיות ברורות.");
    } else {
      lines.push("\nNo clear factual issues found.");
    }

    const notes = Array.isArray(res.notes) ? res.notes.filter(Boolean) : [];
    if (notes.length) {
      lines.push(language === "he" ? "\nהערות כלליות:" : "\nGeneral notes:");
      notes.forEach((n) => lines.push(`• ${n}`));
    }
    return lines.join("\n");
  }

  async function runFactCheck() {
    const editor = window.StudiesPages?.editor;
    if (!editor?.getDocumentPlainText) {
      ensureUi();
      setOpen(true);
      messages.push({
        role: "assistant",
        content: "⚠ Open a document first, then run Check facts.",
      });
      renderMessages();
      return { ok: false };
    }

    const text = editor.getDocumentPlainText();
    const title = editor.page?.querySelector("#editor-title")?.value || "Untitled";
    const language = detectLang(text);
    if (!String(text || "").replace(/^Title:.*/i, "").trim()) {
      ensureUi();
      setOpen(true);
      messages.push({
        role: "assistant",
        content: language === "he" ? "⚠ אין מספיק תוכן במסמך לבדיקה." : "⚠ Not enough document content to check.",
      });
      renderMessages();
      return { ok: false };
    }

    ensureUi();
    setOpen(true);
    messages.push({
      role: "user",
      content:
        language === "he"
          ? `בדוק את האמינות של המידע במסמך "${title}".`
          : `Check the credibility of the information in "${title}".`,
    });
    trimMemory();
    renderMessages();
    setBusy(true);

    const pending = el("div", "ai-chat-bubble ai-chat-bubble--assistant ai-chat-bubble--pending");
    pending.innerHTML = `<span class="ai-chat-bubble-role">Gemini</span><div class="ai-chat-bubble-text">${
      language === "he" ? "בודק אמינות של העובדות במסמך…" : "Checking document facts…"
    }</div>`;
    document.getElementById("studies-ai-chat-messages")?.appendChild(pending);
    scrollToBottom();

    try {
      const api = chatApi();
      let res;
      if (typeof api?.geminiFactCheck === "function") {
        res = await api.geminiFactCheck({ title, text, language });
      } else if (typeof api?.invoke === "function") {
        res = await api.invoke("gemini-fact-check", { title, text, language });
      } else {
        throw new Error(language === "he" ? "בדיקת אמינות לא זמינה — הפעל מחדש את My Space" : "Fact check unavailable — restart My Space");
      }
      pending.remove();
      if (!res?.ok) throw new Error(res?.error || "Fact check failed");
      messages.push({ role: "assistant", content: formatFactCheckReport(res, language) });
      trimMemory();
      renderMessages();
      return { ok: true };
    } catch (err) {
      pending.remove();
      messages.push({ role: "assistant", content: `⚠ ${err?.message || String(err)}` });
      trimMemory();
      renderMessages();
      return { ok: false, error: err?.message || String(err) };
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    const input = document.getElementById("studies-ai-chat-input");
    const text = (input?.value || "").trim();
    if (!text) return;

    input.value = "";
    autoGrow(input);

    const editorOpen = window.StudiesPages?.editor && !window.StudiesPages.editor.page?.hidden;
    if (editorOpen && (looksLikeProjectRequest(text) || looksLikeFillRequest(text))) {
      const lang = detectLang(text);
      const pageMatch = text.match(/(\d+)\s*(?:עמודים|pages?)/i);
      const pageCount = pageMatch ? Math.max(5, Math.min(10, Number(pageMatch[1]))) : 10;
      if (looksLikeProjectRequest(text)) {
        await executeFill({
          topic: text,
          language: lang,
          mode: "project",
          pageCount,
          fillDensity: fillDensity || 80,
        });
        return;
      }
      openFillComposer(text);
      return;
    }

    messages.push({ role: "user", content: text });
    trimMemory();
    renderMessages();
    setBusy(true);

    const pending = el("div", "ai-chat-bubble ai-chat-bubble--assistant ai-chat-bubble--pending");
    pending.innerHTML = `<span class="ai-chat-bubble-role">Gemini</span><div class="ai-chat-bubble-text">Thinking…</div>`;
    document.getElementById("studies-ai-chat-messages")?.appendChild(pending);
    scrollToBottom();

    try {
      const api = chatApi();
      if (!api?.geminiChat) throw new Error("Studies AI unavailable — restart the app");

      let payload = messages.map((m) => ({ role: m.role, content: m.content }));
      if (editorOpen && window.StudiesPages.editor.getOpenDocumentContext) {
        const ctx = window.StudiesPages.editor.getOpenDocumentContext();
        payload = {
          messages: payload,
          docTitle: ctx.title,
          slotsSummary: ctx.inventory,
        };
      }

      const res = await api.geminiChat(payload);
      pending.remove();
      if (!res?.ok) throw new Error(res?.error || "Chat failed");

      const parsed = parseFillsJson(res.content);
      if (parsed?.fills?.length && editorOpen) {
        window.StudiesPages.editor.applyAiFills(parsed.fills);
        messages.push({
          role: "assistant",
          content: parsed.summary || `Filled ${parsed.fills.length} slots.`,
        });
      } else {
        messages.push({ role: "assistant", content: res.content || "(empty response)" });
      }
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

  window.StudiesAiChat = {
    init,
    open: () => setOpen(true),
    close: () => setOpen(false),
    clear: clearChat,
    fillOpenDocument,
    openFillComposer,
    runFactCheck,
  };
})();