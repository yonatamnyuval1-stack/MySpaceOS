const fs = require("fs");
const path = require("path");
const { app, BrowserWindow } = require("electron");
const store = require("./store");
const playbooks = require("./playbooks");
const actions = require("./actions");

function classify(code, message, context = {}) {
  try {
    const { detectKind, getKind } = require("../fault/kinds");
    const kind = detectKind({ code, message, context });
    return getKind(kind).category;
  } catch {
    const blob = `${code} ${message}`.toLowerCase();
    if (context.corrupt || blob.includes("corrupt") || blob.includes("load_failed")) return "data";
    if (blob.includes("permission") || blob.includes("denied") || blob.includes("forbidden")) return "permission";
    if (blob.includes("network") || blob.includes("fetch") || blob.includes("offline") || blob.includes("econn")) {
      return "network";
    }
    if (blob.includes("ipc") || blob.includes("timeout") || blob.includes("timed out")) return "runtime";
    return "unknown";
  }
}

function severityFor(code, message, explicit) {
  if (explicit && ["info", "warn", "error"].includes(explicit)) return explicit;
  const blob = `${code} ${message}`.toLowerCase();
  if (blob.includes("failed") || blob.includes("corrupt") || blob.includes("error")) return "error";
  if (blob.includes("warn") || blob.includes("retry")) return "warn";
  return "error";
}

function broadcast(snapshot) {
  const payload = snapshot || status();
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    try {
      win.webContents.send("resolve-updated", payload);
    } catch {
      /* ignore */
    }
  }
}

function publishPulseEvent(incident) {
  try {
    const router = require("../link/router");
    router.publishEvent("resolve", {
      topic: "resolve.incident",
      payload: {
        id: incident.id,
        appId: incident.appId,
        code: incident.code,
        severity: incident.severity,
        category: incident.category,
        message: incident.message,
      },
    });
  } catch {
    /* optional */
  }
}

function appendPulseLog(incident, caller) {
  try {
    const log = require("../link/log");
    log.append({
      kind: "resolve-incident",
      route: `${incident.appId}.${incident.code}`,
      caller: caller || incident.caller || "resolve",
      ok: incident.severity !== "error",
      error: incident.severity === "error" ? incident.message : "",
    });
  } catch {
  }
}

function maybeNotify(incident) {
  if (incident.severity !== "error") return;
  try {
    const { push } = require("../apps/notifications-center");
    push(
      {
        appId: "system",
        type: "resolve-incident",
        title: `Resolve · ${incident.appId}`,
        body: `${incident.kind || incident.code}: ${incident.message || ""}`.trim(),
        dedupeKey: `resolve:${incident.appId}:${incident.kind || incident.code}:${incident.id}`,
        priority: "high",
        route: { action: "open-resolve", page: "inbox", incidentId: incident.id },
      },
      { showOs: false }
    );
  } catch {
    /* optional */
  }
}

function buildAskResponse(appId, code, message, context) {
  let kind = code;
  try {
    const { detectKind } = require("../fault/kinds");
    kind = detectKind({ code, message, context });
  } catch {
    /* keep code */
  }
  const pb = playbooks.findPlaybook(appId, code, kind);
  const category = pb?.category || classify(code, message, context);
  return {
    ok: true,
    appId,
    code: kind,
    kind,
    category,
    message: message || "",
    playbook: pb,
    steps: pb?.steps || [],
    hasFix: Boolean(pb?.steps?.length),
  };
}

function report(args = {}, caller = "desktop") {
  const appId = String(args.appId || args.app || args.moduleId || "").trim();
  let code = String(args.code || args.kind || "UNKNOWN").trim();
  const message = String(args.message || args.error || "").trim();
  if (!appId) return { ok: false, error: "appId required" };
  if (!code) return { ok: false, error: "code required" };

  const context = args.context && typeof args.context === "object" ? args.context : {};

  let kind = String(args.kind || "").trim();
  try {
    const { detectKind } = require("../fault/kinds");
    kind = detectKind({ code, kind, message, context, source: context.faultSource });
    code = kind;
  } catch {
    kind = kind || code;
  }

  const pb = playbooks.findPlaybook(appId, code, kind);
  const category = pb?.category || classify(code, message, context);
  const severity = severityFor(code, message, args.severity);

  const existing = store
    .listIncidents({ status: "open", appId, limit: 20 })
    .find((i) => (i.kind || i.code) === kind && i.message === message);
  if (existing && args.dedupe !== false) {
    return { ok: true, incident: existing, deduped: true, playbook: pb };
  }

  const incident = store.addIncident({
    appId,
    code,
    kind,
    severity,
    message,
    category,
    context,
    caller: String(args.caller || caller),
    playbookId: pb?.id || playbooks.playbookKey(appId, code),
  });

  appendPulseLog(incident, caller);
  publishPulseEvent(incident);
  maybeNotify(incident);
  const snap = status();
  broadcast(snap);

  return { ok: true, incident, playbook: pb, snapshot: snap };
}

function ask(args = {}) {
  const appId = String(args.appId || args.app || "").trim();
  const code = String(args.code || "").trim();
  if (!appId || !code) return { ok: false, error: "appId and code required" };
  const message = String(args.message || "").trim();
  const context = args.context && typeof args.context === "object" ? args.context : {};
  return buildAskResponse(appId, code, message, context);
}

function list(args = {}) {
  const incidents = store.listIncidents(args);
  return { ok: true, incidents, total: incidents.length };
}

function get(args = {}) {
  const id = String(args.id || args.incidentId || "").trim();
  if (!id) return { ok: false, error: "id required" };
  const incident = store.getIncident(id);
  if (!incident) return { ok: false, error: "Incident not found" };
  const pb = playbooks.findPlaybook(incident.appId, incident.code, incident.kind);
  return { ok: true, incident, playbook: pb };
}

async function apply(args = {}, caller = "desktop") {
  const id = String(args.id || args.incidentId || "").trim();
  const stepId = String(args.stepId || args.step || "").trim();
  if (!id) return { ok: false, error: "incident id required" };

  const incident = store.getIncident(id);
  if (!incident) return { ok: false, error: "Incident not found" };

  const pb = playbooks.findPlaybook(incident.appId, incident.code, incident.kind);
  if (!pb || !pb.steps.length) {
    return { ok: false, error: "No playbook for this incident" };
  }

  const step = stepId ? pb.steps.find((s) => s.id === stepId) : pb.steps[0];
  if (!step) return { ok: false, error: "Playbook step not found" };

  const result = await actions.runStep(step, incident);
  const logRow = {
    at: new Date().toISOString(),
    stepId: step.id,
    action: step.action,
    ok: result?.ok !== false,
    message: result?.message || result?.error || "",
    caller,
  };

  const applyLog = [...(incident.applyLog || []), logRow];
  const patch = { applyLog };
  if (result?.ok !== false) {
    patch.status = "resolved";
    patch.resolvedAt = new Date().toISOString();
  }
  const updated = store.updateIncident(id, patch);
  const snap = status();
  broadcast(snap);
  return { ok: result?.ok !== false, result, incident: updated, snapshot: snap };
}

function dismiss(args = {}) {
  const id = String(args.id || args.incidentId || "").trim();
  if (!id) return { ok: false, error: "incident id required" };
  const updated = store.updateIncident(id, {
    status: "dismissed",
    resolvedAt: new Date().toISOString(),
  });
  if (!updated) return { ok: false, error: "Incident not found" };
  const snap = status();
  broadcast(snap);
  return { ok: true, incident: updated, snapshot: snap };
}

function clear(args = {}) {
  const state = store.clearIncidents(args);
  const snap = status();
  broadcast(snap);
  return { ok: true, snapshot: snap, remaining: state.incidents.length };
}

function status() {
  const state = store.loadState();
  const open = state.incidents.filter((i) => i.status === "open").length;
  const resolved = state.incidents.filter((i) => i.status === "resolved").length;
  const dismissed = state.incidents.filter((i) => i.status === "dismissed").length;
  return {
    ok: true,
    open,
    resolved,
    dismissed,
    total: state.incidents.length,
    playbooks: playbooks.listPlaybooks().length,
    catalogPath: path.join(app.getAppPath(), "config", "resolve-playbooks.json"),
    storePath: path.join(app.getPath("userData"), "resolve-incidents.json"),
    updatedAt: state.updatedAt,
  };
}

function listPlaybooks() {
  return { ok: true, playbooks: playbooks.listPlaybooks() };
}

module.exports = {
  report,
  ask,
  list,
  get,
  apply,
  dismiss,
  clear,
  status,
  listPlaybooks,
  broadcast,
};