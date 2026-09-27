const appGrid = document.getElementById("app-grid");
const workspace = document.querySelector(".workspace");
const builtinPanel = document.getElementById("builtin-panel");
const backBtn = document.getElementById("back-btn");
const clockEl = document.getElementById("clock");
const taskbarTitle = document.getElementById("taskbar-title");
const welcomeSubtitle = document.getElementById("welcome-subtitle");
let selectedAppId = null;
let welcomeBound = false;
function tt(key, fallback, vars) {
  const I = window.MySpaceI18n;
  const fill = (s) => {
    if (!vars || typeof s !== "string") return s;
    return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
  };
  if (!I?.t) return fill(fallback || key);
  const v = I.t(key, vars);
  return v === key ? fill(fallback || key) : v;
}

function welcomeTips() {
  return [
    tt(
      "shell.welcome.tip.0",
      "Open <kbd>Start (⊞)</kbd> to add programs from your PC: they open inside My Space."
    ),
    tt(
      "shell.welcome.tip.1",
      "Use <kbd>Connect</kbd> for Gmail, messaging, AI, and <kbd>My Space Browser</kbd>."
    ),
    tt(
      "shell.welcome.tip.2",
      "Websites launch in a built-in browser tab; desktop apps can embed in workspace windows."
    ),
    tt(
      "shell.welcome.tip.3",
      "Use Console commands like <kbd>run space</kbd> or <kbd>run builds</kbd> for quick launches."
    ),
    tt("shell.welcome.tip.4", "Pin favorites on the desktop, or use Start / Ctrl+K to find apps."),
  ];
}

function welcomeChangelog() {
  return [
    {
      tag: tt("shell.welcome.changelog.chat.tag", "Chat"),
      text: tt(
        "shell.welcome.changelog.chat.text",
        "New Chat app: ChatGPT-style history powered by Mind. run chat, chat(new)."
      ),
    },
    {
      tag: tt("shell.welcome.changelog.mind.tag", "Mind"),
      text: tt(
        "shell.welcome.changelog.mind.text",
        "Mind is simple: Quick (cheap), Everyday, or Deep (Pro). One Gemini key. Platform → Mind."
      ),
    },
    {
      tag: tt("shell.welcome.changelog.msl.tag", "MSL"),
      text: tt(
        "shell.welcome.changelog.msl.text",
        "MSL is a built-in platform service (panel + shell): no desktop app tile."
      ),
    },
    {
      tag: tt("shell.welcome.changelog.jobs.tag", "Jobs"),
      text: tt(
        "shell.welcome.changelog.jobs.text",
        "Jobs is the OS compute runtime. every launch and shell command is a job under the Capacity contract (Platform → Jobs)."
      ),
    },
    {
      tag: tt("shell.welcome.changelog.platform.tag", "Platform"),
      text: tt(
        "shell.welcome.changelog.platform.text",
        "Platform services catalog: OS, Browser, Shell, MSL, Jobs, Mind, and more from the taskbar atom or Welcome → Services."
      ),
    },
    {
      tag: tt("shell.welcome.changelog.connect.tag", "Connect"),
      text: tt(
        "shell.welcome.changelog.connect.text",
        "Mail hub renamed Connect: catalog of mail, messaging, social, AI, media, tools, and browsers in-app."
      ),
    },
    {
      tag: tt("shell.welcome.changelog.browser.tag", "Browser"),
      text: tt(
        "shell.welcome.changelog.browser.text",
        "My Space Browser searches apps, Connect services, My Space content, and the web from one home page."
      ),
    },
  ];
}

function updateClock() {
  if (!clockEl) return;
  const settings = window.MySpaceConfig?.getSettings?.() || {};
  if (settings.showClock === false) {
    clockEl.classList.add("hidden");
    clockEl.textContent = "";
    return;
  }
  clockEl.classList.remove("hidden");
  const locale = settings.locale || "en-US";
  const timeZone = settings.timezone || undefined;
  const hour12 = settings.timeFormat !== "24h";
  const now = new Date();
  try {
    clockEl.textContent = now.toLocaleString(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: settings.showSeconds ? "2-digit" : undefined,
      hour12,
      timeZone,
    });
  } catch {
    clockEl.textContent = now.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }
}

function showToast(message, ms = 3500) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

function showDesktop() {
  window.MySpaceWorkspace?.minimizeToDesktop();
  appGrid.classList.remove("hidden");
  builtinPanel.classList.add("hidden");
}

async function showBuiltin() {
  if (window.MySpaceWorkspace?.minimizeToDesktop) {
    await window.MySpaceWorkspace.minimizeToDesktop();
  }
  appGrid.classList.add("hidden");
  builtinPanel.classList.remove("hidden");
  renderWelcomeHub();
}

function typeLabel(type) {
  if (type === "myapp") return tt("shell.welcome.type.app", "App");
  if (type === "url") return tt("shell.welcome.type.web", "Web");
  if (type === "exe" || type === "path") return tt("shell.welcome.type.program", "Program");
  if (type === "builtin") return tt("shell.welcome.type.system", "System");
  return type || tt("shell.welcome.type.app", "App");
}

function renderWelcomeHub() {
  const apps = (window.MySpaceConfig?.getApps?.() || []).filter(
    (a) => a.id !== "welcome" && !a.hidden
  );
  const settings = window.MySpaceConfig?.getSettings?.() || {};
  const titleEl = document.getElementById("welcome-title");
  if (titleEl) {
    titleEl.setAttribute("data-i18n", "shell.welcome.title");
    titleEl.textContent = tt("shell.welcome.title", "Command center");
  }
  if (welcomeSubtitle) {
    const custom = String(settings.subtitle || "").trim();
    if (custom) {
      welcomeSubtitle.textContent = custom;
      welcomeSubtitle.removeAttribute("data-i18n");
    } else {
      welcomeSubtitle.setAttribute("data-i18n", "shell.welcome.subtitle");
      welcomeSubtitle.textContent = tt(
        "shell.welcome.subtitle",
        "Your work environment for code and entrepreneurship."
      );
    }
  }

  const status = document.getElementById("welcome-status");
  if (status) {
    const openCount = window.MySpaceWorkspace?.getTabs?.()?.length || 0;
    const hour = new Date().getHours();
    const greeting =
      hour < 12
        ? tt("shell.welcome.greeting.morning", "Good morning")
        : hour < 18
          ? tt("shell.welcome.greeting.afternoon", "Good afternoon")
          : tt("shell.welcome.greeting.evening", "Good evening");
          const locale = settings.locale || "en-US";
    let dateLabel = "";
    try {
      dateLabel = new Date().toLocaleDateString(locale, {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
    } catch {
      dateLabel = new Date().toLocaleDateString();
    }
    status.innerHTML = `
      <span class="welcome-chip"><strong>${greeting}</strong></span>
      <span class="welcome-chip"><strong>${apps.length}</strong> ${tt("shell.welcome.appsInstalled", "apps installed")}</span>
      <span class="welcome-chip"><strong>${openCount}</strong> ${tt("shell.welcome.openNowSuffix", "open now")}</span>
      <span class="welcome-chip">${dateLabel}</span>`;
  }

  const countEl = document.getElementById("welcome-apps-count");
  if (countEl) countEl.textContent = tt("shell.welcome.available", "{n} available", { n: apps.length });
  const appsEl = document.getElementById("welcome-apps");
  if (appsEl) {
    appsEl.innerHTML = apps
      .map((app) => {
        const icon =
          app.iconUrl ||
          (app.icon && (String(app.icon).startsWith("http") || String(app.icon).startsWith("data:"))
            ? app.icon
            : null);
        const iconHtml = icon
          ? `<img src="${icon}" alt="" />`
          : app.icon || "◆";
        return `<button type="button" class="welcome-app" data-app-id="${app.id}">
          <span class="welcome-app-icon">${iconHtml}</span>
          <span class="welcome-app-text">
            <strong>${app.name || app.id}</strong>
            <span>${typeLabel(app.type)}</span>
          </span>
        </button>`;
      })
      .join("");
    appsEl.querySelectorAll("[data-app-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const app = apps.find((a) => a.id === btn.dataset.appId);
        if (app) launchApp(app);
      });
    });
  }

  const tipsEl = document.getElementById("welcome-tips");
  if (tipsEl) {
    tipsEl.innerHTML = welcomeTips().map((t) => `<li>${t}</li>`).join("");
  }

  const logEl = document.getElementById("welcome-changelog");
  if (logEl) {
    logEl.innerHTML = welcomeChangelog()
      .map(
        (c) => `<article class="welcome-change">
        <div class="welcome-change-meta">${c.tag}</div>
        <p>${c.text}</p>
      </article>`
      )
      .join("");
  }

  const runningEl = document.getElementById("welcome-running");
  if (runningEl) {
    const tabs = window.MySpaceWorkspace?.getTabs?.() || [];
    if (!tabs.length) {
      runningEl.innerHTML = `<p class="welcome-running-empty">${tt("shell.welcome.runningEmpty", "Nothing open, pick an app to start.")}</p>`;
    } else {
      runningEl.innerHTML = tabs
        .map((tab) => {
          const app = apps.find((a) => a.id === tab.appId);
          const name = app?.name || tab.title || tab.appId;
          return `<div class="welcome-running-item">
            <span>${name}</span>
            <button type="button" data-focus-tab="${tab.id}">${tt("shell.welcome.focus", "Focus")}</button>
          </div>`;
        })
        .join("");
      runningEl.querySelectorAll("[data-focus-tab]").forEach((btn) => {
        btn.addEventListener("click", () => {
          window.MySpaceWorkspace?.showWorkspace?.(btn.dataset.focusTab);
        });
      });
    }
  }

  if (!welcomeBound) {
    welcomeBound = true;
    document.getElementById("welcome-actions")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-welcome-action]");
      if (!btn) return;
      const action = btn.dataset.welcomeAction;
      if (action === "desktop") showDesktop();
      if (action === "start") document.getElementById("btn-start")?.click();
      if (action === "add") addApp("browse");
      if (action === "settings") openSettings();
      if (action === "sysinfo") {
        const sys = window.MySpaceConfig.getApps().find((a) => a.id === "system-info");
        if (sys) launchApp(sys);
      }
    });
    document.getElementById("btn-platform-services-welcome")?.addEventListener("click", () => {
      window.MySpacePlatformCatalog?.show?.();
    });
  }
}

document.getElementById("btn-platform-services")?.addEventListener("click", () => {
  window.MySpacePlatformCatalog?.toggle?.();
});

function applyHeader() {
  const { title, subtitle, wallpaper } = window.MySpaceConfig.getSettings();
  const mode = window.MySpaceDesktop.isFullDesktop()
    ? ""
    : ` · ${tt("shell.preview", "Preview")}`;
  if (taskbarTitle) taskbarTitle.textContent = title + mode;
  if (welcomeSubtitle) {
    const custom = String(subtitle || "").trim();
    if (custom) {
      welcomeSubtitle.textContent = custom;
      welcomeSubtitle.removeAttribute("data-i18n");
    } else {
      welcomeSubtitle.setAttribute("data-i18n", "shell.welcome.subtitle");
      welcomeSubtitle.textContent = tt(
        "shell.welcome.subtitle",
        "Your work environment for code and entrepreneurship."
      );
    }
  }
  document.title = title;
  if (!window.__myspaceWallpaperBootDone) {
    window.__myspaceWallpaperBootDone = true;
    const pl = window.MySpaceWallpapers?.getPlaylist?.() || [];
    if (pl.length >= 2 && window.MySpaceWallpapers?.ensureDefaultPhotoRotation) {
      window.MySpaceWallpapers.ensureDefaultPhotoRotation();
    } else {
      window.MySpaceWallpapers?.apply?.(wallpaper || "gradient");
      window.MySpaceWallpapers?.syncRotation?.();
    }
  } else {
    window.MySpaceWallpapers?.apply?.(wallpaper || "gradient");
    window.MySpaceWallpapers?.syncRotation?.();
  }
  updateClock();
  if (!builtinPanel.classList.contains("hidden")) renderWelcomeHub();
}

window.applyMySpaceHeader = applyHeader;

function selectApp(appId) {
  selectedAppId = appId;
  document.querySelectorAll(".app-tile").forEach((el) => {
    el.classList.toggle("selected", el.dataset.appId === appId);
  });
}

function clearSelection() {
  selectedAppId = null;
  document.querySelectorAll(".app-tile.selected").forEach((el) => {
    el.classList.remove("selected");
  });
}

async function resolveTileIcon(app) {
  if (window.mySpace.resolveAppIcon) {
    const resolved = await window.mySpace.resolveAppIcon(app);
    if (resolved) return resolved;
  }
  return window.MySpaceIcons.resolveIconFromConfig(app);
}

function buildIconElement(app, iconSrc) {
  const wrap = document.createElement("span");
  wrap.className = "icon";
  if (iconSrc) {
    const img = document.createElement("img");
    img.className = "app-icon-img";
    img.src = iconSrc;
    img.alt = "";
    img.draggable = false;
    img.addEventListener("error", () => {
      wrap.replaceChildren();
      wrap.textContent = window.MySpaceIcons.emojiFallback(app);
    });
    wrap.appendChild(img);
  } else {
    wrap.textContent = window.MySpaceIcons.emojiFallback(app);
  }
  return wrap;
}

async function createAppTile(app, index) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "app-tile";
  btn.dataset.appId = app.id;
  btn.setAttribute("aria-label", app.name);
  btn.appendChild(buildIconElement(app, await resolveTileIcon(app)));
  const nameEl = document.createElement("span");
  nameEl.className = "name";
  nameEl.textContent = app.name;
  btn.appendChild(nameEl);
  btn.addEventListener("click", async () => {
    if (window.MySpaceDrag.shouldSuppressClick(btn)) {
      return;
    }
    selectApp(app.id);
    await launchApp(app);
  });

  btn.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    selectApp(app.id);
    openIconMenu(e.clientX, e.clientY, app);
  });

  return { btn, index, app };
}

function openIconMenu(x, y, app) {
  if (!window.MySpaceAppMenu?.buildAppItems) {
    showToast("Context menu failed to load.");
    return;
  }
  try {
    const items = window.MySpaceAppMenu.buildAppItems(app);
    window.MySpaceContextMenu.show(x, y, items, (action) => {
      handleAppMenuAction(action, app);
    });
  } catch (err) {
    console.error("openIconMenu:", err);
    showToast(err.message || "Could not open menu");
  }
}

function handleAppMenuAction(action, app) {
  if (action === "open") {
    launchApp(app);
    return;
  }
  if (action === "open-new") {
    launchApp(app, { reuse: false });
    return;
  }
  if (action === "open-split") {
    const otherTab = (window.MySpaceWorkspace?.getTabs?.() || []).find(
      (t) => t.mode !== "external" && t.appId && t.appId !== app.id
    );
    if (!otherTab?.appId) {
      showToast("Open another app first, then use Open split");
      return;
    }

    const other = window.MySpaceConfig.getApps().find((a) => a.id === otherTab.appId);
    if (!other) {
      showToast("Could not find the other open app");
      return;
    }
    openAppsSplit(other, app);
    return;
  }
  if (action === "open-beside") {
    openBesidePicker(app);
    return;
  }
  if (action === "switch") {
    const tab = window.MySpaceAppMenu.findOpenTab(app);
    if (tab) window.MySpaceWorkspace.showWorkspace(tab.id);
    return;
  }
  if (action === "pin") {
    const result = window.MySpaceConfig.moveAppToTop(app.id);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast(`Pinned "${app.name}" to top`);
    refreshDesktop({ relayout: true });
    return;
  }
  if (action === "pin-taskbar") {
    const pinned = window.MySpaceConfig.isPinnedToTaskbar?.(app.id);
    if (pinned) {
      window.MySpaceConfig.unpinFromTaskbar(app.id);
      showToast(`Unpinned "${app.name}" from taskbar`);
    } else {
      window.MySpaceConfig.pinToTaskbar(app.id);
      showToast(`Pinned "${app.name}" to taskbar`);
    }
    window.MySpaceTaskbar?.refresh?.();
    return;
  }
  if (action === "reset-pos") {
    window.MySpaceConfig.resetAppPosition(app.id);
    showToast(`Reset position for "${app.name}"`);
    refreshDesktop();
    return;
  }
  if (action === "duplicate") {
    const result = window.MySpaceConfig.duplicateApp(app.id);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast(`Duplicated "${app.name}"`);
    refreshDesktop();
    return;
  }
  if (action === "properties") {
    editApp(app);
    return;
  }
  if (action === "reveal") {
    window.MySpaceAppMenu.revealApp(app);
    return;
  }
  if (action === "copy-link") {
    window.MySpaceAppMenu.copyAppLink(app);
    return;
  }
  if (action === "browser") {
    window.MySpaceAppMenu.openInBrowser(app);
    return;
  }
  if (action === "close") {
    window.MySpaceWorkspace?.closeTabsForApp(app.id);
    return;
  }
  if (action === "remove") {
    removeApp(app);
  }
}

function buildShellContext() {
  return {
    getApps: () => window.MySpaceConfig.getApps(),
    launchApp,
    showBuiltin,
    showToast,
    showDesktop,
    openSettings,
    addApp: () => addApp("browse"),
    refreshDesktop,
    sortDesktop: () => {
      window.MySpaceConfig.sortAppsAlphabetically();
      refreshDesktop({ relayout: true });
    },
    resetLayout: () => {
      window.MySpaceConfig.resetPositions();
      refreshDesktop({ relayout: "groups" });
    },
    pinApp: (appId) => {
      const result = window.MySpaceConfig.pinToTaskbar(appId);
      if (result?.ok !== false) {
        window.MySpaceConfig.moveAppToTop(appId);
        refreshDesktop({ relayout: true });
        window.MySpaceTaskbar?.refresh?.();
      }
      return result?.ok === false ? result : { ok: true };
    },
    unpinApp: (appId) => {
      const result = window.MySpaceConfig.unpinFromTaskbar(appId);
      if (result?.ok !== false) {
        window.MySpaceConfig.moveAppToBottom(appId);
        refreshDesktop({ relayout: true });
        window.MySpaceTaskbar?.refresh?.();
      }
      return result?.ok === false ? result : { ok: true };
    },
    revealApp: (app) => window.MySpaceAppMenu?.revealApp?.(app),
    focusApp: (app) => {
      const tab = window.MySpaceAppMenu?.findOpenTab?.(app);
      if (!tab) return false;
      window.MySpaceWorkspace.showWorkspace(tab.id);
      return true;
    },
    getRunning: () => {
      const apps = window.MySpaceConfig.getApps();
      const activeId = window.MySpaceWorkspace?.getActiveTabId?.();
      return (window.MySpaceWorkspace?.getTabs?.() || []).map((tab) => {
        const app = apps.find((a) => a.id === tab.appId);
        return {
          id: tab.appId,
          name: app?.name || tab.title,
          mode: tab.mode,
          active: tab.id === activeId,
        };
      });
    },
    isAppOpen: (app) => window.MySpaceAppMenu?.isAppOpen?.(app) || false,
    isOnDesktop: () => !window.MySpaceWorkspace?.isOpen?.(),
    isInWorkspace: () => window.MySpaceWorkspace?.isOpen?.() || false,
    closeApp: (appId) => {
      if (!window.MySpaceWorkspace?.isAppOpen?.(appId)) return false;
      window.MySpaceWorkspace.closeTabsForApp(appId);
      refreshOpenIndicators();
      return true;
    },
    closeAll: () => {
      window.MySpaceWorkspace?.closeAllTabs();
      refreshOpenIndicators();
    },
    closeActive: () => window.MySpaceWorkspace?.closeActiveWindow?.() || null,
  };
}

async function logShellHistory(line, result, source) {
  if (!window.mySpace?.shellEngine?.load) return;
  try {
    const res = await window.mySpace.shellEngine.load();
    if (!res?.ok) return;
    const data = res.data || {};
    if (data.settings?.logHistory === false) return;
    const max = Math.min(500, parseInt(data.settings?.maxHistory, 10) || 500);
    data.history = [
      {
        id: `hist_${Date.now()}`,
        line,
        ok: Boolean(result.ok),
        message: result.message || result.error || "",
        at: new Date().toISOString(),
        source: source || "desktop",
      },
      ...(data.history || []),
    ].slice(0, max);
    await window.mySpace.shellEngine.save(data);
  } catch {
  }
}
let shellHotkeyLock = false;

function openShellLine(x, y) {
  if (shellHotkeyLock && (x == null || y == null)) return;
  if (x == null || y == null) {
    shellHotkeyLock = true;
    setTimeout(() => {
      shellHotkeyLock = false;
    }, 250);
  }
  const submit = async (line) => {
    const result = await window.MySpaceShellBridge.executeCommand(line, "desktop");
    if (result.message) {
      showToast(result.message, result.ok ? 4500 : 5500);
    } else if (!result.ok && result.error) {
      showToast(result.error, 5500);
    }
  };
  if (x == null || y == null) {
    window.MySpaceShellLine.showCentered(submit);
  } else {
    window.MySpaceShellLine.show(x, y, submit);
  }
}

function openCommandPalette() {
  if (shellHotkeyLock) return;
  shellHotkeyLock = true;
  setTimeout(() => {
    shellHotkeyLock = false;
  }, 250);
  if (window.MySpaceShellLine?.isOpen?.()) window.MySpaceShellLine.hide();
  if (window.MySpaceStartMenu?.isOpen?.()) window.MySpaceStartMenu.close();
  if (window.MySpaceShortcutsHelp?.isOpen?.()) window.MySpaceShortcutsHelp.hide();
  window.MySpaceCommandPalette?.show({
    onLaunch: (app) => launchApp(app),
    onLaunchById: (appId, options) => {
      const app = window.MySpaceConfig.getApps().find((a) => a.id === appId);
      if (app) launchApp(app, options || {});
      else showToast("App not found");
    },
    onAdd: () => addApp("installed"),
    onSettings: openSettings,
    onDesktop: showDesktop,
    onShell: () => openShellLine(),
    onShortcuts: () => window.MySpaceShortcutsHelp?.show?.(),
    onFocusToggle: () => window.MySpaceFocus?.toggle?.(),
    onSpaceCycle: () => window.MySpaceDesktopSpaces?.cycle?.(1),
    onTaskView: () => window.MySpaceDesktopSpaces?.toggleOverview?.(),
    onNewDesktop: () => window.MySpaceDesktopSpaces?.createDesktop?.(),
    onAskAi: (opts) => {
      window.MySpaceAiChat?.open?.(opts || {});
    },
    onQuick: (item) => {
      const appId = item?.appId;
      if (!appId) return;
      const app = window.MySpaceConfig.getApps().find((a) => a.id === appId);
      const name = app?.name || appId;
      const ctx = buildShellContext();
      if (item.action === "focus") {
        if (app) {
          const ok = ctx.focusApp(app);
          showToast(ok ? `Focused ${name}` : `${name} is not open`);
        }
        return;
      }
      if (item.action === "close") {
        const closed = ctx.closeApp(appId);
        showToast(closed ? `Closed ${name}` : `${name} is not open`);
        return;
      }
      if (item.action === "pin") {
        const result = ctx.pinApp(appId);
        showToast(result?.ok === false ? result.error || "Could not pin" : `Pinned ${name}`);
        return;
      }
      if (item.action === "unpin") {
        const result = ctx.unpinApp(appId);
        showToast(result?.ok === false ? result.error || "Could not unpin" : `Unpinned ${name}`);
      }
    },
    onNewWindow: async () => {
      try {
        const res = await window.mySpace?.openNewWindow?.();
        if (!res?.ok) showToast(res?.error || "Could not open window");
      } catch (err) {
        showToast(err?.message || "Could not open window");
      }
    },
    onSnap: () => {
      const ok = window.MySpaceWorkspace?.toggleSnap?.();
      if (!ok && !window.MySpaceWorkspace?.isSnapActive?.()) {
        showToast("Open two apps first, then snap");
      }
    },
    onContent: async (item) => {
      if (item.launchAppId) {
        const launch = window.MySpaceConfig.getApps().find((a) => a.id === item.launchAppId);
        if (launch) {
          await launchApp(launch);
          return;
        }
      }
      const app = window.MySpaceConfig.getApps().find((a) => a.id === item.appId);
      if (!app) {
        showToast("App not found");
        return;
      }
      await launchApp(app, { route: item.route || null });
    },
    onCommand: async (line) => {
      const result = await window.MySpaceShellBridge.executeCommand(line, "palette");
      if (result.message) {
        showToast(result.message, result.ok ? 4500 : 5500);
      } else if (!result.ok && result.error) {
        showToast(result.error, 5500);
      }
    },
  });
}

const SESSION_KEY = "myspace-session-v1";
let sessionSaveTimer = null;

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function saveSessionNow() {
  try {
    const snap = window.MySpaceWorkspace?.getSessionSnapshot?.();
    if (!snap) return;
    localStorage.setItem(SESSION_KEY, JSON.stringify(snap));
  } catch {
  }
}

function scheduleSessionSave() {
  if (sessionSaveTimer) clearTimeout(sessionSaveTimer);
  sessionSaveTimer = setTimeout(saveSessionNow, 400);
}

function routeForAppRestore(app, entry) {
  const prefs = window.MySpaceAppPrefs?.get?.(app.id) || {};
  if (prefs.restorePage === false) return null;
  const page = entry?.lastPage || prefs.lastPage;
  if (!page) return null;
  return { page };
}

async function restoreSession(session) {
  if (!session?.tabs?.length) return false;
  let restored = 0;
  let activeTabAfter = null;
  for (const entry of session.tabs) {
    try {
      if (entry.mode === "webview" && entry.url && !entry.appId) {
        window.MySpaceWorkspace.openWeb(entry.url, entry.title || "Tab", { reuse: false });
        restored += 1;
        continue;
      }

      if (entry.mode === "panel" && entry.appId === "settings") {
        openSettings();
        restored += 1;
        continue;
      }

      if (!entry.appId) continue;
      const app = window.MySpaceConfig.getApps().find((a) => a.id === entry.appId);
      if (!app) continue;
      if (entry.mode === "webview" && entry.url && app.type === "url") {
        window.MySpaceWorkspace.openWeb(entry.url, app.name, {
          appId: app.id,
          iconSrc: initialLaunchIcon(app),
          reuse: true,
          forceInApp: true,
        });
      } else {
        const route = routeForAppRestore(app, entry);
        await launchApp(app, { route, reuse: true });
      }
      restored += 1;
      if (
        session.activeAppId === entry.appId &&
        (!session.activeMode || session.activeMode === entry.mode)
      ) {
        const tabs = window.MySpaceWorkspace.getTabs();
        activeTabAfter = tabs.find((t) => t.appId === entry.appId && t.mode === entry.mode) || null;
      }
    } catch (err) {
      console.warn("session restore skipped:", entry, err);
    }
  }

  if (activeTabAfter) {
    window.MySpaceWorkspace.showWorkspace(activeTabAfter.id);
  } else if (session.frameOpen === false) {
    window.MySpaceWorkspace.minimizeToDesktop();
  }

  if (session.snapLeftAppId && session.snapRightAppId) {
    const tabs = window.MySpaceWorkspace.getTabs() || [];
    const left = tabs.find((t) => t.appId === session.snapLeftAppId && t.mode !== "external");
    const right = tabs.find((t) => t.appId === session.snapRightAppId && t.mode !== "external");
    if (left && right && left.id !== right.id) {
      window.MySpaceWorkspace.snapSideBySide(left.id, right.id);
    }
  }

  return restored > 0;
}

async function launchStartupApps() {
  const apps = window.MySpaceConfig.getApps();
  for (const app of apps) {
    if (app.id === "welcome" || app.hidden) continue;
    const prefs = window.MySpaceAppPrefs?.get?.(app.id) || {};
    if (!prefs.openAtStartup) continue;
    if (window.MySpaceWorkspace.isAppOpen(app.id)) continue;
    const route = routeForAppRestore(app, null);
    try {
      await launchApp(app, { route, reuse: true });
    } catch (err) {
      console.warn("openAtStartup failed:", app.id, err);
    }
  }
}

let desktopIntroBound = false;

function dismissDesktopIntro() {
  window.MySpaceDesktopIntro?.hide?.();
}

function maybeShowDesktopIntro() {
  // Owned by desktop-intro.js — always shows after splash.
  void window.MySpaceDesktopIntro?.show?.();
}

async function runStartupSequence() {
  const session = loadSession();
  const ageMs = session?.savedAt ? Date.now() - session.savedAt : Infinity;
  const sessionFresh = session?.tabs?.length && ageMs < 7 * 24 * 60 * 60 * 1000;
  if (sessionFresh) {
    await restoreSession(session);
  }
  await launchStartupApps();
}

let jobsRuntimeDepth = 0;
let directWorkInFlight = 0;
const JOBS_EXTREME_LOAD_THRESHOLD = 8;

function shouldQueueThroughJobs(source, opts = {}) {
  if (opts.forceJobs === true) return true;
  const src = String(source || "");
  if (src === "msl" || src === "background" || src === "jobs-enqueue") return true;
  return directWorkInFlight >= JOBS_EXTREME_LOAD_THRESHOLD;
}

window.MySpaceShellBridge = {
  async executeCommand(line, source = "bridge", opts = {}) {
    const trimmed = String(line || "").trim();
    if (source === "jobs-internal" || source === "jobs-runner") {
      jobsRuntimeDepth += 1;
      try {
        const ctx = buildShellContext();
        const result = await window.MySpaceShellCommands.execute(trimmed, ctx);
        await logShellHistory(trimmed, result, source);
        return { ...result, message: result.message || result.error };
      } finally {
        jobsRuntimeDepth -= 1;
      }
    }

    const useJobs =
      !!window.mySpace?.jobs?.run && shouldQueueThroughJobs(source, opts);
    if (useJobs) {
      const isJobsMeta = /^jobs\s*\(/i.test(trimmed) || /^run\s+jobs\b/i.test(trimmed);
      const res = await window.mySpace.jobs.run({
        kind: isJobsMeta ? "control" : "shell",
        command: trimmed,
        source,
        wait: true,
        interactive: true,
        title: trimmed.slice(0, 80),
      });
      if (res?.queued && res?.ok === false) {
        return { ok: false, error: res.error || "Jobs capacity blocked this command", message: res.error };
      }
      const job = res?.job;
      const ok = res?.ok !== false && job?.status !== "failed" && job?.status !== "cancelled";
      const message = job?.result?.message || res?.message || res?.error || "";
      const error = ok ? null : job?.error || res?.error || message;
      await logShellHistory(trimmed, { ok, message, error }, source);
      return { ok, message: message || error, error };
    }
    directWorkInFlight += 1;
    try {
      const ctx = buildShellContext();
      const result = await window.MySpaceShellCommands.execute(trimmed, ctx);
      await logShellHistory(trimmed, result, source);
      return { ...result, message: result.message || result.error };
    } finally {
      directWorkInFlight = Math.max(0, directWorkInFlight - 1);
    }
  },
  async executeProgram(body, source = "bridge", opts = {}) {
    if (source === "jobs-internal" || source === "jobs-runner") {
      jobsRuntimeDepth += 1;
      try {
        const ctx = buildShellContext();
        const result = await window.MySpaceShellCommands.executeProgram(body, ctx, {
          stopOnError: opts.stopOnError !== false,
          scope: window.MySpaceShellCommands.createScope(
            window.MySpaceShellCommands.getSessionScope()
          ),
          source,
        });
        const preview = String(body || "").trim().split(/\r?\n/).filter(Boolean)[0] || "(program)";
        await logShellHistory(`/* program */ ${preview}`, result, source);
        return { ...result, message: result.message || result.error };
      } finally {
        jobsRuntimeDepth -= 1;
      }
    }
    const useJobs =
      !!window.mySpace?.jobs?.run && shouldQueueThroughJobs(source, opts);
    if (useJobs) {
      const preview = String(body || "").trim().split(/\r?\n/).filter(Boolean)[0] || "(program)";
      const res = await window.mySpace.jobs.run({
        kind: "program",
        body,
        stopOnError: opts.stopOnError !== false,
        source,
        wait: true,
        interactive: true,
        title: `Program · ${preview.slice(0, 60)}`,
      });
      const job = res?.job;
      const ok = res?.ok !== false && job?.status !== "failed";
      return {
        ok,
        message: job?.result?.message || res?.message || res?.error,
        error: ok ? null : job?.error || res?.error,
      };
    }
    directWorkInFlight += 1;
    try {
      const ctx = buildShellContext();
      const result = await window.MySpaceShellCommands.executeProgram(body, ctx, {
        stopOnError: opts.stopOnError !== false,
        scope: window.MySpaceShellCommands.createScope(
          window.MySpaceShellCommands.getSessionScope()
        ),
        source,
      });
      const preview = String(body || "").trim().split(/\r?\n/).filter(Boolean)[0] || "(program)";
      await logShellHistory(`/* program */ ${preview}`, result, source);
      return { ...result, message: result.message || result.error };
    } finally {
      directWorkInFlight = Math.max(0, directWorkInFlight - 1);
    }
  },
};
window.MySpaceJobsRuntime = {
  async performLaunch(payload = {}) {
    const appId = String(payload.appId || "").trim();
    const app = window.MySpaceConfig?.getApps?.()?.find((a) => a.id === appId);
    if (!app) return { ok: false, error: `App not found: ${appId}` };
    const tab = await launchAppDirect(app, {
      route: payload.route || null,
      reuse: payload.reuse !== false,
    });
    return {
      ok: true,
      message: `Opened ${app.name}`,
      appId,
      opened: !!tab || app.type === "builtin",
    };
  },
  async performConnectOpen(payload = {}) {
    const url = String(payload.url || "").trim();
    if (!url) return { ok: false, error: "Missing Connect URL" };
    const title = payload.title || "Connect";
    const appId = payload.appId || "connect-web";
    if (!window.MySpaceWorkspace?.openWeb) {
      return { ok: false, error: "Workspace unavailable" };
    }
    const iconSrc =
      payload.iconUrl ||
      payload.iconSrc ||
      (appId === "connect-myspace-browser" ? "brand/atom-green.png" : null);
    window.MySpaceWorkspace.openWeb(url, title, {
      reuse: payload.reuse !== false,
      appId,
      forceInApp: true,
      preload: payload.preload || null,
      iconSrc,
    });
    return { ok: true, message: `Opened ${title}`, appId };
  },
};

async function resolveLaunchIcon(app) {
  if (window.mySpace?.resolveAppIcon) {
    const resolved = await window.mySpace.resolveAppIcon(app);
    if (resolved) return resolved;
  }
  return window.MySpaceIcons.resolveIconFromConfig(app);
}

function initialLaunchIcon(app) {
  if (app.iconData) return app.iconData;
  return window.MySpaceIcons?.resolveIconFromConfig(app) || null;
}

window.MySpaceMindChat = {
  async open(route) {
    const app = window.MySpaceConfig?.getApps?.()?.find((a) => a.id === "chat" || a.module === "chat");
    if (!app) {
      showToast("Mind Chat unavailable");
      return null;
    }
    return launchApp(app, { route: route || { page: "home" }, reuse: true, skipJobs: true });
  },
  openSetup() {
    window.MySpaceMindPanel?.show?.("setup");
  },
};

window.MySpaceFlow = {
  async open(route) {
    const apps = window.MySpaceConfig?.getApps?.() || [];
    const app = apps.find((a) => a.id === "model-flow" || a.module === "model-flow");
    if (!app) {
      showToast("Model Flow unavailable");
      return null;
    }
    let next = route && typeof route === "object" ? { ...route } : {};
    if (!next.page || next.page === "home") next.page = "studio";
    try {
      return await launchApp(app, {
        route: next,
        full: true,
        reuse: true,
        skipJobs: true,
      });
    } catch (err) {
      showToast(err?.message || "Could not open Model Flow");
      return null;
    }
  },
};

window.MySpaceConnect = {
  async open() {
    const apps = window.MySpaceConfig?.getApps?.() || [];
    const app = apps.find((a) => a.id === "mail" || a.module === "mail" || a.id === "connect");
    if (!app) {
      showToast("Connect unavailable");
      return null;
    }
    try {
      const tab = await launchApp(app, {
        route: { page: "hub", action: "show-hub" },
        reuse: true,
        skipJobs: true,
      });
      try {
        const hub =
          window.MySpaceAppMenu?.findOpenTab?.(app) ||
          (window.MySpaceWorkspace?.getTabs?.() || []).find((t) => t.appId === "mail" || t.module === "mail");
        if (hub?.id) window.MySpaceWorkspace?.showWorkspace?.(hub.id);
      } catch {
      }
      return tab;
    } catch (err) {
      showToast(err?.message || "Could not open Connect");
      return null;
    }
  },
};

window.MySpaceScripts = {
  async open(route) {
    const apps = window.MySpaceConfig?.getApps?.() || [];
    const app = apps.find((a) => a.id === "scripts" || a.module === "scripts");
    if (!app) {
      showToast("Scripts unavailable");
      return null;
    }
    try {
      const tab = await launchApp(app, { route: null, reuse: true, skipJobs: true });
      if (route?.action === "new") {
        const res = await window.MySpaceShellBridge?.executeCommand?.("scripts(new)", "platform");
        if (res && res.ok === false) {
          showToast(res.error || "Could not create script");
        }
      }
      return tab;
    } catch (err) {
      showToast(err?.message || "Could not open Scripts");
      return null;
    }
  },
};

window.MySpaceSystemInfo = {
  async open(route) {
    const apps = window.MySpaceConfig?.getApps?.() || [];
    const app = apps.find((a) => a.id === "system-info" || a.module === "system-info");
    if (!app) {
      showToast("System Info unavailable");
      return null;
    }
    const page = route?.page || "system";
    try {
      return await launchApp(app, {
        route: { page },
        reuse: true,
        skipJobs: true,
      });
    } catch (err) {
      showToast(err?.message || "Could not open System Info");
      return null;
    }
  },
};

window.MySpaceOsBridge = {
  async open(route) {
    const pageMap = { share: "actions" };
    const raw = route?.page || "devices";
    const page = ["devices", "places", "actions", "host"].includes(raw)
      ? raw
      : pageMap[raw] || "devices";
    if (!route?.full && window.MySpaceBridgePanel?.show) {
      window.MySpaceBridgePanel.show(page);
      return null;
    }
    const apps = window.MySpaceConfig?.getApps?.() || [];
    const app = apps.find((a) => a.id === "os-bridge" || a.module === "os-bridge");
    if (!app) {
      showToast("OS Bridge unavailable");
      return null;
    }
    try {
      return await launchApp(app, {
        route: { page },
        full: true,
        reuse: true,
        skipJobs: true,
      });
    } catch (err) {
      showToast(err?.message || "Could not open OS Bridge");
      return null;
    }
  },
};

window.MySpaceFiles = {
  async open(route) {
    const raw = route?.page || "browse";
    const page = ["browse", "recent", "favorites", "downloads", "documents"].includes(raw)
      ? raw
      : "browse";
    const pathArg = route?.path || route?.folder || "";
    if (!route?.full && !pathArg && window.MySpaceFilesPanel?.show) {
      window.MySpaceFilesPanel.show(page);
      return null;
    }
    const apps = window.MySpaceConfig?.getApps?.() || [];
    const app = apps.find((a) => a.id === "files" || a.module === "files");
    if (!app) {
      showToast("Files unavailable");
      return null;
    }
    try {
      return await launchApp(app, {
        route: pathArg ? { page: "browse", path: pathArg } : { page },
        full: true,
        reuse: true,
        skipJobs: true,
      });
    } catch (err) {
      showToast(err?.message || "Could not open Files");
      return null;
    }
  },
};

window.MySpacePulse = {
  async open(route) {
    const apps = window.MySpaceConfig?.getApps?.() || [];
    const app = apps.find((a) => a.id === "pulse" || a.module === "pulse");
    if (!app) {
      showToast("Pulse unavailable");
      return null;
    }
    const page = route?.page || "directory";
    const navRoute = {
      page,
      moduleId: route?.moduleId || route?.target,
      target: route?.moduleId || route?.target,
    };
    try {
      if (route?.forceRefresh && window.MySpaceWorkspace?.closeTabsForApp) {
        window.MySpaceWorkspace.closeTabsForApp("pulse");
      }
      return await launchApp(app, {
        route: navRoute,
        full: true,
        reuse: route?.forceRefresh ? false : true,
        skipJobs: true,
      });
    } catch (err) {
      showToast(err?.message || "Could not open Pulse");
      return null;
    }
  },
};

window.MySpaceMsl = {
  async open(route) {
    const apps = window.MySpaceConfig?.getApps?.() || [];
    const app = apps.find((a) => a.id === "msl-protocol" || a.module === "msl-protocol");
    if (!app) {
      showToast("MSL unavailable");
      return null;
    }
    const page = route?.page || route?.tab || "caps";
    try {
      if (route?.forceRefresh && window.MySpaceWorkspace?.closeTabsForApp) {
        window.MySpaceWorkspace.closeTabsForApp("msl-protocol");
      }
      return await launchApp(app, {
        route: { page },
        full: true,
        reuse: route?.forceRefresh ? false : true,
        skipJobs: true,
      });
    } catch (err) {
      showToast(err?.message || "Could not open MSL");
      return null;
    }
  },
};

window.MySpaceParts = {
  async open(route) {
    const apps = window.MySpaceConfig?.getApps?.() || [];
    const app = apps.find((a) => a.id === "parts" || a.module === "parts");
    if (!app) {
      showToast("Parts unavailable");
      return null;
    }
    const page = route?.page || "explore";
    const navRoute = {
      page,
      id: route?.id || route?.part || route?.param,
      part: route?.id || route?.part || route?.param,
      param: route?.id || route?.part || route?.param,
      app: route?.app,
    };
    try {
      if (route?.forceRefresh && window.MySpaceWorkspace?.closeTabsForApp) {
        window.MySpaceWorkspace.closeTabsForApp("parts");
      }
      return await launchApp(app, {
        route: navRoute,
        full: true,
        reuse: route?.forceRefresh ? false : true,
        skipJobs: true,
      });
    } catch (err) {
      showToast(err?.message || "Could not open Parts");
      return null;
    }
  },
};

window.MySpacePermissions = {
  async open(route) {
    const apps = window.MySpaceConfig?.getApps?.() || [];
    const app = apps.find((a) => a.id === "permissions" || a.module === "permissions");
    if (!app) {
      showToast("Permissions unavailable");
      return null;
    }
    const page = route?.page || "overview";
    try {
      if (route?.forceRefresh && window.MySpaceWorkspace?.closeTabsForApp) {
        window.MySpaceWorkspace.closeTabsForApp("permissions");
      }
      return await launchApp(app, {
        route: { page },
        full: true,
        reuse: route?.forceRefresh ? false : true,
        skipJobs: true,
      });
    } catch (err) {
      showToast(err?.message || "Could not open Permissions");
      return null;
    }
  },
};
window.MySpaceJobs = {
  async open(route) {
    const apps = window.MySpaceConfig?.getApps?.() || [];
    const app = apps.find((a) => a.id === "jobs" || a.module === "jobs");
    if (!app) {
      showToast("Jobs unavailable");
      return null;
    }
    const page = route?.page || route?.tab || "queue";
    try {
      if (route?.forceRefresh && window.MySpaceWorkspace?.closeTabsForApp) {
        window.MySpaceWorkspace.closeTabsForApp("jobs");
      }
      return await launchApp(app, {
        route: { page },
        full: true,
        reuse: route?.forceRefresh ? false : true,
        skipJobs: true,
      });
    } catch (err) {
      showToast(err?.message || "Could not open Jobs");
      return null;
    }
  },
};
window.MySpaceScheduler = {
  async open(route) {
    const apps = window.MySpaceConfig?.getApps?.() || [];
    const app = apps.find((a) => a.id === "scheduler" || a.module === "scheduler");
    if (!app) {
      showToast("Scheduler unavailable");
      return null;
    }
    const page = route?.page || route?.tab || "active";
    try {
      if (route?.forceRefresh && window.MySpaceWorkspace?.closeTabsForApp) {
        window.MySpaceWorkspace.closeTabsForApp("scheduler");
      }
      return await launchApp(app, {
        route: { page },
        full: true,
        reuse: route?.forceRefresh ? false : true,
        skipJobs: true,
      });
    } catch (err) {
      showToast(err?.message || "Could not open Scheduler");
      return null;
    }
  },
};
window.MySpaceResolve = {
  async open(route) {
    const apps = window.MySpaceConfig?.getApps?.() || [];
    const app = apps.find((a) => a.id === "resolve" || a.module === "resolve");
    if (!app) {
      showToast("Resolve unavailable");
      return null;
    }
    const page = route?.page || "inbox";
    try {
      if (route?.forceRefresh && window.MySpaceWorkspace?.closeTabsForApp) {
        window.MySpaceWorkspace.closeTabsForApp("resolve");
      }
      return await launchApp(app, {
        route: { page, incidentId: route?.incidentId || null },
        full: true,
        reuse: route?.forceRefresh ? false : true,
        skipJobs: true,
      });
    } catch (err) {
      showToast(err?.message || "Could not open Resolve");
      return null;
    }
  },
};
window.MySpaceUpdates = {
  async open(route) {
    const apps = window.MySpaceConfig?.getApps?.() || [];
    const app = apps.find((a) => a.id === "updates" || a.module === "updates");
    if (!app) {
      showToast("Updates unavailable");
      return null;
    }
    const page = route?.page || "pending";
    try {
      if (route?.forceRefresh && window.MySpaceWorkspace?.closeTabsForApp) {
        window.MySpaceWorkspace.closeTabsForApp("updates");
      }
      return await launchApp(app, {
        route: { page },
        full: true,
        reuse: route?.forceRefresh ? false : true,
        skipJobs: true,
      });
    } catch (err) {
      showToast(err?.message || "Could not open Updates");
      return null;
    }
  },
};
window.MySpaceNetwork = {
  async open(route) {
    const apps = window.MySpaceConfig?.getApps?.() || [];
    const app = apps.find((a) => a.id === "network" || a.module === "network");
    if (!app) {
      showToast("Network unavailable");
      return null;
    }
    const page = route?.page || "status";
    try {
      if (route?.forceRefresh && window.MySpaceWorkspace?.closeTabsForApp) {
        window.MySpaceWorkspace.closeTabsForApp("network");
      }
      return await launchApp(app, {
        route: { page },
        full: true,
        reuse: route?.forceRefresh ? false : true,
        skipJobs: true,
      });
    } catch (err) {
      showToast(err?.message || "Could not open Network");
      return null;
    }
  },
};
window.MySpaceInfo = {
  async open(route) {
    const apps = window.MySpaceConfig?.getApps?.() || [];
    const app = apps.find((a) => a.id === "apps-info" || a.module === "apps-info");
    if (!app) {
      showToast("Info unavailable");
      return null;
    }
    const page = route?.page || "catalog";
    try {
      if (route?.forceRefresh && window.MySpaceWorkspace?.closeTabsForApp) {
        window.MySpaceWorkspace.closeTabsForApp("apps-info");
      }
      return await launchApp(app, {
        route: { page, id: route?.id || null },
        full: true,
        reuse: route?.forceRefresh ? false : true,
        skipJobs: true,
      });
    } catch (err) {
      showToast(err?.message || "Could not open Info");
      return null;
    }
  },
};
window.MySpaceBackup = {
  async open(route) {
    const apps = window.MySpaceConfig?.getApps?.() || [];
    const app = apps.find((a) => a.id === "backup" || a.module === "backup");
    if (!app) {
      showToast("Backup unavailable");
      return null;
    }
    const page = route?.page || "status";
    try {
      if (route?.forceRefresh && window.MySpaceWorkspace?.closeTabsForApp) {
        window.MySpaceWorkspace.closeTabsForApp("backup");
      }
      return await launchApp(app, {
        route: { page },
        full: true,
        reuse: route?.forceRefresh ? false : true,
        skipJobs: true,
      });
    } catch (err) {
      showToast(err?.message || "Could not open Backup");
      return null;
    }
  },
};
window.MySpaceStorage = {
  async open(route) {
    const apps = window.MySpaceConfig?.getApps?.() || [];
    const app = apps.find((a) => a.id === "storage" || a.module === "storage");
    if (!app) {
      showToast("Storage unavailable");
      return null;
    }
    const page = route?.page || "status";
    try {
      if (route?.forceRefresh && window.MySpaceWorkspace?.closeTabsForApp) {
        window.MySpaceWorkspace.closeTabsForApp("storage");
      }
      return await launchApp(app, {
        route: { page },
        full: true,
        reuse: route?.forceRefresh ? false : true,
        skipJobs: true,
      });
    } catch (err) {
      showToast(err?.message || "Could not open Storage");
      return null;
    }
  },
};
window.MySpaceThemes = {
  async open(route) {
    const apps = window.MySpaceConfig?.getApps?.() || [];
    const app = apps.find((a) => a.id === "themes" || a.module === "themes");
    if (!app) {
      showToast("Themes unavailable");
      return null;
    }
    const page = route?.page || "apps";
    try {
      if (route?.forceRefresh && window.MySpaceWorkspace?.closeTabsForApp) {
        window.MySpaceWorkspace.closeTabsForApp("themes");
      }
      return await launchApp(app, {
        route: { page, appId: route?.appId || route?.id || null },
        full: true,
        reuse: route?.forceRefresh ? false : true,
        skipJobs: true,
      });
    } catch (err) {
      showToast(err?.message || "Could not open Themes");
      return null;
    }
  },
};
window.MySpaceBrowser = {
  async open() {
    try {
      const home = await window.mySpace?.getMyspaceBrowserHome?.();
      if (!home?.ok && !home?.url) {
        showToast(home?.error || "My Space Browser unavailable");
        return null;
      }
      const url = home.url;
      const title = home.name || "My Space Browser";
      const iconUrl = home.iconUrl || "brand/atom-green.png";
      return window.MySpaceJobsRuntime?.performConnectOpen?.({
        url,
        title,
        appId: "connect-myspace-browser",
        preload: home.preload || null,
        iconUrl,
      });
    } catch (err) {
      showToast(err?.message || "Could not open Browser");
      return null;
    }
  },
};

async function launchApp(app, options = {}) {
  return launchAppDirect(app, options);
}

async function launchAppDirect(app, options = {}) {
  if ((app?.id === "os-bridge" || app?.module === "os-bridge") && options.full !== true) {
    const page = ["devices", "places", "actions", "host"].includes(options.route?.page)
      ? options.route.page
      : "devices";
    window.MySpaceBridgePanel?.show?.(page);
    return null;
  }
  if ((app?.id === "files" || app?.module === "files") && options.full !== true && !options.route?.path) {
    const page = ["browse", "recent", "favorites", "downloads", "documents"].includes(options.route?.page)
      ? options.route.page
      : "browse";
    window.MySpaceFilesPanel?.show?.(page);
    return null;
  }
  if ((app.type === "external" || app.type === "myapp") && !window.MySpaceDesktop.isFullDesktop()) {
    showToast("Use open.bat (not the browser). Close any localhost tab.");
    return null;
  }
  if (!window.MySpaceWorkspace) {
    showToast("Workspace failed to load");
    return null;
  }
  const reuse = options.reuse !== false;
  let route = options.route || null;
  if (!route && app.type === "myapp") {
    const prefs = window.MySpaceAppPrefs?.get?.(app.id) || {};
    if (prefs.restorePage !== false && prefs.lastPage) {
      route = { page: prefs.lastPage };
    }
  }
  if (route?.page && app.id) {
    window.MySpaceAppPrefs?.set?.(app.id, { lastPage: route.page });
  }
  try {
    const prefs = window.MySpaceAppPrefs?.get?.(app.id) || {};
    const launchPayload = { ...app, openMode: prefs.openMode || "workspace" };
    const result = await window.mySpace.launchApp(launchPayload);
    if (!result?.ok) {
      showToast(result.error || "Could not open the app");
      return null;
    }
    window.MySpaceConfig?.pushPaletteRecent?.({
      kind: "app",
      id: "app:" + app.id,
      title: app.name,
      subtitle: app.description || "App",
      icon:
        app.icon && !String(app.icon).startsWith("http") && !String(app.icon).startsWith("data:")
          ? app.icon
          : window.MySpaceIcons?.emojiFallback?.(app) || "📦",
      appId: app.id,
    });
    if (app.id && app.id !== "welcome" && !app.hidden) {
      window.MySpaceRecentApps?.record?.(app.id);
    }
    const iconSrc = initialLaunchIcon(app);
    let tab = null;
    if (result.mode === "webview") {
      tab = window.MySpaceWorkspace.openWeb(result.url, app.name, {
        appId: app.id,
        iconSrc,
        app,
        reuse,
        forceInApp: result.forceInApp !== false,
        preload: result.preload || null,
      });
    } else if (result.mode === "myapp") {
      tab = window.MySpaceWorkspace.openMyApp(result, app, { appId: app.id, iconSrc, reuse, route });
    } else if (result.mode === "embedded") {
      tab = window.MySpaceWorkspace.openEmbedded(app, result, {
        appId: app.id,
        iconSrc,
        reuse,
      });
    } else if (result.mode === "external") {
      tab = window.MySpaceWorkspace.openExternal(app, result, {
        appId: app.id,
        iconSrc,
        reuse,
        autoLaunch: result.autoLaunch !== false,
      });
    } else if (result.builtin || result.mode === "builtin") {
      await showBuiltin();
      return null;
    } else {
      showToast(`Unknown app type: ${app.type || "?"}`);
      return null;
    }
    resolveLaunchIcon(app)
      .then((resolved) => {
        if (!resolved || !result.mode) return;
        const mode =
          result.mode === "builtin"
            ? null
            : result.mode === "external"
              ? "external"
              : result.mode === "embedded"
                ? "embedded"
                : result.mode;
        if (mode) window.MySpaceWorkspace.updateTabIcon(app.id, mode, resolved);
      })
      .catch(() => {});
    return tab || window.MySpaceAppMenu?.findOpenTab?.(app) || null;
  } catch (err) {
    console.error("launchApp:", err);
    showToast(err?.message || "Could not open the app");
    return null;
  }
}

async function openAppsSplit(leftApp, rightApp) {
  if (!leftApp || !rightApp) {
    showToast("Pick two apps to split");
    return;
  }
  if (leftApp.id === rightApp.id) {
    showToast("Choose a different second app");
    return;
  }
  const snappable = (a) => a.type === "myapp" || a.type === "url" || a.type === "external";
  if (!snappable(leftApp) || !snappable(rightApp)) {
    showToast("Split works with My Space apps, websites, and embedded Windows apps");
    return;
  }
  const leftTab = await launchApp(leftApp, { reuse: true });
  const rightTab = await launchApp(rightApp, { reuse: true });
  const left =
    leftTab ||
    window.MySpaceAppMenu?.findOpenTab?.(leftApp) ||
    (window.MySpaceWorkspace?.getTabs?.() || []).find((t) => t.appId === leftApp.id && t.mode !== "external");
  const right =
    rightTab ||
    window.MySpaceAppMenu?.findOpenTab?.(rightApp) ||
    (window.MySpaceWorkspace?.getTabs?.() || []).find((t) => t.appId === rightApp.id && t.mode !== "external");

  if (!left?.id || !right?.id) {
    showToast("Could not open both apps for split");
    return;
  }
  if (left.mode === "external" || right.mode === "external") {
    showToast("Cannot split: that Windows app opens outside My Space");
    return;
  }
  const ok = window.MySpaceWorkspace?.snapSideBySide?.(left.id, right.id);
  if (!ok) showToast("Could not snap side by side");
}

function openBesidePicker(leftApp) {
  const candidates = (window.MySpaceConfig?.getApps?.() || []).filter(
    (a) =>
      a.id !== leftApp.id &&
      a.id !== "welcome" &&
      !a.hidden &&
      (a.type === "myapp" || a.type === "url" || a.type === "external")
  );
  if (!candidates.length) {
    showToast("No other apps available to open beside");
    return;
  }
  const options = candidates
    .map((a) => `<option value="${a.id}">${escapeHtmlLite(a.name)}</option>`)
    .join("");
  window.MySpaceModals?.open?.({
    title: `Open beside ${leftApp.name}`,
    bodyHtml: `
      <p class="field-hint" style="margin:0 0 0.75rem">Choose a second app to open side by side on this screen.</p>
      <label class="field" for="beside-app-pick">
        <span class="field-label">App</span>
        <select id="beside-app-pick" class="field-input">${options}</select>
      </label>
    `,
    footerButtons: [
      { label: "Cancel" },
      {
        label: "Open split",
        primary: true,
        onClick: () => {
          const id = document.getElementById("beside-app-pick")?.value;
          const other = window.MySpaceConfig.getApps().find((a) => a.id === id);
          if (!other) {
            showToast("App not found");
            return false;
          }
          openAppsSplit(leftApp, other);
          return true;
        },
      },
    ],
  });
}

function escapeHtmlLite(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
async function saveNewApp(data) {
  if (data.type === "external" && window.mySpace?.validateExternalApp) {
    const check = await window.mySpace.validateExternalApp(data);
    if (!check.ok) {
      showToast(check.error);
      return;
    }
    data.paths = check.paths;
    data.iconData = check.iconData;
  }
  window.MySpaceConfig.addApp(data);
  showToast(`Added "${data.name}"`);
  refreshDesktop();
}

function addApp(defaultTab = "installed") {
  if (!window.MySpaceAppPicker?.open) {
    showToast("Could not load app picker: press Ctrl+Shift+I for errors");
    return;
  }
  try {
    window.MySpaceAppPicker.open({
      defaultTab,
      onAdd: (data) => saveNewApp(data),
    });
  } catch (err) {
    console.error(err);
    showToast(err.message || "Failed to open app picker");
  }
}

function editApp(app) {
  window.MySpaceModals.openEditApp(app, (data) => {
    window.MySpaceConfig.updateApp(app.id, data);
    showToast(`Updated "${data.name}"`);
    refreshDesktop();
  });
}

function removeApp(app) {
  window.MySpaceModals.openConfirm(
    {
      title: "Remove shortcut",
      message: `Remove "${app.name}" from your desktop?`,
      confirmLabel: "Remove",
      danger: true,
    },
    async () => {
      const result = await window.MySpaceConfig.removeApp(app.id);
      if (!result.ok) {
        showToast(result.error);
        return;
      }
      clearSelection();
      showToast(`Removed "${app.name}"`);
      refreshDesktop();
    }
  );
}

function resetLayout() {
  window.MySpaceModals.openConfirm(
    {
      title: "Reset layout",
      message: "Reset all icon positions to the default layout?",
      confirmLabel: "Reset",
    },
    () => {
      window.MySpaceConfig.resetPositions();
      showToast("Icon positions reset");
      refreshDesktop({ relayout: "groups" });
    }
  );
}

function openSettings() {
  if (!window.MySpaceSettingsPage?.open) {
    showToast("Settings page unavailable");
    return;
  }
  window.MySpaceSettingsPage.open();
}

async function refreshDesktop(options = {}) {
  let apps = window.MySpaceConfig.getApps().filter((a) => a.id !== "welcome" && !a.hidden);
  const allowed = window.MySpaceFocus?.allowedAppIds?.();
  if (allowed) {
    apps = apps.filter((a) => allowed.has(a.id));
  }
  const built = await Promise.all(apps.map((app, index) => createAppTile(app, index)));
  appGrid.replaceChildren(...built.map((x) => x.btn));
  const layoutOnce = () => {
    const ids = built.map((x) => x.app.id);
    const force = options.relayout === "groups" || options.relayout === true;
    const incomplete = window.MySpaceDrag?.positionsNeedRelayout?.(ids);
    const layoutVer = Number(window.MySpaceConfig?.getSettings?.()?.desktopIconLayoutVersion) || 0;
    const LAYOUT_VERSION = 4;
    if (force || incomplete || layoutVer < LAYOUT_VERSION) {
      window.MySpaceDrag.applyLayout(appGrid, ids, {
        persist: true,
        layoutVersion: LAYOUT_VERSION,
      });
    } else {
      built.forEach(({ btn, index, app }) => {
        window.MySpaceDrag.applyPosition(btn, app.id, index, appGrid, null);
      });
    }
    built.forEach(({ btn, app }) => {
      window.MySpaceDrag.enableDrag(btn, app.id, appGrid);
      if (selectedAppId === app.id) btn.classList.add("selected");
    });
    refreshOpenIndicators();
  };

  requestAnimationFrame(() => requestAnimationFrame(layoutOnce));
}

function refreshOpenIndicators() {
  if (!window.MySpaceAppMenu?.isAppOpen) return;
  document.querySelectorAll(".app-tile[data-app-id]").forEach((btn) => {
    const app = window.MySpaceConfig.getApps().find((a) => a.id === btn.dataset.appId);
    if (!app) return;
    btn.classList.toggle("app-tile--open", window.MySpaceAppMenu.isAppOpen(app));
  });
}

function setupTaskbar() {
  const startBtn = document.getElementById("btn-start");
  startBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    window.MySpaceStartMenu?.toggle(startBtn, {
      onLaunch: (app) => launchApp(app),
      onAdd: () => addApp("installed"),
      onSettings: openSettings,
    });
  });
  document.getElementById("btn-connect")?.addEventListener("click", (e) => {
    e.stopPropagation();
    void window.MySpaceConnect?.open?.();
  });
  document.getElementById("btn-settings")?.addEventListener("click", openSettings);
  setupAccountChip();
}

function setupAccountChip() {
  const btn = document.getElementById("btn-account");
  const menu = document.getElementById("account-menu");
  const label = document.getElementById("account-label");
  const avatar = document.getElementById("account-avatar");
  const menuHead = document.getElementById("account-menu-head");
  const btnSignIn = document.getElementById("account-sign-in");
  const btnCreate = document.getElementById("account-create");
  const btnSwitch = document.getElementById("account-switch");
  const btnSignOut = document.getElementById("account-sign-out");
  const sheet = document.getElementById("os-account-sheet");
  const backdrop = document.getElementById("os-account-backdrop");
  const form = document.getElementById("os-account-form");
  const username = document.getElementById("os-account-username");
  const password = document.getElementById("os-account-password");
  const password2 = document.getElementById("os-account-password2");
  const labelPassword2 = document.getElementById("os-account-label-password2");
  const remember = document.getElementById("os-account-remember");
  const errorEl = document.getElementById("os-account-error");
  const submit = document.getElementById("os-account-submit");
  const cancel = document.getElementById("os-account-cancel");
  const tabSignIn = document.getElementById("os-account-tab-signin");
  const tabRegister = document.getElementById("os-account-tab-register");
  const sheetSub = document.getElementById("os-account-sub");
  if (!btn || !menu || !window.mySpace?.identity) return;
  let registerMode = false;
  let currentUser = null;

  function closeMenu() {
    menu.classList.add("hidden");
    btn.setAttribute("aria-expanded", "false");
  }

  function openMenu() {
    menu.classList.remove("hidden");
    btn.setAttribute("aria-expanded", "true");
  }

  function setSheetMode(isRegister) {
    registerMode = isRegister;
    tabSignIn?.classList.toggle("active", !isRegister);
    tabRegister?.classList.toggle("active", isRegister);
    labelPassword2?.classList.toggle("hidden", !isRegister);
    password2?.classList.toggle("hidden", !isRegister);
    if (password2) password2.required = isRegister;
    if (sheetSub) {
      sheetSub.textContent = isRegister
        ? t("shell.account.sheetSubCreate", null, "Create a My Space account on this computer")
        : t("shell.account.sheetSub", null, "Sign in to sync desktop settings to your profile");
      sheetSub.setAttribute(
        "data-i18n",
        isRegister ? "shell.account.sheetSubCreate" : "shell.account.sheetSub"
      );
    }
    if (submit) {
      submit.textContent = isRegister
        ? t("shell.account.create", null, "Create account")
        : t("shell.account.signIn", null, "Sign in");
    }
    errorEl?.classList.add("hidden");
  }

  function openSheet(isRegister) {
    closeMenu();
    setSheetMode(Boolean(isRegister));
    if (form) form.reset();
    if (remember) remember.checked = true;
    sheet?.classList.remove("hidden");
    username?.focus();
  }

  function closeSheet() {
    sheet?.classList.add("hidden");
    errorEl?.classList.add("hidden");
  }

  function t(key, vars, fallback) {
    const I = window.MySpaceI18n;
    if (!I?.t) return fallback || key;
    const v = I.t(key, vars);
    return v === key ? fallback || key : v;
  }

  async function refreshAccountUi(user) {
    currentUser = user || null;
    const signedIn = Boolean(user?.username);
    if (label) {
      label.textContent = signedIn ? user.username : t("shell.account.guest", null, "Guest");
      if (!signedIn) label.setAttribute("data-i18n", "shell.account.guest");
      else label.removeAttribute("data-i18n");
    }
    if (avatar) {
      avatar.alt = signedIn ? user.username : "My Space";
      avatar.classList.toggle("taskbar-account-avatar--guest", !signedIn);
    }
    if (menuHead) {
      menuHead.textContent = signedIn
        ? t("shell.account.signedInAs", { name: user.username }, `Signed in as ${user.username}`)
        : t("shell.account.notSignedIn", null, "Not signed in");
      if (!signedIn) menuHead.setAttribute("data-i18n", "shell.account.notSignedIn");
      else menuHead.removeAttribute("data-i18n");
    }
    btnSignIn?.classList.toggle("hidden", signedIn);
    btnCreate?.classList.toggle("hidden", signedIn);
    btnSwitch?.classList.toggle("hidden", !signedIn);
    btnSignOut?.classList.toggle("hidden", !signedIn);
    btn.title = signedIn
      ? `My Space — ${user.username}`
      : t("shell.account.title", null, "My Space account");
  }
  window.__myspaceRefreshAccountI18n = () => refreshAccountUi(currentUser);

  async function reloadDesktopForProfile() {
    try {
      await window.MySpaceConfig.reloadFromProfile();
      applyHeader();
      await refreshDesktop();
      window.MySpaceTaskbar?.refresh?.();
      window.MySpaceAppRail?.refresh?.();
    } catch (err) {
      console.error("Profile reload failed:", err);
      showToast("Could not reload desktop profile");
    }
  }

  async function syncFromStatus() {
    try {
      const status = await window.mySpace.identity.status();
      await refreshAccountUi(status?.user || null);
    } catch {
      await refreshAccountUi(null);
    }
  }
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menu.classList.contains("hidden")) openMenu();
    else closeMenu();
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#taskbar-account-wrap")) closeMenu();
  });
  btnSignIn?.addEventListener("click", () => openSheet(false));
  btnCreate?.addEventListener("click", () => openSheet(true));
  btnSwitch?.addEventListener("click", async () => {
    closeMenu();
    await window.mySpace.identity.logout();
    await reloadDesktopForProfile();
    openSheet(false);
  });
  btnSignOut?.addEventListener("click", async () => {
    closeMenu();
    const res = await window.mySpace.identity.logout();
    if (res?.ok === false) {
      showToast(res.error || "Could not sign out");
      return;
    }
    await refreshAccountUi(null);
    await reloadDesktopForProfile();
    showToast(t("shell.account.signedOutToast", null, "Signed out of My Space"));
  });
  tabSignIn?.addEventListener("click", () => setSheetMode(false));
  tabRegister?.addEventListener("click", () => setSheetMode(true));
  backdrop?.addEventListener("click", closeSheet);
  cancel?.addEventListener("click", closeSheet);
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl?.classList.add("hidden");
    const u = String(username?.value || "").trim();
    const p = String(password?.value || "");
    const p2 = String(password2?.value || "");
    if (registerMode && p !== p2) {
      if (errorEl) {
        errorEl.textContent = "Passwords do not match";
        errorEl.classList.remove("hidden");
      }
      return;
    }
    if (submit) submit.disabled = true;
    try {
      const payload = { username: u, password: p, remember: remember?.checked !== false };
      const res = registerMode
        ? await window.mySpace.identity.register(payload)
        : await window.mySpace.identity.login(payload);
      if (!res?.ok) {
        if (errorEl) {
          errorEl.textContent = res?.error || "Could not continue";
          errorEl.classList.remove("hidden");
        }
        return;
      }
      closeSheet();
      await refreshAccountUi(res.user);
      await reloadDesktopForProfile();
      showToast(registerMode
        ? t("shell.account.welcome", { name: res.user.username }, `Welcome, ${res.user.username}`)
        : t("shell.account.signedInToast", { name: res.user.username }, `Signed in as ${res.user.username}`));
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err?.message || String(err);
        errorEl.classList.remove("hidden");
      }
    } finally {
      if (submit) submit.disabled = false;
    }
  });
  window.mySpace.identity.onChanged?.(async (data) => {
    await refreshAccountUi(data?.user || null);
    await reloadDesktopForProfile();
  });

  void syncFromStatus();
}

function setupKeyboard() {
  document.addEventListener("keydown", (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.altKey && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      openCommandPalette();
      return;
    }
    if (mod && e.key === " " && !e.altKey) {
      e.preventDefault();
      openCommandPalette();
      return;
    }
    if (mod && !e.altKey && (e.key === "/" || e.key === "?")) {
      e.preventDefault();
      window.MySpaceShortcutsHelp?.toggle?.();
      return;
    }
    if (mod && e.shiftKey && (e.key === "f" || e.key === "F")) {
      e.preventDefault();
      if (window.MySpaceFiles?.open) {
        void window.MySpaceFiles.open({ full: true });
      } else {
        window.MySpaceShellBridge?.executeCommand?.("files(full)", "shortcut");
      }
      return;
    }
    if (mod && e.key === "n" && e.shiftKey) {
      e.preventDefault();
      window.mySpace?.openNewWindow?.().catch(() => showToast("Could not open window"));
      return;
    }
    if (mod && e.altKey && !e.shiftKey && (e.key === "ArrowLeft" || e.key === "Left")) {
      e.preventDefault();
      void window.MySpaceDesktopSpaces?.cycle?.(-1);
      return;
    }
    if (mod && e.altKey && !e.shiftKey && (e.key === "ArrowRight" || e.key === "Right")) {
      e.preventDefault();
      void window.MySpaceDesktopSpaces?.cycle?.(1);
      return;
    }
    if (mod && e.altKey && !e.shiftKey && (e.key === "d" || e.key === "D")) {
      e.preventDefault();
      void window.MySpaceDesktopSpaces?.createDesktop?.();
      return;
    }
    if (mod && e.altKey && !e.shiftKey && (e.key === "F4" || e.key === "w" || e.key === "W")) {
      e.preventDefault();
      void window.MySpaceDesktopSpaces?.closeDesktop?.();
      return;
    }
    if (mod && e.altKey && !e.shiftKey && (e.key === "Tab" || e.key === "t" || e.key === "T")) {
      e.preventDefault();
      window.MySpaceDesktopSpaces?.toggleOverview?.();
      return;
    }
    if (mod && e.key === "\\" && !e.altKey) {
      e.preventDefault();
      const ok = window.MySpaceWorkspace?.toggleSnap?.();
      if (!ok && !window.MySpaceWorkspace?.isSnapActive?.()) {
        showToast("Open two apps first, then snap");
      }
      return;
    }
    if (e.key === "Delete" && selectedAppId) {
      const app = window.MySpaceConfig.getApps().find((a) => a.id === selectedAppId);
      if (app && window.MySpaceConfig.canRemove(app.id)) removeApp(app);
    }
    if (e.key === "Enter" && selectedAppId) {
      const app = window.MySpaceConfig.getApps().find((a) => a.id === selectedAppId);
      if (app) launchApp(app);
    }
    if (e.key === "Escape") {
      window.MySpaceTaskbar?.hidePeek?.();
      if (window.MySpaceDesktopSpaces?.isOverviewOpen?.()) {
        window.MySpaceDesktopSpaces.hideOverview();
        return;
      }
      if (window.MySpaceCommandPalette?.isOpen?.()) {
        window.MySpaceCommandPalette.hide();
        return;
      }
      if (window.MySpaceShortcutsHelp?.isOpen?.()) {
        window.MySpaceShortcutsHelp.hide();
        return;
      }
      if (window.MySpaceShellLine?.isOpen?.()) {
        window.MySpaceShellLine.hide();
        return;
      }
      }
      if (window.MySpaceStartMenu?.isOpen?.()) {
        window.MySpaceStartMenu.close();
        return;
      }
      if (window.MySpaceWorkspace?.isSnapActive?.()) {
        window.MySpaceWorkspace.clearSnap();
        return;
      }
      if (window.MySpaceWorkspace?.isOpen()) {
        window.MySpaceWorkspace.minimizeToDesktop();
        return;
      }
      clearSelection();
      window.MySpaceContextMenu.hide();
      window.MySpaceModals.close();
    }
  });
}

const BOOT_SPLASH_MIN_MS = 5000;
const bootSplashStartedAt = window.__bootSplashStartedAt || performance.now();
let bootSplashPctRaf = 0;
let bootSplashReady = false;

function setBootSplashPct(pct) {
  const el = document.getElementById("boot-splash-pct");
  if (!el) return;
  el.textContent = `${Math.max(0, Math.min(100, Math.round(pct)))}%`;
}

function tickBootSplashPct() {
  const splash = document.getElementById("boot-splash");
  const el = document.getElementById("boot-splash-pct");
  if (!splash || !el || splash.classList.contains("is-done")) {
    bootSplashPctRaf = 0;
    return;
  }
  const elapsed = performance.now() - bootSplashStartedAt;
  let pct;
  if (bootSplashReady) {
    pct = 100;
  } else if (elapsed >= BOOT_SPLASH_MIN_MS) {
    pct = 99;
  } else {
    pct = (elapsed / BOOT_SPLASH_MIN_MS) * 99;
  }
  setBootSplashPct(pct);
  if (pct < 100) {
    bootSplashPctRaf = requestAnimationFrame(tickBootSplashPct);
  } else {
    bootSplashPctRaf = 0;
  }
}

async function dismissBootSplash() {
  const unlockShell = () => {
    try {
      document.documentElement.classList.remove("booting");
    } catch {
    }
  };
  try {
    if (document.documentElement.classList.contains("boot-splash-skip")) {
      return;
    }
    const el = document.getElementById("boot-splash");
    if (!el || el.classList.contains("is-done")) {
      return;
    }
    if (el.dataset.dismissing === "1") {
      return;
    }
    el.dataset.dismissing = "1";
    const wait = Math.max(0, BOOT_SPLASH_MIN_MS - (performance.now() - bootSplashStartedAt));
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    bootSplashReady = true;
    window.__bootSplashReady = true;
    setBootSplashPct(100);
    await new Promise((resolve) => setTimeout(resolve, 180));
    if (el.isConnected) {
      el.classList.add("is-done");
      el.setAttribute("aria-busy", "false");
      const remove = () => {
        if (bootSplashPctRaf) cancelAnimationFrame(bootSplashPctRaf);
        bootSplashPctRaf = 0;
        if (el.isConnected) el.remove();
      };
      el.addEventListener("transitionend", remove, { once: true });
      setTimeout(remove, 800);
    }
  } finally {
    unlockShell();
  }
}

async function init() {
  window.showMySpaceToast = showToast;
  window.launchMySpaceApp = launchApp;
  window.addEventListener("unhandledrejection", (e) => {
    console.error("My Space:", e.reason);
  });
  if (navigator.userAgent.includes("Electron") && !window.MySpaceDesktop.isFullDesktop()) {
    showToast("Desktop bridge failed.", 8000);
  }
  updateClock();
  setInterval(updateClock, 1000);
  backBtn.addEventListener("click", showDesktop);
  await window.MySpaceConfig.init(window.mySpace);
  window.MySpaceI18nBoot?.boot?.();
  window.addEventListener("myspace-i18n-applied", () => {
    try {
      window.__myspaceRefreshAccountI18n?.();
      window.MySpaceAppRail?.refresh?.();
      applyHeader();
      renderWelcomeHub();
      window.MySpaceI18n?.applyDom?.(document);
      window.MySpaceNotificationsBell?.refresh?.();
      window.MySpaceStartMenu?.refresh?.();
      window.MySpaceCommandPalette?.refresh?.();
      window.MySpacePlatformCatalog?.refreshI18n?.();
      try {
        if (window.MySpaceSettingsPage?.isOpen?.()) window.MySpaceSettingsPage.open();
      } catch {
      }
      if (window.MySpaceFilesPanel?.isOpen?.()) window.MySpaceFilesPanel.refresh?.();
      if (window.MySpaceMindPanel?.isOpen?.()) window.MySpaceMindPanel.refresh?.();
      if (window.MySpaceLinkPanel?.isOpen?.()) window.MySpaceLinkPanel.refresh?.();
    } catch {
    }
  });
  applyHeader();
  setupTaskbar();
  window.MySpaceNotificationsBell?.refresh?.();
  setupKeyboard();
  workspace.addEventListener("contextmenu", (e) => {
    if (e.target.closest(".app-tile")) return;
    e.preventDefault();
    e.stopPropagation();
    clearSelection();
    openShellLine(e.clientX, e.clientY);
  });
  workspace.addEventListener("click", (e) => {
    if (!e.target.closest(".app-tile")) clearSelection();
  });
  await refreshDesktop();
  window.MySpaceTaskbar?.refresh();
  window.MySpaceAppRail?.refresh?.();
  window.__myspaceAiLaunchApp = (app, options) => launchApp(app, options || {});
  window.__myspaceAiRefreshDesktop = (opts) => refreshDesktop(opts || {});
  window.__myspaceLaunchById = (appId, options) => {
    const app = window.MySpaceConfig.getApps().find((a) => a.id === appId);
    if (app) launchApp(app, options || {});
  };
  window.__myspaceOpenSettings = () => openSettings();
  window.__myspaceOpenPalette = () => openCommandPalette();
  window.__myspaceShowDesktop = () => showDesktop();
  window.MySpaceFocus?.init?.();
  window.MySpaceDesktopSpaces?.init?.({
    captureSession: () => window.MySpaceWorkspace?.getSessionSnapshot?.() || null,
    closeWindows: () => {
      window.MySpaceWorkspace?.clearSnap?.();
      window.MySpaceWorkspace?.closeAllTabs?.();
      window.MySpaceWorkspace?.minimizeToDesktop?.();
    },
    restoreSession: async (session) => {
      if (!session?.tabs?.length) {
        window.MySpaceWorkspace?.minimizeToDesktop?.();
        return;
      }
      await restoreSession(session);
    },
    refreshDesktop: () => refreshDesktop(),
  });
  window.MySpaceAiChat?.init();
  window.mySpace?.onMailEvent?.((data) => {
    if (data?.channel !== "connect-open-web" || !data.url) return;
    void (async () => {
      try {
        const appId = `connect-${data.serviceId || "web"}`;
        const title = data.title || "App";
        const iconUrl =
          data.iconUrl ||
          (data.serviceId === "myspace-browser" ? "brand/atom-green.png" : null);
        window.MySpaceWorkspace?.openWeb?.(data.url, title, {
          reuse: true,
          appId,
          forceInApp: true,
          preload: data.preload || null,
          iconSrc: iconUrl,
        });
        if (data.howto) {
          window.showMySpaceToast?.(String(data.howto).slice(0, 180), 7000);
        } else {
          window.showMySpaceToast?.(`${title} opened in My Space`, 3500);
        }
      } catch (err) {
        console.warn("connect-open-web failed", err);
        window.showMySpaceToast?.(err?.message || "Could not open Connect app", 4000);
      }
    })();
  });
  window.addEventListener("myspace-tabs-change", () => {
    refreshOpenIndicators();
    scheduleSessionSave();
    if (window.MySpaceFocus?.isActive?.()) refreshDesktop();
  });
  window.addEventListener("beforeunload", saveSessionNow);
  window.addEventListener("pagehide", saveSessionNow);
  window.mySpace?.onShellHotkey?.(() => {
    openCommandPalette();
  });
  window.mySpace?.onShortcutsHotkey?.(() => {
    window.MySpaceShortcutsHelp?.toggle?.();
  });
  window.MySpaceHotCorners?.init({
    onDesktop: showDesktop,
    onPalette: openCommandPalette,
    onStart: () => {
      const startBtn = document.getElementById("btn-start");
      window.MySpaceStartMenu?.open?.(startBtn, {
        onLaunch: (app) => launchApp(app),
        onAdd: () => addApp("installed"),
        onSettings: openSettings,
      });
    },
    onShortcuts: () => window.MySpaceShortcutsHelp?.show?.(),
  });

  const shellCtx = buildShellContext();
  window.MySpaceShellWhen?.init({
    showToast,
    execute: (line) => window.MySpaceShellCommands.execute(line, shellCtx),
  });

  function quoteSpacePath(filePath) {
    const p = String(filePath || "").trim();
    if (!p) return "";
    if (/[\s"]/.test(p)) return `"${p.replace(/"/g, "")}"`;
    return p;
  }

  async function openSpacePaths(paths) {
    const list = (paths || []).filter(Boolean);
    for (const filePath of list) {
      const line = `pack(open ${quoteSpacePath(filePath)})`;
      const result = await window.MySpaceShellCommands.execute(line, shellCtx);
      if (result?.ok) showToast(result.message || "Imported .space file");
      else showToast(result?.error || "Could not open .space file");
    }
  }
  window.MySpaceDesktop.launchApp = (app, options) => launchApp(app, options);
  window.MySpaceDesktop.launchAppById = (appId, options) => {
    const app = window.MySpaceConfig.getApps().find((a) => a.id === appId);
    if (!app) return Promise.resolve(null);
    return launchApp(app, options || {});
  };
  window.MySpaceDesktop.refreshDesktop = () => refreshDesktop();
  window.mySpace?.spaceFile?.onOpen?.((data) => {
    openSpacePaths(data?.paths || (data?.path ? [data.path] : []));
  });

  document.addEventListener("dragover", (e) => {
    const items = [...(e.dataTransfer?.items || [])];
    if (items.some((it) => it.kind === "file")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  });
  document.addEventListener("drop", (e) => {
    const files = [...(e.dataTransfer?.files || [])].filter((f) => /\.space$/i.test(f.name || f.path || ""));
    if (!files.length) return;
    e.preventDefault();
    openSpacePaths(files.map((f) => f.path).filter(Boolean));
  });

  const isSecondaryWindow = new URLSearchParams(window.location.search).get("secondary") === "1";
  let startupSettings = null;
  if (!isSecondaryWindow) {
    startupSettings = await runStartupSequence();
  }
  scheduleSessionSave();
  await dismissBootSplash();
  try {
    applyHeader();
    window.MySpaceDesktopSpaces?.hideOverview?.();
  } catch {
  }
}
init().catch(async (err) => {
  console.error(err);
  try {
    document.body.dataset.bootError = String(err && err.message ? err.message : err);
  } catch {
  }
  await dismissBootSplash();
  const detail = err && err.message ? String(err.message).slice(0, 120) : "";
  showToast(detail ? `Startup error: ${detail}` : "Startup error: check the console (F12)");
});