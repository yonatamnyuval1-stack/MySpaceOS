const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const { getMyspaceBrowserHome } = require("../main/mail/hub-service");

app.whenReady().then(async () => {
  const { ipcMain } = require("electron");
  const { desktopSearch } = require("../main/apps/desktop-search");
  ipcMain.handle("desktop-search", async (_e, query) => {
    try {
      return await desktopSearch(query);
    } catch (err) {
      return { ok: false, error: String(err?.message || err), results: [] };
    }
  });
  ipcMain.handle("myspace-browser-home", () => getMyspaceBrowserHome());

  const home = getMyspaceBrowserHome();
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
    },
  });

  const host = path.join(__dirname, "..", ".tmp-theme-smoke", "msb-search-ok.html");
  fs.mkdirSync(path.dirname(host), { recursive: true });
  const preloadAttr = String(home.preload).replace(/\\/g, "/");
  fs.writeFileSync(
    host,
    `<!DOCTYPE html><html><body>
    <webview id="v" src="${home.url}" preload="${preloadAttr}"
      partition="persist:msb-search-ok"
      webpreferences="contextIsolation=true,nodeIntegration=false,webSecurity=false"
      style="width:800px;height:600px"></webview>
    <script>
      const v = document.getElementById("v");
      window.__done = new Promise((resolve) => {
        let navigated = null;
        const logs = [];
        v.addEventListener("console-message", (e) => logs.push(e.message));
        v.addEventListener("ipc-message", (e) => {
          if (e.channel === "myspace-browser-navigate") {
            navigated = e.args?.[0]?.url || e.args?.[0] || null;
          }
        });
        v.addEventListener("did-finish-load", async () => {
          try {
            const probe = await v.executeJavaScript(
              "({ hasApi: !!(window.myspaceBrowser && window.myspaceBrowser.navigate && window.myspaceBrowser.search), keys: window.myspaceBrowser ? Object.keys(window.myspaceBrowser) : [] })"
            );
            if (!probe.hasApi) {
              resolve({ ...probe, navigated: null, logs });
              return;
            }
            await v.executeJavaScript(
              'window.myspaceBrowser.navigate("https://www.google.com/search?q=myspace+browser+ok")'
            );
            setTimeout(() => resolve({ ...probe, navigated, logs }), 250);
          } catch (err) {
            resolve({ hasApi: false, error: String(err && err.message || err), navigated: null, logs });
          }
        });
      });
    </script></body></html>`,
    "utf8"
  );

  await win.loadFile(host);
  await new Promise((r) => setTimeout(r, 3500));
  const result = await win.webContents.executeJavaScript("window.__done");

  const checks = [
    { name: "myspaceBrowser API present", ok: !!result?.hasApi },
    {
      name: "navigate IPC to google search",
      ok: typeof result?.navigated === "string" && /google\.com\/search/i.test(result.navigated),
    },
    {
      name: "no preload load failure",
      ok: !(result?.logs || []).some((m) => /Unable to load preload|module not found/i.test(m)),
    },
  ];
  const failed = checks.filter((c) => !c.ok);
  console.log(JSON.stringify({ preload: home.preload, result, checks }, null, 2));
  if (failed.length) {
    console.error("FAIL", failed.map((f) => f.name).join("; "));
    app.exit(1);
    return;
  }
  console.log("OK: Browser search bridge verified");
  app.exit(0);
});