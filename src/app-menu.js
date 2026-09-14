(function () {
  function toast(msg) {
    window.showMySpaceToast?.(msg);
  }

  function typeLabel(app) {
    const labels = {
      builtin: "Built-in screen",
      myapp: "My Space app",
      url: "Website shortcut",
      external: "Program (opens inside My Space)",
    };
    return labels[app.type] || app.type;
  }

  function headerIcon(app) {
    if (app.icon && !String(app.icon).startsWith("http") && !String(app.icon).startsWith("data:")) {
      return app.icon;
    }
    return window.MySpaceIcons?.emojiFallback(app) || "📦";
  }

  function tabModeForApp(app) {
    if (app.type === "url") return "webview";
    if (app.type === "myapp") return "myapp";
    if (app.type === "external") return "external";
    return null;
  }

  function findOpenTab(app) {
    if (!window.MySpaceWorkspace) return null;
    const tabs = window.MySpaceWorkspace.getTabs() || [];
    if (app.type === "external") {
      return (
        tabs.find((t) => t.appId === app.id && t.mode === "embedded") ||
        tabs.find((t) => t.appId === app.id && t.mode === "external") ||
        null
      );
    }
    const mode = tabModeForApp(app);
    if (!mode) return null;
    return tabs.find((t) => t.appId === app.id && t.mode === mode) || null;
  }

  function isAppOpen(app) {
    return Boolean(findOpenTab(app));
  }

  function buildAppItems(app) {
    const open = isAppOpen(app);
    const canRemove = window.MySpaceConfig?.canRemove(app.id);
    const canNewWindow = app.type === "url" || app.type === "myapp";
    const hasExternalPath = app.type === "external" && (app.paths?.length || app.path);
    const hasFolder = app.type === "myapp" || hasExternalPath;
    const hasCopyTarget = app.type === "url" ? Boolean(app.url) : hasFolder;
    const canBrowser = app.type === "url" && Boolean(app.url);
    const canSplit = app.type === "myapp" || app.type === "url";
    const openTabs = (window.MySpaceWorkspace?.getTabs?.() || []).filter(
      (t) => t.mode !== "external" && t.appId && t.appId !== app.id
    );

    const items = [
      {
        header: {
          title: app.name,
          subtitle: app.description?.trim() || typeLabel(app),
          icon: headerIcon(app),
        },
      },
      { id: "open", label: "Open", icon: "▶", shortcut: "Enter" },
      {
        id: "open-new",
        label: "Open in new window",
        icon: "⧉",
        disabled: !canNewWindow,
      },
      {
        id: "open-split",
        label: openTabs.length ? "Open split" : "Open split",
        icon: "▣",
        disabled: !canSplit || !openTabs.length,
      },
      {
        id: "open-beside",
        label: "Open beside…",
        icon: "⧉",
        disabled: !canSplit,
      },
      {
        id: "switch",
        label: "Switch to window",
        icon: "↗",
        disabled: !open,
      },
    ];

    items.push(
      { separator: true },
      {
        id: "pin-taskbar",
        label: window.MySpaceConfig?.isPinnedToTaskbar?.(app.id)
          ? "Unpin from taskbar"
          : "Pin to taskbar",
        icon: "📍",
      },
      {
        id: "pin",
        label: "Pin to top of desktop",
        icon: "📌",
        disabled: (() => {
          const apps = window.MySpaceConfig?.getApps() || [];
          const idx = apps.findIndex((a) => a.id === app.id);
          const topIdx = apps[0]?.id === "welcome" ? 1 : 0;
          return idx <= topIdx;
        })(),
      },
      { id: "reset-pos", label: "Reset icon position", icon: "↺" },
      {
        id: "duplicate",
        label: "Duplicate shortcut",
        icon: "⎘",
        disabled: !canRemove,
      },
      { id: "properties", label: "Properties…", icon: "⚙" },
      { separator: true },
      {
        id: "reveal",
        label: app.type === "external" ? "Show in File Explorer" : "Open app folder",
        icon: "📁",
        disabled: !hasFolder,
      },
      {
        id: "copy-link",
        label: "Copy link or path",
        icon: "🔗",
        disabled: !hasCopyTarget,
      },
      {
        id: "browser",
        label: "Open in default browser",
        icon: "🌐",
        disabled: !canBrowser,
      },
      { separator: true },
      {
        id: "close",
        label: "Close window",
        icon: "✕",
        disabled: !open,
      },
      {
        id: "remove",
        label: "Remove from desktop",
        icon: "🗑",
        danger: true,
        disabled: !canRemove,
      }
    );

    return items;
  }

  function buildTaskbarItems(tab) {
    const tabs = window.MySpaceWorkspace?.getTabs() || [];
    const frameOpen = window.MySpaceWorkspace?.isOpen();
    const activeInBar = window.MySpaceWorkspace?.isTabActiveInTaskbar(tab.id);
    const pinned = tab.appId && window.MySpaceConfig?.isPinnedToTaskbar?.(tab.appId);
    const canSnap =
      tab.mode !== "external" &&
      tabs.filter((t) => t.mode !== "external").length >= 2;

    let restoreLabel = "Restore";
    if (activeInBar && frameOpen) {
      restoreLabel = "Show desktop";
    } else if (tab.mode === "external") {
      restoreLabel = "Focus program";
    }

    return [
      { header: { title: tab.title, subtitle: tab.mode === "external" ? "External program" : "Window" } },
      { id: "restore", label: restoreLabel, icon: "↗" },
      {
        id: "snap",
        label: window.MySpaceWorkspace?.isSnapActive?.() ? "Exit snap" : "Snap side by side",
        icon: "⧉",
        disabled: window.MySpaceWorkspace?.isSnapActive?.() ? false : !canSnap,
      },
      { id: "close", label: "Close window", icon: "✕", shortcut: "Ctrl+W" },
      { separator: true },
      {
        id: "pin-taskbar",
        label: pinned ? "Unpin from taskbar" : "Pin to taskbar",
        icon: "📍",
        disabled: !tab.appId,
      },
      {
        id: "close-others",
        label: "Close other windows",
        icon: "⊟",
        disabled: tabs.length <= 1,
      },
      {
        id: "close-all",
        label: "Close all windows",
        icon: "⊠",
        disabled: !tabs.length,
      },
    ];
  }

  function buildTabItems(tab) {
    const tabs = window.MySpaceWorkspace?.getTabs() || [];
    const canSnap =
      tab.mode !== "external" &&
      tabs.filter((t) => t.mode !== "external").length >= 2;
    return [
      { header: { title: tab.title, subtitle: "Tab" } },
      {
        id: "snap",
        label: window.MySpaceWorkspace?.isSnapActive?.() ? "Exit snap" : "Snap with next tab",
        icon: "⧉",
        disabled: window.MySpaceWorkspace?.isSnapActive?.() ? false : !canSnap,
      },
      { id: "close", label: "Close tab", icon: "✕" },
      {
        id: "close-others",
        label: "Close other tabs",
        icon: "⊟",
        disabled: tabs.length <= 1,
      },
    ];
  }

  function buildDesktopItems() {
    const hasWindows = window.MySpaceWorkspace?.hasRunningApps?.();
    return [
      { id: "add", label: "Add shortcut…", icon: "＋", shortcut: "⊞ Start" },
      { id: "settings", label: "Settings…", icon: "⚙" },
      { separator: true },
      { id: "refresh", label: "Refresh desktop", icon: "↻" },
      { id: "sort-icons", label: "Sort icons A–Z", icon: "A↓" },
      { id: "reset-layout", label: "Reset icon positions", icon: "↺" },
      { separator: true },
      {
        id: "close-all",
        label: "Close all windows",
        icon: "⊠",
        disabled: !hasWindows,
      },
    ];
  }

  async function copyText(text) {
    if (!text) {
      toast("Nothing to copy");
      return false;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied to clipboard");
      return true;
    } catch {
      toast("Could not copy to clipboard");
      return false;
    }
  }

  async function copyAppLink(app) {
    if (app.type === "url" && app.url) {
      return copyText(app.url);
    }
    if (window.mySpace?.resolveAppPath) {
      const resolved = await window.mySpace.resolveAppPath(app);
      if (resolved?.ok && resolved.path) {
        return copyText(resolved.path);
      }
    }
    toast("No link or path available");
    return false;
  }

  async function revealApp(app) {
    if (!window.mySpace?.resolveAppPath || !window.mySpace?.revealPath) {
      toast("Not available in preview mode");
      return;
    }
    const resolved = await window.mySpace.resolveAppPath(app);
    if (!resolved?.ok || !resolved.path) {
      toast(resolved?.error || "Path not found");
      return;
    }
    const result = await window.mySpace.revealPath(resolved.path, resolved.kind);
    if (!result?.ok) toast(result?.error || "Could not open folder");
  }

  async function openInBrowser(app) {
    if (app.type !== "url" || !app.url) return;
    if (!window.mySpace?.openSystemUrl) {
      toast("Not available in preview mode");
      return;
    }
    try {
      await window.mySpace.openSystemUrl(app.url);
    } catch {
      toast("Could not open in browser");
    }
  }

  function handleTaskbarAction(action, tab) {
    if (!window.MySpaceWorkspace || !tab) return;

    if (action === "restore") {
      const activeInBar = window.MySpaceWorkspace.isTabActiveInTaskbar(tab.id);
      const frameOpen = window.MySpaceWorkspace.isOpen();
      if (activeInBar && frameOpen && !window.MySpaceWorkspace.isSnapActive?.()) {
        window.MySpaceWorkspace.minimizeToDesktop();
      } else {
        window.MySpaceWorkspace.showWorkspace(tab.id);
      }
      return;
    }

    if (action === "snap") {
      if (window.MySpaceWorkspace.isSnapActive?.()) {
        window.MySpaceWorkspace.clearSnap();
      } else {
        const ok = window.MySpaceWorkspace.snapWithNeighbor(tab.id);
        if (!ok) toast("Need another open app to snap");
      }
      return;
    }

    if (action === "pin-taskbar" && tab.appId) {
      const pinned = window.MySpaceConfig?.isPinnedToTaskbar?.(tab.appId);
      if (pinned) {
        window.MySpaceConfig.unpinFromTaskbar(tab.appId);
        toast(`Unpinned ${tab.title}`);
      } else {
        window.MySpaceConfig.pinToTaskbar(tab.appId);
        toast(`Pinned ${tab.title}`);
      }
      window.MySpaceTaskbar?.refresh?.();
      return;
    }

    if (action === "close") {
      window.MySpaceWorkspace.closeTab(tab.id);
      return;
    }

    if (action === "close-others") {
      window.MySpaceWorkspace.closeOtherTabs(tab.id);
      return;
    }

    if (action === "close-all") {
      window.MySpaceWorkspace.closeAllTabs();
    }
  }

  function handleTabAction(action, tab) {
    handleTaskbarAction(action, tab);
  }

  window.MySpaceAppMenu = {
    buildAppItems,
    buildTaskbarItems,
    buildTabItems,
    buildDesktopItems,
    findOpenTab,
    isAppOpen,
    copyAppLink,
    revealApp,
    openInBrowser,
    handleTaskbarAction,
    handleTabAction,
    typeLabel,
  };
})();