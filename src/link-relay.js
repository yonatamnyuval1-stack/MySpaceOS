(function () {
  const APP_OPEN = {
    notes: (a) => ({ page: "all", noteId: a?.id || a?.ref || a?.title }),
    contacts: (a) => ({ page: "people", contactId: a?.id }),
    files: (a) => ({ page: a?.page || "browse", path: a?.path }),
    stocks: (a) => ({ page: a?.page, param: a?.symbol }),
    translate: (a) => ({ page: "home", text: a?.text }),
    "world-clock": (a) => ({ page: a?.page || "clocks" }),
    "day-planner": (a) => ({ page: a?.page || "today" }),
    geography: (a) => ({ page: a?.page || "explore", param: a?.code }),
    history: (a) => ({ page: a?.page, param: a?.id }),
    space: (a) => ({ page: a?.page || "navigate", param: a?.id }),
    builds: (a) => ({ page: a?.page || "browse", param: a?.id }),
    "study-deck": (a) => ({ page: a?.page || "home", param: a?.id }),
    contracts: (a) => ({ page: a?.page || "library", param: a?.id }),
    profiles: (a) => ({ page: a?.page || "vault", param: a?.id }),
    coupons: (a) => ({ page: a?.page, param: a?.id }),
    chat: (a) => ({ page: a?.page, param: a?.id }),
    mail: (a) => ({ page: a?.page || "hub" }),
    scripts: (a) => ({ page: a?.page || "library", param: a?.id }),
    "shell-console": (a) => ({ page: a?.page || "overview" }),
    "os-bridge": (a) => ({ page: a?.page || "devices" }),
    drift: (a) => ({ page: a?.page }),
    "code-lexicon": (a) => ({ page: a?.page || "browse", param: a?.id }),
    "model-flow": (a) => ({ page: a?.page || "studio" }),
    docs: (a) => ({ page: a?.page || "overview" }),
    "remote-hub": (a) => ({ page: a?.page || "machines" }),
    studies: (a) => ({ page: a?.page || "home", param: a?.id }),
    "world-maps": (a) => ({ page: a?.page }),
    "system-info": (a) => ({ page: a?.page || "system" }),
    "apps-info": (a) => ({ page: a?.page, param: a?.id }),
    "flag-quiz": (a) => ({ page: a?.page }),
    "pi-digits": (a) => ({ page: a?.page }),
    "icon-library": (a) => ({ page: a?.page }),
  };

  const BROWSE_ONLY = {
    files: { browse: (a) => ({ page: "browse", path: a?.path }) },
  };

  function toast(msg) {
    if (typeof window.__myspaceToast === "function") window.__myspaceToast(msg);
    else if (window.MySpaceModals?.toast) window.MySpaceModals.toast(msg);
    else window.showMySpaceToast?.(String(msg || ""));
  }

  function findAppId(target) {
    const apps = window.MySpaceConfig?.getApps?.() || [];
    const aliases = {
      shell: "shell-console",
      console: "shell-console",
      lexicon: "code-lexicon",
      flow: "model-flow",
      clock: "world-clock",
      maps: "world-maps",
      bridge: "os-bridge",
    };
    const key = aliases[target] || target;
    return (
      apps.find((a) => a.id === key)?.id ||
      apps.find((a) => a.module === key)?.id ||
      key
    );
  }

  function launch(appId, route) {
    if (typeof window.__myspaceLaunchById === "function") {
      window.__myspaceLaunchById(appId, { reuse: true, skipJobs: true, route });
      return true;
    }
    return false;
  }

  async function handleDesktop(verb, args, requestId) {
    const link = window.mySpace.link;
    const reply = async (ok, extra) => {
      await link.reply({ requestId, ok, ...(extra || {}) });
    };

    switch (verb) {
      case "toast":
        toast(String(args?.message || ""));
        return reply(true);
      case "launch": {
        const appId = String(args?.appId || "").trim();
        if (!appId) return reply(false, { error: "appId required" });
        launch(appId, args?.page ? { page: args.page } : undefined);
        return reply(true);
      }
      case "showDesktop":
        window.__myspaceShowDesktop?.();
        return reply(true);
      case "openSettings":
        window.__myspaceOpenSettings?.();
        return reply(true);
      case "openSearch":
        window.__myspaceOpenPalette?.();
        return reply(true);
      case "openNotifications":
        window.MySpaceNotificationsBell?.open?.();
        return reply(true);
      case "openPlatform":
        window.MySpacePlatformCatalog?.show?.();
        return reply(true);
      case "openPulse":
        await window.MySpacePulse?.open?.({
          page: args?.page || "directory",
          moduleId: args?.moduleId,
          forceRefresh: true,
        });
        return reply(true);
      case "openMsl":
        window.MySpaceMslPanel?.show?.(args?.tab || "caps");
        return reply(true);
      case "openJobs":
        if (window.MySpaceJobs?.open) {
          await window.MySpaceJobs.open({ page: args?.page || args?.tab || "queue" });
        } else {
          window.MySpaceJobsPanel?.show?.(args?.page || args?.tab || "queue");
        }
        return reply(true);
      case "openScheduler":
        if (window.MySpaceScheduler?.open) {
          await window.MySpaceScheduler.open({ page: args?.page || args?.tab || "active" });
        }
        return reply(true);
      case "openMind":
        if (args?.page === "setup") window.MySpaceMindPanel?.show?.("setup");
        else if (window.MySpaceMindChat?.open) await window.MySpaceMindChat.open({});
        else window.MySpaceMindPanel?.show?.();
        return reply(true);
      case "openFiles":
        await window.MySpaceFiles?.open?.({
          page: args?.page || "browse",
          path: args?.path,
          full: true,
        });
        return reply(true);
      default:
        return reply(false, { error: `Unknown desktop command: ${verb}` });
    }
  }

  async function handlePlatform(target, verb, args, requestId) {
    const link = window.mySpace.link;
    if (target === "notifications" && (verb === "open" || verb === "openInbox")) {
      window.MySpaceNotificationsBell?.open?.();
      await link.reply({ requestId, ok: true });
      return true;
    }
    if (target === "jobs" && verb === "open") {
      if (window.MySpaceJobs?.open) {
        await window.MySpaceJobs.open({ page: args?.page || args?.tab || "queue" });
      } else {
        window.MySpaceJobsPanel?.show?.(args?.page || args?.tab || "queue");
      }
      await link.reply({ requestId, ok: true });
      return true;
    }
    if ((target === "scheduler" || target === "schedule") && verb === "open") {
      if (window.MySpaceScheduler?.open) {
        await window.MySpaceScheduler.open({ page: args?.page || args?.tab || "active" });
      }
      await link.reply({ requestId, ok: true });
      return true;
    }
    if (target === "mind" && verb === "open") {
      if (args?.page === "setup") window.MySpaceMindPanel?.show?.("setup");
      else if (window.MySpaceMindChat?.open) await window.MySpaceMindChat.open({ page: args?.page });
      else window.MySpaceMindPanel?.show?.();
      await link.reply({ requestId, ok: true });
      return true;
    }
    if (target === "shell") {
      if (verb === "run") {
        const command = String(args?.command || "").trim();
        if (!command) {
          await link.reply({ requestId, ok: false, error: "command required" });
          return true;
        }
        const res = await window.MySpaceShellBridge?.executeCommand?.(command, "pulse");
        await link.reply({
          requestId,
          ok: res?.ok !== false,
          result: res,
          error: res?.error,
        });
        return true;
      }
      if (verb === "open" || verb === "openAliases" || verb === "openHistory" || verb === "openMacros" || verb === "openWhen") {
        const page =
          verb === "openAliases" || verb === "openMacros" || verb === "openWhen" || verb === "openHistory"
            ? "language"
            : args?.page || "overview";
        if (window.MySpaceShellAtlas?.open) {
          window.MySpaceShellAtlas.open({ page });
        } else {
          launch("shell-console", { page });
        }
        await link.reply({ requestId, ok: true });
        return true;
      }
      if (verb === "openScripts") {
        launch("scripts", { page: "library" });
        await link.reply({ requestId, ok: true });
        return true;
      }
    }
    if (target === "msl") {
      const tab =
        verb === "openCaps"
          ? "caps"
          : verb === "openKeys"
            ? "keys"
            : verb === "openMint"
              ? "mint"
              : verb === "openInject"
                ? "inject"
                : args?.tab || "caps";
      if (verb === "open" || verb.startsWith("open")) {
        window.MySpaceMslPanel?.show?.(tab);
        await link.reply({ requestId, ok: true });
        return true;
      }
    }
    if (target === "browser") {
      if (verb === "openWeb" || (verb === "navigate" && args?.url) || (verb === "open" && args?.url && args?.mode === "web")) {
        const url = String(args?.url || "https://www.google.com/webhp").trim();
        window.MySpaceWorkspace?.openWeb?.(url, "Browser", {
          reuse: false,
          appId: "connect-browser",
          forceInApp: true,
          iconSrc: "brand/atom-green.png",
        });
        await link.reply({ requestId, ok: true });
        return true;
      }
      if (verb === "open" || verb === "openHome" || verb === "navigate") {
        if (args?.url && window.MySpaceBrowser?.open) {
          await window.MySpaceBrowser.open({ url: args.url });
        } else if (window.MySpaceBrowser?.open) {
          await window.MySpaceBrowser.open();
        } else {
          await link.reply({ requestId, ok: false, error: "Browser unavailable" });
          return true;
        }
        await link.reply({ requestId, ok: true });
        return true;
      }
    }
    if (target === "connect") {
      if (verb === "open" || verb === "openCatalog") {
        if (window.MySpaceConnect?.open) await window.MySpaceConnect.open();
        else window.MySpaceConnectHub?.show?.();
        await link.reply({ requestId, ok: true });
        return true;
      }
      if (verb === "openBrowser") {
        if (window.MySpaceBrowser?.open) await window.MySpaceBrowser.open();
        await link.reply({ requestId, ok: true });
        return true;
      }
      if (verb === "openMail") {
        launch("mail", { page: "hub" });
        await link.reply({ requestId, ok: true });
        return true;
      }
    }
    if (target === "search") {
      if (verb === "open" || verb === "query") {
        window.__myspaceOpenPalette?.(args?.q ? String(args.q) : undefined);
        await link.reply({ requestId, ok: true });
        return true;
      }
    }
    if (target === "os") {
      if (verb === "showDesktop") {
        window.__myspaceShowDesktop?.();
        await link.reply({ requestId, ok: true });
        return true;
      }
      if (verb === "openSettings" || (verb === "open" && (args?.page === "settings" || !args?.page))) {
        window.__myspaceOpenSettings?.();
        await link.reply({ requestId, ok: true });
        return true;
      }
      if (verb === "openPlatform") {
        window.MySpacePlatformCatalog?.show?.();
        await link.reply({ requestId, ok: true });
        return true;
      }
      if (verb === "openSearch") {
        window.__myspaceOpenPalette?.();
        await link.reply({ requestId, ok: true });
        return true;
      }
      if (verb === "openNotifications") {
        window.MySpaceNotificationsBell?.open?.();
        await link.reply({ requestId, ok: true });
        return true;
      }
      if (verb === "launch") {
        const appId = String(args?.appId || "").trim();
        if (!appId) {
          await link.reply({ requestId, ok: false, error: "appId required" });
          return true;
        }
        launch(appId, args?.page ? { page: args.page } : undefined);
        await link.reply({ requestId, ok: true });
        return true;
      }
      if (verb === "toast") {
        toast(String(args?.message || ""));
        await link.reply({ requestId, ok: true });
        return true;
      }
    }
    if (target === "system-info" && (verb === "open" || verb.startsWith("open"))) {
      const page = args?.page || "system";
      if (window.MySpaceSystemInfo?.open) await window.MySpaceSystemInfo.open({ page });
      else launch("system-info", { page });
      await link.reply({ requestId, ok: true });
      return true;
    }
    if (target === "pulse" && (verb === "open" || verb === "openDirectory" || verb === "openActivity")) {
      const page = verb === "openActivity" ? "activity" : args?.page || "directory";
      await window.MySpacePulse?.open?.({
        page,
        moduleId: args?.moduleId,
        forceRefresh: true,
      });
      await link.reply({ requestId, ok: true });
      return true;
    }
    if (target === "composio" && (verb === "open" || verb === "openExternal")) {
      await window.MySpacePulse?.open?.({
        page: "external",
        forceRefresh: true,
      });
      await link.reply({ requestId, ok: true });
      return true;
    }
    return false;
  }

  async function handleCommand(payload) {
    if (!payload?.requestId || !window.mySpace?.link) return;
    const { target, verb, args, requestId } = payload;

    if (target === "desktop") {
      await handleDesktop(verb, args || {}, requestId);
      return;
    }

    if (await handlePlatform(target, verb, args || {}, requestId)) return;

    const browse = BROWSE_ONLY[target]?.[verb];
    if (browse) {
      const route = browse(args || {});
      launch(findAppId(target), route);
      await window.mySpace.link.reply({ requestId, ok: true, result: { launched: true } });
      return;
    }

    if (verb === "open" && APP_OPEN[target]) {
      const route = APP_OPEN[target](args || {});
      const appId = findAppId(target);
      launch(appId, route);
      await window.mySpace.link.reply({ requestId, ok: true, result: { launched: true } });
      return;
    }

    // Generic open for any module id
    if (verb === "open") {
      const appId = findAppId(target);
      const ok = launch(appId, args?.page ? { page: args.page } : undefined);
      await window.mySpace.link.reply({
        requestId,
        ok,
        result: ok ? { launched: true } : undefined,
        error: ok ? undefined : `Could not open ${target}`,
      });
    }
  }

  function boot() {
    if (!window.mySpace?.link) return;
    window.mySpace.link.register({ moduleId: "desktop" });
    window.mySpace.link.onCommand(handleCommand);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.MySpaceLinkRelay = { launch };
})();
