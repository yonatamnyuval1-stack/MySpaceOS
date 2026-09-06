const { observe, observeError } = require("./observe");
const { installContentsHooks } = require("./contents");
const { runObserved, observeIpcResult } = require("./wrap");

let installed = false;

function installProcessHooks() {
  process.on("uncaughtException", (err) => {
    observeError("system", err, {
      source: "process.uncaughtException",
      severity: "error",
      caller: "main",
    });
    console.error("[fault] uncaughtException:", err);
  });

  process.on("unhandledRejection", (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    observeError("system", err, {
      source: "process.unhandledRejection",
      severity: "error",
      caller: "main",
      stack: err.stack,
    });
    console.error("[fault] unhandledRejection:", err);
  });
}

function installIpcReport(ipcMain) {
  if (!ipcMain) return;
  ipcMain.handle("fault.report", (_event, payload = {}) => {
    return observe({
      ...(payload && typeof payload === "object" ? payload : {}),
      source: payload?.source || "manual",
      caller: payload?.caller || "renderer",
    });
  });
}

function install(options = {}) {
  if (installed) return { ok: true, already: true };
  installed = true;

  installProcessHooks();
  try {
    installContentsHooks();
  } catch (err) {
    console.warn("[fault] contents hooks failed:", err?.message || err);
  }

  if (options.ipcMain) {
    installIpcReport(options.ipcMain);
  }

  return { ok: true };
}

module.exports = {
  install,
  observe,
  observeError,
  observeIpcResult,
  runObserved,
};
