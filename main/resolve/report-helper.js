function reportIncident(payload = {}, caller = "system") {
  try {
    const { app } = require("electron");
    if (!app || typeof app.getPath !== "function") {
      return { ok: false, skipped: true, error: "Electron app unavailable" };
    }
    const engine = require("./engine");
    return engine.report(payload, caller);
  } catch (err) {
    console.error("resolve report:", err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}

function reportLoadFailure(appId, loaded, caller = appId) {
  return reportIncident(
    {
      appId,
      code: "LOAD_FAILED",
      message: loaded?.error || "Could not load app data",
      context: {
        corrupt: Boolean(loaded?.corrupt),
      },
    },
    caller
  );
}

function reportSaveFailure(appId, result, caller = appId) {
  return reportIncident(
    {
      appId,
      code: "SAVE_FAILED",
      message: result?.error || "Could not save app data",
      context: {},
    },
    caller
  );
}

function reportRuntimeFailure(appId, code, err, context = {}, caller = appId) {
  return reportIncident(
    {
      appId,
      code,
      message: err?.message || String(err || code),
      context,
    },
    caller
  );
}

module.exports = {
  reportIncident,
  reportLoadFailure,
  reportSaveFailure,
  reportRuntimeFailure,
};