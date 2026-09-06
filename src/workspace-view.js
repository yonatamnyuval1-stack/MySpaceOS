(function () {
  const frame = document.getElementById("app-frame");
  const frameBack = document.getElementById("frame-back");
  const tabPanels = document.getElementById("app-tab-panels");
  const tabStrip = document.getElementById("app-tab-strip");
  const frameNav = document.getElementById("app-frame-nav");
  const frameUrl = document.getElementById("frame-url");
  const frameGo = document.getElementById("frame-go");
  const frameRefresh = document.getElementById("frame-refresh");
  const tabNewBtn = document.getElementById("tab-new");
  const tabSnapBtn = document.getElementById("tab-snap");
  const appGrid = document.getElementById("app-grid");
  const builtinPanel = document.getElementById("builtin-panel");

  const isElectronWebview =
    window.MySpaceDesktop.isFullDesktop() && navigator.userAgent.includes("Electron");

  let tabs = [];
  let activeTabId = null;
  let tabCounter = 0;
  let snapPair = null; 
  let dragTabId = null;
  let tabDragMoved = false;
  let tabPointerDrag = null;

  function notifyTabsChanged() {
    renderTabStrip();
    updateSnapChrome();
    window.dispatchEvent(new CustomEvent("myspace-tabs-change"));
  }

  function updateSnapChrome() {
    tabSnapBtn?.classList.toggle("active", !!snapPair);
    tabPanels?.classList.toggle("is-split", !!snapPair);
    frame?.classList.toggle("is-split", !!snapPair);
  }

  function applyPanelVisibility() {
    tabPanels.querySelectorAll(".app-tab-panel").forEach((panel) => {
      panel.classList.remove("snap-left", "snap-right", "hidden");
      const id = panel.dataset.tabId;
      if (snapPair) {
        if (id === snapPair.leftId) panel.classList.add("snap-left");
        else if (id === snapPair.rightId) panel.classList.add("snap-right");
        else panel.classList.add("hidden");
      } else {
        panel.classList.toggle("hidden", id !== activeTabId);
      }
    });
  }

  function clearSnap() {
    if (!snapPair) return;
    snapPair = null;
    applyPanelVisibility();
    updateSnapChrome();
    notifyTabsChanged();
  }

  function snapSideBySide(leftId, rightId) {
    if (!leftId || !rightId || leftId === rightId) return false;
    const left = getTab(leftId);
    const right = getTab(rightId);
    if (!left || !right) return false;
    if (left.mode === "external" || right.mode === "external") return false;
    snapPair = { leftId, rightId };
    hideDesktopIcons();
    frame.classList.remove("hidden");
    activeTabId = leftId;
    ensureTabView(left);
    ensureTabView(right);
    applyPanelVisibility();
    updateNavBar();
    notifyTabsChanged();
    [left, right].forEach((t) => {
      if (t.mode !== "embedded") return;
      setEmbeddedVisibility(t, true, { focus: t.id === leftId });
      if (!t.embedded) attachEmbeddedApp(t);
      else syncEmbedBounds(t);
    });
    return true;
  }

  function snapWithNeighbor(tabId) {
    const id = tabId || activeTabId;
    if (!id || tabs.length < 2) return false;
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx < 0) return false;
    const other =
      tabs[idx + 1] ||
      tabs[idx - 1] ||
      tabs.find((t) => t.id !== id && t.mode !== "external");
    if (!other || other.mode === "external") return false;
    const left = tabs[idx];
    if (left.mode === "external") return false;
    return snapSideBySide(left.id, other.id);
  }

  function toggleSnap() {
    if (snapPair) {
      clearSnap();
      return false;
    }
    return snapWithNeighbor(activeTabId);
  }

  function reorderTab(fromId, toId, placeAfter = false) {
    if (!fromId || !toId || fromId === toId) return;
    const from = tabs.findIndex((t) => t.id === fromId);
    let to = tabs.findIndex((t) => t.id === toId);
    if (from < 0 || to < 0) return;
    const [moved] = tabs.splice(from, 1);
    if (from < to) to -= 1;
    const insertAt = placeAfter ? to + 1 : to;
    tabs.splice(Math.max(0, Math.min(tabs.length, insertAt)), 0, moved);
    notifyTabsChanged();
  }

  function clearTabDropMarks() {
    tabStrip?.querySelectorAll(".app-tab--drop, .app-tab--drop-after").forEach((el) => {
      el.classList.remove("app-tab--drop", "app-tab--drop-after");
    });
  }

  function tabDropTargetAt(clientX) {
    if (!tabStrip) return null;
    const buttons = [...tabStrip.querySelectorAll(".app-tab")];
    for (const btn of buttons) {
      const rect = btn.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right) {
        return {
          id: btn.dataset.tabId,
          placeAfter: clientX > rect.left + rect.width / 2,
          el: btn,
        };
      }
    }
    if (!buttons.length) return null;
    const first = buttons[0].getBoundingClientRect();
    if (clientX < first.left) {
      return { id: buttons[0].dataset.tabId, placeAfter: false, el: buttons[0] };
    }
    const last = buttons[buttons.length - 1];
    return { id: last.dataset.tabId, placeAfter: true, el: last };
  }

  function endTabPointerDrag(clientX) {
    const state = tabPointerDrag;
    tabPointerDrag = null;
    if (!state) return;
    state.btn.classList.remove("is-dragging");
    clearTabDropMarks();
    try {
      state.btn.releasePointerCapture?.(state.pointerId);
    } catch {
    }
    if (!state.moved) return;
    tabDragMoved = true;
    const target = tabDropTargetAt(clientX);
    if (target?.id && target.id !== state.tabId) {
      reorderTab(state.tabId, target.id, target.placeAfter);
    }
    setTimeout(() => {
      tabDragMoved = false;
    }, 0);
  }

  function renderTabStrip() {
    if (!tabStrip) return;
    tabStrip.replaceChildren();
    tabs.forEach((tab) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "app-tab";
      if (tab.id === activeTabId && isFrameVisible()) btn.classList.add("active");
      if (snapPair && (tab.id === snapPair.leftId || tab.id === snapPair.rightId)) {
        btn.classList.add("app-tab--snapped");
      }
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", tab.id === activeTabId ? "true" : "false");
      btn.title = `${tab.title || "Tab"} — drag to reorder`;
      btn.draggable = false;
      btn.dataset.tabId = tab.id;

      const label = document.createElement("span");
      label.className = "app-tab-label";
      label.textContent = tab.title || "Tab";
      btn.appendChild(label);

      const close = document.createElement("span");
      close.className = "app-tab-close";
      close.setAttribute("aria-label", "Close tab");
      close.textContent = "×";
      close.addEventListener("pointerdown", (e) => e.stopPropagation());
      close.addEventListener("click", (e) => {
        e.stopPropagation();
        closeTab(tab.id);
      });
      btn.appendChild(close);

      btn.addEventListener("click", (e) => {
        if (tabDragMoved) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (snapPair && (tab.id === snapPair.leftId || tab.id === snapPair.rightId)) {
          activateTab(tab.id);
          if (tab.mode === "embedded") focusEmbeddedApp(tab);
          return;
        }
        if (snapPair) clearSnap();
        if (tab.mode === "external") {
          showWorkspace(tab.id);
        } else {
          showWebWorkspace(tab.id);
        }
      });

      btn.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        if (e.target.closest?.(".app-tab-close")) return;
        tabPointerDrag = {
          tabId: tab.id,
          btn,
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          moved: false,
        };
        dragTabId = tab.id;
        try {
          btn.setPointerCapture(e.pointerId);
        } catch {
        }
      });

      btn.addEventListener("pointermove", (e) => {
        const state = tabPointerDrag;
        if (!state || state.tabId !== tab.id || state.pointerId !== e.pointerId) return;
        const dx = e.clientX - state.startX;
        const dy = e.clientY - state.startY;
        if (!state.moved && Math.hypot(dx, dy) < 5) return;
        if (!state.moved) {
          state.moved = true;
          tabDragMoved = true;
          btn.classList.add("is-dragging");
        }
        clearTabDropMarks();
        const target = tabDropTargetAt(e.clientX);
        if (target?.el && target.id !== state.tabId) {
          target.el.classList.add(target.placeAfter ? "app-tab--drop-after" : "app-tab--drop");
        }
      });

      btn.addEventListener("pointerup", (e) => {
        if (!tabPointerDrag || tabPointerDrag.pointerId !== e.pointerId) return;
        endTabPointerDrag(e.clientX);
      });
      btn.addEventListener("pointercancel", (e) => {
        if (!tabPointerDrag || tabPointerDrag.pointerId !== e.pointerId) return;
        endTabPointerDrag(e.clientX);
      });

      btn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.MySpaceContextMenu || !window.MySpaceAppMenu?.buildTabItems) return;
        window.MySpaceContextMenu.show(
          e.clientX,
          e.clientY,
          window.MySpaceAppMenu.buildTabItems(tab),
          (action) => window.MySpaceAppMenu.handleTabAction(action, tab)
        );
      });

      tabStrip.appendChild(btn);
    });
  }

  function normalizeUrl(raw) {
    const url = String(raw || "").trim();
    if (!url) return null;
    if (/^(https?|file|about):/i.test(url)) return url;
    if (/^(localhost)(:\d+)?(\/.*)?$/i.test(url)) return `http://${url}`;
    if (/^[\w.-]+\.[a-z]{2,}([/:].*)?$/i.test(url)) return `https://${url}`;
    return null;
  }

  function looksLikeUrlQuery(raw) {
    const q = String(raw || "").trim();
    if (!q) return false;
    if (/^(https?|file|about):/i.test(q)) return true;
    if (/^(localhost)(:\d+)?(\/.*)?$/i.test(q)) return true;
    if (/^[\w.-]+\.[a-z]{2,}([/:].*)?$/i.test(q)) return true;
    return false;
  }

  function scoreOmni(hay, q) {
    const h = String(hay || "").toLowerCase();
    if (!q) return 1;
    if (h === q) return 100;
    if (h.startsWith(q)) return 80;
    if (h.includes(q)) return 50;
    return 0;
  }

  function buildOmniSuggestions(query, extraResults = []) {
    const q = String(query || "").trim().toLowerCase();
    const out = [];
    const browserMode = isMyspaceBrowserTab(getActiveTab());
    const apps = (window.MySpaceConfig?.getApps?.() || []).filter((a) => a.id !== "welcome" && !a.hidden);
    for (const app of apps) {
      const hay = [app.name, app.id, app.module, app.description].filter(Boolean).join(" ");
      const rank = scoreOmni(hay, q);
      if (!q || rank > 0) {
        out.push({
          kind: "app",
          id: "app:" + app.id,
          title: app.name,
          subtitle: app.description || app.type || "App",
          rank: rank + (window.MySpaceConfig?.isPinnedToTaskbar?.(app.id) ? 5 : 0),
          app,
        });
      }
    }

    const actions = [
      { id: "action:desktop", title: "Show desktop", subtitle: "Minimize windows", keywords: "desktop home" },
      { id: "action:settings", title: "Settings", subtitle: "My Space settings", keywords: "settings" },
      { id: "action:palette", title: "Command palette", subtitle: "Ctrl+K", keywords: "palette command" },
    ];
    for (const a of actions) {
      const rank = scoreOmni(`${a.title} ${a.subtitle} ${a.keywords}`, q);
      if (!q || rank > 0) out.push({ ...a, kind: "action", rank });
    }

    for (const item of extraResults || []) {
      if (!item?.title) continue;
      out.push({
        ...item,
        rank: (item.rank || 40) + (browserMode ? 8 : 0),
      });
    }

    if (q && looksLikeUrlQuery(q)) {
      out.unshift({
        kind: "url",
        id: "url:" + q,
        title: `Open ${q}`,
        subtitle: "Website",
        rank: 120,
        url: normalizeUrl(q),
      });
    } else if (q.length >= 2) {
      out.push({
        kind: "web",
        id: "web:" + q,
        title: `Search the web for “${q}”`,
        subtitle: browserMode ? "Google · in My Space Browser" : "Optional: Google",
        rank: browserMode ? 20 : 5,
        url: `https://www.google.com/search?q=${encodeURIComponent(q)}`,
      });
    }

    out.sort((a, b) => b.rank - a.rank || a.title.localeCompare(b.title));
    return out.slice(0, browserMode ? 20 : 8);
  }

  let omniSearchTimer = null;
  let omniSearchToken = 0;

  function scheduleOmniContentSearch(query) {
    if (omniSearchTimer) clearTimeout(omniSearchTimer);
    const q = String(query || "").trim();
    const browserMode = isMyspaceBrowserTab(getActiveTab());
    renderOmniSuggest(query, []);
    if (q.length < 2 || !browserMode) return;
    const token = ++omniSearchToken;
    omniSearchTimer = setTimeout(async () => {
      try {
        const res = await window.mySpace?.desktopSearch?.(q, { mode: "browser" });
        if (token !== omniSearchToken) return;
        renderOmniSuggest(query, res?.ok ? res.results || [] : []);
      } catch {
        if (token === omniSearchToken) renderOmniSuggest(query, []);
      }
    }, 100);
  }

  function isFileUrl(url) {
    return typeof url === "string" && /^file:/i.test(url);
  }

  function hideDesktopIcons() {
    appGrid.classList.add("hidden");
    builtinPanel.classList.add("hidden");
  }

  function createTabId() {
    tabCounter += 1;
    return `tab-${tabCounter}`;
  }

  function getActiveTab() {
    return tabs.find((t) => t.id === activeTabId) || null;
  }

  function getTab(tabId) {
    return tabs.find((t) => t.id === tabId) || null;
  }

  function isFrameVisible() {
    return !frame.classList.contains("hidden");
  }

  function updateNavBar() {
    const tab = getActiveTab();
    const showUrlBar = tab?.mode === "webview";
    frameNav.classList.toggle("hidden", !showUrlBar);
    if (showUrlBar && tab) {
      frameUrl.value = tab.url && tab.url !== "about:blank" ? tab.url : "";
    }
  }

  function activateTab(tabId) {
    if (!tabs.some((t) => t.id === tabId)) return;
    const prevId = activeTabId;
    activeTabId = tabId;
    if (snapPair && tabId !== snapPair.leftId && tabId !== snapPair.rightId) {
      snapPair = null;
    }
    applyPanelVisibility();
    updateNavBar();
    notifyTabsChanged();

    tabs.forEach((t) => {
      if (t.mode !== "embedded") return;
      const on =
        isFrameVisible() &&
        (snapPair
          ? t.id === snapPair.leftId || t.id === snapPair.rightId
          : t.id === tabId);
      setEmbeddedVisibility(t, on, { focus: on && t.id === tabId });
    });

    const tab = getTab(tabId);
    if (tab?.module === "shell-console" && typeof tab.viewEl?.executeJavaScript === "function") {
      try {
        tab.viewEl.executeJavaScript(`window.ConsoleApp?.refreshAll?.()`, false);
      } catch {
      }
    }

    const prev = getTab(prevId);
    if (prev && prev.id !== tabId) void refreshPeekCache(prev);
    if (tab) {
      setTimeout(() => {
        if (activeTabId === tabId) void refreshPeekCache(tab);
      }, 300);
    }
  }

  async function refreshPeekCache(tab) {
    if (!tab) return;
    if (tab.mode !== "myapp" && tab.mode !== "webview") return;
    try {
      ensureTabView(tab);
      if (!tab.viewEl || typeof tab.viewEl.capturePage !== "function") return;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const image = await tab.viewEl.capturePage();
      const url = image?.toDataURL?.();
      if (url) tab.peekDataUrl = url;
    } catch {
    }
  }

  function ensureTabView(tab) {
    if (!tab || tab.mode === "external" || tab.mode === "embedded" || tab.mode === "panel") return;
    const panel = tabPanels.querySelector(`[data-tab-id="${tab.id}"]`);
    if (!panel) return;
    const connected = tab.viewEl && tab.viewEl.isConnected;
    if (connected) return;
    panel.replaceChildren();
    const view = isElectronWebview
      ? createWebviewElement(tab.url, tab, { preload: tab.preload || null })
      : createIframeElement(tab.url);
    tab.viewEl = view;
    tab._reloadAttempted = false;
    panel.appendChild(view);
  }

  function showWebWorkspace(tabId) {
    if (!tabs.length) return;
    hideDesktopIcons();
    frame.classList.remove("hidden");
    const targetId =
      tabId ||
      (activeTabId && tabs.some((t) => t.id === activeTabId) ? activeTabId : tabs[tabs.length - 1].id);
    const tab = getTab(targetId);
    ensureTabView(tab);
    activateTab(targetId);
  }

  async function showExternalApp(tabId) {
    const tab = getTab(tabId);
    if (!tab || tab.mode !== "external") return;
    showWebWorkspace(tab.id);
  }

  function showWorkspace(tabId) {
    const tab = tabId ? getTab(tabId) : getActiveTab();
    if (tab?.mode === "external") {
      showExternalApp(tab.id);
      return;
    }
    showWebWorkspace(tabId);
    if (tab?.mode === "embedded") {
      setEmbeddedVisibility(tab, true, { focus: true });
      if (!tab.embedded) attachEmbeddedApp(tab);
      else {
        syncEmbedBounds(tab);
        focusEmbeddedApp(tab);
      }
    }
  }

  async function minimizeToDesktop() {
    clearSnap();
    tabs.forEach((t) => {
      if (t.mode === "embedded") setEmbeddedVisibility(t, false);
    });
    await Promise.allSettled(
      tabs
        .filter((t) => t.mode === "myapp" || t.mode === "webview")
        .map((t) => refreshPeekCache(t))
    );
    frame.classList.add("hidden");
    appGrid.classList.remove("hidden");
    builtinPanel.classList.add("hidden");
    notifyTabsChanged();
    if (typeof window.onMySpaceDesktopShown === "function") {
      window.onMySpaceDesktopShown();
    }
  }

  async function openInSystemBrowser(url) {
    if (!url || !window.mySpace?.openSystemUrl) return;
    try {
      await window.mySpace.openSystemUrl(url);
    } catch {
      window.showMySpaceToast?.("Could not open in your browser");
    }
  }

  async function autoFocusExternal(exePath) {
    if (!exePath || !window.mySpace?.focusExternalApp) return;
    try {
      await window.mySpace.focusExternalApp(exePath);
    } catch {
    }
  }

  function applyRouteToTab(tab, route) {
    if (!tab || tab.mode !== "myapp" || !route) return;
    const moduleId =
      tab.module ||
      window.MySpaceConfig?.getApps()?.find((a) => a.id === tab.appId)?.module ||
      null;
    if (!moduleId) return;
    tab.module = moduleId;
    if (route.page) {
      tab.lastPage = route.page;
      if (tab.appId && window.MySpaceAppPrefs?.set) {
        window.MySpaceAppPrefs.set(tab.appId, { lastPage: route.page });
      }
    }
    const script = window.MySpaceShellCommands?.buildRouteScript(moduleId, route);
    if (!script || !tab.viewEl) return;

    const run = () => {
      try {
        if (typeof tab.viewEl.executeJavaScript === "function") {
          tab.viewEl.executeJavaScript(script, false);
        }
      } catch {
      }
    };

    try {
      const currentUrl = tab.viewEl.getURL?.();
      if (currentUrl && currentUrl !== "about:blank") {
        setTimeout(run, 120);
        setTimeout(run, 450);
      } else {
        tab.viewEl.addEventListener("did-finish-load", () => setTimeout(run, 120), { once: true });
      }
    } catch {
      tab.viewEl.addEventListener("did-finish-load", () => setTimeout(run, 120), { once: true });
    }
  }

  function chromeDesktopUa() {
    return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";
  }

  function firefoxDesktopUa() {
    return "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0";
  }

  function needsChromeDesktopUa(url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      return /(^|\.)whatsapp\.com$|(^|\.)telegram\.org$|(^|\.)discord\.com$|(^|\.)messenger\.com$|(^|\.)instagram\.com$|(^|\.)x\.com$|(^|\.)twitter\.com$|(^|\.)outlook\.live\.com$|(^|\.)outlook\.office\.com$|(^|\.)office\.com$|(^|\.)microsoft\.com$|(^|\.)live\.com$|(^|\.)yahoo\.com$|(^|\.)slack\.com$|(^|\.)linkedin\.com$|(^|\.)teams\.microsoft\.com$|(^|\.)google\.com$|(^|\.)gmail\.com$/.test(
        host
      );
    } catch {
      return false;
    }
  }

  function userAgentForUrl(url) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (host.includes("google.") || host.includes("gmail.") || host.endsWith("google.com")) {
        return firefoxDesktopUa();
      }
    } catch {
    }
    return chromeDesktopUa();
  }

  function persistPartitionForUrl(url) {
    try {
      if (isFileUrl(url) && String(url).includes("myspace-browser")) {
        return "persist:connect-myspace-browser-v1";
      }
      const host = new URL(url).hostname.replace(/^www\./, "");
      if (host.includes("whatsapp")) return "persist:connect-whatsapp-v3";
      if (host.includes("telegram")) return "persist:connect-telegram-v3";
      if (host.includes("discord")) return "persist:connect-discord-v3";
      if (host.includes("messenger")) return "persist:connect-messenger-v3";
      if (host.includes("instagram")) return "persist:connect-instagram-v3";
      if (host === "x.com" || host.includes("twitter")) return "persist:connect-x-v3";
      if (host.includes("facebook")) return "persist:connect-facebook-v1";
      if (host.includes("reddit")) return "persist:connect-reddit-v1";
      if (host.includes("tiktok")) return "persist:connect-tiktok-v1";
      if (host.includes("outlook") || host.includes("live.com") || host.includes("office.com")) {
        return "persist:connect-outlook-v3";
      }
      if (host.includes("yahoo")) return "persist:connect-yahoo-v3";
      if (host.includes("slack")) return "persist:connect-slack-v3";
      if (host.includes("linkedin")) return "persist:connect-linkedin-v3";
      if (host.includes("teams")) return "persist:connect-teams-v3";
      if (host.includes("bing.") || host.includes("msn.")) return "persist:connect-edge-v1";
      if (host.includes("chatgpt") || host.includes("openai")) return "persist:connect-chatgpt-v1";
      if (host.includes("claude.ai") || host.includes("anthropic")) return "persist:connect-claude-v1";
      if (host.includes("gemini.google")) return "persist:connect-gemini-v1";
      if (host.includes("youtube") || host === "youtu.be") return "persist:connect-youtube-v1";
      if (host.includes("spotify")) return "persist:connect-spotify-v1";
      if (host.includes("netflix")) return "persist:connect-netflix-v1";
      if (host.includes("github")) return "persist:connect-github-v1";
      if (host.includes("notion")) return "persist:connect-notion-v1";
      if (host.includes("drive.google")) return "persist:connect-drive-v1";
      if (host.includes("onedrive") || host.includes("sharepoint")) return "persist:connect-onedrive-v1";
      if (host === "127.0.0.1" || host === "localhost") return "persist:connect-ollama-v1";
      if (host.includes("mail.google") || host.startsWith("gmail.") || host.includes("accounts.google")) {
        return "persist:connect-gmail-v4";
      }
      if (host.includes("google")) return "persist:connect-browser-v1";
    } catch {
    }
    return null;
  }

  function tabAllowsInApp(tab) {
    return (
      tab?.forceInApp === true ||
      (tab?.appId && String(tab.appId).startsWith("connect-"))
    );
  }

  function escapePanel(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function externalShellIconHtml(tab) {
    if (tab.iconSrc && (String(tab.iconSrc).startsWith("http") || String(tab.iconSrc).startsWith("data:"))) {
      return `<img src="${escapePanel(tab.iconSrc)}" alt="" />`;
    }
    if (tab.iconSrc && !String(tab.iconSrc).includes("/")) {
      return escapePanel(tab.iconSrc);
    }
    return "🪟";
  }

  function renderExternalShellPanel(tab, app) {
    const name = escapePanel(app?.name || tab.title || "App");
    const canRetryEmbed = tab.embedFailed === true && !!tab.externalPath;
    return `<div class="app-external-panel">
      <div class="external-icon">${externalShellIconHtml(tab)}</div>
      <h2>${name}</h2>
      <p class="external-hint">This app cannot open inside My Space, so it runs in its own window. This tab stays in the shell so you can focus it, reopen it, or return here anytime.</p>
      ${tab.externalPath ? `<p class="external-path">${escapePanel(tab.externalPath)}</p>` : ""}
      ${tab.systemUrl ? `<p class="external-path">${escapePanel(tab.systemUrl)}</p>` : ""}
      <div class="external-actions">
        <button type="button" class="mail-btn mail-btn-primary" data-action="focus">${tab.systemUrl ? "Open link" : "Focus app"}</button>
        ${tab.externalPath ? `<button type="button" class="mail-btn" data-action="open">Open again</button>` : ""}
        ${canRetryEmbed ? `<button type="button" class="mail-btn" data-action="retry-embed">Try inside My Space</button>` : ""}
      </div>
    </div>`;
  }

  function bindExternalShellPanel(panel, tab, app) {
    panel.querySelector('[data-action="focus"]')?.addEventListener("click", () => {
      void focusExternalShell(tab);
    });
    panel.querySelector('[data-action="open"]')?.addEventListener("click", () => {
      void launchExternalShell(tab);
    });
    panel.querySelector('[data-action="retry-embed"]')?.addEventListener("click", () => {
      void retryEmbeddedFromShell(tab, app);
    });
  }

  async function focusExternalShell(tab) {
    if (tab.systemUrl) {
      await openInSystemBrowser(tab.systemUrl);
      return;
    }
    if (!tab.externalPath) return;
    try {
      const res = await window.mySpace?.focusExternalApp?.(tab.externalPath);
      if (!res?.ok) await launchExternalShell(tab);
    } catch {
      await launchExternalShell(tab);
    }
  }

  async function launchExternalShell(tab) {
    if (tab.systemUrl) {
      await openInSystemBrowser(tab.systemUrl);
      return;
    }
    if (!tab.externalPath) return;
    try {
      await window.mySpace?.embedApp?.fallbackExternal?.({ id: tab.embedId, path: tab.externalPath });
    } catch {
      try {
        await window.mySpace?.focusExternalApp?.(tab.externalPath);
      } catch {
        window.showMySpaceToast?.("Could not open app");
      }
    }
  }

  function applyExternalShellPanel(tab, app) {
    if (!tab?.panelEl) return;
    tab.panelEl.className = "app-tab-panel hidden app-tab-panel--external";
    tab.panelEl.innerHTML = renderExternalShellPanel(tab, app || tab._anchorApp);
    bindExternalShellPanel(tab.panelEl, tab, app || tab._anchorApp);
    tab.hostEl = null;
    tab.statusEl = null;
  }

  function enterExternalShellProtocol(tab, options = {}) {
    if (!tab) return tab;
    stopEmbedWatch(tab);
    tab.mode = "external";
    tab.embedded = false;
    tab.protocol = "external-shell";
    tab.embedFailed = options.embedFailed === true;
    tab.skipAutoFocus = true;
    tab.autoLaunch = options.autoLaunch !== false;
    if (options.path) tab.externalPath = options.path;
    if (options.app) tab._anchorApp = options.app;
    applyExternalShellPanel(tab, tab._anchorApp);
    showWebWorkspace(tab.id);
    notifyTabsChanged();
    if (tab.autoLaunch && (tab.externalPath || tab.systemUrl)) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          void launchExternalShell(tab);
        }, 200);
      });
    }
    return tab;
  }

  async function retryEmbeddedFromShell(tab, app) {
    if (!tab.externalPath) return;
    tab.mode = "embedded";
    tab.embedFailed = false;
    tab.embedded = false;
    tab.protocol = null;
    tab.embedId = tab.embedId || `embed-${tab.appId || tab.id}`;
    if (tab.panelEl) {
      tab.panelEl.className = "app-tab-panel hidden app-tab-panel--embedded";
      tab.panelEl.replaceChildren();
      const host = document.createElement("div");
      host.className = "app-embed-host";
      host.tabIndex = -1;
      host.title = "Click to focus this app";
      host.addEventListener("pointerdown", () => {
        if (tab.embedded) focusEmbeddedApp(tab);
      });
      tab.hostEl = host;
      const status = document.createElement("div");
      status.className = "app-embed-status";
      status.textContent = "Opening inside My Space…";
      tab.statusEl = status;
      host.appendChild(status);
      tab.panelEl.appendChild(host);
    }
    showWebWorkspace(tab.id);
    await attachEmbeddedApp(tab);
  }

  function isMyspaceBrowserTab(tab) {
    return tab?.appId === "connect-myspace-browser";
  }

  let browserHomeCache = null;
  async function getBrowserHome() {
    if (browserHomeCache?.ok) return browserHomeCache;
    try {
      browserHomeCache = await window.mySpace?.getMyspaceBrowserHome?.();
    } catch {
      browserHomeCache = null;
    }
    return browserHomeCache;
  }

  function preloadAttrValue(preload) {
    if (!preload) return null;
    const raw = String(preload);
    if (/^file:/i.test(raw)) {
      try {
        const u = new URL(raw);
        let p = decodeURIComponent(u.pathname || "");
        if (/^\/[A-Za-z]:\//.test(p)) p = p.slice(1);
        return p.replace(/\//g, "\\");
      } catch {
        return raw;
      }
    }
    return raw;
  }

  function createWebviewElement(url, tab, options = {}) {
    const el = document.createElement("webview");
    el.className = "app-frame-view";
    el.setAttribute("allowpopups", "");
    const preloadPath = preloadAttrValue(options.preload);
    if (preloadPath) {
      el.setAttribute("preload", preloadPath);
    }
    const partition = options.partition || (url ? persistPartitionForUrl(url) : null);
    if (partition) el.setAttribute("partition", partition);
    const ua = options.userAgent || (url && needsChromeDesktopUa(url) ? userAgentForUrl(url) : null);
    if (ua) el.setAttribute("useragent", ua);
    el.setAttribute(
      "webpreferences",
      preloadPath || isFileUrl(url)
        ? "contextIsolation=true,nodeIntegration=false,sandbox=false,webSecurity=false,webviewTag=true"
        : "contextIsolation=true,nodeIntegration=false"
    );
    if (url) {
      el.src = url;
    }
    el.addEventListener("dom-ready", () => {
      try {
        if (ua && typeof el.setUserAgent === "function") {
          el.setUserAgent(ua);
        }
      } catch {
      }
    });
    el.addEventListener("did-finish-load", () => {
      if (tab?.pendingRoute && tab.mode === "myapp") {
        applyRouteToTab(tab, tab.pendingRoute);
        tab.pendingRoute = null;
      }
      if (tab && (tab.mode === "myapp" || tab.mode === "webview")) {
        setTimeout(() => void refreshPeekCache(tab), 200);
      }
    });
    el.addEventListener("did-fail-load", (e) => {
      if (e.isMainFrame === false) return;
      if (tab?._reloadAttempted) return;
      tab._reloadAttempted = true;
      setTimeout(() => {
        try {
          if (typeof el.reload === "function") el.reload();
          else el.src = url;
        } catch {
        }
      }, 300);
    });
    el.addEventListener("ipc-message", (e) => {
      if (e.channel === "myspace-browser-open") {
        openBrowserSearchResult(e.args?.[0]);
        return;
      }
      if (e.channel === "myspace-browser-navigate") {
        const next = e.args?.[0]?.url || e.args?.[0];
        if (next) applyOmniUrl(String(next), { forceInApp: true });
      }
    });
    el.addEventListener("new-window", (e) => {
      const inShell = tab?.forceInApp === true || (tab?.appId && String(tab.appId).startsWith("connect-"));
      if (inShell) {
        openWeb(e.url, "Page", {
          reuse: false,
          forceInApp: true,
          iconSrc: window.MySpaceIcons?.faviconUrlForSite(e.url),
        });
        return;
      }
      if (window.MySpaceAppRules?.isUnsafeWebviewUrl(e.url)) {
        openInSystemBrowser(e.url);
        return;
      }
      openWeb(e.url, "Page", { reuse: false, iconSrc: window.MySpaceIcons?.faviconUrlForSite(e.url) });
    });
    el.addEventListener("page-title-updated", (e) => {
      if (tab && e.title) {
        tab.title = e.title.slice(0, 40);
        notifyTabsChanged();
      }
    });
    return el;
  }

  function createIframeElement(url) {
    const el = document.createElement("iframe");
    el.className = "app-frame-view";
    el.title = "App";
    if (url) el.src = url;
    return el;
  }

  function createWebPanel(tab, options = {}) {
    const panel = document.createElement("div");
    panel.className = "app-tab-panel hidden";
    panel.dataset.tabId = tab.id;
    const view = isElectronWebview
      ? createWebviewElement(tab.url, tab, { preload: options.preload })
      : createIframeElement(tab.url);
    tab.viewEl = view;
    if (options.preload) tab.preload = options.preload;
    if (!tab.mode) {
      tab.mode = options.preload ? "myapp" : "webview";
    }
    panel.appendChild(view);
    return panel;
  }

  function createExternalPanel(tab, app, result, options = {}) {
    const panel = document.createElement("div");
    panel.className = "app-tab-panel hidden app-tab-panel--external";
    panel.dataset.tabId = tab.id;
    tab.mode = "external";
    tab.protocol = "external-shell";
    tab.externalPath = result.path || tab.externalPath || "";
    tab.systemUrl = result.systemUrl || tab.systemUrl || null;
    tab.iconSrc = tab.iconSrc || app?.iconData || result.iconData;
    tab.panelEl = panel;
    tab._anchorApp = app || null;
    tab.autoLaunch = options.autoLaunch !== false && result.autoLaunch !== false;
    tab.embedFailed = !!options.embedFailed;
    panel.innerHTML = renderExternalShellPanel(tab, app);
    bindExternalShellPanel(panel, tab, app);
    return panel;
  }

  function panelBounds(el) {
    if (!el) return { x: 0, y: 0, width: 800, height: 600 };
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.left),
      y: Math.round(r.top),
      width: Math.max(50, Math.round(r.width)),
      height: Math.max(50, Math.round(r.height)),
    };
  }

  function stopEmbedWatch(tab) {
    if (tab?._embedRo) {
      try {
        tab._embedRo.disconnect();
      } catch {
      }
      tab._embedRo = null;
    }
    if (tab?._embedResizeHandler) {
      window.removeEventListener("resize", tab._embedResizeHandler);
      tab._embedResizeHandler = null;
    }
    if (tab?._embedBoundsTimer) {
      clearTimeout(tab._embedBoundsTimer);
      tab._embedBoundsTimer = null;
    }
  }

  async function syncEmbedBounds(tab) {
    if (!tab?.embedId || !tab.hostEl || !window.mySpace?.embedApp?.updateBounds) return;
    if (tab.mode !== "embedded" || !tab.embedded) return;
    const bounds = panelBounds(tab.hostEl);
    try {
      const res = await window.mySpace.embedApp.updateBounds({ id: tab.embedId, bounds });
      if (res?.gone) {
        tab.embedded = false;
        await fallbackEmbeddedToExternal(tab, "The embedded window closed.");
      }
    } catch {
    }
  }

  function scheduleEmbedBounds(tab) {
    if (!tab) return;
    if (tab._embedBoundsTimer) clearTimeout(tab._embedBoundsTimer);
    tab._embedBoundsTimer = setTimeout(() => {
      tab._embedBoundsTimer = null;
      syncEmbedBounds(tab);
    }, 50);
  }

  function startEmbedWatch(tab) {
    stopEmbedWatch(tab);
    if (!tab?.hostEl) return;
    const sync = () => scheduleEmbedBounds(tab);
    tab._embedResizeHandler = sync;
    window.addEventListener("resize", sync);
    if (typeof ResizeObserver !== "undefined") {
      tab._embedRo = new ResizeObserver(sync);
      tab._embedRo.observe(tab.hostEl);
    }
  }

  async function fallbackEmbeddedToExternal(tab, _message) {
    if (!tab || tab._embedFallingBack) return;
    tab._embedFallingBack = true;
    try {
      if (tab.embedId) await window.mySpace?.embedApp?.stop?.({ id: tab.embedId, close: false });
    } catch {
    }
    enterExternalShellProtocol(tab, {
      embedFailed: true,
      autoLaunch: true,
      path: tab.externalPath,
      app: tab._anchorApp,
    });
    tab._embedFallingBack = false;
  }

  async function attachEmbeddedApp(tab) {
    if (!tab || tab.mode !== "embedded" || !tab.externalPath) return;
    if (!window.mySpace?.embedApp?.start) {
      await fallbackEmbeddedToExternal(tab, "Window embedding is unavailable on this system.");
      return;
    }
    if (tab.statusEl) {
      tab.statusEl.classList.remove("hidden");
      tab.statusEl.textContent = "Opening inside My Space…";
    }
    const bounds = panelBounds(tab.hostEl || tab.panelEl);
    const embedId = tab.embedId || `embed-${tab.appId || tab.id}`;
    tab.embedId = embedId;
    try {
      const res = await window.mySpace.embedApp.start({
        id: embedId,
        path: tab.externalPath,
        bounds,
      });
      if (!res?.ok) {
        await fallbackEmbeddedToExternal(
          tab,
          res?.error || "Could not embed this app inside My Space."
        );
        return;
      }
      tab.embedded = true;
      if (tab.statusEl) tab.statusEl.classList.add("hidden");
      if (tab.hostEl) tab.hostEl.classList.add("is-live");
      startEmbedWatch(tab);
      await syncEmbedBounds(tab);
      if (tab.id === activeTabId) await focusEmbeddedApp(tab);
    } catch (err) {
      await fallbackEmbeddedToExternal(
        tab,
        err?.message || "Could not embed this app inside My Space."
      );
    }
  }

  async function focusEmbeddedApp(tab) {
    if (!tab?.embedId || !tab.embedded || !window.mySpace?.embedApp?.focus) return;
    if (window.MySpaceAiChat?.isOpen?.()) return;
    try {
      await window.mySpace.embedApp.focus({ id: tab.embedId });
    } catch {
    }
  }

  async function setEmbeddedVisibility(tab, visible, { focus = false } = {}) {
    if (!tab?.embedId || !window.mySpace?.embedApp?.setVisible) return;
    const wantFocus = !!(visible && focus && !window.MySpaceAiChat?.isOpen?.());
    try {
      const res = await window.mySpace.embedApp.setVisible({
        id: tab.embedId,
        visible,
        focus: wantFocus,
      });
      if (res?.gone && visible) {
        tab.embedded = false;
        await fallbackEmbeddedToExternal(tab, "The embedded window closed.");
        return;
      }
    } catch {
    }
    if (visible) {
      await syncEmbedBounds(tab);
      if (wantFocus) await focusEmbeddedApp(tab);
    }
  }

  async function destroyEmbeddedApp(tab) {
    stopEmbedWatch(tab);
    if (!tab?.embedId || !window.mySpace?.embedApp?.stop) return;
    try {
      await window.mySpace.embedApp.stop({ id: tab.embedId, close: true });
    } catch {
    }
    tab.embedded = false;
  }

  function createEmbeddedPanel(tab, app, result) {
    const panel = document.createElement("div");
    panel.className = "app-tab-panel hidden app-tab-panel--embedded";
    panel.dataset.tabId = tab.id;
    tab.mode = "embedded";
    tab.externalPath = result.path || tab.externalPath || "";
    tab.iconSrc = tab.iconSrc || app.iconData || result.iconData;
    tab.embedId = `embed-${app.id || tab.id}`;
    tab.panelEl = panel;
    tab._anchorApp = app || null;

    const host = document.createElement("div");
    host.className = "app-embed-host";
    host.tabIndex = -1;
    host.title = "Click to focus this app";
    host.addEventListener("pointerdown", () => {
      if (tab.embedded) focusEmbeddedApp(tab);
    });
    tab.hostEl = host;

    const status = document.createElement("div");
    status.className = "app-embed-status";
    status.textContent = "Opening inside My Space…";
    tab.statusEl = status;

    host.appendChild(status);
    panel.appendChild(host);
    return panel;
  }

  function openEmbedded(app, result, options = {}) {
    const { appId, reuse = true } = options;

    if (reuse && appId) {
      const existing = findTabForApp(appId, "embedded");
      if (existing) {
        showWebWorkspace(existing.id);
        setEmbeddedVisibility(existing, true);
        if (!existing.embedded) attachEmbeddedApp(existing);
        return existing;
      }
    }

    const tab = {
      id: createTabId(),
      title: app.name,
      mode: "embedded",
      appId: appId || app.id || null,
      iconSrc: initialIcon(app, options.iconSrc || result.iconData),
      externalPath: result.path || "",
      embedId: `embed-${appId || app.id || "app"}`,
      _anchorApp: app || null,
    };
    addTab(tab, createEmbeddedPanel(tab, app, result));
    return tab;
  }
  function openPanel(options = {}) {
    const {
      appId = null,
      title = "Panel",
      iconSrc = null,
      iconEmoji = "📄",
      reuse = true,
      rebuild = false,
      buildContent,
    } = options;

    if (reuse && appId) {
      const existing = findTabForApp(appId, "panel");
      if (existing) {
        if (rebuild && typeof buildContent === "function") {
          const panel = tabPanels.querySelector(`[data-tab-id="${existing.id}"]`);
          if (panel) {
            panel.replaceChildren();
            const content = buildContent(existing, panel);
            if (content) panel.appendChild(content);
          }
          if (iconSrc) {
            existing.iconSrc = iconSrc;
            existing.iconEmoji = iconEmoji != null ? iconEmoji : null;
          } else if (iconEmoji != null) {
            existing.iconEmoji = iconEmoji;
          }
          notifyTabsChanged();
        }
        showWebWorkspace(existing.id);
        return existing;
      }
    }

    const tab = {
      id: createTabId(),
      title,
      mode: "panel",
      appId,
      iconSrc: iconSrc || null,
      iconEmoji: iconEmoji != null ? iconEmoji : iconSrc ? null : "📄",
    };

    const panel = document.createElement("div");
    panel.className = "app-tab-panel hidden app-tab-panel--panel";
    panel.dataset.tabId = tab.id;

    if (typeof buildContent === "function") {
      const content = buildContent(tab, panel);
      if (content) panel.appendChild(content);
    }

    addTab(tab, panel);
    return tab;
  }

  function addTab(tab, panel) {
    tabs.push(tab);
    tabPanels.appendChild(panel);

    if (tab.mode === "external") {
      showWebWorkspace(tab.id);
      if (tab.autoLaunch !== false) {
        requestAnimationFrame(() => {
          setTimeout(() => {
            void launchExternalShell(tab);
          }, 250);
        });
      }
    } else if (tab.mode === "embedded") {
      showWebWorkspace(tab.id);
      requestAnimationFrame(() => {
        setTimeout(() => attachEmbeddedApp(tab), 50);
      });
    } else {
      showWebWorkspace(tab.id);
    }
    notifyTabsChanged();
  }

  function findTabForApp(appId, mode) {
    if (!appId) return null;
    return tabs.find((t) => t.appId === appId && t.mode === mode);
  }

  function navigateActiveTab(url, options = {}) {
    const tab = getActiveTab();
    if (!tab || tab.mode !== "webview") return;
    const allowInApp = options.forceInApp === true || tabAllowsInApp(tab);
    if (window.MySpaceAppRules?.isUnsafeWebviewUrl(url) && !allowInApp) {
      openInSystemBrowser(url);
      return;
    }

    if (
      isMyspaceBrowserTab(tab) &&
      isFileUrl(tab.url || "") &&
      /^https?:\/\//i.test(String(url || ""))
    ) {
      openWeb(url, titleForWebUrl(url), {
        reuse: true,
        appId: "connect-web-search",
        forceInApp: true,
        iconSrc: window.MySpaceIcons?.faviconUrlForSite(url),
      });
      return;
    }

    tab.url = url;
    if (tab.viewEl) {
      loadWebviewUrl(tab.viewEl, url);
    }
    updateNavBar();
  }

  function titleForWebUrl(url) {
    try {
      const u = new URL(url);
      if (u.hostname.includes("google.") && u.pathname.startsWith("/search")) {
        const q = u.searchParams.get("q");
        return q ? `Search · ${q.slice(0, 40)}` : "Google";
      }
      return u.hostname.replace(/^www\./, "") || "Page";
    } catch {
      return "Page";
    }
  }

  function loadWebviewUrl(viewEl, url) {
    if (!viewEl || !url) return;
    const needUa = !isFileUrl(url) && needsChromeDesktopUa(url);
    const ua = needUa ? userAgentForUrl(url) : null;
    try {
      if (ua && typeof viewEl.setUserAgent === "function") {
        viewEl.setUserAgent(ua);
      }
      if (typeof viewEl.loadURL === "function") {
        viewEl.loadURL(url, ua ? { userAgent: ua } : {});
        return;
      }
    } catch {
    }
    viewEl.src = url;
  }

  function initialIcon(app, iconSrc) {
    return (
      iconSrc ||
      app?.iconData ||
      (app?.icon && (String(app.icon).startsWith("http") || String(app.icon).startsWith("data:"))
        ? app.icon
        : null) ||
      (app ? window.MySpaceIcons?.emojiFallback(app) : null)
    );
  }

  function updateTabIcon(appId, mode, iconSrc) {
    if (!appId || !iconSrc) return;
    const tab = tabs.find((t) => t.appId === appId && t.mode === mode);
    if (tab) {
      tab.iconSrc = iconSrc;
      notifyTabsChanged();
    }
  }

  function openWeb(url, title, options = {}) {
    const { appId, reuse = true, iconSrc, app, forceInApp = false, preload = null } = options;
    const normalized = normalizeUrl(url) || url;
    const allowInApp =
      forceInApp === true || (appId && String(appId).startsWith("connect-"));

    if (
      normalized &&
      !allowInApp &&
      window.MySpaceAppRules?.isUnsafeWebviewUrl(normalized)
    ) {
      openInSystemBrowser(normalized);
      window.showMySpaceToast?.("Opened in your browser (this site cannot run inside My Space).");
      return null;
    }

    const resolvedIcon =
      initialIcon(app, iconSrc) ||
      (normalized ? window.MySpaceIcons?.faviconUrlForSite(normalized) : null);

    let resolvedPreload = preload || null;
    if (!resolvedPreload && appId === "connect-myspace-browser" && isFileUrl(normalized)) {
      resolvedPreload = browserHomeCache?.preload || null;
    }

    if (reuse && appId) {
      const existing = findTabForApp(appId, "webview");
      if (existing) {
        if (existing.url !== normalized && existing.viewEl && normalized) {
          existing.url = normalized;
          loadWebviewUrl(existing.viewEl, normalized);
          existing._reloadAttempted = false;
        }
        if (allowInApp) existing.forceInApp = true;
        if (resolvedPreload) existing.preload = resolvedPreload;
        showWebWorkspace(existing.id);
        return existing;
      }
    }

    const tab = {
      id: createTabId(),
      title: title || "New tab",
      url: normalized || "",
      mode: "webview",
      appId: appId || null,
      iconSrc: resolvedIcon,
      preload: resolvedPreload,
      forceInApp: allowInApp,
    };
    addTab(tab, createWebPanel(tab, { preload: resolvedPreload }));
    return tab;
  }

  function openMyApp(result, app, options = {}) {
    const { appId, reuse = true, iconSrc, route } = options;
    const nextPreload = result.preload || null;

    if (reuse && appId) {
      const existing = findTabForApp(appId, "myapp");
      if (existing) {
        const preloadStale =
          (nextPreload && existing.preload !== nextPreload) || (nextPreload && !existing.preload);
        if (preloadStale) {
          closeTab(existing.id);
        } else {
          if (app.module) existing.module = app.module;
          const nextUrl = result.url || existing.url;
          if (nextUrl && existing.url !== nextUrl && existing.viewEl) {
            existing.url = nextUrl;
            loadWebviewUrl(existing.viewEl, nextUrl);
            existing._reloadAttempted = false;
          }
          if (nextPreload) existing.preload = nextPreload;
          showWebWorkspace(existing.id);
          if (route) applyRouteToTab(existing, route);
          return existing;
        }
      }
    }

    const tab = {
      id: createTabId(),
      title: app.name || "App",
      url: result.url,
      mode: "myapp",
      appId: appId || app.id || null,
      module: app.module || null,
      iconSrc: initialIcon(app, iconSrc) || "📊",
      preload: nextPreload,
      pendingRoute: route || null,
    };
    addTab(tab, createWebPanel(tab, { preload: tab.preload }));
    return tab;
  }

  function openExternal(app, result, options = {}) {
    const { appId, reuse = true, autoLaunch = true } = options;

    if (reuse && appId) {
      const existing = findTabForApp(appId, "external");
      if (existing) {
        existing._anchorApp = app || existing._anchorApp;
        existing.externalPath = result.path || existing.externalPath;
        existing.systemUrl = result.systemUrl || existing.systemUrl;
        applyExternalShellPanel(existing, existing._anchorApp);
        showWebWorkspace(existing.id);
        if (autoLaunch && result.autoLaunch !== false) {
          void launchExternalShell(existing);
        }
        notifyTabsChanged();
        return existing;
      }
    }

    const tab = {
      id: createTabId(),
      title: app.name,
      mode: "external",
      protocol: "external-shell",
      appId: appId || app.id || null,
      iconSrc: initialIcon(app, options.iconSrc || result.iconData),
      externalPath: result.path || "",
      systemUrl: result.systemUrl || null,
      skipAutoFocus: true,
      autoLaunch: autoLaunch && result.autoLaunch !== false,
      _anchorApp: app || null,
    };
    addTab(tab, createExternalPanel(tab, app, result, { autoLaunch: tab.autoLaunch }));
    return tab;
  }

  function openBlankTab() {
    const active = getActiveTab();
    if (isMyspaceBrowserTab(active)) {
      void openMyspaceBrowserTab({ reuse: false });
      frameUrl?.focus();
      return getActiveTab();
    }
    openWeb("", "New tab", { reuse: false });
    frameUrl?.focus();
    return getActiveTab();
  }

  async function openMyspaceBrowserTab(options = {}) {
    const home = await getBrowserHome();
    if (!home?.ok || !home.url) {
      window.showMySpaceToast?.("My Space Browser home is missing");
      return null;
    }
    return openWeb(home.url, home.name || "My Space Browser", {
      reuse: options.reuse !== false,
      appId: "connect-myspace-browser",
      forceInApp: true,
      preload: home.preload || null,
      iconSrc: home.iconUrl || "brand/atom-green.png",
    });
  }

  function closeAllTabs() {
    while (tabs.length) {
      closeTab(tabs[tabs.length - 1].id);
    }
  }

  function closeOtherTabs(keepTabId) {
    [...tabs.filter((t) => t.id !== keepTabId)].forEach((t) => closeTab(t.id));
  }

  function closeTabsForApp(appId) {
    [...tabs.filter((t) => t.appId === appId)].forEach((t) => closeTab(t.id));
  }

  function closeTab(tabId) {
    const index = tabs.findIndex((t) => t.id === tabId);
    if (index === -1) return;

    const tab = tabs[index];
    if (snapPair && (snapPair.leftId === tabId || snapPair.rightId === tabId)) {
      snapPair = null;
    }
    if (tab.mode === "embedded") {
      destroyEmbeddedApp(tab);
    }
    if (tab.viewEl) {
      try {
        tab.viewEl.remove();
      } catch {
      }
    }
    tabPanels.querySelector(`[data-tab-id="${tabId}"]`)?.remove();
    tabs.splice(index, 1);

    if (tabs.length === 0) {
      minimizeToDesktop();
      return;
    }

    if (activeTabId === tabId) {
      const next = tabs[Math.min(index, tabs.length - 1)];
      showWebWorkspace(next.id);
    } else {
      applyPanelVisibility();
      notifyTabsChanged();
    }
  }

  function refreshActiveTab() {
    const tab = getActiveTab();
    if (!tab?.viewEl || (tab.mode !== "webview" && tab.mode !== "myapp")) return;
    if (tab.viewEl.reload) {
      tab.viewEl.reload();
    }
  }

  function hideOmniSuggest() {
    const box = document.getElementById("frame-omni-suggest");
    if (box) {
      box.classList.add("hidden");
      box.innerHTML = "";
    }
  }

  function renderOmniSuggest(query, extraResults = []) {
    const box = document.getElementById("frame-omni-suggest");
    if (!box || !frameUrl) return;
    const items = buildOmniSuggestions(query, extraResults);
    if (!items.length || !String(query || "").trim()) {
      hideOmniSuggest();
      return;
    }
    box.classList.remove("hidden");
    box.innerHTML = items
      .map(
        (item, i) => `
      <button type="button" class="frame-omni-item" data-index="${i}" role="option">
        <strong>${escapeOmni(item.title)}</strong>
        <span>${escapeOmni(item.subtitle || item.kind)}</span>
      </button>`
      )
      .join("");
    box._items = items;
    box.querySelectorAll(".frame-omni-item").forEach((btn) => {
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        chooseOmniItem(items[Number(btn.dataset.index)]);
      });
    });
  }

  function escapeOmni(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function openBrowserSearchResult(item) {
    if (!item) return;
    if (item.kind === "connect-service" && item.serviceId) {
      const url = item.openUrl;
      if (url && String(url).startsWith("myspace://")) {
        await openMyspaceBrowserTab({ reuse: true });
        return;
      }
      if (url) {
        openWeb(url, item.title || "Connect", {
          reuse: true,
          appId: `connect-${item.serviceId}`,
          forceInApp: true,
        });
        return;
      }
    }
    if (item.kind === "app" && item.app) {
      window.__myspaceAiLaunchApp?.(item.app);
      return;
    }
    if (item.kind === "app-info" && item.launchAppId) {
      const app = window.MySpaceConfig?.getApps?.()?.find((a) => a.id === item.launchAppId);
      if (app) window.__myspaceAiLaunchApp?.(app);
      return;
    }
    if (item.kind === "url" || item.kind === "web") {
      applyOmniUrl(item.url, { forceInApp: true });
      return;
    }
    if (item.launchAppId) {
      const launch = window.MySpaceConfig?.getApps?.()?.find((a) => a.id === item.launchAppId);
      if (launch) {
        window.launchMySpaceApp?.(launch);
        return;
      }
    }
    if (item.appId) {
      const app = window.MySpaceConfig?.getApps?.()?.find((a) => a.id === item.appId);
      if (app) {
        window.launchMySpaceApp?.(app, { route: item.route || null });
        return;
      }
    }
    window.showMySpaceToast?.("Could not open result");
  }

  async function chooseOmniItem(item) {
    hideOmniSuggest();
    if (!item) return;
    if (item.kind === "app" && item.app) {
      window.__myspaceAiLaunchApp?.(item.app);
      return;
    }
    if (item.kind === "action") {
      if (item.id === "action:desktop") minimizeToDesktop();
      else if (item.id === "action:settings") window.__myspaceOpenSettings?.();
      else if (item.id === "action:palette") window.__myspaceOpenPalette?.();
      return;
    }
    if (item.kind === "connect-service") {
      await openBrowserSearchResult(item);
      return;
    }
    if (
      item.appId &&
      item.kind !== "url" &&
      item.kind !== "web" &&
      item.kind !== "app"
    ) {
      await openBrowserSearchResult(item);
      return;
    }
    if ((item.kind === "url" || item.kind === "web") && item.url) {
      applyOmniUrl(item.url, isMyspaceBrowserTab(getActiveTab()) ? { forceInApp: true } : {});
    }
  }

  function applyOmniUrl(url, options = {}) {
    if (!url) return;
    const tab = getActiveTab();
    const allowInApp = options.forceInApp === true || tabAllowsInApp(tab);
    if (window.MySpaceAppRules?.isUnsafeWebviewUrl(url) && !allowInApp) {
      openInSystemBrowser(url);
      return;
    }
    if (tab?.mode === "webview") {
      navigateActiveTab(url, { forceInApp: allowInApp });
    } else {
      openWeb(url, "New tab", { reuse: false, forceInApp: allowInApp });
    }
  }

  function goToUrlFromBar() {
    const raw = frameUrl?.value || "";
    const items = buildOmniSuggestions(raw);
    const top = items[0];
    const browserMode = isMyspaceBrowserTab(getActiveTab());
    const trimmed = String(raw).trim();

    if (browserMode && trimmed && !looksLikeUrlQuery(trimmed)) {
      const web = items.find((i) => i.kind === "web" && i.url);
      const strongApp =
        top &&
        (top.kind === "app" || top.kind === "action") &&
        (top.rank || 0) >= 80;
      if (web && !strongApp) {
        hideOmniSuggest();
        applyOmniUrl(web.url, { forceInApp: true });
        return;
      }
    }

    if (top && (top.kind === "app" || top.kind === "action") && trimmed && !looksLikeUrlQuery(raw)) {
      chooseOmniItem(top);
      return;
    }
    const url = normalizeUrl(raw);
    if (url) {
      hideOmniSuggest();
      applyOmniUrl(url, browserMode ? { forceInApp: true } : {});
      return;
    }
    if (top) {
      chooseOmniItem(top);
      return;
    }
    window.showMySpaceToast?.("Type an app name, command, or URL");
  }

  function isTabActiveInTaskbar(tabId) {
    const tab = getTab(tabId);
    if (!tab || tab.id !== activeTabId) return false;
    if (tab.mode === "external") return true;
    return isFrameVisible();
  }

  frameBack?.addEventListener("click", minimizeToDesktop);
  tabNewBtn?.addEventListener("click", () => openBlankTab());
  tabSnapBtn?.addEventListener("click", () => {
    const ok = toggleSnap();
    if (!ok && !snapPair) {
      window.showMySpaceToast?.("Open two apps first, then snap");
    }
  });
  frameGo?.addEventListener("click", () => goToUrlFromBar());
  frameUrl?.addEventListener("input", () => scheduleOmniContentSearch(frameUrl.value));
  frameUrl?.addEventListener("focus", () => {
    if (frameUrl.value.trim()) scheduleOmniContentSearch(frameUrl.value);
  });
  frameUrl?.addEventListener("blur", () => {
    setTimeout(() => hideOmniSuggest(), 150);
  });
  frameUrl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      goToUrlFromBar();
      return;
    }
    if (e.key === "Escape") {
      hideOmniSuggest();
    }
  });
  frameRefresh?.addEventListener("click", () => refreshActiveTab());

  document.addEventListener("keydown", (e) => {
    if (!isFrameVisible()) return;
    if (e.ctrlKey && e.key === "t") {
      e.preventDefault();
      openBlankTab();
    }
    if (e.ctrlKey && e.key === "w") {
      e.preventDefault();
      if (activeTabId) closeTab(activeTabId);
    }
    if (e.key === "F5") {
      e.preventDefault();
      refreshActiveTab();
    }
  });

  function closeActiveWindow() {
    if (!activeTabId) return null;
    const tab = getTab(activeTabId);
    if (!tab) return null;
    const apps = window.MySpaceConfig?.getApps?.() || [];
    const app = apps.find((a) => a.id === tab.appId);
    const name = app?.name || tab.title || "window";
    closeTab(activeTabId);
    return name;
  }

  function isAppOpen(appId) {
    return tabs.some((t) => t.appId === appId);
  }

  function waitForWebviewSettle(viewEl, timeoutMs = 2500) {
    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(done, timeoutMs);
      try {
        if (typeof viewEl.isLoading === "function" && !viewEl.isLoading()) {
          done();
          return;
        }
        viewEl.addEventListener("dom-ready", done, { once: true });
        viewEl.addEventListener("did-finish-load", done, { once: true });
      } catch {
        done();
      }
    });
  }

  async function runInTabView(tab, script) {
    if (!tab?.viewEl) return null;
    if (typeof tab.viewEl.executeJavaScript !== "function") return null;
    try {
      if (typeof tab.viewEl.isLoading === "function" && tab.viewEl.isLoading()) {
        await waitForWebviewSettle(tab.viewEl);
      }
      return await tab.viewEl.executeJavaScript(script, false);
    } catch {
      try {
        await waitForWebviewSettle(tab.viewEl, 1500);
        return await tab.viewEl.executeJavaScript(script, false);
      } catch {
        return null;
      }
    }
  }

  function getAiGuestHandle() {
    const onDesktop = !isFrameVisible();
    if (onDesktop) {
      return {
        ok: false,
        error: "User is on the desktop: no page content to read.",
        view: "desktop",
      };
    }

    const tab = getActiveTab();
    if (!tab) {
      return { ok: false, error: "No active tab." };
    }
    if (tab.mode === "external") {
      return {
        ok: false,
        error: "External Windows apps do not expose page text to My Space.",
        active: summarizeTab(tab),
      };
    }
    if (tab.mode !== "myapp" && tab.mode !== "webview") {
      return { ok: false, error: `Unsupported tab mode: ${tab.mode}`, active: summarizeTab(tab) };
    }
    if (!tab.viewEl) {
      return { ok: false, error: "Active tab has no view element.", active: summarizeTab(tab) };
    }

    let webContentsId = null;
    let isLoading = null;
    let guestUrl = null;
    try {
      if (typeof tab.viewEl.getWebContentsId === "function") {
        webContentsId = tab.viewEl.getWebContentsId();
      }
      if (typeof tab.viewEl.isLoading === "function") {
        isLoading = !!tab.viewEl.isLoading();
      }
      guestUrl = liveUrlForTab(tab);
    } catch (err) {
      return {
        ok: false,
        error: err?.message || String(err),
        active: summarizeTab(tab),
      };
    }

    if (webContentsId == null) {
      return {
        ok: false,
        error: "Guest webContentsId unavailable (webview not attached).",
        active: summarizeTab(tab),
        isLoading,
      };
    }

    return {
      ok: true,
      webContentsId,
      isLoading,
      ready: !!(guestUrl && guestUrl !== "about:blank"),
      active: summarizeTab(tab),
    };
  }

  function liveUrlForTab(tab) {
    if (!tab) return null;
    try {
      if (typeof tab.viewEl?.getURL === "function") {
        const u = tab.viewEl.getURL();
        if (u && u !== "about:blank") return u;
      }
    } catch {
    }
    return tab.url && tab.url !== "about:blank" ? tab.url : null;
  }

  function summarizeTab(tab, extras = {}) {
    const apps = window.MySpaceConfig?.getApps?.() || [];
    const app = apps.find((a) => a.id === tab.appId) || null;
    return {
      tabId: tab.id,
      title: tab.title || null,
      mode: tab.mode,
      appId: tab.appId || null,
      appName: app?.name || null,
      module: tab.module || app?.module || null,
      url: liveUrlForTab(tab),
      externalPath: tab.externalPath || null,
      ...extras,
    };
  }

  const MYAPP_STATE_SCRIPT = `(() => {
    const nav = document.querySelector(".nav-item.active[data-page]");
    const pageEl =
      document.querySelector("section.page.active[data-page], .page.active[data-page]") ||
      document.querySelector("section.page:not([hidden])[data-page], .page:not([hidden])[data-page]");
    const page =
      (nav && nav.dataset.page) ||
      (pageEl && pageEl.dataset.page) ||
      null;
    const pageTitle =
      (document.getElementById("page-title") && document.getElementById("page-title").textContent.trim()) ||
      (document.querySelector("h1") && document.querySelector("h1").textContent.trim()) ||
      (document.title || null);
    const mode =
      (typeof window.StocksApp?.getActiveMode === "function" && window.StocksApp.getActiveMode()) ||
      null;
    const selectedText = String(window.getSelection?.()?.toString?.() || "").trim() || null;
    return {
      page: page || null,
      pageTitle: pageTitle || null,
      documentTitle: document.title || null,
      mode: mode || null,
      selectedText: selectedText ? selectedText.slice(0, 500) : null,
    };
  })()`;

  function pageContentScript(maxChars) {
    const n = Math.min(Math.max(Number(maxChars) || 8000, 500), 20000);
    return `(() => {
      const max = ${n};
      const clean = (s) => String(s || "").replace(/\\s+/g, " ").trim();
      const uniq = (arr) => {
        const out = [];
        const seen = new Set();
        for (const item of arr) {
          const key = String(item).toLowerCase();
          if (!item || seen.has(key)) continue;
          seen.add(key);
          out.push(item);
        }
        return out;
      };
      const headings = uniq(
        Array.from(document.querySelectorAll("h1, h2, h3, [role='heading']"))
          .map((el) => clean(el.innerText || el.textContent))
          .filter((t) => t && t.length < 200)
      ).slice(0, 25);
      const navLabels = uniq(
        Array.from(
          document.querySelectorAll(
            "nav a, nav button, [role='navigation'] a, [role='navigation'] button, header nav a, .nav-item, [data-page].nav-item, aside a, aside button"
          )
        )
          .map((el) => clean(el.innerText || el.textContent || el.getAttribute("aria-label")))
          .filter((t) => t && t.length < 80)
      ).slice(0, 40);
      const activeNav =
        clean(
          document.querySelector(".nav-item.active, [aria-current='page'], a.active, button.active")
            ?.innerText ||
            document.querySelector(".nav-item.active, [aria-current='page']")?.getAttribute("aria-label")
        ) || null;
      const root =
        document.querySelector("main") ||
        document.querySelector(".app-main") ||
        document.querySelector(".content") ||
        document.body;
      let text = String(root?.innerText || document.body?.innerText || "")
        .replace(/[ \\t]+\\n/g, "\\n")
        .replace(/\\n{3,}/g, "\\n\\n")
        .trim();
      const selected = String(window.getSelection?.()?.toString?.() || "").trim();
      const truncated = text.length > max;
      if (truncated) text = text.slice(0, max);

      const flagRe = /flagcdn\\.com\\/(?:[wh]\\d+\\/)?([a-z]{2})(?:[@./?]|$)/i;
      const countries = window.FlagQuizData?.countries || [];
      const byCode = new Map(countries.map((c) => [c.code, c]));

      function decorateImage(img, force) {
        const src = String(img.currentSrc || img.src || img.getAttribute("src") || "").trim();
        if (!src || src.startsWith("data:image/svg")) return null;
        const r = img.getBoundingClientRect();
        const st = window.getComputedStyle(img);
        if (!force) {
          if (r.width < 20 || r.height < 14) return null;
          if (st.display === "none" || st.visibility === "hidden") return null;
        }
        const entry = {
          src: src.slice(0, 500),
          alt: clean(img.alt).slice(0, 120) || null,
          width: Math.round(r.width),
          height: Math.round(r.height),
          id: img.id || null,
          className: clean(img.className).slice(0, 80) || null,
        };
        const fm = src.match(flagRe);
        if (fm) {
          const code = fm[1].toLowerCase();
          entry.flagCode = code;
          const c = byCode.get(code);
          if (c) {
            entry.flagCountry = c.name;
            entry.flagCountryHe = c.nameHe || null;
          }
        }
        return entry;
      }

      const media = [];
      const seenSrc = new Set();
      const pushMedia = (entry) => {
        if (!entry?.src || seenSrc.has(entry.src)) return;
        seenSrc.add(entry.src);
        media.push(entry);
      };

      // Always force-include known focal images (flags etc.) even if layout says 0×0 briefly
      for (const sel of ["#quiz-flag", "img.flag-img", ".flag-frame img", "[data-ai-focal] img", "img[data-ai-focal]"]) {
        document.querySelectorAll(sel).forEach((img) => pushMedia(decorateImage(img, true)));
      }
      Array.from(document.querySelectorAll("img")).forEach((img) => pushMedia(decorateImage(img, false)));
      media.sort((a, b) => b.width * b.height - a.width * a.height);

      const answerChoices = Array.from(
        document.querySelectorAll(".answer-btn, [data-code].answer-btn, .answers button")
      )
        .map((el) => ({
          label: clean(el.innerText || el.textContent),
          code: el.dataset?.code || null,
        }))
        .filter((x) => x.label);

      const buttons = uniq(
        Array.from(document.querySelectorAll("main button, .page.active button, [role='button']"))
          .map((el) => clean(el.innerText || el.getAttribute("aria-label")))
          .filter((t) => t && t.length < 60)
      ).slice(0, 25);

      let quizFlag = null;
      try {
        const live = window.FlagQuizApp?.getCurrentFlag?.();
        if (live?.code) {
          quizFlag = {
            src: live.flag || null,
            flagCode: live.code,
            flagCountry: live.name,
            flagCountryHe: live.nameHe || null,
            quizIndex: live.index,
            quizTotal: live.total,
            fromQuizState: true,
          };
        }
      } catch (_) {}

      const primaryFlag =
        quizFlag ||
        media.find((m) => m.id === "quiz-flag" || (m.className || "").includes("flag-img")) ||
        media.find((m) => m.flagCode) ||
        null;

      return {
        text,
        truncated,
        charCount: text.length,
        selectedText: selected ? selected.slice(0, 1000) : null,
        title: document.title || null,
        headings,
        navLabels,
        activeNav,
        buttons,
        url: location.href || null,
        media: media.slice(0, 16),
        answerChoices: answerChoices.slice(0, 8),
        primaryFlag,
        quizFlag,
      };
    })()`;
  }

  async function getAiContext() {
    const apps = window.MySpaceConfig?.getApps?.() || [];
    const onDesktop = !isFrameVisible();
    const openTabs = tabs.map((t) => {
      const app = apps.find((a) => a.id === t.appId);
      return {
        tabId: t.id,
        title: t.title || null,
        mode: t.mode,
        appId: t.appId || null,
        appName: app?.name || null,
        module: t.module || app?.module || null,
        url: liveUrlForTab(t),
        active: t.id === activeTabId,
      };
    });

    if (onDesktop || !activeTabId) {
      const settings = window.MySpaceConfig?.getSettings?.() || {};
      const positions = window.MySpaceConfig?.getPositions?.() || {};
      const wallpaperId = settings.wallpaper || "gradient";
      const wallpaperMeta =
        window.MySpaceWallpapers?.get?.(wallpaperId) ||
        window.MySpaceWallpapers?.list?.find?.((w) => w.id === wallpaperId) ||
        null;
      const desktopIcons = apps
        .filter((a) => a && a.id && a.hidden !== true && a.visible !== false)
        .map((a) => {
          const pos = positions[a.id] || null;
          return {
            id: a.id,
            name: a.name || a.id,
            module: a.module || null,
            icon: a.icon || null,
            x: pos?.x ?? null,
            y: pos?.y ?? null,
            hasCustomPosition: !!(pos && (pos.x != null || pos.y != null)),
          };
        })
        .sort((a, b) => {
          const ay = a.y ?? 1e9;
          const by = b.y ?? 1e9;
          if (ay !== by) return ay - by;
          return (a.x ?? 1e9) - (b.x ?? 1e9);
        });

      return {
        ok: true,
        view: "desktop",
        active: null,
        openTabs,
        note:
          "User is on the My Space desktop. Desktop wallpaper and app icon positions are attached below. use them to answer what the desktop looks like. You DO know the wallpaper and icon layout from this data.",
        desktop: {
          wallpaperId,
          wallpaperName: wallpaperMeta?.name || wallpaperId,
          wallpaperDescription: wallpaperMeta?.description || wallpaperMeta?.hint || null,
          iconCount: desktopIcons.length,
          icons: desktopIcons,
        },
      };
    }

    const tab = getActiveTab();
    if (!tab) {
      return { ok: true, view: "desktop", active: null, openTabs };
    }

    if (tab.mode === "external") {
      return {
        ok: true,
        view: "external",
        active: summarizeTab(tab),
        openTabs,
        note: "Active app is an external Windows app; in-page content is not readable from My Space.",
      };
    }

    if (tab.mode === "embedded") {
      return {
        ok: true,
        view: "workspace",
        active: summarizeTab(tab),
        openTabs,
        note: "Active app is embedded inside My Space (native Windows window).",
      };
    }

    let pageState = null;
    if (tab.mode === "myapp" || tab.mode === "webview") {
      pageState = await runInTabView(tab, MYAPP_STATE_SCRIPT);
    }

    const active = summarizeTab(tab, {
      page: pageState?.page || null,
      pageTitle: pageState?.pageTitle || null,
      documentTitle: pageState?.documentTitle || null,
      mode: pageState?.mode || null,
      selectedText: pageState?.selectedText || null,
    });

    return {
      ok: true,
      view: "workspace",
      active,
      openTabs,
    };
  }

  async function getAiPageContent(maxChars) {
    const onDesktop = !isFrameVisible();
    if (onDesktop) {
      return {
        ok: false,
        error: "User is on the desktop. no page content to read.",
        view: "desktop",
      };
    }

    const tab = getActiveTab();
    if (!tab) {
      return { ok: false, error: "No active tab." };
    }
    if (tab.mode === "external") {
      return {
        ok: false,
        error: "External Windows apps do not expose page text to My Space.",
        active: summarizeTab(tab),
      };
    }
    if (tab.mode !== "myapp" && tab.mode !== "webview") {
      return { ok: false, error: `Unsupported tab mode: ${tab.mode}` };
    }

    const content = await runInTabView(tab, pageContentScript(maxChars));
    if (!content || typeof content !== "object") {
      return {
        ok: false,
        error: "Could not read page content from webview (script blocked or guest unavailable).",
        active: summarizeTab(tab),
      };
    }

    return {
      ok: true,
      active: summarizeTab(tab, {
        pageTitle: content.title || tab.title || null,
        url: content.url || liveUrlForTab(tab),
      }),
      text: content.text || "",
      truncated: !!content.truncated,
      charCount: content.charCount || 0,
      selectedText: content.selectedText || null,
      headings: Array.isArray(content.headings) ? content.headings : [],
      navLabels: Array.isArray(content.navLabels) ? content.navLabels : [],
      activeNav: content.activeNav || null,
      media: Array.isArray(content.media) ? content.media : [],
      answerChoices: Array.isArray(content.answerChoices) ? content.answerChoices : [],
      buttons: Array.isArray(content.buttons) ? content.buttons : [],
      primaryFlag: content.primaryFlag || content.quizFlag || null,
      quizFlag: content.quizFlag || null,
    };
  }

  function getSessionSnapshot() {
    const active = getActiveTab();
    let snapLeftAppId = null;
    let snapRightAppId = null;
    if (snapPair) {
      const left = getTab(snapPair.leftId);
      const right = getTab(snapPair.rightId);
      snapLeftAppId = left?.appId || null;
      snapRightAppId = right?.appId || null;
    }
    return {
      version: 1,
      savedAt: Date.now(),
      frameOpen: isFrameVisible(),
      activeAppId: active?.appId || null,
      activeMode: active?.mode || null,
      snapLeftAppId,
      snapRightAppId,
      tabs: tabs
        .filter((t) => t.appId || t.mode === "webview" || t.mode === "panel")
        .map((t) => ({
          appId: t.appId || null,
          mode: t.mode,
          title: t.title || null,
          url: t.mode === "webview" ? liveUrlForTab(t) : null,
          module: t.module || null,
          lastPage: t.lastPage || null,
        })),
    };
  }

  async function capturePeek(tabId) {
    const tab = getTab(tabId);
    if (!tab) return null;
    const meta =
      tab.mode === "myapp"
        ? "My Space app"
        : tab.mode === "webview"
          ? liveUrlForTab(tab) || "Web"
          : tab.mode === "external"
            ? "Windows app"
            : tab.mode === "embedded"
              ? "Embedded"
              : tab.mode === "panel"
                ? "Panel"
                : tab.mode;

    let dataUrl = tab.peekDataUrl || null;

    if ((tab.mode === "myapp" || tab.mode === "webview") && tab.viewEl) {
      try {
        ensureTabView(tab);
        if (typeof tab.viewEl.capturePage === "function") {
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const image = await tab.viewEl.capturePage();
          if (image?.toDataURL) {
            dataUrl = image.toDataURL();
            tab.peekDataUrl = dataUrl;
          }
        }
      } catch {
      }
    }

    return {
      tabId: tab.id,
      title: tab.title || "App",
      meta,
      mode: tab.mode,
      dataUrl,
    };
  }

  function setAiChatInset() {
    if (frame) {
      frame.style.paddingLeft = "";
      frame.classList.remove("ai-chat-inset");
    }
    document.documentElement.style.setProperty("--ai-chat-inset-left", "0px");
  }

  window.MySpaceWorkspace = {
    openWeb,
    openMyApp,
    applyRouteToTab,
    openExternal,
    openEmbedded,
    openPanel,
    updateTabIcon,
    openBlankTab,
    openMyspaceBrowserTab,
    openBrowserSearchResult,
    closeTab,
    closeAllTabs,
    closeOtherTabs,
    closeTabsForApp,
    closeActiveWindow,
    isAppOpen,
    showWorkspace,
    minimizeToDesktop,
    close: minimizeToDesktop,
    isOpen: isFrameVisible,
    isTabActiveInTaskbar,
    hasRunningApps: () => tabs.length > 0,
    setAiChatInset,
    getTabs: () =>
      tabs.map((t) => ({
        id: t.id,
        title: t.title,
        mode: t.mode,
        appId: t.appId,
        module: t.module || null,
        iconSrc: t.iconSrc,
        iconEmoji: t.iconEmoji || null,
        externalPath: t.externalPath,
        url: t.mode === "webview" ? liveUrlForTab(t) : t.url || null,
        lastPage: t.lastPage || null,
      })),
    getActiveTabId: () => activeTabId,
    getActiveTab: () => {
      const t = getActiveTab();
      if (!t) return null;
      return {
        id: t.id,
        title: t.title,
        mode: t.mode,
        appId: t.appId,
        module: t.module || null,
      };
    },
    getSessionSnapshot,
    capturePeek,
    reorderTab,
    snapSideBySide,
    snapWithNeighbor,
    toggleSnap,
    clearSnap,
    isSnapActive: () => !!snapPair,
    getSnapPair: () => (snapPair ? { ...snapPair } : null),
    getAiContext,
    getAiPageContent,
    getAiGuestHandle,
  };
})();