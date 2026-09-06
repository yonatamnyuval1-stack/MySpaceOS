const { handleDriftInvoke } = require("../apps/drift-ipc");
const { shellOpenPage } = require("./tools-shell");

const EVENT_TYPE_HINT =
  "baseline | new_folder | new_file | modified_file | deleted_file | deleted_folder | new_project | myspace_app | myspace_config | git_commit | scan_complete | all";

function periodToSinceDays(args) {
  if (args?.sinceDays != null && args.sinceDays !== "") {
    const n = parseInt(args.sinceDays, 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }
  const p = String(args?.period || "")
    .trim()
    .toLowerCase();
  if (!p || p === "all") return undefined;
  if (p === "today" || p === "day" || p === "1d") return 1;
  if (p === "week" || p === "7d") return 7;
  if (p === "month" || p === "30d") return 30;
  if (p === "90d" || p === "quarter") return 90;
  const n = parseInt(p, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function periodToInsightDays(args) {
  if (args?.days != null && args.days !== "") {
    const n = parseInt(args.days, 10);
    if (Number.isFinite(n)) return Math.min(90, Math.max(7, n));
  }
  const p = String(args?.period || "")
    .trim()
    .toLowerCase();
  if (p === "week" || p === "7d" || p === "7") return 7;
  if (p === "month" || p === "30d" || p === "30") return 30;
  if (p === "90d" || p === "quarter" || p === "90") return 90;
  return 7;
}

function slimEvent(e) {
  if (!e || typeof e !== "object") return e;
  return {
    id: e.id,
    type: e.type,
    typeLabel: e.typeLabel,
    title: e.title,
    summary: e.summary,
    at: e.at,
    zoneId: e.zoneId,
    zoneLabel: e.zoneLabel,
    path: e.path,
    rel: e.rel,
  };
}

async function listZonesRaw() {
  return handleDriftInvoke("zones.list", {});
}

async function resolveZone(ref) {
  const raw = String(ref || "").trim();
  if (!raw) return null;
  const listed = await listZonesRaw();
  if (!listed?.ok) return null;
  const zones = listed.zones || [];
  const norm = (s) =>
    String(s || "")
      .trim()
      .toLowerCase()
      .replace(/[/\\]+/g, "\\");
  const key = norm(raw);
  return (
    zones.find((z) => norm(z.id) === key) ||
    zones.find((z) => norm(z.label) === key) ||
    zones.find((z) => norm(z.path) === key) ||
    zones.find((z) => norm(z.label).includes(key)) ||
    zones.find((z) => norm(z.path).includes(key)) ||
    null
  );
}

async function driftListEvents(args) {
  const type = String(args?.type || args?.eventType || "all").trim() || "all";
  let zoneId = String(args?.zoneId || "").trim();
  const zoneRef = args?.zone || args?.zoneLabel || args?.zoneName;
  if (!zoneId && zoneRef) {
    const zone = await resolveZone(zoneRef);
    if (!zone) return { ok: false, error: `Zone not found: ${zoneRef}` };
    zoneId = zone.id;
  }
  if (!zoneId) zoneId = "all";

  const q = String(args?.q || args?.query || args?.search || "").trim();
  const sinceDays = periodToSinceDays(args);
  const offset = Math.max(0, parseInt(args?.offset, 10) || 0);
  const limit = Math.min(50, Math.max(1, parseInt(args?.limit, 10) || 20));

  const res = await handleDriftInvoke("events.list", {
    type,
    zoneId,
    q,
    sinceDays,
    offset,
    limit,
  });
  if (!res?.ok) return res || { ok: false, error: "Failed to list events" };

  return {
    ok: true,
    total: res.total,
    offset: res.offset,
    limit: res.limit,
    events: (res.events || []).map(slimEvent),
  };
}

async function driftGetInsights(args) {
  const days = periodToInsightDays(args);
  const res = await handleDriftInvoke("insights.get", { days });
  if (!res?.ok) return res || { ok: false, error: "Failed to get insights" };

  return {
    ok: true,
    stats: res.stats,
    byType: res.byType,
    byZone: res.byZone,
    byDay: res.byDay,
    zones: (res.zones || []).map((z) => ({
      id: z.id,
      label: z.label,
      path: z.path,
      enabled: z.enabled,
      lastScannedAt: z.lastScannedAt,
      entryCount: z.entryCount,
    })),
  };
}

async function driftListZones() {
  const res = await listZonesRaw();
  if (!res?.ok) return res || { ok: false, error: "Failed to list zones" };
  return {
    ok: true,
    settings: res.settings,
    zones: (res.zones || []).map((z) => ({
      id: z.id,
      label: z.label,
      path: z.path,
      enabled: z.enabled,
      createdAt: z.createdAt,
      lastScannedAt: z.lastScannedAt,
      entryCount: z.entryCount,
      snapshotAt: z.snapshotAt,
    })),
  };
}

async function driftRunScan(args) {
  let zoneId = String(args?.zoneId || "").trim();
  const zoneRef = args?.zone || args?.zoneLabel || args?.zoneName;
  if (!zoneId && zoneRef) {
    const zone = await resolveZone(zoneRef);
    if (!zone) return { ok: false, error: `Zone not found: ${zoneRef}` };
    zoneId = zone.id;
  }
  return handleDriftInvoke("scan.run", {
    zoneId: zoneId || undefined,
    force: args?.force !== false,
    auto: false,
  });
}

async function driftAddZone(args) {
  const folder = String(args?.path || args?.folder || args?.dir || "").trim();
  if (!folder) return { ok: false, error: "path is required (absolute folder path)" };
  const label = args?.label != null ? String(args.label).trim() : undefined;
  const res = await handleDriftInvoke("zones.add", { path: folder, label });
  if (!res?.ok) return res;

  let scan = null;
  if (args?.scanNow !== false) {
    scan = await handleDriftInvoke("scan.run", {
      zoneId: res.zone?.id,
      force: true,
    });
  }
  return {
    ok: true,
    zone: res.zone,
    scanned: Boolean(scan?.ok && !scan?.skipped),
    scan: scan && scan.ok ? { newEvents: scan.newEvents, scanned: scan.scanned } : scan,
  };
}

async function driftToggleZone(args) {
  let id = String(args?.id || args?.zoneId || "").trim();
  const zoneRef = args?.zone || args?.zoneLabel || args?.zoneName || args?.label;
  if (!id && zoneRef) {
    const zone = await resolveZone(zoneRef);
    if (!zone) return { ok: false, error: `Zone not found: ${zoneRef}` };
    id = zone.id;
  }
  if (!id) return { ok: false, error: "Provide zone id or zone label/path" };

  const payload = { id };
  if (args?.enabled !== undefined) payload.enabled = Boolean(args.enabled);
  return handleDriftInvoke("zones.toggle", payload);
}

async function driftUpdateSettings(args) {
  const patch = {};
  if (args?.paused !== undefined) patch.paused = Boolean(args.paused);
  if (args?.trackGit !== undefined) patch.trackGit = Boolean(args.trackGit);
  if (args?.autoScanOnOpen !== undefined) patch.autoScanOnOpen = Boolean(args.autoScanOnOpen);
  if (args?.autoScanMinutes !== undefined) patch.autoScanMinutes = args.autoScanMinutes;

  if (!Object.keys(patch).length) {
    return {
      ok: false,
      error: "Provide at least one setting: paused, trackGit, autoScanOnOpen, autoScanMinutes",
    };
  }
  return handleDriftInvoke("settings.update", patch);
}

const DRIFT_TOOL_DEFS = [
  {
    name: "drift_list_events",
    description:
      "List recent Drift activity events (file/folder/project/git changes). Filter by type, zone, search text, or time period.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search title, path, summary" },
        type: { type: "string", description: `Event type filter: ${EVENT_TYPE_HINT}` },
        zone: { type: "string", description: "Zone id, label, or path" },
        zoneId: { type: "string", description: "Zone id (alternative to zone)" },
        period: {
          type: "string",
          description: "Time window: today | week | month | all (or sinceDays number)",
        },
        sinceDays: { type: "number", description: "Only events from the last N days" },
        limit: { type: "number", description: "Max events to return (default 20, max 50)" },
        offset: { type: "number", description: "Pagination offset" },
      },
    },
  },
  {
    name: "drift_get_insights",
    description:
      "Get Drift activity insights: totals, by type/zone/day, and comparison to the previous period.",
    parameters: {
      type: "object",
      properties: {
        days: { type: "number", description: "Period length: 7, 30, or 90 (default 7)" },
        period: { type: "string", description: "Alias: week | month | 90d" },
      },
    },
  },
  {
    name: "drift_list_zones",
    description: "List Drift watch zones (folders being monitored) and current scan settings.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "drift_run_scan",
    description:
      "Run a Drift scan now to detect new filesystem/git changes. Optionally scan one zone only.",
    parameters: {
      type: "object",
      properties: {
        zone: { type: "string", description: "Optional zone id, label, or path" },
        zoneId: { type: "string", description: "Optional zone id" },
        force: {
          type: "boolean",
          description: "Force scan even if one ran recently (default true)",
        },
      },
    },
  },
  {
    name: "drift_add_zone",
    description: "Add a folder as a Drift watch zone.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute folder path to watch" },
        label: { type: "string", description: "Optional display name" },
        scanNow: {
          type: "boolean",
          description: "Run an initial baseline scan after adding ",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "drift_toggle_zone",
    description: "Enable or disable a Drift watch zone. Omit enabled to flip current state.",
    parameters: {
      type: "object",
      properties: {
        zone: { type: "string", description: "Zone id, label, or path" },
        id: { type: "string", description: "Zone id" },
        enabled: { type: "boolean", description: "true=enable, false=disable; omit to toggle" },
      },
    },
  },
  {
    name: "drift_update_settings",
    description:
      "Update Drift settings: pause tracking, git commit tracking, auto-scan on open, auto-scan interval.",
    parameters: {
      type: "object",
      properties: {
        paused: { type: "boolean", description: "Pause all Drift tracking/scans" },
        trackGit: { type: "boolean", description: "Track new git commits in zones" },
        autoScanOnOpen: { type: "boolean", description: "Scan when Drift opens" },
        autoScanMinutes: {
          type: "number",
          description: "Auto-scan interval in minutes (0 = off; typical 15/30/60/120)",
        },
      },
    },
  },
];

async function maybeOpenDrift(page, ctx, result) {
  if (!result?.ok || !ctx?.getMainWindow) return result;
  try {
    const opened = await shellOpenPage({ app: "drift", page }, ctx);
    if (opened?.ok) result.openedPage = page;
    else if (opened?.error) result.openWarning = opened.error;
  } catch (err) {
    result.openWarning = err.message || String(err);
  }
  return result;
}

async function executeDriftTool(name, args, ctx) {
  let result;
  switch (name) {
    case "drift_list_events":
      result = await driftListEvents(args);
      break;
    case "drift_get_insights":
      result = await driftGetInsights(args);
      break;
    case "drift_list_zones":
      result = await driftListZones();
      break;
    case "drift_run_scan":
      result = await driftRunScan(args);
      break;
    case "drift_add_zone":
      result = await driftAddZone(args);
      break;
    case "drift_toggle_zone":
      result = await driftToggleZone(args);
      break;
    case "drift_update_settings":
      result = await driftUpdateSettings(args);
      break;
    default:
      result = { ok: false, error: `Unknown drift tool: ${name}` };
  }

  if (
    result?.ok &&
    ["drift_run_scan", "drift_add_zone", "drift_toggle_zone", "drift_update_settings"].includes(name)
  ) {
    const page =
      name === "drift_run_scan"
        ? "activity"
        : name === "drift_update_settings" || name === "drift_toggle_zone" || name === "drift_add_zone"
          ? "zones"
          : "activity";
    result = await maybeOpenDrift(page, ctx, result);
  }

  return result;
}

module.exports = {
  DRIFT_TOOL_DEFS,
  executeDriftTool,
};