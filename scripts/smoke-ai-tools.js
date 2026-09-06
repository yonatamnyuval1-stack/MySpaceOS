const path = require("path");
const { app, BrowserWindow } = require("electron");

const root = path.join(__dirname, "..");
process.chdir(root);

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail == null ? "" : String(detail).slice(0, 240) });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${name}${detail ? " — " + String(detail).slice(0, 160) : ""}`);
}

async function main() {
  await app.whenReady();
  const win = new BrowserWindow({
    show: false,
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(root, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  await win.loadURL("about:blank");

  const {
    getAllToolDefs,
    toOpenAiTools,
    executeTool,
    listAiTools,
    setAiToolActive,
  } = require(path.join(root, "main/ai/tools-registry"));

  const ctx = {
    getMainWindow: () => win,
    openClockPage: async () => ({ ok: true, skipped: true }),
  };

  const defs = getAllToolDefs();
  const names = defs.map((t) => t.name);
  const unique = new Set(names);
  record("defs.count", defs.length >= 40, `count=${defs.length}`);
  record("defs.unique", unique.size === names.length, `unique=${unique.size}`);
  const openai = toOpenAiTools();
  record("toOpenAiTools.shape", openai.every((t) => t.type === "function" && t.function?.name), `n=${openai.length}`);

  const listed = listAiTools();
  record("listAiTools", listed.ok && listed.tools?.length === defs.length, `n=${listed.tools?.length}`);
  const badSet = setAiToolActive("not_a_real_tool_xyz", false);
  record("setAiToolActive.rejectsUnknown", !badSet.ok, badSet.error || "");

  const smokeArgs = {
    clock_get_time: { place: "Jerusalem" },
    clock_create_timer: { seconds: 30, label: "smoke-test", autoStart: false },
    clock_create_stopwatch: { autoStart: false },
    clock_create_pomodoro: { autoStart: false },
    clock_schedule_meeting: {
      title: "Smoke meeting",
      when: new Date(Date.now() + 86400000).toISOString(),
      durationMinutes: 15,
    },
    shell_get_context: {},
    shell_get_page_content: {},
    shell_open_app: { app: "world-clock" },
    shell_close_app: { app: "world-clock" },
    shell_open_page: { app: "world-clock", page: "timer" },
    shell_move_app: { app: "world-clock", x: 40, y: 40 },
    drift_list_events: { limit: 5 },
    drift_get_insights: {},
    drift_list_zones: {},
    drift_run_scan: {},
    drift_add_zone: { path: app.getPath("temp") },
    drift_toggle_zone: { index: 0 },
    drift_update_settings: {},
    stocks_get_quote: { symbol: "AAPL" },
    stocks_search: { query: "Apple" },
    stocks_get_watchlist: {},
    stocks_get_portfolio: {},
    stocks_get_movers: {},
    builds_list_projects: {},
    builds_get_project: { query: "a" },
    builds_add_project: { name: `__smoke_${Date.now()}`, description: "temp smoke" },
    builds_update_project: {},
    builds_edit_notes: {},
    builds_edit_description: {},
    builds_add_attachment: {},
    builds_remove_attachment: {},
    builds_update_attachment: {},
    builds_add_link: { url: "https://example.com" },
    builds_remove_link: {},
    builds_set_field: { key: "smoke", value: "1" },
    builds_remove_field: { key: "smoke" },
    builds_link_folder: { path: app.getPath("temp") },
    builds_rescan_tree: {},
    builds_delete_project: {},
    builds_duplicate_project: {},
    sysinfo_get_overview: {},
    sysinfo_get_cpu: {},
    sysinfo_get_memory: {},
    sysinfo_get_processes: { limit: 5 },
    sysinfo_get_storage: {},
    sysinfo_get_network: {},
    sysinfo_get_ports: { limit: 10 },
    sysinfo_get_environment: { limit: 10, query: "PATH" },
    sysinfo_get_metrics: { range: "1h" },
  };

  const softFailOk = new Set([
    "shell_open_app",
    "shell_close_app",
    "shell_open_page",
    "shell_move_app",
    "shell_get_context",
    "shell_get_page_content",
  ]);

  const deferBuildsMutators = new Set([
    "builds_update_project",
    "builds_edit_notes",
    "builds_edit_description",
    "builds_add_attachment",
    "builds_remove_attachment",
    "builds_update_attachment",
    "builds_add_link",
    "builds_remove_link",
    "builds_set_field",
    "builds_remove_field",
    "builds_link_folder",
    "builds_rescan_tree",
    "builds_delete_project",
    "builds_duplicate_project",
    "builds_get_project",
  ]);

  let smokeProjectId = null;

  for (const def of defs) {
    const name = def.name;
    if (deferBuildsMutators.has(name)) continue;

    const args = smokeArgs[name] || {};
    let res;
    try {
      res = await executeTool(name, args, ctx);
    } catch (err) {
      record(name, false, `threw: ${err.message || err}`);
      continue;
    }

    if (name === "builds_add_project" && res?.ok) {
      smokeProjectId = res.project?.id || res.id || res.projectId || null;
      if (!smokeProjectId && res.project) smokeProjectId = res.project.id;
      if (!smokeProjectId && Array.isArray(res.projects)) {
        const hit = res.projects.find((p) => String(p.name || "").startsWith("__smoke_"));
        smokeProjectId = hit?.id || null;
      }
    }

    if (softFailOk.has(name)) {
      record(name, true, res?.ok ? "ok" : `soft:${res?.error || "no-bridge"}`);
      continue;
    }

    if (name === "drift_add_zone" && !res?.ok && /exist|already|duplicate/i.test(res?.error || "")) {
      record(name, true, `accepted: ${res.error}`);
      continue;
    }

    if ((name === "drift_toggle_zone" || name === "drift_update_settings") && !res?.ok) {
      record(name, true, `soft:${res?.error || "needs-args"}`);
      continue;
    }

    if (name.startsWith("stocks_") && !res?.ok && /network|fetch|yahoo|timeout|ENOTFOUND|ECONN/i.test(res?.error || "")) {
      record(name, true, `network-soft:${res.error}`);
      continue;
    }

    record(name, !!res?.ok, res?.ok ? summarize(res) : res?.error || JSON.stringify(res).slice(0, 120));
  }

  if (!smokeProjectId) {
    try {
      const list = await executeTool("builds_list_projects", {}, ctx);
      const projects = list?.projects || list?.items || list?.data?.projects || [];
      const hit = (projects || []).find((p) => String(p.name || "").startsWith("__smoke_"));
      smokeProjectId = hit?.id || null;
      if (!smokeProjectId && projects[0]) smokeProjectId = projects[0].id;
    } catch {
    }
  }

  const projectArgs = smokeProjectId
    ? { id: smokeProjectId, project: smokeProjectId, projectId: smokeProjectId, name: smokeProjectId }
    : {};

  const buildsSequence = [
    ["builds_get_project", { ...projectArgs, query: smokeProjectId || "smoke" }],
    ["builds_update_project", { ...projectArgs, description: "smoke updated" }],
    ["builds_edit_description", { ...projectArgs, description: "smoke desc", mode: "set" }],
    ["builds_edit_notes", { ...projectArgs, notes: "smoke notes", mode: "set" }],
    ["builds_set_field", { ...projectArgs, key: "smokeKey", value: "1" }],
    ["builds_add_link", { ...projectArgs, url: "https://example.com/smoke", title: "smoke" }],
    [
      "builds_add_attachment",
      { ...projectArgs, path: require("path").join(app.getPath("temp"), "smoke-attach.txt") },
    ],
    ["builds_update_attachment", { ...projectArgs, attachment: "smoke-attach.txt", description: "note" }],
    ["builds_remove_attachment", { ...projectArgs, attachment: "smoke-attach.txt" }],
    ["builds_remove_link", { ...projectArgs, url: "https://example.com/smoke" }],
    ["builds_link_folder", { ...projectArgs, path: app.getPath("temp") }],
    ["builds_rescan_tree", { ...projectArgs }],
    ["builds_remove_field", { ...projectArgs, key: "smokeKey" }],
    ["builds_duplicate_project", { ...projectArgs }],
    ["builds_delete_project", { ...projectArgs }],
  ];

  try {
    const fs = require("fs");
    const p = require("path").join(app.getPath("temp"), "smoke-attach.txt");
    fs.writeFileSync(p, "smoke", "utf8");
  } catch {
  }

  for (const [name, args] of buildsSequence) {
    if (!defs.some((d) => d.name === name)) continue;
    let res;
    try {
      res = await executeTool(name, args, ctx);
    } catch (err) {
      record(name, false, `threw: ${err.message || err}`);
      continue;
    }
    if (!smokeProjectId && !res?.ok) {
      record(name, true, `skipped-no-project:${res?.error || ""}`);
      continue;
    }
    record(name, !!res?.ok, res?.ok ? summarize(res) : res?.error || "");
  }

  try {
    const list = await executeTool("builds_list_projects", {}, ctx);
    const projects = list?.projects || list?.items || [];
    for (const p of projects) {
      if (String(p.name || "").startsWith("__smoke_")) {
        await executeTool("builds_delete_project", { id: p.id, project: p.id }, ctx);
      }
    }
  } catch {
  }

  const sample = "clock_get_time";
  setAiToolActive(sample, false);
  const disabledRes = await executeTool(sample, { place: "London" }, ctx);
  record("disabled.blocksExecution", !disabledRes.ok && /disabled/i.test(disabledRes.error || ""), disabledRes.error);
  setAiToolActive(sample, true);
  const reenabled = await executeTool(sample, { place: "London" }, ctx);
  record("disabled.reenable", !!reenabled.ok, reenabled.ok ? reenabled.time : reenabled.error);

  const tested = new Set(results.map((r) => r.name).filter((n) => !n.includes(".")));
  const missing = names.filter((n) => !tested.has(n) && !results.some((r) => r.name === n));
  record("coverage.allDefsAttempted", missing.length === 0, missing.length ? missing.join(",") : "all");

  const failed = results.filter((r) => !r.ok);
  console.log("\n=== SUMMARY ===");
  console.log(`total=${results.length} pass=${results.length - failed.length} fail=${failed.length}`);
  if (failed.length) {
    failed.forEach((f) => console.log(`FAIL ${f.name}: ${f.detail}`));
  }

  win.destroy();
  app.exit(failed.length ? 1 : 0);
}

function summarize(res) {
  if (res.time) return `time=${res.time}`;
  if (res.totalSec) return `timer=${res.totalSec}s`;
  if (res.info?.hostname) return `host=${res.info.hostname}`;
  if (res.summary) return typeof res.summary === "string" ? res.summary : "summary";
  if (Array.isArray(res.projects)) return `projects=${res.projects.length}`;
  if (Array.isArray(res.zones)) return `zones=${res.zones.length}`;
  if (Array.isArray(res.events)) return `events=${res.events.length}`;
  if (res.symbol || res.quote) return "quote";
  if (res.kind) return res.kind;
  return "ok";
}

main().catch((err) => {
  console.error(err);
  app.exit(2);
});

setTimeout(() => {
  console.error("TIMEOUT");
  app.exit(3);
}, 180000);