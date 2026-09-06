const { observe } = require("./observe");
const { isNoise } = require("./classify");

function resultLooksFailed(result) {
  if (result == null) return false;
  if (typeof result !== "object") return false;
  if (result.ok === false) return true;
  if (result.error && result.ok !== true) return true;
  return false;
}

function messageFromResult(result) {
  if (!result || typeof result !== "object") return "IPC failure";
  return String(result.error || result.message || "IPC failure").trim() || "IPC failure";
}

function observeIpcResult(appId, channel, result, extra = {}) {
  if (!resultLooksFailed(result)) return null;

  const message = messageFromResult(result);
  const event = {
    source: "ipc.result",
    appId: appId || "system",
    channel: String(channel || ""),
    message,
    code: result.code || undefined,
    context: {
      ...(extra.context || {}),
      interrupted: Boolean(result.interrupted),
    },
    caller: extra.caller || appId || "ipc",
  };

  if (isNoise(event) && !extra.force) {
    return observe({ ...event, severity: "info", noise: true });
  }

  return observe(event);
}

async function runObserved(appId, channel, fn, extra = {}) {
  const id = String(appId || "system");
  const ch = String(channel || "");
  try {
    const result = await fn();
    try {
      observeIpcResult(id, ch, result, { caller: extra.caller || id });
    } catch {
    }
    return result;
  } catch (err) {
    try {
      observe({
        source: "ipc.throw",
        appId: id,
        channel: ch,
        message: err?.message || String(err),
        stack: err?.stack,
        caller: extra.caller || id,
      });
    } catch {
    }
    throw err;
  }
}

module.exports = {
  runObserved,
  observeIpcResult,
  resultLooksFailed,
};