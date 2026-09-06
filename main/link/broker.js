const registry = require("./registry");
const subscriptions = require("./subscriptions");
const router = require("./router");
const log = require("./log");

const LINK_CLIENTS = new Set([
  "builds",
  "icon-library",
  "apps-info",
  "space",
  "translate",
  "studies",
  "day-planner",
  "shell-console",
  "contacts",
  "notes",
  "geography",
  "world-clock",
  "stocks",
  "history",
  "world-maps",
  "contracts",
  "profiles",
  "study-deck",
  "flag-quiz",
  "drift",
  "code-lexicon",
  "model-flow",
  "files",
  "pulse",
  "desktop",
  "shell",
  "jobs",
  "mind",
  "chat",
  "coupons",
  "scripts",
  "os-bridge",
  "notifications",
  "mail",
  "remote-hub",
  "docs",
  "pi-digits",
  "system-info",
  "msl",
  "browser",
  "connect",
  "search",
  "os",
  "composio",
  "resolve",
]);

function assertClient(caller) {
  if (!LINK_CLIENTS.has(caller)) {
    return { ok: false, error: `Caller "${caller}" is not a Pulse client` };
  }
  return null;
}

function listRoutes(caller, args = {}) {
  const denied = assertClient(caller);
  if (denied) return denied;
  const target = args.target ? String(args.target).trim() : "";
  const kind = args.kind ? String(args.kind).trim() : "";
  let commands = registry.listCommands({ target }).map((r) => ({
    id: r.id,
    target: r.target,
    verb: r.verb,
    kind: r.kind,
    delivery: r.delivery,
    title: r.title,
    description: r.description,
    input: r.input || {},
    emit: r.emit || "",
    examples: r.examples || [],
    source: r.source || "",
  }));
  let events = registry.listEvents({ target }).map((r) => ({
    id: r.id,
    target: r.target,
    verb: r.verb,
    kind: r.kind,
    title: r.title,
    description: r.description,
    payload: r.payload || {},
    source: r.source || "",
  }));
  if (kind === "command") events = [];
  if (kind === "event") commands = [];
  return { ok: true, commands, events };
}

function listProfiles(caller, args = {}) {
  const denied = assertClient(caller);
  if (denied) return denied;
  const fs = require("fs");
  const path = require("path");
  const { pathToFileURL } = require("url");

  const rootDir = path.join(__dirname, "..", "..");
  const appsDir = path.join(rootDir, "apps");
  const brandDir = path.join(rootDir, "src", "brand");

  const MODULE_TO_SERVICE = {
    os: "os",
    desktop: "os",
    browser: "browser",
    connect: "connect",
    shell: "shell",
    scripts: "scripts",
    msl: "msl",
    pulse: "pulse",
    jobs: "jobs",
    scheduler: "scheduler",
    mind: "mind",
    flow: "flow",
    "model-flow": "flow",
    search: "search",
    notifications: "notifications",
    "system-info": "system-info",
    bridge: "bridge",
    "os-bridge": "bridge",
    files: "files",
    composio: "pulse",
    resolve: "resolve",
  };

  function loadPlatformServices() {
    const byId = {};
    for (const rel of ["config/platform-services.json", "src/platform-services.json"]) {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(rootDir, rel), "utf8"));
        for (const s of raw.services || []) {
          if (s?.id) byId[s.id] = s;
        }
      } catch {
      }
    }
    return byId;
  }

  const platformServices = loadPlatformServices();

  function firstExisting(candidates) {
    for (const file of candidates) {
      try {
        if (file && fs.existsSync(file)) return pathToFileURL(file).href;
      } catch {
      }
    }
    return null;
  }

  function resolveIconSrc(moduleId, meta) {
    const candidates = [];

    if (moduleId === "composio" || String(moduleId).startsWith("composio.")) {
      candidates.push(path.join(brandDir, "atom-violet.png"));
    }

    const serviceId = MODULE_TO_SERVICE[moduleId];
    if (serviceId) {
      const mark = String(platformServices[serviceId]?.mark || "atom-white").trim();
      const atomFile = mark.endsWith(".png") ? mark : `${mark}.png`;
      candidates.push(path.join(brandDir, atomFile));
    }

    if (meta.iconPath) {
      candidates.push(path.join(rootDir, String(meta.iconPath).replace(/^\//, "")));
    }
    for (const name of ["logo.png", "logo.svg", "logo.webp", "icon.png", "icon.svg"]) {
      candidates.push(path.join(appsDir, moduleId, name));
    }

    return firstExisting(candidates);
  }

  let appMeta = {};
  try {
    const appsPath = path.join(rootDir, "config", "apps.json");
    const raw = JSON.parse(fs.readFileSync(appsPath, "utf8"));
    for (const app of raw.apps || []) {
      const mod = app.module || app.id;
      appMeta[mod] = app;
      appMeta[app.id] = app;
    }
  } catch {
  }

  const PLATFORM_META = {
    desktop: {
      name: "Desktop",
      description: "My Space shell: toasts, launch & focus",
      icon: "🖥️",
    },
  };
  for (const [id, s] of Object.entries(platformServices)) {
    PLATFORM_META[id] = {
      name: s.name || id,
      description: s.tagline || s.summary || "",
      icon: "",
      service: true,
      mark: s.mark || "atom-white",
    };
  }
  if (PLATFORM_META.os) PLATFORM_META.desktop = { ...PLATFORM_META.os, name: "Desktop" };
  if (PLATFORM_META.flow) {
    PLATFORM_META["model-flow"] = { ...PLATFORM_META.flow };
  }
  if (PLATFORM_META.bridge) {
    PLATFORM_META["os-bridge"] = { ...PLATFORM_META.bridge };
  }
  PLATFORM_META.composio = {
    name: "Composio",
    description: "External tools layer: connect Gmail, GitHub, Slack & more",
    icon: "🔗",
    service: true,
    mark: "atom-violet",
  };

  const q = String(args.q || "").trim().toLowerCase();
  let profiles = registry.listProfiles().map((p) => {
    const meta = appMeta[p.moduleId] || PLATFORM_META[p.moduleId] || {};
    const serviceId =
      MODULE_TO_SERVICE[p.moduleId] ||
      (p.moduleId === "composio" || String(p.moduleId).startsWith("composio.")
        ? "pulse"
        : null);
    const iconSrc = resolveIconSrc(p.moduleId, meta);
    const isExternal = String(p.moduleId).startsWith("composio");
    return {
      moduleId: p.moduleId,
      name:
        meta.name ||
        (isExternal && p.moduleId !== "composio"
          ? `Composio · ${String(p.moduleId).replace(/^composio\./, "")}`
          : null) ||
        p.moduleId,
      appId: meta.id || p.moduleId,
      description: meta.description || p.tagline,
      tagline: p.tagline || meta.description || "",
      icon: meta.icon || p.icon || "",
      iconSrc,
      isService: Boolean(serviceId) || isExternal,
      isExternal,
      serviceId: serviceId || undefined,
      color: p.color || "#7c6fd6",
      commandCount: (p.commands || []).length,
      eventCount: (p.events || []).length,
      commands: p.commands || [],
      events: p.events || [],
      source: p.source || "manifest",
      declaredAt: p.declaredAt,
    };
  });

  if (q) {
    profiles = profiles.filter((p) =>
      `${p.moduleId} ${p.name} ${p.tagline} ${p.description}`.toLowerCase().includes(q)
    );
  }

  return { ok: true, profiles };
}

function getRoute(caller, args = {}) {
  const denied = assertClient(caller);
  if (denied) return denied;
  const id = String(args.id || args.route || "").trim();
  const cmd = registry.findCommand(id);
  if (cmd) return { ok: true, route: cmd };
  const evt = registry.findEvent(id);
  if (evt) return { ok: true, route: evt };
  return { ok: false, error: `Route not found: ${id}` };
}

async function handleLinkInvoke(caller, channel, args = {}, event) {
  const ch = String(channel || "").trim();
  const webContents = event?.sender;

  switch (ch) {
    case "link.routes.list":
      return listRoutes(caller, args);

    case "link.profiles.list":
      return listProfiles(caller, args);

    case "link.profiles.get": {
      const denied = assertClient(caller);
      if (denied) return denied;
      const moduleId = String(args.moduleId || args.target || "").trim();
      const profile = registry.getProfile(moduleId);
      if (!profile) return { ok: false, error: `No Pulse profile: ${moduleId}` };
      const listed = listProfiles(caller, {});
      const row = (listed.profiles || []).find((p) => p.moduleId === moduleId);
      return { ok: true, profile: row || profile };
    }

    case "link.routes.declare": {
      const denied = assertClient(caller);
      if (denied) return denied;
      const moduleId = String(args.moduleId || caller).trim();
      return registry.declareRoutes(moduleId, args);
    }

    case "link.routes.reload": {
      const denied = assertClient(caller);
      if (denied) return denied;
      return registry.reload();
    }

    case "link.routes.get":
      return getRoute(caller, args);

    case "link.command.send":
      {
        const denied = assertClient(caller);
        if (denied) return denied;
        return router.sendCommand(caller, args || {});
      }

    case "link.command.reply": {
      const requestId = String(args?.requestId || "").trim();
      if (!requestId) return { ok: false, error: "requestId required" };
      return router.resolveUiReply(requestId, {
        ok: args?.ok !== false,
        result: args?.result,
        error: args?.error,
      });
    }

    case "link.event.publish": {
      const denied = assertClient(caller);
      if (denied) return denied;
      return router.publishEvent(caller, args || {});
    }

    case "link.event.subscribe": {
      const denied = assertClient(caller);
      if (denied) return denied;
      if (!webContents) return { ok: false, error: "No sender window" };
      const topics = args?.topics || (args?.topic ? [args.topic] : []);
      return subscriptions.subscribe(webContents, caller, topics);
    }

    case "link.event.unsubscribe": {
      if (!webContents) return { ok: false, error: "No sender window" };
      const topics = args?.topics || (args?.topic ? [args.topic] : []);
      return subscriptions.unsubscribe(webContents, topics);
    }

    case "link.subscriptions.list":
      return subscriptions.listSubscriptions();

    case "link.register": {
      const denied = assertClient(caller);
      if (denied) return denied;
      if (!webContents) return { ok: false, error: "No sender window" };
      const moduleId = String(args?.moduleId || caller).trim();
      return subscriptions.registerWindow(webContents, caller, moduleId);
    }

    case "link.windows.list":
      return subscriptions.listRegistered();

    case "link.log.list":
      return log.list(args || {});

    case "link.log.clear":
      return log.clear();

    case "link.stats":
      return {
        ok: true,
        clients: LINK_CLIENTS.size,
        routes: {
          commands: registry.listCommands().length,
          events: registry.listEvents().length,
          profiles: registry.listProfiles().length,
        },
        ...log.snapshot(),
        subscriptions: subscriptions.listSubscriptions().subscriptions?.length || 0,
      };

    default:
      return { ok: false, error: `Unknown Pulse channel: ${ch}` };
  }
}

module.exports = { handleLinkInvoke, LINK_CLIENTS };