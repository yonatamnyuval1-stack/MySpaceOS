const registry = require("./registry");
const subscriptions = require("./subscriptions");
const broadcast = require("./broadcast");
const log = require("./log");
const { reportRuntimeFailure } = require("../resolve/report-helper");

/** @type {Map<string, { resolve: Function, reject: Function, timer: NodeJS.Timeout }>} */
const pendingUi = new Map();

const DEFAULT_TIMEOUT_MS = 12000;

function makeRequestId() {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function isAllowedCaller(route, caller) {
  if (!route.callers || !route.callers.length) return true;
  return route.callers.includes(caller);
}

function mapRouteInput(route, args) {
  const input = args || {};
  if (route.inputMap && typeof route.inputMap === "object") {
    const out = {};
    for (const [from, to] of Object.entries(route.inputMap)) {
      if (input[from] !== undefined) out[String(to)] = input[from];
    }
    return out;
  }
  return input;
}

async function invokeIpc(route, args) {
  const channel = route.channel;
  if (!channel) return { ok: false, error: "Route missing IPC channel" };
  const mapped = mapRouteInput(route, args);
  const target = String(route.target || "").trim();
  const broker = String(route.broker || "").trim() || target;

  if (broker === "notifications") {
    const { handleNotificationsInvoke } = require("../apps/notifications-center");
    return handleNotificationsInvoke(channel, mapped);
  }
  if (broker === "jobs") {
    const { handleJobsInvoke } = require("../jobs/broker");
    return handleJobsInvoke("pulse", channel, mapped);
  }
  if (broker === "scheduler") {
    const { handleSchedulerInvoke } = require("../scheduler/broker");
    return handleSchedulerInvoke("pulse", channel, mapped);
  }
  if (broker === "resolve") {
    const { handleResolveInvoke } = require("../resolve/broker");
    return handleResolveInvoke("pulse", channel, mapped);
  }
  if (broker === "mind") {
    const { handleMindInvoke } = require("../mind/broker");
    return handleMindInvoke("pulse", channel, mapped);
  }
  if (broker === "msl" || target === "msl") {
    const { handleMslInvoke } = require("../msl/broker");
    return handleMslInvoke("pulse", channel, mapped);
  }
  if (broker === "composio" || target === "composio" || target.startsWith("composio.")) {
    const { handleComposioInvoke } = require("../composio/broker");
    const toolkit = target.startsWith("composio.") ? target.slice("composio.".length) : "";
    const ctx = {
      toolkit,
      toolSlug: channel && /_/.test(channel) && !channel.includes(".") ? channel : "",
    };
    // Toolkit profile shortcuts
    if (toolkit && channel === "connect") {
      return handleComposioInvoke("connect", { ...mapped, toolkit }, ctx);
    }
    if (toolkit && channel === "tools.list") {
      return handleComposioInvoke("tools.list", { ...mapped, toolkit }, ctx);
    }
    if (toolkit && channel === "execute" && !mapped.tool && ctx.toolSlug) {
      return handleComposioInvoke("execute", { ...mapped, tool: ctx.toolSlug }, ctx);
    }
    return handleComposioInvoke(channel, mapped, ctx);
  }

  const { handleMyAppInvoke } = require("../apps/ipc");
  const result = await handleMyAppInvoke(target, channel, mapped);
  if (route.id === "contacts.list" && result?.ok && args?.q) {
    const q = String(args.q).trim().toLowerCase();
    if (q && Array.isArray(result.data?.contacts)) {
      result.data.contacts = result.data.contacts.filter((c) => {
        const name = [c.firstName, c.lastName, c.displayName, c.company]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return name.includes(q) || String(c.id || "").toLowerCase().includes(q);
      });
    }
  }
  return result;
}

function buildUiPayload(route, args, requestId, caller) {
  return {
    requestId,
    route: route.id,
    target: route.target,
    verb: route.verb,
    args: args || {},
    caller,
    at: new Date().toISOString(),
  };
}

function waitForUiReply(requestId, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingUi.delete(requestId);
      reject(new Error("Command timed out"));
    }, timeoutMs);
    pendingUi.set(requestId, { resolve, reject, timer });
  });
}

function resolveUiReply(requestId, payload) {
  const row = pendingUi.get(requestId);
  if (!row) return { ok: false, error: "Unknown or expired request" };
  clearTimeout(row.timer);
  pendingUi.delete(requestId);
  row.resolve(payload);
  return { ok: true };
}

async function deliverUi(route, args, caller, options = {}) {
  const requestId = options.requestId || makeRequestId();
  const timeoutMs = Math.min(60000, Math.max(1000, parseInt(options.timeout, 10) || DEFAULT_TIMEOUT_MS));
  const payload = buildUiPayload(route, args, requestId, caller);

  let sent = broadcast.sendToModule(route.target, "link-command", payload, subscriptions.getWindowsForModule);
  if (!sent) {
    sent = broadcast.broadcast("link-command", payload);
  }

  log.append({
    kind: "command-ui",
    route: route.id,
    caller,
    requestId,
    delivery: "ui",
    sent,
  });

  if (options.wait === false) {
    return { ok: true, requestId, pending: true, delivered: sent > 0 };
  }

  try {
    const reply = await waitForUiReply(requestId, timeoutMs);
    return { ok: reply?.ok !== false, requestId, result: reply?.result, error: reply?.error, delivered: sent > 0 };
  } catch (err) {
    reportRuntimeFailure("pulse", "COMMAND_UI_TIMEOUT", err, {
      route: route.id,
      caller,
      requestId,
      target: route.target,
    });
    return { ok: false, error: err.message || "UI command timed out", requestId, delivered: sent > 0 };
  }
}

async function sendCommand(caller, args = {}) {
  const target = String(args.target || "").trim();
  const verb = String(args.verb || "").trim();
  const routeId = args.route || (target && verb ? `${target}.${verb}` : "");
  const route = registry.findCommand(routeId);
  if (!route) return { ok: false, error: `Unknown command route: ${routeId}` };
  if (!isAllowedCaller(route, caller)) {
    return { ok: false, error: `Caller "${caller}" may not invoke ${route.id}` };
  }

  const input = args.args || args.input || {};
  let result;

  if (route.delivery === "ipc") {
    result = await invokeIpc(route, input);
    log.append({
      kind: "command-ipc",
      route: route.id,
      caller,
      ok: result?.ok !== false,
      error: result?.error,
    });
  } else {
    result = await deliverUi(route, input, caller, {
      requestId: args.requestId,
      timeout: args.timeout,
      wait: args.wait !== false,
    });
  }

  if (result?.ok !== false && route.emit) {
    const emitPayload = { ...(input || {}), ...(result?.note ? { id: result.note.id, title: result.note.title } : {}) };
    void publishEvent(caller, { topic: route.emit, payload: emitPayload, source: route.id });
  }

  return { ...result, route: route.id, target: route.target, verb: route.verb };
}

function publishEvent(caller, args = {}) {
  const topic = String(args.topic || "").trim();
  if (!topic) return { ok: false, error: "Topic required" };
  const eventDef = registry.findEvent(topic);
  const payload = {
    topic,
    payload: args.payload || {},
    caller,
    source: args.source || caller,
    at: new Date().toISOString(),
  };

  const targets = subscriptions.getTargetsForTopic(topic);
  let delivered = 0;
  for (const row of targets) {
    if (broadcast.sendToWebContents(row.webContents, "link-event", payload)) delivered += 1;
  }
  if (!delivered) {
    delivered = broadcast.broadcast("link-event", payload);
  }

  log.append({
    kind: "event",
    topic,
    caller,
    delivered,
  });

  broadcast.broadcast("link-activity", { type: "event", topic, caller, at: payload.at });

  return { ok: true, topic, delivered };
}

module.exports = {
  sendCommand,
  publishEvent,
  resolveUiReply,
  makeRequestId,
};
