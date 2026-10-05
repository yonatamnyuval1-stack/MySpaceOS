(function () {
  let root = null;
  let open = false;
  let catalog = null;
  let searchQuery = "";

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
  const MARK_SRC = {
    "atom-white": "brand/atom-white.png",
    "atom-green": "brand/atom-green.png",
    "atom-cyan": "brand/atom-cyan.png",
    "atom-violet": "brand/atom-violet.png",
    "atom-amber": "brand/atom-amber.png",
    "atom-rose": "brand/atom-rose.png",
    "atom-slate": "brand/atom-slate.png",
  };
  const DUAL_MODE_ACTIONS = new Set(["open-bridge", "open-files", "open-mind"]);
  const PANEL_ONLY_ACTIONS = new Set([]);

  async function loadCatalog() {
    try {
      const res = await fetch(`platform-services.json?t=${Date.now()}`);
      if (res.ok) {
        catalog = await res.json();
        return catalog;
      }
    } catch {
    }
    if (catalog) return catalog;
    catalog = {
      services: [
        {
          id: "os",
          name: "My Space OS",
          tier: "core",
          mark: "atom-white",
          tagline: "Personal desktop layer",
          summary: "Desktop, windows, and app launching.",
        },
      ],
    };
    return catalog;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function markHtml(service) {
    const mark = service.mark && MARK_SRC[service.mark] ? service.mark : "atom-white";
    const src = MARK_SRC[mark];
    return `<img class="platform-catalog-mark" src="${src}" alt="" width="40" height="40" />`;
  }

  function tierLabel(tier) {
    if (tier === "core") return tt("shell.platform.tier.core", "Core");
    if (tier === "major") return tt("shell.platform.tier.major", "Major");
    return tt("shell.platform.tier.service", "Service");
  }

  function seriesBadge(service) {
    if (!service.seriesLabel && !service.series) return "";
    const key = String(service.series || "").toLowerCase();
    const I = window.MySpaceI18n;
    const seriesKey = key ? `shell.series.${key}` : "";
    let label = service.seriesLabel || String(service.series || "").toUpperCase();
    if (I?.t && seriesKey) {
      const translated = I.t(seriesKey);
      if (translated !== seriesKey) label = translated;
    }
    const seriesClass = service.series ? ` series-${escapeHtml(service.series)}` : "";
    return `<span class="platform-catalog-series${seriesClass}">${escapeHtml(label)}</span>`;
  }

  function localizedService(service) {
    const I = window.MySpaceI18n;
    if (!I?.platformField || !service?.id) return service;
    return {
      ...service,
      name: I.platformField(service.id, "name", service.name),
      tagline: I.platformField(service.id, "tagline", service.tagline),
      summary: I.platformField(service.id, "summary", service.summary),
    };
  }

  function surfacesHtml(service) {
    const surfaces = Array.isArray(service.surfaces) ? service.surfaces : [];
    if (!surfaces.length) return "";
    const chips = surfaces
      .map((surf) => {
        const label = escapeHtml(surf.label || surf.id || "");
        const hint = surf.hint ? ` title="${escapeHtml(surf.hint)}"` : "";
        const sid = surf.id ? ` data-surface="${escapeHtml(surf.id)}"` : "";
        return `<button type="button" class="platform-catalog-surface"${sid}${hint}>${label}</button>`;
      })
      .join("");
    return `<div class="platform-catalog-surfaces" role="group" aria-label="${escapeHtml(
      tt("shell.platform.surfaces", "Surfaces")
    )}">${chips}</div>`;
  }

  function openModeRow(action) {
    if (!DUAL_MODE_ACTIONS.has(action)) return "";
    return `<div class="platform-catalog-open-row" role="group" aria-label="${escapeHtml(
      tt("shell.platform.openMode", "Open mode")
    )}">
      <button type="button" class="platform-catalog-open-btn is-primary" data-open-mode="full">${escapeHtml(
        tt("shell.platform.openApp", "Open app")
      )}</button>
      <button type="button" class="platform-catalog-open-btn" data-open-mode="panel">${escapeHtml(
        tt("shell.platform.quickPanel", "Quick panel")
      )}</button>
    </div>`;
  }

  function panelOnlyBadge(action) {
    if (!PANEL_ONLY_ACTIONS.has(action)) return "";
    return `<span class="platform-catalog-panel-badge" title="${escapeHtml(
      tt("shell.platform.panelHint", "Opens as a platform panel")
    )}">${escapeHtml(tt("shell.platform.panel", "Panel"))}</span>`;
  }

  function filterServices(services, query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return services || [];
    return (services || []).filter((s) => {
      const surfaces = (s.surfaces || []).map((x) => `${x.label || ""} ${x.id || ""}`).join(" ");
      const hay = [
        s.id,
        s.name,
        s.tagline,
        s.summary,
        s.series,
        s.seriesLabel,
        s.tier,
        surfaces,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  const SERIES_ORDER = ["_platform", "web", "shell", "link", "ai"];

  function groupServicesBySeries(services) {
    const map = new Map();
    for (const s of services || []) {
      const key = s.series ? String(s.series) : "_platform";
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: s.seriesLabel || (key === "_platform" ? "Platform" : key),
          services: [],
        });
      }
      const g = map.get(key);
      if (s.seriesLabel) g.label = s.seriesLabel;
      g.services.push(s);
    }

    const keys = [...map.keys()].sort((a, b) => {
      const ia = SERIES_ORDER.indexOf(a);
      const ib = SERIES_ORDER.indexOf(b);
      const ra = ia === -1 ? SERIES_ORDER.length : ia;
      const rb = ib === -1 ? SERIES_ORDER.length : ib;
      if (ra !== rb) return ra - rb;
      return a.localeCompare(b);
    });
    return keys.map((k) => map.get(k));
  }

  function renderTile(raw) {
    const s = localizedService(raw);
    return `
      <button type="button" class="platform-catalog-tile series-${escapeHtml(
        s.series || "platform"
      )}" data-id="${escapeHtml(s.id)}"${
      s.action ? ` data-action="${escapeHtml(s.action)}"` : ""
    } title="${escapeHtml(s.tagline || s.summary || s.name)}">
        <span class="platform-catalog-tile-mark">${markHtml(s)}</span>
        <span class="platform-catalog-tile-name">${escapeHtml(s.name)}</span>
      </button>`;
  }

  function renderList(services) {
    const groups = groupServicesBySeries(services);
    const platformLabel = window.MySpaceI18n?.t?.("shell.series.platform") || "Platform";
    return groups
      .map((g) => {
        const title =
          g.key === "_platform"
            ? `<div class="platform-catalog-series-heading-row"><h3 class="platform-catalog-series-heading">${escapeHtml(platformLabel)}</h3></div>`
            : `<div class="platform-catalog-series-heading-row"><h3 class="platform-catalog-series-heading series-${escapeHtml(
                g.key
              )}">${escapeHtml(
                window.MySpaceI18n?.t?.(`shell.series.${g.key}`) !== `shell.series.${g.key}`
                  ? window.MySpaceI18n.t(`shell.series.${g.key}`)
                  : g.label
              )}</h3></div>`;
        return `<section class="platform-catalog-series-block" data-series="${escapeHtml(g.key)}">
          ${title}
          <div class="platform-catalog-tile-grid">
            ${g.services.map(renderTile).join("")}
          </div>
        </section>`;
      })
      .join("");
  }

  function bindCatalogCards(listEl) {
    listEl?.querySelectorAll("[data-action]").forEach((tile) => {
      const action = tile.dataset.action;
      tile.addEventListener("click", (e) => {
        e.preventDefault();
        runAction(action, null, { mode: DUAL_MODE_ACTIONS.has(action) ? "full" : "auto" });
      });
    });
  }

  function paintCatalogList() {
    const list = root?.querySelector("#platform-catalog-list");
    const empty = root?.querySelector("#platform-catalog-empty");
    const services = filterServices(catalog?.services, searchQuery);
    if (list) {
      list.innerHTML = services.length
        ? renderList(services)
        : `<p class="platform-catalog-empty">${escapeHtml(
            tt("shell.platform.empty", "No services match “{q}”", { q: searchQuery })
          )}</p>`;
      bindCatalogCards(list);
    }
    if (empty) empty.hidden = services.length > 0 || !searchQuery;
  }

  function toast(msg) {
    window.showMySpaceToast?.(String(msg || ""));
  }

  const POWER_SVG =
    '<svg class="platform-catalog-power-icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 2v10"/>' +
    '<path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>' +
    "</svg>";
  let powerMenuOpen = false;

  function setPowerMenuOpen(next) {
    powerMenuOpen = !!next;
    const menu = root?.querySelector("#platform-catalog-power-menu");
    const btn = root?.querySelector("#platform-catalog-power");
    menu?.classList.toggle("hidden", !powerMenuOpen);
    btn?.setAttribute("aria-expanded", powerMenuOpen ? "true" : "false");
  }

  function hidePowerMenu() {
    setPowerMenuOpen(false);
  }

  function togglePowerMenu() {
    setPowerMenuOpen(!powerMenuOpen);
  }

  async function runPowerAction(action) {
    hidePowerMenu();
    if (action === "restart") {
      hide();
      toast(tt("shell.power.restarting", "Restarting My Space…"));
      const res = await window.mySpace?.app?.restart?.();
      if (res?.ok === false) toast(res.error || tt("shell.power.restartFailed", "Could not restart"));
      return;
    }
    if (action === "quit") {
      hide();
      toast(tt("shell.power.closing", "Closing My Space…"));
      const res = await window.mySpace?.app?.quit?.();
      if (res?.ok === false) toast(res.error || tt("shell.power.quitFailed", "Could not quit"));
    }
  }

  function applyPowerChrome() {
    if (!root) return;
    root.setAttribute("aria-label", tt("shell.platform.catalogAria", "My Space platform services"));
    const search = root.querySelector("#platform-catalog-search");
    if (search) search.placeholder = tt("shell.platform.search", "Search for services");
    const powerBtn = root.querySelector("#platform-catalog-power");
    if (powerBtn) {
      powerBtn.title = tt("shell.power.title", "Power: restart or quit");
      powerBtn.setAttribute("aria-label", tt("shell.power.aria", "Power options"));
    }
    const menu = root.querySelector("#platform-catalog-power-menu");
    if (menu) menu.setAttribute("aria-label", tt("shell.power.aria", "Power options"));
    const restart = root.querySelector('[data-power="restart"]');
    if (restart) restart.textContent = tt("shell.power.restart", "Restart My Space");
    const quit = root.querySelector('[data-power="quit"]');
    if (quit) quit.textContent = tt("shell.power.quit", "Quit My Space");
    const traySub = root.querySelector(".platform-catalog-tray-sub");
    if (traySub) traySub.textContent = tt("shell.welcome.servicesTitle", "Platform services");
    const closeBtn = root.querySelector(".platform-catalog-close");
    if (closeBtn) closeBtn.setAttribute("aria-label", tt("service.common.close", "Close"));
  }

  function launchAppById(appId, options) {
    if (typeof window.__myspaceLaunchById === "function") {
      window.__myspaceLaunchById(appId, { reuse: true, skipJobs: true, ...(options || {}) });
      return true;
    }
    return false;
  }

  function runAction(action, surfaceId, options = {}) {
    const mode = options.mode || (DUAL_MODE_ACTIONS.has(action) ? "full" : "auto");
    const openFull = mode === "full";
    if (action === "open-os") {
      hide();
      if (surfaceId === "settings") {
        window.__myspaceOpenSettings?.();
        return;
      }
      window.__myspaceShowDesktop?.();
      return;
    }
    if (action === "open-search") {
      hide();
      window.__myspaceOpenPalette?.();
      return;
    }
    if (action === "open-notifications") {
      hide();
      window.MySpaceNotificationsBell?.open?.();
      return;
    }
    if (action === "open-msl") {
      hide();
      const page = ["caps", "keys", "mint", "inject", "about"].includes(surfaceId)
        ? surfaceId
        : "caps";
      void (async () => {
        try {
          if (window.MySpaceMsl?.open) {
            await window.MySpaceMsl.open({ page });
          } else {
            const res = await window.MySpaceShellBridge?.executeCommand?.(
              `msl(${page === "caps" ? "open" : page})`,
              "platform"
            );
            if (res && res.ok === false) toast(res.error || "Could not open MSL");
          }
        } catch (err) {
          toast(err?.message || "Could not open MSL");
        }
      })();
      return;
    }
    if (action === "open-parts") {
      hide();
      const page = ["explore", "catalog", "about", "publish"].includes(surfaceId)
        ? surfaceId === "catalog"
          ? "explore"
          : surfaceId
        : "explore";
      void (async () => {
        try {
          if (window.MySpaceParts?.open) {
            await window.MySpaceParts.open({ page });
          } else {
            window.MySpacePartsPanel?.show?.(page === "about" ? "about" : undefined);
          }
        } catch (err) {
          window.showMySpaceToast?.(err?.message || "Could not open Parts");
        }
      })();
      return;
    }
    if (action === "open-permissions") {
      hide();
      const page = [
        "overview",
        "tools",
        "notifications",
        "jobs",
        "bridge",
        "external",
        "about",
      ].includes(surfaceId)
        ? surfaceId
        : "overview";
      void (async () => {
        try {
          if (window.MySpacePermissions?.open) {
            await window.MySpacePermissions.open({ page });
          } else {
            const res = await window.MySpaceShellBridge?.executeCommand?.(
              `permissions(${page})`,
              "platform"
            );
            if (res && res.ok === false) toast(res.error || "Could not open Permissions");
          }
        } catch (err) {
          toast(err?.message || "Could not open Permissions");
        }
      })();
      return;
    }
    if (action === "open-pulse") {
      hide();
      const page = ["routes", "directory", "events", "subs", "log", "activity", "send", "external"].includes(
        surfaceId
      )
        ? surfaceId === "routes" || surfaceId === "subs" || surfaceId === "send"
          ? "directory"
          : surfaceId === "log"
            ? "activity"
            : surfaceId
        : "directory";
      const moduleId =
        surfaceId && !["routes", "directory", "events", "subs", "log", "activity", "send", "external"].includes(surfaceId)
          ? surfaceId
          : undefined;
      void (async () => {
        try {
          if (window.MySpacePulse?.open) {
            await window.MySpacePulse.open({ page, moduleId, forceRefresh: true });
            return;
          }
          const res = await window.MySpaceShellBridge?.executeCommand?.("pulse(open)", "platform");
          if (res && res.ok === false) toast(res.error || "Could not open Pulse");
        } catch (err) {
          toast(err?.message || "Could not open Pulse");
        }
      })();
      return;
    }
    if (action === "open-jobs") {
      hide();
      const page = ["queue", "active", "done", "enqueue", "capacity", "about"].includes(surfaceId)
        ? surfaceId
        : "queue";
      void (async () => {
        try {
          if (window.MySpaceJobs?.open) {
            await window.MySpaceJobs.open({ page });
          } else {
            window.MySpaceJobsPanel?.show?.(page);
          }
        } catch (err) {
          toast(err?.message || "Could not open Jobs");
        }
      })();
      return;
    }
    if (action === "open-scheduler") {
      hide();
      const page = ["active", "all", "history", "new", "about"].includes(surfaceId)
        ? surfaceId
        : "active";
      void (async () => {
        try {
          if (window.MySpaceScheduler?.open) {
            await window.MySpaceScheduler.open({ page });
          } else {
            const apps = window.MySpaceConfig?.getApps?.() || [];
            const app = apps.find((a) => a.id === "scheduler" || a.module === "scheduler");
            if (app) await window.__myspaceLaunchById?.("scheduler", { route: { page }, full: true, skipJobs: true });
            else toast("Scheduler unavailable");
          }
        } catch (err) {
          toast(err?.message || "Could not open Scheduler");
        }
      })();
      return;
    }
    if (action === "open-resolve") {
      hide();
      const page = ["inbox", "playbooks", "about"].includes(surfaceId) ? surfaceId : "inbox";
      void (async () => {
        try {
          if (window.MySpaceResolve?.open) {
            await window.MySpaceResolve.open({ page });
          } else {
            window.MySpaceResolvePanel?.show?.(page);
          }
        } catch (err) {
          toast(err?.message || "Could not open Resolve");
        }
      })();
      return;
    }
    if (action === "open-updates") {
      hide();
      const page = ["pending", "history", "about"].includes(surfaceId) ? surfaceId : "pending";
      void (async () => {
        try {
          if (window.MySpaceUpdates?.open) {
            await window.MySpaceUpdates.open({ page });
          } else {
            window.MySpaceUpdatesPanel?.show?.(page);
          }
        } catch (err) {
          toast(err?.message || "Could not open Updates");
        }
      })();
      return;
    }
    if (action === "open-network") {
      hide();
      const page = ["status", "adapters", "ports", "about"].includes(surfaceId) ? surfaceId : "status";
      void (async () => {
        try {
          if (window.MySpaceNetwork?.open) {
            await window.MySpaceNetwork.open({ page });
          } else {
            window.MySpaceNetworkPanel?.show?.(page);
          }
        } catch (err) {
          toast(err?.message || "Could not open Network");
        }
      })();
      return;
    }
    if (action === "open-info") {
      hide();
      const page = ["catalog", "services", "apps", "external", "about"].includes(surfaceId)
        ? surfaceId
        : "catalog";
      void (async () => {
        try {
          if (window.MySpaceInfo?.open) {
            await window.MySpaceInfo.open({ page });
          } else {
            window.MySpaceInfoPanel?.show?.(page);
          }
        } catch (err) {
          toast(err?.message || "Could not open Info");
        }
      })();
      return;
    }
    if (action === "open-backup") {
      hide();
      const page = ["status", "history", "about"].includes(surfaceId) ? surfaceId : "status";
      void (async () => {
        try {
          if (window.MySpaceBackup?.open) {
            await window.MySpaceBackup.open({ page });
          } else {
            window.MySpaceBackupPanel?.show?.(page);
          }
        } catch (err) {
          toast(err?.message || "Could not open Backup");
        }
      })();
      return;
    }
    if (action === "open-storage") {
      hide();
      const page = ["status", "apps", "large-files", "cleanup", "about"].includes(surfaceId)
        ? surfaceId
        : "status";
      void (async () => {
        try {
          if (window.MySpaceStorage?.open) {
            await window.MySpaceStorage.open({ page });
          } else {
            window.MySpaceStoragePanel?.show?.(page);
          }
        } catch (err) {
          toast(err?.message || "Could not open Storage");
        }
      })();
      return;
    }
    if (action === "open-themes") {
      hide();
      const page = ["apps", "about"].includes(surfaceId) ? surfaceId : "apps";
      void (async () => {
        try {
          if (window.MySpaceThemes?.open) {
            await window.MySpaceThemes.open({ page });
          } else {
            window.MySpaceThemesPanel?.show?.(page);
          }
        } catch (err) {
          toast(err?.message || "Could not open Themes");
        }
      })();
      return;
    }
    if (action === "open-mind") {
      hide();
      if (surfaceId === "setup") {
        window.MySpaceMindPanel?.show?.("setup");
        return;
      }
      if (surfaceId === "ask-ai") {
        window.MySpaceAiChat?.open?.({ prompt: "", send: false });
        return;
      }
      if (surfaceId === "memory") {
        if (window.MySpaceMindChat?.open) {
          void window.MySpaceMindChat.open({ page: "memory" });
        } else {
          window.MySpaceMindPanel?.show?.("setup");
        }
        return;
      }
      if (mode === "panel") {
        window.MySpaceMindPanel?.show?.(surfaceId === "chat" ? "ask" : surfaceId || "ask");
        return;
      }
      if (window.MySpaceMindChat?.open) {
        void window.MySpaceMindChat.open(surfaceId === "chat" ? {} : { page: surfaceId || undefined });
      } else {
        window.MySpaceMindPanel?.show?.();
      }
      return;
    }
    if (action === "open-flow") {
      hide();
      const route =
        surfaceId === "tools"
          ? { page: "tools" }
          : surfaceId === "history"
            ? { page: "history" }
            : { page: "studio" };
      void (async () => {
        try {
          if (window.MySpaceFlow?.open) {
            const tab = await window.MySpaceFlow.open(route);
            if (tab) return;
          }
          const res = await window.MySpaceShellBridge?.executeCommand?.("flow(open)", "platform");
          if (res && res.ok === false) toast(res.error || "Could not open Model Flow");
        } catch (err) {
          toast(err?.message || "Could not open Model Flow");
        }
      })();
      return;
    }
    if (action === "open-browser") {
      hide();
      void (async () => {
        try {
          if (surfaceId === "web") {
            window.MySpaceWorkspace?.openWeb?.("https://www.google.com/webhp", "Browser", {
              reuse: false,
              appId: "connect-browser",
              forceInApp: true,
              iconSrc: "brand/atom-green.png",
            });
            return;
          }
          if (window.MySpaceBrowser?.open) {
            await window.MySpaceBrowser.open();
            return;
          }
          toast("Browser unavailable");
        } catch (err) {
          toast(err?.message || "Could not open Browser");
        }
      })();
      return;
    }
    if (action === "open-connect") {
      hide();
      void (async () => {
        try {
          if (surfaceId === "browser") {
            if (window.MySpaceBrowser?.open) {
              await window.MySpaceBrowser.open();
              return;
            }
          }
          if (window.MySpaceConnect?.open) {
            const tab = await window.MySpaceConnect.open();
            if (tab) return;
          }
          const res = await window.MySpaceShellBridge?.executeCommand?.("run connect", "platform");
          if (res && res.ok === false) toast(res.error || "Could not open Connect");
        } catch (err) {
          toast(err?.message || "Could not open Connect");
        }
      })();
      return;
    }
    if (action === "open-shell") {
      hide();
      const page = ["overview", "language", "core", "modules", "shell"].includes(surfaceId)
        ? surfaceId
        : "overview";
      if (window.MySpaceShellAtlas?.open) {
        window.MySpaceShellAtlas.open({ page });
      } else {
        toast("Shell atlas unavailable");
      }
      return;
    }
    if (action === "open-scripts") {
      hide();
      void (async () => {
        try {
          if (window.MySpaceScripts?.open) {
            const tab = await window.MySpaceScripts.open(
              surfaceId === "new" ? { action: "new" } : null
            );
            if (tab) return;
          }
          const cmd = surfaceId === "new" ? "scripts(new)" : "scripts(open)";
          const res = await window.MySpaceShellBridge?.executeCommand?.(cmd, "platform");
          if (res && res.ok === false) toast(res.error || "Could not open Runtime");
        } catch (err) {
          toast(err?.message || "Could not open Runtime");
        }
      })();
      return;
    }
    if (action === "open-bridge") {
      hide();
      const page = ["devices", "places", "actions", "host"].includes(surfaceId)
        ? surfaceId
        : "devices";
      void (async () => {
        try {
          if (window.MySpaceOsBridge?.open) {
            await window.MySpaceOsBridge.open({ page, full: openFull });
            return;
          }
          const apps = window.MySpaceConfig?.getApps?.() || [];
          const app = apps.find((a) => a.id === "os-bridge" || a.module === "os-bridge");
          if (!app) {
            toast("OS Bridge unavailable");
            return;
          }
          if (typeof window.__myspaceLaunchById === "function") {
            window.__myspaceLaunchById("os-bridge", {
              route: { page },
              full: openFull,
              reuse: true,
              skipJobs: true,
            });
            return;
          }
          toast("Could not open OS Bridge");
        } catch (err) {
          toast(err?.message || "Could not open OS Bridge");
        }
      })();
      return;
    }
    if (action === "open-files") {
      hide();
      const page = ["browse", "recent", "favorites", "downloads", "documents"].includes(surfaceId)
        ? surfaceId
        : "browse";
      void (async () => {
        try {
          if (window.MySpaceFiles?.open) {
            await window.MySpaceFiles.open({ page, full: openFull });
            return;
          }
          const res = await window.MySpaceShellBridge?.executeCommand?.(
            openFull ? `files(full ${page})` : `files(panel)`,
            "platform"
          );
          if (res && res.ok === false) toast(res.error || "Could not open Files");
        } catch (err) {
          toast(err?.message || "Could not open Files");
        }
      })();
      return;
    }
    if (action === "open-system-info") {
      hide();
      void (async () => {
        try {
          const page = surfaceId || "system";
          if (window.MySpaceSystemInfo?.open) {
            const tab = await window.MySpaceSystemInfo.open({ page });
            if (tab) return;
          }
          const res = await window.MySpaceShellBridge?.executeCommand?.(
            `sysinfo(open ${page})`,
            "platform"
          );
          if (res && res.ok === false) toast(res.error || "Could not open System Info");
        } catch (err) {
          toast(err?.message || "Could not open System Info");
        }
      })();
      return;
    }
  }

  async function ensure() {
    if (root) return root;
    root = document.createElement("div");
    root.className = "platform-catalog hidden";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "My Space platform services");
    root.innerHTML = `
      <div class="platform-catalog-card-shell">
        <div class="platform-catalog-search-wrap">
          <span class="platform-catalog-search-icon" aria-hidden="true">⌕</span>
          <input
            type="search"
            id="platform-catalog-search"
            class="platform-catalog-search"
            placeholder="Search for services"
            autocomplete="off"
            spellcheck="false"
          />
        </div>
        <div class="platform-catalog-list" id="platform-catalog-list"></div>
        <footer class="platform-catalog-tray">
          <div class="platform-catalog-tray-user">
            <img src="brand/atom-slate.png" alt="" width="28" height="28" />
            <div>
              <div class="platform-catalog-tray-title">My Space</div>
              <div class="platform-catalog-tray-sub">Platform services</div>
            </div>
          </div>
          <div class="platform-catalog-head-actions">
            <div class="platform-catalog-power-wrap">
              <button type="button" class="platform-catalog-icon-btn platform-catalog-power" id="platform-catalog-power" title="" aria-label="" aria-haspopup="menu" aria-expanded="false">
                ${POWER_SVG}
              </button>
              <div class="platform-catalog-power-menu hidden" id="platform-catalog-power-menu" role="menu" aria-label="">
                <button type="button" class="platform-catalog-power-item" role="menuitem" data-power="restart"></button>
                <button type="button" class="platform-catalog-power-item is-danger" role="menuitem" data-power="quit"></button>
              </div>
            </div>
            <button type="button" class="platform-catalog-icon-btn platform-catalog-close" aria-label="">×</button>
          </div>
        </footer>
      </div>`;
    root.querySelector(".platform-catalog-close").addEventListener("click", hide);
    root.querySelector("#platform-catalog-power")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePowerMenu();
    });
    root.querySelector("#platform-catalog-power-menu")?.addEventListener("click", (e) => {
      const item = e.target.closest("[data-power]");
      if (!item) return;
      e.preventDefault();
      e.stopPropagation();
      void runPowerAction(item.dataset.power);
    });
    document.addEventListener("mousedown", (e) => {
      if (!powerMenuOpen || !root) return;
      if (e.target.closest(".platform-catalog-power-wrap")) return;
      hidePowerMenu();
    });
    root.querySelector("#platform-catalog-search")?.addEventListener("input", (e) => {
      searchQuery = e.target.value || "";
      paintCatalogList();
    });
    root.addEventListener("click", (e) => {
      if (e.target === root) hide();
    });
    document.body.appendChild(root);
    applyPowerChrome();
    return root;
  }

  async function show() {
    await ensure();
    hidePowerMenu();
    catalog = await loadCatalog();
    searchQuery = "";
    const searchInput = root.querySelector("#platform-catalog-search");
    if (searchInput) searchInput.value = "";
    applyPowerChrome();
    paintCatalogList();
    open = true;
    root.classList.remove("hidden");
    requestAnimationFrame(() => searchInput?.focus());
  }

  function hide() {
    hidePowerMenu();
    open = false;
    root?.classList.add("hidden");
  }

  function toggle() {
    if (open) hide();
    else void show();
  }

  function isOpen() {
    return open;
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !open) return;
    if (powerMenuOpen) {
      e.preventDefault();
      hidePowerMenu();
      return;
    }
    hide();
  });

  window.addEventListener("myspace-i18n-applied", () => {
    if (!root) return;
    applyPowerChrome();
    if (open) paintCatalogList();
  });

  window.MySpacePlatformCatalog = {
    show,
    hide,
    toggle,
    isOpen,
    loadCatalog,
    refreshI18n() {
      if (!root) return;
      applyPowerChrome();
      if (open) paintCatalogList();
    },
    openService(action, surfaceId, options) {
      runAction(action, surfaceId, options || {});
    },
  };
})();