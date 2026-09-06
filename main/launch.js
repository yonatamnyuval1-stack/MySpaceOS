const { shell } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");

async function launchExternalApp(target) {
  if (!target || !fs.existsSync(target)) {
    return { ok: false, error: `File not found: ${target || "(empty path)"}` };
  }

  if (process.platform === "win32") {
    try {
      await new Promise((resolve, reject) => {
        const child = spawn("cmd.exe", ["/c", "start", "", target], {
          detached: true,
          stdio: "ignore",
          windowsHide: true,
        });
        child.on("error", reject);
        child.unref();
        resolve();
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  const message = await shell.openPath(target);
  if (message) {
    return { ok: false, error: message };
  }
  return { ok: true };
}

module.exports = { launchExternalApp };