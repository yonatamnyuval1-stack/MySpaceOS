const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, ".tmp-theme-smoke", "preload-probe.json");
const APPS = ["history", "space", "notes", "tasks", "profiles", "updates", "files", "builds", "mail", "pulse"];

async function test(id) {
  const preload = path.join(ROOT, "apps", id, "preload.js");
  const html = path.join(ROOT, ".tmp-theme-smoke", `probe-${id}.html`);
  fs.mkdirSync(path.dirname(html), { recursive: true });
  fs.writeFileSync(
    html,
    `<!doctype html><meta charset="utf-8"><script>
window.__probe={hasMyApp:!!window.myApp,moduleId:window.myApp&&window.myApp.moduleId,hasInvoke:!!(window.myApp&&window.myApp.invoke),keys:window.myApp?Object.keys(window.myApp):[]};
</script>`,
    "utf8"
  );

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
    },
  });

  const errors = [];
  try {
    win.webContents.on("preload-error", (_e, p, err) => {
      errors.push(`preload-error ${path.basename(p)}: ${err?.message || err}`);
    });
  } catch {
  }

  await win.loadFile(html);
  await new Promise((r) => setTimeout(r, 200));
  const probe = await win.webContents.executeJavaScript("window.__probe");
  win.destroy();
  return {
    id,
    ok: !!(probe?.hasMyApp && (probe.hasInvoke || (probe.keys || []).length)),
    probe,
    errors,
  };
}

app.whenReady().then(async () => {
  const results = [];
  for (const id of APPS) {
    try {
      results.push(await test(id));
    } catch (err) {
      results.push({ id, ok: false, error: String(err?.message || err) });
    }
  }
  const payload = {
    failed: results.filter((r) => !r.ok).length,
    results,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log("WROTE", OUT);
  console.log(JSON.stringify(payload, null, 2));
  app.exit(payload.failed ? 1 : 0);
});