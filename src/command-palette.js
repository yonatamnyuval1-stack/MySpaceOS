(function () {
  let root = null;
  let input = null;
  let listEl = null;
  let open = false;
  let items = [];
  let activeIndex = 0;
  let handlers = null;
  let searchTimer = null;
  let contentResults = [];
  let searchToken = 0;
  let contentTotal = 0;
  let mslCaps = [];
  let mslCapsLoaded = false;
  let hintEl = null;
  const ROW_HEIGHT = 52;
  const MAX_PALETTE_ITEMS = 2000;
  const VIRTUAL_OVERSCAN = 8;

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

  function staticActions() {
    return [
      { id: "action:ask-ai", kind: "action", title: tt("shell.palette.action.askAi.title", "Mind Chat…"), subtitle: tt("shell.palette.action.askAi.subtitle", "Side assistant · tools · or type ? your question"), icon: "✦", keywords: "ask ai mind chat gemini assistant help" },
      { id: "action:add", kind: "action", title: tt("shell.palette.action.add.title", "Add program"), subtitle: tt("shell.palette.action.add.subtitle", "Install a shortcut"), icon: "＋", keywords: "add install program shortcut" },
      { id: "action:settings", kind: "action", title: tt("shell.palette.action.settings.title", "Settings"), subtitle: tt("shell.palette.action.settings.subtitle", "My Space settings"), icon: "⚙", keywords: "settings preferences" },
      { id: "action:desktop", kind: "action", title: tt("shell.palette.action.desktop.title", "Show desktop"), subtitle: tt("shell.palette.action.desktop.subtitle", "Minimize windows"), icon: "⌂", keywords: "desktop home minimize" },
      { id: "action:focus", kind: "action", title: tt("shell.palette.action.focus.title", "Toggle Focus mode"), subtitle: tt("shell.palette.action.focus.subtitle", "Silence notifications · Today + active app"), icon: "◎", keywords: "focus pomodoro mute silence" },
      { id: "action:space-cycle", kind: "action", title: tt("shell.palette.action.spaceCycle.title", "Switch desktop space"), subtitle: tt("shell.palette.action.spaceCycle.subtitle", "Cycle Study / Work / Play"), icon: "⧉", keywords: "space profile study work play" },
      { id: "action:new-window", kind: "action", title: tt("shell.palette.action.newWindow.title", "New My Space window"), subtitle: tt("shell.palette.action.newWindow.subtitle", "Open a second desktop window"), icon: "⧉", keywords: "window new second dual" },
      { id: "action:shortcuts", kind: "action", title: tt("shell.palette.action.shortcuts.title", "Keyboard shortcuts"), subtitle: tt("shell.palette.action.shortcuts.subtitle", "Ctrl+/ cheat sheet"), icon: "⌨", keywords: "shortcuts keys help" },
      { id: "action:msl", kind: "action", title: tt("shell.palette.action.msl.title", "MSL — My Space Link"), subtitle: tt("shell.palette.action.msl.subtitle", "Capability bus · panel"), icon: "⛓", keywords: "msl link protocol capability bus inject" },
      { id: "action:parts", kind: "action", title: tt("shell.palette.action.parts.title", "Parts — GitHub between apps"), subtitle: tt("shell.palette.action.parts.subtitle", "Link · explore & adopt embeddable modules"), icon: "⛓", keywords: "parts forge modules catalog adopt embed reusable link github" },
      { id: "action:jobs", kind: "action", title: tt("shell.palette.action.jobs.title", "Jobs — OS compute runtime"), subtitle: tt("shell.palette.action.jobs.subtitle", "Queue · capacity · full app"), icon: "⚙", keywords: "jobs compute queue capacity contract budget shell script launch runtime" },
      { id: "action:scheduler", kind: "action", title: tt("shell.palette.action.scheduler.title", "Scheduler — OS time runtime"), subtitle: tt("shell.palette.action.scheduler.subtitle", "Active schedules · history · schedule(…)"), icon: "⏱", keywords: "scheduler schedule cron timer every daily jobs scripts time runtime" },
      { id: "action:mind", kind: "action", title: tt("shell.palette.action.mind.title", "Mind Chat"), subtitle: tt("shell.palette.action.mind.subtitle", "AI series · conversations · history"), icon: "✦", keywords: "mind ai gemini ollama llm model chat ask cloud gpu quick think deep" },
      { id: "action:mind-setup", kind: "action", title: tt("shell.palette.action.mindSetup.title", "Mind Setup"), subtitle: tt("shell.palette.action.mindSetup.subtitle", "API key · Quick / Everyday / Deep models"), icon: "✦", keywords: "mind setup key gemini ollama model task" },
      { id: "action:flow", kind: "action", title: tt("shell.palette.action.flow.title", "Model Flow"), subtitle: tt("shell.palette.action.flow.subtitle", "AI series · plan · approve · run"), icon: "✦", keywords: "flow model flow zapier automation plan approve tools lab" },
      { id: "action:connect", kind: "action", title: tt("shell.palette.action.connect.title", "Connect"), subtitle: tt("shell.palette.action.connect.subtitle", "Web series · mail, messaging, browsers"), icon: "🔍", keywords: "connect mail gmail whatsapp telegram browser hub catalog web" },
      { id: "action:shell-atlas", kind: "action", title: tt("shell.palette.action.shellAtlas.title", "Shell — command atlas"), subtitle: tt("shell.palette.action.shellAtlas.subtitle", "Full map of live shell commands"), icon: "〉", keywords: "shell atlas console commands help reference language" },
      { id: "action:shell", kind: "action", title: tt("shell.palette.action.shell.title", "Shell command…"), subtitle: tt("shell.palette.action.shell.subtitle", "Open classic command line · or type >"), icon: ">", keywords: "shell console command run" },
      { id: "action:snap", kind: "action", title: tt("shell.palette.action.snap.title", "Snap side by side"), subtitle: tt("shell.palette.action.snap.subtitle", "Split two open apps"), icon: "▣", keywords: "snap split side dual" },
    ];
  }

  const SHELL_SUGGESTIONS = [
    { cmd: "run ", title: "run <app>(…)", subtitle: "Launch · page · key:value", keywords: "run launch open app goto" },
    { cmd: "run stocks(", title: "run stocks(AAPL)", subtitle: "symbol · mode:crypto · page:portfolio", keywords: "stocks ticker symbol" },
    { cmd: "run geography(", title: "run geography(Togo)", subtitle: "country · learn:TG · page:explore", keywords: "geography country geo" },
    { cmd: "run translate(", title: "run translate(text:…, to:he)", subtitle: "Translate with keys", keywords: "translate text language" },
    { cmd: "help ", title: "help <app>", subtitle: "Pages, keys, examples", keywords: "help routes grammar" },
    { cmd: "close ", title: "close <app|all>", subtitle: "Close a window", keywords: "close quit exit" },
    { cmd: "focus ", title: "focus <app>", subtitle: "Focus an open app", keywords: "focus activate" },
    { cmd: "open ", title: "open <app>", subtitle: "Open / reveal", keywords: "open" },
    { cmd: "pin ", title: "pin <app>", subtitle: "Pin to taskbar", keywords: "pin taskbar" },
    { cmd: "unpin ", title: "unpin <app>", subtitle: "Unpin from taskbar", keywords: "unpin" },
    { cmd: "check ", title: "check …", subtitle: "Query running apps, routes, aliases", keywords: "check query status" },
    { cmd: "help", title: "help", subtitle: "Shell command reference", keywords: "help ?" },
    { cmd: "alias ", title: "alias name = cmd", subtitle: "Create a shortcut command", keywords: "alias" },
    { cmd: "macro ", title: "macro name = cmds", subtitle: "Chain several commands", keywords: "macro" },
    { cmd: "when ", title: "when event then cmd", subtitle: "Automation rule", keywords: "when automation" },
    { cmd: "msl(panel)", title: "msl(panel)", subtitle: "Open MSL capability bus", keywords: "msl link protocol" },
    { cmd: "msl(list)", title: "msl(list)", subtitle: "List MSL capabilities", keywords: "msl caps" },
    { cmd: "jobs(open)", title: "jobs(open)", subtitle: "Open Jobs compute runtime", keywords: "jobs compute queue" },
    { cmd: "schedule(open)", title: "schedule(open)", subtitle: "Open Scheduler time runtime", keywords: "scheduler schedule cron" },
    { cmd: "schedule(list)", title: "schedule(list)", subtitle: "List active schedules", keywords: "scheduler list" },
    { cmd: "mind(panel)", title: "mind(panel)", subtitle: "Open Mind AI runtime", keywords: "mind ai gemini" },
    { cmd: "chat(new)", title: "chat(new)", subtitle: "New AI Chat conversation", keywords: "chat ai mind new" },
    { cmd: "run chat", title: "run chat", subtitle: "Open AI Chat app", keywords: "chat ai mind" },
    { cmd: "mind(quick ", title: "mind(quick …)", subtitle: "Cheap / fast model", keywords: "mind quick cheap" },
    { cmd: "mind(think ", title: "mind(think …)", subtitle: "Deep / expensive model", keywords: "mind think deep pro" },
    { cmd: "jobs(list)", title: "jobs(list)", subtitle: "List queued and finished jobs", keywords: "jobs list" },
    { cmd: "jobs(capacity)", title: "jobs(capacity)", subtitle: "Open compute capacity contract", keywords: "jobs capacity contract budget" },
    { cmd: "desktop", title: "desktop", subtitle: "Show desktop", keywords: "desktop" },
    { cmd: "settings", title: "settings", subtitle: "Open settings", keywords: "settings" },
  ];

  function applyChrome() {
    if (!root) return;
    root.setAttribute("aria-label", tt("shell.palette.aria", "Command palette"));
    if (input) input.placeholder = tt("shell.palette.placeholder", "Search everything in My Space…");
    if (hintEl && !open) {
      hintEl.textContent = tt("shell.palette.hint", "Type to search · ? AI (can run actions) · > shell");
    }
  }

  function ensure() {
    if (root) return root;
    root = document.createElement("div");
    root.className = "cmd-palette hidden";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", tt("shell.palette.aria", "Command palette"));
    root.innerHTML = `
      <div class="cmd-palette-card">
        <div class="cmd-palette-input-row">
          <span class="cmd-palette-mark" aria-hidden="true">⌘</span>
          <input type="search" class="cmd-palette-input" placeholder="" autocomplete="off" spellcheck="false" />
        </div>
        <div class="cmd-palette-list" role="listbox"></div>
        <div class="cmd-palette-hint"></div>
      </div>`;
    input = root.querySelector(".cmd-palette-input");
    listEl = root.querySelector(".cmd-palette-list");
    hintEl = root.querySelector(".cmd-palette-hint");
    applyChrome();
    document.body.appendChild(root);

    input.addEventListener("input", () => {
      render(input.value);
      scheduleContentSearch(input.value);
    });
    input.addEventListener("keydown", onKeyDown);
    listEl.addEventListener("scroll", () => paintVirtualList(), { passive: true });
    listEl.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const btn = e.target.closest(".cmd-palette-item");
      if (!btn) return;
      e.preventDefault();
      choose(Number(btn.dataset.index));
    });
    listEl.addEventListener("mouseover", (e) => {
      const btn = e.target.closest(".cmd-palette-item");
      if (!btn) return;
      setActive(Number(btn.dataset.index), true);
    });
    root.addEventListener("pointerdown", (e) => {
      if (e.target === root) hide();
    });
    return root;
  }

  function emojiFor(app) {
    if (app.icon && !String(app.icon).startsWith("http") && !String(app.icon).startsWith("data:")) {
      return app.icon;
    }
    return window.MySpaceIcons?.emojiFallback?.(app) || "📦";
  }

  function score(hay, q) {
    const h = hay.toLowerCase();
    if (!q) return 1;
    if (h.startsWith(q)) return 100 - q.length;
    if (h.includes(q)) return 50;
    const parts = q.split(/\s+/).filter(Boolean);
    if (parts.every((p) => h.includes(p))) return 30;
    return 0;
  }

  function isAiQuery(raw) {
    const t = String(raw || "").trim();
    return t.startsWith("?") || /^ask(\s+|$)/i.test(t);
  }

  function aiPromptFrom(raw) {
    return String(raw || "")
      .trim()
      .replace(/^\?\s*/, "")
      .replace(/^ask\s+/i, "")
      .trim();
  }

  function isShellQuery(raw) {
    const t = String(raw || "").trim();
    if (t.startsWith(">")) return true;
    return /^(run|check|close|focus|open|help|alias|macro|when|pin|unpin|reveal|desktop|settings)\b/i.test(t);
  }

  const CONTENT_KINDS = new Set([
    "task",
    "deck",
    "document",
    "contact",
    "contact-group",
    "contract",
    "contract-template",
    "stock",
    "build",
    "vault-entry",
    "drift-event",
    "drift-zone",
    "lexicon-term",
    "country",
    "geo-visit",
    "history-figure",
    "history-event",
    "history-bookmark",
    "space-body",
    "space-mission",
    "space-report",
    "remote-machine",
    "shell-when",
    "translation",
    "clock-city",
    "app-info",
    "page",
  ]);

  function openTabsByAppId() {
    const map = new Map();
    for (const tab of window.MySpaceWorkspace?.getTabs?.() || []) {
      if (!tab.appId) continue;
      if (!map.has(tab.appId)) map.set(tab.appId, tab);
    }
    return map;
  }

  function findApp(appId) {
    return (window.MySpaceConfig?.getApps?.() || []).find((a) => a.id === appId) || null;
  }

  function quickActionItems(q) {
    const out = [];
    const openMap = openTabsByAppId();
    const apps = (window.MySpaceConfig?.getApps?.() || []).filter((a) => a.id !== "welcome" && !a.hidden);

    if (!q) {
      for (const [appId, tab] of openMap) {
        const app = findApp(appId);
        const name = app?.name || tab.title || appId;
        out.push({
          id: `quick:focus:${appId}`,
          kind: "quick",
          action: "focus",
          appId,
          title: tt("shell.palette.quick.focus", "Focus {name}", { name }),
          subtitle: tt("shell.palette.quick.focusSub", "Bring open window to front"),
          icon: "◎",
          rank: 175,
        });
        out.push({
          id: `quick:close:${appId}`,
          kind: "quick",
          action: "close",
          appId,
          title: tt("shell.palette.quick.close", "Close {name}", { name }),
          subtitle: tt("shell.palette.quick.closeSub", "Close this window"),
          icon: "✕",
          rank: 170,
        });
      }
      return out;
    }

    for (const app of apps) {
      const hay = `${app.name} ${app.id} ${app.description || ""} ${app.module || ""}`;
      const rank = score(hay, q);
      if (rank <= 0) continue;
      const isOpenTab = openMap.has(app.id);
      const pinned = window.MySpaceConfig?.isPinnedToTaskbar?.(app.id);

      if (isOpenTab) {
        out.push({
          id: `quick:focus:${app.id}`,
          kind: "quick",
          action: "focus",
          appId: app.id,
          title: tt("shell.palette.quick.focus", "Focus {name}", { name: app.name }),
          subtitle: tt("shell.palette.quick.openWindow", "Open window"),
          icon: "◎",
          rank: rank + 55,
        });
        out.push({
          id: `quick:close:${app.id}`,
          kind: "quick",
          action: "close",
          appId: app.id,
          title: tt("shell.palette.quick.close", "Close {name}", { name: app.name }),
          subtitle: tt("shell.palette.quick.closeWindow", "Close window"),
          icon: "✕",
          rank: rank + 52,
        });
      }

      out.push({
        id: `quick:pin:${app.id}`,
        kind: "quick",
        action: pinned ? "unpin" : "pin",
        appId: app.id,
        title: pinned
          ? tt("shell.palette.quick.unpin", "Unpin {name}", { name: app.name })
          : tt("shell.palette.quick.pin", "Pin {name}", { name: app.name }),
        subtitle: pinned
          ? tt("shell.palette.quick.unpinSub", "Remove from taskbar")
          : tt("shell.palette.quick.pinSub", "Pin to taskbar"),
        icon: pinned ? "📍" : "📌",
        rank: rank + 48,
      });
    }

    return out;
  }

  async function ensureMslCaps() {
    if (mslCapsLoaded) return mslCaps;
    try {
      const res = await window.mySpace?.msl?.list?.();
      mslCaps = res?.ok ? res.capabilities || [] : [];
    } catch {
      mslCaps = [];
    }
    mslCapsLoaded = true;
    return mslCaps;
  }

  function mslCapabilityItems(q) {
    const out = [];
    if (!q || q.length < 2) return out;
    for (const c of mslCaps) {
      const hay = `${c.id} ${c.title} ${c.description} ${c.provider} msl`;
      const rank = score(hay, q);
      if (rank > 0) {
        out.push({
          id: "msl-cap:" + c.id,
          kind: "msl-cap",
          title: c.title || c.id,
          subtitle: `${c.id} · ${c.provider || "msl"}`,
          icon: "⛓",
          capability: c.id,
          rank: rank + 15,
        });
      }
    }
    return out.slice(0, 12);
  }

  function scheduleContentSearch(query) {
    if (searchTimer) clearTimeout(searchTimer);
    const q = String(query || "").trim();
    if (q.length < 2 || isShellQuery(q) || isAiQuery(q)) {
      contentResults = [];
      contentTotal = 0;
      return;
    }
    const token = ++searchToken;
    searchTimer = setTimeout(async () => {
      try {
        await ensureMslCaps();
        const res = await window.mySpace?.desktopSearch?.(q);
        if (token !== searchToken) return;
        contentResults = res?.ok ? res.results || [] : [];
        contentTotal = res?.total || contentResults.length;
        render(input.value, true);
      } catch {
        if (token === searchToken) {
          contentResults = [];
          contentTotal = 0;
        }
      }
    }, 120);
  }

  function contextActions() {
    const tab = window.MySpaceWorkspace?.getActiveTab?.();
    const appId = tab?.appId;
    const out = [];
    if (!appId) return out;

    if (appId === "day-planner") {
      out.push({
        id: "ctx:mark-next-done",
        kind: "context",
        title: "Mark next Today task done",
        subtitle: "Complete the next open agenda item",
        icon: "✓",
        rank: 200,
      });
      out.push({
        id: "ctx:open-today",
        kind: "context",
        title: "Jump to Today agenda",
        subtitle: "Focus the Today app",
        icon: "📅",
        rank: 190,
        appId: "day-planner",
      });
    }

    if (appId === "study-deck") {
      out.push({
        id: "ctx:add-card",
        kind: "context",
        title: "Add Study Deck card…",
        subtitle: "Create a card in your first deck",
        icon: "🃏",
        rank: 200,
      });
    }

    if (appId === "world-clock") {
      out.push({
        id: "ctx:start-focus",
        kind: "context",
        title: "Start Focus mode",
        subtitle: "Silence notifications while you work",
        icon: "◎",
        rank: 200,
      });
    }

    if (appId === "drift") {
      out.push({
        id: "ctx:drift-scan",
        kind: "context",
        title: "Run Drift scan",
        subtitle: "Scan watch zones for new file activity",
        icon: "↻",
        rank: 200,
      });
    }

    if (appId === "stocks") {
      out.push({
        id: "ctx:stocks-portfolio",
        kind: "context",
        title: "Open portfolio",
        subtitle: "Jump to Stocks portfolio",
        icon: "📊",
        rank: 200,
        appId: "stocks",
        route: { page: "portfolio" },
      });
    }

    if (appId === "builds") {
      out.push({
        id: "ctx:builds-timeline",
        kind: "context",
        title: "Builds timeline",
        subtitle: "Chronological project view",
        icon: "🗓️",
        rank: 195,
        appId: "builds",
        route: { page: "timeline" },
      });
    }

    return out;
  }

  function recentItems(q) {
    const recents = window.MySpaceConfig?.getPaletteRecents?.() || [];
    const out = [];
    for (const r of recents) {
      const hay = `${r.title} ${r.subtitle || ""} recent`;
      const rank = score(hay, q);
      if (!q || rank > 0) {
        out.push({
          id: "recent:" + r.id,
          kind: "recent",
          title: r.title,
          subtitle: r.subtitle || "Recent",
          icon: r.icon || "⏱",
          appId: r.appId,
          route: r.route,
          recentKind: r.kind,
          rank: (q ? rank : 80) + 10,
        });
      }
    }
    return out;
  }

  function shellSuggestionItems(raw) {
    const trimmed = String(raw || "").trim().replace(/^>\s*/, "");
    const q = trimmed.toLowerCase();
    const out = [];

    out.push({
      id: "shell:" + trimmed,
      kind: "shell",
      title: trimmed || "Type a shell command",
      subtitle: "Run in My Space shell",
      icon: ">",
      command: trimmed,
      rank: 999,
    });

    for (const s of SHELL_SUGGESTIONS) {
      const hay = `${s.title} ${s.subtitle} ${s.keywords} ${s.cmd}`;
      const rank = !q || s.cmd.startsWith(q) || score(hay, q) > 0 ? score(hay, q) || (s.cmd.startsWith(q) ? 90 : 40) : 0;
      if (!q || rank > 0) {
        out.push({
          id: "shell-suggest:" + s.cmd,
          kind: "shell-suggest",
          title: s.title,
          subtitle: s.subtitle,
          icon: ">",
          fill: s.cmd,
          rank: (q ? rank : 50) + 5,
        });
      }
    }

    const verbMatch = trimmed.match(/^(run|close|focus|pin|unpin|open|reveal)\s+(.*)$/i);
    if (verbMatch) {
      const verb = verbMatch[1].toLowerCase();
      const appQ = (verbMatch[2] || "").toLowerCase().trim();
      const apps = (window.MySpaceConfig?.getApps?.() || []).filter((a) => a.id !== "welcome" && !a.hidden);
      const openMap = openTabsByAppId();
      for (const app of apps) {
        if ((verb === "close" || verb === "focus") && !appQ && !openMap.has(app.id)) continue;
        const hay = `${app.name} ${app.id} ${app.module || ""}`;
        const rank = !appQ || score(hay, appQ) > 0 ? score(hay, appQ) || 40 : 0;
        if (!appQ || rank > 0) {
          const cmd = `${verb} ${app.id}`;
          out.push({
            id: `shell-${verb}:${app.id}`,
            kind: "shell",
            title: cmd,
            subtitle: app.name,
            icon: emojiFor(app),
            command: cmd,
            rank: rank + 60,
          });
        }
      }
    }

    return out;
  }

  function buildItems(query) {
    const raw = String(query || "");
    const q = raw.trim().toLowerCase();

    if (isAiQuery(raw)) {
      const prompt = aiPromptFrom(raw);
      return [
        {
          id: "ai:" + prompt,
          kind: "ai",
          title: prompt || "Ask Gemini…",
          subtitle: prompt ? "Send to AI chat" : "Open AI chat (type after ?)",
          icon: "✦",
          prompt,
          send: Boolean(prompt),
          rank: 999,
        },
      ];
    }

    if (isShellQuery(raw)) {
      return shellSuggestionItems(raw)
        .sort((a, b) => b.rank - a.rank || a.title.localeCompare(b.title))
        .slice(0, 16);
    }

    const out = [];

    out.push(...quickActionItems(q));

    if (!q) {
      out.push(...contextActions());
      out.push(...recentItems(""));
    } else {
      out.push(...recentItems(q));
      for (const ctx of contextActions()) {
        const rank = score(`${ctx.title} ${ctx.subtitle}`, q);
        if (rank > 0) out.push({ ...ctx, rank: rank + 40 });
      }
    }

    const apps = (window.MySpaceConfig?.getApps?.() || []).filter((a) => a.id !== "welcome" && !a.hidden);
    for (const app of apps) {
      const hay = [app.name, app.description, app.type, app.module].filter(Boolean).join(" ");
      const rank = score(hay, q);
      if (!q || rank > 0) {
        out.push({
          id: "app:" + app.id,
          kind: "app",
          title: app.name,
          subtitle: app.description || app.type || "App",
          icon: emojiFor(app),
          app,
          rank: rank + (window.MySpaceConfig?.isPinnedToTaskbar?.(app.id) ? 5 : 0),
        });
      }
    }

    for (const action of staticActions()) {
      const rank = score(`${action.title} ${action.subtitle} ${action.keywords}`, q);
      if (!q || rank > 0) out.push({ ...action, rank: action.id === "action:ask-ai" ? rank + 8 : rank });
    }

    if (q.length >= 2) {
      for (const hit of contentResults) {
        out.push({ ...hit, rank: (hit.rank || 40) + 20 });
      }
      out.push(...mslCapabilityItems(q));
    }

    const byId = new Map();
    for (const item of out) {
      const prev = byId.get(item.id);
      if (!prev || item.rank > prev.rank) byId.set(item.id, item);
    }
    return [...byId.values()]
      .sort((a, b) => b.rank - a.rank || a.title.localeCompare(b.title))
      .slice(0, MAX_PALETTE_ITEMS);
  }

  function updateHint() {
    if (!hintEl) return;
    const n = items.length;
    if (!n) {
      hintEl.textContent = tt("shell.palette.hint", "Type to search, ? AI (can run actions), > shell");
      return;
    }
    const extra =
      contentTotal > contentResults.length
        ? tt("shell.palette.matchedExtra", " · {n} matched", { n: contentTotal })
        : "";
    hintEl.textContent = tt("shell.palette.hintResults", "{n} results{extra}, ↑↓ Enter, Esc, > shell, ? AI", {
      n,
      extra,
    });
  }

  function paintVirtualList() {
    if (!listEl || !items.length) return;
    const scrollTop = listEl.scrollTop;
    const viewH = listEl.clientHeight || 420;
    let start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - VIRTUAL_OVERSCAN);
    let end = Math.min(items.length, Math.ceil((scrollTop + viewH) / ROW_HEIGHT) + VIRTUAL_OVERSCAN);
    if (activeIndex < start) start = Math.max(0, activeIndex - VIRTUAL_OVERSCAN);
    if (activeIndex >= end) end = Math.min(items.length, activeIndex + VIRTUAL_OVERSCAN + 1);

    const topPad = start * ROW_HEIGHT;
    const bottomPad = Math.max(0, (items.length - end) * ROW_HEIGHT);
    const slice = items.slice(start, end);
    listEl.innerHTML = `<div class="cmd-palette-virt-spacer" style="height:${topPad}px"></div>${slice
      .map((item, offset) => {
        const i = start + offset;
        return `<button type="button" class="cmd-palette-item ${i === activeIndex ? "active" : ""}" data-index="${i}" role="option" style="height:${ROW_HEIGHT}px">
        <span class="cmd-palette-item-icon">${item.icon || "•"}</span>
        <span class="cmd-palette-item-text">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.subtitle || "")}</span>
        </span>
        <span class="cmd-palette-item-kind">${escapeHtml(item.kind || "")}</span>
      </button>`;
      })
      .join("")}<div class="cmd-palette-virt-spacer" style="height:${bottomPad}px"></div>`;
  }

  function render(query, keepActive) {
    items = buildItems(query);
    if (!keepActive) activeIndex = 0;
    else activeIndex = Math.min(activeIndex, Math.max(0, items.length - 1));
    updateHint();
    if (!items.length) {
      listEl.innerHTML = `<p class="cmd-palette-empty">${tt("shell.palette.empty", "No matches")}</p>`;
      return;
    }
    paintVirtualList();
    const targetTop = activeIndex * ROW_HEIGHT;
    if (targetTop < listEl.scrollTop) listEl.scrollTop = targetTop;
    else if (targetTop + ROW_HEIGHT > listEl.scrollTop + listEl.clientHeight) {
      listEl.scrollTop = targetTop - listEl.clientHeight + ROW_HEIGHT;
    }
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setActive(index, fromMouse) {
    if (!items.length) return;
    const next = Math.max(0, Math.min(items.length - 1, index));
    if (next === activeIndex) return;
    activeIndex = next;
    if (fromMouse) {
      listEl.querySelectorAll(".cmd-palette-item").forEach((el) => {
        el.classList.toggle("active", Number(el.dataset.index) === activeIndex);
      });
      return;
    }
    paintVirtualList();
    const targetTop = activeIndex * ROW_HEIGHT;
    if (targetTop < listEl.scrollTop) listEl.scrollTop = targetTop;
    else if (targetTop + ROW_HEIGHT > listEl.scrollTop + listEl.clientHeight) {
      listEl.scrollTop = targetTop - listEl.clientHeight + ROW_HEIGHT;
    }
  }

  function rememberApp(app) {
    if (!app?.id) return;
    window.MySpaceConfig?.pushPaletteRecent?.({
      kind: "app",
      id: "app:" + app.id,
      title: app.name,
      subtitle: app.description || "App",
      icon: emojiFor(app),
      appId: app.id,
    });
  }

  async function runContext(item) {
    if (item.id === "ctx:mark-next-done") {
      const res = await window.mySpace?.shellUx?.("task.markNextDone");
      if (res?.ok) window.showMySpaceToast?.("Marked done");
      else window.showMySpaceToast?.(res?.error || "Nothing to mark");
      return;
    }
    if (item.id === "ctx:open-today") {
      handlers?.onLaunchById?.("day-planner");
      return;
    }
    if (item.id === "ctx:add-card") {
      const front = window.prompt("Card front (question)");
      if (!front?.trim()) return;
      const back = window.prompt("Card back (answer)", "") || "";
      const res = await window.mySpace?.shellUx?.("deck.addCard", { front: front.trim(), back: back.trim() });
      if (res?.ok) window.showMySpaceToast?.("Card added");
      else window.showMySpaceToast?.(res?.error || "Could not add card");
      return;
    }
    if (item.id === "ctx:start-focus") {
      await window.MySpaceFocus?.enter?.({ source: "manual" });
      return;
    }
    if (item.id === "ctx:drift-scan") {
      handlers?.onLaunchById?.("drift");
      setTimeout(() => {
        const tab = window.MySpaceWorkspace?.getTabs?.()?.find((t) => t.appId === "drift" && t.mode === "myapp");
        try {
          tab?.viewEl?.executeJavaScript?.(
            "window.DriftApp?.runScan?.({ force: true })",
            false
          );
        } catch {
        }
      }, 400);
      window.showMySpaceToast?.("Drift scan started");
      return;
    }
    if (item.id === "ctx:stocks-portfolio") {
      handlers?.onLaunchById?.("stocks", { route: { page: "portfolio" } });
      return;
    }
    if (item.id === "ctx:builds-timeline") {
      handlers?.onLaunchById?.("builds", { route: { page: "timeline" } });
    }
  }

  async function choose(index) {
    const item = items[index];
    if (!item) return;

    if (item.kind === "shell-suggest") {
      input.value = item.fill.startsWith(">") ? item.fill : `> ${item.fill}`;
      render(input.value);
      scheduleContentSearch(input.value);
      input.focus();
      const len = input.value.length;
      input.setSelectionRange(len, len);
      return;
    }

    hide();
    if (item.kind === "ai") {
      handlers?.onAskAi?.({ prompt: item.prompt || "", send: !!item.send });
      return;
    }
    if (item.kind === "app" && item.app) {
      rememberApp(item.app);
      handlers?.onLaunch?.(item.app);
      return;
    }
    if (item.kind === "recent") {
      if (item.appId) {
        handlers?.onLaunchById?.(item.appId, item.route ? { route: item.route } : undefined);
      } else if (CONTENT_KINDS.has(item.recentKind)) {
        handlers?.onContent?.(item);
      }
      return;
    }
    if (item.kind === "context") {
      await runContext(item);
      return;
    }
    if (item.kind === "quick") {
      handlers?.onQuick?.(item);
      return;
    }
    if (item.kind === "shell-cmd") {
      if (item.command) handlers?.onCommand?.(item.command);
      else handlers?.onShell?.();
      return;
    }
    if (item.kind === "shell") {
      if (!item.command) {
        handlers?.onShell?.();
        return;
      }
      handlers?.onCommand?.(item.command);
      return;
    }
    if (item.kind === "msl-cap" && item.capability) {
      window.MySpaceMslPanel?.show?.();
      window.showMySpaceToast?.(`MSL · ${item.capability}`);
      void window.mySpace?.msl?.invoke?.({ capability: item.capability, input: {} }).then((res) => {
        if (res?.ok === false) window.showMySpaceToast?.(res.error || "MSL invoke failed");
        else window.showMySpaceToast?.(`Invoked ${item.capability}`);
      });
      return;
    }
    if (item.kind === "connect-service") {
      window.MySpaceWorkspace?.openBrowserSearchResult?.(item);
      return;
    }
    if (item.kind === "app-info" && item.launchAppId) {
      handlers?.onLaunchById?.(item.launchAppId);
      return;
    }
    if (CONTENT_KINDS.has(item.kind)) {
      window.MySpaceConfig?.pushPaletteRecent?.({
        kind: item.kind,
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        icon: item.icon,
        route: item.route,
        appId: item.appId || null,
      });
      handlers?.onContent?.(item);
      return;
    }
    if (item.id === "action:ask-ai") handlers?.onAskAi?.({ prompt: "", send: false });
    else if (item.id === "action:msl") window.MySpaceMslPanel?.show?.();
    else if (item.id === "action:parts") {
      if (window.MySpaceParts?.open) void window.MySpaceParts.open({ page: "explore" });
      else window.MySpacePartsPanel?.show?.();
    }
    else if (item.id === "action:jobs") {
      if (window.MySpaceJobs?.open) void window.MySpaceJobs.open({ page: "queue" });
      else window.MySpaceJobsPanel?.show?.();
    }
    else if (item.id === "action:scheduler") {
      if (window.MySpaceScheduler?.open) void window.MySpaceScheduler.open({ page: "active" });
    }
    else if (item.id === "action:mind") {
      if (window.MySpaceMindChat?.open) void window.MySpaceMindChat.open();
      else window.MySpaceMindPanel?.show?.();
    } else if (item.id === "action:mind-setup") window.MySpaceMindPanel?.show?.("setup");
    else if (item.id === "action:flow") {
      if (window.MySpaceFlow?.open) void window.MySpaceFlow.open();
    } else if (item.id === "action:connect") {
      if (window.MySpaceConnect?.open) void window.MySpaceConnect.open();
    }
    else if (item.id === "action:add") handlers?.onAdd?.();
    else if (item.id === "action:settings") handlers?.onSettings?.();
    else if (item.id === "action:desktop") handlers?.onDesktop?.();
    else if (item.id === "action:shell-atlas") {
      if (window.MySpaceShellAtlas?.open) window.MySpaceShellAtlas.open({ page: "overview" });
    }
    else if (item.id === "action:shell") handlers?.onShell?.();
    else if (item.id === "action:snap") handlers?.onSnap?.();
    else if (item.id === "action:new-window") handlers?.onNewWindow?.();
    else if (item.id === "action:shortcuts") handlers?.onShortcuts?.();
    else if (item.id === "action:focus") handlers?.onFocusToggle?.();
    else if (item.id === "action:space-cycle") handlers?.onSpaceCycle?.();
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(activeIndex + 1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(activeIndex - 1);
      return;
    }
    if (e.key === "Tab" && items[activeIndex]?.kind === "shell-suggest") {
      e.preventDefault();
      choose(activeIndex);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const q = input.value.trim();
      if (isAiQuery(q)) {
        hide();
        handlers?.onAskAi?.({ prompt: aiPromptFrom(q), send: Boolean(aiPromptFrom(q)) });
        return;
      }
      if (isShellQuery(q) && items[activeIndex]?.kind !== "shell-suggest") {
        const cmd = q.replace(/^>\s*/, "");
        hide();
        handlers?.onCommand?.(cmd);
        return;
      }
      choose(activeIndex);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      hide();
    }
  }

  function show(nextHandlers) {
    handlers = nextHandlers || {};
    ensure();
    applyChrome();
    open = true;
    contentResults = [];
    contentTotal = 0;
    root.classList.remove("hidden");
    input.value = "";
    render("");
    requestAnimationFrame(() => input.focus());
  }

  function hide() {
    open = false;
    if (root) root.classList.add("hidden");
  }

  function isOpen() {
    return open;
  }

  function refresh() {
    if (!root) return;
    applyChrome();
    if (open) render(input?.value || "", true);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) hide();
  });

  window.addEventListener("myspace-i18n-applied", () => {
    if (root && open) refresh();
    else if (root) applyChrome();
  });

  window.MySpaceCommandPalette = { show, hide, isOpen, refresh };
})();