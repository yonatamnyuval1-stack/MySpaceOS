const CONFIRM_TOOLS = new Set([
  "shell_close_app",
  "shell_move_app",
  "shell_run_command",
  "builds_add_project",
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
  "drift_run_scan",
  "drift_add_zone",
  "drift_toggle_zone",
  "drift_update_settings",
  "clock_create_timer",
  "clock_create_stopwatch",
  "clock_create_pomodoro",
  "clock_schedule_meeting",
]);

function needsConfirm(toolName) {
  if (!CONFIRM_TOOLS.has(String(toolName || "").trim())) return false;
  try {
    const { getRequireAiConfirm } = require("../apps/permissions-ipc");
    if (getRequireAiConfirm() === false) return false;
  } catch {
  }
  return true;
}

function describeAction(name, args = {}) {
  const n = String(name || "");
  const a = args && typeof args === "object" ? args : {};
  const app = a.app || a.appId || a.name || "";
  const cmd = a.command || a.line || a.cmd || "";

  switch (n) {
    case "shell_close_app":
      return `Close ${app || "app"}`;
    case "shell_move_app":
      return `Move ${app || "icon"} to (${a.x}, ${a.y})`;
    case "shell_run_command":
      return `Run shell: ${cmd || "(empty)"}`;
    case "shell_open_stock":
      return `Open stock ${a.symbol || a.ticker || ""}`.trim();
    case "shell_open_country":
      return `Open country ${a.country || a.name || a.code || ""}`.trim();
    case "shell_open_app":
      return `Open ${app || "app"}`;
    case "shell_open_page":
      return `Open ${app || "app"} → ${a.page || "page"}`;
    case "shell_focus_app":
      return `Focus ${app || "app"}`;
    case "builds_delete_project":
      return `Delete Builds project ${a.id || a.projectId || ""}`.trim();
    case "drift_run_scan":
      return "Run Drift scan";
    case "clock_create_timer":
      return `Create timer (${a.minutes || a.seconds || "?"} )`;
    default:
      return n.replace(/_/g, " ");
  }
}

async function requestActionConfirm(getMainWindow, { name, arguments: args }) {
  const win = typeof getMainWindow === "function" ? getMainWindow() : getMainWindow;
  if (!win || win.isDestroyed?.()) {
    return { approved: false, reason: "Main window unavailable" };
  }

  const payload = {
    name: String(name || ""),
    arguments: args && typeof args === "object" ? args : {},
    label: describeAction(name, args),
  };

  try {
    const result = await win.webContents.executeJavaScript(
      `(async () => {
        if (typeof window.__myspaceAiConfirmAction === "function") {
          return await window.__myspaceAiConfirmAction(${JSON.stringify(payload)});
        }
        return { approved: true, auto: true };
      })()`,
      true
    );
    if (result && typeof result === "object") {
      return {
        approved: !!result.approved,
        auto: !!result.auto,
        reason: result.reason || undefined,
      };
    }
    return { approved: false, reason: "Invalid confirm response" };
  } catch (err) {
    return { approved: false, reason: err?.message || String(err) };
  }
}

module.exports = {
  CONFIRM_TOOLS,
  needsConfirm,
  describeAction,
  requestActionConfirm,
};
