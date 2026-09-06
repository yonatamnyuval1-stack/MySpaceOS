const { app } = require("electron");
const { reportRuntimeFailure } = require("../resolve/report-helper");

function handleAppLifecycle(action) {
  const act = String(action || "").trim().toLowerCase();

  if (act === "quit" || act === "exit" || act === "close") {
    setImmediate(() => {
      try {
        app.quit();
      } catch (err) {
        console.error("quit failed:", err);
        reportRuntimeFailure("os", "QUIT_FAILED", err, {}, "os");
        app.exit(0);
      }
    });
    return { ok: true, action: "quit" };
  }

  if (act === "restart" || act === "relaunch" || act === "reload") {
    setImmediate(() => {
      try {
        app.relaunch();
      } catch (err) {
        console.error("relaunch failed:", err);
        reportRuntimeFailure("os", "RELAUNCH_FAILED", err, {}, "os");
      }
      app.exit(0);
    });
    return { ok: true, action: "restart", restarting: true };
  }

  return { ok: false, error: `Unknown lifecycle action "${act}"` };
}

module.exports = { handleAppLifecycle };
