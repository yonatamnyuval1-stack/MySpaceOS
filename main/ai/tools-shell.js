const APP_ALIASES = {
  clock: "world-clock",
  worldclock: "world-clock",
  world_clock: "world-clock",
  sysinfo: "system-info",
  sys: "system-info",
  systeminfo: "system-info",
  remote: "remote-hub",
  remotehub: "remote-hub",
  lexicon: "code-lexicon",
  codelexicon: "code-lexicon",
  console: "shell-console",
  shell: "shell-console",
  translation: "translate",
  translator: "translate",
  translations: "translate",
  flags: "flag-quiz",
  flagquiz: "flag-quiz",
  "flag-learn": "flag-quiz",
  learn: "flag-quiz",
  "learning-games": "flag-quiz",
  learninggames: "flag-quiz",
  games: "flag-quiz",
  pi: "pi-digits",
  pie: "pi-digits",
  "pi-digits": "pi-digits",
  pidigits: "pi-digits",
  icons: "icon-library",
  icon: "icon-library",
  "icon-library": "icon-library",
  iconlibrary: "icon-library",
  maps: "world-maps",
  worldmaps: "world-maps",
  geography: "geography",
  geo: "geography",
  vault: "vault",
  stocks: "stocks",
  builds: "builds",
  drift: "drift",
  "model-flow": "model-flow",
  modelflow: "model-flow",
  flow: "model-flow",
  aliens: "aliens",
  contacts: "contacts",
  settings: "settings",
};

const SHELL_TOOL_DEFS = [
  {
    name: "shell_list_apps",
    description:
      "List installed My Space desktop apps (id, name, type, hidden). Use this instead of asking the user what apps exist or what something is called.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Optional filter by id/name/module substring (e.g. translate, stock)",
        },
        includeHidden: {
          type: "boolean",
          description: "Include hidden apps (default false)",
        },
      },
    },
  },
  {
    name: "shell_open_app",
    description:
      "Open a My Space app by id, name, or alias (e.g. world-clock, Clock, clock, stocks, translate, translation). Use when the user asks to open/launch an app. For a specific stock ticker prefer shell_open_stock or shell_run_command with run stocks(AAPL).",
    parameters: {
      type: "object",
      properties: {
        app: {
          type: "string",
          description: "App id, display name, or alias (clock → world-clock, translation → translate)",
        },
      },
      required: ["app"],
    },
  },
  {
    name: "shell_open_stock",
    description:
      "Open the Stocks app on a specific ticker (e.g. AAPL, MSFT). Use when the user asks to show/open a stock symbol.",
    parameters: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Ticker symbol, e.g. AAPL",
        },
      },
      required: ["symbol"],
    },
  },
  {
    name: "shell_open_country",
    description:
      "Open Geography on a country by name or ISO code (e.g. Togo, TG, Israel, IL). Prefer this over shell_run_command for countries.",
    parameters: {
      type: "object",
      properties: {
        country: {
          type: "string",
          description: "Country name or ISO alpha-2/3 code",
        },
        page: {
          type: "string",
          description: '"explore" (default) or "learn"',
        },
      },
      required: ["country"],
    },
  },
  {
    name: "shell_focus_app",
    description:
      "Focus an already-open app window/tab (id/name/alias). Prefer this over reopening when the app is already running.",
    parameters: {
      type: "object",
      properties: {
        app: {
          type: "string",
          description: "App id, display name, or alias",
        },
      },
      required: ["app"],
    },
  },
  {
    name: "shell_close_app",
    description:
      "Close open tabs/windows for an app (id/name/alias like clock or world-clock) and return to desktop. Requires brief user confirmation.",
    parameters: {
      type: "object",
      properties: {
        app: {
          type: "string",
          description: "App id, display name, or alias (clock → world-clock)",
        },
      },
      required: ["app"],
    },
  },
  {
    name: "shell_open_page",
    description:
      "Open a myapp and switch to a page (e.g. app=clock page=timer, or app=world-clock page=pomodoro). For deep routes like a stock ticker use shell_run_command with run stocks(AAPL).",
    parameters: {
      type: "object",
      properties: {
        app: { type: "string", description: "App id, name, or alias" },
        page: { type: "string", description: "Page id inside the app" },
      },
      required: ["app", "page"],
    },
  },
  {
    name: "shell_run_command",
    description:
      "Run a My Space shell command. Grammar: run <app>, run <app>(page), run <app>(key:value, …). Examples: run stocks(AAPL), run stocks(symbol:MSFT), run geography(Togo), run geography(page:learn, country:TG), run translate(text:hello, to:he), run lexicon(promise), run clock(timer). Chain with ; (stop on error) or | (keep going). Prefer dedicated shell_open_* tools when enough.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description:
            "Shell line without leading >, e.g. run stocks(symbol:AAPL) or run geography(Togo); run flags(quiz)",
        },
      },
      required: ["command"],
    },
  },
  {
    name: "shell_move_app",
    description:
      "Move a desktop app ICON to pixel coordinates (x,y) on the desktop. Use this for layout — there is no shell_move_window tool.",
    parameters: {
      type: "object",
      properties: {
        app: { type: "string", description: "App id, name, or alias (e.g. translate, translation, clock)" },
        x: { type: "number" },
        y: { type: "number" },
      },
      required: ["app", "x", "y"],
    },
  },
  {
    name: "shell_get_context",
    description:
      "Get where the user is now in My Space: desktop vs workspace, active app/tab, page id, URL, title, and open tabs. Prefer this when the auto-attached context may be stale or incomplete. Also use to see currently open apps — do not ask the user.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "shell_get_page_content",
    description:
      "Read visible text from the user's current My Space page (myapp or in-app browser tab). Use when you need to see what is written on screen, forms, lists, or article content. Not available for external Windows apps or the bare desktop.",
    parameters: {
      type: "object",
      properties: {
        maxChars: {
          type: "number",
          description: "Max characters of page text to return (default 8000, max 20000)",
        },
      },
    },
  },
  {
    name: "shell_capture_screen",
    description:
      "Take a fresh screenshot. Returns an image the model can see on the next turn, plus decoded facts when available.",
    parameters: {
      type: "object",
      properties: {
        source: {
          type: "string",
          description: '"window" = My Space window (default). "display" = full primary monitor.',
        },
      },
    },
  },
];

function escapeJs(s) {
  return JSON.stringify(String(s ?? ""));
}

function normalizeRefKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function resolveAppArg(args) {
  if (args == null) return "";
  if (typeof args === "string") return args.trim();
  if (typeof args !== "object") return "";
  const candidates = [
    args.app,
    args.appId,
    args.app_id,
    args.appName,
    args.app_name,
    args.name,
    args.target,
    args.id,
    args.module,
  ];
  for (const c of candidates) {
    if (c != null && String(c).trim()) return String(c).trim();
  }
  return "";
}

function canonicalizeAppRef(appRef) {
  const raw = String(appRef || "").trim();
  if (!raw) return "";
  const key = normalizeRefKey(raw);
  if (APP_ALIASES[key]) return APP_ALIASES[key];
  if (APP_ALIASES[raw.toLowerCase()]) return APP_ALIASES[raw.toLowerCase()];
  return raw;
}

function findAppJs(appRefExpr) {
  return `
    (() => {
      const raw = String(${appRefExpr} || "").trim();
      const aliases = ${JSON.stringify(APP_ALIASES)};
      const norm = (v) => String(v || "").trim().toLowerCase().replace(/[\\s_-]+/g, "");
      let key = norm(raw);
      let want = aliases[key] || aliases[raw.toLowerCase()] || raw;
      const wantKey = norm(want);
      const apps = window.MySpaceConfig?.getApps?.() || [];
      const score = (a) => {
        const id = norm(a.id);
        const name = norm(a.name);
        const mod = norm(a.module);
        if (id === wantKey || name === wantKey || mod === wantKey) return 100;
        if (id === key || name === key || mod === key) return 95;
        if (wantKey && (id.startsWith(wantKey) || name.startsWith(wantKey) || mod.startsWith(wantKey))) return 80;
        if (key && (id.startsWith(key) || name.startsWith(key))) return 75;
        if (wantKey && (id.includes(wantKey) || name.includes(wantKey) || mod.includes(wantKey))) return 60;
        if (key && (id.includes(key) || name.includes(key) || mod.includes(key))) return 55;
        if (wantKey && wantKey.includes(id) && id.length >= 4) return 40;
        if (key && key.includes(id) && id.length >= 4) return 35;
        return 0;
      };
      let best = null;
      let bestScore = 0;
      const suggestions = [];
      for (const a of apps) {
        const s = score(a);
        if (s > 0) suggestions.push({ id: a.id, name: a.name, score: s });
        if (s > bestScore) {
          bestScore = s;
          best = a;
        }
      }
      suggestions.sort((a, b) => b.score - a.score);
      if (bestScore >= 35) return { app: best, suggestions: suggestions.slice(0, 5) };
      return {
        app: null,
        suggestions: apps.slice(0, 12).map((a) => ({ id: a.id, name: a.name })),
      };
    })()
  `;
}

async function runInRenderer(getMainWindow, script) {
  const win = typeof getMainWindow === "function" ? getMainWindow() : getMainWindow;
  if (!win || win.isDestroyed?.()) {
    return { ok: false, error: "Main window unavailable — is My Space open?" };
  }
  try {
    const result = await win.webContents.executeJavaScript(script, true);
    return result && typeof result === "object" ? result : { ok: true, result };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

async function shellListApps(args, ctx) {
  const query = String(args?.query || args?.q || args?.filter || "").trim();
  const includeHidden = !!args?.includeHidden;
  return runInRenderer(
    ctx.getMainWindow,
    `
    (() => {
      const q = ${escapeJs(query)}.toLowerCase();
      const includeHidden = ${includeHidden ? "true" : "false"};
      const apps = window.MySpaceConfig?.getApps?.() || [];
      let list = apps
        .filter((a) => includeHidden || !a.hidden)
        .map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          module: a.module || undefined,
          hidden: !!a.hidden,
        }));
      if (q) {
        list = list.filter((a) =>
          [a.id, a.name, a.module].some((v) => String(v || "").toLowerCase().includes(q))
        );
      }
      list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
      return { ok: true, count: list.length, apps: list };
    })()
  `
  );
}

async function shellOpenApp(args, ctx) {
  const appRef = canonicalizeAppRef(resolveAppArg(args));
  if (!appRef) return { ok: false, error: "app is required (e.g. clock or world-clock)" };
  return runInRenderer(
    ctx.getMainWindow,
    `
    (async () => {
      const found = ${findAppJs(escapeJs(appRef))};
      const app = found?.app || null;
      if (!app) {
        return {
          ok: false,
          error: "App not found: " + ${escapeJs(appRef)},
          suggestions: found?.suggestions || [],
          hint: "Call shell_list_apps to see installed apps. Do not ask the user.",
        };
      }
      if (typeof window.__myspaceAiLaunchApp === "function") {
        await window.__myspaceAiLaunchApp(app);
      } else {
        return { ok: false, error: "Launch bridge missing" };
      }
      return { ok: true, appId: app.id, name: app.name };
    })()
  `
  );
}

async function shellOpenStock(args, ctx) {
  const symbol = String(args?.symbol || args?.ticker || args?.param || args?.app || "")
    .trim()
    .toUpperCase();
  if (!symbol || !/^[A-Z0-9.^=-]{1,12}$/.test(symbol)) {
    return { ok: false, error: "symbol is required (e.g. AAPL)" };
  }
  return runInRenderer(
    ctx.getMainWindow,
    `
    (async () => {
      const found = ${findAppJs(escapeJs("stocks"))};
      const app = found?.app || null;
      if (!app) {
        return { ok: false, error: "Stocks app not found", suggestions: found?.suggestions || [] };
      }
      const route = { action: "openStock", param: ${escapeJs(symbol)} };
      if (typeof window.__myspaceAiLaunchApp === "function") {
        await window.__myspaceAiLaunchApp(app, { route });
      } else {
        return { ok: false, error: "Launch bridge missing" };
      }
      return { ok: true, appId: app.id, symbol: ${escapeJs(symbol)}, route };
    })()
  `
  );
}

function resolveCountryInMain(ref) {
  const { resolveCountryRef } = require("./country-resolve");
  return resolveCountryRef(ref);
}

async function shellOpenCountry(args, ctx) {
  const countryRef = String(args?.country || args?.name || args?.code || args?.param || "").trim();
  const page = String(args?.page || "explore").toLowerCase() === "learn" ? "learn" : "explore";
  const code = resolveCountryInMain(countryRef);
  if (!code) {
    return { ok: false, error: `Country not found: ${countryRef}`, hint: "Use a name (Togo) or ISO code (TG)." };
  }
  const action = page === "learn" ? "openLearn" : "openCountry";
  return runInRenderer(
    ctx.getMainWindow,
    `
    (async () => {
      const found = ${findAppJs(escapeJs("geography"))};
      const app = found?.app || null;
      if (!app) {
        return { ok: false, error: "Geography app not found", suggestions: found?.suggestions || [] };
      }
      const route = { page: ${escapeJs(page)}, param: ${escapeJs(code)}, action: ${escapeJs(action)} };
      if (typeof window.__myspaceAiLaunchApp === "function") {
        await window.__myspaceAiLaunchApp(app, { route });
      } else {
        return { ok: false, error: "Launch bridge missing" };
      }
      return { ok: true, appId: app.id, country: ${escapeJs(code)}, page: ${escapeJs(page)}, route };
    })()
  `
  );
}

async function shellFocusApp(args, ctx) {
  const appRef = canonicalizeAppRef(resolveAppArg(args));
  if (!appRef) return { ok: false, error: "app is required (e.g. clock or world-clock)" };
  return runInRenderer(
    ctx.getMainWindow,
    `
    (() => {
      const found = ${findAppJs(escapeJs(appRef))};
      const app = found?.app || null;
      if (!app) {
        return {
          ok: false,
          error: "App not found: " + ${escapeJs(appRef)},
          suggestions: found?.suggestions || [],
          hint: "Call shell_list_apps. Do not ask the user.",
        };
      }
      const tab = window.MySpaceAppMenu?.findOpenTab?.(app);
      if (!tab) {
        return { ok: false, error: app.name + " is not open", appId: app.id, hint: "Use shell_open_app first." };
      }
      window.MySpaceWorkspace?.showWorkspace?.(tab.id);
      return { ok: true, appId: app.id, name: app.name, focused: true };
    })()
  `
  );
}

async function shellCloseApp(args, ctx) {
  const appRef = canonicalizeAppRef(resolveAppArg(args));
  if (!appRef) return { ok: false, error: "app is required (e.g. clock or world-clock)" };
  return runInRenderer(
    ctx.getMainWindow,
    `
    (() => {
      const found = ${findAppJs(escapeJs(appRef))};
      const app = found?.app || null;
      if (!app) {
        return {
          ok: false,
          error: "App not found: " + ${escapeJs(appRef)},
          suggestions: found?.suggestions || [],
          hint: "Call shell_list_apps. Do not ask the user.",
        };
      }
      window.MySpaceWorkspace?.closeTabsForApp?.(app.id);
      window.MySpaceWorkspace?.minimizeToDesktop?.();
      return { ok: true, appId: app.id, name: app.name, closed: true };
    })()
  `
  );
}

async function shellRunCommand(args, ctx) {
  const command = String(args?.command || args?.line || args?.cmd || "")
    .trim()
    .replace(/^>\s*/, "");
  if (!command) return { ok: false, error: "command is required (e.g. run stocks(AAPL))" };
  if (command.length > 500) return { ok: false, error: "command too long" };
  return runInRenderer(
    ctx.getMainWindow,
    `
    (async () => {
      const line = ${escapeJs(command)};
      if (!window.MySpaceShellBridge?.executeCommand) {
        return { ok: false, error: "Shell bridge missing" };
      }
      const result = await window.MySpaceShellBridge.executeCommand(line, "ai");
      return {
        ok: !!result?.ok,
        command: line,
        message: result?.message || "",
        error: result?.ok ? undefined : result?.error || result?.message || "Command failed",
      };
    })()
  `
  );
}

async function shellOpenPage(args, ctx) {
  const appRef = canonicalizeAppRef(resolveAppArg(args));
  const page = String(args?.page || args?.tab || args?.view || "").trim();
  if (!appRef || !page) return { ok: false, error: "app and page are required" };
  return runInRenderer(
    ctx.getMainWindow,
    `
    (async () => {
      const found = ${findAppJs(escapeJs(appRef))};
      const app = found?.app || null;
      const pageId = ${escapeJs(page)};
      if (!app) {
        return {
          ok: false,
          error: "App not found: " + ${escapeJs(appRef)},
          suggestions: found?.suggestions || [],
          hint: "Call shell_list_apps. Do not ask the user.",
        };
      }
      const route = { page: pageId };
      if (typeof window.__myspaceAiLaunchApp === "function") {
        await window.__myspaceAiLaunchApp(app, { route });
      } else {
        return { ok: false, error: "Launch bridge missing" };
      }
      return { ok: true, appId: app.id, page: pageId };
    })()
  `
  );
}

async function shellMoveApp(args, ctx) {
  const appRef = canonicalizeAppRef(resolveAppArg(args));
  const x = Number(args?.x);
  const y = Number(args?.y);
  if (!appRef) return { ok: false, error: "app is required" };
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return { ok: false, error: "x and y must be numbers" };
  }
  return runInRenderer(
    ctx.getMainWindow,
    `
    (() => {
      const found = ${findAppJs(escapeJs(appRef))};
      const app = found?.app || null;
      if (!app) {
        return {
          ok: false,
          error: "App not found: " + ${escapeJs(appRef)},
          suggestions: found?.suggestions || [],
          hint: "Call shell_list_apps or retry with id \\"translate\\" for Translate. Do not ask the user.",
        };
      }
      const nx = Math.max(0, Math.round(${x}));
      const ny = Math.max(0, Math.round(${y}));
      window.MySpaceConfig?.setPosition?.(app.id, nx, ny);
      if (typeof window.__myspaceAiRefreshDesktop === "function") {
        window.__myspaceAiRefreshDesktop();
      }
      return { ok: true, appId: app.id, name: app.name, x: nx, y: ny };
    })()
  `
  );
}

async function openClockPage(page, ctx) {
  return shellOpenPage({ app: "world-clock", page }, ctx);
}

async function shellGetContext(_args, ctx) {
  return runInRenderer(
    ctx.getMainWindow,
    `
    (async () => {
      if (typeof window.MySpaceWorkspace?.getAiContext !== "function") {
        return { ok: false, error: "getAiContext unavailable" };
      }
      return await window.MySpaceWorkspace.getAiContext();
    })()
  `
  );
}

async function shellGetPageContent(args, ctx) {
  const raw = Number(args?.maxChars ?? args?.max_chars ?? 8000);
  const maxChars = Number.isFinite(raw) ? raw : 8000;
  const win = typeof ctx?.getMainWindow === "function" ? ctx.getMainWindow() : ctx?.getMainWindow;

  let guestMiss = null;
  try {
    const { readGuestPageContent } = require("./page-content");
    const guest = await readGuestPageContent(win, maxChars);
    if (guest?.ok) return guest;
    guestMiss = guest;
  } catch (err) {
    guestMiss = { ok: false, error: err?.message || String(err) };
  }

  const renderer = await runInRenderer(
    ctx.getMainWindow,
    `
    (async () => {
      if (typeof window.MySpaceWorkspace?.getAiPageContent !== "function") {
        return { ok: false, error: "getAiPageContent unavailable" };
      }
      return await window.MySpaceWorkspace.getAiPageContent(${JSON.stringify(maxChars)});
    })()
  `
  );
  if (renderer?.ok) return renderer;

  return {
    ok: false,
    error:
      renderer?.error ||
      guestMiss?.error ||
      "Could not read page content (guest webContents and renderer both failed).",
    view: renderer?.view || guestMiss?.view,
    active: renderer?.active || guestMiss?.active,
    guestError: guestMiss?.error || undefined,
    rendererError: renderer?.error || undefined,
  };
}

async function shellCaptureScreen(args, ctx) {
  const { captureScreenForAi } = require("./screen-capture");
  const sourceRaw = String(args?.source || args?.target || "auto").toLowerCase();
  let source = "auto";
  if (sourceRaw === "display" || sourceRaw === "desktop" || sourceRaw === "monitor") source = "display";
  else if (sourceRaw === "window") source = "window";
  const cap = await captureScreenForAi(ctx.getMainWindow?.(), {
    source,
    hideChat: true,
  });
  if (!cap?.ok) return { ok: false, error: cap?.error || "Capture failed", source };

  const focalUrls = (cap.images || []).map((i) => i.url).filter(Boolean);
  let primaryFlag = null;
  for (const url of focalUrls) {
    const m = String(url).match(/flagcdn\.com\/(?:[wh]\d+\/)?([a-z]{2})(?:[@./?]|$)/i);
    if (m) {
      primaryFlag = { src: url, flagCode: m[1].toLowerCase() };
      break;
    }
  }
  try {
    const page = await shellGetPageContent({ maxChars: 2000 }, ctx);
    if (page?.ok && page.primaryFlag?.flagCountry) {
      primaryFlag = page.primaryFlag;
    } else if (page?.ok && page.primaryFlag?.flagCode && primaryFlag) {
      primaryFlag = { ...primaryFlag, ...page.primaryFlag };
    } else if (page?.ok && page.primaryFlag) {
      primaryFlag = page.primaryFlag;
    }
  } catch {
  }

  return {
    ok: true,
    source: cap.source,
    width: cap.width,
    height: cap.height,
    bytes: cap.bytes,
    imageCount: cap.images?.length || 1,
    focalUrls,
    primaryFlag,
    note: "Model Lab is text-only. Use primaryFlag / focalUrls as what is on screen.",
  };
}

async function executeShellTool(name, args, ctx) {
  switch (name) {
    case "shell_list_apps":
      return shellListApps(args, ctx);
    case "shell_open_app":
      return shellOpenApp(args, ctx);
    case "shell_open_stock":
      return shellOpenStock(args, ctx);
    case "shell_open_country":
      return shellOpenCountry(args, ctx);
    case "shell_focus_app":
      return shellFocusApp(args, ctx);
    case "shell_close_app":
      return shellCloseApp(args, ctx);
    case "shell_open_page":
      return shellOpenPage(args, ctx);
    case "shell_run_command":
      return shellRunCommand(args, ctx);
    case "shell_move_app":
      return shellMoveApp(args, ctx);
    case "shell_get_context":
      return shellGetContext(args, ctx);
    case "shell_get_page_content":
      return shellGetPageContent(args, ctx);
    case "shell_capture_screen":
      return shellCaptureScreen(args, ctx);
    default:
      return { ok: false, error: `Unknown shell tool: ${name}` };
  }
}

module.exports = {
  SHELL_TOOL_DEFS,
  APP_ALIASES,
  executeShellTool,
  openClockPage,
  shellListApps,
  shellOpenApp,
  shellOpenStock,
  shellOpenCountry,
  shellFocusApp,
  shellCloseApp,
  shellOpenPage,
  shellRunCommand,
  shellGetContext,
  shellGetPageContent,
  shellCaptureScreen,
  resolveAppArg,
  canonicalizeAppRef,
};