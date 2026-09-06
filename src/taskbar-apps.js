(function () {
  const container = () => document.getElementById("taskbar-apps");
  const peekEl = () => document.getElementById("taskbar-peek");
  const peekTitle = () => document.getElementById("taskbar-peek-title");
  const peekMeta = () => document.getElementById("taskbar-peek-meta");
  const peekPreview = () => document.getElementById("taskbar-peek-preview");

  let peekTimer = null;
  let peekTabId = null;
  let pointerDrag = null;
  let suppressClick = false;

  function getAppConfig(appId) {
    if (!appId || !window.MySpaceConfig) return null;
    return window.MySpaceConfig.getApps().find((a) => a.id === appId) || null;
  }

  function hidePeek() {
    if (peekTimer) {
      clearTimeout(peekTimer);
      peekTimer = null;
    }
    peekTabId = null;
    const el = peekEl();
    if (el) {
      el.classList.add("hidden");
      el.setAttribute("aria-hidden", "true");
    }
  }

  function positionPeek(anchorBtn) {
    const el = peekEl();
    if (!el || !anchorBtn) return;
    const rect = anchorBtn.getBoundingClientRect();
    const peekWidth = Math.min(320, window.innerWidth - 24);
    let left = rect.left + rect.width / 2 - peekWidth / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - peekWidth - 12));
    el.style.width = `${peekWidth}px`;
    el.style.left = `${left}px`;
    el.style.bottom = `${window.innerHeight - rect.top + 10}px`;
  }

  async function showPeekForTab(tab, anchorBtn) {
    if (!window.MySpaceWorkspace?.capturePeek) return;
    peekTabId = tab.id;
    positionPeek(anchorBtn);
    const cached = tab.peekDataUrl || null;
    fillPeek(tab.title || "App", tab.mode === "webview" ? "Web" : "My Space app", cached, anchorBtn);
    const data = await window.MySpaceWorkspace.capturePeek(tab.id);
    if (!data || peekTabId !== tab.id) return;
    fillPeek(data.title, data.meta || data.mode || "", data.dataUrl || cached, anchorBtn);
  }

  function showPeekForPinned(app, anchorBtn) {
    peekTabId = "pin:" + app.id;
    fillPeek(app.name, "Pinned · click to open", null, anchorBtn);
  }

  function fillPeek(titleText, metaText, dataUrl, anchorBtn) {
    const el = peekEl();
    const title = peekTitle();
    const meta = peekMeta();
    const preview = peekPreview();
    if (!el || !title || !meta || !preview) return;
    title.textContent = titleText;
    meta.textContent = metaText;
    preview.replaceChildren();
    if (dataUrl) {
      const img = document.createElement("img");
      img.src = dataUrl;
      img.alt = "";
      preview.appendChild(img);
    } else {
      const stub = document.createElement("div");
      stub.className = "taskbar-peek-stub";
      stub.textContent = metaText || "Click to open";
      preview.appendChild(stub);
    }
    el.classList.remove("hidden");
    el.setAttribute("aria-hidden", "false");
    positionPeek(anchorBtn);
  }

  function isImageIconSrc(iconSrc) {
    const s = String(iconSrc || "").trim();
    if (!s) return false;
    if (/^(https?:|data:|file:|\/)/i.test(s)) return true;
    if (/^(brand|apps|src)\//i.test(s)) return true;
    if (/\.(png|jpe?g|gif|webp|svg|ico)(\?.*)?$/i.test(s)) return true;
    return false;
  }

  function appendIcon(parent, iconSrc, fallbackChar) {
    const wrap = document.createElement("span");
    wrap.className = "taskbar-app-icon";
    if (iconSrc) {
      const img = document.createElement("img");
      img.src = iconSrc;
      img.alt = "";
      img.draggable = false;
      img.addEventListener("error", () => {
        wrap.replaceChildren();
        wrap.textContent = fallbackChar;
      });
      wrap.appendChild(img);
    } else {
      wrap.textContent = fallbackChar;
    }
    parent.appendChild(wrap);
  }

  function fallbackFor(app, tab) {
    if (tab?.appId === "notifications") return "◉";
    if (app) return window.MySpaceIcons.emojiFallback(app);
    if (tab?.iconEmoji) return tab.iconEmoji;
    if (tab?.mode === "external" || tab?.mode === "embedded") return "📦";
    if (tab?.mode === "myapp") return "📊";
    if (tab?.mode === "panel") return "⚙";
    return "🌐";
  }

  function buildEntries() {
    const tabs = window.MySpaceWorkspace?.getTabs?.() || [];
    const pins = window.MySpaceConfig?.getTaskbarPins?.() || [];
    const openAppIds = new Set(tabs.map((t) => t.appId).filter(Boolean));
    const entries = [];

    pins.forEach((appId) => {
      if (openAppIds.has(appId)) return;
      const app = getAppConfig(appId);
      if (!app || app.hidden) return;
      entries.push({ type: "pin", app, pinned: true });
    });

    tabs.forEach((tab) => {
      entries.push({
        type: "tab",
        tab,
        app: getAppConfig(tab.appId),
        pinned: pins.includes(tab.appId),
      });
    });

    return entries;
  }

  function clearDropMarks(root) {
    root?.querySelectorAll(".taskbar-app-btn--drop, .taskbar-app-btn--drop-after").forEach((el) => {
      el.classList.remove("taskbar-app-btn--drop", "taskbar-app-btn--drop-after");
    });
  }

  function dropTargetAt(clientX, root) {
    const buttons = [...(root?.querySelectorAll(".taskbar-app-btn[data-tab-id]") || [])];
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

  function endPointerDrag(clientX) {
    const state = pointerDrag;
    pointerDrag = null;
    if (!state) return;
    const root = container();
    state.btn.classList.remove("is-dragging");
    root?.classList.remove("is-reordering");
    clearDropMarks(root);
    try {
      state.btn.releasePointerCapture?.(state.pointerId);
    } catch {
    }
    if (!state.moved) return;
    suppressClick = true;
    setTimeout(() => {
      suppressClick = false;
    }, 0);
    const target = dropTargetAt(clientX, root);
    if (target?.id && target.id !== state.tabId) {
      window.MySpaceWorkspace?.reorderTab?.(state.tabId, target.id, target.placeAfter);
    }
  }

  function bindOpenAppDrag(btn, tab) {
    btn.classList.add("taskbar-app-btn--open");
    btn.title = `${tab.title}: drag to reorder`;

    btn.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      pointerDrag = {
        tabId: tab.id,
        btn,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
      };
      try {
        btn.setPointerCapture(e.pointerId);
      } catch {
      }
    });

    btn.addEventListener("pointermove", (e) => {
      const state = pointerDrag;
      if (!state || state.tabId !== tab.id || state.pointerId !== e.pointerId) return;
      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      if (!state.moved && Math.hypot(dx, dy) < 6) return;
      if (!state.moved) {
        state.moved = true;
        hidePeek();
        btn.classList.add("is-dragging");
        container()?.classList.add("is-reordering");
      }
      const root = container();
      clearDropMarks(root);
      const target = dropTargetAt(e.clientX, root);
      if (target?.el && target.id !== state.tabId) {
        target.el.classList.add(target.placeAfter ? "taskbar-app-btn--drop-after" : "taskbar-app-btn--drop");
      }
    });

    btn.addEventListener("pointerup", (e) => {
      if (!pointerDrag || pointerDrag.pointerId !== e.pointerId) return;
      endPointerDrag(e.clientX);
    });
    btn.addEventListener("pointercancel", (e) => {
      if (!pointerDrag || pointerDrag.pointerId !== e.pointerId) return;
      endPointerDrag(e.clientX);
    });
  }

  function refresh() {
    if (pointerDrag?.moved) return;
    const el = container();
    if (!el || !window.MySpaceWorkspace) return;

    const activeId = window.MySpaceWorkspace.getActiveTabId();
    el.replaceChildren();
    hidePeek();

    buildEntries().forEach((entry) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "taskbar-app-btn";
      if (entry.pinned) btn.classList.add("taskbar-app-btn--pinned");

      if (entry.type === "pin") {
        const app = entry.app;
        const fallback = fallbackFor(app, null);
        btn.title = app.name + " (pinned)";
        btn.setAttribute("aria-label", app.name);
        const iconSrc =
          app.iconData ||
          (app.iconUrl && /^(https?:|data:|file:)/i.test(app.iconUrl) ? app.iconUrl : null) ||
          (app.icon && /^(https?:|data:|file:)/i.test(app.icon) ? app.icon : null);
        if (iconSrc) appendIcon(btn, iconSrc, fallback);
        else appendIcon(btn, null, fallback);

        btn.addEventListener("click", () => {
          hidePeek();
          window.__myspaceAiLaunchApp?.(app);
        });
        btn.addEventListener("mouseenter", () => {
          if (pointerDrag?.moved) return;
          if (peekTimer) clearTimeout(peekTimer);
          peekTimer = setTimeout(() => showPeekForPinned(app, btn), 420);
        });
        btn.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          e.stopPropagation();
          hidePeek();
          window.MySpaceContextMenu?.show(
            e.clientX,
            e.clientY,
            [
              { header: { title: app.name, subtitle: "Pinned to taskbar" } },
              { id: "open", label: "Open", icon: "▶" },
              { id: "unpin", label: "Unpin from taskbar", icon: "📍" },
            ],
            (action) => {
              if (action === "open") window.__myspaceAiLaunchApp?.(app);
              if (action === "unpin") {
                window.MySpaceConfig?.unpinFromTaskbar?.(app.id);
                refresh();
                window.showMySpaceToast?.(`Unpinned ${app.name}`);
              }
            }
          );
        });
      } else {
        const tab = entry.tab;
        const app = entry.app;
        const fallback = fallbackFor(app, tab);
        btn.setAttribute("aria-label", tab.title);
        btn.dataset.tabId = tab.id;
        if (tab.mode === "external" || tab.mode === "embedded") {
          btn.classList.add("taskbar-app-btn--native");
        }
        if (tab.mode === "panel" && tab.appId === "settings") btn.classList.add("taskbar-app-btn--settings");
        if (window.MySpaceWorkspace.isTabActiveInTaskbar(tab.id)) btn.classList.add("active");

        const hasImageIcon = isImageIconSrc(tab.iconSrc);
        if (hasImageIcon) appendIcon(btn, tab.iconSrc, fallback);
        else appendIcon(btn, null, tab.iconEmoji || fallback);

        bindOpenAppDrag(btn, tab);

        btn.addEventListener("click", (e) => {
          if (suppressClick) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          hidePeek();
          if (tab.mode === "external" || tab.mode === "embedded") {
            window.MySpaceWorkspace.showWorkspace(tab.id);
            return;
          }
          const webActive = window.MySpaceWorkspace.isOpen() && tab.id === activeId;
          if (webActive && !window.MySpaceWorkspace.isSnapActive?.()) {
            window.MySpaceWorkspace.minimizeToDesktop();
          } else {
            window.MySpaceWorkspace.showWorkspace(tab.id);
          }
        });

        btn.addEventListener("mouseenter", () => {
          if (pointerDrag?.moved) return;
          if (peekTimer) clearTimeout(peekTimer);
          peekTimer = setTimeout(() => showPeekForTab(tab, btn), 420);
        });

        btn.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          e.stopPropagation();
          hidePeek();
          if (!window.MySpaceAppMenu?.buildTaskbarItems) return;
          window.MySpaceContextMenu.show(
            e.clientX,
            e.clientY,
            window.MySpaceAppMenu.buildTaskbarItems(tab),
            (action) => window.MySpaceAppMenu.handleTaskbarAction(action, tab)
          );
        });
      }

      btn.addEventListener("mouseleave", () => {
        if (peekTimer) {
          clearTimeout(peekTimer);
          peekTimer = null;
        }
        setTimeout(() => {
          const peek = peekEl();
          if (peek && !peek.matches(":hover")) hidePeek();
        }, 120);
      });

      el.appendChild(btn);
    });
  }

  peekEl()?.addEventListener("mouseleave", hidePeek);
  window.addEventListener("myspace-tabs-change", refresh);
  window.MySpaceConfig?.subscribe?.(refresh);
  window.addEventListener("blur", hidePeek);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hidePeek();
  });

  window.MySpaceTaskbar = { refresh, hidePeek };
})();